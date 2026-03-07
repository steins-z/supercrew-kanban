// Vercel Cron endpoint for validation worker
// Runs every 1 minute to validate agent-reported data against Git

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { processQueueWithRetry } from '../../backend/src/workers/validator.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ─── Authentication ──────────────────────────────────────────────────

  const cronSecret = req.headers['x-vercel-cron-secret']
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    console.error('[Cron] CRON_SECRET not configured')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  if (cronSecret !== expectedSecret) {
    console.error('[Cron] Invalid CRON_SECRET')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // ─── Get GitHub Token ────────────────────────────────────────────────

  const githubToken = process.env.GITHUB_TOKEN

  if (!githubToken) {
    console.error('[Cron] GITHUB_TOKEN not configured')
    return res.status(500).json({ error: 'GitHub token not configured' })
  }

  // ─── Process Queue ───────────────────────────────────────────────────

  try {
    const batchSize = parseInt(process.env.VALIDATION_BATCH_SIZE || '10', 10)

    console.log('[Cron] Starting validation worker...')
    const stats = await processQueueWithRetry(batchSize, githubToken)

    console.log('[Cron] Validation complete:', stats)

    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...stats,
    })
  } catch (error) {
    console.error('[Cron] Validation worker error:', error)

    return res.status(500).json({
      error: 'Validation worker failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
  }
}
