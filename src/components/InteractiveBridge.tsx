import React from "react";
import TextPressure from "./TextPressure";

export default function InteractiveBridge() {
  return (
    <section className="relative w-full overflow-hidden bg-white py-16 flex flex-col items-center justify-center z-10 border-t border-b border-gray-200">
      {/* Soft decorative space glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,165,0,0.05),transparent_70%)] pointer-events-none"></div>
      
      <div className="w-full max-w-6xl px-6 relative z-10 select-none h-[140px] md:h-[200px] lg:h-[260px] flex items-center justify-center">
        <TextPressure
          text="GRENINJA"
          textColor="#F97316"
          strokeColor="rgba(249, 115, 22, 0.45)"
          stroke={true}
          minFontSize={45}
          scrollDriven={false}
          alpha={false}
        />
      </div>
      {/* Subtle indicator label */}
      <span className="font-mono text-[9px] tracking-[0.4em] uppercase text-gray-300 mt-4 pointer-events-none select-none">
        MOUSE INTERACTIVE PRESSURE ENGINE
      </span>
    </section>
  );
}
