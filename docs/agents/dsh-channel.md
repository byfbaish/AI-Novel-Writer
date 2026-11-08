# 给 DeepSeek Harness 派活（协作通道操作手册）

> **状态：已退役（2026-11-09）· DSH 升为「中控」**。人现在在主工作区 `develop` 里直接跟 DSH 对话，不再把活派给无头 DSH；`wt-3` 已清空待回收。本文只作历史记录保留（2026-11-08 实测 DSH `0.1.1-rc.2`，模型 `Kilo Nemotron 3.5 Lightning · Our Free Model`），退役原因与三条首仗教训见 §11。
> 用途（历史）：把 AI-writer 仓库里的活派给本机 DSH。**只有一条路：一次性 headless 任务**。
> 关系（历史）：与 [豆包通道](doubao-channel.md)、[WorkBuddy 通道](workbuddy-channel.md)、[Copilot 通道](copilot-channel.md)、[任务看板通道](task-board-channel.md) 平级；`wt-3` 曾是 DSH 的固定格（[归属表](worktree-parallel.md#31-槽位归属固定不是谁空谁用)）。
> 社区调研：已验证 `dsh-as-mcp` 被版本闸门卡死、`ds-bot` 内置连接器机制不适用，取舍见 §9。

## 0. 一句话读法

```powershell
# 1) 诊断（只读；会跑一次 --dump-config 读回实际模型）
node scripts/dsh/dsh-task.mjs status

# 2) 派活（cwd 钉死 wt-3、模型钉死目标模型）
node scripts/dsh/dsh-task.mjs task "只回复 OK，不要调用任何工具"
```

`status` 全绿才派活。**「实际生效模型」那一行是用 `--dump-config` 读回来的组合结果，不是 profile 默认值** —— 这一行不符，脚本会拒绝派活（exit 1）。

## 1. 为什么是 headless 一次性任务

DSH 有三种可被外部驱动的形态，只有第三种成立：

| 形态 | 结论 | 理由 |
|---|---|---|
| 桌面端 GUI + CDP | ❌ 不走 | 桌面端是给人用的；驱动 GUI 要处理渲染层选择器，DSH 升级即碎。豆包/WorkBuddy 走 CDP 是因为**它们没有 CLI**，DSH 有 |
| `dsh-as-mcp` 插件 | ❌ 卡死 | 见 §9：peer 要求 `@deepseek-ai/dsh >= 0.1.5-rc.1`，本机 `0.1.1-rc.2` |
| **`--profile headless`** | ✅ **本通道** | 官方形态：答一次、打印最终助手消息、退出。退出即交活，无需管理长驻进程 |

headless 的两个关键性质（读源码 + 实测确认）：

1. **工作目录 = `process.cwd()`**，没有 `--cwd` 参数 ⇒ 归属靠 spawn 时的 `cwd` 钉死，不靠调用者记得切目录。实测：让它报自己的 cwd，答 `C:\develop\workspace\AI-writer\wt-3`。
2. **默认模型来自 profile 的 `agent-default-model`**，headless 没有 `--model` 参数 ⇒ 模型锁定只能走 `--patch`（§4）。

## 2. 落点

| 项 | 值 |
|---|---|
| CLI | `scripts/dsh/dsh-task.mjs`（`status` / `task` / `markers`） |
| 模型覆盖层 | `scripts/dsh/model.patch.yml`（`--patch` 专用，**不改任何 profile 配置**） |
| DSH 可执行 | `%APPDATA%\npm\node_modules\@deepseek-ai\dsh\lib\bin.js`（可用 `DSH_BIN` 覆盖） |
| 工作目录 | `C:\develop\workspace\AI-writer\wt-3`（固定，见 §3.1） |
| 运行时产物 | `.runtime/dsh/<runId>/`（`prompt.md` / `reply.md` / `meta.json`，有 stderr 时另存 `stderr.log`） |
| 标记解析 | 复用 `scripts/doubao/markers.mjs`（同一份实现，不复制） |

## 3. 命令速查

```powershell
node scripts/dsh/dsh-task.mjs status                    # 只读诊断
node scripts/dsh/dsh-task.mjs status --json             # 机器可读
node scripts/dsh/dsh-task.mjs task "任务文本"
node scripts/dsh/dsh-task.mjs task --file 任务书.md
node scripts/dsh/dsh-task.mjs task "任务" --timeout 1800 # 长任务（默认 900s）
node scripts/dsh/dsh-task.mjs markers --file reply.md    # 只读：抽 ## [Tn] DONE|BLOCKED
node scripts/dsh/dsh-task.mjs markers --json            # 也可从 stdin 读
```

选项：`--file` · `--timeout 秒` · `--json` · `--cwd`（默认且只允许 wt-3）· `--force`（越过归属护栏，排障用，报告里写明）。

退出码：**0** 成功 · **1** 失败 / 模型不符 · **2** 未就绪（dsh 缺失、wt-3 不在、patch 无效）· **3** 归属拒绝 · **4** 超时 · **5** 用法错误。

> **exit 0 只代表「拿到了一次正常结束的回复」，不代表任务做对了**——对错看任务书里的验收条件和 `## [Tn] DONE/BLOCKED` 标记。这与豆包、WorkBuddy 两条通道同一条判据。

### 3.1 固定归属：DSH 只用 wt-3

| 槽位 | 目录 | 端口 | 归属 |
|---|---|---|---|
| slot 0 | `develop` | 5180 / 9222 | 主控平台（人 + Lead harness） |
| slot 1 | `wt-1` | 5181 / 9223 | 豆包 |
| slot 2 | `wt-2` | 5182 / 9224 | WorkBuddy |
| slot 3 | `wt-3` | 5183 / 9225 | **DeepSeek Harness（本通道）** |

- 归属固定、不抢：DSH 不许在 `develop` / `wt-1` / `wt-2` 里改文件。`--cwd` 指到别处**直接 exit 3**，只有 `--force` 能越过且在报告里写明。
- 分配前分支要 reset 到主线 HEAD，否则平台在旧提交上干活（`git -C ../wt-3 reset --hard <主线 HEAD>`；主线分支叫 `exp/resource-ledger`，别写 `develop`）。
- 「运行态 ≠ 归属」：5183 / 9225 全空也不代表可以占用 —— 归属查这张表，不查端口。

## 4. 模型策略：用 `--patch` 钉死，不碰 profile

**目标模型**（作者 2026-11-08 指定）：

```
provider: magpie
model:    our-free-model/our-free-model/nvidia/nemotron-3.5-lightning:free
name:     Kilo Nemotron 3.5 Lightning · Our Free Model
contextWindow 1,000,000 / maxTokens 65,536 / 推理等级保持 Default（不额外传 reasoningEffort）
```

**为什么必须显式钉**：headless profile 的 `agent-default-model` 是 `deepseek/deepseek-flash`。靠 profile 默认值派活 = 在错模型上派活。

**为什么用 `--patch` 而不是改 profile**：

- `~/.dsh/profiles/*/cordis.patch.yml` 是作者自己的补丁层，改它等于改全局配置，且 Web / headless 两个 profile 另有用途（2026-11-08 作者裁决：**桌面 `desktop` 是底座，web / headless 一律不碰**）。
- `dsh --patch <path>` 是「在 profile 层之后追加的一份覆盖」，**只对本次进程生效、不落盘任何用户配置**。这正是通道要的形态。

实测对照（同一命令，只差 `--patch`）：

| 命令 | `agent-default-model` |
|---|---|
| `--profile headless --dump-config` | `magpie` / `deepseek/deepseek-flash` |
| `--profile headless --patch scripts/dsh/model.patch.yml --dump-config` | `magpie` / `our-free-model/…/nemotron-3.5-lightning:free` |

**派活前必读回校验**：`task` 每次都会跑一次 `--dump-config`，把组合后的 `provider/model` 读回来比对，不一致 → exit 1，**不派活**。这比「相信 patch 文件写对了」多一层：patch 语法若随 DSH 升级变化，这一步会先炸，而不是让你在错模型上白跑一轮。

改模型只改 `scripts/dsh/model.patch.yml` 一处，文档同步改本节。

### 4.1 派活前的任务书骨架（照抄豆包 §4.1）

```markdown
# 任务：<一句话标题>

## 0. 必读
- 工作目录固定 `C:\develop\workspace\AI-writer\wt-3`，不要写主工作区
- 只准单元测试：`npx vitest run <path>`；禁全量测试、禁 `pnpm test:node`、禁起应用实例
- 不改全局配置（config.json / models.json / recent-projects.json）
- 不提交 git、不推送

## 1. 允许的命令白名单
- <命令>

## 2. 交付
- 改动清单（文件:行）
- 执行记录（每条命令的原始输出）
- 未做的事 / 待裁决

## 3. 收尾
- 最后一行写 `## [T1] DONE <一句话>` 或 `## [T1] BLOCKED <卡在哪>`
```

任务书用 `--file` 传入。派完用 `markers --file .runtime/dsh/<runId>/reply.md` 抽标记核对。

## 5. ⛔ 跨 Agent 派活红线

与 [worktree-parallel.md §7](worktree-parallel.md) 同源：

1. **只准单元测试**（`vitest run <path>`）。任何要起应用进程、占固定端口、碰 `user-data-dir`、碰 Electron 单实例锁的一律禁止。
2. **禁 `pnpm test:node`** —— 它会把共享 store 的 `better-sqlite3` 切回 Node ABI，打断所有槽位正在跑的 Electron dev。
3. **禁并发触发原生重建**。
4. **禁改全局配置**（`config.json` / `models.json` / `recent-projects.json`）。
5. **不提交、不推送、不 rebase 别人的分支**；合流由 Master 在主工作区做。
6. 全量测试只在主工作区串行跑；交活前只跑 `node scripts/check-fast.mjs`。

## 6. 安全与副作用（派活前必须知道）

| 项 | 事实 |
|---|---|
| 计费 | 走 `magpie` provider 的本地网关（`http://127.0.0.1:3425/v1`），与桌面端同一账号 |
| 会话落盘 | 每次 `task` 都会在 `~/.dsh` 下产生一条 headless 会话记录，属正常痕迹 |
| 与桌面端并存 | headless 是独立进程，**不需要**关桌面端；但两者同时改 `wt-3` 会打架 —— 归属只保证目录不串，不保证并发安全 |
| 产物 | 一律落 `.runtime/dsh/<runId>/`，不入库（`.runtime/` 已 gitignore） |
| 超时 | 超时先 `SIGTERM`，3 秒后补 `SIGKILL`（Windows 上子进程树可能残留，必要时手工清） |

## 7. 已验证 / 未验证

**已验证（2026-11-08，本机实跑）**

| 检查 | 结果 |
|---|---|
| `status` 全链路 | 全绿：DSH `0.1.1-rc.2` · wt-3 `agent/wt-3 @ 2d5888c7` · 实际生效模型 = 目标模型 · 5183/9225 空闲 |
| `--patch` 覆盖生效 | `--dump-config` 读到 `magpie / our-free-model/…/nemotron-3.5-lightning:free`（不带 patch 时是 `deepseek/deepseek-flash`） |
| 端到端派活 | `task "只回复两个字母：OK…"` → 回复 `OK`，**7.7 秒**，exit 0，产物三件齐全 |
| cwd 归属 | `task "只回复你当前工作目录的绝对路径…"` → 答 **`C:\develop\workspace\AI-writer\wt-3`**（5.0 秒）⇒ 归属真落地，不是脚本自说自话 |
| 归属护栏 | `--cwd` 指到 `develop` → **exit 3**，拒绝派活 |
| 模型护栏 | 代码路径已覆盖（`resolveEffectiveModel` 不一致即 exit 1），**未构造失败样本实测** |

**未验证（要用先测）**

- 长任务（> 5 分钟）的稳定性与中途输出形态 —— 目前只跑过秒级任务。
- `markers` 与真实任务书配合的端到端（解析器本身有豆包通道的单测与实战背书，但没在 DSH 回复上跑过）。
- 桌面端同时开着时的并发行为。
- DSH 升级后 `--patch` 语法是否稳定（§8 有失效判据）。

## 8. 失效判据与恢复

| 现象 | 判据 | 恢复 |
|---|---|---|
| exit 1 且报「实际生效模型 ≠ 目标」 | patch 语义失效或文件被改坏 | 跑 `--dump-config` 对比 §4 表；修 `model.patch.yml` 的 `id` 或字段名 |
| exit 2「找不到 DSH」 | npm 全局包被移走/换路径 | 设 `DSH_BIN`，或重装 `@deepseek-ai/dsh` |
| exit 2「wt-3 不存在 / 不是工作树」 | worktree 被回收 | `git worktree add ../wt-3 agent/wt-3`（见 worktree-parallel.md §9） |
| exit 3「固定工作目录」 | `--cwd` 指错 | 去掉 `--cwd`；它是排障选项，不是常规选项 |
| exit 4 超时 | 任务太大或模型卡住 | 拆任务；或加大 `--timeout` |
| 回复为空但 exit 0 | headless 打印的是「最终助手消息」，若 agent 只调工具不落文字就会空 | 任务书里要求最后一行写 `## [T1] DONE/BLOCKED`；空回复视为未完成 |
| 中文在控制台乱码 | stderr 走 GBK 解码（与 task-board §7 同源） | 先 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`；**不是脚本坏了** |

## 9. 社区方案与取舍（「优先社区」的调研结论）

| 方案 | 是什么 | 结论 |
|---|---|---|
| `dsh-as-mcp`（npm，latest **`0.52.84`**） | 在 DSH 宿主内挂 MCP 端点，对外暴露 `workspace_*` / `session_*` / `shell_run` 等 | ❌ **被版本闸门卡死**：peer 要求 `@deepseek-ai/dsh >= 0.1.5-rc.1`，本机 `0.1.1-rc.2`；npm 上 DSH 已到 `0.2.2-rc.1`，本机落后 11 个版本。为一个通道升级整个桌面端（24 个 bundle，3 个 github commit 钉死）代价不匹配 |
| `ds-bot` 内置连接器（本机已装 `0.3.1`） | 左侧栏「连接器」页：`connector-add` 支持 stdio/HTTP、可从 Claude/Cursor/VS Code 导入，工具前缀 `mcp__<id>__*` | ❌ **不适用**：它是「DSH 作为 MCP **客户端**去连外部服务」，方向与「把活派给 DSH」相反。且实测 `~/.dsh/bot/state.json` 的 `connectors` 字段为空、bot 的 `capabilities: []` |
| `ApakohZzz/dsh-custom-json-mcp` | 给左侧栏加连接器管理 UI | ❌ 重复造轮子：`ds-bot 0.3.1` 内置同款能力 |
| 项目内 `scripts/task-board/mcp.mjs` | stdio MCP 壳（服务名 `dsh-task-board`） | ⚠️ 方向同样相反：那是让**外部** agent 连 DSH 的看板。DSH 是看板宿主，会话自带 `task_board_*` 原生工具，再接一层是冗余 |

结论：**没有现成的「把活派给 DSH」的轮子**，官方 `headless` 就是这个形态本身，所以只做了薄封装（`dsh-task.mjs` 一层），没有自造 agent 运行时。

## 10. 相关文档

- [豆包通道](doubao-channel.md) / [WorkBuddy 通道](workbuddy-channel.md) / [Copilot 通道](copilot-channel.md) —— 另三条外部 agent 通道（范式来源）
- [任务看板通道](task-board-channel.md) —— 认领 / 交 review / 复核；DSH 作为宿主自带原生工具，不需要接 MCP 壳
- [worktree 并行开发](worktree-parallel.md) —— 槽位归属表、占用探测、并行红线

## 11. 退役记录：DSH 升为「中控」（2026-11-09）

> 背景：2026-11-09 起**中控从 WorkBuddy 换成 DSH** —— 人直接在 `develop` 里跟 DSH 对话，DSH 会话自带 `task_board_*` 原生工具与全部 MCP 通道。于是「把活派给无头 DSH」这条通道失去存在理由：中控自己不需要被当外部 agent 调用；外部工人回到 [豆包](doubao-channel.md)（`wt-1`）与 [WorkBuddy](workbuddy-channel.md)（`wt-2`）。

### 三条首仗教训（写进任何无头 agent 任务书的硬约束）

1. **无头 agent 的完成声明一律不可采信，必须由派单方自己跑验收**。首仗任务书要求「单测通过后回执 DONE」，回执确实写了 DONE，实际 `vitest` 输出是 `Test Files 1 failed · Tests no tests`：测试文件缺 `import { expect, it } from 'vitest'`，且 4 段相邻字符串用了 C 风格隐式拼接（TypeScript 静默拼成一段）。Lead 修 6 处后 8/8 通过。
2. **任务书必须显式禁止 `SUMMARY` / `VERIFICATION` / `*_DONE.md` 之类自证文件**。首仗越界自建 6 个：`FINAL_SUMMARY.md`、`TASK_SUMMARY.md`、`DELIVERY_VERIFICATION.md`、`##_T1_DONE.md`、`run-test.ps1`、`test-run.mjs`；任务书里点名的文件应是**唯一**白名单。
3. **免费模型有额度墙，且是静默失败**。首仗跑到一半出现 `dsh: SERVER: Sign up for free…`；00:37 复测「只回复两个字」同样失败 —— 额度耗尽时整条通道不可用。任务书要写「连续两次空回复/服务端错误立即 BLOCKED 退出，别重试」。

### 处置

- `wt-3` 已 `reset --hard d2a2a5df`（2026-11-09），工作区只剩 `.batch/c-report.md`；该报告是**证据**，按批验收稿 §5.3 硬约束保留至第三方复核签核后再删，槽位与 `node_modules` 也等签核后再回收。槽位表与 `docs/README.md` 路由行已同步为「空闲」。
- 判定器 `src/shared/chapter-reuse-coverage.ts` + 单测已由 Lead 取回主区、随本批提交入库（**零接线**，阈值待标定）。
- 脚本 `scripts/dsh/dsh-task.mjs`、`scripts/dsh/model.patch.yml`、`scripts/dsh/task-*.md` **保留**，仅作历史用途（`wt-3` 将来若重新启用可直接复用）。
- 交接稿 `docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md` §六「待裁定① DSH 模型怎么办」随退役消解，不再需要改 `model.patch.yml`。
