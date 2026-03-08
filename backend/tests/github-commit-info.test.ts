import { describe, test, expect } from 'bun:test'
import { GitHubClient } from '../src/services/github'

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
})
