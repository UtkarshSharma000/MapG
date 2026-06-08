import React from "react";
import Waves from "./Waves";
import ScrollFloat from "./ScrollFloat";

interface SpaceExplorationPanelProps {
  cinematicSectionRef: React.RefObject<HTMLDivElement | null>;
  scrollProgress: number;
  landingScrollRef: React.RefObject<HTMLDivElement | null>;
}

export default function SpaceExplorationPanel({
  cinematicSectionRef,
  scrollProgress,
  landingScrollRef,
}: SpaceExplorationPanelProps) {
  return (
    <>
      {/* Cinematic Interactive Space Exploration Panel */}
      <section ref={cinematicSectionRef} className="relative h-[400vh] bg-transparent z-10 w-full overflow-visible">
        {/* Invisible snapping anchors */}
        <div className="absolute top-0 left-0 w-full h-[400vh] pointer-events-none flex flex-col">
          <div className="h-[100vh] w-full snap-start" />
          <div className="h-[100vh] w-full snap-start" />
          <div className="h-[100vh] w-full snap-start" />
          <div className="h-[100vh] w-full snap-start" />
        </div>

        {/* Sticky viewport content container */}
        <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden pointer-events-none">
          
          {/* Subtle tech background grids exclusively visible here */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,180,255,0.03)_0%,transparent_70%)] pointer-events-none z-10"></div>
          
          {/* Telemetry and HUD Readouts Overlay */}
          <div className="absolute inset-0 p-8 md:p-[32px] flex flex-col justify-between pointer-events-none z-10">
            {/* HUD Top bar */}
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1 border-l border-primary/40 pl-3">
                <span className="font-mono text-[9px] text-primary/60 tracking-widest uppercase">DATA STREAM // SPACE SCANNER</span>
                <span className="font-display-lg text-lg text-white font-bold tracking-tight">SOLAR FLIGHT TRACKER</span>
              </div>
              <div className="flex flex-col items-end gap-1 font-mono text-[9px] text-white/40">
                <div>ZOOM LEVEL</div>
                <div className="text-primary font-bold">SCALE: {(1.0 + scrollProgress * 4.5).toFixed(3)}x</div>
              </div>
            </div>

            {/* HUD Bottom telemetry overlay */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 w-full">
              <div className="flex flex-col gap-2 font-mono text-[9px] text-white/30 text-left border-b border-white/5 pb-2 md:pb-0 md:border-b-0">
                <div>SYSTEM STATUS: <span className="text-primary font-bold">ONLINE</span></div>
                <div>ROUTE CHECK: <span className="text-emerald-400 font-bold">STABLE</span></div>
                <div>FLIGHT PATH: <span className="text-blue-400 font-bold">READY</span></div>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <span className="font-mono text-[9px] text-white/40 uppercase">FLIGHT PROGRESS</span>
                <div className="w-48 bg-white/5 h-1 border border-white/10 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-75 relative" 
                    style={{ width: `${scrollProgress * 100}%` }}
                  >
                    <span className="absolute right-0 top-0 w-1.5 h-1.5 bg-white glow-primary rounded-full"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Aesthetic Narrative Boxes driven by local scroll progress */}
          <div className="absolute inset-0 w-full h-full max-w-6xl mx-auto px-6 relative flex flex-col justify-center pointer-events-none z-20">
            
            {/* Narrative Step 1: Core Star System Nucleus */}
            <div 
              className="absolute left-6 md:left-12 max-w-xs md:max-w-sm bg-gray-900 border border-gray-700 p-6 rounded-xl transition-all duration-500 text-left"
              style={{ 
                opacity: Math.max(0, 1 - Math.abs(scrollProgress - 0) / 0.15),
                transform: `translateY(${Math.abs(scrollProgress - 0) < 0.15 ? '0px' : '20px'})`,
                visibility: Math.abs(scrollProgress - 0) < 0.15 ? 'visible' : 'hidden'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                <span className="font-mono text-[9px] text-primary tracking-widest uppercase">SUN // STAGE 1</span>
              </div>
              <h4 className="font-display-lg text-sm font-bold text-white uppercase tracking-wide mb-1">The Center of the Solar System</h4>
              <p className="text-[11px] text-white/60 leading-relaxed font-light">
                The sun is the starting point. Its strong gravity pulls everything and sets the rules for how planets move.
              </p>
            </div>

            {/* Narrative Step 2: Inner Terrestrial Zones */}
            <div 
              className="absolute right-6 md:right-12 max-w-xs md:max-w-sm bg-gray-900 border border-gray-700 p-6 rounded-xl transition-all duration-500 text-left"
              style={{ 
                opacity: Math.max(0, 1 - Math.abs(scrollProgress - 0.333) / 0.15),
                transform: `translateY(${Math.abs(scrollProgress - 0.333) < 0.15 ? '0px' : '20px'})`,
                visibility: Math.abs(scrollProgress - 0.333) < 0.15 ? 'visible' : 'hidden'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="font-mono text-[9px] text-amber-400 tracking-widest uppercase">HOT PLANETS // STAGE 2</span>
              </div>
              <h4 className="font-display-lg text-sm font-bold text-white uppercase tracking-wide mb-1">Mercury & Venus</h4>
              <p className="text-[11px] text-white/60 leading-relaxed font-light">
                Plotting paths near the sun is hard because the gravity is very strong, requiring careful math.
              </p>
            </div>

            {/* Narrative Step 3: Celestial Home World */}
            <div 
              className="absolute left-6 md:left-12 max-w-xs md:max-w-sm bg-gray-900 border border-gray-700 p-6 rounded-xl transition-all duration-500 text-left"
              style={{ 
                opacity: Math.max(0, 1 - Math.abs(scrollProgress - 0.666) / 0.15),
                transform: `translateY(${Math.abs(scrollProgress - 0.666) < 0.15 ? '0px' : '20px'})`,
                visibility: Math.abs(scrollProgress - 0.666) < 0.15 ? 'visible' : 'hidden'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                <span className="font-mono text-[9px] text-blue-400 tracking-widest uppercase">EARTH BASE // STAGE 3</span>
              </div>
              <h4 className="font-display-lg text-sm font-bold text-white uppercase tracking-wide mb-1">Earth and Moon</h4>
              <p className="text-[11px] text-white/60 leading-relaxed font-light">
                The Earth and moon make a great starting block, using their movement to help push spacecraft into deep space.
              </p>
            </div>

            {/* Narrative Step 4: Deeper Frontiers */}
            <div 
              className="absolute right-6 md:right-12 max-w-xs md:max-w-sm bg-gray-900 border border-gray-700 p-6 rounded-xl transition-all duration-500 text-left"
              style={{ 
                opacity: Math.max(0, 1 - Math.abs(scrollProgress - 1) / 0.15),
                transform: `translateY(${Math.abs(scrollProgress - 1) < 0.15 ? '0px' : '20px'})`,
                visibility: Math.abs(scrollProgress - 1) < 0.15 ? 'visible' : 'hidden'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                <span className="font-mono text-[9px] text-purple-400 tracking-widest uppercase">GIANT PLANETS // STAGE 4</span>
              </div>
              <h4 className="font-display-lg text-sm font-bold text-white uppercase tracking-wide mb-1">To Mars & Jupiter</h4>
              <p className="text-[11px] text-white/60 leading-relaxed font-light">
                As we look further out, the heavy gravity of big planets like Jupiter changes how paths are calculated.
              </p>
            </div>

          </div>
          
        </div>
      </section>

    </>
  );
}
