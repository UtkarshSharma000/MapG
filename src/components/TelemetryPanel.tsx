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
    <div className="absolute top-4 left-4 p-4 rounded-xl border border-outline bg-surface/80 backdrop-blur-md text-on-surface w-72 pointer-events-auto">
      <h3 className="font-heading font-medium text-lg uppercase mb-3 flex items-center justify-between">
        Live Telemetry
        <div className="flex items-center gap-2">
          {telemetry?.time ? (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]"></span>
          )}
        </div>
      </h3>

      {!telemetry?.time ? (
        <div className="text-sm font-mono text-outline">
          Waiting for engine...
        </div>
      ) : (
        <div className="space-y-4 font-mono text-xs">
          <div>
            <div className="text-outline text-[10px] tracking-widest uppercase mb-1">
              State Vector [r]
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>X: {telemetry.x.toFixed(2)}</div>
              <div>Y: {telemetry.y.toFixed(2)}</div>
              <div>Z: {telemetry.z.toFixed(2)}</div>
            </div>
          </div>
          <div>
            <div className="text-outline text-[10px] tracking-widest uppercase mb-1">
              State Vector [v]
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>Vx: {telemetry.vx.toFixed(4)}</div>
              <div>Vy: {telemetry.vy.toFixed(4)}</div>
              <div>Vz: {telemetry.vz.toFixed(4)}</div>
            </div>
          </div>
          <div className="pt-2 border-t border-outline/30">
            <div className="text-outline text-[10px] tracking-widest uppercase mb-1">
              Ground Station (Delhi)
            </div>
            <div className="flex justify-between">
              <span>Range:</span>
              <span className="text-primary">
                {telemetry.delhi_range_km.toFixed(1)} km
              </span>
            </div>
            <div className="flex justify-between">
              <span>Elevation:</span>
              <span
                className={
                  telemetry.delhi_elevation_deg > 0
                    ? "text-green-400"
                    : "text-red-400"
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
