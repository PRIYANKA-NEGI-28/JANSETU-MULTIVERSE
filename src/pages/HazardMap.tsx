import { useState, useRef, useCallback, useEffect } from 'react';
import {
  MapPin, Camera, Upload, AlertTriangle, Zap, X, CheckCircle,
  Filter, Layers,
  Users, TrendingUp, Clock, ArrowRight,
  Zap as ElectricIcon, Circle as PotholeIcon, Droplets, Building, Flame,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LOCATIONS, CITY_OPTIONS } from '../lib/locations';
import type { Page } from '../types';
import { useLang } from '../lib/langContext';
import { useDashboard } from '../contexts/DashboardContext';
import ScrollReveal from '../components/ScrollReveal';
import CountUp from '../components/CountUp';
import { Magnetic } from '../components/MouseInteractions';

interface HazardReport {
  id: string;
  lat: number;
  lng: number;
  type: 'wire' | 'pothole' | 'flood' | 'collapse' | 'fire_hazard';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  photoUrl: string | null;
  reporterName: string;
  area: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  clusterSize: number;
  createdAt: string;
}

interface Cluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: string;
  area: string;
  reports: HazardReport[];
}

const HAZARD_TYPES = [
  { value: 'wire', labelKey: 'hazard_type_wire' as const, icon: <ElectricIcon size={14} />, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  { value: 'pothole', labelKey: 'hazard_type_pothole' as const, icon: <PotholeIcon size={14} />, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  { value: 'flood', labelKey: 'hazard_type_flood' as const, icon: <Droplets size={14} />, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  { value: 'collapse', labelKey: 'hazard_type_collapse' as const, icon: <Building size={14} />, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  { value: 'fire_hazard', labelKey: 'hazard_type_fire' as const, icon: <Flame size={14} />, color: 'text-red-700', bg: 'bg-red-100 border-red-300' },
] as const;

const SEV_COLOR: Record<string, string> = {
  LOW: 'bg-blue-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-600',
};

const SEV_TEXT: Record<string, string> = {
  LOW: 'text-blue-700 bg-blue-100',
  MEDIUM: 'text-yellow-700 bg-yellow-100',
  HIGH: 'text-orange-700 bg-orange-100',
  CRITICAL: 'text-red-700 bg-red-100',
};

// Seed data for demo — real Delhi/Ghaziabad coordinates
const SEED_REPORTS: HazardReport[] = [
  { id: 'h1', lat: 28.6139, lng: 77.2090, type: 'wire', severity: 'CRITICAL', description: 'Loose live wire hanging 3 feet off ground near school gate', reporterName: 'Priya Sharma', area: 'Connaught Place', status: 'OPEN', clusterSize: 4, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), photoUrl: 'https://images.pexels.com/photos/1108101/pexels-photo-1108101.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { id: 'h2', lat: 28.6145, lng: 77.2100, type: 'wire', severity: 'HIGH', description: 'Overhead cable snapped after rain, hanging over road', reporterName: 'Ravi Kumar', area: 'Connaught Place', status: 'OPEN', clusterSize: 4, createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), photoUrl: null },
  { id: 'h3', lat: 28.6130, lng: 77.2080, type: 'wire', severity: 'CRITICAL', description: 'Sparking electrical wire on footpath, danger to pedestrians', reporterName: 'Anita Singh', area: 'Connaught Place', status: 'ACKNOWLEDGED', clusterSize: 4, createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), photoUrl: null },
  { id: 'h4', lat: 28.6150, lng: 77.2095, type: 'wire', severity: 'HIGH', description: 'Telecom cable hanging low, vehicles hitting it', reporterName: 'Suresh Gupta', area: 'Connaught Place', status: 'OPEN', clusterSize: 4, createdAt: new Date(Date.now() - 86400000 * 0.5).toISOString(), photoUrl: null },
  { id: 'h5', lat: 28.5672, lng: 77.2100, type: 'pothole', severity: 'HIGH', description: 'Giant pothole on main road, 2 bikes already fell', reporterName: 'Deepak Joshi', area: 'Lajpat Nagar', status: 'OPEN', clusterSize: 3, createdAt: new Date(Date.now() - 86400000 * 1.5).toISOString(), photoUrl: 'https://images.pexels.com/photos/2244746/pexels-photo-2244746.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { id: 'h6', lat: 28.5680, lng: 77.2115, type: 'pothole', severity: 'MEDIUM', description: 'Series of potholes after monsoon, road completely damaged', reporterName: 'Meena Rao', area: 'Lajpat Nagar', status: 'OPEN', clusterSize: 3, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), photoUrl: null },
  { id: 'h7', lat: 28.5660, lng: 77.2090, type: 'pothole', severity: 'HIGH', description: 'Deep crater near traffic signal, causing traffic jams', reporterName: 'Vikas Malhotra', area: 'Lajpat Nagar', status: 'OPEN', clusterSize: 3, createdAt: new Date(Date.now() - 86400000 * 0.8).toISOString(), photoUrl: null },
  { id: 'h8', lat: 28.6280, lng: 77.2165, type: 'flood', severity: 'CRITICAL', description: 'Street completely waterlogged, knee-deep water, vehicles stranded', reporterName: 'Kavita Nair', area: 'Karol Bagh', status: 'OPEN', clusterSize: 5, createdAt: new Date(Date.now() - 86400000 * 0.3).toISOString(), photoUrl: 'https://images.pexels.com/photos/1118873/pexels-photo-1118873.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { id: 'h9', lat: 28.6290, lng: 77.2175, type: 'flood', severity: 'HIGH', description: 'Sewage overflow mixing with floodwater, health hazard', reporterName: 'Ajay Verma', area: 'Karol Bagh', status: 'OPEN', clusterSize: 5, createdAt: new Date(Date.now() - 86400000 * 0.4).toISOString(), photoUrl: null },
  { id: 'h10', lat: 28.6270, lng: 77.2155, type: 'flood', severity: 'CRITICAL', description: 'Flooded underpass, cars submerged, no warning signs', reporterName: 'Pooja Tiwari', area: 'Karol Bagh', status: 'ACKNOWLEDGED', clusterSize: 5, createdAt: new Date(Date.now() - 86400000 * 0.2).toISOString(), photoUrl: null },
  { id: 'h11', lat: 28.7041, lng: 77.1025, type: 'collapse', severity: 'CRITICAL', description: 'Old building wall showing major cracks, may collapse any time', reporterName: 'Ramesh Chand', area: 'Rohini Sector 3', status: 'OPEN', clusterSize: 1, createdAt: new Date(Date.now() - 86400000 * 0.1).toISOString(), photoUrl: null },
  { id: 'h12', lat: 28.6304, lng: 77.2177, type: 'fire_hazard', severity: 'HIGH', description: 'Gas cylinder shop next to open electrical switchboard, extreme fire risk', reporterName: 'Nisha Patel', area: 'Paharganj', status: 'OPEN', clusterSize: 2, createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), photoUrl: null },
  // Ghaziabad
  { id: 'h13', lat: 28.6358, lng: 77.3641, type: 'wire', severity: 'HIGH', description: 'Broken street light pole with exposed wires on main road', reporterName: 'Sanjay Kumar', area: 'Indirapuram', status: 'OPEN', clusterSize: 2, createdAt: new Date(Date.now() - 86400000 * 1.2).toISOString(), photoUrl: null },
  { id: 'h14', lat: 28.6370, lng: 77.3650, type: 'pothole', severity: 'MEDIUM', description: 'Multiple potholes on sector road, auto rickshaws struggling', reporterName: 'Sunita Yadav', area: 'Vaishali Sector 4', status: 'OPEN', clusterSize: 2, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), photoUrl: null },
];

function buildClusters(reports: HazardReport[]): Cluster[] {
  const threshold = 0.003; // ~300m radius
  const used = new Set<string>();
  const clusters: Cluster[] = [];

  for (const r of reports) {
    if (used.has(r.id)) continue;
    const nearby = reports.filter(o =>
      !used.has(o.id) &&
      Math.abs(o.lat - r.lat) < threshold &&
      Math.abs(o.lng - r.lng) < threshold
    );
    nearby.forEach(o => used.add(o.id));
    const sevOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const maxSev = nearby.reduce((best, o) =>
      sevOrder.indexOf(o.severity) > sevOrder.indexOf(best) ? o.severity : best, 'LOW' as HazardReport['severity']);
    clusters.push({
      id: r.id,
      lat: nearby.reduce((s, o) => s + o.lat, 0) / nearby.length,
      lng: nearby.reduce((s, o) => s + o.lng, 0) / nearby.length,
      count: nearby.length,
      severity: maxSev,
      type: r.type,
      area: r.area,
      reports: nearby,
    });
  }
  return clusters;
}

import type { AuthUser } from '../lib/auth';

interface HazardMapProps {
  onNavigate: (page: Page) => void;
  user?: AuthUser | null;
}

export default function HazardMap({ onNavigate, user }: HazardMapProps) {
  const { T } = useLang();
  const { sensorAlerts, complaints } = useDashboard();
  
  // Create a combined list of hazards from real context state
  // We'll map sensorAlerts and complaints to the HazardReport interface
  const mapIssueToHazard = (issueStr: string = ''): 'wire' | 'pothole' | 'flood' | 'collapse' | 'fire_hazard' => {
    const s = issueStr.toLowerCase();
    if (s.includes('water') || s.includes('flood') || s.includes('drain') || s.includes('sewage') || s.includes('leak')) return 'flood';
    if (s.includes('wire') || s.includes('electric') || s.includes('cable') || s.includes('power')) return 'wire';
    if (s.includes('fire') || s.includes('smoke') || s.includes('burn') || s.includes('gas')) return 'fire_hazard';
    if (s.includes('collapse') || s.includes('crack') || s.includes('building') || s.includes('wall') || s.includes('tree') || s.includes('fall')) return 'collapse';
    return 'pothole'; // Default fallback
  };

  const dynamicReports: HazardReport[] = [
    ...complaints.map(c => ({
      id: c.id,
      lat: (c as any).lat || 28.6139 + (Math.random() - 0.5) * 0.05,
      lng: (c as any).lng || 77.2090 + (Math.random() - 0.5) * 0.05,
      type: mapIssueToHazard(c.issue_type),
      severity: c.urgency,
      description: c.summary,
      photoUrl: null,
      reporterName: c.citizen_name,
      area: c.area,
      status: (c.status === 'RESOLVED' ? 'RESOLVED' : c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS' ? 'ACKNOWLEDGED' : 'OPEN') as any,
      clusterSize: c.similar_count || 1,
      createdAt: c.created_at,
    })),
    ...sensorAlerts.map(s => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      type: s.type as any,
      severity: s.severity,
      description: s.description,
      photoUrl: null,
      reporterName: 'Automated Sensor',
      area: s.area,
      status: 'OPEN' as const,
      clusterSize: 1,
      createdAt: s.createdAt,
    }))
  ];
  
  // Use dynamicReports instead of SEED_REPORTS if they exist
  const initialReports = dynamicReports.length > 0 ? dynamicReports : SEED_REPORTS;

  const [reports, setReports] = useState<HazardReport[]>(initialReports);
  const [clusters, setClusters] = useState<Cluster[]>(() => buildClusters(initialReports));
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSev, setFilterSev] = useState<string>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    type: 'wire' as HazardReport['type'],
    severity: 'HIGH' as HazardReport['severity'],
    description: '',
    reporterName: '',
    area: 'Connaught Place',
    photoFile: null as File | null,
    photoPreview: null as string | null,
    useGPS: false,
    lat: 28.6139,
    lng: 77.2090,
  });

  useEffect(() => {
    if (dynamicReports.length > 0 && dynamicReports.length !== reports.length) {
      setReports(dynamicReports);
      setClusters(buildClusters(dynamicReports));
    }
  }, [complaints, sensorAlerts]);

  const handlePhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, photoFile: file, photoPreview: ev.target?.result as string }));
    reader.readAsDataURL(file);
  }, []);

  function handleGetGPS() {
    navigator.geolocation?.getCurrentPosition(pos => {
      setForm(f => ({ ...f, useGPS: true, lat: pos.coords.latitude, lng: pos.coords.longitude }));
    }, () => {
      // fall back to default
    });
  }

  function handleSubmit() {
    if (!form.description.trim() || !form.reporterName.trim()) return;
    const newReport: HazardReport = {
      id: `h${Date.now()}`,
      lat: form.lat + (Math.random() - 0.5) * 0.002,
      lng: form.lng + (Math.random() - 0.5) * 0.002,
      type: form.type,
      severity: form.severity,
      description: form.description,
      reporterName: form.reporterName,
      area: form.area,
      status: 'OPEN',
      clusterSize: 1,
      createdAt: new Date().toISOString(),
      photoUrl: form.photoPreview,
    };
    const updated = [newReport, ...reports];
    setReports(updated);
    setClusters(buildClusters(updated));
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setShowForm(false); setForm(f => ({ ...f, description: '', photoFile: null, photoPreview: null })); }, 2500);
  }

  const visibleClusters = clusters.filter(c => {
    const matchType = filterType === 'ALL' || c.reports.some(r => r.type === filterType);
    const matchSev = filterSev === 'ALL' || c.severity === filterSev;
    return matchType && matchSev;
  });

  const totalOpen = reports.filter(r => r.status === 'OPEN').length;
  const criticalZones = clusters.filter(c => c.severity === 'CRITICAL').length;
  const totalAffected = clusters.reduce((s, c) => s + c.count, 0);

  const typeInfo = (type: string) => HAZARD_TYPES.find(t => t.value === type) || HAZARD_TYPES[0];

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-start justify-between gap-4">
          <ScrollReveal direction="up" delay={100}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-xs font-bold text-red-500 uppercase tracking-widest">{T.hazard_live}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">{T.hazard_title}</h1>
              <p className="text-gray-500 text-sm max-w-xl">{T.hazard_subtitle}</p>
            </div>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={150}>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 text-gray-600 text-sm font-semibold">
                <Filter size={14} /> {T.hazard_filter}:
              </div>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="text-sm bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-transparent input-premium"
              >
                <option value="ALL">{T.hazard_all_types}</option>
                {HAZARD_TYPES.map(t => <option key={t.value} value={t.value}>{T[t.labelKey]}</option>)}
              </select>
            </div>
          </ScrollReveal>
        </div>

        {/* Stats bar */}
        <div className="max-w-7xl mx-auto mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: T.hazard_open, value: totalOpen, icon: <AlertTriangle size={16} />, color: 'text-red-500' },
            { label: T.hazard_critical_zones, value: criticalZones, icon: <Zap size={16} />, color: 'text-yellow-600' },
            { label: T.hazard_citizens_reported, value: totalAffected, icon: <Users size={16} />, color: 'text-blue-500' },
            { label: T.hazard_clusters, value: clusters.length, icon: <Layers size={16} />, color: 'text-green-600' },
          ].map(({ label, value, icon, color }, i) => (
            <ScrollReveal key={label} direction="up" delay={i * 60} className="w-full">
              <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm hover:shadow-md h-full transition-shadow duration-300">
                <div className={color}>{icon}</div>
                <div>
                  <p className={`text-2xl font-black ${color}`}><CountUp end={value} /></p>
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">
        {/* Map Panel */}
        <div className="flex-1 min-w-0">
          {/* Filters */}
          <ScrollReveal direction="up" delay={200}>
            <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <select
                  value={filterSev}
                  onChange={e => setFilterSev(e.target.value)}
                  className="text-sm bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-transparent input-premium"
                >
                  <option value="ALL">{T.hazard_all_severity}</option>
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="text-xs text-gray-400 font-medium">{visibleClusters.length} {T.hazard_clusters_visible}</div>
            </div>
          </ScrollReveal>

          {/* Map */}
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden" style={{ height: 480, zIndex: 0 }}>
            <MapContainer 
              center={[28.6139, 77.2090]} 
              zoom={5} 
              minZoom={4}
              maxBounds={[[6.4, 68.7], [35.5, 97.2]]}
              style={{ height: '100%', width: '100%', background: '#111827' }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              
              {/* Heatmap glow rings for critical clusters */}
              {visibleClusters.filter(c => c.severity === 'CRITICAL' || c.severity === 'HIGH').map(c => {
                const color = c.severity === 'CRITICAL' ? '#ef4444' : '#f97316';
                return (
                  <Circle 
                    key={`glow-${c.id}`}
                    center={[c.lat, c.lng]}
                    radius={300 + c.count * 100}
                    pathOptions={{ fillColor: color, fillOpacity: 0.1, color: color, opacity: 0, weight: 0 }}
                  />
                );
              })}

              {visibleClusters.map(c => {
                const colors: Record<string, string> = { LOW: '#3b82f6', MEDIUM: '#eab308', HIGH: '#f97316', CRITICAL: '#ef4444' };
                const fill = colors[c.severity];
                const isSelected = selectedCluster?.id === c.id;
                const ti = typeInfo(c.type);

                const iconHtml = `
                  <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
                    ${isSelected ? `<div style="position: absolute; inset: -8px; border-radius: 50%; background: ${fill}; opacity: 0.3;"></div>` : ''}
                    <div style="position: relative; width: 32px; height: 32px; border-radius: 50%; background: ${fill}; border: ${isSelected ? '2.5px solid white' : 'none'}; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);">
                      <span style="color: white; font-weight: bold; font-size: ${c.count > 9 ? '11px' : '13px'};">${c.count}</span>
                    </div>
                    <div style="position: absolute; top: -16px; white-space: nowrap; font-size: 10px; font-weight: bold; color: #9ca3af; text-shadow: 0 1px 2px black;">${T[ti.labelKey].split(' ')[0]}</div>
                  </div>
                `;

                const customIcon = L.divIcon({
                  html: iconHtml,
                  className: '',
                  iconSize: [40, 40],
                  iconAnchor: [20, 20]
                });

                return (
                  <Marker 
                    key={c.id}
                    position={[c.lat, c.lng]}
                    icon={customIcon}
                    eventHandlers={{ click: () => setSelectedCluster(isSelected ? null : c) }}
                  />
                );
              })}
            </MapContainer>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 bg-gray-950/90 backdrop-blur-sm border border-gray-700 rounded-xl p-3 text-xs space-y-1.5" style={{ zIndex: 400 }}>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-2">{T.hazard_severity}</p>
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${SEV_COLOR[s]}`}></div>
                  <span className="text-gray-300 font-medium">{s}</span>
                </div>
              ))}
              <p className="text-gray-500 text-[10px] mt-2">{T.hazard_size_hint}</p>
            </div>
          </div>

          {/* Cluster detail panel */}
          {selectedCluster && (
            <ScrollReveal direction="up">
              <div className="mt-4 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                      {typeInfo(selectedCluster.type).icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{T[typeInfo(selectedCluster.type).labelKey]} Cluster</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin size={11} className="text-orange-500" />{selectedCluster.area && selectedCluster.area !== 'Unknown Area' ? selectedCluster.area : 'Location on Map'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full font-bold ${SEV_TEXT[selectedCluster.severity]}`}>{selectedCluster.severity}</span>
                    <button onClick={() => setSelectedCluster(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {selectedCluster.reports.map(r => (
                    <div key={r.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-all duration-300">
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                        <p className="text-sm font-semibold text-gray-800">{r.description}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          r.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                          r.status === 'ACKNOWLEDGED' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                        }`}>{r.status}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Users size={10} />{r.reporterName}</span>
                        <span className="flex items-center gap-1"><Clock size={10} />{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                      </div>
                      {r.photoUrl && (
                        <img src={r.photoUrl} alt="Hazard" className="mt-3 w-full h-32 object-cover rounded-lg" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          )}
        </div>

        {/* Sidebar — Top Critical Zones */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          <ScrollReveal direction="up" delay={100}>
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
                <TrendingUp size={16} className="text-red-500 animate-pulse" />
                <h3 className="font-bold text-gray-900 text-sm">{T.hazard_critical_zones_title}</h3>
                <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{T.hazard_priority}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {[...visibleClusters]
                  .sort((a, b) => {
                    const ord = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
                    return (ord[b.severity] - ord[a.severity]) || b.count - a.count;
                  })
                  .slice(0, 8)
                  .map((c, i) => {
                    const ti = typeInfo(c.type);
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCluster(c)}
                        className="w-full px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50/70 transition-colors text-left group"
                      >
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-xs font-bold shrink-0 mt-0.5 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-gray-500 group-hover:scale-110 transition-transform">{ti.icon}</span>
                            <span className="text-sm font-semibold text-gray-700 truncate group-hover:text-gray-900 transition-colors">{c.area && c.area !== 'Unknown Area' ? c.area : 'Location on Map'}</span>
                          </div>
                          <p className="text-xs text-gray-400 truncate">{T.hazard_report_count(c.count)} · {T[ti.labelKey]}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 mt-1 ${SEV_TEXT[c.severity]}`}>{c.severity}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </ScrollReveal>

          {/* How clustering works */}
          <ScrollReveal direction="up" delay={200}>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Layers size={16} className="text-green-500 animate-pulse" />
                <h3 className="font-bold text-gray-900 text-sm">{T.hazard_clustering_title}</h3>
              </div>
              <div className="space-y-3 text-xs text-gray-500">
                {[
                  { icon: <MapPin size={14} className="text-green-500" />, text: T.hazard_cluster_1 },
                  { icon: <Layers size={14} className="text-blue-500" />, text: T.hazard_cluster_2 },
                  { icon: <Zap size={14} className="text-yellow-500" />, text: T.hazard_cluster_3 },
                  { icon: <AlertTriangle size={14} className="text-orange-500" />, text: T.hazard_cluster_4 },
                  { icon: <CheckCircle size={14} className="text-green-500" />, text: T.hazard_cluster_5 },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-start gap-2.5">
                    <span className="shrink-0">{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {user?.role !== 'admin' && (
            <ScrollReveal direction="scale" delay={250}>
              <Magnetic>
                <button
                  onClick={() => onNavigate('submit')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl btn-premium active:scale-95 shadow-md shadow-orange-200 transition-all"
                >
                  File a complaint <ArrowRight size={16} />
                </button>
              </Magnetic>
            </ScrollReveal>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-100 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-scale">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{T.hazard_report_title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{T.hazard_report_desc}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
            </div>

            {submitted ? (
              <div className="p-10 text-center">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-3 animate-bounce" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">{T.hazard_reported}</h3>
                <p className="text-gray-500 text-sm">{T.hazard_reported_msg}</p>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Hazard type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{T.hazard_type_label} *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {HAZARD_TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setForm(f => ({ ...f, type: t.value as HazardReport['type'] }))}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all btn-premium active:scale-95 ${
                          form.type === t.value ? 'border-red-500 bg-red-50 text-red-700 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {t.icon}{T[t.labelKey]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{T.hazard_severity_label} *</label>
                  <div className="flex gap-2 flex-wrap">
                    {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setForm(f => ({ ...f, severity: s }))}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all btn-premium active:scale-95 ${
                          form.severity === s ? `${SEV_TEXT[s]} border-current` : 'border-gray-200 bg-white text-gray-505 hover:bg-gray-55'
                        }`}
                      >{s}</button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{T.hazard_desc_label} *</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    placeholder={T.hazard_desc_placeholder}
                    className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-800 placeholder-gray-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-transparent resize-none input-premium"
                  />
                </div>

                {/* Reporter name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{T.hazard_name_label} *</label>
                  <input
                    value={form.reporterName}
                    onChange={e => setForm(f => ({ ...f, reporterName: e.target.value }))}
                    placeholder={T.hazard_name_placeholder}
                    className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-800 placeholder-gray-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-transparent input-premium"
                  />
                </div>

                {/* Area */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{T.hazard_area_label}</label>
                  <select
                    value={form.area}
                    onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-transparent input-premium"
                  >
                    <option value="">{T.hazard_select_area}</option>
                    {CITY_OPTIONS.filter(c => c !== 'All').map(city => (
                      <optgroup key={city} label={city}>
                        {LOCATIONS.filter(l => l.city === city).map(l => (
                          <option key={l.area} value={l.area}>{l.area}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* GPS */}
                <div>
                  <button
                    onClick={handleGetGPS}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all btn-premium active:scale-95 ${
                      form.useGPS ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <MapPin size={14} />
                    {form.useGPS ? `GPS: ${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}` : T.hazard_use_gps}
                  </button>
                </div>

                {/* Photo upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{T.hazard_photo_label}</label>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                  {form.photoPreview ? (
                    <div className="relative">
                      <img src={form.photoPreview} alt="preview" className="w-full h-32 object-cover rounded-xl" />
                      <button
                        onClick={() => setForm(f => ({ ...f, photoFile: null, photoPreview: null }))}
                        className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-black/80 transition-colors"
                      ><X size={14} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-all cursor-pointer bg-gray-50/50"
                    >
                      <Upload size={20} className="mx-auto mb-2" />
                      <span className="text-sm">{T.hazard_upload_photo}</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!form.description.trim() || !form.reporterName.trim()}
                  className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 btn-premium active:scale-95 shadow-md shadow-red-100"
                >
                  <Camera size={16} /> {T.hazard_submit}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
