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
import ShaderBackground from "./components/ShaderBackground";

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
  const [showWireframe, setShowWireframe] = useState(false);
  const [showOrbits, setShowOrbits] = useState(true);
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
    <div className="w-full h-screen relative bg-background text-on-background overflow-hidden tech-grid-bg flex flex-col selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Backgrounds - Always mounted for WebGL stability */}
      <div className={`absolute inset-0 transition-opacity duration-1000 z-0 pointer-events-none ${isSimulatorRunning ? 'opacity-100' : 'opacity-0'}`}>
        <ShaderBackground />
      </div>

      <div className={`fixed inset-0 transition-opacity duration-1000 z-0 ${!isSimulatorRunning ? 'opacity-100 pointer-events-none' : 'opacity-0 pointer-events-none'}`}>
        <Galaxy transparent={false} mouseInteraction={false} scrollProgressRef={scrollProgressRef} />
      </div>

      <div className={`absolute inset-0 flex flex-col transition-opacity duration-1000 ${isSimulatorRunning ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-[-1]'}`}>
        <div className="scanline z-50 pointer-events-none"></div>
        <div className="crosshair z-50 pointer-events-none"></div>
        <div className="framing-corner corner-tl z-50 pointer-events-none"></div>
        <div className="framing-corner corner-tr z-50 pointer-events-none"></div>
        <div className="framing-corner corner-bl z-50 pointer-events-none"></div>
        <div className="framing-corner corner-br z-50 pointer-events-none"></div>

        {/* TopAppBar - Kinetic Brutalism */}
        <header className="border-draw flex justify-between items-center w-full px-margin h-16 border-b-2 border-outline-variant bg-surface-container-lowest/90 backdrop-blur-sm flex-shrink-0 z-50">
            <div className="flex items-center gap-gutter">
              <h1 className="text-headline-lg font-bold text-primary-fixed tracking-tighter uppercase jitter-text">SOLAR_OS//V.02</h1>
            </div>
            <div className="flex items-center gap-margin text-telemetry-xs">
              <span className="text-secondary tracking-widest hidden sm:inline">SEQ_ALIGN: <span className="text-primary-fixed fast-pulse">OK</span></span>
              <span className="text-secondary tracking-widest hidden sm:inline">23:59:01 UTC</span>
              <span className="text-primary-fixed border-l-2 border-outline-variant pl-4 hidden md:inline">[OP_ID: 8829_BETA]</span>
              <div className="flex gap-2 text-primary-fixed">
                <span className="material-symbols-outlined fast-pulse text-[14px]">sensors</span>
              </div>
              <button onClick={() => setIsSimulatorRunning(false)} className="border-draw nav-item-hover flex items-center justify-center p-2 bg-black border-2 border-outline-variant text-[10px] text-secondary hover:text-primary-fixed transition-none uppercase cursor-pointer">
                <LogOut size={14} className="rotate-180 mr-1" /> EXIT
              </button>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden relative w-full h-full">
            {/* SideNavBar (Desktop) */}
            <nav className="border-draw hidden lg:flex flex-col h-full border-r-2 border-outline-variant p-panel-padding bg-surface-container-lowest/90 backdrop-blur-md w-64 flex-shrink-0 z-40">
              <div className="mb-4 border-b-2 border-outline-variant pb-2 stagger-in">
                <h2 className="text-label-sm font-bold text-on-surface tracking-widest uppercase">TACTICAL_NAV</h2>
                <p className="text-[9px] text-secondary mt-1 tracking-widest uppercase">Select Target</p>
              </div>
              <ul className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
                <li className="stagger-in">
                  <button
                    onClick={() => handleSelectPlanet("Sol (Sun)")}
                    className={`w-full nav-item-hover flex items-center justify-between p-1.5 text-[10px] uppercase font-bold border-2 transition-none cursor-pointer ${
                      !selectedTarget
                        ? 'bg-primary-container text-on-primary-container border-primary-fixed'
                        : 'text-secondary border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-none ${!selectedTarget ? 'bg-on-primary-fixed' : 'bg-primary-fixed fast-pulse'}`}></span>
                      0.0 SOL [SUN]
                    </div>
                    {!selectedTarget && <span className="text-[8px] opacity-70 tracking-widest">LOCKED</span>}
                  </button>
                </li>

                {PLANETS.map((p, idx) => {
                  const isSel = selectedTarget?.name === p.name;
                  return (
                    <li key={p.name} className="stagger-in text-left">
                      <button
                        onClick={() => handleSelectPlanet(p.name)}
                        className={`w-full nav-item-hover flex items-center justify-between p-1.5 text-[10px] uppercase font-bold border-2 transition-none cursor-pointer ${
                          isSel
                            ? 'bg-primary-container text-on-primary-container border-primary-fixed'
                            : 'text-secondary border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-none ${isSel ? 'bg-on-primary-fixed' : 'bg-primary-fixed'}`}></span>
                          {idx + 1}.0 {p.name.toUpperCase()}
                        </div>
                        {isSel && <span className="text-[8px] opacity-70 tracking-widest">LOCKED</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              
              <div className="mt-auto pt-2 border-t-2 border-outline-variant flex flex-col gap-1.5 stagger-in">
                {/* Mission Action Integration */}
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
                  className={`w-full py-2 font-bold tracking-widest text-[9px] uppercase border-2 transition-none cursor-pointer nav-item-hover flex items-center justify-center gap-2 ${
                    isLaunched
                      ? 'border-error text-error bg-error/10'
                      : 'border-primary-fixed text-primary-fixed bg-primary-fixed/10'
                  }`}
                >
                  {isLaunched ? "ABORT FLIGHT" : "INIT_LAUNCH_SEQ"}
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
                    className="w-full py-1.5 tracking-widest text-[9px] uppercase border-2 border-primary-fixed text-primary-fixed bg-surface-container-lowest transition-none cursor-pointer nav-item-hover"
                  >
                    ARCHIVE RECORD
                  </button>
                )}

                {isLaunched && missionStatus && missionStatus.includes('ORBIT') && missionStatus !== 'EARTH_ORBIT' && (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => planReturn()}
                      className="w-full py-1.5 text-secondary border-2 border-outline-variant rounded-none text-[8px] uppercase transition-none cursor-pointer nav-item-hover"
                    >
                      PLAN RETURN
                    </button>

                    {returnWindow && (
                      <div className="p-2 border-2 border-primary-fixed bg-surface text-[8px] flex flex-col gap-1 text-primary-fixed font-bold">
                        <div className="flex justify-between">
                          <span className="opacity-70">TOF:</span>
                          <span>{returnWindow.tof_days}D</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70">∆V:</span>
                          <span>{returnWindow.dv1_kms.toFixed(2)} KM/S</span>
                        </div>
                        <button
                          onClick={() => {
                            handleApply(returnWindow);
                            setIsLaunched(true);
                          }}
                          className="w-full py-1 bg-primary-fixed text-on-primary-fixed uppercase tracking-wider text-[8px] cursor-pointer mt-1 font-black"
                        >
                          ENGAGE RETURN
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Deep Space Pings Terminal Logs */}
                <div className="border-t-2 border-outline-variant pt-2 mt-2 h-28 flex flex-col pointer-events-auto">
                  <span className="text-[8px] text-primary-fixed mb-1 uppercase font-bold tracking-widest">DEEP_SPACE_PINGS</span>
                  <div className="flex-1 bg-black border-2 border-outline-variant p-1 text-[8px] text-secondary overflow-hidden relative font-sans leading-tight">
                    <div className="absolute w-full h-full terminal-content flex flex-col gap-0.5">
                      <div>&gt; PING SGNL_01.. <span className="text-primary-fixed">ACK</span></div>
                      <div>&gt; RADAR_SWEEP... <span className="text-primary-fixed">CLR</span></div>
                      <div>&gt; TEL_SYNC...... <span className="text-primary-fixed">OK</span></div>
                      <div>&gt; RECALIBRATING. <span className="text-primary-fixed">DNE</span></div>
                      <div>&gt; SYS_OP........ <span className="text-primary-fixed">RDY</span></div>
                      <div>&gt; CALC_ORBIT.... <span className="text-primary-fixed">OK</span></div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsArchiveOpen(!isArchiveOpen)}
                  className="mt-1 nav-item-hover flex items-center justify-between p-2 text-secondary border-2 border-outline-variant bg-surface transition-none text-[9px] uppercase cursor-pointer"
                >
                  <span>SYS_HISTORY</span>
                  <span className="bg-primary-fixed text-on-primary-fixed px-1 font-bold">
                    {archivedMissions.length}
                  </span>
                </button>
              </div>
            </nav>

            {/* 3D Canvas Main */}
            <main className="flex-1 relative flex flex-col bg-transparent z-10 p-0 m-[12px] border-2 border-outline-variant">
              <div className="absolute inset-0 z-0 pointer-events-auto">
                <OrbitSimulator 
                  isRunning={true}
                  isCinematic={false}
                  cinematicScrollRef={scrollProgressRef}
                  globalTimeRef={globalTimeRef} 
                  launchParams={{ v0, pitch, yaw, nbody, launchPlanet, launchLocation, targetLocation, targetPlanet, timeMult, isLaunched, launchDay_j2000: globalTimeRef.current, missionLegs }}
                  timeMult={timeMult} 
                  activeReplay={activeReplay}
                  archivedMissions={archivedMissions}
                  resetCameraTrigger={resetCameraTrigger}
                  selectedTarget={selectedTarget}
                  onStatusUpdate={setMissionStatus}
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
                  onPlanetDoubleClick={(name: string) => setMapPlanet(name)}
                />
              </div>

              {/* Telemetry Overlays ON TOP of Canvas */}
              {selectedTarget ? (
                <div className="border-draw absolute top-2 left-2 border-2 border-outline-variant bg-surface-container-lowest/80 backdrop-blur-md p-3 w-64 z-20 pointer-events-none">
                  <div className="border-b-2 border-outline-variant pb-1.5 mb-2 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-on-surface uppercase tracking-widest leading-none pt-0.5">{selectedTarget.name} SYS_INFO</span>
                    <span className="w-1.5 h-1.5 bg-primary-fixed fast-pulse"></span>
                  </div>
                  <div className="text-telemetry-xs text-secondary flex flex-col gap-1 tracking-wider leading-snug">
                    <div className="flex justify-between border-b border-outline-variant border-dashed pb-0.5"><span>MASS:</span> <span className="text-primary-fixed jitter-text">{PLANET_STATS[selectedTarget.name]?.mass || "N/A"}</span></div>
                    <div className="flex justify-between border-b border-outline-variant border-dashed pb-0.5"><span>GRV :</span> <span className="text-primary-fixed jitter-text">{PLANET_STATS[selectedTarget.name]?.gravity || "N/A"}</span></div>
                    <div className="flex justify-between border-b border-outline-variant border-dashed pb-0.5"><span>ATM :</span> <span className="text-primary-fixed text-[8px] pt-0.5 items-center flex">{PLANET_STATS[selectedTarget.name]?.atmosphere || "None"}</span></div>
                    <div className="flex justify-between"><span>TEMP:</span> <span className="text-primary-fixed jitter-text font-bold">{PLANET_STATS[selectedTarget.name]?.temp || "N/A"}</span></div>
                    <div className="flex justify-between mt-2 pt-1 border-t-2 border-outline-variant">
                      <span className="text-primary-fixed uppercase font-bold">SYS_STATUS:</span> <span className="text-primary-fixed font-bold">NOMINAL</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-draw absolute top-2 left-2 border-2 border-outline-variant bg-surface-container-lowest/80 backdrop-blur-md p-2 w-56 z-20 pointer-events-none">
                  <div className="border-b-2 border-outline-variant pb-1 mb-1 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-on-surface uppercase tracking-widest pt-0.5">ORBITAL_VECTORS</span>
                    <span className="w-1.5 h-1.5 bg-primary-fixed fast-pulse"></span>
                  </div>
                  <div className="text-telemetry-xs text-secondary flex flex-col gap-1 tracking-wider">
                    <div className="flex justify-between"><span>T_AXIS:</span> <span className="text-primary-fixed jitter-text">14.9598</span></div>
                    <div className="flex justify-between"><span>E_RAD:</span> <span className="text-primary-fixed jitter-text">6371.0</span></div>
                    <div className="flex justify-between"><span>V_ESC:</span> <span className="text-primary-fixed jitter-text">11.186</span></div>
                    <div className="flex justify-between mt-1 pt-1 border-t border-outline-variant">
                      <span className="text-primary-fixed font-bold">STATUS:</span> <span className="text-primary-fixed font-bold">NOMINAL</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Right side diagnostics */}
              <div className="border-draw absolute top-2 right-2 flex flex-col gap-2 z-20 items-end pointer-events-none w-56">
                <div className="border-2 border-outline-variant bg-surface-container-lowest/80 backdrop-blur-md p-2 w-full">
                  <div className="border-b-2 border-outline-variant pb-1 mb-1 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-on-surface uppercase tracking-widest pt-0.5">SYS_DIAGNOSTICS</span>
                    <span className="text-[8px] text-secondary">v2.0.1</span>
                  </div>
                  <div className="text-telemetry-xs text-secondary flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span>CPU_LD:</span>
                      <span className="text-primary-fixed jitter-text">88%</span>
                    </div>
                    <div className="w-full h-1 bg-surface-variant"><div className="h-full bg-primary-fixed w-[88%] jitter-text"></div></div>
                    <div className="flex justify-between items-center mt-1">
                      <span>MEM_AL:</span>
                      <span className="text-primary-fixed jitter-text">62GB</span>
                    </div>
                    <div className="w-full h-1 bg-surface-variant"><div className="h-full bg-primary-fixed w-[90%] jitter-text"></div></div>
                  </div>
                </div>

                {/* Waterfall fake component */}
                <div className="border-2 border-outline-variant bg-surface-container-lowest/80 backdrop-blur-md p-2 w-full flex flex-col">
                  <div className="text-[8px] text-on-surface uppercase font-bold mb-1 border-b border-outline-variant pb-1 text-center font-sans tracking-widest">SPECTRUM_ANALYSIS</div>
                  <div className="waterfall-container">
                    <div className="waterfall-bar" style={{animationDelay: "0.1s"}}></div>
                    <div className="waterfall-bar" style={{animationDelay: "0.3s"}}></div>
                    <div className="waterfall-bar" style={{animationDelay: "0.2s"}}></div>
                    <div className="waterfall-bar" style={{animationDelay: "0.5s"}}></div>
                    <div className="waterfall-bar" style={{animationDelay: "0.4s"}}></div>
                    <div className="waterfall-bar" style={{animationDelay: "0.6s"}}></div>
                    <div className="waterfall-bar" style={{animationDelay: "0.8s"}}></div>
                    <div className="waterfall-bar" style={{animationDelay: "0.7s"}}></div>
                    <div className="waterfall-bar" style={{animationDelay: "0.9s"}}></div>
                    <div className="waterfall-bar" style={{animationDelay: "0.2s"}}></div>
                  </div>
                </div>

                {/* Gravity Widgets */}
                <div className="border-2 border-outline-variant bg-surface-container-lowest/80 backdrop-blur-md p-2 w-full flex justify-between">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-6 h-6 border-2 border-primary-fixed rounded-full flex items-center justify-center relative">
                      <div className="absolute w-4 h-4 border border-primary-fixed rounded-full fast-pulse"></div>
                      <span className="text-[6px] text-primary-fixed font-bold leading-none translate-y-[1px]">9.8</span>
                    </div>
                    <span className="text-[7px] text-secondary tracking-widest leading-none translate-y-0.5">G_TERRA</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-6 h-6 border-2 border-primary-fixed rounded-full flex items-center justify-center relative">
                      <div className="absolute w-4 h-4 border border-primary-fixed rounded-full fast-pulse"></div>
                      <span className="text-[6px] text-primary-fixed font-bold leading-none translate-y-[1px]">24.7</span>
                    </div>
                    <span className="text-[7px] text-secondary tracking-widest leading-none translate-y-0.5">G_JOVIAN</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-6 h-6 border-2 border-secondary rounded-full flex items-center justify-center relative">
                      <div className="absolute w-4 h-4 border border-secondary rounded-full"></div>
                      <span className="text-[6px] text-secondary font-bold leading-none translate-y-[1px]">3.7</span>
                    </div>
                    <span className="text-[7px] text-secondary tracking-widest leading-none translate-y-0.5">G_MARS</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    setSelectedTarget(null);
                    setResetCameraTrigger(prev => prev + 1);
                  }}
                  className="mt-auto pointer-events-auto border-2 border-outline-variant bg-black text-[9px] text-secondary hover:text-primary-fixed px-3 py-1.5 w-full uppercase tracking-widest text-center cursor-pointer nav-item-hover font-bold"
                >
                  [ RECENTER SOL ]
                </button>
              </div>

              <div className="absolute bottom-2 left-2 text-[8px] text-secondary font-telemetry-xs flex gap-2 items-center bg-black/80 px-1 border border-outline-variant pointer-events-none z-20">
                <span className="text-primary-fixed fast-pulse font-bold tracking-widest">TRK</span>
                <span className="tracking-widest">COORD:</span> 
                <span className="text-primary-fixed jitter-text tracking-widest">
                  [X: -45.2, Y: 12.8, Z: 0.0]
                </span>
              </div>
            </main>
          </div>
          
          {/* Flight History Archive (Modal mapped as Kinetic Brutalism window) */}
          {isArchiveOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto font-sans p-6">
              <div className="bg-surface-container-lowest p-6 border-2 border-primary-fixed w-full max-w-2xl flex flex-col max-h-[80vh] relative shadow-[0_0_0_4px_rgba(255,176,0,0.2)] staggering-in">
                <div className="framing-corner corner-tl"></div>
                <div className="framing-corner corner-tr"></div>
                <div className="framing-corner corner-bl"></div>
                <div className="framing-corner corner-br"></div>
                
                <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-outline-variant">
                  <h2 className="text-[12px] font-bold tracking-[0.2em] text-primary-fixed uppercase jitter-text">SYS_HISTORY // {archivedMissions.length} RECORDS</h2>
                  <button 
                    onClick={() => setIsArchiveOpen(false)}
                    className="px-2 text-[10px] text-secondary border-2 border-transparent hover:border-primary-fixed hover:text-primary-fixed transition-none cursor-pointer tracking-widest uppercase bg-black"
                  >
                    [X] CLOSE
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-none">
                  {archivedMissions.length === 0 ? (
                    <div className="text-center py-12 text-secondary text-[10px] tracking-widest uppercase fast-pulse border-2 border-dashed border-outline-variant mx-4 my-8">
                      NO_RECORDS_FOUND
                    </div>
                  ) : (
                    archivedMissions.map((m) => (
                      <div key={m.id} className="p-3 border-2 border-outline-variant bg-black flex justify-between items-center group hover:border-primary-fixed hover:bg-surface transition-none">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-1 py-[1px] bg-primary-fixed text-on-primary-fixed text-[8px] font-bold tracking-widest uppercase border-2 border-primary-fixed">
                              REC_0{String(m.id + 1)}
                            </span>
                            <span className="text-[8px] text-secondary tracking-widest uppercase font-bold">
                              {m.orbitType ? m.orbitType.replace("_", " ") : "TRANSFER"}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-white mt-1 uppercase tracking-widest">
                            [{m.launchPlanet}] &rarr; [{m.targetPlanet?.toUpperCase() || "DEEP SPACE"}]
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setActiveReplay(m);
                            setIsArchiveOpen(false);
                          }}
                          className="px-3 py-1 border-2 border-outline-variant text-[9px] tracking-wider uppercase flex items-center gap-1.5 cursor-pointer nav-item-hover text-secondary font-bold bg-transparent"
                        >
                           &gt;_ REPLAY
                        </button>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="h-4 bg-primary-fixed mt-4 flex items-center px-2">
                  <span className="text-[8px] text-on-primary-fixed font-bold tracking-widest">AWAITING_INPUT<span className="cursor-blink">_</span></span>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Control Panel & Terminal */}
          <div className="border-draw flex flex-col border-t-2 border-outline-variant bg-surface-container-lowest z-40 relative px-panel-padding" style={{animationDelay: "1.1s"}}>
            <div className="py-2 flex flex-col md:flex-row justify-between items-center flex-wrap gap-2 border-b-2 border-outline-variant">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 border-2 border-outline-variant px-2 py-0.5 bg-black w-24 justify-center">
                  <span className={`w-1.5 h-1.5 ${timeMult === 0 ? 'bg-error' : 'bg-primary-fixed fast-pulse'}`}></span>
                  <span className={`text-[10px] font-bold uppercase ${timeMult === 0 ? 'text-error' : 'text-primary-fixed fast-pulse'}`}>
                    {timeMult === 0 ? 'PAUSED' : 'LIVE'}
                  </span>
                </div>
                <span className="text-[10px] text-on-surface uppercase bg-black px-2 py-0.5 border border-outline-variant font-bold tracking-wider">
                  {new Date((J2000_UNIX + globalTimeRef.current) * 1000).toUTCString().split(' ').slice(1,4).join(' ').toUpperCase()}
                </span>
              </div>

              <div className="flex-1 max-w-xl flex flex-col items-center gap-1">
                <span className="text-[8px] text-secondary uppercase tracking-widest font-bold">
                  SIM_RATE: {timeMult === 1 ? 'REAL' : `WARP [x${timeMult}]`}
                </span>
                <div className="flex items-center justify-center gap-1 w-full max-w-md mx-auto">
                  <button 
                    onClick={() => {
                      const warpSpeeds = [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10, 86400 * 365.25 * 100];
                      const currIdx = warpSpeeds.indexOf(timeMult);
                      if (currIdx > 0) handleTimeMultChange(warpSpeeds[currIdx - 1]);
                      else if (timeMult === 0) handleTimeMultChange(1);
                    }}
                    className="nav-item-hover border-2 border-outline-variant px-2 py-[2px] text-secondary transition-none bg-black cursor-pointer w-auto flex justify-center"
                  >
                    <span className="material-symbols-outlined text-[14px]">fast_rewind</span>
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
                    className={`border-2 px-6 py-[2px] transition-none cursor-pointer w-auto flex justify-center font-bold tracking-widest text-[9px] ${
                      timeMult === 0 ? 'border-error bg-error text-on-primary-fixed hover:bg-error/80' : 'border-outline-variant text-secondary bg-black nav-item-hover'
                    }`}
                  >
                    {timeMult === 0 ? '> PLAY' : '|| PAUSE'}
                  </button>

                  <button 
                    onClick={() => {
                      const warpSpeeds = [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10, 86400 * 365.25 * 100];
                      const currIdx = warpSpeeds.indexOf(timeMult);
                      if (currIdx !== -1 && currIdx < warpSpeeds.length - 1) handleTimeMultChange(warpSpeeds[currIdx + 1]);
                      else if (timeMult === 0) handleTimeMultChange(lastTimeMultRef.current || 86400);
                    }}
                    className="nav-item-hover border-2 border-outline-variant px-2 py-[2px] text-secondary transition-none bg-black cursor-pointer w-auto flex justify-center"
                  >
                    <span className="material-symbols-outlined text-[14px]">fast_forward</span>
                  </button>
                </div>
                {/* Speed Reference Text Array under main controls */}
                <div className="flex w-full max-w-md justify-between px-2 pt-0.5 select-none">
                  {["REAL", "DAY", "MTH", "YR", "10Y", "100Y"].map((label, idx) => {
                     const speeds = [1, 86400, 86400 * 30, 86400 * 365.25, 86400 * 365.25 * 10, 86400 * 365.25 * 100];
                     const active = timeMult === speeds[idx];
                     return (
                       <span 
                         key={idx}
                         onClick={() => handleTimeMultChange(speeds[idx])}
                         className={`text-[8px] cursor-pointer tracking-wider ${active ? 'text-primary-fixed font-bold border-b border-primary-fixed' : 'text-secondary hover:text-white'}`}
                       >
                         {label}
                       </span>
                     )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-on-surface uppercase bg-black px-2 py-0.5 border border-outline-variant jitter-text tracking-widest font-bold hidden sm:inline-block">
                  {new Date((J2000_UNIX + globalTimeRef.current) * 1000).toUTCString().split(' ')[4]}
                </span>
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
              </div>
            </div>

            {/* Rapid Terminal Output */}
            <div className="h-6 bg-black flex items-center px-2 text-[9px] text-secondary font-mono overflow-hidden border-b-2 border-outline-variant -mx-margin pb-1">
              <span className="text-primary-fixed mr-2 font-bold tracking-widest">&gt; SYS_OUT:</span>
              <div className="flex-1 whitespace-nowrap overflow-hidden">
                {timeMult === 0 ? (
                   <span className="text-secondary tracking-widest uppercase inline-block">SIMULATION_PAUSED | AWAITING_COMMAND_INPUT | CORE_TEMP_NOMINAL...</span>
                ) : isLaunched ? (
                   <span className="jitter-text text-primary-fixed font-bold tracking-widest inline-block">TRAJ_COMPUTATION_ACTIVE | BURST_VELOCITY_CHECK_PASS | NAV_SYSTEM_LOCKED_ON_TARGET...</span>
                ) : (
                   <span className="jitter-text text-secondary tracking-widest inline-block">INIT_SEQ_001 [OK] | LOADING_SECTOR_G1 [OK] | CALC_TRAJ... | MEM_ALLOC_48GB | NOMINAL...</span>
                )}
              </div>
              <span className="cursor-blink text-primary-fixed bg-primary-fixed w-1.5 h-3 ml-1 block"></span>
            </div>
          </div>
      </div>

      {/* Landing Page Content */}
      <div className={`transition-opacity duration-1000 ${!isSimulatorRunning ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none z-[-1]'}`}>
          <div className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000">
            <Galaxy transparent={false} mouseInteraction={false} scrollProgressRef={scrollProgressRef} />
          </div>

          <div
            ref={landingScrollRef}
            className="landing-scroller absolute inset-0 z-20 flex flex-col pointer-events-auto overflow-y-auto"
          >
            <StaggeredMenu
              isFixed={true}
              position="right"
              colors={['#082f49', '#0c4a6e', '#164e63']}
              logoUrl="/logo.svg"
              menuButtonColor="#ffb000"
              openMenuButtonColor="#ffffff"
              accentColor="#ffb000"
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
                  label: 'Srinivasa Project', 
                  ariaLabel: 'Srinivasa Project Site', 
                  link: 'https://Srinivasa.2bd.net',
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
      </div>

      {showMobileBlock && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#131313] text-white p-6 text-center select-none pointer-events-auto rounded">
          <div className="max-w-xs flex flex-col items-center border-2 border-primary-fixed p-6 bg-surface-container-low">
            <span className="material-symbols-outlined text-[48px] text-primary-fixed mb-4 fast-pulse">desktop_windows</span>
            <h1 className="text-sm font-bold tracking-[0.2em] text-primary-fixed uppercase mb-2">
              DESKTOP ONLY
            </h1>
            <p className="text-[10px] text-secondary tracking-widest leading-relaxed">
              Mobile support not present in this terminal. Please connect using a widescreen display for full operational access.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
