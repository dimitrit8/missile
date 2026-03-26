import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Missile3DViewer from './Missile3DViewer';
import { X, Info, Target, Gauge, Rocket, CurrencyDollar, Ruler, Weight, Globe, Clock } from '@phosphor-icons/react';

const MissileSpecsModal = ({ missileId, isOpen, onClose, backendUrl }) => {
  const [specs, setSpecs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && missileId) {
      fetchSpecs();
    }
  }, [isOpen, missileId]);

  const fetchSpecs = async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/missile-specifications/${missileId}`);
      setSpecs(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching specs:', error);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const SpecRow = ({ icon: Icon, label, value, color = 'text-[#A1A1AA]' }) => (
    <div className=\"flex items-center justify-between py-3 px-4 bg-[#1C1C1E] border border-[#27272A] rounded-sm hover:bg-[#27272A] transition-colors\">
      <div className=\"flex items-center gap-3\">
        <Icon size={18} className={color} weight=\"duotone\" />
        <span className=\"text-sm text-[#A1A1AA] uppercase tracking-wider font-semibold\">{label}</span>
      </div>
      <span className=\"text-white font-mono font-bold text-right\">{value}</span>
    </div>
  );

  return (
    <div className=\"fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm\" onClick={onClose}>
      <div 
        className=\"bg-[#0A0A0A] border border-[#27272A] rounded-sm max-w-7xl w-full max-h-[90vh] overflow-y-auto\"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className=\"p-12 text-center text-[#A1A1AA]\">Loading specifications...</div>
        ) : specs ? (
          <div>
            {/* Header */}
            <div className=\"sticky top-0 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-[#27272A] p-6 flex items-center justify-between z-10\">
              <div>
                <h2 className=\"text-3xl font-black uppercase tracking-tight\" style={{ fontFamily: \"'Barlow Condensed', sans-serif\" }}>
                  {specs.name}
                </h2>
                <div className=\"flex gap-3 mt-2\">
                  <span className=\"px-3 py-1 bg-[#141414] border border-[#27272A] rounded-sm text-xs text-[#A1A1AA] font-semibold uppercase tracking-wider\">
                    {specs.type}
                  </span>
                  <span className=\"px-3 py-1 bg-[#141414] border border-[#27272A] rounded-sm text-xs text-[#A1A1AA] font-semibold uppercase tracking-wider\">
                    {specs.country}
                  </span>
                  <span className=\"px-3 py-1 bg-[#141414] border border-[#FF9500] rounded-sm text-xs text-[#FF9500] font-semibold uppercase tracking-wider\">
                    ${(specs.cost / 1e6).toFixed(2)}M
                  </span>
                </div>
              </div>
              <button 
                onClick={onClose}
                className=\"p-2 hover:bg-[#1C1C1E] rounded-sm transition-colors\"
                data-testid=\"close-specs-modal\"
              >
                <X size={24} className=\"text-[#A1A1AA]\" weight=\"bold\" />
              </button>
            </div>

            <div className=\"p-6 grid grid-cols-1 lg:grid-cols-2 gap-6\">
              {/* 3D Viewer */}
              <div className=\"lg:col-span-2\">
                <h3 className=\"text-xl font-bold uppercase mb-3\" style={{ fontFamily: \"'Barlow Condensed', sans-serif\" }}>
                  3D Model View
                </h3>
                <Missile3DViewer missileSpec={specs} />
                <p className=\"text-xs text-[#71717A] mt-2 text-center\">
                  <Info size={12} className=\"inline\" /> Drag to rotate • Scroll to zoom • Right-click to pan
                </p>
              </div>

              {/* Physical Dimensions */}
              <div>
                <h3 className=\"text-xl font-bold uppercase mb-3\" style={{ fontFamily: \"'Barlow Condensed', sans-serif\" }}>
                  Physical Dimensions
                </h3>
                <div className=\"space-y-2\">
                  <SpecRow icon={Ruler} label=\"Length\" value={`${specs.dimensions.length} m`} color=\"text-[#3498db]\" />
                  <SpecRow icon={Ruler} label=\"Diameter\" value={`${specs.dimensions.diameter} m`} color=\"text-[#3498db]\" />
                  {specs.dimensions.wingspan > 0 && (
                    <SpecRow icon={Ruler} label=\"Wingspan\" value={`${specs.dimensions.wingspan} m`} color=\"text-[#3498db]\" />
                  )}
                  <SpecRow icon={Weight} label=\"Weight\" value={`${specs.dimensions.weight.toLocaleString()} kg`} color=\"text-[#9b59b6]\" />
                </div>
              </div>

              {/* Performance */}
              <div>
                <h3 className=\"text-xl font-bold uppercase mb-3\" style={{ fontFamily: \"'Barlow Condensed', sans-serif\" }}>
                  Performance
                </h3>
                <div className=\"space-y-2\">
                  <SpecRow icon={Globe} label=\"Max Range\" value={`${specs.performance.range_km.toLocaleString()} km`} color=\"text-[#e74c3c]\" />
                  <SpecRow icon={Gauge} label=\"Speed\" value={`Mach ${specs.performance.speed_mach} (${specs.performance.speed_kmh.toLocaleString()} km/h)`} color=\"text-[#f39c12]\" />
                  {specs.performance.max_altitude_m && (
                    <SpecRow icon={Target} label=\"Max Altitude\" value={`${(specs.performance.max_altitude_m / 1000).toFixed(1)} km`} color=\"text-[#2ecc71]\" />
                  )}
                  <SpecRow icon={Target} label=\"Guidance\" value={specs.performance.guidance} color=\"text-[#3498db]\" />
                </div>
              </div>

              {/* Warhead */}
              <div>
                <h3 className=\"text-xl font-bold uppercase mb-3\" style={{ fontFamily: \"'Barlow Condensed', sans-serif\" }}>
                  Warhead & Lethality
                </h3>
                <div className=\"space-y-2\">
                  <SpecRow icon={Rocket} label=\"Type\" value={specs.warhead.type} color=\"text-[#FF3B30]\" />
                  <SpecRow icon={Weight} label=\"Warhead Weight\" value={`${specs.warhead.weight_kg} kg`} color=\"text-[#FF3B30]\" />
                  <SpecRow icon={Target} label=\"Yield\" value={specs.warhead.yield_tnt_equivalent} color=\"text-[#e74c3c]\" />
                  <SpecRow icon={Target} label=\"Blast Radius\" value={`${specs.warhead.blast_radius_m} m`} color=\"text-[#FF9500]\" />
                  <SpecRow icon={Target} label=\"Lethal Radius\" value={`${specs.warhead.lethal_radius_m} m`} color=\"text-[#FF3B30]\" />
                  <SpecRow icon={Target} label=\"Damage Radius\" value={`${specs.warhead.effective_damage_radius_m} m`} color=\"text-[#c0392b]\" />
                </div>
              </div>

              {/* Technical Specifications */}
              <div>
                <h3 className=\"text-xl font-bold uppercase mb-3\" style={{ fontFamily: \"'Barlow Condensed', sans-serif\" }}>
                  Technical Specifications
                </h3>
                <div className=\"space-y-2\">
                  <SpecRow icon={Rocket} label=\"Propulsion\" value={specs.specifications.propulsion} />
                  <SpecRow icon={Info} label=\"Fuel Type\" value={specs.specifications.fuel_type} />
                  <SpecRow icon={Target} label=\"CEP (Accuracy)\" value={`${specs.specifications.cep_m} m`} color=\"text-[#34C759]\" />
                  {specs.specifications.hit_probability && (
                    <SpecRow icon={Target} label=\"Hit Probability\" value={`${(specs.specifications.hit_probability * 100).toFixed(0)}%`} color=\"text-[#34C759]\" />
                  )}
                  <SpecRow icon={Clock} label=\"Year Introduced\" value={specs.specifications.year_introduced} />
                  <SpecRow icon={Info} label=\"Status\" value={specs.specifications.service_status} color=\"text-[#34C759]\" />
                </div>
              </div>

              {/* Launch Platform */}
              <div className=\"lg:col-span-2\">
                <h3 className=\"text-xl font-bold uppercase mb-3\" style={{ fontFamily: \"'Barlow Condensed', sans-serif\" }}>
                  Launch Platforms
                </h3>
                <div className=\"flex flex-wrap gap-2\">
                  {specs.specifications.launch_platform.map((platform, idx) => (
                    <div key={idx} className=\"px-4 py-2 bg-[#141414] border border-[#27272A] rounded-sm text-[#A1A1AA] font-mono text-sm\">
                      {platform}
                    </div>
                  ))}
                </div>
              </div>

              {/* Manufacturer Info */}
              <div className=\"lg:col-span-2 bg-[#141414] border border-[#27272A] rounded-sm p-4\">
                <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4 text-center\">
                  <div>
                    <div className=\"text-xs text-[#71717A] uppercase tracking-wider mb-1\">Manufacturer</div>
                    <div className=\"text-white font-bold\">{specs.manufacturer}</div>
                  </div>
                  <div>
                    <div className=\"text-xs text-[#71717A] uppercase tracking-wider mb-1\">Country of Origin</div>
                    <div className=\"text-white font-bold\">{specs.country}</div>
                  </div>
                  <div>
                    <div className=\"text-xs text-[#71717A] uppercase tracking-wider mb-1\">Unit Cost</div>
                    <div className=\"text-[#FF9500] font-bold font-mono\">${(specs.cost / 1e6).toFixed(2)}M</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className=\"p-12 text-center text-[#FF3B30]\">Failed to load specifications</div>
        )}
      </div>
    </div>
  );
};

export default MissileSpecsModal;
