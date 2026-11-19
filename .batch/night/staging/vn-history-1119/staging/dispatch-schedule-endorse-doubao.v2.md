执行方：豆包联络人 · AI writer项目组
model=（DSH 会话，非外部执行产出） | 倍率=不适用 | provider=DSH
会签对象：`staging/dispatch-schedule.v2.md`｜7,030B｜`27d365a3813833b841817ae135f18b2a`｜116 行
会签时刻：2026-11-17 12:22 CST（复签 v2；我的 v1 会签 `5f66b1e1…`／2,833B／51 行 留档不动）
会签结论：**五条全部复签通过**；另附三条 v3 必改的陈旧事实（不阻塞本件，判据已自挡住）。

## 逐条（每条都我自己实跑，不采信本件自述）

**① 判档命令可执行（`:20`／`:23`）—— 通过**
`:20` 原样跑 exit 0、有非空输出：`12:19 → DeepSeek-V4.1-Flash（非高峰时段，DeepSeek-V4.1-Flash 计 0.11x 且 5 折） auth=UNVERIFIED`。
`:23` 原样跑 exit 0：`{"ok":true,"model":"DeepSeek-V4.1-Flash","window":"deepseek-off-peak","reason":"非高峰时段…5 折"}`。
空串判「未执行」的口径我认。

**② 档位判据用四字段、禁虚构枚举（`:34`–`:37`）—— 通过**
三态复算与 `:30`–`:32` 表逐字段对上：Mon 10:30 → `{"ok":false,"blocked":true,"model":null,"reason":"DeepSeek 高峰（原价）","nextOffPeakAt":"2026-11-16T04:00:00.000Z"}`；Mon 非高峰与 Sat 10:30、Sun 22:00 → `window:"deepseek-off-peak"`、`model:"DeepSeek-V4.1-Flash"`。
`window` 只在非高峰存在、禁拿它判高峰（`:37`）成立；`deepseek-peak` 虚构枚举已删。

**③ 豆包三条收下（`:89`–`:93`）—— 通过**
单窗口容量读 `status.turnCount`（`:89`）、连续 2 次 turn 失败才换窗且须主人批准（`:90`）、投达三件套＋`exit 2` 记未派（`:91`）逐字保留，且 `:93` 声明「以会签件为准、不改写」。容量值与退出线仍归我，v2 未代定 ✓。

**④ 派后回查 `chips.model`（`:42`–`:60`）—— 通过**
`node scripts/workbuddy/workbuddy-attach.mjs status --json` 实跑 exit 0，字段齐：`runState:"idle"`、`chips.permission:"允许完全访问"`、`chips.model:"DeepSeek-V4.1-Flash"`。判据「不等 → 停派、不得先跑着看」（`:60`）我认。

**⑤ 单执行方闸＋投达三件套＋退出码（`:64`–`:83`）—— 通过**
WorkBuddy 闸 `runState==="idle"` 实跑命中；豆包闸实跑 `loggedIn:true`、`hasEditor:true`、`taskMode:true`、`turnCount:5`（`:71` 判据命中，turnCount 已记）。
`:83` 退出码引用 `workbuddy-attach.mjs:115` 逐字无误：`{ ok:0, fail:1, notConnected:2, cliMissing:3, timeout:4, peak:5 }`；豆包侧 `doubao.mjs` 头注释 `0 ok / 1 failure / 2 not connected` 与我会签件一致。

## 三条 v3 必改（陈旧事实，不阻塞本件）

1. **`:38` 行号已漂移且结论过期**：现盘 `HY4_DISABLED=true` 在 `:30`、`MODEL_HY4_FLASH='Hy4 flash'` 在 `:34`、`ALLOWED_MODELS` 在 `:36`，白名单已是 `['Hy4 flash','DeepSeek-V4.1-Flash']`——「HY4 不会出现」在白名单层**已不成立**。好在 `:35` 的 `model === "DeepSeek-V4.1-Flash"` 字段判据正好挡住自动路径，判档不失效。
2. **`:112` 与现盘矛盾**：「HY4 Flash 模型名未到之前不派」——名字已到（界面 `Hy4 flash`，白名单 11-17 01:1x 已加）。须改写为「手动通道已存在、未授权，禁 `--model "Hy4 flash"`」，否则 v3 读者会误判「选不到」。
3. **`:113` 派卡量口径落伍**：写的 795/145＝18.24%，负责人 11-17 已改 721/72＝9.99%；引用旧值会与日报对不上。

上三条只改文字与行号，不动 §一~§五 的任何判据机制；我按这三条复签 v3。

<!-- DONE -->
