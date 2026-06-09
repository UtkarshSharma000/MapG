import React, { useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from 'three';
import Draggable from 'react-draggable';
import {
  LogOut,
  Move,
} from "lucide-react";
import { useLocation, useNavigate } from 'react-router-dom';
import OrbitSimulator, { PLANETS } from "./OrbitSimulator";
import { OptimizeResult } from "./TrajectoryOptimizer";
import { scanPorkchop } from "./workers/trajectory.worker";
import { LaunchHUD } from "./components/LaunchHUD";
import { Planet2DMap } from "./components/Planet2DMap";
import Galaxy from "./components/Galaxy";
import StaggeredMenu from "./components/StaggeredMenu";

// Modular Extracted Components
import { InteractiveGlobe } from "./components/InteractiveGlobe";
import LandingHero from "./components/LandingHero";
import InteractiveBridge from "./components/InteractiveBridge";
import SpaceExplorationPanel from "./components/SpaceExplorationPanel";
import MathPhysicsShowcase from "./components/MathPhysicsShowcase";

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

  const location = useLocation();
  const navigate = useNavigate();
  const isSimulatorRunning = location.pathname.startsWith('/engine');
  const setIsSimulatorRunning = (running: boolean) => {
    if (running) {
      navigate('/engine');
    } else {
      navigate('/');
    }
  };
  const [selectedTarget, setSelectedTarget] = useState<
    (typeof PLANETS)[0] | null
  >(null); // Sol (Sun)
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
  const [showMissionPanel, setShowMissionPanel] = useState(true); 
  const lastTimeMultRef = useRef(86400); // 1 Day/sec

  // Elastic Timeline Speed Slider States
  const [elasticValue, setElasticValue] = useState(0); // 0 to 100
  const [elasticOverflow, setElasticOverflow] = useState(0); // pixel overflow
  const [isDraggingElastic, setIsDraggingElastic] = useState(false);
  const elasticTrackRef = useRef<HTMLDivElement>(null);
  const elasticDragStartRef = useRef({ x: 0, val: 0 });

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
  const cinematicSectionRef = React.useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0);

  useEffect(() => {
    const scroller = landingScrollRef.current;
    if (!scroller) return;

    const handleScroll = () => {
      const section = cinematicSectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      
      const sectionTop = rect.top - scrollerRect.top;
      const sectionHeight = rect.height;
      const viewportHeight = scrollerRect.height;
      
      const scrollableDistance = sectionHeight - viewportHeight;
      if (scrollableDistance > 0) {
        const currentScroll = -sectionTop;
        const rawProgress = Math.max(0, Math.min(1, currentScroll / scrollableDistance));
        scrollProgressRef.current = rawProgress;
      } else {
        scrollProgressRef.current = 0;
      }
    };

    scroller.addEventListener('scroll', handleScroll, { passive: true });
    // Run once initially
    handleScroll();

    const handleResize = () => handleScroll();
    window.addEventListener('resize', handleResize);

    return () => {
      scroller.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [isSimulatorRunning]);

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

  // Synchronize dynamic elasticValue with external timeMult changes (e.g. keyboard triggers)
  useEffect(() => {
    if (!isDraggingElastic) {
      const speedMap = [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10, 86400 * 365.25 * 100];
      const idx = speedMap.indexOf(timeMult);
      if (idx !== -1) {
        setElasticValue(idx * 20);
      }
    }
  }, [timeMult, isDraggingElastic]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!elasticTrackRef.current) return;
    const rect = elasticTrackRef.current.getBoundingClientRect();
    const startX = e.clientX;
    setIsDraggingElastic(true);
    
    const clickedVal = Math.min(100, Math.max(0, ((startX - rect.left) / rect.width) * 100));
    setElasticValue(clickedVal);
    elasticDragStartRef.current = { x: startX, val: clickedVal };
    
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingElastic || !elasticTrackRef.current) return;
    const rect = elasticTrackRef.current.getBoundingClientRect();
    const width = rect.width;
    const deltaX = e.clientX - elasticDragStartRef.current.x;
    
    let newValue = elasticDragStartRef.current.val + (deltaX / width) * 100;
    
    const MAX_OVERFLOW = 45;
    const sigmoid = (x: number) => {
      return x / (1 + Math.abs(x / MAX_OVERFLOW));
    };
    
    if (newValue < 0) {
      setElasticValue(0);
      const rawOverflow = (newValue / 100) * width;
      setElasticOverflow(sigmoid(rawOverflow));
    } else if (newValue > 100) {
      setElasticValue(100);
      const rawOverflow = ((newValue - 100) / 100) * width;
      setElasticOverflow(sigmoid(rawOverflow));
    } else {
      setElasticValue(newValue);
      setElasticOverflow(0);
      
      const stepIdx = Math.min(5, Math.max(0, Math.round(newValue / 20)));
      const speedMap = [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10, 86400 * 365.25 * 100];
      if (timeMult !== speedMap[stepIdx]) {
        handleTimeMultChange(speedMap[stepIdx]);
      }
    }
  };

  const handlePointerUp = () => {
    setIsDraggingElastic(false);
    setElasticOverflow(0);
    
    const speedMap = [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10, 86400 * 365.25 * 100];
    const idx = speedMap.indexOf(timeMult);
    if (idx !== -1) {
      setElasticValue(idx * 20);
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
      {isSimulatorRunning && (
        <div className="absolute inset-0 z-0">
          <Galaxy transparent={false} mouseInteraction={false} />
        </div>
      )}
      {!isSimulatorRunning && (
        <div className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000">
          <Galaxy transparent={false} mouseInteraction={false} scrollProgressRef={scrollProgressRef} />
        </div>
      )}
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
        isCinematic={!isSimulatorRunning}
        cinematicScrollRef={scrollProgressRef}
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
        className={`landing-scroller absolute inset-0 z-20 flex flex-col transition-opacity duration-1000 ${isSimulatorRunning ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto overflow-y-auto"}`}
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
              ariaLabel: 'GitHub Srinivasa', 
              link: 'https://github.com/UtkarshSharma000/Srinivasa',
              image: 'https://images.unsplash.com/photo-1618477247222-ac60c7477123?q=80&w=2064&auto=format&fit=crop'
            },
          ]}
          socialItems={[]}
        />

        <main className="">
          <LandingHero
            isSimulatorRunning={isSimulatorRunning}
            setIsSimulatorRunning={setIsSimulatorRunning}
            landingScrollRef={landingScrollRef}
          />

          <InteractiveBridge />

          <SpaceExplorationPanel
            cinematicSectionRef={cinematicSectionRef}
            scrollProgressRef={scrollProgressRef}
            landingScrollRef={landingScrollRef}
          />

          <MathPhysicsShowcase
            setIsSimulatorRunning={setIsSimulatorRunning}
            landingScrollRef={landingScrollRef}
          />
        </main>
      </div>

      {/* Simulator Overlay UI */}
      <div
        className={`absolute inset-0 z-30 pointer-events-none flex flex-col transition-opacity duration-1000 ${isSimulatorRunning ? "opacity-100" : "opacity-0"}`}
      >
        {/* CRT Scanline horizontal banding filter */}
        <div className="scanlines z-50 pointer-events-none absolute inset-0"></div>
        {/* TrajectoryOptimizer removed per user request */}
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900 pointer-events-auto">
            <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-3xl border border-gray-700 shadow-2xl flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
                <h2 className="font-display-lg text-3xl text-white tracking-widest">FLIGHT HISTORY</h2>
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
        {/* Clean, authentic background without vibecoded flat overlays */}

        {/* TopAppBar */}
        <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 h-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="flex items-center gap-6 pointer-events-auto">
            <img src="/logo.svg" alt="Srinivasa" className="w-12 h-12 relative -top-0.5" />
            <div className="flex items-center gap-10">
              <h1 className="font-display-lg text-2xl tracking-tighter text-white"><span className="text-secondary font-bold">SRINIVASA</span></h1>
              <nav className="hidden md:flex gap-10">
                <a className="font-label-caps text-[10px] tracking-[0.15em] text-secondary border-b border-secondary/50 pb-1 cursor-pointer">FLIGHT PATH</a>
                <a onClick={() => setIsArchiveOpen(true)} className="font-label-caps text-[10px] tracking-[0.15em] text-white/60 hover:text-secondary transition-colors cursor-pointer">FLIGHT HISTORY</a>
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
                  <div ref={targetSelectorNodeRef} className="pointer-events-auto flex items-center gap-4 px-3 py-2 rounded-full border border-cyan-400/20 bg-[#07131e]/70 shadow-[0_0_30px_rgba(30,130,246,0.15)] backdrop-blur-md">
                    <div className="target-drag-handle opacity-60 cursor-move hover:opacity-100 flex items-center pr-2 border-r border-white/10 text-cyan-200">
                      <Move size={14} />
                    </div>
                    <button 
                      onClick={() => setSelectedTarget(null)}
                      className={`px-3 py-1 text-[10px] uppercase tracking-widest font-mono rounded-full border transition-all ${!selectedTarget ? 'border-cyan-400 bg-cyan-500/20 text-cyan-50 font-bold scale-105 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-transparent text-cyan-200/60 hover:text-cyan-100 hover:bg-cyan-500/10'}`}
                      title="Center camera on Sun"
                    >
                      SOL (SUN)
                    </button>
                    <div className="w-[1px] h-4 bg-cyan-400/20"></div>
                    <div className="flex gap-2">
                      {PLANETS.map((p) => (
                        <button
                          key={p.name}
                          onClick={() => setSelectedTarget(p)}
                          className={`w-9 h-9 rounded-full border-2 overflow-hidden cursor-pointer transition-all flex items-center justify-center relative group ${selectedTarget?.name === p.name ? "border-cyan-300 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.6)]" : "border-transparent opacity-70 hover:opacity-100 hover:border-cyan-400/50"}`}
                          title={p.name}
                        >
                          <img
                            src={p.texture}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#07131e] text-[8px] tracking-widest font-mono border border-cyan-500/30 text-cyan-100 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {p.name.toUpperCase()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Draggable>
              </div>
            )}

          </main>
        </div>

          {/* New Interactive Cockpit Footer Simulation Control Center */}
          <footer className="absolute bottom-4 left-0 w-full z-45 px-8 pointer-events-auto select-none">
            <div className="w-full max-w-5xl mx-auto glass-panel rounded-2xl flex flex-col bg-cyan-950/20 border border-cyan-500/20 shadow-[0_0_30px_rgba(30,130,246,0.15)] backdrop-blur-xl">
              {/* Top curved header section for 'REAL RATE' */}
              <div className="relative flex justify-center -mt-3.5">
                <div className="glass-panel px-6 py-1 rounded-t-lg text-[10px] font-bold neon-text bg-cyan-950/80 border-b-0 border-cyan-500/30 font-mono tracking-[0.2em] text-[#aaddff]">
                  {timeMult === 0 ? "STATUS: PAUSED" : timeMult === 1 ? "REALTIME VELOCITY" : `WARP SPEED: x${timeMult.toLocaleString()}`}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 md:p-6 gap-4 font-mono">
                {/* Left Side: Status & Heartbeat */}
                <div className="flex items-center gap-4 w-1/4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full pulse-dot ${timeMult === 0 ? 'bg-amber-500' : 'bg-cyan-400'}`}></div>
                    <span className="text-white font-bold tracking-widest text-xs">
                      {timeMult === 0 ? "PAUSED" : "ACTIVE"}
                    </span>
                  </div>
                  <div className="text-[10px] text-cyan-200/50 tracking-widest hidden lg:block">
                    J2000 +{Math.max(0, Math.floor(globalTimeRef.current)).toString().padStart(8, '0')}s
                  </div>
                </div>

                {/* Center: Playback Speed Control Timeline with Sigmoid Stretching */}
                <div className="flex-1 flex flex-col items-center gap-3">
                  {/* Digital Controls buttons */}
                  <div className="flex items-center gap-3">
                    {/* Slow down button */}
                    <button 
                      onClick={() => {
                        const warpSpeeds = [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10, 86400 * 365.25 * 100];
                        const currIdx = warpSpeeds.indexOf(timeMult);
                        if (currIdx > 0) {
                          handleTimeMultChange(warpSpeeds[currIdx - 1]);
                        } else if (timeMult === 0) {
                          handleTimeMultChange(1);
                        }
                      }}
                      className="control-btn p-1.5 bg-cyan-950/30 rounded border border-cyan-500/10 text-cyan-200/80 hover:text-white hover:border-cyan-400 focus:outline-none"
                      title="Decrease Velocity Rate"
                    >
                      <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
                        <polygon points="19 20 9 12 19 4 19 20"></polygon>
                        <line x1="5" x2="5" y1="19" y2="5"></line>
                      </svg>
                    </button>

                    {/* Pause / Play button */}
                    <button 
                      onClick={() => {
                        if (timeMult > 0) {
                          lastTimeMultRef.current = timeMult;
                          handleTimeMultChange(0);
                        } else {
                          handleTimeMultChange(lastTimeMultRef.current || 86400);
                        }
                      }}
                      className={`control-btn px-3 py-1.5 rounded border text-xs focus:outline-none transition-all duration-300 ${
                        timeMult === 0 
                          ? 'bg-amber-500/10 border-amber-400 text-amber-300 font-bold shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                          : 'bg-cyan-950/30 border-cyan-500/20 text-cyan-200 hover:text-white'
                      }`}
                      title={timeMult === 0 ? "Resume Simulation" : "Pause Simulation"}
                    >
                      {timeMult === 0 ? (
                        <div className="flex items-center gap-1.5">
                          <svg fill="currentColor" height="10" viewBox="0 0 24 24" width="10" className="relative top-px">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                          </svg>
                          RESUME
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <svg fill="currentColor" height="10" viewBox="0 0 24 24" width="10">
                            <rect height="16" width="4" x="6" y="4"></rect>
                            <rect height="16" width="4" x="14" y="4"></rect>
                          </svg>
                          PAUSE
                        </div>
                      )}
                    </button>

                    {/* Speed up button */}
                    <button 
                      onClick={() => {
                        const warpSpeeds = [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10, 86400 * 365.25 * 100];
                        const currIdx = warpSpeeds.indexOf(timeMult);
                        if (currIdx !== -1 && currIdx < warpSpeeds.length - 1) {
                          handleTimeMultChange(warpSpeeds[currIdx + 1]);
                        } else if (timeMult === 0) {
                          handleTimeMultChange(lastTimeMultRef.current || 86400);
                        }
                      }}
                      className="control-btn p-1.5 bg-cyan-950/30 rounded border border-cyan-500/10 text-cyan-200/80 hover:text-white hover:border-cyan-400 focus:outline-none"
                      title="Increase Velocity Rate"
                    >
                      <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
                        <polygon points="5 4 15 12 5 20 5 4"></polygon>
                        <line x1="19" x2="19" y1="5" y2="19"></line>
                      </svg>
                    </button>
                  </div>

                  {/* Tactile elastic drag container */}
                  <div className="w-full px-6 relative">
                    <div 
                      ref={elasticTrackRef}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      className="elastic-slider-container"
                      id="elastic-slider"
                    >
                      {/* Elastic Left Warp-Backward icon */}
                      <svg 
                        className={`elastic-icon left-icon ${elasticOverflow < -5 ? 'active' : ''}`} 
                        fill="none" 
                        height="12" 
                        stroke="currentColor" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2.5" 
                        viewBox="0 0 24 24" 
                        width="12"
                        style={{
                          transform: `translateY(-50%) translateX(${elasticOverflow < 0 ? elasticOverflow : 0}px)`,
                          left: `${-20 + (elasticOverflow < 0 ? elasticOverflow : 0)}px`,
                          transition: isDraggingElastic ? 'none' : 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                      >
                        <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"></path>
                      </svg>

                      {/* Elastic stretch track component */}
                      <div 
                        className="elastic-track-wrapper w-full h-[3px]"
                        style={{
                          transform: `scaleX(${
                            elasticTrackRef.current
                              ? (elasticTrackRef.current.getBoundingClientRect().width + Math.abs(elasticOverflow)) / elasticTrackRef.current.getBoundingClientRect().width
                              : 1
                          })`,
                          transformOrigin: elasticOverflow < 0 ? 'right center' : 'left center',
                          transition: isDraggingElastic ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                      >
                        <div 
                          className="elastic-track-fill" 
                          style={{
                            width: `${elasticOverflow < 0 ? 0 : elasticOverflow > 0 ? 100 : elasticValue}%`,
                            transition: isDraggingElastic ? 'none' : 'width 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                          }}
                        ></div>
                        <div 
                          className="elastic-thumb" 
                          style={{
                            left: `${elasticOverflow < 0 ? 0 : elasticOverflow > 0 ? 100 : elasticValue}%`,
                            transition: isDraggingElastic ? 'none' : 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                          }}
                        ></div>
                      </div>

                      {/* Elastic Right Warp-Forward icon */}
                      <svg 
                        className={`elastic-icon right-icon ${elasticOverflow > 5 ? 'active' : ''}`} 
                        fill="none" 
                        height="12" 
                        stroke="currentColor" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2.5" 
                        viewBox="0 0 24 24" 
                        width="12"
                        style={{
                          transform: `translateY(-50%) translateX(${elasticOverflow > 0 ? elasticOverflow : 0}px)`,
                          right: `${-20 - (elasticOverflow > 0 ? elasticOverflow : 0)}px`,
                          transition: isDraggingElastic ? 'none' : 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                      >
                        <path d="M13 17l5-5-5-5M6 17l5-5-5-5"></path>
                      </svg>
                    </div>

                    {/* Highly aesthetic metric reference timeline index steps */}
                    <div className="w-full flex justify-between text-cyan-200/30 text-[8px] tracking-[0.16em] -mt-2.5 px-2 select-none">
                      {["(1 SEC)", "DAY", "MONTH", "YEAR", "DECADE", "CENTURY"].map((label, idx) => (
                        <span 
                          key={idx} 
                          className={`transition-all duration-200 cursor-pointer hover:text-cyan-200 text-center flex flex-col items-center gap-0.5 ${
                            timeMult === [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10, 86400 * 365.25 * 100][idx]
                              ? 'text-cyan-300 font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] scale-105'
                              : ''
                          }`}
                          onClick={() => {
                            const speedMap = [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10, 86400 * 365.25 * 100];
                            handleTimeMultChange(speedMap[idx]);
                          }}
                        >
                          <div className={`w-[1px] h-1.5 bg-cyan-500/30 mb-0.5 ${timeMult === [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10, 86400 * 365.25 * 100][idx] ? 'bg-cyan-300 h-2.5' : ''}`}></div>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Side: Re-trigger solar centering & current system clock */}
                <div className="flex items-center justify-end gap-5 w-1/4">
                  <div className="text-[11px] text-cyan-100 tracking-[0.15em] hidden lg:block text-right">
                    UTC {new Date().toISOString().split('T')[1].slice(0, 8)}
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedTarget(null);
                      setResetCameraTrigger(prev => prev + 1);
                    }}
                    className="control-btn px-4 py-1.5 rounded border border-cyan-500/20 bg-cyan-950/20 hover:border-cyan-400/50 hover:bg-cyan-500/10 text-cyan-200 font-bold text-[9px] tracking-widest uppercase transition-all"
                    title="Recenter Camera on Sun"
                  >
                    RECENTER SOL
                  </button>
                </div>
              </div>
            </div>
            
            {/* Fine print lab citation in margin to ground the deck beautifully */}
            <div className="w-full text-center text-[7px] tracking-[0.3em] text-cyan-500/20 mt-3 uppercase font-mono">
              ODYSSEY ASTRODYNAMICS RESEARCH LAB • MISSION CODES: GRENINJA
            </div>
          </footer>
      </div>
    </div>
  );
}
