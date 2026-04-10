import { useEffect, useState } from "react";
import axios from "axios";
import { Users, Globe, MapPin, Calendar, Lock, Eye, ChartLineUp, Bell, BellSlash, Terminal, ArrowClockwise } from "@phosphor-icons/react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API}/admin/analytics?password=${password}`);
      setAnalytics(response.data);
      setIsAuthenticated(true);
      fetchLogs(password);
    } catch (err) {
      setError("Invalid password");
    }
    setLoading(false);
  };

  const fetchLogs = async (pwd) => {
    setLogsLoading(true);
    try {
      const res = await axios.get(`${API}/admin/logs?password=${pwd || password}&limit=50`);
      setLogs(res.data.logs || []);
    } catch (err) {
      setLogs([]);
    }
    setLogsLoading(false);
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/analytics?password=${password}`);
      setAnalytics(response.data);
      await fetchLogs();
    } catch (err) {
      setError("Failed to refresh data");
    }
    setLoading(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="bg-[#141414] border border-[#27272A] rounded-lg p-8 max-w-md w-full">
          <div className="flex items-center gap-3 mb-6">
            <Lock size={32} className="text-[#FF3B30]" weight="duotone" />
            <h1 className="text-2xl font-bold text-white">Admin Analytics</h1>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full p-3 bg-[#1C1C1E] border border-[#27272A] rounded-lg text-white mb-4 focus:outline-none focus:border-[#007AFF]"
            />
            {error && <p className="text-[#FF3B30] text-sm mb-4">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full p-3 bg-[#007AFF] hover:bg-[#0056b3] rounded-lg text-white font-semibold transition-colors"
            >
              {loading ? "Authenticating..." : "Access Dashboard"}
            </button>
          </form>
          <p className="text-[#71717A] text-xs mt-4 text-center">
            This dashboard is for admin use only
          </p>
        </div>
      </div>
    );
  }

  const SmallStatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-[#141414] border border-[#27272A] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className={color} weight="duotone" />
        <span className="text-xs text-[#A1A1AA] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value?.toLocaleString() || 0}</div>
    </div>
  );

  const statusColor = (status) => {
    if (status === "error") return "text-[#FF3B30]";
    if (status === "warning") return "text-[#FF9500]";
    return "text-[#34C759]";
  };

  const statusDot = (status) => {
    if (status === "error") return "bg-[#FF3B30]";
    if (status === "warning") return "bg-[#FF9500]";
    return "bg-[#34C759]";
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Eye size={32} className="text-[#007AFF]" weight="duotone" />
            <h1 className="text-3xl font-bold">Visitor Analytics</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={refreshData}
              className="px-4 py-2 bg-[#141414] border border-[#27272A] rounded-lg hover:bg-[#1C1C1E] transition-colors flex items-center gap-2"
            >
              <ArrowClockwise size={16} className={loading ? "animate-spin" : ""} />
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-[#27272A] rounded-lg hover:bg-[#3f3f46] transition-colors"
            >
              Back to Site
            </a>
          </div>
        </div>

        {/* Visitor Traffic — two prominent cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-[#141414] border border-[#27272A] rounded-lg p-5">
            <div className="flex items-center gap-2 mb-1">
              <ChartLineUp size={20} className="text-[#007AFF]" weight="duotone" />
              <span className="text-xs text-[#A1A1AA] uppercase tracking-wider font-semibold">Total Page Views</span>
            </div>
            <div className="text-5xl font-bold text-[#007AFF] mb-2">
              {analytics?.total_visitors?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-[#4b5563] font-mono leading-relaxed">
              Every visit counted — including repeat visits<br />from the same IP address.
            </div>
          </div>

          <div className="bg-[#141414] border border-[#34C759]/30 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-1">
              <Users size={20} className="text-[#34C759]" weight="duotone" />
              <span className="text-xs text-[#A1A1AA] uppercase tracking-wider font-semibold">Unique Visitors</span>
            </div>
            <div className="text-5xl font-bold text-[#34C759] mb-2">
              {analytics?.unique_visitors?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-[#4b5563] font-mono leading-relaxed">
              Each IP address counted only once — reflects<br />the number of different people who visited.
            </div>
          </div>
        </div>

        {/* Today + This Week */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <SmallStatCard icon={Calendar} label="Visits Today" value={analytics?.today_visitors} color="text-[#FF9500]" />
          <SmallStatCard icon={ChartLineUp} label="Visits This Week" value={analytics?.week_visitors} color="text-[#FF3B30]" />
        </div>

        {/* Push Notification Stats */}
        <div className="bg-[#141414] border border-[#27272A] rounded-lg p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={20} className="text-[#10b981]" weight="duotone" />
            <h2 className="text-lg font-bold text-white">Push Notification Opt-ins</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#0d1117] border border-[#1f2937] rounded-lg p-4 text-center">
              <div className="flex justify-center mb-2">
                <Bell size={22} className="text-[#10b981]" weight="duotone" />
              </div>
              <div className="text-2xl font-bold text-[#10b981]">
                {analytics?.notifications_accepted?.toLocaleString() ?? '—'}
              </div>
              <div className="text-xs text-[#6b7280] uppercase tracking-wider mt-1 font-mono">
                Currently Subscribed
              </div>
            </div>
            <div className="bg-[#0d1117] border border-[#1f2937] rounded-lg p-4 text-center">
              <div className="flex justify-center mb-2">
                <Users size={22} className="text-[#3b82f6]" weight="duotone" />
              </div>
              <div className="text-2xl font-bold text-[#3b82f6]">
                {analytics?.notifications_total?.toLocaleString() ?? '—'}
              </div>
              <div className="text-xs text-[#6b7280] uppercase tracking-wider mt-1 font-mono">
                Total Opted In
              </div>
            </div>
            <div className="bg-[#0d1117] border border-[#1f2937] rounded-lg p-4 text-center">
              <div className="flex justify-center mb-2">
                <BellSlash size={22} className="text-[#6b7280]" weight="duotone" />
              </div>
              <div className="text-2xl font-bold text-[#6b7280]">
                {analytics?.notifications_total != null && analytics?.notifications_accepted != null
                  ? (analytics.notifications_total - analytics.notifications_accepted).toLocaleString()
                  : '—'}
              </div>
              <div className="text-xs text-[#6b7280] uppercase tracking-wider mt-1 font-mono">
                Revoked
              </div>
            </div>
          </div>
          {analytics?.notifications_total > 0 && (
            <div className="mt-3 text-xs text-[#4b5563] font-mono text-center">
              {Math.round((analytics.notifications_accepted / analytics.notifications_total) * 100)}% of opt-ins are still active
            </div>
          )}
        </div>

        {/* ── SYSTEM LOGS ─────────────────────────────────────────────── */}
        <div className="bg-[#141414] border border-[#27272A] rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Terminal size={20} className="text-[#a78bfa]" weight="duotone" />
              <h2 className="text-lg font-bold text-white">System Logs</h2>
              <span className="text-xs text-[#6b7280] font-mono ml-1">(Real-time OSINT ingestion)</span>
            </div>
            <button
              onClick={() => fetchLogs()}
              disabled={logsLoading}
              className="px-3 py-1 text-xs bg-[#1C1C1E] border border-[#27272A] rounded hover:bg-[#27272A] transition-colors flex items-center gap-1"
            >
              <ArrowClockwise size={12} className={logsLoading ? "animate-spin" : ""} />
              {logsLoading ? "Loading..." : "Refresh Logs"}
            </button>
          </div>

          <div className="bg-[#0d1117] border border-[#1f2937] rounded-lg overflow-hidden">
            {/* Log header bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1f2937] bg-[#111827]">
              <div className="w-2 h-2 rounded-full bg-[#FF3B30]" />
              <div className="w-2 h-2 rounded-full bg-[#FF9500]" />
              <div className="w-2 h-2 rounded-full bg-[#34C759]" />
              <span className="text-xs text-[#4b5563] font-mono ml-2">ingestion.log — last 50 entries</span>
            </div>

            {/* Log entries */}
            <div className="max-h-[400px] overflow-y-auto p-3 space-y-1 font-mono text-sm">
              {logsLoading && (
                <div className="text-[#6b7280] text-center py-6">Loading logs...</div>
              )}

              {!logsLoading && logs.length === 0 && (
                <div className="text-[#4b5563] text-center py-8">
                  <Terminal size={32} className="mx-auto mb-2 opacity-30" />
                  <div>No logs yet.</div>
                  <div className="text-xs mt-1">Logs will appear here after the first ingestion cycle runs (within 1 hour of deploy).</div>
                </div>
              )}

              {!logsLoading && logs.map((log, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 px-2 py-1 rounded hover:bg-[#111827] transition-colors group"
                >
                  {/* Status dot */}
                  <div className="mt-1.5 flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full ${statusDot(log.status)}`} />
                  </div>

                  {/* Timestamp */}
                  <span className="text-[#4b5563] text-xs flex-shrink-0 w-[160px]">
                    {new Date(log.timestamp).toLocaleString([], {
                      month: "short", day: "2-digit",
                      hour: "2-digit", minute: "2-digit", second: "2-digit"
                    })}
                  </span>

                  {/* Message */}
                  <span className={`${statusColor(log.status)} flex-1 leading-snug`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            {logs.length > 0 && (
              <div className="px-4 py-2 border-t border-[#1f2937] bg-[#111827] text-xs text-[#4b5563] font-mono flex justify-between">
                <span>{logs.length} entries shown</span>
                <span>
                  Last entry: {logs[0] ? new Date(logs[0].timestamp).toLocaleTimeString() : "—"}
                </span>
              </div>
            )}
          </div>
        </div>
        {/* ── END SYSTEM LOGS ─────────────────────────────────────────── */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Visitors by Country */}
          <div className="bg-[#141414] border border-[#27272A] rounded-lg p-4">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Globe size={24} className="text-[#007AFF]" weight="duotone" />
              Visitors by Country
            </h2>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {analytics?.by_country?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-[#1C1C1E] rounded">
                  <span className="text-white">{item.country}</span>
                  <span className="text-[#007AFF] font-mono font-bold">{item.count}</span>
                </div>
              ))}
              {(!analytics?.by_country || analytics.by_country.length === 0) && (
                <p className="text-[#71717A] text-center py-4">No data yet</p>
              )}
            </div>
          </div>

          {/* Visitors by City */}
          <div className="bg-[#141414] border border-[#27272A] rounded-lg p-4">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MapPin size={24} className="text-[#FF9500]" weight="duotone" />
              Visitors by City
            </h2>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {analytics?.by_city?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-[#1C1C1E] rounded">
                  <div>
                    <span className="text-white">{item.city}</span>
                    <span className="text-[#71717A] text-sm ml-2">({item.country})</span>
                  </div>
                  <span className="text-[#FF9500] font-mono font-bold">{item.count}</span>
                </div>
              ))}
              {(!analytics?.by_city || analytics.by_city.length === 0) && (
                <p className="text-[#71717A] text-center py-4">No data yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Daily Visitors */}
        <div className="bg-[#141414] border border-[#27272A] rounded-lg p-4 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar size={24} className="text-[#34C759]" weight="duotone" />
            Daily Visitors (Last 30 Days)
          </h2>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {analytics?.daily?.slice().reverse().map((item, idx) => (
              <div key={idx} className="text-center p-2 bg-[#1C1C1E] rounded">
                <div className="text-xs text-[#71717A]">{item.date.slice(5)}</div>
                <div className="text-lg font-bold text-[#34C759]">{item.count}</div>
              </div>
            ))}
            {(!analytics?.daily || analytics.daily.length === 0) && (
              <p className="text-[#71717A] col-span-full text-center py-4">No data yet</p>
            )}
          </div>
        </div>

        {/* Recent Visitors */}
        <div className="bg-[#141414] border border-[#27272A] rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">Recent Visitors</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#27272A]">
                  <th className="p-2 text-[#A1A1AA] text-sm">Time</th>
                  <th className="p-2 text-[#A1A1AA] text-sm">Country</th>
                  <th className="p-2 text-[#A1A1AA] text-sm">City</th>
                  <th className="p-2 text-[#A1A1AA] text-sm">IP</th>
                </tr>
              </thead>
              <tbody>
                {analytics?.recent_visitors?.slice(0, 20).map((visitor, idx) => (
                  <tr key={idx} className="border-b border-[#27272A] hover:bg-[#1C1C1E]">
                    <td className="p-2 text-white text-sm font-mono">
                      {new Date(visitor.timestamp).toLocaleString()}
                    </td>
                    <td className="p-2 text-white">{visitor.country}</td>
                    <td className="p-2 text-[#A1A1AA]">{visitor.city}</td>
                    <td className="p-2 text-[#71717A] font-mono text-sm">{visitor.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!analytics?.recent_visitors || analytics.recent_visitors.length === 0) && (
              <p className="text-[#71717A] text-center py-4">No visitors yet</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default AdminDashboard;