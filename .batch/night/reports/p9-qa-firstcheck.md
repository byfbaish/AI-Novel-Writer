# P9 首验 · 移走失败止血（retry + 不再重投 + 最小日志）

- **结论：PASS**（可提交，提交由总负责人点名）
- 派验单：`.batch/night/review-requests/P9.md`（五字段齐，落点已按 `.md` 归一）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`，基线 `6563d27`，未提交
- 首验时刻：2026-11-13 22:16
- 判据来源：卡面 `p9-failed-take.md` 五条 + 派验单追加「落点」一条

## 一、复核实测（我独立跑，不采信联络人转述）

| 项 | 我的读数 | 判定 |
|---|---|---|
| `node index.test.mjs` | `TOTAL: 77/77 PASS` / `RESULT: PASS` / exit 0 | ✓ |
| porcelain | 仅 `M index.js`、`M index.test.mjs` | ✓ |
| numstat vs `6563d27` | `165/17 index.js`、`236/0 index.test.mjs` | ✓ |
| `source:` 行 | 现值 `index.js:427` 与 `git show 6563d27:index.js` **内容逐字相同**（按内容比对，不看 diff 行数） | ✓ |
| 新用例真断言 | 8 条全非空转（见下） | ✓ |

## 二、逐条判据

1. **先建目录再 rename、失败重试 3 次（100ms）成功** — 实现：`takeDelivered` 里 `mkdirSync(path.dirname(target))` 单独兜错 → `giveUp('建目录')`；随后循环 `attempt 1..RENAME_RETRIES`，EXDEV 走 copy+rm 且 copy 失败也计入重试，非末次 `sleepSync(100)`。测试断言 `attempts === 2` **且**首次 rename 时目标目录已存在（`dirExistedAtCall[0] === true`），比只看「成功」更硬。✓
2. **三次全失败写 `failed.json`，下次加载命中跳过不重投** — `giveUp` 里 `rememberFailed(finger/name/dirKey/at/err)` + `relayLog`；`isFailedSnapshot` 在 `deliver()` 入口与 watch 回调各查一次。测试：重载同目录后 `calls.length` 仍为 1、出现「跳过已失败件」warn，且 `entry.finger` 逐字符等于 `${d}|giveup.txt|${mtimeMs}|${size}`。跨进程语义成立（`apply()` 期 `loadFailedRegistry` 读盘）。✓
3. **200 条上限 + 坏 JSON 整表丢弃** — 预置 250 条失败后落盘恰 200，`seed-0` 被裁、`seed-249` 与本次件保留；坏档只 warn 不抛、`calls.length === 0`。✓
4. **`relay.log` 三路径 + >256KB 截断留末尾一半** — 代码三路径齐（`relayLog` 调用点：启动 `index.js:655`、`giveUp` `:219`、`skipFailed` `:483`）；截断逻辑先判 `size > MAX_LOG_BYTES` 再 `subarray(len-128KB)` 后追加。测试断言截断后 ≈128KB+本次行、尾部含失败行、启动行 ISO 前缀。✓
5. **`TOTAL` ≥69、`source:` 不变、porcelain 只两文件** — 77/77、逐字同内容、两文件。✓
6. **落点（追加项）** — `relayStateDir()` = `path.join(profileRootDir(), 'dsh-handoff-relay')`（`index.js:65`），`profileRootDir()` 在 `:41`。我按 7 条 watch 实目录逐个前缀比对：`C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay` 与 7 个 watch 目录**互不为前缀**，不在任何 watch 目录内。✓

## 三、记（不拦，成本低时随下轮带掉）

1. **无运行时兜底**：`delivered` 有 `resolveDeliveredRoot(watchDirs)` 改道保护，`relayStateDir()` 没有同款断言。当前配置下安全，但若将来把 watch 指到 profile 根，`relay.log` 每次追加会自激成事件源。建议 3 行：`if (watchDirs.some(d => isInsideDir(d, stateDir))) warn + 改到 os.tmpdir()`（`isInsideDir` `:48` 已在）。
2. **「三路径都要有行」的测试只硬断言了两条**：启动行与失败行有日志断言；跳过路径只断言了 warn 文案，没断言 `relay.log` 里那一行。实现是有的（`skipFailed` 同时写 log+relayLog），建议补一行断言而不是补机制。
3. **`giveUp` 会把失败件永久标记**（直到被 200 条上限挤出或文件 size/mtime 变化）。若 delivered 目录短时权限异常，这批文件之后不会再投第二次——与「宁可漏发一次也不重投」一致，属刻意取舍，记录备查。

## 四、改（交付物内事实错误，一行）

报告 `.batch/night/reports/p9-failed-take.md`「改动范围」写 `index.js（+182/-17）`，实测 `165/17`（`git diff --shortstat 6563d27 -- index.js` → `1 file changed, 165 insertions(+), 17 deletions(-)`）。旁边 `index.test.mjs（+236）` 是对的。改这一个数字即可，不影响判定。

## 五、范围外（不进本次判定）

- 未上真实 DSH 运行态（卡面不许重启），本轮全部证据来自纯 node 单元测试——按卡面口径不算缺口，但「现场 `delivered\dad6df13f302\` 为空」的根因仍未复现，属下一轮（重启后验「`wake-later.done` 不再重投」）的事。
- 报告自述「`Write-Error` 级别」措辞不准确（本项目走 `ctx.logger.warn`），非事实错误，不单列。

<!-- DONE -->
