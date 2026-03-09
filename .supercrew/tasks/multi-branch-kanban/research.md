# Codebase Research: Multi-Branch GitHub API & Parallel Fetching

> **Date:** 2026-03-05
> **Query:** Find similar implementations of multi-branch GitHub API calls, parallel fetching patterns, and diff/deduplication logic

## Summary

Found existing parallel fetching patterns using `Promise.all` in frontend API client. Backend is minimal (OAuth only). No existing multi-branch or diff logic. **Recommendation: Implement Fresh** with new backend services, but reuse frontend patterns.

---

## Related Code

| File | Relevance | Notes |
|------|-----------|-------|
| `frontend/packages/app-core/src/api.ts` | **High** | Existing GitHub API client with parallel fetch patterns |
| `backend/src/index.ts` | **Medium** | Minimal backend (OAuth only), shows Hono routing structure |

### Key Patterns Found

#### 1. Parallel Fetching Pattern (Frontend)

**Location:** `frontend/packages/app-core/src/api.ts:197-200`

```typescript
const featureDirs = dirs.filter(d => d.type === 'dir')
const metas = await Promise.all(
  featureDirs.map(d => fetchFeatureMeta(d.name))
)
return metas.filter(Boolean) as FeatureMeta[]
```

**Also used in:** `fetchFeature()` (line 232) to fetch design.md and plan.md in parallel

**Pattern:**
- Map array to promises
- `Promise.all` for parallel execution
- Filter out nulls/errors after completion

#### 2. GitHub API Client Pattern

**Location:** `frontend/packages/app-core/src/api.ts:17-26`

```typescript
async function ghFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${GH_API}${path}`, { headers: ghHeaders() })
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) return null
  return res.json() as Promise<T>
}
```

**Pattern:**
- Generic type support
- 401 handling (clear token, redirect)
- Null on error (graceful degradation)

#### 3. Backend Structure (Minimal)

**Location:** `backend/src/index.ts`

```typescript
export const app = new Hono()

app.use('*', cors({ /* ... */ }))
app.get('/auth/github', /* ... */)
app.get('/auth/callback', /* ... */)
app.get('/health', /* ... */)

export default { port: PORT, fetch: app.fetch }
```

**Pattern:**
- Hono framework
- CORS middleware on all routes
- Export app for Vercel + default for Bun

---

## Related Documentation

**None found** - No `docs/` directory exists in this codebase.

---

## Git History

**`frontend/packages/app-core/src/api.ts`:**
- `c88e030` - "supercrew kanban v0" (2026-03-05) - Initial API client implementation

**`backend/src/index.ts`:**
- `c88e030` - "supercrew kanban v0" (2026-03-05) - Initial backend with OAuth

---

## What's Missing

| Need | Status |
|------|--------|
| Multi-branch fetching | ❌ Not implemented |
| Backend GitHub API client | ❌ Backend only does OAuth |
| Diff/deduplication logic | ❌ No hashing or comparison |
| Backend services/routes structure | ❌ No `services/` or `routes/` directories |
| Error aggregation (partial failures) | ❌ No `Promise.allSettled` usage |

---

## Recommendation

**Action:** **Implement Fresh** - Create new backend services

**Rationale:**
1. **Parallel fetching pattern exists** - Can reuse `Promise.all` pattern from frontend
2. **No multi-branch logic** - This is a new capability
3. **Backend is minimal** - No services layer, just OAuth routes
4. **Clean slate for backend** - Good opportunity to establish patterns for future features

**Suggested Approach:**

### Backend Architecture (New)
```
backend/src/
├── index.ts              # Existing: OAuth routes
├── routes/
│   └── board.ts          # NEW: /api/board/multi-branch endpoint
├── services/
│   ├── github.ts         # NEW: GitHub API client (reuse ghFetch pattern)
│   ├── branch-scanner.ts # NEW: Branch discovery + parallel fetch
│   └── feature-diff.ts   # NEW: Hash + deduplication logic
└── types/
    └── board.ts          # NEW: Shared types
```

### Reuse Patterns
1. **GitHub API client** - Adapt `ghFetch()` pattern for backend:
   - Same error handling (401, etc.)
   - Same null-on-error pattern
   - Accept token as parameter (not from localStorage)

2. **Parallel fetching** - Upgrade to `Promise.allSettled` for partial failures:
   ```typescript
   const results = await Promise.allSettled(
     branches.map(b => fetchBranch(b))
   )
   // Collect successes, log failures
   ```

3. **Hono routing** - Follow existing pattern:
   ```typescript
   import { boardRouter } from './routes/board.js'
   app.route('/api/board', boardRouter)
   ```

### New Patterns to Introduce
1. **Hash-based diff** - Use Node.js `crypto.createHash('md5')`
2. **Branch scanning** - GitHub API: `GET /repos/{owner}/{repo}/git/refs/heads/feature`
3. **Query parameters** - GitHub Contents API: `?ref={branch}`

---

## Risk Areas

1. **No existing backend services pattern** - We're establishing the first one
2. **Rate limiting** - GitHub API: 5000 req/hour (authenticated)
3. **Vercel serverless limits** - 10s timeout, no persistent state
4. **No TypeScript in backend yet** - Need to set up types properly

---

## Next Steps

1. ✅ Research complete
2. → Clarify design questions via brainstorming
3. → Create implementation plan
4. → Set up backend directory structure
5. → Implement services layer
