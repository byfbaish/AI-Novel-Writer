状态：现行
From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: AI writer项目组

# 首卡 reboot-hy4flash-sync 终审与关闭（2026-11-17 12:15）

## 一、关闭结论
**放行，卡关闭。** 受验版本＝提交 `b5afcea2`（父 `69cd4a41`，分支 `exp/resource-ledger`，未 push、未打 tag）。
关闭证据＝QA 首验判词 `.batch/night/reports/reboot-hy4flash-sync-qa-firstcheck.md`｜7,401B｜`3bc4d792a8a19f4b21ea397f330ad553`｜68 行｜总判 `PASS（10/10 成立、五条红线 0 触发）`。

## 二、我这层（终审）核了什么（只核 QA 未覆盖项，不复跑其判据）
1. 提交存在性与文件面：`git log --oneline -2` → `b5afcea2` / `69cd4a41`；`git show --stat` 仅 2 文件（`model-policy.test.mjs` 5/2、`model-policy.mjs` 35/5）。
2. 工作区：`git status --porcelain` 已无 ` M scripts/workbuddy/model-policy.mjs`，剩 5 项作业前既有未跟踪件。
3. 交付物三元组：v7｜10,820B｜`91bdbf8ee88cc04d91ef500c3139df27`｜83 行，`已堵住` 计数 0；v6 仍 `e70654ee…`／9,927B；报告｜11,207B｜`9c95567b…`｜175 行，末行 `<!-- DONE -->`，`已堵住` 两处（`:35`、`:170`）均为否定语境。
4. 关闭凭证三元组与 QA 判词自报逐项同值。

## 三、两项偏差的裁定
1. **v7 与报告不入库：正常，不追。** `git check-ignore -v` 实测 `.gitignore:89:/.batch/`。执行方未用 `-f`、未用 `-A`，合规。**此后任何卡不得为把 `.batch/` 塞进提交而加 `-f`。**
2. **报告 `:2` 引旧派验单（`3190c6e8…`／3,037B）而非基准（`0262c9d4…`／3,471B`）：判不补 `.v2`。** 理由：正文证据与命令一字不受影响，错的只是元数据指向；补一份只改一行的报告要连带重出首验，成本高于收益。以本件与派验单 v2 为准，报告 v1 字节不动。

## 四、边界（不得据本卡说「已修复」）
- 本卡只钉死「跑哪棵树」：派活只走 `develop` 绝对路径，`wt-1/wt-2/wt-3/wt-docfix/wt-p51/wt-p56/night-probe` 一律 `禁派活`。
- 那 7 棵在 23:00–08:00 仍会返回 `Hy4`；`wt-p56` 策略更严（`HY4_DISABLED=true`、只放 DeepSeek）但也非派活入口。
