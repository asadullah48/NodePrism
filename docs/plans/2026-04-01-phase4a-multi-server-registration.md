# Phase 4a — Multi-Server Agent Self-Registration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agents self-register at startup via `POST /api/servers` using `os.hostname()`, eliminating the hardcoded `SERVER_ID` and enabling the web dashboard to show metrics from any registered server via a dropdown.

**Architecture:** Add a `@unique` constraint on `Server.host` and convert `POST /api/servers` to an upsert; add a `register.ts` module to the agent that POSTs `{ name, host }` and gets back an `id` to use for all metric posts; replace the hardcoded `SERVER_ID` constant in `page.tsx` with a `useServers` hook + server selector dropdown.

**Tech Stack:** Prisma migrations, Express upsert, Node.js `os` module, axios (already in agent), Jest + ts-jest (new to agent package), React `useState` + Next.js 14.

---

## Context

- Design doc: `docs/plans/2026-04-01-phase4a-multi-server-registration-design.md`
- API schema: `packages/api/prisma/schema.prisma`
- API servers route: `packages/api/src/routes/servers.ts`
- Agent entry: `packages/agent/src/index.ts`
- Agent env: `packages/agent/.env`
- Web page: `packages/web/src/app/page.tsx`
- Shared `Server` type: `packages/shared/src/types/index.ts` — `{ id, name, host, createdAt }`
- Run API tests: `cd packages/api && npx jest --no-coverage` (13 tests currently passing)
- Run agent tests: `cd packages/agent && npx jest --no-coverage` (new)
- Agent uses `axios` for HTTP (already installed)
- `os.hostname()` is built into Node.js — no install needed

---

### Task 1: Add unique constraint to Server.host + run migration

**Files:**
- Modify: `packages/api/prisma/schema.prisma`

**Step 1: Add `@unique` to `Server.host`**

Open `packages/api/prisma/schema.prisma`. Find the `Server` model:

```prisma
model Server {
  id        String   @id @default(cuid())
  name      String
  host      String
  createdAt DateTime @default(now())
  metrics   Metric[]
}
```

Change `host String` to `host String @unique`:

```prisma
model Server {
  id        String   @id @default(cuid())
  name      String
  host      String   @unique
  createdAt DateTime @default(now())
  metrics   Metric[]
}
```

**Step 2: Run the migration**

```bash
cd packages/api && npx prisma migrate dev --name add-unique-host
```

Expected output: `The following migration(s) have been applied: ... add-unique-host`

If prompted "We need to reset the database" — this is safe in development. Type `y`.

**Step 3: Regenerate Prisma client**

```bash
cd packages/api && npx prisma generate
```

**Step 4: Verify API compiles**

```bash
cd packages/api && npx tsc --noEmit
```
Expected: no errors.

**Step 5: Run existing API tests**

```bash
cd packages/api && npx jest --no-coverage
```
Expected: 13/13 pass.

**Step 6: Commit**

```bash
git add packages/api/prisma/schema.prisma packages/api/prisma/migrations/
git commit -m "feat: add unique constraint to Server.host"
```

---

### Task 2: Update POST /api/servers to upsert

**Files:**
- Modify: `packages/api/src/routes/servers.ts`

**Step 1: Replace the POST handler**

Open `packages/api/src/routes/servers.ts`. Find the `serversRouter.post('/', ...)` handler and replace it entirely with:

```typescript
serversRouter.post('/', async (req, res) => {
  const parsed = CreateServerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  try {
    const server = await prisma.server.upsert({
      where: { host: parsed.data.host },
      update: { name: parsed.data.name },
      create: parsed.data,
    });
    res.json(server);
  } catch (err) {
    console.error('POST /servers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Note: response is `200 OK` (not `201`) — `res.json()` defaults to 200. This is intentional: the upsert is idempotent.

**Step 2: Verify API compiles**

```bash
cd packages/api && npx tsc --noEmit
```
Expected: no errors.

**Step 3: Run all API tests**

```bash
cd packages/api && npx jest --no-coverage
```
Expected: 13/13 pass.

**Step 4: Commit**

```bash
git add packages/api/src/routes/servers.ts
git commit -m "feat: make POST /api/servers an upsert on host"
```

---

### Task 3: Add Jest to agent package + implement register.ts (TDD)

**Files:**
- Modify: `packages/agent/package.json`
- Create: `packages/agent/jest.config.js`
- Create: `packages/agent/src/__tests__/register.test.ts`
- Create: `packages/agent/src/register.ts`

**Step 1: Add Jest devDependencies to agent**

Open `packages/agent/package.json`. Add to `devDependencies` and a `test` script:

```json
{
  "name": "@nodeprism/agent",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "@nodeprism/shared": "*",
    "axios": "^1.6.0",
    "dotenv": "^16.4.0",
    "systeminformation": "^5.22.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 2: Create jest.config.js for agent**

Create `packages/agent/jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
};
```

**Step 3: Install the new dependencies**

```bash
cd packages/agent && npm install
```

**Step 4: Write the failing tests**

Create `packages/agent/src/__tests__/register.test.ts`:

```typescript
import { buildRegistrationPayload } from '../register';

describe('buildRegistrationPayload', () => {
  it('uses hostname as name when serverName is not provided', () => {
    const result = buildRegistrationPayload('my-machine');
    expect(result).toEqual({ name: 'my-machine', host: 'my-machine' });
  });

  it('uses serverName as name when provided', () => {
    const result = buildRegistrationPayload('my-machine', 'Production Server');
    expect(result).toEqual({ name: 'Production Server', host: 'my-machine' });
  });

  it('falls back to hostname when serverName is empty string', () => {
    const result = buildRegistrationPayload('my-machine', '');
    expect(result).toEqual({ name: 'my-machine', host: 'my-machine' });
  });

  it('falls back to hostname when serverName is whitespace only', () => {
    const result = buildRegistrationPayload('my-machine', '   ');
    expect(result).toEqual({ name: 'my-machine', host: 'my-machine' });
  });
});
```

**Step 5: Run tests to verify they fail**

```bash
cd packages/agent && npx jest --no-coverage
```
Expected: FAIL with "Cannot find module '../register'"

**Step 6: Implement register.ts**

Create `packages/agent/src/register.ts`:

```typescript
import axios from 'axios';

export function buildRegistrationPayload(
  hostname: string,
  serverName?: string
): { name: string; host: string } {
  const trimmed = serverName?.trim();
  return {
    name: trimmed ? trimmed : hostname,
    host: hostname,
  };
}

export async function registerAgent(
  apiUrl: string,
  hostname: string,
  serverName?: string
): Promise<string> {
  const payload = buildRegistrationPayload(hostname, serverName);
  const response = await axios.post<{ id: string }>(`${apiUrl}/api/servers`, payload);
  return response.data.id;
}
```

**Step 7: Run tests to verify they pass**

```bash
cd packages/agent && npx jest --no-coverage
```
Expected: 4/4 tests pass.

**Step 8: Commit**

```bash
git add packages/agent/package.json packages/agent/jest.config.js packages/agent/src/register.ts packages/agent/src/__tests__/register.test.ts
git commit -m "feat: add register.ts with buildRegistrationPayload and tests"
```

---

### Task 4: Update agent index.ts + .env

**Files:**
- Modify: `packages/agent/src/index.ts`
- Modify: `packages/agent/.env`

**Step 1: Rewrite index.ts**

Replace the entire content of `packages/agent/src/index.ts` with:

```typescript
import 'dotenv/config';
import os from 'os';
import { collectMetrics } from './collector';
import { sendMetrics } from './sender';
import { registerAgent } from './register';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const SERVER_NAME = process.env.SERVER_NAME;
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS ?? '5000');
const REGISTER_RETRIES = 5;
const REGISTER_RETRY_DELAY_MS = 3000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function registerWithRetry(): Promise<string> {
  const hostname = os.hostname();
  for (let attempt = 1; attempt <= REGISTER_RETRIES; attempt++) {
    try {
      const id = await registerAgent(API_URL, hostname, SERVER_NAME);
      console.log(`Registered as "${SERVER_NAME ?? hostname}" (id: ${id})`);
      return id;
    } catch (err) {
      console.error(`Registration attempt ${attempt}/${REGISTER_RETRIES} failed:`, (err as Error).message);
      if (attempt < REGISTER_RETRIES) {
        await sleep(REGISTER_RETRY_DELAY_MS);
      }
    }
  }
  console.error('All registration attempts failed. Exiting.');
  process.exit(1);
}

async function main() {
  const serverId = await registerWithRetry();

  console.log(`Agent started. Sending metrics every ${INTERVAL_MS}ms`);

  async function run() {
    try {
      const metrics = await collectMetrics(serverId);
      await sendMetrics(API_URL, metrics);
      console.log(`Sent: CPU ${metrics.cpu}% | MEM ${metrics.memory}% | DISK ${metrics.disk}%`);
    } catch (err) {
      console.error('Failed to send metrics:', (err as Error).message);
    }
  }

  run();
  setInterval(run, INTERVAL_MS);
}

main();
```

**Step 2: Update .env**

Open `packages/agent/.env`. Replace with:

```
API_URL=http://localhost:4000
INTERVAL_MS=5000
# SERVER_NAME=My Custom Name
```

Remove the `SERVER_ID` line entirely.

**Step 3: Verify agent compiles**

```bash
cd packages/agent && npx tsc --noEmit
```
Expected: no errors.

**Step 4: Run agent tests**

```bash
cd packages/agent && npx jest --no-coverage
```
Expected: 4/4 pass.

**Step 5: Commit**

```bash
git add packages/agent/src/index.ts packages/agent/.env
git commit -m "feat: agent self-registers via POST /api/servers at startup"
```

---

### Task 5: Create useServers hook

**Files:**
- Create: `packages/web/src/hooks/useServers.ts`

**Step 1: Create the hook**

Create `packages/web/src/hooks/useServers.ts`:

```typescript
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
        if (Array.isArray(data)) {
          setServers(data as Server[]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { servers, loading };
}
```

No polling — servers register infrequently. The list loads once on mount.

**Step 2: Verify web compiles**

```bash
cd packages/web && npx tsc --noEmit
```
Expected: no errors. (`Server` is already exported from `@nodeprism/shared`.)

**Step 3: Commit**

```bash
git add packages/web/src/hooks/useServers.ts
git commit -m "feat: add useServers hook"
```

---

### Task 6: Update page.tsx with server selector

**Files:**
- Modify: `packages/web/src/app/page.tsx`

**Step 1: Invoke frontend-design skill**

> **REQUIRED:** Before writing any UI code, invoke the `frontend-design:frontend-design` skill with this prompt:
> "Add a server selector to the NodePrism dashboard header. The header currently shows just `<h1>NodePrism Dashboard</h1>`. Make the header a flex row with the title on the left and a styled dropdown (`<select>`) on the right. The dropdown lists servers by name (value = server id). Props: `servers: Server[]` (array of `{ id, name, host }`), `selectedId: string`, `onChange: (id: string) => void`. When `servers` is empty, show a subtle message 'No servers registered' instead of the dropdown. Use the existing light dashboard aesthetic (bg-gray-50, text-gray-800). Keep it clean and minimal."

**Step 2: Rewrite page.tsx**

Replace the entire content of `packages/web/src/app/page.tsx` with:

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useMetrics } from '../hooks/useMetrics';
import { useServers } from '../hooks/useServers';
import { MetricsChart } from '../components/MetricsChart';
import { StatCard } from '../components/StatCard';
import { UptimeChecks } from '../components/UptimeChecks';

export default function Dashboard() {
  const { servers, loading: serversLoading } = useServers();
  const [selectedServerId, setSelectedServerId] = useState<string>('');

  // Auto-select the first server when servers load
  useEffect(() => {
    if (servers.length > 0 && !selectedServerId) {
      setSelectedServerId(servers[0].id);
    }
  }, [servers, selectedServerId]);

  const metrics = useMetrics(selectedServerId);
  const latest = metrics[metrics.length - 1];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">NodePrism Dashboard</h1>
        {serversLoading ? (
          <span className="text-sm text-gray-400">Loading servers...</span>
        ) : servers.length === 0 ? (
          <span className="text-sm text-gray-400">No servers registered</span>
        ) : (
          <select
            value={selectedServerId}
            onChange={(e) => setSelectedServerId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* No server selected state */}
      {!selectedServerId && !serversLoading && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No servers registered yet.</p>
          <p className="text-sm mt-2">Start the agent on a machine to register it automatically.</p>
        </div>
      )}

      {/* Metrics (only shown when a server is selected) */}
      {selectedServerId && (
        <>
          {/* Live stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="CPU" value={latest?.cpu ?? 0} color="text-blue-600" />
            <StatCard label="Memory" value={latest?.memory ?? 0} color="text-purple-600" />
            <StatCard label="Disk" value={latest?.disk ?? 0} color="text-orange-600" />
            <StatCard label="Network" value={latest?.network ?? 0} unit=" B/s" color="text-green-600" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricsChart metrics={metrics} dataKey="cpu" color="#3b82f6" label="CPU Usage %" />
            <MetricsChart metrics={metrics} dataKey="memory" color="#8b5cf6" label="Memory Usage %" />
            <MetricsChart metrics={metrics} dataKey="disk" color="#f97316" label="Disk Usage %" />
            <MetricsChart metrics={metrics} dataKey="network" color="#22c55e" label="Network (B/s)" />
          </div>
        </>
      )}

      {/* Uptime Checks */}
      <div className="mt-8">
        <UptimeChecks />
      </div>
    </main>
  );
}
```

Use the frontend-design skill output to improve the header and selector styling if it provides a better design — but the logic above must be preserved exactly.

**Step 3: Verify web compiles**

```bash
cd packages/web && npx tsc --noEmit
```
Expected: no errors.

**Step 4: Run all API tests**

```bash
cd packages/api && npx jest --no-coverage
```
Expected: 13/13 pass.

**Step 5: Run all agent tests**

```bash
cd packages/agent && npx jest --no-coverage
```
Expected: 4/4 pass.

**Step 6: Commit**

```bash
git add packages/web/src/app/page.tsx
git commit -m "feat: add server selector dropdown to dashboard"
```

---

## Verification Checklist

After all tasks complete, manually verify:
- [ ] `npm run dev` starts without errors in `packages/api`, `packages/agent`, `packages/web`
- [ ] Agent registers on startup: logs "Registered as ..." with an id
- [ ] Agent does NOT crash if `SERVER_ID` is missing from `.env` (it no longer uses it)
- [ ] `GET http://localhost:4000/api/servers` returns the registered server
- [ ] Dashboard shows server name in dropdown
- [ ] Metrics charts update live for the selected server
- [ ] Restarting the agent does not create a duplicate server record (upsert working)
- [ ] API tests: 13/13 pass
- [ ] Agent tests: 4/4 pass
