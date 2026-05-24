
export interface StateVector {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  time: number;
}

export interface LambertRequest {
  r1: [number, number, number];
  r2: [number, number, number];
  tof: number;
  mu: number;
  prograde: boolean;
  max_revs: number;
}

export interface LambertResponse {
  v1: [number, number, number];
  v2: [number, number, number];
  a: number;
  revs: number;
}

export interface PropagationRequest {
  initialState: StateVector;
  startEpoch: number; // TDB seconds
  maxDuration: number;
}

export interface PropagationResponse {
  timeHistory: number[];
  stateHistory: StateVector[];
  terminationReason: string;
}
