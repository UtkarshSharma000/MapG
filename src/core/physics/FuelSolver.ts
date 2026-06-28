import { Spacecraft } from "../spacecraft/Spacecraft";

export class FuelSolver {
  static consumeFuel(spacecraft: Spacecraft, dt: number, thrust: number) {
    if (thrust <= 0) return;
    
    let totalFuel = 0;
    spacecraft.components.forEach(comp => {
      totalFuel += comp.getFuel();
    });

    if (totalFuel <= 0) return;

    // Approximated specific impulse 300s
    const flowRate = thrust / (300 * 9.81); 
    let consumed = flowRate * dt;

    // Distribute consumption (simplified)
    spacecraft.components.forEach(comp => {
      if (comp.props.fuel && comp.props.fuel > 0) {
        if (consumed > 0) {
          const amount = Math.min(comp.props.fuel, consumed);
          comp.props.fuel -= amount;
          consumed -= amount;
        }
      }
    });
  }
}
