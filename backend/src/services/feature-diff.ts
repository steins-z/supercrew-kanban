// File-level diff and deduplication algorithm

import { createHash } from 'crypto'
import type {
  FileSnapshot,
  FeatureMetaWithBranches,
  BranchInfo,
  FeatureMeta,
} from '../types/board.js'

export class FeatureDiff {
  constructor(private snapshots: FileSnapshot[]) {}

  // ─── Task 1.6: Hash Computation ───────────────────────────────────────

  private computeHash(files: FileSnapshot['files']): string {
    // Concatenate all file contents (nulls become empty strings)
    const combined =
      (files.meta ?? '') +
      (files.design ?? '') +
      (files.plan ?? '')

    // Compute MD5 hash
    return createHash('md5').update(combined).digest('hex')
  }

  // ─── Task 1.7: Deduplication Algorithm ────────────────────────────────

  buildFeatureCards(): FeatureMetaWithBranches[] {
    // Group by feature ID, then by file hash
    const grouped = this.groupByHash()

    const cards: FeatureMetaWithBranches[] = []

    for (const [featureId, hashMap] of grouped) {
      const hasMultipleVersions = hashMap.size > 1

      for (const [hash, branches] of hashMap) {
        // Determine primary branch (main first, else first branch)
        const primaryBranch = branches.includes('main') ? 'main' : branches[0]

        // Find the snapshot for primary branch
        const snapshot = this.snapshots.find(
          s => s.featureId === featureId && s.branch === primaryBranch
        )

        if (!snapshot || !snapshot.files.meta) continue

        // Parse meta.yaml from primary branch
        const meta = this.parseMetaYaml(snapshot.files.meta)

        // Build branch info
        // isDifferent = true if this feature has multiple versions across branches
        const branchInfo: BranchInfo[] = branches.map(b => ({
          branch: b,
          filesHash: hash,
          isDifferent: hasMultipleVersions,
        }))

        cards.push({
          ...meta,
          id: featureId,
          branches: branchInfo,
          primaryBranch,
        })
      }
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
      return inner.split(',').map(s => s.trim())
    }

    // Parse number
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10)
    }

    return value
  }
}
