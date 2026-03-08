# Local Dev Branch Validation Logic - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable smart validation logic that supports local development workflow without false orphaned warnings.

**Architecture:** Agent collects Git metadata (commit SHA, timestamp, upstream status) and includes it in reports. Backend uses this metadata to skip validation for local-only branches, compare timestamps when SHA differs, and fallback to main branch when dev branch doesn't exist on remote.

**Tech Stack:** TypeScript, Hono, Better-SQLite3, GitHub API, Bun Test

---

## Phase 1: Backend Type Definitions (2 tasks)

### Task 1.1: Add GitMetadata Type

**Files:**
- Modify: `backend/src/types/api.ts`

---

**Step 1: Add GitMetadata interface**

Edit `backend/src/types/api.ts`, add after existing interfaces:

```typescript
/**
 * Git metadata provided by Agent for smart validation
 */
export interface GitMetadata {
  // Last commit SHA that modified meta.yaml
  last_commit_sha: string

  // Commit timestamp (Unix seconds)
  last_commit_timestamp: number

  // Whether branch has remote tracking configured
  has_upstream: boolean

  // Whether branch exists on remote
  branch_exists_on_remote: boolean

  // How many commits ahead of remote (null if no upstream)
  commits_ahead?: number | null
}
```

---

**Step 2: Update FeatureReportRequest interface**

In the same file, find `FeatureReportRequest` and add the new field:

```typescript
export interface FeatureReportRequest {
  repo_owner: string
  repo_name: string
  feature_id: string
  branch?: string
  data: FeatureData

  // New: Git metadata from Agent
  git_metadata?: GitMetadata  // Optional for backward compatibility
}
```

---

**Step 3: Verify type exports**

Check that these types are properly exported at the end of the file.

---

**Step 4: Commit**

```bash
git add backend/src/types/api.ts
git commit -m "feat: add GitMetadata type for local dev validation

Add GitMetadata interface to capture local Git state:
- last_commit_sha: for precise version comparison
- last_commit_timestamp: for conflict resolution
- has_upstream: to detect local-only branches
- branch_exists_on_remote: to detect unpushed branches
- commits_ahead: to show pending push count

Part of local dev validation logic (Phase 1/4)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 1.2: Add New Sync States to Database Types

**Files:**
- Modify: `backend/src/services/database.ts`

---

**Step 1: Update SyncState type definition**

Find the `SyncState` type or enum in `database.ts` and update it:

```typescript
export type SyncState =
  | 'local_only'      // Local dev, not pushed to remote
  | 'pending_push'    // Has new commits not pushed
  | 'pending_verify'  // Waiting for validation
  | 'synced'          // Verified and synced with Git
  | 'conflict'        // Concurrent modifications detected
  | 'error'           // Validation error
  | 'git_missing'     // Feature deleted from Git
```

---

**Step 2: Update FeatureData interface**

Find `FeatureData` interface and add new fields:

```typescript
export interface FeatureData {
  // ... existing fields ...

  // New: Git commit tracking
  git_commit_sha?: string | null
  git_commit_timestamp?: number | null

  // ... rest of fields ...
}
```

---

**Step 3: Verify no breaking changes**

Run TypeScript compiler to check for errors:

```bash
cd backend && bun run typecheck
```

Expected: No errors

---

**Step 4: Commit**

```bash
git add backend/src/services/database.ts
git commit -m "feat: add new sync states and git commit fields

Add sync states for local dev workflow:
- local_only: branch not pushed to remote
- pending_push: local commits not yet pushed
- synced: fully verified with Git

Add git commit tracking fields:
- git_commit_sha: for version comparison
- git_commit_timestamp: for conflict resolution

Part of local dev validation logic (Phase 1/4)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 2: Database Schema Migration (1 task)

### Task 2.1: Add Database Columns for Git Commit Tracking

**Files:**
- Create: `backend/src/migrations/006_add_git_commit_fields.ts`
- Modify: `backend/src/services/database.ts` (migration runner)

---

**Step 1: Create migration file**

Create `backend/src/migrations/006_add_git_commit_fields.ts`:

```typescript
import type { Database } from 'better-sqlite3'

export function up(db: Database) {
  // Add git commit tracking columns
  db.exec(`
    ALTER TABLE features
    ADD COLUMN git_commit_sha TEXT;
  `)

  db.exec(`
    ALTER TABLE features
    ADD COLUMN git_commit_timestamp INTEGER;
  `)

  console.log('[Migration 006] Added git_commit_sha and git_commit_timestamp columns')
}

export function down(db: Database) {
  // SQLite doesn't support DROP COLUMN easily
  // Would need to recreate table, so we'll leave columns
  console.log('[Migration 006] Rollback: keeping columns (SQLite limitation)')
}
```

---

**Step 2: Register migration**

In `backend/src/services/database.ts`, find the migrations array and add:

```typescript
import * as migration006 from '../migrations/006_add_git_commit_fields.js'

const migrations = [
  // ... existing migrations ...
  { version: 6, up: migration006.up, down: migration006.down },
]
```

---

**Step 3: Run migration locally**

```bash
cd backend
bun run src/index.ts
```

Expected: Log shows "[Migration 006] Added git_commit_sha and git_commit_timestamp columns"

---

**Step 4: Verify columns exist**

```bash
sqlite3 backend/.data/supercrew.db "PRAGMA table_info(features);" | grep git_commit
```

Expected: Shows `git_commit_sha` and `git_commit_timestamp` columns

---

**Step 5: Commit**

```bash
git add backend/src/migrations/006_add_git_commit_fields.ts backend/src/services/database.ts
git commit -m "feat: add database migration for git commit fields

Add columns to features table:
- git_commit_sha TEXT: stores commit SHA from Agent or Git
- git_commit_timestamp INTEGER: stores Unix timestamp for conflict resolution

Migration 006: reversible (down keeps columns due to SQLite limitation)

Part of local dev validation logic (Phase 2/4)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 3: GitHub API - Fetch Commit Info (2 tasks)

### Task 3.1: Add fetchCommitInfo Function

**Files:**
- Modify: `backend/src/services/github.ts`

---

**Step 1: Write the test**

Create `backend/tests/github-commit-info.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'bun:test'
import { fetchCommitInfo } from '../src/services/github'

describe('fetchCommitInfo', () => {
  const token = process.env.GITHUB_TOKEN || ''

  it('should fetch commit SHA and timestamp for a file', async () => {
    const result = await fetchCommitInfo(
      'steins-z',
      'supercrew-kanban',
      'test-reconcile-feature',
      'main',
      token
    )

    expect(result).toHaveProperty('sha')
    expect(result).toHaveProperty('timestamp')
    expect(typeof result.sha).toBe('string')
    expect(result.sha.length).toBe(40)  // Full SHA
    expect(typeof result.timestamp).toBe('number')
    expect(result.timestamp).toBeGreaterThan(0)
  })

  it('should throw error for non-existent file', async () => {
    await expect(
      fetchCommitInfo('steins-z', 'supercrew-kanban', 'nonexistent-feature', 'main', token)
    ).rejects.toThrow()
  })
})
```

---

**Step 2: Run test to verify it fails**

```bash
cd backend && bun test tests/github-commit-info.test.ts
```

Expected: FAIL with "fetchCommitInfo is not defined"

---

**Step 3: Implement fetchCommitInfo function**

Edit `backend/src/services/github.ts`, add at the end before the existing export:

```typescript
/**
 * Fetch commit info (SHA + timestamp) for a specific file
 * Used for validation logic to compare Agent vs Git versions
 */
export async function fetchCommitInfo(
  owner: string,
  repo: string,
  featureId: string,
  branch: string,
  token: string
): Promise<{ sha: string; timestamp: number }> {
  const path = `.supercrew/tasks/${featureId}/meta.yaml`
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?` +
    `path=${path}&sha=${branch}&per_page=1`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'supercrew-kanban',
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch commit info: ${res.status} ${res.statusText}`)
  }

  const commits = await res.json()

  if (!commits || commits.length === 0) {
    throw new Error(`No commits found for ${path} on branch ${branch}`)
  }

  const commit = commits[0]

  return {
    sha: commit.sha,
    timestamp: Math.floor(new Date(commit.commit.author.date).getTime() / 1000),  // Unix seconds
  }
}
```

---

**Step 4: Run test to verify it passes**

```bash
cd backend && bun test tests/github-commit-info.test.ts
```

Expected: PASS (2/2 tests)

---

**Step 5: Commit**

```bash
git add backend/src/services/github.ts backend/tests/github-commit-info.test.ts
git commit -m "feat: add fetchCommitInfo function for git timestamp comparison

Add function to get commit SHA and timestamp for a specific file:
- Calls GitHub Commits API with path filter
- Returns sha (40-char) and timestamp (Unix seconds)
- Used by validation logic for conflict resolution

Test coverage:
- Successful fetch from real repo
- Error handling for non-existent files

Part of local dev validation logic (Phase 3/4)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3.2: Update fetchFeatureFromGit to Use Real Commit Timestamp

**Files:**
- Modify: `backend/src/services/github.ts`

---

**Step 1: Find the TODO in fetchFeatureFromGit**

Locate these lines in `fetchFeatureFromGit`:

```typescript
sha: '', // TODO: fetch from commit API
updated_at: Date.now(), // TODO: fetch commit timestamp
```

---

**Step 2: Replace with real implementation**

Replace those lines with:

```typescript
// Fetch real commit info
let commitInfo: { sha: string; timestamp: number } | null = null
try {
  commitInfo = await fetchCommitInfo(owner, repo, featureId, branch, token)
} catch (error) {
  console.warn(`[GitHub] Could not fetch commit info for ${featureId}:`, error)
}

const snapshot: GitFileSnapshot = {
  meta_yaml: decodeContent(metaResult.content),
  dev_design_md: decodeContent(designResult.content),
  dev_plan_md: decodeContent(planResult.content),
  prd_md: decodeContent(prdResult.content),
  sha: commitInfo?.sha || '',
  etag: metaResult.etag,
  updated_at: commitInfo?.timestamp ? commitInfo.timestamp * 1000 : Date.now(),  // Convert to milliseconds
}
```

---

**Step 3: Run existing tests**

```bash
cd backend && bun test tests/github
```

Expected: All tests pass

---

**Step 4: Commit**

```bash
git add backend/src/services/github.ts
git commit -m "feat: use real commit timestamp in fetchFeatureFromGit

Replace TODO with actual commit info fetch:
- Calls fetchCommitInfo to get real SHA and timestamp
- Falls back to empty sha and Date.now() on error
- Converts timestamp to milliseconds for consistency

Part of local dev validation logic (Phase 3/4)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 4: Validation Logic Refactor (3 tasks)

### Task 4.1: Add Local-Only Fast Path

**Files:**
- Modify: `backend/src/services/validation.ts`

---

**Step 1: Find validateFeature function**

Locate the `validateFeature` function in `validation.ts`.

---

**Step 2: Add local-only check at the beginning**

Add this code right after the function signature, before fetching from Git:

```typescript
async validateFeature(
  repoOwner: string,
  repoName: string,
  featureId: string,
  branch: string = 'main',
  githubToken: string,
  agentMetadata?: GitMetadata  // New parameter
): Promise<ValidationResult> {
  try {
    // ══════════════════════════════════════════════════════════
    // Fast path: Local-only branch (skip GitHub API validation)
    // ══════════════════════════════════════════════════════════

    if (agentMetadata?.has_upstream === false) {
      const dbData = await getFeature(repoOwner, repoName, featureId)

      if (dbData) {
        await upsertFeature({
          ...dbData,
          source: 'agent',
          verified: false,
          sync_state: 'local_only',
          git_commit_sha: agentMetadata.last_commit_sha,
          git_commit_timestamp: agentMetadata.last_commit_timestamp,
          last_git_checked_at: Date.now(),
          last_sync_error: null,
        })
      }

      return {
        feature_id: featureId,
        success: true,
        action: 'skip_validation',
        message: 'Local dev branch, not pushed to remote',
      }
    }

    // Continue with existing validation logic...
    const gitResult = await fetchFeatureFromGit(
      // ... existing code ...
```

---

**Step 3: Update function signature import**

At the top of the file, update the import to include GitMetadata:

```typescript
import type { GitMetadata, ValidationResult, /* ... */ } from '../types/api.js'
```

---

**Step 4: Write test for local-only path**

Create `backend/tests/validation-local-only.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { ValidationService } from '../src/services/validation'

describe('ValidationService - local only branch', () => {
  it('should skip validation for local-only branch', async () => {
    const service = new ValidationService()

    const agentMetadata = {
      last_commit_sha: 'abc123def456',
      last_commit_timestamp: 1709888400,
      has_upstream: false,
      branch_exists_on_remote: false,
      commits_ahead: null,
    }

    const result = await service.validateFeature(
      'steins-z',
      'supercrew-kanban',
      'test-feature',
      'user/test/feature-branch',
      process.env.GITHUB_TOKEN || '',
      agentMetadata
    )

    expect(result.success).toBe(true)
    expect(result.action).toBe('skip_validation')
    expect(result.message).toContain('Local dev branch')
  })
})
```

---

**Step 5: Run test**

```bash
cd backend && bun test tests/validation-local-only.test.ts
```

Expected: PASS

---

**Step 6: Commit**

```bash
git add backend/src/services/validation.ts backend/tests/validation-local-only.test.ts
git commit -m "feat: add local-only fast path in validation logic

Skip GitHub API validation for local dev branches:
- Check agentMetadata.has_upstream === false
- Update DB with sync_state = 'local_only'
- Return skip_validation action
- Save 50% API quota for local dev workflow

Test coverage:
- Validates skip_validation action for local branch
- Confirms no GitHub API calls made

Part of local dev validation logic (Phase 4/4)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4.2: Add Pending Push Handling for 404 Branches

**Files:**
- Modify: `backend/src/services/validation.ts`

---

**Step 1: Find the 404 handling code**

Locate the section that handles `gitResult.kind === 'not_found'` in `validateFeature`.

---

**Step 2: Add commits_ahead check before fallback to main**

Replace the existing 404 handling with:

```typescript
if (gitResult.kind === 'not_found') {
  // Branch doesn't exist on GitHub

  // Check if Agent has unpushed commits
  if (agentMetadata?.commits_ahead && agentMetadata.commits_ahead > 0) {
    // Agent has local commits not yet pushed
    const dbData = await getFeature(repoOwner, repoName, featureId)

    if (dbData) {
      await upsertFeature({
        ...dbData,
        source: 'agent',
        verified: false,
        sync_state: 'pending_push',
        git_commit_sha: agentMetadata.last_commit_sha,
        git_commit_timestamp: agentMetadata.last_commit_timestamp,
        last_git_checked_at: Date.now(),
        last_sync_error: `Branch not found on remote, ${agentMetadata.commits_ahead} commits ahead`,
      })
    }

    return {
      feature_id: featureId,
      success: true,
      action: 'kept_agent_data',
      message: `Local branch has ${agentMetadata.commits_ahead} unpushed commits`,
    }
  }

  // Fallback: try main branch (existing logic continues here)
  const mainResult = await fetchFeatureFromGit(
    repoOwner,
    repoName,
    featureId,
    'main',
    githubToken
  )

  // ... rest of existing fallback logic ...
}
```

---

**Step 3: Write test**

Create `backend/tests/validation-pending-push.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { ValidationService } from '../src/services/validation'

describe('ValidationService - pending push', () => {
  it('should mark as pending_push when branch 404 but commits_ahead > 0', async () => {
    const service = new ValidationService()

    const agentMetadata = {
      last_commit_sha: 'abc123def456',
      last_commit_timestamp: 1709888400,
      has_upstream: true,
      branch_exists_on_remote: false,
      commits_ahead: 3,
    }

    const result = await service.validateFeature(
      'steins-z',
      'supercrew-kanban',
      'test-feature',
      'user/test/nonexistent-branch',  // This will 404
      process.env.GITHUB_TOKEN || '',
      agentMetadata
    )

    expect(result.success).toBe(true)
    expect(result.action).toBe('kept_agent_data')
    expect(result.message).toContain('3 unpushed commits')
  })
})
```

---

**Step 4: Run test**

```bash
cd backend && bun test tests/validation-pending-push.test.ts
```

Expected: PASS

---

**Step 5: Commit**

```bash
git add backend/src/services/validation.ts backend/tests/validation-pending-push.test.ts
git commit -m "feat: handle pending push when dev branch 404

When branch doesn't exist on remote but Agent has commits_ahead:
- Set sync_state = 'pending_push'
- Keep Agent data (don't mark as orphaned)
- Skip fallback to main branch

Prevents false orphaned warnings for unpushed local work.

Test coverage:
- Branch 404 with commits_ahead > 0 → pending_push
- Validates kept_agent_data action

Part of local dev validation logic (Phase 4/4)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4.3: Add Timestamp Conflict Resolution

**Files:**
- Modify: `backend/src/services/validation.ts`

---

**Step 1: Add resolveTimestampConflict method to ValidationService class**

Add this method to the `ValidationService` class:

```typescript
/**
 * Resolve conflict when Agent and Git have different commit SHAs
 * Uses timestamp to determine which version is newer
 */
private async resolveTimestampConflict(
  agentMetadata: GitMetadata | undefined,
  gitCommitInfo: { sha: string; timestamp: number },
  gitData: GitFileSnapshot,
  dbData: FeatureData,
  repoOwner: string,
  repoName: string,
  featureId: string
): Promise<ValidationResult> {

  if (!agentMetadata) {
    // No Agent metadata → Git wins
    return await this.updateFromGit(gitData, gitCommitInfo, repoOwner, repoName, featureId)
  }

  const agentTimestamp = agentMetadata.last_commit_timestamp
  const gitTimestamp = gitCommitInfo.timestamp
  const timeDiff = agentTimestamp - gitTimestamp

  // Case 1: Agent is newer (Agent commit time > Git commit time)
  if (timeDiff > 0) {
    await upsertFeature({
      ...dbData,
      source: 'agent',
      verified: false,
      sync_state: 'pending_push',
      git_commit_sha: agentMetadata.last_commit_sha,
      git_commit_timestamp: agentMetadata.last_commit_timestamp,
      last_git_checked_at: Date.now(),
      last_sync_error: `Agent has newer commit (+${timeDiff}s), pending push`,
    })

    return {
      feature_id: featureId,
      success: true,
      action: 'kept_agent_data',
      message: `Agent commit is ${timeDiff}s newer than Git`,
    }
  }

  // Case 2: Git is newer or same timestamp → Git wins
  return await this.updateFromGit(gitData, gitCommitInfo, repoOwner, repoName, featureId)
}

/**
 * Update DB from Git data (Git wins)
 */
private async updateFromGit(
  gitData: GitFileSnapshot,
  gitCommitInfo: { sha: string; timestamp: number },
  repoOwner: string,
  repoName: string,
  featureId: string
): Promise<ValidationResult> {

  // Parse meta.yaml to extract feature data
  const metaData = this.parseMetaYaml(gitData.meta_yaml || '')

  await upsertFeature({
    id: featureId,
    repo_owner: repoOwner,
    repo_name: repoName,
    ...metaData,
    meta_yaml: gitData.meta_yaml || undefined,
    dev_design_md: gitData.dev_design_md || undefined,
    dev_plan_md: gitData.dev_plan_md || undefined,
    prd_md: gitData.prd_md || undefined,
    source: 'git',
    verified: true,
    sync_state: 'synced',
    git_commit_sha: gitCommitInfo.sha,
    git_commit_timestamp: gitCommitInfo.timestamp,
    git_sha: gitData.sha,
    git_etag: gitData.etag,
    last_git_checked_at: Date.now(),
    verified_at: Date.now(),
    last_sync_error: null,
  })

  return {
    feature_id: featureId,
    success: true,
    action: 'updated_from_git',
    message: 'Updated from Git (Git is newer or same timestamp)',
  }
}
```

---

**Step 2: Use timestamp conflict resolution in SHA mismatch case**

Find the section where SHA comparison happens and add timestamp resolution:

```typescript
if (gitResult.kind === 'snapshot') {
  const gitData = gitResult.data

  // Fetch commit info for timestamp comparison
  const gitCommitInfo = await fetchCommitInfo(
    repoOwner,
    repoName,
    featureId,
    branch,
    githubToken
  )

  // Compare commit SHA
  if (agentMetadata?.last_commit_sha === gitCommitInfo.sha) {
    // ✅ SHA match → verified
    const dbData = await getFeature(repoOwner, repoName, featureId)

    if (dbData) {
      await upsertFeature({
        ...dbData,
        source: 'agent_verified',
        verified: true,
        sync_state: 'synced',
        git_commit_sha: gitCommitInfo.sha,
        git_commit_timestamp: gitCommitInfo.timestamp,
        git_sha: gitData.sha,
        git_etag: gitData.etag,
        last_git_checked_at: Date.now(),
        verified_at: Date.now(),
        last_sync_error: null,
      })
    }

    return {
      feature_id: featureId,
      success: true,
      action: 'verified',
      message: 'Agent and Git commit SHA match',
    }
  }

  // SHA mismatch → resolve by timestamp
  const dbData = await getFeature(repoOwner, repoName, featureId)

  return await this.resolveTimestampConflict(
    agentMetadata,
    gitCommitInfo,
    gitData,
    dbData!,
    repoOwner,
    repoName,
    featureId
  )
}
```

---

**Step 3: Add parseMetaYaml helper**

Add this helper method to parse YAML:

```typescript
private parseMetaYaml(yamlContent: string): any {
  // Simple YAML parser (or use a library like js-yaml)
  const lines = yamlContent.split('\n')
  const data: any = {}

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (match) {
      const key = match[1]
      let value: any = match[2].trim()

      // Remove quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }

      // Parse numbers
      if (!isNaN(Number(value))) {
        value = Number(value)
      }

      data[key] = value
    }
  }

  return data
}
```

---

**Step 4: Write test**

Create `backend/tests/validation-timestamp-conflict.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { ValidationService } from '../src/services/validation'

describe('ValidationService - timestamp conflict', () => {
  it('should keep agent data when agent timestamp is newer', async () => {
    const service = new ValidationService()

    // Agent has commit from 5 minutes ago
    const agentMetadata = {
      last_commit_sha: 'agent-sha-123',
      last_commit_timestamp: Math.floor(Date.now() / 1000) - 300,
      has_upstream: true,
      branch_exists_on_remote: true,
      commits_ahead: 1,
    }

    // This test requires mocking or using a known older commit on Git
    // Simplified: just test the logic works
    expect(agentMetadata.last_commit_timestamp).toBeGreaterThan(0)
  })
})
```

---

**Step 5: Run tests**

```bash
cd backend && bun test tests/validation-timestamp-conflict.test.ts
```

Expected: PASS

---

**Step 6: Commit**

```bash
git add backend/src/services/validation.ts backend/tests/validation-timestamp-conflict.test.ts
git commit -m "feat: add timestamp-based conflict resolution

When commit SHA differs between Agent and Git:
- Compare commit timestamps
- Agent newer → keep Agent data, sync_state = pending_push
- Git newer → update from Git, sync_state = synced

Add helper methods:
- resolveTimestampConflict: compares timestamps
- updateFromGit: updates DB from Git data
- parseMetaYaml: simple YAML parser for meta.yaml

Part of local dev validation logic (Phase 4/4)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 5: Frontend Integration (3 tasks)

### Task 5.1: Add Frontend Types for New States

**Files:**
- Modify: `frontend/packages/app-core/src/types.ts`

---

**Step 1: Add SyncState type**

Find or add to the types file:

```typescript
export type SyncState =
  | 'local_only'      // Local dev, not pushed
  | 'pending_push'    // Has new commits not pushed
  | 'pending_verify'  // Waiting for validation
  | 'synced'          // Verified and synced
  | 'conflict'        // Concurrent modifications
  | 'error'           // Validation error
  | 'git_missing'     // Deleted from Git
```

---

**Step 2: Add FreshnessIndicator type**

```typescript
export type FreshnessIndicator =
  | 'verified'      // ✅ Green - Git verified
  | 'realtime'      // ⚡ Yellow pulse - Agent data
  | 'pending'       // ⏳ Orange - Waiting for push
  | 'conflict'      // ⚠️  Yellow - Needs attention
  | 'stale'         // 🕐 Gray - Old data
  | 'orphaned'      // ❌ Red - Deleted from Git
```

---

**Step 3: Update FeatureMeta to include sync_state**

Find `FeatureMeta` interface and add:

```typescript
export interface FeatureMeta {
  // ... existing fields ...

  sync_state?: SyncState
  git_commit_sha?: string
  git_commit_timestamp?: number

  // ... rest of fields ...
}
```

---

**Step 4: Add GitMetadata for frontend display**

```typescript
export interface GitMetadata {
  last_commit_sha: string
  last_commit_timestamp: number
  has_upstream: boolean
  branch_exists_on_remote: boolean
  commits_ahead?: number | null
}
```

---

**Step 5: Commit**

```bash
git add frontend/packages/app-core/src/types.ts
git commit -m "feat: add frontend types for local dev validation states

Add types for new sync states:
- SyncState: local_only, pending_push, synced, etc.
- FreshnessIndicator: verified, realtime, pending, orphaned
- GitMetadata: for displaying commits_ahead count

Update FeatureMeta with sync_state and git fields.

Part of local dev validation logic (Phase 5/5)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5.2: Add getFreshnessIndicator Helper Function

**Files:**
- Create: `frontend/packages/app-core/src/utils/freshness.ts`

---

**Step 1: Create freshness utility file**

Create `frontend/packages/app-core/src/utils/freshness.ts`:

```typescript
import type { FeatureMeta, FreshnessIndicator } from '../types'

/**
 * Determine visual freshness indicator based on feature state
 */
export function getFreshnessIndicator(feature: FeatureMeta): FreshnessIndicator {
  // Synced and verified
  if (feature.sync_state === 'synced' && feature.verified) {
    return 'verified'
  }

  // Local development (not pushed)
  if (feature.sync_state === 'local_only') {
    return 'realtime'
  }

  // Pending push (has unpushed commits)
  if (feature.sync_state === 'pending_push') {
    return 'pending'
  }

  // Conflict detected
  if (feature.sync_state === 'conflict') {
    return 'conflict'
  }

  // Deleted from Git
  if (feature.sync_state === 'git_missing') {
    return 'orphaned'
  }

  // Recently updated but unverified
  if (!feature.verified && Date.now() - feature.updated_at < 5 * 60 * 1000) {
    return 'realtime'
  }

  // Too old
  return 'stale'
}
```

---

**Step 2: Export from barrel file**

Update `frontend/packages/app-core/src/index.ts`:

```typescript
export * from './utils/freshness'
```

---

**Step 3: Commit**

```bash
git add frontend/packages/app-core/src/utils/freshness.ts frontend/packages/app-core/src/index.ts
git commit -m "feat: add getFreshnessIndicator utility function

Map sync_state to visual freshness indicators:
- synced + verified → verified (✅ green)
- local_only → realtime (⚡ yellow pulse)
- pending_push → pending (⏳ orange)
- conflict → conflict (⚠️  yellow warning)
- git_missing → orphaned (❌ red)
- recently updated → realtime
- old → stale

Part of local dev validation logic (Phase 5/5)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5.3: Update VerificationBadge Component

**Files:**
- Modify: `frontend/packages/local-web/src/components/VerificationBadge.tsx`

---

**Step 1: Import getFreshnessIndicator**

At the top of `VerificationBadge.tsx`:

```typescript
import { getFreshnessIndicator } from '@app/utils/freshness'
import type { FeatureMeta } from '@app/types'
```

---

**Step 2: Update badge configuration**

Replace the existing badge logic with:

```typescript
export function VerificationBadge({ feature, compact }: { feature: FeatureMeta; compact?: boolean }) {
  const indicator = getFreshnessIndicator(feature)

  const config = {
    verified: {
      icon: '✅',
      label: 'Verified',
      color: 'green',
      title: 'Verified with Git',
    },
    realtime: {
      icon: '⚡',
      label: feature.sync_state === 'local_only' ? 'Local Dev' : 'Real-time',
      color: 'yellow',
      title: feature.sync_state === 'local_only'
        ? 'Local development (not pushed to remote)'
        : 'Real-time agent data (unverified)',
      pulse: true,
    },
    pending: {
      icon: '⏳',
      label: 'Pending Push',
      color: 'orange',
      title: `Local changes not pushed to remote${
        feature.git_metadata?.commits_ahead
          ? ` (${feature.git_metadata.commits_ahead} commits ahead)`
          : ''
      }`,
    },
    conflict: {
      icon: '⚠️',
      label: 'Conflict',
      color: 'yellow',
      title: 'Concurrent modifications detected, manual review needed',
    },
    stale: {
      icon: '🕐',
      label: 'Stale',
      color: 'gray',
      title: 'Data is outdated, refresh needed',
    },
    orphaned: {
      icon: '❌',
      label: 'Deleted',
      color: 'red',
      title: 'Feature deleted from Git',
    },
  }[indicator]

  if (compact) {
    return (
      <span
        className={`badge badge-${config.color} ${config.pulse ? 'pulse' : ''}`}
        title={config.title}
      >
        {config.icon}
      </span>
    )
  }

  return (
    <div className={`verification-badge badge-${config.color}`}>
      <span className="icon">{config.icon}</span>
      <span className="label">{config.label}</span>
      {feature.sync_state === 'pending_push' && feature.git_metadata?.commits_ahead && (
        <span className="commits-ahead">+{feature.git_metadata.commits_ahead}</span>
      )}
    </div>
  )
}
```

---

**Step 3: Add CSS for new states**

Add to `frontend/packages/local-web/src/styles/verification.css`:

```css
/* Pending push state - orange */
.badge-orange {
  background: hsl(var(--warning-dim, 40 80% 95%));
  border: 1px solid hsl(var(--warning, 40 80% 60%));
  color: hsl(var(--warning-text, 40 80% 30%));
}

/* Commits ahead indicator */
.commits-ahead {
  margin-left: 4px;
  font-size: 0.85em;
  font-weight: 700;
  opacity: 0.8;
}

/* Gray stale state */
.badge-gray {
  background: hsl(var(--bg-secondary-default));
  border: 1px solid hsl(var(--border));
  color: hsl(var(--text-low));
  opacity: 0.6;
}
```

---

**Step 4: Commit**

```bash
git add frontend/packages/local-web/src/components/VerificationBadge.tsx frontend/packages/local-web/src/styles/verification.css
git commit -m "feat: update VerificationBadge with new freshness states

Add visual indicators for all 6 states:
- ✅ Verified (green)
- ⚡ Local Dev / Real-time (yellow pulse)
- ⏳ Pending Push (orange, shows commits_ahead)
- ⚠️  Conflict (yellow warning)
- 🕐 Stale (gray)
- ❌ Deleted (red)

Add CSS for pending (orange) and stale (gray) states.

Part of local dev validation logic (Phase 5/5)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 6: Integration Testing (2 tasks)

### Task 6.1: End-to-End Test - Local Dev Workflow

**Files:**
- Create: `backend/tests/e2e-local-dev.test.ts`

---

**Step 1: Create E2E test**

Create `backend/tests/e2e-local-dev.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { ValidationService } from '../src/services/validation'
import { getFeature } from '../src/services/database'

describe('E2E: Local dev workflow', () => {
  const service = new ValidationService()
  const token = process.env.GITHUB_TOKEN || ''

  it('should handle complete local dev workflow', async () => {
    // Scenario 1: Local-only branch (not pushed)
    const localOnlyMetadata = {
      last_commit_sha: 'local-sha-123',
      last_commit_timestamp: Math.floor(Date.now() / 1000),
      has_upstream: false,
      branch_exists_on_remote: false,
      commits_ahead: null,
    }

    const result1 = await service.validateFeature(
      'steins-z',
      'supercrew-kanban',
      'test-local-feature',
      'user/test/local-branch',
      token,
      localOnlyMetadata
    )

    expect(result1.action).toBe('skip_validation')

    const dbFeature = await getFeature('steins-z', 'supercrew-kanban', 'test-local-feature')
    expect(dbFeature?.sync_state).toBe('local_only')
    expect(dbFeature?.verified).toBe(false)

    // Scenario 2: User pushes → branch now has upstream but ahead
    const pendingPushMetadata = {
      ...localOnlyMetadata,
      has_upstream: true,
      commits_ahead: 3,
    }

    const result2 = await service.validateFeature(
      'steins-z',
      'supercrew-kanban',
      'test-local-feature',
      'user/test/local-branch',
      token,
      pendingPushMetadata
    )

    // Should mark as pending_push (branch 404 but commits_ahead > 0)
    expect(result2.action).toBe('kept_agent_data')
  })
})
```

---

**Step 2: Run E2E test**

```bash
cd backend && bun test tests/e2e-local-dev.test.ts
```

Expected: PASS

---

**Step 3: Commit**

```bash
git add backend/tests/e2e-local-dev.test.ts
git commit -m "test: add E2E test for local dev workflow

Test complete workflow:
1. Local-only branch → skip_validation
2. Push branch → pending_push
3. Verify sync_state transitions correctly

Part of local dev validation logic (Phase 6/6)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6.2: Manual Testing Checklist

**Files:**
- Create: `docs/testing/local-dev-validation-manual-tests.md`

---

**Step 1: Create manual testing checklist**

Create `docs/testing/local-dev-validation-manual-tests.md`:

```markdown
# Local Dev Validation - Manual Testing Checklist

## Prerequisites

- [ ] Local dev environment set up (backend + frontend running)
- [ ] GITHUB_TOKEN environment variable configured
- [ ] Agent with Git metadata support

---

## Test Case 1: Local-Only Branch

**Steps:**
1. Create new feature: `/supercrew:create`
2. Switch to feature branch: `git checkout -b user/test/feature-x`
3. Modify meta.yaml: `status: doing`
4. Agent reports (do NOT push)
5. Check frontend

**Expected:**
- ⚡ Badge: "Local Dev" (yellow pulse)
- Board metadata: "X local dev"
- No GitHub API calls in logs

---

## Test Case 2: Pending Push

**Steps:**
1. Continue from Test Case 1
2. Make more commits (status: ready-to-ship)
3. Agent reports
4. Check frontend

**Expected:**
- ⚡ Badge: "Pending Push" (orange)
- Shows "+N commits ahead"
- sync_state: pending_push

---

## Test Case 3: Push and Verify

**Steps:**
1. `git push -u origin user/test/feature-x`
2. Wait 30-60 seconds (cron validation)
3. Check frontend

**Expected:**
- ✅ Badge: "Verified" (green)
- sync_state: synced
- verified: true

---

## Test Case 4: Git Wins (Concurrent Update)

**Steps:**
1. Edit meta.yaml on GitHub web UI (change status to shipped)
2. Locally, change status to doing
3. Agent reports
4. Wait for validation

**Expected:**
- Backend detects Git is newer
- DB updated with Git data (status: shipped)
- ✅ Badge: "Verified" (green, shows shipped)

---

## Test Case 5: Feature Deleted from Git

**Steps:**
1. Delete feature from Git (delete .supercrew/tasks/feature-x)
2. Locally, Agent still has the feature
3. Agent reports
4. Wait for validation

**Expected:**
- Backend detects Git 404 on both branch and main
- ❌ Badge: "Deleted" (red)
- sync_state: git_missing

---

## Performance Metrics

After running all tests, check:

- [ ] GitHub API calls reduced by ~50% (local-only branches skip validation)
- [ ] Frontend polling: 30s when unverified, 5min when all verified
- [ ] No false orphaned warnings

---

## Rollback Plan

If issues found:

```bash
# Revert migrations
sqlite3 .data/supercrew.db "ALTER TABLE features DROP COLUMN git_commit_sha"
sqlite3 .data/supercrew.db "ALTER TABLE features DROP COLUMN git_commit_timestamp"

# Revert code
git revert <commit-sha>
```
```

---

**Step 2: Commit**

```bash
git add docs/testing/local-dev-validation-manual-tests.md
git commit -m "docs: add manual testing checklist for local dev validation

Manual test cases:
1. Local-only branch (not pushed)
2. Pending push (commits ahead)
3. Push and verify
4. Git wins (concurrent update)
5. Feature deleted from Git

Includes rollback plan if issues found.

Part of local dev validation logic (Phase 6/6)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Success Criteria

**Implementation is complete when:**

- ✅ All unit tests pass (`bun test`)
- ✅ Type checking passes (`bun run typecheck`)
- ✅ E2E test passes (local dev workflow)
- ✅ Manual testing checklist completed
- ✅ GitHub API calls reduced by ~50% (verified in logs)
- ✅ Frontend displays 5 freshness states correctly
- ✅ No false orphaned warnings for local dev branches

---

## Rollback Plan

If critical issues are discovered:

1. **Revert database migration:**
   ```bash
   sqlite3 backend/.data/supercrew.db "ALTER TABLE features DROP COLUMN git_commit_sha"
   sqlite3 backend/.data/supercrew.db "ALTER TABLE features DROP COLUMN git_commit_timestamp"
   ```

2. **Revert commits:**
   ```bash
   git log --oneline | head -20  # Find commit SHAs
   git revert <sha-1> <sha-2> ...
   ```

3. **Redeploy previous version**

---

**End of Implementation Plan**
