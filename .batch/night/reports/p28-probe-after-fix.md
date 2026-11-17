# P28 · §① 副本探针复验（P26 + P27 之后）· 2026-11-14 08:5x

> 目的：验证 P26（`Config` 走顶层 `await import()`）是否真把 `dsh-handoff-relay` 送进宿主的 `describe()`，并跑反证。
> 只读取证：未碰在用 profile、未重启主实例、未改主分支、未 commit。全部动作发生在 `%TEMP%\dsh-probe-1114`。

## 0. 环境与对象

| 项 | 值 |
|---|---|
| 主实例 | `DeepSeek Harness.exe` 宿主 pid `33828`（08:45 DSH 重启后的新实例），全程未动 |
| 隔离副本 | `%TEMP%\dsh-probe-1114\home\profiles\probe` + `%TEMP%\dsh-probe-1114\repo`（junction 挂进副本 `node_modules\dsh-handoff-relay`） |
| 启动方式 | `--expose-internals <asar>\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js --profile probe --port 61181 --no-open`，`DSH_HOME`/`DSH_PROFILE`/`DSH_PROFILE_DIR` 三件套 + WMI 分离启动 |
| 正例 index.js | 提交 `beb0af2`（P26+P27 后 HEAD），写入副本后 blob `186570feeba7f1b485ceb2f087fcb396e21dd38d` |
| 反例 index.js | 提交 `8d562a0`（P26 之前），写入副本后 blob `394fd90f204ac3744331071cbab4a60d27d3f018` |
| 探针 | `.batch/night/tools/probe3.snippet.js`，由 `.batch/night/tools/p28-probe.ps1 -Sha <commit> -Tag <label>` 注入；取样 t4 / t20 |

> 注（09:0x 更正，QA 复核后）：上表两个 blob 是**写入副本、插桩前**的字节，即 `p28-probe.ps1` 第 1 步 `git show` → `WriteAllText` 的落盘形态；它与仓库 blob 只差末尾一个换行（`-join "`n"` 吞掉原文件末尾 `\n`，52,447→52,446B），其余字节一致。
> 仓库对应 blob：`beb0af2:index.js` = `04a44b8d…`（52,447B）、`8d562a0:index.js` = `489389d9…`（51,551B）。
> 插桩后（探针已拼进 `index.js`）的 blob：`beb0af2` = `d395d079…`、`8d562a0` = `e13f7722…`；反证跑完时副本 `repo\index.js` 即为 `e13f7722…`（54,276B，08:49:35），与「反证最后跑」的时间线一致。

副本 patch 里 7 条真实 watch 仍在早前被替换成 1 条 dummy（`targetSessionId: 'session-probe-dummy'`，目录 `%TEMP%\dsh-probe-1114\watch`），不会投给真人会话。

## 1. 正例：`beb0af2`（P26 + P27）

原始读数（08:47:43Z 启动，t4 = 08:47:48Z，t20 = 08:48:03Z）：

```
INFO [dsh-handoff-relay] 启动 1/1 个 watch；stableMs=5000，delivered=...\dsh-probe-1114\home\profiles\probe\dsh-handoff-relay\delivered
INFO PROBE-DESCRIBE t4 profileRootDir=C:\Users\<用户名>\AppData\Local\Temp\dsh-probe-1114\home\profiles\probe env="C:\\Users\\<用户名>\\AppData\\Local\\Temp\\dsh-probe-1114\\home\\profiles\\probe"
INFO PROBE-DESCRIBE t4 describe.typeof=object isArray=true objectKeys=[0|1|2|3|4|5|6|7|8|9|10|11]
INFO PROBE-DESCRIBE t4 describe.length=25 ns=[…|plugin-market|@goodandready/dsh-agent-loop-guard|dsh-context|dsh-handoff-relay] self=dsh-handoff-relay inList=true
INFO PROBE-DESCRIBE t4 keys200="autoGenerate,ns,schema,revision,applies,value,base,user"
INFO PROBE-DESCRIBE t4 configuration.isArray=true entries=234
INFO PROBE-DESCRIBE t4 SELF#228 id="dsh-handoff-relay" fiberState=2 configUndefined=false cfgType=object hasToJSON=true metaVolatile=undefined
INFO PROBE-DESCRIBE t20 describe.length=26 ns=[…|ui-task-board|@goodandready/dsh-agent-loop-guard|dsh-context|dsh-handoff-relay] self=dsh-handoff-relay inList=true
INFO PROBE-DESCRIBE t20 SELF#228 id="dsh-handoff-relay" fiberState=2 configUndefined=false cfgType=object hasToJSON=true metaVolatile=undefined
```

（t20 的 `profileRootDir`、`keys200`、`configuration` 三行与 t4 逐字相同，为节省篇幅只列出差异行。t4 时 `length=25`、t20 时 `length=26`，差别是 `ui-task-board` 晚一点才装配——不影响 `inList=true`。）

## 2. 反证：`8d562a0`（P26 之前）

同一副本、同一探针、只换 `repo/index.js`（08:49:38Z 启动）：

```
INFO PROBE-DESCRIBE t4 describe.length=25 ns=[…|ui-task-board|@goodandready/dsh-agent-loop-guard|dsh-context] self=dsh-handoff-relay inList=false
INFO PROBE-DESCRIBE t4 SELF#228 id="dsh-handoff-relay" fiberState=2 configUndefined=true cfgType=undefined hasToJSON=false metaVolatile=undefined
INFO PROBE-DESCRIBE t20 describe.length=25 ns=[…] self=dsh-handoff-relay inList=false
INFO PROBE-DESCRIBE t20 SELF#228 id="dsh-handoff-relay" fiberState=2 configUndefined=true cfgType=undefined hasToJSON=false metaVolatile=undefined
```

`profileRootDir` 仍为副本路径——反证排除了「探针换了实例/读了别处」这种解释。

## 3. 判据逐条

| # | 判据 | 正例实测 | 反证实测 | 结论 |
|---|---|---|---|---|
| R1 | `describe.typeof` / `isArray` | `object` / `true`，`length` 25→26 | `object` / `true`，`length=25` | PASS（形态不变，符合宿主源码） |
| R2 | `ns` 数组含 `dsh-handoff-relay`（`inList`） | `inList=true` | `inList=false` | PASS（**正例进列、反例不在列**） |
| R3 | 我们 entry 的 `Config` 形态 | `configUndefined=false`、`cfgType=object`、`hasToJSON=true` | `configUndefined=true`、`cfgType=undefined`、`hasToJSON=false` | PASS（P26 修复生效） |
| R4 | `profileRootDir()` 指向副本 | `…\dsh-probe-1114\home\profiles\probe`，与 `env=DSH_PROFILE_DIR` 一致 | 同上 | PASS（不是主 profile） |

**总判：PASS。** P26 之后 `runtime.Config` 由 undefined 变为 object，`describe()` 的 25/26 条里出现 `dsh-handoff-relay`，与「行底 `Host 未提供该条目`」的成因链完全对齐。

## 4. 过程中的偏差与踩坑（都记下来，避免下次重踩）

1. **第一次注入失败**：探针代码写在 PowerShell here-string 里，反引号被吞，`index.js` 报 `SyntaxError: Unexpected token 'catch'`，实例起不来还带出 `dsh: warning: 2 entries did not activate`。改成「探针放独立片段文件 `probe3.snippet.js`，脚本只做字符串替换」后一次通过。
2. **转义坑（本次新踩）**：`run-<tag>.cmd` 用 ASCII 写入，路径里的中文用户名 `<用户名>` 变成 `C:\Users\???\…`，重定向文件打不开，进程静默退出、日志里什么都没有。改用 `%TEMP%\dsh-probe-1114\boot-<tag>.out.log` 后正常。**凡写 .cmd，别把含中文的绝对路径塞进 ASCII 文件。**
3. **清理探针进程时把自己杀了**：用「命令行含 `dsh-probe-1114`」当匹配条件，会把正在执行这条命令的 pwsh 自己也匹配进去，`Stop-Process` 连带杀掉自己（表现为 `Windows Job runner exited with exit code 4294967295`）。正确条件：`Name -like 'DeepSeek Harness*' -and CommandLine -match '--profile probe'`。
4. **08:45 主实例重启**：DSH 重启把当时正在跑的探针作业打断（`boot-after.*` 未生成）。重启后按 §1 重跑，读数以重跑为准；主实例 33828 之后的 pid 变化与本取证无关。
5. 上一次探针遗留过 3 个副本实例并存（pid 35748/20896/43172），会抢 task-board 锁并带出 `2 entries did not activate` 噪声。本轮每次只起 1 个，跑完即清。

## 5. 边界（这份取证不覆盖什么）

- **真机未验**：本轮只在副本实例里证明 describe 收录；行底文案是否消失、会话搜索是否出结果，仍要在主实例真机上走 `verify-after-p26.md` 的 U0/U2。
- **P27 的 `sessions` 未验**：本探针不读渲染层服务，`inject` 是否生效只能由真机 U2 证明。
- **7 条 watch 全未迁移**：副本是 dummy watch；真机 7 条仍是 `targetSessionId`，与 P28 无关。

<!-- DONE -->
