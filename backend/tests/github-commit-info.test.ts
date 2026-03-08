import { describe, test, expect } from 'bun:test'
import { GitHubClient, fetchFeatureFromGit } from '../src/services/github'

describe('GitHubClient.fetchCommitInfo', () => {
  const skipIfNoToken = () => {
    if (!process.env.GITHUB_TOKEN) {
      console.log('[SKIP] GITHUB_TOKEN not set - add to .env to run integration tests')
      return true
    }
    return false
  }

  test('fetches commit SHA and timestamp from GitHub API', async () => {
    if (skipIfNoToken()) {
      expect(true).toBe(true)  // Skip test gracefully
      return
    }

    const client = new GitHubClient(
      process.env.GITHUB_TOKEN!,
      'steins-z',
      'supercrew-kanban'
    )

    const result = await client.fetchCommitInfo({
      branch: 'main',
      path: '.supercrew/tasks/simplified-status-schema/meta.yaml'
    })

    expect(result.sha).toMatch(/^[0-9a-f]{40}$/)  // Valid SHA format
    expect(result.timestamp).toBeGreaterThan(0)     // Unix timestamp
    expect(typeof result.timestamp).toBe('number')
  })

  test('returns empty values for non-existent branch', async () => {
    if (skipIfNoToken()) {
      expect(true).toBe(true)  // Skip test gracefully
      return
    }

    const client = new GitHubClient(
      process.env.GITHUB_TOKEN!,
      'steins-z',
      'supercrew-kanban'
    )

    const result = await client.fetchCommitInfo({
      branch: 'non-existent-branch-xyz',
      path: '.supercrew/tasks/simplified-status-schema/meta.yaml'
    })

    expect(result.sha).toBe('')
    expect(result.timestamp).toBe(0)
  })

  test('fetchFeatureFromGit includes real commit info', async () => {
    if (skipIfNoToken()) {
      expect(true).toBe(true)  // Skip test gracefully
      return
    }

    const result = await fetchFeatureFromGit(
      'steins-z',
      'supercrew-kanban',
      'simplified-status-schema',
      'main',
      process.env.GITHUB_TOKEN!
    )

    // Should return a snapshot
    expect(result.kind).toBe('snapshot')
    if (result.kind !== 'snapshot') return

    // Should have real commit SHA (not empty string)
    expect(result.data.sha).toMatch(/^[0-9a-f]{40}$/)

    // Should have real timestamp (not Date.now())
    expect(result.data.updated_at).toBeGreaterThan(0)
    expect(result.data.updated_at).toBeLessThan(Date.now())  // Should be in the past
  })
})
