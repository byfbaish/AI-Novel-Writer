# D12 实机脚本 §4.3 字段可判性自审（developer）

取数面：`scripts/d12-replay-acceptance.mjs` 工作区 515 行 / 31,340B / sha256 `334b69ec…9e45`；
基线提交面 `f8d703c0:scripts/d12-replay-acceptance.mjs` 除 `candidates` 三行外与工作区相同（`git diff --numstat` 3/−2）。

四列固定：**字段名｜源码行号｜实读取值（贴原文）｜结论**。结论取「可判／需二次计算／不可判」。
审计方法：逐字段回溯到「值从哪来」，凡出现 `? 0 : 0`、`?? 0`、`|| 0`、字面量直赋、空串兜底后仍能过判据（fail-open）的，一律记缺口。

| 字段名 | 源码行号 | 实读取值（原文） | 结论 |
|---|---|---|---|
| endingBlockUnits | `:461`（值来自 `:440`） | `endingBlockUnits: units(endingBlock),`；`const endingBlock = sectionOf(outlinePrompt, '（只用于承接语气、未完成的动作与站位）：').trim().split('\n【')[0].trim()` | **需二次计算**（`units` 数码元）；**缺口①**：`sectionOf` 找不到标题时返回 `''`（`:99`），`units('')` = 0 ≤ 300 直接过闸 → fail-open，无「段非空」断言 |
| notesSixColumnsPresent | `:462` | `notesSixColumnsPresent: SIX_COLUMN_HEADINGS.every(heading => outlinePrompt.includes(heading)),` | **需二次计算**（六项 `.every`）；**缺口②**：判的是**整份 prompt**而非要点块，章节要求模板里若也含同名标题即可假过 |
| notesTableRowsUnchanged | `:463` | `notesTableRowsUnchanged: dataRowCount(notesBlock) === dataRowCount(NOTES),` | **需二次计算**（两侧都用 `dataRowCount` `:104-107`，减 1 去表头）；两侧同口径，可判 |
| notesHooksCountUnchanged | `:464` | `notesHooksCountUnchanged: hookItemCount(notesBlock) === hookItemCount(NOTES),` | **需二次计算**（`hookItemCount` `:108-111` 数 `- ` 行）；可判 |
| notesBlockUnits | `:465` | `notesBlockUnits: units(notesBlock),` | **需二次计算**；无判据（只记录，卡 v3 已明确不判红） |
| notesSourceUnits | `:466` | `notesSourceUnits: units(NOTES),` | **可判**（读夹具常量 `NOTES` `:62-82`）；无判据，只做对照 |
| outlineMidMaxOverlapUnits | `:467`（值来自 `:442`） | `const midOverlap = longestSharedRun(previousMiddle, outlinePrompt, 200)` | **需二次计算**（`longestSharedRun` `:117-123` 从 cap=200 往下找最长命中窗口）；cap 200 > 判据 80，不会因截断假过 |
| proseContainsFullPrevious | `:468` | `proseContainsFullPrevious: initialDispatch.prompt.includes(CH1_TAIL.slice(-120)),` | **需二次计算**（子串命中）；**缺口③**：只取上一章结尾最后 120 码元做探针，而 `CH1_TAIL` 是 300 码元，探针短于卡面口径（「含上一章全文」），建议改成整段 300 |
| proseDispatches | `:469` | `proseDispatches: proseDispatches.length,`（过滤 `:435`） | **可判**（dispatch 日志按 mode 计数，原文可回读） |
| retryHasCorrection | `:470`（值来自 `:448`） | `const correction = retryDispatch.prompt.slice(retryDispatch.prompt.indexOf('【修正说明】'))` | **需二次计算**；**缺口④**：`indexOf` 为 −1 时 `slice(-1)` 取末字符而非空串，`Boolean(correction)` 恒真，报错文案会误导（判据结果仍为 false，不假过） |
| retryLeaksDraftFragment | `:471` | `retryLeaksDraftFragment: correction.includes(REPLAY_PROSE.slice(-40)),` | **需二次计算**（负向子串）；与缺口④联动：`correction` 为空串时恒 false → 这一栏会静默通过 |
| composeCalls | `:472`（值来自 `:451`） | `const composeCalls = out.rows.attempts.filter(row => String(row.receiptJson ?? '').includes('visibleComposition')).length` | **需二次计算**（扫 `generation_attempts.usage_receipt_json`）；`?? ''` 只影响缺列行，不产生假读数（缺列 → 不含关键字 → 不计数），可判 |
| drafts | `:473`（值来自 `:458`） | `const chapter2Drafts = out.rows.drafts.filter(row => row.chapter === 2)` | **可判**（`drafts` 表实读 `:299`，含 `status` 原文可回读） |
| candidates | `:475`（值来自 `:302`） | `candidates: out.rows.candidates.length,`；`db.prepare('SELECT chapter_number AS chapter, failure_code AS failureCode, status FROM recovery_candidates ORDER BY created_at').all()` | **可判**（已由写死 `? 0 : 0` 改为实读；`f8d703c0` 上该栏**不可判**，过去读数无意义） |
| physicalModelRequests | `:476`（值来自 `:173`） | `out.mainState.physicalModelRequests` ← `state.physicalModelRequests += 1`（拦截器内计数） | **需二次计算**（拦截器自计数）；fail-open 风险由 `proseDispatches≥2` 与 `out.dispatch` 三份落盘兜住（拦截器没装上就抓不到请求、流程走不下去） |
| embeddings | `:477`（值来自 `:166`） | `out.mainState.embeddings` ← `state.embeddings += 1` | **需二次计算**；无判据（只记录） |
| unclassified | `:478`（值来自 `:185`） | `out.mainState.unclassified` ← `if (mode === 'unknown') { state.unclassified += 1 }` | **需二次计算**；判据为 0，即「三份请求全被分类」 |
| outlinePromptChars | `:480` | `outlinePromptChars: outlinePrompt.length,` | **可判**（UTF-16 长度）；无判据，只做对表 |

## 缺口汇总（拟一次性补齐，一笔提交）

1. **缺口①** 加 `endingBlockNonEmpty: endingBlock.length > 0` 并纳入 `expected`（`=== true`），堵 fail-open。
2. **缺口②** `notesSixColumnsPresent` 改为在 `notesBlock` 上判（与表行数/钩子数同域），保留整份 prompt 命中作为附带字段 `notesHeadingsInPrompt`（不判红）。
3. **缺口③** `proseContainsFullPrevious` 探针由 `CH1_TAIL.slice(-120)` 改为整段 `CH1_TAIL`（300 码元），与卡面「含上一章全文」同宽。
4. **缺口④** `correction` 取值改为 `const at = retryDispatch.prompt.indexOf('【修正说明】'); const correction = at < 0 ? '' : retryDispatch.prompt.slice(at)`，让「没有修正段」显式成空串；`retryLeaksDraftFragment` 同时纳入 `expected` 前先断言 `correction` 非空（由 `retryHasCorrection` 先红）。

不改判据阈值、不改夹具、不动 §2.2 的 attempt 序列口径。
