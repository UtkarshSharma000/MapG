import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Github, RefreshCw, Orbit, Shield, Sparkles } from "lucide-react";

interface UnimpressedBlackholeProps {
  setIsSimulatorRunning: (run: boolean) => void;
}

export default function UnimpressedBlackhole({ setIsSimulatorRunning }: UnimpressedBlackholeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [scrollProgress, setScrollProgress] = useState(0); // 0 to 1
  const [isShaking, setIsShaking] = useState(false);
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  
  // Track scroll position within this component
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const elementHeight = rect.height;
      const windowHeight = window.innerHeight;
      
      // Calculate how much of our component has scrolled through the viewport
      const scrolled = -rect.top;
      const maxScroll = elementHeight - windowHeight;
      
      if (maxScroll <= 0) return;
      
      const progress = Math.max(0, Math.min(1, scrolled / maxScroll));
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // initial call
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Set up particle system and simulation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Particle classes and structures
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      angle: number;
      radialSpeed: number;
      orbitSpeed: number;
      distance: number;
      life: number;
      maxLife: number;
      type: "flare" | "supernova" | "accretion" | "spaceDust";
    }

    let particles: Particle[] = [];
    const spaceDust: Particle[] = [];

    // Initialize space dust (star field background)
    for (let i = 0; i < 150; i++) {
      spaceDust.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        size: Math.random() * 1.5 + 0.5,
        color: "#ffffff",
        alpha: Math.random() * 0.5 + 0.2,
        angle: Math.random() * Math.PI * 2,
        radialSpeed: 0,
        orbitSpeed: (Math.random() - 0.5) * 0.001,
        distance: Math.random() * 500,
        life: 1,
        maxLife: 1,
        type: "spaceDust"
      });
    }

    // Interactive Mouse Tracking
    let mouseX = width / 2;
    let mouseY = height / 2;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };
    canvas.addEventListener("mousemove", handleMouseMove);

    // Handle Resize
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Trigger state check for explosion flash & heavy camera shake
    let hasExploded = false;

    // Simulation Clock
    let tick = 0;

    const renderLoop = () => {
      tick++;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Mouse influence pulls center slightly (gravitational lens shift/lookaround)
      const targetCenterX = centerX + (mouseX - centerX) * 0.05;
      const targetCenterY = centerY + (mouseY - centerY) * 0.05;

      // Stage definition based on scrolling
      // Stage 1: Descent to pitch black (scroll 0.0 to 0.2)
      // Stage 2: Blazing Giant Star (scroll 0.2 to 0.45)
      // Stage 3: Blood Red swell (scroll 0.45 to 0.49)
      // Stage 4: Supernova core collapse & Flash (scroll 0.49 to 0.53)
      // Stage 5: Black Hole & Swirling Accretion Disk (scroll 0.53 to 1.0)

      const stage = 
        scrollProgress < 0.2 ? "descent" :
        scrollProgress < 0.45 ? "stellar" :
        scrollProgress < 0.49 ? "swell" :
        scrollProgress < 0.53 ? "collapse" : "blackhole";

      // Camera Shake state machine
      if (stage === "swell" && scrollProgress > 0.47) {
        setIsShaking(true);
        // Pre-implosion trembling
        setShakeIntensity(Math.random() * 3 + 1);
      } else if (stage === "collapse") {
        setIsShaking(true);
        // Violent shockwave tremble
        const age = (scrollProgress - 0.49) / 0.04; // 0 to 1
        setShakeIntensity((1 - age) * 25 + 2); // Heavy jolt decaying
        if (!hasExploded && scrollProgress > 0.50) {
          hasExploded = true;
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 800);

          // Spawn Supernova energetic explosion particles
          for (let i = 0; i < 500; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 15 + 5;
            particles.push({
              x: targetCenterX,
              y: targetCenterY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              size: Math.random() * 4 + 1,
              color: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#60a5fa" : "#a78bfa",
              alpha: 1,
              angle: angle,
              radialSpeed: speed,
              orbitSpeed: 0,
              distance: 0,
              life: 0,
              maxLife: Math.random() * 80 + 40,
              type: "supernova"
            });
          }
        }
      } else if (stage === "blackhole") {
        setIsShaking(true);
        // Constant deep vibrating hum
        setShakeIntensity(0.6);
        hasExploded = false; // Reset if user scrolls back up
      } else {
        setIsShaking(false);
        setShakeIntensity(0);
        hasExploded = false;
      }

      // Draw Starfield background with slight gravitational lensing
      spaceDust.forEach((dust) => {
        let dx = dust.x - targetCenterX;
        let dy = dust.y - targetCenterY;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (stage === "blackhole" && dist < 350) {
          // Einstein ring/gravitational lens warp effect
          // Stars bend around the event horizon
          const bhRadius = 70;
          if (dist > bhRadius) {
            const factor = 1 + (bhRadius * bhRadius) / (dist * dist * 1.5);
            dx *= factor;
            dy *= factor;
          }
        }

        ctx.fillStyle = dust.color;
        ctx.globalAlpha = dust.alpha;
        ctx.fillRect(targetCenterX + dx, targetCenterY + dy, dust.size, dust.size);
      });
      ctx.globalAlpha = 1.0;

      // STAGE-SPECIFIC DRAWING
      if (stage === "stellar" || stage === "swell") {
        // Base star core size
        let baseRadius = 80;
        let starColor = "rgba(14, 165, 233, 0.9)"; // Bright sky blue fusion
        let outerGlow = "rgba(56, 189, 248, 0.2)";

        if (stage === "swell") {
          // Swelling and turning blood red
          const swellProgress = (scrollProgress - 0.45) / 0.04; // 0 to 1
          baseRadius = 80 + swellProgress * 60;
          // Mix blue/orange to crimson red
          const r = Math.round(14 + swellProgress * 230);
          const g = Math.round(165 - swellProgress * 145);
          const b = Math.round(233 - swellProgress * 200);
          starColor = `rgba(${r}, ${g}, ${b}, 0.95)`;
          outerGlow = `rgba(${r}, ${g}, ${b}, 0.25)`;
        }

        const pulse = 1 + Math.sin(tick * 0.1) * 0.04;
        const currentRadius = baseRadius * pulse;

        // Render multi-layered glowing core
        const glowGrid = ctx.createRadialGradient(
          targetCenterX, targetCenterY, currentRadius * 0.1,
          targetCenterX, targetCenterY, currentRadius * 1.6
        );
        glowGrid.addColorStop(0, "#ffffff");
        glowGrid.addColorStop(0.2, starColor);
        glowGrid.addColorStop(0.6, outerGlow);
        glowGrid.addColorStop(1, "transparent");

        ctx.fillStyle = glowGrid;
        ctx.beginPath();
        ctx.arc(targetCenterX, targetCenterY, currentRadius * 1.6, 0, Math.PI * 2);
        ctx.fill();

        // Spawn solar flare particles continually
        if (tick % 2 === 0) {
          const spawnAngle = Math.random() * Math.PI * 2;
          const flareDist = currentRadius * 0.8;
          particles.push({
            x: targetCenterX + Math.cos(spawnAngle) * flareDist,
            y: targetCenterY + Math.sin(spawnAngle) * flareDist,
            vx: Math.cos(spawnAngle) * (Math.random() * 2 + 1),
            vy: Math.sin(spawnAngle) * (Math.random() * 2 + 1),
            size: Math.random() * 8 + 3,
            color: stage === "stellar" ? "#38bdf8" : "#f43f5e",
            alpha: 1,
            angle: spawnAngle,
            radialSpeed: Math.random() * 2 + 1,
            orbitSpeed: 0,
            distance: flareDist,
            life: 0,
            maxLife: Math.random() * 30 + 15,
            type: "flare"
          });
        }
      }

      // STAGE-SPECIFIC PARTICLE PHYSICS & DRAWING
      particles.forEach((p, index) => {
        p.life++;

        if (p.type === "flare") {
          // Flare particles float outward and fade
          p.x += p.vx;
          p.y += p.vy;
          p.alpha = 1 - p.life / p.maxLife;
          
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        else if (p.type === "supernova") {
          // Fast explosive ejecta, experiencing slight deceleration
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.alpha = 1 - p.life / p.maxLife;

          // Sparkle effect
          const dSize = p.size * (1 - p.life / p.maxLife);

          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, dSize, 0, Math.PI * 2);
          ctx.fill();
        }

        else if (p.type === "accretion") {
          // Black hole accretion disk particles
          // Spiral physically towards the singularity center
          p.angle += p.orbitSpeed;
          p.distance -= p.radialSpeed;

          // Accelerate rotation as distance shrinks (Conservation of angular momentum)
          p.orbitSpeed = 0.08 * (150 / Math.max(20, p.distance));

          // Project orbit to 2D
          p.x = targetCenterX + Math.cos(p.angle) * p.distance;
          p.y = targetCenterY + Math.sin(p.angle) * p.distance * 0.45; // Flattened tilt look

          const speedIntensity = Math.min(1, 100 / Math.max(10, p.distance));
          // Speed glows white hot near event horizon
          ctx.fillStyle = speedIntensity > 0.8 ? "#ffffff" : p.color;
          ctx.globalAlpha = Math.min(1, p.distance / 20) * 0.8;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          // Gravity devourment threshold
          if (p.distance < 45) {
            particles.splice(index, 1); // consumed by event horizon
          }
        }
      });
      ctx.globalAlpha = 1.0;

      // CLEANUP stale particles
      particles = particles.filter(p => p.life < p.maxLife);

      // BLACK HOLE REVEALED ACCRETION DISK (STAGE 5)
      if (stage === "blackhole") {
        const horizonRadius = 45;

        // Generate accretion disk spiraling particles continually
        if (tick % 2 === 0) {
          const spawnAngle = Math.random() * Math.PI * 2;
          const spawnDist = Math.random() * 250 + 80;
          particles.push({
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            size: Math.random() * 2.5 + 1.2,
            color: spawnDist > 160 ? "rgba(168, 85, 247, 0.85)" : "rgba(249, 115, 22, 0.9)", // violet outer, orange inner
            alpha: 0.8,
            angle: spawnAngle,
            radialSpeed: Math.random() * 0.8 + 0.4,
            orbitSpeed: 0.02,
            distance: spawnDist,
            life: 0,
            maxLife: 400,
            type: "accretion"
          });
        }

        // Draw Beautiful spacetime warping accretion grid under event horizon
        ctx.strokeStyle = "rgba(147, 51, 234, 0.07)";
        ctx.lineWidth = 1;
        const ringCount = 12;
        for (let i = 1; i <= ringCount; i++) {
          const r = i * 28;
          ctx.beginPath();
          ctx.ellipse(targetCenterX, targetCenterY, r, r * 0.45, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw intense glowing gravitational lensing shell (glowing ring around black disk)
        const lensGlow = ctx.createRadialGradient(
          targetCenterX, targetCenterY, horizonRadius - 6,
          targetCenterX, targetCenterY, horizonRadius + 45
        );
        lensGlow.addColorStop(0, "#000000");
        lensGlow.addColorStop(0.12, "rgba(255, 255, 255, 0.95)"); // Singularity edge
        lensGlow.addColorStop(0.25, "rgba(249, 115, 22, 0.9)");   // Bright accretion peak orange
        lensGlow.addColorStop(0.40, "rgba(168, 85, 247, 0.4)");   // Deep space warp violet
        lensGlow.addColorStop(1, "transparent");

        ctx.fillStyle = lensGlow;
        ctx.beginPath();
        ctx.arc(targetCenterX, targetCenterY, horizonRadius + 45, 0, Math.PI * 2);
        ctx.fill();

        // The absolute pitch black event horizon itself (Nothing escapes)
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(targetCenterX, targetCenterY, horizonRadius, 0, Math.PI * 2);
        ctx.fill();

        // Sharp horizon border outline
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
    };
  }, [scrollProgress]);

  // Apply Camera Shake offset style
  const getShakeStyle = () => {
    if (!isShaking || shakeIntensity === 0) return {};
    const shakeX = (Math.random() - 0.5) * shakeIntensity;
    const shakeY = (Math.random() - 0.5) * shakeIntensity;
    return {
      transform: `translate3d(${shakeX}px, ${shakeY}px, 0px)`
    };
  };

  const currentOverlayText = () => {
    if (scrollProgress >= 0.05 && scrollProgress < 0.28) {
      return {
        title: "Are you still not impressed?",
        subtitle: "A simple trajectory simulator, you think. Let's dig deeper."
      };
    } else if (scrollProgress >= 0.28 && scrollProgress < 0.45) {
      return {
        title: "Behold... gravity's ultimate scale.",
        subtitle: "A supermassive star feeding fuel to its burning thermal core."
      };
    } else if (scrollProgress >= 0.45 && scrollProgress < 0.55) {
      return {
        title: "CRITICAL FAILURE OF OUTWARD PRESSURE.",
        subtitle: "The star runs empty. Gravitational collapse begins. Core collapses in milliseconds..."
      };
    } else if (scrollProgress >= 0.55 && scrollProgress < 0.85) {
      return {
        title: "A Singular Masterpiece Born of Death",
        subtitle: "Spacetime curved to infinity. A cosmic blackhole anchoring the celestial grid."
      };
    } else if (scrollProgress >= 0.85) {
      return {
        title: "Nothing escapes the abyss.",
        subtitle: "Not even your doubt. Ready to pilot the launch?"
      };
    }
    return null;
  };

  const textOverlay = currentOverlayText();

  return (
    <section 
      ref={containerRef} 
      className="relative w-full bg-black select-none overflow-hidden" 
      style={{ height: "400vh" }} // 400vh guarantees beautiful, long cinematic scrolling
    >
      {/* Sticky Inner Container supporting Cinematic Shaking */}
      <div 
        className="sticky top-0 w-full h-screen overflow-hidden pointer-events-auto"
        style={getShakeStyle()}
      >
        {/* The Blackhole & Space Canvas */}
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full block cursor-crosshair z-0"
        />

        {/* Dynamic Dark Gradients to establish the tense mood */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black to-transparent pointer-events-none z-10" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent pointer-events-none z-10" />

        {/* Cinematic Supernova Flash Overlay */}
        <AnimatePresence>
          {showFlash && (
            <motion.div 
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute inset-0 bg-white mix-blend-screen z-40 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Ambient Dark Nebula Shadows */}
        <div className="absolute inset-0 bg-radial-at-c from-transparent via-black/10 to-black/70 pointer-events-none z-10" />

        {/* Narrative Floating Cinematic Text Panels */}
        <div className="absolute inset-0 flex flex-col items-center justify-between py-24 px-8 z-20 pointer-events-none text-center">
          
          <div className="w-full max-w-4xl pt-8">
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              className="text-[10px] sm:text-xs font-mono text-purple-400 uppercase tracking-[0.3em]"
            >
              Missions & Singularity Terminal / Active Log
            </motion.p>
          </div>

          <div className="w-full max-w-3xl flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {textOverlay && (
                <motion.div
                  key={textOverlay.title}
                  initial={{ opacity: 0, y: 30, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -30, scale: 0.97 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  <h2 
                    className="font-display font-medium text-4xl sm:text-5xl md:text-7xl tracking-tighter text-white uppercase break-words"
                    style={{
                      textShadow: "0 0 30px rgba(168,85,247,0.3)"
                    }}
                  >
                    {textOverlay.title}
                  </h2>
                  <p className="font-sans text-sm sm:text-base md:text-lg text-white/50 font-light max-w-xl mx-auto tracking-normal leading-relaxed">
                    {textOverlay.subtitle}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Epic Grand Final Control Panel Option at absolute scroll end */}
          <div className="w-full max-w-2xl px-4 pb-4">
            {scrollProgress >= 0.82 ? (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="glass-panel p-6 border border-white/10 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-auto bg-black/60 backdrop-blur-md"
              >
                <div className="text-left space-y-1">
                  <div className="flex items-center gap-2 text-orange-400">
                    <Sparkles size={14} className="animate-pulse" />
                    <span className="font-mono text-[9px] uppercase tracking-wider">Atmosphere: Singularity Fully Armed</span>
                  </div>
                  <h4 className="font-display-lg text-lg text-white font-bold uppercase tracking-tight">Return to Simulator Interface</h4>
                  <p className="text-[11px] text-white/40 max-w-md">Launch directly into calculation vectors, real-time optimal orbits, and 3D flight execution.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <button
                    onClick={() => {
                      setIsSimulatorRunning(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                  >
                    <Orbit size={14} />
                    <span>Run Simulator</span>
                  </button>
                  <a
                    href="https://github.com/UtkarshSharma000/MapG"
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 border border-white/10 text-white/80 font-mono text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer hover:bg-white/5 transition-all text-center"
                  >
                    <Github size={14} />
                    <span>Repository</span>
                  </a>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                animate={{ y: [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex flex-col items-center gap-1 opacity-40 text-white"
              >
                <span className="font-mono text-[9px] tracking-[0.2em] uppercase">Scroll to descend further into gravity</span>
                <span className="material-symbols-outlined text-sm animate-bounce">arrow_downward</span>
              </motion.div>
            )}
          </div>

        </div>

      </div>

      {/* Footer moved to absolute bottom of this ending component page */}
      <footer className="relative w-full py-8 px-8 md:px-[32px] flex flex-col md:flex-row justify-between items-center gap-[16px] bg-black border-t border-white/10 z-30">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-purple-400 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>target</span>
          <span className="font-display-lg text-lg text-purple-400 tracking-tighter font-bold">MAP G</span>
        </div>
        <div className="flex gap-8">
          <a className="font-label-caps text-[10px] text-white/40 hover:text-purple-400 transition-all hover:translate-x-1 duration-200 uppercase tracking-widest" href="https://github.com/UtkarshSharma000/MapG" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div className="text-right">
          <p className="font-label-caps text-[10px] text-white/30 tracking-widest">© 2026 MAP G. DEFYING GRAVITY.</p>
        </div>
      </footer>
    </section>
  );
}
