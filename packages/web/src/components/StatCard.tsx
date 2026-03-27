'use client';

interface StatCardProps {
  label: string;
  value: number;
  unit?: string;
  color: string;
}

export function StatCard({ label, value, unit = '%', color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-3xl font-bold ${color}`}>
        {value.toFixed(1)}{unit}
      </span>
    </div>
  );
}
