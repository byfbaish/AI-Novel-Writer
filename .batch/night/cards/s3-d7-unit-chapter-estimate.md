# CARD-S3-D7 · 单元→章折算：预告给两个数（名义上界 + 实际倾向估计）

> **待主人批准后方可派卡**（群管理分身 2026-11-22 依主身令加）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（apply 方）；QA · AI writer项目组（首验方）
实施方（外派）：WorkBuddy · AI writer项目组（静态可判部分：读码、改法提案、单测草案、数值演算；不 commit／不 push／不动 develop）
版本：v3 · 2026-11-22 11:5x（v2→v3：§2 算式改 A′、判据 1 范围留痕） · 起点：**`a2a9d1d5`（D4 合并提交；其后 `f9125384` 仅文档留痕，不影响判据作用域）**（派单件与派验单同步填这个值，三处必须同值）
顺序：**S3 第二张**（D4 → D7 → D16 → D10 → D11）

## 0. 开工件必读确认（三行，缺一行不许 start）

① 读了哪几份：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、`docs/agents/worktree-parallel.md`、`docs/agents/workbuddy-channel.md`、本卡。
② 版本或日期：`README.md` `c87cd4ab`（2026-11-14）；`AGENTS.md` `a276fffb`（2026-11-07）；`ruling-dispatch` v6 · 2026-11-20；本卡 v2 · 2026-11-22。
③ 三条口径：授权边界最窄执行（本卡**只改预告显示与折算估计**，不改生成侧算法）；实机复验不外派；证据只认命令与输出原文。

## 1. 现状（行号 2026-11-22 11:2x 勘误；`b4e8da53` 与 `5a285e83` 四份目标文件 blob 同值、行号差 0）

- 状态：**🔍 已取证**（2026-11-03）——「与对话框预告不符」**不成立**（两侧同一 `computeSynopsisUnitRange`，差异只是显示精度：对话框 `ceil` 取整、prompt 侧 1 位小数）；「偏保守」成立，**原因在模型行为**（`maxChapters` 只约束上限、不约束下限，模型按「一单元=一段对峙」写完即收）。
- 预告文案：`src/components/dialogs/ArchitectureConfirmDialog.tsx:790`（原卡 `:774` 为误）— `本卷剩余 ${unitMode.volumeRemaining} 章，名义上界 ${unitMode.maxChapters} 章。篇幅由剧情决定，写完按实际章数落盘。`
- 折算实现：`src/services/workflows/synopsis-unit-launch.ts:299`（`computeSynopsisUnitRange` 调用点，原卡 `:298` 为误）；`src/services/workflows/commands/architecture.command.ts:316`（函数定义）与 `:3420`（调用点；原卡 `:2948` 不是折算点）；`src/shared/arc-position.ts:960`（prompt 精度，禁改）。
- 系统已自记偏差：`partial_arch.json` → `synopsis_volume_deviations = [{ volumeIndex: 1, planned: 5, actual: 6 }]`。
- 实测倾向：四批 `2d60f259 / ce80d97d / 8e48c534 / e11a7ec4` 分别落 3 / 1 / 2 / 3 章；18 单元按「1 单元≈1 章」只能到约 18 章 < 配置 30 章。

## 2. 要做什么（补一个数，不改算法）

对话框预告改为**两数并列**，各自标明口径：

- 名义上界（现有 `maxChapters`，保持原值原算法）；
- **按当前实际倾向的估计**：由既有 `synopsis_volume_deviations`（或等价的历史实际章数/单元数比）推出本卷剩余单元的预计章数；无历史偏差时**不得瞎猜**，须显示明确兜底文案（如「暂无历史折算，无法估计」）而不是复用名义上界。
- **估计算式（负责人 11-22 11:3x 定稿，唯一口径 A′）**：`估计 ＝ max(1, floor(已写章数 ÷ 已完成单元数 × 本卷剩余单元数))`。修订两点（原 A 式作废，理由见下）：①**删「＋ 已写章数」**——本工程「已写章数」只有 `synopsis_covered_to` 一个来源，是**全书**已写，再加一次就把全书已写累加进「本卷剩余」，维度不对（实测 `covered=20 done=1 remain=1` 会得 40，名义上界才 10）；②取整固定 **floor＋下限 1**（`remain>0` 时估计不得为 0；与「取整同现有预告风格」不冲突，预告的 ceil 只管名义上界）。
- 兜底与边界：`已完成单元数 = 0` 或读不到历史 ⇒ 走兜底文案，不套公式；`本卷剩余单元数 = 0` ⇒ 估计与剩余同值，不另算。
- 历史取自 `synopsis_volume_deviations` 或等价的既有实际章数/单元数读数；不新增表／列／IPC。
- **作废口径**：`Σactual / Σplanned × 名义上界`（即 k 倍名义上界的等比缩放）**作废**——k≥1 时估计恒 ≥ 名义上界，撞本卡 §3「不许把估计做成第二个上限」，结构性做不出「偏少」。该式只可作报告内交叉读数，不进界面、不作判据。
- 两数都不改 `computeSynopsisUnitRange`、不改 prompt 文案精度、不改落盘行为。

## 3. 白名单与禁改区

- 可改：`src/components/dialogs/ArchitectureConfirmDialog.tsx`、把偏差数据送到该对话框的既有读取路径（只读投影，不新增表/列/IPC 通道时优先）、其单测与相关 browser 断言。
- 禁改：`computeSynopsisUnitRange`、`arc-position.ts:960` 的 prompt 精度、`architecture.command.ts` 的批次上界推导、`synopsis_volume_deviations` 的写入逻辑、D6 相关常量、D12 注入区。
- 不许把「实际倾向」做成第二个上限去拦生成。

## 4. 判据（QA 首验逐条，逐条要输出原文）

1. 实机（或对话框可复现路径）：同屏出现两个数，各自的标签原文清楚区分「名义上界」「按当前实际倾向估计」。
   > **判定范围留痕（2026-11-22 11:3x，负责人裁定）**：判据 1 **只适用于有历史偏差的分支**（该支必须两数同屏）。无历史偏差分支天然只出一个数，**按判据 3 判**（兜底文案原文 ＋ 估计值与名义上界不得相同）。这是范围界定，不是放宽：两支各自的界面证据都要贴原文，缺一支即 FAIL。
2. 有历史偏差时，估计值的算法可复算：贴出 `synopsis_volume_deviations` 读数与算式的对应关系（给一条数值演算，须能按 §2 口径 A 手算复现）。
3. **收紧（主身 11-22 定）**：无历史偏差时显示兜底文案原文；且「估计值」与「名义上界」**两数完全相同即 FAIL**，不接受把同一个数换个标签再显示一遍。
4. 名义上界与改动前的数值逐位一致（贴改前改后两值）。
5. 单测：有偏差/无偏差两支；`pnpm test <相关路径>` 整文件汇总行 + `pnpm check:fast` 末行 + `EXIT=`（本条在 `develop` 由 developer 跑，外派不判）。

## 5. 外派位

- **静态活可外派（派给 WorkBuddy）**：读码核对「偏差数据现有读取路径」「对话框数据来源」、给改动点（文件:行）、给数值演算样例、给单测草案；产物只登记，不进判据。
- **不可外派**：实机复验与判据 5 单测须在 `develop` 由 developer 执行（主人 11-21 19:07；AGENTS 第 8 条）。
- 外派产物回流：只回交证据件（登记用），不 commit／不 push／不动 develop。

## 6. 回执与交付

- 分支：`card/s3-d7-unit-chapter-estimate`，从 §7 起点起；点名路径 `git add`（禁 `-A`）。
- 交件：报告 `.batch/night/staging/s3-d7-unit-chapter-estimate-report.md`；群里交件 @ 项目总负责人 与 QA；回执走 `.batch/night/bridge/to-owner`。

## 7. 实例纪律

单实例复用、跑完必关；evidence 含 `instancesThisRun`、`exitCode`、`leftoverElectronProcesses`（须 0）。

## 8. R4 判据（作用域写死；本卡为改码卡，按 D4 修订口径）

判据二段，缺一不可：

1) `git diff --name-only <base>..card/s3-d7-unit-chapter-estimate -- src electron scripts` 每一行都落在本卡 §3 白名单内（本卡要改 `ArchitectureConfirmDialog.tsx` 及其单测，不要求输出为空）。
2) **无新增生产文件**：`git diff --name-status <base>..card/s3-d7-unit-chapter-estimate -- src electron scripts` 不得出现 `A` 行（白名单内取证脚本除外，须逐条列出路径并在判词中标注「白名单内新增」）。

不采信不带 `<base>..<branch>` 作用域的 `git diff --stat`（全树常有他人在办的流转件，D1 那次全树假红即此）。

收口留痕（项目总负责人 11-22 12:1x）：分支 `card/s3-d7-unit-chapter-estimate` 头 `df627032`，按主身定不推远端留档，内容已在主线 `544dcbd5` 内；本条只作记录，不改任何判据。
