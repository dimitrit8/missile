import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function Missile3DViewer({ missileSpec }) {
  const containerRef = useRef();
  const rendererRef = useRef();
  const sceneRef = useRef();
  const cameraRef = useRef();
  const animationRef = useRef();

  useEffect(() => {
    if (!missileSpec || !containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0A0A0A);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / 500, 0.1, 1000);
    camera.position.set(8, 4, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, 500);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-10, -10, -5);
    scene.add(pointLight);

    // Create missile
    const { length, diameter } = missileSpec.dimensions;
    const radius = diameter / 2;

    const getColor = (type) => {
      if (type.includes('Interceptor')) return 0x3498db;
      if (type.includes('Cruise')) return 0x2ecc71;
      if (type.includes('Ballistic')) return 0xe74c3c;
      return 0xf39c12;
    };

    const missileGroup = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.CylinderGeometry(radius, radius * 0.7, length, 20);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: getColor(missileSpec.type), 
      metalness: 0.8, 
      roughness: 0.2 
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    missileGroup.add(body);

    // Nose cone
    const noseGeometry = new THREE.ConeGeometry(radius, radius * 2, 20);
    const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
    nose.position.y = length / 2 + radius;
    nose.castShadow = true;
    missileGroup.add(nose);

    // Wings for cruise missiles
    if (missileSpec.type.includes('Cruise')) {
      const wingGeometry = new THREE.BoxGeometry(0.05, missileSpec.dimensions.wingspan || length * 0.6, radius * 0.3);
      const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.7, roughness: 0.3 });
      const wing = new THREE.Mesh(wingGeometry, wingMaterial);
      wing.position.y = -length / 3;
      wing.rotation.z = Math.PI / 2;
      wing.castShadow = true;
      missileGroup.add(wing);
    }

    scene.add(missileGroup);

    // Ground plane
    const planeGeometry = new THREE.PlaneGeometry(50, 50);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x0A0A0A, metalness: 0.1, roughness: 0.9 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -length / 2 - 1;
    plane.receiveShadow = true;
    scene.add(plane);

    // Grid
    const gridHelper = new THREE.GridHelper(20, 20, 0x27272A, 0x141414);
    gridHelper.position.y = -length / 2 - 0.99;
    scene.add(gridHelper);

    // Animation
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      missileGroup.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();

    // Mouse controls
    let isDragging = false;
    let previousMouseX = 0;
    let previousMouseY = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      previousMouseX = e.clientX;
      previousMouseY = e.clientY;
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMouseX;
      const deltaY = e.clientY - previousMouseY;
      
      camera.position.x += deltaX * 0.01;
      camera.position.y -= deltaY * 0.01;
      camera.lookAt(0, 0, 0);
      
      previousMouseX = e.clientX;
      previousMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY * 0.01;
      camera.position.z += delta;
      camera.position.z = Math.max(3, Math.min(15, camera.position.z));
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [missileSpec]);

  if (!missileSpec) return <div>Loading...</div>;

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '500px', 
        background: '#0A0A0A', 
        borderRadius: '4px', 
        border: '1px solid #27272A',
        cursor: 'grab'
      }}
    />
  );
}
