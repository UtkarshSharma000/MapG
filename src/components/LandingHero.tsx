import React, { useRef } from "react";
import { motion } from "motion/react";
import { Canvas } from "@react-three/fiber";
import { InteractiveGlobe } from "./InteractiveGlobe";

interface LandingHeroProps {
  isSimulatorRunning: boolean;
  setIsSimulatorRunning: (running: boolean) => void;
  landingScrollRef: React.RefObject<HTMLDivElement | null>;
}

export default function LandingHero({
  isSimulatorRunning,
  setIsSimulatorRunning,
  landingScrollRef,
}: LandingHeroProps) {
  const containerRef = useRef(null);

  return (
    <section 
      ref={containerRef}
      className="relative min-h-screen bg-[#000000] flex flex-col justify-center overflow-hidden z-20"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* FULL-BLEED 3D ORGANIC RENDER (Using Interactive Globe as placeholder) */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={isSimulatorRunning ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
      >
        <div className="w-full h-full opacity-60">
          <Canvas camera={{ position: [0, 0, 3] }}>
            <InteractiveGlobe url="/textures/2k_mars.jpg" color="#ffffff" />
          </Canvas>
        </div>
      </motion.div>

      {/* TOP NAVIGATION BAR */}
      <nav className="absolute top-0 left-0 w-full px-8 md:px-12 py-8 flex justify-between items-start z-30 mix-blend-difference pointer-events-auto">
        <div className="text-[#ffffff] text-[12px] font-normal uppercase">
          monopo saigon
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex gap-4 text-[#ffffff] text-[11px] font-normal lowercase opacity-70">
            <a href="#" className="hover:opacity-100 transition-opacity">en</a>
          </div>
          <div className="flex flex-col items-end gap-[15px] ml-8 text-[#ffffff] text-[12px] font-normal uppercase">
            <a href="#" className="hover:opacity-70 transition-opacity">WORK</a>
            <a href="#" className="hover:opacity-70 transition-opacity">MANIFESTO</a>
            <a href="https://github.com/UtkarshSharma000/Srinivasa" target="_blank" rel="noreferrer" className="hover:opacity-70 transition-opacity">SOURCE</a>
          </div>
        </div>
      </nav>

      {/* HERO CENTERED STATEMENT */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={isSimulatorRunning ? { opacity: 0, y: -30 } : { opacity: 1, y: 0 }}
        transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-20 w-full flex justify-center items-center pointer-events-none px-4"
      >
        <h1 
          className="text-[#ffffff] font-light text-center m-0 p-0"
          style={{ 
            fontSize: "clamp(60px, 15vw, 225px)", 
            lineHeight: 0.76,
            letterSpacing: "normal",
            fontWeight: 300
          }}
        >
          SRINIVASA
        </h1>
      </motion.div>

      {/* PRIMARY CTA & COOKIE BANNER (Combined for landing page action) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isSimulatorRunning ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
        className="absolute bottom-12 right-12 z-30 pointer-events-auto flex flex-col gap-4 items-end"
      >
        <button 
          onClick={() => setIsSimulatorRunning(true)}
          className="bg-[#ffffff] text-[#181818] rounded-[75px] flex items-center justify-center px-[24px] py-[12px] hover:bg-[#e0e0e0] transition-colors"
        >
          <span className="text-[12px] font-normal uppercase leading-none tracking-wide">Initialize System</span>
        </button>

        <div className="bg-[#ffffff] px-6 py-4 rounded-[0px] flex border-none w-[320px] flex-col mt-4">
            <p className="text-[#181818] text-[12px] font-normal font-sans mb-4 leading-[1.39]">By using this system, you agree to the use of cookies for performance analysis. <span className="underline cursor-pointer">Privacy policy</span>.</p>
            <div className="flex justify-between items-center w-full">
              <button 
                className="bg-[#636363] text-[#ffffff] rounded-[75px] px-[6px] py-[1px] text-[12px] font-normal tracking-wide"
              >
                Accept
              </button>
              <button className="text-[#181818] text-[9px] font-normal">
                X
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
          <text className="text-[#ffffff] text-[9px]" style={{ fontFamily: "system-ui, sans-serif" }}>
            <textPath href="#curve" startOffset="0" className="tracking-[3px] uppercase">
              Scroll to explore • Scroll to explore •
            </textPath>
          </text>
        </svg>
      </motion.div>
    </section>
  );
}
