import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Missile3DViewer from './Missile3DViewer';
import { X, Ruler, Globe, Gauge, Target, Rocket } from '@phosphor-icons/react';

export default function MissileSpecsModal({ missileId, isOpen, onClose, backendUrl }) {
  const [specs, setSpecs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && missileId) {
      axios.get(`${backendUrl}/api/missile-specifications/${missileId}`)
        .then(res => {
          setSpecs(res.data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen, missileId, backendUrl]);

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(0,0,0,0.9)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: '#0A0A0A',
          border: '1px solid #27272A',
          borderRadius: '4px',
          maxWidth: '1400px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          color: 'white'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
        ) : specs ? (
          <div>
            <div style={{ 
              position: 'sticky', 
              top: 0, 
              background: '#0A0A0A', 
              borderBottom: '1px solid #27272A',
              padding: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 10
            }}>
              <div>
                <h2 style={{ 
                  fontSize: '32px', 
                  fontWeight: 900, 
                  margin: 0,
                  fontFamily: "'Barlow Condensed', sans-serif"
                }}>
                  {specs.name}
                </h2>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <span style={{
                    padding: '4px 12px',
                    background: '#141414',
                    border: '1px solid #27272A',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    {specs.type}
                  </span>
                  <span style={{
                    padding: '4px 12px',
                    background: '#141414',
                    border: '1px solid #FF9500',
                    color: '#FF9500',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    ${(specs.cost / 1e6).toFixed(2)}M
                  </span>
                </div>
              </div>
              <button 
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#A1A1AA',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X size={24} weight="bold" />
              </button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <h3 style={{ 
                fontSize: '24px', 
                fontWeight: 700,
                marginBottom: '16px',
                fontFamily: "'Barlow Condensed', sans-serif"
              }}>
                3D MODEL VIEW
              </h3>
              <Missile3DViewer missileSpec={specs} />
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '24px',
                marginTop: '32px'
              }}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
                    DIMENSIONS
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ 
                      padding: '12px', 
                      background: '#1C1C1E', 
                      border: '1px solid #27272A',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Ruler size={18} /> Length
                      </span>
                      <span style={{ fontWeight: 700 }}>{specs.dimensions.length} m</span>
                    </div>
                    <div style={{ 
                      padding: '12px', 
                      background: '#1C1C1E', 
                      border: '1px solid #27272A',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Ruler size={18} /> Diameter
                      </span>
                      <span style={{ fontWeight: 700 }}>{specs.dimensions.diameter} m</span>
                    </div>
                    <div style={{ 
                      padding: '12px', 
                      background: '#1C1C1E', 
                      border: '1px solid #27272A',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Gauge size={18} /> Weight
                      </span>
                      <span style={{ fontWeight: 700 }}>{specs.dimensions.weight.toLocaleString()} kg</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
                    PERFORMANCE
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ 
                      padding: '12px', 
                      background: '#1C1C1E', 
                      border: '1px solid #27272A',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Globe size={18} /> Range
                      </span>
                      <span style={{ fontWeight: 700 }}>{specs.performance.range_km.toLocaleString()} km</span>
                    </div>
                    <div style={{ 
                      padding: '12px', 
                      background: '#1C1C1E', 
                      border: '1px solid #27272A',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Gauge size={18} /> Speed
                      </span>
                      <span style={{ fontWeight: 700 }}>Mach {specs.performance.speed_mach}</span>
                    </div>
                    <div style={{ 
                      padding: '12px', 
                      background: '#1C1C1E', 
                      border: '1px solid #27272A',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Target size={18} /> Guidance
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '12px' }}>{specs.performance.guidance}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
                    WARHEAD
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ 
                      padding: '12px', 
                      background: '#1C1C1E', 
                      border: '1px solid #27272A',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Rocket size={18} /> Type
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '12px' }}>{specs.warhead.type.substring(0, 20)}</span>
                    </div>
                    <div style={{ 
                      padding: '12px', 
                      background: '#1C1C1E', 
                      border: '1px solid #27272A',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Gauge size={18} /> Weight
                      </span>
                      <span style={{ fontWeight: 700 }}>{specs.warhead.weight_kg} kg</span>
                    </div>
                    <div style={{ 
                      padding: '12px', 
                      background: '#1C1C1E', 
                      border: '1px solid #27272A',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Target size={18} /> Blast Radius
                      </span>
                      <span style={{ fontWeight: 700 }}>{specs.warhead.blast_radius_m} m</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#FF3B30' }}>
            Failed to load
          </div>
        )}
      </div>
    </div>
  );
}
