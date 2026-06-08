import { useState, useCallback, useRef, useEffect } from 'react'
import { Move } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
export interface OptimizeResult {
  dv1_kms: number
  dv2_kms: number
  tof_days: number
  launchDay_j2000: number
  v1_ecl: [number, number, number]
  legs?: any[]
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
  1: { name:'Mercury', a:0.387, e:0.2056, inc_deg:7.0,  raan_deg:48.33,  argp_deg:29.124, M0_deg:174.0, T_days:88.0  },
  2: { name:'Venus',   a:0.723, e:0.0067, inc_deg:3.39,  raan_deg:76.68,  argp_deg:54.88,  M0_deg:50.0,  T_days:224.7 },
  3: { name:'Earth',   a:1.0,   e:0.0167, inc_deg:0.00005,raan_deg:-11.26,argp_deg:114.2,  M0_deg:358.0, T_days:365.25 },
  4: { name:'Mars',    a:1.524, e:0.0934, inc_deg:1.85,  raan_deg:49.57,  argp_deg:286.5,  M0_deg:19.0,  T_days:686.98 },
  5: { name:'Jupiter', a:5.204, e:0.0489, inc_deg:1.3,   raan_deg:100.4,  argp_deg:273.8,  M0_deg:20.0,  T_days:4332.59 },
  6: { name:'Saturn',  a:9.582, e:0.0565, inc_deg:2.48,  raan_deg:113.6,  argp_deg:339.3,  M0_deg:317.0, T_days:10759 },
  7: { name:'Uranus',  a:19.201,e:0.0457, inc_deg:0.77,  raan_deg:74.0,   argp_deg:96.6,   M0_deg:142.0, T_days:30688 },
  8: { name:'Neptune', a:30.047,e:0.0113, inc_deg:1.77,  raan_deg:131.7,  argp_deg:273.1,  M0_deg:256.0, T_days:60182 },
}

// ── Component ──────────────────────────────────────────────────────────────
export default function TrajectoryOptimizer({ originId, destId, globalTimeRef, onApply }: Props) {
  const [result, setResult] = useState<OptimizeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [optGoal, setOptGoal] = useState('Mass-Optimal (Fuel-Efficient)')
  const [searchYears, setSearchYears] = useState<number>(10)
  const [maxFlightYears, setMaxFlightYears] = useState<number>(50)

  const workerRef = useRef<Worker | null>(null)

  // Use refs for values that change over time to avoid stale closures
  const originIdRef = useRef(originId)
  const destIdRef = useRef(destId)
  const optGoalRef = useRef(optGoal)
  const searchYearsRef = useRef(searchYears)
  const maxFlightYearsRef = useRef(maxFlightYears)

  useEffect(() => { originIdRef.current = originId }, [originId])
  useEffect(() => { destIdRef.current = destId }, [destId])
  useEffect(() => { optGoalRef.current = optGoal }, [optGoal])
  useEffect(() => { searchYearsRef.current = searchYears }, [searchYears])
  useEffect(() => { maxFlightYearsRef.current = maxFlightYears }, [maxFlightYears])

  // Initialize Web Worker and handlers
  useEffect(() => {
    try {
      const w = new Worker(
        new URL('./workers/trajectory.worker.ts', import.meta.url),
        { type: 'module' }
      )
      w.onmessage = (e) => {
        const { type, result: wResult } = e.data
        if (type === 'RESULT') {
          if (wResult) {
            setResult(wResult)
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

  const run = useCallback(() => {
    setLoading(true)
    setResult(null) // Clear previous result so UI updates
    
    const t0_days = globalTimeRef.current / 86400

    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'SCAN',
        payload: { originId: originIdRef.current, destId: destIdRef.current, t0_days, optGoal: optGoalRef.current, searchDays: searchYearsRef.current * 365.25, tofMax: maxFlightYearsRef.current * 365.25 }
      })
    } else {
      // Worker disabled in preview fallback
      setLoading(false)
    }
  }, [globalTimeRef])

  // Automatically recalculate trajectory when configuration changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      run();
    }, 200); // 200ms debounce
    return () => clearTimeout(timeoutId);
  }, [optGoal, searchYears, maxFlightYears, originId, destId, run]);

  // Automatically apply calculated results to the flight navigation computer in real-time
  useEffect(() => {
    if (result && onApply) {
      onApply(result);
    }
  }, [result, onApply]);

  const apply = () => { if (result) onApply(result) }

  return (
    <div className="p-5 rounded-2xl w-80 mb-4 pointer-events-auto shadow-md relative overflow-y-auto overflow-x-hidden max-h-[85vh] text-gray-900 z-[1000] border border-gray-200 solid-panel bg-white pointer-events-auto custom-scrollbar font-sans">
      <div className="trajectory-drag-handle flex justify-between items-center mb-4 border-b border-gray-200 pb-2.5 cursor-move select-none">
        <h3 className="font-sans font-bold text-[10px] tracking-widest text-blue-700 flex items-center gap-1.5 uppercase">
          <Move className="w-3 h-3 text-gray-500" />
          Plan Trip
        </h3>
      </div>

      <div className="mb-4">
        <label className="text-[10px] font-mono font-bold text-gray-500 block mb-1 uppercase tracking-widest">Goal</label>
        <select 
          value={optGoal} 
          onChange={e => setOptGoal(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded px-2 py-1 flex items-center justify-between text-xs font-mono text-gray-900 outline-none cursor-pointer"
        >
          <option value="Mass-Optimal (Fuel-Efficient)">Save Fuel</option>
          <option value="Time-Optimal (Fast-Transit)">Go Fast</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="text-[10px] font-mono text-gray-500 font-bold flex justify-between mb-1 uppercase tracking-widest">
          <span>Search Window</span>
          <span className="text-blue-700">{searchYears} YRS</span>
        </label>
        <input 
          type="range" 
          min="1" max="100" step="1" 
          value={searchYears}
          onChange={e => setSearchYears(parseInt(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-[8px] font-mono text-gray-400 mt-1 mb-2">
          <span>1YR</span>
          <span>100YR</span>
        </div>

        <label className="text-[10px] font-mono text-gray-500 font-bold flex justify-between mb-1 uppercase tracking-widest">
          <span>Max Flight Time</span>
          <span className="text-blue-700">{maxFlightYears} YRS</span>
        </label>
        <input 
          type="range" 
          min="1" max="100" step="1" 
          value={maxFlightYears}
          onChange={e => setMaxFlightYears(parseInt(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-[8px] font-mono text-gray-400 mt-1">
          <span>1YR</span>
          <span>100YR</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <div className="flex flex-col gap-1 bg-gray-50 p-2 rounded border border-gray-200 relative group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono text-gray-500 font-bold uppercase tracking-widest">
              Direct Route
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-xs font-mono text-gray-600 w-16">{PLANETS[originId]?.name}</div>
            <div className="flex-1 border-b border-dashed border-gray-300 relative">
            </div>
            <div className="text-xs font-mono text-blue-700 font-bold">{PLANETS[destId]?.name}</div>
          </div>
        </div>
      </div>

      <button onClick={run} disabled={loading}
        className="w-full mb-4 px-3 py-2.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all disabled:opacity-40 font-mono tracking-widest text-[9px] flex justify-center items-center font-bold solid-panel cursor-pointer uppercase">
        {loading ? (
          <><div className="w-2 h-2 rounded-full bg-blue-500 animate-ping mr-2"></div>Calculating Route...</>
        ) : 'Find Best Time to Go'}
      </button>

      {result && (
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              ['Start Speed',  `${result.dv1_kms.toFixed(2)} km/s`],
              ['End Speed',  `${result.dv2_kms.toFixed(2)} km/s`],
              ['Flight Time',  `${result.tof_days} days`],
            ].map(([k,v]) => (
               <div key={k} className="bg-white rounded p-2 border border-gray-200">
                 <div className="font-mono text-gray-500 font-bold tracking-wider text-[8px] mb-1 uppercase">{k}</div>
                 <div className="font-mono text-[12px] text-gray-900 font-bold">{v}</div>
               </div>
            ))}
          </div>

          <button onClick={apply}
            className="w-full px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 text-green-700 transition-all font-mono tracking-widest text-[9px] flex items-center justify-center gap-2 font-bold solid-panel cursor-pointer mb-2 uppercase">
            Apply to Rocket ↗
          </button>
        </div>
      )}
    </div>
  )
}

