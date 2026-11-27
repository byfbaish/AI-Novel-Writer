# 给 WorkBuddy 派活（协作通道操作手册）

> 状态：已实施（2026-11-05 实施；2026-11-07 移除 headless 兜底，现只保留 attach 一条路；**2026-11-11 补落点闸门 §2.3**，修三次夜间事故同根问题；**2026-11-12 开草稿改页面内 DOM click**（坐标点击在可滚动侧栏会静默点空），并补「新草稿证据」——见 [`../handoffs/2026-11-12-workbuddy-landing-click-fix.md`](../handoffs/2026-11-12-workbuddy-landing-click-fix.md)）· 实测版本 WorkBuddy 5.9.3（Chromium 138.0.7204.251 / Electron 37.10.3）
> 用途：把 AI-writer 仓库里的活派给本机 WorkBuddy（腾讯 CodeBuddy 系）。**只有一条路：attach**——CDP 驱动桌面 UI，复用作者已登录的账号与积分。
> 关系：与 [豆包通道](doubao-channel.md)、[Copilot 通道](copilot-channel.md) 平级；**工作目录固定 `wt-2`**（[归属表](worktree-parallel.md#31-槽位归属固定不是谁空谁用)）。
> 社区调研：已查 `workbuddy-mcp` / `workbuddy-proxy` / `workbuddy-to-dsh` / `workbuddy-daily-credits` / `dsh-botcrew`，没有现成的「桌面已登录态 + 可编排」轮子，取舍见 §11。

## 0. 一句话读法

> **本通道不是默认通道（主人 2026-11-27 00:30 定，即刻生效）**：外派**默认先走豆包**（大概率不计费）；WorkBuddy 只在①需要特定模型、②需要**非同源评审**（避免自己评自己）时才用——它消耗积分。派 WorkBuddy 必须在派单件里写明这两条理由之一，否则一律按豆包处理。通道顺序的权威句在 `.batch/night/staging/ext-dispatch-header.md` §0。

```bash
# 1) 诊断（只读，不会动 UI）
node scripts/workbuddy/workbuddy-attach.mjs status

# 2) 派活（默认复用上次会话；要新开一条加 --new）
node scripts/workbuddy/workbuddy-attach.mjs task "任务文本" --new
```

连不上时脚本会打印 `NEED_HUMAN_DEBUG` 横幅（exit 2）：把横幅里那条命令**原样发给作者**，让他自己启动。**不要**自己 spawn WorkBuddy.exe——工具会话拉起来的 GUI 会在十秒内被回收（2026-11-05 实测）。

桌面端不方便开时**不要绕道**：headless 兜底通道（`codebuddy -p`，独立 npm 包、单独登录、拿不到桌面积分）已于 2026-11-07 连同 npm 包一起移除（§9）。这种活改派 [Copilot 通道](copilot-channel.md) 或 [豆包通道](doubao-channel.md)——它们本来就是独立进程形态。

## 0.1 派单书必须写死的两条（2026-11-26 定，主人裁定）

1. **禁止交互式提问**。外派 agent 一律不许用「选项卡 / 选择题 / 反问用户」把决策抛回来：这类提问会把会话顶到「请先回应挂起的请求」，输入框写不进任务文本、它自己也不往下跑，整条槽位空占（C5 首例，卡了半小时）。
2. **卡点走文件，不走提问**。真推不动（判据冲突、白名单不够、判据自身矛盾）时，把卡点写成一件：

   `.batch/night/bridge/to-owner/blocker-<YYYYMMDD>-<卡号>.md`

   三段就够：**卡点是什么**（哪两条判据互斥、冲突文件与行）／**已试过什么**（命令与读数）／**需要我方裁什么**（给 2–3 个选项与推荐）。写完继续做其余可做部分，不空等。

脚本侧兜底（同日实施，`workbuddy-attach.mjs`）：等待期间检测到提问卡**立即退出码 6**，把卡片全文落 `ask-card.md`，不再干等到超时；`status --json` 里 `askCardPending` 会直接给真值。所以「被卡住」是一次调用就能看出来的事实，不需要任何轮询。

## 0.2 回执 + 信号件：两个落点缺一不可（2026-11-27 定，C5-pre 事故）

派单书只写回执落点是不够的：没人 watch 的目录不会叫醒任何人。**回执是给人看的，信号件是叫醒人的。**

- **回执落点（人看）**：写在派单书里，执行方交件时落盘。
- **信号件落点（叫醒）**：必须在 relay 的 watch 目录内 —— `C:\dsh-relay\signals\workbuddy\` 或 `C:\dsh-relay\wakeup\workbuddy\`。
- **脚本硬闸**：`--no-wait` 不给 `--signal` **直接拒发**，路径不在 watch 目录也拒发。闸在命令分发层，
  **`say --no-wait` 同样受管**——它也是 fire-and-forget，漏了信号件就是第二个 C5-pre。
- **只有一个写手**：信号件只由 detached `settle-signal` 写，**不往任务正文里塞「收尾自己写信号件」**；
  同路径已有件则跳过（幂等，不会重复叫人）。settler 锁定派单时的 `sessionId`，会话被切走即退出不写。
- **settler 怎么判收尾**：`isSettledSignal`（UI idle + 出现新回复）且连续 3 次稳定，再叠加
  「收到回执文件（`mtime >= 派出时刻`）」或「静默满 `quiet-min` 秒」；命中时**一次性写全**信号件
  （首行 `@workbuddy联络人` + 回执落点 + 收尾摘要 + 末行 `<!-- DONE -->`）。日志落在 `.runtime/workbuddy/settle/`。
- **判定依据要写在件里**：有回执文件按 `mtime >= 派出时刻` 判收尾；没有则退到「界面静默 `quiet-min` 秒」并标注低置信。
- **不能预写占位件**：relay 0.6.8 静默窗口到点即投（DONE 只是提前触发），占位件等于叫醒联络人看空件。
- **信号件必须 @ 联络人**：watch 的 `targetIdentity` 是群地址，缺 `@workbuddy联络人` 一律 `NO_MENTION` 拒收。
- **查漏**：`node scripts/workbuddy/workbuddy-attach.mjs signals`。

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
| 兜底通道 | **无**（headless `codebuddy -p` 已于 2026-11-07 移除，见 §9）。桌面端开不了就改派 Copilot / 豆包 |

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
| 核对真的落在 wt-2 | **两道闸门，`chips.workspace` 不参与**（见 §2.3） |

#### 2.2.1 「空间（分组）」不是目录自动生成的（2026-11-27 实测）

侧栏的空间**不会**因为磁盘上存在同名目录就出现——`C:\develop\workspace\AI-writer\wt-c2` 建好后（含 `node_modules` junction）侧栏里依然只有旧空间，脚本随即报 `no-section`。正确流程是走 GUI：

1. **新建任务** → 2. **选择分组** → 3. **目标目录**；
2. 分组要先「**新建分组 → 关联文件夹 → 保存**」才会出现在选择列表里；
3. 只有「新建任务 → 选择该分组」这一条路能得到落在指定目录的会话。

脚本报 `no-section` 时的正确说法是「**需先在 GUI 新建分组并关联该文件夹**」，**不得写成「目录不存在」**——目录在、分组没建是两回事，误判会让人去查磁盘。

**不要**用 `spawn(WorkBuddy.exe, [cwd])` 开新会话：second-instance 转发不可靠（2026-11-05 两次实验：sqlite 里 12s/30s 都没出现新行）。
**不要**用 `window.wb.conversations.setCurrentConversation(id)` 切会话：返回 `{ok:true}` 但界面不载入（实测 msgs=0）。切会话一律**点卡片**。

### 2.3 落点闸门：派活到底落在哪个目录（2026-11-11 事故后补齐）

**为什么单列一节**：三次夜间事故的共同根因是「会话落地的根目录 ≠ 任务书里写的绝对路径」，而开窗后**没有任何一条通道能验证这件事**。这一节就是那条通道。

**命名对照**——三个平台对同一个概念各叫各的，别混：

| 平台 | 叫法 | 等价物 |
|---|---|---|
| WorkBuddy | **空间**（侧栏按 cwd 分组的会话列表，标题 = `basename(cwd)`） | 点标题右侧 `+` 才在该目录下开新会话 |
| DSH | **工作区**（`--cwd`） | 有 `--cwd` 但**无校验** |
| 豆包 | **项目**（`bootstrap.mjs --project <名>`） | 三者中唯一有显式选择操作 |

**两道闸门**（已实现在 `workbuddy-attach.mjs`，纯函数判定在 `attach.mjs` 的 `judgeLanding`，有单测）：

| # | 时机 | 判据 | 不通过 |
|---|---|---|---|
| ① | **打字之前** | 点 `+` 前后取 `window.wb.conversations.currentId`：**未变化 ⇒ 新草稿没打开、编辑器还停在上一条会话上 ⇒ 拒** | `[refuse]` 抛错，**一个字都不打** |
| ② | **发出之后 8s 内** | 按 `currentSessionId` 回查 sqlite `sessions.cwd`，与 `--cwd` 比对 | `cwd-mismatch` ⇒ 当场失败；未落库 ⇒ 标 `landing=unverified` 并写进产物 |

- **`chips.workspace` 有两种形态**：会话里读到 `null`（实测恒 null），草稿里读到**空间名**（如 `wt-2`），个别版本可能给完整 cwd ⇒ 代码用 `workspaceMatches()` 两种都接。旧代码 `const workspace = chips?.workspace ?? null; if (workspace && ...)` 因为 `?? null` + 真值判断，**从未真正校验过**；现在读到 null 会打 `[warn]` 显式说明，不再假装通过。
- **开草稿靠页面内 DOM `click()`，不用坐标**（`buildSpaceClickExpression`）：坐标点击要先 `scrollIntoView` 再 `getBoundingClientRect`，侧栏可滚动时算出的位置与按钮实际位置错位，而 CDP 鼠标事件**点在空处不报错** ⇒ 静默「点了没反应」，闸门 ① 随后判 `stuck`。2026-11-12 实测：同坐标点 `+` 页面快照完全不变，页面内 `.click()` 则 `currentId` → null。
- **闸门 ① 之后还有一道「新草稿证据」**：`switched-unverified`（`currentId` 既没停在旧会话、也还没落库）时，必须 `currentSessionId=null` + `messageCount=0` + 编辑器空（欢迎文案按空算）三件同时成立才放行；否则 `[refuse]`。因为 DOM click 本身不产生「点没点中」的信号，不能只凭 `{clicked:true}` 就打字。
- **夜间无人值守的唯一硬前提**：**会话落地的根目录必须等于任务书里所有绝对路径的父目录**。做不到就别派——任何一处越界都会在无人值守时变成提权确认框，而确认框没人点。
- **跨目录派活（如 wt-2 ↔ develop）已实测可行**：`--cwd <目标> --force --new` 三段往返（wt-2 → develop → wt-2）全部 `[ok] 落点已证实`、无提权框。注意 `--force` 只越过归属护栏，**不越过落点闸门**。

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

选项：`--session <id>` · `--timeout 秒`（默认 900）· `--json` · `--no-wait --signal <信号件路径>`（路径须在 `C:\dsh-relay\signals\workbuddy`，§0.2）· `--receipt <回执路径>` · `--port` · `--model <名字>`（见 §4）· `--cwd <目录>`（默认且只允许 wt-2；指到别处 exit 1）· `--force`（越过归属护栏，排障用，报告里写明）。

退出码：**0** 成功 · **1** 失败 · **2** 未连接（`NEED_HUMAN_DEBUG`）· **4** 等回复超时 · **5** 高峰时段拒绝派活。（原 **3**「兜底 CLI 缺失」随 headless 通道一起作废，见 §9）
和豆包一样：**exit 0 只代表「拿到了稳定回复」，不代表任务做对了**——对错看任务书里的验收条件和 `## [Tn] DONE/BLOCKED` 标记。

### 3.1 固定归属：WorkBuddy 只用 wt-2

| 槽位 | 目录 | 归属 |
|---|---|---|
| slot 0 | `develop` | 主控平台（不一定是 WorkBuddy / DSH） |
| slot 1 | `wt-1`（5181 / 9223） | 豆包 |
| slot 2 | `wt-2`（5182 / 9224） | **WorkBuddy（本通道）** |
| slot 3 | `wt-3`（5183 / 9225） | DeepSeek Harness |

- 归属固定、不抢：WorkBuddy 不许在 develop 或 wt-1 里改文件；`--cwd` 指到别处会**直接 exit 1 拒绝**（`checkPinnedCwd`），只有 `--force` 能越过，且必须在报告里写明原因。
- **夜间无人值守禁止 `--force` 跨目录派活**（2026-11-11 教训）：`--force` 只是关掉了归属护栏，并不会让会话真的落到那个目录——端口/空间的对应关系仍由侧栏决定，结果就是「显示已发送、目标文件一个没写」，而且无人值守时没人看见。**需要 develop 的产物就由 Lead 自己跑**（这是计划稿 §0-5「develop 由 Lead 独占」的由来），不要用 force 把 WorkBuddy 派进去。
- 分配前分支要 reset 到主线 HEAD（`git -C ../wt-2 reset --hard <main HEAD>`），否则平台在旧提交上干活。
- 细则与「运行态 ≠ 归属」的探测方法见 [worktree-parallel.md §3.1 / §11](worktree-parallel.md)。

## 4. 模型策略（派活前自动生效）

用户 2026-11-05 拍板：**只允许两个模型**，其余一律不选（Hy3 全天免费但能力弱，明确不要）。

**2026-11-07 20:2x 作者订正**：Hy4 在 **2026-11-15 之前全天候免费，但日内有额度上限**。促销期优先于原时段表 ⇒ 促销期内任何时段都走 Hy4、白天不再触发 DeepSeek 高峰拦截；促销结束后自动回落到原表，无需改代码。

| 时段（本地时区） | 模型 | 依据 | 脚本行为 |
|---|---|---|---|
| **≤ 2026-11-15 全天（促销期，含末日）** | **Hy4** | 全天候限免促销（作者 2026-11-07 订正），日内有额度上限 | 自动切到 Hy4；`window=hy4-promo-all-day`。**撞日额度上限**时按 §13 识别特征（连续两次秒回 + 兜底文案）改派 `--model DeepSeek-V4.1-Flash` |
| 促销期后 · 每天 23:00–次日 08:00 | **Hy4** | Hy4 preview 夜间限免（腾讯公告，IT之家 2026-10-02 转载） | 自动切到 Hy4，若当前不是 |
| 促销期后 · 周一至周五 09:00–12:00、14:00–18:00 | —— | DeepSeek-V4.1-Flash 原价高峰（腾讯云 2026-10-22） | **拒绝派活**：exit 5 + `PEAK_HOURS` 横幅（含立即重跑命令） |
| 促销期后 · 其余时段（含周末全天） | **DeepSeek-V4.1-Flash** | 0.11x 倍率 + 非高峰 5 折 | 自动切到 DeepSeek-V4.1-Flash |

- 时段常量集中在 `scripts/workbuddy/model-policy.mjs`（`HY4_PROMO_ALL_DAY_UNTIL` / `HY4_FREE_WINDOW` / `DEEPSEEK_PEAK_*`），规则变了只改这一处，文档同步改表。促销截止日到了会自动失效，不需要改代码。
- **日额度上限本模块不探测**：`status` 不返回剩余额度，也没有结构化错误码 ⇒ 只能靠 §13 的运行期识别特征判定，属「已知不可自动化」项，别指望脚本提前拦。
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

已验证（2026-11-12，落点闸门专项）：
- **闸门 ① 真机复现**：同一台实例、同一空间，`--new` 在坐标点击版本下稳定命中 `[refuse] 点「+」后当前会话仍是 …，新草稿没打开`，**一个字都没打出去**；页面内 DOM `click()` 版本下同命令立刻 `[ok] 已确认是新草稿…` → `[ok] 落点已证实：会话 <新id> @ …/wt-2`。
- **闸门 ② 真机复现**：发送后按 `currentSessionId` 回查 `sessions.cwd`，三段（wt-2 → develop → wt-2）全部 `[ok] 落点已证实`，`sessions` 表里三条会话的 cwd 与 `status=completed` 都对得上；全程无提权确认框。
- **跨目录 `--force`**：`--cwd …\develop --force --new` 可用；`--force` 只越过归属护栏，落点闸门照旧生效。
- **无消息新草稿的现场特征**：`currentSessionId=null`、`messageCount=0`、`editorText` 是 25 字符欢迎文案「今天帮你做些什么？@ 添加上下文，/调用技能与指令」、`placeholderVisible=false`、`chips.workspace="wt-2"`（空间名形态）。

已验证（2026-11-05，通道基础能力）：
- CDP 连接：`/json/version` 返回 `WorkBuddy/5.9.3`、Chromium `138.0.7204.251`；单 page target（`app.asar/renderer/index.html`）。
- 只读诊断 `status`：端口/版本/编辑器/runState/chips/当前会话/最近会话全通。
- 中文 `Input.insertText` + 真实鼠标点 `button[aria-label="发送"]` + 从 `.cr-agent .cr-markdown` 取干净正文（无 `WorkBuddy/已完成/共消耗` 噪音）。
- 复用会话（点卡片）与开新会话（点空间 `+`）两条路都跑通；新会话落库 `cwd=C:/develop/workspace/AI-writer/wt-2`。
- 模型自动切换：Hy3 → Hy4 切换 + 读回校验通过。
- **端到端真跑**：`task "只回复两个字母 OK，不要别的内容" --new --timeout 240` → exit 0，25s，reply=`OK`，产物四件套齐全（prompt/meta/reply/snapshot），末尾 markers 为空。

未验证（要用先测）：
- **DSH 侧「受限令牌 append 已存在日志被 ACL 拒 → `approval/asked`」仍无第二次复现**（2026-11-10 卡死那次的现场只留有日志文本），也不要指望本通道的闸门能替它兜底：那是进程权限档的问题，与落点无关。
- **`resumeSession()` 切卡片仍走坐标点击**（见 §7 未验证项与 [`../handoffs/2026-11-12-workbuddy-landing-click-fix.md`](../handoffs/2026-11-12-workbuddy-landing-click-fix.md) §5-1）：点偏时函数会返回成功、且若原会话 cwd 恰好等于目标 cwd，闸门 ② 会判 `cwd-ok`；真机尚未制造过这个场景。
- 长任务（>10 分钟）在轮询下是否会被 UI 虚拟滚动影响；`waitForSettled` 靠 `agentCount` 增长 + 正文两次一致，超长输出可能需要调 `--timeout`。
- 高峰拦截（exit 5）只在单元测试里覆盖过时段判断，尚未在真实工作日高峰实跑。
- 同时开两条 WorkBuddy 会话并发派活：本通道假设「当前只有一条会话在跑」，并发需另做隔离。
- 欢迎文案（新草稿编辑器的 25 字符占位句）是硬编码前缀匹配：WorkBuddy 改文案时会 fail-closed 报错，不会静默放行；报错里带字符数与占位可见性，改 `heroCopy` 正则即可。

## 8. 失效判据与恢复

| 症状 | 先查 |
|---|---|
| `status` exit 2 / `NEED_HUMAN_DEBUG` | 9333 没监听：按 §2.1 让作者重启 Debug 实例；确认旧实例已在托盘退出 |
| `/json/version` 通但 `hasEditor=false` | 页面还在启动或开的是别的窗口；等 5s 重跑 `status` |
| 「侧栏找不到空间 wt-2 的新建按钮」 | 该目录还没在 WorkBuddy 里打开过：让作者打开一次 wt-2。**不要**换目录——归属固定，`--cwd` 指到别处会被拒 |
| `[refuse] 点「+」后当前会话仍是 xxx，新草稿没打开` | 闸门 ① 命中：`+` 点了但界面没切走。手工在侧栏点该空间的 `+` 开一张空草稿，确认编辑器为空后重跑；**不要**改任务书重试（任务书没问题）。若日志里先出现的是「已确认是新草稿」，这条就不是命令点击问题，按下一行查 |
| `[refuse] 点了「+」但没拿到「这是新草稿」的证据` | 页面内 DOM click 也没生效，或 WorkBuddy 改了空草稿外观（欢迎文案/占位符）：先 `status --json` 看 `chips.workspace` 是否为 `null`，再手工开一张空草稿对照；若编辑器有内容但不是欢迎文案，改 `heroCopy` 前缀（`workbuddy-attach.mjs`）。**不要**放宽成「只要有编辑器就放行」 |
| `[refuse] 任务已发出，但落点不对：cwd=… 期望=…` | 闸门 ② 命中：任务投到了错误目录。**不要直接重跑**（会重复投递），先去界面处理那条会话，再按 §2.3 检查空间是否真的对应目标目录 |
| 派活「成功」但目标目录没有产物 | 先 `status --json` 看 `recentSessions[].cwd` / `recordedSession.cwd`，再看产物里的 `landing.verdict`：`switched-unverified` = 当时没能证实落点，按 cwd 回查 |
| 「模型选择器里没有 X」 | 模型下架/改名：`status` 看 `chips.model`，用 `--model` 试现名，再更新 `model-policy.mjs` 白名单 |
| 发送后输入框还有内容 | 发送按钮被挡（弹层/草稿）：`read` 看有没有回复；重跑会先清空编辑器 |
| 等回复超时（exit 4） | 模型在长思考：加大 `--timeout`；或 `read` 看看是否已经答完只是没触发稳定信号。**2026-11-05 踩过**：界面早就答完却一直 exit 4，根因是收尾基线取在「打开新草稿之前」的快照上（`agentCount=1`），`grew` 永远 false ⇒ 已改成打字后取基线 + `messageCount +2` / 正文变化兜底（`isSettledSignal`，有单测） |
| 回复里混进 `WorkBuddy/已完成/共消耗` | `.cr-markdown` 选择器变了：改 `attach.mjs` 的 `SELECTORS.agentMarkdown`，补一条单测 |
| 点击全都不生效 | 先分清是哪一种：**开草稿**走页面内 `element.click()`（2026-11-12 起；切卡片与发送按钮仍走 `clickRect()` 坐标点击），若连它都不生效多半是 UI 结构变了（`.collapsible-section` / `.workspace-new-task-button` / `data-conversation-id` 改名）——跑 `status` 核对 `buttonLabels`，改 `attach.mjs` 的 `SELECTORS`；**发送按钮/模型选择器**仍走 `clickRect()` 坐标点击，点了没反应就是坐标算偏（侧栏滚动/窗口缩放），先看日志有无 `[warn] 点发送` 再考虑重跑 |

## 9. headless 兜底通道：已移除（2026-11-07）

作者只用 WorkBuddy 桌面端。那条「另装一套 CLI、单独登录、拿不到桌面积分」的兜底路已于 2026-11-07 撤销：

- **删掉的**：npm 全局包 `@tencent-ai/codebuddy-code`（2.179.3，333MB）与 5 个命令外壳（`codebuddy` / `codebuddy-code` / `cbc` / `cbc-prewarm` / `codebuddy-lowmem`）；仓库内 `scripts/workbuddy/workbuddy.mjs`、`cli.mjs`、`__tests__/cli.test.mjs`。其中运行目录名 / slug / 参数切分三个纯函数 attach 一直在用，已并入 `attach.mjs`。
- **没删也不能删**：`~/.codebuddy/`（名字像 CodeBuddy，实际是 WorkBuddy 运行时自己的配置目录，`settings.json` / `models.json` 一直在写）、`%LOCALAPPDATA%\CodeBuddyExtension\`（桌面端登录态）、以及桌面端自带的 `…\WorkBuddy\resources\app.asar.unpacked\cli\bin\codebuddy`（WorkBuddy 本体）。
- 桌面端开不了时**改派 Copilot / 豆包**，不要再装第二套 CLI。

### 9.1 仍然成立的两条教训（别重犯）

1. **别打桌面端 GUI sidecar 的 HTTP 口子**：桌面端会拉起 `codebuddy --serve`（随机端口 + 随机密码 + `/api/v1/*`），密码只在进程环境里；`POST /api/v1/jobs` 会继承父进程 `--port` 撞端口（实测把 GUI sidecar 搞挂）。要任务面走 §1–§8 的 CDP 路。
2. **桌面端登录态不能复用**：token 在 `%LOCALAPPDATA%\CodeBuddyExtension\Data\Public\auth\workbuddy-desktop.info`，值是 `$wbEncrypted` 信封（AES-256-GCM），解它要借 `WorkBuddy.exe` 的 Electron binding；把 `CODEBUDDY_CONFIG_DIR` 指到 `~/.workbuddy` 也解不开。**不要为了「免登录」去解它**——版本一升就碎，等于绕过人家账号体系。

> 编号说明：原 §10（headless 一次性登录）已并入本节，编号 10 不再使用——保留 §11–§13 的原号，避免全库「§11 社区方案」「§13 能力画像」的引用失效。


## 11. 社区已有方案与取舍（「优先社区」的调研结论）

| 项目 | 是什么 | 为什么没直接用 |
|---|---|---|
| `LinHaiJ/workbuddy-mcp`（npm `workbuddy-mcp` 0.2.0, MIT） | 极简 MCP server，只暴露 `run_workbuddy_task`，内部 `spawn codebuddy -p` | 形态是 **MCP 宿主插件**，本项目通道要「CLI 脚本 + 手册」才和 Copilot/豆包同构；**但两条硬经验照搬**：prompt 走 stdin、超时用 `taskkill /T /F` 杀进程树 |
| `banana770/workbuddy-proxy` | 把桌面端已登录账号的模型转成本地 OpenAI/Anthropic 网关 | 只复刻**模型 API**，不是 agent 通道，也没有文件/终端副作用可校验 |
| `3304711297/workbuddy2api` | Tauri 控制台，浏览器授权后提供三种协议网关 | 同上：把 WorkBuddy 当模型用，不是把活派给它 |
| `Ianzhyh/workbuddy-to-dsh`（MIT） | DSH 插件，解桌面端加密凭据后复用账号 | 解 `$wbEncrypted` 脆（陷阱 5）；我们改走官方 attach / 官方登录 |
| `XQ-zheng/workbuddy-daily-credits` | 自动领积分 / 打卡，长效令牌自续期 | 跟「派活」无关；只借它证明「令牌可长期续期」，本通道仍走人工 |
| `hankniu77/dsh-botcrew` | DSH 群聊里接 WorkBuddy/QwenWork 的成员面板 | 是聊天编排层，不是进程级通道；可作上层编排参考 |
| 官方 `workbuddy.ai/docs/cli/headless` · `codebuddy.ai/docs/cli/http-api` | headless 模式与 HTTP API 规范 | headless 那条已随通道一起撤（§9）；HTTP API 只服务过 `login` 的 Web UI，不做任务面 |

结论：**没有现成的「桌面 GUI + 已登录态 + 可编排 CLI」项目**，所以自研了一层 attach 薄层（复用桌面登录态与积分，§1–§8）。曾经并行过的 headless 薄层已于 2026-11-07 撤除（§9）。

## 12. 相关文档

- [豆包通道](doubao-channel.md) —— 本通道的范式来源（NEED_HUMAN_LAUNCH / 任务书骨架 / markers / 只准单测）
- [Copilot 通道](copilot-channel.md) —— 另一条外部 agent 通道（独立 CLI 进程）
- [worktree 并行开发](worktree-parallel.md) —— 槽位归属表、占用探测、并行红线
- [任务看板通道](task-board-channel.md) —— 建卡 / 认领 / 复核
- 官方文档：<https://www.workbuddy.ai/docs/cli/headless>

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

**额度锁与模型兜底（2026-11-05 实测补充）**

- Hy4 夜间免额是**产品侧额度**，`status` 不返回剩余额度、也没有结构化错误码；CLI 会在拿不到回复时把兜底文案当普通回复返回，**退出码仍 0**。
- 识别特征（实测）：连续两次秒回（9s / 21s）且回复为「抱歉，发生未知错误暂无响应。您可以稍后再试，或尝试新建任务、切换模型。」，`markers` 为空、无新产物目录。**满足即视为疑似额度锁**（不是任务写错，不要改任务书重试）。
- 处置：按作者 2026-11-05 规则，直接改派备用模型 `--model DeepSeek-V4.1-Flash`（`task --file … --new --model DeepSeek-V4.1-Flash`，无需等人工）。切模型成功的判据=拿到首条真实工作回复（例：「我先完成开工前置步骤…」），不是退出码 0。
- 不要为额度锁自行领取/续期积分（§11 的 `workbuddy-daily-credits` 类工具），也不要反复重试同一模型超过 2 次。
