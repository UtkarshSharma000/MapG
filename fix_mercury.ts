import fs from 'fs';
const file = 'src/OrbitSimulator.tsx';
const content = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file, content.replace(/\/textures\/2k_mercury.jpg/g, 'textures/2k_mercury.jpg'));
