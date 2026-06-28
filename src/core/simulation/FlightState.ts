import { Vector3 } from "../spacecraft/Component";

export interface FlightState {
  time: number;
  altitude: number;
  velocity: Vector3;
  position: Vector3; // World position
  rotation: Vector3; // Spacecraft orientation
  
  angularVelocity: Vector3;
  acceleration: Vector3;
  
  mass: number;
  dynamicPressure: number;
  mach: number;
  temperature: number;
  
  currentStage: number;
  
  // Accumulated DeltaV, gravity losses, etc.
  deltaVExpended: number;
  gravityLosses: number;
  dragLosses: number;
}
