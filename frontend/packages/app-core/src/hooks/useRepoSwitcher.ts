import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import type { RepoInfo, RepoStorage } from '../types.js';

const STORAGE_KEY = 'supercrew:recentRepos';
const MAX_RECENT_REPOS = 10;

// ─── Storage Utilities ─────────────────────────────────────────────────

function loadStorage(): RepoStorage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { currentRepo: '', recentRepos: [] };
    }
    const parsed = JSON.parse(stored);
    // Validate structure
    if (!parsed.currentRepo || !Array.isArray(parsed.recentRepos)) {
      return { currentRepo: '', recentRepos: [] };
    }
    return parsed;
  } catch {
    return { currentRepo: '', recentRepos: [] };
  }
}

function saveStorage(data: RepoStorage) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    notifyListeners();
  } catch (error) {
    console.error('[useRepoSwitcher] Failed to save to localStorage:', error);
  }
}

// ─── Pub/Sub for Cross-Tab Sync ───────────────────────────────────────

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  listeners.forEach((l) => l());
}

// ─── Storage Snapshot ──────────────────────────────────────────────────

let cachedStorage: RepoStorage | null = null;
let cachedRaw: string | null = null;

function getSnapshot(): RepoStorage {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw && cachedStorage) return cachedStorage;

  cachedRaw = raw;
  cachedStorage = loadStorage();
  return cachedStorage;
}

function getServerSnapshot(): RepoStorage {
  return { currentRepo: '', recentRepos: [] };
}

// ─── Main Hook ─────────────────────────────────────────────────────────

export function useRepoSwitcher() {
  const storage = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isLoading, setIsLoading] = useState(false);

  // Listen to storage events for cross-tab sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        notifyListeners();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Parse currentRepo into owner/repo
  const currentRepo = storage.currentRepo
    ? {
        owner: storage.currentRepo.split('/')[0],
        repo: storage.currentRepo.split('/')[1],
        full: storage.currentRepo,
      }
    : null;

  // Sort repos by lastAccessed (most recent first)
  const recentRepos = [...storage.recentRepos].sort(
    (a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime(),
  );

  // ─── Switch Repo ───────────────────────────────────────────────────

  const switchRepo = useCallback((owner: string, repo: string) => {
    setIsLoading(true);

    const fullName = `${owner}/${repo}`;
    const now = new Date().toISOString();

    const currentStorage = loadStorage();
    const existingIndex = currentStorage.recentRepos.findIndex(
      (r) => r.owner === owner && r.repo === repo,
    );

    let updatedRecent = [...currentStorage.recentRepos];

    if (existingIndex >= 0) {
      // Update existing entry
      updatedRecent[existingIndex] = {
        ...updatedRecent[existingIndex],
        lastAccessed: now,
      };
    } else {
      // Add new entry
      updatedRecent.unshift({
        owner,
        repo,
        lastAccessed: now,
      });

      // Limit to MAX_RECENT_REPOS
      if (updatedRecent.length > MAX_RECENT_REPOS) {
        updatedRecent = updatedRecent.slice(0, MAX_RECENT_REPOS);
      }
    }

    saveStorage({
      currentRepo: fullName,
      recentRepos: updatedRecent,
    });

    // Simulate async operation (e.g., fetching data)
    setTimeout(() => setIsLoading(false), 300);
  }, []);

  // ─── Add Repo (after OAuth) ────────────────────────────────────────

  const addRepo = useCallback((owner: string, repo: string, displayName?: string) => {
    const fullName = `${owner}/${repo}`;
    const now = new Date().toISOString();

    const currentStorage = loadStorage();
    const existingIndex = currentStorage.recentRepos.findIndex(
      (r) => r.owner === owner && r.repo === repo,
    );

    let updatedRecent = [...currentStorage.recentRepos];

    if (existingIndex >= 0) {
      // Update existing entry
      updatedRecent[existingIndex] = {
        owner,
        repo,
        lastAccessed: now,
        displayName,
      };
    } else {
      // Add new entry
      updatedRecent.unshift({
        owner,
        repo,
        lastAccessed: now,
        displayName,
      });

      // Limit to MAX_RECENT_REPOS
      if (updatedRecent.length > MAX_RECENT_REPOS) {
        updatedRecent = updatedRecent.slice(0, MAX_RECENT_REPOS);
      }
    }

    saveStorage({
      currentRepo: fullName,
      recentRepos: updatedRecent,
    });
  }, []);

  // ─── Remove Repo ───────────────────────────────────────────────────

  const removeRepo = useCallback((owner: string, repo: string) => {
    const currentStorage = loadStorage();
    const fullName = `${owner}/${repo}`;

    // Don't allow removing current repo
    if (currentStorage.currentRepo === fullName) {
      console.warn('[useRepoSwitcher] Cannot remove current repo');
      return;
    }

    const updatedRecent = currentStorage.recentRepos.filter(
      (r) => !(r.owner === owner && r.repo === repo),
    );

    saveStorage({
      currentRepo: currentStorage.currentRepo,
      recentRepos: updatedRecent,
    });
  }, []);

  return {
    currentRepo,
    recentRepos,
    switchRepo,
    addRepo,
    removeRepo,
    isLoading,
  };
}
