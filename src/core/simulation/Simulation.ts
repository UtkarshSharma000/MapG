import { FlightState } from "./FlightState";
import { Spacecraft } from "../spacecraft/Spacecraft";
import { AeroSolver } from "../physics/AeroSolver";
import { MassSolver } from "../physics/MassSolver";
import { ThrustSolver } from "../physics/ThrustSolver";
import { GravitySolver } from "../physics/GravitySolver";
import { FuelSolver } from "../physics/FuelSolver";

export class Simulation {
  state: FlightState;
  spacecraft: Spacecraft;
  ignition: boolean = false;
  throttle: number = 0;

  constructor(spacecraft: Spacecraft) {
    this.spacecraft = spacecraft;
    this.state = {
      time: 0,
      altitude: 0,
      velocity: { x: 0, y: 0, z: 0 },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      mass: MassSolver.getTotalMass(spacecraft),
      dynamicPressure: 0,
      mach: 0,
      temperature: 288.15,
      currentStage: 0,
      deltaVExpended: 0,
      gravityLosses: 0,
      dragLosses: 0
    };
  }

  step(dt: number) {
    if (dt <= 0) return;

    this.state.mass = MassSolver.getTotalMass(this.spacecraft);

    const aero = AeroSolver.solve(this.state, this.spacecraft);
    this.state.dynamicPressure = aero.dynamicPressure;
    this.state.temperature = Math.max(288.15 - 0.0065 * this.state.altitude, 150) + aero.heating;

    let thrust = 0;
    if (this.ignition) {
      thrust = ThrustSolver.getTotalThrust(this.spacecraft, this.state.currentStage, this.throttle);
      FuelSolver.consumeFuel(this.spacecraft, dt, thrust);
    }

    const gravity = GravitySolver.solve(this.state);
    
    // Pitch program calculation (simplified)
    if (this.state.altitude > 500 && this.state.altitude < 100000) {
      this.state.rotation.x = Math.min(Math.PI / 2.1, (this.state.altitude - 500) / 80000 * (Math.PI / 2.1));
    }

    const vMag = Math.sqrt(this.state.velocity.x**2 + this.state.velocity.y**2 + this.state.velocity.z**2);
    
    const dX = vMag > 0 ? (aero.drag * (this.state.velocity.x / vMag)) : 0;
    const dY = vMag > 0 ? (aero.drag * (this.state.velocity.y / vMag)) : 0;

    const tX = thrust * Math.sin(this.state.rotation.x);
    const tY = thrust * Math.cos(this.state.rotation.x);

    let aX = (tX - dX) / this.state.mass;
    let aY = (tY - dY) / this.state.mass + gravity.y;

    if (this.state.altitude <= 0 && aY < 0) {
      aY = 0;
      this.state.velocity.y = 0;
    }

    this.state.acceleration = { x: aX, y: aY, z: 0 };
    
    this.state.velocity.x += aX * dt;
    this.state.velocity.y += aY * dt;
    
    this.state.position.x += this.state.velocity.x * dt;
    this.state.position.y += this.state.velocity.y * dt;

    this.state.altitude = this.state.position.y; // Simplified flat earth up to orbit height
    this.state.time += dt;

    const currentVMag = Math.sqrt(this.state.velocity.x**2 + this.state.velocity.y**2);
    const a = Math.sqrt(1.4 * 287.05 * Math.max(288.15 - 0.0065 * this.state.altitude, 150));
    this.state.mach = currentVMag / a;
  }
}
