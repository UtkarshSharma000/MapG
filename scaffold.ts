import fs from 'fs';
import path from 'path';

const files = [
  'src/core/spacecraft/Spacecraft.ts',
  'src/core/spacecraft/Component.ts',
  'src/core/spacecraft/Connection.ts',
  'src/core/spacecraft/Stage.ts',
  'src/core/spacecraft/Assembly.ts',
  
  'src/core/physics/MassSolver.ts',
  'src/core/physics/ThrustSolver.ts',
  'src/core/physics/FuelSolver.ts',
  'src/core/physics/AeroSolver.ts',
  'src/core/physics/StructuralSolver.ts',
  'src/core/physics/ThermalSolver.ts',
  'src/core/physics/GravitySolver.ts',
  
  'src/core/simulation/Simulation.ts',
  'src/core/simulation/FlightState.ts',
  'src/core/simulation/MissionState.ts',
  
  'src/core/builder/Builder.ts',
  'src/core/builder/BuilderUI.ts',
  
  'src/core/validation/Validator.ts',
  'src/core/validation/Report.ts',
  
  'src/core/launch/LaunchSequence.ts',
  'src/core/launch/StageEvents.ts',
  
  'src/core/render/Scene.ts',
  'src/core/render/Cameras.ts',
  'src/core/render/PartRenderer.ts',
  
  'src/core/telemetry/Telemetry.ts',
];

for (const file of files) {
  const fullPath = path.join(process.cwd(), file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, '// Initial Scaffold\n');
}

console.log('Scaffolding complete.');
