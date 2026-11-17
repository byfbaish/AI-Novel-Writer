# P44 首验报告 · 目录探测改走主进程路由

- 卡号：P44　卡面：`.batch/night/cards/p44-dir-probe.md`（含追加「投递指令」节）
- 派验单：`.batch/night/review-requests/P44.md`（2,162B / `7BD55757465AD9B169CB4015DA763A66`）
- 补正单：`.batch/night/cards/p44-correction-1.md`（1,561B / `F9FB92127FFFD199756A5116046A608A`）
- 判定对象：`8df4e764fd60861dbcbf48e1a7846821bc68aa47`「feat: probe directories via main-process route」（父 `8e4ad642095e9f239038e86468d9dced459361fa`）
- 判定时刻：2026-11-16 21:20（Asia/Shanghai）
- 结论：**通过 9/9**（判据逐条见下；备注三条不拦，一条建议下版收紧）

## 1. 起点与提交　✅

```
git log -1 --format='%H %p'
8df4e764fd60861dbcbf48e1a7846821bc68aa47 8e4ad64
git status --porcelain        → 0 行
git show --numstat HEAD
112	63	client.js
157	0	index.js
106	7	index.test.mjs
git tag | wc -l               → 4（未新增）
git ls-remote origin refs/heads/master → 74f4cc17a5f7d47bafa610255eb40e91d7f5ecd1（未 push）
npm view dsh-handoff-relay version → 0.3.2（未 publish）；package.json version 0.5.0
```

- 恰 1 笔提交，父提交＝卡面起点。
- 补正单 R4 口径：`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 均为空；`core.autocrlf=true`。
- 报告 §5 贴的 porcelain 三行（`.gitignore`/`README.md`/`README.zh-CN.md`）是**执行方 WSL 侧读数**；接收方实测 0 行。三文件 mtime 为 `.gitignore` 11-13 02:01、两份 README 11-14 04:44，均早于本卡提交（21:10:55）⇒ 未发生「为过判据还原文件」。按台账口径记：信号/报告里执行方自报 porcelain 不采，以接收方实测为准。

## 2. 测试全绿　✅

```
node index.test.mjs  → 末行
TOTAL: 156/156 PASS
RESULT: PASS
EXIT=0
```

- 我独立在工作区跑（非读报告）：156/156、exit 0。
- 新增 6 条（卡面要求 5 条 + 路由注册 1 条）：`P44 路由注册`、`合法目录 → ok`、`不存在目录 → missing`、`文件路径 → file`、`非绝对路径 → none`、`跨源请求 → 403 且不执行 fs`（`index.test.mjs:3347-3436`）。

## 3. 同源校验存在，403 不触达 fs　✅

- `index.js:114 export function isTrustedProbeRequest(request, targetCtx = null)`：
  - 优先 `getConnection(targetCtx)` → `conn.requestRejection(request)`（`:116-121`）；
  - 无该能力时回退 loopback（`isLoopback` 认 `localhost`/`::1`/`127.*`/`::ffff:127.*`）+ `sec-fetch-site` 必须 `same-origin|none`（`:122-126`）；
  - 再比 `origin.host === host`（`:127-137`）。
- `index.js:191 if (!isTrustedProbeRequest(request, targetCtx))` → `writeJson(response, 403, { error: 'forbidden' })`（`:192`）并 `return` 在 `probePath` 之前（`:193`）。
- 单测证据（`index.test.mjs:3405-3430`）：`io={stat:…,access:…}` 计数，断言 `res.out.status===403`、`fsTouched===0`、返回 `{kind:'none',reason:'forbidden'}`、body `{error:'forbidden'}`。
- 反证（我做的）：把 `index.js:115` 首行改成 `return true;` → `TOTAL: 155/156 PASS` / `RESULT: FAIL` / EXIT=1，唯一红行 `FAIL  P44 跨源请求 → 403 且不执行 fs :: 跨源必须 403`；还原后 156/156、porcelain 0。

## 4. 只读（无 readdir、无写盘）　✅

`git show 8df4e76 -- index.js` 新增行里 fs 相关仅：

```
const stat = io && io.stat ? io.stat : fs.promises.stat;
const access = io && io.access ? io.access : fs.promises.access;
await access(absolute, fs.constants.R_OK);
```

- `probePath`（`:156-179`）只 `stat` + `access(R_OK)`，按 `isDirectory()` 分 ok/file，按错误码分 missing/denied/none。
- `handleProbeRequest`（`:190-207`）只写 HTTP 响应（`writeJson`），无落盘。
- `index.js` 本卡 numstat `157 0`（纯增无删），文件别处的 `readdirSync`/`writeFileSync` 均为既有逻辑、不在本次 diff。

## 5. 渲染层换源　✅

- `client.js` HEAD：`Select-String -Pattern 'remoteAccess|workspaceFilesOf'` → **0 命中**（旧 `workspaceFilesOf`/`firstSessionId`/依赖 `ctx.get("remoteAccess")+files.list` 的 `probeDirectory` 已删）。
- 新实现 `client.js:196-226`：`origin = window.location.origin`（`:196`）→ `new URL("/handoff-relay/probe", origin)`（`:203`）→ `fetch(url, {method:"GET", credentials:"same-origin", cache:"no-store", signal})`（`:215-219`）。
- 未使用 `__DSH_TRANSPORT__.streamBaseUrl`：全文 0 命中。
- 降级：`origin` 空/`"null"`/无 `fetch` → `{kind:"none"}`（`:200`）；URL 构造失败 → `none`（`:206`）；响应非 2xx / json 失败 / catch → `none`（`:221-223`）。

## 6. 三色 + 每态中文，网络失败不落绿　✅

- `dirFrameStyle`（`:229-236`）：`ok` → 绿 `#2e7d32`；`bad|missing|denied|file` → 红 `#d33`；`checking|none` → 灰 `#9e9e9e`；其余 `{}`（idle）。
- `dirStatusTitle`/`dirStatusText`（`:238-258`）：`ok 目录可读`、`missing 目录不存在`、`denied 无读取权限`、`file 这是文件，不是目录`、`none 宿主未提供目录核验`、`bad 目录不可读或不存在`、`checking 检查中…`；空目录走 idle、不标色不出字（`:267-272`）。
- 网络失败路径收敛到 `none`（`:223 catch`）⇒ 灰，**不会落绿**。

## 7. 非 ok 保存给红字、不阻止保存　✅

- `client.js:493 setSaveWarn(rows.map((_, i) => (probeKinds[i] || "none") !== "ok"));` 在 `save()` 开头，随后仍走 `validateSettingsRow` 与写回（`:494` 起），无因 saveWarn 提前 return。
- 行内红字：`:317 props.saveWarn ? … "目录当前不可读，保存后需确认"`（`color:#d33`）。
- `reset`/`addRow`/`removeRow`/改 dir 均清 warn。

## 8. 禁改区未动　✅

`git diff --name-only 8e4ad64 8df4e76` → `client.js`、`index.js`、`index.test.mjs` 三个文件；`package.json`、`README.md`、`README.zh-CN.md`、`cordis.patch.yml` 均不在 diff。

## 9. 报告在盘　✅

`.batch/night/staging/p44-dir-probe-report.md` 4,637B / 96 行 / MD5 `4C292238089FE1646FFD3A069EAFB7AA` / mtime 21:11:50 / 末行 `<!-- DONE -->`；含提交 SHA（:1）、`git show --numstat` 原文（:70-76）、测试输出末 10 行（:53-64）。

## 备注（不拦，记录待下版/真机）

1. **颜色无单测咬住**：P29 那两条只断言 `title` 文案，未断言 `borderColor`；三色靠代码复核，真机看一眼。同 P39 备注③。
2. **`save()` 早存会误报**：`probeKinds` 默认缺省 `"none"`，用户若在 350ms debounce 未完成前就点保存，每行都会出「目录当前不可读，保存后需确认」。纯提示、不拦保存，属观感问题。
3. **`probeReason` 兜底文案**：只识别 ENOENT/EACCES/EPERM，其余（ELOOP、ENAMETOOLONG 等）归 `none`，界面显示「宿主未提供目录核验」——语义不准但无害。
4. **建议下版收紧（不属本卡缺陷）**：当宿主无 `connection.requestRejection` 时，回退分支对本机「无 `origin`、无 `sec-fetch-site`」的请求直接放行（`index.js:138 return true;`）⇒ 本机任意进程可用 curl 探测任意绝对路径的**存在性/类型**（只读、非列举）。只在本机、信息量低；若要收紧可要求 `sec-fetch-site` 必须存在且为 `same-origin|none`。

## QA 未做

- 未跑全量 `pnpm` 套件（派验单禁止）；未改卡/码；未判真机观感（框沿染色、不存在目录被拦）——归真机轮。
