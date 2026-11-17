# P15 · 修复「插件配置」页卡片渲染崩溃（client.js 一行括号错）

- 卡号：P15-card-render-fix · 执行方：豆包 · 派卡人：AI writer总负责人
- 仓库：`C:\develop\workspace\dsh-handoff-relay`（`client.js` 9,021B 在仓库根；卡面写的 `plugins\dsh-handoff-relay` **不存在**，按仓库根处理）
- 基线：`master` HEAD `26ba94c7444ad014306db2fae522220f86c7c366`，开工时 `git status --porcelain` 为空
- 结果：已修并提交 `848c26d`（`fix: keep relay card rows inside the h() argument list`），未 push；`TOTAL: 113/113 PASS`

## 0. 一句话

`client.js` 的 `rows.map` 回调在 `:172` 被一个多余的 `)` 提前闭合，`:173-189` 掉到模块作用域，`row` 未定义；渲染层抛 `ReferenceError` 后吞掉卡片，页面表现成「没卡」。改回括号后，卡片正常构建出三行。

## 1. 根因（与真机控制台逐字同因）

真机原文：

```
RelayCard (plugins/dsh-handoff-relay/client.js?rev=1d66f1e4dfdc:173:8)
ReferenceError: row is not defined
slot entry crashed in 'settings.plugin.item': ReferenceError: row is not defined
```

`settings.describe()` 里**有** `handoff`（26,493 字节），说明卡片已派发；崩在**渲染**阶段。

结构复盘：`:153` 是 `rows.map((row, i) => h("div", { key: i, … },`，行 div 的参数表一直延伸到 `:189`。但 `:172` 写成 `h("button", … , "删除")),`——多出来的 `)` 把行 div 提前闭合，于是 `:173` 的 `(row.doneKind === "text" || …) && h("div", …)` 变成 `rows.map(...)` 的**额外实参**，在箭头函数外求值；`row` 只存在于箭头函数参数里，故 `ReferenceError`。

本机取证（同一段脚本、旧版 `client.js`）：

```
client.js:173
						(row.doneKind === "text" || row.doneKind === "regex") && h("div", { style: S.row },
						 ^

ReferenceError: row is not defined
    at RelayCard (client.js:173:8)
```

行号 `173:8` 与真机控制台完全一致。

## 2. 改动前后（逐字片段 + 行号）

改前（`26ba94c:client.js`）：

```
172:						h("button", { style: S.del, disabled: !writable, onClick: () => removeRow(i) }, "删除")),
189:							h("span", null, ""), h("span", null, ""), h("span", null, ""))),
```

改后：

```
172:						h("button", { style: S.del, disabled: !writable, onClick: () => removeRow(i) }, "删除"),
189:							h("span", null, ""), h("span", null, ""), h("span", null, "")))),
```

两处括号，解释为什么必须两处（这点与卡面「只改 172」的字面不同，按括号层级核出来的事实如实写）：

- `:172` 把 `))` 改回 `),` 后，行 div（`:153`）重新保持打开，`:173-189` 回到参数表内——这是 bug 的正解。
- 随之而来的是 `rows.map(...)` 少一个闭括号：`:189` 原本的 `))),` 只有 3 个闭合（span、行 div、`rows.map`），因为旧代码在 `:172` 已经替行 div 提前收了口。现在行 div 不再提前闭合，`:189` 必须补到 `)))),` 才能依次闭合 span → 内层 exact 行 div → 行 div → `rows.map`。只改 `:172` 会得到 `missing ) after argument list`（本轮实测过，见 §3 的失败读数 1），所以 `:189` 的这一处 `)` 是**必要的最小改动**，不是顺手重排。

没有动：字段名、槽 key、schema、样式、文案、`inject`、`apply` 挂载方式，一律零变化。`node --check client.js` → exit 0。

构建源：本仓库根下 `client/`、`src/` 均 `Test-Path False`（本次读取的文件内未找到构建源），`client.js` 即唯一客户端产物，不存在「源与产物不一致」的问题。

## 3. 回归测试（真执行 `rows.map` 回调体）

新增两条用例，位于 `index.test.mjs` 末尾清理循环之前：

1. `P15 卡片渲染：rows.map 回调真执行，不抛 ReferenceError`
2. `P15 卡片渲染：doneKind 分支节点按行出现（text/regex 各一，off 无）`

夹具怎么做到「真执行」：

- `node:vm` 执行 `client.js` 全文，沙箱只给 `window.__ModuleLoader__.load`（捕获 factory）和 `console`；
- 桩 React：`useState` 返回函数初值并就地求值、`useEffect` 空实现、`createElement` 即桩 `h`；`h(type, props, ...children)` 对**函数型 child 就地调用求值**，再把 `{ type, props, children }` 记账并返回；
- `factory(requireStub)` 后调 `mod.apply({ settingsScope: { bind: () => scope }, slots: { inject: (k, fn) => fn(), register: (d, card) => { card = … } } })`，从 `settings.plugin.item` 的 `register` 里拿到 `RelayCard`；
- 用三行 watches 渲染：`{ text: "<!-- DONE -->" }` / `{ regex: "^done$" }` / `done: null`（off）；
- 断言：渲染不抛错；树里有 3 个 `props.key !== undefined` 的行 `div`（遍历器会展开数组，因为 `rows.map` 的返回值是数组型 child）；text 行恰好 1 个 `placeholder === "<!-- DONE -->"` 的输入框、regex 行恰好 1 个 `placeholder === "正则，如 ^done$"`、每行 1 个 `type === "checkbox"`。

旧代码必红（同一脚本、`git show 26ba94c:client.js` 导到 `%TEMP%\p15-old-client.js` 后运行）：

```
client.js:173
						(row.doneKind === "text" || row.doneKind === "regex") && h("div", { style: S.row },
						 ^
ReferenceError: row is not defined
    at RelayCard (client.js:173:8)
```

放进测试后表现为断言失败（本轮第一次跑，`:172` 已改、`:189` 尚未补，先撞上语法错误；补完 `:189` 后才是「行节点数为 0」，再修遍历器后转绿，三次读数都在下面）：

```
FAIL  P15 卡片渲染：rows.map 回调真执行，不抛 ReferenceError :: 渲染抛错：missing ) after argument list
FAIL  P15 卡片渲染：doneKind 分支节点按行出现（text/regex 各一，off 无） :: Cannot read properties of null (reading 'tree')
TOTAL: 111/113 PASS / RESULT: FAIL

FAIL  P15 卡片渲染：rows.map 回调真执行，不抛 ReferenceError :: 应有 3 行节点，实际 0
FAIL  P15 卡片渲染：doneKind 分支节点按行出现（text/regex 各一，off 无） :: text 行应有 1 个完成标记输入框，实际 0
TOTAL: 111/113 PASS / RESULT: FAIL
```

新代码绿（提交后终跑）：

```
[17:45:24.090] PASS  P15 卡片渲染：rows.map 回调真执行，不抛 ReferenceError
[17:45:24.091] PASS  P15 卡片渲染：doneKind 分支节点按行出现（text/regex 各一，off 无）
TOTAL: 113/113 PASS
RESULT: PASS
```

（`111` → `113`：原有 111 条一条未删，新增 2 条。）

## 4. 判据自查

- `node index.test.mjs` → `TOTAL: 113/113 PASS`，exit 0。
- `node --check client.js` → exit 0。
- 零新增依赖：未改 `package.json` 依赖节、未 `npm install`、未 `npm publish`；测试只用了 Node 内置 `node:vm` / `node:url`。
- 点名提交：`git add client.js index.test.mjs`（未用 `-A`），提交 `848c26d`；未 push。
- `git status --porcelain` 提交后为**空**（无输出）。
- `git diff --stat 26ba94c HEAD`：

```
 client.js      |  4 +--
 index.test.mjs | 83 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 85 insertions(+), 2 deletions(-)
```

- `git show --numstat --format= HEAD`：`2	2	client.js`、`83	0	index.test.mjs`。
- HEAD：`848c26d`（父 `26ba94c`）。
- 未重启 DSH、未启用插件、未往任何 watch 目录写文件；临时文件只落在 `%TEMP%`（`p15-old-client.js`、`p15-debug.mjs`、`p15-testout.txt`、`p15-final.txt`）。

## 5. 未验证（按反例口径必须写清）

- **真机两条不在本执行方权限内**：developer 在隔离 profile 用 browser-skill 看「插件配置」页 DOM 是否出现 Handoff Relay 卡、控制台是否还有 `slot entry crashed`，以及主人肉眼「有卡」的终审——本轮均未做（卡面禁重启 DSH、禁启用插件）。
- 单测能证明的是「同一份 `client.js` 文本在桩 React 下能构建出三行且不抛 `row is not defined`」，且旧文本在同一夹具下逐字复现真机报错；**不能**替代真机 DOM 验证。按「测试全绿 + 不崩 + 页面仍无卡 = 判不过」的口径，本卡在真机验收前只能算「修复候选已就绪」。
- 真机若仍无卡，下一个怀疑点（本轮未取证，标**不确定**）：宿主加载的 `client.js?rev=` 是否需要重新取包/缓存失效；本轮未触发 DSH 重载，旧文本可能仍在宿主侧缓存里。

## 6. 收尾

- 提交 `848c26d`，未 push；提交后 porcelain 空。
- 报告落盘 `C:\develop\workspace\AI-writer\develop\.batch\night\reports\p15-card-render-fix.md`。

<!-- DONE -->
