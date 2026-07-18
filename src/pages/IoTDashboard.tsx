import { useEffect, useState } from 'react';
import { Cpu, Activity, AlertTriangle, Clock, MapPin, Database } from 'lucide-react';
import type { Page } from '../types';

interface IoTDashboardProps {
  onNavigate: (page: Page) => void;
}

interface SensorData {
  id: string;
  device_id: string;
  type: string;
  status: string;
  lat: number;
  lng: number;
  ward: string;
  department: string;
  description: string;
  severity: string;
  area: string;
  createdAt: string;
}

export default function IoTDashboard({ onNavigate }: IoTDashboardProps) {
  const [sensors, setSensors] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const res = await fetch('/api/sensor');
        if (res.ok) {
          const data = await res.json();
          setSensors(data.alerts || []);
        }
      } catch (e) {
        console.error('Failed to fetch sensor data', e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSensors();
    const interval = setInterval(fetchSensors, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalFaults = sensors.filter(s => s.status === 'FAULT').length;
  
  return (
    <div className="min-h-screen bg-gray-950 pt-20">
      <div className="bg-gray-950 border-b border-gray-800 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="text-blue-500" size={24} />
              <h1 className="text-3xl font-black text-white">IoT Node Monitor</h1>
            </div>
            <p className="text-gray-400 text-sm">Real-time telemetry and fault detection from Arduino Uno Q nodes.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex flex-col items-center min-w-[120px]">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Active Faults</span>
              <span className="text-2xl font-black text-red-500">{totalFaults}</span>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex flex-col items-center min-w-[120px]">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">System Status</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-sm font-bold text-green-400">ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
            <div className="flex items-center gap-2 text-white font-bold">
              <Activity size={18} className="text-blue-400" />
              Recent Telemetry Logs
            </div>
            {loading && <span className="text-xs text-gray-500 flex items-center gap-1"><Database size={12} className="animate-pulse" /> Syncing...</span>}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="text-xs text-gray-500 uppercase bg-gray-800/50 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 font-bold">Device ID</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold">Type</th>
                  <th className="px-6 py-4 font-bold">Location</th>
                  <th className="px-6 py-4 font-bold">Department</th>
                  <th className="px-6 py-4 font-bold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sensors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No active sensor faults detected.
                    </td>
                  </tr>
                ) : (
                  sensors.map((sensor) => (
                    <tr key={sensor.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                        <Cpu size={14} className="text-gray-500" />
                        {sensor.device_id || 'UNKNOWN'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-950 text-red-400 border border-red-900/50">
                          <AlertTriangle size={10} /> FAULT
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300 font-medium">{sensor.type || 'Electrical/Lighting'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className="text-gray-500" />
                          <span>{sensor.ward || sensor.area || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {sensor.department || 'Maintenance'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-500 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(sensor.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
