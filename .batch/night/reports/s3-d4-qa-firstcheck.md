执行方：QA · AI writer项目组
model=宿主未暴露芯片原文（`env` 无 `DSH_MODEL`）| 倍率=未知 | provider=未知

# D4 首验判词 · 来源冲突两层文案分层挂载

## 0. 结论

**PASS（6/6）**。判据 1 与判据 6 的实例两项按主身 11-22 裁定 (a) 与补证档复核通过（明细见 §9）；其余四条沿用首验读数，未重跑。

| 判据（派验单原文编号） | 结果 |
|---|---|
| 1 界面/日志证据：双层同屏原文（中/英各一份）＋「仅单稿冲突」时只出产物层 | **过**（按裁 (a) 收口）：批次层实机原文＋两条 batch run `failed` 已取证；单稿档 `batchLayers=0`、全屏无「本批已停止」。两层同屏与英文实机见 §9 观察项，归 D4b / 单测覆盖 |
| 2 单测整文件汇总行＋末行 `EXIT=`，两支各一、断言互斥 | **过**（我复跑 7/21/4 全绿，两支互斥逐条核）；实机口径＝**反面可判**（见 §5） |
| 3 改动面全落卡面 §3 白名单 | **过**（5 行全在白名单，附一行归类见 §6.1） |
| 4 无新增生产文件（`--name-status` 无 `A`） | **过**（5 行全 `M`） |
| 5 批次层文案含后果与下一步 | **过**（文案原文见 §3.5 与 §9 实机原文） |
| 6 `check:fast` 末行＋`EXIT=`，实例纪律三项 | **过**（`EXIT=0` 原文见 §3.6；`instancesThisRun=1`、`leftoverElectronProcesses=0`、`exitCode=1`＝取证脚本 300s 超时，非崩溃非残留，见 §9） |

判据 2 的实机正面（「仅单稿冲突 → 只出现产物层」）在本卡白名单内无挂载点，按裁定归 D4b 卡，不在本卡判（§5、§9）。

## 1. 判定对象与判据分母

- 判定面（提交面，非工作区）：`136c999c35563114c55719401684a1a7ecf799de`，分支 `card/s3-d4-conflict-copy`，父 `b4e8da53`，未 push、无 upstream。实机档的判定面＝工作区，经 `git status --porcelain -- src electron scripts` 为空证明与 `136c999c` 一致（§9）。
- **判据分母**：派验单 `.batch/night/review-requests/s3-d4-conflict-copy.md` = **30 行 / 3,306B / sha256 `24d98f3629160055b301e82ea74aad2ad175be53e9733f9dc2255eb3624d9931`**（含 11-22 11:3x「判据① 收口（主身裁定 a）」修订注；文字主体未改，实际判据文字与 `23f99b3f…a144` 版逐字相同，我已比对 `:14` 行原文）。
- **base**＝`b4e8da53`。
- 卡面 `.batch/night/cards/s3-d4-conflict-copy.md` = **72 行 / 6,921B / sha256 `15d7f29560c6d68375a2d5b742050aa6ba241e2b29d70e1ed69debbd081d50be`**（§8 末加同名修订注，判据文字未改）：**按派验单原文判，卡面作归档对齐**。
- 交件报告 `.batch/night/staging/s3-d4-conflict-copy-report.md` = **197 行 / 12,269B / sha256 `a53778bd08a9310bb6fd1bf228097d953c2550238ea55d9b9f1b2988835319f8`**（§4 实机档已补）。

## 2. 判据 1：已补证，按裁 (a) 收口

首验时报告 `:69` 只有 `<!-- MACHINE-EVIDENCE -->` 占位、§4 为空，故当时记「待补证」；developer 11-22 已补 §4 实机档（报告 197 行 / 12,269B / `a53778bd…`），我按 §5.1 口径只复判判据 1 与判据 6 的实例两项，其余四条沿用首验读数、未重跑。

主身 11-22 裁定 (a)：批次层实机已取证、单稿档不误现批次层即算过；「两层同屏」前提依赖单稿层挂载点，归 D4b，不在本卡。实机原文、证据链与观察项见 §9。

## 3. 已判四条的读数（命令原文＋末行）

### 3.3 判据 3（白名单）

```
$ git diff --name-only b4e8da53..136c999c -- src electron scripts
src/components/panels/AIOutputPanel.tsx
src/components/panels/__tests__/AIOutputPanel.main-recovery.browser.tsx
src/components/ui/SourceConflictNotice.tsx
src/components/ui/__tests__/SourceConflictNotice.test.tsx
src/shared/source-conflict-copy.ts
EXIT=0
```

逐行对 §3：`AIOutputPanel.tsx`＝白名单第 1 条；`source-conflict-copy.ts`＝「承载文案的共享模块」；两个测试文件＝「其单测」与「`AIOutputPanel` 相关 browser 测试（只允许同步断言）」；`SourceConflictNotice.tsx` 的归类见 §6.1（不阻断本判据，但需一句确认）。

```
$ git diff --name-only b4e8da53..136c999c | grep -v -E '^(src|electron|scripts)/'
(无输出)  EXIT=0
```

禁改区未动：`src/components/editor/*`、`NarrativeThreadEditor.tsx`、`VersionHistory.tsx`、`ArchFileViewer.tsx`、`chapter-materials.ts` 均不在改动面内。

### 3.4 判据 4（无新增生产文件）

```
$ git diff --name-status b4e8da53..136c999c -- src electron scripts
M	src/components/panels/AIOutputPanel.tsx
M	src/components/panels/__tests__/AIOutputPanel.main-recovery.browser.tsx
M	src/components/ui/SourceConflictNotice.tsx
M	src/components/ui/__tests__/SourceConflictNotice.test.tsx
M	src/shared/source-conflict-copy.ts
EXIT=0

$ git diff --numstat b4e8da53..136c999c -- src electron scripts
4	7	src/components/panels/AIOutputPanel.tsx
42	2	src/components/panels/__tests__/AIOutputPanel.main-recovery.browser.tsx
23	9	src/components/ui/SourceConflictNotice.tsx
35	4	src/components/ui/__tests__/SourceConflictNotice.test.tsx
29	4	src/shared/source-conflict-copy.ts
EXIT=0
```

5 行全 `M`，无 `A` ⇒ 无新增生产文件；本卡未新增取证脚本（与 D12/D13/D9 不同，白名单内无脚本条目）。

### 3.2 判据 2（单测，整文件汇总行，我自己复跑）

```
$ pnpm test src/components/ui/__tests__/SourceConflictNotice.test.tsx
 ✓ src/components/ui/__tests__/SourceConflictNotice.test.tsx (7 tests) 7ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
EXIT=0
```

```
$ node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/panels/__tests__/AIOutputPanel.main-recovery.browser.tsx
 ✓ |chromium| src/components/panels/__tests__/AIOutputPanel.main-recovery.browser.tsx (21 tests) 326ms
 Test Files  1 passed (1)
      Tests  21 passed (21)
EXIT=0
```

```
$ pnpm test src/shared/__tests__/source-conflict-copy.test.ts
 ✓ src/shared/__tests__/source-conflict-copy.test.ts (4 tests) 3ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
EXIT=0
```

三份都是整文件汇总行，无 `-t` 过滤，末行 `EXIT=` 齐。

两支互斥（我逐条读断言，不采信报告转述）：

- 无中止支：`AIOutputPanel.main-recovery.browser.tsx:107-110` `expect(container!.querySelector('[data-conflict-layer="batch"]')).toBeNull()`、`not.toContain('本批已停止')`、`not.toContain('后续单元不再执行')`；`SourceConflictNotice.test.tsx:25-31` 同向（缺省 `batchStopped` → 只有 output，并 `not.toContain('后续单元')`）。
- 有中止支：`AIOutputPanel.main-recovery.browser.tsx` 新增用例里 `expect(...querySelector('[data-conflict-layer="batch"]')?.textContent).toBe(batchLayer)`，`batchLayer` 为「本批已停止：后续单元不再执行，需从第3章重新发起本批。」；`SourceConflictNotice.test.tsx:33-40` 正向断言批次层在、产物层不在（`sourceStatus="current" batchStopped`），`:42-47` 带章号断言「从第3章重新发起」「不含从第null章」，`:66-69` 英文 `Start a new batch from Chapter 4`。
- 两支不共享同一 `data-conflict-layer` 断言，互斥成立。

### 3.5 判据 5（文案含后果与下一步）

提交面 `src/shared/source-conflict-copy.ts` 原文（`git show 136c999c:src/shared/source-conflict-copy.ts`）：

- 中文无章号：`本批已停止：后续单元不再执行，需重新发起本批。`
- 中文带章号：`本批已停止：后续单元不再执行，需从第${chapterNumber}章重新发起本批。`
- 英文无章号：`This batch has stopped: later units will not run. Start a new batch to continue.`
- 英文带章号：`This batch has stopped: later units will not run. Start a new batch from Chapter ${chapterNumber}.`

后果（后续单元不再执行）＋下一步（重新发起本批／从第 N 章重开）＋停在哪（章号）三样都在，且与本卡前身「来源已变化：后续单元不再执行，需重新发起」不是同义重复——旧句把「来源变了」当原因，新句把「批已停」当事实并给出重开位置 ⇒ 判据 5 过。

### 3.6 判据 6（`check:fast`）

```
$ pnpm check:fast
[check:fast] typecheck ✓ 18.4s
doc links: checked 1468, broken 0
[check:fast] doc-links ✓ 0.2s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。
EXIT=0
```

实例纪律两项（`instancesThisRun=1`、`leftoverElectronProcesses=0`）无实机取证，见 §2。

## 4. 待补证清单（只补这一处，不重跑已判四条）

1. 报告 §4 的 `<!-- MACHINE-EVIDENCE -->` 占位填成实机档 A/B：档 A＝来源冲突＋批次中止（中/英原文＋`data-conflict-layer` 两个标记文本＋章号）；档 B＝仅单稿冲突、批次未停（批次层缺席的界面或日志摘录）。
2. 实例纪律三项（`instancesThisRun`、`exitCode`、`leftoverElectronProcesses`）与 `physicalModelRequests===0`，另附 `tasklist | grep -c electron` 原文。

## 5. 判据 2 的实机口径（已裁定：反面可判）

群管理分身 2026-11-22 11:2x 裁定原文要点：**判据 2 反面可判**——实机只验证反面（不得出现 `data-conflict-layer="batch"`、不得出现「本批已停止」这类批次层文案）；正面（单稿层的 `sourceStatus` 投影）在本卡白名单内没有挂载点，**另立 D4b 卡**，不许扩 D4 白名单、不许动 `generation:read-context` 契约。**这不是豁免**，正面取证有独立卡号承接。

裁定所依据的事实我已核：`electron/migrations/baseline-schema.ts:131-155` 注释说明 `recovery_candidates` 只收失败生成的可见产物，成功单稿 run 不写该表、reload 后也不在 `generation:list`；`src/components/panels/AIOutputPanel.tsx:465-500` 的单稿块不渲染 `SourceConflictNotice`；`GenerationRecoveryContext`（`src/shared/generation-owner-contract.ts:220-250`）无 `sourceStatus`。

⇒ 判据 2 按「单测两支互斥（已过）＋实机反面（随判据 1 的实机档一并取证）」记账；正面归 D4b，不在本卡判。

**判据② 按反面判，正面（单稿层 `sourceStatus` 投影）归 D4b，不在本卡**

## 5.1 判据 1 的取证口径（已裁定：补实机、判据不降）

主人 11-22 裁定：判据 1 补一次实机取证，判据不降。执行者 developer，在 `develop` 跑、单实例（`instancesThisRun`、`exitCode`、`leftoverElectronProcesses`＝0，另贴 `tasklist | grep -c electron` 原文）；取证内容＝判据 1 原文要求的双层同屏中/英原文＋「仅单稿冲突、批次未停」时只出产物层；证据须标明基于提交 `136c999c` 还是工作区（若工作区，贴 `git status --porcelain` 证明一致）；补进交件报告 §4，不另开第二份报告。

我收到后只补判据 1 与判据 6 的实例纪律两项，其余四条沿用本判词读数，不重跑。

## 6. 记录项（不影响本判）

1. **`SourceConflictNotice.tsx` 的白名单归类（已裁定）**：**主身裁定：该文件属白名单**——`src/components/ui/SourceConflictNotice.tsx` 属 §3「承载文案的共享模块」（2026-11-22 11:17），依据卡面 §3 第一条（可改 `AIOutputPanel.tsx`、承载文案的共享模块（新增或既有）、其单测），且禁改区清单不含 `src/components/ui/` 与 `src/shared/`，与 `source-conflict-copy.ts` 同类；**不改判据、不重开首验**，判据 3 按已过记账。报告 `:34` 归类与我判一致。
2. **既有断言翻转已点名**：`AIOutputPanel.main-recovery.browser.tsx` 原断言 `toContain('来源已变化：后续单元不再执行，需重新发起。')` 被替换为三条 `not.toContain`；报告 `:55` 已明确点名（「行为翻转（须点名）」），符合派验单「只加不减须点名」纪律。该翻转正是本卡要修的误报，我确认其正当性。
3. **其它调用点行为变化**：`AIOutputPanel.tsx:386`／`:411`／`:427`、`NarrativeThreadEditor.tsx:842`／`:1029` 只传 `sourceStatus`，`batchStopped` 取缺省 `false` ⇒ 这些位置此后不再出现批次层。这些位置无批次语义，属本卡设计意图；登记备查（若日后某处确有批次语义，需显式传 `batchStopped`）。
4. **行号口径**：本判词行号均为 `136c999c` 提交面行号；`source-conflict-copy.ts` 内 `batch` 字段注释提到「无生产调用点」的 `sourceConflictBatchLayer` 旧死代码说明（`:73` 附近）与本次实现不冲突。

## 7. 放行建议

- **建议 PASS 放行**：6 条判据全过，实现不需要返工；判据 1／6 的补证读数见 §9。
- 放行范围＝分支 `card/s3-d4-conflict-copy` 提交 `136c999c`；合并与 push 只由主身做，合并单 `.batch/night/staging/s3-d4-merge-order.md`（59 行 / 3,252B / sha256 `5bfb1c5c5a74c58ada2a9baf539701912c977157fc319ab1d47c6cb050e50693`；合并前主线头 `6f4d4f56`，执行前 `git fetch` 复核）。
- 判据 2 的正面、判据 1 的「两层同屏」与英文实机档归 **D4b**（`.batch/night/cards/d4b-source-status-projection.md`），不在本卡判、也不因本卡 PASS 而被视为已验。
- 本判词冻结：后续若需变更结论，另开判词，不改本文。

## 9. 判据 1 与判据 6 实例两项的复核记录（判面 `136c999c`；终判待留痕 sha 到位后补）

**判据① 收口：批次层已实机取证、单稿档不误现批次层；『两层同屏』前提依赖单稿层挂载点，归 D4b，不在本卡。**（主身 11-22 裁 (a)）

取证材料：交件报告 `.batch/night/staging/s3-d4-conflict-copy-report.md`（197 行 / 12,269B / sha256 `a53778bd08a9310bb6fd1bf228097d953c2550238ea55d9b9f1b2988835319f8`，与 developer 自报一致）；evidence run `945ff8a4-e3b`（`.runtime/.cache/s3-d4/945ff8a4-e3b/evidence.json`，14,041B）；判定面＝工作区＝`136c999c`（`git status --porcelain -- src electron scripts` 空，`git log -1 --oneline` = `136c999c fix(s3-d4): 来源冲突文案分层挂载，批次层只在批次真停时出现`）。

批次层实机原文（我从 `evidence.json → stepLog[batch:diag].body` 直读，非报告转抄）：

```
AI 输出

批量正文：已保存 0 章，下一章 2

本批已停止：后续单元不再执行，需从第2章重新发起本批。

继续此批次

… 批量草稿待审 · 第 2 至 3 章

工作流未完成

服务返回 HTTP 500，请求未完成。

错误码：GENERATION_PROVIDER_FAILED
```

同 run `alerts` 四条含「本批已停止：后续单元不再执行，需从第2章重新发起本批。」与「批量草稿待审 · 第 2 至 3 章\n\n工作流未完成\n\n服务返回 HTTP 500，请求未完成。\n\n错误码：GENERATION_PROVIDER_FAILED」；`batch:terminal` 原文 `["b818cbbd-6772-4d48-af40-10d8fab0f528:failed","5983fd63-127e-4e29-ba00-0bde931cb22a:failed"]` ⇒ 批次确已中止，文案不是臆测。**判据① 按裁 (a) 达成。**

单稿档（判据② 反面）：`scenarios.single.panelText` 只有 77 字符欢迎语，`outputLayers=[]`、`batchLayers=[]`，全屏不含「本批已停止」「后续单元不再执行」⇒ 不误现批次层，反面成立。

判据 6 实例三项：`{"instancesThisRun":1,"exitCode":1,"leftoverElectronProcesses":0}`；报告 §4.4 `tasklist | grep -c electron` → `0`。**`exitCode=1` ＝取证脚本自身超时（等批次根 run 终态 300s 超时，evidence `error: Error: 等待超时：批次层的两层同屏`），非产品崩溃、非实例残留。** 判据 6 的 `pnpm check:fast` 我已独立跑过（§3），结论不变。

观察项（不计缺陷、不影响 PASS）：

1. 英文档未取：整份 evidence 中 `This batch has stopped` 出现 0 次；脚本 `:405` 切 `en-US`、`:435` 断言 `batchEn`，因 §4.2 超时未执行到。按裁 (a) 英文实机不作本卡判据，英文文案由 `sourceConflictNotice` 单测与 browser 用例覆盖；登记以免后人误认「中英各一份已实机验过」。
2. 单稿档反面为**弱证据**：面板为空（`outputLayers=[]`）证明的是「没渲染任何层」，而非「只渲染产物层」；后者正是 D4b 的缺口，同一读数可作 D4b 的实机旁证。
3. 既存行为：终态批次 run 不在 `generation:list`（reload 后不可回读），故 reload 路径下两层同屏不可得；`AIOutputPanel.tsx:316-345` 的 `runs` 来源如此，白名单内不通，记观察项不计缺陷。

**留痕状态（已落地）**：派验单 `.batch/night/review-requests/s3-d4-conflict-copy.md` = 30 行 / 3,306B / sha256 `24d98f3629160055b301e82ea74aad2ad175be53e9733f9dc2255eb3624d9931`（`:15` 新增「判据① 收口（主身裁定 a）」修订注）；卡面 `.batch/night/cards/s3-d4-conflict-copy.md` = 72 行 / 6,921B / sha256 `15d7f29560c6d68375a2d5b742050aa6ba241e2b29d70e1ed69debbd081d50be`（§8 末同名修订注）。两件判据文字未改，我逐行比对 `:14` 与修订注内容一致。**判据分母即上述两件，终判生效于此。**

**结论**：判据 1 与判据 6 实例两项**通过**；加上首验已过的 2/3/4/5，本卡 **PASS（6/6）**。

<!-- DONE -->
