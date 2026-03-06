---
status: draft
reviewers: []
---

# Kanban Architecture Alignment

## Background

Migrate the supercrew-kanban project's feature management structure to align with the new architecture defined in the supercrew plugin's `architecture-refinement` feature. The new architecture simplifies from 7 skills to 3, introduces user-namespaced branch conventions, and establishes a `dev-` prefix naming convention for implementation artifacts.

Key changes to align with:
- **Skill consolidation**: `create-task`, `do-task`, `sync-supercrew` (3 skills instead of 7)
- **Branch naming**: `user/<username>/backlog-<feature-id>` for backlog, `user/<username>/<feature-id>` for active work
- **File structure**: `prd.md` + `meta.yaml` at creation; `dev-design.md`, `dev-plan.md`, `dev-log.md` when work starts
- **No auto-push**: User controls when to push to remote

## Requirements

1. **Verify file structure alignment**: Ensure all existing features have the correct file structure:
   - `meta.yaml` and `prd.md` exist for all features
   - `dev-design.md`, `dev-plan.md`, `dev-log.md` (with `dev-` prefix) for features in `doing` or beyond

2. **Update meta.yaml schema**: Ensure all meta.yaml files include:
   - `id`, `title`, `status`, `owner`, `priority`, `teams`, `tags`, `created`, `updated`
   - `progress` field for features with dev-plan.md

3. **Branch convention documentation**: Update project documentation to reflect new branch naming conventions

4. **Cleanup deprecated files**: Remove any legacy files (e.g., `design.md`, `plan.md`, `log.md` without `dev-` prefix)

5. **Rename features directory to tasks**: Rename `.supercrew/features/` to `.supercrew/tasks/` to align with the simplified terminology where work items are called "tasks" not "features"

## Out of Scope

- Migrating existing branch names (optional, existing branches continue to work)
- Changes to the kanban web application code (this is .supercrew structure only)
- Modifying the supercrew plugin itself (that's handled in the supercrew repo)
