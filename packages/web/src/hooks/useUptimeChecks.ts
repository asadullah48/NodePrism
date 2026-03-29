'use client';
import { useEffect, useState } from 'react';
import { UptimeCheckWithStatus } from '@nodeprism/shared';

export function useUptimeChecks() {
  const [checks, setChecks] = useState<UptimeCheckWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch('http://localhost:4000/api/checks')
        .then((r) => r.json())
        .then((data: unknown) => {
          if (Array.isArray(data)) {
            setChecks(data as UptimeCheckWithStatus[]);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));

    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return { checks, loading };
}
