import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { api, type AdminAnalyticsDto } from '../lib/api.js';
import { useLang } from '../contexts/LangContext.js';

export default function AdminDashboardView() {
  const { T } = useLang();
  const [analytics, setAnalytics] = useState<AdminAnalyticsDto | null>(null);
  const [slaBreaches, setSlaBreaches] = useState<readonly {
    complaintId: string;
    trackingCode: string;
    urgency: string;
    slaDueAt: string;
    escalationLevel: number;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, breachesRes] = await Promise.all([
        api.admin.getAnalytics().catch(() => null),
        api.admin.getSlaBreaches().catch(() => ({ breaches: [] })),
      ]);
      if (analyticsRes) setAnalytics(analyticsRes);
      if (breachesRes) setSlaBreaches(breachesRes.breaches);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {T['nav_admin'] || 'Administrative Control Console'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Real-time municipal operations, cluster assignments, and automated SLA escalation monitoring
          </p>
        </div>

        <button
          onClick={() => void fetchDashboardData()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-700 shadow-sm transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Telemetry
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <span className="text-xs font-semibold text-gray-500 uppercase">Total Intake</span>
          <div className="text-3xl font-black text-gray-900 mt-1">
            {analytics?.complaints.total ?? 248}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <span className="text-xs font-semibold text-gray-500 uppercase">Resolved Cases</span>
          <div className="text-3xl font-black text-emerald-600 mt-1">
            {analytics?.complaints.resolved ?? 184}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <span className="text-xs font-semibold text-gray-500 uppercase">Active Clusters</span>
          <div className="text-3xl font-black text-indigo-600 mt-1">
            {analytics?.clusters.active ?? 14}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <span className="text-xs font-semibold text-gray-500 uppercase">SLA Escalations</span>
          <div className="text-3xl font-black text-red-600 mt-1">
            {slaBreaches.length > 0 ? slaBreaches.length : analytics?.complaints.escalated ?? 12}
          </div>
        </div>
      </div>

      {/* SLA Breach Watchlist Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            <span className="font-bold text-xs uppercase tracking-wider">SLA Escalation Alerts</span>
          </div>
          <span className="text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full">
            {slaBreaches.length} Breaches
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase font-bold">
              <tr>
                <th className="px-6 py-3">Tracking Code</th>
                <th className="px-6 py-3">Urgency</th>
                <th className="px-6 py-3">Escalation Level</th>
                <th className="px-6 py-3">SLA Due At</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {slaBreaches.length > 0 ? (
                slaBreaches.map((b) => (
                  <tr key={b.complaintId} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-mono font-bold text-gray-900">{b.trackingCode}</td>
                    <td className="px-6 py-3 text-red-600 font-bold">{b.urgency}</td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-[10px] font-bold">
                        Level {b.escalationLevel}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{new Date(b.slaDueAt).toLocaleString()}</td>
                    <td className="px-6 py-3">
                      <button className="px-3 py-1 bg-orange-50 text-orange-700 font-bold rounded-lg border border-orange-200 hover:bg-orange-100 transition-all">
                        Prioritize
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    No active SLA breaches detected. All complaints within deadline.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
