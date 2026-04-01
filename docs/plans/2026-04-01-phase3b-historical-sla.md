# Phase 3b — Historical SLA View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show per-check uptime percentages (24h, 7d, 30d) inline on each check card in the dashboard by extending the existing `GET /api/checks` response.

**Architecture:** Extract a pure `computeUptime` function (testable without Prisma), extend the `GET /api/checks` Prisma query to fetch all incidents in the 30d window, compute three uptime percentages per check server-side, add the fields to the shared `UptimeCheckWithStatus` type, and render them in the check card UI using the `frontend-design` skill.

**Tech Stack:** Express + Prisma + TypeScript (API), `@nodeprism/shared` types (shared), React + Next.js 14 + Tailwind (web), Jest + ts-jest (tests).

---

## Context

- Design doc: `docs/plans/2026-04-01-phase3b-historical-sla-design.md`
- Shared types file: `packages/shared/src/types/index.ts`
- API route file: `packages/api/src/routes/checks.ts`
- Web component: `packages/web/src/components/UptimeChecks.tsx`
- Run shared build: `cd packages/shared && npm run build`
- Run API tests: `cd packages/api && npx jest --no-coverage`
- Run web type check: `cd packages/web && npx tsc --noEmit`
- Existing test pattern: pure functions only, no Prisma mocking (see `src/__tests__/incidents.test.ts`)

### Uptime formula (implement exactly as written)

For a given window (e.g. 24h = 86400000ms):

```
now           = current timestamp (Date)
windowStart   = new Date(Math.max(now.getTime() - windowMs, check.createdAt.getTime()))
effectiveMs   = now.getTime() - windowStart.getTime()

for each incident overlapping [windowStart, now]:
  downtimeStart = max(incident.startedAt.getTime(), windowStart.getTime())
  downtimeEnd   = min(incident.resolvedAt?.getTime() ?? now.getTime(), now.getTime())
  totalDowntimeMs += downtimeEnd - downtimeStart

uptime% = Math.max(0, (effectiveMs - totalDowntimeMs) / effectiveMs * 100)
result  = Math.round(uptime% * 10) / 10   // one decimal place
```

An incident overlaps the window if: `startedAt < now AND (resolvedAt === null OR resolvedAt > windowStart)`

### Window constants (milliseconds)
```
MS_24H = 24 * 60 * 60 * 1000        //   86_400_000
MS_7D  =  7 * 24 * 60 * 60 * 1000   //  604_800_000
MS_30D = 30 * 24 * 60 * 60 * 1000   // 2_592_000_000
```

---

### Task 1: Extend UptimeCheckWithStatus in shared package

**Files:**
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Add three fields to `UptimeCheckWithStatus`**

Open `packages/shared/src/types/index.ts`. Find the `UptimeCheckWithStatus` interface (currently lines 46-48):

```typescript
export interface UptimeCheckWithStatus extends UptimeCheck {
  status: 'up' | 'down';
}
```

Replace it with:

```typescript
export interface UptimeCheckWithStatus extends UptimeCheck {
  status: 'up' | 'down';
  uptime24h: number;  // 0–100, one decimal place
  uptime7d: number;
  uptime30d: number;
}
```

**Step 2: Rebuild shared**

```bash
cd packages/shared && npm run build
```
Expected: no errors, `dist/` updated.

**Step 3: Verify nothing breaks in the API**

```bash
cd packages/api && npx tsc --noEmit
```
Expected: no errors (the API doesn't yet return these fields, but that's fine — TypeScript only checks consumption).

**Step 4: Verify web compiles**

```bash
cd packages/web && npx tsc --noEmit
```
Expected: no errors (the web reads from this type but doesn't yet reference the new fields).

**Step 5: Commit**

```bash
git add packages/shared/src/types/index.ts
git commit -m "feat: add uptime24h/7d/30d fields to UptimeCheckWithStatus"
```

---

### Task 2: Implement computeUptime pure function (TDD)

**Files:**
- Create: `packages/api/src/lib/uptime.ts`
- Create: `packages/api/src/__tests__/uptime.test.ts`

**Step 1: Write the failing tests**

Create `packages/api/src/__tests__/uptime.test.ts` with this content:

```typescript
import { computeUptime } from '../lib/uptime';

// Fixed reference time for all tests
const NOW = new Date('2026-04-01T12:00:00Z');
const MS_24H = 24 * 60 * 60 * 1000;

// Helper: date offset from NOW
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const from = (ms: number) => new Date(NOW.getTime() + ms);

describe('computeUptime', () => {
  it('returns 100 when there are no incidents', () => {
    const windowStart = ago(MS_24H);
    expect(computeUptime([], windowStart, NOW)).toBe(100);
  });

  it('deducts a fully-resolved incident within the window', () => {
    // 1 hour downtime in a 24h window → (24h - 1h) / 24h = 95.8%
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
    // Check created 12h ago, but window is 24h — effective window is only 12h
    // No incidents → should still be 100%
    const checkCreatedAt = ago(12 * 60 * 60 * 1000);
    const windowStart = new Date(Math.max(ago(MS_24H).getTime(), checkCreatedAt.getTime()));
    expect(computeUptime([], windowStart, NOW)).toBe(100);
  });

  it('returns 0 when the entire window is downtime', () => {
    // 24h downtime in 24h window
    const incidents = [{ startedAt: ago(MS_24H), resolvedAt: null }];
    const windowStart = ago(MS_24H);
    expect(computeUptime(incidents, windowStart, NOW)).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/api && npx jest --no-coverage uptime
```
Expected: FAIL with "Cannot find module '../lib/uptime'"

**Step 3: Implement computeUptime**

Create `packages/api/src/lib/uptime.ts`:

```typescript
export function computeUptime(
  incidents: { startedAt: Date; resolvedAt: Date | null }[],
  windowStart: Date,
  now: Date
): number {
  const effectiveMs = now.getTime() - windowStart.getTime();
  if (effectiveMs <= 0) return 100;

  let totalDowntimeMs = 0;

  for (const incident of incidents) {
    const downtimeStart = Math.max(incident.startedAt.getTime(), windowStart.getTime());
    const downtimeEnd = Math.min(
      incident.resolvedAt?.getTime() ?? now.getTime(),
      now.getTime()
    );
    if (downtimeEnd > downtimeStart) {
      totalDowntimeMs += downtimeEnd - downtimeStart;
    }
  }

  const uptime = Math.max(0, (effectiveMs - totalDowntimeMs) / effectiveMs * 100);
  return Math.round(uptime * 10) / 10;
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/api && npx jest --no-coverage uptime
```
Expected: 6/6 tests pass.

**Step 5: Run all API tests to confirm nothing broken**

```bash
cd packages/api && npx jest --no-coverage
```
Expected: all 12 tests pass (6 existing + 6 new).

**Step 6: Commit**

```bash
git add packages/api/src/lib/uptime.ts packages/api/src/__tests__/uptime.test.ts
git commit -m "feat: add computeUptime pure function with tests"
```

---

### Task 3: Extend GET /api/checks to include uptime stats

**Files:**
- Modify: `packages/api/src/routes/checks.ts`

**Step 1: Add the uptime import**

At the top of `packages/api/src/routes/checks.ts`, add the import after existing imports:

```typescript
import { computeUptime } from '../lib/uptime';
```

**Step 2: Replace the GET / handler**

Find the existing `checksRouter.get('/', ...)` handler (lines 11–38). Replace the entire handler with:

```typescript
const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D  =  7 * 24 * 60 * 60 * 1000;
const MS_30D = 30 * 24 * 60 * 60 * 1000;

// List all checks with current status and uptime stats
checksRouter.get('/', async (_req, res) => {
  try {
    const now = new Date();
    const window30dStart = new Date(now.getTime() - MS_30D);

    const checks = await prisma.uptimeCheck.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        incidents: {
          where: {
            startedAt: { lt: now },
            OR: [
              { resolvedAt: null },
              { resolvedAt: { gt: window30dStart } },
            ],
          },
        },
      },
    });

    const result = checks.map((c) => {
      const windowStart24h = new Date(Math.max(now.getTime() - MS_24H, c.createdAt.getTime()));
      const windowStart7d  = new Date(Math.max(now.getTime() - MS_7D,  c.createdAt.getTime()));
      const windowStart30d = new Date(Math.max(now.getTime() - MS_30D, c.createdAt.getTime()));

      return {
        id: c.id,
        name: c.name,
        type: c.type,
        target: c.target,
        interval: c.interval,
        createdAt: c.createdAt,
        status: c.incidents.some((i) => i.resolvedAt === null) ? 'down' : 'up',
        uptime24h: computeUptime(c.incidents, windowStart24h, now),
        uptime7d:  computeUptime(c.incidents, windowStart7d,  now),
        uptime30d: computeUptime(c.incidents, windowStart30d, now),
      };
    });

    res.json(result);
  } catch (err) {
    console.error('GET /checks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Note: the `status` check changed from `c.incidents.length > 0` to `c.incidents.some((i) => i.resolvedAt === null)` because the query now returns more incidents (not just open ones).

**Step 3: Verify the API compiles**

```bash
cd packages/api && npx tsc --noEmit
```
Expected: no errors.

**Step 4: Run all tests**

```bash
cd packages/api && npx jest --no-coverage
```
Expected: all 12 tests pass.

**Step 5: Commit**

```bash
git add packages/api/src/routes/checks.ts
git commit -m "feat: extend GET /api/checks with uptime24h/7d/30d stats"
```

---

### Task 4: Update check card UI to show uptime stats

**Files:**
- Modify: `packages/web/src/components/UptimeChecks.tsx`

**Step 1: Invoke frontend-design skill**

> **REQUIRED:** Before writing any UI code, invoke the `frontend-design:frontend-design` skill with this prompt:
> "Update the check card in the NodePrism `UptimeChecks` component (dark/modern monitoring dashboard). Each check card currently shows: name, type/target on a second line, UP/DOWN badge, and a trash delete button. Add a third line below type/target showing three uptime stats: `24h: 99.9%  7d: 98.2%  30d: 97.1%`. Each percentage is color-coded: green (≥ 99%), amber (95–99%), red (< 95%). The values come from `check.uptime24h`, `check.uptime7d`, `check.uptime30d` (all numbers 0–100). Keep the existing card structure and Tailwind styling. No new components — just update the card JSX inside the `.map()` in the checks grid."

**Step 2: Apply the UI change**

Read `packages/web/src/components/UptimeChecks.tsx` first. Then update only the card JSX inside the `checks.map(...)` block. The card currently has:

```tsx
<div key={check.id} className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
  <div>
    <p className="font-medium text-gray-800">{check.name}</p>
    <p className="text-xs text-gray-400 mt-0.5">
      {check.type.toUpperCase()} · {check.target}
    </p>
  </div>
  <div className="flex items-center gap-2">
    ...badge + delete button...
  </div>
</div>
```

Add the stats row after the type/target line. The color helper for each stat value:

```tsx
function uptimeColor(pct: number): string {
  if (pct >= 99) return 'text-green-600';
  if (pct >= 95) return 'text-amber-500';
  return 'text-red-500';
}
```

Define `uptimeColor` as a module-level function (outside the component, before `export function UptimeChecks`).

The stats row JSX:

```tsx
<p className="text-xs mt-1 space-x-2">
  <span className={uptimeColor(check.uptime24h)}>24h: {check.uptime24h.toFixed(1)}%</span>
  <span className="text-gray-300">·</span>
  <span className={uptimeColor(check.uptime7d)}>7d: {check.uptime7d.toFixed(1)}%</span>
  <span className="text-gray-300">·</span>
  <span className={uptimeColor(check.uptime30d)}>30d: {check.uptime30d.toFixed(1)}%</span>
</p>
```

Also: change the outer card div from `flex items-center justify-between` to `flex items-start justify-between` since the left side now has three lines.

**Step 3: Verify web compiles**

```bash
cd packages/web && npx tsc --noEmit
```
Expected: no errors. TypeScript will confirm `check.uptime24h` etc. exist on `UptimeCheckWithStatus`.

**Step 4: Run all API tests one final time**

```bash
cd packages/api && npx jest --no-coverage
```
Expected: all 12 tests pass.

**Step 5: Commit**

```bash
git add packages/web/src/components/UptimeChecks.tsx
git commit -m "feat: show uptime24h/7d/30d stats on each check card"
```

---

## Verification Checklist

After all tasks complete, manually verify:
- [ ] `npm run dev` starts without errors in `packages/api` and `packages/web`
- [ ] `GET http://localhost:4000/api/checks` response includes `uptime24h`, `uptime7d`, `uptime30d` fields
- [ ] Dashboard check cards show three uptime percentages
- [ ] Green/amber/red coloring works correctly
- [ ] A check with no incidents shows 100.0% for all three windows
- [ ] API tests: 12/12 pass
