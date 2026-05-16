import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
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
import { AU, propagateOrbit, KeplerianElements, simulateInterplanetaryRK4, solveLambert, findOptimalTransfer, MU_SUN } from "./physics";
import axios from "axios";

export const MOONS: Record<string, any[]> = {
  Earth: [
    {
      name: "Moon",
      radius: 1737,
      texture: "/textures/2k_moon.jpg",
      color: "#dddddd",
      elements: {
        a: 384400 * 1000, 
        e: 0.0549,
        i: (5.14 * Math.PI) / 180,
        Omega: (125.08 * Math.PI) / 180,
        w: (318.15 * Math.PI) / 180,
        M0: 0,
        period: 27.32 * 24 * 3600,
      },
    },
  ],
  Mars: [
    {
      name: "Phobos",
      radius: 11,
      texture: "/textures/2k_mercury.jpg",
      color: "#888888",
      elements: {
        a: 9376 * 1000,
        e: 0.0151,
        i: (1.09 * Math.PI) / 180,
        Omega: 0,
        w: 0,
        M0: 0,
        period: 0.318 * 24 * 3600,
      },
    },
    {
      name: "Deimos",
      radius: 6,
      texture: "/textures/2k_mercury.jpg",
      color: "#aaaaaa",
      elements: {
        a: 23463 * 1000,
        e: 0.0002,
        i: (0.93 * Math.PI) / 180,
        Omega: 0,
        w: 0,
        M0: 0,
        period: 1.263 * 24 * 3600,
      },
    },
  ],
  Jupiter: [
    {
      name: "Io",
      radius: 1821,
      texture: "/textures/2k_mercury.jpg",
      color: "#ffff00",
      elements: {
        a: 421700 * 1000,
        e: 0.0041,
        i: 0.036 * Math.PI / 180,
        Omega: 0,
        w: 0,
        M0: 0,
        period: 1.769 * 24 * 3600,
      }
    },
    {
      name: "Ganymede",
      radius: 2634,
      texture: "/textures/2k_mercury.jpg",
      color: "#88ccff",
      elements: {
        a: 1070400 * 1000,
        e: 0.0013,
        i: 0.2 * Math.PI / 180,
        Omega: 0,
        w: 0,
        M0: 0,
        period: 7.155 * 24 * 3600,
      }
    }
  ],
  Saturn: [
    {
      name: "Titan",
      radius: 2574,
      texture: "/textures/2k_mercury.jpg",
      color: "#ffa500",
      elements: {
        a: 1221870 * 1000,
        e: 0.0288,
        i: 0.348 * Math.PI / 180,
        Omega: 0,
        w: 0,
        M0: 0,
        period: 15.945 * 24 * 3600,
      }
    }
  ]
};

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

function Moon({
  data,
  globalTimeRef,
  parentRadius,
}: {
  data: any;
  globalTimeRef: React.MutableRefObject<number>;
  parentRadius: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const radius = Math.max(0.1, Math.log10(data.radius) * 0.15);
  // Scale up moon orbits significantly so they appear outside the magnified planet meshes
  const orbitScale = POS_SCALE * 15; 

  const orbitPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const elements = data.elements;
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * elements.period;
      const [x, y, z] = propagateOrbit(elements, t);
      pts.push(new THREE.Vector3(x * orbitScale, y * orbitScale, z * orbitScale));
    }
    return pts;
  }, [data.elements, orbitScale]);

  useFrame((state, delta) => {
    const [x, y, z] = propagateOrbit(data.elements, globalTimeRef.current);
    if (ref.current) {
      ref.current.position.set(x * orbitScale, y * orbitScale, z * orbitScale);
      ref.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group>
      <Line
        points={orbitPoints}
        color="#ffffff"
        opacity={0.05}
        transparent
        lineWidth={0.5}
      />
      <group ref={ref}>
        <mesh>
          <TexturedPlanet
            radius={radius}
            url={data.texture}
            color={data.color}
          />
        </mesh>
      </group>
    </group>
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
          <GhostPath launchParams={launchParams} globalTimeRef={globalTimeRef} />
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

        {/* Moons */}
        {MOONS[data.name] && MOONS[data.name].map(moon => (
          <Moon 
            key={moon.name} 
            data={moon} 
            globalTimeRef={globalTimeRef} 
            parentRadius={radius} 
          />
        ))}

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

function GhostPath({ launchParams, globalTimeRef }: { launchParams: any, globalTimeRef: any }) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const shuttleRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const launchTimeRef = useRef<number | null>(null);
  const transferTimeRef = useRef<number>(1000);
  const [status, setStatus] = useState<string>("Standby");
  const lastCalcTime = useRef(0);

  const calculateInterplanetaryPath = useCallback(() => {
    if (!launchParams || launchParams.isLaunched || !launchParams.targetPlanet) return;
    
    const earth = PLANETS.find(p => p.name === (launchParams.launchPlanet || "Earth"));
    const target = PLANETS.find(p => p.name === launchParams.targetPlanet);
    
    if (earth && target) {
      const time = globalTimeRef.current;
      const { tof, vReq } = findOptimalTransfer(
        earth.elements,
        target.elements,
        time,
        MU_SUN,
        false
      );

      const startPos = propagateOrbit(earth.elements, time);
      const simDuration = tof * 1.5; 
      const simDt = 600; 
      
      const { points: rawPoints, arrivalTime, success } = simulateInterplanetaryRK4(
        startPos as [number, number, number],
        vReq as [number, number, number],
        time,
        PLANETS,
        simDuration,
        simDt,
        launchParams.targetPlanet
      );
      
      transferTimeRef.current = arrivalTime - time;
      setPoints(rawPoints.map(p => new THREE.Vector3(p[0] * POS_SCALE, p[1] * POS_SCALE, p[2] * POS_SCALE)));
      setStatus(success ? "Intercept Locked" : "Transfer Optimized");
    }
  }, [launchParams, globalTimeRef]);

  useEffect(() => {
    if (!launchParams || launchParams.isLaunched) return;
    
    if (launchParams.targetPlanet) {
      calculateInterplanetaryPath();
      return;
    }

    const fetchPreview = async () => {
      try {
        const { v0, pitch, yaw, nbody, launchLocation, targetLocation, targetPlanet } = launchParams;
        const startLat = launchLocation?.lat || 0;
        const startLon = launchLocation?.lon || 0;
        const targetLat = targetLocation?.lat || 0;
        const targetLon = targetLocation?.lon || 0;

        const res = await axios.get("/api/trajectory-preview", {
          params: { v0, pitch, yaw, nbody, startLat, startLon, targetLat, targetLon, targetPlanet }
        });
        if (res.data.path) {
          const orbitPoints = res.data.path.map((p: number[]) => {
            // Backend returns km. Earth radius is 6371.0. Scale identically exactly over the planet mesh!
            // Z needs to be negative Y, because of Unity/Unreal/Three.js handedness differences in physics vs visuals
            return new THREE.Vector3(
              (p[0] / 6371.0) * PLANET_SIZE_SCALE * 1.0, 
              (p[2] / 6371.0) * PLANET_SIZE_SCALE * 1.0, 
              -(p[1] / 6371.0) * PLANET_SIZE_SCALE * 1.0
            );
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
    if (!launchParams) return;

    if (!launchParams.isLaunched) {
      launchTimeRef.current = null;
      progressRef.current = 0;
      setStatus("Standby");

      // Constantly recalculate if not launched (interplanetary)
      if (launchParams.targetPlanet) {
        lastCalcTime.current += delta;
        if (lastCalcTime.current > 0.3) { // Faster update (0.3s) for smoother sync
           lastCalcTime.current = 0;
           calculateInterplanetaryPath();
        }
      }

      // Update start point of interplanetary curve if not launched, otherwise it disconnects from Earth
      if (launchParams.targetPlanet && points.length > 0) {
        const earth = PLANETS.find(p => p.name === (launchParams.launchPlanet || "Earth"));
        if (earth) {
          const time = globalTimeRef.current;
          const [eX, eY, eZ] = propagateOrbit(earth.elements, time);
          const p1 = new THREE.Vector3(eX * POS_SCALE, eY * POS_SCALE, eZ * POS_SCALE);
          // Mutate just the first point to stay attached! Visual trick.
          setPoints(pts => {
            const newPts = [...pts];
            newPts[0] = p1;
            return newPts;
          });
        }
      }
      return;
    }

    if (points.length === 0 || !shuttleRef.current) return;
    
    if (launchTimeRef.current === null) {
      launchTimeRef.current = globalTimeRef.current;
    }

    const timeMult = launchParams.timeMult || 1;
    const maxIdx = points.length - 1;

    if (launchParams.targetPlanet) {
      const elapsed = globalTimeRef.current - launchTimeRef.current;
      const pct = Math.max(0, Math.min(1.0, elapsed / transferTimeRef.current));
      progressRef.current = pct * maxIdx;
      
      if (pct >= 0.99) {
        setStatus("Target Reached");
        // Snap to target planet position
        const target = PLANETS.find(p => p.name === launchParams.targetPlanet);
        if (target) {
          const [tx, ty, tz] = propagateOrbit(target.elements, globalTimeRef.current);
          shuttleRef.current.position.set(tx * POS_SCALE, ty * POS_SCALE, tz * POS_SCALE);
          shuttleRef.current.rotation.y += delta; // Slow orbit rotation
          return;
        }
      } else {
        setStatus("En Route");
      }
    } else {
      // Shuttle movement. If we have lots of points (LEO backend), speed needs to be faster
      const baseSpeed = 20.0; 
      progressRef.current += delta * timeMult * baseSpeed;
    }
    
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
    shuttleRef.current.lookAt(p2 || p1);
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
           <Html distanceFactor={20} position={[0, 0.5, 0]}>
             <div className="bg-black/80 px-2 py-1 rounded border border-red-500/50 text-[8px] whitespace-nowrap text-white font-mono uppercase tracking-tighter shadow-lg">
               {status}
             </div>
           </Html>
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
  const [isLocked, setIsLocked] = useState(true);

  // Auto-lock when target changes
  useEffect(() => {
    setIsLocked(true);
  }, [selectedTarget]);

  useFrame((state, delta) => {
    // Limit delta to prevent huge jumps from tab switching
    const safeDelta = Math.min(delta, 0.1);
    globalTimeRef.current += safeDelta * timeMult;

    if (controlsRef.current && isLocked) {
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
      {/* UI Controls overlay inside the 3D scene */}
      <Html fullscreen className="pointer-events-none">
        <div className="absolute top-20 left-72 pointer-events-auto">
          {!isLocked && (
            <button 
              onClick={() => setIsLocked(true)}
              className="px-3 py-1.5 bg-primary/20 hover:bg-primary/40 border border-primary/50 text-primary text-[10px] font-mono tracking-widest rounded backdrop-blur-md flex items-center gap-2 group transition-all"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse group-hover:scale-125"></div>
              RE-LOCK CAMERA TO {selectedTarget ? selectedTarget.name.toUpperCase() : "SOL"}
            </button>
          )}
          {isLocked && (
            <div className="px-3 py-1.5 bg-white/5 border border-white/10 text-white/50 text-[10px] font-mono tracking-widest rounded backdrop-blur-md flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
              CAMERA TRACKING {selectedTarget ? selectedTarget.name.toUpperCase() : "SOL"}
              <span className="ml-2 text-[8px] opacity-30">(RIGHT CLICK DRAG TO UNLOCK)</span>
            </div>
          )}
        </div>
      </Html>

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
        <GhostPath launchParams={launchParams} globalTimeRef={globalTimeRef} />
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
        onStart={(e: any) => {
          // Check if this was a right-click or drag that should unlock
          // For simplicity, any start of camera movement unlocks
          setIsLocked(false);
        }}
        makeDefault
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
