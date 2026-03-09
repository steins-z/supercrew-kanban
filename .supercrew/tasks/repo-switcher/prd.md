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

- **仓库切换器 UI**：在页面顶部添加一个下拉菜单或切换器，显示用户最近访问过的仓库列表
- **快速切换**：点击列表中的仓库即可直接切换，无需断开连接
- **添加新仓库**：提供"Connect Another Repo"选项，用于添加新的仓库到列表中
- **持久化存储**：使用 localStorage 记录每个用户访问过的仓库列表和最后访问的仓库

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

- 自动记录：用户首次连接仓库时，自动添加到"最近访问"列表
- 排序：按最后访问时间倒序排列，最近使用的在最上面
- 限制数量：最多保留 10 个最近访问的仓库（可配置）
- 当前标识：高亮显示当前正在查看的仓库
- 移除选项：用户可以从列表中移除不再需要的仓库

### 技术要求

- 使用 React hooks 管理仓库切换状态
- localStorage 数据以 JSON 格式存储
- 切换仓库时重新加载 Kanban 数据（branch、issues、tasks 等）
- 保持现有的 GitHub OAuth 认证流程不变
- 确保跨标签页同步（监听 localStorage 变化）

## Out of Scope

- 多仓库并行查看（split view 或多标签页）
- 跨仓库的数据聚合或统计
- 仓库收藏/置顶功能（可以在后续版本添加）
- 团队共享的仓库列表（每个用户独立的 localStorage）
- 服务器端存储用户的仓库偏好（纯前端实现）
