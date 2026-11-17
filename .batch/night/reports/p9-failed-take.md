# P9：投递后移走失败的止血（重试 + 不再重投 + 最小日志）

报告落点：`C:\develop\workspace\AI-writer\develop\.batch\night\reports\p9-failed-take.md`（与既有 `p8-*.md` 同目录）。

## 改动范围

仓库：`C:\develop\workspace\dsh-handoff-relay`（基线 HEAD `6563d27`、开工时 `git status --porcelain` 为空）。
只改两个文件：

- `index.js`（+165/-17）
- `index.test.mjs`（+236）

`git status --porcelain` 结果只有这两行：` M index.js`、` M index.test.mjs`。未 commit、未 push（红线 2：提交权不在我）。

## 实现

### 1. `takeDelivered`（`index.js`）

- 顺序改为：**先 `mkdirSync(dirname(target), {recursive:true})`，再 rename**；建目录单独兜错。
- rename 失败重试 **3 次**，间隔 100ms（`sleepSync` 用 `Atomics.wait`，保持 `takeDelivered` 的同步语义，不引入异步时序）。
- `EXDEV` 仍走 `copyFileSync + rmSync`，copy 失败也计入重试。
- 三次全失败：`Write-Error` 级别的 warn（`移动已投递文件失败（rename，已重试 3 次）`）+ 记 `failed.json` + 写 `relay.log`；投递本身不回滚。
- 成功路径不写 `failed.json`（有测试断言）。

新增常量：`RELAY_STATE_DIRNAME='dsh-handoff-relay'`、`FAILED_FILENAME='failed.json'`、`RELAY_LOG_FILENAME='relay.log'`、`MAX_FAILED_ENTRIES=200`、`MAX_LOG_BYTES=256*1024`、`RENAME_RETRIES=3`、`RENAME_RETRY_DELAY_MS=100`。

### 2. `failed.json`（`<profile 根>/dsh-handoff-relay/failed.json`）

- 记录 `{ finger, name, dirKey, at, err }`；`finger = <watchDir>|<relName>|<mtimeMs>|<size>`，与内存 `Set` 的 `(文件,size,mtime)` 口径一致，外加目录避免同名误伤。
- 载入：`loadFailedRegistry` 每个 `stateDir` 读一次；**坏 JSON / 顶层非数组 / 缺 finger** → 整表丢弃 + warn（`failed.json 坏档，整表丢弃`），不抛。
- 命中：`consider()` 与 `deliver()` 两处都查（防 pending timer 在失败记录后仍投），命中即 `跳过已失败件（上次投递成功但移走失败，不再重投）` warn + `relay.log` 一行。
- 上限：超过 200 条按 `at` 升序裁掉最旧；写盘失败只 warn，不影响投递。

### 3. `relay.log`（`<profile 根>/dsh-handoff-relay/relay.log`）

- 追加写，行格式 `<ISO 时间> <LEVEL> <消息>`。
- 只写三条路径：启动（`启动 N/M 个 watch…`）、移动失败、跳过已失败件。
- 写入前若文件 `>256KB`，截断为末尾一半（128KB）再追加。
- 未加配置项、未加日志级别。

### 4. 未动

- `source`：`git show HEAD:index.js` 与工作区逐字比对，均为 `source: Object.freeze({ kind: \`plugin:${PLUGIN_NAME}\` }),`。
- watches 解析、`delivered/` 清理逻辑、`resolveDeliveredRoot` 改道逻辑均未改。

## 验收（`node index.test.mjs`）

```
PASS  P9 先建目录再 rename：第一次失败、第二次成功，文件进 delivered/<dirKey>/
PASS  P9 成功路径不写失败台账
PASS  P9 rename 三次全失败 → 写 failed.json（finger/name/dirKey/at/err）
PASS  P9 重载后命中 failed.json → 跳过投递（消息只发过 1 次）
PASS  P9 failed.json 超过 200 条 → 保留最新 200，最旧的被裁掉
PASS  P9 failed.json 坏 JSON → 不抛、整表丢弃并 warn
PASS  P9 relay.log 超过 256KB 被截断（保留末尾一半），并写入本轮失败行
PASS  P9 relay.log 只在启动 / 失败 / 跳过三条路径写行（启动行存在且带 ISO 时间）
TOTAL: 77/77 PASS
RESULT: PASS
```

对判定线：

1. 新测试 `第一次失败、第二次成功`：断言 `attempts === 2`、且**第一次 rename 调用时目标目录已存在**（证明 mkdir 在 rename 之前），最终文件在 `delivered/<dirKey>/` 内。
2. 新测试 `rename 三次全失败 → 写 failed.json` + `重载后命中 failed.json → 跳过投递`：重载同一目录后 `calls.length` 仍为 1（消息只发 1 次），并出现 `跳过已失败件` warn。
3. `超过 200 条` 断言：预置 250 条，失败后落盘 200 条、`seed-0` 被裁、`seed-249` 与本次 `cap.txt` 保留；`坏 JSON` 只 warn 不抛。
4. `relay.log`：预置 >256KB 填充，失败后文件回落到 ≈128KB+本次行，尾部含 `移动已投递文件失败`；启动行匹配 ISO 时间前缀。
5. `TOTAL: 77/77 PASS`（≥ 69/69）；`source:` 与父提交逐字相同；porcelain 只有两个文件。

## 不确定 / 未做

- **未在真实 DSH 运行态验证**（按卡面不许重启 DSH）。本修复的全部证据来自 `node index.test.mjs`（纯 node 单元测试，不注入 DSH）。
- `failed.json` 的 finger 依赖 `mtimeMs` + `size`：若有人**原地改写**同一个文件名且恰好 size/mtime 相同，仍可能被当作已失败件跳过；这是刻意取舍（宁可漏发一次，不再重投）。**不确定**是否满足负责人对「同文件多次改内容」的预期。
- 现场那件 `signals\doubao\wake-later.done` **未清理**，按要求留给重启后验「不再重投」。
- 现场根因（为什么 `delivered\dad6df13f302\` 空）本次未复现、未取证；本轮只做「失败也能止血」的兜底，**不确定**原竞态是否已被覆盖——若基准目录建好但 rename 仍偶发失败，现在会重试 3 次并落台账，不会重投。
- 本机 `git` 不在 PATH，使用 `C:\develop\software\Git\cmd\git.exe` 读状态；未执行任何写操作，故信号里的「提交 SHA」写基线 `6563d27` 并标注未提交。

<!-- DONE -->
