# 派活给 WorkBuddy / CodeBuddy Code（协作通道操作手册）

> 状态：已生效（2026-11-05）· 已验证版本 `@tencent-ai/codebuddy-code` **2.179.3**（npm 全局）
> 用途：**让本机任何 agent 会话把活派给一个独立的 CodeBuddy/WorkBuddy agent 进程**（headless、非交互、跑完退出），不必开 GUI、不必人工按发送。
> 关系：桌面端 WorkBuddy 只是这个 CLI 的 UI 外壳；通道走 CLI，**不走 GUI、不驱动界面**。脚本在 [`scripts/workbuddy/`](../../scripts/workbuddy/)，本文记**怎么调用、怎么限权、哪些已验证**。
> 缘起：2026-11-04 打通接入面。此前只有 Copilot / 豆包两条通道；WorkBuddy 这条按「优先社区方案」先读了 `workbuddy-mcp`、`workbuddy-proxy` 等现成项目，结论见 §9。

## 0. 一句话读法

```bash
node scripts/workbuddy/workbuddy.mjs run "任务描述"
# 底层等价于 node <npm 全局>/@tencent-ai/codebuddy-code/bin/codebuddy -p --dangerously-skip-permissions --output-format stream-json --disallowedTools "Bash(git:*)"
# prompt 走 stdin，不在参数里
```

工作目录固定 **`<repo>/../wt-2`**（WorkBuddy 的槽位，见 [worktree-parallel.md](./worktree-parallel.md) §3.1）。退出码：`0` 完成 / `1` 失败 / `2` 需要人工（未登录）/ `3` CLI 缺失 / `4` 超时。

## 1. 落点与安装

| 项 | 值 |
|---|---|
| npm 包 | `@tencent-ai/codebuddy-code`（bin：`codebuddy` / `cbc` / `codebuddy-code`） |
| CLI 本体（脚本用的就是这个） | `%APPDATA%\npm\node_modules\@tencent-ai\codebuddy-code\bin\codebuddy`（**无扩展名的 Node 脚本**） |
| 用户目录 | `~/.codebuddy/`（sessions / settings.json / logs / projects / plugins） |
| 桌面端 WorkBuddy | `%LOCALAPPDATA%\Programs\WorkBuddy\`，自带 `app.asar.unpacked/cli/bin/codebuddy` 2.165.0；**与 npm 版账号态不互通**，别混用 |
| 运行产物 | `<repo>/.runtime/workbuddy/runs/<runId>/`（`.runtime/` 已 gitignore） |

安装（一次性）：

```bash
npm install -g @tencent-ai/codebuddy-code
node "$APPDATA/npm/node_modules/@tencent-ai/codebuddy-code/bin/codebuddy" --version   # → 2.179.3
```

`codebuddy` **不在 PATH**，且 npm 装的 `codebuddy` shim 在 Git Bash 里是坏的（见 §4.5 陷阱 2）。脚本自己解析绝对路径并用当前 `node` 当解释器，所以调用方不需要配 PATH。
## 2. 命令速查（`scripts/workbuddy/workbuddy.mjs`）

| 命令 | 作用 |
|---|---|
| `probe` | 报 CLI 路径 / 版本 / 工作目录 / **是否已登录**（未登录退出码 2） |
| `run "任务"` | 跑一次任务；`--cwd <dir>` 换目录、`--timeout <分钟>`（默认 15）、`--json` 输出结构化摘要 |
| `run --file 任务书.md` | 长任务书从文件读（不经 shell 转义，推荐） |
| `login` | 起 `--serve` → 打印 Web UI 登录地址并打开浏览器 → 轮询到登录成功；`--port`（默认 8099）、`--wait`（默认 600s）、`--no-open` |
| `run --dry-run` | 只打印将要执行的命令与参数，不真的跑 |

透传给 CLI 的选项：`--model` / `--fallback-model` / `--permission-mode` / `--max-turns` / `--append-system-prompt` / `--resume <sessionId>` / `--continue` / `--format text|json|stream-json`；逃生阀 `--no-skip-permissions`（不给 `-y`）、`--allow-git`（不注入 git 禁令）。

## 3. 权限模型（决定「能不能放心给它干活」）

1. **`-y / --dangerously-skip-permissions`**：非交互必需，否则每个要授权的操作都会卡住等人点。脚本默认带上。
2. **`--permission-mode`**：`default | acceptEdits | plan | dontAsk | auto | bypassPermissions`；`-y` 之外还可以精确一点（例如只自动批编辑用 `acceptEdits`）。
3. **`--allowedTools` / `--disallowedTools`**：工具级白/黑名单，语法与 Claude Code 同源（`"Bash(git:*)" Edit`）。**脚本默认注入 `--disallowedTools "Bash(git:*)"`**：提交权归主 agent（与 copilot 通道同一条铁律）。
4. **`CODEBUDDY_IS_SANDBOX=1`**：连 HIGH/CRITICAL 都不问、全放行。**高危，通道不使用**，只在一次性容器里考虑。

**测试时注意**：`-y` 下高危工具仍可能弹确认；非交互场景表现为「任务卡住 / 提前结束」，不是「CLI 坏了」。

## 4. 工具名（`--output-format stream-json` 的 init 事件里读到的真实名单）

`Agent` `Read` `Write` `Edit` `Bash` `PowerShell` `Glob` `Grep` `EnterPlanMode` `ExitPlanMode`
`TaskCreate` `TaskGet` `TaskUpdate` `TaskList` `TaskStop` `TaskOutput` `WebFetch` `WebSearch`
`Skill` `SkillManage` `Component` `Mods` `AskUserQuestion` `AskUserForStructuredInput` …

改文件的工具 → 副作用口径（`cli.mjs#describeFileEdit`）：

| 工具 | kind | 取路径的字段 |
|---|---|---|
| `Write` | `create` | `file_path` |
| `Edit` / `MultiEdit` | `edit` | `file_path` |
| `NotebookEdit` | `edit` | `notebook_path` |
| `apply_patch` | `patch` | `path` |

**不要信 agent 的自述**：改了什么看 `tool_use` / `tool_result`，`result.json` 里 `fileEdits` 是脚本折算出来的。

## 4.5 已知陷阱（都是本机实测撞出来的）

### 陷阱 1 · 未登录时退出码仍是 0 ★

```text
Authentication required. Please use /login command to sign in to your account
```

CLI 把它当「正常结束」处理，exit code = 0。所以判未登录**只能看文案**——`cli.mjs#detectAuthRequired` 兜这一条，`run` 因此返回 2 而不是 0。别写「exit 0 就算成功」的脚本。

### 陷阱 2 · npm 的 `codebuddy` shim 在 Git Bash 里是坏的

`%APPDATA%\npm\codebuddy` 里 `[ -x "$basedir/node" ]` 命中后 exec 了 `…/npm/node_modules/node/bin/node`，报 `This: command not found`。
**必须**用 `node <pkg>/bin/codebuddy`（脚本已这么做）。别用 PATH 上的 `codebuddy` 诊断问题。

### 陷阱 3 · prompt 不能进 argv

Windows 上 `spawn(..., {shell:true})` 会把参数原样拼进命令行，prompt 里的换行、`&`、`|`、`%` 会被 cmd.exe 解释（社区项目 `workbuddy-mcp` 的实测结论，本通道沿用）。所以 prompt **走 stdin**：`child.stdin.end(prompt)`，长任务书用 `--file` 读也行。

### 陷阱 4 · 别去 attach 桌面端的 GUI sidecar（本机踩过）

桌面端会拉起 `codebuddy --serve`（随机端口 + 随机密码 + `/api/v1/*`）。密码只在进程环境里（`CODEBUDDY_GATEWAY_PASSWORD`），不落盘；`POST /api/v1/jobs` 会**继承父进程 `--port` 撞端口**（实测把 GUI 的 sidecar 搞挂）。通道不碰它。

### 陷阱 5 · 桌面端登录态不能复用

桌面端 token 存在 `%LOCALAPPDATA%\CodeBuddyExtension\Data\Public\auth\workbuddy-desktop.info`，值是 `$wbEncrypted` 信封（AES-256-GCM），解它要借 `WorkBuddy.exe` 的 Electron binding；而且把 `CODEBUDDY_CONFIG_DIR` 指到 `~/.workbuddy` 也解不开认证。**结论：不偷 token，走一次性登录**（§8）。

### 陷阱 6 · `--output-format json` 实际仍按事件流输出

实测拿到的是多行事件（`system/init` → `assistant` → `result`），不是单个 JSON。解析器按「逐行 JSON、非 JSON 行进 invalidLines」处理，两种格式都不炸。
## 5. 事件结构（`--output-format stream-json`）

每行一个 JSON 事件，实测类型：

| 事件 | 关键字段 | 用途 |
|---|---|---|
| `system/init` | `session_id` `model` `cwd` `tools[]` `apiKeySource` | 记下这次是谁、在哪个目录、有哪些工具 |
| `system/status` | `status` | 心跳/状态（可忽略） |
| `assistant` | `message.content[]`：`text` / `tool_use{id,name,input}` | 工具调用来源 |
| `user` | `message.content[]`：`tool_result{tool_use_id,is_error,content}` | 成败、权限拒绝 |
| `result` | `subtype` `is_error` `result` `num_turns` `duration_ms` `total_cost_usd` `permission_denials` | 终局：成功/失败/花多少 |

脚本把原始 stdout 存 `stdout.log`、事件存 `events.jsonl`、折算摘要存 `result.json`（含 `fileEdits` / `deniedTools` / `outcome`）。**`result.json` 才是可核对的凭证**，stdout 只当证据。

## 6. 铁律与归属

1. **WorkBuddy 固定用 `wt-2`**（`agent/wt-2` 分支，renderer 5182 / CDP 9224）。归属固定，不「谁空谁用」——见 [worktree-parallel.md](./worktree-parallel.md) §3.1。
2. **外部 agent 不提交 git**：脚本默认注入 `--disallowedTools "Bash(git:*)"`；要提交由主 agent 复核 diff 后代劳。
3. **不碰 GUI**：不 attach sidecar、不 CDP 驱动 WorkBuddy 窗口（那是豆包通道的做法；WorkBuddy 有官方 headless，没必要）。
4. **运行产物落 `.runtime/workbuddy/runs/`**，不入库；不要往 `scripts/.tmp/` 扔探针。

## 7. 已验证 / 未验证（分清楚，别把没测的当结论）

**已验证（2026-11-05，有输出为证）**

- npm 装包与版本：`2.179.3`；`node <pkg>/bin/codebuddy --version` 正常
- `probe`：解析出 CLI 路径、版本、`cwd=wt-2`，未登录时**退出码 2**（文案判定生效）
- `run` 未登录路径：退出码 2，产物完整落盘（`request.json` / `stdout.log` / `events.jsonl` / `result.json`），事件含 `system/init`（`apiKeySource: copilot.tencent.com`、`model: hy4-preview`、工具名单）与 `result{subtype:error_during_execution, is_error:true}`
- `login` 管线：`--serve` 起得来（未登录也能起），能从 stdout 抓到 `Web UI http://127.0.0.1:<port>/?password=…`，轮询到超时后杀树、端口释放（无残留监听）
- `--serve` 的密码落在 `~/.codebuddy/settings.json`，跨次稳定
- 单元测试 38 条全绿（`node scripts/run-tests-electron.mjs scripts/workbuddy/__tests__/cli.test.mjs`）

**未验证（要用先测）**

- **端到端真跑一次任务**：需要人工先登录（`login` 或 TUI `/login`），登录后立刻补测 `run "只回复两个字母：OK"` → 期望退出码 0、`result.subtype=success`
- Web UI 的 SSO 登录是否真的把凭据写回 `~/.codebuddy`（页面有 SSO 入口，未走完）
- `--resume` / `--continue` 续会话、`--max-turns`、`--model` 换模型
- 并发两个 `run`（同一 `~/.codebuddy` 是否会互相干扰）
- `--output-format json` 单对象形态（见陷阱 6，实测的是事件流）

## 8. 认证：一次性人工登录（为什么不做自动化）

```bash
node scripts/workbuddy/workbuddy.mjs login     # 打印并打开 Web UI，登录后自动返回
# 备选：直接跑 codebuddy 进 TUI，输入 /login，登录完退出
```

- 未登录时 `run` 返回 **2 + NEED_HUMAN_LOGIN**（与豆包通道的 `NEED_HUMAN_LAUNCH` 同构）：**不要自动重试**，等人。
- CLI 的取凭据顺序（从 bundle 里读出来的）：`CODEBUDDY_AUTH_TOKEN` 环境变量 → `ACC_PRODUCT_CONFIG` 里的 `custom-token` → settings 文件里的 `env.CODEBUDDY_AUTH_TOKEN`。也就是说**只登录一次**，之后所有非交互调用都直接可用。
- 不要为了「免登录」去解桌面端的 `$wbEncrypted` 信封（陷阱 5）：那是复刻 Electron binding 的路子，版本一升就碎，而且等于绕过人家的账号体系。

## 9. 社区已有方案与取舍（「优先社区」的调研结论）

| 项目 | 是什么 | 为什么没直接用 |
|---|---|---|
| `LinHaiJ/workbuddy-mcp`（npm `workbuddy-mcp` 0.2.0, MIT） | 极简 MCP server，只暴露 `run_workbuddy_task`，内部 `spawn codebuddy -p` | 它是 **MCP 宿主插件**，本项目通道是「CLI 脚本 + 手册」，形态与 copilot/豆包通道一致才可编排；**但它的两条硬经验被照搬**：prompt 走 stdin（陷阱 3）、超时用 `taskkill /T /F` 杀进程树 |
| `banana770/workbuddy-proxy` | 把桌面端已登录账号的模型转成 OpenAI/Anthropic 本地网关 | 只复刻**模型 API**，不是 agent 通道；也没有文件/终端副作用可校验 |
| `3304711297/workbuddy2api` | Tauri 控制台，浏览器授权后提供三种协议的本地网关 | 同上；目标是把 WorkBuddy 当模型用，不是把活派给它 |
| `Ianzhyh/workbuddy-to-dsh`（MIT） | DSH 插件，解桌面端加密凭据后复用账号 | 解 `$wbEncrypted` 需 Electron binding，脆（陷阱 5）；我们改走官方登录 |
| 官方文档 `workbuddy.ai/docs/cli/headless` · `codebuddy.ai/docs/cli/http-api` | headless 模式与 HTTP API 规范 | **正路就是 headless `-p`**；HTTP API 只用于 `login` 时的 Web UI，不做任务面（陷阱 4） |

## 10. 相关文档

- Worktree 槽位与归属：[worktree-parallel.md](./worktree-parallel.md) §3.1
- 同构的另两条通道：[copilot-channel.md](./copilot-channel.md) · [doubao-channel.md](./doubao-channel.md)
- 文档纪律：[documentation-charter.md](./documentation-charter.md) · [../README.md](../README.md) §3
