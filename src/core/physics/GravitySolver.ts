import { FlightState } from "../simulation/FlightState";
import { Vector3 } from "../spacecraft/Component";

export class GravitySolver {
  static solve(state: FlightState): Vector3 {
    const G = 6.6743e-11;
    const M_EARTH = 5.972e24;
    const EARTH_RADIUS = 6371000;

    const r = EARTH_RADIUS + state.altitude;
    const g = (G * M_EARTH) / (r * r);
    
    // Assume y is up
    return { x: 0, y: -g, z: 0 };
  }
}
