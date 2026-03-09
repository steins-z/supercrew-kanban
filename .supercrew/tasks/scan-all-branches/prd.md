---
status: draft
reviewers: []
---

# Scan All Branches (Remove Pattern Filter)

## Background

当前后端的分支扫描逻辑存在严重限制：只扫描 `feature/*` 分支模式，导致 `user/*` 分支无法被识别和显示在 Kanban 看板上。

具体问题：
- `backend/src/services/branch-scanner.ts` 的 `discoverBranches()` 默认参数是 `pattern: string = 'feature/*'`
- `backend/src/routes/board.ts` 的 API 虽然支持 `branch_pattern` query 参数，但默认值也是 `'feature/*'`
- 这导致所有用户的工作分支（`user/<username>/<feature-id>`）都不会被扫描
- 开发者推送分支后，Kanban 看板上看不到进度更新，必须等到合并到 `main` 后才能看到

**实际影响**：
- 用户 Luna Chen 创建了 `user/luna-chen/repo-switcher` 分支并推送到远端
- 但后端扫描结果只返回 `["main", "feature/dev-branch-file-fetching"]`
- `repo-switcher` 功能虽然状态是 `doing`，但 Kanban 上仍显示 `todo`

这个限制严重影响了团队协作的可见性和实时性。

## Requirements

### 核心需求

- **移除分支 pattern 过滤**：修改 `BranchScanner.discoverBranches()` 方法，默认扫描**所有分支**
- **保持向后兼容**：保留 pattern 参数作为可选功能，但默认行为改为扫描所有分支
- **API 默认行为更新**：`board.ts` 的 `/multi-branch` 端点默认扫描所有分支

### 技术实现

**修改 `branch-scanner.ts`**：

```typescript
// Before:
async discoverBranches(pattern: string = 'feature/*'): Promise<string[]>

// After:
async discoverBranches(scanAll: boolean = true): Promise<string[]>
```

- 当 `scanAll = true` 时，调用 `this.gh.getRefs('heads')` 获取所有分支
- 当 `scanAll = false` 时，保留原有逻辑（仅用于测试或特殊场景）

**修改 `board.ts`**：

```typescript
// Before:
const branchPattern = c.req.query('branch_pattern') ?? 'feature/*';
const branches = await scanner.discoverBranches(branchPattern);

// After:
const scanAll = c.req.query('scan_all') !== 'false'; // default true
const branches = await scanner.discoverBranches(scanAll);
```

### 性能考虑

- **扫描更多分支可能增加 API 调用次数**：
  - GitHub API rate limit: 5000 requests/hour (authenticated)
  - 每个分支需要调用 API 获取 `.supercrew/tasks/` 目录和文件内容
  - 建议后续添加缓存机制（不在本 feature 范围）

- **短期缓解措施**：
  - 后端已有 rate limit 检查（`checkRateLimit()`）
  - 可以在前端添加"刷新频率限制"，避免频繁请求

### 测试验证

- 创建 `user/*` 分支并推送，验证能否被扫描
- 验证 `feature/*` 分支仍然能被扫描
- 验证 `main` 分支始终被包含
- 测试空仓库（没有 `.supercrew/tasks/` 目录）的错误处理

## Out of Scope

- 前端添加"选择扫描哪些分支"的 UI（未来可以做）
- 添加分支扫描结果缓存（应该在单独的 feature 中实现）
- 优化 GitHub API 调用性能（例如批量请求）
- 支持多个 pattern 的组合（例如 `feature/*` 和 `user/*`）
