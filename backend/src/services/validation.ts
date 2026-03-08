// Validation service - compares Git vs DB state and resolves conflicts
// Core logic: Git always wins when there's a conflict

import crypto from 'crypto'
import type { ComparisonResult, GitFileSnapshot, ValidationResult } from '../types/api.js'
import type { FeatureData } from './database.js'
import {
  getFeature,
  upsertFeature,
  markFeatureVerified,
  deleteValidationJob,
  incrementValidationAttempts,
  isFalsish,
} from './database.js'
import { fetchFeatureFromGit } from './github.js'

const GRACE_PERIOD_MS = 10 * 60 * 1000

// ============================================================================
// Validation Service
// ============================================================================

export class ValidationService {
  /**
   * Validate a single feature against Git
   */
  async validateFeature(
    repoOwner: string,
    repoName: string,
    featureId: string,
    branch: string = 'main',
    githubToken: string
  ): Promise<ValidationResult> {
    try {
      // 1. Get current DB state
      const dbData = await getFeature(repoOwner, repoName, featureId)

      // Fast path: Skip GitHub validation for local-only branches
      if (dbData && isFalsish(dbData.has_upstream)) {
        console.log(`[Validation] Fast path: ${featureId} is local-only (no upstream)`)
        await upsertFeature({
          ...dbData,
          sync_state: 'local_only',
          source: 'agent',      // Keep as agent source
          verified: false,      // Not verified against Git
          last_git_checked_at: Date.now(),
        })

        return {
          feature_id: featureId,
          success: true,
          action: 'local_only',
        }
      }

      // 2. Fetch from Git (source of truth)
      const gitResult = await fetchFeatureFromGit(
        repoOwner,
        repoName,
        featureId,
        branch,
        githubToken
      )

      if (!dbData && gitResult.kind !== 'snapshot') {
        return {
          feature_id: featureId,
          branch,
          success: false,
          action: 'failed',
          error: 'Feature not found in Git or DB',
        }
      }

      if (gitResult.kind === 'transient_error' || gitResult.kind === 'auth_error' || gitResult.kind === 'unknown_error') {
        if (dbData) {
          await upsertFeature({
            ...dbData,
            verified: false,
            sync_state: 'error',
            last_git_checked_at: Date.now(),
            last_sync_error: gitResult.error,
          })
        }

        return {
          feature_id: featureId,
          branch,
          success: false,
          action: 'retry',
          error: `Git fetch ${gitResult.kind}: ${gitResult.error}`,
        }
      }

      if (gitResult.kind === 'not_modified') {
        if (!dbData) {
          return {
            feature_id: featureId,
            branch,
            success: false,
            action: 'failed',
            error: 'Feature not found in DB for not_modified result',
          }
        }

        await markFeatureVerified(repoOwner, repoName, featureId, dbData.git_sha)

        return {
          feature_id: featureId,
          success: true,
          action: 'verified',
        }
      }

      if (gitResult.kind === 'not_found') {
        if (!dbData) {
          return {
            feature_id: featureId,
            branch,
            success: false,
            action: 'failed',
            error: 'Feature not found in Git or DB',
          }
        }

        return await this.handleGitNotFoundFeature(dbData)
      }

      if (gitResult.kind !== 'snapshot') {
        return {
          feature_id: featureId,
          branch,
          success: false,
          action: 'failed',
          error: 'Unexpected git result state',
        }
      }

      const gitData = gitResult.data

      if (!dbData) {
        // New feature in Git, not yet in DB
        return await this.handleNewFeatureFromGit(gitData, repoOwner, repoName, featureId)
      }

      // Both exist - compare content
      const comparison = this.compareFeatureData(gitData, dbData)

      // Resolve conflict
      return await this.resolveConflict(comparison, gitData, dbData, repoOwner, repoName, featureId)
    } catch (error) {
      console.error(`[Validation] Error validating ${featureId}:`, error)
      return {
        feature_id: featureId,
        branch,
        success: false,
        action: 'failed',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Compare Git data vs DB data using content hashes
   */
  compareFeatureData(gitData: GitFileSnapshot, dbData: FeatureData): ComparisonResult {
    // 1. Compute content hashes
    const gitHash = this.computeContentHash({
      meta: gitData.meta_yaml,
      design: gitData.dev_design_md,
      plan: gitData.dev_plan_md,
    })

    const dbHash = this.computeContentHash({
      meta: dbData.meta_yaml,
      design: dbData.dev_design_md,
      plan: dbData.dev_plan_md,
    })

    // 2. Check if identical
    if (gitHash === dbHash) {
      return { identical: true, gitHash, dbHash }
    }

    // 3. Compare timestamps
    const gitTime = gitData.updated_at
    const dbTime = dbData.updated_at
    const timeDiff = gitTime - dbTime

    // 4. Within 5 seconds = consider identical (clock skew tolerance)
    if (Math.abs(timeDiff) < 5000) {
      return { identical: true, gitHash, dbHash }
    }

    // 5. Determine which is newer
    return {
      identical: false,
      gitIsNewer: gitTime > dbTime,
      agentIsNewer: dbTime > gitTime,
      timeDiff,
      gitHash,
      dbHash,
    }
  }

  /**
   * Resolve conflict based on comparison result
   */
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

    // Case 2: Git is newer -> update DB from Git
    if (comparison.gitIsNewer) {
      await this.updateFromGit(gitData, repoOwner, repoName, featureId)

      return {
        feature_id: featureId,
        success: true,
        action: 'updated_from_git',
      }
    }

    // Case 3: Agent write is newer -> retry briefly, then mark conflict
    if (comparison.agentIsNewer) {
      const ageMs = Date.now() - dbData.updated_at

      if (ageMs <= GRACE_PERIOD_MS) {
        await upsertFeature({
          ...dbData,
          verified: false,
          sync_state: 'pending_verify',
          last_git_checked_at: Date.now(),
          last_sync_error: 'Agent data newer than Git, waiting for sync',
        })

        return {
          feature_id: featureId,
          success: false,
          action: 'retry',
          error: 'Agent push is newer than Git, will retry',
        }
      }

      await upsertFeature({
        ...dbData,
        verified: false,
        sync_state: 'conflict',
        last_git_checked_at: Date.now(),
        last_sync_error: 'Conflict: DB data remained newer than Git after grace window',
      })

      return {
        feature_id: featureId,
        success: true,
        action: 'retry',
        error: 'Marked as conflict after grace window',
      }
    }

    // Case 4: Default fallback -> Git wins
    await this.updateFromGit(gitData, repoOwner, repoName, featureId)

    return {
      feature_id: featureId,
      success: true,
      action: 'updated_from_git',
    }
  }

  /**
   * Handle feature that exists in DB but is not found in Git (404)
   */
  private async handleGitNotFoundFeature(dbData: FeatureData): Promise<ValidationResult> {
    const ageMs = Date.now() - dbData.created_at

    if (ageMs < GRACE_PERIOD_MS) {
      await upsertFeature({
        ...dbData,
        verified: false,
        sync_state: 'pending_verify',
        last_git_checked_at: Date.now(),
        last_sync_error: 'Feature not yet in Git, waiting for push',
      })

      return {
        feature_id: dbData.id,
        success: false,
        action: 'retry',
        error: 'Feature not yet in Git, waiting for push',
      }
    }

    await upsertFeature({
      ...dbData,
      source: 'agent_orphaned',
      verified: false,
      sync_state: 'git_missing',
      last_git_checked_at: Date.now(),
      last_sync_error: 'Feature deleted from Git, marked as orphaned',
    })

    return {
      feature_id: dbData.id,
      success: true,
      action: 'orphaned',
      error: 'Feature deleted from Git, marked as orphaned',
    }
  }

  /**
   * Handle new feature found in Git but not in DB
   */
  private async handleNewFeatureFromGit(
    gitData: GitFileSnapshot,
    repoOwner: string,
    repoName: string,
    featureId: string
  ): Promise<ValidationResult> {
    await this.updateFromGit(gitData, repoOwner, repoName, featureId)

    return {
      feature_id: featureId,
      success: true,
      action: 'updated_from_git',
    }
  }

  /**
   * Update DB from Git data
   */
  private async updateFromGit(
    gitData: GitFileSnapshot,
    repoOwner: string,
    repoName: string,
    featureId: string
  ): Promise<void> {
    // Parse meta.yaml to extract metadata
    const metaParsed = this.parseMetaYaml(gitData.meta_yaml || '')
    const normalizedStatus = this.normalizeStatus(metaParsed.status)

    await upsertFeature({
      id: featureId,
      repo_owner: repoOwner,
      repo_name: repoName,
      title: metaParsed.title || featureId,
      status: normalizedStatus,
      owner: metaParsed.owner,
      priority: metaParsed.priority,
      progress: metaParsed.progress || 0,
      meta_yaml: gitData.meta_yaml || undefined,
      dev_design_md: gitData.dev_design_md || undefined,
      dev_plan_md: gitData.dev_plan_md || undefined,
      prd_md: gitData.prd_md || undefined,
      source: 'git',
      verified: true,
      git_sha: gitData.sha,
      git_etag: gitData.etag,
      sync_state: 'synced',
      last_git_checked_at: Date.now(),
      last_git_commit_at: gitData.updated_at,
      last_sync_error: undefined,
      created_at: Date.now(), // ignored on conflict update
      updated_at: gitData.updated_at,
      verified_at: Date.now(),
    })
  }

  /**
   * Compute MD5 hash of concatenated file contents
   */
  private computeContentHash(content: {
    meta?: string | null
    design?: string | null
    plan?: string | null
  }): string {
    const combined = [content.meta || '', content.design || '', content.plan || ''].join(
      '\n---\n'
    )

    return crypto.createHash('md5').update(combined, 'utf8').digest('hex')
  }

  /**
   * Simple YAML parser for meta.yaml files
   */
  private parseMetaYaml(content: string): {
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

  private normalizeStatus(status?: string): 'todo' | 'doing' | 'ready-to-ship' | 'shipped' {
    if (status === 'todo' || status === 'doing' || status === 'ready-to-ship' || status === 'shipped') {
      return status
    }

    return 'todo'
  }
}

// ============================================================================
// Validation Queue Processor
// ============================================================================

/**
 * Process validation queue (called by cron job)
 */
export async function processValidationQueue(
  batchSize: number = 10,
  githubToken: string
): Promise<{
  processed: number
  succeeded: number
  failed: number
  retried: number
}> {
  const validator = new ValidationService()
  const stats = { processed: 0, succeeded: 0, failed: 0, retried: 0 }

  // Get next batch from queue
  const { getValidationQueue } = await import('./database.js')
  const jobs = await getValidationQueue(batchSize)

  // Process in parallel
  await Promise.allSettled(
    jobs.map(async (job: any) => {
      const result = await validator.validateFeature(
        job.repo_owner,
        job.repo_name,
        job.feature_id,
        job.branch_name || 'main',
        githubToken
      )

      stats.processed++

      if (result.success) {
        if (result.action === 'retry') {
          // Increment attempts, keep in queue
          await incrementValidationAttempts(job.id, result.error)
          stats.retried++

          // Remove from queue if too many attempts
          if (job.attempts >= 10) {
            await deleteValidationJob(job.id)
          }
        } else {
          // Remove from queue
          await deleteValidationJob(job.id)
          stats.succeeded++
        }
      } else {
        // Failed - increment attempts or remove
        await incrementValidationAttempts(job.id, result.error)
        stats.failed++

        if (job.attempts >= 10) {
          await deleteValidationJob(job.id)
        }
      }

      return result
    })
  )

  console.log('[Validation] Batch processed:', stats)

  return stats
}
