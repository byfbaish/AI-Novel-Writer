# P22a 首验报告（QA）· 建议 PASS（7/7，附一条口径确认）

- 卡号：P22a（标题优先 / id 兜底）
- 派验单：`.batch/night/review-requests/P22a.md`（派验人 AI writer总负责人，05:05 登记，七条判据）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`；起点基线 `3bce268`（117/117）
- 判定对象（按提交树）：`1c8a7a9`、`de69c8f`，HEAD `de69c8f2a6a89514777cefb09d6f6476029e07ad`
- 判定时刻：2026-11-14 05:21
- 建议：**PASS**；一条口径需负责人确认（见「口径确认」），不构成打回理由。

## C1 · 解析顺序：标题优先、miss 转 id，旧「双写跳过」已消失 ✅
- 旧行为删除实证：`git grep -n '只能二选一' HEAD -- index.js` → 无输出、exit 1（0 命中）；diff 里 `if (hasId && hasTitle) { log(...跳过...); return; }` 整段删除（原 `index.js:964` 一带）。
- 投递期顺序（HEAD）：`index.js:799` 先 `matchSessionsByTitle(ctx, target.value, warnErr, target.exact === true)`；`:802` 起 `if (target.id) { findAgentById(...) → 命中即 ok }`；两者都取不到才 warn 未投。
- 加载期快照同序：`index.js:439` 标题匹配 → `:444 if (target.id)` → `:447 status: \`title-fallback=${target.id}\``。
- 保留值：`hasTitle` 时 target 同时带 `id`（`index.js` diff `{ kind:'title', value, exact, id: hasId ? rawId.trim() : undefined }`），`kind:'id'` 老形态仍在。

## C2 · `exact` 缺省 true（用运行行为证）＋ exact:false 语义不变 ＋ 多义不猜 ✅
- 配置层缺省：`index.js:994` `const exact = rawExact === undefined ? true : rawExact === true;`
- **行为证明（不是看注释）**：`P22a ②` 的 config 只有 `{ dir, targetTitle: '周简报' }`（**不写 exact**），ctx 里同时有「周简报」「周简报 A」两条会话。HEAD 下断言 `calls.length===1` 通过 → 若缺省是包含匹配会有 2 命中→多义→0 投。为排除「只是断言了显式 true」的疑点，我做了**默认值翻转对照**：只把 `:994` 改回 `const exact = rawExact === true;`，其余逐字不动，跑 HEAD 测试：
```
TOTAL: 120/123 PASS  RESULT: FAIL  exit=1
FAIL  P22a ② 只有标题 + exact 缺省(true)：只投完全同名的会话 :: 期望 1，实际 0
FAIL  P11 exact 缺省=true：完全相等只命中同名会话并正常投递移走 :: 期望投给 S-EXACT 1 次，实际 []
FAIL  P11 exact 非布尔：报错并跳过整条 watch（连加载解析行都没有） :: 非布尔 watch 不应投递，实际 []
```
  只翻缺省值、②即红 ⇒ ②在 HEAD 变绿确实由「缺省 true」带来。
- `exact:false` 包含匹配不变：`P22a ③`（`{ targetTitle:'简报', exact:false }`，会话「周简报」）→ 1 次投递，PASS。
- 多义不投：`P22a ④`（会话「周简报」「周简报（二）」，`exact:false`，无 id）→ `calls.length===0`、warn 含「命中 2 条」+ dir + `targetTitle="简报"`、文件原地还在，PASS。
- 注意：内部函数 `matchSessionsByTitle(ctx, targetTitle, onError, exact = false)`（`index.js:407`）缺省仍是 false，但两个调用点（`:439`、`:799`）都显式传布尔，当前无行为影响（见「记」）。

## C3 · 不新增 schema 字段 ✅
`git grep -c 'targetCwd' HEAD -- index.js index.test.mjs` → 无输出、exit 1（0 命中）。

## C4 · 未改 `client.js` / 未夹带其他文件 ✅
`git show --numstat` 原文：
```
1c8a7a9 feat: bind watches by title first and fall back to session id
32	13	index.js
143	26	index.test.mjs

de69c8f test: cover default exact=true for title binding
3	2	index.test.mjs
```
`git diff --name-only 3bce268 HEAD` → `index.js`、`index.test.mjs`（仅此两个）；`git diff --numstat 3bce268 HEAD -- client.js` → 空输出。合计 176 插入 / 39 删除，与执行方报数一致。

## C5 · 测试全绿 + 六类用例 ✅
`node index.test.mjs` 末行读数：
```
TOTAL: 123/123 PASS
RESULT: PASS
exit=0
```
六类用例与位置（`git grep -n` 原文）：
```
2449: P22a ① 只有 targetSessionId：旧形态行为不变（投递 1 次）
2465: P22a ② 只有标题 + exact 缺省(true)：只投完全同名的会话
2483: P22a ③ 只有标题 + exact=false：包含匹配命中并投递
2499: P22a ④ 标题多义：warn 带 dir 与绑定值原文，不投递
2525: P22a ⑤ 标题失配 / 多义但有 targetSessionId：按 id 兜底投递
2544: P22a ⑥ 标题失配且 id 解析不到：warn 带 dir 与两个绑定值，不投递
```
「两者都有、标题命中 → 按标题投」由改写后的 P6 用例覆盖（`P6 双写按标题优先投递 / 双空仍跳过`）。②的 ctx 是「周简报」+「周简报 A」、config 不写 exact，能区分完全相等与包含匹配，是有效判据。

## C6 · 反证：旧 `index.js` 配 HEAD 测试必须红 ✅
临时目录（`C:\develop\workspace\tmp\p22a-rev`）放入 `3bce268:index.js` + HEAD `index.test.mjs` / `package.json` / `client.js`（`client.js` 自 `3bce268` 起未变，两树同 blob），跑：
```
TOTAL: 116/123 PASS
RESULT: FAIL
exit=1
```
7 条 FAIL：
```
FAIL dir 非绝对路径、targetSessionId 空或非字符串 → 逐条跳过并点名 :: 应有 2 条 target 校验日志：[…跳过 watches[0]：targetSessionId 必须是非空字符串（或改用 targetTitle，二者二选一；…）]
FAIL P6 双写按标题优先投递 / 双空仍跳过 → 其他 watch 照常投递 :: 期望 2（双写按标题 + 包含匹配），实际 1
FAIL P11 exact 缺省=true：完全相等只命中同名会话并正常投递移走 :: 期望投给 S-EXACT 1 次，实际 []
FAIL P11 exact 非布尔：报错并跳过整条 watch（连加载解析行都没有） :: 非布尔 watch 不应投递，实际 []
FAIL P22a ② 只有标题 + exact 缺省(true)：只投完全同名的会话 :: 期望 1，实际 0
FAIL P22a ⑤ 标题失配 / 多义但有 targetSessionId：按 id 兜底投递 :: 期望两条都按 id 投，实际 0
FAIL P22a ⑥ 标题失配且 id 解析不到：warn 带 dir 与两个绑定值，不投递 :: 缺兜底失败 warn：["[dsh-handoff-relay] 跳过 watches[0]：targetSessionId 与 targetTitle 只能二选一（两个都写了，不猜哪个优先）"]
```
说明：新增行为面（②缺省 true、⑤id 兜底、⑥双绑定 warn）全红；①③④ 在旧代码下仍绿属正常——它们验证的是旧语义（id 老形态、显式 exact:false、无 id 多义），本来就不该被本次改动影响。

## C7 · 提交纪律 ✅
- `git status --porcelain` → 空。
- `git rev-parse --short=12 HEAD` → `de69c8f2a6a8`；`git rev-parse HEAD` → `de69c8f2a6a89514777cefb09d6f6476029e07ad`。
- 两次提交各自只含点名文件（见 C4 原文）。
- 执行方报告 `.batch/night/reports/p22a-title-binding.md`：12,865B、MD5 `89BB2C490C3CDD13525EDDBF9F102BE6`（我复算一致）、mtime 2026-11-14 04:57:59、末行 `<!-- DONE -->`。

## 口径确认（需负责人一句话定，否则我不判它 FAIL）
判据 2 写「多义（命中 >1）→ warn 且不投」；但 `P22a ⑤` 证明**多义 + 给了 targetSessionId 时会按 id 投**（`calls` 两条都命中、PASS）。这按卡面「标题优先、id 兜底」是对的：id 是显式绑定，不属于「猜」。我按「无 id 才是一律不投」判 PASS。
若你的原意是「无论有没有 id，多义一律不投」，那 ⑤ 与卡面 `§2b` 冲突，需回改——请明确一句。

## 记（不拦本次）
1. **id 兜底成功时投递期无任何日志/warn**：成功搬移本就静默（`relayLog` 无成功投递行），加载期只有 `title-fallback=<id>` 状态串（`index.js:447`）。若要求「每次兜底可追溯」，需另开小卡，不在本卡。
2. `matchSessionsByTitle` 形参缺省仍 `exact = false`（`index.js:407`）。当前两个调用点都显式传值，无影响；建议顺手改 `true`，防止将来新增调用点默认走包含匹配。
3. 本次连带改了 3 处文案（「二者二选一」→「至少给一个」、`exact` 缺省说明、加载行增加 `exact=` 与兜底 id）。属必要连带（旧文案与新语义矛盾），但派验单未点，提醒知悉。
4. 测试数 117 → 123（+6），与 P22a ①–⑥ 数量一致，无删测迹象（旧 P6/P11 用例是改写，不是删除）。
