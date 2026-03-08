-- Migration: add sync state fields and queue idempotency
-- Date: 2026-03-07

ALTER TABLE features ADD COLUMN sync_state TEXT CHECK(sync_state IN ('synced', 'pending_verify', 'conflict', 'git_missing', 'error'));
ALTER TABLE features ADD COLUMN last_git_checked_at INTEGER;
ALTER TABLE features ADD COLUMN last_git_commit_at INTEGER;
ALTER TABLE features ADD COLUMN last_db_write_at INTEGER;
ALTER TABLE features ADD COLUMN last_sync_error TEXT;

ALTER TABLE validation_queue ADD COLUMN last_attempt_at INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS uq_validation_queue_feature
  ON validation_queue(repo_owner, repo_name, feature_id, branch_name);
