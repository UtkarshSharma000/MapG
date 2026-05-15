import React, { useState, useEffect } from "react";

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
  setTargetOrbit
}: any) {
  return (
    <div className="fixed right-4 bottom-24 w-72 bg-surface/80 backdrop-blur-md border border-outline rounded-xl p-4 text-on-surface z-40 pointer-events-auto">
      <h3 className="font-heading font-medium text-lg uppercase mb-4 tracking-wider border-b border-outline/30 pb-2">VAB Launch Profile</h3>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-mono text-outline">Initial Velocity (v0)</label>
            <span className="text-xs font-mono text-primary">{v0.toFixed(1)} km/s</span>
          </div>
          <input 
            type="range" min="0" max="25" step="0.1" 
            value={v0} onChange={(e) => setV0(parseFloat(e.target.value))}
            className="w-full accent-primary"
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
            className="w-full accent-primary"
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
            className="w-full accent-primary"
          />
        </div>
        
        <div>
           <label className="text-xs font-mono text-outline block mb-1">Target Orbit</label>
           <select 
             value={targetOrbit} 
             onChange={(e) => setTargetOrbit(e.target.value)}
             className="w-full bg-[#0a0a0a] border border-outline/50 rounded p-1 text-xs font-mono focus:border-primary outline-none"
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
            className="accent-primary"
          />
          <label htmlFor="nbody-toggle" className="text-xs font-mono text-outline">Enable N-Body Perturbations (Deep Space)</label>
        </div>

        <button className="w-full py-2 bg-primary/20 text-primary border border-primary/50 rounded font-label-caps tracking-[0.15em] text-xs hover:bg-primary/30 transition-colors mt-2">
           SIMULATE LAUNCH
        </button>
      </div>
    </div>
  );
}
