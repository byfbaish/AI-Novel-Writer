# 交接 · A2/A3/A4/A5 + 书架收口之后（2026-10-25）

> 状态：**待接手** · 基准：`exp/resource-ledger`，本文件所在提交（`git log -1 --format=%h -- docs/handoffs/2026-10-25-next-steps-handoff.md`）
> 工作区应干净。**唯一未跟踪文件**：`scripts/zz-agent-capability-probe.mjs` —— 2026-10-25 上午的本地模型能力探针（自述「临时实验，可删」），**不要提交、不要删**。
> 上一份交接：[`2026-10-25-a2-a5-shelf-unattended-plan.md`](2026-10-25-a2-a5-shelf-unattended-plan.md)（计划稿 + 本组执行的六处偏离，文末）

---

## 0. 十分钟上手（按顺序读，不要通读 `docs/`）

1. `AGENTS.md`（8 条硬规则）+ `docs/agents/documentation-charter.md`（§6 完成定义）
2. `docs/plans/prompt-assembly-backlog.md` **顶部**「★ 2026-10-25 路线裁决」——那是**现行优先级**（Q1–Q4 已由作者裁定）；再下面「2026-10-23 长篇就绪度重排」只保留**各项状态**，其排序原则已作废
3. 本组实施记录：`docs/research/2026-10-25-oh-story-absorption/assessment.md` §9（A3/A4）与 **§9b**（A2/A5 + 四处被迫偏离 + 迁移自检）

**当前结论一句话**：单卷能用；**跨卷失真、300 章不可行**（`docs/design/architecture/long-form-readiness-review.md`）。排序原则：先能用（改稿）→ 再写对（查阅+宿体）→ 再查错（findings）→ 最后跨部。

---

## 1. 现状一页（别再从代码重新推导）

| 项 | 状态 | 一句话 |
|---|---|---|
| **P0-1 改稿连锁** | ✅ 主干 + ⏸ 残留 | 退回不限链尾、失效显式化（M13）。**残留「卷回滚 / 指定连续回退」已定性**：真身是 ack 的 O(N)，不是批量退回；三个候选 A/B/C 待另一频道裁定（台账 §「P0-1 残留定性」） |
| **P0-2 W7 写前查阅** | 🚧 | 期 1 已落地，**七节齐备**（前文事实 / 关键物品 / 制度 / 知情 / 能力 / 本书规则 / 上一卷交接）；欠 **W7c 真「本章规则子集」**、W7b 卷切片 |
| **P1-1 四格宿体** | ✅ | M14–M17 全部收口，已并入七节 |
| **P1-2 卷级快照** | 🚧 | 期 1/1b/2/2b 已落地（含开写闸门）；**欠期 3「大纲 prompt 前缀投影」，缺自己的设计稿** |
| **P2-1 findings** | 🚧 | 期 1 四类语义档 + **期 2 人物状态转移**（2026-10-25：指针型 + 独立 category「连续性核对（角色状态）」，额度 6→8）；其余三项 §5 明确不做（须先推翻 v2 契约） |
| **A1–A5（外部包吸收）** | ✅/⏸ | A2/A3/A4/A5 全部实施；**A1 降级为平台扩展参考材料**（语料调研已落盘 `research/2026-10-25-threshold-calibration-corpus/`） |
| **书架删除** | ✅ 结案 | 裁定「移除记录就足够」，不开破坏性 IPC |
| **P2-2 / P3** | ⏸ 暂停 | 跨部交接、多图拓扑：**不讨论、不评估** |

**当前 schema v21**（M20 加 `review_findings.review_class`）· **审稿报告 v4**。

---

## 2. 立刻能开工（无待裁定，建议按此顺序）

### N1 · 实机全环节验收（推荐第一件，半天）

**为什么现在做**：本组四项交付**全是单测绿，没有一次真实链路**。而其中两项在生产上"看起来生效、实际可能不触发"：

- **A5 只有 3 个策略点**（`architecture.command.ts:1788` / `:1859`、`structured-syntax-repair.ts:81`）——正文链根本没配 `promptBudget`，所以"接了断言"在正文链上等同于没接。这是设计如此（只保证"配了就强制执行"），但**必须真机确认没有把既有链路搞挂**。
- **A2 的轴恒为 NULL**：模板没改（本轮禁止改 prompt），模型不会产出 `review` 键。UI 徽标、DB 列、报告 v4 都通了，但**只有改 `consistency_check` 模板才会真出值**。

**怎么做**（作者已表达要「开新小说项目做全环节测试」，与这件事是同一件）：新建项目 → 配置 → 架构 → 大纲 → 蓝图 → 正文（≥3 章，含一次续写与一次压缩）→ 审稿 → 定稿 → 退一章再前进。

**验收清单**（逐项要日志/截图，不符就记台账）：

| # | 看什么 | 期望 |
|---|---|---|
| 1 | 正文生成日志 | `已注入写前查阅：前文事实 N 条 / … / 上一卷交接 M 份`（七节都在，`generate-draft.command.ts:1090`） |
| 2 | 退化门禁 | 故意贴一段复读稿 → 报错文案含「复读」；贴「作为 AI 我无法继续」→ 含「占位或拒绝语」 |
| 3 | 照搬门禁 | 把蓝图必需事件原句塞进正文 → 含「照搬细纲」 |
| 4 | 预算断言 | 日志出现 `[GenerationPromptBudget]`（配了策略才打）；未配策略的链路不受影响 |
| 5 | 审稿 UI | 每条 finding 行下**不出现**「机械可改 / 需读上下文」（轴为 NULL 的正确表现） |
| 6 | 定稿链 | 卷末章定稿后 `volume_handoffs` 有初稿；进下一卷第一章触发开写闸门 |
| 7 | 旧项目兼容 | 打开 2026-10 之前的老项目：能开、M20 自动到位、审稿历史仍可读（本轮已用三个真实库副本验证过，真机再确认一次） |

**风险**：这轮会真的写坏/写废项目 —— 用**新项目**，不要用正在写的书。

### N2 · 12.15 剩两项：伤势单调 / 位置可行 —— ✅ **已落地（2026-10-25，P2-1 期 2）**

台账 `12.15` 行已收口。**作者裁定合并为一类「人物状态转移」**，审稿核对基准新增一个**指针型**节
（指回 prompt 开头的【角色状态】，**不重渲染状态字节**），独立 category「连续性核对（角色状态）」，合计额度 6→8。

实施要点（细节见 `design/review/p2-1-continuity-findings-design.md` §7）：

- **数据源**：`frozen.characterStates`（`review-revision-context.ts:132-159` 的 `formatCharacterStateLines`），**不新增 IPC**
- **列名纠正**：`cs_body` 不存在。六槽真实列名 = `cs_location` / `cs_power_level` / `cs_physical_state` / `cs_mental_state` / `cs_key_items` / `cs_recent_events`（`baseline-schema.ts:73-95`）
- **判据边界**：只判「跨章旧值被换掉且正文无转移过程」；**不判**移动耗时 / 距离 / 可达性（本项目无该数据）
- **三条写死的规则**：`@本章` 的基准行不判（重审已定稿章时那是本章自身快照）· 基准陈旧时从严 · 不得判「一炷香走三百里」
- **验收**（实机）：① 第 1 章受伤、第 2 章无治疗却痊愈 ⇒ 出 finding ② 位置从 A 跳到 B 无任何移动描写 ⇒ 出 finding ③ 正常章节不得误报 ④ 重审已定稿章不得拿 `@本章` 的状态行判矛盾

### N3 · W7c 本章规则子集（半期设计 + 半期施工）

现状：`【本书规则】` 是**全书五维摘录**（≤8 条 / 640 字），每章都塞同一批。W7c 要的是"本章用得上那几条"。

- **卡点是数据形状**：规则要能判"适用于哪些章"，就必须有**适用域**（维度？章节区间？人物？）。这一条没有现成答案，属于**要先出设计稿**的小活。
- 设计稿落 `docs/design/architecture/w7-world-state-injection-design.md` §11（已留位）
- **注意**：第 5 维（时间历法）曾"永远排不进前 8 条"，**已于 2026-10-24 用轮转取条修掉**（`{"1":3,"2":3,"4":2}` → `{"1":2,"2":2,"4":2,"5":2}`），别把它当成未修缺陷重开（`p1-1-power-system-shape-proposal.md` §39）

---

## 3. 曾待裁定：D1 / D2 —— ✅ 均已拍定并落地（2026-10-25 晚）

> **本节只作历史记录。** D1 三条已由作者拍定（强提示可取消 / 做显式声明 / **不打通「快照→大纲」回流线**），
> D2 的期 3 已按「**C 双源**」落地（`02ea37a8` 闸门 · `e9edc2e2` 纯函数 · `49b94eb1` 接线 · `d862d8a5` 文档收口）。
> **不要再按本节找作者要裁定**；现状见台账 §「大纲-正文进度守卫」与 `design/architecture/p1-2-volume-handoff-design.md`。

### D1 · 大纲-正文进度守卫（台账 §「大纲-正文进度守卫」）

**已取证的两条硬事实**（不要重新论证）：

1. `architecture.command.ts` **完全不消费 `volume_handoffs`** —— 正文实况回流到大纲层的线**从来没接上**
2. `volume_handoffs` 的唯一生产者是定稿链卷末章 ⇒ 上一卷不定稿就没有快照

**待拍三条**：① 提示还是阻断（倾向"强提示可取消"，与期 2b 共用豁免表）② 是否在生成 prompt 里显式声明"上一卷未定稿，以下只有计划"③ **要不要打通「快照 → 大纲」回流线**（期 3 的前置）

### D2 · P1-2 期 3「大纲 prompt 前缀投影」

**四重卡点，缺一条就动不了**：

1. **没有自己的设计稿**（`p1-2-volume-handoff-design.md` §8 是期 2，期 3 只有计划稿一行预告）
2. `src/shared/outline-prefix-budget.ts:7` 引用的 `§3.3` 在该设计稿里**不存在**
3. **L3 口径未定**：卷纲是**计划**、快照是**实际**，二者不能互相替代（作者 2026-10-25 亲自指出）
4. 设计**没定义「L3 缺失时怎么办」**：退回全量 = 零收益；丢掉前几卷大纲 = 比现在更差

**先要作者回答一句**（✅ **已答**：走 **C 双源** —— L3 有交接单给实际、没有给卷纲摘要并标注「计划」，已落地）：L3 到底取「上一卷正文定稿后的卷末交接单」还是「上一卷大纲摘要」？前者只在"逐卷推进"下可用，后者在大纲先跑完的路径上也可用 —— **这一句决定整份设计稿**。

> 关联：若选前者，D1 的守卫就是它的前置；若选后者，则要新 ADR 推翻 E4d §5.2 已写的口径。

---

## 4. 已判不做 / 暂停（**不要重开，理由都在**）

| 项 | 结论 | 出处 |
|---|---|---|
| 让 `golden_finger` 进材料块 | **判不做**：金手指自由文本已由 P1-1 能力格三态承担；再注入 = 同一件事登记成第二套账，冲突时无仲裁规则 | `handoffs/2026-10-24-p1-1-three-cells-handoff.md` §9 |
| 「本书规则排不到第 5 维」 | **2026-10-24 已修**（轮转取条，两个上限常量没动） | `p1-1-power-system-shape-proposal.md` §39 |
| 书架新增"删非当前项目目录"的 IPC | **判不做**（2026-10-25 作者）：移除记录就够 | 台账 §书架 |
| P2-2 W8 跨部 / P3 多图拓扑 | ⏸ 暂停，不讨论不评估 | 台账顶部表 |
| A1 风格 lint | ⏸ 登记，不动手（阈值需自建语料校准） | 评估稿 §7 + 语料调研稿 |
| P0-1 卷回滚 / 指定连续回退 | 交**另一频道**裁定（A 区间确认 / B 批量退回 / C 不做） | 台账 §「P0-1 残留定性」 |
| P2-1 剩余三项（确定性档 / 时间空间 / 跨章累积清单） | §5 逐条给了"本期不做"理由，**要动先推翻 v2 契约**（~~人物~~ 已由 P2-1 期 2 覆盖） | `design/review/p2-1-continuity-findings-design.md` §5 |

---

## 5. 环境与坑（照做能省半天，都是本轮踩出来的）

1. **`electron/` 全量一次跑不可信**：206 文件并行 → `safe-delete` 阈值 50（栈落 teardown 的 `fs.rmSync`，**不是断言**）+ 10s hook 超时，一轮红 1145 例。摘 `CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR` / `CODEBUDDY_TOOL_CALL_ID` 能降到 104，但**仍不可信**。⇒ **按文件/按目录跑**。
2. **两套 ABI**：`src` 用 `node ./node_modules/vitest/vitest.mjs run …`；`electron` 用 `ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe ./node_modules/vitest/vitest.mjs run …`。跑 `pnpm dev` 前先 `pnpm run rebuild:electron`。
3. **`pnpm` 在 Git Bash 里会挂**（npm shim 的 node 路径损坏）⇒ 用 PowerShell 跑 `pnpm`。
4. **临时 `git worktree` 不能放仓库内**：vitest 的 include 会把它扫进去，测试数翻倍、失败项出现 `.wt-baseline/...`，对照实验直接作废。放仓库外，node_modules 用目录联接。
5. **报红先单文件重跑一次再判**：`project-archive-service` / `project-restore-service` / `user-settings-package-controller` 有 `ENOTEMPTY` teardown flake；`generation-controller` 有 5s 超时 flake；`vector-migration-snapshot` 报 `NONREGULAR`。
6. **既有红（改动前的 `8fb02cde` 上复跑，失败数相同或更多）**：`draft-source-dependency` 4 · `llm-controller-connection` 2 · `m02-project-upgrade` 3 · `main-generation-owner` 1 · `project-peek-readonly` 8 · `legacy-project-copy-import` 3。**不要把它们当成本轮回归**。
7. **升 schema / 报告版本时，硬编码清单**（本轮四处，全在下面）：
   - `electron/migrations/m03-review-cycle.ts`：`verifyM03ReviewCycle` 的期望列形状 + `proveArtifact` 的版本白名单
   - `electron/migrations/desktop-registry.ts`：CURRENT_DESKTOP_SCHEMA_VERSION + schemas(n) 指纹链
   - `electron/services/review-revision-generation.ts`：**第二处** `[2,3]` 白名单（`saved()`）
   - `electron/services/portable-project-field-policy.json`：新列必须进策略，且**细粒度归组**（整表归组会篡改历史 origin 标签）
8. **文档体检**：改完跑 `node scripts/check-doc-links.mjs` + `node scripts/check-doc-placement.mjs`（新增必须为 0；**不许动基线**）。

---

## 6. 接手自检（做完再动代码）

```bash
git rev-parse --abbrev-ref HEAD   # exp/resource-ledger
git status --short                # 只应有 scripts/zz-agent-capability-probe.mjs
node scripts/check-doc-links.mjs  # broken 0
node ./node_modules/vitest/vitest.mjs run src/services/workflows/commands/__tests__/generate-draft.command.test.ts   # 243 全绿
ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe ./node_modules/vitest/vitest.mjs run electron/migrations   # 全绿
```

四项都过 → 按 N1 → N3 走（**N2 已于 2026-10-25 完成**）；D1/D2 已拍定并落地，**不再阻塞**。

> ⚠️ **本节顺序已被 2026-10-25 晚间裁决取代**：作者答完 Q1–Q4 后，台账顶部新增「★ 2026-10-25 路线裁决」——主线改为 **P17 出厂质检（A3 接线 + 形态统计按平台参数化 + 定向重写）→ N1 第 1/2 维问句改硬 → 长线**。上面这份 N 系列仍然都成立，但**不再是第一件**：N3（W7c）属「写对」不属「写好」，不挡路，可当填充。
