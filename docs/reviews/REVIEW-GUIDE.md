# Database & Agent Reporting API — 评审指南

## 📖 推荐阅读顺序

本文档提供一个结构化的评审路径，帮助评审者快速理解整个特性的设计和实现。

---

## 🎯 评审目标

评审者应该能够回答以下问题:
- ✅ 这个特性解决了什么问题？
- ✅ 架构设计是否合理？
- ✅ 实现是否完整？
- ✅ 性能优化是否到位？
- ✅ 测试覆盖是否充分？
- ✅ 部署是否有风险？

**预计评审时长:** 45-60 分钟

---

## 📚 Phase 1: 快速概览 (5 分钟)

**目标:** 理解问题背景和解决方案概要

### 1.1 阅读 PRD (2 分钟)

📄 **文件:** `.supercrew/tasks/database-agent-reporting-api/prd.md`

**重点关注:**
- Background 部分 (为什么需要这个特性?)
- Requirements 部分 (核心功能需求)
- Success Criteria (成功标准)

**关键问题:**
- 当前架构的痛点是什么？
  - 答: 实时性差, GitHub API 限制, 无 Agent 集成
- 这个特性要解决什么核心问题？
  - 答: 提供实时更新 + 降低 API 用量

### 1.2 查看架构对比图 (3 分钟)

🖼️ **图表:** `docs/reviews/diagrams/current_arch.png` + `new_arch.png`

**对比要点:**
- 当前架构 (Git-Only): 延迟高, API 消耗大
- 新架构 (混合): Database 缓存 + 自动验证

**思考:**
- 为什么选择混合架构而不是纯 Database?
  - 答: Git 保留为真相源,保证正确性

---

## 🏗️ Phase 2: 架构深入 (15 分钟)

**目标:** 理解系统设计和核心组件

### 2.1 系统全景图 (5 分钟)

🖼️ **图表:** `docs/reviews/diagrams/system_overview.png`

📄 **文档:** `docs/reviews/2026-03-09-database-agent-reporting-api-full-review.md` (Section 2)

**阅读重点:**
- Agent Layer → Backend Layer → Storage Layer → Frontend Layer
- 数据流向: Agent 上报 → Database → Validation Worker → Frontend

**关键组件:**
1. **Agent API**: POST /api/features/report
2. **Database**: Turso (libSQL/SQLite)
3. **Validation Worker**: Vercel Cron (每 2 分钟)
4. **Board API**: GET /api/board (DB 优先, Git 回退)

**验证要点:**
- [ ] 组件职责是否清晰?
- [ ] 数据流是否合理?
- [ ] 性能瓶颈在哪里?

### 2.2 数据库 Schema (5 分钟)

📄 **文件:** `backend/schema.sql`

📄 **文档:** Section 2.2 (Database Schema)

**重点检查:**
1. **features 表** (核心表)
   - 验证状态字段: `source`, `verified`, `sync_state`
   - Git 元数据: `git_commit_sha`, `last_git_commit_at`
   - Agent 上报: `has_upstream`, `commits_ahead`

2. **validation_queue 表**
   - 优先级队列
   - 重试机制 (attempts, last_error)

3. **索引优化**
   - 部分索引: `idx_features_has_upstream` (快速路径)
   - 复合索引: `idx_features_verified`

**关键问题:**
- Schema 是否支持所有功能需求?
- 索引是否覆盖主要查询?
- 迁移策略是否安全?

### 2.3 状态机设计 (5 分钟)

🖼️ **图表:**
- `docs/reviews/diagrams/sync_states.png` (SyncState 7 种状态)
- `docs/reviews/diagrams/freshness.png` (FreshnessIndicator 6 种 UI 状态)

📄 **文档:** Section 2.3 (Core State Machine)

**状态转换验证:**

**SyncState (数据库状态):**
```
pending_verify → local_only (has_upstream = false)
pending_verify → pending_push (404 + commits_ahead > 0)
pending_verify → synced (SHA 一致)
pending_verify → conflict (Agent 时间戳更新)
pending_verify → error (GitHub API 错误)
pending_verify → git_missing (404 + commits_ahead = 0)
```

**FreshnessIndicator (UI 状态):**
```
realtime → verified (验证成功)
realtime → conflict (SHA 不同)
realtime → stale (验证失败)
realtime → orphaned (Git 404)
```

**检查要点:**
- [ ] 状态转换是否完整?
- [ ] 是否有死锁状态?
- [ ] 错误状态是否有恢复路径?

---

## ⚙️ Phase 3: 核心逻辑验证 (15 分钟)

**目标:** 理解关键算法和验证逻辑

### 3.1 验证决策树 (10 分钟)

🖼️ **图表:** `docs/reviews/diagrams/validation_decision.png`

📄 **代码:** `backend/src/services/validation.ts`

📄 **文档:** Section 3.3 (Validation Logic)

**逐步验证逻辑:**

#### Step 1: 快速路径检查
```typescript
if (has_upstream === false) {
  return { sync_state: 'local_only', action: 'local_only' }
}
```

**验证:**
✅ 跳过 GitHub API (~50% 节省)
✅ 适用于本地分支 (无远端)

#### Step 2: GitHub API 调用
```typescript
const gitData = await fetchFeatureFromGit(...)
```

**验证:**
✅ 并行获取多个文件 (meta.yaml, dev-design.md, etc.)
✅ 使用 Commits API 获取真实 commit SHA 和时间戳
✅ 错误处理完整 (404, 403, 500)

#### Step 3: 404 分支处理
```typescript
if (error.status === 404) {
  if (commits_ahead > 0) {
    return { sync_state: 'pending_push' }  // 未推送
  } else {
    return { sync_state: 'git_missing' }   // 已删除
  }
}
```

**验证:**
✅ 解决了"本地开发被误判删除"的问题
✅ commits_ahead 准确判断分支状态

#### Step 4: SHA 对比
```typescript
if (dbData.git_commit_sha === gitData.sha) {
  return { sync_state: 'synced', verified: true }
}
```

**验证:**
✅ SHA 一致 → 数据同步
✅ 标记为 verified

#### Step 5: 时间戳冲突解决
```typescript
if (agentTimestamp > gitTimestamp + TOLERANCE) {
  return { sync_state: 'conflict', source: 'agent' }  // 保留 Agent
} else {
  return { sync_state: 'synced', source: 'git' }     // 使用 Git
}
```

**验证:**
✅ 5 秒容错避免时钟偏差
✅ Agent 时间戳更新 → 保留 Agent 数据 (本地修改)
✅ Git 时间戳更新 → 使用 Git 数据 (远端更新)

**关键问题:**
- [ ] 验证逻辑是否覆盖所有场景?
- [ ] 边缘情况是否处理正确?
- [ ] 性能优化是否合理?

### 3.2 Validation Worker 流程 (5 分钟)

🖼️ **图表:** `docs/reviews/diagrams/validation_worker.png`

📄 **代码:**
- `api/cron/validate.ts` (Vercel Cron 端点)
- `backend/src/workers/validator.ts` (Worker 逻辑)

📄 **文档:** Section 3.5 (Background Workers)

**执行流程:**
1. Vercel Cron 触发 (每 2 分钟)
2. 获取未验证特性队列
3. 批量验证 (10 并发)
4. 更新数据库状态
5. 失败重试 (指数退避: 2^attempt 秒)

**验证要点:**
- [ ] Cron 频率合理? (2 分钟 vs API 限制)
- [ ] 并发数合理? (10 并发 vs 性能)
- [ ] 重试策略完善? (最多 3 次, 10 次失败后移除)

---

## 🎨 Phase 4: Frontend 集成 (5 分钟)

**目标:** 验证用户体验和 UI 反馈

### 4.1 UI 组件

📄 **代码:**
- `frontend/packages/local-web/src/components/VerificationBadge.tsx`
- `frontend/packages/local-web/src/components/BoardMetadataBanner.tsx`

📄 **文档:** Section 3.6 (Frontend Integration)

**组件验证:**

#### VerificationBadge
```tsx
<VerificationBadge syncState="synced" verified={true} />
// 显示: ✅ Verified (绿色)

<VerificationBadge syncState="local_only" verified={false} />
// 显示: ⚡ Real-time (蓝色)

<VerificationBadge syncState="conflict" verified={false} />
// 显示: ⚠️ Conflict (橙色)
```

**检查:**
- [ ] 6 种状态图标清晰?
- [ ] 颜色语义正确?
- [ ] compact 模式可用?

#### BoardMetadataBanner
```tsx
<BoardMetadataBanner metadata={boardMetadata} onRefresh={...} />
// 显示: Source: Database | Unverified: 3/10 | Last sync: 30s ago
```

**检查:**
- [ ] 元数据显示完整?
- [ ] 手动刷新按钮可用?
- [ ] 加载状态显示?

### 4.2 智能轮询策略

📄 **代码:** `frontend/packages/app-core/src/hooks/useBoard.ts`

```typescript
const pollInterval = unverifiedCount > 0 ? 30_000 : 300_000
// 有未验证 → 30 秒轮询
// 全部验证 → 5 分钟轮询
```

**检查:**
- [ ] 轮询频率合理?
- [ ] 是否避免不必要的请求?

---

## 🧪 Phase 5: 测试覆盖 (5 分钟)

**目标:** 验证测试充分性

🖼️ **图表:** `docs/reviews/diagrams/test_pyramid.png`

📄 **文档:** Section 6 (Testing Strategy)

### 5.1 测试文件清单

| 测试文件 | 类型 | 覆盖内容 |
|---------|------|---------|
| `validation-local-only.test.ts` | 集成 | 快速路径 (has_upstream=false) |
| `validation-pending-push.test.ts` | 集成 | 未推送分支 (commits_ahead>0) |
| `validation-timestamp-conflict.test.ts` | 集成 | 时间戳冲突解决 |
| `e2e-local-dev.test.ts` | E2E | 完整本地开发流程 |
| `github-commit-info.test.ts` | 集成 | fetchCommitInfo API |
| `sync-status.test.ts` | 集成 | 健康检查端点 |

### 5.2 测试覆盖验证

**关键路径:**
- [x] 快速路径 (local_only)
- [x] 未推送分支 (pending_push)
- [x] SHA 一致 (synced)
- [x] 时间戳冲突 (conflict)
- [x] GitHub 404 (git_missing)
- [x] API 错误 (error)

**边缘情况:**
- [x] 时钟偏差 (<5 秒)
- [x] GitHub API rate limit
- [x] 无 GITHUB_TOKEN 环境

**检查要点:**
- [ ] 覆盖率 >90%?
- [ ] 关键路径是否全覆盖?
- [ ] 边缘情况是否测试?

---

## 📊 Phase 6: 性能与优化 (5 分钟)

**目标:** 验证性能优化效果

🖼️ **图表:** `docs/reviews/diagrams/api_comparison.png`

📄 **文档:** Section 7 (Performance Optimization)

### 6.1 GitHub API 用量对比

| 指标 | 实施前 | 实施后 | 改进 |
|-----|-------|-------|------|
| API 调用/天 | ~720 | ~360 | **50% ↓** |
| 配额用量 | ~18% | ~9% | **50% ↓** |
| 验证延迟 (本地) | ~500ms | ~50ms | **10x ↑** |

**验证:**
- [ ] 快速路径是否真正跳过 API?
- [ ] 配额计算是否准确?

### 6.2 响应时间对比

| API 端点 | Git-Only | Database | 改进 |
|---------|----------|----------|------|
| GET /api/board | ~2000ms | ~100ms | **20x** |
| GET /api/features/:id | ~500ms | ~50ms | **10x** |

**验证:**
- [ ] Database 查询是否优化?
- [ ] 索引是否覆盖查询?

### 6.3 数据库索引

```sql
-- 部分索引 (快速路径)
CREATE INDEX idx_features_has_upstream
  ON features(has_upstream) WHERE has_upstream = 0;

-- 复合索引 (验证查询)
CREATE INDEX idx_features_verified
  ON features(verified, updated_at);
```

**验证:**
- [ ] 部分索引是否生效?
- [ ] 查询计划是否使用索引?

---

## 🚀 Phase 7: 部署与运维 (10 分钟)

**目标:** 评估部署风险和运维策略

🖼️ **图表:** `docs/reviews/diagrams/deployment.png`

📄 **文档:** Section 8 (Deployment)

### 7.1 部署步骤验证

**部署流程:**
1. ✅ Turso 数据库创建 + 迁移
2. ✅ Vercel 环境变量配置
3. ✅ Vercel 部署 (Backend + Frontend)
4. ✅ 验证 Cron Jobs
5. ✅ 监控 (Logs + Metrics)

**检查要点:**
- [ ] 迁移脚本是否可逆?
- [ ] 环境变量是否完整?
- [ ] Cron Jobs 配置正确?

### 7.2 回滚计划

📄 **文档:** Section 8.5 (Rollback Plan)

```sql
-- 回滚数据库迁移
ALTER TABLE features DROP COLUMN git_commit_sha;
ALTER TABLE features DROP COLUMN has_upstream;
-- ...
```

**验证:**
- [ ] 回滚步骤是否完整?
- [ ] 数据丢失风险?
- [ ] 回滚后功能是否正常?

### 7.3 监控与告警

📄 **文档:** Section 9 (Monitoring)

**关键指标:**
| 指标 | 警告阈值 | 严重阈值 |
|-----|---------|---------|
| `unverified_count` | >20 | >50 |
| `verification_queue_length` | >100 | >500 |
| `validation_success_rate` | <90% | <70% |
| `github_api_remaining` | <1000 | <500 |

**验证:**
- [ ] 监控指标是否覆盖关键路径?
- [ ] 告警阈值是否合理?
- [ ] 健康检查端点是否可用?

---

## 🎓 Phase 8: Local Dev Validation 深入 (可选, 10 分钟)

**目标:** 理解子模块的设计和实现

📄 **文档:** `docs/reviews/2026-03-09-local-dev-validation-review.md`

🖼️ **图表:** `docs/reviews/diagrams/local-dev/`

### 核心问题
- 本地开发分支为何被误判为"已删除"?
- GitMetadata 如何解决这个问题?
- 快速路径如何节省 50% API?

**阅读要点:**
1. **问题场景** (Section 4.1)
2. **解决方案** (Section 4.2)
   - GitMetadata 上报
   - 快速路径优化
   - 时间戳冲突解决
3. **实现细节** (Section 4.4)
4. **测试覆盖** (Section 4.6)

---

## ✅ 评审检查清单

完成评审后，请验证以下要点:

### 架构设计
- [ ] 混合架构合理? (Git + Database)
- [ ] 组件职责清晰?
- [ ] 数据流向正确?
- [ ] 性能瓶颈识别?

### 功能完整性
- [ ] Agent Reporting API 完整?
- [ ] Board Reading API 完整?
- [ ] Validation Worker 稳定?
- [ ] Frontend 集成完善?

### 代码质量
- [ ] 类型安全? (无 `as any`)
- [ ] 错误处理完整?
- [ ] 测试覆盖充分? (>90%)
- [ ] 代码可读性好?

### 性能指标
- [ ] Board 加载 <200ms?
- [ ] GitHub API 用量 <10%?
- [ ] 验证成功率 >90%?

### 运维就绪
- [ ] 数据库迁移脚本完整?
- [ ] 部署脚本可用?
- [ ] 回滚计划明确?
- [ ] 监控指标定义?

### 文档完整性
- [ ] 设计文档齐全?
- [ ] 实施文档详细?
- [ ] 运维文档清晰?
- [ ] 评审文档专业?

---

## 🎯 评审输出

评审完成后，请提供以下反馈:

### 1. 总体评价
- ✅ **Approve** (批准合并)
- ⚠️ **Request Changes** (需要修改)
- 🔄 **Comment** (建议优化)

### 2. 关键发现
- **优点**: (列出 3-5 项技术亮点)
- **问题**: (列出需要修复的问题)
- **建议**: (列出优化建议)

### 3. 风险评估
- **高风险**: (需要立即处理)
- **中风险**: (建议修复)
- **低风险**: (可后续优化)

### 4. 后续行动
- [ ] 修复关键问题
- [ ] 补充测试覆盖
- [ ] 更新文档
- [ ] 部署到生产

---

## 📞 联系方式

**有疑问?**
- 查看完整评审文档: `docs/reviews/2026-03-09-database-agent-reporting-api-full-review.md`
- 查看架构图: `docs/reviews/diagrams/`
- 查看设计文档: `docs/plans/2026-03-08-local-dev-validation-design.md`

**快速链接:**
- Pull Request: #8
- 开发分支: `user/qunmi/database-agent-reporting-api`
- 提交数量: 64 commits
- 代码变更: +18,756 / -210 lines

---

**评审指南版本:** v1.0
**生成时间:** 2026-03-09
**预计评审时长:** 45-60 分钟
