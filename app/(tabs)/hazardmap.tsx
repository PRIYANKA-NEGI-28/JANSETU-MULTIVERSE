import { ScrollView, View, Text, Pressable, Modal, TextInput, Image, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {
  MapPin, Camera, AlertTriangle, Zap, X, CheckCircle,
  Filter, Users, TrendingUp, Eye, Clock, ArrowRight,
  Zap as ElectricIcon, Droplets, Building, Flame, Upload, Layers,
} from 'lucide-react-native';
import { LOCATIONS, CITY_OPTIONS } from '../../lib/locations';
import { useLang } from '../../lib/langContext';

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
  { value: 'wire', labelKey: 'hazard_type_wire' as const, icon: <ElectricIcon size={14} color="#ca8a04" />, bg: 'bg-yellow-50 border-yellow-200' },
  { value: 'pothole', labelKey: 'hazard_type_pothole' as const, icon: <ElectricIcon size={14} color="#ea580c" />, bg: 'bg-orange-50 border-orange-200' },
  { value: 'flood', labelKey: 'hazard_type_flood' as const, icon: <Droplets size={14} color="#2563eb" />, bg: 'bg-blue-50 border-blue-200' },
  { value: 'collapse', labelKey: 'hazard_type_collapse' as const, icon: <Building size={14} color="#dc2626" />, bg: 'bg-red-50 border-red-200' },
  { value: 'fire_hazard', labelKey: 'hazard_type_fire' as const, icon: <Flame size={14} color="#dc2626" />, bg: 'bg-red-100 border-red-300' },
];

const SEV_COLOR: Record<string, string> = {
  LOW: '#3b82f6',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

const SEV_BG: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

// Seed data
const SEED_REPORTS: HazardReport[] = [
  { id: 'h1', lat: 28.6139, lng: 77.2090, type: 'wire', severity: 'CRITICAL', description: 'Loose live wire hanging near school gate', reporterName: 'Priya Sharma', area: 'Connaught Place', status: 'OPEN', clusterSize: 4, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), photoUrl: null },
  { id: 'h2', lat: 28.5672, lng: 77.2100, type: 'pothole', severity: 'HIGH', description: 'Giant pothole on main road', reporterName: 'Deepak Joshi', area: 'Lajpat Nagar', status: 'OPEN', clusterSize: 3, createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), photoUrl: null },
  { id: 'h3', lat: 28.6280, lng: 77.2165, type: 'flood', severity: 'CRITICAL', description: 'Street waterlogged, knee-deep water', reporterName: 'Kavita Nair', area: 'Karol Bagh', status: 'OPEN', clusterSize: 5, createdAt: new Date(Date.now() - 86400000 * 0.3).toISOString(), photoUrl: null },
];

const MAP_BOUNDS = { minLat: 28.55, maxLat: 28.73, minLng: 77.06, maxLng: 77.40 };

function project(lat: number, lng: number, w: number, h: number) {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * w;
  const y = h - ((lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * h;
  return { x, y };
}

function buildClusters(reports: HazardReport[]): Cluster[] {
  const threshold = 0.008;
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

export default function HazardMapScreen() {
  const { T } = useLang();
  const router = useRouter();
  const [reports, setReports] = useState<HazardReport[]>(SEED_REPORTS);
  const [clusters, setClusters] = useState<Cluster[]>(() => buildClusters(SEED_REPORTS));
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSev, setFilterSev] = useState<string>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mapWidth, setMapWidth] = useState(350);
  const [mapHeight, setMapHeight] = useState(300);

  const [form, setForm] = useState({
    type: 'wire' as HazardReport['type'],
    severity: 'HIGH' as HazardReport['severity'],
    description: '',
    reporterName: '',
    area: '',
    photoUri: null as string | null,
    useGPS: false,
    lat: 28.6139,
    lng: 77.2090,
  });

  const visibleClusters = clusters.filter(c => {
    const matchType = filterType === 'ALL' || c.reports.some(r => r.type === filterType);
    const matchSev = filterSev === 'ALL' || c.severity === filterSev;
    return matchType && matchSev;
  });

  const totalOpen = reports.filter(r => r.status === 'OPEN').length;
  const criticalZones = clusters.filter(c => c.severity === 'CRITICAL').length;
  const totalAffected = clusters.reduce((s, c) => s + c.count, 0);

  async function handleGetGPS() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({});
      setForm(f => ({ ...f, useGPS: true, lat: location.coords.latitude, lng: location.coords.longitude }));
    }
  }

  async function handlePickImage() {
    const result = await ImagePicker.requestCameraPermissionsAsync();
    if (result.granted) {
      const pickerResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
      });
      if (!pickerResult.canceled && pickerResult.assets[0]) {
        setForm(f => ({ ...f, photoUri: pickerResult.assets[0].uri }));
      }
    }
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
      photoUrl: form.photoUri,
    };
    const updated = [newReport, ...reports];
    setReports(updated);
    setClusters(buildClusters(updated));
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setShowForm(false); }, 2500);
  }

  const typeInfo = (type: string) => HAZARD_TYPES.find(t => t.value === type) || HAZARD_TYPES[0];

  return (
    <ScrollView className="flex-1 bg-gray-950">
      {/* Header */}
      <View className="p-4 pt-8 bg-gray-950 border-b border-gray-800">
        <View className="flex-row justify-between items-start mb-4">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <View className="w-2 h-2 rounded-full bg-red-500" />
              <Text className="text-xs font-bold text-red-400 uppercase tracking-widest">{T.hazard_live}</Text>
            </View>
            <Text className="text-2xl font-bold text-white">{T.hazard_title}</Text>
            <Text className="text-gray-400 text-sm">{T.hazard_subtitle}</Text>
          </View>
          <Pressable
            onPress={() => setShowForm(true)}
            className="flex-row items-center gap-2 px-4 py-2 bg-red-600 rounded-xl"
          >
            <Camera size={16} color="white" />
            <Text className="text-white font-bold text-sm">{T.hazard_report_btn}</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View className="flex-row gap-3">
          {[
            { label: T.hazard_open, value: totalOpen, icon: <AlertTriangle size={14} color="#f87171" /> },
            { label: T.hazard_critical_zones, value: criticalZones, icon: <Zap size={14} color="#fbbf24" /> },
            { label: T.hazard_clusters, value: clusters.length, icon: <Layers size={14} color="#4ade80" /> },
          ].map(({ label, value, icon }) => (
            <View key={label} className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2">
              <View className="flex-row items-center gap-2">
                {icon}
                <Text className="text-lg font-black text-white">{value}</Text>
              </View>
              <Text className="text-xs text-gray-500">{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="p-4">
        {/* Filters */}
        <View className="flex-row items-center gap-2 mb-3">
          <Filter size={14} color="#9ca3af" />
          <Text className="text-gray-400 text-sm">{T.hazard_filter}</Text>
        </View>

        {/* SVG Map */}
        <View className="bg-gray-900 border border-gray-700 rounded-2xl p-4 mb-4">
          <View style={{ width: '100%', height: 300 }} onLayout={(e) => {
            setMapWidth(e.nativeEvent.layout.width);
            setMapHeight(e.nativeEvent.layout.height);
          }}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${mapWidth} ${mapHeight}`}>
              {/* Grid */}
              {Array.from({ length: 8 }).map((_, i) => (
                <Line key={`h${i}`} x1="0" y1={mapHeight * i / 8} x2={mapWidth} y2={mapHeight * i / 8} stroke="#1f2937" strokeWidth="1" />
              ))}
              {Array.from({ length: 10 }).map((_, i) => (
                <Line key={`v${i}`} x1={mapWidth * i / 10} y1="0" x2={mapWidth * i / 10} y2={mapHeight} stroke="#1f2937" strokeWidth="1" />
              ))}

              {/* Area labels */}
              {[
                { lat: 28.6139, lng: 77.2090, label: 'Connaught Place' },
                { lat: 28.5672, lng: 77.2100, label: 'Lajpat Nagar' },
                { lat: 28.6280, lng: 77.2165, label: 'Karol Bagh' },
              ].map(({ lat, lng, label }) => {
                const { x, y } = project(lat, lng, mapWidth, mapHeight);
                return (
                  <SvgText key={label} x={x} y={y + 20} textAnchor="middle" fill="#374151" fontSize="9">{label}</SvgText>
                );
              })}

              {/* Clusters */}
              {visibleClusters.map(c => {
                const { x, y } = project(c.lat, c.lng, mapWidth, mapHeight);
                const radius = Math.min(10 + c.count * 4, 28);
                const fill = SEV_COLOR[c.severity];
                const isSelected = selectedCluster?.id === c.id;

                return (
                  <G key={c.id} onPress={() => setSelectedCluster(isSelected ? null : c)}>
                    {isSelected && <Circle cx={x} cy={y} r={radius + 6} fill={fill} opacity="0.2" />}
                    <Circle cx={x} cy={y} r={radius} fill={fill} opacity="0.9" stroke={isSelected ? 'white' : fill} strokeWidth={isSelected ? 2 : 0} />
                    <SvgText x={x} y={y + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{c.count}</SvgText>
                  </G>
                );
              })}
            </Svg>
          </View>

          {/* Legend */}
          <View className="flex-row justify-center gap-4 mt-3">
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => (
              <View key={s} className="flex-row items-center gap-1">
                <View className={`w-3 h-3 rounded-full`} style={{ backgroundColor: SEV_COLOR[s] }} />
                <Text className="text-gray-400 text-xs">{s}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Selected Cluster Details */}
        {selectedCluster && (
          <View className="bg-gray-900 border border-gray-700 rounded-2xl p-4 mb-4">
            <View className="flex-row justify-between items-start mb-3">
              <View>
                <Text className="font-bold text-white text-lg">{T[typeInfo(selectedCluster.type).labelKey]} Cluster</Text>
                <View className="flex-row items-center gap-1 mt-1">
                  <MapPin size={11} color="#9ca3af" />
                  <Text className="text-gray-400 text-sm">{selectedCluster.area}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <View className={`px-3 py-1 rounded-full ${SEV_BG[selectedCluster.severity]}`}>
                  <Text className="text-xs font-bold">{selectedCluster.severity}</Text>
                </View>
                <Pressable onPress={() => setSelectedCluster(null)}>
                  <X size={18} color="#6b7280" />
                </Pressable>
              </View>
            </View>
            <View className="gap-2">
              {selectedCluster.reports.slice(0, 3).map(r => (
                <View key={r.id} className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                  <Text className="text-sm font-semibold text-white">{r.description}</Text>
                  <View className="flex-row items-center gap-3 mt-2">
                    <View className="flex-row items-center gap-1">
                      <Users size={10} color="#6b7280" />
                      <Text className="text-xs text-gray-500">{r.reporterName}</Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Clock size={10} color="#6b7280" />
                      <Text className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Critical Zones List */}
        <View className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <View className="flex-row items-center gap-2 px-4 py-3 border-b border-gray-800">
            <TrendingUp size={16} color="#f87171" />
            <Text className="font-bold text-white">{T.hazard_critical_zones_title}</Text>
          </View>
          {[...clusters]
            .sort((a, b) => {
              const ord = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
              return (ord[b.severity] - ord[a.severity]) || b.count - a.count;
            })
            .slice(0, 4)
            .map((c, i) => {
              const ti = typeInfo(c.type);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedCluster(c)}
                  className="flex-row items-center gap-3 px-4 py-3 border-b border-gray-800 active:bg-gray-800"
                >
                  <View className="w-6 h-6 rounded-full bg-gray-800 items-center justify-center">
                    <Text className="text-gray-500 text-xs font-bold">{i + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-gray-400">{ti.icon}</Text>
                      <Text className="text-sm font-semibold text-white">{c.area}</Text>
                    </View>
                    <Text className="text-xs text-gray-500">{c.count} reports</Text>
                  </View>
                  <View className={`px-2 py-0.5 rounded-full ${SEV_BG[c.severity]}`}>
                    <Text className="text-[10px] font-bold">{c.severity}</Text>
                  </View>
                </Pressable>
              );
            })}
        </View>
      </View>

      {/* Report Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View className="flex-1 bg-black/70 items-end">
          <View className="bg-gray-900 w-full h-[90%] rounded-t-3xl">
            <View className="flex-row justify-between items-center px-5 py-4 border-b border-gray-800">
              <View>
                <Text className="text-lg font-bold text-white">{T.hazard_report_title}</Text>
                <Text className="text-xs text-gray-400">{T.hazard_report_desc}</Text>
              </View>
              <Pressable onPress={() => setShowForm(false)}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>

            {submitted ? (
              <View className="flex-1 items-center justify-center p-6">
                <CheckCircle size={48} color="#4ade80" />
                <Text className="text-xl font-bold text-white mt-4">{T.hazard_reported}</Text>
                <Text className="text-gray-400 text-sm mt-2">{T.hazard_reported_msg}</Text>
              </View>
            ) : (
              <ScrollView className="flex-1 p-5">
                <Text className="text-sm font-semibold text-gray-300 mb-2">{T.hazard_type_label} *</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {HAZARD_TYPES.map(t => (
                    <Pressable
                      key={t.value}
                      onPress={() => setForm(f => ({ ...f, type: t.value as HazardReport['type'] }))}
                      className={`flex-row items-center gap-2 px-3 py-2 rounded-xl border ${form.type === t.value ? 'border-red-500 bg-red-950' : 'border-gray-700 bg-gray-800'}`}
                    >
                      {t.icon}
                      <Text className={`text-sm font-semibold ${form.type === t.value ? 'text-red-300' : 'text-gray-300'}`}>
                        {T[t.labelKey]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text className="text-sm font-semibold text-gray-300 mb-2">{T.hazard_severity_label} *</Text>
                <View className="flex-row gap-2 mb-4">
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(s => (
                    <Pressable
                      key={s}
                      onPress={() => setForm(f => ({ ...f, severity: s }))}
                      className={`px-3 py-1.5 rounded-lg border ${form.severity === s ? SEV_BG[s] + ' border-current' : 'border-gray-700 bg-gray-800'}`}
                    >
                      <Text className={`text-xs font-bold ${form.severity === s ? '' : 'text-gray-400'}`}>{s}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text className="text-sm font-semibold text-gray-300 mb-2">{T.hazard_desc_label} *</Text>
                <TextInput
                  value={form.description}
                  onChangeText={description => setForm(f => ({ ...f, description }))}
                  placeholder={T.hazard_desc_placeholder}
                  multiline
                  numberOfLines={3}
                  className="bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-xl text-sm mb-4"
                  placeholderTextColor="#6b7280"
                  style={{ textAlignVertical: 'top' }}
                />

                <Text className="text-sm font-semibold text-gray-300 mb-2">{T.hazard_name_label} *</Text>
                <TextInput
                  value={form.reporterName}
                  onChangeText={reporterName => setForm(f => ({ ...f, reporterName }))}
                  placeholder={T.hazard_name_placeholder}
                  className="bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-xl text-sm mb-4"
                  placeholderTextColor="#6b7280"
                />

                <Pressable
                  onPress={handleGetGPS}
                  className={`flex-row items-center gap-2 px-4 py-2 rounded-xl mb-4 ${form.useGPS ? 'bg-green-950 border border-green-700' : 'bg-gray-800 border border-gray-700'}`}
                >
                  <MapPin size={14} color={form.useGPS ? '#4ade80' : '#9ca3af'} />
                  <Text className={`text-sm font-semibold ${form.useGPS ? 'text-green-400' : 'text-gray-300'}`}>
                    {form.useGPS ? `GPS: ${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}` : T.hazard_use_gps}
                  </Text>
                </Pressable>

                <Text className="text-sm font-semibold text-gray-300 mb-2">{T.hazard_photo_label}</Text>
                <Pressable onPress={handlePickImage} className="border-2 border-dashed border-gray-700 rounded-xl p-6 items-center mb-6">
                  {form.photoUri ? (
                    <Image source={{ uri: form.photoUri }} className="w-full h-32 rounded-xl" resizeMode="cover" />
                  ) : (
                    <>
                      <Upload size={20} color="#6b7280" />
                      <Text className="text-gray-500 text-sm mt-2">{T.hazard_upload_photo}</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={handleSubmit}
                  disabled={!form.description.trim() || !form.reporterName.trim()}
                  className={`flex-row items-center justify-center gap-2 py-4 rounded-xl ${!form.description.trim() || !form.reporterName.trim() ? 'bg-gray-700' : 'bg-red-600'}`}
                >
                  <Camera size={16} color="white" />
                  <Text className="text-white font-bold">{T.hazard_submit}</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
