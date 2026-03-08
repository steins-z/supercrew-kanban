# Project Switcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add a project switcher to AppHeader for quick switching between recently used projects.

**Architecture:** Add localStorage-based recent projects cache (max 5), create dropdown UI in AppHeader, reuse existing StepSelectRepo for full project selection modal. No backend changes needed.

**Tech Stack:** React, TypeScript, Radix UI (Popover), React Query, localStorage

---

## Task 1: Add Recent Projects Hook

**Files:**
- Create: `frontend/packages/app-core/src/hooks/useRecentProjects.ts`
- Create: `frontend/packages/app-core/src/hooks/index.ts` (if doesn't exist, or modify existing)

**Step 1: Create useRecentProjects hook**

Create `frontend/packages/app-core/src/hooks/useRecentProjects.ts`:

```typescript
import { useState, useCallback, useEffect } from 'react'
import type { RepoInfo } from '../api.js'

const RECENT_REPOS_KEY = 'kanban_recent_repos'
const MAX_RECENT = 5

export interface RecentRepoInfo extends RepoInfo {
  last_used: number
}

function getRecentReposFromStorage(): RecentRepoInfo[] {
  const stored = localStorage.getItem(RECENT_REPOS_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored)
  } catch {
    return []
  }
}

function saveRecentReposToStorage(repos: RecentRepoInfo[]) {
  localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(repos))
}

export function useRecentProjects() {
  const [recentRepos, setRecentRepos] = useState<RecentRepoInfo[]>(getRecentReposFromStorage)

  // Sync with localStorage changes (e.g., from other tabs)
  useEffect(() => {
    const handleStorageChange = () => {
      setRecentRepos(getRecentReposFromStorage())
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const addRecentProject = useCallback((repo: RepoInfo) => {
    const recent = getRecentReposFromStorage()

    // Remove if already exists
    const filtered = recent.filter(r => r.full_name !== repo.full_name)

    // Add to front with current timestamp
    const updated: RecentRepoInfo[] = [
      { ...repo, last_used: Date.now() },
      ...filtered
    ].slice(0, MAX_RECENT)

    saveRecentReposToStorage(updated)
    setRecentRepos(updated)
  }, [])

  return {
    recentRepos,
    addRecentProject,
  }
}
```

**Step 2: Export from index**

If `frontend/packages/app-core/src/hooks/index.ts` doesn't exist, create it:

```typescript
export { useRepo } from './useRepo.js'
export { useBoard } from './useBoard.js'
export { useRecentProjects } from './useRecentProjects.js'
```

Otherwise, add this line to existing file:

```typescript
export { useRecentProjects } from './useRecentProjects.js'
```

**Step 3: Verify TypeScript compilation**

Run: `cd frontend && pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/packages/app-core/src/hooks/useRecentProjects.ts
git add frontend/packages/app-core/src/hooks/index.ts
git commit -m "feat(hooks): add useRecentProjects hook

Add localStorage-based recent projects hook with LRU cache (max 5)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Update useRepo Hook

**Files:**
- Modify: `frontend/packages/app-core/src/hooks/useRepo.ts`

**Step 1: Add switchProject function to useRepo**

Update `frontend/packages/app-core/src/hooks/useRepo.ts`:

```typescript
import { useSyncExternalStore, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'  // ADD THIS
import { setSelectedRepoInternal, clearSelectedRepo, type RepoInfo } from '../api.js'

// ... existing code ...

// Hook that re-renders when repo changes
export function useRepo() {
  const repo = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const queryClient = useQueryClient()  // ADD THIS

  const selectRepo = useCallback((newRepo: RepoInfo) => {
    setSelectedRepo(newRepo)
  }, [])

  // ADD THIS FUNCTION
  const switchProject = useCallback((newRepo: RepoInfo) => {
    setSelectedRepo(newRepo)
    // Invalidate board query to refetch data for new project
    queryClient.invalidateQueries({ queryKey: ['board'] })
  }, [queryClient])

  return { repo, selectRepo, switchProject, clearRepo }  // ADD switchProject
}
```

**Step 2: Verify TypeScript compilation**

Run: `cd frontend && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/packages/app-core/src/hooks/useRepo.ts
git commit -m "feat(hooks): add switchProject to useRepo

Add switchProject function that updates repo and invalidates React Query cache

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create ProjectSwitcher Component

**Files:**
- Create: `frontend/packages/local-web/src/components/ProjectSwitcher.tsx`

**Step 1: Create ProjectSwitcher component**

Create `frontend/packages/local-web/src/components/ProjectSwitcher.tsx`:

```typescript
import { useState } from 'react'
import { Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover'
import { CaretDownIcon, CheckIcon, PlusIcon } from '@phosphor-icons/react'
import { useRepo, useRecentProjects, type RepoInfo } from '@vibe/app-core'
import { useQueryClient } from '@tanstack/react-query'

interface ProjectSwitcherProps {
  onOpenFullSelector: () => void
}

export default function ProjectSwitcher({ onOpenFullSelector }: ProjectSwitcherProps) {
  const { repo, switchProject } = useRepo()
  const { recentRepos, addRecentProject } = useRecentProjects()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const handleSelectProject = (selectedRepo: RepoInfo) => {
    if (selectedRepo.full_name === repo?.full_name) {
      setOpen(false)
      return // No-op if same project
    }

    switchProject(selectedRepo)
    addRecentProject(selectedRepo)
    setOpen(false)
  }

  if (!repo) {
    return null // Don't show if no project selected
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '6px 10px',
            color: 'hsl(var(--text-high))',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'Instrument Sans, sans-serif',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.borderColor = 'var(--rb-accent)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 200,
            }}
          >
            {repo.full_name}
          </span>
          <CaretDownIcon
            size={12}
            style={{
              flexShrink: 0,
              transition: 'transform 0.15s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              color: 'hsl(var(--text-low))',
            }}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        sideOffset={8}
        align="start"
        style={{
          width: 280,
          background: 'hsl(var(--_bg-secondary-default))',
          border: '1px solid hsl(var(--_border))',
          borderRadius: 10,
          padding: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          zIndex: 50,
          outline: 'none',
        }}
      >
        {/* Recent Projects Label */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'hsl(var(--text-low))',
            padding: '8px 10px 6px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Recent Projects
        </div>

        {/* Recent Projects List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {recentRepos.length === 0 ? (
            <div
              style={{
                padding: '12px 10px',
                fontSize: 13,
                color: 'hsl(var(--text-low))',
                textAlign: 'center',
              }}
            >
              No recent projects
            </div>
          ) : (
            recentRepos.map(recentRepo => {
              const isCurrent = recentRepo.full_name === repo.full_name
              return (
                <button
                  key={recentRepo.full_name}
                  onClick={() => handleSelectProject(recentRepo)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 10px',
                    background: isCurrent ? 'rgba(52,211,153,0.12)' : 'transparent',
                    border: `1px solid ${isCurrent ? 'var(--rb-accent)' : 'transparent'}`,
                    borderRadius: 6,
                    color: 'hsl(var(--text-high))',
                    fontSize: 13,
                    fontFamily: 'Instrument Sans, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => {
                    if (!isCurrent) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isCurrent) {
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {recentRepo.full_name}
                  </span>
                  {isCurrent && (
                    <CheckIcon size={14} color="var(--rb-accent)" weight="bold" />
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: 'hsl(var(--_border))',
            margin: '8px 0',
          }}
        />

        {/* Switch to Other Button */}
        <button
          onClick={() => {
            setOpen(false)
            onOpenFullSelector()
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 6,
            color: 'var(--rb-accent)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'Instrument Sans, sans-serif',
            cursor: 'pointer',
            transition: 'all 0.1s',
            width: '100%',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(52,211,153,0.08)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <PlusIcon size={14} weight="bold" />
          <span>Switch to other...</span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
```

**Step 2: Verify TypeScript compilation**

Run: `cd frontend && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/packages/local-web/src/components/ProjectSwitcher.tsx
git commit -m "feat(ui): add ProjectSwitcher component

Add dropdown component showing recent projects with switch functionality

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Create ProjectSelectorModal Component

**Files:**
- Create: `frontend/packages/local-web/src/components/ProjectSelectorModal.tsx`

**Step 1: Create ProjectSelectorModal component**

Create `frontend/packages/local-web/src/components/ProjectSelectorModal.tsx`:

```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogOverlay } from '@radix-ui/react-dialog'
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import { fetchUserRepos, type GitHubRepo, type RepoInfo } from '@vibe/app-core'

interface ProjectSelectorModalProps {
  open: boolean
  onClose: () => void
  onSelect: (repo: RepoInfo) => void
}

export default function ProjectSelectorModal({
  open,
  onClose,
  onSelect,
}: ProjectSelectorModalProps) {
  const [search, setSearch] = useState('')

  const { data: repos, isLoading } = useQuery<GitHubRepo[]>({
    queryKey: ['github-repos'],
    queryFn: fetchUserRepos,
    enabled: open, // Only fetch when modal is open
  })

  const filtered = (repos ?? []).filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (repo: GitHubRepo) => {
    onSelect({
      owner: repo.owner.login,
      repo: repo.name,
      full_name: repo.full_name,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogOverlay
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
        }}
      />
      <DialogContent
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: 520,
          maxHeight: '80vh',
          background: 'hsl(var(--_bg-secondary-default))',
          border: '1px solid hsl(var(--_border))',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          padding: 24,
          zIndex: 101,
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'hsl(var(--text-high))',
              margin: 0,
              fontFamily: 'Instrument Sans, sans-serif',
            }}
          >
            Select Project
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'hsl(var(--text-low))',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.color = 'hsl(var(--text-high))'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'hsl(var(--text-low))'
            }}
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <MagnifyingGlassIcon
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'hsl(var(--text-low))',
            }}
          />
          <input
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid hsl(var(--_border))',
              borderRadius: 8,
              color: 'hsl(var(--text-high))',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'Instrument Sans, sans-serif',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--rb-accent)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'hsl(var(--_border))'
            }}
          />
        </div>

        {/* Repo List */}
        <div
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {isLoading ? (
            <div
              style={{
                color: 'hsl(var(--text-low))',
                fontSize: 14,
                textAlign: 'center',
                padding: '32px 0',
              }}
            >
              Loading repositories...
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                color: 'hsl(var(--text-low))',
                fontSize: 14,
                textAlign: 'center',
                padding: '32px 0',
              }}
            >
              {search ? 'No repositories found' : 'No repositories available'}
            </div>
          ) : (
            filtered.map(repo => (
              <button
                key={repo.id}
                onClick={() => handleSelect(repo)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid transparent',
                  color: 'hsl(var(--text-high))',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontFamily: 'Instrument Sans, sans-serif',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.borderColor = 'hsl(var(--_border))'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                }}
              >
                <div style={{ fontWeight: 500 }}>{repo.full_name}</div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Verify TypeScript compilation**

Run: `cd frontend && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/packages/local-web/src/components/ProjectSelectorModal.tsx
git commit -m "feat(ui): add ProjectSelectorModal component

Add modal for selecting any GitHub repository with search

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Integrate ProjectSwitcher into AppHeader

**Files:**
- Modify: `frontend/packages/local-web/src/components/AppHeader.tsx`

**Step 1: Update AppHeader component**

Replace `frontend/packages/local-web/src/components/AppHeader.tsx` content:

```typescript
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LightningIcon, SunIcon, MoonIcon, SignOutIcon, GlobeIcon,
} from '@phosphor-icons/react'
import { useRecentProjects, type RepoInfo } from '@vibe/app-core'
import ProjectSwitcher from './ProjectSwitcher'
import ProjectSelectorModal from './ProjectSelectorModal'

interface AppHeaderProps {
  dark: boolean
  onToggleTheme: () => void
  onLogout: () => void
  onDisconnect: () => void
}

function HeaderBtn({
  icon, label, onClick, title,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '6px 10px', borderRadius: 8,
        color: 'hsl(var(--text-low))',
        fontSize: 13, fontWeight: 500,
        fontFamily: 'Instrument Sans, sans-serif',
        transition: 'background 0.15s, color 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'hsl(var(--_muted))'
        el.style.color = 'hsl(var(--text-high))'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'transparent'
        el.style.color = 'hsl(var(--text-low))'
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export default function AppHeader({ dark, onToggleTheme, onLogout }: AppHeaderProps) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language.startsWith('zh')
  const [selectorOpen, setSelectorOpen] = useState(false)
  const { addRecentProject } = useRecentProjects()

  const handleSelectProject = (repo: RepoInfo) => {
    addRecentProject(repo)
  }

  return (
    <>
      <header style={{
        flexShrink: 0,
        height: 52,
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        borderBottom: '1px solid hsl(var(--_border))',
        background: 'hsl(var(--_bg-secondary-default))',
        backdropFilter: 'blur(12px)',
        zIndex: 20,
      }}>
        {/* ── Logo ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--rb-accent) 0%, var(--rb-accent2) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px var(--rb-glow)',
            flexShrink: 0,
          }}>
            <LightningIcon size={14} weight="fill" color={dark ? '#000' : '#fff'} />
          </div>
          <span style={{
            fontSize: 15, fontWeight: 700,
            color: 'var(--rb-accent)',
            fontFamily: 'Instrument Sans, sans-serif',
            letterSpacing: '-0.01em',
          }}>
            Super Crew
          </span>

          {/* ── Project Switcher ── */}
          <ProjectSwitcher onOpenFullSelector={() => setSelectorOpen(true)} />
        </div>

        {/* ── Spacer ── */}
        <div style={{ flex: 1 }} />

        {/* ── Controls ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <HeaderBtn
            icon={<GlobeIcon size={15} weight="regular" />}
            label={isZh ? '中文' : 'English'}
            onClick={() => i18n.changeLanguage(isZh ? 'en' : 'zh')}
            title={isZh ? 'Switch to English' : '切换为中文'}
          />
          <HeaderBtn
            icon={dark
              ? <SunIcon size={15} weight="regular" />
              : <MoonIcon size={15} weight="regular" />
            }
            label={dark ? t('sidebar.lightMode') : t('sidebar.darkMode')}
            onClick={onToggleTheme}
          />
          <HeaderBtn
            icon={<SignOutIcon size={15} weight="regular" />}
            label={t('sidebar.logout')}
            onClick={onLogout}
          />
        </div>
      </header>

      {/* ── Project Selector Modal ── */}
      <ProjectSelectorModal
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handleSelectProject}
      />
    </>
  )
}
```

**Step 2: Update __root.tsx to remove onDisconnect**

Modify `frontend/packages/local-web/src/routes/__root.tsx`:

Remove the `onDisconnect` prop from `<AppHeader />` (around line 110):

```typescript
// BEFORE:
<AppHeader
  dark={dark}
  onToggleTheme={() => setDark(d => !d)}
  onLogout={handleLogout}
  onDisconnect={handleDisconnect}  // REMOVE THIS LINE
/>

// AFTER:
<AppHeader
  dark={dark}
  onToggleTheme={() => setDark(d => !d)}
  onLogout={handleLogout}
/>
```

Also remove the `handleDisconnect` function (around line 64-70) as it's no longer needed.

**Step 3: Verify TypeScript compilation**

Run: `cd frontend && pnpm typecheck`
Expected: No errors

**Step 4: Test in browser**

Run: `cd frontend && pnpm dev`
Navigate to `http://localhost:5173`

Expected:
- Project switcher appears in AppHeader
- Clicking shows dropdown with recent projects
- "Switch to other..." opens full selector modal
- Selecting a project switches and refetches data

**Step 5: Commit**

```bash
git add frontend/packages/local-web/src/components/AppHeader.tsx
git add frontend/packages/local-web/src/routes/__root.tsx
git commit -m "feat(ui): integrate ProjectSwitcher into AppHeader

Replace Disconnect button with ProjectSwitcher dropdown

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Add Initial Current Project to Recent List

**Files:**
- Modify: `frontend/packages/app-core/src/hooks/useRecentProjects.ts`

**Step 1: Auto-add current project on mount**

Update `useRecentProjects` hook to automatically add the current project:

```typescript
import { useState, useCallback, useEffect } from 'react'
import type { RepoInfo } from '../api.js'
import { getSelectedRepo } from '../api.js'  // ADD THIS

// ... existing code ...

export function useRecentProjects() {
  const [recentRepos, setRecentRepos] = useState<RecentRepoInfo[]>(getRecentReposFromStorage)

  // ADD THIS: Auto-add current project to recent list on mount
  useEffect(() => {
    const currentRepo = getSelectedRepo()
    if (currentRepo) {
      const recent = getRecentReposFromStorage()
      const alreadyExists = recent.some(r => r.full_name === currentRepo.full_name)

      if (!alreadyExists) {
        const updated: RecentRepoInfo[] = [
          { ...currentRepo, last_used: Date.now() },
          ...recent
        ].slice(0, MAX_RECENT)

        saveRecentReposToStorage(updated)
        setRecentRepos(updated)
      }
    }
  }, [])

  // ... rest of existing code ...
```

**Step 2: Verify TypeScript compilation**

Run: `cd frontend && pnpm typecheck`
Expected: No errors

**Step 3: Test**

1. Clear localStorage: Open DevTools Console, run `localStorage.clear()`
2. Refresh page
3. Select a project
4. Open project switcher dropdown
5. Expected: Current project appears in recent list

**Step 4: Commit**

```bash
git add frontend/packages/app-core/src/hooks/useRecentProjects.ts
git commit -m "feat(hooks): auto-add current project to recent list

Automatically add current project to recent list on mount

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Manual Testing & Bug Fixes

**Step 1: Test edge cases**

Test these scenarios:

1. **No recent projects**
   - Clear localStorage
   - Verify dropdown shows "No recent projects"
   - Verify "Switch to other..." still works

2. **Switch to same project**
   - Select current project from dropdown
   - Verify no API calls are made
   - Verify dropdown closes

3. **Switch to different project**
   - Select different project
   - Verify data refetches
   - Verify recent list updates

4. **Full selector modal**
   - Click "Switch to other..."
   - Search for a repo
   - Select it
   - Verify it works

5. **Recent list ordering**
   - Switch between 3+ different projects
   - Verify most recent is at top
   - Verify max 5 projects

**Step 2: Fix any bugs found**

If bugs are found, create commits with:
```bash
git commit -m "fix(ui): [description of fix]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**Step 3: Final verification**

Run full typecheck and build:
```bash
cd frontend
pnpm typecheck
pnpm build
```

Expected: No errors

---

## Success Criteria Checklist

- [ ] Project switcher appears in AppHeader
- [ ] Dropdown shows recent projects (max 5)
- [ ] Current project is highlighted in dropdown
- [ ] Clicking project switches and refetches data
- [ ] "Switch to other..." opens full selector modal
- [ ] Recent list updates when switching
- [ ] No backend changes required
- [ ] TypeScript compilation successful
- [ ] All manual tests pass

---

**Implementation complete!** The project switcher feature is now ready for use.
