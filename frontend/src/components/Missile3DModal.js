/**
 * Missile3DModal.js
 * Fullscreen-style modal that wraps Missile3DViewer
 * Opened when the user clicks "3D View" next to any missile/interceptor card
 */

import React, { useEffect, useState } from 'react';
import Missile3DViewer from './Missile3DViewer';

export default function Missile3DModal({ missile, onClose }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!missile) return null;

  const missileId = missile.id || missile.name?.toLowerCase().replace(/[\s-]/g, '');
  const viewerHeight = isMobile ? Math.min(window.innerHeight * 0.45, 280) : 500;

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : '16px',
        overflowY: isMobile ? 'auto' : 'hidden',
      }}
    >
      {/* Modal panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '900px',
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: isMobile ? '12px 12px 0 0' : '12px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(16,185,129,0.1)',
          maxHeight: isMobile ? '92vh' : 'calc(100vh - 32px)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Mobile drag handle */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#374151' }} />
          </div>
        )}

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '10px 16px' : '14px 20px',
          borderBottom: '1px solid #1f2937',
          background: '#0d1117',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#10b981', display: 'inline-block',
              animation: 'pulse3d 2s ease-in-out infinite',
              boxShadow: '0 0 6px #10b981',
            }} />
            <div>
              <h2 style={{
                margin: 0, fontSize: isMobile ? '14px' : '16px', fontWeight: 700,
                color: '#e5e7eb', fontFamily: 'monospace', letterSpacing: 1,
              }}>
                {missile.name}
              </h2>
              <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                {missile.type} · {missile.country || 'Unknown origin'}
                {!isMobile && missile.range_km && ` · Range: ${missile.range_km.toLocaleString()} km`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid #374151', borderRadius: '6px',
              color: '#9ca3af', cursor: 'pointer', fontSize: '18px',
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 3D Viewer — touch-action: none so Three.js can capture all touch events */}
        <div style={{ padding: isMobile ? '10px' : '16px', flexShrink: 0 }}>
          <div style={{ touchAction: 'none' }}>
            <Missile3DViewer
              key={missileId}
              missileId={missileId}
              missileSpec={missile}
              height={viewerHeight}
            />
          </div>
        </div>

        {/* Specs strip */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 0,
          borderTop: '1px solid #1f2937', flexShrink: 0,
          overflowX: isMobile ? 'auto' : 'visible',
        }}>
          {[
            missile.range_km && { label: 'Range', value: `${missile.range_km.toLocaleString()} km` },
            missile.speed_mach && { label: 'Speed', value: `Mach ${missile.speed_mach}` },
            missile.weight_kg && { label: 'Weight', value: `${missile.weight_kg.toLocaleString()} kg` },
            missile.warhead_kg && { label: 'Warhead', value: `${missile.warhead_kg} kg` },
            missile.cep_m && { label: 'CEP', value: `${missile.cep_m} m` },
            missile.cost && { label: 'Cost', value: `$${(missile.cost / 1e6).toFixed(1)}M` },
          ].filter(Boolean).map(({ label, value }) => (
            <div key={label} style={{
              flex: isMobile ? '0 0 auto' : '1 1 120px',
              minWidth: isMobile ? 90 : undefined,
              padding: isMobile ? '8px 12px' : '10px 16px',
              borderRight: '1px solid #1f2937',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: isMobile ? '12px' : '13px', color: '#10b981', fontFamily: 'monospace', fontWeight: 700, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '7px 16px', background: '#0d1117',
          borderTop: '1px solid #1f2937',
          fontSize: '10px', color: '#4b5563', fontFamily: 'monospace', textAlign: 'center',
          flexShrink: 0,
        }}>
          {isMobile
            ? 'Drag to rotate · Pinch to zoom · Two fingers to pan'
            : 'Drag to rotate · Scroll to zoom · Right-drag to pan · ESC to close'}
        </div>
      </div>

      <style>{`
        @keyframes pulse3d {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}