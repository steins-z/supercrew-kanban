---
status: draft
reviewers: []
---

# Database & Agent Reporting API

## Background

Currently, the supercrew-kanban board is **read-only** and sources data exclusively from GitHub branches (`.supercrew/tasks/*`). This architecture has several limitations:

- **Poor real-time visibility**: Changes only appear after Git push, creating lag time between work and board updates
- **GitHub API rate limits**: Scanning multiple branches consumes API quota quickly, limiting scalability
- **No agent integration**: Local agents (like supercrew skills running in Claude Code) cannot report work-in-progress status in real-time

This feature introduces a **hybrid architecture** where:
- **Git remains the source of truth** (correctness guaranteed)
- **Database provides real-time cache** (low latency, agent-reported updates)
- **Background validation reconciles** the two sources automatically

### Problem Statement

Teams using supercrew-kanban need real-time visibility into feature development across branches, but the current Git-only architecture creates a trade-off between freshness and API rate limits.

## Requirements

### Functional Requirements

#### 1. Database Storage

- [ ] Use Turso (libSQL) as serverless SQLite database
- [ ] Schema includes: features, branches, validation_queue, api_keys tables
- [ ] Store feature metadata: status, progress, owner, priority
- [ ] Store file snapshots: meta.yaml, dev-design.md, dev-plan.md, prd.md content
- [ ] Track verification state: source (git/agent), verified flag, timestamps

#### 2. Agent Reporting APIs

- [ ] `POST /api/features/report` - single feature update
  - Accept: repo info, feature ID, branch, data (status, progress, file contents)
  - Auth: API key (Bearer token)
  - Response: acknowledgment + verification status

- [ ] `POST /api/features/batch` - batch update multiple features
  - Optimize network usage for bulk updates

- [ ] `POST /api/admin/api-keys` - generate API keys for agents
  - Scoped to repo (owner/name)
  - Optional expiration
  - Return key once (not retrievable later)

#### 3. Board Reading APIs

- [ ] `GET /api/board` - read kanban data (DB-first, fallback to Git)
  - Query params: repo, branch pattern, include_unverified, max_age
  - Response: features grouped by status + metadata
  - Metadata includes: source (database/git/hybrid), unverified count, last sync time

- [ ] `GET /api/features/:id` - single feature details

- [ ] Show data freshness indicators:
  - `verified`: Git-confirmed (✅)
  - `realtime`: Agent push, pending verification (⚡)
  - `stale`: Not verified in 5+ minutes (⏳)
  - `orphaned`: Deleted from Git (❌)

#### 4. Validation & Sync

- [ ] Background worker validates agent data against Git
  - Runs every 30-60 seconds (Vercel cron job)
  - Fetches from Git API (source of truth)
  - Compares content hashes (MD5 of file contents)
  - Resolves conflicts: Git always wins

- [ ] Validation logic:
  - If identical → mark as verified
  - If Git is newer → update DB from Git
  - If agent is newer → retry later (wait for Git push)
  - If orphaned → mark as deleted

- [ ] `POST /api/sync/validate` - manual trigger
- [ ] `GET /api/sync/status` - check validation queue

#### 5. Frontend Integration

- [ ] Update `FeatureMeta` type: add verified, source, freshness fields
- [ ] `VerificationBadge` component - shows data status
- [ ] `BoardMetadataBanner` - shows unverified count, last sync, queue length
- [ ] Polling strategy: 30s for unverified features, 5min otherwise
- [ ] Manual "Sync Now" button

#### 6. Deployment & Migration

- [ ] Turso database setup with schema
- [ ] Vercel environment variables (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
- [ ] Vercel cron job for validation worker
- [ ] Feature flag for gradual rollout (VITE_USE_DB_BACKEND)
- [ ] Migration script: sync existing Git data to DB
- [ ] Backward compatibility: keep Git-only mode during transition

### Non-Functional Requirements

- [ ] **Performance**: <100ms latency for board reads (DB mode)
- [ ] **Reliability**: Graceful fallback to Git if DB unavailable
- [ ] **Data Integrity**: Zero data loss during rollout/rollback
- [ ] **Efficiency**: Reduce GitHub API usage by >70% (via DB cache)
- [ ] **Security**: API key authentication for agent endpoints
- [ ] **Observability**: Metrics for queue length, validation time, error rates

## Success Criteria

- [ ] Agent can POST status updates via API with valid API key
- [ ] Kanban shows real-time updates within 30 seconds of agent push
- [ ] Verification completes within 60 seconds for non-rate-limited repos
- [ ] Visual indicators clearly distinguish verified vs. unverified data
- [ ] Fallback to Git works seamlessly when DB is stale (>50% features unverified)
- [ ] Zero data loss during gradual rollout and rollback testing
- [ ] GitHub API rate limit consumption reduced by at least 70%
- [ ] No breaking changes to existing Git-based workflow

## Out of Scope

### Phase 1 (This Feature)

- **How supercrew skills integrate** - reporting mechanism will be handled by external project
- **Real-time WebSocket updates** - polling only (30s intervals sufficient)
- **Multi-user collaboration features** - single writer model (agent = user's local machine)
- **Conflict resolution UI** - Git always wins automatically, no user intervention
- **Historical versioning** - DB stores latest state only, not full history
- **Multi-database support** - Turso SQLite only (no Postgres/MySQL variants)
- **Custom validation rules** - Git comparison only, no business logic validation

### Future Considerations

- Real-time push notifications (WebSocket/SSE) - Phase 2
- Multi-user conflict resolution UI - Phase 3
- Historical state snapshots and time-travel debugging - Phase 3
- Advanced metrics and analytics dashboard - Phase 4

## Technical Constraints

- Must work on Vercel serverless (stateless functions)
- GitHub API rate limit: 5000 requests/hour (authenticated)
- Turso free tier: 500 DBs, 9GB storage, 1B row reads/month
- Vercel cron jobs: minimum 1-minute intervals
- Frontend bundle size: keep verification UI components <20KB

## Dependencies

- Turso database account and CLI setup
- Vercel deployment with cron job support
- Existing GitHub OAuth authentication flow
- Multi-branch kanban feature (already implemented)

## References

- Design document: `docs/plans/2026-03-07-database-agent-reporting-design.md`
- Related feature: `.supercrew/tasks/multi-branch-kanban/`
- Turso documentation: https://docs.turso.tech
- Vercel cron jobs: https://vercel.com/docs/cron-jobs
