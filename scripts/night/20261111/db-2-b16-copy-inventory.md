# 夜跑 11-11 · DB-2 B16 来源冲突文案全量对照 + 晨间三步脚本

你是豆包。本卡由 Lead 通过外部看板派发。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`（分支 `agent/wt-1`，基线 `5e031021`）
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：50 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读源码 + 只写报告；零代码改动。
2. 不跑任何测试/构建（可读文件、可 grep）。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 背景
存量 browser 红：`src/components/editor/__tests__/CodeMirrorEditor-generation.browser.tsx:281` 用 `getByText('来源已变化：这一稿不能保存，仍可复制。')` 精确匹配失败。已知两个可疑来源：
- `src/shared/source-conflict-copy.ts:21-32,38-41`（`sourceConflictNoticeText` 拼接）
- `src/components/editor/CodeMirrorEditor.tsx` 的 `handleAcceptAI`（约 `:730`）另一条旧文案分支

## 任务
1. 把仓库里所有「来源冲突 / 来源已变化 / 不能保存」相关文案 **全量列出**（文件:行号 + 原文），不要只列上述两处；用 grep 覆盖 `src/` 与 `electron/`。
2. 逐条标：属于「提示条」/「对话框」/「编辑器内联」/「测试期望」哪一类；指出哪些**语义重复但措辞不同**（这是产品层不一致的候选）。
3. 判定 B16 的失败根因：`测试写法问题` / `产品文案不一致` / `两者都有`；给最小修法建议（改测试 or 统一文案），并说明若统一文案会波及哪些界面/测试。
4. 写一份**晨间三步脚本**（纯文本步骤，给作者手动跑）：第 1 步怎么造「来源变化」状态、第 2 步点哪里、第 3 步应该看到什么（预期文案逐字）；这三步要能让作者 5 分钟内判定 B16 是测试问题还是产品问题。

## 验收
- 文案清单完整（≥ 全部 grep 命中，按文件分组）。
- 结论一行 + 修法建议一句 + 晨间三步脚本可直接照着操作。

## 交付
四段报告（改动清单写「无」）+ `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent doubao
```
