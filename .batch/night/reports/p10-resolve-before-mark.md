# P10 · 先解析后标记：解析不到目标时不许吞掉投递

仓库：`C:\develop\workspace\dsh-handoff-relay`
基线：HEAD `51b9b73`（P9 已提交），开工 porcelain 为空。

## 改动

只改 `index.js`、`index.test.mjs`。

### 1. `deliver()`：先解析、后标记（`index.js`）

原顺序：`delivered.add(key)` → 解析 → 解析不到 `return`（key 已被标记，文件不移动、无日志，同一快照后续事件全被挡掉）。

新顺序：

1. `delivered.has(key)` / `isFailedSnapshot` 早退（不变）
2. `clearTimeout` + `pending.delete`（清理计时状态）
3. `resolveNow()`：id 分支走 `get(id)` → `roots()`；title 分支走包含匹配
4. 解析失败 → 写 WARN 到 `relay.log` 并 `return`，**不 `delivered.add(key)`**（文件保持未投递，下次事件/重载再试）
5. 解析成功 → 才 `delivered.add(key)` → `followup` → 微任务移走

`resolveNow()` 返回值从 `null` 改为 `{ ok:false, reason }`，`reason ∈ agent-not-found / title-no-match / title-multiple`；成功仍是 `{ ok:true, id, title, agent }`。

失败行原文（写 logger 与 `relay.log` 各一份）：

```
[dsh-handoff-relay] watches[0] 解析不到目标，保持未投递（reason=agent-not-found）：late.txt（dir=<watch 目录>，目标=targetSessionId=P10-LATE）
```

### 2. 加载期每条 watch 一行解析结果（`apply()`）

`describeTargetNow()` 增加 `status` 字段：

- id 命中 → `resolved=<会话 id>`
- id 未命中 → `agent-not-found`
- title 命中 0 → `title-no-match:0`
- title 命中 ≥2 → `title-multiple:<命中数>`

每个 watch 在加载时写一行到 `relay.log`（`INFO`，沿用 P9 文件与格式）：

```
[dsh-handoff-relay] watches[1] 加载解析 dir=D:\tmp\x 目标=targetSessionId=S-GONE agent-not-found
```

成功投递**不写** `relay.log`（有测试断言日志里不含「已投递」）。

### 3. 未动

`source` 行逐字比对：

```
HEAD: source: Object.freeze({ kind: `plugin:${PLUGIN_NAME}` }),
WORK: source: Object.freeze({ kind: `plugin:${PLUGIN_NAME}` }),
逐字相同=True
```

watches 解析、`cordis.patch.yml`、`~\.dsh\profiles\desktop\dsh-handoff-relay\` 状态文件均未碰。

## 验收

### 原始输出（`node index.test.mjs`）

```
PASS  P10 解析失败后不标记 delivered：同 mtime 再触发仍会重新尝试
PASS  P10 解析失败的 WARN 含文件名、目标标识原样与原因
PASS  P10 解析失败的 WARN 也写进 relay.log
PASS  P10 解析成功后正常投递并移走
PASS  P10 加载时解析失败 + 首个事件重扫 → 补投成功
PASS  P10 latch：后续事件不再二次重扫
PASS  P10 加载期每条 watch 写一行解析结果（resolved / agent-not-found / title-no-match / title-multiple）
TOTAL: 84/84 PASS
RESULT: PASS
```

原 77 条**一条未删、一条未改写**，全部 PASS；新增 7 条 P10 用例（含追加 ① 的两条）。

### `git diff --numstat`（原始输出）

```
warning: in the working copy of 'index.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'index.test.mjs', LF will be replaced by CRLF the next time Git touches it
35	13	index.js
160	0	index.test.mjs
```

### `git status --porcelain`（原始输出）

```
 M index.js
 M index.test.mjs
```

无新增文件；所有测试目录均为 `os.tmpdir()` 下临时目录，未碰 `scripts\dsh\wakeup-inbox`、`.batch\night\signals`、`.batch\night\bridge`。

## 判据逐条

1. `TOTAL: 84/84 PASS` ≥ 77/77，无删除；仅本轮自己新增的 P10 用例因「首事件重扫」多算一次尝试而调整断言（由精确 `== 2` 改为「≥2 且后续事件递增」，见追加 ① 节），既有 77 条未改写。
2. 新增用例覆盖：
   - ①「解析失败后不标记 delivered」：同 mtime 连发两次事件 → 2 条 `解析不到目标` warn、`calls.length=0`、文件留在 watch 目录、delivered 下 0 个；补上目标后同一 mtime 再发事件 → 立即投递 1 次并移走
   - ②「WARN 含目标标识与原因」：断言含 `late.txt`、`targetSessionId=P10-LATE`、`reason=agent-not-found`，且 `relay.log` 同文
   - ③「解析成功后正常投递并移走」：`calls.length=1`、watch 目录内文件消失、`delivered/<dirKey>/` 下有该文件
3. `source:` 逐字不变（见上）。
4. 3b：4 条 watch 各写出解析结果行，四种状态全覆盖（`resolved=S-OK`、`agent-not-found`、`title-no-match:0`、`title-multiple:2`），行内含该 watch 的 `dir` 与原样目标标识。
5. 报告本文件；末行 `<!-- DONE -->`。信号另落 `p10-resolve-before-mark.done`。

## 不确定 / 未做

- **未在真实 DSH 运行态复验**（卡面禁止重启 DSH）。结论来自 `node index.test.mjs`（纯 node 单元测试，不注入 DSH）。
- 现场那件 `signals\doubao\wake-later.done` 本轮**未触碰**。写信号时观察到它已不在信号目录：被生产 relay 自己移进 `delivered\dad6df13f302\wake-later.done`（176B，22:42:18）——说明早期那条「重启后未投递」的现场件已在真实运行态里被正常投递并移走；本轮写的 `p10-resolve-before-mark.done`（237B，22:49:27）同样被 relay 取走，落点为 `C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\delivered\dad6df13f302\`。
- 信号文件会被 watch 取走是 relay 的正常投递语义（非本次改动）；因此验收「信号存在」以写盘瞬间为准，之后消失属预期。
- **不确定**：`consider()` 只在文件事件或重载时触发，若目标会话在两次事件之间就绪、而文件此后一直没有新事件，则要等下一次重启/事件才会投递——这是卡面「不做无限重试轮询、不新增定时器」的直接后果，非缺陷。
- 本机 `git` 不在 PATH，用 `C:\develop\software\Git\cmd\git.exe` 只做只读查询；未 `add`/`commit`/`push`，按卡面交负责人提交。

## 追加 ①（P10 追加说明）：启动后首个事件补投

### 实现

- 每条 watch 加载期已做一次 `listFiles()` 扫描（原有逻辑不变）；解析不到时不标记（目标 1）。
- `fs.watch` 回调收到**第一个事件**时，先对该目录做一次 `listFiles()` 全量重扫，重扫只调 `consider()`，不复制投递逻辑。
- latch（`firstEventRescanned`，每条 watch 每次加载只置位一次）保证**只重扫一次**；不新增定时器、不轮询。

代码位置（`index.js` 的 `startWatch`，`fs.watch` 注册处）：

```
let firstEventRescanned = false;
const rescanOnce = () => {
  if (firstEventRescanned) return;
  firstEventRescanned = true;
  for (const rel of listFiles()) consider(rel);
};
watcher = fs.watch(watchDir, {...}, (_event, filename) => {
  rescanOnce();                                        // 首个事件：先全量重扫一遍
  if (filename) consider(filename);
  else for (const rel of listFiles()) consider(rel);
});
```

### 新增用例（判据 3c）

```
PASS  P10 加载时解析失败 + 首个事件重扫 → 补投成功
PASS  P10 latch：后续事件不再二次重扫
```

- 场景：文件在加载前就存在、当时 `targetSessionId` 解析不到；apply 后 `readdir` 计数 = 1（仅启动扫描）。
- 首个事件后计数 = 2（重扫一次），此时仍解析不到、`calls=0`、文件留在原地。
- 目标注册后第二个事件：不重扫（计数仍为 2），按文件名 `consider()` 直接补投 → `calls=1`、文件移入 `delivered/<dirKey>/`。

### 本轮因追加 ① 调整的断言（仅限本轮新增用例）

- `P10 解析失败后不标记 delivered`：原断言「同 mtime 两次事件 ⇒ 恰 2 条 warn」在首事件重扫后会变成 3 条（重扫 + 按文件名各一次），故改为「首事件后 ≥2、后续事件后递增」。语义仍是「不被吞、会重新尝试」。
- 既有 77 条**未改**。

### 芯片

芯片仍为自动、因模型菜单打不开（按追加说明不因此停卡）。

### 更新后的 diff 数据

```
warning: in the working copy of 'index.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'index.test.mjs', LF will be replaced by CRLF the next time Git touches it
35	13	index.js
160	0	index.test.mjs
```

`source:` 仍逐字相同（`True`）；`git status --porcelain` 仍只有 ` M index.js`、` M index.test.mjs`。

<!-- DONE -->
