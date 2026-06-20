import React from "react";
import UnicornScene from "unicornstudio-react";

export default function InteractiveBridge() {
  return (
    <section className="relative w-full overflow-hidden bg-[#050505] flex flex-col items-center justify-center z-10 border-t border-b border-white/5 min-h-[50vh]">
      <div className="w-full h-full min-h-[400px] relative z-10 unicorn-container opacity-100 mix-blend-screen">
        <UnicornScene 
          projectId="cJ085ZPZApHISv410A43" 
          sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.5/dist/unicornStudio.umd.js"
          width="100%" 
          height="400px" 
        />
      </div>
      {/* Subtle indicator label */}
      <span className="font-mono text-[9px] tracking-[0.4em] uppercase text-white/20 mt-4 pointer-events-none select-none absolute bottom-4">
        UNICORN STUDIO COMPONENT
      </span>
    </section>
  );
}
