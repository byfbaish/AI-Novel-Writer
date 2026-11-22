# CARD-S3-D11 · 实机取证交件（判据 1 `[live]` 重跑 ＋ 判据 2 可达性探针）

执行方：developer · AI writer项目组（群分身 `906d802a`）· 2026-11-22 15:4x
取数件：基线 `aeba1882` ／ 卡面 `s3-d11-nudge-dedup.md`（88 行 / 12,119B / `d97949e0…4ac`）／ 脚本 `.runtime/s3-d11-c.mjs`（350 行 / 18,888B / `eacf6431…3af`）
性质：**取证报告**（未改任何生产代码；工作树仅两件 `.batch` 下的卡面与派验单处于 M 状态，非我所改，见 §1）

## 0. 结论先行

| 判据 | 分层 | 结论 |
|---|---|---|
| 1 同卷三批不重复、定稿后一次 | `[live]` | **PASS（按 15:3x 裁定的等价面重跑）**：无 dismiss → 横幅 1 次；关闭写 `vn:final` 后连跑三批（正文 189→256→323 字）→ 0 次 |
| 2 进入下一卷并完成 ⇒ 再提示 1 次 | `[live]` | **不可达，未判**：卡面给的等价触发「两卷 `volumeIndex` 可库造」**实测不成立**——库造 `volumeIndex=2` 后关闭仍写 `vn:final`。请裁定（§3） |
| 3 存量兼容 `[live]` | `[live]` | 本次不重跑，沿用既有 evidence `084f3527-272`（admin 15:3x 裁定范围只含判据 1／探针判据 2） |
| 4 单测 | `[mock]` | 不重跑（QA 侧） |
| 5 `pnpm test` ＋ `check:fast` | `[static]` | 不重跑（QA 侧） |
| 6 实例纪律三项 | `[live]` | **PASS**（同一次运行：`instancesThisRun=1`／`exitCode=0`／`leftoverElectronProcesses=0`，`tasklist` 原文已落 evidence） |

**附一项需裁的发现（F1，§4）**：主线实现里的「卷号 + 定稿态」两处调用点都取 **连写链 store**（`volumeIndex` ＋ `status === 'running'`），**没有直读检查点 `synopsis_incomplete`**；卡面 §1／§2 追认写的「直读 `synopsisIncomplete`」与代码不符。这同时是判据 2 不可达的根因。

## 1. 判定面与取数件（现算）

```
$ git log -1 --oneline
aeba1882 docs(batch): D11 转纯验收卡并入库派验单；D10 卡面 §9 补双 sha

$ git status --porcelain
 M .batch/night/cards/s3-d11-nudge-dedup.md
 M .batch/night/review-requests/s3-d11-nudge-dedup.md
```

| 件 | 读数 | sha256 |
|---|---|---|
| 卡面 `.batch/night/cards/s3-d11-nudge-dedup.md` | 88 行 / 12,119B | `d97949e03d96ed84dea0bcb22b2fcdb0a0e2eb1d22e00fbcd35060307bbd54ac` |
| 派验单 `.batch/night/review-requests/s3-d11-nudge-dedup.md` | 52 行 / 7,137B | `35608af625651218f64757ae4329ab079b5c06ceb8a54a41d9ddc9572c8cc74e` |
| 取证脚本 `.runtime/s3-d11-c.mjs` | 350 行 / 18,888B | `eacf643176da2dd80f5cff288be4be43bc23d91f6180547c5e4993957a5a83af` |
| evidence `.runtime/.cache/s3-d11/a4d84a9b-eac/evidence.json` | 126 行 / 4,186B | `81a7f90cc7df0c0091147598a11d709808c7e8d186b276cd3840990a9502d153` |

注：我 15:38 读卡面时为 85 行 / 10,340B / `1bd17ec102123440e5e08aa9403f8d8c6afb58022e708d549a5375cf5b802eb7`，此后卡面被追加过 3 行 / 1,779B（15:14／15:3x 两条裁定文本），以**现值** `d97949e0` 为判定面。两件 `.batch` 的 M 状态先于我开工，不是我改的。

## 2. 判据 1 读数（runId `a4d84a9b-eac`）

取样口径：`[role="status"]` 含「情节大纲已完成」计数；稳定取样＝连续两次读数相同且间隔 ≥ 300ms、轮询 400ms，`sampleCount`／`sampledAt` 落 evidence（`collab-rules-v1.md` §8 第 62 行）。

| 阶段 | triggerMode | 横幅 | `dismissedValue` | sampleCount｜sampledAt |
|---|---|---|---|---|
| 无 dismiss（检查点 `incomplete=false`） | `db-seed`（正文库造，非链路） | **1**（`bannerCount=1`） | `null` | 2｜`2026-11-22T07:42:39.419Z` |
| 点 × 关闭 | `ui-close` | 0 | **`vn:final`**（新格式） | 2｜`07:42:40.373Z` |
| 第 1 批保存 | `ui-save` | 0 | `vn:final` | 2｜`07:42:43.887Z` |
| 第 2 批保存 | `ui-save` | 0 | `vn:final` | 2｜`07:42:47.304Z` |
| 第 3 批保存 | `ui-save` | 0 | `vn:final` | 2｜`07:42:50.723Z` |

正文走真实编辑器 `Ctrl+End` 输入 ＋ `button[title^="保存"]` 保存，三批落库长度 `189 → 256 → 323`（`db:project-core-get` 读回），保存后 `saveButtonGone=true`，均 ≥ 50 有效字（`architecture-character-nudge.ts:90-96` 门槛）。
判词：**「正文由界面保存递增、三批全程只提示过 1 次（关闭前）、关闭后再未提示；卷号与检查点状态为库造，非全链路连写」**。wip 态（`incomplete=true` 时 0 次）按 15:3x 裁定仍降 `[mock]`，本次不碰。

## 3. 判据 2 探针：`volumeIndex` 库造到不了读侧（不可达）

做法：清 localStorage 里该项目 dismiss 键 → 把 `partial_arch.json` 的 `synopsis_unit_cursor.volumeIndex` 库造为 **2**（`incomplete=false`）→ 同态重开项目、进「情节大纲」。

| 阶段 | triggerMode | 横幅 | `dismissedValue` | sampleCount｜sampledAt |
|---|---|---|---|---|
| 库造卷二后重开 | `db-flip(volumeIndex=2)` | 1 | `null` | 2｜`07:42:54.960Z` |
| 点 × 关闭 | `ui-close` | 0 | **`vn:final`**（**不是** `v2:final`） | 2｜`07:42:55.892Z` |

结论：关闭写入的指纹是 `vn:final` ⇒ 提示侧算出的 `volumeIndex` 是 `null`，**检查点里的 `volumeIndex=2` 根本没被读**。因此「两卷 `volumeIndex` 可库造」这条等价触发不成立，判据 2 的 `[live]` 面在合成模型下无法取证（真链要求整整两卷单元生成，wip 窗口同样不足 1 秒，见 15:3x 裁定）。

## 4. 发现 F1：实现取的是「连写链状态投影」，不是卡面 §2 判定的「直读检查点」

两处调用点，同一形态：

```
$ sed -n '334,337p' src/App.tsx
          const volume = outlineNudgeVolumeIdentity({
            volumeIndex: activeChain?.volumeIndex ?? null,
            synopsisIncomplete: activeChain?.status === 'running',
```

```
$ sed -n '344,347p' src/components/editor/ArchFileViewer.tsx
  const nudgeVolume = useMemo(() => outlineNudgeVolumeIdentity({
    volumeIndex: unitChain?.volumeIndex ?? null,
    synopsisIncomplete: unitChain?.status === 'running',
```

- 旁证：`src/stores/synopsis-unit-chain-store.ts:3-7`「只活在内存里：应用重启后不该悄悄地接着写」；`:29-36` `volumeIndex` 只由 UI `start()` 写入，不持久化、不读 `partial_arch.json`。
- 后果（三点，均按代码可推、与 §3 实测一致）：
  1. **未连写过的项目**：链为 `null` ⇒ `volume={null,false}` ⇒ 指纹恒 `vn:final`；逐批写大纲（检查点一直 `incomplete=true`）也会立刻按「定稿」提示——正是卡面 §2 明令禁止的「把链状态当大纲完成」。
  2. **跨卷去重实际不生效**：没有链时所有卷共用 `vn`，判据 2 想要的「每卷各一次」在无链状态下不成立。
  3. **重启即失忆**：链只在内存里，重启后卷号丢失，指纹退回 `vn`；已 dismiss 的 `v2:final` 与 `vn:final` 不同 ⇒ 会再提示一次（方向上是「多提示」，不是静默丢掉提醒）。
- 语义差别一句话：现行「定稿」= **连写链是否在跑**；卡面 §2 要的「定稿」= **该卷大纲检查点是否定稿**（`synopsis_incomplete === false`）。前者会在链停止／失败／从未启动时把未定稿当定稿。

## 5. 请裁两项（我不自选）

1. **判据 2 的 `[live]` 面**：(a) 降 `[mock]`，由单测覆盖跨卷（`architecture-character-nudge.test.ts:34,51-57` 已有 `VOLUME_2` 常量与 identity 用例）＋判词写明「库造不可达，非链路」；或 (b) 坚持 `[live]`，则需另开改码卡让卷号可从检查点读到（联动 F1），本卡就不再是零改码验收卡。
2. **F1 取法偏差**：(a) 认账——把 §1／§2 追认的「直读 `synopsisIncomplete`」改成「取连写链 `status==='running'` 作定稿态」，并接受上述三点后果（尤其「未连写项目一律按 final 提示」），本卡仍零改码；或 (b) 不认账——那是一条新的改码卡（把定稿态改成直读检查点、并与卷号来源一起收口），本卡暂缓。

我的判定倾向只作参考、不代裁：判据 1 的 `[live]` 面已经站住；F1 是**卡面口径与代码不一致**，不是代码坏，先要口径统一，否则 QA 首验必然在对「定稿态」的定义上打回。

## 6. 复现命令

```
$ node --check .runtime/s3-d11-c.mjs && echo CHECK_OK
CHECK_OK

$ node .runtime/s3-d11-c.mjs            # 单实例，跑完 app.quit，约 95s
[d11c] judge1:no-dismiss · {"bannerVisible":true,"bannerCount":1,"dismissedValue":null,"sampleCount":2,...}
[d11c] judge1:after-close · {"bannerVisible":false,"dismissedValue":"vn:final",...}
[d11c] judge1:batch1 · saved=true banner=false   （batch2／batch3 同）
[d11c] judge2:probe · {...,"dismissedValueAfterClose":"vn:final"}
exitCode: 0 ／ leftoverElectronProcesses: 0 ／ instancesThisRun: 1
$ echo EXIT=$?
EXIT=0
```

`tasklist` 原文（evidence `tasklistElectronRaw`）：

```
INFO: No tasks are running which match the specified criteria.
```

`leftoverElectronProcesses` 的计数取自 `Get-CimInstance Win32_Process` 里 `CommandLine` 含本次 `--user-data-dir` 的 `electron.exe` 条数（比全局 `grep -c electron` 更严，不会把别的实例算成本次残留）；全局 `tasklist /FI "IMAGENAME eq electron.exe"` 原文同时落在 evidence 里。

## 7. 裁定与停手留痕（只记录，不改本报告口径）

- 15:4x 群管理分身独立核过 F1，定性**成立**：两处投影点（`src/App.tsx:333-338`、`src/components/editor/ArchFileViewer.tsx:344-347`）都没用检查点，而卷号本来就在检查点里（`synopsis-unit-launch.ts:308` `const explicitCursor = checkpoint.synopsis_unit_cursor ?? null`）——故判据 2 `[live]` 不可达是必然，不是本轮取样运气问题；判据 2 定性 FAIL、D11 不 PASS；**不许**以「降 `[mock]`」替代「跨卷各一次」这条核心判据。判据 1 的 `[live]` 读数与判据 3／4／5 被认，不重跑。
- 计划项：D11b（两处投影源改读 `synopsis_unit_cursor.volumeIndex` 与检查点 `synopsis_incomplete`，白名单锁 `App.tsx`／`ArchFileViewer.tsx`／`architecture-character-nudge.ts`＋对应单测，判据按「跨卷各一次」重写）——**是否今开待主身一句**，S3 组成变更须主人点头。
- 15:5x **停手令**（群管理分身）：D11 卡面与派验单一个字不改、D11b 草案先不写；本报告的取证件（`a4d84a9b-eac`）与脚本 sha 原样保留，不覆盖不删；F1 三条后果按本报告 §4 记录，**口径不改、代码不碰**。
- 本报告自身口径因此不动：判据 2 仍记为「不可达，未判」＋§5 两项请裁，最终判词归 QA／主身，我不代判。
