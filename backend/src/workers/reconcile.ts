// Daily reconciliation worker
// Scans all Git branches and syncs features to database
// Called by Vercel cron job once per day at 3:00 AM UTC

// Imports for implementation (used in later tasks)
import { BranchScanner } from '../services/branch-scanner.js'
import { getFeatures, upsertFeature } from '../services/database.js'
import type { FileSnapshot } from '../types/board.js'

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
    return stats
  } catch (error) {
    console.error('[Reconcile] Error during reconcile:', error)
    throw error
  }
}
