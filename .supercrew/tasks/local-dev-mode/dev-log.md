# Local Dev Mode with Git Support — Development Log

## 2026-03-09 — Work Started

- Status changed: `todo` → `doing`
- Created dev-design.md, dev-plan.md, dev-log.md
- Branch: user/luna-chen/local-dev-mode
- Ready to begin implementation

### Problem Statement

GitHub API rate limit (5000/hour) blocks development after scanning all branches. Need local git mode to bypass API completely.

### Solution Design

- Add `?mode=local-git` query parameter
- Create `LocalGitScanner` class using `simple-git`
- Read branches and files from local git repo
- Return same `FileSnapshot[]` format as GitHub API
- Zero API consumption, unlimited development

### Implementation Plan

5 tasks: Install simple-git, create LocalGitScanner, update board.ts, test, commit

### Next Steps

- Install simple-git dependency
- Implement LocalGitScanner class
