---
total_tasks: 3
completed_tasks: 3
progress: 100
---

# Local Git Remote Branch Support — Implementation Plan

## Tasks

- [x] **Task 1**: Modify `discoverBranches()` to preserve `origin/` prefix for remote branches
  - Location: [backend/src/services/local-git-scanner.ts:28-63](backend/src/services/local-git-scanner.ts#L28-L63)
  - Change branch mapping logic to keep `origin/` prefix for remote branches
  - Keep local branches as-is (no prefix)
  - Preserve deduplication and HEAD filtering logic
  - Expected result: Returns `['main', 'user/luna/feature', 'origin/user/qunmi/database-agent']`

- [x] **Task 2**: Update `listFeatureDirs()` to handle remote branches
  - Location: [backend/src/services/local-git-scanner.ts:135-149](backend/src/services/local-git-scanner.ts#L135-L149)
  - No changes needed — `${branch}:${FEATURES_PATH}` works with `origin/` prefix
  - Git correctly interprets `origin/branch:.supercrew/tasks` format
  - Test with `origin/user/qunmi/database-agent-reporting-api`

- [x] **Task 3**: Update `getFileContent()` to handle remote branches
  - Location: [backend/src/services/local-git-scanner.ts:151-161](backend/src/services/local-git-scanner.ts#L151-L161)
  - No changes needed — `${branch}:${filePath}` works with `origin/` prefix
  - Git correctly interprets `origin/branch:path` format
  - Base64 encoding works correctly for remote branches
