export function computeUptime(
  incidents: { startedAt: Date; resolvedAt: Date | null }[],
  windowStart: Date,
  now: Date
): number {
  const effectiveMs = now.getTime() - windowStart.getTime();
  if (effectiveMs <= 0) return 100;

  // Build clamped intervals
  const intervals: [number, number][] = [];
  for (const incident of incidents) {
    const s = Math.max(incident.startedAt.getTime(), windowStart.getTime());
    const e = Math.min(incident.resolvedAt?.getTime() ?? now.getTime(), now.getTime());
    if (e > s) intervals.push([s, e]);
  }

  // Sort by start, then merge overlaps
  intervals.sort((a, b) => a[0] - b[0]);
  let totalDowntimeMs = 0;
  let mergedEnd = -Infinity;
  for (const [s, e] of intervals) {
    const start = Math.max(s, mergedEnd);
    if (e > start) {
      totalDowntimeMs += e - start;
      mergedEnd = Math.max(mergedEnd, e);
    }
  }

  const uptime = Math.min(100, Math.max(0, (effectiveMs - totalDowntimeMs) / effectiveMs * 100));
  return Math.round(uptime * 10) / 10;
}
