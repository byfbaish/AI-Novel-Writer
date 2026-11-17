# P10 · 先解析后标记：解析不到目标时不许吞掉投递

卡号：P10
仓库：`C:\develop\workspace\dsh-handoff-relay`
基线：HEAD `51b9b73`（P9 已提交），porcelain 空
执行方：豆包（经豆包联络人派卡）

## 现场事实（重启后 22:36 轮，已由 developer 取证）

- 重启后 `signals\doubao\wake-later.done`（176B，21:54:49）**留在原地、未投递、`delivered\` 无新增**。
- `relay.log` 只有 1 行 `启动 7/7 个 watch` INFO，**无 WARN** ⇒ 失败路径没写进日志。
- 成因：`index.js:490` `deliver()` **先把 key 记进内存 `delivered`**，`:494` 才开始解析目标；解析不到就 `:495` 直接 `return`——既不移动文件、也不写 `relay.log`。
- 该 key 已被标记，之后同一快照（未变 mtime）的事件全被 `:538` 挡掉，直到文件 mtime 变化或再次重启。
- 时序证据：启动行 `14:36:41.558Z`，目标会话 `4380d607` 首次写入 `22:36:53`，**晚 11 秒** ⇒ 启动扫描早于会话注册表就绪。
- 这条写序在 `6563d27` 就存在，不是 P9 引入。

## 目标（只修这一条，不扩功能）

1. **先解析、后标记**：`deliver()` 里目标解析（含 `targetSessionId` 与 `targetTitle` 两条分支）必须在 `delivered.add(key)` 之前完成；解析失败直接 return，**不标记**，这样文件保持"未投递"状态。
2. **解析不到必须留痕**：写一行 WARN 到 `relay.log`（沿用 P9 的日志文件与格式），内容至少含：文件名、目标标识原样、原因（`agent-not-found` / `title-no-match` / `title-multiple`）。
3. **启动扫描遇到解析不到不许静默放弃**：保持文件在 watch 目录、不标记已投；等下一次文件事件（mtime 变化）或下一次重启再试。**不做无限重试轮询**（不新增定时器）。
4. 日志级别与格式沿用 P9 现有实现，不新增字段、不新增第二份日志文件。
5. **加载期每条 watch 必须留一行解析结果**（developer 补，否则下次解析不到仍然查不到是哪条 watch）：
   `resolved=<会话 id>` / `agent-not-found` / `title-no-match:<命中数>` / `title-multiple:<命中数>`，行里带上该 watch 的 `dir` 与目标标识原样。
   只在加载/解析时写，**不对每次投递成功写**（成功投递仍保持零日志，避免把 relay.log 写成流水账）。

## 判据（提交前自己跑，并在报告里贴原始输出）

1. `node index.test.mjs` 的 `TOTAL:` 行 **≥ 77/77 且一条不许删**（允许等价改写被本条修改行为影响的用例，改写须在报告里逐条说明）。
2. 新增用例至少覆盖三条：①解析失败后 `delivered` 里**没有**该 key，同 mtime 再触发一次仍会重新尝试（证明没被吞）②解析失败确实写出 WARN 行且含目标标识与原因 ③解析成功后正常投递并移走。
3. `source:` 那行**逐字不变**——按内容比对，不看行号、不看 `git diff` 行数（仓库无 `.gitattributes`、`core.autocrlf=true`，`git status` 会报 LF→CRLF 警告）。
3b. 启动期 7 条 watch 各自写出解析结果行（见目标 5），成功解析的写 `resolved=<id>`，解析不到的写原因；这条要有测试覆盖。
4. `git status --porcelain` 只允许出现 `M index.js`、`M index.test.mjs`（不许新增文件，测试一律用临时目录，不许碰 `scripts\dsh\wakeup-inbox`、`.batch\night\signals`、`.batch\night\bridge` 任何生产 watch 目录）。
5. 报告落 `.batch\night/reports/p10-resolve-before-mark.md`，贴 `git diff --numstat` 原始输出，末行 `<!-- DONE -->`；信号落 `.batch\night\signals\doubao\p10-resolve-before-mark.done`。

## 边界（违反即返工）

- 只改 `index.js`、`index.test.mjs` 两个文件。
- `git add` 必须点名 `index.js index.test.mjs`，**禁止 `-A`**、禁止 `git commit`（由负责人验后提交）。
- **禁止重启 DSH**、禁止改 `cordis.patch.yml`、禁止动 `~\.dsh\profiles\desktop\dsh-handoff-relay\` 下的状态文件。
- 不许为测试在真实 watch 目录里放任何文件（上一轮就是这样污染现场的）。
- 静态芯片文字只作证据不作判定；本卡属代码类，开工前手动切 DeepSeek V4.1 Flash，回执贴芯片原文。

预估工时：50 分钟。
