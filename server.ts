import "dotenv/config";
import express from "express";
import compression from "compression";
import helmet from "helmet";
import path from "path";
import { createServer as createViteServer } from "vite";
import { spawn, execSync } from "child_process";
import fs from "fs";
import engineApi from "./engineApi";
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";

// Lazy-initialize Gemini SDK to prevent startup crash if API key is not set yet
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// ── Gemini System Tools/Function Declarations ───────────────────────────────────────────
const planOptimizedFlight: FunctionDeclaration = {
  name: "plan_optimized_flight",
  description: "Calculates the most optimal interplanetary trajectory flight path between the origin planet and the destination planet using the orbital optimizer engine, showing the resulting path to the user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      originPlanet: {
        type: Type.STRING,
        description: "The name of the origin planet (e.g., Venus, Earth, Mars). Choose one from: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune."
      },
      destinationPlanet: {
        type: Type.STRING,
        description: "The name of the target planet (e.g., Mars, Venus, Earth). Choose one from: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune."
      }
    },
    required: ["originPlanet", "destinationPlanet"]
  }
};

const launchSimulation: FunctionDeclaration = {
  name: "launch_simulation",
  description: "Engages the planned orbital flight path, igniting space shuttle engines and starting the journey along the calculated target trajectory."
};

const abortSimulation: FunctionDeclaration = {
  name: "abort_simulation",
  description: "Aborts the current active flight path, stopping space travel and resetting simulation propagation instantly."
};

const setTimeAcceleration: FunctionDeclaration = {
  name: "set_time_acceleration",
  description: "Sets the simulation clock warp propagation rate.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      multiplier: {
        type: Type.NUMBER,
        description: "The warp speed multiplier. E.g., 0 to pause, 1 for real speed, 86400 for 1 day/sec, 2592000 for 30 days/sec."
      }
    },
    required: ["multiplier"]
  }
};

const setSimulationTarget: FunctionDeclaration = {
  name: "set_simulation_target",
  description: "Focuses the camera target focus of the planetary viewport to the specified planet celestial body.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetPlanet: {
        type: Type.STRING,
        description: "The name of the target planet to focus. Must be one of: Sol (Sun), Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune."
      }
    },
    required: ["targetPlanet"]
  }
};

const planReturnFlight: FunctionDeclaration = {
  name: "plan_return_flight",
  description: "Sets up and calculates the return trajectory flight path back to planet Earth from the current orbiting destination."
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use compression for all responses except Server-Sent Events
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['accept'] === 'text/event-stream') {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Security headers & features
  app.disable("x-powered-by");
  
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:", "http://localhost:*", "https:"],
        workerSrc: ["'self'", "blob:"],
        fontSrc: ["'self'", "data:", "https:"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null, // Allow HTTP/HTTPS natively
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use((req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // Compile C++ Engine and Install Python Deps
  console.log("Ensuring environment is ready...");
  // We run this asynchronously so it doesn't block app.listen and cause 502 Cloud Run health-check timeouts
  new Promise((resolve) => {
    try {
      execSync("bash local_backend/build.sh", { stdio: "inherit" });
      execSync("python3 -m pip install -r local_backend/requirements.txt", { stdio: "inherit" });
      resolve(true);
    } catch (error) {
      console.error("Setup failed:", error);
      resolve(false);
    }
  }).then(() => {
    // Start the Python FastAPI Bridge after setup
    console.log("Starting Python FastAPI bridge...");
    const pythonProcess = spawn("python3", ["-m", "uvicorn", "main:app", "--port", "8000"], {
      cwd: path.join(process.cwd(), "local_backend"),
    });

    pythonProcess.on("error", (err) => {
      console.error("Failed to start python3. It might not be installed:", err);
    });

    pythonProcess.stdout.on("data", (data) => console.log("Python:", data.toString()));
    pythonProcess.stderr.on("data", (data) => console.error("Python Error:", data.toString()));
  });

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

  // Proxy to Gemini 2.5 Flash Lite
  app.post("/api/ai-chat", express.json(), async (req: any, res: any) => {
    try {
      const { messages } = req.body;
      
      // Check for Gemini API key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.write(JSON.stringify({
          response: "⚠️ **SYSTEM WARNING**: `GEMINI_API_KEY` is not configured in your `.env` file. Please click **Settings > Secrets** in the top right menu to add your key or configure it in the `.env` file at the root, then retry to activate the celestial co-processor."
        }) + "\n");
        res.end();
        return;
      }

      // Map roles correctly for Gemini standard API
      const chatContents = (messages || []).map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      }));

      // Initialize the lazy Gemini client
      const ai = getGeminiClient();

      // Set headers for Server-Sent Events / Stream response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      // Generate content stream with registered tools
      const stream = await ai.models.generateContentStream({
        model: "gemini-3.1-flash-lite", // Replaces Ollama DeepSeek R1 with Gemini
        contents: chatContents,
        config: {
          systemInstruction: "You are the Tactical AI Advisor and System Manager of the Srinivasa Orbital Simulator. You possess specialized tools to control the entire application. When the user requests system controls (e.g., planning optimal trajectory paths from Venus to Mars, launching/engaging simulations, aborting flight paths, setting warp speeds/acceleration, setting camera target focus or planning returns), you MUST use your tools (function declarations) to execute those actions. Keep your feedback concise, professional, grounded in real orbital math, and themed with telemetric systems. Do not explain technical code internals or directories unless explicitly asked.",
          tools: [{
            functionDeclarations: [
              planOptimizedFlight,
              launchSimulation,
              abortSimulation,
              setTimeAcceleration,
              setSimulationTarget,
              planReturnFlight
            ]
          }]
        }
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          res.write(JSON.stringify({ response: chunk.text }) + "\n");
        }
        if (chunk.functionCalls) {
          for (const call of chunk.functionCalls) {
            res.write(JSON.stringify({
              command: {
                name: call.name,
                arguments: call.args
              }
            }) + "\n");
          }
        }
      }

      res.end();
    } catch (err: any) {
      console.error("AI Chat proxy error:", err);
      if (!res.headersSent) {
        res.status(502).json({ error: err.message || "Failed to route your GenAI stream" });
      } else {
        res.write(JSON.stringify({ error: err.message || "Route aborted mid-stream" }) + "\n");
        res.end();
      }
    }
  });

  // Dedicated C++ engine API
  app.use("/api", engineApi);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { maxAge: '1y' }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Generic Error Handler to prevent default server error pages being shown
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    if (req.path.startsWith('/api')) {
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.status(500).send("<h1>Internal Server Error</h1><p>Something went wrong on our end.</p>");
    }
  });

  // Handle 404 for API routes specifically
  app.use('/api', (req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
