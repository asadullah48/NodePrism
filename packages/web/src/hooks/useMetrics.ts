'use client';
import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';
import { Metric } from '@nodeprism/shared';

const MAX_POINTS = 60;

export function useMetrics(serverId: string) {
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    if (!serverId) return;
    // Load historical metrics
    fetch(`http://localhost:4000/api/metrics/${serverId}`)
      .then((r) => r.json())
      .then((data: unknown) => { if (Array.isArray(data)) setMetrics(data as Metric[]); })
      .catch(console.error);

    // Subscribe to live updates using named handler for correct cleanup
    const socket = getSocket();
    const handler = (metric: Metric) => {
      if (metric.serverId !== serverId) return;
      setMetrics((prev) => [...prev.slice(-MAX_POINTS + 1), metric]);
    };
    socket.on('metric:update', handler);

    return () => { socket.off('metric:update', handler); };
  }, [serverId]);

  return metrics;
}
