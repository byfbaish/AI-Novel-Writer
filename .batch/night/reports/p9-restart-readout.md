# P9 重启后四项读数（22:39）

## 读数

| 项 | 值 | 判 |
|---|---|---|
| 待投文件 `wake-later.done` | 仍在原地，176B，mtime=ctime `21:54:49.453`，MD5 `EAE979C6…229`（与基线逐字同） | ❌ 未移走 |
| `delivered\` 增量 | 仍为 `90caa0a2de22`=1、`abf70c44921e`=1、`dad6df13f302`=**0**；三个 dirmtime 与重启前一致（21:26:07 / 21:24:29 / 21:54:49.459） | ❌ 无新增 |
| 目标会话是否收到 | 未收到（大肥鱼 报无投递） | ❌ |
| `relay.log` | 只有 1 行，`2026-11-13T14:36:41.558Z INFO [dsh-handoff-relay] 启动 7/7 个 watch；stableMs=5000，delivered=…` | ✅ 新代码已加载，但只有启动行 |
| `failed.json` / state.json | 均不存在 | ✅ |

## 为什么 176B 那个文件没被移走

代码路径（`index.js`，HEAD `51b9b73`）：

1. `index.js:567` 启动时 `for (const rel of listFiles()) consider(rel);` —— 启动扫描**是有的**。
2. `consider()`（`:530`）判 `delivered.has(relName|sig)`（`:538`）→ 空；`isFailedSnapshot`（`:539`）→ false；进 `deliver()`。
3. `deliver()`（`:486`）**先 `delivered.add(key)`（`:490`）**，**再** `resolveNow(relName)`（`:494`）；解析失败就 `return`（`:495`）。
4. `resolveNow` 解析失败时不写 `relay.log`，只走 `log(ctx, …)`（`:459`/`:467`/`:470`），而 `log()` 走 `ctx.logger`，**不落 relay.log**。
5. 于是结果恰好是现场看到的：文件不动、无 WARN、`delivered` 里已经被标记 ⇒ 之后同一快照的任何 fs.watch 事件都被 `:538` 挡住，直到文件 mtime/size 变化或进程重启。

**最可能的触发条件：`apply()` 跑启动扫描时，会话注册表还没就绪**——`relay.log` 启动行是 `14:36:41.558Z`，而目标会话 `session-4380d607…` 的 `session.v4.jsonl.zstd` 首次写入是 `22:36:53`（晚约 11 秒）。扫描发生在 41.5 秒，`ctx.agents.get(id)` 极可能返回 undefined。

## 两点补充

- `delivered.add` 先于 `resolveNow` 的写序，在 `6563d27`（P9 之前）就是这样，**不是 P9 引入的回归**，是既有缺陷被启动时序放大。
- 日志口径缺口：7 条 watch 的「解析到/解析不到」只进 `ctx.logger`，不进 `relay.log`，所以这次无法自证。建议 P10 把「启动时解析失败」也写成一条 relay.log WARN。

## 建议的下一步

A（推荐，10 秒出结论）：现在把 `wake-later.done` 的 mtime 触碰一下（`LastWriteTime = now`）。
- 若立即投递并移走 ⇒ 证明「解析现在正常，问题只在启动时过早」，且能顺带拿到 P9 的 move+log 真机证据；
- 若仍不投递 ⇒ 说明配置里的 id 现在也解析不到，要查 `ctx.agents.get()` 的匹配口径。
B：再重启一次赌时序，不建议——同一时序会再失败一次，且拿不到新信息。

---

# 追加（22:43）· A 方案执行结果：投递成功

## 动作

22:42:18.354 把 `signals\doubao\wake-later.done` 的 mtime 触碰为当前时间（内容未动，176B，MD5 不变）。

## 四项读数

| 判据 | 读数 | 判 |
|---|---|---|
| ① 文件是否移走 | `signals\doubao` 内已无该文件，只剩 `.gitkeep`（根 `wakeup-inbox` 下的 `doubao`/`workbuddy` 是子目录不是残留文件） | ✅ |
| ② `delivered\` 新增件 | `delivered\dad6df13f302\wake-later.done`，**176B**，MD5 **`EAE979C60EFCAE0F25758B2593E71229`**、SHA256 `9AABAFC900B4FBD95A10FA3F95EADA9B648AA26A58BEE7CDDC817384D77A0F61`，dirmtime `22:42:18.418`；该目录重启前 0 件，现 1 件 | ✅ 恰好新增 1 件 |
| ③ 目标会话条数 | 1 条（22:42:18，触发=`DONE`，文案带绝对路径 `…\.batch\night\signals\doubao\wake-later.done`），由豆包联络人侧确认 | ✅ 恰好 1 条 |
| ④ `relay.log` | 仍 168B，**只有 1 行 INFO**（启动行），无 WARN；`failed.json` 未生成 | ✅ 成功路径不写日志，与设计一致 |

## `agents.get('session-4380d607…')` 此刻是否解析成功

**成功。** 依据：`deliver()` 里 `resolveNow()` 是唯一的解析入口（`index.js:494`），解析失败会 `:495` 直接 return，不可能走到 `followup` 与 `takeDelivered`；而本次既投递了、也移动了。所以解析口径与配置 id 都没问题。

## 结论

1. **P9 真机 PASS**：move 成功、内容逐字未变（MD5/SHA256 双证）、目标会话恰好 1 条、`relay.log` 无 WARN、`failed.json` 未生成。
2. 启动那次的静默丢，确认是**时序**而非配置：`apply()` 扫描发生在 14:36:41.558Z，目标会话文件首次写入 22:36:53，扫描时注册表还没就绪。
3. 日志缺口坐实：成功路径不写 `relay.log`、失败 warn 只进 `ctx.logger`，所以「启动时解析不到」这件事在磁盘上不留任何痕迹。P10 若只补 WARN 而不补 per-watch 的解析结果，下一次仍会查无实证。

---

# 追加（22:46）· 给 P10 的一条技术提醒：只调换顺序不足以修复启动期

核实（`index.js` HEAD `51b9b73`）：启动扫描只在 `:567` 执行一次，**之后没有任何重扫或重试机制**——
- `setTimeout` 只出现在 `:522`、`:549`（stableMs 静默计时），只在 `consider()` 建了 pending 之后才存在；
- `queueMicrotask` 只用于 `takeDelivered`（`:506`）；
- `fs.watch` 回调（`:556-558`）只在有事件时触发，事件又不带旧文件。

所以 P10 若只做「先解析后标记、失败写 WARN」：
- 启动期解析失败 ⇒ 现在至少会留一行 WARN，但**文件仍然不会被补投**，因为没有任何东西会再触发一次扫描；
- 第一次重启照样丢存量，只是从「静默丢」变成「有日志地丢」。

真正修掉启动期漏投，必须让失败可重试，三选一（都不需新增定时器）：
1. **首个 fs.watch 事件到达时顺手做一次 `listFiles()` 全量重扫**（复用现有事件，代价是第一次有新文件时会顺带补投旧件，恰好是我们想要的语义）；
2. 把 `:567` 的扫描从 `apply()` 同步执行改到**第一个 tick 之后**（`setImmediate`），前提是宿主在同一 tick 内完成 agents 注册——未验证，需实测；
3. 启动期解析失败的 watch 记入一个「待重试」集合，在 `ctx` 侧一次性的 `ready`/首条消息回调里重扫——依赖宿主是否提供该钩子，需查 `@deepseek-ai/*` 的类型定义。

推荐 1，最稳、无外部依赖、语义也最对（「宁可多投，不静默漏投」）。

---

# 追加（23:06）· 首事件重扫补投真机读数（P10 目标 6）

## 环境

- 宿主 23:04:27 起，插件 23:04:30.405–.416 加载：7 条 watch 全部 `agent-not-found`，探针 `probe-startup-1113.txt`（336B）保持未投递，并落 1 行 WARN。→ P10 目标 1/2/3 生效：不再静默丢。

## 我做的第 5 步

- 23:06:09.635 往 `signals\doubao` 写入 `trigger-2306.txt`，65B，**不带** `<!-- DONE -->`（走 stableMs 路径）。
- 未触碰任何已有文件的 mtime。

## 8 秒后读数

- 源目录 `signals\doubao` 只剩 `.gitkeep` ⇒ **探针和触发件都被移走**。
- `delivered\dad6df13f302\` 由 2 件变 4 件，新增：
  - `probe-startup-1113.txt` 336B、MD5 `002BDA64D1F3F6BD625CBB3E322E6E29`，与 staging 原件（336B，同 MD5，mtime 22:57:05.597）逐字相同；
  - `trigger-2306.txt` 65B、MD5 `53E1731751A97AA0156F5AC21D5C973A`。
- `relay.log` 仍是 2,249B / 10 行，**本次无新增**——成功路径不写日志，与设计一致（WARN 只在失败时出现）。
- `failed.json` 不存在。

## 结论（只陈述事实）

启动期解析失败的探针，在首个普通文件事件到达后被**补投并移走**，内容逐字未变，且这是在不碰 mtime 的前提下发生的。即「首次事件全量重扫」这条补投路径真机成立。
