import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { spawn, execSync, exec } from "child_process";
import fs from "fs";
import engineApi from "./engineApi";

async function startServer() {
  const app = express();
  const PORT = 3000;

  let latestTelemetry: any = { status: "waiting_for_engine" };

  // API Route setup - Proxy to FastAPI bridge for legacy routes
  app.get("/api/telemetry", async (req, res) => {
    try {
      const response = await fetch("http://localhost:8000/telemetry");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(503).json({ status: "engine_starting", error: "FastAPI not ready" });
    }
  });

  app.get("/api/trajectory-preview", async (req, res) => {
    try {
      const { v0, pitch, yaw, nbody, startLat, startLon, targetLat, targetLon, targetPlanet, launchPlanet } = req.query;
      const url = `http://localhost:8000/trajectory-preview?v0=${v0}&pitch=${pitch}&yaw=${yaw}&nbody=${nbody}&start_lat=${startLat || 0}&start_lon=${startLon || 0}&target_lat=${targetLat || 0}&target_lon=${targetLon || 0}&target_planet=${targetPlanet || ""}&launch_planet=${launchPlanet || "Earth"}`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trajectory preview" });
    }
  });

  // Dedicated C++ engine API
  app.use("/api", engineApi);

  // robust resolution of project root and dist
  const isCompiled = __dirname.endsWith(path.sep + "dist") || __dirname.endsWith("/dist");
  const projectRoot = isCompiled ? path.join(__dirname, "..") : __dirname;
  const distPath = path.join(projectRoot, "dist");
  const publicPath = path.join(projectRoot, "public");

  const texturesOptions = {
    maxAge: "30d",
    immutable: true,
    setHeaders: (res: any) => {
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
  };

  app.use("/textures", express.static(path.join(publicPath, "textures"), texturesOptions));
  if (fs.existsSync(path.join(distPath, "textures"))) {
    app.use("/textures", express.static(path.join(distPath, "textures"), texturesOptions));
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // distPath is already defined above as __dirname
    app.use(express.static(distPath));
    app.use("/textures", express.static(path.join(distPath, "textures"), texturesOptions));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  function startPythonBridge() {
    console.log("Starting Python FastAPI bridge...");
    try {
      const pythonProcess = spawn("python3", ["-m", "uvicorn", "main:app", "--port", "8000"], {
        cwd: path.join(projectRoot, "local_backend"),
      });

      pythonProcess.stdout.on("data", (data) => console.log("Python:", data.toString()));
      pythonProcess.stderr.on("data", (data) => console.error("Python Error:", data.toString()));
    } catch (err) {
      console.error("Failed to start Python bridge:", err);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Perform environment preparation asynchronously in the background so the port is active immediately!
    setTimeout(() => {
      console.log("Running background preparation...");
      try {
        const enginePath = path.join(projectRoot, "local_backend/odyssey_engine");
        if (!fs.existsSync(enginePath)) {
          console.log("C++ engine binary not found. Compiling in background...");
          exec("bash local_backend/build.sh", { cwd: projectRoot }, (err, stdout, stderr) => {
            if (err) {
              console.error("Failed to compile C++ engine:", err);
            } else {
              console.log("C++ engine compiled successfully.");
            }
          });
        } else {
          console.log("C++ engine binary found. Skipping compilation.");
        }

        const pipFlagPath = path.join(projectRoot, "local_backend/.pip_installed");
        if (!fs.existsSync(pipFlagPath)) {
          console.log("Installing Python dependencies in background...");
          exec("python3 -m pip install -r local_backend/requirements.txt", { cwd: projectRoot }, (err, stdout, stderr) => {
            if (err) {
              console.error("Setup warning: pip install error in background (continuing):", err);
            } else {
              console.log("Python dependencies verified/installed.");
              fs.writeFileSync(pipFlagPath, "installed_at_" + Date.now());
            }
            startPythonBridge();
          });
        } else {
          console.log("Python dependencies already satisfied.");
          startPythonBridge();
        }
      } catch (error) {
        console.error("Setup background error:", error);
        startPythonBridge();
      }
    }, 501);
  });
}

startServer();
