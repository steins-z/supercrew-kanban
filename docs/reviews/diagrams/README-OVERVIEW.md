# 架构图与流程图总览

本目录包含 Database & Agent Reporting API 特性的所有架构图和流程图。

## 目录结构

```
diagrams/
├── README.md                    # 本文件 (总索引)
├── *.png                        # 完整特性架构图 (10 个)
├── *.dot                        # Graphviz DOT 源文件
└── local-dev/                   # Local Dev Validation 子模块图表
    ├── *.png                    # 子模块图表 (9 个)
    └── *.dot                    # DOT 源文件
```

---

## 完整特性架构图 (10 个)

### 1. 系统架构对比

| 图表 | 文件名 | 大小 | 说明 |
|------|--------|------|------|
| 当前架构 (Git-Only) | `current_arch.png` | 41K | 现有架构的限制 |
| 新架构 (混合) | `new_arch.png` | 61K | Git + Database 混合架构 |

**预览:**

<table>
<tr>
<td><img src="./current_arch.png" width="400" alt="当前架构"></td>
<td><img src="./new_arch.png" width="400" alt="新架构"></td>
</tr>
</table>

### 2. 系统全景

| 图表 | 文件名 | 大小 | 说明 |
|------|--------|------|------|
| 完整系统架构 | `system_overview.png` | 124K | 所有组件及交互关系 |

**预览:**

<img src="./system_overview.png" width="800" alt="系统全景">

### 3. 状态机设计

| 图表 | 文件名 | 大小 | 说明 |
|------|--------|------|------|
| SyncState 状态机 | `sync_states.png` | 97K | 7 种同步状态转换 |
| FreshnessIndicator | `freshness.png` | 60K | 6 种 UI 新鲜度指标 |

**预览:**

<table>
<tr>
<td><img src="./sync_states.png" width="400" alt="SyncState"></td>
<td><img src="./freshness.png" width="400" alt="Freshness"></td>
</tr>
</table>

### 4. 验证逻辑

| 图表 | 文件名 | 大小 | 说明 |
|------|--------|------|------|
| 验证决策树 | `validation_decision.png` | 114K | 完整验证逻辑流程 |
| Validation Worker | `validation_worker.png` | 45K | Cron 执行流程 |

**预览:**

<table>
<tr>
<td><img src="./validation_decision.png" width="400" alt="验证决策树"></td>
<td><img src="./validation_worker.png" width="400" alt="Validation Worker"></td>
</tr>
</table>

### 5. 测试与性能

| 图表 | 文件名 | 大小 | 说明 |
|------|--------|------|------|
| 测试金字塔 | `test_pyramid.png` | 21K | 测试策略分层 |
| API 用量对比 | `api_comparison.png` | 33K | GitHub API 优化效果 |

**预览:**

<table>
<tr>
<td><img src="./test_pyramid.png" width="400" alt="测试金字塔"></td>
<td><img src="./api_comparison.png" width="400" alt="API 对比"></td>
</tr>
</table>

### 6. 部署流程

| 图表 | 文件名 | 大小 | 说明 |
|------|--------|------|------|
| 部署流程图 | `deployment.png` | 33K | 5 步部署流程 |

**预览:**

<img src="./deployment.png" width="600" alt="部署流程">

---

## Local Dev Validation 子模块图表 (9 个)

**目录:** `local-dev/`

### 核心图表

| 图表 | 文件名 | 大小 | 说明 |
|------|--------|------|------|
| 架构概览 | `architecture.png` | 64K | Agent → Backend → GitHub 流程 |
| 验证流程 | `validation_flow.png` | 106K | 完整验证决策树 |
| 数据流图 | `data_flow.png` | 81K | GitMetadata → FreshnessIndicator |
| 状态机 | `state_machine.png` | 82K | 7 种状态转换 |
| SyncState | `sync_states.png` | 91K | 详细状态定义 |
| 代码审查流程 | `review_flow.png` | 52K | 双阶段审查 |
| 测试金字塔 | `test_pyramid.png` | 25K | 测试覆盖策略 |
| API 用量 | `api_usage.png` | 32K | 快速路径优化 |
| 部署流程 | `deployment.png` | 21K | 迁移步骤 |

**总计:** 9 个图表, ~554K

---

## 所有图表汇总

**完整特性:** 10 个图表, ~629K
**Local Dev 子模块:** 9 个图表, ~554K
**总计:** 19 个图表, ~1.2MB

---

## 如何使用这些图表

### 1. 在评审文档中查看

评审文档已包含所有图表的 DOT 源码:
- `docs/reviews/2026-03-09-database-agent-reporting-api-full-review.md`
- `docs/reviews/2026-03-09-local-dev-validation-review.md`

### 2. 在线编辑 DOT 源码

复制 `.dot` 文件内容到:
- **Graphviz Online**: https://dreampuf.github.io/GraphvizOnline/
- **Edotor**: https://edotor.net/

### 3. 本地生成新图表

```bash
# 从 DOT 文件生成 PNG
dot -Tpng input.dot -o output.png

# 生成 SVG (矢量图)
dot -Tsvg input.dot -o output.svg

# 生成 PDF
dot -Tpdf input.dot -o output.pdf
```

### 4. 批量重新生成

```bash
# 使用提取脚本批量生成
python3 scripts/extract-graphs.py \
  docs/reviews/2026-03-09-database-agent-reporting-api-full-review.md \
  docs/reviews/diagrams

python3 scripts/extract-graphs.py \
  docs/reviews/2026-03-09-local-dev-validation-review.md \
  docs/reviews/diagrams/local-dev
```

---

## 图表风格说明

### 节点颜色

- **lightblue** - Agent Layer, 本地组件
- **lightgreen** - 成功状态, API 端点
- **lightyellow** - 待处理, 中间状态
- **lightcoral** - 错误状态, Worker
- **lightgray** - 中性状态, 存储层
- **orange** - 冲突状态, Database
- **red** - 删除状态, 严重错误

### 节点形状

- **box** (矩形) - 流程节点, 组件
- **diamond** (菱形) - 决策点
- **circle** (圆形) - 状态节点

### 箭头样式

- **实线箭头** - 主要流程
- **虚线箭头** - 可选流程, 错误路径
- **红色箭头** - 错误路径, 禁止操作

---

## 相关文档

- **完整评审文档**: `docs/reviews/2026-03-09-database-agent-reporting-api-full-review.md`
- **Local Dev 评审**: `docs/reviews/2026-03-09-local-dev-validation-review.md`
- **设计文档**: `docs/plans/2026-03-08-local-dev-validation-design.md`
- **实施计划**: `docs/plans/2026-03-08-local-dev-validation-implementation.md`

---

**生成时间:** 2026-03-09
**工具:** Graphviz 14.1.3
**脚本:** `scripts/extract-graphs.py`
**格式:** PNG (600 DPI)
