import React, { useState, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Box, Cylinder, Sphere, Line } from "@react-three/drei";
import * as THREE from "three";
import {
  X,
  Play,
  AlertTriangle,
  CheckCircle2,
  MousePointer2,
  Link as LinkIcon,
  Trash2,
} from "lucide-react";

// --- COMPONENT CATALOG ---
const COMPONENT_CATALOG: Record<string, any[]> = {
  Power: [
    {
      id: "solar_small",
      name: "Small Solar Panel",
      type: "Power",
      gen: 50,
      draw: 0,
      mass: 1,
      cap: 0,
      color: "#1e3a8a",
      shape: "solar",
    },
    {
      id: "solar_large",
      name: "Large Solar Panel",
      type: "Power",
      gen: 200,
      draw: 0,
      mass: 3,
      cap: 0,
      color: "#1e40af",
      shape: "solar_large",
    },
    {
      id: "battery_base",
      name: "Small Battery",
      type: "Power",
      gen: 0,
      draw: 0,
      mass: 2,
      cap: 200,
      color: "#374151",
      shape: "box",
    },
    {
      id: "battery_adv",
      name: "Large Battery",
      type: "Power",
      gen: 0,
      draw: 0,
      mass: 4,
      cap: 500,
      color: "#4b5563",
      shape: "box",
    },
  ],
  Payload: [
    {
      id: "cam_optical",
      name: "Optical Camera",
      type: "Payload",
      gen: 0,
      draw: 20,
      mass: 2,
      cap: 0,
      color: "#047857",
      shape: "camera",
    },
    {
      id: "cam_ir",
      name: "Infrared Camera",
      type: "Payload",
      gen: 0,
      draw: 30,
      mass: 3,
      cap: 0,
      color: "#059669",
      shape: "camera",
    },
    {
      id: "radar",
      name: "Radar Sensor",
      type: "Payload",
      gen: 0,
      draw: 100,
      mass: 15,
      cap: 0,
      color: "#10b981",
      shape: "radar",
    },
    {
      id: "weather",
      name: "Atmospheric Sensor",
      type: "Payload",
      gen: 0,
      draw: 15,
      mass: 2,
      cap: 0,
      color: "#34d399",
      shape: "cylinder",
    },
  ],
  Comms: [
    {
      id: "ant_basic",
      name: "Basic Antenna",
      type: "Comms",
      gen: 0,
      draw: 10,
      mass: 1,
      cap: 0,
      color: "#b91c1c",
      shape: "antenna",
    },
    {
      id: "ant_high",
      name: "High Gain Antenna",
      type: "Comms",
      gen: 0,
      draw: 25,
      mass: 4,
      cap: 0,
      color: "#dc2626",
      shape: "dish",
    },
  ],
  Control: [
    {
      id: "computer",
      name: "Flight Computer",
      type: "Control",
      gen: 0,
      draw: 15,
      mass: 1,
      cap: 0,
      color: "#7c3aed",
      shape: "box",
    },
    {
      id: "rw",
      name: "Reaction Wheel",
      type: "Control",
      gen: 0,
      draw: 5,
      mass: 2,
      cap: 0,
      color: "#8b5cf6",
      shape: "cylinder",
    },
  ],
  Propulsion: [
    {
      id: "thruster_chem",
      name: "Chemical Thruster",
      type: "Propulsion",
      gen: 0,
      draw: 10,
      mass: 5,
      isp: 320,
      color: "#f59e0b",
      shape: "engine",
    },
    {
      id: "thruster_ion",
      name: "Ion Thruster",
      type: "Propulsion",
      gen: 0,
      draw: 150,
      mass: 2,
      isp: 3000,
      color: "#3b82f6",
      shape: "engine",
    },
    {
      id: "fuel_tank_small",
      name: "Small Fuel Tank",
      type: "Propulsion",
      gen: 0,
      draw: 0,
      mass: 2,
      fuel: 80,
      color: "#9ca3af",
      shape: "tank",
    },
    {
      id: "fuel_tank_large",
      name: "Large Fuel Tank",
      type: "Propulsion",
      gen: 0,
      draw: 0,
      mass: 5,
      fuel: 300,
      color: "#d1d5db",
      shape: "tank",
    },
  ],
};

const getCatalogItem = (id: string) => {
  for (const cat of Object.values(COMPONENT_CATALOG)) {
    const item = cat.find((i) => i.id === id);
    if (item) return item;
  }
  return null;
};

// --- MISSIONS & ORBITS ---
const MISSIONS = [
  {
    name: "Earth Observation",
    req: ["cam_optical", "cam_ir", "radar"],
    idealOrbits: ["LEO", "SSO"],
  },
  {
    name: "Weather Monitoring",
    req: ["weather", "cam_ir"],
    idealOrbits: ["Polar", "SSO", "GEO"],
  },
  { name: "Communications", req: ["ant_high"], idealOrbits: ["GEO", "MEO"] },
  {
    name: "Disaster Response",
    req: ["cam_optical", "radar", "ant_high"],
    idealOrbits: ["LEO", "SSO"],
  },
  {
    name: "Scientific Research",
    req: ["cam_optical", "radar", "weather"],
    idealOrbits: ["HEO", "Polar", "LEO"],
  },
];

const ORBITS = ["LEO", "Polar", "SSO", "MEO", "GEO", "HEO"];

// --- 3D SHAPES ---
const ComponentShape = ({
  item,
  isGhost = false,
}: {
  item: any;
  isGhost?: boolean;
}) => {
  const color = item?.color || "#ccc";
  const mat = (
    <meshStandardMaterial
      color={color}
      transparent={isGhost}
      opacity={isGhost ? 0.5 : 1}
      metalness={0.6}
      roughness={0.4}
    />
  );

  if (!item) return <Box args={[1, 1, 1]}>{mat}</Box>;

  switch (item.shape) {
    case "solar":
      return <Box args={[1.8, 0.05, 0.8]}>{mat}</Box>;
    case "solar_large":
      return <Box args={[2.8, 0.05, 1.2]}>{mat}</Box>;
    case "box":
      return <Box args={[0.8, 0.8, 0.8]}>{mat}</Box>;
    case "camera":
      return (
        <group>
          <Cylinder args={[0.3, 0.3, 0.6]} position={[0, -0.1, 0]}>
            {mat}
          </Cylinder>
          <Cylinder args={[0.2, 0.2, 0.3]} position={[0, 0.35, 0]}>
            <meshStandardMaterial color="#111" />
          </Cylinder>
        </group>
      );
    case "radar":
      return (
        <group>
          <Box args={[0.6, 0.2, 0.6]} position={[0, -0.3, 0]}>
            {mat}
          </Box>
          <Cylinder
            args={[0.4, 0.4, 0.1]}
            position={[0, 0, 0]}
            rotation={[Math.PI / 4, 0, 0]}
          >
            {mat}
          </Cylinder>
        </group>
      );
    case "antenna":
      return (
        <Cylinder args={[0.05, 0.05, 1.5]} position={[0, 0.5, 0]}>
          {mat}
        </Cylinder>
      );
    case "dish":
      return (
        <group>
          <Cylinder args={[0.1, 0.1, 0.5]} position={[0, -0.2, 0]}>
            {mat}
          </Cylinder>
          <Sphere
            args={[0.6, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
            position={[0, 0.1, 0]}
            rotation={[Math.PI, 0, 0]}
          >
            {mat}
          </Sphere>
          <Cylinder args={[0.02, 0.02, 0.6]} position={[0, 0.4, 0]}>
            {mat}
          </Cylinder>
        </group>
      );
    case "cylinder":
      return <Cylinder args={[0.4, 0.4, 0.8]}>{mat}</Cylinder>;
    case "engine":
      return (
        <group>
          <Cylinder args={[0.3, 0.4, 0.4]} position={[0, 0.2, 0]}>
            {mat}
          </Cylinder>
          <Cylinder args={[0.1, 0.3, 0.4]} position={[0, -0.2, 0]}>
            <meshStandardMaterial color="#444" />
          </Cylinder>
        </group>
      );
    case "tank":
      return <Sphere args={[0.5, 16, 16]}>{mat}</Sphere>;
    default:
      return <Box args={[0.8, 0.8, 0.8]}>{mat}</Box>;
  }
};

type Mode = "PLACE" | "WIRE" | "DELETE" | "SELECT";

export default function SatelliteBuilder({
  onClose,
  onValidate,
  requiredDeltaV = 0,
}: {
  onClose: () => void;
  onValidate?: () => void;
  requiredDeltaV?: number;
}) {
  // --- STATE ---
  const [blocks, setBlocks] = useState<any[]>([
    { id: "bus", type: "bus", position: [0, 0, 0], rot: [0, 0, 0] },
  ]);
  const [connections, setConnections] = useState<
    { from: string; to: string }[]
  >([]);

  const [mode, setMode] = useState<Mode>("PLACE");
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [wireStart, setWireStart] = useState<string | null>(null);

  const [hoverCell, setHoverCell] = useState<[number, number, number] | null>(
    null,
  );
  const [hoverNormal, setHoverNormal] = useState<THREE.Vector3 | null>(null);

  const [missionType, setMissionType] = useState("Earth Observation");
  const [orbitType, setOrbitType] = useState("LEO");
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // --- ACTIONS ---
  const handleBlockClick = (
    e: any,
    blockId: string,
    position: number[],
    normal: THREE.Vector3,
  ) => {
    e.stopPropagation();

    if (mode === "DELETE") {
      if (blockId === "bus") return;
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      setConnections((prev) =>
        prev.filter((c) => c.from !== blockId && c.to !== blockId),
      );
      return;
    }

    if (mode === "WIRE") {
      if (!wireStart) {
        setWireStart(blockId);
      } else {
        if (wireStart !== blockId) {
          // Check if connection already exists
          const exists = connections.some(
            (c) =>
              (c.from === wireStart && c.to === blockId) ||
              (c.from === blockId && c.to === wireStart),
          );
          if (!exists) {
            setConnections([...connections, { from: wireStart, to: blockId }]);
          }
        }
        setWireStart(null);
      }
      return;
    }

    if (mode === "PLACE" && activeItem) {
      const nx = Math.round(normal.x);
      const ny = Math.round(normal.y);
      const nz = Math.round(normal.z);
      const nextPos = [position[0] + nx, position[1] + ny, position[2] + nz];

      // Check if occupied
      if (
        blocks.some(
          (b) =>
            b.position[0] === nextPos[0] &&
            b.position[1] === nextPos[1] &&
            b.position[2] === nextPos[2],
        )
      ) {
        return;
      }

      // Calculate rotation based on normal so flat things stick to the surface
      let rot = [0, 0, 0];
      if (nx === 1) rot = [0, 0, -Math.PI / 2];
      else if (nx === -1) rot = [0, 0, Math.PI / 2];
      else if (nz === 1) rot = [Math.PI / 2, 0, 0];
      else if (nz === -1) rot = [-Math.PI / 2, 0, 0];
      else if (ny === -1) rot = [Math.PI, 0, 0];

      setBlocks([
        ...blocks,
        {
          id: `block_${Date.now()}`,
          type: activeItem,
          position: nextPos,
          rot,
        },
      ]);
    }
  };

  const handlePointerMove = (
    e: any,
    position: number[],
    normal: THREE.Vector3,
  ) => {
    e.stopPropagation();
    if (mode === "PLACE" && activeItem) {
      const nextPos: [number, number, number] = [
        position[0] + Math.round(normal.x),
        position[1] + Math.round(normal.y),
        position[2] + Math.round(normal.z),
      ];
      setHoverCell(nextPos);
      setHoverNormal(normal);
    }
  };

  // --- SIMULATION ---
  const runSimulation = () => {
    const mission = MISSIONS.find((m) => m.name === missionType);
    let reasons: string[] = [];
    let score = 100;

    // 1. Build Graph
    const adj: Record<string, string[]> = {};
    blocks.forEach((b) => (adj[b.id] = []));
    connections.forEach((c) => {
      if (adj[c.from] && adj[c.to]) {
        adj[c.from].push(c.to);
        adj[c.to].push(c.from);
      }
    });

    // 2. Find Connected Networks
    const visited = new Set();
    const networks: any[][] = [];
    blocks.forEach((b) => {
      if (!visited.has(b.id)) {
        const net = [];
        const q = [b.id];
        visited.add(b.id);
        while (q.length > 0) {
          const curr = q.shift()!;
          net.push(blocks.find((x) => x.id === curr));
          adj[curr].forEach((n) => {
            if (!visited.has(n)) {
              visited.add(n);
              q.push(n);
            }
          });
        }
        networks.push(net);
      }
    });

    let hasGlobalAntenna = false;
    let hasGlobalComputer = false;
    let hasReqPayload = false;
    let anyPowerFailure = false;
    let unconnectedPayloads = false;

    let totalMass = 5; // Base bus mass
    let totalFuel = 0;
    let totalThrustIsp = 0;
    let thrusterCount = 0;

    networks.forEach((net) => {
      let netGen = 0;
      let netDraw = 0;
      let netComputer = false;
      let netAntenna = false;
      let netPayloads: string[] = [];

      net.forEach((b) => {
        if (!b) return;
        if (b.id !== "bus") {
          const cat = getCatalogItem(b.type);
          if (cat) {
            netGen += cat.gen;
            netDraw += cat.draw;
            totalMass += cat.mass;
            if (cat.fuel) totalFuel += cat.fuel;
            if (cat.isp) {
              totalThrustIsp += cat.isp;
              thrusterCount++;
            }
            if (cat.id === "computer") netComputer = true;
            if (cat.type === "Comms") netAntenna = true;
            if (cat.type === "Payload") netPayloads.push(cat.id);
          }
        }
      });

      if (netGen < netDraw && netDraw > 0) {
        score -= 40;
        anyPowerFailure = true;
        reasons.push(
          `Power deficit! A wired group draws ${netDraw}W but generates only ${netGen}W. Components will fail.`,
        );
      }

      if (netPayloads.length > 0 && !netComputer) {
        score -= 20;
        unconnectedPayloads = true;
        reasons.push(
          `Uncontrolled payload: Camera/Sensor is not wired to a Flight Computer.`,
        );
      }

      if (netComputer) hasGlobalComputer = true;
      if (netAntenna) hasGlobalAntenna = true;
      if (mission && mission.req.some((r) => netPayloads.includes(r))) {
        hasReqPayload = true;
      }
    });

    // 3. Global Checks
    let hasHighGainAntenna = blocks.some((b) => b.type === "ant_high");
    if (!hasGlobalComputer) {
      score -= 20;
      reasons.push(
        `Mission Failed: No flight computer installed on spacecraft.`,
      );
    }
    if (!hasGlobalAntenna) {
      score -= 20;
      reasons.push(
        `Mission Failed: Cannot transmit data. Add and wire a communication antenna.`,
      );
    } else if (requiredDeltaV > 0 && !hasHighGainAntenna) {
      score -= 30;
      reasons.push(
        `Mission Failed: Interplanetary missions require a High Gain Antenna to communicate across deep space.`,
      );
    }
    if (mission && !hasReqPayload) {
      score -= 30;
      reasons.push(
        `Mission Failed: Missing required payload for ${missionType}.`,
      );
    }
    if (mission && !mission.idealOrbits.includes(orbitType)) {
      score -= 15;
      reasons.push(
        `Warning: Orbit ${orbitType} is not ideal for ${missionType}.`,
      );
    }

    // Check for totally unwired components (network of size 1)
    const unwiredCount = networks.filter(
      (n) => n.length === 1 && n[0].id !== "bus",
    ).length;
    if (unwiredCount > 0) {
      score -= 10;
      reasons.push(
        `Warning: ${unwiredCount} component(s) are placed but not wired to anything.`,
      );
    }

    // Delta V Check
    let deltaV_kms = 0;
    if (thrusterCount > 0 && totalFuel > 0) {
      const avgIsp = totalThrustIsp / thrusterCount;
      const wetMass = totalMass + totalFuel;
      const dryMass = totalMass;
      const ve = avgIsp * 9.81; // m/s
      deltaV_kms = (ve * Math.log(wetMass / dryMass)) / 1000;
    }

    if (requiredDeltaV > 0) {
      if (deltaV_kms < requiredDeltaV) {
        score -= 50;
        reasons.push(
          `Mission Failed: Insufficient Delta-V. Mission requires ${requiredDeltaV.toFixed(2)} km/s, spacecraft can only provide ${deltaV_kms.toFixed(2)} km/s.`,
        );
      } else {
        reasons.push(
          `Mission Success: Spacecraft has enough Delta-V (${deltaV_kms.toFixed(2)} km/s) to complete the maneuver!`,
        );
      }
    }

    score = Math.max(0, score);

    let coverage = 0;
    if (orbitType === "LEO") coverage = 20;
    else if (orbitType === "Polar" || orbitType === "SSO") coverage = 100;
    else if (orbitType === "MEO") coverage = 50;
    else if (orbitType === "GEO") coverage = 40;

    let rating = "Poor";
    if (score >= 90) rating = "Excellent";
    else if (score >= 70) rating = "Good";
    else if (score >= 50) rating = "Marginal";

    if (score >= 85 && reasons.length === 0) {
      reasons.push(`✓ All systems nominal.`);
      reasons.push(`✓ Positive power budget.`);
      reasons.push(`✓ Data links active.`);
    } else if (score >= 60) {
      reasons.push(`✓ Core systems functional, but suboptimal.`);
    }

    setSimulationResult({
      score,
      rating,
      success: score >= 60,
      reasons,
      coverage,
      mass: totalMass + totalFuel,
      deltaV: deltaV_kms,
    });
  };

  // --- STATS CALC ---
  const stats = useMemo(() => {
    return blocks.reduce(
      (acc, b) => {
        if (b.id === "bus") return acc;
        const cat = getCatalogItem(b.type);
        if (cat) {
          acc.mass += cat.mass;
          acc.gen += cat.gen;
          acc.draw += cat.draw;
          if (cat.fuel) acc.fuel += cat.fuel;
          if (cat.isp) {
            acc.totalIsp += cat.isp;
            acc.thrusterCount++;
          }
        }
        return acc;
      },
      { mass: 5, gen: 0, draw: 0, fuel: 0, totalIsp: 0, thrusterCount: 0 },
    ); // Bus is 5kg
  }, [blocks]);

  const liveDeltaV = useMemo(() => {
    if (stats.thrusterCount > 0 && stats.fuel > 0) {
      const avgIsp = stats.totalIsp / stats.thrusterCount;
      const wetMass = stats.mass + stats.fuel;
      const ve = avgIsp * 9.81;
      return (ve * Math.log(wetMass / stats.mass)) / 1000;
    }
    return 0;
  }, [stats]);

  return (
    <div className="w-full h-full bg-[#050505] text-white flex flex-col font-mono pointer-events-auto selection:bg-cyan-900">
      {/* HEADER */}
      <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-widest text-cyan-400 uppercase">
            Satellite Assembly Facility
          </h1>
          <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
            VAB // SECURE
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-zinc-800 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT PANEL: LIBRARY */}
        <div className="w-72 border-r border-zinc-800 bg-zinc-950/90 flex flex-col overflow-y-auto z-10">
          <div className="p-4 uppercase text-[10px] font-bold tracking-widest border-b border-zinc-800 text-zinc-500">
            Hardware Catalog
          </div>
          {Object.entries(COMPONENT_CATALOG).map(([cat, items]) => (
            <div key={cat} className="mb-4">
              <div className="px-4 py-2 bg-zinc-900/50 text-[10px] uppercase tracking-wider text-cyan-500 border-y border-zinc-800/50">
                {cat}
              </div>
              <div className="p-2 flex flex-col gap-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex justify-between items-center p-3 border cursor-pointer transition-all ${activeItem === item.id && mode === "PLACE" ? "border-cyan-500 bg-cyan-950/30" : "border-zinc-800 bg-black hover:border-zinc-600"}`}
                    onClick={() => {
                      setActiveItem(item.id);
                      setMode("PLACE");
                    }}
                  >
                    <div>
                      <div className="text-xs font-bold text-zinc-200">
                        {item.name}
                      </div>
                      <div className="text-[9px] text-zinc-500 mt-1 uppercase">
                        {item.gen > 0 && (
                          <span className="text-cyan-400 mr-2">
                            +{item.gen}W
                          </span>
                        )}
                        {item.draw > 0 && (
                          <span className="text-yellow-500 mr-2">
                            -{item.draw}W
                          </span>
                        )}
                        {item.mass}KG
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CENTER: 3D CANVAS */}
        <div className="flex-1 relative bg-gradient-to-b from-[#0a0f16] to-[#020202]">
          {/* TOOLBAR */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-10 bg-black/50 p-2 rounded-lg border border-zinc-800 backdrop-blur-md">
            <button
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors rounded ${mode === "PLACE" ? "bg-cyan-500 text-black" : "text-zinc-400 hover:text-white"}`}
              onClick={() => setMode("PLACE")}
            >
              <MousePointer2 size={16} /> Build
            </button>
            <button
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors rounded ${mode === "WIRE" ? "bg-yellow-500 text-black" : "text-zinc-400 hover:text-white"}`}
              onClick={() => {
                setMode("WIRE");
                setWireStart(null);
              }}
            >
              <LinkIcon size={16} /> Wire
            </button>
            <button
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors rounded ${mode === "DELETE" ? "bg-red-500 text-white" : "text-zinc-400 hover:text-white"}`}
              onClick={() => setMode("DELETE")}
            >
              <Trash2 size={16} /> Remove
            </button>
          </div>

          <Canvas camera={{ position: [5, 4, 5], fov: 45 }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 10, 5]} intensity={1.5} />
            <directionalLight
              position={[-10, -10, -5]}
              intensity={0.5}
              color="#444"
            />

            <OrbitControls makeDefault maxDistance={20} minDistance={2} />

            {/* GRID */}
            <gridHelper
              args={[20, 20, 0x333333, 0x111111]}
              position={[0, -2, 0]}
            />

            {/* PLACED BLOCKS */}
            <group>
              {blocks.map((b) => {
                const isSelected = wireStart === b.id;
                const catItem = getCatalogItem(b.type);

                return (
                  <group
                    key={b.id}
                    position={b.position as [number, number, number]}
                    rotation={b.rot as [number, number, number]}
                  >
                    {/* Visual Shape */}
                    {b.id === "bus" ? (
                      <Box args={[1, 1, 1]}>
                        <meshStandardMaterial
                          color="#888"
                          metalness={0.8}
                          roughness={0.2}
                        />
                      </Box>
                    ) : (
                      <ComponentShape item={catItem} />
                    )}

                    {/* Selection Highlight */}
                    {isSelected && (
                      <Box args={[1.05, 1.05, 1.05]}>
                        <meshBasicMaterial color="yellow" wireframe />
                      </Box>
                    )}

                    {/* Interaction Mesh (Invisible grid cube) */}
                    <mesh
                      visible={false}
                      onPointerMove={(e) =>
                        handlePointerMove(e, b.position, e.face!.normal)
                      }
                      onPointerOut={() => setHoverCell(null)}
                      onClick={(e) =>
                        handleBlockClick(e, b.id, b.position, e.face!.normal)
                      }
                    >
                      <boxGeometry args={[1, 1, 1]} />
                      <meshBasicMaterial />
                    </mesh>
                  </group>
                );
              })}

              {/* WIRE CONNECTIONS */}
              {connections.map((c, i) => {
                const b1 = blocks.find((x) => x.id === c.from);
                const b2 = blocks.find((x) => x.id === c.to);
                if (!b1 || !b2) return null;
                return (
                  <Line
                    key={i}
                    points={[b1.position, b2.position]}
                    color="#eab308"
                    lineWidth={3}
                    dashed
                    dashScale={10}
                    dashSize={0.2}
                    dashOffset={Date.now() / 1000} // slight animation hack if rerendered
                  />
                );
              })}

              {/* GHOST PLACEMENT */}
              {mode === "PLACE" && hoverCell && activeItem && (
                <group position={hoverCell}>
                  <ComponentShape
                    item={getCatalogItem(activeItem)}
                    isGhost={true}
                  />
                  <Box args={[1, 1, 1]}>
                    <meshBasicMaterial
                      color="#00ffff"
                      wireframe
                      opacity={0.3}
                      transparent
                    />
                  </Box>
                </group>
              )}
            </group>
          </Canvas>

          {/* BOTTOM PANEL: MISSION SETTINGS */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-zinc-950/95 border-t border-zinc-800 flex backdrop-blur-md">
            <div className="w-1/3 p-4 flex flex-col border-r border-zinc-800">
              <div className="uppercase text-[10px] font-bold tracking-widest text-zinc-500 mb-3">
                Mission Configuration
              </div>

              <div className="flex justify-between items-center bg-zinc-900/50 p-2 border border-zinc-800 rounded mb-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-zinc-500 tracking-widest uppercase">
                    Delta-V Capability
                  </span>
                  <span
                    className={`text-sm font-bold ${liveDeltaV >= requiredDeltaV ? "text-green-400" : "text-cyan-400"}`}
                  >
                    {liveDeltaV.toFixed(2)} km/s
                  </span>
                </div>
                {requiredDeltaV > 0 && (
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] text-zinc-500 tracking-widest uppercase">
                      Required
                    </span>
                    <span className="text-sm font-bold text-yellow-500">
                      {requiredDeltaV.toFixed(2)} km/s
                    </span>
                  </div>
                )}
              </div>

              {requiredDeltaV === 0 && (
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <label className="text-[9px] text-zinc-500 uppercase tracking-widest block mb-1">
                      Objective
                    </label>
                    <select
                      value={missionType}
                      onChange={(e) => setMissionType(e.target.value)}
                      className="w-full bg-black border border-zinc-800 text-white text-xs p-2 outline-none focus:border-cyan-500"
                    >
                      {MISSIONS.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="text-[9px] text-zinc-500 uppercase tracking-widest block mb-1">
                      Orbit
                    </label>
                    <select
                      value={orbitType}
                      onChange={(e) => setOrbitType(e.target.value)}
                      className="w-full bg-black border border-zinc-800 text-white text-xs p-2 outline-none focus:border-cyan-500"
                    >
                      {ORBITS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <button
                onClick={runSimulation}
                className="mt-auto w-full py-3 bg-cyan-600 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-cyan-500 transition-colors rounded"
              >
                <Play size={14} fill="currentColor" /> Run Validation Simulation
              </button>
            </div>

            <div className="flex-1 p-4 flex flex-col overflow-hidden">
              <div className="uppercase text-[10px] font-bold tracking-widest text-zinc-500 mb-3">
                Telemetry & Analysis
              </div>

              {!simulationResult ? (
                <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs italic border border-zinc-800/50 bg-black/30 rounded">
                  Construct spacecraft and press Run Validation Simulation to
                  evaluate design.
                </div>
              ) : (
                <div className="flex-1 flex gap-6">
                  <div className="flex flex-col justify-center">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
                      Status
                    </div>
                    <div
                      className={`text-2xl font-black tracking-wider flex items-center gap-2 ${simulationResult.success ? "text-green-500" : "text-red-500"}`}
                    >
                      {simulationResult.success ? (
                        <CheckCircle2 size={24} />
                      ) : (
                        <AlertTriangle size={24} />
                      )}
                      {simulationResult.success ? "SUCCESS" : "FAILURE"}
                    </div>
                    <div className="mt-4 text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
                      Score
                    </div>
                    <div className="text-xl font-bold text-white">
                      {simulationResult.score}/100
                    </div>
                  </div>

                  <div className="flex-1 border border-zinc-800 bg-black p-3 rounded overflow-y-auto">
                    <ul className="space-y-2">
                      {simulationResult.reasons.map((r: string, i: number) => (
                        <li
                          key={i}
                          className={`text-xs flex items-start gap-2 ${r.includes("✓") ? "text-green-400" : "text-red-400"}`}
                        >
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: TELEMETRY */}
        <div className="w-64 border-l border-zinc-800 bg-zinc-950/90 flex flex-col z-10">
          <div className="p-4 uppercase text-[10px] font-bold tracking-widest border-b border-zinc-800 text-zinc-500">
            Live Telemetry
          </div>

          <div className="p-4 space-y-4 border-b border-zinc-800">
            <div>
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">
                Total Mass
              </div>
              <div className="text-xl font-bold">
                {stats.mass}{" "}
                <span className="text-xs text-zinc-500 font-normal">kg</span>
              </div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">
                Power Generation
              </div>
              <div className="text-xl font-bold text-cyan-400">
                +{stats.gen}{" "}
                <span className="text-xs text-zinc-500 font-normal">W</span>
              </div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">
                Power Consumption
              </div>
              <div className="text-xl font-bold text-yellow-500">
                -{stats.draw}{" "}
                <span className="text-xs text-zinc-500 font-normal">W</span>
              </div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">
                Net Power Budget
              </div>
              <div
                className={`text-xl font-bold ${stats.gen >= stats.draw ? "text-green-500" : "text-red-500"}`}
              >
                {stats.gen >= stats.draw ? "+" : ""}
                {stats.gen - stats.draw}{" "}
                <span className="text-xs text-zinc-500 font-normal">W</span>
              </div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">
                Delta-V
              </div>
              <div className="text-xl font-bold text-white">
                {liveDeltaV.toFixed(2)}{" "}
                <span className="text-xs text-zinc-500 font-normal">km/s</span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto flex flex-col">
            <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">
              Instructions
            </div>
            <ul className="text-xs text-zinc-400 space-y-2 leading-relaxed mb-auto">
              <li>
                <strong className="text-white">Build:</strong> Select a
                component on the left, then click on the central bus or attached
                components to place it.
              </li>
              <li>
                <strong className="text-white">Wire:</strong> Switch to Wire
                mode. Click a component, then click another to establish a
                power/data link.
              </li>
              <li>
                <strong className="text-white">Remove:</strong> Switch to Remove
                mode and click components to delete them.
              </li>
            </ul>

            {simulationResult?.success && (
              <div className="pt-4 border-t border-zinc-800 mt-4">
                <button
                  onClick={() => {
                    if (onValidate) onValidate();
                    onClose();
                  }}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold text-[11px] uppercase tracking-widest transition-colors rounded shadow-[0_0_15px_rgba(34,197,94,0.3)] cursor-pointer"
                >
                  FINISH DESIGN & LAUNCH
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
