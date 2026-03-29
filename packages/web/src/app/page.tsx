'use client';
import { useMetrics } from '../hooks/useMetrics';
import { MetricsChart } from '../components/MetricsChart';
import { StatCard } from '../components/StatCard';
import { useUptimeChecks } from '../hooks/useUptimeChecks';
import { UptimeChecks } from '../components/UptimeChecks';

const SERVER_ID = 'cmn9at38y0000o6wsd328esn2';

export default function Dashboard() {
  const metrics = useMetrics(SERVER_ID);
  const { checks: uptimeChecks, loading: uptimeLoading } = useUptimeChecks();
  const latest = metrics[metrics.length - 1];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">NodePrism Dashboard</h1>

      {/* Live stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="CPU" value={latest?.cpu ?? 0} color="text-blue-600" />
        <StatCard label="Memory" value={latest?.memory ?? 0} color="text-purple-600" />
        <StatCard label="Disk" value={latest?.disk ?? 0} color="text-orange-600" />
        <StatCard label="Network" value={latest?.network ?? 0} unit=" B/s" color="text-green-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricsChart metrics={metrics} dataKey="cpu" color="#3b82f6" label="CPU Usage %" />
        <MetricsChart metrics={metrics} dataKey="memory" color="#8b5cf6" label="Memory Usage %" />
        <MetricsChart metrics={metrics} dataKey="disk" color="#f97316" label="Disk Usage %" />
        <MetricsChart metrics={metrics} dataKey="network" color="#22c55e" label="Network (B/s)" />
      </div>
      {/* Uptime Checks */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Uptime Checks</h2>
        <UptimeChecks checks={uptimeChecks} loading={uptimeLoading} />
      </div>
    </main>
  );
}
