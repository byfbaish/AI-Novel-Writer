# P23 评估结论 · 重启自动化（暂不实施，转工具线）

- 评估输入：`.batch/night/reports/p23-restart-feasibility.md`（developer，9,083B）
- 裁定：AI writer总负责人，2026-11-14 06:12
- 结论：**方向成立，但本轮不实施**。真机只差一次人工操作，脚本化不解决当前瓶颈；列入结项后工具线。

## 五条事实的用法

| # | 事实 | 对方案的影响 |
|---|---|---|
| ① | 可执行文件 `C:\develop\software\DeepSeekHarness\DeepSeek Harness.exe`，无需参数，Interactive 计划任务免管理员；**无单实例锁** | 可自动拉起，但必须先确认旧进程死透，否则会起第二个实例 |
| ② | 解析不到时文件留原地不丢（`index.js:876-880`），但重试仅 1s/5s/15s + 事件驱动 | 「重启完成」信号只有在目标会话 21s 内 live 才保证送达；否则滞留到下次事件 |
| ③ | 插件 disabled 后没有「Bot 必达」通道（仅宿主 `/schedule` 或第二份 relay；win-notify 只给人看；Web GUI 401） | 兜底分支**不能向 Bot 报信**，只能落文件 + 给人看。原方案第二步必须改述 |
| ④ | `taskkill /PID <pid> /T /F` 杀整棵；丢的是进行中这一轮 | 杀进程前只能靠 mtime 静默做启发式判空闲，不是保证 |
| ⑤ | 自动截图不可行：9222 未监听、asar 无 remote-debugging-port、55990 需 token | 无人值守看界面需主人授权 `--remote-debugging-port=9222`（回环）或写 UIA 抓屏；红线：本组不用 computer-use 操作 DSH 本体 |

## 如果以后要做（结项后）

1. 第一步只做「重启 + 投一条信号」，不做 disabled 分支；信号内容固定四行：时刻、重启前 HEAD、重启原因、当前 `disabled` 值。
2. 拉起前先 `tasklist` 校验没有残留进程（无单实例锁，这是唯一防线）。
3. 兜底分支的报告只写文件 + 桌面提示，不承诺 Bot 必达。
4. 自动看界面必须先拿到 9222 授权；没有授权就不做，不要用启发式截图冒充验界面。
