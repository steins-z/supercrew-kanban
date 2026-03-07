// Admin API Routes
// Endpoints for managing API keys

import { Hono } from 'hono'
import type { CreateApiKeyRequest, CreateApiKeyResponse, ListApiKeysResponse } from '../types/api.js'
import { createApiKey, getApiKey, revokeApiKey } from '../services/database.js'
import { generateApiKey, hashApiKey } from '../middleware/auth.js'

export const adminRouter = new Hono()

// ============================================================================
// POST /api/admin/api-keys - Create API Key
// ============================================================================

adminRouter.post('/api-keys', async (c) => {
  try {
    const body = await c.req.json<CreateApiKeyRequest>()

    // Validate required fields
    if (!body.repo_owner || !body.repo_name) {
      return c.json({ error: 'Missing required fields: repo_owner, repo_name' }, 400)
    }

    const { repo_owner, repo_name, created_by, expires_in_days, description } = body

    // Generate new API key
    const apiKey = generateApiKey('live')
    const keyHash = hashApiKey(apiKey)

    // Calculate expiration timestamp
    const expiresAt = expires_in_days
      ? Date.now() + expires_in_days * 24 * 60 * 60 * 1000
      : undefined

    // Store in database
    await createApiKey({
      key_hash: keyHash,
      repo_owner,
      repo_name,
      created_by,
      created_at: Date.now(),
      expires_at: expiresAt,
      description,
    })

    // Return response (API key only shown once!)
    const response: CreateApiKeyResponse = {
      ok: true,
      api_key: apiKey,
      key_hash: keyHash,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      message: 'API key created successfully. Store it securely - it will not be shown again.',
    }

    return c.json(response, 201)
  } catch (error) {
    console.error('[API] /api/admin/api-keys POST error:', error)
    return c.json(
      {
        error: 'Failed to create API key',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// ============================================================================
// GET /api/admin/api-keys - List API Keys for a Repo
// ============================================================================

adminRouter.get('/api-keys', async (c) => {
  try {
    const repoOwner = c.req.query('repo_owner')
    const repoName = c.req.query('repo_name')

    if (!repoOwner || !repoName) {
      return c.json({ error: 'Missing required query params: repo_owner, repo_name' }, 400)
    }

    // Query all API keys for this repo
    const { db } = await import('../services/database.js')
    const result = await db.execute({
      sql: `SELECT key_hash, repo_owner, repo_name, created_by, created_at, expires_at, revoked, last_used_at, description
            FROM api_keys
            WHERE repo_owner = ? AND repo_name = ?
            ORDER BY created_at DESC`,
      args: [repoOwner, repoName],
    })

    const keys = result.rows.map((row: any) => ({
      key_hash: row.key_hash,
      repo_owner: row.repo_owner,
      repo_name: row.repo_name,
      created_by: row.created_by || undefined,
      created_at: new Date(row.created_at).toISOString(),
      expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
      revoked: Boolean(row.revoked),
      last_used_at: row.last_used_at ? new Date(row.last_used_at).toISOString() : undefined,
      description: row.description || undefined,
    }))

    const response: ListApiKeysResponse = { keys }
    return c.json(response, 200)
  } catch (error) {
    console.error('[API] /api/admin/api-keys GET error:', error)
    return c.json(
      {
        error: 'Failed to list API keys',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// ============================================================================
// PATCH /api/admin/api-keys/:hash - Revoke API Key
// ============================================================================

adminRouter.patch('/api-keys/:hash', async (c) => {
  try {
    const keyHash = c.req.param('hash')

    if (!keyHash) {
      return c.json({ error: 'Missing key hash in URL parameter' }, 400)
    }

    // Check if key exists
    const existingKey = await getApiKey(keyHash)

    if (!existingKey) {
      return c.json({ error: 'API key not found' }, 404)
    }

    if (existingKey.revoked) {
      return c.json({ error: 'API key is already revoked' }, 400)
    }

    // Revoke the key
    await revokeApiKey(keyHash)

    return c.json(
      {
        ok: true,
        message: 'API key revoked successfully',
        key_hash: keyHash,
      },
      200
    )
  } catch (error) {
    console.error('[API] /api/admin/api-keys/:hash PATCH error:', error)
    return c.json(
      {
        error: 'Failed to revoke API key',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// ============================================================================
// DELETE /api/admin/api-keys/:hash - Delete API Key (Permanent)
// ============================================================================

adminRouter.delete('/api-keys/:hash', async (c) => {
  try {
    const keyHash = c.req.param('hash')

    if (!keyHash) {
      return c.json({ error: 'Missing key hash in URL parameter' }, 400)
    }

    // Check if key exists
    const existingKey = await getApiKey(keyHash)

    if (!existingKey) {
      return c.json({ error: 'API key not found' }, 404)
    }

    // Delete permanently
    const { db } = await import('../services/database.js')
    await db.execute({
      sql: `DELETE FROM api_keys WHERE key_hash = ?`,
      args: [keyHash],
    })

    return c.json(
      {
        ok: true,
        message: 'API key deleted permanently',
        key_hash: keyHash,
      },
      200
    )
  } catch (error) {
    console.error('[API] /api/admin/api-keys/:hash DELETE error:', error)
    return c.json(
      {
        error: 'Failed to delete API key',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// ============================================================================
// GET /api/admin/stats - Database Statistics
// ============================================================================

adminRouter.get('/stats', async (c) => {
  try {
    const { getStats } = await import('../services/database.js')
    const stats = await getStats()

    return c.json(
      {
        ok: true,
        ...stats,
        timestamp: new Date().toISOString(),
      },
      200
    )
  } catch (error) {
    console.error('[API] /api/admin/stats error:', error)
    return c.json(
      {
        error: 'Failed to get database stats',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})
