---
status: draft
reviewers: []
---

# Multi-Branch Kanban

## Background

The SuperCrew Kanban board currently reads `.supercrew/features/` data exclusively from the `main` branch. This means any work-in-progress on feature branches is invisible to the team until it lands on `main` — creating a blind spot during active development. Teams lose situational awareness of what's being worked on, what state features are in across different branches, and whether two branches have diverged on the same feature.

## Problem

- Developers can't see their kanban card updates until they merge to `main`
- Team leads have no visibility into branch-level progress during development
- When two branches modify the same feature, there's no way to spot conflicts or duplication early
- The kanban board doesn't reflect the real state of work-in-progress

## Goal

Enable the kanban board to aggregate and display feature data from **all active branches** (`main` + `feature/*`), so the board becomes a true real-time view of all development in flight — not just what's merged.

## Requirements

### 1. Multi-Branch Scanning
- Scan `main` and all `feature/*` branches for `.supercrew/features/` data
- Fetch branch list and feature files in parallel to minimize latency
- Gracefully handle branches where `.supercrew/` doesn't exist

### 2. Intelligent Deduplication
- If a feature is **identical** across all branches, show a single card with branch tag(s)
- If a feature **differs** between branches (content changed), show separate cards — one per unique version
- Use file-level diff (`meta.yaml`, `dev-design.md`, `dev-plan.md`) to detect divergence

### 3. Branch Visibility on Cards
- Display branch tag(s) on each kanban card (e.g. `main`, `feature/oauth`)
- Multiple branch tags on a single card indicate the feature is consistent across those branches

### 4. Backend Implementation
- Implement aggregation logic in the Hono backend (`/api/board/multi-branch`) rather than the frontend, to reduce GitHub API round-trips and keep the client simple
- Return enriched board response with `metadata` (scanned branches, errors, fetch timestamp)

## Success Criteria

- All features across `main` and `feature/*` branches appear on the board within a single page load
- Identical features show one card; diverged features show distinct cards per version
- Branch tags are visible on cards
- No regression on single-branch (main-only) board behavior
