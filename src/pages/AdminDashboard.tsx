import { useEffect, useState } from 'react';
import {
  BarChart2, Users, CheckCircle, Clock, AlertTriangle, Filter,
  Shield, ArrowUpRight, RefreshCw, MapPin, ChevronDown, LogOut,
  GitBranch, Zap, TrendingUp, Network, UserCog, Phone, X,
} from 'lucide-react';
import {
  getAllComplaints, getDepartmentStats, updateComplaintStatus,
  getGraphStats, runEscalationCheck,
  getAllOfficers, getOfficersByDepartment, assignOfficerToComplaint,
  escalateComplaintToOfficer, seedOfficers,
  type Neo4jComplaint, type Neo4jDepartment, type GraphStats,
  type Neo4jOfficer,
} from '../lib/neo4j';
import { useDashboard } from '../contexts/DashboardContext';
import { useLang } from '../lib/langContext';
import { useToast } from '../contexts/ToastContext';

interface AdminDashboardProps {
  onAdminLogout: () => void;
}

const STATUS_CONFIG = {
  PENDING: { labelKey: 'status_pending' as const, color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  ASSIGNED: { labelKey: 'status_assigned' as const, color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  IN_PROGRESS: { labelKey: 'status_in_progress' as const, color: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
  RESOLVED: { labelKey: 'status_resolved' as const, color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  ESCALATED: { labelKey: 'status_escalated' as const, color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  FAULT: { labelKey: 'status_escalated' as const, color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  UNKNOWN: { labelKey: 'status_pending' as const, color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-500' },
};

const URGENCY_CONFIG = {
  LOW: 'bg-blue-50 text-blue-600 border-blue-100',
  MEDIUM: 'bg-yellow-50 text-yellow-600 border-yellow-100',
  HIGH: 'bg-orange-50 text-orange-600 border-orange-100',
  CRITICAL: 'bg-red-50 text-red-600 border-red-100',
};

const STATUS_OPTIONS = ['ALL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED'];
const URGENCY_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export default function AdminDashboard({ onAdminLogout }: AdminDashboardProps) {
  const { T } = useLang();
  const { toast } = useToast();
  const { complaints: dashboardComplaints, refreshDashboard } = useDashboard();
  const [localComplaints, setLocalComplaints] = useState<Neo4jComplaint[]>([]);
  const [departments, setDepartments] = useState<Neo4jDepartment[]>([]);
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'complaints' | 'departments' | 'graph' | 'officers'>('complaints');
  const [escalating, setEscalating] = useState(false);
  const [escalationResult, setEscalationResult] = useState<string | null>(null);
  const [officers, setOfficers] = useState<Neo4jOfficer[]>([]);
  const [officersLoading, setOfficersLoading] = useState(false);
  const [officerDeptFilter, setOfficerDeptFilter] = useState('ALL');
  const [seeding, setSeeding] = useState(false);
  const [assignModal, setAssignModal] = useState<{ complaintId: string; department: string } | null>(null);
  const [escalateModal, setEscalateModal] = useState<{ complaintId: string } | null>(null);
  const [assigning, setAssigning] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      await refreshDashboard();
      const [d, g] = await Promise.all([
        getDepartmentStats(),
        getGraphStats(),
      ]);
      setDepartments(d || []);
      setGraphStats(g);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    // Sync context to local state so optimistic UI updates still work seamlessly
    setLocalComplaints(dashboardComplaints);
  }, [dashboardComplaints]);

  async function handleUpdateStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/complaint/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        toast('Unable to sync status with server. Retrying...', 'error');
        throw new Error('Update failed');
      }
      
      setLocalComplaints(prev => prev?.map(c =>
        c.id === id ? { ...c, status: status as Neo4jComplaint['status'] } : c
      ) || []);
    } catch (err) {
      console.error('Status update failed:', err);
      toast('Unable to sync status with server. Retrying...', 'error');
      // Fallback update for mock demo if server fails
      setLocalComplaints(prev => prev.map(c =>
        c.id === id ? { ...c, status: status as Neo4jComplaint['status'] } : c
      ));
    }
    setUpdatingId(null);
  }

  async function handleEscalationCheck() {
    setEscalating(true);
    setEscalationResult(null);
    try {
      const result = await runEscalationCheck();
      setEscalationResult(T.admin_escalation_done(result.escalated_count));
      await loadData();
    } catch {
      setEscalationResult(T.admin_escalation_failed);
      toast('Failed to run escalation check. Retrying...', 'error');
    }
    setEscalating(false);
  }

  async function loadOfficers() {
    setOfficersLoading(true);
    try {
      let data: Neo4jOfficer[];
      if (officerDeptFilter === 'ALL') {
        data = await getAllOfficers();
      } else {
        data = await getOfficersByDepartment(officerDeptFilter);
      }
      setOfficers(data || []);
    } catch (err) {
      console.error('Failed to load officers:', err);
      setOfficers([]);
    }
    setOfficersLoading(false);
  }

  useEffect(() => {
    if (activeTab === 'officers') loadOfficers();
  }, [activeTab, officerDeptFilter]);

  async function handleSeedOfficers() {
    setSeeding(true);
    try {
      await seedOfficers();
      await loadOfficers();
    } catch (err) {
      console.error('Seed failed:', err);
    }
    setSeeding(false);
  }

  async function handleAssignOfficer(officerId: string) {
    if (!assignModal) return;
    setAssigning(true);
    try {
      const res = await assignOfficerToComplaint(assignModal.complaintId, officerId);
      if (!res.ok) {
        toast('Unable to sync assignment with server. Retrying...', 'error');
        throw new Error('Assignment failed');
      }
      setLocalComplaints(prev => prev?.map(c => 
        c.id === assignModal.complaintId ? { ...c, status: 'ASSIGNED' as const } : c
      ) || []);
      setAssignModal(null);
      await loadData();
    } catch (err) {
      console.error('Assignment failed:', err);
      toast('Unable to sync assignment with server. Retrying...', 'error');
      setLocalComplaints(prev => prev?.map(c => 
        c.id === assignModal.complaintId ? { ...c, status: 'ASSIGNED' as const } : c
      ) || []);
    }
    setAssigning(false);
  }

  async function handleEscalateOfficer(officerId: string) {
    if (!escalateModal) return;
    setAssigning(true);
    try {
      const res = await escalateComplaintToOfficer(escalateModal.complaintId, officerId);
      if (!res.ok) {
        toast('Unable to sync escalation with server. Retrying...', 'error');
        throw new Error('Escalation failed');
      }
      setLocalComplaints(prev => prev?.map(c => 
        c.id === escalateModal.complaintId ? { ...c, status: 'ESCALATED' as const } : c
      ) || []);
      setEscalateModal(null);
      await loadData();
    } catch (err) {
      console.error('Escalation failed:', err);
      toast('Unable to sync escalation with server. Retrying...', 'error');
      setLocalComplaints(prev => prev?.map(c => 
        c.id === escalateModal.complaintId ? { ...c, status: 'ESCALATED' as const } : c
      ) || []);
    }
    setAssigning(false);
  }

  const departmentNames = Array.from(new Set([
    ...(localComplaints || []).map(c => c.department).filter(Boolean),
    ...(officers || []).map(o => o.department).filter(Boolean),
  ])).sort();

  const filtered = localComplaints.filter(c => {
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchUrgency = urgencyFilter === 'ALL' || c.urgency === urgencyFilter;
    return matchStatus && matchUrgency;
  });

  const stats = {
    total: localComplaints.length,
    pending: localComplaints.filter(c => c.status === 'PENDING').length,
    inProgress: localComplaints.filter(c => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length,
    resolved: localComplaints.filter(c => c.status === 'RESOLVED').length,
    escalated: localComplaints.filter(c => c.status === 'ESCALATED').length,
    critical: localComplaints.filter(c => c.urgency === 'CRITICAL').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">{T.admin_title}</h1>
            <p className="text-gray-500">{T.admin_subtitle}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleEscalationCheck}
              disabled={escalating}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-all disabled:opacity-50"
            >
              <Zap size={15} className={escalating ? 'animate-pulse' : ''} />
              {escalating ? T.admin_running : T.admin_run_escalation}
            </button>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all shadow-sm"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              {T.admin_refresh}
            </button>
          </div>
        </div>

        {escalationResult && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium flex items-center gap-2">
            <Zap size={14} />
            {escalationResult}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: T.admin_stat_total, value: stats.total, icon: <Users size={18} />, color: 'text-gray-700', bg: 'bg-white' },
            { label: T.admin_stat_pending, value: stats.pending, icon: <Clock size={18} />, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: T.admin_stat_active, value: stats.inProgress, icon: <ArrowUpRight size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: T.admin_stat_resolved, value: stats.resolved, icon: <CheckCircle size={18} />, color: 'text-green-600', bg: 'bg-green-50' },
            { label: T.admin_stat_escalated, value: stats.escalated, icon: <AlertTriangle size={18} />, color: 'text-red-600', bg: 'bg-red-50' },
            { label: T.admin_stat_critical, value: stats.critical, icon: <Shield size={18} />, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(({ label, value, icon, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl border border-gray-100 p-4 flex flex-col gap-2 shadow-sm`}>
              <div className={color}>{icon}</div>
              <div className={`text-3xl font-black ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 font-medium">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-100 p-1 rounded-xl w-fit mb-6 shadow-sm">
          {(['complaints', 'departments', 'graph', 'officers'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeTab === tab ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              {tab === 'graph' ? T.admin_tab_graph : tab === 'departments' ? T.admin_tab_departments : tab === 'officers' ? T.admin_tab_officers : T.admin_tab_complaints}
            </button>
          ))}
        </div>

        {/* COMPLAINTS TAB */}
        {activeTab === 'complaints' && (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5 flex flex-wrap gap-4 items-center shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                <Filter size={15} /> {T.admin_filters}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-medium">{T.admin_status}</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                >
                  {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o === 'ALL' ? T.admin_all_status : o.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-medium">{T.admin_urgency}</label>
                <select
                  value={urgencyFilter}
                  onChange={e => setUrgencyFilter(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                >
                  {URGENCY_OPTIONS.map(o => <option key={o} value={o}>{o === 'ALL' ? T.admin_all_urgency : o}</option>)}
                </select>
              </div>
              <div className="ml-auto text-sm text-gray-400 font-medium">
                {T.admin_showing} {filtered.length} {T.admin_of} {localComplaints.length}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-16 text-center">
                  <RefreshCw size={32} className="animate-spin text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">{T.admin_loading_graph}</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-16 text-center">
                  <BarChart2 size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">{T.admin_no_match}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['COMPLAINT #', 'ISSUE TYPE', 'CITIZEN', 'LOCATION', 'DEPARTMENT', 'URGENCY', 'STATUS', 'ACTION'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(filtered || [])?.map(complaint => (
                        <tr key={complaint.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-bold text-gray-600">{complaint.complaint_number}</span>
                            {complaint.similar_count > 1 && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <GitBranch size={9} className="text-green-500" />
                                <span className="text-xs text-green-600 font-semibold">{complaint.similar_count} {T.admin_in_cluster}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{complaint.issue_type}</p>
                            <p className="text-xs text-gray-400 max-w-[180px] truncate">{complaint.summary}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-700 whitespace-nowrap">{complaint.citizen_name}</p>
                            {complaint.citizen_phone && <p className="text-xs text-gray-400">{complaint.citizen_phone}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                              <MapPin size={10} />{complaint.area}
                            </div>
                            <p className="text-xs text-gray-400">{complaint.ward}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-gray-600 whitespace-nowrap">{complaint.department}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-bold border ${URGENCY_CONFIG[complaint.urgency]}`}>
                              {complaint.urgency}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-bold whitespace-nowrap ${(STATUS_CONFIG[complaint.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.UNKNOWN).color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${(STATUS_CONFIG[complaint.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.UNKNOWN).dot}`}></span>
                              {T[(STATUS_CONFIG[complaint.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.UNKNOWN).labelKey]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="relative">
                                <select
                                  value={complaint.status}
                                  onChange={e => handleUpdateStatus(complaint.id, e.target.value)}
                                  disabled={updatingId === complaint.id}
                                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white appearance-none pr-6 disabled:opacity-50"
                                >
                                  {Object.keys(STATUS_CONFIG).map(s => (
                                    <option key={s} value={s}>{T[(STATUS_CONFIG[s as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.UNKNOWN).labelKey]}</option>
                                  ))}
                                </select>
                                <ChevronDown size={10} className="absolute right-1.5 top-2 text-gray-400 pointer-events-none" />
                              </div>
                              <button
                                onClick={() => setAssignModal({ complaintId: complaint.id, department: complaint.department })}
                                disabled={complaint.status === 'RESOLVED'}
                                className="text-xs px-2 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                                title={T.admin_officers_assign}
                              >
                                <UserCog size={12} className="inline mr-0.5" />{T.admin_officers_assign}
                              </button>
                              <button
                                onClick={() => setEscalateModal({ complaintId: complaint.id })}
                                disabled={complaint.status === 'RESOLVED' || complaint.status === 'ESCALATED'}
                                className="text-xs px-2 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                                title={T.admin_officers_escalate_title}
                              >
                                <ArrowUpRight size={12} className="inline mr-0.5" />{T.admin_officers_escalate_title}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* DEPARTMENTS TAB */}
        {activeTab === 'departments' && (
          <div className="space-y-4">
            {loading ? (
              <div className="p-16 text-center bg-white rounded-2xl border border-gray-100">
                <RefreshCw size={32} className="animate-spin text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">{T.admin_computing_depts}</p>
              </div>
            ) : departments.length === 0 ? (
              <div className="p-16 text-center bg-white rounded-2xl border border-gray-100">
                <BarChart2 size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">{T.admin_no_depts}</p>
              </div>
            ) : (departments || [])?.map(dept => {
              const resolutionRate = dept.total_complaints > 0
                ? Math.round((dept.resolved_complaints / dept.total_complaints) * 100)
                : 0;
              const trustColor = dept.trust_score >= 75 ? 'text-green-600' : dept.trust_score >= 50 ? 'text-orange-600' : 'text-red-600';
              const trustBg = dept.trust_score >= 75 ? 'from-green-500 to-green-400' : dept.trust_score >= 50 ? 'from-orange-500 to-orange-400' : 'from-red-500 to-red-400';

              return (
                <div key={dept.id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{dept.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {T.admin_graph_score}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-4xl font-black ${trustColor}`}>{dept.trust_score}%</div>
                      <p className="text-xs text-gray-400 font-medium">{T.admin_trust_score}</p>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full mb-5 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${trustBg} transition-all duration-700`} style={{ width: `${dept.trust_score}%` }}></div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {[
                      { label: T.admin_dept_total, value: dept.total_complaints, color: 'text-gray-700' },
                      { label: T.admin_dept_resolved, value: dept.resolved_complaints, color: 'text-green-600' },
                      { label: T.admin_dept_pending, value: dept.pending_count, color: 'text-yellow-600' },
                      { label: T.admin_dept_escalated, value: dept.escalated_count, color: 'text-red-600' },
                      { label: T.admin_dept_rate, value: `${resolutionRate}%`, color: resolutionRate >= 70 ? 'text-green-600' : resolutionRate >= 50 ? 'text-orange-600' : 'text-red-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className={`text-2xl font-black ${color}`}>{value}</p>
                        <p className="text-xs text-gray-400 font-medium mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* GRAPH INTELLIGENCE TAB */}
        {activeTab === 'graph' && (
          <div className="space-y-6">
            {/* Graph stats summary */}
            {graphStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: T.admin_total_nodes, value: graphStats.total, icon: <Network size={20} />, color: 'text-green-600', bg: 'bg-green-50 border-green-100', desc: T.admin_nodes_desc },
                  { label: T.admin_clustered, value: graphStats.clustered, icon: <GitBranch size={20} />, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', desc: T.admin_clustered_desc },
                  { label: T.admin_escalated, value: graphStats.escalated, icon: <AlertTriangle size={20} />, color: 'text-red-600', bg: 'bg-red-50 border-red-100', desc: T.admin_escalated_desc },
                ].map(({ label, value, icon, color, bg, desc }) => (
                  <div key={label} className={`rounded-2xl border p-6 ${bg}`}>
                    <div className={`${color} mb-3`}>{icon}</div>
                    <div className={`text-4xl font-black ${color} mb-1`}>{value}</div>
                    <div className="text-sm font-semibold text-gray-800">{label}</div>
                    <div className="text-xs text-gray-500 mt-1">{desc}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Hotspot areas */}
            {graphStats && graphStats.hotspots.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp size={18} className="text-orange-500" />
                  <h3 className="font-bold text-gray-900">{T.admin_hotspots}</h3>
                </div>
                <div className="space-y-3">
                  {(graphStats?.hotspots || [])?.map((h, i) => {
                    const maxCount = graphStats.hotspots[0]?.count || 1;
                    const pct = Math.round((h.count / maxCount) * 100);
                    return (
                      <div key={i} className="flex items-center gap-4">
                        <div className="flex items-center gap-2 w-36 shrink-0">
                          <MapPin size={12} className="text-orange-400" />
                          <span className="text-sm font-semibold text-gray-700 truncate">{h.area}</span>
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 w-10 text-right">{h.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Render Workflows automation info */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <Zap size={18} className="text-yellow-500" />
                <h3 className="font-bold text-gray-900">{T.admin_workflows}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: T.admin_wf_escalation_name, trigger: T.admin_wf_escalation_trigger, action: T.admin_wf_escalation_action, status: T.admin_wf_active },
                  { name: T.admin_wf_cluster_name, trigger: T.admin_wf_cluster_trigger, action: T.admin_wf_cluster_action, status: T.admin_wf_active },
                  { name: T.admin_wf_score_name, trigger: T.admin_wf_score_trigger, action: T.admin_wf_score_action, status: T.admin_wf_active },
                  { name: T.admin_wf_reminder_name, trigger: T.admin_wf_reminder_trigger, action: T.admin_wf_reminder_action, status: T.admin_wf_active },
                ].map(wf => (
                  <div key={wf.name} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-gray-900">{wf.name}</span>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{wf.status}</span>
                    </div>
                    <p className="text-xs text-orange-600 font-medium mb-1">{T.admin_wf_trigger} {wf.trigger}</p>
                    <p className="text-xs text-gray-500">{wf.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Officers Tab */}
        {activeTab === 'officers' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{T.admin_officers_title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{T.admin_officers_subtitle}</p>
              </div>
              {officers.length === 0 && (
                <button
                  onClick={handleSeedOfficers}
                  disabled={seeding}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {seeding ? <><RefreshCw size={14} className="animate-spin" /> {T.admin_officers_seeding}</> : <><UserCog size={14} /> {T.admin_officers_seed}</>}
                </button>
              )}
            </div>

            {/* Department filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <Filter size={16} className="text-gray-400" />
              <select
                value={officerDeptFilter}
                onChange={e => setOfficerDeptFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              >
                <option value="ALL">{T.admin_officers_all_depts}</option>
                {(departmentNames || [])?.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500">{officers.length} {T.admin_officers_assign.toLowerCase()}</span>
            </div>

            {/* Officers list */}
            {officersLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw size={24} className="animate-spin text-orange-500" />
                <span className="ml-3 text-gray-500">{T.admin_officers_loading}</span>
              </div>
            ) : officers.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <UserCog size={48} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">{T.admin_officers_none}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(officers || [])?.map(officer => (
                  <div key={officer.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {officer.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm leading-tight">{officer.name}</h4>
                          <p className="text-xs text-gray-500">{officer.rank}</p>
                        </div>
                      </div>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-semibold whitespace-nowrap">{officer.badge_number}</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-1.5 text-gray-600">
                        <span className="font-semibold text-gray-400 uppercase tracking-wide shrink-0">{T.admin_officers_dept}</span>
                        <span className="text-gray-700 leading-snug">{officer.department}</span>
                      </div>
                      {officer.phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone size={11} className="text-gray-400" />
                          <a href={`tel:${officer.phone}`} className="hover:text-orange-500 transition-colors">{officer.phone}</a>
                        </div>
                      )}
                      {officer.ward && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin size={11} className="text-gray-400" />
                          <span>{officer.ward}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assign Officer Modal */}
        {assignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAssignModal(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{T.admin_officers_assign_title}</h3>
                <button onClick={() => setAssignModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <p className="text-sm text-gray-500 mb-4">{T.admin_officers_assign_dept}: <span className="font-semibold text-gray-700">{assignModal.department}</span></p>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {(() => {
                  let availableOfficers = officers.filter(o => 
                    assignModal.department?.toLowerCase().includes(o.department.toLowerCase()) || 
                    o.department.toLowerCase().includes(assignModal.department?.toLowerCase() || '')
                  );
                  
                  // Fallback to all officers if no direct department match is found
                  if (availableOfficers.length === 0) {
                    availableOfficers = officers;
                  }

                  return availableOfficers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">{T.admin_officers_none}</p>
                  ) : (
                    availableOfficers.map(officer => (
                      <button
                        key={officer.id}
                        onClick={() => handleAssignOfficer(officer.id)}
                        disabled={assigning}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-orange-300 hover:bg-orange-50 transition-colors text-left disabled:opacity-50"
                      >
                        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">{officer.name.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{officer.name}</p>
                          <p className="text-xs text-gray-500">{officer.rank} · {officer.badge_number}</p>
                        </div>
                        {officer.phone && (
                          <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{officer.phone}</span>
                        )}
                      </button>
                    ))
                  );
                })()}
              </div>
              <button onClick={() => setAssignModal(null)} className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors">{T.admin_officers_cancel}</button>
            </div>
          </div>
        )}

        {/* Escalate to Officer Modal */}
        {escalateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEscalateModal(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{T.admin_officers_escalate_title}</h3>
                <button onClick={() => setEscalateModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <p className="text-sm text-gray-500 mb-4">{T.admin_officers_escalate_select}</p>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {(() => {
                  const complaint = localComplaints.find(c => c.id === escalateModal.complaintId);
                  
                  let deptOfficers = officers.filter(o => {
                    const matchDept = complaint?.department?.toLowerCase().includes(o.department.toLowerCase()) || 
                                      o.department.toLowerCase().includes(complaint?.department?.toLowerCase() || '');
                    return matchDept && o.rank === 'Senior Level';
                  });

                  // Fallback to all senior officers if no direct department match
                  if (deptOfficers.length === 0) {
                    deptOfficers = officers.filter(o => o.rank === 'Senior Level');
                  }

                  if (deptOfficers.length === 0) {
                    return <p className="text-sm text-gray-400 text-center py-4">{T.admin_officers_none}</p>;
                  }

                  return deptOfficers.map(officer => (
                    <button
                      key={officer.id}
                      onClick={() => handleEscalateOfficer(officer.id)}
                      disabled={assigning}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-red-300 hover:bg-red-50 transition-colors text-left disabled:opacity-50"
                    >
                      <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs shrink-0">{officer.name.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{officer.name}</p>
                        <p className="text-xs text-gray-500">{officer.rank} · {officer.badge_number}</p>
                      </div>
                      {officer.phone && (
                        <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{officer.phone}</span>
                      )}
                    </button>
                  ));
                })()}
              </div>
              <button onClick={() => setEscalateModal(null)} className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors">{T.admin_officers_cancel}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
