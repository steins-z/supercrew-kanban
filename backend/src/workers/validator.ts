// Validation worker - processes validation queue in background
// Validates agent-reported data against Git source of truth

import { ValidationService } from '../services/validation.js'
import {
  getValidationQueue,
  deleteValidationJob,
  incrementValidationAttempts,
} from '../services/database.js'

export interface ValidationStats {
  processed: number
  succeeded: number
  failed: number
  retried: number
  removed: number
}

// ============================================================================
// Queue Processing
// ============================================================================

/**
 * Process next batch from validation queue
 * Called by Vercel cron job every 1 minute
 */
export async function processQueue(
  batchSize: number = 10,
  githubToken: string
): Promise<ValidationStats> {
  const validator = new ValidationService()
  const stats: ValidationStats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
    removed: 0,
  }

  try {
    // 1. Get next batch from queue
    const jobs = await getValidationQueue(batchSize)

    if (jobs.length === 0) {
      console.log('[Validator] Queue is empty')
      return stats
    }

    console.log(`[Validator] Processing ${jobs.length} jobs`)

    // 2. Process in parallel (with Promise.allSettled to handle failures gracefully)
    const results = await Promise.allSettled(
      jobs.map(async (job: any) => {
        try {
          stats.processed++

          // Validate feature against Git
          const result = await validator.validateFeature(
            job.repo_owner,
            job.repo_name,
            job.feature_id,
            job.branch_name || 'main',
            githubToken
          )

          // 3. Handle result
          if (result.success) {
            if (result.action === 'retry') {
              // Agent data is newer, retry later
              await incrementValidationAttempts(job.id, result.error || 'Agent data is newer')
              stats.retried++

              // Remove if too many attempts
              if (job.attempts >= 10) {
                await deleteValidationJob(job.id)
                stats.removed++
                console.log(`[Validator] Removed job ${job.id} after max attempts`)
              }
            } else {
              // Verified or updated from Git
              await deleteValidationJob(job.id)
              stats.succeeded++
              console.log(
                `[Validator] ✓ ${job.feature_id} - ${result.action}`
              )
            }
          } else {
            // Validation failed
            await incrementValidationAttempts(job.id, result.error || 'Validation failed')
            stats.failed++

            // Remove if too many attempts
            if (job.attempts >= 10) {
              await deleteValidationJob(job.id)
              stats.removed++
              console.log(`[Validator] Removed job ${job.id} after max attempts (failed)`)
            }

            console.error(
              `[Validator] ✗ ${job.feature_id} - ${result.error || 'Unknown error'}`
            )
          }

          return result
        } catch (error) {
          console.error(`[Validator] Error processing job ${job.id}:`, error)
          await incrementValidationAttempts(
            job.id,
            error instanceof Error ? error.message : String(error)
          )
          stats.failed++

          if (job.attempts >= 10) {
            await deleteValidationJob(job.id)
            stats.removed++
          }

          throw error
        }
      })
    )

    // 4. Log summary
    console.log('[Validator] Batch complete:', stats)

    return stats
  } catch (error) {
    console.error('[Validator] processQueue error:', error)
    throw error
  }
}

/**
 * Process queue with retry logic and exponential backoff
 * This wraps processQueue with additional retry handling
 */
export async function processQueueWithRetry(
  batchSize: number = 10,
  githubToken: string,
  maxRetries: number = 3
): Promise<ValidationStats> {
  let attempt = 0
  let lastError: Error | null = null

  while (attempt < maxRetries) {
    try {
      return await processQueue(batchSize, githubToken)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      attempt++

      if (attempt < maxRetries) {
        // Exponential backoff: 2^attempt seconds
        const delayMs = Math.pow(2, attempt) * 1000
        console.log(`[Validator] Retry ${attempt}/${maxRetries} after ${delayMs}ms`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  // All retries failed
  throw lastError || new Error('processQueue failed after max retries')
}
