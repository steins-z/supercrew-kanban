---
status: draft
reviewers: []
---

# Support User Branch Pattern Scanning — Technical Design

## Design Decisions

### Multiple Pattern Support

Instead of replacing `feature/*` with `user/*`, support multiple patterns simultaneously to maintain backward compatibility and flexibility.

**Decision**: Modify `discoverBranches()` to accept an array of patterns and merge results.

**Rationale**:
- Organizations may use different branch naming conventions
- Allows gradual migration from `feature/*` to `user/*` patterns
- Simple to extend for additional patterns in the future

### API Interface

**Decision**: Accept comma-separated patterns in query parameter `branch_pattern`.

Example: `?branch_pattern=user/*,feature/*`

**Rationale**:
- Minimal API change
- Easy to use from frontend
- URL-friendly format

## Architecture

### Backend Changes

**File**: `backend/src/services/branch-scanner.ts`

1. Modify `discoverBranches(pattern: string)` to `discoverBranches(patterns: string[])`
2. Loop through patterns and collect all matching branches
3. Deduplicate branch list
4. Keep `main` branch always included

**File**: `backend/src/routes/board.ts`

1. Parse `branch_pattern` query param: split by comma
2. Default to `['user/*', 'feature/*']` if not provided
3. Pass array to `scanner.discoverBranches(patterns)`

### Frontend Changes

**File**: `frontend/packages/app-core/src/api.ts`

1. Update `fetchBoard()` to pass `branch_pattern=user/*,feature/*` in query
2. Make pattern configurable (optional future enhancement)

## Implementation Notes

### Edge Cases

- Empty pattern array → return only `main` branch
- Duplicate branches from overlapping patterns → use `Set` for deduplication
- Invalid patterns → GitHub API will return empty results, no special handling needed

### Backward Compatibility

- If `branch_pattern` is not provided, default to `['user/*', 'feature/*']`
- Single pattern (old format) still works: `?branch_pattern=feature/*` will be split as `['feature/*']`

### Testing

- Test with `user/*` pattern matches user branches
- Test with `user/*,feature/*` returns merged results
- Test main branch always included
- Test empty/missing pattern uses default
