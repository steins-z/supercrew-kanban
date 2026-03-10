---
status: draft
reviewers: []
---

# Local Git Remote Branch Support — Technical Design

## Design Decisions

### 1. Remote Branch Detection Strategy

**Decision**: Check for `origin/` prefix in branch names to determine remote branches.

**Rationale**:
- `discoverBranches()` already strips `remotes/origin/` prefix for deduplication
- We need to preserve `origin/` prefix internally for git operations
- Simple string check is fast and reliable

### 2. Git Command Adaptation for Remote Branches

**Decision**: Use `origin/<branch-name>` format for git commands when accessing remote branches.

**Rationale**:
- `git ls-tree` and `git show` require full remote reference format
- Current implementation uses `${branch}:${path}` which fails for remote branches on Windows
- Git accepts `origin/branch-name:path` format for both Unix and Windows

### 3. Cross-Platform Path Handling

**Decision**: Always use forward slashes in git commands, regardless of OS.

**Rationale**:
- Git internally uses Unix-style paths even on Windows
- `FEATURES_PATH` already uses forward slashes: `.supercrew/tasks`
- No path conversion needed, just consistent usage

## Architecture

### Current Flow (Broken for Remote Branches)

```
discoverBranches()
  → Returns: ['main', 'user/luna/feature', 'user/qunmi/database-agent']
  → Branch type: ambiguous (could be local or remote)

listFeatureDirs(branch)
  → Calls: git ls-tree --name-only ${branch}:.supercrew/tasks
  → Fails silently for remote branches on Windows
  → Returns: [] (empty)

getFileContent(branch, filePath)
  → Calls: git show ${branch}:${filePath}
  → Fails silently for remote branches on Windows
  → Returns: null
```

### New Flow (Fixed)

```
discoverBranches()
  → Returns: ['main', 'user/luna/feature', 'origin/user/qunmi/database-agent']
  → Branch type: explicit (origin/ prefix indicates remote)

listFeatureDirs(branch)
  → Detects: branch.startsWith('origin/')
  → Calls: git ls-tree --name-only origin/branch:.supercrew/tasks
  → Works on both Windows and Unix
  → Returns: ['database-agent']

getFileContent(branch, filePath)
  → Detects: branch.startsWith('origin/')
  → Calls: git show origin/branch:.supercrew/tasks/...
  → Works on both Windows and Unix
  → Returns: base64 content
```

## Implementation Notes

### Changes Required

1. **`discoverBranches()` method** (line 28-63):
   - Stop stripping `origin/` prefix for remote branches
   - Keep local branches as-is
   - Preserve deduplication logic

2. **`listFeatureDirs()` method** (line 135-149):
   - Add remote branch detection
   - Use `origin/${branch}` format for remote branches
   - No changes needed for local branches

3. **`getFileContent()` method** (line 151-161):
   - Add remote branch detection
   - Use `origin/${branch}` format for remote branches
   - No changes needed for local branches

### Edge Cases

1. **Remote branch without local tracking**: Works (reads from origin reference)
2. **Remote branch with local tracking**: Both appear, but different branch names
3. **HEAD pointer**: Already filtered in discoverBranches()
4. **Detached branches**: Not returned by `git branch -a`
5. **Non-origin remotes**: Out of scope (only support origin)

### Testing Strategy

1. Verify `origin/user/qunmi/database-agent-reporting-api` shows feature data
2. Verify local branches still work (no regression)
3. Test on both Windows and Unix-like systems
4. Check deduplication still works correctly
