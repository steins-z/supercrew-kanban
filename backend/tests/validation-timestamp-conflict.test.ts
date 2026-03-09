import { describe, test, expect, beforeAll } from 'bun:test'
import { ValidationService } from '../src/services/validation'
import { upsertFeature, getFeature } from '../src/services/database'
import type { FeatureData } from '../src/services/database'

describe('Timestamp conflict resolution', () => {
  beforeAll(() => {
    if (!process.env.GITHUB_TOKEN) {
      console.warn('\n⚠️  Skipping validation-timestamp-conflict tests: GITHUB_TOKEN not set')
      console.warn('   To run these tests: GITHUB_TOKEN=$(gh auth token) bun test\n')
    }
  })

  test.skipIf(!process.env.GITHUB_TOKEN)('keeps Agent data when Agent timestamp is newer', async () => {
    // Agent reports a feature with recent local changes
    const agentTimestamp = Date.now()  // Just now
    const feature: FeatureData = {
      id: 'simplified-status-schema',  // Real feature in repo
      repo_owner: 'steins-z',
      repo_name: 'supercrew-kanban',
      title: 'Test Feature',
      status: 'doing',
      source: 'agent',
      verified: false,
      sync_state: 'pending_verify',
      branch: 'main',
      git_commit_sha: 'agent-sha-123',  // Different from Git
      last_git_commit_at: agentTimestamp,
      has_upstream: true,
      branch_exists_on_remote: true,
      commits_ahead: 0,
      created_at: Date.now() - 60000,
      updated_at: Date.now(),
      progress: 0,
    }

    await upsertFeature(feature)
    const validator = new ValidationService()
    const result = await validator.validateFeature(
      feature.repo_owner,
      feature.repo_name,
      feature.id,
      feature.branch,
      process.env.GITHUB_TOKEN!
    )

    // Agent timestamp is newer than Git, so keep Agent data
    // (Git's timestamp is older since it's from a past commit)
    expect(result.success).toBe(true)

    const updated = await getFeature(feature.repo_owner, feature.repo_name, feature.id)
    expect(updated?.git_commit_sha).toBe('agent-sha-123')  // Kept Agent SHA
    expect(updated?.sync_state).toBe('conflict')  // Marked as conflict
  })

  test.skipIf(!process.env.GITHUB_TOKEN)('updates from Git when Git timestamp is newer', async () => {
    // Agent reports stale data (old timestamp from before the latest Git commit)
    const oldTimestamp = Date.now() - (30 * 24 * 60 * 60 * 1000)  // 30 days ago
    const feature: FeatureData = {
      id: 'simplified-status-schema',
      repo_owner: 'steins-z',
      repo_name: 'supercrew-kanban',
      title: 'Test Feature',
      status: 'doing',
      source: 'agent',
      verified: false,
      sync_state: 'pending_verify',
      branch: 'main',
      git_commit_sha: 'old-agent-sha',
      last_git_commit_at: oldTimestamp,
      has_upstream: true,
      branch_exists_on_remote: true,
      commits_ahead: 0,
      created_at: oldTimestamp,
      updated_at: Date.now(),
      progress: 0,
    }

    await upsertFeature(feature)
    const validator = new ValidationService()
    const result = await validator.validateFeature(
      feature.repo_owner,
      feature.repo_name,
      feature.id,
      feature.branch,
      process.env.GITHUB_TOKEN!
    )

    // Git timestamp is newer, so update from Git
    expect(result.action).toBe('updated_from_git')
    expect(result.success).toBe(true)

    const updated = await getFeature(feature.repo_owner, feature.repo_name, feature.id)
    expect(updated?.git_commit_sha).not.toBe('old-agent-sha')  // Updated to Git SHA
    expect(updated?.sync_state).toBe('synced')
  })
})
