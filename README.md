# NodePrism

Full-stack server monitoring platform. Monitor CPU, memory, disk, and network metrics in real time, with HTTP/TCP uptime checks and Slack alerting.

## What It Does

- **Live metrics** — agents post system metrics every 5s; dashboard updates via Socket.IO
- **Uptime checks** — HTTP and TCP checks with configurable intervals; incidents open/close automatically
- **Slack alerting** — DOWN and recovery alerts post to your webhook when check state changes
- **Multi-server** — agents self-register at startup; pick any server from the dashboard dropdown
- **Historical SLA** — 24h, 7d, and 30d uptime percentages computed from incident history

## Tech Stack

| Layer | Technology |
|---|---|
| API | Express + Prisma + Socket.IO + TypeScript |
| Web | Next.js 14 + Recharts + TypeScript |
| Agent | Node.js + systeminformation + axios |
| Checker | Node.js + axios + TypeScript |
| Shared | TypeScript types + Zod schemas |
| Database | PostgreSQL (Docker) |
| Monorepo | Turborepo |

## Prerequisites

- Node.js 20+
- Docker Desktop

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the database
cd infrastructure/docker && docker compose up -d

# 3. Run migrations
cd packages/api && npx prisma migrate dev

# 4. Start everything (4 terminals)
cd packages/api     && npm run dev   # API on :4000
cd packages/agent   && npm run dev   # self-registers + sends metrics every 5s
cd packages/checker && npm run dev   # runs uptime checks
cd packages/web     && npm run dev   # dashboard on :3000
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
packages/
├── shared/     — TypeScript types and Zod schemas (consumed by all)
├── api/        — Express REST API + Socket.IO + Prisma ORM
├── agent/      — system metrics collector, self-registers at startup
├── checker/    — HTTP/TCP uptime checker
└── web/        — Next.js 14 dashboard
infrastructure/
└── docker/     — docker-compose.yml (PostgreSQL + Redis)
docs/
├── plans/      — implementation plans (for Claude agents)
└── designs/    — architecture design documents
```

## Running Tests

```bash
cd packages/api     && npx jest --no-coverage   # 13 tests
cd packages/checker && npx jest --no-coverage --testTimeout=10000  # 6 tests
cd packages/agent   && npx jest --no-coverage   # 4 tests
```

## Environment Variables

Minimum required (see `CLAUDE.md` for the full list):

| Package | Required vars |
|---|---|
| `packages/api` | `DATABASE_URL`, `CHECKER_SECRET` |
| `packages/agent` | `API_URL` |
| `packages/checker` | `API_URL`, `CHECKER_SECRET` |

Optional: `SLACK_WEBHOOK_URL` in `packages/api/.env` for Slack alerting.
Optional: `SERVER_NAME` in `packages/agent/.env` to override the hostname display name.

## Development Notes

- TypeScript strict mode throughout
- TDD: write failing test → confirm failure → implement → confirm green → commit
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Agent's `preload.js` forces `.env` values over system env vars (Windows compatibility)
- See `AGENTS.md` for AI agent rules of engagement
