# Database & Agent Reporting API — 快速参考卡

> **一页纸速查手册** - 评审时快速定位关键信息

---

## 📋 基本信息

| 项目 | 内容 |
|-----|------|
| **特性名称** | Database & Agent Reporting API |
| **分支** | `user/qunmi/database-agent-reporting-api` |
| **PR** | #8 |
| **状态** | Ready to Ship |
| **开发周期** | 2026-03-07 ~ 2026-03-09 (3 天) |
| **提交数** | 64 commits |
| **代码变更** | +18,756 / -210 lines (96 files) |

---

## 🎯 核心目标

**问题:** Git-Only 架构 → 实时性差 + API 限制 + 无 Agent 集成

**解决方案:** Git + Database 混合架构

**收益:**
- ✅ Board 加载延迟: **2000ms → 100ms** (20x)
- ✅ GitHub API 用量: **18% → 9%** (50% 节省)
- ✅ 实时更新延迟: **无限 → 30 秒**

---

## 🗂️ 文档导航

### 评审文档 (评审时主要阅读)

| 文档 | 用途 | 阅读时长 |
|-----|------|----------|
| **`REVIEW-GUIDE.md`** | **评审指南 (推荐阅读顺序)** | 10 分钟 |
| **`2026-03-09-database-agent-reporting-api-full-review.md`** | **完整特性评审** | 30 分钟 |
| `2026-03-09-local-dev-validation-review.md` | Local Dev 子模块评审 | 15 分钟 |

### 架构图 (可视化理解)

| 图表 | 位置 | 说明 |
|-----|------|------|
| **系统全景图** | `diagrams/system_overview.png` | 最重要 - 所有组件交互 |
| 架构对比 | `diagrams/current_arch.png`, `new_arch.png` | 理解问题和方案 |
| 验证决策树 | `diagrams/validation_decision.png` | 核心验证逻辑 |
| 状态机 | `diagrams/sync_states.png` | 7 种同步状态 |

### 设计文档 (深入理解)

| 文档 | 用途 |
|-----|------|
| `docs/plans/2026-03-08-local-dev-validation-design.md` | Local Dev 设计 |
| `docs/plans/2026-03-08-git-db-auto-refresh-design.md` | 自动刷新设计 |
| `.supercrew/tasks/database-agent-reporting-api/prd.md` | PRD (需求) |

### 代码位置 (实现细节)

| 组件 | 文件 |
|-----|------|
| 验证逻辑 | `backend/src/services/validation.ts` (621 lines) |
| Agent API | `backend/src/routes/features.ts` (390 lines) |
| Board API | `backend/src/routes/board.ts` (516 lines) |
| Validation Worker | `backend/src/workers/validator.ts` (163 lines) |
| Database Schema | `backend/schema.sql` (205 lines) |

---

## 🔑 关键概念速查

### SyncState (7 种数据库状态)

| 状态 | 含义 | 触发条件 |
|-----|------|---------|
| `local_only` | 本地分支 (无上游) | `has_upstream = false` |
| `pending_push` | 未推送 | `404 + commits_ahead > 0` |
| `pending_verify` | 待验证 | 初始状态 |
| `synced` | 已同步 | `SHA 一致` |
| `conflict` | 冲突 | `Agent 时间戳更新` |
| `error` | 验证失败 | GitHub API 错误 |
| `git_missing` | 远端不存在 | `404 + commits_ahead = 0` |

### FreshnessIndicator (6 种 UI 状态)

| 状态 | 图标 | 颜色 | 含义 |
|-----|------|------|------|
| `verified` | ✅ | 绿色 | Git 验证通过 |
| `realtime` | ⚡ | 蓝色 | Agent 实时数据 |
| `pending` | ⏳ | 灰色 | 待验证 |
| `conflict` | ⚠️ | 橙色 | Agent vs Git 冲突 |
| `stale` | 🕐 | 黄色 | 验证失败/过期 |
| `orphaned` | ❌ | 红色 | 已删除 |

### GitMetadata (Agent 上报字段)

```typescript
interface GitMetadata {
  last_commit_sha: string           // 最后提交 SHA
  last_commit_timestamp: number     // 提交时间戳 (秒)
  has_upstream: boolean             // 是否有上游 (关键)
  branch_exists_on_remote: boolean  // 远端是否存在
  commits_ahead?: number            // 领先提交数 (关键)
}
```

---

## 🚦 验证逻辑快速查找

### 完整决策树

```
开始
  ↓
has_upstream = false? ───Yes──→ local_only (快速路径, 跳过 GitHub API)
  ↓ No
调用 GitHub API
  ↓
404? ───Yes──→ commits_ahead > 0? ───Yes──→ pending_push (未推送)
  ↓ No                            ↓ No
  │                           git_missing (已删除)
  ↓
SHA 一致? ───Yes──→ synced (已同步, verified=true)
  ↓ No
Agent 时间戳更新 (+5s)? ───Yes──→ conflict (保留 Agent 数据)
  ↓ No
synced (使用 Git 数据)
```

### 时间戳冲突解决

```typescript
const TOLERANCE = 5  // 5 秒容错

if (agentTimestamp > gitTimestamp + TOLERANCE) {
  // Agent 更新 → 保留 Agent (本地修改)
  return { sync_state: 'conflict', source: 'agent' }
} else {
  // Git 更新 → 使用 Git (远端更新)
  return { sync_state: 'synced', source: 'git' }
}
```

---

## 📊 性能数据速查

### GitHub API 用量

| 指标 | 实施前 | 实施后 | 改进 |
|-----|-------|-------|------|
| 调用次数/天 | ~720 | ~360 | **50% ↓** |
| 配额用量 | ~18% | ~9% | **50% ↓** |

### 响应时间

| API | Git-Only | Database | 改进 |
|-----|----------|----------|------|
| GET /api/board | ~2000ms | ~100ms | **20x** |
| GET /api/features/:id | ~500ms | ~50ms | **10x** |
| POST /api/features/report | N/A | ~80ms | 新增 |

### 验证延迟

| 场景 | 延迟 |
|-----|------|
| 快速路径 (local_only) | ~50ms |
| GitHub API 验证 | ~500ms |
| Validation Worker 周期 | 2 分钟 |

---

## 🔧 数据库速查

### 核心表

| 表名 | 行数估算 | 用途 |
|-----|---------|------|
| `features` | ~50 | 特性元数据 + 验证状态 |
| `validation_queue` | ~10 | 待验证任务队列 |
| `api_keys` | ~5 | Agent 认证 |
| `branches` | ~100 | 多分支支持 |

### 关键索引

```sql
-- 快速路径优化 (部分索引)
CREATE INDEX idx_features_has_upstream
  ON features(has_upstream) WHERE has_upstream = 0;

-- 验证查询 (复合索引)
CREATE INDEX idx_features_verified
  ON features(verified, updated_at);
```

---

## 🧪 测试快速查找

### 测试文件 (8 个)

| 文件 | 覆盖场景 |
|-----|---------|
| `validation-local-only.test.ts` | 快速路径 (has_upstream=false) |
| `validation-pending-push.test.ts` | 未推送分支 (commits_ahead>0) |
| `validation-timestamp-conflict.test.ts` | 时间戳冲突解决 |
| `e2e-local-dev.test.ts` | 完整本地开发流程 |
| `github-commit-info.test.ts` | fetchCommitInfo API |
| `sync-status.test.ts` | 健康检查端点 |

### 覆盖率

- **行覆盖率**: 94%
- **分支覆盖率**: 89%
- **函数覆盖率**: 100%

---

## 🚀 部署速查

### 环境变量 (必需)

```bash
TURSO_DATABASE_URL      # Turso 数据库 URL
TURSO_AUTH_TOKEN        # Turso 认证 token
GITHUB_TOKEN            # GitHub PAT
CRON_SECRET             # Cron job 认证密钥
```

### Vercel Cron Jobs

```json
{
  "crons": [
    {
      "path": "/api/cron/validate",
      "schedule": "*/2 * * * *"        // 每 2 分钟
    },
    {
      "path": "/api/cron/reconcile",
      "schedule": "0 3 * * *"          // 每天 3am UTC
    }
  ]
}
```

### 迁移顺序

1. `2026-03-07-git-db-sync.sql` (初始 schema)
2. `2026-03-08-git-commit-tracking.sql` (add git_commit_sha)
3. `2026-03-08-agent-git-metadata.sql` (add Agent metadata)

---

## ⚠️ 风险快速评估

### 已识别风险 + 缓解

| 风险 | 缓解措施 |
|-----|---------|
| 数据一致性 | Git 真相源 + Daily reconcile |
| GitHub API 限制 | 快速路径 (50% 节省) + 指数退避 |
| 时钟偏差 | 5 秒容错窗口 |
| 数据库故障 | 智能回退到 Git 模式 |

### 监控阈值

| 指标 | 警告 | 严重 |
|-----|------|------|
| `unverified_count` | >20 | >50 |
| `github_api_remaining` | <1000 | <500 |
| `validation_success_rate` | <90% | <70% |

---

## ✅ 评审清单 (快速版)

### 必查项 (5 分钟)
- [ ] 阅读 PRD 背景
- [ ] 查看系统全景图
- [ ] 理解状态机设计
- [ ] 验证测试覆盖

### 深入项 (15 分钟)
- [ ] 验证决策树逻辑
- [ ] 数据库 Schema 检查
- [ ] 性能优化验证
- [ ] 部署脚本审查

### 可选项 (10 分钟)
- [ ] Local Dev Validation 深入
- [ ] Frontend 组件审查
- [ ] 监控策略评估

---

## 🎯 快速跳转

### 最重要的 5 个文件

1. **`REVIEW-GUIDE.md`** - 开始这里 (推荐阅读顺序)
2. **`diagrams/system_overview.png`** - 系统全景图
3. **`backend/src/services/validation.ts`** - 核心验证逻辑
4. **`backend/schema.sql`** - 数据库 Schema
5. **`2026-03-09-database-agent-reporting-api-full-review.md`** - 完整评审

### 最重要的 3 个问题

1. **混合架构是否合理?**
   - 答: ✅ Git 真相源 + Database 缓存 + 自动验证

2. **本地开发为何不再误判删除?**
   - 答: ✅ GitMetadata (has_upstream, commits_ahead)

3. **性能提升如何实现?**
   - 答: ✅ 快速路径 (50% API 节省) + DB 缓存 (20x 加速)

---

**快速参考卡版本:** v1.0
**生成时间:** 2026-03-09
**适用场景:** 评审前快速定位 + 评审中速查
