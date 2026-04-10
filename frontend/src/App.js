import { useEffect, useState, useCallback, useRef } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import "@/App.css";
import axios from "axios";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Crosshair, Rocket, ShieldCheck, Users, Skull, CurrencyDollar, Target, CheckCircle, XCircle, Info, ListBullets, Cube } from "@phosphor-icons/react";
import MissileDetailModal from "./components/MissileDetailModal";
import Missile3DModal from "./components/Missile3DModal";
import MissileTrajectoryMap from "./components/MissileTrajectoryMap";
import NotificationPrompt from "./components/NotificationPrompt";
import InstagramShare from "./components/InstagramShare";
import AdminDashboard from "./AdminDashboard";
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

// Track visitor on page load
const trackVisitor = async () => {
  try {
    await axios.post(`${API}/track-visit`);
  } catch (e) {
    // Silent fail
  }
};

function Dashboard() {
  const [conflicts, setConflicts] = useState([]);
  const [strikes, setStrikes] = useState([]);
  const [missileTypes, setMissileTypes] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [disclaimer, setDisclaimer] = useState(null);
  const [selectedConflict, setSelectedConflict] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedMissile, setSelectedMissile] = useState(null);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [show3DModal, setShow3DModal] = useState(false);
  const [selected3DMissile, setSelected3DMissile] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveLastFetch, setLiveLastFetch] = useState(null);

  const fetchLiveEvents = useCallback(async () => {
    setLiveLoading(true);
    try {
      const res = await axios.get(`${API}/live-events`);
      setLiveEvents(res.data || []);
      setLiveLastFetch(new Date());
    } catch (e) {
      // silent fail
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    trackVisitor();
    fetchLiveEvents();
    // Refresh live events every 5 minutes
    const liveInterval = setInterval(fetchLiveEvents, 5 * 60 * 1000);
    return () => clearInterval(liveInterval);
  }, [fetchLiveEvents]);

  const fetchData = async () => {
    try {
      const [conflictsRes, strikesRes, typesRes, statsRes, disclaimerRes, updateRes] = await Promise.all([
        axios.get(`${API}/conflicts`),
        axios.get(`${API}/strikes`),
        axios.get(`${API}/missile-types`),
        axios.get(`${API}/statistics`),
        axios.get(`${API}/disclaimer`),
        axios.get(`${API}/last-update`)
      ]);
      
      setConflicts(conflictsRes.data);
      setStrikes(strikesRes.data);
      setMissileTypes(typesRes.data);
      setStatistics(statsRes.data);
      setDisclaimer(disclaimerRes.data);
      setLastUpdate(updateRes.data.last_updated);
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
  // Use API statistics for "all" view, or conflict-specific data when a single conflict is selected
  const getFilteredStats = () => {
    if (selectedConflict === "all" && statistics) {
      // Use the real aggregated statistics from the API (from conflicts collection)
      return {
        total_strikes: statistics.total_strikes,
        total_intercepted: statistics.total_intercepted,
        interception_rate: statistics.interception_rate,
        total_casualties: statistics.total_casualties,
        total_deceased: statistics.total_deceased,
        total_missile_cost: statistics.total_missile_cost,
        total_defense_cost: statistics.total_defense_cost
      };
    } else if (selectedConflict !== "all") {
      // Find the specific conflict and use its real data
      const conflict = conflicts.find(c => c.id === selectedConflict);
      if (conflict) {
        const interceptionRate = conflict.total_missiles > 0 
          ? ((conflict.total_intercepted / conflict.total_missiles) * 100).toFixed(1)
          : 0;
        return {
          total_strikes: conflict.total_missiles,
          total_intercepted: conflict.total_intercepted,
          interception_rate: interceptionRate,
          total_casualties: conflict.total_casualties,
          total_deceased: conflict.total_deceased,
          total_missile_cost: conflict.total_cost,
          total_defense_cost: conflict.total_intercepted * 1000000 // Estimated avg interceptor cost
        };
      }
    }
    // Fallback to sample strikes data
    return {
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
  };

  // Smart cost formatting - shows K for thousands, M for millions, B for billions
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

  const filteredStats = getFilteredStats();

  // AdSense Ad Component — invisible until an ad actually fills the slot
  const AdBanner = ({ slot }) => {
    const [adFilled, setAdFilled] = useState(false);
    const wrapRef = useRef(null);
    const insRef  = useRef(null);

    useEffect(() => {
      // Push AdSense initialisation
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (_) {}

      // Watch the <ins> element with a ResizeObserver.
      // AdSense sets a real height (> 0) only when it has an ad to show.
      // On all platforms — desktop and mobile — if the slot is unfilled the
      // element stays at 0 height and we keep the wrapper invisible.
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const h = entry.contentRect?.height ?? entry.target?.offsetHeight ?? 0;
          if (h > 2) {           // >2px means a real ad rendered
            setAdFilled(true);
            ro.disconnect();
          }
        }
      });

      if (insRef.current) ro.observe(insRef.current);

      // Fallback: also check offsetHeight after 5s in case ResizeObserver misses it
      const t = setTimeout(() => {
        const h = insRef.current?.offsetHeight ?? 0;
        if (h > 2) setAdFilled(true);
      }, 5000);

      return () => { ro.disconnect(); clearTimeout(t); };
    }, []);

    return (
      // Wrapper is display:none until ad fills — zero height, no black box
      <div
        ref={wrapRef}
        style={{
          display: adFilled ? 'block' : 'none',
          width: '100%',
          marginBottom: adFilled ? 24 : 0,
        }}
      >
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client="ca-pub-1686873956377198"
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
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
    .filter(mt => !mt.type.toLowerCase().includes('interceptor'))
    .map(mt => ({
      name: mt.name,
      cost: mt.cost,
      type: mt.type,
      id: mt.id,
      country: mt.country,
      range_km: mt.range_km,
      speed_mach: mt.speed_mach,
      weight_kg: mt.weight_kg,
      warhead_kg: mt.warhead_kg,
      cep_m: mt.cep_m,
    }));

  const interceptorBreakdown = missileTypes
    .filter(mt => mt.type.toLowerCase().includes('interceptor'))
    .map(mt => ({
      name: mt.name,
      cost: mt.cost,
      type: mt.type,
      id: mt.id,
      country: mt.country,
      range_km: mt.max_range_km || mt.range_km,
      speed_mach: mt.speed_mach,
      weight_kg: mt.weight_kg,
    }));

  // Helper: resolve missile spec ID from name for the detail modal
  const resolveOffensiveId = (name) => {
    const n = name.toLowerCase();
    if (n.includes('iskander')) return 'iskander';
    if (n.includes('kinzhal')) return 'kinzhal';
    if (n.includes('kh-101') || n.includes('kh101')) return 'kh101';
    if (n.includes('shahed')) return 'shahed136';
    if (n.includes('qassam')) return 'qassam';
    if (n.includes('fateh')) return 'fateh110';
    return 'kalibr';
  };

  const resolveInterceptorId = (name) => {
    const n = name.toLowerCase();
    if (n.includes('iron') || n.includes('tamir')) return 'iron-dome-tamir';
    if (n.includes('thaad')) return 'thaad';
    if (n.includes('arrow')) return 'arrow-3';
    return 'patriot-pac3';
  };

  const COLORS = ['#FF3B30', '#FF9500', '#007AFF', '#34C759', '#AF52DE', '#FF2D55'];

  return (
    <div className="App min-h-screen bg-[#0A0A0A] text-white">
      <div className="bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-[#27272A] sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto p-4 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <Crosshair size={32} className="text-[#FF3B30]" weight="duotone" />
              <h1 className="text-4xl sm:text-5xl lg:text-6xl tracking-tighter uppercase font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                MISSILE TRACKING DASHBOARD
              </h1>
            </div>
            {lastUpdate && (
              <div className="flex items-center gap-2 px-3 py-1 bg-[#141414] border border-[#27272A] rounded-sm">
                <div className="w-2 h-2 bg-[#34C759] rounded-full animate-pulse"></div>
                <span className="text-xs text-[#A1A1AA]">
                  Updated: {new Date(lastUpdate).toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <p className="text-base leading-relaxed font-normal text-[#A1A1AA]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Real-time monitoring of global missile conflicts and defense systems • Auto-updates every hour
          </p>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto p-4 md:p-6">
        {/* Top Leaderboard Ad */}
        <AdBanner slot="header-leaderboard" format="horizontal" />

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
              value={formatCost(filteredStats.total_missile_cost)}
              color="text-[#FF9500]"
            />
            <StatCard
              icon={Target}
              label="Defense Cost"
              value={formatCost(filteredStats.total_defense_cost)}
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

        {/* Instagram Story Share */}
        {statistics && (
          <div className="mb-6">
            <InstagramShare stats={filteredStats} />
          </div>
        )}

        {/* Live Missile Trajectory Map */}
        <div className="bg-[#141414] border border-[#27272A] rounded-sm p-4 mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="relative flex-shrink-0">
              <div className="w-3 h-3 bg-[#FF3B30] rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-3 h-3 bg-[#FF3B30] rounded-full animate-ping opacity-40"></div>
            </div>
            <h2 data-testid="map-title" className="text-2xl sm:text-3xl lg:text-4xl tracking-tight uppercase font-bold" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              LIVE MISSILE TRAJECTORY MAP
            </h2>
            <span className="px-2 py-0.5 bg-[#FF3B30] text-white text-xs font-bold rounded-sm tracking-wider">LIVE</span>
          </div>
          <p className="text-xs text-[#71717A] mb-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Animated great-circle trajectories from launch origin to target · Glowing dots track each missile in real time · Hover for strike details
          </p>
          <div data-testid="strike-map">
            <MissileTrajectoryMap
              strikes={filteredStrikes}
              selectedConflict={selectedConflict}
            />
          </div>
        </div>

        {/* Live Missile Events Panel */}
        <div className="bg-[#141414] border border-[#27272A] rounded-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-[#FF3B30] rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-3 h-3 bg-[#FF3B30] rounded-full animate-ping opacity-50"></div>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight uppercase font-bold" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                LIVE CONFLICT MONITOR
              </h2>
              <span className="px-2 py-0.5 bg-[#FF3B30] text-white text-xs font-bold rounded-sm tracking-wider">LIVE</span>
            </div>
            <div className="flex items-center gap-3">
              {liveLastFetch && (
                <span className="text-xs text-[#71717A]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Updated: {liveLastFetch.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchLiveEvents}
                disabled={liveLoading}
                className="px-3 py-1 bg-[#1C1C1E] hover:bg-[#27272A] border border-[#27272A] rounded-sm text-xs text-[#A1A1AA] transition-colors disabled:opacity-50"
              >
                {liveLoading ? '⟳ Scanning...' : '⟳ Refresh'}
              </button>
            </div>
          </div>

          <p className="text-xs text-[#71717A] mb-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Sourced from GDELT DOC 2.0 API — scanning global news for missile/drone strike reports in real time. Auto-refreshes every 5 minutes.
          </p>

          {liveLoading && liveEvents.length === 0 ? (
            <div className="text-center py-8 text-[#A1A1AA]">
              <div className="text-2xl mb-2">⟳</div>
              <div className="text-sm">Scanning live news sources…</div>
            </div>
          ) : liveEvents.length === 0 ? (
            <div className="text-center py-8 text-[#71717A] text-sm">
              No live missile events detected in the last 24 hours.<br />
              <span className="text-xs">GDELT scans thousands of global news sources for conflict reports.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {liveEvents.map((event, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-[#1C1C1E] border border-[#27272A] rounded-sm hover:bg-[#27272A] transition-colors">
                  <div className="flex-shrink-0 mt-0.5">
                    {event.intercepted ? (
                      <CheckCircle size={16} className="text-[#34C759]" weight="duotone" />
                    ) : (
                      <Rocket size={16} className="text-[#FF3B30]" weight="duotone" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{event.title}</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-xs text-[#71717A]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {event.date ? new Date(event.date).toLocaleString() : 'Recent'}
                      </span>
                      {event.source && (
                        <span className="text-xs text-[#4b5563]">· {event.source}</span>
                      )}
                    </div>
                  </div>
                  {event.url && (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-xs text-[#007AFF] hover:text-[#3b9eff] transition-colors"
                    >
                      Source ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mid-Content Ad */}
        <AdBanner slot="mid-content" format="horizontal" />

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
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-[#1C1C1E] border border-[#27272A] rounded-sm hover:bg-[#27272A] transition-colors gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{missile.name}</div>
                    <div className="text-sm text-[#71717A]">{missile.type}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-[#FF9500] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatCost(missile.cost)}
                    </div>
                    <button
                      onClick={() => {
                        setSelected3DMissile({ ...missile, id: resolveOffensiveId(missile.name) });
                        setShow3DModal(true);
                      }}
                      className="px-3 py-1 bg-[#7c3aed] hover:bg-[#6d28d9] rounded-sm transition-colors flex items-center gap-1 text-sm font-semibold flex-shrink-0"
                      title="View 3D model"
                    >
                      <Cube size={15} weight="duotone" />
                      3D
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMissile(resolveOffensiveId(missile.name));
                        setShowSpecsModal(true);
                      }}
                      className="px-3 py-1 bg-[#007AFF] hover:bg-[#0056b3] rounded-sm transition-colors flex items-center gap-2 text-sm font-semibold flex-shrink-0"
                      data-testid="view-details-offensive"
                    >
                      <ListBullets size={16} weight="duotone" />
                      Full Details
                    </button>
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
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-[#1C1C1E] border border-[#27272A] rounded-sm hover:bg-[#27272A] transition-colors gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{interceptor.name}</div>
                    {interceptor.type && <div className="text-sm text-[#71717A]">{interceptor.type}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-[#34C759] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatCost(interceptor.cost)}
                    </div>
                    <button
                      onClick={() => {
                        setSelected3DMissile({ ...interceptor, id: resolveInterceptorId(interceptor.name) });
                        setShow3DModal(true);
                      }}
                      className="px-3 py-1 bg-[#7c3aed] hover:bg-[#6d28d9] rounded-sm transition-colors flex items-center gap-1 text-sm font-semibold flex-shrink-0"
                      title="View 3D model"
                    >
                      <Cube size={15} weight="duotone" />
                      3D
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMissile(resolveInterceptorId(interceptor.name));
                        setShowSpecsModal(true);
                      }}
                      className="px-3 py-1 bg-[#34C759] hover:bg-[#28a745] rounded-sm transition-colors flex items-center gap-2 text-sm font-semibold text-black flex-shrink-0"
                      data-testid="view-details-interceptor"
                    >
                      <ListBullets size={16} weight="duotone" />
                      Full Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Ad Before Table */}
        <AdBanner slot="bottom-content" format="horizontal" />

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
      
      <MissileDetailModal
        missileId={selectedMissile}
        isOpen={showSpecsModal}
        onClose={() => setShowSpecsModal(false)}
        backendUrl={BACKEND_URL}
      />

      {show3DModal && selected3DMissile && (
        <Missile3DModal
          missile={selected3DMissile}
          onClose={() => { setShow3DModal(false); setSelected3DMissile(null); }}
        />
      )}

      {/* One-time push notification opt-in prompt */}
      <NotificationPrompt />
    </div>
  );
}

// Main App with Routing
function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </HashRouter>
  );
}

export default App;