# Git-DB Sync 本地测试指南

## 前置准备

### 1. 环境变量配置

确保 `.env` 文件包含以下变量：

```bash
# Turso Database
TURSO_DATABASE_URL=your_turso_url
TURSO_AUTH_TOKEN=your_turso_token

# GitHub
GITHUB_TOKEN=your_github_token

# Cron Secret (本地测试用)
CRON_SECRET=local-test-secret

# Repository (可选，代码中有默认值)
REPO_OWNER=your-github-username
REPO_NAME=supercrew-kanban
```

### 2. 安装依赖

```bash
cd backend
bun install
```

### 3. 检查数据库连接

```bash
cd backend
bun run backend/src/services/database.ts
# 或者直接测试 Turso 连接
```

---

## 本地测试步骤

### 测试 1: 直接调用 dailyReconcile 函数

创建测试脚本 `backend/test-reconcile.ts`:

```typescript
import { dailyReconcile } from './src/workers/reconcile.js'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!
const REPO_OWNER = process.env.REPO_OWNER || 'your-username'
const REPO_NAME = process.env.REPO_NAME || 'supercrew-kanban'

async function testReconcile() {
  console.log('Starting reconcile test...')
  console.log(`Repository: ${REPO_OWNER}/${REPO_NAME}`)

  try {
    const stats = await dailyReconcile(REPO_OWNER, REPO_NAME, GITHUB_TOKEN)

    console.log('\n✅ Reconcile completed successfully!')
    console.log('Stats:', stats)
    console.log(`  - Scanned: ${stats.scanned}`)
    console.log(`  - Inserted: ${stats.inserted}`)
    console.log(`  - Updated: ${stats.updated}`)
    console.log(`  - Orphaned: ${stats.orphaned}`)
    console.log(`  - Errors: ${stats.errors}`)
  } catch (error) {
    console.error('\n❌ Reconcile failed!')
    console.error(error)
    process.exit(1)
  }
}

testReconcile()
```

运行测试：

```bash
cd backend
bun run test-reconcile.ts
```

**预期输出**:
```
Starting reconcile test...
Repository: your-username/supercrew-kanban
[Reconcile] Starting daily reconcile for your-username/supercrew-kanban
[Reconcile] Discovered 10 branches
[Reconcile] Fetched 8 feature snapshots
[Reconcile] Mapped 8 unique features
[Reconcile] Found 0 features in DB
[Reconcile] Synced: 8 inserted, 0 updated
[Reconcile] Marked 0 features as orphaned
[Reconcile] Complete: { scanned: 8, inserted: 8, updated: 0, orphaned: 0, errors: 0 }

✅ Reconcile completed successfully!
Stats: { scanned: 8, inserted: 8, updated: 0, orphaned: 0, errors: 0 }
```

---

### 测试 2: 测试 Vercel Cron 端点（本地模拟）

启动本地 Hono 服务器：

```bash
cd backend
bun run src/index.ts
# 服务器应该在 http://localhost:3001 启动
```

在另一个终端，测试 reconcile 端点：

```bash
curl -X GET 'http://localhost:3001/api/cron/reconcile' \
  -H 'x-vercel-cron-secret: local-test-secret' \
  -v
```

**注意**: 本地 Hono 服务器可能没有 `/api/cron/reconcile` 路由，因为这是 Vercel serverless 端点。你需要先添加路由。

如果需要添加路由，修改 `backend/src/index.ts`:

```typescript
import { dailyReconcile } from './workers/reconcile.js'

// 添加 reconcile 路由
app.get('/api/cron/reconcile', async (c) => {
  const cronSecret = c.req.header('x-vercel-cron-secret')
  const expectedSecret = process.env.CRON_SECRET

  if (cronSecret !== expectedSecret) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const repoOwner = process.env.REPO_OWNER || 'supercrew'
    const repoName = process.env.REPO_NAME || 'kanban'
    const githubToken = process.env.GITHUB_TOKEN!

    const stats = await dailyReconcile(repoOwner, repoName, githubToken)

    return c.json({
      ok: true,
      timestamp: new Date().toISOString(),
      repository: `${repoOwner}/${repoName}`,
      ...stats,
    })
  } catch (error) {
    console.error('Reconcile failed:', error)
    return c.json(
      {
        error: 'Reconciliation failed',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})
```

---

### 测试 3: 验证数据库内容

#### 3.1 检查同步的 features

```bash
# 使用 Turso CLI
turso db shell your-database-name

# 或者创建测试脚本
```

创建 `backend/check-db.ts`:

```typescript
import { db } from './src/services/database.js'

async function checkDatabase() {
  const result = await db.execute({
    sql: 'SELECT id, title, source, verified, sync_state FROM features ORDER BY updated_at DESC LIMIT 10',
    args: [],
  })

  console.log('\n📊 Database Features:')
  console.log('Total rows:', result.rows.length)
  console.log('\nFeatures:')

  for (const row of result.rows) {
    console.log(`  - ${row.id}`)
    console.log(`    Title: ${row.title}`)
    console.log(`    Source: ${row.source}`)
    console.log(`    Verified: ${row.verified}`)
    console.log(`    Sync State: ${row.sync_state}`)
    console.log('')
  }
}

checkDatabase()
```

运行：

```bash
cd backend
bun run check-db.ts
```

**预期输出**:
```
📊 Database Features:
Total rows: 8

Features:
  - database-agent-reporting-api
    Title: Database & Agent Reporting API
    Source: git
    Verified: 1
    Sync State: synced

  - multi-branch-kanban
    Title: Multi-Branch Kanban
    Source: git
    Verified: 1
    Sync State: synced
  ...
```

---

### 测试 4: 测试 Agent 验证流程

#### 4.1 创建测试 feature (模拟 Agent 报告)

创建 `backend/test-agent-flow.ts`:

```typescript
import { upsertFeature } from './src/services/database.js'
import { ValidationService } from './src/services/validation.js'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!
const REPO_OWNER = process.env.REPO_OWNER || 'your-username'
const REPO_NAME = process.env.REPO_NAME || 'supercrew-kanban'

async function testAgentFlow() {
  console.log('Testing agent verification flow...\n')

  // Step 1: 模拟 agent 报告一个已存在于 Git 的 feature
  const featureId = 'database-agent-reporting-api' // 使用一个真实存在的 feature

  console.log(`Step 1: Creating agent-reported feature: ${featureId}`)

  await upsertFeature({
    id: featureId,
    repo_owner: REPO_OWNER,
    repo_name: REPO_NAME,
    title: 'Test Agent Feature',
    status: 'doing',
    source: 'agent',
    verified: false,
    sync_state: 'pending_verify',
    created_at: Date.now(),
    updated_at: Date.now(),
  })

  console.log('✅ Agent feature created\n')

  // Step 2: 运行验证
  console.log('Step 2: Running validation...')

  const validator = new ValidationService()
  const result = await validator.validateFeature(
    REPO_OWNER,
    REPO_NAME,
    featureId,
    'main',
    GITHUB_TOKEN
  )

  console.log('✅ Validation result:', result)
  console.log('')

  // Step 3: 检查数据库状态
  console.log('Step 3: Checking database...')

  const { getFeature } = await import('./src/services/database.js')
  const feature = await getFeature(REPO_OWNER, REPO_NAME, featureId)

  console.log('Feature state:')
  console.log(`  - Source: ${feature?.source}`)
  console.log(`  - Verified: ${feature?.verified}`)
  console.log(`  - Sync State: ${feature?.sync_state}`)
  console.log('')

  if (feature?.source === 'agent_verified' && feature?.verified) {
    console.log('✅ Agent verification flow works correctly!')
  } else {
    console.log('❌ Unexpected state!')
  }
}

testAgentFlow()
```

运行：

```bash
cd backend
bun run test-agent-flow.ts
```

**预期输出**:
```
Testing agent verification flow...

Step 1: Creating agent-reported feature: database-agent-reporting-api
✅ Agent feature created

Step 2: Running validation...
✅ Validation result: { feature_id: 'database-agent-reporting-api', success: true, action: 'verified' }

Step 3: Checking database...
Feature state:
  - Source: agent_verified
  - Verified: true
  - Sync State: synced

✅ Agent verification flow works correctly!
```

---

### 测试 5: 测试孤儿检测

创建 `backend/test-orphan.ts`:

```typescript
import { upsertFeature } from './src/services/database.js'
import { dailyReconcile } from './src/workers/reconcile.js'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!
const REPO_OWNER = process.env.REPO_OWNER || 'your-username'
const REPO_NAME = process.env.REPO_NAME || 'supercrew-kanban'

async function testOrphanDetection() {
  console.log('Testing orphan detection...\n')

  // Step 1: 创建一个不存在于 Git 的 feature
  const orphanId = 'test-orphan-feature'

  console.log(`Step 1: Creating orphan feature: ${orphanId}`)

  await upsertFeature({
    id: orphanId,
    repo_owner: REPO_OWNER,
    repo_name: REPO_NAME,
    title: 'Orphan Test Feature',
    status: 'doing',
    source: 'agent',
    verified: false,
    sync_state: 'pending_verify',
    created_at: Date.now() - 20 * 60 * 1000, // 20 分钟前（超过 grace window）
    updated_at: Date.now() - 20 * 60 * 1000,
  })

  console.log('✅ Orphan feature created\n')

  // Step 2: 运行 reconcile
  console.log('Step 2: Running reconcile...')

  const stats = await dailyReconcile(REPO_OWNER, REPO_NAME, GITHUB_TOKEN)

  console.log('Reconcile stats:')
  console.log(`  - Orphaned: ${stats.orphaned}`)
  console.log('')

  // Step 3: 检查孤儿 feature 状态
  console.log('Step 3: Checking orphan feature...')

  const { getFeature } = await import('./src/services/database.js')
  const feature = await getFeature(REPO_OWNER, REPO_NAME, orphanId)

  console.log('Feature state:')
  console.log(`  - Source: ${feature?.source}`)
  console.log(`  - Verified: ${feature?.verified}`)
  console.log(`  - Sync State: ${feature?.sync_state}`)
  console.log(`  - Error: ${feature?.last_sync_error}`)
  console.log('')

  if (feature?.source === 'agent_orphaned' && feature?.sync_state === 'git_missing') {
    console.log('✅ Orphan detection works correctly!')
  } else {
    console.log('❌ Unexpected state!')
  }

  // Cleanup
  console.log('\nCleaning up test data...')
  await import('./src/services/database.js').then(({ db }) => {
    return db.execute({
      sql: 'DELETE FROM features WHERE id = ?',
      args: [orphanId],
    })
  })
  console.log('✅ Cleanup complete')
}

testOrphanDetection()
```

运行：

```bash
cd backend
bun run test-orphan.ts
```

---

## 验证清单

完成本地测试后，确认：

- [ ] `dailyReconcile()` 成功扫描 Git 分支
- [ ] Features 正确插入/更新到数据库
- [ ] 所有 Git features 标记为 `source='git'`, `verified=true`
- [ ] Agent 验证流程正常（`agent` → `agent_verified`）
- [ ] 孤儿检测正常（标记为 `agent_orphaned`）
- [ ] 错误处理正常（stats.errors 正确统计）

---

## 常见问题

### Q: TypeScript 报错找不到模块
**A**: 确保运行 `bun install` 并且 tsconfig.json 配置正确

### Q: Database connection error
**A**: 检查 `.env` 文件中的 `TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN`

### Q: GitHub API rate limit
**A**: 等待或使用不同的 GitHub token

### Q: Features 未被插入
**A**: 检查 console 日志中的错误信息，可能是数据库 schema 问题

---

## 下一步

本地测试通过后，继续：
1. 推送代码到 GitHub
2. Vercel 自动部署
3. 按照 `docs/testing-reconcile-vercel.md` 进行生产环境测试
