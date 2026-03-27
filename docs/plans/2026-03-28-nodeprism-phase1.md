# NodePrism Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack server monitoring monorepo that displays real-time CPU, memory, disk, and network metrics on a live Next.js dashboard via Socket.IO.

**Architecture:** Turborepo monorepo with 4 packages — `shared` (types/schemas), `agent` (metric collector), `api` (Express + Socket.IO + Prisma), and `web` (Next.js dashboard). Agent POSTs metrics to API every 5s; API persists to PostgreSQL and broadcasts via Socket.IO; web renders live Recharts graphs.

**Tech Stack:** Turborepo, TypeScript, Zod, Express, Socket.IO, Prisma, PostgreSQL 15, Redis 7, Next.js 14, TanStack Query, Recharts, Tailwind CSS, Docker Compose, systeminformation

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `D:\NodePrism\package.json`
- Create: `D:\NodePrism\turbo.json`
- Create: `D:\NodePrism\tsconfig.json`
- Create: `D:\NodePrism\.gitignore`

**Step 1: Initialize root package.json**

```bash
cd D:\NodePrism
npm init -y
```

Then replace `package.json` content with:

```json
{
  "name": "nodeprism",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 2: Install root dependencies**

```bash
cd D:\NodePrism
npm install
```

Expected: `node_modules/` created with turbo and typescript.

**Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "persistent": true,
      "cache": false
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

**Step 4: Create root tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist"
  }
}
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.env
.turbo/
*.log
```

**Step 6: Initialize git and commit**

```bash
cd D:\NodePrism
git init
git add .
git commit -m "feat: init turborepo monorepo scaffold"
```

Expected: Initial commit with 4 files.

---

## Task 2: shared Package (Types + Schemas)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/index.ts`
- Create: `packages/shared/src/schemas/index.ts`
- Create: `packages/shared/src/index.ts`

**Step 1: Create shared package structure**

```bash
mkdir -p D:\NodePrism\packages\shared\src\types
mkdir -p D:\NodePrism\packages\shared\src\schemas
```

**Step 2: Create packages/shared/package.json**

```json
{
  "name": "@nodeprism/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  },
  "dependencies": {
    "zod": "^3.22.0"
  }
}
```

**Step 3: Create packages/shared/tsconfig.json**

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

**Step 4: Create packages/shared/src/types/index.ts**

```typescript
export interface Server {
  id: string;
  name: string;
  host: string;
  createdAt: Date;
}

export interface Metric {
  id: string;
  serverId: string;
  cpu: number;      // percentage 0-100
  memory: number;   // percentage 0-100
  disk: number;     // percentage 0-100
  network: number;  // bytes/s
  timestamp: Date;
}

export interface MetricPayload {
  serverId: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface SocketEvents {
  'metric:update': (metric: Metric) => void;
}
```

**Step 5: Create packages/shared/src/schemas/index.ts**

```typescript
import { z } from 'zod';

export const MetricPayloadSchema = z.object({
  serverId: z.string().min(1),
  cpu: z.number().min(0).max(100),
  memory: z.number().min(0).max(100),
  disk: z.number().min(0).max(100),
  network: z.number().min(0),
});

export const CreateServerSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
});
```

**Step 6: Create packages/shared/src/index.ts**

```typescript
export * from './types/index';
export * from './schemas/index';
```

**Step 7: Install shared deps and build**

```bash
cd D:\NodePrism\packages\shared
npm install
npm run build
```

Expected: `dist/` folder with compiled JS and `.d.ts` files.

**Step 8: Commit**

```bash
cd D:\NodePrism
git add packages/shared
git commit -m "feat: add shared types and zod schemas"
```

---

## Task 3: Docker Compose Infrastructure

**Files:**
- Create: `infrastructure/docker/docker-compose.yml`
- Create: `infrastructure/docker/.env`

**Step 1: Create directory**

```bash
mkdir -p D:\NodePrism\infrastructure\docker
```

**Step 2: Create infrastructure/docker/docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: nodeprism-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: nodeprism
      POSTGRES_USER: nodeprism
      POSTGRES_PASSWORD: nodeprism
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: nodeprism-redis
    restart: unless-stopped
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

**Step 3: Start containers**

```bash
cd D:\NodePrism\infrastructure\docker
docker compose up -d
```

Expected output:
```
✔ Container nodeprism-postgres  Started
✔ Container nodeprism-redis     Started
```

**Step 4: Verify containers are running**

```bash
docker ps | grep nodeprism
```

Expected: Both containers showing `Up`.

**Step 5: Commit**

```bash
cd D:\NodePrism
git add infrastructure/
git commit -m "feat: add docker compose for postgres and redis"
```

---

## Task 4: api Package — Express + Prisma Setup

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/.env`
- Create: `packages/api/prisma/schema.prisma`
- Create: `packages/api/src/lib/prisma.ts`
- Create: `packages/api/src/lib/redis.ts`
- Create: `packages/api/src/routes/servers.ts`
- Create: `packages/api/src/routes/metrics.ts`
- Create: `packages/api/src/index.ts`

**Step 1: Create api package structure**

```bash
mkdir -p D:\NodePrism\packages\api\src\routes
mkdir -p D:\NodePrism\packages\api\src\lib
mkdir -p D:\NodePrism\packages\api\prisma
```

**Step 2: Create packages/api/package.json**

```json
{
  "name": "@nodeprism/api",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "@nodeprism/shared": "*",
    "@prisma/client": "^5.13.0",
    "cors": "^2.8.5",
    "express": "^4.19.0",
    "ioredis": "^5.3.2",
    "socket.io": "^4.7.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "prisma": "^5.13.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 3: Create packages/api/tsconfig.json**

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

**Step 4: Create packages/api/.env**

```env
DATABASE_URL="postgresql://nodeprism:nodeprism@localhost:5432/nodeprism"
REDIS_URL="redis://localhost:6379"
PORT=4000
```

**Step 5: Create packages/api/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Server {
  id        String   @id @default(cuid())
  name      String
  host      String
  createdAt DateTime @default(now())
  metrics   Metric[]
}

model Metric {
  id        String   @id @default(cuid())
  serverId  String
  server    Server   @relation(fields: [serverId], references: [id])
  cpu       Float
  memory    Float
  disk      Float
  network   Float
  timestamp DateTime @default(now())

  @@index([serverId, timestamp])
}
```

**Step 6: Install api deps**

```bash
cd D:\NodePrism\packages\api
npm install
```

**Step 7: Run Prisma migration**

```bash
cd D:\NodePrism\packages\api
npx prisma migrate dev --name init
```

Expected: Migration created and applied, `@prisma/client` generated.

**Step 8: Create packages/api/src/lib/prisma.ts**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**Step 9: Create packages/api/src/lib/redis.ts**

```typescript
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

redis.on('error', (err) => console.error('Redis error:', err));
```

**Step 10: Create packages/api/src/routes/servers.ts**

```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { CreateServerSchema } from '@nodeprism/shared';

export const serversRouter = Router();

serversRouter.get('/', async (_req, res) => {
  const servers = await prisma.server.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(servers);
});

serversRouter.post('/', async (req, res) => {
  const parsed = CreateServerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const server = await prisma.server.create({ data: parsed.data });
  res.status(201).json(server);
});
```

**Step 11: Create packages/api/src/routes/metrics.ts**

```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { MetricPayloadSchema } from '@nodeprism/shared';
import { getIO } from '../lib/socket';

export const metricsRouter = Router();

metricsRouter.post('/', async (req, res) => {
  const parsed = MetricPayloadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const metric = await prisma.metric.create({ data: parsed.data });

  // Broadcast to all connected dashboard clients
  getIO().emit('metric:update', metric);

  res.status(201).json(metric);
});

metricsRouter.get('/:serverId', async (req, res) => {
  const metrics = await prisma.metric.findMany({
    where: { serverId: req.params.serverId },
    orderBy: { timestamp: 'desc' },
    take: 60, // last 60 readings = 5 minutes
  });
  res.json(metrics.reverse());
});
```

**Step 12: Create packages/api/src/lib/socket.ts**

```typescript
import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

let io: SocketServer;

export function initSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
```

**Step 13: Create packages/api/src/index.ts**

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { initSocket } from './lib/socket';
import { serversRouter } from './routes/servers';
import { metricsRouter } from './routes/metrics';

const app = express();
const server = http.createServer(app);

initSocket(server);

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.use('/api/servers', serversRouter);
app.use('/api/metrics', metricsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT ?? 4000;
server.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
```

**Step 14: Test the API starts**

```bash
cd D:\NodePrism\packages\api
npm run dev
```

Expected: `API running on http://localhost:4000`

Visit `http://localhost:4000/health` — should return `{"status":"ok"}`

**Step 15: Commit**

```bash
cd D:\NodePrism
git add packages/api
git commit -m "feat: add api package with express, prisma, socket.io"
```

---

## Task 5: agent Package — Metric Collector

**Files:**
- Create: `packages/agent/package.json`
- Create: `packages/agent/tsconfig.json`
- Create: `packages/agent/.env`
- Create: `packages/agent/src/collector.ts`
- Create: `packages/agent/src/sender.ts`
- Create: `packages/agent/src/index.ts`

**Step 1: Create agent package structure**

```bash
mkdir -p D:\NodePrism\packages\agent\src
```

**Step 2: Create packages/agent/package.json**

```json
{
  "name": "@nodeprism/agent",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "@nodeprism/shared": "*",
    "axios": "^1.6.0",
    "dotenv": "^16.4.0",
    "systeminformation": "^5.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 3: Create packages/agent/tsconfig.json**

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

**Step 4: Create packages/agent/.env**

```env
API_URL=http://localhost:4000
SERVER_ID=your-server-id-here
INTERVAL_MS=5000
```

> Note: SERVER_ID will be filled in after creating a server via the API in Task 6 Step 1.

**Step 5: Create packages/agent/src/collector.ts**

```typescript
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
```

**Step 6: Create packages/agent/src/sender.ts**

```typescript
import axios from 'axios';
import { MetricPayload } from '@nodeprism/shared';

export async function sendMetrics(apiUrl: string, payload: MetricPayload): Promise<void> {
  await axios.post(`${apiUrl}/api/metrics`, payload);
}
```

**Step 7: Create packages/agent/src/index.ts**

```typescript
import 'dotenv/config';
import { collectMetrics } from './collector';
import { sendMetrics } from './sender';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const SERVER_ID = process.env.SERVER_ID ?? '';
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS ?? '5000');

if (!SERVER_ID) {
  console.error('SERVER_ID is required in .env');
  process.exit(1);
}

console.log(`Agent started. Sending metrics every ${INTERVAL_MS}ms for server ${SERVER_ID}`);

async function run() {
  try {
    const metrics = await collectMetrics(SERVER_ID);
    await sendMetrics(API_URL, metrics);
    console.log(`Sent: CPU ${metrics.cpu}% | MEM ${metrics.memory}% | DISK ${metrics.disk}%`);
  } catch (err) {
    console.error('Failed to send metrics:', (err as Error).message);
  }
}

run();
setInterval(run, INTERVAL_MS);
```

**Step 8: Install agent deps**

```bash
cd D:\NodePrism\packages\agent
npm install
```

**Step 9: Create a server via API and get the ID**

Make sure API is running, then:

```bash
curl -X POST http://localhost:4000/api/servers \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"My Machine\", \"host\": \"localhost\"}"
```

Expected response:
```json
{"id":"clxxxxxxxx","name":"My Machine","host":"localhost","createdAt":"..."}
```

Copy the `id` value and paste it into `packages/agent/.env` as `SERVER_ID`.

**Step 10: Test the agent**

```bash
cd D:\NodePrism\packages\agent
npm run dev
```

Expected every 5s:
```
Sent: CPU 12.3% | MEM 67.4% | DISK 45.1%
```

**Step 11: Commit**

```bash
cd D:\NodePrism
git add packages/agent
git commit -m "feat: add agent package with systeminformation collector"
```

---

## Task 6: web Package — Next.js Dashboard

**Files:**
- Create: `packages/web/` (Next.js app)
- Create: `packages/web/src/lib/socket.ts`
- Create: `packages/web/src/hooks/useMetrics.ts`
- Create: `packages/web/src/components/MetricsChart.tsx`
- Create: `packages/web/src/components/StatCard.tsx`
- Create: `packages/web/src/app/page.tsx`

**Step 1: Scaffold Next.js app**

```bash
cd D:\NodePrism\packages
npx create-next-app@14 web --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

When prompted, accept all defaults.

**Step 2: Install additional dependencies**

```bash
cd D:\NodePrism\packages\web
npm install socket.io-client@4 recharts @tanstack/react-query
npm install -D @types/node
```

**Step 3: Add @nodeprism/shared to web's package.json dependencies**

In `packages/web/package.json`, add to `"dependencies"`:

```json
"@nodeprism/shared": "*"
```

Then run `npm install` again.

**Step 4: Create packages/web/src/lib/socket.ts**

```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('http://localhost:4000', { autoConnect: true });
  }
  return socket;
}
```

**Step 5: Create packages/web/src/hooks/useMetrics.ts**

```typescript
'use client';
import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';
import { Metric } from '@nodeprism/shared';

const MAX_POINTS = 60;

export function useMetrics(serverId: string) {
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    // Load historical metrics
    fetch(`http://localhost:4000/api/metrics/${serverId}`)
      .then((r) => r.json())
      .then((data: Metric[]) => setMetrics(data));

    // Subscribe to live updates
    const socket = getSocket();
    socket.on('metric:update', (metric: Metric) => {
      if (metric.serverId !== serverId) return;
      setMetrics((prev) => [...prev.slice(-MAX_POINTS + 1), metric]);
    });

    return () => { socket.off('metric:update'); };
  }, [serverId]);

  return metrics;
}
```

**Step 6: Create packages/web/src/components/StatCard.tsx**

```typescript
'use client';

interface StatCardProps {
  label: string;
  value: number;
  unit?: string;
  color: string;
}

export function StatCard({ label, value, unit = '%', color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-3xl font-bold ${color}`}>
        {value.toFixed(1)}{unit}
      </span>
    </div>
  );
}
```

**Step 7: Create packages/web/src/components/MetricsChart.tsx**

```typescript
'use client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Metric } from '@nodeprism/shared';

interface MetricsChartProps {
  metrics: Metric[];
  dataKey: keyof Metric;
  color: string;
  label: string;
}

export function MetricsChart({ metrics, dataKey, color, label }: MetricsChartProps) {
  const data = metrics.map((m) => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    value: m[dataKey],
  }));

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="text-sm font-medium text-gray-600 mb-2">{label}</h3>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 8: Replace packages/web/src/app/page.tsx**

```typescript
'use client';
import { useMetrics } from '../hooks/useMetrics';
import { MetricsChart } from '../components/MetricsChart';
import { StatCard } from '../components/StatCard';

// Replace with your actual server ID from Task 5 Step 9
const SERVER_ID = 'your-server-id-here';

export default function Dashboard() {
  const metrics = useMetrics(SERVER_ID);
  const latest = metrics[metrics.length - 1];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">NodePrism Dashboard</h1>

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
    </main>
  );
}
```

**Step 9: Update SERVER_ID in page.tsx**

Replace `your-server-id-here` with the actual server ID from Task 5 Step 9.

**Step 10: Start the web app**

```bash
cd D:\NodePrism\packages\web
npm run dev
```

Expected: Next.js running on `http://localhost:3000`

**Step 11: Commit**

```bash
cd D:\NodePrism
git add packages/web
git commit -m "feat: add next.js dashboard with live socket.io metrics charts"
```

---

## Task 7: Final Wiring + End-to-End Test

**Step 1: Start everything**

Terminal 1 — Infrastructure:
```bash
cd D:\NodePrism\infrastructure\docker
docker compose up -d
```

Terminal 2 — API:
```bash
cd D:\NodePrism\packages\api
npm run dev
```

Terminal 3 — Agent:
```bash
cd D:\NodePrism\packages\agent
npm run dev
```

Terminal 4 — Web:
```bash
cd D:\NodePrism\packages\web
npm run dev
```

**Step 2: Verify end-to-end**

1. Open `http://localhost:3000`
2. You should see 4 stat cards updating every 5 seconds
3. Charts should show a growing history line
4. Agent terminal should log `Sent: CPU X% | MEM X% | DISK X%` every 5s

**Step 3: Final commit**

```bash
cd D:\NodePrism
git add .
git commit -m "feat: phase 1 complete — live metrics dashboard"
```

---

## What You've Built

```
[agent] → collects CPU/mem/disk/net via systeminformation
       → POST /api/metrics every 5s

[api]   → validates with Zod
       → persists to PostgreSQL via Prisma
       → broadcasts via Socket.IO

[web]   → loads 60 historical metrics on mount
       → subscribes to Socket.IO live updates
       → renders Recharts line graphs
```

**Next phases to tackle:**
- Phase 2: Uptime checks + Slack/Telegram alerts
- Phase 3: Multi-server agent with registration
- Phase 4: ML anomaly detection with simple-statistics
