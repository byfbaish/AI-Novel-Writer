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

---

## 八、执行回填（2026-11-09 01:5x · DSH 中控接手后同轮执行）

> 本节记录 §五–§七 的实际落实结果。中控已换 DSH，外部工人换成 WorkBuddy（wt-2）与豆包（wt-1）；DSH 不再当无头工人（通道手册已标退役）。
> **本轮 8 个业务提交（`63fbb02d` … `51b0ac3b`，全部未推送）**；此后只有文档收尾提交。develop / wt-1 / wt-2 / wt-3 四个工作区均干净（各槽位只剩 `?? .batch/` 证据目录，按批验收稿 §5.3 保留）。

### 8.1 §五 的脏状态已清（4 个提交，均过 `check:fast`）

| commit | 内容 |
|---|---|
| `63fbb02d` | `feat(d12)` §五 的两个源文件（`chapter-reuse-coverage.ts` + 单测）从 wt-3 取回入库；单测实测 `Test Files 1 passed · Tests 8 passed (8)`。同步两处登记（backlog D 段、缺陷稿 §D12） |
| `4be4a548` | `docs(handoff)` 本稿 + 批量续跑设计稿 + 两张派单留档（`scripts/doubao/task-d-status-audit-20261109.md`、`scripts/dsh/task-reuse-coverage-20261109.md`）+ README 索引 |
| `09791033` | `docs(channels)` DSH 通道退役（升为中控）；`worktree-parallel.md` 槽位表 / mermaid / 坑表把 wt-3 置「空闲」；`docs/README.md` 路由行同步 |
| `3b77b4af` | `feat(experiments)` 8-gram 阈值标定脚本与报告（见 §8.3） |
| `c4f3dc48` | `docs(ledger)` D 段台账降级为快照索引（D1–D21，历史格值零删改） |
| `9241dc5a` | `docs(product)` D21 闸门短路取证归档（见 §8.4） |

**wt-3 收尾状态**：`git reset --hard d2a2a5df` ⇒ 工作区只剩 `?? .batch/`；`.batch/c-report.md`（24KB）按批验收稿 §5.3 **保留至第三方签核后**，未删。863MB `node_modules` 与 worktree 目录暂留（回收走 `worktree-parallel.md` §9，签核后一次做）。

**§六 待裁定的处置**：① DSH 模型 → 不再需要（DSH 升中控，`scripts/dsh/` 留作历史）；③ 8-gram 闸门 → **维持零接线 + 先 advisory**，且已标定（§8.3）；② 批量续跑 → 作者选**甲**，WorkBuddy 在 wt-2 实现（§8.5）；④ backlog D 段 → 已降级为快照 + 现值索引，8 项裁定留作者。

### 8.2 队友与看板：换成 WorkBuddy（wt-2）+ 豆包（wt-1）

两个 DSH 队友席位只做「写任务书 → 走既有 CDP 通道投递 → 轮询回执 → 按证据首次验收」；产品代码 / git / 看板签核全留 Lead。通道各自串行、彼此并行。

| 卡 | 谁做 | 结果 |
|---|---|---|
| `cd24e30c` I2 D 段台账重写提案 | 豆包 | 交付 279 行提案 → Lead 落最小方案（`c4f3dc48`），提案全文归档 `plans/2026-11-09-d-segment-ledger-rewrite-proposal.md`；**8 项裁定仍待作者** |
| `46746a52` I3 D21 取证 | 豆包 | 断言成立 + 三处口径更正，归档 `design/product/d21-gate-shortcircuit-evidence-20261109.md` |
| `caf3f90a` I2 8-gram 阈值标定 | WorkBuddy | 脚本 + 278 行报告，Lead 独立重跑复现全部数字 |
| `a67a79a1` I1 批量续跑甲方案 | WorkBuddy | 见 §8.5 |

三张已交付卡均由**换身份**（`--agent lead-reviewer`）复核后 pass；验收结论 = 交付物可用，**不等于**其中的产品裁定已定。

### 8.3 8-gram 阈值标定结论：0.15 / 0.35 未被标定

存量 1 个项目 11 章 10 对真实相邻章 + 3 组构造样例：

- 真实相邻章 `ratio` **全 0**（10/10 未触发）；同题材同人物剧情不同 3 例也全 0；真实改写 4 对全 0。
- 人工构造「整章复写只换开头」3 例 = 0.8578 / 0.8361 / 0.8357，全 `blocking`。
- 中间带 `(0, 0.8357)` **零样本** ⇒ 把 advisory 改成 0.01、blocking 改成 0.60，判定结果都不变。**这轮给不出数据驱动的更优值**，只给了保守档 0.20/0.50 与激进档 0.05/0.25 的成本权衡（待作者拍板，代码里没写）。
- **反直觉读数**：d12 生产守卫在构造样例上 3/3 命中，但那是**假命中** —— 1,647–1,972 字的短章里「上一章结尾 1,000 字」实际覆盖其后 51%–61%，与只换开头的样本窗口重叠。真正漏报在「复写落在窗口之外」。缺陷稿 §D12 补记的表述已按此修正（原文「拦不住整章重写」→「窗口内拦得住、窗口外零命中」）。
- **指标层问题**：判定器只认 16 字连续逐字重合，对「同剧情换措辞的改写式复用」无感（`ratio=0`）——要守那种形态需另立指标，不是调阈值能解决。

**§8.3.1 作者裁定落实（2026-11-09）**：① 阈值按建议落 —— advisory 保持 `0.15`，blocking 由 `0.35` 抬到 **`0.45`**（宁可少打断），代码只改常量与注释、**仍零接线**；② 新增产品规则「**连续两章绝对不能出现剧情相同**」，根因二分（大纲生成有误 / 正文重复），已登记进缺陷稿 §D12 补记与 backlog 补记，并写明逐字闸门不覆盖该规则、需另立判据；③ wt-2 备份分支 `keep/d9-d16` 的两个提交（D16 状态栏实际模型、D9 超时三态）按作者「预定产物要合主线」已 cherry-pick 到主线（`155efe4d` / `e8e22971`，18 例单测全过、typecheck 绿），**D9 仍是零接线机制**。

### 8.4 D21 取证结论：断言成立，且后果比原描述更重

真实短路段在 **`src/services/outline-progress-gate.ts:92-95`**（不在 `shared/` 的纯判定函数里）：卷结构 `stale`/`unparsed` 时直接 `return { gate: null, warning }`，`:116` 的第二维取值入口永不执行；调用方 `ArchitectureConfirmDialog.tsx:509-512` 拿到 null 只 `console.warn`，随后一路发射 ⇒ **静默放行、界面零提示**。三点口径更正：短路段层级 · 交接单其实已读回只是被丢弃 · 实际后果是放行不是「跳过展示」。

**落地前置**：`src/services/__tests__/outline-progress-gate.test.ts:154-165` 把短路固化成「判不出就不拦」的断言，删短路 / 只放宽 stale 两案都会撞红 ⇒ 作者须先裁定改不改测试。D21 是否收编进缺陷稿仍是 §六 裁定 ③。

### 8.5 批量续跑甲方案已落地（wt-2 · WorkBuddy，提交 `20ed7a2d`）

- **新增** `src/services/batch-interrupt-resume.ts`（79 行，纯函数 + 一个取数薄封装）：`evaluateBatchRecoveryGate` 判终止（`failed`/`cancelled`/`aborted`；`paused` 仍可续），`firstChapterWithoutDraft` 从权威下一章连续顺延到第一张没草稿的章（遇空章即停，不用 `max+1`）。
- **不新增 IPC 字段**：`generation:list-batches` 的 `rootHandle.runId` 与 `generation:list` 的 `view.handle.runId` 同源，渲染层同一个 effect 里本来就有两个返回值 ⇒ 只需把 status 按 runId 存进 state。
- **改动边界**：`AIOutputPanel.tsx`（+21/−4，批次卡片 gate + 中英双写出路文案）、`BatchChapterCreationDialog.tsx`（+4/−3，显示与真正启动共用 `readBatchStartChapter`）；**未碰** run 状态机 / DB schema / `generation_batches` 语义 / `aborted` 终态 / `batch-chapter-workflow.ts`。
- **验收（Lead 自己做，不采信自述）**：在 wt-2 跑 `pnpm test src/services/__tests__/batch-interrupt-resume.test.ts` ⇒ `15 passed`（首轮 12 例，交付后补了 3 例：出路章号不写死 / `nextChapterNumber=null` 走通用文案 / `completed` 不判终止，已一并合入）；`pnpm typecheck` 通过；`git diff HEAD` 逐行看过；合并用 `git apply`（patch 7,930 B，`--check` 通过），合入后在 develop 再跑一次同类 ⇒ `12 passed`，`pnpm check:fast` 绿。
- **有意未做**：`draft-recovery-workflow.ts` 的新错误码（按钮已禁用，主路径走不到；再加等于两份判定真相）· 乙 / 丙方案 · 「自动跳过必然失败的章」（会变静默跳章，留作者裁定）· 实机复现（红线禁 `pnpm dev`）。
- **一处口径修正**：WorkBuddy 报告 §4.0 记「本会话所有单测既有红，需 `--pool=vmThreads`」，Lead 在 wt-2 与 develop 用不带该参数的 `pnpm test` 均通过 ⇒ 那是它那个会话的环境现象，不是仓库既有红。

### 8.6 §七 下一步的落实与剩余

- ✅ 1. §五 四条脏改动：已提交（§8.1）。
- ✅ 2. 用存量 10 章标定 0.15/0.35：已做，结论是「未被标定」（§8.3）。
- ✅ 3. 实机复现 §四 机制：已由「按读码定位 + 落甲方案 UI 止血」替代——甲方案不改 run 机制，**不需要实机复现即可落地**；若将来走乙，仍需实机复现。
- ⬜ 4. DSH 额度恢复后做只读审计：**不再执行**（DSH 已升中控，无需外部工人额度）。
- ⬜ 5. 8 项台账裁定（`plans/prompt-assembly-backlog.md` §本节遗留 8 项裁定）：待作者。
- ⬜ 6. 阈值档位 + 「改写式复用是否另立指标」：待作者。

