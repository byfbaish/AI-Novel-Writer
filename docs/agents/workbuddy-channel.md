# 给 WorkBuddy 派活（协作通道操作手册）

> 状态：已实施（2026-11-05）· 实测版本 WorkBuddy 5.9.3（Chromium 138.0.7204.251 / Electron 37.10.3）
> 用途：把 AI-writer 仓库里的活派给本机 WorkBuddy（腾讯 CodeBuddy 系）。两条路：**attach**（CDP 驱动桌面 UI，复用作者已登录的账号与积分，默认走这条）与 **headless**（`codebuddy -p` 独立进程，要单独登录、不用积分，§9 兜底）。
> 关系：与 [豆包通道](doubao-channel.md)、[Copilot 通道](copilot-channel.md) 平级；**工作目录固定 `wt-2`**（[归属表](worktree-parallel.md#31-槽位归属固定不是谁空谁用)）。
> 社区调研：已查 `workbuddy-mcp` / `workbuddy-proxy` / `workbuddy-to-dsh` / `workbuddy-daily-credits` / `dsh-botcrew`，没有现成的「桌面已登录态 + 可编排」轮子，取舍见 §11。

## 0. 一句话读法

```bash
# 1) 诊断（只读，不会动 UI）
node scripts/workbuddy/workbuddy-attach.mjs status

# 2) 派活（默认复用上次会话；要新开一条加 --new）
node scripts/workbuddy/workbuddy-attach.mjs task "任务文本" --new
```

连不上时脚本会打印 `NEED_HUMAN_DEBUG` 横幅（exit 2）：把横幅里那条命令**原样发给作者**，让他自己启动。**不要**自己 spawn WorkBuddy.exe——工具会话拉起来的 GUI 会在十秒内被回收（2026-11-05 实测）。

桌面端不方便开、或只要一个跑完就退的独立进程时，改走 headless 兜底通道（要单独登录一次）：
```bash
node scripts/workbuddy/workbuddy.mjs run "任务文本"    # 见 §9
```

## 1. 为什么必须由人启动 Debug 实例

WorkBuddy 的「Debug 模式」**不是命令行开关**，而是启动时读环境变量 `WORKBUDDY_REMOTE_DEBUGGING_PORT`，主进程看到才自己 `appendSwitch('remote-debugging-port', …)`：

```js
// app.asar 主进程里（2026-11-05 反查，byte 10964049 附近）
let n = process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT
if (n && /^\d+$/.test(n)) { electron.app.commandLine.appendSwitch('remote-debugging-port', n); … }
```

直接给 `WorkBuddy.exe` 传 `--remote-debugging-port=9333` 会被忽略。由此带来三条硬约束：

1. **环境变量只在进程启动时读一次** ⇒ 已经开着的实例不会「长」出调试端口，必须先退出旧实例。
2. **单实例锁** ⇒ 旧实例不退，新进程会被挡掉、什么都不发生。
3. **工具会话里拉起的 GUI 会被回收**（`Start-Process` 后十秒内进程数归零，实测）⇒ 启动必须由人在自己的终端里做。

因此本通道和豆包一样：**脚本只连，不负责起 GUI**。

## 2. 落点

| 项 | 值 |
|---|---|
| 脚本 | `scripts/workbuddy/workbuddy-attach.mjs`（CLI）+ `attach.mjs`（纯函数/选择器）+ `model-policy.mjs`（选型策略）+ `start-workbuddy-debug.cmd`（给作者的启动脚本） |
| 调试端口 | `127.0.0.1:9333`（与豆包的 9331 错开，两个实例能同时开着） |
| 工作目录 | `C:\develop\workspace\AI-writer\wt-2`（固定，见 §3.1） |
| 运行时产物 | `.runtime/workbuddy/attach/<runId>/`（prompt.md / meta.json / reply.md / snapshot-*.json）；会话指针 `.runtime/workbuddy/last-session.json` |
| 会话台账 | `%USERPROFILE%\.workbuddy\workbuddy.db`（sqlite，`sessions` 表；只读打开，App 开着也能读） |
| 兜底通道 | `scripts/workbuddy/workbuddy.mjs`（headless `codebuddy -p`，需要单独登录、拿不到桌面积分，**默认不用**） |

### 2.1 连不上时：把命令交给作者（`NEED_HUMAN_DEBUG`）

`status` / `task` 连不上 9333 时：

- exit code **2**，横幅写到 **stderr**（最后一行是 `NEED_HUMAN_DEBUG`），stdout 只留给 `--json` 之类的机器可读输出；横幅里有三条可直接粘贴的命令（PowerShell / cmd / 仓库脚本）；
- **agent 的硬约定**：立刻把整段横幅（不是摘要）发给作者；最多试 1 次；**不要**自己 spawn WorkBuddy.exe，**不要**杀别人的进程；作者说「启动好了」再重跑原命令；
- 作者用 cmd 启动：`cmd /c scripts\workbuddy\start-workbuddy-debug.cmd`；用 PowerShell：

```powershell
$env:WORKBUDDY_REMOTE_DEBUGGING_PORT='9333'; Start-Process "$env:LOCALAPPDATA\Programs\WorkBuddy\WorkBuddy.exe"
```

> cmd 里写 `set VAR=... && start ...`，粘到 PowerShell 会报 `Start-Process: 参数为 Null 或空`——两套语法别混。

### 2.2 会话怎么选（空间 / 卡片 / 新草稿）

WorkBuddy 侧栏的「空间」= **按 cwd 分组的会话列表**（不是 `workspaces` 表；`workspaces` 里没有 wt-2）。所以：

| 目的 | 脚本动作 |
|---|---|
| 在 wt-2 下开新会话 | 点「空间 `wt-2`」标题右边的 `+`（`button.workspace-new-task-button`）⇒ 得到 `工作区=wt-2` 的草稿；**会话要等第一条消息发出才落库** |
| 复用已有会话 | 点带 `data-conversation-id` 的会话卡片（优先 `last-session.json` / `--session` 指定的 id，找不到退回该空间第一张卡片） |
| 核对真的在 wt-2 | 发送后读渲染层 `window.wb.conversations.currentId` 补记 id，再用 sqlite 的 `sessions.cwd` 复核；不一致直接 `[refuse]`（`--force` 可跳） |

**不要**用 `spawn(WorkBuddy.exe, [cwd])` 开新会话：second-instance 转发不可靠（2026-11-05 两次实验：sqlite 里 12s/30s 都没出现新行）。
**不要**用 `window.wb.conversations.setCurrentConversation(id)` 切会话：返回 `{ok:true}` 但界面不载入（实测 msgs=0）。切会话一律**点卡片**。

## 3. 命令速查

```bash
node scripts/workbuddy/workbuddy-attach.mjs status            # 只读诊断：端口/版本/空间/模型/权限/当前会话/策略
node scripts/workbuddy/workbuddy-attach.mjs sessions          # 读 sqlite 里 wt-2 的历史会话（--all 读全部 cwd）
node scripts/workbuddy/workbuddy-attach.mjs read              # 读当前会话最后一条助手正文（干净文本）
node scripts/workbuddy/workbuddy-attach.mjs markers           # 只读队列标记（## [T1] DONE …）
node scripts/workbuddy/workbuddy-attach.mjs task "任务"        # 派活：默认复用上次会话
node scripts/workbuddy/workbuddy-attach.mjs task "任务" --new  # 在 wt-2 空间开新会话
node scripts/workbuddy/workbuddy-attach.mjs task --file 任务书.md
node scripts/workbuddy/workbuddy-attach.mjs say "继续执行 T2"  # 同一会话追问（不新建）
```

选项：`--session <id>` · `--timeout 秒`（默认 900）· `--json` · `--no-wait` · `--port` · `--model <名字>`（见 §4）· `--cwd <目录>`（默认且只允许 wt-2；指到别处 exit 1）· `--force`（越过归属护栏，排障用，报告里写明）。

退出码：**0** 成功 · **1** 失败 · **2** 未连接（`NEED_HUMAN_DEBUG`）· **3** CLI 缺失（兜底通道）· **4** 等回复超时 · **5** 高峰时段拒绝派活。
和豆包一样：**exit 0 只代表「拿到了稳定回复」，不代表任务做对了**——对错看任务书里的验收条件和 `## [Tn] DONE/BLOCKED` 标记。

### 3.1 固定归属：WorkBuddy 只用 wt-2

| 槽位 | 目录 | 归属 |
|---|---|---|
| slot 0 | `develop` | 主控平台（不一定是 WorkBuddy / DSH） |
| slot 1 | `wt-1`（5181 / 9223） | 豆包 |
| slot 2 | `wt-2`（5182 / 9224） | **WorkBuddy（本通道）** |
| slot 3 | `wt-3`（5183 / 9225） | DeepSeek Harness |

- 归属固定、不抢：WorkBuddy 不许在 develop 或 wt-1 里改文件；`--cwd` 指到别处会**直接 exit 1 拒绝**（`checkPinnedCwd`），只有 `--force` 能越过，且必须在报告里写明原因。
- 分配前分支要 reset 到主线 HEAD（`git -C ../wt-2 reset --hard <main HEAD>`），否则平台在旧提交上干活。
- 细则与「运行态 ≠ 归属」的探测方法见 [worktree-parallel.md §3.1 / §11](worktree-parallel.md)。

## 4. 模型策略（派活前自动生效）

用户 2026-11-05 拍板：**只允许两个模型**，其余一律不选（Hy3 全天免费但能力弱，明确不要）。

| 时段（本地时区） | 模型 | 依据 | 脚本行为 |
|---|---|---|---|
| 每天 23:00–次日 08:00 | **Hy4** | Hy4 preview 夜间限免（腾讯公告，IT之家 2026-10-02 转载） | 自动切到 Hy4，若当前不是 |
| 周一至周五 09:00–12:00、14:00–18:00 | —— | DeepSeek-V4.1-Flash 原价高峰（腾讯云 2026-10-22） | **拒绝派活**：exit 5 + `PEAK_HOURS` 横幅（含立即重跑命令） |
| 其余时段（含周末全天） | **DeepSeek-V4.1-Flash** | 0.11x 倍率 + 非高峰 5 折 | 自动切到 DeepSeek-V4.1-Flash |

- 时段常量集中在 `scripts/workbuddy/model-policy.mjs`（`HY4_FREE_WINDOW` / `DEEPSEEK_PEAK_*`），规则变了只改这一处，文档同步改表。
- `--model <名字>` = 人工授权：绕过高峰拦截；但只接受白名单里的两个名字，其它名字直接 `[refuse]`。
- `WORKBUDDY_MODEL_POLICY=off` 关掉自动选型（仍会拦截非白名单模型）。
- 切模型要**读回验证**：从 `.cr-model-selector__item-name` 精确找项 → 点击 → 再读 `chips.model` 比对，不一致报错，绝不在错模型上派活。
- 高峰拦截是**故意的**：整晚跑长任务不差这几小时，原价烧积分不划算。

### 4.1 派活前的任务书骨架（照抄豆包 §4.1）

```markdown
# 任务：<一句话标题>
## 0. 必读
- 先读：AGENTS.md · docs/agents/workbuddy-channel.md
- 复述三条红线再开工（没复述 = 我直接拒收）：
  1) 只在自己的 worktree（wt-2）里改文件，不碰 develop / wt-1 / wt-3；
  2) 只跑单元测试，禁 `pnpm test` 全量、禁 `test:browser`、禁 `pnpm test:node`（切 ABI 会打断所有槽位的 dev）；
  3) 不提交 git、不改 docs/agents/doc-placement-baseline.json。
## 1. 允许的命令白名单
（逐条列出，例如 `node scripts/check-fast.mjs`、`node scripts/run-tests-electron.mjs <单文件>`）
## 2. 交付
- 改动文件清单（路径 + 一句话理由）
- 你跑过的测试命令与结果原文
- 未做/做不了的项及原因
## 3. 收尾
按队列形态输出：每项 `## [Tn] DONE|BLOCKED|SKIPPED <一句话>`，全部结束输出 `## [QUEUE] EMPTY`。
```

队列形态与 markers 检查点工具同豆包（`markers.mjs` 复用）：一条消息塞有序队列 T1–Tn，脚本用 `workbuddy-attach.mjs markers` 只读解析，**不要靠轮询猜进度**。

## 5. ⛔ 跨 Agent 派活红线：只准单元测试

**WorkBuddy 在 wt-2 里只准跑单元测试**——它和 develop / wt-1 / wt-3 共用同一份 `node_modules` 与原生模块（`better-sqlite3`：Node ABI 127 / Electron 145），跑全量或 `pnpm test:node` 会切 ABI，打断所有槽位正在跑的 `pnpm dev`。

- 允许 ✅：`node scripts/run-tests-electron.mjs scripts/**/__tests__/x.test.mjs`、`node scripts/check-fast.mjs`
- 禁止 ❌：`pnpm test`（无路径全量）、`vitest run` 不带路径、`test:browser`、`pnpm test:node`、并发原生重建
- 判据：**任何会重建 `better-sqlite3` 或跑全量的命令都算违规**。违规的典型症状：别的槽位 dev 突然报 ABI 错误 / EBUSY。
- worktree 内交活只跑 `node scripts/check-fast.mjs`，全量测试回主工作区串行跑（主控负责）。

## 6. 安全与副作用（派活前必须知道）

- **烧积分**：Hy4 夜间 0.00x、DeepSeek 0.11x×5 折才便宜；高峰原价已由脚本拦住。一条长任务动辄几十万 token。
- **共用登录态**：本通道复用作者本人的桌面实例（不加 `--user-data-dir`），会话、文件、积分都在作者账号下；别在会话里贴不该给第三方的材料。
- **会留下记录**：每条会话都进 `workbuddy.db`（`sessions` 表）与侧栏，作者可直接看到；产物落 `.runtime/workbuddy/`（已 gitignore）。
- **权限**：当前实测实例是「允许完全访问」（`permission_mode=fullAccess`）⇒ 会话里能跑命令、改文件。派活时务必在任务书里写清允许的命令白名单。
- **`--force`**：跳过 cwd 核对/白名单拦截，只在确认过目标目录时用；用完记得在报告里说明。
- **不自动杀进程**：脚本不会关闭/重启作者的 WorkBuddy；要重启用托盘退出。

## 7. 已验证 / 未验证

已验证（2026-11-05）：
- CDP 连接：`/json/version` 返回 `WorkBuddy/5.9.3`、Chromium `138.0.7204.251`；单 page target（`app.asar/renderer/index.html`）。
- 只读诊断 `status`：端口/版本/编辑器/runState/chips/当前会话/最近会话全通。
- 中文 `Input.insertText` + 真实鼠标点 `button[aria-label="发送"]` + 从 `.cr-agent .cr-markdown` 取干净正文（无 `WorkBuddy/已完成/共消耗` 噪音）。
- 复用会话（点卡片）与开新会话（点空间 `+`）两条路都跑通；新会话落库 `cwd=C:/develop/workspace/AI-writer/wt-2`。
- 模型自动切换：Hy3 → Hy4 切换 + 读回校验通过。
- **端到端真跑**：`task "只回复两个字母 OK，不要别的内容" --new --timeout 240` → exit 0，25s，reply=`OK`，产物四件套齐全（prompt/meta/reply/snapshot），末尾 markers 为空。

未验证（要用先测）：
- 长任务（>10 分钟）在轮询下是否会被 UI 虚拟滚动影响；`waitForSettled` 靠 `agentCount` 增长 + 正文两次一致，超长输出可能需要调 `--timeout`。
- 高峰拦截（exit 5）只在单元测试里覆盖过时段判断，尚未在真实工作日高峰实跑。
- 同时开两条 WorkBuddy 会话并发派活：本通道假设「当前只有一条会话在跑」，并发需另做隔离。

## 8. 失效判据与恢复

| 症状 | 先查 |
|---|---|
| `status` exit 2 / `NEED_HUMAN_DEBUG` | 9333 没监听：按 §2.1 让作者重启 Debug 实例；确认旧实例已在托盘退出 |
| `/json/version` 通但 `hasEditor=false` | 页面还在启动或开的是别的窗口；等 5s 重跑 `status` |
| 「侧栏找不到空间 wt-2 的新建按钮」 | 该目录还没在 WorkBuddy 里打开过：让作者打开一次 wt-2。**不要**换目录——归属固定，`--cwd` 指到别处会被拒 |
| 「模型选择器里没有 X」 | 模型下架/改名：`status` 看 `chips.model`，用 `--model` 试现名，再更新 `model-policy.mjs` 白名单 |
| 发送后输入框还有内容 | 发送按钮被挡（弹层/草稿）：`read` 看有没有回复；重跑会先清空编辑器 |
| 等回复超时（exit 4） | 模型在长思考：加大 `--timeout`；或 `read` 看看是否已经答完只是没触发稳定信号。**2026-11-05 踩过**：界面早就答完却一直 exit 4，根因是收尾基线取在「打开新草稿之前」的快照上（`agentCount=1`），`grew` 永远 false ⇒ 已改成打字后取基线 + `messageCount +2` / 正文变化兜底（`isSettledSignal`，有单测） |
| 回复里混进 `WorkBuddy/已完成/共消耗` | `.cr-markdown` 选择器变了：改 `attach.mjs` 的 `SELECTORS.agentMarkdown`，补一条单测 |
| 点击全都不生效 | WorkBuddy 升级后 CSS Modules hash 变了：全站没有 `data-testid`，只能靠 aria-label / 语义前缀；先跑 `status` 核对 `buttonLabels` |

## 9. 兜底通道：官方 headless CLI（`codebuddy -p`，独立进程）

适用场景：不想让作者开着 GUI、或要一个「跑完就退、不碰桌面」的一次性进程。代价：**要单独登录一次**，而且账号态与桌面端不互通 ⇒ 用不到桌面端积分。两条路的关系见 §0。

### 9.1 落点与安装

| 项 | 值 |
|---|---|
| npm 包 | `@tencent-ai/codebuddy-code`（bin：`codebuddy` / `cbc` / `codebuddy-code`） |
| CLI 本体（脚本用这个绝对路径） | `%APPDATA%\npm\node_modules\@tencent-ai\codebuddy-code\bin\codebuddy`（**无扩展名的 Node 脚本**） |
| 用户目录 | `~/.codebuddy/`（sessions / settings.json / logs / projects / plugins） |
| 桌面端自带 CLI | `%LOCALAPPDATA%\Programs\WorkBuddy\resources\app.asar.unpacked\cli\bin\codebuddy`（2.165.0，**与 npm 版账号态不互通**，别混用） |
| 运行产物 | `<repo>/.runtime/workbuddy/runs/<runId>/` |

```bash
npm install -g @tencent-ai/codebuddy-code
node "$APPDATA/npm/node_modules/@tencent-ai/codebuddy-code/bin/codebuddy" --version   # → 2.179.3
```

`codebuddy` **不在 PATH**，npm 的 `codebuddy` shim 在 Git Bash 里还是坏的（陷阱 2）⇒ 脚本自己解析绝对路径、用当前 `node` 当解释器，调用方不需要配 PATH。

### 9.2 命令速查（`scripts/workbuddy/workbuddy.mjs`）

| 命令 | 作用 |
|---|---|
| `probe` | 报 CLI 路径 / 版本 / 工作目录 / **是否已登录**（未登录退出码 2） |
| `run "任务"` | 跑一次；`--cwd <dir>`、`--timeout <分钟>`（默认 15）、`--json` |
| `run --file 任务书.md` | 长任务书从文件读（不经 shell 转义，推荐） |
| `login` | 起 `--serve` → 打印并打开 Web UI 登录页 → 轮询登录成功；`--port`（默认 8099）、`--wait`（默认 600s）、`--no-open` |
| `run --dry-run` | 只打印将执行的命令与参数 |

透传 CLI 选项：`--model` / `--fallback-model` / `--permission-mode` / `--max-turns` / `--append-system-prompt` / `--resume <sessionId>` / `--continue` / `--format text|json|stream-json`；逃生阀 `--no-skip-permissions`、`--allow-git`。

### 9.3 权限模型

1. **`-y / --dangerously-skip-permissions`**：非交互必需，否则每个要授权操作都会卡住等人点；脚本默认带。
2. **`--permission-mode`**：`default | acceptEdits | plan | dontAsk | auto | bypassPermissions`。
3. **`--allowedTools` / `--disallowedTools`**：语法同 Claude Code（`"Bash(git:*)" Edit`）。**脚本默认注入 `--disallowedTools "Bash(git:*)"`**：提交权归主 agent（与 Copilot 通道同一条铁律）。
4. **`CODEBUDDY_IS_SANDBOX=1`**：连 HIGH/CRITICAL 都不问、全放行。**高危，本通道不用**，只考虑一次性容器。

注意：`-y` 下高危工具仍可能弹确认；非交互时表现为「任务卡住 / 提前结束」，不是 CLI 坏了。

### 9.4 工具名与副作用口径

`--output-format stream-json` 的 init 事件里的真实名单：`Agent` `Read` `Write` `Edit` `Bash` `PowerShell` `Glob` `Grep` `EnterPlanMode` `ExitPlanMode` `TaskCreate` `TaskGet` `TaskUpdate` `TaskList` `TaskStop` `TaskOutput` `WebFetch` `WebSearch` `Skill` `SkillManage` `Component` `Mods` `AskUserQuestion` `AskUserForStructuredInput` 等。

| 工具 | kind | 取路径字段 |
|---|---|---|
| `Write` | `create` | `file_path` |
| `Edit` / `MultiEdit` | `edit` | `file_path` |
| `NotebookEdit` | `edit` | `notebook_path` |
| `apply_patch` | `patch` | `path` |

**不要信 agent 的自述**：改了什么看 `tool_use` / `tool_result`，`result.json` 的 `fileEdits` 是脚本折算的。

### 9.5 事件结构

每行一个 JSON：

| 事件 | 关键字段 | 用途 |
|---|---|---|
| `system/init` | `session_id` `model` `cwd` `tools[]` `apiKeySource` | 谁、在哪、有哪些工具 |
| `system/status` | `status` | 心跳（可忽略） |
| `assistant` | `message.content[]`：`text` / `tool_use{id,name,input}` | 工具调用来源 |
| `user` | `message.content[]`：`tool_result{tool_use_id,is_error,content}` | 成败、权限拒绝 |
| `result` | `subtype` `is_error` `result` `num_turns` `duration_ms` `total_cost_usd` `permission_denials` | 终局 |

产物：`stdout.log` / `events.jsonl` / `result.json`（含 `fileEdits` / `deniedTools` / `outcome`）。**`result.json` 才是可核对凭证**，stdout 只当证据。

### 9.6 已知陷阱（都是本机实测撞出来的）

1. **未登录时退出码仍是 0** ★：stdout 只有 `Authentication required. Please use /login command to sign in`，CLI 当正常结束。判未登录**只能看文案**（`cli.mjs#detectAuthRequired`），`run` 因此返回 2。
2. **npm 的 `codebuddy` shim 在 Git Bash 里是坏的**：exec 到 `…/npm/node_modules/node/bin/node` 后报 `This: command not found`。必须 `node <pkg>/bin/codebuddy`。
3. **prompt 不能进 argv**：Windows 上 `shell:true` 会把换行 / `&` / `|` / `%` 交给 cmd.exe 解释 ⇒ prompt 走 stdin，长任务书用 `--file`。
4. **别 attach 桌面端的 GUI sidecar**：桌面端会拉起 `codebuddy --serve`（随机端口 + 随机密码 + `/api/v1/*`），密码只在进程环境里；`POST /api/v1/jobs` 会继承父进程 `--port` 撞端口（实测把 GUI sidecar 搞挂）。要做任务面请走 attach 的 CDP 路（§1–§8），不要打这个 HTTP 口子。
5. **桌面端登录态不能复用**：token 在 `%LOCALAPPDATA%\CodeBuddyExtension\Data\Public\auth\workbuddy-desktop.info`，值是 `$wbEncrypted` 信封（AES-256-GCM），解它要借 `WorkBuddy.exe` 的 Electron binding；把 `CODEBUDDY_CONFIG_DIR` 指到 `~/.workbuddy` 也解不开认证。**不偷 token，走一次性登录**（§10）。
6. **`--output-format json` 实际仍按事件流输出**：拿到的是多行事件（`system/init` → `assistant` → `result`），解析器按「逐行 JSON、非 JSON 行进 invalidLines」处理。

### 9.7 已验证 / 未验证（headless）

已验证（2026-11-05，有输出为证）：npm 装包 2.179.3；`probe` 解析路径/版本/`cwd=wt-2`，未登录时退出码 2；`run` 未登录路径产物完整落盘、事件含 `system/init`（`apiKeySource: copilot.tencent.com`、`model: hy4-preview`）与 `result{subtype:error_during_execution}`；`login` 能起 `--serve`、从 stdout 抓到 `Web UI http://127.0.0.1:<port>/?password=…`、超时后杀树且端口释放；`--serve` 密码落 `~/.codebuddy/settings.json`；单测 38 条全绿。

未验证（要用先测）：登录后的端到端真跑（期望 exit 0 + `result.subtype=success`）、Web UI SSO 是否把凭据写回 `~/.codebuddy`、`--resume`/`--continue`/`--max-turns`/`--model`、并发两个 `run` 是否互相干扰。

## 10. 认证：一次性人工登录（headless 专用）

```bash
node scripts/workbuddy/workbuddy.mjs login     # 打印并打开 Web UI，登录后自动返回
# 备选：直接跑 codebuddy 进 TUI，输入 /login，登录完退出
```

- 未登录时 `run` 返回 **2 + `NEED_HUMAN_LOGIN`**（与豆包 `NEED_HUMAN_LAUNCH` 同构）：**不要自动重试**，等人。
- CLI 取凭据顺序（bundle 里读出来的）：`CODEBUDDY_AUTH_TOKEN` 环境变量 → `ACC_PRODUCT_CONFIG` 的 `custom-token` → settings 文件 `env.CODEBUDDY_AUTH_TOKEN`。**只登录一次**，之后非交互调用直接可用。
- 不要为了「免登录」去解 `$wbEncrypted`（陷阱 5）：复刻 Electron binding，版本一升就碎，还等于绕过人家账号体系。

## 11. 社区已有方案与取舍（「优先社区」的调研结论）

| 项目 | 是什么 | 为什么没直接用 |
|---|---|---|
| `LinHaiJ/workbuddy-mcp`（npm `workbuddy-mcp` 0.2.0, MIT） | 极简 MCP server，只暴露 `run_workbuddy_task`，内部 `spawn codebuddy -p` | 形态是 **MCP 宿主插件**，本项目通道要「CLI 脚本 + 手册」才和 Copilot/豆包同构；**但两条硬经验照搬**：prompt 走 stdin、超时用 `taskkill /T /F` 杀进程树 |
| `banana770/workbuddy-proxy` | 把桌面端已登录账号的模型转成本地 OpenAI/Anthropic 网关 | 只复刻**模型 API**，不是 agent 通道，也没有文件/终端副作用可校验 |
| `3304711297/workbuddy2api` | Tauri 控制台，浏览器授权后提供三种协议网关 | 同上：把 WorkBuddy 当模型用，不是把活派给它 |
| `Ianzhyh/workbuddy-to-dsh`（MIT） | DSH 插件，解桌面端加密凭据后复用账号 | 解 `$wbEncrypted` 脆（陷阱 5）；我们改走官方 attach / 官方登录 |
| `XQ-zheng/workbuddy-daily-credits` | 自动领积分 / 打卡，长效令牌自续期 | 跟「派活」无关；只借它证明「令牌可长期续期」，本通道仍走人工 |
| `hankniu77/dsh-botcrew` | DSH 群聊里接 WorkBuddy/QwenWork 的成员面板 | 是聊天编排层，不是进程级通道；可作上层编排参考 |
| 官方 `workbuddy.ai/docs/cli/headless` · `codebuddy.ai/docs/cli/http-api` | headless 模式与 HTTP API 规范 | **headless `-p` 就是正路**（§9）；HTTP API 只用于 `login` 的 Web UI，不做任务面 |

结论：**没有现成的「桌面 GUI + 已登录态 + 可编排 CLI」项目**，所以分两条自研薄层——attach（复用桌面登录态与积分，§1–§8）与 headless（独立进程，§9）——而不是继续找轮子。

## 12. 相关文档

- [豆包通道](doubao-channel.md) —— 本通道的范式来源（NEED_HUMAN_LAUNCH / 任务书骨架 / markers / 只准单测）
- [Copilot 通道](copilot-channel.md) —— 另一条外部 agent 通道（独立 CLI 进程）
- [worktree 并行开发](worktree-parallel.md) —— 槽位归属表、占用探测、并行红线
- [任务看板通道](task-board-channel.md) —— 建卡 / 认领 / 复核
- 官方文档：<https://www.workbuddy.ai/docs/cli/headless> · <https://www.codebuddy.ai/docs/cli/http-api>

## 13. 能力画像与派活分工（2026-11-05 实测，Hy4 夜间档）

> 本节是给后续 Lead 的「不用每次重查」结论。样本=一次 5 小时联动里的 5 批任务（A-1.1 基线脚本、A-1.2 logprobs 裁定、A-1.0 指标表、C5 独立复算 + 脚本 ABI 收口、新旧正文指标对照）。

**实测表现**
- 速度：单批 7–14 分钟（含报告）；批内 2 张卡约 10 分钟。
- 质量：报告自带「改动清单 / 执行记录 / 原始输出 / 未做的事」四段；给证据用 `文件:行` 与命令输出；主动报环境不一致（例：wt-2 的 `better-sqlite3` 是 Node 22 ABI 127，与 `AGENTS.md:36` 的 Electron 145 描述不符，未擅自重建 ABI）；不确定项单列「待裁决」不擅动。
- 边界遵守：只改 `wt-2`；未跑全量测试、未做 git 写、未写作者库、未碰看板。

**适合派给它**
- 代码实现 / 脚本 / 接口探测 / 回归验证 / 独立复算 / 环境诊断（有明确验收与「只读或白名单」约束时最稳）。
- 长任务拆成「带验收的批 + markers 队列」形态；任务书里写清「先复述红线再开工」有效。

**不适合直接给它**
- 看板写操作（本轮统一由 Lead 代录：claim→tag review→review --pass，避免执行者自结算）。
- 需要跑 APP 实例 / 切 ABI / 全量测试的活（红线禁止）。
- 纯文学判断（可做，但价值低于豆包，见 [豆包通道](doubao-channel.md) §10）。

**派活小表（与豆包共用）**

| 活的性质 | 给谁 | 理由 |
|---|---|---|
| 代码、脚本、接口、复算、环境验证 | **WorkBuddy / Hy4** | 工具与代码执行稳，报告证据链完整 |
| 文学判断、读者视角、标注、研究综述、中文长文 | **豆包** | 文本质量与中文表达强，速度快 |
| 需要生成文本的中间步骤 | **豆包（新 Ask 会话）** | 不消耗额度；不占它当前任务窗口，Lead 排队调度 |
| 真正的架构裁定 / 需要作者拍板 | **Lead → 作者** | 两个 agent 都不该替作者定 |
