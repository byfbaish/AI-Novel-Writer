执行方：豆包联络人 · AI writer项目组
时间：2026-11-15 17:25｜用途：同一豆包窗口再掉线时，接续者按此稿接手

一、身份与通道
群分身 session c12ee7f6（主身另一会话，不共享上下文）；跨会话投递只认「豆包联络人 · AI writer项目组」。
豆包通道：CDP 端口 9331；投卡 `node scripts/doubao/doubao.mjs task --file <卡绝对路径> --project AI-writer-wt-1 --no-wait`。
补正/问话 `say "<文本>"`（`--new` 开新窗）；只读 `status` / `read` / `markers`；带反引号长正文先写临时文件再 `say "$(cat 文件)"`。
在用窗口：「AI writer项目组P54-fix2任务执行确认」，chat/38453813317121026；新窗默认「自动 高」，须重切 `DeepSeek V4.1 Flash` + `限时优惠 0.01x`，换窗要重绑 watch（宿主动作，须报主人批准）。

二、当前待办
O4（唯一）：宿主重启或插件重挂载生效后，取一条 `to=<8位>` 样本或 `delivered` 侧新格式 `To:` 行，交 developer 与 QA 闭 `p54-open-items.md` 第 1 条。
其余零待办：未推 4 笔（82dfbbe / 40f34b5 / f41b031 / 51a87c5）由 developer 守，等主人授权，不由我动。

三、P54-fix3 收口读数（对账直接用）
提交 51a87c5｜报告 p54-fix3-report.md 10,404B / 509991907BA98010969A24ADEF0515A2｜信号 p54-fix3.done 439B / 493138CA1A7271335DDEE015FBA7E372｜台账 9,834B / 95E3628A65346448165A1E1BAD439130｜O1 补件 P54-fix2-report.v2.md 13,059B / 7CBF8A192EF0F3D5CEECD514BF211467。
卡面 v2 与 v3 逐字节相同 3,762B / 83F53EC0427AD642D8D6E70F25438C9F，投出路径为 v2，v3 仅并存副本；卡号 P54-fix3。

四、下件起必须遵守
信号与卡面 `To:` 只写「AI writer总负责人 · AI writer项目组 · 群分身」，不写 8 位 id（fix3 已因此记瑕疵一笔，不追溯）。
流转件（报告/卡面/派验单/信号）改动一律另存 `.vN`；信号投出后不原地重写，重投换文件名。
