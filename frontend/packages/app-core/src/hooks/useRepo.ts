import { useSyncExternalStore, useCallback } from 'react'
import {
  setSelectedRepoInternal,
  clearSelectedRepo,
  type RepoInfo,
} from '../api.js'

const REPO_KEY = 'kanban_repo'

// Simple pub/sub for repo changes
const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function notifyListeners() {
  listeners.forEach((l) => l())
}

// Cache for stable reference - only update when localStorage changes
let cachedRepo: RepoInfo | null = null
let cachedRaw: string | null = null

function getSnapshot(): RepoInfo | null {
  const raw = localStorage.getItem(REPO_KEY)
  if (raw === cachedRaw) return cachedRepo

  cachedRaw = raw
  if (!raw) {
    cachedRepo = null
  } else {
    try {
      cachedRepo = JSON.parse(raw)
    } catch {
      cachedRepo = null
    }
  }
  return cachedRepo
}

function getServerSnapshot(): RepoInfo | null {
  return null
}

// Wrap setSelectedRepo to notify listeners
export function setSelectedRepo(repo: RepoInfo) {
  setSelectedRepoInternal(repo)
  notifyListeners()
}

export function clearRepo() {
  clearSelectedRepo()
  notifyListeners()
}

// Hook that re-renders when repo changes
export function useRepo() {
  const repo = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const selectRepo = useCallback((newRepo: RepoInfo) => {
    setSelectedRepo(newRepo)
  }, [])

  return { repo, selectRepo, clearRepo }
}
