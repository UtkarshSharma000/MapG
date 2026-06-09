import React from "react";
import { motion } from "motion/react";
import { Canvas } from "@react-three/fiber";
import { Play, ArrowRight } from "lucide-react";
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
  return (
    <section className="relative min-h-screen bg-[#050505] flex flex-col justify-center overflow-hidden z-20">
      {/* MASSIVE BACKGROUND TEXT */}
      <motion.div 
        initial={{ opacity: 0, x: -100 }}
        animate={isSimulatorRunning ? { opacity: 0 } : { opacity: 1, x: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-1/2 -translate-y-1/2 left-0 w-full pointer-events-none flex justify-center z-0 mix-blend-difference"
      >
        <h1 
          className="text-[#ffffff] leading-none whitespace-nowrap text-[35vw] font-black select-none tracking-tighter"
          style={{ fontFamily: "'Oi', cursive", opacity: 0.15 }}
        >
          ORBIT
        </h1>
      </motion.div>

      {/* FLOATING 3D GLOBE OVERLAY */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isSimulatorRunning ? { opacity: 0 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, delay: 0.2, type: "spring" }}
        className="absolute inset-0 z-10 hidden md:flex items-center justify-center pointer-events-none"
      >
        <div className="w-[50vw] aspect-square rounded-full overflow-hidden opacity-80 mix-blend-luminosity">
          <Canvas camera={{ position: [0, 0, 2.5] }}>
            <InteractiveGlobe url="/textures/2k_mars.jpg" color="#ffffff" />
          </Canvas>
        </div>
      </motion.div>

      {/* FOREGROUND CONTENT */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={isSimulatorRunning ? { opacity: 0, y: -50 } : { opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-20 w-full max-w-7xl mx-auto px-8 md:px-16 flex flex-col md:flex-row items-end justify-between gap-12"
      >
        <div className="w-full md:w-1/2 pt-[30vh]">
          <h2 className="text-white text-5xl md:text-7xl lg:text-[100px] leading-[0.9] font-headline-md font-bold italic mb-6">
            Orbital <br/> Paths
          </h2>
          <p className="text-[#a0a0a0] font-label-caps text-sm md:text-base uppercase tracking-[0.2em] max-w-sm mb-12">
            High-precision simulation of celestial trajectories.
          </p>

          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsSimulatorRunning(true)}
              className="bg-white text-black px-8 py-5 rounded-full flex items-center gap-3 font-bold uppercase tracking-wider hover:bg-gray-200 transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <Play size={18} fill="currentColor" /> Initialize
            </button>
            <div className="flex flex-col text-white font-label-caps text-xs tracking-widest uppercase">
              <span className="opacity-50">System Version</span>
              <span>v.9.0.21</span>
            </div>
          </div>
        </div>

        <div className="w-full md:w-1/3 flex flex-col items-end text-right pb-4 border-b border-white/20">
          <span className="text-white text-4xl md:text-6xl font-headline-md italic mb-2">Manifest</span>
          <a 
            href="https://Srinivasa.2bd.net" 
            target="_blank" rel="noreferrer"
            className="flex items-center gap-3 text-[#cccccc] font-label-caps text-xs tracking-widest group hover:text-white transition-colors"
          >
            SEE THE SOURCE CODE <ArrowRight size={14} className="group-hover:translate-x-2 transition-transform" />
          </a>
        </div>
      </motion.div>
      
      {/* ABSOLUTE DECORATIVE ELEMENTS */}
      <div className="absolute top-8 left-8 md:left-16 z-20 flex items-start gap-4 mix-blend-difference">
        <span className="text-white font-label-caps text-xs tracking-[0.3em]">SRINIVASA // CORE</span>
      </div>
    </section>
  );
}
