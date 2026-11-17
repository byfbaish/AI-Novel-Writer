# 去重表落盘 · 交付报告

- 仓库：`dsh-handoff-relay`（零依赖，engines node>=20）
- 基线 HEAD：`e114e4408962d6d2dd6ad99fc7fa1a545db77467`（porcelain 空）
- 提交 SHA：`85142691ca5c5533503c5fe3f584fb5930b03286`
- 提交文件（`git show --numstat --format= HEAD`）：
  - `index.js` 140+ 2-
  - `index.test.mjs` 299+ 1-
- 落盘后 `git status --porcelain`：空

## 1. 改了什么

### index.js

1. 新增常量：`STATE_FILENAME = 'dsh-handoff-relay-state.json'`、`STATE_VERSION = 1`、`MAX_FINGERPRINTS = 500`。
2. 新增状态文件路径解析：
   - `profileRootDir()`：优先 `DSH_PROFILE_DIR`（绝对路径）；否则 `os.homedir()/.dsh/profiles/${DSH_PROFILE || 'desktop'}`。
   - `resolveStateFile(watchDirs)`：候选路径（`DSH_RELAY_STATE_FILE` 覆盖优先，其次 profile 根）若落在任一 watch 目录内，则改到 `os.homedir()/.dsh/dsh-handoff-relay-state.json`，仍冲突则退到 `os.tmpdir()`，并打一行 warn「状态文件路径落在 watch 目录内，已改到 …」。改道是为避免自写触发事件、形成自激。
3. 新增 `parseState(raw)`：严格校验（顶层对象、`version === 1`、`entries` 为对象、每条含 `deliveredAt` 字符串与 `targets` 字符串数组）；任一处不符抛错。
4. 新增 `createStateStore(ctx, file)`：
   - 读：文件不存在（ENOENT）→ 空表；JSON 坏 / 结构不符 / version 不认识 → 整表丢弃 + warn「整表丢弃并从空表重建（功能不关闭）」，不禁用功能。
   - `isDelivered(fp, targetId)`：同指纹 + 同目标 → 跳过。
   - `record(fp, targetId)`：同指纹新目标追加 targets，更新 `deliveredAt`；随后 `trim()` + `write()`。
   - `trim()`：超过 500 个指纹按 `deliveredAt` 升序淘汰最旧，连带其 `targets`。
   - `write()`：临时文件 `.<basename>.<pid>.<rand>.tmp` + `renameSync` 原子替换；先 `mkdirSync(dirname, {recursive:true})`；失败 rm 临时文件 + warn「状态文件写入失败（本次投递照常，内存表继续用）」，不重试、不阻塞。
   - `fingerprint(dir, relName, state)` = `` `${dir}|${relName}|${state.mtimeMs}|${state.size}` ``（不含目标）。
   - `targetIdOf(target)`：`targetSessionId` 原样；`targetTitle` 写 `title:<…>`。
5. `startWatch` 新增 `store` 参数；`deliver()` 在目标解析成功、真正 followup 之前做落盘判重：命中则 info 日志「跳过重复投递：…（目标 X 已收到过同一快照，指纹=…）」并 return；`followup` 成功后 `store.record(fp, targetId)`。解析不到 / 多命中不投的路径不记录（原逻辑未动）。
6. `apply()` 在创建 watchers 前收齐可读的 watch 目录（绝对路径且 `statSync().isDirectory()` 通过），解析最终状态路径，创建单一 store，并打一行 info：
   `状态文件：<最终路径>（已载入 N 个指纹[，损坏已重建]）`。
7. `source:` 行逐字未动（工作区与 `HEAD:index.js` 同行为 `source: Object.freeze({ kind: \`plugin:${PLUGIN_NAME}\` }),`）。

### index.test.mjs

1. 顶部（任何 `apply()` 之前）把 `DSH_RELAY_STATE_FILE` 指向 `mkdtempSync(os.tmpdir())` 下的临时文件——既有 56 条测试不会写真实 profile（已核：`C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay-state.json` 提交前后均不存在）。
2. `capturingWatch()` 增加 `cbs` 数组（保留 `cb` 为最后一次，既有用例不变），用于同目录多条 watch 的用例分别触发。
3. 新增 P7 用例 11 条，逐条对应规格 §4 末尾 8 个测试点：

| 规格测试点 | 对应用例 |
|---|---|
| 同指纹同目标跳过（热重载不重放） | P7 首次投递成功并落盘（version=1，指纹含该文件）；P7 重载后同一文件同一目标不再投递（同指纹同目标跳过） |
| 指纹随 mtime/size 变化而不同 | P7 指纹随 mtime/size 变化而不同：同文件改写后再投一次（状态表出现 ≥2 个指纹） |
| 同指纹新目标可投 | P7 同指纹新目标可投：同目录两条 watch 各投一次，表内追加两个目标 |
| 裁剪淘汰顺序（连带 targets） | P7 裁剪：预置 500 条后投 1 条 → 恰好 500 条、`seed-0` 与其 targets 消失、`seed-499` 与最新保留 |
| 损坏容错 | P7 损坏容错：坏 JSON → warn「整表丢弃」、投递照常、文件重建为 version 1 |
| 写失败降级（mock fs 抛错） | P7 写失败降级：mock `writeFileSync` 抛 EACCES → 投递 1 条、warn「状态文件写入失败」、不抛 |
| 未投不记 | P7 未投不记：解析不到目标 → 0 投递，状态文件不存在 |
| 原子写（临时文件 + rename） | P7 原子写：捕获 `renameSync` 参数 → 第一参以 `.tmp` 结尾、第二参等于状态文件路径、无 .tmp 残留 |
| 判定线 2：路径在 watch 目录之外 | P7 状态文件不在任何 watch 目录内：`DSH_RELAY_STATE_FILE` 故意指向 watch 内 → warn「已改到」、最终写 profile 根、watch 目录内无 state 文件 |
| 判定线 3：加载日志带路径与条目数 | P7 加载日志：状态文件路径 + 已载入条目数（预置 2 条 → 日志「已载入 2 个指纹」） |

既有 56 条断言未删、未弱化。

## 2. 状态文件最终路径

- 默认（desktop profile，本机）：`C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay-state.json`
- 解析顺序：`DSH_RELAY_STATE_FILE`（绝对路径，测试/运维覆盖）→ `DSH_PROFILE_DIR`/`<home>/.dsh/profiles/<DSH_PROFILE 或 desktop>`。
- 代码保证：最终路径落在任一 watch 目录内时自动改道并 warn（`resolveStateFile` 里 `isInsideDir` 判定），启动日志完整打出最终路径。

## 3. 测试证据

命令：`node index.test.mjs`

```
TOTAL: 67/67 PASS
RESULT: PASS
```

exit code：`0`（基线 56/56 → 67/67，新增 11 条）。

## 4. 判定线核对

1. TOTAL 行 67/67，≥56/56；8 个测试点全部覆盖（映射见 §1）。✅
2. 状态文件路径由 `resolveStateFile` 显式保证在 watch 目录之外；启动日志打一次最终路径。✅
3. 加载日志：`状态文件：<path>（已载入 N 个指纹…）`。✅
4. `git status --porcelain` 为空；提交只含 `index.js`、`index.test.mjs`。✅
5. 报告附 TOTAL 行原文与 exit code（见 §3）。✅
6. `source:` 行逐字未动。✅

## 5. 不确定 / 需判定

- **profile 名来源不确定**：`DSH_PROFILE_DIR` / `DSH_PROFILE` 是本次实现采用的约定；在本机 `@deepseek-ai/dsh` 安装目录里 grep `DSH_PROFILE|PROFILE_DIR` 0 命中（本次读取的文件内未找到），因此多 profile（web/headless）下默认都会解析到 `profiles/desktop/`，状态表跨 profile 共享。去重语义不因此失效（路径仍在 watch 目录之外），但「每个 profile 独立表」当前做不到——标记为不确定，待负责人/QA 判定是否接受。
- `DSH_RELAY_STATE_FILE` 是测试/运维用的环境变量覆盖，不是配置 schema 字段（未新增任何配置项、未加 `watchId`、500 写死）。若判定线要求「状态路径只允许 profile 根」，需去掉该覆盖并改用其他测试隔离手段。
- G1–G3（热重载 / 重启不重放、停机补发）属真实宿主验证，本卡只用单元测试证明「同指纹同目标跳过」与「新指纹照投」；未在本轮重启任何进程。

<!-- DONE -->
