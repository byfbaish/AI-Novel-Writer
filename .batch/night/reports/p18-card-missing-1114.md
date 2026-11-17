# P18 · 设置页「无卡」取证报告（只读取证，未改码、未重启、未碰远端）

- 卡号：P18
- 派单人：AI writer总负责人
- 取证时刻：2026-11-14 04:0x（本地，UTC+8）
- 授权范围：只读取证（不改码 / 不重启 / 不打 tag / 不推送）
- 对象：dsh-handoff-relay 在 DSH 桌面壳 0.2.2-rc.1 中「设置 → 插件 → 已安装 → 点开插件」无设置卡
- 取证根：`C:\develop\software\DeepSeekHarness\resources\app.asar`（213,202,918 B，22,102 entries），解包工具 `C:\develop\workspace\AI-writer\develop\.batch\night\tools\asar-scan.py`

## 一句话结论

**属「位置/筛选不对」，不是「注册没生效」**：relay 注册的槽位 `settings.plugin.item` 在 0.2.2-rc.1 的 213MB 前端 bundle 里**一次都没出现**（0 命中），宿主侧 `settings.register(...)` 这个 API 在本版本也**不存在**；本版本第三方插件出设置卡的正确入口是 client 注册 `plugins.row.config`（key=`包名#条目id`）+ `plugins.item`，host 只需声明 `Config` 且字段带 `.volatile()`。详见第 3 项与「根因链」。

## 第 1 项：relay.log 最新段

文件：`C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\relay.log`（53,507 B，LastWrite 03:37:46 本地）
日志时间戳是 UTC（`Z`），本地 = +8h。

最新一次启动（原始行）：

```
2026-11-13T19:37:29.903Z INFO [dsh-handoff-relay] 启动 7/7 个 watch；stableMs=5000，delivered=C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\delivered
2026-11-13T19:37:29.985Z WARN [dsh-handoff-relay] 设置卡未挂载：宿主无 settings 服务（跳过，不影响 watch）
2026-11-13T19:37:46.005Z INFO [dsh-handoff-relay] rescan#3 dir=...\scripts\dsh\wakeup-inbox result=not-found
2026-11-13T19:37:46.005Z INFO [dsh-handoff-relay] rescan#3 dir=...\scripts\dsh\wakeup-inbox\workbuddy result=resolved
2026-11-13T19:37:46.006Z INFO [dsh-handoff-relay] rescan#3 dir=...\scripts\dsh\wakeup-inbox\doubao result=resolved
2026-11-13T19:37:46.006Z INFO [dsh-handoff-relay] rescan#3 dir=...\.batch\night\signals\workbuddy result=resolved
2026-11-13T19:37:46.006Z INFO [dsh-handoff-relay] rescan#3 dir=...\.batch\night\signals\doubao result=resolved
2026-11-13T19:37:46.007Z INFO [dsh-handoff-relay] rescan#3 dir=...\.batch\night\bridge\to-owner result=resolved
2026-11-13T19:37:46.007Z INFO [dsh-handoff-relay] rescan#3 dir=...\.batch\night\bridge\to-group result=not-found
```

判读：

| 问题 | 结论 |
|---|---|
| 有 `启动 7/7 个 watch` 吗 | 有，19:37:29.903Z = **本地 03:37:29**，落在用户报的 03:3x–03:4x 窗口内 |
| 又出现 `设置卡未挂载：宿主无 settings 服务` 吗 | 有，19:37:29.985Z = 本地 03:37:29.985，**距启动行仅 82ms** |
| 是否偶发 | 不是。该 WARN 自 18:14:16Z 起**每次启动必现**，此后 9 次启动（18:18、18:19、18:37、18:38、18:39、19:26、19:28、19:32、19:37）全部同一条 WARN |
| watch 状态 | 7 条都能加载；rescan#3（19:37:46）时 5 条 resolved、2 条 not-found（`wakeup-inbox` 本体、`bridge\to-group`）；投递链路本身健康 |

结论：watch 侧无异常，**问题只在设置卡**，且是稳定复现的系统性问题，不是启动竞态偶发。

## 第 2 项：浏览器控制台 / settings.describe

**这一项在本卡授权内无法直接取证**，如实说明原因，并给出等效替代：

- DSH 是 Electron 桌面壳。渲染进程 DevTools 只能在启动时带调试参数或从窗口手动打开；本卡授权「不重启」，故拿不到控制台文本。
- 但控制台**不是判据**：`settings.plugin.item` 这个槽位名在整份前端 bundle 里 0 命中（见第 3 项），意味着即便有渲染、有注册、有日志，也**没有任何组件会去渲染它**——不存在「注册报错被吞」这一可能分支。
- `settings.describe` 侧同理有静态替代：`dsh-settings` 的 `describe()` 只会为 **Config 带 `.volatile()` 字段且 fiber 处于 state 2** 的 profile 条目产出表单，`ns` 取 `entry.options.id`（见根因链第 2 条）。relay 的 host 侧注册在本版本直接抛/降级，故 `describe()` 里**不可能出现** `dsh-handoff-relay` 这个命名空间——这与「卡没出」是同一件事，不是两个证据。

若要补运行期证据，唯一零成本办法见第 4 项末尾（下次重启后看详情页 DOM），本卡不做。

## 第 3 项：Agent Loop Guard 凭什么进「内置插件配置」

对照件：`C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\@goodandready\dsh-agent-loop-guard`（client.js 28,554 B / index.js 14,337 B）

宿主页（`dsh/node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js`，438,441 B，解包副本 `.batch\night/tools/asar-out/`）自己的声明：

```js
// :84-88
function rowConfigKey(bundle, rowId) { return `${bundle}#${rowId}`; }
// :90-94
const SLOTS = ["plugins.item", "plugins.bundle.config", "plugins.row.config"];
```

渲染点：

- `:5855` 行详情页摘要位：`renderSlot("plugins.row.config", { view: "summary" }, { entryKey: key })`
- `:5869-5873` 行详情页配置区（带 `data-plugin-config`）：`renderSlot("plugins.row.config", { view: "page", form }, { entryKey: key })`
- `:6022` 包详情页配置区：`renderSlot("plugins.bundle.config", { view: "page" }, { entryKey: pkg.name })`

即「内置插件配置」区不是按 `dsh.client` 字段或包类型筛选，而是**按这三个槽位里有没有人注册、且注册的 key 与页面的 entryKey 相等**：包级 key = 包名；行级 key = `包名#条目id`。

Agent Loop Guard 的做法（原样引用）：

```js
// lib/client.js:8-11
const NS = '@goodandready/dsh-agent-loop-guard';
const PKG = '@goodandready/dsh-agent-loop-guard';
const ROW_ID = '@goodandready/dsh-agent-loop-guard';
const ROW_CONFIG_KEY = PKG + '#' + ROW_ID;

// :517
exports.inject = ['slots', 'configForms', 'locale'];

// :552-563
registerSlotWhenReady('plugins.row.config', () => ctx.slots.register(
  { name: 'plugins.row.config', key: ROW_CONFIG_KEY, order: 10, locale: NS, inject: () => ({ ctx }) },
  (props) => React.createElement(PluginItem, { ...props, ctx: (props && props.ctx) || ctx })
));

// :565-577
registerSlotWhenReady('plugins.item', () => ctx.slots.register(
  { name: 'plugins.item', id: ROW_ID, order: 10, label: () => 'Agent Loop Guard', locale: NS, inject: () => ({ ctx }) },
  (props) => React.createElement(PluginCard, { ...props, ctx: (props && props.ctx) || ctx })
));
```

它的 host 侧（`lib/index.js`）**只有** `export const Config = Schema.object({...})`（:35），全文 grep `settings` 结果只有 `Config`/`resolveConfig`/`applyLiveConfig` 之类的配置读写，**没有任何 `settings.register`**。它的 `cordis.patch.yml` 也只有 `- insert: - id: '@goodandready/dsh-agent-loop-guard'`。

结论（该区收录第三方卡的确切条件）：

1. client bundle 必须 `inject` 到 `slots`（可选加 `configForms`、`locale`）；
2. 向 `plugins.row.config` 注册，`key` **严格等于** `包名#cordis.patch.yml 里该 entry 的 id`；或向 `plugins.bundle.config` 注册，`key` = 包名；
3. 想额外出现在插件列表里，再向 `plugins.item` 注册 `{ id, label }`；
4. host 侧只要声明 `Config`，并用 `.volatile()` 标注允许在设置页改写的字段，宿主自动生成表单与读写（`describe()` 里 `autoGenerate` 默认 true）。

对照 relay：`client.js:210` 注册的是 `name: 'settings.plugin.item'`——名字不在本版本任何 SLOTS 里，全 asar 0 命中；host 侧 `index.js:721` 调 `settings.register(SETTINGS_NS, Schema, {base:{watches}, applies:'live'})`——本版本 `dsh-settings` 无此方法，直接把异常/undefined 走成 :702 那条 WARN。所以它既不在 `plugins.row.config` 里，也不在 `plugins.bundle.config` 里 ⇒ 该区当然没有它。

## 根因链（三条，全部静态可复现）

1. **槽位名不存在**：`settings.plugin.item` 在 213MB 前端 bundle 里 0 命中；本版本真实槽位是 `plugins.item` / `plugins.bundle.config` / `plugins.row.config`。⇒ `client.js:210` 的注册等于写进一个没人读的账本。
2. **host API 不存在**：`dsh-settings`（22,665 B）的 `SettingsForms` 只暴露 `configure(presentation)`(:370)、`describe()`(:413)、`update()`(:470)、`replace()`(:479)、`mutate()`(:488)、`write()`(:501)、`schema()`(:538)，**无 `register()`**；表单来源是 `describe()` 从各 profile 条目的 Config 里 `volatileForm(schema)` 自动生成，`ns` = `entry.options.id`，且要求 `entry.fiber.state === 2`。⇒ `index.js:721` 必失败。
3. **「宿主无 settings 服务」是误判**：cordis `get(name, strict = true)`（`dsh/node_modules/@deepseek-ai/cordis/lib/index.js:1347`）在 `strict && impl.ctx.fiber.state !== 2` 时返回 undefined。settings 服务确实在（`dsh-base/cordis.patch.yml:109-111` 声明 `- id: settings / name: '@deepseek-ai/dsh-settings' / disabled: !!js "!ctx.get('profileContext')"`，主 profile `cordis.patch.yml` 10,591 B 里无覆盖禁用，设置页本身可用）；relay 拿到 undefined 是**读取时机/注入方式**问题，不是服务缺失。所以 WARN 文案本身具有误导性，会让排查方向偏到「服务没装」。

## 不是原因的部分（已排除，避免重复查）

- `client.js:17 inject=["slots"]` 的 P17 修复有效：`pending (waiting for service: settingsScope)` 已消失，且不再崩。
- 插件加载/启用正常：`cordis.patch.yml:295` 是 `disabled: false`；junction 指向 `C:\develop\workspace\dsh-handoff-relay`；「已安装」tab 能点开、能看到 README。
- 不是 `settingsScope → configForms` 改名问题（那是服务名，P17 已处理）。
- 不是渲染异常被吞：槽位名 0 命中，无渲染方。

## 第 4 项：一句话结论 + 最小验证办法

- 定性：**位置/筛选不对**（槽位名 + host API 双缺），不是「注册没生效」。
- 最小验证办法（静态、零成本、可任何人复跑）：
  1. `python .batch\night\tools\asar-scan.py settings.plugin.item` → 期望 0 命中（这就是定论）；
  2. `python .batch\night\tools\asar-scan.py "dsh/node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js"` 后在解包副本 grep `rowConfigKey` 与 `SLOTS` → 得到本版本真实槽位与 key 规则；
  3. 对照件：grep Agent Loop Guard `lib/client.js` 的 `plugins.row.config` / `plugins.item` 与 `lib/index.js` 的 `Config`。
- 运行期验证（需一次重启，**本卡不做**）：重启后进「设置 → 插件 → 已安装 → 点开 dsh-handoff-relay」详情页，看是否存在 `[data-plugin-config]` 区；同时看真机渲染后的 `plugins.row.config` 账本里有没有 `dsh-handoff-relay#<entryId>`。

## 供负责人决策的提示（不在本卡范围，未改任何代码）

若 0.5.0 要出设置卡，改动面比 P17 大：`client.js` 注册点改名与 key 规则、`index.js` 弃用 `settings.register` 改走 `Config + volatile`、WARN 文案改准（「未注入 settings 服务」而非「宿主无 settings 服务」）。另外「已安装」tab 里 relay 点开只显示 README，与「无配置区」是同一现象的两个面：配置区由 `plugins.row.config` 提供，README 由包详情另外提供。是否现在开卡由负责人与产品经理定，我只出证据。

## 局限与未取证项

- 未取渲染进程控制台（不重启取不到，且结论不依赖它）。
- 未取运行期 `settings.describe()` 实返（同上）；替代证据见第 2 项。
- 「已安装」tab 列表本身的收录规则（`plugins.item` 与 Host 侧 bundle 清单的关系）只从代码判读到槽位层，未做逐条真机核对。

<!-- DONE -->
