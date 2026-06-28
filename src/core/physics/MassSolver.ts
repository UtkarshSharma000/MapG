import { Spacecraft } from "../spacecraft/Spacecraft";
import { Vector3 } from "../spacecraft/Component";

export class MassSolver {
  static getTotalMass(spacecraft: Spacecraft): number {
    let mass = 0;
    spacecraft.components.forEach(comp => {
      mass += comp.getMass();
    });
    return mass;
  }

  static getCenterOfMass(spacecraft: Spacecraft): Vector3 {
    let totalMass = 0;
    let sumX = 0, sumY = 0, sumZ = 0;

    spacecraft.components.forEach(comp => {
      const m = comp.getMass();
      totalMass += m;
      sumX += comp.transform.position.x * m;
      sumY += comp.transform.position.y * m;
      sumZ += comp.transform.position.z * m;
    });

    if (totalMass === 0) return { x: 0, y: 0, z: 0 };
    return { x: sumX / totalMass, y: sumY / totalMass, z: sumZ / totalMass };
  }
}
