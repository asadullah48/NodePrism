# NodePrism — Agent Instructions

Rules of engagement for any AI agent working in this repository.

## Before You Start Any Task

1. Read `CLAUDE.md` for full project context (layout, env vars, API routes, schema)
2. Check `docs/plans/` for the relevant phase plan if implementing a feature
3. Run existing tests to confirm baseline is green before touching anything:
   ```bash
   cd packages/api     && npx jest --no-coverage
   cd packages/checker && npx jest --no-coverage --testTimeout=10000
   ```

## How to Verify Your Work

Always verify in this order before claiming a task is done:

```bash
# 1. Shared package — if you touched packages/shared
cd packages/shared && npm run build

# 2. TypeScript — if you touched packages/api or packages/checker
cd packages/api     && npx tsc --noEmit
cd packages/checker && npx tsc --noEmit

# 3. TypeScript — if you touched packages/web
cd packages/web && npx tsc --noEmit

# 4. Tests — always run after any change
cd packages/api     && npx jest --no-coverage
cd packages/checker && npx jest --no-coverage --testTimeout=10000
```

Never claim work is complete without running these. Never commit if any step fails.

## Commit Convention

```
feat: add X
fix: correct Y
docs: update Z
refactor: restructure W
test: add tests for V
```

One logical change per commit. Stage specific files — never `git add -A` blindly.

## Safe Commands

These are safe to run without asking:
- `npx jest`, `npx tsc --noEmit`, `npm run build`
- `git status`, `git diff`, `git log`
- `npx prisma generate` (read-only client regeneration)
- `curl` against `localhost:4000` for smoke tests

## Ask Before Running

These affect shared or persistent state — confirm first:
- `npx prisma migrate dev` — modifies the database schema
- `docker compose down` — stops shared infrastructure
- `git push` — publishes to remote
- Any `npm install` that adds new dependencies

## Never Run

- `git push --force` or any destructive git operation
- `docker compose down -v` — destroys database volumes and all data
- `DROP TABLE` or any raw SQL against the database
- `rm -rf` on anything outside a temp directory

## TDD Workflow

For every new function or module:
1. Write the failing test first
2. Run it — confirm it fails with the expected error
3. Write the minimum implementation to make it pass
4. Run again — confirm green
5. Commit

Do not write implementation before the test. Do not skip the "confirm it fails" step.

## Working with Prisma

- Never instantiate `PrismaClient` directly — use the singleton at `packages/api/src/lib/prisma.ts`
- All schema changes require a migration: `npx prisma migrate dev --name <description>`
- After any schema change, regenerate the client: `npx prisma generate`
- Test the incident logic via the pure function `resolveIncidentAction` in `src/lib/incidents.ts`
  — never write tests that require a live database for pure business logic

## Working with the Shared Package

- `packages/shared` is the single source of truth for all types and Zod schemas
- After any change to `packages/shared/src/`, always run `npm run build` before using in other packages
- Other packages import from `@nodeprism/shared` (the compiled dist), never from relative paths into shared/src

## Adding a New API Route

1. Create `packages/api/src/routes/<name>.ts` with a named `Router` export
2. Register it in `packages/api/src/index.ts`
3. Add the Zod schema to `packages/shared/src/schemas/index.ts` if validating input
4. Add the TypeScript interface to `packages/shared/src/types/index.ts` if returning a new shape
5. Rebuild shared: `cd packages/shared && npm run build`

## Package Responsibilities

| Package | Owns | Never touches |
|---|---|---|
| `shared` | Types, Zod schemas | No runtime logic, no DB, no HTTP |
| `api` | HTTP routes, DB writes, Socket.IO broadcast, alerting | Does not collect system metrics |
| `agent` | systeminformation collection, metric POST | No DB access, no Socket.IO |
| `checker` | HTTP/TCP check execution, result POST | No DB access, no alerting logic |
| `web` | Dashboard UI, Socket.IO subscription, polling | No direct DB access |

## Windows-Specific Notes

- System environment has `DATABASE_URL=postgresql+asyncpg://...` from another project
- The API's `preload.js` (loaded via `-r ./preload.js`) forces `.env` to override this
- Never remove `preload.js` or the `-r ./preload.js` flag from `packages/api/package.json`
- Always use forward slashes in bash commands even on Windows (`/d/NodePrism/...`)
