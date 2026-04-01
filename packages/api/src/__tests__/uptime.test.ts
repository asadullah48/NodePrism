import { computeUptime } from '../lib/uptime';

// Fixed reference time for all tests
const NOW = new Date('2026-04-01T12:00:00Z');
const MS_24H = 24 * 60 * 60 * 1000;

// Helper: date offset from NOW
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('computeUptime', () => {
  it('returns 100 when there are no incidents', () => {
    const windowStart = ago(MS_24H);
    expect(computeUptime([], windowStart, NOW)).toBe(100);
  });

  it('deducts a fully-resolved incident within the window', () => {
    // 1 hour downtime in a 24h window → (24h - 1h) / 24h * 100 = 95.8333...% → 95.8
    const incidents = [
      { startedAt: ago(2 * 60 * 60 * 1000), resolvedAt: ago(1 * 60 * 60 * 1000) },
    ];
    const windowStart = ago(MS_24H);
    const result = computeUptime(incidents, windowStart, NOW);
    expect(result).toBe(95.8);
  });

  it('counts an open incident up to now', () => {
    // Open for the last 12h of a 24h window → 50% uptime
    const incidents = [{ startedAt: ago(12 * 60 * 60 * 1000), resolvedAt: null }];
    const windowStart = ago(MS_24H);
    const result = computeUptime(incidents, windowStart, NOW);
    expect(result).toBe(50);
  });

  it('clamps incident start to windowStart when it started before the window', () => {
    // Incident started 48h ago, resolved 12h ago — only 12h overlaps the 24h window
    const incidents = [
      { startedAt: ago(48 * 60 * 60 * 1000), resolvedAt: ago(12 * 60 * 60 * 1000) },
    ];
    const windowStart = ago(MS_24H);
    // 12h downtime in 24h window → 50% uptime
    const result = computeUptime(incidents, windowStart, NOW);
    expect(result).toBe(50);
  });

  it('uses a shorter effective window when check is newer than window start', () => {
    // Check created 12h ago — effective window is 12h, not 24h
    // Incident lasted 6h within that 12h window → 50% uptime
    const checkCreatedAt = ago(12 * 60 * 60 * 1000);
    const windowStart = new Date(Math.max(ago(MS_24H).getTime(), checkCreatedAt.getTime()));
    const incidents = [
      { startedAt: ago(8 * 60 * 60 * 1000), resolvedAt: ago(2 * 60 * 60 * 1000) },
    ];
    // effectiveMs = 12h, downtimeMs = 6h → uptime = 50%
    const result = computeUptime(incidents, windowStart, NOW);
    expect(result).toBe(50);
  });

  it('returns 0 when the entire window is downtime', () => {
    // Incident started exactly at window start and is still open
    const incidents = [{ startedAt: ago(MS_24H), resolvedAt: null }];
    const windowStart = ago(MS_24H);
    expect(computeUptime(incidents, windowStart, NOW)).toBe(0);
  });
});
