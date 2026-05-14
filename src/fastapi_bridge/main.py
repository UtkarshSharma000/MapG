from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import json
import time

app = FastAPI(title="Odyssey 2026 FastAPI Bridge")

# Allow requests from the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

START_TIME = time.time()

@app.get("/api/telemetry")
def get_telemetry():
    elapsed_time = time.time() - START_TIME
    
    try:
        # We call the compiled C++ executable
        # On Ubuntu, make sure to compile the C++ first: cd src/cpp_engine && make
        result = subprocess.run(
            ["./src/cpp_engine/orbit_engine", str(elapsed_time)],
            capture_output=True,
            text=True,
            check=True
        )
        
        # Parse the JSON string emitted by the C++ engine
        data = json.loads(result.stdout)
        return data
        
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"C++ Engine Failed: {e.stderr}")
    except FileNotFoundError:
        raise HTTPException(
            status_code=500, 
            detail="C++ Engine not found. Please compile orbit.cpp via Makefile first."
        )

if __name__ == "__main__":
    import uvicorn
    # Make sure to run this via: `python3 main.py` or `uvicorn main:app`
    uvicorn.run(app, host="0.0.0.0", port=8000)
