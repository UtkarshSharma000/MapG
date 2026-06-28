import { FlightState } from "../simulation/FlightState";
import { Spacecraft } from "../spacecraft/Spacecraft";

export interface AeroForces {
  drag: number;
  lift: number;
  torque: number;
  dynamicPressure: number;
  heating: number;
}

export class AeroSolver {
  static solve(state: FlightState, spacecraft: Spacecraft): AeroForces {
    const rho = this.getAirDensity(state.altitude);
    const vMag = Math.sqrt(state.velocity.x**2 + state.velocity.y**2 + state.velocity.z**2);
    const q = 0.5 * rho * vMag * vMag;

    let totalDragArea = 0;
    let totalLift = 0;

    spacecraft.components.forEach(comp => {
      totalDragArea += comp.getDragArea();
      totalLift += comp.getLift();
    });

    // Approximate Mach
    const temp = Math.max(288.15 - 0.0065 * state.altitude, 150);
    const a = Math.sqrt(1.4 * 287.05 * temp);
    const mach = vMag / a;

    // Supersonic wave drag approximation
    const machDragMultiplier = mach > 0.8 ? (mach < 1.2 ? 2.5 : 1.5) : 1.0;
    
    return {
      drag: q * totalDragArea * machDragMultiplier,
      lift: q * totalLift,
      torque: 0, // Simplified
      dynamicPressure: q,
      heating: q * vMag * 0.001 // Simplified heating correlation
    };
  }

  static getAirDensity(altitude: number): number {
    if (altitude > 100000) return 0;
    const P0 = 101325;
    const T0 = 288.15;
    const L = 0.0065;
    const R = 8.31446;
    const M = 0.0289652;
    const G = 9.81;

    const temp = Math.max(T0 - L * altitude, 150);
    const pressure = P0 * Math.pow(1 - (L * altitude) / T0, (G * M) / (R * L));
    return Math.max(0, pressure / (287.05 * temp));
  }
}
