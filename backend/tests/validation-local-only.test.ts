import { describe, test, expect, beforeEach } from 'bun:test'
import { ValidationService } from '../src/services/validation'
import { upsertFeature, getFeature } from '../src/services/database'
import type { FeatureData } from '../src/services/database'

describe('Local-only fast path', () => {
  test('skips GitHub API validation when has_upstream = false', async () => {
    const feature: FeatureData = {
      id: 'test-feature-local',
      repo_owner: 'steins-z',
      repo_name: 'supercrew-kanban',
      title: 'Test Feature Local',
      status: 'doing',
      source: 'agent',
      verified: false,
      sync_state: 'pending_verify',
      git_commit_sha: 'abc123',
      last_git_commit_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
      // Agent metadata indicating local-only branch
      branch: 'user/qunmi/test-feature-local',
      // This would come from Agent's GitMetadata
      has_upstream: false,  // KEY: No remote tracking
    }

    // Insert feature into database first
    await upsertFeature(feature)

    // Verify it was inserted
    const inserted = await getFeature(feature.repo_owner, feature.repo_name, feature.id)
    expect(inserted).not.toBeNull()
    // SQLite stores booleans as 0/1, so we need to check for both false and 0
    expect(inserted?.has_upstream).toBe(0)

    const validator = new ValidationService()
    const result = await validator.validateFeature(
      feature.repo_owner,
      feature.repo_name,
      feature.id,
      feature.branch || 'main',
      'fake-token'
    )

    // Should NOT call GitHub API, should mark as local_only
    expect(result.success).toBe(true)
    expect(result.action).toBe('local_only')

    // Verify database was updated
    const updated = await getFeature(feature.repo_owner, feature.repo_name, feature.id)
    expect(updated?.sync_state).toBe('local_only')
    expect(updated?.source).toBe('agent')
    // SQLite stores booleans as 0/1
    expect(updated?.verified).toBe(0)
  })

  test('continues normal validation when has_upstream = true', async () => {
    const feature: FeatureData = {
      id: 'test-feature-upstream',
      repo_owner: 'steins-z',
      repo_name: 'supercrew-kanban',
      title: 'Test Feature Upstream',
      status: 'doing',
      source: 'agent',
      verified: false,
      sync_state: 'pending_verify',
      git_commit_sha: 'abc123',
      last_git_commit_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
      branch: 'user/qunmi/test-feature-upstream',
      has_upstream: true,  // Has remote tracking
    }

    // Insert feature into database first
    await upsertFeature(feature)

    const validator = new ValidationService()
    const result = await validator.validateFeature(
      feature.repo_owner,
      feature.repo_name,
      feature.id,
      feature.branch || 'main',
      process.env.GITHUB_TOKEN!
    )

    // Should call GitHub API and validate (will fail because it doesn't exist)
    // But action should NOT be 'local_only'
    expect(result.action).not.toBe('local_only')
  })
})
