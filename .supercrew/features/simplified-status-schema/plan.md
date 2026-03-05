---
total_tasks: 7
completed_tasks: 7
progress: 100
---

# Status Schema Refinement — Implementation Plan

## Tasks

- [x] Task 1: Update type definitions
  - File(s): `frontend/packages/app-core/src/types.ts`
  - Acceptance: `SupercrewStatus` type has 4 values: todo, doing, ready-to-ship, shipped

- [x] Task 2: Update API layer
  - File(s): `frontend/packages/app-core/src/api.ts`
  - Acceptance: Default status is `todo`, `featuresByStatus` uses new status keys

- [x] Task 3: Update hooks
  - File(s): `frontend/packages/app-core/src/hooks/useBoard.ts`
  - Acceptance: `EMPTY_BOARD` uses new status keys

- [x] Task 4: Update kanban board routes
  - File(s): `frontend/packages/local-web/src/routes/index.tsx`
  - Acceptance: `STATUS_COLUMN_IDS` and `STATUS_KEY_MAP` use new status values

- [x] Task 5: Update feature detail page
  - File(s): `frontend/packages/local-web/src/routes/features.$id.tsx`
  - Acceptance: `STATUS_COLOR` mapping uses new status keys with appropriate colors

- [x] Task 6: Update localization files
  - File(s): `frontend/packages/local-web/src/locales/en.json`, `frontend/packages/local-web/src/locales/zh.json`
  - Acceptance: Column names display correctly in both English and Chinese

- [x] Task 7: Update CSS styles
  - File(s): `frontend/packages/local-web/src/styles/reactbits.css`
  - Acceptance: New status classes (dot, col, bar) exist, legacy aliases preserved
