// Daily reconciliation worker
// Scans all Git branches and syncs features to database
// Called by Vercel cron job once per day at 3:00 AM UTC

// Imports for implementation (used in later tasks)
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
 *
 * @param repoOwner - GitHub repository owner
 * @param repoName - GitHub repository name
 * @param githubToken - GitHub API token for authentication
 * @returns Statistics about the reconciliation process
 */
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

    stats.scanned = gitSnapshots.length

    // TODO: Build feature map and sync
    return stats
  } catch (error) {
    console.error('[Reconcile] Error during reconcile:', error)
    throw error
  }
}
