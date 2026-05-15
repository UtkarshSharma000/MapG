import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
  Line,
  Sphere,
  Html,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import { AU, propagateOrbit, KeplerianElements } from "./physics";
import axios from "axios";

// 1 AU = 100 units in our 3D scene
const POS_SCALE = 100 / AU;
// For better visibility, sizes are exaggerated.
const PLANET_SIZE_SCALE = 0.0005; // Base radius scale
const SUN_SIZE = 5;

// Data adapted from J2000 epoch
export const PLANETS = [
  {
    name: "Mercury",
    radius: 2439,
    texture: "/textures/2k_mercury.jpg",
    color: "#a8a8a8",
    elements: {
      a: 0.387 * AU,
      e: 0.2056,
      i: (7.0 * Math.PI) / 180,
      Omega: (48.33 * Math.PI) / 180,
      w: (29.124 * Math.PI) / 180,
      M0: (174 * Math.PI) / 180,
      period: 88.0 * 24 * 3600,
    },
  },
  {
    name: "Venus",
    radius: 6051,
    texture: "/textures/2k_venus_atmosphere.jpg",
    color: "#e0c080",
    elements: {
      a: 0.723 * AU,
      e: 0.0067,
      i: (3.39 * Math.PI) / 180,
      Omega: (76.68 * Math.PI) / 180,
      w: (54.88 * Math.PI) / 180,
      M0: (50 * Math.PI) / 180,
      period: 224.7 * 24 * 3600,
    },
  },
  {
    name: "Earth",
    radius: 6371,
    texture: "/textures/2k_earth_daymap.jpg",
    color: "#2b82c9",
    elements: {
      a: 1.0 * AU,
      e: 0.0167,
      i: (0.00005 * Math.PI) / 180,
      Omega: (-11.26 * Math.PI) / 180,
      w: (114.2 * Math.PI) / 180,
      M0: (358 * Math.PI) / 180,
      period: 365.25 * 24 * 3600,
    },
  },
  {
    name: "Mars",
    radius: 3389,
    texture: "/textures/2k_mars.jpg",
    color: "#c1440e",
    elements: {
      a: 1.524 * AU,
      e: 0.0934,
      i: (1.85 * Math.PI) / 180,
      Omega: (49.57 * Math.PI) / 180,
      w: (286.5 * Math.PI) / 180,
      M0: (19 * Math.PI) / 180,
      period: 686.98 * 24 * 3600,
    },
  },
  {
    name: "Jupiter",
    radius: 69911,
    texture: "/textures/2k_jupiter.jpg",
    color: "#e3dccb",
    elements: {
      a: 5.204 * AU,
      e: 0.0489,
      i: (1.3 * Math.PI) / 180,
      Omega: (100.4 * Math.PI) / 180,
      w: (273.8 * Math.PI) / 180,
      M0: (20 * Math.PI) / 180,
      period: 4332.59 * 24 * 3600,
    },
  },
  {
    name: "Saturn",
    radius: 58232,
    texture: "/textures/2k_saturn.jpg",
    color: "#eaddb8",
    elements: {
      a: 9.582 * AU,
      e: 0.0565,
      i: (2.48 * Math.PI) / 180,
      Omega: (113.6 * Math.PI) / 180,
      w: (339.3 * Math.PI) / 180,
      M0: (317 * Math.PI) / 180,
      period: 10759 * 24 * 3600,
    },
  },
  {
    name: "Uranus",
    radius: 25362,
    texture: "/textures/2k_uranus.jpg",
    color: "#d1e7e7",
    elements: {
      a: 19.201 * AU,
      e: 0.0457,
      i: (0.77 * Math.PI) / 180,
      Omega: (74.0 * Math.PI) / 180,
      w: (96.6 * Math.PI) / 180,
      M0: (142 * Math.PI) / 180,
      period: 30688 * 24 * 3600,
    },
  },
  {
    name: "Neptune",
    radius: 24622,
    texture: "/textures/2k_neptune.jpg",
    color: "#5b5ddf",
    elements: {
      a: 30.047 * AU,
      e: 0.0113,
      i: (1.77 * Math.PI) / 180,
      Omega: (131.7 * Math.PI) / 180,
      w: (273.1 * Math.PI) / 180,
      M0: (256 * Math.PI) / 180,
      period: 60182 * 24 * 3600,
    },
  },
];

function FallbackMaterial({
  fallbackColor,
  basic,
  props,
}: {
  fallbackColor: string;
  basic?: boolean;
  props: any;
}) {
  const Material = basic ? "meshBasicMaterial" : "meshStandardMaterial";
  return (
    <Material
      color={fallbackColor === "transparent" ? "#ffffff" : fallbackColor}
      side={THREE.DoubleSide}
      roughness={basic ? undefined : 0.6}
      metalness={basic ? undefined : 0.1}
      {...props}
    />
  );
}

function LoadedMaterial({
  url,
  basic,
  props,
}: {
  url: string;
  basic?: boolean;
  props: any;
}) {
  const texture = useTexture(url);
  const Material = basic ? "meshBasicMaterial" : "meshStandardMaterial";
  return (
    <Material
      map={texture}
      color="#ffffff"
      side={THREE.DoubleSide}
      roughness={basic ? undefined : 0.6}
      metalness={basic ? undefined : 0.1}
      {...props}
    />
  );
}

function EarthClouds({ radius }: { radius: number }) {
  const cloudsTexture = useTexture("/textures/2k_earth_clouds.jpg");
  return (
    <mesh>
      <sphereGeometry args={[radius * 1.005, 64, 64]} />
      <meshStandardMaterial
        color="#ffffff"
        alphaMap={cloudsTexture}
        transparent={true}
        opacity={0.8}
        blending={THREE.NormalBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function SafeTexture({
  url,
  fallbackColor,
  basic = false,
  ...props
}: {
  [key: string]: any;
}) {
  return (
    <React.Suspense
      fallback={
        <FallbackMaterial
          fallbackColor={fallbackColor}
          basic={basic}
          props={props}
        />
      }
    >
      <LoadedMaterial url={url} basic={basic} props={props} />
    </React.Suspense>
  );
}

function TexturedPlanet({
  radius,
  url,
  color,
}: {
  radius: number;
  url: string;
  color: string;
}) {
  return (
    <>
      <sphereGeometry args={[radius, 64, 64]} />
      <SafeTexture url={url} fallbackColor={color} />
    </>
  );
}

function Planet({
  data,
  globalTimeRef,
  onDoubleClick,
  launchParams,
}: {
  data: (typeof PLANETS)[0];
  globalTimeRef: React.MutableRefObject<number>;
  onDoubleClick?: (name: string) => void;
  launchParams?: any;
}) {
  const ref = useRef<THREE.Group>(null);

  // Calculate scaled radius. Min size is 0.4
  const radius = Math.max(0.4, Math.log10(data.radius) * 0.4);

  // Pre-calculate orbit path
  const orbitPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const elements = data.elements;
    // Generate 500 points along the orbit
    for (let i = 0; i <= 500; i++) {
      // distribute anomalies 0 to 2*PI evenly
      // Approximating with Mean anomaly to space it out (actually a fixed delta M is fine)
      const t = (i / 500) * elements.period;
      const [x, y, z] = propagateOrbit(elements, t);
      pts.push(new THREE.Vector3(x * POS_SCALE, y * POS_SCALE, z * POS_SCALE));
    }
    return pts;
  }, [data.elements]);

  useFrame((state, delta) => {
    const [x, y, z] = propagateOrbit(data.elements, globalTimeRef.current);
    if (ref.current) {
      ref.current.position.set(x * POS_SCALE, y * POS_SCALE, z * POS_SCALE);
      // self rotation
      ref.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group>
      {/* Orbit Line */}
      <Line
        points={orbitPoints}
        color={data.color}
        opacity={0.2}
        transparent
        lineWidth={1}
      />

      {/* Planet Model */}
      <group 
        ref={ref}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (onDoubleClick) onDoubleClick(data.name);
        }}
      >
        {data.name === "Earth" && launchParams && !launchParams.targetPlanet && (
          <GhostPath launchParams={launchParams} />
        )}
        <mesh>
          <TexturedPlanet
            radius={radius}
            url={data.texture}
            color={data.color}
          />
        </mesh>

        {data.name === "Earth" && (
          <React.Suspense fallback={null}>
            <EarthClouds radius={radius} />
          </React.Suspense>
        )}

        {data.name === "Saturn" && (
          <mesh rotation={[(90 * Math.PI) / 180, 0, 0]}>
            <ringGeometry args={[radius * 1.2, radius * 2.2, 64]} />
            <SafeTexture
              url="/textures/2k_saturn_ring_alpha.png"
              fallbackColor="#ffffff"
              transparent
              opacity={0.9}
            />
          </mesh>
        )}

        {/* Label */}
        <Html
          distanceFactor={100}
          zIndexRange={[100, 0]}
          className="pointer-events-none"
        >
          <div className="text-[10px] uppercase font-bold text-white/50 tracking-widest translate-x-3 translate-y-3 drop-shadow-md">
            {data.name}
          </div>
        </Html>
      </group>
    </group>
  );
}

function GhostPath({ launchParams }: { launchParams: any }) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const shuttleRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    if (!launchParams || launchParams.isLaunched) return;
    
    const { v0, pitch, yaw, nbody, launchLocation, targetLocation, targetPlanet } = launchParams;
    const startLat = launchLocation?.lat || 0;
    const startLon = launchLocation?.lon || 0;
    const targetLat = targetLocation?.lat || 0;
    const targetLon = targetLocation?.lon || 0;

    const fetchPreview = async () => {
      try {
        const res = await axios.get("/api/trajectory-preview", {
          params: { v0, pitch, yaw, nbody, startLat, startLon, targetLat, targetLon, targetPlanet }
        });
        if (res.data.path) {
          const orbitPoints = res.data.path.map((p: number[]) => {
            const scale = targetPlanet ? POS_SCALE : PLANET_SIZE_SCALE;
            return new THREE.Vector3(p[0] * scale, p[1] * scale, p[2] * scale);
          });
          setPoints(orbitPoints);
        }
      } catch (err) {
        console.error("Ghost path fetch failed", err);
      }
    };

    const timeoutId = setTimeout(fetchPreview, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [launchParams]);

  useFrame((state, delta) => {
    if (!launchParams?.isLaunched || points.length === 0 || !shuttleRef.current) return;
    
    const timeMult = launchParams.timeMult || 1;
    progressRef.current += delta * timeMult * 0.05; // Base speed + time multiplier
    
    const maxIdx = points.length - 1;
    let currentIdx = Math.floor(progressRef.current);
    
    if (currentIdx >= maxIdx) {
      currentIdx = maxIdx - 1;
      progressRef.current = maxIdx;
    }
    
    const p1 = points[currentIdx];
    const p2 = points[currentIdx + 1];
    
    // Lerp
    const t = progressRef.current - currentIdx;
    shuttleRef.current.position.lerpVectors(p1, p2, t);
    shuttleRef.current.lookAt(p2);
  });

  if (points.length < 2) return null;

  return (
    <group>
      <Line
        points={points}
        color={launchParams?.isLaunched ? "#ff4444" : "#00ffff"}
        lineWidth={1.5}
        transparent
        opacity={launchParams?.isLaunched ? 0.7 : 0.4}
        dashed={true}
        dashScale={50}
        dashSize={1}
        gapSize={1}
      />
      
      {launchParams?.isLaunched && points.length > 0 && (
        <group ref={shuttleRef} position={points[0]}>
           <mesh rotation={[Math.PI / 2, 0, 0]}>
             <coneGeometry args={[0.1, 0.3, 16]} />
             <meshStandardMaterial color="#ffffff" emissive="#ff4444" emissiveIntensity={0.8} />
           </mesh>
           <pointLight color="#ff4444" intensity={5} distance={10} />
        </group>
      )}
    </group>
  );
}

function SystemEngine({
  timeMult,
  selectedTarget,
  launchParams,
  onPlanetDoubleClick
}: {
  timeMult: number;
  selectedTarget: (typeof PLANETS)[0] | null;
  launchParams?: any;
  onPlanetDoubleClick?: (name: string) => void;
}) {
  const globalTimeRef = useRef(0);
  const controlsRef = useRef<any>(null);
  const currentTargetName = useRef(selectedTarget?.name || "Sun");

  useFrame((state, delta) => {
    // Limit delta to prevent huge jumps from tab switching
    const safeDelta = Math.min(delta, 0.1);
    globalTimeRef.current += safeDelta * timeMult;

    if (controlsRef.current) {
      let targetX = 0,
        targetY = 0,
        targetZ = 0;

      if (selectedTarget) {
        const [x, y, z] = propagateOrbit(
          selectedTarget.elements,
          globalTimeRef.current,
        );
        targetX = x * POS_SCALE;
        targetY = y * POS_SCALE;
        targetZ = z * POS_SCALE;
      }

      const newTarget = new THREE.Vector3(targetX, targetY, targetZ);
      const targetName = selectedTarget ? selectedTarget.name : "Sun";

      if (currentTargetName.current !== targetName) {
        currentTargetName.current = targetName;
      }

      // Smoothly interpolate the target
      // This prevents harsh camera jumps and motion sickness
      const currentTarget = controlsRef.current.target;
      const lerpFactor = 1 - Math.exp(-safeDelta * 6); // Smooth framerate-independent lerp
      const newLerpedTarget = currentTarget.clone().lerp(newTarget, lerpFactor);

      const displacement = newLerpedTarget.clone().sub(currentTarget);

      // Update target and camera position to track smoothly
      controlsRef.current.target.copy(newLerpedTarget);
      state.camera.position.add(displacement);
    }
  });

  return (
    <>
      {/* The Sun */}
      <mesh>
        <sphereGeometry args={[SUN_SIZE, 64, 64]} />
        <meshBasicMaterial color="#ffcc00" />
        <Html distanceFactor={100} className="pointer-events-none">
          <div className="text-xs uppercase font-bold text-[#ffcc00] tracking-widest translate-x-4 drop-shadow-lg">
            SUN
          </div>
        </Html>
      </mesh>

      {PLANETS.map((p) => (
        <Planet key={p.name} data={p} globalTimeRef={globalTimeRef} onDoubleClick={onPlanetDoubleClick} launchParams={launchParams} />
      ))}

      {launchParams && launchParams.targetPlanet && (
        <GhostPath launchParams={launchParams} />
      )}

      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        autoRotate={false}
        enableDamping={true}
        dampingFactor={0.05}
        maxDistance={2000}
      />
    </>
  );
}

export default function OrbitSimulator({
  isRunning = false,
  timeMult = 10 * 24 * 3600,
  selectedTarget,
  launchParams,
  onPlanetDoubleClick,
}: {
  isRunning?: boolean;
  timeMult?: number;
  selectedTarget: (typeof PLANETS)[0] | null;
  launchParams?: any;
  onPlanetDoubleClick?: (name: string) => void;
}) {
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-1000 ${isRunning ? "opacity-100 z-10 pointer-events-auto bg-[#03060f]" : "opacity-0 z-[-10] pointer-events-none"}`}
    >
      <Canvas camera={{ position: [0, 150, 400], fov: 45 }}>
        <ambientLight intensity={0.2} />
        <pointLight
          position={[0, 0, 0]}
          intensity={1.8}
          color="#fffcf5"
          decay={0}
        />

        <SystemEngine 
          timeMult={timeMult} 
          selectedTarget={selectedTarget} 
          launchParams={launchParams}
          onPlanetDoubleClick={onPlanetDoubleClick}
        />

        <Stars
          radius={500}
          depth={50}
          count={8000}
          factor={6}
          saturation={0}
          fade
        />
      </Canvas>
    </div>
  );
}
