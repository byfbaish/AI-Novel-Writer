<!-- charter-version: 2026-10-25 -->
# AGENTS.md · 常驻上下文（新会话开工先读这一份）

> 只放「不读就一定会悄悄犯错」的内容，**上限 60 行**；超出的必须下沉。
> 细则：文档规则 → [`docs/agents/documentation-charter.md`](docs/agents/documentation-charter.md) · 文档索引 → [`docs/README.md`](docs/README.md) · 待办 → [`docs/plans/prompt-assembly-backlog.md`](docs/plans/prompt-assembly-backlog.md)
> **本文件入库**（2026-10-25 起，见 [ADR-0025](docs/adr/0025-track-agents-md-and-copilot-channel.md)）—— 换机后新克隆即可用，不再需要凭章程重建。
> 权威副本仍是 charter，改动两边必须同步 `charter-version`。

## 项目地图

| 目录 | 职责 | 边界 |
|---|---|---|
| `src/` | 渲染层（React + TS）：工作流命令、Prompt 组装、界面 | 改非组件模块后热更新不生效，**必须重启 `pnpm dev`** |
| `electron/` | 主进程：DB、IPC、文件、生成归属仲裁、提示词全局资产 | 主进程与渲染层各拼一半 prompt，改 prompt 前读 inventory §2 |
| `src/shared/` | 跨进程契约与纯函数（校验器都在这里） | 新校验优先放这里，不要塞进 command |
| `docs/design/` | 现行设计稿（按主题分子目录） | 新设计一律进这里 |
| `docs/plans/` | **唯一** TODO 台账 + 冻结子树 | 不新增设计稿 |
| `docs/adr/` | 架构决定，只增不改 | 不修改既有条目 |

**禁动区**：`docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`（被脚本按字面路径引用）；`docs/adr/` 的既有条目。

## 命令

```bash
pnpm install
pnpm run rebuild:electron   # 跑 pnpm dev 前必须做，Node ABI ≠ Electron ABI
pnpm dev

# 测试：两套 ABI，别混用
node ./node_modules/vitest/vitest.mjs run <paths>                                                                # src/**
ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe ./node_modules/vitest/vitest.mjs run <paths>    # electron/**
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts <paths>                               # *.browser.tsx

npx tsc --noEmit
node scripts/check-doc-links.mjs        # 断链：有错即失败
node scripts/check-doc-placement.mjs    # 放置/状态行/索引：只报新增
```

## 硬规则（8 条）

1. **新文档放哪里**：会改代码或行为 → `docs/design/<主题>/`；只是一条待办 → 追加 `docs/plans/prompt-assembly-backlog.md`；不可逆决定 → `docs/adr/`；跨会话交接 → `docs/handoffs/YYYY-MM-DD-主题.md`。**不新建台账，不往 `plans/` 放设计稿。**
2. **每份设计稿头部必须有 `> 状态：` 行**（含日期）；状态变化只改这一行，不新建文件。
3. **收口一期要改「所有」写着该期状态的位置** —— 顶部状态行、分期表、台账、路线图表。只改顶部 = 读者以为没做完。
4. **改代码在同一提交内同步文档**；提交前跑 `check-doc-links` 与 `check-doc-placement`。
5. **提交前跑受影响的测试文件**，不只是改动所在模块的测试。`tsc` 通过 ≠ 测试通过。
6. **改 prompt 文案前**先读 `docs/design/prompt/prompt-three-layer-inventory.md`（三层承载物 + 16 条装配链路）与 `prompt-clause-admission.md`（条款三问）。作者事实与红线不得删除（ADR 0020）。
7. **不猜根因**：先取证（代码 / 日志 / prompt trace），再改。测试失败先用 `git stash` 对照确认是否既有红。
8. **图用 Mermaid**，每张图配一句读法；不贴截图（无法 diff）。

## 要做什么 → 先读什么

| 你要做 | 先读 |
|---|---|
| 改 prompt 组装 / 任何模板 | `design/prompt/prompt-three-layer-inventory.md` |
| 加/改 prompt 条款 | `design/prompt/prompt-clause-admission.md`（三问 + 反例库） |
| 改连续性 / 世界状态 | `design/architecture/world-state-review-and-wiring-plan.md` · `design/review/p2-1-continuity-findings-design.md` |
| 改长篇结构（卷 / 单元 / 弧） | `design/architecture/long-form-readiness-review.md`（生产链）· `long-form-craft-alignment-assessment.md`（创作侧） |
| 放 / 改 / 归档文档 | `docs/agents/documentation-charter.md` |
| 找接下来做什么 | `plans/prompt-assembly-backlog.md` 顶部优先级表 |
| 把活派给 Copilot CLI（另一进程，可无头） | `docs/agents/copilot-channel.md` |
