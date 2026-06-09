import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
  Line,
  Sphere,
  Html,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import { AU, propagateOrbit, KeplerianElements, simulateInterplanetaryRK4, solveLambert, findOptimalTransfer, MU_SUN, getJ2000Time, J2000_UNIX, getOrbitalVelocity } from "./physics";
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
    siderealDay: 58.646 * 24 * 3600,
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
    siderealDay: -243.02 * 24 * 3600, // Retrograde
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
    siderealDay: 0.997269 * 24 * 3600,
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
    siderealDay: 1.025957 * 24 * 3600,
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
    siderealDay: 0.41354 * 24 * 3600,
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
    siderealDay: 0.444 * 24 * 3600,
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
    siderealDay: -0.71833 * 24 * 3600, // Retrograde
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
    siderealDay: 0.67125 * 24 * 3600,
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

const AsteroidBelt = React.memo(function AsteroidBelt({ timeMult }: { timeMult: number }) {
  const asteroidsRef = useRef<THREE.Points>(null);
  const ASTEROID_COUNT = 3000;

  const asteroidPositions = useMemo(() => {
    const positions = new Float32Array(ASTEROID_COUNT * 3);
    const GAPS = [2.50, 2.82, 2.95];
    let i = 0;
    while (i < ASTEROID_COUNT) {
      const r = 2.2 + Math.random() * 1.0; // AU
      const inGap = GAPS.some(g => Math.abs(r - g) < 0.04);
      if (inGap && Math.random() > 0.1) continue; // 90% rejection in gaps

      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 0.15 * AU * POS_SCALE; // vertical scatter
      
      positions[i * 3] = r * AU * POS_SCALE * Math.cos(theta);
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = r * AU * POS_SCALE * Math.sin(theta);
      i++;
    }
    return positions;
  }, []);

  useFrame((state, delta) => {
    if (asteroidsRef.current) {
      asteroidsRef.current.rotation.y += 0.000012 * timeMult * delta;
    }
  });

  return (
    <points ref={asteroidsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={asteroidPositions}
          count={ASTEROID_COUNT}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#a89070" size={0.008} sizeAttenuation />
    </points>
  );
});

const KuiperBelt = React.memo(function KuiperBelt({ timeMult }: { timeMult: number }) {
  const beltRef = useRef<THREE.Points>(null);
  const PARTICLE_COUNT = 2500;

  const positions = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // The classical Kuiper Belt starts past Neptune's orbit (30 AU), primarily beyond the 3:2 resonance (39.5 to 55 AU)
      const r = 39.5 + Math.random() * 15.5; 
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 2.5 * AU * POS_SCALE; 
      
      pos[i * 3] = r * AU * POS_SCALE * Math.cos(theta);
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = r * AU * POS_SCALE * Math.sin(theta);
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (beltRef.current) {
      // Much slower rotation for Kuiper belt ~250 years
      beltRef.current.rotation.y += 0.000000219 * timeMult * delta; 
    }
  });

  return (
    <points ref={beltRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={PARTICLE_COUNT}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#8899aa" size={0.008} sizeAttenuation />
    </points>
  );
});

function OortCloud({ timeMult }: { timeMult: number }) {
  const cloudRef = useRef<THREE.Points>(null);
  const PARTICLE_COUNT = 4000;

  const positions = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Oort cloud is a spherical shell, much further out (e.g. 2000 to 50000 AU)
        // Let's use 2000 to 15000 for visibility
        const r = 2000 + Math.random() * 13000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        pos[i * 3] = r * AU * POS_SCALE * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * AU * POS_SCALE * Math.cos(phi);
        pos[i * 3 + 2] = r * AU * POS_SCALE * Math.sin(phi) * Math.sin(theta);
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (cloudRef.current) {
      cloudRef.current.rotation.y += 0.00000001 * timeMult * delta; 
    }
  });

  return (
    <points ref={cloudRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={PARTICLE_COUNT}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#556677" size={5.0} sizeAttenuation />
    </points>
  );
}

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
      <sphereGeometry args={[radius, 14, 14]} />
      <meshBasicMaterial
        color="#ffffff"
        wireframe={true}
        transparent={true}
        opacity={0.35}
      />
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
    const time = globalTimeRef.current;
    const [x, y, z] = propagateOrbit(data.elements, time);
    if (ref.current) {
      ref.current.position.set(x * orbitScale, y * orbitScale, z * orbitScale);
      // Rotation based on period
      const rotationSpeed = (2 * Math.PI) / (data.elements.siderealRotation || data.elements.period);
      ref.current.rotation.y = time * rotationSpeed;
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
  orbitPathsVisible = true,
  planetaryLabelsVisible = true,
}: {
  data: (typeof PLANETS)[0];
  globalTimeRef: React.MutableRefObject<number>;
  onDoubleClick?: (name: string) => void;
  launchParams?: any;
  orbitPathsVisible?: boolean;
  planetaryLabelsVisible?: boolean;
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
      pts.push(new THREE.Vector3(x * POS_SCALE, z * POS_SCALE, -y * POS_SCALE));
    }
    return pts;
  }, [data.elements]);

  useFrame((state, delta) => {
    const time = globalTimeRef.current;
    const [x, y, z] = propagateOrbit(data.elements, time);
    if (ref.current) {
      ref.current.position.set(x * POS_SCALE, z * POS_SCALE, -y * POS_SCALE);
      // Accurate sidereal rotation
      const daySeconds = (data as any).siderealDay || 86164; // seconds
      ref.current.rotation.y = (time / daySeconds) * Math.PI * 2;
    }
  });

  return (
    <group>
      {/* Orbit Line */}
      {orbitPathsVisible && (
        <Line
          points={orbitPoints}
          color={data.color}
          opacity={0.2}
          transparent
          lineWidth={1}
        />
      )}

      {/* Planet Model */}
      <group 
        ref={ref}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (onDoubleClick) onDoubleClick(data.name);
        }}
      >
        {data.name === "Earth" && launchParams && launchParams.launchPlanet === "Earth" && (!launchParams.targetPlanet || launchParams.targetPlanet === "Earth") && (
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
        {planetaryLabelsVisible && (
          <Html
            distanceFactor={100}
            zIndexRange={[100, 0]}
            className="pointer-events-none"
            wrapperClass="pointer-events-none"
          >
            <div className="text-[10px] uppercase font-bold text-white/50 tracking-widest translate-x-3 translate-y-3 drop-shadow-md">
              {data.name}
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

function GhostPath({ 
  launchParams, 
  globalTimeRef, 
  onStatusUpdate, 
  onDoubleClick, 
  onPointsCalculated,
  onCalculating
}: { 
  launchParams: any, 
  globalTimeRef: any, 
  onStatusUpdate?: (s: string | null) => void, 
  onDoubleClick?: (label: string, ref: any) => void,
  onPointsCalculated?: (pts: THREE.Vector3[], isReturn: boolean) => void,
  onCalculating?: (c: boolean) => void
}) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const shuttleRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const launchTimeRef = useRef<number | null>(null);
  const captureTimeRef = useRef<number | null>(null);
  const transferTimeRef = useRef<number>(1000);
  const simDurationRef = useRef<number>(1000);
  const captureInfoRef = useRef<{status?: string, altitude?: number, period?: number, isOvershot?: boolean, remainingDeltaV?: number, reachedTarget?: boolean, capturePossible?: boolean}>({});
  const requiredDVRef = useRef<number>(0);
  const fuelRef = useRef<number>(100); // %
  const [status, setStatus] = useState<string>("Standby");
  const [isCalculating, setIsCalculating] = useState(false);
  const [daysPassed, setDaysPassed] = useState<number>(0);
  const [stayTimeDays, setStayTimeDays] = useState<number>(0);
  const [interceptPoint, setInterceptPoint] = useState<THREE.Vector3 | null>(null);
  const [reachedDestination, setReachedDestination] = useState(false);
  const lastCalcTime = useRef(0);
  const lastStatusRef = useRef<string | null>(null);
  const lastTargetPlanetRef = useRef<string | null>(null);
  const lastMissionLegsRef = useRef<any>(null);

  const calculateInterplanetaryPath = useCallback(async () => {
    if (!launchParams) return;
    if (!launchParams.targetPlanet && !launchParams.missionLegs) return;
    
    const time = globalTimeRef.current;
    let targetName = launchParams.targetPlanet;
    const launchPlanet = launchParams.launchPlanet || "Earth";
    
    if (launchParams.missionLegs && launchParams.missionLegs.length > 0) {
      const legs = launchParams.missionLegs;
      const lastDestId = legs[legs.length - 1].destId;
      const planetMap = { 1: 'Mercury', 2: 'Venus', 3: 'Earth', 4: 'Mars', 5: 'Jupiter', 6: 'Saturn', 7: 'Uranus', 8: 'Neptune' } as Record<number, string>;
      targetName = planetMap[lastDestId];
    }
    
    if (!targetName) return;
    const targetPlanet = PLANETS.find(p => p.name === targetName);
    if (!targetPlanet) return;
    
    setIsCalculating(true);
    if(onCalculating) onCalculating(true);
    try {
      const payload = { 
        launchPlanet, 
        targetPlanet: targetName, 
        globalTime: time, 
        launchTime: (launchParams.launchDay_j2000 || time),
        tof1: launchParams.missionLegs?.[0]?.tof_days || 0,
        tof2: launchParams.missionLegs?.[1]?.tof_days || 0
      };
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) return;
      const data = await response.json();
      
      requiredDVRef.current = data.dvLabel;
      transferTimeRef.current = data.arrivalTime - payload.launchTime;
      simDurationRef.current = data.usedDuration || (data.arrivalTime - payload.launchTime);
      captureInfoRef.current = { 
          status: data.missionStatus, 
          altitude: data.captureAltitude, 
          period: data.orbitPeriod, 
          reachedTarget: data.reachedTarget, 
          capturePossible: data.capturePossible,
          remainingDeltaV: data.remainingDeltaV 
      };
      
      const threePoints = data.points
        .filter((p: any) => p && Array.isArray(p) && p.length >= 3 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]))
        .map((p: any) => new THREE.Vector3(p[0] * 1000 * POS_SCALE, p[2] * 1000 * POS_SCALE, -p[1] * 1000 * POS_SCALE));
      
      setPoints(threePoints);
      setStatus("Transfer Optimized");
      
      if (onPointsCalculated) {
        const isReturn = (launchPlanet !== "Earth" || targetName === "Earth");
        onPointsCalculated(threePoints, isReturn);
      }
      
      const [ix, iy, iz] = propagateOrbit(targetPlanet.elements, data.arrivalTime);
      setInterceptPoint(new THREE.Vector3(ix * POS_SCALE, iz * POS_SCALE, -iy * POS_SCALE));
    } catch (err) {
      console.error("Backend calculation failed:", err);
    } finally {
      setIsCalculating(false);
      if(onCalculating) onCalculating(false);
    }
  }, [launchParams]);

  useEffect(() => {
    if (!launchParams) return;

    const legsChanged = JSON.stringify(launchParams.missionLegs) !== JSON.stringify(lastMissionLegsRef.current);
    const targetChanged = launchParams.targetPlanet !== lastTargetPlanetRef.current;

    lastMissionLegsRef.current = launchParams.missionLegs;
    lastTargetPlanetRef.current = launchParams.targetPlanet;

    const isInterplanetary = (launchParams.targetPlanet && launchParams.targetPlanet !== (launchParams.launchPlanet || "Earth")) || !!launchParams.missionLegs;

    if (legsChanged || targetChanged) {
      launchTimeRef.current = null;
      progressRef.current = 0;
      setReachedDestination(false);
      setStatus("Standby");
      
      const isPlanningReturn = launchParams.launchPlanet && launchParams.launchPlanet !== "Earth" && launchParams.targetPlanet === "Earth";
      if (isPlanningReturn) {
        const orbitStatus = `${launchParams.launchPlanet.toUpperCase()}_ORBIT`;
        lastStatusRef.current = orbitStatus;
        if (onStatusUpdate) onStatusUpdate(orbitStatus);
      } else {
        lastStatusRef.current = "Standby";
        if (onStatusUpdate) onStatusUpdate("Standby");
      }
    }

    if (!launchParams.isLaunched) {
      if (isInterplanetary) {
        calculateInterplanetaryPath();
        return;
      }
    } else if (points.length > 0) {
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
          params: { 
            v0, 
            pitch, 
            yaw, 
            nbody, 
            startLat, 
            startLon, 
            targetLat, 
            targetLon, 
            targetPlanet,
            launchPlanet: launchParams.launchPlanet || "Earth"
          }
        });
        if (res.data.path) {
          const visualRadius = Math.max(0.4, Math.log10(6371) * 0.4);
          const orbitPoints = res.data.path.map((p: number[]) =>
            new THREE.Vector3(
              (p[0] / 6371.0) * visualRadius * 1.05,
              (p[2] / 6371.0) * visualRadius * 1.05,
              -(p[1] / 6371.0) * visualRadius * 1.05
            )
          );
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

      // Only recalculate interplanetary path when parameters change to prevent UI blinking
      // The path will remain static relative to the current launch window until launched.
      return;
    }

    if (points.length === 0 || !shuttleRef.current) return;
    
    if (launchTimeRef.current === null) {
      launchTimeRef.current = globalTimeRef.current;
    }

    const timeMult = launchParams.timeMult || 1;
    const maxIdx = points.length - 1;

    const isInterplanetary = (launchParams.targetPlanet && launchParams.targetPlanet !== (launchParams.launchPlanet || "Earth")) || !!launchParams.missionLegs;
    if (isInterplanetary) {
      const elapsed = globalTimeRef.current - launchTimeRef.current;
      const pct_sim = Math.max(0, Math.min(1.0, elapsed / simDurationRef.current));
      progressRef.current = pct_sim * maxIdx;
      
      const nextDaysPassed = Math.floor(elapsed / 86400);
      setDaysPassed((prev) => (prev !== nextDaysPassed ? nextDaysPassed : prev));
      
      const pct_tof = elapsed / transferTimeRef.current;
      const arrived = pct_tof >= 1.0;
      setReachedDestination((prev) => (prev !== arrived ? arrived : prev));
      
      let targetStatus = "Inertial Cruise";
      const MAX_DV = 350.0 * 9.80665 * Math.log(9000.0 / 1000.0);

      if (pct_tof < 0.05) {
        targetStatus = "Main Engine Burn";
        const startBurnPct = 100;
        const endBurnPct = Math.max(0, ((MAX_DV - requiredDVRef.current) / MAX_DV) * 100.0);
        fuelRef.current = startBurnPct - (startBurnPct - endBurnPct) * (pct_tof / 0.05);
      } else if (pct_tof >= 0.98 && captureInfoRef.current.status) {
        targetStatus = captureInfoRef.current.status;
        const finalFuelPct = Math.max(0, ((captureInfoRef.current.remainingDeltaV ?? 0) / MAX_DV) * 100.0);
        fuelRef.current = finalFuelPct;
        if (!captureTimeRef.current) {
          captureTimeRef.current = globalTimeRef.current;
        }
        const nextStayTime = Math.floor((globalTimeRef.current - captureTimeRef.current) / 86400);
        setStayTimeDays((prev) => (prev !== nextStayTime ? nextStayTime : prev));
      } else {
        targetStatus = "Inertial Cruise";
        const cruiseFuelPct = Math.max(0, ((MAX_DV - requiredDVRef.current) / MAX_DV) * 100.0);
        fuelRef.current = cruiseFuelPct;
        captureTimeRef.current = null;
      }

      setStatus((prev) => (prev !== targetStatus ? targetStatus : prev));

      if (lastStatusRef.current !== targetStatus) {
        lastStatusRef.current = targetStatus;
        if (onStatusUpdate) onStatusUpdate(targetStatus);
      }
    } else {
      // Shuttle movement. If we have lots of points (LEO backend), speed needs to be faster
      const baseSpeed = 20.0; 
      progressRef.current += delta * timeMult * baseSpeed;
    }
    
    let targetName = launchParams.targetPlanet;
    if (targetName === "Earth" && launchParams.launchPlanet === "Earth") targetName = "";
    if (launchParams.missionLegs && launchParams.missionLegs.length > 0) {
      const legs = launchParams.missionLegs;
      const lastDestId = legs[legs.length - 1].destId;
      const planetMap = { 1: 'Mercury', 2: 'Venus', 3: 'Earth', 4: 'Mars', 5: 'Jupiter', 6: 'Saturn', 7: 'Uranus', 8: 'Neptune' } as Record<number, string>;
      targetName = planetMap[lastDestId];
    }
    const targetPlanet = PLANETS.find(p => p.name === targetName);

    const elapsed = globalTimeRef.current - (launchTimeRef.current || globalTimeRef.current);
    const pct_tof = elapsed / transferTimeRef.current;

    if (pct_tof >= 1.0 && targetPlanet && (targetPlanet.name !== "Earth" || launchParams.launchPlanet !== "Earth")) {
      const time = globalTimeRef.current;
      const [tpX, tpY, tpZ] = propagateOrbit(targetPlanet.elements, time);
      
      // Let shuttle orbit the target planet so it is visibly locked to it!
      const orbitalRadius = 1.2;
      const ang = (time / 86400) * 0.5; // Slow rotation
      const ox = Math.cos(ang) * orbitalRadius;
      const oz = Math.sin(ang) * orbitalRadius;
      
      shuttleRef.current.position.set(
        tpX * POS_SCALE + ox,
        tpZ * POS_SCALE,
        -tpY * POS_SCALE + oz
      );
      
      // Orient the shuttle tangent to its captured orbital trajectory
      const nextAng = ang + 0.01;
      const nox = Math.cos(nextAng) * orbitalRadius;
      const noz = Math.sin(nextAng) * orbitalRadius;
      const nextPos = new THREE.Vector3(tpX * POS_SCALE + nox, tpZ * POS_SCALE, -tpY * POS_SCALE + noz);
      shuttleRef.current.lookAt(nextPos);
    } else {
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
    }
  });

  if (points.length < 2) return null;

  return (
    <group>
      <Line
        points={points}
        color={launchParams?.isLaunched ? "#ff4444" : "#00ffff"}
        lineWidth={1.5}
        transparent
        opacity={reachedDestination ? 0.0 : (launchParams?.isLaunched ? 0.7 : 0.4)}
        dashed={true}
        dashScale={50}
        dashSize={1}
        gapSize={1}
      />
      
      {interceptPoint && !launchParams?.isLaunched && (
        <group position={interceptPoint}>
          <mesh>
            <ringGeometry args={[0.3, 0.5, 32]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
          <Html distanceFactor={20} position={[0, -0.6, 0]}>
            <div className="bg-black/80 px-2 py-1 rounded border border-cyan-500/50 text-[6px] whitespace-nowrap text-cyan-400 font-mono uppercase tracking-widest shadow-lg">
              Intercept Lock
            </div>
          </Html>
        </group>
      )}

      {launchParams?.isLaunched && points.length > 0 && (
        <group ref={shuttleRef} position={points[0]} name="ODYSSEY_ACTIVE_SHUTTLE">
           <mesh 
             rotation={[Math.PI / 2, 0, 0]}
             onDoubleClick={(e) => {
               e.stopPropagation();
               onDoubleClick?.("ODYSSEY ACTIVE", shuttleRef);
             }}
           >
             <coneGeometry args={[0.1, 0.3, 16]} />
             <meshStandardMaterial color="#ffffff" emissive="#ff4444" emissiveIntensity={0.8} />
           </mesh>
           
           {/* Thruster Flame effect while burning */}
           {status.includes("Burn") && (
             <mesh position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
               <coneGeometry args={[0.07, 0.4, 8]} />
               <meshStandardMaterial color="#ffff00" emissive="#ff8800" emissiveIntensity={2.0} transparent opacity={0.8} />
             </mesh>
           )}

           {/* removed red pointlight */}
            <Html distanceFactor={20} position={[0, 0.5, 0]}>
              <div className="bg-black/80 px-2 py-1 rounded border border-red-500/50 flex flex-col gap-0.5 shadow-lg min-w-[80px]">
                <div className="text-[7px] text-white/50 font-mono uppercase tracking-tighter">Status</div>
                <div className="text-[9px] text-white font-mono uppercase font-bold tracking-tight">{status}</div>
                {status.includes("ORBIT") && captureInfoRef.current.altitude && (
                  <div className="flex flex-col gap-0 font-mono uppercase mt-0.5 mb-0.5 bg-white/5 px-1 py-0.5 rounded">
                    <div className="text-[6px] text-zinc-400">ALTITUDE: <span className="text-cyan-400">{Math.round(captureInfoRef.current.altitude).toLocaleString()} KM</span></div>
                    <div className="text-[6px] text-zinc-400">PERIOD: <span className="text-cyan-400">{captureInfoRef.current.period?.toFixed(1)} DAYS</span></div>
                    <div className="text-[6px] text-zinc-400">STAY TIME: <span className="text-orange-400">{stayTimeDays} DAYS</span></div>
                  </div>
                )}
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[7px] text-white/50 font-mono">T+ {daysPassed} Days</span>
                  <span className="text-[7px] text-red-400 font-mono font-bold">{Math.round(fuelRef.current)}%</span>
                </div>
                <div className="w-full h-0.5 bg-white/10 mt-0.5 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${fuelRef.current}%` }}></div>
                </div>
              </div>
            </Html>
        </group>
      )}
    </group>
  );
}

function OrbitingShuttle({ 
  planetName, 
  globalTimeRef 
}: { 
  planetName: string, 
  globalTimeRef: React.MutableRefObject<number> 
}) {
  const ref = useRef<THREE.Group>(null);
  const planet = PLANETS.find(p => p.name.toUpperCase() === planetName.toUpperCase());

  useFrame(() => {
    if (!planet || !ref.current) return;
    const time = globalTimeRef.current;
    const [pX, pY, pZ] = propagateOrbit(planet.elements, time);
    const orbitalRadius = 1.2;
    const ang = (time / 86400) * 0.5;
    const ox = Math.cos(ang) * orbitalRadius;
    const oz = Math.sin(ang) * orbitalRadius;
    
    ref.current.position.set(
      pX * POS_SCALE + ox,
      pZ * POS_SCALE,
      -pY * POS_SCALE + oz
    );
    
    const nextAng = ang + 0.01;
    const nox = Math.cos(nextAng) * orbitalRadius;
    const noz = Math.sin(nextAng) * orbitalRadius;
    const nextLocalPos = new THREE.Vector3(pX * POS_SCALE + nox, pZ * POS_SCALE, -pY * POS_SCALE + noz);
    
    ref.current.lookAt(nextLocalPos);
  });

  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 8]} />
        <meshStandardMaterial color="#00ffcc" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Solar panels */}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[0.8, 0.02, 0.2]} />
        <meshStandardMaterial color="#112244" roughness={0.5} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.8, 0.02, 0.2]} />
        <meshStandardMaterial color="#112244" roughness={0.5} metalness={0.9} />
      </mesh>
      <Html distanceFactor={20} position={[0, 0.5, 0]}>
        <div className="bg-black/80 px-2 py-0.5 rounded border border-cyan-500/30 flex flex-col gap-0 shadow-lg min-w-[70px]">
          <div className="text-[6px] text-zinc-400 font-mono tracking-tighter uppercase whitespace-nowrap">ODYSSEY ACTIVE</div>
          <div className="text-[8px] text-cyan-400 font-mono font-bold tracking-tight uppercase whitespace-nowrap">{planetName.toUpperCase()} ORBIT</div>
        </div>
      </Html>
    </group>
  );
}

function ArchivedShuttle({ mission, globalTimeRef, onDoubleClick }: { mission: any, globalTimeRef: React.MutableRefObject<number>, onDoubleClick?: (label: string, ref: any) => void }) {
  const launchPts = mission.launchPoints || [];
  const returnPts = mission.returnPoints || [];

  return (
    <group>
      {/* Historical Outbound Trajectory */}
      {launchPts.length > 0 && (
        <Line 
          points={launchPts}
          color="#00ff55"
          opacity={0.3}
          transparent
          lineWidth={2.5}
        />
      )}
      {/* Historical Return Trajectory */}
      {returnPts.length > 0 && (
        <Line 
          points={returnPts}
          color="#ff3366"
          opacity={0.3}
          transparent
          lineWidth={2.5}
        />
      )}
    </group>
  );
}

function EclipticGrid() {
  const rings = [0.387, 0.723, 1.0, 1.524, 2.77, 5.204, 9.582, 19.201, 30.047]; // mercury, venus, earth, mars, asteroid belt center, jupiter, saturn, uranus, neptune
  const circlePoints = useMemo(() => {
    return rings.map(auDist => {
      const radius = auDist * 100;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 100; i++) {
        const theta = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
      }
      return { dist: auDist, points: pts };
    });
  }, []);

  const radialLines = useMemo(() => {
    const lines: THREE.Vector3[][] = [];
    const maxRadius = 31 * 100; // outward to Neptune
    for (let i = 0; i < 12; i++) {
      const theta = (i / 12) * Math.PI * 2;
      const x = Math.cos(theta) * maxRadius;
      const z = Math.sin(theta) * maxRadius;
      lines.push([new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, 0, z)]);
    }
    return lines;
  }, []);

  return (
    <group>
      {/* Concentric ecliptic reference rings */}
      {circlePoints.map((ring, idx) => (
        <group key={idx}>
          <Line
            points={ring.points}
            color="#ffffff"
            opacity={0.04}
            transparent
            lineWidth={0.5}
          />
          {ring.dist <= 10 && (
            <Html
              position={[ring.dist * 100, 0, 0]}
              distanceFactor={180}
              className="pointer-events-none select-none"
              wrapperClass="pointer-events-none select-none"
            >
              <span className="text-[7px] text-white/20 font-mono tracking-widest whitespace-nowrap">
                {ring.dist.toFixed(2)} AU
              </span>
            </Html>
          )}
        </group>
      ))}

      {/* Radial right ascension guidelines */}
      {radialLines.map((line, idx) => (
        <Line
          key={idx}
          points={line}
          color="#ffffff"
          opacity={0.015}
          transparent
          lineWidth={0.5}
        />
      ))}
    </group>
  );
}

function SystemEngine({
  timeMult,
  selectedTarget,
  launchParams,
  globalTimeRef,
  onPlanetDoubleClick,
  onStatusUpdate,
  completedMissions,
  archivedMissions = [],
  activeReplay,
  orbitPathsVisible = true,
  planetaryLabelsVisible = true,
  followSpacecraft = false,
  cameraPresetToLoad = null,
  cameraPresetToSave = null,
  resetCameraTrigger = 0,
  onPointsCalculated,
  onCalculating,
  isCinematic = false,
  cinematicScrollRef
}: {
  timeMult: number;
  selectedTarget: (typeof PLANETS)[0] | null;
  launchParams?: any;
  globalTimeRef: React.MutableRefObject<number>;
  onPlanetDoubleClick?: (name: string) => void;
  onStatusUpdate?: (status: string | null) => void;
  completedMissions?: number;
  archivedMissions?: any[];
  orbitPathsVisible?: boolean;
  planetaryLabelsVisible?: boolean;
  followSpacecraft?: boolean;
  cameraPresetToLoad?: number | null;
  cameraPresetToSave?: number | null;
  resetCameraTrigger?: number;
  activeReplay?: any;
  onPointsCalculated?: (pts: THREE.Vector3[], isReturn: boolean) => void;
  onCalculating?: (c: boolean) => void;
  isCinematic?: boolean;
  cinematicScrollRef?: React.MutableRefObject<number>;
}) {
  const controlsRef = useRef<any>(null);
  const currentTargetName = useRef(selectedTarget?.name || "Sun");
  const lastActiveTargetPosRef = useRef<THREE.Vector3 | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [realTimeSeconds, setRealTimeSeconds] = useState(0);

  const spectatingObjRef = useRef<THREE.Object3D | null>(null);
  const [spectatedLabel, setSpectatedLabel] = useState<string | null>(null);
  const smoothedScrollRef = useRef(0);

  const handleShuttleDoubleClick = (label: string, ref: any) => {
    spectatingObjRef.current = ref.current;
    setSpectatedLabel(label);
    setIsLocked(true);
  };

  const { camera, scene } = useThree();
  const presetsRef = useRef<Record<number, { position: THREE.Vector3, target: THREE.Vector3 }>>({});

  useEffect(() => {
    // Sync to J2000 real time
    globalTimeRef.current = getJ2000Time(Date.now() / 1000);
  }, []);

  // Auto-lock when target changes
  useEffect(() => {
    setIsLocked(true);
    setSpectatedLabel(null);

    if (!isCinematic) {
      let targetPos = new THREE.Vector3(0, 0, 0);
      if (selectedTarget) {
        const [x, y, z] = propagateOrbit(selectedTarget.elements, globalTimeRef.current);
        targetPos.set(x * POS_SCALE, z * POS_SCALE, -y * POS_SCALE);
      }
      camera.position.set(targetPos.x, targetPos.y + 150, targetPos.z + 400);
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetPos);
        controlsRef.current.update();
      }
    }
  }, [selectedTarget, isCinematic, camera]);

  // Save preset trigger
  useEffect(() => {
    if (cameraPresetToSave !== null && cameraPresetToSave !== undefined && controlsRef.current) {
      presetsRef.current[cameraPresetToSave] = {
        position: camera.position.clone(),
        target: controlsRef.current.target.clone()
      };
    }
  }, [cameraPresetToSave, camera]);

  // Load preset trigger
  useEffect(() => {
    if (cameraPresetToLoad !== null && cameraPresetToLoad !== undefined && controlsRef.current) {
      const saved = presetsRef.current[cameraPresetToLoad];
      if (saved) {
        camera.position.copy(saved.position);
        controlsRef.current.target.copy(saved.target);
        controlsRef.current.update();
      }
    }
  }, [cameraPresetToLoad, camera]);

  // Reset camera trigger
  useEffect(() => {
    if (resetCameraTrigger && resetCameraTrigger > 0 && controlsRef.current) {
      camera.position.set(0, 150, 400);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [resetCameraTrigger, camera]);

  // Handle transition from landing-page cinematic mode back to engine mode
  useEffect(() => {
    if (!isCinematic) {
      let targetPos = new THREE.Vector3(0, 0, 0);
      if (selectedTarget) {
        const [x, y, z] = propagateOrbit(selectedTarget.elements, globalTimeRef.current);
        targetPos.set(x * POS_SCALE, z * POS_SCALE, -y * POS_SCALE);
      }
      camera.position.set(targetPos.x, targetPos.y + 150, targetPos.z + 400);
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetPos);
        controlsRef.current.update();
      }
      setIsLocked(true);
    }
  }, [isCinematic, selectedTarget, camera]);

  useFrame((state, delta) => {
    // Limit delta to prevent huge jumps from tab switching
    const safeDelta = Math.min(delta, 0.1);

    if (isCinematic && cinematicScrollRef) {
      // Time-Warp Scroll
      const rawS = cinematicScrollRef.current;
      
      // Smooth the scroll target
      const lerpSpeed = 1 - Math.exp(-safeDelta * 3);
      smoothedScrollRef.current += (rawS - smoothedScrollRef.current) * lerpSpeed;
      const s = smoothedScrollRef.current;

      // J2000 epoch + base offset
      const baseJ2000 = (new Date("2020-01-01T00:00:00Z").getTime() - new Date("2000-01-01T12:00:00Z").getTime()) / 1000;
      globalTimeRef.current = baseJ2000 + s * (365 * 24 * 3600) * 1.5; // Simulate 1.5 years across the scroll

      // Compute exact planet coordinates for no-lag targeting
      const pE = propagateOrbit(PLANETS.find(p => p.name === "Earth")!.elements, globalTimeRef.current);
      const tpE = new THREE.Vector3(pE[0]*POS_SCALE, pE[2]*POS_SCALE, -pE[1]*POS_SCALE);
      
      const pM = propagateOrbit(PLANETS.find(p => p.name === "Mars")!.elements, globalTimeRef.current);
      const tpM = new THREE.Vector3(pM[0]*POS_SCALE, pM[2]*POS_SCALE, -pM[1]*POS_SCALE);

      // Camera Choreography
      let camPos = new THREE.Vector3();
      let camLook = new THREE.Vector3();

      if (s < 0.2) {
        // Blueprint view
        camPos.set(0, 400, 0);
        camLook.set(0, 0, 0);
      } else if (s < 0.4) {
        // Transition: Blueprint -> Earth
        const t = (s - 0.2) / 0.2;
        const ease = t * t * (3 - 2 * t);
        camPos.set(0, 400, 0).lerp(new THREE.Vector3(tpE.x + 15, tpE.y + 5, tpE.z + 15), ease);
        camLook.set(0, 0, 0).lerp(tpE, ease);
      } else if (s < 0.6) {
        // Track Earth exactly
        camPos.set(tpE.x + 15, tpE.y + 5, tpE.z + 15);
        camLook.copy(tpE);
      } else if (s < 0.8) {
        // Transition: Earth -> Mars
        const t = (s - 0.6) / 0.2;
        const ease = t * t * (3 - 2 * t);
        camPos.set(tpE.x + 15, tpE.y + 5, tpE.z + 15).lerp(new THREE.Vector3(tpM.x + 20, tpM.y + 10, tpM.z + 20), ease);
        camLook.copy(tpE).lerp(tpM, ease);
      } else {
        // Track Mars exactly
        camPos.set(tpM.x + 20, tpM.y + 10, tpM.z + 20);
        camLook.copy(tpM);
      }

      state.camera.position.copy(camPos);
      if (controlsRef.current) {
        controlsRef.current.target.copy(camLook);
      }

      if (controlsRef.current) {
        controlsRef.current.update();
      }

    } else {
      globalTimeRef.current += safeDelta * timeMult;

      // Follow spacecraft tracking
      if (followSpacecraft) {
        const activeShuttle = scene.getObjectByName("ODYSSEY_ACTIVE_SHUTTLE");
        if (activeShuttle) {
          spectatingObjRef.current = activeShuttle;
          if (spectatedLabel !== "ODYSSEY ACTIVE") {
            setSpectatedLabel("ODYSSEY ACTIVE");
          }
          setIsLocked(true);
        }
      } else if (spectatedLabel === "ODYSSEY ACTIVE") {
        setSpectatedLabel(null);
      }

      if (controlsRef.current) {
        let activeTargetPos = new THREE.Vector3(0, 0, 0);

        if (spectatedLabel && spectatingObjRef.current) {
          spectatingObjRef.current.getWorldPosition(activeTargetPos);
        } else if (selectedTarget) {
          const [x, y, z] = propagateOrbit(
            selectedTarget.elements,
            globalTimeRef.current,
          );
          activeTargetPos.set(x * POS_SCALE, z * POS_SCALE, -y * POS_SCALE);
        }

        const targetName = spectatedLabel || (selectedTarget ? selectedTarget.name : "Sun");
        const targetChanged = currentTargetName.current !== targetName;

        if (targetChanged) {
          currentTargetName.current = targetName;
          lastActiveTargetPosRef.current = activeTargetPos.clone();
        }

        let displacement = new THREE.Vector3(0, 0, 0);
        if (lastActiveTargetPosRef.current && !targetChanged) {
          displacement.copy(activeTargetPos).sub(lastActiveTargetPosRef.current);
        }

        // Apply orbital motion translation displacement to track perfectly
        controlsRef.current.target.add(displacement);
        state.camera.position.add(displacement);

        // If locked to target, smoothly slide the target centered (correcting any manual panning)
        if (isLocked) {
          const lerpFactor = 1 - Math.exp(-safeDelta * 6);
          const beforeLerp = controlsRef.current.target.clone();
          controlsRef.current.target.lerp(activeTargetPos, lerpFactor);
          const correction = controlsRef.current.target.clone().sub(beforeLerp);
          state.camera.position.add(correction);
        }

        // Cache position for next frame
        lastActiveTargetPosRef.current = activeTargetPos.clone();
      }

      // CRITICAL camera fix: controls update must be called after modifications and for damping every frame
      if (controlsRef.current) {
        controlsRef.current.update();
      }
    }
  });

  const showOrbitingShuttle = !launchParams?.isLaunched && launchParams?.missionStatus && launchParams.missionStatus.endsWith("_ORBIT") && launchParams.missionStatus !== "EARTH_ORBIT";
  const orbPlanetName = showOrbitingShuttle ? launchParams.missionStatus.replace("_ORBIT", "") : "";

  return (
    <>
      {/* UI Controls overlay inside the 3D scene */}
      <Html fullscreen className="pointer-events-none" wrapperClass="pointer-events-none">
        <div className="absolute top-24 left-8 pointer-events-auto flex flex-col gap-2">
          {/* Date and Time Header */}
          <div className="flex items-center gap-4 py-2 opacity-80 pl-16">
            <div className="flex flex-col">
              <span className="text-[9px] text-[#8ab4f8] font-mono tracking-[0.25em] uppercase pb-1">Epoch Reference</span>
              <span className="text-[13px] text-white font-mono tracking-wider">
                {new Date((J2000_UNIX + globalTimeRef.current) * 1000).toUTCString().split(' ').slice(0, 4).join(' ')}
              </span>
            </div>
            <div className="w-[1px] h-6 bg-white/20 mx-2"></div>
            <div className="flex flex-col">
              <span className="text-[9px] text-[#8ab4f8] font-mono tracking-[0.25em] uppercase pb-1">Mission Time</span>
              <span className="text-[13px] text-white font-mono tracking-wider">
                {new Date((J2000_UNIX + globalTimeRef.current) * 1000).toUTCString().split(' ')[4]}
              </span>
            </div>
          </div>

          {!isLocked && (
            <button 
              onClick={() => setIsLocked(true)}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[9px] font-mono tracking-widest rounded-lg flex items-center gap-2 group transition-all self-start cursor-pointer transition-colors duration-200"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse group-hover:scale-125"></div>
              RE-LOCK CAMERA TO {spectatedLabel ? spectatedLabel : (selectedTarget ? selectedTarget.name.toUpperCase() : "SOL")}
            </button>
          )}
          {isLocked && (
            <div className="px-3 py-1 bg-[#0a0a0c]/95 border border-white/10 text-white/50 text-[9px] font-mono tracking-widest rounded-lg flex items-center gap-2 self-start backdrop-blur-md">
              <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div>
              CAMERA TRACKING {spectatedLabel ? spectatedLabel : (selectedTarget ? selectedTarget.name.toUpperCase() : "SOL")}
              <span className="ml-2 text-[8px] opacity-30">(DRAG TO UNLOCK)</span>
            </div>
          )}
        </div>
      </Html>

      {/* The Sun with additive corona layers */}
      <group>
        {/* Core */}
        <mesh>
          <sphereGeometry args={[SUN_SIZE, 14, 14]} />
          <meshBasicMaterial color="#ffffff" wireframe={true} transparent opacity={0.65} />
        </mesh>
        {/* Tight glow of the sun */}
        <mesh>
          <sphereGeometry args={[SUN_SIZE * 1.5, 12, 12]} />
          <meshBasicMaterial 
            color="#ffffff" 
            wireframe={true}
            transparent 
            opacity={0.25} 
          />
        </mesh>
        {/* Wide atmosphere corona */}
        <group>
          <mesh>
            <sphereGeometry args={[SUN_SIZE * 2.2, 10, 10]} />
            <meshBasicMaterial 
              color="#ffffff" 
              wireframe={true}
              transparent 
              opacity={0.08} 
            />
          </mesh>
        </group>
        <Html distanceFactor={100} className="pointer-events-none" wrapperClass="pointer-events-none">
          <div className="text-xs uppercase font-bold text-[#facc15] tracking-widest translate-x-4 drop-shadow-[0_0_10px_rgba(234,179,8,0.6)] font-mono">
            SUN
          </div>
        </Html>
      </group>

      {/* Astronomical reference plane J2000 Keplerian grid */}
      <EclipticGrid />

      <AsteroidBelt timeMult={timeMult} />
      <KuiperBelt timeMult={timeMult} />

      {PLANETS.map((p) => (
        <Planet 
          key={p.name} 
          data={p} 
          globalTimeRef={globalTimeRef} 
          onDoubleClick={onPlanetDoubleClick} 
          launchParams={launchParams} 
          orbitPathsVisible={orbitPathsVisible}
          planetaryLabelsVisible={planetaryLabelsVisible}
        />
      ))}

      <React.Fragment>
        {activeReplay ? (
          <ArchivedShuttle mission={activeReplay} globalTimeRef={globalTimeRef} onDoubleClick={handleShuttleDoubleClick} />
        ) : null}
      </React.Fragment>

      {showOrbitingShuttle && orbPlanetName && (
        <OrbitingShuttle planetName={orbPlanetName} globalTimeRef={globalTimeRef} />
      )}

      {launchParams && ((launchParams.targetPlanet && launchParams.targetPlanet !== (launchParams.launchPlanet || "Earth")) || launchParams.missionLegs) && (
        <GhostPath 
          launchParams={launchParams} 
          globalTimeRef={globalTimeRef} 
          onStatusUpdate={onStatusUpdate} 
          onDoubleClick={handleShuttleDoubleClick} 
          onPointsCalculated={onPointsCalculated}
          onCalculating={onCalculating}
        />
      )}

      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        autoRotate={false}
        enableDamping={true}
        dampingFactor={0.05}
        maxDistance={2000000}
        onStart={() => setIsLocked(false)}
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
  globalTimeRef,
  onPlanetDoubleClick,
  onStatusUpdate,
  completedMissions = 0,
  archivedMissions = [],
  activeReplay,
  orbitPathsVisible = true,
  planetaryLabelsVisible = true,
  followSpacecraft = false,
  cameraPresetToLoad = null,
  cameraPresetToSave = null,
  resetCameraTrigger = 0,
  onPointsCalculated,
  isCinematic = false,
  cinematicScrollRef
}: {
  isRunning?: boolean;
  timeMult?: number;
  selectedTarget: (typeof PLANETS)[0] | null;
  launchParams?: any;
  globalTimeRef?: React.MutableRefObject<number>;
  onPlanetDoubleClick?: (name: string) => void;
  onStatusUpdate?: (status: string | null) => void;
  completedMissions?: number;
  archivedMissions?: any[];
  orbitPathsVisible?: boolean;
  planetaryLabelsVisible?: boolean;
  followSpacecraft?: boolean;
  cameraPresetToLoad?: number | null;
  cameraPresetToSave?: number | null;
  resetCameraTrigger?: number;
  activeReplay?: any;
  onPointsCalculated?: (pts: THREE.Vector3[], isReturn: boolean) => void;
  isCinematic?: boolean;
  cinematicScrollRef?: React.MutableRefObject<number>;
}) {
  const fallbackRef = useRef(0);
  const activeTimeRef = globalTimeRef || fallbackRef;
  const [isCalculating, setIsCalculating] = useState(false);

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-1000 ${isRunning ? "opacity-100 z-25 pointer-events-auto bg-[#03060f]" : "opacity-100 z-[-10] pointer-events-none"}`}
    >
      {isCalculating && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="text-cyan-400 font-mono tracking-widest text-[10px] uppercase bg-black/80 px-4 py-2 border border-cyan-500/30 rounded shadow overflow-hidden relative">
            <div className="absolute inset-0 bg-cyan-500/10 animate-pulse"></div>
            Computing Trajectory...
          </div>
        </div>
      )}
      <Canvas camera={{ position: [0, 150, 400], fov: 45, far: 5000000, near: 0.1 }}>
        <ambientLight intensity={0.15} />
        <hemisphereLight
          color="#0f172a"
          groundColor="#020308"
          intensity={0.65}
        />
        <pointLight
          position={[0, 0, 0]}
          intensity={3.5}
          color="#fffcf5"
          decay={0}
        />

        <SystemEngine 
          timeMult={timeMult} 
          selectedTarget={selectedTarget} 
          launchParams={launchParams}
          globalTimeRef={activeTimeRef}
          onPlanetDoubleClick={onPlanetDoubleClick}
          onStatusUpdate={onStatusUpdate}
          completedMissions={completedMissions}
          archivedMissions={archivedMissions}
          activeReplay={activeReplay}
          orbitPathsVisible={orbitPathsVisible}
          planetaryLabelsVisible={planetaryLabelsVisible}
          followSpacecraft={followSpacecraft}
          cameraPresetToLoad={cameraPresetToLoad}
          cameraPresetToSave={cameraPresetToSave}
          resetCameraTrigger={resetCameraTrigger}
          onPointsCalculated={onPointsCalculated}
          onCalculating={setIsCalculating}
          isCinematic={isCinematic}
          cinematicScrollRef={cinematicScrollRef}
        />

        <Stars
          radius={300000}
          depth={50000}
          count={30000}
          factor={15}
          saturation={0.5}
          fade
        />
      </Canvas>
    </div>
  );
}
