结论：PASS ｜ 提交：9f8e514f2681abf00fcb54075613003b16e4ebab ｜ 测试：TOTAL 47/47

# P4 · done 完成规则四态 + 启动校验

仓库：`C:\develop\workspace\dsh-file-watch`（身份仍为 `dsh-file-watch`，未改名）
改前 HEAD：`2a3504b`　改后 HEAD：`9f8e514`
时间盒：03:14 起，03:24 收口，约 10 分钟。

本轮授权：可改码 + 可提交（点名 `git add`），**未推送**。

---

## 1. 每条 watch 的 `done` 完成规则（四态）

**改在哪**：`index.js` 新增 `normalizeDone(done)`（第 53–78 行），`apply()` 在每条 watch 通过字段/目录校验后调用（第 289 行），把结果以 `judge` 传给 `startWatch()`（第 297 行）。

| 状态 | 判定方式 | 归一结果 |
|---|---|---|
| 省略（`w.done === undefined`） | 默认文本 `<!-- DONE -->` | `mode:'default'`，judge 走 text |
| `{ text: '...' }` | 文件尾部出现该字符串 | `mode:'text'` |
| `{ regex: '...' }` | 尾部匹配该正则 | `mode:'regex'` |
| `null` | 关闭完成规则 | `mode:'off'`，只按 `stableMs` |

**不新增 `enabled` / `mode` 键**：四态只靠「键在不在 / 值是什么键」区分，符合卡面 §2。
形状不认识（例如字符串、`{}`、`{ text: '' }`）不会崩，按 `off` 处理并写一条带 `dir` 的 warn，退回 `stableMs`。

**对应测试**：
- `省略 done → 默认 { text: "<!-- DONE -->" } 命中即提前投递`
- `省略 done 但无标记 → 不立即投递` / `…静默窗口到期后按 stable 投递`
- `done: { text } 命中即投递，默认标记不再立即投递` / `…未命中时在静默窗口到期后按 stable 投递`
- `done: { regex } 命中即提前投递` / `…不命中 → 不立即投递` / `…不命中 → 静默窗口到期后按 stable 投递`
- `done: null → 忽略完成标记，不立即投递` / `…静默窗口到期后按 stable 投递`

## 2. `done` 只是加速，不是前提

**实现**：三条投递路径保持原结构——`consider()`（第 236 行）、`checkStable()` 的两处（第 211、215 行）——命中 `done` 就 `deliver(..., 'DONE')` 立即返回；未命中时，`consider()` 起 `stableMs` 定时器，`checkStable()` 到期后直接 `deliver(..., 'stable')`，或在快照变化时重新计时，最终都会按 `stable` 投递。没有任何「必须命中才投」的分支。

**对应测试**：所有 `…不命中 → 静默窗口到期后按 stable 投递` 用例（text / regex / null / 省略 done）都在断言未命中后仍收到 `触发=stable`。

## 3. 加载期 `targetSessionId` 校验

**实现**：`resolveSessionTitle(ctx, targetSessionId)`（第 110–142 行），`apply()` 第 293–296 行调用。
- 先用 `ctx.agents.get(id)` 取 agent，取不到再用 `roots()` 按 id 兜底；
- 标题权威来源是宿主 `sessionTitle` 服务的 `get(agent.session)`（已核实：`dsh-whale-widget/lib/index.js:1000-1011` 注释与 `dsh-better-sidebar/lib/index.js:7182` 的 `ctx.get("sessionTitle")` 用法）；`agent.title/name/label`、`agent.session.title/name`、`agent.meta.title/name` 作为兜底；
- 解析不到 → `log(ctx,'warn', ...)`，日志带 `label`、`targetSessionId` 与 **该 watch 的 `dir`**；
- **不影响其他 watch**：校验只读、不阻断，之后照常 `startWatch`。零新增依赖（只用 `ctx.get` 与既有 `agents`）。

**对应测试**：
- `失效 targetSessionId → warn 带 dir 且不抛，其他 watch 照常投递`：一个 `BAD_SESSION` + 一个 `GOOD`，`get` 对前者返回 `undefined`、`roots()` 为空、`apply` 仍返回 dispose；`GOOD` 正常收到 1 条；断言 warn 同时包含 `无法解析会话标题` 与该 watch 的 `dir`。
- 原有 `T5 会话未加载`、`agents.get 抛错`、`agents.roots 抛错`、`get 返回 undefined 但 roots 中有该 id` 全部保持 PASS，证明校验没有改变运行期投递语义。

## 4. 加载期每条 watch 记一行模式日志

**实现**：
- 每条 watch 的加载行（`index.js:254`）：`… 已加载：dir=…，targetSessionId=…，stableMs=…，done=${mode}`，`mode ∈ default/text/regex/off`；
- 汇总行（`index.js:300`）：`已启动 N/M 个 watch；stableMs=…，done=["default","regex",…]`。

原两处打印旧键的日志（旧 150 行、旧 188 行）已一并替换，无旧键残留。

**对应测试**：`加载期为每条 watch 记一行 done 模式日志（default/text/regex/off）`——同一个 `apply` 注册四条 watch（省略 / text / regex / null），断言 info 日志里四种 `done=` 各出现一次。

## 5. 删除全局 `doneMarker` 与一切痕迹

**实现**：
- 旧 `index.js:158` 的 `doneMarker: config && …` **整行删除**，`cfg` 只剩 `stableMs`、`message`；
- 旧常量 `DONE_MARKER` 改名 `DEFAULT_DONE_TEXT`，仅作为「省略 done」时的默认文本，不再是全局配置；
- 旧 `index.js:150`、`index.js:188` 两行日志改为打印 `done` 模式；
- 全仓 grep `doneMarker` / `DONE_MARKER` / `2048` / `2 KB` **0 命中**（命令与输出见 §7）。

**关于旧测试**：`index.test.mjs` 原「自定义 doneMarker」用例（旧 284–306 行）已改写为 `done: { text: '<!-- FIN -->' }`，保留两条断言且强度不降：
- `done: { text } 命中即投递，默认标记不再立即投递`（`a.txt` 含 `<!-- FIN -->` 立即投，`b.txt` 含默认 `<!-- DONE -->` 不立即投）；
- `done: { text } 未命中时在静默窗口到期后按 stable 投递`（`calls.length` 由 1 → 2）。
PASS 条数不变（该组仍是 2 条），未删除任何用例。

## 6. §1.5 其余差异项逐条核对

| 卡面项 | 改在哪 | 验证 |
|---|---|---|
| `TAIL_BYTES` 2048 → 4096 | `index.js:12` 写死 `4096` | `命中串落在尾部 4096 字节之外（头部）→ 不立即投递`；`命中串落在尾部 4096 字节内 → 命中` |
| `tailHasDone` 扩三判据、三个调用点全走新逻辑 | `index.js:81-103`；调用点 `index.js:211`、`index.js:215`、`index.js:236` 全部改传 `judge` | 文本 / 正则 / off 四态用例 + 尾部截断用例 |
| 旧 `doneMarker` 入口整行删 | `index.js:258-262` 的 `cfg` 已无该键 | 全仓 grep 0 命中 |
| 两行日志改打印模式 | `index.js:254`、`index.js:300` | 模式日志用例 |

## 7. 正则四条硬约束（§3）与测试

| 约束 | 实现位置 | 测试 |
|---|---|---|
| 只扫尾部 4096 字节，不全文读 | `tailHasDone` 的 `start = Math.max(0, size - TAIL_BYTES)`（`index.js:85-91`） | 头部 4096 之外不命中 / 尾部命中 |
| 固定 `m` 标志编译 | `new RegExp(src, 'm')`（`index.js:71`） | `done: { regex } 带 m 标志：第二行 ^ 命中`（首行非匹配、第二行 `## 章末` 命中） |
| 模式串 ≤ 200 字符、拒绝嵌套量词 | `MAX_REGEX_LENGTH = 200`（`index.js:13`）；`hasNestedQuantifier()`（`index.js:25-46`） | `正则超长 / 编译失败 → …`（201 字符）；`嵌套量词 regex → 拒绝并 warn，不立即投递`（`(a+)+`） |
| 超限 / 编译失败只跳过该 watch，warn，不影响其他 | `normalizeDone` 返回 `mode:'off'` + `error`；`apply()` 第 290–292 行 warn 并继续 `startWatch` | 同上两条 + `被拒正则的 watch 在静默窗口到期后仍按 stable 投递`；正常 watch 同时立即投递 |

嵌套量词判定实测：`(a+)+` / `(x*)*` / `(?:a+)+` / `(a{2,})+` → 拒绝；`(ab)+` / `([+*])+` → 不误判。

## 8. §4 不许碰的验证

- `index.js:152` 原样保留：`source: Object.freeze({ kind: \`plugin:${PLUGIN_NAME}\` })`；`git diff 2a3504b HEAD -- index.js | grep 'source: Object.freeze'` 输出为空（零变动），形状、`Object.freeze`、模板串、单行写法均未改。
- `watches` 数组解析与遍历结构未动：仍是 `Array.isArray(config.watches)` + `watches.forEach((w, i) => …)`，每条 watch 独立 `startWatch`；只在校验通过后多算一次 `done` 与标题。
- `cordis.patch.yml` 零改动（`git diff 2a3504b HEAD -- cordis.patch.yml` 为空）。
- 未重启 DSH；未往 `scripts\dsh\wakeup-inbox` 丢文件；未改目录名/包名；未改 `.gitignore`。

## 9. 测试（完整汇总原文）

命令：`node index.test.mjs`　退出码：`0`

```
PASS  T1 持续写 3 秒不产生任何 followup
PASS  T2a 停止写 5 秒后产生恰好 1 次
PASS  T4 UserMessage 形状（id/role/content/source）
PASS  T2b calls.length 稳定（不重复触发）
PASS  T3 DONE 立即产生 1 次（真实投递耗时 2ms << stableMs=5000ms）
PASS  T5 会话未加载：写日志、不抛、不投递
PASS  T7 两个 watch 同时各丢一个文件：两个目标各收到恰好 1 条，不串、不重复
PASS  T8 一个 watch 目录不存在时，另一个 watch 照常工作
PASS  stableMs 非正数 / 非有限值回退到默认 5000
PASS  自定义 message 模板替换 {file}/{reason}/{size}/{mtimeMs}
PASS  done: { text } 命中即投递，默认标记不再立即投递
PASS  done: { text } 未命中时在静默窗口到期后按 stable 投递
PASS  watches 缺失 / 空 / 非数组 → 写「未启动」warn 且不抛
PASS  dir 非绝对路径、targetSessionId 空或非字符串 → 逐条跳过并点名
PASS  agents.get 抛错 → 写 warn，并经 roots 兜底继续投递
PASS  agents.roots 抛错 → 写 warn、不抛、不投递
PASS  get 返回 undefined 但 roots 中有该 id → 兜底命中并投递
PASS  followup 抛错 → 写 warn 且不向调用方抛
PASS  fs.watch 启动失败 → 写 warn、自行 dispose、不抛
PASS  watcher error 事件 → 写 warn 且不抛
PASS  filename 为 null → listFiles 全扫并投递目录内文件
PASS  空文件（尾部长度 ≤ 0）不误判 DONE，静默到期后按 stable 投递
PASS  尾部读失败（openSync 抛错）→ 不误判 DONE、不立即投递
PASS  目录里的子目录被跳过（!isFile），不投递
PASS  事件后 stat 失败（文件不存在）→ 不投递、不残留 timer
PASS  到期时 stat 失败（文件被删除）→ 不投递、清除 pending
PASS  同一文件第二快照（size 变化）再投递一次
PASS  checkStable 收到过期 state → 早退、不投递
PASS  ctx.effect 注册、dispose 幂等、卸载后不再投递
PASS  命中串落在尾部 4096 字节之外（头部）→ 不立即投递
PASS  静默窗口到期后按 stable 投递
PASS  省略 done → 默认 { text: "<!-- DONE -->" } 命中即提前投递
PASS  省略 done 但无标记 → 不立即投递
PASS  省略 done 但无标记 → 静默窗口到期后按 stable 投递
PASS  done: { regex } 命中即提前投递
PASS  done: { regex } 带 m 标志：第二行 ^ 命中
PASS  done: { regex } 不命中 → 不立即投递
PASS  done: { regex } 不命中 → 静默窗口到期后按 stable 投递
PASS  done: null → 忽略完成标记，不立即投递
PASS  done: null → 静默窗口到期后按 stable 投递
PASS  命中串落在尾部 4096 字节内 → 命中
PASS  正则超长 / 编译失败 → 该 watch 跳过完成规则（有 warn），其他 watch 照常立即投递
PASS  被拒正则的 watch 在静默窗口到期后仍按 stable 投递
PASS  失效 targetSessionId → warn 带 dir 且不抛，其他 watch 照常投递
PASS  加载期为每条 watch 记一行 done 模式日志（default/text/regex/off）
PASS  嵌套量词 regex → 拒绝并 warn，不立即投递
PASS  嵌套量词 regex 被拒后 → 静默窗口到期按 stable 投递
TOTAL: 47/47 PASS
RESULT: PASS
```

改前基线：`31/31 PASS`（实测，非卡面数字）。改后 47 条 = 原 31 条全部保留 + 新增 16 条。原 31 条中有 3 条仅标签变动、断言不变：2 条 doneMarker 用例改写为 `done: { text }`，1 条把「尾部 2048 字节之外」更正为「4096 字节之外」（其喂入数据本来就是 4096 字节）。

## 10. 提交与仓库状态

```
9f8e514 feat: per-watch done rules with four states and load-time session check
2a3504b docs: document the Windows drive-letter form of the file: dependency
54220e8 chore: prepare repository for open-source release
```

`git status --porcelain` 输出为空（工作区干净）。

```
 README.md       |  48 +++++++++--
 README.zh-CN.md |  40 +++++++--
 index.js        | 138 ++++++++++++++++++++++++++++---
 index.test.mjs  | 248 ++++++++++++++++++++++++++++++++++++++++++++++++++++++--
 4 files changed, 442 insertions(+), 32 deletions(-)
```

`git add` 为点名添加：`index.js index.test.mjs README.md README.zh-CN.md`；未用 `-A` / `.`；未改 `.gitignore`；未推送。

## 11. README 同步

`README.md` / `README.zh-CN.md` 均已把「显式完成标记」改为 `done` 四态说明：
- 2 KB → **4 KB**（与 `TAIL_BYTES = 4096` 一致）；
- 增加四态表格与正则约束（`m` 标志、≤200 字符、拒绝嵌套量词、无效只关该条 watch）；
- 安装示例的三条 watch 分别演示 `{ text }` / `{ regex }` / `null`；
- 配置字段表把全局 `doneMarker` 行替换为 `watches[].done`；
- 增加加载期 `targetSessionId` 校验说明；
- 首行互链保持双向（`[中文](README.zh-CN.md)` / `[English](README.md)`）。

## 12. 限制与如实披露

1. **未做 DSH 实机重启加载验证**（卡面禁止重启 DSH）。`sessionTitle` 服务与 `agent.session` 的用法取自本机已装插件的实际形态（`dsh-whale-widget`、`dsh-better-sidebar`），但「加载期标题校验在真实宿主上的告警时机」未实机观察。
2. **标题解析不到会 warn，即使会话存在但尚无标题**：卡面判据是「能解析出会话标题就通过」，实现按此字面执行；新会话若尚未折叠出标题会得到一条 warn，但不影响启动与投递。若判据实际意图是「会话存在即通过」，需要再加一条「agent 存在 → 通过」的短路，属下一轮口径确认项。
3. 测试用的假 ctx 没有 `sessionTitle` 服务、agent 也无 title 字段，因此每个测试 watch 会在加载期多出「无法解析会话标题」warn；不影响任何断言（既有断言均为 `some(...)` 或按特定子串计数）。

<!-- DONE -->
