<!-- charter-version: 2026-11-06 -->
# AGENTS.md · 常驻上下文（新会话开工先读这一份）

> 只放「不读就一定会悄悄犯错」的内容，**上限 60 行**，超出必须下沉。细则 → [`documentation-charter.md`](docs/agents/documentation-charter.md) · 索引 → [`docs/README.md`](docs/README.md) · 待办 → [`plans/prompt-assembly-backlog.md`](docs/plans/prompt-assembly-backlog.md)。**本文件入库**（[ADR-0025](docs/adr/0025-track-agents-md-and-copilot-channel.md)），换机克隆即可用；权威副本仍是 charter，改动两边同步 `charter-version`。

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
pnpm dev            # predev 会先探测 better-sqlite3 是否匹配 Electron ABI，不匹配才重建；无需手动 rebuild

# 测试：统一走 Electron 运行时（一份 ABI，可与 pnpm dev 同时跑）
pnpm test <paths>
node scripts/run-tests-electron.mjs <paths>                                                                      # pnpm shim 坏掉时直调
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts <paths>                               # *.browser.tsx

npx tsc --noEmit
pnpm check:fast                                 # 闸门：typecheck + 文档检查（pre-commit 自动跑，~30s）
pnpm check:full                                 # 再加 lint + 全量测试（慢，手动跑）
node scripts/check-doc-placement.mjs --status-of "期 2"   # 收口：把写着该期的位置列全
```

**为什么测试不再走裸 Node**（2026-10-25 改）：`better-sqlite3` 是原生模块，Node 22 的 ABI 是 127、Electron 41 是 145，二者不能共存于同一个编译产物。原先靠 `prepare:native-*` 来回切，代价是 **`pnpm dev` 开着时切不动**（Electron 持有 `.node`，`prebuild-install` 报 `EBUSY`），以及每次切错都表现为一条跟业务无关的 ABI 报错，极易被误读成「刚改的代码弄坏了库」。现在 `pnpm test` 固定用 `ELECTRON_RUN_AS_NODE=1` 跑（此时 Electron 是纯 Node，不启动 Chromium），**全工程只有一份 ABI**。真需要纯 Node 时用 `pnpm test:node`（它会先切 ABI，因此必须关掉 `pnpm dev`）。

## 硬规则（10 条）

1. **新文档放哪里**：会改代码或行为 → `docs/design/<主题>/`；只是一条待办 → 追加 `docs/plans/prompt-assembly-backlog.md`；不可逆决定 → `docs/adr/`；跨会话交接 → `docs/handoffs/YYYY-MM-DD-主题.md`。**不新建台账，不往 `plans/` 放设计稿。**
2. **每份设计稿头部必须有 `> 状态：` 行**（日期必填），取值只能取 charter §5.2 受控词表里的一个：`待裁定` / `已裁定` / `已实施`（`已落地`）/ `已搁置（原因）` / `已结项`。状态变化只改这一行，不新建文件。**脚本 C1b 校验，别自创写法。**
3. **收口一期要改「所有」写着该期状态的位置** —— 顶部状态行、分期表、台账、路线图表。只改顶部 = 读者以为没做完。**别靠记忆，跑 `--status-of "<期名>"` 把位置列全**（2026-10-30 就漏过：提交说期 2 完成，两份稿子还写着未开工/未改代码）。
4. **改代码在同一提交内同步文档**；提交前 `pnpm check:fast`（pre-commit 已自动执行）。
5. **提交前跑受影响的测试文件**，不只是改动所在模块的测试。`tsc` 通过 ≠ 测试通过。**在 worktree 里并行干活时只准单元测试**：禁全量、禁 `test:browser`/验收脚本、禁 `pnpm test:node`（切 ABI 会打断所有槽位的 dev）→ [`docs/agents/worktree-parallel.md`](docs/agents/worktree-parallel.md)。
6. **改 prompt 文案前**先读 `docs/design/prompt/prompt-three-layer-inventory.md`（三层承载物 + 16 条装配链路）与 `prompt-clause-admission.md`（条款三问）。作者事实与红线不得删除（ADR 0020）。
7. **不猜根因**：先取证（代码 / 日志 / prompt trace），再改。测试失败先用 `git stash` 对照确认是否既有红。
8. **图用 Mermaid**，每张图配一句读法；不贴截图（无法 diff）。
9. **干完 ≠ 已完成，谁都不例外**：改完的东西**不许自己宣布完成** —— 派一个**上下文隔离**的子 agent 审（只给「要求什么 / 交付了什么 / 怎么算通过」，**不给推理过程和结论**）；协作模式**交叉审**；派出去的人**不给 `review`/`done` 权限**。复核意见**要证据**，无证据的通过与反对都不成立；**签字必须换个身份**（`review` 拒同名）。**打回只认两种**：`unmet`（卡上验收标准没兑现）/ `regression`（打坏了原来能用的）—— "还能更好"不是理由，那属新卡（质量无上限，不设边界就永远出不去）→ [`docs/agents/task-board-channel.md`](docs/agents/task-board-channel.md) §5.2 / §5.3 / §5.4
10. **★ 向作者提请裁定，一律先用产品语言讲，别甩代码**（2026-11-06 作者定，最高优先）：讲清流程 / 卡点 / 意图 / 后果，代码与行号只作证据；出现「非此即彼」先查单选前提。四段模板、理由与 D8 复盘 → [`documentation-charter.md`](docs/agents/documentation-charter.md) §11。

## 要做什么 → 先读什么

| 你要做 | 先读 |
|---|---|
| 改 prompt 组装 / 任何模板 | `design/prompt/prompt-three-layer-inventory.md` |
| 加/改 prompt 条款 | `design/prompt/prompt-clause-admission.md`（三问 + 反例库） |
| 放 / 改 / 归档文档 | `docs/agents/documentation-charter.md` |
| 找接下来做什么 | `plans/prompt-assembly-backlog.md` 顶部优先级表 |
| 把活派给外部 agent | `docs/agents/copilot-channel.md` · `docs/agents/workbuddy-channel.md` · `docs/agents/doubao-channel.md` · `docs/agents/task-board-channel.md`（建卡/认领/复核） |
