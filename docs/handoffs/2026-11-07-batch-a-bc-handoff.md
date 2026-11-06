# 2026-11-07 工作批次（甲方案）· 立项与验收契约

> 本文是**跨会话续作锚点**：任何人接手本批，先读本文，再读 `docs/design/product/live-pipeline-acceptance-defects-assessment.md` 的现值行与 `.workbuddy/memory/2026-11-07.md`。
> 本文只写「裁决 / 验收 / 编排」，不替代各缺陷段原文；改代码同提交同步台账的硬规则照旧。

## 0 裁决与口径

- 作者 2026-11-07 04:08：「**按照建议来吧，明天星期六，不受免费窗口的限制**」⇒ **甲方案获批**（E0 + A + B + C）。
- **时间口径**：**墙钟 5~8 小时**，A 与 B/C **并行、工时不相加**（原提案分项相加 6.5~9.5h 不自洽，豆包审查指出后已改）。
- **A2 真生成不再抢 08:00 免费窗**：作者明确不受窗口限制 ⇒ 可跨窗、可等模型，不为赶时间跳过实机步骤。
- 现值基准：缺陷稿 **✅7 / 🟡7 / 🔍1 / ⬜5**（20 条）；看板 26 张 `todo`（含留痕卡 / 占位卡 / 真待办三类，见 §2）。
- 复用资产：`docs/handoffs/2026-11-05-five-hour-agent-run.md`（上一轮五小时联动的编排与坑）、`docs/handoffs/2026-11-06-d8b-checkpoint-cleanup-handoff.md`（D8b「本卡无待办」）。

## 1 环境约束（本轮新查，凌驾于原提案的执行细节）

**主工作区 dev 不能动**：`5180` 的 vite（PID 17908）与 electron（PID 50748）于 03:46 由**系统 Windows Terminal → pwsh → `pnpm dev`** 手动启动，**未带 `--remote-debugging-port`**（无 CDP）。父进程是 `WindowsTerminal.exe`，不是 WorkBuddy 会话后台任务 ⇒ 很可能是作者自己开着的 APP。**禁止停止、重启、抢占它。**

由此调整原提案「A 组在主工作区做」：

| 项 | 调整后 |
|---|---|
| A 组实机 | **走 `AI-writer/wt-1` 的 worktree 槽位 1**（`AI_NOVEL_WORKTREE_SLOT=1` ⇒ dev `5181` + CDP `9223` + 独立 profile `.runtime/worktree/slot-1/user-data`）。三个 worktree 已 fast-forward 到主区 HEAD `2d5888c7` 且干净；代码等价、物理隔离，不碰作者 dev |
| 数据安全 | 真生成一律在**项目副本**上跑：`C:\develop\workspace\AI-writer\.batch-a\proj`（391 文件，从真实项目复制，`projectId` 改成独立的 `11111111-…`）。真实项目零改动 |
| B/C 派单 | 落 `AI-writer/wt-2`、`wt-3`（各自 `node_modules`），**只准单元测试** |
| 起 dev 硬规则 | `node node_modules/vite/bin/vite.js`，**不用 `pnpm dev`**；先摘 `CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR` / `CODEBUDDY_TOOL_CALL_ID`（笔记 `notes/env-and-conventions.md` §493）；起前跑 `scripts/prepare-native-for-electron.mjs` |

> **试过但失败的路（别再走一次）**：想「复用现有 5180 vite + 另起一个带 `--remote-debugging-port=9222` 和独立 `--user-data-dir` 的 Electron 实例」——该实例 **1 秒即退出、9222 无监听、user-data 目录根本没创建**。`electron/main.ts:100` 的 `configureSingleInstanceRuntime` 拿不到锁直接 `quit()`。⇒ 同目录第二实例这条路不通，必须用项目自带的 worktree 槽位隔离。
> 槽位表见 `vite.config.ts:42`（5181/9223、5182/9224、5183/9225）。本批只用槽位 1，**不启用其它槽位 vite**，避免多个 dev server 争 `node_modules/.vite`。
> 打开副本靠 `project:smoke-open-request` 拿回主进程里的 `projectPath` 原样传给 `openProject()`（严格字符串相等授权），**不要手拼反斜杠路径**。实测 `9223` 返回 `Chrome/146`，副本 `project.db-shm` 于 04:23 新建 ⇒ 打开的确是副本；作者 `5180` 全程未受影响。

## 2 E0 台账卫生 —— 验收

**结论先行：卡与缺陷稿不是一一对应。**「把 8 张卡一律标完成」是错的：D1、D12 的卡**本身就是待实机的真任务**（D1 = 本批 A1），保持 `todo` 才对；D6、D8 是有意留痕/占位卡，不动。

| 卡（全 ID 前 8 位 / 缺陷） | 缺陷稿现值 | 动作 |
|---|---|---|
| `afa8c5fc` D2 | ✅ | 卡首追加落地说明（真崩溃链路已验，`dbc258d3`→`db8f9ef3`），**不再认领** |
| `34ca71dd` D3 | 🟡（中） | 卡首追加落地说明（`f9540d3b` + `2205e6bb`），剩余唯一未覆盖 = 本批 **A2**，**不再认领** |
| `d8371b26` D5 | 🟡 | 卡首追加「`87684f48` 已实施、未实机」，并标注 A3 结论，**不再认领** |
| `2b7eb20d` D18 | 🟡 | 卡首追加落地说明，**不再认领** |
| `7d7ec549` D13 | 🟡 | **保持 `todo`**，加现有标签 `需实机`；A3 已确认代码齐、缺实机 |
| `61ac055f` D15 | 🟡 | **保持 `todo`**，卡首标注「实际方向 = 检出告警，非落库前互斥校验」（标题与实施方向不符） |
| `9e5187ed` D1 · `c9f56ff9` D12 | 🟡 / ✅（口径不一致） | **不动**，是真待办 |
| `a6c3e2df` D6 · `4b9eae6e` D8 | ✅ | **不动**（占位 / 留痕卡，标题已写明勿认领） |
| D4/D9/D10/D11/D16 | ⬜ | **不动**，本批 B 组派单 |

**验收**：① 上述 4 张卡首有 2026-11-07 落地说明（含提交号 + 缺陷稿图标）；② D13 带 `需实机`；③ D15 带方向更正；④ 其余卡**零改动**；⑤ 不新建卡、不改 `status`、不自造标签词表（只用词表内已有的 `需实机`）。

> 原提案分两步（D13/D15 等 A3 读数再补）。本轮 A3 先做完并出结论，故两步合并一次收口；这不改变「先取证再改状态」的顺序。

## 3 A 组（主 agent，CDP 真点 APP，不派）

| # | 做什么 | 可判验收 |
|---|---|---|
| **A1** | 正文批量「同 run 连续多次生成」不再撞来源变化错误 | 同一批**连续 3 次**生成调用全部成功；任务日志里 `GENERATION_SOURCE_CHANGED` / `GENERATION_DRAFT_SOURCE_CHANGED` 等 `*_SOURCE_CHANGED` **0 次**；贴原始日志片段。错误码出处：`agent-generation-client.ts:33`、`generate-draft.command.ts:1018`、`finalization-generation.ts:41` |
| **A2** | 卷首闸门点「我知道，仍按计划继续」后的**真生成**（D3 唯一未覆盖路径） | ① 卷首 `handoff-missing` 档弹出；② 点确认后写入一条豁免（`outline-progress:volume:1`）；③ **真起 run 并产出情节大纲**，产物落库；④ 产物的来源字段与当前稿一致；⑤ 贴 `generation_runs` / `generation_attempts` 前后计数。**不跑完不算过** |
| **A3** | 三处只读核对 | 见下，各出「事实 + 结论 + 证据位置」一行 |

### A3 结论（本轮已完成，只读，未改任何文件）

- **D5**：`architecture.command.ts:3228–3236` 有 `findAngleBracketPlaceholders()` 落库前守卫，命中**只 `callbacks.log` 告警、继续写库**（不阻断，符合 D15 既有裁定）；模板侧 grep 无 `<…>` 占位符残留。⇒ **模板侧 + 机检侧两侧闭环**，🟡 口径成立；「模型是否转去整句照抄说明文字」属产出侧，只读判不了，**标需实机**（11-06 的 8097 字段扫描无占位符是产物侧旁证）。
- **D13**：缺陷稿 §749 / 表格第 60 行 —— 实施已合并 `959a3647`，T5 缺口按裁定 A 补齐 `3f954431`（条件放开 + 三条断言同向收紧），**未实机**。方案稿 `architecture/d13-chapter-failure-contract-design.md`。⇒ **缺的是实机复验，不是代码**：三个失败点统一错误码出口、`NO_PROGRESS` 前保留草稿、续写参与 compose 判定各跑一次。
- **D15**：`volume-structure.ts:185` 产出 `VOLUME_UNIT_OVERLAP`；`VolumeHandoffRegistryPanel.tsx:252/266/292` 把 `warnings` 存进 state，`summarizeVolumeWarnings()` 把 `VOLUME_UNIT_*`（除 `AMBIGUOUS`）归为「同因的另一种列举、不重复计数」，由 `VOLUME_UNIT_AMBIGUOUS` 计数成句。⇒ **告警已被 UI 消费**（卷末交接登记页），不是「只停在 shared 层」；但口径确为**检出告警**、非「落库前拦下」，存量不修。`overlap` 本身被有意压掉，`other` 计数是防新告警被静默吞掉的兜底。

### A2 现场记录（2026-11-07 04:2x，进行中，接手必读）

- 副本 `.batch-a/proj` 在槽位 1 实例里打开；`synopsisUnitMode` true→false；范围手填 **7–12**；点「确认生成」。
- **先弹的是上游失效清单闸门**（D20 那条：「这次改动会让下面这些派生作废」「其中含卷末交接单：它会被拒绝读取」「我明白这会波及 2 章已定稿正文」）。勾确认 + 点「继续」后**直接起 run**，`[data-testid="outline-progress-gate"]` **为 null ⇒ D3 闸门没弹**。
- 当前状态：副本 `generation_runs` **137 → 138**，新增 `f85becbd-e4f4-… status=running`，`generation_attempts` 新增 2 条；页面「情节大纲 1/1 · 正在工作 · 已用 30 秒 · 10%」；状态栏 `deepseek-均衡`。**模型还在算，不要中止、不要重复提交。**
- 副本读数：`consistency_exemptions` = `outline-progress:volume:3`（未撤销）+ `volume-handoff:volume:2`；`volume_handoffs` 仅 `volume:2` 一张（`source_ref={"outline:book":19}`）。
- **待查（不许先定结论）**：闸门为何没弹。候选：① 实际提交的 `chapterNumber` 不是 7（「已覆盖至第 17 章」的续写/默认逻辑可能覆盖手填值）；② `readOutlineProgressGate` 在副本读失败 ⇒ `gate=null` fail-open；③ `volumeRangeEndingAt(volumes, 6)` 的 `range.last` 为 null ⇒ 不判；④ 已有确认 `outline-progress:volume:3` 命中了另一个卷。查法：在 CDP 里直接调 `readOutlineProgressGate({projectSession, chapterNumber: 7})` 看返回，并核对生成请求里的 `chapterNumber`。
- **结论口径（硬）**：闸门原因查清前，**A2 只算「真生成已起」，不算 D3 的「点继续后」路径已验完**；不得据此把 D3 由 🟡 转 ✅。

## 4 B 组（派单，只准单元测试）

**共同硬约束**：工作目录 `AI-writer/wt-2` 或 `wt-3`；先同步到主工作区 HEAD；**只跑单元测试**，禁 `pnpm test:node` / browser 测试 / 全量测试（会切 ABI、争 `.vite` 缓存）；结果**必须落盘**（后台 agent 结果活不过会话，写到 `<worktree>/.batch/<id>.md`）；不自行宣布完成，交主 agent 换身份复核。

| 缺陷 | 验收（写死，不许「先取证再定」） |
|---|---|
| **D4** | 定位 6 处文案（`AIOutputPanel.tsx:398`、`CodeMirrorEditor.tsx:678/694/716`、`NarrativeThreadEditor.tsx:841/1028`、`VersionHistory.tsx:281`、`ArchFileViewer.tsx:1029`）。同一份 `sourceStatus='conflict'` 同时驱动**产物层**（这一稿不能保存、仍可复制）与**批次层**（后续单元不再执行、需重新发起）两条并列文案。组件单测断言：冲突态下两条文案**同时出现**，且「仅可复制」语义不丢 |
| **D9** | 单次调用超时上限**默认 10 分钟且可配置**（缺陷稿实测 12 分钟未返回）。假时钟单测三态：`生成中 → 超时已中止 → 调用失败` 各自可断言；**超时中止复用 D2 失败终态落库路径**，`generation_runs` 不得留在 `running`/`paused`；贴受影响单测原始输出 |
| **D10** | 「清空生成内容」补渲染侧重置钩子（单测断言钩子被调用），并给回执：**三档（故事架构 / 章节规划 / 正文与审稿）各清了几类、各多少条**，回执计数与 DB 删除计数一致。不要求 browser 测试 |
| **D11** | 去重键改为**卷**（`volumeIndex` + 该卷大纲定稿态），不再用 `c<覆盖数>:l<正文长度>`（`architecture-character-nudge.ts:112`）。单测：同卷连续 3 批只提示 1 次、跨卷提示第 2 次；指纹函数单独断言 |
| **D16** | 状态栏模型指示器读**实际调用事实源**（`generation_attempts` / `generation_runs` 里的 `model` 字段，先取证字段名后写死在卡里），不读配置当前选中值。单测构造「配置 A / 实际调用 B」⇒ 断言显示 B；双语文案不串 |

**B 组不做**：不新增交互范式、不改生成判定逻辑、不动 prompt 模板（若确需碰模板，先读三层承载物并过条款三问）。

## 5 C 组（收紧后只派一项）

| 卡 | 处置 | 理由 |
|---|---|---|
| `861ab163` **keyEventsText 丢弃 estimatedUnits** | **派**（`wt-3`） | 任务书已完备：新增显式带预算格式化函数、默认输出逐字不变、只切正文生成侧调用点、4 条单测、`tsc` + `check:fast`、列明调用点、不改作者项目数据。直接引用原卡，不重写 |
| `744f13a8` C1 剩余两项 | **砍出本批** | 卡自己要求「先确认 C1 原始设计定义」（判据未定）+「补浏览器测试」（**撞 worktree 禁 browser 红线**）。派出去必返工 |
| `4027dbef` AC2 · `bb3f0d83` 扩大 preflight | **不进本批** | 判据未定（AC2 的具名实体边界、preflight 规则集范围），上一轮已按作者甲方案砍掉 |

> **据实修正原提案**：C 组原写 2~3h / 4 项，实际只剩 1 项可派（约 1~1.5h）。这不是缩水，是「判据未定的活不派」这条硬约束生效。空出的时间优先给 A 组实机。

## 6 不进本批（需作者先裁定，不得擅自开工）

A-1.3 干预对照 · W7b 卷切片 / W7c 本章规则子集 · **P0-1 改稿连锁**（300 章场景核心）· P20-3 章末后处理期 3 · D18-① 全环节输入材料筛查 · O1 大纲按弧分批（双端硬契约未解）。

> 优先级不代持：把这些放进「待裁定」只表示**本批不排**，不代表替作者定长期轻重。

## 7 三条编排规则（不打折扣）

1. **A 组实机期间主工作区冻结**：B/C 只落各自 worktree、验完再合；A 组只读 + CDP，不改主区代码。否则 A1/A2 验的是旧代码，结论当场作废。
2. **派单两句护栏**：① 新规则**只告警不阻断**（D15 既有裁定）；② 文案以给定定稿为准，不接受风格性返稿。
3. **换身份复核**：干完只交 `review`，不自行 `done`；复核只认「验收没兑现」或「打坏了原来能用的」两种打回理由。改代码与改台账同一提交，提交前 `check:fast` 由 pre-commit 自动跑。

## 8 收口定义

- 各组按 §2–§5 验收逐条销账，**没跑完的如实标「未跑」，不许写成「作者实机 / 待复验」**（实机验证由 Agent 自己做，只有文风 / 可读性 / 剧情接续是否撕裂才留给人）。
- 真实项目零改动；副本与证据目录验完清理；dev 实例（本批新起的那个）用 `CloseMainWindow()` 优雅退出，不 `Stop-Process`。
- 台账 / 缺陷稿状态行、§2 表格、顶部分布段**逐处 grep 核对**（硬规则：状态写在多处 ≠ 读者会看到）。
