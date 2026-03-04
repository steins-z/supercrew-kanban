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
   - `design.md` content becomes issue description
   - Status changes (`planning` → `active` → `done`) update issue state

2. **Sync GitHub Issues → supercrew features**
   - Issues created in GitHub Projects can generate local feature folders
   - Bidirectional sync keeps both in sync

3. **Track work sessions per user/agent**
   - When an agent starts work, log session to issue comment or custom field
   - Track: session start/end, commits made, files changed, branch name
   - Support multiple concurrent sessions (different agents on same issue)

4. **PR linkage**
   - Auto-link PRs to issues via branch naming (`feature/<id>`)
   - Show PR status in supercrew context

5. **Team dashboard (via GitHub Projects)**
   - Use GitHub Projects board for kanban view
   - Custom fields for: priority (P0-P3), progress %, agent sessions
   - Filter views by assignee, priority, status

### Non-Functional Requirements

- **Offline-first**: Local files remain source of truth; sync when online
- **Incremental**: Don't require full GitHub Projects setup to use supercrew
- **Backward compatible**: Existing `.supercrew/features/` workflows unchanged

## Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Projects                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Issue   │  │  Issue   │  │  Issue   │  │  Issue   │        │
│  │ (feature)│  │ (feature)│  │ (feature)│  │ (feature)│        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│       └─────────────┴─────────────┴─────────────┘               │
│                           │                                     │
│                    GitHub API                                   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                   ┌────────┴────────┐
                   │  Sync Service   │
                   │  (supercrew     │
                   │   hook/skill)   │
                   └────────┬────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                    Local Repository                             │
│  .supercrew/features/                                           │
│  ├── feature-a/                                                 │
│  │   ├── meta.yaml  ←──────────────────→  Issue metadata        │
│  │   ├── design.md  ←──────────────────→  Issue description     │
│  │   ├── plan.md    ←──────────────────→  Task list (checkbox)  │
│  │   └── log.md     ←──────────────────→  Issue comments        │
│  └── feature-b/                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Mapping

| supercrew | GitHub Issue |
|-----------|--------------|
| `meta.yaml: id` | Issue number (stored in meta after creation) |
| `meta.yaml: title` | Issue title |
| `meta.yaml: status` | Issue state + label (`status:planning`, etc.) |
| `meta.yaml: priority` | Label (`priority:P0`, etc.) |
| `meta.yaml: owner` | Issue assignee |
| `design.md` | Issue body (markdown) |
| `plan.md` tasks | Issue task list (checkboxes in body) |
| `log.md` entries | Issue comments (timestamped) |

### New meta.yaml Fields

```yaml
id: feature-id
title: "Feature Title"
status: planning
owner: "username"
priority: P1
# --- New fields for GitHub sync ---
github:
  issue_number: 123          # Set after first sync
  repo: "owner/repo"         # Target repository
  project_id: "PVT_xxx"      # GitHub Project ID (optional)
  last_synced: "2026-03-04T12:00:00Z"
sessions:                    # Work sessions (appended by agents)
  - agent: "claude-opus-4-6"
    branch: "feature/feature-id"
    started: "2026-03-04T10:00:00Z"
    ended: "2026-03-04T11:30:00Z"
    commits: ["abc123", "def456"]
    files_changed: 5
    lines_added: 120
    lines_removed: 45
```

### Supercrew Plugin Changes

1. **New skill: `sync-github`**
   - Push local feature to GitHub Issue
   - Pull remote changes back to local files
   - Conflict resolution: prompt user or prefer local

2. **New hook: `post-status-change`**
   - When status changes, update GitHub Issue state/labels

3. **New hook: `session-start` / `session-end`**
   - Log agent work sessions to `meta.yaml`
   - Post session summary to GitHub Issue comment

4. **New command: `/supercrew:link-github <issue-url>`**
   - Link existing feature to existing GitHub Issue

### API Usage

Using GitHub GraphQL API for Projects v2:

```graphql
# Create issue linked to project
mutation {
  createIssue(input: {
    repositoryId: "..."
    title: "Feature Title"
    body: "..."
    labelIds: ["priority:P1", "status:planning"]
    assigneeIds: ["..."]
  }) {
    issue { number url }
  }
}

# Add to project board
mutation {
  addProjectV2ItemById(input: {
    projectId: "PVT_xxx"
    contentId: "issue_node_id"
  }) {
    item { id }
  }
}
```

## Out of Scope

- **Real-time agent orchestration** — no live streaming of agent output (use vibe-kanban if needed)
- **Custom web UI** — rely on GitHub Projects UI
- **Non-GitHub providers** — ADO, GitLab, Jira integration deferred
- **Automated agent assignment** — manual assignment only for v1

## Open Questions

1. Should `log.md` entries sync as issue comments, or stay local-only?
2. How to handle conflicts when both local and remote changed?
3. Should we support multiple repos per feature (monorepo case)?

## Success Metrics

- Features sync to GitHub Issues within 30s of status change
- Team can view all features on GitHub Projects board
- Agent work sessions visible in issue timeline
- Zero data loss during sync conflicts
