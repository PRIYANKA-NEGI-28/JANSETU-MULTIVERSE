import { View, Text, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import * as Location from 'expo-location';
import { MapPin, Zap, AlertTriangle } from 'lucide-react-native';

interface HazardReport {
  id: string;
  lat: number;
  lng: number;
  type: string;
  severity: string;
  description: string;
  photoUrl: string | null;
  reporterName: string;
  area: string;
  status: string;
  clusterSize: number;
  createdAt: string;
}

interface Cluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  severity: string;
  type: string;
  area: string;
  reports: HazardReport[];
}

const MAP_BOUNDS = {
  minLat: 28.55,
  maxLat: 28.73,
  minLng: 77.06,
  maxLng: 77.40
};

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

export default function SimpleHeatMap({ complaints }: { complaints: any[] }) {
  const [mapWidth, setMapWidth] = useState(350);
  const [mapHeight, setMapHeight] = useState(300);
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);

  useEffect(() => {
    // Convert complaints to hazard reports format
    const hazardReports: HazardReport[] = complaints.map((c, index) => ({
      id: c.id || `c${index}`,
      lat: parseFloat(c.lat) || 28.6139,
      lng: parseFloat(c.lng) || 77.2090,
      type: mapIssueTypeToHazardType(c.issueType || 'General'),
      severity: mapUrgencyToSeverity(c.urgency || 'MEDIUM'),
      description: c.summary || 'No description',
      photoUrl: null,
      reporterName: 'Anonymous',
      area: c.area || 'Unknown Area',
      status: c.status || 'PENDING',
      clusterSize: 1, // Simplified
      createdAt: c.createdAt || new Date().toISOString(),
    }));

    setReports(hazardReports);
    setClusters(buildClusters(hazardReports));
  }, [complaints]);

  function mapIssueTypeToHazardType(issueType: string): string {
    const lowerType = issueType.toLowerCase();
    if (lowerType.includes('wire') || lowerType.includes('electrical') || lowerType.includes('power')) return 'wire';
    if (lowerType.includes('pothole') || lowerType.includes('road') || lowerType.includes('street')) return 'pothole';
    if (lowerType.includes('flood') || lowerType.includes('water') || lowerType.includes('drain')) return 'flood';
    if (lowerType.includes('collapse') || lowerType.includes('building') || lowerType.includes('structure')) return 'collapse';
    return 'fire_hazard'; // default
  }

  function mapUrgencyToSeverity(urgency: string): string {
    switch (urgency.toUpperCase()) {
      case 'LOW': return 'LOW';
      case 'MEDIUM': return 'MEDIUM';
      case 'HIGH': return 'HIGH';
      case 'CRITICAL': return 'CRITICAL';
      default: return 'MEDIUM';
    }
  }

  const visibleClusters = clusters; // In a real app, we might filter these

  const totalOpen = reports.filter(r => r.status === 'OPEN').length;
  const criticalZones = clusters.filter(c => c.severity === 'CRITICAL').length;
  const totalAffected = clusters.reduce((s, c) => s + c.count, 0);

  // Generate some seed data if no complaints
  if (reports.length === 0) {
    const SEED_REPORTS: HazardReport[] = [
      { id: 'h1', lat: 28.6139, lng: 77.2090, type: 'wire', severity: 'CRITICAL', description: 'Loose live wire hanging near school gate', reporterName: 'Priya Sharma', area: 'Connaught Place', status: 'OPEN', clusterSize: 4, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), photoUrl: null },
      { id: 'h2', lat: 28.5672, lng: 77.2100, type: 'pothole', severity: 'HIGH', description: 'Giant pothole on main road', reporterName: 'Deepak Joshi', area: 'Lajpat Nagar', status: 'OPEN', clusterSize: 3, createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), photoUrl: null },
      { id: 'h3', lat: 28.6280, lng: 77.2165, type: 'flood', severity: 'CRITICAL', description: 'Street waterlogged, knee-deep water', reporterName: 'Kavita Nair', area: 'Karol Bagh', status: 'OPEN', clusterSize: 5, createdAt: new Date(Date.now() - 86400000 * 0.3).toISOString(), photoUrl: null },
    ];
    setReports(SEED_REPORTS);
    setClusters(buildClusters(SEED_REPORTS));
  }

  return (
    <View style={styles.container}>
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
            const isSelected = false; // Simplified - no selection for now

            return (
              <G key={c.id} onPress={() => {/* setSelectedCluster(isSelected ? null : c); */}}>
                {isSelected && <Circle cx={x} cy={y} r={radius + 6} fill={fill} opacity="0.2" />}
                <Circle cx={x} cy={y} r={radius} fill={fill} opacity="0.9" stroke={isSelected ? 'white' : fill} strokeWidth={isSelected ? 2 : 0} />
                <SvgText x={x} y={y + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{c.count}</SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Stats overlay */}
      <View style={styles.statsOverlay}>
        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.criticalZoneBox]}>
            <Zap size={16} color="#fbbf24" style={{ marginRight: 4 }} />
            <Text style={styles.statValue}>{criticalZones}</Text>
            <Text style={styles.statLabel}>Critical Zones</Text>
          </View>
          <View style={[styles.statBox, styles.clusterBox]}>
            <MapPin size={16} color="#4ade80" style={{ marginRight: 4 }} />
            <Text style={styles.statValue}>{clusters.length}</Text>
            <Text style={styles.statLabel}>Total Clusters</Text>
          </View>
          <View style={[styles.statBox, styles.reportBox]}>
            <AlertTriangle size={16} color="#f87171" style={{ marginRight: 4 }} />
            <Text style={styles.statValue}>{totalAffected}</Text>
            <Text style={styles.statLabel}>Total Reports</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  statBox: {
    alignItems: 'center',
    minWidth: 80,
  },
  criticalZoneBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
    paddingLeft: 12,
  },
  clusterBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
    paddingLeft: 12,
  },
  reportBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#f87171',
    paddingLeft: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
});