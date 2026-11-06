# 交接：D8b —— 未落稿生成物不再当正式产物守护，卷单元模式下中继续写整块静默

> 交接基准：2026-11-06 21:15（Asia/Shanghai）· 分支 `exp/resource-ledger` · HEAD `566ca5d6` · 工作区干净
> 最后一班：18:5x–21:1x（作者裁定 → 施工 → 单测 / browser → **Agent 用 CDP 真点 APP** → 按作者四条订正 → 实机复验）
> 一句话：**D8 的三项阻塞已全部落地并实机通过，四条遗留已由作者 21:2x 逐条答复（改的不改的都定了），本卡无待办；已 push。**
> 相关稿：[`d8-checkpoint-degradation-design.md`](../design/architecture/d8-checkpoint-degradation-design.md) §12.10（现值只认这一节）· 上一份 [`2026-11-06-d8-preimplementation-handoff.md`](2026-11-06-d8-preimplementation-handoff.md)（开工前状态 + 事故复盘）· 缺陷总表 [`live-pipeline-acceptance-defects-assessment.md`](../design/product/live-pipeline-acceptance-defects-assessment.md) §D8

---

## 〇、三十秒版本

D8 原本要修「候选区的大纲残本把下一次生成堵住」。**表面上它修好了**（点生成 → 残本被清 → 重新启动 run），但实机一跑就露了底：清场之后，命令侧仍要求「检查点里必须有一份大纲生成物」才能续批，于是必失败，并且把作者引向「从第 1 章重新生成全书大纲」。作者据此下了四条判断，其中最关键的一条是**「没有落稿的东西不应该作为正式产物这样守护」** —— 未落稿的候选本来就可能残缺、被改写、被丢弃，拿它给已落稿的 DB 正式大纲作担保，是把未落稿物发正式身份。

本班的修法就一句：**防手改改由 `synopsis_db_hash` 承担，不再要求生成物存在**；「本批尚未开始」时前缀直接从 DB 正式大纲推导。同时按作者口径，卷/单元模式下**右侧与架构页的中继续写入口整块静默**（不新增也不删除按钮），因为在这个模式下做大纲断点续写会冲击反馈收敛机制，留着入口等于鼓励这条错误路径。

验证：tsc exit 0 · 工作流 + store 单测 **1646/1646** · 相关 browser **113/113**（含新增 2 条）· **CDP 真点 APP 复验通过**（日志「正在续接第 18–19 章（保留已确认的第 1–17 章，不会覆盖）」，不再有「检查点缺少正文」）· 提交前 `check-fast` 全绿。

---

## 一、作者这班的四条订正（原话口径，后续不许改写）

前面 Agent 给过一版机制说明，把检查点里那份 `synopsis_result` 叫「正文」、把守卫定性为「太严」。**整段是错的**，作者逐条订正：

| # | 作者原话要点 | 实际改了什么 |
|---|---|---|
| ① | 清场删掉的是**大纲生成物**，不是正文 | 术语全库改口径：`synopsis_result` = 大纲生成物（候选、未落稿）；DB `synopsis` = 正式大纲 / DB 正文 |
| ② | **没有落稿的东西不应该作为正式产物这样守护** | 守卫不再要求生成物非空；防手改由 `synopsis_db_hash`（本来就存在）承担 |
| ③ | 右侧面板里的中断产物**没有取消入口** | 见 ③④ 的处置 |
| ④ | 有正常流程的取消就该走正常取消，**没有就说明机制本身残缺** | 不再补按钮 —— 改为**整块静默**（见第二节末） |

另有一条语境澄清（20:5x）：**「不新增也不删除任何按钮」当初的语境是架构确认弹窗**；而右侧的中断续写在卷单元模式下**整块都不该出现**。「如果在右边保留续写动作，某种形式上是在鼓励这个行为。」⇒ 上一版「新增一颗『放弃这份中断生成』按钮」的方案**整条作废**。

---

## 二、代码改了什么（4 个生产文件）

| 文件 | 改动 | 关键点 |
|---|---|---|
| `src/services/workflows/commands/architecture.command.ts` | 新增 `isPendingBatchWithoutCandidate(partial)` / `confirmedPrefixFromDbOutline(dbOutlineText, writingLanguage, totalChapters)`；续批分支不再无条件调 `assertCheckpointDbMirrorCurrent` | 「本批尚未开始且无生成物」时只校验 `synopsis_db_hash` 与 DB 正式大纲一致，前缀从正式大纲推；其余情形仍走原守卫。`persistInterruptedSynopsis` 里重复的前缀推导逻辑改为调同一 helper（**一份真相**） |
| `src/components/panels/AIOutputPanel.tsx` | 大纲恢复稿候选不渲染正文与「编辑恢复稿」；失败卡不渲染「继续生成情节大纲（断点续写）」 | 各留一行中性说明。**蓝图恢复稿不属本口径**，原样保留 |
| `src/components/editor/WorldBuildingEditor.tsx` | 挂载时 `syncSynopsisRoute()`；三处入口加 `!unitRouteEnabled`：「断点续写大纲」「续批（第 N 章起）」「候选区断点续写」 | 判据 = **配置开关**（`useSynopsisRouteStore().unitRouteEnabled`），不是探针结果（作者 04:56） |
| `src/components/editor/ArchFileViewer.tsx` | 挂载时同步配置并订阅 store | 少了这一步，store 默认 `true` 会把旧模式的合法入口误藏（`planning-recovery-editor.browser.tsx` 曾因此红 5 条） |
| `src/components/dialogs/ArchitectureConfirmDialog.tsx` | 单元说明块判据改为 `unitMode && unitRouteEnabled`；`unitRouteEnabled` 声明上移到探针 effect 之前并加入依赖；`ChapterStepper` 四键改**连体分段控件**、章号区间改「输入框 + 步进器 + 单位」成组不换行 | 修「弹窗开着时切配置，两套模式说明并存」（§12.10.6-2）；修章号区看起来像「第 -5 -1 +1 +5 章」的布局问题（作者 21:2x 指出本质是四个按钮） |

测试：`synopsis-unit-batch.command.test.ts`（清场后本批尚未开始仍能续批；断点续写用例改断言清场只删旗标 / handle / 生成物）· `WorldBuildingEditor.recovery.browser.tsx`（静默用例 + 夹具显式 `synopsisUnitMode: false`）· `planning-launch-entrypoints.browser.tsx`（新增 `★ D8b: turning the unit-mode setting off while the dialog is open…`）· `planning-recovery-editor.browser.tsx`（补 `config:get` 夹具）。

**零改动的部分（别以为漏了）**：反馈收敛链 —— `synopsis_range` / `synopsis_covered_to` / 游标 / 偏差账 / 指纹链在清场后**逐字保留**（作者 04:53 裁定）。实机三次核对：检查点只删 2–3 个键。

---

## 三、验证实绩（三层，都是本班真跑出来的）

| 层 | 范围 | 结果 |
|---|---|---|
| TypeScript | `tsc --noEmit` | exit 0 |
| 单测 | 工作流 + store 定向 | **1646 / 1646** |
| browser | `planning-launch-entrypoints` / `workflow-launch-dialogs` / `workflow-language-seam` / `WorldBuildingEditor.recovery` / `planning-recovery-editor` | **113 / 113**（含新增 2 条） |
| **实机（CDP 真点 APP）** | §12.10.4 四条判据 | 通过，见下 |
| 提交前闸门 | `node scripts/check-fast.mjs` | typecheck ✓ · doc links / doc placement 0 违规 |

**章号步进器布局（21:2x 补验）**：`workflow-launch-dialogs` + `workflow-language-seam` **39/39**、`planning-launch-entrypoints` **7/7**；CDP 实机截图确认两行成组（「第 [1] [-5 -1 +1 +5] 章」/「到第 [5] [-5 -1 +1 +5] 章（本批 5 章）」）。

**实机关键证据（21:05）**：造中断态（range 18–27 / `covered_to=17` / 残本）→「AI 生成架构」→ 勾情节大纲 → 确认 → 过失效清单闸门 → 日志依次出现「**正在续接第 18–19 章（保留已确认的第 1–17 章，不会覆盖）**」「正在写【单元 2…】起点 第4卷第2单元第1章（全书第18章）」，**没有再抛「检查点缺少正文」**。架构页 `断点续写大纲` / `续批（第 N 章起）` / `断点续写` 三个入口 **flag 全 false**。弹窗切关 → 单元块消失、章号起终点回来、不并存 → 切回开恢复。现场已复原（检查点逐字等于备份、`project.db` mtime 未变、配置回 `true`）。

**既有失败，不是本轮引入**：`batch-chapter-completion-mode` / `CodeMirrorEditor-generation` / `ReviewReport.confirmation` / `VolumeHandoffRegistryPanel` 四条 browser 红，已用 `git stash` 基线对照确认。

---

## 四、剩余未处理（如实登记，**四条都不阻塞本卡**）

> **2026-11-06 21:2x 作者已逐条答复，四条全部有了结论**，下表最后一行写结果。

| # | 事项 | 作者答复 / 现状 |
|---|---|---|
| ① | 章号区域读起来像「第 -5 -1 +1 +5 章」 | **不是算式 bug** —— 作者指出那是 `ChapterStepper` 的四个微调按钮（`[-5,-1,1,5]`），只是布局没调好。**已修**：四键改连体分段控件、每个「输入框 + 步进器 + 单位」包成不换行的组。实机截图 21:26 确认成组两行 |
| ② | 状态徽标「已覆盖至第 N 章 · 待续批」在卷单元模式下仍显示 | 作者：**「无伤大雅，只当是个提醒」⇒ 不改**。留痕备查，不再列为待办 |
| ③ | §12.10.5 四条已知边界（重置检查点仍被拦 / 旧模式 `:3500` 硬抛 / 检查点先写 DB 后 commit 的崩溃窗口 / 级联清空整表删与守卫冲突） | 作者：**「旧模式先不管」** ⇒ 本轮不动，D8 有意不修的范围继续有效 |
| ④ | 本轮提交未 push | 作者：**需要 push** ⇒ 已推 `origin/exp/resource-ledger` |

**下一班不需要再碰的四件事**：别把 ① 当「算式求值 bug」重查（那是布局，已修）；别去改 ② 的徽标文案；别动 ③ 的旧模式路径（作者明确「先不管」）；别复活「给右侧中断产物加取消按钮」。

---

## 五、红线与坑（新窗口开工前必读）

- **术语**：检查点里的 `synopsis_result` = **大纲生成物**（候选、未落稿）；DB 的 `synopsis` = **正式大纲**。写成「检查点正文」会直接推出错误的机制结论 —— 本班已经因此返工一次。
- **判据只认配置开关**：`unitRouteEnabled` 来自 `useSynopsisRouteStore`，不是探针算出来的 `unitMode`（作者 04:56）。组件挂载后**必须** `syncSynopsisRoute()`，否则 store 默认 `true` 会误藏旧路线入口。React hook 顺序：`unitRouteEnabled` 必须声明在探针 effect **之前**并进依赖。
- **实机通道**：`AI_NOVEL_UI_DEBUG_PORT=9222` 起 dev（先摘 `CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR` / `CODEBUDDY_TOOL_CALL_ID`）→ `playwright-core.connectOverCDP('http://127.0.0.1:9222')` → 页面内 `window.aiNovelAPI.invoke`。视口 1440×900，`y>900` 的坐标点不到 ⇒ 闸门「继续」必须 DOM `element.click()`；失效清单闸门要先勾「我明白…」再点「继续」；验证清场事件时 payload 要给**完整 `projectSession`**，且订阅组件必须已挂载。**动现场前先把 `partial_arch.json` 与 `project.db` 备份到 `.tmp-ui/d8-backup/`。**
- **测试入口**：`node scripts/run-tests-electron.mjs`（Electron ABI 145；裸 Node ABI 127 与 `better-sqlite3` 不兼容）。本机 `pnpm` 在 sh 里是坏的，hook / 脚本一律走 `node`。
- **并行 agent 只准单元测试**，browser 与全量测试只在主工作区串行。

---

## 六、下一步（本卡已无待办）

21:2x 作者逐条答复后，四条遗留全部有了结论（见第四节表格），**本卡没有需要下一班继续的事项**。若将来要往下走，只剩 §12.10.5 那批旧模式边界 —— 而作者已明确「旧模式先不管」，所以不要主动开工。

**别做的事**：不要复活「给右侧中断产物加取消按钮」；不要在卷单元模式下恢复任何断点续写入口；不要把「已实施」理解成「作者已认可最终产品形态」；不要把章号区域的四个微调键误判成「算式没求值」的显示 bug。

---

## 七、路径索引

| 内容 | 位置 |
|---|---|
| 现值唯一依据 | `docs/design/architecture/d8-checkpoint-degradation-design.md` §12.10（含 §12.10.4 验收实绩、§12.10.5 边界、§12.10.6 实机发现） |
| 开工前状态与事故复盘 | `docs/handoffs/2026-11-06-d8-preimplementation-handoff.md` |
| 缺陷总表条目 | `docs/design/product/live-pipeline-acceptance-defects-assessment.md` §D8 |
| 台账 | `prompt-assembly-backlog.md`（D8 行） |
| 现场日志 | `.workbuddy/memory/2026-11-06.md` |
| 本轮提交 | `566ca5d6`（13 files / +282 / −41）及前序 docs 提交 `9420908f` / `30c989e9` / `e52424f6` |
