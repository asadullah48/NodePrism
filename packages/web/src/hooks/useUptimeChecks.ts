'use client';
import { useEffect, useState, useCallback } from 'react';
import { UptimeCheckWithStatus, CreateUptimeCheckInput } from '@nodeprism/shared';

export function useUptimeChecks() {
  const [checks, setChecks] = useState<UptimeCheckWithStatus[]>([]);
  // true only during initial load; background polls and mutations update state silently
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() =>
    fetch('http://localhost:4000/api/checks')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setChecks(data as UptimeCheckWithStatus[]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 30_000);
    return () => clearInterval(interval);
  }, [refetch]);

  const addCheck = useCallback(async (data: CreateUptimeCheckInput) => {
    const res = await fetch('http://localhost:4000/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    await refetch();
  }, [refetch]);

  const deleteCheck = useCallback(async (id: string) => {
    const res = await fetch(`http://localhost:4000/api/checks/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text());
    await refetch();
  }, [refetch]);

  return { checks, loading, refetch, addCheck, deleteCheck };
}
