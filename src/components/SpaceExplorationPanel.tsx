import React from 'react';
import { motion } from 'framer-motion';

interface SpaceExplorationProps {
  cinematicSectionRef: React.RefObject<HTMLDivElement>;
  scrollProgressRef: React.MutableRefObject<number>;
  landingScrollRef: React.RefObject<HTMLDivElement>;
}

export default function SpaceExplorationPanel({ cinematicSectionRef }: SpaceExplorationProps) {
  return (
    <section ref={cinematicSectionRef} className="min-h-screen relative flex items-center justify-center p-6 bg-black border-b border-white/10">
      <div className="absolute inset-0 stargate-gradient opacity-20 pointer-events-none" />
      
      <motion.div 
         initial={{ x: -50, opacity: 0 }} 
         whileInView={{ x: 0, opacity: 1 }} 
         viewport={{ once: true, margin: "-100px" }}
         transition={{ duration: 1 }}
         className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10"
      >
        <div>
          <h2 className="text-4xl md:text-5xl font-black mb-8 text-white tracking-widest uppercase">N-Body <span className="text-primary-fixed">Systems</span></h2>
          <div className="space-y-6 text-secondary text-lg font-light">
            <p>
              Utilizing advanced symplectic integration methods, the Srinivasa core simulates chaotic orbital trajectories with rigorous numerical stability.
            </p>
            <p>
              Predict the intricate dance of celestial bodies across deep time. Observe resonance patterns, chaotic deflections, and the delicate balance of gravity governing our cosmos.
            </p>
          </div>
          <div className="mt-8 flex gap-4">
            <div className="text-left">
              <span className="block text-primary-fixed font-mono text-xl">10.0x</span>
              <span className="text-[10px] uppercase tracking-widest text-secondary">Integration Acc</span>
            </div>
            <div className="w-[1px] h-12 bg-white/10" />
            <div className="text-left">
              <span className="block text-primary-fixed font-mono text-xl">RK4</span>
              <span className="text-[10px] uppercase tracking-widest text-secondary">Solver Model</span>
            </div>
          </div>
        </div>
        
        <div className="aspect-square rounded-full flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 border border-primary-fixed/20 rounded-full animate-[spin_60s_linear_infinite]" />
          <div className="absolute inset-4 border border-dashed border-white/20 rounded-full animate-[spin_40s_linear_infinite_reverse]" />
          <div className="absolute inset-8 border border-primary-fixed/10 rounded-full animate-[spin_20s_linear_infinite]" />
          
          <div className="text-center relative z-10">
            <span className="material-symbols-outlined text-5xl text-primary-fixed opacity-50 mb-4 block">orbit</span>
            <span className="text-xs tracking-widest text-secondary font-mono">SIM_ENGINE_READY</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
