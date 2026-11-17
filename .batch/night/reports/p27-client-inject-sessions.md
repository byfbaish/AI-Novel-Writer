# P27 · 客户端补 sessions 服务依赖

执行：豆包（自动档）
仓库：`C:\develop\workspace\dsh-handoff-relay`
起点：`bb8ee9120803`（P26 后，133/133）
终版：`beb0af2fbd98`

## 1. 改动

只动 `client.js` 与 `index.test.mjs`；`index.js`、`package.json` 未动。

`client.js:20`：

```js
const inject = ["slots", "sessions"];
```

只增加 `"sessions"` 一个服务名。以下兜底全部保留：

- `sessionsOf()` 先试 `ctx.sessions.list`，再 `readService`；
- `sessionMap()` 取不到时返回 `{}`；
- picker 空态文案「没有匹配的会话」；
- `package.json` 的 `dsh.client.inject` 未动。

## 2. 测试

### 2.1 全量

```text
$ node index.test.mjs
PASS  P27 client inject 恰为 ["slots", "sessions"]
PASS  P27 sessions 桩：sessionMap 非空，点「选择会话」后 picker 列出至少一条
TOTAL: 135/135 PASS
RESULT: PASS
```

exit 0；133/133 → 135/135。

### 2.2 新增 / 调整

- 调整 `P17 ①`：原断言 `["slots"]` 已不符合新规格，改为 `["slots","sessions"]`，标题同步改为「只含 slots + sessions」。
- 新增 `P27 client inject 恰为 ["slots", "sessions"]`：断言导出数组恰好两项、顺序为 `slots` 在前。
- 新增 `P27 sessions 桩：sessionMap 非空，点「选择会话」后 picker 列出至少一条`：
  - 用带 `sessions.list.getSnapshot()` 的桩 ctx（两条 session：`会话 A` / `会话 B`，各有 `cwd`）；
  - 通过状态化 React 桩真实触发「选择会话」按钮，组件重渲染后读取 picker；
  - 断言列表包含 `会话 A`、副行 `《C:\work\a》`，且不出现「没有匹配的会话」。
  - 该用例同时覆盖 `sessionMap` 与 `pickerItems` 的读取路径。

## 3. C3 反证

临时副本把 `inject` 改回 `["slots"]`，其余不动，跑同一套测试：

```text
FAIL  P17 ① client inject 只含 slots + sessions（不含 settingsScope / configForms） :: Expected values to be strictly deep-equal:
FAIL  P27 client inject 恰为 ["slots", "sessions"] :: Expected values to be strictly deep-equal:
TOTAL: 133/135 PASS
RESULT: FAIL
```

两条 inject 断言均变红；证明用例确实绑定到导出数组，不是摆设。

## 4. 判据核对

- C1：`git show --numstat HEAD` 只有 `client.js` 1/1、`index.test.mjs` 97/2；`index.js` blob 与 `bb8ee91` 相同（`04a44b8d89077e9739f57bcde4a931810fdc7ed5`）；`package.json` blob 也未变（`1b04240d94d3b8fe97094cb06224d1717a2eb20b`）。
- C2：导出数组恰为 `["slots","sessions"]`，无第三个服务名。
- C3：反证 133/135 FAIL，inject 用例红。
- C4：135/135 PASS，> 133。

## 5. 提交与工作区

```text
$ git log --oneline -2
beb0af2 fix: inject sessions service for settings session picker
bb8ee91 fix: load schemastery through ESM import with top-level await

$ git show --numstat --format= HEAD
1       1       client.js
97      2       index.test.mjs

$ git status --porcelain
(空)

$ git rev-parse --short=12 HEAD
beb0af2fbd98
```

`git add` 点名 `client.js`、`index.test.mjs`，未用 `-A`；未 tag、未 push、未 publish。

## 6. 文件读数

```text
client.js       21,506 B  MD5 3759BC50A55E0982A3D4C9BE328CD82B
index.test.mjs 131,718 B  MD5 AE69FA98EE235CB4ED6DDCC6C1CB1133
index.js        52,447 B  MD5 CA23BC6B05A277EBB4D324199E87D6C7（未动）
```

## 7. 风险 / 未做

- 硬 inject `sessions` 会让它成为客户端条目前置依赖；本机 `sessions` 是 core 服务，官方 `dsh-client-ui-session` 与 task-board 也硬 inject，按卡面接受。
- **真机未重启验证**。若出现 `web boot: 1 entry did not activate`，按卡面三步回滚：还原 `client.js` → `dsh plugin --profile desktop install` → 重启。
- 未在真实桌面宿主里复验「没有匹配的会话」是否消失；测试只证明桩 ctx 下 `sessionMap` / picker 路径可用。

<!-- DONE -->
