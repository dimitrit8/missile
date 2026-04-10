import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Ruler, Gauge, Globe, Target, Rocket, CurrencyDollar, Factory, MapPin, Crosshair, Fire, Skull, MapTrifold, Calendar, ShieldCheck, Warning } from '@phosphor-icons/react';

// Smart cost formatting function
const formatCost = (cost) => {
  if (cost >= 1e9) {
    return `$${(cost / 1e9).toFixed(2)}B`;
  } else if (cost >= 1e6) {
    return `$${(cost / 1e6).toFixed(1)}M`;
  } else if (cost >= 1000) {
    return `$${(cost / 1000).toFixed(0)}K`;
  } else {
    return `$${cost.toFixed(0)}`;
  }
};

export default function MissileDetailModal({ missileId, isOpen, onClose, backendUrl }) {
  const [specs, setSpecs] = useState(null);
  const [strikes, setStrikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('specs'); // 'specs' or 'strikes'

  useEffect(() => {
    if (isOpen && missileId) {
      setLoading(true);

      // Fetch both specs and strikes
      Promise.all([
        axios.get(`${backendUrl}/api/missile-specifications/${missileId}`),
        axios.get(`${backendUrl}/api/strikes`)
      ])
        .then(([specsRes, strikesRes]) => {
          setSpecs(specsRes.data);
          const isInterceptor = specsRes.data.type.toLowerCase().includes('interceptor');
          const specNameLower = specsRes.data.name.toLowerCase();
          const specFirstWord = specsRes.data.name.split(' ')[0].toLowerCase();

          const missileStrikes = strikesRes.data.filter(s => {
            if (isInterceptor) {
              // For interceptors: show strikes where this system was used to defend
              if (!s.interceptor_type) return false;
              const itLower = s.interceptor_type.toLowerCase();
              return itLower.includes(specFirstWord) || specNameLower.includes(itLower.split(' ')[0]);
            } else {
              // For offensive missiles: show strikes that used this missile type
              const mtLower = s.missile_type.toLowerCase();
              return mtLower.includes(specFirstWord) || specNameLower.includes(mtLower);
            }
          });
          setStrikes(missileStrikes);
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
                    {formatCost(specs.cost)} per unit
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

            {/* Tab Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '0', 
              padding: '0 32px',
              borderBottom: '2px solid #27272A',
              background: '#0A0A0A'
            }}>
              <button
                onClick={() => setActiveTab('specs')}
                style={{
                  padding: '16px 32px',
                  background: activeTab === 'specs' ? '#1C1C1E' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'specs' ? '3px solid #007AFF' : '3px solid transparent',
                  color: activeTab === 'specs' ? '#FFFFFF' : '#71717A',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Specifications
              </button>
              <button
                onClick={() => setActiveTab('strikes')}
                style={{
                  padding: '16px 32px',
                  background: activeTab === 'strikes' ? '#1C1C1E' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'strikes' ? '3px solid #FF3B30' : '3px solid transparent',
                  color: activeTab === 'strikes' ? '#FFFFFF' : '#71717A',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                Strike Data
                {strikes.length > 0 && (
                  <span style={{
                    background: '#FF3B30',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '12px'
                  }}>
                    {strikes.length}
                  </span>
                )}
              </button>
            </div>
            
            {activeTab === 'specs' ? (
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
              <DetailRow icon={CurrencyDollar} label="Unit Cost" value={formatCost(specs.cost)} highlight="#FF9500" />
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
            ) : (
            /* Strike Data Tab */
            <div style={{ padding: '32px' }}>
              {strikes.length > 0 ? (
                <>
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{
                      fontSize: '22px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      color: '#FFFFFF',
                      marginBottom: '8px',
                      fontFamily: "'Barlow Condensed', sans-serif"
                    }}>
                      {specs.type.toLowerCase().includes('interceptor')
                        ? `Interceptions by ${specs.name}`
                        : `Recorded Strikes Using ${specs.name}`}
                    </h3>
                    <p style={{ color: '#71717A', fontSize: '14px' }}>
                      {specs.type.toLowerCase().includes('interceptor')
                        ? `${strikes.length} verified interception(s) recorded`
                        : `${strikes.length} verified strike(s) with launch and target information`}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {strikes.map((strike, idx) => (
                      <div key={idx} style={{
                        background: '#1C1C1E',
                        border: `2px solid ${strike.intercepted ? '#34C759' : '#FF3B30'}`,
                        borderRadius: '8px',
                        padding: '20px',
                        position: 'relative'
                      }}>
                        {/* Status Badge */}
                        <div style={{
                          position: 'absolute',
                          top: '-12px',
                          right: '16px',
                          padding: '4px 12px',
                          background: strike.intercepted ? '#34C759' : '#FF3B30',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}>
                          {strike.intercepted ? 'INTERCEPTED' : 'HIT TARGET'}
                        </div>

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                          <div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>
                              {strike.location}, {strike.country}
                            </div>
                            <div style={{ fontSize: '13px', color: '#71717A', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Calendar size={14} />
                              {strike.date}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', color: '#FF9500', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                              {formatCost(strike.missile_cost)}
                            </div>
                          </div>
                        </div>

                        {/* Launch & Target Info */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
                          <div style={{ 
                            background: '#27272A', 
                            padding: '12px', 
                            borderRadius: '6px',
                            borderLeft: '3px solid #007AFF'
                          }}>
                            <div style={{ fontSize: '10px', color: '#71717A', textTransform: 'uppercase', marginBottom: '4px' }}>
                              Launched From
                            </div>
                            <div style={{ fontSize: '14px', color: '#007AFF', fontWeight: 600 }}>
                              {strike.launch_location || 'Unknown'}
                            </div>
                          </div>
                          
                          <div style={{ color: '#71717A', fontSize: '20px' }}>→</div>
                          
                          <div style={{ 
                            background: '#27272A', 
                            padding: '12px', 
                            borderRadius: '6px',
                            borderLeft: `3px solid ${strike.intercepted ? '#34C759' : '#FF3B30'}`
                          }}>
                            <div style={{ fontSize: '10px', color: '#71717A', textTransform: 'uppercase', marginBottom: '4px' }}>
                              {strike.intercepted ? 'Intercepted At' : 'Hit Location'}
                            </div>
                            <div style={{ fontSize: '14px', color: strike.intercepted ? '#34C759' : '#FF3B30', fontWeight: 600 }}>
                              {strike.intercepted ? (strike.interception_location || strike.location) : strike.location}
                            </div>
                          </div>
                        </div>

                        {/* Interception Details */}
                        {strike.intercepted && strike.interceptor_type && (
                          <div style={{ 
                            background: 'rgba(52, 199, 89, 0.1)', 
                            border: '1px solid #34C759',
                            padding: '12px', 
                            borderRadius: '6px',
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <ShieldCheck size={24} color="#34C759" weight="duotone" />
                            <div>
                              <div style={{ fontSize: '12px', color: '#34C759', fontWeight: 700, textTransform: 'uppercase' }}>
                                Intercepted by {strike.interceptor_type}
                              </div>
                              {strike.interceptor_cost && (
                                <div style={{ fontSize: '11px', color: '#71717A' }}>
                                  Defense cost: {formatCost(strike.interceptor_cost)}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Casualties */}
                        {!strike.intercepted && (strike.casualties > 0 || strike.deceased > 0) && (
                          <div style={{ 
                            background: 'rgba(255, 59, 48, 0.1)', 
                            border: '1px solid #FF3B30',
                            padding: '12px', 
                            borderRadius: '6px',
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <Warning size={24} color="#FF3B30" weight="duotone" />
                            <div style={{ display: 'flex', gap: '24px' }}>
                              <div>
                                <div style={{ fontSize: '18px', color: '#FF9500', fontWeight: 700 }}>{strike.casualties}</div>
                                <div style={{ fontSize: '10px', color: '#71717A', textTransform: 'uppercase' }}>Casualties</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '18px', color: '#FF3B30', fontWeight: 700 }}>{strike.deceased}</div>
                                <div style={{ fontSize: '10px', color: '#71717A', textTransform: 'uppercase' }}>Deceased</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Description */}
                        <div style={{ fontSize: '13px', color: '#A1A1AA', fontStyle: 'italic' }}>
                          {strike.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px', color: '#71717A' }}>
                  <MapTrifold size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <div style={{ fontSize: '16px' }}>
                    {specs.type.toLowerCase().includes('interceptor')
                      ? 'No recorded interceptions for this system'
                      : 'No recorded strikes for this weapon system'}
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '8px' }}>Data is compiled from verified reports</div>
                </div>
              )}
            </div>
            )}
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