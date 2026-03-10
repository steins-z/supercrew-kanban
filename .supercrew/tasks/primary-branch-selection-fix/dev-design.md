---
status: draft
reviewers: []
---

# Fix Primary Branch Selection in Multi-Branch Kanban — Technical Design

## Design Decisions

### Multi-Level Sorting Strategy

使用**复合排序键**（composite sort key）来确定 primary snapshot，按以下优先级排序：

1. **Status priority** (highest priority)
2. **Branch type priority** (medium priority)
3. **Updated date** (lowest priority, fallback)

这种设计确保了即使在日期相同的情况下，系统也能做出合理的选择。

### Status Priority Mapping

定义 status 的进展程度数值映射：

```typescript
const STATUS_PRIORITY: Record<SupercrewStatus, number> = {
  shipped: 4,
  "ready-to-ship": 3,
  doing: 2,
  todo: 1,
};
```

数值越大表示进展越多，应该优先显示。

### Branch Type Detection

通过分支名称模式识别 backlog 分支：

- Backlog 分支：包含 `/backlog-` 字符串
- 工作分支：不包含 `/backlog-`

Backlog 分支被视为低优先级（用于规划），工作分支被视为高优先级（实际开发）。

## Architecture

### Modified Sorting Logic

在 `FeatureDiff.buildFeatureCards()` 方法中，修改 line 51-54 的排序逻辑：

**当前实现**（仅按日期排序）：

```typescript
snapshotsWithMeta.sort((a, b) =>
  (b.meta.updated || "1970-01-01").localeCompare(
    a.meta.updated || "1970-01-01",
  ),
);
```

**新实现**（复合排序）：

```typescript
snapshotsWithMeta.sort((a, b) => {
  // 1. Status priority (higher is better)
  const statusA = STATUS_PRIORITY[a.meta.status || "todo"] || 1;
  const statusB = STATUS_PRIORITY[b.meta.status || "todo"] || 1;
  if (statusA !== statusB) return statusB - statusA;

  // 2. Branch type (non-backlog is better)
  const isBacklogA = a.snapshot.branch.includes("/backlog-");
  const isBacklogB = b.snapshot.branch.includes("/backlog-");
  if (isBacklogA !== isBacklogB) return isBacklogA ? 1 : -1;

  // 3. Updated date (newer is better)
  return (b.meta.updated || "1970-01-01").localeCompare(
    a.meta.updated || "1970-01-01",
  );
});
```

### 排序行为示例

**场景 1**: 同一天创建，不同状态

- Branch A: `doing`, `2026-03-09`, 非 backlog → **Selected** (status wins)
- Branch B: `todo`, `2026-03-09`, 非 backlog

**场景 2**: 同一状态，不同分支类型

- Branch A: `doing`, `2026-03-09`, 非 backlog → **Selected** (branch type wins)
- Branch B: `doing`, `2026-03-09`, backlog

**场景 3**: 相同状态和类型，不同日期

- Branch A: `doing`, `2026-03-10`, 非 backlog → **Selected** (date wins)
- Branch B: `doing`, `2026-03-09`, 非 backlog

## Implementation Notes

### Type Safety

`SupercrewStatus` 类型已定义为：

```typescript
type SupercrewStatus = "todo" | "doing" | "ready-to-ship" | "shipped";
```

`STATUS_PRIORITY` 对象需要完整覆盖所有可能的状态值。

### Edge Cases

1. **Unknown status**: 默认为 `todo` (priority = 1)
2. **Missing updated date**: 使用 `'1970-01-01'` 作为 fallback
3. **Main branch**: 不包含 `/backlog-`，被视为工作分支
4. **Feature branches**: `feature/*` 模式的分支，被视为工作分支

### Backward Compatibility

- 单分支场景：排序逻辑无影响，结果相同
- 多分支相同 hash：不受影响，已在 line 57-90 的过滤逻辑中处理
- 日期不同的场景：新逻辑仍然会按日期排序（fallback）

### 文件位置

修改文件：`backend/src/services/feature-diff.ts`

关键修改区域：`buildFeatureCards()` 方法，line 51-54
