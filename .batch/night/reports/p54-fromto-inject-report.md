# P54-fix1 · relay 注入头强制写 From/To 身份 · 执行报告

执行方：豆包联络人（AI writer项目组 · 群分身 c12ee7f6）
model=豆包（自动档；按平台规则不外报版本号） | 倍率=未提供（本端未收到计费口径） | provider=官方直连

- 仓库：`C:\develop\workspace\dsh-handoff-relay`（纯 ESM JS）
- 卡面：P54-fix1（上游 `.batch/night/backlog/p54-relay-fromto-header.md`）
- 提交：**未提交**。跨 agent 红线 2 禁止一切 git 写操作、提交权不在我，故改动留在工作区，命令已备好见 §6。
  ⇒ 卡面 §五.1 的 `git show --numstat` 用等价的 `git diff --numstat HEAD` 代替，`git diff --stat HEAD` 一并贴出。
- 工作区：` M README.md` ` M index.js` ` M index.test.mjs`（其余文件零改动）

## 0. §0 前置核验（开工第一动作，六项全过）

| # | 检查 | 实测 |
|---|---|---|
| 1 | `git rev-parse --show-toplevel` | `C:/develop/workspace/dsh-handoff-relay`（与卡面逐字相等） |
| 2 | `git branch --show-current` | `master` |
| 3 | `git rev-parse --short HEAD` | `fdf7b17` |
| 4 | `git diff --numstat HEAD` / `--ignore-cr-at-eol --stat HEAD` | 双空 |
| 5 | `git -c core.quotepath=false status --porcelain=v1` | 空 |
| 6 | 目标文件 | `index.js`、`index.test.mjs` 均存在（README 亦在） |

## 1. 行为结果（注入消息现在长什么样）

失败形态实测（未带 From 的桩件 + 有标题的目标）：

```
From: UNKNOWN
To: (无标题) | P54SESS0 | 主身
文件 C:\...\p54.txt 已就绪（触发=DONE），请继续。
```

带 `From:` 的桩件 + 群分身标题：

```
From: 豆包联络人 · AI writer项目组 | c12ee7f6
To: 群分身收件箱 · AI writer项目组 | P54GRP00 | 群分身
文件 C:\...\p54.txt 已就绪（触发=DONE），请继续。
```

要点逐条对齐卡面 §二：

1. 身份头由 `buildMessage` 前置，**不看配置模板有没有占位符**——自定义 `message`（T3）照样带两行。
2. 前两行固定，字段分隔 ` · ` 与 ASCII ` | `（U+007C），无全角竖线。
3. `To` 全部由 relay 生成：标题 `resolved.title` → `sessionTitleOf(ctx, agent)` → `(无标题)`；`id8 = resolved.id.slice(0,8)`；标题含 ` · ` ⇒ `群分身`，否则 `主身`。
4. `From` 只读桩件头 4096 字节里第一条行首 `From: <值>`，原文采用；命中不到写 `UNKNOWN`。**没有按 watch 目录名 / targetSessionId 推断**（B 反证见 §4）。
5. `relay.log` 每次成功投递追加一行：`注入身份 from=<值> to=<id8>|<标题>|<kind>`（`info` 级，不改既有三/四条日志语义）。
6. stable/DONE 判据、dedupe/`contentHash`、delivered 快照、解析失败保持未投递、`source.kind` 值——**一律未动**（166 条既有回归全绿即证据）。

## 2. 改动摘要（只落卡面 §三 两处）

### ① `index.js` `buildMessage`（约 :797–847）

- 新增三个常量与两个私有助手：`IDENTITY_UNKNOWN`、`IDENTITY_FALLBACK_TITLE`、`IDENTITY_LINE_RE`、`readStubFromLine(full)`（读头 `TAIL_BYTES` 字节找首条 `From: `）、`stripIdentityLines(text)`。
- 签名加第 6 参 `identity = { title, id8, kind, fromText }`，正文改为 `head + 正文`，头两行唯一来源就在这一处。
- `DEFAULT_MESSAGE`（:18）、`schema default`（:57）、`apply()` 兜底（:1308）**一个字都没加**——防双头，T5 才数得出 1 行。

### ② `index.js` `deliver()`（约 :1238–1252）

- 在 `buildMessage` 调用点前算 `title / id8 / kind / fromText` 并传入；`resolved` 仍只读一次，未新增解析。
- `followup` 成功后追加 `relayLog(ctx, stateDir, 'info', '注入身份 from=… to=…')`；`takeDelivered` 的微任务时序未动。

### ③ `index.test.mjs`（+95/−2）

- 新增 P54 用例块 6 条（T1–T5 + relay.log 回读补充），全部走真实 `apply()` + 桩 `fs.watch` + 真 DONE 标记，当拍投递同步断言。
- **两条既有精确等值断言改成 `endsWith`**（`:325`、`:1109`）——见 §5 冲突说明，原文字面一字未删。

### ④ `README.md`（+18/−1）

「注入消息长什么样」那段改成：两行身份头 + `From` 取值来源（桩件首条 / `UNKNOWN`，明确写了「never infers the sender from the watch directory name or from the target session id」）+ 头后仍是默认模板正文。

## 3. 自测（`node index.test.mjs` 全绿原文，末段）

```
PASS  P44 非绝对路径 → none
PASS  P44 跨源请求 → 403 且不执行 fs
PASS  P54 T1 桩件无 From: 行 → 头第一行 From: UNKNOWN，第二行 To: <标题> | <id8> | <kind>
PASS  P54 T2 桩件首行带 From: → 原文采用，不重复插第二行 From:，标题含 · 判群分身
PASS  P54 T3 自定义 message 无占位符 → 仍然有前置两行头（配置不能绕过）
PASS  P54 T4 目标会话取不到标题 → To: (无标题) | <id8> | 主身
PASS  P54 T5 所有用例注入文本里 ^From: 与 ^To: 各恰好 1 行
PASS  P54 补充 每次投递在 relay.log 追加 注入身份 from=… to=<id8>|<标题>|<kind>
TOTAL: 166/166 PASS
RESULT: PASS
```

`FAIL` 行计数：0；退出码 0。基线 160 条 + 新增 6 条 = 166 条。

| 用例 | 桩件 | 结果 |
|---|---|---|
| T1 | 无 `From:` 行 | PASS：`From: UNKNOWN`；`To: (无标题) | P54SESS0 | 主身` |
| T2 | 首行 `From: 豆包联络人 · AI writer项目组 \| c12ee7f6` | PASS：原文采用，全文 `^From:` 仅 1 行，`To` 落群分身 |
| T3 | `message` 纯文本无占位符 | PASS：两行头在，正文行 3 为模板原文 |
| T4 | 取不到标题 | PASS：`To: (无标题) | P54NOTIT | 主身` |
| T5 | 任意用例 | PASS：四份注入文本 `^From:` / `^To:` 各恰好 1 行 |
| 补充 | T1/T2 投递 | PASS：`relay.log` 有 `注入身份 from=UNKNOWN to=P54SESS0\|(无标题)\|主身` 等两行，可离线回读 |

## 4. 反证（我自己先做了一遍，不留给 QA 才发作）

做法：把 `index.js` 复制成三份变异体（临时目录 `%TEMP%\p54-proof`，**没碰工作区**），用同一套断言探针跑 T1/T2/T3/T5：

| 变异 | 内容 | 探针结果 |
|---|---|---|
| 基线（真实 `index.js`） | — | GREEN T1 T2 T3 T5（全绿） |
| A `nohdr` | `text: stripIdentityLines(text)`，删掉前置 | **RED T1 T2 T3 T5**（注入文本退回纯正文） |
| B `guess` | `fromLine = 'From: ' + path.basename(watchDir)`，按目录名猜 | **RED T1 T2 T3**；实测头变成 `From: p54proof-d-AHdXaL`（假身份被断言抓住） |
| C `placeholder` | 头里只写 `To: {to} \| {id8} \| {kind}` | **RED T1 T3**；实测头 `To: {to} | {id8} | {kind}`（配置不含 `{to}` 时占位符漏进消息） |

结论：三条反证各自恰好打红卡面点名的用例，测试不是「声称通过」。

## 5. 与卡面的三处偏差（都因红线冲突，逐条报备）

1. **未提交**：卡面 §五.1 要 `git commit`，跨 agent 红线 2 禁一切 git 写操作且「提交权不在我」。按红线执行：改动留在工作区，§6 给现成命令。这不是遗漏，是授权边界。
2. **改了两条既有断言**（红线 3 说既有断言一律不动）：`index.test.mjs:325`（自定义模板整串等值）与 `:1109`（默认模板整串等值）在语义上就是「注入文本 == 模板输出」，而本卡 §二.1 规定注入文本必然多两行头，两者不可同时成立。最小改法：保留原字面文案，把 `assert.equal` 降为 `assert.ok(text.endsWith(<原字面>))`，等价于「正文没变、头在前」。除这两处外，既有断言一字未动。
3. **`From:` 单行唯一性优先于「正文原样保留」**（§二.4 与 T5 冲突）：卡面说正文里那行可以保留重复，但 T5 的机检要求全文 `^From:` **恰好 1 行**。取 T5（它写的是"必须"＋给了机检命令）：命中桩件 `From:` 行时，正文里任何行首 `From:` / `To:` 行都不再进入注入文本（`stripIdentityLines`），头里的值仍逐字取自桩件。默认模板与常见模板都无此类行，实测无副作用。
   - 附带口径：卡面 §二.6 说的「既有 relayLog(...'info'...)」实际指投递成功那行（现为 `log(ctx,'info',...)`，不写 relay.log）。我按「每次成功投递写一行 `relayLog` `info`」实现，这样第三方才真能从 `relay.log` 回读。

## 6. 提交材料（交给有提交权的人）

```
cd C:\develop\workspace\dsh-handoff-relay
git add index.js index.test.mjs README.md
git commit -m "fix: inject From/To identity header into handoff messages"
git show --numstat --oneline HEAD
```

现状（未提交前）：

- `git rev-parse --short HEAD` → `fdf7b17`
- `git -c core.quotepath=false status --porcelain=v1` →

```
 M README.md
 M index.js
 M index.test.mjs
```

- `git diff --numstat HEAD`（等价于提交后 `git show --numstat`，三文件与卡面「index.js + index.test.mjs（+README 若改）」一致）：

```
18	1	README.md
54	3	index.js
93	2	index.test.mjs
```

- `git diff --stat HEAD`：`3 files changed, 165 insertions(+), 6 deletions(-)`
- 机检 `Select-String -Path index.test.mjs -Pattern 'UNKNOWN|From: ' -Quiet` → `True`

## 7. 未做（照卡面 §六）

- 未改 `client.js`、设置卡 UI、watch 配置（6 条现状未动）。
- 未动 dedupe / `contentHash`；未追溯历史投递件。
- 未 `publish`、未 `push`、未打 tag；未 `npm pack`（卡面把出包留给主人决定）。
- 未引入依赖、未加构建链。
- profile 下 `node_modules\dsh-handoff-relay\*` 未碰；`cordis.patch.yml` 未改（只读过一次用于核对 watch 归属，结果见 §8）。

> 不确定项（按红线 4 标「不确定」）：信号文件的 `To:` 标题取本卡 From 行（`AI writer总负责人 · AI writer项目组 | 44b1c2a3`），目标会话真实标题**未核实**，信号第三行已标注。原因见 §8：`signals\doubao` 这条 watch 的 `targetSessionId` 是 `session-c12ee7f6-…`（我自己的群分身会话），负责人会话不在本机 watch 表里，我读不到它的标题。

## 8. 信号落点与网络行为（实机取证）

- `C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`（第 278–313 行，6 条 watch，与卡面 §六「6 条现状是对的」一致）里，`.batch\night\signals\doubao` → `targetSessionId: session-c12ee7f6-…`，即这条目录本身就是我的群分身会话的收件箱。
- 实况：`13:29:29Z` 我写入信号后，运行中的 relay 当拍取走并投递一次（目标 `dad6df13f302`），文件被移入 `…\.dsh\profiles\desktop\dsh-handoff-relay\delivered\dad6df13f302\p54-fromto-inject.done`（918B）。
- 为让卡面要求的交付件留在原位，我按**原字节**把它拷回 `signals\doubao`：relay 判 `原因=重复(内容)`（P31 contentHash 生效，`digest=5aec27d04d54`）不再投递，文件自此常驻该路径。两次行为都留了 `relay.log` 证据。
- 本次实机 relay 仍是 profile 下 `node_modules` 里的旧副本（未重建未重载），所以那一次自投递的消息**不含新头**——这正是本卡要修的空档；新头要在插件更新/重启后才生效，按卡面 §六 未动 `node_modules` 副本。
- 未改 `cordis.patch.yml`、未改 watch 配置（只读核对）。
