import React, { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Cylinder, Sphere } from '@react-three/drei';
import { X, Play, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function SatelliteBuilder({ onClose }: { onClose: () => void }) {
  // State for selected components
  const [components, setComponents] = useState<any[]>([]);
  
  // State for mission parameters
  const [missionType, setMissionType] = useState('Earth Observation');
  const [orbitType, setOrbitType] = useState('LEO');
  
  // Simulation results
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Component Library
  const COMPONENT_CATALOG = {
    Power: [
      { id: 'solar_small', name: 'Small Solar Panel', type: 'Power', gen: 50, draw: 0, mass: 1, cap: 0, color: '#1e3a8a' },
      { id: 'solar_large', name: 'Large Solar Panel', type: 'Power', gen: 200, draw: 0, mass: 3, cap: 0, color: '#1e40af' },
      { id: 'battery_base', name: 'Battery Pack', type: 'Power', gen: 0, draw: 0, mass: 2, cap: 400, color: '#374151' },
      { id: 'battery_adv', name: 'Adv Battery Pack', type: 'Power', gen: 0, draw: 0, mass: 4, cap: 1000, color: '#4b5563' },
    ],
    Payload: [
      { id: 'cam_optical', name: 'Optical Camera', type: 'Payload', gen: 0, draw: 20, mass: 2, cap: 0, color: '#047857' },
      { id: 'cam_ir', name: 'Infrared Camera', type: 'Payload', gen: 0, draw: 30, mass: 3, cap: 0, color: '#059669' },
      { id: 'radar', name: 'Radar Sensor', type: 'Payload', gen: 0, draw: 100, mass: 15, cap: 0, color: '#10b981' },
      { id: 'weather', name: 'Atmospheric Sensor', type: 'Payload', gen: 0, draw: 15, mass: 2, cap: 0, color: '#34d399' },
    ],
    Comms: [
      { id: 'ant_basic', name: 'Basic Antenna', type: 'Comms', gen: 0, draw: 5, mass: 1, cap: 0, color: '#b91c1c' },
      { id: 'ant_high', name: 'High Gain Antenna', type: 'Comms', gen: 0, draw: 25, mass: 4, cap: 0, color: '#dc2626' },
    ],
    Control: [
      { id: 'rw', name: 'Reaction Wheels', type: 'Control', gen: 0, draw: 10, mass: 2, cap: 0, color: '#8b5cf6' },
      { id: 'computer', name: 'Flight Computer', type: 'Control', gen: 0, draw: 5, mass: 1, cap: 0, color: '#7c3aed' },
    ],
  };

  const MISSIONS = [
    { name: 'Earth Observation', req: ['cam_optical', 'cam_ir', 'radar'], idealOrbits: ['LEO', 'SSO'] },
    { name: 'Weather Monitoring', req: ['weather', 'cam_ir'], idealOrbits: ['Polar', 'SSO', 'GEO'] },
    { name: 'Communications', req: ['ant_high'], idealOrbits: ['GEO', 'MEO'] },
    { name: 'Scientific Research', req: ['cam_optical', 'radar'], idealOrbits: ['HEO', 'Polar'] },
  ];

  const ORBITS = ['LEO', 'Polar', 'SSO', 'MEO', 'GEO', 'HEO'];

  // Calculated Stats
  const stats = useMemo(() => {
    return components.reduce((acc, comp) => {
      acc.mass += comp.mass;
      acc.gen += comp.gen;
      acc.draw += comp.draw;
      acc.cap += comp.cap;
      return acc;
    }, { mass: 50, gen: 0, draw: 10, cap: 100 }); // Base bus stats
  }, [components]);

  const addComponent = (comp: any) => {
    setComponents([...components, { ...comp, instanceId: Math.random().toString(36).substr(2, 9) }]);
  };

  const removeComponent = (instanceId: string) => {
    setComponents(components.filter(c => c.instanceId !== instanceId));
  };

  const runSimulation = () => {
    const mission = MISSIONS.find(m => m.name === missionType);
    let reasons: string[] = [];
    let score = 100;
    
    // 1. Check Power Budget
    if (stats.gen < stats.draw) {
      score -= 40;
      reasons.push(`Power generation (${stats.gen}W) is lower than consumption (${stats.draw}W). Battery will deplete.`);
    } else if (stats.cap < 200) {
      score -= 10;
      reasons.push(`Low battery capacity (${stats.cap}Wh) may cause issues during eclipse phases.`);
    }

    // 2. Check Orbit Suitability
    if (mission && !mission.idealOrbits.includes(orbitType)) {
      score -= 20;
      reasons.push(`${orbitType} is sub-optimal for ${missionType}. Consider ${mission.idealOrbits.join(' or ')}.`);
    }

    // 3. Check Payload Suitability
    let hasReqPayload = false;
    if (mission) {
      for (const req of mission.req) {
        if (components.some(c => c.id === req)) {
          hasReqPayload = true;
          break;
        }
      }
      if (!hasReqPayload) {
        score -= 30;
        reasons.push(`Missing suitable payload for ${missionType}. Need at least one relevant sensor.`);
      }
    }

    // 4. Basic sanity checks
    if (!components.some(c => c.type === 'Comms')) {
      score -= 15;
      reasons.push('No communications system. Cannot transmit data.');
    }
    if (!components.some(c => c.id === 'computer')) {
      score -= 10;
      reasons.push('Missing flight computer. Relying on basic analog bus.');
    }

    score = Math.max(0, score);
    
    let coverage = 0;
    if (orbitType === 'LEO') coverage = 20;
    else if (orbitType === 'Polar' || orbitType === 'SSO') coverage = 100;
    else if (orbitType === 'MEO') coverage = 50;
    else if (orbitType === 'GEO') coverage = 40;

    let rating = 'Poor';
    if (score >= 90) rating = 'Excellent';
    else if (score >= 70) rating = 'Good';
    else if (score >= 50) rating = 'Marginal';

    setSimulationResult({
      score,
      rating,
      success: score >= 60,
      reasons,
      coverage
    });
  };

  return (
    <div className="w-full h-full bg-[#0a0a0a] text-white flex flex-col font-mono pointer-events-auto">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-widest text-primary-fixed uppercase">Satellite Mission Builder</h1>
          <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">DESIGN & SIMULATE</div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Component Library */}
        <div className="w-80 border-r border-zinc-800 bg-zinc-950/50 flex flex-col overflow-y-auto">
          <div className="p-4 uppercase text-xs font-bold tracking-widest border-b border-zinc-800 text-zinc-400">Component Library</div>
          {Object.entries(COMPONENT_CATALOG).map(([cat, items]) => (
            <div key={cat} className="mb-2">
              <div className="px-4 py-2 bg-zinc-900 text-xs uppercase tracking-wider text-primary-fixed">{cat}</div>
              <div className="p-2 flex flex-col gap-2">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-2 border border-zinc-800 bg-black hover:border-zinc-600 transition-colors cursor-pointer" onClick={() => addComponent(item)}>
                    <div>
                      <div className="text-sm font-bold">{item.name}</div>
                      <div className="text-[10px] text-zinc-500 mt-1">
                        {item.gen > 0 && `+${item.gen}W `}
                        {item.draw > 0 && `-${item.draw}W `}
                        {item.cap > 0 && `${item.cap}Wh `}
                        {item.mass}kg
                      </div>
                    </div>
                    <div className="w-4 h-4 rounded-full border border-zinc-600" style={{ backgroundColor: item.color }}></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Center: 3D View & Bottom Panel */}
        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 relative bg-[#050505]">
            <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
            <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
              <ambientLight intensity={0.5} />
              <directionalLight position={[10, 10, 5]} intensity={1} />
              <OrbitControls makeDefault />
              <group>
                {/* Base Bus */}
                <Box args={[2, 2, 2]}>
                  <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
                </Box>
                {/* Dynamically placed components (abstract representation) */}
                {components.map((comp, i) => {
                  const angle = (i / components.length) * Math.PI * 2;
                  const radius = 1.5;
                  const x = Math.cos(angle) * radius;
                  const z = Math.sin(angle) * radius;
                  const y = (i % 2 === 0 ? 0.5 : -0.5);
                  return (
                    <Box key={comp.instanceId} position={[x, y, z]} args={[0.5, 0.5, 0.5]}>
                      <meshStandardMaterial color={comp.color} metalness={0.5} roughness={0.5} />
                    </Box>
                  );
                })}
              </group>
            </Canvas>
          </div>

          {/* Bottom Panel: Mission Analysis */}
          <div className="h-64 border-t border-zinc-800 bg-zinc-950 flex">
            {/* Controls */}
            <div className="w-1/3 p-4 border-r border-zinc-800 flex flex-col">
              <div className="uppercase text-xs font-bold tracking-widest text-zinc-400 mb-4">Mission Setup</div>
              
              <div className="mb-4">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Mission Type</label>
                <select 
                  value={missionType} 
                  onChange={e => setMissionType(e.target.value)}
                  className="w-full bg-black border border-zinc-800 text-white text-sm p-2 focus:border-primary-fixed outline-none"
                >
                  {MISSIONS.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </div>

              <div className="mb-4">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Target Orbit</label>
                <select 
                  value={orbitType} 
                  onChange={e => setOrbitType(e.target.value)}
                  className="w-full bg-black border border-zinc-800 text-white text-sm p-2 focus:border-primary-fixed outline-none"
                >
                  {ORBITS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <button 
                onClick={runSimulation}
                className="mt-auto w-full py-3 bg-primary-fixed text-black font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-cyan-400 transition-colors"
              >
                <Play size={16} /> Run Simulation
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 p-4 flex flex-col">
              <div className="uppercase text-xs font-bold tracking-widest text-zinc-400 mb-4">Simulation Results</div>
              
              {!simulationResult ? (
                <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm italic">
                  Configure mission and press Run Simulation
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Mission Status</div>
                      <div className={`text-2xl font-bold flex items-center gap-2 ${simulationResult.success ? 'text-green-500' : 'text-red-500'}`}>
                        {simulationResult.success ? <CheckCircle2 /> : <AlertTriangle />}
                        {simulationResult.success ? 'SUCCESS' : 'FAILURE'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Mission Score</div>
                      <div className="text-2xl font-bold text-white">{simulationResult.score}/100</div>
                      <div className="text-xs text-primary-fixed uppercase tracking-widest">{simulationResult.rating}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Earth Coverage</div>
                      <div className="text-2xl font-bold text-white">{simulationResult.coverage}%</div>
                    </div>
                  </div>

                  <div className="flex-1 border border-zinc-800 bg-black p-3 overflow-y-auto">
                    <div className="text-xs font-bold uppercase text-zinc-400 mb-2 border-b border-zinc-800 pb-1">Analysis Log</div>
                    {simulationResult.reasons.length === 0 ? (
                      <div className="text-green-400 text-sm flex items-center gap-2"><CheckCircle2 size={14}/> All systems nominal. Mission parameters optimal.</div>
                    ) : (
                      <ul className="space-y-2">
                        {simulationResult.reasons.map((r: string, i: number) => (
                          <li key={i} className="text-red-400 text-sm flex items-start gap-2">
                            <span className="mt-0.5"><AlertTriangle size={14}/></span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Statistics & Active Components */}
        <div className="w-80 border-l border-zinc-800 bg-zinc-950/50 flex flex-col">
          <div className="p-4 uppercase text-xs font-bold tracking-widest border-b border-zinc-800 text-zinc-400">System Telemetry</div>
          
          <div className="p-4 grid grid-cols-2 gap-4 border-b border-zinc-800">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Total Mass</div>
              <div className="text-xl font-bold">{stats.mass} <span className="text-sm text-zinc-500">kg</span></div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Net Power</div>
              <div className={`text-xl font-bold ${stats.gen >= stats.draw ? 'text-green-500' : 'text-red-500'}`}>
                {stats.gen >= stats.draw ? '+' : ''}{stats.gen - stats.draw} <span className="text-sm text-zinc-500">W</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Generation</div>
              <div className="text-xl font-bold text-cyan-400">{stats.gen} <span className="text-sm text-zinc-500">W</span></div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Consumption</div>
              <div className="text-xl font-bold text-yellow-500">{stats.draw} <span className="text-sm text-zinc-500">W</span></div>
            </div>
            <div className="col-span-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Battery Capacity</div>
              <div className="text-xl font-bold">{stats.cap} <span className="text-sm text-zinc-500">Wh</span></div>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 uppercase text-[10px] font-bold tracking-widest text-zinc-500">Active Components ({components.length})</div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {components.map(comp => (
                <div key={comp.instanceId} className="flex justify-between items-center p-2 border border-zinc-800 bg-black">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: comp.color }}></div>
                    <span className="text-sm">{comp.name}</span>
                  </div>
                  <button onClick={() => removeComponent(comp.instanceId)} className="text-zinc-500 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {components.length === 0 && (
                <div className="text-zinc-600 text-xs italic text-center py-4">No components installed. Base bus active.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .grid-bg {
          background-size: 40px 40px;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
        }
      `}</style>
    </div>
  );
}