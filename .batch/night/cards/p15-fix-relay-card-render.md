# P15 · 修复「插件配置」页卡片渲染崩溃（一行括号错）

- 仓库：`C:\develop\workspace\dsh-handoff-relay`（我实测：`client.js` 9,021B 就在仓库根；`C:\develop\workspace\AI-writer\develop\plugins\dsh-handoff-relay` **不存在**，别按卡面原先那行去找）
- 基线：`master`，HEAD `26ba94c`；改动前 `git status --porcelain` 必须为空（我实测 01:39 为空）
- 估时：20 分钟
- 派给：豆包（代码类，工时可手动选 DeepSeek V4.1 Flash）

## 现象与根因（已定性，勿重新定性）

方案 A 真机：宿主不退、`relay.log` 基线行正常、`settings.describe()` 里**有** `handoff`（26,493 字节响应），但「插件配置」页只有终端/Agent 循环/网页搜索三项。控制台原文：

```
RelayCard (plugins/dsh-handoff-relay/client.js?rev=1d66f1e4dfdc:173:8)
ReferenceError: row is not defined
slot entry crashed in 'settings.plugin.item': ReferenceError: row is not defined
```

即：卡片被派发了，渲染时抛异常被渲染层吞掉，页面表现成「没卡」。

定位：`client.js:153` 是 `rows.map((row, i) => h("div", …`；`client.js:172` 的 `))` 把 `h("div", …)` 提前闭合，导致 `client.js:173` 的
`(row.doneKind === "text" || row.doneKind === "regex") && h(...)` 掉到箭头函数外，`row` 未定义。

## 必做

1. 把 `client.js:172` 的 `))` 改回 `),`，让 `:173-189` 留在同一个 `h(...)` 参数表内（按缩进与括号层级确认，不要顺手重排格式）。
2. 除这一处括号与必要的最小改动外，**不改任何行为**：字段名、槽 key、schema、样式、文案一律不动。
3. 若该文件有构建源（如 `client/` 或 `src/` 下同名源文件），源与产物必须同批改完、产物与源一致；只改产物不算过。
4. 补一条能拦住本 bug 的回归测试：用桩 `h` 真实执行到 `rows.map` 的回调体（**必须让子节点函数被调用**，即 `h(type, props, ...children)` 里对函数 children 求值），断言渲染不抛错、且每行的 doneKind 分支节点出现。测试必须证明：在旧代码（`))`）下会抛 `ReferenceError: row is not defined`，改后不抛。只断言「组件被导出/函数能调用」不算过。
5. 零新增依赖；不改 `package.json` 依赖节；不 `npm install` 到仓库；不 `npm publish`；不重启 DSH；不往任何 watch 目录写文件。
6. 提交：`git add` 点名文件（`client.js`、测试文件、如有则构建源），禁 `-A`；提交信息用英文 `fix: keep relay card rows inside the h() argument list` 之类表述。

## 交付

- 报告 `.batch/night/reports/p15-card-render-fix.md`：根因复述、改前/改后 `client.js` 相关片段行号、新旧测试对照（旧代码失败原文、新代码通过原文）、`node index.test.mjs` 的 `TOTAL:` 行、HEAD、porcelain 空、`git diff --stat`。
- 报告末行 `<!-- DONE -->`；签名与落盘稳定后再交，落盘后连续两次读数一致才算终版。

## 验收判据（三条全过才算过）

1. QA 首验：porcelain 只有点名文件、回归测试在旧代码上必红/新代码上绿（QA 自己复跑 `git stash` 对照或等价取证）、零新增依赖、产物与源一致。
2. 真机（developer 在隔离 profile 实例上用 browser-skill 复验）：「插件配置」页 DOM 里出现 Handoff Relay 那张卡，且控制台无 `slot entry crashed`；截图存 `.batch/night/reports/`。
3. 我终审，并以主人的肉眼确认为准（截图给主人看一眼，主人说「有卡」才结）。

反例（判不过）：「测试全绿 + 不崩 + 页面仍无卡」。
