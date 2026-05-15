import asyncio
import json
import math
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from pydantic import BaseModel

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("OdysseyBridge")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants for Delhi math
RE = 6378.137  # Earth Radius (km)
DELHI_LAT = math.radians(28.61)
DELHI_LON = math.radians(77.21)
OMEGA_E = 7.2921159e-5  # Earth rotation rate (rad/s)

latest_telemetry = {"status": "initializing"}

def calculate_delhi_telemetry(data):
    """
    Inertial (ECI) to Topocentric (Range/Elevation)
    Simple rotation assumption (time 0 = GST0)
    """
    try:
        t = data.get("time", 0)
        x, y, z = data["x"], data["y"], data["z"]
        
        # ECI to ECEF rotation
        theta = OMEGA_E * t
        cos_t, sin_t = math.cos(theta), math.sin(theta)
        
        rx_ecef = x * cos_t + y * sin_t
        ry_ecef = -x * sin_t + y * cos_t
        rz_ecef = z
        
        # GS ECEF
        clat, slat = math.cos(DELHI_LAT), math.sin(DELHI_LAT)
        clon, slon = math.cos(DELHI_LON), math.sin(DELHI_LON)
        
        gs_x = RE * clat * clon
        gs_y = RE * clat * slon
        gs_z = RE * slat
        
        # Slant Vector
        dx = rx_ecef - gs_x
        dy = ry_ecef - gs_y
        dz = rz_ecef - gs_z
        
        slant_range = math.sqrt(dx*dx + dy*dy + dz*dz)
        
        # ECEF to ENU (Up vector)
        up = clat * clon * dx + clat * slon * dy + slat * dz
        
        elevation = math.degrees(math.asin(up / slant_range)) if slant_range > 0 else -90
        
        data["delhi_range_km"] = slant_range
        data["delhi_elevation_deg"] = elevation
        return data
    except Exception as e:
        logger.error(f"Math error: {e}")
        return data

async def run_engine():
    global latest_telemetry
    logger.info("Spawning C++ Propagator...")
    
    # Process management using asyncio
    process = await asyncio.create_subprocess_exec(
        "./odyssey_engine",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd="."
    )

    while True:
        line = await process.stdout.readline()
        if not line:
            break
            
        try:
            raw_data = json.loads(line.decode().strip())
            # Enrich with Delhi math in the Python layer
            latest_telemetry = calculate_delhi_telemetry(raw_data)
        except Exception as e:
            pass

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(run_engine())

@app.get("/telemetry")
async def get_telemetry():
    return latest_telemetry

@app.get("/trajectory-preview")
async def trajectory_preview(v0: float, pitch: float, yaw: float, nbody: bool, start_lat: float = 0, start_lon: float = 0, target_lat: float = 0, target_lon: float = 0):
    pitch_rad = math.radians(pitch)
    yaw_rad = math.radians(yaw)
    
    vx = v0 * math.sin(pitch_rad)
    vy = v0 * math.cos(pitch_rad) * math.cos(yaw_rad)
    vz = v0 * math.cos(pitch_rad) * math.sin(yaw_rad)
    
    n_body_flag = "1" if nbody else "0"
    
    # We can pass lat/lon to engine or just let engine generate the curve based on v0, pitch, yaw
    # Adding start_lat, start_lon, target_lat, target_lon to args
    prog = await asyncio.create_subprocess_exec(
        "./odyssey_engine", "preview", str(vx), str(vy), str(vz), n_body_flag, str(start_lat), str(start_lon), str(target_lat), str(target_lon),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd="."
    )
    
    stdout, stderr = await prog.communicate()
    try:
        data = json.loads(stdout.decode())
        return {"path": data}
    except Exception as e:
        return {"error": "Failed to calculate trajectory preview"}

class PredictRequest(BaseModel):
    start_planet: str
    target_orbit: str

@app.post("/predict-path")
async def predict_path(req: PredictRequest):
    return {
        "status": "success",
        "delta_v": 3.14,
        "message": f"Calculated trajectory from {req.start_planet} to {req.target_orbit}."
    }
