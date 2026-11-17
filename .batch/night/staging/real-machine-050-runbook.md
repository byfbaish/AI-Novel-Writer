# 真机执行卡 · dsh-handoff-relay（P29 界面 + P31 去重）

> 本文件是 `.batch/night/reports/real-machine-050-script.md`（17,205B / `1D1416A1…` / 2026-11-14 10:17 版）的**当前盘面校准版**。
> 用途：谁拿着都能照着做。旧脚本不删、不改，凡是与本卡冲突的地方，**以本卡为准**；差异清单见 §6。
> 取证时刻：2026-11-14 17:07–17:15（只读，未改任何文件、未重启）。

**本轮只验两件**（scope-v3）：P29 设置卡界面（U1–U8）、P31 去重（a/b/c）。
**跳过**：脚本 §0.2 迁移 YAML 与 M1 的标题解析判据（本轮不施加 `targetTitle`）。

---

## 0. 四件对齐（读数实测）

### 0.1 版本

| 项 | 读数 | 结论 |
|---|---|---|
| 已安装插件目录 | `C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\dsh-handoff-relay` = **Junction → `C:\develop\workspace\dsh-handoff-relay`** | 装的是仓库工作区本身，不是 npm 包；改仓库文件即改「已安装」 |
| `package.json` | `"version": "0.5.0"`（1085B，11-14 02:54:31） | 版本号已是 0.5.0 |
| 代码文件 | `index.js` 57,749B / 09:09:16、`client.js` 26,602B / 09:53:23 | P31、P29 都已落盘 |
| 仓库 | HEAD `d535dc1`「feat: add directory picker and readable dir hints」，`git status --porcelain` 空 | 工作区干净 |
| tag | 最新 `v0.4.0`；**无 v0.5.0** | 与「0.5.0 不发版、不打 tag」一致，属预期，不是漏打 |

### 0.2 回滚哈希

**`F895C286F1B6E40938FD0E94EAF8B434` = profile 目录下 `cordis.patch.yml` 本身的 MD5**（10,591B / 314 行），不是代码哈希。

| 文件 | 字节 | MD5 |
|---|---|---|
| `C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`（现在） | 10591 | `F895C286F1B6E40938FD0E94EAF8B434` |
| `cordis.patch.yml.bak-050`（11-14 09:00:30 建的备份） | 10591 | `F895C286F1B6E40938FD0E94EAF8B434` |

⇒ 备份与当前文件**逐字节相同**，§5 回滚三行仍成立，回显必须还是这个值。

### 0.3 配置

`cordis.patch.yml:293-312` 现状（**与脚本 §0.1 的 7 条对应表完全一致**，无差异）：

- `:293` `id: dsh-handoff-relay`、`:295` `disabled: false`
- `:297-311` `watches` 共 **7 条**，每条只有 `dir` + `targetSessionId`，**没有 `targetTitle`**（迁移未施加，符合 scope-v3）
- `:312` `stableMs: 5000`
- 顺序：wakeup-inbox、wakeup-inbox\workbuddy、wakeup-inbox\doubao、signals\workbuddy、signals\doubao、bridge\to-owner、bridge\to-group

**唯一需要注意的过时点**：`:290-292` 的注释还写着「2026-11-14 临时停用 … 修好注入声明后把 disabled 改回 false」，`disabled` 已经是 `false` 了，注释是历史，不用改、别被误导。

### 0.4 现在的宿主跑的是哪个代码（旧脚本 §0.4 的结论要分两半看）

| 证据 | 读数 |
|---|---|
| 应用进程 | `DeepSeek Harness` 主进程 `StartTime` = **08:45:07**（不是 16:22 才启动） |
| `relay.log` 启动行 | `00:11:51Z`(08:11:51)、`00:45:22Z`(08:45:22，与进程启动对得上)、**`08:22:52Z`(16:22:52)** |
| 16:22:52 那一行是什么 | 没有对应的进程启动 ⇒ 是**插件重挂载**（配了 `disabled`/配置后的热重载），不是整机重启 |
| `index.js` / `client.js` 落盘 | 09:09:16 / 09:53:23（**早于** 16:22:52） |
| 主进程新代码的物证 | `dedupe.json` 已存在（1,150B，17:07:51），含 16:39:08（signals\doubao）、17:05:24、17:07:21（to-owner）、17:07:51（to-group）四条去重记录 ⇒ **P31 主进程代码确实在跑** |
| 崩溃日志 | 最新 `crash-…18-39-33-935Z-web-boot.log`，`LastWriteTime` 02:39:33（与本次无关） |

⇒ **主进程**：已经是 P29/P31 之后的 `index.js`（`dedupe.json` 是铁证）。
⇒ **渲染层**：应用窗口从 08:45 就开着，`client.js` 是 09:53 才改的 —— 除非中途刷新过页面，否则**当前窗口里跑的很可能还是旧 `client.js`**（P29 的「选择目录…」按钮、红绿点可能根本不在）。这一点本卡无法只读取证（要看渲染层实际加载的 bundle），但足以支撑结论：**重启/刷新对 P29 是必要的**。
⇒ 所以本轮重启的正当理由是：①让渲染层载入新 `client.js`；②验「重启后不重放 / 卡片仍在 / 7/7 watch」。旧脚本 §0.4 那句「跑的是旧代码」**不准确**（主进程早就是新的），但「需要重启」这个结论仍然成立，只是理由不同。
⇒ 另外：`cordis.patch.yml` 的 `LastWriteTime` 是 16:23:00（重挂载时回写同一内容），MD5 未变，不是被人改过。

### 0.5 watch 目录现状（重启前先看清）

| 目录 | 现状 | 重启时会发生什么 |
|---|---|---|
| `scripts\dsh\wakeup-inbox` | `dsh-wake-20261114-1005-6263.md` 245B（mtime **10:05:00**）+ `.gitkeep` | 该桶（`vbzs2gxq`）在 `dedupe.json` 里**没有记录** ⇒ 按「首次运行全部视为新」重试一次；目标 `daeb834f` 未在线则留原地 + 3 条 WARN。**不影响 P29/P31 判据**，别当 bug |
| `scripts\dsh\wakeup-inbox\workbuddy` / `\doubao` | 空 | 无事 |
| `.batch\night\signals\workbuddy` | `.gitkeep` | `.gitkeep` 永不投递（`index.js:1042`），无事 |
| `.batch\night\signals\doubao` | `.gitkeep` | 同上 |
| `.batch\night\bridge\to-owner` | `.gitkeep` | 同上 |
| `.batch\night\bridge\to-group` | `.gitkeep` | 同上 |

`dedupe.json` 现有桶：`rgf3adlp`（signals\doubao）、`462e69db07b3`（to-owner）、`puhpor43`（to-group）。
**`83e63d6cfdfa`（signals\workbuddy）与 `vbzs2gxq`（wakeup-inbox）没有桶** ⇒ 这两个目录重启时会打「首次运行全部视为新」。

---

## 1. 执行主体与交接（重启后谁接着做）

**问题**：DSH 一关，群就没了，群里的 Bot 全部失联。所以重启窗口内的动作只能由**主人**做；`relay` 本身也在 DSH 里，关掉期间不工作。

时序（本卡的硬规定）：

| 阶段 | 谁执行 | 群在不在 |
|---|---|---|
| 预备（§2 步 0） | 群内任一 Bot（写探针、记基线） | 在 |
| 关 DSH → 开 DSH | **主人**（只做这两下，各回一句） | 不在 |
| 起来了之后的全部核验（M2/M3/U1–U8/P31-a/b/c） | **群内 Bot**（大肥鱼领头，developer 出命令） | 回来了 |
| 若崩/白屏 | **主人**手动粘 §5 三行（DSH 保持关闭）；或改派 WorkBuddy | 不在 |

⇒ 主人只承担「关一下、开一下、最后在设置卡上点几下并截图」。**重启后的命令一律由群内 Bot 执行**，不要求主人敲 PowerShell。
⇒ 若主人不愿意做「点几下」，U1–U8 整段记「未执行」，本轮只判 M2/M3/P31，不算 FAIL。

---

## 2. 时间线（每步：命令原文 → 期望读数 → 实际读数留空）

> 约定：`$st` = `C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay`；`$log` = `$st\relay.log`；`$watch` = `C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy`。

### 步 0 · 重启前预备（群内 Bot 执行）

**0-a 守夜进程：本轮不上。** 负责人 17:17 定：真机轮还卡在主人「要不要现在重启」，没点头就不开跑，摆了也是给不存在的窗口占资源。P31-c（启动前旧文件）因此**本轮不验**，命令原文与启动方式见 **§7**，主人点头后再启。

- 影响：步 6 的 P31-c 三行核验本轮跳过，`§3 判据` 里 P31-c 记为「待 §7」
- 不要提前放探针：7 条 watch 的目标此刻全在线（`08:22:52Z` 的 7 条加载解析里 6 条 `resolved`），往任何有桶记录的目录放文件 5 秒内就被真投出去

**0-b 记基线**（后面判「有没有多一封」「日志有没有多行」全靠它）：

```powershell
$st = "C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay"
(Get-Item "$st\relay.log").Length
(Get-Content "$st\relay.log" | Measure-Object -Line).Lines
(Get-ChildItem "$st\delivered" -Recurse -File | Measure-Object).Count
Get-ChildItem "C:\Users\<用户名>\AppData\Roaming\@deepseek-ai\dsh-desktop\logs" -Filter "crash-*web-boot.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 Name,LastWriteTime
Get-Date -Format o
```

- 期望（17:15 实测值，可对照）：`relay.log` **72,162B / 行数记下**；`delivered` 全树 **82** 个文件；最新 crash 日志 02:39:33；当前时刻
- 实际：____________

### 步 1 · 关 DSH（主人）

主人：完整退出 DeepSeek Harness（不是关窗口），回一句「**关了**」。

### 步 2 · 开 DSH（主人）

主人：重新打开，回「**起来了**」；崩/白屏 → 回「**崩了**」+ 最新 `crash-*-web-boot.log` 文件名，走 §5。

### 步 3 · 启动行与设置卡日志（群内 Bot，DSH 回来后立刻跑）

```powershell
$st = "C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay"
$log = "$st\relay.log"
Select-String -Path $log -Pattern "启动 \d+/\d+ 个 watch" | Select-Object -Last 1 | ForEach-Object { $_.Line }
Select-String -Path $log -Pattern "去重跳过" | Select-Object -Last 3 | ForEach-Object { $_.Line }
Select-String -Path $log -Pattern "设置卡" | Select-Object -Last 3 | ForEach-Object { $_.Line }
Select-String -Path $log -Pattern "pending \(waiting for service" | Select-Object -Last 3
Get-ChildItem "C:\Users\<用户名>\AppData\Roaming\@deepseek-ai\dsh-desktop\logs" -Filter "crash-*web-boot.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 2 Name,LastWriteTime
```

- 期望：
  - 启动行 = `启动 7/7 个 watch；stableMs=5000，delivered=…`（本卡唯一硬门之一）
  - `设置卡` 无「未挂载」字样
  - `pending (waiting for service` **无输出**
  - 最新 crash 日志 `LastWriteTime` 仍 ≤ 02:39:33（没有新崩溃）
  - （P31-c 相关读数本轮不看，守夜未启，见 §7）
- 实际：____________

### 步 4 · P29 界面（主人在设置卡上点，群内 Bot 记）

入口：**设置 → 插件 → 已安装 → 点 `dsh-handoff-relay` → README 页最下方「包含的组件」→ 点组件名**。

| # | 动作 | 通过条件 | 实际 |
|---|---|---|---|
| U1 | 打开卡 | 每行右侧有**圆点**；本行有「**选择目录…**」按钮 | |
| U2 | 点「选择目录…」 | 弹**系统**目录选择框（资源管理器样式），不是网页内伪选择器 | |
| U3 | 选中 `C:\develop\workspace\AI-writer\develop` | 目录框被填成该绝对路径 | |
| U4 | 等 ≤3 秒 | **绿点** | |
| U5 | 手动改成 `C:\no-such-dir-050`，等 ≤3 秒 | **红点** | |
| U6 | 改回真实目录 | 回到**绿点** | |
| U7 | 多会话语义（现象记录即可） | 只要不是「永远绿」或「永远灰」即过；取哪个会话由 `client.js:202` `firstSessionId` 决定，已知行为不返工 | |
| U8 | 「保存」后重开卡；再「放弃修改」 | 保存值仍在；放弃回原值；无报错弹窗 | |

U2 点不出系统框时只读取证（不改码）：

```powershell
$c = "C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\dsh-handoff-relay\client.js"
Select-String -Path $c -Pattern "__DSH_DIRECTORY_PICKER__|workspaceFiles" | Select-Object -First 8 | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }
```

- 期望：`:178` 有 `__DSH_DIRECTORY_PICKER__`，`:185-200` 有四个 `workspaceFiles` 候选。看不到 → 记「选择器不可用」，不回滚、不影响其它判定。

### 步 5 · P31-a + P31-b（群内 Bot，一条命令做完，保证 30 秒窗口）

判定前提（`index.js:285-297`）：判重 = 同绝对路径 + size 相同 + mtimeMs 相同 + 距该路径上次落盘 < 30,000ms。所以 b 必须在 a 投出后 30 秒内把原文件**原样搬回**（`Copy-Item` 保留 mtime）。

```powershell
$st = "C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay"
$watch = "C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy"
$name = "probe-050-dedupe-b.md"
$p = Join-Path $watch $name
"P31 探针 b · $(Get-Date -Format o)`n<!-- DONE -->" | Set-Content -Path $p -Encoding utf8
$deadline = (Get-Date).AddSeconds(20)
while ((Test-Path $p) -and ((Get-Date) -lt $deadline)) { Start-Sleep -Milliseconds 300 }
if (Test-Path $p) { "A-TIMEOUT：20 秒仍未投出（源目录还在）"; exit }
"a 已投出：$(Get-Date -Format o)"
$sent = Get-ChildItem (Join-Path $st "delivered") -Recurse -Filter $name | Sort-Object LastWriteTime -Descending | Select-Object -First 1
"落点：$($sent.FullName)"
Copy-Item $sent.FullName $p -Force
Get-Item $p | Select-Object Length,LastWriteTimeUtc
Start-Sleep -Seconds 3
Select-String -Path (Join-Path $st "relay.log") -Pattern "去重跳过" | Select-Object -Last 2 | ForEach-Object { $_.Line }
"delivered 里同名件数：" + ((Get-ChildItem (Join-Path $st "delivered") -Recurse -Filter $name | Measure-Object).Count)
Remove-Item $p -Force -ErrorAction SilentlyContinue
"探针已清理：" + (-not (Test-Path $p))
```

- 期望：
  - 出现 `a 已投出：…`（P31-a：投递成功，**源目录文件消失**）
  - `delivered 里同名件数：1`（没有第二封 ⇒ 没有重复唤醒）
  - `relay.log` 末两条含 `去重跳过 … probe-050-dedupe-b.md 原因=重复(size,mtime 相同)`
  - `探针已清理：True`
- **注意（旧脚本此处写错）**：成功投递**不写** `relay.log`（`index.js:1014` 只走 `log(ctx,'info')`；`relay.log` 只收「启动 / 移动失败 / 跳过」三类，见 `index.js:314` 注释）。所以别拿「日志有 1 行投递 INFO」当通过条件——**判据是 delivered 里出现 + 源目录清空 + 没有 `去重跳过` 之外的异常行**。
- 实际：____________

### 步 6 · P31-c 收尾（**本轮不执行**，守夜未启）

负责人 17:17 定：守夜进程先不上 ⇒ 本轮没有 `probe-050-startup-old.md`，这一段整段跳过，判据里 P31-c 记「待 §7」。主人点头后再按 §7 启守夜，然后回到这里执行：

```powershell
$to = "C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-owner"
$p = Join-Path $to "probe-050-startup-old.md"
Test-Path $p
Remove-Item $p -Force -ErrorAction SilentlyContinue
"已清理：" + (-not (Test-Path $p))
Get-ChildItem (Join-Path "C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\delivered" "462e69db07b3") -File | Where-Object Name -like "probe-050-startup-old*"
```

- 期望：`Test-Path` = `True`（**文件还在原地 = 没被投递**，P31-c 成立）；`已清理：True`；`delivered\462e69db07b3\` 里**没有**该文件
- 若 `Test-Path` = `False` 且 delivered 里有它 ⇒ P31-c **失败**：启动期把旧文件重投了，抄日志原文交负责人
- 实际：____________

---

## 3. 判据（缺一不判过）

| 项 | 通过条件 |
|---|---|
| 重启不崩 | 起来了、无新增 `crash-*-web-boot.log`、无 `pending (waiting for service …)` |
| 启动行 | `启动 7/7 个 watch；stableMs=5000` |
| M3 | `relay.log` 无「设置卡未挂载」 |
| P29 U1–U6、U8 | 逐条通过（U2 要求**系统**选择框） |
| P29 U7 | 现象如实记录即可 |
| P31-a | 探针投出、源目录清空、delivered 只有一封 |
| P31-b | `去重跳过 … 原因=重复(size,mtime 相同)` 出现、delivered 仍只有一封 |
| P31-c | **本轮不验**（守夜未启，见 §7）；启用后判：旧探针留在原地、`去重跳过 … 原因=启动前旧文件` 出现、delivered 无该件 |
| 未执行 | 主人不做界面点击时，U1–U8 记「未执行」，不判 FAIL |

---

## 4. 回滚（只在崩/白屏时；DSH 必须已关闭）

备份名：`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml.bak-050`

```powershell
Copy-Item "C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml.bak-050" "C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml" -Force
(Get-FileHash "C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml" -Algorithm MD5).Hash
```

期望回显 **`F895C286F1B6E40938FD0E94EAF8B434`**（已核：备份与当前文件逐字节相同）。然后重开 DSH，回「**已回滚**」，本轮判 FAIL，不重试第二次。

---

## 5. 执行记录表

| 步 | 执行人 | 时刻 | 结果原文 |
|---|---|---|---|
| 0-a 旧探针 | | | |
| 0-b 基线 | | | |
| ① 关 DSH | | | |
| ② 开 DSH | | | |
| 3 启动行/去重/设置卡 | | | |
| 4 U1–U8 | | | |
| 5 P31-a/b | | | |
| 6 P31-c | | | |
| 结论 | | | PASS / FAIL（哪条）/ 部分未执行 |

---

## 6. 与旧脚本（`reports/real-machine-050-script.md`，17,205B / `1D1416A1…`）的差异清单

| # | 旧脚本 | 本卡 | 为什么 |
|---|---|---|---|
| 1 | §0.4「现在跑的是旧代码，本次重启是 P29/P31 第一次上机」 | **拆两半**：主进程已经是新代码（`dedupe.json` 铁证）；渲染层自 08:45 起没重载，`client.js` 09:53 才改 ⇒ 重启的理由是「载入新 client.js」 | 旧结论基于 10:17 的启动行；16:22:52 是插件重挂载而非整机重启 |
| 2 | §4 P31-a「日志恰好 1 行 INFO 投递成功」 | **改为**：源目录清空 + delivered 出现 + 无「去重跳过」；**不看** relay.log 的投递行 | 成功投递不写 `relay.log`（`index.js:1014` vs `:314`） |
| 3 | §4 P31-c 用 `wakeup-inbox` 那封 10:05 存量验「启动前旧文件」 | **改为**：守夜进程在 DSH 关掉后落 `bridge\to-owner\probe-050-startup-old.md`，mtime 设 16:00（早于该桶 17:07:21） | ①10:05 存量 mtime **晚于**该桶 lastDeliveredAt(02:14)，走的是「新文件重试」，验不出该分支；②`wakeup-inbox` 桶在 `dedupe.json` 里根本不存在；③有桶的三个目录目标全在线，现在放会被立刻投出 |
| 4 | §4 P31-b 手动「30 秒内复制回来」 | 改成**一条 PowerShell 命令**：写探针 → 轮询消失 → 立刻回搬 | 人手动控制不住 30 秒窗口 |
| 5 | §1 三步（含「打开设置卡」） | 主人只做「关 / 开」，界面点击在第 4 步由主人在卡上完成 | 与 scope-v3 的 U1–U8 一致，避免三处重复要求主人操作 |
| 6 | §0.2 迁移 YAML / M1 标题解析 / §2 M1 | **本轮跳过** | scope-v3 明示 |
| 7 | 设置卡入口位置 | 保留（README 最下方「包含的组件」→ 点组件名） | 入口深，用户第一次找不到 |
| 8 | 回滚哈希 `F895C286…` | 保留，已复核与 `bak-050` 一致 | — |

---

## 7. P31-c 守夜进程（**主人点头后才启**；本轮不启）

负责人 17:17 定：真机轮卡在主人「要不要现在重启」，没回话就不开跑，守夜进程不预先摆着占资源。本节的命令原文备齐，主人一点头就照抄执行，不用现拼。

**执行主体说明（先钉死）**：守夜进程是**独立于 DSH 的 pwsh 进程**，在主人关 DSH **之前**启动、关掉之后自己落探针——所以「DSH 一关群就没了」不构成障碍，落探针这一步不需要任何 Bot 在场；需要群内 Bot 在场的只有「重启后核验」（那时群已回来）和主人重启前的启动动作。

### 7.1 为什么要等「关门后」才落探针

三个有去重桶的目录（`bridge\to-owner`=`462e69db07b3`、`bridge\to-group`、`signals\doubao`）目标**此刻全在线**（`08:22:52Z` 7 条加载解析里 6 条 `resolved`），现在放文件 5 秒内就被真投出去，等到重启时文件已不在目录里，这条就白验。所以要等 DSH 关掉、插件停转之后写。

### 7.2 守夜脚本（存成 `.batch\night\staging\p31c-probe-waiter.ps1`）

```powershell
param([int]$TimeoutMinutes = 60)
$to   = "C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-owner"
$p    = Join-Path $to "probe-050-startup-old.md"
$mark = "C:\develop\workspace\AI-writer\develop\.batch\night\staging\p31c-waiter.log"
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
while ((Get-Date) -lt $deadline) {
  if (-not (Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds 500
}
if (Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue) {
  "$(Get-Date -Format o) TIMEOUT 未检测到关门，探针未写" | Add-Content $mark
  exit 1
}
"P31-c 探针：启动期旧文件，不应被投递`n<!-- DONE -->" | Set-Content -Path $p -Encoding utf8
(Get-Item $p).LastWriteTime = Get-Date "2026-11-14 16:00:00"
"$(Get-Date -Format o) WROTE $p size=$((Get-Item $p).Length) mtime=$((Get-Item $p).LastWriteTime)" | Add-Content $mark
```

### 7.3 启动（独立进程，DSH 关掉后仍然活着）

```powershell
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-File","C:\develop\workspace\AI-writer\develop\.batch\night\staging\p31c-probe-waiter.ps1"
```

- 期望：命令立刻返回；`staging\p31c-waiter.log` 暂时没有 `WROTE` 行（还没关门）
- **时机要求**：必须在主人关 DSH **之前**启动；主人临时改期则 60 分钟超时自己退，日志留 `TIMEOUT`
- 实际：____________

### 7.4 重启后核验（启用守夜后才跑，替代步 6）

```powershell
$st = "C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay"
Get-Content "C:\develop\workspace\AI-writer\develop\.batch\night\staging\p31c-waiter.log"
Test-Path "C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-owner\probe-050-startup-old.md"
Select-String -Path "$st\relay.log" -Pattern "去重跳过" | Select-Object -Last 3 | ForEach-Object { $_.Line }
Get-ChildItem "$st\delivered\462e69db07b3" -File | Where-Object Name -like "probe-050-startup-old*"
```

- 通过：守夜日志有 `WROTE … mtime=2026-11-14 16:00:00`；`Test-Path` = `True`；`relay.log` 有 `去重跳过 … probe-050-startup-old.md 原因=启动前旧文件(mtime<=lastDeliveredAt)`；`delivered\462e69db07b3\` 里没有该文件
- 失败：`Test-Path` = `False` 且 delivered 有它 ⇒ 启动期把旧文件重投了，抄日志原文交负责人
- 清理：`Remove-Item` 删探针（同 §2 步 6 命令）

<!-- DONE -->
