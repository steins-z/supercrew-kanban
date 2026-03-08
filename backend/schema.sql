-- SuperCrew Kanban Database Schema
-- Database: Turso (libSQL/SQLite)
-- Version: 1.0
-- Created: 2026-03-07

-- ============================================================================
-- Table: features
-- Description: Main feature state storage with verification tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS features (
  -- Identity
  id TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,

  -- Feature metadata
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('todo', 'doing', 'ready-to-ship', 'shipped')),
  owner TEXT,
  priority TEXT CHECK(priority IN ('P0', 'P1', 'P2', 'P3')),
  progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),

  -- Content snapshots (raw file contents)
  meta_yaml TEXT,
  dev_design_md TEXT,
  dev_plan_md TEXT,
  prd_md TEXT,

  -- Verification state
  source TEXT NOT NULL CHECK(source IN ('git', 'agent', 'agent_stale', 'agent_orphaned')),
  verified BOOLEAN DEFAULT 0,
  git_sha TEXT,
  git_etag TEXT,  -- for GitHub API conditional requests (If-None-Match)
  sync_state TEXT CHECK(sync_state IN ('synced', 'pending_verify', 'conflict', 'git_missing', 'error')),
  last_git_checked_at INTEGER,
  last_git_commit_at INTEGER,
  last_db_write_at INTEGER,
  last_sync_error TEXT,

  -- Timestamps (Unix epoch in milliseconds)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  verified_at INTEGER,

  -- Constraints
  PRIMARY KEY (repo_owner, repo_name, id)
);

-- Indexes for features table
CREATE INDEX IF NOT EXISTS idx_features_repo
  ON features(repo_owner, repo_name);

CREATE INDEX IF NOT EXISTS idx_features_status
  ON features(status);

CREATE INDEX IF NOT EXISTS idx_features_verified
  ON features(verified, updated_at);

CREATE INDEX IF NOT EXISTS idx_features_source
  ON features(source);

-- ============================================================================
-- Table: branches
-- Description: Multi-branch support (same feature, different branches)
-- ============================================================================

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  feature_id TEXT NOT NULL,

  -- Branch-specific state
  status TEXT CHECK(status IN ('todo', 'doing', 'ready-to-ship', 'shipped')),
  progress INTEGER CHECK(progress >= 0 AND progress <= 100),
  content_hash TEXT,  -- MD5 hash of meta_yaml + dev_design_md + dev_plan_md

  -- Verification
  verified BOOLEAN DEFAULT 0,
  git_sha TEXT,
  updated_at INTEGER NOT NULL,

  -- Constraints
  UNIQUE(repo_owner, repo_name, branch_name, feature_id)
);

-- Indexes for branches table
CREATE INDEX IF NOT EXISTS idx_branches_feature
  ON branches(feature_id);

CREATE INDEX IF NOT EXISTS idx_branches_repo
  ON branches(repo_owner, repo_name, branch_name);

CREATE INDEX IF NOT EXISTS idx_branches_verified
  ON branches(verified, updated_at);

-- ============================================================================
-- Table: validation_queue
-- Description: Pending validation jobs for background worker
-- ============================================================================

CREATE TABLE IF NOT EXISTS validation_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  branch_name TEXT,  -- NULL = validate main branch

  -- Priority and retry management
  priority INTEGER DEFAULT 0,  -- higher = validate sooner
  created_at INTEGER NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  last_attempt_at INTEGER,

  -- Constraints (prevent duplicate validation jobs)
  UNIQUE(repo_owner, repo_name, feature_id, branch_name)
);

-- Indexes for validation_queue table
CREATE INDEX IF NOT EXISTS idx_queue_priority
  ON validation_queue(priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_queue_attempts
  ON validation_queue(attempts, last_attempt_at);

-- ============================================================================
-- Table: api_keys
-- Description: Authentication for agent reporting APIs
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  key_hash TEXT PRIMARY KEY,  -- SHA256 hash of the actual API key
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  created_by TEXT,  -- username of creator
  created_at INTEGER NOT NULL,
  expires_at INTEGER,  -- NULL = never expires
  revoked BOOLEAN DEFAULT 0,
  last_used_at INTEGER,

  -- Metadata
  description TEXT,  -- optional note about this key's purpose

  -- Constraints (one key per repo)
  UNIQUE(repo_owner, repo_name, key_hash)
);

-- Indexes for api_keys table
CREATE INDEX IF NOT EXISTS idx_apikeys_repo
  ON api_keys(repo_owner, repo_name);

CREATE INDEX IF NOT EXISTS idx_apikeys_active
  ON api_keys(revoked, expires_at);

-- ============================================================================
-- Views (optional, for convenience)
-- ============================================================================

-- View: Active features with freshness indicators
CREATE VIEW IF NOT EXISTS active_features AS
SELECT
  f.*,
  CASE
    WHEN f.verified = 1 THEN 'verified'
    WHEN f.source = 'agent' AND (strftime('%s', 'now') * 1000 - f.updated_at) < 300000 THEN 'realtime'
    WHEN f.source = 'agent' AND (strftime('%s', 'now') * 1000 - f.verified_at) > 300000 THEN 'stale'
    WHEN f.source = 'agent_orphaned' THEN 'orphaned'
    ELSE 'realtime'
  END as freshness,
  (strftime('%s', 'now') * 1000 - f.updated_at) / 1000 as age_seconds
FROM features f
WHERE f.status != 'shipped'
ORDER BY f.updated_at DESC;

-- View: Validation queue with age
CREATE VIEW IF NOT EXISTS queue_status AS
SELECT
  q.*,
  (strftime('%s', 'now') * 1000 - q.created_at) / 1000 as queue_age_seconds
FROM validation_queue q
ORDER BY q.priority DESC, q.created_at ASC;

-- ============================================================================
-- Schema Version Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  description TEXT
);

INSERT INTO schema_version (version, applied_at, description)
VALUES (1, strftime('%s', 'now') * 1000, 'Initial schema: features, branches, validation_queue, api_keys');

-- ============================================================================
-- End of schema
-- ============================================================================
