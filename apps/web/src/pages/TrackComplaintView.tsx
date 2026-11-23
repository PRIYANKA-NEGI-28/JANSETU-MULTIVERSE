import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Shield,
  CheckCircle,
  AlertTriangle,
  Copy,
  RefreshCw,
  Radio,
} from 'lucide-react';
import {
  api,
  type ComplaintDto,
  type ClusterTimelineEventDto,
} from '../lib/api.js';
import { useLang } from '../contexts/LangContext.js';
import { useAblySubscription, type AblyUpdateEvent } from '../hooks/useAblySubscription.js';
import { ComplaintCardSkeleton, TimelineSkeleton } from '../components/ui/Skeletons.js';

export default function TrackComplaintView() {
  const { T } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const [activeTab, setActiveTab] = useState<'search' | 'my_complaints'>(
    initialCode ? 'search' : 'search'
  );
  const [trackingCode, setTrackingCode] = useState(initialCode);
  const [complaint, setComplaint] = useState<ComplaintDto | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<readonly ClusterTimelineEventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [liveBanner, setLiveBanner] = useState<string | null>(null);

  // User's complaints list
  const [myComplaints, setMyComplaints] = useState<readonly ComplaintDto[]>([]);
  const [myComplaintsLoading, setMyComplaintsLoading] = useState(false);

  // Handle Ably live updates
  const handleRealtimeUpdate = useCallback((event: AblyUpdateEvent) => {
    setLiveBanner(`Live Update Received: ${event.name} at ${new Date(event.timestamp).toLocaleTimeString()}`);
    // Refresh current complaint data
    if (event.data?.status && typeof event.data.status === 'string') {
      setComplaint((prev) =>
        prev ? { ...prev, status: event.data.status as ComplaintDto['status'] } : null
      );
    }
  }, []);

  // Hook up Ably WebSocket channel for the current tracking code
  const { isConnected } = useAblySubscription({
    trackingCode: complaint?.trackingCode,
    onUpdate: handleRealtimeUpdate,
    enabled: Boolean(complaint?.trackingCode),
  });

  // Search single complaint
  const handleSearch = useCallback(
    async (codeToSearch: string) => {
      if (!codeToSearch.trim()) return;
      setLoading(true);
      setError(null);
      setLiveBanner(null);

      try {
        const res = await api.complaints.getByTrackingCode(codeToSearch.trim());
        setComplaint(res);
        setSearchParams({ code: codeToSearch.trim() });

        // Load timeline if clusterId exists
        if (res.clusterId) {
          setTimelineLoading(true);
          try {
            const tl = await api.clusters.getTimeline(res.clusterId);
            setTimelineEvents(tl.events || []);
          } catch {
            setTimelineEvents([]);
          } finally {
            setTimelineLoading(false);
          }
        } else {
          setTimelineEvents([]);
        }
      } catch {
        setComplaint(null);
        setTimelineEvents([]);
        setError(`Complaint with tracking code '${codeToSearch}' not found. Please verify and retry.`);
      } finally {
        setLoading(false);
      }
    },
    [setSearchParams]
  );

  // Fetch citizen's complaints when tab switched to 'my_complaints'
  const loadMyComplaints = useCallback(async () => {
    setMyComplaintsLoading(true);
    try {
      const res = await api.complaints.list({ limit: 50 });
      setMyComplaints(res.complaints);
    } catch {
      // Fallback
      setMyComplaints([]);
    } finally {
      setMyComplaintsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCode) {
      void handleSearch(initialCode);
    }
  }, [initialCode, handleSearch]);

  useEffect(() => {
    if (activeTab === 'my_complaints') {
      void loadMyComplaints();
    }
  }, [activeTab, loadMyComplaints]);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stages = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];
  const getStageIndex = (status: string) => {
    if (status === 'RESOLVED') return 3;
    if (status === 'IN_PROGRESS') return 2;
    if (status === 'ASSIGNED') return 1;
    return 0;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {T['nav_track'] || 'Track Civic Grievance'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Real-time status tracking, SLA timer progression, and live Ably WebSocket event stream
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'search'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Search by Code
          </button>
          <button
            onClick={() => setActiveTab('my_complaints')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'my_complaints'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            My Grievances
          </button>
        </div>
      </div>

      {/* Tab 1: Search Form */}
      {activeTab === 'search' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Enter Tracking Code (e.g. JS-2026-IND-001)"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch(trackingCode)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              aria-label="Complaint Tracking Code"
            />
          </div>
          <button
            onClick={() => void handleSearch(trackingCode)}
            disabled={loading || !trackingCode.trim()}
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-orange-500/20 shrink-0 flex items-center gap-1.5"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
            <span>Track</span>
          </button>
        </div>
      )}

      {/* Tab 2: User's Grievance Feed */}
      {activeTab === 'my_complaints' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs text-gray-500 font-semibold px-1">
            <span>Complaints linked to your profile</span>
            <button
              onClick={() => void loadMyComplaints()}
              className="text-orange-600 hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw size={12} className={myComplaintsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {myComplaintsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ComplaintCardSkeleton />
              <ComplaintCardSkeleton />
            </div>
          ) : myComplaints.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myComplaints.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveTab('search');
                    setTrackingCode(c.trackingCode);
                    void handleSearch(c.trackingCode);
                  }}
                  className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs hover:border-orange-300 hover:shadow-md cursor-pointer transition-all space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-orange-600 text-xs">
                      {c.trackingCode}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        c.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'ESCALATED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 font-medium line-clamp-2">
                    {c.description || c.title || 'Civic Grievance'}
                  </p>
                  <div className="text-[11px] text-gray-400 flex justify-between pt-1 border-t border-gray-100">
                    <span>{c.category}</span>
                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
              No filed grievances found for your account. Use the File tab to submit a new issue.
            </div>
          )}
        </div>
      )}

      {/* Error Banner with Optimistic Retry */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs sm:text-sm flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => void handleSearch(trackingCode)}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-lg text-xs transition-all shrink-0 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xl">
          <ComplaintCardSkeleton />
        </div>
      )}

      {/* Complaint Detail Card & Live Ably WebSocket Timeline */}
      {complaint && !loading && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden animate-fade-up space-y-6">
          {/* Saffron Card Header */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 text-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield size={18} />
              <span className="font-bold text-xs uppercase tracking-wider">
                Ref: <span className="font-mono font-black">{complaint.trackingCode}</span>
              </span>
              <button
                onClick={() => handleCopy(complaint.trackingCode)}
                className="p-1 rounded-md bg-white/20 hover:bg-white/30 text-white transition-all ml-1"
                title="Copy Tracking Code"
              >
                {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
              </button>
            </div>

            {/* Live Ably WebSocket Status Pill */}
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isConnected ? 'bg-emerald-500/20 text-emerald-100' : 'bg-black/20 text-white/70'
                }`}
                title={isConnected ? 'Subscribed to real-time Ably WebSocket updates' : 'Offline stream'}
              >
                <Radio size={12} className={isConnected ? 'animate-pulse text-emerald-300' : ''} />
                <span>{isConnected ? 'Ably Live Stream Active' : 'Polling'}</span>
              </div>

              <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-white text-orange-700 shadow-xs">
                {complaint.status}
              </span>
            </div>
          </div>

          {/* Real-time Notification Banner */}
          {liveBanner && (
            <div className="mx-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2 animate-bounce">
              <Radio size={14} className="text-amber-600" />
              <span>{liveBanner}</span>
            </div>
          )}

          <div className="px-6 sm:px-8 space-y-6">
            {/* Resolution Lifecycle Stepper */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-3">
                Lifecycle Progression
              </span>
              <div className="grid grid-cols-4 gap-2">
                {stages.map((st, idx) => {
                  const currentIdx = getStageIndex(complaint.status);
                  const isDone = idx <= currentIdx;
                  const isCurrent = idx === currentIdx;

                  return (
                    <div key={st} className="text-center">
                      <div
                        className={`h-2.5 rounded-full mb-2 transition-all duration-500 ${
                          isDone ? 'bg-emerald-500' : 'bg-gray-200'
                        }`}
                      />
                      <span
                        className={`text-[10px] font-bold uppercase block truncate ${
                          isCurrent
                            ? 'text-orange-600 font-extrabold'
                            : isDone
                              ? 'text-emerald-700'
                              : 'text-gray-400'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Narrative & Details Grid */}
            <div className="bg-gray-50/80 rounded-2xl border border-gray-200 p-5 space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                  Citizen Narrative (विवरण)
                </span>
                <p className="text-sm font-medium text-gray-900 leading-relaxed">
                  {complaint.description}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-gray-200/80 text-xs">
                <div>
                  <span className="text-gray-500 font-semibold block">Department</span>
                  <span className="font-bold text-gray-900">
                    {complaint.departmentCode || complaint.departmentId || 'PWD'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block">Issue Category</span>
                  <span className="font-bold text-gray-900">{complaint.category}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block">Urgency</span>
                  <span
                    className={`font-black ${
                      complaint.urgency === 'CRITICAL'
                        ? 'text-red-600'
                        : complaint.urgency === 'HIGH'
                          ? 'text-orange-600'
                          : 'text-gray-800'
                    }`}
                  >
                    {complaint.urgency}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block">SLA Resolution Target</span>
                  <span className="font-bold text-gray-900">
                    {new Date(complaint.slaDueAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Photo Evidence if present */}
              {complaint.photoUrl && (
                <div className="pt-3 border-t border-gray-200">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                    Photographic Evidence
                  </span>
                  <div className="w-40 h-32 rounded-xl overflow-hidden border border-gray-200 shadow-xs">
                    <img
                      src={complaint.photoUrl}
                      alt="Complaint attachment"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Full Audit Timeline */}
            <div className="pb-8 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                  Municipal Audit Trail & Event Timeline
                </span>
                <span className="text-[11px] text-gray-500 font-semibold">
                  {timelineEvents.length} Verified Events
                </span>
              </div>

              {timelineLoading ? (
                <TimelineSkeleton />
              ) : timelineEvents.length > 0 ? (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-gray-200">
                  {timelineEvents.map((ev, i) => (
                    <div key={ev.id || i} className="relative flex items-start gap-3 pl-1">
                      <div className="w-6 h-6 rounded-full bg-orange-100 border-2 border-orange-500 text-orange-600 flex items-center justify-center font-bold text-[10px] shrink-0 z-10">
                        {i + 1}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs space-y-1">
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-gray-900 uppercase tracking-wider">{ev.eventType}</span>
                          <span className="text-[10px] text-gray-500 font-normal">
                            {new Date(ev.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {ev.actorId && (
                          <div className="text-[11px] text-gray-500">
                            Actor: <span className="font-semibold text-gray-700">{ev.actorId}</span>
                          </div>
                        )}
                        {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                          <div className="text-[11px] text-gray-600 font-mono bg-white p-2 rounded-lg border border-gray-200">
                            {JSON.stringify(ev.metadata)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center text-xs text-gray-500">
                  Complaint registered. AI triage worker is assessing severity and cluster assignments.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
