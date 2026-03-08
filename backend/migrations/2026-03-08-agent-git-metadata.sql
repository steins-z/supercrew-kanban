-- Migration: Add Agent Git Metadata Columns
-- Date: 2026-03-08
-- Description: Add columns to features table for Agent-reported Git metadata
--              This enables local-only fast path validation and smart sync logic.

-- Add Git metadata columns for Agent-provided information
ALTER TABLE features ADD COLUMN has_upstream BOOLEAN DEFAULT NULL;
ALTER TABLE features ADD COLUMN branch_exists_on_remote BOOLEAN DEFAULT NULL;
ALTER TABLE features ADD COLUMN commits_ahead INTEGER DEFAULT NULL;
ALTER TABLE features ADD COLUMN branch TEXT DEFAULT NULL;

-- Update schema version
INSERT INTO schema_version (version, applied_at, description)
VALUES (3, strftime('%s', 'now') * 1000, 'Add Agent Git metadata columns (has_upstream, branch_exists_on_remote, commits_ahead, branch)')
ON CONFLICT(version) DO NOTHING;

-- Index for fast-path validation queries
CREATE INDEX IF NOT EXISTS idx_features_has_upstream
  ON features(has_upstream)
  WHERE has_upstream = 0;
