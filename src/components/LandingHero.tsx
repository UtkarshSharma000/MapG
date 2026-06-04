import React from "react";
import { motion } from "motion/react";
import { Canvas } from "@react-three/fiber";
import { Play, Github } from "lucide-react";
import { InteractiveGlobe } from "./InteractiveGlobe";
import ScrollFloat from "./ScrollFloat";
import ScrollReveal from "./ScrollReveal";

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
    <section className="relative min-h-[90vh] flex items-center px-8 md:px-[32px] overflow-hidden z-20">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={isSimulatorRunning ? { opacity: 0 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative z-10 max-w-4xl"
      >
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 glass-panel border border-primary/30 rounded">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span className="font-label-caps text-[10px] text-primary tracking-widest">SYSTEMS NOMINAL // ORBITAL SECTOR 7</span>
        </div>
        
        <ScrollFloat
          animationDuration={1}
          ease="back.inOut(2)"
          scrollStart="center bottom+=50%"
          scrollEnd="bottom bottom-=40%"
          stagger={0.02}
          scrollContainerRef={landingScrollRef}
          textClassName="font-display-lg text-5xl md:text-[64px] font-bold mb-2 leading-none tracking-tighter block text-left"
        >
          MISSION:
        </ScrollFloat>
        <ScrollFloat
          animationDuration={1.2}
          ease="back.inOut(2)"
          scrollStart="center bottom+=50%"
          scrollEnd="bottom bottom-=40%"
          stagger={0.03}
          scrollContainerRef={landingScrollRef}
          textClassName="font-display-lg text-primary glow-primary text-6xl md:text-[80px] font-bold mb-6 leading-none tracking-tighter block text-left"
        >
          MAP G
        </ScrollFloat>
        
        <ScrollReveal
          baseOpacity={0}
          enableBlur={true}
          baseRotation={5}
          blurStrength={10}
          scrollContainerRef={landingScrollRef}
          textClassName="font-headline-md text-xl md:text-2xl text-on-surface-variant mb-10 max-w-2xl font-light text-left"
        >
          Pioneering the Next Frontier of Satellite Logistics and Orbital Infrastructure.
        </ScrollReveal>
        
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => setIsSimulatorRunning(true)}
            className="px-10 py-4 bg-primary-container text-on-primary-container font-label-caps text-label-caps tracking-widest glow-primary hover:scale-105 active:scale-95 transition-all cursor-pointer rounded-full flex items-center gap-2"
          >
            <Play size={16} fill="currentColor" /> LAUNCH TERMINAL
          </button>
          <a 
            href="https://github.com/UtkarshSharma000/MapG"
            target="_blank"
            rel="noreferrer"
            className="px-10 py-4 glass-panel border border-tertiary/40 text-tertiary font-label-caps text-label-caps tracking-widest glow-blue hover:scale-105 hover:bg-white/5 active:scale-95 transition-all rounded-full cursor-pointer inline-flex items-center gap-2"
          >
            <Github size={16} /> VIEW SOURCE
          </a>
        </div>
      </motion.div>
      {/* Side Floating Visual */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isSimulatorRunning ? { opacity: 0 } : { opacity: 0.9, scale: 1 }}
        transition={{ duration: 1.5, delay: 0.4, type: "spring" }}
        className="absolute right-0 top-1/2 -translate-y-1/2 w-1/3 aspect-square hidden xl:block"
      >
        <div className="relative w-full h-full cursor-grab active:cursor-grabbing opacity-90 transition-opacity duration-500">
          <Canvas camera={{ position: [0, 0, 3] }}>
            <InteractiveGlobe url="/textures/2k_mars.jpg" color="#c1440e" />
          </Canvas>
          <div className="absolute inset-0 bg-gradient-to-l from-[#050505]/60 to-transparent pointer-events-none"></div>
        </div>
      </motion.div>
    </section>
  );
}
