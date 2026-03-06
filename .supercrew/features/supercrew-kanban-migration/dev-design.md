---
status: approved
reviewers: []
---

# Kanban SuperCrew Migration (Phase 2 & 3) — Technical Design

## Design Decisions

- **Read-only architecture**: All writes via Claude Code plugin, kanban is view-only
- **GitHub Contents API**: No database, fetch directly from repo
- **Feature-centric model**: Replace task/sprint with single Feature entity

## Architecture

### Data Flow

```
User Repo (.supercrew/)     Kanban Service (read-only)
┌─────────────────────┐     ┌──────────────────────┐
│  .supercrew/        │     │  Backend (Hono)      │
│    features/        │────►│  GitHub Contents API │
│      <id>/          │     │                      │
│        meta.yaml    │     │  Frontend (React)    │
│        prd.md       │     │  Read-only kanban    │
│        dev-design.md│     └──────────────────────┘
│        dev-plan.md  │
│        dev-log.md   │
└─────────────────────┘
        ▲
        │
  Claude Code Plugin
  (writes → git push)
```

### Status to Column Mapping

| Status | Kanban Column |
|--------|---------------|
| todo | Todo |
| doing | Doing |
| ready-to-ship | Ready to Ship |
| shipped | Shipped |

## Implementation Notes

### Backend Routes

- `GET /api/features` — list all features
- `GET /api/features/:id` — single feature details
- `GET /api/features/:id/design` — dev-design.md
- `GET /api/features/:id/plan` — dev-plan.md with progress
- `GET /api/board` — aggregate features by status for kanban columns

### Frontend Components

- 4-column kanban layout matching status values
- Feature card: title, priority badge, owner, teams tags, progress bar
- No drag-drop — status changes via Claude Code plugin only
- Card click → Feature detail page with Overview/Design/Plan tabs
