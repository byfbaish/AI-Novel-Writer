# B11 实机计数探针 · 结论（Lead 自做，2026-11-11 晚班）

> 基准：`exp/resource-ledger` @ `52c3e5cb`；单轮 dev（vite 5180 + CDP 9222，`AI_NOVEL_UI_DEBUG_PORT=9222` 直跑 `node_modules/vite/bin/vite.js`）。
> 任务书：`.batch/night/b11-probe-prompt.md`（T1）。**runbook §B.5 与 `M1-M2-runbook.md` 已被 19:2x `clean -fd` 删除，本轮自建探针。**

---

## 1. 结论（2026-11-11 复核后**收敛**）

**计数结论成立：三时刻 `live` 稳定 = 1。但「判 A」只是推定，本轮未坐实，不足以结案。**

三时刻读数（`on=4, off=3, live=1`），无抖动、无增长：

| 候选 | 实机证据是否支持 | 说明 |
|---|---|---|
| **A** 测试自写合成 Workspace 与 `RendererStartup.tsx:44` 让位 effect 订同一 channel | **仅推定，未证实** | 生产恰 1 个订阅是观测事实；「测试里那 2 个来自夹具」没有在夹具内打点，属按任务书判据的反推 |
| **B** `TitleBar.tsx:75` 启动期未卸载、让位 effect 又订一次 | **否定** | 若成立，启动后应稳定 2；实测 T1 即 1，且开项目后仍 1 |
| **C** `ipc.on` unsubscribe 真泄漏（⇒ 关窗丢未保存正文） | **实机路径否定，但不能全否** | 三时刻 `off=3` 与 `on=4` 配对、`live` 未累积；但只覆盖生产路径，测试路径的 2 未解释 |

### 1.1 为什么「稳定 1」不能直接推出「夹具缺陷」

两处生产订阅点是**结构性互斥**的，不是「都该挂上」：

```ts
// RendererStartup.tsx:41
if (Workspace || !ipc.isElectron) return   // Workspace 一挂载就让位
```

`TitleBar` 以 `[]` 依赖常驻订阅，`RendererStartup` 在 `Workspace` 未挂载时订阅、挂载后 cleanup。
所以**稳态 1 是预期值**——它既不能证明「泄漏不存在」，也不能证明「夹具多订」；
它只能说明生产此刻恰好是那一个。

真正需要解释的是**差异本身**：生产稳定 1，browser 测试实测 2。这个 2 至今没有解释，
而它正是任务书 A 支要解释的东西。本轮把「1」当成了对 A 的确认，逻辑上不成立。

事件序列本身**是可解释的**：T1 的 `4 on / 3 off / live=1` 与「StrictMode 双跑 effect + `Workspace` 挂载时父 effect 先 cleanup」完全吻合
（`1885ms off → 1886ms on` 即父 cleanup 早于子 mount）。所以生产侧的计数与顺序都自洽。

不可解释的是**另一件事**：同一 React 语义下，`RendererStartup.browser.tsx` 里该 channel 实测到 **2**。
夹具的 `on` mock 返回的是 `listeners.delete`（`RendererStartup.browser.tsx:114-115`），cleanup 路径本身看不出缺陷
⇒ 这个 2 至今没有机制能解释，而它正是任务书要求 A 支去解释的对象。本轮把「生产 = 1」当成了对 A 的确认，逻辑上不成立。

### 1.3 已排除的一个假设（省下一轮试错）

最容易想到的解释是「夹具走 `loadWorkspace` 异步加载，生产走 `Workspace` prop，所以让位 effect 没退订」。**这个假设不成立**：
`Workspace` 是 `RendererStartup` 的**内部 `useState`**（`RendererStartup.tsx:31`），由 `loadWorkspace()` 返回值设置；
生产入口 `src/main.tsx:23` 用的是 `<RendererStartup />`（默认 `loadApp`），**与测试走同一条加载路径**。
所以两者在「让位」这件事上代码完全一致，差异只能出在夹具里那个 fake Workspace 自己又订了一次、以及订阅数统计的口径上。
要坐实，必须在该夹具内对 `ipc.on` 打点（本轮未做，且会触碰测试文件，需「可改码」授权）。

断言位置更正（digest 曾写 `:138`）：该用例两处 `expect(listeners.size).toBe(1)` 分别在 `:130` 与 **`:137`**；
`:138` 是 `invoke.mockClear()`。

### 1.2 探针自身有一处失效字段（本轮未察觉，复核发现）

`b11-probe-v2.mjs:54` 判定写的是：

```js
hasTitleBar: !!document.querySelector('header, [data-testid="titlebar"]')
```

而 `TitleBar` 根元素是 `<div className="writer-topbar no-select ...">`（`TitleBar.tsx:216`），
**既不是 `header` 也没有 `data-testid`** ⇒ 该字段恒为 `false`，是无效诊断量。
T2/T3 输出 `hasTitleBar:false`，但同一份 `bodyHead` 里就有「AI小说作家 AI Novel Writer 当前项目…」的 TitleBar 文案，自相矛盾。
T1 的 `true` 命中的是别处某个 `<header>`，同样不代表 TitleBar 存在。

⇒ 这不影响 `live` 计数（计数走 `ipc.on` 包装，与选择器无关），但报告里不该把 `hasTitleBar` 当证据用。

按任务书 `:35` 的口径，A 支要求「改测试、不动产品」；**本轮未改任何断言与产品码**（「可改码」授权未启用）。

⚠️ 判据边界：本探针只能证明**生产运行时**的 `window:close-requested` 订阅数为 1；「browser 测试中的第 2 个订阅一定来自合成 Workspace」是按任务书 A 支做的**推定**，不是本次实机直接观测。要直接坐实，需在 vitest browser 夹具里对同一 channel 打点（本轮未做，见 §4）。

---

## 2. 采集方式与原始输出

### 2.1 为什么换探针落点（v1 失败）

计划 §2.2 原定用 `context.addInitScript` 包 `window.aiNovelAPI.on`，**实测不可行**：

- `.tmp-ui/b11-diag.mjs`：`patched=true` 但 `on:0 / off:0 / live:0`，`onSrc = "function () { [native code] }"`。
- `.tmp-ui/b11-diag2.mjs`：`{ "onSrc":"function () { [native code] }", "onWritable":false, "onConfigurable":false, "apiFrozen":true, "apiSealed":true }`。
- `.tmp-ui/b11-diag3.mjs`：`window.aiNovelAPI` 自身 `{ "writable":false, "configurable":false, "enumerable":true, "hasGet":false, "hasSet":false }`，且 `canRequire:"undefined" / hasIpcRenderer:"undefined" / hasElectron:"undefined"`。
- `.tmp-ui/b11-cdp-ctx.mjs` / `b11-cdp-iso.mjs`：所有 CDP execution contexts（含 `Electron Isolated Context`、`__playwright_utility_world_page@…`）都无 `require` / `ipcRenderer` / `process` / `Buffer`，直接取 `ipcRenderer.listenerCount` 这条路走不通。

⇒ v1 的 `patched:true` 是**假阳性**（赋值静默失败）。

### 2.2 v2 可行方案

改包 Vite dev 模块层：`src/services/ipc-client.ts` 的 `export const ipc = { … }` 是普通可写对象，且 `ipc.on` 是全部生产订阅点的唯一入口（`RendererStartup.tsx:44`、`TitleBar.tsx:75`）。

`.tmp-ui/b11-probe-v2.mjs` 在 `context.addInitScript` 里：

```js
const KEY = 'window:close-requested'
const state = { ready:false, patched:false, on:0, off:0, live:0, events:[], error:null }
window.__b11Probe = state
import('/src/services/ipc-client.ts').then(m => {
  const target = m.ipc
  const orig = target.on
  const wrapped = function (channel, cb) {
    const unsub = orig.call(target, channel, cb)
    if (channel === KEY) {
      state.on += 1; state.live += 1
      state.events.push({ t: Date.now(), k: 'on', live: state.live })
      return function () {
        state.off += 1; state.live -= 1
        state.events.push({ t: Date.now(), k: 'off', live: state.live })
        return unsub()
      }
    }
    return unsub
  }
  target.on = wrapped
  state.patched = target.on === wrapped
})
```

`page.reload()` 后按 T1 → 点「进入作品」→ T2 → 造外观写入失败 → T3 顺序取数。三时刻 `ready:true / patched:true / error:null`，说明 React 挂载发生在 patch 完成之后，订阅未漏采。

### 2.3 T3 触发方式原文

```js
localStorage.setItem('ai-novel-writer-appearance', '外部变化')
const mod = await import('/src/stores/appearance-bootstrap.ts')
updateResult = mod.useAppearanceStore.getState().update({ colorTheme: 'dark' })
phase = mod.useAppearanceStore.getState().phase
```

`src/stores/appearance-bootstrap.ts:87` 比对 `storage.getItem(...) !== acknowledgedRaw` ⇒ 抛 `APPEARANCE_CHANGED_EXTERNALLY` → `block()` → `update` 返回 false。实测原文：

```json
{ "updateResult": false, "phase": "blocked", "err": null,
  "stored": "外部变化", "notice": null, "shellStillMounted": true }
```

（页面文案「外观偏好尚未安全保存，已保留原设置。请重试；当前工作台保持原状。」出现在 T3 的 `bodyHead`；`[role="alert"]` 选择器未命中，故 `notice` 字段为 null。）

---

## 3. 三时刻读数（分开列，逐字原文）

### T1 · 启动完成后

```json
{
  "probe": {
    "ready": true,
    "patched": true,
    "on": 4,
    "off": 3,
    "live": 1,
    "events": [
      { "t": 1794400180288, "k": "on",  "live": 1 },
      { "t": 1794400180289, "k": "off", "live": 0 },
      { "t": 1794400180289, "k": "on",  "live": 1 },
      { "t": 1794400181885, "k": "off", "live": 0 },
      { "t": 1794400181886, "k": "on",  "live": 1 },
      { "t": 1794400181889, "k": "off", "live": 0 },
      { "t": 1794400181891, "k": "on",  "live": 1 }
    ],
    "error": null
  },
  "shell": "writer",
  "hasTitleBar": true,
  "bodyHead": "旧来源已保留，后续修改需明确导入，当前不会自动回灌。... 当前项目： 未打开项目 ..."
}
```
截图：`.runtime/night/20261111/b11-v2-t1.png.png`（1,334,470 B，文件名因脚本 `name` 自带 `.png` 又拼了一次后缀）。

`open-project: {"clicked":true}`（点书架卡片「进入作品」）。

### T2 · 打开一个项目后

```json
{
  "probe": { "ready": true, "patched": true, "on": 4, "off": 3, "live": 1 },
  "shell": "writer",
  "hasTitleBar": false,
  "bodyHead": "AI小说作家 AI Novel Writer 当前项目： 师父派我来除魔，幕后真凶竟 是小师妹 ... 项目结构 ..."
}
```
截图：**未取到** —— `screenshot b11-v2-t2.png skipped: TimeoutError: page.screenshot: Timeout 10000ms exceeded.`
证据形态 = CDP 求值原文 + `bodyHead` 原文（无截图）。

### T3 · 外观损坏静默恢复路径

```json
{
  "probe": { "ready": true, "patched": true, "on": 4, "off": 3, "live": 1 },
  "shell": "writer",
  "hasTitleBar": false,
  "bodyHead": "外观偏好尚未安全保存，已保留原设置。请重试；当前工作台保持原状。 AI小说作家 AI Novel Writer 当前项目： 师父派我来除魔，幕后真凶竟是小师妹 ..."
}
```
截图：**未取到** —— `screenshot b11-v2-t3.png skipped: TimeoutError: page.screenshot: Timeout 10000ms exceeded.`
证据形态 = CDP 求值原文 + `update` 返回 false 原文 + `bodyHead` 原文（无截图）。

**汇总表**

| 时刻 | on | off | live | shell | 截图 |
|---|---|---|---|---|---|
| ① 启动完成后 | 4 | 3 | **1** | writer（hasTitleBar=true） | 有 |
| ② 打开项目后 | 4 | 3 | **1** | writer（hasTitleBar=false） | 无（超时） |
| ③ 外观写入失败 | 4 | 3 | **1** | writer（hasTitleBar=false） | 无（超时） |

---

## 4. 未做项与不确定

1. **T2/T3 截图缺失**：`page.screenshot` 两次 10s 超时（v1 的 T2 曾 30s 超时）。本轮不给这两时刻补截图，避免再起 dev 轮次；三时刻结论以 CDP 求值原文为准。若作者要求截图级证据，需另开一轮 dev 仅补拍。
2. **A 支为推定**：生产 1 个订阅是直接观测；「第 2 个订阅来自合成 Workspace」是任务书判据推定，未在该夹具内打点坐实。
3. **探针覆盖面**：只拦 `window:close-requested` 一个 channel；`import()` 为异步，理论上可能漏掉 patch 完成前的订阅。但 `patched:true` 且 T1 已捕获 4 次 `on` / 3 次 `off`（含启动期让位 effect），未见漏采迹象。
4. **T3 状态污染**：本轮把 `localStorage['ai-novel-writer-appearance']` 覆写为 `外部变化`、store `phase='blocked'`。原值未备份（T3 前未留快照）；A2/B16 前用「写回合法 profile + reload」恢复，并在恢复脚本里输出 `phase` 复核，见 `.runtime/night/20261111/…` 后续产物。
5. **runbook 缺口**：`.batch/night/b11-probe-prompt.md:32` 仍引用已删除的 `wt-2\.batch\night\M1-M2-runbook.md` §B.5，需回填 digest §6 与 `docs/agents/` 手册勘误（阶段 4）。
6. **不改产品**：按任务书红线，本轮不改 `RendererStartup.browser.tsx:138` 断言、不动产品码。

## [T1] DONE
