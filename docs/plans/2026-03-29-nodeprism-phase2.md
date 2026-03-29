# NodePrism Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add HTTP/TCP uptime monitoring with a standalone `checker` package, database-backed check configs, incident tracking, and Slack alerting on down/recovered events.

**Architecture:** New `checker` package fetches checks from the API and POSTs ping results; the API owns incident state (open/close) and fires Slack webhooks; two new Prisma models (`UptimeCheck`, `Incident`) added via migration; web dashboard extended with a read-only uptime section.

**Tech Stack:** Turborepo, TypeScript, Zod, Express, Prisma, PostgreSQL, Node `net` module, native `fetch`, Jest + ts-jest, Tailwind CSS

---

## Task 1: shared — Uptime Types + Schemas

**Files:**
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: Add types to `packages/shared/src/types/index.ts`**

Append after the existing exports:

```typescript
export interface UptimeCheck {
  id: string;
  name: string;
  type: 'http' | 'tcp';
  target: string;       // URL for http, "host:port" for tcp
  interval: number;     // seconds
  createdAt: Date;
}

export interface Incident {
  id: string;
  checkId: string;
  startedAt: Date;
  resolvedAt: Date | null;
}

export interface UptimeCheckWithStatus extends UptimeCheck {
  status: 'up' | 'down';
}
```

**Step 2: Add schemas to `packages/shared/src/schemas/index.ts`**

Append after the existing exports:

```typescript
export const CreateUptimeCheckSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['http', 'tcp']),
  target: z.string().min(1),
  interval: z.number().int().min(10).max(3600).default(60),
});

export type CreateUptimeCheckInput = z.infer<typeof CreateUptimeCheckSchema>;

export const CheckResultSchema = z.object({
  success: z.boolean(),
  latencyMs: z.number().min(0),
  secret: z.string().min(1),
});

export type CheckResultInput = z.infer<typeof CheckResultSchema>;
```

**Step 3: Rebuild shared**

```bash
cd /d/NodePrism/packages/shared
npm run build
```

Expected: `dist/` updated with no TypeScript errors.

**Step 4: Commit**

```bash
cd /d/NodePrism
git add packages/shared
git commit -m "feat: add uptime check and incident types + schemas to shared"
```

---

## Task 2: api — Prisma Migration

**Files:**
- Modify: `packages/api/prisma/schema.prisma`
- Creates: `packages/api/prisma/migrations/` (auto-generated)

**Step 1: Add models to `packages/api/prisma/schema.prisma`**

Append after the `Metric` model:

```prisma
model UptimeCheck {
  id        String     @id @default(cuid())
  name      String
  type      String
  target    String
  interval  Int        @default(60)
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

**Step 2: Run migration (Docker must be running)**

```bash
cd /d/NodePrism/packages/api
npx prisma migrate dev --name add-uptime-checks
```

Expected output:
```
✔ Generated Prisma Client
The following migration was created and applied: add-uptime-checks
```

**Step 3: Commit**

```bash
cd /d/NodePrism
git add packages/api/prisma
git commit -m "feat: add UptimeCheck and Incident prisma models"
```

---

## Task 3: api — Jest Setup + Slack Helper

**Files:**
- Modify: `packages/api/package.json`
- Create: `packages/api/jest.config.js`
- Create: `packages/api/src/lib/slack.ts`
- Create: `packages/api/src/__tests__/slack.test.ts`

**Step 1: Add Jest deps to `packages/api/package.json`**

Add to `"devDependencies"`:
```json
"@types/jest": "^29.5.0",
"jest": "^29.7.0",
"ts-jest": "^29.1.0"
```

Add to `"scripts"`:
```json
"test": "jest"
```

Install:
```bash
cd /d/NodePrism/packages/api
npm install
```

**Step 2: Create `packages/api/jest.config.js`**

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@nodeprism/shared$': '<rootDir>/../../packages/shared/dist/index.js',
  },
};
```

**Step 3: Write the failing test — create `packages/api/src/__tests__/slack.test.ts`**

```typescript
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('sendSlackAlert', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
  });

  afterEach(() => {
    delete process.env.SLACK_WEBHOOK_URL;
  });

  it('POSTs message text to SLACK_WEBHOOK_URL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { sendSlackAlert } = await import('../lib/slack');
    await sendSlackAlert('test message');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'test message' }),
      })
    );
  });

  it('does nothing when SLACK_WEBHOOK_URL is not set', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    jest.resetModules();
    const { sendSlackAlert } = await import('../lib/slack');
    await sendSlackAlert('test message');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

**Step 4: Run test to verify it fails**

```bash
cd /d/NodePrism/packages/api
npx jest src/__tests__/slack.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../lib/slack'`

**Step 5: Create `packages/api/src/lib/slack.ts`**

```typescript
export async function sendSlackAlert(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}
```

**Step 6: Run test to verify it passes**

```bash
cd /d/NodePrism/packages/api
npx jest src/__tests__/slack.test.ts --no-coverage
```

Expected: PASS (2 tests)

**Step 7: Commit**

```bash
cd /d/NodePrism
git add packages/api
git commit -m "feat: add slack alert helper with jest setup"
```

---

## Task 4: api — Checks Routes + Incident Logic

**Files:**
- Create: `packages/api/src/lib/incidents.ts`
- Create: `packages/api/src/__tests__/incidents.test.ts`
- Create: `packages/api/src/routes/checks.ts`
- Modify: `packages/api/src/index.ts`

**Step 1: Write failing test — create `packages/api/src/__tests__/incidents.test.ts`**

```typescript
import { resolveIncidentAction } from '../lib/incidents';

describe('resolveIncidentAction', () => {
  it('returns "open" when check fails and no open incident', () => {
    expect(resolveIncidentAction(false, null)).toBe('open');
  });

  it('returns "close" when check recovers and incident is open', () => {
    expect(resolveIncidentAction(true, 'incident-id')).toBe('close');
  });

  it('returns "noop" when check fails and incident already open', () => {
    expect(resolveIncidentAction(false, 'incident-id')).toBe('noop');
  });

  it('returns "noop" when check passes and no open incident', () => {
    expect(resolveIncidentAction(true, null)).toBe('noop');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /d/NodePrism/packages/api
npx jest src/__tests__/incidents.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../lib/incidents'`

**Step 3: Create `packages/api/src/lib/incidents.ts`**

```typescript
export type IncidentAction = 'open' | 'close' | 'noop';

export function resolveIncidentAction(
  success: boolean,
  openIncidentId: string | null
): IncidentAction {
  if (!success && openIncidentId === null) return 'open';
  if (success && openIncidentId !== null) return 'close';
  return 'noop';
}
```

**Step 4: Run test to verify it passes**

```bash
cd /d/NodePrism/packages/api
npx jest src/__tests__/incidents.test.ts --no-coverage
```

Expected: PASS (4 tests)

**Step 5: Create `packages/api/src/routes/checks.ts`**

```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { CreateUptimeCheckSchema, CheckResultSchema } from '@nodeprism/shared';
import { resolveIncidentAction } from '../lib/incidents';
import { sendSlackAlert } from '../lib/slack';

export const checksRouter = Router();

// List all checks with current status
checksRouter.get('/', async (_req, res) => {
  try {
    const checks = await prisma.uptimeCheck.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        incidents: {
          where: { resolvedAt: null },
          take: 1,
        },
      },
    });

    const result = checks.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      target: c.target,
      interval: c.interval,
      createdAt: c.createdAt,
      status: c.incidents.length > 0 ? 'down' : 'up',
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /checks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a check
checksRouter.post('/', async (req, res) => {
  const parsed = CreateUptimeCheckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    const check = await prisma.uptimeCheck.create({ data: parsed.data });
    res.status(201).json(check);
  } catch (err) {
    console.error('POST /checks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Receive a ping result from the checker
checksRouter.post('/:id/result', async (req, res) => {
  const parsed = CheckResultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const expectedSecret = process.env.CHECKER_SECRET;
  if (!expectedSecret || parsed.data.secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const check = await prisma.uptimeCheck.findUnique({
      where: { id: req.params.id },
    });
    if (!check) return res.status(404).json({ error: 'Check not found' });

    const openIncident = await prisma.incident.findFirst({
      where: { checkId: check.id, resolvedAt: null },
    });

    const action = resolveIncidentAction(
      parsed.data.success,
      openIncident?.id ?? null
    );

    if (action === 'open') {
      await prisma.incident.create({ data: { checkId: check.id } });
      await sendSlackAlert(
        `:red_circle: *${check.name}* is DOWN\nTarget: \`${check.target}\`\nLatency: ${parsed.data.latencyMs}ms`
      );
    } else if (action === 'close' && openIncident) {
      const downtimeMs = Date.now() - openIncident.startedAt.getTime();
      const minutes = Math.round(downtimeMs / 60000);
      await prisma.incident.update({
        where: { id: openIncident.id },
        data: { resolvedAt: new Date() },
      });
      await sendSlackAlert(
        `:large_green_circle: *${check.name}* is back UP (was down ${minutes}m)\nTarget: \`${check.target}\``
      );
    }

    res.json({ action });
  } catch (err) {
    console.error('POST /checks/:id/result error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List incidents for a check
checksRouter.get('/:id/incidents', async (req, res) => {
  try {
    const incidents = await prisma.incident.findMany({
      where: { checkId: req.params.id },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    res.json(incidents);
  } catch (err) {
    console.error('GET /checks/:id/incidents error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 6: Register the checks router in `packages/api/src/index.ts`**

Add import after the existing route imports:
```typescript
import { checksRouter } from './routes/checks';
```

Add route registration after `/api/metrics`:
```typescript
app.use('/api/checks', checksRouter);
```

**Step 7: Add `CHECKER_SECRET` to `packages/api/.env`**

Append to the file:
```
CHECKER_SECRET=nodeprism-checker-secret
```

**Step 8: Run all api tests**

```bash
cd /d/NodePrism/packages/api
npx jest --no-coverage
```

Expected: PASS (6 tests across 2 files)

**Step 9: Commit**

```bash
cd /d/NodePrism
git add packages/api
git commit -m "feat: add checks routes with incident logic and slack alerting"
```

---

## Task 5: checker — Package Scaffold + Jest Setup

**Files:**
- Create: `packages/checker/package.json`
- Create: `packages/checker/tsconfig.json`
- Create: `packages/checker/.env`
- Create: `packages/checker/jest.config.js`
- Create: `packages/checker/src/index.ts` (stub)

**Step 1: Create `packages/checker/package.json`**

```json
{
  "name": "@nodeprism/checker",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "@nodeprism/shared": "*",
    "axios": "^1.6.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^2.0.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

> Note: `ts-jest` version `^29.1.0` — fix the version above if install fails.

**Step 2: Create `packages/checker/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**Step 3: Create `packages/checker/.env`**

```
API_URL=http://localhost:4000
CHECKER_SECRET=nodeprism-checker-secret
```

**Step 4: Create `packages/checker/jest.config.js`**

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@nodeprism/shared$': '<rootDir>/../../packages/shared/dist/index.js',
  },
};
```

**Step 5: Create stub `packages/checker/src/index.ts`**

```typescript
// Entry point — implemented in Task 8
console.log('checker starting...');
```

**Step 6: Install deps**

```bash
cd /d/NodePrism/packages/checker
npm install
```

Expected: `node_modules/` created.

**Step 7: Commit**

```bash
cd /d/NodePrism
git add packages/checker
git commit -m "feat: scaffold checker package"
```

---

## Task 6: checker — HTTP Check

**Files:**
- Create: `packages/checker/src/checks/http.ts`
- Create: `packages/checker/src/__tests__/http.test.ts`

**Step 1: Write failing test — create `packages/checker/src/__tests__/http.test.ts`**

```typescript
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { checkHttp } from '../checks/http';

describe('checkHttp', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns success=true and latencyMs for 2xx response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const result = await checkHttp('https://example.com');
    expect(result.success).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns success=false for 5xx response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await checkHttp('https://example.com');
    expect(result.success).toBe(false);
  });

  it('returns success=false when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await checkHttp('https://example.com');
    expect(result.success).toBe(false);
    expect(result.latencyMs).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /d/NodePrism/packages/checker
npx jest src/__tests__/http.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../checks/http'`

**Step 3: Create `packages/checker/src/checks/http.ts`**

```typescript
export interface CheckResult {
  success: boolean;
  latencyMs: number;
}

export async function checkHttp(target: string): Promise<CheckResult> {
  const start = Date.now();
  try {
    const response = await fetch(target, {
      signal: AbortSignal.timeout(10_000),
    });
    return { success: response.ok, latencyMs: Date.now() - start };
  } catch {
    return { success: false, latencyMs: 0 };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd /d/NodePrism/packages/checker
npx jest src/__tests__/http.test.ts --no-coverage
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
cd /d/NodePrism
git add packages/checker/src/checks/http.ts packages/checker/src/__tests__/http.test.ts
git commit -m "feat: add http check to checker package"
```

---

## Task 7: checker — TCP Check

**Files:**
- Create: `packages/checker/src/checks/tcp.ts`
- Create: `packages/checker/src/__tests__/tcp.test.ts`

**Step 1: Write failing test — create `packages/checker/src/__tests__/tcp.test.ts`**

```typescript
import { checkTcp } from '../checks/tcp';

describe('checkTcp', () => {
  it('returns success=true when connecting to a known open port (localhost:4000 mock)', async () => {
    // Use a net server to create a real listening socket
    const net = require('net');
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };

    const result = await checkTcp(`127.0.0.1:${port}`);
    expect(result.success).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns success=false when port is closed', async () => {
    // Port 19999 is almost certainly closed on localhost
    const result = await checkTcp('127.0.0.1:19999');
    expect(result.success).toBe(false);
  });

  it('returns success=false for invalid target format', async () => {
    const result = await checkTcp('not-a-valid-target');
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /d/NodePrism/packages/checker
npx jest src/__tests__/tcp.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../checks/tcp'`

**Step 3: Create `packages/checker/src/checks/tcp.ts`**

```typescript
import net from 'net';
import { CheckResult } from './http';

const TCP_TIMEOUT_MS = 5_000;

export function checkTcp(target: string): Promise<CheckResult> {
  return new Promise((resolve) => {
    const parts = target.split(':');
    const port = parseInt(parts[parts.length - 1], 10);
    const host = parts.slice(0, -1).join(':');

    if (!host || isNaN(port)) {
      return resolve({ success: false, latencyMs: 0 });
    }

    const start = Date.now();
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ success: false, latencyMs: TCP_TIMEOUT_MS });
    }, TCP_TIMEOUT_MS);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ success: true, latencyMs: Date.now() - start });
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve({ success: false, latencyMs: Date.now() - start });
    });
  });
}
```

**Step 4: Run test to verify it passes**

```bash
cd /d/NodePrism/packages/checker
npx jest src/__tests__/tcp.test.ts --no-coverage
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
cd /d/NodePrism
git add packages/checker/src/checks/tcp.ts packages/checker/src/__tests__/tcp.test.ts
git commit -m "feat: add tcp check to checker package"
```

---

## Task 8: checker — Reporter + Runner + Entry

**Files:**
- Create: `packages/checker/src/reporter.ts`
- Create: `packages/checker/src/runner.ts`
- Modify: `packages/checker/src/index.ts`

**Step 1: Create `packages/checker/src/reporter.ts`**

```typescript
import axios from 'axios';
import { CheckResult } from './checks/http';

export async function reportResult(
  apiUrl: string,
  checkId: string,
  result: CheckResult,
  secret: string
): Promise<void> {
  try {
    await axios.post(`${apiUrl}/api/checks/${checkId}/result`, {
      success: result.success,
      latencyMs: result.latencyMs,
      secret,
    });
  } catch (err) {
    console.error(`Failed to report result for check ${checkId}:`, (err as Error).message);
  }
}
```

**Step 2: Create `packages/checker/src/runner.ts`**

```typescript
import axios from 'axios';
import { UptimeCheckWithStatus } from '@nodeprism/shared';
import { checkHttp } from './checks/http';
import { checkTcp } from './checks/tcp';
import { reportResult } from './reporter';

export async function startRunner(apiUrl: string, secret: string): Promise<void> {
  console.log('Fetching checks from API...');

  let checks: UptimeCheckWithStatus[];
  try {
    const res = await axios.get<UptimeCheckWithStatus[]>(`${apiUrl}/api/checks`);
    checks = res.data;
  } catch (err) {
    console.error('Failed to fetch checks:', (err as Error).message);
    return;
  }

  if (checks.length === 0) {
    console.log('No checks configured. Add checks via POST /api/checks');
    return;
  }

  console.log(`Loaded ${checks.length} check(s). Starting intervals...`);

  for (const check of checks) {
    const run = async () => {
      const result =
        check.type === 'http'
          ? await checkHttp(check.target)
          : await checkTcp(check.target);

      const icon = result.success ? '✓' : '✗';
      console.log(
        `[${check.name}] ${icon} ${result.success ? 'UP' : 'DOWN'} (${result.latencyMs}ms)`
      );

      await reportResult(apiUrl, check.id, result, secret);
    };

    // Run immediately, then on interval
    await run();
    setInterval(run, check.interval * 1000);
  }
}
```

**Step 3: Replace `packages/checker/src/index.ts`**

```typescript
import 'dotenv/config';
import { startRunner } from './runner';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const CHECKER_SECRET = process.env.CHECKER_SECRET ?? '';

if (!CHECKER_SECRET) {
  console.error('CHECKER_SECRET is required in .env');
  process.exit(1);
}

console.log(`Checker starting. API: ${API_URL}`);
startRunner(API_URL, CHECKER_SECRET).catch((err) => {
  console.error('Runner failed:', err);
  process.exit(1);
});
```

**Step 4: Verify all checker tests still pass**

```bash
cd /d/NodePrism/packages/checker
npx jest --no-coverage
```

Expected: PASS (6 tests across 2 files)

**Step 5: Commit**

```bash
cd /d/NodePrism
git add packages/checker
git commit -m "feat: add checker runner, reporter, and entry point"
```

---

## Task 9: web — Uptime Section on Dashboard

**Files:**
- Create: `packages/web/src/hooks/useUptimeChecks.ts`
- Create: `packages/web/src/components/UptimeChecks.tsx`
- Modify: `packages/web/src/app/page.tsx`

**Step 1: Create `packages/web/src/hooks/useUptimeChecks.ts`**

```typescript
'use client';
import { useEffect, useState } from 'react';
import { UptimeCheckWithStatus } from '@nodeprism/shared';

export function useUptimeChecks() {
  const [checks, setChecks] = useState<UptimeCheckWithStatus[]>([]);

  useEffect(() => {
    const load = () =>
      fetch('http://localhost:4000/api/checks')
        .then((r) => r.json())
        .then((data: UptimeCheckWithStatus[]) => setChecks(data))
        .catch(console.error);

    load();
    const interval = setInterval(load, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return checks;
}
```

**Step 2: Create `packages/web/src/components/UptimeChecks.tsx`**

```typescript
'use client';
import { UptimeCheckWithStatus } from '@nodeprism/shared';

interface Props {
  checks: UptimeCheckWithStatus[];
}

export function UptimeChecks({ checks }: Props) {
  if (checks.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        No uptime checks configured. POST to /api/checks to add one.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {checks.map((check) => (
        <div
          key={check.id}
          className="bg-white rounded-xl shadow p-4 flex items-center justify-between"
        >
          <div>
            <p className="font-medium text-gray-800">{check.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {check.type.toUpperCase()} · {check.target}
            </p>
          </div>
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              check.status === 'up'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {check.status.toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Add uptime section to `packages/web/src/app/page.tsx`**

Add imports after the existing component imports:
```typescript
import { useUptimeChecks } from '../hooks/useUptimeChecks';
import { UptimeChecks } from '../components/UptimeChecks';
```

Add hook call inside the `Dashboard` component after `useMetrics`:
```typescript
const uptimeChecks = useUptimeChecks();
```

Add section before the closing `</main>` tag:
```typescript
{/* Uptime Checks */}
<div className="mt-8">
  <h2 className="text-lg font-semibold text-gray-700 mb-4">Uptime Checks</h2>
  <UptimeChecks checks={uptimeChecks} />
</div>
```

**Step 4: Verify web builds without TypeScript errors**

```bash
cd /d/NodePrism/packages/web
npx tsc --noEmit
```

Expected: no errors

**Step 5: Commit**

```bash
cd /d/NodePrism
git add packages/web
git commit -m "feat: add uptime checks section to web dashboard"
```

---

## Task 10: End-to-End Smoke Test

**Step 1: Start infrastructure**

```bash
cd /d/NodePrism/infrastructure/docker
docker compose up -d
```

**Step 2: Start the API**

```bash
cd /d/NodePrism/packages/api
npm run dev
```

**Step 3: Create a test uptime check**

```bash
curl -X POST http://localhost:4000/api/checks \
  -H "Content-Type: application/json" \
  -d '{"name":"Google HTTP","type":"http","target":"https://www.google.com","interval":30}'
```

Expected: `{"id":"...","name":"Google HTTP","type":"http",...}`

```bash
curl -X POST http://localhost:4000/api/checks \
  -H "Content-Type: application/json" \
  -d '{"name":"Local API TCP","type":"tcp","target":"localhost:4000","interval":30}'
```

**Step 4: Start checker**

```bash
cd /d/NodePrism/packages/checker
npm run dev
```

Expected output:
```
Checker starting. API: http://localhost:4000
Fetching checks from API...
Loaded 2 check(s). Starting intervals...
[Google HTTP] ✓ UP (120ms)
[Local API TCP] ✓ UP (2ms)
```

**Step 5: Verify `GET /api/checks` returns status**

```bash
curl http://localhost:4000/api/checks
```

Expected: JSON array with `"status":"up"` for each check.

**Step 6: Start web and verify uptime section**

```bash
cd /d/NodePrism/packages/web
npm run dev
```

Open `http://localhost:3000` — uptime section should show both checks as green "UP" badges.

**Step 7: Final commit**

```bash
cd /d/NodePrism
git add .
git commit -m "feat: phase 2 complete — uptime checks + slack alerting"
```

---

## What Phase 2 Built

```
[checker] → fetches check configs from API
          → runs HTTP fetch() / TCP net.connect() on interval
          → POSTs { success, latencyMs, secret } to API

[api]     → validates secret
          → opens Incident on first failure → Slack "DOWN" alert
          → closes Incident on recovery   → Slack "UP" alert
          → GET /api/checks returns live status per check

[web]     → polls /api/checks every 30s
          → renders UP/DOWN badge per check
```

**Next phases:**
- Phase 3: Multi-server agent registration + Telegram alerting
- Phase 4: ML anomaly detection with simple-statistics
