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

  const [targetPlanet, setTargetPlanet] = useState<string | null>(null);

  const handleLaunch = () => {
    setIsLaunched(true);
  };

  const handleSelectLocation = (planet: string, lat: number, lon: number) => {
    if (planet === "Earth") {
      setLaunchLocation({ lat, lon });
    } else {
      setTargetPlanet(planet);
      setTargetLocation({ lat, lon });
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
        launchParams={{ v0, pitch, yaw, nbody, launchLocation, targetLocation, targetPlanet, timeMult, isLaunched }}
        onPlanetDoubleClick={(name: string) => setMapPlanet(name)}
      />

      {/* Landing Page Content */}
      <div
        className={`absolute inset-0 z-20 flex flex-col transition-opacity duration-1000 ${isSimulatorRunning ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"}`}
      >
        {/* Video element at the bottom */}
        <div className="absolute bottom-0 left-0 w-full h-[60vh] z-0 overflow-hidden pointer-events-none">
          {/* Gradient to smooth the top edge of the video */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#03060f] to-transparent z-10" />
          <video
            src="/aura.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover mix-blend-screen opacity-60"
          />
        </div>

        {/* Top Navigation */}
        <header className="relative z-50 flex justify-between items-center px-10 h-20 border-b border-white/5 bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-8">
            <h1 className="font-headline-md font-bold text-white tracking-widest text-xl">
              ODYSSEY
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-xs font-mono text-white/50 tracking-widest">
              AWAITING IGNITION
            </span>
          </div>
        </header>

        {/* Main Content - Sleek Interface */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
          <div className="max-w-2xl text-center flex flex-col items-center">
            <div className="inline-block px-3 py-1 mb-6 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono tracking-widest backdrop-blur-xl">
              v2.0 // HELIOCENTRIC ENGINE
            </div>

            <h2 className="text-5xl md:text-7xl font-light tracking-tighter text-white mb-6">
              Solar System <br />
              <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                Kinetics.
              </span>
            </h2>

            <p className="text-lg text-white/50 font-light max-w-xl mb-12">
              Precise N-body and Keplerian element research simulator. Connect
              deep space modules to analyze trajectories in real-time.
            </p>

            <button
              onClick={() => setIsSimulatorRunning(true)}
              className="group relative px-8 py-4 bg-white text-black font-semibold rounded-full overflow-hidden flex items-center justify-center gap-3 hover:scale-105 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-200 to-indigo-200 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 font-label-caps tracking-widest text-sm flex items-center gap-3">
                INITIALIZE SIMULATOR <ArrowRight size={18} />
              </span>
            </button>
          </div>
        </main>
      </div>

      {/* Simulator Overlay UI */}
      <div
        className={`absolute inset-0 z-30 pointer-events-none flex flex-col transition-opacity duration-1000 ${isSimulatorRunning ? "opacity-100" : "opacity-0"}`}
      >
        {isSimulatorRunning && <TelemetryPanel />}
        {isSimulatorRunning && (
          <LaunchHUD
            v0={v0}
            setV0={setV0}
            pitch={pitch}
            setPitch={setPitch}
            yaw={yaw}
            setYaw={setYaw}
            nbody={nbody}
            setNbody={setNbody}
            targetOrbit={targetOrbit}
            setTargetOrbit={setTargetOrbit}
            onLaunch={handleLaunch}
            isLaunched={isLaunched}
          />
        )}
        {mapPlanet && (
          <Planet2DMap 
            planetName={mapPlanet}
            onClose={() => setMapPlanet(null)}
            onSelectLocation={handleSelectLocation}
            isTargetSettings={mapPlanet !== "Earth"}
          />
        )}
        {/* Orbit Lines HUD Simulation */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
          <div className="orbit-path w-[800px] h-[800px]"></div>
          <div className="orbit-path w-[1200px] h-[1200px] orbit-active"></div>
          <div className="orbit-path w-[1600px] h-[1600px]"></div>
        </div>

        {/* TopAppBar */}
        <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-gutter h-16 bg-surface/60 backdrop-blur-xl border-b border-outline-variant/30 pointer-events-auto">
          <div className="flex items-center gap-6">
            <h1 className="font-headline-md text-[24px] tracking-tighter text-primary">
              ODYSSEY 2026
            </h1>
            <nav className="hidden md:flex gap-8 ml-8">
              <button className="font-label-caps text-[10px] tracking-[0.15em] text-on-surface-variant hover:text-primary hover:scale-105 transition-all duration-300">
                TELEMETRY
              </button>
              <button className="font-label-caps text-[10px] tracking-[0.15em] text-primary border-b border-primary pb-1 scale-95 transition-transform">
                TRAJECTORY
              </button>
              <button className="font-label-caps text-[10px] tracking-[0.15em] text-on-surface-variant hover:text-primary hover:scale-105 transition-all duration-300">
                PAYLOAD
              </button>
              <button className="font-label-caps text-[10px] tracking-[0.15em] text-on-surface-variant hover:text-primary hover:scale-105 transition-all duration-300">
                COMMMS
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-label-caps text-[10px] tracking-[0.15em] text-secondary px-3 py-1 bg-secondary-container/20 border border-secondary/30 rounded flex items-center gap-2 glow-secondary">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              SYSTEM NOMINAL
            </span>
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <Satellite size={20} />
            </button>
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <Settings2 size={20} />
            </button>
            <button
              onClick={() => setIsSimulatorRunning(false)}
              className="text-on-surface-variant hover:text-primary transition-colors ml-4"
            >
              <LogOut size={20} className="rotate-180" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex pt-16 relative z-10 w-full h-full pointer-events-none">
          {/* SideNavBar (Telemetry HUD) */}
          <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] z-40 flex flex-col py-panel_padding bg-surface-container-low/40 backdrop-blur-md border-r border-outline-variant/20 w-64 transition-all duration-500 overflow-hidden pointer-events-auto">
            <div className="px-6 mb-8">
              <div className="font-label-caps text-[10px] tracking-[0.15em] text-outline mb-1">
                Mission Control Admin
              </div>
              <div className="font-headline-md text-[24px] tracking-tighter text-on-surface truncate">
                SATELLITE-01
              </div>
              <div className="font-label-caps text-[10px] tracking-[0.15em] text-tertiary mt-1">
                LEO ORBITAL
              </div>
            </div>

            <nav className="flex flex-col gap-2 flex-1 px-4">
              <button className="flex items-center gap-4 px-4 py-3 rounded text-outline hover:bg-surface-variant/30 hover:text-on-surface transition-all duration-200 w-full text-left">
                <Activity size={18} />
                <span className="font-label-caps text-[10px] tracking-[0.15em]">
                  HEALTH
                </span>
              </button>
              <button className="flex items-center gap-4 px-4 py-3 rounded text-outline hover:bg-surface-variant/30 hover:text-on-surface transition-all duration-200 w-full text-left">
                <Activity size={18} />
                <span className="font-label-caps text-[10px] tracking-[0.15em]">
                  POWER
                </span>
              </button>
              <button className="flex items-center gap-4 px-4 py-3 rounded text-outline hover:bg-surface-variant/30 hover:text-on-surface transition-all duration-200 w-full text-left">
                <Activity size={18} />
                <span className="font-label-caps text-[10px] tracking-[0.15em]">
                  THERMAL
                </span>
              </button>
              <button className="flex items-center gap-4 px-4 py-3 rounded text-outline hover:bg-surface-variant/30 hover:text-on-surface transition-all duration-200 w-full text-left">
                <Activity size={18} />
                <span className="font-label-caps text-[10px] tracking-[0.15em]">
                  SIGNAL
                </span>
              </button>
              <button className="flex items-center gap-4 px-4 py-3 rounded bg-secondary-container/20 text-secondary border-r-2 border-secondary scale-102 transition-transform duration-200 w-full text-left">
                <Globe size={18} />
                <span className="font-label-caps text-[10px] tracking-[0.15em]">
                  ORBIT
                </span>
              </button>
            </nav>
          </aside>

          {/* Central Canvas Area (Interactive / Data Overlays) */}
          <main className="flex-1 ml-64 p-8 relative flex flex-col justify-between pointer-events-none">
            {/* Top Right: Target Selection & Quick Stats */}
            <div className="absolute top-20 right-8 flex flex-col gap-4 items-end pointer-events-auto">
              <div className="glass-panel p-4 rounded-lg w-72">
                {renderTargetStats()}
              </div>

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

            {/* Bottom Left: Time Controls */}
            <div className="absolute bottom-24 left-8 glass-panel p-6 rounded-lg w-96 flex flex-col gap-4 pointer-events-auto">
              <div className="flex justify-between items-center">
                <span className="font-label-caps text-[10px] tracking-[0.15em] text-outline">
                  TIME DILATION
                </span>
                <span className="font-data-lg text-[20px] text-secondary">
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
                className="w-full accent-secondary"
              />

              <div className="flex justify-between text-outline-variant font-label-caps text-[8px] tracking-[0.15em] mt-1">
                <span>REALTIME</span>
                <span>DAYS</span>
                <span>MONTHS</span>
                <span>YEARS</span>
                <span>DECADES</span>
                <span>CENTURIES</span>
              </div>
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="absolute bottom-0 w-full flex justify-between items-center px-screen_margin py-4 z-10 bg-transparent pointer-events-auto">
          <div className="font-label-caps text-[10px] tracking-[0.15em] text-outline opacity-80 hover:opacity-100 transition-colors">
            © 2026 MISSION ODYSSEY | AEROSPACE DIVISION
          </div>
          <div className="flex gap-6">
            <button className="font-label-caps text-[10px] tracking-[0.15em] text-outline hover:text-on-surface transition-colors">
              LEGAL
            </button>
            <button className="font-label-caps text-[10px] tracking-[0.15em] text-outline hover:text-on-surface transition-colors">
              PROTOCOL
            </button>
            <button className="font-label-caps text-[10px] tracking-[0.15em] text-outline hover:text-on-surface transition-colors">
              ENCRYPTION
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
