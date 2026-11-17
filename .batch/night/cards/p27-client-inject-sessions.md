# P27 · 客户端补 `sessions` 依赖：修「没有匹配的会话」

- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 估时：25 分钟
- 起点：P26 交付后的 HEAD（并行会撞 porcelain，等 P26 落地再投）
- 依据：developer 的只读结论（08:19）

## 一、事实链

- 服务名 `sessions`，提供者 `@deepseek-ai/dsh-api-session-controller`：`lib/client.js:3856` `rootCtx.reflect.provide("sessions", this, void 0)`。
- 官方 `dsh-client-ui-session` 的客户端 inject：`["sessions","slots","remote","remoteAccess"]`。
- 同运行时活证据：`@linxin666/dsh-client-ui-task-board/lib/client.js:15691-15702` inject 含 `"sessions"`，随后 `ctx.sessions.subscribe/.open`。
- 我们 `client.js:20` 是 `const inject = ["slots"]`；`sessionsOf()`（`:147-154`）先试 `ctx.sessions.list` 再 `readService`；`sessionMap()`（`:156-164`）读 `sessions.list.getSnapshot().byId`。
- ⇒ 渲染时 `ctx.sessions` 取不到 → 空表 → 「没有匹配的会话」。

## 二、必做

1. `client.js:20` 的导出数组改为 `const inject = ["slots", "sessions"];`（**只加 `"sessions"` 一个**）。
2. 保留现有全部兜底：`sessionsOf()` 的两条取法、`sessionMap()` 拿不到时返回 `{}`、picker 空态文案。不要因为「现在一定有」就删兜底。
3. `package.json` 的 `dsh.client.inject` **不动**（那是模块依赖，不是服务名）。
4. 只动 `client.js` 与 `index.test.mjs`；`index.js` 一个字节不动。

## 三、测试

- 现有全绿（P26 后应为 133+）。
- 新增：把 inject 数组导出值断言为包含 `sessions` 与 `slots`；并用桩 ctx（有 `sessions.list.getSnapshot`）跑一次 `sessionMap` 非空、picker 能列出至少一条。反证：把数组改回 `["slots"]`，该用例必须红。

## 四、禁动区

- 不改 index.js、不改 settings 卡的三列结构与写回路径、不碰 `cordis.patch.yml`、不碰在用 profile、不新增依赖。

## 五、交付要求

1. 提交（`fix:` 前缀），`git add` 点名文件、禁 `-A`。
2. 回执贴 `git log --oneline -2`、`git status --porcelain`（须空）、`git show --numstat HEAD`、`node index.test.mjs` 末尾总条数。
3. 报告 `.batch/night/reports/p27-client-inject-sessions.md`，末行 `<!-- DONE -->`。
4. 报告落盘同一分钟内写 `.batch/night/signals/doubao/p27-client-inject-sessions.done`。

## 六、风险与判据（QA 用）

- 风险：硬 inject 会使 `sessions` 成为前置依赖，若宿主缺该服务则条目 pending（K21 那类）。判定依据：该服务是本机 core 服务、官方与 task-board 均硬 inject，接受；但**真机若出现 `web boot: 1 entry did not activate` 立刻回滚**（三行：还原 `client.js`、`dsh plugin --profile desktop install`、重启）。
- C1 只含 `client.js`、`index.test.mjs`；`index.js` blob 与 P26 后 HEAD 相同。
- C2 导出数组恰为 `["slots","sessions"]`，顺序不限，不得再多个别的。
- C3 反证用例真跑（改回 `["slots"]` 变红）。
- C4 测试全绿且总数 > P26。
## 七、投递指令（联络人 2026-11-14 08:3x 投前核对）

投前基线（我实跑）：仓库 `C:\develop\workspace\dsh-handoff-relay` 的 `HEAD=bb8ee9120803`（P26 已终审 PASS）、`git status --porcelain` 空、`node index.test.mjs` = `TOTAL: 133/133 PASS / RESULT: PASS`。

1. **只动** `client.js` 与 `index.test.mjs`；`index.js` 一个字节不动、`package.json` 的 `dsh.client.inject` 不动。
2. 导出 `inject` 只加 `"sessions"` 一个，**现有兜底一条不准删**（`sessionsOf()` 两条取法、`sessionMap()` 返回 `{}`、picker 空态文案）。
3. **信号文件**（交付的一部分）：报告落盘后同一分钟内写
   `C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p27-client-inject-sessions.done`
   （三行：报告路径 / 提交 SHA / `<!-- DONE -->`）；写不进立刻在回执里说「信号未写 + 原因」。
4. 回执须含：`git log --oneline -2`、`git show --numstat HEAD` 原文、`node index.test.mjs` 末几行（含总条数）、porcelain。
5. 交付后不要再往这张卡上加提交；报告数字以最终 HEAD 为准。

回执照旧四行 + 模型芯片 + HEAD/字节/MD5。
