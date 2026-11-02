# 用任务看板给外部 Agent 派活（跨 harness 通道操作手册）

> 状态：已实施（2026-11-03）· 对应设计稿 [`cross-harness-task-board-access-design.md`](../design/harness/cross-harness-task-board-access-design.md)
> 用途：**让同机任意 harness 的 agent 自己来 DSH 任务看板认领任务、干完回写**；不主动派发、不启动外部进程。
> 关系：与 [`copilot-channel.md`](./copilot-channel.md)、[`doubao-channel.md`](./doubao-channel.md) 并列——那两条是「主会话把活推给某个外部进程」，本文是「外部 agent 自己来取」。

## 0. 一句话读法

```bash
dsh-task-board next                 # 认领一张 tag=external 的卡，打印任务
# …在自己的 harness 里干活、验证；报告写进 <workspace>/.dsh-task-board/reports/<taskId>.md…
dsh-task-board tag <taskId> --add review --remove external --release   # 交 review
# 【不要 done】—— done 会直接把卡推进「已完成」，跳过复核（§5.1）
dsh-task-board review <taskId> --pass|--rework --note "…" --agent <另一身份>   # 复核者：定去留（同名会被拒，§5.3）
```

**唯一一条不靠自觉的规则**：谁交回的卡，谁不能复核 —— `review` 比对 `handedBy`，同 `--agent` 直接 exit 3。所以**干活的与复核的必须用两个名字**（`workbuddy:worker` / `workbuddy:reviewer`）。

看板仍是唯一账本；CLI 的本地目录 `~/.dsh-task-board/` 只记「谁认领、租到何时、重试用哪个 requestId」。

## 1. 落点

| 项 | 值 |
|---|---|
| 源码 | `scripts/task-board/`（零依赖 ESM，Node ≥ 20） |
| CLI | `scripts/task-board/dsh-task-board.mjs`（另有 `dsh-task-board.cmd` / `dsh-task-board` shim） |
| MCP 壳 | `scripts/task-board/mcp.mjs`（stdio，服务名 `dsh-task-board`） |
| 本地状态 | `~/.dsh-task-board/`（可用 `DSH_BOARD_STATE_DIR` 覆盖） |
| 链上看板 | `~/.dsh/task-board/ledger-v2.json`；HTTP `GET /api/task-board/state`、`POST /api/task-board/action` |

**路径用绝对路径**（外部 harness 的工作目录不一定是本仓库）：
`C:\develop\workspace\AI-writer\develop\scripts\task-board\`

## 2. 环境变量与退出码

| 变量 | 作用 |
|---|---|
| `DSH_BOARD_AGENT` | agent 身份（也可 `--agent`）；**写命令必填**，例 `copilot:doc-runner` |
| `DSH_BOARD_URL` | 显式看板地址；不设则自动解析（见下） |
| `DSH_BOARD_STATE_DIR` | 本地租约目录，默认 `~/.dsh-task-board` |

> ⚠️ **同机所有 agent 必须共享默认状态目录**：不要在单个 harness 的配置里覆盖 `DSH_BOARD_STATE_DIR`。各进程看不到彼此的租约时，崩溃回收会退化为回收方自己的 60 分钟 orphan 宽限（`reap` 看不到别的 claim，只能按卡片的 `updatedAt` 猜），可能把一张仍在 heartbeat 的卡误收回 To Do。

看板定位顺序：`--url` → `DSH_BOARD_URL` → `DSH_WEB_URL`（DSH 会话内 shell 自带）→ 缓存 → 自动发现（枚举本机回环监听端口探测 `/state`）。Desktop 每次启动端口都变，自动发现是默认路径；发现到多块看板时用 `--url` 指定。每次连接都会校验 `scheduler.ledgerId`，**连到另一块看板会直接退出 4，不写任何东西**。长驻的 MCP 进程在 DSH 重启后会重新解析看板；写操作会提示你先跑 `doctor` 再重跑，不自动重放。

| 退出码 | 含义 | 外部 agent 该做什么 |
|---|---|---|
| 0 | 成功 | 继续 |
| 2 | 没有可认领任务 | 稍后再轮询，或退出 |
| 3 | 冲突/让位（被抢、卡被移列、Host 接管） | 停止当前工作，不要重试同一张卡 |
| 4 | 看板不可用（DSH 没开、403、找不到） | 报错并停止；查 `doctor` |
| 5 | 用法错误（缺身份、summary 超长、标签名超 32 字符或改后超 8 个标签） | 修参数 |

## 3. 各 harness 接入

事件回写统一走 CLI；MCP 壳只是让 agent 能直接调工具，不改变语义。

**Claude Code**（项目 `.mcp.json`）：
```json
{
  "mcpServers": {
    "dsh-task-board": {
      "command": "node",
      "args": ["C:\\develop\\workspace\\AI-writer\\develop\\scripts\\task-board\\mcp.mjs"],
      "env": { "DSH_BOARD_AGENT": "claude-code" }
    }
  }
}
```

**Codex CLI**（`~/.codex/config.toml`，或 `codex mcp add dsh-task-board -- node <abs>\mcp.mjs`）：
```toml
[mcp_servers.dsh-task-board]
command = "node"
args = ["C:\\develop\\workspace\\AI-writer\\develop\\scripts\\task-board\\mcp.mjs"]
env = { DSH_BOARD_AGENT = "codex" }
```

**Copilot CLI**（`~/.copilot/mcp-config.json`）：
```json
{
  "mcpServers": {
    "dsh-task-board": {
      "type": "stdio",
      "command": "node",
      "args": ["C:\\develop\\workspace\\AI-writer\\develop\\scripts\\task-board\\mcp.mjs"],
      "env": { "DSH_BOARD_AGENT": "copilot" }
    }
  }
}
```

**Qwen Code / Gemini CLI**（`settings.json`）：
```json
{
  "mcpServers": {
    "dsh-task-board": {
      "command": "node",
      "args": ["C:\\develop\\workspace\\AI-writer\\develop\\scripts\\task-board\\mcp.mjs"],
      "env": { "DSH_BOARD_AGENT": "qwen" }
    }
  }
}
```

**Cursor**（`~/.cursor/mcp.json`）：形状同上（Qwen 那段的 `mcpServers`）。

**只有 shell 的 harness**：把 `scripts/task-board` 加到 PATH，或直接用绝对路径调 `dsh-task-board.cmd`；任务 prompt 里写明命令。

**WorkBuddy**（`~/.workbuddy/mcp.json`；**文件不存在就新建，已存在只合并 `mcpServers` 这一段**，别整份覆盖）：
```json
{
  "mcpServers": {
    "dsh-task-board": {
      "command": "node",
      "args": ["C:\\develop\\workspace\\AI-writer\\develop\\scripts\\task-board\\mcp.mjs"],
      "env": { "DSH_BOARD_AGENT": "workbuddy" }
    }
  }
}
```

> ⚠️ 路径是 `mcp.json`，**不是** `.mcp.json`（WorkBuddy 不读带点的那份），写错表现为「配置明明在，工具就是不出现」。
> ⚠️ 存盘**不会自动生效**：要在「连接器管理 → 右上角**自定义连接器**」里对新出现的 `dsh-task-board` 点一次**信任**。不点这一下，配置在本会话里等于不存在。
> 实测（2026-11-03）：`scripts/task-board/probe-mcp-stdio.mjs` 走完 `initialize → tools/list → tools/call`，12 个工具全列出、`task_board_list` 正常返回，可作接入前的自检。

**豆包（电脑版）**：它有两张桌子，按可行性排序，别混着说。

路线 A —— **任务模式的 shell 路线（推荐；分项已实测，组合未实测）**：豆包的「新工作任务」能跑终端命令，直接调绝对路径 CLI 即可，等价于上一节「只有 shell 的 harness」。身份写 `doubao`：

```bash
node C:/develop/workspace/AI-writer/develop/scripts/task-board/dsh-task-board.mjs next --agent doubao --json
```

- 实测状态要分清：**CLI 与看板的通路已验**（见 §8 复验表）、**豆包能跑终端命令已验**（`doubao-channel.md` §7.1），但**「让豆包去跑这个 CLI」本身还没跑过一次**——第一次实跑才算数。
- 先决条件：任务模式的**项目**要用「通过本地文件夹创建项目」指到本仓库。这一步弹的是**系统原生对话框，CDP 驱动不了**，只能人工点一次（细节见 [`doubao-channel.md`](./doubao-channel.md) §4）。
- 命令的 cwd 应为任务模式选定的项目目录（**此点未逐条实测**），因此 CLI 与 `--report` 一律用**绝对路径**，别依赖相对路径。
- 它的执行权限有「本地电脑 / 项目 / 按需确认」三档，选择会决定要不要人工放行每条命令；无人值守要选到能自动执行的档。

路线 B —— **自定义连接器（MCP，未实测）**：豆包的自定义连接器处在 **MCP client 位**（它调外部服务，不是外部调它）。其二进制内有 `mcp_helper` / `streamable` 字样，暗示支持本地 stdio 或 Streamable HTTP，但**我们这份壳是 stdio、能否被直接拉起没有验证过**。要试就照 Copilot CLI 那段填（`command: node` + 绝对路径 + `env.DSH_BOARD_AGENT=doubao`），不通过就退回路线 A —— **别把「没测通」写成「支持」**。

## 4. 发布约定（谁建卡、怎么建）

发布者（人，在 GUI；或 DSH 会话用 `task_board_create`）：

- 卡放 **To Do**，打标签 **`external`**（CLI 默认只认这个标签；可用 `--tag` 换）。
- prompt **自包含**（外部 agent 没有 DSH 会话上下文），至少写清：目标、工作目录、允许/禁止的操作、验收标准、报告路径。
- **不要给外部卡挂 schedule**：调度卡归 Host，CLI 默认跳过；且带 schedule 的卡即使外部成功回写也会落回 todo。
- 允许 subtasks：tag 打在需要被认领的那张卡上；**子卡建出来就继承父卡标签**（§4.1），所以「父卡挂 `external`、子卡一建就能派」成立。
- 发布后不要点 Run：外部认领期间 Host 再跑会开出第二条执行；外部侧检测到会**让位**（exit 3），但双份工作已经发生。
- **外部 agent 不得自己把卡结算成「已完成」** —— 这是硬规则，不是建议：`done` 发的是 `record-external-outcome`，插件对它的定义是「写一条真实执行记录，**终态列由该记录派生**」⇒ 卡会直接落进 Done，「人还没看过」这一步被整个跳过。完成后的正确去向见 §5.1。

### 4.1 让 agent 自己建卡（`create`，含子卡）

2026-11-03 新增。此前只有 DSH 会话能建卡（`task_board_create`），外部 agent 只能等人发卡；现在 CLI 与 MCP 壳也带同名能力，执行者发现「这件事该拆一张后续卡」时可以自己发，不必等人。

```bash
# 顶层卡（--add external 才会被 next 捡走）
node <abs>/dsh-task-board.mjs create \
  --title "补 W6 资源账本的边界测试" \
  --description "一句话说明这张卡要解决什么" \
  --prompt-file ./card-prompt.md \
  --add external \
  --agent workbuddy

# 子卡：只多一个 --parent（标签从父卡继承，不用重抄 external）
node <abs>/dsh-task-board.mjs create --title "子任务" --prompt-file ./child.md \
  --parent <父卡 id> --agent workbuddy
```

MCP 对应 `task_board_create`（`title` / `prompt` 必填，`description` / `tags` / `parentId` / `id` 可选）。

三条硬约束**来自看板的入参校验，不是我们的约定**（插件 `createInput`）：

| 项 | 事实 | 后果 |
|---|---|---|
| `title` / `description` / `prompt` | 三者**都必须是字符串** | 少传 `description` 会让整条 action 被拒（`invalid-action`）；CLI 已默认填空串 |
| `id` | 由**发起方**给，看板不生成 | 要让 prompt 引用自己的卡号，必须 `--id` 先固定；否则只能建完再 `update` 二次写 |
| `tags` / `parentId` | 可选；标签 ≤ 8 个、名长 ≤ 32；父卡须存在且未归档 | 本地先拒（超限 exit 5 / 父卡问题 exit 3），不会写坏看板；**上限按「继承 + 新增」的并集算** |

四点容易踩：

- **`--add external` 不是装饰**：`next` 只认 `external`，顶层卡漏了这张卡就永远没人认领。
- **子卡继承父卡的标签（2026-11-03 落地）**：`--parent` 时本地把父卡标签并进子卡，同名的以**父卡那份**为准（它才可能带 `promptPrefix`，丢了就等于丢了指令），继承的排在前；`--add` 只补新增的。返回里有 `inheritedTags`，文本输出多一行 `inherited: …`。
  - **继承来的标签也算进 8 个上限**：父卡已满 8 个再加新标签会 **exit 5** 并报「inherited N from …」，先把父卡减到 7 个再建。
  - **继承是建卡那一刻的快照**：之后改父卡标签不会回头改子卡（要跟进就 `tag` 逐张改）。
  - 因此**别再给子卡重复写 `--add external`**（写了也无害，同名去重）。状态标签（`review` / `rework`）**理论上不该出现在父卡上**：容器卡不可认领（§7），父卡根本走不到"交 review"那一步。真出现了，说明有人绕过流程在 GUI 上手打了标签 —— 那是流程被绕过，不是流程有洞。
- **卡一律落 To Do**；建完**不要点 Run**（理由同 §4）。
- **每张卡必须带一个重要度标签**（§4.2）。
- **子卡的深度与环由看板拒**（插件 `core/subtask.ts`）。部署默认只允许 **1 层**子卡（`DEFAULT_SUBTASK_DEPTH=1`，本机未改配置 ⇒ 实际两层：根 + 一层），可配到 `SUBTASK_DEPTH_MAX=3`。**深度按现状不动**（2026-11-03 作者定：插件是上游第三方、随时可能更新，不做侵入式改配置）：需要更深的树就拆成**串联的多棵树**——上一棵树的叶子报告成为下一棵树的根卡依据。**派发深度**由 §7 的容器闸保证只落在叶子上。

### 4.2 重要度标签（2026-11-03 作者定，硬规矩）

**每张卡恰好一个 `I` 标签**，取值只有三档：

| 标签 | 含义 | 判据（问自己） |
|---|---|---|
| `I1` | 最高的那一档 | 不做它，别的卡就卡住／主线今天就该往前走它 |
| `I2` | 该做的实质项 | 范围清楚、条件齐、排得上队，只差工时 |
| `I3` | 备选／条件未到 | 等作者裁定、等前置落地、或纯粹留痕 |

- **只用一个字母 I**，不用 `P0/P1`：本项目的 `P1-1`/`P2-3`/`P11-1` 是**设计稿的期号**，卡上再挂 `P1` 必然被读混。
- **`I3` 不等于"不做"**：留痕卡（评估过决定不做、已拍板延后）也是 `I3`，另配一个 `trace` 标签自解释。
- **建卡时就打**，不要等复查；复查时按现状改档是正常操作（改档用 `tag --add/--remove`）。
- **重要度不进 `next` 的排序**：`next` 仍按 `createdAt` 先进先出，标签只是给人看、给筛选用的。要让某张卡先做，用 `--tag I1` 取，别指望它自己冒头。

### 4.3 一张卡的四个时刻（2026-11-03 作者定）

| 时刻 | 谁写 | 存在哪 |
|---|---|---|
| `createdAt` 创建 | 看板 | 台账 `task.createdAt` |
| `updatedAt` 更新 | 看板 | 台账 `task.updatedAt`（任何一次写入都会刷新） |
| `finishedAt` 执行者完成 | 壳（我们） | `<stateDir>/boards/<ledgerId>/timeline/<taskId>.json` |
| `closableAt` 可 close（复核确认、移进完成栏） | 壳／看板 | 复核者 `done` 时壳写 `closedAt`；已进 Done 的卡回落到最后一条执行记录的 `endedAt` |

**为什么要自己存 `finishedAt`**：交 review 那条路**不写执行记录**（写了就等于自结算，§5.1 禁止），所以台账里根本没有"这张卡什么时候干完的"。壳在 `tag` 结果带上 `review` 的那一刻写时间戳，这是唯一能记下来的地方。

**看板侧的两条硬事实**（不在我们手里，别绕）：
- 卡只要有**任一执行记录**，正文（title/description/prompt）就冻结（`canEditTaskContent = 未归档 && executions.length === 0`）。
- 我们的 `claim` **不产生执行记录**（只有 Host 跑才有），所以「正在被外部 agent 干」只能靠 `status === 'running'` 判断 —— `update` 因此同时拒 `running` 和"已有执行记录"两种情况。

**怎么看**：`get <taskId>` 打印 `times: created … · updated … · finished … · closable …`（没有的时刻直接不显示，不打印空档）；`list` 每行带 `updated`。JSON 里是 `get` 的 `times` 字段、`list` 的 `times[taskId]`。

### 4.4 改过期正文（`update`，2026-11-03 新增）

复查会发现卡里写的路径／前提过期了。`tag` 只改标签，改正文要用 `update`：

```bash
node <abs>/dsh-task-board.mjs update <taskId> --prompt-file ./fixed-prompt.md --agent workbuddy
node <abs>/dsh-task-board.mjs update <taskId> --title "新标题" --description "新描述"
```

- 只发改动过的字段；**一个字段都没变就不发请求**（返回 `changed:false`，看板 `revision` 不动）——否则一次"我只是看看"会把 `updatedAt` 顶掉。
- 已跑过的卡、正在 `running` 的卡**拒改**（exit 3），理由见 §4.3。
- MCP 对应 `task_board_update`。

### 4.5 标签词表：一套词，全英文（2026-11-03 作者定）

看板把标签名**原样显示在卡上**，混着来就是两套词汇在界面上打架。全部用小写英文，理由只有一个：`external` 是 pull 通道的默认标签，写死在 `DEFAULT_TAG`、`next` 的默认值和每个外部 agent 的任务书里，改动面最大；反过来统一成中文就得先动它，等于动派发通道本身。

| 标签 | 谁打 | 含义 | 怎么消 |
|---|---|---|---|
| `external` | 建卡人 | 这张卡可以被外部 agent 认领 | 交 review 时去掉；`next` 唯一认它 |
| `review` | 执行者 | 干完了，等复核 | `review --pass` 或 `--rework`（§5.1） |
| `rework` | 复核者（由 `--rework` 写） | 打回了、要返工，判词在卡的 timeline 里 | 下一轮交 review 时换成 `review` |
| `I1` / `I2` / `I3` | 建卡人 | 重要度，每卡恰好一个（§4.2） | 复查时改档 |
| `trace` | 建卡人 | 留痕：记录决策，**不派发** | 不删，它就是留痕 |

- **状态标签只有 `review` / `rework` 两个**，且只由 `tag` / `review` 子命令写，**不手工在 GUI 上编辑**（手改会绕开判词记录）。
- 旧的 `待review` 已全量迁移为 `review`，`留痕` 迁移为 `trace`。

**外部 agent 不装我们的壳也能建**：看板只比对 `Origin` 的 host 与 `Host`，没有令牌。实测（2026-11-03）：零项目 import，用裸 `node:http` 向 `/api/task-board/action` POST 一条**字段不全**的 `create` → **HTTP 400 `invalid-action`**（字段校验失败），**不是 403** ⇒ 门是开的。最小载荷：

```json
{ "requestId": "<uuid>", "initiator": "doubao",
  "action": { "kind": "create", "id": "<uuid>",
              "input": { "title": "T", "description": "D", "prompt": "P",
                         "tags": [{ "name": "external" }] } } }
```

`tags` 必须是对象数组 `[{name}]`；**传字符串数组会被拒**。

## 5. worker 循环（外部 agent）

```bash
export DSH_BOARD_AGENT="copilot:doc-runner"

# 1) 认领；没有任务时退出码 2，不要报错
node C:/develop/workspace/AI-writer/develop/scripts/task-board/dsh-task-board.mjs next --json > /tmp/task.json
# 2) 读出 prompt / workspace / 验收标准，在自己的 harness 里干活
# 3) 长任务定期续租（默认租约 60 分钟）
node .../dsh-task-board.mjs heartbeat <taskId>
# 4) 写报告（唯一凭证）：<workspace>/.dsh-task-board/reports/<taskId>.md
# 5) 交 review：换成 "review" 并去掉 external，同时 release 回 To Do —— 【不要 done】，详见 §5.1
node .../dsh-task-board.mjs tag <taskId> --add review --remove external --release
```

MCP 下对应工具：`task_board_next / task_board_heartbeat / task_board_done / task_board_fail / task_board_release / task_board_tag / task_board_review / task_board_create / task_board_update / task_board_list / task_board_get / task_board_claim / task_board_mine / task_board_reap / task_board_doctor`（15 个）。**注意 `task_board_done` 同样会自结算进 Done，受 §5.1 约束；执行者只应 `task_board_tag` + `task_board_release`，复核者才用 `task_board_review`。**

报告约定：完整四段报告（改动清单 / 执行记录 / 原始输出 / 未做的事）写进任务工作区的 `.dsh-task-board/reports/<taskId>.md`；**不调 `done` 时看板不会存 summary，这份报告就是唯一凭证**。

### 5.1 完成 ≠ 已完成：交 review，不许自己结算

**规则（2026-11-03 作者定）**：执行者干完只做两件事 —— 写报告、把卡打上 **`review`** 标签；**禁止调 `done` / `task_board_done`**。去留由复核者一条命令定（§5.1.2）。

**为什么不能用 `done`**：它发 `record-external-outcome`，插件对该动作的定义是「写一条真实执行记录，**终态列由这条记录派生**」⇒ `done` 等于「直接把卡推进 Done」，复核环节被跳过。这不是"约定俗成"，是接口语义决定的。落列映射是写死的：`succeeded → done`（卡若挂了 schedule 则回 `todo`）、`failed → failed`。

**干不成怎么办**：`fail <taskId> --summary "..."` 照旧可用 —— 它把卡送进 **Failed** 列，不是「已完成」，所以不在禁令内。但不要为了"让卡回到能认领的状态"把失败卡手工挪进 To Do 冒充没干过；失败该留痕。

#### 5.1.1 执行者：交回（一条命令）

```bash
node scripts/task-board/dsh-task-board.mjs tag <taskId> --add review --remove external --release
```

- 底层走 `update` action：`{ kind: 'update', taskId, patch: { tags: [...] } }`；`patch.tags` 是**整组替换**（`null` 清空），标签元素是 `{ name, promptPrefix? }` 对象，CLI/过滤器按 `name` 比较。
- ⚠️ **必须同时去掉 `external`**：`next` 只按 `external` 过滤，留着它这张卡就会被下一个 agent **再认领一次**。
- `--release` 把卡从 running 还回 To Do 并清本地 claim；不加 `--release` 只改标签（卡仍停在 running，租约到期后由 `reap` 回收）。
- 这条命令同时写下 `finishedAt` 与 `handedBy`（§4.3 / §5.3）—— 后者是"谁干的"唯一记录，复核时用来拒掉自审。**所以执行者的 `--agent` 不要和复核者同名**。
- MCP 对应：`task_board_tag { taskId, add: ["review"], remove: ["external"], release: true }`。

#### 5.1.2 复核者：一条命令定去留（`review`，2026-11-03 新增）

```bash
# 通过 → 清 review + 以复核者身份结算进 Done（写 closedAt），note 变成那行 summary
node scripts/task-board/dsh-task-board.mjs review <taskId> --pass \
  --note "过了：第 2 节数字与 §4.3 表对得上" --agent workbuddy:reviewer

# 打回 → 清 review、加 rework + external，判词记在卡上
node scripts/task-board/dsh-task-board.mjs review <taskId> --rework \
  --note "第 3 节表格要按新列重排；报告里没写回滚方案" --agent workbuddy:reviewer
```

- `--pass` = 清标签 + `claim` + `done` 三步合一（`done` 要求先有 claim，所以封装进命令）；卡进 Done，`closableAt` 落在此刻。
- `--rework` **必须带 `--note`**（否则 exit 5）。说不清要改什么就打回，等于把卡扔回池子里让人猜。
- 打回后的卡是 `[external, rework]`，回 To Do；**下一次 `next` 就会把它派出去**，判词随 `hints` 打印：`rework requested by <复核者>: <判词>`。
- 两种判词都写进 `<stateDir>/boards/<ledgerId>/timeline/<taskId>.json` 的 `reviews[]`（只留最近 20 条）。**卡正文跑过一次就冻结，这是唯一能记判词的地方。**
- 卡上没有 `review` 标签时一律拒（exit 3）：没交回来的卡不谈复核。
- **与交回者同名一律拒**（exit 3，§5.3）：`task <id> was handed over by <谁>; the agent that did the work cannot review it`。这条不是靠自觉，是 `review` 里比对的。真需要返工就 `--rework`，别自己过自己。
- MCP 对应：`task_board_review { taskId, verdict: "pass"|"rework", note }`。
- **人只在 GUI 操作**也可以：手工移 Done 不产生执行记录和 summary，报告文件是唯一凭证；要留 summary 就让一个 agent 用上面的命令代记。

**交 review 的四步**（`tag` 命令把第 2–3 步合并成一条）：

1. 报告写进任务工作区 `.dsh-task-board/reports/<taskId>.md`（改动清单 / 执行记录 / 原始输出 / 未做的事）；
2. 标签换成 `[review]`（同时去掉 `external`）；
3. 同一命令带 `--release`，把卡还回 To Do 并清 claim；
4. 复核者用 §5.1.2 的一条命令定去留 —— **通过进 Done，打回变 `rework`**。

**要认的代价**：执行者不调 `done`，所以它那次劳动在看板上**没有执行记录**，报告文件是唯一凭证。复核者 `--pass` 时会落一条 `external` 执行记录，但 `initiatedBy` 是**复核者** —— 别把它读成"执行者自己结算了"。

### 5.2 干完 ≠ 已完成，谁都不例外（2026-11-03 作者定，2026-11-03 二次修订）

**这条规则不分身份。** 主 agent、子 agent、外部 agent 都一样：谁改的谁不许宣布"已完成"。区别只在"谁来审"：

| 模式 | 谁审 | 隔离怎么做 |
|---|---|---|
| **单会话**（只有我自己） | 派一个**子 agent** 审 | 子 agent 只拿**产物 + 验收标准**（要求什么、交付了什么、怎么算通过），**不给**我的推理过程、结论、"我已经检查过了"这类话 |
| **协作**（有豆包 / 其他 harness） | **交叉审** | 我做的东西交给外部 agent 审，外部 agent 做的我看 —— 同一个模型不做自己那份的裁判 |
| **看板** | `review` 由**另一个 `--agent` 身份**执行 | 与交回者同名直接 exit 3（§5.3） |

- **隔离是关键**：连过程一起交出去，子 agent 会顺着我的思路点头 —— 那叫附和，不叫复核。给过程 = 给答案。
- **留痕**：结论一句话写进卡或报告，别只在对话里说"审过了"。
- **意见要证据，不要立场**：无证据的通过和无证据的反对一样不成立；看不懂就说不懂，让对方补证据。有证据的反对**必须回应** —— 要么改，要么写明为什么不改。绝不为了"尊重另一个模型的意见"把明显正确的东西改错，也绝不因为"它审过了"就把自己知道有问题的地方放过去。
- **但"谁说了算"不能写成条款。** 这条规则早先写的是「**结论由我定**」，2026-11-03 删掉：共享文档里的"我"会被每一个读者代入 —— 强模型读成"别盲从"，弱模型读成"我可以无视复核意见"。同一句话对能力相反的读者起相反作用，就不能留在共享文档里。判断力靠实际怎么做，不靠一句话发放。
- **分歧怎么收**：只认证据，不认人头。两边都有证据而结论相反时，按 §5.3 最后一段处理 —— 证据并排写进判词，由当时能执行 `review` 的身份落判并写明依据。这不叫"身份豁免"，叫"裁决必须留理由"。**复核不是免责**：审的人说通过而我手上还有证据说不行，继续查。

### 5.3 身份是自报的，所以只能拦行为（2026-11-03）

**事实前提**：`--agent` 是自报字符串（或 `DSH_BOARD_AGENT`），同一台机器、同一个 CLI、同一份状态目录，**没有任何认证**。任何 agent 都能声称自己是任何一个名字。所以规则不能写成「子 agent 不许……」—— 那反而给了它一个"我是主 agent"就能绕过的口子。

**做法**：把禁令落在**行为**上，不落在身份上 —— 任何人不得复核自己交回的卡。

| 环节 | 机制 |
|---|---|
| 交回时 | `tag --add review` 那一刻把 `handedBy`（交回者身份）写进 `timeline/<taskId>.json`（和 `finishedAt` 同一次写）。**只在"进入 review"这一次写** —— 之后任何 `tag`（加 `I2`、改上下文）都不会覆盖它，否则复核者顺手加个标签就会变成"交回者" |
| 复核时 | `review` 比对 `handedBy` 与当前 `--agent`，**相同则 exit 3**，卡不动 |
| 结算时（`done`） | 两道：卡上**必须**有 `review` 标签（从没交回就想结算 ⇒ exit 3）；且 `handedBy` 不能是自己（交回后把卡 `claim` 回来自己关 ⇒ exit 3）。只有 `done` 有这两道，`fail` 不设限 —— 失败不算宣称完成 |
| 没有记录 | 放行（老卡、或在 GUI 上直接打的 `review` 标签 —— 没有可比的，猜会弄坏能用的卡） |
| 审计 | `get` 的 `times` 里打印 `handed over by <id>`；`reviews[].by` 与 `handedBy` 不同才合规 |

**因此有一条操作要求**：**执行者与复核者必须用不同的 `--agent` 名**，否则复核会被自己这道闸拦下。约定写成 `<harness>:<role>`：

```bash
--agent workbuddy:worker     # 干活的
--agent workbuddy:reviewer   # 复核的
--agent doubao               # 外部通道（它自己就是独立身份）
```

**能拦住什么、拦不住什么**：拦得住"顺手自己过一下"、"忘了交回直接结算"、"交回后又自己关"；**拦不住冒用别人的名字**，也拦不住**删掉/改写本地 timeline 或换 `DSH_BOARD_STATE_DIR`**（那是本机信任边界，§7 第一条）。冒名之后只剩"`reviews[].by` 与 `handedBy` 对不上"这一层可查。所以是三层一起用：**减少机会**（派活任务书不写 `review`/`done` 用法）、**阻断顺手**（`handedBy` 比对）、**事后可查**（timeline 双名字）。**这不是安防项目**，做到"提高成本 + 可审计"就够，不上 OS 级隔离。

**对派活任务书的要求**：写给子 agent 的任务只给"读产物 + 写报告"，不写 `review` / `done` 的用法，也不写"你可以自己判断通过"。**注意这只是减少机会，不是权限隔离** —— 手册是共享文档，它读得到 `review` 的用法；真正拦住它的是 `handedBy` 比对，不是"它不知道"。

**复核意见明显错了怎么办**：不认人头，认证据 —— 谁的主张都要落到文件、行号、命令输出上。分歧未解时**不许任何一方单独把卡推进或驳回**：两边的证据并排写进判词（`review --pass|--rework` 的 `--note` 是唯一能落笔的地方），完整版放报告文件。落判的是**当时能执行 `review` 的那个身份** —— 同一时刻只有它能改卡的列，它必须写明采纳哪边、依据是什么。这**不是身份豁免**（它同样要给证据），是"决定必须落成文字、且可被下一个人核对"。注意 `reviews[]` 只有 `review` 命令能写，worker 写不进去，所以 worker 的意见请写进自己的报告文件，别指望它自动出现在卡上。

## 6. 故障与让位

| 现象 | 处理 |
|---|---|
| `next` 退出 2 | 没有可认领任务，稍后轮询 |
| `next`/`claim` 退出 3 | 被别的 agent 抢先或卡片已变，换下一张 |
| `review` 退出 3 且提示 `handed over by <自己>` | **自审被拦**（§5.3）。换一个 `--agent` 做复核；若这张卡确实要返工，用 `--rework --note` |
| `done` 退出 3 且提示 `handed … over for review` | 交回过的卡不能由交回者结算（§5.3，同一个洞的另一扇门）。换复核者身份走 `review --pass` |
| `done` 退出 3 且提示 `not awaiting review` | 这张卡根本没交回就想结算（§5.3 最宽的那扇门）。先 `tag --add review --release` |
| `heartbeat`/`done` 退出 3 且提示 Host 接管 | **立刻停手**；Host 已开出自己的执行，外部结果不再写入 |
| `done` 退出 3 且提示卡片已结算 | Host 或人已经把卡移走/结算；外部不再覆盖结论，claim 已清 |
| `done`/`release` 退出 3 且提示没有本地 claim | 进程崩溃后 claim 丢了；等 `reap` 把卡回收成 To Do 再重新 `next` |
| `reap` 退出 5 | `reap` 也要 agent 身份（它要把卡移回 To Do）；设 `DSH_BOARD_AGENT` 或 `--agent` |
| 退出 4 / 提示 forbidden | 看板不可达或被同源守卫拒绝；先跑 `dsh-task-board doctor --json` |
| 自动发现报多块看板 | 用 `--url http://127.0.0.1:<port>` 指定；`doctor` 会打印 ledgerId |
| 认领后进程崩溃 | 租约到期后由 `reap` 或下一次 `next` 把卡移回 To Do；不需要手工清理 |
| 卡已经进了 Done，但没人复核过 | 违规自结算（§5.1）。把标签改回 `review` 并移回 To Do，补上复核 |
| 打了 `review` 却被下一个 agent 又认领走 | 标签是**整组替换**，加 `review` 时必须同时去掉 `external` —— `next` 只认 `external` |
| 想靠 `done --summary` 之外的参数"只记结果不改列" | 不存在这种参数。`record-external-outcome` 的终态列由记录派生，无法只写一半 |

## 7. 已知边界

- 同机信任：看板的 `Origin` 守卫是 tripwire，本机任何进程都能伪造；本通道防误操作/并发，不防恶意进程。
- 不阻止 Host 在外部认领期间 Run 同一张卡；只能检测并让位。要真互斥需要改看板插件（设计稿 §4 方案 B）。
- 残余竞态：`done` 的「仍 running」检查与回写之间有毫秒级窗口，Host 恰在此间结算时外部结果仍可能覆盖结论；`reap` 的过期判定也会在写入前再查一次租约，但不能做到真原子。
- 不读账本文件、不伪造 `dsh-auth-*` cookie、不走 `/connect`。
- 看板 summary 存在执行记录的 `error` 字段、GUI 按错误样式渲染：成功记录也会显示成一行「错误样式」文字，属插件实现，不是失败。
- **树深度 vs 派发深度（2026-11-03 已裁定）**：看板侧 `maxSubtaskDepth` 默认 1（根 + 一层）、上限 3，`normalizeSubtaskDepth` 会把 4 夹回 3 ⇒ **超过四层的树在这个部署里装不下**。三条结论：① **深度按现状不动** —— 插件是上游第三方、随时可能更新，不做侵入式改配置；要更深的树就拆成**串联的多棵树**（上一棵的叶子报告成为下一棵根卡的依据）；② **容器卡不可认领，已落成硬闸** —— `select.mjs` 的 `containerTaskIds()` 把「还有未完成子卡」的卡剔出候选池，`next` 与 `claim` 都拒，判据直接复用 Host 的 `hasOutstandingDescendants`（`status !== 'done'`，归档子卡不再算）；③ **状态标签不继承这件事不是问题** —— 容器卡压根进不了派发环节，父卡到不了"交 review"那一步；真出现了就是有人绕过流程手打标签（§5.2）。
- 改标签已由 `tag` 子命令封装（`update` action，整组替换）；改正文由 `update` 封装（§4.4）；复核去留由 `review` 封装（§5.1.2）。交 review 用 §5.1.1 的一条命令完成「换标签 + release」。执行者仍不得调 `done`（§5.1）。
- CP936（`chcp 936`）控制台下**中文标签的回显**会乱码（当初的 `待review` 显示成 `寰卹eview`）——那是终端解码 stdout 的问题，**不是参数坏了**：实测经 PowerShell 直调 `node`、经 `.cmd` shim、经 `cmd.exe`，argv 均为正确 UTF-8（`e5be85726576696577`）。别因为回显乱码去改标签名或加转义。**现在标签全部是英文（§4.5），这条已不再触发，留作排障参考。**

## 8. 验证记录（2026-11-03）

- `node --test scripts/task-board/test/*.test.mjs`：72 条全绿（transport / identity / claims / ops / cli / mcp）。
- 实机 `doctor --json`：自动发现 `http://127.0.0.1:62185`，`ledgerId=0bdbb2fa-…`，`schemaVersion=7`，`revision=77`（读只读，无写入）。
- 新增 `tag` 子命令（2026-11-03 01:2x，CLI + MCP `task_board_tag`）：离线测试覆盖「换标签 + release + 保留 promptPrefix + 8 个上限」；**未在真实卡上实跑**（避免动真卡）。
- 未验证：真实跨 harness 端到端（Copilot/Qwen MCP 实跑）——留待首次实跑时补记录。

**`tag` 复审（2026-11-03 01:3x，由 WorkBuddy 会话执行，未动真卡）**

| 检查 | 结果 |
|---|---|
| `node --test scripts/task-board/test/*.test.mjs` | **72 / 72 通过**（2.2s） |
| `--help` 命令清单 | 含 `tag <taskId>` 与 `--add / --remove / --release`，与 §5.1 写法一致 |
| 读 `lib/ops.mjs` 的 `tag()` | `patch.tags` 整组替换 ✓ · 保留 `promptPrefix` ✓ · `--release` 时 `move(todo)` + 清本地 claim ✓ · 超 8 个标签抛 usage ✓ · 归档卡拒改 ✓ |
| 读 `lib/ops.mjs` 的 `claim()` | **只校验 `status === 'todo'`，不校验标签** ⇒ §5.1 的「复核者 `claim` + `done`」路径成立 |
| 中文标签 argv 编码 | PowerShell 直调 `node`、`.cmd` shim、`cmd.exe` 三条路，argv 均为正确 UTF-8（`e5be85726576696577`）；CP936 控制台下**回显**可能乱码，属显示问题（§7 已记） |
| MCP 壳 | `tools/list` = 12 个，含 `task_board_tag` |

**首次真实端到端（2026-11-03 01:36，豆包执行 + WorkBuddy 会话复核）**

一次性测试卡 `46aaaa91-…`（`external`，工作区 `C:/develop/tmp/doubao-board-test`），派给豆包后**整条链路自动跑完**，无人手工干预：

| 环节 | 证据 |
|---|---|
| 豆包自己认领 | 报告的 claim JSON 里有 `agentId:"doubao"`、`pid:50112`、`host:BAIYUNFEI`、`leaseUntil` —— 是它真跑了 CLI，不是它"以为"跑了 |
| 写报告 | `<workspace>/.dsh-task-board/reports/46aaaa91-….md`，1473 字节，四段齐全 |
| 交 review（按 §5.1） | 卡变 `todo` + 标签只剩 `review`，**`executions: 0`** ⇒ 确实没调 `done` |
| 不会被二次认领 | `list --tag external` = **0 张**（`external` 被去掉，`next` 捡不到） |
| 标签回显 | 看板上原样显示，无乱码（§7 说的乱码只发生在 CP936 控制台回显） |
| 复核者路径 | `claim` + `done --summary` 由 `workbuddy:reviewer` 执行 → `status:done`、1 条 `external` 执行记录、`initiatedBy=workbuddy:reviewer` |
| 复核后清标签 | `tag --remove review`（不带 `--release`）→ `status` 仍 `done`、`tags: []` |

结论：**§5.1 的全套流程在本机真跑通过**，含"执行者不自结算"和"复核者身份留 summary"两侧。`done` / `fail` / `heartbeat` / `tag` 的写通路均已在真实卡上验证（此前标为未验的两项就此关闭）。

剩余未验：真实**跨 harness**（Copilot / Qwen 的 MCP 客户端实跑）—— 本次豆包走的是 shell 路线（§3 路线 A），MCP 壳仍只有 stdio 自检。

**外部侧连通性复验（2026-11-03 01:0x，由 WorkBuddy 会话执行，全程只读）**

| 检查 | 结果 |
|---|---|
| `doctor --json` | `ok:true` · `http://127.0.0.1:62185` · `ledgerId=0bdbb2fa-…` · `schemaVersion=7` · `revision=77` · `stateDir=%USERPROFILE%\.dsh-task-board` |
| `list` 各列 | backlog 7 · todo 10 · done 7 · running 0 · failed 0（读通路正常） |
| `list --tag external` | **0 张** ⇒ 当时无待认领卡，写路径可在不抢卡的前提下试 |
| `next --no-auto-reap --agent workbuddy:connectivity-probe` | **exit 2**，stderr `no-candidate: no claimable task tagged external` —— 与 §2 契约一致 |
| `mine --agent workbuddy:connectivity-probe` | `claims: []`，`ledgerId` 一致 ⇒ 本地租约目录落在同一块看板下 |
| `probe-mcp-stdio.mjs`（新增自检脚本） | `initialize` → `tools/list`（12 个工具）→ `tools/call task_board_list`（24 张卡）全通 |

结论：**CLI 读通路 + MCP stdio 壳在本机可用**。`done` / `fail` / `heartbeat` 的回写仍未实跑（需要真实 external 卡），不要把这份记录读成「写通路已验证」。

**`create` 落地验证（2026-11-03 01:56，WorkBuddy 会话；真看板 `ledger 0bdbb2fa`）**

| 检查 | 结果 |
|---|---|
| `node --test scripts/task-board/test/*.test.mjs` | **82 / 82 通过**（原 72 条，+10 条覆盖 `create`、子卡、`--prompt-file`、退出码） |
| `--help` | 含 `create` 与 `--title / --description / --prompt / --prompt-file / --parent / --id` |
| MCP `tools/list` | **13 个**，含 `task_board_create` |
| 裸 HTTP 过同源守卫 | 零项目 import 向 `/action` POST 一条缺字段的 `create` → **HTTP 400 `invalid-action`**（不是 403）⇒ 门是开的 |
| 真看板 · 顶层卡 | `--id 11111111-…` 固定成功 → `status:todo`、`tags:[{name:"验证卡"}]`、`description` 默认空串 |
| 真看板 · 子卡 | `--parent 46aaaa91-…` → 返回且持久化 `parentId`，`get` 复查一致 |
| 真看板 · 重复 id | **exit 3**：`conflict: a card with id … already exists`，未写入 |
| 不污染劳动力池 | 两张测试卡都没打 `external` ⇒ `next` 仍 **exit 2** |

真实卡残留 `552f375a-…`（子卡）、`11111111-…`（顶层）**已由作者在 GUI 删除**（2026-11-03 02:4x），板上不再有测试废卡。

**子卡继承父卡标签（2026-11-03 02:0x 落地；作者裁定「继承」，深度按部署现状不调）**

| 检查 | 结果 |
|---|---|
| `node --test scripts/task-board/test/*.test.mjs` | **85 / 85**（+3：继承并集 / `promptPrefix` 保留且进 `tagHints` / 上限按并集算） |
| 子卡标签 | 父卡 `[{external,prefix}, {batch}]` + `--add batch,review` → `[{external,prefix}, {batch}, {review}]`，`inheritedTags: [external, batch]` |
| 派发链路 | 继承来的 `external` 确实让子卡可派（此前子卡必须手抄 `--add external`） |
| 超限 | 父卡 8 个 + 1 个新 = **exit 5**，报「inherited 8 from <parent> + 1 new would make 9」；重加父卡已有的名字**不算**超限（去重后仍 8 个） |
| 真看板 | **未跑**：不想再往真看板写第三张废卡。依据是本地 fake board 与看板 `createInput` 同源的入参校验（`fake-board.mjs` 的 create 分支逐条对齐插件） |

**容器闸与复核状态机（2026-11-03 02:5x 落地；作者裁定「不改插件深度、容器卡不可认领、状态标签不继承不是问题」）**

| 检查 | 结果 |
|---|---|
| `node --test scripts/task-board/test/*.test.mjs` | **99 / 99**（+5 容器闸 / +4 复核去留 / +2 CLI） |
| 容器闸 | `containerTaskIds()` 剔出「还有未完成子卡」的卡；`next` 跳过、`claim` 拒（exit 3，报未完成子卡 id）；子卡全 done 或全归档后父卡恢复可认领 |
| 池子空时报原因 | `no leaf card tagged external; skipped 1 container card(s) …` —— 不再是一句「no claimable」让人去找标签错在哪 |
| 复核通过 | `review --pass` 一条命令完成「清 `review` + `claim` + `done`」，`closableAt` 落此刻，`I` 标签保留 |
| 复核打回 | `review --rework` **强制 `--note`**（缺则 exit 5）；卡变 `[external, rework]` 回 To Do，判词随 `hints` 打印给下一个 worker |
| 判词落盘 | `<stateDir>/boards/<ledgerId>/timeline/<taskId>.json` 的 `reviews[]`（留最近 20 条）—— 卡正文跑过就冻结，这是唯一能写判词的地方 |
| 未交回就复核 | exit 3：`not awaiting review: it carries no review label` |

**独立复核这一批（2026-11-03 03:1x，上下文隔离子 agent，按 §5.2 第一种模式跑的第一例）**

6 条验收标准：2 条通过、4 条有问题。采纳并修掉：

| 复核发现 | 修法 |
|---|---|
| `review --pass` 先清 `review` 再结算，`claim`/`done` 任一步失败就留下「标签已清、没进 Done、`next` 与 `review` 都不认」的死卡（探针实测三种触发：卡仍 running、`--note` 超 1000 字、带 `review` 的容器卡） | **顺序倒过来**：先 `claim` → `done`，最后才清标签；失败时 `release` 把卡放回 To Do 且**保留 `review`**，可直接重试。`--note` 超 1000 字在入口就拒（exit 5），不再等到 `done` 才炸 |
| `--pass` 不清 `rework`，通过的卡进 Done 还挂着「待返工」 | `--pass` 同时清 `review` + `rework` |
| `containerTaskIds()` 只看一层父子：`root → mid(done) → leaf(todo)` 时 Host 判 `root` 是容器，我们判叶子 | 改为**沿祖先链上溯**。当前部署深度 1 碰不到，但原注释写「父链已封闭」是错的 |
| `--rework` 在卡还 `running` 时只改标签不挪列，CLI 仍打印「back in the pool」 | 加前置检查：不是 `todo` 就 exit 3，说明执行者漏了 `--release` |

**没修、记为已知限制**：卡已有 8 个标签时 `--rework` 会 exit 5（`rework` + `external` 顶掉上限）—— 报错清晰，手工减一个标签再试。单测 **99 → 104**。

**`update` 子命令 + 四个时刻（2026-11-03 02:3x）**

| 检查 | 结果 |
|---|---|
| `node --test scripts/task-board/test/*.test.mjs` | **89 / 89**（+4：改正文 / 拒已跑与 running / 交 review 记 `finishedAt`、复核记 `closableAt` / CLI 文本带 `times`） |
| 真实卡 · 改正文 | 5 张 AC/阶段 2.5 卡改成功（纯替换过期路径与前置说明，正文其余照抄）；`updated` 只报实际变了的字段 |
| 真看板 · 冻结规则 | 11 张开放卡 `executions` 全为 0 ⇒ 正文可改；`update` 另外**拒 `running`**（我们的 claim 不写执行记录，见 §4.3） |
| 真看板 · 时间戳 | `tagged … times: created … · updated …`、`done` 后 `closable` 出现；未交 review 的卡不显示 `finished`/`closable`（不打印空档） |
| 重要度标签 | 11 张开放卡全部打上（`I2`×6 / `I3`×5，两张留痕卡另加 `trace`）；新增容器卡 `61e4535d` 为 `I1` |
| 复查发现的缺口 | **板上没有任何 D 系列卡**，而台账写着「作者指定：接下来重点修复 D1–D18」⇒ 补建容器卡 `61e4535d`（缺陷稿 §2 状态列为准）；派发契约已定，见 §7 |

**职责分离（§5.3，2026-11-03 03:3x）**

| 检查 | 结果 |
|---|---|
| `node --test scripts/task-board/test/*.test.mjs` | **107 / 107**（+3：同身份复核被拒且卡不动、同身份结算被拒、无 `handedBy` 的老卡仍可复核） |
| 交回时落 `handedBy` | `tag --add review` 与 `finishedAt` 同一次写进 `timeline/<taskId>.json`；`get` 的 `times` 打印 `handed over by <id>` |
| 同身份复核 | exit 3，文案点名交回者；`--pass` 与 `--rework` 都被拦，卡片状态不变 |
| 同身份结算 | 交回者再 `claim` + `done` 也 exit 3（绕过复核的另一扇门） |
| 换身份复核 | `--agent test:reviewer` 通过，`reviews[].by` 与 `handedBy` 不同 |
| 老卡 / 手打标签 | 无 `handedBy` ⇒ 放行（不猜、不弄坏能用的卡） |
| 未做 | 真实看板上的两身份实跑（离线 fake board 已覆盖同一路径；真卡上暂不造废卡） |

**职责分离 · 独立复核（2026-11-03 03:5x，上下文隔离子 agent，5 条标准：1 通过 4 有问题）**

| 它指出的 | 判断 | 处置 |
|---|---|---|
| 交回后任何 `tag` 都重写 `handedBy`（复核者顺手加个 `I2` 就把自己变成"交回者"，反过来被闸拦） | **真 bug，采纳** | 只在「进入 review」的跃迁写；补回归测试「later tag 不改 handedBy」 |
| 「从没交回直接 `claim`+`done`」完全不拦（探针实测卡直接进 Done、零复核） | **真缺口，采纳** | `done` 现在要求卡上必须有 `review` 标签（`fail` 不设限）；补测试「never handed over」 |
| 结算已落但回包丢失时，错误文案说"已回到 To Do" | **比文案更严重，采纳** | 原 `release` 会把已进 Done 的卡**拽回 To Do**。现在先查状态：已 Done ⇒ 继续清标签并报成功；只有仍在 `running` 才 release |
| 换 `DSH_BOARD_STATE_DIR` / 删 timeline 可绕过 | **真实，但不修** | 本机信任边界（§7 第一条），不是本轮引入的，上 OS 级隔离不值 |
| 删掉「结论由我定」后，"意见明显错了怎么办"没答案；§5.3 一边说没有认证、一边把"不给权限"当预防 | **成立，采纳一半** | 补「分歧怎么收」：只认证据，升级给卡的创建者并写明理由；§5.3 把"预防"改成"减少机会"，删掉"读完手册也不该拿到越权路"这句错话（手册是共享的，它读得到） |

单测 **107 → 109**。探针脚本与复核报告在 `C:/develop/tmp/`（复核者留的，未入库）。

**职责分离 · 修复复审（2026-11-03 04:0x，同一复核者，A 三条全部修好 / B 有新缺陷 3 条）**

| 它指出的 | 处置 |
|---|---|
| ① `done` 的 review 闸排在 Host 接管检查**之前**：卡片其实归 Host 了，却被告知"先交回"，照做会留下 `running` + `review` + 无 `handedBy` 的**半写状态**；`next` 的输出还在打印必然失败的 `done` 命令 | **先判归属再判闸**（claim → Host 接管 → 列 → review 闸），`next` 的提示改成交回命令。补测试「Host 接管时说的是接管，不是先交回」 |
| ② 「分歧怎么收」与 §5.2「谁说了算不能写成条款」自相矛盾；且看板没有"卡的创建者"这个可靠字段，`reviews[]` 工人也写不进去 | 改成"证据并排写进判词，由**当时能执行 `review` 的身份**落判并写依据"，去掉"创建者"；并写明 worker 的意见只能放在自己的报告文件里 |
| ③ `review --pass` 的"已 Done"分支会**把 Host 的结算误报成复核者的通过**，且留下本地 claim | 只有最后一条执行记录是 `external` 且 `initiatedBy` 是自己才认成功；否则报"已被别人结算、本次判词未生效"并给出清标签命令。两条路都 `dropClaim` |

单测 **109 → 110**。
