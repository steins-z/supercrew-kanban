# Project Switcher Design

**Date:** 2026-03-07
**Status:** Approved
**Author:** Claude & qunmi

---

## Overview

Add a project switcher to the AppHeader that allows users to quickly switch between recently used projects without leaving the current page.

## Goals

1. Allow users to switch between projects efficiently
2. Maintain a history of recently used projects
3. Provide quick access to frequently used projects (1-click switch)
4. Keep data storage simple (localStorage only for preferences)

## Design Decisions

### UI Placement

**Location:** AppHeader top navigation bar (left side)

**Rationale:**
- Always visible and accessible
- Natural position for context display
- Consistent with other tools (VS Code, GitHub, etc.)

### UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [steins-z/supercrew ▼]  │  Theme  Logout  Disconnect      │
└─────────────────────────────────────────────────────────────┘

Click to show dropdown:

┌─────────────────────────┐
│ Recent Projects         │
├─────────────────────────┤
│ ✓ steins-z/supercrew    │ ← Current project
│   owner/repo-1          │
│   owner/repo-2          │
├─────────────────────────┤
│ + Switch to other...    │
└─────────────────────────┘
```

### Component Architecture

```
AppHeader (existing)
├── ProjectSwitcher (new)
│   ├── ProjectDropdown
│   │   ├── CurrentProjectDisplay
│   │   └── RecentProjectsList
│   └── ProjectSelectorModal (reuse from /welcome)
```

**New Components:**
- `ProjectSwitcher` - Main container with dropdown logic
- `ProjectDropdown` - Dropdown menu showing recent projects
- Reuse `StepSelectRepo` from `/welcome` for full project selection

### Data Storage Strategy

**localStorage (client-side preferences):**

```typescript
// Current project (existing)
kanban_repo: {
  owner: string
  repo: string
  full_name: string
}

// Recent projects history (new)
kanban_recent_repos: Array<{
  owner: string
  repo: string
  full_name: string
  last_used: number  // timestamp
}>
```

**Database (project data):**
- No changes needed
- Existing tables (features, branches) already support multi-repo
- API already accepts `repo_owner` and `repo_name` parameters

**Rationale:**
- Project selection is user preference data (local state)
- Project content data (features/branches) belongs in database
- No need for user authentication/accounts to manage preferences
- Simple, fast, no backend changes required

### Data Flow

1. **Initial Load:**
   - Read `kanban_repo` from localStorage → Set current project
   - Read `kanban_recent_repos` → Populate recent list

2. **Switch Project:**
   - User clicks project from dropdown
   - Update `kanban_repo` in localStorage
   - Add/update entry in `kanban_recent_repos` (max 5 items, LRU)
   - Call `queryClient.invalidateQueries(['board'])`
   - Frontend refetches `/api/board?repo_owner=X&repo_name=Y`

3. **Open Full Selector:**
   - User clicks "+ Switch to other..."
   - Open modal with full GitHub repo list
   - Reuse existing `StepSelectRepo` component from `/welcome`

### Recent Projects Management

**Storage limit:** 5 most recently used projects

**Update logic:**
```typescript
function updateRecentProjects(newRepo: RepoInfo) {
  const recent = getRecentProjects()

  // Remove if already exists
  const filtered = recent.filter(r => r.full_name !== newRepo.full_name)

  // Add to front with current timestamp
  const updated = [
    { ...newRepo, last_used: Date.now() },
    ...filtered
  ].slice(0, 5) // Keep only 5 most recent

  localStorage.setItem('kanban_recent_repos', JSON.stringify(updated))
}
```

## Implementation Checklist

### Phase 1: Data Layer
- [ ] Add `useRecentProjects` hook
  - Read/write `kanban_recent_repos` from localStorage
  - Provide `addRecentProject(repo)` function
- [ ] Update `useRepo` hook
  - Add `switchProject(repo)` function that:
    - Updates `kanban_repo`
    - Calls `addRecentProject(repo)`
    - Invalidates React Query cache

### Phase 2: UI Components
- [ ] Create `ProjectSwitcher` component
  - Display current project name
  - Dropdown menu with recent projects
  - "Switch to other..." button
- [ ] Create `ProjectDropdown` component
  - List of recent projects
  - Highlight current project
  - Click to switch
- [ ] Create `ProjectSelectorModal` component
  - Reuse `StepSelectRepo` from `/welcome`
  - Modal overlay
  - Search and select any GitHub repo

### Phase 3: Integration
- [ ] Update `AppHeader` component
  - Add `ProjectSwitcher` component to left side
  - Adjust layout to accommodate switcher
- [ ] Remove "Disconnect" button (replaced by switcher)
- [ ] Test project switching flow
  - Verify data refetches correctly
  - Verify recent list updates
  - Verify modal works

### Phase 4: Polish
- [ ] Add loading state during project switch
- [ ] Add smooth transitions
- [ ] Add keyboard shortcuts (optional)
- [ ] Test edge cases (empty recent list, switch to same project)

## Edge Cases

1. **No recent projects** → Show only "Switch to other..." option
2. **Only one project used** → Still show dropdown with that project
3. **Switch to current project** → No-op, close dropdown
4. **localStorage cleared** → Recent list empty, still functional
5. **GitHub repo deleted** → Show in recent list but fail gracefully when selected

## Testing Strategy

**Manual Tests:**
- [ ] Fresh start (no localStorage) → Should work
- [ ] Switch between 3+ projects → Recent list updates correctly
- [ ] Switch to same project → No unnecessary API calls
- [ ] Open full selector → Can search and select any repo
- [ ] Clear localStorage → App still works

**Integration Tests:**
- [ ] Verify `useRecentProjects` hook works
- [ ] Verify `switchProject` updates all state correctly
- [ ] Verify React Query cache invalidation

## Success Criteria

- ✅ User can see current project in AppHeader
- ✅ User can switch to recent projects with 2 clicks
- ✅ User can switch to any GitHub repo with 3+ clicks
- ✅ Recent projects list updates automatically
- ✅ Data refetches correctly after switch
- ✅ No backend changes required

## Future Enhancements

- Add "favorite projects" feature
- Add keyboard shortcut (Cmd+K) for project switcher
- Show project avatar/icon
- Sync recent projects across devices (requires backend)

---

**Approved by:** qunmi
**Implementation:** Ready to begin
