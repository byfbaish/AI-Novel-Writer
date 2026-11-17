执行方：豆包
model=DeepSeek-V4.1-Flash | 倍率=0.01x | provider=自有(豆包)

# P54-fix3 · To 行身份段修复（D-TO8 ＋ To 标题段为空）· 执行报告

- 仓库：`C:\develop\workspace\dsh-handoff-relay`（纯 ESM JS），分支 `master`
- 卡面：`.batch/night/cards/p54-fix3-to8.md`（v2）
- 起点：`f41b0312d89a50493943706b488b8773aaaa0eec`（short `f41b031`）
- 提交：`51a87c5417c61372210c14c1c362b8830e1621e7`（short `51a87c5`）
- 提交信息：`fix: strip session- prefix from To id8 and keep To title segment non-empty`，正文两段分别写 D-TO8 与空标题
- 提交面：`index.js 25/2`、`index.test.mjs 84/0`（未动 `README.md`，故不在 numstat 里）

## 0. §0 三项校验（开工第一动作，命令与输出原样抄录）

```powershell
git -C C:\develop\workspace\dsh-handoff-relay rev-parse HEAD
```

```
=== 1) rev-parse HEAD ===
f41b0312d89a50493943706b488b8773aaaa0eec
```

```powershell
Get-ChildItem -LiteralPath 'C:\develop\workspace\dsh-handoff-relay' -File |
  Where-Object { $_.Name -in @('index.js','index.test.mjs') } | Select-Object Name,Length
```

```
=== 2) 目标文件 ===
Name           Length
index.js        73179
index.test.mjs 177031
```

```powershell
git diff --numstat HEAD
git diff --ignore-cr-at-eol --stat HEAD
git diff --cached --numstat
```

```
=== 3a) diff --numstat HEAD ===
=== 3b) diff --ignore-cr-at-eol --stat HEAD ===
=== 3c) diff --cached --numstat ===
```

三项全过：HEAD 逐字等于 `f41b0312d89a50493943706b488b8773aaaa0eec`；`index.js`、`index.test.mjs` 都在仓根（长度是**开工时**的，改动后为 74,243 / 182,078）；三条 diff 命令均无输出。按卡面要求**未**拿 `git status --porcelain` 作准。

## 1. 改了什么（只本卡 §1 两条）

| 缺陷 | 落点 | 做法 |
|---|---|---|
| D-TO8：`To:` 第二段恒输出字面 `session-` | `index.js:819` `SESSION_ID_PREFIX = 'session-'`；`:821` `id8Of(id)`；调用点 `:1313` `const id8 = id8Of(resolved.id)` | 先剥 `session-` 前缀再取前 8 位；**没有该前缀时保持原行为**（仍取前 8 位），测试桩/旧式 id 不受影响 |
| To 标题段为空 | `index.js:832` `headerTitleOf(...candidates)`；调用点 `:1312` `const title = headerTitleOf(resolved.title, sessionTitleOf(ctx, agent))` | 依次取第一个 `trim()` 后非空的候选，全空落 `IDENTITY_FALLBACK_TITLE`（`(无标题)`）；把占位收口到头文本的唯一取值点，防后续新增取值分支写出 `To:  | …` |

`From` 注入链路一字未动（`readStubFromLine`、`resolveFromText`、`fromRole` 优先级、冲突日志、`fromConflict` 全保持 P54-fix2 形态），P54-fix2 的 T1–T6 ＋ 补充 2 条本轮仍全 PASS。`contentHash` / `DEDUPE_WINDOW_MS` / `dedupeVerdict` 未碰。

## 2. §2 五条判据 · 实测输出

### 2.1 单测全绿、新增用例 ≥ 2

```
exit=0
PASS  P54-fix3 T1 真实 id `session-8ea61110-…` → To 第二段为 8ea61110（不再输出字面 session-）
PASS  P54-fix3 T2 目标会话无标题 → To 标题段落 (无标题) 占位，不留空段
PASS  P54-fix3 T3 真实 id + 非群标题 → To 第二段 44b1c2a3、kind 主身，机检正则通过
PASS  P54-fix3 T4 无 session- 前缀的 id → 保持原行为（取前 8 位）
TOTAL: 178/178 PASS
RESULT: PASS
```

新增 **4 条**（卡面要求 ≥ 2：D-TO8 一例、空标题一例，实际按 D-TO8 拆了群分身/主身两种 kind 各一例，另加「无前缀保持原行为」一例）。基线 174 条一条未删、未改断言：`index.test.mjs` 本轮 **84 行新增 / 0 行删除**。

### 2.2 反证两条，须真红

做法：把仓库顶层 9 个文件（含 `client.js`）整体复制到 `%TEMP%\p54fix3-proof\{base,A,B}`，只改 A/B 的 `index.js`，各跑整套。**没碰工作区**。

| 变异 | 改动 | 套件结果 |
|---|---|---|
| base | 不改（对照） | `TOTAL: 178/178 PASS` / `RESULT: PASS` |
| A（仍按 `slice(0,8)` 取 id） | `id8Of` 里 `const body = raw.startsWith(SESSION_ID_PREFIX) ? raw.slice(...) : raw;` → `const body = raw;`（等价于修复前行为） | `TOTAL: 175/178 PASS` / `RESULT: FAIL`，红 3 条：T1、T2、T3 |
| B（标题为空仍输出空段） | 三层标题兜底全去掉：`resolveNow` 两处 `title: sessionTitleOf(ctx, agent) || '(无标题)'` → 去掉 `|| '(无标题)'`；`deliver()` 的 `headerTitleOf(...)` → `resolved.title || sessionTitleOf(ctx, agent) || ''`；`buildIdentityHead` 的 `String(id.title || '') || IDENTITY_FALLBACK_TITLE` → `String(id.title || '')` | `TOTAL: 174/178 PASS` / `RESULT: FAIL`，红 4 条：P54 T1、P54 T4、P54 补充、P54-fix3 T2 |

A 的三条红行原文（`session-` 回来了）：

```
FAIL  P54-fix3 T1 … :: To 不符："To: 豆包联络人 · AI writer项目组 | session- | 群分身"
FAIL  P54-fix3 T2 … :: To 不符："To: (无标题) | session- | 主身"
FAIL  P54-fix3 T3 … :: To 不符："To: 大肥鱼 | session- | 主身"
```

B 里空标题用例的红行原文（空段形态成立）：

```
FAIL  P54-fix3 T2 目标会话无标题 → To 标题段落 (无标题) 占位，不留空段 :: To 不符："To:  | abcdef12 | 主身"
FAIL  P54 T4 目标会话取不到标题 → To: (无标题) | <id8> | 主身 :: To 应落 (无标题) 兜底："To:  | P54NOTIT | 主身"
```

B 的第一次跑只红了「P54 补充（relay.log 注入身份行）」，原因是 `buildIdentityHead` 还有第三层 `|| IDENTITY_FALLBACK_TITLE` 兜住了头文本；补掉这一层后 T2 才红 —— 这一步本身说明占位有三层，见 §3。

改回即绿：base 与提交后工作区各跑一次都是 178/178。

### 2.3 机检样例（真实 id 构造，正则逐条过）

判据正则 `^To: +\S.* \| [0-9a-f]{8} \| (主身|群分身)$`，三个实测 `To:` 行原文：

```
To: 豆包联络人 · AI writer项目组 | 8ea61110 | 群分身      ← id session-8ea61110-4a2b-4c3d-9e8f-0123456789ab
To: (无标题) | abcdef12 | 主身                          ← id session-abcdef12-1111-2222-3333-444455556666（无标题）
To: 大肥鱼 | 44b1c2a3 | 主身                             ← id session-44b1c2a3-7777-8888-9999-aaaabbbbcccc
```

三条都由用例里同一条正则断言，且 T1 另加了 `!line.includes('session-')` 与 `relay.log` 里 `注入身份 … to=8ea61110|…` 的日志口径断言。

### 2.4 提交后 numstat 与双空

```
$ git diff --numstat f41b031..HEAD
25	2	index.js
84	0	index.test.mjs
$ git -c core.quotepath=false status --porcelain=v1
（空）
$ git diff --numstat HEAD
（空）
$ git diff --ignore-cr-at-eol --stat HEAD
（空）
$ git diff --cached --numstat
（空）
$ git rev-parse HEAD
51a87c5417c61372210c14c1c362b8830e1621e7
```

`f41b031` 是 `51a87c5` 的父提交（起点链未断）。

### 2.5 禁改区

`client.js`、`package.json`、`cordis.patch.yml`、`docs/` 均不在提交面（`git diff --name-only f41b031..HEAD` 只有 `index.js`、`index.test.mjs`）。未 push、未打 tag、未改 origin；未动 `~/.dsh/**` 与 P54/P54-fix2 的已交付件。

## 3. 现场取证与一处必须说清的事实

**D-TO8 是真缺陷，有现场实证**。`C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\relay.log` 里 `注入身份` 行近期 11 条，第二段全部是字面 `session-`，例如：

```
2026-11-15T06:42:53.976Z INFO 注入身份 from=豆包联络人 · AI writer项目组 | c12ee7f6 to=session-|豆包联络人 · AI writer项目组|群分身
2026-11-15T07:46:55.965Z INFO 注入身份 from=QA · AI writer项目组 | 1586edd1 to=session-|大肥鱼|主身
2026-11-15T08:10:31.584Z INFO 注入身份 from=产品经理 · AI writer项目组 | 090e6e7d to=session-|大肥鱼|主身
```

**「标题段为空」这一条，我未能取到现场实证 —— 不确定，按判据要求标出。** 在上面的 `relay.log` 里，我按 `to=[^\r\n]*\|\|` 检索（双竖线＝标题段为空）**本次读取的文件内未找到**任何一条，11 条 `注入身份` 行的标题段全部有内容（`Chief` / `大肥鱼` / `豆包联络人 · AI writer项目组`）。代码侧也印证：标题占位有**三层**兜底 —— `resolveNow` 的 id 分支（`index.js:1252`）与 id 兜底分支（`:1259`）各写一次 `sessionTitleOf(ctx, agent) || '(无标题)'`，`buildIdentityHead`（`:891`）再兜一次，`deliver()` 原来还有第四道 `||`。所以按现有代码，空段理论上不可达；卡面所说的两次实证，我复现不出（可能是别的注入通道或旧版运行实例留下的形态）。

因此这一条我按「**把保证收口 + 用例钉死**」交付，不改口说成「修掉了现场缺陷」：

- 代码：占位统一由 `headerTitleOf` 在头文本唯一取值点兜底（`index.js:1312`），三层兜底保留不动；
- 用例：`P54-fix3 T2` 用「目标会话无标题」构造，断言 `To:` 标题段是 `(无标题)` 而不是空段，且过机检正则；
- 反证 B 证明：只要有人把兜底拆掉，这条用例立刻红在被禁形态 `To:  | …` 上（见 §2.2 红行原文）。

## 4. 不确定项 / 偏差

- **不确定**：卡面「两次实证 `to=session-|大肥鱼|主身`、`to=session-|豆包联络人 · AI writer项目组|群分身` 标题段空」的读法与我取到的日志不一致（这两行按 `|` 切分的第二段是 id8，第三段才是标题，而标题段都非空）。我按「缺陷形态以少见的空段为准」修，未把卡面这两行当成空段的证据。
- **不确定**：新行为未在宿主实机生效。宿主 profile 下 `node_modules\dsh-handoff-relay` 是指向本仓库的 Junction，磁盘上已是新码，但宿主进程启动早于改动，内存仍是旧码；重启时机按卡面由负责人决定。
- **偏差（红线 2 与本卡冲突，按上单裁定处理）**：本卡开头又注入了「禁止任何 git 写操作」，而卡面 §0/§2.4/§4 明确要求提交（「类型：A 改码（须提交）」）。按负责人 15:02 对同一冲突的裁定（「『禁止 git 写操作』属过度自限，本单提交权成立」），本单执行了本地提交 `51a87c5`，未 push / tag / publish。若裁定口径有变，请按 §2.4 的证据直接回退该提交。
- 只改了本卡 §1 两条；未发现第三个缺陷需要停手（`To` 的 `kind` 判定、`From` 链路、判重键均核对过，行为未变）。

<!-- DONE -->
