From: AI writer总负责人 · AI writer项目组 | 44b1c2a3
To: 豆包联络人 · AI writer项目组 | c12ee7f6 | 群分身

# P54-fix1 · relay 注入头强制写 From/To 身份（A 类改码卡）

> 状态：**可投**（主人 2026-11-15 13:07 回「可以」，放行改码）
> 上游：`.batch/night/backlog/p54-relay-fromto-header.md`（1,393B / `A69EB9729739ED0C785D04A28B4A4247`）、判据 `.batch/night/staging/handoff-usage-criteria-v3.md`（8,803B / `9E289B857328CFA337D6C739363D9A0A`）H7/H8
> 派验单：`.batch/night/review-requests/p54-fromto-inject.md`\n> 投递方注意：本卡第二行 `To:` 必须在**投出前**换成真实目标标题与前 8 位（读窗口取，不猜）；未改写不得投递。

## §0 工作区前置（开工第一动作，不符即停：不写盘、不提交、不得 cd 到别处继续）

1. 工作目录必须是源码仓 `C:\develop\workspace\dsh-handoff-relay`（纯 ESM JS，无构建链）。
   `git rev-parse --show-toplevel` → 规范化后必须等于 `C:/develop/workspace/dsh-handoff-relay`
2. `git branch --show-current` → `master`
3. `git rev-parse --short HEAD` → `fdf7b17`
4. `git diff --numstat HEAD` 与 `git diff --ignore-cr-at-eol --stat HEAD` **双空**（必须带 `HEAD`，防已暂存）
5. `git -c core.quotepath=false status --porcelain=v1` → 空（白名单：无）
6. 目标文件存在：`index.js`、`index.test.mjs`

**禁**：改 profile 下 `node_modules\dsh-handoff-relay\*`；`npm publish`／`git push`／打 tag；`pnpm`/`npm install`；改 `cordis.patch.yml`。

## §一 要解决的问题（一句话）

relay 注入给目标会话的消息**不写发送者身份**，接收方无法分辨谁投的；本次事故正是靠这个空档把「伪造授权」送到了错误会话。现在要让它**每条注入消息都带可机检的 `From:` / `To:` 两行**。

事实（已核，不重复取数）：

- `index.js:18` `DEFAULT_MESSAGE = '文件 {path} 已就绪（触发={reason}），请继续。'`；
- `index.js:797` `buildMessage(relName, fullPath, state, reason, template)` 只替换 `{file}/{path}/{reason}/{size}/{mtimeMs}`；
- `index.js:805` `source: Object.freeze({ kind: \`plugin:${PLUGIN_NAME}\` })`，全文 `From:`/`To:` 命中 0；
- **更省事的一条（developer 预核，2026-11-15 13:1x）**：`resolveNow` 已把标题带回来了——`index.js:1143`/`:1147` 都是 `return { ok: true, id: ..., title: sessionTitleOf(ctx, agent) || '(无标题)', agent }`，而 `deliver()` 在 `:1178` 拿到 `resolved` 却只用了 `id`。**优先用 `resolved.title`**，缺失时才调 `sessionTitleOf`。- `index.js:701` `sessionTitleOf(ctx, agent)` 已能取会话标题（服务 `sessionTitle`，兜底 agent.title），`index.js:1191` 在 `deliver()` 里已拿到 `agent`，`resolved.id` 即目标 session 全 id。

## §二 行为要求（判据写这里，实现只允许在 §三 范围内）

1. **身份头必须由 relay 前置**，不得依赖配置模板里有没有占位符——自定义 `message` 模板也不许绕过（安全规则不能靠用户配置保证）。
2. 注入消息正文**前两行固定**（与群 notice 逐字一致，字段用 ` · ` 与 ASCII ` | `，禁全角竖线 U+FF5C）：

```
  From: <角色> · <群名后缀> | <session前8位>
  To: <目标会话标题> | <session前8位> | <主身/群分身>
```

3. **`To` 由 relay 生成**：标题**优先取 `resolved.title`**（`:1143`/`:1147` 已带），缺失再 `sessionTitleOf(ctx, agent)`，都取不到写 `(无标题)`；session 前 8 位取 `resolved.id` 前 8 字符；`主身/群分身` 按标题是否含 ` · `（U+00B7 两侧空格）判定，含则 `群分身`，否则 `主身`。
4. **`From` relay 不得猜**：只读**桩件正文**（`full` 文件，读头 4096 字节即可，已有常量 `TAIL_BYTES`）里第一条 `^From: .+$`：
   - 命中 → 原样采用该行的 `From:` 值（后续正文里那行保留原样，允许重复出现在正文，但**注入头必须唯一一行**）；
   - 未命中 → 注入 `From: UNKNOWN`。
5. **不得按 watch 目录名或 targetSessionId 推断发信人**（按目录猜＝假身份，比没有更坏）。
6. **日志**：每次投递在既有 `relayLog(...'info'...)` 里追加一行 `注入身份 from=<值> to=<id8>|<标题>|<kind>`（用于第三方回读，不改 relay.log 语义）。
7. 其余行为**一律不变**：stable/DONE 判据、dedupe（contentHash 判重）、delivered 快照、解析失败「保持未投递」、`source.kind` 值。

## §三 改动范围（只许这两处；想扩大先报我）

| # | 位置 | 改什么 |
|---|---|---|
| 1 | `index.js:18` `DEFAULT_MESSAGE` | 保持正文不变，**不要**在里面加 `From:`/`To:` 行；身份头由 `buildMessage` 前置（默认模板、`schema default`、老配置兜底三条路径同一处生效，天然一致） |
| 2 | `index.js:797` `buildMessage` + `:1196` 调用点 | 增加身份参数（标题、id8、kind、fromText），在正文前拼两行头；`deliver()` 里把 `sessionTitleOf(ctx, agent)` 与 `resolved.id` 传进去，并读桩件首条 `From:` |

**注意（防双头）**：`DEFAULT_MESSAGE`(`:18`)、`schema default`(`:57`)、`apply()` 兜底(`:1308`) 三处**都不许**内置 `To:`/`From:` 文本；头只由 `buildMessage` 前置一次，否则 T5 会数出两行。\n\n配套（同一次提交内，不算扩大范围）：`index.test.mjs` 增加 §四 的用例；`README.md` 里「注入消息长什么样」若有示例，同步改成带两行头。

## §四 测试用例（必须新增，缺一不算完成）

| 用例 | 桩件 | 期望 |
|---|---|---|
| T1 | 无 `From:` 行 | 注入头第一行 `From: UNKNOWN`，第二行 `To: <标题> \| <id8> \| <kind>` |
| T2 | 首行 `From: 豆包联络人 · AI writer项目组 \| c12ee7f6` | 注入头用该值原文，不重复插第二行 `From:` |
| T3 | 配置 `message` 设为不含任何占位符的纯文本 | **仍然**有前置两行头（防配置绕过） |
| T4 | 目标会话取不到标题 | `To: (无标题) \| <id8> \| 主身` |
| T5 | 任意用例 | 注入文本里 `^From:` 与 `^To:` 各**恰好 1 行**（机检 `([regex]::Matches($t,'(?m)^From: ')).Count -eq 1`） |

**反证（QA 会做，别绕过）**：删掉前置→T1 红；改成从 watch 目录名推 From→T2 红；只在前置里写死 `{to}` 占位符而自定义模板不含→T3 红。

## §五 交付物（缺一不进首验）

1. 仓库提交：`fix: inject From/To identity header into handoff messages`，**只含** `index.js`、`index.test.mjs`（+ README 若改）；`git show --numstat` 逐文件列出。
2. `node index.test.mjs` 全绿输出原文（贴末 10 行即可，含通过数）。
3. 报告：`.batch\night\reports\p54-fromto-inject-report.md`，**首行 `执行方：<你的名字>`**，第二行 `model=<模型> | 倍率=<倍率> | provider=<官方直连/自有>`；正文含：改动 diff 摘要、五个用例结果、`git rev-parse --short HEAD`、`porcelain`。
4. 信号：`.batch\night\signals\doubao\p54-fromto-inject.done`，前两行 From/To 头，第三行起写卡号／commit／porcelain／报告路径，末行 `<!-- DONE -->`。

## §六 不做

- 不改 `client.js`、不改设置卡 UI、不改 watch 配置（6 条现状是对的）。
- 不动 dedupe/`contentHash`（P31 已收口）。
- 不追溯历史投递件。
- 不 `publish`、不 `push`、不打 tag——出包只做到 `npm pack` 产物，发不发由主人定。
- 不引入新依赖，不加构建链。

## §七 验收方向（给 QA，判据细化归 QA）

- 提交只碰允许的文件；`index.js` 改动落点确为上述两处语义（允许行号漂移）。
- 五用例真跑（含反证两条），非「声称通过」。
- 机检：`Select-String -Path index.test.mjs -Pattern 'UNKNOWN|From: ' -Quiet` 为真；提交内 `git show --numstat` 文件数与卡面一致。
