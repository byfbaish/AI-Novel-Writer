执行方：developer
取数件：卡 `.batch/night/cards/d12-replay-retry.md`（22,353B / 4D3F369F）· 派验单 `.batch/night/review-requests/d12-replay-retry.md`（3,582B / 2D0E2839）· 证据 `.runtime/.cache/d12-replay/40d5f024-1cb/evidence.json`（96,301B / 93190191）
model=DeepSeek-V4.1 | 倍率=— | provider=—

# D12 正文重演：带原因重跑一次 · 交件报告

**结论：卡 §4 逐条成立，`node scripts/d12-replay-acceptance.mjs`（提交面 `1ee3efd8`）全绿，末行 `{"ok":true,…}`、`EXIT=0`；一处**偏离**（重写请求 purpose，见 §6，负责人已裁定接受），其余按卡面口径。分支 `card/d12-replay-retry` 三笔提交，**未 push**。

## 1. 起止与改动面

- 起点 HEAD：`89ec7014`（卡面指定）
- 终点 HEAD：本报告所在提交（`git log --oneline -1`），其父为脚本提交面 `1ee3efd8`
- 分支上逐笔提交（不 amend，逐笔可查）：

| SHA | 提交信息 | 内容 |
|---|---|---|
| `f8d703c0` | `feat(draft): D12 重演命中后带原因整章重写一次（CARD-D12-replay-retry）` | 实现 + 单测 + 实机脚本 + 缺陷稿 + 本报告（含 QA 打回的 §4.2.7 两条子断言） |
| `4f2c62a4` | `test(draft): D12 实测脚本 candidates 实读 + 4 处判据补齐（CARD-D12-replay-retry）` | 脚本 5 处假读数/短路修正（§5.3 四列表） |
| `1ee3efd8` | `test(draft): D12 实测脚本末行输出后显式退出…（CARD-D12-replay-retry）` | 脚本收口：末行 JSON 后 `process.exit`，让调用方拿到真实 `EXIT`（§9.5） |
| 末尾一笔（仅本报告） | `docs(batch): D12 交件报告同步…` | 本报告自身更新（复跑证据、判据行号表、裁定结论），不含代码 |

- `git diff --numstat 89ec7014 HEAD`（本报告自身行数随编辑变动，故下表只列其余 5 件；报告行数见 `wc -l .batch/night/staging/d12-replay-retry-report.md`）

```
3	1	docs/design/product/live-pipeline-acceptance-defects-assessment.md
529	0	scripts/d12-replay-acceptance.mjs
448	1	src/services/workflows/commands/__tests__/generate-draft.command.test.ts
108	8	src/services/workflows/commands/generate-draft.command.ts
152	0	src/shared/__tests__/draft-short-outline.test.ts
```

- 点名 `git add` 逐个路径，无 `-A`/`-f`/`--no-verify`；未 push/tag/publish/merge。

- 行尾：改动 4 件 + 新脚本 CRLF 计数均为 **0**（`node -e` 读数，逐件 0）。
- 未加（§0 白名单）：`.batch/night/cards/d12-replay-retry.md`、`.batch/night/review-requests/d12-replay-retry.md`，以及 `.batch/night/staging/` 下他人未跟踪件。

## 2. 实现落点（改了什么）

`src/services/workflows/commands/generate-draft.command.ts`
- `:376` 新增导出 `measurePreviousChapterReuse(previousEnding, draft, language): { runs, units }`；`:424` 原 `hasSubstantialPreviousChapterReuse` 改为薄包装（语义与阈值不变，既有调用点不改判）。
- `:1558` 首稿算出后取统计；`:1560-1600` 在 `acknowledge(adoptedOutcome, initialVisibleDraft)` **之前**判定，命中且非续跑恢复时发一次「带原因整章重写」：messages = `[systemRole, \`${initialPrompt}\n\n${correction}\`]`，`draftReplayCorrectionText(language, {runs, units})` 中英逐字文案（卡 §2.2 原文）；重写稿替换 `initialVisibleDraft` 后再走 `acknowledge`。
- 重写请求**自身抛错**：`catch` 记一行「重写请求失败，沿用首稿」并回退首稿，不丢稿。
- `:1709-1720` 既有兜底闸保留，错误文案追加「已自动重写一次仍未通过（{runs} 处 / {units} 字）」。

`src/shared/draft-short-outline.ts`：**未改**（口径 v3 撤掉要点上限；仅复用既有导出，未加截断）。

## 3. §4.1 注入形态（`draft-short-outline.test.ts`，6 条全绿）

命令与输出原文：

```
$ pnpm test src/shared/__tests__/draft-short-outline.test.ts
 ✓ src/shared/__tests__/draft-short-outline.test.ts (27 tests) 7ms
```

| 卡 §4.1 | 用例 | 结果 |
|---|---|---|
| 1 按块计（结尾 ≤300 / 要点不设上限） | `按块计：结尾块 ≤300 码元，要点块整份带入，两块不合并算` | ✅ |
| 2 要点结构完整（394 / 576 两档） | `it.each` 两档：六栏标题全在 + `## 角色动态` 行数不变 + `## 伏笔与钩子` 条目数不变 | ✅ |
| 3 全文不在场（中段 ≤80 码元） | `全文不在场：上一章中段任一 80 码元连续片段都不出现在短细纲请求里` | ✅ |
| 4 要点为空 | `要点为空时只出现结尾块，不留空标题` | ✅ |
| 5 第 1 章无【前驱状态】 | 既有 `两块都空时返回空串（首章整块省略，不是错误）` | ✅ |
| 6 反向回归：正文仍含上一章全文 | `puts the %s previous-chapter notes in the short outline predecessor only` + 本卡新增 `feeds the %s short outline the whole long previous-chapter notes without truncation`（600+ 字要点整份透传，末尾哨兵「铜锣挂回钉上。」） | ✅ |

## 4. §4.2 重跑（`generate-draft.command.test.ts`，5 条全绿）

| 卡 §4.2 | 用例（本卡新增 5 条 + 既有 1 条扩为同向断言） | 结果 |
|---|---|---|
| 7 首稿重演 + 重写干净 | `rewrites the chapter once with the reason attached when the first draft replays the previous ending`（恰 2 次正文请求；第 2 次 user = 第 1 次 + `\n\n` + 【修正说明】含 `1 处、共 500 字`——`startsWith(首稿 user + "\n\n【修正说明】")` 断言整段前缀相等；追加段里首稿任意连续 8 码元都不出现；compose 1 次只含重写片；commit 1 次） | ✅ |
| 7-补 子断言口径（QA 首验打回后补） | 两条子断言原报告标 ✅ 但用例里没有，现按 QA 要求补进用例本身（`:1070-1090`）。第二条例外说明：**无法**断言「整段重写请求不含首稿 8 码元」——首稿 prompt 本身合法带入上一章结尾 300 字（本夹具上一章＝500 个「潮」），重叠由 prompt 决定而非修正说明；故判的是「`rewriteUser` 去掉共享前缀后的追加段」，等价于「原因之外没多塞正文」 | ✅ |
| 8 两次都重演 | 新增 `fails with the auto-rewrite note when the reasoned rewrite replays the previous ending again`（正文请求 2 次、commit 0、候选 1 且 `failureCode=DRAFT_PREVIOUS_ENDING_REPLAY`、抛 `已自动重写一次仍未通过（1 处 / 500 字）`）；另既有 `still rejects previous-chapter replay in an over-limit main-owned draft` 已同向收紧（purposes 四项、重写带【修正说明】、候选 1） | ✅ |
| 9 首稿干净不重跑 | `does not send a reasoned rewrite when the first draft is clean` | ✅ |
| 10 重写请求抛 provider 错 | `keeps the first draft when the reasoned rewrite request itself fails`（请求 2 次、compose 只签收首稿、日志含「重写请求失败，沿用首稿」、最终闸按现行为抛） | ✅ |
| 11 续写/压缩轮不触发 | `does not reason-rewrite on a continuation round that only replays after merging` | ✅ |

点名套件（§4.4）命令与输出原文：

```
$ pnpm test src/shared/__tests__/draft-short-outline.test.ts src/services/workflows/commands/__tests__/generate-draft.command.test.ts
 ✓ src/shared/__tests__/draft-short-outline.test.ts (27 tests) 7ms
 ✓ src/services/workflows/commands/__tests__/generate-draft.command.test.ts (254 tests) 1140ms
 Test Files  2 passed (2)
      Tests  281 passed (281)
   Start at  18:18:18
```

## 5. §4.3 实机复验（命令 + 输出原文）

本次复跑用的是**提交面版本**（`1ee3efd8`）；运行前后工作区文件与该提交的字节一致，证明见 §5.2。

```
$ node scripts/d12-replay-acceptance.mjs; echo "EXIT=$?"
[d12] launch-1
[d12] import-chapter-1
[d12] seed-notes
[d12] click-write-chapter-2
[d12] clean-prose-visible · 5001ms
[d12] draft-persisted
[d12] requests-dumped · 3 份 · 7095/14621/14931B
[d12] main-state
[d12] page-calls
[d12] rows-read
[d12] quit
[d12] quit-done
{"ok":true,"evidence":{"endingBlockUnits":263,"endingBlockNonEmpty":true,"notesSixColumnsPresent":true,"notesHeadingsInPrompt":6,"notesTableRowsUnchanged":true,"notesHooksCountUnchanged":true,"notesBlockUnits":304,"notesSourceUnits":301,"outlineMidMaxOverlapUnits":39,"proseContainsFullPrevious":true,"proseDispatches":2,"retryHasCorrection":true,"retryLeaksDraftFragment":false,"composeCalls":1,"drafts":1,"candidates":0,"physicalModelRequests":0,"embeddings":1,"unclassified":0,"correctionText":"【修正说明】上一稿开头与上一章结尾连续重合 1 处、共 260 字。请整章重写：从上一章最后一个动作结束之后的时间点起笔，只写本章新发生的事件；不得复述、确认或回放上一章已经发生的事件、动作与意象，也不得摘要上一章。","outlinePromptChars":2583},"evidencePath":"C:\\develop\\workspace\\AI-writer\\develop\\.runtime\\.cache\\d12-replay\\40d5f024-1cb\\evidence.json"}
EXIT=0
```

> 逐字复制自本次运行日志 `.runtime/d12-final.log`；`EXIT=0` 来自同一次运行的退出码（`node …; echo "EXIT=$?"`，退出码落在 `.runtime/d12-exit.txt`）。本卡历次全绿复跑共 6 次（`9dc2c111-b2d` / `f79cc24b-0cb` / `40d5f024-1cb` / `7777de8f-520` / `c357c17b-74b` / `40d5f024-1cb`），除新增字段外 `evidence` 逐字节一致。

### 5.2 提交面同值证明

```
$ git show 1ee3efd8:scripts/d12-replay-acceptance.mjs | sha256sum
e1d85101f2564e76d9fa9fc5d0aaaf86182b79b019a0d451cce1992defc48ac6  -
$ sha256sum scripts/d12-replay-acceptance.mjs
e1d85101f2564e76d9fa9fc5d0aaaf86182b79b019a0d451cce1992defc48ac6  scripts/d12-replay-acceptance.mjs
$ git status --porcelain -- scripts/d12-replay-acceptance.mjs | wc -l
0
```

### 5.3 判据 ↔ 脚本行 ↔ 不满足时的输出（QA 要的五行表）

`expected` 判据表在 `scripts/d12-replay-acceptance.mjs:489-496`；任一条不满足 → stderr 打 `[d12] FAILED: <字段名, …>`、末行 JSON 变 `{"ok":false,"failed":[…],…}`、**退出码 1**，`evidence.json` 仍照写（失败现场可直接对读）。

| 卡面判据 | 脚本行（`scripts/d12-replay-acceptance.mjs`） | 不满足时输出 |
|---|---|---|
| `endingBlockUnits` ≤300 且结尾段**非空** | `:440` 取段 · `:464` 计量 · `:465` `endingBlockNonEmpty` | `FAILED: endingBlockUnits`（段缺失时先命 `endingBlockNonEmpty`，不再 fail-open 成 0） |
| 六栏标题全在（判**要点块**，不是整份 prompt） | `:467` `notesSixColumnsPresent` · `:468` `notesHeadingsInPrompt`（对照值） | `FAILED: notesSixColumnsPresent`；`notesHeadingsInPrompt<6` 可从 evidence 看出是缺栏还是模板命中 |
| `## 角色动态` 表行数不变 / `## 伏笔与钩子` 条目数不变 | `:469` `notesTableRowsUnchanged` · `:470` `notesHooksCountUnchanged` | `FAILED: notesTableRowsUnchanged` / `FAILED: notesHooksCountUnchanged` |
| `outlineMidMaxOverlapUnits` ≤80 | `:441` 取上一章中段 · `:442` `longestSharedRun(…,200)` · `:473` | `FAILED: outlineMidMaxOverlapUnits` |
| `proseContainsFullPrevious`=true（**整段** 300 码元探针）+ `proseDispatches`=2 | `:475` `includes(CH1_TAIL)` · `:476` · `:433-436` 分类 | `FAILED: proseContainsFullPrevious` / `FAILED: proseDispatches`（探针若改回 120 码元即为放宽，未做） |
| `retryHasCorrection`=true / `retryLeaksDraftFragment`=false | `:449-450` 显式取修正段（取不到＝空串，不用 `slice(-1)`） · `:477-478` | `FAILED: retryHasCorrection` / `FAILED: retryLeaksDraftFragment` |
| `composeCalls`=1 | `:453` 从 `generation_attempts.usage_receipt_json` 数 `visibleComposition` | `FAILED: composeCalls`（>1 说明发生了续写/压缩签收） |
| `drafts`=1 | `:477`-邻 `:480` `chapter2Drafts.length` | `FAILED: drafts` |
| `candidates`=0（**实读** `recovery_candidates`） | `:302` SQL 查询 · `:482` `out.rows.candidates.length` | `FAILED: candidates`（表里有任何一行即失败，不再写死 0） |
| `physicalModelRequests`=0 | `:483` · `:484` `embeddings` · `:485` `unclassified` | `FAILED: physicalModelRequests` / `unclassified`（合成拦截漏网的请求会落在这里） |

这 5 处（`candidates`、`endingBlockNonEmpty`、六栏改判要点块、`correction` 显式空串、整段探针）的四列审计原文见 `.batch/night/staging/d12-developer-field-audit.md`（14 栏逐条：字段名／源码行号／实读取值原文／结论）。

字段对表（卡 §4.3 → 实测）：

| 字段 | 要求 | 实测 |
|---|---|---|
| `endingBlockUnits` | ≤300 | **263** |
| `endingBlockNonEmpty` | true（新增，防段缺失 fail-open） | **true** |
| `notesBlockUnits` | 只记录 | 304（源 301） |
| `notesSixColumnsPresent` | true | **true**（判要点块） |
| `notesHeadingsInPrompt` | 参照值（模板命中数） | **6** |
| `notesTableRowsUnchanged` | true | **true** |
| `notesHooksCountUnchanged` | true | **true** |
| `outlineMidMaxOverlapUnits` | ≤80 | **39** |
| `proseContainsFullPrevious` | true | **true**（整段 300 码元探针） |
| `proseDispatches` | 2 | **2**（outline 之外：replay + clean） |
| `retryHasCorrection` | true | **true** |
| `retryLeaksDraftFragment` | false | **false** |
| `composeCalls` | 1 | **1** |
| `drafts` | 1 | **1** |
| `candidates` | 0 | **0**（`recovery_candidates` 实读，0 行） |
| `physicalModelRequests` | 0 | **0** |
| `unclassified` | 0 | **0** |

请求体可回读（`evidence.json` 的 `dispatch[].bytes/sha256/file`，同目录 `requests/` 下即原文）：

| 请求 | 路径 | 字节 | sha256 |
|---|---|---|---|
| 短细纲 | `…\40d5f024-1cb\requests\01-outline.txt` | 7,095 | `44ac839655771153e042d01353a1f3f5a19bb5f99b6d3643792c678089a6953e` |
| 正文首稿（重演） | `…\40d5f024-1cb\requests\02-replay.txt` | 14,621 | `8ab081c2208b01c107e4e5a37adb85001f78cdfde2a297fd3845c3406728a686` |
| 带原因重写 | `…\40d5f024-1cb\requests\03-clean.txt` | 14,931 | `4954373ba00956b76d828c78fe21b2cd4550d2b495657781147225f4ec747ff4` |

完整路径前缀：`C:\develop\workspace\AI-writer\develop\.runtime\.cache\d12-replay\40d5f024-1cb\`

脚本做了什么（供 QA 复跑对读）：dist 构建 + 真实 Electron（`electron.launch({cwd: repo, args:['.', '--user-data-dir=…']})`）+ 真实 SQLite/LanceDB；主进程里覆写 `globalThis.fetch`，非 `api.openai.com` 一律拒绝，合成响应按**调用次序**分类（第 1 次正文=重演夹具，第 2 次=干净夹具；短细纲/要点/角色卡按 prompt 特征）；第 1 章定稿用 `db:draft-import-finalized-batch`（`wordCount` 走 `countDraftUnits`）+ 主进程内 `better-sqlite3` 直写 `summary_snapshots`（定稿后处理链需 `GENERATION_FINALIZATION_ADMISSION`，裸 IPC 写不了要点）；随后走真实 UI：打开项目 → 章节蓝图 → 「写作第2章」 → 目标字数 100 → 「开始创作」。`composeCalls` 从库读权威证据（`generation_attempts.usage_receipt_json.visibleComposition` 计数），不依赖页面计数器。

## 6. 偏离项（须裁）

**重写请求的 purpose：卡 §2.2 写「attempt 序列自然多一条 `purpose=chapter-draft`」，实现为 `chapter-draft-no-progress-recovery`。**（**已裁定接受**：项目总负责人 2026-11-21 判「接受、不动主进程」，附条件——单测断言该 purpose 值、说明对可见语义无副作用，两条均已满足：测试 `generate-draft.command.test.ts:990` 显式断言 purpose 值；`generationOutputForPurpose` 对白名单变体回退 primary＝visible-text，签收/预算/compose 语义与首稿一致。）

- 证据（关闸原文）：`electron/services/main-generation-owner.ts:590-630`——`materialDecision.shortOutlinePromptHash` 存在且 `task.purpose === 'chapter-draft'` 时，第二份 `chapter-draft` 必须 `textHash(stripDraftShortOutlineBlock(userPrompt)) === materialDecision.promptHash` **且**与 `outline.initialDraftTask` 深度不等；实测附加【修正说明】后直接抛 `GENERATION_MATERIAL_PROMPT_MISMATCH`（`[d12-debug] rewrite failed … GENERATION_MATERIAL_PROMPT_MISMATCH`，调试日志已删），请求根本没到模型。放行变体只有 `['chapter-draft-continuation','chapter-draft-no-progress-recovery','chapter-draft-condense']`（`:607`），且 `generationOutputForPurpose` 对它们回退 primary（visible-text）。
- 处置：改 purpose 为白名单内的 `chapter-draft-no-progress-recovery`（不新增 purpose、不新增列/IPC、不改主进程），并在代码注释与单测里写明原因。`generate-draft.command.ts:1570`、测试 `:987/:990`。
- 影响面：只影响 attempt 记录里的 purpose 字样；对用户可见行为、预算、compose/commit 语义无差异。
- 备选（需裁才动）：放开 `chapter-draft` 对「附加修正说明」的深度相等判定——属 `electron/services/main-generation-owner.ts`，**在本卡 §3 改文件清单之外**，我未动。

## 7. 缺陷稿改动（§2.3 逐字）

`docs/design/product/live-pipeline-acceptance-defects-assessment.md:62` ✅→🟡 逐行替换 + D12 段末追加一段。diff 原文：

```diff
@@ -62 +62 @@
-| D12 | 阻塞 | ✅ **结案（2026-11-08 · 判定为 9B 模型弱点，非 App 缺陷；直连复跑 10 次 3 干净 / 5 重演 / 2 失控，与 App 内同量级）** | 正文重演被丢弃且无重试、无回流。**真因是短细纲把上一章全文当成本章任务**，不是校验过严（见「第二轮实测」）。修法 = R6 短细纲砍全文（要点 + 结尾 ≤300 字）+ 判据改结构化对应，`ba3d4bc5` | `generate-draft.command.ts:1536`（拦截）；`chapter-materials.ts`（`previousChapterEnding(content, maxChars)`）；`draft-short-outline.ts`（`draftShortOutlinePredecessor`）；合并稿 `previous-chapter-context-assessment.md` §8/§9 |
+| D12 | 阻塞 | 🟡 **重开（2026-11-21 · S1）**：注入形态已由 R6 落地、待实机锁定；命中后「零重跑」为 App 侧缺口，本轮补「带原因重跑一次」 | 正文重演被丢弃且无重试、无回流。**两半条**：① 注入形态——短细纲只收「要点整份 + 结尾 ≤300」，不收上一章全文（R6，现头 `generate-draft.command.ts:1205-1224`）；正文链路仍按 R2/R3 收上一章全文（`chapter-materials.ts:608-624`，required 不裁）。② 失败处理——重演命中后按判法（不给例子）整章重写一次，仍命中才落候选。11-08 的「9B 模型弱点」结论只解释「模型会重演」，不覆盖「命中后零重跑」。判据与证据见 `.batch/night/cards/d12-replay-retry.md` | `generate-draft.command.ts:361-402`（判据）、`:1616-1621`（拦截）、`:1347-1362`（compose）；`draft-short-outline.ts:58`（300） |
@@ -852,0 +853,2 @@
+> **2026-11-21 S1 重开口径**：11-08 结案依据为直连复跑（3 干净/5 重演/2 失控），只证明「模型会重演」，未覆盖「命中后零重跑」，且注入形态从未实机锁定。本轮按两半条补齐：注入形态补单测 + 实机读数；重跑补一次带原因整章重写。验收证据见 `.batch/night/reports/d12-replay-retry-qa-firstcheck.md` 与本卡 §4。
+
```

- 该行按卡 §2.3 逐字替换；其中 `generate-draft.command.ts:361-402`/`:1616-1621`/`:1347-1362` 是**卡面原文的行号**，本卡改动后实际位置为 `:376-429`（判统计量）、`:1709-1720`（拦截闸）、`:1340-1365` 一带（compose 签收）。按「不擅自改写卡面逐字件」的要求未改数，仅在此标注，供 QA 判断是否要另开一次行号订正。
- 文件行尾仍为 LF（CRLF=0），改后 156,746B。

## 8. 回归与门禁（§4.4）

```
$ pnpm check:fast
[check:fast] typecheck ✓ 25.1s
doc links: checked 1468, broken 0
[check:fast] doc-links ✓ 1.5s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.2s
0 项不合规
[check:fast] batch-hygiene ✓ 2.2s
[check:fast] 全部通过。
```

既有用例未改判：`still rejects previous-chapter replay in an over-limit main-owned draft` 的 purposes 断言由 3 项扩为 4 项（本卡必然多一次正文请求），其余断言原样；其余既有用例零改动。

点名套件（`1ee3efd8` 时点复跑）：

```
$ pnpm test src/shared/__tests__/draft-short-outline.test.ts src/services/workflows/commands/__tests__/generate-draft.command.test.ts
 Test Files  2 passed (2)
      Tests  281 passed (281)
   Duration  4.61s
EXIT=0
```

## 9. 脚本工程注记（QA 复跑会撞到的五处）

1. **`app.close()` 偶发挂住**：真实链路上渲染层若还挂着发布流/对话框，Electron 不退出，脚本会停在这一步且写不出证据（实测两次）。已改成「`app.close()` 与 20s 定时器赛跑，超时后 `app.process().kill()`」。复跑若见 `[d12] quit` 后长时间无输出，就是这一处。
2. **清理 `scratch` 会 EPERM**：强杀后 Electron 的 `user-data-dir` 仍被锁，`rmSync` 抛 `EPERM`（实测一次把进程带崩、证据已写但 stdout 的末行 JSON 丢了）。已改成 `maxRetries: 5` + `try/catch`，清理失败不影响判据。
3. 夹具定尺：章节目标字数 100（`draftTargetUnitRange` = 70–130、`draftAimLowUnits` = 85），所以干净稿定为 118 字 / 106 units——**不触发续写（>85）、不触发压缩（<130）**，正文请求恰 2 次、签收恰 1 次；这也是 `composeCalls=1` 的必要条件，改字数会连带改变该字段。
4. `db:draft-import-finalized-batch` 必须四参 `[request, projectPath, projectSessionContext]`；`wordCount` 必须是 `countDraftUnits(content)`（不是码元长度），否则报「第 1 章字数与正文不一致」。
5. **末行 JSON 后进程不退出**（实测两次：`.runtime/d12-exit.txt` 十分钟不落、外层 shell 收不到 `EXIT=`）：playwright 与 Electron 的驱动连接在应用被强杀后仍持有句柄，事件循环不排空。已在 `:526-529` 收口 `await new Promise(r=>setTimeout(r,50)); process.exit(process.exitCode ?? 0)`（提交 `1ee3efd8`）。**QA 复跑若见 JSON 已出但命令不返回，就是拿到旧版本脚本了**；取退出码请用 `node scripts/d12-replay-acceptance.mjs; echo "EXIT=$?"`。

## 10. 已裁与未覆盖

- **已裁 1**：§6 的 purpose 偏离——项目总负责人判「接受、不动主进程」（附条件已在 §6 满足）。
- **已裁 2**：§7 的缺陷稿行号——负责人判「一律算起点 `89ec7014` 基线引用，不另开订正」。
- **新报（本轮静态审计发现的真缺陷）**：`candidates` 原为 `? 0 : 0` 写死常量，从未真实判定；已改实读 `recovery_candidates`（`:302` / `:482`）。同轮另补 4 处 fail-open（§5.3 与 `.batch/night/staging/d12-developer-field-audit.md`）。
- 未覆盖（我的边界外）：QA 侧独立复跑与判词；产品经理在 PASS 后把 `:62` 转 ✅。

<!-- DONE -->
