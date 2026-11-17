# P22 · 设置界面可行性取证（只读取证，未改码/未重启/未碰远端）

对象：dsh-handoff-relay（包名 `dsh-handoff-relay`，bundle patch 行 id 也是 `dsh-handoff-relay`）
宿主体：桌面壳 `C:\develop\software\DeepSeekHarness\resources\app.asar` 内 DSH `0.2.2-rc.1`（213,202,918 B，22,102 entries）
取证方式：asar 静态抽取（`.batch\night\tools\asar-ls.py --extract`）+ 对照已安装第三方包源码；全程只读。

## 0. 结论（五行）

1. 槽位不是 `settings.plugin.item`（该名全 asar 0 命中），正确面是 `plugins.item` / `plugins.bundle.config` / `plugins.row.config`。
2. 我们的 key 是 `dsh-handoff-relay#dsh-handoff-relay`，条目 id 是 `dsh-handoff-relay`（= 包名 = 自有 bundle patch 的行 id）。
3. 槽位渲染值就是 React 组件，可完全自绘（summary / page 两视图 + 页面传入的 `form`）。
4. 渲染层会话列表由 `sessions` 服务提供，`list` 快照里有 `displayTitle`/`cwd`/`running`；`search()` 搜的是消息内容，不是标题——标题搜索用快照本地过滤即可。
5. **写入通道可行但有一处硬前提，会阻断 P22b 的「只动 client.js」**：宿主只为「Config schema 里有 `.volatile()` 字段」的条目出表单、也只接受这些路径的写入；relay 现在**没有导出 Config**，必须同批加 host 侧 schema，否则卡片永远 unavailable、写入必被拒（详见 §4）。

## 1. ① 槽位注册方式、key、条目 id 从哪读

`dsh/node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js`（438,441 B）：

- `:87-89` `function rowConfigKey(bundle, rowId) { return `${bundle}#${rowId}`; }`
- `:90-94` `const SLOTS = ["plugins.item","plugins.bundle.config","plugins.row.config"];`
- `:100-127` `configLedgerSource()` 把三个槽位的注册投影成账本：`items` 取 `plugins.item` 的 `{id,label}`，`bundles` 取 `plugins.bundle.config` 的 `options.key`，`rows` 取 `plugins.row.config` 的 `options.key`。
- `:7002-7012` 行卡「配置」入口的判据：`has: (row) => ledger.rows.has(rowConfigKey(pkg.name, row.rowId))` —— **没有注册 `plugins.row.config` 就没有配置入口**。
- `:5785-5798` 包详情页的配置区（`data-plugin-config: true`）渲染的是 `renderSlot("plugins.item", {view:"page", form}, {only: item.id})`；摘要行在 `:5729`。
- `:5811-5819` 行详情页 `data-plugin-row-detail` + `renderSlot("plugins.row.config", {view:"summary"|"page", form}, {entryKey: key})`（`:5855`、`:5870-5873`）。
- `:6022` 包页 `renderSlot("plugins.bundle.config", {view:"page"}, {entryKey: pkg.name})`。

我们的两个 id：

- 包名 `dsh-handoff-relay`（`C:\develop\workspace\dsh-handoff-relay\package.json`）。
- 行 id：本仓库自有 bundle patch `C:\develop\workspace\dsh-handoff-relay\cordis.patch.yml:9-11`
  ```yaml
  - insert:
      - id: dsh-handoff-relay
        name: dsh-handoff-relay
  ```
  profile 侧 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `- id: dsh-handoff-relay` 是「按 id 覆盖 config」，不新增行。

⇒ `plugins.row.config` 的 key = `dsh-handoff-relay#dsh-handoff-relay`；`plugins.item` 的 id = `dsh-handoff-relay`。

可照抄的第三方样板（`C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\@goodandready\dsh-agent-loop-guard\lib\client.js`）：

- `:9-10` `const PKG = '@goodandready/dsh-agent-loop-guard'; const ROW_ID = PKG;`
- `:517` `exports.inject = ['slots','configForms','locale']`
- `:527-549` `registerSlotWhenReady(slot, fn)`：优先 `ctx.slots.inject(slot, fn)`，失败退回 `ctx.slots.register`。
- `:552-563` 注册 `plugins.row.config`：`{name, key: ROW_CONFIG_KEY, order: 10, locale: NS, inject: () => ({ctx})}`，值组件 `PluginItem`。
- `:565-577` 注册 `plugins.item`：`{name:'plugins.item', id: ROW_ID, order: 10, label: () => 'Agent Loop Guard', locale: NS, inject: () => ({ctx})}`，值组件 `PluginCard`。

注意样板 host 侧并不 `settings.register`，只有 `export const Config = Schema.object({...})`（`lib/index.js:35-50`）。

## 2. ② 槽位能否自定义渲染

能，且是常规 React 组件注册：

- 槽位注册对象即 `ctx.slots.register({name, key|id, order, locale, label, inject}, Component)`（见上样板）。
- 组件收到页面给的 props：`view: "summary"|"page"`、`form`（包详情/行详情把可编辑表单对象直接传下来）、以及 `inject` 返回的自定义字段。
- 因此「三列表格 + 会话选择器 + 正则输入框」可以完全自绘，不需要新依赖、不需要改宿主；`plugins.item` 的 page 视图就是「点开插件后的整页内容」，正是主人截图里只显示 README 的那个位置。

## 3. ③ 渲染层拿会话列表（id + 显示名）与搜索

服务名 **`sessions`**，实现 `dsh/node_modules/@deepseek-ai/dsh-api-session-controller/lib/client.js` 的 `ClientSessions`：

- `:3856` `rootCtx.reflect.provide("sessions", this, void 0)`
- `:3815` 字段 `list = createSnapshotStore({ids:[],byId:{},phase:"pending",projectionsBySession:{}})`（`:3830-3835`）
- 快照形状：`:4162 projectList()`，`:4169-4182` 每项 `{ id, displayTitle, running, retainedBy, blank, updatedAt, formatStatus, projectionValues?, title?, cwd?, parentId?, origin? }`
- 显示名：`:3716 displayTitleOf(title, cwd, id)` = 持久标题 → `workspaceTitleOf(cwd)`（目录 basename）→ 原始 id
- 搜索：`:3932 search(query, signal)`，JSDoc 明确是「Host 可见的消息内容索引」，**不搜标题**
- 消费写法：`dsh-client-ui-session/lib/client.js:1108-1110` `inject = ["sessions","slots","remote","remoteAccess"]`，`:1119 new UiSession(ctx, ctx.sessions)`

⇒ 选会话器：`ctx.sessions.list.getSnapshot().byId` 取值，按 `displayTitle.toLowerCase().includes(q)` 本地过滤（`blank`/`running` 可作附加标记），无需新依赖、无需新增 ipc。

## 4. ④ UI 改配置怎么落盘（含阻断项）

链路（全在 asar 内可核）：

1. 写：`ctx.configForms.get(entryId)` → `ConfigFormController`（`dsh-client-ui-settings/lib/client.js`）
   - `:1140-1146` `set(field, value)` = `mutate([{op:"set", path:[field], value}])`
   - `:1153-1158` `unset(field)`
   - `:1165-1181` `mutate(ops, expectedRevision)` → `await this.ctx.remote.settings.mutate(this.spec.namespace, ownedOps, revision)`；返回 `true/false`，冲突时 `recover()` 重读
   - 快照字段：`:1108-1115` `{status, value, base, user, revision, writable}`；`:1122 getSnapshot`，`:1130 subscribe`
   - 文档字段（`cf-ctx` 内联文档原文）：「快照包含解析后的 `value`、继承 `base`、原始 `user`、修订号和可写性。`set` 与 `unset` 提交单个操作，`mutate` 提交一个原子操作列表。暂存编辑器传入编辑前读取的修订号；冲突时保留草稿。」
2. 宿主：`dsh/node_modules/@deepseek-ai/dsh-settings/lib/index.js`（22,659 B），`super(ownerContext,"settings")`（服务名仍叫 `settings`），`describe()`（`:413`）、`update()`（`:470`）、`mutate()`（`:488`）、`write()`（`:501`）。
3. 落盘：`dsh-config-editor/lib/index.js`（7,297 B）`ConfigEditor`，`get documentPath() { return this.ownerContext.profileContext.patchPath; }`（`:24-26`）；`edit(entry, change)`（`:69`）→ `withFileLock` + `writeFileAtomic`。
   ⇒ 最终就是原子重写 **`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`**（与 relay 今天直接解析的是同一个文件，写法是按 id 覆盖 `config:`），随后走 Loader 热重载。

**阻断项（必须先改 host，纯 client 改法不可行）**：

- `dsh-settings/lib/index.js:418`：`describe()` 只在 `schema !== undefined && entry.fiber.state === 2` 且 `volatileForm(schema) !== undefined` 时产出行；`:505-506`：写入非 volatile 路径直接 `throw new Error('Config field "…" is not volatile')`。
- `:122-131 volatileForm(schema)`：`schema.meta.volatile` 才进表单，否则递归对象；一个 volatile 字段都没有 ⇒ 条目根本不出现在 `describe()`，`configForms.get()` 状态为 `unavailable`。
- `:154 isVolatilePath(schema, path)` 逐段要求祖先链上有 volatile 节点。
- volatile 字段运行时是 **box**（函数或 `{get}`），不是值本身：样板 host `lib/index.js:17-32 plainConfig()` 逐层 unwrap（`while (typeof value === "function") value = value(); if (value?.get) …`），`:35-50` `Config` 里每个字段都 `.volatile()`（含 `Schema.array(Schema.string()).volatile()`）。
- 现状：`C:\develop\workspace\dsh-handoff-relay\index.js` 无 `export const Config`，也无任何 `.volatile()`；运行时真相仍是自己解析 patch yml 文本（`:504-634`，含 `:546`、`:560`、`:625` 的解析/回写）。

⇒ P22b 若要写回生效，**host 侧必须同批**：`export const Config = Schema.object({ watches: Schema.array(Schema.object({…})).volatile(), … })`，并在读取处 unwrap box；否则卡片只能显示不可保存，`mutate` 必返回 `false`。

## 5. ⑤ `sessionTitle` 在渲染层能否读到

不能。`sessionTitle` 是**宿主侧**服务：`super(ctx, "sessionTitle")`（`dsh-session-title` 包，asar @121528488），由 `dsh-session-title-first-prompt-llm` / `-all-prompts-llm` 注册 provider（`@121432251`、`@121458134`）。渲染侧没有 `provide("sessionTitle")`、也没有消费方（全 asar 检索 0 处渲染层引用）。

⇒ 界面上显示标题用 `sessions.list` 快照的 `displayTitle`（§3），效果等同；不要在 client 里 `ctx.get('sessionTitle')`。

## 6. 最小验证办法（都不需要改码）

静态三查（脚本已在本机）：

```powershell
python .batch\night\tools\asar-tokens.py 'settings.plugin.item'     # 期望 0
python .batch\night\tools\asar-tokens.py 'plugins.row.config'       # 期望 >0（plugin-manager 等）
python .batch\night\tools\asar-tokens.py 'configForms'              # 期望 >0
```

运行期（下次重启后，零成本）：

1. 设置 → 插件 → 已安装 → 点开 Handoff Relay：页面里出现 `[data-plugin-config]`（`:5794`）；
2. 若已注册 `plugins.row.config`，行卡出现「配置」按钮，点进去是 `[data-plugin-row-detail="dsh-handoff-relay#dsh-handoff-relay"]`（`:5811-5819`）；
3. 保存一次后看 `cordis.patch.yml` 里 `- id: dsh-handoff-relay` 的 `config.watches` 是否被原子改写。

## 7. 取证命令与产物

- 列/抽 asar 条目：`python .batch\night\tools\asar-ls.py --extract "<asar 内路径>"`
- 全库 token 扫描：`python .batch\night\tools\asar-tokens.py '<token>' …`（多 token 是 AND）
- 按正则取上下文：`python .batch\night\tools\find-ctx.py '<regex>' …` → `.batch\night\tools\ctx-out.txt`
- 已抽样本：`configForms` 上下文 `.batch\night\tools\cf-ctx.txt`（92 处命中，含 services 文档原文）

<!-- DONE -->
