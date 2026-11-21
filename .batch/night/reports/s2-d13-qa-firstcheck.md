执行方：QA · AI writer项目组
model：未取到环境自报（本机无 `DSH_MODEL`／provider 变量；判定不依赖此项）
判面 HEAD：`4d40bb5b`（分支 `card/s2-d13-failure-contract`，父 `0f0ca3ee`）
判据分母：`.batch/night/review-requests/s2-d13-failure-contract.md`（35 行 / 2,054B / sha256 `0bf0ef97278fe52a32afda44ba9c97f0d1af370b39766182e5f0c7c7acaab787`）+ 卡面 `.batch/night/cards/s2-d13-failure-contract.md`（82 行 / 8,215B / sha256 `44799021b069ec84e5597b80cd6512578beaff74280c218bfb952b66592a5597`）

## 0. 结论

**不通过（1 项：判据 5）。**（本节为首验记录，保留原样；复判见 §9，判面 `a4503f10` 后判据 5 已补正，全卡 5/5 通过。） 判据 1–4 实机全部成立，三档失败码、跨渲染层 `code`、`recovery_candidates` 落库（`visible_text` 实读）逐条有输出原文；**判据 5 不通过**——本分支 `pnpm test src/services/workflows/commands/__tests__/generate-draft.command.test.ts` 为 **1 failed | 254 passed**，`EXIT=1`，失败用例是既有不变量（`expect(error).not.toHaveProperty('code')`），成因是本提交新加的兜底赋值。
`pnpm check:fast` 本身 `EXIT=0`，但它不含测试；developer 报告里的「单测 EXIT=0」是 `-t` 过滤后只跑 1 例，未跑整文件，故自报与实测不符。

不返工实现主体：修法只需把兜底赋值限定在受控码路径（见 §5）。

## 1. 工作区与提交纪律

```
$ git log -1 --format='%h %s' 4d40bb5b
4d40bb5b feat(draft): D13 章节失败契约发码与保码，短细纲失败独立成码（CARD-S2-D13）
$ git rev-parse 4d40bb5b^
0f0ca3ee…（父提交，判据分母基线）
$ git diff --numstat 0f0ca3ee..4d40bb5b
528  0  scripts/s2-d13-failure-acceptance.mjs
 83  1  src/services/workflows/commands/__tests__/generate-draft.command.test.ts
 22  5  src/services/workflows/commands/generate-draft.command.ts
  8  0  src/shared/chapter-failure.ts
$ git status --porcelain | grep -v '^??'   → （空）
$ git branch -vv  → 无 upstream；远端无同名分支（未 push）
```

白名单核对：改动文件 4 个全在卡面 §4 允许区（`chapter-failure.ts` / `generate-draft.command.ts` / 新增验收脚本 / `__tests__`）；卡面 §3 禁改区（D12 注入与重跑、既有码值、`RootBudget` 键集）无改动——`src/shared/draft-short-outline.ts` 与 `src/services/workflows/commands/generate-draft.command.ts` 的 D12 段（`:1558-1600`）在 `git diff 0f0ca3ee..4d40bb5b` 中无命中。

## 2. 判据 1：三失败点各实机触发一次，各有唯一失败码 —— 通过

```
$ npx vite build; echo "BUILD_EXIT=$?"          → BUILD_EXIT=0
$ node scripts/s2-d13-failure-acceptance.mjs > /tmp/d13-acc.log 2>&1; echo "ACC_EXIT=$?"; tail -6 /tmp/d13-acc.log
[s2-d13] band-done:replay · code=DRAFT_PREVIOUS_ENDING_REPLAY
[s2-d13] band-start:no-progress
[s2-d13] band-done:no-progress · code=GENERATION_COMPOSITION_NO_PROGRESS
[s2-d13] quit
[s2-d13] quit-done
{"ok":true,"evidence":{"instancesThisRun":1,"leftoverElectronProcesses":0,"physicalModelRequests":0,"unclassified":0,"bands":{…}},"evidencePath":"C:\\develop\\workspace\\AI-writer\\develop\\.runtime\\.cache\\s2-d13\\8bfd6206-8dc\\evidence.json"}
ACC_EXIT=0
$ grep short-outline /tmp/d13-acc.log
[s2-d13] band-start:short-outline-fail
[s2-d13] band-done:short-outline-fail · code=DRAFT_SHORT_OUTLINE_FAILED
```

三档 `expectedCode` 与实测 `panelCode` 一一相同（`bands.*.panelCode` 原文见 §3）；`checks` 17 项全 `true`。run id：`8bfd6206-8dc`。
实例纪律三项：`instancesThisRun=1`、`leftoverElectronProcesses=0`、`physicalModelRequests=0`、`unclassified=0`（同一份 evidence，整轮记一次，符合卡面 §8）。

## 3. 判据 2：失败码带 `code` 且跨 IPC 到渲染层仍在 —— 通过

渲染层文本里读到的「错误码：」行原文（`bands.*.rendererCodeLine`，非主进程自报）：

| 档 | `rendererCodeLine` | `rendererKeepsCode` |
|---|---|---|
| short-outline-fail | `错误码：DRAFT_SHORT_OUTLINE_FAILED` | true |
| replay | `错误码：DRAFT_PREVIOUS_ENDING_REPLAY` | true |
| no-progress | `错误码：GENERATION_COMPOSITION_NO_PROGRESS` | true |

该行只由渲染层 `error.code` 渲染（脚本 `:204` 注释与 `:304` 正则；正文里不含码字面量），故三档均证明 `code` 跨 IPC 未丢。

## 4. 判据 3：`NO_PROGRESS` 时 `recovery_candidates` 有行 —— 通过

DB 实读（`node:sqlite` 直连本次 run 的项目库 `...\VibeCodingScratch\d13\p8bfd62\d13\.ai-novel\project.db`）：

```
$ node -e "const {DatabaseSync}=require('node:sqlite'); ... SELECT candidate_id, chapter_number, failure_code, length(visible_text) AS visible_text_len, status FROM recovery_candidates ORDER BY created_at"
[{"candidate_id":"b3a1d1f3-ebdf-4951-99d7-62932f1f73aa","chapter_number":2,
  "failure_code":"DRAFT_PREVIOUS_ENDING_REPLAY","visible_text_len":373,"status":"pending"},
 {"candidate_id":"7e80c96a-9b49-4a9c-b9cb-d41a173360f8","chapter_number":2,
  "failure_code":"GENERATION_COMPOSITION_NO_PROGRESS","visible_text_len":157,"status":"pending"}]
EXIT=0
```

- 字段名按 schema `visible_text`（`electron/migrations/baseline-schema.ts:145`），执行方脚本 `:286-290` 同名列，无自造列名。
- `chapter_number=2`＝本章；`length(visible_text)=157 > 0`；`failure_code=GENERATION_COMPOSITION_NO_PROGRESS` 就是该档码。
- 同表另有 replay 档 `373` 字节，属 D12 既有行为（重演保草稿），非本卡新增，登记不判。
- 三表另两表原文：`generation_attempts` 9 行（列见下）；`generation_runs` 2 行（`status=failed`，`SELECT run_id,status` 可读，但其列集 `run_id,root_action_id,binding_json,status,created_at_ms,open_key,execution_owner,execution_epoch,lease_expires_at` **无 `failure_code` 列**，脚本 `:291` 查该列报 `SqliteError: no such column: failure_code`——按负责人口径只登记、不纳入判定）。

## 5. 判据 4：界面两档文案（原因 + 可执行下一步）—— 通过

两档保草稿的候选卡文案原文（`bands.*.cardCopySample`）：

replay：
```
这一章为什么没写出来：生成的正文开头重演了上一章结尾，没有推进本章内容，结果未保存。
已保留：以下正文已留作候选，可复制或继续编辑。
可以试：修改上一章结尾，或调整本章开头的衔接设定
```
no-progress：
```
这一章为什么没写出来：合成后正文没有增长，续写没有进展，结果未保存。
已保留：以下正文已留作候选，可复制或继续编辑。
可以试：更换生成模型后重试
```
两档均含「原因」+「下一步」两项，不是「工作流未完成」一句。短细纲档 `cardDetailInPanel=false`/`cardSuggestionInPanel=false`：该档正文尚未开始、无候选可保留，界面只有「错误码：DRAFT_SHORT_OUTLINE_FAILED」一行，符合卡面 §2「只对 NO_PROGRESS 保草稿」的范围；脚本 `:498` 的 `cardCopy` 断言也只对 `expectsCandidate` 档生效，与此一致。

## 6. 判据 5：单测覆盖码传播与候选落库；`check:fast` 绿 —— 不通过

```
$ pnpm test src/services/workflows/commands/__tests__/generate-draft.command.test.ts
 ❯ src/services/workflows/commands/__tests__/generate-draft.command.test.ts:5964:23
 AssertionError: expected BoundedCompletionFailure: AI 未正常完成生成，结果未被… { …(2) } to not have property "code"
 - Expected: undefined
 + Received: "GENERATION_FAILED"
 Test Files  1 failed (1)
      Tests  1 failed | 254 passed (255)
EXIT=1
```

- 失败用例（既有，非本提交新增）：`it('does not turn untrusted failure text into a displayed code')`，`generate-draft.command.test.ts:5964` 断言 `expect(error).not.toHaveProperty('code')`；同用例还断言 `error.message` 不含 `synthetic-private-key`（该条仍过）。
- 因果：本提交在 `src/services/workflows/commands/generate-draft.command.ts:1878-1881` 新增
  `const failureCode = recoveryFailureCode(error, context.cancelled)` +
  `if (… typeof (error as { code?: unknown }).code !== 'string') Object.assign(error, { code: failureCode })`，
  兜底值 `GENERATION_FAILED` 落在**任意**无字符串 `code` 的失败上。父提交 `0f0ca3ee` 的 `Object.assign(error, …)` 只在 `:2240`、`:2246` 两处旧路径，不在本路径。
- 后果（卡外行为变化）：provider 侧失败以后，渲染层会多显示一行「错误码：GENERATION_FAILED」，而该用例的用意正是「不得把不可信失败文本变成可显示码」；本卡只要求三失败点有码，未授权改这条全局兜底。
- 未发现原因：`check:fast` 只跑 typecheck＋文档检查，不含测试；交件报告 `:123-126` 贴的两条单测命令都是 `-t "<用例名>"` 过滤跑，汇总行写着 `Tests 1 passed | 254 skipped  EXIT=0`——整文件从未被跑过，故 1 failed 没被发现。

`pnpm check:fast` 单独看是绿的（`EXIT=0`：typecheck ✓ 19.1s、doc links 1468/0、doc placement 438/0、batch-hygiene ✓），但它不能替代整文件测试。

## 7. 修法建议（供 developer 与负责人裁定，二选一）

1. **只对受控码赋值**（推荐）：把 `Object.assign(error, { code: failureCode })` 限定在「`failureCode` 来自 `chapter-failure.ts` 受控码表且 `error` 属于 chapter 失败类型」的分支，其余失败保持不带 `code`；随后整文件复跑应回到 255 passed。
2. **改该不变量用例**：若负责人认为「所有失败都该有码」是有意扩面，则须在群里明示改判据，并把该用例改为断言「码必须是受控码表内值、且消息不含不可信文本」——但这已超出本卡 §2 只证三失败点的范围，不建议在 D13 里顺带做。

复判方式：新提交面 + 整文件 `pnpm test` 汇总行 + 重跑一次验收脚本（三档码与候选行不变即可），我只复判判据 5。

## 8. 附注

- **A.** 行号均按判面 `4d40bb5b` 读；本卡未引入行号漂移。
- **B.** 判据 3 的两表（`generation_attempts` / `generation_runs`）按负责人口径「DDL 不在 baseline-schema、查询恒空」只登记不判；`generation_runs` 缺 `failure_code` 列属既有 schema 事实，非本卡缺陷。
- **C.** 本卡未改 D12 段：`git diff 0f0ca3ee..4d40bb5b -- src/shared/draft-short-outline.ts` 空；`generate-draft.command.ts` 的 22/5 差异全部落在失败出口与候选落库附近（`:1863-1910` 一带）与新增 `recoveryFailureCode`（`:512-522`）。
- **D.** 证据件：`.runtime/.cache/s2-d13/8bfd6206-8dc/evidence.json`（我这次跑的，不含 developer 的那次 run）。
- **E.** 未外派：实机复验按主人 11-21 19:07 裁定在 `develop` 由 QA 本人跑，无外派产物进入本判。

## 9. 复判（判面 `a4503f10`，2026-11-22 04:1x–04:3x）—— 判据 5 通过，全卡 5/5

判据分母（复判起）：派验单 `.batch/night/review-requests/s2-d13-failure-contract.md`（35 行 / 2,054B / sha256 `0bf0ef97278fe52a32afda44ba9c97f0d1af370b39766182e5f0c7c7acaab787`，未变）+ 卡面 `.batch/night/cards/s2-d13-failure-contract.md`（**84 行 / 8,966B / sha256 `701b10ef…97ef`**，负责人按裁定①改判据 5 与赋码边界后的版本）。

### 9.1 提交纪律（追加未 amend，可核）

```
$ git log --oneline -3
a4503f10 fix(draft): D13 赋码只对受控码表生效，词表外失败保持不带 code（CARD-S2-D13）
4d40bb5b feat(draft): D13 章节失败契约发码与保码，短细纲失败独立成码（CARD-S2-D13）
0f0ca3ee merge(card/d12-replay-retry): …（分叉点）
$ git diff --numstat 4d40bb5b..a4503f10
7  4  src/services/workflows/commands/generate-draft.command.ts
$ git status --porcelain -- src scripts      → （空）
$ git rev-parse --abbrev-ref 'a4503f10@{upstream}'
fatal: no such branch: 'a4503f10'            → 无 upstream，未 push
```

只动 1 文件 +7/−4，属裁定①的范围；`chapter-failure.ts`、测试文件、验收脚本在本次追加里零改动（`numstat` 只有一行可证）。

### 9.2 门控实现（提交面读）

```ts
// generate-draft.command.ts:1876-1881
const failureCode = recoveryFailureCode(error, context.cancelled)
if (error && typeof error === 'object' && typeof (error as { code?: unknown }).code !== 'string'
  && isChapterFailureCode(failureCode)) {
  Object.assign(error, { code: failureCode })
}
```

`isChapterFailureCode` 是 `src/shared/chapter-failure.ts:81` 的既有类型守卫；受控表 `CHAPTER_FAILURE_CODES` 含 `DRAFT_PREVIOUS_ENDING_REPLAY`（`:45`）、`DRAFT_SHORT_OUTLINE_FAILED`（`:49`）、`GENERATION_COMPOSITION_NO_PROGRESS`（`:72`），三档码均在表内 ⇒ 判据 2 的路径未被门控切断；兜底值 `GENERATION_FAILED` 不在表内 ⇒ 不再赋码。

### 9.3 判据 5：整文件汇总行 —— 通过

```
$ pnpm test src/services/workflows/commands/__tests__/generate-draft.command.test.ts
 ✓ src/services/workflows/commands/__tests__/generate-draft.command.test.ts (255 tests) 1136ms
 Test Files  1 passed (1)
      Tests  255 passed (255)
   Duration  2.79s
EXIT=0
```

与首验的 `1 failed | 254 passed (255)` 对照：`:5964` 的既有不变量恢复绿，失败的正是这一例；本卡 `:1878-1881` 的门控是唯一变量。汇总行按卡面 `:61`/`:63` 取整文件，非 `-t` 过滤。

### 9.4 抽检判据 2（受控码仍到渲染层）—— 通过

`npx vite build` → `BUILD_EXIT=0`；`node scripts/s2-d13-failure-acceptance.mjs; echo "ACC_EXIT=$?"` → `ACC_EXIT=0`，run `.runtime/.cache/s2-d13/222c67b6-314`（`evidence.json` 254,317B / sha256 `f9c73abb…f87bd`）。脚本按 §2.3 一启动单实例串跑三档，比「重跑单档」覆盖更全，实例纪律仍只记一次：

```
[s2-d13] band-done:short-outline-fail · code=DRAFT_SHORT_OUTLINE_FAILED
[s2-d13] band-done:replay · code=DRAFT_PREVIOUS_ENDING_REPLAY
[s2-d13] band-done:no-progress · code=GENERATION_COMPOSITION_NO_PROGRESS
instancesThisRun=1  leftoverElectronProcesses=0  physicalModelRequests=0  unclassified=0
```

三档渲染层「错误码：」行原文与首验逐字一致：`错误码：DRAFT_SHORT_OUTLINE_FAILED` / `错误码：DRAFT_PREVIOUS_ENDING_REPLAY` / `错误码：GENERATION_COMPOSITION_NO_PROGRESS`；候选行 `chapter_number=2 failure_code=DRAFT_PREVIOUS_ENDING_REPLAY length(visible_text)=373 status=pending` 与 `chapter_number=2 failure_code=GENERATION_COMPOSITION_NO_PROGRESS length(visible_text)=157 status=pending`，短细纲档 0 条，均与返工前一致 ⇒ 门控未改坏任何受控路径。

### 9.5 复判结论

**判据 5 通过 ⇒ 本卡 5 条判据全部通过（PASS）。** 首验的 1 项打回已闭环：修法按裁定①只对受控码表赋值，既有不变量未改、范围未扩。

- **F.** 工作区另有两处未提交改动属产品经理侧（`.batch/night/org/BACKLOG.md`、`docs/design/product/live-pipeline-acceptance-defects-assessment.md`），不在本卡 5 个文件内，不构成本卡 R4 违规，只登记。
- **G.** 首验 §0–§8 一律按判面 `4d40bb5b` 读，未改写；本复判只替换判据 5 的结论与分母。

<!-- DONE -->
