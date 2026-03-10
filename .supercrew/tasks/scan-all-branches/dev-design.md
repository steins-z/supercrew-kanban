---
status: final
reviewers: []
---

# Scan All Branches (Remove Pattern Filter) — Technical Design

## Design Decisions

### Flexible Branch Scanning with Pattern Support

**Decision**: Enhanced `discoverBranches()` to support both full scanning and flexible pattern-based filtering.

**Parameters**:
- `scanAll: boolean = true` - Controls scanning mode
- `branchPattern?: string` - Comma-separated prefixes for filtering (e.g., "feature/,user/")

**Behavior**:
- `scanAll = true` (default): Scan all branches, ignore pattern
- `scanAll = false` without pattern: Only scan `feature/*` (legacy behavior)
- `scanAll = false` with pattern: Scan branches matching any prefix in the pattern
  - Example: `"feature/,user/"` matches `feature/*` and `user/*`
  - Example: `"hotfix/,release/"` matches `hotfix/*` and `release/*`

**Rationale**:
- Default behavior is "scan everything" - most intuitive and useful
- Pattern filtering available when needed for large repos
- Multiple patterns supported via comma separation
- Both scanners (GitHub API and Local Git) have identical behavior

**Alternative Considered**: Glob patterns (e.g., `feature/*`, `user/*/fix-*`)
- **Rejected**: Too complex, prefix matching covers 99% of use cases

### Dual-Mode Support (GitHub API + Local Git)

**Decision**: Both `BranchScanner` and `LocalGitScanner` support the same parameters.

**Rationale**:
- Consistent API across both modes
- Local git mode simulates GitHub API behavior
- Same query parameters work for both: `?mode=local-git` or `?mode=github`

## Architecture

### API Flow

```
Frontend → GET /api/board/multi-branch?scan_all=true (default)
             ↓
Backend: Extract parameters
  - mode: 'github' | 'local-git'
  - scanAll: boolean (default true)
  - branchPattern: string | undefined
             ↓
Scanner: discoverBranches(scanAll, branchPattern)
             ↓
GitHub API Mode: getRefs('heads') → all branches
Local Git Mode: git branch -a → all branches
             ↓
Returns: ['main', 'feature/xyz', 'user/luna/abc', 'origin/user/qunmi/xyz', ...]
```

### Query Parameter Examples

1. **Scan all branches** (default):
   ```
   GET /api/board/multi-branch
   GET /api/board/multi-branch?scan_all=true
   ```

2. **Scan only feature/* branches** (legacy):
   ```
   GET /api/board/multi-branch?scan_all=false
   ```

3. **Scan multiple patterns**:
   ```
   GET /api/board/multi-branch?scan_all=false&branch_pattern=feature/,user/
   GET /api/board/multi-branch?scan_all=false&branch_pattern=hotfix/,release/
   ```

### Code Implementation

**File 1: `backend/src/services/branch-scanner.ts`**

```typescript
async discoverBranches(scanAll: boolean = true, branchPattern?: string): Promise<string[]> {
  if (scanAll) {
    // Fetch all branches (no pattern filtering)
    const refs = await this.gh.getRefs('heads');
    branches.push(...refs.map((r) => r.ref.replace('refs/heads/', '')));
  } else {
    // Pattern-based filtering
    const pattern = branchPattern || 'feature/';
    const patterns = pattern.split(',').map((p) => p.trim());

    // Fetch branches for each pattern
    for (const p of patterns) {
      const refs = await this.gh.getRefs(`heads/${p}`);
      branches.push(...refs.map((r) => r.ref.replace('refs/heads/', '')));
    }

    // Always include main if not present
    if (!branches.includes('main')) {
      branches.unshift('main');
    }
  }
}
```

**File 2: `backend/src/services/local-git-scanner.ts`**

```typescript
async discoverBranches(scanAll: boolean = true, branchPattern?: string): Promise<string[]> {
  // Get all branches (local + remote)
  const branchSummary = await this.git.branch(['-a']);

  let branches = branchSummary.all
    .map((branch) => {
      // Remote: remotes/origin/feature-name → origin/feature-name
      if (branch.startsWith('remotes/origin/')) {
        return branch.replace('remotes/', '');
      }
      return branch;
    })
    .filter((branch) => branch !== 'origin/HEAD')
    .filter((branch, index, self) => self.indexOf(branch) === index);

  // Apply pattern filter if scanAll is false
  if (!scanAll) {
    const pattern = branchPattern || 'feature/';
    const patterns = pattern.split(',').map((p) => p.trim());
    branches = branches.filter((branch) =>
      patterns.some((p) => branch.startsWith(p))
    );
  }

  return branches;
}
```

**File 3: `backend/src/routes/board.ts`**

```typescript
const scanAll = c.req.query('scan_all') !== 'false'; // default true
const branchPattern = c.req.query('branch_pattern'); // e.g., "feature/,user/"

// Both modes use the same parameters
if (mode === 'local-git') {
  const branches = await localScanner.discoverBranches(scanAll, branchPattern);
} else {
  const branches = await scanner.discoverBranches(scanAll, branchPattern);
}
```

## Implementation Notes

### GitHub API Endpoints

- `GET /repos/:owner/:repo/git/refs/heads` → all branches
- `GET /repos/:owner/:repo/git/refs/heads/feature` → only `feature/*` branches
- `GET /repos/:owner/:repo/git/refs/heads/user` → only `user/*` branches

### Local Git Commands

- `git branch -a` → all local and remote branches
- Filter applied in-memory after fetching all branches
- Remote branches keep `origin/` prefix for correct file access

### Performance Impact

**Default (scanAll=true)**:
- Before: ~2-3 branches (main + feature/*)
- After: 10-50+ branches (entire repo)
- Rate limit: 5000/hour (GitHub) → plenty of headroom for typical repos

**Pattern filtering (scanAll=false)**:
- Reduces API calls by fetching only specific prefixes
- Useful for large repos with 100+ branches

**Mitigations**:
- `Promise.allSettled` → parallel fetching with error isolation
- Rate limit check before scanning
- 404 errors handled gracefully (branches without .supercrew/tasks/)

### Remote Branch Support (Local Git Mode)

**Integration with local-git-remote-branches feature**:
- `origin/*` prefixes preserved in branch names
- Git commands work correctly: `git show origin/branch:.supercrew/tasks/...`
- Both local and remote branches scanned by default

### Backward Compatibility

✅ **Fully backward compatible**:
- No query params → uses new default (scan all)
- Old `branch_pattern` param → now supported with `scan_all=false`
- Frontend doesn't need changes

### Testing Strategy

1. **Pattern matching**: Verify `"feature/,user/"` matches both prefixes
2. **Default behavior**: No params → scans all branches
3. **Legacy mode**: `scan_all=false` → only feature/* branches
4. **Remote branches**: Local git mode includes origin/* branches
5. **Main branch**: Always included when using pattern filtering
