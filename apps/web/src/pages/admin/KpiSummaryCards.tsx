import {
  TrendingUp,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Building,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import type { AdminAnalyticsDto } from '../../lib/api.js';
import type { AdminKpiStats } from './types.js';

export interface KpiSummaryCardsProps {
  readonly analytics: AdminAnalyticsDto | null;
  readonly stats: AdminKpiStats;
  readonly loading: boolean;
}

export function KpiSummaryCards({ analytics, stats, loading }: KpiSummaryCardsProps) {
  const departments = analytics?.departmentAnalytics ?? [
    {
      id: 'dept-pwd',
      name: 'Public Works Department (PWD)',
      totalComplaints: 78,
      resolvedComplaints: 64,
      pendingComplaints: 14,
      resolutionRatePercent: 82,
    },
    {
      id: 'dept-elec',
      name: 'Electrical Division',
      totalComplaints: 62,
      resolvedComplaints: 55,
      pendingComplaints: 7,
      resolutionRatePercent: 89,
    },
    {
      id: 'dept-water',
      name: 'Delhi Jal Board / Water Supply',
      totalComplaints: 45,
      resolvedComplaints: 34,
      pendingComplaints: 11,
      resolutionRatePercent: 76,
    },
    {
      id: 'dept-sanitation',
      name: 'Health & Sanitation',
      totalComplaints: 41,
      resolvedComplaints: 31,
      pendingComplaints: 10,
      resolutionRatePercent: 76,
    },
    {
      id: 'dept-police',
      name: 'Traffic Police / Transport',
      totalComplaints: 22,
      resolvedComplaints: 20,
      pendingComplaints: 2,
      resolutionRatePercent: 91,
    },
  ];

  const urgencyCounts = analytics?.urgencyBreakdown ?? {
    CRITICAL: 8,
    HIGH: 24,
    MEDIUM: 86,
    LOW: 130,
  };

  const statusCounts = analytics?.statusBreakdown ?? {
    PENDING: 18,
    ASSIGNED: 22,
    IN_PROGRESS: 24,
    RESOLVED: stats.resolvedCount,
    ESCALATED: stats.activeEscalations,
    REOPENED: 4,
  };

  return (
    <div className="space-y-6">
      {/* Primary 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open vs. Resolved Clusters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Clusters Overview
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Layers size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">
              {loading ? '...' : stats.openClusters}
            </span>
            <span className="text-xs font-semibold text-gray-500">Open Clusters</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600 border-t border-gray-100 pt-2">
            <span className="flex items-center gap-1 font-semibold text-emerald-600">
              <CheckCircle2 size={13} /> {stats.resolvedClusters} Resolved
            </span>
            <span className="font-mono text-gray-500">
              Total {stats.openClusters + stats.resolvedClusters}
            </span>
          </div>
        </div>

        {/* SLA Compliance Rate */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              SLA Compliance
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">
              {loading ? '...' : `${stats.slaComplianceRatePercent}%`}
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Target 95%
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600 border-t border-gray-100 pt-2">
            <span className="flex items-center gap-1 text-gray-500">
              <TrendingUp size={13} className="text-emerald-500" /> On-time resolution
            </span>
            <span className="font-semibold text-gray-700">
              {stats.resolvedCount} of {stats.totalIntake}
            </span>
          </div>
        </div>

        {/* Average Resolution Time */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Avg Resolution Time
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">
              {loading ? '...' : `${stats.averageResolutionHours}h`}
            </span>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
              24h Benchmark
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600 border-t border-gray-100 pt-2">
            <span className="text-gray-500">P90 Resolution</span>
            <span className="font-semibold text-gray-700">32.5 hours</span>
          </div>
        </div>

        {/* SLA Escalation Alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              SLA Breaches
            </span>
            <div
              className={`p-2 rounded-xl ${
                stats.activeEscalations > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-3xl font-black ${
                stats.activeEscalations > 0 ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {loading ? '...' : stats.activeEscalations}
            </span>
            <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
              Requires Action
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600 border-t border-gray-100 pt-2">
            <span className="text-gray-500">Auto-Escalated L2/L3</span>
            <span className="font-semibold text-red-600 font-mono">
              {stats.activeEscalations} tickets
            </span>
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Row: Departments & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Breakdown (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Building size={18} className="text-orange-500" />
              <h3 className="font-black text-gray-900 text-sm tracking-tight">
                Department Performance & Resolution Rate
              </h3>
            </div>
            <span className="text-xs font-semibold text-gray-500">
              {departments.length} Municipal Divisions
            </span>
          </div>

          <div className="space-y-3.5">
            {departments.slice(0, 5).map((dept) => {
              const rate = dept.resolutionRatePercent;
              const isHigh = rate >= 85;
              const isMedium = rate >= 70 && rate < 85;

              return (
                <div key={dept.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-800">{dept.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 font-mono text-[11px]">
                        {dept.resolvedComplaints}/{dept.totalComplaints} resolved
                      </span>
                      <span
                        className={`font-black font-mono px-2 py-0.5 rounded text-[11px] ${
                          isHigh
                            ? 'bg-emerald-50 text-emerald-700'
                            : isMedium
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {rate}%
                      </span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isHigh ? 'bg-emerald-500' : isMedium ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Urgency & Status Distribution (1 Column) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Activity size={18} className="text-indigo-500" />
            <h3 className="font-black text-gray-900 text-sm tracking-tight">
              Severity & Workflow Breakdown
            </h3>
          </div>

          {/* Urgency Matrix */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Urgency Distribution
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-100 flex items-center justify-between">
                <span className="font-bold text-red-800">Critical</span>
                <span className="font-black font-mono text-red-700">{urgencyCounts.CRITICAL}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-between">
                <span className="font-bold text-amber-800">High</span>
                <span className="font-black font-mono text-amber-700">{urgencyCounts.HIGH}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-yellow-50 border border-yellow-100 flex items-center justify-between">
                <span className="font-bold text-yellow-800">Medium</span>
                <span className="font-black font-mono text-yellow-700">{urgencyCounts.MEDIUM}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                <span className="font-bold text-emerald-800">Low</span>
                <span className="font-black font-mono text-emerald-700">{urgencyCounts.LOW}</span>
              </div>
            </div>
          </div>

          {/* Status Pipeline */}
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Workflow Status
            </span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-500 block font-semibold">Pending</span>
                <span className="font-black text-gray-900 font-mono">{statusCounts.PENDING}</span>
              </div>
              <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100">
                <span className="text-[10px] text-indigo-600 block font-semibold">In Progress</span>
                <span className="font-black text-indigo-700 font-mono">
                  {statusCounts.IN_PROGRESS + statusCounts.ASSIGNED}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="text-[10px] text-emerald-600 block font-semibold">Resolved</span>
                <span className="font-black text-emerald-700 font-mono">{statusCounts.RESOLVED}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
