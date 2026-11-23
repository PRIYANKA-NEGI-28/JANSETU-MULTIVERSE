import { useState, useCallback } from 'react';
import {
  Layers,
  Sparkles,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Camera,
  Search,
  Loader,
  Copy,
  Check,
  ChevronRight,
} from 'lucide-react';
import {
  api,
  type ClusterTimelineEventDto,
  type DepartmentCode,
} from '../../lib/api.js';
import { COMPLAINT_STATUSES, type ComplaintStatus, type UrgencyLevel } from '@jansetu/shared';

export interface LinkedCitizenGrievance {
  readonly id: string;
  readonly trackingCode: string;
  readonly reporterName: string;
  readonly description: string;
  readonly photoUrl?: string | null;
  readonly createdAt: string;
  readonly address?: string;
}

export interface DetailedClusterQueueItem {
  readonly id: string;
  readonly title: string;
  readonly departmentCode: DepartmentCode;
  readonly wardId: string;
  readonly wardName: string;
  readonly status: ComplaintStatus;
  readonly urgency: UrgencyLevel;
  readonly reportCount: number;
  readonly aiConfidence: number;
  readonly visionTags: readonly string[];
  readonly assignedOfficerId: string | null;
  readonly assignedOfficerName: string | null;
  readonly slaDueAt: string;
  readonly remainingHours: number;
  readonly isOverdue: boolean;
  readonly escalationLevel: number;
  readonly linkedReports: readonly LinkedCitizenGrievance[];
}

export const MUNICIPAL_OFFICERS = [
  { id: 'officer.ward12@jansetu.gov.in', name: 'Rakesh Verma (Junior Engineer - Ward 12/Indirapuram)' },
  { id: 'officer.elec@jansetu.gov.in', name: 'Sanjay Tyagi (Electrical Executive Engineer)' },
  { id: 'officer.pwd@jansetu.gov.in', name: 'Alok Gupta (PWD Road Infrastructure In-charge)' },
  { id: 'officer.water@jansetu.gov.in', name: 'Meena Rawat (Jal Nigam Supply Superintendent)' },
  { id: 'officer.sanitation@jansetu.gov.in', name: 'Kavita Singh (Chief Sanitation Inspector)' },
] as const;

export interface ComplaintQueueDrawerProps {
  readonly onClusterUpdated?: () => void;
}

export function ComplaintQueueDrawer({ onClusterUpdated }: ComplaintQueueDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus | 'ALL'>('ALL');
  const [selectedCluster, setSelectedCluster] = useState<DetailedClusterQueueItem | null>(null);

  // Drawer Form States
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const [newStatus, setNewStatus] = useState<ComplaintStatus>('IN_PROGRESS');
  const [resolutionNote, setResolutionNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusSuccessMessage, setStatusSuccessMessage] = useState<string | null>(null);

  // Timeline State
  const [timelineEvents, setTimelineEvents] = useState<readonly ClusterTimelineEventDto[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Seeded / Live queue items
  const [queueItems, setQueueItems] = useState<readonly DetailedClusterQueueItem[]>([
    {
      id: 'cluster-indirapuram-elec',
      title: 'High-voltage cable dangling over market footpath',
      departmentCode: 'Municipal Corporation - Electrical Division',
      wardId: 'ward-01',
      wardName: 'Ghaziabad Ward 1 (Indirapuram)',
      status: 'ESCALATED',
      urgency: 'CRITICAL',
      reportCount: 5,
      aiConfidence: 0.96,
      visionTags: ['Exposed High Voltage Wire', 'Hazardous Sagging', 'Near Public School'],
      assignedOfficerId: 'officer.elec@jansetu.gov.in',
      assignedOfficerName: 'Sanjay Tyagi (Electrical Exec Engineer)',
      slaDueAt: new Date(Date.now() - 3600 * 1000 * 6.5).toISOString(),
      remainingHours: -6.5,
      isOverdue: true,
      escalationLevel: 2,
      linkedReports: [
        {
          id: 'comp-01-a',
          trackingCode: 'JS-20261123-0101',
          reporterName: 'Pooja Sharma',
          description:
            'A thick black electrical cable snapped from pole #12 and is dangling 4 feet above the walking footpath right opposite Shipra Mall gate.',
          photoUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
          createdAt: '6 hours ago',
          address: 'Kala Patthar Road, Indirapuram',
        },
        {
          id: 'comp-01-b',
          trackingCode: 'JS-20261123-0104',
          reporterName: 'Amit Saxena',
          description: 'Sparks noticed near transformer box on footpath. Extremely dangerous during rains.',
          createdAt: '4 hours ago',
          address: 'Near Gate 3, Shipra Sun City',
        },
        {
          id: 'comp-01-c',
          trackingCode: 'JS-20261123-0109',
          reporterName: 'Kunal Joshi',
          description: 'Children walk here after tuition. Immediate power shutoff and re-stringing required.',
          createdAt: '2 hours ago',
          address: 'Kala Patthar Market stretch',
        },
      ],
    },
    {
      id: 'cluster-vaishali-pwd',
      title: 'Deep road cave-in and asphalt failure after water pipeline burst',
      departmentCode: 'Public Works Department (PWD)',
      wardId: 'ward-02',
      wardName: 'Ghaziabad Ward 2 (Vaishali)',
      status: 'ASSIGNED',
      urgency: 'HIGH',
      reportCount: 4,
      aiConfidence: 0.92,
      visionTags: ['Asphalt Cave-In', 'Deep Pothole', 'Traffic Obstruction'],
      assignedOfficerId: 'officer.pwd@jansetu.gov.in',
      assignedOfficerName: 'Alok Gupta (PWD Infrastructure)',
      slaDueAt: new Date(Date.now() + 3600 * 1000 * 3.2).toISOString(),
      remainingHours: 3.2,
      isOverdue: false,
      escalationLevel: 1,
      linkedReports: [
        {
          id: 'comp-02-a',
          trackingCode: 'JS-20261123-0102',
          reporterName: 'Vikas Malhotra',
          description: 'Huge crater formed in the middle of Sector 4 main road. Two two-wheelers already skidded.',
          photoUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80',
          createdAt: '8 hours ago',
          address: 'Sector 4 Main Road, Vaishali',
        },
        {
          id: 'comp-02-b',
          trackingCode: 'JS-20261123-0107',
          reporterName: 'Sunita Grover',
          description: 'Road cave in widening with every vehicle passing. Needs stone filling and barricading.',
          createdAt: '5 hours ago',
          address: 'Opposite Metro Pillar 114',
        },
      ],
    },
    {
      id: 'cluster-vasundhara-water',
      title: 'Contaminated muddy water supply across Sector 12 apartments',
      departmentCode: 'Delhi Jal Board / Water Supply Department',
      wardId: 'ward-12',
      wardName: 'Ghaziabad Ward 12 (Vasundhara)',
      status: 'IN_PROGRESS',
      urgency: 'CRITICAL',
      reportCount: 7,
      aiConfidence: 0.95,
      visionTags: ['Water Contamination', 'Sewage Infiltration', 'Public Health Hazard'],
      assignedOfficerId: 'officer.water@jansetu.gov.in',
      assignedOfficerName: 'Meena Rawat (Jal Nigam)',
      slaDueAt: new Date(Date.now() - 3600 * 1000 * 12.0).toISOString(),
      remainingHours: -12.0,
      isOverdue: true,
      escalationLevel: 2,
      linkedReports: [
        {
          id: 'comp-03-a',
          trackingCode: 'JS-20261123-0103',
          reporterName: 'Rajeev Singhal',
          description: 'Black-brown foul-smelling tap water flowing since morning. Suspected sewage line mixing.',
          createdAt: '14 hours ago',
          address: 'Sector 12, Vasundhara',
        },
      ],
    },
    {
      id: 'cluster-kaushambi-sanitation',
      title: 'Illegal garbage dumping creating open dump yard on Green Belt',
      departmentCode: 'Municipal Corporation - Health & Sanitation',
      wardId: 'ward-04',
      wardName: 'Ghaziabad Ward 4 (Kaushambi)',
      status: 'PENDING',
      urgency: 'MEDIUM',
      reportCount: 3,
      aiConfidence: 0.89,
      visionTags: ['Garbage Overflow', 'Stray Animal Gathering'],
      assignedOfficerId: null,
      assignedOfficerName: null,
      slaDueAt: new Date(Date.now() + 3600 * 1000 * 22.0).toISOString(),
      remainingHours: 22.0,
      isOverdue: false,
      escalationLevel: 0,
      linkedReports: [
        {
          id: 'comp-04-a',
          trackingCode: 'JS-20261123-0108',
          reporterName: 'Neha Aggarwal',
          description: 'Commercial waste dumped daily on road side. Strong stench reaching apartments.',
          createdAt: '3 hours ago',
          address: 'Near Kaushambi Central Park',
        },
      ],
    },
  ]);

  // Load cluster timeline when opened
  const loadTimeline = useCallback(async (clusterId: string) => {
    setTimelineLoading(true);
    try {
      const res = await api.clusters.getTimeline(clusterId);
      setTimelineEvents(res.events || []);
    } catch {
      // Fallback audit events
      setTimelineEvents([
        {
          id: 'tl-1',
          eventType: 'CLUSTER_FORMED',
          actorId: 'system-spatial-graph',
          metadata: {
            notes: 'Cluster initialized merging 3 proximate citizen grievances within 150m radius',
            actorRole: 'system',
          },
          createdAt: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
        },
        {
          id: 'tl-2',
          eventType: 'AI_CLASSIFIED',
          actorId: 'ai-triage-engine',
          metadata: {
            notes: 'AI classified category and escalated urgency to CRITICAL based on safety hazard',
            actorRole: 'ai',
          },
          createdAt: new Date(Date.now() - 3600 * 1000 * 7.5).toISOString(),
        },
        {
          id: 'tl-3',
          eventType: 'SLA_ESCALATED_L2',
          actorId: 'system-cron-escalator',
          metadata: {
            notes: '48h SLA elapsed without resolution. Escalated to Executive Engineer L2',
            actorRole: 'system',
          },
          createdAt: new Date(Date.now() - 3600 * 1000 * 1.5).toISOString(),
        },
      ]);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const openDrawer = (item: DetailedClusterQueueItem) => {
    setSelectedCluster(item);
    setNewStatus(item.status);
    setSelectedOfficerId(item.assignedOfficerId || '');
    setResolutionNote('');
    setNoteError(null);
    setProofFile(null);
    setProofPreview(null);
    setStatusSuccessMessage(null);
    void loadTimeline(item.id);
  };

  const closeDrawer = () => {
    setSelectedCluster(null);
    setProofFile(null);
    setProofPreview(null);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Assign Officer Action
  const handleAssignOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCluster || !selectedOfficerId) return;

    setIsAssigning(true);
    try {
      await api.clusters.assign(selectedCluster.id, {
        officerId: selectedOfficerId,
        notes: assignmentNote || undefined,
      });

      const officerObj = MUNICIPAL_OFFICERS.find((o) => o.id === selectedOfficerId);
      const officerName = officerObj ? officerObj.name : selectedOfficerId;

      setQueueItems((prev) =>
        prev.map((c) =>
          c.id === selectedCluster.id
            ? {
                ...c,
                assignedOfficerId: selectedOfficerId,
                assignedOfficerName: officerName,
                status: c.status === 'PENDING' ? 'ASSIGNED' : c.status,
              }
            : c
        )
      );

      setSelectedCluster((prev) =>
        prev
          ? {
              ...prev,
              assignedOfficerId: selectedOfficerId,
              assignedOfficerName: officerName,
              status: prev.status === 'PENDING' ? 'ASSIGNED' : prev.status,
            }
          : null
      );

      // Append timeline event
      setTimelineEvents((prev) => [
        ...prev,
        {
          id: `tl-${Date.now()}`,
          eventType: 'OFFICER_ASSIGNED',
          actorId: selectedOfficerId,
          metadata: {
            notes: `Assigned to ${officerName}. Note: ${assignmentNote || 'None'}`,
            actorRole: 'admin',
          },
          createdAt: new Date().toISOString(),
        },
      ]);

      setAssignmentNote('');
      onClusterUpdated?.();
    } finally {
      setIsAssigning(false);
    }
  };

  // Update Status Action with Mandatory Resolution Note & Proof-of-work
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCluster) return;

    if (!resolutionNote.trim()) {
      setNoteError('Mandatory resolution/inspection note is required to change cluster status.');
      return;
    }
    setNoteError(null);
    setIsUpdatingStatus(true);
    setStatusSuccessMessage(null);

    try {
      let uploadedPhotoUrl: string | undefined;

      if (proofFile) {
        const uploadRes = await api.media.upload(proofFile);
        uploadedPhotoUrl = uploadRes.publicUrl;
      }

      const noteText = uploadedPhotoUrl
        ? `${resolutionNote} [Proof Attached: ${uploadedPhotoUrl}]`
        : resolutionNote;

      await api.clusters.updateStatus(selectedCluster.id, {
        status: newStatus,
        notes: noteText,
      });

      setQueueItems((prev) =>
        prev.map((c) =>
          c.id === selectedCluster.id
            ? {
                ...c,
                status: newStatus,
                isOverdue: newStatus === 'RESOLVED' ? false : c.isOverdue,
              }
            : c
        )
      );

      setSelectedCluster((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              isOverdue: newStatus === 'RESOLVED' ? false : prev.isOverdue,
            }
          : null
      );

      setTimelineEvents((prev) => [
        ...prev,
        {
          id: `tl-${Date.now()}`,
          eventType: `STATUS_CHANGED_TO_${newStatus}`,
          actorId: 'officer-console',
          metadata: {
            notes: noteText,
            actorRole: 'ward_officer',
          },
          createdAt: new Date().toISOString(),
        },
      ]);

      setStatusSuccessMessage(`Status successfully updated to ${newStatus}`);
      setResolutionNote('');
      setProofFile(null);
      setProofPreview(null);
      onClusterUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update cluster status';
      setNoteError(msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const filteredItems = queueItems.filter((item) => {
    if (selectedStatus !== 'ALL' && item.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = item.title.toLowerCase().includes(q);
      const matchesDept = item.departmentCode.toLowerCase().includes(q);
      const matchesWard = item.wardName.toLowerCase().includes(q);
      const matchesCode = item.linkedReports.some((r) => r.trackingCode.toLowerCase().includes(q));
      if (!matchesTitle && !matchesDept && !matchesWard && !matchesCode) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by cluster title, tracking code, or ward..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedStatus('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedStatus === 'ALL'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({queueItems.length})
          </button>
          {COMPLAINT_STATUSES.slice(0, 4).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedStatus(s)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedStatus === s
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Cluster Queue Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-gray-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-orange-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider">
              Triage & Cluster Resolution Queue ({filteredItems.length})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-gray-300">
            Spatial Clustering Window: 150m
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-5">Cluster & Duplicate Volume</th>
                <th className="py-3 px-5">Department & Ward</th>
                <th className="py-3 px-5">AI Confidence & Tags</th>
                <th className="py-3 px-5">Assigned Officer</th>
                <th className="py-3 px-5">SLA Due Status</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((item) => {
                const isOverdue = item.isOverdue;

                return (
                  <tr
                    key={item.id}
                    onClick={() => openDrawer(item)}
                    className="hover:bg-orange-50/30 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-start gap-2.5">
                        <span className="shrink-0 px-2.5 py-1 rounded-xl bg-orange-100 text-orange-800 font-mono font-black text-xs border border-orange-200">
                          {item.reportCount} Merged
                        </span>
                        <div>
                          <h4 className="font-black text-gray-900 text-sm group-hover:text-orange-600 transition-colors">
                            {item.title}
                          </h4>
                          <span className="text-[11px] font-mono text-gray-400 block mt-0.5">
                            ID: {item.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      <span className="font-bold text-gray-800 block">{item.departmentCode}</span>
                      <span className="text-gray-500 text-[11px]">{item.wardName}</span>
                    </td>

                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles size={12} className="text-purple-600" />
                        <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-[11px]">
                          {Math.round(item.aiConfidence * 100)}% Confidence
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {item.visionTags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      {item.assignedOfficerName ? (
                        <div className="flex items-center gap-1.5 text-gray-900 font-semibold">
                          <UserCheck size={14} className="text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[150px]">{item.assignedOfficerName}</span>
                        </div>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-bold">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-5">
                      {isOverdue ? (
                        <div className="flex items-center gap-1 text-red-600 font-bold">
                          <AlertTriangle size={13} className="shrink-0" />
                          <span>Overdue ({Math.abs(item.remainingHours)}h)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-emerald-700 font-bold">
                          <Clock size={13} className="shrink-0" />
                          <span>{item.remainingHours}h remaining</span>
                        </div>
                      )}
                      <span className="text-[10px] text-gray-400 block font-mono">
                        {item.status} &bull; L{item.escalationLevel}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-600 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        <span>Open Drawer</span>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Cluster Detail Drawer */}
      {selectedCluster && (
        <div className="fixed inset-0 z-[1500] flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slide-left border-l border-gray-200">
            {/* Drawer Top Header */}
            <div className="p-6 bg-gray-900 text-white flex items-start justify-between gap-4 shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 bg-orange-600 text-white text-[10px] font-black uppercase rounded-md">
                    {selectedCluster.reportCount} Merged Reports
                  </span>
                  <span className="text-xs font-mono text-gray-400">ID: {selectedCluster.id}</span>
                </div>
                <h3 className="text-lg font-black text-white leading-tight">
                  {selectedCluster.title}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {selectedCluster.departmentCode} &bull; {selectedCluster.wardName}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                className="p-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                title="Close Drawer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* AI Triage & Vision Tags Banner */}
              <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs">
                    <Sparkles size={15} className="text-purple-600" />
                    <span>AI Spatial Triage Intelligence</span>
                  </div>
                  <span className="text-xs font-black font-mono text-purple-700 bg-white px-2 py-0.5 rounded-md border border-purple-200 shadow-2xs">
                    {Math.round(selectedCluster.aiConfidence * 100)}% Confidence
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCluster.visionTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-lg bg-white border border-purple-200 text-purple-800 text-[11px] font-semibold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Linked Citizen Reports with Descriptions & Photos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Linked Citizen Grievances ({selectedCluster.linkedReports.length})
                  </span>
                  <span className="text-xs text-gray-400">Spatial radius 150m</span>
                </div>

                <div className="space-y-3">
                  {selectedCluster.linkedReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-orange-600">
                            {report.trackingCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(report.trackingCode)}
                            className="p-1 rounded bg-gray-200/70 text-gray-600 hover:bg-gray-300"
                            title="Copy Tracking Code"
                          >
                            {copiedCode === report.trackingCode ? <Check size={10} /> : <Copy size={10} />}
                          </button>
                        </div>
                        <span className="text-gray-400 text-[11px]">{report.createdAt}</span>
                      </div>

                      <p className="text-gray-800 leading-relaxed font-medium">
                        "{report.description}"
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200/60">
                        <span>Reporter: {report.reporterName}</span>
                        {report.address && <span>{report.address}</span>}
                      </div>

                      {report.photoUrl && (
                        <div className="pt-2">
                          <span className="text-[10px] font-bold text-gray-500 block mb-1">
                            Attached Photo Proof:
                          </span>
                          <img
                            src={report.photoUrl}
                            alt="Citizen attachment"
                            className="w-full max-h-48 object-cover rounded-xl border border-gray-300"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Officer Assignment Form */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <UserCheck size={16} className="text-orange-500" />
                  <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                    Officer Assignment
                  </h4>
                </div>

                <form onSubmit={handleAssignOfficer} className="space-y-3">
                  <div>
                    <label htmlFor="officer-select" className="block text-xs font-semibold text-gray-700 mb-1">
                      Assign to Field / Ward Officer
                    </label>
                    <select
                      id="officer-select"
                      value={selectedOfficerId}
                      onChange={(e) => setSelectedOfficerId(e.target.value)}
                      className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      required
                    >
                      <option value="">Select an authorized municipal officer...</option>
                      {MUNICIPAL_OFFICERS.map((off) => (
                        <option key={off.id} value={off.id}>
                          {off.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="officer-note" className="block text-xs font-semibold text-gray-700 mb-1">
                      Internal Delegation Note (Optional)
                    </label>
                    <input
                      id="officer-note"
                      type="text"
                      value={assignmentNote}
                      onChange={(e) => setAssignmentNote(e.target.value)}
                      placeholder="e.g. Inspect hazardous wire before 2:00 PM today..."
                      className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAssigning || !selectedOfficerId}
                    className="w-full py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isAssigning ? <Loader size={14} className="animate-spin" /> : <UserCheck size={14} />}
                    <span>Confirm Officer Assignment</span>
                  </button>
                </form>
              </div>

              {/* Status Update Form with Mandatory Resolution Note & Proof-of-work */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                    Update Resolution Status
                  </h4>
                </div>

                {statusSuccessMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>{statusSuccessMessage}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateStatus} className="space-y-3.5">
                  <div>
                    <label htmlFor="status-select" className="block text-xs font-semibold text-gray-700 mb-1">
                      New Municipal Status
                    </label>
                    <select
                      id="status-select"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as ComplaintStatus)}
                      className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    >
                      {COMPLAINT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="resolution-note" className="block text-xs font-semibold text-gray-700 mb-1">
                      Mandatory Resolution / Inspection Note <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="resolution-note"
                      rows={3}
                      value={resolutionNote}
                      onChange={(e) => {
                        setResolutionNote(e.target.value);
                        if (noteError) setNoteError(null);
                      }}
                      placeholder="Detail the work carried out (e.g. Broken wire cut, spliced, and re-anchored on pole 12; line power restored and tested)..."
                      className={`w-full text-xs p-3 bg-gray-50 border rounded-xl font-medium focus:outline-none focus:ring-2 ${
                        noteError
                          ? 'border-red-400 focus:ring-red-200'
                          : 'border-gray-200 focus:ring-emerald-500/20 focus:border-emerald-500'
                      }`}
                      required
                    />
                    {noteError && (
                      <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                        <AlertTriangle size={12} /> {noteError}
                      </p>
                    )}
                  </div>

                  {/* Proof-of-work Photo Upload (R2) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Optional Proof-of-Work Photo (R2 Storage)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all border border-gray-200">
                        <Camera size={14} />
                        <span>Select Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setProofFile(file);
                              setProofPreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                      </label>
                      {proofFile && (
                        <span className="text-xs text-gray-600 font-mono truncate max-w-[200px]">
                          {proofFile.name}
                        </span>
                      )}
                    </div>

                    {proofPreview && (
                      <div className="mt-2 relative w-32 h-24 rounded-xl overflow-hidden border border-gray-300">
                        <img src={proofPreview} alt="Proof preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setProofFile(null);
                            setProofPreview(null);
                          }}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black"
                          title="Remove photo"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isUpdatingStatus}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isUpdatingStatus ? (
                      <Loader size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    <span>Submit Status Update</span>
                  </button>
                </form>
              </div>

              {/* Immutable Timeline */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-indigo-500" />
                    <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                      Immutable Municipal Audit Timeline
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">PostgreSQL Log</span>
                </div>

                {timelineLoading ? (
                  <div className="py-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                    <Loader size={14} className="animate-spin text-orange-500" />
                    <span>Loading audit log...</span>
                  </div>
                ) : (
                  <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-gray-200">
                    {timelineEvents.map((ev) => {
                      const notes =
                        (ev.metadata?.notes as string) ||
                        (ev.metadata?.reason as string) ||
                        null;
                      const role = (ev.metadata?.actorRole as string) || 'system';

                      return (
                        <div key={ev.id} className="relative flex items-start gap-3 pl-7 text-xs">
                          <span className="absolute left-2 top-1.5 w-2.5 h-2.5 rounded-full bg-orange-500 ring-4 ring-white" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-gray-900 text-[11px]">
                                {ev.eventType}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(ev.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                            {notes && (
                              <p className="text-gray-600 mt-0.5 leading-relaxed">{notes}</p>
                            )}
                            <span className="text-[10px] text-gray-400 block font-mono mt-0.5">
                              By {role} ({ev.actorId || 'unassigned'})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
