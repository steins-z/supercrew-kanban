---
status: draft
reviewers: []
---

# Scan All Branches (Remove Pattern Filter) — Technical Design

## Design Decisions

### Remove Pattern-Based Filtering

**Decision**: Change `BranchScanner.discoverBranches()` from accepting a `pattern` parameter to accepting a `scanAll` boolean parameter.

**Rationale**:
- The current pattern-based approach (`pattern: string = 'feature/*'`) is too restrictive
- It requires maintaining a list of patterns for different branch naming conventions
- A boolean flag is simpler and covers the common cases:
  - `scanAll = true` (default): Scan all branches
  - `scanAll = false`: Only scan `feature/*` (legacy behavior for testing)

**Alternative Considered**: Multi-pattern support (e.g., `['feature/*', 'user/*']`)
- **Rejected**: More complex implementation, harder to reason about
- Can be added later if needed

### API Parameter Change

**Decision**: Change API query parameter from `branch_pattern` to `scan_all`.

**Rationale**:
- More intuitive: `?scan_all=true` vs `?branch_pattern=*`
- Default behavior becomes "scan everything" instead of "scan feature only"
- Backward compatible: old parameter is ignored, new default is safer

## Architecture

### Current Flow

```
Frontend → GET /api/board/multi-branch?branch_pattern=feature/*
             ↓
Backend: scanner.discoverBranches('feature/*')
             ↓
GitHub API: getRefs('heads/feature')
             ↓
Returns: ['main', 'feature/dev-branch-file-fetching']
```

### New Flow

```
Frontend → GET /api/board/multi-branch (no query param needed)
             ↓
Backend: scanner.discoverBranches(true)  // scanAll = true by default
             ↓
GitHub API: getRefs('heads')  // Get ALL branches
             ↓
Returns: ['main', 'feature/dev-branch-file-fetching',
          'user/luna-chen/repo-switcher',
          'user/luna-chen/scan-all-branches', ...]
```

### Code Changes

**File 1: `backend/src/services/branch-scanner.ts`**

```typescript
// OLD
async discoverBranches(pattern: string = 'feature/*'): Promise<string[]> {
  const prefix = pattern.replace('/*', '');
  const refs = await this.gh.getRefs(`heads/${prefix}`);
  // ...
}

// NEW
async discoverBranches(scanAll: boolean = true): Promise<string[]> {
  if (scanAll) {
    // Fetch all branches (no pattern filtering)
    const refs = await this.gh.getRefs('heads');
    branches.push(...refs.map((r) => r.ref.replace('refs/heads/', '')));
  } else {
    // Legacy: only scan feature/* branches
    const refs = await this.gh.getRefs('heads/feature');
    branches.push(...refs.map((r) => r.ref.replace('refs/heads/', '')));

    // Always include main if not present
    if (!branches.includes('main')) {
      branches.unshift('main');
    }
  }
}
```

**File 2: `backend/src/routes/board.ts`**

```typescript
// OLD
const branchPattern = c.req.query('branch_pattern') ?? 'feature/*';
const branches = await scanner.discoverBranches(branchPattern);

// NEW
const scanAll = c.req.query('scan_all') !== 'false'; // default true
const branches = await scanner.discoverBranches(scanAll);
```

## Implementation Notes

### GitHub API Endpoint

- `GET /repos/:owner/:repo/git/refs/heads` returns all branch refs
- `GET /repos/:owner/:repo/git/refs/heads/feature` returns only `feature/*` branches
- The existing `GitHubClient.getRefs()` method already supports both patterns

### Performance Impact

**Before**: ~2-3 branches scanned (main + feature/*)
**After**: Potentially 10-50+ branches (depends on repo)

**Rate Limit Calculation**:
- Each branch: 1 API call to list `.supercrew/tasks/` + N calls for each feature
- Example: 20 branches × (1 + 3 features × 3 files) = 20 + 180 = 200 API calls
- GitHub rate limit: 5000/hour (authenticated) = plenty of headroom

**Mitigations Already in Place**:
- `GitHubClient.checkRateLimit()` throws error when remaining < 100
- `Promise.allSettled` ensures one failed branch doesn't block others
- Empty branches (no `.supercrew/tasks/`) return quickly (404 cached)

### Error Handling

No changes needed — existing error handling covers:
- 404 errors (branch has no `.supercrew/tasks/`)
- Network errors (timeout, DNS)
- Rate limit errors (tracked via response headers)

### Backward Compatibility

- Frontend doesn't need changes (no query param = use default)
- Old query param `branch_pattern` is ignored (doesn't break existing calls)
- Legacy behavior (`scanAll = false`) preserved for testing

### Testing Strategy

1. **Local Testing**: Create branches with different patterns, verify all are scanned
2. **Rate Limit Testing**: Monitor `X-RateLimit-Remaining` header during full scan
3. **Performance Testing**: Measure response time with 10, 20, 50 branches
4. **Error Testing**: Test with branches that have no `.supercrew/tasks/`
