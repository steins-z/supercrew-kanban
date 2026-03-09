---
status: draft
reviewers: []
---

# Quick Add Feature from Kanban

## Background

目前用户只能通过命令行或 SuperCrew skills 来创建新的 feature。在使用看板管理任务时，用户需要：
1. 切换到终端
2. 运行 `/supercrew:create` 命令
3. 回答一系列问题
4. 返回看板查看新创建的任务

这个流程打断了用户在看板上的工作流，体验不够流畅。

理想的体验应该是：用户在看板的 Todo 列看到一个 **+** 按钮，点击后弹出模态框，填写 feature 信息，系统自动创建 feature 并推送到远程分支。整个过程不需要离开看板界面。

## Requirements

### 核心功能

1. **Todo 列添加 + 按钮**
   - 在 Todo 列的顶部或底部显示一个明显的 + 按钮
   - 按钮样式应该与现有 UI 风格一致
   - 鼠标悬停时有视觉反馈

2. **Feature 创建模态框**
   - 点击 + 按钮后弹出模态框
   - 表单字段：
     - Feature Title (必填)
     - Feature ID (自动从 title 生成 kebab-case，可编辑)
     - Priority (P0/P1/P2/P3 下拉选择，默认 P2)
     - Owner (默认当前用户，可编辑)
     - Background (多行文本)
     - Requirements (多行文本)
     - Out of Scope (多行文本，可选)
   - 表单验证：title 和 ID 必填，ID 必须是 kebab-case
   - 提交和取消按钮

3. **自动创建和推送**
   - 点击提交后：
     - 创建 `.supercrew/tasks/<feature-id>/` 目录
     - 生成 `meta.yaml` 和 `prd.md`
     - 创建 `user/<username>/<feature-id>` 分支
     - 提交文件
     - 自动推送到远程 (`git push -u origin user/<username>/<feature-id>`)
   - 显示加载状态和成功/失败提示
   - 成功后自动刷新看板，新 feature 出现在 Todo 列

4. **用户体验**
   - 整个过程流畅，无需切换界面
   - 错误处理：重复 ID、网络错误等
   - 加载状态明确
   - 成功后给予反馈（toast/notification）

### 技术要求

1. **前端 API**
   - 创建新的 API endpoint: `POST /api/features/create`
   - Request body 包含 feature 信息
   - Response 包含创建结果和分支信息

2. **后端实现**
   - 使用 simple-git 进行 Git 操作
   - 文件创建和格式化
   - 错误处理和回滚机制
   - 支持本地模式 (local-git) 和 GitHub 模式

3. **模态框组件**
   - 复用现有的 Modal 组件模式
   - 表单验证逻辑
   - 自动生成 kebab-case ID

## Out of Scope

以下功能不在本次实现范围内：

- 批量创建 features
- Feature 模板支持
- 从现有 feature 复制创建
- 拖拽文件上传（如需求文档）
- 团队成员选择器（当前手动输入 owner）
- GitHub Issue/Project 集成
