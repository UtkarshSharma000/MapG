export const G = 6.6743015e-11; // m^3 kg^-1 s^-2
export const M_SUN = 1.989e30; // kg
export const MU_SUN = G * M_SUN; // m^3 s^-2

export const AU = 149597870700; // meters

// Orbital elements format
export interface KeplerianElements {
  a: number; // semi-major axis (meters)
  e: number; // eccentricity
  i: number; // inclination (radians)
  Omega: number; // longitude of ascending node (radians)
  w: number; // argument of periapsis (radians)
  M0: number; // mean anomaly at epoch (radians)
  period: number; // seconds
}

export type Vector3 = [number, number, number];
export type StateVector = [...Vector3, ...Vector3]; // [x, y, z, vx, vy, vz]

// Solve Kepler's equation for Eccentric Anomaly (E)
export function solveKepler(M: number, e: number, tol = 1e-6): number {
  let E = M;
  let delta = 1;
  let maxIter = 100;
  while (Math.abs(delta) > tol && maxIter > 0) {
    delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= delta;
    maxIter--;
  }
  return E;
}

export function propagateOrbit(
  elements: KeplerianElements,
  timeSinceEpoch: number,
): Vector3 {
  const { a, e, i, Omega, w, M0, period } = elements;

  // Mean motion
  const n = (2 * Math.PI) / period;

  // Mean anomaly at time t
  let M = M0 + n * timeSinceEpoch;
  M = M % (2 * Math.PI);

  // Eccentric anomaly
  const E = solveKepler(M, e);

  // True anomaly
  const nu =
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2),
    );

  // Distance to central body
  const r = a * (1 - e * Math.cos(E));

  // Position in orbital plane
  const xOrbit = r * Math.cos(nu);
  const yOrbit = r * Math.sin(nu);

  // Transform to 3D space (heliocentric ecliptic)
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cO = Math.cos(Omega);
  const sO = Math.sin(Omega);
  const ci = Math.cos(i);
  const si = Math.sin(i);

  const x =
    xOrbit * (cw * cO - sw * ci * sO) - yOrbit * (sw * cO + cw * ci * sO);
  const y =
    xOrbit * (cw * sO + sw * ci * cO) - yOrbit * (sw * sO - cw * ci * cO);
  const z = xOrbit * (sw * si) + yOrbit * (cw * si);

  return [x, y, z];
}
