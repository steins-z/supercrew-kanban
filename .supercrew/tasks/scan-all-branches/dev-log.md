# Scan All Branches (Remove Pattern Filter) — Development Log

## 2026-03-09 — Work Started

- Status changed: `todo` → `doing`
- Created dev-design.md, dev-plan.md, dev-log.md
- Branch: user/luna-chen/scan-all-branches
- Ready to begin implementation

### Problem Statement

Current backend only scans `feature/*` branches, causing `user/*` branches to be invisible on Kanban board.

### Solution Design

- Change `BranchScanner.discoverBranches(pattern)` → `discoverBranches(scanAll: boolean, branchPattern?: string)`
- Default `scanAll = true` → calls `getRefs('heads')` for all branches
- Pattern support: `scanAll = false` with optional comma-separated pattern prefixes

### Implementation Plan

4 tasks: Modify BranchScanner, modify LocalGitScanner, update board.ts, test & validate

## 2026-03-09 — Implementation Complete

### Changes Made

**Commit 1: Add scanAll parameter to local-git mode**
- Modified `LocalGitScanner.discoverBranches()` to accept `scanAll` parameter
- Updated `board.ts` to pass `scanAll` to localScanner
- Both modes (github + local-git) now support scan_all query parameter

**Commit 2: Add flexible branch pattern filtering**
- Enhanced both scanners with `branchPattern` parameter
- Support comma-separated patterns: `"feature/,user/"` matches both prefixes
- Pattern matching uses `startsWith()` for each comma-separated prefix
- Main branch always included when using pattern filtering
- Updated API to accept `branch_pattern` query parameter

### Key Insights

1. **Dual Scanner Consistency**: Both `BranchScanner` (GitHub API) and `LocalGitScanner` (local git) have identical signatures and behavior
2. **Flexible Filtering**: Pattern parameter supports multiple prefixes via comma separation
3. **Safe Defaults**: `scanAll=true` by default means no configuration needed for most users
4. **Remote Branch Integration**: Works seamlessly with local-git-remote-branches feature (origin/* prefixes preserved)

### API Examples

```bash
# Scan all branches (default)
GET /api/board/multi-branch

# Scan only feature/* branches (legacy)
GET /api/board/multi-branch?scan_all=false

# Scan feature/* and user/* branches
GET /api/board/multi-branch?scan_all=false&branch_pattern=feature/,user/

# Local git mode with pattern filtering
GET /api/board/multi-branch?mode=local-git&scan_all=false&branch_pattern=user/
```

### Testing Results

✅ Default behavior: All branches scanned (local + remote in local-git mode)
✅ Pattern filtering: Multiple comma-separated patterns work correctly
✅ Legacy mode: `scan_all=false` without pattern → feature/* only
✅ Remote branches: origin/* branches included in local-git mode
✅ Main branch: Always present when using pattern filtering

### Performance Notes

- GitHub API mode: Fetches only matching refs when using patterns (efficient)
- Local git mode: Fetches all branches, filters in-memory (fast enough for typical repos)
- No noticeable performance impact with 10-20 branches

## 2026-03-09 — Ready to Ship

- All 4 tasks completed (100% progress)
- Feature fully implemented and tested
- Documentation updated (design, plan, log)
- Ready for code review and merge
