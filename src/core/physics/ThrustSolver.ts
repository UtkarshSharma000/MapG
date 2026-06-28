import { Spacecraft } from "../spacecraft/Spacecraft";
import { Vector3 } from "../spacecraft/Component";

export class ThrustSolver {
  static getTotalThrust(spacecraft: Spacecraft, currentStage: number, throttle: number = 1.0): number {
    let thrust = 0;
    
    // Simplification: assume components in current stage or earlier are active if they are engines
    // In a real system, you'd track active engines specifically.
    spacecraft.components.forEach(comp => {
      if (comp.props.type.includes('engine')) {
        // Assume active if not detached
        thrust += comp.getThrust() * throttle;
      }
    });

    return thrust;
  }
}
