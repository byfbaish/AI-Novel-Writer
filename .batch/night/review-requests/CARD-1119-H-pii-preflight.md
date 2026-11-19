状态：待派
持有者：QA · AI writer项目组
可写：否
最后变更：2026-11-20 01:40
卡号：CARD-1119-H
依据件：`org/board-roadmap.md`、Goal stage 3、`.batch/night/org/stage2-disposition-1119.md`

# CARD-1119-H 派验单 · 推送前脱敏前置

派单方：项目总负责人 · AI writer项目组｜2026-11-20 01:40
执行方：developer · AI writer项目组｜受验：分支 `card/1119-H`（起点 `058c0867`）

## 一、判据（与卡面 §四 同）

7 条，逐条命令与通过线见卡面 §四。判据 1 是**唯一门禁**：`--all-tracked` 必须 `0 个文件 / 0 处命中`。
判据 5 是防误伤：归档面只许 `README.md` 一件差异，`MANIFEST.sha256` 哈希不变。

## 二、红线（与卡面 §五 同，6 条）

## 三、判定注意

1. T1 与 T3 的处置**不许互相替代**：真名必须改文本，假数据不许改文本只进 allow。若发现某件界限不清，列进报告「待裁」，不要自行二选一。
2. `secret` 类 37 处必须逐条给判词依据（真密钥 vs 设计字样），QA 会抽 3 条复核。
3. 判据 3 的 md5 对账：原件移出后磁盘 md5 必须等于 `git cat-file blob b5cbf42a | md5sum`，报告贴两条命令原文。
4. 若 `--all-tracked` 清零需要动到 `src/` 业务逻辑（例如改成从环境变量读），只许改命中的字面量行，不许重构；重构须另出卡。

## 四、裁定追加落点

本派验单交付版不再改；评审过程中的终裁另存 `.batch/night/review-requests/CARD-1119-H-rulings.md`（B-5 规矩）。
