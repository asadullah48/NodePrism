# Phase 4a — Multi-Server Agent Self-Registration: Design

**Date:** 2026-04-01
**Status:** Approved

## Goal

Agents self-register at startup via `POST /api/servers` using `os.hostname()` as their unique identifier. No hardcoded `SERVER_ID` in `.env`. Multiple agents on different machines register independently and appear in a server selector on the dashboard.

## Scope

- Unique constraint on `Server.host` + migration
- `POST /api/servers` becomes an upsert
- Agent: `register.ts` module with retry logic, removes `SERVER_ID` from `.env`
- Web: `useServers` hook + server selector dropdown in dashboard header
- Tests: `buildRegistrationPayload` pure function in agent

Out of scope: server deletion UI, per-server uptime checks, server health indicators.

---

## Database + API Changes

### Prisma schema

Add `@unique` to `Server.host`:

```prisma
model Server {
  id        String   @id @default(cuid())
  name      String
  host      String   @unique
  createdAt DateTime @default(now())
  metrics   Metric[]
}
```

Run: `cd packages/api && npx prisma migrate dev --name add-unique-host`

### `POST /api/servers` — upsert behavior

```typescript
const server = await prisma.server.upsert({
  where: { host: parsed.data.host },
  update: { name: parsed.data.name },
  create: parsed.data,
});
res.json(server); // 200 always
```

- Returns existing server if host already registered (updates name in case it changed)
- Creates new server if host is new
- Always `200 OK` (not `201` — upsert is idempotent)

---

## Agent Changes

### New file: `packages/agent/src/register.ts`

```typescript
export function buildRegistrationPayload(
  hostname: string,
  serverName?: string
): { name: string; host: string } {
  return {
    name: serverName && serverName.trim() ? serverName.trim() : hostname,
    host: hostname,
  };
}

export async function registerAgent(apiUrl: string, hostname: string, serverName?: string): Promise<string> {
  // POST { name, host } to /api/servers
  // Returns server id
  // Throws on non-ok response
}
```

### `packages/agent/src/index.ts`

- Import `os` for `os.hostname()`
- Remove `SERVER_ID` env var check
- Add `SERVER_NAME` optional env var
- Call `registerAgent` with retry (5 attempts, 3s apart) before starting metric loop
- On all retries exhausted → `process.exit(1)`

### `packages/agent/.env`

```
API_URL=http://localhost:4000
INTERVAL_MS=5000
# SERVER_NAME=My Custom Name   ← optional, defaults to os.hostname()
```

Remove `SERVER_ID=cmn9at38y0000o6wsd328esn2`

---

## Web Changes

### New hook: `packages/web/src/hooks/useServers.ts`

- Fetches `GET /api/servers` on mount (no polling)
- Returns `{ servers: Server[], loading: boolean }`

### `packages/web/src/app/page.tsx`

- Import `useServers`
- `useState` for `selectedServerId` — defaults to `servers[0]?.id` when loaded
- Server selector dropdown in dashboard header (right-aligned, next to title)
- Pass `selectedServerId` to `useMetrics`
- Empty state when no servers registered

### Empty state message

```
No servers registered yet.
Start the agent on a machine to register it automatically.
```

---

## Testing

### New file: `packages/agent/src/__tests__/register.test.ts`

Tests for `buildRegistrationPayload`:
1. No `serverName` → `name` equals hostname
2. `serverName` provided → `name` uses it, `host` still equals hostname
3. Empty string `serverName` → falls back to hostname
4. Whitespace-only `serverName` → falls back to hostname

---

## Build Order

1. API: add `@unique` to `Server.host` + run migration
2. API: update `POST /api/servers` to upsert
3. Agent: create `register.ts` with `buildRegistrationPayload` + `registerAgent` + tests (TDD)
4. Agent: update `index.ts` — remove `SERVER_ID`, add registration + retry loop
5. Web: create `useServers` hook
6. Web: update `page.tsx` with server selector
