import React, { useRef, useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import { Move, Compass } from 'lucide-react';
import { OptimizeResult } from '../TrajectoryOptimizer';

interface LaunchHUDProps {
  onSimulateLaunch: () => void;
  onResetSimulation: () => void;
  isLaunched: boolean;
  missionStatus?: string;
  onPlanReturn?: () => void;
  returnWindow?: { tof_days: number; dv1_kms: number; legs?: any[] } | null;
  onApplyReturn?: () => void;
  onConcludeMission?: () => void;
  selectedTarget: any;
  setSelectedTarget: (target: any) => void;
  planets: any[];
}

export function LaunchHUD({
  onSimulateLaunch,
  onResetSimulation,
  isLaunched,
  missionStatus,
  onPlanReturn,
  returnWindow,
  onApplyReturn,
  onConcludeMission,
  selectedTarget,
  setSelectedTarget,
  planets
}: LaunchHUDProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [tempSelectedPlanet, setTempSelectedPlanet] = useState<string>('Sun');
  const [isCalculatingLaunchPhase, setIsCalculatingLaunchPhase] = useState(false);

  // Keep dropdown selection synchronised with the externally selected planet target
  useEffect(() => {
    setTempSelectedPlanet(selectedTarget?.name || 'Sun');
  }, [selectedTarget]);

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

  const handleLockTarget = () => {
    if (tempSelectedPlanet === 'Sun') {
      setSelectedTarget(null);
    } else {
      const found = planets.find(p => p.name === tempSelectedPlanet);
      if (found) {
        setSelectedTarget(found);
      }
    }
  };

  if (missionStatus === undefined) {
    console.error('LaunchHUD: missionStatus prop is required');
    return (
      <div className="fixed bottom-4 left-4 bg-red-900/80 p-2 text-white text-[10px] font-mono border border-red-500 rounded z-[100]">
        LaunchHUD: missing props
      </div>
    );
  }

  return (
    <Draggable nodeRef={nodeRef} handle=".vab-drag-handle">
      <div ref={nodeRef} className="fixed left-8 bottom-24 w-80 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 text-white z-40 pointer-events-auto shadow-2xl flex flex-col glossy-panel">
        
        {/* Panel Header */}
        <div className="vab-drag-handle flex justify-between items-center cursor-move border-b border-white/10 pb-3 mb-4 select-none">
          <h3 className="font-sans font-medium text-xs tracking-widest uppercase text-primary flex items-center gap-1.5">
            LAUNCH CONTROL DECK
          </h3>
          <Move className="w-3.5 h-3.5 text-white/40 cursor-grab" />
        </div>
        
        <div className="space-y-4">
          
          {/* Planet Navigation Lock Controller */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-white/50 uppercase tracking-wider">
              Navigation Target
            </label>
            <div className="flex gap-2">
              <select 
                value={tempSelectedPlanet} 
                onChange={(e) => setTempSelectedPlanet(e.target.value)}
                className="flex-1 bg-[#050505] border border-white/10 rounded-lg p-2 text-xs font-mono text-white focus:border-cyan-400 outline-none cursor-pointer hover:border-white/20 transition-colors"
                disabled={isLaunched}
              >
                <option value="Sun">Central Sol (Sun)</option>
                {planets.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name.toUpperCase()}
                  </option>
                ))}
              </select>
              
              <button
                onClick={handleLockTarget}
                title="Telemetry Lock on selected planet camera"
                className="px-3.5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/40 hover:border-cyan-400 text-cyan-400 rounded-lg text-xs transition-colors flex items-center justify-center cursor-pointer"
                disabled={isLaunched}
              >
                <Compass className="w-4 h-4 animate-spin-slow" />
              </button>
            </div>
            
            <button
              onClick={handleLockTarget}
              className="w-full py-1.5 mt-1 bg-cyan-500/5 hover:bg-cyan-500/15 border border-cyan-500/20 hover:border-cyan-500/40 text-[9px] font-mono tracking-widest text-cyan-400 rounded-lg transition-all cursor-pointer uppercase flex items-center justify-center gap-1.5"
              disabled={isLaunched}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              Lock Onto Planet Directly
            </button>
          </div>

          <div className="h-px bg-white/10 w-full my-1"></div>

          {/* Primary Ignition Trigger Button */}
          <button 
            className={`w-full py-2.5 rounded-lg border font-semibold tracking-widest text-xs transition-all glossy-button cursor-pointer ${isLaunched ? 'text-red-400 hover:text-red-300 border-red-500/40 bg-red-500/10 hover:bg-red-500/20' : (isCalculatingLaunchPhase ? 'text-orange-400 border-orange-500/40 bg-orange-500/10' : 'text-cyan-400 hover:text-cyan-300 border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/25')}`}
            onClick={isLaunched ? handleReset : onLaunch}
            disabled={isCalculatingLaunchPhase}
          >
             {isLaunched ? 'ABORT TRACKING' : isCalculatingLaunchPhase ? 'CPP ENGINE: RESOLVING CONFLICTS...' : 'INITIATE ENGINE IGNITION'}
          </button>

          {/* Mission Archive Controls */}
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

          {/* Planetary Return Planner UI and Actions */}
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
