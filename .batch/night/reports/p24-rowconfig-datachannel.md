# P24 · `plugins.row.config` 槽位到底拿到什么（只读取证）

时刻：2026-11-14 06:5x +08:00
方式：只读 asar 静态取证 + 仓库源码对读；未改码、未改配置、未重启、未碰远端。

## 一句话结论

宿主传给 `plugins.row.config` 的 props 只有 `{ view, form }`（外加作用域对象 `{ entryKey }`，不是 props）；
`ctx` 与 `controller` 不是宿主传的，而是我们注册时 `inject: () => ({ ctx, controller })` 的返回值合并进组件 props —— 这条链路是通的（卡渲染出来了就证明 inject 跑过）。
因此「Host 未提供该条目」**不是 props 缺 controller**，而是 controller 的 `getSnapshot().status === "unavailable"`，即宿主 `describe()` 的 `namespaces` 里没有我们这条 entryId。

## 证据

### 1. 宿主渲染调用点（props 逐字段）

`dsh-client-ui-plugin-manager/lib/client.js`（438,441B）：

- `:5855` 行摘要视图
  `renderSlot("plugins.row.config", { view: "summary" }, { entryKey: key })`
- `:5867-5874` 行详情配置区（本次真机看到的就是它）
  ```js
  "data-plugin-config": true,
  children: [renderSlot("plugins.row.config", { view: "page", form }, { entryKey: key }), renderSlot("plugins.detail.section", { subject })]
  ```
- 第三个参数 `{ entryKey: key }` 是槽位作用域/过滤条件（与 `{ only: item.id }` 同类），不是传给组件的 props。

⇒ 宿主侧 props = `view`（`"summary"` / `"page"`）+ `form`（可能为 `undefined`）。

### 2. `form` 是否为空，本身就是宿主证据

`plugin-manager/lib/client.js:6919-6927`：

```js
const configurations = props.useConfigurations((snapshot) => snapshot.view?.namespaces);
const formFor = (id) => {
  if (!configurations?.some((view) => view.ns === id)) return void 0;
  const form = props.configForm(id);
  return { state: form.getSnapshot(), mutate: (ops, revision) => form.mutate(ops, revision) };
};
```

`:7279` `form: formFor(openRow.rowId)`。
即：**entryId 不在 describe 的 namespaces 里 ⇒ 宿主传的 `form` 是 `undefined`。**

### 3. ctx / controller 从哪来

`C:\develop\workspace\dsh-handoff-relay\client.js:459-470`：

```js
const controller = forms.get(ENTRY_ID);            // :460
if (!controller) throw new Error("configForms 未返回表单控制器");  // :461
const register = () => ctx.slots.register({
  name: "plugins.row.config",
  key: ROW_CONFIG_KEY,        // "dsh-handoff-relay#dsh-handoff-relay"
  order: 10,
  locale: SETTINGS_NS,
  inject: () => ({ ctx, controller }),   // :467
}, SettingsCard);
if (typeof ctx.slots.inject === "function") ctx.slots.inject("plugins.row.config", register);
else register();
```

`client.js:243-244` `SettingsCard(props)` 取 `props.controller || props.controllerForm`。
- 若 `props.controller` 不存在 → `:269` 走 `!controller` 分支，文案是「当前宿主未提供 configForms，只能查看，不能在界面保存」。
- 真机显示的是「**Host 未提供该条目**」→ 说明 `!controller` 不成立，controller 拿到了，`safeSnapshot` 也拿到了快照，只是 status 落到了「其他」分支（`:269-273`）。

### 4. status 为什么是 unavailable

`dsh-client-ui-settings/lib/client.js`：
- `:1109` 初始 `status: "loading"`
- `:1209-1232` `derive()`：`mirrored.view` 未到 → 保持 loading；`view.namespaces.find(v => v.ns === this.spec.namespace)` 为 `void 0` → `draft.status = "unavailable"`；decode 成功才 `"ready"`
- `:1252-1274` `ConfigForms` 服务名 `configForms`，`get(entryId)` 按 entryId 缓存 form

`dsh-settings/lib/index.js`（宿主 `describe()`）：
- `:413-419` 只有当 `this.schema(entry) !== undefined && entry.fiber.state === 2` 且 `volatileForm(schema) !== undefined` 才进 namespaces
- `:538-541` `schema(entry) = entry.fiber?.runtime?.Config`（要求带 `toJSON`）
- `:122-131` `volatileForm`：根必须是 `object`，逐子节点看 `meta.volatile`
- `:432` `ns = entry.options.id`

⇒ `status === "unavailable"` ⇔ 我们这条 entry 没进 `describe()` 的 namespaces。

## 已知与未知

已知：
- 宿主 props 链路正常，不是「槽位没传 ctx」。
- 仓库 `index.js:36-56` 已有 `export const Config`，`watches` 与 `stableMs` 都标了 `.volatile()`。
- profile 里 `cordis.patch.yml:293-295` 的 entry id 就是 `dsh-handoff-relay`，与 `ENTRY_ID`/`ROW_CONFIG_KEY` 一致。
- 插件目录是 Junction 直指 `C:\develop\workspace\dsh-handoff-relay`，没有 `.pnpm` 物化副本。

未知（需下一轮最小验证，非本轮范围）：
1. 当前装载实例的宿主侧 `runtime.Config` 是否真的解析出了 schema（`"toJSON" in schema`）——若 `Config` 未被当作 schema 收下，则 `schema(entry)` 为 undefined，entry 直接不出现。
2. `volatileForm` 是否返回 undefined——`Schema.array(...).volatile().default([])` 这种「先 volatile 后 default」的链式顺序是否保住 `meta.volatile`，静态读不出，需要在宿主进程里打印一次。

## 最小验证办法（不改码、不重启）

下次重启后，在「设置 → 插件 → 已安装 → 点开 dsh-handoff-relay → 行详情」看这一行：
- 若行底仍显示「Host 未提供该条目」，且宿主侧能拿到 `settings.describe` 的原始 JSON（远程/devtools 任一路径），直接看 `namespaces[].ns` 里有没有 `dsh-handoff-relay`。
- 有 ns 但卡片仍报 unavailable ⇒ 我们的 `spec.namespace` 与 ns 不一致；没有 ns ⇒ 问题在宿主侧 `Config`/`volatileForm`。


## 附：明天 A/B 候选（今晚不改码，仅记录）

1. 卡同时挂 `plugins.bundle.config`（key = 包名），观察 describe 是否收录本 entry。
2. 读配置改用宿主白送的 `props.form.state`、写用 `props.form.mutate`，不再自取 controller。
3. 会话列表用注册时闭包捕获的 `ctx`，不用 `props.ctx`。

一处必须更正的事实（今天已核）：三列卡当前渲染在 **`plugins.item` 的 page 视图**（`plugin-manager/lib/client.js:5795-5799`，props 同样是 `{view, form}`，作用域 `{only: item.id}`）；`plugins.bundle.config` 在 `:6022` 只传 `{view}`、**不带 `form`**，把卡挪过去反而拿不到表单数据。两处都带 `form` 的只有 `plugins.row.config`（`:5870-5873`）。
<!-- DONE -->
