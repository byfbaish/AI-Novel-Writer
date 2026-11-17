# 改码卡 · 目录探测改走主进程路由（框沿三色真正可用）

- 卡号：P44（**A 类**：产生仓库提交）
- 估时：改码 45 分钟 + QA 首验 15 分钟（真机 10 分钟另计）
- 派单人：AI writer总负责人
- 仓库：`C:\develop\workspace\dsh-handoff-relay`，分支 `master`，起点 HEAD `8e4ad642095e9f239038e86468d9dced459361fa`，version 0.5.0
- 依据：P41 `23285B40EF266F40E526706D6BFECCD3`（`probeDirectory` 恒 none、主进程无下行通道）+ P42 `4B58F3459842D33BC017231F62C74B5F`（本地 fs 服务为 0）+ P43 `222B90A66F0BEBC14CF820A39B5B8B45`（渲染层判不了目录：`workspaceFiles.list` 被 `api-workspace-files/lib/index.js:581` 锁在工作区内；`stat` 只认文件）+ 社区调研 `FDC0EAA57FA3B6126EADCD1FDD0E83F2`（`ctx.webServer.register` 可用、`ctx.inject(['webServer'])` 形态、必须同源校验、渲染层不能走 `__DSH_TRANSPORT__.streamBaseUrl`）

## 要做三件事

### 1. 主进程注册探测路由（`index.js`）
- 用 `ctx.inject(['webServer'], wctx => { ... })` + `wctx.effect(...)` 注册 **exact** 路由 `GET /handoff-relay/probe`，参数 `path`（必填，绝对路径）。
- 实现照社区已验证形态（`@goodandready/dsh-agent-loop-guard/lib/index.js:233-281`）。
- **必须做同源校验**（照 `dsh-better-sidebar/lib/index.js:9695` 的 `requestRejection` 或 `:252` 的 `isTrustedTelemetryRequest` 思路）：跨源请求一律 403 且不执行 `fs` 调用。理由：不校验等于把本地文件系统开成公共接口。
- 判定用 `fs.stat` / `fs.access`，归一成结构：
  ```json
  { "kind": "ok|missing|denied|file|none", "absolute": "<归一后的绝对路径>", "reason": "<机器可读短码>" }
  ```
  规则：可读目录 → `ok`；不存在 → `missing`；存在但无读权限 → `denied`；存在但是文件 → `file`；入参非法（非绝对路径/空/含 NUL）→ `none` + reason。
- 路由只读，**不得写文件、不得列目录内容**（只 stat/access，不 readdir）。

### 2. 渲染层改用它（`client.js`）
- `probeDirectory`：删掉对 `ctx.get("remoteAccess")` / `workspaceFilesOf` 的依赖；改为 `fetch('<页面自身 origin>/handoff-relay/probe?path=' + encodeURIComponent(dir))`。
  - **不能**用 `__DSH_TRANSPORT__.streamBaseUrl`（跨源，会 `Failed to fetch`）；取法照 `dsh-better-sidebar/lib/client.js:1150-1244`。
- 输入变化 debounce 300–500ms 再请求；请求在途期间 `kind: "checking"`。
- 网络失败/超时 → `kind: "none"`（保持中性灰 + 原有「宿主未提供目录核验」文案），不得渲染成绿。
- 把 `probeDirectory` 结果映射进 **P39 已写好的三色** `dirFrameStyle`（`client.js:244` ok→`#2e7d32`、`:245` bad→`#d33`、`:246` checking|none→`#9e9e9e`）：
  - `ok` → 绿
  - `missing` / `denied` / `file` → 红
  - `checking` / `none` / 网络失败 → 灰
- 框沿下方那行小字改成可读中文：`ok`→「目录可读」；`missing`→「目录不存在」；`denied`→「无读取权限」；`file`→「这是文件，不是目录」；`none`→保留「宿主未提供目录核验」。**必须**给出一行文字（只靠颜色不合无障碍）。

### 3. 顺手补「存在性不验」的洞
- `validateSettingsRow`（`client.js:321-329`）目前只判绝对路径与目标会话。**不要**把它改成同步校验（会阻塞保存）；改为：保存时若当前探测结果不是 `ok`，在行下方红字提示（不阻止保存），文案「目录当前不可读，保存后需确认」。

## 禁改区
- 不改 `package.json`、不改 README（README 更新另卡）、不改 `cordis.patch.yml`。
- 不动 watch 逻辑、不动投递逻辑。
- 不 push、不打 tag、不 publish。

## 提交与交付
- 一次点名提交：`git add index.js client.js index.test.mjs`（若测试另建文件则点名加上），**禁 `git add -A`**。
- 测试：`node index.test.mjs` 必须全绿（**不是** `node --test`，本项目 test 脚本是自跑式断言）。
- 测试请覆盖：合法目录 → `ok`、不存在 → `missing`、文件路径 → `file`、非绝对路径 → `none`、跨源请求被拒（可用 handler 单测直接构造 request）。
- 报告 `.batch/night/staging/p44-dir-probe-report.md`，末行 `<!-- DONE -->`；首写起点 HEAD 与提交 SHA、`git show --numstat` 原文、测试输出末 10 行。

## 完成判据（QA 用）
1. 起点 HEAD 与卡面一致，提交恰好 1 笔，porcelain 空。
2. `node index.test.mjs` 全绿，且新增用例覆盖上面 5 条。
3. 同源校验存在且跨源 403（代码位置 + 单测）。
4. 渲染层不再依赖 `remoteAccess` / `workspaceFilesOf`（`git show` 里可见删除）。
5. 三色映射齐全（绿/红/灰 + 一行文字）。

---
## 投递指令（投方补充，与正文同等效力，冲突以本节为准）

**落点与自证**：落点是 `C:\develop\workspace\dsh-handoff-relay`（master），不是线程 chip 显示的 `AI-writer-wt-1`。开工第一步只自证一次：`git -C C:\develop\workspace\dsh-handoff-relay rev-parse --show-toplevel` 应为 `C:/develop/workspace/dsh-handoff-relay`，`HEAD` 应为 `8e4ad642095e9f239038e86468d9dced459361fa`，`git status --porcelain` 应为空。三项全部符合就**立刻开始写代码**，不要重述计划、不要反复复核工作区、不要再问确认。任一项不符就停下报告实况，禁止自己 reset/checkout/stash。

**测试命令**：`node index.test.mjs`（本项目 test 脚本是自跑式断言），**不是** `node --test`，也不是 `pnpm test`。

**提交**：完成后一次点名提交，例如 `git add index.js client.js index.test.mjs`；**禁 `-A`**、禁 push、禁打 tag、禁 publish。禁改 `package.json`、两份 README、`cordis.patch.yml`。

**报告**：落 `C:\develop\workspace\AI-writer\develop\.batch\night\staging\p44-dir-probe-report.md`（注意根目录是 develop，写绝对路径），末行 `<!-- DONE -->`，必须含：提交 SHA、`git show --numstat` 原文、`git status --porcelain` 结果、测试输出末 10 行。

**信号**：报告落盘后立刻写 `C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p44-dir-probe.done`，三行：`p44-dir-probe` / 提交 SHA / porcelain 结果。

**回执**：最后在对话里贴这三样原文——提交 SHA、`git show --numstat` 原文、测试输出末 10 行。写完即停，不要继续做本卡以外的事。
