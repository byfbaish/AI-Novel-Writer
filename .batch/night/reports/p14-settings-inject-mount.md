# P14 · 设置卡改用 `ctx.inject(['settings'], cb)` 挂载

- 卡号：P14-settings-inject-mount（执行方：豆包；派卡人：AI writer 总负责人）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 基线：HEAD `3e9abd6`，porcelain 空，`node index.test.mjs` = 99/99
- 结果：已实现并提交；`TOTAL: 111/111 PASS`；提交后 porcelain 空
- 提交：`2ea6b5397deb9637edc1aea013fa2a8ed7b66e6e`（`feat: mount the settings card through ctx.inject so provider order does not matter`，`31/4 index.js`、`236/1 index.test.mjs`）+ `26ba94c7444ad014306db2fae522220f86c7c366`（`fix: resolve schemastery from the host profile root`，`23/3 index.js`、`26/31 index.test.mjs`）
- 未 push、未重启 DSH、未启用插件；`inject` 仍是 `export const inject = ['agents'];`

## 0. 前置取证：宿主的 schemastery 在哪（已被追加卡定论修正）

- `C:\develop\software\DeepSeekHarness\resources\app.asar` 存在（213,202,918 B）。只读解析 asar 清单（`%TEMP%\asar_scan_p14.py`，4+4 字节头 + JSON，不改文件）能看到 `dsh/node_modules/@deepseek-ai/schemastery` 等同名条目 —— 但**这只是 asar 归档内的清单条目**，对应的文件系统路径 `C:\develop\software\DeepSeekHarness\resources\app.asar\dsh\node_modules\...` `Test-Path` 为 **False**（asar 是单个文件，不是目录）。
- 追加卡给出的定论更关键：`C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\@deepseek-ai\schemastery\package.json` **存在**（`@deepseek-ai/schemastery@3.19.0`），本机实测 `createRequire(<profile>/package.json).resolve('@deepseek-ai/schemastery')` → `C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\@deepseek-ai\schemastery\lib\index.cjs`；同一句以仓库 `package.json` 为基线 → `MODULE_NOT_FOUND`。

结论：**不是缺依赖，是解析基线站错**。插件按真实路径 `C:\develop\workspace\dsh-handoff-relay` 加载，Node 从插件目录往上找 `node_modules`，走不到 profile 那一份。本轮已把基线换成 profile 根（见 §3）。按卡面要求**没有**改 `package.json`、**没有** `npm install`。

## 1. 改法与依据

`apply()` 里原来是 P13 的：

```js
void mountSettingsCard(ctx, JSON.parse(JSON.stringify(watches)), stateDir)
  .catch((err) => relayLog(...));
```

现在（`index.js:993-1023`）：

```js
const watchesCopy = JSON.parse(JSON.stringify(watches));
const cardError = (err) => relayLog(ctx, stateDir, 'warn', `[${PLUGIN_NAME}] 设置卡未挂载：意外异常（${String(err)}）`);
const mountOnReady = (c) => Promise.resolve()
  .then(() => mountSettingsCard(c, watchesCopy, stateDir))
  .catch(cardError);

let injectFn = null;
try {
  if (ctx && typeof ctx.inject === 'function') injectFn = ctx.inject.bind(ctx);
} catch { injectFn = null; }              // 严格 ctx 连方法读取都可能抛
if (injectFn) {
  let fiber;
  try {
    fiber = injectFn(['settings'], (c) => {
      try { mountOnReady(c); } catch (err) { cardError(err); }   // 回调体异常不抛回 cordis
    });
  } catch (err) {
    cardError(err);
    mountOnReady(ctx);                    // inject 自身不可用 → 退回 P13 降级路径
  }
  if (fiber && typeof fiber.catch === 'function') fiber.catch(cardError);   // 只挂 .catch，绝不 await
} else {
  mountOnReady(ctx);
}
```

三个要点：

1. **依赖就绪回调**：`ctx.inject(['settings'], cb)` 等价于开一个子 plugin fiber（developer 读 `cordis/lib/index.js:1599-1604` 的结论），settings 先到/后到都只在就绪时触发一次；不写进 required `inject`。
2. **绝不 await**：fiber 是 thenable（`await` 会等到加载结束，settings 永不到来会挂住启动链），这里只 `fiber.catch(cardError)`，是 fire-and-forget。
3. **P13 的 try/catch 原样保留**：`getService` 与「宿主无 settings 服务 → warn 跳过」的降级路径没删；取 `ctx.inject` 本身也包了 try/catch（严格 ctx 读方法会抛）。
4. **schemastery 换基线（追加卡）**：`mountSettingsCard` 不再 `await import('@deepseek-ai/schemastery')`（那按插件真实路径解析，必失败），改走 `loadSchemastery()`：

```js
function loadSchemastery() {
  const baseFile = path.join(profileRootDir(), 'package.json');
  const req = createRequire(baseFile);
  const resolved = req.resolve('@deepseek-ai/schemastery');
  const mod = req('@deepseek-ai/schemastery');
  return { z: mod && (mod.default || mod), resolved };
}
```

   解析成功时写一行 INFO：`设置卡 schema 基线=<profile>/package.json resolved=<index.cjs 绝对路径>`，真机看这一行就能区分「时序没修好」还是「基线错」。

## 2. 时序覆盖（用例原文与断言点）

用例在 `index.test.mjs:2075-2279`。为了让「卡真的注册」可断言，用 `node:module` 的 `registerHooks`（`:39`）在该 specifier 上临时指向一个最小 z 实现（`:27-38` 生成在 `os.tmpdir()/relay-p14-*` 下），**只在 `schemaStubEnabled=true` 时生效**，P13b 仍走真实失败路径。

### 2.1 settings 先就绪（`index.test.mjs:2110-2144`）

假 ctx 的 `inject(deps, cb)` 直接同步执行 `cb(child)`，child 的 `get('settings')` 返回带 spy `register` 的 api。

断言点：

- `:2119` `P14 ① settings 先就绪：inject 声明的依赖正确，register 恰好 1 次` —— `deepEqual(injectDeps, ['settings'])`、`reg.length === 1`、schema 非空。
- `:2124` `服务对象非 undefined（不是只触发回调）` —— register 是挂在 api 上的 spy，只有 `mountSettingsCard` 真拿到该对象并调用它的方法才会命中；同时断言 `relay.log` 不含「无 settings 服务」、`fiber.catch` 已挂。
- `:2135` `watch 照常投递` —— 真写 `p14a.txt`、真实 `fs.watch` 回调、`calls.length === 1`、源文件移走。

### 2.2 settings 后到（`index.test.mjs:2150-2188`）

`inject` 只登记回调不执行；apply 返回后先断言 `reg.length === 0`（`:2168`），再 simulate `provide`：调用登记的回调，把带 settings 的 child 交给它；随后**轮询** `p14WaitFor(() => reg.length > 0, …, 3000)`（`:2174`，内部 10ms 轮询 + 3s 上限），**没有固定 sleep**。就绪后 `:2175` 断言 `register` 恰好 1 次，`:2182` 断言 watch 真投递。

### 2.3 无 settings 服务（`index.test.mjs:2196-2235`）

`inject` 立即回调、child 的 `get('settings')` 为 `undefined`：`:2214` 断言 `apply` 不抛；`:2218` 轮询 `relay.log` 出现「无 settings 服务」；`:2221/:2228` 断言 watch 照常投递、文件移走。

### 2.4 schemastery 解析不到（P13 已有，保留）

`P13 有 settings 但 schemastery 不可解析：warn 跳过设置卡，watch 照常投递`（`index.test.mjs:2033` 起）仍 PASS：settings 存在但 import 失败 → `无法解析 @deepseek-ai/schemastery` warn，watch 照常。

### 2.5 回调体抛错（`index.test.mjs:2244-2278`）

`inject` 返回的 fiber 被 reject（`catch(fn)` 立即用 `new Error('回调体抛错（P14 模拟）')` 调用）——等价于回调体抛错被 cordis 判为 fiber 失败：

- `:2263` 断言 `apply` 不抛、`relay.log` 含 `设置卡未挂载：意外异常`；
- `:2271` 断言 watch 照常启动并投递。

### 2.6 严格 ctx 不出现 `cannot get property … without inject`

P13 严格 ctx 用例（只给 `agents`/`logger`/`effect`，访问未声明属性即抛）继续 PASS，并在 `index.test.mjs:1984` 那条断言里补了一句：`!warnings.some(w => w.includes('without inject'))`。实现里对 `ctx.inject` 的读取也包了 try/catch，所以严格 ctx 走 `injectFn === null` 的降级分支，`watch` 照常启动并投递。

## 3. schemastery 基线

**实际走的基线：profile 根**（`<profile>/package.json`），用 `createRequire` 解析，不用 `import` 的插件路径基线。

路径原文（本机实测，只读）：

```
基线文件：C:\Users\<用户名>\.dsh\profiles\desktop\package.json
解析结果：C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\@deepseek-ai\schemastery\lib\index.cjs
```

实现（`index.js` 的 `loadSchemastery()`）：

```js
const baseFile = path.join(profileRootDir(), 'package.json');
const req = createRequire(baseFile);
const resolved = req.resolve('@deepseek-ai/schemastery');
const mod = req('@deepseek-ai/schemastery');
```

为什么选这条：另一条「从宿主给的服务里取 schema 构造器」在本轮读取的文件内**未找到**对应的服务接口/导出（本轮只看到 `settings.register` 收 schema，没看到宿主暴露 schemastery 构造器），而 `createRequire(<profile>/package.json)` 与宿主安装位置完全一致、无需改 `package.json`、无需装依赖。`profileRootDir()` 已支持 `DSH_PROFILE_DIR` 覆盖，测试就是用它把基线指到临时 profile。

测试里同一行断言（`index.test.mjs` 的 `P14 ① schemastery 走 profile 基线解析（不是插件真实路径）`）：在临时 profile 的 `node_modules/@deepseek-ai/schemastery/` 放一个最小 CJS 桩，断言 `relay.log` 里同时出现 `基线=<临时 profile>/package.json` 与 `resolved=<临时 profile>/node_modules/@deepseek-ai/schemastery/index.cjs`——证明解析真的从 profile 根出发，而不是插件真实路径。

真机验收若「页面无卡」，先看 relay.log 这一行：没有 `resolved=` 就是基线/包装载问题；有 `resolved=` 但没有卡片，才是挂载时序或客户端问题。

## 4. P13 遗留：临时目录清理与残留

- P13（`index.test.mjs:1944-2006`）与 P13b（`:2008-2072`）、P14 四条用例的清理都写在各自的 `finally`：`fs.rmSync(d/root, { recursive: true, force: true })`，中途抛错也会执行。
- 本轮起测前 `%TEMP%` 有两个历史残留（`relay-p13-gti63o`、`relay-p13-sZDFDV`，来自早前崩中断的运行，那时清理还没进 finally），已删除；另有一个 `relay-p14-X9BKYs` 来自 16:28 那次严格 ctx 中断的运行（进程直接退出，全局清理没跑到），一并删除。
- **提交后跑完一轮**实测：

```
=== 跑完 TEMP 残留 ===
(无 relay-p13-* / relay-p14-*)
```

## 5. 判据自查

```
$ node index.test.mjs
PASS  P13 严格 ctx：apply 不抛（未声明 settings 也不会同步崩）
PASS  P13 严格 ctx：watch 照常启动并投递（设置卡缺席不阻断主链路）
PASS  P13 严格 ctx：relay.log 写明「宿主无 settings 服务」
PASS  P13 有 settings 但 schemastery 不可解析：warn 跳过设置卡，watch 照常投递
PASS  P14 ① settings 先就绪：inject 声明的依赖正确，register 恰好 1 次
PASS  P14 ① settings 先就绪：服务对象非 undefined（不是只触发回调）
PASS  P14 ① schemastery 走 profile 基线解析（不是插件真实路径）
PASS  P14 ① settings 先就绪：watch 照常投递
PASS  P14 ② settings 后到：启动时服务未就绪，register 尚未发生
PASS  P14 ② settings 后到：服务到达时挂卡，register 恰好 1 次
PASS  P14 ② settings 后到：watch 照常投递
PASS  P14 ③ 无 settings：apply 不抛（服务缺席只降级）
PASS  P14 ③ 无 settings：warn 跳过设置卡，watch 照常投递
PASS  P14 ③ 无 settings：watch 真的投递了文件
PASS  P14 ④ 回调体抛错：apply 不 fatal，异常只落 relay.log warn
PASS  P14 ④ 回调体抛错：watch 照常启动并投递
TOTAL: 111/111 PASS
RESULT: PASS
```

- `TOTAL:` 111 ≥ P13 的 99；原有 99 条一条未删（新增 11 条：P14 四场景 10 条 + schemastery 基线断言 1 条；另 P13 严格 ctx 断言加严 1 处）。
- 提交前 `git status --porcelain` 原文（正好两个 M，无 `??`）：

```
 M index.js
 M index.test.mjs
```

- `git show --numstat`：

```
23	3	index.js
26	31	index.test.mjs
```

（上一提交 `2ea6b53` 的 numstat 为 `31/4 index.js`、`236/1 index.test.mjs`。）

- `source:` 逐字不变：`source: Object.freeze({ kind: \`plugin:${PLUGIN_NAME}\` }),`
- `inject` 未改：`export const inject = ['agents'];`

## 6. 未验证 / 风险（按反例口径必须写清）

- **「设置页必须看见那张卡」本轮未实机验证**：卡面禁止重启 DSH、禁止启用插件，无法用隔离 profile 加载后看真机。按产品经理 §9 口径，这一条**现在不能算通过**——只做到「不崩 + 单测证明注册链路」。
- 解析风险已从「基线错」降为「profile 路径是否指对」：本机实测以 `C:\Users\<用户名>\.dsh\profiles\desktop\package.json` 为基线能解析到 `…\lib\index.cjs`；真机若 `DSH_PROFILE_DIR`/`DSH_PROFILE` 与宿主实际 profile 不一致，会解析不到并 warn 跳过（不 fatal）。这一条未在真机验证，标**不确定**。
- `ctx.inject` 在真实 cordis 里返回 fiber 的 `.catch` 可用性：本轮按 developer 读源码结论实现并用假 fiber 覆盖，**不确定**真实 fiber 是否同形（若只有 `then` 没有 `catch`，实现里 `typeof fiber.catch === 'function'` 的判定会跳过挂接，异常仍会在 cordis 侧升级——这是需要在真机验收时盯的残余风险）。

## 7. 收尾

- 提交 `26ba94c`（基线修正，含上一提交 `2ea6b53`），未 push；提交后 porcelain 空。
- 未动 `client.js`、`package.json`、README、`cordis.patch.yml`；未加 tag、未改版本号。

<!-- DONE -->
