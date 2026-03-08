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
