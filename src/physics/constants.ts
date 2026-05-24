export const G = 6.6743015e-11; // m^3 kg^-1 s^-2
export const M_SUN = 1.989e30; // kg
export const MU_SUN = G * M_SUN; // m^3 s^-2

export const AU = 149597870700; // meters

export const J2000_UNIX = 946728000; // Seconds since Unix epoch to J2000

export function getJ2000Time(unixTimeSeconds: number): number {
  return unixTimeSeconds - J2000_UNIX;
}

export const PLANET_MASSES: Record<string, number> = {
  Mercury: 3.3011e23,
  Venus: 4.8675e24,
  Earth: 5.97216e24,
  Mars: 6.4171e23,
  Jupiter: 1.8982e27,
  Saturn: 5.6834e26,
  Uranus: 8.6810e25,
  Neptune: 1.02413e26,
  // Moons
  Moon: 7.34767e22,
  Phobos: 1.0659e16,
  Deimos: 1.4762e15,
  Io: 8.9319e22,
  Europa: 4.800e22,
  Ganymede: 1.4819e23,
  Callisto: 1.0759e23,
  Titan: 1.3452e23,
  Triton: 2.14e22,
};
