# 夜跑 11-11 · WB-2 B11 监听器 1 vs 2（静态判定）

你是 WorkBuddy。本卡由 Lead 通过外部看板派发。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，基线 `5e031021`）
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：40 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读代码 + 最多改本卡点名文件（≤10 行）；不碰 `develop` / `wt-1` / `wt-3`。
2. 只跑单测；**本卡禁跑 `*.browser.tsx`**（browser 测试由 Lead 在主区跑）；可跑 `pnpm typecheck`。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告一个文件。
5. 遇确认框/提权弹窗 → 立刻 `BLOCKED`。

## 事实
`src/components/startup/__tests__/RendererStartup.browser.tsx` 的两处断言失败：
- `:130` `expect(listeners.size).toBe(1)`（editor 挂载前，通过）
- `:137` `expect(listeners.size).toBe(1)`（editor 挂载后，实得 2）

夹具 mock 在 `:110-115`：`listeners.add(callback); return () => listeners.delete(callback)`。被测组件 `src/components/startup/RendererStartup.tsx` 有多个 `useEffect`（`:41`、`:52`、`:57`），其中 `:44` 注册 `ipc.on('window:close-requested', ...)`。

## 任务
1. 读 `RendererStartup.tsx` 全部 effect 与 `TitleBar.tsx`（关注 `:75` 附近的 `ipc.on`），判断「editor 挂载后监听从 1 变 2 是**真实泄漏**（同一 `window:close-requested` 被订阅两次且未清理）还是**测试夹具缺陷**（例如 effect 依赖变化导致重复注册但 cleanup 已正确返回）」。
2. 给出证据：涉及文件:行号 + 原文片段；说明第二次订阅从哪来。
3. 若判定真泄漏且最小修法 ≤10 行（只改 `RendererStartup.tsx` 或该测试文件），直接改掉并在报告贴 diff；若需改生产契约或影响面 >10 行 → 只给方案，不改。
4. 跑 `pnpm typecheck` 记录退出码。

## 验收
- 报告必须给出明确结论：`真泄漏` / `测试缺陷` / `无法判定`，并附证据行号。
- 若改了代码：贴 diff + 说明为什么不会改变既有行为（受影响的只有首次挂载/卸载路径）。

## 交付
四段报告 + 末尾 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent workbuddy:worker
```
