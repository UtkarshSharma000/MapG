import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { spawn, execSync } from "child_process";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Compile C++ Engine if needed
  console.log("Ensuring C++ engine is built...");
  try {
    execSync("bash local_backend/build.sh", { stdio: "inherit" });
  } catch (error) {
    console.error("Failed to build C++ engine:", error);
  }

  let latestTelemetry: any = { status: "waiting_for_engine" };

  // Start the C++ Engine
  console.log("Starting C++ physics engine...");
  const engineProcess = spawn("./engine", [], { cwd: path.join(process.cwd(), "local_backend") });

  engineProcess.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        latestTelemetry = JSON.parse(line);
      } catch (err) {
        console.warn("Failed to parse engine output:", line);
      }
    }
  });

  engineProcess.stderr.on("data", (data) => {
    console.error("Engine Error:", data.toString());
  });

  engineProcess.on("close", (code) => {
    console.log(`Engine process exited with code ${code}`);
  });

  process.on("exit", () => {
    engineProcess.kill();
  });

  // API Route setup
  app.get("/api/telemetry", (req, res) => {
    res.json(latestTelemetry);
  });

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
