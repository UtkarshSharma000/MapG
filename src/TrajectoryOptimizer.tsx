import { useState, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
export interface OptimizeResult {
  dv1_kms: number          // departure Δv magnitude → maps to v0
  dv2_kms: number          // arrival Δv (for display)
  tof_days: number         // transfer time
  launchDay_j2000: number  // seconds since J2000 → feed globalTimeRef
  v1_ecl: [number, number, number] // Raw departure velocity in J2000 ecliptic (km/s)
}

interface Props {
  originId: number
  destId: number
  globalTimeRef: React.MutableRefObject<number>   // Read inside run() directly
  onApply: (result: OptimizeResult) => void
}

// ── Orbital data (J2000 epoch, ecliptic frame) ─────────────────────────────
const PLANETS: Record<number, {
  name: string; a: number; e: number; inc_deg: number;
  raan_deg: number; argp_deg: number; M0_deg: number; T_days: number
}> = {
  1: { name:'Mercury', a:0.3871, e:0.2056, inc_deg:7.00,  raan_deg:48.33,  argp_deg:29.12,  M0_deg:174.79, T_days:87.97  },
  2: { name:'Venus',   a:0.7233, e:0.0068, inc_deg:3.39,  raan_deg:76.68,  argp_deg:54.88,  M0_deg:50.44,  T_days:224.70 },
  3: { name:'Earth',   a:1.0000, e:0.0167, inc_deg:0.00,  raan_deg:0.0,    argp_deg:102.94, M0_deg:100.46, T_days:365.25 },
  4: { name:'Mars',    a:1.5237, e:0.0934, inc_deg:1.85,  raan_deg:49.56,  argp_deg:286.50, M0_deg:355.43, T_days:686.97 },
  5: { name:'Jupiter', a:5.2034, e:0.0489, inc_deg:1.30,  raan_deg:100.46, argp_deg:273.87, M0_deg:34.40,  T_days:4332.6 },
  6: { name:'Saturn',  a:9.5371, e:0.0565, inc_deg:2.49,  raan_deg:113.66, argp_deg:339.39, M0_deg:50.08,  T_days:10759  },
}

const AU_KM  = 1.496e8
const GM_SUN = 1.327124e20  // m³/s²
const DEG    = Math.PI / 180

// ── Kepler solver (Newton-Raphson) ─────────────────────────────────────────
function solveKepler(M: number, e: number): number {
  let E = M
  for (let i = 0; i < 100; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E))
    E += dE
    if (Math.abs(dE) < 1e-12) break
  }
  return E
}

// ── Planet state vector in heliocentric ecliptic J2000 ────────────────────
function planetStateVector(id: number, t_days: number): {
  pos: [number,number,number],   // AU
  vel: [number,number,number]    // km/s
} {
  const p   = PLANETS[id]
  const n   = 360 / p.T_days                          // mean motion deg/day
  const M   = ((p.M0_deg + n * t_days) % 360) * DEG
  const E   = solveKepler(M, p.e)
  const nu  = 2 * Math.atan2(
    Math.sqrt(1 + p.e) * Math.sin(E / 2),
    Math.sqrt(1 - p.e) * Math.cos(E / 2)
  )
  const r   = p.a * (1 - p.e * Math.cos(E))           // AU

  // Perifocal coords
  const xp  = r * Math.cos(nu)
  const yp  = r * Math.sin(nu)

  // Velocity in perifocal frame (km/s)
  const a_m = p.a * AU_KM * 1000
  const h   = Math.sqrt(GM_SUN * a_m * (1 - p.e ** 2))
  const vxp = -(GM_SUN / h) * Math.sin(nu) / 1000
  const vyp =  (GM_SUN / h) * (p.e + Math.cos(nu)) / 1000

  // Rotation angles
  const O   = p.raan_deg  * DEG
  const w   = p.argp_deg  * DEG
  const i   = p.inc_deg   * DEG

  // Perifocal → heliocentric ecliptic (3-1-3 rotation)
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

// ── Izzo Lambert solver ────────────────────────────────────────────────────
// Returns [v1, v2] velocity vectors in km/s
function lambertIzzo(
  r1: [number,number,number],   // km
  r2: [number,number,number],   // km
  tof: number,                   // seconds
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

  // Stumpff functions
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

  // Newton iteration on z
  let z = 0
  for (let iter = 0; iter < 500; iter++) {
    const C  = stumpC(z), S = stumpS(z)
    const y  = R1 + R2 + A*(z*S-1)/Math.sqrt(C)
    if (A > 0 && y < 0) { z += 0.1; continue }
    const sqY   = Math.sqrt(y)
    const tof_z = (sqY**3 * S + A*Math.sqrt(y)) / Math.sqrt(mu)
    const dtdz  = sqY**3 * ((1/(2*z))*(C - 3*S/(2*C)) + 3*S**2/(4*C)) / Math.sqrt(mu)
               + A/8 * (3*S*Math.sqrt(y)/C + A/sqY)
    const dz = (tof - tof_z) / dtdz
    z += dz
    if (Math.abs(dz) < 1e-8) break
  }

  const C = stumpC(z), S = stumpS(z)
  const y = R1 + R2 + A*(z*S-1)/Math.sqrt(C)
  const f  = 1 - y/R1
  const g  = A * Math.sqrt(y/mu)
  const gd = 1 - y/R2

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

// ── Porkchop scan ──────────────────────────────────────────────────────────
function scanPorkchop(
  originId: number,
  destId: number,
  t0_days: number,
  searchDays = 800,
  tofMin = 60,
  tofMax = 800,
  steps = 60
): OptimizeResult {
  const AU_to_km = AU_KM
  let best: OptimizeResult | null = null
  let bestDv = Infinity

  for (let di = 0; di < steps; di++) {
    const launch_days = t0_days + (di / steps) * searchDays

    for (let ti = 0; ti < steps; ti++) {
      const tof_days = tofMin + (ti / steps) * (tofMax - tofMin)
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

      if (dvTotal < bestDv) {
        bestDv = dvTotal
        best = {
          dv1_kms:         parseFloat(dv1.toFixed(3)),
          dv2_kms:         parseFloat(dv2.toFixed(3)),
          tof_days:        Math.round(tof_days),
          launchDay_j2000: launch_days * 86400,  // → seconds for globalTimeRef
          v1_ecl:          [sol.v1[0] - s1.vel[0], sol.v1[1] - s1.vel[1], sol.v1[2] - s1.vel[2]],
        }
      }
    }
  }

  return best!
}

// ── Component ──────────────────────────────────────────────────────────────
export default function TrajectoryOptimizer({ originId, destId, globalTimeRef, onApply }: Props) {
  const [result, setResult] = useState<OptimizeResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(() => {
    setLoading(true)
    // Defer to next tick so React renders the loading state first
    setTimeout(() => {
      const t0_days = globalTimeRef.current / 86400
      const res = scanPorkchop(originId, destId, t0_days)
      setResult(res)
      setLoading(false)
    }, 0)
  }, [originId, destId, globalTimeRef])

  const apply = () => { if (result) onApply(result) }

  return (
    <div className="glass-panel p-4 rounded-lg w-72 mb-4 pointer-events-auto">
      <p className="font-label-caps text-[10px] tracking-[0.15em] text-outline mb-3">
        {PLANETS[originId]?.name} → {PLANETS[destId]?.name}
      </p>
      <button onClick={run} disabled={loading}
        className="w-full mb-3 px-3 py-2 rounded border border-primary/50 bg-primary/20 hover:bg-primary/30 text-primary transition-all disabled:opacity-40 font-label-caps tracking-[0.15em] text-[10px]">
        {loading ? 'SCANNING LAUNCH WINDOWS...' : 'FIND OPTIMAL WINDOW'}
      </button>
      {result && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              ['DEP. Δv',  `${result.dv1_kms} km/s`],
              ['ARR. Δv',  `${result.dv2_kms} km/s`],
              ['TOF',      `${result.tof_days} days`],
            ].map(([k,v]) => (
              <div key={k} className="bg-surface-variant/30 rounded p-2">
                <div className="font-label-caps tracking-[0.15em] text-[8px] text-outline mb-1">{k}</div>
                <div className="font-data-lg text-[14px] text-on-surface">{v}</div>
              </div>
            ))}
          </div>
          <button onClick={apply}
            className="w-full px-3 py-2 rounded bg-tertiary-container/30 border border-tertiary/50 hover:bg-tertiary-container/50 text-tertiary transition-all font-label-caps tracking-[0.15em] text-[10px]">
            APPLY PARAMETERS ↗
          </button>
        </>
      )}
    </div>
  )
}

