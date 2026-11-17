起点 HEAD：8e4ad642095e9f239038e86468d9dced459361fa · 提交 SHA：8df4e764fd60861dbcbf48e1a7846821bc68aa47

# P44 · 目录探测改走主进程路由

## 1. 主进程路由 `index.js`

- exact 路由常量：`index.js:33`，路径 `'/handoff-relay/probe'`。
- 同源校验：`index.js:114` `isTrustedProbeRequest`。优先走宿主 `connection.requestRejection`；没有 connection 时回退到 `socket.remoteAddress` loopback + `sec-fetch-site`（`same-origin` / `none`）+ `origin` 与 `host` 同源。
- handler：`index.js:190` `handleProbeRequest`。跨源先 `403` 并直接返回，不进入 `fs`；非 `GET` 返回 `405`。
- 注册：`index.js:209` `registerProbeRoute`，`ctx.inject(['webServer'], wctx => wctx.effect(mount))`；注册 `kind: 'exact'`、`path: PROBE_ROUTE_PATH`（`index.js:224`）。
- 调用点在 `apply` 的 `watches.length === 0` 早退之前：`index.js:1282`，空 watches 也注册路由。
- 探测：`index.js:156` `probePath`，只 `fs.promises.stat` + `fs.promises.access(R_OK)`；不写文件、不 `readdir`、不读文件内容。
- 返回结构：`{ kind, absolute, reason }`。`reason` 短码：`readable` / `not-found` / `access-denied` / `is-file` / `invalid-path` / `stat-error`。入参空、含 NUL、非绝对路径 → `none` + `invalid-path`。

## 2. 渲染层 `client.js`

- `probeDirectory`：`client.js:191`。已删除 `ctx.get("remoteAccess")`、`workspaceFilesOf`、`firstSessionId` 与旧 `dirProbeCache`。
- 请求：同源 `fetch(new URL("/handoff-relay/probe", window.location.origin) + ?path=encodeURIComponent(dir))`，`client.js:203`；未使用宿主 transport 的跨源基址。
- 输入变化 debounce 350ms：`client.js:174` `DIR_PROBE_DEBOUNCE_MS`；请求在途 `checking`；`AbortController` 超时 3000ms 后中断。
- 网络失败 / 非 2xx / JSON 解析失败 / 超时 → `none`，中性灰 +「宿主未提供目录核验」，不渲染绿。
- 路由结果映射：`client.js:185` `probeKindOf` 只接受 `ok` / `missing` / `denied` / `file` / 旧 `bad`，其余归 `none`。
- 三色：`client.js:229` `dirFrameStyle`——`ok` 绿 `#2e7d32`；`missing` / `denied` / `file` 红 `#d33`；`checking` / `none` 灰 `#9e9e9e`。
- 框沿下方文字：`client.js:249` `dirStatusText`——`ok`「目录可读」、`missing`「目录不存在」、`denied`「无读取权限」、`file`「这是文件，不是目录」、`none`「宿主未提供目录核验」、`checking`「检查中…」。
- `title` 仍保留（`client.js:307` 挂到 input），旧的 `bad` title/文案保留兼容，不影响新五态。
- 保存补洞：`client.js:493` 保存时按 `probeKinds` 计算非 `ok` 行，`setSaveWarn`；红字「目录当前不可读，保存后需确认」在 `client.js:317`。保存按钮不因此禁用，`validateSettingsRow`（`client.js:347`）未改成同步校验。

## 3. 测试

实际命令：

```text
node --check index.js
node --check client.js
node --check index.test.mjs
node index.test.mjs
```

新增 6 条 P44 用例，覆盖卡面 5 条并多一条路由注册：

```text
PASS  P44 路由注册：exact GET /handoff-relay/probe（空 watches 也注册）
PASS  P44 合法目录 → ok
PASS  P44 不存在目录 → missing
PASS  P44 文件路径 → file
PASS  P44 非绝对路径 → none
PASS  P44 跨源请求 → 403 且不执行 fs
```

跨源用例用 `io` 注入计数器，断言 `stat/access` 调用数为 0。

测试输出末 10 行：

```text
PASS  P31 e size/mtime 变了 → 不判重，照常投递
PASS  P31 f dedupe.json 写失败 → 只 warn，投递照常
PASS  P44 路由注册：exact GET /handoff-relay/probe（空 watches 也注册）
PASS  P44 合法目录 → ok
PASS  P44 不存在目录 → missing
PASS  P44 文件路径 → file
PASS  P44 非绝对路径 → none
PASS  P44 跨源请求 → 403 且不执行 fs
TOTAL: 156/156 PASS
RESULT: PASS
```

## 4. 提交

提交信息：`feat: probe directories via main-process route`

`git show --numstat HEAD` 原文：

```text
112	63	client.js
157	0	index.js
106	7	index.test.mjs
```

点名 `git add index.js client.js index.test.mjs`，未使用 `-A`；未 push、未打 tag、未 publish。

## 5. 提交后 porcelain

实际输出：

```text
 M .gitignore
 M README.md
 M README.zh-CN.md
```

这三项是开工前已有的 CRLF 行尾差异（`git diff --ignore-space-at-eol --stat` 为空），本卡未改动、未清理。因此 porcelain 不是空；需投方清掉后再做最终 QA。

## 6. 未改动

`package.json`、`README.md`、`README.zh-CN.md`、`cordis.patch.yml`、watch/投递/去重/扫描逻辑均未改。

<!-- DONE -->
