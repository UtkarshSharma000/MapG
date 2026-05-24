export const G = 6.6743015e-11; // m^3 kg^-1 s^-2
export const M_SUN = 1.989e30; // kg
export const MU_SUN = G * M_SUN; // m^3 s^-2

export const AU = 149597870700; // meters

export const PLANET_MASSES: Record<string, number> = {
  Mercury: 3.3011e23,
  Venus: 4.8675e24,
  Earth: 5.97216e24,
  Mars: 6.4171e23,
  Jupiter: 1.8982e27,
  Saturn: 5.6834e26,
  Uranus: 8.6810e25,
  Neptune: 1.02413e26,
  // Moons
  Moon: 7.34767e22,
  Phobos: 1.0659e16,
  Deimos: 1.4762e15,
  Io: 8.9319e22,
  Europa: 4.800e22,
  Ganymede: 1.4819e23,
  Callisto: 1.0759e23,
  Titan: 1.3452e23,
  Triton: 2.14e22,
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
  let zLow = -4 * Math.PI * Math.PI; 
  let zHigh = 4 * Math.PI * Math.PI;
  let z = 0;
  
  let y = 0;
  const tol = 1e-4; // Better precision
  for (let iter = 0; iter < 100; iter++) {
    const cVal = C(z);
    const sVal = S(z);
    
    // Safety check for cVal near 0
    const denom = Math.sqrt(cVal);
    y = norm1 + norm2 + A * (z * sVal - 1) / denom;
    
    if (A > 0 && y < 0) {
      zLow = z;
      z = (z + zHigh) / 2;
      continue;
    }
    
    const x = Math.sqrt(y / cVal);
    const tCalc = (Math.pow(x, 3) * sVal + A * Math.sqrt(y)) / Math.sqrt(mu);
    
    if (Math.abs(tCalc - tof) < 0.01) { // Accuracy within 0.01 second
      break;
    }
    
    if (tCalc < tof) {
      zLow = z;
    } else {
      zHigh = z;
    }
    z = (zHigh + zLow) / 2;
    if (Math.abs(zHigh - zLow) < tol) break;
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

export const J2000_UNIX = 946728000; // Seconds since Unix epoch to J2000

export function getJ2000Time(unixTimeSeconds: number): number {
  return unixTimeSeconds - J2000_UNIX;
}

/**
 * Finds the optimal TOF (Time of Flight) for a transfer from Earth at current time to a planet.
 * Brute force optimization over a reasonable range of days with two-pass refinement.
 */
export function findOptimalTransfer(
  earthElements: KeplerianElements,
  targetElements: KeplerianElements,
  currentTime: number,
  mu: number,
  isFast: boolean = false
): { tof: number, vReq: Vector3, dvReq: number } {
  const startPos = propagateOrbit(earthElements, currentTime);
  const startVelBase = getOrbitalVelocity(earthElements, currentTime);
  
  let bestTOF = 0;
  let minDV = Infinity;
  let bestV: Vector3 = [0,0,0];

  let minDays = 100;
  let maxDays = 800;

  const aAU = targetElements.a / AU;
  if (aAU < 0.5) { // Mercury
    minDays = 35;
    maxDays = 180;
  } else if (aAU < 0.8) { // Venus
    minDays = 50;
    maxDays = 260;
  } else if (aAU < 1.3) { // Earth / Moon
    minDays = 10;
    maxDays = 120;
  } else if (aAU < 1.7) { // Mars
    minDays = 120;
    maxDays = 450;
  } else if (aAU < 6.0) { // Jupiter
    minDays = 450;
    maxDays = 1200;
  } else if (aAU < 11.0) { // Saturn
    minDays = 800;
    maxDays = 2200;
  } else if (aAU < 22.0) { // Uranus
    minDays = 2000;
    maxDays = 9000;
  } else { // Neptune / Outer Solar System (30 AU)
    minDays = 3000;
    maxDays = 15000;
  }

  if (isFast) {
    minDays = Math.max(10, minDays * 0.4);
    maxDays = maxDays * 0.6;
  }
  
  // Pass 1: Coarse search
  // Larger step for very long search ranges to keep performance stellar
  const coarseStep = maxDays > 5000 ? 55 : (maxDays > 2000 ? 15 : 5);
  for (let d = minDays; d <= maxDays; d += coarseStep) {
    const tofSeconds = d * 24 * 3600;
    const targetPosFuture = propagateOrbit(targetElements, currentTime + tofSeconds);
    
    try {
      const vLambert = solveLambert(startPos, targetPosFuture, tofSeconds, mu);
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
    } catch (e) {}
  }

  // Pass 2: Refined search
  if (bestTOF > 0) {
    const centralDay = bestTOF / (24 * 3600);
    for (let d = centralDay - 4; d <= centralDay + 4; d += 0.5) {
      const tofSeconds = d * 24 * 3600;
      const targetPosFuture = propagateOrbit(targetElements, currentTime + tofSeconds);
      try {
        const vLambert = solveLambert(startPos, targetPosFuture, tofSeconds, mu);
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
      } catch (e) {}
    }
  }

  return { tof: bestTOF, vReq: bestV, dvReq: minDV };
}

export function simulateInterplanetaryRK4(
  startPos: Vector3,
  startVel: Vector3,
  startTime: number,
  planetsData: { name: string, elements: KeplerianElements }[],
  duration: number,
  dt: number,
  targetPlanetName: string,
  twoBodyOnly: boolean = false
): { points: Vector3[], arrivalTime: number, success: boolean, missionStatus?: string, captureAltitude?: number, orbitPeriod?: number, isOvershot?: boolean, remainingDeltaV?: number, usedDuration?: number } {
  let pos = [...startPos] as Vector3;
  let vel = [...startVel] as Vector3;
  let t = startTime;

  // 1. Limit departure speed relative to launch planet (Earth) to 25.0 km/s (25000 m/s)
  const earthPlanet = planetsData.find(p => p.name === "Earth") || planetsData[2];
  const startVelBase = getOrbitalVelocity(earthPlanet.elements, startTime);
  const dVx = vel[0] - startVelBase[0];
  const dVy = vel[1] - startVelBase[1];
  const dVz = vel[2] - startVelBase[2];
  const actualDvLaunch = Math.sqrt(dVx*dVx + dVy*dVy + dVz*dVz);
  const MAX_LAUNCH_DV = 25000.0; // 25 km/s
  if (actualDvLaunch > MAX_LAUNCH_DV) {
    const scale = MAX_LAUNCH_DV / actualDvLaunch;
    vel[0] = startVelBase[0] + dVx * scale;
    vel[1] = startVelBase[1] + dVy * scale;
    vel[2] = startVelBase[2] + dVz * scale;
  }

  const points: Vector3[] = [[...pos]];
  const targetPlanet = planetsData.find(p => p.name === targetPlanetName);
  const targetIndex = planetsData.findIndex(p => p.name === targetPlanetName);

  // Dynamic simulation duration adjustment based on distance to cover and starting velocity
  let adjustedDuration = duration;
  if (targetPlanet) {
    const startR = Math.sqrt(startPos[0]*startPos[0] + startPos[1]*startPos[1] + startPos[2]*startPos[2]);
    const targetR = targetPlanet.elements.a;
    const distToCover = Math.abs(targetR - startR);
    const startVHelper = Math.sqrt(vel[0]*vel[0] + vel[1]*vel[1] + vel[2]*vel[2]);
    // Spacecraft slows down as it climbs the gravity well; factor 0.65 represents a healthy average velocity
    const avgSpeed = Math.max(10000, startVHelper * 0.65);
    const estTOF = distToCover / avgSpeed;
    // Let's make sure the integration runs long enough (with a 80% safety margin) to reach capture
    if (estTOF * 1.8 > adjustedDuration) {
      adjustedDuration = estTOF * 1.8;
    }
  }
  
  const launchPlanet = planetsData.find(p => {
    const ppos = propagateOrbit(p.elements, startTime);
    const d2 = Math.pow(ppos[0]-startPos[0],2) + Math.pow(ppos[1]-startPos[1],2) + Math.pow(ppos[2]-startPos[2],2);
    return Math.sqrt(d2) < 2e9; // Within 2 million km at launch translates to launch planet
  });

  // Optimize: Perturbations only matter from launch planet & target planet during a direct trajectory
  const activePerturbers: typeof planetsData = [];
  if (launchPlanet) {
    activePerturbers.push(launchPlanet);
  }
  if (targetPlanet && targetPlanet.name !== launchPlanet?.name) {
    activePerturbers.push(targetPlanet);
  }

  const getDeriv = (p: Vector3, v: Vector3, time: number) => {
    let ax = 0, ay = 0, az = 0;
    const r2 = p[0]*p[0] + p[1]*p[1] + p[2]*p[2];
    const r = Math.sqrt(r2);
    const m_r3 = -MU_SUN / (r2 * r);
    ax += m_r3 * p[0];
    ay += m_r3 * p[1];
    az += m_r3 * p[2];
    
    if (!twoBodyOnly) {
      for (const data of activePerturbers) {
        if (data.name === launchPlanet?.name) continue; // Earth's escape is already in V_inf Lambert solution
        const mass = PLANET_MASSES[data.name];
        if (!mass) continue;
        const [px, py, pz] = propagateOrbit(data.elements, time);
        const dx = px - p[0];
        const dy = py - p[1];
        const dz = pz - p[2];
        const dist2 = dx*dx + dy*dy + dz*dz;
        
        // Prevent singularity near center of target planet
        const softDist2 = Math.max(dist2, 1e13); 
        const p_r3 = (G * mass) / (softDist2 * Math.sqrt(softDist2));

        ax += p_r3 * dx;
        ay += p_r3 * dy;
        az += p_r3 * dz;
      }
    }
    
    return {dp: [v[0], v[1], v[2]], dv: [ax, ay, az]};
  };

  let captured = false;
  let isOvershot = false;
  let remainingDeltaV = 3500.0; // Deep-space Delta-V maneuvers budget (m/s)
  let missionStatus: string | undefined;
  let captureAltitude: number | undefined;
  let orbitPeriod: number | undefined;

  let success = false;
  let arrivalTime = startTime + adjustedDuration;
  
  const planetRadiiKm = [2439, 6051, 6371, 3389, 69911, 58232, 25362, 24622];
  const radius = (planetRadiiKm[targetIndex] || 6000) * 1000;
  const soi = radius * 150; 
  
  const targetOutSteps = 200; // Optimal points for trajectory path
  const outDt = adjustedDuration / targetOutSteps;
  let lastOutTime = startTime;
  const timeLimit = startTime + adjustedDuration;

  while (t < timeLimit) {
    // Dynamic timestep: Deep heliocentric space tolerates much larger step (up to 8 hours),
    // speeding up integration dramatically. Scale down only near SOI.
    let currentDt = Math.min(28800, adjustedDuration / 150);
    
    for (const p of activePerturbers) {
      const mass = PLANET_MASSES[p.name];
      if (!mass) continue;
      
      const [tx, ty, tz] = propagateOrbit(p.elements, t);
      const d2 = (pos[0]-tx)*(pos[0]-tx) + (pos[1]-ty)*(pos[1]-ty) + (pos[2]-tz)*(pos[2]-tz);
      const d = Math.sqrt(d2);
      
      const pRadius = (planetRadiiKm[planetsData.indexOf(p)] || 6000) * 1000;
      const pSoi = pRadius * 150;
      
      if (d < pSoi) {
        // Slow down smoothly inside SOI down to fine dt (600s) for precision
        const factor = d / pSoi;
        const targetDt = Math.max(dt, dt * factor);
        if (targetDt < currentDt) {
          currentDt = targetDt;
        }
      } else if (d < pSoi * 5) {
        // Safe transition zone out of SOI
        const factor = (d - pSoi) / (pSoi * 4);
        const transitionDt = dt + (28800 - dt) * factor;
        if (transitionDt < currentDt) {
          currentDt = transitionDt;
        }
      }
    }

    // Safety constraint to prevent overrunning the target time
    if (t + currentDt > timeLimit) {
      currentDt = timeLimit - t;
    }

    const k1 = getDeriv(pos, vel, t);
    const p2: Vector3 = [pos[0] + 0.5*currentDt*k1.dp[0], pos[1] + 0.5*currentDt*k1.dp[1], pos[2] + 0.5*currentDt*k1.dp[2]];
    const v2: Vector3 = [vel[0] + 0.5*currentDt*k1.dv[0], vel[1] + 0.5*currentDt*k1.dv[1], vel[2] + 0.5*currentDt*k1.dv[2]];
    const k2 = getDeriv(p2, v2, t + 0.5*currentDt);
    const p3: Vector3 = [pos[0] + 0.5*currentDt*k2.dp[0], pos[1] + 0.5*currentDt*k2.dp[1], pos[2] + 0.5*currentDt*k2.dp[2]];
    const v3: Vector3 = [vel[0] + 0.5*currentDt*k2.dv[0], vel[1] + 0.5*currentDt*k2.dv[1], vel[2] + 0.5*currentDt*k2.dv[2]];
    const k3 = getDeriv(p3, v3, t + 0.5*currentDt);
    const p4: Vector3 = [pos[0] + currentDt*k3.dp[0], pos[1] + currentDt*k3.dp[1], pos[2] + currentDt*k3.dp[2]];
    const v4: Vector3 = [vel[0] + currentDt*k3.dv[0], vel[1] + currentDt*k3.dv[1], vel[2] + currentDt*k3.dv[2]];
    const k4 = getDeriv(p4, v4, t + currentDt);
    
    pos[0] += (currentDt/6) * (k1.dp[0] + 2*k2.dp[0] + 2*k3.dp[0] + k4.dp[0]);
    pos[1] += (currentDt/6) * (k1.dp[1] + 2*k2.dp[1] + 2*k3.dp[1] + k4.dp[1]);
    pos[2] += (currentDt/6) * (k1.dp[2] + 2*k2.dp[2] + 2*k3.dp[2] + k4.dp[2]);
    vel[0] += (currentDt/6) * (k1.dv[0] + 2*k2.dv[0] + 2*k3.dv[0] + k4.dv[0]);
    vel[1] += (currentDt/6) * (k1.dv[1] + 2*k2.dv[1] + 2*k3.dv[1] + k4.dv[1]);
    vel[2] += (currentDt/6) * (k1.dv[2] + 2*k2.dv[2] + 2*k3.dv[2] + k4.dv[2]);
    
    t += currentDt;
    
    if (t - lastOutTime >= outDt || points.length === 0) {
      points.push([...pos]);
      lastOutTime = t;
    }
    
    if (targetPlanet) {
      const [tx, ty, tz] = propagateOrbit(targetPlanet.elements, t);
      const d2 = (pos[0]-tx)*(pos[0]-tx) + (pos[1]-ty)*(pos[1]-ty) + (pos[2]-tz)*(pos[2]-tz);
      const d = Math.sqrt(d2);
      
      if (d < soi) {
        if (!captured && !isOvershot) {
          const targetVel = getOrbitalVelocity(targetPlanet.elements, t);
          const relVel: Vector3 = [vel[0] - targetVel[0], vel[1] - targetVel[1], vel[2] - targetVel[2]];
          const relV = Math.sqrt(relVel[0]*relVel[0] + relVel[1]*relVel[1] + relVel[2]*relVel[2]);
          const muTarget = G * (PLANET_MASSES[targetPlanet.name] || 0);
          
          const energy = 0.5 * relV * relV - muTarget / d;
          
          // Calculate angular momentum vector h = r_rel x v_rel to locate periapsis
          const r_rel: Vector3 = [pos[0] - tx, pos[1] - ty, pos[2] - tz];
          const h_x = r_rel[1] * relVel[2] - r_rel[2] * relVel[1];
          const h_y = r_rel[2] * relVel[0] - r_rel[0] * relVel[2];
          const h_z = r_rel[0] * relVel[1] - r_rel[1] * relVel[0];
          const h = Math.sqrt(h_x*h_x + h_y*h_y + h_z*h_z);

          // Standard orbital mechanics: rp = a * (e - 1)
          let rp = d;
          if (energy > 0) {
            const a_hyper = muTarget / (2.0 * energy);
            const eccentricity = Math.sqrt(1.0 + (2.0 * energy * h * h) / (muTarget * muTarget));
            rp = a_hyper * (eccentricity - 1.0);
          }
          if (rp <= 0 || isNaN(rp)) rp = radius;

          // Arrival velocity at periapsis
          const vArrival = Math.sqrt(2.0 * (energy + muTarget / rp));

          // Desired orbital period matching UI: 195.6 DAYS
          const targetPeriodSeconds = 195.6 * 86400.0;
          const aTarget = Math.pow(muTarget * Math.pow(targetPeriodSeconds / (2.0 * Math.PI), 2), 1.0 / 3.0);

          // Capture velocity at periapsis from Vis-Viva: v_capt = sqrt(mu * (2/rp - 1/a))
          const vCapture = Math.sqrt(muTarget * (2.0 / rp - 1.0 / aTarget));

          // Delta V required to convert fly-by hyperbola to target elliptical orbit
          const deltaVRequired = vArrival - vCapture;

          if (deltaVRequired <= 0.0) {
            // Already bound
            captured = true;
            success = true;
            arrivalTime = t;
            missionStatus = `${targetPlanet.name.toUpperCase()}_ORBIT`;
            captureAltitude = (rp - radius) / 1000;
            orbitPeriod = 195.6;
          } else if (remainingDeltaV >= deltaVRequired) {
            // Spend fuel and perform burn
            remainingDeltaV -= deltaVRequired;
            captured = true;
            success = true;
            arrivalTime = t;
            missionStatus = `${targetPlanet.name.toUpperCase()}_ORBIT`;
            captureAltitude = (rp - radius) / 1000;
            orbitPeriod = 195.6;

            // Retard the relative velocity vector structure at periapsis
            const vHat = [relVel[0]/relV, relVel[1]/relV, relVel[2]/relV];
            vel[0] = targetVel[0] + vHat[0] * vCapture;
            vel[1] = targetVel[1] + vHat[1] * vCapture;
            vel[2] = targetVel[2] + vHat[2] * vCapture;
          } else {
            // Fuel depleted. Fly-past!
            isOvershot = true;
            captured = false;
            success = false;
            missionStatus = "OVERSHOT - INSUFFICIENT FUEL";
          }
        }
      }
    }
  }
  
  if (!success && targetPlanet) {
    arrivalTime = t;
  }

  if (points.length > 0) {
    points[points.length - 1] = [...pos];
  } else {
    points.push([...pos]);
  }
  
  return { points, arrivalTime, success, missionStatus, captureAltitude, orbitPeriod, isOvershot, remainingDeltaV, usedDuration: adjustedDuration };
}


