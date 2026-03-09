---
total_tasks: 8
completed_tasks: 0
progress: 0
---

# Repository Switcher — Implementation Plan

## Tasks

### Phase 1: Foundation (Types & Hook)

- [ ] **Task 1**: Create type definitions in `types/repo.ts`
  - Define `RepoInfo` interface
  - Define `RepoStorage` interface
  - Export utility type for repo identifier

- [ ] **Task 2**: Implement `useRepoSwitcher` hook
  - Read/write localStorage (`supercrew:recentRepos`)
  - Implement `switchRepo` function
  - Implement `addRepo` function
  - Implement `removeRepo` function
  - Add cross-tab sync (storage event listener)
  - Handle edge cases (malformed data, empty state)

### Phase 2: UI Components

- [ ] **Task 3**: Create `RepoSwitcher.tsx` component
  - Build trigger button (display current repo + dropdown arrow)
  - Build dropdown menu container
  - Implement open/close state management
  - Add click-outside-to-close logic

- [ ] **Task 4**: Build dropdown menu items
  - Current repo item (with ✓ checkmark)
  - Recent repos list with hover effects
  - Remove button (× icon) on hover
  - "+ Connect Another Repo" CTA at bottom

- [ ] **Task 5**: Style the component
  - Match existing `HeaderBtn` styles
  - Add hover/active states
  - Position dropdown (absolute positioning + z-index)
  - Add transitions and animations

### Phase 3: Integration

- [ ] **Task 6**: Integrate into `AppHeader`
  - Import `RepoSwitcher` component
  - Position between Logo and controls
  - Add vertical divider (│) styling
  - Test responsive layout

- [ ] **Task 7**: Connect repo switching to data layer
  - Trigger React Query refetch on repo switch
  - Update current repo in app state
  - Test data reload flow

### Phase 4: Polish & Testing

- [ ] **Task 8**: Final polish
  - Add loading states during repo switch
  - Add empty state (no repos yet)
  - Add accessibility attributes (aria-*)
  - Test edge cases (storage quota, malformed data, cross-tab sync)
  - Test keyboard navigation (optional enhancement)
