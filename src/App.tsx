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

const J2000_UNIX = 946728000;

const PLANET_STATS: Record<string, { mass: string; gravity: string; atmosphere: string; temp: string }> = {
  "Mercury": { mass: "3.30 × 10²³ kg", gravity: "3.7 m/s²", atmosphere: "None / Exosphere", temp: "167 °C" },
  "Venus": { mass: "4.87 × 10²⁴ kg", gravity: "8.9 m/s²", atmosphere: "Dense CO₂ (96.5%)", temp: "464 °C" },
  "Earth": { mass: "5.97 × 10²⁴ kg", gravity: "9.8 m/s²", atmosphere: "N₂ (78%), O₂ (21%)", temp: "15 °C" },
  "Mars": { mass: "6.42 × 10²³ kg", gravity: "3.7 m/s²", atmosphere: "Thin CO₂ (95.3%)", temp: "-65 °C" },
  "Jupiter": { mass: "1.90 × 10²⁷ kg", gravity: "24.8 m/s²", atmosphere: "H₂ (89.8%), He (10.2%)", temp: "-110 °C" },
  "Saturn": { mass: "5.68 × 10²⁶ kg", gravity: "10.4 m/s²", atmosphere: "H₂ (96.3%), He (3.2%)", temp: "-140 °C" },
  "Uranus": { mass: "8.68 × 10²⁵ kg", gravity: "8.7 m/s²", atmosphere: "H₂, He, CH₄", temp: "-195 °C" },
  "Neptune": { mass: "1.02 × 10²⁶ kg", gravity: "11.2 m/s²", atmosphere: "H₂, He, CH₄", temp: "-200 °C" },
};

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

  const handleSelectPlanet = (planetName: string) => {
    if (planetName === "Sol (Sun)") {
      setSelectedTarget(null);
      setTargetPlanet(null);
    } else {
      const found = PLANETS.find(p => p.name === planetName);
      if (found) {
        setSelectedTarget(found);
        if (planetName !== "Earth") {
          setTargetPlanet(planetName);
        } else {
          setTargetPlanet(null);
        }
      }
    }
  };

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
        className={`absolute inset-0 z-30 pointer-events-none flex transition-opacity duration-1000 ${isSimulatorRunning ? "opacity-100" : "opacity-0"}`}
      >
        {isSimulatorRunning && (
          <div className="relative w-full h-full flex pointer-events-none">
            {/* System Select Sidebar (Left) */}
            <div className="w-72 h-full border-r border-zinc-850 bg-[#020202]/95 text-white flex flex-col pointer-events-auto z-40 font-mono">
              <div className="p-6 border-b border-zinc-90 w-full flex flex-col gap-1 select-none">
                <span className="text-[11px] font-bold tracking-[0.25em] text-white uppercase font-display-lg">SYSTEM SELECT</span>
                <span className="text-[8px] text-zinc-500 tracking-[0.1em] uppercase">Centering focal target</span>
              </div>

              {/* Planet Menu List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-none select-none">
                <button
                  onClick={() => handleSelectPlanet("Sol (Sun)")}
                  className={`w-full text-left px-4 py-2.5 text-[10px] tracking-wider uppercase font-medium flex items-center justify-between border transition-all cursor-pointer ${
                    !selectedTarget
                      ? 'bg-white text-black border-white font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${!selectedTarget ? 'bg-black' : 'bg-zinc-650'}`}></span>
                    SOL (SUN)
                  </span>
                </button>

                {PLANETS.map((p) => {
                  const isSel = selectedTarget?.name === p.name;
                  return (
                    <button
                      key={p.name}
                      onClick={() => handleSelectPlanet(p.name)}
                      className={`w-full text-left px-4 py-2 text-[10px] tracking-wider uppercase font-medium flex items-center justify-between border transition-all cursor-pointer ${
                        isSel
                          ? 'bg-white text-black border-white font-bold'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-black' : 'bg-zinc-650'}`}></span>
                        {p.name.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mission Control Panel (Integrated Launch Control) */}
              <div className="p-5 border-t border-zinc-850 bg-[#050505]/60 flex flex-col gap-3.5 w-full">
                <div className="flex flex-col gap-0.5 select-none">
                  <span className="text-[9px] tracking-[0.2em] text-zinc-500 font-bold uppercase">MISSION CONTROL</span>
                  {isLaunched ? (
                    <span className="text-[8px] text-emerald-400 tracking-wider">ACTIVE FLIGHT PATH</span>
                  ) : (
                    <span className="text-[8px] text-zinc-500 tracking-wider">STANDBY FOR IGNITION</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 p-3 border border-zinc-800 bg-[#08080a] text-[9px] font-mono leading-relaxed select-none">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">LAUNCHPAD</span>
                    <span className="text-zinc-300 font-bold uppercase">{launchPlanet || "Earth"}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-900 pt-1.5 mt-1">
                    <span className="text-zinc-500">TARGET</span>
                    <span className="text-zinc-300 font-bold uppercase">{targetPlanet || selectedTarget?.name || "NONE"}</span>
                  </div>
                </div>

                {/* Primary Control Buttons */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      if (isLaunched) {
                        setIsLaunched(false);
                        setMissionLegs(null);
                        setTargetPlanet(null);
                        setReturnWindow(null);
                        setLaunchPlanet("Earth");
                        teiAppliedRef.current = false;
                        setCurrentLaunchPoints([]);
                        setCurrentReturnPoints([]);
                        setMissionStatus("STANDBY");
                      } else {
                        handleLaunch();
                      }
                    }}
                    className={`w-full py-2.5 px-4 font-mono font-bold tracking-widest text-[9px] uppercase border transition-all cursor-pointer ${
                      isLaunched
                        ? 'border-red-500/30 text-red-400 bg-red-950/20 hover:bg-red-950/40'
                        : 'border-white text-white bg-transparent hover:bg-white hover:text-black font-semibold'
                    }`}
                  >
                    {isLaunched ? "ABORT FLIGHT" : "ENGAGE FLIGHT"}
                  </button>

                  {isLaunched && missionStatus === 'EARTH_ORBIT' && (
                    <button
                      onClick={() => {
                        const missionArchive = {
                          id: completedMissions,
                          targetPlanet: selectedTarget?.name || targetPlanet,
                          returnPlanet: "Earth",
                          orbitType: missionStatus,
                          offset: completedMissions * (Math.PI / 4),
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
                      className="w-full py-2 px-4 font-mono font-bold tracking-widest text-[9px] uppercase border border-emerald-500/30 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40 rounded transition-colors cursor-pointer"
                    >
                      SAVE FLIGHT RECORD
                    </button>
                  )}

                  {isLaunched && missionStatus && missionStatus.includes('ORBIT') && missionStatus !== 'EARTH_ORBIT' && (
                    <div className="flex flex-col gap-2 mt-1">
                      <button
                        onClick={() => planReturn()}
                        className="w-full py-2 text-zinc-300 hover:text-white border border-zinc-700 bg-zinc-900 rounded font-mono tracking-widest text-[8px] uppercase transition-colors cursor-pointer"
                      >
                        PLAN RETURN
                      </button>

                      {returnWindow && (
                        <div className="p-3 bg-zinc-950 rounded border border-zinc-805 flex flex-col gap-2 text-[8px]">
                          <div className="flex justify-between">
                            <span className="text-zinc-500">TIME OF FLIGHT</span>
                            <span className="text-zinc-300">{returnWindow.tof_days} DAYS</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-505">SPEED CHANGE:</span>
                            <span className="text-zinc-300">{returnWindow.dv1_kms.toFixed(2)} KM/S</span>
                          </div>
                          <button
                            onClick={() => {
                              handleApply(returnWindow);
                              setIsLaunched(true);
                            }}
                            className="w-full py-1.5 bg-white text-black hover:bg-zinc-200 uppercase tracking-wider rounded font-bold text-[8px] transition-colors cursor-pointer"
                          >
                            ENGAGE RETURN
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Menu Action Footers */}
              <div className="p-5 border-t border-zinc-850 bg-[#020202] flex flex-col gap-1.5 font-mono text-[9px] w-full select-none">
                <button
                  onClick={() => setIsArchiveOpen(true)}
                  className="w-full py-2 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 bg-zinc-950 rounded flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">history</span>
                  FLIGHT HISTORY ({archivedMissions.length})
                </button>

                <button
                  onClick={() => setIsSimulatorRunning(false)}
                  className="w-full py-2 text-zinc-505 hover:text-red-400 border border-transparent hover:bg-red-950/10 rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut size={10} className="rotate-180" />
                  EXIT SIMULATOR
                </button>
              </div>
            </div>

            {/* Planet Detail Information Card (Top Right) */}
            {selectedTarget && (
              <div className="absolute top-8 right-8 pointer-events-auto z-40 select-none">
                <div className="w-80 border border-zinc-850 bg-[#020202]/95 text-white p-5 rounded font-mono">
                  <div className="flex justify-between items-center border-b border-zinc-85 w-full pb-3 mb-4">
                    <div className="flex flex-col gap-0.5">
                      <h2 className="text-xs font-bold tracking-[0.25em] text-white uppercase font-display-lg">{selectedTarget.name}</h2>
                      <span className="text-[8px] text-zinc-500 tracking-[0.1em] uppercase">SYSTEM COORDINATES</span>
                    </div>
                    {/* Double Concentric SVG Radar Ring Animation */}
                    <div className="relative w-8 h-8 flex items-center justify-center">
                      <div className="absolute w-7 h-7 rounded-full border border-dashed border-zinc-700 animate-[spin_20s_linear_infinite]" />
                      <div className="absolute w-5 h-5 rounded-full border border-dashed border-zinc-500 animate-[spin_10s_linear_infinite]" />
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    </div>
                  </div>

                  {/* Physical Metrics */}
                  <div className="flex flex-col text-[9px] gap-2.5">
                    <div className="flex justify-between border-b border-dashed border-zinc-90 pb-1.5">
                      <span className="text-zinc-500 uppercase tracking-wider">MASS</span>
                      <span className="text-zinc-300 font-medium">
                        {PLANET_STATS[selectedTarget.name]?.mass || "1.99 × 10³⁰ kg"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-zinc-90 pb-1.5">
                      <span className="text-zinc-500 uppercase tracking-wider">GRAVITY</span>
                      <span className="text-zinc-300 font-medium">
                        {PLANET_STATS[selectedTarget.name]?.gravity || "274 m/s²"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-zinc-90 pb-1.5">
                      <span className="text-zinc-500 uppercase tracking-wider">ATMOSPHERE</span>
                      <span className="text-zinc-300 font-medium text-right">
                        {PLANET_STATS[selectedTarget.name]?.atmosphere || "None"}
                      </span>
                    </div>
                    <div className="flex justify-between pb-0.5">
                      <span className="text-zinc-500 uppercase tracking-wider">TEMP (AVG)</span>
                      <span className="text-zinc-300 font-medium font-sans">
                        {PLANET_STATS[selectedTarget.name]?.temp || "5500 °C"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Playback Control Panel (Bottom Center-Right) */}
            <div className="absolute bottom-6 left-[320px] right-8 pointer-events-auto z-40 select-none">
              <div className="bg-[#020202]/95 border border-zinc-850 rounded p-4 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-white shadow-xl">
                {/* Rate text indicator */}
                <div className="flex items-center gap-3 w-full md:w-1/4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${timeMult === 0 ? 'bg-amber-500 animate-pulse' : 'bg-white animate-pulse'}`}></span>
                    <span className="text-[10px] font-bold tracking-widest text-zinc-300">
                      {timeMult === 0 ? "PAUSED" : "ACTIVE: " + (timeMult === 1 ? "REAL RATE" : `WARP x${timeMult.toLocaleString()}`)}
                    </span>
                  </div>
                </div>

                {/* Playback Action Buttons */}
                <div className="flex items-center gap-4">
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
                    className="p-1 px-3 border border-zinc-800 hover:border-white text-zinc-450 hover:text-white rounded text-xs cursor-pointer transition-colors"
                    title="Decrease speed"
                  >
                    &lt;&lt;
                  </button>

                  <button
                    onClick={() => {
                      if (timeMult > 0) {
                        lastTimeMultRef.current = timeMult;
                        handleTimeMultChange(0);
                      } else {
                        handleTimeMultChange(lastTimeMultRef.current || 86400);
                      }
                    }}
                    className={`px-4 py-1 border rounded text-xs font-bold cursor-pointer transition-colors h-6 flex items-center justify-center ${
                      timeMult === 0
                        ? 'border-amber-500/50 text-amber-400 bg-amber-950/20'
                        : 'border-zinc-800 text-zinc-350 hover:text-white hover:border-white'
                    }`}
                  >
                    {timeMult === 0 ? "PLAY" : "PAUSE"}
                  </button>

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
                    className="p-1 px-3 border border-zinc-800 hover:border-white text-zinc-455 hover:text-white rounded text-xs cursor-pointer transition-colors"
                    title="Increase speed"
                  >
                    &gt;&gt;
                  </button>
                </div>

                {/* Clock UTC Date Information */}
                <div className="w-full md:w-1/3 flex flex-col md:items-end gap-0.5 text-right text-[10px] text-zinc-400 select-all">
                  <div>
                    SIM TIME: {new Date((J2000_UNIX + globalTimeRef.current) * 1000).toUTCString().split(' ').slice(1, 4).join('-').toUpperCase()}
                  </div>
                  <div className="text-[9px] text-zinc-650">
                    SEC +{Math.max(0, Math.floor(globalTimeRef.current)).toString().padStart(9, '0')} || {new Date((J2000_UNIX + globalTimeRef.current) * 1000).toUTCString().split(' ')[4]} UTC
                  </div>
                </div>
              </div>

              {/* Speed reference text scale marks */}
              <div className="flex justify-between text-zinc-600 text-[8px] tracking-widest uppercase mt-1.5 px-4">
                {["Real-time", "1 Day/s", "30 Days/s", "1 Year/s", "10 Years/s", "100 Years/s"].map((label, idx) => {
                  const speeds = [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10, 86400 * 365.25 * 100];
                  const active = timeMult === speeds[idx];
                  return (
                    <span
                      key={idx}
                      onClick={() => handleTimeMultChange(speeds[idx])}
                      className={`cursor-pointer hover:text-white transition-colors ${active ? 'text-white font-bold' : ''}`}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 pointer-events-auto font-mono text-white p-6">
            <div className="bg-[#020202] p-8 rounded border border-zinc-800 w-full max-w-2xl flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-800">
                <h2 className="text-xs font-bold tracking-[0.25em] text-white uppercase">FLIGHT HISTORY</h2>
                <button 
                  onClick={() => setIsArchiveOpen(false)}
                  className="px-3 py-1 text-[10px] text-zinc-400 hover:text-white border border-zinc-850 hover:border-zinc-700 rounded transition-colors cursor-pointer"
                >
                  CLOSE
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-none">
                {archivedMissions.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600 text-xs tracking-widest uppercase">
                    NO MISSIONS ARCHIVED YET
                  </div>
                ) : (
                  archivedMissions.map((m) => (
                    <div key={m.id} className="p-4 rounded border border-zinc-900 bg-zinc-950/40 flex justify-between items-center group hover:border-white/25 transition-colors">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-white text-[8px] font-bold tracking-widest border border-white/10">
                            MISSION {String(m.id + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[8px] text-zinc-500 tracking-widest uppercase">
                            {m.orbitType ? m.orbitType.replace("_", " ") : "TRANSFER"}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          {m.launchPlanet.toUpperCase()} &rarr; {m.targetPlanet?.toUpperCase() || "DEEP SPACE"}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleReplay(m)}
                        className="px-4 py-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-white hover:border-white transition-all text-[9px] tracking-wider uppercase flex items-center gap-1.5 cursor-pointer"
                      >
                        REPLAY
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
