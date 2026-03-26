import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';

// 3D Missile Model Component
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
  
  // Create missile shape based on type
  const createMissileGeometry = () => {
    if (type.includes('Cruise') || type.includes('Drone')) {
      // Cruise missile/drone with wings
      return (
        <group ref={meshRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
          {/* Main body */}
          <mesh position={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[radius, radius * 0.6, length, 16]} />
            <meshStandardMaterial 
              color={hovered ? '#ff6b6b' : color}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
          
          {/* Nose cone */}
          <mesh position={[0, length / 2 + radius, 0]} castShadow>
            <coneGeometry args={[radius, radius * 2, 16]} />
            <meshStandardMaterial 
              color={hovered ? '#ff6b6b' : color}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          
          {/* Wings */}
          <mesh position={[0, -length / 3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <boxGeometry args={[0.05, dimensions.wingspan || length * 0.6, radius * 0.3]} />
            <meshStandardMaterial color={hovered ? '#4ecdc4' : '#2c3e50'} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, -length / 3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <boxGeometry args={[0.05, dimensions.wingspan || length * 0.6, radius * 0.3]} />
            <meshStandardMaterial color={hovered ? '#4ecdc4' : '#2c3e50'} metalness={0.7} roughness={0.3} />
          </mesh>
          
          {/* Tail fins */}
          <mesh position={[0, -length / 2, 0]} rotation={[0, Math.PI / 4, Math.PI / 2]} castShadow>
            <boxGeometry args={[0.03, radius * 2, radius * 0.2]} />
            <meshStandardMaterial color={'#34495e'} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, -length / 2, 0]} rotation={[Math.PI / 2, Math.PI / 4, 0]} castShadow>
            <boxGeometry args={[0.03, radius * 2, radius * 0.2]} />
            <meshStandardMaterial color={'#34495e'} metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      );
    } else if (type.includes('Ballistic') || type.includes('Hypersonic')) {
      // Ballistic missile - more cylindrical
      return (
        <group ref={meshRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
          {/* Main body */}
          <mesh position={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[radius, radius, length, 24]} />
            <meshStandardMaterial 
              color={hovered ? '#e74c3c' : color}
              metalness={0.9}
              roughness={0.15}
            />
          </mesh>
          
          {/* Warhead */}
          <mesh position={[0, length / 2 + radius * 1.5, 0]} castShadow>
            <coneGeometry args={[radius, radius * 3, 24]} />
            <meshStandardMaterial 
              color={hovered ? '#c0392b' : '#7f8c8d'}
              metalness={0.95}
              roughness={0.1}
            />
          </mesh>
          
          {/* Engine nozzle */}
          <mesh position={[0, -length / 2 - radius * 0.3, 0]} castShadow>
            <cylinderGeometry args={[radius * 0.6, radius * 0.8, radius * 0.6, 16]} />
            <meshStandardMaterial color={'#34495e'} metalness={0.8} roughness={0.3} />
          </mesh>
          
          {/* Small control fins */}
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
            <mesh 
              key={i}
              position={[
                Math.sin(angle) * radius,
                -length / 2.5,
                Math.cos(angle) * radius
              ]} 
              rotation={[0, angle, Math.PI / 2]}
              castShadow
            >
              <boxGeometry args={[0.02, radius * 1.5, radius * 0.15]} />
              <meshStandardMaterial color={'#2c3e50'} metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
        </group>
      );
    } else if (type.includes('Interceptor')) {
      // Interceptor - sleek and fast-looking
      return (
        <group ref={meshRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
          {/* Main body */}
          <mesh position={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[radius, radius * 0.7, length, 20]} />
            <meshStandardMaterial 
              color={hovered ? '#3498db' : color}
              metalness={0.95}
              roughness={0.1}
            />
          </mesh>
          
          {/* Nose cone - sharp */}
          <mesh position={[0, length / 2 + radius * 2, 0]} castShadow>
            <coneGeometry args={[radius, radius * 4, 20]} />
            <meshStandardMaterial 
              color={hovered ? '#2980b9' : '#ecf0f1'}
              metalness={1.0}
              roughness={0.05}
            />
          </mesh>
          
          {/* Control fins - 4 symmetric */}
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
            <mesh 
              key={i}
              position={[
                Math.sin(angle) * radius * 0.8,
                length / 4,
                Math.cos(angle) * radius * 0.8
              ]} 
              rotation={[0, angle, Math.PI / 2]}
              castShadow
            >
              <boxGeometry args={[0.02, radius * 2.5, radius * 0.1]} />
              <meshStandardMaterial color={'#95a5a6'} metalness={0.9} roughness={0.2} />
            </mesh>
          ))}
          
          {/* Booster section */}
          <mesh position={[0, -length / 2 - radius * 0.5, 0]} castShadow>
            <cylinderGeometry args={[radius * 0.9, radius * 1.1, radius, 16]} />
            <meshStandardMaterial color={'#7f8c8d'} metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      );
    } else {
      // Generic rocket
      return (
        <group ref={meshRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
          <mesh position={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[radius, radius, length, 16]} />
            <meshStandardMaterial 
              color={hovered ? '#e67e22' : color}
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, length / 2 + radius, 0]} castShadow>
            <coneGeometry args={[radius, radius * 2, 16]} />
            <meshStandardMaterial 
              color={hovered ? '#d35400' : '#95a5a6'}
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
        </group>
      );
    }
  };

  return createMissileGeometry();
};

// Main 3D Viewer Component
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
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={3}
          maxDistance={20}
          autoRotate={false}
        />
        
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={1.5} 
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="#ffffff" />
        <spotLight 
          position={[0, 10, 0]} 
          angle={0.3} 
          penumbra={1} 
          intensity={0.8} 
          castShadow
        />
        
        <MissileModel 
          dimensions={missileSpec.dimensions}
          type={missileSpec.type}
          color={getMissileColor(missileSpec.type)}
        />
        
        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -missileSpec.dimensions.length / 2 - 1, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#0A0A0A" metalness={0.1} roughness={0.9} />
        </mesh>
        
        {/* Grid helper */}
        <gridHelper args={[20, 20, '#27272A', '#141414']} position={[0, -missileSpec.dimensions.length / 2 - 0.99, 0]} />
        
        <Environment preset="night" />
      </Canvas>
    </div>
  );
};

export default Missile3DViewer;
