import { Spacecraft } from "../spacecraft/Spacecraft";
import { MassSolver } from "../physics/MassSolver";
import { Report } from "./Report";

export class Validator {
  static validate(spacecraft: Spacecraft): Report {
    const report = new Report();

    const mass = MassSolver.getTotalMass(spacecraft);
    if (mass === 0) {
      report.addError("Spacecraft has no mass.");
    }

    let totalThrust = 0;
    let engineCount = 0;
    let rootConnected = false;

    spacecraft.components.forEach(comp => {
      totalThrust += comp.getThrust();
      if (comp.props.type === 'engine' || comp.props.type.includes('engine')) engineCount++;
      if (comp.parent === null) rootConnected = true; // Checking if there's a root
    });

    if (engineCount === 0) {
      report.addError("Spacecraft has no engines.");
    }

    const twr = totalThrust / (mass * 9.81);
    if (twr < 1.0 && engineCount > 0) {
      report.addWarning(`Thrust-to-Weight Ratio is less than 1.0 (${twr.toFixed(2)}). Spacecraft cannot lift off.`);
    }

    // Checking aerodynamic stability (simplified)
    report.addInfo(`Total Mass: ${mass.toFixed(1)} kg`);
    report.addInfo(`Total Thrust: ${totalThrust.toFixed(1)} N`);
    report.addInfo(`Liftoff TWR: ${twr.toFixed(2)}`);

    report.isValid = report.errors.length === 0;

    return report;
  }
}
