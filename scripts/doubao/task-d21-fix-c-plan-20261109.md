# D21 修法 C 实施方案任务书（2026-11-09 · 交给豆包）

【只出方案 · 不许改产品代码 · 不许 git 写 · 不许跑实机】

工作区：`C:\develop\workspace\AI-writer\develop`（develop 主区；派活前由 Lead 把豆包「项目」指到这里）。
基线核对（只读）：分支 `exp/resource-ledger`，HEAD `6d52ace9`。开工先跑 `git -C <repo> rev-parse --short HEAD` 与 `git -C <repo> status -sb`，把输出贴进报告，不要写任何文件。

## 背景一句话

D21 = 卷结构表 `stale` 时，「大纲领先正文」的闸门整体短路、静默放行。作者已裁定走**修法 C**（旁路 `db:volumes-list` 的 `state`，用 `materializeVolumeStructure` 按 `project_core` 的 `plot_structure_plan / synopsis / totalChapters` 现算卷边界），并明确「单测肯定是要改的，就算是 TDD 驱动开发，测试也是要跟着实际需求点走的」。现在缺的是**可落地的实施方案**，不是再讨论方向。

## 必读（依次读，然后用 3 行复述红线，复述完再动手）

1. `AGENTS.md`（仓库根）
2. `docs/agents/documentation-charter.md` 的 §4 与 §6
3. `docs/agents/doubao-channel.md` 的 §4.1 与 §5
4. `docs/design/product/d21-fix-c-implementation-plan-20261109.md`（五个决策点 / 单测改法 / 两处 UI 建议值）
5. `docs/design/product/d21-gate-shortcircuit-evidence-20261109.md`（§③/§④ 的 diff 属 A/B，§⑦ 才是 C 的方向）
6. `docs/design/product/d21-gate-ui-guide-20261109.md`（四槽位 `title / body / dismissLabel / defaultReason`）

**复述要求**：3 行内写清「只出方案、不改产品代码 / 禁 git 写与实机 / 不采信文档结论当代码证据」。**没复述 = 当没读，Lead 拒收重派。**

## 要交付什么

一份实施方案，五个决策点每个都给「推荐值 + 理由 + 可粘贴的 diff 草案 + 影响面」：

| # | 决策点 | 必须回答 |
|---|---|---|
| 3.1 | 数据来源与读取 | `db:project-core-get` 的调用位置、`expectedProjectPath` 取法、读取失败 / 空值时的降级策略（不得退回「用旧表边界」） |
| 3.2 | 现算与合并 | `materializeVolumeStructure({plan, synopsis, totalChapters})` 与 `volumes` 表运行时数据（`actualLast` / 进度）怎么合并；冲突时以谁为准、为什么 |
| 3.3 | 取区间逻辑下沉 | `volumeRangeEndingAt` / 「上一卷区间」抽到 `src/shared/` 供 services 与两个 tsx 共用；给新函数签名 + 全部调用点清单 |
| 3.4 | 确认顺序 | `src/shared/outline-progress-gate.ts` 里 `acknowledged` 早退当前排在过期类之前，改成「过期优先」的准确改法与理由 |
| 3.5 | 单测 | `src/services/__tests__/outline-progress-gate.test.ts:154-165` 现把短路固化成「判不出就不拦」；给改写后的断言清单（含 `stale` 时仍要判 / 过期优先 / 现算边界三档） |

另给三块：

- 两处 UI 建议值是否采纳，逐条给结论：主次按钮不对调；「表旧」做附注、不扩展第五档 `reason`。
- 「**生产代码 + 断言必须同一次提交**」的落地顺序、回滚点、验收命令。
- 风险与未验证项。**必须显式排除修法 A**：只删 `state` 短路而仍用旧表边界 ⇒ 界面用过期边界撒谎，作者已否；方案里要写清 C 与 A 的分界线在哪一行代码。

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

唯一产物：`C:\develop\workspace\AI-writer\develop\.batch\doubao\d21-fix-c-plan-20261109.md`（目录不存在先创建；`.batch/` 是 git 未跟踪的产物目录，**不要提交、不要 add**）。

结构：① 改动清单（本任务应为空，只列报告文件）② 执行记录（跑了哪些只读命令 + 退出码）③ 原始输出（读到的关键代码**原样粘贴**，不要总结成「符合预期」）④ 结论与未做的事（含所有 BLOCKED / SKIPPED 的原因）+ 上面的实施方案正文。

**不要**新建 `SUMMARY` / `VERIFICATION` / `*_DONE.md` 之类自证文件；**不要**输出队列标记行（本任务不是队列任务，Lead 以「报告文件存在 + 四节齐全」判完成）。报告写完立即停止，不自主扩展范围、不自己开工改码。

## 硬约束（汇总）

只读 + 只写这一个报告文件；不改 develop 主区任何产品代码；不跑实机（`pnpm dev` / CDP 9222 归 Lead）；不调用 DSH / 看板 CLI；不做 git 写；不自己宣布「已完成」。
