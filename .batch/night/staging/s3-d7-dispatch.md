# 派单件 · CARD-S3-D7（单元→章折算：预告两个数）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（apply 方）；QA · AI writer项目组（首验方）
实施方（外派）：WorkBuddy · AI writer项目组（静态可判部分）
派单时间：2026-11-22 11:4x
卡面：`.batch/night/cards/s3-d7-unit-chapter-estimate.md`（v2）
派验单：`.batch/night/review-requests/s3-d7-unit-chapter-estimate.md`

## 1. 起点与分支

- base（三处同值）：**`a2a9d1d5`（D4 合并提交；其后 `f9125384` 仅文档留痕，不影响判据作用域）** —— D4 合并 `136c999c` 入主线、主身 push 后由负责人填，卡面 §7／§8、本件、派验单同步替换。
- 分支：`card/s3-d7-unit-chapter-estimate`，起点＝同一 sha；一卡一分支，点名路径 `git add`（禁 `-A`／`-f`／`--no-verify`）。
- **apply 顺序**：本卡是 S3 第二张，**等 D4 已入库且远端头更新、且 D7 实施要点备齐后再建分支**；不许与 D16/D10/D11 并行改码。

## 2. 开工前必做三步

1. 读卡面 §0 三行必读确认并照抄进交件报告；
2. `git rev-parse --short HEAD`、`git merge-base --is-ancestor <base> HEAD`、`git status --porcelain -- src electron scripts`（须空）三项校验；
3. 报「已领卡 + 实测 HEAD + base 校验结果」再动手。

## 3. 要做的事（三步，顺序固定）

1. **WorkBuddy 出实施包**（外派，静态）：偏差数据现有读取路径（文件:行）、对话框数据来源、改动点清单、按卡面 §2 口径 A 的数值演算样例、单测草案。产物只登记，不进判据。
2. **developer apply**：把实施包落成分支提交（改码不超卡面 §3 白名单），跑判据 5（整文件汇总行 + `EXIT=`）与判据 6 的 `check:fast`。
3. **developer 实机取判据 1／2／3／4 证据**：两数同屏原文、偏差演算、无历史兜底文案、名义上界改前改后两值；单实例纪律三项齐。

## 4. 判据（逐条见派验单；此处只写不可让的部分）

- 判据 3 **已收紧**（主身 11-22 定）：估计值与名义上界**两数完全相同即 FAIL**，不接受同一个数换标签。
- 判据 5 单测**在 `develop` 由 developer 跑**，只认整文件汇总行 + 末行 `EXIT=`（`-t` 过滤无效）。
- 判据 1／2／3／4 的界面证据由 developer 实机取；外派替不了。
- **禁改判据**：执行方与首验方都不许改判据文字或分母；口径不一致先报负责人改卡面留痕，判据不让给提案。

## 5. 外派位（四样齐）

- 外派对象：WorkBuddy · AI writer项目组（静态活）。
- 需求说明：卡面 §1 现状 + §2 要做什么 + §3 白名单。
- 验收标准：产物含①偏差数据读取路径 文件:行 ②改动点 文件:行 + 改法 ③按口径 A 的数值演算 ④单测草案；**能判否要逐条标**，判不了的写「apply 后由 develop 补证」。
- 回执地址：`.batch/night/bridge/to-owner`（落盘后由联络人转投）。
- 不许做的事：不 commit／不 push／不动 develop 主区；不跑全量测试／`test:browser`／实机 GUI；不改判据、不改卡面。

## 6. 交付与回执

- 交件报告：`.batch/night/staging/s3-d7-unit-chapter-estimate-report.md`（命令与输出原文）。
- 群里交件 @ 项目总负责人 与 QA；QA 判词落 `.batch/night/reports/s3-d7-qa-firstcheck.md` 并直投 `.batch/night/bridge/to-owner`。
- 合并与 push 只由主身做；执行方只报分支 ref 与旧头。

## 7. 停手条件

- 拿不到 `synopsis_volume_deviations` 或等价历史读数 ⇒ 停手报，不许自造数据。
- 要新增表／列／IPC 才能把偏差送到对话框 ⇒ 先报，负责人定是否放行白名单。
- 实机或对话框路径不可复现 ⇒ 贴原文停手，不许改判据绕过。
