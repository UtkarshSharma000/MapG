import fs from 'fs';

function refactorFile(path) {
  let content = fs.readFileSync(path, 'utf8');

  // Simple wordings
  content = content.replace(/MISSION ARCHIVE/g, 'HISTORY');
  content = content.replace(/Mission Archive/g, 'History');
  content = content.replace(/PROJECT GRENINJA/g, 'SPACE EXPLORER');
  content = content.replace(/Project Greninja/g, 'Space Explorer');
  content = content.replace(/TRAJECTORY/g, 'FLIGHT PATH');
  content = content.replace(/TELEMETRY PANEL/g, 'STATS PANEL');
  content = content.replace(/CRAFT IDENTIFIER/g, 'SPACECRAFT');
  
  // Tailwind color & glassmorphism replacements to light mode
  content = content.replace(/text-white\/40/g, 'text-gray-500');
  content = content.replace(/text-white\/30/g, 'text-gray-400');
  content = content.replace(/text-white\/20/g, 'text-gray-300');
  content = content.replace(/text-white\/50/g, 'text-gray-500');
  content = content.replace(/text-white\/60/g, 'text-gray-600');
  content = content.replace(/text-white\/70/g, 'text-gray-700');
  content = content.replace(/text-white\/80/g, 'text-gray-800');
  content = content.replace(/text-white/g, 'text-gray-900');
  content = content.replace(/border-white\/10/g, 'border-gray-200');
  content = content.replace(/border-white\/20/g, 'border-gray-200');
  content = content.replace(/border-white\/5/g, 'border-gray-100');
  content = content.replace(/bg-black\/80/g, 'bg-white');
  content = content.replace(/bg-black\/40/g, 'bg-gray-100');
  content = content.replace(/bg-black\/60/g, 'bg-gray-50');
  content = content.replace(/bg-white\/5/g, 'bg-gray-50');
  content = content.replace(/bg-white\/10/g, 'bg-gray-100');
  content = content.replace(/bg-\[\#1d1d1d\]\/40/g, 'bg-gray-50');
  content = content.replace(/text-secondary/g, 'text-blue-600');
  content = content.replace(/text-primary/g, 'text-blue-700');
  
  content = content.replace(/glass-panel/g, 'solid-panel');
  content = content.replace(/glossy-panel/g, 'solid-panel');
  content = content.replace(/glossy-button/g, 'solid-panel');

  fs.writeFileSync(path, content, 'utf8');
  console.log('Refactored', path);
}

refactorFile('./src/App.tsx');
refactorFile('./src/OrbitSimulator.tsx');
refactorFile('./src/components/Planet2DMap.tsx');

