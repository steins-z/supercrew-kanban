// API request/response type definitions
// Shared types for agent reporting and board reading APIs

import type { SupercrewStatus } from './shared.js'

// ============================================================================
// Agent Reporting API Types
// ============================================================================

/**
 * Request body for POST /api/features/report
 */
export interface FeatureReportRequest {
  repo_owner: string
  repo_name: string
  feature_id: string
  branch?: string  // optional, null = main branch
  data: {
    status: SupercrewStatus
    progress?: number
    owner?: string
    priority?: string
    meta_yaml?: string
    dev_design_md?: string
    dev_plan_md?: string
    prd_md?: string
  }

  // New: Git metadata from Agent
  git_metadata?: GitMetadata  // Optional for backward compatibility
}

/**
 * Response for POST /api/features/report
 */
export interface FeatureReportResponse {
  ok: boolean
  feature_id: string
  source: 'agent' | 'git'
  verified: boolean
  queued_for_validation: boolean
  message?: string
}

/**
 * Request body for POST /api/features/batch
 */
export interface BatchReportRequest {
  repo_owner: string
  repo_name: string
  features: Array<{
    feature_id: string
    branch?: string
    data: FeatureReportRequest['data']
    git_metadata?: GitMetadata
  }>
}

/**
 * Response for POST /api/features/batch
 */
export interface BatchReportResponse {
  ok: boolean
  results: Array<{
    feature_id: string
    status: 'updated' | 'failed'
    error?: string
  }>
  queued_for_validation: number
}

/**
 * Git metadata provided by Agent for smart validation
 */
export interface GitMetadata {
  // Last commit SHA that modified meta.yaml
  last_commit_sha: string

  // Commit timestamp (Unix seconds)
  last_commit_timestamp: number

  // Whether branch has remote tracking configured
  has_upstream: boolean

  // Whether branch exists on remote
  branch_exists_on_remote: boolean

  // How many commits ahead of remote (null if no upstream)
  commits_ahead?: number | null
}

// ============================================================================
// Board Reading API Types
// ============================================================================

/**
 * Feature metadata with verification state
 */
export interface FeatureMetaWithBranches {
  // Core metadata
  id: string
  title: string
  status: SupercrewStatus
  owner?: string
  priority?: string
  progress: number

  // Verification state
  verified: boolean
  source: 'git' | 'agent' | 'agent_stale' | 'agent_orphaned'
  freshness: 'verified' | 'realtime' | 'stale' | 'orphaned'
  sync_state?: 'synced' | 'pending_verify' | 'conflict' | 'git_missing' | 'error'
  updated_at: string  // ISO 8601
  verified_at?: string  // ISO 8601
  git_sha?: string

  // Multi-branch support
  branches?: BranchInfo[]
  primaryBranch?: string
}

/**
 * Branch information for multi-branch kanban
 */
export interface BranchInfo {
  name: string
  status?: SupercrewStatus
  progress?: number
  verified: boolean
  updated_at: string
}

/**
 * Board metadata
 */
export interface BoardMetadata {
  source: 'database' | 'git' | 'hybrid'
  unverified_count: number
  last_git_sync: string  // ISO 8601
  total_features: number
  queue_length?: number
  scanned_branches?: string[]
  errors?: Array<{
    branch: string
    error: string
    type: 'network' | 'permission' | 'not_found' | 'rate_limit'
  }>
}

/**
 * Response for GET /api/board
 */
export interface BoardResponse {
  features: FeatureMetaWithBranches[]
  featuresByStatus: Record<SupercrewStatus, FeatureMetaWithBranches[]>
  metadata: BoardMetadata
}

/**
 * Response for GET /api/features/:id
 */
export interface FeatureDetailResponse {
  id: string
  meta: {
    title: string
    status: SupercrewStatus
    owner?: string
    priority?: string
    progress: number
    created: string
    updated: string
  }
  design?: {
    status: string
    reviewers: string[]
    body: string
  }
  plan?: {
    total_tasks: number
    completed_tasks: number
    progress: number
    body: string
  }
  prd?: {
    body: string
  }
  // Verification info
  verified: boolean
  source: 'git' | 'agent' | 'agent_stale' | 'agent_orphaned'
  sync_state?: 'synced' | 'pending_verify' | 'conflict' | 'git_missing' | 'error'
  git_sha?: string
  updated_at: string
  verified_at?: string
}

// ============================================================================
// Validation & Sync API Types
// ============================================================================

/**
 * Request body for POST /api/sync/validate
 */
export interface ValidateRequest {
  repo_owner: string
  repo_name: string
  feature_id?: string  // optional, null = validate all
  branch?: string
  force?: boolean  // skip queue, validate immediately
}

/**
 * Response for POST /api/sync/validate
 */
export interface ValidateResponse {
  ok: boolean
  queued: number
  message: string
}

/**
 * Response for GET /api/sync/status
 */
export interface ValidationStatusResponse {
  queue_length: number
  processing: boolean
  last_validation?: string  // ISO 8601
  pending: Array<{
    feature_id: string
    branch?: string
    attempts: number
    created_at: string
    last_error?: string
  }>
}

// ============================================================================
// Admin API Types
// ============================================================================

/**
 * Request body for POST /api/admin/api-keys
 */
export interface CreateApiKeyRequest {
  repo_owner: string
  repo_name: string
  created_by?: string
  expires_in_days?: number
  description?: string
}

/**
 * Response for POST /api/admin/api-keys
 */
export interface CreateApiKeyResponse {
  ok: boolean
  api_key: string  // Only shown once!
  key_hash: string
  expires_at?: string  // ISO 8601
  message: string
}

/**
 * Response for GET /api/admin/api-keys
 */
export interface ListApiKeysResponse {
  keys: Array<{
    key_hash: string
    repo_owner: string
    repo_name: string
    created_by?: string
    created_at: string
    expires_at?: string
    revoked: boolean
    last_used_at?: string
    description?: string
  }>
}

// ============================================================================
// Error Response Types
// ============================================================================

/**
 * Standard error response
 */
export interface ErrorResponse {
  error: string
  details?: string
  code?: string
}

// ============================================================================
// Internal Validation Types
// ============================================================================

/**
 * Comparison result from Git vs DB validation
 */
export interface ComparisonResult {
  identical: boolean
  gitIsNewer?: boolean
  agentIsNewer?: boolean
  timeDiff?: number  // milliseconds
  gitHash?: string
  dbHash?: string
}

/**
 * File snapshot from Git API
 */
export interface GitFileSnapshot {
  meta_yaml: string | null
  dev_design_md: string | null
  dev_plan_md: string | null
  prd_md: string | null
  sha: string
  etag?: string
  updated_at: number  // Unix timestamp ms
}

export type GitFeatureFetchErrorType = 'transient_error' | 'auth_error' | 'unknown_error'

export type GitFeatureFetchResult =
  | { kind: 'snapshot'; data: GitFileSnapshot }
  | { kind: 'not_found' }
  | { kind: 'not_modified'; etag?: string }
  | { kind: GitFeatureFetchErrorType; error: string }

/**
 * Validation job result
 */
export interface ValidationResult {
  feature_id: string
  branch?: string
  success: boolean
  action: 'verified' | 'updated_from_git' | 'retry' | 'orphaned' | 'failed' | 'local_only'
  error?: string
}
