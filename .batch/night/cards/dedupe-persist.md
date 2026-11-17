# 卡：去重表落盘（同一产物对同一目标只投一次）

## 基线

- 仓库 `C:\develop\workspace\dsh-handoff-relay`，`git rev-parse HEAD` = `e114e4408962d6d2dd6ad99fc7fa1a545db77467`，`git status --porcelain` 无输出
- 现有测试：`node index.test.mjs` → `TOTAL: 56/56 PASS`，exit 0（**这 56 条一条都不许删、不许弱化断言**）
- 规格（只读，按它做，不要另设计）：`C:\develop\workspace\AI-writer\develop\.batch\night\essays\dedupe-spec.md`（v2，§3 功能 / §4 判据 / §5 已定）
- 背景与裁定的来龙去脉：`C:\develop\workspace\AI-writer\develop\.batch\night\reports\dedupe-decision.md`

## 问题

去重表是内存态：`index.js:204` 每个 watch 一个 `new Set()`，`dispose()` 时清空，从不落盘。于是热重载或重启后，目录里的存量文件会被重新扫一遍全部再投一次（现场证据：同一个文件 61 分钟内被投两次，内容一个字节没变）。

## 要做的事

按规格 §3 实现，要素如下（细节以规格为准）：

1. **状态文件**：`<profile 根>/dsh-handoff-relay-state.json`，单文件单表，所有 watch 共用；**必须在任何 watch 目录之外**（否则自写触发事件，自激）。原子写：写临时文件再 rename。
2. **表结构**：`{ "version": 1, "entries": { "<dir>|<relName>|<mtime>|<size>": { "deliveredAt": ISO, "targets": [...] } } }`。指纹**不含目标**；目标标识用配置原样值（`targetSessionId` 原样，`targetTitle` 写成 `title:<…>`）。
3. **判重**：同指纹 + 同目标已在 `targets` → 跳过；同指纹 + 新目标 → 照投并追加。同目录两条 watch 各自独立，互不吞。
4. **记录时机**：只在投递**成功后**追加。解析不到目标、或多条命中不投 → 不记录（现状不变）。记录失败不影响投递。
5. **上限裁剪**：上限 500 个指纹，超出按 `deliveredAt` 淘汰最旧，连带其 `targets`；裁剪与写入在每次投递成功后一并做。
6. **降级**：文件不存在 → 空表；JSON 坏 / 结构不符 / version 不认识 → 整表丢弃 + `warn` 并从空表重建，**不禁用功能**；写入失败（磁盘满 / 只读 / 权限）→ 只 `warn`，本次投递照常，内存表继续用；不重试、不阻塞。
7. **不为去重丢投递**：宿主停机期间落盘的文件，启动后仍要补发一次。

## 禁改

- `source:` 那一行逐字不许动（按内容核验，不要按行号找）
- 配置 schema 不加任何字段（**不许加 `watchId`，不许加上限配置**，500 写死）
- 不改 `cordis.patch.yml`、不碰 `package.json`（version 不动）、不碰 README 与 `docs/`
- 不许重启任何进程、不许往 watch 目录丢探针、不许 push、不许打 tag
- 不引入任何依赖（保持零依赖）

## 判定线

1. `TOTAL:` 行不得低于 `56/56`，且新增测试覆盖规格 §4 末尾列的测试点：指纹随 mtime/size 变化而不同、同指纹新目标可投、同指纹同目标跳过、裁剪淘汰顺序连带 targets、损坏容错、写失败降级（mock fs 抛错）、未投不记、原子写（临时文件 + rename）。
2. 状态文件路径在任何 watch 目录之外，代码里能一眼看出（日志里打一次最终路径）。
3. 加载时打一行日志说明状态文件路径与已载入条目数。
4. `git status --porcelain` 落盘后为空；提交只含 `index.js` 与 `index.test.mjs`。
5. 报告里附 `node index.test.mjs` 的 `TOTAL:` 行原文与 exit code。

## 提交

点名 `git add index.js index.test.mjs`，`git commit -m "fix: persist the delivered table so reloads stop replaying old files"`。禁止 `git add -A` / `git add .`；不许 push。

## 产物

- 代码提交（SHA 写进报告）
- `.batch/night/reports/dedupe-persist.md`：改了什么、状态文件最终路径、测试 `TOTAL:` 行原文、新增测试点逐条对应，末尾 `<!-- DONE -->`
- `.batch/night/signals/doubao/dedupe-persist.done`：三行（产物路径 / 提交 SHA / `<!-- DONE -->`）
