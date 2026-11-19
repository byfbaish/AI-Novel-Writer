执行方：豆包联络人 · AI writer项目组
时间：2026-11-16 07:37｜用途：同一豆包窗口再掉线时，接续者按此稿接手（v3＝群分身 id 换新，v1/v2 保留不动）

一、身份与通道
群分身 session **27a1c2ae**（2026-11-16 06:39 全批轮换后现行；旧 c12ee7f6 已非现行）；主身另一会话，不共享上下文。跨会话投递只认「豆包联络人 · AI writer项目组」。
relay 实证（读 profiles\desktop\cordis.patch.yml:289–325）：`wakeup-inbox\doubao` 与 `signals\doubao` 两条 watch 均 → `session-27a1c2ae-…`，绑定正确；改配置与重启归主人，Bot 不自改。
豆包通道：CDP 端口 9331；投卡 `node scripts/doubao/doubao.mjs task --file <卡绝对路径> --project AI-writer-wt-1 --no-wait`。
补正/问话 `say "<文本>"`（`--new` 开新窗）；只读 `status` / `read` / `markers`；带反引号长正文先写临时文件再 `say "$(cat 文件)"`。
在用窗口：「AI writer项目组P54-fix2任务执行确认」，chat/38453813317121026；新窗默认「自动 高」，须重切 `DeepSeek V4.1 Flash` + `限时优惠 0.01x`，换窗要重绑 watch（宿主动作，须报主人批准）。

二、当前待办
零待办。O4 已于 2026-11-15 17:42 闭合（relay.log:1083/:1085 吐 `to=a1d48adb|大肥鱼|主身`，旧码只会吐 `to=session-`）；「重启后比对 6 条 watch」降为将来真重启的防呆。
未推 4 笔（82dfbbe / 40f34b5 / f41b031 / 51a87c5）由 developer 守，等主人授权，不由我动。

三、fix3 收口读数（对账直接用）
提交 51a87c5｜报告 p54-fix3-report.md 10,404B / 509991907BA98010969A24ADEF0515A2｜信号 p54-fix3.done 439B / 493138CA1A7271335DDEE015FBA7E372｜台账 9,834B / 95E3628A65346448165A1E1BAD439130｜O1 补件 P54-fix2-report.v2.md 13,059B / 7CBF8A192EF0F3D5CEECD514BF211467。
卡面 v2 与 v3 逐字节相同 3,762B / 83F53EC0427AD642D8D6E70F25438C9F，投出路径为 v2，v3 仅并存副本；卡号 P54-fix3。

四、下件起必须遵守
角色更名（主人 2026-11-16 06:29）：旧「AI writer总负责人」一律改称「项目总负责人」，职责不变；新写的卡面/报告/信号/From 行只用新名，已投出的历史件保留原文不追溯。
信号与卡面 `To:` 只写「项目总负责人 · AI writer项目组 · 群分身」，不写 8 位 id（fix3 已因此记瑕疵一笔，不追溯）。
From 行末段用 27a1c2ae；投递后须有 resolved/delivered 留痕，不许「发了就算」。
流转件（报告/卡面/派验单/信号）改动一律另存 `.vN`；信号投出后不原地重写，重投换文件名。
