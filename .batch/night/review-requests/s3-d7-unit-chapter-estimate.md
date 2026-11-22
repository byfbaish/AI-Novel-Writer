# 派验单 · CARD-S3-D7（单元→章折算：预告两个数）

From: 项目总负责人 · AI writer项目组
To: QA · AI writer项目组（首验方）
实施方（外派）：WorkBuddy · AI writer项目组（静态可判部分，只登记不进判据）
apply 方：developer · AI writer项目组
派单件：`.batch/night/staging/s3-d7-dispatch.md`
卡面：`.batch/night/cards/s3-d7-unit-chapter-estimate.md`（v2）
起点/base：**`a2a9d1d5`（D4 合并提交；其后 `f9125384` 仅文档留痕，不影响判据作用域）**；分支：`card/s3-d7-unit-chapter-estimate`
放行依据：S3 顺序 D4 → D7 → D16 → D10 → D11（主人放行）
外派位：静态活可外派（只登记）；**不可外派：实机复验与判据 5 单测须在 `develop` 由 developer 执行**（主人 11-21 19:07；AGENTS 第 8 条）

## 判据（逐条要输出原文；缺一条即 FAIL）

1. 界面证据：同屏出现两个数，标签原文分别写明「名义上界」「按当前实际倾向估计」；只出一个数，或把两数合并成「约 N–M 章」判 FAIL。
   > 判定范围留痕（11-22 11:3x，负责人裁定）：判据 1 只适用**有历史偏差**的分支；无偏差分支天然只出一个数，按判据 3 判（兜底文案＋两数不得相同），非放宽，两支证据都要贴原文。
2. 数值可复算：贴 `synopsis_volume_deviations` 原文读数 + 按卡面 §2 口径 **A′**（`估计 ＝ max(1, floor(已写章数 ÷ 已完成单元数 × 本卷剩余单元数))`，**不加回已写章数**；`已完成单元数=0` 走兜底）的一条手算演算，与界面估计值逐位一致。
3. 无历史偏差支：兜底文案原文（如「暂无历史折算，无法估计」）；**估计值与名义上界两数完全相同即 FAIL**（主身 11-22 收紧），不许同一个数换标签。
4. 名义上界未变：贴改动前与改动后两个值，逐位一致。
5. 单测（在 `develop` 由 developer 跑）：有偏差/无偏差两支；`pnpm test <相关路径>` **整文件汇总行** + 末行 `EXIT=`（`-t` 过滤结果无效），`pnpm check:fast` 末行 + `EXIT=`。
6. 改动面：`git diff --name-only <base>..card/s3-d7-unit-chapter-estimate -- src electron scripts` 每行都在卡面 §3 白名单内；`git diff --name-status` 无 `A` 行（白名单内取证脚本须逐条列出并标注）。
7. 实例纪律：`instancesThisRun=1`、`leftoverElectronProcesses=0`、`exitCode` 原文；若 `exitCode≠0` 须注明是否为取证脚本自身超时。

## 判定纪律

- 只判本单列出的判据，不追加卡面外要求；判据分母＝卡面 + 本派验单，两者的判据文字不许由执行方或首验方改动。
- 外派产物（WorkBuddy 实施包）只是证据，不构成 PASS；判不了的部分写明「apply 后由 develop 补证」，不许默认通过。
- 判定面是分支提交 sha，不是工作区；工作区取证须同时贴 `git status --porcelain -- src electron scripts` 证明等于该 sha。
- 判词落 `.batch/night/reports/s3-d7-qa-firstcheck.md`，直投 `.batch/night/bridge/to-owner`；群里报最终 sha 与结论。
