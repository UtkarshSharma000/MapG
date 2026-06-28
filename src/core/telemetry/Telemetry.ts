import { FlightState } from "../simulation/FlightState";

export class Telemetry {
  static getReport(state: FlightState) {
    return {
      time: state.time,
      altitude: state.altitude,
      velocity: Math.sqrt(state.velocity.x**2 + state.velocity.y**2 + state.velocity.z**2),
      acceleration: Math.sqrt(state.acceleration.x**2 + state.acceleration.y**2 + state.acceleration.z**2) / 9.81,
      mass: state.mass,
      mach: state.mach,
      dynamicPressure: state.dynamicPressure,
      pitch: state.rotation.x * (180 / Math.PI),
      stage: state.currentStage
    };
  }
}
