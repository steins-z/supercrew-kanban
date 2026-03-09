// Types for multi-branch kanban board API

import type { SupercrewStatus, FeaturePriority } from './shared.js';

// ─── Core Types (Mirror Frontend) ─────────────────────────────────────────

export interface FeatureMeta {
  id: string;
  title: string;
  status: SupercrewStatus;
  owner: string;
  priority: FeaturePriority;
  teams?: string[];
  target_release?: string;
  created: string;
  updated: string;
  tags?: string[];
  blocked_by?: string[];
}

// ─── Multi-Branch Extensions ──────────────────────────────────────────────

export interface BranchInfo {
  branch: string; // Branch name (e.g., "main", "feature/oauth")
  filesHash: string; // MD5 hash of concatenated files
  isDifferent: boolean; // Whether content differs from main branch
  lastCommit?: {
    sha: string;
    date: string;
    author: string;
  };
}

export interface FeatureMetaWithBranches extends FeatureMeta {
  branches: BranchInfo[]; // All branches containing this feature
  primaryBranch: string; // Which branch to use as "source of truth"
}

// ─── API Response ─────────────────────────────────────────────────────────

export interface BranchError {
  branch: string;
  error: string;
  type: 'permission' | 'not_found' | 'network' | 'rate_limit';
}

export interface BoardMetadata {
  scannedBranches: string[];
  totalBranches: number;
  fetchedAt: string; // ISO timestamp
  errors: BranchError[];
}

export interface BoardResponse {
  features: FeatureMetaWithBranches[];
  featuresByStatus: Record<SupercrewStatus, FeatureMetaWithBranches[]>;
  metadata: BoardMetadata;
}

// ─── Internal Types ───────────────────────────────────────────────────────

export interface FileSnapshot {
  branch: string;
  featureId: string;
  files: {
    meta: string | null; // Base64 encoded content
    design: string | null;
    plan: string | null;
  };
}

export interface GitHubRef {
  ref: string; // e.g., "refs/heads/feature/oauth"
  object: {
    sha: string;
    type: string;
  };
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  content?: string; // Base64 encoded
  encoding?: string;
}
