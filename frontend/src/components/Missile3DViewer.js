/**
 * Missile3DViewer.js  —  VANILLA Three.js (no @react-three/fiber)
 *
 * Uses plain Three.js imperative API so there is zero dependency on
 * @react-three/fiber / @react-three/drei, which cause applyProps crashes
 * in the Emergent bundler.
 *
 * Features
 *  - Left-drag  → rotate
 *  - Right-drag → pan
 *  - Scroll     → zoom
 *  - Auto-rotate toggle
 *  - Loads GLB from backend proxy (/api/glb/<id>)
 *  - Falls back to procedural mesh when no GLB configured
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// ─── Manual orbit controls (mouse + touch) ───────────────────────────────────
function attachOrbitControls(camera, domElement, onUserInteract) {
  let state = { rotating: false, panning: false };
  let last = { x: 0, y: 0 };
  let spherical = { theta: 0.3, phi: 1.1, r: 6 };
  const target = new THREE.Vector3(0, 0, 0);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const sync = () => {
    camera.position.set(
      target.x + spherical.r * Math.sin(spherical.phi) * Math.sin(spherical.theta),
      target.y + spherical.r * Math.cos(spherical.phi),
      target.z + spherical.r * Math.sin(spherical.phi) * Math.cos(spherical.theta)
    );
    camera.lookAt(target);
  };
  sync();

  // ── Mouse events ──────────────────────────────────────────────────────────
  const down = (e) => {
    if (e.button === 2) state.panning = true;
    else               state.rotating = true;
    last = { x: e.clientX, y: e.clientY };
    onUserInteract && onUserInteract();
  };
  const move = (e) => {
    if (!state.rotating && !state.panning) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    if (state.panning) {
      const k = spherical.r * 0.002;
      target.x -= dx * k;
      target.y += dy * k;
    } else {
      spherical.theta -= dx * 0.008;
      spherical.phi    = clamp(spherical.phi - dy * 0.008, 0.15, Math.PI - 0.15);
    }
    sync();
  };
  const up   = ()  => { state.rotating = false; state.panning = false; };
  const wheel = (e) => {
    spherical.r = clamp(spherical.r * (1 + e.deltaY * 0.001), 1.5, 22);
    sync();
    onUserInteract && onUserInteract();
  };
  const ctx  = (e) => e.preventDefault();

  // ── Touch events ──────────────────────────────────────────────────────────
  let lastTouchDist = null; // for pinch-to-zoom
  let lastTouchMid  = null; // for two-finger pan
  let touchCount    = 0;

  const getTouchDist = (t) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const getTouchMid = (t) => ({
    x: (t[0].clientX + t[1].clientX) / 2,
    y: (t[0].clientY + t[1].clientY) / 2,
  });

  const touchStart = (e) => {
    e.preventDefault();
    touchCount = e.touches.length;
    onUserInteract && onUserInteract();
    if (touchCount === 1) {
      last = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      state.rotating = true;
      state.panning  = false;
      lastTouchDist  = null;
      lastTouchMid   = null;
    } else if (touchCount === 2) {
      state.rotating = false;
      state.panning  = false;
      lastTouchDist  = getTouchDist(e.touches);
      lastTouchMid   = getTouchMid(e.touches);
    }
  };

  const touchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && state.rotating) {
      const dx = e.touches[0].clientX - last.x;
      const dy = e.touches[0].clientY - last.y;
      last = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      spherical.theta -= dx * 0.008;
      spherical.phi    = clamp(spherical.phi - dy * 0.008, 0.15, Math.PI - 0.15);
      sync();
    } else if (e.touches.length === 2) {
      // Pinch-to-zoom
      const dist = getTouchDist(e.touches);
      if (lastTouchDist !== null) {
        const scale = lastTouchDist / dist;
        spherical.r = clamp(spherical.r * scale, 1.5, 22);
      }
      lastTouchDist = dist;

      // Two-finger pan
      const mid = getTouchMid(e.touches);
      if (lastTouchMid !== null) {
        const dx = mid.x - lastTouchMid.x;
        const dy = mid.y - lastTouchMid.y;
        const k  = spherical.r * 0.002;
        target.x -= dx * k;
        target.y += dy * k;
      }
      lastTouchMid = mid;
      sync();
    }
  };

  const touchEnd = (e) => {
    touchCount = e.touches.length;
    if (touchCount === 0) {
      state.rotating = false;
      lastTouchDist  = null;
      lastTouchMid   = null;
    } else if (touchCount === 1) {
      // Went from 2 fingers to 1 — restart single-finger tracking
      last = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      state.rotating = true;
      lastTouchDist  = null;
      lastTouchMid   = null;
    }
  };

  domElement.addEventListener('mousedown',   down);
  domElement.addEventListener('mousemove',   move);
  domElement.addEventListener('mouseup',     up);
  domElement.addEventListener('mouseleave',  up);
  domElement.addEventListener('wheel',       wheel, { passive: true });
  domElement.addEventListener('contextmenu', ctx);

  domElement.addEventListener('touchstart',  touchStart,  { passive: false });
  domElement.addEventListener('touchmove',   touchMove,   { passive: false });
  domElement.addEventListener('touchend',    touchEnd,    { passive: false });
  domElement.addEventListener('touchcancel', touchEnd,    { passive: false });

  return () => {
    domElement.removeEventListener('mousedown',   down);
    domElement.removeEventListener('mousemove',   move);
    domElement.removeEventListener('mouseup',     up);
    domElement.removeEventListener('mouseleave',  up);
    domElement.removeEventListener('wheel',       wheel);
    domElement.removeEventListener('contextmenu', ctx);
    domElement.removeEventListener('touchstart',  touchStart);
    domElement.removeEventListener('touchmove',   touchMove);
    domElement.removeEventListener('touchend',    touchEnd);
    domElement.removeEventListener('touchcancel', touchEnd);
  };
}

// ─── Procedural fallback geometry ────────────────────────────────────────────
function buildProceduralModel(group, missileSpec) {
  const isInterceptor = missileSpec?.type?.toLowerCase().includes('interceptor');

  const bodyColor = missileSpec?.country === 'Russia' ? 0x4b5563
    : missileSpec?.country === 'Iran'   ? 0x7c3aed
    : missileSpec?.country === 'Israel' ? 0x1d4ed8
    : 0x6b7280;

  const mat   = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.7, roughness: 0.3 });
  const red   = new THREE.MeshStandardMaterial({ color: 0xef4444,  metalness: 0.5, roughness: 0.4 });
  const dark  = new THREE.MeshStandardMaterial({ color: 0x374151,  metalness: 0.8, roughness: 0.2 });
  const blue  = new THREE.MeshStandardMaterial({ color: 0x1e3a5f,  metalness: 0.6, roughness: 0.4 });

  const add = (geo, m, pos, rot) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (pos) mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    group.add(mesh);
  };

  if (isInterceptor) {
    // Sleek vertical-launch interceptor
    add(new THREE.CylinderGeometry(0.06, 0.07, 2.0, 16),  mat);
    add(new THREE.ConeGeometry(0.06, 0.30, 16),            mat, [0, 1.15, 0]);
    [0, 90, 180, 270].forEach(d => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.40, 0.015), mat);
      fin.castShadow = true;
      fin.position.set(0, -0.9, 0);
      fin.rotation.y = d * Math.PI / 180;
      group.add(fin);
    });
    add(new THREE.CylinderGeometry(0.07, 0.09, 0.40, 16), blue, [0, -1.2, 0]);
  } else {
    // Cruise / ballistic missile
    add(new THREE.CylinderGeometry(0.08, 0.10, 2.5, 16),  mat);
    add(new THREE.ConeGeometry(0.08, 0.40, 16),            mat, [0, 1.45, 0]);
    add(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 16), red, [0, 0.95, 0]);
    // Wings
    [-1, 1].forEach(s => {
      add(new THREE.BoxGeometry(0.55, 0.08, 0.60), mat, [s * 0.38, 0, 0]);
    });
    // Tail fins
    [0, 90, 180, 270].forEach(d => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.50, 0.015), mat);
      fin.castShadow = true;
      fin.position.set(0, -1.1, 0);
      fin.rotation.y = d * Math.PI / 180;
      group.add(fin);
    });
    // Nozzle
    add(new THREE.CylinderGeometry(0.06, 0.10, 0.20, 16), dark, [0, -1.45, 0]);
  }

  // Tilt so missile is horizontal
  group.rotation.z = Math.PI / 2;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Missile3DViewer({ missileId, missileSpec, height = 420 }) {
  const wrapRef    = useRef();          // outer positioning div
  const canvasWrap = useRef();          // three.js renderer goes here
  const [hasGlb,      setHasGlb]      = useState(false);
  const [autoRotate,  setAutoRotate]  = useState(true);
  const [glbStatus,   setGlbStatus]   = useState('checking'); // 'checking'|'ready'
  const autoRotateRef = useRef(true);

  // Keep ref in sync so the animation loop can read it without re-creating
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  const stopAutoRotate = useCallback(() => {
    autoRotateRef.current = false;
    setAutoRotate(false);
  }, []);

  useEffect(() => {
    const el = canvasWrap.current;
    if (!el) return;

    // ── Renderer ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x0d1117);
    const setSize = () => {
      renderer.setSize(el.clientWidth, height);
      camera.aspect = el.clientWidth / height;
      camera.updateProjectionMatrix();
    };
    el.appendChild(renderer.domElement);

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / height, 0.1, 100);
    setSize();

    // ── Scene ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    scene.fog = new THREE.FogExp2(0x0d1117, 0.04);

    // ── Lights ───────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-5, 3, -5);
    scene.add(fill);
    const green = new THREE.PointLight(0x10b981, 0.4, 10);
    green.position.set(0, -3, 0);
    scene.add(green);

    // ── Floor ────────────────────────────────────────────────────────────────
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ color: 0x0d1117 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.5;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid lines overlay (simple LineSegments — no shader issues)
    const gridHelper = new THREE.GridHelper(12, 24, 0x1f2937, 0x1a2030);
    gridHelper.position.y = -2.49;
    scene.add(gridHelper);

    // ── Model group ──────────────────────────────────────────────────────────
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    let modelLoaded = false;

    // Try to load GLB; fall back to procedural
    const norm = missileId ? missileId.toLowerCase().replace(/[-_\s]/g, '') : '';

    const loadProceduralFallback = () => {
      if (modelLoaded) return;
      modelLoaded = true;
      buildProceduralModel(modelGroup, missileSpec);
      setGlbStatus('ready');
    };

    const tryLoadGlb = (url) => {
      // Dynamic import so bundler doesn't break on static resolution
      import('three/examples/jsm/loaders/GLTFLoader.js')
        .then(({ GLTFLoader }) => {
          const loader = new GLTFLoader();
          loader.load(
            url,
            (gltf) => {
              if (modelLoaded) return;
              modelLoaded = true;
              const model = gltf.scene;
              const box = new THREE.Box3().setFromObject(model);
              const center = box.getCenter(new THREE.Vector3());
              const size   = box.getSize(new THREE.Vector3());
              const maxDim = Math.max(size.x, size.y, size.z) || 1;
              model.position.sub(center);
              model.scale.setScalar(3 / maxDim);
              model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
              modelGroup.add(model);
              setHasGlb(true);
              setGlbStatus('ready');
            },
            undefined,
            () => loadProceduralFallback()
          );
        })
        .catch(() => loadProceduralFallback());
    };

    if (norm) {
      fetch(`${API_BASE}/api/glb-check/${norm}`)
        .then(r => r.json())
        .then(d => {
          if (d.available) tryLoadGlb(`${API_BASE}/api/glb/${norm}`);
          else loadProceduralFallback();
        })
        .catch(() => loadProceduralFallback());
    } else {
      loadProceduralFallback();
    }

    // ── Orbit controls ───────────────────────────────────────────────────────
    const detachControls = attachOrbitControls(camera, renderer.domElement, stopAutoRotate);

    // ── Animation loop ───────────────────────────────────────────────────────
    let rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (autoRotateRef.current) modelGroup.rotation.y += 0.004;
      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ───────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(setSize);
    ro.observe(el);

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      detachControls();
      ro.disconnect();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missileId, missileSpec, height]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative', width: '100%', height,
        background: '#0d1117', borderRadius: 8, overflow: 'hidden',
      }}
    >
      {/* Top-left badges */}
      <div style={{
        position: 'absolute', top: 10, left: 12, zIndex: 10,
        display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'none',
      }}>
        <span style={{
          background: '#10b981', color: '#000', fontSize: 10,
          fontWeight: 700, fontFamily: 'monospace',
          padding: '2px 7px', borderRadius: 3, letterSpacing: 1,
        }}>3D VIEW</span>
        {hasGlb ? (
          <span style={{
            background: '#1e40af', color: '#93c5fd', fontSize: 10,
            fontWeight: 700, fontFamily: 'monospace',
            padding: '2px 7px', borderRadius: 3,
          }}>GLB MODEL</span>
        ) : glbStatus === 'ready' ? (
          <span style={{
            background: '#374151', color: '#9ca3af', fontSize: 10,
            fontWeight: 600, fontFamily: 'monospace',
            padding: '2px 7px', borderRadius: 3,
          }}>PROCEDURAL</span>
        ) : (
          <span style={{
            background: '#111827', color: '#6b7280', fontSize: 10,
            fontFamily: 'monospace', padding: '2px 7px', borderRadius: 3,
          }}>LOADING…</span>
        )}
      </div>

      {/* Auto-rotate toggle */}
      <button
        onClick={() => setAutoRotate(p => !p)}
        style={{
          position: 'absolute', top: 10, right: 12, zIndex: 10,
          background: autoRotate ? '#10b981' : '#374151',
          color: autoRotate ? '#000' : '#9ca3af',
          border: 'none', borderRadius: 4,
          padding: '4px 10px', fontSize: 11,
          fontFamily: 'monospace', cursor: 'pointer', fontWeight: 600,
        }}
      >
        {autoRotate ? '⟳ AUTO' : '⟳ MANUAL'}
      </button>

      {/* Help text */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, color: '#4b5563', fontSize: 11, fontFamily: 'monospace',
        pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        Drag to rotate · Scroll to zoom · Right-drag to pan
      </div>

      {/* Three.js canvas mount point */}
      <div ref={canvasWrap} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}