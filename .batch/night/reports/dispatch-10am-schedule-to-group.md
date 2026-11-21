# 派活：10:00 汇报定时任务改由群分身会话承载

发出：大肥鱼（主身）｜时间：2026-11-21 20:50 +08
收件：项目总负责人（AI writer项目组 群分身会话 session-5dfa8c4d-1dc0-4506-8045-053a0bb39703）

## 背景

现有定时任务 `schedule-c6932ccd-21fe-4809-8f78-66e31ec48054`，标题「每日 10:00 项目汇报投 to-owner 桥」，
rrule `DTSTART;TZID=Asia/Shanghai:20261115T100000` + `RRULE:FREQ=DAILY`，
target 绑在项目总负责人**主身**会话 `session-5b5bc124-1fa0-484a-b83d-370fe67cb6fa`。

问题：主身会话没有群上下文，跑出来的汇报缺群里的实际进展。主人 11-21 定：改由群分身承载。
我改不了这条（`schedule_edit` 返回 `This task belongs to another chat. A Bot reads and changes only the tasks of its own chat.`），
已另派主身去删旧件；这里只做「新建」。

## 要做的四步

1. `schedule_create`，`target` 选 `this_session`（即本群这个分身会话 `session-5dfa8c4d-…`）。
   标题沿用「每日 10:00 项目汇报投 to-owner 桥」。
   rrule：`DTSTART;TZID=Asia/Shanghai:20261122T100000` + `RRULE:FREQ=DAILY`。
2. prompt **逐字照抄**旧件，不要自己重写：
   读 `C:\Users\伯云飞\.dsh\storages\schedule.json`
   → `tables.tasks["schedule-c6932ccd-21fe-4809-8f78-66e31ec48054"].record.prompt`，整段复制。
   以下条款一律保留：平台账单由大管家提供／`tool-search` 与 `server-tool-search` 两类分列／本地日志数与平台数不可互证／
   禁止裸调 `free_search_test`／落款三行＋末行 `<!-- DONE -->`／写后回读 `tail -1`。
> 已被 11-21 22:0x 四节版取代，本文件不再作为建任务的依据：step 2「逐字照抄旧件」作废，prompt 以群管理分身给出的四节版（进展／卡点与待拍板／下一步 24 小时／返工与消耗观察）为准。

3. 建完回读一次，报三项：新任务 id、`scheduledAtLocal`（应为 `2026-11-22T10:00+08:00`）、
   `target.sessionId`（应为 `session-5dfa8c4d-…`）。若落到了别的会话，立刻停手报我，不要硬建第二条。
4. 回执投 `.batch\night\bridge\to-owner`，一行：新 id｜下一次触发｜target sessionId｜旧件是否已被主身删除（以我确认为准，你看不到就写「未见」）。

## 边界

- 不许在其他群里建；不碰旧任务（属主身会话，你改同样报 belongs to another chat）。
- 只建这一条，不顺手重排别的定时任务。
