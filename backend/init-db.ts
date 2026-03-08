#!/usr/bin/env bun
// Initialize Turso database with schema

import { createClient } from '@libsql/client'

const db = createClient({
  url: 'http://127.0.0.1:8080',
  authToken: 'dev-token',
})

const schema = `
-- Features table (main kanban cards)
CREATE TABLE IF NOT EXISTS features (
  id TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('todo', 'doing', 'ready-to-ship', 'shipped')),
  owner TEXT,
  priority TEXT,
  progress INTEGER DEFAULT 0,
  source TEXT NOT NULL CHECK(source IN ('git', 'agent', 'agent_verified', 'agent_stale', 'agent_orphaned')),
  verified BOOLEAN DEFAULT 0,
  meta_yaml TEXT,
  dev_design_md TEXT,
  dev_plan_md TEXT,
  prd_md TEXT,
  git_sha TEXT,
  git_etag TEXT,
  sync_state TEXT CHECK(sync_state IN ('synced', 'pending_verify', 'conflict', 'git_missing', 'error')),
  last_git_checked_at INTEGER,
  last_git_commit_at INTEGER,
  last_db_write_at INTEGER,
  last_sync_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  verified_at INTEGER,
  PRIMARY KEY (repo_owner, repo_name, id)
);

-- Branches table (track feature status across branches)
CREATE TABLE IF NOT EXISTS branches (
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  status TEXT,
  progress INTEGER DEFAULT 0,
  content_hash TEXT,
  verified BOOLEAN DEFAULT 0,
  git_sha TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (repo_owner, repo_name, branch_name, feature_id),
  FOREIGN KEY (repo_owner, repo_name, feature_id)
    REFERENCES features(repo_owner, repo_name, id) ON DELETE CASCADE
);

-- Validation queue (background job queue)
CREATE TABLE IF NOT EXISTS validation_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  branch_name TEXT,
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  last_attempt_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(repo_owner, repo_name, feature_id, branch_name)
);

-- API keys table (for agent authentication)
CREATE TABLE IF NOT EXISTS api_keys (
  key_hash TEXT PRIMARY KEY,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked BOOLEAN DEFAULT 0,
  last_used_at INTEGER,
  description TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_features_repo ON features(repo_owner, repo_name);
CREATE INDEX IF NOT EXISTS idx_features_status ON features(status);
CREATE INDEX IF NOT EXISTS idx_features_verified ON features(verified);
CREATE INDEX IF NOT EXISTS idx_branches_repo ON branches(repo_owner, repo_name);
CREATE INDEX IF NOT EXISTS idx_validation_priority ON validation_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_api_keys_repo ON api_keys(repo_owner, repo_name);
`

try {
  // Execute schema
  const statements = schema.split(';').filter(s => s.trim())
  for (const stmt of statements) {
    if (stmt.trim()) {
      await db.execute(stmt)
    }
  }

  console.log('✅ Database schema applied successfully!')

  // Verify tables exist
  const result = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )

  console.log('\n📋 Tables created:')
  for (const row of result.rows) {
    console.log(`  - ${row.name}`)
  }

} catch (error) {
  console.error('❌ Error applying schema:', error)
  process.exit(1)
}
