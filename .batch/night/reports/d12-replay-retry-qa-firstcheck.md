# D12 首验判词：短细纲注入形态 + 正文带原因重跑（S1）

执行方：QA · AI writer项目组
model=DeepSeek V4.1 | 倍率=1 | provider=deepseek
受判对象：分支 `card/d12-replay-retry` HEAD **`d95821e4`**（`test(draft): D12 实测脚本 candidates 只算第 2 章…`，父链 `f8d703c0`→`4f2c62a4`→`1ee3efd8`→`2fddfad5`→`ce7e1530`→`d95821e4`，起点 `89ec7014`，6 路径 +1,481/−10），取数 2026-11-21T22:4x+08:00
判据来源（分母，锁定二件）：卡 `.batch/night/cards/d12-replay-retry.md`（223 行 / 24,236B / sha256 `e89424781ed4ee041118f1b07691a6654b29ad1df68cb8017f8ee2e6ba0a96c5`）§4 全文；派验单 `.batch/night/review-requests/d12-replay-retry.md`（29 行 / 3,609B / sha256 `31beebe7c900ff2e8869a4caa96d63195b15dfb6c2315683f2403b656cd5d984`）
交件：`.batch/night/staging/d12-replay-retry-report.md`（末行 `<!-- DONE -->`）
版本链：`1d08ba08`（判不通过：§4.2.7 两条子断言缺测）→ `f8d703c0`（补测，判不通过：`candidates` 写死常量）→ `d95821e4`（`candidates` 实读、4 处判据补齐、显式 EXIT）。本判词只认 `d95821e4`；前面的判词结论作废。

## 0. 结论

**PASS**（分母＝派验单 5 条索引：§4.1 六条、§4.2 第 7–11 条、§4.3 字段表、§4.4 回归门禁、§4.5 提交纪律；**5/5 全过，无未覆盖项**）。

- §4.1 注入形态 6 条：**通过**。`src/shared/draft-short-outline.ts` 对 `89ec7014` 零改动；短细纲前驱只有「要点整份 + 结尾 ≤300」，我独立量得 outline 请求里上一章中段连续重合 **5**（去掉结尾块后），结尾块 265 字符 / 263 units。
- §4.2 第 7–11 条：**通过**。第 7 条两条子断言已在 `d95821e4:1089`（前缀相等）、`:1093-1098`（追加段穷举 8 码元窗口无命中）落测。
- §4.3 字段：**通过**。`candidates` 已从写死常量改为实读（`:302` `FROM recovery_candidates WHERE chapter_number = 2`；`:482` `out.rows.candidates.length`），实测 `rows.candidates=[]`、`evidence.candidates=0`；新增 `endingBlockNonEmpty`（`:465`）实测 true。15 项 checks 全 true。
- §4.4/§4.5：**通过**（281 passed、`check:fast` 全绿、未 push、porcelain 无非 `??` 改动）。

## 1. 判面与提交纪律（§4.5）

```
$ git log --oneline -6 d95821e4
d95821e4 test(draft): D12 实测脚本 candidates 只算第 2 章（recovery_candidates 严格本章）（CARD-D12-replay-retry）
ce7e1530 docs(batch): D12 交件报告终点 HEAD 口径改为自指、补报告提交行（CARD-D12-replay-retry）
2fddfad5 docs(batch): D12 交件报告同步提交面复跑证据、判据行号表与裁定结论（CARD-D12-replay-retry）
1ee3efd8 test(draft): D12 实测脚本末行输出后显式退出，避免外层 shell 收不到 EXIT（CARD-D12-replay-retry）
4f2c62a4 test(draft): D12 实测脚本 candidates 实读 + 4 处判据补齐（CARD-D12-replay-retry）
f8d703c0 feat(draft): D12 重演命中后带原因整章重写一次（CARD-D12-replay-retry）

$ git diff --numstat 89ec7014..d95821e4
241     0       .batch/night/staging/d12-replay-retry-report.md
3       1       docs/design/product/live-pipeline-acceptance-defects-assessment.md
529     0       scripts/d12-replay-acceptance.mjs
448     1       src/services/workflows/commands/__tests__/generate-draft.command.test.ts
108     8       src/services/workflows/commands/generate-draft.command.ts
152     0       src/shared/__tests__/draft-short-outline.test.ts

$ git rev-parse --abbrev-ref card/d12-replay-retry@{upstream}
fatal: no upstream configured for branch 'card/d12-replay-retry'
$ git ls-remote --heads origin card/d12-replay-retry
（空）
```

- 未 push / 未 tag / 未 merge。**通过。**
- 工作区：`git status --porcelain | grep -v '^??'` 为空；未跟踪件只有卡、派验单、本判词、交件报告与 staging 派件/撤回件。**通过。**
- 改文件全部在卡 §3 范围内；`src/shared/draft-short-outline.ts` 未改（`--numstat` 无该路径）。**通过。**
- 每笔提交单一目的、均在分支上；`d95821e4` 本笔只动脚本 2+/2−（`:302` 加 `WHERE chapter_number = 2`、`:481` 注释），不夹带。**通过。**
- 缺陷稿 `docs/design/product/live-pipeline-acceptance-defects-assessment.md:62` ✅→🟡 并写明「两半条」，与卡 §2.3 一致；转 ✅ 不归执行方（见 §7）。**通过。**

## 2. 回归门禁（§4.4）—— 我复跑

```
$ pnpm test src/shared/__tests__/draft-short-outline.test.ts src/services/workflows/commands/__tests__/generate-draft.command.test.ts
 Test Files  2 passed (2)
      Tests  281 passed (281)

$ pnpm check:fast
[check:fast] typecheck ✓ 22.2s
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] batch-hygiene ✓
[check:fast] 全部通过。
EXIT=0
```

既有断言只加不减：唯一删除行是 `still rejects previous-chapter replay…` 的 `toEqual(['chapter-draft-short-outline','chapter-draft','chapter-draft-condense'])` → 扩成四项（多 `chapter-draft-no-progress-recovery`），交件已点名。**通过。**

## 3. 实机取证（§4.3）—— 我复跑

```
$ node scripts/d12-replay-acceptance.mjs; echo "EXIT=$?"
[d12] launch-1 … [d12] requests-dumped · 3 份 · 7095/14621/14931B … [d12] quit-done
{"ok":true,"evidence":{…},"evidencePath":"…\\.runtime\\.cache\\d12-replay\\fe9c195b-1cf\\evidence.json"}
EXIT=0
```

脚本双面同值：`git show d95821e4:scripts/d12-replay-acceptance.mjs | sha256sum` 与 `sha256sum scripts/d12-replay-acceptance.mjs` 均 `0d97f2a22…`（完整 `0d97f2a2e16614fc347bafe326fa696eab302d1e49e1eebdd4b9e3a8252c4cb9`）⇒ 我跑的就是提交面那版。

| 字段 | 判据 | 实测（我的 run `fe9c195b-1cf`） | 判 |
|---|---|---|---|
| `endingBlockUnits` | ≤300 | 263（原文 265 字符） | ✅ |
| `endingBlockNonEmpty` | true | true（`:465` `endingBlock.length > 0`） | ✅ |
| `notesBlockUnits` | 仅记录 | 304（源 301） | 记录 |
| `notesSixColumnsPresent` | true | true（六栏逐条目视核过，见附注 A） | ✅ |
| `notesTableRowsUnchanged` | true | true（表 2 数据行） | ✅ |
| `notesHooksCountUnchanged` | true | true（`[埋]` 1 条） | ✅ |
| `outlineMidMaxOverlapUnits` | ≤80 | 39（附注 B：夹具重复句，去结尾块后 5） | ✅ |
| `proseContainsFullPrevious` | true | true（我独立量得 **1,046＝CH1 全长**，附注 C） | ✅ |
| `proseDispatches` | 2 | 2 | ✅ |
| `retryHasCorrection` | true | true（追加段以 `\n\n【修正说明】` 开头，110 units） | ✅ |
| `retryLeaksDraftFragment` | false | false（附注 D：字段本身弱，独立穷举补足） | ✅ |
| `composeCalls` / `drafts` | 1 / 1 | 1 / 1 | ✅ |
| `candidates` | 0（本章实读） | 0；`rows.candidates=[]`（`:302` 带 `WHERE chapter_number = 2`，不是表名投影） | ✅ |
| `physicalModelRequests` / `embeddings` / `unclassified` | — | 0 / 1 / 0 | 记录 |

`evidence.json` 里 `checks` 15 项全 true；`rows.drafts` = `[{"id":1,"chapter":1,"status":"finalized"},{"id":2,"chapter":2,"status":"draft"}]`（成功路径必然留一条采用稿，故 `draftsNonFinalized` 口径已于 22:09 撤销，见记忆）。

## 4. §4.1 / §4.2 逐条

| 条 | 内容 | 判 |
|---|---|---|
| 1 | 短细纲前驱＝要点整份（不截断） | 通过（`:1261-1266` `notes: predecessorNotes`） |
| 2 | 结尾窗口只用 `DRAFT_SHORT_OUTLINE_PREDECESSOR_TAIL_CHARS`（300） | 通过（`:1265`；`draft-short-outline.ts` 未改） |
| 3 | 上章全文不进短细纲请求 | 通过（附注 B：中段去结尾块后重合 5） |
| 4 | 结构不变（六栏 / 表行 / 钩子数） | 通过（§3 三字段 true） |
| 5 | 中段窗口 ≤80 | 通过（39，来源已查明） |
| 6 | 正文链路仍收上一章全文（反向回归） | 通过（1,046 连续片段＝全长） |
| 7 | 首稿重演 → 带原因重写一次，且重写不含首稿片段 | 通过（`:1089` 前缀相等；`:1093-1098` 追加段穷举 8 码元命中 0） |
| 8 | 两次都重演 → 落候选、码 `DRAFT_PREVIOUS_ENDING_REPLAY`、文案含处数/字数 | 通过（用例 `:1082`/`:1247` 断言 purposes 三项；终局闸 `:1709-1710`） |
| 9 | 首稿干净 → 只请求 1 次、无修正说明 | 通过 |
| 10 | 重写请求失败 → 沿用首稿、日志含「重写请求失败，沿用首稿」 | 通过（`:1167` 断言；代码 `catch` 分支） |
| 11 | 续写/压缩轮不触发 | 通过（`:1582` purposes 仅两项） |

### 4.2.7 的断言原文（提交面 `d95821e4`）

```
const rewriteUser = rewriteRequest.messages.at(-1)?.content ?? ''
expect(rewriteUser.startsWith(`${firstDraftUser}\n\n【修正说明】`)).toBe(true)
const appendedToRewrite = rewriteUser.slice(firstDraftUser.length)
const leakedWindows = Array.from({ length: Math.max(0, [...replayText].length - 7) }, (_, start) =>
  [...replayText].slice(start, start + 8).join(''))
  .filter((window) => appendedToRewrite.includes(window))
expect(appendedToRewrite.startsWith('\n\n【修正说明】')).toBe(true)
expect(leakedWindows).toEqual([])
```

「只判追加段」这个读法我认（负责人 11-21 已裁定）：重写请求的基段按设计就是首稿 user content，其中合法含上一章结尾；拿首稿片段查整段必然恒红。而任何抄进【修正说明】的 ≥8 码元片段必含一个 8 码元窗口，窗口集是穷举的 ⇒ 充分。残留边界（<8 码元、近义改写）与卡面判据同宽，不是本次实现引入的弱化。

## 5. 附注（不阻断，供后续不复读）

**A. 六栏是脚本常量，不是我猜的名字**：`scripts/d12-replay-acceptance.mjs:95` `SIX_COLUMN_HEADINGS = ['## 时间定位','## 空间锚点','## 剧情节点','## 角色动态','## 新增设定','## 伏笔与钩子']`；我按这份名单逐栏在 notes 块里找到（块长 304）。表行 2 是含表头 3 行里的数据行。

**B. `outlineMidMaxOverlapUnits=39` 不是「请求里有 39 字原文」**：39 的来源是夹具——`CH1_PARAGRAPHS` 24 段共用模板句，结尾块（末 300 字）与更早段落逐字相同。我的独立测量（自写 lcs，不复用脚本函数）：上一章中段（CH1 去末 300 字，746 字）vs **去掉结尾块**的 outline → **5**（`潮汐刻度，`）；vs 整份 outline（2,583 字）→ 39，重合文本是 `还在港口等风，…碎成细线。\n第2`（共用句＋下一段开头）。⇒「全文不在场」成立。建议后续把夹具段间改写，免得下一轮被读成泄漏。

**C. `proseContainsFullPrevious` 字段口径偏弱**：实现是 `initialDispatch.prompt.includes(CH1_TAIL.slice(-120))`，只证 120 码元连续。我独立补足：CH1（1,046）vs `02-replay` 最长连续重合 **1,046＝全长**，≥301 成立。

**D. `retryLeaksDraftFragment` 字段口径偏弱**：只查首稿末 40 码元；本项靠 §4.2.7 单测穷举覆盖，故判 ✅。我对真实 run 的 `correctionText`（`…连续重合 1 处、共 260 字…`）做了同样的全窗口穷举：追加段 110 units，命中 **0**；整段 clean 在基段之外也命中 **0**。

**E. 行号口径**：卡面/缺陷稿里的 `:1616-1621`、`:1347-1362` 按卡 §8 视为「起点 `89ec7014` 基线引用」；本判词按语义锚点核（`measurePreviousChapterReuse` `:376`、薄包装 `:424-429`、`acknowledge` 前判定 `:1558-1600`、终局闸 `:1709`）。

**F. purpose 偏离（§8①）**：重写请求 `purpose: 'chapter-draft-no-progress-recovery'`（`:1569`），未动主进程 `main-generation-owner.ts:590-630` 不变量；`:1626-1627`、`:2149` 两处引用是 `attemptedPurposes` 记录/续跑判定，**无用户可见文案变化**。交件已如实报，够。

**G. 重写请求基段按设计仍含上一章全文**：`messages = [system, \`${initialPrompt}\n\n${correction}\`]`。§4.2.7 只判追加段，这是设计而非泄漏；登记在此，避免后续把它当缺陷重开。

**H. 历史项已闭环**：`candidates` 写死常量（`f8d703c0` 判不通过项）已在 `d95821e4` 改为实读，本判词判 ✅；`endingBlock` 段静默 fail-open 也已由 `endingBlockNonEmpty`（`:465`、`:489` 进 expected）封住。

## 6. 未覆盖项

无。

## 7. 放行建议

**PASS，建议并入 `develop`**（merge 与 push 归主身，执行方不得自行 push）。

1. 合并前请主身确认分支 HEAD 仍为 `d95821e4`（本判词的判面）；HEAD 若变，本判词作废、需重新取证。
2. 合并后由**产品经理**把缺陷稿 `:62` 由 🟡 转 ✅，括号内附本判词路径与 `evidence.json` 路径（`…\d12-replay\fe9c195b-1cf\evidence.json`）与 run id；执行方不得自行转。
3. 后续 S2 起不再复开 D12；`outlineMidMaxOverlapUnits` 的夹具重复句问题转 S4 收口时一并处理（不阻断 D12）。
4. 遗留（不属本卡）：`draftsNonFinalized` 口径已撤销；`notesBlockUnits` 卡面仅记录不设上限。

<!-- DONE -->
