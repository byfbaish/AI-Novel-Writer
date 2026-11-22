# QA 首验判词 · CARD-S3-D11（补角色卡提示去重：卷级去重＋存量旧值一次重提示）

From: QA · AI writer项目组 | 57c8bd18
To: 项目总负责人 · AI writer项目组（并入主线，转主身）
判定面：`aeba1882`（`git log -1 --oneline` → `aeba1882 docs(batch): D11 转纯验收卡并入库派验单；D10 卡面 §9 补双 sha`）
执行方：developer · AI writer项目组（群分身 `906d802a`）
落盘：2026-11-22 18:4x（本卡唯一判词，无中间稿）

## 0. 结论

| # | 判据（派验单原文摘要） | 分层 | 结论 |
|---|---|---|---|
| 1 | 同一卷连写 3 批（`incomplete=true`）⇒ 0 次；翻 `incomplete=false` ⇒ 1 次 | `[live]` | **PASS**（按 15:3x 裁定的等价面对照：无 dismiss ⇒ 1 次；关闭后连跑三批 ⇒ 0 次） |
| 2 | 进入下一卷并完成 ⇒ 再提示 1 次（贴两卷 `volumeIndex` 与提示次数） | `[live]` | **FAIL** |
| 3 | 存量兼容：旧值按「未处理」返回、允许一次重提示、再关闭写 `v<卷号>:<wip\|final>` | `[live]` | **PASS** |
| 4 | 单测：同卷多批不重复／跨卷各一次／存量形态兼容 | `[mock]` | **PASS**（我复跑，未沿用执行方读数） |
| 5 | `pnpm test <相关路径>` 汇总行 ＋ `pnpm check:fast` 末行 ＋ `EXIT=` | `[static]` | **PASS**（我复跑） |
| 6 | 实例纪律三项 ＋ `tasklist \| grep -c electron` 原文 | `[live]` | **PASS** |

**总判：退回（D11 不 PASS）**，唯一判据级缺口＝判据 2；其余五条不重跑、认读数。

**判据 2 FAIL 原句**：判据 2 FAIL——清 dismiss 后把检查点 `synopsis_unit_cursor.volumeIndex` 库造为 2、同态重开并进入情节大纲，横幅确实提示 1 次，但关闭写入的是 `vn:final` 而不是 `v2:final`，说明提示侧算出的卷号是 `null`：两处投影点取的是连写链内存态（`src/App.tsx:335-336`、`src/components/editor/ArchFileViewer.tsx:345-346`）而非检查点，跨卷「各一次」在主线上不成立；`[live]` 面不可达的根因是实现没读检查点，不是本轮取样问题，也不是脚本没写对。

**wip 态**：wip 不可观测，库造，非链路——合成模型下 `incomplete=true` 的 0 次窗口经 UI 不可达（`src/services/workflows/synopsis-unit-launch.ts:297` 的 `skip('checkpoint-lost')`、先起链则首单元即停、`ArchFileViewer.tsx:1149` 的 `!recovery` 门＋`architecture-character-nudge.ts:149` 的正文 ≥50 字门），该半段按 15:3x 裁定降 `[mock]`，由 `architecture-character-nudge.test.ts` 覆盖；判据 1 的 `[live]` 由「无 dismiss 1 次／关闭后三批 0 次」对照承担。

## 1. 分母与判定面（现算，已冻结）

```
$ wc -lc .batch/night/cards/s3-d11-nudge-dedup.md .batch/night/review-requests/s3-d11-nudge-dedup.md .batch/night/staging/s3-d11-live-recheck-report.md
   88 12119 .batch/night/cards/s3-d11-nudge-dedup.md
   52  7137 .batch/night/review-requests/s3-d11-nudge-dedup.md
  128 10661 .batch/night/staging/s3-d11-live-recheck-report.md

$ sha256sum <同三件>
d97949e03d96ed84dea0bcb22b2fcdb0a0e2eb1d22e00fbcd35060307bbd54ac  .batch/night/cards/s3-d11-nudge-dedup.md
35608af625651218f64757ae4329ab079b5c06ceb8a54a41d9ddc9572c8cc74e  .batch/night/review-requests/s3-d11-nudge-dedup.md
9b54c9ef552fa6717af35d1e7e429da88034b319a0272b3fc0fc40dcfce9fc48  .batch/night/staging/s3-d11-live-recheck-report.md

$ sha256sum .runtime/.cache/s3-d11/a4d84a9b-eac/evidence.json
81a7f90cc7df0c0091147598a11d709808c7e8d186b276cd3840990a9502d153

$ git log --oneline -3
aeba1882 docs(batch): D11 转纯验收卡并入库派验单；D10 卡面 §9 补双 sha
a73ec4c6 merge(card/s3-d10-clear-reset): CARD-S3-D10-FF 清空后同步面板候选卡片
dd883c20 docs(s3): D10 §10 判词终版（判据 2 PASS，c55ce76c）＋ 实机取证件（a517a50d，39 行）

$ git status --porcelain -uall
 M .batch/night/cards/s3-d11-nudge-dedup.md
 M .batch/night/review-requests/s3-d11-nudge-dedup.md
?? .batch/night/staging/s3-d11-live-recheck-report.md
```

- 卡面与派验单为 `M`（未提交），本次判定即取现盘值；两件此后不再改动（admin 18:3x 令）。
- 证据件两处：判据 1／2／6 取 `a4d84a9b-eac`（126 行／4,186B／`81a7f90c…d153`）；判据 3 取 `084f3527-272`（执行方报告 §0 说明的沿用件）。
- 上述读数已冻结，判词后续不再改；如主身入库时另起提交，另报新头 sha。

## 2. 判据 1 `[live]` — PASS

evidence `a4d84a9b-eac`（`checks` 原文，我逐字段读过）：

```
triggerMode = { "judge1-no-dismiss": "db-seed(正文/检查点库造，非链路)",
                "judge1-after-close": "ui-close",
                "judge1-batch1/2/3": "ui-save",
                "judge2-dbflip-volume2": "db-flip(volumeIndex=2，非链路)" }
noDismiss  = {"bannerVisible":true,"bannerCount":1,"dismissedValue":null,"sampleCount":2,"sampledAt":"2026-11-22T07:42:39.419Z"}
afterClose = {"bannerVisible":false,"dismissedValue":"vn:final","sampleCount":2,"sampledAt":"2026-11-22T07:42:40.373Z"}
batches    = [{idx1,saveButtonGone:true,synopsisLen:189,bannerVisible:false,dismissedValue:"vn:final",sampleCount:2,07:42:43.887Z},
              {idx2,saveButtonGone:true,synopsisLen:256,...,07:42:47.304Z},
              {idx3,saveButtonGone:true,synopsisLen:323,...,07:42:50.723Z}]
```

判词：正文由真实编辑器保存递增（189→256→323 字，`ui-save`），关闭前提示 1 次、写入新格式 `vn:final`，关闭后三批全程 0 次；每读数 `sampleCount=2` 且间隔 ≥300ms。卷号与检查点状态为库造，非全链路连写（「wip 不可观测，库造，非链路」）；`incomplete=true → 0 次` 半段按裁定由 `[mock]` 覆盖，不在本条计分。

## 3. 判据 2 `[live]` — FAIL

evidence `a4d84a9b-eac` `checks.judge2Probe`：

```
{"bannerVisible":true,"dismissedValueBeforeClose":null,"sampleCount":2,"sampledAt":"2026-11-22T07:42:54.960Z",
 "dismissedValueAfterClose":"vn:final","afterCloseSampleCount":2,"afterCloseSampledAt":"2026-11-22T07:42:55.892Z"}
```

做法：清该项目 dismiss 键 → 检查点 `synopsis_unit_cursor.volumeIndex` 库造为 **2**（`incomplete=false`）→ 同态重开、进「情节大纲」→ 横幅提示 1 次 → 点 × 关闭。

期望：写入 `v2:final`。实测：写入 `vn:final` ⇒ 提示侧卷号 `null`，检查点里的 2 没被读。故「两卷 `volumeIndex` 可库造」这条等价触发**实测不成立**，判据 2 的 `[live]` 面在主线上不可达。

根因（我按盘上源码逐行核，与执行方 §4、admin 独立核实一致）：

```
$ grep -n activeChain src/App.tsx
333:          const activeChain = useSynopsisUnitChainStore.getState().chain
335:            volumeIndex: activeChain?.volumeIndex ?? null,
336:            synopsisIncomplete: activeChain?.status === 'running',

$ grep -n "unitChain" src/components/editor/ArchFileViewer.tsx
345:    volumeIndex: unitChain?.volumeIndex ?? null,
346:    synopsisIncomplete: unitChain?.status === 'running',

$ awk 'NR>=306 && NR<=309' src/services/workflows/synopsis-unit-launch.ts
308	  const explicitCursor = checkpoint.synopsis_unit_cursor ?? null
```

- 两处投影点都取连写链内存态；链只在内存里（`src/stores/synopsis-unit-chain-store.ts:7` 注释「只活在内存里：应用重启后不该悄悄地接着写」），`volumeIndex` 只由 UI `start()` 写（`:29-35`），不持久化、不读 `partial_arch.json`。
- 检查点里本来有卷号与定稿态（`synopsis-unit-launch.ts:308` 的 `explicitCursor`），两个投影点都没用。

三条后果（按码可推，且与 §3 实测一致）：①未连写过的项目链为 `null` ⇒ 指纹恒 `vn:final`，逐批写大纲也会按「定稿」提示，正是卡面 §2 禁止的用法；②无链时各卷共用 `vn`，判据 2 要的「每卷各一次」不成立；③重启后链失忆、卷号退回 `vn`，倾向多提示一次。

依主身 18:3x 口径：本条不降 `[mock]`（降即撤掉核心判据），改由 D11b 修实现；D11b 不在本判词作子项。

## 4. 判据 3 `[live]` — PASS

evidence `084f3527-272`（`checks` 原文）：

```
legacyDismissed    = {"firstPrompt":true,"firstSample":{"sampleCount":2,"sampledAt":"2026-11-22T06:11:02.828Z"},
                      "valueBefore":"dismissed","valueAfterClose":"vn:final","wroteNewFormat":true,
                      "secondPromptSameState":false,"secondSample":{"sampleCount":2,"sampledAt":"...06:11:07.771Z"}}
legacyChapterRange = {"firstPrompt":true,"valueBefore":"c3:l12","valueAfterClose":"vn:final","wroteNewFormat":true,
                      "secondPromptSameState":false,"secondSample":{"sampleCount":2,"sampledAt":"...06:11:16.951Z"}}
```

码面（我 grep 的现盘行号）：

```
29:const LEGACY_DISMISSED_VALUE = 'dismissed'
134:export function outlineNudgeDraftVersion(volume: OutlineNudgeVolumeIdentity): string {
135:  return `v${volume.volumeIndex ?? 'n'}:${volume.synopsisIncomplete ? 'wip' : 'final'}`
150:  return input.dismissedVersion !== outlineNudgeDraftVersion(input.volume)
174:    if (!value || value === LEGACY_DISMISSED_VALUE) return null
189:    storage.setItem(outlineCharacterNudgeKey(projectPath), outlineNudgeDraftVersion(volume))
```

三条 FAIL 线逐条判：①同一卷同一状态下第二次提示 → `secondPromptSameState=false`，不成立；②再次关闭仍写旧格式 → `wroteNewFormat=true`、值 `vn:final`，不成立；③为兼容旧值删改调用点或扩到其他文件 → R4 作用域为空（见 §8），不成立。两种旧值（`dismissed`、`c3:l12`）各测一遍，均「只提示一次 → 再关闭写新格式 → 同态不再提示」。

## 5. 判据 4 `[mock]` — PASS（我复跑）

```
$ node scripts/run-tests-electron.mjs src/services/__tests__/architecture-character-nudge.test.ts
 ✓ src/services/__tests__/architecture-character-nudge.test.ts (15 tests) 7ms
 Test Files  1 passed (1)
      Tests  15 passed (15)
TEST_EXIT=0
```

未加 `-t` 过滤，整文件汇总行＋末行 `EXIT=` 齐。

## 6. 判据 5 `[static]` — PASS（我复跑）

```
$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 26.7s
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] 全部通过。
CHECKFAST_EXIT=0
```

## 7. 判据 6 `[live]` — PASS

```
instancesThisRun = 1
exitCode = 0
leftoverElectronProcesses = 0
tasklistElectronRaw = "INFO: No tasks are running which match the specified criteria.\r\n"
```

三项取自同一次运行 `a4d84a9b-eac`，且 `tasklist` 原文已在 evidence 内（不再靠判词手补）。

## 8. R4（作用域写死）

```
$ git diff --numstat a73ec4c6..HEAD -- src electron scripts | wc -l
0
$ git diff --name-status --diff-filter=A a73ec4c6..HEAD -- src electron scripts | wc -l
0
```

零改动、零新增生产文件；`aeba1882` 是纯文档提交，按 admin 18:3x 记观察项不判 FAIL。

## 9. 记录项（不判 FAIL）

1. 卡面与派验单现为 `M` 未提交，本判词分母取现盘值（`d97949e0`／`35608af6`）；入库时若另起提交，另报新头 sha。
2. 交件报告 §0 把判据 3 记为「沿用 `084f3527-272`」，我按该 evidence 逐字段核过，与盘上一致，故认。
3. 派验单把判据 4／5 标为「QA 侧」，我未沿用执行方口径，两条均本机复跑（§5／§6）。
4. 判据 1 的 `noDismiss` 阶段 `triggerMode` 为 `db-seed(正文/检查点库造，非链路)`：该读数证明的是「无 dismiss 时提示一次」的读取链，正文来源为库造；三批递增才是 `ui-save` 真实编辑器路径。
5. 判据 2 的 FAIL 证据只取界面横幅与关闭写入值（`vn:final` vs 期望 `v2:final`），未依赖任何脚本侧 IPC 计数。
6. D11b 不在本判词作子项（admin 18:3x 令），本卡六条判完即止；判据 2 的修法归 D11b 卡面。

## 10. 交付

- 本判词：`.batch/night/reports/s3-d11-qa-firstcheck.md`（`M`／`??` 未入库，按纪律随主身主线提交）
- 回执：`.batch\night\bridge\to-owner`

<!-- DONE -->

## 11. 版本变更

- v1 2026-11-22 18:4x 首次落盘：六条判据全判，判据 2 FAIL、总判退回（D11 不 PASS）。无中间稿。
