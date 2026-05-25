import React, { useEffect, useState } from "react";

export function TelemetryPanel() {
  const [telemetry, setTelemetry] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/telemetry")
        .then((res) => res.json())
        .then((data) => setTelemetry(data))
        .catch((err) => console.error("Failed to fetch telemetry", err));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed top-36 left-8 p-6 rounded-lg border border-white/10 glass-panel shadow-[0_0_40px_rgba(0,0,0,0.5)] text-white w-72 pointer-events-auto z-40 flex flex-col">
      <div className="mb-6">
        <div className="font-label-caps text-[9px] text-white/40 tracking-[0.2em] mb-1">CRAFT IDENTIFIER</div>
        <div className="font-headline-md text-white text-xl">SATELLITE-01</div>
        <div className="flex items-center gap-2 mt-2">
          <span className="px-1.5 py-0.5 rounded-sm bg-secondary/10 text-secondary text-[8px] font-bold border border-secondary/20 uppercase">
            {telemetry?.time ? "TELEMETRY LINKED" : "ACQUIRING..."}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${telemetry?.time ? 'bg-secondary glow-cyan animate-pulse' : 'bg-red-500 animate-pulse'}`}></span>
        </div>
      </div>

      {!telemetry?.time ? (
        <div className="text-xs font-label-caps tracking-widest text-white/40 mt-4">
          Syncing with spacecraft transponder...
        </div>
      ) : (
        <div className="space-y-6 flex-1">
          <div>
            <label className="font-label-caps text-[9px] text-white/30 block mb-2 tracking-[0.2em]">HELIOCENTRIC [R]</label>
            <div className="flex justify-between items-baseline border-b border-white/5 pb-1">
              <span className="font-label-caps text-[9px] text-white/30">X</span>
              <span className="font-data-lg text-lg text-white">{telemetry.x.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline border-b border-white/5 py-1">
              <span className="font-label-caps text-[9px] text-white/30">Y</span>
              <span className="font-data-lg text-lg text-white">{telemetry.y.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline py-1">
              <span className="font-label-caps text-[9px] text-white/30">Z</span>
              <span className="font-data-lg text-lg text-white">{telemetry.z.toFixed(2)}</span>
            </div>
          </div>
          
          <div>
            <label className="font-label-caps text-[9px] text-white/30 block mb-2 tracking-[0.2em]">VELOCITY [V]</label>
            <div className="flex justify-between items-baseline border-b border-white/5 pb-1">
              <span className="font-label-caps text-[9px] text-white/30">Vx</span>
              <span className="font-data-lg text-lg text-white">{telemetry.vx.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-baseline border-b border-white/5 py-1">
              <span className="font-label-caps text-[9px] text-white/30">Vy</span>
              <span className="font-data-lg text-lg text-white">{telemetry.vy.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-baseline py-1">
              <span className="font-label-caps text-[9px] text-white/30">Vz</span>
              <span className="font-data-lg text-lg text-white">{telemetry.vz.toFixed(4)}</span>
            </div>
          </div>

          <div>
            <label className="font-label-caps text-[9px] text-white/30 block mb-2 tracking-[0.2em]">SIGNAL LOAD</label>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-secondary glow-cyan" style={{ width: `${Math.max(20, Math.min(100, (telemetry.delhi_elevation_deg / 90) * 100))}%` }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
