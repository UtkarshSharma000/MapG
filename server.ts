import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { spawn } from "child_process";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request logger
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // Health check / Debug
  app.get("/api/status", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // Compilation is handled by the dev/build scripts, no need to block startup here
  console.log("Starting server...");

  let latestTelemetry: any = { status: "waiting_for_engine" };

  // API Route setup - Proxy to FastAPI bridge
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
      const { v0, pitch, yaw, nbody, startLat, startLon, targetLat, targetLon, targetPlanet } = req.query;
      const url = `http://localhost:8000/trajectory-preview?v0=${v0}&pitch=${pitch}&yaw=${yaw}&nbody=${nbody}&start_lat=${startLat || 0}&start_lon=${startLon || 0}&target_lat=${targetLat || 0}&target_lon=${targetLon || 0}&target_planet=${targetPlanet || ""}`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trajectory preview" });
    }
  });

  // Calculate Interplanetary Trajectory via C++ Engine Subprocess
  app.post("/api/calculate", (req, res) => {
    console.log("Spawning odyssey_engine_interplanetary calculate...");
    const enginePath = path.join(process.cwd(), "local_backend/odyssey_engine_interplanetary");
    
    // Check if engine exists, if not try building it
    if (!fs.existsSync(enginePath)) {
      console.error("C++ Engine not found at", enginePath);
      return res.status(500).json({ error: "Orbital engine not found. Ensure build.sh ran successfully." });
    }

    const engine = spawn(enginePath, ["calculate"]);
    let outputData = "";
    let errorData = "";

    // Flatten and sanitize the input for the naive C++ JSON parser
    const { launchParams, globalTime } = req.body;
    let finalTargetPlanet = launchParams?.targetPlanet;
    if (!finalTargetPlanet && launchParams?.missionLegs && launchParams.missionLegs.length > 0) {
      const lastLeg = launchParams.missionLegs[launchParams.missionLegs.length - 1];
      const planetMap: Record<number, string> = {
        1: "Mercury",
        2: "Venus",
        3: "Earth",
        4: "Mars",
        5: "Jupiter",
        6: "Saturn",
        7: "Uranus",
        8: "Neptune",
      };
      finalTargetPlanet = planetMap[lastLeg.destId];
    }
    const finalLaunchPlanet = launchParams?.launchPlanet || "Earth";
    const finalGlobalTime = globalTime ?? launchParams?.launchDay_j2000 ?? 0;

    const flatInput = {
      launchPlanet: finalLaunchPlanet,
      targetPlanet: finalTargetPlanet || "Mars",
      globalTime: finalGlobalTime,
      v0: launchParams?.v0,
      pitch: launchParams?.pitch,
      yaw: launchParams?.yaw,
      autoRoute: launchParams?.isAutoWarp
    };

    // Pipe flattened request JSON to engine stdin
    engine.stdin.write(JSON.stringify(flatInput));
    engine.stdin.end();

    engine.stdout.on("data", (data) => {
      outputData += data.toString();
    });

    engine.stderr.on("data", (data) => {
      errorData += data.toString();
      console.error("C++ Engine Error:", data.toString());
    });

    engine.on("close", (code) => {
      if (code !== 0) {
        console.error(`C++ Engine exited with code ${code}`);
        return res.status(500).json({ error: "Trajectory calculation failed", message: errorData });
      }
      try {
        const jsonResponse = JSON.parse(outputData);
        res.json(jsonResponse);
      } catch (parseError) {
        console.error("Failed to parse engine output:", outputData);
        res.status(500).json({ error: "Invalid response from calculation engine" });
      }
    });

    engine.on("error", (err) => {
      console.error("Failed to start C++ engine:", err);
      res.status(500).json({ error: "Failed to spawn calculation process" });
    });
  });

  // Start the Python FastAPI Bridge
  console.log("Starting Python FastAPI bridge...");
  const pythonProcess = spawn("python3", ["-m", "uvicorn", "main:app", "--port", "8000"], {
    cwd: path.join(process.cwd(), "local_backend"),
  });

  pythonProcess.stdout.on("data", (data) => console.log("Python:", data.toString()));
  pythonProcess.stderr.on("data", (data) => console.error("Python Error:", data.toString()));

  // Vite middleware for development
  const isProduction = process.env.NODE_ENV === "production";
  console.log(`Starting server in ${isProduction ? "production" : "development"} mode`);

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn("Dist path not found, falling back to Vite middleware even in production mode");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
