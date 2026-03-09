---
status: draft
reviewers: []
---

# Code Style and Formatting Standards

## Background

目前项目缺乏统一的代码格式规范，导致团队成员在单引号/双引号等格式问题上产生 git 冲突，影响协作效率。不同开发者使用不同的编辑器配置和个人习惯，导致代码风格不一致，增加了代码审查的复杂度，也容易在合并时产生不必要的格式冲突。

## Requirements

- 配置 Prettier 或 ESLint 统一格式化规则（包括单引号/双引号、缩进、换行等）
- 设置 pre-commit hook 自动格式化代码，确保提交的代码符合规范
- 统一项目中的单引号/双引号使用规则
- 统一缩进方式（空格/Tab）和大小
- 统一换行符（LF/CRLF）和文件末尾换行
- 配置 VSCode 设置（.vscode/settings.json）以自动应用格式化
- 更新团队文档说明代码规范和工具使用方法
- 确保配置在 monorepo 中对 frontend 和 backend 都生效

## Out of Scope

- 重构现有代码的逻辑结构
- 代码质量审查流程（本功能仅关注代码格式，不涉及代码质量标准）
- 代码命名规范（变量名、函数名等）
- 架构设计规范
