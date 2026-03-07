// Mirror of backend types — keep in sync with backend/src/types/api.ts

export type SupercrewStatus = 'todo' | 'doing' | 'ready-to-ship' | 'shipped'
export type FeaturePriority = 'P0' | 'P1' | 'P2' | 'P3'
export type DesignStatus = 'draft' | 'in-review' | 'approved' | 'rejected'
export type FreshnessIndicator = 'verified' | 'realtime' | 'stale' | 'orphaned'
export type DataSource = 'git' | 'agent' | 'agent_stale' | 'agent_orphaned' | 'database'

export interface FeatureMeta {
  id: string
  title: string
  status: SupercrewStatus
  owner?: string
  priority?: FeaturePriority
  progress?: number
  teams?: string[]
  target_release?: string
  created: string
  updated: string
  tags?: string[]
  blocked_by?: string[]
  // Database integration fields
  source?: DataSource
  verified?: boolean
  verified_at?: string
  git_sha?: string
  freshness?: FreshnessIndicator
  // Multi-branch extensions (optional for backward compatibility)
  branches?: BranchInfo[]
  primaryBranch?: string
}

export interface BranchInfo {
  name?: string
  branch?: string  // Legacy field
  status?: SupercrewStatus
  progress?: number
  verified?: boolean
  updated?: string
  filesHash?: string  // Legacy field
  isDifferent?: boolean  // Legacy field
}

export interface FreshnessMetrics {
  verified_count: number
  realtime_count: number
  stale_count: number
  orphaned_count: number
  total_count: number
  verified_percentage: number
  stale_percentage: number
  should_fallback_to_git: boolean
}

export interface BoardMetadata {
  total_features: number
  last_updated: string
  source: DataSource
  freshness?: FreshnessMetrics
  scannedBranches?: string[]  // For Git-only mode
  totalBranches?: number  // For Git-only mode
  fetchedAt?: string  // For Git-only mode
  errors?: Array<{ branch: string; error: string }>  // For Git-only mode
}

export interface DesignDoc {
  status: DesignStatus
  reviewers: string[]
  approved_by?: string
  body: string
}

export interface PlanDoc {
  total_tasks: number
  completed_tasks: number
  progress: number
  body: string
}

export interface FeatureLog {
  body: string
}

export interface Feature {
  meta: FeatureMeta
  design?: DesignDoc
  plan?: PlanDoc
  log?: FeatureLog
}

export interface FeatureBoard {
  features: FeatureMeta[]
  featuresByStatus: Record<SupercrewStatus, FeatureMeta[]>
  metadata?: BoardMetadata
}

// Database API Response Types
export interface BoardResponse {
  repo_owner: string
  repo_name: string
  features: Record<SupercrewStatus, FeatureMeta[]>
  metadata: BoardMetadata
}

