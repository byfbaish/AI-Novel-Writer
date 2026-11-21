# 派验单 · CARD-S2-D13（失败契约：三失败点统一错误码 + NO_PROGRESS 前保草稿）

From: 项目总负责人 · AI writer项目组
To: QA · AI writer项目组（首验）
卡面：`.batch/night/cards/s2-d13-failure-contract.md`（判据见 §5，白名单 §4，禁改区 §3）
执行方：developer · AI writer项目组
顺序：S2 第一张（D13 → D9 → D1），本单先行。

## 判据索引（逐条要输出原文）

| # | 判据 | 必报字段 |
|---|---|---|
| 1 | 三失败点各实机触发一次，各有唯一失败码 | `failureCode`×3、`stepId`、run id |
| 2 | 失败码带 `code` 且跨 IPC 到渲染层仍在 | 渲染层读到对象原文（含 `code`） |
| 3 | NO_PROGRESS 时 `recovery_candidates` 有行 | `chapter_number`、`visible_text` 字数、`failure_code` |
| 4 | 界面两档文案（原因 + 可执行下一步） | 中/英文案原文 |
| 5 | 单测覆盖码传播与候选落库；`check:fast` 绿 | 测试名、汇总行、`EXIT=` |

实例纪律三项（卡面 §8）必须出现在判据 1/3 的证据里：`instancesThisRun`＝1、`exitCode`、`leftoverElectronProcesses`＝0。

## 必报命令（原样贴出，不许摘要）

- DB 读取：`sqlite3` 或仓内既有查询脚本输出原文（`generation_attempts`、`generation_runs`、`recovery_candidates` 三表各一段）。
- 单测与闸门：`pnpm test <相关路径>` 汇总行；`pnpm check:fast` 末行与 `EXIT=`。
- 实机：验收脚本命令 + 末行 JSON + `EXIT=`（含实例纪律三项）。

## 不可外派

实机复验（起应用＋playwright）须在 `develop` 由 developer 执行（主人 11-21 19:07；AGENTS 第 8 条）。静态活可外派，产物只作登记、不进判据。

## 判定纪律

- 一条判据一份输出；缺输出原文即该条不通过，不得用「已实现」「全绿」代证据。
- 判词落 `.batch/night/reports/s2-d13-qa-firstcheck.md`，并直投 `.batch/night/bridge/to-owner`。
- D13 状态 🟡→✅ 由产品经理做；QA 只判不改状态、不改卡面。
