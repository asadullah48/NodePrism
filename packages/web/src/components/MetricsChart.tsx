'use client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Metric } from '@nodeprism/shared';

interface MetricsChartProps {
  metrics: Metric[];
  dataKey: keyof Metric;
  color: string;
  label: string;
}

export function MetricsChart({ metrics, dataKey, color, label }: MetricsChartProps) {
  const data = metrics.map((m) => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    value: m[dataKey],
  }));

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="text-sm font-medium text-gray-600 mb-2">{label}</h3>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
