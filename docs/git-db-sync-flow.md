# Git-Database 同步流程图

## 1. 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Git Origin Repo                          │
│                    (Source of Truth - 正确性保证)                 │
│                                                                   │
│  user/alice/feature-1/.supercrew/tasks/feature-1/meta.yaml      │
│  user/bob/feature-2/.supercrew/tasks/feature-2/meta.yaml        │
│  main/.supercrew/tasks/feature-1/meta.yaml                       │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ GitHub API (OAuth Token)
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ 首次访问  │    │ 每日定时  │    │  验证队列  │
   │Auto-Sync│    │Daily Cron│    │Validation│
   └────┬────┘    └────┬────┘    └────┬────┘
        │              │              │
        └──────────────┼──────────────┘
                       ▼
        ┌──────────────────────────────┐
        │      Turso Database           │
        │   (Real-time Cache - 速度保证) │
        │                               │
        │ features table:               │
        │  - source: git | agent |      │
        │    agent_verified |           │
        │    agent_orphaned             │
        │  - verified: true | false     │
        │  - sync_state: synced |       │
        │    pending_verify | conflict  │
        └───────────────┬───────────────┘
                        │
                        │ HTTP API
                        │
                        ▼
        ┌──────────────────────────────┐
        │      Frontend Dashboard       │
        │                               │
        │  ✅ Git Verified              │
        │  ✅ Agent Verified (脉冲)      │
        │  ⏳ Pending Verify            │
        │  ⚠️ Conflict                  │
        │  ❌ Orphaned                  │
        └───────────────────────────────┘
                        ▲
                        │
                        │ Agent Report API
                        │
        ┌───────────────────────────────┐
        │   Local Coding Agent          │
        │   (supercrew skills)          │
        │                               │
        │ POST /api/features            │
        │   { status: "doing" }         │
        └───────────────────────────────┘
```

---

## 2. 数据同步时序图

### 场景 A: 首次访问 Dashboard（数据库为空）

```
用户浏览器          Frontend API         Backend API         GitHub API        Database
    │                   │                    │                   │                │
    │ GET /            │                    │                   │                │
    ├──────────────────>│                    │                   │                │
    │                   │ mode='database'    │                   │                │
    │                   │ GET /api/board     │                   │                │
    │                   ├───────────────────>│                   │                │
    │                   │                    │ SELECT * FROM     │                │
    │                   │                    │ features          │                │
    │                   │                    ├──────────────────>│                │
    │                   │                    │ (empty result)    │                │
    │                   │                    │<──────────────────┤                │
    │                   │                    │                   │                │
    │                   │                    │ 触发 Auto-Sync     │                │
    │                   │                    │ scanAndSyncFromGit()               │
    │                   │                    │                   │                │
    │                   │                    │ GET /repos/.../branches?pattern=user/*
    │                   │                    ├──────────────────>│                │
    │                   │                    │ [user/alice/f1,   │                │
    │                   │                    │  user/bob/f2, ...]│                │
    │                   │                    │<──────────────────┤                │
    │                   │                    │                   │                │
    │                   │                    │ 并行扫描所有分支     │                │
    │                   │                    │ GET .../meta.yaml │                │
    │                   │                    ├──────────────────>│                │
    │                   │                    │ (base64 content)  │                │
    │                   │                    │<──────────────────┤                │
    │                   │                    │                   │                │
    │                   │                    │ Decode base64 + Parse YAML         │
    │                   │                    │                   │                │
    │                   │                    │ INSERT INTO features               │
    │                   │                    │ (source='git',    │                │
    │                   │                    │  verified=true)   │                │
    │                   │                    ├──────────────────────────────────>│
    │                   │                    │ OK                │                │
    │                   │                    │<──────────────────────────────────┤
    │                   │                    │                   │                │
    │                   │                    │ SELECT * FROM features (再次查询)   │
    │                   │                    ├──────────────────────────────────>│
    │                   │                    │ 9 features        │                │
    │                   │                    │<──────────────────────────────────┤
    │                   │ { features: [...] }│                   │                │
    │                   │<───────────────────┤                   │                │
    │ Dashboard 显示    │                    │                   │                │
    │ 9 features        │                    │                   │                │
    │<──────────────────┤                    │                   │                │
```

---

### 场景 B: Local Agent 上报进度更新

```
Local Agent         Backend API          Database         Validation Queue      GitHub API
    │                   │                    │                   │                   │
    │ POST /api/features│                    │                   │                   │
    │ { id: "f1",       │                    │                   │                   │
    │   status: "doing" }│                   │                   │                   │
    ├──────────────────>│                    │                   │                   │
    │                   │ INSERT/UPDATE      │                   │                   │
    │                   │ features           │                   │                   │
    │                   │ (source='agent',   │                   │                   │
    │                   │  verified=false,   │                   │                   │
    │                   │  updated_at=NOW)   │                   │                   │
    │                   ├───────────────────>│                   │                   │
    │                   │ OK                 │                   │                   │
    │                   │<───────────────────┤                   │                   │
    │                   │                    │                   │                   │
    │                   │ INSERT INTO validation_queue           │                   │
    │                   │ (feature_id='f1')  │                   │                   │
    │                   ├───────────────────────────────────────>│                   │
    │ 200 OK            │                    │                   │                   │
    │<──────────────────┤                    │                   │                   │
    │                   │                    │                   │                   │
    │                   │        ⏱️ 1 分钟后 (后台 Cron 触发)      │                   │
    │                   │                    │                   │                   │
    │                   │                    │   processValidationQueue()          │
    │                   │                    │   ├──────────────>│                   │
    │                   │                    │   │ validateFeature('f1')            │
    │                   │                    │   │               │                   │
    │                   │                    │   │ GET .../f1/meta.yaml             │
    │                   │                    │   ├──────────────────────────────────>│
    │                   │                    │   │ (base64 content + etag + sha)    │
    │                   │                    │   │<──────────────────────────────────┤
    │                   │                    │   │               │                   │
    │                   │                    │   │ Compare content hash:            │
    │                   │                    │   │ gitHash vs dbHash                │
    │                   │                    │   │               │                   │
    │                   │                    │   │ ┌─────────────────────────────┐ │
    │                   │                    │   │ │ 情况 1: 内容相同              │ │
    │                   │                    │   │ │ → source: 'agent_verified'  │ │
    │                   │                    │   │ │ → verified: true            │ │
    │                   │                    │   │ │ ✅ Agent Verified           │ │
    │                   │                    │   │ └─────────────────────────────┘ │
    │                   │                    │   │               │                   │
    │                   │                    │   │ UPDATE features                  │
    │                   │                    │   │ SET source='agent_verified',     │
    │                   │                    │   │ verified=true                    │
    │                   │                    │<──┤               │                   │
    │                   │                    │   │               │                   │
    │                   │                    │   │ DELETE FROM validation_queue     │
    │                   │                    │   │ WHERE feature_id='f1'            │
    │                   │                    │<──┤               │                   │
```

---

### 场景 C: Agent 上报后，Git 也更新了（冲突处理）

```
时间轴                  Database                  Validation Service           GitHub
  │                       │                             │                         │
  │ T0: Agent 写入        │                             │                         │
  │ updated_at = 1000     │                             │                         │
  │ source = 'agent'      │                             │                         │
  │ verified = false      │                             │                         │
  ├──────────────────────>│                             │                         │
  │                       │                             │                         │
  │ T1: 2 分钟后           │                             │                         │
  │ 用户 git push         │                             │                         │
  │ (Git updated_at = 1200)                             │                         │
  │                       │                             ├────────────────────────>│
  │                       │                             │                         │
  │ T2: 3 分钟后           │                             │                         │
  │ Validation Cron       │                             │                         │
  │                       │                             │ validateFeature('f1')   │
  │                       │                             │ GET .../meta.yaml       │
  │                       │                             ├────────────────────────>│
  │                       │                             │ Git updated_at = 1200   │
  │                       │                             │<────────────────────────┤
  │                       │                             │                         │
  │                       │                             │ Compare:                │
  │                       │                             │ Git time (1200) >       │
  │                       │                             │ DB time (1000)          │
  │                       │                             │                         │
  │                       │                             │ ┌────────────────────┐  │
  │                       │                             │ │ 情况 2: Git 更新了   │  │
  │                       │                             │ │ → 用 Git 覆盖 DB    │  │
  │                       │                             │ │ → source: 'git'     │  │
  │                       │                             │ │ → verified: true    │  │
  │                       │                             │ │ ⚠️ Updated from Git │  │
  │                       │                             │ └────────────────────┘  │
  │                       │                             │                         │
  │                       │ UPDATE features             │                         │
  │                       │ SET source='git',           │                         │
  │                       │ verified=true,              │                         │
  │                       │ updated_at=1200,            │                         │
  │                       │ (用 Git 数据覆盖)            │                         │
  │                       │<────────────────────────────┤                         │
```

---

### 场景 D: Agent 写入后长时间未 push (冲突标记)

```
时间轴                  Database                  Validation Service
  │                       │                             │
  │ T0: Agent 写入        │                             │
  │ updated_at = 1000     │                             │
  │ source = 'agent'      │                             │
  ├──────────────────────>│                             │
  │                       │                             │
  │ T1: 2 分钟后验证       │                             │
  │                       │<────────────────────────────┤ validateFeature()
  │                       │                             │ Git 404 Not Found
  │                       │                             │ (feature 还没 push)
  │                       │                             │
  │                       │                             │ Age = 2 min < 10 min
  │                       │                             │ ┌────────────────────┐
  │                       │                             │ │ 宽限期内 - 重试     │
  │                       │                             │ │ sync_state:        │
  │                       │                             │ │ 'pending_verify'   │
  │                       │                             │ │ ⏳ Pending Verify  │
  │                       │                             │ └────────────────────┘
  │                       │ UPDATE sync_state=          │
  │                       │ 'pending_verify'            │
  │                       │<────────────────────────────┤
  │                       │ (保留在验证队列)              │
  │                       │                             │
  │ ... 时间流逝 ...       │                             │
  │                       │                             │
  │ T2: 12 分钟后再次验证  │                             │
  │                       │<────────────────────────────┤ validateFeature()
  │                       │                             │ Git 404 Not Found
  │                       │                             │
  │                       │                             │ Age = 12 min > 10 min
  │                       │                             │ ┌────────────────────┐
  │                       │                             │ │ 超过宽限期 - 标记   │
  │                       │                             │ │ source:            │
  │                       │                             │ │ 'agent_orphaned'   │
  │                       │                             │ │ sync_state:        │
  │                       │                             │ │ 'git_missing'      │
  │                       │                             │ │ ❌ Orphaned        │
  │                       │                             │ └────────────────────┘
  │                       │ UPDATE source=              │
  │                       │ 'agent_orphaned',           │
  │                       │ sync_state='git_missing'    │
  │                       │<────────────────────────────┤
```

---

## 3. 状态转换图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Feature 状态生命周期                       │
└─────────────────────────────────────────────────────────────────┘

   Git Commit                     Agent 上报                   验证结果
       │                              │                            │
       ▼                              ▼                            ▼

┌───────────┐                  ┌───────────┐               ┌────────────────┐
│   Git     │                  │   Agent   │               │ Agent Verified │
│           │                  │           │               │                │
│ source:   │                  │ source:   │   内容相同     │ source:        │
│  'git'    │                  │  'agent'  ├──────────────>│ 'agent_verified│
│ verified: │                  │ verified: │               │ verified: true │
│  true     │                  │  false    │               │ sync_state:    │
│           │                  │           │               │  'synced'      │
│ ✅ Git    │                  │ ⏳ Pending│               │ ✅ Agent       │
│ Verified  │                  │  Verify   │               │ Verified       │
└─────┬─────┘                  └─────┬─────┘               └────────────────┘
      │                              │
      │                              │ Git 更新了
      │                              │ (Git time > DB time)
      │                              │
      │<─────────────────────────────┤
      │      用 Git 覆盖 Database      │
      │                              │
      │                              │ Agent 写了但超过 10 分钟未 push
      │                              │
      │                              ▼
      │                        ┌────────────┐
      │                        │  Orphaned  │
      │                        │            │
      │                        │ source:    │
      │                        │ 'agent_    │
      │                        │  orphaned' │
      │                        │ verified:  │
      │                        │  false     │
      │                        │ sync_state:│
      │                        │ 'git_      │
      │                        │  missing'  │
      │                        │            │
      │                        │ ❌ Orphaned│
      │                        └────────────┘
```

---

## 4. 冲突解决决策树

```
Agent 上报 → 触发验证队列
    │
    ▼
从 Git 获取最新内容
    │
    ├─────────────────────────────────────────────────────┐
    │                                                       │
    ▼                                                       ▼
Git 404 Not Found                                    Git 200 OK
    │                                                       │
    ▼                                                       ▼
计算 Age = Now - DB.created_at                      计算 Content Hash
    │                                                       │
    ├──────────────────┬─────────────────                  ├──────────────────┬─────────────────
    │                  │                                    │                  │
    ▼                  ▼                                    ▼                  ▼
Age < 10 min      Age >= 10 min                  gitHash == dbHash    gitHash != dbHash
    │                  │                                    │                  │
    ▼                  ▼                                    ▼                  ▼
保持 'pending_     标记为                              升级为              比较时间戳
verify'           'agent_orphaned'                   'agent_verified'        │
重试验证          sync_state:                         verified: true         │
                  'git_missing'                       ✅ Agent Verified      │
⏳ Pending Verify  ❌ Orphaned                                               ├──────────────┬─────────────
                                                                             │              │
                                                                             ▼              ▼
                                                                      gitTime > dbTime  dbTime > gitTime
                                                                             │              │
                                                                             ▼              ▼
                                                                      用 Git 覆盖     检查宽限期
                                                                      source: 'git'        │
                                                                      ⚠️ Updated          │
                                                                      from Git            ├──────────┬──────────
                                                                                          │          │
                                                                                          ▼          ▼
                                                                                    Age < 10 min  Age >= 10 min
                                                                                          │          │
                                                                                          ▼          ▼
                                                                                    等待 push    标记冲突
                                                                                    继续重试     sync_state:
                                                                                                'conflict'
                                                                                                ❌ Conflict
```

---

## 5. 前端显示状态映射

```
Database State                        Frontend Display
─────────────────────────────────────────────────────────────
source: 'git'                   →     ✅ Git Verified
verified: true                        绿色徽章

source: 'agent_verified'        →     ✅ Agent Verified
verified: true                        绿色徽章 + 脉冲动画
sync_state: 'synced'

source: 'agent'                 →     ⏳ Pending Verify
verified: false                       灰色徽章
sync_state: 'pending_verify'

source: 'agent'                 →     ⚠️ Stale (validating...)
verified: false                       黄色徽章
sync_state: 'error'

source: 'agent_orphaned'        →     ❌ Orphaned (not in Git)
verified: false                       红色徽章
sync_state: 'git_missing'

source: 'agent'                 →     ⚠️ Conflict: DB > Git
verified: false                       红色徽章
sync_state: 'conflict'
```

---

## 6. 时间线总结

```
时刻                事件                              数据库状态
─────────────────────────────────────────────────────────────────
Day 0
09:00    用户首次访问 Dashboard                   空数据库
         → 触发 Auto-Sync                         → 扫描 Git
         → 写入 9 features                        source: 'git'
                                                  verified: true

10:00    Local Agent 上报 "feature-1: doing"     source: 'agent'
         → 写入数据库                             verified: false
         → 加入验证队列                           sync_state: 'pending_verify'

10:01    验证队列处理 (1 分钟后)                  内容相同
         → Git 验证成功                           source: 'agent_verified'
                                                  verified: true

14:00    Agent 上报 "feature-2: doing"           source: 'agent'
         同时用户在本地修改 meta.yaml             verified: false
         但还没 git push

14:01    验证队列处理                             Git 404
         → 2 分钟 < 10 分钟宽限期                 sync_state: 'pending_verify'
         → 继续重试                               (保持重试)

14:25    验证队列再次处理                         Git 404
         → 25 分钟 > 10 分钟宽限期                source: 'agent_orphaned'
         → 标记为 Orphaned                        verified: false
                                                  sync_state: 'git_missing'

Day 1
03:00    Vercel Cron 每日定时同步                 全量扫描 Git
(UTC)    → Daily Reconcile                       → 覆盖所有 features
         → 扫描所有 user/* 分支                   source: 'git'
         → 更新数据库                             verified: true
```

---

这样清楚多了吗？有任何疑问都可以问我！
