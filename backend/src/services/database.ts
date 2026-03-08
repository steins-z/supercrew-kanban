// Database client wrapper for Turso (libSQL)
// Provides helper functions for common database operations

import { createClient, type Client } from '@libsql/client'

// ============================================================================
// Client Initialization
// ============================================================================

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoToken = process.env.TURSO_AUTH_TOKEN

if (!tursoUrl || !tursoToken) {
  throw new Error(
    'Missing required environment variables: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN'
  )
}

export const db: Client = createClient({
  url: tursoUrl,
  authToken: tursoToken,
})

// ============================================================================
// Type Definitions
// ============================================================================

export type SyncState =
  | 'local_only'       // Agent data, has_upstream = false (no validation needed)
  | 'pending_push'     // Agent data, branch not on remote yet (commits_ahead > 0)
  | 'pending_verify'   // Agent data, awaiting validation
  | 'synced'           // Validated and matches Git
  | 'conflict'         // SHA differs, timestamp comparison needed
  | 'error'            // Validation failed (GitHub API error, etc.)
  | 'git_missing'      // Branch deleted on remote

export interface FeatureData {
  id: string
  repo_owner: string
  repo_name: string
  title: string
  status: 'todo' | 'doing' | 'ready-to-ship' | 'shipped'
  owner?: string
  priority?: string
  progress?: number
  meta_yaml?: string
  dev_design_md?: string
  dev_plan_md?: string
  prd_md?: string
  source: 'git' | 'agent' | 'agent_verified' | 'agent_stale' | 'agent_orphaned'
  verified: boolean

  /**
   * GitHub API blob SHA for the meta.yaml file.
   * Used for ETag-based caching and detecting content changes.
   */
  git_sha?: string

  /** For GitHub API conditional requests (If-None-Match) */
  git_etag?: string

  sync_state?: SyncState
  last_git_checked_at?: number
  last_git_commit_at?: number
  last_db_write_at?: number
  last_sync_error?: string
  created_at: number
  updated_at: number
  verified_at?: number

  /**
   * SHA of the last Git commit that modified this feature's files.
   * Used for commit-level validation and conflict detection.
   * Populated by Agent git_metadata or fetched via Commits API.
   */
  git_commit_sha?: string | null
}

export interface BranchData {
  repo_owner: string
  repo_name: string
  branch_name: string
  feature_id: string
  status?: string
  progress?: number
  content_hash?: string
  verified: boolean
  git_sha?: string
  updated_at: number
}

export interface ValidationJob {
  repo_owner: string
  repo_name: string
  feature_id: string
  branch_name?: string
  priority?: number
}

export interface ApiKeyData {
  key_hash: string
  repo_owner: string
  repo_name: string
  created_by?: string
  created_at: number
  expires_at?: number
  revoked?: boolean
  last_used_at?: number
  description?: string
}

// ============================================================================
// Features Table Operations
// ============================================================================

/**
 * Get all features for a repository
 */
export async function getFeatures(
  repoOwner: string,
  repoName: string
): Promise<FeatureData[]> {
  const result = await db.execute({
    sql: `SELECT * FROM features
          WHERE repo_owner = ? AND repo_name = ?
          ORDER BY updated_at DESC`,
    args: [repoOwner, repoName],
  })

  return result.rows as unknown as FeatureData[]
}

/**
 * Get a single feature by ID
 */
export async function getFeature(
  repoOwner: string,
  repoName: string,
  featureId: string
): Promise<FeatureData | null> {
  const result = await db.execute({
    sql: `SELECT * FROM features
          WHERE repo_owner = ? AND repo_name = ? AND id = ?`,
    args: [repoOwner, repoName, featureId],
  })

  return (result.rows[0] as unknown as FeatureData) || null
}

/**
 * Insert or update a feature (upsert)
 */
export async function upsertFeature(data: FeatureData): Promise<void> {
  await db.execute({
    sql: `INSERT INTO features (
      id, repo_owner, repo_name, title, status, owner, priority, progress,
      meta_yaml, dev_design_md, dev_plan_md, prd_md,
      source, verified, git_sha, git_etag, sync_state,
      last_git_checked_at, last_git_commit_at, last_db_write_at, last_sync_error,
      created_at, updated_at, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(repo_owner, repo_name, id) DO UPDATE SET
      title = excluded.title,
      status = excluded.status,
      owner = excluded.owner,
      priority = excluded.priority,
      progress = excluded.progress,
      meta_yaml = excluded.meta_yaml,
      dev_design_md = excluded.dev_design_md,
      dev_plan_md = excluded.dev_plan_md,
      prd_md = excluded.prd_md,
      source = excluded.source,
      verified = excluded.verified,
      git_sha = excluded.git_sha,
      git_etag = excluded.git_etag,
      sync_state = excluded.sync_state,
      last_git_checked_at = excluded.last_git_checked_at,
      last_git_commit_at = excluded.last_git_commit_at,
      last_db_write_at = excluded.last_db_write_at,
      last_sync_error = excluded.last_sync_error,
      updated_at = excluded.updated_at,
      verified_at = excluded.verified_at`,
    args: [
      data.id,
      data.repo_owner,
      data.repo_name,
      data.title,
      data.status,
      data.owner || null,
      data.priority || null,
      data.progress || 0,
      data.meta_yaml || null,
      data.dev_design_md || null,
      data.dev_plan_md || null,
      data.prd_md || null,
      data.source,
      data.verified ? 1 : 0,
      data.git_sha || null,
      data.git_etag || null,
      data.sync_state || null,
      data.last_git_checked_at || null,
      data.last_git_commit_at || null,
      data.last_db_write_at || null,
      data.last_sync_error || null,
      data.created_at,
      data.updated_at,
      data.verified_at || null,
    ],
  })
}

/**
 * Mark a feature as verified
 */
export async function markFeatureVerified(
  repoOwner: string,
  repoName: string,
  featureId: string,
  gitSha?: string
): Promise<void> {
  await db.execute({
    sql: `UPDATE features
          SET verified = 1, verified_at = ?, git_sha = ?,
              sync_state = 'synced', last_git_checked_at = ?, last_sync_error = NULL
          WHERE repo_owner = ? AND repo_name = ? AND id = ?`,
    args: [Date.now(), gitSha || null, Date.now(), repoOwner, repoName, featureId],
  })
}

// ============================================================================
// Branches Table Operations
// ============================================================================

/**
 * Get all branches for a feature
 */
export async function getBranches(featureId: string): Promise<BranchData[]> {
  const result = await db.execute({
    sql: `SELECT * FROM branches WHERE feature_id = ? ORDER BY updated_at DESC`,
    args: [featureId],
  })

  return result.rows as unknown as BranchData[]
}

/**
 * Upsert branch data
 */
export async function upsertBranch(data: BranchData): Promise<void> {
  await db.execute({
    sql: `INSERT INTO branches (
      repo_owner, repo_name, branch_name, feature_id,
      status, progress, content_hash, verified, git_sha, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(repo_owner, repo_name, branch_name, feature_id) DO UPDATE SET
      status = excluded.status,
      progress = excluded.progress,
      content_hash = excluded.content_hash,
      verified = excluded.verified,
      git_sha = excluded.git_sha,
      updated_at = excluded.updated_at`,
    args: [
      data.repo_owner,
      data.repo_name,
      data.branch_name,
      data.feature_id,
      data.status || null,
      data.progress || null,
      data.content_hash || null,
      data.verified ? 1 : 0,
      data.git_sha || null,
      data.updated_at,
    ],
  })
}

// ============================================================================
// Validation Queue Operations
// ============================================================================

/**
 * Add a validation job to the queue
 */
export async function queueValidation(job: ValidationJob): Promise<void> {
  await db.execute({
    sql: `INSERT OR IGNORE INTO validation_queue
          (repo_owner, repo_name, feature_id, branch_name, priority, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      job.repo_owner,
      job.repo_name,
      job.feature_id,
      job.branch_name || null,
      job.priority || 0,
      Date.now(),
    ],
  })
}

/**
 * Get next batch of validation jobs from queue
 */
export async function getValidationQueue(limit: number = 10) {
  const result = await db.execute({
    sql: `SELECT * FROM validation_queue
          ORDER BY priority DESC, created_at ASC
          LIMIT ?`,
    args: [limit],
  })

  return result.rows
}

/**
 * Delete a validation job from queue
 */
export async function deleteValidationJob(jobId: number): Promise<void> {
  await db.execute({
    sql: `DELETE FROM validation_queue WHERE id = ?`,
    args: [jobId],
  })
}

/**
 * Increment validation job attempts
 */
export async function incrementValidationAttempts(
  jobId: number,
  errorMessage?: string
): Promise<void> {
  await db.execute({
    sql: `UPDATE validation_queue
          SET attempts = attempts + 1,
              last_error = ?,
              last_attempt_at = ?
          WHERE id = ?`,
    args: [errorMessage || null, Date.now(), jobId],
  })
}

// ============================================================================
// API Keys Operations
// ============================================================================

/**
 * Get API key by hash
 */
export async function getApiKey(keyHash: string): Promise<ApiKeyData | null> {
  const result = await db.execute({
    sql: `SELECT * FROM api_keys WHERE key_hash = ?`,
    args: [keyHash],
  })

  return (result.rows[0] as unknown as ApiKeyData) || null
}

/**
 * Create a new API key
 */
export async function createApiKey(data: ApiKeyData): Promise<void> {
  await db.execute({
    sql: `INSERT INTO api_keys (
      key_hash, repo_owner, repo_name, created_by, created_at, expires_at, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.key_hash,
      data.repo_owner,
      data.repo_name,
      data.created_by || null,
      data.created_at,
      data.expires_at || null,
      data.description || null,
    ],
  })
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyHash: string): Promise<void> {
  await db.execute({
    sql: `UPDATE api_keys SET revoked = 1 WHERE key_hash = ?`,
    args: [keyHash],
  })
}

/**
 * Update API key last used timestamp
 */
export async function updateApiKeyLastUsed(keyHash: string): Promise<void> {
  await db.execute({
    sql: `UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?`,
    args: [Date.now(), keyHash],
  })
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check database connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await db.execute({ sql: 'SELECT 1', args: [] })
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

/**
 * Get database statistics
 */
export async function getStats() {
  const [featuresCount, branchesCount, queueLength] = await Promise.all([
    db.execute({ sql: 'SELECT COUNT(*) as count FROM features', args: [] }),
    db.execute({ sql: 'SELECT COUNT(*) as count FROM branches', args: [] }),
    db.execute({ sql: 'SELECT COUNT(*) as count FROM validation_queue', args: [] }),
  ])

  return {
    total_features: (featuresCount.rows[0] as any).count,
    total_branches: (branchesCount.rows[0] as any).count,
    queue_length: (queueLength.rows[0] as any).count,
  }
}
