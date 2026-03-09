---
total_tasks: 4
completed_tasks: 0
progress: 0
---

# Scan All Branches (Remove Pattern Filter) — Implementation Plan

## Tasks

- [ ] **Task 1**: Modify `BranchScanner.discoverBranches()` method
  - Change parameter from `pattern: string` to `scanAll: boolean`
  - When `scanAll = true`: call `getRefs('heads')` to get all branches
  - When `scanAll = false`: preserve legacy behavior (feature/* only)
  - Update error messages to reflect new parameter

- [ ] **Task 2**: Update `board.ts` API route
  - Change query parameter from `branch_pattern` to `scan_all`
  - Set default to `true` (scan all branches)
  - Pass boolean to `scanner.discoverBranches(scanAll)`

- [ ] **Task 3**: Test branch scanning
  - Verify `user/luna-chen/scan-all-branches` branch is scanned
  - Verify `user/luna-chen/repo-switcher` branch is scanned
  - Verify `feature/*` branches still work
  - Check Kanban board updates correctly

- [ ] **Task 4**: Commit and push changes
  - Commit with descriptive message
  - Push branch to remote
  - Verify Kanban shows status as `doing`
