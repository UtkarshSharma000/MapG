import React, { useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture, OrbitControls } from "@react-three/drei";
import * as THREE from 'three';

class TextureErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.warn("Globe texture loading failed gracefully. Using styled fallback material.", err);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

interface InteractiveGlobeProps {
  url: string;
  color: string;
}

function LoadedGlobeMaterial({ url, color, hovered }: { url: string; color: string; hovered: boolean }) {
  const tex = useTexture(url);
  return (
    <meshStandardMaterial 
      map={tex} 
      color={hovered ? '#ffffff' : '#f0f0f0'} 
      roughness={0.7} 
      emissive={new THREE.Color(color).multiplyScalar(0.1)} 
    />
  );
}

function FallbackGlobeMaterial({ color, hovered }: { color: string; hovered: boolean }) {
  return (
    <meshStandardMaterial 
      color={color || '#c1440e'} 
      roughness={0.7} 
    />
  );
}

export function InteractiveGlobe({ url, color }: InteractiveGlobeProps) {
  const meshRef = React.useRef<THREE.Mesh>(null);
  const scrollProgressRef = React.useRef(0);

  useEffect(() => {
    const scroller = document.querySelector('.landing-scroller');
    if (!scroller) return;

    const handleScroll = () => {
      const scrollTop = scroller.scrollTop;
      const scrollHeight = scroller.scrollHeight - scroller.clientHeight;
      if (scrollHeight > 0) {
        scrollProgressRef.current = scrollTop / scrollHeight;
      }
    };

    scroller.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      scroller.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
    const p = scrollProgressRef.current;
    // Smoothed spring coordinates mapped from scroll progress
    const targetZ = 3 + p * 15;
    const targetY = p * 6;
    const targetX = Math.sin(p * Math.PI) * 4;

    state.camera.position.z += (targetZ - state.camera.position.z) * 0.1;
    state.camera.position.y += (targetY - state.camera.position.y) * 0.1;
    state.camera.position.x += (targetX - state.camera.position.x) * 0.1;
    state.camera.lookAt(0, 0, 0);
  });

  const [hovered, setHover] = useState(false);
  
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 3, 5]} intensity={2.5} />
      <mesh 
          ref={meshRef} 
          onPointerOver={() => setHover(true)} 
          onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[1.5, 64, 64]} />
        <TextureErrorBoundary fallback={<FallbackGlobeMaterial color={color} hovered={hovered} />}>
          <React.Suspense fallback={<FallbackGlobeMaterial color={color} hovered={hovered} />}>
            <LoadedGlobeMaterial url={url} color={color} hovered={hovered} />
          </React.Suspense>
        </TextureErrorBoundary>
      </mesh>
      <OrbitControls enableZoom={false} enablePan={false} />
    </>
  );
}
