# 11-10 夜跑复核结论（中控 review + 派 WorkBuddy 二重复核）

> 状态：已收口（2026-11-10 19:3x）。授权：中控只做调度与收口（作者 03:0x 拍板），复核单独交 WorkBuddy。
> 对象：`wt-2/.batch/night/REVIEW-0700.md`（07:00 首轮）+ 夜间 11 份产物报告。

## 一、结论

| 项 | 首轮 `REVIEW-0700.md` | 二轮 `REVIEW-RECHECK-1658.md`（DeepSeek-V4.1-Flash） | 中控裁定 |
|---|---|---|---|
| W1 / W2 browser 存量红分类 | W1 PASS、W2 REWORK | R1/R6 部分订正 | 分类材料可用；W2 的行号与个别结论要按二轮订正 |
| W3 漂移 patch | PASS，但无复绿证据 | 成立且理由更准 | **只能作「测试夹具漂移修正」合**，合后必须主区跑 `test:browser` |
| W4 D9 挂点取证 | BLOCKED（产物缺） | 判 (d) 无法判定 | 事实是**投递成功、产物没落地**，需重派 |
| W5 / W6 | PASS | PASS（无虚报） | 可用 |
| D1–D5 | PASS | PASS | 材料可用，D4 已采纳一半落库 |

**一句话**：首轮复核的主体结论可信，二轮把三处收紧/订正掉；但两轮都只证明了「报告之间的说法一致」，没有一条证明「改完测试真的绿了」——那条证据只能在主区跑 `test:browser` 才拿得到。

## 二、四件事必须先讲清楚

1. **W4 不是没人接，是接了活没落盘。** 卡会话投递 `exit 0` 之后去追加 `dispatch-20261110.log`，被沙箱拒写，随后触发 `approval/asked`（要求提升到 `danger-full-access`）；夜间无人应答，卡就停在那儿。WorkBuddy 侧也找不到 `wb-w4-d9-hook-points` 的任何痕迹（6 个会话文件全扫过）。
2. **W3 patch 在原位已应用过，且无法前向 re-apply。** `git apply --check` 报 `patch does not apply`，`--check -R` 却通过——因为 wt-2 工作树里那 4 行改动**本来就在**，patch 是它的导出。已用 `git apply -R` 把 wt-2 退回干净基线（`git status` 现在只剩 `?? .batch/`）。合并时直接取 patch 文件即可，不要以为它还没落。
3. **07:00 首轮复核跑的是 Hy4，不是约定的 DeepSeek-V4.1-Flash。** 会话记录 `function_call.providerData` 写的是 `hy4free / Hy4`。二轮已按作者指令用 `--model DeepSeek-V4.1-Flash --new` 重做，32 次调用全部落在 `deepseek-v4.1-flash`，`status` 的 model chip 也读回一致。
4. **「4 条兜底」只兜住了两路。** 兜住的：①产物落点二分（`develop/.runtime` 不可写退槽位 `.batch`）；②投递成功但产物写盘失败不再 `exit 1`（补丁 `bd9ec5a7`）。**没兜住的**：③卡会话自己追加日志到**已存在文件**仍被拒 → 触发提权 → 无人值守卡死（W4 就是这么丢的）；④`approval/asked` 本身没有超时兜底，卡在 `running` 列不下楼（看板 4 张卡一直悬在 running 就是这么来的，已逐张 `settle`）。

## 三、看到的「待审批」和「一直 running」

- 看板列表里的「待审批」是卡执行引出的权限确认，不是复核结论待审。
- 4 张 trace 卡（W4 `61296c61` / D3 `6cde3cdc` / D4 `85249f25` / W6 `93ef8347`）的 `schedule` 早已 `endedReason=fired`，但执行记录没有落地结论 → 卡挂在 `running`。已 `settle`（记 `cancelled`）后按产物补记 external outcome：W4 `failed`，D3/D4/W6 `succeeded`，全部移出完成列。

## 四、二轮复核（`REVIEW-RECHECK-1658.md`）的可信度

- 它替我补的第三方证据是硬的：`run-tests-electron.mjs:44-56` 透传 argv 但**不传 `--config`** ⇒ `pnpm test <browser 文件>` 结构上收不到 `*.browser.tsx`，所以「No test files found」不是 W3 改写造成的；`vitest.browser.config.ts:29` 的 include 才是 browser 套件的入口。
- 它替 W6 补跑的 73 + 48 单测均 EXIT=0 ⇒ W6 的 164 = 73+48+15+28 无虚报。
- 它的三处订正（W2 §3.6 从「不可执行」改「不完整」、dispatch 日志行号偏 +1、行号抽查说过头）经我抽查成立。
- 它的弱项：模型由我另行取证（它自述「界面实选未暴露」）、过程文件落在 `%TEMP%/rc1658/`。

## 五、还差什么才能算完成

| # | 事项 | 谁 | 前置 |
|---|---|---|---|
| 1 | W3 patch 合并 + 主区跑 3 个 `*.browser.tsx` + 全量 `test:browser`（基线 30 failed） | 中控 | 作者点头合并 |
| 2 | W4 D9 挂点取证**重派**（改用不写日志的投递，或日志路径改到槽位 `.batch`） | 中控 + WorkBuddy | 修日志落点 |
| 3 | 17 条「跳过漂移」+ 7 例「产品兜底」分类口径 | 作者拍板 | — |
| 4 | 两个跨夜保全副本（`w6-selfcheck-20261109.md` / `REVIEW-0700-20261109.md`）留不留 | 作者拍板 | — |
| 5 | A1′ 续跑取证 / A2 D16 实机 | 中控 | 作者在线 |

## 六、本轮改动

- `19c7f8a4` 台账回填：backlog 出处列 21 行指针按实测行号重算、D13 补「未实机」、D20 加 W4 指针。
- `7885b1dc` 夜跑通道兜底追认 + 计划稿收工回执 + 11 份任务书入库。
- wt-2：W3 patch 已 `git apply -R` 退回干净基线（工作树只剩未跟踪 `.batch/`）；patch 文件保留在 `wt-2/.batch/night/w3-drift.patch`。
- 看板：14 张 trace 卡已全部落地结论并移出 running；W4 卡按 `failed` 记录，执行记录里写明缺因。
