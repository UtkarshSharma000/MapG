import React, { useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture, OrbitControls } from "@react-three/drei";
import * as THREE from 'three';
import {
  Play,
  Activity,
  Globe,
  Satellite,
  Settings2,
  ArrowRight,
  LogOut,
} from "lucide-react";
import OrbitSimulator, { PLANETS } from "./OrbitSimulator";
import TrajectoryOptimizer, { OptimizeResult, scanPorkchop } from "./TrajectoryOptimizer";
import { TelemetryPanel } from "./components/TelemetryPanel";
import { LaunchHUD } from "./components/LaunchHUD";
import { Planet2DMap } from "./components/Planet2DMap";

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
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 3, 5]} intensity={1} />
      <mesh 
        ref={meshRef} 
        onPointerOver={() => setHover(true)} 
        onPointerOut={() => setHover(false)}
        scale={hovered ? 1.05 : 1}
      >
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshStandardMaterial map={tex} color={hovered ? '#ffffff' : '#aaaaaa'} roughness={0.6} />
      </mesh>
      <OrbitControls enableZoom={false} enablePan={false} />
    </>
  );
}

export default function App() {
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
  const [isLaunched, setIsLaunched] = useState(false);
  const [missionStatus, setMissionStatus] = useState<string>("STANDBY");

  const [launchPlanet, setLaunchPlanet] = useState<string | null>("Earth");
  const [targetPlanet, setTargetPlanet] = useState<string | null>(null);
  const [missionLegs, setMissionLegs] = useState<any[] | null>(null);
  const [returnWindow, setReturnWindow] = useState<OptimizeResult | null>(null);
  
  // Track mission completions to trigger archiving in OrbitSimulator
  const [completedMissions, setCompletedMissions] = useState<number>(0);
  const [archivedMissions, setArchivedMissions] = useState<any[]>([]);



  // Time Ref for jumping simulation
  const globalTimeRef = React.useRef<number>(Date.now() / 1000);

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
    setIsLaunched(true);
  };

  const planReturn = () => {
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
          <span className="px-2 py-0.5 border border-primary/40 text-primary text-[8px] rounded glow-orange tracking-[0.2em]">
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

  return (
    <div className="text-on-surface antialiased min-h-screen relative overflow-hidden flex flex-col bg-[#03060f]">
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
      />

      {/* Landing Page Content */}
      <div
        className={`absolute inset-0 z-20 flex flex-col bg-background transition-opacity duration-1000 ${isSimulatorRunning ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto overflow-y-auto"}`}
        style={{ backgroundColor: '#050505' }}
      >
        {/* TopNavBar */}
        <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 md:px-[32px] h-20 bg-background/80 backdrop-blur-xl border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
            <h1 className="font-display-lg text-headline-md font-bold tracking-tighter text-primary">ODYSSEY 2026</h1>
          </div>
          <nav className="hidden md:flex gap-8">
            <a className="font-label-caps text-label-caps text-primary font-bold border-b-2 border-primary pb-1 hover:text-tertiary transition-colors duration-300" href="#">Mission</a>
            <a className="font-label-caps text-label-caps text-on-surface-variant font-medium hover:text-tertiary transition-colors duration-300" href="#">Technology</a>
            <a className="font-label-caps text-label-caps text-on-surface-variant font-medium hover:text-tertiary transition-colors duration-300" href="#">Fleet</a>
            <a className="font-label-caps text-label-caps text-on-surface-variant font-medium hover:text-tertiary transition-colors duration-300" href="#">News</a>
          </nav>
          <button 
            onClick={() => setIsSimulatorRunning(true)}
            className="px-6 py-2 bg-primary-container text-on-primary-container font-label-caps text-label-caps tracking-widest hover:scale-95 transition-transform duration-200 cursor-pointer rounded"
          >
            LAUNCH TERMINAL
          </button>
        </header>

        <main className="pt-20">
          {/* Hero Section */}
          <section className="relative min-h-[90vh] flex items-center px-8 md:px-[32px] overflow-hidden">
            <div className="absolute inset-0 z-0">
              <img alt="Atmospheric planetary background" className="w-full h-full object-cover opacity-20 mix-blend-screen" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBACplwpq98Rkmgv4zvxb0eAEhIsizmNlJTC2jsQBeMtvZnFYMnCJHR6TAhNJ9sfdEr6k_qaF1jw4HuGWKSNZ1nLjHMBWSml5Pfcat6Fvkkaqj3c3JB-Lku9XZXTymKJOzxULcF7cBYsQhH_FC0LOHV6VFeXFn-5Omy3eEJ1a4hAJ5Txfm3dfZA-dKXoSqeNxCa2_yE5V8DhGfuqoeckWsY-xTNWEWCVaobE57lK5IlDNUKTEQ53H_Qy75i26W4xFsKIJcbnR1z87NM" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent"></div>
            </div>
            <div className="relative z-10 max-w-4xl">
              <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 glass-panel border border-primary/30 rounded">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="font-label-caps text-[10px] text-primary tracking-widest">SYSTEMS NOMINAL // ORBITAL SECTOR 7</span>
              </div>
              <h2 className="font-display-lg text-5xl md:text-[64px] font-bold mb-6 leading-none tracking-tighter">
                MISSION:<br/><span className="text-primary text-6xl md:text-[80px]">ODYSSEY 2026</span>
              </h2>
              <p className="font-headline-md text-xl md:text-2xl text-on-surface-variant mb-10 max-w-2xl font-light">
                Pioneering the Next Frontier of Satellite Logistics and Orbital Infrastructure.
              </p>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => setIsSimulatorRunning(true)}
                  className="px-10 py-4 bg-primary-container text-on-primary-container font-label-caps text-label-caps tracking-widest glow-orange hover:scale-105 active:scale-95 transition-all cursor-pointer rounded flex items-center gap-2"
                >
                  <Play size={16} /> LAUNCH TERMINAL
                </button>
                <button className="px-10 py-4 glass-panel border border-tertiary/40 text-tertiary font-label-caps text-label-caps tracking-widest glow-blue hover:scale-105 active:scale-95 transition-all rounded cursor-pointer">
                  VIEW ROADMAP
                </button>
              </div>
            </div>
            {/* Side Floating Visual */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/3 aspect-square hidden xl:block pointer-events-none">
              <div className="relative w-full h-full">
                <img alt="Mars decorative element" className="w-full h-full object-contain opacity-40 animate-[spin_120s_linear_infinite]" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzD6b_ke7zhqRDJVdHBQX-iXLpaxJIz4vQ4uyrJNv7AogmDUAr5AoWfhVZO26D6YVLlscwk4aOPdPDuhQN4pIdXaTazSOrk5Qfa12o8J32s120W2jYx9-1cudP-CfJai50OuBGCDninDwD-TvW8FPaAbZCIcEHOXBKm-BFFYRIOhK5RgeT2Y_kq5ZJ93AZGld76HzxNVspmEHN56OYwwxqKCY7-D3xhGN7uusHIm0H-z7aFERW-MfahQRPBboJ3mCEtxX4BID1X5ZX" />
                <div className="absolute inset-0 bg-gradient-to-l from-[#050505]/80 to-transparent"></div>
              </div>
            </div>
          </section>

          {/* Stats HUD */}
          <section className="px-8 md:px-[32px] py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-[16px]">
              <div className="glossy-panel p-[32px] rounded-3xl flex flex-col gap-2 group hover:bg-white/[0.03] transition-colors border border-white/10">
                <span className="font-label-caps text-[10px] tracking-widest text-tertiary relative z-10">CURRENT ALTITUDE</span>
                <div className="flex items-baseline gap-2 relative z-10">
                  <span className="font-data-lg text-4xl md:text-5xl leading-none group-hover:text-primary transition-colors font-bold">102.4</span>
                  <span className="font-label-caps text-xl text-on-surface-variant font-bold">KM</span>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-primary to-transparent w-full opacity-20 mt-2 relative z-10"></div>
              </div>
              <div className="glossy-panel p-[32px] rounded-3xl flex flex-col gap-2 group hover:bg-white/[0.03] transition-colors border border-white/10">
                <span className="font-label-caps text-[10px] tracking-widest text-tertiary relative z-10">RELATIVE VELOCITY</span>
                <div className="flex items-baseline gap-2 relative z-10">
                  <span className="font-data-lg text-4xl md:text-5xl leading-none group-hover:text-primary transition-colors font-bold">7.8</span>
                  <span className="font-label-caps text-xl text-on-surface-variant font-bold">KM/S</span>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-primary to-transparent w-full opacity-20 mt-2 relative z-10"></div>
              </div>
              <div className="glossy-panel p-[32px] rounded-3xl flex flex-col gap-2 group hover:bg-white/[0.03] transition-colors border border-white/10">
                <span className="font-label-caps text-[10px] tracking-widest text-tertiary relative z-10">SIGNAL STRENGTH</span>
                <div className="flex items-baseline gap-2 relative z-10">
                  <span className="font-data-lg text-4xl md:text-5xl leading-none group-hover:text-primary transition-colors font-bold">98</span>
                  <span className="font-label-caps text-xl text-on-surface-variant font-bold">%</span>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-primary to-transparent w-full opacity-20 mt-2 relative z-10"></div>
              </div>
            </div>
          </section>

          {/* Roadmap Section */}
          <section className="px-8 md:px-[32px] py-20">
            <div className="flex justify-between items-end mb-12">
              <div>
                <span className="font-label-caps text-[10px] text-primary tracking-widest">MISSION PARAMETERS</span>
                <h3 className="font-display-lg text-2xl md:text-3xl font-bold mt-2 tracking-wide">OPERATIONAL ROADMAP</h3>
              </div>
              <div className="hidden md:block font-data-lg text-tertiary font-bold tracking-wider text-sm">Q3-Q4 DEPLOYMENT</div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1 */}
              <div className="glossy-panel rounded-3xl hover:scale-[1.02] transition-transform duration-300 group overflow-hidden border border-white/5">
                <div className="h-48 overflow-hidden relative border-b border-white/5">
                  <img className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-80 transition-all duration-700" alt="Phobos base construction" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBACplwpq98Rkmgv4zvxb0eAEhIsizmNlJTC2jsQBeMtvZnFYMnCJHR6TAhNJ9sfdEr6k_qaF1jw4HuGWKSNZ1nLjHMBWSml5Pfcat6Fvkkaqj3c3JB-Lku9XZXTymKJOzxULcF7cBYsQhH_FC0LOHV6VFeXFn-5Omy3eEJ1a4hAJ5Txfm3dfZA-dKXoSqeNxCa2_yE5V8DhGfuqoeckWsY-xTNWEWCVaobE57lK5IlDNUKTEQ53H_Qy75i26W4xFsKIJcbnR1z87NM" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1d100c] to-transparent bg-opacity-80"></div>
                  <div className="absolute top-4 left-4 px-2 py-1 glass-panel border border-primary/20 rounded">
                    <span className="font-label-caps text-[8px] text-primary tracking-widest">PHASE 01</span>
                  </div>
                </div>
                <div className="p-[32px] bg-[#1d100c]/40 relative z-10">
                  <h4 className="font-headline-md text-xl md:text-2xl font-semibold mb-2">Phobos Base Construction</h4>
                  <p className="text-on-surface-variant text-sm mb-6 font-light leading-relaxed">Establishing the first permanent logistics hub on the Martian moon Phobos to support long-term orbital research.</p>
                  <div className="flex items-center justify-between">
                    <span className="font-label-caps text-[10px] text-tertiary flex items-center gap-1 tracking-widest">
                       JAN 2026
                    </span>
                    <ArrowRight className="text-primary group-hover:translate-x-2 transition-transform" size={16} />
                  </div>
                </div>
              </div>
              
              {/* Card 2 */}
              <div className="glossy-panel rounded-3xl hover:scale-[1.02] transition-transform duration-300 group overflow-hidden border border-white/5">
                <div className="h-48 overflow-hidden relative border-b border-white/5">
                  <img className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-80 transition-all duration-700" alt="Deep space communication relay" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD85HKMyPKmqVyjZ1ilQ9QXGQMuS_ihKntU1-cksmQgiMG7tlG2su3VaQRse6aSrS9PWS31_QDT8avN5E0wJKFXZBnguJQDCR4YAcYcsEouhLHetCjKMIrpnDUdr63QTSrDuZsJ2FHKipCigBpLuHIXXvyqXzJKe8ZxwEkmGg9b6s5Y1GyPW8cvEo7PPvnhYIZpyKJB3h28puIrnHiWeYMkQdPTuHVRlXSsqwf2cdidzDAoagCjT5zucA-7JkJmaFpbW5kbRmgGLzwn" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1d100c] to-transparent bg-opacity-80"></div>
                  <div className="absolute top-4 left-4 px-2 py-1 glass-panel border border-primary/20 rounded">
                    <span className="font-label-caps text-[8px] text-primary tracking-widest">PHASE 02</span>
                  </div>
                </div>
                <div className="p-[32px] bg-[#1d100c]/40 relative z-10">
                  <h4 className="font-headline-md text-xl md:text-2xl font-semibold mb-2">Deep Space Comm-Relay</h4>
                  <p className="text-on-surface-variant text-sm mb-6 font-light leading-relaxed">Deploying a constellation of high-throughput relays to ensure 24/7 link connectivity across the inner solar system.</p>
                  <div className="flex items-center justify-between">
                    <span className="font-label-caps text-[10px] text-tertiary flex items-center gap-1 tracking-widest">
                       MAY 2026
                    </span>
                    <ArrowRight className="text-primary group-hover:translate-x-2 transition-transform" size={16} />
                  </div>
                </div>
              </div>
              
              {/* Card 3 */}
              <div className="glossy-panel rounded-3xl hover:scale-[1.02] transition-transform duration-300 group overflow-hidden border border-white/5">
                <div className="h-48 overflow-hidden relative border-b border-white/5">
                  <img className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-80 transition-all duration-700" alt="Titan Atmosphere Entry" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzD6b_ke7zhqRDJVdHBQX-iXLpaxJIz4vQ4uyrJNv7AogmDUAr5AoWfhVZO26D6YVLlscwk4aOPdPDuhQN4pIdXaTazSOrk5Qfa12o8J32s120W2jYx9-1cudP-CfJai50OuBGCDninDwD-TvW8FPilot" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1d100c] to-transparent bg-opacity-80"></div>
                  <div className="absolute top-4 left-4 px-2 py-1 glass-panel border border-primary/20 rounded">
                    <span className="font-label-caps text-[8px] text-primary tracking-widest">PHASE 03</span>
                  </div>
                </div>
                <div className="p-[32px] bg-[#1d100c]/40 relative z-10">
                  <h4 className="font-headline-md text-xl md:text-2xl font-semibold mb-2">Titan Atmosphere Entry</h4>
                  <p className="text-on-surface-variant text-sm mb-6 font-light leading-relaxed">Automated descent and atmospheric analysis of Saturn's largest moon to survey for future methane harvesting sites.</p>
                  <div className="flex items-center justify-between">
                    <span className="font-label-caps text-[10px] text-tertiary flex items-center gap-1 tracking-widest">
                       SEP 2026
                    </span>
                    <ArrowRight className="text-primary group-hover:translate-x-2 transition-transform" size={16} />
                  </div>
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
                  className="px-12 py-4 bg-primary text-on-primary font-label-caps tracking-widest glow-orange hover:scale-105 active:scale-95 transition-all rounded font-bold cursor-pointer"
                >
                  INITIALIZE CONNECTION
                </button>
                <button className="px-12 py-4 glass-panel border border-outline text-on-surface-variant font-label-caps tracking-widest hover:scale-105 active:scale-95 transition-all rounded font-bold cursor-pointer">
                  SYSTEM STATUS
                </button>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="w-full py-[32px] px-8 md:px-[32px] flex flex-col md:flex-row justify-between items-center gap-[16px] bg-[#170b08]/90 backdrop-blur-md border-t border-outline-variant/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>target</span>
              <span className="font-display-lg text-lg text-primary tracking-tighter font-bold">ODYSSEY 2026</span>
            </div>
            <div className="flex gap-8">
              <a className="font-label-caps text-[10px] text-on-surface-variant hover:text-primary transition-all hover:translate-x-1 duration-200 uppercase tracking-widest" href="#">Privacy Policy</a>
              <a className="font-label-caps text-[10px] text-on-surface-variant hover:text-primary transition-all hover:translate-x-1 duration-200 uppercase tracking-widest" href="#">Terms of Service</a>
              <a className="font-label-caps text-[10px] text-on-surface-variant hover:text-primary transition-all hover:translate-x-1 duration-200 uppercase tracking-widest" href="#">Orbital Legal</a>
              <a className="font-label-caps text-[10px] text-on-surface-variant hover:text-primary transition-all hover:translate-x-1 duration-200 uppercase tracking-widest" href="#">Social Feeds</a>
            </div>
            <div className="text-right">
              <p className="font-label-caps text-[10px] text-tertiary tracking-widest">© 2026 MISSION ODYSSEY. ALL SYSTEMS OPERATIONAL.</p>
            </div>
          </footer>
        </main>
      </div>

      {/* Simulator Overlay UI */}
      <div
        className={`absolute inset-0 z-30 pointer-events-none flex flex-col transition-opacity duration-1000 ${isSimulatorRunning ? "opacity-100" : "opacity-0"}`}
      >
        {isSimulatorRunning && <TelemetryPanel />}
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
              teiAppliedRef.current = false;
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
                targetPlanet: targetPlanet,
                returnPlanet: missionStatus === "EARTH_ORBIT" ? "Earth" : undefined,
                orbitType: missionStatus,
                offset: completedMissions * (Math.PI / 4) // Phase offset to prevent collisions
              };
              setArchivedMissions(prev => [...prev, missionArchive]);
              setCompletedMissions(prev => prev + 1);
              setIsLaunched(false);
              setMissionLegs(null);
              setTargetPlanet(null);
              setReturnWindow(null);
              setMissionStatus("STANDBY");
              teiAppliedRef.current = false;
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
        {/* Orbit Lines HUD Simulation */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
          <div className="orbit-path w-[800px] h-[800px]"></div>
          <div className="orbit-path w-[1200px] h-[1200px] orbit-active"></div>
          <div className="orbit-path w-[1600px] h-[1600px]"></div>
        </div>

        {/* TopAppBar */}
        <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 h-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="flex items-center gap-10 pointer-events-auto">
            <h1 className="font-display-lg text-2xl tracking-tighter text-white">ODYSSEY <span className="text-secondary font-bold">2026</span></h1>
            <nav className="hidden md:flex gap-10">
              <a className="font-label-caps text-[10px] tracking-[0.15em] text-secondary border-b border-secondary/50 pb-1" href="#">TRAJECTORY</a>
            </nav>
          </div>
          
          <div className="flex items-center gap-6 pointer-events-auto">
            <div className="flex flex-col items-end mr-4">
              <span className="font-label-caps text-[9px] text-secondary tracking-[0.2em]">NETWORK STATUS</span>
              <span className="text-white font-data-lg text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse glow-cyan"></span>
                {missionStatus ? missionStatus.replace('_', ' ').toUpperCase() : 'STANDBY'}
              </span>
            </div>
            
            <button
              onClick={() => setIsSimulatorRunning(false)}
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-red-400 hover:border-red-400/30 transition-all cursor-pointer"
              title="Exit Flight Deck"
            >
              <LogOut size={16} className="rotate-180" /> 
            </button>
          </div>
        </header>

        {/* HUD Overlays (Timeline/Mission Progress) */}
        <div className="absolute inset-x-0 top-20 z-40 pointer-events-none flex justify-center">
          <div className="pointer-events-auto">
            <div className="glass-panel px-8 py-3 rounded-full flex items-center gap-6 border-white/10">
              <div className="relative flex items-center gap-3 pr-[20px] after:content-[''] after:absolute after:top-1/2 after:right-0 after:w-[10px] after:h-[1px] after:bg-white/10">
                <span className={`w-2.5 h-2.5 rounded-full ${missionStatus === 'STANDBY' ? 'bg-primary glow-orange' : 'bg-white/20'}`}></span>
                <span className={`font-label-caps text-[9px] ${missionStatus === 'STANDBY' ? 'text-primary' : 'text-white/40'}`}>LAUNCH</span>
              </div>
              <div className="relative flex items-center gap-3 pr-[20px] after:content-[''] after:absolute after:top-1/2 after:right-0 after:w-[10px] after:h-[1px] after:bg-white/10">
                <span className={`w-2.5 h-2.5 rounded-full ${missionStatus === 'TRANSIT' ? 'bg-primary glow-orange' : 'bg-white/20'}`}></span>
                <span className={`font-label-caps text-[9px] ${missionStatus === 'TRANSIT' ? 'text-primary' : 'text-white/40'}`}>TRANSFER</span>
              </div>
              <div className="relative flex items-center gap-3 pr-[20px] after:content-[''] after:absolute after:top-1/2 after:right-0 after:w-[10px] after:h-[1px] after:bg-white/10">
                <span className={`w-2.5 h-2.5 rounded-full ${missionStatus?.includes('ORBIT') && missionStatus !== 'EARTH_ORBIT' ? 'bg-primary glow-orange' : 'bg-white/20'}`}></span>
                <span className={`font-label-caps text-[9px] ${missionStatus?.includes('ORBIT') && missionStatus !== 'EARTH_ORBIT' ? 'text-primary' : 'text-white/40'}`}>INTERCEPT</span>
              </div>
              <div className="relative flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${missionStatus === 'EARTH_ORBIT' ? 'bg-primary glow-orange' : 'bg-white/20'}`}></span>
                <span className={`font-label-caps text-[9px] ${missionStatus === 'EARTH_ORBIT' ? 'text-primary' : 'text-white/40'}`}>RETURN</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex pt-16 relative z-10 w-full h-full pointer-events-none">
          {/* Central Canvas Area (Interactive / Data Overlays) - Expanded Full Screen */}
          <main className="flex-1 p-8 relative flex flex-col justify-between pointer-events-none">
            {/* Top Right: Target Selection & Quick Stats */}
            <div className="absolute top-36 right-8 flex flex-col gap-4 items-end pointer-events-auto">
              <div className="p-6 rounded-lg w-80 text-white glass-panel border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                {renderTargetStats()}
              </div>

              {selectedTarget && selectedTarget.name !== "Sun" && (
                <div className="w-80">
                  <TrajectoryOptimizer
                    originId={getSimulatedOriginId()}
                    destId={Number(Object.entries({1: 'Mercury', 2: 'Venus', 3: 'Earth', 4: 'Mars', 5: 'Jupiter', 6: 'Saturn', 7: 'Uranus', 8: 'Neptune'}).find(([_, name]) => name === selectedTarget.name)?.[0] || 4)}
                    globalTimeRef={globalTimeRef}
                    onApply={handleApply}
                  />
                </div>
              )}

              {/* Texture Preview Mini-panels */}
              <div className="flex justify-end gap-3 px-2 w-80 flex-wrap mt-2">
                {PLANETS.map((p) => (
                  <div
                    key={p.name}
                    onClick={() =>
                      setSelectedTarget(
                        selectedTarget?.name === p.name ? null : p,
                      )
                    }
                    className={`w-10 h-10 rounded-full border overflow-hidden cursor-pointer transition-all ${selectedTarget?.name === p.name ? "border-primary glow-orange opacity-100 scale-110" : "border-white/5 opacity-40 hover:opacity-100 hover:border-secondary/40"}`}
                  >
                    <img
                      src={p.texture}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Right: Time Controls */}
            <div className="absolute bottom-8 right-8 p-5 rounded-lg w-80 flex flex-col gap-4 pointer-events-auto border border-white/10 glass-panel shadow-[0_0_20px_rgba(0,0,0,0.5)] text-white">
              <div className="flex justify-between items-center">
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
                  if (val === 0) setTimeMult(1);
                  else if (val === 1) setTimeMult(86400);
                  else if (val === 2) setTimeMult(86400 * 30);
                  else if (val === 3) setTimeMult(86400 * 365.25);
                  else if (val === 4) setTimeMult(86400 * 365.25 * 10);
                  else setTimeMult(86400 * 365.25 * 100);
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
