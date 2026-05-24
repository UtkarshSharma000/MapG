
export interface LaunchParams {
  launchPlanet: string;
  targetPlanet: string;
  v0?: number;
  pitch?: number;
  yaw?: number;
  nbody?: boolean;
  launchLocation?: { lat: number; lon: number };
  targetLocation?: { lat: number; lon: number };
  isLaunched: boolean;
  isAutoWarp?: boolean;
}

export interface MissionLeg {
  destId: number;
  duration: number;
}
