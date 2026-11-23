import { useState } from 'react';
import { Cpu } from 'lucide-react';

export default function IotDashboardView() {
  const [nodes] = useState([
    {
      id: 'iot-ghz-sl-01',
      name: 'Indirapuram Central Sector 4 Streetlight Array',
      location: 'Ward 01 (Indirapuram)',
      status: 'ONLINE',
      ldrValue: 840,
      lastHeartbeat: new Date().toLocaleTimeString(),
    },
    {
      id: 'iot-ghz-sl-02',
      name: 'Vaishali Sector 3 High-Mast Pole',
      location: 'Ward 02 (Vaishali)',
      status: 'FAULT',
      ldrValue: 120,
      lastHeartbeat: new Date(Date.now() - 360000).toLocaleTimeString(),
    },
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          IoT Edge Telemetry Console
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Live hardware monitoring for Arduino UNO Q & Linux MPU edge sensors connected to street infrastructure
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {nodes.map((node) => {
          const isFault = node.status === 'FAULT';

          return (
            <div
              key={node.id}
              className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6 sm:p-8 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      isFault ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    <Cpu size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{node.name}</h3>
                    <span className="text-xs text-gray-500 font-mono">{node.id}</span>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isFault ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {node.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 font-semibold block">Ward</span>
                  <span className="font-bold text-gray-900">{node.location}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block">LDR Lux Level</span>
                  <span className="font-mono font-bold text-gray-900">{node.ldrValue}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-gray-500 font-semibold">Last Heartbeat</span>
                  <span className="text-gray-700 font-medium">{node.lastHeartbeat}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
