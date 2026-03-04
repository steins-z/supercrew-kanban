---
status: approved
reviewers: []
# approved_by: ""
---

# Kanban SuperCrew Migration (Phase 2 & 3)

## Background

Migrate the kanban application from `.team/` resource-oriented model to `.supercrew/features/` feature-oriented data model. This encompasses:

- **Phase 2**: Backend schema infrastructure with read-only GitHub API access
- **Phase 3**: Frontend kanban refactor to feature-centric read-only view

The kanban service is **completely read-only** — all data writes happen via the Claude Code plugin in user repos, then pushed to GitHub.

## Requirements

### Phase 2: Backend (Read-Only)

1. Define TypeScript types matching `.supercrew/` schema:
   - `SupercrewStatus` enum: `planning → designing → ready → active → blocked → done`
   - `FeaturePriority`: `P0 | P1 | P2 | P3`
   - `FeatureMeta`, `DesignDoc`, `PlanDoc`, `FeatureLog` types
   - Use `zod` for runtime validation

2. Rewrite GitHub Store (read-only):
   - Access `.supercrew/features/<id>/` via GitHub Contents API
   - Implement: `listFeatures()`, `getFeatureMeta(id)`, `getFeatureDesign(id)`, `getFeaturePlan(id)`, `getFeatureLog(id)`
   - Remove all `ghPut`/`ghDelete` calls

3. Rewrite Local Store (read-only, dev only):
   - Read local `.supercrew/features/` for development mocking
   - No write logic

4. Rewrite API Routes (read-only):
   - Replace `tasks.ts`, `sprints.ts`, `people.ts`, `knowledge.ts`, `decisions.ts` with:
     - `GET /api/features` — list all features
     - `GET /api/features/:id` — single feature details
     - `GET /api/features/:id/design` — design.md
     - `GET /api/features/:id/plan` — plan.md with progress
     - `GET /api/board` — aggregate features by status for kanban columns
   - Update `GET /api/projects/github/repos/:owner/:repo/init-status` to check `.supercrew/features/`
   - Remove `POST .../init` endpoint

5. Delete legacy code:
   - Remove all `.team/` related store logic, routes, types
   - Remove `Sprint`, `Person`, `KnowledgeEntry`, `Decision` types

### Phase 3: Frontend (Read-Only)

1. Data layer refactor:
   - Update types: `Feature` replaces `Task`/`Sprint`
   - Update API calls: only read operations (`fetchFeatures`, `fetchFeature`, `fetchBoard`, etc.)
   - Remove all create/update/delete mutations
   - Update `useBoard()` hook: return `{ features, featuresByStatus, isLoading, error }`

2. Kanban main view:
   - 6-column layout: `Planning | Designing | Ready | Active | Blocked | Done`
   - Feature card: title, priority badge (P0 red/P1 orange/P2 blue/P3 gray), owner, teams tags, progress bar
   - **No drag-drop** — status changes via Claude Code plugin only
   - Card click → Feature detail page

3. Feature detail page:
   - Route: `/features/:id` (replaces `/tasks/:id`)
   - Three tabs: **Overview** (meta.yaml), **Design** (design.md + review status), **Plan** (plan.md + progress)
   - All content read-only

4. FRE & empty state:
   - Welcome wizard: OAuth → Select Repo (no Init)
   - Empty state: guide users to install SuperCrew plugin and use `/new-feature`

5. Cleanup:
   - Remove `/people`, `/knowledge`, `/decisions` pages
   - Remove drag-drop components and `@hello-pangea/dnd`
   - Simplify navigation to Board only

## Design

### Data Flow

```
User Repo (.supercrew/)     Kanban Service (read-only)
┌─────────────────────┐     ┌──────────────────────┐
│  .supercrew/        │     │  Backend (Hono)      │
│    features/        │────►│  GitHub Contents API │
│      <id>/          │     │                      │
│        meta.yaml    │     │  Frontend (React)    │
│        design.md    │     │  Read-only kanban    │
│        plan.md      │     └──────────────────────┘
│        log.md       │
└─────────────────────┘
        ▲
        │
  Claude Code Plugin
  (writes → git push)
```

### Status to Column Mapping

| Status | Kanban Column |
|--------|---------------|
| planning | Planning |
| designing | Designing |
| ready | Ready |
| active | Active |
| blocked | Blocked |
| done | Done |

## Out of Scope

- Write operations from kanban UI (all writes via Claude Code plugin)
- Drag-drop status changes
- Sprint management (Post-MVP Iteration 2)
- Cross-feature dependency visualization (Post-MVP Iteration 3)
- Release coordination (Post-MVP Iteration 4)
- `.team/` backward compatibility migration
