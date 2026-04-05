'use client';
import { useState, useEffect } from 'react';
import { useMetrics } from '../hooks/useMetrics';
import { useServers } from '../hooks/useServers';
import { MetricsChart } from '../components/MetricsChart';
import { StatCard } from '../components/StatCard';
import { UptimeChecks } from '../components/UptimeChecks';

export default function Dashboard() {
  const { servers, loading: serversLoading } = useServers();
  const [selectedServerId, setSelectedServerId] = useState<string>('');

  useEffect(() => {
    if (servers.length > 0 && !selectedServerId) {
      setSelectedServerId(servers[0].id);
    }
  }, [servers, selectedServerId]);

  const metrics = useMetrics(selectedServerId);
  const latest = metrics[metrics.length - 1];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">NodePrism Dashboard</h1>
        {serversLoading ? (
          <span className="text-sm text-gray-400">Loading servers...</span>
        ) : servers.length === 0 ? (
          <span className="text-sm text-gray-400">No servers registered</span>
        ) : (
          <select
            value={selectedServerId}
            onChange={(e) => setSelectedServerId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* No server selected */}
      {!selectedServerId && !serversLoading && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No servers registered yet.</p>
          <p className="text-sm mt-2">Start the agent on a machine to register it automatically.</p>
        </div>
      )}

      {/* Metrics — only when server selected */}
      {selectedServerId && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="CPU"     value={latest?.cpu     ?? 0} color="text-blue-600" />
            <StatCard label="Memory"  value={latest?.memory  ?? 0} color="text-purple-600" />
            <StatCard label="Disk"    value={latest?.disk    ?? 0} color="text-orange-600" />
            <StatCard label="Network" value={latest?.network ?? 0} unit=" B/s" color="text-green-600" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricsChart metrics={metrics} dataKey="cpu"     color="#3b82f6" label="CPU Usage %" />
            <MetricsChart metrics={metrics} dataKey="memory"  color="#8b5cf6" label="Memory Usage %" />
            <MetricsChart metrics={metrics} dataKey="disk"    color="#f97316" label="Disk Usage %" />
            <MetricsChart metrics={metrics} dataKey="network" color="#22c55e" label="Network (B/s)" />
          </div>
        </>
      )}

      {/* Uptime Checks — always visible */}
      <div className="mt-8">
        <UptimeChecks />
      </div>
    </main>
  );
}
