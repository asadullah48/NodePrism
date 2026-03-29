'use client';
import { UptimeCheckWithStatus } from '@nodeprism/shared';

interface Props {
  checks: UptimeCheckWithStatus[];
}

export function UptimeChecks({ checks }: Props) {
  if (checks.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        No uptime checks configured. POST to /api/checks to add one.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {checks.map((check) => (
        <div
          key={check.id}
          className="bg-white rounded-xl shadow p-4 flex items-center justify-between"
        >
          <div>
            <p className="font-medium text-gray-800">{check.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {check.type.toUpperCase()} · {check.target}
            </p>
          </div>
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              check.status === 'up'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {check.status.toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  );
}
