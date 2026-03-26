import { useEffect, useState } from "react";
import "@/App.css";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Crosshair, Rocket, ShieldCheck, Users, Skull, CurrencyDollar, Target, CheckCircle, XCircle, Info } from "@phosphor-icons/react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [conflicts, setConflicts] = useState([]);
  const [strikes, setStrikes] = useState([]);
  const [missileTypes, setMissileTypes] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [disclaimer, setDisclaimer] = useState(null);
  const [selectedConflict, setSelectedConflict] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [conflictsRes, strikesRes, typesRes, statsRes, disclaimerRes] = await Promise.all([
        axios.get(`${API}/conflicts`),
        axios.get(`${API}/strikes`),
        axios.get(`${API}/missile-types`),
        axios.get(`${API}/statistics`),
        axios.get(`${API}/disclaimer`)
      ]);
      
      setConflicts(conflictsRes.data);
      setStrikes(strikesRes.data);
      setMissileTypes(typesRes.data);
      setStatistics(statsRes.data);
      setDisclaimer(disclaimerRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const filteredStrikes = selectedConflict === "all" 
    ? strikes 
    : strikes.filter(s => s.conflict_id === selectedConflict);

  // Calculate filtered statistics based on selected conflict
  const filteredStats = {
    total_strikes: filteredStrikes.length,
    total_intercepted: filteredStrikes.filter(s => s.intercepted).length,
    interception_rate: filteredStrikes.length > 0 
      ? ((filteredStrikes.filter(s => s.intercepted).length / filteredStrikes.length) * 100).toFixed(1)
      : 0,
    total_casualties: filteredStrikes.reduce((sum, s) => sum + s.casualties, 0),
    total_deceased: filteredStrikes.reduce((sum, s) => sum + s.deceased, 0),
    total_missile_cost: filteredStrikes.reduce((sum, s) => sum + s.missile_cost, 0),
    total_defense_cost: filteredStrikes.filter(s => s.intercepted).reduce((sum, s) => sum + (s.interceptor_cost || 0), 0)
  };

  const StatCard = ({ icon: Icon, label, value, subtext, color }) => (
    <div data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, '-')}`} className="bg-[#141414] border border-[#27272A] rounded-sm p-4 hover:bg-[#1C1C1E] transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={20} className={color} weight="duotone" />
          <span className="text-sm text-[#A1A1AA] uppercase tracking-[0.2em] font-semibold">{label}</span>
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">{value}</div>
      {subtext && <div className="text-sm text-[#71717A] mt-1">{subtext}</div>}
    </div>
  );

  if (loading) {
    return (
      <div data-testid="loading-screen" className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-[#A1A1AA] text-xl">Loading missile data...</div>
      </div>
    );
  }

  const missileTypeBreakdown = missileTypes
    .filter(mt => mt.type !== "Interceptor")
    .map(mt => ({
      name: mt.name,
      cost: mt.cost,
      type: mt.type
    }));

  const interceptorBreakdown = missileTypes
    .filter(mt => mt.type === "Interceptor")
    .map(mt => ({
      name: mt.name,
      cost: mt.cost
    }));

  const COLORS = ['#FF3B30', '#FF9500', '#007AFF', '#34C759', '#AF52DE', '#FF2D55'];

  return (
    <div className="App min-h-screen bg-[#0A0A0A] text-white">
      <div className="bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-[#27272A] sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto p-4 md:p-6">
          <div className="flex items-center gap-3 mb-2">
            <Crosshair size={32} className="text-[#FF3B30]" weight="duotone" />
            <h1 className="text-4xl sm:text-5xl lg:text-6xl tracking-tighter uppercase font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              MISSILE TRACKING DASHBOARD
            </h1>
          </div>
          <p className="text-base leading-relaxed font-normal text-[#A1A1AA]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Real-time monitoring of global missile conflicts and defense systems
          </p>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto p-4 md:p-6">
        {/* Data Disclaimer Banner */}
        {disclaimer && (
          <div data-testid="disclaimer-banner" className="mb-6 bg-[#141414] border-l-4 border-[#FF9500] p-4 rounded-sm">
            <div className="flex items-start gap-3">
              <Info size={24} className="text-[#FF9500] flex-shrink-0 mt-1" weight="duotone" />
              <div>
                <div className="text-sm font-bold text-[#FF9500] uppercase tracking-wider mb-2">Data Disclaimer</div>
                <p className="text-sm text-[#A1A1AA] leading-relaxed mb-3">{disclaimer.disclaimer}</p>
                <details className="text-xs text-[#71717A]">
                  <summary className="cursor-pointer hover:text-[#A1A1AA] transition-colors font-semibold mb-2">View Data Sources & Methodology</summary>
                  <div className="mt-2 space-y-2 pl-4">
                    <div>
                      <div className="font-semibold text-[#A1A1AA] mb-1">Sources:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {disclaimer.data_sources.map((source, idx) => (
                          <li key={idx}>{source}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-[#A1A1AA] mb-1">Methodology:</div>
                      <p>{disclaimer.methodology}</p>
                    </div>
                    <div>
                      <div className="font-semibold text-[#A1A1AA] mb-1">Limitations:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {disclaimer.limitations.map((limitation, idx) => (
                          <li key={idx}>{limitation}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-[#71717A] italic mt-2">Last Updated: {disclaimer.last_updated}</div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        )}

        {/* Conflict Filter */}
        <div data-testid="conflict-filter" className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              data-testid="filter-all"
              onClick={() => setSelectedConflict("all")}
              className={`px-4 py-2 rounded-sm border transition-all duration-200 ${
                selectedConflict === "all"
                  ? "bg-[#007AFF] border-[#007AFF] text-white"
                  : "bg-[#141414] border-[#27272A] text-[#A1A1AA] hover:bg-[#1C1C1E]"
              }`}
            >
              ALL CONFLICTS
            </button>
            {conflicts.map(conflict => (
              <button
                data-testid={`filter-${conflict.id}`}
                key={conflict.id}
                onClick={() => setSelectedConflict(conflict.id)}
                className={`px-4 py-2 rounded-sm border transition-all duration-200 ${
                  selectedConflict === conflict.id
                    ? "bg-[#007AFF] border-[#007AFF] text-white"
                    : "bg-[#141414] border-[#27272A] text-[#A1A1AA] hover:bg-[#1C1C1E]"
                }`}
              >
                {conflict.name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Statistics Grid */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
            <StatCard
              icon={Rocket}
              label="Total Strikes"
              value={filteredStats.total_strikes.toLocaleString()}
              color="text-[#FF3B30]"
            />
            <StatCard
              icon={ShieldCheck}
              label="Intercepted"
              value={filteredStats.total_intercepted.toLocaleString()}
              subtext={`${filteredStats.interception_rate}% success rate`}
              color="text-[#34C759]"
            />
            <StatCard
              icon={Users}
              label="Casualties"
              value={filteredStats.total_casualties.toLocaleString()}
              color="text-[#FF9500]"
            />
            <StatCard
              icon={Skull}
              label="Deceased"
              value={filteredStats.total_deceased.toLocaleString()}
              color="text-[#FF3B30]"
            />
            <StatCard
              icon={CurrencyDollar}
              label="Missile Cost"
              value={`$${(filteredStats.total_missile_cost / 1e9).toFixed(2)}B`}
              color="text-[#FF9500]"
            />
            <StatCard
              icon={Target}
              label="Defense Cost"
              value={`$${(filteredStats.total_defense_cost / 1e9).toFixed(2)}B`}
              color="text-[#007AFF]"
            />
            <StatCard
              icon={Crosshair}
              label="Active Conflicts"
              value={selectedConflict === "all" ? statistics.total_conflicts : 1}
              color="text-[#FF3B30]"
            />
            <StatCard
              icon={CheckCircle}
              label="Defense Efficiency"
              value={`${filteredStats.interception_rate}%`}
              color="text-[#34C759]"
            />
          </div>
        )}

        {/* Interactive Map */}
        <div className="bg-[#141414] border border-[#27272A] rounded-sm p-4 mb-6">
          <h2 data-testid="map-title" className="text-2xl sm:text-3xl lg:text-4xl tracking-tight uppercase font-bold mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            STRIKE LOCATIONS MAP
          </h2>
          <div data-testid="strike-map" className="h-[600px] rounded-sm overflow-hidden">
            <MapContainer
              center={[35, 35]}
              zoom={4}
              style={{ height: "100%", width: "100%" }}
              className="z-10"
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {filteredStrikes.map(strike => (
                <Circle
                  key={strike.id}
                  center={[strike.latitude, strike.longitude]}
                  radius={strike.casualties * 500}
                  pathOptions={{
                    fillColor: strike.intercepted ? "#34C759" : "#FF3B30",
                    fillOpacity: 0.4,
                    color: strike.intercepted ? "#34C759" : "#FF3B30",
                    weight: 1
                  }}
                >
                  <Popup>
                    <div className="text-black">
                      <div className="font-bold">{strike.location}, {strike.country}</div>
                      <div>Date: {strike.date}</div>
                      <div>Missile: {strike.missile_type}</div>
                      <div>Cost: ${(strike.missile_cost / 1e6).toFixed(2)}M</div>
                      <div>Status: {strike.intercepted ? "Intercepted" : "Hit Target"}</div>
                      {strike.intercepted && <div>Interceptor: {strike.interceptor_type}</div>}
                      <div>Casualties: {strike.casualties}</div>
                      <div>Deceased: {strike.deceased}</div>
                      <div className="text-sm mt-1">{strike.description}</div>
                    </div>
                  </Popup>
                </Circle>
              ))}
            </MapContainer>
          </div>
          <div className="flex gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#FF3B30]"></div>
              <span className="text-[#A1A1AA]">Strike Hit Target</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#34C759]"></div>
              <span className="text-[#A1A1AA]">Strike Intercepted</span>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
          {/* Timeline Chart */}
          <div className="bg-[#141414] border border-[#27272A] rounded-sm p-4">
            <h2 data-testid="timeline-title" className="text-2xl sm:text-3xl lg:text-4xl tracking-tight uppercase font-bold mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              STRIKES OVER TIME
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={statistics?.strikes_by_month || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" strokeOpacity={0.1} />
                <XAxis dataKey="month" stroke="#A1A1AA" style={{ fontSize: '12px' }} />
                <YAxis stroke="#A1A1AA" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#141414', border: '1px solid #27272A', borderRadius: '2px' }}
                  labelStyle={{ color: '#A1A1AA' }}
                />
                <Line type="linear" dataKey="count" stroke="#FF3B30" strokeWidth={2} dot={{ fill: '#FF3B30', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Strikes by Conflict */}
          <div className="bg-[#141414] border border-[#27272A] rounded-sm p-4">
            <h2 data-testid="conflict-breakdown-title" className="text-2xl sm:text-3xl lg:text-4xl tracking-tight uppercase font-bold mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              STRIKES BY CONFLICT
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={Object.entries(statistics?.strikes_by_conflict || {}).map(([name, count]) => ({ name, count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" strokeOpacity={0.1} />
                <XAxis dataKey="name" stroke="#A1A1AA" style={{ fontSize: '12px' }} angle={-15} textAnchor="end" height={80} />
                <YAxis stroke="#A1A1AA" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#141414', border: '1px solid #27272A', borderRadius: '2px' }}
                  labelStyle={{ color: '#A1A1AA' }}
                />
                <Bar dataKey="count" fill="#007AFF" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Missile Types & Interceptors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
          {/* Offensive Missiles */}
          <div className="bg-[#141414] border border-[#27272A] rounded-sm p-4">
            <h2 data-testid="missile-types-title" className="text-2xl sm:text-3xl lg:text-4xl tracking-tight uppercase font-bold mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              OFFENSIVE MISSILES
            </h2>
            <div className="space-y-3">
              {missileTypeBreakdown.map((missile, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-[#1C1C1E] border border-[#27272A] rounded-sm hover:bg-[#27272A] transition-colors">
                  <div className="flex-1">
                    <div className="font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{missile.name}</div>
                    <div className="text-sm text-[#71717A]">{missile.type}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[#FF9500] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      ${(missile.cost / 1e6).toFixed(2)}M
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interceptors */}
          <div className="bg-[#141414] border border-[#27272A] rounded-sm p-4">
            <h2 data-testid="interceptors-title" className="text-2xl sm:text-3xl lg:text-4xl tracking-tight uppercase font-bold mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              DEFENSE INTERCEPTORS
            </h2>
            <div className="space-y-3">
              {interceptorBreakdown.map((interceptor, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-[#1C1C1E] border border-[#27272A] rounded-sm hover:bg-[#27272A] transition-colors">
                  <div className="flex-1">
                    <div className="font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{interceptor.name}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[#34C759] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      ${(interceptor.cost / 1e6).toFixed(2)}M
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Conflict Details Table */}
        <div className="bg-[#141414] border border-[#27272A] rounded-sm p-4">
          <h2 data-testid="conflict-details-title" className="text-2xl sm:text-3xl lg:text-4xl tracking-tight uppercase font-bold mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            CONFLICT DETAILS
          </h2>
          <div className="overflow-x-auto">
            <table data-testid="conflict-table" className="w-full text-left">
              <thead>
                <tr className="border-b border-[#27272A]">
                  <th className="p-3 text-sm text-[#A1A1AA] uppercase tracking-[0.2em] font-semibold">Conflict</th>
                  <th className="p-3 text-sm text-[#A1A1AA] uppercase tracking-[0.2em] font-semibold">Start Date</th>
                  <th className="p-3 text-sm text-[#A1A1AA] uppercase tracking-[0.2em] font-semibold">Regions</th>
                  <th className="p-3 text-sm text-[#A1A1AA] uppercase tracking-[0.2em] font-semibold">Total Missiles</th>
                  <th className="p-3 text-sm text-[#A1A1AA] uppercase tracking-[0.2em] font-semibold">Intercepted</th>
                  <th className="p-3 text-sm text-[#A1A1AA] uppercase tracking-[0.2em] font-semibold">Casualties</th>
                  <th className="p-3 text-sm text-[#A1A1AA] uppercase tracking-[0.2em] font-semibold">Deceased</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map(conflict => (
                  <tr key={conflict.id} className="border-b border-[#27272A] hover:bg-[#1C1C1E] transition-colors">
                    <td className="p-3 font-bold text-white">{conflict.name}</td>
                    <td className="p-3 text-[#A1A1AA]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{conflict.start_date}</td>
                    <td className="p-3 text-[#A1A1AA]">{conflict.regions.join(", ")}</td>
                    <td className="p-3 text-[#FF3B30] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{conflict.total_missiles.toLocaleString()}</td>
                    <td className="p-3 text-[#34C759] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{conflict.total_intercepted.toLocaleString()}</td>
                    <td className="p-3 text-[#FF9500] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{conflict.total_casualties.toLocaleString()}</td>
                    <td className="p-3 text-[#FF3B30] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{conflict.total_deceased.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
