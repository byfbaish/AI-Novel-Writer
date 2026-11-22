# CARD-S3-D11 · 「补角色卡」提示去重：整卷完成才提示一次（取法裁定）

> **待主人批准后方可派卡**（群管理分身 2026-11-22 依主身令加）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）；QA · AI writer项目组（首验方）
版本：v2 · 2026-11-22 · 起点：`exp/mainline-1119` 头 **`a73ec4c6`**（13:5x D10 入库合并提交）
顺序：**S3 第五张**（D4 → D7 → D16 → D10 → D11）

## 0. 开工件必读确认（三行，缺一行不许 start）

① 读了哪几份：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、本卡。
② 版本或日期：`README.md` `c87cd4ab`（2026-11-14）；`AGENTS.md` `a276fffb`（2026-11-07）；`ruling-dispatch` v6 · 2026-11-20。
③ 三条口径：授权边界最窄执行；实机复验不外派；证据只认命令与输出原文。

## 1. 现状（11-22 13:58 以 `a73ec4c6` 复读；指纹 `:134-137`、判定 `:139-150`、文案 `:35-41`/`:44`）

- 状态：**✅ 已并入 `0b5fd9a6`，本卡转验收**（判据 1／2／4／5／6 只跑 live 与单测复核，不再要求改码；判据 3 按主身 11-22 裁定「保留一次重提示」，不做「视为已处理」迁移）。依据：`0b5fd9a6`（「合并 wt-2 的 D4/D10/D11 三条已兑现改动」）是 `a73ec4c6` 的祖先（`git merge-base --is-ancestor 0b5fd9a6 a73ec4c6` → rc=0），本卡编写时读的 `5a285e83` 上还是旧形态，故 §1 旧表述「已实施待实机／取法待裁定」已过期。
- 提示文案：`src/services/architecture-character-nudge.ts:35-41`（`toast.zh`／`banner.zh`）＋`:44`（`action`）。
- 去重指纹（**已落实现**）：`:134-137` `outlineNudgeDraftVersion()` 返回 `v<volumeIndex>:wip|final` —— 卷级、只在「该卷大纲定稿」时变，不再随章级覆盖数与正文长度逐批变；判定 `:139-150` `input.dismissedVersion !== outlineNudgeDraftVersion(input.volume)`。
- 存量兼容口径（**11-22 主身裁**）：`LEGACY_DISMISSED_VALUE = 'dismissed'`（`:29`；`:174` 读到它按「未处理」返回），旧 `c<ch>:l<len>` 也不迁移 —— 读到旧格式一律按「未处理」返回、允许该项目**一次**重提示，理由：旧值里没有卷号（`dismissed` 是一次点掉、`c<ch>:l<len>` 是章级覆盖数），任何「视为已处理」的映射都等于把提醒永久关掉，那不是修 D11。`:29` 注释「宁可再提示一次」保留不改。§2 第 4 条原「视为已处理过旧形态并保留」表述已由 §4 判据 3 取代。
- 另：2026-11-09 22:0x 作者裁定「W2 现象来源按现状已达标结项」，指**注入点**问题（不存在按批追加角色集合进正文 prompt 的注入点），与本卡的**提示去重**不是同一件事，本卡只改提示。

## 2. 我的裁定（取法，写死在卡里，执行方不再自选）

> **11-22 追认（负责人，读于 `a73ec4c6`）**：本节第 1–3 条的取法**已由 `0b5fd9a6` 落进主线**（直读 `synopsisIncomplete`、卷级指纹），不再由执行方自选，改作**既有实现的验收口径**保留；存量兼容口径已定（见第 4 条），现行代码即符合，本卡不要求改码。

- **定稿态取法**：以检查点 `synopsis_incomplete === false`（`partial_arch.json`）作为「整卷大纲完成」的唯一判据，**直读检查点**；不得再用 `chain.status` 投影（投影会把「链状态」当「大纲完成」，语义不等价）。
- 实现路径（apply 前须写明所选与文件:行）：①渲染层经既有读检查点 IPC 直读；②由主进程把该布尔投影进既有 snapshot 字段（不新增表/列/IPC）。两条都不可行则停手报，禁退回 `chain.status`。
- **去重粒度**：改为**卷级**——指纹含卷序号（形如 `v<volumeIndex>`）且仅在「该卷 `synopsis_incomplete === false`」时才提示；同一卷无论写多少批，只提示 1 次；进入下一卷且满足条件，再提示 1 次。
- 已 dismiss 记录的兼容（**11-22 主身裁后取代本条原表述**）：不做迁移、不改码 —— 旧格式值（`dismissed` 或 `c<ch>:l<len>`）按「未处理」返回、允许一次重提示；用户再次关闭必须写新格式 `v<卷号>:<wip|final>`。口径原文见 §4 判据 3。

## 3. 白名单与禁改区

- 可改：`src/services/architecture-character-nudge.ts`（指纹与判定）、其单测、读取检查点的只读投影（若需新增读取，优先复用既有读取路径）。**预期零改动**，本节仅供判断是否越界。
- 禁改：提示文案（`:43-47`）、把缺失角色集合注入正文 prompt 的任何路径（作者已裁不注入）、`synopsis_incomplete` 的写入逻辑、D6 常量、D12 注入区。
- 不许把提示改成阻塞或弹窗打断。

## 4. 判据（QA 首验逐条，逐条要输出原文）

> 分层：1–3 `[live]`、4 `[mock]`、5 `[static]`、6 `[live]`。
> `[live]` 取证按 `collab-rules-v1.md` §8 第 62 行：确定性取样、连续两次读数相同且间隔 ≥ 自设最小间隔，`sampleCount ≥ 2` 与取样时刻写进 evidence；对照读数（手动刷新／重开界面后的计数）只作旁证，不得顶替判定键。
> 判据 6 的实例纪律三项须贴原文，其中 `tasklist | grep -c electron` 的输出必须写进 evidence。

1. `[live]` 同一卷连写 3 批（检查点仍 `incomplete=true` 时）⇒ 提示 0 次；最后一次使 `synopsis_incomplete=false` ⇒ 提示 1 次。
   - 等价触发（admin 11-22 15:14 裁）：允许以「UI 保存正文（三批）＋库翻转 `synopsis_incomplete` 检查点状态」代替全链路连写；三批正文变化必须走真实编辑器保存路径，不许直接写库。evidence 须记 `triggerMode`：正文改动标 `ui-save`、卷与检查点标 `db-flip`，判词同样写明「库造，非链路」。
   - **wip 态不可观测（admin 11-22 15:3x 裁，走 ①）**：合成模型下「`incomplete=true` 时 0 次」与「翻 `final` 后 1 次」经 UI 不可达——`src/services/workflows/synopsis-unit-launch.ts:297` 在 `coveredTo === 0 && outlineCoveredTo >= 1` 时返回 `skip('checkpoint-lost')`（预填后连写入口直接不出现），而先起链则在首单元即停（toast「连续生成已停止（1/3）：这一批失败了，已停止连写」），wip 窗口不足 1 秒；叠加横幅渲染门 `src/components/editor/ArchFileViewer.tsx:1149` 要求 `!recovery` 与判定门 `architecture-character-nudge.ts:149` 要求正文 ≥50 字，合成模型下 wip 态无经 UI 的可达路径。故这两半段降 `[mock]`，依据 `architecture-character-nudge.test.ts:94`（连写 3 批、正文递增）与 `:64-65`（`v1:wip`／`v1:final`）；**`[live]` 的判据 1 改由「有/无 dismiss 记录的 0 次 vs 1 次对照」承担**：无 dismiss 记录时保存正文应提示 1 次，关闭（写入 `v…`）后连跑三批应 0 次。判词须写「wip 不可观测，库造，非链路」。
2. `[live]` 进入下一卷并完成 ⇒ 再提示 1 次（贴两卷的 `volumeIndex` 与提示次数）。
   - 等价触发同上：两卷的 `volumeIndex` 可库造（`wip`→`final`），正文变化仍须走界面保存路径；evidence 记 `triggerMode`，判词写明「库造，非链路」。
3. `[live]` 判据 3「存量兼容」：读到旧格式值（`dismissed` 或 `c<ch>:l<len>`）时按「未处理」返回，允许该项目**一次**重提示；用户再次关闭必须写入新格式 `v<卷号>:<wip|final>`，此后同一卷不再提示，该卷大纲定稿态变化（`wip`→`final`）才可再提示一次。判 FAIL 线：①同一卷同一状态下第二次提示；②再次关闭后仍写旧格式；③为兼容旧值而删改调用点或扩到其他文件。
4. `[mock]` 单测：①同卷多批不重复；②跨卷各一次；③存量形态兼容。
5. `[static]` `pnpm test <相关路径>` 整文件汇总行 + `pnpm check:fast` 末行 + `EXIT=`。
6. `[live]` 实例纪律三项（实机若走界面）：`instancesThisRun`、`exitCode`、`leftoverElectronProcesses`。

## 5. 外派位

- **静态活可外派**：读码核对「检查点字段读取路径」「存量 dismiss 记录形态」；产物只登记。
- **不可外派：实机复验须在 `develop` 由 developer 执行**。

## 6. 回执与交付

- 分支：`card/s3-d11-nudge-dedup`，从 `a73ec4c6` 起。**预期无提交**；判定取 `git diff --numstat a73ec4c6..HEAD -- src electron scripts` 输出为空。
- 交件：报告 `.batch/night/staging/s3-d11-nudge-dedup-report.md`；群里交件 @ 项目总负责人 与 QA；回执走 `.batch/night/bridge/to-owner`。

## 7. 实例纪律

单实例复用、跑完必关；evidence 含 `instancesThisRun`、`exitCode`、`leftoverElectronProcesses`。

## 8. R4 判据（作用域写死）

判据二段，缺一不可：

1) `git diff --numstat a73ec4c6..HEAD -- src electron scripts` 输出为空（无改动、无新增）。
2) **无新增生产文件**：分支上未新增 `src/`、`electron/`、`scripts/` 下的文件；若本卡白名单允许新增（仅验收/取证脚本），须逐条列出路径并在判词中标注「白名单内新增」。

不采信不带 `<base>..<branch>` 作用域的 `git diff --stat`（全树常有他人在办的流转件，D1 那次全树假红即此）。

## 9. 修订留痕（负责人 · 11-22 13:58 起，§8 写法不动；§4 只有判据 3 按主身裁定换成原文）

1. **起点改钉 `a73ec4c6`**：页首版本行、§6「分支为…」、§8 判据 1) 的 `5a285e83` 一律按本条替换。
2. **§1 复读注**：§1 标题行末写「（11-22 13:58 以 `a73ec4c6` 复读）」，并如实记「卷级指纹已由 `0b5fd9a6` 落进主线」——按旧表述开发会重做已兑现的部分。（「存量 `c…:l…` 兼容未做」是本条 13:58 时的写法，已由第 5 条取代：裁定不改码。）
3. **§4 分层与取证口径**：1–3 `[live]`、4 `[mock]`、5 `[static]`、6 `[live]`；`[live]` 条按 `collab-rules-v1.md` §8 第 62 行取样口径，判据 6 的 `tasklist | grep -c electron` 原文进 evidence。
4. **双 sha（11-22 主身裁后补）**：追认实现 `0b5fd9a6`（`git merge-base --is-ancestor 0b5fd9a6 a73ec4c6` → rc=0；指纹 `:134-136`、判定 `:139-150` 已在主线），base `a73ec4c6`。只写 base 会让人以为本卡分支还没被合并过。
5. **判据 3 定稿（11-22 主身裁）**：走「保留一次重提示」支，不改码去「视为已处理」；§4 判据 3 已换为裁定原文，§2 第 4 条原表述随之取代；白名单不变，仍限 `src/services/architecture-character-nudge.ts` 及其单测。注释 `:29`「宁可再提示一次」保留不改。

6. **判据 1／2 等价触发（admin 11-22 15:14 裁）**：允许「UI 保存正文＋库翻转检查点状态」代替全链路连写。依据：`architecture-character-nudge.ts:134-136` 指纹只含 `volumeIndex` 与 `synopsis_incomplete`，正文长度不进指纹；章级 churn 已由单测 `architecture-character-nudge.test.ts:94` 在 mock 层盖住，真链只是重演同一判定。约束：正文改动必须走界面保存、卷与检查点可库造且在 evidence／判词中标 `db-flip`；判据 3／4／5 读数不受影响，不重跑。

7. **判据 1／2 的 wip 降级与 live 对照（admin 11-22 15:3x 裁 ①）**：wip 窗口在合成模型下不可经 UI 观测（`synopsis-unit-launch.ts:297`＋首单元即停＋`ArchFileViewer.tsx:1149`／`:149` 两道门），「`incomplete=true` 时 0 次」与「翻 `final` 后 1 次」降 `[mock]`；`[live]` 由「有／无 dismiss 记录的 0 次 vs 1 次对照」承担；判据 2 的 live 部分不降——两卷都造 `final`、正文走界面保存、经 `:170-177` 真实读取链＋真 toast，取「卷 1 一次／卷 2 一次」与两卷 `volumeIndex`，只有「wip→final 各一次」半段降 `[mock]`。判据 3／4／5 不动。
8. **D11b 收口后补注（11-22 19:1x，主身）**：本卡判据 1 的 wip 分支当时按「不可观测」降 `[mock]`，其真实 live 覆盖由 D11b 判据 1 承担（`b9bdcba3` 并入主线 `a7012c51`）；判词末「收口备注」即此句，不改本卡任何判据结论。
