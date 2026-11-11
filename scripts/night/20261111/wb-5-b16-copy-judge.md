# 夜跑 11-11 · WB-5 B16 来源冲突文案判读

你是 WorkBuddy。本卡由 Lead 通过外部看板派发。**判读卡**：实机由 Lead 跑。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线 `5e031021`）
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 产物目录：`C:\develop\workspace\AI-writer\wt-2\.runtime\judge\M2\`（Lead 放：截图 + `ui.txt` + `notes.md`）
- 报告：`C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：40 分钟；产物缺失 → `BLOCKED`。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读，零代码改动。
2. 不跑测试/构建（可 `Read`/`Grep` 源码）。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 背景
存量 browser 红：`src/components/editor/__tests__/CodeMirrorEditor-generation.browser.tsx:281` 用 `getByText('来源已变化：这一稿不能保存，仍可复制。')` 精确匹配失败。两个可疑来源：
- `src/shared/source-conflict-copy.ts:21-32,38-41` 的 `sourceConflictNoticeText` 会拼两句；
- `src/components/editor/CodeMirrorEditor.tsx` 的 `handleAcceptAI`（约 `:730`）另有一条旧文案分支。

## 任务
1. 从产物里确认**实机走的是哪条分支**（哪段文案、在什么操作后出现）。
2. 把两条分支的文案原文都贴出来（源码行号 + 字符串），并指出与测试期望的差异（多一句？少一句？换行？标点？）。
3. 判定：这是「测试写法问题（精确匹配 vs 拼接串）」还是「产品文案不一致（两条分支该统一却没统一）」；给最小修法建议（改测试 or 改文案，二选一，说明理由）。
4. 若产物显示第三条文案 → 单列并说明来自哪里。

## 验收
- 一行结论：`测试写法问题` / `产品文案不一致` / `无法判定`。
- 两条分支文案原文 + 行号 + 差异点齐全。
- 修法建议一句话可执行（例如「把 `:281` 改成 `getByText(/来源已变化：这一稿不能保存/)`」）。

## 交付
四段报告（改动清单写「无」）+ `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent workbuddy:worker
```
