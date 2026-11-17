# P32 只读取证：渲染层能否校验「目录可读」

- 卡号：P32
- 类型：只读取证（未改任何文件、未重启宿主）
- 起点：asar `C:\develop\software\DeepSeekHarness\resources\app.asar`（提取件在 `.batch\night\tools\asar-out\`）
- 结论一句话：**渲染层自己没有 `fs`，但客户端插件可以经 `ctx.remote.workspaceFiles` 让宿主替它 stat/list，所以「dir 可读校验」成立，且不需要新增服务。**

## 0. 总表

| 问 | 答 | 依据 |
|---|---|---|
| 1. 宿主 schema 校验失败怎么呈现 | 写被拒（`settings/rejected`），值为草稿保留；宿主不回字段路径，官方通用表单只弹**一条卡级**文案，字段本身不标红 | `dsh-settings` write → `configEditor.edit` 的 `resolveConfig`；controller `rejected()`；官方卡（`dsh-client-ui-settings-shell` L25 等四个 `dsh-client-ui-settings-*` 卡包，`dsh-client-ui-settings` 本体里 0 处）用 `SettingsForm` + `saveFailed` |
| 2. form 有无只读校验结果/errors 通道 | form 快照里**没有**；但另有客户端服务 `settingsSchema.validate(schema,draft)`，且 `configForms.describe()` 携带每个 ns 的序列化 `schema` | `dsh-client-ui-settings/lib/client.js` |
| 3. 渲染层有无 stat/access 类服务 | 本地无；远程有 `remote.workspaceFiles`（`stat`/`list`/`inspect`/…） | `dsh-api-workspace-files` host + remote-client |
| 4. 不新增服务能否走通 | 能。复用 `remote.workspaceFiles.list(sessionId, dir)`：`ok===true` 即可读；`ok===false` 不可读 | 同上 |

## 1. 问一：校验失败时宿主/前端如何呈现

### 1.1 宿主侧：校验就是保存时抛异常

`dsh-settings/lib/index.js:501-537`（`write()`）先只查「字段是否 volatile」，真正的 schema 校验在 `configEditor.edit` 里：

- `dsh-config-editor/lib/index.js:82`：`fiber.resolveConfig(next)` —— schemastery 校验，**同步抛**，抛在 `writeFileAtomic`（`:122`）之前，所以坏值不会落盘。

### 1.2 远程层：抛错被归类成 `settings/rejected`，只带 ns

`dsh-api-settings-controller/lib/index.js:461-476`：

```js
try { ... await settings.mutate(namespace, input, expectedRevision); }
catch (error) { throw rejected(ns, error); }
```

`:501-509`：

```js
function rejected(ns, error) {
  const conflict = settingsConflictOf(error);
  if (conflict !== void 0) return new RemoteError("settings/conflict", conflict.message, {ns, expected, actual}, ...);
  return new RemoteError("settings/rejected", messageOf(error), { ns }, ...);
}
```

要点：message 是 schemastery 的报错文本；`details` 只有 `ns`，**没有字段 path**。所以前端拿不到「第几行/哪个字段」的结构化定位，只能拿到一句文本。

### 1.3 客户端：写失败 = mutate 返回 false + 重读文档

`dsh-client-ui-settings/lib/client.js:1165-1188`：

```js
mutate(ops, expectedRevision) {
  ...
  const response = await this.ctx.remote.settings.mutate(this.spec.namespace, ownedOps, revision);
  if (!response.ok) { await this.recover(generation); return false; }
  ...
}
```

`recover()` 重新 `mirror.load()` —— 草稿被丢弃、回到宿主现值。**保存确实被阻止**（值没落盘），但用户输入也不保留在 form 里。

### 1.4 界面侧：官方 Config 卡是「整卡一条」，不是字段级

官方同类卡（`plugins.item` 里的设置页，如 shell/agent-loop/subagent）统一用 primitives 的 `SettingsForm`：
`dsh-client-ui-settings-shell/lib/client.js:173-211`：

```js
jsxs(SettingsForm, {
  labels: formLabels(t), state, onSave: props.save, onDiscard: props.discard,
  children: [ jsx(SettingsValueField, { ...invalidLabel: t("invalidNumber"), numeric: true, ... }) ]
})
```

失败文案只有一条：同文件 `:23-25` / `:54`
`saveFailed: "The deployment did not accept these values; they were left for you to correct."`（中文·「本部署没有接受这些值，已保留供你修改」）。
`SettingsValueField` 的 `invalidLabel`（`:184`）只处理**本地标量解析**（如数字框），与宿主 schema 无关。

⇒ 问一答案：**整卡一条错误 + 保存被拒**；宿主不回字段定位；字段级标红只能由卡片自己实现。

## 2. 问二：`plugins.row.config` 的 form 有无只读校验结果

### 2.1 form 快照：没有 errors / warnings

`dsh-client-ui-plugin-manager/lib/client.js:6920-6927` 交给卡片的只有：

```js
{ state: form.getSnapshot(), mutate: (ops, revision) => form.mutate(ops, revision) }
```

`form` 由 `ctx.configForms.get(id)` 得到（`:3179`）。快照形状见
`dsh-client-ui-settings/lib/client.js:1108-1115`：

```js
createSnapshotStore({ status:"loading", value: undefined, base: undefined, user: undefined, revision: undefined, writable: false })
```

宿主 `describe()` 每项也没有校验结果字段（`dsh-settings/lib/index.js:441-451`：`{autoGenerate, ns, schema, revision, applies, value, base, user, secrets?}`）。

### 2.2 但有 `settingsSchema` 服务 + describe 携带 schema

`dsh-client-ui-settings/lib/client.js:923-949`：

```js
var SettingsSchemaService = class extends Service {   // super(ctx, "settingsSchema")
  rehydrate(serialized) { return new Schema(serialized); }
  validate(schema, draft) {
    try { schema(draft); return; } catch (e) { return e instanceof Error ? e.message : String(e); }
  }
  nodeAtPath(root, path) { ... }   // :956
  getPath/hasPath/setPath/deletePath ...  // :972-1027
}
```

而且 `configForms.describe()` 的镜像里带 schema：`dsh-api-settings-controller/lib/index.js:274-289` `namespaceView()` 原样透传 `schema`。

⇒ 卡片可以自己拼出字段级校验：
`configForms.describe().getSnapshot().view.namespaces.find(n => n.ns === key).schema`
→ `settingsSchema.rehydrate(schema)` → `nodeAtPath(root, ["dir"])` → `settingsSchema.validate(node, draftValue)` 得该字段的失败文本 → 自己标红、自己拦截保存（不调用 mutate）。
**不需要宿主新增 errors 通道，也不需要改 `dsh-settings`。**

## 3. 问三：渲染层有没有 stat/access 类服务

本地：**没有**。
- 全 asar 检索 `super(ctx, "fs` 只命中 host 侧 `@deepseek-ai/dsh-fs/lib/index.js`；
- `statPath` / `readDirectory` 在 client bundle 中零命中（`readDirectory` 只在 host 的 `dsh-file-reference-local` 与 inspector 的 DevTools chunk 里）。

远程：**有 `workspaceFiles`**。
- 客户端消费写法（可直接抄）：`dsh-api-workspace-files/lib/client.js:452-457`
  ```js
  const inject = ["resources", "remote", "remote.workspaceFiles"];
  ```
  调用形如 `remote.workspaceFiles.stat(sessionId, path, signal)`（`:363`），返回 RemoteResult。
- 宿主实现 `dsh-api-workspace-files/lib/index.js`：`read :426`、`readBytes :447`、`stat :484`、`list :495`、`relativePath :527`、`inspect :563`、`confine :576`、`locateFile :589`。
- `stat` 的注释明写：`path - absolute path or path relative to the workspace root; files outside it are allowed`（`:479-483`）；返回 `{absolutePath, version, size}`（`:486` `statOf`）。
- `list` 要求目标是 directory 或（可解析为 directory 的）symlink，否则 `RemoteError("workspace-file/not-directory", ...)`（`:497-506`）。

⇒ 结论：**有**，但只能作为「远程调用」，没有任何本地 fs 探测。

## 4. 问四：不新增服务，怎么把「可读」带到卡片

推荐路径（最小改动、零新服务）：

1. 卡片 client 插件 inject 增加 `"remote.workspaceFiles"`（远程命名空间）与 `"remoteAccess"`（官方用法：`dsh-client-ui-plugin-manager/lib/client.js:7718` `ctx.remoteAccess.whenAccess("pluginManager/listBundles", ...)`）。
2. 用户选中目录后（或保存前）调 `remote.workspaceFiles.list(sessionId, dir)`：
   - `ok === true` → 目录存在且可读，可放行保存；
   - `ok === false` → 不可读/不存在/不是目录，直接用 `error.message` 做卡片内提示并拦住 mutate。
3. `sessionId` 取任一个 live session 即可（远程 scope 是「Session 的读权限」，绝对路径允许越出 workspace）。

代价与边界（必须写清，避免派码时踩空）：
- 这是一次 IPC 往返，不是同步本地检查；只适合「选择后/保存前」触发，不适合每帧渲染。
- 错误码只能区分 `workspace-file/*` 粗类；做文案时按 `ok===false` 兜底，不去穷举 code。
- 该路径依赖 `remoteAccess` 放行；若部署不给该端点权限，验证会直接失败（届时是权限问题，不是目录问题）。

## 5. 判定建议（技术侧，不做产品裁决）

- P29「dir 校验」**可做**，实现点只有一个：卡片内在 mutate 之前用 `remote.workspaceFiles.list` 探测。
- **不需要**新增 host 服务、不需要改 `dsh-settings`/`dsh-config-editor`、不需要往 relay.log 之类的地方塞共享状态（问题四的备选方案因此不必启用）。
- 字段级报错属于卡片自己的 UI 工作，宿主不给现成通道（问一已证）。

<!-- DONE -->
