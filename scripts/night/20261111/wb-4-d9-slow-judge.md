# 夜跑 11-11 · WB-4 D9 慢吐实机判读

你是 WorkBuddy。本卡由 Lead 通过外部看板派发。**本卡是「判读」卡**：实机由 Lead 跑，产物已放在你工作区，你只读产物 + 必要源码，给判定。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线 `5e031021`）
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 产物目录：`C:\develop\workspace\AI-writer\wt-2\.runtime\judge\M1\`（Lead 放，可能含 `run.json`、`timeline.txt`、`ui.txt`、`screenshot-*.png`、`README.md`）
- 报告：`C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：45 分钟；产物目录不存在或为空 → `BLOCKED`。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读；不改源码（本卡零代码改动）。
2. 不跑任何测试/构建（如需复核 D9 相关单测，只能跑 `node node_modules/vitest/vitest.mjs run electron/services/__tests__/generation-run-service.call-timeout.test.ts`）。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 背景（D9 阶段 1，已合入基线 `5e031021`）
单次模型调用上限 10 分钟：`resolveCallDeadline` 取 `min(剩余预算, 上限)`；超时落 `block` + `settle`，新失败码 `GENERATION_CALL_TIMEOUT`，判定排在 `GENERATION_CANCELLED` 之前；界面两档（传输超时 / 调用超时「本次调用超过 10 分钟未完成，已中止。」）。**单章超时停整批 = 已裁口径**（后续 open 全拒，不是缺陷）。

## 任务（逐条给结论，每条必须带产物里的原文/SQL 行/截图文件名作为证据）
1. 这次实机是否真的触发了单次调用超时？怎么判的（`generation_runs` 的 `status`/`end_reason`/`error_code`？界面文案？）
2. 超时后批次是否按「停整批」表现（后续章节没有新 run 被 open），而不是继续跑？
3. 界面给的是哪一档文案？与 `src/panels/ai-output-failure-presentation.ts` 的映射是否一致？
4. 有没有出现「超时被记成 cancelled」的迹象（旧行为回归）？
5. 产物里是否存在无法解释的异常（例如进程退出、DB 写失败、日志断档）——有就单列。

## 验收
- 报告开头给一行总判定：`PASS` / `FAIL` / `无法判定（缺什么产物）`。
- 五问逐条回答，每条证据必须能在产物目录里指到具体文件。
- 若判 FAIL：给出「哪条硬事实与预期不符」+ 最小复现步骤建议（不要自己复现）。

## 交付
四段报告（改动清单写「无」）+ `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent workbuddy:worker
```
