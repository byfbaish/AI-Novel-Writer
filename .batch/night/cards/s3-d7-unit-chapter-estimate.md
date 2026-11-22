# CARD-S3-D7 · 单元→章折算：预告给两个数（名义上界 + 实际倾向估计）

> **待主人批准后方可派卡**（群管理分身 2026-11-22 依主身令加）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）；QA · AI writer项目组（首验方）
版本：v1 · 2026-11-22 · 起点：`exp/mainline-1119` 头 **`5a285e83`**
顺序：**S3 第二张**（D4 → D7 → D16 → D10 → D11）

## 0. 开工件必读确认（三行，缺一行不许 start）

① 读了哪几份：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、本卡。
② 版本或日期：`README.md` `c87cd4ab`（2026-11-14）；`AGENTS.md` `a276fffb`（2026-11-07）；`ruling-dispatch` v6 · 2026-11-20。
③ 三条口径：授权边界最窄执行（本卡**只改预告显示与折算估计**，不改生成侧算法）；实机复验不外派；证据只认命令与输出原文。

## 1. 现状（读于 `5a285e83`；`:72`、正文 `:592-620`）

- 状态：**🔍 已取证**（2026-11-03）——「与对话框预告不符」**不成立**（两侧同一 `computeSynopsisUnitRange`，差异只是显示精度：对话框 `ceil` 取整、prompt 侧 1 位小数）；「偏保守」成立，**原因在模型行为**（`maxChapters` 只约束上限、不约束下限，模型按「一单元=一段对峙」写完即收）。
- 预告文案：`src/components/dialogs/ArchitectureConfirmDialog.tsx:774` — `本卷剩余 ${unitMode.volumeRemaining} 章，名义上界 ${unitMode.maxChapters} 章。篇幅由剧情决定，写完按实际章数落盘。`
- 折算实现：`src/services/workflows/synopsis-unit-launch.ts:298`、`src/services/workflows/commands/architecture.command.ts:2948`（同源）、`src/shared/arc-position.ts:960`（prompt 精度）。
- 系统已自记偏差：`partial_arch.json` → `synopsis_volume_deviations = [{ volumeIndex: 1, planned: 5, actual: 6 }]`。
- 实测倾向：四批 `2d60f259 / ce80d97d / 8e48c534 / e11a7ec4` 分别落 3 / 1 / 2 / 3 章；18 单元按「1 单元≈1 章」只能到约 18 章 < 配置 30 章。

## 2. 要做什么（补一个数，不改算法）

对话框预告改为**两数并列**，各自标明口径：

- 名义上界（现有 `maxChapters`，保持原值原算法）；
- **按当前实际倾向的估计**：由既有 `synopsis_volume_deviations`（或等价的历史实际章数/单元数比）推出本卷剩余单元的预计章数；无历史偏差时**不得瞎猜**，须显示明确兜底文案（如「暂无历史折算，无法估计」）而不是复用名义上界。
- 两数都不改 `computeSynopsisUnitRange`、不改 prompt 文案精度、不改落盘行为。

## 3. 白名单与禁改区

- 可改：`src/components/dialogs/ArchitectureConfirmDialog.tsx`、把偏差数据送到该对话框的既有读取路径（只读投影，不新增表/列/IPC 通道时优先）、其单测与相关 browser 断言。
- 禁改：`computeSynopsisUnitRange`、`arc-position.ts:960` 的 prompt 精度、`architecture.command.ts` 的批次上界推导、`synopsis_volume_deviations` 的写入逻辑、D6 相关常量、D12 注入区。
- 不许把「实际倾向」做成第二个上限去拦生成。

## 4. 判据（QA 首验逐条，逐条要输出原文）

1. 实机（或对话框可复现路径）：同屏出现两个数，各自的标签原文清楚区分「名义上界」「按当前实际倾向估计」。
2. 有历史偏差时，估计值的算法可复算：贴出 `synopsis_volume_deviations` 读数与算式的对应关系（给一条数值演算）。
3. 无历史偏差时，显示兜底文案原文，且**不**出现与名义上界相同的伪估计。
4. 名义上界与改动前的数值逐位一致（贴改前改后两值）。
5. 单测：有偏差/无偏差两支；`pnpm test <相关路径>` 整文件汇总行 + `pnpm check:fast` 末行 + `EXIT=`。

## 5. 外派位

- **静态活可外派**：读码核对「偏差数据现有读取路径」「对话框数据来源」、给数值演算样例；产物只登记。
- **不可外派：实机复验须在 `develop` 由 developer 执行。**

## 6. 回执与交付

- 分支：`card/s3-d7-unit-chapter-estimate`，从 `5a285e83` 起；点名路径 `git add`（禁 `-A`）。
- 交件：报告 `.batch/night/staging/s3-d7-unit-chapter-estimate-report.md`；群里交件 @ 项目总负责人 与 QA；回执走 `.batch/night/bridge/to-owner`。

## 7. 实例纪律

单实例复用、跑完必关；evidence 含 `instancesThisRun`、`exitCode`、`leftoverElectronProcesses`（须 0）。

## 8. R4 判据（作用域写死）

判据二段，缺一不可：

1) `git diff --numstat 5a285e83..card/s3-d7-unit-chapter-estimate -- src electron scripts` 输出为空（无改动、无新增）。
2) **无新增生产文件**：分支上未新增 `src/`、`electron/`、`scripts/` 下的文件；若本卡白名单允许新增（仅验收/取证脚本），须逐条列出路径并在判词中标注「白名单内新增」。

不采信不带 `<base>..<branch>` 作用域的 `git diff --stat`（全树常有他人在办的流转件，D1 那次全树假红即此）。
