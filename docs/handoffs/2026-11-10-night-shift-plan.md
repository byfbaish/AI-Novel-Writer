# 11-10 夜班计划（照 11-09 夜跑框架）

> 状态：**夜跑已结束（07:1x 收工，19:2x 补完复核与回填）**。本稿是**调度单**，不是任务书；任务书在 `scripts/night/20261110/`。
> 上一轮同框架：`docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md` §九–§十一；晨间结果：`docs/handoffs/2026-11-09-night-batch-digest.md`。

## 0. 本轮授权（章程 §7 R01）

**本轮授权：可改码 + 可提交（不含推送）。** 依据：`docs/handoffs/2026-11-10-night-closeout-and-next-steps-handoff.md` 的授权行 + 作者 03:0x 两个拍板。逐类动作：

| # | 动作 | 授权状态 | 依据 |
|---|---|---|---|
| 1 | 主区/看板建卡、设定时、写 `scripts/night/20261110/` 任务书、写本计划稿 | 可做 | 作者「安排接下来 5 小时」 |
| 2 | wt-2：存 patch + `git stash` + `reset --hard 74ad3236` | 已做，作者拍板 | 作者拍板「存 patch + stash 后重置到主线」 |
| 3 | wt-1：`merge --ff-only 74ad3236` | 已完成 | 同上（同步主线） |
| 3b | `scripts/workbuddy/workbuddy-attach.mjs` / `scripts/doubao/doubao.mjs` 两处兜底热修（产物落点二分：先 `develop/.runtime`，不可写退 `wt-N/.batch`） | **已实施，作者 19:2x 追认** | 作者 04:2x 拍板「先试 develop/.runtime，不可写就退到 wt-2/.batch/night/wb-attach/」；07:00 复核判定 7 提请追认 |
| 4 | 外派任务只允许 WorkBuddy（wt-2）与豆包（wt-1）写各自 `.batch/night/` 报告 | 可做 | 通道手册 |
| 5 | **不推送**、不改产品代码、不跑 A1/A2 实机、不动 wt-3、不改全局配置（`config.json`/`models.json`/`recent-projects.json`） | 禁止 | 交接稿 + 作者 03:0x 拍板「今晚我只做调度与收口」 |
| 6 | 合并 W3 patch / 回填台账 / 改设计稿状态行 | 待晨间作者点头 | 复核意见 A（未单独授权） |

## 1. 框架（照 11-09，作者 m00722/m00787 定案）

- 中控**只做设置**：写任务书 → 建定时卡 → 到点由 Host 把卡推进对话列表；
- 卡会话只做**一条 fire-and-forget 投递**（`--no-wait`），不判断、不等待、不总结；
- 07:00 给 WorkBuddy 一个**干净会话**（`--new`）做只读技术复核，中控不自审；
- 夜间产物落各槽位 `.batch/night/`；投递日志落主区 `.runtime/night/`；
- 看板卡是 trace 卡（Host 调度），复核结论不回写卡，回填交接稿与台账。

## 2. 机器清单（14 张卡）

| # | 时刻 | 卡 | 目标 | 任务书 | 报告 |
|---|---|---|---|---|---|
| 1 | 03:32 | `ae4a3c9f…` 探针A | WorkBuddy | 一行 `SCHED-PROBE-WB-OK` | `.runtime/night/sched-probe-wb-20261110.log` |
| 2 | 03:32 | `b8da81ad…` 探针B | 豆包 | 一行 `SCHED-PROBE-DB-OK` | `.runtime/night/sched-probe-db-20261110.log` |
| 3 | 03:55 | `394170dd…` W1 | WorkBuddy（`--new`） | `wb-w1-browser-red-a.md` | `wt-2/.batch/night/W1-browser-red-a.md` |
| 4 | 03:58 | `a04c9076…` W2 | WorkBuddy | `wb-w2-browser-red-b.md` | `W2-browser-red-b.md` |
| 5 | 04:01 | `506307f6…` D1 | 豆包 | `db-d1-a1-criteria-brief.md` | `wt-1/.batch/night/D1-a1-criteria-brief.md` |
| 6 | 04:04 | `3a58b678…` D2 | 豆包 | `db-d2-short-outline-acceptance.md` | `D2-short-outline-acceptance.md` |
| 7 | 04:55 | `cc9840cb…` W3 | WorkBuddy | `wb-w3-browser-drift-patch.md` | `W3-browser-drift-patch.md` |
| 8 | 04:58 | `61296c61…` W4 | WorkBuddy | `wb-w4-d9-hook-points.md` | `W4-d9-hook-points.md` |
| 9 | 05:01 | `6cde3cdc…` D3 | 豆包 | `db-d3-browser-red-second-opinion.md` | `D3-browser-red-second-opinion.md` |
| 10 | 05:45 | `e036ed27…` W5 | WorkBuddy | `wb-w5-incomplete-chapter-discard-draft.md` | `W5-incomplete-chapter-discard-draft.md` |
| 11 | 05:48 | `85249f25…` D4 | 豆包 | `db-d4-ledger-status-calibration.md` | `D4-ledger-status-calibration.md` |
| 12 | 06:40 | `93ef8347…` W6 | WorkBuddy | `wb-w6-selfcheck.md` | `W6-selfcheck.md` |
| 13 | 06:55 | `57ccaa5b…` D5 | 豆包 | `db-d5-morning-digest.md` | `D5-morning-digest.md` |
| 14 | 07:00 | `fa905d9d…` REVIEW | WorkBuddy（`--new`） | `wb-review-0700.md` | `wt-2/.batch/night/REVIEW-0700.md` |

**会话分组（作者 03:38 拍板 B：同组可复用、跨组必换）**

| 组 | 卡 | 投递方式 |
|---|---|---|
| A | W1 → W2 | W1 `--new` 起新会话，W2 复用 |
| B | W3 → W4 | W3 `--new`，W4 复用 |
| C | W5 → W6 | W5 `--new`，W6 复用 |
| D | REVIEW | `--new`（只读复核，必须干净） |

豆包固定 `--project AI-writer-wt-1`；同一线程排队，卡间隔 3 分钟避免撞车（D1/D2 已有队列形态，不拆会话）。

> 为什么不用「首卡 `--new`、其余全复用」：探针实测（03:32）显示不带 `--new` 时投递**落进昨晚的旧会话**——`scripts/workbuddy/workbuddy-attach.mjs:508` 的选会话顺序是 `--session` → 全局 `last-session.json` → 最近同 cwd 会话，`last-session.json` 存的是昨夜 `7f1fbac1`（「A方案止血并补充单测」，5 条消息 3 个 agent 轮次）。跨目标复用一个长会话会漂移，故按作者选择改为分组。已把 `last-session.json` 备份为 `.runtime/workbuddy/last-session.json.bak-20261110` 后删除，避免任何脚本回落到昨夜会话。
> 兜底：若某张 `--new` 卡实际退化成复用，投递日志会留下 `space-new-task(fallback)`，晨间核对 `dispatch-20261110.log` 时按此识别。

## 3. 选题说明（为什么是这 12 项）

- **W1/W2/D3：browser 存量红 30 例**（13 文件，全存量债，非本夜引入）。W1/W2 拆两组逐例判「漂移/真缺陷/需实机」，D3 做**独立第二意见**（禁读前两份报告）——三份对照可区分「agent 口径不一致」与「真缺陷」。
- **W3：纯漂移 patch**。只改 `*.browser.tsx` 期望/选择器，出 patch 不跑 browser（外派禁跑）⇒ 中控晨间 apply 后先跑受影响 13 文件再全量。
- **W4：D9 挂点取证**（B 层唯一不需要产品裁定的取证项）。
- **W5：断章舍弃方案**。作者 11-09 21:1x 已裁「先做断章直接舍弃再合并 W1」；本夜只出方案，不实施。
- **W6：收口自检**（读 W1–W5 报告 + git status + 复跑触及单测 + typecheck）。
- **D1：A1 判据材料**（供晨间拍板：换模型 vs 改判据）。
- **D2：B5 短细纲验收草案**。
- **D4：C 层状态行校准草案**（只写现值，不改历史格）。
- **D5：晨间 digest**。
- **REVIEW：07:00 独立只读复核**（六件判定 + 越界检查）。

## 4. A1 口径（本夜不跑，写清楚为什么）

复核指出：原判据「同 run 连续 3 章全成功 + `*_SOURCE_CHANGED` 0 次」在「中断 → 续跑」场景**换 run 后不可观测**，「只记录」没有对象。本夜因此：

- 不跑 A1 实机（作者拍板顺延）；D1 只交**判据材料**，不改落库判据；
- 明早作者在线时跑 A1′（续跑链路取证），判定线拆两段：①起点是否=断点章；②续跑是否真进入 `running` 并有模型调用；
- 跑前先记断章草稿状态（`db:draft-list-all`），因为 W1 改的起点恰好撞 `src/services/workflows/batch-chapter-workflow.ts:248-251` 的「第N章已有草稿」硬错。

## 5. W1 patch 的处置

- 两文件改动已存 `.runtime/patches/w1-candidate.patch`（17230 B），全量工作区存 `.runtime/patches/wt-2-discard-20261110.patch`；
- wt-2 已 `stash push -m "night-20261110-w1-candidate-rescue"` 并 reset 到 `74ad3236`（可 `stash pop` 恢复）；
- **不合并**：等 W5 的方案 + 断章舍弃落地后再议。

## 6. 判定线与收口（07:00–07:45，中控）

1. 读 `REVIEW-0700.md` + `D5-morning-digest.md` + 各报告；
2. 逐份判 `可合并 / 需改 / 仅材料`；W3 patch 用 `git apply --check` 验证后再 apply；
3. 若合并：主区 `git merge --no-ff agent/wt-2`（或 apply patch 后提交），跑 `node scripts/check-fast.mjs`，**不推送**；
4. 台账/设计稿状态行按 D4 建议回填现值（只写现值）；
5. 写晨间交接稿 `docs/handoffs/2026-11-10-night-shift-closeout.md`（结论表 / 证据 / 待拍板 / 下一步）；
6. 不自己宣布完成：核结论以 07:00 复核与本稿判定线为准。

## 7. 不做清单

D12 复现/重演；B 层落地（D9/D7/D11/D12 接线等需裁定的项）；推送；动 wt-3；改全局配置；`pnpm test:node`；A1/A2 实机（顺延）；合并 W1 patch。

## 8. 风险与回退

| 风险 | 处置 |
|---|---|
| WorkBuddy 额度锁（连续两次秒回 + 兜底文案 + markers 空） | 改派 `--model DeepSeek-V4.1-Flash` |
| WorkBuddy exit 2（未连接/`NEED_HUMAN_DEBUG`） | 原样留横幅给作者，最多试 1 次，不 spawn/杀进程 |
| 豆包中途停 | `watchdog.mjs --task <cardId>` 或 `say "继续"` |
| 卡会话写 `develop/.runtime` EPERM | 投递成功即算成功（补丁 `bd9ec5a7`），日志缺了看 `.batch/night/` 报告 |
| 某任务超时/BLOCKED | 记录原样，不重跑、不补派，留待晨间 |
| 报告虚报 | 07:00 复核 + W6 自检双查；虚报直接标「不可信」 |

## 9. 收工回执（07:1x / 19:2x 补记）

| 项 | 结果 |
|---|---|
| 产物 | 11 份到位（wt-2 六份 + wt-1 五份）；**W4 单张缺失** |
| W4 缺因 | 卡会话 st3/st4 追加 `dispatch-20261110.log` 被沙箱拒写 → st5 触发 `approval/asked`（escalate `danger-full-access`）无人应答 → 卡卡死；WorkBuddy 侧无 `wb-w4-d9-hook-points` 落盘痕迹（`REVIEW-RECHECK-1658` R4 判 (d) 无法判定）。看板卡 `61296c61` 已按 `failed` 记执行结果并移回 backlog |
| 看板收尾 | 14 张 trace 卡：4 张卡在 `running` 的孤儿执行已 `settle`（记 `cancelled`），随后按产物记 external outcome（W4 `failed`，D3/D4/W6 `succeeded`），全部移出完成列 |
| 07:00 复核 | `REVIEW-0700.md` 判定 PASS（附 7 条剩余风险）；19:00 按作者指令换 **DeepSeek-V4.1-Flash** 开干净会话做第二遍，产出 `REVIEW-RECHECK-1658.md`，把结论收紧为「可信 + 三处订正」 |
| 台账回填 | 提交 `19c7f8a4`：backlog 出处列 21 行指针按实测行号重算、D13 补「未实机」、D20 加 W4 指针 |
| W3 patch | 仍未合并。只能作为「测试夹具漂移修正」合（不得表述为「红转绿」），合并后须在主区跑 3 个 `*.browser.tsx` + 全量 `test:browser` 才算闭环 |
| 未做 | A1/A2 实机（作者拍板顺延）；B 层落地；推送；W1 patch 合并 |
