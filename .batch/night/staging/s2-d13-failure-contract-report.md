执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot

# S2 · D13 章节失败契约（发码 + 保码 + 保草稿）交件报告

- 卡：`.batch/night/cards/s2-d13-failure-contract.md`
- 分支：`card/s2-d13-failure-contract`（起点 `0f0ca3ee`，一卡一分支，未合并、未 push）
- 设计稿：`docs/design/architecture/d13-chapter-failure-contract-design.md`（§5.1 契约 / §5.4 跨进程保码 / §5.5 汇聚出口 / §7 裁定 1=B、2=A、3=A）
- 验收脚本（卡 §4 允许的唯一新文件）：`scripts/s2-d13-failure-acceptance.mjs`

## 1. 改了什么（全部在卡 §4 白名单内）

### 1.1 `src/shared/chapter-failure.ts`（只增码与 meta）

- `CHAPTER_FAILURE_CODES` 增 `DRAFT_SHORT_OUTLINE_FAILED: 'DRAFT_SHORT_OUTLINE_FAILED'`（注释：短细纲没拿到可用结果（正文尚未开始）——D13 三失败点之一）。
- `CHAPTER_FAILURE_META` 增同码条目：

```
layer: 'call'
code: DRAFT_SHORT_OUTLINE_FAILED
detail: '短细纲没有正常返回，正文尚未开始，本次没有写入任何内容。'
suggestions: ['重新生成本章', '更换生成模型后重试']
```

既有码值一个未动（`DRAFT_PREVIOUS_ENDING_REPLAY` / `GENERATION_COMPOSITION_NO_PROGRESS` 走原值）。

### 1.2 `src/services/workflows/commands/generate-draft.command.ts`（只碰失败出口与候选落库）

- 新增 `draftShortOutlineFailedError()`：`Object.assign(new Error('GENERATION_DRAFT_SHORT_OUTLINE_FAILED'), { code: CHAPTER_FAILURE_CODES.DRAFT_SHORT_OUTLINE_FAILED })`。message 保留既有英文串（既有测试/日志按子串匹配它），机器判定一律走 `code`。
- 短细纲失败三处出口（重试路径身份不符、统一判定处、恢复路径无短细纲）全部改成抛这个带码对象。
- catch 顶部（`:1875` 一带）新增保码：

```ts
const failureCode = recoveryFailureCode(error, context.cancelled)
if (error && typeof error === 'object' && typeof (error as { code?: unknown }).code !== 'string') {
  Object.assign(error, { code: failureCode })
}
```

  理由：组装层在主进程抛的 `GENERATION_COMPOSITION_NO_PROGRESS` 过 IPC 后 `code` 属性丢失（Electron 只重建 message），原逻辑只在候选落库处用 `recoveryFailureCode` 现算一次码；现在把判定出的受控码挂回抛出的对象，上层与候选都按码分流。
- 候选落库（D13 裁定 2=A）沿用原形态 `db:recovery-candidate-record`，仍以 `!draftPersisted && recoverableDraftCandidate` 为前提，未加超时/心跳/run 终态兜底。

### 1.3 `src/services/workflows/commands/__tests__/generate-draft.command.test.ts`（判据 5）

- 新增 `it('keeps the compose failure code across IPC and records the candidate')`：`generation:compose-visible` 第二次抛出**无 `code` 属性**的 `Error invoking remote method 'generation:compose-visible': Error: GENERATION_COMPOSITION_NO_PROGRESS`，断言
  - 抛出的错误 `.code === 'GENERATION_COMPOSITION_NO_PROGRESS'`（保码）
  - `db:recovery-candidate-record` 恰好一次，载荷 `{ chapterNumber: 2, failureCode: 'GENERATION_COMPOSITION_NO_PROGRESS', visibleText: <同一份正文> }`
  - 无 `db:draft-create`（未落正文）
- 既有「短细纲失败」用例补断言：`error.message` 含 `GENERATION_DRAFT_SHORT_OUTLINE_FAILED` 且 `error.code === 'DRAFT_SHORT_OUTLINE_FAILED'`。

未改：`src/components/panels/ai-output-failure-presentation.ts`（白名单内但无需改，见 §3 说明）、`AIOutputPanel.tsx`（不在白名单）、`chapter-materials.ts` / `draft-short-outline.ts` / D12 注入与重跑代码（卡 §3 禁改区）、既有错误码值、`archive/`。

## 2. 判据逐条

### 判据 1 · 三失败点各实机触发一次且唯一失败码

一次启动、单实例、同一项目第 2 章串跑三档（命令见 §4）。界面读数（`role="alert"` 内「错误码：」行原文）：

| 档 | 界面错误码行原文 | 主进程请求分派（evidence） | 失败点 |
|---|---|---|---|
| short-outline-fail | `错误码：DRAFT_SHORT_OUTLINE_FAILED` | `outlineCalls=2`、`finishReasons=["outline:length"]`、`draftCalls=0` | 短细纲两轮都没拿到 `stop`（首轮 + `generation:retry-draft-short-outline` 重试） |
| replay | `错误码：DRAFT_PREVIOUS_ENDING_REPLAY` | `outlineCalls=1`、`draftCalls=3`、`finishReasons=["outline:stop","draft:stop"]` | 首稿 + 一次重演重写重试后仍复述上一章结尾 |
| no-progress | `错误码：GENERATION_COMPOSITION_NO_PROGRESS` | `outlineCalls=1`、`draftCalls=2`、`finishReasons=["outline:stop","draft:stop"]` | 续写轮返回与首稿完全相同文本 → 组装层字数不增 |

三档各自只出现一个失败码，无叠加、无互相顶替；`physicalModelRequests=0`（全程合成响应，未打真模型）、`unclassified=0`（每个请求都被分派到既定 purpose）。

### 判据 2 · 失败码带 `code` 且跨 IPC 到渲染层仍存在

界面「错误码：」一行只由渲染层 `error.code` 渲染——`src/stores/workflow-store.ts:384-388` `errorCodeFromUnknown` 只读 `error.code`，**不解析 message**；因此该行出现即证明码活着到了渲染层：

```
错误码：DRAFT_SHORT_OUTLINE_FAILED
错误码：DRAFT_PREVIOUS_ENDING_REPLAY
错误码：GENERATION_COMPOSITION_NO_PROGRESS
```

候选档另有一层证据：候选卡文案里的「这一章为什么没写出来：…」由 `chapterFailureMeta(candidate.failureCode)` 渲染，即渲染层拿到的候选对象里 `failureCode` 还在，且与契约词表逐字一致（脚本用 esbuild 现场加载 `src/shared/chapter-failure.ts` 的 `chapterFailureMeta` 做逐字比对，非硬编码字符串）。

### 判据 3 · `NO_PROGRESS` 时 `recovery_candidates` 有行

抓取语句（脚本内 `appDb` 读 `project.db`）：

```sql
SELECT candidate_id AS id, chapter_number AS chapter, failure_code AS failureCode,
       length(visible_text) AS visibleUnits, status, created_at AS createdAt
FROM recovery_candidates ORDER BY created_at
```

no-progress 档命中行原文（列值按上句 SELECT 顺序）：

```
chapter_number=2 failure_code=GENERATION_COMPOSITION_NO_PROGRESS length(visible_text)=157 status=pending
```

replay 档同样落行：

```
chapter_number=2 failure_code=DRAFT_PREVIOUS_ENDING_REPLAY length(visible_text)=373 status=pending
```

`visible_text` 长度均 > 0（157 / 373，157 与设计稿里「六句合计 <170 单元」的夹具一致）。短细纲档按契约**不落候选**（正文尚未开始，无可保留内容），实测该码候选行 0 条。三档 `drafts` 表中第 2 章行数均为 0（正文未落库，符合「结果未保存」的文案承诺）。

### 判据 4 · 界面两档文案：失败原因 + 可执行下一步

两档（replay / no-progress）由候选卡承载，面板 `innerText` 原文（no-progress 档，两张卡同屏，第一张是前一档遗留的 pending 候选）：

```
这一章为什么没写出来：生成的正文开头重演了上一章结尾，没有推进本章内容，结果未保存。
已保留：以下正文已留作候选，可复制或继续编辑。
可以试：修改上一章结尾，或调整本章开头的衔接设定
这一章为什么没写出来：合成后正文没有增长，续写没有进展，结果未保存。
已保留：以下正文已留作候选，可复制或继续编辑。
可以试：更换生成模型后重试
```

脚本断言的是**契约字段逐字出现在面板里**（原因＝`meta.detail`、下一步＝`meta.suggestions[0]`），不是「有这行字就行」。短细纲档没有候选行，屏幕上是面板的失败原因（「短细纲生成失败：…正文尚未开始。」）+ 错误码行，无 suggestion —— 与该码 `layer:'call'`、正文未开始的真实状态一致，不做假承诺。

中/英口径（照实写）：候选卡文案走 `runText(locale, 中文, 英文)`，本次实测界面语言 zh-CN，故取中文标签；英文侧代码为 `Why this chapter was not written: ${failure.detail}`，**标签英文、正文仍是契约中文**——契约 `ChapterFailure` 只有 `detail` 一个字段，没有 en 版本，这是设计稿里的现存边界，本次未扩范围去造英文文案。

### 判据 5 · 单测 + `pnpm check:fast`

> 首验被打回点：本报告第一版贴的是 `-t` 过滤结果（`1 passed | 254 skipped`），按 04:2x 裁定「判据 5 只认整文件汇总行」作废，改为下面整文件全量跑。过滤结果不再作为证据。

```
> node scripts/run-tests-electron.mjs src/services/workflows/commands/__tests__/generate-draft.command.test.ts
 Test Files  1 passed (1)
      Tests  255 passed (255)              EXIT=0
> node scripts/check-fast.mjs
[check:fast] typecheck ✓ 15.7s
doc links: checked 1468, broken 0
[check:fast] doc-links ✓ 0.1s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。      EXIT=0
```

返工内容（裁定 ①，同一分支追加一笔、不 amend）：`generate-draft.command.ts` 的 catch 顶部赋码加受控码门控——`isChapterFailureCode(failureCode)` 为真才把码挂回抛出的对象；词表外的失败（含 provider 回传的不受信文本，`recoveryFailureCode` 落到 `GENERATION_FAILED`）保持不带 `code`，`generate-draft.command.test.ts:5964` 的既有不变量「不把不受信失败文本变成展示码」照旧成立。受控码表内的组装层失败（`GENERATION_COMPOSITION_NO_PROGRESS`）仍能拿到 `code`，判据 2 的取证路径不受影响（本节整文件 255 passed 与判据 1–3 的复跑同时证明）。

## 3. 与设计稿的偏差说明（无功能偏差）

- `ai-output-failure-presentation.ts` 白名单内但未改：`presentWorkflowFailure(failureCode, error: string, ...)` 只拿得到 message 字符串、拿不到 `.code`；要让它按章节码分支得改非白名单的 `AIOutputPanel.tsx` 调用点。判据 4 的「原因 + 下一步」由候选卡（`chapterFailureMeta`）承载，已完成，故不动该文件。
- 未改 `AIOutputPanel.tsx`：不在白名单。

## 4. 复现命令与实例纪律

```bash
npx vite build                                   # dist-electron/main.js + dist/index.html（含本轮改码，Nov 22 04:13）
node scripts/s2-d13-failure-acceptance.mjs       # 单实例串跑三档，EXIT=0
node scripts/check-fast.mjs                      # 闸门，EXIT=0
```

- 末行 JSON（截断，全文见 evidence 文件）：

```
{"ok":true,"evidence":{"instancesThisRun":1,"leftoverElectronProcesses":0,"physicalModelRequests":0,"unclassified":0,"bands":{"short-outline-fail":{"panelCode":"DRAFT_SHORT_OUTLINE_FAILED","rendererCodeLine":"错误码：DRAFT_SHORT_OUTLINE_FAILED","sameCodeCandidates":[],"draftCalls":0,"outlineCalls":2},"replay":{"panelCode":"DRAFT_PREVIOUS_ENDING_REPLAY","rendererCodeLine":"错误码：DRAFT_PREVIOUS_ENDING_REPLAY","candidateColumns":["chapter_number=2 failure_code=DRAFT_PREVIOUS_ENDING_REPLAY length(visible_text)=373 status=pending"],"cardDetailInPanel":true,"cardSuggestionInPanel":true,"draftCalls":3},"no-progress":{"panelCode":"GENERATION_COMPOSITION_NO_PROGRESS","rendererCodeLine":"错误码：GENERATION_COMPOSITION_NO_PROGRESS","candidateColumns":["chapter_number=2 failure_code=GENERATION_COMPOSITION_NO_PROGRESS length(visible_text)=157 status=pending"],"cardDetailInPanel":true,"cardSuggestionInPanel":true,"draftCalls":2}}},"evidencePath":"...\\.runtime\\.cache\\s2-d13\\ad6be679-4d3\\evidence.json"}
```

- 返工后复跑（04:18，判据 1–3 复查）：三档码与候选行与返工前**完全一致**（`DRAFT_SHORT_OUTLINE_FAILED` 候选 0 条／`DRAFT_PREVIOUS_ENDING_REPLAY` `length(visible_text)=373`／`GENERATION_COMPOSITION_NO_PROGRESS` `length(visible_text)=157`，均 `status=pending`），`instancesThisRun=1`、`leftoverElectronProcesses=0`、`physicalModelRequests=0`；evidence `.runtime/.cache/s2-d13/ad6be679-4d3/evidence.json`。

- `instancesThisRun=1`（整轮只启动一次 Electron，三档在同一 app 内切换 `globalThis.__s2.band`）
- `leftoverElectronProcesses=0`（收尾按 `--user-data-dir=<scratch userData>` 统计 electron 进程）
- 脚本 `finally` 里 `quit()`：`Promise.race([app.close(), 20s])` 后强制 `app.process().kill()`
- 隔离：roots 全部落 `.runtime/.cache/s2-d13/bd8970e2-b96/`，项目落 `%LOCALAPPDATA%\VibeCodingScratch\s2-d13\p<6位>`；非白名单域名 fetch 一律 `throw S2_D13_EXTERNAL_FETCH_REFUSED`（实测 0 次）

## 4.1 提交面（交件取数）

- 分支 `card/s2-d13-failure-contract`，两笔（第二笔为判据 5 打回后的返工追加，未 amend）：
  - 新头 `a4503f10ff45900f8e8d6981b3d000318bbbb644`（`fix(draft): D13 赋码只对受控码表生效，词表外失败保持不带 code（CARD-S2-D13）`，1 文件 +7/−4）
  - 父 `4d40bb5b8874d59ec337e0fb893fee837f46ace9`（首件，4 文件 +641/−6）
  - 分叉点 `0f0ca3ee`
- `git status --porcelain`（提交后，仅非本卡改动）：`M .batch/night/org/BACKLOG.md`、`M docs/design/product/live-pipeline-acceptance-defects-assessment.md`（产品经理侧，未归我提交）；`.batch/` 下卡/派验单/报告为未跟踪件，不入库。
- R4 双空（去掉行尾差异的判据，本卡 4+1 个文件均无遗留）：
  - `git diff --ignore-cr-at-eol --stat` → 只剩上述 2 个非本卡文件（9 增 2 删），本卡改动为空
  - `git diff --numstat` → `8 1 BACKLOG.md` / `1 1 live-pipeline-acceptance-defects-assessment.md`，本卡文件 0 行

## 5. 已知边界（不属于本卡范围，未扩）

- `generation_runs` / `generation_attempts` 在 `project.db` 查询返回空数组（DDL 不在 `electron/migrations/baseline-schema.ts`），故判据不依赖它们，run 终态证据以界面读数 + `recovery_candidates` 行为准。
- 契约 `detail` / `suggestions` 只有中文（en 侧沿用中文），见判据 4 说明。
- 候选行跨档累积（replay 的 pending 行在 no-progress 档仍在屏上），脚本按 `failure_code` 过滤后再断言，与「不自动清候选」的既有产品行为一致。

<!-- DONE -->
