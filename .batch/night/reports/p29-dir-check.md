# P29 · dir 目录校验提示 +「选择目录…」

执行：豆包（自动档）
仓库：`C:\develop\workspace\dsh-handoff-relay`
起点（投前现取）：`801dc38`
终版：`d535dc148c76`

## 1. 改动面

只动 `client.js` 与 `index.test.mjs`。

```text
$ git show --numstat --format= HEAD
121     5       client.js
217     0       index.test.mjs
```

`index.js`、`package.json` 未动，blob 与起点相同：

```text
index.js     HEAD:8293cc1461341e2d8142b25d932b2b37acbb02a5 = worktree
package.json HEAD:1b04240d94d3b8fe97094cb06224d1717a2eb20b = worktree
```

## 2. 实现

### 2.1 不加硬 inject

`client.js` 导出数组保持：

```js
const inject = ["slots", "sessions"];
```

`remoteAccess` 不进入 inject；在探测时用 `ctx.get("remoteAccess")` 惰性取。取不到即返回 `{ kind: "none" }`，不渲染徽标，不影响卡片挂载，也不会有条目 pending。

`workspaceFiles` 按以下顺序惰性查找（任何一步抛错都只降级为无徽标）：

1. `access.workspaceFiles`
2. `access.remote.workspaceFiles`
3. `ctx.get("remote").workspaceFiles`
4. `ctx.get("remote.workspaceFiles")`

P32 取证写的是 `remote.workspaceFiles.list(sessionId, dir)`；这里同时兼容 `remoteAccess` 服务直接暴露 `workspaceFiles` 的形态，因为本次未在真实宿主里确认 `remoteAccess` 对象的字段形状（见 §6）。

### 2.2 「选择目录…」

- 仅当 `globalThis.__DSH_DIRECTORY_PICKER__` 存在且 `typeof pick === "function"` 时渲染按钮。
- 点击：

```js
const picked = await picker.pick();
if (typeof picked === "string" && picked.trim()) patchRow(i, { dir: picked.trim() });
```

`null`、取消、抛错一律 `catch` 静默，保持原值；不打 console，不改其它行。

### 2.3 可读性探测

- 只对非空 `dir` 且能取到一个 session id 的行探测。
- `sessionId` 来源：`sessionMap(ctx)` 的第一个 key（P32 建议「任取一个 live session」；本次采用该建议，属**不确定的业务选择**，见 §6）。
- 调用 `workspaceFiles.list(sessionId, dir)`：
  - `ok === true` → 绿点，`title="目录可读"`。
  - `ok !== true` → 红点，`title="目录不可读或不存在"`，并在行内显示「目录不可读或不存在」。
  - `ctx.get` 抛错、取不到服务、`list` 抛错、3 秒超时 → 无徽标，不画红点。
- 3 秒超时用 `Promise.race` + `setTimeout`。
- 探测中初始为灰点，`title="检查中…"`。
- 每个 `(ctx, sessionId, dir)` 只探一次，结果缓存于模块级 `WeakMap`；`dir` 变化后 key 变化，会重新探测。

### 2.4 保存不被阻断

- 保存按钮的 `disabled` 仍是 `!writable || !dirty`，没有引用探测结果。
- 红点只影响行内提示，`save()` 仍按原路径 `controller.mutate` / `controller.set` 写回。
- 新增用例 f 实测：红点存在时点保存，`mutate` 仍执行并显示「已保存」。

## 3. 测试

### 3.1 全量

```text
$ node index.test.mjs
PASS  P29 a 无 __DSH_DIRECTORY_PICKER__ ⇒ 不渲染「选择目录…」
PASS  P29 b pick 返回 C:\x ⇒ 该行 dir 写成 C:\x
PASS  P29 c pick 返回 null ⇒ dir 保持原值、不报错
PASS  P29 d ctx.get(remoteAccess) 抛错 ⇒ 不崩、不显示任何点
PASS  P29 e list ok:true ⇒ 绿点；ok:false ⇒ 红点 + 行内文案
PASS  P29 f 红点出现后保存仍可用（校验只提示、不阻断）
TOTAL: 150/150 PASS
RESULT: PASS
```

exit 0；起点 144/144 → 150/150（新增 6 条）。

### 3.2 渲染桩

P29 单独实现 `p29Render`：

- 支持 `useEffect` 依赖比较，状态变化触发重渲染。
- `createElement` 会真正执行函数组件，因此 `DirStatusDot` 的异步探测能在测试中完成并观察到点。
- 沙箱注入 `setTimeout` / `clearTimeout`，与浏览器运行时一致。
- 可注入 `globalThis.__DSH_DIRECTORY_PICKER__` 桩。

## 4. 反证（硬 inject `remoteAccess`）

临时副本：

- `const inject = ["slots", "sessions", "remoteAccess"];`
- `probeDirectory` 改为直接读 `ctx.remoteAccess`，不再 `ctx.get` 兜底。

结果：

```text
FAIL  P17 ① client inject 只含 slots + sessions（不含 settingsScope / configForms）
FAIL  P27 client inject 恰为 ["slots", "sessions"]
FAIL  P29 d ctx.get(remoteAccess) 抛错 ⇒ 不崩、不显示任何点 :: 不得硬 inject remoteAccess
TOTAL: 147/150 PASS
RESULT: FAIL
```

- **P29 d 真红**：d 断言导出数组仍为 `["slots","sessions"]`，硬 inject 后立刻失败。
- P17/P27 同时红是既有对 inject 精确数组的断言，属预期副作用；本卡只要求 d 红。
- e/f 在反证版仍绿：e/f 的桩 ctx 同时提供 `remoteAccess` 属性，硬路径能正常探测。

## 5. 判据核对

- C1：改动面仅 `client.js`、`index.test.mjs`；`index.js`、`package.json` blob 与 `801dc38` 相同。
- C2：导出数组仍 `["slots","sessions"]`；d 用例显式断言。
- C3：d 真跑；反证 d 真红。
- C4：保存按钮不含探测条件，f 实测红点后仍能保存。
- C5：全绿，150 > 144。

## 6. 未做 / 不确定

- 未在真实桌面宿主上点击验证；`__DSH_DIRECTORY_PICKER__` 的真机形状、返回类型只按卡面契约实现，**不确定**是否与本机实际 API 完全一致。
- 未确认 `ctx.get("remoteAccess")` 返回对象是否直接带 `workspaceFiles`；代码同时尝试 `access.remote.workspaceFiles`、`ctx.get("remote").workspaceFiles`、`ctx.get("remote.workspaceFiles")` 三种兜底。真实可用路径需真机验证。
- `sessionId` 取 `sessionMap` 第一个 key，是 P32 的「任取 live session」建议；没有校验它是否 live，**不确定**在多会话/空会话时行为是否符合预期。
- 3 秒超时未写用例（会引入真实 3 秒等待）；实现已存在。
- 探测缓存按 `(ctx, sessionId, dir)` 永久保留；同一路径从不可读变为可读时不会自动重探，只有 `dir` 值变化才重探。这是按卡面「每个 dir 只探一次」实现的，未做定时刷新。

## 7. 提交与工作区

```text
$ git log --oneline -2
d535dc1 feat: add directory picker and readable dir hints
801dc38 fix: persist delivered snapshots for physical dedupe

$ git status --porcelain
(空)

$ git rev-parse --short=12 HEAD
d535dc148c76
```

`git add` 点名 `client.js`、`index.test.mjs`，未用 `-A`；未 tag、未 push、未 publish。

## 8. 文件读数

```text
client.js       26,602 B  MD5 39E530B2AFAA27D458925D826E0E19D0
index.test.mjs 149,574 B  MD5 DA6B8AD58F89B255E03AB8404D8AE929
index.js        57,749 B  MD5 54816FF7348EC01546F6ADAF134197DC（未动）
package.json     1,085 B  MD5 C36CA3EA257CBAB8B18AF20FC1D2A6C7（未动）
```

<!-- DONE -->
