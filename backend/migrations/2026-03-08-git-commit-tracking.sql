-- Migration: Add git commit tracking fields
-- Date: 2026-03-08
-- Description: Adds git_commit_sha column and updates sync_state/source constraints
--              to support local dev validation logic

-- SQLite doesn't support ALTER COLUMN for CHECK constraints, so we recreate the table
-- This also adds the new git_commit_sha column

-- Create temp table with updated schema
CREATE TABLE features_new (
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

  -- Content snapshots
  meta_yaml TEXT,
  dev_design_md TEXT,
  dev_plan_md TEXT,
  prd_md TEXT,

  -- Verification state
  source TEXT NOT NULL CHECK(source IN ('git', 'agent', 'agent_verified', 'agent_stale', 'agent_orphaned')),
  verified BOOLEAN DEFAULT 0,
  git_sha TEXT,
  git_etag TEXT,
  sync_state TEXT CHECK(sync_state IN ('local_only', 'pending_push', 'pending_verify', 'synced', 'conflict', 'error', 'git_missing')),
  git_commit_sha TEXT,
  last_git_checked_at INTEGER,
  last_git_commit_at INTEGER,
  last_db_write_at INTEGER,
  last_sync_error TEXT,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  verified_at INTEGER,

  PRIMARY KEY (repo_owner, repo_name, id)
);

-- Copy data from old table
INSERT INTO features_new SELECT
  id, repo_owner, repo_name,
  title, status, owner, priority, progress,
  meta_yaml, dev_design_md, dev_plan_md, prd_md,
  source, verified, git_sha, git_etag, sync_state,
  NULL as git_commit_sha,  -- New column, initialize to NULL
  last_git_checked_at, last_git_commit_at, last_db_write_at, last_sync_error,
  created_at, updated_at, verified_at
FROM features;

-- Drop old table
DROP TABLE features;

-- Rename new table
ALTER TABLE features_new RENAME TO features;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_features_repo
  ON features(repo_owner, repo_name);

CREATE INDEX IF NOT EXISTS idx_features_status
  ON features(status);

CREATE INDEX IF NOT EXISTS idx_features_verified
  ON features(verified, updated_at);

CREATE INDEX IF NOT EXISTS idx_features_source
  ON features(source);

-- Update schema version
INSERT INTO schema_version (version, applied_at, description)
VALUES (2, strftime('%s', 'now') * 1000, 'Add git_commit_sha column and update sync_state/source constraints for local dev validation');
