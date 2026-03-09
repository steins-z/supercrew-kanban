# Scan All Branches (Remove Pattern Filter) — Development Log

## 2026-03-09 — Work Started

- Status changed: `todo` → `doing`
- Created dev-design.md, dev-plan.md, dev-log.md
- Branch: user/luna-chen/scan-all-branches
- Ready to begin implementation

### Problem Statement

Current backend only scans `feature/*` branches, causing `user/*` branches to be invisible on Kanban board.

### Solution Design

- Change `BranchScanner.discoverBranches(pattern)` → `discoverBranches(scanAll: boolean)`
- Default `scanAll = true` → calls `getRefs('heads')` for all branches
- Legacy `scanAll = false` → keeps `feature/*` behavior for testing

### Implementation Plan

4 tasks: Modify branch-scanner.ts, update board.ts, test, commit & push

### Next Steps

- Implement Task 1: Modify BranchScanner.discoverBranches()
