---
status: draft
reviewers: []
---

# GitHub Projects Integration

## Background

Team-wise project management requires tracking work across users and AI agents, with visibility into commits, PRs, and task progress. Rather than building a custom database (duplicating GitHub Projects, ADO, Linear), we integrate supercrew with GitHub Projects to leverage:

- Existing kanban boards and issue tracking
- Native PR/commit linkage
- Team collaboration (assignees, labels, milestones)
- GitHub's mature API and ecosystem

## Problem Statement

Current supercrew plugin tracks features in `.supercrew/features/` as local files. This works for individual developers but lacks:

1. **Team visibility** — no shared dashboard across contributors
2. **Agent tracking** — no way to see which agent worked on what
3. **Metrics aggregation** — can't query "all P0 issues" or "tasks by assignee"
4. **PR linkage** — manual process to connect features to PRs

## Requirements

### Functional Requirements

1. **Sync supercrew features → GitHub Issues**
   - Each `.supercrew/features/<id>/` maps to a GitHub Issue
   - `meta.yaml` fields map to issue metadata (labels, assignees, milestones)
   - `dev-design.md` content becomes issue description
   - Status changes (`todo` → `doing` → `shipped`) update issue state

2. **Sync GitHub Issues → supercrew features**
   - Issues created in GitHub Projects can generate local feature folders
   - Bidirectional sync keeps both in sync

3. **Track work sessions per user/agent**
   - When an agent starts work, log session to issue comment or custom field
   - Track: session start/end, commits made, files changed, branch name
   - Support multiple concurrent sessions (different agents on same issue)

4. **PR linkage**
   - Auto-link PRs to issues via branch naming (`user/<username>/<feature-id>`)
   - Show PR status in supercrew context

5. **Team dashboard (via GitHub Projects)**
   - Use GitHub Projects board for kanban view
   - Custom fields for: priority (P0-P3), progress %, agent sessions
   - Filter views by assignee, priority, status

### Non-Functional Requirements

- **Offline-first**: Local files remain source of truth; sync when online
- **Incremental**: Don't require full GitHub Projects setup to use supercrew
- **Backward compatible**: Existing `.supercrew/features/` workflows unchanged

## Out of Scope

- **Real-time agent orchestration** — no live streaming of agent output
- **Custom web UI** — rely on GitHub Projects UI
- **Non-GitHub providers** — ADO, GitLab, Jira integration deferred
- **Automated agent assignment** — manual assignment only for v1
