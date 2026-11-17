# P31 去重漏投 · 三条只读取证（developer，11-15 10:2x）

对象：`dsh-handoff-relay` 重复投递同一份文件（10:04:08 与 10:05:19 各一次「已就绪」通知）。
性质：只读取证，未改码、未改配置、未动运行中进程。

## 结论摘要

1. **dedupe key 与 delivered 目录 key 不是两套，是同一个函数算出来的**，`{{SECRET_…}}` 是安全层对同一实值的掩码 → **不是 bug**，不需要修。
2. 二次触发**不是「文件搬走后自己又触发」**：是 10:05:13 「负责人」自己的会话把已投递文件 `cp` 回了 watch 目录，文件被重建、mtime 变新；dedupe 的比对键是 `(路径, size, mtimeMs)`，**内容相同但 mtime 不同 ⇒ 判不成重复** → 二次投递。
3. **stable / DONE 双通道没有并发缺陷**：代码里同一快照只可能投一次；两次注入都带 `触发=DONE`，对应两次真实 fs.watch 事件（写入、再 copy 回来）。
4. 附带事实：`relay.log` **不是投递台账**——成功投递只写宿主 logger，`relay.log` 只收跳过/重扫/失败行。

## 证据链（可复核）

### A. 两个 key 同源

- `index.js:279-282` `dirKeyOf(dir)`：`createHash('sha1').update(win32 ? path.resolve(dir).toLowerCase() : path.resolve(dir)).digest('hex').slice(0, 12)`
- `index.js:415-418` `rememberDeliveredSnapshot`：`const dirKey = dirKeyOf(watchDir); const bucket = reg.dirs[dirKey] || ...`（dedupe.json 顶层 key）
- `index.js:496-498` `deliveredDirFor` / `index.js:536-537` `takeDelivered`：`path.join(deliveredRoot, dirKeyOf(watchDir), basename)`
- 实测：`dedupe.json` 顶层出现 `dad6df13f302`，同时 `delivered/dad6df13f302/` 目录存在，两者是**同一个掩码占位**（同一实值）；`bridge/to-owner` 对应 `462e69db07b3`，其一堆历史件都在该目录下。
- 判定：同源、同值。大肥鱼 观察到的「两套 key」是掩码造成的视觉差，不是缺陷。

### B. 二次投递的完整时序

| 时刻（本地） | 事实 | 证据 |
|---|---|---|
| 10:04:02 | 负责人 `write` 出 `to-owner\2026-11-15-1000-report.md` | 会话 `session-2f15b23e-…`（title=AI writer总负责人）seq 590 `tool/call name=write` |
| 10:04:08.242 | 该件被 rename 进 `delivered\462e69db07b3\` | 交付件 `CreationTime=10:04:08.242` |
| 10:04:08.260 | 注入 #1，`触发=DONE`，message id `803c6f5a-d656-49e2-82df-70c04feedf39` | 目标会话 `session-a1d48adb-…` `agent/inbox/spliced` seq 3782 |
| **10:05:13** | **负责人会话把 delivered 里那份 `cp` 回 `bridge\to-owner\`** | 同会话 seq 609 `ops_bash`：`cp ".../delivered/462e69db07b3/2026-11-15-1000-report.md" ".../bridge/to-owner/2026-11-15-1000-report.md"` |
| 10:05:19.058 | 回拷后的文件 mtime（交付件 mtime 就是这个值） | `LastWriteTime=10:05:19.058`，size 5279 不变 |
| 10:05:19.061 | 注入 #2，`触发=DONE`，message id `6fa700ad-9165-4b88-88a6-d46da1e32961` | 同会话 seq 3802 |
| 10:05:19.062 | dedupe 表被 #2 覆盖写入 | `dedupe.json` 该条目 `at=2026-11-15T02:05:19.062Z` |

- 比对键：`index.js:382` `bucket[path.resolve(watchDir, relName)] = { size, mtimeMs, at }`；`index.js:437-446` `isDuplicateSnapshot` 要求 `entry.size === state.size && entry.mtimeMs === state.mtimeMs` 且 `now - at < DEDUPE_WINDOW_MS`。
- 两次的 size 都是 5279（相同），mtime 从 10:04:08.x 变成 10:05:19.058（不同）⇒ 第一条件即失败，**与 30 秒窗口无关**（间隔 71s 也超窗）。
- `DEDUPE_WINDOW_MS = 30000`（`index.js:27`），只在「完全同快照」时才起作用。

### C. stable / DONE 是否双通道并发

- `index.js:1198-1227` `consider()`：同一 `(relName,sig)` 的重复事件在已有 timer 时直接 return；尾部有 DONE 就 `deliver(relName, state, 'DONE')` 并 return，否则起 stable timer。
- `index.js:1146-1148` `deliver()` 第一动作 `clearTimeout(state.timer); pending.delete(relName);`
- `index.js:1154` `checkStable()` 首行 `if (closed || pending.get(relName) !== state) return;`（已被投递/替换的旧 state 直接退出）
- 结论：同一快照不存在「DONE 先投 + stable 又投」；两次注入各带不同 message id，且都是 DONE → 两次独立事件。

### D. relay.log 的边界

- `index.js:79-85` `log()` → `ctx.logger`（宿主日志），**成功投递只用这个**（`index.js:1165` 已投递、`:1170` 已移走）。
- `index.js:470-486` `relayLog()` → `<profile>/dsh-handoff-relay/relay.log`，只收：去重跳过（`:447`）、解析不到、rescan、移走失败。
- 实测：`relay.log` 末行 `2026-11-14T22:50:38.310Z`（本地 11-15 06:50），10:04/10:05 的两次成功投递**不会**在里面出现；`dedupe.json` mtime 10:05 才是投递痕迹。
- 影响：任何「查 relay.log 有没有已投递行」的验收都会假红；反过来「跳过时留一行日志」这条**已经成立**（`skipDuplicate` 走 relayLog）。

## 修法选项（交负责人定，未写入任何卡面）

判据前提：同名文件**内容变了就必须再投**（报告重写重复投是正常需求），所以键里必须带内容维度，不能只按路径一票否决。

- 选项 1（推荐）：dedupe 条目加 `contentHash`（`sha1(文件字节)`，前 12 位），判重条件改为「size+mtime 相同」**或**「contentHash 相同且路径相同」；保留 `at` 只作诊断。
- 选项 2：每路径改成「已投递 contentHash 集合（环形，保留最近 N 个）」，命中即跳过并写 relayLog；可跨重启（已在 dedupe.json 里）。
- 选项 3（运维侧，零改码）：禁止向被 watch 的目录 `cp` 回已投递文件；需要复核就读 `delivered/` 那份。本次根因正是这一条，但挡不住未来别人再犯，只能算纪律。

## 复现用例建议（供 P31 卡面裁决，我只是提出）

- TC1：写件 → DONE 投递 → **从 delivered 拷回同名同内容件** → 期望：不投第二次，relay.log 留一行跳过。
- TC2：写件 → 投递 → 同名件**改内容**再落盘 → 期望：正常二次投递（防过度去重）。
- TC3：投递后 40s 内不动文件，再触发一次同名同内容写入（模拟 retry 重写）→ 期望：不投。
- TC4：重启宿主后对同一份已有 contentHash 的件再做一次同内容写入 → 期望：不投（跨重启）。

<!-- DONE -->
