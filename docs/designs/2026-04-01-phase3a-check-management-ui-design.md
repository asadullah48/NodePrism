# Phase 3a — Check Management UI: Design

**Date:** 2026-04-01
**Status:** Approved

## Goal

Replace curl-based check management with a web UI. Users can add and delete uptime checks directly from the dashboard.

## Scope

- `DELETE /api/checks/:id` endpoint (API)
- Add Check modal (web)
- Delete Check confirmation modal (web)
- Updated `UptimeChecks` component with "+ Add Check" button and per-card delete

Out of scope: edit/update checks, bulk delete, check reordering.

---

## API Changes

### `DELETE /api/checks/:id`

- Returns `404` if check not found
- Deletes check and cascades to incidents
- Returns `204 No Content` on success
- No auth required (internal dashboard only)
- try/catch + `console.error` + `500` on unexpected error

---

## Web Changes

### `useUptimeChecks.ts`

Extract fetch logic into a `refetch()` function. Expose:

| Export | Description |
|--------|-------------|
| `checks` | `UptimeCheckWithStatus[]` |
| `loading` | `boolean` |
| `refetch()` | Manually re-fetches from `GET /api/checks` |
| `addCheck(data)` | POSTs to `POST /api/checks`, then calls `refetch()` |
| `deleteCheck(id)` | Calls `DELETE /api/checks/:id`, then calls `refetch()` |

Both `addCheck` and `deleteCheck` return a promise. No optimistic updates — state only changes after API confirms success.

### `AddCheckModal.tsx` (new)

Modal triggered by "+ Add Check" button. Contains a form with:

| Field | Input | Validation |
|-------|-------|------------|
| Name | text | required |
| Type | select (http / tcp) | required |
| Target | text | required (URL for http, host:port for tcp) |
| Interval | number | 10–3600s, default 60 |

- Submit calls `addCheck(data)`, shows loading state on button
- Closes on success, shows inline error on failure
- Styled with `frontend-design` skill for production-grade appearance

### `DeleteCheckModal.tsx` (new)

Confirmation dialog triggered by trash icon on each check card.

- Message: "Delete **{check.name}**? This will remove all its incident history."
- Buttons: "Cancel" + "Delete" (red/destructive)
- Delete calls `deleteCheck(id)`, shows loading, closes on success

### `UptimeChecks.tsx` (updated)

- Section header: right-aligned "+ Add Check" button (always visible)
- Each check card: trash icon button (top-right corner)
- Empty state: replace curl message with a CTA button that opens `AddCheckModal`

---

## Testing

New tests in `packages/api/src/__tests__/checks.test.ts`:

- `DELETE /api/checks/:id` — returns 204, check no longer exists
- `DELETE /api/checks/:id` with unknown ID — returns 404

---

## Build Order

1. API: add `DELETE /api/checks/:id` + tests (TDD)
2. Web: update `useUptimeChecks` hook
3. Web: build `AddCheckModal` + `DeleteCheckModal`
4. Web: update `UptimeChecks` component
