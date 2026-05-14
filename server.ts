import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { spawn, execSync } from "child_process";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Compile C++ Engine and Install Python Deps
  console.log("Ensuring environment is ready...");
  try {
    execSync("bash local_backend/build.sh", { stdio: "inherit" });
    execSync("python3 -m pip install -r local_backend/requirements.txt", { stdio: "inherit" });
  } catch (error) {
    console.error("Setup failed:", error);
  }

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
