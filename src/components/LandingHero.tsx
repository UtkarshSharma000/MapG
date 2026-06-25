import React, { useRef } from "react";
import { motion } from "motion/react";
import UnicornScene from "unicornstudio-react";

interface LandingHeroProps {
  isSimulatorRunning: boolean;
  setIsSimulatorRunning: (running: boolean) => void;
  setIsBuilderRunning: (running: boolean) => void;
  landingScrollRef: React.RefObject<HTMLDivElement | null>;
}

export default function LandingHero({
  isSimulatorRunning,
  setIsSimulatorRunning,
  setIsBuilderRunning,
  landingScrollRef,
}: LandingHeroProps) {
  const containerRef = useRef(null);

  return (
    <section 
      ref={containerRef}
      className="relative min-h-screen bg-[#000000] flex flex-col justify-center overflow-hidden z-20 font-sans"
    >
      {/* FULL-BLEED 3D ORGANIC RENDER (Using Interactive Globe as placeholder) */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={isSimulatorRunning ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
      >
        <div className="w-full h-full opacity-100 relative overflow-hidden unicorn-container">
          <UnicornScene 
            projectId="ImvMyVKxQHs8wdj6ezaa" 
            sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.5/dist/unicornStudio.umd.js"
            width="100%" 
            height="100%" 
            production={true}
          />
        </div>
      </motion.div>

      {/* TOP NAVIGATION BAR */}
      <nav className="absolute top-0 left-0 w-full px-8 md:px-12 py-8 flex justify-between items-start z-30 mix-blend-difference pointer-events-auto">
        <div className="text-[#ffffff] text-[12px] font-bold uppercase tracking-widest">
          Srinivasa
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex flex-col items-end gap-[15px] ml-8 text-[#ffffff] text-[12px] font-bold uppercase tracking-widest">
            <a href="#" className="hover:text-primary transition-colors">WORK</a>
            <a href="#" className="hover:text-primary transition-colors">MANIFESTO</a>
            <a href="https://github.com/UtkarshSharma000/Srinivasa" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">SOURCE</a>
          </div>
        </div>
      </nav>

      {/* HERO CENTERED STATEMENT */}
      {/* Centered statement removed as requested */}

      {/* PRIMARY CTA & COOKIE BANNER (Combined for landing page action) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isSimulatorRunning ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
        className="absolute bottom-12 right-12 z-30 pointer-events-auto flex flex-col gap-4 items-end"
      >
        <div className="flex gap-4">
          <button 
            onClick={() => setIsBuilderRunning(true)}
            className="bg-surface-bright text-primary rounded-none flex items-center justify-center px-6 py-4 hover:bg-surface-container-low transition-colors border-2 border-primary"
          >
            <span className="text-sm font-bold uppercase tracking-widest">Satellite Builder</span>
          </button>
          
          <button 
            onClick={() => setIsSimulatorRunning(true)}
            className="bg-primary text-on-primary rounded-none flex items-center justify-center px-6 py-4 hover:bg-primary-fixed-dim transition-colors border-2 border-primary"
          >
            <span className="text-sm font-bold uppercase tracking-widest">Initialize System</span>
          </button>
        </div>

        <div id="privacy-box" className="bg-surface-container-low px-6 py-4 border-2 border-outline-variant w-[320px] flex flex-col mt-4">
            <p className="text-secondary text-[12px] font-sans mb-4 leading-relaxed">No data is collected or sold. This project is open source at <a href="https://github.com/UtkarshSharma000/MapG" target="_blank" rel="noreferrer" className="underline hover:text-primary">UtkarshSharma000/MapG</a>.<br/><br/>Queries or suggestions: <a href="mailto:utkarsh05nr@gmail.com" className="underline hover:text-primary">utkarsh05nr@gmail.com</a></p>
            <div className="flex justify-between items-center w-full">
              <button 
                onClick={() => {
                  const el = document.getElementById('privacy-box');
                  if (el) el.style.display = 'none';
                }}
                className="bg-surface-bright text-primary px-4 py-1 text-xs font-bold uppercase tracking-widest border border-outline-variant hover:border-primary transition-colors"
              >
                Acknowledge
              </button>
              <button 
                onClick={() => {
                  const el = document.getElementById('privacy-box');
                  if (el) el.style.display = 'none';
                }}
                className="text-secondary hover:text-primary transition-colors text-xs font-bold"
              >
                [X]
              </button>
            </div>
        </div>
      </motion.div>

      {/* SCROLL INDICATOR */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isSimulatorRunning ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="absolute bottom-12 left-12 z-30 pointer-events-none"
      >
        <svg viewBox="0 0 100 100" width="80" height="80" className="animate-[spin_10s_linear_infinite]">
          <path id="curve" d="M 50 50 m -35 0 a 35 35 0 1 1 70 0 a 35 35 0 1 1 -70 0" fill="transparent" />
          <text className="fill-primary text-[9px] font-bold" style={{ fontFamily: "var(--font-mono)" }}>
            <textPath href="#curve" startOffset="0" className="tracking-[3px] uppercase">
              Scroll to explore • Scroll to explore •
            </textPath>
          </text>
        </svg>
      </motion.div>
    </section>
  );
}
