---
total_tasks: 4
completed_tasks: 4
progress: 100
---

# Scan All Branches (Remove Pattern Filter) — Implementation Plan

## Tasks

- [x] **Task 1**: Modify `BranchScanner.discoverBranches()` method
  - ✅ Changed parameter from `pattern: string` to `scanAll: boolean, branchPattern?: string`
  - ✅ When `scanAll = true`: call `getRefs('heads')` to get all branches
  - ✅ When `scanAll = false`: support flexible pattern filtering with comma-separated prefixes
  - ✅ Legacy behavior preserved: `scanAll = false` without pattern → feature/* only
  - ✅ Always include main branch when using pattern filtering

- [x] **Task 2**: Update `LocalGitScanner.discoverBranches()` method
  - ✅ Added same parameters as BranchScanner for consistency
  - ✅ When `scanAll = true`: return all branches (local + remote)
  - ✅ When `scanAll = false`: filter by pattern prefixes
  - ✅ Pattern matching works with both local and origin/* branches

- [x] **Task 3**: Update `board.ts` API route
  - ✅ Added `scanAll` query parameter (default: true)
  - ✅ Added `branchPattern` query parameter (optional)
  - ✅ Pass both parameters to scanners in both modes (local-git and github)
  - ✅ Both modes have identical parameter handling

- [x] **Task 4**: Test and validate
  - ✅ Verify all branches scanned by default
  - ✅ Verify pattern filtering works: `?scan_all=false&branch_pattern=user/,feature/`
  - ✅ Verify legacy behavior: `?scan_all=false` → feature/* only
  - ✅ Verify local-git mode includes origin/* remote branches
