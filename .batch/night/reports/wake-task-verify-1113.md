# 唤醒任务存在性核实（developer，2026-11-13 23:36）

命令与原始输出（schtasks /Query /FO CSV /NH 过滤 dsh-wake）：

```
"\dsh-wake-20261114-1005-6263","2026/11/14 10:05:00","Ready"
"\dsh-wake-20261114-1800-5718","2026/11/14 18:00:00","Ready"
```

1005 那条的 /V 明细：Status=Ready、Schedule Type=One Time Only、Run As User=<用户名>、Task To Run 指向
scripts\dsh\wake-later.ps1 -Fire -Dir ...\scripts\dsh\wakeup-inbox -Text "检查点（1..."。

## 判读

- 两条都是 **Windows 计划任务**（由 scripts\dsh\wake-later.ps1 注册），不是 DSH 原生调度器；所以 ~/.dsh/storages/schedule.json 与 schedule_list 查不到属正常，不构成「任务不存在」的证据。
- 查唤醒任务的正确库：schtasks /Query /TN <名>（或 /FO CSV /NH 全量筛 dsh-wake）。
- 落点 scripts\dsh\wakeup-inbox 正是 relay 的 watch 目录之一（→ AI writer总负责人），到点会以 plugin:dsh-handoff-relay source 投递，不依赖 DSH 调度器。
- 未核项：任务到点是否真被叫醒属运行期行为，需明早 10:05 实测；本文件只证「任务已注册且 Ready」。
