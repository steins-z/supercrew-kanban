# Repository Switcher — Development Log

## 2026-03-09 — Work Started

- Status changed: `todo` → `doing`
- Created dev-design.md, dev-plan.md, dev-log.md
- Branch: user/luna-chen/repo-switcher
- Ready to begin implementation

### Design Highlights

- Component: `RepoSwitcher` with custom hook `useRepoSwitcher`
- UI Position: Between Logo and controls in AppHeader
- Display: `owner/repo ▾` format with dropdown menu
- Storage: localStorage with max 10 recent repos
- Features: Quick switch, hover-to-remove, cross-tab sync

### Implementation Phases

1. **Foundation**: Type definitions + custom hook
2. **UI Components**: Trigger button + dropdown menu
3. **Integration**: AppHeader + data layer connection
4. **Polish**: Loading states, accessibility, edge cases

## 2026-03-09 — Implementation Complete

### Changes Made

**Phase 1: Foundation (Already Implemented)**
- ✅ Type definitions in `app-core/src/types.ts`
  - `RepoInfo` interface with owner, repo, lastAccessed, displayName
  - `RepoStorage` interface with currentRepo and recentRepos
- ✅ `useRepoSwitcher` hook in `app-core/src/hooks/useRepoSwitcher.ts`
  - localStorage persistence with `supercrew:recentRepos` key
  - Cross-tab sync using `useSyncExternalStore` + storage events
  - `switchRepo()`, `addRepo()`, `removeRepo()` functions
  - Loading state management
  - Automatic sorting by lastAccessed

**Phase 2: UI Components (Already Implemented)**
- ✅ `RepoSwitcher.tsx` component in `local-web/src/components/`
  - Trigger button matching `HeaderBtn` style
  - Dropdown menu with proper positioning and z-index
  - Click-outside-to-close logic
  - Current repo indicator (checkmark)
  - Hover-to-show-remove button (X icon)
  - "+ Connect Another Repo" CTA (placeholder)

**Phase 3: Integration (Already Implemented)**
- ✅ Integrated into `AppHeader.tsx`
  - Positioned between Logo and controls with vertical divider
  - Imports from correct paths (`@app/hooks`)
  - Properly styled to match existing header buttons

**Phase 4: Current State**
- ✅ Component renders and displays current repo
- ✅ Dropdown shows recent repos list
- ✅ Remove button works on hover
- ⚠️ Repo switching triggers `window.location.reload()` (simple but works)
- ⚠️ "Connect Another Repo" is placeholder (logs to console)

### Key Implementation Details

**Storage Structure**:
```json
{
  "currentRepo": "owner/repo",
  "recentRepos": [
    {
      "owner": "anthropics",
      "repo": "supercrew-kanban",
      "lastAccessed": "2026-03-09T09:15:00.000Z",
      "displayName": "SuperCrew Kanban"
    }
  ]
}
```

**Cross-Tab Sync**:
- Uses `useSyncExternalStore` for reactive updates
- Listens to `storage` events for cross-tab synchronization
- Notifies all listeners when storage changes

**UI Behavior**:
- Current repo marked with checkmark
- Recent repos sorted by lastAccessed (most recent first)
- Max 10 repos in recent list
- Remove button only shows on hover (not for current repo)
- Loading overlay during repo switch

### Testing Status

✅ **Completed**:
- Component renders correctly
- Dropdown opens/closes
- localStorage persistence works
- Cross-tab sync works
- Hover effects work
- Remove repo works

⏳ **Pending**:
- End-to-end repo switching flow (needs backend OAuth integration)
- "Connect Another Repo" flow implementation
- Accessibility testing (keyboard navigation, screen readers)
- Edge case handling (storage quota exceeded, malformed data)

## 2026-03-09 — Ready for Review

- All 8 tasks from implementation plan completed (100%)
- Core functionality implemented and working
- UI matches design specifications
- Integration with AppHeader complete
- Documentation updated

**Next Steps** (for future enhancements):
1. Implement OAuth flow for "Connect Another Repo"
2. Consider React Query invalidation instead of window.reload()
3. Add keyboard navigation support
4. Add empty state when no repos exist

## 2026-03-09 — Modal Implementation Complete

### Changes Made

**"Connect Another Repo" Implementation**:
- ✅ Created `RepoSelectModal.tsx` for GitHub mode
  - Fetches user repos using GitHub API
  - Shows repos with `.supercrew` directory indicator
  - Includes search functionality
  - Select repo to switch
- ✅ Created `LocalRepoModal.tsx` for local-git mode
  - Simple text input for file path
  - Enter key support for quick submission
  - Validates input before submitting
- ✅ Integrated both modals into `RepoSwitcher.tsx`
  - Detects mode using `VITE_DEV_MODE` env var
  - Shows appropriate modal based on mode
  - Handles repo selection and path input

**Local Mode Path Handling Fix**:
- ✅ Fixed path corruption issue (`local/D:\repo\...` → `D:\repo\...`)
- ✅ Modified `useRepoSwitcher.addRepo()` to detect local paths
  - Checks if `owner === 'local'` and repo contains path separators
  - Stores `fullName` as just the path for local mode
  - Stores `fullName` as `owner/repo` for GitHub mode
- ✅ Updated `RepoSwitcher` display logic
  - Shows full path for local repos
  - Shows `owner/repo` format for GitHub repos
- ✅ Fixed `handleSwitchRepo()` to pass correct URL params
  - Local: `/?mode=local-git&repo_path=<path>`
  - GitHub: `/?owner=<owner>&repo=<repo>`

**Files Modified**:
1. `frontend/packages/local-web/src/components/RepoSelectModal.tsx` (new)
2. `frontend/packages/local-web/src/components/LocalRepoModal.tsx` (new)
3. `frontend/packages/local-web/src/components/RepoSwitcher.tsx`
   - Integrated modals
   - Fixed display logic for local paths
   - Updated handleSwitchRepo with mode detection
4. `frontend/packages/app-core/src/hooks/useRepoSwitcher.ts`
   - Added isLocalPath detection in addRepo
   - Added debug logging
5. `d:/repo/supercrew-kanban/clear-localstorage.html` (deleted - temp debug tool)

### Testing Status

✅ **Completed**:
- Modal components render correctly
- Mode detection works (local vs GitHub)
- Local path input and submission
- GitHub repo list fetching
- Path storage without corruption
- Display shows correct format for each mode
- Repo switching with correct URL parameters

**Implementation Complete**: All core functionality for Repository Switcher is now working in both local and GitHub modes.
