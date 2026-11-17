# P28 · 会话选择器收口：默认 10 条 + 查看更多 + 限高滚动

执行：豆包（自动档）
仓库：`C:\develop\workspace\dsh-handoff-relay`
起点：`beb0af2fbd98`（P27 后，135/135）
终版：`6f655500c88b`

## 1. 改动

只动 `client.js` 与 `index.test.mjs`；`index.js`、`package.json` 未动。

`client.js`：

- 新增 `const PICKER_LIMIT = 10;`。
- 新增状态 `pickerExpanded`，默认 `false`。
- 搜索框仍固定在会话列表上方；输入变化时 `setPickerExpanded(false)`，搜索后回到前 10 条。
- 列表包进内联限高容器：

```js
{ maxHeight: "320px", overflowY: "auto" }
```

- 默认渲染 `pickerList.slice(0, PICKER_LIMIT)`；总数 > 10 时底部显示 `查看更多（共 N 条）`，点击展开全部并变为 `收起`，再点收起回到 10 条。
- 空态文案保持「没有匹配的会话」；`取消`、`放弃修改`、选中会话三条关闭路径都会把展开状态复位。
- `inject`、三列结构、写回路径（`mutate` / `set`）均未动。

## 2. 测试

### 2.1 全量

```text
$ node index.test.mjs
PASS  P28 默认只渲染 10 条，且底部出现「查看更多（共 12 条）」
PASS  P28 点「查看更多」后渲染全部 12 条，按钮变「收起」
PASS  P28 会话列表容器内联限高：max-height 320px + overflow-y auto
TOTAL: 138/138 PASS
RESULT: PASS
```

exit 0；135/135 → 138/138。

### 2.2 新增三条

- `P28 默认只渲染 10 条，且底部出现「查看更多（共 12 条）」`
  - 桩 ctx 12 条会话；真实点「选择会话」打开 picker；
  - 断言限高容器内会话按钮数为 10，文本含 `查看更多（共 12 条）`。
- `P28 点「查看更多」后渲染全部 12 条，按钮变「收起」`
  - 点击「查看更多」，状态化 React 桩重渲染；
  - 断言会话按钮数为 12，文本含 `收起`、不含 `查看更多（共 12 条）`。
- `P28 会话列表容器内联限高：max-height 320px + overflow-y auto`
  - 断言容器 `style.maxHeight === "320px"`、`style.overflowY === "auto"`。

## 3. 反证

临时副本只把 `PICKER_LIMIT` 从 `10` 改成 `999`，其余不动：

```text
FAIL  P28 默认只渲染 10 条，且底部出现「查看更多（共 12 条）」 :: 默认应只渲染 10 条
FAIL  P28 点「查看更多」后渲染全部 12 条，按钮变「收起」 :: 应有查看更多按钮
TOTAL: 136/138 PASS
RESULT: FAIL
```

- 改 `10 → 999` 后默认直接渲染 12 条，**用例 a 先红**（默认行数不等于 10）；
- 因总数 12 不大于 999，「查看更多」按钮消失，**用例 b 也红**（找不到按钮）；
- 用例 c 只查容器样式，仍绿。

## 4. 判据核对

- C1：`git show --numstat HEAD` 只有 `client.js` 25/12、`index.test.mjs` 50/0；`index.js` blob 与 `beb0af2` 相同（`04a44b8d89077e9739f57bcde4a931810fdc7ed5`）；`package.json` blob 未变。
- C2：默认 10 条、查看更多/收起、`max-height/overflow-y` 三样都在；展开与收起在测试中真实点击执行。
- C3：反证 136/138 FAIL，默认条数用例与展开用例都红。
- C4：138/138 PASS，> 135。

## 5. 提交与工作区

```text
$ git log --oneline -2
6f65550 feat: limit session picker to ten rows with expand and scroll
beb0af2 fix: inject sessions service for settings session picker

$ git show --numstat --format= HEAD
25      12      client.js
50      0       index.test.mjs

$ git status --porcelain
(空)

$ git rev-parse --short=12 HEAD
6f655500c88b
```

`git add` 点名 `client.js`、`index.test.mjs`，未用 `-A`；未 tag、未 push、未 publish。

## 6. 文件读数

```text
client.js       22,146 B  MD5 C2F0C0E5690D07414574098B0DE9497D
index.test.mjs 134,141 B  MD5 A14F524BD98E5A20FE4A113450E82EA2
index.js        52,447 B  MD5 CA23BC6B05A277EBB4D324199E87D6C7（未动）
```

## 7. 未做 / 不确定

- 未重启桌面宿主做真机视觉复验；测试只验证桩渲染的条数、按钮与 style 值。
- 「搜索框常驻在会话列表上方」按「picker 打开后搜索框固定在滚动列表之外、不随列表滚动」实现，未把搜索框常驻到未打开的卡片行内；若原意是后者，需要再确认（不确定）。
- 未测 10 条以下时是否出现按钮（逻辑上 `N <= 10` 不渲染），本轮新增用例只覆盖 12 条场景。

<!-- DONE -->
