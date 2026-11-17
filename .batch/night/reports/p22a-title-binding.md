# P22a · 会话绑定改成「标题优先、id 兜底」（host 侧）

- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 基线：`3bce268c26b7`（P21-fix 回滚 README）
- HEAD：`de69c8f2a6a8`
- 提交：
  - `1c8a7a9` `feat: bind watches by title first and fall back to session id`
  - `de69c8f` `test: cover default exact=true for title binding`
- 改动文件：`index.js`、`index.test.mjs`（README 由 P22b 同批改，本轮未动）
- 测试：`TOTAL: 123/123 PASS` / `RESULT: PASS`（基线 117 → 123）

## 1. 实现

### 1.1 解析顺序（`index.js` `startWatch` 内 `resolveNow`，`:786`）

```
resolveNow(relName):
  if target.kind == 'id':                       # 旧形态，行为不变
      agent = findAgentById(target.value)       # get(id) → roots()
      if !agent: warn(带 dir / id / 当前 roots id) → 不投
      return 命中

  hits = matchSessionsByTitle(target.value, target.exact === true)
      # exact=true → 标题完全相等；false → 包含
  if hits.length == 1: return 命中

  # 标题没命中或多义：给了 targetSessionId 就按 id 精确兜底
  if target.id:
      agent = findAgentById(target.id)
      if agent: return 命中（按 id 投）
      warn(带 dir、targetTitle 原文、targetSessionId、命中数) → 不投

  if hits.length == 0: warn(title-no-match，带 dir + 绑定值原文) → 不投
  else:                warn(title-multiple，带 dir + 候选) → 不投
  # 全程不按 cwd 猜；多义不猜
```

关键行号：
- `matchSessionsByTitle`：`index.js:407`（`exact=true` 全等，false 包含）
- `sessionTitleOf`：`index.js:359`（`sessionTitle` 服务优先，再退回 agent/session 标题字段）
- `describeTargetNow`：`index.js:433`；标题没命中/多义且给了 id 时同步做 id 校验，状态为 `title-fallback=<id>` / `title-fallback-miss`
- `startWatch` / `resolveNow`：`index.js:759` / `:786`
- `targetText`：`index.js:773`，双写时显示 `targetTitle="…" exact=…（targetSessionId=… 兜底）`
- `exact` 缺省：`index.js:994`（`rawExact === undefined ? true : rawExact === true`）
- `target` 构造：`index.js:1011`（`{ kind:'title'|'id', value, exact, id? }`）

### 1.2 配置语义

- 三种组合均合法：只有 `targetSessionId` / 只有 `targetTitle` / 两者都有。
- 双写不再跳过：`kind:'title'`、`value:targetTitle`、`id:targetSessionId`（仅兜底）。
- 只有两者都空才跳过，文案：`targetTitle 或 targetSessionId 至少给一个`。
- `exact` 只接受布尔，非布尔仍报错并跳过整条 watch；缺省值由「包含」改为「完全相等」，错误文案同步为 `缺省=true 完全相等，false=包含匹配`。
- 未新增 schema 字段：`Schema = z.object({ watches: z.array(z.any()) })`，无字段可动；未引入 `targetCwd`。

## 2. 六类新用例（P2）

块位置：`index.test.mjs:2439` 起（P17 块之后、清理循环之前）。

| # | 用例名（`check`） | 行号 | 断言行号 |
|---|---|---|---|
| ① | `P22a ① 只有 targetSessionId：旧形态行为不变（投递 1 次）` | 2449 | 2450–2451 |
| ② | `P22a ② 只有标题 + exact 缺省(true)：只投完全同名的会话` | 2465 | 2466–2469 |
| ③ | `P22a ③ 只有标题 + exact=false：包含匹配命中并投递` | 2483 | 2484–2485 |
| ④ | `P22a ④ 标题多义：warn 带 dir 与绑定值原文，不投递` | 2499 | 2500–2502 |
| ⑤ | `P22a ⑤ 标题失配 / 多义但有 targetSessionId：按 id 兜底投递` | 2525 | 2526–2529 |
| ⑥ | `P22a ⑥ 标题失配且 id 解析不到：warn 带 dir 与两个绑定值，不投递` | 2544 | 2545–2547 |

用例原文（节选）：

- ① `watches: [{ dir: d, targetSessionId: 'P22-ID' }]`；断言 `calls.length === 1` 且文案含 `by-id.txt`。
- ② `watches: [{ dir: d, targetTitle: '周简报' }]`（不写 `exact`，证明缺省=true）；fixture 另有一条 `周简报 A`；断言只投 1 次、文案含 `exact.txt`、无 `无法解析会话标题`。
- ③ `watches: [{ dir: d, targetTitle: '简报', exact: false }]`；fixture 标题 `周简报`；断言投 1 次且含 `contains.txt`。
- ④ `watches: [{ dir: d, targetTitle: '简报', exact: false }]`；fixture `周简报`、`周简报（二）`；断言 `calls.length === 0`、warn 同时含 `命中 2 条`、`dir`、`targetTitle="简报"`、文件留在原地。
- ⑤ 两条 watch：`{ targetTitle:'不存在的标题', targetSessionId:'P22-F' }` 与 `{ targetTitle:'简报', exact:false, targetSessionId:'P22-F' }`；断言 `calls.length === 2`、两条文案分别含 `miss.txt` / `amb.txt`（即失配与多义都按 id 兜底）。
- ⑥ `{ targetTitle:'不存在的标题', targetSessionId:'P22-GONE' }`；断言 `calls.length === 0`、warn 含 dir + 标题原文 + `P22-GONE`、文件留在原地。

## 3. 既有用例改动（逐条前后原文）

> 原因：`exact` 缺省由「包含」改成「完全相等」、双写不再跳过、双空文案变更。均为语义变更导致的同步；未删除任何用例，也未把断言改成恒真。

### 3.1 `index.test.mjs:379` 空/非字符串 target 的文案

改前：

```js
assert.equal(warnings.filter((m) => m.includes('targetSessionId 必须是非空字符串')).length, 2,
```

改后：

```js
assert.equal(warnings.filter((m) => m.includes('targetTitle 或 targetSessionId 至少给一个')).length, 2,
```

（跳过语义不变，只同步新文案。）

### 3.2 `P6 双写 / 双空`（原 `:981-1008`）

改前：

```js
const disp = apply(ctx, {
  watches: [
    { dir: dDup, targetSessionId: 'P6-OK', targetTitle: '周简报' },
    { dir: dNone },
    { dir: dOk, targetTitle: '简报' },
  ],
  stableMs: 120,
});
fs.writeFileSync(path.join(dOk, 'ok.txt'), 'x\n<!-- DONE -->\n');
...
assert.equal(calls.length, 1, `期望 1，实际 ${calls.length}`);
assert.ok(warnings.some((m) => m.includes('跳过 watches[0]') && m.includes('只能二选一')), ...);
assert.ok(warnings.some((m) => m.includes('跳过 watches[1]') && m.includes('targetSessionId 必须是非空字符串')), ...);
```

改后：

```js
watches: [
  { dir: dDup, targetSessionId: 'P6-OK', targetTitle: '周简报' },
  { dir: dNone },
  { dir: dOk, targetTitle: '简报', exact: false },
]
fs.writeFileSync(path.join(dDup, 'dup.txt'), 'x\n<!-- DONE -->\n');
...
check('P6 双写按标题优先投递 / 双空仍跳过 → 其他 watch 照常投递', () => {
  assert.equal(calls.length, 2, ...);
  assert.ok(texts.includes('dup.txt'), ...);
  assert.ok(texts.includes('ok.txt'), ...);
  assert.equal(warnings.some((m) => m.includes('只能二选一')), false, ...);
  assert.ok(warnings.some((m) => m.includes('跳过 watches[1]') && m.includes('targetTitle 或 targetSessionId 至少给一个')), ...);
```

### 3.3 `P6 title 命中 2 条`（`:1033`）

改前：`{ dir: d, targetTitle: '简报' }`（旧默认=包含才命中 2 条）

改后：`{ dir: d, targetTitle: '简报', exact: false }`

### 3.4 `P6 包含匹配`（`:1052`）

改前：`{ dir: d, targetTitle: '简报' }`

改后：`{ dir: d, targetTitle: '简报', exact: false }`

### 3.5 `P6 加载期解析日志`（`:1122` → 现 `:1122`）

改前：`{ dir: dOk, targetTitle: '简报' }`

改后：`{ dir: dOk, targetTitle: '简报', exact: false }`

### 3.6 `P10 加载期解析结果`（`:1742` → 现 `:1743`）

改前：`{ dir: dirs[3], targetTitle: '周简报' }`（对 `周简报 A` 靠包含命中 2 条）

改后：`{ dir: dirs[3], targetTitle: '周简报', exact: false }`

### 3.7 `P11 exact 三态`（`:1784-1822`）

改前：

```js
{ dir: dirs[0], targetTitle: '周简报' },                    // 缺省：包含 → 命中 2 条，不投
{ dir: dirs[1], targetTitle: '周简报', exact: true },        // 完全相等 → 命中 1 条
{ dir: dirs[2], targetTitle: '周简报', exact: 'true' },      // 非布尔 → 整条跳过
...
check('P11 exact 缺省=包含匹配：标题命中多条时按原语义跳过（不投递）', () => {
  assert.equal(fs.existsSync(path.join(dirs[0], 'a.txt')), true, ...);
  assert.ok(warnings.some((m) => ... m.includes(dirs[0])), ...);
});
check('P11 exact=true 完全相等：只命中同名会话并正常投递移走', () => { ... dirs[1] ... });
```

改后：

```js
{ dir: dirs[0], targetTitle: '周简报' },                    // 缺省 exact=true：完全相等 → 命中 1 条
{ dir: dirs[1], targetTitle: '周简报', exact: false },       // 包含 → 命中 2 条，不投
{ dir: dirs[2], targetTitle: '周简报', exact: 'true' },      // 非布尔 → 整条跳过
...
check('P11 exact 缺省=true：完全相等只命中同名会话并正常投递移走', () => {
  const hit = calls.filter((c) => c.id === 'S-EXACT');
  assert.equal(hit.length, 1, ...);
  assert.equal(fs.existsSync(path.join(dirs[0], 'a.txt')), false, ...);
  assert.equal(calls.filter((c) => c.id === 'S-LONG').length, 0, ...);
});
check('P11 exact=false 包含匹配：标题命中多条时跳过（不投递）', () => { ... dirs[1] ... });
```

（`box.cbs[0]` / `box.cbs[1]` 分别触发两个 watcher；第三条非布尔 watch 不启动。）

## 4. 判据 P1–P5

### P1 `node index.test.mjs`

```
exit=0
TOTAL: 123/123 PASS
RESULT: PASS
```

六条新用例读数：

```
PASS  P22a ① 只有 targetSessionId：旧形态行为不变（投递 1 次）
PASS  P22a ② 只有标题 + exact 缺省(true)：只投完全同名的会话
PASS  P22a ③ 只有标题 + exact=false：包含匹配命中并投递
PASS  P22a ④ 标题多义：warn 带 dir 与绑定值原文，不投递
PASS  P22a ⑤ 标题失配 / 多义但有 targetSessionId：按 id 兜底投递
PASS  P22a ⑥ 标题失配且 id 解析不到：warn 带 dir 与两个绑定值，不投递
```

### P2 六类用例

见 §2，逐条存在且行号如上。

### P3 grep

```
$ Select-String index.js -Pattern 'targetTitle'
407:function matchSessionsByTitle(ctx, targetTitle, onError, exact = false) {
417:const hit = exact ? title === targetTitle : title.includes(targetTitle);
536:if (w && typeof w.targetTitle === 'string' && w.targetTitle) {
537:out.push(`${indent}    targetTitle: ${yamlQuote(w.targetTitle)}`);
547: * 只支持本插件自己写出的子集（dir/targetSessionId/targetTitle/exact/done.text/done.regex）。
606:else if (name === 'targetTitle') item.targetTitle = unquote(raw);
773:const titleText = `targetTitle="${target.value}" exact=${target.exact === true ? 'true' : 'false'}`;
975:const rawTitle = w && w.targetTitle;
983:log(ctx, 'warn', `[${PLUGIN_NAME}] 跳过 ${label}：targetTitle 或 targetSessionId 至少给一个（当前 targetSessionId=${String(rawId)}，targetTitle=${String(rawTitle)}）`);
1017:? `targetTitle="${target.value}" exact=${target.exact === true ? 'true' : 'false'}${target.id ? `（targetSessionId=${target.id} 兜底）` : ''}`
```

```
$ (Select-String index.js -Pattern 'targetCwd').Count
0
```

### P4 `git diff --stat`

提交前：

```
 index.js       |  45 ++++++++++-----
 index.test.mjs | 170 ++++++++++++++++++++++++++++++++++++++++++++++++---------
 2 files changed, 176 insertions(+), 39 deletions(-)
```

提交后与基线对比（同一结果）：

```
$ git diff --stat 3bce268c26b7 HEAD
 index.js       |  45 ++++++++++-----
 index.test.mjs | 170 ++++++++++++++++++++++++++++++++++++++++++++++++---------
 2 files changed, 176 insertions(+), 39 deletions(-)
```

工作区 `git diff --stat` 为空（已全部提交）。

### P5 `git status --porcelain`

```
（无输出）
```

### 提交与 HEAD 原文

```
$ git show --numstat --format=%h HEAD
de69c8f
3	2	index.test.mjs

$ git rev-parse --short=12 HEAD
de69c8f2a6a8
```

## 5. 取舍与不确定（须派卡人确认）

1. **判据 ⑤ 与必做 2b 的歧义（标「不确定」）**：2b 写「标题没命中或命中多条 → 若给了 `targetSessionId`，按 id 精确命中」；判据 ⑤ 括注写「标题失配且有多义时不走 id 兜底」。两者冲突。实现按 2b：**没命中与多义都走 id 兜底**，用例 ⑤ 同时覆盖这两种情形。若派卡人要按括注执行，请回卡，我改为「只有没命中才兜底」并调整用例。
2. **`exact` 缺省 true 与旧用例的「默认包含」断言冲突**：按卡面「旧用例若断言两个都填就跳过，改为新语义并贴改动前后原文」处理；涉及 P6/P10/P11 共 7 处（§3）。旧测试的**断言目标**未改，只改 fixture 的 `exact` 或按新语义重写。
3. **README 默认值说明**：卡面要求「在 README 配置说明里写一句默认值」，但 P4 判据限定 diffstat 只有 `index.js`、`index.test.mjs`，且卡面注明 README 由 P22b 同批改。本轮未动 README，默认值说明留给 P22b。
4. **未新增 `targetCwd`、未改 `client.js`、未改 `inject`、未新增依赖、未新增写回通道。**

<!-- DONE -->
