# dsh-handoff-relay「启动重放」取证（只读，未改码）

HEAD `6563d27`，`index.js` 24052B。取证时间 11-13 22:00–22:04。

## 1. 重放发生在哪一段

- 启动扫描：`index.js:421-422`
  ```
  421:  // 停机期间留下的文件：启动后扫一遍，保证补发一次；已投过的文件已被移走，不会重放。
  422:  for (const rel of listFiles()) consider(rel);
  ```
- `listFiles()` 在 `index.js:406-409`，读的是 **watchDir 本身**：
  `fs.readdirSync(watchDir, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name)`
- 结论：启动重放的输入是 **watch 目录里的存量文件**，`delivered/` 不被当作输入。
- `delivered/` 只出现在三处：`pruneDelivered`（`index.js:67-93`，只删 7 天前或超 1000 件的旧件）、`takeDelivered`（`97-120`，投递后 rename 进去）、日志行 `426-427`。**没有任何代码从 delivered/ 重投**。

## 2. 去重栅栏

- 只有内存里一份：`index.js:302` `const delivered = new Set();`，`deliver()` 在 `345-346` 用它挡重复。
- 它**不落盘**，`dispose()` 里随 watch 一起销毁 → 重启/热重载后为空。
- 真正的持久化去重是「投递后把文件 move 出去」（设计注释 `index.js:30-31`），所以**重放范围 = 仍留在 watch 目录里的文件**。

## 3. 现状取证：确实有文件没被移走

- `signals\doubao\wake-later.done` 176B、mtime 21:54:49，**仍在 watch 目录内**。
- 该目录的 dirKey 是 `dad6df13f302`，但 `delivered\` 下只有 `90caa0a2de22`（wakeup-inbox 根，探针）与 `abf70c44921e`（bridge\to-group），**没有 `dad6df13f302`**。
- 即：这个文件被投过（豆包联络人收到过），但一次都没被移走 → 每次 relay 重载/重启都会再投一次。豆包联络人观察到的重复唤醒是真的，但成因不是「重放 delivered/」，而是「这一条没 move 走」。
- move 失败只 warn 不重试（`index.js:116-119`），而本机没有插件落盘日志，所以失败原因目前**无从追溯**——这是"需要插桩"的点，不是可断言的原因。
- 其余 6 条 watch 目录干净（只有 `.gitkeep`），`dsh-handoff-relay-state.json` 不存在（P8 后已退役）。

## 4. 不是配置事故

- 7 条 watch 的 dir 全部在 `C:\develop\workspace\AI-writer\develop\...` 下；delivered 根在 `C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\delivered`，**无任何重叠**。
- 代码本身还有一道闸：`resolveDeliveredRoot` `index.js:56-61` 若发现 delivered 落在任一 watch 目录内，会改到 `%TEMP%\dsh-handoff-relay\delivered`，并在 `index.js:452-455` 打 warn。当前 `%TEMP%` 下没有该目录，说明未触发。

## 5. 可复现的判定方法（不改码）

1. 先记基线：`Get-ChildItem <delivered>\dad6df13f302` 不存在 + `signals\doubao` 里有 `wake-later.done`。
2. 触发一次 relay 重载（改 `cordis.patch.yml` 里任意一条 watch 的注释/字段并保存），不重启 DSH。
3. 观察：豆包联络人应再收到一次同一条 `wake-later.done` 通知，且文件仍在原地、`delivered\dad6df13f302` 仍不生成 → 证明重放源是 watch 目录存量，且该目录的 move 路径坏了。
4. 反证：把任意干净 watch 目录（如 `bridge\to-owner`）放一个 canary，等它投递，确认它被 move 到 `delivered\<对应 dirKey>\`，重启后不再重投 → 证明正常情况下 move 生效、不重放。

## 6. 待查（开卡时的第一个问题）

`wake-later.done` 为什么没被 move：是 `takeDelivered` 的 `statSync(full)` 抛错（`98`）、rename 抛错（`104-111`）、还是根本没走到 `deliver()` 的 `362` 那步（例如 `351` 目标解析失败直接 return）。三者日志不同，但现在都看不到——需要把插件日志落到文件才能二选一。

---

# 追加（22:03 复查）· 更正与现场污染

## 我上一版的两处错误（自查）

1. **「`delivered\dad6df13f302` 不存在」是错的**。我 22:01 用的是 `Get-ChildItem -Recurse -File`，空目录不进结果，是我列法错。实际它一直在：目录创建 `21:54:32.876`，dirmtime（目录最后变更）`21:54:49.459`，**当前为空**。
2. `.__rename_test` **不是我放的**。我两次探针全部在 `%TEMP%\relay-probe-*` 下，跑完即删；生产 watch 目录我一个文件都没写过。豆包联络人 22:02:15 收到的那次唤醒，样本没有归属。

## 当前现场（22:03:27.679）

| 对象 | 时间 | 内容 |
|---|---|---|
| `delivered\90caa0a2de22` | dirmtime 21:26:07.538 | `probe-rewire-2125.txt` 214B |
| `delivered\abf70c44921e` | dirmtime 21:24:29.262 | `decision-permission-b-2124.md` 1077B |
| `delivered\dad6df13f302` | 创建 21:54:32.876 / dirmtime 21:54:49.459 | **空** |
| `signals\doubao\wake-later.done` | ctime=mtime 21:54:49.453 | 176B，仍在原地 |

## 干净环境实测（%TEMP%，与 DSH 无关）

Node 24 实测三条：

- `fs.rmSync(不存在的目标, {force:true})` → **不改**父目录 mtime（`rmMissingChangesMtime:false`）
- 成功 `fs.renameSync` → **改**父目录 mtime（`renameChangesMtime:true`）
- 源文件以 `r+` 打开状态下 `renameSync` → **成功**（`renameWhileOpen:null`），Node 用带 FILE_SHARE_DELETE 的句柄

推论：「文件被写入方占用导致搬不走」这个假设**站不住**。

## 这段现场不能作为代码判定依据

`dad6df13f302` 的 dirmtime `21:54:49.459` 比源文件 ctime `21:54:49.453` 晚 6ms —— 目录里确实发生过一次成功 rename（rename 才会改 dirmtime）。但此刻目录是空的、文件在原位且 ctime 仍是 21:54:49.453：

- 若文件被搬进去又搬回 watch 目录，dirmtime 会被第二次 rename 刷新到更晚，事实不是；
- 若文件被搬进去后删除，NTFS 删除也会刷新 dirmtime，事实也不是。

两者都不成立 ⇒ 这段现场期间有插件之外的进程动过这两个位置（删/移）。因此 **21:58 那两次重放样本、以及 `dad6df13f302` 的时间线，都不能拿来给代码定性**。

## 仍然成立的代码事实（不受污染影响）

- 重放输入 = watch 目录存量文件（`index.js:421-422` → `listFiles()` `406-409` 读 `watchDir`）；`delivered/` 从不作为输入。
- 去重只有内存 `Set`（`302`、`345-346`），随 `dispose()` 清空。
- 文件留在原地 ⇒ 每次重载重投。这一条不依赖上面的时间线。

## 「文件为什么没被搬走」的三条候选（都需日志才能二选一）

1. `index.js:351` `resolveNow` 返回 null → 直接 return，不投递也不搬（但此时豆包不应收到通知）；
2. `index.js:363` `followup` 抛错 → 只 warn，不搬；
3. `index.js:101-111` rename 抛非 EXDEV 错（杀软/索引器/权限）→ 只 warn，不重试，目录已建、文件留原地。

开 P9 的第一条判据建议定为：**能把插件 warn 日志落到文件**（当前本机无落盘日志，这是所有定性工作的前置）。

---

# 追加（22:05）· 探针归属已认领

- 豆包联络人 22:04 认领：`.__rename_test` 是它 22:02 放在 `signals\doubao\` 的自测文件，作用只是验证 rename 能否触发唤醒；22:02:15 那次唤醒归属它，与 21:58 两次重放无关。
- 该文件 22:02:23 已不在原地 ⇒ 它走完了「投递后 rename」，即那个 watch 的 takeDelivered 至少成功过一次。
- 因此 `dad6df13f302` 的 dirmtime `21:54:49.459` 与「文件仍在原地」这一对矛盾，**更可能是外部写入方在投递后重建了同名文件**，而非插件搬不动。后续判定必须换判据：看 ctime（创建时间）是否变化，不能只看 size+mtime。

## 给 P9 的一条判据建议

`failed.json` 用 `size:mtime` 做 finger 足够挡住"同一文件反复重投"，但**不能据此跳过 ctime 变化的重写件**——否则会把「投递后外部重建的新信号」当成旧件吞掉。

---

# 追加（22:06）· 归属最终版与仍缺归属的一点

## 归属

- `.__rename_test`：**AI writer总负责人** 22:05 认领（在 `signals\doubao` 做 Move-Item 往返测试）。豆包联络人 22:04 也认领过一次，两条认领都保留在记录里，以负责人本次为准。
- 22:02:15 那次唤醒样本 ⇒ 归属负责人，**从代码定性中排除**。

## 仍缺归属的一点

`delivered\dad6df13f302` 的 dirmtime `21:54:49.459` 比源文件 `wake-later.done` 的 ctime `21:54:49.453` 晚 6ms，说明 **21:54:49 那一刻有一次「进入该目录」的成功 rename**（只有创建/移入/移出该目录才会刷新它的 mtime）。这一笔目前没有归属：

- 若是负责人 21:54 前后的 Move-Item 往返所致，这一段时间线一并排除；
- 若不是，则它仍是「插件搬进去了、文件却回到原地」的唯一硬痕迹。

在有人认领之前，判定只用一条**不依赖时间线**的结论：文件留在 watch 目录 ⇒ 每次重载重投一次（去重只有内存 Set，`index.js:302`、`345-346`）。

---

# 追加（22:07）· 补齐 NTFS 目录时间戳语义，撤回「现场被外部动过」

## 新测三条（%TEMP%，Node/PowerShell，与 DSH 无关）

| 动作 | 父目录 mtime 变不变 |
|---|---|
| 删除目录内已存在的文件 | **变**（`22:06:02.940 → 22:06:03.091`） |
| 把文件移出该目录 | **变**（`→ 22:06:03.232`） |
| 把文件移入该目录 | **变**（`→ 22:06:03.358`） |
| 移出再移回 | 两次都变（`t0=03.361 out=03.500 back=03.628`） |
| 移出再移回后，文件的**创建时间** | **保留原值**（`03.361`，与移出前一致） |
| 连做 5 次「建+删」，每次即刻读 dirmtime | 每次都跟上，无惰性延迟 |

## 由此更正我 22:04 的结论

- 「移动会保留创建时间」⇒ **ctime 无法区分「被搬走又搬回」和「一直没动」**，我之前拿 ctime 当「文件没被动过」的证据，无效。
- 唯一还硬的是：`dad6df13f302` 的 dirmtime `21:54:49.459` 是一次「有东西进入或离开该目录」的痕迹，而此刻目录为空。
- 一致的解释存在两种，且都能自洽：
  1. 文件在 `21:54:49.459` 被移入、又在**同一毫秒**内被移出/删除（PowerShell 显示到毫秒，内部精度 100ns，不能排除）；
  2. 移入后确实被删过，只是目录时间戳未反映出来（本次实验未复现，但不排除 NTFS 惰性刷新在别的路径上表现不同）。
- 所以 **「现场被插件之外的进程动过」这一句撤回**：证据不足以支持，也不足以否证。

## 结论不变的那条

文件仍留在 watch 目录 ⇒ 去重只有内存 Set（`index.js:302`、`345-346`），每次热重载/重启就重投一次。这条不依赖任何时间线，也是 P9 要解决的根问题。定性仍须靠 `relay.log`。
