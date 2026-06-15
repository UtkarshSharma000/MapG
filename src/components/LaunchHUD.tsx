import React, { useRef, useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import { Move } from 'lucide-react';
import { motion } from 'motion/react';
import { TextShimmer } from '@/components/motion-primitives/text-shimmer';

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
  const [isCalculatingLaunchPhase, setIsCalculatingLaunchPhase] = useState(false);
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('LaunchHUD_pos');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  const onDragStop = (e: any, data: any) => {
    const newPos = { x: data.x, y: data.y };
    setPosition(newPos);
    localStorage.setItem('LaunchHUD_pos', JSON.stringify(newPos));
  };

  const onLaunch = () => {
    onSimulateLaunch();
  };

  const handleReset = () => {
    onResetSimulation();
  };

  if (missionStatus === undefined) {
    console.error('LaunchHUD: missionStatus prop is required');
    return (
      <div className="fixed bottom-4 left-4 bg-red-950/80 p-2 text-white text-[10px] font-mono border border-red-500 rounded z-[100]">
        LaunchHUD: missing props
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed z-40 pointer-events-auto"
      style={{ left: 32, bottom: 32 }}
    >
      <Draggable nodeRef={nodeRef} handle=".vab-drag-handle" position={position} onStop={onDragStop}>
        <div 
          ref={nodeRef} 
          className="w-[340px] bg-[#07131e]/95 border border-cyan-400/20 rounded-2xl p-6 text-white shadow-[0_0_30px_rgba(30,130,246,0.15)] flex flex-col"
        >
          {/* Panel Header */}
          <div className="vab-drag-handle flex justify-between items-center cursor-move border-b border-cyan-500/20 pb-3 mb-6 select-none">
            <h3 className="font-mono text-[10px] tracking-[0.2em] text-cyan-100 flex items-center gap-1.5 uppercase">
              Launch Control Deck
            </h3>
            <Move className="w-3.5 h-3.5 text-cyan-200/40 cursor-grab hover:text-cyan-100" />
          </div>
        
          <div className="space-y-6">

            {/* Primary Ignition Trigger Button */}
            <button 
              className={`w-full py-4 rounded-xl border font-mono tracking-widest text-[11px] uppercase transition-all shadow-[inset_0_0_20px_rgba(59,130,246,0.15)] cursor-pointer ${isLaunched ? 'text-[#ffb4ab] hover:text-red-300 border-[#ffb4ab]/40 bg-red-500/10 hover:bg-red-500/20 shadow-[inset_0_0_20px_rgba(255,100,100,0.1)]' : (isCalculatingLaunchPhase ? 'text-cyan-300 border-cyan-400/40 bg-cyan-700/20' : 'text-cyan-50 hover:text-white border-cyan-300/40 bg-cyan-600/20 hover:bg-cyan-500/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.2)]')}`}
              onClick={isLaunched ? handleReset : onLaunch}
              disabled={isCalculatingLaunchPhase}
            >
               {isLaunched ? 'ABORT FLIGHT PATH' : isCalculatingLaunchPhase ? (
                 <TextShimmer duration={1.5} className="[--base-color:var(--color-cyan-300)] [--base-gradient-color:var(--color-cyan-100)]">
                   COMPUTING TRAJECTORY...
                 </TextShimmer>
               ) : 'ENGAGE FLIGHT PATH'}
            </button>

            {/* Mission Archive Controls */}
            {isLaunched && missionStatus === 'EARTH_ORBIT' && onConcludeMission && (
              <div className="pt-4 border-t border-cyan-500/20 flex flex-col gap-2">
                <button 
                  onClick={onConcludeMission}
                  className="w-full py-3 bg-cyan-500/10 border border-cyan-400/30 hover:bg-cyan-500/20 text-cyan-200 hover:text-white rounded-lg font-mono tracking-widest text-[9px] uppercase transition-all shadow-[inset_0_0_10px_rgba(59,130,246,0.1)] cursor-pointer"
                >
                  SUCCESS: SAVE FLIGHT RESULTS
                </button>
              </div>
            )}

            {/* Planetary Return Planner UI and Actions */}
            {missionStatus && missionStatus.includes('ORBIT') && missionStatus !== 'EARTH_ORBIT' && (
              <div className="pt-4 border-t border-cyan-500/20 flex flex-col gap-3">
                <button 
                  onClick={onPlanReturn}
                  className="w-full py-3 bg-cyan-400/10 border border-cyan-300/30 hover:bg-cyan-400/20 text-cyan-100 hover:text-white rounded-lg font-mono tracking-widest text-[10px] uppercase transition-all shadow-[inset_0_0_10px_rgba(59,130,246,0.1)] cursor-pointer"
                >
                  PLAN RETURN TO EARTH
                </button>
                
                {returnWindow && (
                  <div className="bg-[#07131e]/50 p-4 rounded-xl border border-cyan-500/20 flex flex-col gap-3 transition-all duration-300 shadow-inner">
                    <div className="flex justify-between border-b border-cyan-500/20 pb-2 text-[9px] font-mono text-cyan-200/60 uppercase tracking-[0.2em]">
                      <span>BEST FLIGHT TIME:</span> 
                      <span className="text-cyan-100">{returnWindow.tof_days} DAYS</span>
                    </div>
                    <div className="flex justify-between pb-2 text-[9px] font-mono text-cyan-200/60 uppercase tracking-[0.2em]">
                      <span>SPEED CHANGE NEEDED:</span> 
                      <span className="text-cyan-100">{returnWindow.dv1_kms.toFixed(2)} KM/S</span>
                    </div>
                    <button 
                      onClick={onApplyReturn}
                      className="w-full py-2.5 bg-cyan-500/20 border border-cyan-400/30 hover:bg-cyan-500/30 text-cyan-50 rounded-lg font-mono text-[9px] uppercase tracking-widest shadow-[inset_0_0_10px_rgba(59,130,246,0.2)] cursor-pointer transition-colors"
                    >
                      ENGAGE RETURN FLIGHT
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Scale warning */}
            <div className="pt-2 flex items-center justify-center gap-1.5 text-[8px] font-mono text-cyan-200/40 tracking-widest uppercase">
              <span>* WARNING: CELESTIAL MODELS NOT TO SCALE</span>
            </div>

          </div>
        </div>
      </Draggable>
    </motion.div>
  );
}
