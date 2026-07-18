import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Neo4jComplaint } from '../lib/neo4j';

export interface SensorAlert {
  id: string;
  lat: number;
  lng: number;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  area: string;
  createdAt: string;
}

export interface GlobalMetrics {
  totalComplaints: number;
  resolved: number;
  pending: number;
  escalated: number;
  criticalZones: number;
  clustersDetected: number;
}

interface DashboardContextType {
  complaints: Neo4jComplaint[];
  sensorAlerts: SensorAlert[];
  globalMetrics: GlobalMetrics;
  networkError: boolean;
  refreshDashboard: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [complaints, setComplaints] = useState<Neo4jComplaint[]>([]);
  const [sensorAlerts, setSensorAlerts] = useState<SensorAlert[]>([]);
  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics>({
    totalComplaints: 0,
    resolved: 0,
    pending: 0,
    escalated: 0,
    criticalZones: 0,
    clustersDetected: 0,
  });
  const [networkError, setNetworkError] = useState(false);

  const fetchData = async () => {
    try {
      // Parallel fetches for efficiency
      const [dashRes, sensorRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/sensor').catch(() => ({ ok: false, json: async () => ({ alerts: [] }) } as Response)),
      ]);

      if (dashRes.ok) {
        const dashData = await dashRes.json();
        const sensorData = sensorRes.ok ? await sensorRes.json().catch(() => ({ alerts: [] })) : { alerts: [] };
        
        setComplaints(dashData.data?.activeList || []);
        
        const stats = dashData.data?.stats || {};
        const criticalZonesCount = dashData.data?.criticalZones?.length || 0;
        
        setGlobalMetrics({
          totalComplaints: stats.total || 0,
          resolved: stats.resolved || 0,
          pending: stats.pending || 0,
          escalated: stats.escalated || 0,
          criticalZones: criticalZonesCount,
          clustersDetected: criticalZonesCount,
        });
        setSensorAlerts(sensorData.alerts || []);
        setNetworkError(false);
      } else {
        setNetworkError(true);
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      setNetworkError(true);
    }
  };

  useEffect(() => {
    fetchData(); // Initial fetch
    
    // High-frequency long-polling
    const interval = setInterval(fetchData, 5000); 
    
    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardContext.Provider value={{
      complaints,
      sensorAlerts,
      globalMetrics,
      networkError,
      refreshDashboard: fetchData
    }}>
      {networkError && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-orange-500 text-white text-xs font-bold text-center py-1">
          Reconnecting to local network...
        </div>
      )}
      {children}
    </DashboardContext.Provider>
  );
};
