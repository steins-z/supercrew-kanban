---
total_tasks: 22
completed_tasks: 17
progress: 77
---

# Multi-Branch Kanban — Implementation Plan

## Phase 1: Backend Foundation (8 tasks)

- [x] Task 1.1: Create backend types for multi-branch response
  - File(s): `backend/src/types/board.ts`
  - Acceptance: TypeScript interfaces defined for `FeatureMetaWithBranches`, `BranchInfo`, `BranchError`, `BoardResponse`

- [x] Task 1.2: Create GitHub API client wrapper
  - File(s): `backend/src/services/github.ts`
  - Acceptance: `GitHubClient` class with methods: `getRefs()`, `listFeatureDirs()`, `getFileContent()`, rate limit tracking

- [x] Task 1.3: Create file snapshot structure
  - File(s): `backend/src/services/branch-scanner.ts`
  - Acceptance: `FileSnapshot` interface and `BranchScanner` class skeleton

- [x] Task 1.4: Implement branch discovery
  - File(s): `backend/src/services/branch-scanner.ts`
  - Acceptance: `discoverBranches()` method returns main + feature/* branches

- [x] Task 1.5: Implement parallel feature fetching
  - File(s): `backend/src/services/branch-scanner.ts`
  - Acceptance: `fetchAllFeatures()` uses Promise.allSettled, returns FileSnapshot[]

- [x] Task 1.6: Create diff service with hash computation
  - File(s): `backend/src/services/feature-diff.ts`
  - Acceptance: `FeatureDiff` class with `computeHash()` using MD5

- [x] Task 1.7: Implement deduplication algorithm
  - File(s): `backend/src/services/feature-diff.ts`
  - Acceptance: `buildFeatureCards()` groups by hash, returns cards with branch info

- [x] Task 1.8: Create /api/board/multi-branch endpoint
  - File(s): `backend/src/routes/board.ts`
  - Acceptance: GET endpoint accepts headers, calls scanner + diff, returns JSON response

## Phase 2: Backend Integration (3 tasks)

- [x] Task 2.1: Mount board router in Hono app
  - File(s): `backend/src/index.ts`
  - Acceptance: `app.route('/api/board', boardRouter)` added, imports correct

- [ ] Task 2.2: Add simple in-memory cache
  - File(s): `backend/src/utils/cache.ts`, `backend/src/routes/board.ts`
  - Acceptance: `SimpleCache` class with get/set, 30s TTL, integrated in board endpoint

- [ ] Task 2.3: Add error handling and partial failure support
  - File(s): `backend/src/routes/board.ts`, `backend/src/services/branch-scanner.ts`
  - Acceptance: Returns errors array in metadata, continues on branch failures

## Phase 3: Frontend Types & API (3 tasks)

- [x] Task 3.1: Extend frontend types
  - File(s): `frontend/packages/app-core/src/types.ts`
  - Acceptance: `FeatureMeta` has optional `branches?: BranchInfo[]` and `primaryBranch?: string`

- [x] Task 3.2: Add fetchBoardMultiBranch function
  - File(s): `frontend/packages/app-core/src/api.ts`
  - Acceptance: New function calls backend API with headers, returns FeatureBoard

- [x] Task 3.3: Update useBoard hook
  - File(s): `frontend/packages/app-core/src/hooks/useBoard.ts`
  - Acceptance: Query uses `fetchBoardMultiBranch`, query key updated to 'board-multi'

## Phase 4: Frontend UI (3 tasks)

- [x] Task 4.1: Update FeatureCard to display branch tags
  - File(s): `frontend/packages/local-web/src/routes/index.tsx`
  - Acceptance: Branch tags rendered below title, main has lower opacity

- [x] Task 4.2: Add CSS for branch tags
  - File(s): `frontend/packages/local-web/src/styles/reactbits.css`
  - Acceptance: `.rb-branch-tag` class added with light/dark mode support

- [x] Task 4.3: Add error warning banner
  - File(s): `frontend/packages/local-web/src/routes/index.tsx`
  - Acceptance: Yellow warning banner shown when metadata.errors exists

## Phase 5: Testing & Deployment (5 tasks)

- [x] Task 5.1: Test backend locally with Bun
  - File(s): N/A (manual testing)
  - Acceptance: `/api/board/multi-branch` returns correct data for test repo

- [x] Task 5.2: Test frontend integration locally
  - File(s): N/A (manual testing)
  - Acceptance: Kanban shows cards with branch tags, no console errors

- [ ] Task 5.3: Add environment variable configuration
  - File(s): `.env.example`, frontend config
  - Acceptance: `VITE_BACKEND_URL` documented and working

- [ ] Task 5.4: Verify Vercel deployment compatibility
  - File(s): `vercel.json`, `api/index.ts`
  - Acceptance: `/api/board/*` routes correctly to Hono app

- [ ] Task 5.5: Deploy and test on Vercel
  - File(s): N/A (deployment)
  - Acceptance: Production kanban works with real GitHub repos, no rate limit errors

## Notes

- Tasks are ordered by dependency (backend → frontend → testing)
- Each task should take roughly 2-5 minutes for an AI agent
- Test after completing each phase before moving to the next
