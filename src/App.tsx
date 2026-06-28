import React, { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { Spacecraft } from "./core/spacecraft/Spacecraft";
import { Validator } from "./core/validation/Validator";
import { LaunchSimulator } from "./components/LaunchSimulator";
import SatelliteBuilder from "./components/SatelliteBuilder";
import LandingHero from "./components/LandingHero";

function BuilderFlow() {
  const [spacecraft, setSpacecraft] = useState<Spacecraft | null>(null);
  const [phase, setPhase] = useState<"BUILDER" | "VALIDATING" | "LAUNCH">(
    "BUILDER",
  );
  const [validationReport, setValidationReport] = useState<any>(null);

  const handleValidate = (sc: Spacecraft) => {
    setSpacecraft(sc);
    const report = Validator.validate(sc);
    setValidationReport(report);
    setPhase("VALIDATING");
  };

  const handleLaunch = () => {
    setPhase("LAUNCH");
  };

  const returnToVAB = () => {
    setPhase("BUILDER");
    setValidationReport(null);
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden font-mono">
      {phase === "BUILDER" && (
        <SatelliteBuilder onClose={() => {}} onValidate={handleValidate} />
      )}

      {phase === "VALIDATING" && spacecraft && (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-8 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-8 max-w-2xl w-full text-white shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-cyan-400 flex items-center gap-3 border-b border-zinc-800 pb-4">
              Pre-Launch Validation Report
            </h2>

            <div className="space-y-4 mb-6">
              {validationReport?.errors.map((e: string, i: number) => (
                <div
                  key={i}
                  className="text-red-400 p-3 bg-red-900/20 border border-red-900/50 rounded"
                >
                  [ERROR] {e}
                </div>
              ))}
              {validationReport?.warnings.map((w: string, i: number) => (
                <div
                  key={i}
                  className="text-amber-400 p-3 bg-amber-900/20 border border-amber-900/50 rounded"
                >
                  [WARNING] {w}
                </div>
              ))}
              {validationReport?.infos.map((info: string, i: number) => (
                <div
                  key={i}
                  className="text-zinc-400 p-3 bg-zinc-900/50 border border-zinc-800 rounded"
                >
                  [INFO] {info}
                </div>
              ))}
            </div>

            <div className="flex gap-4 border-t border-zinc-800 pt-6">
              <button
                onClick={returnToVAB}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-widest rounded"
              >
                RETURN TO VAB
              </button>
              <button
                onClick={handleLaunch}
                disabled={!validationReport?.isValid}
                className="flex-1 py-3 bg-green-600 disabled:bg-zinc-800 disabled:text-zinc-600 hover:bg-green-500 text-white font-bold text-xs uppercase tracking-widest rounded shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all"
              >
                PROCEED TO LAUNCH PAD
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "LAUNCH" && spacecraft && (
        <LaunchSimulator
          spacecraft={spacecraft}
          onAbort={returnToVAB}
          onOrbitReached={() => {
            console.log("Orbit reached");
          }}
        />
      )}
    </div>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const [isSimulatorRunning, setIsSimulatorRunning] = useState(false);

  return (
    <div className="relative min-h-screen bg-black overflow-hidden selection:bg-primary/30">
      <LandingHero
        isSimulatorRunning={isSimulatorRunning}
        setIsSimulatorRunning={setIsSimulatorRunning}
        setIsBuilderRunning={(val) => {
          if (val) navigate("/builder");
        }}
        landingScrollRef={{ current: null }}
      />
      {isSimulatorRunning && (
        <div className="absolute inset-0 z-10 bg-black flex items-center justify-center text-white">
          Initializing System...
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/builder" element={<BuilderFlow />} />
    </Routes>
  );
}
