---
status: draft
reviewers: []
---

# Local Dev Mode with Git Support

## Background

当前开发遇到 GitHub API rate limit 限制（5000 requests/hour），导致：

1. **开发受阻**：扫描所有分支后，API 调用次数暴增（20 branches × ~10 calls = 200+ calls per refresh）
2. **频繁等待**：触发 rate limit 后需要等待 1 小时才能继续开发
3. **效率低下**：每次测试都消耗 API quota，无法快速迭代
4. **无法离线**：必须联网且有 API quota 才能开发

**实际影响**：
- 2026-03-09 上午触发 rate limit，需要等到下午 4 点才能恢复
- 无法测试多分支功能
- 无法验证 branch scanner 逻辑
- 严重影响开发效率

## Requirements

### 核心需求

**支持本地 Git 模式**：
- 后端检测到 `?mode=local-git` 参数时，使用本地 git 仓库替代 GitHub API
- 使用 `simple-git` 或 Node.js `fs` + `child_process` 读取本地 repo
- 完全模拟 GitHub API 的行为和数据格式

**支持的操作**：
1. ✅ 列出所有分支（`git branch -a`）
2. ✅ 读取分支上的文件（`git show branch:path/to/file`）
3. ✅ 获取 `.supercrew/tasks/` 目录列表
4. ✅ 读取 `meta.yaml`, `dev-design.md`, `dev-plan.md` 文件内容

### 技术实现

**后端路由改动**（`backend/src/routes/board.ts`）：

```typescript
const mode = c.req.query('mode') || 'github'; // 'github' | 'local-git'
const repoPath = c.req.query('repo_path') || process.cwd();

if (mode === 'local-git') {
  const localScanner = new LocalGitScanner(repoPath);
  const branches = await localScanner.discoverBranches();
  const snapshots = await localScanner.fetchAllFeatures(branches);
  // ... 后续逻辑相同
} else {
  // 现有的 GitHub API 逻辑
  const scanner = new BranchScanner(token, owner, repo);
  // ...
}
```

**新建 `LocalGitScanner` 类**（`backend/src/services/local-git-scanner.ts`）：

```typescript
import simpleGit from 'simple-git';

export class LocalGitScanner {
  private git: SimpleGit;

  constructor(private repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  async discoverBranches(): Promise<string[]> {
    const result = await this.git.branchLocal();
    return result.all;
  }

  async fetchAllFeatures(branches: string[]): Promise<FileSnapshot[]> {
    // 对每个分支，读取 .supercrew/tasks/ 目录
    // 使用 git.show(['branch:.supercrew/tasks/feature-id/meta.yaml'])
  }
}
```

### 前端改动

**添加 "Local Mode" 切换开关**（可选，优先级低）：

- 在 AppHeader 或 Settings 中添加一个开关
- 切换时更新 localStorage: `localStorage.setItem('dev-mode', 'local-git')`
- API 调用时自动附加 `?mode=local-git` 参数

**短期方案**：手动在 URL 添加 `?mode=local-git` 测试即可

### 数据格式保持一致

LocalGitScanner 返回的数据结构必须与 BranchScanner 完全一致：

```typescript
interface FileSnapshot {
  branch: string;
  featureId: string;
  files: {
    meta: string | null;      // YAML content
    design: string | null;    // Markdown content
    plan: string | null;      // Markdown content
  };
}
```

### 错误处理

- 本地 repo 不存在：返回友好错误信息
- 分支不存在：跳过该分支，继续扫描其他分支
- 文件不存在：返回 `null`（与 GitHub API 404 行为一致）
- Git 命令失败：捕获异常，记录到 `errors` 数组

### 性能优化

- **并行读取**：使用 `Promise.allSettled` 并行读取多个分支
- **缓存**：同一分支的文件可以缓存（可选，后续优化）
- **限制并发**：避免同时执行过多 git 命令（使用 p-limit）

## Out of Scope

- WebAssembly 版本的 git（使用 isomorphic-git）- 太复杂，优先用 simple-git
- 前端 UI 切换开关 - 可以在后续版本添加
- 支持远程 git repo（如 `git://` 协议）- 只支持本地文件系统
- Git LFS 支持 - 不需要
- 支持 `local-fs` 快速模式 - 先实现 `local-git`，够用即可
