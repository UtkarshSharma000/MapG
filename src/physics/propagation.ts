import { KeplerianElements, Vector3 } from "./types";
import { solveKepler } from "./kepler";

export function propagateOrbit(
  elements: KeplerianElements,
  timeSinceEpoch: number,
  mu: number
): Vector3 {
  const { a, e, i, Omega, w, M0 } = elements;

  const n = Math.sqrt(mu / Math.pow(a, 3));
  let M = M0 + n * timeSinceEpoch;
  const TWO_PI = 2 * Math.PI;
  M = ((M % TWO_PI) + TWO_PI) % TWO_PI;

  const E = solveKepler(M, e);
  const nu =
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2),
    );

  const r = a * (1 - e * Math.cos(E));

  const xOrbit = r * Math.cos(nu);
  const yOrbit = r * Math.sin(nu);

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

export function getOrbitalVelocity(elements: KeplerianElements, timeSinceEpoch: number, mu: number): Vector3 {
  const { a, e, i, Omega, w, M0 } = elements;

  const n = Math.sqrt(mu / Math.pow(a, 3));
  let M = M0 + n * timeSinceEpoch;
  const TWO_PI = 2 * Math.PI;
  M = ((M % TWO_PI) + TWO_PI) % TWO_PI;

  const E = solveKepler(M, e);
  const r = a * (1 - e * Math.cos(E));

  const vxOrbit = -(a * a * n * Math.sin(E)) / r;
  const vyOrbit = (a * a * n * Math.sqrt(Math.max(0, 1 - e * e)) * Math.cos(E)) / r;

  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cO = Math.cos(Omega);
  const sO = Math.sin(Omega);
  const ci = Math.cos(i);
  const si = Math.sin(i);

  const vx =
    vxOrbit * (cw * cO - sw * ci * sO) - vyOrbit * (sw * cO + cw * ci * sO);
  const vy =
    vxOrbit * (cw * sO + sw * ci * cO) - vyOrbit * (sw * sO - cw * ci * cO);
  const vz = vxOrbit * (sw * si) + vyOrbit * (cw * si);

  return [vx, vy, vz];
}
