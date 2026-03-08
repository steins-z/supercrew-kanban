# Git-Database Auto-Refresh Design

**Date:** 2026-03-08
**Author:** Claude + qunmi
**Status:** Approved

---

## Problem Statement

Currently, the database-first board mode has a critical limitation: **Git updates do not automatically refresh the database.**

**Current Behavior:**
```
1. First access → Database empty → Trigger Git scan → Populate database ✅
2. Subsequent access → Read from database cache ✅
3. Git has new push → Database NOT updated ❌
4. User sees stale data until manual intervention ❌
```

**Impact:**
- Users see outdated feature statuses
- Agent-reported updates may be overwritten incorrectly
- Database only refreshes at 3:00 AM UTC (daily cron)
- Maximum staleness: ~24 hours

---

## Goals

### Primary Goal
Implement **quasi-realtime sync** (30s - 2min latency) from Git to Database.

### Secondary Goals
- Reuse existing code (avoid duplication)
- Minimize GitHub API consumption
- Prepare architecture for future webhook-based realtime sync
- No breaking changes to frontend

### Non-Goals
- Realtime sync via webhooks (defer to future phase)
- Bidirectional sync (Database → Git)
- Conflict resolution for simultaneous updates

---

## Design Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Git Origin Repo                           │
│                 (Source of Truth)                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ GitHub API (OAuth Token)
                        │
        ┌───────────────┼───────────────┬─────────────────┐
        │               │               │                 │
        ▼               ▼               ▼                 ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐      ┌─────────┐
   │首次访问  │    │Vercel Cron│    │用户手动  │      │Agent上报 │
   │(DB空)   │    │(2分钟)   │    │刷新     │      │验证     │
   └────┬────┘    └────┬────┘    └────┬────┘      └────┬────┘
        │              │              │                 │
        │         调用 /api/board/multi-branch          │
        │              │              │                 │
        └──────────────┼──────────────┘                 │
                       ▼                                 │
        ┌──────────────────────────────┐               │
        │  扫描 Git (BranchScanner)     │               │
        │  - 发现分支 (user/*)          │               │
        │  - 获取所有 features          │               │
        │  - 对比分支差异               │               │
        └──────────────┬────────────────┘               │
                       ▼                                 │
        ┌──────────────────────────────┐               │
        │ 后台同步到数据库               │<──────────────┘
        │ syncFeaturesToDatabase()     │  (验证队列)
        │  - 解析 meta.yaml            │
        │  - UPSERT features           │
        │  - source: 'git'             │
        │  - verified: true            │
        └──────────────┬────────────────┘
                       ▼
        ┌──────────────────────────────┐
        │      Turso Database           │
        │   (Real-time Cache)           │
        └──────────────┬────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   Frontend Dashboard          │
        │   (Database Mode)             │
        │   - 读取数据库                 │
        │   - 显示最新数据               │
        └───────────────────────────────┘
```

---

## Key Design Decision: Reuse `/api/board/multi-branch`

### Rationale

The existing `/api/board/multi-branch` endpoint already performs background database sync:

```typescript
// backend/src/routes/board.ts:529-531
syncFeaturesToDatabase(owner, repo, snapshots).catch(err => {
  console.error('[board/multi-branch] Database sync failed (non-critical):', err)
})
```

**Benefits of Reuse:**
- ✅ No new code required
- ✅ Leverage existing Git scanning logic
- ✅ Proven implementation (already in production)
- ✅ Simple Vercel Cron configuration

**Trade-offs:**
- ⚠️ Endpoint dual-purpose (user-facing + cron trigger)
- ⚠️ Cannot optimize cron-specific logic separately

**Why This Is Acceptable:**
- The endpoint is idempotent (safe to call repeatedly)
- Database sync is already non-blocking (background task)
- Future webhook migration is still straightforward

---

## Implementation Components

### 1. Vercel Cron Job

**Configuration:**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/board/multi-branch?branch_pattern=user/*",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

**Schedule:** Every 2 minutes
**Execution:** Vercel Edge (automatic)
**Timeout:** 60 seconds (Pro plan)

---

### 2. Authentication Strategy

**Problem:** Cron needs GitHub token, but endpoint expects `Authorization` header.

**Solution:** Multi-source token resolution

```typescript
// backend/src/routes/board.ts
boardRouter.get('/multi-branch', async (c) => {
  // Priority: 1. Bearer token, 2. Environment variable, 3. Fail
  const token =
    c.req.header('Authorization')?.replace('Bearer ', '') ||  // User request
    c.env?.GITHUB_TOKEN ||                                     // Vercel Cron
    process.env.GITHUB_TOKEN                                   // Local dev

  if (!token) {
    return c.json({ error: 'Missing GitHub token' }, 401)
  }

  // Existing logic continues...
})
```

**Required Environment Variable:**
- **Vercel:** `GITHUB_TOKEN` (GitHub Personal Access Token with `repo` scope)

---

### 3. Data Flow

**Timeline Example:**

```
T0 (00:00:00) - User pushes to user/alice/feature-1
  │
  ├─ Git: feature-1 status = "doing"
  └─ Database: feature-1 status = "todo" (stale)

T1 (00:02:00) - Vercel Cron triggers
  │
  ├─ GET /api/board/multi-branch?branch_pattern=user/*
  ├─ BranchScanner fetches all user/* branches
  ├─ Discovers feature-1 with status="doing"
  └─ syncFeaturesToDatabase() → UPSERT feature-1
      - source: 'git'
      - verified: true
      - status: 'doing'
      - last_git_checked_at: NOW

T2 (00:02:05) - User visits Dashboard (mode='database')
  │
  ├─ GET /api/board (database mode)
  ├─ SELECT * FROM features
  └─ Returns feature-1 with status="doing" ✅

Delay: ~2 minutes (acceptable for quasi-realtime)
```

---

## Performance Analysis

### GitHub API Consumption

**Current Daily Usage:**
- Daily Cron (3:00 AM UTC): 1 full scan = ~15 API calls
- User-triggered scans (Git mode): Variable

**New Daily Usage (with 2-min Cron):**
- Cron scans: 720 scans/day × 15 calls/scan = **10,800 API calls/day**
- User scans: Same as before

**GitHub API Limits:**
- Authenticated: 5,000 calls/hour = 120,000 calls/day
- Cron consumption: 10,800 / 120,000 = **9% of quota**
- ✅ Well within limits

**Per-Scan Breakdown:**
```
1. GET /repos/:owner/:repo/branches?pattern=user/* → 1 call
2. For each branch (assume 10 branches):
   - GET /repos/:owner/:repo/contents/.supercrew/tasks → 1 call
   - For each feature (assume 1 feature/branch):
     - GET .../meta.yaml → 1 call (with ETag)
     - GET .../dev-design.md → 1 call (conditional)
     - GET .../dev-plan.md → 1 call (conditional)

Total: 1 + 10 + (10 × 3) = 41 calls per scan (worst case)
With ETag optimization: ~15 calls per scan (typical)
```

---

### Vercel Cron Limits

**Free Plan:**
- 100 executions/day
- 2-min cron = 720 executions/day ❌ **Exceeds limit**

**Pro Plan ($20/month):**
- Unlimited executions ✅

**Required:** Vercel Pro plan for 2-minute cron interval.

**Alternative (if Free plan required):**
- Reduce frequency to 10-min cron (144 executions/day) ✅
- Delay increases to ~10 minutes

---

## Error Handling

### Scenario 1: GitHub API Failure

```typescript
try {
  const branches = await scanner.discoverBranches(branchPattern)
} catch (error) {
  console.error('[Cron] Git scan failed:', error)
  return c.json({
    error: 'Git scan failed',
    details: error.message
  }, 500)
}
```

**Behavior:**
- ❌ Current sync fails
- ✅ Database retains previous data
- ✅ Next cron run (2 min later) retries
- ✅ Logged to Vercel dashboard

---

### Scenario 2: Database Write Failure

```typescript
syncFeaturesToDatabase(owner, repo, snapshots).catch(err => {
  console.error('[Cron] Database sync failed:', err)
  // Non-blocking - does not prevent multi-branch response
})
```

**Behavior:**
- ❌ Database not updated this run
- ✅ Git scan still succeeds (for Git mode users)
- ✅ Next cron run retries database sync
- ✅ Non-critical error (logged only)

---

### Scenario 3: Cron Execution Timeout

**Vercel Limits:**
- Free: 10 seconds
- Pro: 60 seconds

**Typical Scan Duration:** 3-5 seconds

**Mitigation:**
- ✅ BranchScanner uses parallel fetching (Promise.all)
- ✅ Database sync is non-blocking
- ✅ Well under timeout limits

**If timeout occurs:**
- Partial data may be synced
- Next cron run completes the sync
- Daily cron (3:00 AM) provides eventual consistency

---

## Monitoring and Observability

### Logging Strategy

```typescript
console.log('[Cron] Starting Git sync', {
  repo: `${owner}/${repo}`,
  timestamp: new Date().toISOString(),
  trigger: 'cron'
})

console.log('[Cron] Sync completed', {
  branches: branches.length,
  features: snapshots.length,
  synced_to_db: true,
  duration_ms: Date.now() - startTime
})
```

**View Logs:**
- Vercel Dashboard → Functions → Cron Executions
- Filter by path: `/api/board/multi-branch`

---

### Health Check Endpoint (Optional)

```typescript
// GET /api/sync/status
boardRouter.get('/sync/status', async (c) => {
  const { db } = await import('../services/database.js')
  const result = await db.execute({
    sql: `SELECT
            COUNT(*) as total,
            MAX(last_git_checked_at) as last_sync,
            MIN(last_git_checked_at) as oldest_sync
          FROM features
          WHERE repo_owner = ? AND repo_name = ?`,
    args: ['steins-z', 'supercrew-kanban']
  })

  const lastSync = result.rows[0]?.last_sync || 0
  const now = Date.now()

  return c.json({
    total_features: result.rows[0]?.total || 0,
    last_sync_at: new Date(lastSync).toISOString(),
    staleness_minutes: Math.round((now - lastSync) / 60000),
    is_stale: (now - lastSync) > 5 * 60 * 1000,  // > 5 minutes
    status: (now - lastSync) > 5 * 60 * 1000 ? 'stale' : 'fresh'
  })
})
```

**Usage:**
- Manual health check: `curl https://app.com/api/sync/status`
- Uptime monitoring integration (Vercel Analytics)

---

## Future Migration Path: Webhooks

When ready to upgrade to realtime sync, the architecture supports it seamlessly.

### Current (Cron-based)
```
Vercel Cron (every 2 min)
  ↓
GET /api/board/multi-branch
  ↓
Scan Git + Sync Database
```

### Future (Webhook-based)
```
GitHub Push Event
  ↓
POST /api/webhook/github
  ↓
Trigger: GET /api/board/multi-branch
  ↓
Scan Git + Sync Database

(Keep Cron at 10-min interval as fallback)
```

**Migration Steps:**
1. Implement `POST /api/webhook/github` endpoint
2. Configure GitHub webhook → `https://app.com/api/webhook/github`
3. Reduce Cron frequency: 2 min → 10 min (fallback)
4. Webhook provides <5s latency
5. Cron ensures eventual consistency (safety net)

**Webhook Implementation Preview:**
```typescript
// backend/src/routes/webhook.ts
import { Hono } from 'hono'
import crypto from 'crypto'

export const webhookRouter = new Hono()

webhookRouter.post('/github', async (c) => {
  // 1. Verify GitHub signature
  const signature = c.req.header('X-Hub-Signature-256')
  const payload = await c.req.text()
  const secret = c.env.GITHUB_WEBHOOK_SECRET

  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  if (signature !== expectedSig) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  // 2. Parse event
  const event = JSON.parse(payload)

  // 3. Filter relevant events (push to user/* branches)
  if (event.ref && event.ref.startsWith('refs/heads/user/')) {
    // 4. Trigger sync (reuse existing endpoint)
    const token = c.env.GITHUB_TOKEN
    await fetch(`${baseUrl}/api/board/multi-branch?branch_pattern=user/*`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Repo-Owner': event.repository.owner.login,
        'X-Repo-Name': event.repository.name
      }
    })
  }

  return c.json({ ok: true })
})
```

---

## Testing Plan

### Local Testing

**Step 1: Test endpoint with environment variable**
```bash
export GITHUB_TOKEN=ghp_your_token_here
cd backend
bun run dev

# In another terminal
curl http://localhost:3001/api/board/multi-branch?branch_pattern=user/*
```

**Verify:**
- ✅ Git scan succeeds
- ✅ Database updated (check with `bun run diagnose-db.ts`)
- ✅ Console logs show sync completion

---

**Step 2: Simulate cron behavior**
```bash
# Wait 2 minutes, call again
sleep 120
curl http://localhost:3001/api/board/multi-branch?branch_pattern=user/*

# Check database for updated last_git_checked_at
bun run diagnose-db.ts
```

---

### Production Testing

**Step 1: Deploy to Vercel**
```bash
git add vercel.json
git commit -m "feat: add 2-min cron for Git-DB sync"
git push
```

**Step 2: Configure environment variable**
- Vercel Dashboard → Settings → Environment Variables
- Add `GITHUB_TOKEN` = `ghp_your_token_here`
- Scope: Production + Preview

**Step 3: Monitor first cron execution**
- Vercel Dashboard → Functions → Cron
- Wait for next 2-minute cycle
- Check execution logs

**Step 4: Verify database sync**
```bash
# Call health check endpoint
curl https://your-app.vercel.app/api/sync/status

# Expected response:
{
  "total_features": 9,
  "last_sync_at": "2026-03-08T10:42:00.000Z",
  "staleness_minutes": 0,
  "is_stale": false,
  "status": "fresh"
}
```

---

## Rollout Plan

### Phase 1: Implementation (Day 1)
- [ ] Update `vercel.json` with cron configuration
- [ ] Modify `/api/board/multi-branch` to support env var token
- [ ] Add health check endpoint (optional)
- [ ] Test locally

### Phase 2: Deployment (Day 1)
- [ ] Deploy to Vercel
- [ ] Configure `GITHUB_TOKEN` environment variable
- [ ] Monitor first 10 cron executions

### Phase 3: Validation (Day 2-3)
- [ ] Verify database freshness (< 2 min staleness)
- [ ] Check GitHub API usage (should be ~10% of quota)
- [ ] Monitor Vercel cron execution success rate (target: >99%)

### Phase 4: Optimization (Week 2)
- [ ] Review logs for patterns
- [ ] Adjust cron frequency if needed
- [ ] Implement caching if duplicate scans detected

### Phase 5: Documentation (Week 2)
- [ ] Update sync flow diagram
- [ ] Add cron monitoring runbook
- [ ] Document troubleshooting steps

---

## Success Metrics

**Primary Metrics:**
- ✅ Database staleness: < 2 minutes (95th percentile)
- ✅ Cron success rate: > 99%
- ✅ GitHub API usage: < 20% of quota

**Secondary Metrics:**
- User-reported stale data incidents: 0
- Database sync failures: < 1%
- Average sync duration: < 5 seconds

---

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Vercel Cron quota exceeded | Service degradation | Low | Pro plan has unlimited crons |
| GitHub API rate limit hit | Sync fails | Low | Current usage is 9% of quota |
| Database write failures | Stale data | Medium | Daily cron provides fallback |
| Cron execution timeout | Partial sync | Low | Scans typically complete in 3-5s |
| Cost increase (Pro plan) | Budget impact | High | $20/month acceptable for reliability |

---

## Open Questions

**Q1: Should we add a manual refresh button in the frontend?**
**A:** Yes, already exists in current implementation. Preserve it.

**Q2: Should we notify users when data is stale?**
**A:** Not in Phase 1. Consider in Phase 4 if staleness issues arise.

**Q3: Should we implement the health check endpoint?**
**A:** Optional for Phase 1. Useful for debugging but not required.

---

## Conclusion

This design provides a pragmatic solution to the Git-DB sync problem by:

1. **Reusing existing code** - No new scanning logic required
2. **Minimal configuration** - Just add Vercel cron + env var
3. **Quasi-realtime sync** - 2-minute latency acceptable for current needs
4. **Future-proof** - Clear migration path to webhooks
5. **Low risk** - Idempotent operations, background sync, proven endpoints

**Next Step:** Write implementation plan using `writing-plans` skill.
