# P23 重启自动化 · 五条可行性事实（只读取证）

取证时间：2026-11-14 06:03–06:15（Asia/Shanghai）。范围：只读、未写脚本、未改配置、未重启、未碰远端。

## 1. 桌面端可执行文件与计划任务拉起

命令：

```
Get-Process | Where-Object { $_.ProcessName -match 'DeepSeek|dsh|Harness' } | Select-Object Id,ProcessName,MainWindowTitle,Path
Get-CimInstance Win32_Process -Filter "Name='DeepSeek Harness.exe'" | Select-Object ProcessId,ParentProcessId,CommandLine
```

原始输出（节选，均已实测）：

```
   Id ProcessName      MainWindowTitle                    Path
 3276 DeepSeek Harness                                    C:\develop\software\DeepSeekHarness\DeepSeek Harness.exe
29088 DeepSeek Harness                                    C:\develop\software\DeepSeekHarness\DeepSeek Harness.exe
47544 DeepSeek Harness AI writer项目组 — DeepSeek Harness C:\develop\software\DeepSeekHarness\DeepSeek Harness.exe
57808 / 58680 / 60756 / 64424（gpu / renderer / network utility / audio utility，同上路径）
```

- 可执行文件绝对路径：`C:\develop\software\DeepSeekHarness\DeepSeek Harness.exe`
- 主进程 47544 命令行只有 exe 本身，无参数；父进程 13388 = `explorer.exe`（用户双击/开始菜单启动）。
- 宿主进程 29088（主进程子进程）命令行带全部路径参数，说明路径不依赖工作目录：
  `--expose-internals ...\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\index.js ...\resources\app.asar\dsh C:\Users\<用户名>\.dsh\profiles\desktop ...\runtime\primary-runtime ...\pnpm.mjs ...\runtime\bin`
- 单实例锁：`asar-tokens.py 'requestSingleInstanceLock'` → 总命中 1，且唯一命中在 `node_modules/electron-updater/out/providers/GitLabProvider.js`（依赖自带），应用自身代码无此调用 ⇒ **没有单实例保护证据**，重复拉起可能起第二个实例（55990/63513/8326 端口冲突风险）。
- 计划任务身份：`scripts\dsh\wake-later.ps1:316` `New-ScheduledTaskPrincipal -UserId $userName -LogonType Interactive -RunLevel Limited`，`:303` 明确「-LogonType Interactive（免管理员）」，`:311` 用 `-WakeToRun -StartWhenAvailable`；同文件 `:322` `Register-ScheduledTask` 已在本机成功注册过任务（`schtasks /Query` 可见 `\dsh-wake-20261114-1005-6263`、`\dsh-wake-20261114-1800-5718`、`\dsh-hibernate-1113`）。
- 结论：**可行（用户已登录时）**。`Start-Process -FilePath 'C:\develop\software\DeepSeekHarness\DeepSeek Harness.exe'` 不需要参数、不需要指定工作目录（所有路径绝对/相对 exe 解析）；身份用 Interactive（免管理员），S4U + RunLevel Highest 需要管理员。限制：Interactive 任务只在用户登录时运行；锁屏下 Electron 能起进程但窗口不可见。

## 2. relay 启动期能否收下并投出「重启完成」信号

证据（`C:\develop\workspace\dsh-handoff-relay\index.js`）：

- `:951` `watcher = fs.watch(watchDir, { persistent: false, encoding: 'utf8' }, ...)` —— **先建监听**，再 `:963` `for (const rel of listFiles()) consider(rel)` 扫启动前已存在的文件。
- `:964-972` 只有「加载时目标解析不到」（`!atLoad.ok`）才排 `scheduleStartupRescans`，延迟 `:31 RETRY_DELAYS_MS = [1000, 5000, 15000]`，注释 `:508` 写明「最多 MAX_SCAN_ATTEMPTS 次，总窗口 21s；成功即停止」。
- 投递前现解析：`:875 const resolved = resolveNow(relName)`；失败时 `:876-880` 只写 warn「解析不到目标，保持未投递」并 `return` —— **不写 delivered、不移动文件**，文件留在源目录。
- `:942-949` 首个 fs.watch 事件会先做一次全量重扫（latch 只做一次）；`:953-954` 之后每个事件走 `consider(filename)`。
- 目标选择：`:838` 有 `targetTitle` 先按标题匹配（`exact` 缺省 true＝全等），`:841-845` 标题 0 命中或多义才用 `targetSessionId` 兜底；`:826-836` 只有 id 的旧形态直接 `get(id) → roots()`。

结论：**信号不会丢（文件留在源目录、不标记已投）**，但重试时机只有三类：① 加载时目标不可解析 → 1s/5s/15s 三次重扫（21s 窗口）；② 首个文件系统事件触发的一次全量重扫；③ 之后任意新的文件系统事件或插件重载。**风险窗口**：信号若落在启动后 21s 之外、且落盘那一刻目标会话仍未 live，则没有自动重试，要等下一条事件/重载 —— 表现为「文件在、没被投」而不是「丢了」。若脚本在 DSH 起来后立刻投，正常会落进窗口内。

## 3. 兜底分支：`disabled: true` 之后谁投「已停用插件」信号

不依赖 relay 的通道（≥2，含代价）：

- a) **宿主内置 /schedule 定时任务**（DSH 自带 scheduled task，独立于 relay 插件）。代价：需预建任务、只能在宿主内生效；宿主没起来时同样不投。
- b) **`dsh-win-notify`**（`C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\dsh-win-notify` 已装）：Windows 通知中心弹告警。代价：**只给人看，Bot 收不到**，不能自动化消费。
- c) **外部执行方/计划任务直接落状态文件 + 写日志**：重启脚本在 `~/.dsh/` 下写一份 `last-restart.json`，由重起来的 Bot 在首次会话主动读。代价：需要「有人/有 Bot 主动去读」这一步，否则等于没通知；好处是完全不依赖任何插件。
- d) **另挂一份 relay 实例**（不同 loader id、独立状态目录）专职投兜底信号。代价：同 bug 域、等于不信任被禁用的那一个，且多一个加载器条目。
- e) **Web GUI 不能当通道**：`curl http://127.0.0.1:55990/` → `HTTP/1.1 401 Unauthorized`，body `dsh web authentication required; reopen the URL printed by dsh web.`；token 由 `dsh-web-app/lib/index.js:160 connectionCtx.connection.authenticatedUrl(webUrl)` 运行时生成、不落盘（`.dsh` 下无 token 文件），脚本拿不到。

结论：**可行的是 a/b/c/d，但都只解决「通知」不解决「投递闭环」**；若要求「Bot 一定能收到」，只能靠 a（宿主内定时任务）或 d（第二份 relay）。选哪条属方案决策，我不下判定。

## 4. 杀进程安全边界

- 进程树（实测）：主 `47544` → 子 `29088`（宿主）、`57808` gpu、`60756` network utility、`58680` renderer、`64424` audio utility、以及宿主的子进程（如本次取证时 `48920` 是 PowerShell 工具执行器）。
- 整棵杀：`taskkill /PID 47544 /T /F`（`/T` 覆盖全部子进程）；杀前先确认只有一个 `DeepSeek Harness.exe` 主进程（无单实例锁，见第 1 条）。
- 会丢什么：**正在执行的 turn**（进行中的模型调用/工具执行中断，本轮未落盘的部分丢失）。session 是增量写 zstd JSONL，例：`C:\Users\<用户名>\.dsh\sessions\--C-develop-workspace-AI-writer-develop--\session-f31200e9-f8f9-425a-80a5-763c442665b3\session.v4.jsonl.zstd`（取证时 LastWrite 06:08:59）—— 已写记录不丢，未写的这一轮丢。
- 「先等空闲再杀」判据：**没有外部 busy 标志**（运行态在宿主内存里，`sessions` 服务的 `running` 字段是渲染层内存态，脚本读不到）。可用的只是「该会话 jsonl 的 mtime 静默 N 秒」这一代理指标；长工具调用期间也会静默 ⇒ 只能当启发式，不能当保证。结论：**可执行但只能做到尽力**；要严格，需 Kill 前让脚本先投一条「即将重启」消息并等目标会话回执（又把依赖绕回 relay）。

## 5. 重启后能否无人值守打开设置页并截图

- `Get-NetTCPConnection -State Listen` 只听 `127.0.0.1:63513`（宿主 IPC）、`127.0.0.1:55990`（Web GUI）、`127.0.0.1:8326`；**9222 未监听**，宿主命令行无 `--remote-debugging-port`，`asar-tokens.py 'remote-debugging-port'` 全 asar **0 命中** ⇒ 应用自身不会开 CDP。
- 55990 需鉴权（401），token 只在启动时打印、不落盘 ⇒ 脚本无法用 Web GUI。
- 可行路径只有两条，**都需主人授权**：
  1. 启动参数加 `--remote-debugging-port=9222`（仅回环）。之后 CDP 可截图、可点「设置→插件→配置」。代价：改了启动方式；本机任何进程都能连 9222 控制应用（安全面）。
  2. Windows 抓屏 + UIAutomation 脚本点进设置页（`CopyFromScreen` 截图）。代价：窗口必须在前台、不能锁屏；还要写 UIA 点击脚本，脆。
- 结论：**现有条件下不可行**；不重启改参数、不写 UIA 脚本，就做不到无人值守截图 —— 真机看图这一步仍需惊动主人。

## 一句话汇总

拉起可行（Interactive 计划任务，免管理员）；信号不丢但重试只有 21s 窗口+事件驱动；插件禁用后无「Bot 必达」的独立通道（只有通知类）；整棵杀用 `taskkill /T /F`、空闲只能靠 mtime 静默代理；无 CDP、Web 需 token ⇒ 自动截图不可行（除非授权开 9222 或写 UIA 脚本）。

<!-- DONE -->
