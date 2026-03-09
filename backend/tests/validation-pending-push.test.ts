import { describe, test, expect, beforeAll } from 'bun:test'
import { ValidationService } from '../src/services/validation'
import { upsertFeature, getFeature } from '../src/services/database'
import type { FeatureData } from '../src/services/database'

/**
 * Tests for pending push handling logic
 *
 * NOTE: These tests require a valid GITHUB_TOKEN to call the GitHub API.
 * Set GITHUB_TOKEN in your environment or use: GITHUB_TOKEN=$(gh auth token) bun test
 *
 * The tests verify smart 404 handling:
 * - When branch 404 + commits_ahead > 0 → pending_push (not yet pushed)
 * - When branch 404 + commits_ahead = 0 → orphaned (deleted)
 */
describe('Pending push handling', () => {
  beforeAll(() => {
    if (!process.env.GITHUB_TOKEN) {
      console.warn('\n⚠️  Skipping validation-pending-push tests: GITHUB_TOKEN not set')
      console.warn('   To run these tests: GITHUB_TOKEN=$(gh auth token) bun test\n')
    }
  })

  test.skipIf(!process.env.GITHUB_TOKEN)('marks as pending_push when branch 404 but commits_ahead > 0', async () => {
    const feature: FeatureData = {
      id: 'test-feature-pending',
      repo_owner: 'steins-z',
      repo_name: 'supercrew-kanban',
      title: 'Test Feature',
      status: 'doing',
      source: 'agent',
      verified: false,
      sync_state: 'pending_verify',
      git_commit_sha: 'abc123',
      last_git_commit_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
      branch: 'user/qunmi/non-existent-branch-xyz',
      has_upstream: true,               // Has upstream tracking
      branch_exists_on_remote: false,   // But not on remote yet
      commits_ahead: 3,                 // Has unpushed commits
      progress: 0,
    }

    // Insert feature into database first
    await upsertFeature(feature)

    const validator = new ValidationService()
    // This will call GitHub API and get 404, then check commits_ahead
    const result = await validator.validateFeature(
      feature.repo_owner,
      feature.repo_name,
      feature.id,
      feature.branch,
      process.env.GITHUB_TOKEN!
    )

    // Should NOT mark as orphaned, should mark as pending_push
    expect(result.action).toBe('pending_push')
    expect(result.success).toBe(true)

    // Verify database was updated
    const updated = await getFeature(feature.repo_owner, feature.repo_name, feature.id)
    expect(updated?.sync_state).toBe('pending_push')
    expect(updated?.source).toBe('agent')
  })

  test.skipIf(!process.env.GITHUB_TOKEN)('marks as orphaned when branch 404 and commits_ahead = 0', async () => {
    const feature: FeatureData = {
      id: 'test-feature-deleted',
      repo_owner: 'steins-z',
      repo_name: 'supercrew-kanban',
      title: 'Test Feature',
      status: 'doing',
      source: 'agent',
      verified: false,
      sync_state: 'pending_verify',
      git_commit_sha: 'abc123',
      last_git_commit_at: Date.now(),
      created_at: Date.now() - 15 * 60 * 1000, // Old enough to skip grace period
      updated_at: Date.now(),
      branch: 'user/qunmi/non-existent-branch-xyz',
      has_upstream: true,
      branch_exists_on_remote: false,
      commits_ahead: 0,                 // No unpushed commits = deleted
      progress: 0,
    }

    // Insert feature into database first
    await upsertFeature(feature)

    const validator = new ValidationService()
    const result = await validator.validateFeature(
      feature.repo_owner,
      feature.repo_name,
      feature.id,
      feature.branch,
      process.env.GITHUB_TOKEN!
    )

    // Should mark as deleted (orphaned)
    expect(result.action).toBe('orphaned')
    expect(result.success).toBe(true)

    // Verify database was updated
    const updated = await getFeature(feature.repo_owner, feature.repo_name, feature.id)
    expect(updated?.sync_state).toBe('git_missing')
    expect(updated?.source).toBe('agent_orphaned')
  })
})
