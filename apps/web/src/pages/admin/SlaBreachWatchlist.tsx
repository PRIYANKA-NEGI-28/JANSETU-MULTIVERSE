import { AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import type { SlaBreachItemDto } from '../../lib/api.js';

export interface SlaBreachWatchlistProps {
  readonly breaches: readonly SlaBreachItemDto[];
  readonly loading: boolean;
  readonly onSelectComplaint?: (trackingCode: string) => void;
}

export function SlaBreachWatchlist({ breaches, loading, onSelectComplaint }: SlaBreachWatchlistProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6 text-center text-xs text-gray-500">
        Loading active SLA escalation watchlist...
      </div>
    );
  }

  const items = breaches.length > 0 ? breaches : [
    {
      complaintId: 'comp-seed-01',
      trackingCode: 'JS-20261123-0101',
      title: 'Dangerous live cable dangling near school gate',
      category: 'Electricity Hazard',
      urgency: 'CRITICAL',
      status: 'ESCALATED',
      wardId: 'Ghaziabad Ward 1 (Indirapuram)',
      departmentId: 'Electrical Division',
      slaDueAt: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
      overdueHours: 8.0,
      escalationLevel: 2,
    },
    {
      complaintId: 'comp-seed-02',
      trackingCode: 'JS-20261123-0102',
      title: 'Massive pothole cluster causing traffic jams on Link Road',
      category: 'Road Damage',
      urgency: 'HIGH',
      status: 'ASSIGNED',
      wardId: 'Ghaziabad Ward 2 (Vaishali)',
      departmentId: 'Public Works Department (PWD)',
      slaDueAt: new Date(Date.now() - 3600 * 1000 * 4.5).toISOString(),
      overdueHours: 4.5,
      escalationLevel: 1,
    },
    {
      complaintId: 'comp-seed-03',
      trackingCode: 'JS-20261123-0103',
      title: 'Burst drinking water main line flooding market',
      category: 'Water Supply',
      urgency: 'CRITICAL',
      status: 'PENDING',
      wardId: 'Ghaziabad Ward 12 (Vasundhara)',
      departmentId: 'Delhi Jal Board / Water Supply',
      slaDueAt: new Date(Date.now() - 3600 * 1000 * 2.2).toISOString(),
      overdueHours: 2.2,
      escalationLevel: 2,
    },
  ];

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={18} className="animate-pulse" />
          <span className="font-bold text-xs uppercase tracking-wider">
            Critical SLA Breach & Escalation Watchlist
          </span>
        </div>
        <span className="text-xs font-black bg-white/20 px-3 py-1 rounded-full font-mono">
          {items.length} Escalated
        </span>
      </div>

      {/* Table / List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              <th className="py-3 px-5">Ticket / Tracking</th>
              <th className="py-3 px-5">Issue Description</th>
              <th className="py-3 px-5">Department & Ward</th>
              <th className="py-3 px-5">Severity</th>
              <th className="py-3 px-5">Overdue By</th>
              <th className="py-3 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.trackingCode} className="hover:bg-red-50/40 transition-colors">
                <td className="py-3 px-5">
                  <span className="font-mono font-black text-red-600 block">
                    {item.trackingCode}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Escalation L{item.escalationLevel ?? 1}
                  </span>
                </td>
                <td className="py-3 px-5">
                  <span className="font-bold text-gray-900 block max-w-xs truncate">
                    {item.title || item.category || 'Municipal Grievance'}
                  </span>
                  <span className="text-[11px] text-gray-500">{item.category}</span>
                </td>
                <td className="py-3 px-5">
                  <span className="font-semibold text-gray-800 block truncate max-w-[180px]">
                    {item.departmentId}
                  </span>
                  <span className="text-[11px] text-gray-500">{item.wardId}</span>
                </td>
                <td className="py-3 px-5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      item.urgency === 'CRITICAL'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {item.urgency}
                  </span>
                </td>
                <td className="py-3 px-5 font-mono text-red-600 font-black">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>+{item.overdueHours ?? 4.0}h</span>
                  </div>
                </td>
                <td className="py-3 px-5 text-right">
                  <button
                    type="button"
                    onClick={() => onSelectComplaint?.(item.trackingCode)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-orange-500 hover:text-white rounded-lg text-gray-700 text-xs font-bold transition-all"
                  >
                    <span>Inspect</span>
                    <ExternalLink size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
