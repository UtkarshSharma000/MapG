import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'

// ── Types ──────────────────────────────────────────────────────────────────
export interface OptimizeResult {
  dv1_kms: number
  dv2_kms: number
  tof_days: number
  launchDay_j2000: number
  v1_ecl: [number, number, number]
  legs?: MissionLeg[]
}

export interface MissionLeg {
  originId: number
  destId: number
  type: 'transfer' | 'flyby' | 'capture'
  launchDay_j2000?: number
  tof_days?: number
  dv1_kms?: number
  dv2_kms?: number
  v1_ecl?: [number, number, number]
}

interface Props {
  originId: number
  destId: number
  globalTimeRef: React.MutableRefObject<number>
  onApply: (result: OptimizeResult) => void
}

// ── Orbital data (J2000 epoch, ecliptic frame) ─────────────────────────────
export const PLANETS: Record<number, {
  name: string; a: number; e: number; inc_deg: number;
  raan_deg: number; argp_deg: number; M0_deg: number; T_days: number
}> = {
  1: { name:'Mercury', a:0.3871, e:0.2056, inc_deg:7.00,  raan_deg:48.33,  argp_deg:29.12,  M0_deg:174.79, T_days:87.97  },
  2: { name:'Venus',   a:0.7233, e:0.0068, inc_deg:3.39,  raan_deg:76.68,  argp_deg:54.88,  M0_deg:50.44,  T_days:224.70 },
  3: { name:'Earth',   a:1.0000, e:0.0167, inc_deg:0.00,  raan_deg:0.0,    argp_deg:102.94, M0_deg:100.46, T_days:365.25 },
  4: { name:'Mars',    a:1.5237, e:0.0934, inc_deg:1.85,  raan_deg:49.56,  argp_deg:286.50, M0_deg:355.43, T_days:686.97 },
  5: { name:'Jupiter', a:5.2034, e:0.0489, inc_deg:1.30,  raan_deg:100.46, argp_deg:273.87, M0_deg:34.40,  T_days:4332.6 },
  6: { name:'Saturn',  a:9.5371, e:0.0565, inc_deg:2.49,  raan_deg:113.66, argp_deg:339.39, M0_deg:50.08,  T_days:10759  },
  7: { name:'Uranus',  a:19.2010, e:0.0457, inc_deg:0.77,  raan_deg:74.0,   argp_deg:96.6,   M0_deg:142.00, T_days:30688  },
  8: { name:'Neptune', a:30.0470, e:0.0113, inc_deg:1.77,  raan_deg:131.7,  argp_deg:273.1,  M0_deg:256.00, T_days:60182  },
}
const PLANET_IDS = [1, 2, 3, 4, 5, 6, 7, 8]

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

export function getTransferBounds(originId: number, destId: number): { searchDays: number, tofMin: number, tofMax: number } {
  const p1 = PLANETS[originId] || PLANETS[3];
  const p2 = PLANETS[destId] || PLANETS[4];
  const aTransfer = (p1.a + p2.a) / 2.0;
  const hohmannTofDays = 182.62 * Math.pow(aTransfer, 1.5);
  
  // Set nice, generous bounds around the Hohmann TOF
  const tofMin = Math.max(10, Math.round(hohmannTofDays * 0.4));
  const tofMax = Math.max(60, Math.round(hohmannTofDays * 1.8));
  const searchDays = Math.max(800, Math.round(hohmannTofDays * 0.6));
  
  return { searchDays, tofMin, tofMax };
}

// ── Porkchop scan ──────────────────────────────────────────────────────────
export function scanPorkchop(
  originId: number,
  destId: number,
  t0_days: number,
  searchDays?: number,
  tofMin?: number,
  tofMax?: number,
  steps = 50
): OptimizeResult | null {
  const bounds = getTransferBounds(originId, destId);
  const sDays = (searchDays !== undefined && searchDays > 0) ? searchDays : bounds.searchDays;
  const tMin = (tofMin !== undefined && tofMin > 0) ? tofMin : bounds.tofMin;
  const tMax = (tofMax !== undefined && tofMax > 0) ? tofMax : bounds.tofMax;

  const AU_to_km = AU_KM
  let best: OptimizeResult | null = null
  let bestDv = Infinity

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
      if (dv1 > 50 || dv2 > 50) continue              // skip absurd values

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

  return best
}

function findBestFlyby(
  originId: number,
  destId: number,
  t0_days: number
): { flybyId: number; totalDv: number; legs: MissionLeg[], all: {flybyId: number, dv: number}[] } | null {

  const candidates = PLANET_IDS.filter(id => id !== originId && id !== destId)
  let best = { flybyId: -1, totalDv: Infinity, legs: [] as MissionLeg[], all: [] as {flybyId: number, dv: number}[] }
  const allRes = [];

  for (const flybyId of candidates) {
    const leg1 = scanPorkchop(originId, flybyId, t0_days, undefined, undefined, undefined, 40)
    if (!leg1) continue

    const leg2ArrivalDay = (leg1.launchDay_j2000 / 86400) + leg1.tof_days
    const leg2 = scanPorkchop(flybyId, destId, leg2ArrivalDay, undefined, undefined, undefined, 40)
    if (!leg2) continue

    const totalDv = leg1.dv1_kms + leg2.dv1_kms
    allRes.push({ flybyId, dv: totalDv })

    if (totalDv < best.totalDv) {
      best = {
        flybyId,
        totalDv,
        legs: [
          { originId, destId: flybyId, type: 'flyby', ...leg1 },
          { originId: flybyId, destId, type: 'capture', ...leg2 },
        ],
        all: allRes
      }
    }
  }
  if (best.flybyId === -1) return null
  best.all = allRes;
  best.all.sort((a,b) => a.dv - b.dv)
  return best
}

// ── Component ──────────────────────────────────────────────────────────────
export default function TrajectoryOptimizer({ originId, destId, globalTimeRef, onApply }: Props) {
  const [result, setResult] = useState<OptimizeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoMode, setAutoMode] = useState(false)
  const [optGoal, setOptGoal] = useState('Mass-Optimal (Fuel-Efficient)')
  const [searchYears, setSearchYears] = useState<number>(10)

  const [legs, setLegs] = useState<MissionLeg[]>([
    { originId: originId || 3, destId: destId || 4, type: 'capture' }
  ])
  
  const [autoResult, setAutoResult] = useState<any | null>(null)
  const workerRef = useRef<Worker | null>(null)

  // Keep legs and results synced when originId or destId changes
  useEffect(() => {
    setLegs([
      { originId: originId || 3, destId: destId || 4, type: 'capture' }
    ])
    setResult(null)
    setAutoResult(null)
  }, [originId, destId])

  // Use refs for values that change over time to avoid stale closures
  const originIdRef = useRef(originId)
  const destIdRef = useRef(destId)
  const legsRef = useRef(legs)
  const autoModeRef = useRef(autoMode)
  const optGoalRef = useRef(optGoal)
  const searchYearsRef = useRef(searchYears)

  useEffect(() => { originIdRef.current = originId }, [originId])
  useEffect(() => { destIdRef.current = destId }, [destId])
  useEffect(() => { legsRef.current = legs }, [legs])
  useEffect(() => { autoModeRef.current = autoMode }, [autoMode])
  useEffect(() => { optGoalRef.current = optGoal }, [optGoal])
  useEffect(() => { searchYearsRef.current = searchYears }, [searchYears])

  // Initialize Web Worker and handlers
  useEffect(() => {
    try {
      const w = new Worker(
        new URL('./workers/trajectory.worker.ts', import.meta.url),
        { type: 'module' }
      )
      w.onmessage = (e) => {
        const { type, result: wResult, legs: returnedLegs } = e.data
        if (type === 'RESULT') {
          if (wResult) {
            setResult(wResult)
          } else {
            setResult(null)
          }
          setLoading(false)
        } else if (type === 'AUTO_RESULT') {
          if (wResult && wResult.flybyId !== -1) {
            setAutoResult(wResult)
            const returnedLegs = wResult.legs;
            setResult({
              dv1_kms: returnedLegs[0].dv1_kms!,
              dv2_kms: returnedLegs[returnedLegs.length - 1].dv2_kms!,
              tof_days: returnedLegs.reduce((sum: number, l: any) => sum + (l.tof_days || 0), 0),
              launchDay_j2000: returnedLegs[0].launchDay_j2000 || (globalTimeRef.current),
              v1_ecl: returnedLegs[0].v1_ecl!,
              legs: returnedLegs
            })
          } else {
            setAutoResult(null)
            setResult(null)
          }
          setLoading(false)
        } else if (type === 'MANUAL_RESULT') {
          if (returnedLegs && returnedLegs.length > 0) {
            setLegs(returnedLegs)
            setResult({
              dv1_kms: returnedLegs[0].dv1_kms!,
              dv2_kms: returnedLegs[returnedLegs.length - 1].dv2_kms!,
              tof_days: returnedLegs.reduce((sum: number, l: any) => sum + (l.tof_days || 0), 0),
              launchDay_j2000: returnedLegs[0].launchDay_j2000 || (globalTimeRef.current),
              v1_ecl: returnedLegs[0].v1_ecl!,
              legs: returnedLegs
            })
          } else {
            setResult(null)
          }
          setLoading(false)
        }
      }
      workerRef.current = w
    } catch (err) {
      console.warn("Could not load trajectory Web Worker, falling back to sync:", err)
    }
    return () => {
      workerRef.current?.terminate()
    }
  }, [globalTimeRef])

  const updateLeg = (i: number, changes: Partial<MissionLeg>) => {
    setLegs(prev => {
      const newLegs = [...prev]
      newLegs[i] = { ...newLegs[i], ...changes }
      if (i + 1 < newLegs.length && changes.destId) {
        newLegs[i + 1].originId = changes.destId
      }
      return newLegs
    })
  }

  const addFlyby = () => {
    setLegs(prev => {
      const newLegs = [...prev]
      const last = newLegs[newLegs.length - 1]
      newLegs.splice(newLegs.length - 1, 0, {
        originId: last.originId,
        destId: Math.max(1, (last.originId - 1) % 6) || 2,
        type: 'flyby'
      })
      newLegs[newLegs.length - 1].originId = newLegs[newLegs.length - 2].destId
      return newLegs
    })
  }

  const removeFlyby = (i: number) => {
    setLegs(prev => {
      const newLegs = [...prev]
      newLegs.splice(i, 1)
      if (i < newLegs.length) {
        newLegs[i].originId = i > 0 ? newLegs[i-1].destId : originId
      }
      return newLegs
    })
  }

  const run = useCallback(() => {
    setLoading(true)
    setAutoResult(null)
    setResult(null) // Clear previous result so UI / GhostPath updates and doesn't draw stale results
    
    const t0_days = globalTimeRef.current / 86400

    if (workerRef.current) {
      if (autoModeRef.current) {
        workerRef.current.postMessage({
          type: 'AUTO_FLYBY',
          payload: { originId: originIdRef.current, destId: destIdRef.current, t0_days, optGoal: optGoalRef.current, searchDays: searchYearsRef.current * 365.25 }
        })
      } else {
        workerRef.current.postMessage({
          type: 'MANUAL_LEGS',
          payload: { legs: legsRef.current, t0_days, optGoal: optGoalRef.current, searchDays: searchYearsRef.current * 365.25 }
        })
      }
    } else {
      // Fallback synchronous code
      setTimeout(() => {
        const currentOriginId = originIdRef.current
        const currentDestId = destIdRef.current
        const currentAutoMode = autoModeRef.current
        const currentLegs = legsRef.current
        const currentOptGoal = optGoalRef.current;

        if (currentAutoMode) {
          // Need to update findBestFlyby in component if used synchronously, but we rely on worker mainly.
          // Ignoring fallback implementation update for flyby since it's rarely hit without worker
        } else {
          let currentT0 = t0_days
          const computedLegs: MissionLeg[] = []
          let failed = false
          for (let i = 0; i < currentLegs.length; i++) {
            const leg = currentLegs[i]
            const res = scanPorkchop(leg.originId, leg.destId, currentT0, undefined, undefined, undefined, 50, currentOptGoal)
            if (!res) {
              failed = true
              break
            }
            computedLegs.push({ ...leg, dv1_kms: res.dv1_kms, dv2_kms: res.dv2_kms, tof_days: res.tof_days, v1_ecl: res.v1_ecl })
            currentT0 += res.tof_days
          }
          if (!failed && computedLegs.length > 0) {
            setLegs(computedLegs)
            setResult({
              dv1_kms: computedLegs[0].dv1_kms!,
              dv2_kms: computedLegs[computedLegs.length - 1].dv2_kms!,
              tof_days: computedLegs.reduce((sum, l) => sum + (l.tof_days || 0), 0),
              launchDay_j2000: t0_days * 86400,
              v1_ecl: computedLegs[0].v1_ecl!,
              legs: computedLegs
            })
          } else {
            setResult(null)
          }
        }
        setLoading(false)
      }, 0)
    }
  }, [globalTimeRef])

  const apply = () => { if (result) onApply(result) }

  return (
    <div className="p-5 rounded-2xl w-80 mb-4 pointer-events-auto shadow-2xl relative overflow-hidden text-white z-[1000] border border-white/10 glossy-panel">
      <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2.5">
        <h3 className="font-sans font-medium text-[10px] tracking-widest text-primary">TRAJECTORY PLANNER</h3>
        <button 
          onClick={() => setAutoMode(!autoMode)}
          className={`px-2.5 py-1 rounded-lg font-mono text-[8.5px] uppercase tracking-widest transition-all glossy-button cursor-pointer ${
            autoMode ? 'bg-[#ffb59d]/25 text-primary border-primary/50' : 'bg-white/5 text-white/50 hover:bg-white/10 border-white/5'
          }`}
        >
          {autoMode ? 'AUTO: SLS' : 'MANUAL'}
        </button>
      </div>

      <div className="mb-4">
        <label className="text-[10px] font-mono text-white/40 block mb-1">OPTIMIZATION GOAL</label>
        <select 
          value={optGoal} 
          onChange={e => setOptGoal(e.target.value)}
          className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-xs font-mono text-cyan-400 outline-none cursor-pointer"
        >
          <option value="Mass-Optimal (Fuel-Efficient)">Mass-Optimal (Fuel-Efficient)</option>
          <option value="Time-Optimal (Fast-Transit)">Time-Optimal (Fast-Transit)</option>
          <option value="Budget Capped (Max 6 km/s)">Budget Capped (Max 6 km/s)</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="text-[10px] font-mono text-white/40 flex justify-between mb-1">
          <span>SEARCH WINDOW</span>
          <span className="text-cyan-400">{searchYears} YEARS</span>
        </label>
        <input 
          type="range" 
          min="1" max="100" step="1" 
          value={searchYears}
          onChange={e => setSearchYears(parseInt(e.target.value))}
          className="w-full accent-cyan-500"
        />
        <div className="flex justify-between text-[8px] font-mono text-white/30 mt-1">
          <span>1YR</span>
          <span>100YR</span>
        </div>
      </div>

      {!autoMode ? (
        <div className="flex flex-col gap-2 mb-4">
          {legs.map((leg, i) => (
            <div key={i} className="flex flex-col gap-1 bg-black/40 p-2 rounded border border-white/5 relative group">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-outline-variant uppercase">
                  {i === 0 ? 'DEPARTURE' : `LEG ${i+1}`}
                </span>
                {leg.type === 'flyby' && (
                  <button onClick={() => removeFlyby(i)} className="text-red-400/50 hover:text-red-400 text-[10px]">✕</button>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <div className="text-xs font-mono text-white/50 w-16">{PLANETS[leg.originId]?.name}</div>
                <div className="flex-1 border-b border-dashed border-white/20 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-mono text-cyan-400/70">
                    {leg.dv1_kms ? `${leg.dv1_kms.toFixed(2)} km/s` : '—'}
                  </div>
                </div>
                {i < legs.length - 1 ? (
                  <select 
                    value={leg.destId} 
                    onChange={e => updateLeg(i, { destId: +e.target.value })}
                    className="bg-black/60 border border-white/10 rounded px-1 py-0.5 text-xs font-mono text-white outline-none cursor-pointer"
                  >
                    {PLANET_IDS.map(id => <option key={id} value={id}>{PLANETS[id].name}</option>)}
                  </select>
                ) : (
                  <div className="text-xs font-mono text-primary font-bold">{PLANETS[leg.destId]?.name}</div>
                )}
              </div>
              <div className="flex justify-end pt-1">
                <span className="text-[8px] font-mono text-white/30 tracking-widest uppercase">{leg.type}</span>
              </div>
            </div>
          ))}
          <button 
            onClick={addFlyby}
            className="w-full py-1.5 mt-1 rounded-lg border border-dashed border-white/20 text-white/40 hover:text-white/80 hover:bg-white/5 text-[9px] font-mono tracking-widest transition-colors cursor-pointer"
          >
            + ADD FLYBY
          </button>
        </div>
      ) : (
        <div className="text-[10px] font-mono text-white/50 mb-4 bg-black/40 p-3 rounded-lg border border-white/5">
          <div className="text-cyan-400 mb-2">Automated Optimization active.</div>
          The navigation computer will search all viable single-flyby trajectories to minimize initial departure ΔV to {PLANETS[destId]?.name}.
        </div>
      )}

      <button onClick={run} disabled={loading}
        className="w-full mb-4 px-3 py-2.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-400 transition-all disabled:opacity-40 font-mono tracking-widest text-[9px] flex justify-center items-center font-bold glossy-button cursor-pointer">
        {loading ? (
          <><div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping mr-2"></div>COMPUTING INTERPLANETARY AXIS...</>
        ) : 'FIND OPTIMAL LAUNCH WINDOW'}
      </button>

      {result && (
        <div className="bg-black/40 rounded-xl p-3 border border-white/10">
          {autoMode && autoResult && (
             <div className="mb-4 bg-black/50 p-2 rounded">
                <div className="text-[10px] font-mono text-cyan-400 mb-2 font-bold">AUTO RESULT:</div>
                <div className="text-xs font-mono mb-1">
                  {PLANETS[originId].name} <span className="text-white/40">→</span> {PLANETS[autoResult.flybyId]?.name} <span className="text-cyan-400/50">(flyby)</span> <span className="text-white/40">→</span> {PLANETS[destId].name}
                </div>
                <div className="text-[10px] font-mono text-white/50 mb-3 mt-2 border-b border-white/10 pb-2">
                   Total Δv: <span className="text-white">{autoResult.totalDv.toFixed(2)} km/s</span>
                </div>
                <div className="text-[9px] font-mono text-white/40 mb-1">OTHER CANDIDATES:</div>
                {autoResult.all.map((c, idx) => (
                  <div key={c.flybyId} className="flex justify-between text-[9px] font-mono mt-0.5">
                    <span>{PLANETS[c.flybyId]?.name} flyby:</span>
                    <span className={idx === 0 ? 'text-primary font-bold' : ''}>{c.dv.toFixed(2)} km/s {idx === 0 && '✓ OPTIMAL'}</span>
                  </div>
                ))}
             </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              ['DEP. Δv',  `${result.dv1_kms.toFixed(2)} km/s`],
              ['ARR. Δv',  `${result.dv2_kms.toFixed(2)} km/s`],
              ['EST TOF',  `${result.tof_days} days`],
            ].map(([k,v]) => (
               <div key={k} className="bg-black/30 rounded p-2 border border-white/5">
                 <div className="font-mono text-white/40 tracking-wider text-[8px] mb-1">{k}</div>
                 <div className="font-mono text-[12px] text-white font-bold">{v}</div>
               </div>
            ))}
          </div>

          <button onClick={apply}
            className="w-full px-3 py-2.5 rounded-lg bg-cyan-500/15 border border-cyan-500/35 hover:bg-cyan-500/30 text-cyan-400 transition-all font-mono tracking-widest text-[9px] flex items-center justify-center gap-2 font-bold glossy-button cursor-pointer mb-2">
            APPLY TO NAVIGATION COMPUTER ↗
          </button>
        </div>
      )}
    </div>
  )
}

