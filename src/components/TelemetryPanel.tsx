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
    <div className="fixed top-36 left-8 p-5 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl text-white w-72 pointer-events-auto z-40 shadow-2xl glossy-panel">
      <h3 className="font-sans font-medium text-xs tracking-widest uppercase mb-4 flex items-center justify-between border-b border-white/10 pb-2 text-primary">
        LIVE DIAGNOSTIC TELEMETRY
        <div className="flex items-center gap-2">
          {telemetry?.time ? (
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]"></span>
          )}
        </div>
      </h3>

      {!telemetry?.time ? (
        <div className="text-xs font-mono text-white/40">
          Syncing with spacecraft transponder...
        </div>
      ) : (
        <div className="space-y-4 font-mono text-[11px]">
          <div>
            <div className="text-white/40 text-[9px] tracking-widest uppercase mb-1.5 font-sans">
              HELIOCENTRIC STATE VECTOR [R]
            </div>
            <div className="grid grid-cols-3 gap-2 bg-black/40 p-2 rounded-lg border border-white/5">
              <div><span className="text-white/30">X:</span> {telemetry.x.toFixed(2)}</div>
              <div><span className="text-white/30">Y:</span> {telemetry.y.toFixed(2)}</div>
              <div><span className="text-white/30">Z:</span> {telemetry.z.toFixed(2)}</div>
            </div>
          </div>
          <div>
            <div className="text-white/40 text-[9px] tracking-widest uppercase mb-1.5 font-sans">
              VELOCITY STATE VECTOR [V]
            </div>
            <div className="grid grid-cols-3 gap-2 bg-black/40 p-2 rounded-lg border border-white/5">
              <div><span className="text-white/30">Vx:</span> {telemetry.vx.toFixed(4)}</div>
              <div><span className="text-white/30">Vy:</span> {telemetry.vy.toFixed(4)}</div>
              <div><span className="text-white/30">Vz:</span> {telemetry.vz.toFixed(4)}</div>
            </div>
          </div>
          <div className="pt-3 border-t border-white/10">
            <div className="text-white/40 text-[9px] tracking-widest uppercase mb-2 font-sans">
              GROUND STATION TRANSCEIVER (DELHI)
            </div>
            <div className="flex justify-between py-1 px-1 bg-black/20 rounded">
              <span className="text-white/50">Current Range:</span>
              <span className="text-cyan-400 font-bold">
                {telemetry.delhi_range_km.toLocaleString('en-US', { maximumFractionDigits: 1 })} km
              </span>
            </div>
            <div className="flex justify-between py-1 px-1 mt-1 bg-black/20 rounded">
              <span className="text-white/50">Horizon Elev:</span>
              <span
                className={
                  telemetry.delhi_elevation_deg > 0
                    ? "text-cyan-400 font-bold"
                    : "text-red-400 font-bold"
                }
              >
                {telemetry.delhi_elevation_deg.toFixed(2)}°
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
