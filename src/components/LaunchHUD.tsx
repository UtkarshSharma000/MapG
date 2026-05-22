import React, { useRef } from "react";
import Draggable from "react-draggable";
import { Move } from "lucide-react";

export function LaunchHUD({
  v0,
  setV0,
  pitch,
  setPitch,
  yaw,
  setYaw,
  nbody,
  setNbody,
  targetOrbit,
  setTargetOrbit,
  onLaunch,
  isLaunched
}: any) {
  const nodeRef = useRef<HTMLDivElement>(null);

  return (
    <Draggable nodeRef={nodeRef} handle=".vab-drag-handle">
      <div ref={nodeRef} className="fixed right-4 bottom-24 w-72 bg-surface/80 backdrop-blur-md border border-outline rounded-xl p-4 text-on-surface z-40 pointer-events-auto shadow-2xl flex flex-col">
        <div className="vab-drag-handle flex justify-between items-center cursor-move border-b border-outline/30 pb-2 mb-4">
          <h3 className="font-heading font-medium text-lg uppercase tracking-wider">VAB Launch Profile</h3>
          <Move className="w-4 h-4 text-outline" />
        </div>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-mono text-outline">Initial Velocity (v0)</label>
              <span className="text-xs font-mono text-primary">{v0.toFixed(1)} km/s</span>
            </div>
            <input 
              type="range" min="0" max="25" step="0.1" 
              value={v0} onChange={(e) => setV0(parseFloat(e.target.value))}
              className="w-full accent-primary cursor-pointer"
              disabled={isLaunched}
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-mono text-outline">Pitch Angle</label>
              <span className="text-xs font-mono text-primary">{pitch}°</span>
            </div>
            <input 
              type="range" min="-90" max="90" step="1" 
              value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))}
              className="w-full accent-primary cursor-pointer"
              disabled={isLaunched}
            />
          </div>

          <div>
             <div className="flex justify-between mb-1">
              <label className="text-xs font-mono text-outline">Yaw Angle</label>
              <span className="text-xs font-mono text-primary">{yaw}°</span>
            </div>
            <input 
              type="range" min="-180" max="180" step="1" 
              value={yaw} onChange={(e) => setYaw(parseFloat(e.target.value))}
              className="w-full accent-primary cursor-pointer"
              disabled={isLaunched}
            />
          </div>
          
          <div>
             <label className="text-xs font-mono text-outline block mb-1">Target Orbit</label>
             <select 
               value={targetOrbit} 
               onChange={(e) => setTargetOrbit(e.target.value)}
               className="w-full bg-[#0a0a0a] border border-outline/50 rounded p-1 text-xs font-mono focus:border-primary outline-none cursor-pointer"
               disabled={isLaunched}
             >
               <option value="LEO">Low Earth Orbit</option>
               <option value="Lunar">Lunar Transfer</option>
               <option value="Mars">Mars Transfer</option>
             </select>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-outline/20">
            <input 
              type="checkbox" 
              id="nbody-toggle" 
              checked={nbody} 
              onChange={(e) => setNbody(e.target.checked)}
              className="accent-primary cursor-pointer"
              disabled={isLaunched}
            />
            <label htmlFor="nbody-toggle" className="text-xs font-mono text-outline cursor-pointer">Enable N-Body Perturbations (Deep Space)</label>
          </div>

          <button 
            className={`w-full py-2 bg-primary/20 border border-primary/50 rounded font-label-caps tracking-[0.15em] text-xs transition-colors mt-2 ${isLaunched ? 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50 cursor-pointer hover:bg-yellow-500/30' : 'text-primary hover:bg-primary/30 cursor-pointer'}`}
            onClick={isLaunched ? () => window.location.reload() : onLaunch}
          >
             {isLaunched ? 'RESET SIMULATION' : 'SIMULATE LAUNCH'}
          </button>

          {missionStatus && missionStatus.includes('ORBIT') && (
            <div className="pt-2 border-t border-outline/20 flex flex-col gap-2">
              <button 
                onClick={onPlanReturn}
                className="w-full py-2 bg-orange-600/20 border border-orange-500/50 hover:bg-orange-600/30 text-orange-400 rounded font-label-caps tracking-[0.15em] text-[10px] transition-all"
              >
                Plan return window → Earth
              </button>
              
              {returnWindow && (
                <div className="bg-black/40 p-2 rounded border border-white/10 flex flex-col gap-2">
                  <div className="text-[9px] font-mono text-white/50 uppercase tracking-tighter">
                    Optimal Window: <span className="text-white">{returnWindow.tof_days} Days TOF</span>
                  </div>
                  <div className="text-[9px] font-mono text-white/50 uppercase tracking-tighter">
                    Burn Required: <span className="text-white">{returnWindow.dv1_kms.toFixed(2)} KM/S</span>
                  </div>
                  <button 
                    onClick={onApplyReturn}
                    className="w-full py-1.5 bg-cyan-600/20 border border-cyan-500/50 hover:bg-cyan-600/30 text-cyan-400 rounded font-mono text-[9px] uppercase tracking-widest"
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
