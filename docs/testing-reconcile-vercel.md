# Git-DB Sync Vercel 部署测试指南

## 部署步骤

### 第一步：推送代码到 GitHub

```bash
# 确保在正确的分支上
git branch
# 应该显示: user/qunmi/database-agent-reporting-api

# 推送到远程
git push origin user/qunmi/database-agent-reporting-api
```

### 第二步：等待 Vercel 部署

1. 打开 Vercel Dashboard: https://vercel.com/dashboard
2. 找到 `supercrew-kanban` 项目
3. 查看 Deployments 列表
4. 点击最新的部署查看状态

**部署时间**: 通常 2-5 分钟

**部署完成标志**:
- Status: ✅ Ready
- Deployment URL 可访问

### 第三步：验证 Cron Jobs 配置

在 Vercel Dashboard:

1. 进入项目 → **Settings** → **Cron Jobs**
2. 确认看到 **两个** cron jobs:

| Path | Schedule | Description |
|------|----------|-------------|
| `/api/cron/validate` | `* * * * *` | 每分钟运行，验证 agent 报告的 features |
| `/api/cron/reconcile` | `0 3 * * *` | 每天 3:00 AM UTC 运行，同步 Git → DB |

如果没有显示，检查 `vercel.json` 是否正确配置。

---

## 测试步骤

### 测试 1: 手动触发 Reconcile 端点

#### 1.1 获取必要信息

你需要：
- **Vercel URL**: 从 Vercel Dashboard 获取（例如：`https://supercrew-kanban.vercel.app`）
- **CRON_SECRET**: 从 Vercel 项目环境变量获取

获取 CRON_SECRET:
1. Vercel Dashboard → 项目 → **Settings** → **Environment Variables**
2. 找到 `CRON_SECRET` 变量
3. 点击 "Reveal" 查看值

#### 1.2 发送测试请求

```bash
# 替换为实际值
VERCEL_URL="https://supercrew-kanban.vercel.app"
CRON_SECRET="your-actual-cron-secret"

curl -X GET "${VERCEL_URL}/api/cron/reconcile" \
  -H "x-vercel-cron-secret: ${CRON_SECRET}" \
  -v
```

#### 1.3 预期响应

**成功 (200 OK)**:
```json
{
  "ok": true,
  "timestamp": "2026-03-08T10:30:00.000Z",
  "repository": "your-username/supercrew-kanban",
  "scanned": 8,
  "inserted": 0,
  "updated": 8,
  "orphaned": 0,
  "errors": 0
}
```

**失败响应**:

- **401 Unauthorized**: CRON_SECRET 不匹配
  ```json
  { "error": "Unauthorized" }
  ```

- **500 Internal Server Error**: 查看 Vercel 日志获取详细错误
  ```json
  {
    "error": "Reconciliation failed",
    "details": "Error message here",
    "timestamp": "..."
  }
  ```

#### 1.4 解读 Stats

| 字段 | 含义 |
|------|------|
| `scanned` | 从 Git 扫描到的唯一 features 数量 |
| `inserted` | 新插入到数据库的 features |
| `updated` | 从 Git 更新的现有 features |
| `orphaned` | 标记为孤儿的 features (DB 有但 Git 无) |
| `errors` | 同步过程中的错误数量 |

**正常情况**:
- 首次运行: `inserted = scanned`, `updated = 0`
- 后续运行: `inserted = 0`, `updated = scanned`
- `errors = 0` (无错误)

---

### 测试 2: 查看 Vercel 日志

#### 2.1 实时日志查看

Vercel Dashboard → 项目 → **Deployments** → 点击最新部署 → **Functions** 标签

查找 `api/cron/reconcile` 函数的日志输出：

```
[Reconcile] Starting daily reconcile for username/repo
[Reconcile] Discovered 10 branches
[Reconcile] Fetched 8 feature snapshots
[Reconcile] Mapped 8 unique features
[Reconcile] Found 0 features in DB
[Reconcile] Synced: 8 inserted, 0 updated
[Reconcile] Marked 0 features as orphaned
[Reconcile] Complete: { scanned: 8, inserted: 8, ... }
[Reconcile Cron] Reconciliation complete: { scanned: 8, ... }
```

#### 2.2 检查错误日志

如果 `stats.errors > 0`，日志中会显示：

```
[Reconcile] Error syncing feature-id: Error message
```

常见错误:
- **GitHub API rate limit**: 等待或使用不同的 token
- **Parse error**: meta.yaml 格式问题
- **Database error**: Turso 连接或 schema 问题

---

### 测试 3: 验证数据库内容

使用 Turso CLI 或 SQL 客户端：

```bash
# 使用 Turso CLI
turso db shell your-database-name

# 查询 features
SELECT
  id,
  title,
  source,
  verified,
  sync_state,
  datetime(updated_at/1000, 'unixepoch') as updated
FROM features
ORDER BY updated_at DESC
LIMIT 10;
```

**预期结果**:

| id | title | source | verified | sync_state | updated |
|----|-------|--------|----------|------------|---------|
| database-agent-reporting-api | Database & Agent... | git | 1 | synced | 2026-03-08 10:30:00 |
| multi-branch-kanban | Multi-Branch Kanban | git | 1 | synced | 2026-03-08 10:30:00 |
| ... | ... | git | 1 | synced | ... |

**所有 features 应该**:
- `source = 'git'`
- `verified = 1` (true)
- `sync_state = 'synced'`

---

### 测试 4: 测试 Agent 验证流程

这个测试验证 Agent 报告的数据能否被正确验证。

#### 4.1 模拟 Agent 报告

首先需要一个 API Key。如果还没有，创建一个：

```bash
# 使用你的 backend API 创建 API key
# 或者在数据库中手动插入
```

然后发送 agent 报告：

```bash
API_KEY="your-api-key"
VERCEL_URL="https://supercrew-kanban.vercel.app"

curl -X POST "${VERCEL_URL}/api/features/report" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_owner": "your-username",
    "repo_name": "supercrew-kanban",
    "feature_id": "database-agent-reporting-api",
    "data": {
      "status": "doing",
      "meta_yaml": "id: database-agent-reporting-api\ntitle: Database & Agent Reporting API\nstatus: doing"
    }
  }'
```

**预期响应**:
```json
{
  "ok": true,
  "feature_id": "database-agent-reporting-api",
  "source": "agent",
  "verified": false,
  "queued_for_validation": true,
  "message": "Status updated. Will verify against Git in ~30-60s."
}
```

#### 4.2 等待验证

等待 1-2 分钟，让 validation worker (`/api/cron/validate`) 运行。

#### 4.3 检查数据库

```sql
SELECT
  id,
  source,
  verified,
  sync_state,
  datetime(verified_at/1000, 'unixepoch') as verified_at
FROM features
WHERE id = 'database-agent-reporting-api';
```

**预期**:
- `source = 'agent_verified'` (从 `agent` 升级为 `agent_verified`)
- `verified = 1`
- `sync_state = 'synced'`
- `verified_at` 有值

#### 4.4 查看前端

打开 kanban 前端，检查该 feature 的 badge:
- 应该显示 **✅ Verified** badge
- 不再显示 **⚡ Realtime** badge

---

### 测试 5: 测试孤儿检测

#### 5.1 创建孤儿 feature

发送 agent 报告，但 **不要** 推送到 Git：

```bash
curl -X POST "${VERCEL_URL}/api/features/report" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_owner": "your-username",
    "repo_name": "supercrew-kanban",
    "feature_id": "orphan-test",
    "data": {
      "status": "doing",
      "meta_yaml": "id: orphan-test\ntitle: Orphan Test\nstatus: doing"
    }
  }'
```

#### 5.2 等待 Grace Window 过期

Grace window = 10 分钟。等待 10+ 分钟，或者修改数据库中的 `created_at`:

```sql
-- 将 created_at 设置为 20 分钟前
UPDATE features
SET created_at = (strftime('%s', 'now') - 1200) * 1000
WHERE id = 'orphan-test';
```

#### 5.3 手动触发 Reconcile

```bash
curl -X GET "${VERCEL_URL}/api/cron/reconcile" \
  -H "x-vercel-cron-secret: ${CRON_SECRET}"
```

预期响应应包含 `"orphaned": 1`。

#### 5.4 检查数据库

```sql
SELECT
  id,
  source,
  verified,
  sync_state,
  last_sync_error
FROM features
WHERE id = 'orphan-test';
```

**预期**:
- `source = 'agent_orphaned'`
- `verified = 0` (false)
- `sync_state = 'git_missing'`
- `last_sync_error = 'Feature not found in Git during daily reconcile'`

#### 5.5 查看前端

该 feature 应该显示 **🔍 Orphaned** badge。

---

### 测试 6: 验证每日自动运行

这个测试需要等到第二天 3:00 AM UTC。

#### 6.1 设置提醒

在 3:05 AM UTC 左右检查：

1. Vercel 日志中是否有 reconcile 执行记录
2. 数据库 `updated_at` 字段是否更新

#### 6.2 查看 Cron 执行历史

Vercel Dashboard → 项目 → **Cron Jobs** → 点击 `/api/cron/reconcile`

查看执行历史：
- ✅ Success - 成功执行
- ❌ Failed - 失败（查看错误日志）

---

## 监控和告警

### 推荐设置

1. **Vercel Alerts**:
   - Settings → Integrations → Notifications
   - 启用 "Function Errors" 通知

2. **每日检查**:
   - 每天查看一次 reconcile stats
   - 确保 `errors = 0`

3. **孤儿率监控**:
   - 如果 `orphaned > 10%`，调查原因
   - 可能是 agent 未推送或 Git 分支被删除

---

## 验证清单

完成 Vercel 测试后，确认：

- [ ] Vercel 部署成功
- [ ] 两个 Cron Jobs 已注册
- [ ] 手动 reconcile 返回正确的 stats
- [ ] Vercel 日志无错误
- [ ] 数据库中所有 features 标记为 `source='git'`
- [ ] Agent 验证流程正常（`agent` → `agent_verified`）
- [ ] 孤儿检测正常（标记为 `agent_orphaned`）
- [ ] 前端显示正确的 freshness badges
- [ ] 每日自动运行正常（需等到第二天）

---

## 故障排查

### 问题 1: Reconcile 返回 401

**原因**: CRON_SECRET 不匹配

**解决**:
1. 检查 Vercel 环境变量中的 `CRON_SECRET`
2. 确保请求 header 中的值完全一致（无空格）

### 问题 2: Reconcile 返回 500

**原因**: 内部错误

**解决**:
1. 查看 Vercel Function 日志
2. 常见原因:
   - `GITHUB_TOKEN` 未配置或过期
   - Turso database 连接失败
   - GitHub API rate limit

### 问题 3: Stats 显示 errors > 0

**原因**: 某些 features 同步失败

**解决**:
1. 查看日志中的错误信息
2. 检查特定 feature 的 meta.yaml 是否格式正确
3. 确认 GitHub repo 权限正常

### 问题 4: Agent 验证不工作

**原因**: Validation worker 未运行或失败

**解决**:
1. 确认 `/api/cron/validate` 每分钟运行
2. 查看 validation worker 日志
3. 检查 `validation_queue` 表是否有堆积的 jobs

### 问题 5: Cron Jobs 未显示

**原因**: `vercel.json` 未正确配置或未部署

**解决**:
1. 检查 `vercel.json` 格式正确
2. 确保最新代码已推送并部署
3. 重新部署项目

---

## 下一步

测试通过后：
1. 合并到 main 分支
2. 更新文档（README.md）
3. 创建 PR 说明新功能
4. 监控生产环境运行 1-2 天
