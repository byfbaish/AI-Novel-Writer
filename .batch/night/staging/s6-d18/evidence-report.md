# S6 · D18 判据 4 定向取证报告

- 判定面：`89868921`（develop HEAD＝远端）
- 取证树：`C:\develop\workspace\AI-writer\wt-s6`（`git worktree add --detach … 89868921`），`git rev-parse --short HEAD` → `89868921`
- 产物同源：`wt-s6/dist/index.html` mtime `2026-11-23T04:54:18.530Z`（= 12:54:18 +08），晚于判定面提交；构建式：`node node_modules/typescript/bin/tsc` → EXIT=0，`node node_modules/vite/bin/vite.js build` → `✓ built in 16.8s`（绕开 `pnpm build`：worktree 的 node_modules 是 junction，`pnpm.mjs:249560 runDepsStatusCheck` 崩，既有记忆 2f75 同根因）
- 结论：**判据 4 PASS 的取证条件成立** —— 单实例、一次启动，定稿段日志里 `[hook-unplanted]` 出现 **恰 1 次**，`exitCode=0`、`leftoverElectronProcesses=0`
- runId：`b3984cd5-78f`

## 一项一读数

| 项 | 值 | 来源 |
|---|---|---|
| instancesThisRun | 1 | evidence.json |
| exitCode | 0 | evidence.json |
| leftoverElectronProcesses | 0 | evidence.json（PowerShell `Get-CimInstance Win32_Process`；本机无 wmic） |
| `tasklist \| grep -ci electron` | `0` | evidence.json `tasklistGrepCount` |
| markerLineCount | 1 | evidence-s6-d18.json |
| markerCountMax（采集中最大） | 1 | 同上 |
| markerCountFinalBody（末次正文） | 1 | 同上 |
| settled（见「定稿完成/已定稿」） | true | 同上 |
| ch6 正文长度 | 34 字 | 夹具 `CH6_BODY`，含 `draftsAfter` ch6 `status=finalized` |

## 判定行原文（markerLines[0]）

```
[hook-unplanted] ⚠️ 钩子未落地体检（C5）：钩子与本章正文的最长共同片段只有 1 字（少于 3 字）：「第6章结尾：名册被划掉的名字在次日夜里重新浮现」在正文里没有对应的写法。可改钩子、改正文，或知悉放行 —— 这一条只判当章，不追下一章。（正文已定稿；这是提示，不阻断，也不改稿。）
```

## 本次布局（为何能取到日志）

`[static]` 标记只在真有 C5-unplanted finding 时出现：`src/shared/hook-payoff-report.ts:54`（`const marker = unplanted.length > 0 ? '[hook-unplanted] ' : ''`）；C5 判据＝钩子与正文最长公共连续片段 <3 字（`src/shared/hook-payoff-audit.ts`，`HOOK_PLANTED_MIN_RUN = 3`）。生产调用点 `src/services/workflows/commands/finalize-chapter.command.ts:954-975`，只报不拦。

`[live]` 路径：进入作品 → 蓝图 → 草稿箱点「第6章 落册」卡内的**「草稿」小标**（点章卡本身不打开编辑器）→ 工具栏「定稿」（`DraftEditor.tsx:800-806`）→ 「确认定稿」→ 展开「日志」tab 读工作流行。

## 已披露偏差（不影响判据，但如实记）

1. 本次定稿后处理后处理两步骤失败：`以下后处理步骤失败：知情候选、角色状态更新`（见 `final-body.txt:146`）；`第6章定稿 — 2 个步骤失败`（`:88`）。C5 体检本身已产出，且正文已定稿落库（`draftsAfter` ch6 `finalized`，34 字）。
2. 模型为桩（`https://api.openai.com/v1/chat/completions` 固定安全文本），`physicalModelRequests` 记 0、无外网请求；夹具正文与钩子无 ≥3 字公共片段，故 C5 必报。
3. 本卡的「恰一次」是**渲染层日志面板文本**计数（`body.innerText` 行匹配），非日志文件计数；日志面板需先展开（脚本 `expandWorkflowLogs`）。
4. 脚本 `run-finalize.mjs` 与原仓外版本相比新增：appDb 25s 超时、硬看门狗 260s、`expandWorkflowLogs`。前两版曾因 `page.evaluate` 卡死（run `97d9c46d-61d`，DB 已写入但 evidence 未落）与未展开日志面板（run `0ac0b1c0-b03`，`markerLineCount=0`）失败，均未作为证据。

## 命令原文

```
git worktree add --detach /c/develop/workspace/AI-writer/wt-s6 89868921
node node_modules/typescript/bin/tsc            # EXIT=0
node node_modules/vite/bin/vite.js build        # ✓ built in 16.8s
node run-finalize.mjs --mode final --wait 150000   # exitCode 0
```

## sha256

见同目录 `sha256.txt`。
