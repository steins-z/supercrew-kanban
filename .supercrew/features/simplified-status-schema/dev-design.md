---
status: approved
reviewers: []
---

# Status Schema Refinement — Technical Design

## Overview

将 feature 状态从 6 种简化为 4 种，使其与 supercrew 插件的状态模型保持一致。

## Current State (Before)

```typescript
type SupercrewStatus = 'planning' | 'designing' | 'ready' | 'active' | 'blocked' | 'done'
```

6 种状态过于细分，与 supercrew 插件的状态模型不一致。

## Target State (After)

```typescript
type SupercrewStatus = 'todo' | 'doing' | 'ready-to-ship' | 'shipped'
```

4 种状态，与 supercrew 的标准流程对齐：
- `todo` — 待处理（合并 planning/designing）
- `doing` — 进行中（合并 ready/active/blocked）
- `ready-to-ship` — 待发布（新增）
- `shipped` — 已发布（替代 done）

## Implementation Scope

### 1. Type Definitions
- `frontend/packages/app-core/src/types.ts` — 更新 `SupercrewStatus` 类型

### 2. API Layer
- `frontend/packages/app-core/src/api.ts`
  - 更新默认状态从 `planning` 到 `todo`
  - 更新 `featuresByStatus` 初始化

### 3. Hooks
- `frontend/packages/app-core/src/hooks/useBoard.ts` — 更新 `EMPTY_BOARD` 初始化

### 4. Routes
- `frontend/packages/local-web/src/routes/index.tsx`
  - 更新 `STATUS_COLUMN_IDS` 数组
  - 更新 `STATUS_KEY_MAP` 映射
- `frontend/packages/local-web/src/routes/features.$id.tsx`
  - 更新 `STATUS_COLOR` 映射

### 5. Localization
- `frontend/packages/local-web/src/locales/en.json` — 更新英文列名
- `frontend/packages/local-web/src/locales/zh.json` — 更新中文列名

### 6. Styles
- `frontend/packages/local-web/src/styles/reactbits.css`
  - 添加新状态的 CSS 类（dot, col, bar）
  - 保留 legacy aliases 以兼容旧代码

### 7. Existing Features
- 更新所有 `.supercrew/features/*/meta.yaml` 中的状态值

## Color Mapping

| Status | Color | Hex |
|--------|-------|-----|
| todo | Blue | #3b82f6 |
| doing | Amber | #f59e0b |
| ready-to-ship | Purple | #8b5cf6 |
| shipped | Green | #10b981 |

## Migration Notes

- 保留 legacy CSS 类作为别名，避免破坏现有样式引用
- 现有 feature 的状态需要手动映射到新值
