// Mirror of backend types — keep in sync with kanban/backend/src/types/index.ts

export type SupercrewStatus = 'todo' | 'doing' | 'ready-to-ship' | 'shipped';
export type FeaturePriority = 'P0' | 'P1' | 'P2' | 'P3';
export type DesignStatus = 'draft' | 'in-review' | 'approved' | 'rejected';

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
  // Multi-branch extensions (optional for backward compatibility)
  branches?: BranchInfo[];
  primaryBranch?: string;
}

export interface BranchInfo {
  branch: string;
  filesHash: string;
  isDifferent: boolean;
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
  // Multi-branch extensions (optional for backward compatibility)
  branches?: BranchInfo[];
  primaryBranch?: string;
}

export interface BranchInfo {
  branch: string;
  filesHash: string;
  isDifferent: boolean;
}

export interface DesignDoc {
  status: DesignStatus;
  reviewers: string[];
  approved_by?: string;
  body: string;
  status: DesignStatus;
  reviewers: string[];
  approved_by?: string;
  body: string;
}

export interface PlanDoc {
  total_tasks: number;
  completed_tasks: number;
  progress: number;
  body: string;
  total_tasks: number;
  completed_tasks: number;
  progress: number;
  body: string;
}

export interface FeatureLog {
  body: string;
  body: string;
}

export interface Feature {
  meta: FeatureMeta;
  design?: DesignDoc;
  plan?: PlanDoc;
  log?: FeatureLog;
  meta: FeatureMeta;
  design?: DesignDoc;
  plan?: PlanDoc;
  log?: FeatureLog;
}

export interface FeatureBoard {
  features: FeatureMeta[];
  featuresByStatus: Record<SupercrewStatus, FeatureMeta[]>;
  features: FeatureMeta[];
  featuresByStatus: Record<SupercrewStatus, FeatureMeta[]>;
}

// ─── Repository Switcher Types ────────────────────────────────────────

export interface RepoInfo {
  owner: string;
  repo: string;
  lastAccessed: string; // ISO 8601 timestamp
  displayName?: string; // Optional custom name
}

export interface RepoStorage {
  currentRepo: string; // "owner/repo" format
  recentRepos: RepoInfo[]; // Max 10 items
}

export type RepoIdentifier = `${string}/${string}`; // "owner/repo" format
