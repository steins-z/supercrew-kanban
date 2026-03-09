import { describe, test, expect, beforeAll } from 'bun:test'
import { ValidationService } from '../src/services/validation'
import { upsertFeature, getFeature } from '../src/services/database'
import type { FeatureData } from '../src/services/database'

describe('E2E: Local dev workflow', () => {
  beforeAll(() => {
    if (!process.env.GITHUB_TOKEN) {
      console.warn('\n⚠️  Skipping E2E tests: GITHUB_TOKEN not set\n')
    }
  })

  test.skipIf(!process.env.GITHUB_TOKEN)('complete local dev workflow', async () => {
    const validator = new ValidationService()

    // Step 1: Agent reports new feature (local-only branch)
    const localFeature: FeatureData = {
      id: 'test-e2e-local',
      repo_owner: 'steins-z',
      repo_name: 'supercrew-kanban',
      title: 'E2E Test Feature',
      status: 'doing',
      source: 'agent',
      verified: false,
      sync_state: 'pending_verify',
      branch: 'user/test/e2e-local-feature',
      has_upstream: false,  // Local-only branch
      git_commit_sha: 'local123',
      last_git_commit_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    }

    await upsertFeature(localFeature)
    const result1 = await validator.validateFeature(
      localFeature.repo_owner,
      localFeature.repo_name,
      localFeature.id,
      localFeature.branch || 'main',
      process.env.GITHUB_TOKEN!
    )

    // Should use fast path for local-only
    expect(result1.action).toBe('local_only')
    expect(result1.success).toBe(true)

    // Verify database was updated
    const updated1 = await getFeature(localFeature.repo_owner, localFeature.repo_name, localFeature.id)
    expect(updated1?.sync_state).toBe('local_only')

    // Step 2: User sets upstream and pushes (but hasn't pushed yet)
    const withUpstream: FeatureData = {
      ...localFeature,
      has_upstream: true,
      branch_exists_on_remote: false,
      commits_ahead: 3,
    }

    await upsertFeature(withUpstream)
    const result2 = await validator.validateFeature(
      withUpstream.repo_owner,
      withUpstream.repo_name,
      withUpstream.id,
      withUpstream.branch || 'main',
      process.env.GITHUB_TOKEN!
    )

    // Should mark as pending_push (not orphaned)
    expect(result2.action).toBe('pending_push')
    expect(result2.success).toBe(true)

    // Verify database was updated
    const updated2 = await getFeature(withUpstream.repo_owner, withUpstream.repo_name, withUpstream.id)
    expect(updated2?.sync_state).toBe('pending_push')

    console.log('✅ E2E test passed: Local dev workflow validated')
  })
})
