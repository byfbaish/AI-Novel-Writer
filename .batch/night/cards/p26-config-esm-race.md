# P26 · 修 Config 求值时机：ESM race 导致 Config=undefined

- 仓库：`C:\develop\workspace\dsh-handoff-relay`（HEAD 起点 `8d562a0`）
- 估时：40 分钟
- 派卡：AI writer总负责人 → 豆包联络人 → 豆包
- 依据：`.batch/night/reports/p25-describe-probe.md`（8,491B / MD5 `0DA7A79B5C08E237ADEBEB5726C63D7D`）

## 一、要修的是什么（不是猜的，是 P25 打出来的）

真机行底「Host 未提供该条目」的链路已经闭合：

```
index.js:56  export const Config = buildConfigSchema();   // 模块求值期
index.js:99  loadSchemastery() 用 createRequire(<profile>/package.json)
             → require('@deepseek-ai/schemastery')
             → 抛 ERR_REQUIRE_ESM_RACE_CONDITION（其依赖 cosmokit/lib/index.js 是 ESM，此刻未加载完）
index.js:52  catch { return undefined; }                  // 被静默吞掉
→ dsh-settings describe() 判 schema===undefined 跳过本 entry
→ 客户端 status="unavailable" → 行底「Host 未提供该条目」、会话搜索拿不到快照
```

同一进程 3 秒后重新解析即成功（P25 的 `resolveOK`），说明**解析基线没问题，是求值时机**。

## 二、必做（按顺序）

1. 新增一个异步加载器，替换模块顶层的同步 require 路径：

   ```js
   async function loadSchemasteryAsync() {
     const baseFile = path.join(profileRootDir(), 'package.json');
     const resolved = null;
     try {
       const req = createRequire(baseFile);
       const resolvedPath = req.resolve('@deepseek-ai/schemastery');
       const mod = await import(pathToFileURL(resolvedPath).href);
       const z = mod && (mod.default ?? mod);
       if (!z || typeof z.object !== 'function') throw new Error('schemastery 模块形态不符');
       return { z, resolved: resolvedPath, error: undefined };
     } catch (err) {
       return { z: undefined, resolved: undefined, error: err };
     }
   }
   ```

   要点：**走 `import()`（ESM 加载器）而不是 `require()`**，让 cosmokit 这类 ESM 依赖由图加载完成；`pathToFileURL` 从 `node:url` 引入。

2. 模块顶层用 top-level await 求值，`Config` 仍是同步导出：

   ```js
   const SCHEMA_LOAD = await loadSchemasteryAsync();
   function buildConfigSchema(z) { if (!z) return undefined; return z.object({ ...原样... }); }
   export const Config = buildConfigSchema(SCHEMA_LOAD.z);
   ```

   - 任何异常都不许冒泡成 fatal：加载失败就是 `Config = undefined`（现有语义），watch 照常。
   - schema 结构**逐字不变**：`watches: z.array(z.object({dir,targetTitle,targetSessionId,exact,done:z.any()})).volatile().default([])`、`stableMs: z.number().default(DEFAULT_STABLE_MS).volatile()`、`message: z.string().default(DEFAULT_MESSAGE)`。

3. `mountSettingsCard`（`index.js:746` 起）里那处 `const loaded = loadSchemastery();` 改为**复用上面模块级结果**；失败分支保留现有 warn 文案与基线路径，并追加 `error` 原文（`String(err)` 或 message），方便以后取证。

4. 测试（`index.test.mjs`）：
   - 现有 **131/131 必须全绿**。
   - 新增两条：
     a) 加载失败路径（注入一个 reject 的加载器）→ `Config === undefined`，且 `apply` 不抛；
     b) 加载成功路径 → `Config` 的 `dict`/字段含 `watches`、`stableMs`、`message`，且 `watches` 与 `stableMs` 的 `meta.volatile === true`。

## 三、禁动区（越界即打回，不讨论）

- 只动 `index.js` 与 `index.test.mjs`。**`client.js` 一个字节都不动**（P22b/P22c 刚验完）。
- 不改解析/投递/重扫/标题绑定逻辑；不改 `inject = ['agents']`；不改 `SETTINGS_NS`。
- 不新增 `package.json` 依赖、不 `npm install` 到仓库、不把 schemastery 抄进来。
- 不碰 `cordis.patch.yml`、不碰在用 profile。

## 四、交付要求（缺一项不收）

1. 提交（前缀 `fix:` / `test:`），**`git add` 点名文件**，禁 `-A`。
2. 回执必须贴：`git log --oneline -2`、`git status --porcelain`（须空）、`git show --numstat HEAD` 原文、`node index.test.mjs` 的最后几行（含总条数）。
3. 报告 `.batch/night/reports/p26-config-esm-race.md`，末行 `<!-- DONE -->`。
4. **报告落盘的同一分钟内**写信号 `.batch/night/signals/p26-config-esm-race.done`（内容一行即可）；写不进要当场在回执里明说，不许沉默。

## 五、给 QA 的判据（这卡交付后由 QA 首验）

- C1 只含 `index.js`、`index.test.mjs` 两文件，`client.js` blob 与 `8d562a0` 相同。
- C2 顶层 `await` 真实存在，且 `Config` 由它之后求值（不是仍在同步 require）。
- C3 加载失败不会 throw（测试 a 真跑，不是注释）。
- C4 测试全绿且总数 > 131。
- C5 反证：把 `import()` 改回同步 `require()`，测试 a/b 中至少一条变红。
## 六、投递指令（联络人 2026-11-14 08:1x 投前核对，按最新盘面重述；与上文冲突以本节为准）

投前基线（我实跑）：仓库 `C:\develop\workspace\dsh-handoff-relay` 的 `HEAD=8d562a052e8f`、`git status --porcelain` 空、`node index.test.mjs` = `TOTAL: 131/131 PASS / RESULT: PASS`。

1. **改动范围**：只动 `index.js` 与 `index.test.mjs`。`client.js` 一个字节都不动（P22b/P22c 刚验完）。
2. **schema 结构逐字不变**，只换来值方式（同步 `require` → `import()` + 顶层 await）。加载失败仍 `Config = undefined`，不许冒泡成 fatal。
3. **信号文件（交付的一部分，不是可选项）**：报告落盘后同一分钟内写
   `C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p26-config-esm-race.done`
   （三行：报告路径 / 提交 SHA / `<!-- DONE -->`）。卡面 §四.4 写的路径少了 `doubao\` 这一层，以本节绝对路径为准；写不进立刻在回执里说「信号未写 + 原因」。
4. 回执须含：`git log --oneline -2`、`git show --numstat HEAD` 原文、`node index.test.mjs` 末几行（含总条数）、porcelain。
5. 交付后不要再往这张卡上加提交；报告里的数字以最终 HEAD 为准，改了必须同步改报告与信号里的 SHA。

回执照旧四行 + 模型芯片 + HEAD/字节/MD5。
