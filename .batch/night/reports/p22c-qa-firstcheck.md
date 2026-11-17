# P22c 首验（QA）· 建议 PASS 7/7

- 派验单：`.batch/night/review-requests/P22c.md`（派验人 AI writer总负责人，05:59 预登记）
- 对象：`8d562a052e8fd8e8da3080668fd1957d160ffd0a`（父 `6a28319`）
- 执行方报告：`.batch/night/reports/p22c-legacy-readonly.md`（4,799B，06:01:37）
- 复核方式：按**提交树**另建临时目录跑测试，不写生产 profile；不动工作区

## 判据逐条

### 1. numstat 只有两个文件 — PASS

```text
$ git diff --numstat 6a28319 HEAD
21      94      client.js
14      7       index.test.mjs
```

`index.js`、`package.json`、两份 README 零改动。

### 2. `缺省为包含匹配` 0 命中 — PASS

```text
$ git grep -c '缺省为包含匹配' HEAD -- client.js
（无输出）exit=1
```

新文案 `client.js:121`：`exact 为 true 时标题必须完全相等（缺省 true）；填 false 则按包含匹配。`

### 3. `session id` 0 命中 — PASS

```text
$ git grep -ci 'session id' HEAD -- client.js
（无输出）exit=1
```

连注释都没留，按派验单口径判 PASS，不要求补注释。

### 4. 旧宿主桩渲染：可编辑控件 0、真实值可见 — PASS

桩是旧宿主形态：`index.test.mjs:2315` `get: (name) => (name === 'settingsScope' ? { bind: () => scope } : undefined)`，即走 `mountLegacy`。用例 `index.test.mjs:2354`「P22c 旧宿主渲染」断言：

- `input` / `textarea` / `select` / `button` 合计 **0**；
- 提示文案命中：`当前宿主版本较旧，不支持本插件的配置界面。请直接编辑 cordis.patch.yml 里的 dsh-handoff-relay 配置，重启后生效。`；
- exact 新文案命中；
- **真实 watch 值可见**：`C:\watch\a`、`session-a`、`文本：<!-- DONE -->`、`正则：^done$`。

⇒ 是「只读展示」不是「删空」。静态侧同证：`RelayCard` 渲染只有 `div/span`（`client.js:127-131` 每行三列文本 + 状态行），无任何 `button`。

### 5. 写回入口只剩新卡 — PASS

```text
$ git grep -n 'scope.set\|\.mutate(' HEAD -- client.js
HEAD:client.js:331:						accepted = await controller.mutate(ops);
```

`:331` 在 `SettingsCard`（新卡）内；旧分支已无 `scope.set`、无 `mutate`、无保存按钮。

### 6. 测试全绿 — PASS

按提交树复制到临时目录跑：

```text
TOTAL: 131/131 PASS
RESULT: PASS
exit=0
```

130 → 131 的来源：原 P15 用例「doneKind 分支节点按行出现（text/regex 各一，off 无）」被替换为两条 P22c 用例（渲染只读 + 全文文案），净 +1，无其他删改。

### 7. porcelain 空 / HEAD 原文 — PASS

```text
$ git rev-parse HEAD
8d562a052e8fd8e8da3080668fd1957d160ffd0a
$ git status --porcelain
（空）
$ git tag --points-at HEAD
（空）
```

## 重点核（负责人点名的两条）

1. **−94 行删在哪**：全部落在旧分支。`git diff -U0` 的 hunk 全在旧行 95–211 → 新行 95–138 区间；新卡段起点从 `client.js:211`（6a28319）移到 `:138`（HEAD）之后未再改动。
   硬证：把两版从 `// ---------------------------------------------------------- P22b 三列卡片` 直到 EOF 截出比对 —— 长度均 **13,920 字符**，SHA-256 **完全一致**（`sameSha=True`）。新宿主三列卡片 + 会话选择器**一个字节都没动**。
2. **只读展示而非删空**：见判据 4，真实值（目录、标题/id 兜底、完成规则、exact 语义）都在，控件为 0。

## 备注（不进判定，供负责人取舍）

- `relayDoneLabel` 的 `off`（不使用）分支本次没有用例覆盖——测试数据只有 text/regex/null 三行；低风险，记一条即可，不必单独开卡。
- 旧卡头部仍保留一句 `S.hint`「以下为当前 watch 的只读视图；本宿主不提供保存入口。」，与卡的只读定位一致。

## 结论

7/7 PASS，建议 PASS。剩余判定归负责人；真机轮按 `8d562a0` 预检 HEAD 走即可。
