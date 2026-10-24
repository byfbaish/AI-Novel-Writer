# 派活给 GitHub Copilot CLI（协作通道操作手册）

> 状态：已生效（2026-10-25）· 已验证版本 `GitHub Copilot CLI 1.0.104-3`（winget `GitHub.Copilot.Prerelease`）
> 用途：**让本机任何 agent 会话都能把活派给一个独立的 Copilot 进程**，不必再依赖 VSCode 窗口、不必人工按发送。
> 关系：agent 定义在 [`.github/agents/`](../../.github/agents/)（入库，随仓库走）；本文只记**怎么调用、怎么限权、哪些已验证**。
> 缘起：2026-10-25 打通。此前是「写规则文件 → 人工切窗口 → 人工按发送 → 人工复制结果」的单向文件流，不是可编排通道。

## 0. 一句话读法

`copilot -p "<指令>" --agent <名字> --allow-all-tools --deny-tool 'shell(git:*)' --trust-folder`

它在**独立进程**里跑、有自己的 session（`client_name: github/cli`），**不需要 VSCode 开着**。

## 1. 落点与 PATH

| 项 | 值 |
|---|---|
| 符号链接（**日常用这个**） | `%LOCALAPPDATA%\Microsoft\WinGet\Links\copilot.exe` |
| 包体 | `%LOCALAPPDATA%\Microsoft\WinGet\Packages\GitHub.Copilot.Prerelease_*\copilot.exe` |
| 运行时包 | `%LOCALAPPDATA%\copilot\pkg\win32-x64\<version>` |
| session 与日志 | `~/.copilot/`（`session-state/` · `logs/` · `config.json` · `session-store.db`） |

**PATH**：`…\WinGet\Links` 已**前置**到 User PATH（2026-10-25）。新终端里 `copilot` 直接可用。

> ⚠️ **坑一：VSCode 自带的 `bin\copilot-shim\copilot.exe` 不是 CLI 本体**，只是个引导器。
> 实测在装好真 CLI 之后它**仍然报** `GitHub Copilot CLI was not found`。它原本排在 User PATH 前面会挡住真 CLI，
> 已靠前置 `WinGet\Links` 压过去。**别拿 shim 去诊断 CLI 问题。**

## 2. 参数速查（只列实测过或官方文档明确的）

| 参数 | 作用 | 备注 |
|---|---|---|
| `-p, --prompt <text>` | 非交互执行，跑完退出 | 核心入口 |
| `-s, --silent` | 只输出 agent 回答，不带统计 | 便于脚本消费 |
| `--agent <name>` | 指定自定义 agent | **认仓库 `.github/agents/*.agent.md`** |
| `--allow-all-tools` | 自动批准所有工具 | **非交互模式必需**，否则会卡在确认 |
| `--deny-tool <pattern>` | 拒绝某类操作 | **优先级高于 `--allow-all-tools`**（见 §3） |
| `--available-tools` / `--excluded-tools` | 决定模型**能看见**哪些工具 | 比 deny 更强的硬过滤 |
| `--trust-folder` | 信任工作目录配置（单次，不落盘保存） | prompt 模式下加载 `.github/` 配置需要 |
| `--output-format json` | 输出 JSONL（一行一事件） | 见 §5 |
| `-C <dir>` / `--add-dir <dir>` | 换工作目录 / 加额外目录 | |
| `--fleet` | 并行子代理编排 | **未实测** |
| `--share <path>` | 跑完导出 markdown 会话 | |
| `-r, --resume` / `--continue` | 续用旧 session | 未实测 |

`copilot help <topic>` 有九个主题：`config` `commands` `limits` `environment` `logging` `monitoring`
`permissions` `providers` `billing` `sandbox`。**权限问题一律先读 `copilot help permissions`。**

## 3. 权限模型（这一节决定"能不能放心给它干活"）

三层，从强到弱：

1. **能看见哪些工具** —— `--available-tools`（白名单）/ `--excluded-tools`（黑名单）。
   被这层过滤掉的工具，模型**根本看不到**。
2. **agent 自身声明的 `tools:`** —— `.agent.md` frontmatter。**实测被强制执行**：
   只声明 `read`/`search` 的 `DocGuard`，即使加了 `--allow-all-tools` 也跑不了终端（原话「我没有可用的终端」）。
3. **审批规则** —— `--allow-tool` / `--deny-tool`。**拒绝规则优先于 `--allow-all-tools`**。

`--allow-tool` / `--deny-tool` 的模式语法（`kind(argument)`）：

| kind | 写法 | 匹配什么 |
|---|---|---|
| `shell` | `shell(git:*)` · `shell(npm install)` · `shell()` | 命令；`:*` 是**前缀通配**（`git push` 命中，`gitea` 不命中） |
| `write` | `write(.env)` · `write(C:/abs/path)` | **编辑类工具**（不含 shell 重定向）；相对路径按尾部组件匹配 |
| `url` | `url(https://*.github.com)` | shell 与 web-fetch 的 URL 访问；协议敏感 |
| `<mcp>` | `MyMCP(my_tool)` | 某 MCP 服务器的某个工具 |

**结论**：「给编辑权、禁 git」可以硬钉，不靠模型自觉：

```bash
--allow-all-tools --deny-tool 'shell(git:*)'
```

## 4. 工具别名映射（实测，别再猜）

`.agent.md` 的 `tools:` 用 VSCode 风格名字，CLI 内部是另一套（带 `functions.` 前缀）。实测映射：

| 写这个 | 实际调到的 | 验证方式 |
|---|---|---|
| `read` | `view` | 读文件时 `tool.execution_start.data.toolName === 'view'` |
| `edit` | **`apply_patch`** | 改文件时 `toolName === 'apply_patch'`，`data.fileEdits` 记路径 |
| `create` | 文件创建 | 建新文件成功 |
| `execute/runInTerminal` | 终端执行 | DocRunner 真跑起三个检查脚本 |
| `search` | `grep` / `glob` / `semantic_code_search` | 搜索可用 |

**曾担心"这些是 Local harness 别名、在 Copilot harness 下会静默失效"——对 1.0.104-3 不成立**，映射正常。
若某天失效，症状是「agent 说自己没有某工具」，那时先查映射，别先怀疑配置写错。

完整工具名可用一句话问出来（模型能看到自己的工具表）：

```bash
copilot -p "只列出你当前可用的工具名称，每行一个，不要解释，不要调用任何工具。" -s
```

当前拿到的有：`view` `create` `edit` `grep` `glob` 终端 `search_code_subagent` `semantic_code_search`
`task` `read_agent` `write_agent` `web_fetch` `skill` `sql` 以及一批 `github-mcp-server-*`。

## 5. JSONL 输出结构（要程序化消费才需要）

`--output-format json` 逐行一个事件。实测出现的事件类型：

```
session.mcp_server_status_changed / session.mcp_server_tools_loaded / session.skills_loaded
session.custom_agents_updated / session.auto_mode_resolved / session.mcp_servers_loaded
session.tools_updated / user.message
assistant.turn_start / model.call_start / assistant.tool_call_delta / model.call_finished
assistant.message / assistant.message_delta / assistant.reasoning / assistant.idle
tool.execution_start / tool.execution_complete
session.usage_checkpoint / result
```

关键取数位置：

- 工具名 → `data.toolName`（`tool.execution_start`）
- 实际改动 → `data.fileEdits[]`（`tool.execution_complete`，含 `path` / `kind`）
- 工具参数 → `data.arguments`（对象或 patch 文本）
- 成败 → `data.success`

**这就是"可校验副作用"的来源**：不用信它的自述，直接看 `fileEdits`。

## 6. 现状：谁在库里、谁有什么权限

| agent | 文件 | 权限 | 状态 |
|---|---|---|---|
| `DocGuard` | `.github/agents/doc-guard.agent.md` | 只有 `read` / `search` | 入库 |
| `DocRunner` | `.github/agents/doc-runner.agent.md` | `read` / `search` / `edit` / `create` / 终端 | 入库 |

**两条铁律（写在 agent body 里，也写在这里）**

1. **agent 不许提交 git。** 提交权归主 agent：它复核 diff 后自己提交。工具层再加 `--deny-tool 'shell(git:*)'` 兜底。
2. **agent 不许改 `docs/agents/doc-placement-baseline.json`**（尤其 `--update-baseline`）——
   那是让检查"变绿"的捷径，会掩盖回归。违规只能靠修文档减少。

## 7. 已验证 / 未验证（分清楚，别把没测的当结论）

**已验证（2026-10-25，均有输出为证）**

- 非交互启动、退出码、`-s` 输出
- 独立 session：`session-state/<uuid>/workspace.yaml` 里 `client_name: github/cli`（不是 `vscode-agent-host`）
- `--agent` 加载仓库 agent 定义；`tools:` 白名单被强制执行
- `edit` → `apply_patch` 真改文件；`read` → `view`
- `--deny-tool 'shell(git:*)'` 下 `git status` 被拒，且 agent 如实报告「该命令被执行限制拒绝」
- `--output-format json` 的事件结构与取数字段
- 全程零副作用：`git status` 空、基线 mtime 未变

**未验证（要用先测，别假设）**

- 并发跑多个 session
- `--fleet`（并行子代理）
- `-r/--resume` / `--continue`
- `--share` / `--share-gist`
- MCP 相关参数（`--add-github-mcp-tool` 等）

**一处无法分离的疑点**：`git status` 被拒，究竟是 `--deny-tool` 拦的还是 agent body 的自律，两者同时生效时无法区分。
要分离须单独跑：只给 deny 不给 body 约束（或反之）。

## 8. 版本风险

这版是 **Prerelease**。参数语义可能随版本变。三条应对：

1. 出问题先 `copilot --version`，再 `copilot help permissions` 对照本文。
2. 本文所有结论都标了版本号。跨版本复用前先重测 §7 的「已验证」清单。
3. `copilot update` 可升级；升级后立刻重跑一次最小烟测（`-p "只回复两个字：收到" -s`）。

## 9. 相关文档

- 文档纪律与放置规则：[`docs/README.md`](../README.md) §3 · [`documentation-charter.md`](./documentation-charter.md)
- 「AGENTS.md 入库」的决定：[ADR-0025](../adr/0025-track-agents-md-and-copilot-channel.md)
- 通道打通与实测原始记录：本机记忆 `2026-10-25.md`（不入库）
