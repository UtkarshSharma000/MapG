import React, { useState, useRef } from "react";
import Draggable from "react-draggable";
import { X, Map, Target, Crosshair } from "lucide-react";

export function Planet2DMap({ planetName, onClose, onSelectLocation }: any) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [launchPoint, setLaunchPoint] = useState<{lat: number, lon: number, x: number, y: number} | null>(null);
  const [targetPoint, setTargetPoint] = useState<{lat: number, lon: number, x: number, y: number} | null>(null);

  const nodeRef = useRef<HTMLDivElement>(null);

  const handleMapClick = (e: React.MouseEvent, clickType: "launch" | "target") => {
    e.preventDefault();
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate Lat/Lon assuming simple equirectangular projection
    const lon = (x / rect.width) * 360 - 180;
    const lat = 90 - (y / rect.height) * 180;
    
    if (clickType === "launch") {
      setLaunchPoint({ lat, lon, x, y });
    } else {
      setTargetPoint({ lat, lon, x, y });
    }
    
    if (onSelectLocation) {
      onSelectLocation(clickType, planetName, lat, lon);
    }
  };

  const handlePointerDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      handleMapClick(e, "target");
    } else if (e.button === 2) {
      handleMapClick(e, "launch");
    }
  };

  const getTexture = () => {
    switch (planetName) {
      case "Mercury": return "/textures/2k_mercury.jpg";
      case "Venus": return "/textures/2k_venus_atmosphere.jpg";
      case "Earth": return "/textures/2k_earth_daymap.jpg";
      case "Mars": return "/textures/2k_mars.jpg";
      case "Jupiter": return "/textures/2k_jupiter.jpg";
      case "Saturn": return "/textures/2k_saturn.jpg";
      case "Uranus": return "/textures/2k_uranus.jpg";
      case "Neptune": return "/textures/2k_neptune.jpg";
      default: return "";
    }
  };

  return (
    <Draggable nodeRef={nodeRef} handle=".drag-handle">
      <div ref={nodeRef} className="fixed top-24 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-surface/90 backdrop-blur-md border border-outline rounded-xl shadow-2xl overflow-hidden z-50 pointer-events-auto flex flex-col">
        {/* Header */}
        <div className="drag-handle bg-surface border-b border-outline p-3 flex justify-between items-center cursor-move">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-medium text-lg tracking-widest uppercase">
              {planetName} 2D Topography
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Area */}
        <div className="relative flex-1 bg-[#0a0f1a] overflow-hidden bg-cover bg-center" 
             style={{ backgroundImage: `url(${getTexture()})` }}
             ref={mapRef}
             onPointerDown={handlePointerDown}
             onContextMenu={(e) => e.preventDefault()} // Prevent context menu
        >
          {/* Grid lines */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          
          {/* Equator & Prime Meridian */}
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-primary/30" />
          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-primary/30" />

          {/* Instructions */}
          <div className="absolute top-4 left-4 bg-black/50 p-2 rounded text-xs font-mono text-outline border border-outline/30 pointer-events-none">
            LEFT-CLICK: Set Target | RIGHT-CLICK: Set Launch
          </div>

          {/* Click Marker */}
          {targetPoint && (
            <div 
              className="absolute w-4 h-4 -ml-2 -mt-2 text-primary pointer-events-none"
              style={{ left: targetPoint.x, top: targetPoint.y }}
            >
              <Target className="w-4 h-4 animate-pulse" color="#ff4444" />
            </div>
          )}
          {launchPoint && (
            <div 
              className="absolute w-4 h-4 -ml-2 -mt-2 text-primary pointer-events-none"
              style={{ left: launchPoint.x, top: launchPoint.y }}
            >
              <Crosshair className="w-4 h-4 text-primary animate-spin-slow" />
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-surface border-t border-outline p-2 px-4 flex justify-between items-center text-xs font-mono">
          <span>PROJECTION: EQUIRECTANGULAR</span>
          <div className="flex gap-4">
            {targetPoint ? (
              <span className="text-red-400">
                TARGET LAT: {targetPoint.lat.toFixed(4)}° / LON: {targetPoint.lon.toFixed(4)}°
              </span>
            ) : null}
            {launchPoint ? (
              <span className="text-primary">
                LAUNCH LAT: {launchPoint.lat.toFixed(4)}° / LON: {launchPoint.lon.toFixed(4)}°
              </span>
            ) : null}
            {!targetPoint && !launchPoint && (
              <span className="text-outline">NO COORDINATES SELECTED</span>
            )}
          </div>
        </div>
      </div>
    </Draggable>
  );
}
