---
status: approved
reviewers: []
---

# Status Schema Refinement

## Background

将 feature 状态从 6 种简化为 4 种（todo, doing, ready-to-ship, shipped），使其与 supercrew 的状态模型保持一致。

## Requirements

- 更新 `SupercrewStatus` 类型定义：移除 `planning`, `designing`, `ready`, `active`, `blocked`, `done`
- 新增 4 种状态：`todo`, `doing`, `ready-to-ship`, `shipped`
- 更新前端所有引用这些状态的代码
- 更新多语言文件（en.json, zh.json）
- 更新样式文件以支持新状态

## Out of Scope

- 后端 API 更改（如有）
- 数据迁移脚本
