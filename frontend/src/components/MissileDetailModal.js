import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Ruler, Gauge, Globe, Target, Rocket, CurrencyDollar, Factory, MapPin, Crosshair, Fire, Skull } from '@phosphor-icons/react';

export default function MissileDetailModal({ missileId, isOpen, onClose, backendUrl }) {
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

  const DetailRow = ({ icon: Icon, label, value, highlight }) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      background: '#1C1C1E',
      border: '1px solid #27272A',
      borderRadius: '4px',
      marginBottom: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Icon size={22} style={{ color: highlight || '#A1A1AA' }} weight="duotone" />
        <span style={{ 
          fontSize: '14px', 
          color: '#A1A1AA', 
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {label}
        </span>
      </div>
      <span style={{ 
        fontSize: '16px', 
        color: highlight || '#FFFFFF', 
        fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: 'right'
      }}>
        {value}
      </span>
    </div>
  );

  const SectionTitle = ({ children }) => (
    <h3 style={{
      fontSize: '22px',
      fontWeight: 900,
      textTransform: 'uppercase',
      color: '#FFFFFF',
      marginTop: '32px',
      marginBottom: '16px',
      fontFamily: "'Barlow Condensed', sans-serif",
      letterSpacing: '0.05em',
      borderBottom: '2px solid #27272A',
      paddingBottom: '8px'
    }}>
      {children}
    </h3>
  );

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
        background: 'rgba(0,0,0,0.95)',
        backdropFilter: 'blur(8px)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'linear-gradient(180deg, #0A0A0A 0%, #141414 100%)',
          border: '2px solid #27272A',
          borderRadius: '8px',
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          color: 'white',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#71717A' }}>
            <div style={{ fontSize: '18px' }}>Loading missile details...</div>
          </div>
        ) : specs ? (
          <div>
            {/* Header */}
            <div style={{ 
              position: 'sticky', 
              top: 0, 
              background: 'linear-gradient(180deg, #0A0A0A 0%, rgba(10,10,10,0.98) 100%)',
              backdropFilter: 'blur(12px)',
              borderBottom: '2px solid #27272A',
              padding: '28px 32px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 10
            }}>
              <div>
                <h1 style={{ 
                  fontSize: '36px', 
                  fontWeight: 900, 
                  margin: 0,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em'
                }}>
                  {specs.name}
                </h1>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '6px 16px',
                    background: '#141414',
                    border: '1px solid #34C759',
                    color: '#34C759',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}>
                    {specs.type}
                  </span>
                  <span style={{
                    padding: '6px 16px',
                    background: '#141414',
                    border: '1px solid #007AFF',
                    color: '#007AFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '4px'
                  }}>
                    {specs.country}
                  </span>
                  <span style={{
                    padding: '6px 16px',
                    background: '#141414',
                    border: '2px solid #FF9500',
                    color: '#FF9500',
                    fontSize: '14px',
                    fontWeight: 900,
                    borderRadius: '4px',
                    fontFamily: "'JetBrains Mono', monospace"
                  }}>
                    ${(specs.cost / 1e6).toFixed(2)}M per unit
                  </span>
                </div>
              </div>
              <button 
                onClick={onClose}
                style={{
                  background: '#1C1C1E',
                  border: '1px solid #27272A',
                  color: '#A1A1AA',
                  cursor: 'pointer',
                  padding: '12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#27272A'}
                onMouseOut={(e) => e.target.style.background = '#1C1C1E'}
              >
                <X size={28} weight="bold" />
              </button>
            </div>
            
            <div style={{ padding: '32px' }}>
              {/* Physical Specifications */}
              <SectionTitle>📐 PHYSICAL SPECIFICATIONS</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                <DetailRow icon={Ruler} label="Length" value={`${specs.dimensions.length} meters`} highlight="#3498db" />
                <DetailRow icon={Ruler} label="Diameter" value={`${specs.dimensions.diameter} meters`} highlight="#3498db" />
                {specs.dimensions.wingspan > 0 && (
                  <DetailRow icon={Ruler} label="Wingspan" value={`${specs.dimensions.wingspan} meters`} highlight="#3498db" />
                )}
                <DetailRow icon={Gauge} label="Total Weight" value={`${specs.dimensions.weight.toLocaleString()} kg`} highlight="#9b59b6" />
              </div>

              {/* Performance Characteristics */}
              <SectionTitle>⚡ PERFORMANCE CHARACTERISTICS</SectionTitle>
              <DetailRow icon={Globe} label="Maximum Range" value={`${specs.performance.range_km.toLocaleString()} km`} highlight="#e74c3c" />
              <DetailRow icon={Gauge} label="Maximum Speed" value={`Mach ${specs.performance.speed_mach} (${specs.performance.speed_kmh.toLocaleString()} km/h)`} highlight="#f39c12" />
              {specs.performance.max_altitude_m && (
                <DetailRow icon={Target} label="Maximum Altitude" value={`${(specs.performance.max_altitude_m / 1000).toFixed(1)} km`} highlight="#2ecc71" />
              )}
              <DetailRow icon={Crosshair} label="Guidance System" value={specs.performance.guidance} highlight="#007AFF" />

              {/* Warhead & Destructive Capability */}
              <SectionTitle>💥 WARHEAD & DESTRUCTIVE CAPABILITY</SectionTitle>
              <DetailRow icon={Rocket} label="Warhead Type" value={specs.warhead.type} highlight="#FF3B30" />
              <DetailRow icon={Gauge} label="Warhead Weight" value={`${specs.warhead.weight_kg} kg`} highlight="#FF3B30" />
              <DetailRow icon={Fire} label="Explosive Yield" value={specs.warhead.yield_tnt_equivalent} highlight="#FF9500" />
              <DetailRow icon={Target} label="Blast Radius" value={`${specs.warhead.blast_radius_m} meters`} highlight="#FF6B6B" />
              <DetailRow icon={Skull} label="Lethal Radius" value={`${specs.warhead.lethal_radius_m} meters`} highlight="#FF3B30" />
              <DetailRow icon={Fire} label="Effective Damage Radius" value={`${specs.warhead.effective_damage_radius_m} meters`} highlight="#c0392b" />

              {/* Technical Details */}
              <SectionTitle>🔧 TECHNICAL SPECIFICATIONS</SectionTitle>
              <DetailRow icon={Rocket} label="Propulsion System" value={specs.specifications.propulsion} />
              <DetailRow icon={Factory} label="Fuel Type" value={specs.specifications.fuel_type} />
              <DetailRow icon={Target} label="Accuracy (CEP)" value={`${specs.specifications.cep_m} meters`} highlight="#34C759" />
              {specs.specifications.hit_probability && (
                <DetailRow icon={Target} label="Hit Probability" value={`${(specs.specifications.hit_probability * 100).toFixed(0)}%`} highlight="#34C759" />
              )}
              {specs.specifications.maneuverability && (
                <DetailRow icon={Gauge} label="Maneuverability" value={specs.specifications.maneuverability} />
              )}

              {/* Manufacturing & Origin */}
              <SectionTitle>🏭 MANUFACTURING & ORIGIN</SectionTitle>
              <DetailRow icon={Factory} label="Manufacturer" value={specs.manufacturer} />
              <DetailRow icon={MapPin} label="Country of Origin" value={specs.country} highlight="#007AFF" />
              <DetailRow icon={CurrencyDollar} label="Unit Cost" value={`$${(specs.cost / 1e6).toFixed(2)} Million USD`} highlight="#FF9500" />
              <DetailRow icon={Target} label="Year Introduced" value={specs.specifications.year_introduced} />
              <DetailRow icon={Target} label="Service Status" value={specs.specifications.service_status} highlight="#34C759" />

              {/* Launch Platforms */}
              <SectionTitle>🚀 LAUNCH PLATFORMS</SectionTitle>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '12px',
                marginBottom: '20px'
              }}>
                {specs.specifications.launch_platform.map((platform, idx) => (
                  <div key={idx} style={{
                    padding: '12px 20px',
                    background: '#1C1C1E',
                    border: '1px solid #34C759',
                    borderRadius: '6px',
                    color: '#34C759',
                    fontSize: '14px',
                    fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace"
                  }}>
                    {platform}
                  </div>
                ))}
              </div>

              {/* Summary Box */}
              <div style={{
                marginTop: '32px',
                padding: '24px',
                background: 'linear-gradient(135deg, #1C1C1E 0%, #27272A 100%)',
                border: '2px solid #FF9500',
                borderRadius: '8px'
              }}>
                <h4 style={{ 
                  margin: '0 0 16px 0', 
                  fontSize: '18px', 
                  fontWeight: 900,
                  color: '#FF9500',
                  textTransform: 'uppercase',
                  fontFamily: "'Barlow Condensed', sans-serif"
                }}>
                  ⚠️ THREAT ASSESSMENT
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '16px',
                  fontSize: '13px',
                  color: '#A1A1AA',
                  lineHeight: '1.6'
                }}>
                  <div>
                    <strong style={{ color: '#FF9500' }}>Range Class:</strong><br/>
                    {specs.performance.range_km >= 5000 ? 'Intercontinental' : 
                     specs.performance.range_km >= 1000 ? 'Long-Range' :
                     specs.performance.range_km >= 300 ? 'Medium-Range' : 'Short-Range'}
                  </div>
                  <div>
                    <strong style={{ color: '#FF9500' }}>Speed Class:</strong><br/>
                    {specs.performance.speed_mach >= 5 ? 'Hypersonic' :
                     specs.performance.speed_mach >= 1 ? 'Supersonic' : 'Subsonic'}
                  </div>
                  <div>
                    <strong style={{ color: '#FF9500' }}>Lethality:</strong><br/>
                    {specs.warhead.lethal_radius_m >= 100 ? 'Extreme' :
                     specs.warhead.lethal_radius_m >= 50 ? 'High' : 'Moderate'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '60px', textAlign: 'center', color: '#FF3B30' }}>
            <div style={{ fontSize: '18px' }}>Failed to load missile details</div>
          </div>
        )}
      </div>
    </div>
  );
}
