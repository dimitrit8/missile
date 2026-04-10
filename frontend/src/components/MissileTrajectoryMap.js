/**
 * MissileTrajectoryMap.js
 *
 * Missile trajectory map — NO looping.
 *
 * Each missile animates ONCE from launch origin → target, then stops.
 *
 * Modes:
 *  HISTORY — side panel lists every recorded strike by date/time.
 *            Click ▶ on any row to animate that missile once.
 *            "Replay All" staggers all strikes in chronological order.
 *  LIVE    — shows recent English-language GDELT news articles about
 *            missile/drone events. Click "Simulate" on any article to
 *            draw a rough trajectory if location can be inferred.
 *
 * Map layers (all toggleable):
 *  - Completed-trajectory arcs (faded dashes, stay forever after animation)
 *  - Impact circles at targets (size ∝ casualties)
 *  - Animated glowing dot while missile is in flight
 *  - Trailing dash line behind the dot
 */

import React, {
  useEffect, useRef, useMemo, useState, useCallback
} from 'react';
import {
  MapContainer, TileLayer, Polyline, Circle, Popup, useMap
} from 'react-leaflet';
import L from 'leaflet';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// ─── Launch-coordinate lookup ─────────────────────────────────────────────────
const LAUNCH_LOOKUP = [
  { k: ['caspian'],                          c: [45.3, 51.0] },
  { k: ['engels', 'tu-95', 'saratov'],       c: [51.4, 46.1] },
  { k: ['tu-22', 'dyagilevo'],               c: [54.6, 40.1] },
  { k: ['volgograd', 'volga military'],      c: [48.7, 44.5] },
  { k: ['belgorod', 'kursk', 'bryansk'],     c: [50.6, 36.6] },
  { k: ['akhtubinsk', 'kinzhal', 'mig-31'], c: [48.3, 46.1] },
  { k: ['crimea', 'sevastopol', 'saki'],     c: [44.9, 34.1] },
  { k: ['submarine', 'black sea', 'krasnodar'], c: [43.0, 34.0] },
  { k: ['minsk', 'belarus'],                 c: [53.9, 27.6] },
  { k: ['tabriz'],                           c: [38.1, 46.3] },
  { k: ['isfahan'],                          c: [32.6, 51.7] },
  { k: ['tehran'],                           c: [35.7, 51.4] },
  { k: ['western iran', 'iran'],             c: [32.5, 48.0] },
  { k: ['northern gaza', 'beit lahiya'],     c: [31.55, 34.52] },
  { k: ['southern gaza', 'rafah'],           c: [31.30, 34.27] },
  { k: ['gaza'],                             c: [31.50, 34.46] },
  { k: ['southern lebanon', 'nabatieh'],     c: [33.20, 35.50] },
  { k: ['beirut', 'bekaa'],                  c: [33.55, 35.65] },
  { k: ['lebanon'],                          c: [33.50, 35.60] },
];

function getLaunchCoords(loc, conflictId) {
  if (loc) {
    const l = loc.toLowerCase();
    for (const e of LAUNCH_LOOKUP) if (e.k.some(k => l.includes(k))) return e.c;
  }
  if (conflictId?.includes('russia'))  return [55.0, 37.6];
  if (conflictId?.includes('iran'))    return [33.0, 53.0];
  if (conflictId?.includes('hamas') || conflictId?.includes('israel')) return [31.5, 34.5];
  return [50.0, 30.0];
}

// ─── Great-circle arc ─────────────────────────────────────────────────────────
function computeArc(from, to, n = 64) {
  if (!from || !to) return [];
  const [lat1, lng1] = from, [lat2, lng2] = to;
  const D = Math.PI / 180, R = 180 / Math.PI;
  const φ1 = lat1 * D, λ1 = lng1 * D, φ2 = lat2 * D, λ2 = lng2 * D;
  const a = Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2;
  const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  if (d < 0.0005) return [[lat1, lng1], [lat2, lng2]];
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, A = Math.sin((1 - t) * d) / Math.sin(d), B = Math.sin(t * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    return [Math.atan2(z, Math.sqrt(x * x + y * y)) * R, Math.atan2(y, x) * R];
  });
}

function missileSpeed(type) {
  if (!type) return 0.05;
  const t = type.toLowerCase();
  if (t.includes('kinzhal'))  return 0.10;
  if (t.includes('iskander') || t.includes('fateh')) return 0.07;
  if (t.includes('patriot') || t.includes('thaad') || t.includes('arrow') || t.includes('tamir')) return 0.12;
  if (t.includes('kalibr') || t.includes('kh-101')) return 0.032;
  if (t.includes('shahed'))   return 0.025;
  if (t.includes('qassam'))   return 0.045;
  return 0.05;
}

// ─── Global CSS injection (once) ─────────────────────────────────────────────
let _cssInjected = false;
function injectCSS() {
  if (_cssInjected || typeof document === 'undefined') return;
  _cssInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes mdot-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:.7} }
    .mdot { width:12px;height:12px;border-radius:50%;animation:mdot-pulse .6s ease-in-out infinite;cursor:pointer; }
    .mdot.hostile { background:#FF3B30;box-shadow:0 0 10px 4px #FF3B3088; }
    .mdot.intercept { background:#34C759;box-shadow:0 0 10px 4px #34C75988; }
    .missile-tip { background:rgba(9,11,18,.95)!important;border:1px solid #374151!important;
      color:#e5e7eb!important;font-family:monospace!important;font-size:12px!important;
      padding:6px 10px!important;border-radius:4px!important;box-shadow:0 4px 12px rgba(0,0,0,.5)!important; }
  `;
  document.head.appendChild(s);
}

// ─── Animated missile layer (imperative Leaflet, ONE-SHOT per trajectory) ─────
function AnimatedMissileLayer({ trajectories, onFinished }) {
  const map = useMap();
  const markerRef  = useRef({});
  const trailRef   = useRef({});
  const progressRef = useRef({});
  const animRef    = useRef(null);
  const lastTRef   = useRef(null);
  const doneRef    = useRef(new Set());
  const cbRef      = useRef(onFinished);
  cbRef.current    = onFinished;

  useEffect(() => {
    injectCSS();
    if (!map) return;

    // Add new markers; remove stale ones
    const currentIds = new Set(trajectories.map(t => t.id));

    // Remove stale
    Object.keys(markerRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        try { markerRef.current[id].remove(); } catch (_) {}
        try { trailRef.current[id].remove(); } catch (_) {}
        delete markerRef.current[id];
        delete trailRef.current[id];
        delete progressRef.current[id];
        doneRef.current.delete(id);
      }
    });

    // Add new
    trajectories.forEach(traj => {
      if (markerRef.current[traj.id] || doneRef.current.has(traj.id)) return;
      const cls = traj.intercepted ? 'intercept' : 'hostile';
      const icon = L.divIcon({
        className: '',
        html: `<div class="mdot ${cls}"></div>`,
        iconSize: [12, 12], iconAnchor: [6, 6],
      });
      const m = L.marker(traj.arcPoints[0] || [0, 0], { icon, zIndexOffset: 900 });
      m.bindTooltip(
        `<b>${traj.missileType}</b><br/>${traj.from} → ${traj.location}<br/>${traj.date}`,
        { sticky: true, className: 'missile-tip' }
      );
      m.addTo(map);
      markerRef.current[traj.id] = m;
      progressRef.current[traj.id] = 0;

      const color = traj.intercepted ? '#34C759' : '#FF3B30';
      const trail = L.polyline([], { color, weight: 2, opacity: .65, dashArray: '5 4' }).addTo(map);
      trailRef.current[traj.id] = trail;
    });

    if (trajectories.length === 0) return;

    const animate = (ts) => {
      if (!lastTRef.current) lastTRef.current = ts;
      const dt = Math.min((ts - lastTRef.current) / 1000, 0.1);
      lastTRef.current = ts;

      trajectories.forEach(traj => {
        if (doneRef.current.has(traj.id)) return;
        const pts = traj.arcPoints;
        if (!pts || pts.length < 2) return;

        progressRef.current[traj.id] = Math.min(
          1, (progressRef.current[traj.id] || 0) + traj.speed * dt
        );
        const p = progressRef.current[traj.id];
        const idx = Math.min(Math.floor(p * (pts.length - 1)), pts.length - 1);

        if (markerRef.current[traj.id]) markerRef.current[traj.id].setLatLng(pts[idx]);

        const trailStart = Math.max(0, idx - Math.floor(pts.length * 0.12));
        if (trailRef.current[traj.id]) trailRef.current[traj.id].setLatLngs(pts.slice(trailStart, idx + 1));

        if (p >= 1 && !doneRef.current.has(traj.id)) {
          doneRef.current.add(traj.id);
          // Remove animated marker after brief pause; trail stays as completed arc
          setTimeout(() => {
            try { markerRef.current[traj.id]?.remove(); } catch (_) {}
            try { trailRef.current[traj.id]?.remove(); } catch (_) {}
            delete markerRef.current[traj.id];
            delete trailRef.current[traj.id];
          }, 800);
          cbRef.current && cbRef.current(traj.id);
        }
      });

      animRef.current = requestAnimationFrame(animate);
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    lastTRef.current = null;
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTRef.current = null;
    };
  }, [map, trajectories]);

  // Full cleanup on unmount
  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    Object.values(markerRef.current).forEach(m => { try { m.remove(); } catch (_) {} });
    Object.values(trailRef.current).forEach(m => { try { m.remove(); } catch (_) {} });
  }, []);

  return null;
}

// ─── Completed arcs (permanent dashed lines after missile finishes) ───────────
function CompletedArcs({ arcs, show }) {
  if (!show) return null;
  return arcs.map(arc => (
    <Polyline key={`carc-${arc.id}`} positions={arc.points}
      pathOptions={{ color: arc.intercepted ? '#34C759' : '#FF3B30', weight: 1, opacity: .2, dashArray: '4 6' }} />
  ));
}

// ─── Impact circles ───────────────────────────────────────────────────────────
function ImpactCircles({ trajectories, show }) {
  if (!show) return null;
  return trajectories.map(t => (
    <Circle key={`imp-${t.id}`} center={t.targetCoords}
      radius={3000 + Math.min(t.casualties || 0, 500) * 25}
      pathOptions={{ fillColor: t.intercepted ? '#34C759' : '#FF3B30', fillOpacity: .3,
        color: t.intercepted ? '#34C759' : '#FF3B30', weight: 1.2 }}>
      <Popup>
        <div style={{ fontFamily: 'monospace', fontSize: 13, minWidth: 200 }}>
          <b>{t.location}, {t.country}</b><br />
          <span style={{ color: '#666' }}>{t.date}</span><br />
          Missile: <b>{t.missileType}</b><br />
          Launch: {t.from}<br />
          <span style={{ color: t.intercepted ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
            {t.intercepted ? '✓ INTERCEPTED' : '✗ HIT TARGET'}
          </span>
          {t.intercepted && t.interceptorType && <><br />Interceptor: {t.interceptorType}</>}
          <br />Casualties: {t.casualties} · Deceased: {t.deceased}<br />
          <span style={{ color: '#888', fontSize: 11 }}>{t.description}</span>
        </div>
      </Popup>
    </Circle>
  ));
}

// ─── Side panel (History or Live) ────────────────────────────────────────────
function SidePanel({
  mode, setMode, sortedStrikes, inFlightIds, completedIds,
  onLaunch, onReplayAll, liveEvents, liveLoading, onRefreshLive,
  isMobile, isOpen, onToggle,
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return sortedStrikes;
    const q = search.toLowerCase();
    return sortedStrikes.filter(s =>
      s.missile_type?.toLowerCase().includes(q) ||
      s.location?.toLowerCase().includes(q) ||
      s.date?.includes(q) ||
      s.country?.toLowerCase().includes(q)
    );
  }, [sortedStrikes, search]);

  const panelStyle = isMobile ? {
    // Mobile: full-width panel below the map (no absolute positioning)
    width: '100%', zIndex: 1000,
    background: 'rgba(9,11,18,.97)',
    borderTop: '1px solid #1f2937',
    display: isOpen ? 'flex' : 'none',
    flexDirection: 'column',
    maxHeight: 340,
  } : {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: 240, zIndex: 1000,
    background: 'rgba(9,11,18,.93)',
    borderLeft: '1px solid #1f2937',
    display: 'flex', flexDirection: 'column',
    backdropFilter: 'blur(6px)',
  };

  return (
    <div style={panelStyle}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1f2937' }}>
        {['history', 'live'].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer',
            background: mode === m ? '#1f2937' : 'transparent',
            color: mode === m ? '#e5e7eb' : '#6b7280',
            fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
            letterSpacing: 1, textTransform: 'uppercase',
            borderBottom: mode === m ? '2px solid #10b981' : '2px solid transparent',
          }}>{m === 'history' ? '⏱ History' : '● Live'}</button>
        ))}
      </div>

      {mode === 'history' ? (
        <>
          {/* Search + Replay */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #1f2937' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search missile, location…"
              style={{
                width: '100%', background: '#0d1117', border: '1px solid #374151',
                borderRadius: 3, color: '#e5e7eb', padding: '4px 8px',
                fontFamily: 'monospace', fontSize: 11, boxSizing: 'border-box',
              }}
            />
            <button onClick={onReplayAll} style={{
              marginTop: 6, width: '100%', padding: '5px 0',
              background: '#374151', border: 'none', borderRadius: 3,
              color: '#e5e7eb', fontFamily: 'monospace', fontSize: 11,
              cursor: 'pointer', fontWeight: 700,
            }}>
              ▶ Replay All ({sortedStrikes.length})
            </button>
          </div>

          {/* Strike list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map(s => {
              const flying    = inFlightIds.has(s.id);
              const done      = completedIds.has(s.id);
              const color     = s.intercepted ? '#34C759' : '#FF3B30';
              return (
                <div key={s.id} style={{
                  padding: '7px 10px', borderBottom: '1px solid #111827',
                  background: flying ? 'rgba(16,185,129,.07)' : 'transparent',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 10, color,
                      fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {s.intercepted ? '✓' : '✗'} {s.missile_type}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                      {s.date}
                    </div>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 10, color: '#6b7280',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {s.location}, {s.country}
                    </div>
                    {s.deceased > 0 && (
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#ef4444', marginTop: 1 }}>
                        {s.deceased} deceased
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onLaunch(s)}
                    disabled={flying}
                    style={{
                      flexShrink: 0, width: 24, height: 24,
                      background: flying ? '#10b981' : done ? '#1e3a2a' : '#1f2937',
                      border: `1px solid ${flying ? '#10b981' : done ? '#16a34a' : '#374151'}`,
                      borderRadius: 3, color: flying ? '#000' : done ? '#10b981' : '#9ca3af',
                      cursor: flying ? 'default' : 'pointer',
                      fontSize: 12, fontFamily: 'monospace',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title={flying ? 'In flight…' : 'Launch & track'}
                  >
                    {flying ? '✦' : done ? '✓' : '▶'}
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: '#4b5563', fontSize: 11, fontFamily: 'monospace' }}>
                No strikes match your search.
              </div>
            )}
          </div>

          <div style={{ padding: '5px 10px', borderTop: '1px solid #1f2937', fontSize: 9, color: '#374151', fontFamily: 'monospace', textAlign: 'center' }}>
            Click ▶ to animate · ✓ = done
          </div>
        </>
      ) : (
        <>
          {/* Live panel */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF3B30', display: 'inline-block', boxShadow: '0 0 5px #FF3B30', animation: 'mdot-pulse 1s infinite' }} />
              <span style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 10, fontWeight: 700 }}>LIVE EVENTS</span>
            </div>
            <button onClick={onRefreshLive} disabled={liveLoading} style={{
              background: 'transparent', border: '1px solid #374151', borderRadius: 3,
              color: '#6b7280', fontSize: 10, cursor: 'pointer', padding: '2px 7px', fontFamily: 'monospace'
            }}>
              {liveLoading ? '…' : '⟳'}
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {liveEvents.length === 0 && !liveLoading && (
              <div style={{ padding: 16, textAlign: 'center', color: '#4b5563', fontSize: 11, fontFamily: 'monospace' }}>
                No live events detected.<br />Sourced from GDELT news API.
              </div>
            )}
            {liveLoading && (
              <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}>
                Scanning news sources…
              </div>
            )}
            {liveEvents.map((ev, i) => (
              <div key={i} style={{ padding: '7px 10px', borderBottom: '1px solid #111827' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#e5e7eb', marginBottom: 3, lineHeight: 1.3 }}>
                  {ev.title?.slice(0, 90)}{ev.title?.length > 90 ? '…' : ''}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#6b7280', fontFamily: 'monospace' }}>{ev.source}</span>
                  {ev.url && (
                    <a href={ev.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 9, color: '#3b82f6', marginLeft: 'auto', textDecoration: 'none' }}>
                      Source ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '5px 10px', borderTop: '1px solid #1f2937', fontSize: 9, color: '#374151', fontFamily: 'monospace', textAlign: 'center' }}>
            GDELT DOC 2.0 · English sources only
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────
export default function MissileTrajectoryMap({ strikes, selectedConflict }) {
  const [mode, setMode]                 = useState('history');
  const [activeTrajectories, setActiveTraj] = useState([]);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [completedArcs, setCompletedArcs] = useState([]);
  const [showArcs, setShowArcs]         = useState(true);
  const [showImpact, setShowImpact]     = useState(true);
  const [liveEvents, setLiveEvents]     = useState([]);
  const [liveLoading, setLiveLoading]   = useState(false);
  const [isMobile, setIsMobile]         = useState(() => window.innerWidth < 768);
  const [panelOpen, setPanelOpen]       = useState(false);
  const replayTimersRef                 = useRef([]);

  // Track viewport width for responsive layout
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const filteredStrikes = useMemo(() =>
    selectedConflict === 'all' ? strikes : strikes.filter(s => s.conflict_id === selectedConflict),
    [strikes, selectedConflict]
  );

  const sortedStrikes = useMemo(() =>
    [...filteredStrikes].sort((a, b) => b.date.localeCompare(a.date)),
    [filteredStrikes]
  );

  // Build trajectory object from a strike record
  const buildTraj = useCallback((s) => ({
    id:           s.id,
    arcPoints:    computeArc(getLaunchCoords(s.launch_location, s.conflict_id), [s.latitude, s.longitude]),
    launchCoords: getLaunchCoords(s.launch_location, s.conflict_id),
    targetCoords: [s.latitude, s.longitude],
    intercepted:  s.intercepted,
    missileType:  s.missile_type || 'Unknown',
    interceptorType: s.interceptor_type,
    from:         s.launch_location ? s.launch_location.split(',')[0] : 'Unknown',
    location:     s.location,
    country:      s.country,
    date:         s.date,
    description:  s.description || '',
    casualties:   s.casualties || 0,
    deceased:     s.deceased || 0,
    speed:        missileSpeed(s.missile_type),
  }), []);

  // All trajectory objects for impact circles
  const allTrajectories = useMemo(() =>
    filteredStrikes.filter(s => s.latitude != null && s.longitude != null).map(buildTraj),
    [filteredStrikes, buildTraj]
  );

  // Launch a single missile (animate once)
  const launchMissile = useCallback((strike) => {
    if (!strike.latitude || !strike.longitude) return;
    const traj = buildTraj(strike);
    setActiveTraj(prev => [...prev.filter(t => t.id !== strike.id), traj]);
    setCompletedIds(prev => { const s = new Set(prev); s.delete(strike.id); return s; });
  }, [buildTraj]);

  // Called when a missile finishes its trajectory
  const handleFinished = useCallback((id) => {
    setCompletedIds(prev => new Set([...prev, id]));
    // Keep its arc as a permanent line
    const traj = allTrajectories.find(t => t.id === id);
    if (traj) {
      setCompletedArcs(prev => [...prev.filter(a => a.id !== id), {
        id, points: traj.arcPoints, intercepted: traj.intercepted
      }]);
    }
    setActiveTraj(prev => prev.filter(t => t.id !== id));
  }, [allTrajectories]);

  // Replay all in chronological order
  const replayAll = useCallback(() => {
    // Clear timers from previous replay
    replayTimersRef.current.forEach(clearTimeout);
    replayTimersRef.current = [];
    setActiveTraj([]);
    setCompletedIds(new Set());
    setCompletedArcs([]);

    const chrono = [...filteredStrikes]
      .filter(s => s.latitude && s.longitude)
      .sort((a, b) => a.date.localeCompare(b.date));

    chrono.forEach((strike, i) => {
      const t = setTimeout(() => launchMissile(strike), i * 1400);
      replayTimersRef.current.push(t);
    });
  }, [filteredStrikes, launchMissile]);

  // Cleanup replay timers on unmount
  useEffect(() => () => replayTimersRef.current.forEach(clearTimeout), []);

  // Fetch live events
  const fetchLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/live-events`);
      const data = await r.json();
      setLiveEvents(data || []);
    } catch (_) {}
    setLiveLoading(false);
  }, []);

  useEffect(() => { fetchLive(); }, [fetchLive]);

  const inFlightIds = useMemo(() => new Set(activeTrajectories.map(t => t.id)), [activeTrajectories]);

  const mapHeight = isMobile ? 340 : 620;
  const mapPaddingRight = isMobile ? 0 : 240;

  return (
    <div style={{ touchAction: 'pan-y' }}>
      {/* Map wrapper */}
      <div style={{ position: 'relative' }}>
        <div style={{ height: mapHeight, borderRadius: 6, overflow: 'hidden' }}>
          <MapContainer
            center={[35, 35]}
            zoom={isMobile ? 3 : 4}
            style={{ height: '100%', width: '100%', paddingRight: mapPaddingRight }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <CompletedArcs arcs={completedArcs} show={showArcs} />
            <ImpactCircles trajectories={allTrajectories} show={showImpact} />
            <AnimatedMissileLayer
              trajectories={activeTrajectories}
              onFinished={handleFinished}
            />
          </MapContainer>
        </div>

        {/* Desktop: absolute side panel */}
        {!isMobile && (
          <SidePanel
            mode={mode} setMode={setMode}
            sortedStrikes={sortedStrikes}
            inFlightIds={inFlightIds}
            completedIds={completedIds}
            onLaunch={launchMissile}
            onReplayAll={replayAll}
            liveEvents={liveEvents}
            liveLoading={liveLoading}
            onRefreshLive={fetchLive}
            isMobile={false}
            isOpen={true}
            onToggle={() => {}}
          />
        )}

        {/* Mobile: floating toggle button on the map */}
        {isMobile && (
          <button
            onClick={() => setPanelOpen(v => !v)}
            style={{
              position: 'absolute', bottom: 10, right: 10, zIndex: 1100,
              background: 'rgba(9,11,18,.92)', border: '1px solid #374151',
              borderRadius: 6, color: '#e5e7eb', fontFamily: 'monospace',
              fontSize: 11, fontWeight: 700, padding: '6px 12px',
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.5)',
            }}
          >
            {panelOpen ? '✕ Close' : '☰ Strikes'}
          </button>
        )}
      </div>

      {/* Mobile: panel below map (collapsible) */}
      {isMobile && (
        <SidePanel
          mode={mode} setMode={setMode}
          sortedStrikes={sortedStrikes}
          inFlightIds={inFlightIds}
          completedIds={completedIds}
          onLaunch={launchMissile}
          onReplayAll={replayAll}
          liveEvents={liveEvents}
          liveLoading={liveLoading}
          onRefreshLive={fetchLive}
          isMobile={true}
          isOpen={panelOpen}
          onToggle={() => setPanelOpen(v => !v)}
        />
      )}

      {/* Legend + toggles */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: isMobile ? 8 : 12,
        alignItems: 'center', marginTop: 10,
      }}>
        <div style={{ display: 'flex', gap: isMobile ? 10 : 16, flexWrap: 'wrap' }}>
          {[
            { color: '#FF3B30', label: 'Hostile Strike' },
            { color: '#34C759', label: 'Intercepted' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />
              <span style={{ color: '#A1A1AA', fontSize: isMobile ? 11 : 13 }}>{label}</span>
            </div>
          ))}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 22, height: 0, borderTop: '2px dashed #FF3B30', opacity: .4 }} />
              <span style={{ color: '#A1A1AA', fontSize: 13 }}>Completed arc</span>
            </div>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: 'Arcs', active: showArcs,   onClick: () => setShowArcs(v => !v),   activeColor: '#FF3B30' },
            { label: 'Impacts', active: showImpact, onClick: () => setShowImpact(v => !v), activeColor: '#FF9500' },
          ].map(({ label, active, onClick, activeColor }) => (
            <button key={label} onClick={onClick} style={{
              padding: isMobile ? '4px 10px' : '4px 12px',
              borderRadius: 4, border: '1px solid #27272A',
              background: active ? activeColor : '#141414',
              color: active ? (activeColor === '#FF9500' ? '#000' : '#fff') : '#A1A1AA',
              fontSize: isMobile ? 11 : 12, cursor: 'pointer', fontFamily: 'monospace',
            }}>
              {active ? '◉' : '○'} {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}