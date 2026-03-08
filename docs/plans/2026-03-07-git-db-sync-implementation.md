# Git-DB Sync Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a DB-first, Git-authoritative sync system where board reads stay realtime while data converges safely to Git truth.

**Architecture:** Keep existing DB-first board read path, add explicit sync states and typed Git fetch outcomes, and make validator state transitions deterministic with idempotent queueing. Add observability and scheduled reconcile loops to repair drift.

**Tech Stack:** Bun + Hono + TypeScript, libSQL/Turso, GitHub Contents API, React frontend.

---

### Task 1: Add Sync State Schema and Queue Idempotency

**Files:**
- Modify: `backend/init-db.ts`
- Modify: `backend/src/services/database.ts`
- Create: `backend/migrations/2026-03-07-sync-state.sql`

**Step 1: Write failing schema check script**

Create a script asserting required columns and queue unique index exist.

**Step 2: Run check and verify failure on current schema**

Run: `bun run backend/check-schema.ts`
Expected: missing sync columns or unique constraint mismatch.

**Step 3: Add migration SQL**

Add columns on `features`:
- `sync_state`, `last_git_checked_at`, `last_git_commit_at`, `last_db_write_at`, `last_sync_error`

Add queue uniqueness:
- `UNIQUE(repo_owner, repo_name, feature_id, branch_name)`

**Step 4: Update init schema to match runtime expectations**

Ensure `validation_queue` has `last_attempt_at` if used by code.

**Step 5: Re-run schema check**

Expected: all required columns/constraints present.

**Step 6: Commit**

```bash
git add backend/init-db.ts backend/src/services/database.ts backend/migrations/2026-03-07-sync-state.sql
git commit -m "feat(db): add sync state fields and queue idempotency constraints"
```

### Task 2: Type Git Fetch Outcomes (No More Null Collapse)

**Files:**
- Modify: `backend/src/services/github.ts`
- Modify: `backend/src/types/api.ts`
- Test: `backend/src/__tests__/github-sync.test.ts`

**Step 1: Write failing tests for Git outcome typing**

Add cases for:
- 404 => `NOT_FOUND`
- 304 => `NOT_MODIFIED`
- 429/5xx/network => `TRANSIENT_ERROR`
- 401/403 => `AUTH_ERROR`

**Step 2: Run test to confirm failing**

Run: `bun test backend/src/__tests__/github-sync.test.ts`
Expected: failures due to old `null` behavior.

**Step 3: Implement typed result contract**

Replace `Promise<GitFileSnapshot | null>` with discriminated union, e.g.:
- `{ kind: 'snapshot', data: GitFileSnapshot }`
- `{ kind: 'not_found' }`
- `{ kind: 'not_modified' }`
- `{ kind: 'transient_error', error: string }`
- `{ kind: 'auth_error', error: string }`

**Step 4: Run tests**

Expected: pass.

**Step 5: Commit**

```bash
git add backend/src/services/github.ts backend/src/types/api.ts backend/src/__tests__/github-sync.test.ts
git commit -m "feat(sync): classify git fetch outcomes for safe reconciliation"
```

### Task 3: Refactor Validator State Machine to Enforce Git-Authoritative Rules

**Files:**
- Modify: `backend/src/services/validation.ts`
- Modify: `backend/src/services/database.ts`
- Test: `backend/src/__tests__/validation-state-machine.test.ts`

**Step 1: Write failing tests for transitions**

Cover:
- pending_verify -> synced on identical
- mismatch + git newer -> overwrite from git
- mismatch + db newer within grace -> retry/pending_verify
- mismatch + db newer beyond grace -> conflict
- not_found within grace -> retry
- not_found beyond grace -> git_missing/agent_orphaned
- transient/auth errors -> error state, no orphan marking

**Step 2: Run tests to confirm failing**

Run: `bun test backend/src/__tests__/validation-state-machine.test.ts`

**Step 3: Implement deterministic transition logic**

Add helper methods:
- `markSyncState(...)`
- `markSyncError(...)`
- `markConflict(...)`
- `applyGitSnapshot(...)`

Make grace window configurable (`SYNC_GRACE_MINUTES`, default 10).

**Step 4: Run tests**

Expected: pass.

**Step 5: Commit**

```bash
git add backend/src/services/validation.ts backend/src/services/database.ts backend/src/__tests__/validation-state-machine.test.ts
git commit -m "feat(sync): implement validator state machine with grace-window conflict handling"
```

### Task 4: Harden Queue Processing and Retry Semantics

**Files:**
- Modify: `backend/src/workers/validator.ts`
- Modify: `backend/src/services/database.ts`
- Test: `backend/src/__tests__/validator-worker.test.ts`

**Step 1: Write failing tests for retry/removal edge cases**

Cases:
- max attempts respected exactly
- idempotent delete/increment ordering
- no duplicate processing for same unique key

**Step 2: Run tests to fail**

Run: `bun test backend/src/__tests__/validator-worker.test.ts`

**Step 3: Implement worker fixes**

- Correct attempt threshold logic (post-increment aware)
- Ensure stable status counters
- Preserve failure reasons

**Step 4: Run tests**

Expected: pass.

**Step 5: Commit**

```bash
git add backend/src/workers/validator.ts backend/src/services/database.ts backend/src/__tests__/validator-worker.test.ts
git commit -m "fix(sync): stabilize queue retry thresholds and worker accounting"
```

### Task 5: Enrich Board API with Sync Freshness Metadata

**Files:**
- Modify: `backend/src/routes/board.ts`
- Modify: `backend/src/types/api.ts`
- Modify: `frontend/packages/app-core/src/types.ts`
- Test: `backend/src/__tests__/board-sync-metadata.test.ts`

**Step 1: Write failing API response test**

Expect `metadata` includes:
- `verified_count`, `pending_verify_count`, `conflict_count`, `error_count`, `stale_ratio`

Expect per-feature fields:
- `sync_state`, `last_git_checked_at`

**Step 2: Run test and fail**

Run: `bun test backend/src/__tests__/board-sync-metadata.test.ts`

**Step 3: Implement response enrichment**

Update SQL select and response mapping.

**Step 4: Run tests**

Expected: pass.

**Step 5: Commit**

```bash
git add backend/src/routes/board.ts backend/src/types/api.ts frontend/packages/app-core/src/types.ts backend/src/__tests__/board-sync-metadata.test.ts
git commit -m "feat(api): expose sync state and freshness metrics in board response"
```

### Task 6: Add Frontend Sync-State Visibility

**Files:**
- Modify: `frontend/packages/local-web/src/routes/index.tsx`
- Modify: `frontend/packages/local-web/src/styles/*` (or existing board CSS)
- Test: `frontend/packages/local-web/src/__tests__/board-sync-badges.test.tsx`

**Step 1: Write failing UI test**

Expect badges/labels for `synced`, `pending_verify`, `conflict`, `error`.

**Step 2: Run test to fail**

Run: `pnpm --filter @supercrew-kanban/local-web test -- board-sync-badges`

**Step 3: Add non-intrusive badges**

Render lightweight status chip on each card.

**Step 4: Run UI tests**

Expected: pass.

**Step 5: Commit**

```bash
git add frontend/packages/local-web/src/routes/index.tsx frontend/packages/local-web/src/__tests__/board-sync-badges.test.tsx
git commit -m "feat(ui): display per-card sync verification state"
```

### Task 7: Add Fast/Slow Reconcile Schedulers

**Files:**
- Modify: `backend/src/index.ts`
- Create: `backend/src/workers/reconciler.ts`
- Modify: `vercel.json` (if cron configured there)
- Test: `backend/src/__tests__/reconciler-schedule.test.ts`

**Step 1: Write failing tests for job selection policy**

Validate:
- fast lane selects recent pending items
- slow lane selects stale/error/conflict items

**Step 2: Run tests to fail**

Run: `bun test backend/src/__tests__/reconciler-schedule.test.ts`

**Step 3: Implement scheduler entrypoints**

- `processFastLane(batchSize)`
- `processSlowLane(batchSize)`

**Step 4: Run tests**

Expected: pass.

**Step 5: Commit**

```bash
git add backend/src/index.ts backend/src/workers/reconciler.ts vercel.json backend/src/__tests__/reconciler-schedule.test.ts
git commit -m "feat(sync): add fast/slow reconciliation lanes"
```

### Task 8: Optional Selective Dual-Write for Critical Operations

**Files:**
- Modify: `backend/src/routes/features.ts`
- Create: `backend/src/services/git-writer.ts`
- Test: `backend/src/__tests__/critical-dual-write.test.ts`

**Step 1: Write failing tests for critical status transitions**

Case: critical transition attempts Git write intent; failures keep DB change but force pending_verify + alert.

**Step 2: Run tests to fail**

Run: `bun test backend/src/__tests__/critical-dual-write.test.ts`

**Step 3: Implement feature-flagged dual-write**

- Env flag: `ENABLE_CRITICAL_DUAL_WRITE=true`
- Scope: only selected transitions/endpoints

**Step 4: Run tests**

Expected: pass.

**Step 5: Commit**

```bash
git add backend/src/routes/features.ts backend/src/services/git-writer.ts backend/src/__tests__/critical-dual-write.test.ts
git commit -m "feat(sync): add optional selective dual-write for critical operations"
```

### Task 9: Observability and Runbook

**Files:**
- Modify: `backend/src/workers/validator.ts`
- Create: `docs/plans/2026-03-07-git-db-sync-runbook.md`

**Step 1: Add structured logs/metrics emission points**

Emit counters and latencies for:
- verify lag
- queue size
- conflicts
- git fetch errors

**Step 2: Add operator runbook**

Include:
- how to interpret sync states
- remediation for conflict spikes
- backfill/reconcile command recipes

**Step 3: Verify by local run**

Run: `pnpm dev`
Expected: logs include sync metrics fields.

**Step 4: Commit**

```bash
git add backend/src/workers/validator.ts docs/plans/2026-03-07-git-db-sync-runbook.md
git commit -m "docs(sync): add metrics instrumentation and operations runbook"
```

### Task 10: End-to-End Verification

**Files:**
- Create: `backend/test-sync-e2e.ts`
- Modify: `README.md`

**Step 1: Write e2e scenario script**

Scenario:
1. API writes feature update
2. Board shows pending_verify immediately
3. Validator runs and reconciles with Git
4. Board transitions to synced or conflict deterministically

**Step 2: Run e2e script**

Run: `bun run backend/test-sync-e2e.ts`
Expected: explicit PASS/FAIL output per stage.

**Step 3: Document commands in README**

Add a short sync verification section.

**Step 4: Commit**

```bash
git add backend/test-sync-e2e.ts README.md
git commit -m "test(sync): add end-to-end verification flow and docs"
```

---

## Global Validation Checklist

Run all:

```bash
pnpm --filter @supercrew-kanban/backend typecheck
bun test
pnpm --filter @supercrew-kanban/local-web test
```

Expected:
- Typecheck passes
- New sync tests pass
- No regressions in board APIs

## Notes

- Keep all migrations backward compatible where possible.
- Never classify transient Git errors as deletions.
- Preserve DB-first latency while exposing truth freshness to users.
