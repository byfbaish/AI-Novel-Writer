# 2026-11-07 工作批次 · 计划方案与第三方复核验收清单

> 状态：已裁定（2026-11-07 04:08 作者批准甲方案；04:3x C 组经核实撤销派单）
> 日期：2026-11-07
> 用途：**第三方独立复核验收**。复核者不需要本次会话上下文；按 §0 操作即可逐条判「兑现 / 未兑现」。
> 上级稿：[`live-pipeline-acceptance-defects-assessment.md`](./live-pipeline-acceptance-defects-assessment.md)（缺陷现值与判据）
> 格式参照：[`live-verification-checklist.md`](./live-verification-checklist.md)（§0 用法、逐项表格、实测读数回填）
> 现场记录：[`2026-11-07-batch-a-bc-handoff.md`](../../handoffs/2026-11-07-batch-a-bc-handoff.md)（执行过程、变更留痕、环境踩坑）
> 放置依据：[`docs/README.md`](../../README.md) §3.1 / §3.2 —— §3.2 硬规则 1「不往 `plans/` 新增设计稿」，故落在 `docs/design/product/`。
> 基准 SHA：开工 `2d5888c7`；本批提交 `f21d3d64`（立项）→ `614baf0e`（C 组撤销）→ 本稿。

---

## 0. 怎么用这份清单（复核者必读）

1. **先读 §2 基准快照**：它固定了「开工前是什么样」。所有「有没有偷偷改范围 / 改判定」都以此为准。
2. **逐行走 §3 验收矩阵**：每行有「判据 / 证据路径 / 复核方法 / 执行方自报 / 第三方结论」。**最后一列留空是故意的** —— 本稿不替复核者下结论。
3. **判「兑现」只看判据是否被证据满足**，不看「代码写了没」「测试绿了没」。测试绿只证明没打坏原来能用的，不证明该交付的东西交付了。
4. **允许三种复核结论**：`兑现` / `未兑现` / `无法判定（证据缺失）`。第三种必须写清缺哪份证据，不要写成「待作者复验」——实机验证由执行方自己做，只有文风、可读性、剧情接续是否撕裂才留给人。
5. **打回只认两条理由**：① 验收没兑现；② 打坏了原来能用的。风格性返稿不认。

### 0.1 复核前体检（不做会让读数作废）

| # | 做什么 | 为什么 | 怎么确认 |
|---|---|---|---|
| **P1** | 确认证据目录**仍在** | 本稿用于第三方复核，`.batch-a/proj` 副本、`.tmp-ui/a-*.mjs` 脚本、两个 worktree 的 `.batch/*-report.md` **一律保留至复核签核后**，不按交接稿 §8 的「验完清理」执行（该条已被本稿覆盖） | `ls -d ../.batch-a/proj` 与 `ls wt-2/.batch wt-3/.batch` 均存在 |
| **P2** | 确认真实项目未被改动 | 所有真生成都在副本上跑 | `C:\develop\workspace\AI-writer\师父派我来除魔，幕后真凶竟是小师妹` 应为 **391 文件**、`project.db` **13,754,368 字节**；dev 最近项目列表只含真实路径 |
| **P3** | 查库必须用 Electron 的 Node 通道 | 主区 `better_sqlite3.node` 是 Electron ABI（145），普通 `node`（127）会 `ERR_DLOPEN_FAILED`，据此误判「库坏了」 | `ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe <脚本>.mjs` |

### 0.2 受控口径

- **状态词表**：`待裁定`（批准未开工）/ `已裁定`（批准未开工，本文用此）/ `已实施`（代码落地）/ `已结项`。不新造写法。
- **缺陷图标**：`✅` = 已实施且实机复验过；`🟡` = 代码落地待实机；`🔍` = 已取证待判；`⬜` = 待裁定。**`D3` 在本批结束前不得由 🟡 转 ✅**，理由见 §4.2。
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
| 丙 | 用 P0-1 改稿连锁换掉 C 组；要先定「退回某章并连带回退其后」长什么样，本批大概率变成讨论 | 未采纳 |

### 1.2 独立审查（豆包，纯文本）与抽查结论

通道在线但工作区固定 `AI-writer-wt-1`（旧快照），**只审清单、明令不读仓库**。2 分钟回 12 条，**8 成立 / 2 部分采纳 / 2 驳回**。抽查已逐条核过，原文见 `.workbuddy/memory/2026-11-07.md` 03:4x 段。

- **已吸收**：时间口径不自洽；**A 组实机期间主工作区必须冻结**；E0 与 A3 循环（D13/D15 的现状正是 A3 要查的）⇒ E0 拆两步；背景写「D3 已实机验证完」与 A2「唯一未覆盖」口径打架；执行方代持了排序权。
- **驳回**（把不同机制串成一条因果）：「A1 必须先于 A2」—— A2 靠卷首范围设到第 7 章触发闸门，不靠来源变化提示；「AC2 会把卷数做成硬约束」—— 那是具名实体引用，与卷数无关。
- **教训**：清单型只读必须抽查；文本判断强、事实与位置偶错。

### 1.3 三条编排规则（不打折扣）

1. **A 组实机期间主工作区冻结**：B/C 只落各自 worktree、验完再合；A 组只读 + CDP，不改主区代码。否则 A1/A2 验的是旧代码。
2. **派单护栏**：① 新规则只告警不阻断（D15 既有裁定）；② 文案以给定定稿为准，不接受风格性返稿。派出去的 agent **只准单元测试**，实机验证不派。
3. **换身份复核**：干完只交复核，不自行 `done`；`review` 拒同身份自审。改代码与改台账同一提交，提交前 `check:fast` 由 pre-commit 自动跑。

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
| V1 | **C 组撤销派单，代码零改动** | 卡 `861ab163` 上一轮已由 `4767e9dc` 实施；派单前只看了卡的 prompt 文本、漏查历史实施 commit 及其裁定原文 | 本稿 §3.4 / §4.5；交接稿 §5；提交 `614baf0e` |
| V2 | A 组从「主工作区」改走 **wt-1 槽位 1**（5181 + CDP 9223） | 作者 5180 dev 不能碰；「复用 5180 + 第二 Electron 实例」被 `main.ts:100` 单实例锁否决（1 秒退出） | 交接稿 §1 |
| V3 | E0 由「8 张卡标完成」改为精确对齐 | 卡与缺陷稿不是一一对应：D1/D12 本就是真待办、D6/D8 是有意留痕卡 | 本稿 §3.1 |
| V4 | **证据目录保留、不清**（覆盖交接稿 §8） | 本稿用于第三方复核 | 本稿 §0.1 P1 / §5.3 |

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
| **A1** | 正文批量「同 run 连续 3 次生成」全成功；任务日志里 `*_SOURCE_CHANGED` **0 次**（出处 `agent-generation-client.ts:33`、`generate-draft.command.ts:1018`、`finalization-generation.ts:41`） | 任务日志 + `generation_runs` | 贴原始日志片段并逐次数 | **未跑**（排在 A2 之后） | — |
| **A2-1** | 卷首 `handoff-missing` 档弹出（`[data-testid="outline-progress-gate"]` 非空且文案为「没登记交接单」） | DOM 文本 / 截图 | 见 §5.2 复现步骤 | **未兑现**：闸门为 `null` | — |
| **A2-2** | 点「我知道，仍按计划继续」写入豁免 `outline-progress:volume:1` | 副本 `consistency_exemptions` | 查库 | **未兑现**：未出现该键（现有 `outline-progress:volume:3` 是历史值） | — |
| **A2-3** | **真起 run 并产出情节大纲，产物落库** | `generation_runs` + `generation_artifacts` | 查库（§0.1 P3） | **兑现**：`f85becbd…` `running`→`completed`；6 条产物（第 7–12 章，text 744/847/1034/1121/850/889 字） | — |
| **A2-4** | 产物来源字段与当前稿一致 | artifact 的 `fingerprint` / `revision` / `textHash` | 查库 | **部分**：产物有 `fingerprint`/`revision`/`textHash` 且 6 条齐；「与当前稿一致」未做逐字段比对 | — |
| **A2-5** | 贴 `generation_runs` / `generation_attempts` 前后计数 | 查库输出 | 复跑查询 | **兑现**：runs 137→138、attempts +6（详见 §4.2） | — |
| **A2-6** | 查清 D3 闸门为何没弹 | 交接稿 §3.1 四条候选 | 在 CDP 里调 `readOutlineProgressGate({projectSession, chapterNumber: 7})` 看返回，并核对生成请求里的 `chapterNumber` | **未查**（候选已列、未验证） | — |
| **A3-1** | D5 模板侧 + 机检侧两侧闭环，产出侧标「需实机」 | `architecture.command.ts:3228–3236` `findAngleBracketPlaceholders()` 只 `callbacks.log` 不阻断 | 读代码 | **兑现** | — |
| **A3-2** | D13 结论「缺的是实机复验不是代码」 | 缺陷稿 §749 / 表格第 60 行、`959a3647` + `3f954431` | 读文档 | **兑现** | — |
| **A3-3** | D15 告警已被 UI 消费，且口径为「检出告警」非「落库前拦下」 | `volume-structure.ts:185` → `VolumeHandoffRegistryPanel.tsx:252/266/292` → `summarizeVolumeWarnings()` | 读代码链路 | **兑现**（`VOLUME_UNIT_OVERLAP` 归为同因不重复计数，由 `AMBIGUOUS` 成句） | — |

> **A2 总判定口径（硬）**：A2-1 / A2-2 未兑现、A2-6 未查 ⇒ **A2 只算「真生成已起并完成」，不算 D3 的「点继续后」路径已验完**；不得据此把 D3 由 🟡 转 ✅。

### 3.3 B 组（派单，只准单元测试）

| # | 判据（写死，不许「先取证再定」） | 复核方法 | 执行方自报 | 第三方结论 |
|---|---|---|---|---|
| **B1 D4** | 同一份 `sourceStatus='conflict'` 同时驱动**产物层**（这一稿不能保存、仍可复制）与**批次层**（后续单元不再执行、需重新发起）两条并列文案；6 处文案定位见交接稿 §4；组件单测断言两条**同时出现**且「仅可复制」语义不丢 | `git -C wt-2 diff` + 跑对应单测 | 进行中（报告已落盘，未正式交付） | — |
| **B2 D9** | 超时上限**默认 10 分钟且可配置**；假时钟单测三态 `生成中→超时已中止→调用失败`；超时中止复用 D2 失败终态落库，`generation_runs` 不留 `running`/`paused` | 同上 | 进行中 | — |
| **B3 D10** | 清空补渲染侧重置钩子（单测断言被调用）+ 回执报三档各清了几类各多少条；回执计数与 DB 删除计数一致；**不要求 browser 测试** | 同上 | 进行中 | — |
| **B4 D11** | 去重键改为**卷**（`volumeIndex` + 该卷大纲定稿态），不再用 `architecture-character-nudge.ts:112` 的 `c<覆盖数>:l<正文长度>`；单测同卷连续 3 批只弹 1 次、跨卷弹第 2 次 | 同上 | 进行中 | — |
| **B5 D16** | 状态栏读**实际调用事实源**（`generation_attempts` / `generation_runs` 的 `model` 字段，字段名写死在报告里），不读配置当前选中值；单测构造「配置 A / 实际 B」⇒ 断言显示 B | 同上 | 进行中 | — |
| **B0 共同** | 只跑单测，禁 `pnpm test:node` / browser / 全量；不 commit / push / merge；结果落盘 `wt-2/.batch/b-report.md`；不自行宣布完成 | 看 `git status`、报告文件、命令原始输出 | 报告 12,775 字节已落盘（04:36）；tracked 有改动、**未提交** | — |

> **worktree 固有基线（别误判为执行方打坏）**：`pnpm check:fast` 在 wt-2/wt-3 会因 `docs/design/architecture/p11-plan-validity-and-fact-registry-design.md:163` 指向 `../../../.workbuddy/memory/notes/data-and-schema.md` 报 **broken 1 / EXIT=1**；worktree 未同步本地私有目录 ⇒ 必断，主区可过。执行方已用 `git stash` 做纯 HEAD 同口径对照证明与改动无关，stash 均已 pop。**复核者应在主区跑 `check:fast`，或接受该基线说明。**

### 3.4 C 组（撤销项，也要验「确实零改动」）

| # | 判据 | 复核方法 | 执行方自报 | 第三方结论 |
|---|---|---|---|---|
| C-1 | `wt-3` **tracked 零改动、无提交**，`git diff` 为空 | `git -C wt-3 status --short` | **兑现**：只剩 `?? .batch/`，`git restore` 已撤销两个 `.ts` 改动 | — |
| C-2 | 取证报告落盘，含 `4767e9dc` 裁定原文、两条消费路径、不采纳 B 的理由、裁定后收口节 | `wt-3/.batch/c-report.md` | **兑现**：8,104 字节，§6 收口写明「撤销派单、代码零改动、无提交」 | — |
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

### 4.3 A3 / E0 / C 组
见 §3.1 / §3.2 / §3.4 的「执行方自报」列，均为只读核对或看板写入，无代码改动。

### 4.4 B 组
报告 `wt-2/.batch/b-report.md`（12,775 字节，04:36）已落盘；`wt-2` 有 3 个组件改动 + 新增 `SourceConflictNotice.tsx`、`source-conflict-copy.ts` 与单测文件。**执行方尚未正式交付、未换身份复核** ⇒ 本稿不填实测读数，等交付后回填。

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
| `.workbuddy\memory\2026-11-07.md` | 现场日志（04:08 起各段） |

> **§0.1 P1 覆盖交接稿 §8 的「验完清理」**：第三方复核需要这些证据，签核前不得删除。

---

## 6. 红线检查表（第三方逐条打勾）

| # | 红线 | 复核方法 | 第三方结论 |
|---|---|---|---|
| R1 | 实机验证由执行方自己做，不写成「作者实机 / 待作者复验」 | §3.2 各行「执行方自报」 | — |
| R2 | 派出去的 agent 只准单元测试；worktree 禁 `pnpm test:node` / browser / 全量 | 两份报告的命令原始输出 | — |
| R3 | 新规则**只告警不阻断**；不把卷数/章数做成硬约束 | `git diff` 里有无新增 throw / 拦截 | — |
| R4 | 改代码同提交同步设计稿/台账；`check:fast` 由 pre-commit 跑 | `git log` + 提交输出 | — |
| R5 | 完成需换身份复核，不许自己 `done` | 看板 `review` 记录与 `handedBy` | — |
| R6 | 状态行、§2 表格、顶部分布段逐处 grep 核对（状态写在多处 ≠ 读者会看到） | 缺陷稿三处比 | — |
| R7 | 真实项目零改动 | §0.1 P2 | — |
| R8 | 不自己创造概念、不自己制造判据；先查行业定义与既有标准 | §1.2 / §2.1 / §3.4 | — |

---

## 7. 收口定义与签核

**本批可判「收口」的条件**：§3 全部行第三方结论为 `兑现`，或 `未兑现` 项已明确登记为遗留并写出下一批处置；§6 无违反；§5.3 证据完整。

| 角色 | 姓名 / 身份 | 日期 | 结论 | 备注 |
|---|---|---|---|---|
| 执行方自报 | 主 agent | 2026-11-07 | 见 §4 | A1 未跑、A2-1/2/6 未兑现、B 组未交付 |
| 独立复核 | （第三方填写） | — | — | 逐条填 §3 / §6 最后一列 |
| 作者裁定 | — | — | — | 对 `未兑现` 项决定「补做 / 结转 / 结项」 |

> **已知未兑现项不得被「整批通过」掩盖**：A1（未跑）、A2-1 / A2-2 / A2-6（闸门未弹且原因未查）、B 组（未交付未复核）。

---

## 8. 与其他文档的关系

- **缺陷现值与原始判据** → [`live-pipeline-acceptance-defects-assessment.md`](./live-pipeline-acceptance-defects-assessment.md)
- **逐项验收清单的写法范式** → [`live-verification-checklist.md`](./live-verification-checklist.md)
- **本批执行过程、环境踩坑、变更留痕** → [`2026-11-07-batch-a-bc-handoff.md`](../../handoffs/2026-11-07-batch-a-bc-handoff.md)
- **上一轮五小时联动批次的编排与坑** → [`2026-11-05-five-hour-agent-run.md`](../../handoffs/2026-11-05-five-hour-agent-run.md)
- **待办台账** → [`prompt-assembly-backlog.md`](../../plans/prompt-assembly-backlog.md)
