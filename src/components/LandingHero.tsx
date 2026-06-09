import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface LandingHeroProps {
  isSimulatorRunning: boolean;
  setIsSimulatorRunning: (v: boolean) => void;
  landingScrollRef: React.RefObject<HTMLDivElement>;
}

export default function LandingHero({ isSimulatorRunning, setIsSimulatorRunning, landingScrollRef }: LandingHeroProps) {
  const { scrollY } = useScroll({ container: landingScrollRef });
  const yText = useTransform(scrollY, [0, 800], [0, 400]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0]);

  return (
    <section className="min-h-screen relative flex flex-col justify-center items-center overflow-hidden bg-black text-white p-6">
      <div className="absolute inset-0 bg-gradient-to-b from-[#13111A] to-black opacity-80 mix-blend-multiply" />
      <div className="absolute inset-0 tech-grid-bg opacity-30" />

      <motion.div 
        style={{ y: yText, opacity }}
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }} 
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="z-10 text-center flex flex-col items-center justify-center max-w-4xl w-full pt-20"
      >
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="px-4 py-1 border border-primary-fixed/30 rounded-full mb-8"
        >
          <span className="text-secondary text-[10px] tracking-widest uppercase">Project 1729</span>
        </motion.div>

        <h1 className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
          SRINIVASA
        </h1>
        
        <p className="text-sm md:text-lg font-mono text-primary-fixed tracking-[0.3em] uppercase mb-12 border-y border-white/10 py-4 opacity-90 max-w-2xl mx-auto">
          "An equation for me has no meaning, unless it expresses a thought of God." — S. Ramanujan
        </p>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsSimulatorRunning(true)}
          className="group relative px-8 py-4 border-2 border-primary-fixed text-primary-fixed hover:bg-primary-fixed hover:text-black transition-all transition-colors uppercase tracking-widest font-bold overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300 pointer-events-none" />
          <span className="relative z-10">Access Dashboard</span>
        </motion.button>
      </motion.div>
    </section>
  );
}
