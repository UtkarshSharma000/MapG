import React, { useRef, useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import { Move, Compass } from 'lucide-react';
import { motion } from 'motion/react';
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
    setIsCalculatingLaunchPhase(true);
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
    return (
      <div className="fixed bottom-4 left-4 bg-red-100 p-2 text-red-900 text-[10px] font-mono border border-red-500 rounded z-[100]">
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
          className="w-80 solid-panel border-gray-200 bg-white rounded-lg p-6 text-gray-900 shadow-md flex flex-col"
        >
          {/* Panel Header */}
          <div className="vab-drag-handle flex justify-between items-center cursor-move border-b border-gray-200 pb-3 mb-6 select-none">
          <h3 className="font-label-caps text-[10px] tracking-widest text-blue-700 flex items-center gap-1.5 uppercase font-bold">
            Rocket Controls
          </h3>
          <Move className="w-3.5 h-3.5 text-gray-400 cursor-grab hover:text-gray-700" />
        </div>
        
        <div className="space-y-6">

          {/* Primary Ignition Trigger Button */}
          <button 
            className={`w-full py-3 rounded border font-label-caps tracking-widest text-[10px] transition-all cursor-pointer uppercase font-bold ${isLaunched ? 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100' : (isCalculatingLaunchPhase ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-blue-700 hover:text-gray-900 border-blue-300 bg-blue-100 hover:bg-blue-600')}`}
            onClick={isLaunched ? handleReset : onLaunch}
            disabled={isCalculatingLaunchPhase}
          >
             {isLaunched ? 'Stop Tracking' : isCalculatingLaunchPhase ? 'Calculating...' : 'Launch Rocket'}
          </button>

          {/* Mission Archive Controls */}
          {isLaunched && missionStatus === 'EARTH_ORBIT' && onConcludeMission && (
            <div className="pt-4 border-t border-gray-200 flex flex-col gap-2">
              <button 
                onClick={onConcludeMission}
                className="w-full py-3 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 hover:text-blue-900 rounded font-label-caps tracking-widest text-[9px] uppercase transition-all cursor-pointer font-bold"
              >
                Save To History
              </button>
            </div>
          )}

          {/* Planetary Return Planner UI and Actions */}
          {missionStatus && missionStatus.includes('ORBIT') && missionStatus !== 'EARTH_ORBIT' && (
            <div className="pt-4 border-t border-gray-200 flex flex-col gap-3">
              <button 
                onClick={onPlanReturn}
                className="w-full py-2.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded font-label-caps tracking-widest text-[9px] uppercase transition-all cursor-pointer font-bold"
              >
                Plan Return Trip
              </button>
              
              {returnWindow && (
                <div className="bg-gray-50 p-4 rounded border border-gray-200 flex flex-col gap-3 transition-all duration-300">
                  <div className="flex justify-between border-b border-gray-200 pb-2 text-[9px] font-label-caps text-gray-500 uppercase tracking-widest font-bold">
                    <span>Best Time:</span> 
                    <span className="text-gray-900">{returnWindow.tof_days} Days</span>
                  </div>
                  <div className="flex justify-between pb-2 text-[9px] font-label-caps text-gray-500 uppercase tracking-widest font-bold">
                    <span>Speed Needed:</span> 
                    <span className="text-gray-900">{returnWindow.dv1_kms.toFixed(2)} KM/S</span>
                  </div>
                  <button 
                    onClick={onApplyReturn}
                    className="w-full py-2 bg-blue-100 border border-blue-200 hover:bg-blue-200 text-blue-800 rounded font-label-caps text-[9px] uppercase tracking-widest cursor-pointer font-bold"
                  >
                    Start Return
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Draggable>
  </motion.div>
  );
}
