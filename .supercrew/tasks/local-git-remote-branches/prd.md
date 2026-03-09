---
status: draft
reviewers: []
---

# Local Git Remote Branch Support

## Background

Local Git mode currently cannot read `.supercrew/tasks/` files from remote tracking branches (e.g., `origin/user/qunmi/database-agent-reporting-api`). This limitation causes:

1. **Incomplete feature visibility** - Remote branches appear in `scannedBranches` but have no feature data
2. **Windows compatibility issues** - Git Bash on Windows has path separator issues when running `git show origin/branch:path`
3. **Inconsistent experience** - Only local branches show feature data, remote branches are invisible
4. **Workaround required** - Users must manually checkout remote branches to see their features

**Current behavior:**
- `discoverBranches()` returns both local and remote branches
- `listFeatureDirs()` and `getFileContent()` fail silently for `origin/*` branches
- Result: Remote branches listed but no features extracted

**Example:**
- Branch `origin/user/qunmi/database-agent-reporting-api` appears in metadata
- But `database-agent-reporting-api` feature is missing from features list

## Requirements

1. **Detect remote branches** - Identify when a branch name has `origin/` prefix
2. **Read remote branch files** - Successfully execute `git show origin/branch:path` commands
3. **Cross-platform compatibility** - Handle both Windows and Unix path separators correctly
4. **Maintain data format** - Return same base64-encoded FileSnapshot format as local branches
5. **Error handling** - Gracefully handle missing files or inaccessible branches
6. **Performance** - Maintain parallel processing for all branches (local + remote)

## Out of Scope

- Fetching new branches from remote (users should run `git fetch` manually)
- Creating or checking out local branches from remote branches
- Modifying remote branch content
- Handling branches from remotes other than `origin`
