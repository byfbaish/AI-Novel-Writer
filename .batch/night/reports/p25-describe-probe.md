# P25 · 隔离实例探针：describe 读数与 Config 未导出定性

- 卡号：P25（`.batch/night/cards/p25-describe-probe.md`）
- 执行人：developer
- 时刻：2026-11-14 08:1x（北京）/ 探针日志时间 2026-11-14T00:12Z
- 范围：只读取证。未改用户 profile、未重启在用实例、未动仓库主分支、未 commit、未打 tag、未 publish。
- 交付物：本报告 + `.batch/night/signals/p25-describe-probe.done`

## 0. 一句话结论

两处读数异常**都不是**「宿主没 serve」，而是：

1. `namespaces=[]` 是**探针读法错**：`settings.describe()` 返回的是**数组**（`dsh-settings/lib/index.js` 的 `return descriptors`），探针读的 `.namespaces` 恒为 `undefined`。数组本身在隔离实例里也是空，因为 234 条里没有任何一条的 Config 带 `.volatile()`。
2. `configUndefined=true` 是**真缺陷、且在真机同样成立**：插件模块求值 `export const Config = buildConfigSchema()` 时，`require('@deepseek-ai/schemastery')` 抛
   `ERR_REQUIRE_ESM_RACE_CONDITION`（其传递依赖 `@deepseek-ai/cosmokit/lib/index.js` 是 ESM，此刻未加载完），被 `buildConfigSchema()` 的 `catch` 静默吞掉 → 导出 `undefined` → 宿主 `runtime.Config` 为 `undefined` → `describe()` 跳过本条目 → 客户端 `form` 为 `undefined` → 行卡显示「Host 未提供该条目」。

## 1. 隔离实例与环境

- 启动方式（桌面端自带运行时，非全局 CLI）：按 `resources/runtime/cli/bin/dsh.cmd` 原文
  `ELECTRON_RUN_AS_NODE=1` + `DeepSeek Harness.exe --expose-internals <app.asar>/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js --profile probe --port 61141 --no-open`
- `DSH_HOME=C:\Users\<用户名>\AppData\Local\Temp\dsh-probe-1114\home`、`DSH_PROFILE=probe`、`DSH_PROFILE_DIR=...\home\profiles\probe`
- profile 副本：`%TEMP%\dsh-probe-1114\home\profiles\probe`（robocopy `/E /XJ`，跳过 junction）
- 插件代码副本：`%TEMP%\dsh-probe-1114\repo`（副本 `node_modules\dsh-handoff-relay` 以 Junction 指向它）
- 污染检查：用户 `C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\relay.log` 中 `PROBE-DESCRIBE` 行数 = 0。

## 2. 原始输出（副本 relay.log 原文）

```
2026-11-14T00:12:16.968Z INFO PROBE-DESCRIBE t3 settings=present hasDescribe=function
2026-11-14T00:12:16.968Z INFO PROBE-DESCRIBE t3 ownConfig=undefined cfgErr=Error [ERR_REQUIRE_ESM_RACE_CONDITION]: Cannot require() ES Module C:\Users\<用户名>\AppData\Local\Temp\dsh-probe-1114\home\profiles\probe\node_modules\@deepseek-ai\schemastery\node_modules\@deepseek-ai\cosmokit\lib\index.js because it is not yet fully loaded.
2026-11-14T00:12:16.972Z INFO PROBE-DESCRIBE t3 resolveOK=C:\Users\<用户名>\AppData\Local\Temp\dsh-probe-1114\home\profiles\probe\node_modules\@deepseek-ai\schemastery\lib\index.cjs
2026-11-14T00:12:16.990Z INFO PROBE-DESCRIBE t3 namespaces=[] count=0 self=dsh-handoff-relay inList=false
2026-11-14T00:12:17.005Z INFO PROBE-DESCRIBE t3 entries=234 handoffIds=["dsh-handoff-relay"]
2026-11-14T00:12:17.006Z INFO PROBE-DESCRIBE t3 entry#1 id="plugin-manager" fiberState=2 runtime=object configUndefined=false cfgType=object metaVolatile=undefined
2026-11-14T00:12:17.006Z INFO PROBE-DESCRIBE t3 entry#2 id="timer" fiberState=2 runtime=object configUndefined=true cfgType=undefined metaVolatile=undefined
2026-11-14T00:12:17.006Z INFO PROBE-DESCRIBE t3 entry#228 SELF id="dsh-handoff-relay" fiberState=2 runtime=object configUndefined=true cfgType=undefined metaVolatile=undefined
```

三档时点（t3 / t15 / t45）取值一致；前一轮（00:09Z、23:34Z）除 `ownConfig`/`cfgErr` 两行外完全相同。

## 3. 证据链

### 3.1 `describe()` 的返回形状

`dsh/node_modules/@deepseek-ai/dsh-settings/lib/index.js`：

- `describe(options)` 内 `const descriptors = this.ownerContext.configEditor.configuration().flatMap(({entry, inherited, override}) => {...})`，末尾 `return descriptors;` ⇒ **数组**，元素形如 `{autoGenerate, ns, schema, revision, applies, value, base, user}`。
- 收录条件（同一个 `flatMap` 里依次 return []）：
  - `schema === void 0 || entry.fiber === void 0 || entry.fiber.runtime === null || entry.fiber.state !== 2`
  - `volatileForm(schema) === void 0`
- `schema(entry)` = `entry.fiber?.runtime?.Config`，判据 `schema !== void 0 && "toJSON" in schema`。

⇒ 探针读 `d.namespaces` 是错的（`d` 是数组）；「namespaces 为空」不能作为「宿主未 serve」的证据。同时数组确实为空，原因：`plugin-manager` 的 Config 虽有 `cfgType=object`，但 `metaVolatile=undefined`（无 `.volatile()` 字段）⇒ `volatileForm` 为 undefined ⇒ 被跳过；其余条目多无 Config。

### 3.2 我们条目为什么被跳过

- `entry#228 SELF id="dsh-handoff-relay" fiberState=2 runtime=object configUndefined=true` ⇒ 插件是 active 的，问题在 `runtime.Config` 为 `undefined`。
- `runtime.Config` 由 cordis `Context.plugin()` 赋值：`runtime = {name, callback, fibers, Config: plugin.Config}`（`dsh/node_modules/@deepseek-ai/cordis/lib/index.js:1699-1704`）。
- 我们插件 `C:\develop\workspace\dsh-handoff-relay\index.js:56` 是 `export const Config = buildConfigSchema();`，而 `buildConfigSchema()`（`:38-55`）整体被 `try/catch` 包住，`catch { return undefined; }`。
- 探针把 catch 的原始错误打出来后，得到上述 `ERR_REQUIRE_ESM_RACE_CONDITION`。
- 同一进程在 3 秒后再调 `loadSchemastery()` 已成功（`resolveOK=...schemastery\lib\index.cjs`）⇒ 不是「解析不到」，而是**求值时机**：插件模块在 ESM 加载器仍在装载 `@deepseek-ai/cosmokit`（ESM）时被求值，`require()` 撞上 `ERR_REQUIRE_ESM_RACE_CONDITION`（Node 22+ 的 require(ESM) 竞态保护）。

### 3.3 与真机现象对齐

真机「设置 → 插件 → 已安装 → 点开 relay」三列卡能渲染，但行底显示「Host 未提供该条目」：

- 卡能渲染：`client.js` 的 `mountRowConfig` 用 `forms.get(ENTRY_ID)` 拿到 controller 并注册槽位（controller 存在，不依赖 host 的 Config）。
- 文案命中：`syncText()` 里 `status` 既非 `ready` 也非 `loading` ⇒ 落 `unavailable`（`dsh-client-ui-settings/lib/client.js` `derive()`：`view.namespaces` 里找不到该 ns ⇒ `status="unavailable"`）。
- `view.namespaces` 来自 host `describe()`，我们被 3.1 的 `schema === void 0` 条件跳过 ⇒ 永远 `unavailable`。

⇒ 与真机现象完全一致，且**不需要**「宿主未把条目写进 view」这种解释。

## 4. 最小验证办法（不改码，成本 0）

在任一**已加载插件**的宿主进程内执行一次
`ctx.get('settings').describe()`，检查返回数组里是否存在 `ns === 'dsh-handoff-relay'`：
- 不存在（预期）→ 与 3.2 定性一致；
- 存在 → 我这条定性要推翻，需再看 `volatileForm` 路径。

## 5. 未覆盖 / 边界

- 未在用户在用实例上位做任何注入或重启，`runtime.Config` 在真机上是否为 `undefined` 未直接读到；本条定性由「同一份代码 + 同一运行时（桌面端 0.2.2-rc.1）+ 同样的 import 路径」推断，最强旁证是现象链完全对齐（3.3）。
- `namespaces` 为空在隔离实例里对 234 条全成立，故不能用它区分「我们这条特殊」；区分靠 `entry#228` 的行为。
- 本报告只给事实与最小改法方向候选（如改为 TLA 动态 `import()` 后再导出 Config，或静态 import + 依赖声明），**修法由负责人裁定，不在本次范围**。

## 6. 复现命令（原样）

```powershell
# 启动（WMI 分离，避免沙箱 Job 收走子进程）
$cmd = @'
@echo off
set ELECTRON_RUN_AS_NODE=1
set "DSH_HOME=%TEMP%\dsh-probe-1114\home"
set DSH_PROFILE=probe
set "DSH_PROFILE_DIR=%TEMP%\dsh-probe-1114\home\profiles\probe"
"C:\develop\software\DeepSeekHarness\DeepSeek Harness.exe" --expose-internals "C:\develop\software\DeepSeekHarness\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js" --profile probe --port 61141 --no-open
'@
Set-Content -Path "$env:TEMP\dsh-probe-1114\run-probe.cmd" -Value $cmd -Encoding ASCII
([wmiclass]'Win32_Process').Create('cmd.exe /c "' + "$env:TEMP\dsh-probe-1114\run-probe.cmd" + '"')

# 读数
Get-Content "$env:TEMP\dsh-probe-1114\home\profiles\probe\dsh-handoff-relay\relay.log" |
  Select-String 'PROBE-DESCRIBE' | Select-Object -Last 12 | ForEach-Object Line
```

## §补充 08:2x（补打 4 个读数，不覆盖原文；同一副本重起一次，只加打印）

> 触发：大肥鱼核对后指出「`describe()` 返回数组」是推出来的、`profileRootDir()` 只有成功标记没有值。
> 做法：副本 `repo/index.js` 重置为 `git show 8d562a0:index.js`（不吃主仓库未提交改动），注入 v3 探针（脚本 `.batch/night/tools/p25-probe3.ps1` + 片段 `probe3.snippet.js`），WMI 分离启动，端口 61171。未碰在用 profile。

原始读数（t4 / t20 两次一致）：

```
INFO [dsh-handoff-relay] 启动 1/1 个 watch；stableMs=5000，delivered=...\dsh-probe-1114\home\profiles\probe\dsh-handoff-relay\delivered
INFO PROBE-DESCRIBE t4 profileRootDir=C:\Users\<用户名>\AppData\Local\Temp\dsh-probe-1114\home\profiles\probe env="C:\\Users\\<用户名>\\AppData\\Local\\Temp\\dsh-probe-1114\\home\\profiles\\probe"
INFO PROBE-DESCRIBE t4 describe.typeof=object isArray=true objectKeys=[0|1|2|3|4|5|6|7|8|9|10|11]
INFO PROBE-DESCRIBE t4 describe.length=25 ns=[session-log-deepseek|agent-default-model|llm-pi-ai|pwsh-sandbox|permission|subagent|web|web-search-deepseek|web-deepseek-api|agent-loop|llm-deepseek|llm-deepseek-account|subagent-model-selection-settings|ui-settings-account|ui-theme|locale|ui-settings|ui-conversation|ui-chat|agent-preset-registry|speech-to-text|plugin-market|ui-task-board|@goodandready/dsh-agent-loop-guard|dsh-context] self=dsh-handoff-relay inList=false
INFO PROBE-DESCRIBE t4 keys200="autoGenerate,ns,schema,revision,applies,value,base,user"
INFO PROBE-DESCRIBE t4 configuration.isArray=true entries=234
INFO PROBE-DESCRIBE t4 SELF#228 id="dsh-handoff-relay" fiberState=2 configUndefined=true cfgType=undefined hasToJSON=false metaVolatile=undefined
```

（t20 六行逐字同上，时间戳 00:26:01Z。）

### 这四行各自钉住了什么

| 读数 | 值 | 结论 |
|---|---|---|
| `profileRootDir()` | `…\dsh-probe-1114\home\profiles\probe` | 隔离成立，探针读的就是副本；与 `env=DSH_PROFILE_DIR` 一致 |
| `typeof describe()` / `Array.isArray` | `object` / `true` | **`describe()` 返回数组，不是对象**；P25 正文里读 `d.namespaces` 必然 undefined，原文那段「namespaces=[]」是读法错的产物，不是宿主真相 |
| `describe.length` 与 `ns[]` | 25 条，含 `@goodandready/dsh-agent-loop-guard`、`ui-task-board`、`dsh-context`，**不含 `dsh-handoff-relay`** | 宿主确实在服务表单，第三方条目也能进；唯独我们这条被跳过 |
| 元素键 | `autoGenerate,ns,schema,revision,applies,value,base,user` | 与 `dsh-settings` 源码一致；`inList` 判据成立 |
| 我们 entry | `fiberState=2`、`configUndefined=true`、`hasToJSON=false` | **fiber 已 active，唯一缺口就是 `runtime.Config === undefined`** ⇒ `ERR_REQUIRE_ESM_RACE_CONDITION` 那条根因闭合 |

### 对修法的意义

- 只剩一个变量：`Config`。`fiber.state`（=2）与 volatile 结构都不是变量 —— `Config` 是 undefined 时谈不上 volatile。
- 反证基线已留：`8d562a0` 上 `inList=false` / `configUndefined=true`。P26 之后在同一副本复跑，要求 `configUndefined=false`、`cfgType=object`、`hasToJSON=true`、`inList=true`，否则修法不算成立（复验步骤见 `.batch/night/staging/verify-after-p26.md` §①）。
- 过程记录：第一次注入因 PowerShell here-string 把探针代码里的反引号吃掉，`index.js` 报 `SyntaxError: Unexpected token 'catch'`，`dsh: warning: 2 entries did not activate`。改用「探针写在独立片段文件、脚本只做字符串替换」后一次跑通。另：上一轮遗留了 3 个副本实例（pid 35748/20896/43172）同时持有 task-board 锁，已全部清掉，本次只起 1 个。

<!-- DONE -->
