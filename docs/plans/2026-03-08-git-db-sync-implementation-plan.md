# Git-DB Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement daily Git reconciliation and agent verification system to sync database with Git source of truth.

**Architecture:** Reuse existing BranchScanner for daily full Git sync. Enhance ValidationService to mark agent data as 'agent_verified' when it matches Git. Add daily cron job that runs reconciliation at 3am UTC.

**Tech Stack:** Hono API, Turso/SQLite database, BranchScanner, ValidationService, Vercel Cron, TypeScript

---

## Phase 1: Daily Reconcile Worker

### Task 1: Create reconcile worker scaffold

**Files:**
- Create: `backend/src/workers/reconcile.ts`

**Step 1: Create file with basic structure**

```typescript
// Daily reconciliation worker
// Scans all Git branches and syncs features to database

import { BranchScanner } from '../services/branch-scanner.js'
import { getFeatures, upsertFeature } from '../services/database.js'
import type { FileSnapshot } from '../types/board.js'

export interface ReconcileStats {
  scanned: number
  inserted: number
  updated: number
  orphaned: number
  errors: number
}

/**
 * Daily reconcile: Scan Git and sync all features to DB
 */
export async function dailyReconcile(
  repoOwner: string,
  repoName: string,
  githubToken: string
): Promise<ReconcileStats> {
  // TODO: Implement
  return {
    scanned: 0,
    inserted: 0,
    updated: 0,
    orphaned: 0,
    errors: 0,
  }
}
```

**Step 2: Commit scaffold**

```bash
git add backend/src/workers/reconcile.ts
git commit -m "feat: add daily reconcile worker scaffold"
```

---

### Task 2: Implement Git scanning logic

**Files:**
- Modify: `backend/src/workers/reconcile.ts`

**Step 1: Add Git scanning using BranchScanner**

Replace the `dailyReconcile` function body with:

```typescript
export async function dailyReconcile(
  repoOwner: string,
  repoName: string,
  githubToken: string
): Promise<ReconcileStats> {
  console.log(`[Reconcile] Starting daily reconcile for ${repoOwner}/${repoName}`)

  const stats: ReconcileStats = {
    scanned: 0,
    inserted: 0,
    updated: 0,
    orphaned: 0,
    errors: 0,
  }

  try {
    // Step 1: Scan Git (source of truth)
    const scanner = new BranchScanner(githubToken, repoOwner, repoName)
    const branches = await scanner.discoverBranches('user/*')

    console.log(`[Reconcile] Discovered ${branches.length} branches`)

    const gitSnapshots = await scanner.fetchAllFeatures(branches)
    console.log(`[Reconcile] Fetched ${gitSnapshots.length} feature snapshots`)

    stats.scanned = gitSnapshots.size

    // TODO: Build feature map and sync
    return stats
  } catch (error) {
    console.error('[Reconcile] Error during reconcile:', error)
    throw error
  }
}
```

**Step 2: Verify it compiles**

Run: `cd backend && bun run typecheck`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add backend/src/workers/reconcile.ts
git commit -m "feat: add git scanning to reconcile worker"
```

---

### Task 3: Build Git feature map

**Files:**
- Modify: `backend/src/workers/reconcile.ts`

**Step 1: Add helper function to parse meta.yaml**

Add this function after the imports:

```typescript
/**
 * Parse meta.yaml to extract feature metadata
 */
function parseMetaYaml(content: string): {
  title?: string
  status?: string
  owner?: string
  priority?: string
  progress?: number
} {
  const result: any = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.slice(0, colonIdx).trim()
    let value: any = trimmed.slice(colonIdx + 1).trim()

    // Remove quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    // Parse numbers
    if (!isNaN(Number(value)) && value !== '') {
      value = Number(value)
    }

    result[key] = value
  }

  return result
}
```

**Step 2: Build Git feature map**

Replace the `// TODO: Build feature map and sync` section with:

```typescript
    // Step 2: Build Git feature map (featureId → primary snapshot)
    const gitFeatures = new Map<string, FileSnapshot>()

    for (const snapshot of gitSnapshots) {
      // Use main branch or user/* branches as primary source
      if (snapshot.branch === 'main' || snapshot.branch.startsWith('user/')) {
        // If we already have this feature, keep the one from main (or first user branch)
        if (!gitFeatures.has(snapshot.featureId)) {
          gitFeatures.set(snapshot.featureId, snapshot)
        } else if (snapshot.branch === 'main') {
          // Prefer main branch if it exists
          gitFeatures.set(snapshot.featureId, snapshot)
        }
      }
    }

    stats.scanned = gitFeatures.size
    console.log(`[Reconcile] Mapped ${gitFeatures.size} unique features`)

    // TODO: Get DB features and sync
```

**Step 3: Commit**

```bash
git add backend/src/workers/reconcile.ts
git commit -m "feat: add git feature map building"
```

---

### Task 4: Sync Git features to database

**Files:**
- Modify: `backend/src/workers/reconcile.ts`

**Step 1: Add normalizeStatus helper**

Add this function after `parseMetaYaml`:

```typescript
/**
 * Normalize status to valid enum
 */
function normalizeStatus(status?: string): 'todo' | 'doing' | 'ready-to-ship' | 'shipped' {
  if (status === 'todo' || status === 'doing' || status === 'ready-to-ship' || status === 'shipped') {
    return status
  }
  return 'todo'
}
```

**Step 2: Sync Git features to DB**

Replace `// TODO: Get DB features and sync` with:

```typescript
    // Step 3: Get all DB features for this repo
    const dbFeatures = await getFeatures(repoOwner, repoName)
    const dbFeatureIds = new Set(dbFeatures.map(f => f.id))

    console.log(`[Reconcile] Found ${dbFeatures.length} features in DB`)

    // Step 4: Sync Git → DB (insert/update)
    for (const [featureId, snapshot] of gitFeatures) {
      try {
        const metaParsed = parseMetaYaml(snapshot.files.meta || '')
        const now = Date.now()

        await upsertFeature({
          id: featureId,
          repo_owner: repoOwner,
          repo_name: repoName,
          title: metaParsed.title || featureId,
          status: normalizeStatus(metaParsed.status),
          owner: metaParsed.owner,
          priority: metaParsed.priority,
          progress: metaParsed.progress || 0,
          meta_yaml: snapshot.files.meta || undefined,
          dev_design_md: snapshot.files.design || undefined,
          dev_plan_md: snapshot.files.plan || undefined,
          prd_md: undefined, // TODO: Fetch prd.md if needed
          source: 'git',
          verified: true,
          sync_state: 'synced',
          last_git_checked_at: now,
          last_git_commit_at: now,
          last_sync_error: undefined,
          created_at: now,
          updated_at: now,
          verified_at: now,
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

    console.log(`[Reconcile] Synced: ${stats.inserted} inserted, ${stats.updated} updated`)

    // TODO: Mark orphaned features
```

**Step 3: Commit**

```bash
git add backend/src/workers/reconcile.ts
git commit -m "feat: sync git features to database"
```

---

### Task 5: Mark orphaned features

**Files:**
- Modify: `backend/src/workers/reconcile.ts`

**Step 1: Add orphaned feature detection**

Replace `// TODO: Mark orphaned features` with:

```typescript
    // Step 5: Mark DB-only features as orphaned
    for (const dbFeature of dbFeatures) {
      if (!gitFeatures.has(dbFeature.id)) {
        try {
          await upsertFeature({
            ...dbFeature,
            source: 'agent_orphaned',
            sync_state: 'git_missing',
            verified: false,
            last_sync_error: 'Feature not found in Git during daily reconcile',
            updated_at: Date.now(),
          })
          stats.orphaned++
        } catch (error) {
          console.error(`[Reconcile] Error marking ${dbFeature.id} as orphaned:`, error)
          stats.errors++
        }
      }
    }

    console.log(`[Reconcile] Marked ${stats.orphaned} features as orphaned`)
    console.log(`[Reconcile] Complete:`, stats)

    return stats
  } catch (error) {
    console.error('[Reconcile] Error during reconcile:', error)
    throw error
  }
}
```

**Step 2: Verify it compiles**

Run: `cd backend && bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/workers/reconcile.ts
git commit -m "feat: mark orphaned features in reconcile"
```

---

## Phase 2: Reconcile Cron Endpoint

### Task 6: Create reconcile cron endpoint

**Files:**
- Create: `api/cron/reconcile.ts`

**Step 1: Create endpoint file**

```typescript
// Vercel Cron endpoint for daily reconciliation
// Runs once per day at 3am UTC to sync Git → Database

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { dailyReconcile } from '../../backend/src/workers/reconcile.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ─── Authentication ──────────────────────────────────────────────────

  const cronSecret = req.headers['x-vercel-cron-secret']
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    console.error('[Reconcile Cron] CRON_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  if (cronSecret !== expectedSecret) {
    console.error('[Reconcile Cron] Invalid CRON_SECRET')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // ─── Get Configuration ───────────────────────────────────────────────

  const githubToken = process.env.GITHUB_TOKEN
  const repoOwner = process.env.REPO_OWNER || 'supercrew' // TODO: Make configurable
  const repoName = process.env.REPO_NAME || 'kanban' // TODO: Make configurable

  if (!githubToken) {
    console.error('[Reconcile Cron] GITHUB_TOKEN not configured')
    return res.status(500).json({ error: 'GitHub token not configured' })
  }

  if (!repoOwner || !repoName) {
    console.error('[Reconcile Cron] Repository not configured')
    return res.status(500).json({ error: 'Repository not configured' })
  }

  // ─── Run Reconciliation ──────────────────────────────────────────────

  try {
    console.log(`[Reconcile Cron] Starting reconciliation for ${repoOwner}/${repoName}...`)
    const stats = await dailyReconcile(repoOwner, repoName, githubToken)

    console.log('[Reconcile Cron] Reconciliation complete:', stats)

    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      repository: `${repoOwner}/${repoName}`,
      ...stats,
    })
  } catch (error) {
    console.error('[Reconcile Cron] Reconciliation failed:', error)

    return res.status(500).json({
      error: 'Reconciliation failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
  }
}
```

**Step 2: Commit**

```bash
git add api/cron/reconcile.ts
git commit -m "feat: add daily reconcile cron endpoint"
```

---

### Task 7: Update vercel.json with cron schedule

**Files:**
- Modify: `vercel.json`

**Step 1: Read current vercel.json**

Run: `cat vercel.json` to see existing cron configuration

**Step 2: Add reconcile cron job**

Add new cron entry to the `crons` array:

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

**Step 3: Verify JSON is valid**

Run: `cat vercel.json | jq .`
Expected: Formatted JSON output with no errors

**Step 4: Commit**

```bash
git add vercel.json
git commit -m "feat: add daily reconcile cron job at 3am UTC"
```

---

## Phase 3: Source Field Enhancement

### Task 8: Add agent_verified source state

**Files:**
- Modify: `backend/src/services/database.ts`

**Step 1: Update FeatureData type**

Find the `source` field in `FeatureData` interface and update it:

```typescript
export interface FeatureData {
  // ... other fields ...
  source: 'git' | 'agent' | 'agent_verified' | 'agent_stale' | 'agent_orphaned'
  // ... other fields ...
}
```

**Step 2: Verify it compiles**

Run: `cd backend && bun run typecheck`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add backend/src/services/database.ts
git commit -m "feat: add agent_verified source state"
```

---

### Task 9: Update ValidationService to use agent_verified

**Files:**
- Modify: `backend/src/services/validation.ts`

**Step 1: Update resolveConflict to set agent_verified**

Find the `resolveConflict` method, specifically the case where content is identical. Update it:

```typescript
  async resolveConflict(
    comparison: ComparisonResult,
    gitData: GitFileSnapshot,
    dbData: FeatureData,
    repoOwner: string,
    repoName: string,
    featureId: string
  ): Promise<ValidationResult> {
    // Case 1: Content is identical -> mark as agent_verified
    if (comparison.identical) {
      // Determine source: If current source is 'agent', upgrade to 'agent_verified'
      const newSource = dbData.source === 'agent' ? 'agent_verified' : dbData.source

      await upsertFeature({
        ...dbData,
        source: newSource,
        verified: true,
        sync_state: 'synced',
        git_sha: gitData.sha,
        git_etag: gitData.etag,
        last_git_checked_at: Date.now(),
        verified_at: Date.now(),
      })

      return {
        feature_id: featureId,
        success: true,
        action: 'verified',
      }
    }

    // ... rest of the function unchanged
  }
```

**Step 2: Verify it compiles**

Run: `cd backend && bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/services/validation.ts
git commit -m "feat: set agent_verified when agent matches git"
```

---

## Phase 4: Deployment & Testing

### Task 10: Deploy to Vercel

**Files:**
- None (deployment)

**Step 1: Push to main branch**

```bash
git push origin main
```

Expected: Vercel automatically deploys

**Step 2: Wait for deployment**

Monitor: Vercel dashboard or GitHub Actions
Expected: Deployment succeeds

**Step 3: Verify cron jobs are registered**

Check: Vercel dashboard → Project → Cron Jobs
Expected: Both /api/cron/validate and /api/cron/reconcile listed

---

### Task 11: Manual reconcile test

**Files:**
- None (manual testing)

**Step 1: Trigger reconcile manually**

Run curl with CRON_SECRET:

```bash
curl -X GET 'https://your-app.vercel.app/api/cron/reconcile' \
  -H 'x-vercel-cron-secret: YOUR_CRON_SECRET'
```

Expected: HTTP 200 with stats JSON:
```json
{
  "ok": true,
  "timestamp": "2026-03-08T...",
  "repository": "owner/repo",
  "scanned": 8,
  "inserted": 0,
  "updated": 8,
  "orphaned": 0,
  "errors": 0
}
```

**Step 2: Verify database was updated**

Check: Database directly or via frontend
Expected: All features have `source='git'`, `verified=true`

---

### Task 12: Agent verification test

**Files:**
- None (manual testing)

**Step 1: Create a test feature via agent API**

```bash
curl -X POST 'https://your-app.vercel.app/api/features/report' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "repo_owner": "owner",
    "repo_name": "repo",
    "feature_id": "test-feature",
    "data": {
      "status": "doing",
      "meta_yaml": "id: test-feature\ntitle: Test Feature\nstatus: doing"
    }
  }'
```

Expected: HTTP 200, feature added with `source='agent'`, `verified=false`

**Step 2: Push corresponding feature to Git**

Create `.supercrew/tasks/test-feature/meta.yaml` in Git with same content, push to main

**Step 3: Wait for validation (1 min)**

Expected: Validation worker detects match, sets `source='agent_verified'`, `verified=true`

**Step 4: Verify in database**

Check: Frontend or database query
Expected: Feature has `source='agent_verified'`, `verified=true`, `sync_state='synced'`

---

### Task 13: Orphaned feature test

**Files:**
- None (manual testing)

**Step 1: Create a feature via agent API (don't push to Git)**

```bash
curl -X POST 'https://your-app.vercel.app/api/features/report' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "repo_owner": "owner",
    "repo_name": "repo",
    "feature_id": "orphan-test",
    "data": {
      "status": "doing",
      "meta_yaml": "id: orphan-test\ntitle: Orphan Test\nstatus: doing"
    }
  }'
```

**Step 2: Wait past grace window (10+ min)**

Expected: Validation marks as `source='agent_orphaned'`, `sync_state='git_missing'`

**Step 3: Run daily reconcile**

Trigger reconcile endpoint manually

Expected: Feature remains `source='agent_orphaned'`

**Step 4: Verify frontend shows orphaned badge**

Check: Frontend UI
Expected: "🔍 Orphaned" badge displayed

---

## Phase 5: Documentation

### Task 14: Update README with reconcile info

**Files:**
- Modify: `README.md`

**Step 1: Add reconcile section**

Add to the architecture section:

```markdown
### Daily Reconciliation

The system runs a daily reconcile job at 3:00 AM UTC that:
- Scans all Git branches using BranchScanner
- Syncs all features from Git to database
- Marks features as `source='git'` and `verified=true`
- Detects orphaned features (in DB but not in Git)

This ensures the database stays in sync with Git source of truth.
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add daily reconcile documentation"
```

---

### Task 15: Create troubleshooting guide

**Files:**
- Create: `docs/troubleshooting.md`

**Step 1: Create troubleshooting document**

```markdown
# Troubleshooting Git-DB Sync

## Reconcile Job Failed

**Symptom:** Daily reconcile cron returns 500 error

**Check:**
1. Vercel logs for error details
2. GITHUB_TOKEN is valid and has repo access
3. CRON_SECRET matches header

**Fix:**
- Refresh GITHUB_TOKEN if expired
- Check GitHub API rate limits
- Verify repository permissions

## Features Stuck in Pending

**Symptom:** Features show "⏳ Pending" badge for > 10 minutes

**Check:**
1. Validation queue size (should be < 100)
2. Validation worker logs for errors
3. GitHub API availability

**Fix:**
- Manually trigger validation cron
- Check if Git has the feature
- Verify feature content matches

## High Orphaned Count

**Symptom:** > 10% of features are orphaned

**Check:**
1. Were features deleted from Git?
2. Is agent pushing to correct repository?
3. Check grace window behavior

**Fix:**
- Run reconcile to confirm orphan status
- Investigate why features not in Git
- Consider increasing grace window if agents are slow
```

**Step 2: Commit**

```bash
git add docs/troubleshooting.md
git commit -m "docs: add troubleshooting guide"
```

---

## Success Criteria Checklist

After completing all tasks, verify:

- [ ] Daily reconcile runs at 3am UTC (check Vercel cron logs)
- [ ] Reconcile scans Git and syncs to database (check stats response)
- [ ] Agent-reported features show ⚡ Realtime badge
- [ ] Validation marks matching agent data as agent_verified
- [ ] Orphaned features detected and marked after grace window
- [ ] Frontend displays correct freshness badges
- [ ] No data loss (Git always preserved as source of truth)
- [ ] README updated with reconcile documentation
- [ ] Troubleshooting guide created

---

## Rollback Plan

If issues occur after deployment:

1. **Disable reconcile cron**: Remove from vercel.json, redeploy
2. **Revert validation changes**: Restore source='git' logic
3. **Monitor database**: Check for data corruption
4. **Fallback to Git mode**: Frontend switches to fetchBoardMultiBranch()

Git always remains source of truth, so database can be rebuilt from Git if needed.
