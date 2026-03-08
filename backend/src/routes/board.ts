// Board API endpoint - DB-first with Git fallback

import { Hono } from 'hono'
import type { BoardResponse } from '../types/board.js'
import type { SupercrewStatus } from '../types/shared.js'
import type { FileSnapshot } from '../types/board.js'
import { BranchScanner } from '../services/branch-scanner.js'
import { FeatureDiff } from '../services/feature-diff.js'

export const boardRouter = new Hono()

function toIso(value: unknown): string {
  if (typeof value === 'number') return new Date(value).toISOString()
  if (typeof value === 'bigint') return new Date(Number(value)).toISOString()
  if (typeof value === 'string') return new Date(value).toISOString()
  return new Date(0).toISOString()
}

// ─── Helper: Sync Git snapshots to database ────────────────────────────────

/**
 * Scan Git and sync features to database (blocking version for auto-sync)
 */
async function scanAndSyncFromGit(
  repoOwner: string,
  repoName: string,
  githubToken: string
): Promise<void> {
  console.log(`[scanAndSyncFromGit] Starting Git scan for ${repoOwner}/${repoName}`)

  // Scan Git branches
  const scanner = new BranchScanner(githubToken, repoOwner, repoName)
  const branches = await scanner.discoverBranches('user/*')

  console.log(`[scanAndSyncFromGit] Discovered ${branches.length} branches`)

  if (branches.length === 0) {
    console.log('[scanAndSyncFromGit] No branches found, nothing to sync')
    return
  }

  // Fetch all features from branches
  const snapshots = await scanner.fetchAllFeatures(branches)

  console.log(`[scanAndSyncFromGit] Fetched ${snapshots.length} snapshots`)

  if (snapshots.length === 0) {
    console.log('[scanAndSyncFromGit] No features found, nothing to sync')
    return
  }

  // Sync to database
  await syncFeaturesToDatabase(repoOwner, repoName, snapshots)
}

/**
 * Background task to sync Git-scanned features to database
 * This allows Git mode scans to populate the database for database mode
 */
async function syncFeaturesToDatabase(
  repoOwner: string,
  repoName: string,
  snapshots: FileSnapshot[]
): Promise<void> {
  const { upsertFeature } = await import('../services/database.js')

  // Build feature map (deduplicate by feature ID, prefer main branch)
  const featureMap = new Map<string, FileSnapshot>()

  for (const snapshot of snapshots) {
    if (snapshot.branch === 'main' || snapshot.branch.startsWith('user/')) {
      if (!featureMap.has(snapshot.featureId)) {
        featureMap.set(snapshot.featureId, snapshot)
      } else if (snapshot.branch === 'main') {
        // Prefer main branch
        featureMap.set(snapshot.featureId, snapshot)
      }
    }
  }

  // Parse and upsert each feature
  for (const [featureId, snapshot] of featureMap) {
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
        source: 'git',
        verified: true,
        sync_state: 'synced',
        last_git_checked_at: now,
        last_git_commit_at: now,
        created_at: now,
        updated_at: now,
        verified_at: now,
      })
    } catch (error) {
      console.error(`[syncFeaturesToDatabase] Failed to sync ${featureId}:`, error)
    }
  }

  console.log(`[syncFeaturesToDatabase] Synced ${featureMap.size} features to database`)
}

/**
 * Parse meta.yaml content
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

/**
 * Normalize status to valid SupercrewStatus
 */
function normalizeStatus(status: any): SupercrewStatus {
  const normalized = String(status || 'todo').toLowerCase().trim()
  if (['todo', 'doing', 'ready-to-ship', 'shipped'].includes(normalized)) {
    return normalized as SupercrewStatus
  }
  return 'todo'
}

// ============================================================================
// GET /api/board - Get Full Board State (DB-first)
// ============================================================================

boardRouter.get('/', async (c) => {
  try {
    const repoOwner = c.req.query('repo_owner')
    const repoName = c.req.query('repo_name')
    const autoSync = c.req.query('auto_sync') !== 'false' // Default: true

    if (!repoOwner || !repoName) {
      return c.json({ error: 'Missing required query params: repo_owner, repo_name' }, 400)
    }

    // 1. Fetch all features from database
    const { db } = await import('../services/database.js')
    const featuresResult = await db.execute({
      sql: `SELECT
              f.id,
              f.repo_owner,
              f.repo_name,
              f.title,
              f.status,
              f.owner,
              f.priority,
              f.progress,
              f.source,
              f.verified,
              f.sync_state,
              f.last_git_checked_at,
              f.last_sync_error,
              f.created_at,
              f.updated_at,
              f.verified_at,
              f.git_sha,
              f.meta_yaml,
              f.dev_design_md,
              f.dev_plan_md,
              f.prd_md
            FROM features f
            WHERE f.repo_owner = ? AND f.repo_name = ?
            ORDER BY f.updated_at DESC`,
      args: [repoOwner, repoName],
    })

    // 1.5. If database is empty and auto_sync enabled, trigger Git scan
    if (featuresResult.rows.length === 0 && autoSync) {
      console.log('[API] Database empty, triggering Git scan + sync...')

      // Get OAuth token from Authorization header (if available)
      const authHeader = c.req.header('Authorization')
      const token = authHeader?.replace('Bearer ', '')

      if (token) {
        try {
          // Scan Git and sync to database (blocking to ensure data is available)
          await scanAndSyncFromGit(repoOwner, repoName, token)

          // Re-fetch features after sync
          const syncedResult = await db.execute({
            sql: `SELECT
                    f.id,
                    f.repo_owner,
                    f.repo_name,
                    f.title,
                    f.status,
                    f.owner,
                    f.priority,
                    f.progress,
                    f.source,
                    f.verified,
                    f.sync_state,
                    f.last_git_checked_at,
                    f.last_sync_error,
                    f.created_at,
                    f.updated_at,
                    f.verified_at,
                    f.git_sha,
                    f.meta_yaml,
                    f.dev_design_md,
                    f.dev_plan_md,
                    f.prd_md
                  FROM features f
                  WHERE f.repo_owner = ? AND f.repo_name = ?
                  ORDER BY f.updated_at DESC`,
            args: [repoOwner, repoName],
          })

          // Use synced results
          featuresResult.rows = syncedResult.rows

          console.log(`[API] Auto-sync completed: ${syncedResult.rows.length} features synced`)
        } catch (syncError) {
          console.error('[API] Auto-sync failed (non-critical):', syncError)
          // Continue with empty results
        }
      } else {
        console.log('[API] No OAuth token provided, skipping auto-sync')
      }
    }

    // 2. Fetch branch information
    const branchesResult = await db.execute({
      sql: `SELECT
              branch_name,
              feature_id,
              status,
              progress,
              verified,
              updated_at
            FROM branches
            WHERE repo_owner = ? AND repo_name = ?`,
      args: [repoOwner, repoName],
    })

    // 3. Build feature map with branch info
    const featureMap = new Map()

    for (const row of featuresResult.rows) {
      const feature: any = {
        id: row.id,
        title: row.title,
        status: row.status,
        owner: row.owner || undefined,
        priority: row.priority || undefined,
        progress: row.progress || 0,
        created: toIso(row.created_at),
        updated: toIso(row.updated_at),
        source: row.source,
        verified: Boolean(row.verified),
        sync_state: row.sync_state || undefined,
        last_git_checked_at: row.last_git_checked_at
          ? toIso(row.last_git_checked_at)
          : undefined,
        last_sync_error: row.last_sync_error || undefined,
        verified_at: row.verified_at ? toIso(row.verified_at) : undefined,
        git_sha: row.git_sha || undefined,
        branches: [],
      }

      featureMap.set(row.id, feature)
    }

    // 4. Attach branch information to features
    for (const row of branchesResult.rows) {
      const feature = featureMap.get(row.feature_id)
      if (feature) {
        feature.branches.push({
          name: row.branch_name,
          status: row.status,
          progress: row.progress || 0,
          verified: Boolean(row.verified),
          updated: toIso(row.updated_at),
        })
      }
    }

    // 5. Group features by status
    const features = Array.from(featureMap.values())
    const groupedFeatures = {
      todo: features.filter(f => f.status === 'todo'),
      doing: features.filter(f => f.status === 'doing'),
      'ready-to-ship': features.filter(f => f.status === 'ready-to-ship'),
      shipped: features.filter(f => f.status === 'shipped'),
    }

    // 6. Calculate freshness metrics
    const { calculateFreshness } = await import('../services/freshness.js')
    const freshnessMetrics = await calculateFreshness(features)

    // 7. Build response
    const response: any = {
      repo_owner: repoOwner,
      repo_name: repoName,
      features: groupedFeatures,
      metadata: {
        total_features: features.length,
        last_updated: new Date().toISOString(),
        source: 'database',
        freshness: freshnessMetrics,
      },
    }

    return c.json(response, 200)
  } catch (error) {
    console.error('[API] /api/board error:', error)
    return c.json(
      {
        error: 'Failed to fetch board state',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// ============================================================================
// GET /api/board/branches - Get Branch-Specific View
// ============================================================================

boardRouter.get('/branches', async (c) => {
  try {
    const repoOwner = c.req.query('repo_owner')
    const repoName = c.req.query('repo_name')
    const branchName = c.req.query('branch')

    if (!repoOwner || !repoName) {
      return c.json({ error: 'Missing required query params: repo_owner, repo_name' }, 400)
    }

    const { db } = await import('../services/database.js')

    // If branch specified, filter to that branch
    if (branchName) {
      const result = await db.execute({
        sql: `SELECT
                b.branch_name,
                b.feature_id,
                b.status,
                b.progress,
                b.verified,
                b.updated_at,
                f.title,
                f.owner,
                f.priority
              FROM branches b
              JOIN features f ON b.feature_id = f.id
                AND b.repo_owner = f.repo_owner
                AND b.repo_name = f.repo_name
              WHERE b.repo_owner = ? AND b.repo_name = ? AND b.branch_name = ?
              ORDER BY b.updated_at DESC`,
        args: [repoOwner, repoName, branchName],
      })

      const features = result.rows.map((row: any) => ({
        id: row.feature_id,
        title: row.title,
        status: row.status,
        owner: row.owner || undefined,
        priority: row.priority || undefined,
        progress: row.progress || 0,
        verified: Boolean(row.verified),
        updated: toIso(row.updated_at),
      }))

      return c.json({
        repo_owner: repoOwner,
        repo_name: repoName,
        branch: branchName,
        features,
        metadata: {
          total_features: features.length,
          last_updated: new Date().toISOString(),
        },
      }, 200)
    }

    // Otherwise, return all branches with their features
    const result = await db.execute({
      sql: `SELECT
              b.branch_name,
              COUNT(DISTINCT b.feature_id) as feature_count,
              MAX(b.updated_at) as last_updated
            FROM branches b
            WHERE b.repo_owner = ? AND b.repo_name = ?
            GROUP BY b.branch_name
            ORDER BY last_updated DESC`,
      args: [repoOwner, repoName],
    })

    const branches = result.rows.map((row: any) => ({
      name: row.branch_name,
      feature_count: row.feature_count,
      last_updated: toIso(row.last_updated),
    }))

    return c.json({
      repo_owner: repoOwner,
      repo_name: repoName,
      branches,
      metadata: {
        total_branches: branches.length,
        last_updated: new Date().toISOString(),
      },
    }, 200)
  } catch (error) {
    console.error('[API] /api/board/branches error:', error)
    return c.json(
      {
        error: 'Failed to fetch branch view',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

boardRouter.get('/multi-branch', async (c) => {
  // ─── Extract Parameters ────────────────────────────────────────────

  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  const owner = c.req.header('X-Repo-Owner')
  const repo = c.req.header('X-Repo-Name')
  const branchPattern = c.req.query('branch_pattern') ?? 'feature/*'

  if (!token) {
    return c.json({ error: 'Missing Authorization header' }, 401)
  }

  if (!owner || !repo) {
    return c.json({
      error: 'Missing required headers: X-Repo-Owner, X-Repo-Name'
    }, 400)
  }

  // ─── Scan Branches ────────────────────────────────────────────────

  try {
    const scanner = new BranchScanner(token, owner, repo)

    // Step 1: Discover branches
    const branches = await scanner.discoverBranches(branchPattern)

    if (branches.length === 0) {
      return c.json({
        features: [],
        featuresByStatus: {
          todo: [],
          doing: [],
          'ready-to-ship': [],
          shipped: [],
        },
        metadata: {
          scannedBranches: [],
          totalBranches: 0,
          fetchedAt: new Date().toISOString(),
          errors: scanner.errors,
        },
      } as BoardResponse)
    }

    // Step 2: Fetch all features from all branches
    const snapshots = await scanner.fetchAllFeatures(branches)

    // Step 3: Compute diffs and build cards
    const differ = new FeatureDiff(snapshots)
    const features = differ.buildFeatureCards()

    // Step 3.5: Sync features to database (background, non-blocking)
    // This ensures Git scan results are also available in database mode
    syncFeaturesToDatabase(owner, repo, snapshots).catch(err => {
      console.error('[board/multi-branch] Database sync failed (non-critical):', err)
    })

    // Step 4: Group by status
    const featuresByStatus: Record<SupercrewStatus, typeof features> = {
      todo: [],
      doing: [],
      'ready-to-ship': [],
      shipped: [],
    }

    for (const feature of features) {
      // Map unknown statuses to fallback value
      const status = featuresByStatus[feature.status] !== undefined ? feature.status : 'shipped'
      featuresByStatus[status].push(feature)
    }

    // ─── Return Response ──────────────────────────────────────────────

    const response: BoardResponse = {
      features,
      featuresByStatus,
      metadata: {
        scannedBranches: branches,
        totalBranches: branches.length,
        fetchedAt: new Date().toISOString(),
        errors: scanner.errors,
      },
    }

    return c.json(response)

  } catch (error) {
    console.error('[board/multi-branch] Error:', error)

    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined,
    }, 500)
  }
})
