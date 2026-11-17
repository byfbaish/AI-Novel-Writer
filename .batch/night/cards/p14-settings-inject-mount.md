# P14 · 设置卡改用 `ctx.inject(['settings'], cb)` 挂载（P13 PASS 后投出，未投前勿动）

## 0. 背景（一句话）

P13 修掉了「访问未声明服务 → 宿主 fatal 崩溃」，但用 `ctx.get('settings')` 在启动期取服务，服务提供方 fiber 未 active 时返回 `undefined`，会退化成「设置卡永远挂不上」的静默失效。P14 把挂卡方式换成按依赖就绪回调挂载。

## 1. 目标

设置卡在 settings 服务**就绪时**挂上（无论它先到还是后到）；服务不存在时只降级 warn、watch 照常；仍不许出现任何 fatal。

## 2. 必做

0. **前置（先做，做不到就照实报，别硬试）**：插件目录里 `@deepseek-ai/schemastery` 目前报 `ERR_MODULE_NOT_FOUND`。**已查清的真相（以此为准，别再当"缺依赖"处理）**：它不是装不上，是解析基线站错了——`C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\@deepseek-ai\schemastery\package.json` 存在（`@deepseek-ai/schemastery@3.19.0`），在 profile 目录 `require.resolve` 成功（`…\lib\index.cjs`），在仓库目录 `C:\develop\workspace\dsh-handoff-relay` 同一句 `MODULE_NOT_FOUND`；因为插件是按真实路径被加载的，Node 从仓库往上找 `node_modules` 永远到不了 profile。

   所以：**不许改 `package.json`、不许 `npm install` 往仓库塞依赖**（装进仓库还会把 junction 写脏）。正解是换解析基线：用 `createRequire(path.join(<profile 根>, 'package.json'))` 去解析，或者改从宿主给的服务里取 schema 构造器。这条是本卡 §2.0 的要求；报告里必须写明**实际走的是哪条基线**，因为真机「页面无卡」时靠这一行才能区分"时序没修好"和"解析基线错"。

1. `apply()` 里把 `void mountSettingsCard(...)` 换成依赖就绪回调：
   `ctx.inject(['settings'], (c) => { mountSettingsCard(c, watchesCopy, stateDir); })`
   —— 注意回调体内异常要自己接住（`.catch` 或 try/catch），不许抛回 cordis。
   **依据（developer 读 cordis 源码实测）**：`ctx.inject(inject, callback)` 等价于 `this.plugin({inject, apply: callback})`（`cordis/lib/index.js:1599-1604`），开的是一个子 plugin fiber；回调体未捕获抛错同样升级成 `fatal load failure`。**P13 的整段 try/catch 必须原样保留在回调里**，不许因为「已用 inject 声明依赖」就省略。
   另：该调用返回的 fiber 带 `then`，注释写明「awaiting it settles once loading finished」（`:1636-1639`），**`apply` 里绝对不能 `await` 它**——settings 永不到来时会永远挂着拖住启动链；只能 fire-and-forget + `.catch`（不要用 `void`）。
2. `inject` 清单**保持不变**（仍是 `export const inject = ['agents']`），不许把 `settings` 写进 required。
3. 保留 P13 的 `getService` 与 warn 降级路径：回调里若仍取不到服务，warn 跳过，不得崩。
4. 保留 `schemastery` 解析失败 → warn 跳过卡片的路径（P13 已有，勿回退）。
5. 报告写明：settings 先到 / 后到两种时序各自如何挂上（贴用例原文与断言点）。
6. 顺手修 P13 遗留：临时目录清理搬进统一 `finally`（现在清理写在用例体内，用例中途抛错就漏删，会留 `%TEMP%\relay-p13-*`），并在报告里附「跑完 `%TEMP%` 无 `relay-p13-*` 残留」的实测。

## 3. 边界

- 只改 `index.js`、`index.test.mjs`、报告；不碰 `client.js`、`package.json`、README、cordis.patch.yml。
- `git add` 只点名这两个文件；禁用 `git add -A`。
- 禁重启 DSH；禁往 7 条 watch 目录丢文件；测试临时目录只用 `os.tmpdir()` 派生（不在仓库内 / 不在 watch 内 / 不在 `~\.dsh` 内，三条各自可否证）。
- 不提交 tag、不 push、不改版本号。

## 4. 判据

- `node index.test.mjs` 全绿，贴 `TOTAL:` 行原文（读数 ≥ P13 的 99）。
- 新增/修改用例覆盖：① settings 先就绪 → 回调立即挂卡；② 先调用 inject、settings 后到 → 到达时挂卡；③ 无 settings 服务 → warn + watch 仍启动、无异常。
- ①② 每条都必须**断言到卡片真的注册了**，不能只断言回调被调用：用 spy 断言 `settings.register` 恰好被调用一次，且回调内取到的服务对象不是 `undefined`（只断言「回调触发」时，用 `ctx.get` 也能通过，正是要消除的静默失效）。
- 「settings 后到」那条**不许用固定 sleep**：先 `inject` 再 `provide`，用轮询 `await` 一个 flag 判就绪，避免时序抖动导致的假绿。
- 另加一条用例：回调体里抛错时，`apply` 不报 fatal（异常被接住/降级 warn），watch 照常启动。
- 严格 ctx（只给 `agents`/`logger`/`effect`）启动一次，不得出现 `cannot get property ... without inject`。
- 跑完 `git status --porcelain` 只有两个 `M`，无 `??`。

## 4b. 验收反例（产品经理 §9 原文口径）

**「P13 全绿 + 不崩 + 页面无卡 = 未通过」**：只做到不崩不清算过；真机验收时隔离 profile 加载后，设置页必须出现那张卡，看不到就按失败计。

## 5. 交付

- 报告：`.batch/night/reports/p14-settings-inject-mount.md`，末行 `<!-- DONE -->`，附命令原文与读数。
- 信号：`.batch/night/signals/doubao/p14-settings-inject-mount.done`。
- 估时：40–60 分钟。

## 6. 红线

- 不改已发布事实（tag/master 不动）。
- 不写进 required inject。
- 任何一步异常先停手贴日志，不自行重试第二次。
