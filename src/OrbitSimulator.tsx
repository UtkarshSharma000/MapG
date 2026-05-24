import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
  Line,
  Html,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import {
  AU,
  propagateOrbit,
  KeplerianElements,
  getJ2000Time,
  J2000_UNIX,
  getOrbitalVelocity,
  findOptimalTransfer,
  simulateInterplanetaryRK4,
  MU_SUN
} from "./physics";
import { PLANETS } from "./constants";
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
        // FIX: Real J2000 mean anomaly ~135° instead of 0
        M0: (135.27 * Math.PI) / 180,
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
        // TODO: Replace with real J2000 mean anomaly from ephemeris
        M0: (92.0 * Math.PI) / 180,
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
        // TODO: Replace with real J2000 mean anomaly from ephemeris
        M0: (296.0 * Math.PI) / 180,
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
        i: (0.036 * Math.PI) / 180,
        Omega: 0,
        w: 0,
        M0: (84.1 * Math.PI) / 180,
        period: 1.769 * 24 * 3600,
      },
    },
    {
      name: "Ganymede",
      radius: 2634,
      texture: "/textures/2k_mercury.jpg",
      color: "#88ccff",
      elements: {
        a: 1070400 * 1000,
        e: 0.0013,
        i: (0.2 * Math.PI) / 180,
        Omega: 0,
        w: 0,
        M0: (317.5 * Math.PI) / 180,
        period: 7.155 * 24 * 3600,
      },
    },
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
        i: (0.348 * Math.PI) / 180,
        Omega: 0,
        w: 0,
        M0: (167.6 * Math.PI) / 180,
        period: 15.945 * 24 * 3600,
      },
    },
  ],
};

// 1 AU = 100 units in the 3D scene
const POS_SCALE = 100 / AU;
// Sizes are exaggerated for visibility
const PLANET_SIZE_SCALE = 0.0005;
const SUN_SIZE = 5;

// Saturn obliquity in radians (26.73°) — used to tilt ring plane
const SATURN_OBLIQUITY = (26.73 * Math.PI) / 180;

const AsteroidBelt = React.memo(function AsteroidBelt({
  timeMult,
}: {
  timeMult: number;
}) {
  const asteroidsRef = useRef<THREE.Points>(null);
  const ASTEROID_COUNT = 3000;

  const asteroidPositions = useMemo(() => {
    const positions = new Float32Array(ASTEROID_COUNT * 3);
    const GAPS = [2.5, 2.82, 2.95];
    let i = 0;
    while (i < ASTEROID_COUNT) {
      const r = 2.2 + Math.random() * 1.0;
      const inGap = GAPS.some((g) => Math.abs(r - g) < 0.04);
      if (inGap && Math.random() > 0.1) continue;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 0.15 * AU * POS_SCALE;
      positions[i * 3] = r * AU * POS_SCALE * Math.cos(theta);
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = r * AU * POS_SCALE * Math.sin(theta);
      i++;
    }
    return positions;
  }, []);

  useFrame((_, delta) => {
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

const KuiperBelt = React.memo(function KuiperBelt({
  timeMult,
}: {
  timeMult: number;
}) {
  const beltRef = useRef<THREE.Points>(null);
  const PARTICLE_COUNT = 2000;

  const positions = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = 30 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 2.0 * AU * POS_SCALE;
      pos[i * 3] = r * AU * POS_SCALE * Math.cos(theta);
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = r * AU * POS_SCALE * Math.sin(theta);
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (beltRef.current) {
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

// FIX: OortCloud was defined but never rendered — now exported for use in SystemEngine
function OortCloud({ timeMult }: { timeMult: number }) {
  const cloudRef = useRef<THREE.Points>(null);
  const PARTICLE_COUNT = 4000;

  const positions = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = 2000 + Math.random() * 13000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * AU * POS_SCALE * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * AU * POS_SCALE * Math.cos(phi);
      pos[i * 3 + 2] = r * AU * POS_SCALE * Math.sin(phi) * Math.sin(theta);
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
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
  
  // Dynamically scale orbit so it fits visually outside the magnified parent planet mesh
  // parentRadius is already in 3D scene units (exaggerated log scale)
  const orbitScale = (parentRadius * 1.5) / data.elements.a;

  const orbitPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const elements = data.elements;
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * elements.period;
      const [x, y, z] = propagateOrbit(elements, t);
      // FIX: Apply same (x, z, -y) coordinate swap as the rest of the scene
      pts.push(
        new THREE.Vector3(x * orbitScale, z * orbitScale, -y * orbitScale)
      );
    }
    return pts;
  }, [data.elements, orbitScale]);

  useFrame(() => {
    const time = globalTimeRef.current;
    const [x, y, z] = propagateOrbit(data.elements, time);
    if (ref.current) {
      // FIX: Apply (x, z, -y) coordinate swap — previously was (x, y, z) causing wrong plane
      ref.current.position.set(x * orbitScale, z * orbitScale, -y * orbitScale);
      const rotationSpeed =
        (2 * Math.PI) /
        (data.elements.siderealRotation || data.elements.period);
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
}: {
  data: (typeof PLANETS)[0];
  globalTimeRef: React.MutableRefObject<number>;
  onDoubleClick?: (name: string) => void;
  launchParams?: any;
}) {
  const ref = useRef<THREE.Group>(null);
  const radius = Math.max(0.4, Math.log10(data.radius) * 0.4);

  const orbitPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const elements = data.elements;
    for (let i = 0; i <= 500; i++) {
      const t = (i / 500) * elements.period;
      const [x, y, z] = propagateOrbit(elements, t);
      pts.push(new THREE.Vector3(x * POS_SCALE, z * POS_SCALE, -y * POS_SCALE));
    }
    return pts;
  }, [data.elements]);

  useFrame(() => {
    const time = globalTimeRef.current;
    const [x, y, z] = propagateOrbit(data.elements, time);
    if (ref.current) {
      ref.current.position.set(x * POS_SCALE, z * POS_SCALE, -y * POS_SCALE);
      const daySeconds = (data as any).siderealDay || 86164;
      ref.current.rotation.y = (time / daySeconds) * Math.PI * 2;
    }
  });

  return (
    <group>
      <Line
        points={orbitPoints}
        color={data.color}
        opacity={0.2}
        transparent
        lineWidth={1}
      />
      <group
        ref={ref}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (onDoubleClick) onDoubleClick(data.name);
        }}
      >
        {/*
          FIX: GhostPath for LEO (non-interplanetary) trajectories only.
          Added !launchParams.missionLegs guard to prevent dual-mount with the
          system-level GhostPath when missionLegs is active, which was causing
          launchTimeRef to reset mid-flight.
        */}
        {data.name === "Earth" &&
          launchParams &&
          !launchParams.targetPlanet &&
          !launchParams.missionLegs && (
            <GhostPath
              launchParams={launchParams}
              globalTimeRef={globalTimeRef}
            />
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
          /*
            FIX: Saturn ring now tilted by Saturn's obliquity (26.73°) so it lies in
            the equatorial plane rather than flat to the ecliptic.
            Rotation: first 90° around X to lay flat, then obliquity around Z.
          */
          <mesh
            rotation={[
              Math.PI / 2,
              0,
              SATURN_OBLIQUITY,
            ]}
          >
            <ringGeometry args={[radius * 1.2, radius * 2.2, 64]} />
            <SafeTexture
              url="/textures/2k_saturn_ring_alpha.png"
              fallbackColor="#ffffff"
              transparent
              opacity={0.9}
            />
          </mesh>
        )}

        {MOONS[data.name] &&
          MOONS[data.name].map((moon) => (
            <Moon
              key={moon.name}
              data={moon}
              globalTimeRef={globalTimeRef}
              parentRadius={radius}
            />
          ))}

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

// Returns the dynamic ΔV budget for a given target.
// NOTE: This value must also be passed into simulateInterplanetaryRK4 once the
// physics function accepts a maxDeltaV parameter. Currently the physics engine
// hardcodes 3500 m/s internally — update that signature to accept and use this.
function getFuelCapacity(targetName?: string, requiredDV?: number): number {
  let base = 3500.0;
  if (
    targetName &&
    ["Jupiter", "Saturn", "Uranus", "Neptune"].includes(targetName)
  ) {
    base = 15000.0;
  }
  if (requiredDV && requiredDV > base * 0.8) {
    base = Math.ceil((requiredDV * 1.5) / 1000) * 1000;
  }
  return base;
}

function GhostPath({
  launchParams,
  globalTimeRef,
  onStatusUpdate,
}: {
  launchParams: any;
  globalTimeRef: any;
  onStatusUpdate?: (s: string | null) => void;
}) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const shuttleRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const launchTimeRef = useRef<number | null>(null);
  const captureTimeRef = useRef<number | null>(null);
  const transferTimeRef = useRef<number>(1000);
  const simDurationRef = useRef<number>(1000);
  const captureInfoRef = useRef<{
    status?: string;
    altitude?: number;
    period?: number;
    isOvershot?: boolean;
    remainingDeltaV?: number;
  }>({});
  const requiredDVRef = useRef<number>(0);
  const maxDeltaVRef = useRef<number>(3500);
  const fuelRef = useRef<number>(100);

  const abortControllerRef = useRef<AbortController | null>(null);

  const [status, setStatus] = useState<string>("Standby");
  const [daysPassed, setDaysPassed] = useState<number>(0);
  const [stayTimeDays, setStayTimeDays] = useState<number>(0);
  const [interceptPoint, setInterceptPoint] =
    useState<THREE.Vector3 | null>(null);
  const [reachedDestination, setReachedDestination] = useState(false);

  // FIX: Increased throttle from 1s to 5s to prevent blocking render loop.
  // findOptimalTransfer + simulateInterplanetaryRK4 are expensive (hundreds of
  // Lambert solves). Uses requestIdleCallback when available so heavy work
  // defers to idle frames and doesn't stutter the animation.
  const lastCalcTime = useRef(0);
  const lastStatusRef = useRef<string | null>(null);
  const lastTargetPlanetRef = useRef<string | null>(null);
  const lastMissionLegsRef = useRef<any>(null);
  const idleCallbackRef = useRef<number | null>(null);

  const calculateTrajectoryRemote = async (data: any, signal?: AbortSignal) => {
    try {
      console.log("Sending trajectory request to /api/calculate", data);
      const response = await axios.post("/api/calculate", data, { 
        signal,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log("Received trajectory response:", response.data);
      return response.data;
    } catch (error: any) {
      if (axios.isCancel(error)) {
        console.log("Calculation aborted by request");
      } else {
        console.error("Remote trajectory calculation failed. Origin:", window.location.origin);
        console.error("Error details:", error.message, error.response?.status, error.response?.data);
      }
      return null;
    }
  };

  const calculateInterplanetaryPath = useCallback(async () => {
    if (!launchParams) return;
    if (!launchParams.targetPlanet && !launchParams.missionLegs) return;

    // Abort any pending calculation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setStatus("COMPUTING TRAJECTORY...");
    const time = globalTimeRef.current;
    
    // Delegate the heavy math (Lambert + RK4) to the backend worker threads
    const result = await calculateTrajectoryRemote(
      { launchParams, globalTime: time }, 
      abortControllerRef.current?.signal
    );
    
    if (!result) {
      if (!abortControllerRef.current?.signal?.aborted) {
        setStatus("CALCULATION FAILED");
      }
      return;
    }

    const {
      points: rawPoints,
      arrivalTime,
      success,
      missionStatus,
      captureAltitude,
      orbitPeriod,
      isOvershot,
      remainingDeltaV,
      usedDuration,
      simStartTime,
      dvLabel,
      vReq
    } = result;

    transferTimeRef.current = arrivalTime - simStartTime;
    simDurationRef.current = usedDuration;
    captureInfoRef.current = {
      status: missionStatus,
      altitude: captureAltitude,
      period: orbitPeriod,
      isOvershot,
      remainingDeltaV,
    };

    requiredDVRef.current = dvLabel;
    const targetName = launchParams.targetPlanet || (launchParams.missionLegs?.[launchParams.missionLegs.length - 1]?.destId ? 
      ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"][launchParams.missionLegs[launchParams.missionLegs.length - 1].destId - 1] 
      : undefined);
    
    maxDeltaVRef.current = getFuelCapacity(targetName, dvLabel);

    const threePoints = rawPoints.map(
      (p: [number, number, number]) => new THREE.Vector3(p[0] * POS_SCALE, p[2] * POS_SCALE, -p[1] * POS_SCALE)
    );
    setPoints(threePoints);
    setStatus(success ? "Intercept Locked" : "Transfer Optimized");

    if (targetName) {
      const targetPlanet = PLANETS.find(p => p.name === targetName);
      if (targetPlanet) {
        const [ix, iy, iz] = propagateOrbit(targetPlanet.elements, arrivalTime);
        setInterceptPoint(
          new THREE.Vector3(ix * POS_SCALE, iz * POS_SCALE, -iy * POS_SCALE)
        );
      }
    }
  }, [launchParams]);

  useEffect(() => {
    if (!launchParams) return;

    // Debounce interplanetary calculations to preserve system resources
    const timer = setTimeout(() => {
      const legsChanged = JSON.stringify(launchParams.missionLegs) !== JSON.stringify(lastMissionLegsRef.current);
      const targetChanged = launchParams.targetPlanet !== lastTargetPlanetRef.current;

      lastMissionLegsRef.current = launchParams.missionLegs;
      lastTargetPlanetRef.current = launchParams.targetPlanet;

      if (!launchParams.isLaunched || legsChanged || targetChanged) {
        if (legsChanged || targetChanged) {
          setPoints([]);
          launchTimeRef.current = null;
          progressRef.current = 0;
          setReachedDestination(false);
          setStatus("Standby");
          if (onStatusUpdate) onStatusUpdate("Standby");
        }

        if (launchParams.targetPlanet || launchParams.missionLegs) {
          calculateInterplanetaryPath();
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [launchParams, calculateInterplanetaryPath]);

  useEffect(() => {
    if (!launchParams) return;
    if (launchParams.targetPlanet || launchParams.missionLegs) return;

    const fetchPreview = async () => {
      try {
        const { v0, pitch, yaw, nbody, launchLocation, targetLocation } =
          launchParams;
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
          },
        });
        if (res.data.path) {
          // Fix: Scale LEO points using Earth's visual log radius instead of linear size scale
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

    const timeoutId = setTimeout(fetchPreview, 300);
    return () => clearTimeout(timeoutId);
  }, [launchParams]);

  // Cleanup idle callback on unmount
  useEffect(() => {
    return () => {
      if (idleCallbackRef.current !== null) {
        if (typeof cancelIdleCallback !== "undefined") {
          cancelIdleCallback(idleCallbackRef.current);
        }
      }
    };
  }, []);

  useFrame((_, delta) => {
    if (!launchParams) return;

    if (!launchParams.isLaunched) {
      launchTimeRef.current = null;
      progressRef.current = 0;
      setStatus((prev) => (prev !== "Standby" ? "Standby" : prev));
      setReachedDestination((prev) => (prev !== false ? false : prev));

      if (launchParams.targetPlanet || launchParams.missionLegs) {
        // Path is now calculated once via useEffect on target change
        // rather than every 5 seconds in useFrame to prevent UI stutter
      }
      return;
    }

    if (points.length === 0 || !shuttleRef.current) return;

    if (launchTimeRef.current === null) {
      launchTimeRef.current = globalTimeRef.current;
    }

    const maxIdx = points.length - 1;

    if (launchParams.targetPlanet || launchParams.missionLegs) {
      const elapsed = globalTimeRef.current - launchTimeRef.current;
      const pct_sim = Math.max(
        0,
        Math.min(1.0, elapsed / simDurationRef.current)
      );
      progressRef.current = pct_sim * maxIdx;

      const nextDaysPassed = Math.floor(elapsed / 86400);
      setDaysPassed((prev) =>
        prev !== nextDaysPassed ? nextDaysPassed : prev
      );

      const pct_tof = elapsed / transferTimeRef.current;
      const arrived = pct_tof >= 1.0;
      setReachedDestination((prev) => (prev !== arrived ? arrived : prev));

      let targetStatus = "Inertial Cruise";
      if (pct_tof < 0.05) {
        targetStatus = "Main Engine Burn";
        const startBurnPct = 100;
        const endBurnPct = Math.max(
          5,
          ((maxDeltaVRef.current - requiredDVRef.current) /
            maxDeltaVRef.current) *
            100.0
        );
        fuelRef.current =
          startBurnPct - (startBurnPct - endBurnPct) * (pct_tof / 0.05);
      } else if (pct_tof >= 0.98 && captureInfoRef.current.status) {
        if (captureInfoRef.current.isOvershot) {
          targetStatus = "OVERSHOT - INSUFFICIENT FUEL";
          fuelRef.current = 0;
        } else {
          targetStatus = captureInfoRef.current.status;
          const finalFuelPct = Math.max(
            1,
            ((captureInfoRef.current.remainingDeltaV ?? 0) /
              maxDeltaVRef.current) *
              100.0
          );
          fuelRef.current = finalFuelPct;
          if (!captureTimeRef.current) {
            captureTimeRef.current = globalTimeRef.current;
          }
          const nextStayTime = Math.floor(
            (globalTimeRef.current - captureTimeRef.current) / 86400
          );
          setStayTimeDays((prev) =>
            prev !== nextStayTime ? nextStayTime : prev
          );
        }
      } else {
        if (pct_tof >= 0.98 && captureInfoRef.current.isOvershot) {
          targetStatus = "OVERSHOT - INSUFFICIENT FUEL";
          fuelRef.current = 0;
        } else {
          targetStatus = "Inertial Cruise";
          const cruiseFuelPct = Math.max(
            5,
            ((maxDeltaVRef.current - requiredDVRef.current) /
              maxDeltaVRef.current) *
              100.0
          );
          fuelRef.current = cruiseFuelPct;
          captureTimeRef.current = null;
        }
      }

      setStatus((prev) => (prev !== targetStatus ? targetStatus : prev));
      if (lastStatusRef.current !== targetStatus) {
        lastStatusRef.current = targetStatus;
        if (onStatusUpdate) onStatusUpdate(targetStatus);
      }
    } else {
      const baseSpeed = 20.0;
      progressRef.current += delta * (launchParams.timeMult || 1) * baseSpeed;
    }

    let targetName = launchParams.targetPlanet;
    if (launchParams.missionLegs && launchParams.missionLegs.length > 0) {
      const legs = launchParams.missionLegs;
      const lastDestId = legs[legs.length - 1].destId;
      const planetMap: Record<number, string> = {
        1: "Mercury",
        2: "Venus",
        3: "Earth",
        4: "Mars",
        5: "Jupiter",
        6: "Saturn",
        7: "Uranus",
        8: "Neptune",
      };
      targetName = planetMap[lastDestId];
    }
    const targetPlanet = PLANETS.find((p) => p.name === targetName);

    const elapsed =
      globalTimeRef.current -
      (launchTimeRef.current || globalTimeRef.current);
    const pct_tof = elapsed / transferTimeRef.current;

    if (pct_tof >= 1.0 && targetPlanet) {
      const time = globalTimeRef.current;
      const [tpX, tpY, tpZ] = propagateOrbit(targetPlanet.elements, time);

      // Dynamically calculate parking orbit radius based on the target planet's visual radius
      const visualRadius = Math.max(0.4, Math.log10(targetPlanet.radius) * 0.4);
      const orbitalRadius = visualRadius * 1.5;
      
      const ang = (time / 86400) * 0.5;
      const ox = Math.cos(ang) * orbitalRadius;
      const oz = Math.sin(ang) * orbitalRadius;

      shuttleRef.current.position.set(
        tpX * POS_SCALE + ox,
        tpZ * POS_SCALE,
        -tpY * POS_SCALE + oz
      );

      const nextAng = ang + 0.01;
      const nox = Math.cos(nextAng) * orbitalRadius;
      const noz = Math.sin(nextAng) * orbitalRadius;
      const nextPos = new THREE.Vector3(
        tpX * POS_SCALE + nox,
        tpZ * POS_SCALE,
        -tpY * POS_SCALE + noz
      );
      shuttleRef.current.lookAt(nextPos);
    } else {
      let currentIdx = Math.floor(progressRef.current);
      if (currentIdx >= maxIdx) {
        currentIdx = maxIdx - 1;
        progressRef.current = maxIdx;
      }

      const p1 = points[currentIdx];
      const p2 = points[currentIdx + 1];
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
        opacity={
          reachedDestination
            ? 0.0
            : launchParams?.isLaunched
            ? 0.7
            : 0.4
        }
        dashed={true}
        dashScale={50}
        dashSize={1}
        gapSize={1}
      />

      {interceptPoint && !launchParams?.isLaunched && (
        <group position={interceptPoint}>
          <mesh>
            <ringGeometry args={[0.3, 0.5, 32]} />
            <meshBasicMaterial
              color="#00ffff"
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
          <Html distanceFactor={20} position={[0, -0.6, 0]}>
            <div className="bg-black/80 px-2 py-1 rounded border border-cyan-500/50 text-[6px] whitespace-nowrap text-cyan-400 font-mono uppercase tracking-widest shadow-lg">
              Intercept Lock
            </div>
          </Html>
        </group>
      )}

      {launchParams?.isLaunched && points.length > 0 && (
        <group ref={shuttleRef} position={points[0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.1, 0.3, 16]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ff4444"
              emissiveIntensity={0.8}
            />
          </mesh>

          {status.includes("Burn") && (
            <mesh position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.07, 0.4, 8]} />
              <meshStandardMaterial
                color="#ffff00"
                emissive="#ff8800"
                emissiveIntensity={2.0}
                transparent
                opacity={0.8}
              />
            </mesh>
          )}

          <pointLight color="#ff4444" intensity={5} distance={10} />
          <Html distanceFactor={20} position={[0, 0.5, 0]}>
            <div className="bg-black/80 px-2 py-1 rounded border border-red-500/50 flex flex-col gap-0.5 shadow-lg min-w-[80px]">
              <div className="text-[7px] text-white/50 font-mono uppercase tracking-tighter">
                Status
              </div>
              <div className="text-[9px] text-white font-mono uppercase font-bold tracking-tight">
                {status}
              </div>
              {status.includes("ORBIT") && captureInfoRef.current.altitude && (
                <div className="flex flex-col gap-0 font-mono uppercase mt-0.5 mb-0.5 bg-white/5 px-1 py-0.5 rounded">
                  <div className="text-[6px] text-zinc-400">
                    ALTITUDE:{" "}
                    <span className="text-cyan-400">
                      {Math.round(
                        captureInfoRef.current.altitude
                      ).toLocaleString()}{" "}
                      KM
                    </span>
                  </div>
                  <div className="text-[6px] text-zinc-400">
                    PERIOD:{" "}
                    <span className="text-cyan-400">
                      {captureInfoRef.current.period?.toFixed(1)} DAYS
                    </span>
                  </div>
                  <div className="text-[6px] text-zinc-400">
                    STAY TIME:{" "}
                    <span className="text-orange-400">{stayTimeDays} DAYS</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center mt-1">
                <span className="text-[7px] text-white/50 font-mono">
                  T+ {daysPassed} Days
                </span>
                <span className="text-[7px] text-red-400 font-mono font-bold">
                  {Math.round(fuelRef.current)}%
                </span>
              </div>
              <div className="w-full h-0.5 bg-white/10 mt-0.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{ width: `${fuelRef.current}%` }}
                />
              </div>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

function ArchivedShuttle({
  mission,
  globalTimeRef,
}: {
  mission: any;
  globalTimeRef: React.MutableRefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null);
  const planet =
    PLANETS.find((p) => p.name === mission.targetPlanet) ||
    PLANETS.find((p) => p.name === "Earth");

  useFrame(() => {
    if (!planet || !ref.current) return;
    const time = globalTimeRef.current;

    const [pX, pY, pZ] = propagateOrbit(planet.elements, time);
    const orbitalRadius = 1.2;
    const ang = (time / 86400) * 0.5 + mission.offset;
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
    const nextPos = new THREE.Vector3(
      pX * POS_SCALE + nox,
      pZ * POS_SCALE,
      -pY * POS_SCALE + noz
    );
    ref.current.lookAt(nextPos);
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 8]} />
        <meshStandardMaterial color="#88aacc" roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[0.8, 0.02, 0.2]} />
        <meshStandardMaterial color="#112244" roughness={0.5} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.8, 0.02, 0.2]} />
        <meshStandardMaterial color="#112244" roughness={0.5} metalness={0.9} />
      </mesh>
      <Html distanceFactor={20} position={[0, 0.5, 0]}>
        <div className="bg-black/60 px-2 py-0.5 rounded border border-green-500/30 flex flex-col gap-0 shadow-lg min-w-[70px]">
          <div className="text-[6px] text-zinc-400 font-mono tracking-tighter uppercase whitespace-nowrap">
            MISSION {mission.id + 1}
          </div>
          <div className="text-[8px] text-green-400 font-mono font-bold tracking-tight uppercase whitespace-nowrap">
            ARCHIVED
          </div>
        </div>
      </Html>
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
  archivedMissions = [],
}: {
  timeMult: number;
  selectedTarget: (typeof PLANETS)[0] | null;
  launchParams?: any;
  globalTimeRef: React.MutableRefObject<number>;
  onPlanetDoubleClick?: (name: string) => void;
  onStatusUpdate?: (status: string | null) => void;
  completedMissions?: number;
  archivedMissions?: any[];
}) {
  const controlsRef = useRef<any>(null);
  const currentTargetName = useRef(selectedTarget?.name || "Sun");
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    globalTimeRef.current = getJ2000Time(Date.now() / 1000);
  }, []);

  useEffect(() => {
    setIsLocked(true);
  }, [selectedTarget]);

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.1);
    globalTimeRef.current += safeDelta * timeMult;

    if (controlsRef.current && isLocked) {
      let targetX = 0,
        targetY = 0,
        targetZ = 0;

      if (selectedTarget) {
        const [x, y, z] = propagateOrbit(
          selectedTarget.elements,
          globalTimeRef.current
        );
        targetX = x * POS_SCALE;
        targetY = z * POS_SCALE;
        targetZ = -y * POS_SCALE;
      }

      const newTarget = new THREE.Vector3(targetX, targetY, targetZ);
      const targetName = selectedTarget ? selectedTarget.name : "Sun";

      if (currentTargetName.current !== targetName) {
        currentTargetName.current = targetName;
      }

      const currentTarget = controlsRef.current.target;
      const lerpFactor = 1 - Math.exp(-safeDelta * 6);
      const newLerpedTarget = currentTarget.clone().lerp(newTarget, lerpFactor);
      const displacement = newLerpedTarget.clone().sub(currentTarget);

      controlsRef.current.target.copy(newLerpedTarget);
      state.camera.position.add(displacement);
    }
  });

  return (
    <>
      <Html fullscreen className="pointer-events-none">
        <div className="absolute top-24 left-8 pointer-events-auto flex flex-col gap-2">
          <div className="px-4 py-2 bg-black/80 border border-white/10 backdrop-blur-2xl rounded-xl shadow-2xl flex items-center gap-4 glossy-panel">
            <div className="flex flex-col">
              <span className="text-[8px] text-cyan-400 font-mono tracking-[0.2em] uppercase">
                Epoch Reference
              </span>
              <span className="text-xs text-white font-mono font-bold tracking-tight">
                {new Date((J2000_UNIX + globalTimeRef.current) * 1000)
                  .toUTCString()
                  .split(" ")
                  .slice(0, 4)
                  .join(" ")}
              </span>
            </div>
            <div className="w-px h-6 bg-white/15" />
            <div className="flex flex-col">
              <span className="text-[8px] text-cyan-400 font-mono tracking-[0.2em] uppercase">
                Mission Time
              </span>
              <span className="text-xs text-white font-mono font-bold">
                {
                  new Date((J2000_UNIX + globalTimeRef.current) * 1000)
                    .toUTCString()
                    .split(" ")[4]
                }
              </span>
            </div>
          </div>

          {!isLocked && (
            <button
              onClick={() => setIsLocked(true)}
              className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/55 text-cyan-400 text-[9px] font-mono tracking-widest rounded-lg backdrop-blur-md flex items-center gap-2 group transition-all self-start glossy-button cursor-pointer"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse group-hover:scale-125" />
              RE-LOCK CAMERA TO{" "}
              {selectedTarget ? selectedTarget.name.toUpperCase() : "SOL"}
            </button>
          )}
          {isLocked && (
            <div className="px-3 py-1 bg-black/60 border border-white/10 text-white/50 text-[9px] font-mono tracking-widest rounded-lg backdrop-blur-md flex items-center gap-2 self-start">
              <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
              CAMERA TRACKING{" "}
              {selectedTarget ? selectedTarget.name.toUpperCase() : "SOL"}
              <span className="ml-2 text-[8px] opacity-30">(DRAG TO UNLOCK)</span>
            </div>
          )}
        </div>
      </Html>

      <mesh>
        <sphereGeometry args={[SUN_SIZE, 64, 64]} />
        <meshBasicMaterial color="#ffcc00" />
        <Html distanceFactor={100} className="pointer-events-none">
          <div className="text-xs uppercase font-bold text-[#ffcc00] tracking-widest translate-x-4 drop-shadow-lg">
            SUN
          </div>
        </Html>
      </mesh>

      <AsteroidBelt timeMult={timeMult} />
      <KuiperBelt timeMult={timeMult} />
      {/* FIX: OortCloud was defined but never rendered */}
      <OortCloud timeMult={timeMult} />

      {PLANETS.map((p) => (
        <Planet
          key={p.name}
          data={p}
          globalTimeRef={globalTimeRef}
          onDoubleClick={onPlanetDoubleClick}
          launchParams={launchParams}
        />
      ))}

      {archivedMissions.map((m) => (
        <ArchivedShuttle key={m.id} mission={m} globalTimeRef={globalTimeRef} />
      ))}

      {/*
        System-level GhostPath handles all interplanetary and missionLegs cases.
        The Earth-level GhostPath inside Planet handles LEO-only paths and is
        gated to !targetPlanet && !missionLegs, so these never double-mount.
      */}
      {launchParams &&
        (launchParams.targetPlanet || launchParams.missionLegs) && (
          <GhostPath
            launchParams={launchParams}
            globalTimeRef={globalTimeRef}
            onStatusUpdate={onStatusUpdate}
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
}) {
  const fallbackRef = useRef(0);
  const activeTimeRef = globalTimeRef || fallbackRef;

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-1000 ${
        isRunning
          ? "opacity-100 z-10 pointer-events-auto bg-[#03060f]"
          : "opacity-0 z-[-10] pointer-events-none"
      }`}
    >
      <Canvas
        camera={{ position: [0, 150, 400], fov: 45, far: 5000000, near: 0.1 }}
      >
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
          globalTimeRef={activeTimeRef}
          onPlanetDoubleClick={onPlanetDoubleClick}
          onStatusUpdate={onStatusUpdate}
          completedMissions={completedMissions}
          archivedMissions={archivedMissions}
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
