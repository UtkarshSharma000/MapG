import { Vector3 } from "./types";

function C(z: number): number {
  if (z > 1e-6) return (1 - Math.cos(Math.sqrt(z))) / z;
  if (z < -1e-6) return (Math.cosh(Math.sqrt(-z)) - 1) / (-z);
  return 1/2 - z/24 + (z*z)/720;
}

function S(z: number): number {
  if (z > 1e-6) return (Math.sqrt(z) - Math.sin(Math.sqrt(z))) / Math.pow(Math.sqrt(z), 3);
  if (z < -1e-6) return (Math.sinh(Math.sqrt(-z)) - Math.sqrt(-z)) / Math.pow(Math.sqrt(-z), 3);
  return 1/6 - z/120 + (z*z)/5040;
}

export function solveLambert(
  r1: Vector3,
  r2: Vector3,
  tof: number,
  mu: number,
  prograde = true
): Vector3 {
  const norm1 = Math.sqrt(r1[0] * r1[0] + r1[1] * r1[1] + r1[2] * r1[2]);
  const norm2 = Math.sqrt(r2[0] * r2[0] + r2[1] * r2[1] + r2[2] * r2[2]);
  
  const cosDnu = (r1[0] * r2[0] + r1[1] * r2[1] + r1[2] * r2[2]) / (norm1 * norm2);
  const cr = [
    r1[1] * r2[2] - r1[2] * r2[1],
    r1[2] * r2[0] - r1[0] * r2[2],
    r1[0] * r2[1] - r1[1] * r2[0],
  ];
  let dnu = Math.acos(Math.max(-1, Math.min(1, cosDnu)));
  
  // Decide which way to go
  if (prograde) {
    if (cr[2] < 0) dnu = 2 * Math.PI - dnu;
  } else {
    if (cr[2] >= 0) dnu = 2 * Math.PI - dnu;
  }
  
  const A = Math.sin(dnu) * Math.sqrt((norm1 * norm2) / (1 - Math.cos(dnu)));
  
  // Robust bisection
  let zLow = -4 * Math.PI * Math.PI; 
  let zHigh = 4 * Math.PI * Math.PI;
  let z = 0;
  
  let y = 0;
  const tol = 1e-4; // Better precision
  // TODO: Implement Izzo algorithm or better Lambert solver for improved stability
  for (let iter = 0; iter < 100; iter++) {
    const cVal = C(z);
    const sVal = S(z);
    
    // Safety check for cVal near 0
    if (cVal < 1e-12) {
      zLow = z;
      z = (z + zHigh) / 2;
      continue;
    }
    
    const denom = Math.sqrt(cVal);
    y = norm1 + norm2 + A * (z * sVal - 1) / denom;
    
    if (A > 0 && y < 0) {
      zLow = z;
      z = (z + zHigh) / 2;
      continue;
    }
    
    const x = Math.sqrt(y / cVal);
    const tCalc = (Math.pow(x, 3) * sVal + A * Math.sqrt(y)) / Math.sqrt(mu);
    
    // Use dynamic relative tolerance to converge robustly across all planetary distances
    if (Math.abs(tCalc - tof) < Math.max(0.01, 1e-7 * tof)) {
      break;
    }
    
    if (tCalc < tof) {
      zLow = z;
    } else {
      zHigh = z;
    }
    z = (zHigh + zLow) / 2;
    if (Math.abs(zHigh - zLow) < tol) break;
  }
  
  const f = 1 - y / norm1;
  const g = A * Math.sqrt(y / mu);
  const gDot = 1 - y / norm2;
  
  return [
    (r2[0] - f * r1[0]) / g,
    (r2[1] - f * r1[1]) / g,
    (r2[2] - f * r1[2]) / g,
  ];
}
