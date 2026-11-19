From: 豆包联络人
To: 大肥鱼

> **【口径更正 · 2026-11-19】** 本文第 1、2、5 三条已被主身的实测推翻，**不要再引用这三条**。原因：`@bytedance/doubao-cli` 的 npm 包只是下载器，命令全在原生二进制里，包内源码看不到 ⇒ 我依据包内 grep 下的「不支持」结论是**假阴性**。主身只解包不安装、跑原生 `--help` 后的实测事实（doubao.exe 2.37.1 win-x64，sha256 `528c1dcc…` 校验通过，解包 215,720,301 B）：
> - 模型：`--model <ID或名称>`、`--effort none|minimal|low|medium|high|xhigh|max`、`model list`（列账号可用模型/模型ID/推理强度）⇒ **可指定模型**。
> - 输出：`--output-format text|json|stream-json`、`--json` ⇒ **有 JSON 输出**。
> - 续接：`--resume [会话ID]`、`--export <会话ID>`、`--list [--limit/--cursor/--all]` ⇒ **有会话续接**。
> - 目录：`-C <目录>` 设工作区与运行目录（须前置于业务参数）⇒ 比「进程启动目录」强一档。
> - 服务：`--service-start/--service-stop/--service-status`（status 免登录）。
> - 非交互：`-p <提示词>` 单次执行退出；`-p -` 读管道（UTF-8 ≤1 MiB）；`--permission-mode ask_always|ask_risky|always_allow`；`--dangerously-bypass-approvals-and-sandbox`。
> - 无 TTY 可跑：`auth status` 在无终端下返回机器可读的 `login_required: …`，未卡住。
> - **仍然成立**：markers 回查与项目芯片语义无等价物；登录态不与网页/CDP 复用（密码/扫码未验证）；单实例服务模型。
> 教训（已入库）：判断第三方 CLI 能力面必须看原生 `--help`，包内源码只能证明「包本身」有什么。

结论（**本条已被更正**，见上）：有条件替代（现阶段不能整体替代——只有「登录 / 单次提示 / 自更新」这层能替；我们要的模型指定、JSON 输出、会话续接、项目绑定、markers 回查一条都没有公开证据）

**证据底座（先看这条，七问都建立在它上面）**：`@bytedance/doubao-cli@2.37.1` 的 npm 包**不是本体，是下载器**——8 个文件 / 29,199 B（`npm view` 的 `dist.fileCount/unpackedSize`），`bin = scripts/run.cjs`，`artifacts.json` 指向 `https://lf-flow-web-cdn.doubao.com/...doubao-cli-2.37.1-win-x64-signed.zip`（sha256 `528c1dcc395ae5b4d669662596aaca9ee45069d9ef53863b63ca6a98ed797570`）。真正的命令全在原生 `doubao.exe` 里，包内脚本只负责下载→校验→spawn。所以下面凡「无证据」= 包内可读范围内没有，不等于原生二进制里一定没有（见「建议」的实测步骤）。

1 **能力面**：可确认的只有 6 个入口——`doubao`（README：「启动默认业务模式」TUI）、`doubao -p "…"`（README：「发起任务」）、`doubao login`、`doubao auth` / `logout`（`scripts/run.cjs:76` 把它们与 `--help` 并列）、`doubao update`、`--version|--help`。**无头非交互**：`-p` 语义是一次性提示，但 `scripts/run.cjs:57` 用 `spawn(binary, args, { stdio: 'inherit' })`，是否必须有 TTY 未验证。**JSON 输出**：无（全包 `json` 命中 14 处，全部是 `manifest.json`/`update-state.json`/`npm --json`，见 `scripts/install.cjs:35,88,96,153,154,191,205`、`scripts/runtime.cjs:42`、`scripts/update.cjs:68`）。**会话续接**：无（`resume` 0、`session` 0 命中）。**文件附件**：无参数级证据（README 只说「操作本地文件、执行命令」）。

2 **模型**：**不能指定**——全包 `model` 0 命中、`模型` 0 命中，无任何 `--model`；**DeepSeek V4.1 零踪迹**，默认模型无公开声明。⇒ 主身「编码类任务必须落 DeepSeek V4.1」这条约束，官方 CLI 目前**无法满足**（唯一残留可能是原生 `--help` 里的隐藏旗标，未验证）。

3 **认证与登录**：`doubao login`（+ `auth`/`logout` 子命令，`scripts/run.cjs:76`）；README 首段明写「**无需启动完整桌面客户端**」，故不需要桌面端在场。具体是扫码还是 token **未公开**。**我们现有登录态不能复用**：CLI 运行时落在 `%LOCALAPPDATA%\doubao_cli\app`（`scripts/runtime.cjs:13-16`），与浏览器/Electron 的 profile 各存各的；现有 CDP 通道用的是网页会话 cookie，两者不通，换 CLI 要各登一次。

4 **项目上下文**：**无等价参数**。`project` 0、`workspace` 0 命中，`cwd` 仅 2 处且是 `spawn` 的 cwd 选项（`scripts/run.cjs:57`）。`project-chip.mjs` 那套「点底栏项目芯片把话题钉到某个项目目录」在 CLI 里没有对应物；CLI 只有「进程在哪个目录启动」这一层弱语义。

5 **任务模型**：`-p` 是单次提示、同步执行（`scripts/run.cjs:70-77` 等子进程 exit 才返回）；`--no-wait` 0 命中、无轮询/任务 id 概念；**「回执里带 model 原文」拿不到**（包内无任何模型回显）。⇒ 我们现行判据（回执含 `"model"` 原文 + `DeepSeek` 子串）换 CLI 后**直接失效**。

6 **并发**：有常驻服务模型——`--service-stop`（`scripts/install.cjs:26`，安装/更新前先停服务）、`--service-start`（`scripts/install.cjs:197` 附近传给原生）；README 亦写「更新会尝试停止 `--service-start` 服务任务…有实例仍在运行时，更新会停止并提示退出，不会自动终止进程」。**未见并发/多任务参数**；单实例约束比我们现在的 CDP 单会话假设**更强**，不是更好。

7 **替代代价**：会丢——① markers 回查（`scripts/doubao/markers.mjs:38` 的 `MARKER_LINE` 靠会话 `innerText` 里的 `[T1] DONE` 行，CLI 无「读回原文」）；② 界面态判定（`scripts/doubao/project-chip.mjs:20-36` 读 chip 文本，以及模型 chip 的「自动/高」显示）；③ 会话续接与追加指令（我们现在用 `say` 往同一窗口补投）。会好——无桌面端在场、纯脚本化、自带 `doubao update` 与 SHA-256 复用、`-p` 单次调用省一次 CDP 连接。判断：**有条件替代**，只适合「一次性、无项目绑定、不需要模型判定与回查」的跑腿型任务。

建议：若主身要继续评估，最小验证＝在临时目录下载 win-x64 签名包（url/sha256 见上），**只解包不安装**（不跑 `npm install`、不触发 `postinstall`），读 `resources/js_app/cli-manifest.json` 并执行 `doubao.exe --help`，一次坐实第 1、2、5 三条。**需主身授权，我未擅自做。**

未决：① 原生 `--help` 的全量子命令与旗标（是否真有 `--model` / `--json` / `-c resume`）；② 默认模型是什么、能否选 DeepSeek V4.1；③ 登录方式（扫码/token）、登录态落盘位置、能否与我们现有 session 复用；④ `-p` 在无 TTY / 管道下是否可用；⑤ 官方文档缺失——`README.md` 引用的 `doubao-cli-installation-guide.md` 不在 npm 包内，`npm view` 的 `homepage`/`repository` 均 `undefined`，网上未检索到本品官方文档页（检索到的是豆包开放平台 `@doubao-dev/cli`(dbx) 与火山 `ark-cli`，**均非本品**，不可混用）。

<!-- DONE -->
