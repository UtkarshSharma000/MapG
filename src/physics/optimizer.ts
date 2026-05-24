import { KeplerianElements, Vector3 } from "./types";
import { propagateOrbit, getOrbitalVelocity } from "./propagation";
import { solveLambert } from "./lambert";
import { AU, MU_SUN } from "./constants";

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
): { tof: number, vReq: Vector3, dvReq: number, depTime: number } {
  let minDV = Infinity;
  let bestCandidates: { tof: number, vReq: Vector3, dvReq: number, depTime: number }[] = [];

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

  // Calculate Synodic Period to determine departure search window size
  // Mars ~780 days, Venus ~584 days, Outer planets ~1 year
  const T1 = earthElements.period / 86400; // days
  const T2 = targetElements.period / 86400; // days
  const synodicPeriod = Math.abs(1 / (1 / T1 - 1 / T2));
  
  // Search window for departure: reduced to ±3 synodic months or ±180 days max
  const searchRange = Math.min(Math.max(180, synodicPeriod * 0.5), 365); 
  const depStep = 30; // 30-day granularity for coarse pass (was 15)
  
  const depOffsets: number[] = [];
  for (let d = -Math.floor(searchRange / 2); d <= Math.floor(searchRange / 2); d += depStep) {
    depOffsets.push(d);
  }
  
  for (const depOffset of depOffsets) {
    const depTime = currentTime + depOffset * 86400;
    const startPos = propagateOrbit(earthElements, depTime, MU_SUN);
    const startVelBase = getOrbitalVelocity(earthElements, depTime, MU_SUN);

    // Pass 1: Coarse search
    const coarseStep = maxDays > 5000 ? 50 : (maxDays > 2000 ? 25 : 10);
    for (let d = minDays; d <= maxDays; d += coarseStep) {
      const tofSeconds = d * 24 * 3600;
      const targetPosFuture = propagateOrbit(targetElements, depTime + tofSeconds, MU_SUN);

      try {
        const vLambert = solveLambert(startPos, targetPosFuture, tofSeconds, mu);
        const dv = Math.sqrt(
          Math.pow(vLambert[0] - startVelBase[0], 2) +
          Math.pow(vLambert[1] - startVelBase[1], 2) +
          Math.pow(vLambert[2] - startVelBase[2], 2)
        );

        if (dv < minDV || bestCandidates.length < 1) {
          if (dv < minDV) minDV = dv;
          bestCandidates.push({ tof: tofSeconds, vReq: vLambert, dvReq: dv, depTime });
          // Only keep the local best candidate per departure to keep searches fast
          bestCandidates.sort((a, b) => a.dvReq - b.dvReq);
          if (bestCandidates.length > 2) bestCandidates.pop();
        }
      } catch (e) {}
    }
  }

  // Pass 2: Refined search around limited set of candidates
  let absoluteBest = bestCandidates[0] || { tof: 0, vReq: [0,0,0], dvReq: Infinity, depTime: currentTime };
  
  for (const cand of bestCandidates) {
    const startPos = propagateOrbit(earthElements, cand.depTime, MU_SUN);
    const startVelBase = getOrbitalVelocity(earthElements, cand.depTime, MU_SUN);
    const centralDay = cand.tof / 86400;
    const searchWing = maxDays > 5000 ? 50 : 15;
    const stepRefined = Math.max(1.0, searchWing / 15);
    
    for (let d = centralDay - searchWing; d <= centralDay + searchWing; d += stepRefined) {
      const tofSeconds = d * 24 * 3600;
      const targetPosFuture = propagateOrbit(targetElements, cand.depTime + tofSeconds, MU_SUN);
      try {
        const vLambert = solveLambert(startPos, targetPosFuture, tofSeconds, mu);
        const dv = Math.sqrt(
          Math.pow(vLambert[0] - startVelBase[0], 2) +
          Math.pow(vLambert[1] - startVelBase[1], 2) +
          Math.pow(vLambert[2] - startVelBase[2], 2)
        );
        if (dv < absoluteBest.dvReq) {
          absoluteBest = { tof: tofSeconds, vReq: vLambert, dvReq: dv, depTime: cand.depTime };
        }
      } catch (e) {}
    }
  }

  // Pass 3: Ultra-fine polish
  if (absoluteBest.tof > 0) {
    const startPos = propagateOrbit(earthElements, absoluteBest.depTime, MU_SUN);
    const startVelBase = getOrbitalVelocity(earthElements, absoluteBest.depTime, MU_SUN);
    const refinedDay = absoluteBest.tof / 86400;
    for (let d = refinedDay - 1.5; d <= refinedDay + 1.5; d += 0.1) {
      const tofSeconds = d * 24 * 3600;
      const targetPosFuture = propagateOrbit(targetElements, absoluteBest.depTime + tofSeconds, MU_SUN);
      try {
        const vLambert = solveLambert(startPos, targetPosFuture, tofSeconds, mu);
        const dv = Math.sqrt(
          Math.pow(vLambert[0] - startVelBase[0], 2) +
          Math.pow(vLambert[1] - startVelBase[1], 2) +
          Math.pow(vLambert[2] - startVelBase[2], 2)
        );
        if (dv < absoluteBest.dvReq) {
          absoluteBest = { tof: tofSeconds, vReq: vLambert, dvReq: dv, depTime: absoluteBest.depTime };
        }
      } catch (e) {}
    }
  }

  return absoluteBest;
}
