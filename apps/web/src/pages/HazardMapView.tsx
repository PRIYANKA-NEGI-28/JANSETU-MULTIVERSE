import { useState, useEffect, lazy, Suspense } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { api, type MapClusterDto } from '../lib/api.js';
import { useLang } from '../contexts/LangContext.js';
import type { ClusteredComplaintMarker, MapFilterState } from './admin/types.js';

const DEFAULT_HAZARD_CLUSTERS: readonly MapClusterDto[] = [
  {
    id: 'cluster-demo-1',
    title: 'High voltage wire hanging',
    departmentCode: 'Municipal Corporation - Electrical Division',
    status: 'IN_PROGRESS',
    urgency: 'CRITICAL',
    complaintCount: 5,
    centroid: { lat: 28.636, lng: 77.371 },
    wardId: 'Ghaziabad Ward 1 (Indirapuram)',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cluster-demo-2',
    title: 'Severe road cave-in and potholes',
    departmentCode: 'Public Works Department (PWD)',
    status: 'PENDING',
    urgency: 'HIGH',
    complaintCount: 3,
    centroid: { lat: 28.643, lng: 77.337 },
    wardId: 'Ghaziabad Ward 2 (Vaishali)',
    updatedAt: new Date().toISOString(),
  },
];

function getHazardLat(centroid: MapClusterDto['centroid'], fallback: number): number {
  if (typeof centroid.lat === 'number') return centroid.lat;
  if (typeof centroid.latitude === 'number') return centroid.latitude;
  return fallback;
}

function getHazardLng(centroid: MapClusterDto['centroid'], fallback: number): number {
  if (typeof centroid.lng === 'number') return centroid.lng;
  if (typeof centroid.longitude === 'number') return centroid.longitude;
  return fallback;
}

const ClusteredLiveMap = lazy(() => import('./admin/ClusteredLiveMap.js'));

export default function HazardMapView() {
  const { T } = useLang();
  const [clusters, setClusters] = useState<readonly MapClusterDto[]>([]);

  useEffect(() => {
    let mounted = true;
    async function fetchClusters() {
      try {
        const res = await api.clusters.getMapClusters();
        if (mounted && res?.clusters) {
          setClusters(res.clusters);
        }
      } catch {
        if (mounted) {
          setClusters([
            {
              id: 'cluster-demo-1',
              departmentCode: 'Municipal Corporation - Electrical Division',
              status: 'IN_PROGRESS',
              urgency: 'CRITICAL',
              complaintCount: 5,
              centroid: { lat: 28.636, lng: 77.371 },
              wardId: 'Ghaziabad Ward 1 (Indirapuram)',
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'cluster-demo-2',
              departmentCode: 'Public Works Department (PWD)',
              status: 'PENDING',
              urgency: 'HIGH',
              complaintCount: 3,
              centroid: { lat: 28.643, lng: 77.337 },
              wardId: 'Ghaziabad Ward 2 (Vaishali)',
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'cluster-demo-3',
              departmentCode: 'Delhi Jal Board / Water Supply Department',
              status: 'ESCALATED',
              urgency: 'CRITICAL',
              complaintCount: 6,
              centroid: { lat: 28.662, lng: 77.374 },
              wardId: 'Ghaziabad Ward 12 (Vasundhara)',
              updatedAt: new Date().toISOString(),
            },
          ]);
        }
      }
    }
    void fetchClusters();
    return () => {
      mounted = false;
    };
  }, []);

  const activeList = clusters.length > 0 ? clusters : DEFAULT_HAZARD_CLUSTERS;
  const complaintMarkers: readonly ClusteredComplaintMarker[] = activeList.map((c, i) => ({
    id: c.id,
    clusterId: c.id,
    title: c.title || `Spatial cluster in ${c.wardId || 'Ward Area'}`,
    departmentCode: c.departmentCode || 'Public Works Department (PWD)',
    departmentName: String(c.departmentCode || 'Public Works Department (PWD)'),
    wardId: c.wardId || `ward-0${i + 1}`,
    wardName: c.wardId || 'Ghaziabad Municipal Area',
    lat: getHazardLat(c.centroid, 28.636),
    lng: getHazardLng(c.centroid, 77.371),
    urgency: c.urgency ?? 'HIGH',
    status: c.status,
    source: 'WEB',
    complaintCount: c.complaintCount,
  }));

  const publicFilterState: MapFilterState = {
    ward: 'All Wards',
    department: 'ALL',
    status: 'ALL',
    urgency: 'ALL',
    source: 'ALL',
    showIotLayer: true,
    showClustersOnly: false,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {T['nav_hazard_map'] || 'Civic Hazard & Cluster Map'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Real-time geospatial hotspot intelligence clustering multiple grievances within 150m radius
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl">
            {complaintMarkers.length} Active Hotspots
          </span>
        </div>
      </div>

      {/* Clustered Live Map Container */}
      <Suspense
        fallback={
          <div className="h-[600px] w-full rounded-3xl bg-gray-100 border border-gray-200 animate-pulse flex flex-col items-center justify-center text-gray-400 gap-2">
            <RefreshCw className="animate-spin text-orange-500" size={28} />
            <span className="text-xs font-bold">Loading Map Tiles & Clustered Hotspots...</span>
          </div>
        }
      >
        <ClusteredLiveMap
          complaints={complaintMarkers}
          iotNodes={[]}
          filters={publicFilterState}
          isRealtimeConnected={false}
        />
      </Suspense>

      {/* Bottom Summary Hotspots Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {complaintMarkers.map((c) => (
          <div
            key={c.id}
            className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm text-xs space-y-1.5"
          >
            <div className="flex justify-between items-center font-bold">
              <span className="text-gray-900 truncate">{c.departmentName}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  c.urgency === 'CRITICAL'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {c.urgency}
              </span>
            </div>
            <div className="text-gray-500 font-medium flex items-center gap-1">
              <Layers size={12} className="text-gray-400" />
              <span>{c.wardName}</span>
            </div>
            <div className="text-[11px] font-bold text-emerald-600 pt-1 border-t border-gray-100">
              {c.complaintCount} linked civic reports &bull; Status: {c.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
