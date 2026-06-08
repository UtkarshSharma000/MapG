import React, { useRef, useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import { Move } from 'lucide-react';
import { motion } from 'motion/react';

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
          className="w-80 bg-[#0a0a0c]/95 border border-white/10 rounded-2xl p-6 text-white shadow-2xl backdrop-blur-md flex flex-col"
        >
          {/* Panel Header */}
          <div className="vab-drag-handle flex justify-between items-center cursor-move border-b border-white/10 pb-3 mb-6 select-none">
            <h3 className="font-label-caps text-[10px] tracking-[0.2em] text-[#aaddff] flex items-center gap-1.5">
              LAUNCH CONTROL DECK
            </h3>
            <Move className="w-3.5 h-3.5 text-white/40 cursor-grab hover:text-white" />
          </div>
        
          <div className="space-y-6">

            {/* Primary Ignition Trigger Button */}
            <button 
              className={`w-full py-3 rounded border font-label-caps tracking-[0.2em] text-[10px] transition-all cursor-pointer ${isLaunched ? 'text-[#ffb4ab] hover:text-red-300 border-[#ffb4ab]/30 bg-red-500/5 hover:bg-red-500/10' : (isCalculatingLaunchPhase ? 'text-primary border-primary/40 bg-primary/10' : 'text-white hover:text-white border-white/20 bg-white/5 hover:bg-white/10')}`}
              onClick={isLaunched ? handleReset : onLaunch}
              disabled={isCalculatingLaunchPhase}
            >
               {isLaunched ? 'STOP FLIGHT' : isCalculatingLaunchPhase ? 'CALCULATING ROUTE...' : 'START FLIGHT'}
            </button>

            {/* Mission Archive Controls */}
            {isLaunched && missionStatus === 'EARTH_ORBIT' && onConcludeMission && (
              <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
                <button 
                  onClick={onConcludeMission}
                  className="w-full py-3 bg-[#59d5fb]/5 border border-[#59d5fb]/30 hover:bg-[#59d5fb]/10 text-[#59d5fb] hover:text-white rounded font-label-caps tracking-[0.2em] text-[9px] uppercase transition-all cursor-pointer"
                >
                  SUCCESS: SAVE FLIGHT RESULTS
                </button>
              </div>
            )}

            {/* Planetary Return Planner UI and Actions */}
            {missionStatus && missionStatus.includes('ORBIT') && missionStatus !== 'EARTH_ORBIT' && (
              <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                <button 
                  onClick={onPlanReturn}
                  className="w-full py-2.5 bg-[#aaddff]/10 border border-[#aaddff]/40 hover:bg-[#aaddff]/20 text-[#aaddff] hover:text-white rounded font-label-caps tracking-[0.2em] text-[9px] uppercase transition-all cursor-pointer"
                >
                  Plan Return To Earth
                </button>
                
                {returnWindow && (
                  <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex flex-col gap-3 transition-all duration-300">
                    <div className="flex justify-between border-b border-white/5 pb-2 text-[9px] font-label-caps text-white/50 uppercase tracking-[0.2em]">
                      <span>Best Flight Time:</span> 
                      <span className="text-white">{returnWindow.tof_days} Days</span>
                    </div>
                    <div className="flex justify-between pb-2 text-[9px] font-label-caps text-white/50 uppercase tracking-[0.2em]">
                      <span>Speed Change Needed:</span> 
                      <span className="text-white">{returnWindow.dv1_kms.toFixed(2)} KM/S</span>
                    </div>
                    <button 
                      onClick={onApplyReturn}
                      className="w-full py-2 bg-white/10 border border-white/25 hover:bg-white/20 text-white rounded font-label-caps text-[9px] uppercase tracking-[0.2em] cursor-pointer"
                    >
                      Fly Back To Earth
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Scale warning */}
            <div className="pt-4 border-t border-white/5 flex items-center justify-center gap-1.5 text-[8px] font-mono text-white/40 tracking-wider">
              <span className="w-1 h-1 rounded-full bg-white/30 animate-pulse"></span>
              <span>WARNING: CELESTIAL MODELS NOT TO SCALE</span>
            </div>

          </div>
        </div>
      </Draggable>
    </motion.div>
  );
}
