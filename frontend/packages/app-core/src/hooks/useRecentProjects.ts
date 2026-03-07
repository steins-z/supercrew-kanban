import { useState, useEffect } from 'react'
import type { RepoInfo } from '../api.js'

const RECENT_REPOS_KEY = 'kanban_recent_repos'
const MAX_RECENT = 5

export interface RecentRepoInfo extends RepoInfo {
  last_used: number
}

/**
 * Read recent repos from localStorage
 */
export function getRecentReposFromStorage(): RecentRepoInfo[] {
  const stored = localStorage.getItem(RECENT_REPOS_KEY)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Write recent repos to localStorage
 */
export function saveRecentReposToStorage(repos: RecentRepoInfo[]): void {
  localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(repos))
}

/**
 * Hook to manage recently used projects with LRU cache behavior
 */
export function useRecentProjects() {
  const [recentRepos, setRecentRepos] = useState<RecentRepoInfo[]>(
    getRecentReposFromStorage
  )

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === RECENT_REPOS_KEY) {
        setRecentRepos(getRecentReposFromStorage())
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  /**
   * Add a project to recent list with LRU behavior:
   * - Remove existing entry if present
   * - Add to front with current timestamp
   * - Limit to MAX_RECENT items
   */
  const addRecentProject = (repo: RepoInfo) => {
    const now = Date.now()
    const current = getRecentReposFromStorage()

    // Remove existing entry for this repo
    const filtered = current.filter((r) => r.full_name !== repo.full_name)

    // Add to front with timestamp
    const updated: RecentRepoInfo[] = [
      { ...repo, last_used: now },
      ...filtered,
    ].slice(0, MAX_RECENT)

    saveRecentReposToStorage(updated)
    setRecentRepos(updated)
  }

  return {
    recentRepos,
    addRecentProject,
  }
}
