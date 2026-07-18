import { useState } from 'react';
import {
  Search, MapPin, Users, Clock, CheckCircle, AlertTriangle,
  ArrowRight, Loader, RefreshCw, UserCheck, GitBranch, ShieldAlert, Network,
} from 'lucide-react';
import { getComplaintByNumber, type Neo4jComplaint } from '../lib/neo4j';
import type { Page } from '../types';
import { useLang } from '../lib/langContext';

interface TrackComplaintProps {
  onNavigate: (page: Page) => void;
}

const STATUS_STEPS = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

const STATUS_CONFIG = {
  PENDING: { labelKey: 'status_pending' as const, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500', icon: <Clock size={16} /> },
  ASSIGNED: { labelKey: 'status_assigned' as const, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500', icon: <UserCheck size={16} /> },
  IN_PROGRESS: { labelKey: 'status_in_progress' as const, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200', dot: 'bg-teal-500', icon: <RefreshCw size={16} /> },
  RESOLVED: { labelKey: 'status_resolved' as const, color: 'text-green-600', bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', icon: <CheckCircle size={16} /> },
  ESCALATED: { labelKey: 'status_escalated' as const, color: 'text-red-600', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', icon: <AlertTriangle size={16} /> },
};

const URGENCY_COLORS = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export default function TrackComplaint({ onNavigate }: TrackComplaintProps) {
  const { T } = useLang();
  const [query, setQuery] = useState('');
  const [complaint, setComplaint] = useState<Neo4jComplaint | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setNotFound(false);
    setComplaint(null);

    try {
      const data = await getComplaintByNumber(query.trim().toUpperCase());
      if (data) {
        setComplaint(data);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  }

  function getStepIndex(status: string) {
    if (status === 'ESCALATED') return -1;
    return STATUS_STEPS.indexOf(status);
  }

  function buildGraphLines(c: Neo4jComplaint): string[] {
    const lines: string[] = [
      `(:Citizen {${c.citizen_name}})-[:REPORTED]-> (:Complaint {${c.complaint_number}})`,
      `(:Complaint)-[:HAS_TYPE]->(:IssueType {${c.issue_type}})`,
      `(:Complaint)-[:LOCATED_AT]->(:Location {${c.area}, ${c.ward}})`,
      `(:Complaint)-[:ASSIGNED_TO]->(:Department {${c.department}})`,
      `(:Complaint)-[:HAS_STATUS]->(:Status {${c.status}})`,
    ];
    if (c.similar_count > 1) {
      lines.push(`(:Complaint)-[:SIMILAR_TO]->(${c.similar_count - 1} related complaints)`);
    }
    return lines;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <Network size={16} className="text-green-600" />
            <span className="text-xs font-bold text-green-600 uppercase tracking-widest">{T.track_powered}</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">{T.track_title}</h1>
          <p className="text-gray-500 text-lg">{T.track_subtitle}</p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-3">{T.track_number_label}</label>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={T.track_placeholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-all"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
              {T.track_search_btn}
            </button>
          </div>
        </div>

        {/* Not found */}
        {notFound && (
          <div className="bg-white rounded-2xl border border-red-100 p-10 text-center shadow-sm">
            <AlertTriangle size={40} className="text-red-400 mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 text-lg mb-2">{T.track_not_found_title}</h3>
            <p className="text-gray-500 text-sm mb-5">{T.track_not_found_msg} "{query}" {T.track_not_found_in}</p>
            <button
              onClick={() => onNavigate('submit')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-all"
            >
              {T.track_file_new} <ArrowRight size={14} />
            </button>
          </div>
        )}

        {complaint && (
          <div className="space-y-5">
            {/* Header card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400 font-mono">{complaint.complaint_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${URGENCY_COLORS[complaint.urgency]}`}>
                      {complaint.urgency}
                    </span>
                    {complaint.similar_count > 1 && (
                      <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                        <GitBranch size={10} /> {complaint.similar_count} {T.track_in_cluster}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{complaint.issue_type}</h2>
                  <p className="text-gray-500 mt-1 text-sm">{complaint.summary}</p>
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold ${STATUS_CONFIG[complaint.status].bg} ${STATUS_CONFIG[complaint.status].color}`}>
                  {STATUS_CONFIG[complaint.status].icon}
                  {T[STATUS_CONFIG[complaint.status].labelKey]}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-gray-50">
                <div>
                  <p className="text-xs text-gray-400 mb-1 font-medium">{T.track_citizen}</p>
                  <p className="text-sm font-semibold text-gray-900">{complaint.citizen_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1 font-medium">{T.track_location}</p>
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-1"><MapPin size={11} />{complaint.area}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1 font-medium">{T.track_ward}</p>
                  <p className="text-sm font-semibold text-gray-900">{complaint.ward}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1 font-medium">{T.track_department}</p>
                  <p className="text-sm font-semibold text-gray-900">{complaint.department}</p>
                </div>
              </div>
            </div>

            {/* Neo4j Graph Relationships */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
                  <Network size={18} className="text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{T.track_graph_title}</h3>
                  <p className="text-xs text-gray-400">{T.track_graph_desc}</p>
                </div>
              </div>
              <div className="bg-gray-950 rounded-xl p-5 font-mono text-sm space-y-2">
                {buildGraphLines(complaint).map((line, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-green-700 select-none text-xs pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-green-400 leading-relaxed break-all">{line}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Escalation */}
            {complaint.status === 'ESCALATED' && (
              <div className="bg-white rounded-2xl border border-red-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                    <ShieldAlert size={18} className="text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-700 text-sm">{T.track_escalation_title}</h3>
                    <p className="text-xs text-gray-400">{T.track_escalation_desc}</p>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">
                  {T.track_escalation_msg}
                </div>
              </div>
            )}

            {/* Status Timeline */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-6 text-lg">{T.track_timeline_title}</h3>
              {complaint.status === 'ESCALATED' ? (
                <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                    <AlertTriangle size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-red-700">{T.track_escalated_higher}</p>
                    <p className="text-sm text-red-600">{T.track_sla_breach}</p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-100"></div>
                  {STATUS_STEPS.map((step, i) => {
                    const stepIdx = getStepIndex(complaint.status);
                    const isCompleted = i <= stepIdx;
                    const isCurrent = i === stepIdx;
                    return (
                      <div key={step} className="relative flex items-start gap-4 pb-6 last:pb-0">
                        <div className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isCompleted ? 'border-orange-500 bg-orange-500' : 'border-gray-200 bg-white'
                        } ${isCurrent ? 'shadow-lg shadow-orange-100 scale-110' : ''}`}>
                          {isCompleted ? <CheckCircle size={16} className="text-white" /> : <span className="w-2 h-2 rounded-full bg-gray-200"></span>}
                        </div>
                        <div className={`pt-1.5 ${isCompleted ? 'opacity-100' : 'opacity-40'}`}>
                          <p className={`font-bold text-sm ${isCurrent ? 'text-orange-600' : isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                            {T[STATUS_CONFIG[step as keyof typeof STATUS_CONFIG]?.labelKey ?? 'status_pending']}
                          </p>
                          {isCurrent && <p className="text-xs text-gray-500 mt-0.5">{T.track_current_status}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cluster / Similar */}
            {complaint.similar_count > 1 && (
              <div className="bg-white rounded-2xl border border-indigo-100 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Users size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{T.track_cluster_title}</h3>
                    <p className="text-sm text-gray-500">{T.track_cluster_desc}</p>
                  </div>
                </div>
                <div className="bg-indigo-50 rounded-xl p-4 text-center">
                  <span className="text-5xl font-black text-indigo-600">{complaint.similar_count}</span>
                  <p className="text-sm text-indigo-700 font-medium mt-1">{T.track_citizens_reported}</p>
                  <p className="text-xs text-indigo-500 mt-1">{T.track_high_impact}</p>
                </div>
              </div>
            )}

            {/* Similar complaints from graph */}
            {complaint.similar_complaints && complaint.similar_complaints.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch size={16} className="text-green-600" />
                  <h3 className="font-bold text-gray-900 text-lg">{T.track_similar_title}</h3>
                </div>
                <div className="space-y-3">
                  {complaint.similar_complaints.map((s: Neo4jComplaint, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{s.issue_type} — {s.area}</p>
                        <p className="text-xs text-gray-400 font-mono">{s.complaint_number}</p>
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                        s.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                        s.status === 'ESCALATED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {s.status?.replace('_', ' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Original text */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">{T.track_original}</h3>
              <p className="text-gray-700 text-sm leading-relaxed italic">"{complaint.raw_text}"</p>
              <p className="text-xs text-gray-400 mt-3">
                {T.track_filed_on} {new Date(complaint.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                {complaint.language === 'hi' && <span className="ml-2 px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-xs">{T.track_hindi}</span>}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
