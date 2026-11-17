# P26 + P27 之后的复验方案 · 2026-11-14

> 用途：P26（`Config` 求值时机）与 P27（客户端补 `sessions`）落地后，真机前最后一次对表。
> 三段：①隔离副本探针复验 → ②真机 U1–U8 从哪条重走 → ③回滚三行与崩溃处置。
> 红线沿用：不碰在用 profile（除 profile 刷新 install）、不点保存直到 U7/U8 通过、不改宿主加载路径、不发版不打 tag。

## 0. 前置事实（写这份时的基线）

| 项 | 值 |
|---|---|
| 仓库 | `C:\develop\workspace\dsh-handoff-relay` |
| P26 前 HEAD | `8d562a052e8f`（P22c 合入后） |
| P26 改动面 | `index.js` + `index.test.mjs`（`Config` 改顶层 `await import()`，schema 逐字不变） |
| P27 改动面 | `client.js` + `index.test.mjs`（`inject` 加 `"sessions"`，`index.js` 零改动） |
| 真机入口 | `设置 → 插件 → 已安装 → README 页最下方「包含的组件」→ 点组件名` |
| 真机现状（修复前） | 卡片可见（U1 PASS），行底 `Host 未提供该条目`、会话搜索「没有匹配的会话」、无保存落点 |

---

## ① 探针复验（隔离副本，不碰在用 profile）

**目的**：把 P25 的两个读数做成正反对照——修复前 `Config=undefined`/`ns` 不在列表，修复后 `Config` 为 object/`ns` 在列表。

**复验位置**：`%TEMP%\dsh-probe-1114\`（已在用的隔离副本：`home\profiles\probe` + `repo` 临时副本 + `watch` dummy 目录）。不要在 `~/.dsh` 上做。

**步骤**：

1. 副本 index.js 必须取**新 HEAD 的已提交版本**，不要复制主仓库工作区（P26/P27 期间工作区有未提交改动）：
   `git -C C:\develop\workspace\dsh-handoff-relay show <P26+P27 的 HEAD>:index.js` → 写入 `%TEMP%\dsh-probe-1114\repo\index.js`
2. 注入 v3 探针（见 `.batch\night\tools\p25-probe3.ps1` 的 `$probe` 段），锚点仍是
   `if (ctx && typeof ctx.effect === 'function') ctx.effect(() => dispose);`
3. 用 WMI 分离启动（沙箱 Job 会收走 `Start-Process` 子进程，报 `Windows Job runner exited with exit code 4294967295`），环境三件套必须齐：
   `ELECTRON_RUN_AS_NODE=1`、`DSH_HOME=<副本>\home`、`DSH_PROFILE=probe`、`DSH_PROFILE_DIR=<副本>\home\profiles\probe`；端口用 61171（避开 55990/53199）。
   **启动器必须是桌面端 exe + `--expose-internals <asar>\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js`**，用系统 node 直接跑 `bin.js` 会 `MODULE_NOT_FOUND`（普通 node 不认 asar）。
4. 取样时点 t4 / t20（P25 用的是 t3/t15/t45，两次读数一致即可，不必等 45 秒）。

**判据（三条全中才 PASS）**：

| # | 探针行 | 修复前（P25 实测） | 修复后要求 |
|---|---|---|---|
| R1 | `describe.typeof=… isArray=…` | `object` / `true`（08:25 补充件实测） | 不变：`object` / `true`，`describe.length` 仍为 25 |
| R2 | `describe.length=… ns=[…] inList=…` | `length=25`，`ns` 含 `@goodandready/dsh-agent-loop-guard`/`ui-task-board`/`dsh-context`，**不含** `dsh-handoff-relay`，`inList=false` | `inList=true`（`length` 应变 26） |
| R3 | 我们 entry 的 `configUndefined=… cfgType=…` | `fiberState=2 configUndefined=true cfgType=undefined hasToJSON=false` | `configUndefined=false`、`cfgType=object`、`hasToJSON=true` |
| R4 | `profileRootDir=…` | `…\dsh-probe-1114\home\profiles\probe`，与 `env=DSH_PROFILE_DIR` 一致 | 不变：仍须是副本路径，**不是** `C:\Users\…\.dsh\profiles\desktop` |

**反证（必做一次，防「看起来对了」）**：把副本 index.js 换回 `8d562a0` 版本重跑，R2/R3 必须回到 `inList=false` / `configUndefined=true`。若反证不红，说明探针没打到真实路径，结论作废。

**顺手核**：`relay.log` 里 `PROBE-DESCRIBE` 之外不应出现新的 `WARN`；7 条真实 watch 在副本里已被替换成 1 条 dummy（`targetSessionId: 'session-probe-dummy'`），不会投给真人会话。用户主 profile 日志里 `PROBE-DESCRIBE` 行数应为 0。

---

## ② 真机 U1–U8 从哪条重走

**结论：从 U1 重走全套**，但只重验 5 条有效判据，其余改判或免做。理由：P26/P27 改的是数据通道，`U1` 的「有卡」本来已过，真正变化在**行底文案**与**会话搜索**，而 U3/U7/U8 依赖写回通道，P25 之后从未验过。

### 2.1 预检（照 P22b 脚本，改三处）

| P22b 原步骤 | 现在怎么办 |
|---|---|
| 预检 1：HEAD 以 `8d562a0` 开头 | 改为「HEAD 含 P26、P27 两个提交」，贴 `git log --oneline -3` 原文 |
| 预检 2：`dsh plugin --profile desktop install` | **先比对再用**：`git hash-object client.js` vs profile 下 `node_modules\dsh-handoff-relay\client.js` 的 `git hash-object`；相同则免 install（P22b 现场就是这样省掉的），不同再 install |
| 预检 3：核服务端字节 | 保留，但今天要核**两个**文件：`index.js`、`client.js` |
| 预检 4：备份 `cordis.patch.yml.bak-p22b` | 保留，**另起名** `cordis.patch.yml.bak-p26p27`（别覆盖旧备份，两份都要留） |

### 2.2 真机逐步（按顺序，任一步 FAIL 即停）

| 步 | 动作 | 判据 | 与 P22b 的差异 |
|---|---|---|---|
| U0（新） | 重启后进卡 | `relay.log` 启动段有 `启动 7/7 个 watch`；**行底不再出现「Host 未提供该条目」** | 新增，这是 P26 的核心判据 |
| U1 | 看卡 | 三列表头 + `stableMs` + 「新增一行」（此条已 PASS，只作回归） | 不变 |
| U2 | 点「选择会话」输关键词 | 列表按显示名过滤并出结果（搜「大肥鱼」应能出） | P27 的核心判据；P22b 原文是「弹出搜索框」，现加「必须搜到 ≥1 条」 |
| U3 | 选中一个会话 | 行内显示标题 + 目录（cwd） | 不变 |
| U4 | 检查整张卡 | 没有要求输入 Session ID 的框 | 不变 |
| U7 | 完成规则选「正则」，填 `(a+)+`，保存 | 只该行标红拒绝，其他行仍可保存 | 不变；但「保存」是否可点取决于 U0——U0 红就不做 U7 |
| U8 | 看保存提示 | **不预设文案**，记录原文 | **改判据**：P22b 期望「已保存，重启宿主后生效」，那是数据通道坏掉时的降级文案；修复后应是「已同步/已保存」一类。真机只记原文，由负责人定 |
| U5 | 第二次重启后回看该行 | 仍显示同一会话名；`relay.log` 该 dir `resolved` | 不变 |
| U6 | 删/改一个历史会话后再重启 | 该行失效态文案「目标会话已失效…请重新选择」，其余行照常 | 破坏性，仍放最后；不想做记「未执行」 |

**保存纪律**：U0 未过（还显示「Host 未提供该条目」）时**一次都不许点保存**——写入会带 schema 默认值改写 yml（`targetSessionId: ''`、`exact: true` 之类，脏但无害，靠备份还原）。

**U2 若仍空**：先看 `relay.log` 有无 `PROBE` 之外的异常，再核 `client.js:20` 的 inject 到底是不是 `["slots","sessions"]`（`git hash-object` 对不上就是 profile 里还是旧字节，回到预检 2 做 install 再重启）。

---

## ③ 回滚三行

### 3.1 常规回滚（任一条 FAIL）

```powershell
# 1) 代码回到 P26/P27 之前
cd C:\develop\workspace\dsh-handoff-relay; git checkout 8d562a0 -- client.js index.js index.test.mjs
# 2) 刷新 profile 物化字节
dsh plugin --profile desktop install
# 3) 完全退出并重开桌面端，确认界面正常、relay.log 有启动行
```

回滚后若要连配置一起还原：`Copy-Item "$env:USERPROFILE\.dsh\profiles\desktop\cordis.patch.yml.bak-p26p27" "$env:USERPROFILE\.dsh\profiles\desktop\cordis.patch.yml" -Force`，再重启一次。

### 3.2 `web boot: 1 entry did not activate` 处置（P27 特有风险）

这是**客户端硬 inject 缺服务**的报错形态（K21 那类：条目 pending → 渲染层 `assertEntriesActive` → `bootFailed` → `reportFatal(..., "web-boot")`）。出现时按顺序：

1. **先只撤 P27**，保留 P26（P26 是服务端修法，与 boot 无关）：
   `git checkout 8d562a0 -- client.js` → `dsh plugin --profile desktop install` → 重启。
2. 重启后若 boot 正常、卡片行底文案仍是「Host 未提供该条目」→ 说明 P26 也没生效，回 3.1 全撤。
3. 若撤了 P27 还 boot 失败 → 立即 `git checkout 8d562a0 -- client.js index.js index.test.mjs` + install + 还原 yml 备份 + 重启，并按「启动崩」上报（`bootFailed` 的判定口径见 `.batch\night\reports\client-entry-settings-service.md`）。
4. 全程不改 `cordis.patch.yml` 的 `disabled`、不删 `node_modules`、不用界面装插件（界装会崩，已知）。

---

## 附：这份方案里没有验证过的前提

1. P26 的 `await import()` 是否真能绕开 `ERR_REQUIRE_ESM_RACE_CONDITION`——只有在副本里跑 ① 才能证明，别在真机上试。
2. U8 的文案——修复后宿主/客户端实际给哪句，只能现场记录，不预设。
3. `sessions` 在**渲染层**是否在所有启动路径下都就绪（P27 假设它在本机是 core 服务）——真机 U2 是唯一证据；若出现 3.2，按 3.2 第 1 条走。
