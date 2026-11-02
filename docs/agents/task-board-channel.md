# 用任务看板给外部 Agent 派活（跨 harness 通道操作手册）

> 状态：已实施（2026-11-03）· 对应设计稿 [`cross-harness-task-board-access-design.md`](../design/harness/cross-harness-task-board-access-design.md)
> 用途：**让同机任意 harness 的 agent 自己来 DSH 任务看板认领任务、干完回写**；不主动派发、不启动外部进程。
> 关系：与 [`copilot-channel.md`](./copilot-channel.md)、[`doubao-channel.md`](./doubao-channel.md) 并列——那两条是「主会话把活推给某个外部进程」，本文是「外部 agent 自己来取」。

## 0. 一句话读法

```bash
dsh-task-board next                 # 认领一张 tag=external 的卡，打印任务
# …在自己的 harness 里干活、验证；报告写进 <workspace>/.dsh-task-board/reports/<taskId>.md…
dsh-task-board tag <taskId> --add 待review --remove external --release   # 交 review
# 【不要 done】—— done 会直接把卡推进「已完成」，跳过人的复核（§5.1）
```

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
  - 因此**别再给子卡重复写 `--add external`**（写了也无害，同名去重）；反过来，父卡若已挂 `待review`，子卡会带着这个标签出生 —— 建子卡前先确认父卡身上没有状态类标签。
- **卡一律落 To Do**；建完**不要点 Run**（理由同 §4）。
- **每张卡必须带一个重要度标签**（§4.2）。
- **子卡的深度与环由看板拒**（插件 `core/subtask.ts`）。部署默认只允许 **1 层**子卡（`DEFAULT_SUBTASK_DEPTH=1`，本机未改配置 ⇒ 实际就是两层：根 + 一层），可配到 `SUBTASK_DEPTH_MAX=3`（最多四层）。**树深度与派发深度是两件事，契约仍待作者裁定**，见 §7。

### 4.2 重要度标签（2026-11-03 作者定，硬规矩）

**每张卡恰好一个 `I` 标签**，取值只有三档：

| 标签 | 含义 | 判据（问自己） |
|---|---|---|
| `I1` | 最高的那一档 | 不做它，别的卡就卡住／主线今天就该往前走它 |
| `I2` | 该做的实质项 | 范围清楚、条件齐、排得上队，只差工时 |
| `I3` | 备选／条件未到 | 等作者裁定、等前置落地、或纯粹留痕 |

- **只用一个字母 I**，不用 `P0/P1`：本项目的 `P1-1`/`P2-3`/`P11-1` 是**设计稿的期号**，卡上再挂 `P1` 必然被读混。
- **`I3` 不等于"不做"**：留痕卡（评估过决定不做、已拍板延后）也是 `I3`，另配一个 `留痕` 标签自解释。
- **建卡时就打**，不要等复查；复查时按现状改档是正常操作（改档用 `tag --add/--remove`）。
- **重要度不进 `next` 的排序**：`next` 仍按 `createdAt` 先进先出，标签只是给人看、给筛选用的。要让某张卡先做，用 `--tag I1` 取，别指望它自己冒头。

### 4.3 一张卡的四个时刻（2026-11-03 作者定）

| 时刻 | 谁写 | 存在哪 |
|---|---|---|
| `createdAt` 创建 | 看板 | 台账 `task.createdAt` |
| `updatedAt` 更新 | 看板 | 台账 `task.updatedAt`（任何一次写入都会刷新） |
| `finishedAt` 执行者完成 | 壳（我们） | `<stateDir>/boards/<ledgerId>/timeline/<taskId>.json` |
| `closableAt` 可 close（复核确认、移进完成栏） | 壳／看板 | 复核者 `done` 时壳写 `closedAt`；已进 Done 的卡回落到最后一条执行记录的 `endedAt` |

**为什么要自己存 `finishedAt`**：交 review 那条路**不写执行记录**（写了就等于自结算，§5.1 禁止），所以台账里根本没有"这张卡什么时候干完的"。壳在 `tag` 结果带上 `待review` 的那一刻写时间戳，这是唯一能记下来的地方。

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
# 5) 交 review：换成「待review」并去掉 external，同时 release 回 To Do —— 【不要 done】，详见 §5.1
node .../dsh-task-board.mjs tag <taskId> --add 待review --remove external --release
```

MCP 下对应工具：`task_board_next / task_board_heartbeat / task_board_done / task_board_fail / task_board_release / task_board_tag / task_board_create / task_board_update / task_board_list / task_board_get / task_board_claim / task_board_mine / task_board_reap / task_board_doctor`（14 个）。**注意 `task_board_done` 同样会自结算进 Done，受 §5.1 约束；执行者只应 `task_board_tag` + `task_board_release`。**

报告约定：完整四段报告（改动清单 / 执行记录 / 原始输出 / 未做的事）写进任务工作区的 `.dsh-task-board/reports/<taskId>.md`；**不调 `done` 时看板不会存 summary，这份报告就是唯一凭证**。

### 5.1 完成 ≠ 已完成：交 review，不许自己结算

**规则（2026-11-03 作者定）**：外部 agent 干完只做两件事 —— 写报告、把卡打上 **`待review`** 标签；**禁止调 `done` / `task_board_done`**。由人复核后再手工移进 Done，或由 Host 跑验收。

**为什么不能用 `done`**：它发 `record-external-outcome`，插件对该动作的定义是「写一条真实执行记录，**终态列由这条记录派生**」⇒ `done` 等于「直接把卡推进 Done」，人的复核环节被跳过。这不是"约定俗成"，是接口语义决定的。落列映射是写死的：`succeeded → done`（卡若挂了 schedule 则回 `todo`）、`failed → failed`。

**干不成怎么办**：`fail <taskId> --summary "..."` 照旧可用 —— 它把卡送进 **Failed** 列，不是「已完成」，所以不在禁令内。但不要为了"让卡回到能认领的状态"把失败卡手工挪进 To Do 冒充没干过；失败该留痕。

**怎么改标签（`tag` 子命令，2026-11-03 已实现）**：

```bash
# 交 review：换成「待review」并同时去掉 external，一次完成「改标签 + release 回 To Do」
node scripts/task-board/dsh-task-board.mjs tag <taskId> --add 待review --remove external --release
```

- 底层走 `update` action：`{ kind: 'update', taskId, patch: { tags: [...] } }`；`patch.tags` 是**整组替换**（`null` 清空），标签元素是 `{ name, promptPrefix? }` 对象，CLI/过滤器按 `name` 比较。
- ⚠️ **必须同时去掉 `external`**：`next` 只按 `external` 过滤，留着它这张卡就会被下一个 agent **再认领一次**。
- `--release` 把卡从 running 还回 To Do 并清本地 claim；不加 `--release` 只改标签（卡仍停在 running，租约到期后由 `reap` 回收）。
- 不通过复核时：`tag <taskId> --add external --remove 待review`（卡已在 To Do，直接回到可认领状态）。
- MCP 对应工具：`task_board_tag { taskId, add: ["待review"], remove: ["external"], release: true }`。

**交 review 的四步**（`tag` 命令把第 2–3 步合并成一条）：

1. 报告写进任务工作区 `.dsh-task-board/reports/<taskId>.md`（改动清单 / 执行记录 / 原始输出 / 未做的事）；
2. 标签换成 `[待review]`（同时去掉 `external`）；
3. 同一命令带 `--release`，把卡还回 To Do 并清 claim；
4. 人复核：**通过 → 移进 Done**；不通过 → 标签改回 `external`，卡回到可认领状态。
5. 复核通过后顺手清标签：`tag <taskId> --remove 待review`（**不带 `--release`**，卡留在 Done）。实测 2026-11-03：卡进 Done 后 `待review` 会一直挂着，Done 列里混着一堆"已处理但还标着待评审"的卡。用复核者身份 `done` 也一样不会自动清标签。

**复核后还能不能留 summary？** 能，但取决于复核者是谁：

- **复核者是 agent / DSH 会话（调度者）**：`claim <taskId>` 后再 `done <taskId> --summary "review accepted: <一句话>; worker report: <path>"` —— 卡片进 Done，看板落一条 `external` 执行记录，**initiatedBy 是复核者**（不是执行者）。这条 summary 是复核结论，worker 的原始报告仍以文件为准。
- **复核者是人、只在 GUI 操作**：手工移 Done 不产生执行记录和 summary —— 报告文件是唯一凭证。要留 summary，就让一个 DSH 会话/agent 用上面的命令代记。
- 注意：规则禁止的是**执行者自己 `done`**；复核者用自己身份 `claim + done` 是允许的，记录也如实标成复核者。

**要认的代价**：不调 `done` 就没有执行记录，看板上不会有那行 summary（也就没有「成功记录显示成错误样式」那个怪癖）。所以第 1 步的报告文件必须写，它是唯一凭证。

## 6. 故障与让位

| 现象 | 处理 |
|---|---|
| `next` 退出 2 | 没有可认领任务，稍后轮询 |
| `next`/`claim` 退出 3 | 被别的 agent 抢先或卡片已变，换下一张 |
| `heartbeat`/`done` 退出 3 且提示 Host 接管 | **立刻停手**；Host 已开出自己的执行，外部结果不再写入 |
| `done` 退出 3 且提示卡片已结算 | Host 或人已经把卡移走/结算；外部不再覆盖结论，claim 已清 |
| `done`/`release` 退出 3 且提示没有本地 claim | 进程崩溃后 claim 丢了；等 `reap` 把卡回收成 To Do 再重新 `next` |
| `reap` 退出 5 | `reap` 也要 agent 身份（它要把卡移回 To Do）；设 `DSH_BOARD_AGENT` 或 `--agent` |
| 退出 4 / 提示 forbidden | 看板不可达或被同源守卫拒绝；先跑 `dsh-task-board doctor --json` |
| 自动发现报多块看板 | 用 `--url http://127.0.0.1:<port>` 指定；`doctor` 会打印 ledgerId |
| 认领后进程崩溃 | 租约到期后由 `reap` 或下一次 `next` 把卡移回 To Do；不需要手工清理 |
| 卡已经进了 Done，但没人复核过 | 违规自结算（§5.1）。手工把标签改成 `待review` 并移回 To Do，补上复核 |
| 打了 `待review` 却被下一个 agent 又认领走 | 标签是**整组替换**，加 `待review` 时必须同时去掉 `external` —— `next` 只认 `external` |
| 想靠 `done --summary` 之外的参数"只记结果不改列" | 不存在这种参数。`record-external-outcome` 的终态列由记录派生，无法只写一半 |

## 7. 已知边界

- 同机信任：看板的 `Origin` 守卫是 tripwire，本机任何进程都能伪造；本通道防误操作/并发，不防恶意进程。
- 不阻止 Host 在外部认领期间 Run 同一张卡；只能检测并让位。要真互斥需要改看板插件（设计稿 §4 方案 B）。
- 残余竞态：`done` 的「仍 running」检查与回写之间有毫秒级窗口，Host 恰在此间结算时外部结果仍可能覆盖结论；`reap` 的过期判定也会在写入前再查一次租约，但不能做到真原子。
- 不读账本文件、不伪造 `dsh-auth-*` cookie、不走 `/connect`。
- 看板 summary 存在执行记录的 `error` 字段、GUI 按错误样式渲染：成功记录也会显示成一行「错误样式」文字，属插件实现，不是失败。
- **树深度 vs 派发深度（⏸ 待作者裁定，2026-11-03）**：看板侧 `maxSubtaskDepth` 默认 1（根 + 一层）、上限 3（最多四层），`normalizeSubtaskDepth` 会把 4 夹回 3 ⇒ **五层的树在本部署装不下**。而主 agent 梳理一个大模块确实需要 3–5 层，真正派发给外部 agent 的只是最底那一两层。两个概念必须拆开：树深度归看板配置，派发深度应固定在叶子。**未裁定的部分**：① 是否把部署深度调到 3（改 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `ui-task-board.config.maxSubtaskDepth`，或 GUI 设置卡热改）；② `next`/`claim` 是否要硬拒「有未完成子卡」的容器卡（Host 自己的判据是 `hasOutstandingDescendants`，即 `status !== 'done'`）；③ `待review` 这类**状态标签**是否排除在继承之外。裁定前**默认仍按"子卡只一层、叶子才打 `external`"**操作。
- 改标签已由 `tag` 子命令封装（`update` action，整组替换）；改正文由 `update` 封装（§4.4）。交 review 用 §5.1 的一条命令完成「换标签 + release」。执行者仍不得调 `done`（§5.1）；复核者要留 summary 时用自己身份 `claim + done`。
- CP936（`chcp 936`）控制台下，**中文标签的回显**可能乱码（`待review` 显示成 `寰卹eview`）——那是终端解码 stdout 的问题，**不是参数坏了**：实测经 PowerShell 直调 `node`、经 `.cmd` shim、经 `cmd.exe`，argv 均为正确 UTF-8（`e5be85726576696577`）。别因为回显乱码去改标签名或加转义。

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
| 交 review（按 §5.1） | 卡变 `todo` + 标签只剩 `待review`，**`executions: 0`** ⇒ 确实没调 `done` |
| 不会被二次认领 | `list --tag external` = **0 张**（`external` 被去掉，`next` 捡不到） |
| 中文标签 | 看板上原样显示 `待review`，无乱码（§7 说的乱码只发生在 CP936 控制台回显） |
| 复核者路径 | `claim` + `done --summary` 由 `workbuddy:reviewer` 执行 → `status:done`、1 条 `external` 执行记录、`initiatedBy=workbuddy:reviewer` |
| 复核后清标签 | `tag --remove 待review`（不带 `--release`）→ `status` 仍 `done`、`tags: []` |

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

真实卡残留（**待在 GUI 删除**）：`552f375a-2000-45ad-81b3-3d1a846a5204`（子卡，挂在 `46aaaa91-…` 下）、`11111111-2222-4333-8444-555555555555`（顶层卡）。

**子卡继承父卡标签（2026-11-03 02:0x 落地；作者裁定「继承」，并定「深度两层到顶」）**

| 检查 | 结果 |
|---|---|
| `node --test scripts/task-board/test/*.test.mjs` | **85 / 85**（+3：继承并集 / `promptPrefix` 保留且进 `tagHints` / 上限按并集算） |
| 子卡标签 | 父卡 `[{external,prefix}, {batch}]` + `--add batch,待review` → `[{external,prefix}, {batch}, {待review}]`，`inheritedTags: [external, batch]` |
| 派发链路 | 父卡被 `next` 取走后，**子卡是下一张被取走的** ⇒ 继承来的 `external` 确实让它可派（此前子卡必须手抄 `--add external`） |
| 超限 | 父卡 8 个 + 1 个新 = **exit 5**，报「inherited 8 from <parent> + 1 new would make 9」；重加父卡已有的名字**不算**超限（去重后仍 8 个） |
| 真看板 | **未跑**：不想再往真看板写第三张废卡。依据是本地 fake board 与看板 `createInput` 同源的入参校验（`fake-board.mjs` 的 create 分支逐条对齐插件） |

仍未验：子卡**深度上限**（插件 `core/subtask.ts` 有 `maxSubtaskDepth`，只在约定层面定为两层到顶，未去撞看板的硬限制）。

**`update` 子命令 + 四个时刻（2026-11-03 02:3x）**

| 检查 | 结果 |
|---|---|
| `node --test scripts/task-board/test/*.test.mjs` | **89 / 89**（+4：改正文 / 拒已跑与 running / 交 review 记 `finishedAt`、复核记 `closableAt` / CLI 文本带 `times`） |
| 真实卡 · 改正文 | 5 张 AC/阶段 2.5 卡改成功（纯替换过期路径与前置说明，正文其余照抄）；`updated` 只报实际变了的字段 |
| 真看板 · 冻结规则 | 11 张开放卡 `executions` 全为 0 ⇒ 正文可改；`update` 另外**拒 `running`**（我们的 claim 不写执行记录，见 §4.3） |
| 真看板 · 时间戳 | `tagged … times: created … · updated …`、`done` 后 `closable` 出现；未交 review 的卡不显示 `finished`/`closable`（不打印空档） |
| 重要度标签 | 11 张开放卡全部打上（`I2`×6 / `I3`×5，两张留痕卡另加 `留痕`）；新增容器卡 `61e4535d` 为 `I1` |
| 复查发现的缺口 | **板上没有任何 D 系列卡**，而台账写着「作者指定：接下来重点修复 D1–D18」⇒ 补建容器卡 `61e4535d`（缺陷稿 §2 状态列为准）；派发契约待裁定另立 `c063270b` |
