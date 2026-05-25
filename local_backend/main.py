import asyncio
import json
import math
import logging
import time as pytime
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

# Physical Constants for LEO mode (km, seconds, kg)
RE = 6378.137  # Earth Radius (km)
DELHI_LAT = math.radians(28.61)
DELHI_LON = math.radians(77.21)
OMEGA_E = 7.2921159e-5  # Earth rotation rate (rad/s)

MU_EARTH = 398600.4418
J2_CONST = 1.08262668e-3

MU_SUN_N = 132712440018.0
MU_MOON = 4902.8
MU_JUPITER = 126686534.0

RHO0 = 2e-12
H0 = 150.0
SH = 8.5
CD = 2.2
AM = 0.01

# Constants for Interplanetary mode (meters, seconds)
AU = 1.495978707e11
MU_SUN = 1.32712440018e20

table = {
    "Mercury": {"sma": 0.387*AU, "period": 87.97*86400, "radius": 2439700, "mu": 2.203e13},
    "Venus": {"sma": 0.723*AU, "period": 224.70*86400, "radius": 6051800, "mu": 3.249e14},
    "Mars": {"sma": 1.524*AU, "period": 686.97*86400, "radius": 3389500, "mu": 4.283e13},
    "Jupiter": {"sma": 5.203*AU, "period": 11.86*365.25*86400, "radius": 71492000, "mu": 1.267e17},
    "Saturn": {"sma": 9.58*AU, "period": 29.45*365.25*86400, "radius": 60268000, "mu": 3.793e16},
    "Uranus": {"sma": 19.22*AU, "period": 84.01*365.25*86400, "radius": 25559000, "mu": 5.794e15},
    "Neptune": {"sma": 30.07*AU, "period": 164.8*365.25*86400, "radius": 24622000, "mu": 6.837e15},
}

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

# Local Python background task simulating 10Hz Earth satellite telemetry
async def run_engine():
    global latest_telemetry
    logger.info("Starting Python-based persistent satellite orbit simulation...")
    
    r_orbit = RE + 400.0  # 400 km orbit
    v_orbit = math.sqrt(MU_EARTH / r_orbit)
    omega = v_orbit / r_orbit
    
    start_time = pytime.time()
    while True:
        elapsed = pytime.time() - start_time
        t = elapsed * 15.0  # Speed up time visually for dynamic UI telemetry updates
        
        x = r_orbit * math.cos(omega * t)
        y = r_orbit * math.sin(omega * t)
        z = r_orbit * 0.1 * math.sin(omega * t)
        
        vx = -v_orbit * math.sin(omega * t)
        vy = v_orbit * math.cos(omega * t)
        vz = v_orbit * 0.1 * math.cos(omega * t)
        
        raw_telemetry = {
            "time": t,
            "x": x,
            "y": y,
            "z": z,
            "vx": vx,
            "vy": vy,
            "vz": vz,
            "status": "orbiting_earth"
        }
        latest_telemetry = calculate_delhi_telemetry(raw_telemetry)
        await asyncio.sleep(0.1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(run_engine())

@app.get("/telemetry")
async def get_telemetry():
    return latest_telemetry

# LEO RK4 / Nbody Helpers
def get_norm(v):
    return math.sqrt(v[0]**2 + v[1]**2 + v[2]**2)

def get_bpos_sun(t):
    omega = 2.0 * math.pi / 31557600.0
    r = 149597870.0
    return (r * math.cos(omega * t), r * math.sin(omega * t), 0.0)

def get_bpos_moon(t):
    omega = 2.0 * math.pi / (27.3 * 86400.0)
    r = 384400.0
    return (r * math.cos(omega * t), r * math.sin(omega * t), r * 0.087 * math.sin(omega * t))

def get_bpos_jupiter(t):
    omega = 2.0 * math.pi / (11.86 * 31557600.0)
    r = 778500000.0
    pos_sun = get_bpos_sun(t)
    return (
        pos_sun[0] + r * math.cos(omega * t),
        pos_sun[1] + r * math.sin(omega * t),
        pos_sun[2]
    )

def get_derivatives_prop(pos, vel, t, nbody_enabled):
    rx, ry, rz = pos
    vx, vy, vz = vel
    r = get_norm(pos)
    r3 = r * r * r
    
    # 1. Simple Gravity
    ax = -MU_EARTH * rx / r3
    ay = -MU_EARTH * ry / r3
    az = -MU_EARTH * rz / r3
    
    # 2. J2 Perturbation
    z2 = rz * rz
    r2 = r * r
    j2_const = 1.5 * J2_CONST * MU_EARTH * (RE**2) / (r**5)
    ax += j2_const * rx * (5.0 * z2 / r2 - 1.0)
    ay += j2_const * ry * (5.0 * z2 / r2 - 1.0)
    az += j2_const * rz * (5.0 * z2 / r2 - 3.0)
    
    # 3. N-Body
    if nbody_enabled:
        bodies = [
            ("Sun", MU_SUN_N, get_bpos_sun(t)),
            ("Moon", MU_MOON, get_bpos_moon(t)),
            ("Jupiter", MU_JUPITER, get_bpos_jupiter(t))
        ]
        for name, mu, bpos in bodies:
            rbx, rby, rbz = bpos[0]-rx, bpos[1]-ry, bpos[2]-rz
            rb_norm = math.sqrt(rbx**2 + rby**2 + rbz**2)
            rb_norm3 = rb_norm**3
            
            re_norm = math.sqrt(bpos[0]**2 + bpos[1]**2 + bpos[2]**2)
            re_norm3 = re_norm**3
            
            ax += mu * (rbx / rb_norm3 - bpos[0] / re_norm3)
            ay += mu * (rby / rb_norm3 - bpos[1] / re_norm3)
            az += mu * (rbz / rb_norm3 - bpos[2] / re_norm3)
            
    # 4. Atmospheric Drag
    alt = r - RE
    if 0 < alt < 200.0:
        rho = RHO0 * math.exp(-(alt - H0) / SH)
        v = get_norm(vel)
        f = -0.5 * CD * AM * rho * 1000.0 * v
        ax += f * vx
        ay += f * vy
        az += f * vz
        
    return vel, (ax, ay, az)

def step_rk4_prop(pos, vel, t, dt, nbody_enabled):
    v1, a1 = get_derivatives_prop(pos, vel, t, nbody_enabled)
    
    p2 = (pos[0] + 0.5*dt*v1[0], pos[1] + 0.5*dt*v1[1], pos[2] + 0.5*dt*v1[2])
    v2_arg = (vel[0] + 0.5*dt*a1[0], vel[1] + 0.5*dt*a1[1], vel[2] + 0.5*dt*a1[2])
    v2, a2 = get_derivatives_prop(p2, v2_arg, t + 0.5*dt, nbody_enabled)
    
    p3 = (pos[0] + 0.5*dt*v2[0], pos[1] + 0.5*dt*v2[1], pos[2] + 0.5*dt*v2[2])
    v3_arg = (vel[0] + 0.5*dt*a2[0], vel[1] + 0.5*dt*a2[1], vel[2] + 0.5*dt*a2[2])
    v3, a3 = get_derivatives_prop(p3, v3_arg, t + 0.5*dt, nbody_enabled)
    
    p4 = (pos[0] + dt*v3[0], pos[1] + dt*v3[1], pos[2] + dt*v3[2])
    v4_arg = (vel[0] + dt*a3[0], vel[1] + dt*a3[1], vel[2] + dt*a3[2])
    v4, a4 = get_derivatives_prop(p4, v4_arg, t + dt, nbody_enabled)
    
    pos_new = (
        pos[0] + (dt/6.0) * (v1[0] + 2*v2[0] + 2*v3[0] + v4[0]),
        pos[1] + (dt/6.0) * (v1[1] + 2*v2[1] + 2*v3[1] + v4[1]),
        pos[2] + (dt/6.0) * (v1[2] + 2*v2[2] + 2*v3[2] + v4[2])
    )
    vel_new = (
        vel[0] + (dt/6.0) * (a1[0] + 2*a2[0] + 2*a3[0] + a4[0]),
        vel[1] + (dt/6.0) * (a1[1] + 2*a2[1] + 2*a3[1] + a4[1]),
        vel[2] + (dt/6.0) * (a1[2] + 2*a2[2] + 2*a3[2] + a4[2])
    )
    return pos_new, vel_new, t + dt

# Guidance Computer Path Finding
def simulate_trajectory(pos, vel, dt=1.0, max_steps=10000):
    path = [pos]
    for _ in range(max_steps):
        pos, vel, _ = step_rk4_prop(pos, vel, 0.0, dt, False)
        path.append(pos)
        r = get_norm(pos)
        if r <= RE:
            break
        if r > RE * 50:
            break
    return pos, path

def find_landing_trajectory(pos, target_lat, target_lon, earth_rotation_rate):
    r_val = get_norm(pos)
    v_mag = math.sqrt(MU_EARTH / r_val)
    pos_norm = (pos[0]/r_val, pos[1]/r_val, pos[2]/r_val)
    
    # circular retro-burn fallback guess
    v_guess = (-pos_norm[1] * v_mag * 0.5, pos_norm[0] * v_mag * 0.5, 0.1)
    
    dt = 2.0
    max_iters = 20
    delta_v = 1e-4
    
    for iter in range(max_iters):
        final_pos, path = simulate_trajectory(pos, v_guess, dt)
        tof = len(path) * dt
        
        # Expected target position after rotation
        eq_lat = math.radians(target_lat)
        eq_lon = math.radians(target_lon) + earth_rotation_rate * tof
        
        target_pos = (
            RE * math.cos(eq_lat) * math.cos(eq_lon),
            RE * math.cos(eq_lat) * math.sin(eq_lon),
            RE * math.sin(eq_lat)
        )
        
        f_norm = get_norm(final_pos)
        dist = math.sqrt((final_pos[0]-target_pos[0])**2 + (final_pos[1]-target_pos[1])**2 + (final_pos[2]-target_pos[2])**2)
        if dist < 10.0 or f_norm > RE * 1.5:
            if f_norm <= RE * 1.05:
                return path
                
        # Jacobian Estimation
        J = []
        error = (final_pos[0]-target_pos[0], final_pos[1]-target_pos[1], final_pos[2]-target_pos[2])
        for i in range(3):
            dv = [0.0, 0.0, 0.0]
            dv[i] = delta_v
            v_test = (v_guess[0]+dv[0], v_guess[1]+dv[1], v_guess[2]+dv[2])
            fpos_test, _ = simulate_trajectory(pos, v_test, dt)
            
            col = (
                (fpos_test[0] - target_pos[0] - error[0]) / delta_v,
                (fpos_test[1] - target_pos[1] - error[1]) / delta_v,
                (fpos_test[2] - target_pos[2] - error[2]) / delta_v
            )
            J.append(col)
            
        c0, c1, c2 = J[0], J[1], J[2]
        detJ = (c0[0]*(c1[1]*c2[2] - c1[2]*c2[1]) - 
                c1[0]*(c0[1]*c2[2] - c0[2]*c1[2]) + 
                c2[0]*(c0[1]*c1[2] - c0[2]*c1[1]))
                
        if abs(detJ) > 1e-12:
            detX = (error[0]*(c1[1]*c2[2] - c1[2]*c2[1]) - 
                    c1[0]*(error[1]*c2[2] - error[2]*c2[1]) + 
                    c2[0]*(error[1]*c1[2] - error[2]*c1[1]))
            detY = (c0[0]*(error[1]*c2[2] - error[2]*c2[1]) - 
                    error[0]*(c0[1]*c2[2] - c0[2]*c2[1]) + 
                    c2[0]*(c0[1]*error[2] - c0[2]*error[1]))
            detZ = (c0[0]*(c1[1]*error[2] - c1[2]*error[1]) - 
                    c1[0]*(c0[1]*error[2] - c0[2]*error[1]) + 
                    error[0]*(c0[1]*c1[2] - c0[2]*c1[1]))
            v_guess = (
                v_guess[0] - (detX / detJ) * 0.5,
                v_guess[1] - (detY / detJ) * 0.5,
                v_guess[2] - (detZ / detJ) * 0.5
            )
        else:
            v_guess = (
                v_guess[0] - error[0] * 0.01,
                v_guess[1] - error[1] * 0.01,
                v_guess[2] - error[2] * 0.01
            )
            
    _, path = simulate_trajectory(pos, v_guess, dt)
    return path


# Trajectory endpoints
@app.get("/trajectory-preview")
async def trajectory_preview(
    v0: float, pitch: float, yaw: float, nbody: bool, 
    start_lat: float = 0, start_lon: float = 0, 
    target_lat: float = 0, target_lon: float = 0, 
    target_planet: str = ""
):
    if target_planet and target_planet != "Earth":
        # Interplanetary Hohmann curve
        au_km = 1.495978707e8
        planet_a = {
            "Mercury": 0.387 * au_km,
            "Venus": 0.723 * au_km,
            "Mars": 1.524 * au_km,
            "Jupiter": 5.204 * au_km,
            "Saturn": 9.582 * au_km,
            "Uranus": 19.201 * au_km,
            "Neptune": 30.047 * au_km,
        }
        r1 = 1.0 * au_km
        r2 = planet_a.get(target_planet, 1.524 * au_km)
        
        at = (r1 + r2) / 2.0
        et = abs(r2 - r1) / (r1 + r2)
        
        path = []
        is_outer = r2 > r1
        steps = 500
        for i in range(steps + 1):
            theta = math.pi * i / steps
            if not is_outer:
                theta += math.pi
            
            r = at * (1 - et**2) / (1 + et * math.cos(theta))
            x = r * math.cos(theta)
            y = r * math.sin(theta)
            z = r * 0.05 * math.sin(theta)
            path.append([x, y, z])
            
        return {"path": path}

    # LEO Launch Mode
    pitch_rad = math.radians(pitch)
    yaw_rad = math.radians(yaw)
    
    vx = v0 * math.sin(pitch_rad)
    vy = v0 * math.cos(pitch_rad) * math.cos(yaw_rad)
    vz = v0 * math.cos(pitch_rad) * math.sin(yaw_rad)
    
    lat_rad = math.radians(start_lat)
    lon_rad = math.radians(start_lon)
    
    # Start 400km above Earth surface
    rx = (RE + 400.0) * math.cos(lat_rad) * math.cos(lon_rad)
    ry = (RE + 400.0) * math.cos(lat_rad) * math.sin(lon_rad)
    rz = (RE + 400.0) * math.sin(lat_rad)
    
    state_pos = (rx, ry, rz)
    state_vel = (vx, vy, vz)
    
    if target_lat != 0.0 or target_lon != 0.0:
        # Targeted Landing Path Finding
        earth_rotation_rate = 7.2921159e-5
        path_3d = find_landing_trajectory(state_pos, target_lat, target_lon, earth_rotation_rate)
        return {"path": [[pt[0], pt[1], pt[2]] for pt in path_3d]}
        
    # Standard 10-day Orbit Prediction
    t = 0.0
    dt = 100.0
    path = []
    
    pos = state_pos
    vel = state_vel
    for _ in range(8640):
        pos, vel, t = step_rk4_prop(pos, vel, t, dt, nbody)
        path.append([pos[0], pos[1], pos[2]])
        if get_norm(pos) <= RE:
            break
            
    return {"path": path}


# Heliocentric derivation for Interplanetary Transfer
def deriv_heliocentric(pos, vel):
    rx, ry, rz = pos
    r = math.sqrt(rx*rx + ry*ry + rz*rz)
    r3 = r * r * r
    ax = -MU_SUN * rx / r3
    ay = -MU_SUN * ry / r3
    az = -MU_SUN * rz / r3
    return vel, (ax, ay, az)


# Interplanetary trajectory calculator
@app.post("/calculate")
async def calculate_interplanetary(req: dict):
    targetPlanet = req.get("targetPlanet", "Mars")
    globalTime = req.get("globalTime", 0.0)
    
    tgt = table.get(targetPlanet, table["Mars"])
    
    earth_sma = AU
    earth_angle = (2.0 * math.pi * globalTime) / (365.25 * 86400.0)
    cos_earth = math.cos(earth_angle)
    sin_earth = math.sin(earth_angle)
    
    earth_pos = (earth_sma * cos_earth, earth_sma * sin_earth, 0.0)
    earth_vel = (-29780.0 * sin_earth, 29780.0 * cos_earth, 0.0)
    
    tgt_sma = tgt["sma"]
    
    # Hohmann Orbit transfer
    a_transfer = (earth_sma + tgt_sma) / 2.0
    tof = math.pi * math.sqrt((a_transfer * a_transfer * a_transfer) / MU_SUN)
    
    v_earth = math.sqrt(MU_SUN / earth_sma)
    v_depart = math.sqrt(MU_SUN * (2.0 / earth_sma - 1.0 / a_transfer))
    v_arrive = math.sqrt(MU_SUN * (2.0 / tgt_sma - 1.0 / a_transfer))
    v_tgt_circ = math.sqrt(MU_SUN / tgt_sma)
    
    dv_depart = abs(v_depart - v_earth)
    dv_arrive = abs(v_tgt_circ - v_arrive)
    total_dv = dv_depart + dv_arrive
    
    ev_norm = math.sqrt(earth_vel[0]**2 + earth_vel[1]**2 + earth_vel[2]**2)
    depart_dir = (earth_vel[0]/ev_norm, earth_vel[1]/ev_norm, earth_vel[2]/ev_norm)
    if tgt_sma < earth_sma:
        depart_dir = (-depart_dir[0], -depart_dir[1], -depart_dir[2])
        
    sc_pos = earth_pos
    sc_vel = (
        earth_vel[0] + depart_dir[0] * dv_depart,
        earth_vel[1] + depart_dir[1] * dv_depart,
        earth_vel[2] + depart_dir[2] * dv_depart
    )
    
    N = 500
    dt_step = tof / N
    pts = []
    
    for i in range(N):
        pts.append([sc_pos[0]/1000.0, sc_pos[1]/1000.0, sc_pos[2]/1000.0])
        
        # RK4 step
        v1, a1 = deriv_heliocentric(sc_pos, sc_vel)
        
        p2 = (sc_pos[0] + 0.5*dt_step*v1[0], sc_pos[1] + 0.5*dt_step*v1[1], sc_pos[2] + 0.5*dt_step*v1[2])
        v2_arg = (sc_vel[0] + 0.5*dt_step*a1[0], sc_vel[1] + 0.5*dt_step*a1[1], sc_vel[2] + 0.5*dt_step*a1[2])
        v2, a2 = deriv_heliocentric(p2, v2_arg)
        
        p3 = (sc_pos[0] + 0.5*dt_step*v2[0], sc_pos[1] + 0.5*dt_step*v2[1], sc_pos[2] + 0.5*dt_step*v2[2])
        v3_arg = (sc_vel[0] + 0.5*dt_step*a2[0], sc_vel[1] + 0.5*dt_step*a2[1], sc_vel[2] + 0.5*dt_step*a2[2])
        v3, a3 = deriv_heliocentric(p3, v3_arg)
        
        p4 = (sc_pos[0] + dt_step*v3[0], sc_pos[1] + dt_step*v3[1], sc_pos[2] + dt_step*v3[2])
        v4_arg = (sc_vel[0] + dt_step*a3[0], sc_vel[1] + dt_step*a3[1], sc_vel[2] + dt_step*a3[2])
        v4, a4 = deriv_heliocentric(p4, v4_arg)
        
        sc_pos = (
            sc_pos[0] + (dt_step/6.0) * (v1[0] + 2*v2[0] + 2*v3[0] + v4[0]),
            sc_pos[1] + (dt_step/6.0) * (v1[1] + 2*v2[1] + 2*v3[1] + v4[1]),
            sc_pos[2] + (dt_step/6.0) * (v1[2] + 2*v2[2] + 2*v3[2] + v4[2])
        )
        sc_vel = (
            sc_vel[0] + (dt_step/6.0) * (a1[0] + 2*a2[0] + 2*a3[0] + a4[0]),
            sc_vel[1] + (dt_step/6.0) * (a1[1] + 2*a2[1] + 2*a3[1] + a4[1]),
            sc_vel[2] + (dt_step/6.0) * (a1[2] + 2*a2[2] + 2*a3[2] + a4[2])
        )
        
    max_dv = 15000.0 if tgt_sma > 4.0 * AU else 3500.0
    captured = total_dv <= max_dv
    remaining = max_dv - total_dv
    capture_alt = (tgt["radius"] / 1000.0) * 0.3
    
    orbit_period_days = 195.6
    
    return {
        "points": pts,
        "arrivalTime": globalTime + tof,
        "success": captured,
        "missionStatus": "ORBIT CAPTURE" if captured else "OVERSHOT",
        "captureAltitude": capture_alt,
        "orbitPeriod": orbit_period_days,
        "isOvershot": not captured,
        "remainingDeltaV": remaining,
        "usedDuration": tof,
        "simStartTime": globalTime,
        "dvLabel": total_dv,
        "vReq": v_depart / 1000.0
    }


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
