// API key authentication middleware for agent reporting endpoints
// Validates API keys, checks expiration, and attaches repo permissions to request

import crypto from 'crypto'
import type { Context, Next } from 'hono'
import { getApiKey, updateApiKeyLastUsed } from '../services/database.js'

// ============================================================================
// Middleware
// ============================================================================

/**
 * Validate API key from Authorization header
 * Attaches repo_owner and repo_name to context if valid
 */
export async function validateApiKey(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const apiKey = authHeader.replace('Bearer ', '').trim()

  if (!apiKey) {
    return c.json({ error: 'API key is empty' }, 401)
  }

  // Compute SHA256 hash of the provided key
  const keyHash = crypto.createHash('sha256').update(apiKey, 'utf8').digest('hex')

  // Look up API key in database
  const apiKeyData = await getApiKey(keyHash)

  if (!apiKeyData) {
    return c.json({ error: 'Invalid API key' }, 401)
  }

  // Check if revoked
  if (apiKeyData.revoked) {
    return c.json({ error: 'API key has been revoked' }, 401)
  }

  // Check expiration
  if (apiKeyData.expires_at && apiKeyData.expires_at < Date.now()) {
    return c.json({ error: 'API key has expired' }, 401)
  }

  // Update last used timestamp (fire and forget)
  updateApiKeyLastUsed(keyHash).catch(err => {
    console.error('[Auth] Failed to update last_used_at:', err)
  })

  // Attach repo permissions to context
  c.set('repo_owner', apiKeyData.repo_owner)
  c.set('repo_name', apiKeyData.repo_name)
  c.set('api_key_hash', keyHash)

  await next()
}

/**
 * Optional: Validate that request body matches API key's repo scope
 * Use this after validateApiKey to ensure request can only modify its own repo
 */
export async function validateRepoScope(c: Context, next: Next) {
  const allowedOwner = c.get('repo_owner')
  const allowedRepo = c.get('repo_name')

  // Get repo from request body
  const body = await c.req.json()
  const requestOwner = body.repo_owner
  const requestRepo = body.repo_name

  if (!requestOwner || !requestRepo) {
    return c.json({ error: 'Missing repo_owner or repo_name in request body' }, 400)
  }

  if (requestOwner !== allowedOwner || requestRepo !== allowedRepo) {
    return c.json(
      {
        error: 'API key is not authorized for this repository',
        allowed: `${allowedOwner}/${allowedRepo}`,
        requested: `${requestOwner}/${requestRepo}`,
      },
      403
    )
  }

  await next()
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a new API key with secure random bytes
 * Format: sk_live_<64 hex chars>
 */
export function generateApiKey(env: 'live' | 'test' = 'live'): string {
  const randomBytes = crypto.randomBytes(32)
  const hexString = randomBytes.toString('hex')
  return `sk_${env}_${hexString}`
}

/**
 * Hash an API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey, 'utf8').digest('hex')
}

/**
 * Verify an API key against its hash
 */
export function verifyApiKey(apiKey: string, hash: string): boolean {
  const computed = hashApiKey(apiKey)
  return computed === hash
}
