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

### Next Steps

- [ ] Create `types/repo.ts` with interfaces
- [ ] Implement `useRepoSwitcher` hook with localStorage
- [ ] Build `RepoSwitcher.tsx` component
