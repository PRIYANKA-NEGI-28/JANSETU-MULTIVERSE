import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Shield, AlertTriangle, Loader } from 'lucide-react';
import { api, type ComplaintDto } from '../lib/api.js';
import { useLang } from '../contexts/LangContext.js';

export default function TrackComplaintView() {
  const { T } = useLang();
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const [trackingCode, setTrackingCode] = useState(initialCode);
  const [complaint, setComplaint] = useState<ComplaintDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (codeToSearch: string) => {
    if (!codeToSearch.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await api.complaints.getByTrackingCode(codeToSearch.trim());
      setComplaint(res);
    } catch {
      setComplaint(null);
      setError('Complaint not found. Please verify the tracking number and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      void handleSearch(initialCode);
    }
  }, [initialCode]);

  const stages = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

  const getStageIndex = (status: string) => {
    if (status === 'RESOLVED') return 3;
    if (status === 'IN_PROGRESS') return 2;
    if (status === 'ASSIGNED') return 1;
    return 0;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          {T['nav_track'] || 'Track Complaint Status'}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Enter your reference tracking code to view live resolution progress, SLA timers, and officer assignment
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="e.g. JS-2026-IND-001"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSearch(trackingCode)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
        <button
          onClick={() => void handleSearch(trackingCode)}
          disabled={loading || !trackingCode.trim()}
          className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-orange-500/20 shrink-0 flex items-center gap-1.5"
        >
          {loading ? <Loader size={16} className="animate-spin" /> : 'Search'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle size={18} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {complaint && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden animate-fade-up">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={18} />
              <span className="font-bold text-xs uppercase tracking-wider">Tracking Code: {complaint.trackingCode}</span>
            </div>
            <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full uppercase">
              {complaint.status}
            </span>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Status Progression Stepper */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Resolution Lifecycle</h3>
              <div className="grid grid-cols-4 gap-2">
                {stages.map((st, idx) => {
                  const currentIdx = getStageIndex(complaint.status);
                  const isDone = idx <= currentIdx;
                  const isCurrent = idx === currentIdx;

                  return (
                    <div key={st} className="text-center">
                      <div
                        className={`h-2 rounded-full mb-2 transition-all ${
                          isDone ? 'bg-emerald-500' : 'bg-gray-200'
                        }`}
                      />
                      <span
                        className={`text-[10px] font-bold uppercase block truncate ${
                          isCurrent ? 'text-orange-600' : isDone ? 'text-emerald-700' : 'text-gray-400'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Complaint details */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 space-y-3">
              <div>
                <span className="text-xs text-gray-500 font-semibold uppercase">Description</span>
                <p className="text-sm font-medium text-gray-900 mt-1">{complaint.description}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div>
                  <span className="text-gray-500 font-semibold block">Department</span>
                  <span className="font-bold text-gray-800">{complaint.departmentCode}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block">Urgency</span>
                  <span className="font-bold text-orange-600">{complaint.urgency}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block">Target SLA Deadline</span>
                  <span className="font-bold text-gray-800">
                    {new Date(complaint.slaDueAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
