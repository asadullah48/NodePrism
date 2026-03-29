# NodePrism — Claude Code Context

Full-stack server monitoring platform. Learn full-stack dev by building real features phase by phase.

## Monorepo Layout

```
D:\NodePrism\
├── packages/
│   ├── shared/     @nodeprism/shared  — TypeScript types + Zod schemas (consumed by all)
│   ├── api/        @nodeprism/api     — Express + Prisma + Socket.IO (port 4000)
│   ├── agent/      @nodeprism/agent   — systeminformation collector, POSTs metrics every 5s
│   ├── checker/    @nodeprism/checker — HTTP/TCP uptime checks, POSTs results to API
│   └── web/        web               — Next.js 14 dashboard (port 3000)
├── infrastructure/docker/            — docker-compose.yml (postgres + redis)
└── docs/plans/                       — phase implementation plans
```

## Start Everything

```bash
# 1. Infrastructure (must be first)
cd D:\NodePrism\infrastructure\docker && docker compose up -d

# 2. API (always use npm run dev — preload.js handles env override)
cd D:\NodePrism\packages\api && npm run dev

# 3. Agent (posts system metrics every 5s)
cd D:\NodePrism\packages\agent && npm run dev

# 4. Checker (runs uptime checks on interval)
cd D:\NodePrism\packages\checker && npm run dev

# 5. Web dashboard
cd D:\NodePrism\packages\web && npm run dev
```

## Run Tests

```bash
cd D:\NodePrism\packages\api     && npx jest --no-coverage   # 6 tests
cd D:\NodePrism\packages\checker && npx jest --no-coverage --testTimeout=10000  # 6 tests
```

## Environment Variables

### packages/api/.env
```
DATABASE_URL=postgresql://nodeprism:nodeprism@localhost:5432/nodeprism
REDIS_URL=redis://localhost:6379
PORT=4000
CHECKER_SECRET=nodeprism-checker-secret
SLACK_WEBHOOK_URL=<optional — Slack incoming webhook for alerts>
```

### packages/agent/.env
```
API_URL=http://localhost:4000
SERVER_ID=cmn9at38y0000o6wsd328esn2
INTERVAL_MS=5000
```

### packages/checker/.env
```
API_URL=http://localhost:4000
CHECKER_SECRET=nodeprism-checker-secret
```

### Windows env conflict
The system environment has `DATABASE_URL=postgresql+asyncpg://...` from another project.
`packages/api/preload.js` (loaded via `-r ./preload.js` in the dev script) forces `.env` values
to override system vars. Never remove preload.js or the `-r` flag from the dev script.

## API Routes

```
GET  /health                         — liveness check
GET  /api/servers                    — list servers
POST /api/servers                    — create server { name, host }
POST /api/metrics                    — agent posts metrics (Zod validated)
GET  /api/metrics/:serverId          — last 60 readings for a server
GET  /api/checks                     — list checks with live status (up|down)
POST /api/checks                     — create check { name, type, target, interval }
POST /api/checks/:id/result          — checker posts result (Authorization: Bearer <secret>)
GET  /api/checks/:id/incidents       — incident history for a check
```

## Database (Prisma + PostgreSQL)

```prisma
Server      { id, name, host, createdAt }
Metric      { id, serverId, cpu, memory, disk, network, timestamp }
UptimeCheck { id, name, type(CheckType enum: http|tcp), target, interval, createdAt }
Incident    { id, checkId, startedAt, resolvedAt? }   ← null resolvedAt = currently DOWN
```

Migrations: `cd packages/api && npx prisma migrate dev --name <description>`
Regenerate client: `npx prisma generate`

## Socket.IO

API broadcasts on event `metric:update` with a `Metric` object whenever the agent POSTs.
Web subscribes via `packages/web/src/lib/socket.ts` → `getSocket()` singleton.

## Shared Package

All types and Zod schemas live in `packages/shared/src/`.
After any change: `cd packages/shared && npm run build` (outputs to `dist/`).
Other packages import from `@nodeprism/shared` — always use the dist, not src directly.

Key exports:
- `MetricPayloadSchema` — Zod, used by API to validate agent POST
- `CreateUptimeCheckSchema` — Zod, used by API to validate check creation
- `CheckResultSchema` — Zod, used by API to validate checker result POST
- `UptimeCheckWithStatus` — interface, used by web hook + checker runner

## Checker Auth

Checker → API uses `Authorization: Bearer <secret>` header (not body).
API validates with `crypto.timingSafeEqual` against `process.env.CHECKER_SECRET`.
Both packages must have the same `CHECKER_SECRET` value in their `.env`.

## Phase History

- **Phase 1** — Live metrics dashboard (agent → API → Socket.IO → Recharts charts)
- **Phase 2** — Uptime checks + Slack alerting (checker package, incidents, DOWN/UP webhooks)
- **Phase 3** — TBD

## Code Conventions

- TypeScript strict mode throughout
- Zod for all external input validation (API boundaries only — no internal validation)
- Express routes: always try/catch with `console.error` + `res.status(500).json({ error: 'Internal server error' })`
- Prisma: never instantiate PrismaClient directly — use the singleton from `packages/api/src/lib/prisma.ts`
- Tests: Jest + ts-jest, files in `src/__tests__/*.test.ts`, TDD (write failing test first)
- Commits: conventional commits (`feat:`, `fix:`, `docs:`)
- No mocking of Prisma in tests — pure logic extracted to separate functions and tested directly

## Known Issues / Gotchas

- `packages/web` hardcodes `http://localhost:4000` — fine for local dev, fix when deploying
- Web dashboard page.tsx is fully client-side (`'use client'`) — existing Phase 1 design decision
- `UptimeCheckWithStatus.status` is derived at query time (not stored) — computed from open incidents
- TCP check on Windows gives immediate refusal (fast) rather than timeout for closed ports — expected
