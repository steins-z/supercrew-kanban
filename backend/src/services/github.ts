// GitHub API client wrapper with rate limit tracking

import type { GitHubRef, GitHubContent } from '../types/board.js'
import type {
  GitFeatureFetchResult,
  GitFeatureFetchErrorType,
  GitFileSnapshot,
} from '../types/api.js'

const GITHUB_API_BASE = 'https://api.github.com'
const FEATURES_PATH = '.supercrew/tasks'

export class GitHubClient {
  private headers: Record<string, string>
  private rateLimitRemaining = 5000
  private rateLimitReset = 0

  constructor(
    private token: string,
    private owner: string,
    private repo: string
  ) {
    this.headers = {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'supercrew-kanban',
      Accept: 'application/vnd.github.v3+json',
    }
  }

  // ─── Rate Limit Management ────────────────────────────────────────────

  private updateRateLimit(headers: Headers) {
    const remaining = headers.get('X-RateLimit-Remaining')
    const reset = headers.get('X-RateLimit-Reset')

    if (remaining) this.rateLimitRemaining = parseInt(remaining, 10)
    if (reset) this.rateLimitReset = parseInt(reset, 10)
  }

  private checkRateLimit() {
    if (this.rateLimitRemaining < 100) {
      const waitMs = this.rateLimitReset * 1000 - Date.now()
      if (waitMs > 0) {
        throw new Error(
          `GitHub API rate limit low (${this.rateLimitRemaining} remaining). ` +
            `Resets in ${Math.ceil(waitMs / 1000)}s`
        )
      }
    }
  }

  getRateLimitInfo() {
    return {
      remaining: this.rateLimitRemaining,
      reset: new Date(this.rateLimitReset * 1000).toISOString(),
    }
  }

  // ─── Core API Methods ─────────────────────────────────────────────────

  async getRefs(prefix: string): Promise<GitHubRef[]> {
    this.checkRateLimit()

    const url = `${GITHUB_API_BASE}/repos/${this.owner}/${this.repo}/git/refs/${prefix}`
    const res = await fetch(url, { headers: this.headers })

    this.updateRateLimit(res.headers)

    if (!res.ok) {
      if (res.status === 404) return []
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
    }

    return res.json()
  }

  async listFeatureDirs(branch: string): Promise<string[]> {
    this.checkRateLimit()

    const url = `${GITHUB_API_BASE}/repos/${this.owner}/${this.repo}/contents/${FEATURES_PATH}?ref=${branch}`
    const res = await fetch(url, { headers: this.headers })

    this.updateRateLimit(res.headers)

    if (!res.ok) {
      if (res.status === 404) return []
      throw new Error(`Failed to list features on ${branch}: ${res.status}`)
    }

    const items: GitHubContent[] = await res.json()
    return items.filter(item => item.type === 'dir').map(item => item.name)
  }

  async getFileContent(
    featureId: string,
    filename: string,
    branch: string
  ): Promise<string | null> {
    this.checkRateLimit()

    const url = `${GITHUB_API_BASE}/repos/${this.owner}/${this.repo}/contents/${FEATURES_PATH}/${featureId}/${filename}?ref=${branch}`
    const res = await fetch(url, { headers: this.headers })

    this.updateRateLimit(res.headers)

    if (!res.ok) {
      if (res.status === 404) return null
      throw new Error(`Failed to get ${filename} for ${featureId} on ${branch}: ${res.status}`)
    }

    const data: GitHubContent = await res.json()
    return data.content ?? null // Base64 encoded
  }

  /**
   * Get file content with ETag support (for validation service)
   * Returns 304 if content hasn't changed, saving API quota
   */
  async getFileContentWithETag(
    featureId: string,
    filename: string,
    branch: string,
    etag?: string
  ): Promise<{ content: string | null; etag?: string; notModified: boolean }> {
    this.checkRateLimit()

    const url = `${GITHUB_API_BASE}/repos/${this.owner}/${this.repo}/contents/${FEATURES_PATH}/${featureId}/${filename}?ref=${branch}`

    const headers = { ...this.headers }
    if (etag) {
      headers['If-None-Match'] = etag
    }

    const res = await fetch(url, { headers })
    this.updateRateLimit(res.headers)

    // 304 Not Modified - content hasn't changed
    if (res.status === 304) {
      return { content: null, etag, notModified: true }
    }

    if (!res.ok) {
      if (res.status === 404) {
        return { content: null, notModified: false }
      }
      throw new Error(`Failed to get ${filename} for ${featureId} on ${branch}: ${res.status}`)
    }

    const data: GitHubContent = await res.json()
    const newETag = res.headers.get('ETag') || undefined

    return {
      content: data.content ?? null,
      etag: newETag,
      notModified: false,
    }
  }

  /**
   * Fetch commit info for a specific file from GitHub Commits API
   * Returns the SHA and timestamp of the last commit that modified the file
   */
  async fetchCommitInfo(params: {
    branch: string
    path: string
  }): Promise<{ sha: string; timestamp: number }> {
    this.checkRateLimit()

    const { branch, path } = params
    const url = `${GITHUB_API_BASE}/repos/${this.owner}/${this.repo}/commits?sha=${branch}&path=${encodeURIComponent(path)}&per_page=1`

    const res = await fetch(url, { headers: this.headers })
    this.updateRateLimit(res.headers)

    if (!res.ok) {
      if (res.status === 404) {
        return { sha: '', timestamp: 0 }
      }
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
    }

    const commits = await res.json()

    if (!Array.isArray(commits) || commits.length === 0) {
      return { sha: '', timestamp: 0 }
    }

    const latestCommit = commits[0]
    return {
      sha: latestCommit.sha,
      timestamp: new Date(latestCommit.commit.committer.date).getTime() / 1000,
    }
  }
}

function classifyGitFetchError(error: unknown): {
  type: GitFeatureFetchErrorType
  message: string
} {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized')) {
    return { type: 'auth_error', message }
  }

  if (
    lower.includes('timeout') ||
    lower.includes('429') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('rate limit')
  ) {
    return { type: 'transient_error', message }
  }

  return { type: 'unknown_error', message }
}

// ============================================================================
// Helper Functions for Validation Service
// ============================================================================

/**
 * Fetch complete feature snapshot from Git (for validation)
 * Uses ETag caching to reduce API calls
 */
export async function fetchFeatureFromGit(
  owner: string,
  repo: string,
  featureId: string,
  branch: string,
  token: string,
  cachedETag?: string
): Promise<GitFeatureFetchResult> {
  const client = new GitHubClient(token, owner, repo)

  try {
    // Fetch all files in parallel with ETag support
    const [metaResult, designResult, planResult, prdResult] = await Promise.all([
      client.getFileContentWithETag(featureId, 'meta.yaml', branch, cachedETag),
      client.getFileContentWithETag(featureId, 'dev-design.md', branch),
      client.getFileContentWithETag(featureId, 'dev-plan.md', branch),
      client.getFileContentWithETag(featureId, 'prd.md', branch),
    ])

    // If meta.yaml returned 304, content hasn't changed
    if (metaResult.notModified) {
      return { kind: 'not_modified', etag: metaResult.etag }
    }

    // If meta.yaml doesn't exist, feature doesn't exist in git
    if (!metaResult.content) {
      return { kind: 'not_found' }
    }

    // Decode base64 content
    const decodeContent = (b64: string | null): string | null => {
      if (!b64) return null
      try {
        return Buffer.from(b64, 'base64').toString('utf-8')
      } catch {
        return null
      }
    }

    const snapshot: GitFileSnapshot = {
      meta_yaml: decodeContent(metaResult.content),
      dev_design_md: decodeContent(designResult.content),
      dev_plan_md: decodeContent(planResult.content),
      prd_md: decodeContent(prdResult.content),
      sha: '', // TODO: fetch from commit API
      etag: metaResult.etag,
      updated_at: Date.now(), // TODO: fetch commit timestamp
    }

    return { kind: 'snapshot', data: snapshot }
  } catch (error) {
    const classified = classifyGitFetchError(error)
    console.error(`[GitHub] Failed to fetch feature ${featureId}:`, classified.message)
    return {
      kind: classified.type,
      error: classified.message,
    }
  }
}
