import React, { useState, useRef } from "react";
import Draggable from "react-draggable";
import { X, Map, Target, Crosshair } from "lucide-react";

export function Planet2DMap({ planetName, onClose, onSelectLocation, launchPlanet, targetPlanet, launchLocation, targetLocation }: any) {
  const mapRef = useRef<HTMLDivElement>(null);
  
  // Use passed down locations if they match the current planet
  const initialLaunch = launchPlanet === planetName && launchLocation ? launchLocation : null;
  const initialTarget = targetPlanet === planetName && targetLocation ? targetLocation : null;

  const [launchPoint, setLaunchPoint] = useState<{lat: number, lon: number} | null>(initialLaunch);
  const [targetPoint, setTargetPoint] = useState<{lat: number, lon: number} | null>(initialTarget);

  const nodeRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('Planet2DMap_pos');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  const onDragStop = (e: any, data: any) => {
    const newPos = { x: data.x, y: data.y };
    setPosition(newPos);
    localStorage.setItem('Planet2DMap_pos', JSON.stringify(newPos));
  };

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
      setLaunchPoint({ lat, lon });
    } else {
      setTargetPoint({ lat, lon });
    }
    
    if (onSelectLocation) {
      onSelectLocation(clickType, planetName, lat, lon);
    }
  };

  const handlePointerDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // left click = target
      // Enforce setting launch first
      if (!launchPlanet) {
        alert("Please set a launch location first (Right-Click on a planet's map).");
        return;
      }
      // Prevent launch and target on same planet
      if (launchPlanet === planetName) {
        alert("Target planet cannot be the same as launch planet.");
        return;
      }
      handleMapClick(e, "target");
    } else if (e.button === 2) { // right click = launch
      if (targetPlanet === planetName) {
        alert("Launch planet cannot be the same as target planet.");
        return;
      }
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
    <Draggable nodeRef={nodeRef} handle=".drag-handle" position={position} onStop={onDragStop}>
      <div 
        ref={nodeRef} 
        style={{ position: 'fixed', left: 'calc(50vw - 400px)', top: '96px' }}
        className="w-[800px] h-[500px] bg-surface/90 backdrop-blur-md border border-outline rounded-xl shadow-2xl overflow-hidden z-50 pointer-events-auto flex flex-col"
      >
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
              style={{ left: `${(targetPoint.lon + 180) / 360 * 100}%`, top: `${(90 - targetPoint.lat) / 180 * 100}%` }}
            >
              <Target className="w-4 h-4 animate-pulse" color="#ff4444" />
            </div>
          )}
          {launchPoint && (
            <div 
              className="absolute w-4 h-4 -ml-2 -mt-2 text-primary pointer-events-none"
              style={{ left: `${(launchPoint.lon + 180) / 360 * 100}%`, top: `${(90 - launchPoint.lat) / 180 * 100}%` }}
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
