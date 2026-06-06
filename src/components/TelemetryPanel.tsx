import React, { useEffect, useState, useRef } from "react";
import Draggable from "react-draggable";
import { Move } from "lucide-react";
import { motion } from "motion/react";

export function TelemetryPanel() {
  const [telemetry, setTelemetry] = useState<any>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('TelemetryPanel_pos');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  const onDragStop = (e: any, data: any) => {
    const newPos = { x: data.x, y: data.y };
    setPosition(newPos);
    localStorage.setItem('TelemetryPanel_pos', JSON.stringify(newPos));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/telemetry")
        .then((res) => {
          if (!res.ok) throw new Error("Server not ready");
          return res.json();
        })
        .then((data) => setTelemetry(data))
        .catch((err) => {
          // Silently wait for backend to boot during startup phase without causing console failures
        });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="fixed z-40 pointer-events-auto"
      style={{ left: 32, top: 144 }}
    >
      <Draggable nodeRef={nodeRef} handle=".drag-handle" position={position} onStop={onDragStop}>
        <div 
          ref={nodeRef}
          className="p-6 rounded-lg border border-gray-200 solid-panel shadow-md text-gray-900 w-72 flex flex-col bg-white"
        >
          <div className="mb-6 drag-handle cursor-move select-none relative">
            <div className="absolute top-0 right-0 p-1 opacity-50 hover:opacity-100">
              <Move className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <div className="font-label-caps text-[10px] text-gray-500 tracking-wider mb-1 uppercase">Spacecraft Name</div>
            <div className="font-headline-md text-gray-900 text-xl pr-6 font-bold">SATELLITE-01</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-1.5 py-0.5 rounded-sm bg-blue-100 text-blue-700 text-[8px] font-bold border border-blue-200 uppercase tracking-widest">
                {telemetry?.time ? "CONNECTED" : "CONNECTING..."}
              </span>
              <span className={`w-2 h-2 rounded-full ${telemetry?.time ? 'bg-green-500 animate-pulse' : 'bg-red-500 animate-pulse'}`}></span>
            </div>
          </div>

      {!telemetry?.time ? (
        <div className="text-xs font-label-caps tracking-widest text-gray-500 mt-4">
          Waiting for signal...
        </div>
      ) : (
        <div className="space-y-6 flex-1">
          <div>
            <label className="font-label-caps text-[10px] uppercase text-gray-400 block mb-2 tracking-widest font-bold">Position</label>
            <div className="flex justify-between items-baseline border-b border-gray-100 pb-1">
              <span className="font-label-caps text-[10px] text-gray-500 font-bold">X</span>
              <span className="font-data-lg text-lg text-gray-900">{telemetry.x.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline border-b border-gray-100 py-1">
              <span className="font-label-caps text-[10px] text-gray-500 font-bold">Y</span>
              <span className="font-data-lg text-lg text-gray-900">{telemetry.y.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline py-1">
              <span className="font-label-caps text-[10px] text-gray-500 font-bold">Z</span>
              <span className="font-data-lg text-lg text-gray-900">{telemetry.z.toFixed(2)}</span>
            </div>
          </div>
          
          <div>
            <label className="font-label-caps text-[10px] uppercase text-gray-400 block mb-2 tracking-widest font-bold">Speed</label>
            <div className="flex justify-between items-baseline border-b border-gray-100 pb-1">
              <span className="font-label-caps text-[10px] text-gray-500 font-bold">Vx</span>
              <span className="font-data-lg text-lg text-gray-900">{telemetry.vx.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-baseline border-b border-gray-100 py-1">
              <span className="font-label-caps text-[10px] text-gray-500 font-bold">Vy</span>
              <span className="font-data-lg text-lg text-gray-900">{telemetry.vy.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-baseline py-1">
              <span className="font-label-caps text-[10px] text-gray-500 font-bold">Vz</span>
              <span className="font-data-lg text-lg text-gray-900">{telemetry.vz.toFixed(4)}</span>
            </div>
          </div>

          <div>
            <label className="font-label-caps text-[10px] uppercase text-gray-400 block mb-2 tracking-widest font-bold">Signal Strength</label>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-blue-500" style={{ width: `${Math.max(20, Math.min(100, (telemetry.delhi_elevation_deg / 90) * 100))}%` }}></div>
            </div>
          </div>
        </div>
      )}
        </div>
      </Draggable>
    </motion.div>
  );
}
