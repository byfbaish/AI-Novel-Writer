# S5 一次性实机 · 取证脚本要点（D5 已定，D15／D18 留空待提案）

- 取证基线：`17794aa9`（实测 `git rev-parse HEAD` = `17794aa9ce2ba02df2c7fb7b0e97f41d63e2d2b1`，与 D5 报告 §4 一致）
- 本件只出要点，不落地脚本、不改码；脚本在 apply 完成后写进对应 worktree 的 `.runtime/`（untracked）
- 阶段卡约束：实机只做**一次**、单实例、三卡证据一趟取完（`.batch/night/staging/s5-stage-card.md:8-11`）

## 一、D5 评审结论（三条，均已独立复算）

| # | 要核的点 | 结论 | 我的实测 |
|---|---|---|---|
| 1 | 档 A 零改是否真闭环 | **闭环，成立** | `plot_structure` 段（`src/services/builtin-prompt-templates.ts:701-868`）按守卫口径 `/<([^<>]+)>/g` 命中 **0**；守卫调用 `src/services/workflows/commands/architecture.command.ts:3228` → 告警块 `:3229-3237`（只有 `callbacks.log`）→ 写库 `:3240`；命令级测试 `src/services/workflows/commands/__tests__/architecture.command.test.ts:295-361` 三条 `it.each` 且断言 `db:project-core-update` 仍被调用 |
| 2 | `:701-868` 与 `:3228`→`:3240` 两条依据 | **都站得住** | 该段起于 `:701` `key: 'plot_structure'`（`:700` 是 `{`，`:699` 空行），止于 `synopsis` 段之前；`:3228` 守卫、`:3240` `writeArchToDb('plotStructurePlan', …)` 逐行读到 |
| 3 | 判据 3 怎么取才判得动 | **只能判到「模板侧无占位符」层**（见 §三） | 外派禁实机；群内合成模型下「真实生成」= 合成 fetch，见下 |

一处**数字口径**要注意（不影响结论，但影响判词与收口件写法）：大纲侧 `871-1032` 区间

- 有界正则 `'<[^<>]\{1,60\}>'`（D5 报告 §4 ④ 原文）→ **7 行 / 18 处**
- 无界正则 `/<([^<>]+)>/g`（`src/shared/arc-placeholder-guard.ts:32` 的实现口径）→ **7 行 / 20 处**

即：阶段卡 §6 收口必写句里的「7 行 20 处」只有在**无界（守卫口径）**下成立；报告 §4 ④ 的命令原文写的是 `{1,60}`，逐字跑出来是 18。判词引用这个数时须注明「按守卫口径（无界）复核 = 20」，不要直接引用 ④ 的命令行。

## 二、一次性实机的骨架（三卡共用一次启动）

1. **落点**：apply 完成后在承载三卡改动的 worktree 里写 `.runtime/s5-live.mjs`（untracked，不入库）；先 `node ./node_modules/vite/bin/vite.js build`（EXIT=0、dist 存在）再跑脚本，`launch()` 用 `loadFile(dist/index.html)`、删除 `VITE_DEV_SERVER_URL`。
2. **实例纪律**：`electron.launch({ cwd: <worktree>, args: ['.', '--user-data-dir=<临时目录>'] })`，只起 **一次**；结束 `app.quit`，父进程先死时连 Electron 子进程树一起收。
3. **实例三项进 evidence**（缺一项判词不收）：
   - `instancesThisRun: 1`
   - `exitCode: 0`
   - `leftoverElectronProcesses: 0`
   - `tasklistElectronRaw`：完整 `tasklist` 原文（`INFO: No tasks are running which match the specified criteria.`）
   - `tasklistGrepCountRaw`：`tasklist | grep -c electron` 的原文行（上一张卡漏过这一形式，本卡两种都记）
4. **合成模型**：注入 fetch 拦截，非目标 URL 计入 `physicalModelRequests` 并抛 `REFUSED`；evidence 记 `physicalModelRequests: 0`。
5. **采样口径**（`collab-rules-v1.md` §8 第 62 行）：`SAMPLE = { mode: 'stable-poll', minGapMs: 300, pollIntervalMs: 400 }`，两次读数相同且间隔 ≥ minGap 才采信，`sampleCount ≥ 2`，evidence 记每次读数时刻（ISO）。
6. **口径标注**：库造处一律注 `triggerMode`（`ui-save`／`ui-run`／`db-flip`）与「库造，非链路」。
7. **evidence 路径**：`.runtime/.cache/s5-live/<runId>/evidence.json`；同日随判词放 `staging/` 证据副本（第 13 条闸）。

## 三、D5 取证位（判据 3：真实生成一次、产物内占位符为 0）

**取法＝full-prompt-echo**：让合成模型把**收到的整段 prompt 原文**当作模型输出返回。这样「产物里的占位符」与「prompt 里的占位符」一一对应，占位符为 0 就真的说明模板侧不再教模型抄尖括号，而不是筛出来的。

步骤（同一实例内）：

1. 建项目（复用 `scripts/project-directory-grant.mjs` 的 `chooseProjectDirectoryGrant` ＋ `project:create`／`project:open`）→ 进入作品 → 打开「架构生成」对话框 `src/components/dialogs/ArchitectureConfirmDialog.tsx`，**只勾「卷 / 单元结构」**（`:55` `label: '卷 / 单元结构'`）→ 确认执行。
2. 拦截 fetch 拿到该步 prompt 原文 → 记为 `promptText`；合成模型把 `promptText` 原样返回。
3. 三条读数（都要进 evidence）：
   - **R1**：`hits(promptText).length` == 0（模板＋变量渲染后无占位符）
   - **R2**：`hits(echoedContent).length` == 0（模型输出无占位符；echo 模式下与 R1 同源，作为回路证明）
   - **R3**：写库后从 DB 读回 `plotStructurePlan` → `hits(dbContent).length` == 0（**这条才是「产物内占位符为 0」**，包含 `# 卷 / 单元结构` 标题）
4. `hits()` 用与生产同一口径：脚本内嵌 `src/shared/arc-placeholder-guard.ts:32-50` 的等价实现（11 行，纯函数、无依赖），evidence 记 `guardSourceRef: 'src/shared/arc-placeholder-guard.ts:32-50'` 并注明「复制实现」；另附一条静态旁证：`git show 17794aa9:src/services/builtin-prompt-templates.ts | awk 'NR>=701&&NR<=868'` 的命中数 = 0。

**判词边界（必须写进判词，不许含糊）**：合成模型下，判据 3 只能判到「**模板／渲染后 prompt 侧无占位符**」，**不能**判「真实模型是否仍会自行写出尖括号」；后者要 `physicalModelRequests ≥ 1`，一次取样也证不了 0。额度只剩 4%，是否花一次真实调用由主身裁——不花就按上面这层写 PASS 并注明边界，不许写成「实机证明模型不再抄占位符」。

**已知风险（脚本里要兜）**：echo 输出可能达数 KB，`plotStructurePlan` 落库若被截断，R3 会失真；脚本须比对「返回长度 == 落库长度」，不等则改为只 echo「输出格式段」并在 evidence 里记 `echoMode: 'format-section-only'`。

**收口句（主身 11-22 20:3x 定，判词照抄，不许换口径）**：D5 判据 3 的 PASS 句只写「按守卫无界正则口径复核＝7 行 20 处」＋「边界：判不了真实模型是否自写尖括号」；**不得引用**提案 §4 ④ 那条 `\{1,60\}` 命令（它跑出 18，口径不同，引用即自相矛盾）。

## 四、D15 评审与取证位（提案已到：`C:\tmp\s5-outbound\D15\proposal.md` 75 行／8,782B／`1ee6cca8…`）

### 4.1 判据面＝阶段卡两行，均在 `[static]`（卡面 `:18`／`:19`）

1. 卷内单元区间重叠 ⇒ 报 `VOLUME_UNIT_OVERLAP`、合法样态不报（单测原文）；
2. 面板消费该告警成句、不重复计数（`summarizeVolumeWarnings` 原文）。

**提案 §三 第 3 行「实机面板上能看到一次成句告警」不在阶段卡判据内 ⇒ 不作判据**（提案自己标了「不能判」，方向对）；那一次实机若顺带看到成句，只记旁证。**D15 不占实机证据集**，也就没有 `[live]` 判据。

「另有卡面件」这一疑问属实：仓内没有 `s5-d15*.md` 卡面，判据就在阶段卡 `:18`／`:19` 两行——apply 件照这两行立表，不许自己加行。

### 4.2 根因（提案 §一 逐条已核，全部成立）

`src/shared/volume-structure.ts:265` 逐卷建完即核 → `:175-188` `unitOverlapWarnings`（`:177-178` 滤 null 区间、`:179` 少于 2 段返回 `[]`、`:185`/`:186` 造两种告警）→ `src/shared/volume-unit-overlap.ts:60-112` 三档判定（`:65-67` 倒置、`:74-85` 两两求交、`:88-104` 按「覆盖单元集合」分组）→ `src/shared/volume-warning-summary.ts:32-54`（只数 `AMBIGUOUS`，`:44-45` 吞 overlap/inverted）→ `src/components/editor/VolumeHandoffRegistryPanel.tsx:231`、成句 `:603-607`；读侧 `electron/repositories/volume-structure-repository.ts:141-152` 每次重算，不用点重建。

### 4.3 apply 清单：**测试 only 一个文件**

`src/shared/__tests__/volume-structure.test.ts`（现 30 例）：

1. 在「只报不改」那例结尾（`:235`）之后插两例，用例名与断言照提案 §二 补丁 1；
2. 同文件加夹具 `PLAN_TWO_UNITS`／`SYNOPSIS_UNIT_ADJACENT`／`SYNOPSIS_UNIT_IDENTICAL`（照 `:192-196` 既有写法；plan 变量名不得与既有 `PLAN_NO_COUNTS`／`PLAN_THREE_UNITS`／`PLAN_DECLARED` 重名）；
3. 文件头补 `import { summarizeVolumeWarnings } from '../volume-warning-summary'`（模块实在 `src/shared/volume-warning-summary.ts`，路径正确）；
4. **既有 30 例一条不改**；不碰生产文件、不碰 `volume-warning-summary.ts`、不加 `VOLUME_UNIT_INVERTED` 出口（＝D15-②，另卡）。

### 4.4 我核过的三处口径（断言串不是猜的）

- 章号串：`volume-structure.ts:144-158` `chaptersText` 把连续章号压成 `7-9`、单章写 `8` ⇒ 全等用例断言 `VOLUME_UNIT_OVERLAP:1:1-2:7-9`／`VOLUME_UNIT_AMBIGUOUS:1:1-2:7-9` 与 `:184-186` 的格式串一致（既有断言 `:204` 的单章形态 `:8` 也对得上）。
- 相接不误报：`volume-unit-overlap.ts:34-38` `intersection` 以闭区间端点 `lo <= hi` 判有交，`10 <= 9` 为假 ⇒ `7-9`／`10-10` 交集为空，断言 `filter(startsWith('VOLUME_UNIT_'))` 为 `[]` 成立。
- 全等只计一次：`:74-85` 一对单元只产 1 条 overlap，`:88-104` 三章同属一组 ⇒ 1 条 ambiguous；`volume-warning-summary.ts:39-43` 只数 `AMBIGUOUS` ⇒ `ambiguousCount === 1` 成立。

### 4.5 门槛（写进 D15 apply 件）

`node node_modules/vitest/vitest.mjs run src/shared/__tests__/volume-structure.test.ts` → `Tests 32 passed (32)`（现 30 ＋ 新 2）＋末行 `EXIT=0`，只跑这一个文件；`git status --porcelain` 白名单外 0 行；`git rev-parse HEAD` 起点 `17794aa9`（实测 `17794aa9`）。

| 卡 | [live] 项（阶段卡 `:19`／`:23`） | 需要提案提供什么 |
|---|---|---|
| D15 | 面板消费 `VOLUME_UNIT_OVERLAP` 告警成句、不重复计数 | 触发路径（哪个面板/哪次运行）、需库造成什么样态（卷内单元区间重叠）、期望读数（告警句原文＋计数） |
| D18 | 定稿后标记在真实链路里出现一次 | **提案已到**（`C:\tmp\s5-outbound\D18\report.md` 240 行／30,769B／`639764dd…`），评审与取证位见 §六 |

D15 的合成模型不能用 echo：需要**行为型合成模型**（按 `purpose` 返回预置样例文本，覆盖卷内单元区间重叠样态）。等 D15 提案到了再定，本件不预设。

## 五、评审时我卡住的三条（先声明，免得提案越界）

1. **不动删除语义**：任何提案不得改 `writeArchToDb`／`synopsis-commit` 的覆盖或删除行为；告警只许 `callbacks.log`，不许 `throw`。
2. **不扩白名单**：提案涉及的文件必须落在阶段卡／卡面既有白名单内；要扩先改卡面留痕，不许让提案带着新材料进来。
3. **判据不让给提案**：提案只能说「这条判据我能判到什么层」；判据分层与 PASS 归 QA，判词口径归主身。

## 六、D18 评审（按 admin 11-22 20:3x 新口径：判据 2 = `[static]` 函数级＋生产未接线）

**apply 范围收敛为「C 环节一处 + 单测」**：A 两笔（`6509ec30`＋`79f0822d`，2026-11-04）不动；B 走 B-0 守裁定 ⑩（`docs/design/prompt/d18-chapter-hook-contract-design.md:431`「不删、不接、不在本稿启用」、`:774`）；提案自己的 B-1 建议不采纳。

### 6.1 改动清单（外部 Agent 照此可干）

1. `src/shared/hook-payoff-report.ts:43-59`（`summarizeDraftPayoffFindings`）：加稳定机读前缀 `[hook-unplanted] `。
   **我对提案的增量要求（必须照做）**：前缀**只在真有 `C5-unplanted` 时**出现，不许落到「只报蹭线 `C5-name-graze`」的行上——否则判据 4 的「出现一次」会被蹭线提示冒充。最小改法：先把 `problems` 拆成 `const unplanted = messagesOf(findings, 'C5-unplanted', uiText)`、`const graze = messagesOf(findings, 'C5-name-graze', uiText)`，再 `const marker = unplanted.length > 0 ? '[hook-unplanted] ' : ''`，正文用 `${marker}⚠️ 钩子未落地体检（C5）：${[...unplanted, ...graze].join('；')}。${hint}`。`findings.length === 0` 仍 `return null` 不变。
2. `src/shared/__tests__/hook-payoff-report.test.ts`：新增两条——①未落地命中 ⇒ `text.startsWith('[hook-unplanted] ')`；②蹭线-only ⇒ `not.toContain('[hook-unplanted]')` 且仍含「蹭线」。
3. **不动**：`src/services/workflows/commands/finalize-chapter.command.ts:971`（`if (hookReport) callbacks.log(hookReport)` 原样）、`src/shared/suspense-hook-alignment.ts` 及其实例、`blueprint-semantic-contract.ts`、模板 `:1094/1098/1176/1180`。
4. 白名单两文件；不新增文件、不动 `electron/`、不新增 IPC、**不写库**（写 `blueprints.notes`／`generation_artifacts`／draft 状态都不许）。
5. 现有断言不受影响：`hook-payoff-report.test.ts:44/66/80/85` 全是 `toContain`（前缀加在句首，`toContain('钩子未落地体检（C5）')` 仍成立）。

### 6.2 判据对照（新口径，四行）

| 判据 | 层 | 判法（命令/文件:行） | 现状 |
|---|---|---|---|
| 1 事件型收尾行允许写未决后果 | `[static]` 语义层 | `builtin-prompt-templates.ts:1094`／`:1176`（「事情已经发生、结果还没发生」）＋`:1098`／`:1180`（同一具名对象＋同一后果）＋`blueprint-semantic-contract.ts:59`＋反向锁 `blueprint-semantic-contract.test.ts:211-227` | 语义达标；字面仍是绝对句「它不是本章要完成的事件」（A-1 可选，主身定 A 不动 ⇒ 记账为记录项，不判 FAIL） |
| 2 实词无交集⇒警示不阻断 | `[static]` | 函数级：`suspense-hook-alignment.ts:58-67`＋`suspense-hook-alignment.test.ts:5-9`／`:11-15`；生产未接线：`git grep -n alignSuspenseHook 17794aa9 -- src electron | grep -v __tests__` 只剩定义本身 | 成立；判词必写「B 无生产判据＝裁定 ⑩，不是遗漏」 |
| 3 第 6 章被标、5／7 章不误标 | `[static]` | **只判第 6 章两向**（主身 11-22 20:4x 裁定 (a)）：`fixtures/c5-ch6-hook-planting.fixture.ts:29-35`＋`hook-payoff-audit.test.ts:86-108`；5／7 章**未覆盖、记账为记录项**，判词不许写「5／7 章已验」 | 成立（两向） |
| 4 定稿链路标记出现一次 | `[live]` | 群内那一次实机（§6.3） | 待实机 |

### 6.3 D18 取证位（判据 4）

1. **触发**：作者项目副本里对第 6 章走单章定稿（`src/services/workflows/chapter-workflow.ts:453` 那条 `FinalizeChapterCommand`），合成模型回一段**不落地钩子**的正文（用第 6 章旧钩子样本即可复现）。
2. **前置库造**：该章 `blueprint suspenseHook` 置为与正文无交集的旧钩子（`resolveHookText` `finalize-chapter.command.ts:1044-1069`，蓝图优先、缺则回退大纲钩子行）。**必须保证 `hookInput` 非空**——`:957` 是 `if (hookInput)`，为空时整段体检跳过，判据 4 直接不可判。
3. **读数（四条进 evidence）**：①`hookInput.hookText` 原文；②日志里 `[hook-unplanted]` 出现**恰好 1 次**；③同一段日志里「定稿内容已提交」仍在（证明只提示不阻断）；④`C5-unplanted` finding 计数 1（可由文案内问题条数旁证）。
4. **日志怎么取**：步骤日志**不落库**（`git grep "run-log\|step-log"` 零命中，`callbacks.log` 只走渲染层），所以从页面取：`document.body.innerText` 稳定取样后 `split('[hook-unplanted]').length - 1`；若日志面板有虚拟滚动/截断，改在渲染层 hook 住日志落点，evidence 记 `logCaptureMethod`。计数必须在定稿完成态下取，`sampleCount ≥ 2` 两次一致。

### 6.4 判据 3 的 5／7 章：**已裁定 (a)**（主身 11-22 20:4x）

本卡判据 3 只判**第 6 章两向**：真落地章带 `[hook-unplanted]` 恰 1 次、无 `hookInput` 章不带前缀。第 5／7 章**未覆盖**，作记录项记账（明细已进卡面留痕），判词**不许**写成「5／7 章已验」——仓内无样本、外派禁实机、不自造样本。若日后作者库导出第 5／7 章的「蓝图钩子 + 定稿正文」真实文本，另立卡补夹具，不在本卡扩范围。

### 6.5 建议的 apply 顺序（串行，一次一张）

1. **D5**：零改，不出实施件（只作只读验收，口径见 §一、§三）。
2. **D18**：`hook-payoff-report.ts` + 单测两文件，落 `git worktree add <dir> 17794aa9` 的新树（提案 §6.1 的基线告警成立：`agent/wb-main@89ec7014` 落后 76 个提交，不许就地落码）。
3. **D15**：待提案；它碰卷／单元告警链路，与 D18-C 无交集，排第三不阻塞。
4. 三卡落盘后 `vite build` → 群内**一次**实机（D5 §三 / D18 §6.3 / D15 待补）→ QA 一次复判。
