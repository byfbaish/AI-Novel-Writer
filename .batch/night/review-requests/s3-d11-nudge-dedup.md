# 派验单 · CARD-S3-D11（补角色卡提示去重：卷级去重＋存量旧值一次重提示）

From: 项目总负责人 · AI writer项目组
To: QA · AI writer项目组（首验方）
执行方：developer · AI writer项目组——判据 3 及 1／2 的 `[live]` 由其在 `develop` 起真实实例取证；本卡**预期零改码**
外派位：**本卡不宜外派**。理由：判据 3 为 `[live]` 实机取证，须在本机真实 Electron＋真实 SQLite/localStorage 上跑，外派只能交结论不交读数。
分母（报出时现算）：
- 卡面 `.batch/night/cards/s3-d11-nudge-dedup.md` 88 行 / 12,119B / sha256 `d97949e03d96ed84dea0bcb22b2fcdb0a0e2eb1d22e00fbcd35060307bbd54ac`
- 本单 sha 由报出时现算（互引会循环，此处不写死）
- 实施包：**无**——零改码卡没有实施包，也别向执行方要
base：**`a73ec4c6`**（`exp/mainline-1119` 头，D10 入库合并提交）
分支：`card/s3-d11-nudge-dedup`，从 `a73ec4c6` 起，**预期零提交**；判定取 `git diff --numstat a73ec4c6..HEAD -- src electron scripts` 输出为空
排期：D4／D7／D16／D10 已收口；本卡为 S3 第五张、也是最后一张；D16B 判据 5 的 live 在其后，**一次一张**

## 判据（逐条要原文；缺一条即不出总判）

**本卡判据分层（照卡面标签）：第 1、2、3 条 `[live]`；第 4 条 `[mock]`；第 5 条 `[static]`；第 6 条 `[live]`。`[live]` 条按 `collab-rules-v1.md` §8 第 62 行取样口径：确定性取样、连续两次读数相同且间隔 ≥ 自设最小间隔，`sampleCount ≥ 2` 与取样时刻写进 evidence；对照读数（手动刷新／重开界面后的计数）只作旁证，不得顶替判定键。**

1. **[live]** 同一卷连写 3 批（检查点仍 `incomplete=true` 时）⇒ 提示 0 次；最后一使 `synopsis_incomplete=false` ⇒ 提示 1 次。
   - **等价触发（admin 11-22 15:14 裁，主身 15:2x 加码）**：允许以「UI 保存正文（三批）＋库翻转 `synopsis_incomplete` 检查点状态」代替全链路连写。理由写清：`src/services/architecture-character-nudge.ts:134-136` 指纹只含 `volumeIndex` 与 `synopsisIncomplete`，**正文长度不进指纹**；mock 层 `src/services/__tests__/architecture-character-nudge.test.ts:94` 已覆盖「连写 3 批、每批正文更长」，故判据 1／2 与是否跑真链无关。约束：正文改动必须走真实编辑器保存路径（不许直接写库），卷与检查点可库造；evidence 记 `triggerMode`（正文 `ui-save`／卷与检查点 `db-flip`），判词对库造项逐条写「库造，非链路」。
   - **wip 态不可观测（admin 11-22 15:3x 裁 ①，判据 1 的 live 口径据此换）**：合成模型下「`incomplete=true` 时 0 次」与「翻 `final` 后 1 次」经 UI 不可达（`src/services/workflows/synopsis-unit-launch.ts:297` 的 `skip('checkpoint-lost')`、先起链则在首单元即停、`ArchFileViewer.tsx:1149` 的 `!recovery` 门＋`architecture-character-nudge.ts:149` 的正文 ≥50 字门），这两半段降 `[mock]`（依据 `architecture-character-nudge.test.ts:94`、`:64-65`）。**`[live]` 判据 1 改判对照**：①无 dismiss 记录时保存正文 ⇒ 提示 **1 次**；②关闭（写入 `v…`）后连跑三批 ⇒ **0 次**；两段都要`sampleCount ≥ 2` 与取样时刻，判词写「wip 不可观测，库造，非链路」。判据 2 的 live 不降：两卷都造 `final`、正文走界面保存、经 `:170-177` 真实 `storage.getItem` 链＋真 toast，取「卷 1 一次／卷 2 一次」与两卷 `volumeIndex`；仅「wip→final 各一次」半段降 `[mock]`。
2. **[live]** 进入下一卷并完成 ⇒ 再提示 1 次（贴两卷的 `volumeIndex` 与提示次数）。
   - 等价触发同上：两卷 `volumeIndex` 可库造（`wip`→`final`），正文变化仍走界面保存路径；evidence 记 `triggerMode`，判词写明「库造，非链路」。
3. **[live] 判据 3「存量兼容」**：读到旧格式值（`dismissed` 或 `c<ch>:l<len>`）时按「未处理」返回，允许该项目**一次**重提示；用户再次关闭必须写入新格式 `v<卷号>:<wip|final>`，此后同一卷不再提示，该卷大纲定稿态变化（`wip`→`final`）才可再提示一次。判 FAIL 线：①同一卷同一状态下第二次提示；②再次关闭后仍写旧格式；③为兼容旧值而删改调用点或扩到其他文件。
   - 取证做法（须写进 evidence）：往该项目 localStorage 写 `dismissed` 与 `c3:l12` 两种旧值各跑一遍，记录「是否只提示一次」「再次关闭后写入的值是否为 `v…` 格式」，前后 localStorage 原文与提示计数都贴。
4. **[mock]** 单测：①同卷多批不重复；②跨卷各一次；③存量形态兼容。贴整文件汇总行＋末行 `EXIT=`（禁 `-t` 过滤）。
5. **[static]** `pnpm test <相关路径>` 整文件汇总行 + `pnpm check:fast` 末行 + `EXIT=`。
6. **[live]** 实例纪律三项：`instancesThisRun`、`exitCode`、`leftoverElectronProcesses`；另须贴 `tasklist | grep -c electron` 输出原文（须写进 evidence）。

## 读侧口径（主身 11-22 加码）

- **读侧必须走生产路径**：不许把 `dismissedVersion`／`volume` 直接塞给 `shouldNudgeOutlineCharacterSupplement` 冒充 live——那只能算 `[mock]`；`[live]` 必须经 `:170-177` 那段真实 `storage.getItem` 读取链，并由真实 toast／横幅触发。


## R4（作用域写死）

1) `git diff --numstat a73ec4c6..HEAD -- src electron scripts` 输出为空（无改动、无新增）。
2) **无新增生产文件**：`src/`、`electron/`、`scripts/` 下未新增文件；取证脚本一律放 `.runtime/`（不入库）。
不采信不带 `<base>..<branch>` 作用域的 `git diff --stat`。

## 记录项（不判 FAIL，判词里各记一行）

- 本卡是**纯验收卡**：判据 1／2／4／5／6 的取法已由 `0b5fd9a6` 落进主线（`git merge-base --is-ancestor 0b5fd9a6 a73ec4c6` → rc=0），不要求改码；写入侧 `src/services/architecture-character-nudge.ts:189` 本来就写 `v<卷号>:<wip|final>`。
- `:29` 注释「宁可再提示一次」**保留不改**，别为「看起来统一」去动它；动它即越界。
- §3 白名单预期零改动，只用来判断是否越界。
- 主线头即 `a73ec4c6`；如届时已推新头，R4 仍取 `a73ec4c6`，多出的文档提交记观察项、不判 FAIL。

## 交付与判词落点

- 交件报告：`.batch/night/staging/s3-d11-nudge-dedup-report.md`（须含判据 3 两组旧值的 localStorage 前后原文与提示计数、判据 1／2 的 `volumeIndex` 与提示次数、evidence 四项＋`tasklist` 原文、单测汇总行＋`EXIT=`、`check:fast` 末行、署名句「本卡零改码，实施由 `0b5fd9a6` 提供」）。
- 判词：`.batch/night/reports/s3-d11-qa-firstcheck.md`；判完直投 `.batch\night\bridge\to-owner`。
- 合并与 push 只由主身做；本卡预期无代码可合，主身只需把卡面、本单、判词入库并报新头 sha。
