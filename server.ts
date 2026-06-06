import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { spawn, execSync } from "child_process";
import fs from "fs";
import engineApi from "./engineApi";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Compile C++ Engine and Install Python Deps conditionally to ensure near-instant startup
  console.log("Ensuring environment is ready...");
  try {
    const enginePath = path.join(process.cwd(), "local_backend/odyssey_engine");
    if (!fs.existsSync(enginePath)) {
      console.log("C++ engine binary not found. Compiling engine...");
      execSync("bash local_backend/build.sh", { stdio: "inherit" });
    } else {
      console.log("C++ engine binary found. Skipping compilation to keep startup instant.");
    }

    const pipFlagPath = path.join(process.cwd(), "local_backend/.pip_installed");
    if (!fs.existsSync(pipFlagPath)) {
      console.log("First-time setup: installing Python dependencies...");
      execSync("python3 -m pip install -r local_backend/requirements.txt", { stdio: "inherit" });
      fs.writeFileSync(pipFlagPath, "installed_at_" + Date.now());
    } else {
      console.log("Python dependencies already satisfied. Skipping pip to keep startup instant.");
    }
  } catch (error) {
    console.error("Setup warning (non-fatal, continuing):", error);
  }

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

  // Start the Python FastAPI Bridge
  console.log("Starting Python FastAPI bridge...");
  const pythonProcess = spawn("python3", ["-m", "uvicorn", "main:app", "--port", "8000"], {
    cwd: path.join(process.cwd(), "local_backend"),
  });

  pythonProcess.stdout.on("data", (data) => console.log("Python:", data.toString()));
  pythonProcess.stderr.on("data", (data) => console.error("Python Error:", data.toString()));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
