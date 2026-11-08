# 2026-11-07 工作批次 · 计划方案与第三方复核验收清单

> 状态：已裁定（2026-11-07 04:08 作者批准甲方案；04:3x C 组经核实撤销派单；19:19 作者裁「**丙**」＝拆批，本批只收 D4/D10/D11，D9/D16 结转下一批专做结构设计）
> 日期：2026-11-07
> 用途：**第三方独立复核验收**。复核者不需要本次会话上下文；按 §0 操作即可逐条判「兑现 / 未兑现」。
> 上级稿：[`live-pipeline-acceptance-defects-assessment.md`](./live-pipeline-acceptance-defects-assessment.md)（缺陷现值与判据）
> 格式参照：[`live-verification-checklist.md`](./live-verification-checklist.md)（§0 用法、逐项表格、实测读数回填）
> 现场记录：[`2026-11-07-batch-a-bc-handoff.md`](../../handoffs/2026-11-07-batch-a-bc-handoff.md)（执行过程、变更留痕、环境踩坑）
> 放置依据：[`docs/README.md`](../../README.md) §3.1 / §3.2 —— §3.2 硬规则 1「不往 `plans/` 新增设计稿」，故落在 `docs/design/product/`。
> 基准 SHA：开工 `2d5888c7`；本批提交 `f21d3d64`（立项）→ `614baf0e`（C 组撤销）→ `06425bd7`（本稿）→ `702c497c`（丙裁定落地）→ `25809cdf`（Hy4 全天促销策略）→ **`e0704a07`（D4/D10/D11 确认合并，新基线）**。
> **时序说明（作者 2026-11-07 19:5x 补充，复核者必读）**：本批是**先执行、后补计划稿**。作者让另一个窗口「只做计划」，但完整计划方案稿到 `06425bd7`（04:45）才落盘；在此之前 E0 看板对齐、A2 真生成、B/C 派单、C 组撤销已经发生。04:08 批准的是**提案**，不是本稿。**本稿不构成事前授权**；「哪些动作属于本批、兑现到什么程度」一律以 §2 基准快照 + §4 实测读数为准，不从状态行或 §1 的裁决叙述反推。头部 `> 状态：` 描述的是**方案**状态，不是批次执行进度。

---

## 0. 怎么用这份清单（复核者必读）

1. **先读 §2 基准快照**：它固定了「开工前是什么样」。所有「有没有偷偷改范围 / 改判定」都以此为准。
2. **逐行走 §3 验收矩阵**：§3.1 / §3.2 每行六列（编号 / 判据 / 证据路径 / 复核方法 / 执行方自报 / 第三方结论）；§3.3 / §3.4 / §6 的证据写在判据或复核方法列里，只有五列。**最后一列留空是故意的** —— 本稿不替复核者下结论。
3. **判「兑现」只看判据是否被证据满足**，不看「代码写了没」「测试绿了没」。测试绿只证明没打坏原来能用的，不证明该交付的东西交付了。
4. **允许三种复核结论**：`兑现` / `未兑现` / `无法判定（证据缺失）`。第三种必须写清缺哪份证据，不要写成「待作者复验」——实机验证由执行方自己做，只有文风、可读性、剧情接续是否撕裂才留给人。
5. **打回只认两条理由**：① 验收没兑现；② 打坏了原来能用的。风格性返稿不认。

### 0.1 复核前体检（不做会让读数作废）

| # | 做什么 | 为什么 | 怎么确认 |
|---|---|---|---|
| **P1** | 确认证据目录**仍在** | 本稿用于第三方复核，`.batch-a/proj` 副本、`.tmp-ui/a-*.mjs` 脚本、两个 worktree 的 `.batch/*-report.md` **一律保留至复核签核后**；交接稿 §8 已同步为同一口径，两边都不再有「验完清理」 | 在 `develop/` 下执行 `ls -d ../.batch-a/proj ../wt-2/.batch ../wt-3/.batch`（三者均存在）。**别写成 `wt-2/.batch`** —— worktree 与主区同级，不在主区内，实测那样写会 `No such file or directory` |
| **P2** | 确认真实项目未被改动 | 所有真生成都在副本上跑 | `C:\develop\workspace\AI-writer\师父派我来除魔，幕后真凶竟是小师妹` 应为 **391 文件**、`project.db` **13,754,368 字节**；dev 最近项目列表只含真实路径 |
| **P3** | 查库必须用 Electron 的 Node 通道 | 主区 `better_sqlite3.node` 是 Electron ABI（145），普通 `node`（127）会 `ERR_DLOPEN_FAILED`，据此误判「库坏了」 | `ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe <脚本>.mjs` |

### 0.2 受控口径

- **状态词表**：以 [`documentation-charter.md`](../../agents/documentation-charter.md) §5.2 及 `docs/README.md` §3.2-3 为准，本稿**只指路、不复述条目**（章程 §3 单一事实源）；本稿头部用 `已裁定`，按章程含义为「批准了，但没开工」。不新造写法。
- **缺陷图标**：`✅` = 已实施且实机复验过；`🟡` = 代码落地待实机；`🔍` = 已取证待判；`⬜` = 待裁定。**`D3` 在本批结束前不得由 🟡 转 ✅**，判定口径见 §3.2 末尾「A2 总判定口径（硬）」（§4.2 是支撑该判定的实测读数）。
- **级别**只表示「对作者的实际伤害面」，不参与任何拦截逻辑。

---

## 1. 批次来源与裁决

作者 2026-11-07 04:08 原话：「**按照建议来吧，明天星期六，不受免费窗口的限制**」⇒ **甲方案获批**。

**时间口径（豆包审查后订正）**：**墙钟 5~8 小时**，A 与 B/C **并行、工时不相加**（原提案分项相加 6.5~9.5h，与承诺不自洽）。A2 真生成不再抢 08:00 免费窗。

### 1.1 提交作者裁决的三个选项（提案原文）

| 选项 | 内容 | 作者取舍 |
|---|---|---|
| **甲（建议）** | E0 台账卫生 + A 实机收口 + B 界面小缺陷 + C 现成卡增量；能拿到「实机验完 + 4~5 条小缺陷落地 + 看板干净」，代价是 AC2 这类大项继续等 | ✅ **采纳** |
| 乙 | 只做 A 组实机，B/C 都不派；环境最干净，但 5~8 小时空掉一大半 | 未采纳 |
| 丙（提案编号） | 用 P0-1 改稿连锁换掉 C 组；要先定「退回某章并连带回退其后」长什么样，本批大概率变成讨论 | 未采纳。**此「丙」是 04:08 提案的编号，与 §4.5 收口路线的「丙」无关** |

### 1.2 独立审查（豆包，纯文本）与抽查结论

通道在线但工作区固定 `AI-writer-wt-1`（旧快照），**只审清单、明令不读仓库**。2 分钟回 12 条，**8 成立 / 2 部分采纳 / 2 驳回**。抽查已逐条核过，原文见 `.workbuddy/memory/2026-11-07.md` 03:4x 段。

- **已吸收**：时间口径不自洽；**A 组实机期间主工作区必须冻结**；E0 与 A3 循环（D13/D15 的现状正是 A3 要查的）⇒ E0 拆两步；背景写「D3 已实机验证完」与 A2「唯一未覆盖」口径打架；执行方代持了排序权。
- **驳回**（把不同机制串成一条因果）：「A1 必须先于 A2」—— A2 靠卷首范围设到第 7 章触发闸门，不靠来源变化提示；「AC2 会把卷数做成硬约束」—— 那是具名实体引用，与卷数无关。
- **教训**：清单型只读必须抽查；文本判断强、事实与位置偶错。

### 1.3 三条编排规则（不打折扣）

1. **A 组实机期间主工作区冻结**：B/C 只落各自 worktree、验完再合；A 组只读 + CDP，不改主区代码。否则 A1/A2 验的是旧代码。
2. **派单护栏**：① 新规则只告警不阻断（D15 既有裁定）；② 文案以给定定稿为准，不接受风格性返稿。派出去的 agent **只准单元测试**，实机验证不派。
3. **换身份复核**：干完只交复核，不自行 `done`；`review` 拒同身份自审。改代码与改台账同一提交，提交前 `check:fast` 由 pre-commit 自动跑。

### 1.4 作者裁定「丙」＝拆批（2026-11-07 19:19，原话「那就丙」）

B 组换身份独立复核（`agent-r1`，报告 `wt-2/.batch/b-review.md` 332 行）判出 **D9 / D16 两条「验收没兑现」**，且补做都要动真实生成链路（结构性改动）；执行方「5 条全交付」的口径不成立。复核同时确认**没有打坏原来能用的**。三条路线与逐项产品后果见 §4.5，作者取丙。

| 项 | 本批处置 | 下一批处置 |
|---|---|---|
| **D4 / D10 / D11** | **收**：独立复核兑现（仅单测级，改动仍在 `wt-2`、未合并主区） | 第三方签核后合并 + 同步 3 处 browser 断言 + 实机复验 |
| **D9 / D16** | **不收**：打回，缺陷稿保持 ⬜、不销账 | 另开一批专做结构设计：先定挂点 / 事实源，再动代码 |
| A1 / A2-1·2·6 | 原样登记为遗留（无变化） | **下一批 A 组实机补做**：① A1 在副本跑「正文批量同 run 连续 3 次生成」并贴原始日志逐次数 `*_SOURCE_CHANGED`；② A2-6 在 CDP 调 `readOutlineProgressGate({projectSession, chapterNumber: 7})` 并核对生成请求的 `chapterNumber`，逐条排除 §4.2 四条候选；③ A2-1 / A2-2 随 A2-6 结论决定是否补验。逐项前置见 **§7.1** |

**丙使本批满足 §7 收口定义的第二分支**（未兑现项已明确登记为遗留并写出下一批处置），不是靠「整批通过」掩盖。

**本批不动 `wt-2` 代码**：§3.3 的复核方法要求 `git -C wt-2 diff` 看到原始改动，且 5 条改动混在同一批文件里（`StatusBar.tsx` / `generation-runtime.ts` / `generation-run-timeout.ts` 等属 D16），签核前拆分合并会同时破坏证据与 A 组基准。证据按 §5.3 保留至签核后。

---

## 2. 开工前基准快照

| 项 | 开工前读数 | 证据 |
|---|---|---|
| 缺陷稿现值 | **✅7 / 🟡7 / 🔍1 / ⬜5**（20 条）；严重度 高5 / 中9 / 低4 / 阻塞2 | `live-pipeline-acceptance-defects-assessment.md` 头部现值行与 §2 表格 |
| 任务看板 | 26 张 `todo`，其中 D2/D3/D6/D8/D12/D13/D15/D18 对应缺陷其实已实施或已验 | `dsh-task-board.mjs list --json` |
| 代码 | 主区 `exp/resource-ledger` @ `2d5888c7`；`wt-1/2/3` 落后 66 提交、可 fast-forward、工作区干净 | `git worktree list` / `git -C wt-N status --short` |
| 环境 | `5180` 的 dev 于 03:46 由**系统终端手动启动**、无 CDP 口（父进程 `WindowsTerminal.exe`）⇒ 很可能是作者正在用的 APP | 进程链；`netstat` |
| 真实项目 | 391 文件，`project.db` 13,754,368 字节 | `find` / `ls -la` |

### 2.1 不进本批（写清原因，避免下次又想起）

| 项 | 为什么本批不排 | 前置 |
|---|---|---|
| A-1.3 干预对照 | 需真实生成链路 + 干预手段裁定 | 作者裁定 |
| W7b 卷切片 / W7c 本章规则子集 | 跨部切片契约未定 | 作者裁定 |
| **P0-1 改稿连锁** | 300 章场景核心，但要先定「退回某章并连带回退其后」长什么样 | 作者裁定 |
| P20-3 章末后处理期 3 / D18-① 全环节输入材料筛查 / O1 按弧分批 | 双端硬契约或范围未解 | 作者裁定 |
| `4027dbef` AC2 · `bb3f0d83` 扩大 preflight | 判据未定（具名实体边界 / 规则集范围），上一轮已按甲方案砍掉 | 判据 |
| `744f13a8` C1 剩余两项 | 卡自己要求「补浏览器测试」⇒ 撞 worktree 禁 browser 红线；且要先确认原始设计定义 | 判据 |

> **优先级不代持**：放进「待裁定」只表示本批不排，不代表替作者定长期轻重。

### 2.2 相对提案的变更记录（第三方会问「为什么和原计划不一样」）

| # | 变更 | 原因 | 留痕 |
|---|---|---|---|
| V1 | **C 组撤销派单，代码零改动** | 卡 `861ab163` 上一轮已由 `4767e9dc` 实施；派单前只看了卡的 prompt 文本、漏查历史实施 commit 及其裁定原文 | 本稿 §3.4；交接稿 §5；提交 `614baf0e` |
| V2 | A 组从「主工作区」改走 **wt-1 槽位 1**（5181 + CDP 9223） | 作者 5180 dev 不能碰；「复用 5180 + 第二 Electron 实例」被 `main.ts:100` 单实例锁否决（1 秒退出） | 交接稿 §1 |
| V3 | E0 由「8 张卡标完成」改为精确对齐 | 卡与缺陷稿不是一一对应：D1/D12 本就是真待办、D6/D8 是有意留痕卡 | 本稿 §3.1 |
| V4 | **证据目录保留、不清**（交接稿 §8 已同步为同一口径） | 本稿用于第三方复核 | 本稿 §0.1 P1 / §5.3 |
| V5 | **作者裁「丙」拆批**：本批只收 D4/D10/D11，D9/D16 结转下一批 | 换身份复核判出 D9/D16 两条「验收没兑现」，且补做属结构性改动，按「结构设计先讨论再落地」不能在本批补做 | 本稿 §1.4 / §3.3 / §4.5 / §7；缺陷稿现值行；[`2026-11-07-d9-d16-structural-design-handoff.md`](../../handoffs/2026-11-07-d9-d16-structural-design-handoff.md) |

---

## 3. 验收矩阵（核心）

> 「执行方自报」是事实与证据位置，不是结论；「第三方结论」列请填 `兑现` / `未兑现` / `无法判定（缺…）`。

### 3.1 E0 台账卫生

| # | 判据（可判） | 证据路径 | 复核方法 | 执行方自报 | 第三方结论 |
|---|---|---|---|---|---|
| E0-1 | 4 张卡首有 2026-11-07 落地说明，含提交号 + 缺陷稿图标 | `afa8c5fc` D2 / `34ca71dd` D3 / `d8371b26` D5 / `2b7eb20d` D18 | `dsh-task-board.mjs get <全 UUID>` 看 description 首行 | 已写；`get` 复核通过 | — |
| E0-2 | `7d7ec549` D13 带词表内已有标签 `需实机` | 同卡 `tags` | `get` 输出 `I2, 需实机` | 已加 | — |
| E0-3 | `61ac055f` D15 卡首标注「实际方向 = 检出告警，非落库前互斥校验」 | 同卡 description | `get` | 已写 | — |
| E0-4 | `9e5187ed` D1 / `c9f56ff9` D12 / `a6c3e2df` D6 / `4b9eae6e` D8 **零改动**；不新建卡、不改 `status`、不自造标签 | 看板 revision | `list --json` 逐张比 | 零改动 | — |
| E0-5 | `861ab163` 对齐为「已实施 · 勿重复认领」 | 卡首 | `get`（V1 后新增，见 §3.4） | 已写 | — |

> 坑（复核者别被误导）：`update --dry-run` **并不预演**，第一次调用即写盘，第二次返回 `unchanged`；用旧快照做校验会全是假阴性，必须重新 `get`。`list` 只显示 8 位前缀，`get` 要完整 UUID（`list --json` 取）。

### 3.2 A 组（主 agent，CDP 真点 APP，不派）

| # | 判据（可判） | 证据路径 | 复核方法 | 执行方自报 | 第三方结论 |
|---|---|---|---|---|---|
| **A1** | 正文批量「同 run 连续 3 次生成」全成功；任务日志里 `*_SOURCE_CHANGED` **0 次**（出处 `agent-generation-client.ts:33`、`generate-draft.command.ts:1018`、`finalization-generation.ts:41`） | 任务日志 + `generation_runs` | 贴原始日志片段并逐次数 | **🟡 已推进到「任务已发起、被上游失效保护拦下」**（2026-11-07 23:0x）。前置障碍两只：① **中间章蓝图不可补**（`frozenAppendStart = max(最高蓝图+1, 权威下一章)`，副本最高蓝图是孤立的 17 章 ⇒ 起点被推到 18，13–16 章永久不可生成；清掉第 17 章后 13/14 章蓝图一次生成成功）；② 生成 13/14 章蓝图把情节大纲推到第 22 版 ⇒ 第 12 章章节卡被判「基于旧大纲」，批量创作**在准备阶段即失败**（`64920a1a`，`attempts=0`、无候选，界面原文「已经改过了，请先核对这张卡再批量创作」）⇒ **不是 `SOURCE_CHANGED`**。下一步走「同步」清点页核对后才能重跑。详见 §7.1.1。**23:00–23:37 补做后仍未兑现**：stale 已按「同步页 → 去处置 → 保存」清干净（情节大纲 v24），批量真正跑起来了 —— 第 12 章一次成功（1583 字入库），第 13 章被 `DRAFT_PREVIOUS_ENDING_REPLAY` 挡下，止步 `1/3`；`*_SOURCE_CHANGED` 四次 run 全部 **0 次**但链条没跑完，**不判通过**。详见 §7.1.2 |
| **A2-1** | 卷首 `handoff-missing` 档弹出（`[data-testid="outline-progress-gate"]` 非空且文案为「没登记交接单」） | DOM 文本 / 截图 | 见 §5.2 复现步骤 | **未兑现**：闸门为 `null` | — |
| **A2-2** | 点「我知道，仍按计划继续」写入豁免 `outline-progress:volume:1` | 副本 `consistency_exemptions` | 查库 | **未兑现**：未出现该键（现有 `outline-progress:volume:3` 是历史值） | — |
| **A2-3** | **真起 run 并产出情节大纲，产物落库** | `generation_runs` + `generation_artifacts` | 查库（§0.1 P3） | **兑现**：`f85becbd…` `running`→`completed`；6 条产物（第 7–12 章，text 744/847/1034/1121/850/889 字） | — |
| **A2-4** | 产物来源字段与当前稿一致 | artifact 的 `fingerprint` / `revision` / `textHash` | 查库 | **部分**：产物有 `fingerprint`/`revision`/`textHash` 且 6 条齐；「与当前稿一致」未做逐字段比对 | — |
| **A2-5** | 贴 `generation_runs` / `generation_attempts` 前后计数 | 查库输出 | 复跑查询 | **兑现**：runs 137→138、attempts +6（详见 §4.2） | — |
| **A2-6** | 查清 D3 闸门为何没弹 | 交接稿 §3.1 四条候选 | 在 CDP 里调 `readOutlineProgressGate({projectSession, chapterNumber: 7})` 看返回，并核对生成请求里的 `chapterNumber` | **未查**（候选已列、未验证） | — |
| **A3-1** | D5 模板侧 + 机检侧两侧闭环，产出侧标「需实机」 | `architecture.command.ts:3228–3236` `findAngleBracketPlaceholders()` 只 `callbacks.log` 不阻断 | 读代码 | **兑现** | — |
| **A3-2** | D13 结论「缺的是实机复验不是代码」 | 缺陷稿 §2 表格 **D13 行**（第 62 行）/ 正文 **§769**、`959a3647` + `3f954431`（原写「§749 / 第 60 行」指向的是 D12，已订正） | 读文档 | **兑现** | — |
| **A3-3** | D15 告警已被 UI 消费，且口径为「检出告警」非「落库前拦下」 | `volume-structure.ts:185` → `VolumeHandoffRegistryPanel.tsx:252/266/292` → `summarizeVolumeWarnings()` | 读代码链路 | **兑现**（`VOLUME_UNIT_OVERLAP` 归为同因不重复计数，由 `AMBIGUOUS` 成句） | — |

> **A2 总判定口径（硬）**：A2-1 / A2-2 未兑现、A2-6 未查 ⇒ **A2 只算「真生成已起并完成」，不算 D3 的「点继续后」路径已验完**；不得据此把 D3 由 🟡 转 ✅。

### 3.3 B 组（派单，只准单元测试）

> **本表口径（复核前先读）**：① 「执行方自报 + 换身份复核结果」一列是**事实与证据位置**，其中「部分 / 基本兑现 / 兑现（机制级）/ 打回」是 `agent-b1` 与 `agent-r1` 的描述用语，**不是** §0 第 4 条的三种复核结论；第三方仍须在最后一列填受控词。② 涉及「偏差 / 未闭环」的项一律登记为待裁定或遗留，执行方不做「打回 / 不打回」的裁定（AGENTS.md 硬规则 9：打回只认 `unmet` / `regression`）。

| # | 判据（写死，不许「先取证再定」） | 复核方法 | 执行方自报 + 换身份复核结果（**均非第三方结论**） | 第三方结论 |
|---|---|---|---|---|
| **B1 D4** | 同一份 `sourceStatus='conflict'` 同时驱动**产物层**（这一稿不能保存、仍可复制）与**批次层**（后续单元不再执行、需重新发起）两条并列文案；判据按 **`sourceStatus` 驱动的接线点**计（实际 8 处），组件单测断言两条**同时出现**且「仅可复制」语义不丢。**判据已于 20:4x 自我订正**：原写「6 处文案定位见交接稿 §4」，而交接稿 §4 实际列 **8 个位置**（「6 处」是计数笔误），其中 2 处 —— `VersionHistory.tsx:281`（`ver.dependencies_stale`，历史版本依赖过期徽标）与 `ArchFileViewer.tsx:1071`（`writeState.kind==='blocked'`，写盘被阻塞）——原因不同、原文案已分别含「草稿会保留／仍可编辑和复制」语义，**不属本缺陷、也不应硬套 `sourceStatus`**（会让用户看到错误原因）。判据按「`sourceStatus` 驱动的接线点」计（8 处）成立，不需提请裁定 | `git -C wt-2 diff` + 跑对应单测 | **自报兑现**：8 处 `sourceStatus` 接线全覆盖、单一事实源产出两条并列文案、`SourceConflictNotice.test.tsx:12-22` 断言同现且「仍可复制」不丢。**20:3x 已合并主区 `e0704a07`，4 处 browser 旧断言同步完成**（原清单 3 处 + `:278` 恢复路径 1 处） | — |
| **B2 D9** | 超时上限**默认 10 分钟且可配置**；假时钟单测三态 `生成中→超时已中止→调用失败`；超时中止复用 D2 失败终态落库，`generation_runs` 不留 `running`/`paused` | 同上 | **未兑现（打回）**：`createSingleCallWatchdog` / `finalizeFailedGeneration` 生产零调用点（孤立死代码），真实超时不可达；单测三态是测试手工拼的 `onTimeout→finalizeFailedGeneration`，不能替代真实链路。**已结转下一批（丙）** | — |
| **B3 D10** | 清空补渲染侧重置钩子（单测断言被调用）+ 回执报三档各清了几类各多少条；回执计数与 DB 删除计数一致；**不要求 browser 测试** | 同上 | **兑现（机制级）**：钩子被单测断言、三档回执、内存 SQLite `rows===before-after`、`clearProjectData` 返回值保持 `{cleared}`；但 `PROJECT_DATA_CLEARED` 生产订阅方为零、残留卡片宿主未定位 ⇒ 现象未闭环，登记为遗留 | — |
| **B4 D11** | 去重键改为**卷**（`volumeIndex` + 该卷大纲定稿态），不再用 `architecture-character-nudge.ts:112` 的 `c<覆盖数>:l<正文长度>`；单测同卷连续 3 批只弹 1 次、跨卷弹第 2 次 | 同上 | **自报基本兑现**：卷级 `v<卷>:<wip\|final>` 替换旧 `c…:l…`、两处调用点全改、同卷 3 批 / 跨卷第 2 次 / 指纹单测齐；偏差 = 定稿态用 `chain.status` 投影、未直读 `synopsis_incomplete`，**已登记为待裁定项** | — |
| **B5 D16** | 状态栏读**实际调用事实源**（`generation_attempts` / `generation_runs` 的 `model` 字段，字段名写死在报告里），不读配置当前选中值；单测构造「配置 A / 实际 B」⇒ 断言显示 B | 同上 | **未兑现（打回）**：字面「配置 A / 实际 B ⇒ 显示 B」兑现，但事实源是渲染期 lease + 内存 store（不落库）、重启回退配置、正文生成主链路（main-owned）不写快照、删掉 `generation-runtime.ts:409` 单测仍全绿。**已结转下一批（丙）** | — |
| **B0 共同** | 只跑单测，禁 `pnpm test:node` / browser / 全量；不 commit / push / merge；结果落盘 `wt-2/.batch/b-report.md`；不自行宣布完成 | 看 `git status`、报告文件、命令原始输出 | **兑现**：只跑单测、禁项未犯、结果落盘、未自行宣布完成；复核者独立复跑 11 文件 80 例全绿 | — |

> **独立复核**：`wt-2/.batch/b-review.md`（332 行，`agent-r1` 与执行方 `agent-b1` 不同身份）。打回只认两条理由 —— 本次是 D9/D16「验收没兑现」，**没有「打坏原来能用的」**（无新增 throw/拦截、prompt 模板零改动、既有回归全绿）。`check:fast` 在 wt-2 报 EXIT=1 经复核取证为 HEAD 既有的 worktree 断链（`p11-plan-validity-and-fact-registry-design.md:163` 指向主区私有 `.workbuddy`），主区同口径全绿，非本批引入。
>
> **合并时已同步（2026-11-07 20:3x，随 `e0704a07`）**：① **4 处** browser 旧文案断言（`CodeMirrorEditor-generation.browser.tsx:331` / `:278`、`AIOutputPanel.main-recovery.browser.tsx:144/:374`）；② **D4 判据已自我订正（20:4x）**：原「6 处」是把「提到过来源变化的位置」混算进来 —— `VersionHistory.tsx:281`（`ver.dependencies_stale`，历史版本依赖过期徽标，原文案已含「草稿会保留」）与 `ArchFileViewer.tsx:1071`（`writeState.kind==='blocked'`，写盘被阻塞，原文案已含「仍可编辑和复制」）**原因不同、不属本缺陷**，不应硬套 `sourceStatus`。判据按「`sourceStatus` 驱动的接线点」计（实际 8 处），**成立、无需裁定**。**③ 已于 19:2x 落地**：缺陷稿现值行与 §2 表格已按 3 兑现 / 2 打回写成 `✅7 / 🟡10 / 🔍1 / ⬜2`，没有 5 条全标 ✅；此条仅留作核对点，不再列为待办。
>
> **看板 5 张卡仍为 `todo`（20:4x 现状，待第三方签核后同步）**：代码已于 20:3x 合并主区 `e0704a07`，**台账现已落后于代码**（此前是「台账不领先于代码」）。D4/D10/D11 三张卡签核后应转 `review`，D9/D16 维持 `todo`。此处如实登记落差，不自行改卡 —— 看板写入按通道规则由主控在签核后统一录。

> **worktree 固有基线（别误判为执行方打坏）**：`pnpm check:fast` 在 wt-2/wt-3 会因 `docs/design/architecture/p11-plan-validity-and-fact-registry-design.md:163` 指向 `../../../.workbuddy/memory/notes/data-and-schema.md` 报 **broken 1 / EXIT=1**；worktree 未同步本地私有目录 ⇒ 必断，主区可过。执行方已用 `git stash` 做纯 HEAD 同口径对照证明与改动无关，stash 均已 pop。**复核者应在主区跑 `check:fast`，或接受该基线说明。**

### 3.4 C 组（撤销项，也要验「确实零改动」）

| # | 判据 | 复核方法 | 执行方自报 | 第三方结论 |
|---|---|---|---|---|
| C-1 | `wt-3` **tracked 零改动、无提交**，`git diff` 为空 | `git -C wt-3 status --short` | **兑现**：只剩 `?? .batch/`，`git restore` 已撤销两个 `.ts` 改动 | — |
| C-2 | 取证报告落盘，含 `4767e9dc` 裁定原文、两条消费路径、不采纳 B 的理由、裁定后收口节 | `wt-3/.batch/c-report.md` | **兑现**：实测 **24,191 字节 / 15,708 字符 / 293 行**（原写「8,104 字节」为误记，按 `stat` + UTF-8 计数订正），§6 收口写明「撤销派单、代码零改动、无提交」 | — |
| C-3 | 卡 `861ab163` 已对齐「已实施」 | 看板 `get` | **兑现**（E0-5） | — |
| C-4 | 证据支撑：两条消费路径确实在生产代码里 | `generate-draft.command.ts:1175` `shortOutlineSegmentBudget(...)`、`:1398` `keyEventCharTargetsText(...)`；定义 `blueprint-key-events.ts:254` | 已核 | — |

> **为何撤销**（第三方会问「C 组为什么没交付」）：`4767e9dc` 的 commit message 明确裁定「本卡**不能**按原描述直接改 `keyEventsText`」「真正缺的是降级路径」「`toWriterChapterInfo` 不动（参与 resume 指纹）」。按原任务书重做会推翻上一轮裁定、打坏恢复句柄（`AUTHOR_INPUT_CHANGED`）与 `{{chapter_info}}` 去重不变量，且无新产品理由。连「零争议 shared 增量」也停了 —— 无人调用的选项是死代码，且与已有 `keyEventCharTargetsText()` 形成两个功能重叠的格式化函数。

---

## 4. 实测读数（执行方自报，原始输出摘录）

### 4.1 E0
`updated 861ab163-…: description` / `tagged 7d7ec549-…: I2, 需实机`；5 张卡 `get` 复核首行均为「【2026-11-07 台账对齐…】」。

### 4.2 A2 真生成（副本 `.batch-a/proj`）

```
generation_runs  137 → 138
f85becbd-e4f4-453b-83c2-785b67ad7436   status: running → completed
generation_attempts  +6（attempt_id 均以 run_id 归属该 run）
generation_artifacts  6 条，text 为「## 第7章」…「## 第12章」
  长度 744 / 847 / 1034 / 1121 / 850 / 889
页面：100% · 已完成 · 整个工作流已全部完成 · 情节大纲已生成
状态栏模型：deepseek-均衡
upstream_revision_log 最新仍 rev=21（2026-11-06 20:33:42），本次未 bump
  ⇒ 生成产物已落库，大纲修订尚未提交（候选态）
```

**过程事实**：范围手填 7–12；`synopsisUnitMode` true→false；点「确认生成」后**先弹 D20 上游失效清单**（「我明白这会波及 2 章已定稿正文」），勾确认 + 点「继续」**直接起 run**，`[data-testid="outline-progress-gate"]` 为 `null`。

**闸门未弹的四条候选（未验证，不许先定结论）**：① 实际提交的 `chapterNumber` 不是 7；② `readOutlineProgressGate` 在副本读失败 ⇒ `gate=null` fail-open；③ `volumeRangeEndingAt(volumes, 6)` 的 `range.last` 为 null ⇒ 不判；④ 已有确认 `outline-progress:volume:3` 命中了另一个卷。已知调用点 `ArchitectureConfirmDialog.tsx:505–512`（`checked.synopsis && !bypassProgressGate.current` 时才跑，入参 `resolution.range?.from`）。

**代码静态取证（19:5x，只读； narrowing 范围，不等于 A2-6 已验证）**：闸门 1（`progressGate`）在代码里**排在闸门 2（D20 失效清单）之前**，且只在 `gate?.state === 'ahead'` 时 `setProgressGate(gate); return`。现场却走到了闸门 2 并直接起 run ⇒ 当次 `readOutlineProgressGate` 返回的是 `gate=null`（fail-open）或 `state='aligned'`，**不是 `ahead`**；候选 ②③④ 都落在「算出 aligned」这一支，① 另多一种 `chapterNumber === undefined` 导致整段闸门被跳过。**新排除一条**：`bypassProgressGate.current = true` 只出现在 D3 面板自己的「仍按计划继续」回调（`:1033`），两个闸门都过后 `:541` 重置为 false，取消勾选时 `:406` 也重置 ⇒ **不是上一次确认残留的 bypass 把闸门跳过了**。以上只是代码级定位，四条候选仍须按 §7.1 在 CDP 里逐条验证才能定论，**D3 仍不得转 ✅**。

#### 4.2.1 A2-6 实测读数（2026-11-07 21:5x，已执行）

环境：主工作区 `develop` 起 dev（5180 / CDP 9222），进入副本 `.batch-a/proj`；闸门函数原本未挂 `window`，本轮新增 dev-only 探针 `window.__outlineProgressGateProbe(chapterNumber)`（`src/services/outline-progress-gate-probe.ts`，内部**只转发**真实 `readOutlineProgressGate`，不复制判定逻辑）。

```
chapterNumber= 7 → gate=null  warning="卷结构状态为 stale，本次不判"
chapterNumber=11 → gate=null  同上
chapterNumber=12 → gate=null  同上
chapterNumber=16 → gate=null  同上
chapterNumber=21 → gate=null  同上
chapterNumber=26 → gate=null  同上
debug: volumesState='stale'
       authority={ status:'continuous', lastChapterNumber:11 }
       acknowledgedKeys=['outline-progress:volume:3','volume-handoff:volume:2']
       handoffEntries=1 · 6 卷全部 source='outline' / outlineHash=93bf2ce8…
```

| 候选 | 结论 | 依据 |
|---|---|---|
| ① 提交的 `chapterNumber` 不是 7 | **不能排除，但已不再是关键** | 即便按 7 传，返回仍是 `null`（见下行） |
| ② 读失败 / 降级 ⇒ fail-open | **✅ 成立，而且是恒久状态、不是偶发** | `volumesState='stale'` ⇒ `outline-progress-gate.ts:92-95` 在 `volumeState !== 'ready' && volumeState !== 'empty'` 处直接 `return { gate: null }` ⇒ **两维判据一行都没执行** |
| ③ `volumeRangeEndingAt` 的 `range.last` 为 null | 不成立（未走到） | 没进 `outlineProgressGateOf` |
| ④ 已有确认 `outline-progress:volume:3` 命中 | 不成立（未走到） | 同上；且第 7 章对应 `volume:2`，键也不同 |

**stale 是怎么来的**（`electron/repositories/volume-structure-repository.ts:151`）：

```ts
const stale = volumes.some(volume => volume.source === 'outline' && volume.outlineHash !== outlineHash)
```

本副本 6 卷全部 `source='outline'`、`outlineHash` 同为 `93bf2ce8…`，与当前大纲 hash 不符 ⇒ **作者只要改过一次大纲，卷表就变 `stale`，闸门就从那一刻起永久放行，直到手动点「重建卷结构」**。

**因此这是一条独立缺陷，不能记成「D3 复验失败」**：D3 的第二维修正（`handoffAvailabilityOf` 五态）确实写对了，但它住在一个「stale 即短路」的入口后面，等于从未被触发过。建议单独立项（暂记 **D21 · 闸门被卷结构 stale 短路**），并保持 **D3 不得转 ✅**。

> **2026-11-09 取证回填**：本条已由只读取证坐实，见 [`d21-gate-shortcircuit-evidence-20261109.md`](d21-gate-shortcircuit-evidence-20261109.md)。三点口径更正：短路段在 `src/services/outline-progress-gate.ts:92-95`（不在 `shared/` 的纯判定函数里）· 交接单确实已读回、只是被短路丢弃 · 实际后果是**静默放行**（`ArchitectureConfirmDialog.tsx:509-512` 只 `console.warn`，界面零提示）。落地卡在单测 `src/services/__tests__/outline-progress-gate.test.ts:154-165`（把短路固化成「判不出就不拦」的断言）。

> 时序如实说明：本副本 19:5x 刚跑过 A2 批量生成（大纲被重写），`stale` 可能正是那次造成的。但「改大纲 ⇒ 卷表 stale ⇒ 闸门失效」这条因果与时序无关 —— 它每次改大纲都会成立。要区分「本来 stale」与「A2 之后 stale」，需要在未跑生成的新副本上再取一次读数（未做）。

### 4.3 A3 / E0 / C 组
见 §3.1 / §3.2 / §3.4 的「执行方自报」列，均为只读核对或看板写入，无代码改动。

### 4.4 B 组（已交付 + 已换身份复核）

- 执行方 `agent-b1` 耗时 51m29s，`wt-2/.batch/b-report.md`（371 行）落盘；`npx tsc --noEmit` EXIT=0、受影响单测 10 文件 68 例全绿。
- 独立复核 `agent-r1` 耗时 19m8s，`wt-2/.batch/b-review.md`（332 行）落盘；自跑 11 文件 80 例全绿。HEAD 仍 `2d5888c7`、无 commit / push / merge、未改生产代码。
- `wt-2` 改动：13 个 tracked 改动 + 新增文件（含 `.batch/`），5 条缺陷的改动混在同一批文件里；本批按丙**不合并**，理由见 §1.4。
- 逐条结论见 §3.3：**3 兑现（D4/D10/D11）/ 2 打回（D9/D16）**，打回理由均为「验收没兑现」。

### 4.5 丙裁定的三条路线与产品后果（第三方会问「为什么和原计划不一样」）

> **编号消歧（必读）**：本表的甲 / 乙 / 丙是 **19:19 收口阶段新起的三条路线**，与 §1.1 那份 04:08 提案的三个选项**不是同一组编号**。作者 19:19 原话「那就丙」取的是**本表**的丙（拆批）；§1.1 的丙早在 04:08 就标了「未采纳」。头部状态行、§1.4、§7 里的「丙」一律按本表读。

| 路线 | 产品后果 | 代价 |
|---|---|---|
| 甲 · 现在交第三方复核（冻结现状） | 基准不漂移、复核立刻能开始；但结论会是「一半没兑现」（A1 未跑、A2-1/2/6 未兑现、D9/D16 未兑现、3 处断言未同步），且 D9/D16 都标「结构性改动需先裁定」⇒ 第三方只能判「无法收口」 | 之后补做要出增补清单，同一批被判两次 |
| 乙 · 先补到产品行为真变了再交 | 10 分钟挂起会明确显示「已超时中止」并能重发；重启后状态栏仍显示实际用过的模型 | 两项都要动真实生成链路（D9 挂哪层、会不会和 D2 租约互抢；D16 何时写快照、main-owned 链路不经过现有写入点）；清单会改、基准漂移、复核后移 |
| **丙 · 拆批（作者采纳）** | 本批干净收口，第三方能判「部分兑现 + 遗留已登记」；两个现象继续存在，但不会为赶本批就在没裁定时动生成状态机 | 多一轮派单与复核；缺陷稿 D9/D16 保持 ⬜ 不销账 |

**取丙的关键理由**：乙要动的正是 A 组还没验完的那条生成链路（D3 闸门没弹的原因也还没查清），两件事叠在同一条链路上会让 A2 的基准跟着变。

---

## 5. 环境与数据安全（供第三方复现）

### 5.1 本批实际起法（成功）

```bash
# 在 wt-1（已 fast-forward 到 2d5888c7）
node scripts/prepare-native-for-electron.mjs
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  AI_NOVEL_WORKTREE_SLOT=1 \
  AI_NOVEL_SMOKE_OPEN_PROJECT='C:\develop\workspace\AI-writer\.batch-a\proj' \
  AI_NOVEL_SMOKE_PROJECT_MARKER='C:\develop\workspace\AI-writer\wt-1\.batch\a-marker.json' \
  node node_modules/vite/bin/vite.js
```

⇒ dev `5181` 返回 200、CDP `9223` 返回 `Chrome/146`；**作者 `5180` 全程未受影响**。槽位表 `vite.config.ts:42`（5181/9223、5182/9224、5183/9225）。

**不要走的路**：复用 5180 + 另起带 `--remote-debugging-port=9222` 和独立 `--user-data-dir` 的 Electron 实例 ⇒ 1 秒退出、9222 无监听、user-data 目录未创建；根因 `electron/main.ts:100` `configureSingleInstanceRuntime` 拿不到锁直接 `quit()`。

### 5.2 打开副本与触发闸门（复现 A2）

1. `project:smoke-open-request` 拿回主进程里的 `projectPath` **原样**传给 `openProject()`（授权是严格字符串相等，别手拼反斜杠路径）。
2. 副本 `project.db-shm` 于 04:23 新建 ⇒ 打开的确是副本。
3. `config:set { synopsisUnitMode: false }`；范围填起始 7 / 结束 12；点「确认生成」。
4. 若弹 D20 失效清单，勾「我明白这会波及 2 章已定稿正文」+ 点「继续」。
5. 观察 `[data-testid="outline-progress-gate"]`，并查库核对 run / artifacts。

### 5.3 副本重建与证据清单（**不清，保留至签核后**）

| 路径 | 用途 |
|---|---|
| `C:\develop\workspace\AI-writer\.batch-a\proj` | A 组实机副本（391 文件，从真实项目复制，`projectId` 改为独立 `11111111-2222-4333-8444-555555555555`） |
| `develop\.tmp-ui\lib.mjs` / `a-step1..4.mjs` / `a-status.mjs` / `a-verify.mjs` / `a-artifact.mjs` | CDP 驱动与查库脚本（`AI_NOVEL_CDP_PORT=9223`） |
| `wt-2\.batch\b-report.md` / `wt-3\.batch\c-report.md` | 派单报告 |
| `.workbuddy\memory\2026-11-07.md` | 现场日志（**03:35 起各段**，含 03:40–03:5x 豆包审查、04:08 立项、04:3x C 组撤销、19:19 丙裁定） |

> **§0.1 P1 与交接稿 §8 口径一致**：交接稿 §8 已同步为「副本与证据目录保留至第三方签核后」，两边都不再清理；第三方复核需要这些证据，签核前不得删除。

---

## 6. 红线检查表（第三方逐条打勾）

| # | 红线 | 复核方法 | 第三方结论 |
|---|---|---|---|
| R1 | 实机验证由执行方自己做，不写成「作者实机 / 待作者复验」 | §3.2 各行「执行方自报」 | — |
| R2 | 派出去的 agent 只准单元测试；worktree 禁 `pnpm test:node` / browser / 全量 | 两份报告的命令原始输出 | — |
| R3 | 新规则**只告警不阻断**；不把卷数/章数做成硬约束 | `git diff` 里有无新增 throw / 拦截 | — |
| R4 | 改代码同提交同步设计稿/台账；`check:fast` 由 pre-commit 跑 | `git log` + 提交输出 | — |
| R5 | 完成需换身份复核，不许自己 `done` | 看板 `review` 记录与 `handedBy` | — |
| R6 | 状态行、§2 表格、顶部分布段逐处 grep 核对（状态写在多处 ≠ 读者会看到） | 比缺陷稿**现值行（第 5 行）+ §2 表格对应行 + 各条目 `> 状态：` 行**；头部已注明「本节以下各段均为历史快照，以本行为准」，其余历史分布段**不参与**核对，别把快照判成未同步 | — |
| R7 | 真实项目零改动 | §0.1 P2 | — |
| R8 | 不自己创造概念、不自己制造判据；先查行业定义与既有标准 | §1.2 / §2.1 / §3.4 | — |

---

## 7. 收口定义与签核

**本批可判「收口」的条件**：§3 全部行第三方结论为 `兑现`，或 `未兑现` 项已明确登记为遗留并写出下一批处置；§6 无违反；§5.3 证据完整。

> **2026-11-07 丙裁定后**：本批走的是**第二分支** —— A1 / A2-1·2·6 / D9 / D16 均已登记为遗留，下一批动作见 **§7.1**（原写「§1.4 / §4.5 / 下一批立项稿」：其中 §4.5 是路线后果、下一批立项稿只覆盖 D9/D16，都不构成 A 组的处置，已更正）。不是「整批通过」；这是作者裁定，不是执行方自判；第三方仍须逐条核对登记是否属实。

| 角色 | 姓名 / 身份 | 日期 | 结论 | 备注 |
|---|---|---|---|---|
| 执行方自报 | 主 agent | 2026-11-07 | 见 §4 | A1 未跑；A2-1/2/6 未兑现；B 组 3 兑现 / 2 打回（已换身份复核） |
| 换身份复核 | `agent-r1` | 2026-11-07 | 见 §3.3 / §4.4 | D9/D16 判「未兑现」；无「打坏原来能用的」 |
| 作者裁定 | 作者 | 2026-11-07 | **丙（拆批）** | 见 §1.4 / §4.5；D9/D16 结转下一批 |
| **确认提交** | 主 agent | 2026-11-07 20:3x | **D4/D10/D11 已并入主区 `e0704a07`** | 文件级拆分，18 文件；D9/D16 的 10 个文件原样留在 `wt-2`。单测 39 例 / `tsc` EXIT=0 / `check:fast` 全绿；4 处 browser 旧断言已同步。**新基线 = `e0704a07`** |
| 独立复核（第三方） | （填写） | — | — | 逐条填 §3 / §6 最后一列；对遗留项决定「补做 / 结转 / 结项」 |

> **已知未兑现 / 遗留项不得被「整批通过」掩盖**：A1（未跑）、A2-1 / A2-2 / A2-6（闸门未弹且原因未查）、D9 / D16（复核打回，已结转）、D10 现象未闭环、D11 定稿态取法（待裁定）。**20:3x 更新**：B 组 4 处 browser 断言已随合并同步（原写「3 处待同步」，实测第 4 处为 `CodeMirrorEditor-generation.browser.tsx:278` 恢复路径）；D4/D10/D11 状态由「改动在 `wt-2`」改为「已并入主区 `e0704a07`」。

### 7.1 遗留项 → 下一批动作（状态同步，2026-11-07 19:5x）

> 把「已登记为遗留」写实到「下一批具体做什么」，替代原 §1.4 那句「按 §7 由作者决定」的循环引用。**不改判据、不改作者 19:19 的丙裁定、不虚报已执行**；「已执行 / 未执行」的分界以 §4 实测读数为准。

| 遗留项 | 现状（属实） | 下一批动作 | 前置 / 本批不做的理由 |
|---|---|---|---|
| **A1** | 🟡 **已跑起来但未兑现（2026-11-07 23:00–23:37）**：stale 已按「同步 → 去处置 → 保存」清干净（情节大纲 v24），卷末交接单也已重存；批量四次尝试中，第 12 章一次成功（`drafts` ch12 v1 / 1583 字），第 13 章被 `DRAFT_PREVIOUS_ENDING_REPLAY` 挡下，止步 `1/3`；`*_SOURCE_CHANGED` **0 次** | 待 D12 处置后重跑；并先解决「第 1 章成功 + 第 2 章失败后无续跑路径」（见 §7.1.2 结论 2）：`继续此批次` 抛 `GENERATION_RESUME_REFUSED`、重新开一批撞「已有草稿」 | 卡点已换：① 中间章蓝图不可补（已绕过，§7.1.1）；② 章节卡 / 交接单 stale（已用保存清掉，**保存确实有效**，22:5x 的「保存无效」是打错卡，已在 §7.1.1 订正）；③ **D12 判据拦批量第 2 章**（第 5 次复现）；④ 失败后无续跑入口 |
| **A2-6** | **✅ 已执行（2026-11-07 21:5x）**，结论见 §4.2.1 | 在 CDP 调 `readOutlineProgressGate({projectSession, chapterNumber: 7})` 看返回，并核对生成请求里的 `chapterNumber`，逐条排除 §4.2 四条候选 | 已排除 ③④、确认 ② 成立且恒久（`volumesState='stale'` ⇒ 入口短路）；① 因未走到判定而不影响结论。**新增 dev-only 探针** `window.__outlineProgressGateProbe(n)`（`src/services/outline-progress-gate-probe.ts`）供后续复用 |
| **A2-1 / A2-2** | 闸门为 `null`、豁免键未出现 | 随 A2-6 结论决定：若属判据 / 配置问题，先澄清判据再补跑「点继续」路径 | 原因没查清就补跑，只会再得一次同样的 `null`，不算验收 |
| **D9 / D16** | 换身份复核判「未兑现」，作者裁丙结转 | 下一批专做结构设计：先定挂点 / 事实源，再动代码 | [`2026-11-07-d9-d16-structural-design-handoff.md`](../../handoffs/2026-11-07-d9-d16-structural-design-handoff.md) §2；**本批不补做** |
| **B 组 4 处 browser 断言 + D4 判据** | **均已收口**（断言 20:3x 随合并完成；判据 20:4x 自我订正） | 无需下一批：判据按「`sourceStatus` 驱动的接线点」（8 处）成立；`VersionHistory.tsx:281` / `ArchFileViewer.tsx:1071` 经取证非本因、不属本缺陷 | 断言已改并跑过；判据已订正 |
| **D10 现象未闭环 / D11 定稿态取法** | 已登记，未定 | 按作者裁定决定补做 / 结转 | 下一批立项稿 §4 明写「不在下一批默认夹带」 |

**本批到此为止**：以上六类**都没有**在本批执行，也没有因为「登记为遗留」被判兑现。第三方签核时请逐条核「现状属实 + 下一批动作可执行」。

### 7.1.1 A1 实机过程与两个新发现（2026-11-07 22:1x–23:0x）

**已查明并绕过：中间章蓝图不可补。**

`DirectoryConfigDialog` 的「指定生成」模式要求 `start ≥ frozenAppendStart`，而
`frozenAppendStart = Math.max(最高蓝图章 + 1, 权威下一章)`。副本的蓝图是 `1–12 + 17`（第 17 章是
历史遗留的孤立章），于是 `frozenAppendStart = 18`，**13–16 章永久不可生成**，界面只给一句
「请选择有效的连续 1–10 章」（`DirectoryConfigDialog.tsx:304-318`），不说为什么、也不指出是
哪一章把起点推走了。

这不是本次实验制造的问题：任何「蓝图跳过若干章」的项目都会卡在这里。**建议单独立项**（与
D21「卷结构 stale 短路闸门」并列），候选修法：把「最高蓝图」换成「连续前缀的最后一张」，
或在报错里点名「第 N 章把追加起点推到了 N+1」。

**本轮实测：删掉孤立第 17 章蓝图后，「指定生成 13–14」一次成功**（约 50 秒，`2/2`），
说明阻塞点就是它。

**新卡点：补齐蓝图反而触发了上游失效保护。**

13/14 章蓝图落库 ⇒ 情节大纲从第 21 版推到**第 22 版**（「改过第13、14章」）⇒ 第 12 章章节卡
被判「基于旧大纲」⇒ 批量创作在准备阶段直接失败：

```
run 64920a1a failed | attempts = 0 | recovery_candidates 不变
界面：批量草稿待审 · 第 12 至 14 章 — 工作流未完成
      第12章的章节卡基于的情节大纲 第10版→第22版（…第22版 11-07 22:49 重新生成，改过第13、14章）
      已经改过了，请先核对这张卡再批量创作
```

**这条拦得对**（P2-3 失效线的工作形态），但它顺带说明：**「补蓝图」和「批量创作」在同一个
会话里连续做，必然要经过一次清点核对**。⇒ A1 的下一步固定为：同步页核对 → 重跑批量。

> **自我订正（2026-11-07 23:1x）**：22:5x 记的「在卡片上点保存并不能清掉 stale」**测错了对象**。
> 那一次保存落在**第 1 章**卡上（产生了「第23版 作者手改，改过第1章」），不是第 12 章。23:11 在
> 「同步 → 第12章 → 去处置 → 保存」重做一次，**stale 当场清掉**（同步页 23 → 22 项，第 12 章从
> 「章节蓝图」组消失，情节大纲推到第 24 版「改过第12章」）。**「保存就能清 stale」是成立的**，
> 错的只是打到了别的卡。详见 §7.1.2。

### 7.1.2 A1 实机补做读数（2026-11-07 23:00–23:37，副本 `.batch-a/proj`）

环境：主区 `pnpm dev` + CDP 9222，项目＝副本；模型 `Ollama/qwen3.5:9b-128k`（界面默认）；
真实项目复核未动（391 文件 / `project.db` 13,754,368 字节）。

**清 stale 的两步（都是必须的，都会推高上游版本）**

| 动作 | 结果 |
|---|---|
| 同步页「第12章 → 去处置 → 保存」 | 情节大纲 **v23 → v24**（`作者手改，改过第12章`）；第 12 章从「章节蓝图」组消失，23 → 22 项 |
| 再点「继续此批次」 | 被**卷末交接单**拦住：`上一卷交接单基于的情节大纲 第19版→第24版…请先按当前内容核对并保存这份交接单` |
| 卷末交接 tab → 编辑 → 保存 | 22 → 21 项；交接单保存**只重取版本快照、不 bump**（`upsertVolumeHandoff` 无 `bumpOutline`），所以不会把刚清干净的卡再打回 stale |

**四次批量尝试的逐次读数（同一副本、同一模型）**

| # | 时刻 | 区间 | 结果 |
|---|---|---|---|
| 1 | 23:12→23:19 | 12–14 | 第 12 章失败：`DRAFT_DEGENERATE_VERBATIM_REPEAT`（正文整段复读同一组对白，未保存）。`0/3` |
| 2 | 23:19 | — | 点「继续此批次」→ `Error invoking remote method 'generation:resume': Error: GENERATION_RESUME_REFUSED`（库里 `root.status=active`、`run.status=failed`；`resume()` 只在 root 为 `paused` 时放行） |
| 3 | 23:20→23:30 | 12–14 | 第 12 章**成功**，`drafts` ch12 v1 / 1583 字 / `status=draft`（23:26:02）；第 13 章失败：`DRAFT_PREVIOUS_ENDING_REPLAY`（开头大段重演上一章结尾）。`1/3` |
| 4 | 23:37 | 12–13 | 立即失败：`第12章已有草稿，批量创作不会覆盖既有内容`。`0/2` |

**`*_SOURCE_CHANGED` 计数：四次 run 的任务日志里 0 次**（全量界面文本 14,757 字符内检索，
只出现 `DRAFT_DEGENERATE_VERBATIM_REPEAT` 与 `DRAFT_PREVIOUS_ENDING_REPLAY` 两个错误码）。
**但这不能判 A1 通过** —— 判据要求「同 run 连续 3 次生成全成功」，本次一章成功、第二章就被另一条
判据挡死，链条没跑完。

**结论（两条，都是产品层）**

1. **A1 在 D12 未修的前提下不可验收**：批量第 2 章（本例第 13 章）开头必然复述上一章结尾 ⇒
   `DRAFT_PREVIOUS_ENDING_REPLAY` ⇒ 批量停在 `1/3`。这与 D12 单独实测（4/4 复述）一致，是第 5 次。
2. **新缺陷候选（建议立项）：草稿待审模式下「第 1 章成功、第 2 章失败」之后无任何续跑路径。**
   - 「继续此批次」→ `GENERATION_RESUME_REFUSED`（且把原始 IPC 错误直接抛到界面）；
   - 重新开一批 → 起始章节仍算「第 12 章」（草稿未定稿不算权威下一章）⇒ 撞「已有草稿不会覆盖」；
   - 界面没有「从失败那一章重来」的入口 ⇒ 作者只能手动把第 12 章定稿，才可能推进到 13。
   「起始章节」在对话框里是只读派生值（无输入框，见 `#batch-chapter-count` 旁边无对应控件），
   与「本次章节数」并列却不可选，容易被读成「可以从任意章起跑」。

---

## 8. 与其他文档的关系

- **缺陷现值与原始判据** → [`live-pipeline-acceptance-defects-assessment.md`](./live-pipeline-acceptance-defects-assessment.md)
- **逐项验收清单的写法范式** → [`live-verification-checklist.md`](./live-verification-checklist.md)
- **本批执行过程、环境踩坑、变更留痕** → [`2026-11-07-batch-a-bc-handoff.md`](../../handoffs/2026-11-07-batch-a-bc-handoff.md)
- **上一轮五小时联动批次的编排与坑** → [`2026-11-05-five-hour-agent-run.md`](../../handoffs/2026-11-05-five-hour-agent-run.md)
- **下一批（D9/D16 结构设计）立项** → [`2026-11-07-d9-d16-structural-design-handoff.md`](../../handoffs/2026-11-07-d9-d16-structural-design-handoff.md)
- **待办台账** → [`prompt-assembly-backlog.md`](../../plans/prompt-assembly-backlog.md)
