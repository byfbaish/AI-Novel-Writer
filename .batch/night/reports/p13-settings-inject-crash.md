# P13 · 修启动期致命崩溃（未声明 inject 就访问 ctx 服务）

- 卡号：P13-settings-inject-crash（执行方：豆包；派卡人：AI writer 总负责人）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 基线：HEAD `8c5c073`，porcelain 空，`node index.test.mjs` = 95/95
- 结果：已修复并提交；追加轮后 `TOTAL: 99/99 PASS`；porcelain 空
- 提交：`c55d7f10793ca55fb6e9331ff6c16bb844939a0e`（`fix: never touch undeclared services on ctx so startup cannot crash`，`index.js 25/3`、`index.test.mjs 53/0`）+ `3e9abd657ea922da4b8f706146e06d459e5af95b`（`test: cover strict ctx without settings and unresolvable schemastery`，`index.test.mjs 56/4`）

## 1. 根因与崩溃对应

宿主原文：

```
dsh: fatal load failure: Error: cannot get property "settings" without inject
    at mountSettingsCard (file:///C:/develop/workspace/dsh-handoff-relay/index.js:668:31)
    at new apply (file:///C:/develop/workspace/dsh-handoff-relay/index.js:974:8)
```

- `index.js:10` 只声明 `export const inject = ['agents'];`；
- 旧的 `mountSettingsCard` 第一行是 `const settings = ctx && ctx.settings;`（即崩溃栈的 `668:31`）；
- cordis 的 ctx 是严格代理，读未声明服务属性会同步抛错，`void mountSettingsCard(...)` 在启动装配期把异常变成 fatal load failure ⇒ 宿主 exit 1。

## 2. 改法

1. 新增 `getService(ctx, name)`（`index.js:669-676`）：只用 `ctx.get(name)` 取服务，整段 `try/catch`，取不到返回 `undefined`；**没有**把 `settings` 写进 `inject`。
2. `mountSettingsCard` 开头改为 `const settings = getService(ctx, 'settings')`；为空时写一行 `relay.log` warn：

```
[dsh-handoff-relay] 设置卡未挂载：宿主无 settings 服务（跳过，不影响 watch）
```

   然后 `return`，watch 主链路完全不受影响。
3. `apply()` 的调用点补 `.catch`（`index.js` 末尾），把设置卡整段兜成可选能力，任何异常都不再冒泡成未处理拒绝：

```js
void mountSettingsCard(ctx, JSON.parse(JSON.stringify(watches)), stateDir)
  .catch((err) => relayLog(ctx, stateDir, 'warn', `[${PLUGIN_NAME}] 设置卡未挂载：意外异常（${String(err)}）`));
```

### 2.1 全仓 `ctx.<name>` 排查（`grep -n 'ctx\.[A-Za-z_]+' index.js`）

| 行号 | 访问 | 判定 |
|---|---|---|
| 36 | `ctx.logger` | 非服务（cordis 内置属性，旧版长期在用；守卫 `ctx && ctx.logger`） |
| 347 | `ctx.get('sessionTitle')` | 已经是 `ctx.get` + try/catch（P7 起） |
| 367 / 393 / 760 / 998 / 999 | `ctx.agents` | 已声明 inject（`export const inject = ['agents']`），保持原样 |
| 666 / 671 / 672 | `ctx.get` | 新增 `getService()` 内的安全取用 |
| 681 / 682 | `ctx.get` / `ctx.settings` | **都在注释里**（`getService` 与 `mountSettingsCard` 的说明文字），不是运行时访问 |
| 1003 | `ctx.effect` | 非服务（cordis 生命周期方法，先 `typeof` 判定） |

结论：运行时只有 `mountSettingsCard` 一处读未声明服务（`ctx.settings`），已改为 `ctx.get('settings')`；其余 `ctx.agents` 已声明，`ctx.get`/`ctx.effect`/`ctx.logger` 属方法或内置属性，未改。

## 3. 新测试：严格 ctx（能抓住这个 bug）

位置：`index.test.mjs` 的 `P11` 段之后新增一节，构造：

```js
const strictCtx = new Proxy(target, {
  get(t, prop, receiver) {
    if (typeof prop === 'symbol') return Reflect.get(t, prop, receiver);
    if (prop in t) return Reflect.get(t, prop, receiver);
    throw new Error(`cannot get property "${String(prop)}" without inject`);
  },
});
```

`target` 只提供 `agents` / `logger` / `effect` / `get`（`get('settings')` 返回 `undefined`），与崩溃现场「宿主有 agents、无 settings」一致。三条断言：

- `P13 严格 ctx：apply 不抛` —— `apply` 正常返回 dispose；
- `P13 严格 ctx：watch 照常启动并投递` —— 丢一个 `<!-- DONE -->` 文件，恰好 1 次 followup 且文件被移走；
- `P13 严格 ctx：relay.log 写明「宿主无 settings 服务」`。

### 修复前它会怎样失败（实测复现）

用同样的 Proxy 直接读旧写法那一行：

```
$ node -e '<构造严格 Proxy 后读 p.settings>'
修复前读 ctx.settings → 抛：Error: cannot get property "settings" without inject
修复后路径 ctx.get("settings") → undefined
```

即：修复前这组用例在 `apply()` 阶段就抛 `cannot get property "settings" without inject`（与宿主 crash 原文逐字同因），async 函数把它变成 rejected promise，`void` 丢弃 → 未处理拒绝；宿主在装配期直接 fatal。修复后同一 ctx 下三条严格 ctx 用例全 PASS（另有 1 条 schemastery 降级用例，见 §6.5）。

## 4. 判据自查

```
$ node index.test.mjs
…
PASS  P13 严格 ctx：apply 不抛（未声明 settings 也不会同步崩）
PASS  P13 严格 ctx：watch 照常启动并投递（设置卡缺席不阻断主链路）
PASS  P13 严格 ctx：relay.log 写明「宿主无 settings 服务」
PASS  P13 有 settings 但 schemastery 不可解析：warn 跳过设置卡，watch 照常投递
TOTAL: 99/99 PASS
RESULT: PASS
```

- 提交 `3e9abd6`（`test: cover strict ctx without settings and unresolvable schemastery`）后的工作区实测即上表：`TOTAL: 99/99 PASS`、exit 0、porcelain 空。
- 原有 95 条一条未删（95 → 99：新增 3 条严格 ctx 用例 + 1 条 schemastery 不可解析的降级用例）。
- `source:` 逐字不变（按内容比对，两行原文相同）：

```
现行：source: Object.freeze({ kind: `plugin:${PLUGIN_NAME}` }),
提交前：source: Object.freeze({ kind: `plugin:${PLUGIN_NAME}` }),
```

- `git status --porcelain`：提交前只有 `M index.js`、`M index.test.mjs`；提交后为空。
- 未动 `client.js`、未动 `cordis.patch.yml`、未重启/未启用插件、未往任何 watch 目录丢文件。

## 5. 收尾

- 提交：`c55d7f10793ca55fb6e9331ff6c16bb844939a0e`（英文信息，未 push、未 publish）。
- `git show --numstat`：

```
25	3	index.js
53	0	index.test.mjs
```

- 注意：本卡只保证「启动不再因未声明服务崩溃」；设置卡在**有 settings 服务**的宿主里能否注册/渲染仍未实机验证（与 P11 报告的未验证项一致，本轮禁止重启与启用插件）。

## 6. 追加卡落实（严格 ctx 冒烟判据细化）

### 6.1 临时目录：`relay-p13-` 前缀、位置否证

测试内两条场景各自的目录：

```
[16:16:13.896] P13 临时目录（绝对路径）：C:\Users\<用户名>\AppData\Local\Temp\relay-p13-tWcKDJ
[16:16:14.054] P13b 临时目录（绝对路径）：C:\Users\<用户名>\AppData\Local\Temp\relay-p13-Xy5HO6
```

派生代码（`index.test.mjs:1946/1948/2010/2012`）：`fs.mkdtempSync(path.join(os.tmpdir(), 'relay-p13-'))`（P13b 的 profile 根用 `relay-p13-sch-`，投递目录仍 `relay-p13-`）。

用例内的 `assertOutsideWatchZones`（`index.test.mjs:1949-1957`）逐条否证：

- 必须以 `path.resolve(os.tmpdir()) + path.sep` 开头；
- `path.relative(仓库根, 临时目录)` 必须回 `..`（不在 `C:\develop\workspace\dsh-handoff-relay` 内）；
- `path.relative(~\.dsh, 临时目录)` 必须回 `..`（不在 `C:\Users\<用户名>\.dsh` 内）。

依据：两条路径都在 `C:\Users\<用户名>\AppData\Local\Temp\` 之下 —— 既不在仓库目录，也不在 `C:\Users\<用户名>\.dsh`，更不在 `C:\develop\workspace\AI-writer\develop` 下的任何 watch 目录（`.batch\night\signals\doubao`、`.batch\night\signals\workbuddy`、`.batch\night\bridge\to-owner`、`.batch\night\bridge\to-group`、`wakeup-inbox`、`wakeup-inbox\workbuddy`、`wakeup-inbox\doubao` 及 `cordis.patch.yml` 列出的其余目录）。即：**不在上述任何一条之下**。

### 6.2 收尾：目录删干净

两条用例的 `finally` 都执行 `fs.rmSync(d, { recursive: true, force: true })` + `fs.rmSync(root, ...)`（且只对 mkdtemp 出来的这两个路径，不碰上面任何 watch 目录）。跑完实测：

```
C:\Users\<用户名>\AppData\Local\Temp\relay-p13-tWcKDJ → False
C:\Users\<用户名>\AppData\Local\Temp\relay-p13-Xy5HO6 → False
```

`git status --porcelain` 原文（本次追加改动提交前采集）：

```
 M index.test.mjs
```

无 `??`。**与追加卡「两个 M」的偏差如实说明**：`index.js` 的 M 已在 `c55d7f1` 提交掉（该提交 numstat 为 `25/3 index.js`、`53/0 index.test.mjs`），所以追加轮采集时只剩 `index.test.mjs` 一个 M；本次追加只改了测试，提交 `3e9abd6`（`56/4 index.test.mjs`），提交后 porcelain 空。

### 6.3 断言是真起 watcher（不是只断言 startWatch 被调用）

`index.test.mjs:1988-1995`：先真写文件 `p13.txt`（内容含 `<!-- DONE -->`），触发捕获到的真实 `fs.watch` 回调 `box.cb('change', 'p13.txt')`，等 150ms，再从投递结果断言：`calls.length === 1`、源文件已被移走、`p9Walk(delivered 根, 'p13.txt').length === 1`。P13b（`:2030-2039`）同法。

### 6.4 修复前报错原文 ↔ 断言点对应

宿主原文（逐字）：

```
dsh: fatal load failure: Error: cannot get property "settings" without inject
    at mountSettingsCard (file:///C:/develop/workspace/dsh-handoff-relay/index.js:668:31)
    at new apply (file:///C:/develop/workspace/dsh-handoff-relay/index.js:974:8)
```

| 修复前失败点 | 新增用例里拦住它的断言 |
|---|---|
| `mountSettingsCard` 读 `ctx.settings` 抛 `cannot get property "settings" without inject`（旧 `index.js:668:31`） | `P13 严格 ctx：apply 不抛`（`index.test.mjs:1984`，`assert.equal(typeof disp, 'function')`）——旧实现该路径直接产生未处理拒绝，`apply` 拿不到可用 dispose |
| 抛错发生在启动装配期 ⇒ watch 没起来 / 宿主 fatal | `P13 严格 ctx：watch 照常启动并投递`（`index.test.mjs:1991`，真实事件 + `calls.length === 1` + 源文件移走 + delivered 命中） |
| 静默崩、无降级说明 | `P13 严格 ctx：relay.log 写明「宿主无 settings 服务」`（`index.test.mjs:1996`，`log.includes('无 settings 服务')`） |

### 6.5 schemastery 解析不到 → warn 跳过、watch 照常

新增用例：`P13 有 settings 但 schemastery 不可解析：warn 跳过设置卡，watch 照常投递`（`index.test.mjs:2033`）。ctx 的 `get('settings')` 返回带 `register` 的桩（若真走到 register 会抛，证明它在 import 失败后不该被调用），断言 `relay.log` 含 `无法解析 @deepseek-ai/schemastery`、`calls.length === 1`、源文件已移走。

前提说明（标「不确定」的风险）：该用例依赖本仓库当前解析不到 `@deepseek-ai/schemastery`（实测 `ERR_MODULE_NOT_FOUND: Cannot find package '@deepseek-ai/schemastery'`）；若将来仓库装了该依赖，这条用例的 warn 断言会失效，届时需要改成注入 mock（本轮未做，因为不能动实现）。

### 6.6 「同一段测试在 `8c5c073` 上会抛什么」前后对照

只读导出旧版（`git show 8c5c073:index.js` → 系统临时目录，未写进仓库），用与新增用例**同一个严格 ctx**调旧 `apply`，实测输出：

```
apply 同步返回：未抛
未处理拒绝：cannot get property "settings" without inject
    at Object.get (…\relay-p13-before-c191aa29\check.mjs:20:11)
    at mountSettingsCard (…\relay-p13-before-c191aa29\index-old.mjs:668:31)
    at Module.apply (…\relay-p13-before-c191aa29\index-old.mjs:974:8)
```

对照：

| 版本 | 同一严格 ctx 下 |
|---|---|
| `8c5c073`（修复前） | `apply` 返回 dispose，但设置卡读取 `ctx.settings` 立刻产生 **未处理拒绝** `cannot get property "settings" without inject`（栈 `mountSettingsCard:668:31` → `apply:974:8`，与宿主 crash 逐字同因）；watch 是否投递已无意义，宿主在装配期 fatal |
| `c55d7f1` + `3e9abd6`（修复后） | `apply` 不抛、无未处理拒绝、watch 真投递 1 次、`relay.log` 有「宿主无 settings 服务」；`TOTAL: 99/99 PASS` |

### 6.7 追加轮提交

- `3e9abd657ea922da4b8f706146e06d459e5af95b`（`test: cover strict ctx without settings and unresolvable schemastery`），numstat：`56	4	index.test.mjs`。
- 提交后 `git status --porcelain` 为空；未 push。
- 测试读数以提交后工作区为准：`TOTAL: 99/99 PASS`（相比追加前的 98 条，多出的是第 4 条 `P13 有 settings 但 schemastery 不可解析：warn 跳过设置卡，watch 照常投递`）。
- 提交 sha：`3e9abd657ea922da4b8f706146e06d459e5af95b`（短 `3e9abd6`）。

<!-- DONE -->
