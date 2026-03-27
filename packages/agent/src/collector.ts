import si from 'systeminformation';
import { MetricPayload } from '@nodeprism/shared';

export async function collectMetrics(serverId: string): Promise<MetricPayload> {
  const [cpu, mem, disk, net] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
  ]);

  const diskUsed = disk[0]
    ? (disk[0].used / disk[0].size) * 100
    : 0;

  const networkBytesPerSec = net[0]
    ? (net[0].rx_sec ?? 0) + (net[0].tx_sec ?? 0)
    : 0;

  return {
    serverId,
    cpu: Math.round(cpu.currentLoad * 10) / 10,
    memory: Math.round((mem.used / mem.total) * 1000) / 10,
    disk: Math.round(diskUsed * 10) / 10,
    network: Math.round(networkBytesPerSec),
  };
}
