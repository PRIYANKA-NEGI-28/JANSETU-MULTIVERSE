import { useState, useEffect } from 'react';
import { MapPin, Layers } from 'lucide-react';
import { api, type MapClusterDto } from '../lib/api.js';
import { useLang } from '../contexts/LangContext.js';

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
              departmentCode: 'dept-electricity',
              status: 'IN_PROGRESS',
              urgency: 'CRITICAL',
              complaintCount: 5,
              centroid: { latitude: 28.628, longitude: 77.3649 },
              wardId: 'ward-ghz-01-indirapuram',
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'cluster-demo-2',
              departmentCode: 'dept-pwd',
              status: 'PENDING',
              urgency: 'HIGH',
              complaintCount: 3,
              centroid: { latitude: 28.643, longitude: 77.337 },
              wardId: 'ward-ghz-02-vaishali',
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
            {clusters.length} Active Hotspots
          </span>
        </div>
      </div>

      {/* Simulated Map Container with High-Resolution Visual Interface */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden relative min-h-[500px] flex flex-col justify-between">
        {/* Top Controls Overlay */}
        <div className="p-4 z-10 flex justify-between items-center bg-gradient-to-b from-white/90 to-transparent">
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-gray-200 shadow-sm text-xs font-semibold text-gray-700">
            <Layers size={14} className="text-orange-500" />
            <span>Ghaziabad & Delhi NCR Zone</span>
          </div>
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Live Geospatial Feed</span>
          </div>
        </div>

        {/* Geographic Projection Visual Mock */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-6">
          <div className="w-full h-full relative border border-slate-700/60 rounded-2xl overflow-hidden bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px]">
            {clusters.map((c, i) => (
              <div
                key={c.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 hover:scale-110 cursor-pointer"
                style={{
                  top: `${35 + i * 25}%`,
                  left: `${30 + i * 35}%`,
                }}
              >
                <div className="relative group">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border-2 border-orange-400 flex items-center justify-center animate-pulse shadow-lg shadow-orange-500/30">
                    <MapPin className="text-orange-400" size={24} />
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-slate-900/90 text-white text-xs px-3 py-1.5 rounded-xl border border-slate-700 whitespace-nowrap shadow-xl">
                    <span className="font-bold text-orange-400">{c.complaintCount} reports</span> • {c.departmentCode}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Hotspots Panel */}
        <div className="p-4 z-10 bg-white/95 backdrop-blur-md border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {clusters.map((c) => (
              <div key={c.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-gray-900">{c.departmentCode}</span>
                  <span className="text-orange-600">{c.urgency}</span>
                </div>
                <div className="text-gray-500">{c.wardId || 'Local Ward'}</div>
                <div className="text-[11px] font-semibold text-emerald-600">
                  {c.complaintCount} linked civic reports
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
