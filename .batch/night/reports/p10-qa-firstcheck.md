# P10 首验（QA）

> 状态：已实施（2026-11-13 · P10 首验；结论 **PASS**，覆盖派验单 9 条判据）
> 派验单：`.batch/night/review-requests/P10.md` · 交付方：豆包联络人 · 首验人：QA
> 仓库：`C:\develop\workspace\dsh-handoff-relay` · HEAD `51b9b73`（未提交，符合「不许 commit」）
> 验收基线：终版工作区（`index.js` mtime 22:50:19、`index.test.mjs` 22:51:14；报告 22:52:17 / 8,424B）

## 结论

**PASS**。判据 1–8 全部成立；判据 9（A watch 事件不触发 B watch 重扫）**无专用用例**，但 `firstEventRescanned` 是 `startWatch()` 内闭包变量（`index.js:568`），每个 watch 各持一份，结构上不可能串，记不拦。

## 实测（终版）

| 项 | 实测值 |
|---|---|
| `git status --porcelain` | 只有 ` M index.js`、` M index.test.mjs`，无新增文件 |
| `git diff --numstat` | `35 13 index.js`、`160 0 index.test.mjs` |
| `node index.test.mjs` | `TOTAL: 84/84 PASS` / `RESULT: PASS` / exit 0 |
| `source:` 行 | `index.js:431` 与 `git show 51b9b73:index.js` 逐字相同 |
| 用例增删 | `+7 / −0`（5 条 P10 + 2 条 rescan），无删除、无等价改写 |
| `relayLog` 调用点 | `:219` giveUp / `:488` skipFailed / `:503` 解析失败 / `:672` 加载行 / `:677` 启动汇总；成功路径 `:514` 无日志 |

## 九条判据

1. **先解析后标记**：`index.js:505` `const resolved = resolveNow(relName)` → `:511` `if (!resolved.ok)` → `:514` `delivered.add(key)`；原 `:490` 的 `delivered.add(key)` 已删。
2. **失败不标记、可重试**：失败分支 return 前未写 `delivered`；用例 `index.test.mjs:1611`「同 mtime 再触发仍会重新尝试」实断言二次尝试。
3. **失败 WARN**：`index.js:500-503` 文案 `解析不到目标，保持未投递（reason=…）：${relName}（dir=…，目标=${targetText}）`，文件名/目标原样/原因齐；同时 `relayLog(warn)` 落盘（用例 `:1619`、`:1625`）。
4. **加载期每条 watch 一行**：`index.js:672` 在 `startWatch` 之前写 `info`，含 `label` / `dir=` / 目标原样 / `atLoad.status`；四种 status 由 `describeTargetNow` 产出（用例 `:1725`）。
5. **成功投递不写日志**：见上表调用点，`:514` `agent.followup()` 旁无日志。
6. **无新增定时器/第二份日志**：diff 无新增 `setTimeout`/`setInterval`；日志仍单一 `relay.log`。
7. **重扫走现有 `consider()`**：`index.js:569-572` `for (const rel of listFiles()) consider(rel)`，无第二套投递逻辑。
8. **latch 生效**：`index.js:570` `if (firstEventRescanned) return;`，用例 `:1689`「后续事件不再二次重扫」。
9. **A/B 隔离**：无专用用例；闭包变量按 watch 隔离（结构性成立）。

## 记三条（不拦）

1. **报告与代码版本错位史**：22:49–22:53 之间交付物改了三次，报告从 5,677B → 5,958B → 8,424B，`numstat` 从 `26/13`→`35/13`、`104/0`→`107/0`→`160/0`。接受终版，但「投后仍可改」的过程本身是流程风险。
2. **两套失败标识字符串**：加载行 `title-no-match:0` vs 失败行 `title-no-match`，人读可对齐，机器不可比。
3. **信号文件二次重写**：`p10-resolve-before-mark.done` 22:52:24 重写 275B，旧版已移入 `delivered`，目录内留两份同名不同内容——只作留档，不影响判定。
