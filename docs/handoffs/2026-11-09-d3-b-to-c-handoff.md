# 交接：D3 裁定 B → C —— 维持 🟡，三条前置齐了才转 ✅（2026-11-09 23:2x）

> 交接基准：分支 `exp/resource-ledger` · HEAD `6d52ace9` · 工作区**有未提交改动**（见 §六，别一把 `git add -A`）· `[ahead 53]` 未推送
> 上一份：[`2026-11-09-dsh-first-run-and-batch-resume-handoff.md`](./2026-11-09-dsh-first-run-and-batch-resume-handoff.md) §15.3 / §15.6 / §十六
> 依据：[`live-pipeline-acceptance-defects-assessment.md`](../design/product/live-pipeline-acceptance-defects-assessment.md) §D3 · [`2026-11-07-batch-a-bc-handoff.md`](./2026-11-07-batch-a-bc-handoff.md) `:56` / `:65-72` · [`2026-11-07-batch-acceptance-plan.md`](../design/product/2026-11-07-batch-acceptance-plan.md) `:210-246` · [`d21-fix-c-implementation-plan-20261109.md`](../design/product/d21-fix-c-implementation-plan-20261109.md) §三
> 直接相关：[`prompt-assembly-backlog.md`](../plans/prompt-assembly-backlog.md) `:126` · [`d21-gate-shortcircuit-evidence-20261109.md`](../design/product/d21-gate-shortcircuit-evidence-20261109.md) · [`documentation-charter.md`](../agents/documentation-charter.md) §5.2 / §7
> 本稿性质：专项交接单（T3 证据型）· **本轮授权：只读 + 可改文档（写交接单）** —— 不改码、不改状态行、不提交、不推送、0 次调用 DSH

---

## 〇、三十秒版本

作者原话「**D3：B → C / 写交接单**」＝ 采纳 [`主交接稿 §15.3`](./2026-11-09-dsh-first-run-and-batch-resume-handoff.md) 的明确建议：**先按 B 维持 🟡，按 C 的三条前置推进，三条齐了才写 ✅**。

**这不是「现在转 ✅」**，本轮也没有动任何状态行。D3 的代码写完了、单测绿了、两档弹窗实机弹过；但「点『我知道，仍按计划继续』→ 真起 run → 产物落库」这条路径**从没跑通**，而第二维修正还住在一条 `stale` 即短路、从未被执行的入口后面。✅ 必须留给真跑通的那天，否则下次真撞上会被当成「回归」而不是「本来就没验过」。

**交接单的用处**：C 不是一个时间点，是三个并列前置；下一轮照 §二 逐条兑现、照 §三 收口，不要重新讨论「要不要转 ✅」。

---

## 一、裁定原文与范围（防误读）

| 项 | 口径 |
|---|---|
| 作者原话 | `D3：B → C` / `写交接单` |
| B | 维持 🟡（**已实施 · 不转 ✅**），状态如实；代价是一直挂黄 |
| C | 三条前置齐了再转 ✅（§二），**是路线，不是状态跃迁** |
| 明确排除 | ① 现在把 D3 由 🟡 转 ✅ ② 本轮改任何状态行 ③ 改生产代码 / 断言 ④ 起 `pnpm dev` / CDP 9222 实机 |
| 若将来要强转 | 需**单独给「可改状态行」授权**，并接受 §15.3 ④-A 后果：台账与缺陷稿会被读成全链路已验，而 A2 未闭环、修法 C 未落地 |

**为什么 B 不等于「没做完」**：D3 现值写的是「已实施（2026-11-06 · **不转 ✅**）」——🟡 标的是「代码已实施、实机未闭环」，不是「代码没写」。缺陷稿 `:353` 状态行、台账 `:126` 现值索引、D21 实施稿 `:88`「另裁」三处口径**本轮原样保留**。

---

## 二、三条前置：可执行验收清单（本交接单的核心）

三条是**并列与门**，缺一条就停在 B。每条给「现在卡在哪 / 下一轮做什么 / 什么算过」。

### 2.1 前置① 修法 C 落地（D21）

- **现在卡在哪**：[`d21-fix-c-implementation-plan-20261109.md`](../design/product/d21-fix-c-implementation-plan-20261109.md) 五个决策点（3.1 数据来源与读取 / 3.2 现算与合并 / 3.3 取区间下沉 `shared` / 3.4 确认顺序「过期优先」/ 3.5 单测）与两处 UI 建议值**尚未点头**；生产代码与断言一行未改。`src/services/outline-progress-gate.ts:92-95` 的 `state` 短路仍在。
- **下一轮做什么**：先让作者对五个决策点点头 → 豆包任务书 [`task-d21-fix-c-plan-20261109.md`](../../scripts/doubao/task-d21-fix-c-plan-20261109.md) 只出方案与可粘贴 diff → Lead 换身份复核 → **生产代码 + 断言同一次提交**（作者 22:0x 已批准「单测跟着实际需求走」）。
- **什么算过**：按实施稿 §四清单改完（`volume-structure.ts` 纯函数 / `services` 第五路读与旁路 `state` / `shared` 顺序对调 / 两个 tsx 四槽位文案 / `outline-progress-gate.test.ts:154-165`、`:167-177` 断言同批改）；`pnpm check:fast` 全绿；受影响单测贴原始输出。
- **红线**：**只删短路仍用旧表边界 = 修法 A**（作者 02:47 已否），别贴着 C 的标签落地 A 的语义；`project-core` 读失败要退回表边界 + `warning`，**绝不退回 `gate: null`**。

### 2.2 前置② A2 复跑（含一处口径订正）

> **★ 订正（本交接单新增，勿照抄 §15.3）**：上一轮 §15.3 写「A2 四个候选**至今未查**」不准确。[`batch-acceptance-plan.md:210-232`](../design/product/2026-11-07-batch-acceptance-plan.md) 的 **A2-6 实测（2026-11-07 21:5x）**已用 dev-only 探针 `window.__outlineProgressGateProbe(chapterNumber)` 查清：`chapterNumber` = 7 / 11 / 12 / 16 / 21 / 26 **六档全部 `gate=null`**，`warning="卷结构状态为 stale，本次不判"`，`volumesState='stale'`。四候选判定：① 不能排除但已不再是关键 · ② **✅ 成立且是恒久状态、不是偶发**（`stale` ⇒ `:92-95` 直接 return，两维判据一行没执行）· ③④ 不成立（未走到）。⇒ **「闸门为何没弹」已查清并归并为 D21**，下一轮不要再开一轮排查。

- **现在卡在哪**：`stale` 短路导致 A2 的 `handoff-missing` 档根本没弹，`:56` 写死的五条验收一条都没走完；修法 C 未落地，复跑无意义。
- **下一轮做什么**：修法 C 落地后，在**新副本**按 `:56` 复跑 A2 五条（下列为摘要，逐字判据以 `:56` 为准）：① 卷首 `handoff-missing` 档弹出 ② 点确认写入一条豁免 `outline-progress:volume:1` ③ **真起 run 并产出情节大纲、产物落库** ④ 产物来源字段与当前稿一致 ⑤ 贴 `generation_runs` / `generation_attempts` **前后计数**。**不跑完不算过**。
- **什么算过**：五条全绿 + 原始读数落盘（run id / 前后计数 / 页面文案）+ 换身份复核 PASS。注意 `:246` 的时序提醒：要区分「本来 `stale`」与「A2 之后 `stale`」，需在**未跑生成的新副本**上先取一次读数。
- **口径**：这是「点继续后的真生成」路径，不是 D21 的复验失败；两条不能互相顶替。

### 2.3 前置③ 两道闸门先后顺序有结论

- **现在卡在哪**：[`batch-a-bc-handoff.md:68`](./2026-11-07-batch-a-bc-handoff.md) 现场是**先弹上游失效清单闸门（D20）**，勾确认 + 点「继续」后**直接起 run**，卷首 `[data-testid="outline-progress-gate"]` 为 `null`。[`d21-gate-shortcircuit-evidence-20261109.md`](../design/product/d21-gate-shortcircuit-evidence-20261109.md) 又查出 `ArchitectureConfirmDialog.tsx:509-512` 拿到 `null` 只 `console.warn` **静默放行**、界面零提示。⇒ 修法 C 让卷首闸门在 `stale` 时也判之后，**两道闸门会不会都弹、谁先谁后、前一个确认会不会吞掉后一个**，目前没有结论。
- **下一轮做什么**：实机跑一次「失效清单闸门 → 点继续 → 卷首闸门 → 点继续 → 真生成」全链，记录两面板的先后顺序、豁免键写入情况、是否有互相遮蔽；`workflow-launch-dialogs.browser.tsx` 是否断言过「闸门不弹」取证稿 §④ 标「不确定」，**先搜再定，不猜**。
- **什么算过**：给出一句可写进台账的结论（顺序 + 是否互相遮蔽 + 确认是否叠加），并附实机读数；若结论是「必须产品裁定」，另开一轮，不要自行默认。

### 2.4 汇合判据

```mermaid
flowchart LR
  B["B 维持 🟡<br/>（当前）"] --> P1["① 修法 C 落地"]
  B --> P2["② A2 五条复跑"]
  B --> P3["③ 两闸门顺序有结论"]
  P1 --> G{"三条齐了？"}
  P2 --> G
  P3 --> G
  G -->|缺任一条| B
  G -->|齐了 + 可改状态行授权| OK["C 写 ✅"]
```

一句读法：**三条前置是并列与门，缺一条就停在 B；即便齐了，转 ✅ 还要另拿一次状态行授权。**

---

## 三、转 ✅ 那天的操作清单（今天不做）

1. 先跑 `node scripts/check-doc-placement.mjs --status-of "D3"`，把写着 D3 的位置列全。**这个读数会随新文档自身增长，不写死数值**：脚本扫的是整份文档里含「D3」的状态表述，本交接单 `:28`「明确排除」行自己就会被计入（本单落盘后实测由 8 处 / 5 文件变为 **9 处 / 6 文件**）。⇒ 以转 ✅ 当天**当场跑出的结果**为准，先排除「本单自身 / 本次裁定记录」这类自指命中，再逐处判「该改 / 历史快照不必改 / 同名不同物不必改」。存量分布（本单落盘前）：缺陷稿 2 · `p1-1-boundary-notice-design.md` 1 · 主交接稿 2 · `2026-11-09-d-segment-ledger-rewrite-proposal.md` 2 · `prompt-assembly-backlog.md` 1。
2. ⚠️ **`D3` 是全库重名符号**：命中里混着主角四格的「D3 破例档」、P1-1 的「D3 不做」等**与本条无关的编号**，别机械全改；先按出处判是不是验收缺陷 D3。
3. 逐处判「该改 / 历史记录不必改」：`2026-11-02` 冻结快照表与 11-06/11-07 的现值复核行是**历史快照，格值零删改**；现值只写**现值索引**（[`prompt-assembly-backlog.md:126`](../plans/prompt-assembly-backlog.md)）与**条目状态行**（缺陷稿 §D3 `:353`）。
4. 收口时按章程 §5.2 / `docs/README.md:94`「所有写着该期状态的位置都要改」，改完**再跑一次** `--status-of`，直到列表为空或只剩历史记录。
5. 状态行取值必须落在受控词表（待裁定 / 已裁定 / 已实施 / 已落地 / 已搁置 / 已结项）且带 `YYYY-MM-DD`；`✅` 是图标不是状态词，别拿它当状态行。

---

## 四、证据锚（逐条可点）

| 结论 | 证据 |
|---|---|
| 作者裁定 B → C 的来源是 §15.3 的四段材料与建议 | [`主交接稿 §15.3`](./2026-11-09-dsh-first-run-and-batch-resume-handoff.md) `:607-625` |
| D3 代码已实施、两档弹窗实机弹过、「点继续后真生成」未跑 | [`缺陷稿 §D3`](../design/product/live-pipeline-acceptance-defects-assessment.md) `:353` / `:408-424` |
| A2 现场：D20 闸门先弹、卷首没弹、五条验收 | [`batch-a-bc-handoff.md`](./2026-11-07-batch-a-bc-handoff.md) `:56` / `:65-72` |
| 四候选已查清（②成立，恒久短路） | [`batch-acceptance-plan.md`](../design/product/2026-11-07-batch-acceptance-plan.md) `:210-232` |
| 「独立缺陷、D3 不得转 ✅」结论 + 11-09 取证回填 | 同文件 `:242` / `:244` |
| 短路与静默放行逐行证据 | [`d21-gate-shortcircuit-evidence-20261109.md`](../design/product/d21-gate-shortcircuit-evidence-20261109.md) §① / §④ |
| 修法 C 五决策点、单测改法 | [`d21-fix-c-implementation-plan-20261109.md`](../design/product/d21-fix-c-implementation-plan-20261109.md) §三 / §四；`:88` 明写「D3 另裁」 |
| 现值索引与冻结快照零删改口径 | [`prompt-assembly-backlog.md`](../plans/prompt-assembly-backlog.md) `:119-126` |

---

## 五、下一轮开工必读与红线

**只读顺序**（别整目录通读）：`AGENTS.md` §2 → [`documentation-charter.md`](../agents/documentation-charter.md) §7 第 0 步（先写授权）→ 本交接单 → 主交接稿 §15.3 / §十六 → 实施稿 §三 → A2 现场 `:65-72` → 验收计划 `:210-246`。

| 红线 | 出处 / 理由 |
|---|---|
| 作者没明说授权 ⇒ 按最窄只读 | 章程 §7；改状态行 / 可提交 / 可推送各自单独给 |
| **实机验收归主 agent CDP 9222**，不许写「作者实机 / 待复验」 | 项目 T1 + [`doubao-channel.md`](../agents/doubao-channel.md) §5：派出去的 agent 只准单测，禁起应用实例（抢 SQLite / 端口 / `.vite` / 单实例锁） |
| **0 次调用 DSH**（含 `--dump-config` / `status` / `task`） | 作者 2026-11-09 明令；`scripts/dsh/model.patch.yml` 保持现状（模型挂起） |
| `pnpm dev` 红线未自动解除 | 作者只说「同意落地实机验收」，没说现在起 dev；本轮无新代码可验 |
| `wt-2` 仍 8 个 `M`，**不一把合并** | 主交接稿 §14.3；W1 打回未修 |
| 改 `src/` 非组件模块后热更新不生效，**必须重启 `pnpm dev`** | `AGENTS.md` §1 |
| 全量跑测带 `env -u` 摘两个 safe-delete 变量；结果**必须落盘** | `.workbuddy/memory/notes/env-and-conventions.md` 第 34 轮 / `agent-token-discipline.md` |
| 不推送 | 作者 ⑥「推送不着急，暂时放在本地」 |

---

## 六、本轮实际改了什么 / 未验证事项

- **新增本交接单**；[`主交接稿`](./2026-11-09-dsh-first-run-and-batch-resume-handoff.md) **追加 §十六**（裁定记录 + 指向本单的指针；§15.3 / §15.6 原文保留不回改）。
- **工作区实测 4 个文件**（以 `git status --short` 为准，**不是「3+2＝5」** —— 主交接稿两轮追加共用同一个 `M`）：` M docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md`（含上一轮 §十五 与本轮 §十六）· `?? docs/handoffs/2026-11-09-d3-b-to-c-handoff.md`（本单）· `?? scripts/doubao/task-d21-fix-c-plan-20261109.md`（上一轮遗留）· `?? scripts/doubao/task-system-notice-landing-20261109.md`（上一轮遗留）。HEAD 仍 `6d52ace9`，**未提交、未推送**；`ahead` 数会随后续提交递增，不写死。
- **未验证事项（如实）**：未跑实机（无新代码可验）· 未跑单测（无代码改动）· 未派豆包（通道三项前置未就绪）· 未调用 DSH · 未验证三条前置的任何一条。
- **边界**：未改 D3 状态行 · 未改两份禁动 json · 未改 D21 生产代码与断言 · 未动 `wt-2` · 未起 dev / CDP · 未提交 / 未推送。

---

## 七、本单之外的并行待办（只给指针，不重写）

| 事项 | 指针 |
|---|---|
| D21 方案交豆包 / 通道三项前置（切「本地电脑」+ 建项目 + 是否允许 `bootstrap.mjs` 新建线程） | 主交接稿 §15.5；任务书 `task-d21-fix-c-plan-20261109.md` |
| `SYSTEM_NOTICE` 落地与实机验收分工 | 主交接稿 §15.5；任务书 `task-system-notice-landing-20261109.md` |
| §十① 舍弃范围（已裁定，无歧义）、⑤ 两份 json 不动、⑥ 不推送 | 主交接稿 §15.2 / §15.4 / §15.6 |
| 台账 8 项闭环、`2026-11-02` 冻结快照 | [`2026-11-09-eight-rulings-brief.md`](./2026-11-09-eight-rulings-brief.md) · [`prompt-assembly-backlog.md`](../plans/prompt-assembly-backlog.md) §4.6 |
| W1 正文批量断章卡死（打回未修） | [`2026-11-09-night-batch-digest.md`](./2026-11-09-night-batch-digest.md) §三-1 |
