import React, { useState, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture, OrbitControls } from "@react-three/drei";
import * as THREE from 'three';
import Draggable from 'react-draggable';
import { motion } from "motion/react";
import {
  Play,
  Activity,
  Globe,
  Satellite,
  Settings2,
  ArrowRight,
  LogOut,
  Heart,
  Github,
  Download,
  Terminal,
  Move,
} from "lucide-react";
import OrbitSimulator, { PLANETS } from "./OrbitSimulator";
import TrajectoryOptimizer, { OptimizeResult } from "./TrajectoryOptimizer";
import { scanPorkchop } from "./workers/trajectory.worker";
import { TelemetryPanel } from "./components/TelemetryPanel";
import { LaunchHUD } from "./components/LaunchHUD";
import { Planet2DMap } from "./components/Planet2DMap";
import Galaxy from "./components/Galaxy";
import StaggeredMenu from "./components/StaggeredMenu";
import ScrollFloat from "./components/ScrollFloat";
import ScrollReveal from "./components/ScrollReveal";

function InteractiveGlobe({ url, color }: { url: string, color: string }) {
  const meshRef = React.useRef<THREE.Mesh>(null);
  const tex = useTexture(url);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  const [hovered, setHover] = useState(false);
  
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 3, 5]} intensity={2.5} />
      <mesh 
        ref={meshRef} 
        onPointerOver={() => setHover(true)} 
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[1.5, 64, 64]} />
        <meshStandardMaterial map={tex} color={hovered ? '#ffffff' : '#f0f0f0'} roughness={0.7} emissive={new THREE.Color(color).multiplyScalar(0.1)} />
      </mesh>
      <OrbitControls enableZoom={false} enablePan={false} />
    </>
  );
}

export default function App() {
  const [showMobileBlock, setShowMobileBlock] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024;
      setShowMobileBlock(isMobile);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const [isSimulatorRunning, setIsSimulatorRunning] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<
    (typeof PLANETS)[0] | null
  >(PLANETS[2]); // Earth
  const [timeMult, setTimeMult] = useState(1); // Realtime / Orbital / Galactic

  // Launch Parameters
  const [v0, setV0] = useState(7.67);
  const [pitch, setPitch] = useState(0);
  const [yaw, setYaw] = useState(0);
  const [nbody, setNbody] = useState(true);
  const [targetOrbit, setTargetOrbit] = useState("LEO");

  const [mapPlanet, setMapPlanet] = useState<string | null>(null);
  const [launchLocation, setLaunchLocation] = useState<{lat: number, lon: number} | null>(null);
  const [targetLocation, setTargetLocation] = useState<{lat: number, lon: number} | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [currentLaunchTime, setCurrentLaunchTime] = useState<number>(0);
  const [isLaunched, setIsLaunched] = useState(false);
  const [missionStatus, setMissionStatus] = useState<string>("STANDBY");

  const [launchPlanet, setLaunchPlanet] = useState<string | null>("Earth");
  const [targetPlanet, setTargetPlanet] = useState<string | null>(null);
  const [initialLaunchPlanet, setInitialLaunchPlanet] = useState<string>("Earth");
  const [initialTargetPlanet, setInitialTargetPlanet] = useState<string | null>(null);
  const [missionLegs, setMissionLegs] = useState<any[] | null>(null);
  const [returnWindow, setReturnWindow] = useState<OptimizeResult | null>(null);

  const [missionStartRealTime, setMissionStartRealTime] = useState<number>(0);
  const [recordedTimeEvents, setRecordedTimeEvents] = useState<{ elapsedMs: number, mult: number }[]>([]);
  const [activeReplay, setActiveReplay] = useState<any>(null);
  const [activeReplayStartTime, setActiveReplayStartTime] = useState<number>(0);
  
  // Track mission completions to trigger archiving in OrbitSimulator
  const [completedMissions, setCompletedMissions] = useState<number>(0);
  const [archivedMissions, setArchivedMissions] = useState<any[]>([]);
  const [currentLaunchPoints, setCurrentLaunchPoints] = useState<THREE.Vector3[]>([]);
  const [currentReturnPoints, setCurrentReturnPoints] = useState<THREE.Vector3[]>([]);

  // Shortcut states
  const [orbitPathsVisible, setOrbitPathsVisible] = useState(true);
  const [planetaryLabelsVisible, setPlanetaryLabelsVisible] = useState(true);
  const [followSpacecraft, setFollowSpacecraft] = useState(false);
  const [cameraPresetToLoad, setCameraPresetToLoad] = useState<number | null>(null);
  const [cameraPresetToSave, setCameraPresetToSave] = useState<number | null>(null);
  const [resetCameraTrigger, setResetCameraTrigger] = useState(0);
  const [showTelemetryPanel, setShowTelemetryPanel] = useState(true); 
  const [showMissionPanel, setShowMissionPanel] = useState(true); 
  const lastTimeMultRef = useRef(86400); // 1 Day/sec

  const timeControlNodeRef = React.useRef<HTMLDivElement>(null);
  const [timeControlPos, setTimeControlPos] = useState(() => {
    const saved = localStorage.getItem('TimeControl_pos');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  const onDragStopTC = (e: any, data: any) => {
    const newPos = { x: data.x, y: data.y };
    setTimeControlPos(newPos);
    localStorage.setItem('TimeControl_pos', JSON.stringify(newPos));
  };

  const targetSelectorNodeRef = React.useRef<HTMLDivElement>(null);
  const [targetSelectorPos, setTargetSelectorPos] = useState(() => {
    const saved = localStorage.getItem('TargetSelector_pos');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  const onDragStopTargetSelector = (e: any, data: any) => {
    const newPos = { x: data.x, y: data.y };
    setTargetSelectorPos(newPos);
    localStorage.setItem('TargetSelector_pos', JSON.stringify(newPos));
  };

  const trajectoryNodeRef = React.useRef<HTMLDivElement>(null);
  const [trajectoryPos, setTrajectoryPos] = useState(() => {
    const saved = localStorage.getItem('TrajectoryOptimizer_pos');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  const onDragStopTrajectory = (e: any, data: any) => {
    const newPos = { x: data.x, y: data.y };
    setTrajectoryPos(newPos);
    localStorage.setItem('TrajectoryOptimizer_pos', JSON.stringify(newPos));
  };

  const getSimulatedDestId = (): number => {
    const nameMap = { "MERCURY": 1, "VENUS": 2, "EARTH": 3, "MARS": 4, "JUPITER": 5, "SATURN": 6, "URANUS": 7, "NEPTUNE": 8 } as any;
    const name = selectedTarget?.name || targetPlanet || "Mars";
    return nameMap[name.toUpperCase()] || 4;
  };



  // Time Ref for jumping simulation
  const globalTimeRef = React.useRef<number>(Date.now() / 1000);
  const landingScrollRef = React.useRef<HTMLDivElement>(null);

  // Prevention guard for duplicate TEI execution calls
  const teiAppliedRef = React.useRef(false);

  const getSimulatedOriginId = (): number => {
    const nameMap = { "MERCURY": 1, "VENUS": 2, "EARTH": 3, "MARS": 4, "JUPITER": 5, "SATURN": 6, "URANUS": 7, "NEPTUNE": 8 } as any;
    if (missionStatus && missionStatus.endsWith("_ORBIT")) {
      const pName = missionStatus.replace("_ORBIT", "").toUpperCase();
      if (nameMap[pName]) return nameMap[pName];
    }
    if (launchPlanet) {
      const pName = launchPlanet.toUpperCase();
      if (nameMap[pName]) return nameMap[pName];
    }
    return 3; // default Earth
  };

  // Background Web Worker references for Earth return trajectory optimizer
  const returnWorkerRef = React.useRef<Worker | null>(null);
  const returnDestIdRef = React.useRef<number>(4);

  React.useEffect(() => {
    try {
      const w = new Worker(
        new URL("./workers/trajectory.worker.ts", import.meta.url),
        { type: "module" }
      );
      w.onmessage = (e) => {
        const { type, result } = e.data;
        if (type === "RESULT") {
          if (result) {
            const leg: any = {
              originId: returnDestIdRef.current,
              destId: 3, // Earth
              type: "capture",
              dv1_kms: result.dv1_kms,
              dv2_kms: result.dv2_kms,
              tof_days: result.tof_days,
              v1_ecl: result.v1_ecl,
            };
            result.legs = [leg];
          }
          setReturnWindow(result);
        }
      };
      returnWorkerRef.current = w;
    } catch (err) {
      console.warn("Could not load return trajectory Web Worker, falling back to sync:", err);
    }
    return () => {
      returnWorkerRef.current?.terminate();
    };
  }, []);

  // Return trajectory worker
  useEffect(() => {
    const planetIds: Record<string, number> = {
      'Mercury': 1,
      'Venus': 2,
      'Earth': 3,
      'Mars': 4,
      'Jupiter': 5,
      'Saturn': 6,
      'Uranus': 7,
      'Neptune': 8
    };
    if (selectedTarget && selectedTarget.name !== "Sun" && selectedTarget.name !== "Earth") {
      returnDestIdRef.current = planetIds[selectedTarget.name] || 4;
      if (returnWorkerRef.current) {
        returnWorkerRef.current.postMessage({
          type: "SCAN",
          payload: {
            originId: returnDestIdRef.current,
            destId: 3,
            t0_days: globalTimeRef.current / 86400,
            searchDays: 800,
            tofMin: 50,
            tofMax: 400,
            steps: 30,
            optGoal: "Time-Optimal (Fast-Transit)"
          }
        });
      }
    }
  }, [selectedTarget]);

  const handleTimeMultChange = (newMult: number) => {
    setTimeMult(newMult);
    if (isLaunched && !activeReplay) {
      setRecordedTimeEvents(prev => [...prev, { elapsedMs: Date.now() - missionStartRealTime, mult: newMult }]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') {
        return;
      }
      
      const key = e.key.toLowerCase();
      
      // Ctrl + 1-9 (Save presets)
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const digit = parseInt(e.key);
        setCameraPresetToSave(digit);
        setTimeout(() => setCameraPresetToSave(null), 100);
        return;
      }
      
      // 1-9 keys (focus planets in order: 1=Mercury, 2=Venus, 3=Earth, 4=Mars, 5=Jupiter, 6=Saturn, 7=Uranus, 8=Neptune)
      if (!e.ctrlKey && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        const digit = parseInt(e.key);
        if (digit >= 1 && digit <= 8) {
          const p = PLANETS[digit - 1];
          if (p) setSelectedTarget(p);
        }
        
        setCameraPresetToLoad(digit);
        setTimeout(() => setCameraPresetToLoad(null), 100);
        return;
      }
      
      if (e.key === '0') {
        setSelectedTarget(null);
        return;
      }
      
      // Shift + L
      if (e.shiftKey && key === 'l') {
        e.preventDefault();
        handleLaunch();
        return;
      }
      
      // Shift + R
      if (e.shiftKey && key === 'r') {
        e.preventDefault();
        planReturn();
        return;
      }
      
      switch (key) {
        case 'f':
          setFollowSpacecraft(prev => !prev);
          break;
        case 'r':
          setResetCameraTrigger(prev => prev + 1);
          break;
        case ' ':
          e.preventDefault();
          if (timeMult > 0) {
            lastTimeMultRef.current = timeMult;
            handleTimeMultChange(0);
          } else {
            handleTimeMultChange(lastTimeMultRef.current || 86400);
          }
          break;
        case '[':
          {
            const warpSpeeds = [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10];
            const currIdx = warpSpeeds.indexOf(timeMult);
            if (currIdx > 0) {
              handleTimeMultChange(warpSpeeds[currIdx - 1]);
            }
          }
          break;
        case ']':
          {
            const warpSpeeds = [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10];
            const currIdx = warpSpeeds.indexOf(timeMult);
            if (currIdx !== -1 && currIdx < warpSpeeds.length - 1) {
              handleTimeMultChange(warpSpeeds[currIdx + 1]);
            } else if (currIdx === -1) {
              handleTimeMultChange(86400);
            }
          }
          break;
        case 'l':
          if (!isLaunched) {
            handleLaunch();
          }
          break;
        case 't':
          // Opens trajectory planner. On simple apps this is the panel
          setShowMissionPanel(true);
          break;
        case 'm':
          setShowMissionPanel(prev => !prev);
          break;
        case 'g':
          setNbody(prev => !prev);
          break;
        case 'o':
          setOrbitPathsVisible(prev => !prev);
          break;
        case 'p':
          setPlanetaryLabelsVisible(prev => !prev);
          break;
        case 'escape':
          setMapPlanet(null);
          setIsArchiveOpen(false);
          break;
        case '`':
        case '~':
          setShowTelemetryPanel(prev => !prev);
          break;
        default:
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [timeMult, isLaunched, selectedTarget]);

  const OBLIQUITY = 23.43929111 * (Math.PI / 180); // J2000 obliquity of ecliptic

  const eclipticToLocal = (vEcl: [number, number, number]): [number, number, number] => {
    const [x, y, z] = vEcl;
    const cosE = Math.cos(OBLIQUITY);
    const sinE = Math.sin(OBLIQUITY);

    // Rotate ecliptic → equatorial (standard J2000 matrix, X-axis rotation)
    return [
      x,
      y * cosE - z * sinE,
      y * sinE + z * cosE,
    ];
  };

  const cartesianToPitchYaw = (v: [number, number, number]): { v0: number; pitch: number; yaw: number } => {
    const [vx, vy, vz] = v;
    const v0M    = Math.sqrt(vx**2 + vy**2 + vz**2);
    const p      = Math.asin(vx / v0M);                // matches Python sin(pitch)
    const y      = Math.atan2(vz, vy);                // matches Python atan2(vz,vy)
    return { v0: v0M, pitch: p, yaw: y };
  };

  const handleApply = (result: OptimizeResult) => {
    if (result.legs && result.legs.length === 1 && result.legs[0].destId === 3) {
      if (teiAppliedRef.current) return;
      teiAppliedRef.current = true;
    }

    const vLocal = eclipticToLocal(result.v1_ecl)
    const { v0: newV0, pitch: newPitch, yaw: newYaw } = cartesianToPitchYaw(vLocal)

    setV0(parseFloat(newV0.toFixed(4)))
    setPitch(parseFloat((newPitch * 180 / Math.PI).toFixed(3)))
    setYaw(parseFloat((newYaw   * 180 / Math.PI).toFixed(3)))
    globalTimeRef.current = result.launchDay_j2000
    setTimeMult(86400) // 1 day per second
    setTargetPlanet(null); // Clear single planet target so we rely on legs
    setMissionLegs(result.legs || null);
    setIsLaunched(false); // Reset launch state so return trajectory propagates in the HUD first

    if (result.legs && result.legs.length > 0) {
      const planetMap = { 1: 'Mercury', 2: 'Venus', 3: 'Earth', 4: 'Mars', 5: 'Jupiter', 6: 'Saturn', 7: 'Uranus', 8: 'Neptune' } as Record<number, string>;
      const originName = planetMap[result.legs[0].originId];
      if (originName) {
        setLaunchPlanet(originName);
      }
      const destId = result.legs[result.legs.length - 1].destId;
      const destName = planetMap[destId];
      if (destName) {
        const foundPlanet = PLANETS.find(p => p.name === destName);
        if (foundPlanet) {
          setSelectedTarget(foundPlanet);
        }
      }
    }
  };

  const handleLaunch = () => {
    teiAppliedRef.current = false;
    setCurrentLaunchTime(globalTimeRef.current);
    setIsLaunched(true);
    setInitialLaunchPlanet(launchPlanet || "Earth");
    setInitialTargetPlanet(targetPlanet);
    setRecordedTimeEvents([{ elapsedMs: 0, mult: timeMult }]);
    setMissionStartRealTime(Date.now());
    setActiveReplay(null);
  };

  const planReturn = () => {
    setIsLaunched(false);
    setCurrentReturnPoints([]);

    // Current planet is the last destination in missionLegs or targetPlanet
    let currentDestId = 4; // Mars default
    if (missionLegs && missionLegs.length > 0) {
      currentDestId = missionLegs[missionLegs.length - 1].destId;
    } else if (targetPlanet) {
      const planetMap = { 'Mercury': 1, 'Venus': 2, 'Earth': 3, 'Mars': 4, 'Jupiter': 5, 'Saturn': 6, 'Uranus': 7, 'Neptune': 8 } as any;
      currentDestId = planetMap[targetPlanet] || 4;
    }
    returnDestIdRef.current = currentDestId;
    setReturnWindow(null); // Clear previous return window so UI knows it is computing

    // Set launch/dest correctly in App state to match returning direction
    const planetMap = { 1: 'Mercury', 2: 'Venus', 3: 'Earth', 4: 'Mars', 5: 'Jupiter', 6: 'Saturn', 7: 'Uranus', 8: 'Neptune' } as Record<number, string>;
    const originName = planetMap[currentDestId];
    if (originName) {
      setLaunchPlanet(originName);
    }
    setTargetPlanet("Earth");
    
    const earthPlanet = PLANETS.find(p => p.name === "Earth");
    if (earthPlanet) {
      setSelectedTarget(earthPlanet);
    }

    const t0 = globalTimeRef.current / 86400; // live sim clock

    if (returnWorkerRef.current) {
      returnWorkerRef.current.postMessage({
        type: 'SCAN',
        payload: {
          originId: currentDestId,
          destId: 3, // Earth
          t0_days: t0,
          searchDays: 900,
          tofMin: 150,
          tofMax: 500,
          steps: 60
        }
      });
    } else {
      const result = scanPorkchop(
        currentDestId,
        3, // Earth
        t0,
        900,
        150,
        500
      );

      if (result) {
        const leg: any = {
          originId: currentDestId,
          destId: 3, // Earth
          type: 'capture',
          dv1_kms: result.dv1_kms,
          dv2_kms: result.dv2_kms,
          tof_days: result.tof_days,
          v1_ecl: result.v1_ecl,
        };
        result.legs = [leg];
      }
      setReturnWindow(result);
    }
  };

  const handleSelectLocation = (type: "launch" | "target", planet: string, lat: number, lon: number) => {
    if (type === "launch") {
      setLaunchPlanet(planet);
      setLaunchLocation({ lat, lon });
    } else {
      setTargetPlanet(planet);
      setTargetLocation({ lat, lon });
      setMissionLegs(null); // Reset legs if picking a single destination
    }
  };

  const renderTargetStats = () => {
    if (!selectedTarget) {
      return (
        <>
          <div className="flex justify-between items-center mb-6">
            <span className="font-label-caps text-[9px] text-white/40 tracking-[0.2em]">
              PRIMARY TARGET
            </span>
            <span className="px-2 py-0.5 border border-secondary/40 text-secondary text-[8px] rounded glow-cyan tracking-[0.2em]">
              SYSTEM CENTER
            </span>
          </div>
          <div className="flex items-center gap-5 mb-8">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border border-white/10 bg-[#ffcc00] shadow-[0_0_20px_rgba(255,204,0,0.5)]"></div>
              <div className="absolute inset-0 rounded-full ring-2 ring-secondary/20 animate-ping"></div>
            </div>
            <div>
              <h2 className="font-display-lg text-4xl text-white">SOL</h2>
              <p className="font-label-caps text-[9px] text-secondary/80 mt-1 tracking-[0.2em]">
                RADIUS: 696,340 KM
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-y-6">
            <div>
              <span className="font-label-caps text-[9px] text-white/30 block mb-1">TYPE</span>
              <span className="font-data-lg text-xl text-white">G2V</span>
            </div>
            <div>
              <span className="font-label-caps text-[9px] text-white/30 block mb-1">MASS</span>
              <span className="font-data-lg text-xl text-white">1.989</span>
              <span className="text-[9px] text-white/20 ml-1">x10³⁰ KG</span>
            </div>
            <div>
              <span className="font-label-caps text-[9px] text-white/30 block mb-1">TEMP (SURF)</span>
              <span className="font-data-lg text-xl text-secondary">5,505</span>
              <span className="text-[9px] text-white/20 ml-1">°C</span>
            </div>
            <div>
              <span className="font-label-caps text-[9px] text-white/30 block mb-1">AGE</span>
              <span className="font-data-lg text-xl text-white">4.6</span>
              <span className="text-[9px] text-white/20 ml-1">B YR</span>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <span className="font-label-caps text-[9px] text-white/40 tracking-[0.2em]">
            PRIMARY TARGET
          </span>
          <span className="px-2 py-0.5 border border-primary/40 text-primary text-[8px] rounded glow-primary tracking-[0.2em]">
            LOCKED
          </span>
        </div>
        <div className="flex items-center gap-5 mb-8">
          <div className="relative w-20 h-20 rounded-full border border-white/10 overflow-hidden cursor-grab active:cursor-grabbing">
            <Canvas camera={{ position: [0, 0, 3] }}>
              <InteractiveGlobe url={selectedTarget.texture} color={selectedTarget.color} />
            </Canvas>
            <div className="absolute inset-0 rounded-full ring-2 ring-primary/20 pointer-events-none animate-ping"></div>
          </div>
          <div>
            <h2 className="font-display-lg text-4xl text-white uppercase">
              {selectedTarget.name}
            </h2>
            <p className="font-label-caps text-[9px] text-primary/80 mt-1 tracking-[0.2em]">
              RADIUS: {selectedTarget.radius} KM
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/20 hover:-translate-y-1 hover:bg-white/10 transition-all cursor-pointer shadow-lg hover:shadow-primary/20">
            <span className="font-label-caps text-[9px] text-white/40 block mb-1">VELOCITY (PERI)</span>
            <span className="font-data-lg text-xl text-white">
              {Math.ceil(
                (Math.sqrt(
                  6.6743e-11 *
                    1.989e30 *
                    (2 /
                      (selectedTarget.elements.a *
                        (1 - selectedTarget.elements.e)) -
                      1 / selectedTarget.elements.a),
                ) /
                  1000) *
                  10,
              ) / 10}
            </span>
            <span className="text-[9px] text-white/20 ml-1">KM/S</span>
          </div>
          <div className="bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/20 hover:-translate-y-1 hover:bg-white/10 transition-all cursor-pointer shadow-lg hover:shadow-cyan-500/20">
            <span className="font-label-caps text-[9px] text-white/40 block mb-1">SEMI-MAJOR</span>
            <span className="font-data-lg text-xl text-white">
              {(selectedTarget.elements.a / 149597870700).toFixed(2)}
            </span>
            <span className="text-[9px] text-white/20 ml-1">AU</span>
          </div>
          <div className="bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/20 hover:-translate-y-1 hover:bg-white/10 transition-all cursor-pointer shadow-lg hover:shadow-cyan-500/20">
            <span className="font-label-caps text-[9px] text-white/40 block mb-1">ORBIT PERIOD</span>
            <span className="font-data-lg text-xl text-white">
              {(selectedTarget.elements.period / (24 * 3600)).toFixed(1)}
            </span>
            <span className="text-[9px] text-white/20 ml-1">DAYS</span>
          </div>
          <div className="bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/20 hover:-translate-y-1 hover:bg-white/10 transition-all cursor-pointer shadow-lg hover:shadow-primary/20">
            <span className="font-label-caps text-[9px] text-white/40 block mb-1">ECCENTRICITY</span>
            <span className="font-data-lg text-xl text-primary">
              {selectedTarget.elements.e.toFixed(4)}
            </span>
            <span className="text-[9px] text-white/20 ml-1">E</span>
          </div>
        </div>
      </>
    );
  };

  const handleReplay = (archive: any) => {
    globalTimeRef.current = archive.launchTime;
    setCurrentLaunchTime(archive.launchTime);
    setMissionLegs(archive.missionLegs || null);
    setLaunchPlanet(archive.launchPlanet || "Earth");
    setTargetPlanet(archive.originalTargetPlanet || null);
    
    // Set UI state
    const planetMap = PLANETS.find(p => p.name === archive.originalTargetPlanet) || PLANETS.find(p => p.name === archive.targetPlanet);
    if (planetMap) setSelectedTarget(planetMap);
    
    teiAppliedRef.current = archive.teiApplied || false;
    
    // Launch and let time events drive the simulation
    setActiveReplay(archive);
    setActiveReplayStartTime(Date.now());
    setIsLaunched(true);
    setMissionStatus("STANDBY");
    setIsArchiveOpen(false);
  };

  useEffect(() => {
    if (!activeReplay || !activeReplay.recordedTimeEvents) return;
    
    let frameId: number;
    let eventIndex = 0;
    const events = activeReplay.recordedTimeEvents;

    if (events.length > 0) {
      handleTimeMultChange(events[0].mult);
      lastTimeMultRef.current = events[0].mult;
    }

    const checkTime = () => {
       if (eventIndex < events.length - 1) {
           const elapsed = Date.now() - activeReplayStartTime;
           const nextEvent = events[eventIndex + 1];
           if (elapsed >= nextEvent.elapsedMs) {
               handleTimeMultChange(nextEvent.mult);
               lastTimeMultRef.current = nextEvent.mult;
               eventIndex++;
           }
       }
       frameId = requestAnimationFrame(checkTime);
    };
    
    frameId = requestAnimationFrame(checkTime);
    
    return () => cancelAnimationFrame(frameId);
  }, [activeReplay, activeReplayStartTime]);

  return (
    <div className="text-on-surface antialiased min-h-screen relative overflow-hidden flex flex-col bg-transparent">
      <div className="absolute inset-0 z-0">
        <Galaxy transparent={false} />
      </div>
      {showMobileBlock && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#03060f] text-white p-6 text-center select-none pointer-events-auto">
          <div className="max-w-xs flex flex-col items-center">
            <svg 
              className="w-10 h-10 text-primary/70 mb-5" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            <h1 className="text-xs font-bold tracking-[0.25em] text-[#aaddff] uppercase mb-2">
              DESKTOP ONLY
            </h1>
            <p className="text-[11px] text-white/40 tracking-wider leading-relaxed">
              Mobile support has not been added. Please connect using a desktop display.
            </p>
          </div>
        </div>
      )}

      <OrbitSimulator
        isRunning={isSimulatorRunning}
        timeMult={timeMult}
        selectedTarget={selectedTarget}
        launchParams={{ v0, pitch, yaw, nbody, launchPlanet, launchLocation, targetLocation, targetPlanet, timeMult, isLaunched, launchDay_j2000: globalTimeRef.current, missionLegs }}
        globalTimeRef={globalTimeRef}
        onPlanetDoubleClick={(name: string) => setMapPlanet(name)}
        onStatusUpdate={setMissionStatus}
        completedMissions={completedMissions}
        archivedMissions={archivedMissions}
        activeReplay={activeReplay}
        onPointsCalculated={(pts, isReturn) => {
          if (isReturn) {
            setCurrentReturnPoints(pts);
          } else {
            setCurrentLaunchPoints(pts);
          }
        }}
        orbitPathsVisible={orbitPathsVisible}
        planetaryLabelsVisible={planetaryLabelsVisible}
        followSpacecraft={followSpacecraft}
        cameraPresetToLoad={cameraPresetToLoad}
        cameraPresetToSave={cameraPresetToSave}
        resetCameraTrigger={resetCameraTrigger}
      />

      {/* Landing Page Content */}
      <div
        ref={landingScrollRef}
        className={`absolute inset-0 z-20 flex flex-col transition-opacity duration-1000 ${isSimulatorRunning ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto overflow-y-auto"}`}
      >
        {/* TopNavBar */}
        <StaggeredMenu
          isFixed={true}
          position="right"
          colors={['#082f49', '#0c4a6e', '#164e63']}
          logoUrl="/logo.svg"
          menuButtonColor="#00ffff"
          openMenuButtonColor="#ffffff"
          accentColor="#00ffff"
          onLaunchCore={() => setIsSimulatorRunning(true)}
          items={[
            { 
              label: 'Launch Simulator', 
              ariaLabel: 'Launch Simulator', 
              link: '#', 
              onClick: () => setIsSimulatorRunning(true),
              image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop'
            },
            { 
              label: 'GitHub Repo', 
              ariaLabel: 'GitHub MapG', 
              link: 'https://github.com/UtkarshSharma000/MapG',
              image: 'https://images.unsplash.com/photo-1618477247222-ac60c7477123?q=80&w=2064&auto=format&fit=crop'
            },
          ]}
          socialItems={[]}
        />

        <main className="pt-20">
          {/* Hero Section */}
          <section className="relative min-h-[90vh] flex items-center px-8 md:px-[32px] overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={isSimulatorRunning ? { opacity: 0 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative z-10 max-w-4xl"
            >
              <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 glass-panel border border-primary/30 rounded">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="font-label-caps text-[10px] text-primary tracking-widest">SYSTEMS NOMINAL // ORBITAL SECTOR 7</span>
              </div>
              
              <h2 className="font-display-lg text-5xl md:text-[64px] font-bold mb-6 leading-none tracking-tighter">
                MISSION:<br/><span className="text-primary text-6xl md:text-[80px]">MAP G</span>
              </h2>
              <p className="font-headline-md text-xl md:text-2xl text-on-surface-variant mb-10 max-w-2xl font-light">
                Pioneering the Next Frontier of Satellite Logistics and Orbital Infrastructure.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => setIsSimulatorRunning(true)}
                  className="px-10 py-4 bg-primary-container text-on-primary-container font-label-caps text-label-caps tracking-widest glow-primary hover:scale-105 active:scale-95 transition-all cursor-pointer rounded-full flex items-center gap-2"
                >
                  <Play size={16} fill="currentColor" /> LAUNCH TERMINAL
                </button>
                <a 
                  href="https://github.com/UtkarshSharma000/MapG"
                  target="_blank"
                  rel="noreferrer"
                  className="px-10 py-4 glass-panel border border-tertiary/40 text-tertiary font-label-caps text-label-caps tracking-widest glow-blue hover:scale-105 hover:bg-white/5 active:scale-95 transition-all rounded-full cursor-pointer inline-flex items-center gap-2"
                >
                  <Github size={16} /> VIEW SOURCE
                </a>
              </div>
            </motion.div>
            {/* Side Floating Visual */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isSimulatorRunning ? { opacity: 0 } : { opacity: 0.9, scale: 1 }}
              transition={{ duration: 1.5, delay: 0.4, type: "spring" }}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-1/3 aspect-square hidden xl:block"
            >
              <div className="relative w-full h-full cursor-grab active:cursor-grabbing opacity-90 transition-opacity duration-500">
                <Canvas camera={{ position: [0, 0, 3] }}>
                  <InteractiveGlobe url="/textures/2k_mars.jpg" color="#c1440e" />
                </Canvas>
                <div className="absolute inset-0 bg-gradient-to-l from-[#050505]/60 to-transparent pointer-events-none"></div>
              </div>
            </motion.div>
          </section>

          {/* Open Source Section */}
          <section className="px-8 md:px-[32px] py-20 border-t border-white/5 relative bg-transparent">
            {/* Subtle glow behind the heart */}
            <div className="absolute top-[35%] left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-primary/5 rounded-full blur-[80px] pointer-events-none"></div>

            <div className="max-w-4xl mx-auto text-center relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]"></span>
                <span className="font-mono text-[9px] text-primary tracking-widest uppercase">MAP G CORE PROJECT</span>
              </div>
              
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='top bottom'
                scrollEnd='center bottom-=10%'
                stagger={0.03}
                scrollContainerRef={landingScrollRef}
                textClassName="font-display-lg text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-2"
              >
                MAP G is
              </ScrollFloat>
              <ScrollFloat
                animationDuration={1.2}
                ease='back.inOut(2)'
                scrollStart='top bottom+=20%'
                scrollEnd='center bottom-=20%'
                stagger={0.02}
                scrollContainerRef={landingScrollRef}
                textClassName="font-display-lg text-primary glow-primary text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
              >
                Completely Open Source!
              </ScrollFloat>

              <div className="flex justify-center items-center gap-2 text-white/50 mb-10 group cursor-default">
                <Heart className="text-primary fill-primary animate-bounce group-hover:scale-125 transition-transform" size={24} />
                <span className="font-mono text-sm tracking-wide">Building the future of orbital optimization together</span>
              </div>

              {/* Bento Grid CTAs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Download Local Backend Zip Card */}
                <div className="glass-panel p-8 text-left border border-white/10 hover:border-primary/40 transition-all duration-300 group flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                        <Terminal size={22} />
                      </div>
                      <span className="font-mono text-[10px] text-white/40">C++ ENGINE</span>
                    </div>
                    <h4 className="font-display-lg text-lg font-bold text-white mb-2">Local Compute Server</h4>
                    <p className="text-white/60 text-xs font-light leading-relaxed mb-6">
                      An optimize-compiled trajectory core with custom guidance computers and porkchop scanners. Perfect for low-latency batch analysis.
                    </p>
                  </div>
                  <a 
                    href="/greninja_engine.zip" 
                    download="greninja_engine.zip"
                    className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-black font-mono font-bold text-xs uppercase px-6 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all hover:shadow-[0_0_15px_rgba(170,221,255,0.4)] pointer-events-auto"
                  >
                    <Download size={14} className="stroke-[3]" />
                    <span>Download for Windows</span>
                  </a>
                </div>

                {/* GitHub Repository Card */}
                <div className="glass-panel p-8 text-left border border-white/10 hover:border-emerald-500/40 transition-all duration-300 group flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                        <Github size={22} />
                      </div>
                      <span className="font-mono text-[10px] text-white/40">GUI REPO</span>
                    </div>
                    <h4 className="font-display-lg text-lg font-bold text-white mb-2">UtkarshSharma000/MapG</h4>
                    <p className="text-white/60 text-xs font-light leading-relaxed mb-6">
                      Fully interactive 3D solar system rendering engine, Three.js simulation views, and trajectory visualization dashboards on GitHub.
                    </p>
                  </div>
                  <a 
                    href="https://github.com/UtkarshSharma000/MapG" 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-mono font-bold text-xs uppercase px-6 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] pointer-events-auto"
                  >
                    <Github size={14} className="stroke-[3]" />
                    <span>Access GitHub Repo</span>
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="px-8 md:px-[32px] py-24 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-primary/5 rounded-full pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-primary/10 rounded-full pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-primary/20 rounded-full pointer-events-none"></div>
            <div className="max-w-4xl mx-auto text-center relative z-10 glass-panel p-12 border border-primary/10 rounded-3xl">
              <h3 className="font-display-lg text-4xl md:text-5xl font-bold mb-4 relative z-10 tracking-tighter">READY FOR DEPLOYMENT?</h3>
              <p className="text-on-surface-variant font-light mb-10 max-w-xl mx-auto relative z-10">Access real-time telemetry data, satellite control systems, and mission logs via the secure terminal interface.</p>
              <div className="flex flex-col md:flex-row justify-center gap-4 relative z-10">
                <button 
                  onClick={() => setIsSimulatorRunning(true)}
                  className="px-12 py-4 bg-primary text-on-primary font-label-caps tracking-widest glow-primary hover:scale-105 active:scale-95 transition-all rounded font-bold cursor-pointer"
                >
                  INITIALIZE CONNECTION
                </button>
                <a 
                  href="https://github.com/UtkarshSharma000/MapG"
                  target="_blank"
                  rel="noreferrer"
                  className="px-12 py-4 glass-panel border border-outline text-on-surface-variant font-label-caps tracking-widest hover:scale-105 active:scale-95 transition-all rounded font-bold cursor-pointer inline-block"
                >
                  GITHUB REPOSITORY
                </a>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="w-full py-[32px] px-8 md:px-[32px] flex flex-col md:flex-row justify-between items-center gap-[16px] bg-[#170b08]/90 backdrop-blur-md border-t border-outline-variant/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>target</span>
              <span className="font-display-lg text-lg text-primary tracking-tighter font-bold">MAP G</span>
            </div>
            <div className="flex gap-8">
              <a className="font-label-caps text-[10px] text-on-surface-variant hover:text-primary transition-all hover:translate-x-1 duration-200 uppercase tracking-widest" href="https://github.com/UtkarshSharma000/MapG" target="_blank" rel="noreferrer">GitHub</a>
            </div>
            <div className="text-right">
              <p className="font-label-caps text-[10px] text-tertiary tracking-widest">© 2026 MAP G. ALL SYSTEMS OPERATIONAL.</p>
            </div>
          </footer>
        </main>
      </div>

      {/* Simulator Overlay UI */}
      <div
        className={`absolute inset-0 z-30 pointer-events-none flex flex-col transition-opacity duration-1000 ${isSimulatorRunning ? "opacity-100" : "opacity-0"}`}
      >
        {isSimulatorRunning && showTelemetryPanel && <TelemetryPanel />}
        {isSimulatorRunning && showMissionPanel && (
          <Draggable nodeRef={trajectoryNodeRef} handle=".trajectory-drag-handle" position={trajectoryPos} onStop={onDragStopTrajectory}>
            <div ref={trajectoryNodeRef} className="fixed z-40 pointer-events-auto" style={{ left: 32 + 310, top: 144 }}>
              <TrajectoryOptimizer
                originId={getSimulatedOriginId()}
                destId={getSimulatedDestId()}
                globalTimeRef={globalTimeRef}
                onApply={handleApply}
              />
            </div>
          </Draggable>
        )}
        {isSimulatorRunning && (
          <LaunchHUD
            selectedTarget={selectedTarget}
            setSelectedTarget={setSelectedTarget}
            planets={PLANETS}
            onSimulateLaunch={handleLaunch}
            onResetSimulation={() => {
              setIsLaunched(false);
              setMissionLegs(null);
              setTargetPlanet(null);
              setReturnWindow(null);
              setLaunchPlanet("Earth");
              teiAppliedRef.current = false;
              setCurrentLaunchPoints([]);
              setCurrentReturnPoints([]);
            }}
            isLaunched={isLaunched}
            missionStatus={missionStatus}
            onPlanReturn={planReturn}
            returnWindow={returnWindow}
            onApplyReturn={() => {
              handleApply(returnWindow!);
              setIsLaunched(true);
            }}
            onConcludeMission={() => {
              // End the current mission and archive it, allowing a new launch
              const missionArchive = {
                id: completedMissions,
                targetPlanet: selectedTarget?.name || targetPlanet,
                returnPlanet: missionStatus === "EARTH_ORBIT" ? "Earth" : undefined,
                orbitType: missionStatus,
                offset: completedMissions * (Math.PI / 4), // Phase offset to prevent collisions
                missionLegs: missionLegs,
                launchPlanet: initialLaunchPlanet,
                originalTargetPlanet: initialTargetPlanet,
                launchTime: currentLaunchTime,
                teiApplied: teiAppliedRef.current,
                launchPoints: currentLaunchPoints,
                returnPoints: currentReturnPoints,
                recordedTimeEvents: [...recordedTimeEvents],
              };
              setArchivedMissions(prev => [...prev, missionArchive]);
              setCompletedMissions(prev => prev + 1);
              setIsLaunched(false);
              setMissionLegs(null);
              setTargetPlanet(null);
              setReturnWindow(null);
              setLaunchPlanet("Earth");
              setMissionStatus("STANDBY");
              teiAppliedRef.current = false;
              setCurrentLaunchPoints([]);
              setCurrentReturnPoints([]);
              setRecordedTimeEvents([]);
              setActiveReplay(null);
            }}
          />
        )}
        {mapPlanet && (
          <Planet2DMap 
            planetName={mapPlanet}
            onClose={() => setMapPlanet(null)}
            onSelectLocation={handleSelectLocation}
            launchPlanet={launchPlanet}
            targetPlanet={targetPlanet}
            launchLocation={launchLocation}
            targetLocation={targetLocation}
          />
        )}
        {isArchiveOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto">
            <div className="glass-panel p-8 rounded-2xl w-full max-w-3xl border border-white/10 shadow-2xl shadow-primary/20 flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
                <h2 className="font-display-lg text-3xl text-white tracking-widest">MISSION ARCHIVE</h2>
                <button 
                  onClick={() => setIsArchiveOpen(false)}
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10"
                >
                  <span className="material-symbols-outlined text-white/70">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {archivedMissions.length === 0 ? (
                  <div className="text-center py-12 text-white/40 font-label-caps tracking-widest">
                    NO MISSIONS ARCHIVED YET
                  </div>
                ) : (
                  archivedMissions.map((m, idx) => (
                    <div key={m.id} className="p-5 rounded-xl border border-white/10 bg-[#1d1d1d]/40 flex justify-between items-center group hover:border-primary/40 transition-colors">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-label-caps tracking-widest border border-primary/20">
                            MISSION {String(m.id + 1).padStart(2, '0')}
                          </span>
                          <span className="font-label-caps text-xs text-secondary tracking-widest">
                            {m.orbitType ? m.orbitType.replace("_", " ") : "TRANSFER"}
                          </span>
                        </div>
                        <div className="font-headline-md text-xl text-white mt-1">
                          {m.launchPlanet} → {m.targetPlanet || "Deep Space"}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleReplay(m)}
                        className="px-6 py-2 rounded border border-white/20 bg-white/5 hover:bg-primary/20 hover:border-primary/50 hover:text-primary transition-all font-label-caps tracking-widest text-[#aaaaaa] text-xs flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                        REPLAY
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        {/* Orbit Lines HUD Simulation */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
          <div className="orbit-path w-[800px] h-[800px]"></div>
          <div className="orbit-path w-[1200px] h-[1200px] orbit-active"></div>
          <div className="orbit-path w-[1600px] h-[1600px]"></div>
        </div>

        {/* TopAppBar */}
        <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 h-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="flex items-center gap-6 pointer-events-auto">
            <img src="/logo.svg" alt="Project Greninja" className="w-12 h-12 relative -top-0.5" />
            <div className="flex items-center gap-10">
              <h1 className="font-display-lg text-2xl tracking-tighter text-white">PROJECT <span className="text-secondary font-bold">GRENINJA</span></h1>
              <nav className="hidden md:flex gap-10">
                <a className="font-label-caps text-[10px] tracking-[0.15em] text-secondary border-b border-secondary/50 pb-1 cursor-pointer">TRAJECTORY</a>
                <a onClick={() => setIsArchiveOpen(true)} className="font-label-caps text-[10px] tracking-[0.15em] text-white/60 hover:text-secondary transition-colors cursor-pointer">MISSION ARCHIVE</a>
              </nav>
            </div>
          </div>
          
          <div className="flex items-center gap-6 pointer-events-auto">
            <button
              onClick={() => setIsSimulatorRunning(false)}
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-red-400 hover:border-red-400/30 transition-all cursor-pointer"
              title="Exit Flight Deck"
            >
              <LogOut size={16} className="rotate-180" /> 
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex pt-16 relative z-10 w-full h-full pointer-events-none">
          {/* Central Canvas Area (Interactive / Data Overlays) - Expanded Full Screen */}
          <main className="flex-1 p-8 relative flex flex-col justify-between pointer-events-none">
            {/* Top Center: Sol and Planet focus selection bar */}
            {showMissionPanel && (
              <div id="target-selector-wrapper" className="fixed top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex items-center justify-center w-max" style={{ transform: 'translateX(-50%)' }}>
                <Draggable nodeRef={targetSelectorNodeRef} handle=".target-drag-handle" position={targetSelectorPos} onStop={onDragStopTargetSelector}>
                  <div ref={targetSelectorNodeRef} className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full border border-white/15 bg-background/90 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
                    <div className="target-drag-handle opacity-50 cursor-move hover:opacity-100 flex items-center pr-2 border-r border-white/10">
                      <Move size={14} className="text-white/40" />
                    </div>
                    <button 
                      onClick={() => setSelectedTarget(null)}
                      className={`px-3 py-1 text-[10px] font-label-caps rounded-full border transition-all ${!selectedTarget ? 'border-primary bg-primary/20 text-primary glow-primary font-bold scale-105' : 'border-white/10 text-white/60 hover:text-white bg-white/5'}`}
                      title="Center camera on Sun"
                    >
                      SOL (SUN)
                    </button>
                    <div className="w-[1px] h-4 bg-white/20"></div>
                    <div className="flex gap-2">
                      {PLANETS.map((p) => (
                        <button
                          key={p.name}
                          onClick={() => setSelectedTarget(p)}
                          className={`w-8 h-8 rounded-full border overflow-hidden cursor-pointer transition-all flex items-center justify-center relative group ${selectedTarget?.name === p.name ? "border-secondary scale-110 shadow-[0_0_10px_rgba(0,240,255,0.4)]" : "border-white/10 opacity-60 hover:opacity-100 hover:border-white/30"}`}
                          title={p.name}
                        >
                          <img
                            src={p.texture}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/80 text-[8px] font-mono border border-white/10 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {p.name.toUpperCase()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Draggable>
              </div>
            )}

            {/* Bottom Right: Time Controls */}
            <Draggable nodeRef={timeControlNodeRef} handle=".drag-handle" position={timeControlPos} onStop={onDragStopTC}>
              <div ref={timeControlNodeRef} className="fixed z-40 pointer-events-auto" style={{ right: 32, bottom: 32 }}>
                <div className="p-5 rounded-lg w-80 flex flex-col gap-4 border border-white/10 glass-panel shadow-[0_0_20px_rgba(0,0,0,0.5)] text-white">
                  <div className="flex justify-between items-center drag-handle cursor-move select-none pb-2 border-b border-white/10">
                    <span className="font-label-caps text-[9px] tracking-[0.2em] text-white/40">
                      TIME DILATION
                    </span>
                    <span className="font-data-lg text-lg text-secondary">
                      {timeMult === 1
                        ? "REALTIME"
                        : `x${timeMult.toLocaleString()}`}
                    </span>
                  </div>

              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={
                  timeMult === 1
                    ? 0
                    : timeMult === 86400
                      ? 1 // days
                      : timeMult === 86400 * 30
                        ? 2 // months
                        : timeMult === 86400 * 365.25
                          ? 3 // years
                          : timeMult === 86400 * 365.25 * 10
                            ? 4 // decades
                            : 5 // centuries
                }
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val === 0) handleTimeMultChange(1);
                  else if (val === 1) handleTimeMultChange(86400);
                  else if (val === 2) handleTimeMultChange(86400 * 30);
                  else if (val === 3) handleTimeMultChange(86400 * 365.25);
                  else if (val === 4) handleTimeMultChange(86400 * 365.25 * 10);
                  else handleTimeMultChange(86400 * 365.25 * 100);
                }}
                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-secondary glow-cyan"
              />

              <div className="flex justify-between text-white/20 font-label-caps text-[8px] tracking-[0.15em]">
                <span>1S</span>
                <span>DAY</span>
                <span>MON</span>
                <span>YR</span>
                <span>DEC</span>
                <span>CEN</span>
              </div>
                </div>
              </div>
            </Draggable>
          </main>
        </div>

        {/* Footer */}
        <footer className="absolute bottom-0 w-full flex justify-center items-center py-4 z-10 bg-transparent pointer-events-auto">
          <div className="font-mono text-[9px] tracking-[0.2em] text-white/30 uppercase">
            © 2026 ODYSSEY ASTRODYNAMICS LABORATORY
          </div>
        </footer>
      </div>
    </div>
  );
}
