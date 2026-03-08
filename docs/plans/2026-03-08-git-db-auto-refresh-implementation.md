# Git-Database Auto-Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable automatic Git-to-Database sync every 2 minutes via Vercel Cron to eliminate stale data.

**Architecture:** Reuse existing `/api/board/multi-branch` endpoint which already performs background database sync. Add Vercel Cron to call it every 2 minutes. Modify token authentication to support environment variables for cron execution.

**Tech Stack:** Vercel Cron, Hono (existing), Turso Database (existing), GitHub API (existing)

---

## Task 1: Update Multi-Branch Endpoint Authentication

**Goal:** Allow `/api/board/multi-branch` to accept GitHub token from environment variable (for cron) in addition to Authorization header (for users).

**Files:**
- Modify: `backend/src/routes/board.ts:476-492`

---

**Step 1: Locate the current token extraction logic**

Read the file:
```bash
cat backend/src/routes/board.ts | grep -A 20 "boardRouter.get('/multi-branch'"
```

Expected: See current logic around line 479:
```typescript
const token = c.req.header('Authorization')?.replace('Bearer ', '')
```

---

**Step 2: Modify token extraction to support multiple sources**

Edit `backend/src/routes/board.ts`:

Find (around line 479):
```typescript
const token = c.req.header('Authorization')?.replace('Bearer ', '')
```

Replace with:
```typescript
// Priority: 1. Bearer token (user request), 2. Environment variable (cron), 3. Fail
const token =
  c.req.header('Authorization')?.replace('Bearer ', '') ||
  c.env?.GITHUB_TOKEN ||
  process.env.GITHUB_TOKEN
```

---

**Step 3: Test locally with environment variable**

Set environment variable:
```bash
export GITHUB_TOKEN=ghp_your_token_here
cd backend
bun run dev
```

In another terminal, test the endpoint:
```bash
curl http://localhost:3001/api/board/multi-branch?branch_pattern=user/*
```

Expected:
- ✅ Response with features list
- ✅ Console logs showing Git scan and database sync
- ✅ No authentication errors

---

**Step 4: Test that Authorization header still works**

Without GITHUB_TOKEN in env, call with header:
```bash
unset GITHUB_TOKEN
curl -H "Authorization: Bearer ghp_your_token_here" \
  http://localhost:3001/api/board/multi-branch?branch_pattern=user/*
```

Expected: Same successful response

---

**Step 5: Commit the authentication change**

```bash
git add backend/src/routes/board.ts
git commit -m "feat: support env var GITHUB_TOKEN for multi-branch endpoint

Allow /api/board/multi-branch to accept GitHub token from:
1. Authorization header (user requests)
2. Environment variable GITHUB_TOKEN (Vercel Cron)
3. process.env.GITHUB_TOKEN (local dev)

This enables Vercel Cron to authenticate without Bearer token.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add Vercel Cron Configuration

**Goal:** Configure Vercel to call `/api/board/multi-branch` every 2 minutes.

**Files:**
- Modify: `vercel.json`

---

**Step 1: Read current vercel.json configuration**

```bash
cat vercel.json
```

Expected: See existing configuration (routes, rewrites, etc.)

---

**Step 2: Add crons configuration**

Edit `vercel.json`:

Add this configuration (if `crons` key doesn't exist, create it):
```json
{
  "crons": [
    {
      "path": "/api/board/multi-branch?branch_pattern=user/*",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

**If vercel.json already has other config**, merge it:
```json
{
  "buildCommand": "...",
  "rewrites": [...],
  "crons": [
    {
      "path": "/api/board/multi-branch?branch_pattern=user/*",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

**Schedule explained:**
- `*/2 * * * *` = Every 2 minutes
- Standard cron syntax: `minute hour day month weekday`

---

**Step 3: Validate JSON syntax**

```bash
cat vercel.json | jq .
```

Expected: No JSON syntax errors

---

**Step 4: Commit Vercel Cron configuration**

```bash
git add vercel.json
git commit -m "feat: add Vercel Cron for Git-DB sync every 2 minutes

Configure Vercel to call /api/board/multi-branch every 2 minutes.
This ensures database stays fresh with Git updates.

Cron schedule: */2 * * * * (every 2 minutes)
Endpoint: /api/board/multi-branch?branch_pattern=user/*

Requires: Vercel Pro plan (unlimited cron executions)
Requires: GITHUB_TOKEN environment variable in Vercel

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Add Health Check Endpoint (Optional)

**Goal:** Create `/api/sync/status` endpoint to monitor database freshness.

**Files:**
- Modify: `backend/src/routes/board.ts` (add new route)

---

**Step 1: Add health check route to boardRouter**

Edit `backend/src/routes/board.ts`:

Add this route **before** the `export` statement (around end of file):

```typescript
// Health check: Database sync status
boardRouter.get('/sync/status', async (c) => {
  try {
    const repoOwner = c.req.query('repo_owner') || 'steins-z'
    const repoName = c.req.query('repo_name') || 'supercrew-kanban'

    const { db } = await import('../services/database.js')
    const result = await db.execute({
      sql: `SELECT
              COUNT(*) as total,
              MAX(last_git_checked_at) as last_sync,
              MIN(last_git_checked_at) as oldest_sync
            FROM features
            WHERE repo_owner = ? AND repo_name = ?`,
      args: [repoOwner, repoName],
    })

    const row = result.rows[0] as any
    const lastSync = Number(row?.last_sync || 0)
    const now = Date.now()
    const stalenessMs = now - lastSync
    const stalenessMinutes = Math.round(stalenessMs / 60000)

    return c.json({
      repo: `${repoOwner}/${repoName}`,
      total_features: Number(row?.total || 0),
      last_sync_at: lastSync > 0 ? new Date(lastSync).toISOString() : null,
      staleness_minutes: stalenessMinutes,
      is_stale: stalenessMs > 5 * 60 * 1000, // > 5 minutes
      status: stalenessMs > 5 * 60 * 1000 ? 'stale' : 'fresh',
    })
  } catch (error) {
    console.error('[sync/status] Error:', error)
    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})
```

---

**Step 2: Test the health check endpoint locally**

Start backend:
```bash
cd backend
bun run dev
```

Call health check:
```bash
curl http://localhost:3001/api/board/sync/status
```

Expected response:
```json
{
  "repo": "steins-z/supercrew-kanban",
  "total_features": 9,
  "last_sync_at": "2026-03-08T10:42:00.000Z",
  "staleness_minutes": 0,
  "is_stale": false,
  "status": "fresh"
}
```

---

**Step 3: Test with custom repo params**

```bash
curl "http://localhost:3001/api/board/sync/status?repo_owner=test&repo_name=test"
```

Expected:
```json
{
  "repo": "test/test",
  "total_features": 0,
  "last_sync_at": null,
  ...
}
```

---

**Step 4: Commit health check endpoint**

```bash
git add backend/src/routes/board.ts
git commit -m "feat: add sync status health check endpoint

Add GET /api/board/sync/status to monitor database freshness:
- Total features count
- Last sync timestamp
- Staleness in minutes
- Status: fresh (<5 min) or stale (>5 min)

Usage:
  curl /api/board/sync/status
  curl /api/board/sync/status?repo_owner=X&repo_name=Y

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Deploy to Vercel

**Goal:** Deploy changes to Vercel and configure environment variables.

**Files:**
- None (deployment task)

---

**Step 1: Push commits to remote repository**

```bash
git push origin user/qunmi/database-agent-reporting-api
```

Expected: All commits pushed successfully

---

**Step 2: Deploy to Vercel**

If using Vercel CLI:
```bash
vercel --prod
```

If using GitHub integration:
- Push triggers automatic deployment
- Wait for deployment to complete
- Check Vercel Dashboard

---

**Step 3: Configure GITHUB_TOKEN environment variable**

In Vercel Dashboard:
1. Navigate to your project
2. Settings → Environment Variables
3. Add new variable:
   - **Key**: `GITHUB_TOKEN`
   - **Value**: `ghp_your_github_personal_access_token`
   - **Scope**: Production + Preview

**How to create GitHub token:**
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: `repo` (full control)
4. Copy token (starts with `ghp_`)

---

**Step 4: Trigger a redeployment to apply env var**

In Vercel Dashboard:
1. Go to Deployments
2. Click latest deployment
3. Click "Redeploy" button

Or via CLI:
```bash
vercel --prod --force
```

Wait for deployment to complete.

---

**Step 5: Verify cron is scheduled**

In Vercel Dashboard:
1. Navigate to project → Cron Jobs
2. Verify cron job appears:
   - Path: `/api/board/multi-branch?branch_pattern=user/*`
   - Schedule: `*/2 * * * *`
   - Status: Active

---

## Task 5: Monitor and Validate

**Goal:** Verify cron executions are working and database is being synced.

**Files:**
- None (monitoring task)

---

**Step 1: Wait for first cron execution (up to 2 minutes)**

Wait for the next 2-minute cycle (e.g., if current time is 10:42:30, wait until 10:44:00).

---

**Step 2: Check Vercel cron execution logs**

In Vercel Dashboard:
1. Go to Functions → Cron
2. Filter by path: `/api/board/multi-branch`
3. View latest execution

Expected logs:
```
[scanAndSyncFromGit] Starting Git scan for steins-z/supercrew-kanban
[scanAndSyncFromGit] Discovered X branches
[scanAndSyncFromGit] Fetched Y snapshots
[syncFeaturesToDatabase] Synced Y features to database
```

---

**Step 3: Verify database was updated**

Call health check endpoint:
```bash
curl https://your-app.vercel.app/api/board/sync/status
```

Expected response:
```json
{
  "total_features": 9,
  "last_sync_at": "2026-03-08T10:44:00.123Z",  // Recent timestamp
  "staleness_minutes": 0,
  "is_stale": false,
  "status": "fresh"
}
```

**Staleness should be < 2 minutes**

---

**Step 4: Test end-to-end flow**

**Scenario:** Push to Git → Wait 2 min → Check database

1. Make a change to a feature in Git:
   ```bash
   # In your local repo
   cd .supercrew/tasks/test-feature
   vim meta.yaml
   # Change status: todo → doing

   git add .
   git commit -m "test: change status for cron validation"
   git push
   ```

2. Wait for next cron execution (up to 2 minutes)

3. Call `/api/board` (database mode):
   ```bash
   curl https://your-app.vercel.app/api/board?repo_owner=steins-z&repo_name=supercrew-kanban
   ```

4. Verify the feature status is updated in response

Expected: Status changed from `todo` to `doing` ✅

---

**Step 5: Monitor for 24 hours**

Check the following metrics over 24 hours:

**Vercel Dashboard:**
- Cron execution count: Should be ~720 executions/day
- Success rate: Should be > 99%
- Average duration: Should be < 5 seconds

**Health Check API:**
```bash
# Run this hourly
curl https://your-app.vercel.app/api/board/sync/status
```

Expected:
- `is_stale: false` (always)
- `staleness_minutes: 0-2` (always)

**GitHub API Usage:**
- Check remaining quota: https://api.github.com/rate_limit
- Expected consumption: ~450-720 calls/hour
- Should stay well below 5000/hour limit

---

## Task 6: Update Documentation

**Goal:** Document the new sync mechanism in the flow diagram.

**Files:**
- Modify: `docs/git-db-sync-flow.md`

---

**Step 1: Read current sync flow documentation**

```bash
cat docs/git-db-sync-flow.md | head -100
```

Expected: See architecture diagrams

---

**Step 2: Update architecture diagram**

Edit `docs/git-db-sync-flow.md`:

Find the architecture section (around line 11) and update:

OLD:
```
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ 首次访问  │    │ 每日定时  │    │  验证队列  │
   │Auto-Sync│    │Daily Cron│    │Validation│
```

NEW:
```
   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ 首次访问  │    │ 2分钟定时 │    │  手动刷新  │    │  验证队列  │
   │Auto-Sync│    │Vercel Cron│   │Manual Sync│   │Validation│
```

---

**Step 3: Add sync trigger table**

Add this section after the architecture diagram:

```markdown
## Sync Trigger Mechanisms

| 触发时机 | 条件 | 频率 | 延迟 |
|---------|------|------|------|
| 首次访问 | 数据库为空 | 一次性 | 0s |
| **定时同步 (新)** | **Vercel Cron** | **每 2 分钟** | **< 2 分钟** |
| 手动刷新 | 用户点击刷新按钮 | 按需 | 0s |
| 每日兜底 | Vercel Cron (3:00 AM UTC) | 每天 | ~ |
| 验证队列 | Agent 上报后 | 后台持续 | ~ |

**新增：2 分钟定时同步确保数据始终新鲜（最大延迟 2 分钟）**
```

---

**Step 4: Commit documentation updates**

```bash
git add docs/git-db-sync-flow.md
git commit -m "docs: update sync flow with 2-min Vercel Cron

Add new sync mechanism to architecture diagram:
- 2-minute Vercel Cron for automatic Git-DB sync
- Update sync trigger table with frequency and latency

Maximum data staleness: 2 minutes (down from 24 hours)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Create Monitoring Runbook

**Goal:** Document troubleshooting steps for when sync fails.

**Files:**
- Create: `docs/runbooks/git-db-sync-monitoring.md`

---

**Step 1: Create runbook file**

```bash
cat > docs/runbooks/git-db-sync-monitoring.md << 'EOF'
# Git-DB Sync Monitoring Runbook

## Overview

This runbook describes how to monitor and troubleshoot the Vercel Cron-based Git-to-Database sync.

---

## Health Check

**Endpoint:** `GET /api/board/sync/status`

**Expected Response:**
```json
{
  "total_features": 9,
  "last_sync_at": "2026-03-08T10:44:00.123Z",
  "staleness_minutes": 0,
  "is_stale": false,
  "status": "fresh"
}
```

**Alert Thresholds:**
- `staleness_minutes > 5` → Warning
- `staleness_minutes > 10` → Critical

---

## Common Issues

### Issue 1: Staleness > 5 minutes

**Symptoms:**
- Health check shows `is_stale: true`
- Users report outdated data

**Diagnosis:**
1. Check Vercel Cron execution logs
2. Look for failed executions
3. Check GitHub API rate limit

**Resolution:**
```bash
# Check GitHub API quota
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/rate_limit

# Manual trigger (if cron is failing)
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://your-app.vercel.app/api/board/multi-branch?branch_pattern=user/*
```

---

### Issue 2: Cron executions failing

**Symptoms:**
- Vercel Dashboard shows failed cron jobs
- Logs show authentication errors

**Diagnosis:**
1. Verify GITHUB_TOKEN is set in Vercel
2. Check token has `repo` scope
3. Check token is not expired

**Resolution:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Verify `GITHUB_TOKEN` exists
3. Update token if expired:
   - Generate new token at https://github.com/settings/tokens
   - Update in Vercel
   - Redeploy

---

### Issue 3: GitHub API rate limit exceeded

**Symptoms:**
- Logs show "API rate limit exceeded"
- Cron executions fail intermittently

**Diagnosis:**
```bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```

Check `rate.remaining` - should be > 0

**Resolution:**
- Rate limit resets hourly
- If consistently hitting limit, reduce cron frequency:
  - Change `*/2 * * * *` to `*/5 * * * *` (every 5 min)
  - Update vercel.json and redeploy

---

## Monitoring Checklist

**Daily:**
- [ ] Check health status: `staleness_minutes < 5`
- [ ] Verify cron success rate > 99%

**Weekly:**
- [ ] Review Vercel cron execution logs
- [ ] Check GitHub API usage trend
- [ ] Verify no pattern of failures

**Monthly:**
- [ ] Rotate GitHub token (security best practice)
- [ ] Review Vercel billing for cron costs

---

## Escalation

If issue persists after following runbook:
1. Check #supercrew-kanban Slack channel
2. Create GitHub issue with:
   - Health check output
   - Vercel cron logs
   - GitHub API rate limit status
3. Tag: @qunmi
EOF
```

---

**Step 2: Commit runbook**

```bash
git add docs/runbooks/git-db-sync-monitoring.md
git commit -m "docs: add Git-DB sync monitoring runbook

Create troubleshooting guide for Vercel Cron sync:
- Health check procedures
- Common issues and resolutions
- Monitoring checklist
- Escalation process

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Final Validation and Cleanup

**Goal:** Perform final end-to-end validation and clean up any temporary changes.

**Files:**
- None (validation task)

---

**Step 1: Run complete end-to-end test**

**Test Scenario:** Simulate full workflow

1. **Make Git change:**
   ```bash
   cd .supercrew/tasks/test-reconcile-feature
   sed -i '' 's/status: doing/status: ready-to-ship/' meta.yaml
   git add meta.yaml
   git commit -m "test: e2e validation - change status"
   git push
   ```

2. **Wait for cron (2 minutes)**
   ```bash
   sleep 120
   ```

3. **Verify database updated:**
   ```bash
   curl https://your-app.vercel.app/api/board/sync/status
   # Check: staleness_minutes should be 0-2
   ```

4. **Verify frontend shows updated status:**
   - Open dashboard in browser
   - Navigate to test-reconcile-feature card
   - Verify status shows "ready-to-ship" ✅

5. **Revert test change:**
   ```bash
   cd .supercrew/tasks/test-reconcile-feature
   sed -i '' 's/status: ready-to-ship/status: doing/' meta.yaml
   git add meta.yaml
   git commit -m "test: revert e2e validation change"
   git push
   ```

---

**Step 2: Verify all metrics**

Check final metrics:

**Vercel Dashboard:**
- ✅ Cron job scheduled and active
- ✅ Last 10 executions successful
- ✅ Average duration < 5 seconds

**GitHub API:**
```bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```
- ✅ Remaining quota > 4000 (plenty of headroom)

**Health Check:**
```bash
curl https://your-app.vercel.app/api/board/sync/status
```
- ✅ `is_stale: false`
- ✅ `staleness_minutes: 0-2`
- ✅ `total_features: 9`

---

**Step 3: Create final summary commit**

```bash
git add .
git commit -m "feat: complete Git-DB auto-refresh implementation

Implemented automatic Git-to-Database sync via Vercel Cron:
- Cron calls /api/board/multi-branch every 2 minutes
- Database stays fresh (max 2-min staleness)
- Multi-source token auth (Bearer + env var)
- Health check endpoint for monitoring
- Full documentation and runbook

Metrics:
- Max latency: 2 minutes
- Cron frequency: 720 executions/day
- GitHub API usage: ~9% of quota
- Success rate: >99%

Files changed:
- backend/src/routes/board.ts (auth + health check)
- vercel.json (cron config)
- docs/git-db-sync-flow.md (updated diagrams)
- docs/runbooks/git-db-sync-monitoring.md (new)

Requires: Vercel Pro plan, GITHUB_TOKEN env var

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

**Step 4: Push all changes**

```bash
git push origin user/qunmi/database-agent-reporting-api
```

Expected: All commits pushed successfully ✅

---

**Step 5: Create Pull Request (if ready)**

If this branch is ready for review:

```bash
gh pr create \
  --title "feat: Git-DB auto-refresh via Vercel Cron" \
  --body "$(cat <<'EOF'
## Summary
Implements automatic Git-to-Database sync every 2 minutes via Vercel Cron.

## Problem
Database does not refresh when Git is updated (max 24h staleness).

## Solution
- Vercel Cron calls `/api/board/multi-branch` every 2 minutes
- Endpoint already performs background database sync
- Multi-source token authentication (Bearer header + env var)

## Key Changes
- `backend/src/routes/board.ts` - Multi-source token auth + health check
- `vercel.json` - Cron configuration
- Documentation updates

## Testing
- ✅ Local testing with env var
- ✅ Vercel deployment validated
- ✅ 24hr monitoring completed
- ✅ Health check endpoint working
- ✅ End-to-end test passed

## Metrics
- Max staleness: 2 minutes (down from 24 hours)
- Cron success rate: >99%
- GitHub API usage: ~9% of quota

## Requirements
- Vercel Pro plan ($20/month)
- `GITHUB_TOKEN` environment variable

## Monitoring
- Health check: `GET /api/board/sync/status`
- Runbook: `docs/runbooks/git-db-sync-monitoring.md`

🤖 Generated with Claude Code
EOF
)"
```

Or manually create PR in GitHub UI.

---

## Success Criteria

**Implementation is complete when:**

- ✅ Vercel Cron is scheduled and running
- ✅ Cron executes every 2 minutes successfully
- ✅ Database `last_git_checked_at` updates every 2 minutes
- ✅ Health check shows `staleness_minutes < 5` consistently
- ✅ Frontend displays Git updates within 2 minutes
- ✅ GitHub API usage stays below 20% of quota
- ✅ All commits pushed and documented
- ✅ Monitoring runbook created

---

## Rollback Plan

If issues arise after deployment:

**Step 1: Disable Vercel Cron**

In Vercel Dashboard:
1. Go to Cron Jobs
2. Find `/api/board/multi-branch` cron
3. Click "Disable"

**Step 2: Revert code changes**

```bash
git revert HEAD~3..HEAD  # Revert last 3 commits
git push origin user/qunmi/database-agent-reporting-api --force
```

**Step 3: Redeploy**

```bash
vercel --prod
```

**Step 4: Fallback to daily cron**

The existing daily cron (3:00 AM UTC) will continue to work.
Max staleness returns to ~24 hours (acceptable for rollback period).

---

## Notes

- **Vercel Pro Plan Required:** Free plan only allows 100 cron executions/day (insufficient for 2-min frequency)
- **GitHub Token Security:** Rotate token monthly, use least-privilege scopes
- **Monitoring:** Set up alerts for `staleness_minutes > 5` via Vercel Analytics or external monitoring
- **Future Enhancement:** Replace cron with GitHub webhooks for <5s latency
