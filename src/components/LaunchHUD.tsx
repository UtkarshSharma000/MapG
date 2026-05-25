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
      <div ref={nodeRef} className="fixed left-8 bottom-8 w-80 glass-panel border-white/10 rounded-lg p-6 text-white z-40 pointer-events-auto shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col">
        
        {/* Panel Header */}
        <div className="vab-drag-handle flex justify-between items-center cursor-move border-b border-white/10 pb-3 mb-6 select-none">
          <h3 className="font-label-caps text-[10px] tracking-[0.2em] text-primary flex items-center gap-1.5">
            LAUNCH CONTROL DECK
          </h3>
          <Move className="w-3.5 h-3.5 text-white/40 cursor-grab hover:text-white" />
        </div>
        
        <div className="space-y-6">
          
          {/* Planet Navigation Lock Controller */}
          <div className="flex flex-col gap-2">
            <label htmlFor="nav-target-select" className="text-[9px] font-label-caps text-white/40 uppercase tracking-[0.2em] cursor-pointer">
              Navigation Target
            </label>
            <div className="flex gap-2">
              <select 
                id="nav-target-select"
                value={tempSelectedPlanet} 
                onChange={(e) => setTempSelectedPlanet(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded p-2 text-xs font-data-lg text-white focus:border-secondary outline-none cursor-pointer hover:border-white/20 transition-colors"
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
                className="px-4 bg-secondary/10 hover:bg-secondary/25 border border-secondary/40 hover:border-secondary text-secondary rounded transition-colors flex items-center justify-center cursor-pointer"
              >
                <Compass className="w-4 h-4 animate-spin-slow" />
              </button>
            </div>
            
            <button
              onClick={handleLockTarget}
              className="w-full py-2 mt-1 bg-secondary/5 hover:bg-secondary/15 border border-secondary/20 hover:border-secondary/40 text-[9px] font-label-caps tracking-[0.2em] text-secondary rounded transition-all cursor-pointer uppercase flex items-center justify-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse glow-cyan"></span>
              Synchronize Target
            </button>
          </div>

          {/* Primary Ignition Trigger Button */}
          <button 
            className={`w-full py-3 rounded border font-label-caps tracking-[0.2em] text-[10px] transition-all cursor-pointer ${isLaunched ? 'text-error hover:text-red-300 border-error/40 bg-error/10 hover:bg-error/20' : (isCalculatingLaunchPhase ? 'text-primary border-primary/40 bg-primary/10' : 'text-secondary hover:text-white border-secondary/40 bg-secondary/10 hover:bg-secondary/25 glow-cyan')}`}
            onClick={isLaunched ? handleReset : onLaunch}
            disabled={isCalculatingLaunchPhase}
          >
             {isLaunched ? 'ABORT TRACKING' : isCalculatingLaunchPhase ? 'RESOLVING CONFLICTS...' : 'INITIATE IGNITION'}
          </button>

          {/* Mission Archive Controls */}
          {isLaunched && missionStatus === 'EARTH_ORBIT' && onConcludeMission && (
            <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
              <button 
                onClick={onConcludeMission}
                className="w-full py-3 bg-tertiary-container/20 border border-tertiary/40 hover:bg-tertiary-container/30 text-tertiary hover:text-white rounded font-label-caps tracking-[0.2em] text-[9px] uppercase transition-all cursor-pointer"
              >
                SUCCESS: ARCHIVE LOGS
              </button>
            </div>
          )}

          {/* Planetary Return Planner UI and Actions */}
          {missionStatus && missionStatus.includes('ORBIT') && missionStatus !== 'EARTH_ORBIT' && (
            <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
              <button 
                onClick={onPlanReturn}
                className="w-full py-2.5 bg-primary/10 border border-primary/40 hover:bg-primary/20 text-primary hover:text-white rounded font-label-caps tracking-[0.2em] text-[9px] uppercase transition-all cursor-pointer glow-orange"
              >
                Plan Earth Return
              </button>
              
              {returnWindow && (
                <div className="bg-black/40 p-4 rounded border border-white/10 flex flex-col gap-3 transition-all duration-300">
                  <div className="flex justify-between border-b border-white/5 pb-2 text-[9px] font-label-caps text-white/50 uppercase tracking-[0.2em]">
                    <span>Optimal Window:</span> 
                    <span className="text-white">{returnWindow.tof_days} Days</span>
                  </div>
                  <div className="flex justify-between pb-2 text-[9px] font-label-caps text-white/50 uppercase tracking-[0.2em]">
                    <span>Burn Required:</span> 
                    <span className="text-white">{returnWindow.dv1_kms.toFixed(2)} KM/S</span>
                  </div>
                  <button 
                    onClick={onApplyReturn}
                    className="w-full py-2 bg-secondary/20 border border-secondary/50 hover:bg-secondary/30 text-secondary rounded font-label-caps text-[9px] uppercase tracking-[0.2em] cursor-pointer glow-cyan"
                  >
                    Execute TEI
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
