// File-level diff and deduplication algorithm

import { createHash } from 'crypto'
import type {
  FileSnapshot,
  FeatureMetaWithBranches,
  BranchInfo,
  FeatureMeta,
} from '../types/board.js'
import type { SupercrewStatus } from '../types/shared.js'

// Status priority for primary branch selection
// Higher values indicate more progress and should be preferred
const STATUS_PRIORITY: Record<SupercrewStatus, number> = {
  shipped: 4,
  'ready-to-ship': 3,
  doing: 2,
  todo: 1,
}

export class FeatureDiff {
  constructor(private snapshots: FileSnapshot[]) {}

  // ─── Task 1.6: Hash Computation ───────────────────────────────────────

  private computeHash(files: FileSnapshot['files']): string {
    // Concatenate all file contents (nulls become empty strings)
    const combined =
      (files.meta ?? '') + (files.design ?? '') + (files.plan ?? '')

    // Compute MD5 hash
    return createHash('md5').update(combined).digest('hex')
  }

  // ─── Task 1.7: Deduplication Algorithm ────────────────────────────────

  buildFeatureCards(): FeatureMetaWithBranches[] {
    // Group by feature ID, then by file hash
    const grouped = this.groupByHash()

    const cards: FeatureMetaWithBranches[] = []

    for (const [featureId, hashMap] of grouped) {
      // ─── Aggregate: One card per feature ──────────────────────────────
      // Collect all snapshots for this feature across all versions
      const allSnapshots = Array.from(hashMap.values())
        .flat()
        .map((branch) =>
          this.snapshots.find(
            (s) => s.featureId === featureId && s.branch === branch,
          ),
        )
        .filter((s) => s && s.files.meta) as FileSnapshot[]

      if (allSnapshots.length === 0) continue

      // Parse metadata from all snapshots
      const snapshotsWithMeta = allSnapshots.map((snapshot) => ({
        snapshot,
        meta: this.parseMetaYaml(snapshot.files.meta!),
      }))

      // Find the most recently updated snapshot (this determines card status/position)
      // Sort by: 1) status priority, 2) branch type (non-backlog preferred), 3) updated date
      snapshotsWithMeta.sort((a, b) => {
        // 1. Status priority (higher is better)
        const statusA = STATUS_PRIORITY[a.meta.status || 'todo'] || 1
        const statusB = STATUS_PRIORITY[b.meta.status || 'todo'] || 1
        if (statusA !== statusB) return statusB - statusA

        // 2. Branch type (non-backlog is better)
        const isBacklogA = a.snapshot.branch.includes('/backlog-')
        const isBacklogB = b.snapshot.branch.includes('/backlog-')
        if (isBacklogA !== isBacklogB) return isBacklogA ? 1 : -1

        // 3. Updated date (newer is better)
        return (b.meta.updated || '1970-01-01').localeCompare(
          a.meta.updated || '1970-01-01',
        )
      })
      const primarySnapshot = snapshotsWithMeta[0]

      // ─── Filter redundant branches ────────────────────────────────────
      // For each hash group, filter out redundant branches
      const allBranchInfo: BranchInfo[] = []

      for (const [hash, branches] of hashMap) {
        let filteredBranches = branches

        if (branches.includes('main')) {
          // If main is present, only keep main (others are likely merged copies)
          filteredBranches = ['main']
        } else if (branches.length > 1) {
          // If no main and multiple branches, keep only the most recently updated one
          const branchSnapshots = branches
            .map((b) =>
              this.snapshots.find(
                (s) => s.featureId === featureId && s.branch === b,
              ),
            )
            .filter((s) => s && s.files.meta) as FileSnapshot[]

          const branchDates = branchSnapshots.map((snapshot) => ({
            branch: snapshot.branch,
            updated:
              this.parseMetaYaml(snapshot.files.meta!).updated || '1970-01-01',
          }))

          branchDates.sort((a, b) => b.updated.localeCompare(a.updated))
          filteredBranches = [branchDates[0].branch]
        }

        // Add branch info for filtered branches
        for (const branch of filteredBranches) {
          allBranchInfo.push({
            branch,
            filesHash: hash,
            isDifferent: hashMap.size > 1, // Multiple versions exist
          })
        }
      }

      // ─── Build single card for this feature ───────────────────────────
      const primaryBranch = primarySnapshot.snapshot.branch

      cards.push({
        ...primarySnapshot.meta,
        id: featureId,
        branches: allBranchInfo,
        primaryBranch,
      })
    }

    return cards
  }

  private groupByHash(): Map<string, Map<string, string[]>> {
    const grouped = new Map<string, Map<string, string[]>>()

    for (const snap of this.snapshots) {
      // Initialize feature map if needed
      if (!grouped.has(snap.featureId)) {
        grouped.set(snap.featureId, new Map())
      }

      const hashMap = grouped.get(snap.featureId)!

      // Compute hash for this snapshot
      const hash = this.computeHash(snap.files)

      // Initialize branch list for this hash if needed
      if (!hashMap.has(hash)) {
        hashMap.set(hash, [])
      }

      // Add branch to this hash group
      hashMap.get(hash)!.push(snap.branch)
    }

    return grouped
  }

  // ─── YAML Parsing ─────────────────────────────────────────────────────

  private parseMetaYaml(base64Content: string): Partial<FeatureMeta> {
    try {
      // Decode base64
      const content = Buffer.from(base64Content, 'base64').toString('utf-8')

      // Simple YAML parser (reuse frontend logic)
      const lines = content.split('\n')
      const meta: Record<string, any> = {}

      for (const line of lines) {
        const match = line.match(/^([a-z_]+):\s*(.+)$/)
        if (!match) continue

        const [, key, value] = match
        meta[key] = this.parseYamlValue(value.trim())
      }

      return {
        id: meta.id ?? '',
        title: meta.title ?? '',
        status: meta.status ?? 'planning',
        owner: meta.owner ?? '',
        priority: meta.priority ?? 'P2',
        teams: meta.teams ?? [],
        target_release: meta.target_release,
        created: meta.created ?? '',
        updated: meta.updated ?? '',
        tags: meta.tags ?? [],
        blocked_by: meta.blocked_by ?? [],
      } as FeatureMeta
    } catch (error) {
      // Failed to parse, return minimal meta
      return {
        id: '',
        title: 'Parse Error',
        status: 'planning',
        owner: '',
        priority: 'P2',
        created: '',
        updated: '',
      }
    }
  }

  private parseYamlValue(value: string): any {
    // Remove quotes
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1)
    }

    // Parse array: [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim()
      if (!inner) return []
      return inner.split(',').map((s) => s.trim())
    }

    // Parse number
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10)
    }

    return value
  }
}
