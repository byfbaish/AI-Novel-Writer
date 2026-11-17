# P10 终审记录（负责人）

- 卡号：P10（p10-resolve-before-mark.md，含追加目标 6「首个事件全量重扫 + latch」，我 22:53 裁定合并验收；P11 作废）
- 终审时刻：2026-11-13 22:55
- 依据：**只引 QA 首验结论，不重复复验**（验收链：联络人交证据 → QA 首验 → 负责人终审）

## QA 首验结论（.batch/night/reports/p10-qa-firstcheck.md）

- 判据 1–8 全成立；终版 
umstat = `35/13 index.js`、`160/0 index.test.mjs`，`TOTAL: 84/84 PASS` exit 0
- `source:` 在 `index.js:431` 与父提交 `51b9b73` 逐字相同
- 顺序核对：`:505` resolveNow → `:511` 失败分支 → `:514` `delivered.add(key)`；失败 WARN 同时进 `ctx.logger` 与 `relay.log`；成功路径不写日志
- 第 9 条（A/B 隔离）：`firstEventRescanned` 是 `startWatch()` 内闭包变量（`index.js:568`），每 watch 各持一份，结构上不串；A/B 用例进 backlog

## 终审判定

**PASS。**

提交：`4fb80da fix: resolve the target before marking a file delivered so startup-era files are not dropped silently`
（父 `51b9b73`，2 files，195 insertions / 13 deletions；porcelain 空）

## 未完项

1. **重启真机验**「不碰 mtime 也能自己投出去」：需在 DSH 关闭期间放探针，启动后由第二个文件事件触发首事件重扫 → 存量补投。
2. A/B 隔离用例（backlog，不阻塞）。
3. elayStateDir() 缺 isInsideDir 兜底、失败件不自动清（二期 backlog）。

## 真机复验（2026-11-13 23:07）

主人按五步走完（关 DSH → rm-probe.cmd 放探针 → 启动 → developer 放 	rigger-2306.txt）。

文件级读数（我自己读的，不引转述）：
- delivered\dad6df13f302\ 新增 2 件：`probe-startup-1113.txt` 336B、MD5 `002BDA64D1F3F6BD625CBB3E322E6E29`（与 staging 原件逐字同）、`trigger-2306.txt` 65B
- 七个 watch 目录只剩 `.gitkeep`；`failed.json` 不存在；`relay.log` 2,249B / 10 行
- 日志实证启动期 7 条 `agent-not-found` + 1 条 WARN「保持未投递」⇒ P10 目标 1–3 落地；随后补投成功、成功路径不写日志

**未结项**：豆包联络人 自述收到过「同一 `trigger-2306.txt` 的第二条投递（reason=stable）」，与「目标会话恰好 1 条」判据冲突，交由 QA 定条数后再落最终判定。
