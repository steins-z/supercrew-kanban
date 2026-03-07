---
total_tasks: 28
completed_tasks: 0
progress: 0
---

# Database & Agent Reporting API — Implementation Plan

## Phase 1: Database Setup (5 tasks)

- [ ] **Task 1.1**: Install Turso CLI and create production database
  - File(s): N/A (CLI operations)
  - Acceptance: `turso db create supercrew-kanban` successful, URL and token obtained

- [ ] **Task 1.2**: Create schema.sql with all tables
  - File(s): `backend/schema.sql`
  - Acceptance: Schema includes features, branches, validation_queue, api_keys tables with indexes

- [ ] **Task 1.3**: Apply schema to Turso database
  - File(s): N/A (CLI operations)
  - Acceptance: `turso db shell supercrew-kanban < schema.sql` completes without errors

- [ ] **Task 1.4**: Create database client wrapper
  - File(s): `backend/src/services/database.ts`
  - Acceptance: `db` client exported, helper functions (getFeatures, insertFeature, queueValidation) implemented

- [ ] **Task 1.5**: Update environment variable configuration
  - File(s): `.env.example`, `backend/.env.example`
  - Acceptance: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN documented, local dev setup works with `turso dev`

## Phase 2: Backend API Types & Validation Service (6 tasks)

- [ ] **Task 2.1**: Create request/response type definitions
  - File(s): `backend/src/types/api.ts`
  - Acceptance: Types for FeatureReportRequest, BatchRequest, BoardResponse, ValidationStatus defined

- [ ] **Task 2.2**: Create validation service skeleton
  - File(s): `backend/src/services/validation.ts`
  - Acceptance: `ValidationService` class with methods: validateFeature, compareHashes, resolveConflict

- [ ] **Task 2.3**: Implement content hash comparison
  - File(s): `backend/src/services/validation.ts`
  - Acceptance: `compareFeatureData()` computes MD5 hashes, detects identical/gitNewer/agentNewer

- [ ] **Task 2.4**: Implement Git conflict resolution
  - File(s): `backend/src/services/validation.ts`
  - Acceptance: `resolveConflict()` handles all cases (identical, Git wins, agent orphaned)

- [ ] **Task 2.5**: Add ETag-based rate limit optimization
  - File(s): `backend/src/services/github.ts`
  - Acceptance: `fetchFromGit()` uses If-None-Match header, returns 304 status when unchanged

- [ ] **Task 2.6**: Create API key authentication middleware
  - File(s): `backend/src/middleware/auth.ts`
  - Acceptance: `validateApiKey()` middleware checks SHA256 hash, validates expiration, attaches repo to request

## Phase 3: Agent Reporting APIs (4 tasks)

- [ ] **Task 3.1**: Implement POST /api/features/report
  - File(s): `backend/src/routes/features.ts`
  - Acceptance: Endpoint accepts report, validates API key, writes to DB, queues validation, returns 200

- [ ] **Task 3.2**: Implement POST /api/features/batch
  - File(s): `backend/src/routes/features.ts`
  - Acceptance: Batch endpoint processes multiple features, returns individual results

- [ ] **Task 3.3**: Implement POST /api/admin/api-keys
  - File(s): `backend/src/routes/admin.ts`
  - Acceptance: Generates API key (sk_live_prefix), stores SHA256 hash, returns key once

- [ ] **Task 3.4**: Add API key revocation endpoint
  - File(s): `backend/src/routes/admin.ts`
  - Acceptance: PATCH /api/admin/api-keys/:hash endpoint sets revoked=true

## Phase 4: Board Reading APIs (3 tasks)

- [ ] **Task 4.1**: Implement GET /api/board (DB-first logic)
  - File(s): `backend/src/routes/board-db.ts`
  - Acceptance: Reads from DB, checks freshness, falls back to Git if >50% stale

- [ ] **Task 4.2**: Add freshness calculation logic
  - File(s): `backend/src/services/freshness.ts`
  - Acceptance: `calculateFreshness()` returns 'verified' | 'realtime' | 'stale' | 'orphaned'

- [ ] **Task 4.3**: Implement GET /api/features/:id
  - File(s): `backend/src/routes/features.ts`
  - Acceptance: Returns single feature with full content (meta, design, plan, prd)

## Phase 5: Validation Worker (4 tasks)

- [ ] **Task 5.1**: Create Vercel cron endpoint
  - File(s): `api/cron/validate.ts`
  - Acceptance: Endpoint validates CRON_SECRET, processes validation queue

- [ ] **Task 5.2**: Implement queue processing logic
  - File(s): `backend/src/workers/validator.ts`
  - Acceptance: `processQueue()` fetches 10 jobs, validates in parallel, handles errors

- [ ] **Task 5.3**: Add retry logic with exponential backoff
  - File(s): `backend/src/workers/validator.ts`
  - Acceptance: Failed jobs increment attempts, retry up to 10 times, then discard

- [ ] **Task 5.4**: Configure Vercel cron schedule
  - File(s): `vercel.json`
  - Acceptance: Cron job configured to run every 1 minute

## Phase 6: Frontend Integration (6 tasks)

- [ ] **Task 6.1**: Update frontend types
  - File(s): `frontend/packages/app-core/src/types.ts`
  - Acceptance: FeatureMeta includes verified, source, freshness fields; BoardMetadata defined

- [ ] **Task 6.2**: Create fetchBoardFromDb API function
  - File(s): `frontend/packages/app-core/src/api.ts`
  - Acceptance: Function calls backend /api/board endpoint with query params

- [ ] **Task 6.3**: Update useBoard hook with polling strategy
  - File(s): `frontend/packages/app-core/src/hooks/useBoard.ts`
  - Acceptance: Polls every 30s if unverified features exist, 5min otherwise

- [ ] **Task 6.4**: Create VerificationBadge component
  - File(s): `frontend/packages/local-web/src/components/VerificationBadge.tsx`
  - Acceptance: Component displays ✅/⚡/⏳/❌ based on freshness prop

- [ ] **Task 6.5**: Create BoardMetadataBanner component
  - File(s): `frontend/packages/local-web/src/components/BoardMetadataBanner.tsx`
  - Acceptance: Banner shows source, unverified count, last sync, manual sync button

- [ ] **Task 6.6**: Add verification CSS styling
  - File(s): `frontend/packages/local-web/src/styles/verification.css`
  - Acceptance: Styles for badges, pulse animation, warnings, dark mode support

## Phase 7: Deployment & Migration (5 tasks)

- [ ] **Task 7.1**: Add Vercel environment variables
  - File(s): N/A (Vercel dashboard)
  - Acceptance: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, CRON_SECRET configured

- [ ] **Task 7.2**: Create migration script
  - File(s): `scripts/migrate-git-to-db.ts`
  - Acceptance: Script fetches all features from Git, inserts to DB with verified=true

- [ ] **Task 7.3**: Add feature flag for gradual rollout
  - File(s): `frontend/packages/local-web/src/config.ts`
  - Acceptance: VITE_USE_DB_BACKEND flag, localStorage toggle, UI switch component

- [ ] **Task 7.4**: Deploy to Vercel
  - File(s): N/A (deployment)
  - Acceptance: Production deployment succeeds, cron job runs, /health endpoint returns 200

- [ ] **Task 7.5**: Run migration and verify production
  - File(s): N/A (manual testing)
  - Acceptance: Migration script populates DB, board loads from DB, verification cron runs successfully

---

## Implementation Order

Tasks are ordered by dependency. Recommended execution:

1. **Local Setup (1.1-1.5)**: Get Turso working locally with `turso dev`
2. **Backend Foundation (2.1-2.6)**: Types, validation, authentication
3. **Agent APIs (3.1-3.4)**: POST endpoints for reporting
4. **Board APIs (4.1-4.3)**: GET endpoints for reading
5. **Validation Worker (5.1-5.4)**: Background verification
6. **Frontend (6.1-6.6)**: UI components and API integration
7. **Deploy (7.1-7.5)**: Production deployment and migration

---

## Testing Checkpoints

After each phase:

- **Phase 1**: Run `turso dev`, connect with database.ts, verify schema
- **Phase 2**: Unit test validation logic, mock Git API responses
- **Phase 3**: Manual curl tests for POST endpoints, verify DB writes
- **Phase 4**: Manual curl tests for GET endpoints, verify fallback logic
- **Phase 5**: Local cron simulation, verify queue processing
- **Phase 6**: Visual regression testing, verify badges and polling
- **Phase 7**: Production smoke test, monitor error logs

---

## Notes

- Use `/supercrew:sync` after completing each task to update progress
- Expected implementation time: ~2-3 days for experienced developer
- Critical path: Tasks 1.1-1.5 must complete before any coding
- Parallelizable: Phase 2 and Phase 3 can be developed concurrently after Phase 1
