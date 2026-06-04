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
      <section ref={cinematicSectionRef} className="relative h-[250vh] bg-transparent z-10 w-full overflow-visible">
        {/* Sticky viewport content container */}
        <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden pointer-events-none">
          
          {/* Subtle tech background grids exclusively visible here */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,180,255,0.03)_0%,transparent_70%)] pointer-events-none z-10"></div>
          
          {/* Telemetry and HUD Readouts Overlay */}
          <div className="absolute inset-0 p-8 md:p-[32px] flex flex-col justify-between pointer-events-none z-10">
            {/* HUD Top bar */}
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1 border-l border-primary/40 pl-3">
                <span className="font-mono text-[9px] text-primary/60 tracking-widest uppercase">SENSOR STREAM // DEEP FIELD SPECTROSCOPY</span>
                <span className="font-display-lg text-lg text-white font-bold tracking-tight">SOLAR EXCURSION PROPAGATOR</span>
              </div>
              <div className="flex flex-col items-end gap-1 font-mono text-[9px] text-white/40">
                <div>RANGE REF // HELIOCENTRIC COHESION</div>
                <div className="text-primary font-bold">SCALE: {(1.0 + scrollProgress * 4.5).toFixed(3)}x</div>
              </div>
            </div>

            {/* HUD Bottom telemetry overlay */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 w-full">
              <div className="flex flex-col gap-2 font-mono text-[9px] text-white/30 text-left border-b border-white/5 pb-2 md:pb-0 md:border-b-0">
                <div>ACTIVE SENSOR BEAM: <span className="text-primary font-bold">ONLINE</span></div>
                <div>ORBIT RESONANCE CALIBRATION: <span className="text-emerald-400 font-bold">STABLE</span></div>
                <div>T-INJECTION VECTOR: <span className="text-blue-400 font-bold">READY</span></div>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <span className="font-mono text-[9px] text-white/40 uppercase">TRANSIT PROGRESSION</span>
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
              className="absolute left-6 md:left-12 max-w-xs md:max-w-sm glass-panel p-6 border border-primary/20 bg-[#030611]/80 rounded-xl transition-all duration-500 text-left"
              style={{ 
                opacity: scrollProgress >= 0.05 && scrollProgress <= 0.28 ? Math.min(1, (scrollProgress - 0.05) / 0.07) * Math.min(1, (0.28 - scrollProgress) / 0.07) : 0,
                transform: `translateY(${scrollProgress >= 0.05 && scrollProgress <= 0.28 ? '0px' : '20px'})`,
                visibility: scrollProgress >= 0.05 && scrollProgress <= 0.28 ? 'visible' : 'hidden'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                <span className="font-mono text-[9px] text-primary tracking-widest uppercase">STELLAR APEX // STAGE 1</span>
              </div>
              <h4 className="font-display-lg text-sm font-bold text-white uppercase tracking-wide mb-1">Stellar Nucleus Core</h4>
              <p className="text-[11px] text-white/60 leading-relaxed font-light">
                The focal origin points initiate here. High-energy solar wind calculations set Keplerian boundary rules for all inner planet transits.
              </p>
            </div>

            {/* Narrative Step 2: Inner Terrestrial Zones */}
            <div 
              className="absolute right-6 md:right-12 max-w-xs md:max-w-sm glass-panel p-6 border border-amber-500/20 bg-[#030611]/80 rounded-xl transition-all duration-500 text-left"
              style={{ 
                opacity: scrollProgress >= 0.28 && scrollProgress <= 0.52 ? Math.min(1, (scrollProgress - 0.28) / 0.07) * Math.min(1, (0.52 - scrollProgress) / 0.07) : 0,
                transform: `translateY(${scrollProgress >= 0.28 && scrollProgress <= 0.52 ? '0px' : '20px'})`,
                visibility: scrollProgress >= 0.28 && scrollProgress <= 0.52 ? 'visible' : 'hidden'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="font-mono text-[9px] text-amber-400 tracking-widest uppercase">HOT VECTOR ZONE // STAGE 2</span>
              </div>
              <h4 className="font-display-lg text-sm font-bold text-white uppercase tracking-wide mb-1">Mercury & Venus Corridor</h4>
              <p className="text-[11px] text-white/60 leading-relaxed font-light">
                Charting trajectories through high-temperature gravity wells requires extreme numeric stabilization with adaptive timesteps.
              </p>
            </div>

            {/* Narrative Step 3: Celestial Home World */}
            <div 
              className="absolute left-6 md:left-12 max-w-xs md:max-w-sm glass-panel p-6 border border-blue-500/20 bg-[#030611]/80 rounded-xl transition-all duration-500 text-left"
              style={{ 
                opacity: scrollProgress >= 0.52 && scrollProgress <= 0.76 ? Math.min(1, (scrollProgress - 0.52) / 0.07) * Math.min(1, (0.76 - scrollProgress) / 0.07) : 0,
                transform: `translateY(${scrollProgress >= 0.52 && scrollProgress <= 0.76 ? '0px' : '20px'})`,
                visibility: scrollProgress >= 0.52 && scrollProgress <= 0.76 ? 'visible' : 'hidden'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                <span className="font-mono text-[9px] text-blue-400 tracking-widest uppercase">BARCENTRICAL LAB // STAGE 3</span>
              </div>
              <h4 className="font-display-lg text-sm font-bold text-white uppercase tracking-wide mb-1">Earth-Moon Resonance</h4>
              <p className="text-[11px] text-white/60 leading-relaxed font-light">
                The gravitational midpoint of Earth acts as the perfect springboard, leveraging lunar orbital speeds to accelerate outer missions.
              </p>
            </div>

            {/* Narrative Step 4: Deeper Frontiers */}
            <div 
              className="absolute right-6 md:right-12 max-w-xs md:max-w-sm glass-panel p-6 border border-purple-500/20 bg-[#030611]/80 rounded-xl transition-all duration-500 text-left"
              style={{ 
                opacity: scrollProgress >= 0.76 ? Math.min(1, (scrollProgress - 0.76) / 0.07) : 0,
                transform: `translateY(${scrollProgress >= 0.76 ? '0px' : '20px'})`,
                visibility: scrollProgress >= 0.76 ? 'visible' : 'hidden'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                <span className="font-mono text-[9px] text-purple-400 tracking-widest uppercase">JOVIAN BOUNDARIES // STAGE 4</span>
              </div>
              <h4 className="font-display-lg text-sm font-bold text-white uppercase tracking-wide mb-1">To Mars & Jupiter</h4>
              <p className="text-[11px] text-white/60 leading-relaxed font-light">
                As we zoom out to the widest helical patterns, the full N-Body physics of Jovian systems dominates global path calculations.
              </p>
            </div>

          </div>
          
        </div>
      </section>

      {/* Open Source Section */}
      <section className="px-8 md:px-[32px] py-48 relative bg-transparent overflow-hidden min-h-[140vh] flex flex-col justify-center">
        {/* React Bits Waves Component */}
        <Waves
          lineColor="rgba(255, 255, 255, 0.1)"
          backgroundColor="transparent"
          waveSpeedX={0.02}
          waveSpeedY={0.01}
          waveAmpX={40}
          waveAmpY={20}
          friction={0.9}
          tension={0.01}
          maxCursorMove={120}
          xGap={12}
          yGap={36}
        />

        {/* Subtle glow behind the heart */}
        <div className="absolute top-[35%] left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-white/5 rounded-full blur-[80px] pointer-events-none"></div>

        {/* Scroll Spacer to drag out scrolling duration */}
        <div className="h-[15vh] w-full pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10 flex-grow flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-8 self-center">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]"></span>
            <span className="font-mono text-[9px] text-primary tracking-widest uppercase">MAP G CORE PROJECT</span>
          </div>
          
          <div className="mb-8">
            <ScrollFloat
              animationDuration={3}
              ease="back.out(1.5)"
              scrollStart="top bottom-=5%"
              scrollEnd="bottom center+=10%"
              stagger={0.05}
              scrub={4}
              scrollContainerRef={landingScrollRef}
              textClassName="font-display-lg text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-2"
            >
              MAP G is
            </ScrollFloat>
            <ScrollFloat
              animationDuration={3.5}
              ease="back.out(1.5)"
              scrollStart="top bottom-=15%"
              scrollEnd="bottom center-=5%"
              stagger={0.05}
              scrub={4}
              scrollContainerRef={landingScrollRef}
              textClassName="font-display-lg text-primary glow-primary text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
            >
              Completely Open Source!
            </ScrollFloat>
          </div>
        </div>
      </section>
    </>
  );
}
