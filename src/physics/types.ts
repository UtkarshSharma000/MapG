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
