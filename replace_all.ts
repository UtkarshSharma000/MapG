import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) { 
      walkDir(dirPath, callback);
    } else {
      if(dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) {
        callback(dirPath);
      }
    }
  });
}

const runReplace = () => {
  walkDir('./src/', (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');
    let orig = content;
    
    // Glassmorphism removals and colors
    content = content.replace(/glass-panel/g, 'solid-panel');
    content = content.replace(/glossy-panel/g, 'solid-panel');
    content = content.replace(/glossy-button/g, 'solid-panel');

    // Generic wording
    content = content.replace(/SYSTEMS NOMINAL \/\/ ORBITAL SECTOR 7/g, 'SYSTEMS ONLINE');
    content = content.replace(/Pioneering the Next Frontier of Satellite Logistics and Orbital Infrastructure./g, 'Explore Space & Visit Planets.');
    content = content.replace(/Building the future of orbital optimization together/g, 'Building the future of space exploration together');
    content = content.replace(/leveraging lunar orbital speeds to accelerate outer missions/g, 'leveraging moon speeds to speed up space missions');
    
    content = content.replace(/LAUNCH TERMINAL/g, 'START APP');
    
    // Backgrounds for standard div styling
    content = content.replace(/bg-black\/80/g, 'bg-white');
    content = content.replace(/bg-black\/40/g, 'bg-gray-100');
    content = content.replace(/bg-black\/60/g, 'bg-gray-50');
    content = content.replace(/bg-white\/5/g, 'bg-gray-50');
    content = content.replace(/bg-white\/10/g, 'bg-gray-100');

    // Color fixes 
    content = content.replace(/text-white\/40/g, 'text-gray-500');
    content = content.replace(/text-white\/30/g, 'text-gray-400');
    content = content.replace(/text-white\/20/g, 'text-gray-300');
    content = content.replace(/text-white\/50/g, 'text-gray-500');
    content = content.replace(/text-white\/60/g, 'text-gray-600');
    content = content.replace(/text-white\/70/g, 'text-gray-700');
    content = content.replace(/text-white\/80/g, 'text-gray-800');
    content = content.replace(/border-white\/10/g, 'border-gray-200');
    content = content.replace(/border-white\/20/g, 'border-gray-200');
    content = content.replace(/border-white\/5/g, 'border-gray-100');

    // Reverting "black" text to "white" for now on landing since text colors are tricky without reading context, 
    // actually user said light mode the entire app, let me replace text-white with text-gray-900 globally.
    content = content.replace(/text-white/g, 'text-gray-900');

    if (orig !== content) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  });
}

runReplace();
