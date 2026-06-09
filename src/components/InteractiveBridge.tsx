import React from 'react';
import { motion } from 'framer-motion';

export default function InteractiveBridge() {
  return (
    <section className="py-24 bg-surface-container-lowest text-center border-y border-white/5 relative overflow-hidden">
      <div className="absolute inset-0 tech-grid-bg opacity-10 pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 50 }} 
        whileInView={{ opacity: 1, y: 0 }} 
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 1 }}
        className="max-w-4xl mx-auto px-6 relative z-10"
      >
        <div className="w-12 h-12 rounded-full border border-primary-fixed/20 mx-auto flex items-center justify-center mb-8">
          <span className="material-symbols-outlined text-primary-fixed font-light">function</span>
        </div>
        <h2 className="text-3xl font-light tracking-tight mb-6 text-white">Bridging Mathematics and Cosmos</h2>
        <p className="text-secondary leading-relaxed font-mono text-sm max-w-2xl mx-auto">
          The Srinivasa project fuses Ramanujan's profound insight into infinite series and analytical number theory with modern computational astrodynamics. Explore N-body mechanics through the lens of continuous mathematical beauty.
        </p>
      </motion.div>
    </section>
  );
}
