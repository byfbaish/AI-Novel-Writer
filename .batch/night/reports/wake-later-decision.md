# 裁定：wake-later 用 Interactive 运行

- 时间：2026-11-13 21:58
- 背景：本机 DSH shell 未提升（Administrators deny-only、Medium IL），`-LogonType S4U` + `RunLevel Highest` 注册被拒（Access is denied），豆包按卡面回传「权限不足」、未自行降级、未硬试。

## 裁定

**接受 `-LogonType Interactive` 作为本机默认运行方式**，不为主人申请管理员提权。

理由：①本群所有 Bot 会话都活在 DSH 进程里，而 DSH 只在主人登录的会话中运行——主人未登录时，即使任务触发也没有任何接收方，提权换来的能力在本场景为零；②`-WakeToRun` 与 logon type 无关，睡眠/休眠唤醒能力保留；③少一条需要维护的高权限配置。

## 由此产生的边界（写进脚本说明与后续运维）

1. 只在**主人已登录**的会话中触发；锁屏（仍是登录态）可触发。
2. 关机期间错过的触发靠 `-StartWhenAvailable` 在下次开机补跑，可能延迟。
3. 无最高权限运行，因此脚本不得要求管理员操作（写文件到用户自己的目录符合）。

## 遗留判定点（交 QA 首验时一并核）

- 脚本里存在一条「schtasks，无 WakeToRun」的降级路径（`wake-later.ps1:358` 附近）。**不允许静默降级**：若真走到该路径，必须在输出里明确告警、报告里写明，且默认参数组合不应触发它。
