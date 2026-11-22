# S3 · D16 外派报告评审结论

From: 项目总负责人 · AI writer项目组
评审时间：2026-11-22 11:3x（2026-11-22 11:4x 按主线 `f9125384` 重落）
被评件：`C:\tmp\s3-outbound\s3-d16-indicator-verify\report.md`（260 行 / 22,864B / sha256 `e137b12385b1807e00273e6b766e20dfceefdae1e53b6ce0938e3b7a9fb0b1fa`，mtime 11:17，末行 `<!-- DONE -->`；会话 `21356f6d`，`runState=idle`）
卡面：`.batch/night/cards/s3-d16-indicator-verify.md`（留痕版 65 行 / sha256 `2848337fc1092afb84ea6b9696be11b3edf50f95568741353f03588fc3819b15`）
性质：**零改码补验卡**，本报告只作实施要点登记，**不构成 PASS、不进 apply**

## 1. 覆盖判定（与卡面 §4 逐条对）

| 判据 | 外派能判否 | 说明 |
|---|---|---|
| 1 整机重启后仍显示实际模型 | **不可判** | 需关进程再起，属实机 GUI，外派禁令覆盖 |
| 2 构造 A≠B（三处同源对账） | **需二次计算** | 原措辞的「主进程日志」证据源在本仓不存在，见 §2 ① |
| 3 tooltip 两档文案 | 可判（文案层） | 仅覆盖字符串与分支，不等于实机同屏 |
| 4 无回归（码未出、`generation:list` 可用） | 可判（代码层） | 仅静态核对 |
| 5 实例纪律三项 | **不可判** | 需真跑实例 |

结论：覆盖 5/5 **形式齐**，实质可判 2 条、需二次计算 1 条、纯实机 2 条。按 S3 规则，外派产物只登记，判据 1／5 仍由 developer 在 `develop` 补实机。

## 2. 两处待裁与处置（已落卡面留痕，判据方向不变）

① **判据 2 证据源**：`electron/` 侧无日志模块（`grep -rln "createLogger\|logger\.\|winston\|pino" --include=*.ts electron` 零命中），原「主进程日志实际 `model:`」证据源在本仓不存在。改认同源两个持久化事实源：`binding_json` 的 `sourceManifest.modelReceipt.model` ＋ `generation:last-model` IPC 原文（`electron/controllers/generation-controller.ts:290`、契约 `src/shared/generation-owner-contract.ts:424`、消费者 `src/services/generation/actual-model-hydration.ts:21`），并要求三条同源对账。这是换证据源，不是放宽——「A≠B 必须现场构造」不变。

② **「reload 后 actual 仍非空」作废**：`currentProject=null` 时状态栏回「（配置）」，`actual` 非空不能反证模型未变。判据 2 只认 reload 前同源对账；reload 后一支若要保留，须先证明 `lastModel()` 与状态栏同时可见。

## 3. 排期与 apply

- 本卡零改码，**无 apply 可派**；实机补验由 developer 在 `develop` 执行，一次一个实例，重启按同一轮的一起停记两次 PID。
- 顺序不动：**D7 首验 PASS 后**才进 D16 实机补验；不与 D7／D10／D11 并行。
- base 与分支在派实机时按当时主线头重新钉，届时改卡面与派验单三处并报 sha。

## 4. 给 QA 的判据分母提示

判词只判：判据 3 的文案原文、判据 4 的代码层结论、判据 2 的二次计算（按新证据源复算）。判据 1／5 一律记「实机待补」，不许因外派报告写「可判」就认过。
