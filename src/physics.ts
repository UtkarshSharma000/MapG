export const G = 6.6743015e-11; // m^3 kg^-1 s^-2
export const M_SUN = 1.989e30; // kg
export const MU_SUN = G * M_SUN; // m^3 s^-2

export const AU = 149597870700; // meters

export const PLANET_MASSES: Record<string, number> = {
  Mercury: 3.3011e23,
  Venus: 4.8675e24,
  Earth: 5.972e24,
  Mars: 6.4171e23,
  Jupiter: 1.8982e27,
  Saturn: 5.6834e26,
  Uranus: 8.6810e25,
  Neptune: 1.02413e26,
};

// Orbital elements format
export interface KeplerianElements {
  a: number; // semi-major axis (meters)
  e: number; // eccentricity
  i: number; // inclination (radians)
  Omega: number; // longitude of ascending node (radians)
  w: number; // argument of periapsis (radians)
  M0: number; // mean anomaly at epoch (radians)
  period: number; // seconds
}

export type Vector3 = [number, number, number];
export type StateVector = [...Vector3, ...Vector3]; // [x, y, z, vx, vy, vz]

// Solve Kepler's equation for Eccentric Anomaly (E)
export function solveKepler(M: number, e: number, tol = 1e-6): number {
  let E = M;
  let delta = 1;
  let maxIter = 100;
  while (Math.abs(delta) > tol && maxIter > 0) {
    delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= delta;
    maxIter--;
  }
  return E;
}

export function propagateOrbit(
  elements: KeplerianElements,
  timeSinceEpoch: number,
): Vector3 {
  const { a, e, i, Omega, w, M0, period } = elements;

  const n = (2 * Math.PI) / period;
  let M = M0 + n * timeSinceEpoch;
  M = M % (2 * Math.PI);

  const E = solveKepler(M, e);
  const nu =
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2),
    );

  const r = a * (1 - e * Math.cos(E));

  const xOrbit = r * Math.cos(nu);
  const yOrbit = r * Math.sin(nu);

  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cO = Math.cos(Omega);
  const sO = Math.sin(Omega);
  const ci = Math.cos(i);
  const si = Math.sin(i);

  const x =
    xOrbit * (cw * cO - sw * ci * sO) - yOrbit * (sw * cO + cw * ci * sO);
  const y =
    xOrbit * (cw * sO + sw * ci * cO) - yOrbit * (sw * sO - cw * ci * cO);
  const z = xOrbit * (sw * si) + yOrbit * (cw * si);

  return [x, y, z];
}

export function getOrbitalVelocity(elements: KeplerianElements, timeSinceEpoch: number): Vector3 {
  const dt = 1.0; 
  const p1 = propagateOrbit(elements, timeSinceEpoch - dt/2);
  const p2 = propagateOrbit(elements, timeSinceEpoch + dt/2);
  return [
    (p2[0] - p1[0]) / dt,
    (p2[1] - p1[1]) / dt,
    (p2[2] - p1[2]) / dt
  ];
}

function C(z: number): number {
  if (z > 1e-6) return (1 - Math.cos(Math.sqrt(z))) / z;
  if (z < -1e-6) return (Math.cosh(Math.sqrt(-z)) - 1) / (-z);
  return 1/2 - z/24 + (z*z)/720;
}

function S(z: number): number {
  if (z > 1e-6) return (Math.sqrt(z) - Math.sin(Math.sqrt(z))) / Math.pow(Math.sqrt(z), 3);
  if (z < -1e-6) return (Math.sinh(Math.sqrt(-z)) - Math.sqrt(-z)) / Math.pow(Math.sqrt(-z), 3);
  return 1/6 - z/120 + (z*z)/5040;
}

export function solveLambert(
  r1: Vector3,
  r2: Vector3,
  tof: number,
  mu: number,
  prograde = true
): Vector3 {
  const norm1 = Math.sqrt(r1[0] * r1[0] + r1[1] * r1[1] + r1[2] * r1[2]);
  const norm2 = Math.sqrt(r2[0] * r2[0] + r2[1] * r2[1] + r2[2] * r2[2]);
  
  const cosDnu = (r1[0] * r2[0] + r1[1] * r2[1] + r1[2] * r2[2]) / (norm1 * norm2);
  const cr = [
    r1[1] * r2[2] - r1[2] * r2[1],
    r1[2] * r2[0] - r1[0] * r2[2],
    r1[0] * r2[1] - r1[1] * r2[0],
  ];
  let dnu = Math.acos(Math.max(-1, Math.min(1, cosDnu)));
  
  // Decide which way to go
  if (prograde) {
    if (cr[2] < 0) dnu = 2 * Math.PI - dnu;
  } else {
    if (cr[2] >= 0) dnu = 2 * Math.PI - dnu;
  }
  
  const A = Math.sin(dnu) * Math.sqrt((norm1 * norm2) / (1 - Math.cos(dnu)));
  
  // Robust bisection
  let zLow = -40; // Allow hyperbolic transfers
  let zHigh = 4 * Math.PI * Math.PI;
  let z = 0;
  
  let y = 0;
  for (let iter = 0; iter < 100; iter++) {
    const cVal = C(z);
    const sVal = S(z);
    
    y = norm1 + norm2 + A * (z * sVal - 1) / Math.sqrt(cVal);
    
    // If y is negative, A is too large and z needs adjusting
    if (A > 0 && y < 0) {
      // In some cases y can be negative if the geometry is invalid for that z
      // Adjust toward positive z
      zLow = z;
      z = (z + zHigh) / 2;
      continue;
    }
    
    const x = Math.sqrt(y / cVal);
    const tCalc = (Math.pow(x, 3) * sVal + A * Math.sqrt(y)) / Math.sqrt(mu);
    
    if (Math.abs(tCalc - tof) < 1.0) { // Accuracy within 1 second
      break;
    }
    
    if (tCalc < tof) {
      zLow = z;
    } else {
      zHigh = z;
    }
    z = (zHigh + zLow) / 2;
  }
  
  const f = 1 - y / norm1;
  const g = A * Math.sqrt(y / mu);
  const gDot = 1 - y / norm2;
  
  return [
    (r2[0] - f * r1[0]) / g,
    (r2[1] - f * r1[1]) / g,
    (r2[2] - f * r1[2]) / g,
  ];
}

/**
 * Finds the optimal TOF (Time of Flight) for a transfer from Earth at current time to a planet.
 * Brute force optimization over a reasonable range of days.
 */
export function findOptimalTransfer(
  earthElements: KeplerianElements,
  targetElements: KeplerianElements,
  currentTime: number,
  mu: number,
  isFast: boolean = false
): { tof: number, vReq: Vector3 } {
  const startPos = propagateOrbit(earthElements, currentTime);
  const startVelBase = getOrbitalVelocity(earthElements, currentTime);
  
  let bestTOF = 0;
  let minDV = Infinity;
  let bestV: Vector3 = [0,0,0];

  // Search range: 100 days to 600 days
  const minDays = isFast ? 120 : 180;
  const maxDays = isFast ? 250 : 600;
  const stepDays = 5;

  for (let d = minDays; d <= maxDays; d += stepDays) {
    const tofSeconds = d * 24 * 3600;
    const targetPosFuture = propagateOrbit(targetElements, currentTime + tofSeconds);
    
    try {
      const vLambert = solveLambert(startPos, targetPosFuture, tofSeconds, mu);
      // Calculate delta V
      const dv = Math.sqrt(
        Math.pow(vLambert[0] - startVelBase[0], 2) +
        Math.pow(vLambert[1] - startVelBase[1], 2) +
        Math.pow(vLambert[2] - startVelBase[2], 2)
      );
      
      if (dv < minDV) {
        minDV = dv;
        bestTOF = tofSeconds;
        bestV = vLambert;
      }
    } catch (e) {
      // Skip invalid geometries
    }
  }

  return { tof: bestTOF, vReq: bestV };
}

export function simulateInterplanetaryRK4(
  startPos: Vector3,
  startVel: Vector3,
  startTime: number,
  planetsData: { name: string, elements: KeplerianElements }[],
  duration: number,
  dt: number,
  targetPlanetName: string
): { points: Vector3[], arrivalTime: number, success: boolean } {
  let pos = [...startPos] as Vector3;
  let vel = [...startVel] as Vector3;
  let t = startTime;
  
  const points: Vector3[] = [[...pos]];
  const targetPlanet = planetsData.find(p => p.name === targetPlanetName);
  const targetIndex = planetsData.findIndex(p => p.name === targetPlanetName);
  
  const getDeriv = (p: Vector3, v: Vector3, time: number) => {
    let ax = 0, ay = 0, az = 0;
    const r2 = p[0]*p[0] + p[1]*p[1] + p[2]*p[2];
    const r = Math.sqrt(r2);
    const m_r3 = -MU_SUN / (r2 * r);
    ax += m_r3 * p[0];
    ay += m_r3 * p[1];
    az += m_r3 * p[2];
    
    for (const data of planetsData) {
      const mass = PLANET_MASSES[data.name];
      if (!mass) continue;
      const [px, py, pz] = propagateOrbit(data.elements, time);
      const dx = px - p[0];
      const dy = py - p[1];
      const dz = pz - p[2];
      const dist2 = dx*dx + dy*dy + dz*dz;
      const dist = Math.sqrt(dist2);
      
      const softDist2 = Math.max(dist2, 1e12); 
      const p_r3 = (G * mass) / (softDist2 * Math.sqrt(softDist2));
      
      ax += p_r3 * dx;
      ay += p_r3 * dy;
      az += p_r3 * dz;
    }
    
    return {dp: [v[0], v[1], v[2]], dv: [ax, ay, az]};
  };

  let steps = Math.floor(duration / dt);
  const outRate = Math.max(1, Math.floor(steps / 1000));
  
  let prevDist = Infinity;
  let success = false;
  let arrivalTime = startTime + duration;
  
  const planetRadiiKm = [2439, 6051, 6371, 3389, 69911, 58232, 25362, 24622];
  const radius = (planetRadiiKm[targetIndex] || 6000) * 1000;
  const soi = radius * 50; // Increased SOI for detection

  for (let i = 0; i < steps; i++) {
    const k1 = getDeriv(pos, vel, t);
    const p2: Vector3 = [pos[0] + 0.5*dt*k1.dp[0], pos[1] + 0.5*dt*k1.dp[1], pos[2] + 0.5*dt*k1.dp[2]];
    const v2: Vector3 = [vel[0] + 0.5*dt*k1.dv[0], vel[1] + 0.5*dt*k1.dv[1], vel[2] + 0.5*dt*k1.dv[2]];
    const k2 = getDeriv(p2, v2, t + 0.5*dt);
    const p3: Vector3 = [pos[0] + 0.5*dt*k2.dp[0], pos[1] + 0.5*dt*k2.dp[1], pos[2] + 0.5*dt*k2.dp[2]];
    const v3: Vector3 = [vel[0] + 0.5*dt*k2.dv[0], vel[1] + 0.5*dt*k2.dv[1], vel[2] + 0.5*dt*k2.dv[2]];
    const k3 = getDeriv(p3, v3, t + 0.5*dt);
    const p4: Vector3 = [pos[0] + dt*k3.dp[0], pos[1] + dt*k3.dp[1], pos[2] + dt*k3.dp[2]];
    const v4: Vector3 = [vel[0] + dt*k3.dv[0], vel[1] + dt*k3.dv[1], vel[2] + dt*k3.dv[2]];
    const k4 = getDeriv(p4, v4, t + dt);
    
    pos[0] += (dt/6) * (k1.dp[0] + 2*k2.dp[0] + 2*k3.dp[0] + k4.dp[0]);
    pos[1] += (dt/6) * (k1.dp[1] + 2*k2.dp[1] + 2*k3.dp[1] + k4.dp[1]);
    pos[2] += (dt/6) * (k1.dp[2] + 2*k2.dp[2] + 2*k3.dp[2] + k4.dp[2]);
    vel[0] += (dt/6) * (k1.dv[0] + 2*k2.dv[0] + 2*k3.dv[0] + k4.dv[0]);
    vel[1] += (dt/6) * (k1.dv[1] + 2*k2.dv[1] + 2*k3.dv[1] + k4.dv[1]);
    vel[2] += (dt/6) * (k1.dv[2] + 2*k2.dv[2] + 2*k3.dv[2] + k4.dv[2]);
    
    t += dt;
    
    if (i % outRate === 0 || i === steps - 1) {
      points.push([...pos]);
    }
    
    if (targetPlanet) {
      const [tx, ty, tz] = propagateOrbit(targetPlanet.elements, t);
      const d2 = (pos[0]-tx)*(pos[0]-tx) + (pos[1]-ty)*(pos[1]-ty) + (pos[2]-tz)*(pos[2]-tz);
      const d = Math.sqrt(d2);
      
      if (d < radius * 5) {
        success = true;
        arrivalTime = t;
        points.push([tx, ty, tz]); // Force snap to target center for last point
        break;
      }
      
      if (d < soi && d > prevDist) {
        // We missed the close intercept but we were close enough to call it a "pass"
        // In a simplified sim, we can stop here or continue.
        // Let's break to show the landing/pass.
        arrivalTime = t;
        success = d < radius * 20;
        break;
      }
      prevDist = d;
    }
  }
  
  return { points, arrivalTime, success };
}


