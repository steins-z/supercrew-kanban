---
status: draft
reviewers: []
---

# Repository Switcher — Technical Design

## Design Decisions

### Component Architecture

**Decision**: Create a standalone `RepoSwitcher` component that integrates into `AppHeader`.

**Rationale**:
- Separation of concerns — keeps repo switching logic independent
- Reusable if we need repo selection in other contexts
- Easier to test and maintain
- Follows existing component pattern in the codebase

### State Management Approach

**Decision**: Use custom hook `useRepoSwitcher` + localStorage for persistence.

**Rationale**:
- No need for global state management (Redux/Context) for this feature
- localStorage is sufficient for client-side persistence
- Custom hook encapsulates all repo management logic
- Easy to test hook logic separately from UI

### Data Flow

```
User clicks repo
    ↓
useRepoSwitcher updates localStorage
    ↓
Trigger React Query refetch (or navigate)
    ↓
Kanban board reloads with new repo data
```

### Dropdown Implementation

**Decision**: Build custom dropdown instead of using a library.

**Rationale**:
- Existing codebase doesn't use a UI library (no shadcn/ui, Radix, etc.)
- Custom dropdown maintains visual consistency with `HeaderBtn`
- Full control over styling and behavior
- Lightweight implementation (no extra dependencies)

## Architecture

### Component Structure

```
AppHeader
├── Logo
├── RepoSwitcher           ← NEW
│   ├── Trigger Button     (owner/repo ▾)
│   └── Dropdown Menu
│       ├── Current Repo   (✓ marked)
│       ├── Recent Repos   (hover to show ×)
│       └── Add Repo CTA
├── LangToggle
├── ThemeToggle
├── Disconnect
└── Logout
```

### File Organization

```
frontend/packages/local-web/src/
├── components/
│   ├── RepoSwitcher.tsx         ← NEW: Main component
│   └── AppHeader.tsx            (modified to include RepoSwitcher)
├── hooks/
│   └── useRepoSwitcher.ts       ← NEW: Custom hook
└── types/
    └── repo.ts                  ← NEW: Type definitions
```

### Type Definitions

```typescript
// types/repo.ts
export interface RepoInfo {
  owner: string;
  repo: string;
  lastAccessed: string;        // ISO 8601 timestamp
  displayName?: string;         // Optional custom name
}

export interface RepoStorage {
  currentRepo: string;          // "owner/repo" format
  recentRepos: RepoInfo[];      // Max 10 items
}
```

### Hook API

```typescript
// hooks/useRepoSwitcher.ts
function useRepoSwitcher() {
  return {
    currentRepo: string | null,           // "owner/repo" or null
    recentRepos: RepoInfo[],              // Sorted by lastAccessed DESC
    switchRepo: (owner, repo) => void,    // Switch to a repo
    addRepo: (owner, repo) => void,       // Add new repo
    removeRepo: (owner, repo) => void,    // Remove from list
    isLoading: boolean,                   // Loading state during switch
  };
}
```

## Implementation Notes

### LocalStorage Key Convention

- Key: `supercrew:recentRepos`
- Format: JSON string of `RepoStorage`
- Migration: If old format exists, migrate gracefully

### Cross-Tab Synchronization

Listen to `storage` event:

```typescript
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'supercrew:recentRepos') {
      // Reload repo list from localStorage
    }
  };
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, []);
```

### Repo Switching Logic

When user clicks a repo in the dropdown:

1. Update localStorage:
   - Set `currentRepo` to selected repo
   - Update `lastAccessed` timestamp for that repo
   - Re-sort `recentRepos` array

2. Trigger data reload:
   - Option A: Use React Router's `navigate(0)` to hard refresh
   - Option B: Use React Query's `queryClient.invalidateQueries()` to refetch

3. Close dropdown menu

### Adding New Repo Flow

When user clicks "+ Connect Another Repo":

1. Store intent in localStorage (e.g., `supercrew:pendingRepoAdd = true`)
2. Navigate to OAuth flow (same as current "Connect" flow)
3. After OAuth callback, check for `pendingRepoAdd` flag
4. If true, add new repo to `recentRepos` and clear flag
5. Set as `currentRepo` and load board

### Removing Repo Logic

When user clicks × on a repo item:

- Remove from `recentRepos` array
- Update localStorage
- Do NOT allow removing current repo (disable × button)
- If list becomes empty after removal, show empty state

### Edge Cases

1. **No repos in localStorage** (first-time user):
   - Show empty state or hide switcher until first repo is connected
   - After OAuth, auto-add first repo

2. **Current repo not in recent list**:
   - Auto-add current repo to list on component mount

3. **LocalStorage quota exceeded**:
   - Limit to 10 repos (should never exceed quota)
   - If needed, remove oldest repos first

4. **Malformed data in localStorage**:
   - Wrap JSON.parse in try-catch
   - Fallback to empty state if parse fails

### Styling Considerations

- Match existing `HeaderBtn` hover/active states
- Use CSS variables for colors (e.g., `hsl(var(--text-low))`)
- Dropdown positioned absolutely below trigger
- Use `z-index` to ensure dropdown appears above content
- Add subtle box-shadow for depth
- Smooth transitions for hover/open/close states

### Performance

- Debounce storage event listener to avoid excessive re-renders
- Memoize repo list to avoid re-sorting on every render
- Use `React.memo` for dropdown items if list is large (unlikely with max 10)

### Accessibility

- Add `aria-label` to trigger button
- Use `aria-expanded` to indicate dropdown state
- Keyboard navigation: Enter to open, Arrow keys to navigate, Escape to close
- Focus management: return focus to trigger after selecting item
