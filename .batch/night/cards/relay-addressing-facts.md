# 卡：寻址方式只读取证（不改代码，不出方案）

## 背景

`dsh-handoff-relay` 的 `watches[]` 现在只能写 `targetSessionId`（会话 id 字面量）。会话 id 会随宿主重启/新建会话变化，对外人也不可见。要判断能不能改成「按稳定的东西寻址」，先摸清插件在运行时到底能拿到哪些身份信息。

本卡**只取证、不改任何文件**（除了写报告）。不改 `index.js`、不改配置、不重启 DSH。

## 要回答的四个问题

1. **标题**：插件的 `ctx` 能取到会话标题吗？给出 `resolveSessionTitle`（`C:\develop\workspace\dsh-handoff-relay\index.js` 里现成实现）用的是哪个 service / 哪个 API，以及它的返回在「会话存在但无标题」与「会话不存在」两种情况下分别是什么。贴源码行号。
2. **bot 名**：宿主层有没有把 bot 花名册（bot 名 ↔ 当前 live 会话 id）暴露给插件？注意 `~\.dsh\profiles\node_modules\@deepseek-ai\` 下**没有** `dsh-bot` 包，`~\.dsh\bot\state.json` 是宿主私有文件。请确认：插件 `ctx` 上有没有等价 service；如果没有，说明它只能读文件（那就不算稳定接口）。
3. **roots 字段**：`ctx.agents.roots()` 返回的 `Agent` 对象除 `id` / `session` 外，还能不能拿到 `cwd`、`createdAt`、`status`、标题？逐条给字段名与来源（`Agent` 接口在 `~\.dsh\profiles\node_modules\@deepseek-ai\dsh-agent\lib\types\runtime-types.d.ts:60`，`SessionHeader` 在 `dsh-session\lib\types\types.d.ts:40`，都不含 title）。
4. **重启后 id 到底变不变**：给判定依据而不是猜。已知事实：01:1x 那次重启后 bot 的会话 id 全变了；03:49 那次重启后 id 没变。请从 `~\.dsh\bot\state.json`、`~\.dsh\sessions\--C-develop-...--\<id>\` 下的文件时间戳、`session.v4.jsonl.zstd` 头部 `createdAt`/`parentSession`/`seedLength` 里找出「什么情况下会新建、什么情况下会复用」。

## 产物

`.batch\night\reports\relay-addressing-facts.md`，末尾 `<!-- DONE -->`：
- 四问各一段，每段都要有「命令原文 + 原始输出片段 + 文件路径:行号」
- 最后一段写「可行寻址候选」清单，只列**运行时确实拿得到**的字段（拿不到的直接标 ❌ 并说明为什么）
- 不要写实现方案、不要改代码、不要给时间估计

## 禁忌

- 只读。除报告文件外不许写任何文件；不许改插件仓库；不许改 `cordis.patch.yml`；不许重启 DSH；不许往 `scripts\dsh\wakeup-inbox` 或 `.batch\night\signals` 丢文件。
- 不许 `npm publish`、不许 `git push`。
