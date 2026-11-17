# P26 · 修 Config 求值时机：ESM race 导致 Config=undefined

执行：豆包（自动档）
仓库：`C:\develop\workspace\dsh-handoff-relay`
起点：`8d562a0`（131/131）
终版：`bb8ee9120803`

## 1. 改动

只动 `index.js` 与 `index.test.mjs`；`client.js` 未动（blob 与 `8d562a0` 相同：`771e7c40becf1bb13fa606261740cf4f42754d34`）。

### 1.1 同步 require → ESM import() + 顶层 await

`index.js`：

- 新增 `import { pathToFileURL } from 'node:url';`
- 新增 `loadSchemasteryAsync(rootDir)`：`createRequire(<profile>/package.json)` → `req.resolve` → `await import(pathToFileURL(resolvedPath).href)`；模块形态不符/解析失败只返回 `{z:undefined, resolved:undefined, error}`，不抛。
- 模块顶层：

```js
const SCHEMA_PROFILE_ROOT = profileRootDir();
const SCHEMA_LOAD = await loadSchemasteryAsync(SCHEMA_PROFILE_ROOT);
```

- `buildConfigSchema(z)` 改为接收已加载的 `z`；`if (!z) return undefined;`，schema 结构逐字未变：

```js
watches: z.array(z.object({
  dir: z.string().default(''),
  targetTitle: z.string().default(''),
  targetSessionId: z.string().default(''),
  exact: z.boolean().default(true),
  done: z.any(),
})).volatile().default([]),
stableMs: z.number().default(DEFAULT_STABLE_MS).volatile(),
message: z.string().default(DEFAULT_MESSAGE),
```

- `export const Config = buildConfigSchema(SCHEMA_LOAD && SCHEMA_LOAD.z);` 在顶层 await 之后求值。

### 1.2 mountSettingsCard 复用加载结果

`mountSettingsCard` 不再调用同步 `loadSchemastery()`：

```js
const currentRoot = profileRootDir();
const loaded = currentRoot === SCHEMA_PROFILE_ROOT ? SCHEMA_LOAD : await loadSchemasteryAsync(currentRoot);
if (!loaded || !loaded.z) throw (loaded && loaded.error) || new Error('schemastery 未加载');
z = loaded.z;
schemaResolved = loaded.resolved;
```

失败分支保留原 warn 文案与基线路径，`String(err)` 会带出原始 `error`。  
同一 profile 下直接复用模块级 `SCHEMA_LOAD`；只有 `DSH_PROFILE_DIR` 在运行中切换（测试隔离场景）才按新 profile 重新异步解析，避免把 A profile 的 schema 错用到 B profile。

## 2. 测试

### 2.1 全量

```text
$ node index.test.mjs
PASS  P26 加载失败：空 profile 解析不到 schemastery → Config=undefined 且 apply 不抛
PASS  P26 加载成功：ESM-only schemastery（含顶层 await）可被 import() 加载，Config 含三字段且关键字段 volatile
TOTAL: 133/133 PASS
RESULT: PASS
```

exit 0；131/131 → 133/133。

### 2.2 新增两条

- `P26 加载失败：空 profile 解析不到 schemastery → Config=undefined 且 apply 不抛`
  - 临时空 profile（`DSH_PROFILE_DIR` 指向无 schemastery 的目录）→ `import('./index.js?p26fail=…')`；
  - 断言 `Config === undefined`、`apply({}, {})` 不抛。
- `P26 加载成功：ESM-only schemastery（含顶层 await）可被 import() 加载，Config 含三字段且关键字段 volatile`
  - 在临时 profile 里造一个 `type:module`、含顶层 `await` 的 schemastery 桩（同步 `require` 必失败，`import()` 可加载）；
  - 断言 `Config.type === 'object'`，`dict` 含 `watches` / `stableMs` / `message`；
  - 断言 `watches.type === 'array'` 且 `meta.volatile === true`，`stableMs.meta.volatile === true`，`message.meta.volatile === undefined`。

## 3. C5 反证

临时副本把 `await import(...)` 改回同步 `req('@deepseek-ai/schemastery')`，其余不动，跑同一套测试：

```text
FAIL  P26 加载成功：ESM-only schemastery（含顶层 await）可被 import() 加载，Config 含三字段且关键字段 volatile :: ESM-only schemastery 应构建出 Config
TOTAL: 132/133 PASS
RESULT: FAIL
```

反证说明：ESM-only + 顶层 await 的 schemastery 在同步 `require` 下无法加载，`Config` 变 undefined，成功路径用例变红；`import()` 版本通过。

## 4. 判据核对

- C1：`git diff --numstat 8d562a0 HEAD` 只有 `index.js` 39/28、`index.test.mjs` 55/0；`client.js` blob 两边同为 `771e7c40becf1bb13fa606261740cf4f42754d34`。
- C2：`index.js:41` `const SCHEMA_LOAD = await loadSchemasteryAsync(SCHEMA_PROFILE_ROOT);`；`:57` `export const Config = buildConfigSchema(SCHEMA_LOAD && SCHEMA_LOAD.z);`；`:107` `await import(pathToFileURL(resolvedPath).href)`。
- C3：失败路径用例真跑，`Config === undefined` 且 `apply` 不抛。
- C4：133/133 PASS，> 131。
- C5：同步 require 反证 132/133 FAIL，成功路径红。

## 5. 提交与工作区

```text
$ git log --oneline -2
bb8ee91 fix: load schemastery through ESM import with top-level await
8d562a0 fix: make the legacy settings card read-only

$ git show --numstat --format= HEAD
39      28      index.js
55      0       index.test.mjs

$ git status --porcelain
(空)

$ git rev-parse --short=12 HEAD
bb8ee9120803
```

`git add` 点名 `index.js`、`index.test.mjs`，未用 `-A`；未 tag、未 push、未 publish。

## 6. 文件读数

```text
index.js        52,447 B  MD5 CA23BC6B05A277EBB4D324199E87D6C7
index.test.mjs 127,920 B  MD5 8F71F20DBD6D62E0BEDA20865EECD1FD
```

## 7. 未做 / 不确定

- 未在运行中的桌面壳重启验证；真机「Config 不再 undefined、设置卡可出表单」待 QA/真机复验。
- `SCHEMA_PROFILE_ROOT` 在模块求值时读取 `DSH_PROFILE_DIR`；若宿主在 import 本插件之后才改该环境变量，模块级结果仍是旧 profile，属于宿主生命周期之外的变更，本轮未测。

<!-- DONE -->
