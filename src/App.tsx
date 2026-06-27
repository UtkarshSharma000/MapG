import React, { useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import Draggable from "react-draggable";
import {
  LogOut,
  Move,
  Radio,
  CircleDot,
  Pause,
  Play,
  FastForward,
  Eye,
  MessageSquare,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PLANETS } from "./OrbitSimulator";
import { OptimizeResult } from "./TrajectoryOptimizer";
import { scanPorkchop } from "./workers/trajectory.worker";
import { LaunchHUD } from "./components/LaunchHUD";
import StaggeredMenu from "./components/StaggeredMenu";
import { LaunchSimulator } from "./components/LaunchSimulator";

const OrbitSimulator = React.lazy(() => import("./OrbitSimulator"));
const Galaxy = React.lazy(() => import("./components/Galaxy"));
const Planet2DMap = React.lazy(() =>
  import("./components/Planet2DMap").then((m) => ({ default: m.Planet2DMap })),
);
const SrinivasaAIChat = React.lazy(
  () => import("./components/SrinivasaAIChat"),
);

// Modular Extracted Components
import { InteractiveGlobe } from "./components/InteractiveGlobe";
import LandingHero from "./components/LandingHero";

const InteractiveBridge = React.lazy(
  () => import("./components/InteractiveBridge"),
);
const SpaceExplorationPanel = React.lazy(
  () => import("./components/SpaceExplorationPanel"),
);
const MathPhysicsShowcase = React.lazy(
  () => import("./components/MathPhysicsShowcase"),
);
const SatelliteBuilder = React.lazy(
  () => import("./components/SatelliteBuilder"),
);

const J2000_UNIX = 946728000;

const PLANET_STATS: Record<
  string,
  { mass: string; gravity: string; atmosphere: string; temp: string }
> = {
  Mercury: {
    mass: "3.30 × 10²³ kg",
    gravity: "3.7 m/s²",
    atmosphere: "None / Exosphere",
    temp: "167 °C",
  },
  Venus: {
    mass: "4.87 × 10²⁴ kg",
    gravity: "8.9 m/s²",
    atmosphere: "Dense CO₂ (96.5%)",
    temp: "464 °C",
  },
  Earth: {
    mass: "5.97 × 10²⁴ kg",
    gravity: "9.8 m/s²",
    atmosphere: "N₂ (78%), O₂ (21%)",
    temp: "15 °C",
  },
  Mars: {
    mass: "6.42 × 10²³ kg",
    gravity: "3.7 m/s²",
    atmosphere: "Thin CO₂ (95.3%)",
    temp: "-65 °C",
  },
  Jupiter: {
    mass: "1.90 × 10²⁷ kg",
    gravity: "24.8 m/s²",
    atmosphere: "H₂ (89.8%), He (10.2%)",
    temp: "-110 °C",
  },
  Saturn: {
    mass: "5.68 × 10²⁶ kg",
    gravity: "10.4 m/s²",
    atmosphere: "H₂ (96.3%), He (3.2%)",
    temp: "-140 °C",
  },
  Uranus: {
    mass: "8.68 × 10²⁵ kg",
    gravity: "8.7 m/s²",
    atmosphere: "H₂, He, CH₄",
    temp: "-195 °C",
  },
  Neptune: {
    mass: "1.02 × 10²⁶ kg",
    gravity: "11.2 m/s²",
    atmosphere: "H₂, He, CH₄",
    temp: "-200 °C",
  },
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
  const isSimulatorRunning = location.pathname.startsWith("/engine");
  const isBuilderOpen = location.pathname.startsWith("/builder");
  const isLaunchSimulatorOpen = location.pathname.startsWith("/launch");
  const [builderMissionDv, setBuilderMissionDv] = useState<number>(0);
  const [spacecraftConfig, setSpacecraftConfig] = useState<any>(null);

  const setIsSimulatorRunning = (running: boolean) => {
    if (running) {
      navigate("/engine");
    } else {
      navigate("/");
    }
  };
  const setIsBuilderRunning = (running: boolean) => {
    if (running) {
      navigate("/builder");
    } else {
      navigate("/");
    }
  };
  const setIsLaunchSimulatorOpen = (running: boolean) => {
    if (running) {
      navigate("/launch");
    } else {
      navigate("/");
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
  const [launchLocation, setLaunchLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [targetLocation, setTargetLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  const [isSpacecraftValidated, setIsSpacecraftValidated] = useState(false);
  const [currentLaunchTime, setCurrentLaunchTime] = useState<number>(0);
  const [isLaunched, setIsLaunched] = useState(false);
  const [missionStatus, setMissionStatus] = useState<string>("STANDBY");

  const [launchPlanet, setLaunchPlanet] = useState<string | null>("Earth");
  const [targetPlanet, setTargetPlanet] = useState<string | null>(null);
  const [initialLaunchPlanet, setInitialLaunchPlanet] =
    useState<string>("Earth");
  const [initialTargetPlanet, setInitialTargetPlanet] = useState<string | null>(
    null,
  );
  const [missionLegs, setMissionLegs] = useState<any[] | null>(null);
  const [returnWindow, setReturnWindow] = useState<OptimizeResult | null>(null);

  const [missionStartRealTime, setMissionStartRealTime] = useState<number>(0);
  const [recordedTimeEvents, setRecordedTimeEvents] = useState<
    { elapsedMs: number; mult: number }[]
  >([]);
  const [activeReplay, setActiveReplay] = useState<any>(null);
  const [activeReplayStartTime, setActiveReplayStartTime] = useState<number>(0);

  // Track mission completions to trigger archiving in OrbitSimulator
  const [completedMissions, setCompletedMissions] = useState<number>(0);
  const [archivedMissions, setArchivedMissions] = useState<any[]>([]);
  const [currentLaunchPoints, setCurrentLaunchPoints] = useState<
    THREE.Vector3[]
  >([]);
  const [currentReturnPoints, setCurrentReturnPoints] = useState<
    THREE.Vector3[]
  >([]);

  // Shortcut states
  const [orbitPathsVisible, setOrbitPathsVisible] = useState(true);
  const [planetaryLabelsVisible, setPlanetaryLabelsVisible] = useState(true);
  const [followSpacecraft, setFollowSpacecraft] = useState(false);
  const [cameraPresetToLoad, setCameraPresetToLoad] = useState<number | null>(
    null,
  );
  const [cameraPresetToSave, setCameraPresetToSave] = useState<number | null>(
    null,
  );
  const [resetCameraTrigger, setResetCameraTrigger] = useState(0);
  const [showMissionPanel, setShowMissionPanel] = useState(true);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const lastTimeMultRef = useRef(86400); // 1 Day/sec

  const handleSelectPlanet = (planetName: string) => {
    if (planetName === "Sol (Sun)") {
      setSelectedTarget(null);
    } else {
      const found = PLANETS.find((p) => p.name === planetName);
      if (found) {
        setSelectedTarget(found);
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
    const saved = localStorage.getItem("TimeControl_pos");
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  const onDragStopTC = (e: any, data: any) => {
    const newPos = { x: data.x, y: data.y };
    setTimeControlPos(newPos);
    localStorage.setItem("TimeControl_pos", JSON.stringify(newPos));
  };

  const targetSelectorNodeRef = React.useRef<HTMLDivElement>(null);
  const [targetSelectorPos, setTargetSelectorPos] = useState(() => {
    const saved = localStorage.getItem("TargetSelector_pos");
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  const onDragStopTargetSelector = (e: any, data: any) => {
    const newPos = { x: data.x, y: data.y };
    setTargetSelectorPos(newPos);
    localStorage.setItem("TargetSelector_pos", JSON.stringify(newPos));
  };

  const trajectoryNodeRef = React.useRef<HTMLDivElement>(null);
  const [trajectoryPos, setTrajectoryPos] = useState(() => {
    const saved = localStorage.getItem("TrajectoryOptimizer_pos");
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  const onDragStopTrajectory = (e: any, data: any) => {
    const newPos = { x: data.x, y: data.y };
    setTrajectoryPos(newPos);
    localStorage.setItem("TrajectoryOptimizer_pos", JSON.stringify(newPos));
  };

  const getSimulatedDestId = (): number => {
    const nameMap = {
      MERCURY: 1,
      VENUS: 2,
      EARTH: 3,
      MARS: 4,
      JUPITER: 5,
      SATURN: 6,
      URANUS: 7,
      NEPTUNE: 8,
    } as any;
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
        const rawProgress = Math.max(
          0,
          Math.min(1, currentScroll / scrollableDistance),
        );
        scrollProgressRef.current = rawProgress;
      } else {
        scrollProgressRef.current = 0;
      }
    };

    scroller.addEventListener("scroll", handleScroll, { passive: true });
    // Run once initially
    handleScroll();

    const handleResize = () => handleScroll();
    window.addEventListener("resize", handleResize);

    return () => {
      scroller.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [isSimulatorRunning]);

  // Prevention guard for duplicate TEI execution calls
  const teiAppliedRef = React.useRef(false);

  const getSimulatedOriginId = (): number => {
    const nameMap = {
      MERCURY: 1,
      VENUS: 2,
      EARTH: 3,
      MARS: 4,
      JUPITER: 5,
      SATURN: 6,
      URANUS: 7,
      NEPTUNE: 8,
    } as any;
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
        { type: "module" },
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
      console.warn(
        "Could not load return trajectory Web Worker, falling back to sync:",
        err,
      );
    }
    return () => {
      returnWorkerRef.current?.terminate();
    };
  }, []);

  // Return trajectory worker
  useEffect(() => {
    const planetIds: Record<string, number> = {
      Mercury: 1,
      Venus: 2,
      Earth: 3,
      Mars: 4,
      Jupiter: 5,
      Saturn: 6,
      Uranus: 7,
      Neptune: 8,
    };
    if (
      isSimulatorRunning &&
      selectedTarget &&
      selectedTarget.name !== "Sun" &&
      selectedTarget.name !== "Earth"
    ) {
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
            optGoal: "Time-Optimal (Fast-Transit)",
          },
        });
      }
    }
  }, [selectedTarget, isSimulatorRunning]);

  const handleTimeMultChange = (newMult: number) => {
    setTimeMult(newMult);
    if (isLaunched && !activeReplay) {
      setRecordedTimeEvents((prev) => [
        ...prev,
        { elapsedMs: Date.now() - missionStartRealTime, mult: newMult },
      ]);
    }
  };

  // Synchronize dynamic elasticValue with external timeMult changes (e.g. keyboard triggers)
  useEffect(() => {
    if (!isDraggingElastic) {
      const speedMap = [
        1,
        86400,
        86400 * 30,
        86400 * 365.25,
        86400 * 365.25 * 10,
        86400 * 365.25 * 100,
      ];
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

    const clickedVal = Math.min(
      100,
      Math.max(0, ((startX - rect.left) / rect.width) * 100),
    );
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
      const speedMap = [
        1,
        86400,
        86400 * 30,
        86400 * 365.25,
        86400 * 365.25 * 10,
        86400 * 365.25 * 100,
      ];
      if (timeMult !== speedMap[stepIdx]) {
        handleTimeMultChange(speedMap[stepIdx]);
      }
    }
  };

  const handlePointerUp = () => {
    setIsDraggingElastic(false);
    setElasticOverflow(0);

    const speedMap = [
      1,
      86400,
      86400 * 30,
      86400 * 365.25,
      86400 * 365.25 * 10,
      86400 * 365.25 * 100,
    ];
    const idx = speedMap.indexOf(timeMult);
    if (idx !== -1) {
      setElasticValue(idx * 20);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Ctrl + 1-9 (Save presets)
      if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const digit = parseInt(e.key);
        setCameraPresetToSave(digit);
        setTimeout(() => setCameraPresetToSave(null), 100);
        return;
      }

      // 1-9 keys (focus planets in order: 1=Mercury, 2=Venus, 3=Earth, 4=Mars, 5=Jupiter, 6=Saturn, 7=Uranus, 8=Neptune)
      if (!e.ctrlKey && !e.shiftKey && e.key >= "1" && e.key <= "9") {
        const digit = parseInt(e.key);
        if (digit >= 1 && digit <= 8) {
          const p = PLANETS[digit - 1];
          if (p) setSelectedTarget(p);
        }

        setCameraPresetToLoad(digit);
        setTimeout(() => setCameraPresetToLoad(null), 100);
        return;
      }

      if (e.key === "0") {
        setSelectedTarget(null);
        return;
      }

      // Shift + L
      if (e.shiftKey && key === "l") {
        e.preventDefault();
        handleLaunch();
        return;
      }

      // Shift + R
      if (e.shiftKey && key === "r") {
        e.preventDefault();
        planReturn();
        return;
      }

      switch (key) {
        case "f":
          setFollowSpacecraft((prev) => !prev);
          break;
        case "r":
          setResetCameraTrigger((prev) => prev + 1);
          break;
        case " ":
          e.preventDefault();
          if (timeMult > 0) {
            lastTimeMultRef.current = timeMult;
            handleTimeMultChange(0);
          } else {
            handleTimeMultChange(lastTimeMultRef.current || 86400);
          }
          break;
        case "[":
          {
            const warpSpeeds = [
              1,
              86400,
              86400 * 30,
              86400 * 365.25,
              86400 * 365.25 * 10,
            ];
            const currIdx = warpSpeeds.indexOf(timeMult);
            if (currIdx > 0) {
              handleTimeMultChange(warpSpeeds[currIdx - 1]);
            }
          }
          break;
        case "]":
          {
            const warpSpeeds = [
              1,
              86400,
              86400 * 30,
              86400 * 365.25,
              86400 * 365.25 * 10,
            ];
            const currIdx = warpSpeeds.indexOf(timeMult);
            if (currIdx !== -1 && currIdx < warpSpeeds.length - 1) {
              handleTimeMultChange(warpSpeeds[currIdx + 1]);
            } else if (currIdx === -1) {
              handleTimeMultChange(86400);
            }
          }
          break;
        case "l":
          if (!isLaunched) {
            handleLaunch();
          }
          break;
        case "t":
          // Opens trajectory planner. On simple apps this is the panel
          setShowMissionPanel(true);
          break;
        case "m":
          setShowMissionPanel((prev) => !prev);
          break;
        case "g":
          setNbody((prev) => !prev);
          break;
        case "o":
          setOrbitPathsVisible((prev) => !prev);
          break;
        case "p":
          setPlanetaryLabelsVisible((prev) => !prev);
          break;
        case "escape":
          setMapPlanet(null);
          setIsArchiveOpen(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [timeMult, isLaunched, selectedTarget]);

  const OBLIQUITY = 23.43929111 * (Math.PI / 180); // J2000 obliquity of ecliptic

  const eclipticToLocal = (
    vEcl: [number, number, number],
  ): [number, number, number] => {
    const [x, y, z] = vEcl;
    const cosE = Math.cos(OBLIQUITY);
    const sinE = Math.sin(OBLIQUITY);

    // Rotate ecliptic → equatorial (standard J2000 matrix, X-axis rotation)
    return [x, y * cosE - z * sinE, y * sinE + z * cosE];
  };

  const cartesianToPitchYaw = (
    v: [number, number, number],
  ): { v0: number; pitch: number; yaw: number } => {
    const [vx, vy, vz] = v;
    const v0M = Math.sqrt(vx ** 2 + vy ** 2 + vz ** 2);
    const p = Math.asin(vx / v0M); // matches Python sin(pitch)
    const y = Math.atan2(vz, vy); // matches Python atan2(vz,vy)
    return { v0: v0M, pitch: p, yaw: y };
  };

  const handleApply = (result: OptimizeResult) => {
    if (
      result.legs &&
      result.legs.length === 1 &&
      result.legs[0].destId === 3
    ) {
      if (teiAppliedRef.current) return;
      teiAppliedRef.current = true;
    }

    const vLocal = eclipticToLocal(result.v1_ecl);
    const {
      v0: newV0,
      pitch: newPitch,
      yaw: newYaw,
    } = cartesianToPitchYaw(vLocal);

    setV0(parseFloat(newV0.toFixed(4)));
    setPitch(parseFloat(((newPitch * 180) / Math.PI).toFixed(3)));
    setYaw(parseFloat(((newYaw * 180) / Math.PI).toFixed(3)));
    globalTimeRef.current = result.launchDay_j2000;
    setTimeMult(86400); // 1 day per second
    setTargetPlanet(null); // Clear single planet target so we rely on legs
    setMissionLegs(result.legs || null);
    setIsLaunched(false); // Reset launch state so return trajectory propagates in the HUD first

    if (result.legs && result.legs.length > 0) {
      let totalDv = 0;
      result.legs.forEach((l) => {
        totalDv += (l.dv1_kms || 0) + (l.dv2_kms || 0);
      });
      setBuilderMissionDv(totalDv);
      setIsSpacecraftValidated(false);

      const planetMap = {
        1: "Mercury",
        2: "Venus",
        3: "Earth",
        4: "Mars",
        5: "Jupiter",
        6: "Saturn",
        7: "Uranus",
        8: "Neptune",
      } as Record<number, string>;
      const originName = planetMap[result.legs[0].originId];
      if (originName) {
        setLaunchPlanet(originName);
      }
      const destId = result.legs[result.legs.length - 1].destId;
      const destName = planetMap[destId];
      if (destName) {
        const foundPlanet = PLANETS.find((p) => p.name === destName);
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
      const planetMap = {
        Mercury: 1,
        Venus: 2,
        Earth: 3,
        Mars: 4,
        Jupiter: 5,
        Saturn: 6,
        Uranus: 7,
        Neptune: 8,
      } as any;
      currentDestId = planetMap[targetPlanet] || 4;
    }
    returnDestIdRef.current = currentDestId;
    setReturnWindow(null); // Clear previous return window so UI knows it is computing

    // Set launch/dest correctly in App state to match returning direction
    const planetMap = {
      1: "Mercury",
      2: "Venus",
      3: "Earth",
      4: "Mars",
      5: "Jupiter",
      6: "Saturn",
      7: "Uranus",
      8: "Neptune",
    } as Record<number, string>;
    const originName = planetMap[currentDestId];
    if (originName) {
      setLaunchPlanet(originName);
    }
    setTargetPlanet("Earth");

    const earthPlanet = PLANETS.find((p) => p.name === "Earth");
    if (earthPlanet) {
      setSelectedTarget(earthPlanet);
    }

    const t0 = globalTimeRef.current / 86400; // live sim clock

    if (returnWorkerRef.current) {
      returnWorkerRef.current.postMessage({
        type: "SCAN",
        payload: {
          originId: currentDestId,
          destId: 3, // Earth
          t0_days: t0,
          steps: 60,
        },
      });
    } else {
      let result = scanPorkchop(
        currentDestId,
        3, // Earth
        t0,
        900,
        150,
        500,
      );

      if (!result) {
        result = scanPorkchop(
          currentDestId,
          3, // Earth
          t0,
        );
      }

      if (result) {
        const leg: any = {
          originId: currentDestId,
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

  const planInterplanetaryTrajectory = (
    originName: string,
    destName: string,
  ) => {
    setIsLaunched(false);
    setCurrentReturnPoints([]);

    const planetMap: Record<string, number> = {
      Mercury: 1,
      Venus: 2,
      Earth: 3,
      Mars: 4,
      Jupiter: 5,
      Saturn: 6,
      Uranus: 7,
      Neptune: 8,
    };

    // Standardize naming
    const originNormalized =
      originName.charAt(0).toUpperCase() + originName.slice(1).toLowerCase();
    const destNormalized =
      destName.charAt(0).toUpperCase() + destName.slice(1).toLowerCase();

    const originId = planetMap[originNormalized];
    const destId = planetMap[destNormalized];

    if (!originId || !destId) {
      console.error(
        `planInterplanetaryTrajectory: Invalid planet combination: ${originName} -> ${destName}`,
      );
      return;
    }

    const t0 = globalTimeRef.current / 86400; // live sim clock in days

    const runScan = (
      searchDays: number,
      tofMin: number,
      tofMax: number,
      isFallback: boolean,
    ) => {
      const w = new Worker(
        new URL("./workers/trajectory.worker.ts", import.meta.url),
        { type: "module" },
      );

      w.onmessage = (e) => {
        const { type, result } = e.data;
        if (type === "RESULT") {
          w.terminate();
          if (result) {
            const leg: any = {
              originId,
              destId,
              type: "capture",
              dv1_kms: result.dv1_kms,
              dv2_kms: result.dv2_kms,
              tof_days: result.tof_days,
              v1_ecl: result.v1_ecl,
            };
            result.legs = [leg];
            handleApply(result);
          } else if (!isFallback) {
            // try fallback scan with default bounds
            runScan(-1, -1, -1, true); // passing -1 will trigger default bounds in worker
          } else {
            console.warn(
              `No optimal path solution found from ${originNormalized} to ${destNormalized}`,
            );
          }
        }
      };

      w.postMessage({
        type: "SCAN",
        payload: {
          originId,
          destId,
          t0_days: t0,
          searchDays: searchDays > 0 ? searchDays : undefined,
          tofMin: tofMin > 0 ? tofMin : undefined,
          tofMax: tofMax > 0 ? tofMax : undefined,
          steps: 50,
        },
      });
    };

    // Initial explicit bounds scan
    runScan(900, 150, 500, false);
  };

  const handleSelectLocation = (
    type: "launch" | "target",
    planet: string,
    lat: number,
    lon: number,
  ) => {
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
              <span className="font-label-caps text-[9px] text-white/30 block mb-1">
                TYPE
              </span>
              <span className="font-data-lg text-xl text-white">G2V</span>
            </div>
            <div>
              <span className="font-label-caps text-[9px] text-white/30 block mb-1">
                MASS
              </span>
              <span className="font-data-lg text-xl text-white">1.989</span>
              <span className="text-[9px] text-white/20 ml-1">x10³⁰ KG</span>
            </div>
            <div>
              <span className="font-label-caps text-[9px] text-white/30 block mb-1">
                TEMP (SURF)
              </span>
              <span className="font-data-lg text-xl text-secondary">5,505</span>
              <span className="text-[9px] text-white/20 ml-1">°C</span>
            </div>
            <div>
              <span className="font-label-caps text-[9px] text-white/30 block mb-1">
                AGE
              </span>
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
              <InteractiveGlobe
                url={selectedTarget.texture}
                color={selectedTarget.color}
              />
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
            <span className="font-label-caps text-[9px] text-white/40 block mb-1">
              VELOCITY (PERI)
            </span>
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
            <span className="font-label-caps text-[9px] text-white/40 block mb-1">
              SEMI-MAJOR
            </span>
            <span className="font-data-lg text-xl text-white">
              {(selectedTarget.elements.a / 149597870700).toFixed(2)}
            </span>
            <span className="text-[9px] text-white/20 ml-1">AU</span>
          </div>
          <div className="bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/20 hover:-translate-y-1 hover:bg-white/10 transition-all cursor-pointer shadow-lg hover:shadow-cyan-500/20">
            <span className="font-label-caps text-[9px] text-white/40 block mb-1">
              ORBIT PERIOD
            </span>
            <span className="font-data-lg text-xl text-white">
              {(selectedTarget.elements.period / (24 * 3600)).toFixed(1)}
            </span>
            <span className="text-[9px] text-white/20 ml-1">DAYS</span>
          </div>
          <div className="bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/20 hover:-translate-y-1 hover:bg-white/10 transition-all cursor-pointer shadow-lg hover:shadow-primary/20">
            <span className="font-label-caps text-[9px] text-white/40 block mb-1">
              ECCENTRICITY
            </span>
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
    const planetMap =
      PLANETS.find((p) => p.name === archive.originalTargetPlanet) ||
      PLANETS.find((p) => p.name === archive.targetPlanet);
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

  const launchParams = React.useMemo(
    () =>
      isSimulatorRunning
        ? {
            v0,
            pitch,
            yaw,
            nbody,
            launchPlanet,
            launchLocation,
            targetLocation,
            targetPlanet,
            timeMult,
            isLaunched,
            launchDay_j2000: globalTimeRef.current,
            missionLegs,
          }
        : undefined,
    [
      isSimulatorRunning,
      v0,
      pitch,
      yaw,
      nbody,
      launchPlanet,
      launchLocation,
      targetLocation,
      targetPlanet,
      timeMult,
      isLaunched,
      missionLegs,
    ],
  );
  const handlePointsCalculated = React.useCallback(
    (pts: THREE.Vector3[], isReturn: boolean) => {
      if (isReturn) {
        setCurrentReturnPoints(pts);
      } else {
        setCurrentLaunchPoints(pts);
      }
    },
    [],
  );
  const handlePlanetDoubleClick = React.useCallback(
    (name: string) => setMapPlanet(name),
    [],
  );

  return (
    <div className="text-on-surface antialiased min-h-screen relative overflow-hidden flex flex-col bg-transparent">
      <React.Suspense
        fallback={<div className="fixed inset-0 z-0 bg-black"></div>}
      >
        <div
          className={`fixed inset-0 z-0 transition-opacity duration-1000 ${isSimulatorRunning ? "opacity-100 pointer-events-none" : "opacity-100 pointer-events-none"}`}
        >
          <Galaxy
            transparent={false}
            mouseInteraction={false}
            scrollProgressRef={
              !isSimulatorRunning ? scrollProgressRef : undefined
            }
          />
        </div>
      </React.Suspense>
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
              Mobile support has not been added. Please connect using a desktop
              display.
            </p>
          </div>
        </div>
      )}

      <React.Suspense
        fallback={
          <div className="absolute inset-0 bg-[#000000] z-10 pointer-events-none"></div>
        }
      >
        <OrbitSimulator
          isRunning={isSimulatorRunning}
          isCinematic={!isSimulatorRunning}
          cinematicScrollRef={scrollProgressRef}
          timeMult={timeMult}
          selectedTarget={selectedTarget}
          launchParams={launchParams}
          globalTimeRef={globalTimeRef}
          onPlanetDoubleClick={handlePlanetDoubleClick}
          onStatusUpdate={setMissionStatus}
          completedMissions={completedMissions}
          archivedMissions={archivedMissions}
          activeReplay={activeReplay}
          onPointsCalculated={handlePointsCalculated}
          orbitPathsVisible={orbitPathsVisible}
          planetaryLabelsVisible={planetaryLabelsVisible}
          followSpacecraft={followSpacecraft}
          cameraPresetToLoad={cameraPresetToLoad}
          cameraPresetToSave={cameraPresetToSave}
          resetCameraTrigger={resetCameraTrigger}
        />
      </React.Suspense>

      {isSimulatorRunning &&
        ((missionLegs?.length || 0) > 0 || returnWindow) && (
          <LaunchHUD
            onSimulateLaunch={handleLaunch}
            onResetSimulation={() => setIsLaunched(false)}
            isLaunched={isLaunched}
            missionStatus={missionStatus}
            onPlanReturn={planReturn}
            returnWindow={returnWindow}
            onApplyReturn={() => {
              if (returnWindow && returnWindow.legs) {
                setMissionLegs(returnWindow.legs);
                setIsLaunched(true);
              }
            }}
            onConcludeMission={() => {
              setIsLaunched(false);
              setMissionLegs([]);
              setReturnWindow(null);
              setCompletedMissions((prev) => prev + 1);
            }}
            selectedTarget={selectedTarget}
            setSelectedTarget={setSelectedTarget}
            planets={PLANETS}
            onOpenBuilder={() => setIsBuilderRunning(true)}
            isSpacecraftValidated={isSpacecraftValidated}
          />
        )}

      {/* Landing Page Content */}
      <div
        ref={landingScrollRef}
        className={`landing-scroller absolute inset-0 z-20 flex flex-col transition-opacity duration-1000 ${isSimulatorRunning || isBuilderOpen ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto overflow-y-auto"}`}
      >
        {/* TopNavBar */}
        <StaggeredMenu
          isFixed={true}
          position="right"
          colors={["#082f49", "#0c4a6e", "#164e63"]}
          logoUrl="/logo.svg"
          menuButtonColor="#00ffff"
          openMenuButtonColor="#ffffff"
          accentColor="#00ffff"
          onLaunchCore={() => setIsSimulatorRunning(true)}
          items={[
            {
              label: "Launch Simulator",
              ariaLabel: "Launch Simulator",
              link: "#",
              onClick: () => setIsSimulatorRunning(true),
              image:
                "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800&auto=format&fit=crop",
            },
            {
              label: "Satellite Builder",
              ariaLabel: "Satellite Builder",
              link: "#",
              onClick: () => setIsBuilderRunning(true),
              image:
                "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=800&auto=format&fit=crop",
            },
            {
              label: "GitHub Repo",
              ariaLabel: "GitHub Srinivasa",
              link: "https://github.com/UtkarshSharma000/Srinivasa",
              image:
                "https://images.unsplash.com/photo-1618477247222-ac60c7477123?q=80&w=800&auto=format&fit=crop",
            },
          ]}
          socialItems={[]}
        />

        <main className="">
          <LandingHero
            isSimulatorRunning={isSimulatorRunning}
            setIsSimulatorRunning={setIsSimulatorRunning}
            setIsBuilderRunning={setIsBuilderRunning}
            landingScrollRef={landingScrollRef}
          />

          <React.Suspense
            fallback={<div className="h-[600px] w-full bg-[#050505]"></div>}
          >
            <InteractiveBridge />
          </React.Suspense>

          <React.Suspense
            fallback={<div className="h-[800px] w-full bg-black"></div>}
          >
            <SpaceExplorationPanel
              cinematicSectionRef={cinematicSectionRef}
              scrollProgressRef={scrollProgressRef}
              landingScrollRef={landingScrollRef}
            />
          </React.Suspense>

          <React.Suspense
            fallback={<div className="h-[800px] w-full bg-black"></div>}
          >
            <MathPhysicsShowcase
              setIsSimulatorRunning={setIsSimulatorRunning}
              landingScrollRef={landingScrollRef}
            />
          </React.Suspense>
        </main>
      </div>

      {/* Simulator Overlay UI */}
      <div
        className={`absolute inset-0 z-30 pointer-events-none flex transition-opacity duration-1000 ${isSimulatorRunning ? "opacity-100" : "opacity-0"}`}
      >
        {isSimulatorRunning && (
          <div className="text-on-background h-full w-full overflow-hidden flex flex-col tech-grid-bg selection:bg-primary-fixed selection:text-on-primary-fixed pointer-events-none relative z-40 font-mono">
            {/* TopAppBar */}
            <header
              className="border-draw flex justify-between items-center w-full px-margin h-16 border-b-2 border-primary-container bg-background/95 flex-shrink-0 z-50 pointer-events-auto"
              style={{ animationDelay: "0.1s" }}
            >
              <div className="flex items-center gap-gutter">
                <h1 className="text-headline-lg font-bold text-primary-container tracking-tighter uppercase text-xl md:text-3xl">
                  SRINIVASA
                </h1>
              </div>
              <div className="flex items-center gap-margin text-telemetry-xs font-telemetry-xs">
                <span className="text-secondary tracking-widest hidden md:inline">
                  SEQ_ALIGN: <span className="text-primary-fixed">OK</span>
                </span>
                <span className="text-secondary">
                  {
                    new Date(globalTimeRef.current * 1000 + J2000_UNIX * 1000)
                      .toISOString()
                      .split("T")[1]
                      .split(".")[0]
                  }{" "}
                  UTC
                </span>
                <span className="text-primary-fixed border-l-2 border-primary-container pl-4 hidden md:inline">
                  [OP_ID: 8829_BETA]
                </span>
                <div className="flex gap-2 text-primary-container">
                  <Radio size={14} className="opacity-80" />
                </div>
              </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
              {/* SideNavBar (Desktop) */}
              <nav
                className="border-draw hidden md:flex flex-col h-full border-r-2 border-outline-variant p-panel-padding bg-surface-container-lowest/95 w-64 flex-shrink-0 z-40 pointer-events-auto"
                style={{ animationDelay: "0.3s" }}
              >
                <div
                  className="mb-4 border-b-2 border-outline-variant pb-2 stagger-in"
                  style={{ animationDelay: "0.5s" }}
                >
                  <h2 className="text-[11px] font-bold text-on-surface tracking-widest uppercase">
                    TACTICAL_NAV
                  </h2>
                  <p className="text-[9px] text-secondary mt-1">
                    SECTOR_COORD_G1.V2
                  </p>
                </div>
                <ul className="flex flex-col gap-1 flex-1 nav-menu overflow-y-auto pr-1">
                  <li className="stagger-in" style={{ animationDelay: "0.6s" }}>
                    <button
                      onClick={() => {
                        handleSelectPlanet("Sol (Sun)");
                        setMapPlanet(null);
                      }}
                      className={`w-full hover:bg-primary-fixed hover:text-on-primary-fixed hover:border-primary-fixed flex items-center justify-between p-1 border-2 text-[9px] uppercase cursor-pointer transition-colors ${!selectedTarget || selectedTarget.name === "Sun" ? "bg-primary-container text-on-primary-container border-primary-fixed" : "border-transparent text-secondary"}`}
                    >
                      <div className="flex items-center gap-2">
                        <CircleDot size={12} />
                        .000 SOL (SUN)
                      </div>
                    </button>
                  </li>
                  {PLANETS.map((p, idx) => (
                    <li
                      key={p.name}
                      className="stagger-in"
                      style={{ animationDelay: `${0.6 + idx * 0.05}s` }}
                    >
                      <button
                        onClick={() => {
                          handleSelectPlanet(p.name);
                          setMapPlanet(null);
                        }}
                        className={`w-full hover:bg-primary-fixed hover:text-on-primary-fixed hover:border-primary-fixed flex items-center justify-between p-1 border-2 text-[9px] uppercase cursor-pointer transition-colors ${selectedTarget?.name === p.name ? "bg-primary-container text-on-primary-container border-primary-fixed" : "border-transparent text-secondary"}`}
                      >
                        <div className="flex items-center gap-2">
                          <CircleDot size={12} />
                          .00{idx + 1} {p.name.toUpperCase()}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                <div
                  className="mt-2 border-t-2 border-outline-variant pt-2 flex flex-col gap-1 stagger-in"
                  style={{ animationDelay: "1.2s" }}
                >
                  <button
                    onClick={() => setIsAIChatOpen((prev) => !prev)}
                    className={`hover:bg-primary-fixed hover:text-on-primary-fixed hover:border-primary-fixed w-full flex items-center gap-2 p-1 border-2 cursor-pointer transition-colors text-[9px] uppercase ${isAIChatOpen ? "bg-primary-container text-on-primary-container border-primary-fixed" : "border-transparent text-secondary"}`}
                  >
                    <MessageSquare size={12} />
                    AI_ADVISOR // R1
                  </button>
                  <button
                    onClick={() => setIsSimulatorRunning(false)}
                    className="hover:bg-primary-fixed hover:text-on-primary-fixed hover:border-primary-fixed w-full flex items-center gap-2 p-1 text-secondary border-2 border-transparent text-[9px] uppercase cursor-pointer transition-colors"
                  >
                    <LogOut size={12} />
                    EXIT_SIM
                  </button>
                </div>
              </nav>

              {/* Main Canvas Area */}
              <main className="flex-1 relative flex flex-col p-panel-padding gap-panel-padding overflow-hidden z-10 bg-transparent pointer-events-none">
                <div className="crosshair"></div>
                <div className="framing-corner corner-tl"></div>
                <div className="framing-corner corner-tr"></div>
                <div className="framing-corner corner-bl"></div>
                <div className="framing-corner corner-br"></div>

                {/* Telemetry Overlay (Top Left) */}
                {selectedTarget && selectedTarget.name !== "Sun" && (
                  <div
                    className="border-draw absolute top-panel-padding left-panel-padding border-2 border-outline-variant bg-surface-container-lowest/95 p-2 w-56 z-20 pointer-events-none"
                    style={{ animationDelay: "0.8s" }}
                  >
                    <div className="border-b-2 border-outline-variant pb-1 mb-1 flex justify-between items-center">
                      <span className="text-label-sm font-bold text-on-surface uppercase tracking-widest">
                        ORBITAL_VECTORS
                      </span>
                      <span className="w-1 h-1 bg-primary-fixed"></span>
                    </div>
                    <div className="text-[10px] text-secondary flex flex-col gap-[2px]">
                      <div className="flex justify-between">
                        <span>TARGET:</span>{" "}
                        <span className="text-primary-fixed font-bold">
                          {selectedTarget.name.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>RADIUS:</span>{" "}
                        <span className="text-primary-fixed">
                          {selectedTarget.radius.toLocaleString()} KM
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>T_AXIS:</span>{" "}
                        <span className="text-primary-fixed">
                          {parseFloat(
                            (selectedTarget.elements.a / 149597870700).toFixed(
                              4,
                            ),
                          )}{" "}
                          AU
                        </span>
                      </div>
                      <div className="flex justify-between mt-1 pt-1 border-t border-outline-variant">
                        <span className="text-primary-fixed">STATUS:</span>{" "}
                        <span className="text-primary-fixed font-bold">
                          NOMINAL
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Telemetry Target Info */}
                <div
                  className="border-draw hidden md:flex absolute top-panel-padding right-panel-padding flex-col gap-2 z-20 items-end pointer-events-none"
                  style={{ animationDelay: "0.9s" }}
                >
                  {/* Gravity Well Gauges */}
                  <div className="border-2 border-outline-variant bg-surface-container-lowest/95 p-2 w-56 flex gap-2 justify-between">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-6 h-6 border-2 border-primary-fixed rounded-full flex items-center justify-center relative">
                        <div className="absolute w-4 h-4 border border-primary-fixed rounded-full"></div>
                        <span className="text-[6px] text-primary-fixed">
                          9.8
                        </span>
                      </div>
                      <span className="text-[8px] text-secondary">G_TERRA</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-6 h-6 border-2 border-primary-fixed rounded-full flex items-center justify-center relative">
                        <div className="absolute w-4 h-4 border border-primary-fixed rounded-full"></div>
                        <span className="text-[6px] text-primary-fixed">
                          24.8
                        </span>
                      </div>
                      <span className="text-[8px] text-secondary">
                        G_JOVIAN
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-6 h-6 border-2 border-secondary rounded-full flex items-center justify-center relative">
                        <div className="absolute w-4 h-4 border border-secondary rounded-full"></div>
                        <span className="text-[6px] text-secondary">3.7</span>
                      </div>
                      <span className="text-[8px] text-secondary">G_MARS</span>
                    </div>
                  </div>
                  <div
                    className="border-2 border-outline-variant bg-surface-container-lowest/95 p-2 w-56 stagger-in"
                    style={{ animationDelay: "1.0s" }}
                  >
                    <div className="text-[8px] text-on-surface uppercase font-bold mb-1 border-b-2 border-outline-variant pb-1">
                      GRAVITY STRENGTH
                    </div>
                    <div className="text-[8px] text-secondary flex flex-col gap-1 font-mono">
                      <div className="flex justify-between">
                        <span>MERCURY:</span>
                        <span className="text-primary-fixed">3.70 m/s²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VENUS:</span>
                        <span className="text-primary-fixed">8.87 m/s²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>EARTH:</span>
                        <span className="text-primary-fixed">9.81 m/s²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>MARS:</span>
                        <span className="text-primary-fixed">3.72 m/s²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>JUPITER:</span>
                        <span className="text-primary-fixed">24.79 m/s²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SATURN:</span>
                        <span className="text-primary-fixed">10.44 m/s²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>URANUS:</span>
                        <span className="text-primary-fixed">8.69 m/s²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>NEPTUNE:</span>
                        <span className="text-primary-fixed">11.15 m/s²</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-1 border-t border-outline-variant flex justify-between items-center">
                      <span className="text-[6px] opacity-50">
                        REF: G_CONST_V1.0
                      </span>
                      <span className="w-1 h-1 bg-primary-fixed"></span>
                    </div>
                  </div>
                </div>

                <div
                  className="border-draw flex-1 border-2 border-outline-variant relative bg-transparent flex items-center justify-center overflow-hidden viewport-content z-10 pointer-events-none"
                  style={{ animationDelay: "0.5s" }}
                >
                  <div className="absolute top-20 left-1/3 text-[8px] text-primary-fixed/50 font-mono pointer-events-none">
                    01101001 01101110
                  </div>
                  <div className="absolute bottom-32 right-1/4 text-[8px] text-secondary/40 font-mono pointer-events-none">
                    TRK_ID: A99-2X
                  </div>
                  <div className="absolute top-1/2 right-20 text-[8px] text-secondary/60 font-mono rotate-90 tracking-widest pointer-events-none">
                    ORBITAL_PHASE
                  </div>
                  <div className="absolute bottom-2 left-2 text-[8px] text-secondary font-telemetry-xs flex gap-2 items-center bg-black/80 px-1 border border-outline-variant pointer-events-none">
                    <span className="text-primary-fixed">TRK</span>
                    <span className="text-primary-fixed">[SYS NOMINAL]</span>
                  </div>
                </div>

                {/* Bottom Control Panel & Terminal */}
                <div
                  className="border-draw flex flex-col border-2 border-outline-variant bg-surface-container-lowest z-20 relative pointer-events-auto"
                  style={{ animationDelay: "1.1s" }}
                >
                  <div className="p-2 flex flex-col md:flex-row justify-between items-center flex-wrap gap-2 border-b-2 border-outline-variant">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 border-2 border-outline-variant p-1 bg-black">
                        <span className="w-2 h-2 bg-primary-fixed"></span>
                        <span className="text-[10px] font-bold text-primary-fixed uppercase">
                          LIVE.STRM
                        </span>
                      </div>
                      <span className="text-[10px] text-on-surface uppercase bg-black px-2 py-1 border border-outline-variant block min-w-[80px]">
                        {
                          new Date(
                            globalTimeRef.current * 1000 + J2000_UNIX * 1000,
                          )
                            .toISOString()
                            .split("T")[0]
                        }
                      </span>
                    </div>

                    <div className="flex-1 w-full max-w-xl flex flex-col items-center gap-1">
                      <span className="text-[8px] text-secondary uppercase tracking-widest">
                        SIM_RATE:{" "}
                        {timeMult === 0
                          ? "PAUSED"
                          : timeMult === 1
                            ? "REAL.v2"
                            : `WARP x${timeMult.toLocaleString()}`}
                      </span>
                      <div className="flex items-center gap-2 w-full justify-center">
                        <button
                          className="hover:bg-primary-fixed hover:text-on-primary-fixed hover:border-primary-fixed border-2 border-outline-variant px-3 py-1 text-secondary transition-colors bg-black cursor-pointer"
                          onClick={() => {
                            handleTimeMultChange(0);
                          }}
                        >
                          <Pause size={16} />
                        </button>
                        <button
                          className="hover:bg-primary-fixed hover:text-on-primary-fixed hover:border-primary-fixed border-2 border-outline-variant px-3 py-1 text-secondary transition-colors bg-black cursor-pointer"
                          onClick={() => {
                            handleTimeMultChange(1);
                          }}
                        >
                          <Play size={16} />
                        </button>
                        <button
                          className="hover:bg-primary-fixed hover:text-on-primary-fixed hover:border-primary-fixed border-2 border-outline-variant px-3 py-1 text-secondary transition-colors bg-black cursor-pointer"
                          onClick={() => {
                            handleTimeMultChange(86400 * 30);
                          }}
                        >
                          <FastForward size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setOrbitPathsVisible((p) => !p)}
                        className={`hover:bg-primary-fixed hover:text-on-primary-fixed hover:border-primary-fixed border-2 ${orbitPathsVisible ? "border-primary-fixed text-primary-fixed" : "border-outline-variant text-secondary"} p-1 bg-black cursor-pointer transition-colors`}
                        title="Toggle Orbits"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="h-6 bg-black flex items-center px-2 text-[8px] text-secondary font-mono overflow-hidden">
                    <span className="text-primary-fixed mr-2">
                      &gt; SYS_OUT:
                    </span>
                    <div className="flex-1 whitespace-nowrap overflow-hidden">
                      <span className="inline-block">
                        INIT_SEQ_001 [OK] | LOADING_SECTOR_G1.V2 | STAT: NOMINAL
                        | T+ {Math.floor(globalTimeRef.current / 86400)}{" "}
                        DAYS{" "}
                      </span>
                    </div>
                    <span className="cursor-blink text-primary-fixed">_</span>
                  </div>
                </div>
              </main>

              <React.Suspense fallback={null}>
                <SrinivasaAIChat
                  isOpen={isAIChatOpen}
                  onClose={() => setIsAIChatOpen(false)}
                  selectedTargetName={selectedTarget?.name || "Sol (Sun)"}
                  onPlanTrajectory={planInterplanetaryTrajectory}
                  onLaunchSimulation={handleLaunch}
                  onAbortSimulation={() => setIsLaunched(false)}
                  onSetTimeAcceleration={handleTimeMultChange}
                  onSetSimulationTarget={handleSelectPlanet}
                  onPlanReturnFlight={planReturn}
                />
              </React.Suspense>
            </div>

            {/* BottomNavBar (Mobile) */}
            <nav className="md:hidden flex justify-center items-center gap-1 p-2 bg-black border-t-2 border-primary-fixed pointer-events-auto">
              <button
                onClick={() => setIsSimulatorRunning(false)}
                className="hover:bg-primary-fixed hover:text-on-primary-fixed hover:border-primary-fixed flex flex-col items-center justify-center p-1 border-2 border-outline-variant text-secondary w-full bg-surface-container-lowest cursor-pointer transition-colors"
              >
                <LogOut size={16} className="mb-1" />
                <span className="text-[8px] whitespace-nowrap">EXIT</span>
              </button>
            </nav>
          </div>
        )}

        {mapPlanet && (
          <React.Suspense
            fallback={
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
                <div className="animate-pulse text-cyan-400">
                  Loading Map...
                </div>
              </div>
            }
          >
            <Planet2DMap
              planetName={mapPlanet}
              onClose={() => setMapPlanet(null)}
              onSelectLocation={handleSelectLocation}
              launchPlanet={launchPlanet}
              targetPlanet={targetPlanet}
              launchLocation={launchLocation}
              targetLocation={targetLocation}
            />
          </React.Suspense>
        )}

        {isArchiveOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 pointer-events-auto font-mono text-white p-6">
            <div className="bg-[#020202] p-8 rounded border border-zinc-800 w-full max-w-2xl flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-800">
                <h2 className="text-xs font-bold tracking-[0.25em] text-white uppercase">
                  FLIGHT HISTORY
                </h2>
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
                    <div
                      key={m.id}
                      className="p-4 rounded border border-zinc-900 bg-zinc-950/40 flex justify-between items-center group hover:border-white/25 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-white text-[8px] font-bold tracking-widest border border-white/10">
                            MISSION {String(m.id + 1).padStart(2, "0")}
                          </span>
                          <span className="text-[8px] text-zinc-500 tracking-widest uppercase">
                            {m.orbitType
                              ? m.orbitType.replace("_", " ")
                              : "TRANSFER"}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          {m.launchPlanet.toUpperCase()} &rarr;{" "}
                          {m.targetPlanet?.toUpperCase() || "DEEP SPACE"}
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

      <div
        className={`absolute inset-0 z-[60] flex transition-opacity duration-1000 ${isLaunchSimulatorOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        {isLaunchSimulatorOpen && spacecraftConfig && (
          <React.Suspense
            fallback={
              <div className="h-full w-full bg-black pointer-events-auto"></div>
            }
          >
            <LaunchSimulator
              spacecraftConfig={spacecraftConfig}
              onOrbitReached={() => {
                setIsLaunchSimulatorOpen(false);
                setIsSimulatorRunning(true);
                setV0(7.67);
                setLaunchPlanet("Earth");
                setIsLaunched(true);
                setMissionStartRealTime(Date.now());
                setMissionStatus("IN TRANSIT");
              }}
              onAbort={() => {
                setIsLaunchSimulatorOpen(false);
                setIsBuilderRunning(true);
              }}
            />
          </React.Suspense>
        )}
      </div>

      <div
        className={`absolute inset-0 z-50 flex transition-opacity duration-1000 ${isBuilderOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        {isBuilderOpen && (
          <React.Suspense
            fallback={
              <div className="h-full w-full bg-black pointer-events-auto"></div>
            }
          >
            <SatelliteBuilder
              onClose={() => {
                setIsBuilderRunning(false);
              }}
              onValidate={(config: any) => {
                setSpacecraftConfig(config);
                setIsSpacecraftValidated(true);
                setIsBuilderRunning(false);
                setIsLaunchSimulatorOpen(true);
              }}
              requiredDeltaV={builderMissionDv}
            />
          </React.Suspense>
        )}
      </div>
    </div>
  );
}
