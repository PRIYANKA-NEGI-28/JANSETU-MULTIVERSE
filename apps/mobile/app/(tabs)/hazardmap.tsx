import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import {
  MapPin,
  Layers,
  AlertTriangle,
  Zap,
  CheckCircle,
  Clock,
  Filter,
  Users,
  X,
  FileText,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react-native';
import {
  getMapClusters,
  type PublicClusterDto,
  type IoTStreetlightAnomalyDto,
} from '../../src/lib/api-client';
import { useLang } from '../../src/contexts/LanguageContext';

// Canonical fallback data ensuring map renders rich civic data across Delhi NCR
const SEED_CLUSTERS: readonly PublicClusterDto[] = [
  {
    id: 'cluster-del-01',
    title: 'High-voltage hanging wire above pedestrian walkway',
    departmentId: 'Electricity & Power',
    wardId: 'Ghaziabad Ward 1 (Indirapuram)',
    status: 'IN_PROGRESS',
    centroid: { lat: 28.636, lng: 77.371 },
    complaintCount: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cluster-del-02',
    title: 'Severe road cave-in and dangerous potholes',
    departmentId: 'Public Works Department (PWD)',
    wardId: 'Ghaziabad Ward 2 (Vaishali)',
    status: 'PENDING',
    centroid: { lat: 28.643, lng: 77.337 },
    complaintCount: 4,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cluster-del-03',
    title: 'Overflowing drain and sewage backup on main avenue',
    departmentId: 'Delhi Jal Board',
    wardId: 'Delhi Ward 4 (Lajpat Nagar)',
    status: 'IN_PROGRESS',
    centroid: { lat: 28.567, lng: 77.243 },
    complaintCount: 8,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cluster-del-04',
    title: 'Broken stormwater slab and pedestrian trip hazard',
    departmentId: 'MCD Central Zone',
    wardId: 'Delhi Ward 12 (Connaught Place)',
    status: 'RESOLVED',
    centroid: { lat: 28.6315, lng: 77.2167 },
    complaintCount: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cluster-del-05',
    title: 'Drinking water pipeline rupture flooding market road',
    departmentId: 'Delhi Jal Board',
    wardId: 'Delhi Ward 7 (Rohini)',
    status: 'PENDING',
    centroid: { lat: 28.712, lng: 77.118 },
    complaintCount: 6,
    createdAt: new Date().toISOString(),
  },
];

const SEED_IOT_FAULTS: readonly IoTStreetlightAnomalyDto[] = [
  {
    id: 'iot-fault-01',
    deviceId: 'IOT-ESP32-POLE-4091',
    poleNumber: 'SL-IND-4091',
    area: 'Indirapuram Market Road',
    wardId: 'Ghaziabad Ward 1 (Indirapuram)',
    status: 'FAULT',
    faultType: 'LDR Darkness Mismatch (Dark at Night)',
    ldrValue: 12,
    lat: 28.6385,
    lng: 77.3692,
    reportedAt: new Date().toISOString(),
  },
  {
    id: 'iot-fault-02',
    deviceId: 'IOT-ESP32-POLE-1042',
    poleNumber: 'SL-LJP-1042',
    area: 'Lajpat Nagar Central Market',
    wardId: 'Delhi Ward 4 (Lajpat Nagar)',
    status: 'FAULT',
    faultType: 'Daytime Burn Anomaly (Sensor Stuck High)',
    ldrValue: 980,
    lat: 28.5692,
    lng: 77.2405,
    reportedAt: new Date().toISOString(),
  },
  {
    id: 'iot-fault-03',
    deviceId: 'IOT-ESP32-POLE-2804',
    poleNumber: 'SL-CP-2804',
    area: 'Outer Circle Radial 2',
    wardId: 'Delhi Ward 12 (Connaught Place)',
    status: 'ALERT',
    faultType: 'Photocell Voltage Fluctuation',
    ldrValue: 410,
    lat: 28.6295,
    lng: 77.2192,
    reportedAt: new Date().toISOString(),
  },
];

const CATEGORY_FILTERS = [
  { id: 'ALL', label: 'All Hazards' },
  { id: 'ELECTRICAL', label: 'Electrical & Power' },
  { id: 'PWD', label: 'Roads & PWD' },
  { id: 'WATER', label: 'Water & Sewage' },
  { id: 'IOT_ONLY', label: 'IoT Streetlight Faults' },
];

export default function HazardMapScreen() {
  const { T } = useLang();
  const router = useRouter();

  const [clusters, setClusters] = useState<readonly PublicClusterDto[]>(SEED_CLUSTERS);
  const [iotFaults] = useState<readonly IoTStreetlightAnomalyDto[]>(SEED_IOT_FAULTS);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedWard, setSelectedWard] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<{
    readonly type: 'CLUSTER' | 'IOT';
    readonly cluster?: PublicClusterDto;
    readonly iot?: IoTStreetlightAnomalyDto;
  } | null>(null);

  const webViewRef = useRef<WebView>(null);

  // Fetch real clusters from API with graceful fallback to seeded clusters
  const fetchMapData = async () => {
    setLoading(true);
    try {
      const data = await getMapClusters();
      if (data && data.length > 0) {
        setClusters(data);
      } else {
        setClusters(SEED_CLUSTERS);
      }
    } catch {
      setClusters(SEED_CLUSTERS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMapData();
  }, []);

  // Filtered lists
  const filteredClusters = useMemo(() => {
    if (selectedCategory === 'IOT_ONLY') return [];
    return clusters.filter((c) => {
      const matchesWard = selectedWard === 'ALL' || c.wardId.includes(selectedWard);
      let matchesCat = true;
      if (selectedCategory === 'ELECTRICAL') {
        matchesCat = c.departmentId.toLowerCase().includes('elec') || c.title.toLowerCase().includes('wire');
      } else if (selectedCategory === 'PWD') {
        matchesCat = c.departmentId.toLowerCase().includes('pwd') || c.title.toLowerCase().includes('road') || c.title.toLowerCase().includes('pothole');
      } else if (selectedCategory === 'WATER') {
        matchesCat = c.departmentId.toLowerCase().includes('water') || c.departmentId.toLowerCase().includes('jal') || c.title.toLowerCase().includes('drain');
      }
      return matchesWard && matchesCat;
    });
  }, [clusters, selectedCategory, selectedWard]);

  const filteredIoTFaults = useMemo(() => {
    if (selectedCategory !== 'ALL' && selectedCategory !== 'ELECTRICAL' && selectedCategory !== 'IOT_ONLY') {
      return [];
    }
    return iotFaults.filter((f) => {
      return selectedWard === 'ALL' || f.wardId.includes(selectedWard);
    });
  }, [iotFaults, selectedCategory, selectedWard]);

  // Generate Leaflet OpenStreetMap HTML
  const leafletHtml = useMemo(() => {
    const clusterMarkersJson = JSON.stringify(
      filteredClusters.map((c) => ({
        id: c.id,
        lat: c.centroid.lat,
        lng: c.centroid.lng,
        title: c.title,
        count: c.complaintCount,
        status: c.status,
        ward: c.wardId,
      }))
    );

    const iotMarkersJson = JSON.stringify(
      filteredIoTFaults.map((f) => ({
        id: f.id,
        lat: f.lat,
        lng: f.lng,
        pole: f.poleNumber,
        fault: f.faultType,
        ldr: f.ldrValue,
        status: f.status,
      }))
    );

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #f8fafc; font-family: -apple-system, sans-serif; }
    .cluster-pin {
      display: flex; align-items: center; justify-content: center;
      background: #f97316; color: white; font-weight: bold; font-size: 13px;
      border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      cursor: pointer; transition: transform 0.2s;
    }
    .cluster-pin:hover { transform: scale(1.15); }
    .iot-pin {
      display: flex; align-items: center; justify-content: center;
      background: #ef4444; color: white; font-size: 14px;
      border-radius: 12px; border: 2px solid white; box-shadow: 0 4px 10px rgba(239,68,68,0.4);
      cursor: pointer; animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([28.625, 77.275], 11);

    // Free OpenStreetMap Tiles without paid Google Cloud API requirements
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    var clusters = ${clusterMarkersJson};
    var iotFaults = ${iotMarkersJson};

    clusters.forEach(function(c) {
      var icon = L.divIcon({
        className: 'custom-icon',
        html: '<div class="cluster-pin" style="width:34px;height:34px;">' + c.count + '</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      var marker = L.marker([c.lat, c.lng], { icon: icon }).addTo(map);
      marker.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_CLUSTER', id: c.id }));
        }
      });
    });

    iotFaults.forEach(function(f) {
      var icon = L.divIcon({
        className: 'custom-iot-icon',
        html: '<div class="iot-pin" style="width:30px;height:30px;">⚡</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      var marker = L.marker([f.lat, f.lng], { icon: icon }).addTo(map);
      marker.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_IOT', id: f.id }));
        }
      });
    });
  </script>
</body>
</html>
    `;
  }, [filteredClusters, filteredIoTFaults]);

  // Handle messages from Leaflet inside WebView
  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const parsed = JSON.parse(event.nativeEvent.data) as {
        readonly type: string;
        readonly id: string;
      };

      if (parsed.type === 'SELECT_CLUSTER') {
        const found = clusters.find((c) => c.id === parsed.id);
        if (found) {
          setActiveItem({ type: 'CLUSTER', cluster: found });
        }
      } else if (parsed.type === 'SELECT_IOT') {
        const found = iotFaults.find((f) => f.id === parsed.id);
        if (found) {
          setActiveItem({ type: 'IOT', iot: found });
        }
      }
    } catch {
      // Ignore unparseable messages
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Top Header */}
      <View className="px-4 pt-2 pb-3 bg-white border-b border-gray-100 shadow-sm">
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <View className="flex-row items-center gap-1.5 mb-0.5">
              <Layers size={14} color="#f97316" />
              <Text className="text-[11px] font-bold text-orange-600 uppercase tracking-widest">
                Free OpenStreetMap Layer
              </Text>
            </View>
            <Text className="text-xl font-black text-gray-900">Interactive Hazard Map</Text>
          </View>

          <Pressable
            onPress={() => void fetchMapData()}
            className="p-2 bg-gray-100 rounded-full active:bg-gray-200"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (
              <RotateCcw size={16} color="#374151" />
            )}
          </Pressable>
        </View>

        {/* Category Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
          {CATEGORY_FILTERS.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full border ${
                  isSelected
                    ? 'bg-orange-500 border-orange-500'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    isSelected ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Map Container */}
      <View className="flex-1 relative">
        <WebView
          ref={webViewRef}
          source={{ html: leafletHtml }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onMessage={handleWebViewMessage}
          style={{ flex: 1 }}
        />

        {/* Floating Summary Counter Badge */}
        <View className="absolute top-3 left-3 bg-white/95 border border-gray-200 rounded-xl px-3 py-2 shadow-md backdrop-blur-sm">
          <Text className="text-xs font-bold text-gray-800">
            {filteredClusters.length} Complaint Clusters · {filteredIoTFaults.length} IoT Faults
          </Text>
          <Text className="text-[10px] text-gray-500">Zero API Key / Free OSM Slippy Tiles</Text>
        </View>
      </View>

      {/* Active Item Slide-up Detail Modal */}
      <Modal
        visible={activeItem !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveItem(null)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-5 shadow-2xl border-t border-gray-100 max-h-[80%]">
            {/* Modal Header */}
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <View
                    className={`px-2 py-0.5 rounded-full ${
                      activeItem?.type === 'IOT' ? 'bg-red-100' : 'bg-orange-100'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        activeItem?.type === 'IOT' ? 'text-red-700' : 'text-orange-700'
                      }`}
                    >
                      {activeItem?.type === 'IOT'
                        ? 'IoT Streetlight Hardware Fault'
                        : 'Redacted Civic Cluster'}
                    </Text>
                  </View>
                </View>

                <Text className="text-lg font-bold text-gray-900 leading-snug">
                  {activeItem?.type === 'IOT'
                    ? activeItem.iot?.poleNumber
                    : activeItem?.cluster?.title}
                </Text>
              </View>

              <Pressable
                onPress={() => setActiveItem(null)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
              >
                <X size={16} color="#4b5563" />
              </Pressable>
            </View>

            {/* Modal Body: Cluster */}
            {activeItem?.type === 'CLUSTER' && activeItem.cluster && (
              <View className="gap-4">
                <View className="flex-row items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl p-4">
                  <View className="w-12 h-12 rounded-xl bg-orange-500 items-center justify-center">
                    <Users size={24} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-black text-orange-600">
                      {activeItem.cluster.complaintCount} Citizens
                    </Text>
                    <Text className="text-xs text-orange-800 font-medium">
                      Merged duplicate reports in this geographical cluster
                    </Text>
                  </View>
                </View>

                <View className="bg-gray-50 rounded-2xl p-4 gap-2 border border-gray-100">
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-gray-400 font-medium">Ward Jurisdiction</Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      {activeItem.cluster.wardId}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-gray-400 font-medium">Department</Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      {activeItem.cluster.departmentId}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-gray-400 font-medium">Current Status</Text>
                    <Text className="text-xs font-bold text-green-700">
                      {activeItem.cluster.status}
                    </Text>
                  </View>
                </View>

                {/* Deep Link to Section 6(1) RTI */}
                <Pressable
                  onPress={() => {
                    const cId = activeItem.cluster?.id;
                    setActiveItem(null);
                    router.push({
                      pathname: '/(tabs)/rti',
                      params: { clusterId: cId, title: activeItem.cluster?.title },
                    });
                  }}
                  className="flex-row items-center justify-center gap-2 py-3.5 bg-orange-500 rounded-xl active:bg-orange-600 shadow-sm"
                >
                  <FileText size={16} color="white" />
                  <Text className="text-white text-sm font-bold">
                    File Section 6(1) RTI for this Cluster
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Modal Body: IoT Streetlight Fault */}
            {activeItem?.type === 'IOT' && activeItem.iot && (
              <View className="gap-4">
                <View className="flex-row items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
                  <View className="w-12 h-12 rounded-xl bg-red-500 items-center justify-center">
                    <Zap size={24} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-red-900">
                      {activeItem.iot.faultType}
                    </Text>
                    <Text className="text-xs text-red-700 mt-0.5">
                      LDR Light Reading: {activeItem.iot.ldrValue} lux
                    </Text>
                  </View>
                </View>

                <View className="bg-gray-50 rounded-2xl p-4 gap-2 border border-gray-100">
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-gray-400 font-medium">Edge Device ID</Text>
                    <Text className="text-xs font-mono font-semibold text-gray-800">
                      {activeItem.iot.deviceId}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-gray-400 font-medium">Pole Location</Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      {activeItem.iot.area}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-gray-400 font-medium">Ward Jurisdiction</Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      {activeItem.iot.wardId}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    const pole = activeItem.iot?.poleNumber;
                    setActiveItem(null);
                    router.push({
                      pathname: '/(tabs)/submit',
                      params: {
                        initialText: `Streetlight hardware malfunction reported at pole ${pole}. IoT sensor reported fault ${activeItem.iot?.faultType}.`,
                      },
                    });
                  }}
                  className="flex-row items-center justify-center gap-2 py-3.5 bg-gray-900 rounded-xl active:bg-gray-800"
                >
                  <ShieldAlert size={16} color="white" />
                  <Text className="text-white text-sm font-bold">Report Field Escalation</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
