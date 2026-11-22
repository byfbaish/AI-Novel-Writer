# 派验单 · CARD-S3-D16（模型指示器补验：整机重启 / 配置A·实际B）

From: 项目总负责人 · AI writer项目组
To: QA · AI writer项目组（首验方）
执行方（实机）：developer · AI writer项目组（在 `develop` 起实例）
外派位：静态活可外派（只登记、不进判据）；**不可外派：实机复验须在 `develop` 由 developer 执行**（卡面 §5）
分母：卡面 `.batch/night/cards/s3-d16-indicator-verify.md` 65 行 / 5,802B / sha256 `2848337f…`；评审件 `.batch/night/reports/s3-d16-outbound-review.md` 35 行 / 3,133B / sha256 `2757ac8a2e53017085b15ec19cdb9df912f7c931969b1f2f3330c2bffe64fbad`
起点/base：卡面 `b4e8da53`；分支 `card/s3-d16-indicator-verify`（零改码，分支上零提交）
排期：**D7 PASS 之后**才开跑；不与 D10／D11 并行；一次一个实例
放行依据：S3 顺序 D4 → D7 → D16 → D10 → D11；主身 11-22 11:5x 定「负责人只出本单」

## 判据（逐条要输出原文；缺一条即 FAIL）

**本卡判据分层（11-22 主身口径，只加标签、判据文字不动）：第 1 条 live（真实 Electron＋整机重启后的状态栏原文）；第 2 条 live（真实 SQLite 的 `binding_json` ＋ IPC `generation:last-model` 原文，两源对账）；第 3、4、6 条 static（文案字符串、代码层无回归、R4 改动面）；第 5 条 live（实机实例三项）。live 只认真实 Electron＋真实 SQLite 的原文（命令＋输出摘录＋三项 evidence）；mock/static 不得冒充门禁或实机结论；live 够不到的分支写观察项，不改判据文字。**

1. **[live] 整机重启**：贴进程起止（PID 或起停时间戳）＋重启前／后状态栏快照或可见文本原文，值等于实际调用模型；只做 `reload()` 不算（卡面 §4 第 1 条留痕：reload 后 `actual` 非空不作证据）。
2. **[live] 构造 A≠B 并三处同源对账**：贴配置值 A、`binding_json` 的 `sourceManifest.modelReceipt.model`（真实 SQLite 原文）、IPC `generation:last-model` 原文（`electron/controllers/generation-controller.ts:290`；契约 `src/shared/generation-owner-contract.ts:424`；渲染层消费者 `src/services/generation/actual-model-hydration.ts:21`）、界面显示 B 四处原文，且 A≠B 现场为当场构造；「A 恰好等于实际」判 FAIL。
3. **[static] tooltip 两档文案**：B≠A 时「实际调用／配置」两档文案原文正确（字符串与分支层判；同屏渲染部分随判据 2 的 live 证据一并贴，不单独升 live）。
4. **[static] 无回归**：`GENERATION_MODEL_BINDING_INVALID` 未出现；`generation:list` 仍可用（代码层判）；实机 run 日志中该错误码的缺失随判据 1／2 的原文一并贴，作观察项。
5. **[live] 实例纪律三项**：`instancesThisRun`、`exitCode`、`leftoverElectronProcesses`（须 0）＋`tasklist | grep -c electron` 原文；整机重启用同一轮一次起停，须记两次 PID。
6. **[static] R4 改动面**：`git diff --numstat <base>..card/s3-d16-indicator-verify -- src electron scripts` 输出为空；分支上未新增 `src/`、`electron/`、`scripts/` 下文件（白名单内取证脚本须逐条列出并标注）。**作用域 base 在 D7 apply 后按当时主线头重钉**，重钉时回写本单并报 sha；重钉前本条记「待定钉」，不预判。

本卡判据分层：第 1、2、5 条 live、其余 static。

## 判定纪律

- 只判本单列出的判据，不追加卡面外要求；判据分母＝卡面（`2848337f…`＋本单），两者的判据文字不许由执行方或首验方改动。
- 外派产物只是证据，不构成 PASS；判不了的部分写明「实机后由 `develop` 补证」，不许默认通过。
- 判定面是提交 sha，不是工作区；工作区取证须同时贴 `git status --porcelain -- src electron scripts` 证明等于该 sha。
- 判词落 `.batch/night/reports/s3-d16-qa-firstcheck.md`，直投 `.batch/night/bridge/to-owner`；群里报最终 sha 与结论。
