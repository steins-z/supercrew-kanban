---
total_tasks: 12
completed_tasks: 8
progress: 67
---

# Kanban SuperCrew Migration — Implementation Plan

## Completed Tasks (Phase 2 & 3 Core)

- [x] Task 1: Define frontend TypeScript types for supercrew schema
  - File(s): `frontend/packages/app-core/src/types.ts`
  - Acceptance: SupercrewStatus, FeaturePriority, FeatureMeta, DesignDoc, PlanDoc, FeatureLog types defined

- [x] Task 2: Implement frontend GitHub API client (read-only)
  - File(s): `frontend/packages/app-core/src/api.ts`
  - Acceptance: fetchFeatures, fetchFeature, fetchFeatureDesign, fetchFeaturePlan, fetchBoard implemented

- [x] Task 3: Implement useBoard hook with feature-centric data
  - File(s): `frontend/packages/app-core/src/hooks/useBoard.ts`
  - Acceptance: Returns { features, featuresByStatus, isLoading, error }

- [x] Task 4: Build 6-column kanban board (read-only, no drag-drop)
  - File(s): `frontend/packages/local-web/src/routes/index.tsx`
  - Acceptance: Planning/Designing/Ready/Active/Blocked/Done columns, feature cards clickable

- [x] Task 5: Build feature detail page with 3 tabs
  - File(s): `frontend/packages/local-web/src/routes/features.$id.tsx`
  - Acceptance: Overview/Design/Plan tabs, read-only display

- [x] Task 6: Implement welcome wizard (OAuth → Select Repo)
  - File(s): `frontend/packages/local-web/src/routes/welcome.tsx`
  - Acceptance: 3-step wizard, checks for .supercrew/features/ existence

- [x] Task 7: Remove legacy pages (/people, /knowledge, /decisions)
  - File(s): N/A (not present in codebase)
  - Acceptance: No legacy routes or navigation entries

- [x] Task 8: Remove drag-drop functionality
  - File(s): N/A (never implemented with dnd)
  - Acceptance: No @hello-pangea/dnd dependency, kanban is read-only

## Remaining Tasks

- [ ] Task 9: Add progress bar to feature cards on board
  - File(s): `frontend/packages/local-web/src/routes/index.tsx`
  - Acceptance: FeatureCard shows plan.progress as visual progress bar when available

- [ ] Task 10: Render markdown properly in Design/Plan tabs
  - File(s): `frontend/packages/local-web/src/routes/features.$id.tsx`
  - Acceptance: MarkdownBody component uses proper markdown renderer (react-markdown or similar)

- [ ] Task 11: Add backend types for supercrew schema (optional - for future backend routes)
  - File(s): `backend/src/types/index.ts` (new file)
  - Acceptance: Mirror frontend types for consistency if backend routes added later

- [ ] Task 12: Add empty state guidance when no features exist
  - File(s): `frontend/packages/local-web/src/routes/index.tsx`
  - Acceptance: When featuresByStatus has all empty arrays, show guidance to use Claude Code plugin

## Notes

The current architecture uses a "thin backend" approach where:
- Backend handles OAuth only (code → access_token)
- Frontend calls GitHub API directly from browser
- This is valid for read-only scenarios and simplifies deployment

The PRD's "backend GitHub store + routes" is optional for MVP since:
- Read-only access works well from client-side
- GitHub's API rate limits (5000/hr authenticated) are sufficient
- Server-side routes could be added later for caching/analytics if needed
