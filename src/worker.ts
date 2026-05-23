import { parentPort, workerData } from "worker_threads";
import { 
  findOptimalTransfer, 
  simulateInterplanetaryRK4, 
  propagateOrbit, 
  getOrbitalVelocity,
  MU_SUN
} from "./physics";
import { PLANETS } from "./constants";

// Note: Using .js extension for imports in ESM if compiled/run in some environments, 
// but tsx handles .ts. I'll use relative paths without extension first or with .js if needed.
// Actually, in this environment tsx is used, so .ts should work, but for safety in ESM I'll try .js if it fails.

if (!parentPort) {
  throw new Error("This file must be run as a worker thread.");
}

const { type, payload } = workerData;

try {
  if (type === "CALCULATE_PATH") {
    const { launchParams, globalTime } = payload;
    const { targetPlanet: targetName, missionLegs, pitch, yaw, v0, launchPlanet: launchPlanetName = "Earth" } = launchParams;

    const earth = PLANETS.find((p) => p.name === launchPlanetName);
    if (!earth) throw new Error("Launch planet not found");

    let simStartTime = globalTime;
    let startPos = propagateOrbit(earth.elements, globalTime);
    let vReq: [number, number, number] = [0, 0, 0];
    let dvLabel = 0;
    let simDuration = 0;

    if (missionLegs && missionLegs.length > 0) {
      // Mission legs logic (simplified for worker handover)
      let totalDays = 0;
      for (const leg of missionLegs) totalDays += leg.tof_days || 0;
      simDuration = Math.max(totalDays * 86400 * 1.5, 86400 * 100);

      const p = (pitch * Math.PI) / 180;
      const y = (yaw * Math.PI) / 180;
      
      const vx_local = v0 * Math.sin(p);
      const vy_local = v0 * Math.cos(p) * Math.cos(y);
      const vz_local = v0 * Math.cos(p) * Math.sin(y);

      const OBLIQUITY = (23.43929111 * Math.PI) / 180;
      const cosE = Math.cos(OBLIQUITY);
      const sinE = Math.sin(OBLIQUITY);

      const v_inf_x = vx_local;
      const v_inf_y = vy_local * cosE + vz_local * sinE;
      const v_inf_z = -vy_local * sinE + vz_local * cosE;

      const earthVel = getOrbitalVelocity(earth.elements, globalTime);
      vReq = [
        earthVel[0] + v_inf_x,
        earthVel[1] + v_inf_y,
        earthVel[2] + v_inf_z,
      ];
      dvLabel = missionLegs.reduce((acc: number, l: any) => acc + (l.dv1_kms || 0), 0);
    } else {
      const target = PLANETS.find((p) => p.name === targetName);
      if (!target) throw new Error("Target planet not found");

      const transferResult = findOptimalTransfer(
        earth.elements,
        target.elements,
        globalTime,
        MU_SUN,
        false
      );
      vReq = transferResult.vReq as [number, number, number];
      simStartTime = transferResult.depTime;
      startPos = propagateOrbit(earth.elements, transferResult.depTime);
      simDuration = transferResult.tof * 1.5;
      dvLabel = transferResult.dvReq;
    }

    // Helper for fuel capacity (same logic as in frontend but here)
    const getFuelCapacity = (targetName?: string, requiredDV?: number): number => {
      let base = 3500.0;
      if (targetName && ["Jupiter", "Saturn", "Uranus", "Neptune"].includes(targetName)) {
        base = 15000.0;
      }
      if (requiredDV && requiredDV > base * 0.8) {
        base = Math.ceil((requiredDV * 1.5) / 1000) * 1000;
      }
      return base;
    };

    const maxDeltaV = getFuelCapacity(targetName, dvLabel);
    const simDt = 600;

    const simResult = simulateInterplanetaryRK4(
      startPos,
      vReq,
      simStartTime,
      PLANETS,
      simDuration,
      simDt,
      targetName || "",
      false,
      maxDeltaV
    );

    parentPort.postMessage({
      success: true,
      data: {
        points: simResult.points,
        arrivalTime: simResult.arrivalTime,
        missionStatus: simResult.missionStatus,
        captureAltitude: simResult.captureAltitude,
        orbitPeriod: simResult.orbitPeriod,
        isOvershot: simResult.isOvershot,
        remainingDeltaV: simResult.remainingDeltaV,
        usedDuration: simResult.usedDuration,
        simStartTime,
        vReq,
        dvLabel
      }
    });
  }
} catch (error: any) {
  parentPort.postMessage({
    success: false,
    error: error.message
  });
}
