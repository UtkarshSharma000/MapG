import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { spawn, execSync } from "child_process";
import fs from "fs";
import { Worker } from "worker_threads";

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

  // Calculate Interplanetary Trajectory via Node.js Worker Threads
  app.post("/api/calculate", (req, res) => {
    const { launchParams, globalTime } = req.body;

    // Use tsx to execute the TypeScript worker in an ESM environment
    const workerPath = path.join(process.cwd(), "src/worker.ts");
    
    const worker = new Worker(workerPath,
      {
        workerData: {
          type: "CALCULATE_PATH",
          payload: { launchParams, globalTime },
        },
        execArgv: ["--import", "tsx"]
      }
    );

    const timeout = setTimeout(() => {
      worker.terminate();
      if (!res.headersSent) {
        res.status(504).json({ error: "Calculation timed out after 30 seconds" });
      }
    }, 30000);

    worker.on("message", (message) => {
      clearTimeout(timeout);
      if (message.success) {
        res.json(message.data);
      } else {
        res.status(500).json({ error: message.error });
      }
    });

    worker.on("error", (err) => {
      clearTimeout(timeout);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    worker.on("exit", (code) => {
      if (code !== 0 && !res.headersSent) {
        res.status(500).json({ error: `Worker exited with code ${code}` });
      }
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
