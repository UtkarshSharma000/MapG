import React, { useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { Move } from 'lucide-react';
import { OptimizeResult } from '../TrajectoryOptimizer';

interface LaunchHUDProps {
  v0: number;
  pitch: number;
  yaw: number;
  nbody: boolean;
  setV0: (v: number) => void;
  setPitch: (p: number) => void;
  setYaw: (y: number) => void;
  setNbody: (n: boolean) => void;
  targetOrbit: string;
  setTargetOrbit: (t: string) => void;
  onSimulateLaunch: () => void;
  onResetSimulation: () => void;
  isLaunched: boolean;
  missionStatus?: string;
  onPlanReturn?: () => void;
  returnWindow?: OptimizeResult | null;
  onApplyReturn?: () => void;
  onConcludeMission?: () => void;
  onPlanTarget?: (destId: number) => void;
}

export function LaunchHUD({
  v0,
  pitch,
  yaw,
  nbody,
  targetOrbit,
  setTargetOrbit,
  setV0,
  setPitch,
  setYaw,
  setNbody,
  onSimulateLaunch,
  onResetSimulation,
  isLaunched,
  missionStatus,
  onPlanReturn,
  returnWindow,
  onApplyReturn,
  onConcludeMission,
  onPlanTarget
}: LaunchHUDProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'MANUAL' | 'AUTOMATED'>('MANUAL');
  const [autoDest, setAutoDest] = useState<number>(4); // Default to Mars (4)

  const [isCalculatingLaunchPhase, setIsCalculatingLaunchPhase] = useState(false);

  const onLaunch = () => {
    setIsCalculatingLaunchPhase(true);
    // Simulate CPP engine collision avoidance calculations as requested
    setTimeout(() => {
      setIsCalculatingLaunchPhase(false);
      onSimulateLaunch();
    }, 3500);
  };

  const handleReset = () => {
    onResetSimulation();
  };

  if (missionStatus === undefined) {
    console.error('LaunchHUD: missionStatus prop is required');
    return <div className="fixed bottom-4 left-4 bg-red-900/80 p-2 text-white text-[10px] font-mono border border-red-500 rounded z-[100]">LaunchHUD: missing props</div>;
  }

  return (
    <Draggable nodeRef={nodeRef} handle=".vab-drag-handle">
      <div ref={nodeRef} className="fixed left-8 bottom-24 w-80 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 text-white z-40 pointer-events-auto shadow-2xl flex flex-col glossy-panel">
        <div className="vab-drag-handle flex justify-between items-center cursor-move border-b border-white/10 pb-3 mb-4">
          <h3 className="font-sans font-medium text-xs tracking-widest uppercase text-primary flex items-center gap-1.5">
            LAUNCH CONFIGURATION PROFILE
          </h3>
          <Move className="w-3.5 h-3.5 text-white/40 cursor-grab" />
        </div>
        
        <div className="flex bg-white/5 p-1 rounded-lg mb-4">
          <button 
            className={`flex-1 py-1 text-[10px] uppercase font-mono tracking-widest rounded-md cursor-pointer transition-colors ${mode === 'MANUAL' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-white/40 hover:text-white/80'}`}
            onClick={() => setMode('MANUAL')}
            disabled={isLaunched}
          >
            Manual
          </button>
          <button 
            className={`flex-1 py-1 text-[10px] uppercase font-mono tracking-widest rounded-md cursor-pointer transition-colors ${mode === 'AUTOMATED' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-white/40 hover:text-white/80'}`}
            onClick={() => {
              setMode('AUTOMATED');
              if (onPlanTarget) onPlanTarget(autoDest);
            }}
            disabled={isLaunched}
          >
            Automated
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'MANUAL' ? (
            <>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[10px] font-mono text-white/50 uppercase">Injection Velocity (v0)</label>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">{v0.toFixed(2)} km/s</span>
                </div>
                  <input 
                  type="range" min="0" max={targetOrbit === 'TMI' ? "25" : "12"} step="0.1" 
                  value={v0} onChange={(e) => setV0(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  disabled={isLaunched}
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[10px] font-mono text-white/50 uppercase">Pitch Angle</label>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">{pitch}°</span>
                </div>
                <input 
                  type="range" min="-90" max="90" step="1" 
                  value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  disabled={isLaunched}
                />
              </div>

              <div>
                 <div className="flex justify-between mb-1">
                  <label className="text-[10px] font-mono text-white/50 uppercase">Yaw Angle</label>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">{yaw}°</span>
                </div>
                <input 
                  type="range" min="-180" max="180" step="1" 
                  value={yaw} onChange={(e) => setYaw(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  disabled={isLaunched}
                />
              </div>
              
              <div>
                 <label className="text-[10px] font-mono text-white/50 block mb-1.5 uppercase">Target Orbit</label>
                 <select 
                   value={targetOrbit} 
                   onChange={(e) => {
                     const val = e.target.value;
                     setTargetOrbit(val);
                     if (val === 'LEO') setV0(7.67);
                     if (val === 'TLI') setV0(10.9);
                   }}
                   className="w-full bg-[#050505] border border-white/10 rounded-lg p-2 text-xs font-mono text-white focus:border-cyan-400 outline-none cursor-pointer hover:border-white/20 transition-colors"
                   disabled={isLaunched}
                 >
                   <option value="LEO">Low Earth Orbit (LEO)</option>
                   <option value="TLI">Lunar Transfer Axis (TLI)</option>
                   <option value="TMI">Heliocentric Interplanetary (TMI)</option>
                 </select>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 py-2">
              <div className="text-[10px] font-mono text-cyan-400/80 leading-relaxed uppercase">
                Lambert Astrodynamics Targeting System (LATS) computes optimal transfer window and sets exact orbital vectors automatically.
              </div>
              <div>
                 <label className="text-[10px] font-mono text-white/50 block mb-1.5 uppercase">Select Destination</label>
                 <select 
                   value={autoDest} 
                   onChange={(e) => {
                     const destId = parseInt(e.target.value);
                     setAutoDest(destId);
                     if (onPlanTarget) {
                       onPlanTarget(destId);
                     }
                   }}
                   className="w-full bg-[#050505] border border-white/10 rounded-lg p-2 text-xs font-mono text-white focus:border-cyan-400 outline-none cursor-pointer hover:border-white/20 transition-colors"
                   disabled={isLaunched}
                 >
                   <option value={1}>Mercury (Heliocentric Orbit)</option>
                   <option value={2}>Venus (Heliocentric Orbit)</option>
                   <option value={4}>Mars (Heliocentric Orbit)</option>
                   <option value={5}>Jupiter (Heliocentric Orbit)</option>
                   <option value={6}>Saturn (Heliocentric Orbit)</option>
                 </select>
              </div>
              
              {!isLaunched && (
                <div className="bg-black/60 p-3 flex flex-col gap-2 rounded-lg border border-white/5 mt-2">
                  <div className="flex justify-between items-center opacity-50">
                    <span className="text-[9px] font-mono uppercase tracking-widest">Injection Velocity</span>
                    <span className="text-[10px] font-mono font-bold text-cyan-400">{v0.toFixed(2)} km/s</span>
                  </div>
                  <div className="flex justify-between items-center opacity-50">
                    <span className="text-[9px] font-mono uppercase tracking-widest">Pitch Trajectory</span>
                    <span className="text-[10px] font-mono font-bold text-cyan-400">{pitch}°</span>
                  </div>
                  <div className="flex justify-between items-center opacity-50">
                    <span className="text-[9px] font-mono uppercase tracking-widest">Yaw Deviation</span>
                    <span className="text-[10px] font-mono font-bold text-cyan-400">{yaw}°</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-2 border-t border-white/10">
            <input 
              type="checkbox" 
              id="nbody-toggle" 
              checked={nbody} 
              onChange={(e) => setNbody(e.target.checked)}
              className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
              disabled={isLaunched}
            />
            <label htmlFor="nbody-toggle" className="text-[10px] font-sans text-white/40 cursor-pointer select-none uppercase tracking-wide">Enable N-Body Gravity Perturbations</label>
          </div>

          <button 
            className={`w-full py-2.5 rounded-lg border font-semibold tracking-widest text-xs transition-all glossy-button cursor-pointer ${isLaunched ? 'text-red-400 hover:text-red-300 border-red-500/40 bg-red-500/10 hover:bg-red-500/20' : (isCalculatingLaunchPhase ? 'text-orange-400 border-orange-500/40 bg-orange-500/10' : 'text-cyan-400 hover:text-cyan-300 border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/25')}`}
            onClick={isLaunched ? handleReset : onLaunch}
            disabled={isCalculatingLaunchPhase}
          >
             {isLaunched ? 'ABORT TRACKING' : isCalculatingLaunchPhase ? 'CPP ENGINE: RESOLVING CONFLICTS...' : 'INITIATE ENGINE IGNITION'}
          </button>

          {isLaunched && missionStatus === 'EARTH_ORBIT' && onConcludeMission && (
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              <button 
                onClick={onConcludeMission}
                className="w-full py-2 bg-green-500/15 border border-green-500/40 hover:bg-green-500/25 text-green-400 hover:text-green-300 rounded-lg font-mono tracking-widest text-[9px] uppercase transition-all glossy-button cursor-pointer font-bold"
              >
                ✓ SUCCESS: CONCLUDE MISSION & ARCHIVE LOGS
              </button>
            </div>
          )}

          {missionStatus && missionStatus.includes('ORBIT') && missionStatus !== 'EARTH_ORBIT' && (
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              <button 
                onClick={onPlanReturn}
                className="w-full py-2 bg-orange-500/10 border border-orange-500/40 hover:bg-orange-500/25 text-orange-400 hover:text-orange-300 rounded-lg font-mono tracking-widest text-[9px] uppercase transition-all glossy-button cursor-pointer"
              >
                Plan return window → Earth
              </button>
              
              {returnWindow && (
                <div className="bg-black/60 p-3 rounded-lg border border-white/10 flex flex-col gap-2 transition-all duration-300">
                  <div className="flex justify-between border-b border-white/5 pb-1 text-[9px] font-mono text-white/50 uppercase tracking-tighter">
                    <span>Optimal Window:</span> 
                    <span className="text-white font-bold">{returnWindow.tof_days} Days TOF</span>
                  </div>
                  <div className="flex justify-between pb-1.5 text-[9px] font-mono text-white/50 uppercase tracking-tighter">
                    <span>Burn Required:</span> 
                    <span className="text-white font-bold">{returnWindow.dv1_kms.toFixed(2)} KM/S</span>
                  </div>
                  <button 
                    onClick={onApplyReturn}
                    className="w-full py-1.5 bg-cyan-500/20 border border-cyan-500/50 hover:bg-cyan-500/35 text-cyan-400 rounded-lg font-mono text-[9px] uppercase tracking-widest glossy-button cursor-pointer"
                  >
                    Confirm & Execute TEI
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Draggable>
  );
}
