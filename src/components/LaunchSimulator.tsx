import React, { useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
  Sky,
  Environment,
  Box,
  Cylinder,
  Cone,
  Sphere,
} from "@react-three/drei";
import * as THREE from "three";
import {
  Play,
  Pause,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
} from "lucide-react";

const EARTH_RADIUS = 6371000;
const G = 6.6743e-11;
const M_EARTH = 5.972e24;
const P0 = 101325;
const T0 = 288.15;
const L = 0.0065;
const R = 8.31446;
const M = 0.0289652;

function getAirDensity(altitude: number) {
  if (altitude > 100000) return 0;
  const temp = Math.max(T0 - L * altitude, 150);
  const pressure =
    P0 *
    Math.pow(
      1 - (L * altitude) / T0,
      (((G * M_EARTH) / (EARTH_RADIUS * EARTH_RADIUS)) * M) / (R * L),
    );
  return Math.max(0, pressure / (287.05 * temp));
}

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

function RocketVisuals({
  blocks,
  stageIndex,
  ignition,
  throttle,
  pitch,
  failure,
}: any) {
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
      {blocks.map((b: any, i: number) => {
        if (b.stage && b.stage < stageIndex) return null;

        let color =
          b.type === "rocket_engine_main"
            ? "#fb923c"
            : b.type === "rocket_fuel_main"
              ? "#f3f4f6"
              : "#9ca3af";
        const catId = b.type;

        return (
          <group
            key={b.id}
            position={[b.position[0], b.position[1], b.position[2]]}
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

export function LaunchSimulator({
  spacecraftConfig,
  onOrbitReached,
  onAbort,
}: any) {
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);

  const [countdown, setCountdown] = useState<number | null>(null);

  // Telemetry
  const [time, setTime] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [dynamicPressure, setDynamicPressure] = useState(0);
  const [thrust, setThrust] = useState(0);
  const [mass, setMass] = useState(spacecraftConfig.stats?.mass || 1000);
  const [stageIndex, setStageIndex] = useState(0);
  const [fuel, setFuel] = useState(spacecraftConfig.stats?.fuel || 0);
  const [mach, setMach] = useState(0);
  const [acceleration, setAcceleration] = useState(0);

  const [failure, setFailure] = useState<string | null>(null);
  const [orbitAchieved, setOrbitAchieved] = useState(false);

  const [cameraMode, setCameraMode] = useState("chase");

  const phys = useRef({
    alt: 0,
    vel: 0,
    vX: 0,
    vY: 0,
    mass: spacecraftConfig.stats?.mass || 1000,
    fuel: spacecraftConfig.stats?.fuel || 0,
    pitch: 0,
    stage: 0,
    time: 0,
    active: false,
    ignition: false,
  });

  useEffect(() => {
    let lastTime = performance.now();
    let frameId: number;

    const loop = () => {
      frameId = requestAnimationFrame(loop);

      if (!phys.current.active || paused || failure || orbitAchieved) {
        lastTime = performance.now();
        return;
      }

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1); // cap dt
      lastTime = now;

      let { alt, vel, vX, vY, mass, fuel, pitch, stage, ignition } =
        phys.current;

      const rho = getAirDensity(alt);
      const vMag = Math.sqrt(vX * vX + vY * vY);
      const q = 0.5 * rho * vMag * vMag;

      // Speed of sound approx
      const temp = Math.max(T0 - L * alt, 150);
      const a = Math.sqrt(1.4 * 287.05 * temp);
      const currentMach = vMag / a;

      if (alt > 500 && alt < 100000) {
        pitch = Math.min(
          Math.PI / 2.1,
          ((alt - 500) / 80000) * (Math.PI / 2.1),
        );
      }

      let currentThrust = 0;

      const stages = spacecraftConfig.stages || [
        {
          thrust: spacecraftConfig.stats?.thrusterCount * 500000 || 500000,
          isp: 310,
          fuelCap: fuel,
          dryMass: 1000,
        },
      ];

      const currentStage = stages[stage] || {
        thrust: 0,
        fuelCap: 0,
        isp: 0,
        dryMass: 0,
      };

      if (ignition && fuel > 0) {
        currentThrust = currentStage.thrust;
        const flow = currentThrust / ((currentStage.isp || 300) * 9.81);
        fuel -= flow * dt;
        mass -= flow * dt;
      } else if (ignition && fuel <= 0 && stage < stages.length - 1) {
        stage++;
        fuel = stages[stage].fuelCap;
        mass -= currentStage.dryMass || 0;
      }

      const dragMag = q * 0.5 * 3.0; // drag area
      const gravityMag = (G * M_EARTH * mass) / Math.pow(EARTH_RADIUS + alt, 2);

      const tX = currentThrust * Math.sin(pitch);
      const tY = currentThrust * Math.cos(pitch);

      const dX = vMag > 0 ? dragMag * (vX / vMag) : 0;
      const dY = vMag > 0 ? dragMag * (vY / vMag) : 0;

      // Release clamps after a bit of thrust builds
      let aX = 0;
      let aY = 0;

      if (ignition) {
        aX = (tX - dX) / mass;
        aY = (tY - dY - gravityMag) / mass;
      }

      if (alt <= 0 && aY < 0) {
        aY = 0; // Ground normal force
        vY = 0;
      }

      vX += aX * dt;
      vY += aY * dt;

      alt += vY * dt;
      const horizontalDist = vX * dt;

      alt -= (horizontalDist * horizontalDist) / (2 * EARTH_RADIUS);

      if (alt < 0) {
        alt = 0;
        vY = 0;
      }

      if (q > 45000) {
        setFailure(
          "Aerodynamic Stress Failure! Vehicle disintegrated at Max-Q.",
        );
      }

      if (alt > 150000 && vX > 7000) {
        setOrbitAchieved(true);
      }

      phys.current = {
        ...phys.current,
        alt,
        vX,
        vY,
        mass,
        fuel,
        pitch,
        stage,
        time: phys.current.time + dt,
      };

      if (Math.random() < 0.2) {
        setTime(phys.current.time);
        setAltitude(alt);
        setVelocity(Math.sqrt(vX * vX + vY * vY));
        setDynamicPressure(q);
        setThrust(currentThrust);
        setMass(mass);
        setFuel(fuel);
        setPitch(pitch);
        setStageIndex(stage);
        setMach(currentMach);
        setAcceleration(Math.sqrt(aX * aX + aY * aY) / 9.81); // in Gs
      }
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [paused, failure, orbitAchieved, spacecraftConfig]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setActive(true);
      phys.current.active = true;
      phys.current.ignition = true;
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
                  T+ {time.toFixed(1)} s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Altitude</span>
                <span className="font-bold">
                  {(altitude / 1000).toFixed(2)} km
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Velocity</span>
                <span className="font-bold">{velocity.toFixed(1)} m/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Mach Number</span>
                <span className="font-bold">M {mach.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Acceleration</span>
                <span className="font-bold">{acceleration.toFixed(2)} G</span>
              </div>

              <div className="my-2 h-[1px] bg-zinc-800"></div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Dyn Pressure</span>
                <div className="flex flex-col items-end">
                  <span
                    className={`font-bold ${dynamicPressure > 30000 ? "text-red-400" : "text-white"}`}
                  >
                    {(dynamicPressure / 1000).toFixed(1)} kPa
                  </span>
                  <div className="w-20 h-1 bg-zinc-800 mt-1">
                    <div
                      className="h-full bg-cyan-500"
                      style={{
                        width: `${Math.min(100, dynamicPressure / 400)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-500">Pitch Angle</span>
                <span className="font-bold">
                  {((pitch * 180) / Math.PI).toFixed(1)}°
                </span>
              </div>

              <div className="my-2 h-[1px] bg-zinc-800"></div>

              <div className="flex justify-between">
                <span className="text-zinc-500">Current Stage</span>
                <span className="font-bold text-amber-500">
                  STAGE {stageIndex + 1}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Thrust</span>
                <span className="font-bold text-amber-500">
                  {(thrust / 1000).toFixed(1)} kN
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Propellant</span>
                <div className="flex flex-col items-end">
                  <span className="font-bold text-cyan-500">
                    {fuel.toFixed(0)} kg
                  </span>
                  <div className="w-20 h-1 bg-zinc-800 mt-1">
                    <div
                      className="h-full bg-cyan-500"
                      style={{
                        width: `${Math.min(100, (fuel / 10000) * 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>
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

        {altitude < 100000 ? (
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

        <CameraRig altitude={altitude} mode={cameraMode} pitch={pitch} />
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          maxPolarAngle={Math.PI / 2}
        />

        <group position={[0, Math.max(1, altitude), 0]}>
          <RocketVisuals
            blocks={spacecraftConfig.blocks || []}
            stageIndex={stageIndex}
            ignition={phys.current.ignition && fuel > 0}
            throttle={1}
            pitch={pitch}
            failure={!!failure}
          />
        </group>
      </Canvas>
    </div>
  );
}
