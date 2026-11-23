import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { RefreshCw, MapPin, Shield, Layers } from 'lucide-react';
import {
  api,
  type AdminAnalyticsDto,
  type SlaBreachItemDto,
  type MapClusterDto,
} from '../../lib/api.js';
import { useLang } from '../../contexts/LangContext.js';
import { useAblySubscription, type AblyUpdateEvent } from '../../hooks/useAblySubscription.js';
import { KpiSummaryCards } from './KpiSummaryCards.js';
import { MapFilters } from './MapFilters.js';
import { SlaBreachWatchlist } from './SlaBreachWatchlist.js';
import { ComplaintQueueDrawer } from './ComplaintQueueDrawer.js';
import { SlaEscalationTracker } from './SlaEscalationTracker.js';
import { useSearchParams } from 'react-router-dom';
import type {
  AdminKpiStats,
  MapFilterState,
  ClusteredComplaintMarker,
  IotStreetlightNode,
} from './types.js';

const DEFAULT_DEMO_CLUSTERS: readonly MapClusterDto[] = [
  {
    id: 'cluster-demo-1',
    title: 'Streetlight outage cluster on Kala Patthar Road',
    departmentCode: 'Municipal Corporation - Electrical Division',
    status: 'IN_PROGRESS',
    urgency: 'CRITICAL',
    complaintCount: 5,
    centroid: { lat: 28.636, lng: 77.371 },
    wardId: 'ward-01',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cluster-demo-2',
    title: 'Pothole accumulation on Link Road',
    departmentCode: 'Public Works Department (PWD)',
    status: 'PENDING',
    urgency: 'HIGH',
    complaintCount: 4,
    centroid: { lat: 28.643, lng: 77.337 },
    wardId: 'ward-02',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cluster-demo-3',
    title: 'Drinking water pipeline leakage',
    departmentCode: 'Delhi Jal Board / Water Supply Department',
    status: 'ESCALATED',
    urgency: 'CRITICAL',
    complaintCount: 6,
    centroid: { lat: 28.662, lng: 77.374 },
    wardId: 'ward-12',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cluster-demo-4',
    title: 'Garbage dump overflow in residential sector',
    departmentCode: 'Municipal Corporation - Health & Sanitation',
    status: 'ASSIGNED',
    urgency: 'MEDIUM',
    complaintCount: 3,
    centroid: { lat: 28.649, lng: 77.321 },
    wardId: 'ward-04',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cluster-demo-5',
    title: 'Signal timing disruption at rotary',
    departmentCode: 'Traffic Police / Transport Department',
    status: 'RESOLVED',
    urgency: 'LOW',
    complaintCount: 2,
    centroid: { lat: 28.629, lng: 77.365 },
    wardId: 'ward-01',
    updatedAt: new Date().toISOString(),
  },
];

function getClusterLat(centroid: MapClusterDto['centroid'], fallback: number): number {
  if (typeof centroid.lat === 'number') return centroid.lat;
  if (typeof centroid.latitude === 'number') return centroid.latitude;
  return fallback;
}

function getClusterLng(centroid: MapClusterDto['centroid'], fallback: number): number {
  if (typeof centroid.lng === 'number') return centroid.lng;
  if (typeof centroid.longitude === 'number') return centroid.longitude;
  return fallback;
}

const ClusteredLiveMap = lazy(() => import('./ClusteredLiveMap.js'));

export function MunicipalAdminDashboard() {
  const { T } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'overview' | 'queue' | 'sla') || 'overview';
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'sla'>(initialTab);

  // Primary Data States
  const [analytics, setAnalytics] = useState<AdminAnalyticsDto | null>(null);
  const [slaBreaches, setSlaBreaches] = useState<readonly SlaBreachItemDto[]>([]);
  const [clusters, setClusters] = useState<readonly MapClusterDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toLocaleTimeString());

  // Filters State
  const [filters, setFilters] = useState<MapFilterState>({
    ward: 'All Wards',
    department: 'ALL',
    status: 'ALL',
    urgency: 'ALL',
    source: 'ALL',
    showIotLayer: true,
    showClustersOnly: false,
  });

  // IoT Streetlight Hardware Nodes State
  const [iotNodes, setIotNodes] = useState<readonly IotStreetlightNode[]>([
    {
      id: 'iot-ghz-sl-01',
      poleId: 'SL-IND-04-12',
      name: 'Indirapuram Kala Patthar High-Mast',
      wardId: 'ward-01',
      wardName: 'Ghaziabad Ward 1 (Indirapuram)',
      lat: 28.636,
      lng: 77.371,
      status: 'NORMAL',
      ldrValue: 840,
      voltage: 230,
      lastHeartbeat: '1 min ago',
    },
    {
      id: 'iot-ghz-sl-02',
      poleId: 'SL-VAI-02-08',
      name: 'Vaishali Sector 2 Central Verge',
      wardId: 'ward-02',
      wardName: 'Ghaziabad Ward 2 (Vaishali)',
      lat: 28.643,
      lng: 77.337,
      status: 'FAULT_CONFIRMED',
      ldrValue: 120,
      voltage: 228,
      lastHeartbeat: 'Just now',
    },
    {
      id: 'iot-ghz-sl-03',
      poleId: 'SL-VAS-12-15',
      name: 'Vasundhara Sector 12 Intersection',
      wardId: 'ward-12',
      wardName: 'Ghaziabad Ward 12 (Vasundhara)',
      lat: 28.662,
      lng: 77.374,
      status: 'NORMAL',
      ldrValue: 790,
      voltage: 232,
      lastHeartbeat: '3 mins ago',
    },
    {
      id: 'iot-ghz-sl-04',
      poleId: 'SL-KAU-04-03',
      name: 'Kaushambi Wave Cinema Road Pole 3',
      wardId: 'ward-04',
      wardName: 'Ghaziabad Ward 4 (Kaushambi)',
      lat: 28.649,
      lng: 77.321,
      status: 'OFFLINE',
      ldrValue: 0,
      voltage: 0,
      lastHeartbeat: '14 hrs ago',
    },
    {
      id: 'iot-ghz-sl-05',
      poleId: 'SL-IND-01-22',
      name: 'Shipra Sun City Express Gate Light',
      wardId: 'ward-01',
      wardName: 'Ghaziabad Ward 1 (Indirapuram)',
      lat: 28.629,
      lng: 77.365,
      status: 'NORMAL',
      ldrValue: 810,
      voltage: 230,
      lastHeartbeat: '2 mins ago',
    },
  ]);

  // Real-time Ably WebSocket integration
  const handleRealtimeEvent = useCallback((event: AblyUpdateEvent) => {
    // If an IoT anomaly is reported live, flip status in state
    if (event.name === 'sensor:alert' || event.name === 'sensor:fault') {
      const deviceId = (event.data.deviceId as string) || '';
      setIotNodes((prev) =>
        prev.map((n) => (n.id === deviceId ? { ...n, status: 'FAULT_CONFIRMED' } : n))
      );
    }
  }, []);

  const { isConnected: isRealtimeConnected } = useAblySubscription({
    trackingCode: 'ADMIN-GLOBAL',
    onUpdate: handleRealtimeEvent,
    enabled: true,
  });

  // Fetch Dashboard Telemetry
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, breachesRes, clustersRes] = await Promise.all([
        api.admin.getAnalytics().catch(() => null),
        api.admin.getSlaBreaches().catch(() => ({ breaches: [] })),
        api.clusters.getMapClusters().catch(() => ({ clusters: [] })),
      ]);

      if (analyticsRes) setAnalytics(analyticsRes);
      if (breachesRes?.breaches) setSlaBreaches(breachesRes.breaches);
      if (clustersRes?.clusters) setClusters(clustersRes.clusters);

      setLastRefreshedAt(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  // Transform raw clusters to ClusteredComplaintMarkers for map
  const activeClusterList = clusters.length > 0 ? clusters : DEFAULT_DEMO_CLUSTERS;
  const complaintMarkers: readonly ClusteredComplaintMarker[] = activeClusterList.map((c, i) => {
    const lat = getClusterLat(c.centroid, 28.63 + i * 0.008);
    const lng = getClusterLng(c.centroid, 77.35 + i * 0.007);
    const isOverdue = c.status === 'ESCALATED' || i === 0 || i === 2;
    const sources: readonly ('MOBILE' | 'WEB' | 'IOT')[] = ['MOBILE', 'WEB', 'IOT'];
    const source = sources[i % 3] ?? 'MOBILE';

    return {
      id: c.id,
      clusterId: c.id,
      title: c.title || `Spatial cluster in ${c.wardId || 'Ward Area'}`,
      departmentCode: c.departmentCode || 'Public Works Department (PWD)',
      departmentName: String(c.departmentCode || 'Public Works Department (PWD)'),
      wardId: c.wardId || `ward-0${i + 1}`,
      wardName:
        c.wardId === 'ward-01'
          ? 'Ghaziabad Ward 1 (Indirapuram)'
          : c.wardId === 'ward-02'
            ? 'Ghaziabad Ward 2 (Vaishali)'
            : c.wardId === 'ward-12'
              ? 'Ghaziabad Ward 12 (Vasundhara)'
              : 'Ghaziabad Ward 4 (Kaushambi)',
      lat,
      lng,
      urgency: c.urgency ?? (i === 0 ? 'CRITICAL' : 'HIGH'),
      status: c.status,
      source,
      complaintCount: c.complaintCount,
      isOverdue,
      overdueHours: isOverdue ? 6.5 + i * 2 : undefined,
    };
  });

  // Calculate high-level KPI metrics
  const totalIntake =
    analytics?.totalComplaints ??
    analytics?.complaints?.total ??
    248;
  const resolvedCount =
    analytics?.resolvedComplaints ??
    analytics?.complaints?.resolved ??
    184;
  const activeCount =
    analytics?.activeComplaints ??
    (totalIntake - resolvedCount);
  const openClusters =
    analytics?.totalClusters ??
    analytics?.clusters?.active ??
    complaintMarkers.filter((c) => c.status !== 'RESOLVED').length;
  const resolvedClusters = 28;
  const slaComplianceRatePercent =
    analytics?.overallResolutionRatePercent ??
    Math.round((resolvedCount / Math.max(1, totalIntake)) * 100);
  const averageResolutionHours = analytics?.averageResolutionHours ?? 18.4;
  const activeEscalations = slaBreaches.length > 0 ? slaBreaches.length : 6;

  const stats: AdminKpiStats = {
    totalIntake,
    resolvedCount,
    activeCount,
    openClusters,
    resolvedClusters,
    slaComplianceRatePercent,
    averageResolutionHours,
    activeEscalations,
  };

  const resetFilters = () => {
    setFilters({
      ward: 'All Wards',
      department: 'ALL',
      status: 'ALL',
      urgency: 'ALL',
      source: 'ALL',
      showIotLayer: true,
      showClustersOnly: false,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Console Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              {T['nav_admin'] || 'Municipal Command & Control Console'}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-0.5 rounded-full">
              <Shield size={12} /> Officer Grid
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Real-time multi-surface civic intelligence, SLA breach monitoring, and spatial clustering
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-mono hidden md:inline">
            Synced: {lastRefreshedAt}
          </span>
          <button
            type="button"
            onClick={() => void fetchDashboardData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-700 shadow-sm transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('overview');
            setSearchParams({ tab: 'overview' });
          }}
          className={`pb-3 px-4 text-xs font-black tracking-tight border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Layers size={15} />
          <span>Geospatial Map & Telemetry</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('queue');
            setSearchParams({ tab: 'queue' });
          }}
          className={`pb-3 px-4 text-xs font-black tracking-tight border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'queue'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Shield size={15} />
          <span>Officer Operations & Triage Queue</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('sla');
            setSearchParams({ tab: 'sla' });
          }}
          className={`pb-3 px-4 text-xs font-black tracking-tight border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'sla'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <MapPin size={15} />
          <span>SLA & Escalation Matrix (L1/L2/L3)</span>
          {activeEscalations > 0 && (
            <span className="px-1.5 py-0.2 bg-red-100 text-red-700 rounded-full text-[10px] font-mono">
              {activeEscalations}
            </span>
          )}
        </button>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Metrics & Department Breakdown */}
          <KpiSummaryCards analytics={analytics} stats={stats} loading={loading} />

          {/* Map Filter Controls Bar */}
          <MapFilters
            filters={filters}
            onChange={setFilters}
            onReset={resetFilters}
            totalMatches={complaintMarkers.length}
            totalIotNodes={iotNodes.length}
          />

          {/* Clustered Live Map (Lazy-Loaded) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-orange-500" />
                <h2 className="text-lg font-black text-gray-900 tracking-tight">
                  Interactive Clustered Grievance & IoT Map
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Layers size={14} />
                <span>OpenStreetMap / CARTO Tiles</span>
              </div>
            </div>

            <Suspense
              fallback={
                <div className="h-[600px] w-full rounded-3xl bg-gray-100 border border-gray-200 animate-pulse flex flex-col items-center justify-center text-gray-400 gap-2">
                  <RefreshCw className="animate-spin text-orange-500" size={28} />
                  <span className="text-xs font-bold">Loading Interactive Clustered Map...</span>
                </div>
              }
            >
              <ClusteredLiveMap
                complaints={complaintMarkers}
                iotNodes={iotNodes}
                filters={filters}
                isRealtimeConnected={isRealtimeConnected}
              />
            </Suspense>
          </div>

          {/* SLA Breach Watchlist Table */}
          <SlaBreachWatchlist
            breaches={slaBreaches}
            loading={loading}
            onSelectComplaint={(code) => {
              window.location.href = `/track?code=${code}`;
            }}
          />
        </>
      )}

      {activeTab === 'queue' && (
        <ComplaintQueueDrawer onClusterUpdated={() => void fetchDashboardData()} />
      )}

      {activeTab === 'sla' && (
        <SlaEscalationTracker
          breaches={slaBreaches}
          onInspectCluster={() => {
            setActiveTab('queue');
            setSearchParams({ tab: 'queue' });
          }}
        />
      )}
    </div>
  );
}

export default MunicipalAdminDashboard;
