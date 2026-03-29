'use client';
import { useEffect, useState } from 'react';
import { UptimeCheckWithStatus } from '@nodeprism/shared';

export function useUptimeChecks() {
  const [checks, setChecks] = useState<UptimeCheckWithStatus[]>([]);

  useEffect(() => {
    const load = () =>
      fetch('http://localhost:4000/api/checks')
        .then((r) => r.json())
        .then((data: UptimeCheckWithStatus[]) => setChecks(data))
        .catch(console.error);

    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return checks;
}
