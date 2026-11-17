# P25 首验 · describe 探针读数（QA）

- 卡号：P25
- 对象：`.batch/night/reports/p25-describe-probe.md`（8,491B / MD5 `0DA7A79B5C08E237ADEBEB5726C63D7D`，106 行、末行 `<!-- DONE -->`）+ 探针日志 `%TEMP%\dsh-probe-1114\home\profiles\probe\dsh-handoff-relay\relay.log`（112,901B / 331 行 / mtime 08:12:59）
- 派验单：`.batch/night/review-requests/P25.md`（08:16）、派验人 AI writer总负责人
- 结论：**PASS 4/4**（证据链成立，可支撑 P26 修法前提）；另有两处口径须修正，不拦

## 逐条复算

### C1 `describe()` 返回数组 —— 成立
- `dsh-settings/lib/index.js:413 describe(options) {`；`:415` 对 `configEditor.configuration()` 做 `flatMap`，`:441-451` 每条返回**对象** `{autoGenerate, ns, schema, revision, value, base, user}`；`:463 return descriptors;` ⇒ 返回的是**数组**，元素带 `ns`，无 `namespaces` 字段。
- 探针读 `d.namespaces` 恒为 undefined，报告自纠正确。
- 但注意：数组为空另有原因——`:416-419` 只要 `schema === void 0 || entry.fiber === void 0 || entry.fiber.runtime === null || entry.fiber.state !== 2` 或 `volatileForm(schema) === void 0` 就 `return []`；234 条里无 `.volatile()` 形态 ⇒ `namespaces=[] count=0` 是必然，**`inList=false` 不能作为「我方被跳过」的证据**，请报告别拿它当判据。

### C2 `ERR_REQUIRE_ESM_RACE_CONDITION` 原文与吞点 —— 成立
- 日志原文（t3，00:12:16.968，t15/t45 同文本）：`cfgErr=Error [ERR_REQUIRE_ESM_RACE_CONDITION]: Cannot require() ES Module C:\Users\<用户名>\AppData\Local\Temp\dsh-probe-1114\home\profiles\probe\node_modules\@deepseek-ai\schemastery\node_modules\@deepseek-ai\cosmokit\lib\index.js because it is not yet fully loaded.` —— 与报告 §2 引文逐字一致。
- 吞点：HEAD `index.js:52 } catch {` / `:53 return undefined;` / `:55 export const Config = buildConfigSchema();` ⇒ 求值期一次失败即永久 undefined。
- 「3 秒后重新调用已成功」成立且是**真 require**，不只是 resolve：`index.js:99-105 loadSchemastery()` = `createRequire(baseFile)` → `req.resolve(...)` → `req(...)` 并返回 `{ z, resolved }`；日志 `resolveOK=...schemastery\lib\index.cjs` 出现在 `:104` 之后，说明 t3 那一刻 `req()` 已成功 ⇒ 定性「不是解析不到，是求值时机」站得住。
- 防误读：`cfgErr` 是加载期捕获一次的变量，t3/t15/t45 三档照打**不代表 45s 时仍失败**；报告应写明这点，否则会被读成「45 秒还抛」。

### C3 三个读数与「Config=undefined → describe 跳过」自洽 —— 成立
- 读数（t45，00:12:59.022-023）：`entry#228 SELF id="dsh-handoff-relay" fiberState=2 runtime=object configUndefined=true cfgType=undefined metaVolatile=undefined`；对照 `entry#1 id="plugin-manager" fiberState=2 runtime=object configUndefined=false cfgType=object` ⇒ 探针读 schema 的路径本身可用，我方 undefined 是真实值，不是读法错。
- 源码链闭合：
  - cordis `lib/index.js:1703 Config: plugin.Config` ⇒ `runtime.Config` 就是插件模块导出的 `Config`；
  - `dsh-settings/lib/index.js:539 const schema = entry.fiber?.runtime?.Config;`、`:540 return schema !== void 0 && "toJSON" in schema ? schema : void 0;`；
  - `:417 if (schema === void 0 || ... || entry.fiber.state !== 2) return [];` ⇒ 我们 state=2、runtime 有值，唯独 schema 为 undefined ⇒ 跳过；
  - `dsh-client-ui-settings/lib/client.js:1214 const view = mirrored.view.namespaces.find((candidate) => candidate.ns === this.spec.namespace);`、`:1215-1217` 取不到即 `draft.status = "unavailable"`；
  - `client.js:273`（仓库 `dsh-handoff-relay`）`status === "loading" ? ... : "Host 未提供该条目"` ⇒ 行底文案是果，不是因。
- 结论：行底「Host 未提供该条目」＝ Config undefined 的下游表现，证据链支持「不需要『宿主没写进 view』这种解释」。

### C4 隔离有效性 —— 成立
- 探针日志落在 `%TEMP%\dsh-probe-1114\home\profiles\probe\dsh-handoff-relay\relay.log`；日志内 `env="C:\Users\<用户名>\AppData\Local\Temp\dsh-probe-1114\home\profiles..."`，profile 根确为 TEMP 副本。
- 用户在用实例 `C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\relay.log`：`PROBE-DESCRIBE` 命中 **0** 行（mtime 08:12:06）。未污染。
- 另核：`.done` 94B 在 `delivered\83e63d6cfdfa\p25-describe-probe.done`（08:13:19），投递副作用符合插件现有行为，不属探针。

## 须修正（改口径，不拦）

1. §5「同一份代码」字面不成立。`%TEMP%\dsh-probe-1114\repo\index.js` 为 **1,158 行**，HEAD `index.js` 为 **1,112 行**；`git hash-object --path index.js` → `dc672612b9edf4cf70fd2923431cb4331eb68559`，HEAD → `489389d9c6c9999006219338313cec8ea23de0fe`。差异仅插桩：`let __cfgError = null;`、`} catch (err) { __cfgError = err;`、`PROBE-DESCRIBE v2` 块；`buildConfigSchema()` 的 schema 结构与 catch 降级行为未改。请改成「HEAD + 只读插桩副本」，别写「同一份代码」。
2. §0 第 2 条「在真机同样成立」是定性推断，不是读数；§5 自己已承认真机未直接读 `runtime.Config`。请降级为「真机现象链对齐、按同代码/同运行时推断成立」，或补一条真机只读读数。

## 不在范围（已确认）
- 修法设计、client 侧数据源、`ctx.sessions` 为何空：本轮未测，报告已单列，不计入本次判定。
