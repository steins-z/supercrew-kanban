---
total_tasks: 0
completed_tasks: 0
progress: 0
---

# Multi-Branch Kanban — Implementation Plan

## Tasks

- [ ] Phase 1: Backend API Foundation
  - [ ] Create `backend/src/routes/board.ts` endpoint
  - [ ] Create `backend/src/services/github.ts` client wrapper
  - [ ] Create `backend/src/services/branch-scanner.ts` for branch discovery
  - [ ] Create `backend/src/services/feature-diff.ts` for diff algorithm
  - [ ] Add TypeScript types in `backend/src/types/board.ts`
  - [ ] Mount board router in `backend/src/index.ts`

- [ ] Phase 2: Frontend Integration
  - [ ] Update `frontend/packages/app-core/src/api.ts` with `fetchBoardMultiBranch()`
  - [ ] Extend types in `frontend/packages/app-core/src/types.ts`
  - [ ] Update `frontend/packages/app-core/src/hooks/useBoard.ts`
  - [ ] Update `frontend/packages/local-web/src/routes/index.tsx` FeatureCard
  - [ ] Add CSS for branch tags in `frontend/packages/local-web/src/styles/reactbits.css`

- [ ] Phase 3: Performance & Testing
  - [ ] Add simple in-memory cache (30s TTL)
  - [ ] Add rate limit tracking
  - [ ] Add error handling and partial failure support
  - [ ] Manual testing with real GitHub repos
  - [ ] Deploy to Vercel

(Tasks will be refined after design approval)
