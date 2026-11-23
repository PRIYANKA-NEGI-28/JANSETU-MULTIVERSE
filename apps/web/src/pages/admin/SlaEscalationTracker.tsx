import { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  Flame,
  CheckCircle2,
  ExternalLink,
  Send,
} from 'lucide-react';
import type { SlaBreachItemDto } from '../../lib/api.js';

export interface EscalationClusterItem {
  readonly id: string;
  readonly trackingCode: string;
  readonly title: string;
  readonly department: string;
  readonly ward: string;
  readonly urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  readonly escalationLevel: 1 | 2 | 3;
  readonly overdueHours: number;
  readonly remainingHours?: number;
  readonly assignedOfficer: string;
  readonly officerRole: string;
  readonly status: string;
  readonly citizenCount: number;
}

export interface SlaEscalationTrackerProps {
  readonly breaches?: readonly SlaBreachItemDto[];
  readonly onInspectCluster?: (clusterId: string) => void;
}

export function SlaEscalationTracker({
  onInspectCluster,
}: SlaEscalationTrackerProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'approaching' | 'l1' | 'l2' | 'l3'>('all');
  const [escalationNoticeSent, setEscalationNoticeSent] = useState<string | null>(null);

  // Approaching Deadlines Data (<4h remaining)
  const [approachingDeadlines] = useState<readonly EscalationClusterItem[]>([
    {
      id: 'cluster-vai-pothole',
      trackingCode: 'JS-20261123-0102',
      title: 'Massive pothole cluster causing traffic jams on Link Road',
      department: 'Public Works Department (PWD)',
      ward: 'Ghaziabad Ward 2 (Vaishali)',
      urgency: 'HIGH',
      escalationLevel: 1,
      overdueHours: 0,
      remainingHours: 2.5,
      assignedOfficer: 'Alok Gupta',
      officerRole: 'Ward Infrastructure In-charge',
      status: 'ASSIGNED',
      citizenCount: 4,
    },
    {
      id: 'cluster-ind-street',
      trackingCode: 'JS-20261123-0115',
      title: 'Dark zone due to 8 consecutive streetlight failures on Kala Patthar',
      department: 'Electrical Division',
      ward: 'Ghaziabad Ward 1 (Indirapuram)',
      urgency: 'HIGH',
      escalationLevel: 1,
      overdueHours: 0,
      remainingHours: 1.2,
      assignedOfficer: 'Rakesh Verma',
      officerRole: 'Junior Engineer',
      status: 'IN_PROGRESS',
      citizenCount: 6,
    },
    {
      id: 'cluster-vas-drain',
      trackingCode: 'JS-20261123-0122',
      title: 'Severe storm drain blockage overflowing into basement parking',
      department: 'Delhi Jal Board / Water Supply',
      ward: 'Ghaziabad Ward 12 (Vasundhara)',
      urgency: 'CRITICAL',
      escalationLevel: 1,
      overdueHours: 0,
      remainingHours: 0.8,
      assignedOfficer: 'Meena Rawat',
      officerRole: 'Section Superintendent',
      status: 'PENDING',
      citizenCount: 8,
    },
  ]);

  // Breached Clusters Grouped by Escalation Level
  const [breachedClusters] = useState<readonly EscalationClusterItem[]>([
    // Level 1: 0 to 24h Overdue (Ward Officer / Junior Engineer)
    {
      id: 'breach-l1-01',
      trackingCode: 'JS-20261123-0105',
      title: 'Uncollected market garbage dump overflowing into road',
      department: 'Municipal Corporation - Health & Sanitation',
      ward: 'Ghaziabad Ward 4 (Kaushambi)',
      urgency: 'MEDIUM',
      escalationLevel: 1,
      overdueHours: 9.5,
      assignedOfficer: 'Kavita Singh',
      officerRole: 'Ward Sanitary Inspector (L1)',
      status: 'ASSIGNED',
      citizenCount: 3,
    },
    {
      id: 'breach-l1-02',
      trackingCode: 'JS-20261123-0106',
      title: 'Broken manhole cover near pedestrian crossing',
      department: 'Public Works Department (PWD)',
      ward: 'Ghaziabad Ward 1 (Indirapuram)',
      urgency: 'HIGH',
      escalationLevel: 1,
      overdueHours: 14.2,
      assignedOfficer: 'Rakesh Verma',
      officerRole: 'Junior Engineer (L1)',
      status: 'IN_PROGRESS',
      citizenCount: 5,
    },

    // Level 2: 24 to 48h Overdue (Executive Engineer / Dept Head)
    {
      id: 'breach-l2-01',
      trackingCode: 'JS-20261123-0101',
      title: 'Live high-voltage electrical cable dangling near primary school',
      department: 'Municipal Corporation - Electrical Division',
      ward: 'Ghaziabad Ward 1 (Indirapuram)',
      urgency: 'CRITICAL',
      escalationLevel: 2,
      overdueHours: 28.5,
      assignedOfficer: 'Sanjay Tyagi',
      officerRole: 'Executive Engineer (L2)',
      status: 'ESCALATED',
      citizenCount: 5,
    },
    {
      id: 'breach-l2-02',
      trackingCode: 'JS-20261123-0103',
      title: 'Sewage infiltration into drinking water distribution pipeline',
      department: 'Delhi Jal Board / Water Supply Department',
      ward: 'Ghaziabad Ward 12 (Vasundhara)',
      urgency: 'CRITICAL',
      escalationLevel: 2,
      overdueHours: 36.0,
      assignedOfficer: 'Meena Rawat',
      officerRole: 'Superintending Engineer (L2)',
      status: 'ESCALATED',
      citizenCount: 7,
    },

    // Level 3: >48h Overdue (Additional Commissioner / Vigilance)
    {
      id: 'breach-l3-01',
      trackingCode: 'JS-20261123-0098',
      title: 'Unchecked illegal encroachment and construction blocking main arterial drain',
      department: 'Municipal Corporation - Building & Housing',
      ward: 'Ghaziabad Ward 5 (Raj Nagar Ext)',
      urgency: 'CRITICAL',
      escalationLevel: 3,
      overdueHours: 56.4,
      assignedOfficer: 'Additional Commissioner (Vigilance)',
      officerRole: 'Chief Vigilance Officer (L3)',
      status: 'ESCALATED',
      citizenCount: 14,
    },
  ]);

  const handleSendNotice = (trackingCode: string) => {
    setEscalationNoticeSent(trackingCode);
    setTimeout(() => setEscalationNoticeSent(null), 3000);
  };

  const l1Items = breachedClusters.filter((c) => c.escalationLevel === 1);
  const l2Items = breachedClusters.filter((c) => c.escalationLevel === 2);
  const l3Items = breachedClusters.filter((c) => c.escalationLevel === 3);

  return (
    <div className="space-y-6">
      {/* Approaching Deadlines Radar Banner (<4h remaining) */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-3xl p-5 sm:p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Flame size={22} className="text-white animate-bounce" />
            </div>
            <div>
              <h3 className="font-black text-lg tracking-tight">
                Approaching SLA Deadlines Radar (&lt; 4 Hours Remaining)
              </h3>
              <p className="text-xs text-white/90">
                Priority tickets requiring rapid field intervention to prevent auto-escalation to Level 2
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-white text-orange-700 font-mono font-black text-xs">
            {approachingDeadlines.length} Immediate Risks
          </span>
        </div>

        {/* Approaching Deadlines Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
          {approachingDeadlines.map((item) => (
            <div
              key={item.id}
              className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-xs space-y-2 hover:bg-white/15 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-white bg-black/20 px-2 py-0.5 rounded">
                  {item.trackingCode}
                </span>
                <span className="font-mono font-black text-yellow-200 bg-red-950/40 px-2 py-0.5 rounded flex items-center gap-1">
                  <Clock size={11} /> {item.remainingHours}h left
                </span>
              </div>

              <h4 className="font-bold text-white leading-snug line-clamp-2">{item.title}</h4>

              <div className="pt-1 border-t border-white/15 flex items-center justify-between text-[11px] text-white/80">
                <span>{item.ward}</span>
                <span className="font-semibold">{item.assignedOfficer}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Tabs by Escalation Level */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Breaches ({breachedClusters.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('l1')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'l1'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Level 1: Ward ({l1Items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('l2')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'l2'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-red-50 text-red-800 hover:bg-red-100'
            }`}
          >
            Level 2: Dept Head ({l2Items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('l3')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'l3'
                ? 'bg-purple-900 text-white shadow-sm'
                : 'bg-purple-50 text-purple-900 hover:bg-purple-100'
            }`}
          >
            Level 3: Vigilance ({l3Items.length})
          </button>
        </div>

        {escalationNoticeSent && (
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 animate-fade-in flex items-center gap-1">
            <CheckCircle2 size={13} />
            Formal Notice Dispatched to {escalationNoticeSent}
          </span>
        )}
      </div>

      {/* Grouped Escalation Sections */}
      <div className="space-y-6">
        {/* Level 3: Municipal Commissioner / Vigilance Inquiry */}
        {(activeTab === 'all' || activeTab === 'l3') && l3Items.length > 0 && (
          <div className="bg-white rounded-3xl border border-purple-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={18} className="text-purple-300" />
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider">
                    Escalation Level 3 (&gt;48 Hours Overdue) &bull; City Vigilance & Commissioner Oversight
                  </h4>
                  <p className="text-[11px] text-purple-200">
                    Mandatory Section 6(1) RTI Inquiry triggered & explanation notice served to Department Head
                  </p>
                </div>
              </div>
              <span className="font-mono font-black bg-purple-950/80 px-3 py-1 rounded-full text-xs">
                {l3Items.length} Severe
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {l3Items.map((item) => (
                <div key={item.id} className="p-5 hover:bg-purple-50/20 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-purple-900 text-sm">
                        {item.trackingCode}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[10px] uppercase">
                        {item.urgency}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                        +{item.overdueHours}h Overdue
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendNotice(item.trackingCode)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                      >
                        <Send size={12} />
                        <span>Issue Vigilance Memo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectCluster?.(item.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
                      >
                        <span>Inspect</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>

                  <h5 className="font-bold text-gray-900 text-sm">{item.title}</h5>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-purple-50/50 p-3 rounded-xl border border-purple-100">
                    <div>
                      <span className="text-gray-500 block">Department</span>
                      <span className="font-semibold text-gray-800">{item.department}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Ward</span>
                      <span className="font-semibold text-gray-800">{item.ward}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Merged Reports</span>
                      <span className="font-bold text-gray-900">{item.citizenCount} Grievances</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Current Overseer</span>
                      <span className="font-bold text-purple-900">{item.officerRole}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Level 2: Executive Engineer / Department Head (24 to 48h Overdue) */}
        {(activeTab === 'all' || activeTab === 'l2') && l2Items.length > 0 && (
          <div className="bg-white rounded-3xl border border-red-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={18} />
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider">
                    Escalation Level 2 (24 to 48 Hours Overdue) &bull; Executive Engineer & Dept Head Oversight
                  </h4>
                  <p className="text-[11px] text-red-100">
                    SLA breached by Ward Officer; reallocated to Department Head for emergency clearance
                  </p>
                </div>
              </div>
              <span className="font-mono font-black bg-red-950/40 px-3 py-1 rounded-full text-xs">
                {l2Items.length} Breaches
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {l2Items.map((item) => (
                <div key={item.id} className="p-5 hover:bg-red-50/20 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-red-600 text-sm">
                        {item.trackingCode}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[10px] uppercase">
                        {item.urgency}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-red-50 text-red-800 font-bold text-[10px]">
                        +{item.overdueHours}h Overdue
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendNotice(item.trackingCode)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                      >
                        <Send size={12} />
                        <span>Reassign Emergency Team</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectCluster?.(item.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
                      >
                        <span>Inspect</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>

                  <h5 className="font-bold text-gray-900 text-sm">{item.title}</h5>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-red-50/50 p-3 rounded-xl border border-red-100">
                    <div>
                      <span className="text-gray-500 block">Department</span>
                      <span className="font-semibold text-gray-800">{item.department}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Ward</span>
                      <span className="font-semibold text-gray-800">{item.ward}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Merged Reports</span>
                      <span className="font-bold text-gray-900">{item.citizenCount} Grievances</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Escalated To</span>
                      <span className="font-bold text-red-700">{item.assignedOfficer}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Level 1: Ward Officer / Junior Engineer (0 to 24h Overdue) */}
        {(activeTab === 'all' || activeTab === 'l1') && l1Items.length > 0 && (
          <div className="bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock size={18} />
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider">
                    Escalation Level 1 (0 to 24 Hours Overdue) &bull; Ward Officer Field Investigation
                  </h4>
                  <p className="text-[11px] text-amber-100">
                    SLA deadline crossed. Direct SMS reminder delivered to Ward Junior Engineer
                  </p>
                </div>
              </div>
              <span className="font-mono font-black bg-amber-950/40 px-3 py-1 rounded-full text-xs">
                {l1Items.length} In Warning
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {l1Items.map((item) => (
                <div key={item.id} className="p-5 hover:bg-amber-50/20 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-amber-700 text-sm">
                        {item.trackingCode}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                        {item.urgency}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold text-[10px]">
                        +{item.overdueHours}h Overdue
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendNotice(item.trackingCode)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                      >
                        <Send size={12} />
                        <span>Send SMS Ping</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectCluster?.(item.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
                      >
                        <span>Inspect</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>

                  <h5 className="font-bold text-gray-900 text-sm">{item.title}</h5>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                    <div>
                      <span className="text-gray-500 block">Department</span>
                      <span className="font-semibold text-gray-800">{item.department}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Ward</span>
                      <span className="font-semibold text-gray-800">{item.ward}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Merged Reports</span>
                      <span className="font-bold text-gray-900">{item.citizenCount} Grievances</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Assigned Officer</span>
                      <span className="font-bold text-amber-900">{item.assignedOfficer}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
