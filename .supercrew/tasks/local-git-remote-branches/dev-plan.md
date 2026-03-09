---
total_tasks: 3
completed_tasks: 0
progress: 0
---

# Local Git Remote Branch Support — Implementation Plan

## Tasks

- [ ] **Task 1**: Modify `discoverBranches()` to preserve `origin/` prefix for remote branches
  - Location: [backend/src/services/local-git-scanner.ts:28-63](backend/src/services/local-git-scanner.ts#L28-L63)
  - Change branch mapping logic to keep `origin/` prefix for remote branches
  - Keep local branches as-is (no prefix)
  - Preserve deduplication and HEAD filtering logic
  - Expected result: Returns `['main', 'user/luna/feature', 'origin/user/qunmi/database-agent']`

- [ ] **Task 2**: Update `listFeatureDirs()` to handle remote branches
  - Location: [backend/src/services/local-git-scanner.ts:135-149](backend/src/services/local-git-scanner.ts#L135-L149)
  - Detect if branch starts with `origin/`
  - For remote branches: use `${branch}:${FEATURES_PATH}` (already has origin/ prefix)
  - For local branches: use `${branch}:${FEATURES_PATH}` (no change)
  - Test with `origin/user/qunmi/database-agent-reporting-api`

- [ ] **Task 3**: Update `getFileContent()` to handle remote branches
  - Location: [backend/src/services/local-git-scanner.ts:151-161](backend/src/services/local-git-scanner.ts#L151-L161)
  - Detect if branch starts with `origin/`
  - For remote branches: use `${branch}:${filePath}` (already has origin/ prefix)
  - For local branches: use `${branch}:${filePath}` (no change)
  - Verify base64 encoding still works correctly
