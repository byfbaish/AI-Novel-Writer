# P5 卡面 · 改名 dsh-handoff-relay + 修「会话存在但无标题」误报（不依赖上下文）

## 0. 现状（先读，别猜）
仓库：`C:\develop\workspace\dsh-file-watch`（**本轮不要动目录名**，只改文件内容）。
零依赖 ESM 单文件插件，入口 `index.js`（309 行），测试 `index.test.mjs`（当前 `node index.test.mjs` → 47/47 PASS）。
HEAD：`9f8e514 feat: per-watch done rules with four states and load-time session check`，工作区干净。
`done` 已完成四态：省略=默认 `<!-- DONE -->`、`{text}`、`{regex}`、`null`=关闭。**本轮不许改这套语义。**

## 1. 改名：插件正式名 = `dsh-handoff-relay`
用户已拍板。理由（写进 README 时可用一句）：`relay` 表达「把一条已就绪的信号点到点转达到某个会话」，不含起构建/跑命令的暗示；`trigger` 会被误读成能触发动作为，弃用。

**全部替换点（逐处点名，一处不许漏，替换后 grep `dsh-file-watch` 必须 0 命中）**：
- `index.js:1` 文件头注释、`index.js:8` `export const name = 'dsh-file-watch'`、`index.js:10` `const PLUGIN_NAME = 'dsh-file-watch'`
- `index.test.mjs:1` 文件头注释、`:92`、`:173`、`:174`、`:390` 四处 `assert.equal(..., 'plugin:dsh-file-watch')`
- `README.md`：`:3` 标题、`:56`、`:61`、`:71`、`:75`、`:83`、`:84`、`:94`、`:95`
- `README.zh-CN.md`：`:3`、`:46`、`:49`、`:50`、`:58`、`:62`、`:69`、`:70`、`:78`、`:79`
- `package.json:2` `"name"`
- 仓库内 `cordis.patch.yml:9` `- id:`、`:10` `name:`
- `LICENSE:3` 版权行改 `Copyright (c) 2026 the dsh-handoff-relay authors`
- `package.json` 版本号 `0.2.0` → `0.3.0`

注意：`index.js:152` 的 `source: Object.freeze({ kind: \`plugin:${PLUGIN_NAME}\` })` **只是引用常量，不要改成字面量**；改 `PLUGIN_NAME` 后 source 自然变成 `plugin:dsh-handoff-relay`，测试断言跟着改即可。

## 2. 修一个误报（本轮唯一的逻辑改动）
现状 `index.js:110` `resolveSessionTitle()`：`agents.get(id)` / `roots()` 都拿不到 agent → 返回 `''`；**拿到了 agent 但没有任何标题字段 → 也返回 `''`**。
`apply()` 在 `:293-296` 把 `''` 一律当成「会话失效」，写 warn 说「无法解析会话标题…请确认会话存在」。
问题：会话正常存在、只是还没折叠出标题时，也会得到一条「请确认会话存在」的误导性 warn——真失效和只是没标题混在一起，用户分不清。

要求改成两态可区分：
- `resolveSession(ctx, targetSessionId)` 返回 `{ found: boolean, title: string }`
- `found=false`（agent 确实解析不到）→ 保留现在的 warn，文案带 `targetSessionId` 和 `dir`，且该 watch **仍启动**（只 warn 不拦）
- `found=true` → **不 warn**；把 title 带进该 watch 的「已加载」日志（`index.js:254` 那行），title 为空时显示 `(无标题)` 即可
- 不许新增配置键、不许改变 `agents.get` → `roots()` 兜底的既有顺序

## 3. 测试要求
- 现有 47 条一条不许删；改名引起的断言改动允许，断言强度不降。
- 新增两条：
  1. agent 能解析、但无任何标题字段 → **不产生**「无法解析会话标题」warn，watch 正常启动
  2. agent 完全解析不到 → 产生该 warn（带 dir），watch 仍启动、不抛
- 跑 `node index.test.mjs`：TOTAL 全 PASS、RESULT PASS、exit 0。

## 4. 不许碰
- `source` 的写法（`kind` 必须仍是 `plugin:${PLUGIN_NAME}` 形状，非空、不等于 `'plugin'`）。
- `done` 四态语义、`TAIL_BYTES = 4096`、正则四条约束（尾部 4096 字节 / `m` 标志 / 长度 ≤200 / 拒嵌套量词）。
- `watches` 解析结构、`stableMs` 语义。
- **不要改仓库目录名**、不要改 `C:\Users\...\.dsh\profiles\**` 下任何文件、不要重启 DSH、不要往 `scripts\dsh\wakeup-inbox` 丢文件。

## 5. 提交与产物
- `git add index.js index.test.mjs package.json cordis.patch.yml README.md README.zh-CN.md LICENSE`（点名列全，**禁止 `-A` / `.`**）；不 push。
- 报告：`C:\develop\workspace\AI-writer\develop\.batch\night\reports\p5-rename-and-title-check.md`
  - 首段：`结论：PASS/FAIL ｜ 提交：<sha> ｜ 测试：TOTAL n/n`
  - 给替换后 `Select-String 'dsh-file-watch'` 的 0 命中证据（贴命令与输出行数）
  - 给两条新测试的行号与断言行
  - 末行必须是 `<!-- DONE -->`
