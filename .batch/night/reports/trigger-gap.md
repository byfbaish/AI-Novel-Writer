# 触发缺口台账（降级期人工兜底）

状态：`dsh-schedule` 的 v3 `source` 写法会让被唤醒会话崩 `SessionFormatError`，定时机制全停用。
口径（负责人 21:13 定）：今晚只降级；修 `source` 排到重启收口之后，先在隔离 profile 投一条给死会话验「不崩、只 warn」，才许进 desktop。

## 巡检方式
- 时机：我每轮巡检时顺手核一遍，不承诺固定时刻（避免变成没有触发机制的承诺）。
- 范围：群内与 `review-requests/` 里所有「说要做/几点交」但**没有给出可自查触发 id**的条目。
- 动作：在群内点名一次（对象+影响+建议），登记到本文件；发出后仍无机制，按人工提醒执行。

## 记录

| 时刻 | 承诺方 | 承诺内容 | 有无触发 id | 处置 |
| --- | --- | --- | --- | --- |
| 2026-11-13 21:13 | 全组 | 降级期一律人工兜底，不建 dsh-schedule 卡 | — | 按上表口径巡检 |
| 2026-11-13 23:29 | 总负责人 | 「已挂 10:05 唤醒任务 `dsh-wake-20261114-1005-6263`」收 developer 的甲/乙二选一结论 | **有（schtasks）** | **我误判，已更正**，见下 |

### 更正 2026-11-13 23:33（我 23:29 那条判错了）
- 我的错：按 DSH 原生调度器核（`schedule.json` / `schedule_list`），而实际用的是 `scripts/dsh/wake-later.ps1` + Windows 计划任务（`schtasks`），两者是不同的注册表，必然 0 命中。
- 实测（`schtasks /Query`）：
  - `\dsh-wake-20261114-1005-6263` → 2026/11/14 10:05:00，**Ready**
  - `\dsh-wake-20261114-1800-5718` → 2026/11/14 18:00:00，**Ready**
  - 脚本在 `C:\develop\workspace\AI-writer\develop\scripts\dsh\wake-later.ps1`（17,508B，11-13 21:52:43）。
- 机制（读脚本头）：「只做定时器，不做消息路由」——到点往 relay 的 watch 目录写一个带完成标记的文件，由 `dsh-handoff-relay` 负责通知会话；`WakeToRun` 只覆盖待机/休眠，关机错过靠 `StartWhenAvailable` 下次开机补跑。
- **自查口径（新增，替代原「查 id」）**：核唤醒任务用 `schtasks /Query /TN <任务名> /FO CSV /NH`（或 `wake-later.ps1 -List`），不要查 DSH 的 `schedule.json` / `schedule_list`——那里永远没有这类任务。

### 原「降级」口径需要收紧（待负责人确认）
- 事实更正：**「承诺即触发」并非不可执行**。`wake-later.ps1` + schtasks 是一条可用链路（两笔 Ready 任务即证），只是它依赖「用户已登录 + 机器未关机」，且未提权时只能用 `-LogonType Interactive`。
- 建议：把「降级期一律人工兜底」改为「优先用 `wake-later.ps1` 建 schtasks 一次性任务并当场报任务名；脚本不可用（未登录/权限闸拒）时才降级人工」。这样承诺仍有可自查 id，台账不必长期开着。
- 附带待核：该链路依赖 relay 投递成功，即依赖目标会话 id 有效（失效只 warn）；跨重启后 session id 会变，长时任务须在到点前重核目标 id。

### 历史核查记录 2026-11-13 23:29（内容保留，结论已作废）
- `~/.dsh/storages/schedule.json`（20,305B、mtime 11-13 01:13）里搜 `2026-11-14|20261114`：**0 命中**。
- `schedule_list(active:true)`：**total 0**。
- 全盘搜该 id：只命中 `~/.dsh/bot/state.json` 里总负责人自己那段发言原文（seq 1510），即**只存在于聊天文本**。
- 结论：唤醒任务**没有真正建成**，与「dsh-schedule 已停用」一致。10:05 不会有任何自动唤醒。
- 兜底：我 11-14 上午巡检时（不晚于 10:05 后第一轮）手动点名 developer 要甲/乙结论；负责人如在场自行收。若主人愿意，可由主人明确授权我用原生 `schedule_create` 建一条真实定时（系统规则要求定时任务须用户明确要求，我不擅自建）。

## 恢复条件
`dsh-schedule` 修好并在隔离 profile 验证通过 → 恢复「承诺即触发」，本台账关闭。

### 运行期风险（23:35，只记不动）
- 两条 Ready 任务到点是「写文件进 `wakeup-inbox` → relay 投给目标会话」，**不经过 DSH 调度器**；因此链路成立的两个前提：①机器在运行（关机则由 `StartWhenAvailable` 下次开机补跑，会延迟）②目标会话 id 在到点那一刻仍有效。
- 已知：DSH 重启后部分 session id 会变（11-13 夜 developer 的 `67829cce`→`96a65da1`；群窗 `f6f51eef` 未变）。若 11-14 10:05 前主人重启过 DSH，`wakeup-inbox` 那条 watch 的目标可能失效，relay 只 warn、文件留在原地不投 = 等于没叫。
- 我的处置：不擅自改动；若明早 10:05 后 developer 没收到唤醒，按「`delivered\` 是否有该文件 + `relay.log` 有无 agent-not-found」两处取证，再决定重考一次还是人工叫醒。
- 负责人口径（未答我的收紧建议前）暂按现台账执行：这两条任务记为**有触发**，不算缺口。
