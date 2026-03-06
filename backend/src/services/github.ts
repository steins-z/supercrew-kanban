// GitHub API client wrapper with rate limit tracking

import type { GitHubRef, GitHubContent } from '../types/board.js'

const GITHUB_API_BASE = 'https://api.github.com'
const FEATURES_PATH = '.supercrew/features'

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
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'supercrew-kanban',
      'Accept': 'application/vnd.github.v3+json',
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
    return items
      .filter(item => item.type === 'dir')
      .map(item => item.name)
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
    return data.content ?? null  // Base64 encoded
  }
}
