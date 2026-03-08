# Git-DB Sync Implementation Design

**Date:** 2026-03-08
**Status:** Draft
**Author:** Claude & qunmi
**Based On:** 2026-03-07-git-db-sync-design.md (original design)

---

## 1. Executive Summary

This design simplifies and implements the Git-DB sync system using existing infrastructure:
- **Reuses** `BranchScanner` for daily full reconciliation
- **Retains** existing `ValidationService` for real-time agent updates
- **Adds** source tracking for three data origins: Git (truth), Local Agent (realtime), Database (cache)

**Key Simplification**: Instead of implementing complex Fast/Slow lane scheduling, we use:
1. Existing validation queue (every 1 min) for agent updates
2. New daily reconcile job (uses BranchScanner) for full Git sync

---

## 2. Three Data Sources

### Data Source Priority

```
Git Origin Repo (Highest Authority)
  ↓ validates
Local Coding Agent (Highest Timeliness)
  ↓ writes to
Database (Serving Cache)
```

### Source Characteristics

| Source | Location | Timeliness | Accuracy | Use Case |
|--------|----------|------------|----------|----------|
| **Git Origin** | GitHub remote | Medium (push delay) | ★★★★★ | Source of truth |
| **Local Agent** | Coding agent (Claude Code, Cursor) | ★★★★★ Realtime | ★★★☆☆ | Work-in-progress updates |
| **Database** | SQLite/Turso | N/A (cache) | Depends on sync | Fast reads for UI |

### Data Flow Timeline

```
T0: Agent starts working
    └→ POST /api/features/report
        ├→ DB: source='agent', verified=false, sync_state='pending_verify'
        ├→ validation_queue: Add job
        └→ Frontend: Shows ⚡ Realtime badge

T0+1min: Validation worker runs
    └→ GitHub API: Fetch feature from Git
        ├→ Case 1: Git 404 (not pushed yet)
        │   ├→ Within grace window (10min) → Stay 'pending_verify'
        │   └→ After grace window → 'git_missing', source='agent_orphaned'
        │
        ├→ Case 2: Git 200, content identical
        │   └→ sync_state='synced', verified=true, source='agent_verified'
        │       └→ Frontend: Shows ✅ Verified badge
        │
        └→ Case 3: Git 200, content differs
            ├→ Git newer → Overwrite DB (source='git')
            └→ Agent newer → Wait grace window or mark 'conflict'

T0+30min: Agent pushes to Git
    └→ Next validation cycle detects match
        └→ source='agent_verified', sync_state='synced'

T0+24h: Daily reconcile
    └→ BranchScanner scans all branches
        ├→ Insert missing features from Git
        ├→ Update existing features (source='git', verified=true)
        └→ Mark DB-only features as 'git_missing'
```

---

## 3. Data Model Updates

### 3.1 Enhanced `source` Field

**Current states** (already implemented):
- `git` - From Git
- `agent` - From local agent
- `agent_stale` - Agent data overwritten by newer Git
- `agent_orphaned` - Agent data with no Git counterpart

**New state** (to be added):
- `agent_verified` - Agent data confirmed to match Git

### 3.2 Existing Schema (No Changes)

The current schema already supports all required fields:

```sql
CREATE TABLE features (
  -- Identity
  id TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,

  -- Content
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  meta_yaml TEXT,
  dev_design_md TEXT,
  dev_plan_md TEXT,
  prd_md TEXT,

  -- Sync tracking (already exists)
  source TEXT NOT NULL,  -- 'git' | 'agent' | 'agent_verified' | 'agent_stale' | 'agent_orphaned'
  verified BOOLEAN DEFAULT 0,
  sync_state TEXT,  -- 'synced' | 'pending_verify' | 'conflict' | 'git_missing' | 'error'
  git_sha TEXT,
  git_etag TEXT,
  last_git_checked_at INTEGER,
  last_git_commit_at INTEGER,
  last_db_write_at INTEGER,
  last_sync_error TEXT,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  verified_at INTEGER,

  PRIMARY KEY (repo_owner, repo_name, id)
);
```

---

## 4. Architecture Components

### 4.1 Existing Components (Reuse)

**BranchScanner** (`backend/src/services/branch-scanner.ts`)
- ✅ Already scans multiple branches in parallel
- ✅ Fetches all features from Git
- ✅ Returns `FileSnapshot[]` with branch, featureId, files
- **Usage**: Daily reconcile job

**ValidationService** (`backend/src/services/validation.ts`)
- ✅ Validates single feature against Git
- ✅ Implements grace window (10min)
- ✅ Handles error classification (404, 304, transient, auth)
- ✅ Resolves conflicts (Git wins by default)
- **Usage**: Process validation queue (every 1 min)

**Agent API** (`backend/src/routes/features.ts`)
- ✅ POST /api/features/report - Single feature update
- ✅ POST /api/features/batch - Batch updates
- ✅ Validates API key permissions
- ✅ Queues validation jobs
- **Usage**: Local coding agents report status

**Validation Queue** (`validation_queue` table)
- ✅ Stores pending validation jobs
- ✅ Supports priority ordering
- ✅ Tracks retry attempts
- **Usage**: Decouple agent writes from validation

### 4.2 New Components (To Implement)

**Daily Reconcile Job** (`backend/src/workers/reconcile.ts` - NEW)
- Runs once per day (3am)
- Uses `BranchScanner` to fetch all Git features
- Compares Git vs DB and syncs
- Marks all as `verified=true, source='git'`

**Reconcile Cron Endpoint** (`api/cron/reconcile.ts` - NEW)
- Vercel cron endpoint
- Triggers daily reconcile job
- Returns stats (inserted, updated, orphaned)

---

## 5. Daily Reconcile Logic

### 5.1 Reconcile Algorithm

```typescript
async function dailyReconcile(
  repoOwner: string,
  repoName: string,
  githubToken: string
): Promise<ReconcileStats> {

  // Step 1: Scan Git (source of truth)
  const scanner = new BranchScanner(githubToken, repoOwner, repoName)
  const branches = await scanner.discoverBranches('user/*')
  const gitSnapshots = await scanner.fetchAllFeatures(branches)

  // Step 2: Build Git feature map
  const gitFeatures = new Map<string, FileSnapshot>()
  for (const snapshot of gitSnapshots) {
    // Use primary branch (main or user/*/task-id) for reconcile
    if (snapshot.branch === 'main' || snapshot.branch.startsWith('user/')) {
      gitFeatures.set(snapshot.featureId, snapshot)
    }
  }

  // Step 3: Get all DB features for this repo
  const dbFeatures = await getAllFeaturesForRepo(repoOwner, repoName)
  const dbFeatureIds = new Set(dbFeatures.map(f => f.id))

  const stats = {
    scanned: gitFeatures.size,
    inserted: 0,
    updated: 0,
    orphaned: 0,
    errors: 0,
  }

  // Step 4: Sync Git → DB (insert/update)
  for (const [featureId, snapshot] of gitFeatures) {
    try {
      const metaParsed = parseMetaYaml(snapshot.files.meta || '')

      await upsertFeature({
        id: featureId,
        repo_owner: repoOwner,
        repo_name: repoName,
        title: metaParsed.title || featureId,
        status: metaParsed.status || 'todo',
        owner: metaParsed.owner,
        priority: metaParsed.priority,
        progress: metaParsed.progress || 0,
        meta_yaml: snapshot.files.meta || undefined,
        dev_design_md: snapshot.files.design || undefined,
        dev_plan_md: snapshot.files.plan || undefined,
        source: 'git',
        verified: true,
        sync_state: 'synced',
        last_git_checked_at: Date.now(),
        last_git_commit_at: Date.now(), // TODO: Get actual commit time
        last_sync_error: undefined,
        created_at: Date.now(),
        updated_at: Date.now(),
        verified_at: Date.now(),
      })

      if (dbFeatureIds.has(featureId)) {
        stats.updated++
      } else {
        stats.inserted++
      }
    } catch (error) {
      console.error(`[Reconcile] Error syncing ${featureId}:`, error)
      stats.errors++
    }
  }

  // Step 5: Mark DB-only features as orphaned
  for (const dbFeature of dbFeatures) {
    if (!gitFeatures.has(dbFeature.id)) {
      await upsertFeature({
        ...dbFeature,
        source: 'agent_orphaned',
        sync_state: 'git_missing',
        verified: false,
        last_sync_error: 'Feature not found in Git during daily reconcile',
        updated_at: Date.now(),
      })
      stats.orphaned++
    }
  }

  return stats
}
```

### 5.2 Reconcile Scheduling

**Vercel Cron Configuration** (`vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/validate",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/reconcile",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Schedule Explanation**:
- `/api/cron/validate` - Every minute (existing)
- `/api/cron/reconcile` - Daily at 3:00 AM UTC (new)

---

## 6. Source Field State Machine

### 6.1 State Transitions

```
Agent Report
    ↓
┌─────────────┐
│   'agent'   │ (unverified, pending)
│ verified=0  │
└──────┬──────┘
       │
       ├─→ Validation: Git match
       │   └→ 'agent_verified' (verified=1, sync_state='synced')
       │
       ├─→ Validation: Git newer
       │   └→ 'git' (verified=1, overwritten by Git)
       │
       ├─→ Validation: Git 404 (beyond grace window)
       │   └→ 'agent_orphaned' (verified=0, sync_state='git_missing')
       │
       └─→ Daily Reconcile: Git overwrites
           └→ 'git' (verified=1, sync_state='synced')

Daily Reconcile (all Git features)
    ↓
┌─────────────┐
│    'git'    │ (verified, authoritative)
│ verified=1  │
└─────────────┘
```

### 6.2 Source Semantics

| Source | Meaning | Verified | Use Case |
|--------|---------|----------|----------|
| `git` | Directly from Git, authoritative | ✅ true | Daily reconcile, Git-wins conflict resolution |
| `agent` | From local agent, awaiting validation | ❌ false | Fresh agent report, within grace window |
| `agent_verified` | From agent, validated against Git | ✅ true | Agent data confirmed to match Git |
| `agent_stale` | From agent, but Git has newer data | ❌ false | Agent data was overwritten |
| `agent_orphaned` | From agent, but Git doesn't have it | ❌ false | Agent work not pushed, or deleted from Git |

---

## 7. Conflict Resolution Strategy

### 7.1 Resolution Rules (Already Implemented)

**Rule 1: Git is the ultimate authority**
- When Git and Agent data differ, Git wins (after grace window)

**Rule 2: Grace window for agent pushes**
- 10 minutes for agent to push changes to Git
- Within grace window: Keep agent data, retry validation
- After grace window: Mark as conflict or orphaned

**Rule 3: Content hash comparison**
- Use MD5 hash of (meta.yaml + dev-design.md + dev-plan.md)
- Identical hash → Mark as verified
- Different hash → Compare timestamps

**Rule 4: Error classification**
- `404` → `git_missing` (after grace window)
- `304` → `not_modified` (use ETag)
- `429`/`5xx`/timeout → `error` (retry, don't mark as deleted)
- `401`/`403` → `error` (auth issue, retry)

### 7.2 Grace Window Implementation

```typescript
const GRACE_PERIOD_MS = 10 * 60 * 1000  // 10 minutes

// In ValidationService.handleGitNotFoundFeature():
const ageMs = Date.now() - dbData.created_at

if (ageMs < GRACE_PERIOD_MS) {
  // Within grace window - keep agent data, retry later
  await upsertFeature({
    ...dbData,
    verified: false,
    sync_state: 'pending_verify',
    last_git_checked_at: Date.now(),
    last_sync_error: 'Feature not yet in Git, waiting for push',
  })
  return { action: 'retry' }
}

// After grace window - mark as orphaned
await upsertFeature({
  ...dbData,
  source: 'agent_orphaned',
  verified: false,
  sync_state: 'git_missing',
  last_git_checked_at: Date.now(),
  last_sync_error: 'Feature deleted from Git, marked as orphaned',
})
```

---

## 8. Frontend Integration

### 8.1 Freshness Indicators (Already Implemented)

The frontend already displays sync state via badges:

| Badge | Condition | Meaning |
|-------|-----------|---------|
| ✅ Verified | `verified=true` | Confirmed to match Git |
| ⚡ Realtime | `source='agent' AND verified=false` | Fresh agent update, pending validation |
| ⏳ Pending | `sync_state='pending_verify'` | Waiting for validation |
| ⚠️ Conflict | `sync_state='conflict'` | Manual resolution needed |
| ❌ Error | `sync_state='error'` | Validation failed, will retry |
| 🔍 Orphaned | `source='agent_orphaned'` | Not found in Git |

### 8.2 Board Metadata (Already Implemented)

The API already returns:

```typescript
{
  features: [...],
  metadata: {
    total_features: 8,
    last_updated: "2026-03-08T...",
    source: "database",
    freshness: {
      verified_count: 5,
      realtime_count: 2,
      stale_count: 0,
      orphaned_count: 1,
      total_count: 8,
      verified_percentage: 62,
      stale_percentage: 0,
      should_fallback_to_git: false
    }
  }
}
```

---

## 9. Implementation Checklist

### Phase 1: Daily Reconcile

- [ ] Create `backend/src/workers/reconcile.ts`
  - [ ] Implement `dailyReconcile()` function
  - [ ] Use `BranchScanner` to scan Git
  - [ ] Compare Git vs DB
  - [ ] Upsert Git features to DB
  - [ ] Mark orphaned features
  - [ ] Return stats

- [ ] Create `api/cron/reconcile.ts`
  - [ ] Vercel cron endpoint handler
  - [ ] CRON_SECRET authentication
  - [ ] GITHUB_TOKEN validation
  - [ ] Call `dailyReconcile()`
  - [ ] Return JSON stats

- [ ] Update `vercel.json`
  - [ ] Add daily cron job (3am UTC)

### Phase 2: Source Field Enhancement

- [ ] Update `ValidationService`
  - [ ] Change `source='git'` to `source='agent_verified'` when agent data matches Git
  - [ ] Keep existing conflict resolution logic

- [ ] Update database queries
  - [ ] Ensure `source='agent_verified'` is treated as verified

### Phase 3: Testing

- [ ] Unit tests for `dailyReconcile()`
  - [ ] Test insert new features
  - [ ] Test update existing features
  - [ ] Test mark orphaned features
  - [ ] Test error handling

- [ ] Integration tests
  - [ ] Test full flow: Agent report → Validation → Reconcile
  - [ ] Test grace window behavior
  - [ ] Test conflict resolution

- [ ] Manual testing
  - [ ] Trigger reconcile job manually
  - [ ] Verify stats returned correctly
  - [ ] Check frontend displays correct badges

### Phase 4: Observability (Future)

- [ ] Add metrics
  - [ ] Reconcile duration
  - [ ] Features scanned/inserted/updated/orphaned
  - [ ] Validation queue size
  - [ ] Error rate

- [ ] Add alerts
  - [ ] Reconcile job failed
  - [ ] High orphaned feature count (> 10%)
  - [ ] Validation queue backlog (> 100 jobs)

---

## 10. Non-Goals

**Not implementing in this phase**:
- ❌ Fast/Slow lane scheduling (validation queue is simple FIFO)
- ❌ Selective dual-write (agent → Git + DB simultaneously)
- ❌ Manual conflict resolution UI
- ❌ Metrics/alerts infrastructure
- ❌ Multi-repo reconcile (one repo at a time)

**Why**: These add complexity without significant value given:
1. Validation queue already handles real-time updates efficiently
2. Daily reconcile provides sufficient Git sync
3. Manual conflict resolution is rare (Git always wins)

---

## 11. Success Criteria

**Must Have**:
- ✅ Agent reports appear in board immediately (source='agent', verified=false)
- ✅ Validation completes within 1-2 minutes for most cases
- ✅ Daily reconcile syncs all Git features to DB
- ✅ Frontend shows correct freshness badges
- ✅ No data loss (Git is always preserved)

**Nice to Have**:
- ✅ Agent data verified within 5 minutes (90% of cases)
- ✅ Orphaned features detected within 24 hours
- ✅ Reconcile completes in < 5 minutes for 100 features

---

## 12. Rollout Plan

**Step 1: Implement Daily Reconcile**
- Create reconcile worker
- Add cron endpoint
- Deploy to Vercel
- Manual trigger to verify

**Step 2: Update Source Field Logic**
- Add `agent_verified` state
- Update ValidationService
- Deploy

**Step 3: Monitor & Refine**
- Watch for errors in reconcile job
- Check validation queue behavior
- Adjust grace window if needed

**Step 4: Documentation**
- Document agent API for external tools
- Add troubleshooting guide
- Create runbook for operations

---

## Appendix A: Comparison with Original Design

| Original Design | Simplified Implementation | Rationale |
|-----------------|---------------------------|-----------|
| Fast lane (30-60s) + Slow lane (10-30min) | Single validation queue (1min) | Simpler, already works well |
| Multi-tier cron jobs | Daily reconcile only | BranchScanner efficiently handles full sync |
| Complex priority scheduling | Simple FIFO queue | Sufficient for current scale |
| Selective dual-write | Agent → DB → validate against Git | Less complexity, same outcome |
| Real-time Git scanning | Daily Git scan + realtime agent updates | Better performance, same data freshness |

**Key Insight**: Reusing `BranchScanner` eliminates the need for complex reconcile logic. The existing validation queue handles real-time updates efficiently.

---

## Appendix B: Example Scenarios

### Scenario 1: Happy Path (Agent → Push → Verify)

```
T0: Agent starts working on feature-123
  └→ POST /api/features/report { feature_id: "feature-123", status: "doing" }
      ├→ DB: source='agent', verified=false, sync_state='pending_verify'
      └→ Frontend: Shows "⚡ Realtime" badge

T0+30s: Agent pushes to Git
  └→ Git now has feature-123

T0+1min: Validation worker runs
  └→ GitHub API: GET feature-123
      ├→ Status: 200 OK
      ├→ Content hash: MATCH
      └→ DB: source='agent_verified', verified=true, sync_state='synced'
          └→ Frontend: Shows "✅ Verified" badge
```

### Scenario 2: Agent Work Not Pushed (Grace Window)

```
T0: Agent reports feature-456 (local work, not pushed)
  └→ POST /api/features/report
      └→ DB: source='agent', verified=false

T0+1min: Validation worker (attempt 1)
  └→ GitHub API: 404 Not Found
      └→ Age: 1min < 10min grace window
          └→ DB: sync_state='pending_verify' (retry later)
              └→ Frontend: Shows "⏳ Pending" badge

T0+5min: Validation worker (attempt 2)
  └→ GitHub API: 404 Not Found
      └→ Age: 5min < 10min grace window
          └→ Keep retrying

T0+12min: Validation worker (attempt 3)
  └→ GitHub API: 404 Not Found
      └→ Age: 12min > 10min grace window
          └→ DB: source='agent_orphaned', sync_state='git_missing'
              └→ Frontend: Shows "🔍 Orphaned" badge
```

### Scenario 3: Conflict (Git Overwrites Agent)

```
T0: Agent reports feature-789 with status="doing"
  └→ DB: source='agent', verified=false, status="doing"

T0+30s: Someone else pushes feature-789 to Git with status="shipped"
  └→ Git: status="shipped", updated_at=T0+30s

T0+1min: Validation worker
  └→ GitHub API: 200 OK, status="shipped"
      ├→ Content: DIFFERENT (status differs)
      ├→ Git timestamp: T0+30s > Agent timestamp: T0
      └→ Git is newer → Overwrite DB
          ├→ DB: source='git', verified=true, status="shipped"
          └→ Frontend: Shows "✅ Verified" with status="shipped"
```

### Scenario 4: Daily Reconcile Discovers New Feature

```
T0 (3am): Daily reconcile runs
  └→ BranchScanner scans all branches
      ├→ Finds feature-999 in Git (created 2 days ago)
      ├→ feature-999 not in DB (never reported by agent)
      └→ Insert to DB:
          ├→ source='git'
          ├→ verified=true
          └→ sync_state='synced'
              └→ Frontend: Next refresh shows feature-999 with "✅ Verified"
```

---

**End of Design Document**
