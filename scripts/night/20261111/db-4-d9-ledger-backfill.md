# 夜跑 11-11 · DB-4 D9 台账/状态行回填（两处）

你是豆包。本卡由 Lead 通过外部看板派发。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`（分支 `agent/wt-1`，基线 `5e031021`）
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：40 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只改本卡点名的那两处文档行；不动代码；不碰 `develop`。
2. 不跑测试/构建；可用 grep/read。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 背景
D9 阶段 1 已在 `5e031021` 落地（单次调用上限 10 分钟 + `GENERATION_CALL_TIMEOUT` + 界面两档；单章超时停整批=已裁口径；续写模式另案）。台账现值需要回填两处，**只写现值、不改历史格**（作者 2026-11-09 定的回填口径）。

## 任务
1. 定位并读这两处现值：
   - `docs/plans/prompt-assembly-backlog.md` 的 D9 行（约 `:132`）与「D9–D11、D16」那一行的状态（约 `:113`）。
   - `docs/design/product/live-pipeline-acceptance-defects-assessment.md` 里 D9 条目（grep `D9`）。
2. 用**最小改动**回填：把「阶段 1 已接线（`5e031021`）」写进状态格，保留原有历史文字（若历史格里写着「零调用点/机制就绪」等旧描述，不改原文，只在现值处补一句日期 + 提交号 + 一句现状）。
3. 在报告里贴「改前 / 改后」两段原文（逐行），并说明每处改动为什么是「现值而不是改历史」。
4. 若发现某处其实已经是最新描述（不需要改），明说「第二处无需改动」并给证据行号。

## 验收
- 两处都给出结论（改了 / 不需要改），改前改后逐行对照。
- `git -C C:\develop\workspace\AI-writer\wt-1 diff --stat` 只含这两个文件。

## 交付
四段报告 + `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent doubao
```
