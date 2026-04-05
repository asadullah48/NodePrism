'use client';
import { useEffect, useState } from 'react';
import { Server } from '@nodeprism/shared';

export function useServers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:4000/api/servers')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setServers(data as Server[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { servers, loading };
}
