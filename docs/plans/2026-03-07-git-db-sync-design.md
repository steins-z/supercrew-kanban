# Git-First, DB-RealTime Sync Design

## 1. Background and Goal

Current behavior is DB-first for board reads, while GitHub `.supercrew/tasks` is intended to be the source of truth.

You want:
- Accuracy priority: `Git origin repo` > `database`
- Real-time priority: `database` > `Git origin repo`
- Support remote programs writing DB through API

Goal:
- Keep board reads fast (DB-first)
- Guarantee eventual convergence to Git source of truth
- Make conflicts and staleness explicit and observable

## 2. Core Principles

1. Authoritative source:
- Git (`origin/<repo>/.supercrew/tasks`) is the final authority for canonical content.

2. Serving path:
- API reads from DB for low-latency UI and integration stability.

3. Verification model:
- Every DB write from agent/API enters a verification lifecycle.
- Unverified data is usable for realtime UX, but explicitly marked as provisional.

4. Conflict strategy:
- Git wins after a bounded grace window for pending agent push/propagation.

## 3. Data Model Extensions

Add or standardize fields on `features`:

- `sync_state TEXT NOT NULL`
  - Enum: `synced | pending_verify | conflict | git_missing | error`
- `verified BOOLEAN NOT NULL DEFAULT 0`
- `source TEXT NOT NULL`
  - Existing enum: `git | agent | agent_stale | agent_orphaned`
- `git_sha TEXT`
- `git_etag TEXT`
- `last_git_checked_at INTEGER`
- `last_git_commit_at INTEGER`
- `last_db_write_at INTEGER`
- `last_sync_error TEXT`

`validation_queue`:
- Keep retry fields (`attempts`, `last_error`, `last_attempt_at`)
- Add unique key for idempotency:
  - `UNIQUE(repo_owner, repo_name, feature_id, branch_name)`

## 4. State Machine (Feature-Level)

### States
- `pending_verify`: API wrote DB; not yet reconciled with Git.
- `synced`: content matches Git (verified).
- `conflict`: DB and Git differ beyond grace window.
- `git_missing`: explicit Git 404 confirms feature missing in Git.
- `error`: temporary validation failure (network/rate-limit/permission transient).

### Transitions

1) API write (`/api/features/report`, `/batch`):
- Set:
  - `source=agent`
  - `verified=false`
  - `sync_state=pending_verify`
  - `last_db_write_at=now`
- Upsert queue job (idempotent key)

2) Validator pull succeeds + content identical:
- `verified=true`
- `sync_state=synced`
- update `git_sha`, `git_etag`, `last_git_checked_at`, `last_git_commit_at`

3) Validator pull succeeds + content differs:
- If `git_commit_time > db_write_time`: apply Git snapshot to DB
  - `source=git`
  - `verified=true`
  - `sync_state=synced`
- Else if within grace window (e.g., 10m): keep DB, retry later
  - `sync_state=pending_verify`
- Else: mark `conflict` (or auto-resolve to Git depending policy)

4) Validator receives explicit Git 404 for feature:
- If feature age < grace window: keep `pending_verify` and retry
- Else: set `sync_state=git_missing` and `source=agent_orphaned`

5) Validator receives transient failure (network/rate limit/5xx/timeout):
- Set `sync_state=error`
- Increment attempts and retry with backoff
- Never treat transient failure as deletion

## 5. Read Path Contract (Board API)

`GET /api/board` remains DB-first.

Response metadata additions:
- `total_features`
- `verified_count`
- `pending_verify_count`
- `conflict_count`
- `error_count`
- `stale_ratio`
- `last_reconcile_at`

Per-feature additions:
- `sync_state`
- `verified`
- `last_git_checked_at`
- `last_sync_error` (optional)

Frontend behavior:
- Show badges:
  - Verified (`synced`)
  - Pending verification
  - Conflict
  - Validation error
- Keep cards visible even when unverified; do not hide realtime updates.

## 6. Background Jobs

1. Fast lane verifier (every 30-60s):
- Process recent `pending_verify` first (priority high)
- Small batch for low latency

2. Slow lane reconciler (every 10-30m):
- Sweep stale/non-verified/error records
- Repair drift

3. Daily full reconcile (off-peak):
- Compare Git index and DB to detect long-tail divergence

## 7. Selective Dual-Write (Optional, Key Operations)

For critical API operations only:
- Attempt DB write + Git write intent (or direct Git update if credentials allow)
- If Git write fails, keep DB realtime update but force `pending_verify` + alert

Use cases:
- High-importance status transitions (e.g., `ready-to-ship -> shipped`)
- Administrative correction endpoints

Do not globally dual-write all operations (avoid complexity and fragility).

## 8. Error Classification Rules (Mandatory)

Git fetch outcomes must be typed:
- `NOT_FOUND` (404): can imply git_missing
- `NOT_MODIFIED` (304): no content change
- `TRANSIENT_ERROR` (timeout, 429, 5xx, network): retry only
- `AUTH_ERROR` (401/403): error + alert, not deletion

`fetchFeatureFromGit` must not collapse all failures into `null`.

## 9. Conflict Resolution Policy

Default policy:
- Grace window: 10 minutes
- Within grace: keep DB, retry
- Beyond grace:
  - If Git newer: Git overwrite DB
  - If DB newer and still unmatched: mark conflict, raise signal

Optional strict mode:
- Always Git-wins immediately after first mismatch

## 10. Idempotency and Concurrency

1. Queue dedup by unique key
2. Validator updates using compare-and-swap style guards where possible
3. One logical feature should not be processed concurrently by multiple workers
4. Retried jobs should keep deterministic outcome

## 11. Observability and SLOs

Key metrics:
- `verification_lag_seconds` (P50/P95)
- `pending_verify_count`
- `conflict_count`
- `git_fetch_error_rate`
- `stale_ratio`

Alerts:
- `stale_ratio > 30%` for 10m
- `git_fetch_error_rate > 5%` for 5m
- queue backlog growing continuously

SLO targets (suggested):
- 90% of API updates verified within 2 minutes
- 99% verified within 15 minutes

## 12. Rollout Plan

1. Schema migration (add sync fields + queue uniqueness)
2. Git fetch result typing and validator logic update
3. Board API response enrichment + frontend badges
4. Add fast/slow reconcile jobs
5. Enable optional selective dual-write for critical operations
6. Turn on alerts and monitor before tightening policies

## 13. Non-Goals

- Full strong consistency between DB and Git at request time
- Replacing DB-first read path
- Real-time Git scanning for every board request

## 14. Acceptance Criteria

1. API writes appear in board immediately via DB.
2. Each write transitions to verified/synced or explicit conflict/error state.
3. Transient Git failures never mark records as deleted/orphaned.
4. Board shows sync state for every feature.
5. Daily reconcile can repair drift from Git to DB.
6. Queue remains deduplicated and bounded under repeated writes.
