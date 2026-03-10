---
status: draft
reviewers: []
---

# Kanban Architecture Alignment — Technical Design

## Design Decisions

1. **Rename `features/` to `tasks/`**: The supercrew plugin now uses "tasks" terminology. Rename `.supercrew/features/` → `.supercrew/tasks/`.

2. **File structure is already aligned**: All existing features already have the correct `dev-` prefixed files (`dev-design.md`, `dev-plan.md`, `dev-log.md`). No legacy files (`design.md`, `plan.md`, `log.md`) exist.

3. **meta.yaml schema is compliant**: All meta.yaml files already include required fields: `id`, `title`, `status`, `owner`, `priority`, `teams`, `tags`, `created`, `updated`.

4. **Remove non-standard file**: `multi-branch-kanban/research.md` is a non-standard file that should be preserved (it's supplementary research, not a legacy artifact).

## Architecture

```
.supercrew/
├── tasks/                          # Renamed from features/
│   ├── <task-id>/
│   │   ├── meta.yaml               # Required: id, title, status, owner, priority, teams, tags, created, updated
│   │   ├── prd.md                  # Created at task creation
│   │   ├── dev-design.md           # Created when status → doing
│   │   ├── dev-plan.md             # Created when status → doing
│   │   └── dev-log.md              # Created when status → doing
```

## Implementation Notes

### Task 1: Rename directory
- Simple `git mv .supercrew/features .supercrew/tasks`
- All internal references should work since paths are relative within each task directory

### Task 2: Verify no legacy files exist
- Check for `design.md`, `plan.md`, `log.md` (without `dev-` prefix)
- Current state: None found - already aligned

### Task 3: Update frontend/backend path constants
- `backend/src/services/github.ts` — `FEATURES_PATH` constant
- `frontend/packages/app-core/src/api.ts` — `FEATURES_PATH` constant and comment
- `frontend/packages/local-web/src/routes/welcome.tsx` — comment

### Task 4: Update file fetching to use `dev-` prefixed files
- `frontend/packages/app-core/src/api.ts` — `fetchFeatureDesign()` and `fetchFeaturePlan()` now fetch `dev-design.md` and `dev-plan.md`
- `backend/src/services/branch-scanner.ts` — `fetchFeatureFiles()` now fetches `dev-design.md` and `dev-plan.md`

### Task 5: Verify meta.yaml schema compliance
- All 7 features have complete schemas
- No missing required fields

### Edge Cases
- `multi-branch-kanban/research.md` is supplementary documentation, not a legacy artifact - preserve it
