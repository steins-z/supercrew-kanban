---
status: approved
reviewers: []
---

# Kanban SuperCrew Migration (Phase 2 & 3)

## Background

Migrate the kanban application from `.team/` resource-oriented model to `.supercrew/features/` feature-oriented data model. This encompasses:

- **Phase 2**: Backend schema infrastructure with read-only GitHub API access
- **Phase 3**: Frontend kanban refactor to feature-centric read-only view

The kanban service is **completely read-only** — all data writes happen via the Claude Code plugin in user repos, then pushed to GitHub.

## Requirements

### Phase 2: Backend (Read-Only)

1. Define TypeScript types matching `.supercrew/` schema
2. Rewrite GitHub Store (read-only) using GitHub Contents API
3. Rewrite Local Store (read-only, dev only)
4. Rewrite API Routes (read-only): `/api/features`, `/api/board`
5. Delete legacy `.team/` code

### Phase 3: Frontend (Read-Only)

1. Data layer refactor: `Feature` replaces `Task`/`Sprint`
2. Kanban main view with status columns
3. Feature detail page with Overview/Design/Plan tabs
4. FRE & empty state updates
5. Cleanup legacy pages and drag-drop

## Out of Scope

- Write operations from kanban UI (all writes via Claude Code plugin)
- Drag-drop status changes
- Sprint management
- Cross-feature dependency visualization
- Release coordination
- `.team/` backward compatibility migration
