# Local Dev Branch Validation Logic - Design Document

**Date**: 2026-03-08
**Author**: Claude Code + qunmi
**Status**: Approved

---

## Problem Statement

### Current Issue

当前的验证逻辑存在一个严重的产品问题：

**场景**：
```
1. 用户在 local dev branch 工作：user/qunmi/featureA
2. 修改 .supercrew/tasks/featureA/meta.yaml: status = doing
3. Agent 上报到数据库（verified = false）
4. Validation worker 尝试验证
5. GET /repos/.../meta.yaml?ref=user/qunmi/featureA → 404 (branch 未 push)
6. 10 分钟后 → 标记为 'agent_orphaned' ❌
```

**问题**：
- ❌ 用户正在开发的 feature 被错误标记为 "已删除"
- ❌ 前端显示红色 ❌ 徽章（误导用户）
- ❌ 浪费 GitHub API quota（验证注定失败的 local branch）
- ❌ 不支持常见的开发工作流（local dev 很久才 push）

### Root Cause

验证逻辑**假设所有 branch 都已 push 到 remote**，但实际上：
- 开发者经常在 local branch 工作很长时间（数小时甚至数天）
- Git 404 可能是 "branch 未 push" 而不是 "feature 被删除"
- 当前逻辑无法区分这两种情况

---

## Design Goals

1. ✅ **零误判**：不会将 local dev 误标记为 orphaned
2. ✅ **API 效率**：local-only feature 跳过 GitHub API 验证
3. ✅ **精确验证**：使用 commit SHA + timestamp 双重验证
4. ✅ **用户体验**：清晰的视觉状态指示（5 种状态）
5. ✅ **协作友好**：支持多人同时在不同 branch 开发
6. ✅ **向后兼容**：旧版本 Agent 不提供 git_metadata 时回退到原逻辑

---

## Solution Overview

### 核心思想

**Agent 提供完整的 local Git 信息，Backend 根据 `has_upstream` 智能决策是否需要调用 GitHub API 验证。**

### 关键改动

1. **Agent 上报 API** - 新增 `git_metadata` 字段携带 local Git 信息
2. **验证逻辑** - 双层决策树（local-only vs remote-sync）
3. **状态枚举** - 新增 3 个状态：`local_only`, `pending_push`, `synced`
4. **前端展示** - 5 种视觉状态：✅ Verified, ⚡ Real-time, ⏳ Pending Push, ⚠️  Conflict, ❌ Orphaned

---

## Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────┐
│ Local Agent (Claude Code)                                    │
│                                                               │
│  1. git log -1 --format=%H -- .supercrew/tasks/featureA/... │
│     → last_commit_sha: "abc123..."                          │
│                                                               │
│  2. git log -1 --format=%ct -- .supercrew/tasks/featureA/...│
│     → last_commit_timestamp: 1709888400                     │
│                                                               │
│  3. git rev-parse --abbrev-ref @{upstream} 2>/dev/null      │
│     → has_upstream: false (未 push)                         │
│                                                               │
│  4. git ls-remote --heads origin user/qunmi/featureA        │
│     → branch_exists_on_remote: false                        │
│                                                               │
│  5. git rev-list @{u}..HEAD --count 2>/dev/null             │
│     → commits_ahead: 5                                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ POST /api/features/report
                 │ Body: { feature_id, branch, data, git_metadata }
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend Validation Logic                                    │
│                                                               │
│  Decision Tree:                                              │
│                                                               │
│  if (git_metadata.has_upstream === false) {                 │
│    // Local dev, 不调用 GitHub API                          │
│    return { sync_state: 'local_only', verified: false }     │
│  }                                                           │
│                                                               │
│  // Branch 已 push，需要验证                                 │
│  const gitData = await fetchFromGit(branch)                 │
│                                                               │
│  if (gitData.kind === 'not_found') {                        │
│    // Fallback to main branch                               │
│    const mainData = await fetchFromGit('main')              │
│    return compareTimestamps(agent, main)                    │
│  }                                                           │
│                                                               │
│  // 对比 commit SHA + timestamp                             │
│  return resolveConflict(agent, git)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### 1. Agent 上报请求（新增字段）

```typescript
// backend/src/types/api.ts

export interface GitMetadata {
  // 必需：最后修改 meta.yaml 的 commit SHA
  last_commit_sha: string

  // 必需：commit 时间戳（Unix 秒）
  last_commit_timestamp: number

  // 必需：branch 是否有 remote tracking
  has_upstream: boolean

  // 必需：remote 是否存在这个 branch
  branch_exists_on_remote: boolean

  // 可选：领先 remote 多少个 commit（未 push 时为 null）
  commits_ahead?: number | null
}

export interface FeatureReportRequest {
  repo_owner: string
  repo_name: string
  feature_id: string
  branch?: string
  data: FeatureData

  // 新增：Git metadata
  git_metadata?: GitMetadata  // 可选，兼容旧版本 Agent
}
```

### 2. 数据库字段（features 表新增）

```sql
-- Migration: Add git commit tracking fields

ALTER TABLE features ADD COLUMN IF NOT EXISTS
  git_commit_sha TEXT;              -- Agent 或 Git 的 commit SHA

ALTER TABLE features ADD COLUMN IF NOT EXISTS
  git_commit_timestamp INTEGER;     -- Commit 时间戳（Unix 秒）

-- Update sync_state enum to include new states
ALTER TABLE features DROP CONSTRAINT IF EXISTS features_sync_state_check;

ALTER TABLE features ADD CONSTRAINT features_sync_state_check
  CHECK (sync_state IN (
    'local_only',      -- Local dev，未 push
    'pending_push',    -- 有新 commit 未 push
    'pending_verify',  -- 等待验证
    'synced',          -- 已同步且验证通过
    'conflict',        -- 冲突（时间戳太接近）
    'error',           -- 验证失败
    'git_missing'      -- Git 中不存在（真正的 orphaned）
  ));
```

### 3. 验证结果枚举

```typescript
export type ValidationAction =
  | 'verified'           // ✅ SHA 相同，验证通过
  | 'updated_from_git'   // ✅ Git 更新，已覆盖
  | 'kept_agent_data'    // ⚡ Agent 更新，保留 Agent 数据
  | 'skip_validation'    // ⚡ Local only，跳过验证
  | 'orphaned'           // ❌ Git 中已删除
  | 'retry'              // ⏳ 临时失败，稍后重试
  | 'failed'             // ❌ 验证失败

export type SyncState =
  | 'local_only'         // 本地开发，未 push
  | 'pending_push'       // 有新 commit 未 push
  | 'pending_verify'     // 等待验证
  | 'synced'             // 已同步
  | 'conflict'           // 冲突
  | 'error'              // 错误
  | 'git_missing'        // Git 中不存在
```

### 4. 前端展示状态映射

```typescript
// frontend/packages/app-core/src/types.ts

export type FreshnessIndicator =
  | 'verified'      // ✅ 绿色 - Git 已验证
  | 'realtime'      // ⚡ 黄色脉冲 - Agent 实时数据
  | 'pending'       // ⏳ 橙色 - 等待 push/验证
  | 'conflict'      // ⚠️  黄色警告 - 需要处理
  | 'stale'         // 🕐 灰色 - 数据陈旧
  | 'orphaned'      // ❌ 红色 - Git 已删除

// 状态映射规则
function getFreshnessIndicator(feature: FeatureMeta): FreshnessIndicator {
  if (feature.sync_state === 'synced' && feature.verified) {
    return 'verified'    // ✅
  }

  if (feature.sync_state === 'local_only') {
    return 'realtime'    // ⚡ Local dev
  }

  if (feature.sync_state === 'pending_push') {
    return 'pending'     // ⏳ Pending push
  }

  if (feature.sync_state === 'conflict') {
    return 'conflict'    // ⚠️  Conflict
  }

  if (feature.sync_state === 'git_missing') {
    return 'orphaned'    // ❌ Deleted from Git
  }

  // 未验证但不算陈旧
  if (!feature.verified && Date.now() - feature.updated_at < 5 * 60 * 1000) {
    return 'realtime'    // ⚡ Recently updated
  }

  return 'stale'         // 🕐 Too old
}
```

---

## Validation Logic

### 验证决策树（完整版）

```typescript
async validateFeature(
  repoOwner: string,
  repoName: string,
  featureId: string,
  branch: string,
  githubToken: string,
  agentMetadata?: GitMetadata
): Promise<ValidationResult> {

  // ══════════════════════════════════════════════════════════
  // 阶段 1: 检查是否为 Local-Only（快速路径）
  // ══════════════════════════════════════════════════════════

  if (agentMetadata?.has_upstream === false) {
    // Agent 明确告知：branch 未 push 到 remote
    // → 直接信任 Agent，跳过 GitHub API 验证

    await upsertFeature({
      ...dbData,
      source: 'agent',
      verified: false,
      sync_state: 'local_only',
      git_commit_sha: agentMetadata.last_commit_sha,
      git_commit_timestamp: agentMetadata.last_commit_timestamp,
      last_git_checked_at: Date.now(),
      last_sync_error: null,
    })

    return {
      feature_id: featureId,
      success: true,
      action: 'skip_validation',
      message: 'Local dev branch, not pushed to remote',
    }
  }

  // ══════════════════════════════════════════════════════════
  // 阶段 2: 从 GitHub 获取数据
  // ══════════════════════════════════════════════════════════

  const gitResult = await fetchFeatureFromGit(
    repoOwner,
    repoName,
    featureId,
    branch,
    githubToken
  )

  const dbData = await getFeature(repoOwner, repoName, featureId)

  // ══════════════════════════════════════════════════════════
  // 阶段 3: 处理 GitHub 404（Branch 不存在）
  // ══════════════════════════════════════════════════════════

  if (gitResult.kind === 'not_found') {
    // 3.1 检查 Agent 是否告知 commits_ahead > 0
    if (agentMetadata?.commits_ahead && agentMetadata.commits_ahead > 0) {
      // Agent 本地有新 commit 但还没 push
      await upsertFeature({
        ...dbData,
        source: 'agent',
        verified: false,
        sync_state: 'pending_push',
        git_commit_sha: agentMetadata.last_commit_sha,
        git_commit_timestamp: agentMetadata.last_commit_timestamp,
        last_sync_error: `Branch not found, ${agentMetadata.commits_ahead} commits ahead`,
      })

      return {
        feature_id: featureId,
        success: true,
        action: 'kept_agent_data',
      }
    }

    // 3.2 Fallback: 从 main branch 验证
    const mainResult = await fetchFeatureFromGit(
      repoOwner, repoName, featureId, 'main', githubToken
    )

    if (mainResult.kind === 'not_found') {
      // main 上也没有 → 真正的 orphaned
      return await this.handleGitNotFoundFeature(dbData)
    }

    if (mainResult.kind === 'snapshot') {
      // main 上有数据 → 对比 Agent vs main
      return await this.compareAgentVsGit(
        agentMetadata, mainResult.data, dbData, 'main'
      )
    }
  }

  // ══════════════════════════════════════════════════════════
  // 阶段 4: Branch 存在，对比 Commit SHA
  // ══════════════════════════════════════════════════════════

  if (gitResult.kind === 'snapshot') {
    const gitData = gitResult.data

    // 4.1 从 Git 数据中提取 commit SHA（调用 Commits API）
    const gitCommitInfo = await this.fetchCommitInfo(
      repoOwner, repoName, featureId, branch, githubToken
    )

    // 4.2 对比 SHA
    if (agentMetadata?.last_commit_sha === gitCommitInfo.sha) {
      // ✅ SHA 相同 → 内容一致，验证通过
      await upsertFeature({
        ...dbData,
        source: 'agent_verified',
        verified: true,
        sync_state: 'synced',
        git_commit_sha: gitCommitInfo.sha,
        git_commit_timestamp: gitCommitInfo.timestamp,
        last_git_checked_at: Date.now(),
        verified_at: Date.now(),
      })

      return { feature_id: featureId, success: true, action: 'verified' }
    }

    // 4.3 SHA 不同 → 对比 timestamp 决定谁赢
    return await this.resolveTimestampConflict(
      agentMetadata, gitCommitInfo, gitData, dbData
    )
  }

  return { feature_id: featureId, success: false, action: 'failed' }
}
```

### 关键辅助函数

#### 1. 获取 Git Commit 信息

```typescript
async fetchCommitInfo(
  owner: string,
  repo: string,
  featureId: string,
  branch: string,
  token: string
): Promise<{ sha: string; timestamp: number }> {
  // GET /repos/{owner}/{repo}/commits?path=...&sha={branch}&per_page=1
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?` +
    `path=.supercrew/tasks/${featureId}/meta.yaml&sha=${branch}&per_page=1`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch commit info: ${res.status}`)
  }

  const commits = await res.json()
  const commit = commits[0]

  return {
    sha: commit.sha,
    timestamp: new Date(commit.commit.author.date).getTime() / 1000
  }
}
```

#### 2. Timestamp 冲突解决

```typescript
async resolveTimestampConflict(
  agentMetadata: GitMetadata | undefined,
  gitCommitInfo: { sha: string; timestamp: number },
  gitData: GitFileSnapshot,
  dbData: FeatureData
): Promise<ValidationResult> {

  if (!agentMetadata) {
    // 没有 Agent metadata → Git 赢
    return await this.updateFromGit(gitData, gitCommitInfo, ...)
  }

  const timeDiff = agentMetadata.last_commit_timestamp - gitCommitInfo.timestamp

  // Agent 更新（Agent commit 时间更晚）
  if (timeDiff > 0) {
    await upsertFeature({
      ...dbData,
      source: 'agent',
      verified: false,
      sync_state: 'pending_push',
      git_commit_sha: agentMetadata.last_commit_sha,
      git_commit_timestamp: agentMetadata.last_commit_timestamp,
    })

    return { action: 'kept_agent_data' }
  }

  // Git 更新（Git commit 时间更晚）
  return await this.updateFromGit(gitData, gitCommitInfo, ...)
}
```

---

## State Machine

### 状态转换图

```
Agent 上报
    │
    ▼
┌──────────────┐
│ pending_     │  ← 初始状态（写入 DB 后）
│ verify       │
└──────┬───────┘
       │
       │ Validation Worker 处理
       │
       ├─────────────────────────────────────────────┐
       │                                             │
       │ has_upstream = false                        │ has_upstream = true
       ▼                                             ▼
┌──────────────┐                              ┌──────────────┐
│ local_only   │                              │   验证中...   │
│              │                              └──────┬───────┘
│ ⚡ Realtime  │                                     │
└──────────────┘                                     │
       ▲                                             ├─── SHA match ───┐
       │                                             │                 │
       │ 用户删除 upstream                            │                 ▼
       │                                             │          ┌──────────────┐
┌──────────────┐                                     │          │   synced     │
│ pending_push │ ◄────── SHA 不同 + Agent 更新 ─────┤          │ ✅ Verified  │
│ ⏳ Pending   │                                     │          └──────────────┘
└──────┬───────┘                                     │
       │                                             │
       │ 用户 push 到 remote                          │
       └──────────────┐                              │
                      ▼                              │
               再次验证 ──────────────────────────────┤
                                                     │
              ┌──── SHA 不同 + Git 更新 ──────────────┤
              │                                      │
              ▼                                      │
       ┌──────────────┐                             │
       │   synced     │ ◄───────────────────────────┘
       │ (Git 覆盖)   │
       │ ✅ Updated   │
       └──────────────┘

       Git 删除文件 / Branch 404 且无 commits_ahead
       │
       ▼
┌──────────────┐
│ git_missing  │
│ ❌ Orphaned  │
└──────────────┘
```

---

## Error Handling

### GitHub API 错误分类

```typescript
enum GitHubErrorType {
  RATE_LIMIT = 'rate_limit',           // 429 Too Many Requests
  AUTH_ERROR = 'auth_error',           // 401/403 Unauthorized
  NOT_FOUND = 'not_found',             // 404 Not Found
  NETWORK_ERROR = 'network_error',     // 网络故障
  TIMEOUT = 'timeout',                 // 请求超时
  UNKNOWN = 'unknown',                 // 其他错误
}
```

### 错误处理策略

```typescript
function handleValidationError(
  error: Error,
  attempts: number
): { action: 'retry' | 'fail'; retryAfter?: number } {

  const errorType = classifyGitHubError(error)

  switch (errorType) {
    case GitHubErrorType.RATE_LIMIT:
      return { action: 'retry', retryAfter: getRateLimitResetTime() }

    case GitHubErrorType.AUTH_ERROR:
      return { action: 'fail' }  // 不重试

    case GitHubErrorType.NOT_FOUND:
      return { action: 'retry', retryAfter: 0 }

    case GitHubErrorType.NETWORK_ERROR:
    case GitHubErrorType.TIMEOUT:
      const backoff = Math.min(2 ** attempts * 1000, 60000)
      return { action: 'retry', retryAfter: backoff }

    case GitHubErrorType.UNKNOWN:
      if (attempts >= 3) return { action: 'fail' }
      return { action: 'retry', retryAfter: 5000 }
  }
}
```

### 边界情况处理

```typescript
// 1. Agent 没有提供 git_metadata（旧版本 Agent）
if (!agentMetadata) {
  return await this.validateWithoutAgentMetadata(...)
}

// 2. commits_ahead 为 0 但 has_upstream = true
if (agentMetadata.has_upstream && agentMetadata.commits_ahead === 0) {
  // Agent 认为已同步 → 验证应该返回 SHA 相同
}

// 3. branch_exists_on_remote = false 但 has_upstream = true
if (agentMetadata.has_upstream && !agentMetadata.branch_exists_on_remote) {
  // Agent 配置了 upstream 但 remote branch 被删除
  // → 标记为 pending_push
}

// 4. Git commit timestamp 为 0 或 null
if (!gitCommitInfo.timestamp) {
  console.warn('[Validation] Invalid git timestamp, comparing SHA only')
}

// 5. 多人协作冲突检测
const timeDiff = Math.abs(agentTimestamp - gitTimestamp)
if (timeDiff < 60 && agentCommitSHA !== gitCommitSHA) {
  // 两个 commit 时间相差 < 60s 但 SHA 不同
  // → 可能是多人同时提交
  return { sync_state: 'pending_push', warning: 'Concurrent modification' }
}
```

---

## Frontend Integration

### 智能轮询策略

```typescript
export function useBoard({ mode = 'database' }: UseBoardOptions) {
  const pollInterval = useMemo(() => {
    if (!metadata) return 30000

    const { unverified_count, pending_push_count, local_only_count } = metadata

    // 有未验证或等待 push 的 → 快速轮询
    if (unverified_count > 0 || pending_push_count > 0) {
      return 30000  // 30 秒
    }

    // 有 local-only 的 → 中速轮询
    if (local_only_count > 0) {
      return 60000  // 1 分钟
    }

    // 全部验证通过 → 慢速轮询
    return 5 * 60000  // 5 分钟
  }, [metadata])

  const { data, refetch } = useQuery({
    queryKey: ['board', mode],
    queryFn: () => fetchBoardFromDb(),
    refetchInterval: pollInterval,
  })

  return { board, metadata, refetch, isPollingFast: pollInterval === 30000 }
}
```

### 视觉指示器

```typescript
export function VerificationBadge({ feature }: { feature: FeatureMeta }) {
  const indicator = getFreshnessIndicator(feature)

  const config = {
    verified: {
      icon: '✅',
      label: 'Verified',
      color: 'green',
      title: 'Verified with Git',
    },
    realtime: {
      icon: '⚡',
      label: feature.sync_state === 'local_only' ? 'Local Dev' : 'Real-time',
      color: 'yellow',
      title: feature.sync_state === 'local_only'
        ? 'Local development (not pushed)'
        : 'Real-time agent data (unverified)',
      pulse: true,
    },
    pending: {
      icon: '⏳',
      label: 'Pending Push',
      color: 'orange',
      title: `${feature.git_metadata?.commits_ahead || 0} commits ahead`,
    },
    orphaned: {
      icon: '❌',
      label: 'Deleted',
      color: 'red',
      title: 'Feature deleted from Git',
    },
  }[indicator]

  return (
    <span
      className={`badge badge-${config.color} ${config.pulse ? 'pulse' : ''}`}
      title={config.title}
    >
      {config.icon} {config.label}
    </span>
  )
}
```

---

## Performance Impact

### API 效率提升

**场景**：10 个 feature，5 个 local-only，5 个已 push

- **旧逻辑**：10 次 GitHub API 调用（每个 feature 都验证）
- **新逻辑**：5 次 GitHub API 调用（只验证已 push 的）
- **节省**：50% API quota

### 验证队列优化

**优先级排序**：
- Priority 3: `has_upstream=false` → 跳过验证
- Priority 2: `pending_push` → 30s 后验证
- Priority 1: `pending_verify` → 立即验证

### 前端轮询优化

**场景**：全部 verified

- **旧逻辑**：30s 轮询
- **新逻辑**：5min 轮询
- **节省**：90% 轮询请求

---

## User Scenarios

### 场景 1: Local Dev 工作流

```
1. 用户创建 feature，修改 meta.yaml: status = doing
2. Agent 上报 → 立即显示 ⚡ Local Dev (0.5s)
3. 用户继续开发，多次修改 → 每次都显示 ⚡ Local Dev
4. 用户 push → 30s 内验证完成 → 显示 ✅ Verified
```

### 场景 2: 协作冲突

```
1. 用户 A 在 local 修改 status = doing
2. 用户 B 在 GitHub web 修改 status = ready-to-ship
3. Agent 上报用户 A 的数据 → ⏳ Pending Push (+1 commit)
4. 验证发现 Git 更新 → 用 Git 覆盖 → ✅ Verified (status = ready-to-ship)
5. 用户 A 看到状态被改了，意识到有冲突
```

### 场景 3: 长时间 Local Dev

```
1. 用户在 local branch 工作一整天（不 push）
2. 所有修改都显示 ⚡ Local Dev
3. 不触发验证（节省 API quota）
4. 用户随时可以 push → 自动验证
```

### 场景 4: Feature 被删除

```
1. 用户 A 在 local 开发 featureX
2. 用户 B 在 GitHub 删除了 featureX
3. Agent 上报 → 验证发现 Git 404
4. Fallback 到 main → 也是 404
5. 标记为 ❌ Deleted from Git
6. 用户 A 看到红色徽章，知道 feature 已被删除
```

---

## Implementation Checklist

### Phase 1: Backend Changes

- [ ] Add `GitMetadata` interface to `backend/src/types/api.ts`
- [ ] Add database migration for `git_commit_sha`, `git_commit_timestamp` fields
- [ ] Update `sync_state` enum to include new states
- [ ] Implement `fetchCommitInfo()` function
- [ ] Implement `resolveTimestampConflict()` function
- [ ] Update `validateFeature()` with new decision tree
- [ ] Add backward compatibility for old Agent versions
- [ ] Write unit tests for validation logic

### Phase 2: Agent Changes

- [ ] Add Git metadata collection to Agent reporting
- [ ] Implement `last_commit_sha` extraction
- [ ] Implement `last_commit_timestamp` extraction
- [ ] Implement `has_upstream` check
- [ ] Implement `branch_exists_on_remote` check
- [ ] Implement `commits_ahead` calculation
- [ ] Update `POST /api/features/report` to include `git_metadata`

### Phase 3: Frontend Changes

- [ ] Add `FreshnessIndicator` type to frontend types
- [ ] Implement `getFreshnessIndicator()` function
- [ ] Update `VerificationBadge` component with new states
- [ ] Update `BoardMetadataBanner` to show new metrics
- [ ] Implement smart polling strategy in `useBoard` hook
- [ ] Add CSS styles for new badge states
- [ ] Update E2E tests

### Phase 4: Testing & Validation

- [ ] Test local-only workflow (no push)
- [ ] Test pending-push workflow (commits ahead)
- [ ] Test Git-wins scenario (remote updated)
- [ ] Test Agent-wins scenario (local updated)
- [ ] Test orphaned scenario (Git deleted)
- [ ] Test backward compatibility (old Agent)
- [ ] Load test with 100+ features (50% local-only)

---

## Success Metrics

**验证成功后，应该看到**：

1. ✅ **零误判率**：local dev 不会被标记为 orphaned
2. ✅ **API 减少 50%**：local-only feature 跳过验证
3. ✅ **轮询减少 90%**：全部 verified 时 5min 轮询
4. ✅ **用户满意度**：5 种清晰的视觉状态
5. ✅ **协作流畅**：多人开发无冲突

---

## Future Enhancements

### Phase 2: Conflict Resolution UI

当检测到 `conflict` 状态时，提供 UI 让用户选择：
- 保留 Agent 数据（覆盖 Git）
- 保留 Git 数据（放弃 local 修改）
- 手动合并

### Phase 3: Real-time WebSocket Sync

当 Agent push 到 remote 后，立即触发验证（不等待 cron）：
- WebSocket 连接 Agent ↔ Backend
- Agent push 后发送事件 → 立即验证
- 验证完成后推送结果到前端 → 无需轮询

---

## Appendix

### Agent Git Commands Reference

```bash
# 1. Get last commit SHA
git log -1 --format=%H -- .supercrew/tasks/{feature_id}/meta.yaml

# 2. Get last commit timestamp (Unix seconds)
git log -1 --format=%ct -- .supercrew/tasks/{feature_id}/meta.yaml

# 3. Check if branch has upstream
git rev-parse --abbrev-ref @{upstream} 2>/dev/null
# Returns: origin/user/qunmi/featureA (has upstream)
# Returns: (empty) (no upstream)

# 4. Check if branch exists on remote
git ls-remote --heads origin user/qunmi/featureA
# Returns: commit_sha refs/heads/user/qunmi/featureA (exists)
# Returns: (empty) (not exists)

# 5. Count commits ahead of upstream
git rev-list @{u}..HEAD --count 2>/dev/null
# Returns: 0 (synced)
# Returns: 5 (5 commits ahead)
```

### Database Schema Reference

```sql
CREATE TABLE features (
  id TEXT PRIMARY KEY,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,

  -- Feature metadata
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  owner TEXT,
  priority TEXT,
  progress INTEGER DEFAULT 0,

  -- File contents
  meta_yaml TEXT,
  dev_design_md TEXT,
  dev_plan_md TEXT,
  prd_md TEXT,

  -- Sync metadata
  source TEXT CHECK (source IN ('git', 'agent', 'agent_verified', 'agent_orphaned')),
  verified BOOLEAN DEFAULT false,
  sync_state TEXT CHECK (sync_state IN (
    'local_only', 'pending_push', 'pending_verify',
    'synced', 'conflict', 'error', 'git_missing'
  )),

  -- Git tracking (NEW)
  git_commit_sha TEXT,
  git_commit_timestamp INTEGER,

  -- GitHub API metadata
  git_sha TEXT,
  git_etag TEXT,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_db_write_at INTEGER,
  last_git_checked_at INTEGER,
  verified_at INTEGER,
  last_sync_error TEXT
);
```

---

**End of Design Document**
