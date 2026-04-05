# NodePrism Phase 2 Design — Uptime Checks + Slack Alerting

**Date:** 2026-03-29
**Status:** Approved

---

## Goal

Add HTTP and TCP uptime monitoring to NodePrism. Checks are configured via the API (database-backed), run by a new standalone `checker` package, and trigger Slack alerts on down/recovered events using an incident model.

---

## Architecture

```
[checker]  ←─── GET /api/checks (fetches check configs on startup)
           ──── POST /api/checks/:id/result (posts each ping result)

[api]      ←─── receives result → compares to last incident state
           ──── if newly down: open Incident row, fire Slack webhook
           ──── if recovered: close Incident (resolvedAt), fire Slack webhook

[web]      ──── read-only list of checks + open incidents (display only)
```

The `checker` package runs independently like `agent`. On startup it fetches all active checks from the API, then runs each one on its configured interval using `setInterval`. It never touches the DB directly — all state lives in the API. The API owns incident logic and alerting, keeping the checker stateless and dumb.

### Environment Variables

- `checker`: `API_URL`, `CHECKER_SECRET`
- `api`: `SLACK_WEBHOOK_URL`, `CHECKER_SECRET`

---

## Database Schema

Two new Prisma models:

```prisma
model UptimeCheck {
  id        String     @id @default(cuid())
  name      String
  type      String     // "http" | "tcp"
  target    String     // URL for http, "host:port" for tcp
  interval  Int        @default(60)  // seconds between checks
  createdAt DateTime   @default(now())
  incidents Incident[]
}

model Incident {
  id         String      @id @default(cuid())
  checkId    String
  check      UptimeCheck @relation(fields: [checkId], references: [id])
  startedAt  DateTime    @default(now())
  resolvedAt DateTime?

  @@index([checkId, resolvedAt])
}
```

The `[checkId, resolvedAt]` index makes "is this check currently down?" a fast query (filter `resolvedAt IS NULL`).

### New Zod Schemas (shared package)

- `CreateUptimeCheckSchema` — validates `name`, `type` (`"http"|"tcp"`), `target`, optional `interval`
- `CheckResultSchema` — validates `checkId`, `success: boolean`, `latencyMs: number`, `secret: string`

---

## API Routes

All in `packages/api/src/routes/checks.ts`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/checks` | List all checks with `status: "up"\|"down"` |
| `POST` | `/api/checks` | Create a check |
| `POST` | `/api/checks/:id/result` | Checker posts a ping result |
| `GET` | `/api/checks/:id/incidents` | List incidents for a check |

### `POST /api/checks/:id/result` Logic

```
1. Validate secret (reject 401 if mismatch)
2. Find open incident for this check (resolvedAt IS NULL)
3. success=false AND no open incident  → create Incident, send Slack "DOWN" alert
4. success=true  AND open incident     → set resolvedAt=now(), send Slack "UP" alert
5. success=false AND open incident     → no-op (already alerted)
6. success=true  AND no open incident  → no-op (all good)
```

### Slack Alert Helper

`packages/api/src/lib/slack.ts` — single `sendSlackAlert(text: string)` function using native `fetch()` to POST to `SLACK_WEBHOOK_URL`. No-ops if env var is not set.

---

## checker Package

```
packages/checker/
  src/
    checks/
      http.ts    — fetch() with AbortSignal.timeout(10_000), returns { success, latencyMs }
      tcp.ts     — net.createConnection() with 5s timeout, returns { success, latencyMs }
    runner.ts    — fetches checks from API, schedules each with setInterval
    reporter.ts  — POSTs results to POST /api/checks/:id/result
    index.ts     — entry point, loads env, starts runner
  package.json
  tsconfig.json
  .env
```

### runner.ts Flow

1. On startup: `GET /api/checks` → array of checks
2. For each check: run immediately, then `setInterval(fn, check.interval * 1000)`
3. Each interval: run appropriate check → call reporter with result

### Check Implementations

- **HTTP:** `fetch(target, { signal: AbortSignal.timeout(10_000) })` — success if `status < 400`
- **TCP:** `net.createConnection({ host, port })` wrapped in a Promise — success if `connect` fires within 5s

### Dependencies

- Node built-ins (`net`, `http`) for TCP checks
- `node-fetch` not needed — Node 18+ has native `fetch`
- `axios` for reporter (consistent with agent package)
- `dotenv` for env loading

---

## Web Dashboard Changes

Add a read-only "Uptime" section to the existing dashboard page:
- List of all checks with current status badge (green/red)
- Open incidents shown inline per check

No new pages — extend `packages/web/src/app/page.tsx`.

---

## What Phase 2 Does NOT Include

- Telegram alerting (Phase 3)
- Per-check result history / SLA reporting (Phase 3)
- Check editing or deletion via UI (Phase 3)
- Email alerting
- Response body keyword matching
