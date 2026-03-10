---
total_tasks: 5
completed_tasks: 0
progress: 0
---

# Local Dev Mode with Git Support — Implementation Plan

## Tasks

- [ ] **Task 1**: Install simple-git dependency
  - Add `simple-git` to backend/package.json dependencies
  - Run `pnpm install` in backend directory
  - Verify installation

- [ ] **Task 2**: Create LocalGitScanner class
  - Create `backend/src/services/local-git-scanner.ts`
  - Implement constructor with repoPath validation
  - Implement `discoverBranches()` method
  - Implement `fetchAllFeatures()` method
  - Implement `listFeatureDirs()` helper
  - Implement `getFileContent()` helper
  - Add error handling for all git operations

- [ ] **Task 3**: Update board.ts route
  - Add mode detection: `const mode = c.req.query('mode') || 'github'`
  - Add conditional logic: if local-git, use LocalGitScanner
  - Handle repo_path parameter
  - Keep existing GitHub API flow unchanged

- [ ] **Task 4**: Test local mode
  - Start backend in dev mode
  - Test with `?mode=local-git`
  - Verify branches are listed correctly
  - Verify features are fetched correctly
  - Compare output with GitHub mode

- [ ] **Task 5**: Commit and push
  - Commit changes with descriptive message
  - Push branch to remote
  - Update dev-log.md with completion notes
