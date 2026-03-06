---
status: draft
reviewers: []
---

# Multi-Branch Kanban

## Background

显示所有 feature/* 分支上的 .supercrew 变更、智能去重、实现近实时看板

Currently, the kanban board only displays `.supercrew/features/` data from the `main` branch. Developers working on feature branches cannot see their changes reflected in the kanban until they merge to main. This feature will scan all `main + feature/*` branches, intelligently deduplicate identical content, and display cards with branch tags for near-realtime visibility of all development work.

## Requirements

- Scan `main` + all `feature/*` branches for `.supercrew/features/` data
- Display multiple cards for same feature if content differs across branches
- If a feature is identical across all branches, show only one card with branch tags
- Use file-level diff (meta.yaml, design.md, plan.md) to detect changes
- Implement in backend (Hono API) to reduce frontend API calls and improve performance
- Display branch tags on kanban cards using existing UI components

## Design

### Backend API: `/api/board/multi-branch`

**Request:**
- Headers: `Authorization: Bearer {token}`, `X-Repo-Owner`, `X-Repo-Name`
- Query: `?branch_pattern=feature/*` (optional)

**Response:**
```json
{
  "features": [...],
  "featuresByStatus": {...},
  "metadata": {
    "scannedBranches": ["main", "feature/oauth", ...],
    "totalBranches": 5,
    "fetchedAt": "2026-03-05T10:00:00Z",
    "errors": []
  }
}
```

### Diff Algorithm

1. Fetch all branches matching pattern
2. For each branch, parallel fetch all features and their files
3. Compute MD5 hash of concatenated file contents
4. Group by feature ID, then by hash
5. Build cards with branch info

### Frontend Changes

- Update `useBoard()` hook to call new backend API
- Extend `FeatureMeta` type with `branches` and `primaryBranch` fields
- Update `FeatureCard` component to display branch tags
- Add CSS for `.rb-branch-tag` styling

## Out of Scope

- Editing features from non-main branches
- Branch selection UI (v1 scans all feature/* branches)
- Real-time webhooks (polling only)
