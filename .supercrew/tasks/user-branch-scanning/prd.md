---
status: draft
reviewers: []
---

# Support User Branch Pattern Scanning

## Background

目前看板只扫描 `feature/*` pattern 的分支，但 SuperCrew 工作流使用 `user/<username>/` 命名约定来组织功能开发。这导致所有在 user branches 上的工作（包括 backlog branches 和工作分支）都无法在看板上显示。

SuperCrew 的分支命名规范：
- Backlog 分支: `user/<username>/backlog-<feature-id>`
- 工作分支: `user/<username>/<feature-id>`

需要修改看板的分支扫描逻辑，使其能够识别和显示 user branches 上的功能。

## Requirements

- 修改默认 branch pattern 从单一的 `feature/*` 改为支持 `user/*` pattern
- 支持同时扫描多个 branch patterns（如同时支持 `user/*` 和 `feature/*`）
- 确保 backlog branches (`user/<username>/backlog-*`) 和工作分支 (`user/<username>/<feature-id>`) 都能被扫描到
- 保持向后兼容性：main 分支仍然默认包含在扫描范围内
- 前端调用 API 时可以灵活配置需要扫描的 branch patterns
- 更新 API 文档说明新的 branch pattern 参数用法

## Out of Scope

- Branch 访问权限管理（由 GitHub OAuth token 控制）
- 复杂的 branch 过滤规则（如正则表达式、exclude patterns）
- Branch 命名规范验证
- 自动识别组织的 branch 命名约定
