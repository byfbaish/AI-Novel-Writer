# P8 投递后「拿走」+ 旧件清理 · 交付报告

## 提交

- SHA：`6563d27f3c74ffba4f5be575223fbbfb0c6e1bcf`
- message：`feat: move delivered files out of the watch dir and prune old ones`
- `git show --numstat --format= HEAD`：

```
93	107	index.js
174	216	index.test.mjs
```

- 基线 HEAD：`f33748ea3ac3679ecc9c261e9650f3cd0e12b456`，开工时 porcelain 空
- 提交后 `git status --porcelain`：空，只含 `index.js`、`index.test.mjs`

## 改动说明

### 1. 投递成功后移动文件

- 落点：`<profile 根>/dsh-handoff-relay/delivered/<dirKey>/<原文件名>`
- `dirKey = sha1(规范化绝对路径).slice(0, 12)`；Windows 下先转小写再哈希（路径大小写不敏感）。不用下标、不用可读长路径，保留原文件名。
- 默认最终路径（本机 desktop profile）：`C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\delivered`；测试通过 `DSH_PROFILE_DIR` 指到临时目录，未写真实 profile。
- 移动在 `followup` 成功后的**微任务**里执行（`queueMicrotask`），因此同步投递路径（既有测试的 `statSync` 断言）不感知尚未移走；实际仍紧接投递完成。
- 移动实现：`mkdir -p` → 覆盖同名旧副本 → `rename`；跨卷（`EXDEV`）退化为 copy + unlink。
- 移动失败（权限 / 只读 / 其他）：只 `warn`「移动已投递文件失败（投递已完成，不重试）」，投递结果不回滚、不重试、不阻塞。文件留在原处，下次重载可能再投一次——按卡面「宁可多投，不可不投」。
- 文件已被前一次移动取走（同名二次投递的微任务晚到）：静默跳过，不产生噪音 warn。

### 2. 退役状态表

- 删除 `8514269` 引入的 `STATE_FILENAME` / `STATE_VERSION` / `MAX_FINGERPRINTS`、`parseState` / `createStateStore` / `fingerprint` / `targetIdOf`、`resolveStateFile` 与 `store` 参数；代码里不再有任何去重表读写。
- 核验命令与结果：

```
Select-String -Path index.js,index.test.mjs -Pattern "STATE_|DSH_RELAY_STATE_FILE|createStateStore|fingerprint\(|状态文件"
（无匹配）
```

- 删除测试里的 `DSH_RELAY_STATE_FILE` 钩子与 P7 的 11 条状态表用例（机制已退役，断言无对象）；总数通过新增 P8 用例补回并超过基线。
- 状态文件若用户机器上已存在，不删除、不读取（本机实际未生成：`C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay-state.json` 不存在）。

### 3. 旧件清理

- 每次成功移动后顺带扫描 `delivered/`：单个文件 `mtime` 早于 7 天 → 删除；剩余数量 >1000 → 按 `mtime` 升序删最旧，直到 1000。
- 1000 与 7 天写死，不加配置项。
- 只遍历 `delivered/` 自身，绝不触碰 watch 目录；清理整体或单件失败只 `warn`，不影响投递。

### 4. 一个目录一个目标

- 加载时按 `dirKeyOf(dir)` 去重：同目录的第二条及以后 `warn` 并跳过，文案含「一个目录只支持一个目标，多播需走发布订阅模式，本期不支持」。
- 保留第一条（按配置顺序）。

### 5. 加载日志

- 每条 watch 一行：`已加载：dir=…，目标=… → 解析到 …/解析不到…，stableMs=…，done=…，delivered=<最终落点>`。
- 另有一行全局日志：`delivered 目录：<root>（每个 watch 的落点见各自加载行）`。
- `delivered/` 默认在 profile 根，代码里 `resolveDeliveredRoot()` 校验它不在任何 watch 目录内；若重叠（例如 watch 了 profile 根）→ 改到 `os.tmpdir()/dsh-handoff-relay/delivered` 并 `warn`。

### 6. 停机补发与 `.gitkeep`

- `startWatch` 在 watcher 建立后对目录做一次启动扫描（`listFiles()` → `consider`）：停机期间留下的文件启动后补发一次；已投过的文件已被移走，不会重放。
- `.gitkeep` 在 `consider` 入口直接跳过：不投递、不移动。

## 测试

命令：`node index.test.mjs`

```
TOTAL: 69/69 PASS
RESULT: PASS
```

exit code：`0`（基线 67/67；删除 11 条已失效的状态表用例，新增 13 条 P8 用例）。

新增用例与判定线对应：

| 判定线 | 用例 |
|---|---|
| ① 移走后再次扫描不再投 | P8 投递成功后文件被移出 watch 目录…原文件名；P8 文件移走后再次事件/扫描 → 不再投递；P8 重载（重新 apply 同目录）→ 存量已移走，不重放 |
| ② / ⑤ 停机期间已存在的文件启动后仍投一次 | P8 停机期间就存在的文件：启动后补发一次；P8 启动补发的文件同样被移走 |
| ② 移动失败只 warn、投递照常 | P8 移动失败只 warn，投递照常、文件留在原处、不抛 |
| ③ 清理阈值 | P8 清理阈值：超过 1000 个文件删最旧，总量回落到 1000；P8 清理阈值：超过 7 天的文件被删除 |
| ④ 同目录两条 watch 只保留第一条 | P8 同目录两条 watch：只保留第一条，第二条 warn「多播需走发布订阅模式」且不投递 |
| ⑥ `.gitkeep` 不被移动 | P8 .gitkeep 不投递（启动扫描也跳过）；P8 .gitkeep 不被移动，普通文件被移走 |
| 判定线 2 日志 | P8 加载日志：dir / 目标 / done 模式 / delivered 最终路径；P8 delivered 落在 watch 目录内时改道到 tmpdir 并 warn |

既有 56 条断言未删、未弱化（`capturingWatch` 仅新增 `cbs` 数组，`cb` 行为不变）。

## 红线核对

- `source:` 行逐字未动（工作区与 `HEAD:index.js` 同一行为 ``source: Object.freeze({ kind: `plugin:${PLUGIN_NAME}` })``）。
- 配置 schema 未加字段；1000 / 7 天写死；零依赖（只新增 `node:crypto` 的 `createHash`）。
- 未碰 `cordis.patch.yml`、`package.json`、README、`docs/`；未 push / tag / 重启。
- 真实 profile 未被写入：`~/.dsh/profiles/desktop/dsh-handoff-relay` 与状态文件均不存在（测试用 `DSH_PROFILE_DIR` 隔离）。

## 不确定 / 需注意

- 启动扫描会让「目录里任何已完成文件」在加载时立刻投一次；这是「停机补发」的实现代价，与旧件清理配合后只在首次加载发生。若某实例的 watch 目录长期堆积已完成文件，首次启用会一次性投递全部——属预期，但会是一次突发流量，标记为提醒项。
- `dirKey` 取 sha1 前 12 位存在理论碰撞；碰撞只会导致两个目录的已投件混在同一桶（不影响去重语义，文件仍在 delivered 内），未加长位数以保持路径短。

<!-- DONE -->
