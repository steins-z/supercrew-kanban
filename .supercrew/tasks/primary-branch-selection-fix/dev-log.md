# Fix Primary Branch Selection in Multi-Branch Kanban — Development Log

## 2026-03-09 — Work Started

- Status changed: `todo` → `doing`
- Created dev-design.md, dev-plan.md, dev-log.md
- Branch: user/luna-chen/primary-branch-selection-fix
- Ready to begin implementation

### Problem Context

The `user-branch-scanning` feature is incorrectly displayed as `todo` on the kanban board, even though the work branch has `status: doing`. This is because both the backlog and work branches have the same `updated: "2026-03-09"` date, causing non-deterministic sorting.

### Solution Approach

Implement multi-level sorting with status priority → branch type priority → date fallback to ensure correct primary branch selection.

## 2026-03-09 — Implementation Complete

### Changes Made

**File**: `backend/src/services/feature-diff.ts`

1. **Added STATUS_PRIORITY constant** (lines 12-19)
   - Imported `SupercrewStatus` type from shared types
   - Defined priority mapping: shipped=4, ready-to-ship=3, doing=2, todo=1

2. **Modified sorting logic in buildFeatureCards()** (lines 61-76)
   - Replaced single-level date sorting with 3-level composite sorting
   - Level 1: Status priority (higher status = higher priority)
   - Level 2: Branch type (non-backlog branches preferred)
   - Level 3: Updated date (newer dates preferred as fallback)

### Implementation Details

```typescript
// Old logic (single criterion)
snapshotsWithMeta.sort((a, b) =>
  (b.meta.updated || '1970-01-01').localeCompare(a.meta.updated || '1970-01-01')
)

// New logic (multi-level)
snapshotsWithMeta.sort((a, b) => {
  // 1. Status priority
  const statusA = STATUS_PRIORITY[a.meta.status || 'todo'] || 1
  const statusB = STATUS_PRIORITY[b.meta.status || 'todo'] || 1
  if (statusA !== statusB) return statusB - statusA

  // 2. Branch type (detect backlog via '/backlog-' pattern)
  const isBacklogA = a.snapshot.branch.includes('/backlog-')
  const isBacklogB = b.snapshot.branch.includes('/backlog-')
  if (isBacklogA !== isBacklogB) return isBacklogA ? 1 : -1

  // 3. Updated date (fallback)
  return (b.meta.updated || '1970-01-01').localeCompare(a.meta.updated || '1970-01-01')
})
```

### Testing

- Backend server started successfully on port 3001
- No TypeScript compilation errors
- Logic validated against design specification

### Expected Behavior

For the `user-branch-scanning` feature:
- Backlog branch: `user/luna-chen/backlog-user-branch-scanning` (status: todo, updated: 2026-03-09)
- Work branch: `user/luna-chen/user-branch-scanning` (status: doing, updated: 2026-03-09)

**Result**: Work branch (doing) will now be selected as primary because:
1. Status priority: doing (2) > todo (1) ✓
2. Both are same date, but status already determined winner

The kanban board should now correctly display this feature as "doing" instead of "todo".

### Next Steps

- Deploy to test environment or local frontend
- Verify kanban board displays correct status for multi-branch features
- Test edge cases (multiple features with same scenarios)
