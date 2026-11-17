# 真机验收 · 0.5.0 合并版（P29 界面 + P31 去重 + 7 条 watch 迁移）

> 出：developer（派单人：AI writer总负责人，m00221/m00222） · 2026-11-14 10:20
> 交付类：B 类草稿（不产生仓库提交）· 判据：报告在盘 + 信号在 `signals\workbuddy\`
> 原则：**主人只做 3 步**（关 DSH / 开 DSH / 看界面回一句），其余全部由群内执行；一次重启验完三件事，不拆两回。

---

## 0. 离线预检（已完成，证据在盘）

| 项 | 实测值 | 判定 |
|---|---|---|
| 仓库 HEAD | `d535dc1` feat: add directory picker and readable dir hints | ✅ |
| porcelain | 空（无输出） | ✅ |
| profile 安装形态 | `~\.dsh\profiles\desktop\node_modules\dsh-handoff-relay` = **Junction → `C:\develop\workspace\dsh-handoff-relay`** | ✅ 无需 install |
| 三件 blob 一致性 | `index.js` `8293cc1461341e2d8142b25d932b2b37acbb02a5` / `client.js` `56e2c1bd8fc10a8d9a32814b03ef39ca03abf8bd` / `package.json` `1b04240d94d3b8fe97094cb06224d1717a2eb20b` —— 仓库与 profile 侧**逐一致** | ✅ 重启即加载 HEAD 代码 |
| 配置行数 / MD5 | `cordis.patch.yml` 316 行 / `F895C286F1B6E40938FD0E94EAF8B434`（10591B） | — |
| 备份 | **`cordis.patch.yml.bak-050`** 已建（同 MD5 `F895C286…`） | ✅ |
| 插件开关 | `- id: dsh-handoff-relay` → `disabled: false`（第 293 行起） | ✅ 已启用 |
| watch 条数 | 7 条，全部为 `targetSessionId` 形态，`stableMs: 5000` | ✅ |
| 状态目录 | `~\.dsh\profiles\desktop\dsh-handoff-relay\`，`relay.log` 68112B，`dedupe.json` **尚不存在**（P31 首次投递后生成） | — |
| 上次启动成功证据 | `relay.log` 末次启动行：`启动 7/7 个 watch；stableMs=5000，delivered=…\dsh-handoff-relay\delivered`（`2026-11-14T00:45:22Z`） | ✅ |

### 0.1 现在 7 条 watch 的「目录 → 会话」权威对应（迁移用）

证据来源：`~\.dsh\storages\session_projcache\sessions\session-<id>.json` 的 `record.rows.title.val` 与 `record.identity.cwd`（同一台机器、同一 profile 的宿主自写元数据）。

| # | dir | 现 targetSessionId | 该会话 title | cwd | 备注 |
|---|---|---|---|---|---|
| 0 | `…\scripts\dsh\wakeup-inbox` | `session-daeb834f…eb72` | `AI writer总负责人 · AI writer项目组` | `C:\develop\workspace\AI-writer\develop` | 解析常失败（会话多不常开） |
| 1 | `…\scripts\dsh\wakeup-inbox\workbuddy` | `session-33494f59…e7d0` | `workbuddy联络人 · AI writer项目组` | 同上 | |
| 2 | `…\scripts\dsh\wakeup-inbox\doubao` | `session-4380d607…b377` | `豆包联络人 · AI writer项目组` | 同上 | |
| 3 | `…\.batch\night\signals\workbuddy` | `session-33494f59…e7d0` | 同上 | 同上 | 与 #1 同一会话 |
| 4 | `…\.batch\night\signals\doubao` | `session-4380d607…b377` | 同上 | 同上 | 与 #2 同一会话 |
| 5 | `…\.batch\night\bridge\to-owner` | `session-a1d48adb…a9f1` | `大肥鱼`（私聊会话） | `C:\Users\<用户名>\.dsh\bot\workspace` | 与 #6 同 cwd |
| 6 | `…\.batch\night\bridge\to-group` | `session-453478dd…e7c3` | `大肥鱼 · AI writer项目组`（群会话） | 同上 | 两肥鱼同 cwd，**靠 title 区分，不能靠 cwd** |

→ 7 条 title 全部**唯一**，无需 `targetCwd`。`exact: true`（完全相等）可避开「大肥鱼」是「大肥鱼 · AI writer项目组」子串的坑——注意 `#5` 的 title `大肥鱼` 在 `exact:false`（包含匹配）下会同时命中 `#6`，所以 `#5` 必须 `exact: true`。

### 0.2 迁移 YAML（替换 `config.watches` 整段；`done` 省略＝默认 `<!-- DONE -->`，与原行为等价）

```yaml
    watches:
      - dir: 'C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox'
        targetTitle: 'AI writer总负责人 · AI writer项目组'
        targetSessionId: 'session-daeb834f-a940-44d0-b4cc-9d56b7c5eb72'
        exact: true
      - dir: 'C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox\workbuddy'
        targetTitle: 'workbuddy联络人 · AI writer项目组'
        targetSessionId: 'session-33494f59-babb-4168-af13-3b2fd525e7d0'
        exact: true
      - dir: 'C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox\doubao'
        targetTitle: '豆包联络人 · AI writer项目组'
        targetSessionId: 'session-4380d607-48ec-47f4-a0b5-e086e856b377'
        exact: true
      - dir: 'C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy'
        targetTitle: 'workbuddy联络人 · AI writer项目组'
        targetSessionId: 'session-33494f59-babb-4168-af13-3b2fd525e7d0'
        exact: true
      - dir: 'C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao'
        targetTitle: '豆包联络人 · AI writer项目组'
        targetSessionId: 'session-4380d607-48ec-47f4-a0b5-e086e856b377'
        exact: true
      - dir: 'C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-owner'
        targetTitle: '大肥鱼'
        targetSessionId: 'session-a1d48adb-037e-42b5-8436-c14aa468a9f1'
        exact: true
      - dir: 'C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-group'
        targetTitle: '大肥鱼 · AI writer项目组'
        targetSessionId: 'session-453478dd-2bf6-4099-8984-8868101be7c3'
        exact: true
```

- `targetSessionId` 全部保留作兜底（`index.js:961` 标题没命中/多义才按 id 校验），删不删都不影响本次判定。
- **改这一段是负责人的决定**，不属本脚本默认动作；谁改由负责人定（本脚本只负责：若已改，重启后按 M1 核；若没改，M1 记「未迁移」不算失败）。

### 0.3 watch 目录现状（重启会重放存量 → 先看清）

| dir | 现存文件 |
|---|---|
| `wakeup-inbox` | `.gitkeep` + **`dsh-wake-20261114-1005-6263.md`（245B，10:05:00）** |
| `wakeup-inbox\workbuddy` | 空 |
| `wakeup-inbox\doubao` | 空 |
| `signals\workbuddy` / `signals\doubao` / `bridge\to-owner` / `bridge\to-group` | 仅 `.gitkeep` |

⚠️ 那封 10:05 的 `dsh-wake-*.md` 是 10:05 投进 `wakeup-inbox` 后**因目标会话未活而没投出去**的存量（`relay.log` 10:05 有 3 行同毫秒 WARN `agent-not-found`）。重启后若目标会话活着，它会**补投一次给总负责人**——这属**预期补投**，**不要**当作「重复触发」。不删它（是别人的信），也不改它。

### 0.4 关键前提：现在跑着的宿主是**旧代码**（本次重启的硬理由）

| 证据 | 值 |
|---|---|
| 宿主本次启动（relay.log 启动行） | `2026-11-14T00:11:51Z` = 本地 **08:11:51** |
| `index.js` 落盘时刻 | **09:09:16**（P31 之后） |
| `client.js` 落盘时刻 | **09:53:23**（P29 之后） |
| 直接反证 | 本人 10:14:59 真投了一封信号进 `signals\workbuddy`，**投递成功**（落 `delivered\83e63d6cfdfa\`，1065B），但状态目录里**没有** `dedupe.json` —— P31 的成功路径必写该台账（`index.js:1013` → `persistDedupeRegistry:251`），没写只有一个解释：**内存里跑的是 P31 之前的 index.js**。 |

⇒ 本次重启是 P29/P31 代码第一次真上机；M1 之前的所有界面/去重现象都属旧代码，不能算数。

---

## 1. 真机三步（主人做，每步回一句）

### 步骤 ① 关闭 DSH（完整退出，不是最小化）
回一句「**关了**」。

### 步骤 ② 重新打开 DSH
- 正常起来 → 回「**起来了**」
- 崩 / 白屏 → 回「**崩了**」，并把 `C:\Users\<用户名>\AppData\Roaming\@deepseek-ai\dsh-desktop\logs\` 下**最新** `crash-*-web-boot.log` 的文件名发出来（不用发全文），随后走 §6 回滚。

### 步骤 ③ 打开插件设置卡
入口：**设置 → 插件 → 已安装 → 点 `dsh-handoff-relay` → README 页最下方「包含的组件」→ 点组件名**。
- 看到设置卡（含「目录/目标会话」等行 + 每行右侧圆点 + 「选择目录…」按钮）→ 回「**有卡**」，并**截图**（一屏能看全一行即可）
- 只有 README、没有设置卡 → 回「**无卡**」

---

## 2. 重启后核验（群内执行，不看整体只看逐条原文）

命令模板（PowerShell，`$log` 固定）：

```powershell
$log = "C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\relay.log"
$st  = "C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay"
```

### M1 · 7 条 watch 启动解析（迁移判据）
```powershell
Select-String -Path $log -Pattern "启动 \d+/\d+ 个 watch" | Select-Object -Last 1 | ForEach-Object { $_.Line }
Select-String -Path $log -Pattern "加载解析" | Select-Object -Last 7 | ForEach-Object { $_.Line }
```
- **必须**：最后一行是 `启动 7/7 个 watch；stableMs=5000，delivered=…`
- 每条 `加载解析` 行末尾的状态字段，含义（`describeTargetNow`，`index.js:590-610`）：
  - `resolved=<id>` → 标题**命中唯一**且会话活着 = **过**
  - `title-fallback=<id>` → 标题没命中/多义，靠 `targetSessionId` 兜底了；会话活着但**标题迁移这条没验成**，抄进记录（同时看上面的 warn 行拿了 `标题命中 N 条`）
  - `title-fallback-miss` → 标题与 id 都解析不到（该会话此刻没开）；不是标题写错的证据，复验须等该会话开着再重启一次
  - `agent-not-found`（未迁移的纯 id 形态）→ **不算失败**：会话此刻没开
  - `title-no-match:0` / `title-multiple:N`（无 id 兜底时才会出现）→ **真失败**，抄原文进记录
- 未迁移（配置里仍只有 `targetSessionId`）时，M1 记「未迁移」，其余各项照判。

### M2 · 不 pending、不崩
```powershell
Select-String -Path $log -Pattern "pending \(waiting for service" | Select-Object -Last 5
Get-ChildItem "C:\Users\<用户名>\AppData\Roaming\@deepseek-ai\dsh-desktop\logs" -Filter "crash-*web-boot.log" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name,LastWriteTime
```
- 期望：**无** `pending (waiting for service: …)`；`crash-*web-boot.log` 的 `LastWriteTime` 早于本次重启时刻。

### M3 · 设置卡挂载（日志侧）
```powershell
Select-String -Path $log -Pattern "设置卡" | Select-Object -Last 5 | ForEach-Object { $_.Line }
```
- 期望：无 `设置卡未挂载：…`；若出现，抄原文（这是「卡在界面上看不到」的最短因果链）。

---

## 3. P29 界面逐条（在设置卡上现场点，逐项记「通过/不通过 + 现象」）

| # | 动作 | 通过条件 |
|---|---|---|
| U1 | 看卡就行 | 每行末尾有**圆点**；本行有「选择目录…」按钮 |
| U2 | 点「选择目录…」 | 弹出**系统**目录选择框（Windows 资源管理器样式），不是网页内伪选择器 |
| U3 | 选一个确定存在的目录（如 `C:\develop\workspace\AI-writer\develop`） | 目录输入框被填成该绝对路径 |
| U4 | 填好后等 ≤3 秒看圆点 | **绿点**（`ok===true`） |
| U5 | 把目录手动改成不存在的路径（如 `C:\no-such-dir-050`）再等 ≤3 秒 | **红点**（`ok!==true`） |
| U6 | 改回原来那个真实目录 | 回到**绿点**（说明探测是实时的、非一次性） |
| U7 | 多会话语义（**必验**，QA 提请注意项） | 现象记录：选一个「对第一个会话可读、对其余不可读」的目录时圆点颜色；<br>判据：**只要不是「永远绿」或「永远灰」**即可，具体取哪个会话由 `firstSessionId`（`client.js:202`）决定，属已知行为，不在本期返工 |
| U8 | 点「保存」再「放弃修改」 | 保存生效（重开卡值仍在）；放弃后回到保存前值；无报错弹窗 |

U2 若**点不出**系统选择框：先查四条 `workspaceFiles` 候选哪条通（`client.js:185-200`），顺序为
`access.workspaceFiles` → `access.remote.workspaceFiles` → `ctx.get("remote").workspaceFiles` → `ctx.get("remote.workspaceFiles")`；
再查 `globalThis.__DSH_DIRECTORY_PICKER__` 是否存在（`client.js:178`）。两者都无 → 记「选择器不可用」，**不回滚**、不影响其它判定。

---

## 4. P31 去重（真机两步，必须都做）

前提：选一条**目标会话此刻活着**的 watch（最稳是 `signals\workbuddy`，workbuddy联络人会话常在）。

**P31-a 正常投递（不能重复唤醒）**
1. 往 `C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy\` 写一个探针文件，末行 `<!-- DONE -->`：
   ```powershell
   $p = "C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy\probe-050-dedupe-a.md"
   "P31 真机探针 a · $(Get-Date -Format o)`n<!-- DONE -->" | Set-Content -Path $p -Encoding utf8
   ```
2. ≥5 秒（`stableMs`）后核：
   ```powershell
   Get-ChildItem "C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy" -File
   Get-Content $log -Tail 6
   ```
   - 源目录**不再有** `probe-050-dedupe-a.md`；`delivered\<dirKey>\probe-050-dedupe-a.md` 在
   - 日志**恰好 1 行** INFO 投递成功；**不出现** `去重跳过`

**P31-b 同一封信再来一次（应被去重跳过）**

判重口径（`index.js:285-293` 原文）：**同一绝对路径 + size 相同 + mtimeMs 相同 + 该路径上次落盘时刻在 30 秒内**，四条同时成立才判重。注意 mtime 不变是硬条件，所以「再写一个同名文件」不算——必须**原样搬回来**。

3. 在 P31-a 投出后 **30 秒内**，把投出去的那封按原样复制回同一路径（`Copy-Item` 保留 mtime，size 不变）：
   ```powershell
   $watch = "C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy"
   $sent  = Get-ChildItem (Join-Path $st "delivered") -Recurse -Filter "probe-050-dedupe-a.md" |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
   $sent.FullName
   Copy-Item $sent.FullName (Join-Path $watch "probe-050-dedupe-a.md") -Force
   Get-Item (Join-Path $watch "probe-050-dedupe-a.md") | Select-Object Length,LastWriteTimeUtc
   ```
4. 核日志与台账：
   ```powershell
   Select-String -Path $log -Pattern "去重跳过" | Select-Object -Last 3 | ForEach-Object { $_.Line }
   Get-Content (Join-Path $st "dedupe.json") -Raw
   ```
   - 期望原文：`[dsh-handoff-relay] 去重跳过 <dir> probe-050-dedupe-a.md 原因=重复(size,mtime 相同)`（`index.js:297`）
   - 期望：`delivered\<dirKey>\` 里**仍只有一封**（没被投第二次）
   - 期望：`dedupe.json` 已生成，内容就是 `dirs` 表本身（`persistDedupeRegistry` 只写 `JSON.stringify(reg.dirs)`，`index.js:251`），形如 `{"<dirKey>":{"<绝对路径>":{"size":N,"mtimeMs":N,"at":"2026-11-14T…Z"}}}`
   - 注意：**被跳过的文件留在 watch 目录里，不会搬走**（`skipDuplicate` 只写日志、不移动）→ 测完**必须删掉**这个探针（`Remove-Item (Join-Path $watch "probe-050-dedupe-a.md")`），否则下次重启会被当新文件重投一次。
5. 若 30 秒窗口已过（说明慢了一步）：删掉 watch 里的探针，从 P31-a 重做一遍，不要放宽判据。

**P31-c 重启后不重放（与 M1 同一次重启即可覆盖）**：本次启动时 `wakeup-inbox` 里那封 10:05 存量若有 `原因=启动前旧文件(mtime<=lastDeliveredAt)`（`index.js:310`）→ 说明 P31 的「启动期旧文件」分支生效；若走了补投 → 记「存量补投 1 次」，不算失败。

---

## 5. 判据（终审用，缺一不判过）

| 项 | 通过条件 |
|---|---|
| 重启不崩 | 进程起来、无本次新增 `crash-*-web-boot.log`、无 `pending (waiting for service: …)` |
| 卡片可见 | 设置卡**实际渲染**出目录/目标会话等行 + 圆点 + 「选择目录…」按钮 |
| U1–U6、U8 | 逐条通过（U2 要求**系统**选择框） |
| U7 | 现象如实记录即可，不要求特定颜色 |
| 启动行 | `启动 7/7 个 watch；stableMs=5000` |
| M1 | 每条 `加载解析` 为 `resolved=` 或 `agent-not-found`；**不得**出现 `title-no-match:0` / `title-multiple:N` |
| P31-a | 投递成功且日志**只 1 行**、无 `去重跳过` |
| P31-b | 日志出现 `去重跳过 … 原因=重复(size,mtime 相同)`，且 `dedupe.json` 生成 |
| 无新 ERROR | 除已知 target 失效 WARN 外，无其它 ERROR |

---

## 6. 回滚（只在崩/白屏时用；DSH 必须已关闭）

备份名：**`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml.bak-050`**

```powershell
Copy-Item "C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml.bak-050" "C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml" -Force
(Get-FileHash "C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml" -Algorithm MD5).Hash
```
期望回显 **`F895C286F1B6E40938FD0E94EAF8B434`**；然后重新启动 DSH，回一句「**已回滚**」。本轮判 FAIL，不再重试第二次。

---

## 7. 执行记录表（谁做谁填，留原文）

| 步 | 执行人 | 时刻 | 结果原文 |
|---|---|---|---|
| ① 关 DSH | | | |
| ② 开 DSH | | | |
| ③ 看卡 | | | 有卡 / 无卡 |
| M1 启动行 | | | |
| M1 7 条解析 | | | |
| M2 pending/崩溃 | | | |
| M3 设置卡日志 | | | |
| U1–U8 | | | |
| P31-a / b / c | | | |
| 结论 | | | PASS / FAIL（哪条） |

<!-- DONE -->
