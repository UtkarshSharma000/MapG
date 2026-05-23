import React, { useState } from "react";
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
    const nameMap = { "MERCURY": 1, "VENUS": 2, "EARTH": 3, "MARS": 4, "JUPITER": 5, "SATURN": 6 } as any;
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
      const planetMap = { 1: 'Mercury', 2: 'Venus', 3: 'Earth', 4: 'Mars', 5: 'Jupiter', 6: 'Saturn' } as Record<number, string>;
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
      const planetMap = { 'Mercury': 1, 'Venus': 2, 'Earth': 3, 'Mars': 4, 'Jupiter': 5, 'Saturn': 6 } as any;
      currentDestId = planetMap[targetPlanet] || 4;
    }
    returnDestIdRef.current = currentDestId;
    setReturnWindow(null); // Clear previous return window so UI knows it is computing

    // Set launch/dest correctly in App state to match returning direction
    const planetMap = { 1: 'Mercury', 2: 'Venus', 3: 'Earth', 4: 'Mars', 5: 'Jupiter', 6: 'Saturn' } as Record<number, string>;
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
          <div className="flex justify-between items-center mb-4">
            <span className="font-label-caps text-[10px] tracking-[0.15em] text-outline">
              PRIMARY TARGET
            </span>
            <span className="px-2 py-0.5 bg-tertiary-container/20 text-tertiary border border-tertiary/30 rounded text-[10px] font-label-caps tracking-[0.15em] glow-tertiary">
              SYSTEM CENTER
            </span>
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full border border-outline-variant bg-[#ffcc00] shadow-[0_0_20px_rgba(255,204,0,0.5)]"></div>
            <div>
              <h2 className="font-display-lg text-[32px] tracking-tighter text-on-surface uppercase font-bold">
                SOL
              </h2>
              <p className="font-label-caps text-[10px] tracking-[0.15em] text-tertiary">
                RADIUS: 696,340 KM
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-label-caps text-[10px] tracking-[0.15em] text-outline block mb-1">
                TYPE
              </span>
              <span className="font-data-lg text-[20px] text-on-surface">
                G2V
              </span>
            </div>
            <div>
              <span className="font-label-caps text-[10px] tracking-[0.15em] text-outline block mb-1">
                MASS
              </span>
              <span
                className="font-data-lg text-[20px] text-on-surface text-secondary truncate"
                title="1.989 × 10^30"
              >
                1.989e30
              </span>
              <span className="text-xs text-outline-variant ml-1 font-mono">
                kg
              </span>
            </div>
            <div>
              <span className="font-label-caps text-[10px] tracking-[0.15em] text-outline block mb-1">
                TEMP (SURF)
              </span>
              <span className="font-data-lg text-[20px] text-primary">
                5,505
              </span>
              <span className="text-xs text-outline-variant ml-1 font-mono">
                °C
              </span>
            </div>
            <div>
              <span className="font-label-caps text-[10px] tracking-[0.15em] text-outline block mb-1">
                AGE
              </span>
              <span className="font-data-lg text-[20px] text-primary">4.6</span>
              <span className="text-xs text-outline-variant ml-1 font-mono">
                B yr
              </span>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <span className="font-label-caps text-[10px] tracking-[0.15em] text-outline">
            PRIMARY TARGET
          </span>
          <span className="px-2 py-0.5 bg-primary-container/20 text-primary border border-primary/30 rounded text-[10px] font-label-caps tracking-[0.15em] glow-primary">
            LOCKED
          </span>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <img
            src={selectedTarget.texture}
            alt={selectedTarget.name}
            className="w-16 h-16 rounded-full border border-outline-variant object-cover glow-primary"
          />
          <div>
            <h2 className="font-display-lg text-[32px] tracking-tighter text-on-surface uppercase font-bold">
              {selectedTarget.name}
            </h2>
            <p className="font-label-caps text-[10px] tracking-[0.15em] text-tertiary">
              RADIUS: {selectedTarget.radius} KM
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-label-caps text-[10px] tracking-[0.15em] text-outline block mb-1">
              VELOCITY (PERI)
            </span>
            <span className="font-data-lg text-[20px] text-on-surface">
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
            <span className="text-xs text-outline-variant ml-1 font-mono">
              km/s
            </span>
          </div>
          <div>
            <span className="font-label-caps text-[10px] tracking-[0.15em] text-outline block mb-1">
              SEMI-MAJOR
            </span>
            <span className="font-data-lg text-[20px] text-on-surface">
              {(selectedTarget.elements.a / 149597870700).toFixed(2)}
            </span>
            <span className="text-xs text-outline-variant ml-1 font-mono">
              AU
            </span>
          </div>
          <div>
            <span className="font-label-caps text-[10px] tracking-[0.15em] text-outline block mb-1">
              ORBIT PERIOD
            </span>
            <span className="font-data-lg text-[20px] text-on-surface">
              {(selectedTarget.elements.period / (24 * 3600)).toFixed(1)}
            </span>
            <span className="text-xs text-outline-variant ml-1 font-mono">
              days
            </span>
          </div>
          <div>
            <span className="font-label-caps text-[10px] tracking-[0.15em] text-outline block mb-1">
              ECCENTRICITY
            </span>
            <span className="font-data-lg text-[20px] text-primary">
              {selectedTarget.elements.e.toFixed(4)}
            </span>
            <span className="text-xs text-outline-variant ml-1 font-mono">
              e
            </span>
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
        className={`absolute inset-0 z-20 flex flex-col bg-[#050505] transition-opacity duration-1000 ${isSimulatorRunning ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto overflow-y-auto"}`}
      >
        {/* TopNavBar */}
        <header className="fixed top-0 w-full z-50 flex justify-between items-center px-12 h-20 bg-black/80 backdrop-blur-2xl border-b border-white/10">
          <div className="flex items-center gap-2">
            <h1 className="font-sans font-bold text-xl tracking-widest text-[#ffb59d]">ODYSSEY 2026</h1>
          </div>
          <button 
            onClick={() => setIsSimulatorRunning(true)}
            className="px-6 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-mono text-[10px] tracking-widest glossy-button cursor-pointer rounded-lg uppercase transition-all flex items-center gap-2"
          >
            <Play size={14} />
            LAUNCH TERMINAL
          </button>
        </header>

        <main className="pt-20">
          {/* Hero Section */}
          <section className="relative min-h-[90vh] flex items-center px-12 overflow-hidden">
            <div className="absolute inset-0 z-0">
              <img alt="Atmospheric planetary background" className="w-full h-full object-cover opacity-20 mix-blend-screen" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBACplwpq98Rkmgv4zvxb0eAEhIsizmNlJTC2jsQBeMtvZnFYMnCJHR6TAhNJ9sfdEr6k_qaF1jw4HuGWKSNZ1nLjHMBWSml5Pfcat6Fvkkaqj3c3JB-Lku9XZXTymKJOzxULcF7cBYsQhH_FC0LOHV6VFeXFn-5Omy3eEJ1a4hAJ5Txfm3dfZA-dKXoSqeNxCa2_yE5V8DhGfuqoeckWsY-xTNWEWCVaobE57lK5IlDNUKTEQ53H_Qy75i26W4xFsKIJcbnR1z87NM" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent"></div>
            </div>
            <div className="relative z-10 max-w-4xl">
              <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 glossy-panel border-cyan-500/30 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                <span className="font-mono text-[10px] text-cyan-400 tracking-widest">SYSTEMS NOMINAL // ORBITAL SECTOR 7</span>
              </div>
              <h2 className="font-sans font-light text-6xl md:text-8xl mb-8 leading-none tracking-tighter text-white">
                MISSION:<br /><span className="text-[#ffb59d] font-bold">ODYSSEY</span>
              </h2>
              <p className="font-sans text-xl md:text-2xl text-white/50 mb-12 max-w-2xl font-light">
                Pioneering the Next Frontier of Satellite Logistics and Orbital Infrastructure.
              </p>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => setIsSimulatorRunning(true)}
                  className="px-10 py-5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-400 font-mono text-sm tracking-widest glossy-button cursor-pointer rounded-xl uppercase transition-all shadow-[0_0_30px_rgba(34,211,238,0.15)] flex items-center gap-3"
                >
                  INITIALIZE FLIGHT DECK <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </section>

          {/* Stats HUD */}
          <section className="px-12 py-12 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glossy-panel p-8 rounded-3xl flex flex-col gap-2 group hover:bg-white/[0.03] transition-colors border border-white/5">
                <span className="font-mono text-[10px] tracking-widest text-[#ffb59d] relative z-10 mb-2">CURRENT ALTITUDE</span>
                <div className="flex items-baseline gap-2 relative z-10">
                  <span className="font-mono text-5xl font-bold group-hover:text-cyan-400 transition-colors text-white">102.4</span>
                  <span className="font-mono text-xl text-white/50">KM</span>
                </div>
                <div className="h-px w-full bg-gradient-to-r from-transparent via-[#ffb59d]/50 to-transparent mt-4 opacity-50"></div>
              </div>
              <div className="glossy-panel p-8 rounded-3xl flex flex-col gap-2 group hover:bg-white/[0.03] transition-colors border border-white/5">
                <span className="font-mono text-[10px] tracking-widest text-[#ffb59d] relative z-10 mb-2">RELATIVE VELOCITY</span>
                <div className="flex items-baseline gap-2 relative z-10">
                  <span className="font-mono text-5xl font-bold group-hover:text-cyan-400 transition-colors text-white">7.8</span>
                  <span className="font-mono text-xl text-white/50">KM/S</span>
                </div>
                <div className="h-px w-full bg-gradient-to-r from-transparent via-[#ffb59d]/50 to-transparent mt-4 opacity-50"></div>
              </div>
              <div className="glossy-panel p-8 rounded-3xl flex flex-col gap-2 group hover:bg-white/[0.03] transition-colors border border-white/5">
                <span className="font-mono text-[10px] tracking-widest text-[#ffb59d] relative z-10 mb-2">SIGNAL STRENGTH</span>
                <div className="flex items-baseline gap-2 relative z-10">
                  <span className="font-mono text-5xl font-bold group-hover:text-cyan-400 transition-colors text-white">98</span>
                  <span className="font-mono text-xl text-white/50">%</span>
                </div>
                <div className="h-px w-full bg-gradient-to-r from-transparent via-[#ffb59d]/50 to-transparent mt-4 opacity-50"></div>
              </div>
            </div>
          </section>

          {/* Roadmap Section */}
          <section className="px-12 py-20 relative z-10">
            <div className="flex justify-between items-end mb-12 border-b border-white/10 pb-8">
              <div>
                <span className="font-mono text-[10px] text-cyan-400 tracking-widest uppercase">MISSION PARAMETERS</span>
                <h3 className="font-sans font-medium text-3xl mt-2 text-white tracking-widest">OPERATIONAL ROADMAP</h3>
              </div>
              <div className="hidden md:block font-mono text-sm tracking-widest text-[#ffb59d]">Q3-Q4 DEPLOYMENT</div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1 */}
              <div className="glossy-panel rounded-3xl group overflow-hidden border border-white/10">
                <div className="h-56 overflow-hidden relative border-b border-white/10">
                  <img className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-80 transition-all duration-700 group-hover:scale-105" alt="Phobos base construction" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBACplwpq98Rkmgv4zvxb0eAEhIsizmNlJTC2jsQBeMtvZnFYMnCJHR6TAhNJ9sfdEr6k_qaF1jw4HuGWKSNZ1nLjHMBWSml5Pfcat6Fvkkaqj3c3JB-Lku9XZXTymKJOzxULcF7cBYsQhH_FC0LOHV6VFeXFn-5Omy3eEJ1a4hAJ5Txfm3dfZA-dKXoSqeNxCa2_yE5V8DhGfuqoeckWsY-xTNWEWCVaobE57lK5IlDNUKTEQ53H_Qy75i26W4xFsKIJcbnR1z87NM" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                  <div className="absolute top-4 left-4 px-3 py-1.5 glossy-panel border border-cyan-500/20 rounded-lg">
                    <span className="font-mono text-[9px] tracking-widest text-cyan-400">PHASE 01</span>
                  </div>
                </div>
                <div className="p-8 relative z-10">
                  <h4 className="font-sans font-medium text-xl mb-3 text-white tracking-wide">Phobos Base Construction</h4>
                  <p className="text-white/50 text-sm mb-8 font-light leading-relaxed">Establishing the first permanent logistics hub on the Martian moon Phobos to support long-term orbital research.</p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#ffb59d] tracking-widest flex items-center gap-2">
                       JAN 2026
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Card 2 */}
              <div className="glossy-panel rounded-3xl group overflow-hidden border border-white/10">
                <div className="h-56 overflow-hidden relative border-b border-white/10">
                  <img className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-80 transition-all duration-700 group-hover:scale-105" alt="Deep space communication relay" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD85HKMyPKmqVyjZ1ilQ9QXGQMuS_ihKntU1-cksmQgiMG7tlG2su3VaQRse6aSrS9PWS31_QDT8avN5E0wJKFXZBnguJQDCR4YAcYcsEouhLHetCjKMIrpnDUdr63QTSrDuZsJ2FHKipCigBpLuHIXXvyqXzJKe8ZxwEkmGg9b6s5Y1GyPW8cvEo7PPvnhYIZpyKJB3h28puIrnHiWeYMkQdPTuHVRlXSsqwf2cdidzDAoagCjT5zucA-7JkJmaFpbW5kbRmgGLzwn" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                  <div className="absolute top-4 left-4 px-3 py-1.5 glossy-panel border border-cyan-500/20 rounded-lg">
                    <span className="font-mono text-[9px] tracking-widest text-cyan-400">PHASE 02</span>
                  </div>
                </div>
                <div className="p-8 relative z-10">
                  <h4 className="font-sans font-medium text-xl mb-3 text-white tracking-wide">Deep Space Comm-Relay</h4>
                  <p className="text-white/50 text-sm mb-8 font-light leading-relaxed">Deploying a constellation of high-throughput relays to ensure 24/7 link connectivity across the inner solar system.</p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#ffb59d] tracking-widest flex items-center gap-2">
                       MAY 2026
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Card 3 */}
              <div className="glossy-panel rounded-3xl group overflow-hidden border border-white/10">
                <div className="h-56 overflow-hidden relative border-b border-white/10">
                  <img className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-80 transition-all duration-700 group-hover:scale-105" alt="Titan Atmosphere Entry" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzD6b_ke7zhqRDJVdHBQX-iXLpaxJIz4vQ4uyrJNv7AogmDUAr5AoWfhVZO26D6YVLlscwk4aOPdPDuhQN4pIdXaTazSOrk5Qfa12o8J32s120W2jYx9-1cudP-CfJai50OuBGCDninDwD-TvW8FPaAbZCIcEHOXBKm-BFFYRIOhK5RgeT2Y_kq5ZJ93AZGld76HzxNVspmEHN56OYwwxqKCY7-D3xhGN7uusHIm0H-z7aFERW-MfahQRPBboJ3mCEtxX4BID1X5ZX" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                  <div className="absolute top-4 left-4 px-3 py-1.5 glossy-panel border border-cyan-500/20 rounded-lg">
                    <span className="font-mono text-[9px] tracking-widest text-cyan-400">PHASE 03</span>
                  </div>
                </div>
                <div className="p-8 relative z-10">
                  <h4 className="font-sans font-medium text-xl mb-3 text-white tracking-wide">Titan Atmosphere Entry</h4>
                  <p className="text-white/50 text-sm mb-8 font-light leading-relaxed">Automated descent and atmospheric analysis of Saturn's largest moon to survey for future methane harvesting sites.</p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#ffb59d] tracking-widest flex items-center gap-2">
                       SEP 2026
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="w-full py-8 px-12 flex justify-center items-center mt-20 border-t border-white/10 bg-black/60">
            <p className="font-mono text-[10px] text-white/30 tracking-[0.2em] uppercase">© 2026 MISSION ODYSSEY. ALL SYSTEMS OPERATIONAL.</p>
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
        <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 h-16 bg-black/85 backdrop-blur-2xl border-b border-white/10 pointer-events-auto">
          <div className="flex items-center gap-4">
            <h1 className="font-sans font-medium text-sm tracking-widest text-[#ffb59d]">
              ODYSSEY <span className="text-white/30 font-light mx-1">//</span> KINETICS ENGINE
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"></span>
              <span className="font-mono text-[10px] tracking-widest text-cyan-400 font-semibold uppercase">
                FLIGHT STATUS: {missionStatus ? missionStatus.replace('_', ' ').toUpperCase() : 'STANDBY'}
              </span>
            </div>
            
            <button
              onClick={() => setIsSimulatorRunning(false)}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/35 text-red-400 hover:text-red-300 rounded-lg font-mono text-[9px] uppercase tracking-widest flex items-center gap-2 glossy-button duration-200 cursor-pointer"
            >
              <LogOut size={12} className="rotate-180" /> 
              Exit Flight Deck
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex pt-16 relative z-10 w-full h-full pointer-events-none">
          {/* Central Canvas Area (Interactive / Data Overlays) - Expanded Full Screen */}
          <main className="flex-1 p-8 relative flex flex-col justify-between pointer-events-none">
            {/* Top Right: Target Selection & Quick Stats */}
            <div className="absolute top-24 right-8 flex flex-col gap-4 items-end pointer-events-auto">
              <div className="p-5 rounded-2xl w-80 text-white border border-white/10 glossy-panel">
                {renderTargetStats()}
              </div>

              {selectedTarget && selectedTarget.name !== "Sun" && (
                <TrajectoryOptimizer
                  originId={getSimulatedOriginId()}
                  destId={Number(Object.entries({1: 'Mercury', 2: 'Venus', 3: 'Earth', 4: 'Mars', 5: 'Jupiter', 6: 'Saturn'}).find(([_, name]) => name === selectedTarget.name)?.[0] || 4)}
                  globalTimeRef={globalTimeRef}
                  onApply={handleApply}
                />
              )}

              {/* Texture Preview Mini-panels */}
              <div className="flex gap-2 max-w-80 flex-wrap justify-end">
                {PLANETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() =>
                      setSelectedTarget(
                        selectedTarget?.name === p.name ? null : p,
                      )
                    }
                    className={`w-10 h-10 rounded border overflow-hidden cursor-pointer transition-all ${selectedTarget?.name === p.name ? "border-primary glow-primary opacity-100 scale-110" : "border-outline-variant/50 opacity-50 hover:opacity-100"}`}
                  >
                    <img
                      src={p.texture}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Right: Time Controls */}
            <div className="absolute bottom-24 right-8 p-5 rounded-2xl w-80 flex flex-col gap-4 pointer-events-auto border border-white/10 glossy-panel text-white">
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] tracking-widest text-cyan-400 font-semibold uppercase">
                  TIME DILATION
                </span>
                <span className="font-mono text-xs text-white font-bold bg-white/10 px-2 py-0.5 rounded">
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
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />

              <div className="flex justify-between text-white/40 font-mono text-[7.5px] tracking-wider">
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
