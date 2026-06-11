import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { spawn, execSync } from "child_process";
import fs from "fs";
import engineApi from "./engineApi";

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

  // Proxy to client's DeepSeek R1 1.5B instance on srinivasa.2bd.net
  app.post("/api/ai-chat", express.json(), async (req: any, res: any) => {
    try {
      const { prompt, messages } = req.body;
      let userPrompt = prompt || "";
      if (!userPrompt && messages && messages.length > 0) {
        userPrompt = messages[messages.length - 1].content;
      }

      // If we have multi-turn message history, format it into a cohesive prompt
      // since the /api/generate endpoint of Ollama does not natively accept raw role lists
      let promptWithHistory = userPrompt;
      if (messages) {
        // Filter out the initial greetings, instructions, or SYS_COMMS info so it doesn't pollute actual model prompt
        const filteredMessages = messages.filter((m: any) => {
          const contentStr = m.content || "";
          return !(m.role === "assistant" && (contentStr.includes("SYS_COMMS LINK ESTABLISHED") || contentStr.includes("Welcome to the SRINIVASA Orbital Simulator")));
        });

        if (filteredMessages.length > 0) {
          promptWithHistory = filteredMessages.map((m: any) => {
            const roleLabel = m.role === "user" ? "User" : "Assistant";
            return `${roleLabel}: ${m.content}`;
          }).join("\n") + "\nAssistant:";
        }
      }

      // Prepare perfect Ollama / Custom API compatible payload
      const payload = {
        model: "deepseek-r1:1.5b",
        prompt: promptWithHistory,
        stream: true, // Now streaming is true!
        system: "You are the Tactical AI Advisor for the Srinivasa Orbital Simulator. Keep answers extremely brief, concise, analytical, factual, and themed with space telemetry.",
        messages: messages || []
      };

      const response = await fetch("https://srinivasa.2bd.net/AI/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`External model API returned status ${response.status}`);
      }

      // Configure headers for Server-Sent Events / Stream response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Force Nginx to bypass buffer instantly

      if (response.body) {
        const readable = response.body as any;
        if (typeof readable[Symbol.asyncIterator] === "function") {
          for await (const chunk of readable) {
            res.write(chunk);
          }
        } else if (readable.getReader) {
          const reader = readable.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          } finally {
            reader.releaseLock();
          }
        } else if (typeof readable.on === "function") {
          readable.on("data", (chunk: any) => {
            res.write(chunk);
          });
          await new Promise((resolve) => {
            readable.on("end", resolve);
          });
        }
      }
      res.end();
    } catch (err: any) {
      console.error("AI Chat proxy error:", err);
      if (!res.headersSent) {
        res.status(502).json({ error: err.message || "Failed to proxy request" });
      } else {
        res.end();
      }
    }
  });

  // Dedicated C++ engine API
  app.use("/api", engineApi);

  // Start the Python FastAPI Bridge
  console.log("Starting Python FastAPI bridge...");
  const pythonProcess = spawn("python3", ["-m", "uvicorn", "main:app", "--port", "8000"], {
    cwd: path.join(process.cwd(), "local_backend"),
  });

  pythonProcess.on("error", (err) => {
    console.error("Failed to start python3. It might not be installed:", err);
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
