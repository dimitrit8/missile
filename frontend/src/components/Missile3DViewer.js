import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function Missile3DViewer({ missileSpec }) {
  const containerRef = useRef();
  const rendererRef = useRef();
  const animationRef = useRef();

  useEffect(() => {
    if (!missileSpec || !containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);

    const camera = new THREE.PerspectiveCamera(45, containerRef.current.clientWidth / 500, 0.1, 1000);
    camera.position.set(10, 5, 10);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, 500);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Enhanced lighting for realism
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(10, 15, 10);
    mainLight.castShadow = true;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x4a90e2, 0.5);
    rimLight.position.set(-10, 5, -10);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xff9933, 0.3);
    fillLight.position.set(0, -5, 5);
    scene.add(fillLight);

    const { length, diameter } = missileSpec.dimensions;
    const radius = diameter / 2;
    const missileGroup = new THREE.Group();

    // Create realistic materials based on missile type
    const createMaterials = (type) => {
      if (type.includes('Interceptor')) {
        return {
          body: new THREE.MeshStandardMaterial({ 
            color: 0xf0f0f0, 
            metalness: 0.9, 
            roughness: 0.15,
            envMapIntensity: 1
          }),
          accent: new THREE.MeshStandardMaterial({ 
            color: 0x0066cc, 
            metalness: 0.95, 
            roughness: 0.1 
          }),
          detail: new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a, 
            metalness: 0.7, 
            roughness: 0.4 
          })
        };
      } else if (type.includes('Cruise')) {
        return {
          body: new THREE.MeshStandardMaterial({ 
            color: 0x3a5a3a, 
            metalness: 0.7, 
            roughness: 0.3 
          }),
          accent: new THREE.MeshStandardMaterial({ 
            color: 0x8b4513, 
            metalness: 0.6, 
            roughness: 0.4 
          }),
          detail: new THREE.MeshStandardMaterial({ 
            color: 0x2d2d2d, 
            metalness: 0.8, 
            roughness: 0.2 
          })
        };
      } else if (type.includes('Ballistic') || type.includes('Hypersonic')) {
        return {
          body: new THREE.MeshStandardMaterial({ 
            color: 0x4a4a4a, 
            metalness: 0.95, 
            roughness: 0.1 
          }),
          accent: new THREE.MeshStandardMaterial({ 
            color: 0xcc3333, 
            metalness: 0.9, 
            roughness: 0.15 
          }),
          detail: new THREE.MeshStandardMaterial({ 
            color: 0xffcc00, 
            metalness: 0.8, 
            roughness: 0.2 
          })
        };
      } else {
        return {
          body: new THREE.MeshStandardMaterial({ 
            color: 0x5a5a5a, 
            metalness: 0.6, 
            roughness: 0.4 
          }),
          accent: new THREE.MeshStandardMaterial({ 
            color: 0xff6600, 
            metalness: 0.7, 
            roughness: 0.3 
          }),
          detail: new THREE.MeshStandardMaterial({ 
            color: 0x333333, 
            metalness: 0.5, 
            roughness: 0.5 
          })
        };
      }
    };

    const materials = createMaterials(missileSpec.type);

    // Build different missile types with unique characteristics
    if (missileSpec.type.includes('Interceptor')) {
      // Sleek interceptor design
      // Main body segments
      const bodySegments = 3;
      for (let i = 0; i < bodySegments; i++) {
        const segmentLength = length / bodySegments;
        const segmentRadius = radius * (1 - i * 0.05);
        const bodyGeometry = new THREE.CylinderGeometry(segmentRadius, segmentRadius * 0.95, segmentLength, 24);
        const body = new THREE.Mesh(bodyGeometry, materials.body);
        body.position.y = -length/2 + segmentLength * i + segmentLength/2;
        body.castShadow = true;
        body.receiveShadow = true;
        missileGroup.add(body);
        
        // Add separation rings
        if (i > 0) {
          const ringGeometry = new THREE.TorusGeometry(segmentRadius * 1.02, 0.02, 8, 24);
          const ring = new THREE.Mesh(ringGeometry, materials.accent);
          ring.position.y = -length/2 + segmentLength * i;
          ring.rotation.x = Math.PI / 2;
          missileGroup.add(ring);
        }
      }

      // Sharp nose cone
      const noseGeometry = new THREE.ConeGeometry(radius * 0.8, radius * 4, 24);
      const nose = new THREE.Mesh(noseGeometry, materials.accent);
      nose.position.y = length / 2 + radius * 2;
      nose.castShadow = true;
      missileGroup.add(nose);

      // Control fins (4-way symmetric)
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const finGeometry = new THREE.BoxGeometry(0.03, radius * 3, radius * 0.15);
        const fin = new THREE.Mesh(finGeometry, materials.detail);
        fin.position.x = Math.cos(angle) * radius * 0.9;
        fin.position.z = Math.sin(angle) * radius * 0.9;
        fin.position.y = length * 0.2;
        fin.rotation.y = angle;
        fin.castShadow = true;
        missileGroup.add(fin);
      }

      // Booster section
      const boosterGeometry = new THREE.CylinderGeometry(radius * 1.1, radius * 1.15, radius * 0.8, 16);
      const booster = new THREE.Mesh(boosterGeometry, materials.detail);
      booster.position.y = -length / 2 - radius * 0.4;
      booster.castShadow = true;
      missileGroup.add(booster);

    } else if (missileSpec.type.includes('Cruise')) {
      // Cruise missile with wings
      // Main fuselage
      const bodyGeometry = new THREE.CylinderGeometry(radius, radius * 0.85, length, 32);
      const body = new THREE.Mesh(bodyGeometry, materials.body);
      body.castShadow = true;
      body.receiveShadow = true;
      missileGroup.add(body);

      // Nose cone - streamlined
      const noseGeometry = new THREE.ConeGeometry(radius, radius * 2.5, 32);
      const nose = new THREE.Mesh(noseGeometry, materials.accent);
      nose.position.y = length / 2 + radius * 1.25;
      nose.castShadow = true;
      missileGroup.add(nose);

      // Air intake
      const intakeGeometry = new THREE.CylinderGeometry(radius * 0.3, radius * 0.35, radius * 0.5, 16);
      const intake = new THREE.Mesh(intakeGeometry, materials.detail);
      intake.position.y = -length * 0.3;
      intake.rotation.x = Math.PI / 2;
      intake.castShadow = true;
      missileGroup.add(intake);

      // Wings (main - swept back)
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(length * 0.4, -radius * 0.2);
      wingShape.lineTo(length * 0.5, -radius * 0.2);
      wingShape.lineTo(length * 0.3, radius * 0.2);
      wingShape.lineTo(0, radius * 0.2);
      
      const wingGeometry = new THREE.ExtrudeGeometry(wingShape, { depth: 0.05, bevelEnabled: false });
      const wing1 = new THREE.Mesh(wingGeometry, materials.detail);
      wing1.position.set(radius, -length * 0.25, 0);
      wing1.rotation.y = Math.PI / 2;
      wing1.castShadow = true;
      missileGroup.add(wing1);
      
      const wing2 = wing1.clone();
      wing2.position.set(-radius, -length * 0.25, 0);
      wing2.rotation.y = -Math.PI / 2;
      missileGroup.add(wing2);

      // Tail fins (4-way)
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const tailFinGeometry = new THREE.BoxGeometry(0.02, radius * 1.8, radius * 0.12);
        const tailFin = new THREE.Mesh(tailFinGeometry, materials.detail);
        tailFin.position.x = Math.cos(angle) * radius * 0.8;
        tailFin.position.z = Math.sin(angle) * radius * 0.8;
        tailFin.position.y = -length / 2 + radius;
        tailFin.rotation.y = angle;
        tailFin.castShadow = true;
        missileGroup.add(tailFin);
      }

      // Engine nozzle
      const nozzleGeometry = new THREE.CylinderGeometry(radius * 0.6, radius * 0.8, radius * 0.6, 16);
      const nozzle = new THREE.Mesh(nozzleGeometry, materials.accent);
      nozzle.position.y = -length / 2 - radius * 0.3;
      nozzle.castShadow = true;
      missileGroup.add(nozzle);

    } else if (missileSpec.type.includes('Ballistic') || missileSpec.type.includes('Hypersonic')) {
      // Large ballistic missile
      // Multi-stage body
      const stage1Geometry = new THREE.CylinderGeometry(radius, radius, length * 0.6, 32);
      const stage1 = new THREE.Mesh(stage1Geometry, materials.body);
      stage1.position.y = -length * 0.2;
      stage1.castShadow = true;
      stage1.receiveShadow = true;
      missileGroup.add(stage1);

      const stage2Geometry = new THREE.CylinderGeometry(radius * 0.85, radius, length * 0.3, 32);
      const stage2 = new THREE.Mesh(stage2Geometry, materials.accent);
      stage2.position.y = length * 0.25;
      stage2.castShadow = true;
      stage2.receiveShadow = true;
      missileGroup.add(stage2);

      // Warhead section
      const warheadGeometry = new THREE.ConeGeometry(radius * 0.85, radius * 3.5, 32);
      const warhead = new THREE.Mesh(warheadGeometry, materials.detail);
      warhead.position.y = length / 2 + radius * 1.75;
      warhead.castShadow = true;
      missileGroup.add(warhead);

      // Control surfaces
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const finGeometry = new THREE.BoxGeometry(0.04, radius * 1.2, radius * 0.2);
        const fin = new THREE.Mesh(finGeometry, materials.detail);
        fin.position.x = Math.cos(angle) * radius * 0.95;
        fin.position.z = Math.sin(angle) * radius * 0.95;
        fin.position.y = -length * 0.35;
        fin.rotation.y = angle;
        fin.castShadow = true;
        missileGroup.add(fin);
      }

      // Engine bells
      const engineBellGeometry = new THREE.CylinderGeometry(radius * 0.7, radius * 0.9, radius, 16);
      const engineBell = new THREE.Mesh(engineBellGeometry, materials.accent);
      engineBell.position.y = -length / 2 - radius * 0.5;
      engineBell.castShadow = true;
      missileGroup.add(engineBell);

      // Warning stripes
      for (let i = 0; i < 3; i++) {
        const stripeGeometry = new THREE.TorusGeometry(radius * 1.01, 0.03, 8, 32);
        const stripe = new THREE.Mesh(stripeGeometry, materials.detail);
        stripe.position.y = -length * 0.15 + i * length * 0.15;
        stripe.rotation.x = Math.PI / 2;
        missileGroup.add(stripe);
      }

    } else {
      // Drone/rocket - small and compact
      const bodyGeometry = new THREE.CylinderGeometry(radius, radius * 0.9, length, 24);
      const body = new THREE.Mesh(bodyGeometry, materials.body);
      body.castShadow = true;
      missileGroup.add(body);

      const noseGeometry = new THREE.ConeGeometry(radius, radius * 1.5, 24);
      const nose = new THREE.Mesh(noseGeometry, materials.accent);
      nose.position.y = length / 2 + radius * 0.75;
      nose.castShadow = true;
      missileGroup.add(nose);

      // Small stabilizer fins
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const finGeometry = new THREE.BoxGeometry(0.02, radius * 1.5, radius * 0.1);
        const fin = new THREE.Mesh(finGeometry, materials.detail);
        fin.position.x = Math.cos(angle) * radius * 0.85;
        fin.position.z = Math.sin(angle) * radius * 0.85;
        fin.position.y = -length / 3;
        fin.rotation.y = angle;
        fin.castShadow = true;
        missileGroup.add(fin);
      }
    }

    scene.add(missileGroup);

    // Ground with shadows
    const groundGeometry = new THREE.PlaneGeometry(40, 40);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -length / 2 - 1.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid
    const gridHelper = new THREE.GridHelper(30, 30, 0x27272a, 0x1a1a1a);
    gridHelper.position.y = -length / 2 - 1.49;
    scene.add(gridHelper);

    // Animation
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      // Smooth rotation
      missileGroup.rotation.y += (targetRotationY - missileGroup.rotation.y) * 0.05;
      missileGroup.rotation.x += (targetRotationX - missileGroup.rotation.x) * 0.05;
      
      // Auto-rotate when not interacting
      targetRotationY += 0.003;
      
      renderer.render(scene, camera);
    };
    animate();

    // Mouse interaction
    let isDragging = false;
    
    const onMouseDown = () => { isDragging = true; };
    const onMouseUp = () => { isDragging = false; };
    
    const onMouseMove = (e) => {
      if (isDragging) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        targetRotationY += mouseX * 0.05;
        targetRotationX = mouseY * 0.5;
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z = Math.max(5, Math.min(20, camera.position.z + e.deltaY * 0.01));
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [missileSpec]);

  if (!missileSpec) return <div style={{ padding: '40px', textAlign: 'center', color: '#71717A' }}>Loading 3D model...</div>;

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '500px', 
        background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)', 
        borderRadius: '4px', 
        border: '1px solid #27272A',
        cursor: 'grab',
        position: 'relative'
      }}
    >
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        color: '#71717A',
        fontSize: '11px',
        fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.7)',
        padding: '4px 8px',
        borderRadius: '2px',
        zIndex: 10
      }}>
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}
