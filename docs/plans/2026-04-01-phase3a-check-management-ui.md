# Phase 3a — Check Management UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add and delete uptime checks from the web dashboard — no curl needed.

**Architecture:** New `DELETE /api/checks/:id` endpoint; `useUptimeChecks` hook gains `addCheck`/`deleteCheck` mutations; two new modal components (`AddCheckModal`, `DeleteCheckModal`) wired into the existing `UptimeChecks` component which becomes self-contained (owns its own hook call and modal state).

**Tech Stack:** Express + Prisma (API), React + Next.js 14 + Tailwind (web), `@nodeprism/shared` Zod schemas for form validation.

---

## Context

- API route file: `packages/api/src/routes/checks.ts`
- Hook: `packages/web/src/hooks/useUptimeChecks.ts`
- Component: `packages/web/src/components/UptimeChecks.tsx`
- Page: `packages/web/src/app/page.tsx`
- Schema: `CreateUptimeCheckSchema` in `packages/shared/src/schemas/index.ts`
  - Fields: `name` (string), `type` ('http'|'tcp'), `target` (string), `interval` (number, 10–3600, default 60)
- Prisma: `Incident` has `onDelete: Cascade` — deleting a check auto-deletes its incidents. No migration needed.
- Testing pattern: project tests **pure logic functions only** (no Prisma mocking, no supertest). `DELETE /api/checks/:id` has no extractable logic so no new tests are written for it.
- Run tests: `cd packages/api && npx jest --no-coverage`
- API base URL in web: `http://localhost:4000`

---

### Task 1: Add DELETE /api/checks/:id endpoint

**Files:**
- Modify: `packages/api/src/routes/checks.ts`

**Step 1: Add the DELETE route**

Open `packages/api/src/routes/checks.ts`. After the `GET /:id/incidents` handler (line ~110), add:

```typescript
// Delete a check (cascades to incidents via Prisma onDelete: Cascade)
checksRouter.delete('/:id', async (req, res) => {
  try {
    const check = await prisma.uptimeCheck.findUnique({
      where: { id: req.params.id },
    });
    if (!check) return res.status(404).json({ error: 'Check not found' });

    await prisma.uptimeCheck.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /checks/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 2: Verify the API compiles**

```bash
cd packages/api && npx tsc --noEmit
```
Expected: no errors.

**Step 3: Run existing tests to confirm nothing broken**

```bash
cd packages/api && npx jest --no-coverage
```
Expected: all 6 tests pass.

**Step 4: Commit**

```bash
git add packages/api/src/routes/checks.ts
git commit -m "feat: add DELETE /api/checks/:id endpoint"
```

---

### Task 2: Update useUptimeChecks hook

**Files:**
- Modify: `packages/web/src/hooks/useUptimeChecks.ts`
- Modify: `packages/web/src/app/page.tsx`

**Step 1: Rewrite the hook**

Replace the entire content of `packages/web/src/hooks/useUptimeChecks.ts` with:

```typescript
'use client';
import { useEffect, useState, useCallback } from 'react';
import { UptimeCheckWithStatus } from '@nodeprism/shared';
import { CreateUptimeCheckInput } from '@nodeprism/shared';

export function useUptimeChecks() {
  const [checks, setChecks] = useState<UptimeCheckWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() =>
    fetch('http://localhost:4000/api/checks')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setChecks(data as UptimeCheckWithStatus[]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 30_000);
    return () => clearInterval(interval);
  }, [refetch]);

  const addCheck = useCallback(async (data: CreateUptimeCheckInput) => {
    const res = await fetch('http://localhost:4000/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    await refetch();
  }, [refetch]);

  const deleteCheck = useCallback(async (id: string) => {
    const res = await fetch(`http://localhost:4000/api/checks/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text());
    await refetch();
  }, [refetch]);

  return { checks, loading, refetch, addCheck, deleteCheck };
}
```

**Step 2: Check CreateUptimeCheckInput is exported from shared**

Open `packages/shared/src/schemas/index.ts` — confirm `export type CreateUptimeCheckInput` exists (it does, line ~30). If it is not re-exported from `packages/shared/src/index.ts`, add it:

```typescript
export type { CreateUptimeCheckInput } from './schemas';
```

**Step 3: Verify shared types compile**

```bash
cd packages/shared && npm run build
```
Expected: no errors.

**Step 4: Verify web compiles**

```bash
cd packages/web && npx tsc --noEmit
```
Expected: no errors (page.tsx destructures `{ checks, loading }` — still valid since hook still exports them).

**Step 5: Commit**

```bash
git add packages/web/src/hooks/useUptimeChecks.ts packages/shared/src/index.ts
git commit -m "feat: add addCheck and deleteCheck to useUptimeChecks hook"
```

---

### Task 3: Build AddCheckModal component

**Files:**
- Create: `packages/web/src/components/AddCheckModal.tsx`

**Step 1: Invoke frontend-design skill**

> **REQUIRED:** Before writing this component, invoke the `frontend-design:frontend-design` skill with this prompt:
> "Build a modal dialog component `AddCheckModal` for NodePrism (dark/modern monitoring dashboard aesthetic). The modal allows adding a new uptime check with these fields: Name (text), Type (http or tcp — styled toggle), Target (text, placeholder changes based on type: 'https://example.com' for http, 'hostname:port' for tcp), Interval in seconds (number, 10–3600, default 60). Props: `onClose: () => void`, `onSubmit: (data: CreateUptimeCheckInput) => Promise<void>`. Show a loading spinner on the submit button while submitting. Show inline error message if onSubmit throws. Close button (X) in top-right. Cancel + Add Check buttons in footer."

**Step 2: Save the component**

Save the output to `packages/web/src/components/AddCheckModal.tsx`. Ensure the file:
- Has `'use client';` at the top
- Imports `CreateUptimeCheckInput` from `@nodeprism/shared`
- Has props: `{ onClose: () => void; onSubmit: (data: CreateUptimeCheckInput) => Promise<void> }`
- Validates that name, type, and target are non-empty before calling onSubmit
- Coerces interval to a number (form inputs are strings)

**Step 3: Verify web compiles**

```bash
cd packages/web && npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**

```bash
git add packages/web/src/components/AddCheckModal.tsx
git commit -m "feat: add AddCheckModal component"
```

---

### Task 4: Build DeleteCheckModal component

**Files:**
- Create: `packages/web/src/components/DeleteCheckModal.tsx`

**Step 1: Invoke frontend-design skill**

> **REQUIRED:** Before writing this component, invoke the `frontend-design:frontend-design` skill with this prompt:
> "Build a confirmation modal `DeleteCheckModal` for NodePrism (dark/modern monitoring dashboard). Shows: 'Delete **{checkName}**? This will remove all its incident history.' Two buttons: Cancel (ghost/outline) and Delete (red/destructive). Shows loading spinner on Delete button while deleting. Props: `checkName: string`, `onClose: () => void`, `onConfirm: () => Promise<void>`."

**Step 2: Save the component**

Save the output to `packages/web/src/components/DeleteCheckModal.tsx`. Ensure:
- `'use client';` at top
- Props: `{ checkName: string; onClose: () => void; onConfirm: () => Promise<void> }`
- Loading state on confirm button
- Error message display if onConfirm throws

**Step 3: Verify web compiles**

```bash
cd packages/web && npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**

```bash
git add packages/web/src/components/DeleteCheckModal.tsx
git commit -m "feat: add DeleteCheckModal component"
```

---

### Task 5: Update UptimeChecks component and page

**Files:**
- Modify: `packages/web/src/components/UptimeChecks.tsx`
- Modify: `packages/web/src/app/page.tsx`

**Step 1: Rewrite UptimeChecks.tsx**

The component becomes self-contained: it calls `useUptimeChecks()` directly and owns modal state.

Replace the entire content of `packages/web/src/components/UptimeChecks.tsx` with:

```tsx
'use client';
import { useState } from 'react';
import { UptimeCheckWithStatus } from '@nodeprism/shared';
import { useUptimeChecks } from '../hooks/useUptimeChecks';
import { AddCheckModal } from './AddCheckModal';
import { DeleteCheckModal } from './DeleteCheckModal';
import { CreateUptimeCheckInput } from '@nodeprism/shared';

export function UptimeChecks() {
  const { checks, loading, addCheck, deleteCheck } = useUptimeChecks();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UptimeCheckWithStatus | null>(null);

  const handleAdd = async (data: CreateUptimeCheckInput) => {
    await addCheck(data);
    setShowAdd(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteCheck(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Uptime Checks</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Check
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <p className="text-sm text-gray-400">Loading uptime checks...</p>
      )}

      {/* Empty state */}
      {!loading && checks.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow">
          <p className="text-gray-500 mb-4">No uptime checks configured yet.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add your first check
          </button>
        </div>
      )}

      {/* Checks grid */}
      {!loading && checks.length > 0 && (
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
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    check.status === 'up'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {check.status.toUpperCase()}
                </span>
                <button
                  onClick={() => setDeleteTarget(check)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  aria-label={`Delete ${check.name}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddCheckModal onClose={() => setShowAdd(false)} onSubmit={handleAdd} />
      )}
      {deleteTarget && (
        <DeleteCheckModal
          checkName={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
```

**Step 2: Update page.tsx**

`UptimeChecks` no longer accepts props (it manages its own state). Update `packages/web/src/app/page.tsx`:

1. Remove the `useUptimeChecks` import and usage
2. Remove `checks` and `loading` from the destructure
3. Change `<UptimeChecks checks={uptimeChecks} loading={uptimeLoading} />` to `<UptimeChecks />`
4. Remove the wrapping `<div className="mt-8">` + `<h2>` (now inside the component itself)

The uptime section in page.tsx should become:

```tsx
{/* Uptime Checks */}
<div className="mt-8">
  <UptimeChecks />
</div>
```

And remove these lines from the top of the file:
```tsx
import { useUptimeChecks } from '../hooks/useUptimeChecks';
// ...
const { checks: uptimeChecks, loading: uptimeLoading } = useUptimeChecks();
```

**Step 3: Verify web compiles**

```bash
cd packages/web && npx tsc --noEmit
```
Expected: no errors.

**Step 4: Run all API tests one final time**

```bash
cd packages/api && npx jest --no-coverage
```
Expected: all 6 tests pass.

**Step 5: Commit**

```bash
git add packages/web/src/components/UptimeChecks.tsx packages/web/src/app/page.tsx
git commit -m "feat: wire up check management UI with add and delete modals"
```

---

## Verification Checklist

After all tasks complete, manually verify:
- [ ] `npm run dev` starts without errors in `packages/api` and `packages/web`
- [ ] Dashboard shows "+ Add Check" button in uptime section header
- [ ] Clicking "+ Add Check" opens the modal
- [ ] Filling in the form and submitting creates a new check (appears in grid)
- [ ] Clicking the trash icon opens the delete confirmation
- [ ] Confirming delete removes the check from the grid
- [ ] Empty state shows CTA button when no checks exist
- [ ] Existing check status badges (UP/DOWN) still work
