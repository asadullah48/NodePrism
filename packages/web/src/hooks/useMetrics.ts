'use client';
import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';
import { Metric } from '@nodeprism/shared';

const MAX_POINTS = 60;

export function useMetrics(serverId: string) {
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    // Load historical metrics
    fetch(`http://localhost:4000/api/metrics/${serverId}`)
      .then((r) => r.json())
      .then((data: Metric[]) => setMetrics(data));

    // Subscribe to live updates
    const socket = getSocket();
    socket.on('metric:update', (metric: Metric) => {
      if (metric.serverId !== serverId) return;
      setMetrics((prev) => [...prev.slice(-MAX_POINTS + 1), metric]);
    });

    return () => { socket.off('metric:update'); };
  }, [serverId]);

  return metrics;
}
