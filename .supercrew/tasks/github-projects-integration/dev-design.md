---
status: draft
reviewers: []
---

# GitHub Projects Integration — Technical Design

## Design Decisions

<!-- Key architectural and implementation decisions -->

## Architecture

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
│  │   ├── dev-design.md  ←───────────────→  Issue description    │
│  │   ├── dev-plan.md    ←───────────────→  Task list (checkbox) │
│  │   └── dev-log.md     ←───────────────→  Issue comments       │
│  └── feature-b/                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Mapping

| supercrew | GitHub Issue |
|-----------|--------------|
| `meta.yaml: id` | Issue number (stored in meta after creation) |
| `meta.yaml: title` | Issue title |
| `meta.yaml: status` | Issue state + label (`status:todo`, etc.) |
| `meta.yaml: priority` | Label (`priority:P0`, etc.) |
| `meta.yaml: owner` | Issue assignee |
| `dev-design.md` | Issue body (markdown) |
| `dev-plan.md` tasks | Issue task list (checkboxes in body) |
| `dev-log.md` entries | Issue comments (timestamped) |

## New meta.yaml Fields

```yaml
id: feature-id
title: "Feature Title"
status: todo
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
    branch: "user/steins-z/feature-id"
    started: "2026-03-04T10:00:00Z"
    ended: "2026-03-04T11:30:00Z"
    commits: ["abc123", "def456"]
    files_changed: 5
    lines_added: 120
    lines_removed: 45
```

## Supercrew Plugin Changes

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

## API Usage

Using GitHub GraphQL API for Projects v2:

```graphql
# Create issue linked to project
mutation {
  createIssue(input: {
    repositoryId: "..."
    title: "Feature Title"
    body: "..."
    labelIds: ["priority:P1", "status:todo"]
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

## Open Questions

1. Should `dev-log.md` entries sync as issue comments, or stay local-only?
2. How to handle conflicts when both local and remote changed?
3. Should we support multiple repos per feature (monorepo case)?

## Success Metrics

- Features sync to GitHub Issues within 30s of status change
- Team can view all features on GitHub Projects board
- Agent work sessions visible in issue timeline
- Zero data loss during sync conflicts
