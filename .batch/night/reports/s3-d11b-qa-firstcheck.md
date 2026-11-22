# QA 首验判词 · CARD-S3-D11b（补卡去重键改读检查点卷号与定稿态）

From: QA · AI writer项目组 | 57c8bd18
To: 项目总负责人 · AI writer项目组（并入主线，转主身）
判定面：`b9bdcba3f489e89aaf0c1ab52021e20dc4ad0e52`（`fix(nudge): CARD-S3-D11b 补卡去重键改读检查点卷号与定稿态`，父 `788b84fd8a2c1a53be7de4b7dab9dbfb565f4734`；卡分支 `card/s3-d11b-checkpoint-volume-projection`，未 push、未动 develop 主区）
执行方：developer · AI writer项目组（工作树 `C:\develop\workspace\AI-writer\wt-d11b`）
落盘：2026-11-22 19:1x（本卡唯一判词，无中间稿）

## 0. 结论

| # | 判据（卡面原文摘要） | 分层 | 结论 |
|---|---|---|---|
| 1 | 同卷 `incomplete=true` 连三批 ⇒ 0 次；翻 `false` 后再保存 ⇒ 1 次 | `[live]` | **PASS** |
| 2 | 跨两卷各一次：卷 1 关闭写 `v1:final`；进卷 2 再提示 1 次并写 `v2:final` | `[live]` | **PASS** |
| 3 | 链为 `null` 但检查点有卷号 ⇒ 指纹 `v<卷号>:...`；`incomplete=true` 时 0 次 | `[live]` | **PASS** |
| 4 | 重启后卷号不丢：顺序两次启动、`leftover=0`，指纹仍 `v<卷号>:...` | `[live]` | **PASS** |
| 5 | 两处投影点不再读链 ＋ 判定函数内有 `synopsisIncomplete` 门 | `[static]` | **PASS** |
| 6 | 单测整文件汇总行＋`EXIT=`；`check:fast` 末行；写盘格式不变 | `[static]` | **PASS** |

**总判：PASS（D11b 六条全过），建议放行 `b9bdcba3` 入库并合并主线**；push 与合并只由主身做。

## 1. 分母与判定面（现算，已冻结）

分母一律取库内 blob（派验单 `:12` 规矩；工作副本 CRLF 读数不作分母）：

```
$ git show 788b84fd:.batch/night/cards/s3-d11b-checkpoint-volume-projection.md | wc -lc
    113   11299
$ git show 788b84fd:<同上> | sha256sum
c6a95633500fae6efb3ccf6dc445b87885f54c1a5dd5854cc90b8ed06da829a6  -

$ git show c424a6f2:.batch/night/review-requests/s3-d11b-checkpoint-volume-projection.md | wc -lc
     73    5819
$ git show c424a6f2:<同上> | sha256sum
e1a9f1993e53b3201afa04126a08dc90e8ad04c4193565f6ca18f4c30d91a908  -

$ wc -lc .batch/night/staging/s3-d11b-report.md
  112  9487
$ sha256sum .batch/night/staging/s3-d11b-report.md
366c6aeddbdc12de88702a1670a47e26c5715c9deb48d75ea02754086bda9621

$ wc -lc ../wt-d11b/.runtime/.cache/s3-d11b/0a2815bf-a6e/evidence.json
  337 11161
$ sha256sum ../wt-d11b/.runtime/.cache/s3-d11b/0a2815bf-a6e/evidence.json
4e382026e46da17f843595dd121967c8ca69865cd2895815b8dbb6857e43af3d
```

- `git log --oneline -1 b9bdcba3` → `b9bdcba3 fix(nudge): CARD-S3-D11b 补卡去重键改读检查点卷号与定稿态`。
- `git rev-parse b9bdcba3^` → `788b84fd8a2c1a53be7de4b7dab9dbfb565f4734`（分支起点正确）。
- `git status --porcelain -uall -- src electron scripts`（wt-d11b）→ 空。
- 派验单分母行报的 5,892B / `a7af268f` 是工作副本 CRLF 读数，**不作分母**（admin 19:00 已认此错，判词统一取库内 blob `e1a9f199`）。

## 2. 判据 1 `[live]` — PASS

evidence `0a2815bf-a6e`（`checks.judge1` 原文）：

```
wipInitial  = {"bannerVisible":false,"bannerCount":0,"dismissedValue":null,"sampleCount":2,"sampledAt":"2026-11-22T11:03:36.244Z"}
wipBatches  = [{"saved":{"saveButtonGone":true},"synopsisLen":189,"bannerVisible":false,"bannerCount":0,"dismissedValue":null,"sampleCount":2,"sampledAt":"...11:03:39.664Z"},
               {"synopsisLen":256,"bannerVisible":false,"bannerCount":0,"sampleCount":2,"sampledAt":"...11:03:43.040Z"},
               {"synopsisLen":323,"bannerVisible":false,"bannerCount":0,"sampleCount":2,"sampledAt":"...11:03:46.443Z"}]
finalFirst  = {"bannerVisible":true,"bannerCount":1,"dismissedValue":null,"sampleCount":2,"sampledAt":"...11:03:51.013Z"}
finalSave   = {"bannerVisible":true,"bannerCount":1,"synopsisLen":390,"sampleCount":2,"sampledAt":"...11:03:54.412Z"}
finalBatches= [{"synopsisLen":457,"bannerVisible":false,"bannerCount":0,"dismissedValue":"v1:final"},…524…,…591…]
triggerMode = judge1-wip-batch1/2/3 = "ui-save(正文真实编辑器保存)"；judge1-dbflip-final = "db-flip(incomplete=false，卷 1；库造，非链路)"
```

判词：`incomplete=true` 期间三批真实编辑器保存（正文 189→256→323，`saveButtonGone=true`）提示 **0 次**；翻 `false` 后提示 **1 次**（11:03:51.013Z），定稿后再保存仍 1 次（同一横幅未重计，非新增）；关闭后三批均 0 次且 `dismissedValue` 恒 `v1:final`。检查点翻转为库造，正文全程走界面保存，口径符合卡面 §4 判据 1 与 `collab-rules-v1.md` §8 第 62 行取样（`sampleCount=2`、间隔 ≥300ms）。

## 3. 判据 2 `[live]` — PASS

```
beforeClose = {"bannerVisible":true,"bannerCount":1,"dismissedValueBeforeClose":"v1:final","sampleCount":2,"sampledAt":"...11:04:10.070Z"}
afterClose  = {"dismissedValueAfterClose":"v2:final","bannerVisible":false,"sampleCount":2,"sampledAt":"...11:04:11.013Z"}
triggerMode = judge2-dbflip-volume2 = "db-flip(volumeIndex=2, incomplete=false；库造，非链路)"
```

判词：卷 1 关闭后 `dismissedValue=v1:final`；检查点卷号翻 2 后同态重开，横幅**再提示 1 次**，关闭写入 **`v2:final`**。两卷 `volumeIndex` 分别为 1（`checkpointSeed.synopsis_unit_cursor.volumeIndex=1`）与 2（`judge2.checkpointBeforeRestart.synopsis_unit_cursor.volumeIndex=2`），跨卷「各一次」成立。

## 4. 判据 3 `[live]` — PASS

```
judge3.afterClose = {"dismissedValue":"v1:final","bannerVisible":false,"sampleCount":2,"sampledAt":"...11:03:55.363Z"}
指令链：同卷 incomplete=true 三批 0 次（§2）→ 翻 false 后关闭一次 → 读 localStorage = v1:final（不是 vn:final）
```

链为 `null`：`triggerMode["judge1-wip-initial"]="db-seed(incomplete=true, chain=null；库造，非链路)"`，且本次运行 `stepLog` 中没有任何连写链启动动作（18 条 stepLog 只有 build、judge1/3/2/4 的保存／关闭／重启读数），进程为新起 `--user-data-dir`。

判词：未连写项目（chain=null）指纹取 `v1:final` 而非 `vn:final`，未定稿期间 0 次提示；指纹证据按 admin 观测点口径**只取翻转后那次关闭写入**，未用 0 次那一侧数据充当指纹证据。

## 5. 判据 4 `[live]` — PASS

```
instancesThisRun = 2
instances = [{"index":1,"label":"instance1","quit":{"pid":37372,"closedAt":"2026-11-22T11:04:11.155Z"},"leftoverElectronProcesses":0,"tasklistElectronRaw":"INFO: No tasks are running which match the specified criteria.\r\n"},
             {"index":2,"label":"final","quit":{"pid":7156,"closedAt":"2026-11-22T11:04:20.870Z"},"leftoverElectronProcesses":0,"tasklistElectronRaw":"INFO: No tasks are running which match the specified criteria.\r\n"}]
judge2.checkpointBeforeRestart = {"synopsis_incomplete":false,"synopsis_unit_cursor":{"volumeIndex":2}}
judge2.dismissedBeforeRestart   = "v2:final"
judge4.afterRestart             = {"bannerVisible":false,"bannerCount":0,"dismissedValue":"v2:final","sampleCount":2,"sampledAt":"...11:04:15.209Z","checkpoint":{"synopsis_incomplete":false,"synopsis_unit_cursor":{"volumeIndex":2}}}
judge4.volume3BeforeClose       = {"bannerVisible":true,"bannerCount":1,"dismissedValue":"v2:final","sampleCount":2,"sampledAt":"...11:04:19.743Z"}
judge4.volume3AfterClose        = {"dismissedValue":"v3:final","bannerVisible":false,"sampleCount":2,"sampledAt":"...11:04:20.689Z"}
triggerMode.instance2:launch    = "顺序第二次启动（同一 userData，不并行）"
```

判词：顺序两次启动（pid 37372 → pid 7156，每次 `app.quit` 后 `leftover=0`、`tasklist` 原文入 evidence）；重启后横幅 0 次、指纹仍 `v2:final`（若卷号退回 `vn`，此处会再提示一次）；正向反证——重启后卷号翻 3 即再提示 1 次并写 `v3:final`。前后两次指纹原文齐（`v2:final` → `v3:final`）。

## 6. 判据 5 `[static]` — PASS

在判定面取原文（`git show b9bdcba3:<path>`）：

```
$ git show b9bdcba3:src/App.tsx | grep -n "chain?.volumeIndex\|chain?.status === 'running'\|unitChain?.status\|activeChain?.volumeIndex"
（无输出）APP_EXIT=1
$ git show b9bdcba3:src/components/editor/ArchFileViewer.tsx | grep -n "<同上>"
（无输出）VIEW_EXIT=1
```

判定函数三行相邻原文（`git show b9bdcba3:src/services/architecture-character-nudge.ts`，行号已按插入后顺延）：

```
149	  if (!hasOutlineContent(input.synopsis)) return false
153	  if (input.volume.synopsisIncomplete) return false
154	  return input.dismissedVersion !== outlineNudgeDraftVersion(input.volume)
```

判词：两处投影点旧读法零命中；`!hasOutlineContent` → `synopsisIncomplete`（`return false`）→ `dismissedVersion !==` 三行相邻顺序成立。行号由实施前 `:149`／`:150` 顺延为 `:153`／`:154`，按内容相邻判、不按固定行号判（admin 已预裁）。

## 7. 判据 6 `[static]` — PASS（我在 wt-d11b 判定面复跑）

```
$ cd C:/develop/workspace/AI-writer/wt-d11b && git rev-parse HEAD
b9bdcba3f489e89aaf0c1ab52021e20dc4ad0e52
$ node scripts/run-tests-electron.mjs src/services/__tests__/architecture-character-nudge.test.ts
 ✓ src/services/__tests__/architecture-character-nudge.test.ts (16 tests) 5ms
 Test Files  1 passed (1)
      Tests  16 passed (16)
UNIT_EXIT=0

$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 18.6s
doc links: checked 1468, broken 0
doc placement: 扫描 437 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] 全部通过。
CHECKFAST_EXIT=0

$ git show b9bdcba3:src/services/architecture-character-nudge.ts | awk 'NR==135'
  return `v${volume.volumeIndex ?? 'n'}:${volume.synopsisIncomplete ? 'wip' : 'final'}`
```

写盘格式一字未改；新增两条用例（`该卷未定稿（synopsis_incomplete=true）期间一次都不提示，正文每批增长也不提示`：三批 0 次＋翻 `false` 后 `true`；`模拟连写 3 批` 改为按 `VOLUME_1_FINAL` 计 1 次）与原有用例（跨卷、全局开关、旧格式）同文件内，未新建文件。

另补实例侧读数（我现场跑）：`tasklist | grep -c electron` → `0`（`GREP_C_EXIT=1` 是 grep 无命中，非失败）。

## 8. R4（作用域写死）

```
$ git diff --numstat 788b84fd..b9bdcba3 -- src electron scripts
7	4	src/App.tsx
24	7	src/components/editor/ArchFileViewer.tsx
42	12	src/services/__tests__/architecture-character-nudge.test.ts
4	0	src/services/architecture-character-nudge.ts
$ git diff --name-status --diff-filter=A 788b84fd..b9bdcba3 -- src electron scripts | wc -l
0
```

四文件全在卡面 §3 白名单内（两处投影点、判定函数、对应单测）；`electron/`、`scripts/` 零改动，无新增生产文件。改法逐条对卡面：投影取 `readSynopsisUnitCheckpoint(...)` 同源路径（`src/App.tsx` 内 `await` 后补 `if (!isCurrentProjectSession()) return`）；`ArchFileViewerSession` 里 `useMemo` → `useState`＋`useEffect`（`captureProjectSession` → `isProjectSessionPath` → `disposed`＋`isProjectSessionCurrent` 守卫），未就绪态 `nudgeVolume=null` 时不判定、`settleOutlineNudge` 内 `if (!nudgeVolume) return` 不写 dismiss；判定门插在既有两道门之后；`synopsis-unit-chain-store.ts` 未动。

## 9. 记录项（不判 FAIL）

1. 卡面 §8 R4 仍写 `14401f4b..HEAD`（卡面冻结不改），派验单已统一为 `788b84fd..HEAD`，本次按派验单判；两处差值是卡面冻结前的旧 base，属已知。
2. `chain=null` 无直接采样字段：证据是 `triggerMode` 标注＋`stepLog` 无连写启动＋新 `--user-data-dir`，属间接证明；判据 3 的判定键（`v1:final` 指纹）不依赖它。
3. evidence 未落 `tasklist | grep -c electron` 原文（只有 `tasklistElectronRaw`），我现场补测 `0`；后续卡建议直接落该行。
4. `judge1.finalSave.bannerCount` 仍为 1：同一横幅未重计，非「第二次提示」。
5. 判据 5 行号顺延（`:149/:150` → `:153/:154`）按内容相邻判通过，符合 admin 19:0x 预裁。
6. 判词分母取库内 blob（卡面 `c6a95633`、派验单 `e1a9f199`）；工作副本 CRLF 读数（`ef8e7cd9`／`a7af268f`）不进分母。

## 10. 交付

- 本判词：`.batch/night/reports/s3-d11b-qa-firstcheck.md`（未入库，随主身主线提交）
- 回执：`.batch\night\bridge\to-owner`

<!-- DONE -->

## 11. 版本变更

- v1 2026-11-22 19:1x 首次落盘：六条全 PASS，总判 PASS，建议放行 `b9bdcba3` 入库合并。无中间稿。
