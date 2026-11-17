# P33 终审 · 目标解析语义（只读）

- 终审人：AI writer总负责人
- 时刻：2026-11-14 10:30
- 判定：**PASS**（只读取证卡，联络人复核行号 + 我判；不进 QA 队列）
- 报告：`.batch/night/reports/p33-target-resolve.md`（11,855B / MD5 `BB36535EDCEF82870AF629EC66B84FB6` / 119 行）
- 信号：`delivered\83e63d6cfdfa\p33-target-resolve.done`（1,988B / 10:27:39）
- 登记缺口：卡面、派验单均缺（群内口头派卡），记一笔，不补造。

## 结论（采纳）

1. 配置没错：`agents.get(id)` 要的就是 agent id，DSH 里 agent id 与 session id 同值 `session-<uuid>`（`dsh-agent/lib/index.js:441` store、`:722-725` "the shared agent/session id" / "undefined when no live agent has that id"、`:752-753` roots 过滤 live）。
2. 时好时坏＝目标会话是否在宿主里活着，不是 id 写错、不是时序偶然；启动期全红是常态，只有 P11 那 21 秒重扫窗口，之后靠文件事件重解析。
3. **id→标题迁移解决不了存活问题**：标题解析同样只遍历 `roots()`。它只解决「配置里 id 写旧」。
4. 七条实判：能投 #3–#6（本 boot 均有落盘）；#0（给负责人的唤醒）时好时坏、本 boot 已静默失效（`dsh-wake-20261114-1005-6263.md` 原地、三连 `agent-not-found`）；#1/#2 从未有文件＝未验证。「常年不通」不成立。
5. `relay.log` 无投递成功行（成功只写插件 log，`index.js:1014`），判通道死活只能看 `delivered\`。

## 我的两项拍板（2026-11-14 10:29）

- **不做 `agents.resume`**：插件一旦拉起会话就从「写文件 + 发通知」变成「管别人生命周期」，会凭空开一轮、烧配额、可能生成重复会话。要「目标没开也唤醒」须主人明确点头，另立功能。
- **not-found 处置＝`undelivered.json` 记账 + 留原地不搬 + 一条 warn**；不改投常驻通道（路由判断不进插件），也不静默丢。
- 相关 UI 项（选择器显示「在线/未打开」，保存后提示「目标会话当前未打开」）记 backlog，不进 0.5.0。

## 本轮流程决定

真机轮**不做迁移**（`real-machine-050-scope-v3.md` 已标跳过、脚本正文未动）：同一轮不换两个变量。
