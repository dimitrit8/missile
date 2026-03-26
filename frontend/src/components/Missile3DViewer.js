import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function MissileModel({ dimensions, type, color }) {
  const meshRef = useRef();
  const { length, diameter } = dimensions;
  const radius = diameter / 2;
  
  return (
    <group ref={meshRef}>
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[radius, radius * 0.7, length, 20]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, length / 2 + radius, 0]} castShadow>
        <coneGeometry args={[radius, radius * 2, 20]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

export default function Missile3DViewer({ missileSpec }) {
  if (!missileSpec) return <div>Loading...</div>;

  const getColor = (type) => {
    if (type.includes('Interceptor')) return '#3498db';
    if (type.includes('Cruise')) return '#2ecc71';
    if (type.includes('Ballistic')) return '#e74c3c';
    return '#f39c12';
  };

  return (
    <div style={{ width: '100%', height: '500px', background: '#0A0A0A' }}>
      <Canvas shadows camera={{ position: [8, 4, 8] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        <MissileModel 
          dimensions={missileSpec.dimensions}
          type={missileSpec.type}
          color={getColor(missileSpec.type)}
        />
        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[20, 20, '#27272A', '#141414']} position={[0, -missileSpec.dimensions.length / 2 - 1, 0]} />
      </Canvas>
    </div>
  );
}
