// Solve Kepler's equation for Eccentric Anomaly (E)
export function solveKepler(M: number, e: number, tol = 1e-6): number {
  // Initial guess based on eccentricity
  let E = e > 0.8 ? Math.PI : M;
  
  let delta = 1;
  let maxIter = 100;
  while (Math.abs(delta) > tol && maxIter > 0) {
    delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= delta;
    maxIter--;
  }
  return E;
}
