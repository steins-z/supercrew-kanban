// Agent Reporting API Routes
// Endpoints for local agents to report feature status updates

import { Hono } from 'hono'
import type {
  FeatureReportRequest,
  FeatureReportResponse,
  BatchReportRequest,
  BatchReportResponse,
} from '../types/api.js'
import { validateApiKey } from '../middleware/auth.js'
import { upsertFeature, upsertBranch, queueValidation } from '../services/database.js'
import crypto from 'crypto'

export const featuresRouter = new Hono()

// ============================================================================
// POST /api/features/report - Single Feature Report
// ============================================================================

featuresRouter.post('/report', validateApiKey, async (c) => {
  try {
    const body = await c.req.json<FeatureReportRequest>()

    // Validate required fields
    if (!body.repo_owner || !body.repo_name || !body.feature_id || !body.data) {
      return c.json({ error: 'Missing required fields: repo_owner, repo_name, feature_id, data' }, 400)
    }

    // Validate API key scope (ensure key can only update its own repo)
    const allowedOwner = String((c as any).get('repo_owner') ?? '')
    const allowedRepo = String((c as any).get('repo_name') ?? '')

    if (body.repo_owner !== allowedOwner || body.repo_name !== allowedRepo) {
      return c.json(
        {
          error: 'API key is not authorized for this repository',
          allowed: `${allowedOwner}/${allowedRepo}`,
          requested: `${body.repo_owner}/${body.repo_name}`,
        },
        403
      )
    }

    const { repo_owner, repo_name, feature_id, branch, data } = body
    const now = Date.now()

    // Compute content hash for deduplication
    const contentHash = computeContentHash({
      meta: data.meta_yaml,
      design: data.dev_design_md,
      plan: data.dev_plan_md,
    })

    // 1. Upsert to features table (unverified)
    await upsertFeature({
      id: feature_id,
      repo_owner,
      repo_name,
      title: data.meta_yaml ? parseTitle(data.meta_yaml) : feature_id,
      status: data.status || 'todo',
      owner: data.owner,
      priority: data.priority,
      progress: data.progress || 0,
      meta_yaml: data.meta_yaml || undefined,
      dev_design_md: data.dev_design_md || undefined,
      dev_plan_md: data.dev_plan_md || undefined,
      prd_md: data.prd_md || undefined,
      source: 'agent',
      verified: false,
      sync_state: 'pending_verify',
      last_db_write_at: now,
      last_sync_error: undefined,
      created_at: now,
      updated_at: now,
    })

    // 2. If branch specified, upsert to branches table
    if (branch) {
      await upsertBranch({
        repo_owner,
        repo_name,
        branch_name: branch,
        feature_id,
        status: data.status,
        progress: data.progress || 0,
        content_hash: contentHash,
        verified: false,
        updated_at: now,
      })
    }

    // 3. Queue for validation
    await queueValidation({
      repo_owner,
      repo_name,
      feature_id,
      branch_name: branch,
      priority: 1, // Higher priority for recent updates
    })

    // 4. Return success response
    const response: FeatureReportResponse = {
      ok: true,
      feature_id,
      source: 'agent',
      verified: false,
      queued_for_validation: true,
      message: 'Status updated. Will verify against Git in ~30-60s.',
    }

    return c.json(response, 200)
  } catch (error) {
    console.error('[API] /api/features/report error:', error)
    return c.json(
      {
        error: 'Failed to process feature report',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// ============================================================================
// POST /api/features/batch - Batch Feature Report
// ============================================================================

featuresRouter.post('/batch', validateApiKey, async (c) => {
  try {
    const body = await c.req.json<BatchReportRequest>()

    if (!body.repo_owner || !body.repo_name || !body.features || !Array.isArray(body.features)) {
      return c.json({ error: 'Missing required fields: repo_owner, repo_name, features[]' }, 400)
    }

    // Validate API key scope
    const allowedOwner = String((c as any).get('repo_owner') ?? '')
    const allowedRepo = String((c as any).get('repo_name') ?? '')

    if (body.repo_owner !== allowedOwner || body.repo_name !== allowedRepo) {
      return c.json(
        {
          error: 'API key is not authorized for this repository',
          allowed: `${allowedOwner}/${allowedRepo}`,
          requested: `${body.repo_owner}/${body.repo_name}`,
        },
        403
      )
    }

    const { repo_owner, repo_name, features } = body
    const results: BatchReportResponse['results'] = []
    let queuedCount = 0

    // Process each feature
    for (const feature of features) {
      try {
        const { feature_id, branch, data } = feature

        if (!feature_id || !data) {
          results.push({
            feature_id: feature_id || 'unknown',
            status: 'failed',
            error: 'Missing feature_id or data',
          })
          continue
        }

        const now = Date.now()
        const contentHash = computeContentHash({
          meta: data.meta_yaml,
          design: data.dev_design_md,
          plan: data.dev_plan_md,
        })

        // Upsert feature
        await upsertFeature({
          id: feature_id,
          repo_owner,
          repo_name,
          title: data.meta_yaml ? parseTitle(data.meta_yaml) : feature_id,
          status: data.status || 'todo',
          owner: data.owner,
          priority: data.priority,
          progress: data.progress || 0,
          meta_yaml: data.meta_yaml || undefined,
          dev_design_md: data.dev_design_md || undefined,
          dev_plan_md: data.dev_plan_md || undefined,
          prd_md: data.prd_md || undefined,
          source: 'agent',
          verified: false,
          sync_state: 'pending_verify',
          last_db_write_at: now,
          last_sync_error: undefined,
          created_at: now,
          updated_at: now,
        })

        // Upsert branch if specified
        if (branch) {
          await upsertBranch({
            repo_owner,
            repo_name,
            branch_name: branch,
            feature_id,
            status: data.status,
            progress: data.progress || 0,
            content_hash: contentHash,
            verified: false,
            updated_at: now,
          })
        }

        // Queue validation
        await queueValidation({
          repo_owner,
          repo_name,
          feature_id,
          branch_name: branch,
          priority: 1,
        })

        queuedCount++
        results.push({ feature_id, status: 'updated' })
      } catch (error) {
        results.push({
          feature_id: feature.feature_id || 'unknown',
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const response: BatchReportResponse = {
      ok: true,
      results,
      queued_for_validation: queuedCount,
    }

    return c.json(response, 200)
  } catch (error) {
    console.error('[API] /api/features/batch error:', error)
    return c.json(
      {
        error: 'Failed to process batch report',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// ============================================================================
// GET /api/features/:id - Get Single Feature Details
// ============================================================================

featuresRouter.get('/:id', async (c) => {
  try {
    const featureId = c.req.param('id')
    const repoOwner = c.req.query('repo_owner')
    const repoName = c.req.query('repo_name')

    if (!repoOwner || !repoName) {
      return c.json({ error: 'Missing required query params: repo_owner, repo_name' }, 400)
    }

    const { getFeature } = await import('../services/database.js')
    const feature = await getFeature(repoOwner, repoName, featureId)

    if (!feature) {
      return c.json({ error: 'Feature not found' }, 404)
    }

    // Parse metadata from stored files
    const meta = parseMetaYaml(feature.meta_yaml || '')
    const design = parseDesignMarkdown(feature.dev_design_md || '')
    const plan = parsePlanMarkdown(feature.dev_plan_md || '')
    const prd = { body: feature.prd_md || '' }

    const response = {
      id: feature.id,
      meta: {
        title: feature.title,
        status: feature.status,
        owner: feature.owner,
        priority: feature.priority,
        progress: feature.progress,
        created: new Date(feature.created_at).toISOString(),
        updated: new Date(feature.updated_at).toISOString(),
      },
      design: design.body ? design : undefined,
      plan: plan.body ? plan : undefined,
      prd: prd.body ? prd : undefined,
      verified: Boolean(feature.verified),
      source: feature.source,
      sync_state: feature.sync_state,
      git_sha: feature.git_sha,
      updated_at: new Date(feature.updated_at).toISOString(),
      verified_at: feature.verified_at ? new Date(feature.verified_at).toISOString() : undefined,
    }

    return c.json(response, 200)
  } catch (error) {
    console.error('[API] /api/features/:id error:', error)
    return c.json(
      {
        error: 'Failed to fetch feature',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// ============================================================================
// Utility Functions
// ============================================================================

function computeContentHash(content: {
  meta?: string | null
  design?: string | null
  plan?: string | null
}): string {
  const combined = [content.meta || '', content.design || '', content.plan || ''].join('\n---\n')
  return crypto.createHash('md5').update(combined, 'utf8').digest('hex')
}

function parseTitle(metaYaml: string): string {
  const match = metaYaml.match(/^title:\s*["']?(.+?)["']?$/m)
  return match ? match[1].trim() : 'Untitled'
}

function parseMetaYaml(content: string): Record<string, any> {
  const result: Record<string, any> = {}
  for (const line of content.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (match) {
      result[match[1]] = match[2].replace(/['"]/g, '')
    }
  }
  return result
}

function parseDesignMarkdown(content: string): { status: string; reviewers: string[]; body: string } {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!frontmatterMatch) {
    return { status: 'draft', reviewers: [], body: content }
  }

  const yamlStr = frontmatterMatch[1]
  const body = frontmatterMatch[2].trim()

  const statusMatch = yamlStr.match(/status:\s*(\w+)/)
  const reviewersMatch = yamlStr.match(/reviewers:\s*\[(.*?)\]/)

  return {
    status: statusMatch ? statusMatch[1] : 'draft',
    reviewers: reviewersMatch
      ? reviewersMatch[1].split(',').map(r => r.trim()).filter(Boolean)
      : [],
    body,
  }
}

function parsePlanMarkdown(content: string): {
  total_tasks: number
  completed_tasks: number
  progress: number
  body: string
} {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!frontmatterMatch) {
    return { total_tasks: 0, completed_tasks: 0, progress: 0, body: content }
  }

  const yamlStr = frontmatterMatch[1]
  const body = frontmatterMatch[2].trim()

  const totalMatch = yamlStr.match(/total_tasks:\s*(\d+)/)
  const completedMatch = yamlStr.match(/completed_tasks:\s*(\d+)/)
  const progressMatch = yamlStr.match(/progress:\s*(\d+)/)

  return {
    total_tasks: totalMatch ? parseInt(totalMatch[1]) : 0,
    completed_tasks: completedMatch ? parseInt(completedMatch[1]) : 0,
    progress: progressMatch ? parseInt(progressMatch[1]) : 0,
    body,
  }
}
