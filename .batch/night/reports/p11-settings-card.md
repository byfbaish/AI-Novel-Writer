# P11 · 设置卡 + `exact` 开关 + 启动期有限重扫

- 卡号：P11（执行方：豆包；派卡人：AI writer 总负责人）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 开工基线：HEAD `4fb80dab206a8be9f0ab9ef0da9cfd8683cc8c96`，`git status --porcelain` 为空（已实测）
- 本卡结论：三块均已落码，`node index.test.mjs` → `TOTAL: 95/95 PASS`；未提交（提交权在负责人）
- 芯片：芯片仍为自动、因模型菜单打不开（未切换，未因此停卡）

---

## 0. 基线核验（原始输出）

```
HEAD=4fb80dab206a8be9f0ab9ef0da9cfd8683cc8c96
=== porcelain ===
（空）
基线 node index.test.mjs → TOTAL: 84/84 PASS
```

## 1. 改动文件

```
$ git -C C:\develop\workspace\dsh-handoff-relay status --porcelain
 M index.js
 M index.test.mjs
 M package.json
?? client.js

$ git diff --numstat
warning: in the working copy of 'index.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'index.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
305	8	index.js
201	1	index.test.mjs
9	0	package.json
```

`client.js` 是新文件（untracked）；按跨 agent 红线未执行任何 `git add`/`commit`，由负责人点名加入。

`source:` 行按内容比对逐字未变：

```
本机 index.js:441: source: Object.freeze({ kind: `plugin:${PLUGIN_NAME}` }),
HEAD:index.js      : source: Object.freeze({ kind: `plugin:${PLUGIN_NAME}` }),
```

## 2. A. 设置卡（形态「甲」）

### 2.1 Host 侧（`index.js`）

| 环节 | 落点 | 做法 |
|---|---|---|
| namespace 注册 | `mountSettingsCard()`，`apply()` 末尾 `void mountSettingsCard(...)` | `ctx.settings.register(SETTINGS_NS='dsh-handoff-relay', z.object({ watches: z.array(z.any()).default([]) }), { base: { watches: configWatches }, applies: 'live' })` |
| yml 播种、冲突以 yml 为准 | 同上 | 注册后读 `scope.get()`；与 `config.watches` 不深等就 `scope.update({ watches: configWatches })`（把 yml 覆盖进用户层） |
| observe → 回写 yml | `scope.watch(next => …)` | 先 `parseWatchesFromYml(磁盘)`；值深等则**不碰 yml**；不等则 `writeWatchesToYml()` |
| 回写算法 | `replaceWatchesInYml()` | 文本级：只替换**第一条** `- id: dsh-handoff-relay` 条目 `config.watches` 块；`stableMs`、注释、重复的第二条 relay 条目、后续条目逐字保留 |
| 写坏保护 | `writeWatchesToYml()` | 先算新文本 → 写 `.p11-<ms>.tmp` → rename；读/结构/写入任一失败返回 `{ok:false}`，原文件不动、临时文件删除 |
| 失败不阻塞 | 全部 try/catch → `relayLog warn` | 注册失败/schemastery 解析失败/observe 失败都只 warn，relay 主链路照跑 |

运行期仍只读 `config.watches`（`apply()` 内 `watches` 解析未改），settings 只是编辑通道，没有第二份运行时输入。

### 2.2 浏览器半身（`client.js`，手写 lazy-CJS 工厂）

- 文件首行 `window.__ModuleLoader__.load({ id: "dsh-handoff-relay", factory: (require) => { … } })`；工厂内只 `require("react")`（宿主播种），**没有** value import `dsh-client-ui-settings-plugins`，也没有引用 primitives/slots 的 JSX 运行时（全程 `React.createElement`）。
- `inject = ["slots", "settingsScope"]`；`apply(ctx)`：`ctx.settingsScope.bind({ namespace: "dsh-handoff-relay" })` → `ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({ name: "settings.plugin.item", key: SETTINGS_NS, inject: () => ({ scope }) }, RelayCard))`。
- 卡片：每条 watch 一行——目录（文本）/ 目标会话（文本 session id）/ 完成规则（`默认 | 文本 | 正则 | 关闭` 四态）/ 删除；下方「新增一行」「保存」「放弃修改」。
- 保存：先本地校验（目录绝对路径、目标非空、text/regex 非空）→ `scope.set("watches", rows)`；`dirty` 状态下不被远端快照覆盖；`snapshot.status/writable/revision` 只用于提示与禁用。
- `done` 四态映射：`default` 省略该键（Host 默认 `text: '<!-- DONE -->'`）；`off` → `null`；`text`/`regex` → `{text}` / `{regex}`。

### 2.3 包形态（`package.json`）

```json
"exports": { ".": "./index.js", "./client": "./client.js", "./package.json": "./package.json" },
"files": [ "index.js", "client.js", "cordis.patch.yml", … ],
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "inject": ["@deepseek-ai/dsh-client-ui-settings"], "platform": "web", "immediately": true }
}
```

`node --check client.js` 通过；`package.json` JSON 解析通过。

### 2.4 装载方式（宿主如何加载到 client entry）

1. `dsh` 字段声明了浏览器半身：`dsh.client.platform = "web"`、`immediately = true`，入口由 `exports["./client"] → ./client.js` 解析；
2. 加载器按该导出取到 `client.js`，其首行立即向 `window.__ModuleLoader__` 注册工厂（id=`dsh-handoff-relay`，与包名一致）；
3. 工厂只 `require` 宿主播种的 `react`，因此运行时 purity 闸（只接受播种过的 specifier）不会拦；
4. Host 侧 `apply()` 注册同名 namespace；设置页按 namespace 派发 `settings.plugin.item` keyed slot，key 匹配即渲染 `RelayCard`。

**未实机验证**（本轮禁止重启 DSH，也无法在 repo 里跑浏览器半身）：

- [不确定] 宿主是否按 `exports["./client"]` 自动发现浏览器半身（依据是 `dsh-client-ui-theme/package.json` 的既有形态，未在本机装载验证）；
- [不确定] `dsh.client.inject` 里写 `@deepseek-ai/dsh-client-ui-settings` 是否必要/正确（我按「settingsScope 服务由该包提供」推断；若宿主已有该服务，多余 inject 一般无害，但未验证）；
- [不确定] `slots.register({ name, key, inject })` 的 `inject` 返回值是否原样作为组件 props 传入（照 `dsh-client-ui-settings-plugins/lib/client.js:1301-1318` 的 card 注册写法推断）；
- [不确定] 卡片实际渲染与保存后 Host `watch` 回调的时序（无法在不重启的前提下验证）。

### 2.5 「保存 → 重启 → 生效」链上未实机验证的环节

| 环节 | 验证状态 |
|---|---|
| 保存：`scope.set('watches', ...)` 落到 Host settings 文档 | ❌ 未实机（无浏览器半身可跑） |
| Host `scope.watch` 触发 → `writeWatchesToYml` 改写 `cordis.patch.yml` | ⚠️ 仅纯函数级验证（回写/保留其它内容/失败不写坏），未在真实 profile 文件上触发 |
| 不重启时运行期是否变化 | 设计上**不变**（relay 只读 `config.watches`），未实机确认 |
| 重启后新 `watches` 生效（含新增/删除 watch、exact、done） | ❌ 未验证（禁止重启） |
| 重复 relay 条目：只改第一条的行为是否符合用户预期 | [不确定] 真实 yml 里该条目出现两次；本实现只改第一条，第二条保持原样（加载器取哪条未验证） |

## 3. B. `exact` 开关

- 解析：`apply()` 内 `rawExact` 只要出现且 `typeof !== 'boolean'` → `log warn` + `relayLog warn` + `return`（**整条 watch 跳过**：不建 watch、不投递、不退回包含匹配）。错误文案点名 `watches[i]`、`dir`、`exact` 当前值与类型。
- 匹配：`matchSessionsByTitle(ctx, title, onError, exact)`；`exact === true` 用 `title === targetTitle`，否则沿用 P6 的 `includes`（逐条未改）。
- `target` 增加 `target.exact`，`describeTargetNow` 与投递期 `resolveNow` 都用它；`false`/缺省等价于包含匹配。

## 4. C. 启动期有限重扫

- 常量：`RETRY_DELAYS_MS = [1000, 5000, 15000]`、`MAX_SCAN_ATTEMPTS = 3`、`MAX_SCAN_WINDOW_MS = 21000`。
- `startWatch()` 中仅当 `atLoad.ok === false` 才 `scheduleStartupRescans(...)`；每次尝试：`describeTargetNow().ok ? 'resolved' : 'not-found'` → 先写日志 `[dsh-handoff-relay] rescan#<N> dir=<dir> result=<...>`（INFO，走 `relay.log`）→ 成功则 `rescanOnce()`（对 `listFiles()` 逐个 `consider()`，复用投递路径）。
- 成功即 `done=true`，后续定时器清掉（最多 3 行/次加载）；`dispose()` 会 `rescans.cancel()`。无新增常驻定时器/轮询；常规投递成功仍不写 relay.log（P10 的「加载解析」行与 P9 三路径不变）。
- P10 的首事件全量重扫 latch 保留（与 P11 定时重扫并用；`delivered` 去重保证只投一条）。

## 5. 判据自查

```
$ node index.test.mjs
…
PASS  P11 exact 缺省=包含匹配：标题命中多条时按原语义跳过（不投递）
PASS  P11 exact=true 完全相等：只命中同名会话并正常投递移走
PASS  P11 exact 非布尔：报错并跳过整条 watch（连加载解析行都没有）
PASS  P11 重扫第 1 次即 resolved：只写 1 行 rescan#1、只投一次
PASS  P11 重扫第 2 次 resolved：rescan#1 not-found 在前、rescan#2 resolved 在后
PASS  P11 重扫 3 次全败：恰好 3 行 rescan#、顺序 1→2→3 且均为 not-found
PASS  P11 保存回写：只改 relay 条目 watches，stableMs/注释/重复条目/后续条目逐字保留
PASS  P11 保存回写：解析回来与写入值深比较相等（含 exact / done 四态）
PASS  P11 保存不改值：写回再解析与原解析结果深比较相等
PASS  P11 保存失败不写坏 yml：文件结构不匹配时返回 ok:false 且原文件逐字不变
PASS  P11 真实链路：rescan# 行带 dir 与 result，最多 3 条/次加载
TOTAL: 95/95 PASS
RESULT: PASS
```

- 原有用例一条未删（84 → 95，全部为追加；无被退役机制）。
- 新增覆盖：`exact` 三态；重扫 1/2/3 次与 `rescan#` 顺序；保存回写深比较；保存不变值；保存失败不写坏 yml；真实链路 rescan 日志。
- `git status --porcelain` 只有本卡确实改过的 `index.js` / `index.test.mjs` / `package.json` 与新增 `client.js`；未碰 README、`source:`、`delivered/` 清理、`stableMs`、`takeDelivered` 语义；未重启 DSH、未往任何 watch 目录丢测试文件（全部用 `os.tmpdir()`）。

## 6. 不确定 / 未验证汇总（便于 QA 定向复验）

1. `@deepseek-ai/schemastery` 的解析：实现用 `await import('@deepseek-ai/schemastery')`，失败只 warn 不挂卡。本机 repo 无 `node_modules`，profile 的 `node_modules/@deepseek-ai/schemastery` 存在——**插件运行时能否解析到它**未实机验证。[不确定]
2. 卡片渲染、`settingsScope` 往返、保存后 `watch` 触发回写：均未实机验证（禁止重启 DSH）。
3. 真实 `cordis.patch.yml` 的 relay 条目重复两次：本实现只改第一条，未验证加载器实际取哪条。[不确定]
4. 回写是文本级 YAML 子集重写（只支持本插件自己的字段与缩进）；若用户手工改过该块的注释/锚点，会被重排。[已知限制，不属 bug]
5. 本轮**未**对真实 profile 的 `cordis.patch.yml` 做任何写入（只改了 repo 内代码与测试）。

<!-- DONE -->
