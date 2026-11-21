# CARD-S2-D1 · 同 run 多调用复验（只复验，不改码）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）；QA · AI writer项目组（首验方）
版本：v1 · 2026-11-22 · 起点：**本卡开工时的 `exp/mainline-1119` HEAD**（D13、D9 交件后再开工，不早于 `0f0ca3ee`）
顺序：**S2 第三张**（D13 → D9 → D1）；前两张交件前不开本卡。

## 0. 开工件必读确认（三行，缺一行不许 start）

① 读了哪几份：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、本卡。
② 版本或日期：`README.md` `c87cd4ab`（2026-11-14）；`AGENTS.md` `a276fffb`（2026-11-07）；`ruling-dispatch` 现行 v6 · 2026-11-20。
③ 三条口径：授权边界最窄执行（**本卡零改码**）；实机复验在 `develop` 由 developer 执行、不外派；证据只认命令与输出原文，push 只由主身。

## 1. 现状（读于 `0f0ca3ee`）

- 缺陷稿 `docs/design/product/live-pipeline-acceptance-defects-assessment.md:61`：**🟡 已实施（部分复验）**——「批内多单元/多章生成时第二次调用即抛 `GENERATION_SOURCE_CHANGED`，整批静默中止」；2026-11-02 连写 2 单元已实机跑通（12 → 15 章）；机制层补 8 条单测；**同 run 多调用（正文批量）仍未复验**。
- 相关既有位置（只读，不动）：`electron/services/main-generation-owner.ts:931`；`electron/services/agent-generation.ts:158/190/196`；`src/services/agent/agent-generation-client.ts:33`。

## 2. 本卡要证的事

在同一 run 内连续两次模型调用都真实发生且都被允许落库：**第一次短细纲、第二次正文**（同 `runId`、两个不同 `purpose`），全程不出现 `GENERATION_SOURCE_CHANGED`，批次不以「静默中止」收场（run 有终态）。

## 3. 明确不做（本卡是复验卡）

- **零改码**：不改 `src/`、`electron/` 任何生产文件；不改既有单测；不改缺陷稿状态（转 ✅ 归产品经理）。
- 不新增脚本进仓库（取证脚本放 `.runtime/`，不入库；若要落 `scripts/`，先报我裁）。
- 不碰 D12 注入与重跑区、`chapter-materials.ts:608-624`、`archive/`、仓外 `.backups`。
- 发现现象复现（真抛 `GENERATION_SOURCE_CHANGED`）⇒ **停手报原文**，不许自行改码修它。

## 4. 验收判据（QA 首验逐条，逐条要输出原文）

| # | 判据 | 证据形态 |
|---|---|---|
| 1 | 同 run 内两次调用都发生：贴 `generation_attempts` 两行原文，`run_id` 相同、`purpose` 分别为短细纲与正文（或对应两个不同 purpose 值） | 贴 SQL 与行原文 |
| 2 | 全程无 `GENERATION_SOURCE_CHANGED`：贴抓取日志或 DB 中该码计数为 0 的命令原文 | 命令 + 输出 |
| 3 | run 有终态（不是永久 `running`、不是无码 `paused`）：贴 `generation_runs` 行原文 | 贴 SQL 与行原文 |
| 4 | 应用侧结果与库一致：第二次调用产出被采用（草稿存在/正文可读），不是「调用发生但结果被丢」 | 贴界面读数或 `drafts` 行原文 |
| 5 | 实例纪律三项齐：`instancesThisRun`＝1、`exitCode`、`leftoverElectronProcesses`＝0 | 贴 evidence 三项原文 |

任一条给不出输出原文 ⇒ 不通过。**本卡不要求新增单测**（无改码即无新单测），但要求把既有相关单测跑一次并贴汇总行。

## 5. 外派位

- **不可外派**：实机复验（起应用＋playwright 走流程）——须在 `develop` 由 developer 执行（主人 11-21 19:07 裁定；AGENTS 第 8 条）。
- 本卡无静态活可外派（读码结论已由历史单测与缺陷稿给全），如认为有，先报我裁。

## 6. 回执与交付

- 本卡**默认不开新分支**（零改码）：在 `exp/mainline-1119` 的当时 HEAD 上只跑不提交；若你判断需要留一个分支，先报我。
- **例外（2026-11-22 04:5x）**：经群管理分身令，本卡改为建独立分支 `card/s2-d1-multicall-reverify`（从 `0f0ca3ee` 起）、**分支上零提交**；其余口径不变（判据、白名单、R4 双空、取证命令均未改）。
- 交件：报告 `.batch/night/staging/s2-d1-multicall-reverify-report.md`（贴全部命令与输出原文）。
- 回执：`.batch/night/bridge/to-owner`；群里交件 @ 项目总负责人 与 QA。
- 停手：凡需要改码才能过判据 ⇒ 停手报原文等裁定。

## 7. 实例纪律（群管理分身 2026-11-22 00:2x 硬纪律，验收必查）

- 实机验收脚本一律**单实例复用、跑完必关**：`try/finally` + `app.quit()`；父进程先死则连 electron 子进程树一起收；禁止并发起第二个实例。
- evidence 必须含 `instancesThisRun`、`exitCode`、`leftoverElectronProcesses`（须为 0），见 §4 判据 5。
