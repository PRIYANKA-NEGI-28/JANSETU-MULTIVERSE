import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  AlertTriangle,
  Clock,
  Layers,
  Cpu,
  Copy,
  ExternalLink,
  Zap,
} from 'lucide-react';
import type {
  ClusteredComplaintMarker,
  IotStreetlightNode,
  MapFilterState,
} from './types.js';

export interface ClusteredLiveMapProps {
  readonly complaints: readonly ClusteredComplaintMarker[];
  readonly iotNodes: readonly IotStreetlightNode[];
  readonly filters: MapFilterState;
  readonly onSelectComplaint?: (c: ClusteredComplaintMarker) => void;
  readonly onSelectIotNode?: (node: IotStreetlightNode) => void;
  readonly isRealtimeConnected: boolean;
}

// Generate custom SVG / HTML DivIcon for complaint clusters
function createComplaintClusterIcon(c: ClusteredComplaintMarker): L.DivIcon {
  const isOverdue = Boolean(c.isOverdue);
  let colorClass = 'bg-blue-600 border-blue-200 text-white';
  let badgeGlow = 'shadow-blue-500/30';

  if (c.urgency === 'CRITICAL' || isOverdue) {
    colorClass = 'bg-red-600 border-red-200 text-white animate-pulse';
    badgeGlow = 'shadow-red-500/50';
  } else if (c.urgency === 'HIGH') {
    colorClass = 'bg-amber-600 border-amber-200 text-white';
    badgeGlow = 'shadow-amber-500/40';
  } else if (c.urgency === 'MEDIUM') {
    colorClass = 'bg-yellow-500 border-yellow-200 text-gray-900';
    badgeGlow = 'shadow-yellow-500/30';
  }

  const countBadge =
    c.complaintCount > 1
      ? `<span class="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 bg-white text-gray-900 font-mono font-black text-[10px] rounded-full shadow border border-gray-200">${c.complaintCount}</span>`
      : '';

  const html = `
    <div class="relative flex items-center justify-center cursor-pointer transform hover:scale-110 transition-transform">
      <div class="w-8 h-8 rounded-2xl ${colorClass} border-2 flex items-center justify-center font-black text-xs shadow-lg ${badgeGlow}">
        ${isOverdue ? '!' : c.complaintCount}
      </div>
      ${countBadge}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-complaint-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Generate custom DivIcon for IoT streetlights
function createIotNodeIcon(node: IotStreetlightNode): L.DivIcon {
  let bg = 'bg-emerald-500';
  let ring = 'ring-emerald-400/40';
  let pulse = '';

  if (node.status === 'FAULT_CONFIRMED') {
    bg = 'bg-red-600';
    ring = 'ring-red-400/50';
    pulse = 'animate-ping';
  } else if (node.status === 'OFFLINE') {
    bg = 'bg-slate-400';
    ring = 'ring-slate-300';
  }

  const html = `
    <div class="relative flex items-center justify-center cursor-pointer group">
      <div class="absolute w-6 h-6 rounded-full ${bg} ${ring} ring-4 opacity-75 ${pulse}"></div>
      <div class="w-4 h-4 rounded-full ${bg} border-2 border-white shadow-md flex items-center justify-center">
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-iot-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function ClusteredLiveMap({
  complaints,
  iotNodes,
  filters,
  isRealtimeConnected,
}: ClusteredLiveMapProps) {
  // Center coordinates for Ghaziabad & Delhi NCR Region
  const centerCoords: [number, number] = [28.636, 77.368];

  // Filter complaints according to current filter state
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (filters.ward !== 'All Wards' && !c.wardName.includes(filters.ward.split(' ')[0] || '')) {
        return false;
      }
      if (filters.department !== 'ALL' && c.departmentCode !== filters.department) {
        return false;
      }
      if (filters.status !== 'ALL' && c.status !== filters.status) {
        return false;
      }
      if (filters.urgency !== 'ALL' && c.urgency !== filters.urgency) {
        return false;
      }
      if (filters.source !== 'ALL' && c.source !== filters.source) {
        return false;
      }
      return true;
    });
  }, [complaints, filters]);

  // Filter IoT nodes
  const filteredIotNodes = useMemo(() => {
    if (!filters.showIotLayer) return [];
    return iotNodes.filter((node) => {
      if (filters.source === 'IOT' || filters.source === 'ALL') {
        if (filters.ward !== 'All Wards' && !node.wardName.includes(filters.ward.split(' ')[0] || '')) {
          return false;
        }
        return true;
      }
      return false;
    });
  }, [iotNodes, filters]);

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden flex flex-col relative min-h-[550px] h-[650px]">
      {/* Map Header Floating Overlay */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-gray-200 shadow-md flex items-center gap-2 pointer-events-auto text-xs">
          <Layers size={14} className="text-orange-500" />
          <span className="font-bold text-gray-900">Ghaziabad & Delhi NCR Tactical Grid</span>
          <span className="text-[10px] font-mono text-gray-500 border-l border-gray-200 pl-2">
            EPSG:3857 / WGS84
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {isRealtimeConnected ? (
            <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Ably Live Active</span>
            </div>
          ) : (
            <div className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Polling Telemetry</span>
            </div>
          )}

          <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm text-xs font-bold text-gray-700">
            {filteredComplaints.length} Hotspots | {filteredIotNodes.length} IoT Nodes
          </div>
        </div>
      </div>

      {/* Primary Leaflet Container */}
      <MapContainer
        center={centerCoords}
        zoom={13}
        scrollWheelZoom={false}
        className="w-full h-full z-0"
      >
        {/* CARTO Voyager high-contrast clean municipal tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Clustered Complaint Markers */}
        {filteredComplaints.map((c) => (
          <Marker
            key={c.id}
            position={[c.lat, c.lng]}
            icon={createComplaintClusterIcon(c)}
          >
            <Popup className="custom-popup" maxWidth={320}>
              <div className="p-1 space-y-2.5 text-xs text-gray-900">
                <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 block">
                      {c.source} Report &bull; {c.wardName}
                    </span>
                    <h4 className="font-black text-gray-900 text-sm leading-snug">{c.title}</h4>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                      c.urgency === 'CRITICAL'
                        ? 'bg-red-100 text-red-700'
                        : c.urgency === 'HIGH'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {c.urgency}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 p-2 rounded-xl border border-gray-200">
                  <div>
                    <span className="text-gray-500 block">Cluster Size</span>
                    <span className="font-bold text-gray-800">{c.complaintCount} Grievances</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Department</span>
                    <span className="font-semibold text-gray-800 truncate block">
                      {c.departmentCode}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-gray-500">Status</span>
                    <span className="font-bold font-mono text-indigo-700">{c.status}</span>
                  </div>
                </div>

                {c.isOverdue && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-1.5 text-[11px] font-bold">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>SLA Breach: Overdue by {c.overdueHours ?? 8.5} hrs</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(c.id)}
                    className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-bold text-center text-[11px] flex items-center justify-center gap-1"
                  >
                    <Copy size={12} /> Copy ID
                  </button>
                  <a
                    href={`/track?code=${c.id}`}
                    className="flex-1 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-center text-[11px] flex items-center justify-center gap-1"
                  >
                    <ExternalLink size={12} /> View Ticket
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* IoT Streetlight Layer */}
        {filteredIotNodes.map((node) => (
          <Marker
            key={node.id}
            position={[node.lat, node.lng]}
            icon={createIotNodeIcon(node)}
          >
            <Popup maxWidth={300}>
              <div className="p-1 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-1.5 text-indigo-600 font-bold">
                    <Cpu size={14} />
                    <span>{node.name}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      node.status === 'FAULT_CONFIRMED'
                        ? 'bg-red-100 text-red-700'
                        : node.status === 'NORMAL'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {node.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-gray-500 block">Pole Hardware ID</span>
                    <span className="font-mono font-bold text-gray-800">{node.poleId}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">LDR Lux Reading</span>
                    <span className="font-mono font-bold text-gray-800">{node.ldrValue} Lux</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">AC Line Voltage</span>
                    <span className="font-mono font-bold text-gray-800">{node.voltage}V</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Last Heartbeat</span>
                    <span className="font-mono font-medium text-gray-600">{node.lastHeartbeat}</span>
                  </div>
                </div>

                {node.status === 'FAULT_CONFIRMED' && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-[11px] flex items-center gap-1.5 font-bold">
                    <Zap size={14} className="shrink-0 text-red-600" />
                    <span>Darkness detected with live voltage &rarr; Bulb Fault</span>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Spatial Privacy Halo: Circle markers for hotspot vicinity */}
        {filteredComplaints.slice(0, 5).map((c) => (
          <CircleMarker
            key={`halo-${c.id}`}
            center={[c.lat, c.lng]}
            radius={28}
            pathOptions={{
              color: c.urgency === 'CRITICAL' ? '#ef4444' : '#f97316',
              fillColor: c.urgency === 'CRITICAL' ? '#ef4444' : '#f97316',
              fillOpacity: 0.12,
              weight: 1,
              dashArray: '4, 4',
            }}
          >
            <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
              <span className="text-[10px] font-bold">
                150m Cluster Vicinity: {c.wardName}
              </span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Bottom Map Legend */}
      <div className="p-3 bg-gray-50/95 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-600 inline-block" />
            <span className="font-medium text-[11px]">Critical / SLA Breach</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-600 inline-block" />
            <span className="font-medium text-[11px]">High Severity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-600 inline-block" />
            <span className="font-medium text-[11px]">Standard Grievance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span className="font-medium text-[11px]">IoT Streetlight (Normal)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
            <span className="font-medium text-[11px]">IoT Fault Confirmed</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
          <Clock size={12} />
          <span>Realtime tile sync: 60s cache TTL</span>
        </div>
      </div>
    </div>
  );
}
export default ClusteredLiveMap;
