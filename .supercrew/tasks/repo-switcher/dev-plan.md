---
total_tasks: 8
completed_tasks: 8
progress: 100
---

# Repository Switcher — Implementation Plan

## Tasks

### Phase 1: Foundation (Types & Hook)

- [x] **Task 1**: Create type definitions in `types/repo.ts`
  - ✅ Defined in `app-core/src/types.ts`
  - ✅ `RepoInfo` interface with owner, repo, lastAccessed, displayName
  - ✅ `RepoStorage` interface with currentRepo and recentRepos

- [x] **Task 2**: Implement `useRepoSwitcher` hook
  - ✅ Location: `app-core/src/hooks/useRepoSwitcher.ts`
  - ✅ localStorage persistence (`supercrew:recentRepos`)
  - ✅ `switchRepo`, `addRepo`, `removeRepo` functions
  - ✅ Cross-tab sync using `useSyncExternalStore` + storage events
  - ✅ Loading state management
  - ✅ Automatic sorting by lastAccessed

### Phase 2: UI Components

- [x] **Task 3**: Create `RepoSwitcher.tsx` component
  - ✅ Location: `local-web/src/components/RepoSwitcher.tsx`
  - ✅ Trigger button with current repo display
  - ✅ Dropdown menu container
  - ✅ Open/close state management
  - ✅ Click-outside-to-close logic

- [x] **Task 4**: Build dropdown menu items
  - ✅ Current repo item with checkmark indicator
  - ✅ Recent repos list with hover effects
  - ✅ Remove button (X icon) on hover
  - ✅ "+ Connect Another Repo" CTA (placeholder implementation)

- [x] **Task 5**: Style the component
  - ✅ Matches `HeaderBtn` styles
  - ✅ Hover/active states
  - ✅ Dropdown positioning (absolute + z-index)
  - ✅ Smooth transitions and animations

### Phase 3: Integration

- [x] **Task 6**: Integrate into `AppHeader`
  - ✅ Imported `RepoSwitcher` component
  - ✅ Positioned between Logo and controls
  - ✅ Added vertical divider styling
  - ✅ Responsive layout working

- [x] **Task 7**: Connect repo switching to data layer
  - ✅ Repo switch triggers localStorage update
  - ✅ Page reload on repo switch (simple implementation)
  - ✅ Cross-tab sync working
  - Note: Uses `window.location.reload()` instead of React Query invalidation

### Phase 4: Polish & Testing

- [x] **Task 8**: Final polish
  - ✅ Loading overlay during repo switch
  - ✅ Empty state handled (component returns null if no current repo)
  - ✅ Click-outside-to-close working
  - ✅ Cross-tab sync tested
  - ⚠️ Keyboard navigation: Not implemented (optional enhancement)
  - ⚠️ OAuth flow: Placeholder only ("Connect Another Repo" logs to console)
