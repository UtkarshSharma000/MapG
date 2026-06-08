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
              textClassName="font-display-lg text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-2 block"
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

          <div className="flex justify-center items-center gap-2 text-gray-500 mb-0 group cursor-default">
            <Heart className="text-primary fill-primary animate-bounce group-hover:scale-125 transition-transform" size={24} />
            <span className="font-mono text-sm tracking-wide">Building the future of space exploration together</span>
          </div>
        </div>

        {/* Mathematics & Physics Engine Showcase with CardSwap */}
        <div className="my-16 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left min-h-[480px] relative z-10 w-full mb-12">
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-primary mb-3">CONCURRENT SOLVERS</div>
            <h3 className="font-display-lg text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 mb-4">
              The Mathematics of Propagating Gravity
            </h3>
            <p className="text-gray-600 text-xs font-light leading-relaxed mb-6">
              Our trajectory solver uses high-performance Newtonian vectors and numerical integrations. Stacked panels on the right showcase the actual mathematical equations operating under the hood of MapG.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="solid-panel p-3 border border-gray-100 bg-white/1">
                <span className="block text-[10px] font-mono text-primary uppercase tracking-wider">TIMESTEP</span>
                <span className="text-xs font-sans text-gray-900 font-medium">Adaptive dt Precision</span>
              </div>
              <div className="solid-panel p-3 border border-gray-100 bg-white/1">
                <span className="block text-[10px] font-mono text-primary uppercase tracking-wider">CONVERGENCE</span>
                <span className="text-xs font-sans text-gray-900 font-medium">Newton-Raphson 1e-12</span>
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
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">SOLVER_01 // VECTOR ACCELERATIONS</span>
                    <span className="px-1.5 py-0.5 font-mono text-[8px] border border-primary/40 text-primary uppercase rounded bg-primary/5">N-Body</span>
                  </div>
                  <h4 className="font-display-lg text-sm font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                    Newtonian Perturbations
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-light mb-3">
                    Accumulates direct gravitational fields exerted by Jovian and terrestrial masses acting upon Keplerian flight vectors.
                  </p>
                </div>
                <div className="w-full bg-gray-50 p-2 rounded-lg border border-gray-200 font-mono text-xs md:text-sm text-primary/90 text-center select-all">
                  a = -G·M/r² + ∑ [G·m_p·(r_p-r)/|r_p-r|³]
                </div>
              </Card>

              <Card className="flex flex-col justify-between select-none">
                <div className="w-full">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">SOLVER_02 // SYSTEM STATES</span>
                    <span className="px-1.5 py-0.5 font-mono text-[8px] border border-emerald-400/40 text-emerald-400 uppercase rounded bg-emerald-500/5">RK4 INTL</span>
                  </div>
                  <h4 className="font-display-lg text-sm font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                    Fourth-Order Integrator
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-light mb-3">
                    Integrates full State-Space vectors (position, velocity) with adaptive error limits and dynamical timesteps inside planet SOIs.
                  </p>
                </div>
                <div className="w-full bg-gray-50 p-2 rounded-lg border border-gray-200 font-mono text-xs md:text-sm text-emerald-400 text-center select-all">
                  s_next = s + (h/6)·(k₁ + 2k₂ + 2k₃ + k₄)
                </div>
              </Card>

              <Card className="flex flex-col justify-between select-none">
                <div className="w-full">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">SOLVER_03 // CONICS TRANSCENDENTAL</span>
                    <span className="px-1.5 py-0.5 font-mono text-[8px] border border-blue-400/40 text-blue-400 uppercase rounded bg-blue-500/5">Keplerian</span>
                  </div>
                  <h4 className="font-display-lg text-sm font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                    Kepler Equation Solver
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-light mb-3">
                    Maps Mean Anomaly (time-domain parameter) to Eccentric Anomaly using high-precision Newton-Raphson iteration.
                  </p>
                </div>
                <div className="w-full bg-gray-50 p-2 rounded-lg border border-gray-200 font-mono text-xs md:text-sm text-blue-400 text-center select-all">
                  E_next = E - (E - e·sinE - M) / (1 - e·cosE)
                </div>
              </Card>

              <Card className="flex flex-col justify-between select-none">
                <div className="w-full">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">SOLVER_04 // BOUNDARY OPTIMIZER</span>
                    <span className="px-1.5 py-0.5 font-mono text-[8px] border border-amber-400/40 text-amber-400 uppercase rounded bg-amber-500/5">Lambert</span>
                  </div>
                  <h4 className="font-display-lg text-sm font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                    Lambert Target Solver
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-light mb-3">
                    Constructs transfer trajectories between position vectors r₁ and r₂ across specific Flight Durations using bisection.
                  </p>
                </div>
                <div className="w-full bg-gray-50 p-2 rounded-lg border border-gray-200 font-mono text-xs md:text-sm text-amber-400 text-center select-all">
                  t_tof = [x³·S(z) + A·√y] / √μ
                </div>
              </Card>

              <Card className="flex flex-col justify-between select-none">
                <div className="w-full">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">SOLVER_05 // INTERCEPTION BURNS</span>
                    <span className="px-1.5 py-0.5 font-mono text-[8px] border border-purple-400/40 text-purple-400 uppercase rounded bg-purple-500/5">Delta-V</span>
                  </div>
                  <h4 className="font-display-lg text-sm font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                    Vis-Viva Velocity States
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-light mb-3">
                    Models hyperbolic arrival velocity states and computes retro-burn insertion delta-V into planetary orbit.
                  </p>
                </div>
                <div className="w-full bg-gray-50 p-2 rounded-lg border border-gray-200 font-mono text-xs md:text-sm text-purple-400 text-center select-all">
                  v² = μ · ( 2 / r - 1 / a )
                </div>
              </Card>
            </CardSwap>
          </div>
        </div>

        {/* Bento Grid CTAs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Download Local Backend Zip Card */}
          <div className="solid-panel p-8 text-left border border-gray-200 hover:border-primary/40 transition-all duration-300 group flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                  <Terminal size={22} />
                </div>
                <span className="font-mono text-[10px] text-gray-500">C++ ENGINE</span>
              </div>
              <h4 className="font-display-lg text-lg font-bold text-gray-900 mb-2">Local Compute Server</h4>
              <p className="text-gray-600 text-xs font-light leading-relaxed mb-6">
                An optimize-compiled trajectory core with custom guidance computers and porkchop scanners. Perfect for low-latency batch analysis.
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
          <div className="solid-panel p-8 text-left border border-gray-200 hover:border-emerald-500/40 transition-all duration-300 group flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <Github size={22} />
                </div>
                <span className="font-mono text-[10px] text-gray-500">GUI REPO</span>
              </div>
              <h4 className="font-display-lg text-lg font-bold text-gray-900 mb-2">UtkarshSharma000/MapG</h4>
              <p className="text-gray-600 text-xs font-light leading-relaxed mb-6">
                Fully interactive 3D solar system rendering engine, Three.js simulation views, and trajectory visualization dashboards on GitHub.
              </p>
            </div>
            <a 
              href="https://github.com/UtkarshSharma000/MapG" 
              target="_blank" 
              rel="noreferrer"
              className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-gray-900 font-mono font-bold text-xs uppercase px-6 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] pointer-events-auto"
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
        <div className="max-w-4xl mx-auto text-center relative z-10 solid-panel p-12 border border-primary/10 rounded-3xl">
          <h3 className="font-display-lg text-4xl md:text-5xl font-bold mb-4 relative z-10 tracking-tighter text-gray-900">READY FOR DEPLOYMENT?</h3>
          <p className="text-on-surface-variant font-light mb-10 max-w-xl mx-auto relative z-10 text-gray-500">Access real-time telemetry data, satellite control systems, and mission logs via the secure terminal interface.</p>
          <div className="flex flex-col md:flex-row justify-center gap-4 relative z-10">
            <button 
              onClick={() => setIsSimulatorRunning(true)}
              className="px-12 py-4 bg-primary text-black font-label-caps tracking-widest glow-primary hover:scale-105 active:scale-95 transition-all rounded font-bold cursor-pointer"
            >
              INITIALIZE CONNECTION
            </button>
            <a 
              href="https://github.com/UtkarshSharma000/MapG"
              target="_blank"
              rel="noreferrer"
              className="px-12 py-4 solid-panel border border-outline text-on-surface-variant font-label-caps tracking-widest hover:scale-105 active:scale-95 transition-all rounded font-bold cursor-pointer inline-block text-gray-900"
            >
              GITHUB REPOSITORY
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-[32px] px-8 md:px-[32px] flex flex-col md:flex-row justify-between items-center gap-[16px] bg-[#030611] backdrop-blur-md border-t border-gray-200">
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
