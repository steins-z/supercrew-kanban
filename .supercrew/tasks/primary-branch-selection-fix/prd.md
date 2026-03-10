---
status: draft
reviewers: []
---

# Fix Primary Branch Selection in Multi-Branch Kanban

## Background

当同一个 feature 存在于多个分支时（如 backlog 分支和工作分支），`FeatureDiff` 类通过 `updated` 字段排序来选择 primary snapshot，以确定该 feature 在看板上显示的状态和位置。

**关键问题**：`meta.yaml` 中的 `updated` 字段只有**日期精度**（`YYYY-MM-DD`），没有时分秒。这意味着在同一天内创建和修改的多个分支版本，其 `updated` 字段完全相同。

当两个分支的 `updated` 日期完全相同时（例如都是 `2026-03-09`），排序结果变得不确定，取决于数组的原始顺序。这导致系统可能错误地选择 backlog 分支（`status: todo`）而不是工作分支（`status: doing`）作为 primary snapshot，从而在看板上显示错误的功能状态。

**实际案例**：

- Feature: `user-branch-scanning`
- Backlog 分支: `user/luna-chen/backlog-user-branch-scanning` (status: todo)
- 工作分支: `user/luna-chen/user-branch-scanning` (status: doing)
- 两者的 `updated` 都是 `2026-03-09`
- 看板错误地显示为 todo 而不是 doing

这个问题严重影响了看板数据的准确性和团队对功能进度的可见性。

## Requirements

### 1. 实现状态优先级排序

修改 `FeatureDiff.buildFeatureCards()` 中的排序逻辑，优先按状态的进展程度排序：

- `shipped` > `ready-to-ship` > `doing` > `todo`
- 状态更"进展"的分支应该被选为 primary snapshot

### 2. 实现分支类型优先级

在状态相同的情况下，应优先选择非 backlog 分支：

- 工作分支 (`user/<username>/<feature-id>`) 优先于 backlog 分支 (`user/<username>/backlog-<feature-id>`)
- 识别 backlog 分支的特征：分支名包含 `/backlog-`

### 3. 保留日期排序作为最后的判断标准

当状态和分支类型都相同时，才使用 `updated` 日期排序：

- 按 `updated` 字段降序排列（最新的优先）
- **注意**：`updated` 字段格式为 `YYYY-MM-DD`（仅日期，无时分秒），所以同一天的更新无法通过此字段区分
- 保持向后兼容性

### 4. 确保向后兼容

- 不影响单分支场景
- 不影响没有冲突的多分支场景
- 不影响现有的 hash-based deduplication 逻辑

### 5. 添加测试验证

- 验证 doing 分支优先于 todo 分支
- 验证工作分支优先于 backlog 分支
- 验证日期排序仍然有效

## Out of Scope

- 修改 meta.yaml 的时间戳格式（保持 YYYY-MM-DD，不添加时分秒）
- UI 层面的分支选择器或手动覆盖功能
- 手动指定 primary branch 的配置选项
- 更复杂的分支优先级规则（如基于 owner、priority 等）
- Git commit 时间戳的使用（保持使用 meta.yaml 的 updated 字段）
