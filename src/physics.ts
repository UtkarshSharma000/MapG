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

export function simulateInterplanetaryRK4(
  startPos: Vector3,
  startVel: Vector3,
  startTime: number,
  planetsData: { name: string, elements: KeplerianElements }[],
  duration: number,
  dt: number,
  targetPlanetName: string
): { points: Vector3[], arrivalTime: number } {
  let pos = [...startPos] as Vector3;
  let vel = [...startVel] as Vector3;
  let t = startTime;
  
  const points: Vector3[] = [[...pos]];
  const targetPlanet = planetsData.find(p => p.name === targetPlanetName);
  
  const getDeriv = (p: Vector3, v: Vector3, time: number) => {
    let ax = 0, ay = 0, az = 0;
    // Sun
    const r2 = p[0]*p[0] + p[1]*p[1] + p[2]*p[2];
    const r = Math.sqrt(r2);
    const m_r3 = -MU_SUN / (r2 * r);
    ax += m_r3 * p[0];
    ay += m_r3 * p[1];
    az += m_r3 * p[2];
    
    // Planets
    for (const data of planetsData) {
      const mass = PLANET_MASSES[data.name];
      if (!mass) continue;
      const [px, py, pz] = propagateOrbit(data.elements, time);
      const dx = px - p[0];
      const dy = py - p[1];
      const dz = pz - p[2];
      const dist2 = dx*dx + dy*dy + dz*dz;
      const dist = Math.sqrt(dist2);
      
      // if we crash into the planet, gravity goes huge. Add a tiny softening OR stop at surface radius?
      const softDist2 = Math.max(dist2, 1e12); // soften at 1000km to avoid singularities in big steps
      const p_r3 = (G * mass) / (softDist2 * Math.sqrt(softDist2));
      
      ax += p_r3 * dx;
      ay += p_r3 * dy;
      az += p_r3 * dz;
    }
    
    return {dp: [v[0], v[1], v[2]], dv: [ax, ay, az]};
  };

  let minTargetDist = Infinity;
  let arrivalTime = startTime + duration;

  let steps = Math.floor(duration / dt);
  const outRate = Math.max(1, Math.floor(steps / 1000));
  
  let prevDist = Infinity;
  
  for (let i = 0; i < steps; i++) {
    const k1 = getDeriv(pos, vel, t);
    
    // ... rk4 steps ...
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
      const targetPos = propagateOrbit(targetPlanet.elements, t);
      const dist = Math.sqrt(Math.pow(pos[0]-targetPos[0], 2) + Math.pow(pos[1]-targetPos[1], 2) + Math.pow(pos[2]-targetPos[2], 2));
      
      const radiusKm = [2439, 6051, 6371, 3389, 69911, 58232, 25362, 24622][planetsData.findIndex(p => p.name === targetPlanetName)] || 6000;
      const sphereOfInfluence = radiusKm * 1000 * 20; // 20 radii SOI roughly
      
      // Stop integration if we collided OR if we entered SOI and are now escaping it (periapsis passed)
      if (dist < radiusKm * 1000 * 3) {
        arrivalTime = t;
        break; // Crash!
      } else if (dist < sphereOfInfluence && dist > prevDist) {
         // We reached minimum distance to the target and are now flying away. Stop showing the escape.
         arrivalTime = t;
         break;
      }
      prevDist = dist;
    }
  }
  
  return { points, arrivalTime };
}

