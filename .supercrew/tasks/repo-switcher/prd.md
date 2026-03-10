---
status: draft
reviewers: []
---

# Repository Switcher

## Background

目前用户在 Kanban 应用中只能通过"Disconnect Repository"来切换到另一个 GitHub 仓库，这个流程比较繁琐且不直观。用户需要：
1. 点击 Disconnect 断开当前仓库
2. 重新授权并选择新的仓库
3. 丢失之前的上下文

对于需要在多个仓库之间频繁切换的用户（例如管理多个项目的 PM 或多团队开发者），这种体验很不友好。用户希望能够像切换标签页一样快速在已授权的仓库之间切换，而不需要每次都重新连接。

## Requirements

### 核心功能

- **仓库切换器 UI**：在 AppHeader 的 "Super Crew" Logo 右侧添加仓库切换器，显示完整的 `owner/repo ▾` 格式
- **下拉菜单设计**：
  - 点击切换器展开下拉菜单，显示最近访问的仓库列表
  - 当前仓库用 ✓ 标记并高亮显示
  - 菜单底部显示 "+ Connect Another Repo" 选项
  - 每个仓库项可 hover 显示删除按钮（×）
- **快速切换**：点击列表中的仓库即可直接切换，无需断开连接
- **添加新仓库**：点击 "Connect Another Repo" 触发 OAuth 流程，添加新仓库到列表
- **持久化存储**：使用 localStorage 记录每个用户访问过的仓库列表和最后访问的仓库

### UI 布局示意

```
┌────────────────────────────────────────────────────────────┐
│ ⚡ Super Crew  │  owner/repo ▾  │        [controls]        │
└────────────────────────────────────────────────────────────┘
                    ↓ Click to expand
                ┌────────────────────────────┐
                │ ✓ steins-z/supercrew       │ ← Current
                │   owner/another-repo     × │ ← Hover to show ×
                │   team/project-x         × │
                ├────────────────────────────┤
                │ + Connect Another Repo     │
                └────────────────────────────┘
```

### LocalStorage 数据结构

存储以下信息：
```typescript
{
  "currentRepo": "owner/repo",  // 当前选中的仓库
  "recentRepos": [               // 最近访问的仓库列表
    {
      "owner": "steins-z",
      "repo": "supercrew-kanban",
      "lastAccessed": "2026-03-09T10:30:00Z",
      "displayName": "supercrew-kanban"  // 可选，用于自定义显示名称
    }
  ]
}
```

### 用户体验

- **自动记录**：用户首次连接仓库时，自动添加到"最近访问"列表
- **智能排序**：按最后访问时间倒序排列，最近使用的在最上面
- **列表限制**：最多保留 10 个最近访问的仓库（超出后自动移除最旧的）
- **当前标识**：✓ 标记 + 高亮显示当前正在查看的仓库
- **快速移除**：hover 仓库项显示 × 按钮，点击从列表中移除（当前仓库除外）
- **视觉一致性**：切换器和下拉菜单样式与现有 HeaderBtn 保持一致
- **响应式交互**：hover 高亮、点击后菜单自动关闭、点击外部区域关闭菜单

### 技术要求

- 创建新的 `RepoSwitcher` 组件，集成到 AppHeader
- 使用 React hooks 管理：
  - 下拉菜单开关状态（`useState`）
  - 仓库列表和当前仓库（custom hook：`useRepoSwitcher`）
  - 点击外部关闭菜单（`useEffect` + 事件监听）
- localStorage 数据以 JSON 格式存储，key: `supercrew:recentRepos`
- 切换仓库时：
  - 更新 localStorage 的 `currentRepo` 和 `lastAccessed`
  - 触发重新加载 Kanban 数据（通过 React Query 的 `refetch` 或路由刷新）
- 保持现有的 GitHub OAuth 认证流程不变
- 跨标签页同步：监听 `storage` 事件，自动更新仓库列表

## Out of Scope

- 多仓库并行查看（split view 或多标签页）
- 跨仓库的数据聚合或统计
- 仓库收藏/置顶功能（可以在后续版本添加）
- 团队共享的仓库列表（每个用户独立的 localStorage）
- 服务器端存储用户的仓库偏好（纯前端实现）
