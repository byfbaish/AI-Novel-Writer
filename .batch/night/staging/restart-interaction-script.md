# 重启脚本（2026-11-14 02:2x · 恢复主实例用）

> 现状：方案 A 已全绿（P15 真机：宿主不退 / 基线行在 / 设置页有卡 · 截图 `.batch\night\evidence\p15-card-visible\settings-plugin-card-0158.png`）。
> 探针热重载已投出并唤醒负责人（02:14:34）。**本次重启只为两件事**：让设置卡在主实例挂上、验正常启动扫描路径。
> 群在重启期间消失，所以执行方只能是主人本人；重启后群内 Bot 的**会话 id 不变**（`~\.dsh\sessions\--C-develop-workspace-AI-writer-develop--\`），无需重接线。

## 重启前闸门（负责人已在群里确认才可开始）

1. 插件仓库 `HEAD=43c3762`（`chore: release 0.4.1`），`git status --porcelain` 为空。
2. 主 profile 是 Junction 直指仓库，**不需要 `install`**；`index.js`/`client.js`/`package.json` blob 与工作区一致。
3. `cordis.patch.yml:295` 已 `disabled: false`（备份 `.bak-resume-1114`）。
4. 7 条 watch 目录只有 `.gitkeep`；`.batch\night\archive\resume-1114\` 里有 6 条已归档存量，**不再重放**。
5. 探针 `scripts\dsh\wakeup-inbox\probe-resume-1114.txt` 已投递到 `delivered\`，源目录已清空。

## 步骤（主人照做，一次一步）

| 步 | 谁做 | 动作 | 判据 |
|---|---|---|---|
| B1 | 主人 | 完全退出 DSH（托盘也要退），回一句「关了」 | 收到关键词才往下 |
| B2 | 主人 | 重新启动 DSH | — |
| B3 | 主人 | 打开 `设置 → 插件 → 插件配置`，看在不在 | 第一块是 Handoff Relay 卡（目录 / 目标会话 / 完成规则 / exact / 新增一行 / 保存 / 已同步 Host），下面是终端、Agent 循环、网页搜索三项 |
| B4 | 主人在群里说一句 | 「起来了」/「有卡」/「无卡」 | — |
| B5 | 负责人（重启后新会话） | 读本文件 + `.batch/night/staging/restart-progress.md` 恢复现场；查 `relay.log` 尾部 | 无 `fatal load failure`；有 `启动 7/7 个 watch` 与每条解析行；有 `设置卡 schema 基线=… resolved=` 行 |
| B6 | 负责人 | 核对设置卡：主实例里不再出现 `WARN 设置卡未挂载` | 该 WARN 不出现 |
| B7 | 负责人 | 放**一个**探针（`wakeup-inbox`，指向负责人会话），验投递与唤醒 | `delivered\` 只多这 1 条；源目录清空；负责人被唤醒 |
| B8 | 负责人 | 清探针残留，写终态 | 7 条 watch 目录回到只有 `.gitkeep` |

B5/B6 任一红 → 让主人立刻把 `cordis.patch.yml:295` 改回 `disabled: true` 并重启，写失败结论后停手，**不试探第二次**。

## 重启后若卡没出现（B3 答「无卡」）

不重试、不改码。按这个顺序取证，一次只查一层：

1. `settings.describe` 响应里有没有 `handoff`（有＝注册成功）；
2. 浏览器控制台有没有 `slot entry crashed in 'settings.plugin.item'`（有＝渲染抛错）；
3. 以上都没有才查挂载时序与 `relay.log` 的 `设置卡 schema 基线` 行。

## 红线

- 一次只验一件事：先加载，再挂卡，最后投递；过程中不改任何配置。
- watch 目录只放一个探针，验完清干净。
- 任何一步失败：停手 + 贴原始日志，不自行重试。
- 不提交、不打 tag、不 publish（0.4.1 等这一切正常后才发）。
