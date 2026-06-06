import React from "react";
import { Heart, Terminal, Download, Github } from "lucide-react";
import CardSwap, { Card } from "./CardSwap";
import Waves from "./Waves";
import ScrollFloat from "./ScrollFloat";

interface MathPhysicsShowcaseProps {
  setIsSimulatorRunning: (running: boolean) => void;
  landingScrollRef: React.RefObject<HTMLDivElement | null>;
}

export default function MathPhysicsShowcase({
  setIsSimulatorRunning,
  landingScrollRef,
}: MathPhysicsShowcaseProps) {
  return (
    <>
      <section className="px-8 md:px-[32px] py-16 md:py-24 relative bg-transparent overflow-hidden min-h-[120vh] flex flex-col justify-center w-full">
        {/* Shared Interactive Waves Component for the Entire Combined Block */}
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

        {/* Shared Space Glow */}
        <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#00f0ff]/5 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Unified Open Source Heading Content */}
        <div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col justify-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-6 self-center">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]"></span>
            <span className="font-mono text-[9px] text-primary tracking-widest uppercase">MAP G CORE PROJECT</span>
          </div>
          
          <div className="mb-6">
            <ScrollFloat
              animationDuration={3}
              ease="back.out(1.5)"
              scrollStart="top bottom-=5%"
              scrollEnd="bottom center+=10%"
              stagger={0.05}
              scrub={4}
              scrollContainerRef={landingScrollRef}
              textClassName="font-display-lg text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-2 block"
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
              textClassName="font-display-lg text-primary glow-primary text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight block"
            >
              Completely Open Source!
            </ScrollFloat>
          </div>

          <div className="flex justify-center items-center gap-2 text-white/50 mb-0 group cursor-default">
            <Heart className="text-primary fill-primary animate-bounce group-hover:scale-125 transition-transform" size={24} />
            <span className="font-mono text-sm tracking-wide">Learning how planets orbit around the Sun</span>
          </div>
        </div>

        {/* Mathematics & Physics Engine Showcase with CardSwap */}
        <div className="my-16 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left min-h-[480px] relative z-10 w-full mb-12">
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-primary mb-3">CONCURRENT SOLVERS</div>
            <h3 className="font-display-lg text-2xl lg:text-3xl font-bold tracking-tight text-white mb-4">
              How Gravity and Orbits Work
            </h3>
            <p className="text-white/60 text-xs font-light leading-relaxed mb-6">
              We use simple math formulas to calculate how planets pull on each other and how paths between planets are drawn. Click the cards on the right to see the math formulas we use.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-panel p-3 border border-white/5 bg-white/1">
                <span className="block text-[10px] font-mono text-primary uppercase tracking-wider">TIME STEP</span>
                <span className="text-xs font-sans text-white font-medium">Smooth calculations</span>
              </div>
              <div className="glass-panel p-3 border border-white/5 bg-white/1">
                <span className="block text-[10px] font-mono text-primary uppercase tracking-wider">PRECISION</span>
                <span className="text-xs font-sans text-white font-medium">High accuracy</span>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-7 flex justify-center items-center h-[460px] relative overflow-visible mt-8 lg:mt-0">
            <CardSwap
              width={480}
              height={320}
              cardDistance={32}
              verticalDistance={32}
              delay={4500}
              pauseOnHover={true}
              skewAmount={4}
              easing="elastic"
            >
              <Card className="flex flex-col justify-between select-none">
                <div className="w-full">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">SOLVER_01 // GRAVITY FORCE</span>
                    <span className="px-1.5 py-0.5 font-mono text-[8px] border border-primary/40 text-primary uppercase rounded bg-primary/5">Gravity</span>
                  </div>
                  <h4 className="font-display-lg text-sm font-semibold text-white mb-2 uppercase tracking-wide">
                    Force of Gravity
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed font-light mb-3">
                    Calculates the gravitational pull between the sun and different planets to place them correctly in 3D space.
                  </p>
                </div>
                <div className="w-full bg-white/5 p-2 rounded-lg border border-white/10 font-mono text-xs md:text-sm text-primary/90 text-center select-all">
                  a = -G·M/r² + ∑ [G·m_p·(r_p-r)/|r_p-r|³]
                </div>
              </Card>

              <Card className="flex flex-col justify-between select-none">
                <div className="w-full">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">SOLVER_02 // PATH STEPPER</span>
                    <span className="px-1.5 py-0.5 font-mono text-[8px] border border-emerald-400/40 text-emerald-400 uppercase rounded bg-emerald-500/5">RK4 STEP</span>
                  </div>
                  <h4 className="font-display-lg text-sm font-semibold text-white mb-2 uppercase tracking-wide">
                    Path Predictor (RK4)
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed font-light mb-3">
                    Calculates how a rocket or a probe moves through space step-by-step using speed and direction over time.
                  </p>
                </div>
                <div className="w-full bg-white/5 p-2 rounded-lg border border-white/10 font-mono text-xs md:text-sm text-emerald-400 text-center select-all">
                  s_next = s + (h/6)·(k₁ + 2k₂ + 2k₃ + k₄)
                </div>
              </Card>

              <Card className="flex flex-col justify-between select-none">
                <div className="w-full">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">SOLVER_03 // ORBITS</span>
                    <span className="px-1.5 py-0.5 font-mono text-[8px] border border-blue-400/40 text-blue-400 uppercase rounded bg-blue-500/5">Kepler</span>
                  </div>
                  <h4 className="font-display-lg text-sm font-semibold text-white mb-2 uppercase tracking-wide">
                    Planet Orbit Calculator
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed font-light mb-3">
                    Finds exactly where a planet is along its oval-shaped path around the Sun at any given date.
                  </p>
                </div>
                <div className="w-full bg-white/5 p-2 rounded-lg border border-white/10 font-mono text-xs md:text-sm text-blue-400 text-center select-all">
                  E_next = E - (E - e·sinE - M) / (1 - e·cosE)
                </div>
              </Card>

              <Card className="flex flex-col justify-between select-none">
                <div className="w-full">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">SOLVER_04 // ROUTE PLANNER</span>
                    <span className="px-1.5 py-0.5 font-mono text-[8px] border border-amber-400/40 text-amber-400 uppercase rounded bg-amber-500/5">Lambert</span>
                  </div>
                  <h4 className="font-display-lg text-sm font-semibold text-white mb-2 uppercase tracking-wide">
                    Flight Path Planner
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed font-light mb-3">
                    Calculates the most efficient speed and path needed to fly from Earth to Mars.
                  </p>
                </div>
                <div className="w-full bg-white/5 p-2 rounded-lg border border-white/10 font-mono text-xs md:text-sm text-amber-400 text-center select-all">
                  t_tof = [x³·S(z) + A·√y] / √μ
                </div>
              </Card>

              <Card className="flex flex-col justify-between select-none">
                <div className="w-full">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">SOLVER_05 // SPEED STATES</span>
                    <span className="px-1.5 py-0.5 font-mono text-[8px] border border-purple-400/40 text-purple-400 uppercase rounded bg-purple-500/5">Speed</span>
                  </div>
                  <h4 className="font-display-lg text-sm font-semibold text-white mb-2 uppercase tracking-wide">
                    Speed at Any Point
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed font-light mb-3">
                    Calculates how fast a spacecraft is moving based on its distance from the sun or planet.
                  </p>
                </div>
                <div className="w-full bg-white/5 p-2 rounded-lg border border-white/10 font-mono text-xs md:text-sm text-purple-400 text-center select-all">
                  v² = μ · ( 2 / r - 1 / a )
                </div>
              </Card>
            </CardSwap>
          </div>
        </div>

        {/* Bento Grid CTAs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Download Local Backend Zip Card */}
          <div className="glass-panel p-8 text-left border border-white/10 hover:border-primary/40 transition-all duration-300 group flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                  <Terminal size={22} />
                </div>
                <span className="font-mono text-[10px] text-white/40">C++ ENGINE</span>
              </div>
              <h4 className="font-display-lg text-lg font-bold text-white mb-2">C++ Backend Engine</h4>
              <p className="text-white/60 text-xs font-light leading-relaxed mb-6">
                A fast C++ engine that handles all the heavy orbital math for the simulation.
              </p>
            </div>
            <a 
              href="/greninja_engine.zip" 
              download="greninja_engine.zip"
              className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-black font-mono font-bold text-xs uppercase px-6 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all hover:shadow-[0_0_15px_rgba(170,221,255,0.4)] pointer-events-auto"
            >
              <Download size={14} className="stroke-[3]" />
              <span>Download for Windows</span>
            </a>
          </div>

          {/* GitHub Repository Card */}
          <div className="glass-panel p-8 text-left border border-white/10 hover:border-emerald-500/40 transition-all duration-300 group flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <Github size={22} />
                </div>
                <span className="font-mono text-[10px] text-white/40">GUI REPO</span>
              </div>
              <h4 className="font-display-lg text-lg font-bold text-white mb-2">UtkarshSharma000/MapG</h4>
              <p className="text-white/60 text-xs font-light leading-relaxed mb-6">
                Interactive 3D solar system simulation using WebGL, Three.js, and orbit planning UI on GitHub.
              </p>
            </div>
            <a 
              href="https://github.com/UtkarshSharma000/MapG" 
              target="_blank" 
              rel="noreferrer"
              className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-mono font-bold text-xs uppercase px-6 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] pointer-events-auto"
            >
              <Github size={14} className="stroke-[3]" />
              <span>Access GitHub Repo</span>
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-8 md:px-[32px] py-24 relative overflow-hidden bg-[#030611] w-full">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-primary/5 rounded-full pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-primary/10 rounded-full pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-primary/20 rounded-full pointer-events-none"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10 glass-panel p-12 border border-primary/10 rounded-3xl">
          <h3 className="font-display-lg text-4xl md:text-5xl font-bold mb-4 relative z-10 tracking-tighter text-white">READY TO EXPLORE THE SYSTEM?</h3>
          <p className="text-on-surface-variant font-light mb-10 max-w-xl mx-auto relative z-10 text-white/50">See the planets in real-time, simulate cosmic paths, and plan rocket launches with our interactive physics simulator.</p>
          <div className="flex flex-col md:flex-row justify-center gap-4 relative z-10">
            <button 
              onClick={() => setIsSimulatorRunning(true)}
              className="px-12 py-4 bg-primary text-black font-label-caps tracking-widest glow-primary hover:scale-105 active:scale-95 transition-all rounded font-bold cursor-pointer"
            >
              OPEN SIMULATOR
            </button>
            <a 
              href="https://github.com/UtkarshSharma000/MapG"
              target="_blank"
              rel="noreferrer"
              className="px-12 py-4 glass-panel border border-outline text-on-surface-variant font-label-caps tracking-widest hover:scale-105 active:scale-95 transition-all rounded font-bold cursor-pointer inline-block text-white"
            >
              GITHUB REPOSITORY
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-[32px] px-8 md:px-[32px] flex flex-col md:flex-row justify-between items-center gap-[16px] bg-[#030611] backdrop-blur-md border-t border-white/10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>target</span>
          <span className="font-display-lg text-lg text-primary tracking-tighter font-bold">MAP G</span>
        </div>
        <div className="flex gap-8">
          <a className="font-label-caps text-[10px] text-on-surface-variant hover:text-primary transition-all hover:translate-x-1 duration-200 uppercase tracking-widest" href="https://github.com/UtkarshSharma000/MapG" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div className="text-right">
          <p className="font-label-caps text-[10px] text-tertiary tracking-widest">© 2026 MAP G. ALL SYSTEMS OPERATIONAL.</p>
        </div>
      </footer>
    </>
  );
}
