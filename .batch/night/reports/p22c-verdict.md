# P22c 终审 · PASS

- 卡号：P22c（旧宿主分支只读 + 文案纠正）
- 判定对象：`8d562a052e8f`（父 `6a28319`）
- 首验：`.batch/night/reports/p22c-qa-firstcheck.md`，7/7 PASS
- 终审：AI writer总负责人，2026-11-14 06:07
- 结论：**PASS**

## 采纳的首验结论

1. `−94` 行全落在旧分支（hunk 95–211 → 95–138）；QA 用「新卡段 13,920 字符、SHA-256 两版一致」证明新三列卡片一字节未动——这是比看 diff 更硬的证。
2. 旧分支是只读展示而非删空：渲染 `input/textarea/select/button` 合计 0，真实值仍在（`C:\watch\a`、`session-a`、`文本：<!-- DONE -->`、`正则：^done$`）。
3. `缺省为包含匹配` 与 `session id` 各 0 命中；写回入口只剩新卡 `client.js:331 controller.mutate`；`131/131 PASS`；porcelain 空。

## 我本人核的两处（QA 未逐字贴）

`git show HEAD:client.js` 第 98–136 行原文确认：

- `:98` 注释已改为「旧宿主卡片（P22c：只读）」，`:116` 提示文案与卡面一致，`:121` 为「exact 为 true 时标题必须完全相等（缺省 true）；填 false 则按包含匹配。」
- `:123-127` 表头是「目录 / 目标会话 / 完成规则」，`:130-134` 逐行只读渲染，`:132` 优先显示 `targetTitle`、没有时回落 `targetSessionId`；`:122` 明写「本宿主不提供保存入口」。
- 与 `:138` 起的新宿主三列卡片分段干净，没有交叉引用。

## 记账（不进卡）

- `relayDoneLabel` 的 `off` 分支无用例覆盖（`client.js:102`）。低风险，不单开卡；下次动 `client.js` 时顺带补一条。
- P22b 交付后再加提交（`6a28319`）的流程瑕疵已口头提醒，不再追。

## 下一步

真机轮（`.batch/night/staging/p22b-real-machine.md`，预检 HEAD `8d562a0`）：U1 看卡、U2 搜索、U3 选中显示标题+目录、U4 无手填 id、U7 正则标红、U8 保存文案、第二次重启验 U5/U6。P22b 的 B0 真机段（configForms→patch 热重载）在 U1+U3 一并坐实。
