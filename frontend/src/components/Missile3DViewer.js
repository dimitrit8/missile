import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';

const MissileModel = ({ dimensions, type, color }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current && !hovered) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  const { length, diameter } = dimensions;
  const radius = diameter / 2;
  
  if (type.includes('Cruise') || type.includes('Drone')) {
    return (
      <group ref={meshRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[radius, radius * 0.6, length, 16]} />
          <meshStandardMaterial color={hovered ? '#ff6b6b' : color} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, length / 2 + radius, 0]} castShadow>
          <coneGeometry args={[radius, radius * 2, 16]} />
          <meshStandardMaterial color={hovered ? '#ff6b6b' : color} metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, -length / 3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <boxGeometry args={[0.05, dimensions.wingspan || length * 0.6, radius * 0.3]} />
          <meshStandardMaterial color={hovered ? '#4ecdc4' : '#2c3e50'} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    );
  } else if (type.includes('Ballistic') || type.includes('Hypersonic')) {
    return (
      <group ref={meshRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[radius, radius, length, 24]} />
          <meshStandardMaterial color={hovered ? '#e74c3c' : color} metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0, length / 2 + radius * 1.5, 0]} castShadow>
          <coneGeometry args={[radius, radius * 3, 24]} />
          <meshStandardMaterial color={hovered ? '#c0392b' : '#7f8c8d'} metalness={0.95} roughness={0.1} />
        </mesh>
      </group>
    );
  } else if (type.includes('Interceptor')) {
    return (
      <group ref={meshRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[radius, radius * 0.7, length, 20]} />
          <meshStandardMaterial color={hovered ? '#3498db' : color} metalness={0.95} roughness={0.1} />
        </mesh>
        <mesh position={[0, length / 2 + radius * 2, 0]} castShadow>
          <coneGeometry args={[radius, radius * 4, 20]} />
          <meshStandardMaterial color={hovered ? '#2980b9' : '#ecf0f1'} metalness={1.0} roughness={0.05} />
        </mesh>
      </group>
    );
  } else {
    return (
      <group ref={meshRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[radius, radius, length, 16]} />
          <meshStandardMaterial color={hovered ? '#e67e22' : color} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, length / 2 + radius, 0]} castShadow>
          <coneGeometry args={[radius, radius * 2, 16]} />
          <meshStandardMaterial color={hovered ? '#d35400' : '#95a5a6'} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    );
  }
};

const Missile3DViewer = ({ missileSpec }) => {
  if (!missileSpec || !missileSpec.dimensions) {
    return <div>Loading...</div>;
  }

  const getMissileColor = (type) => {
    if (type.includes('Interceptor')) return '#3498db';
    if (type.includes('Cruise')) return '#2ecc71';
    if (type.includes('Ballistic')) return '#e74c3c';
    if (type.includes('Drone')) return '#f39c12';
    return '#95a5a6';
  };

  return (
    <div className="w-full h-[500px] bg-[#0A0A0A] rounded-sm border border-[#27272A] overflow-hidden">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[8, 4, 8]} />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} minDistance={3} maxDistance={20} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        <MissileModel dimensions={missileSpec.dimensions} type={missileSpec.type} color={getMissileColor(missileSpec.type)} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -missileSpec.dimensions.length / 2 - 1, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#0A0A0A" metalness={0.1} roughness={0.9} />
        </mesh>
        <gridHelper args={[20, 20, '#27272A', '#141414']} position={[0, -missileSpec.dimensions.length / 2 - 0.99, 0]} />
        <Environment preset="night" />
      </Canvas>
    </div>
  );
};

export default Missile3DViewer;