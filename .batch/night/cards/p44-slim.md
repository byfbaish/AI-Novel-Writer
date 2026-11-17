# P44-slim · 目录探测改走主进程路由（一页版）

仓库：`C:\develop\workspace\dsh-handoff-relay`，`master`，起点 HEAD `8e4ad642095e9f239038e86468d9dced459361fa`。A 类，一次提交，禁 push/tag/publish。

## 1. `index.js`
- `ctx.inject(['webServer'], wctx => wctx.effect(() => wctx.webServer.register({ kind: 'exact', path: '/handoff-relay/probe', handler })))`。
- `GET /handoff-relay/probe?path=<绝对路径>`，**先做同源校验**（跨源直接 403，不碰 fs），再 `fs.stat` / `fs.access`：
  - 可读目录 → `{kind:'ok'}`；不存在 → `{kind:'missing'}`；无权限 → `{kind:'denied'}`；是文件 → `{kind:'file'}`；入参非法 → `{kind:'none'}`。
  - 附 `absolute` 与 `reason`。**只 stat/access，不 readdir、不写盘。**

## 2. `client.js`
- `probeDirectory`：删掉 `ctx.get("remoteAccess")` 与 `workspaceFilesOf` 两条路，改成 `fetch('/handoff-relay/probe?path=' + encodeURIComponent(dir))`（同源、页面自身 base，**不要**用 `__DSH_TRANSPORT__.streamBaseUrl`）。
- 输入变化 debounce 400ms；在途 `checking`；网络失败/超时 → `none`（**不得**变绿）。
- 接 P39 已有的 `dirFrameStyle`：`ok`→`#2e7d32` 绿；`missing|denied|file`→`#d33` 红；`checking|none`→`#9e9e9e` 灰。
- 框沿下一行文字：ok「目录可读」／missing「目录不存在」／denied「无读取权限」／file「这是文件，不是目录」／none「宿主未提供目录核验」。
- 保存时若探测不是 `ok`，行下红字「目录当前不可读，保存后需确认」，**不阻止保存**。

## 3. 验证与交付
- 测试：`node index.test.mjs` 全绿（不是 `node --test`）。新增：合法目录 ok／不存在 missing／文件 file／非绝对路径 none／跨源 403。
- 一次点名 `git add index.js client.js index.test.mjs`，禁 `-A`。
- 禁改 `package.json`、README、`cordis.patch.yml`。
- 报告 `.batch/night/staging/p44-dir-probe-report.md`，末行 `<!-- DONE -->`，含提交 SHA、`git show --numstat`、测试末 10 行。
