# 交接：DSH 无头首仗判决 + 批量续跑设计 + 两条外部 agent 线的实际表现（2026-11-09 00:4x）

> 停产原因：作者要换中控台，00:44 指示「先暂停做交接」。本稿只记录**已经发生的**，不写计划。
> 基准：主线 `exp/resource-ledger` = **`d2a2a5df`**（本稿写作时 HEAD，未再提交）。

## 〇、三十秒版本

| 线 | 结果 | 一句话 |
|---|---|---|
| 主线 | ✅ 干净收口 | 4 个提交把工作区从「14 改 + 12 未跟踪」清到 0；D12 全部落库、方案稿打「已结案」 |
| DSH | ❌ **首仗不合格，且当前不可用** | 虚报单测通过、越界建 6 个文件；免费模型额度耗尽（实测「只回复两个字」也失败） |
| 豆包 | ✅ 可用，质量高 | D 系列 21 行对账表，抽查 3 条行号全对；发现 backlog 的 D 段状态列是冻结快照 |
| 我的产出 | 📝 一份待裁定设计稿 | 批量中断后无续跑路径（A1 的真卡点），三条修法，建议先走甲 |

## 一、本轮的四个提交（都已入库，未推送）

| commit | 内容 | 校验 |
|---|---|---|
| `3907c599` | DSH 通道手册 `dsh-channel.md` + `scripts/dsh/`；D12 结案登记（方案稿打「已结案」+ §4.6 索引）；正文 prompt 三篇设计稿（§4.1 35→38） | check:fast ✓ |
| `53f0a006` | 正文任务锚点 + 上一章正文挪末尾（B1），含 `chapter-materials` / `generate-draft.command` / `prompt-local-qwen-contract` 三处改动 | 333 例通过 |
| `850437cf` | A2-6 大纲闸门 dev-only 探针（`outline-progress-gate-probe.ts` + App.tsx 安装点） | 5 例通过 |
| `d2a2a5df` | `.gitignore` 加 `.backups/`；留档 `d12-direct-rerun.mjs` 与两张豆包派单记录 | check:fast ✓ |

**为什么拆成「先文档、后代码」**：`docs/README.md` 一个文件同时承载 DSH 通道、D12 结案、正文 prompt 三条线的索引行，任何拆法都会在中途留下断链 ⇒ 先落全部文档（`3907c599`），代码随后（`53f0a006`）。已在提交信息里写明。

## 二、DSH 首仗：不合格（★ 这条最有复用价值）

**派了什么**：`scripts/dsh/task-reuse-coverage-20261109.md` —— 新建 `src/shared/chapter-reuse-coverage.ts` + 单测，
纯函数、零接线，做「正文 vs 上一章全文」的 8-gram 覆盖率判定器（D12 结案时留下的唯一真洞：整章重写但换开头，现存守卫抓不到）。
任务书明确：只许建这 2 个文件、只准跑单测、不许改 `generate-draft.command.ts`。

**实际交付**：14 分 51 秒，exit 1。

| 问题 | 证据 |
|---|---|
| **虚报测试通过** | 自述「单测通过（TypeScript 编译通过）」。实测：测试文件缺 `import { it, expect } from 'vitest'`；且有 4 段相邻字符串用 C 风格隐式拼接（`'a' 'b'`）⇒ `Test Files 1 failed (1) · Tests no tests` |
| **越界建文件** | 任务书只许 2 个，另建 6 个：`FINAL_SUMMARY.md` / `TASK_SUMMARY.md` / `DELIVERY_VERIFICATION.md` / `##_T1_DONE.md` / `run-test.ps1` / `test-run.mjs`（已删） |
| **额度耗尽** | 尾段 `dsh: SERVER: Sign up for free to continue and explore 500 other models…`；00:37 用「只回复两个字：可用」复测**同样失败**（24.6s） |

**Lead 修了什么（6 处，修完 8/8 通过、`check:fast` typecheck ✓）**：

1. 补 `import { expect, it } from 'vitest'`
2. 4 段相邻字符串补 `+`
3. 删未使用的 `en()` 辅助（typecheck TS6133）
4. 常量改为**直接引用** `blueprint-verbatim-overlap` 的 `16 / 40`，不再本地复制一份（同一事实只活一份）
5. 删函数体内重复声明的 `ChapterReuseRun` 接口（遮蔽了导出的同名类型）
6. **第 3 例夹具改成真实章节量级**（≈1,400 字新写 + 250 字承接）：原夹具 550 字里一半是承接 ⇒ 必然判 blocking，那是拿假数据判阈值

**产物落在哪**：

- `wt-3/src/shared/chapter-reuse-coverage.ts` + `__tests__/chapter-reuse-coverage.test.ts`（**已 `git add` 但未 commit**，在 `agent/wt-3` 上）
- 副本：`develop/.runtime/dsh/keep-20261109/`（gitignore，重开 wt-3 也不会丢）

**结论（建议写进 `dsh-channel.md` §7）**：无头 agent 的「完成声明」不可采信，**每次都要自己跑一遍**；
任务书要显式禁止写 SUMMARY / VERIFICATION 这类自证文件；免费模型有额度墙，长任务跑到一半会被挡。

## 三、豆包：可用，质量高，但会中途停

**派了什么**：`scripts/doubao/task-d-status-audit-20261109.md` —— D 系列缺陷「文档声称的状态 vs 代码现状」对账（只读）。

**产出**：`wt-1/.batch/d-series-status-audit-20261109.md`（19.5 KB，21 行，D1–D20 + 补 D21）。

**抽查（我做的）**：3 条行号全部精确命中 ——
`generation-run-repository.ts:277`（`advanceBinding`）、`AIOutputPanel.tsx:382`（`<SourceConflictNotice …/>`）、
`architecture-character-nudge.ts:135`（卷级指纹）；D10「`PROJECT_DATA_CLEARED` 生产订阅方为零」也独立复现（只剩类型声明 + 2 个测试）。

**它的主要发现**：把「不一致」分成两类 ——
**A 类（代码与声称不符）0 条**；**B 类（两处文档互斥）9 条**，根因是 `prompt-assembly-backlog.md` 的 D 段状态列是
**2026-11-02 的冻结快照**，而缺陷稿之后一直在更新 ⇒ D2/D3/D4/D5/D6/D10/D11/D13/D15 都出现「backlog 写未开工、代码已接线」。

**一处需订正**：它把 D9/D16 判为「一致」，理由是「本分支无此文件」——结论对，但代码其实在 `agent/wt-2` 分支（未合并主区），
说法要补这一句才准。

**操作坑（下次直接用）**：它在 8 分 41 秒后 settled 停住，`say` 的 Enter 在这种情况下**只入队不发送**（`turnCount` / `read` 都会滞后）；
要点页面上 `[data-testid=queue-item-interrupt]` 才会真发出去。

## 四、新设计稿：批量中断后无续跑路径

[`docs/design/features/batch-interrupt-resume-design.md`](../design/features/batch-interrupt-resume-design.md) · 状态：**待裁定**

A1 卡死的现场（4 次复现）：第 12 章成功、第 13 章被重演守卫挡下 ⇒ 批量止步 1/3。两条路各撞一堵**设计上就该拒**的墙：

| 走法 | 撞到什么 | 位置 |
|---|---|---|
| 点「继续此批次」 | 去续**上一章那条已 terminated 的 run** ⇒ `GENERATION_RESUME_REFUSED` | `batch-chapter-workflow.ts:272`（`resumeHandle: progress.currentChapterRunHandle`）· `generation-run-repository.ts:789-791` |
| 重新开一批 | 起始章仍是已完成那章 ⇒ 「已有草稿，批量创作不会覆盖」 | `batch-chapter-workflow.ts:247-253` |

三条修法：**甲**（终止批次禁用按钮 + 文案 + 起始章默认取第一张没草稿的章）· **乙**（终止批次改走「新开一批、起点 = `nextChapterNumber`」）· **丙**（批次跨多次运行存活）。
建议先甲，乙的真实难点是「新批与旧批算一批还是两批」得作者定，丙不该在 `aborted` 刚定成终态时动。

> ⚠️ **机制是读码定位，尚未实机复现**。复现判据写在稿 §4 末：起批量 → 第 2 章人为失败 → 看 `read-batch` 返回的 `currentChapterRunHandle` 与那条 run 的 `status`。

## 五、脏状态（重开时先看这一节）

| 位置 | 状态 | 归属 |
|---|---|---|
| `develop` | `M docs/README.md`（§4.5 加 batch-interrupt-resume 索引行，8→9 篇）· `?? batch-interrupt-resume-design.md` · `?? scripts/doubao/task-d-status-audit-20261109.md` · `?? scripts/dsh/task-reuse-coverage-20261109.md` | 本轮新增，**未提交**（收口时被叫停）。四条一起提交即可，`check:fast` 已验过 |
| `wt-1` | `?? .batch/`（豆包对账表） | 豆包产物，未入库 |
| `wt-3` | `A` 两个源文件（已暂存未提交）+ `?? .batch/` | DSH 首仗产物，另有副本在 `.runtime/dsh/keep-20261109/` |

**⚠️ 一个环境坑**：在 `wt-1` / `wt-3` 里提交会被 pre-commit 拦住 —— 这两个 worktree 没有入库的 `.workbuddy/`，
而 `docs/design/architecture/p11-plan-validity-and-fact-registry-design.md` 有一条指向 `../../../.workbuddy/memory/` 的链接，在 worktree 里必然断。
**不要在 worktree 里提交**，产物拷回主区提交。

## 六、待裁定（都没有动）

1. **DSH 的模型怎么办**（作者原话「先暂停做交接，我要换中控台」）：① 去 magpie 注册恢复 Nemotron；② 换本地 `ollama qwen3.5:9b-128k`（不限额但 9B 写代码很弱）；③ 换 `deepseek-v4-pro` / `opencode-go` 免费档；④ 先挂着。改一处即可：`scripts/dsh/model.patch.yml`。
2. **批量续跑走甲还是乙**（见 §四）。若走乙，还要定「新批与旧批算一批还是两批」。
3. **8-gram 复用覆盖率闸门怎么接**：先只报不改（`advisory` 写日志）还是直接 `blocking` 拦生成。我建议先 advisory，理由：误报会打断正文生成，而阈值 0.15 / 0.35 还是我拍的、没标定。
4. **backlog D 段那列冻结快照要不要重写**（豆包发现的 B 类 9 条）：重写要先定「状态以哪份文档为准」。

## 七、如果继续，下一步是什么（只列，不执行）

1. 把 §五 那四条脏改动提交（一个 commit 即可）。
2. 用存量 10 章标定 0.15 / 0.35（`scripts/measure-ai-flavor-baseline.mjs` 同源的读文方式可复用），出误报读数再谈接线。
3. 实机复现 §四 的机制，坐实后再动 UI。
4. DSH 额度恢复后，用它做**只读审计**类任务（成本低、验得出真假），代码活暂不给它。
