import React, { useRef, useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import { Move, Compass } from 'lucide-react';

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

  const timeoutRef = useRef<any>(null);

  const status = missionStatus ?? 'STANDBY';

  // sync dropdown with external state
  useEffect(() => {
    setTempSelectedPlanet(selectedTarget?.name ?? 'Sun');
  }, [selectedTarget]);

  // cleanup timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const onLaunch = () => {
    setIsCalculatingLaunchPhase(true);

    timeoutRef.current = setTimeout(() => {
      setIsCalculatingLaunchPhase(false);
      onSimulateLaunch();
    }, 3500);
  };

  const handleLockTarget = () => {
    if (tempSelectedPlanet === 'Sun') {
      setSelectedTarget(null);
      return;
    }

    const found = planets.find(
      p => p.name?.toLowerCase() === tempSelectedPlanet.toLowerCase()
    );

    if (found) {
      setSelectedTarget(found);
    }
  };

  const handleReset = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsCalculatingLaunchPhase(false);
    onResetSimulation();
  };

  return (
    <Draggable nodeRef={nodeRef} handle=".vab-drag-handle">
      <div
        ref={nodeRef}
        className="fixed left-8 bottom-24 w-80 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 text-white z-40 pointer-events-auto shadow-2xl flex flex-col glossy-panel"
      >

        {/* HEADER */}
        <div className="vab-drag-handle flex justify-between items-center cursor-move border-b border-white/10 pb-3 mb-4 select-none">
          <h3 className="font-sans font-medium text-xs tracking-widest uppercase text-primary flex items-center gap-1.5">
            LAUNCH CONTROL DECK
          </h3>
          <Move className="w-3.5 h-3.5 text-white/40 cursor-grab" />
        </div>

        <div className="space-y-4">

          {/* TARGET SELECT */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-white/50 uppercase tracking-wider">
              Navigation Target
            </label>

            <div className="flex gap-2">
              <select
                value={tempSelectedPlanet}
                onChange={(e) => setTempSelectedPlanet(e.target.value)}
                disabled={isLaunched}
                className="flex-1 bg-[#050505] border border-white/10 rounded-lg p-2 text-xs font-mono text-white cursor-pointer"
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
                disabled={isLaunched}
                className="px-3.5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-400 rounded-lg text-xs"
              >
                <Compass className="w-4 h-4 animate-spin-slow" />
              </button>
            </div>

            <button
              onClick={handleLockTarget}
              disabled={isLaunched}
              className="w-full py-1.5 mt-1 bg-cyan-500/5 hover:bg-cyan-500/15 border border-cyan-500/20 text-[9px] font-mono tracking-widest text-cyan-400 rounded-lg uppercase"
            >
              Lock Onto Planet Directly
            </button>
          </div>

          <div className="h-px bg-white/10 w-full my-1" />

          {/* MAIN ACTION */}
          <button
            onClick={isLaunched ? handleReset : onLaunch}
            disabled={isCalculatingLaunchPhase}
            className={`w-full py-2.5 rounded-lg border text-xs font-semibold tracking-widest transition-all
              ${isLaunched
                ? 'text-red-400 border-red-500/40 bg-red-500/10'
                : isCalculatingLaunchPhase
                  ? 'text-orange-400 border-orange-500/40 bg-orange-500/10'
                  : 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10'
              }`}
          >
            {isLaunched
              ? 'ABORT TRACKING'
              : isCalculatingLaunchPhase
                ? 'ENGINE: RESOLVING CONFLICTS...'
                : 'INITIATE ENGINE IGNITION'}
          </button>

          {/* CONCLUDE MISSION */}
          {isLaunched && status === 'EARTH_ORBIT' && onConcludeMission && (
            <button
              onClick={onConcludeMission}
              className="w-full py-2 bg-green-500/15 border border-green-500/40 text-green-400 rounded-lg text-[9px] font-mono uppercase tracking-widest"
            >
              ✓ CONCLUDE MISSION & ARCHIVE
            </button>
          )}

          {/* RETURN SYSTEM */}
          {status.includes('ORBIT') && status !== 'EARTH_ORBIT' && (
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">

              <button
                onClick={onPlanReturn}
                className="w-full py-2 bg-orange-500/10 border border-orange-500/40 text-orange-400 rounded-lg text-[9px] font-mono uppercase"
              >
                Plan return window → Earth
              </button>

              {returnWindow && (
                <div className="bg-black/60 p-3 rounded-lg border border-white/10 flex flex-col gap-2">

                  <div className="flex justify-between text-[9px] font-mono text-white/60">
                    <span>TOF</span>
                    <span className="text-white font-bold">{returnWindow.tof_days} days</span>
                  </div>

                  <div className="flex justify-between text-[9px] font-mono text-white/60">
                    <span>ΔV</span>
                    <span className="text-white font-bold">{returnWindow.dv1_kms.toFixed(2)} km/s</span>
                  </div>

                  <button
                    onClick={onApplyReturn}
                    className="w-full py-1.5 bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 rounded-lg text-[9px] font-mono uppercase"
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