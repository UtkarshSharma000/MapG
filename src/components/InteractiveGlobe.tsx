import React, { useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture, OrbitControls } from "@react-three/drei";
import * as THREE from 'three';

interface InteractiveGlobeProps {
  url: string;
  color: string;
}

export function InteractiveGlobe({ url, color }: InteractiveGlobeProps) {
  const meshRef = React.useRef<THREE.Mesh>(null);
  const tex = useTexture(url);
  
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

  const { gl } = useThree();
  useFrame((state) => {
    const isVisible = (() => {
        try {
            const rect = gl.domElement.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom > 0;
        } catch(e) { return true; }
    })();

    if (!isVisible) return; // Do not update animation if off-screen

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
        <meshStandardMaterial map={tex} color={hovered ? '#ffffff' : '#f0f0f0'} roughness={0.7} emissive={new THREE.Color(color).multiplyScalar(0.1)} />
      </mesh>
      <OrbitControls enableZoom={false} enablePan={false} />
    </>
  );
}
