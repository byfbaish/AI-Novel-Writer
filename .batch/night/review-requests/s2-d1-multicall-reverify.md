# 派验单 · CARD-S2-D1（同 run 多调用复验，零改码）

From: 项目总负责人 · AI writer项目组
To: QA · AI writer项目组（首验）
卡面：`.batch/night/cards/s2-d1-multicall-reverify.md`（判据 §5）
执行方：developer · AI writer项目组（**只复验，不改码**）
顺序：S2 第三张，D13、D9 交件后开。

## 判据索引（逐条要输出原文）

| # | 判据 | 必报字段 |
|---|---|---|
| 1 | 同 run 内两次调用都发生 | `generation_attempts` 两行原文：`run_id` 相同、`purpose` 不同（短细纲／正文） |
| 2 | 全程无 `GENERATION_SOURCE_CHANGED` | 该码计数为 0 的命令与输出 |
| 3 | run 有终态 | `generation_runs` 行原文（非永久 running、非无码 paused） |
| 4 | 第二次产出被采用（不是「调用了但结果丢了」） | `drafts` 行原文或界面读数 |
| 5 | 实例纪律三项 | `instancesThisRun`＝1、`exitCode`、`leftoverElectronProcesses`＝0 |

## 必报命令（原样贴出）

- 实机：验收脚本命令 + 末行 JSON + `EXIT=`。
- DB：`generation_attempts` 两行、`generation_runs` 一行、`drafts` 一行原文。
- 既有相关单测：`pnpm test <相关路径>` 汇总行（本卡无新单测）。

## 不可外派

实机复验须在 `develop` 由 developer 执行（主人 11-21 19:07；AGENTS 第 8 条）。本卡无静态活可外派。

## 判定纪律

- **零改码是硬判据**：`git diff --ignore-cr-at-eol --stat` 为空、`git diff --numstat` 为空，且无新增生产文件；有改动即打回。
- 复现出 `GENERATION_SOURCE_CHANGED` ⇒ 判不通过并附原文，**不允许当场改码**，等裁定。
- 判词落 `.batch/night/reports/s2-d1-qa-firstcheck.md`，直投 `.batch/night/bridge/to-owner`。
- D1 状态转 ✅ 由产品经理做。
