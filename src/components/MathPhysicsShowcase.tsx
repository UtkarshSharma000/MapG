import React from 'react';
import { motion } from 'framer-motion';

interface MathPhysicsProps {
  setIsSimulatorRunning: (v: boolean) => void;
  landingScrollRef: React.RefObject<HTMLDivElement>;
}

export default function MathPhysicsShowcase({ setIsSimulatorRunning }: MathPhysicsProps) {
  return (
    <section className="py-32 bg-[#080808] text-white relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-fixed/50 to-transparent" />
      
      <div className="max-w-6xl mx-auto px-6 text-center">
        <motion.div
           initial={{ opacity: 0, y: 20 }} 
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
        >
          <span className="material-symbols-outlined text-4xl text-primary-fixed mb-6 block">calculate</span>
          <h2 className="text-3xl md:text-5xl font-black tracking-widest mb-16 uppercase text-white">
            The Mathematical <span className="text-primary-fixed block md:inline mt-2 md:mt-0">Legacy</span>
          </h2>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          {[
            { 
              title: "Infinite Series", 
              desc: "Modeling continuous orbital variations through infinite approximations, echoing Ramanujan's formulas for Pi.",
              icon: "all_inclusive"
            },
            { 
              title: "Elliptic Orbits", 
              desc: "Describing complex planetary orbits mapping to specialized mathematical phenomena and theta functions.",
              icon: "data_usage"
            },
            { 
              title: "Chaos Theory", 
              desc: "Finding the hidden sensitivity and underlying order in n-body trajectories across vast cosmological epochs.",
              icon: "blur_on"
            }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.95 }} 
              whileInView={{ opacity: 1, scale: 1 }} 
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              className="p-8 border border-white/5 hover:border-primary-fixed/40 transition-colors bg-surface-container-lowest group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-primary-fixed transform origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-300" />
              <span className="material-symbols-outlined text-3xl text-white/30 group-hover:text-primary-fixed transition-colors mb-6 block">{item.icon}</span>
              <h3 className="text-xl font-bold mb-4 tracking-wide uppercase">{item.title}</h3>
              <p className="text-sm font-mono text-secondary leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
        
        <motion.div 
          className="mt-24"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <button 
            onClick={() => setIsSimulatorRunning(true)}
            className="px-12 py-5 bg-white text-black font-black uppercase tracking-[0.2em] hover:bg-primary-fixed hover:scale-105 transition-all outline-none focus:ring-4 ring-primary-fixed/50"
            >
            Initialize Simulation
          </button>
        </motion.div>
      </div>
    </section>
  );
}
