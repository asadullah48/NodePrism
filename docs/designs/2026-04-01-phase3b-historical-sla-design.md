# Phase 3b — Historical SLA View: Design

**Date:** 2026-04-01
**Status:** Approved

## Goal

Show per-check uptime percentages (24h, 7d, 30d) inline on each check card in the dashboard. No new API endpoints — the existing `GET /api/checks` response is extended.

## Scope

- Extend `GET /api/checks` to include `uptime24h`, `uptime7d`, `uptime30d` per check
- Extract `computeUptime` as a pure testable function
- Add uptime stats row to each check card in the UI

Out of scope: historical sparklines, per-incident drill-down, CSV export, SLA alerts.

---

## Uptime Calculation

For each time window (24h = 86400s, 7d = 604800s, 30d = 2592000s):

```
windowStart = max(now - windowDuration, check.createdAt)
effectiveWindowMs = now - windowStart
```

Using `check.createdAt` as the floor means new checks are not penalized for time before they existed.

For each incident overlapping the window (`startedAt < now AND (resolvedAt IS NULL OR resolvedAt > windowStart)`):

```
downtimeMs += min(resolvedAt ?? now, now) - max(startedAt, windowStart)
uptime% = (effectiveWindowMs - totalDowntimeMs) / effectiveWindowMs × 100
```

Result is clamped to `[0, 100]` and rounded to one decimal place.

---

## API Changes

### `GET /api/checks` response (extended)

Each check object gains three new fields:

```json
{
  "id": "...",
  "name": "...",
  "type": "http",
  "target": "https://example.com",
  "interval": 60,
  "createdAt": "...",
  "status": "up",
  "uptime24h": 100.0,
  "uptime7d": 99.8,
  "uptime30d": 99.2
}
```

### Query change

The Prisma query fetches all incidents touching the 30d window (the widest window covers the others):

```typescript
incidents: {
  where: {
    startedAt: { lt: now },
    OR: [
      { resolvedAt: null },
      { resolvedAt: { gt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }
    ]
  }
}
```

### Pure function — `packages/api/src/lib/uptime.ts`

```typescript
export function computeUptime(
  incidents: { startedAt: Date; resolvedAt: Date | null }[],
  windowStart: Date,
  now: Date
): number
```

Extracted so it can be unit-tested without Prisma.

---

## Shared Types

`UptimeCheckWithStatus` in `packages/shared/src/types/index.ts` gains:

```typescript
export interface UptimeCheckWithStatus extends UptimeCheck {
  status: 'up' | 'down';
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
}
```

No new Zod schemas needed.

---

## Web Changes

Each check card gains a stats row below the type/target line:

```
24h: 100.0%  7d: 99.8%  30d: 99.2%
```

Color coding:
- ≥ 99% → green
- 95–99% → amber
- < 95% → red

No new hook, no new API call — `useUptimeChecks` already fetches `GET /api/checks` and the new fields are included in the response.

The `frontend-design` skill is used when updating the card UI.

---

## Testing

New file: `packages/api/src/__tests__/uptime.test.ts`

Test cases for `computeUptime`:
1. No incidents → 100
2. Fully resolved incident within window → correct downtime deducted
3. Open (unresolved) incident → downtime counted to `now`
4. Incident that started before `windowStart` → clamped to `windowStart`
5. Check created after window start → effective window is smaller (no penalty)
6. Full-window downtime → 0

---

## Build Order

1. Shared: add `uptime24h/7d/30d` to `UptimeCheckWithStatus` + rebuild
2. API: create `computeUptime` pure function + tests (TDD)
3. API: extend `GET /api/checks` to use `computeUptime`
4. Web: update check card UI to show uptime stats (via `frontend-design` skill)
