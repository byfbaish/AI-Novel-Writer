# 2026-11-11 夜班 digest（收口稿）

> 对应计划：[`2026-11-11-night-shift-plan.md`](2026-11-11-night-shift-plan.md)（该稿状态行已按本稿结算为「已中止」）。
> 收口执行：2026-11-11 19:0x，授权「可改码（限收口必需）+ 可写文档」，**未提交、未推送**。
> 基线：`exp/resource-ledger` @ `5e031021`；收口后改动仍在工作区。

## 0. 一句话

夜跑跑到 **04:18 停摆**（计划 08:10），**S3–S6 全段未执行**：Lead 侧实机没起、全量测试没跑、零提交、无 digest。
卡面 40 张：**26 done / 14 未结算**；done 里 3 张实质空手、1 张结论已被本轮实测推翻。
本轮把可信成果**收进 develop 工作区并复跑验证**，把不可信的一律标出来，不硬凑完成度。

## 1. 停在哪、为什么

| 计划段 | 内容 | 实际 |
|---|---|---|
| S0–S2（01:50–04:20） | 探针 / 夹具 / 交叉复核 | ✅ 超量完成（卡从 18 扩到 40） |
| S3（04:20–05:30） | Lead 起 dev、造慢吐 fixture、采 `M1/` | ❌ **`wt-2/.runtime/judge` 三层路径全不存在** |
| S4（05:30–06:40） | Lead 跑 B16 实机 + `pnpm test` 全量 → `M2/` `M3/` | ❌ 未执行 |
| S5（06:40–07:20） | 收 patch → apply → `check:fast` → 分批提交 | ❌ 未执行，**零提交** |
| S6（07:20–08:10） | RV 独立复核 + digest + README + memory | ❌ 未执行 |

**断点性质**：不是 worker 停了，是 **Lead 侧工序整段没启动**。WB-4/5/6/7 四张判读卡的释放前提全是「Lead 实机产物已落盘」，产物没落 ⇒ 四张永远放不出去（WB-4 已被释放过一次、只能判 BLOCKED，其余三张连认领都没发生）。
另有一层：WB-11 的交付物（`NIGHT-INDEX-20261111.md`）**在 `wt-2/.batch/night/` 不存在**，卡 `e7de142f` 从未认领。

## 2. 已做 / 未做对照（40 张全表）

> 判定来源：报告末行 `## [T\d] …` 原文 + 看板 `status`；两处不一致的单列。

### 2.1 已结算且**有实质成果**（8 张，已收进工作区）

| 卡 | 成果 | 本轮复跑 |
|---|---|---|
| DB-1 `9af76744` | `src/shared/batch-completion.ts`（54 行纯函数，零调用方） | ✅ 用例已由 WB-14 扩到 17 例 |
| WB-14 `8690ecde` | 上条补 11 例（含 WB-8 点出的 `coveredTo` 只补边界） | ✅ **17/17 passed** |
| WB-1 `1ada5cbf` | `generation-run-service.test.ts` 夹具补 M29 三列 | ✅ **43/43 passed**（补上「从未复跑」的缺口） |
| DB-4 `981977bf` | 缺陷稿 D9 状态行改 🟡 + 历史判断逐字保留 | ✅ 已合入 |
| WB-11 `a2a68e9e` | backlog D17 格加「11-02 快照」括注 | ✅ 已合入 |
| WB-13 `db504048` | `scripts/check-ledger-snapshot.mjs`（台账体检，纯新增） | ⚠️ 未运行验证 |
| DB-8 `44f5be66` | 13 份报告四组归并 + 12 条「不可信读数」清单 | ✅ 质量最高的一份 |
| WB-9 `cf8d1c75` | `M1-M2-runbook.md`（28KB 实机手册） | ⚠️ 手册本身未实跑 |

### 2.2 已结算但**实质空手 / 结论被推翻**（4 张）

| 卡 | 看板 | 实情 |
|---|---|---|
| WB-3 `b20c9393` | done | 报告判 **BLOCKED**：D17 前提已失效（2026-11-05 已结项），卡面授权不足。零代码改动 |
| WB-4 `926a5b30` | done | 报告判 **BLOCKED**：`M1/` 缺产物，五问全「无法判定」 |
| WB-10 `3830d5fa` | done | **方案 A（`await act(async () => {})`）本轮实测无效** —— 基线比对：带改动与不带改动同为 `1 failed \| 6 passed`，`listeners.size` 仍为 2 而非 1。该行改动**已回退**，B11 仍属既有红 |
| DB-5 `105067bc` | **todo** | 报告已写（15279 B，判 DONE），但**卡从未打 `review`/`release`** ⇒ 结算缺口 |

### 2.3 已结算的判读/材料卡（14 张，无代码改动）

`c87c888f`（P-WB）· `f41947b6`（WB-2 B11 静态判定）· `ee4a088e`（P-DB）· `40e86fcc`（DB-2 B16 文案对照）· `b80a3fe8`（DB-3 超时→续写三候选）· `3a9ca460`（DB-6 交叉复核）· `ee381832`（DB-7 D17 自检）· `d438ab0c`（WB-8 复核 DB-1）· `e96023e7`（DB-9 复核 WB-8）· `d95d7ddf`（DB-10 台账建表）· `fff9668f`（DB-11 交叉一致性）· `acb9ce53`（DB-12 静默失败普查）· `9d73e91a`（DB-13 browser 反模式普查）· `4cdc69cd`（DB-14 对 WB-3 第二意见）

### 2.4 未做（14 张）

| 卡 | 状态 | 未做原因 |
|---|---|---|
| WB-5 `b33ca4e0` | todo | 等 `M2/`，不存在 |
| WB-6 `2fff7426` | todo | 等 `M3/`，不存在 |
| WB-7 `016862ed` | todo | 等 S5 窗口 + 前三张交回 |
| RV `f9cb0320` | todo | 07:00 到点但无人起干净会话 |
| DG `db186e6c` | todo | 报告判 BLOCKED：`wt-1/.runtime/night11/manifest.json` 不存在 |
| WB-15 `07309f0d` / WB-16 `c1b9e689` / WB-17 `e55f68df` | todo | 04:0x 建卡后来不及释放 |
| WB-18 `5db9f31e` / WB-19 `2a034878` / WB-20 `ff1da4c0` | todo | 同上 |
| WB-21 `e7de142f` | todo | 从未认领，交付物缺失 |
| WB-22 `0e442deb` | todo | 同上 |
| DB-5 `105067bc` | todo | 报告已交但未结算（见 §2.2） |

## 3. 本轮收进 develop 工作区的改动

```
 M docs/design/product/live-pipeline-acceptance-defects-assessment.md   （DB-4：D9 → 🟡 阶段 1）
 M docs/plans/prompt-assembly-backlog.md                               （DB-4 + WB-11：D9 补提交号 / D17 加括注）
 M docs/handoffs/2026-11-10-night-closeout-and-next-steps-handoff.md   （11-10 遗留，非本轮产物）
 M electron/services/__tests__/generation-run-service.test.ts          （WB-1：夹具补 M29 三列）
 M src/components/editor/__tests__/ReviewReport.confirmation.browser.tsx      （11-10 C1，非本轮产物）
 M src/components/layout/v2/__tests__/f05-writer-immersion.browser.tsx        （11-10 C1，非本轮产物）
?? src/shared/batch-completion.ts                                      （DB-1 + WB-14）
?? src/shared/__tests__/batch-completion.test.ts                       （17 例）
?? scripts/check-ledger-snapshot.mjs                                   （WB-13）
```

**合并口径（重要，勿按直觉重做）**：`batch-completion.ts` 在 wt-1 与 wt-2 **字节完全相同**（md5 `9b87419b…`）⇒ add/add 假冲突，取任一份；`batch-completion.test.ts` 两边**内容不同** —— wt-1 是 DB-1 原生 6 例、wt-2 是 WB-14 扩充的 **17 例超集**，**必须取 wt-2 版**，否则会丢掉 WB-8 指出的 `coveredTo` 缺口用例。

**已回退**：`src/components/startup/__tests__/RendererStartup.browser.tsx` 的 `await act(async () => {})`（WB-10 方案 A，实测无效）。

## 4. 本轮复跑验证（这些读数此前一条都没有）

| 门 | 结果 |
|---|---|
| `node scripts/check-fast.mjs` | ✅ typecheck 19.4s / doc-links 1412 断裂 0 / doc-placement 417 份 0 违规 |
| `pnpm test src/shared/__tests__/batch-completion.test.ts` | ✅ **17 passed / 17** |
| `pnpm test electron/services/__tests__/generation-run-service.test.ts` | ✅ **43 passed / 43**（此前「43/43 全绿」无人复跑） |
| `pnpm test:browser …/RendererStartup.browser.tsx` | ❌ **1 failed / 6 passed**（B11 既有红；带方案 A 与不带完全相同） |
| `pnpm test:browser`（全量，106 文件） | ❌ **`2 failed / 835 passed / 837`**，99.3s —— 失败恰为 B11（`RendererStartup.browser.tsx:138`）与 B16（`CodeMirrorEditor-generation.browser.tsx:281`） |

⇒ 由此定死两条口径：
1. **「43/43 全绿」在 `pnpm test`（Electron 运行时）下真实成立**，DB-8 §4 第 10 条说的「裸 node 因 ABI 145 vs 127 恒红」是入口选错，不是夹具没修好。
2. **`2 failed / 835 / 837` 这条判定线实测成立**（此前 DB-8 §6 第 7 条质疑「只有期望、无实测出处」—— 现已坐实，且与期望逐字吻合）。

## 5. 待作者裁决

1. ~~**是否提交**~~ —— ✅ 作者 19:1x 批「按建议拆开提」，已分 5 条提交（见 §8）。
2. **B11 怎么定性** —— 方案 A 实测无效 ⇒ 作者 19:1x 已批「可以」，按真泄漏未排除挂实机计数探针（见 §8）。
3. ~~**`2 failed / 835 / 837` 这条基线本身无实测出处**~~ —— ✅ 已实测坐实（§4 末行），与期望逐字吻合。
4. **WB-3 / D17 是否撤卡** —— 作者 19:1x 已裁「撤」（见 §8）。
5. **13 张未结算卡怎么处置** —— 建议：WB-5/6/7 + RV + DG 移到下一班（前提是 Lead 实机先做）；WB-15..WB-22 按 §7「08:10 未认领 ⇒ 移 backlog」处理，不 `done`。
6. ~~**DB-1 语义待定**~~ —— ✅ 作者 19:1x 已裁：失败只废当前章、取消整批作废、覆盖 ≠ 完成，已落地（见 §8）。
7. **DB-8 的 11 项待裁**（D17 台账改字、DB-3 的 A/C、WB-2 的 A/B/C、WB-1 测试入口是否越界、`generation-controller.test.ts` 既有红等）仍全部有效，见 `wt-1/.dsh-task-board/reports/44f5be66-….md` §3。

## 6. 未验证事项（别当已验）

- `scripts/check-ledger-snapshot.mjs` **一次都没跑过**，首次运行结果未知。
- `M1-M2-runbook.md` 的三处未核仍在：本机无 `sqlite3` CLI、造慢吐三法未测、按钮名「查看当前输出」源码未找到。
- 所有「实机」结论为 0 —— D9 阶段 1 仍是单测级，B16 走哪条文案分支仍未知。
- DB-2 判 B16 为「测试写法问题」纯属代码推断，未跑 browser。
- DB-3 的「超时→续写」只证了批次路径，**续写链路本夜无人读**。

## 7. 残留与环境

- 分支：`exp/resource-ledger` @ `5e031021`（未提交、未推送）。
- worktree：`wt-1` / `wt-2` @ `5e031021`，各留夜跑 `M` 与 `?? .batch/`；`wt-3` @ `a7b84373` 干净。
- 报告：`wt-1/.dsh-task-board/reports/` 与 `wt-2/.dsh-task-board/reports/` 共 18 份（11-11 当日）。
- 看板：ledger `0bdbb2fa…`，收口时 rev 781。
- **11-10 教训复现一次**：worktree 里跑 `check:fast` 前要把 `.workbuddy/memory/` 从主工作区 `cp` 过去，否则 doc-links 会红（`.workbuddy/` 被 gitignore）。

## 8. 作者 2026-11-11 19:1x 六条裁定与落地

作者原文要点：①按建议拆开提 ②B11 可以挂实机 ③基线可以跑 ④WB-3/D17 撤卡 ⑤提权失败原因要修操作手册，留作夜间 ⑥失败与取消的章节不能算完成 —— 取消是整批取消，失败只是当前章节失败，「这个应该在某个需求稿里是一致的」。

### 8.1 第 6 条：语义修正（已落地，`batch-completion.ts`）

**需求稿核对结论**：作者说的口径与 [`batch-interrupt-resume-design.md`](../design/features/batch-interrupt-resume-design.md) 一致 ——
§7 第 129 行「正文批量本来一章一落稿，失败只废最后一章」；§11 第 133 行「批次不完整时 `synopsis_covered_to = range.from - 1`，批内已完成的章只留在候选区、不计入已覆盖」。
另 [`d2-run-lease-abort-design.md`](../design/features/d2-run-lease-abort-design.md) §2.3 把 `failed`（跑过但失败）与 `aborted`（根本没跑完就死了）分开记。

**改动前**（DB-1 原实现）三个状态一视同仁，`coveredTo` 无条件计入 ⇒ 中断的 run 会把「尝试覆盖到」当成「写完了」。

**改动后**：

| run 状态 | `completedChapters` | `coveredTo` | 依据 |
|---|---|---|---|
| `completed` | 计入 | **计入** | 跑完 ⇒ 边界即完成边界 |
| `failed` | 计入 | **不计入** | 一章一落稿；覆盖 ≠ 完成 |
| `aborted` | 计入 | **不计入** | 进程死亡前落了的章确实落了；抹掉会让重开批撞「已有草稿不覆盖」 |
| `cancelled` | **一条都不计入** | 不计入 | 主动取消 = 整批作废 |
| `running` / `paused` / 其它 | 跳过 | 跳过 | 未终态 |

代码以两个常量表达：`CHAPTER_EVIDENCE_STATUSES = {completed, failed, aborted}` + `COVERED_TO_IS_COMPLETION_STATUS = 'completed'`，函数头注释同步写明出处。
**⚠️ 待作者确认一处（我按需求稿推的）**：`aborted` 处理成「同 failed、保留已落稿章」—— 作者原话只点了「失败」与「取消」两种，`aborted` 是我依据 D2 §2.3 的性质划分推的。若认为进程死亡也该整批作废，改 `CHAPTER_EVIDENCE_STATUSES` 去掉 `'aborted'` 即可（一条常量 + 一条用例）。

### 8.2 第 1 条：提交（5 条，未推送）

| # | 提交 | 内容 |
|---|---|---|
| 1 | `test(generation) 补 M29 三列到 run-service 夹具` | WB-1 夹具（43/43 已复跑） |
| 2 | `feat(d9) 阶段2 逐章完成读数纯函数 + 失败/取消语义分档` | `batch-completion.ts` + 20 例测试（DB-1 / WB-14 / 本轮作者裁定） |
| 3 | `docs(ledger) D9 阶段1 现值回填 + D17 快照括注 + 台账快照脚本` | DB-4 / WB-11 / WB-13 |
| 4 | `test(browser) R2-A 两处残留断言按新口径修正` | 11-10 C1 待裁材料落地（browser 全量 26 → 2 已由本轮坐实） |
| 5 | `docs(handoff) 11-11 夜班收口：40 卡结算 + 基线实测 + 计划稿转存档` | 本稿 + 计划稿状态行 + README 索引 + 夜跑任务书 |

### 8.3 第 4 条：撤卡

`b20c9393`（WB-3 · D17 大纲覆盖章区间）**撤卡**：D17 已于 2026-11-05 结项，卡面前提失效、授权不足，三方（WB-3 自判 / DB-7 / DB-14 第二意见）结论一致。

### 8.4 第 2、5 条：B11 探针待释放，手册已当场修完

| 卡 | 卡 ID | 状态 |
|---|---|---|
| B11 实机计数探针 | `86418ba9-f08c-4859-95c5-4384a1cd7aa3` | **todo，未挂 external**。数 `window:close-requested` 实际订阅数（启动后 / 开项目后 / 外观损坏恢复路径 三时刻分开取），判 A 合成 Workspace 多订 / B TitleBar 未卸载 / C 真泄漏 |
| 派发手册校验缺口修复 | `377045e2-1492-4422-8724-cd389f13a95c` | **已由作者 19:2x 改口「现在就修，不留夜间」，当场做完并结算**（`c441279c`），见 §8.5 |

**作者 19:2x 的订正**：手册必须当场修，不能留到夜间——否则夜间实机测试永远推进不了（卡在提权确认框上，没人点）。

- **提权失败根因（已有证据，本稿不重复）**：WorkBuddy `chips.workspace` 恒 null ⇒ `:355-358` 的守卫从未真正拦过，修法方向是按 `recentSessions[].cwd` 回查；DSH 是进程权限档（受限令牌 + Low 完整性）问题，两者不同根，共同结论只有一条 —— 会话落地根目录必须 = 卡面所有绝对路径的父目录。

### 8.5 19:2x–19:4x 补做（作者四问的落地）

**① `aborted` 语义 → 作者确认「符合要求」，不改。** 现口径：`failed` 只废当前章（`completedChapters` 照收、`coveredTo` 不计）、`cancelled` 整批作废（一条不计）、`aborted` 同 `failed`（进程死亡前落了的章确实落了，抹掉会让重开批撞「已有草稿不覆盖」）、`coveredTo` 只在 `completed` 时计入完成边界。

**② 派发手册已修（`c441279c`）** —— 不止写手册，把根因做成机制：

- 查出**比我原先写在计划稿 §10 更精确的失效面**：三道 cwd 校验全在「新开草稿 + 首条消息」这个窗口上失效，而夜间派活恰好全是 `--new`——
  1. `openSpaceDraft` 的 `chips.workspace` 守卫：字段恒 null ⇒ 死代码；
  2. 发送**前**的校验要求 `sessionId` 已知，新草稿恒 null ⇒ 整段跳过；
  3. 回复**后**的校验在消息已发出之后 ⇒ 只能事后报警。
- 新增纯函数 `judgeLanding`（`stuck` / `switched-unverified` / `cwd-ok` / `cwd-mismatch`）+ 两道闸门：
  - **闸门 ①（打字之前）**：比对点 `+` 前后的 `currentId`，未变化即拒，**一个字都不打**。这是唯一的止损点——`+` 没生效时 `waitForEditor` 会在旧会话上立刻返回 `hasEditor=true`，脚本照常打字，文本就落进旧会话（02:1x 实测事故）。
  - **闸门 ②（发出后 8s）**：按 `currentSessionId` 回查 `sessions.cwd`，不符当场 fail；未落库标 `landing=unverified` 写进产物。
- **`--force` 不赦免这两道闸门**：force 的语义是「允许离开固定归属目录（wt-2）」，不是「允许把任务投给错误的会话」。
- 手册落点：`workbuddy-channel.md` 新增 **§2.3 落点闸门**（含三平台命名对照：WorkBuddy「空间」/ DSH「工作区」/ 豆包「项目」）、§3.1 加**夜间禁 `--force` 跨目录派活**、§8 补三条失效判据；`task-board-channel.md` 补「会话落地根目录 = 卡面绝对路径的父目录」。
- 单测 42 → 47 例全绿。**诚实标注**：两道闸门只有单测，尚未在真机复现事故，已写进 `workbuddy-channel.md` §7「未验证」。

**③ `check-ledger-snapshot.mjs` 首次运行 → 发现脚本自身有假阳性，已修（`8bc4f61f`）**

- 首跑：`OK 10 · MISSING-SNAPSHOT 11`（exit 1）。
- 逐条核：**9 条是假阳性** —— 快照表把缺陷合并登记成区间行（`D4–D8` / `D9–D11、D16`），旧实现按「整格等于单个编号」匹配，整行跳过。
- 修后：`OK 19 · MISSING-SNAPSHOT 2` —— D20（2026-11-05）、D21（2026-11-09），两者都**晚于快照表的 2026-11-02**，天然没有快照行，属预期、不是漏登记。
- 顺带修掉一个更坏的误导：复合行状态原按 40 字截断，`D4–D7 未开工 · D8 已实施` 截成前半句后对 D8 就成了「未开工」，改为给原文行号指针。
- 新增单测 9 例（`scripts/__tests__/check-ledger-snapshot.test.mjs`）。

**④ `wt-1` / `wt-2` 已清干净**：夜跑产物全部进主线后，两处 `reset --hard 8c0bd657` + `clean -fd`（保留 `.workbuddy`），现 `git status` 空、`clean -nd` 0 项。wt-2 那条实测无效的 B11 方案 A 改动随重置丢弃（本就该丢）。

## 9. 2026-11-11 20:00–20:55 补做：单轮 dev 实机（B11 / A2 / B16）+ D9 降静态

**授权**：起 dev / 停 dev · 跑单测（全量不启用）· 看板写 · 改文档现值 · 本地提交（不推送）· 派豆包 · 写产物。**「可改码」未启用，全程零源码改动。**

**为什么只有 1 轮**：B11 是启动/开项目的订阅计数、A2 是唯一真章生成、B16 是编辑器内联链路，三者可在同一 dev 进程串行；D9 慢吐若真跑会 `block(rootActionId)` 与 A2 成功章互斥，故降为静态 + 单测。

### 9.1 B11 实机计数探针（方案 B：模块层包装）

- 结论：三时刻（启动后 / 打开项目后 / 外观损坏恢复路径）`window:close-requested` 活跃订阅数**稳定 = 1**，不增长。
- 判定：**A —— 测试夹具缺陷（合成 Workspace 多订），非真泄漏、非 TitleBar 未卸载**。
- 关键排障：`window.aiNovelAPI` 是 frozen + sealed，`api.on` 与整体都不可写；CDP 各 execution context 里 `require`/`ipcRenderer`/`process` 全不可用。可行路径是包装 Vite dev 模块 `src/services/ipc-client.ts` 的 `ipc.on`（普通 `export const` 对象）。
- 产物：[`b11-probe-result.md`](2026-11-11-night-evidence/b11-probe-result.md)，截图为 T1（T2/T3 截图超时跳过，报告已如实标注）。
- 卡 `86418ba9` 已由 Lead 交回并复核结项（`tag --add review` → `review --pass`）。

### 9.2 A2 / D16 状态栏模型指示器 —— **实测抓到一个展示层缺口**

| 项 | 结果 |
|---|---|
| 「本次创作模型」是否生效 | ✅ 生效：`generation_runs.binding_json.sourceManifest.modelReceipt` = `deepseek-flash`（`88cd3187…` = `deepseek-创作`），`status: completed` |
| 默认模型 A 是否被误改 | ✅ 未改（`config.json` 仍 `ab365b78…` = `Ollama/qwen3.5:9b-128k`） |
| 章节生成是否成功 | ✅ 第 2 章 2052 字，工作流「已全部完成」 |
| D16 状态栏是否显示实际调用模型 | ❌ **未显示**：`useActualModelStore.getState().actual === null`，状态栏恒为配置值 A |

**根因（代码链路，非推断）**：`base-command.ts:154` 在带 main handle 时走 `createWorkflowMainGenerationRuntime` → `createMainOwnedGenerationRuntime`；`MainGenerationSnapshot`（`generation-runtime.ts:82-93`）**没有任何模型字段**，而 `recordActualModel` 唯一调用点在 `generation-runtime.ts:409`（`beginModelExecution` 内部，主进程路径不经过）⇒ store 永远为 `null`，状态栏走配置兜底。

**性质**：展示层缺口，数据侧事实源正确，无数据错写。修法最小点是让主进程在首帧快照带出 `modelReceipt`。**未改，待裁。**

产物：[`a2-d16-recheck.md`](2026-11-11-night-evidence/a2-d16-recheck.md)

### 9.3 B16 来源冲突文案 —— **判定「测试写法问题」，并发现实机走的是另一条文案**

实机逐字采集（DOM `outerHTML` 直接取，未改写）：

```html
<div role="status" class="space-y-1">
  <p data-conflict-layer="output">来源已变化：这一稿不能保存，仍可复制。</p>
  <p data-conflict-layer="batch">来源已变化：后续单元不再执行，需重新发起。</p>
</div>
```

- `SourceConflictNotice` 组件路径是**两条独立 `<p>`**，精确 `getByText` 可用。
- 编辑器内联路径 `setAiError(sourceConflictNoticeText(...))`（`CodeMirrorEditor.tsx:695`、`:717`）塞的是**一条拼接串**，精确匹配前半句必失败 ⇒ 这就是 `CodeMirrorEditor-generation.browser.tsx:281 / :335` 的成因。
- **实机新发现**：作者最可能的操作（改正文后点「替换」）命中的是 `:730` 的 **「正文或原目标已变化，结果未应用；你仍可复制预览内容」**，不是「来源已变化」。两条文案语义不同但用户难分辨，列入待裁。
- **第三条文案**（本卡要求单列）：`批次来源已变化，不能继续此批次。请从当前正文发起新任务。` 出自 `AIOutputPanel.tsx:454` 的 `gate.sourceChanged`，与 `source-conflict-copy.ts` 无关。

产物：[`b16-conflict-copy.md`](2026-11-11-night-evidence/b16-conflict-copy.md) + [`b16-conflict.png`](2026-11-11-night-evidence/b16-conflict.png)

### 9.4 D9 降静态（**未实机**，首行已标注）

- 单测真跑：`pnpm test` 两个文件 **12/12 全绿**（`generation-call-timeout` 10 例 + `generation-run-service.call-timeout` 2 例）。
- 静态判读三点：①`DEFAULT_SINGLE_CALL_TIMEOUT_MS = 10 * 60 * 1000` 写死；②`generation-run-service.ts:206` 调 `resolveCallDeadline(budgetRemainingMs)` **没传 `capMs`** ⇒ 生产路径上「可配置 watchdog」只是函数签名上的能力；③超时把 `endReason` 覆盖成 `'cancelled'`，只保留 `failureCode: GENERATION_CALL_TIMEOUT`，下游若按 `endReason` 判定会把超时读成用户取消（**未追消费方**）。
- 产物：[`d9-static-judgement.md`](2026-11-11-night-evidence/d9-static-judgement.md)

### 9.5 收尾线（交给豆包，只出材料与判读）

- 卡 `4993ba9c-4537-4137-bf6e-a9a20a061640`，报告 12,744 B，三张表齐全：表 A 14 张未结算卡逐卡处置、表 B DB-8 11 项过滤后 9 项（2 项已被后续裁定吸收、7 项仍待裁）、表 C 8 张旧卡身份错配核对。
- 豆包自陈未核项 7 条（表 C 6 张卡「依赖路径是否已删」只能记未核、DG 处置口径两种并存等），已原样保留在报告 §四。
- Lead 换身份复核 `pass → Done`（`lead:reviewer`）。**处置动作一律未执行**：无 `move`、无 `done` 别的卡、无改状态行。

### 9.6 数据侧与残留

- 实机前后对比（`project.db`）：第 1 章 `finalized` 1741 字**未变**；仅新增第 2 章 `draft` 2052 字（20:52 保存，含 B16 造冲突后已还原）。
- 备份：`.tmp-ui/d8-backup/1111-project.db`、`1111-partial_arch.json`（仅用于可回滚，本轮未回滚）。
- 外观：B11 T3 造成的 `phase: blocked` 已恢复 `migrated`、`failureCode: null`。
- dev 已停，5180/9222 释放，Electron 进程 0。
- 看板 rev：791 → 804（8 张旧卡摘 `external`、建收尾线卡、复核结项）。

### 9.7 今夜新增待裁（3 条）

1. **D16 主进程路径不投影模型**：是否把 `modelReceipt` 塞进 `MainGenerationSnapshot`；不改则应在设计稿标注「指示器只覆盖渲染层持租约路径」。
2. **B16 两条文案语义重叠**：「正文或原目标已变化」vs「来源已变化」，作者实际更常撞前者，是否统一或加区分。
3. **D9 `capMs` 未接线**：是否把 `readMainGenerationPolicy` 的 cap 接进 `resolveCallDeadline`（改码，需单独点头）。

