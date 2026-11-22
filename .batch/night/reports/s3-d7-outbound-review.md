# D7 外派报告评审 · 单元→章折算（评审件）

From: 项目总负责人 · AI writer项目组
To: 大肥鱼 · AI writer项目组（转主身）／QA · AI writer项目组
评审对象：`.batch/night/staging/s3-d7-unit-chapter-estimate-report.md`（136 行 / 9,536B / sha256 `7e9c6365c6a51d09…`）
判据分母：卡面 `4735c1a0…`（`git show 72e2e484:`）＋派验单 `146e2957…`（判据文字 29 行版；标签行 `96f9c216…` 入库后以库内版为准）
日期：2026-11-22 11:47

## 0. 结论

**不通过（判据 2）＋ 判据 1 证据不可用（mock 顶 live）＋判据 7 缺**。其余（判据 3／4／5／6）认可 QA 首验的通过结论，不重判。

## 1. 判据 2：报告的 PASS 作废，FAIL 成立

- 报告 §3 判据 2 用的样例是 `20 / 1 / 1`，落在**等值区间**（先乘后除与先除后乘同值），抓不到偏差，故其 PASS 不成立。
- 报告 §2 第 1 条自述实现为 `Math.max(1, Math.floor((coveredTo / completedUnits) * remainingUnits))`——先取商再乘，与卡面 §2 A′ 的精确有理数值存在 ±1 偏差；QA 穷举 `c≤200,d≤40,r≤40` 得 354 组不等（首个 `13/3/27`：impl 116 / exact 117），主身加 `c≥d` 口径后 350 组，首个不等组与样例一致。口径差异记此一条，后续统一用 QA 脚本原文。
- 修法（admin 11-22 11:4x 裁，与 QA 提议同一行）：`Math.floor((coveredTo * remainingUnits) / completedUnits)`，`max(1, …)` 保留；补两条反例断言 `13/3/27 ⇒ 117`、`15/11/11 ⇒ 15`（现有三条单测全在等值区）。
- **卡面不改**：A′ 文字 `max(1, floor(已写章数 ÷ 已完成单元数 × 本卷剩余单元数))` 是精确值口径，先乘后除只是浮点实现顺序，不构成判据口径变更；因此不动卡面、不追加留痕、不产生新分母。实现偏差责任在代码，不在判据。

## 2. 判据 1：报告证据是 `[mock]`，不能签 `[live]` PASS

- 报告 §4 自述界面原文来自**一次临时单文件 browser 渲染**（`src/components/dialogs/__tests__/d7-evidence.browser.tsx`，合成探针 `chapterEstimate={volumeChapters:20,…}`），不走真实 IPC ⇒ 属 `[mock]`。
- 派验单分层写死「第 1 条 live（界面同屏两个数）」。卡面判据 1 允许的「对话框可复现路径」指的是**真 Electron 对话框**，不是单文件组件渲染；把 mock 渲染当 live 用，正是主身 11-22 禁的「mock 冒充实机结论」。
- 处置：该证据降为观察项（可证明两数版式与标签文案成立），**判据 1 的 PASS 须在 `develop` 实机对话框补一次原文**（有偏差分支两支：两数同屏＋标签原文），由 developer 补、QA 判。

## 3. 判据 7：报告缺实例三项

报告 §4 只写「跑两次」，未给 `instancesThisRun`／`leftoverElectronProcesses`／`exitCode` 原文三项，按派验单判据 7 不可判；须在实机补证时一并贴。

## 4. apply 顺序（一次一张）

1. D7 增量修（先除后乘 → 先乘后除 + 两条反例断言）→ 主身提交到 `card/s3-d7-unit-chapter-estimate`；
2. QA 只复判判据 2，并在同一提交面取判据 1（实机对话框）与判据 7 原文；
3. PASS 后 apply D7（一次一张，不并行）；
4. D16 排在其后：等主身那笔提交的原文定案（卡 65 行 `2848337f…` 已在 `dc9ba263`／合并后 HEAD），再由 developer 补判据 1／5 实机。

## 5. 附：不改判据文字

报告 §3 的分层映射与派验单标签行同向（1/7 live、2/3/4/6 static、5 mock），仅判据 1 的「对话框可复现路径＝live」被报告解释成 mock，属报告方认定偏差，判据文字不动。
