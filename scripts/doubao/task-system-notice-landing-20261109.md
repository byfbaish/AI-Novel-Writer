# SYSTEM_NOTICE 落地方案任务书（2026-11-09 · 交给豆包）

【只出方案 · 不许改产品代码 · 不许 git 写 · 不许跑实机】

工作区：`C:\develop\workspace\AI-writer\wt-1`（豆包「项目」已指向 wt-1；该 worktree 已 fast-forward 到与主区同一 HEAD，代码一致）。
基线核对（只读）：分支 `agent/wt-1`，HEAD `5d2baca9`（= 主区 `exp/resource-ledger` 当前 HEAD）。开工先跑 `git -C <repo> rev-parse --short HEAD` 与 `git -C <repo> status -sb`，把输出贴进报告，不要写任何文件。

## 背景一句话

W5 追认删除 `PROJECT_DATA_CLEARED` 后，「清空项目数据」的三档回执改走既有 `SYSTEM_NOTICE` 通道（`AppLogger.info / warn / error`）。但夜跑取证发现 `SYSTEM_NOTICE` **生产订阅方为零** —— 三档回执发出去了，UI 一次都没收到。作者裁定「按建议来」：单独立项、范围收到「清空回执」一档、复用现有 toast、不新造项目隔离机制；并同意后续做实机验收。现在缺的是**落地方案**，不是重新讨论要不要做。

## 必读（依次读，然后用 3 行复述红线，复述完再动手）

1. `AGENTS.md`（仓库根）
2. `docs/agents/documentation-charter.md` 的 §4 与 §6
3. `docs/agents/doubao-channel.md` 的 §4.1 与 §5
4. `docs/plans/prompt-assembly-backlog.md` 的「`SYSTEM_NOTICE` 零订阅 · 新立项」节（方案边界 + **不进 D 段冻结快照**）
5. `docs/handoffs/2026-11-09-night-batch-digest.md` §二-2 与 §四-1（零订阅的发现经过与 D10 口径）
6. `src/shared/event-bus.ts`、`src/services/project-clear-service.ts`、`src/services/__tests__/project-clear-service.test.ts`
7. 现有 toast / 通知组件（自己检索定位，给 `文件:行`）

**复述要求**：3 行内写清「只出方案、不改产品代码 / 禁 git 写与实机 / 不采信文档结论当代码证据」。**没复述 = 当没读，Lead 拒收重派。**

## 要交付什么

一份落地方案，逐项给「推荐值 + 理由 + 可粘贴 diff 草案 + 影响面」：

| # | 项 | 必须回答 |
|---|---|---|
| 1 | 订阅方落点 | 哪个渲染层组件 / 哪个生命周期订阅 `SYSTEM_NOTICE`，为什么是这里。必须处理这个已知坑：**事件订阅者组件必须挂载才收得到事件**（切回对应页面才生效），方案里要写清在哪个页面 / 挂载时机订阅，并给 `路径:行` 证据 |
| 2 | 三档 → toast 映射 | `info / warn / error` 各对应哪档视觉与文案；按作者裁定「范围收到清空回执一档」，到底保三档还是收成一档，给结论与理由 |
| 3 | 跨进程落点 | 主进程 emit → preload → 渲染层的路径是否通；不通就指出缺哪一段，给最小改法 |
| 4 | 复用现有 toast | 给现有组件名与调用签名，说明为什么**不需要**新组件；不要新造项目隔离机制 |
| 5 | 已知边界 | 不带 `projectSession` 就不按项目隔离 ⇒ 多项目同时开会不会串；写明「有意不修」还是给低成本规避 |
| 6 | 验收清单 | ① 单测：`project-clear-service.test.ts` 现有 16 例断言要不要动、怎么动 ② **实机**：列清步骤与判据（点哪里、屏幕上应该出现什么、DB / 日志前后读数），但**不要自己跑**，实机归 Lead 用 CDP 9222 |
| 7 | 状态回填 | 明写「不进 D 段冻结快照」：方案里只说明**现值该写进哪里**（现值索引）；**条目状态行由 Lead 按作者裁定回填，不在本任务范围、不要代写**；历史格值零删改 |

## 允许命令白名单

- 只读检索（文件定位 / 内容搜索）、`git status`、`git rev-parse`、`git log`、`git diff`（只读子命令）。
- 单文件或少量文件的 node 环境单元测试：`node node_modules/vitest/vitest.mjs run <路径>`（本任务预计不必跑）。
- `npx tsc --noEmit` 允许。
- **禁止**：任何 git 写（`add / commit / reset / checkout / stash / push`）· `pnpm test` · `pnpm dev` · 打包 · `*.browser.tsx` · `scripts/f0*-journey.mjs` · 一切要起应用进程或占固定端口 / 单实例锁的脚本 · 改全局配置。

## 三条行为约束

1. 不改任何既有实现、不改任何既有测试断言；产物只新建**一个**报告文件。
2. 没读到的内容只能写「本次读取的文件内未找到」，**不许写「全仓没有」**；每个结论给 `路径:行号` 并粘贴不少于 5 行原文代码。
3. 不确定的判定必须标「不确定」，不许硬判；不采信设计稿 / 交接稿 / 缺陷稿里的结论当代码证据，只回代码原文。

## 交付四节报告

唯一产物：`C:\develop\workspace\AI-writer\develop\.batch\doubao\system-notice-landing-20261109.md`（目录不存在先创建；`.batch/` 是 git 未跟踪的产物目录，**不要提交、不要 add**）。

结构：① 改动清单（本任务应为空，只列报告文件）② 执行记录（跑了哪些只读命令 + 退出码）③ 原始输出（读到的关键代码**原样粘贴**，不要总结成「符合预期」）④ 结论与未做的事（含所有 BLOCKED / SKIPPED 的原因）+ 上面的落地方案正文。

**不要**新建 `SUMMARY` / `VERIFICATION` / `*_DONE.md` 之类自证文件；**不要**输出队列标记行（本任务不是队列任务，Lead 以「报告文件存在 + 四节齐全」判完成）。报告写完立即停止，不自主扩展范围、不自己开工改码。

## 硬约束（汇总）

只读 + 只写这一个报告文件；不改 develop 主区任何产品代码；不跑实机（`pnpm dev` / CDP 9222 归 Lead）；不调用 DSH / 看板 CLI；不做 git 写；不自己宣布「已完成」。
