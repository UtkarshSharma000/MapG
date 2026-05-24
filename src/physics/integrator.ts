import { Vector3, KeplerianElements } from "./types";
import { propagateOrbit, getOrbitalVelocity } from "./propagation";
import { solveLambert } from "./lambert";
import { G, M_SUN, MU_SUN, PLANET_MASSES } from "./constants";

export function simulateInterplanetaryRK4(
  startPos: Vector3,
  startVel: Vector3,
  startTime: number,
  planetsData: { name: string, elements: KeplerianElements }[],
  duration: number,
  dt: number,
  targetPlanetName: string,
  twoBodyOnly: boolean = false,
  initialDeltaV: number = 3500.0
): { points: Vector3[], arrivalTime: number, success: boolean, missionStatus?: string, captureAltitude?: number, orbitPeriod?: number, isOvershot?: boolean, remainingDeltaV?: number, usedDuration?: number } {
  let pos = [...startPos] as Vector3;
  let vel = [...startVel] as Vector3;
  let t = startTime;

  // 1. Limit departure speed relative to launch planet (Earth) to 100.0 km/s (100000 m/s)
  const earthPlanet = planetsData.find(p => p.name === "Earth") || planetsData[2];
  const startVelBase = getOrbitalVelocity(earthPlanet.elements, startTime);
  const dVx = vel[0] - startVelBase[0];
  const dVy = vel[1] - startVelBase[1];
  const dVz = vel[2] - startVelBase[2];
  const actualDvLaunch = Math.sqrt(dVx*dVx + dVy*dVy + dVz*dVz);
  const MAX_LAUNCH_DV = 100000.0; // 100 km/s to support deep spacecraft velocity vectors safely
  if (actualDvLaunch > MAX_LAUNCH_DV) {
    const scale = MAX_LAUNCH_DV / actualDvLaunch;
    vel[0] = startVelBase[0] + dVx * scale;
    vel[1] = startVelBase[1] + dVy * scale;
    vel[2] = startVelBase[2] + dVz * scale;
  }

  const points: Vector3[] = [[...pos]];
  const targetPlanet = planetsData.find(p => p.name === targetPlanetName);
  const targetIndex = planetsData.findIndex(p => p.name === targetPlanetName);

  const planetRadiiKm = [2439, 6051, 6371, 3389, 69911, 58232, 25362, 24622];
  const radius = (planetRadiiKm[targetIndex] || 6000) * 1000;

  // Standard Laplace Sphere of Influence (SOI) formula: r_SOI = a * (m_planet / m_sun)^(2/5)
  const getPlanetSOI = (name: string, a: number, rad: number): number => {
    const mass = PLANET_MASSES[name];
    if (!mass) return rad * 150;
    return a * Math.pow(mass / M_SUN, 0.4);
  };

  // Dynamic simulation duration adjustment based on distance to cover and starting velocity
  let adjustedDuration = duration;
  if (targetPlanet) {
    const startR = Math.sqrt(startPos[0]*startPos[0] + startPos[1]*startPos[1] + startPos[2]*startPos[2]);
    const targetR = targetPlanet.elements.a;
    const startVHelper = Math.sqrt(vel[0]*vel[0] + vel[1]*vel[1] + vel[2]*vel[2]);
    // Spacecraft slows down as it climbs the gravity well; factor 0.65 represents a healthy average velocity
    const avgSpeed = Math.max(10000, startVHelper * 0.65);
    const distToCover = Math.abs(targetR - startR);
    const estTOF = distToCover / avgSpeed;
    // Let's make sure the integration runs long enough (with a 80% safety margin) to reach capture
    if (estTOF * 1.8 > adjustedDuration) {
      adjustedDuration = estTOF * 1.8;
    }
  }
  
  const launchPlanet = planetsData.find(p => {
    const ppos = propagateOrbit(p.elements, startTime, MU_SUN);
    const d2 = Math.pow(ppos[0]-startPos[0],2) + Math.pow(ppos[1]-startPos[1],2) + Math.pow(ppos[2]-startPos[2],2);
    const dist = Math.sqrt(d2);
    const pIdx = planetsData.findIndex(pd => pd.name === p.name);
    const pRadius = (planetRadiiKm[pIdx === -1 ? 2 : pIdx] || 6000) * 1000;
    const pSoi = getPlanetSOI(p.name, p.elements.a, pRadius);
    return dist < pSoi * 1.5; // Within 1.5 times the actual SOI of that planet at launch
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
      // For a non-inertial Sun-centered frame, we must subtract the acceleration 
      // of the Sun caused by the planets (the indirect term)
      let asx = 0, asy = 0, asz = 0;

      for (const data of activePerturbers) {
        if (data.name === launchPlanet?.name) continue; 
        const mass = PLANET_MASSES[data.name];
        if (!mass) continue;
        const [px, py, pz] = propagateOrbit(data.elements, time, MU_SUN);
        
        // Direct term: Planet's effect on spacecraft
        const dx = px - p[0];
        const dy = py - p[1];
        const dz = pz - p[2];
        const dist2 = dx*dx + dy*dy + dz*dz;
        const softDist2 = Math.max(dist2, 1e13); 
        const p_r3 = (G * mass) / (softDist2 * Math.sqrt(softDist2));
        ax += p_r3 * dx;
        ay += p_r3 * dy;
        az += p_r3 * dz;

        // Indirect term: Planet's effect on the Sun (moving the frame)
        const dsun2 = px*px + py*py + pz*pz;
        if (dsun2 > 1e18) {
          const s_r3 = (G * mass) / (dsun2 * Math.sqrt(dsun2));
          asx += s_r3 * px;
          asy += s_r3 * py;
          asz += s_r3 * pz;
        }
      }
      ax -= asx;
      ay -= asy;
      az -= asz;
    }
    
    return {dp: [v[0], v[1], v[2]], dv: [ax, ay, az]};
  };

  let captured = false;
  let isOvershot = false;
  let remainingDeltaV = initialDeltaV;
  let missionStatus: string | undefined;
  let captureAltitude: number | undefined;
  let orbitPeriod: number | undefined;

  let success = false;
  let arrivalTime = startTime + adjustedDuration;
  
  const soi = targetPlanet ? getPlanetSOI(targetPlanet.name, targetPlanet.elements.a, radius) : (radius * 150);
  
  const targetOutSteps = 200; // Optimal points for trajectory path
  const outDt = adjustedDuration / targetOutSteps;
  let lastOutTime = startTime;
  const timeLimit = startTime + adjustedDuration;
  let minDistanceToTarget = Infinity;
  let driftSteps = 0;
  let hasBurnedMCC = false;

  while (t < timeLimit + (duration * 0.2)) {
    // Break if we've passed the target and distance is increasing significantly
    if (targetPlanet) {
      const [tx, ty, tz] = propagateOrbit(targetPlanet.elements, t, MU_SUN);
      const dist = Math.sqrt((pos[0]-tx)**2 + (pos[1]-ty)**2 + (pos[2]-tz)**2);
      if (dist < minDistanceToTarget) {
        minDistanceToTarget = dist;
        driftSteps = 0;
      } else if (dist > soi * 3) {
        driftSteps++;
        if (driftSteps > 50) break; 
      }
    }

    // Mid-Course Correction (MCC) at 80% flight to correct N-body drift for long trips
    if (!hasBurnedMCC && !twoBodyOnly && targetPlanet && (t - startTime) / (duration) > 0.8) {
      hasBurnedMCC = true;
      try {
        const arrivalT = startTime + duration;
        const targetPosAtArrival = propagateOrbit(targetPlanet.elements, arrivalT, MU_SUN);
        const vNeeded = solveLambert(pos, targetPosAtArrival, arrivalT - t, MU_SUN);
        // MCC's are usually small, but let's check fuel
        const mccDv = Math.sqrt((vNeeded[0]-vel[0])**2 + (vNeeded[1]-vel[1])**2 + (vNeeded[2]-vel[2])**2);
        if (remainingDeltaV >= mccDv) {
          remainingDeltaV -= mccDv;
          vel = [...vNeeded] as Vector3;
        }
      } catch(e) {}
    }

    // Dynamic timestep
    let currentDt = Math.min(28800, adjustedDuration / 150);
    
    for (const p of activePerturbers) {
      const mass = PLANET_MASSES[p.name];
      if (!mass) continue;
      
      const [tx, ty, tz] = propagateOrbit(p.elements, t, MU_SUN);
      const d2 = (pos[0]-tx)*(pos[0]-tx) + (pos[1]-ty)*(pos[1]-ty) + (pos[2]-tz)*(pos[2]-tz);
      const d = Math.sqrt(d2);
      
      const pIdx = planetsData.findIndex(pd => pd.name === p.name);
      const pRadius = (planetRadiiKm[pIdx === -1 ? 2 : pIdx] || 6000) * 1000;
      const pSoi = getPlanetSOI(p.name, p.elements.a, pRadius);
      
      if (d < pSoi) {
        const factor = d / pSoi;
        let targetDt = Math.max(dt, dt * factor);
        // Clamp dt near target to avoid large jumps
        if (d < pRadius * 10) targetDt = Math.min(targetDt, 60);
        if (targetDt < currentDt) {
          currentDt = targetDt;
        }
      } else if (d < pSoi * 3) {
        const factor = (d - pSoi) / (pSoi * 2);
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
          const r_rel: Vector3 = [pos[0] - tx, pos[1] - ty, pos[2] - tz];
          const relVel: Vector3 = [vel[0] - targetVel[0], vel[1] - targetVel[1], vel[2] - targetVel[2]];
          const relV = Math.sqrt(relVel[0]*relVel[0] + relVel[1]*relVel[1] + relVel[2]*relVel[2]);
          
          // Capture logic: Only perform burn at Periapsis.
          // We know we are at periapsis when radial velocity (r dot v) crosses from negative to positive.
          const radialVelocity = (r_rel[0] * relVel[0] + r_rel[1] * relVel[1] + r_rel[2] * relVel[2]) / d;
          
          if (radialVelocity >= 0) { // Burn now!
            const muTarget = G * (PLANET_MASSES[targetPlanet.name] || 0);
            const energy = 0.5 * relV * relV - muTarget / d;
            
            const h_x = r_rel[1] * relVel[2] - r_rel[2] * relVel[1];
            const h_y = r_rel[2] * relVel[0] - r_rel[0] * relVel[2];
            const h_z = r_rel[0] * relVel[1] - r_rel[1] * relVel[0];
            const h = Math.sqrt(h_x*h_x + h_y*h_y + h_z*h_z);

            let rp = d;
            if (muTarget > 0) {
              if (energy > 1e-5) {
                const a_hyper = muTarget / (2.0 * energy);
                const eccentricity = Math.sqrt(1.0 + (2.0 * energy * h * h) / (muTarget * muTarget));
                rp = a_hyper * (eccentricity - 1.0);
              } else if (energy < -1e-5) {
                const a_ellipse = muTarget / (-2.0 * energy);
                const eccentricity = Math.sqrt(Math.max(0.0, 1.0 + (2.0 * energy * h * h) / (muTarget * muTarget)));
                rp = a_ellipse * (1.0 - eccentricity);
              } else {
                rp = (h * h) / (2.0 * muTarget);
              }
            }
            if (isNaN(rp) || rp <= 0) rp = d;

            if (rp <= radius) {
              captured = false;
              isOvershot = false;
              success = false;
              missionStatus = "IMPACT / ATMOSPHERIC ENTRY";
              captureAltitude = (rp - radius) / 1000;
              orbitPeriod = 0;
            } else {
              const vArrival = Math.sqrt(2.0 * (energy + muTarget / rp));
              const vCapture = Math.sqrt(muTarget / rp);
              const deltaVRequired = vArrival - vCapture;
              const targetPeriodSeconds = 2.0 * Math.PI * Math.sqrt(Math.pow(rp, 3) / muTarget);
              const computedPeriodDays = targetPeriodSeconds / 86400.0;

              if (deltaVRequired <= 0.0) {
                captured = true;
                success = true;
                arrivalTime = t;
                missionStatus = `${targetPlanet.name.toUpperCase()}_ORBIT`;
                captureAltitude = (rp - radius) / 1000;
                orbitPeriod = computedPeriodDays;
              } else if (remainingDeltaV >= deltaVRequired) {
                remainingDeltaV -= deltaVRequired;
                captured = true;
                success = true;
                arrivalTime = t;
                missionStatus = `${targetPlanet.name.toUpperCase()}_ORBIT`;
                captureAltitude = (rp - radius) / 1000;
                orbitPeriod = computedPeriodDays;

                const vHat = [relVel[0]/relV, relVel[1]/relV, relVel[2]/relV];
                vel[0] = targetVel[0] + vHat[0] * vCapture;
                vel[1] = targetVel[1] + vHat[1] * vCapture;
                vel[2] = targetVel[2] + vHat[2] * vCapture;
              } else {
                isOvershot = true;
                captured = false;
                success = false;
                missionStatus = "OVERSHOT - INSUFFICIENT FUEL";
              }
            }
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
