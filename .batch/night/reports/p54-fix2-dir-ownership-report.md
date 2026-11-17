执行方：豆包
model=DeepSeek-V4.1-Flash | 倍率=0.01x | provider=自有(豆包)

# P54-fix2 · From 目录归属 + 冲突上报 + 审计字段 · 执行报告

- 仓库：`C:\develop\workspace\dsh-handoff-relay`（纯 ESM JS）
- 卡面：`.batch/night/cards/p54-fix2-dir-ownership.md`；派验单：`.batch/night/review-requests/p54-fix2-dir-ownership.md`
- 判据件：`.batch/night/staging/handoff-usage-criteria-v4.md`｜实测 10,418B / `540FFF21AAF8C2DEBA6CA5B6EEC07B69`（与卡面逐字一致）
- 提交：**未提交**。跨 agent 红线 2 禁止一切 git 写操作、提交权不在我，故改动留在工作区，命令备好见 §6。P54-fix1 同一口径。

## 0. §0 前置核验（开工第一动作，六项全过，原样抄录）

```
$ git rev-parse --show-toplevel
C:/develop/workspace/dsh-handoff-relay
$ git branch --show-current
master
$ git rev-parse --short HEAD
40f34b5
$ git diff --numstat HEAD
（空）
$ git diff --ignore-cr-at-eol --stat HEAD
（空）
$ git -c core.quotepath=false status --porcelain=v1
（空）
$ git ls-files index.js index.test.mjs
index.js
index.test.mjs
```

基线套件开工前先复跑一次：`166/166 PASS`（36s），确认没带红入场。

## 1. 行为结果（同一份 index.js 实跑输出）

```
--- case1 只有 fromRole ---
From: 豆包联络人 · AI writer项目组 | c12ee7f6
To: (无标题) | DEMOSESS | 主身
--- case2 正文 From 与 fromRole 冲突 ---
From: 大肥鱼 · AI writer项目组 | a1d48adb
To: (无标题) | DEMOSESS | 主身
--- case3 两者都没有 ---
From: UNKNOWN
To: (无标题) | DEMOSESS | 主身
--- relay.log 身份冲突行 ---
2026-11-15T06:41:29.184Z WARN 身份冲突 relName=demo.txt stub=大肥鱼 · AI writer项目组 | a1d48adb watch=豆包联络人 · AI writer项目组 | c12ee7f6
--- dedupe 条目（case1） ---
{
  "size": 16,
  "mtimeMs": 1794724889168.2368,
  "contentHash": "2bda5f183b7db92d16bcdd7264ecfa801286bb81b548e597eebb7855485aa9f5",
  "at": "2026-11-15T06:41:29.174Z",
  "watchDir": "C:\\Users\\<用户名>\\AppData\\Local\\Temp\\p54f2-demo-watch-yUP0H5",
  "targetSessionId": "DEMOSESS01",
  "fileHash": "2bda5f183b7d",
  "injectedHeader": "From: 豆包联络人 · AI writer项目组 | c12ee7f6\nTo: (无标题) | DEMOSESS | 主身"
}
```

逐条对齐卡面 §2：

1. `fromRole` 可选；不写 ⇒ 条目形状、注入文本与 P54 逐字一致（case3）。
2. 优先级 正文首条 `From:` ＞ `fromRole` ＞ `UNKNOWN`（case1/case2/case3 三态齐）。
3. 冲突时注入正文值（case2 头为 `大肥鱼…a1d48adb`），日志追加一行 `身份冲突 relName=… stub=… watch=…`，条目带 `fromConflict`（T3 断言 `=== true`；相等/无冲突时不写该字段，T1/T2/T4 断言 `undefined`）。
4. 审计四字段：`watchDir` 存 `path.resolve(watchDir)`；`targetSessionId` 存本次 `resolved.id`；`fileHash` 存该文件字节 sha256 **前 12 位**（与日志 digest 同源同口径，上例 `2bda5f183b7d` = `contentHash` 前 12 位）；`injectedHeader` 存注入的两行头原文（不含尾换行，与注入文本前两行逐字相等）。
5. 剥离未变：`stripIdentityLines` 逐行过滤 `^(From|To): .+$`，注入文本里 `^From:`/`^To:` 各恰好 1 行（T2 计数断言 + P54 T5 既有断言双证）。
6. 判重键/窗口/判决语义未动：`contentHash` 仍是完整 64 位 sha256，`DEDUPE_WINDOW_MS` 未改，`dedupeVerdict` 四分支一字未动（§5 有证据）。

## 2. 代码位置与 `fromRole` 传递路径（C2）

| 环节 | 位置 |
|---|---|
| 配置 schema 新字段 | `index.js:55` `fromRole: z.string().default('')`（写进 schema 才不会被宿主解析时丢掉） |
| 读配置 + 归一 | `index.js:1497–1504`（`apply()` 内）：字符串 ⇒ `trim()` 后使用（空串/纯空白 = 没写，**不告警**）；不是字符串的值才 `log`+`relayLog` warn 并按缺省处理，**不跳过整条 watch** |
| 传参 | `index.js:1521` `startWatch(..., stateDir, fromRole)`；签名 `index.js:1191` 末参 `fromRole = ''` |
| 优先级判定 | `index.js:851` `resolveFromText(stubFrom, watchFrom)`：`stub \|\| watch \|\| UNKNOWN`；`conflict = stub && watch && stub !== watch` |
| 取值调用点 | `index.js:1292–1294`（`deliver()` 内）：`readStubFromLine(full)` → 去掉 `From: ` 前缀 → 与 `fromRole` 一起判 |
| 头文本单一来源 | `index.js:866` `buildIdentityHead(identity)`；注入用 `buildMessage` 内同一函数（`index.js:875` 起） |
| 审计字段落盘 | `index.js:430` `rememberDeliveredSnapshot(..., meta)`，字段写在 `index.js:444–449` |
| 冲突日志 | `index.js:1317` `relayLog(..., 'warn', '身份冲突 relName=… stub=… watch=…')`，紧跟投递成功那行之后 |

`fromRole` 全链路：`cordis.patch.yml`（或设置卡回写的 `watches[]`）→ `apply()` 读 `w.watches[i].fromRole` → 归一为 `fromRole` 字符串 → `startWatch(...)` 闭包持有 → `deliver()` 与正文值比 → `resolveFromText` → `identity.fromText` → `buildIdentityHead` → 注入消息第 1 行 + 条目 `injectedHeader`。

## 3. 用例（`node index.test.mjs`，实测全 PASS）

| 用例 | 桩件 | 实测 |
|---|---|---|
| T1 | 只给 `fromRole`、正文无 `From:` | PASS：`From: 豆包联络人 · AI writer项目组 \| c12ee7f6`；`身份冲突` 0 行；条目无 `fromConflict` |
| T2 | 正文 `From:` 与 `fromRole` 相等 | PASS：注入一次（全文 `From: ` 计数 = 1）；冲突 0 行；无 `fromConflict` |
| T3 | 正文 `From:`（大肥鱼）≠ `fromRole`（豆包） | PASS：注入正文值 + 恰 1 行 `身份冲突 relName=p54f2-t3.txt stub=… watch=…` + `fromConflict: true` |
| T4 | 两者都没有 | PASS：`From: UNKNOWN`，无 `fromConflict` |
| T5 | 一条正常投递 | PASS：四字段齐，`watchDir` = 该 watch 绝对路径、`targetSessionId` = 本次目标、`fileHash` = 文件 sha256 前 12 位、`injectedHeader` = 注入前两行；`contentHash` 仍 64 位 |
| T6 | 磁盘上播一条 P54 时代旧条目（只有 `size/mtimeMs/at`） | PASS：全新模块实例加载不报错（无「坏档」warn）、旧条目原样保留、仍参与启动判重（旧文件被跳过，只投新文件）、同一次落盘的新条目带审计字段 |
| 补充 1 | `fromRole: 123` 与 `fromRole: '   '` | PASS：非字符串只 warn（`fromRole 无效`）并按缺省；纯空白串**静默**按缺省（不刷 warn）；两种情况 watch 都照常投递、`From: UNKNOWN` |
| 补充 2 | `fromRole` 经 `replaceWatchesInYml` 写回再 `parseWatchesFromYml` 读回 | PASS：字段保住（不这么做，设置卡保存会静默吞掉 `fromRole`） |

套件总数：**174/174 PASS**，`RESULT: PASS`，exit 0，37s。P54 基线 166 条一条未删（新增 8 条 = 6 + 2 补充）。

## 4. 反证（我自己先做，不留给 QA 才发作）

做法：把仓库 8 个顶层文件整体复制到 `%TEMP%\p54fix2-proof\{base,A,B}`（**没碰工作区**），只对 A/B 的 `index.js` 改一行 `resolveFromText`，各跑整套：

| 变异 | 改动 | 套件结果 |
|---|---|---|
| base | 不改（对照） | `TOTAL: 174/174 PASS` / `RESULT: PASS` |
| A `no-priority` | `const fromText = stub \|\| watch \|\| UNKNOWN;` → `const fromText = stub \|\| UNKNOWN;`（删掉 `fromRole` 优先级） | `173/174` / `RESULT: FAIL`，唯一红行：`FAIL  P54-fix2 T1 … :: From 应取 fromRole："From: UNKNOWN"` |
| B `dir-wins` | 改成 `const fromText = watch \|\| stub \|\| UNKNOWN;`（冲突时改取目录值） | `173/174` / `RESULT: FAIL`，唯一红行：`FAIL  P54-fix2 T3 … :: 冲突时注入仍用正文值` |

两次各只打红一张，且没有连带红其他用例——说明断言咬在点上，不是「声称通过」。

## 5. 不变量核对（卡面 §2.6）

- `contentHash` 判重键：仍是完整 sha256；`rememberDeliveredSnapshot` 的 `contentHash` 取值逻辑未改（新增 `fileHash` 只是它的前 12 位副本，单独存一列）。
- 30 秒窗口：`DEDUPE_WINDOW_MS` 与 `dedupeVerdict` 的 `legacyHit` 判定一字未动。
- `dedupeVerdict` 语义：P31 a–f 与 TC1–TC4 共 10 条既有回归本轮全绿。
- 旧条目兼容：`loadDedupeRegistry` 的校验条件仍是 `size/mtimeMs/at` 三项，新字段多与少都不影响加载（T6 证据）。

## 6. 提交材料（交给有提交权的人）

```
cd C:\develop\workspace\dsh-handoff-relay
git add index.js index.test.mjs README.md
git commit -m "fix: label relay From by watch directory and log identity conflicts"
```

现状（未提交）：

```
$ git rev-parse --short HEAD
40f34b5
$ git -c core.quotepath=false status --porcelain=v1
 M README.md
 M index.js
 M index.test.mjs
$ git diff --numstat HEAD
34      3       README.md
95      17      index.js
195     0       index.test.mjs
$ git diff --stat HEAD
 3 files changed, 324 insertions(+), 20 deletions(-)
```

改动面只在点名的三文件：`package.json`、`client.js`、`cordis.patch.yml` 均不在 diff（`git diff --name-only HEAD` 无命中）。无 push / tag / publish / npm install / 依赖或构建链改动。

README 改了什么：`fromRole` 字段说明（含「目录归属标签、不是身份证明」）、固定优先级与冲突行为、`dedupe.json` 审计四字段与旧条目兼容、设置卡不留 `fromRole` 行但保存时保留该字段。

## 7. 禁改区核对 / 未做

- 未改 `client.js`、`package.json`、`cordis.patch.yml`，未碰任何 watch 配置实例（6 条现状未动）。
- 落点事实：`C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\dsh-handoff-relay` 是**指向本仓库的 junction**（`LinkType=Junction`，`index.js` SHA256 两边一致 `E9F56982…`），所以「插件目录」和仓库是同一份文件，本次改动在磁盘上已对宿主可见；但宿主进程是 `06:20:56Z` 启动的（早于改动），内存里仍是旧码 —— 新行为要等宿主重启才生效。
- 未动 `.batch/` 下除本报告与信号以外的任何文件。
- 未追溯历史投递件，未清 `delivered\` 存量。

## 8. 不确定项（按红线 4 标口径）

- **不确定**：新行为没有经过宿主实机投递验证。宿主进程启动早于本次改动，内存里仍是 P54 代码；行为证据全部来自 `apply()` 直调 + 真实临时目录 + 真实静默窗口。实机侧只观察到「旧码照常工作」：信号写入后被当拍取走并投递（`relay.log` `06:42:53Z` `注入身份 from=豆包联络人 · AI writer项目组 | c12ee7f6`），按 P54 口径原字节放回后被内容判重挡住（`06:43:14Z` `去重跳过 target=dad6df13f302 file=p54-fix2-dir-ownership.done digest=17effd1c4baa 原因=重复(内容)`）；改完报告后信号内容更正、被再投一次，同样以原字节放回、同样被挡（`06:48:22Z` `… digest=94c98343229d 原因=重复(内容)`），交付件现常驻 `signals\doubao`（956B，sha256 `94C98343…`）。新码要等宿主重启才在线，重启时机按卡面 §3 由负责人决定。
- **自证修正（写这份报告时自己抓到的）**：`Config` schema 给 `fromRole` 的默认值是空串，最初实现把「空串」当成非法值处理，宿主按 schema 解析后每条 watch 都会刷一行 `fromRole 无效`。已改成「字符串一律 `trim()` 使用、空白串等同没写、只有非字符串才 warn」，并把该口径写进补充 1 用例（`'   '` 不得产生 warn）。修后套件 174/174 与反证 A/B 结论不变。
- **偏差 1（授权边界，非遗漏）**：卡面 §4.1 要求一次提交，红线 2 禁止一切 git 写操作且提交权不在我 —— 按红线执行，§6 给现成命令。P54-fix1 同此处理并被终审通过。
- **偏差 2（超出字面但必要）**：除注入链路外，另改了 `buildConfigSchema`（`index.js:55`）与 yml 解析/序列化（`index.js:959–962`、`index.js:1031`）。原因：宿主按 `Config` 解析配置时若无该字段会丢掉 `fromRole`（新功能在生产里等于不存在）；设置卡保存走 `serializeWatchesBlock` 回写 yml，若不认该字段会把用户手写的 `fromRole` 静默删掉（属静默数据丢失）。两处都只增不删，既有行为不变（补充 2 有往返用例）。
- **口径说明（消除歧义）**：`fileHash` 取 12 位而非 64 位，依据派验单 C4「必须等于该文件 sha256 前 12 位口径」；完整摘要仍在 `contentHash`，判重不依赖 `fileHash`。`injectedHeader` 存两行、不带尾换行，与注入文本前两行逐字相等。
- 红线 4 之「没读到」：本次读取文件内未找到 `.batch/night/review-requests/p54-fix2-dir-ownership.md` 以外的 QA 首验单（按 C10 由 QA 另存 `.vN`，不在我的写盘范围）。

<!-- DONE -->
