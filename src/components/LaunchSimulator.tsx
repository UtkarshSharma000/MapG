import React, { useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
  Sky,
  Box,
  Cylinder,
  Cone,
} from "@react-three/drei";
import * as THREE from "three";
import {
  Play,
  Pause,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { Spacecraft } from "../core/spacecraft/Spacecraft";
import { Simulation } from "../core/simulation/Simulation";
import { Telemetry } from "../core/telemetry/Telemetry";

function ParticleSystem({ active }: { active: boolean }) {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 500;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2;
      pos[i * 3 + 1] = -Math.random() * 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (!particlesRef.current || !active) return;
    const positions = particlesRef.current.geometry.attributes.position
      .array as Float32Array;
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] -= delta * 15; // move down fast
      if (positions[i * 3 + 1] < -10) {
        positions[i * 3 + 1] = 0; // reset
        positions[i * 3] = (Math.random() - 0.5) * 2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
      }
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <points ref={particlesRef} position={[0, -1, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.5}
        color="#fb923c"
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function CameraRig({
  altitude,
  mode,
  pitch,
}: {
  altitude: number;
  mode: string;
  pitch: number;
}) {
  const { camera } = useThree();
  useFrame(() => {
    if (mode === "tracking") {
      camera.position.set(0, 10, 40 + altitude * 0.005);
      camera.lookAt(0, 5, 0);
    } else if (mode === "chase") {
      const p = pitch || 0;
      camera.position.set(20 * Math.sin(p), 5, 20 * Math.cos(p));
      camera.lookAt(0, 5, 0);
    } else if (mode === "pad") {
      camera.position.set(30, Math.max(2, 10 - altitude * 0.005), 30);
      camera.lookAt(0, Math.min(altitude, 5000), 0);
    }
  });
  return null;
}

function RocketVisuals({
  spacecraft,
  stageIndex,
  ignition,
  throttle,
  pitch,
  failure,
}: {
  spacecraft: Spacecraft;
  stageIndex: number;
  ignition: boolean;
  throttle: number;
  pitch: number;
  failure: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.z = -pitch;
      if (failure) {
        groupRef.current.rotation.x += 0.05;
        groupRef.current.rotation.y += 0.1;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from(spacecraft.components.values()).map((b: any) => {
        // Simplified visual mapping
        let color = b.props.type.includes("engine")
          ? "#fb923c"
          : b.props.type.includes("tank")
            ? "#f3f4f6"
            : "#9ca3af";
        const catId = b.props.type;

        return (
          <group
            key={b.id}
            position={[
              b.transform.position.x,
              b.transform.position.y,
              b.transform.position.z,
            ]}
          >
            {catId.includes("cone") || catId === "fairing" ? (
              <Cone args={[0.5, 1, 16]} castShadow receiveShadow>
                <meshStandardMaterial
                  color={color}
                  metalness={0.5}
                  roughness={0.5}
                />
              </Cone>
            ) : catId.includes("tank") ? (
              <Cylinder args={[0.5, 0.5, 1]} castShadow receiveShadow>
                <meshStandardMaterial
                  color={color}
                  metalness={0.5}
                  roughness={0.5}
                />
              </Cylinder>
            ) : catId.includes("engine") ? (
              <group>
                <Cylinder
                  args={[0.4, 0.5, 0.5]}
                  position={[0, 0.25, 0]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial color="#444" />
                </Cylinder>
                {ignition && !failure && (
                  <Cone
                    args={[0.3, 3 * throttle, 16]}
                    position={[0, -1.5, 0]}
                    rotation={[Math.PI, 0, 0]}
                  >
                    <meshBasicMaterial
                      color="#fcd34d"
                      transparent
                      opacity={0.8}
                    />
                  </Cone>
                )}
              </group>
            ) : (
              <Box args={[1, 1, 1]} castShadow receiveShadow>
                <meshStandardMaterial
                  color={color}
                  metalness={0.5}
                  roughness={0.5}
                />
              </Box>
            )}
          </group>
        );
      })}

      <ParticleSystem active={ignition && !failure} />
    </group>
  );
}

export function LaunchSimulator({
  spacecraft,
  onOrbitReached,
  onAbort,
}: {
  spacecraft: Spacecraft;
  onOrbitReached: () => void;
  onAbort: () => void;
}) {
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);

  const [countdown, setCountdown] = useState<number | null>(null);

  // Telemetry
  const [telemetry, setTelemetry] = useState<any>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [orbitAchieved, setOrbitAchieved] = useState(false);

  const [cameraMode, setCameraMode] = useState("chase");

  const simRef = useRef<Simulation | null>(null);

  useEffect(() => {
    simRef.current = new Simulation(spacecraft);

    let lastTime = performance.now();
    let frameId: number;

    const loop = () => {
      frameId = requestAnimationFrame(loop);

      const sim = simRef.current;
      if (!sim || paused || failure || orbitAchieved) {
        lastTime = performance.now();
        return;
      }

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1); // cap dt
      lastTime = now;

      if (active) {
        sim.step(dt);
      }

      // Check failures
      if (sim.state.dynamicPressure > 45000) {
        setFailure(
          "Aerodynamic Stress Failure! Vehicle disintegrated at Max-Q.",
        );
      }

      if (sim.state.altitude < 0 && sim.state.velocity.y < -10) {
        setFailure("Vehicle destroyed on impact.");
      }

      // Check orbit
      if (
        sim.state.altitude > 150000 &&
        Math.abs(sim.state.velocity.x) > 7000
      ) {
        setOrbitAchieved(true);
      }

      if (Math.random() < 0.2) {
        setTelemetry(Telemetry.getReport(sim.state));
      }
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [paused, failure, orbitAchieved, spacecraft, active]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setActive(true);
      if (simRef.current) {
        simRef.current.ignition = true;
        simRef.current.throttle = 1.0;
      }
      setCountdown(null);
    }
  }, [countdown]);

  const startLaunch = () => {
    setCountdown(5); // Cinematic T-5
  };

  return (
    <div className="absolute inset-0 bg-black z-50 flex flex-col font-mono text-white">
      {countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="text-[120px] font-black text-cyan-500 animate-pulse drop-shadow-[0_0_20px_rgba(6,182,212,0.8)]">
            T-{countdown}
          </div>
        </div>
      )}

      {/* HUD OVERLAY */}
      <div className="absolute inset-0 z-10 pointer-events-none p-6 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="bg-zinc-950/80 p-4 border border-zinc-800 rounded w-72 backdrop-blur-md">
            <div className="flex justify-between items-center mb-2 border-b border-zinc-800 pb-2">
              <h2 className="text-cyan-400 font-bold tracking-widest text-xs uppercase">
                Telemetry
              </h2>
              <span
                className={`px-2 py-0.5 text-[9px] rounded ${active ? "bg-green-900/50 text-green-400" : "bg-zinc-800 text-zinc-400"}`}
              >
                {active ? "IN FLIGHT" : "PRE-LAUNCH"}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Mission Time</span>
                <span className="font-bold text-cyan-300">
                  T+ {(telemetry?.time || 0).toFixed(1)} s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Altitude</span>
                <span className="font-bold">
                  {((telemetry?.altitude || 0) / 1000).toFixed(2)} km
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Velocity</span>
                <span className="font-bold">
                  {(telemetry?.velocity || 0).toFixed(1)} m/s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Mach Number</span>
                <span className="font-bold">
                  M {(telemetry?.mach || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Acceleration</span>
                <span className="font-bold">
                  {(telemetry?.acceleration || 0).toFixed(2)} G
                </span>
              </div>

              <div className="my-2 h-[1px] bg-zinc-800"></div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Dyn Pressure</span>
                <div className="flex flex-col items-end">
                  <span
                    className={`font-bold ${(telemetry?.dynamicPressure || 0) > 30000 ? "text-red-400" : "text-white"}`}
                  >
                    {((telemetry?.dynamicPressure || 0) / 1000).toFixed(1)} kPa
                  </span>
                  <div className="w-20 h-1 bg-zinc-800 mt-1">
                    <div
                      className="h-full bg-cyan-500"
                      style={{
                        width: `${Math.min(100, (telemetry?.dynamicPressure || 0) / 400)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-500">Pitch Angle</span>
                <span className="font-bold">
                  {(telemetry?.pitch || 0).toFixed(1)}°
                </span>
              </div>

              <div className="my-2 h-[1px] bg-zinc-800"></div>

              <div className="flex justify-between">
                <span className="text-zinc-500">Current Stage</span>
                <span className="font-bold text-amber-500">
                  STAGE {(telemetry?.stage || 0) + 1}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Mass</span>
                <span className="font-bold text-cyan-500">
                  {((telemetry?.mass || 0) / 1000).toFixed(1)} t
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pointer-events-auto">
            <button
              className={`border px-3 py-1 text-xs rounded transition-colors ${cameraMode === "chase" ? "bg-cyan-900 border-cyan-500 text-cyan-200" : "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"}`}
              onClick={() => setCameraMode("chase")}
            >
              Chase Cam
            </button>
            <button
              className={`border px-3 py-1 text-xs rounded transition-colors ${cameraMode === "pad" ? "bg-cyan-900 border-cyan-500 text-cyan-200" : "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"}`}
              onClick={() => setCameraMode("pad")}
            >
              Pad Cam
            </button>
            <button
              className={`border px-3 py-1 text-xs rounded transition-colors ${cameraMode === "tracking" ? "bg-cyan-900 border-cyan-500 text-cyan-200" : "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"}`}
              onClick={() => setCameraMode("tracking")}
            >
              Tracking
            </button>
          </div>
        </div>

        <div className="flex justify-between items-end pointer-events-auto">
          <div>
            {!active && countdown === null ? (
              <button
                onClick={startLaunch}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 text-sm uppercase tracking-widest rounded flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)]"
              >
                <Play size={18} fill="currentColor" /> Initialize Launch
                Sequence
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setPaused(!paused)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 text-xs uppercase tracking-widest rounded border border-zinc-600"
                >
                  {paused ? "RESUME" : "PAUSE"}
                </button>
                <button
                  onClick={onAbort}
                  className="bg-red-900/50 hover:bg-red-800/80 text-red-400 font-bold py-2 px-4 text-xs uppercase tracking-widest rounded border border-red-800/50"
                >
                  ABORT MISSION
                </button>
              </div>
            )}
          </div>

          {failure && (
            <div className="bg-red-900/80 border border-red-500 text-red-200 p-6 rounded-lg max-w-md backdrop-blur-md animate-pulse">
              <div className="flex items-center gap-3 mb-2 text-xl font-bold">
                <AlertTriangle /> ANOMALY DETECTED
              </div>
              <p className="text-sm">{failure}</p>
              <button
                onClick={onAbort}
                className="mt-4 bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 text-xs uppercase tracking-widest rounded w-full flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} /> Return to VAB
              </button>
            </div>
          )}

          {orbitAchieved && (
            <div className="bg-green-900/80 border border-green-500 text-green-200 p-6 rounded-lg max-w-md backdrop-blur-md">
              <div className="flex items-center gap-3 mb-2 text-xl font-bold">
                ✓ ORBIT INSERTION CONFIRMED
              </div>
              <p className="text-sm mb-4">
                Stable orbit achieved. Handing over control to Mission Command.
              </p>
              <button
                onClick={onOrbitReached}
                className="bg-green-700 hover:bg-green-600 text-white font-bold py-2 px-4 text-xs uppercase tracking-widest rounded w-full flex items-center justify-center gap-2"
              >
                Proceed to Orbit Operations <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <Canvas>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />

        {(telemetry?.altitude || 0) < 100000 ? (
          <Sky
            distance={450000}
            sunPosition={[0, 1, 0]}
            inclination={0}
            azimuth={0.25}
          />
        ) : (
          <Stars
            radius={100}
            depth={50}
            count={5000}
            factor={4}
            saturation={0}
            fade
            speed={1}
          />
        )}

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.5, 0]}
          receiveShadow
        >
          <planeGeometry args={[2000, 2000]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>

        <mesh position={[0, -0.2, 0]} receiveShadow castShadow>
          <boxGeometry args={[15, 0.5, 15]} />
          <meshStandardMaterial color="#333" />
        </mesh>

        {/* Launch tower */}
        <mesh position={[-3, 5, 0]} receiveShadow castShadow>
          <boxGeometry args={[1, 10, 1]} />
          <meshStandardMaterial color="#d97706" wireframe />
        </mesh>

        <CameraRig
          altitude={telemetry?.altitude || 0}
          mode={cameraMode}
          pitch={(telemetry?.pitch || 0) * (Math.PI / 180)}
        />
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          maxPolarAngle={Math.PI / 2}
        />

        <group position={[0, Math.max(1, telemetry?.altitude || 0), 0]}>
          <RocketVisuals
            spacecraft={spacecraft}
            stageIndex={telemetry?.stage || 0}
            ignition={active && (telemetry?.mass || 0) > 0}
            throttle={1}
            pitch={(telemetry?.pitch || 0) * (Math.PI / 180)}
            failure={!!failure}
          />
        </group>
      </Canvas>
    </div>
  );
}
