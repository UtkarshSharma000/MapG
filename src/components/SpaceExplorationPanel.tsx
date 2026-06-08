import React from "react";
import Waves from "./Waves";
import ScrollFloat from "./ScrollFloat";

interface SpaceExplorationPanelProps {
  cinematicSectionRef: React.RefObject<HTMLDivElement | null>;
  scrollProgressRef: React.MutableRefObject<number>;
  landingScrollRef: React.RefObject<HTMLDivElement | null>;
}

export default function SpaceExplorationPanel({
  cinematicSectionRef,
  scrollProgressRef,
  landingScrollRef,
}: SpaceExplorationPanelProps) {
  const panelRef = React.useRef<HTMLElement>(null);
  const scaleTextRef = React.useRef<HTMLDivElement>(null);
  const progressBarRef = React.useRef<HTMLDivElement>(null);
  
  const box1Ref = React.useRef<HTMLDivElement>(null);
  const box2Ref = React.useRef<HTMLDivElement>(null);
  const box3Ref = React.useRef<HTMLDivElement>(null);
  const box4Ref = React.useRef<HTMLDivElement>(null);
  const bgPath1Ref = React.useRef<SVGPathElement>(null);
  const bgPath2Ref = React.useRef<SVGPathElement>(null);
  const hudGlowRef = React.useRef<HTMLDivElement>(null);
  const hudStatusRef = React.useRef<HTMLSpanElement>(null);
  const hudRouteRef = React.useRef<HTMLSpanElement>(null);
  const hudPathRef = React.useRef<HTMLSpanElement>(null);
  const maxTextRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    let frame: number;
    let oldPhase = 0;
    const update = () => {
      const scrollProgress = scrollProgressRef.current;
      
      if (scaleTextRef.current) {
        scaleTextRef.current.textContent = `SCALE: ${(1.0 + scrollProgress * 4.5).toFixed(3)}x`;
      }
      
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${scrollProgress * 100}%`;
      }

      if (bgPath1Ref.current) bgPath1Ref.current.style.strokeDashoffset = String(120 - scrollProgress * 120);
      if (bgPath2Ref.current) bgPath2Ref.current.style.strokeDashoffset = String(110 - scrollProgress * 110);

      // Phase colors logic
      let phase = 0; // 0 = blue/green, 1 = orange, 2 = red
      if (scrollProgress > 0.35 && scrollProgress <= 0.75) phase = 1;
      else if (scrollProgress > 0.75) phase = 2;

      if (phase !== oldPhase) {
        // Glitch effect on transition
        if (hudStatusRef.current) {
          hudStatusRef.current.style.animation = 'none';
          void hudStatusRef.current.offsetWidth; // trigger reflow
          hudStatusRef.current.style.animation = 'pulse 0.2s 3';
        }
        
        if (hudStatusRef.current && hudRouteRef.current && hudPathRef.current) {
          if (phase === 0) {
            hudStatusRef.current.className = "text-white font-bold transition-colors";
            hudStatusRef.current.textContent = "ONLINE";
            hudRouteRef.current.className = "text-white font-bold transition-colors";
            hudPathRef.current.className = "text-white font-bold transition-colors";
            if (progressBarRef.current) progressBarRef.current.className = "bg-white h-full transition-all duration-75 relative";
          } else if (phase === 1) {
            hudStatusRef.current.className = "text-white font-bold transition-colors";
            hudStatusRef.current.textContent = "TRANSFER";
            hudRouteRef.current.className = "text-white font-bold transition-colors";
            hudPathRef.current.className = "text-white font-bold animate-pulse transition-colors";
            if (progressBarRef.current) progressBarRef.current.className = "bg-white h-full transition-all duration-75 relative";
          } else {
            hudStatusRef.current.className = "text-white font-bold animate-pulse transition-colors";
            hudStatusRef.current.textContent = "ALIGNMENT";
            hudRouteRef.current.className = "text-white font-bold transition-colors";
            hudPathRef.current.className = "text-white font-bold animate-pulse transition-colors";
            if (progressBarRef.current) progressBarRef.current.className = "bg-white h-full transition-all duration-75 relative";
          }
        }

        oldPhase = phase;
      }

      if (maxTextRef.current) {
         maxTextRef.current.style.transform = `translateX(${ -scrollProgress * 50 }%)`;
      }

      const applyBoxStyle = (ref: React.RefObject<HTMLDivElement | null>, opacity: number, transform: string, visibility: string) => {
        if (ref.current) {
          ref.current.style.opacity = String(opacity);
          ref.current.style.transform = transform;
          ref.current.style.visibility = visibility;
        }
      };

      // Box 1
      applyBoxStyle(
        box1Ref,
        scrollProgress < 0.05 ? 0 : scrollProgress < 0.09 ? (scrollProgress - 0.05) / 0.04 : scrollProgress < 0.28 ? 1 : Math.max(0, 1 - (scrollProgress - 0.28) / 0.04),
        `translateY(${scrollProgress >= 0.05 && scrollProgress <= 0.30 ? '0px' : '20px'})`,
        scrollProgress >= 0.05 && scrollProgress <= 0.32 ? 'visible' : 'hidden'
      );

      // Box 2
      applyBoxStyle(
        box2Ref,
        scrollProgress < 0.25 ? 0 : scrollProgress < 0.29 ? (scrollProgress - 0.25) / 0.04 : scrollProgress < 0.53 ? 1 : Math.max(0, 1 - (scrollProgress - 0.53) / 0.04),
        `translateY(${scrollProgress >= 0.25 && scrollProgress <= 0.57 ? '0px' : '20px'})`,
        scrollProgress >= 0.25 && scrollProgress <= 0.57 ? 'visible' : 'hidden'
      );

      // Box 3
      applyBoxStyle(
        box3Ref,
        scrollProgress < 0.50 ? 0 : scrollProgress < 0.54 ? (scrollProgress - 0.50) / 0.04 : scrollProgress < 0.78 ? 1 : Math.max(0, 1 - (scrollProgress - 0.78) / 0.04),
        `translateY(${scrollProgress >= 0.50 && scrollProgress <= 0.82 ? '0px' : '20px'})`,
        scrollProgress >= 0.50 && scrollProgress <= 0.82 ? 'visible' : 'hidden'
      );

      // Box 4
      applyBoxStyle(
        box4Ref,
        scrollProgress < 0.75 ? 0 : scrollProgress < 0.79 ? (scrollProgress - 0.75) / 0.04 : 1,
        `translateY(${scrollProgress >= 0.75 ? '0px' : '20px'})`,
        scrollProgress >= 0.75 ? 'visible' : 'hidden'
      );

      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [scrollProgressRef]);
  return (
    <>
      {/* Cinematic Interactive Space Exploration Panel */}
      <section ref={cinematicSectionRef} className="relative h-[800vh] bg-transparent z-10 w-full overflow-visible">
        {/* Invisible snapping anchors */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-[0vh] h-screen w-full snap-start" />
          <div className="absolute top-[200vh] h-screen w-full snap-start" />
          <div className="absolute top-[400vh] h-screen w-full snap-start" />
          <div className="absolute top-[600vh] h-screen w-full snap-start" />
          <div className="absolute top-[800vh] h-screen w-full snap-start" />
        </div>

        {/* Sticky viewport content container */}
        <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden pointer-events-none">
          
          {/* Maximalist Background Typography */}
          <div className="absolute inset-0 flex items-center justify-center opacity-75 mix-blend-overlay z-0 pointer-events-none overflow-hidden">
            <h1 
              ref={maxTextRef}
              className="text-[25vw] sm:text-[30vw] font-headline-md italic font-black leading-none whitespace-nowrap text-white select-none"
              style={{ transform: 'translateX(0%)', textShadow: '0 0 40px rgba(255,255,255,0.1)', willChange: 'transform' }}
            >
              SOLAR &nbsp;&nbsp;&nbsp;&nbsp; ORBITAL &nbsp;&nbsp;&nbsp;&nbsp; INTERCEPT &nbsp;&nbsp;&nbsp;&nbsp; SOLAR &nbsp;&nbsp;&nbsp;&nbsp; ORBITAL &nbsp;&nbsp;&nbsp;&nbsp; INTERCEPT &nbsp;&nbsp;&nbsp;&nbsp; SOLAR
            </h1>
          </div>
          
          {/* Subtle tech background grids exclusively visible here */}
          <div ref={hudGlowRef} className="absolute inset-0 z-10 transition-colors duration-1000"></div>
          
          {/* Graphical Telemetry Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-50 stroke-primary/30" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Draw-in paths */}
            <path ref={bgPath1Ref} d="M -5,50 Q 30,30 50,50 T 105,50" fill="none" strokeWidth="0.1" strokeDasharray="120" strokeDashoffset="120" />
            <path ref={bgPath2Ref} d="M 50,105 L 50,-5" fill="none" strokeWidth="0.05" strokeDasharray="110" strokeDashoffset="110" />
          </svg>

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
                <div ref={scaleTextRef} className="text-primary font-bold">SCALE: 1.000x</div>
              </div>
            </div>

            {/* HUD Bottom telemetry overlay */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 w-full">
              <div className="flex flex-col gap-2 font-mono text-[9px] text-white/30 text-left border-b border-white/5 pb-2 md:pb-0 md:border-b-0">
                <div>SYSTEM STATUS: <span ref={hudStatusRef} className="text-primary font-bold transition-colors">ONLINE</span></div>
                <div>ROUTE CHECK: <span ref={hudRouteRef} className="text-emerald-400 font-bold transition-colors">STABLE</span></div>
                <div>FLIGHT PATH: <span ref={hudPathRef} className="text-blue-400 font-bold transition-colors">READY</span></div>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <span className="font-mono text-[9px] text-white/40 uppercase">FLIGHT PROGRESS</span>
                <div className="w-48 bg-white/5 h-1 border border-white/10 rounded-full overflow-hidden">
                  <div 
                    ref={progressBarRef}
                    className="bg-primary h-full transition-all duration-75 relative" 
                    style={{ width: `0%` }}
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
              ref={box1Ref}
              className="absolute left-6 md:left-24 max-w-xs md:max-w-sm bg-black border border-white/20 p-8 transition-all duration-500 text-left opacity-0 invisible"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 bg-white"></span>
                <span className="font-mono text-[10px] text-white tracking-[0.2em] uppercase">RAMANUJAN // INITIAL INTUITION</span>
              </div>
              <h4 className="font-headline-md italic text-3xl text-white mb-2 leading-tight">Symmetry</h4>
              <p className="font-body-rg text-sm text-white/70 leading-relaxed uppercase tracking-wider">
                Srinivasa Ramanujan possessed an extraordinary raw intuition, seeing exquisite symmetries and periodic equations where others saw only chaos.
              </p>
            </div>

            {/* Narrative Step 2: Inner Terrestrial Zones */}
            <div 
              ref={box2Ref}
              className="absolute right-6 md:right-24 max-w-xs md:max-w-sm bg-black border border-white/20 p-8 transition-all duration-500 text-left opacity-0 invisible"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 bg-white"></span>
                <span className="font-mono text-[10px] text-white tracking-[0.2em] uppercase">THE INFINITE CANVAS // PATHWAYS</span>
              </div>
              <h4 className="font-headline-md italic text-3xl text-white mb-2 leading-tight">Infinite Series</h4>
              <p className="font-body-rg text-sm text-white/70 leading-relaxed uppercase tracking-wider">
                His modular equations and infinite series opened a rare window into new mathematical realms, mapping pathways of elegant structure across the infinite.
              </p>
            </div>

            {/* Narrative Step 3: Celestial Home World */}
            <div 
              ref={box3Ref}
              className="absolute left-6 md:left-24 max-w-xs md:max-w-sm bg-black border border-white/20 p-8 transition-all duration-500 text-left opacity-0 invisible"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 bg-white"></span>
                <span className="font-mono text-[10px] text-white tracking-[0.2em] uppercase">CELESTIAL HARMONY // THE MATRIX</span>
              </div>
              <h4 className="font-headline-md italic text-3xl text-white mb-2 leading-tight">Periodic Orbits</h4>
              <p className="font-body-rg text-sm text-white/70 leading-relaxed uppercase tracking-wider">
                Just as Ramanujan charted silent terrains of pure mathematics, this orbital system tracks the intricate, periodic orbits of planets across the cosmos.
              </p>
            </div>

            {/* Narrative Step 4: Deeper Frontiers */}
            <div 
              ref={box4Ref}
              className="absolute right-6 md:right-24 max-w-xs md:max-w-sm bg-black border border-white/20 p-8 transition-all duration-500 text-left opacity-0 invisible"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 bg-white"></span>
                <span className="font-mono text-[10px] text-white tracking-[0.2em] uppercase">THE HIGHER ORDER // FINAL TRUTH</span>
              </div>
              <h4 className="font-headline-md italic text-3xl text-white mb-2 leading-tight">Infinite Vision</h4>
              <p className="font-body-rg text-sm text-white/70 leading-relaxed uppercase tracking-wider mb-4">
                In the ultimate elegance of gravity and orbit, Ramanujan's legacy reminds us that equations are a medium of absolute cosmic truth.
              </p>
              <blockquote className="border-l-2 border-primary/50 pl-4 py-1 italic font-sans text-xs text-primary bg-primary/5 rounded-r">
                "An equation for me has no meaning, unless it expresses a thought of God."
                <cite className="block text-[10px] not-italic text-white/50 mt-1 font-mono uppercase tracking-widest">— Srinivasa Ramanujan</cite>
              </blockquote>
            </div>

          </div>
          
        </div>
      </section>

    </>
  );
}
