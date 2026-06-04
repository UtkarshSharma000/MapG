// ── Trajectory Optimization Web Worker ──

export interface OptimizeResult {
  dv1_kms: number
  dv2_kms: number
  tof_days: number
  launchDay_j2000: number
  v1_ecl: [number, number, number]
}

const PLANETS: Record<number, {
  name: string; a: number; e: number; inc_deg: number;
  raan_deg: number; argp_deg: number; M0_deg: number; T_days: number
}> = {
  1: { name:'Mercury', a:0.387, e:0.2056, inc_deg:7.0,  raan_deg:48.33,  argp_deg:29.124, M0_deg:174.0, T_days:88.0  },
  2: { name:'Venus',   a:0.723, e:0.0067, inc_deg:3.39,  raan_deg:76.68,  argp_deg:54.88,  M0_deg:50.0,  T_days:224.7 },
  3: { name:'Earth',   a:1.0,   e:0.0167, inc_deg:0.00005,raan_deg:-11.26,argp_deg:114.2,  M0_deg:358.0, T_days:365.25 },
  4: { name:'Mars',    a:1.524, e:0.0934, inc_deg:1.85,  raan_deg:49.57,  argp_deg:286.5,  M0_deg:19.0,  T_days:686.98 },
  5: { name:'Jupiter', a:5.204, e:0.0489, inc_deg:1.3,   raan_deg:100.4,  argp_deg:273.8,  M0_deg:20.0,  T_days:4332.59 },
  6: { name:'Saturn',  a:9.582, e:0.0565, inc_deg:2.48,  raan_deg:113.6,  argp_deg:339.3,  M0_deg:317.0, T_days:10759 },
  7: { name:'Uranus',  a:19.201,e:0.0457, inc_deg:0.77,  raan_deg:74.0,   argp_deg:96.6,   M0_deg:142.0, T_days:30688 },
  8: { name:'Neptune', a:30.047,e:0.0113, inc_deg:1.77,  raan_deg:131.7,  argp_deg:273.1,  M0_deg:256.0, T_days:60182 },
}
const PLANET_IDS = [1, 2, 3, 4, 5, 6, 7, 8]

const AU_KM  = 1.495978707e8
const GM_SUN = 1.32712440018e20  // m³/s² (Exact precision alignment)
const DEG    = Math.PI / 180

function solveKepler(M: number, e: number): number {
  let E = M
  for (let i = 0; i < 100; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E))
    E += dE
    if (Math.abs(dE) < 1e-12) break
  }
  return E
}

function planetStateVector(id: number, t_days: number): {
  pos: [number,number,number],
  vel: [number,number,number]
} {
  const p   = PLANETS[id]
  const n   = 360 / p.T_days
  const M   = ((p.M0_deg + n * t_days) % 360) * DEG
  const E   = solveKepler(M, p.e)
  const nu  = 2 * Math.atan2(
    Math.sqrt(1 + p.e) * Math.sin(E / 2),
    Math.sqrt(1 - p.e) * Math.cos(E / 2)
  )
  const r   = p.a * (1 - p.e * Math.cos(E))

  const xp  = r * Math.cos(nu)
  const yp  = r * Math.sin(nu)

  const a_m = p.a * AU_KM * 1000
  const h   = Math.sqrt(GM_SUN * a_m * (1 - p.e ** 2))
  const vxp = -(GM_SUN / h) * Math.sin(nu) / 1000
  const vyp =  (GM_SUN / h) * (p.e + Math.cos(nu)) / 1000

  const O   = p.raan_deg  * DEG
  const w   = p.argp_deg  * DEG
  const i   = p.inc_deg   * DEG

  const cosO = Math.cos(O), sinO = Math.sin(O)
  const cosw = Math.cos(w), sinw = Math.sin(w)
  const cosi = Math.cos(i), sini = Math.sin(i)

  const Qxx =  cosO*cosw - sinO*sinw*cosi
  const Qxy = -cosO*sinw - sinO*cosw*cosi
  const Qyx =  sinO*cosw + cosO*sinw*cosi
  const Qyy = -sinO*sinw + cosO*cosw*cosi
  const Qzx =  sinw*sini
  const Qzy =  cosw*sini

  return {
    pos: [
      Qxx*xp + Qxy*yp,
      Qyx*xp + Qyy*yp,
      Qzx*xp + Qzy*yp,
    ],
    vel: [
      Qxx*vxp + Qxy*vyp,
      Qyx*vxp + Qyy*vyp,
      Qzx*vxp + Qzy*vyp,
    ]
  }
}

function lambertIzzo(
  r1: [number,number,number],
  r2: [number,number,number],
  tof: number,
  mu: number = GM_SUN,
  prograde = true
): { v1: [number,number,number], v2: [number,number,number] } | null {
  const dot  = (a: number[], b: number[]) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
  const norm = (a: number[]) => Math.sqrt(dot(a,a))
  const sub  = (a: number[], b: number[]) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]] as [number,number,number]
  const cross= (a: number[], b: number[]): [number,number,number] => [
    a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]
  ]

  const R1 = norm(r1), R2 = norm(r2)
  if (R1 < 1e-4 || R2 < 1e-4) return null;
  const cos_dnu = dot(r1,r2) / (R1*R2)
  const crs      = cross(r1, r2)
  let dnu: number
  if (prograde) {
    dnu = crs[2] >= 0
      ? Math.acos(Math.max(-1,Math.min(1,cos_dnu)))
      : 2*Math.PI - Math.acos(Math.max(-1,Math.min(1,cos_dnu)))
  } else {
    dnu = crs[2] < 0
      ? Math.acos(Math.max(-1,Math.min(1,cos_dnu)))
      : 2*Math.PI - Math.acos(Math.max(-1,Math.min(1,cos_dnu)))
  }

  const A = Math.sin(dnu) * Math.sqrt(R1*R2 / (1-Math.cos(dnu)))
  if (Math.abs(A) < 1e-6) return null

  const stumpC = (z: number) => {
    if (z > 1e-6)  return (1-Math.cos(Math.sqrt(z)))/z
    if (z < -1e-6) return (Math.cosh(Math.sqrt(-z))-1)/(-z)
    return 0.5
  }
  const stumpS = (z: number) => {
    if (z > 1e-6)  { const sq=Math.sqrt(z); return (sq-Math.sin(sq))/(sq*sq*sq) }
    if (z < -1e-6) { const sq=Math.sqrt(-z); return (Math.sinh(sq)-sq)/(sq*sq*sq) }
    return 1/6
  }

  let z = 0
  for (let iter = 0; iter < 500; iter++) {
    const C  = stumpC(z), S = stumpS(z)
    const denomSqrtC = Math.sqrt(C);
    if (denomSqrtC < 1e-8) { z += 0.1; continue; }
    const y  = R1 + R2 + A*(z*S-1)/denomSqrtC
    if (A > 0 && y < 0) { z += 0.1; continue }
    const sqY   = Math.sqrt(y)
    const tof_z = (sqY**3 * S + A*Math.sqrt(y)) / Math.sqrt(mu)
    const dtdz  = sqY**3 * ((1/(2*z))*(C - 3*S/(2*C)) + 3*S**2/(4*C)) / Math.sqrt(mu)
               + A/8 * (3*S*Math.sqrt(y)/C + A/sqY)
    const dz = (tof - tof_z) / dtdz
    if (!isFinite(dz)) break;
    z += dz
    if (Math.abs(dz) < 1e-8) break
  }

  const C = stumpC(z), S = stumpS(z)
  const denomSqrtC = Math.sqrt(C);
  if (denomSqrtC < 1e-8) return null;
  const y = R1 + R2 + A*(z*S-1)/denomSqrtC
  const f  = 1 - y/R1
  const g  = A * Math.sqrt(y/mu)
  const gd = 1 - y/R2

  if (Math.abs(g) < 1e-8) return null;

  const v1: [number,number,number] = [
    (r2[0] - f*r1[0])/g,
    (r2[1] - f*r1[1])/g,
    (r2[2] - f*r1[2])/g,
  ]
  const v2: [number,number,number] = [
    (gd*r2[0] - r1[0])/g,
    (gd*r2[1] - r1[1])/g,
    (gd*r2[2] - r1[2])/g,
  ]
  return { v1, v2 }
}

export function getTransferBounds(originId: number, destId: number, optGoal?: string, overrideTofMax?: number): { searchDays: number, tofMin: number, tofMax: number } {
  const p1 = PLANETS[originId] || PLANETS[3];
  const p2 = PLANETS[destId] || PLANETS[4];
  const aTransfer = (p1.a + p2.a) / 2.0;
  const hohmannTofDays = 182.62 * Math.pow(aTransfer, 1.5);
  
  // Set nice, generous bounds around the Hohmann TOF
  const tofMin = Math.max(10, Math.round(hohmannTofDays * 0.2));
  let tofMax = Math.max(60, Math.round(hohmannTofDays * 1.8));
  const searchDays = Math.max(800, Math.round(hohmannTofDays * 0.6));

  if (optGoal === 'Time-Optimal (Fast-Transit)') {
    if (p1.a > 5 || p2.a > 5) {
      tofMax = Math.max(365, Math.round(hohmannTofDays * 0.7));
    }
  }

  if (overrideTofMax !== undefined && overrideTofMax > 0) {
    if (tofMax > overrideTofMax) tofMax = overrideTofMax;
  }
  
  return { searchDays, tofMin, tofMax };
}

export function scanPorkchop(
  originId: number,
  destId: number,
  t0_days: number,
  searchDays?: number,
  tofMin?: number,
  tofMax?: number,
  steps = 50,
  optGoal = 'Mass-Optimal (Fuel-Efficient)'
): OptimizeResult | null {
  const bounds = getTransferBounds(originId, destId, optGoal, tofMax);
  const sDays = (searchDays !== undefined && searchDays > 0) ? searchDays : bounds.searchDays;
  const tMin = (tofMin !== undefined && tofMin > 0) ? tofMin : bounds.tofMin;
  const tMax = (tofMax !== undefined && tofMax > 0) ? tofMax : bounds.tofMax;
  
  const AU_to_km = AU_KM
  let best: OptimizeResult | null = null
  let bestScore = Infinity
  let backupDv = Infinity;
  let backupBest: OptimizeResult | null = null;

  for (let di = 0; di < steps; di++) {
    const launch_days = t0_days + (di / steps) * sDays

    for (let ti = 0; ti < steps; ti++) {
      const tof_days = tMin + (ti / steps) * (tMax - tMin)
      const tof_s    = tof_days * 86400

      const s1 = planetStateVector(originId, launch_days)
      const s2 = planetStateVector(destId,   launch_days + tof_days)

      const r1: [number,number,number] = [s1.pos[0]*AU_to_km, s1.pos[1]*AU_to_km, s1.pos[2]*AU_to_km]
      const r2: [number,number,number] = [s2.pos[0]*AU_to_km, s2.pos[1]*AU_to_km, s2.pos[2]*AU_to_km]

      const sol = lambertIzzo(r1, r2, tof_s)
      if (!sol) continue

      const norm = (v: number[]) => Math.sqrt(v[0]**2+v[1]**2+v[2]**2)
      const dv1  = norm([sol.v1[0]-s1.vel[0], sol.v1[1]-s1.vel[1], sol.v1[2]-s1.vel[2]])
      const dv2  = norm([sol.v2[0]-s2.vel[0], sol.v2[1]-s2.vel[1], sol.v2[2]-s2.vel[2]])
      const dvTotal = dv1 + dv2

      if (!isFinite(dv1) || !isFinite(dv2)) continue
      if (dv1 > 100 || dv2 > 100) continue              // skip absurd values
      
      const payload = {
          dv1_kms:         parseFloat(dv1.toFixed(3)),
          dv2_kms:         parseFloat(dv2.toFixed(3)),
          tof_days:        Math.round(tof_days),
          launchDay_j2000: launch_days * 86400,
          v1_ecl:          [sol.v1[0] - s1.vel[0], sol.v1[1] - s1.vel[1], sol.v1[2] - s1.vel[2]] as [number,number,number],
      };

      if (dvTotal < backupDv) {
          backupDv = dvTotal;
          backupBest = payload;
      }

      let score = dvTotal;
      if (optGoal === 'Time-Optimal (Fast-Transit)') {
          if (dvTotal > 40) continue; 
          score = tof_days + (dvTotal * 0.5); // Favor speed, but penalize crazy high delta-v
      } else if (optGoal === 'Budget Capped (Max 6 km/s)') {
          if (dvTotal > 6.0) continue;
          score = tof_days; // Fastest trajectory under 6 km/s budget
      }

      if (score < bestScore) {
        bestScore = score
        best = payload
      }
    }
  }

  // Fallback to lowest possible delta-v if budget constraint totally fails
  return best || backupBest
}

self.onmessage = (e) => {
  const { type, payload } = e.data

  if (type === 'SCAN') {
    const result = scanPorkchop(
      payload.originId,
      payload.destId,
      payload.t0_days,
      payload.searchDays,
      payload.tofMin,
      payload.tofMax,
      payload.steps,
      payload.optGoal
    )
    self.postMessage({ type: 'RESULT', result })
  }
}

