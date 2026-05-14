from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import threading
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Odyssey Local-Core API")

# Setup CORS for local React/Stitch frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to your frontend's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine_process = None
latest_telemetry = {
    "status": "waiting_for_engine",
    "timestamp": None
}

def engine_reader_thread(proc):
    """
    Reads telemetry from the C++ physics engine's stdout and updates the latest payload.
    """
    global latest_telemetry
    logger.info("Started C++ engine stdout reader thread.")
    
    # Read output line-by-line using an iterator to prevent blocking
    for line in iter(proc.stdout.readline, b''):
        try:
            line_str = line.decode('utf-8').strip()
            if not line_str:
                continue
                
            data = json.loads(line_str)
            latest_telemetry = data
            
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse engine output: {line_str}")
        except Exception as e:
            logger.error(f"Error reading engine output: {e}")

@app.on_event("startup")
def startup_event():
    """
    Starts the C++ simulation engine when the FastAPI server initializes.
    """
    global engine_process
    logger.info("Starting C++ physics engine...")
    try:
        engine_process = subprocess.Popen(
            ['./engine'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd='.' # Execute in the current directory
        )
        
        # Start a daemon thread to read the stdout without blocking the API
        t = threading.Thread(target=engine_reader_thread, args=(engine_process,), daemon=True)
        t.start()
        
    except FileNotFoundError:
        logger.error("Could not find the compiled './engine' executable. Did you run build.sh?")
    except Exception as e:
        logger.error(f"Failed to start engine: {e}")

@app.on_event("shutdown")
def shutdown_event():
    """
    Cleans up the C++ process when the server shuts down.
    """
    global engine_process
    if engine_process:
        logger.info("Terminating C++ physics engine...")
        engine_process.terminate()
        try:
            engine_process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            engine_process.kill()

@app.get("/telemetry")
def get_telemetry():
    """
    Endpoint serving the latest state vector and ground station telemetry.
    """
    return latest_telemetry
