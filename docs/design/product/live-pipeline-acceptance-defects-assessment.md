# 实机链路验收缺陷清单（2026-11-01 轮）

> 状态：待裁定（**逐条状态见每个条目顶部的 `> 状态：` 行**；末次刷新 2026-11-06）

> **本轮回三条裁定**：**D17 结项** · **D6 的「方向 A」已于 2026-11-06 撤回并重定义**（卷纲层可弃；取代标注同步撤回）· **D8 = 语义 A** · **新立 D20，定为优先做**。当前分布：✅ 5 条收口（**D6 两层已实施** · D12 只到单测级、D14 · D19 实机通过、D17 已复验结项）· 🟡 4 条代码落地待实机（D1 症状已实机、机制待正文批量；D2 方案乙 + 甲两半；D5 模板去尖括号 + 落库前守卫 `87684f48`；D15 单元区间检出接线）· 🟡 1 条方向已定、代码未动（**D8**）· 🔍 1 条已取证（D7 不成立半句）· ⬜ 9 条方向未定（其中 **D3 / D4 / D13 已于 2026-11-05 定「做」**）
> **2026-11-06 00:49 作者三句**：① D13 T5 选 A（许可改写三条断言）⇒ 已落地 ② D8 裁定 3=Z / 4 随裁定 1 关闭 ⇒ 已同步 ③ D6 两张实施卡开工 ⇒ 已建卡并派发（方案稿 §9.7）。

> **开工顺序（2026-11-05 作者定）**：**D20 最优先** → D6 / D8 → D13。D20 之所以插到最前，是因为它每撞一次都让使用者拿到一条**错误且无法自查**的归因，而 D6 / D8 只是「该做的改动还没做」。

> **2026-11-05 23:06 进度**：D20 本体 + D20b 已实施并合并（`3248b967`），判定侧残留另开 D20c；D13 三条裁定已答（**1=B / 2=A 与 D8 裁定 2 合并答 / 3=A**）、§5.4 跨 IPC 取码已验通，实施卡见看板；D6 / D8 剩余裁定见各自方案稿。**2026-11-06 00:38 补**：D20c / D13 已独立复核通过并分别合并（`72b20beb` / `959a3647`）；D6 方向 A 撤回、按「卷纲层可弃」重定义为 Prompt 层 + 算术层（见方案稿 §9）。
> **2026-11-06 01:00 进度**：D13 的 T5 缺口已按裁定 A 收口（条件放开 + 三条断言同向收紧，单测与 `check-fast` 全绿）；D8 裁定 3 = Z、裁定 4 随裁定 1 关闭，五条裁定全部闭合、代码仍未开工；D6 按 §9.4 开出 Prompt 层 / 算术层两张实施卡（见方案稿 §9.7），复用豆包 D6 审查线程派发。
> **2026-11-06 22:3x 实机 / 数据核对（零生产代码改动，证据全部可复跑）**：① **D2 数据面已好转** —— `running` 已 0 条；112 条 `paused` 全部早于 2026-11-02 13:39（D2 修复在 11-05），修复后产生的 run 一律落在 `cancelled` / `failed` / `completed` ⇒ 「36 条 run 永不终结」在数据面已消失。**UI 面（中断后有没有失败回执）已补验**（22:4x，见下段⑥），结论是「界面合格、机制在本进程首次调用生成通道时生效」。② **D5 存量干净** —— 全库 8 097 个文本字段扫描：`volumes` / `volume_units` 无占位符残留；大纲正文里的 `<…>` 是「定性 / 选择」语义标记（如 `X3：<封喉规则>`），不属 D5。③ **D15 口径弱一档**，见下表该行。④ **D8b 静默复验通过** —— 刷新后的新页面里，卷单元模式下「续批 / 断点续写 / 断点续写大纲」三处全部静默、「AI 生成架构」保留；此前看到的「续批（第 18 章起）」是 21:04 加载的旧页面（静默代码 21:1x 才落盘），**不是回归**。⑤ **D20 实机受阻** —— 改项目级 `plot_structure` 模板后点生成，**上游失效闸门先拦**（预告「情节大纲 5 → 21」、波及 2 章已定稿正文），指纹提示排在闸门之后 ⇒ 要看它得先同意把作者真实项目的大纲版本从 5 推到 21。**未继续，模板与检查点均已逐字复原**。判定代码四支已实读，存量检查点走 `legacy`（放行 + 提示，不逼重来）。
> **2026-11-06 21:5x 状态复核，22:5x 随 D2 转 ✅ 更新数字 —— 本节以上各段均为历史快照，现值以本行为准**。实测分布（**20 条**，按 §2 表格现有图标逐行数）：**✅ 7** = D2 · D6 · D8 · D12 · D14 · D17 · D19；**🟡 7** = D1 · **D3** · D5 · D13 · D15 · D18 · D20；**🔍 1** = D7；**⬜ 5** = D4 · D9 · D10 · D11 · D16。**两处图标与图例（✅ = 已实施且实机复验过）口径不一致，如实标出、本轮不改判定**：① D12 正文自述「单测级，未实机」；② D14 的 B 半条（缺口提醒）仍「待第 10 章之后复验」。上一段「当前分布」把只到单测级的 D12 算进「收口」、把已施工并两轮实机复验的 D8 记成「代码未动」，均以本行为准。**2026-11-06 23:1x**：D3 完成重新定位（旧判「卷界静默降级」一半已被 P1-2 期 1 的 `OutlineProgressGatePanel` 覆盖，残留 = 闸门判据少一维；真库 `volume:1` 已定稿但无交接单，正踩在残留上）。**23:2x 作者裁「甲」并当场落地**：闸门扩成二维、分档文案，两档实机弹窗通过；**23:4x 独立复核打回四条**（超预算单渲染为空、第一档与投影相反、invalid 说「还差 0 章」、第四路读拖垮第一维），已全修并补 `handoff-unusable` 第五值（见 D3 段「复核后补正」）⇒ **D3 由 ⬜ 转 🟡**，分布变为 ✅7 / 🟡7 / 🔍1 / ⬜5。级别仍标「高」，是否降「中」等作者一句话。
> **2026-11-06 22:5x 收口（D20 / D2 两条各自结论）· 本段分布为当时的快照，已被上一行 23:2x 取代**：**D20 按作者选项③结项** —— 不再为验证去动真实项目（那要把大纲从第 5 版推到第 21 版、把 2 章定稿拖进处置清单），改为在设计稿留下「真撞上时怎么定位」的路径（`architecture/d20-checkpoint-template-fingerprint-design.md` §8.3）。**D2 已实机复验通过（转 ✅）**：在项目副本上造真崩溃，界面给了中止文案 + 禁用按钮，旧 run 在**本进程首次调用生成通道**时被判 `aborted`。与设计稿的措辞差一处（稿子写「启动 fence」，实际在 owner 构建时跑），详见 D2 段「2026-11-06 22:4x 实机」。**因此上段分布随之改一位**：**✅ 7**（＋D2）· **🟡 6**（－D2）· 🔍 1 · ⬜ 6，合计仍 20。
> **2026-11-06 02:20 进度**：D6 两卡已独立复核通过（7 文件 484 passed + `check-fast` 全绿），按文件归属分提交 `cb2ede1c` / `57290b20` 合入主线，D6 状态转「已实施」；§9.8 记 4 条遗留，其中「按实际预期推进」措辞疑义已于 02:43 由作者撤回（卷纲层 / 大纲层串层误判，代码不动）。**03:0x**：D8 开工方案经子 Agent 独立审核（8 处行号 6 处漂移，Lead 抽查 8 处全属实）后修订 —— 改点重定位、删除与裁定 4 冲突的改点、验收 1 / 2 按方案稿 §11 四问改为判据判定（**不新增枚举清单 / 对象清单**）；Y2 撤回（不造清单）。**03:20 豆包只读审查 v2 报 5 阻塞 / 2 同批需改，Lead 抽查 9 处全属实 ⇒ v3 按证据更正 7 处**（排除表误判、resume 路径与 `:3500` 不变式、§11.5 论证、文案漏项、中英双语与 browser 断言、基线 commit），见方案稿 §11.7 与交接稿 `docs/handoffs/2026-11-06-d8-preimplementation-handoff.md`。**开工前两条待裁**：C1（§9:256 是否撤回 `:3045` 半句）/ C2（browser 断言与「只准单测」边界）。按手册 §5.4 复核只跑一轮，v3 不再复审。D8 代码仍未开工。

> 日期：2026-11-01
> 上级稿：[`live-verification-checklist.md`](live-verification-checklist.md)（一次新项目跑批要验什么）
> 相关：[`e3-unit-batch-chain-design.md`](../architecture/e3-unit-batch-chain-design.md)（连续单元 / 链式新 run）、[`upstream-version-and-derived-invalidation-design.md`](../architecture/upstream-version-and-derived-invalidation-design.md)（上游失效）、[`volume-quota-context-budget-design.md`](../architecture/volume-quota-context-budget-design.md)（大纲前缀投影 L3 层）
> 本文只记录事实与机制，不判定责任、不含修复代码。

## 0. 结论一句话

**这一轮验收的阻塞点不是「生成质量不够」，而是「生成停了，界面说它还在跑」。** 批次内第二次模型调用即被上游指纹判成 `GENERATION_SOURCE_CHANGED` 而中止（D1），而中止后既没有失败回执、也没有终态落库（D2），两者叠加的结果是：**用户在界面上无法区分「在跑」和「已死」**。

第二轮（推第二卷）补上后半句：**打通正文链之后，暴露出的是「跨卷三件套全靠手动」**（D14）。卷结构、卷完成标记、卷末交接三项，系统一处都不自动触发、一处都不提示，因此 `l3-handoff-missing` 不是某次失败留下的疤痕，而是**任何没去手动点过的项目都必然处于的状态**。D3（提示太弱）与 D14（状态从没建立）是同一件事的两端。

**当前实际可达的上限**：正文已跑到第 9 章（第 1 卷 6 章 + 第 2 卷 3 章全部 `finalized`），用的模型是 `deepseek-均衡`。

## 1. 验收条件与实测口径

| 项 | 值 | 来源 |
|---|---|---|
| 生成器 | 本地 Ollama `qwen3.5:9b-128k` | 验收现场 |
| 操作方式 | agent 在真实 Electron 界面模拟人操作 | 验收现场 |
| 链路 | 故事架构 → 章节蓝图 → 正文 → 定稿 | 验收现场 |
| 总章数 / 每章字数 | 30 / 1500 | `project_core.total_chapters` / `words_per_chapter` |
| 验收目标 | 只验形态与结构，不验正文质量 | 本轮约定 |

数据快照：项目数据目录 `师父派我来除魔，幕后真凶竟是小师妹/.ai-novel/`；本文所有库内数字为**只读**查询结果（`mode=ro`）。

库内现状的**两个时点**（变化本身是本轮最重要的证据）：

| 表 | 2026-11-01 第一轮结束时 | 2026-11-02 第二轮结束时 |
|---|---|---|
| `drafts` | 0 条 | **9 条**（全部 `finalized`，1319–1578 字） |
| `blueprints` | 0 条 | 9 条 |
| `volumes` | 0 条 | 6 条（**手动点「重建卷结构」后才有**） |
| `volume_units` | 0 条 | 18 条（同上） |
| `volume_handoffs` | 0 条 | **0 条**（始终未登记） |
| `generation_runs` 中 `running` | 多数 | **36 条**（定稿完成后仍未终结） |

## 2. 缺陷清单（按严重度排序）

| 编号 | 级别 | 状态 | 一句话 | 证据位置 |
|---|---|---|---|---|
| D1 | 阻塞 | 🟡 已实施（部分复验） | 批内多单元/多章生成时第二次调用即抛 `GENERATION_SOURCE_CHANGED`，整批静默中止。**2026-11-02**：连写 2 单元已实机跑通（12 → 15 章）；机制层补 8 条单测，同 run 多调用路径（正文批量）仍未复验 | `electron/services/main-generation-owner.ts:931`；`electron/services/agent-generation.ts:158/190/196`；`src/services/agent/agent-generation-client.ts:33` |
| D12 | 阻塞 | ✅ 已实施（2026-11-04 · 单测级，未实机） | 正文重演被丢弃且无重试、无回流。**真因是短细纲把上一章全文当成本章任务**，不是校验过严（见「第二轮实测」）。修法 = R6 短细纲砍全文（要点 + 结尾 ≤300 字）+ 判据改结构化对应，`ba3d4bc5` | `generate-draft.command.ts:1536`（拦截）；`chapter-materials.ts`（`previousChapterEnding(content, maxChars)`）；`draft-short-outline.ts`（`draftShortOutlinePredecessor`）；合并稿 `previous-chapter-context-assessment.md` §8/§9 |
| D2 | 高 | ✅ **已实施并实机复验通过**（方案乙 + 甲；`68a37585`；2026-11-06 22:4x 在**项目副本**上造真崩溃跑通一遍）。中止文案 + 禁用按钮合格；崩溃遗留的 run 在**本进程首次调用生成通道**时被判 `aborted`。**与设计稿措辞不符一处**：稿子写「启动 fence」，实际在 owner 构建时（本进程第一次调用任一 `generation:*`，含只读的 `generation:list`）跑。**已知残留**：崩溃后若再也不调任何 gen 通道，库里那条 run 会一直是 `running`；但会读库的面板一挂载就先建 owner、当场判 `aborted`，所以界面不会出现「假继续」，只是「库里说得准不准」 | 批次中断在 UI 上完全静默：无失败回执，进度条「假继续」。乙 = 收口统一 seal；甲 = 执行租约 + 启动 fence 判 `aborted`（`68a37585`），`aborted` 现为不可续终态 | `generation_runs` 36 条无终态、`blocked_code` 为 NULL；`generation_attempts` 却为 `settled`；设计稿 `features/d2-run-lease-abort-design.md` §10；**实机与触发点见本文 D2 段「2026-11-06 22:4x 实机」** |
| D13 | 高 | 🟡 已实施（2026-11-06 · **1=B / 2=A（与 D8 裁定 2 合并答）/ 3=A**；§5.4 跨 IPC 取码已验通；实施已合并 `959a3647`，T5 缺口于 2026-11-06 按裁定 A 补齐（`3f954431`，条件放开 + 三条断言同向收紧）；**未实机**） | 同一章三次失败分别挂在三个不同层，失败原因互不相关且都无恢复路径。**实读后定性修正**：不是三个 bug，是**一条链上没有失败契约**——正文层 10 处抛点 + 主进程 4 处 + 组装层 4 处、共约 8 个码，且码全在 message 里不带 `code` 字段 | 短细纲层 / 重演层 / `GENERATION_COMPOSITION_NO_PROGRESS`；方案稿 [`architecture/d13-chapter-failure-contract-design.md`](../architecture/d13-chapter-failure-contract-design.md) |
| D14 | 高 | ✅ 已实施（已复验） | 卷结构三步（建卷结构 / 标卷完成 / 登记交接）全手动，生成流程从不调用、系统从不提示 → `l3-handoff-missing` 必然。**2026-11-02 已修**：建结构 + 推进进度改为自动（A 已实机复验，含历史回填），缺口提醒（B）沿用既有闸门、待第 10 章之后复验 | `VolumeHandoffRegistryPanel.tsx:269/293`（原全库唯一调用点）；`volumes` / `volume_units` / `volume_handoffs` 三表初始 0 行；`volumes.actual_last` 定稿后仍全 `null` |
| D3 | 高 | 🟡 **已实施（2026-11-06 23:2x 甲方案 → 23:4x 复核后补正；两档实机弹窗验过，「确认继续」后的真生成未跑，见 D3 段）** | `degraded=l3-handoff-missing` 提示过弱且不阻断（**根因见 D14**）。**已核实**：卷界已有 `OutlineProgressGatePanel`（2026-10-25，一卷一次 + 两个出口 + 可撤销确认），但它只判「上一卷正文未定稿」。**2026-11-06 扩成二维**：上一卷已定稿却**没登记交接单**、或**交接单过期被静默丢弃**，这两种同样走 `plan` 的降级现在各成一档，卷首会说清「本卷只能用卷纲计划」并给出对应出口 | `src/shared/synopsis-projection.ts:520`（push）、`:504–522`（`actual`/`plan` 回退）；`src/shared/outline-progress-gate.ts`（`handoff` 维度 + `reason` 三档）；`src/services/outline-progress-gate.ts`（`handoffAvailabilityOf` 与 `outline-prefix-context.ts:70` 同口径）；`OutlineProgressGatePanel.tsx`（三档文案） |
| D19 | 高 | ✅ 已实施（已复验） | `actual_last` 被当成卷末 ⇒ 卷边界随进度漂移，开写闸门提前一章弹、交接单漏本卷最后一章 | `src/shared/volume-structure.ts:285`（末章取 `actual_last ?? planned_last`）；`src/shared/volume-handoff-gate.ts:63`（闸门判上一卷）；`finalization-controller.ts:65`（推进在 finalize 之后） |
| **D20** | **高** | 🟡 **已实施（2026-11-05 · 本体已合并 `eef01325`）**；**D20b（§4.6 收窄）已实施并合并（`115ff490`→`3248b967`）**；**D20c 判定侧收口已实施并合并（`4b510d2a` → `72b20beb`）**（见方案稿 §4.7）；**实机验证：作者 2026-11-06 裁「选项③」不验**（要推大纲 5→21 版、拖 2 章定稿进处置清单），改为方案稿 §8.3 留「真撞上时怎么定位」的路径 + 现场采集清单 | **生成模板一变，旧大纲检查点就续不上，而报错断言「项目源事实已变化」**——指纹是 4 元的（源事实 / 步骤指导 / 批次范围 / **模板**），比对时只剩一个布尔值，文案却只认第 1 元。**读码证明只有「源事实 / 模板」两项可能漂移**（②③ 是拿检查点自己的值重算自己）。换数据根 / 换机器 / 改模板都会撞上，使用者无从查起。**指纹让「改内置模板」变成高风险操作**，两次输出合同变更因此只能走渲染期替换（红线 19 由此而来）。裁定 3 = **世界观链不改** | `architecture.command.ts:1124-1150`（指纹含 `JSON.stringify(template)`）· `:3135` `:3242`（两处报错文案）· **对照 `:2334` 点了模板（但只列 3 项）**；现场：D17 §7.4 第 1 条（`stored=13sbmpn / expected=tkj9w7`，12 个源事实字段 sha256 全一致）；方案稿 [`architecture/d20-checkpoint-template-fingerprint-design.md`](../architecture/d20-checkpoint-template-fingerprint-design.md)（**经独立复核打回后修订**，见其 §11）；**卡 `216dcf5b`** |
| D4 | 中 | ⬜ 待裁定 | UI 散落「来源已变化」文案，但没有任何地方把它和批次中止关联 | `src/components/panels/AIOutputPanel.tsx:398` |
| D5 | 中 | 🟡 已实施（2026-11-05，待实机） | 卷/单元结构输出里模板尖括号占位符原样保留 | `debug/prompt-trace/20261101-213138-718-弧光-d57a1d5d.json` → `ioCalls[0].output` |
| D6 | 中 | ✅ 已实施（2026-11-06 · **方向 A 与裁定 6 已撤回**，重定义为 Prompt 层 + 算术层；两卡复核通过并合并 `cb2ede1c` / `57290b20`，见 §9.8） | **卷纲层可弃**：5 卷 / 7 卷皆模型按背景材料的合理划分、重生成代价极小，卷数不进任何判据。**唯一目标 = 在该划分下完成预定字数**（每章字数由续写/重写保障 × 总章数由反馈收敛保障）。病因是 Prompt 的 `:743` / `:847` 把已知量挡在决策外（「信息在场、许可缺席」），不是「卷数没有事实源」 | 同上 trace 的 `【节奏推荐】` 与「输出前自检」第 2 条；方案稿 [`architecture/d6-volume-count-source-design.md`](../architecture/d6-volume-count-source-design.md) **§9（§0/§4/§7/§8 已被 §9 取代）** |
| D7 | 中 | 🔍 已取证（2026-11-03）：「不符」**不成立**（两侧同一 `computeSynopsisUnitRange`，仅显示精度差）；「偏保守」成立且属模型行为 | 单元 → 章折算偏保守，且与对话框预告不符 | 对话框 `synopsis-unit-launch.ts:298` · 生成 `architecture.command.ts:2948` · prompt 精度 `arc-position.ts:960`；`partial_arch.json` 的 `synopsis_volume_deviations` |
| D8 | 中 | ✅ 已实施（2026-11-06 · 第八轮补正后直接施工，单测 2203/2203、browser 54/54 —— 21:0x 轮次为 **113/113**，两档是不同批次不是矛盾 —— `check-fast` 全绿。**实机两轮不是同一结论**：19:5x 首轮**部分通过并暴露三项阻塞** ⇒ 作者 20:5x 四条订正 ⇒ 修复后 21:0x **复验通过** · `c37a268f` 起、末次 `0209753e`。**未单独实机覆盖**：§12.9 单元连选只丢最后残缺单元） | **候选区残本阻塞大纲生成**：卷/单元路线每次点「生成 / 执行」**无条件清候选区**、上游级联清空时界面连坐清；清场只作废残本、不碰进度 / 游标 / 偏差账 / DB 正文、不复用 `resetSynopsisCheckpoint`。按生成路线分流（配置二选一走到底、禁止模式交替）、旧模式语义不改、反馈收敛链零改动、**不新增 / 删除按钮**；单元连选只丢最后残缺单元（§12.9）。v1–v3 与 C1 / C2 / 05:20 两条提请裁定作废，原文保留 | 方案稿 [`architecture/d8-checkpoint-degradation-design.md`](../architecture/d8-checkpoint-degradation-design.md) §12（§12.1.1 问题定义 / §12.7 清场 / §12.8 取证 / §12.9 连选） |
| D15 | 中 | 🟡 已实施（2026-11-05）。**2026-11-06 22:2x 现场核对，口径比原表述弱一档**：实现是「**检出告警、不夹紧、不阻断**」，不是「落库前校验拦下」—— `src/shared/volume-structure.ts:165-175` 逐字写了为什么不夹紧（重叠多是 `headings` 档，夹紧等于拿估算改事实）、为什么不阻断（作者库本就处于重叠状态，阻断会让「重新解析」直接不可用）。**实测本库 `volume:2` 仍是 7–9 / 8–9，存量不修**；告警格式 `VOLUME_UNIT_OVERLAP:<卷>:<单元>-<单元>:<章>`。UI 是否消费这条告警未验 | 第 2 卷单元区间重叠（7–9 / 8–9 / 10–10），第 8、9 章归属不唯一 | `volume_units` 落库后读出的 `planned_first` / `planned_last` |
| D9 | 低 | ⬜ 待裁定 | 单章大纲调用可能长时间不返回，无超时/无中断 | `debug/prompt-trace/20261101-215546-106-大纲-ch10-b79a98f3.json`（`ioCalls` 为空） |
| D10 | 低 | ⬜ 待裁定 | 「清空生成内容」未清掉历史审稿/生成记录面板 | 库内计数为 0 vs 界面卡片残留 |
| D11 | 低 | ⬜ 待裁定 | 生成完成后「补角色卡」提示按批重复堆积 | `src/services/architecture-character-nudge.ts:112`（指纹函数）、`:130–137`（判定） |
| D16 | 低 | ⬜ 待裁定 | 模型指示器与实际调用不一致：日志确认调 `deepseek-v4.1-flash-free`，状态栏显示 `deepseek-均衡` | 主进程 stderr `model:` 字段 vs 界面底部状态栏 |
| D17 | 中 | ✅ **已结项（2026-11-05）** | 生成路径提交大纲**不记覆盖章区间**（`changedChapters` 恒为空集）⇒ 判定退化为「整本大纲都改了」⇒ 每追加一批大纲就把此前所有已定稿章/蓝图/交接单拖进失效清单。**预演与实测一致，机制本身是成功的（作者 2026-11-02 认定）**，缺的是输入的章集。**已实机复验**：rev21 记 `[18,19]`、同步页 7 项 → 3 项、13 张蓝图全 valid；复验时撞出的另一个问题已单列为 D20 | `electron/repositories/project-core-repository.ts`（`commitSynopsis` 的 `changedChapters` 分支）vs `src/shared/upstream-revisions.ts:651`（空集 ⇒ `null` ⇒ 按全改算）；方案稿 [`architecture/d17-outline-change-range-design.md`](../architecture/d17-outline-change-range-design.md) §7.4 · §10 |
| D18 | 中 | 🟡 已实施（2026-11-04 · 合同文案进模板 zh/en 与两级副本、解析器、六个校验纯函数已接线：C1/C1b/C2/C4 进单元批、C3/C5 进正文落盘与定稿，只报不拦；**C1 重跑权限未开放**，作者 2026-11-05 裁定继续只报，见设计稿 §11.15） | 蓝图结尾钩子可**无校验地**偏离大纲「收尾：」行：模板两条条款互斥（「必须落在收尾行」vs「不得是事件」）+ 钩子可自造设定 + 正文未兑现无告警。第 6 章 `suspense_hook` 写成结论句，正文里 `寿元` / `因果纹` 各 **0** 次 | `builtin-prompt-templates.ts:1165`（条款互斥）、`src/shared/blueprint-semantic-contract.ts`（「威胁/后果」给它授权）、`generate-draft.command.ts`（`withSuspenseHook` 注入）；**排除审查/改写**：`generation_artifacts` rowid 117（run `fd6f4edc`）与 `blueprint_commit_operations` `directory-f348fe27-…-1-6` 逐字一致 |

共 **20 条**（原写 19，2026-11-06 复核时按 §2 表格行数订正）：阻塞 2（D1 / D12）· 高 6（D2 / D13 / D14 / D3 / D19 / D20）· 中 8（D4 / D5 / D6 / D7 / D8 / D15 / D17 / D18）· 低 4（D9 / D10 / D11 / D16），合计 20，合计对得上。**两条阻塞都还没有真正验收** —— D1 代码已改但没跑过真实多章批次；D12 已修（`ba3d4bc5`，短细纲砍全文 + 判据改结构化对应）但**只到单测级、未实机**（此处原写「连修法都还没定」，已过时）。

> **状态列怎么读**：取值沿用 [`documentation-charter.md`](../../agents/documentation-charter.md) §5.2 的受控词表，
> 条目上**不另造词表**；图标只是同一套值的快读形式 ——
> ✅ = 已实施且实机复验过 · 🟡 = 已实施，但验证还不完整（只有单测，或只复验了症状没复验机制）· ⬜ = 待裁定（未开工）。
> 每条正文顶部有对应的 `> 状态：` 行，括号里写**验证到什么程度 + 提交号**；
> 两处若冲突，以正文那行为准（表格是索引，正文是记录）。

---

## D1（阻塞）批内多单元/多章生成时，第二次调用即抛 GENERATION_SOURCE_CHANGED，整批静默中止

> 状态：已实施（2026-11-02 · 症状已实机复验 + 补 8 条单测；同 run 多调用路径未复验 · `b19f159b`）

### 现象

情节大纲选择「按单元连写 3 个单元」时，只产出 3 章就停；此后每一批都只出 2–3 章就停。三次复现规律一致。

### 证据

- Electron 主进程 stderr（`pnpm dev` 终端）：`Error occurred in handler for 'generation:execute': Error: GENERATION_SOURCE_CHANGED`，共出现两次。
- 四次批次的实际产出（按 `debug/prompt-trace/` 每次调用一条 trace 计）：

  | trace 文件 | run_id | 本批实际章 | 章号 |
  |---|---|---|---|
  | `20261101-213731-620-大纲-ch1-2-2d60f259.json` | `2d60f259…` | 3 | 第 1–3 章（第 1 卷第 1 单元） |
  | `20261101-213857-623-大纲-ch4-ce80d97d.json` | `ce80d97d…` | 1 | 第 4 章（第 1 卷第 2 单元第 1 章） |
  | `20261101-214044-621-大纲-ch5-8e48c534.json` | `8e48c534…` | 2 | 第 5–6 章（第 1 卷第 3 单元） |
  | `20261101-214804-420-大纲-ch7-8-e11a7ec4.json` | `e11a7ec4…` | 3 | 第 7–9 章（第 2 卷第 1 单元） |

  四批合计 9 章，`partial_arch.json` 的 `synopsis_covered_to` 正是 `9`。请求是「连写 3 个单元」，第一批只落 3 章（= 1 个单元），后三批同理。

### 代码位置

- `electron/services/main-generation-owner.ts:931` —— `sourceStatus: current ? 'current' : 'conflict'`，`current` 由 `compareGenerationSourceBindings(run.binding, deps.rebuildBinding(...))` 现算。
- `electron/services/agent-generation.ts:158`（`resume`）、`:190`、`:196`（`executeRound` 两处分支）—— 三处都是 `if (recovery.sourceStatus !== 'current') throw new Error('GENERATION_SOURCE_CHANGED')`。
- `src/services/agent/agent-generation-client.ts:33` —— `assertActive()` 里的同一判定，在渲染进程侧再抛一次。

### 推断机制

run 在 `begin` 时把上游 `sourceRef` 指纹绑进 `binding`；批次内**第一个单元写库之后**，上游（情节大纲本身）内容发生了变化。第二个单元开始执行时重新 `rebuildBinding` 比对，指纹不一致 ⇒ 判 `conflict` ⇒ 抛错。即：**生成把自己刚写出的内容算成了「上游变更」**。这一点与 `upstream-version-and-derived-invalidation-design.md` 的设计前提直接冲突——该设计假定「上游变化来自作者或另一条链」，而这里的变化来自同一条链的上一段。

### 影响

- 多批生成实际退化为「一批只能出一两个单元」。作者设 30 章，四批只到 9 章。
- 失败无重试、无断点续跑：批内剩余单元直接丢弃，`synopsis_incomplete` 留在检查点上，只能等下一次人工点「续批」。
- 这条缺陷使「按单元连写」这个功能在当前形态下不可用——它不是慢，是不完整。

### 建议修复方向

方向（不指定实现）：让「本批自己写入的产物」不参与来源指纹比对。可选思路有三类——① 指纹只覆盖批次开始时的**只读上游**（前提/世界观/角色/弧光），把本链产出的情节大纲排除在外；② 批次内每个单元重新 `begin` 新 run、各自绑定当时的上游（即把「一批」在语义上拆成「一串单单元 run」）；③ 判定为 `conflict` 时区分「本链自写」与「外部改动」两种来源，前者降级为继续、后者才中止。三条都需要先回答同一个问题：**同一条链上「我写的」和「别人写的」如何区分**，这可能需要 `sourceRef` 带上写入者标识。

### 处置（2026-11-02）：走了 ② + ③ 各一半，症状已实机消失，机制层补了单测

**② 已经落地了，而且不是我这次加的**：E3 T12 的「连写」是**链式新 run**——每写完一个单元就
`launchCreativeWorkflow` 起一个新 run（`App.tsx:425` 的 `advance(receipt.runId)`），新 run 的绑定
按**当时**的上游重建。所以「同一 run 内第二次调用」在情节大纲这条路上已经不存在，
②这条路把 D1 从「语义上会撞」变成「结构上撞不到」。

**③ 的一半由 `b19f159b` 落地**：`GenerationRunRepository.advanceBinding`（CAS）+ `main-generation-owner`
在**本次调用成功之后**推进绑定基线（`!receipt.failureCode && !receipt.unsavedTail` 才推）。它保护的是
**一批里仍会发多次调用**的路径——正文批量（一章至少两次：短细纲 + 正文）、蓝图批量。

**实机复验（2026-11-02 21:36–21:44，本项目：第 10 章已定稿、大纲覆盖到 12）**

| 时点 | 动作 | 读数 |
|---|---|---|
| 21:36 | 故事架构 → 情节大纲「续批（第 13 章起）」→ 单元模式，起点 = 第3卷第2单元第1章（全书第13章），本卷还剩 2 单元 ⇒ **连写 2 个单元** | 对话框预告「本卷剩余 3 章，名义上界 2 章」 |
| 21:36 | 上游失效预演（P2-3 期 3a） | 列 3 项：蓝图 11–12、第 2 卷交接单；勾选承认后继续 |
| 21:36:38 | 第 1 个单元 run `0030f404` 起 | 21:39 前落库 |
| 21:39:53 | 第 2 个单元 run `290d435b` 起（链式新 run，**不是**同一 run 的第二次调用） | 21:42 前落库 |
| 21:44 | 读检查点 | `synopsis_covered_to` **12 → 15**、`synopsis_incomplete` = **false**、游标走到 `{volumeIndex:4, unitIndex:1, writtenInVolume:0}`；trace 新增 `-大纲-ch13`…`-ch15` |

**结论要说清边界**：这一次验的是**用户可见症状**——「点一次连写 N 个单元，不会写到一半静默停住」。
它**没有**覆盖 `advanceBinding` 想防的场景，因为今天两次模型调用落在两个 run 里。
同 run 多调用那条路径是**正文批量**，今天没跑到，卡在两道具设计意义的闸上（不是能顺手点掉的）：
第 11 章是第 3 卷首章、撞着卷交接闸（第 2 卷交接单 `stale`）；第 11–12 章蓝图因这次大纲推进
（`outline` rev 10 → 11）转 stale。**这两道都要作者处置，不该由验收脚本代点。**

**补的单测（原本零覆盖）**：`electron/repositories/__tests__/generation-run-advance-binding.test.ts` 8 条——
推进后绑定换成「执行之后」那份 / 只改绑定不动 run 状态 / `$runEffects` 原样保留且不进 `get()` 的 binding /
无副作用记录时不凭空造字段 / 连续推进以**库内当前绑定**为基线 / run 不存在抛 `GENERATION_RUN_MISSING` /
同值推进幂等 / `sourceRefs` 随推进一起换。`tsc` 与 `eslint --max-warnings 0` 干净。

> **没覆盖的那条分支写在测试注释里**：`GENERATION_BINDING_ADVANCE_CONFLICT` 是「SELECT 之后、UPDATE 之前
> 被别人改过」才走的防御分支。better-sqlite3 同步执行，两个语句之间没有可插入的窗口 ⇒ 单测造不出来；
> 要造只能把 db 层打桩，那测的是桩不是仓储。

---

## D2（高）批次中断在 UI 上完全静默：无失败回执，进度条「假继续」

> 状态：✅ 已实施并实机复验通过（2026-11-02 · 方案乙「主进程批次收口统一 seal」；落成**两级**：Tier 1 写 run 终态、Tier 2 才封 root。单测 12 条 + 控制器 3 条 + 渲染层 4 条；**2026-11-06 22:4x 造真崩溃复验**：中止文案与禁用按钮合格，旧 run 在「本进程首次调用生成通道」时被判 `aborted` —— 详见文末「2026-11-06 22:4x 实机」）

### 现象

批次已死，任务面板仍显示「情节大纲 0/1」与「Ollama/qwen3.5:9b-128k」，用户看到的是「还在跑」；此时模型实际上已卸载（Ollama `/api/ps` 为空）。

### 证据

- `generation_runs` 表：验收当场所见多条记录 `status` 恒为 `running`，从未 finalize。
- 本次离线复核（dev 进程已重启）读到的同一批记录为 `paused`，`generation_roots.blocked_code` 为 **NULL**（没有任何失败码）：

  | run_id | `generation_runs.status` | `generation_attempts.attempt_json.status` |
  |---|---|---|
  | `2d60f259-03d2-4543-ac49-848c6101d054` | paused | settled |
  | `ce80d97d-5e26-4a71-b18a-22f5c823eee5` | paused | settled |
  | `8e48c534-6d70-46a2-9f7a-5373dfc7792a` | paused | settled |
  | `e11a7ec4-732f-49d9-8bd2-346eeb22b37c` | paused | settled |
  | `b79a98f3-89e7-4fab-a042-d206b13b5a2d` | paused | unknown |

- **`running` → `paused` 不是这批 run 自己走到的终态**：`electron/repositories/generation-run-repository.ts:680` 的 `recoverInterrupted()` 在启动时对每个非冻结 root 逐个调 `pause(id)`（`:651`），`pause` 在 `:659` 把 `generation_runs.status` 写成 `paused`。也就是说：**只有进程重启才会把这个状态改掉**；run 自身从未 finalize，`blocked_code` 全程为空，因此「失败」在两处都没有留下痕迹。
- 与此同时 `generation_attempts.attempt_json.status` 是 `settled`——模型调用本身成功返回了。即：**模型调用成功、批次失败、run 无终态**，三者同时成立。
- 上表最后一行 `b79a98f3` 的 attempt 是 `unknown`（见 D9：调用发出后 12 分钟未返回）。

#### 2026-11-02 21:39–21:46 追加：**成功路径上同样不留终态**

跑 D1 复验（情节大纲连写 2 单元）时顺手取到的旁证——这次批次是**成功**的，run 一样没有终态：

| 时点 | `generation_runs` | `generation_attempts` | 检查点 |
|---|---|---|---|
| 21:39:46 | `0030f404`（第 1 单元）running | settled | `covered_to` 14、`incomplete` false |
| 21:39:55 | `290d435b`（第 2 单元）running | dispatch-marked | `incomplete` true（起批标记） |
| 21:41:26 | 同一个 run，仍 running | settled | `covered_to` **15**、`incomplete` **false**、游标进第 4 卷 |
| 21:46:23（+5 分钟） | **两个 run 仍 running，`blocked_code` 全程 NULL** | settled | 无变化 |

也就是说：这条缺陷不只是「失败没留痕」。**批次成功跑完、内容已落库，run 也不会走到终态**——
`running` 只在进程重启时被 `recoverInterrupted()` 改写成 `paused`。所以「这个 run 结束了没有」
这个问题，在库里根本没有答案；UI 只能靠内存里的运行列表判断，重启即失忆。

这同时解释了为什么「假继续」修起来比想象中难：不是某条分支忘了写终态，而是**没有任何一条路径
负责写终态**。修法方向不变（D2 的三条要点），但要先决定「终态由谁写」——是调用方在收尾时 seal，
还是主进程在批次收口时统一 seal。

### 代码位置

- `electron/repositories/generation-run-repository.ts:651`（`pause`）、`:659`（写 `paused`）、`:680`（`recoverInterrupted`）。
- `electron/services/main-generation-owner.ts:931–969`（四处 `sourceStatus` 现算，均只在被读时计算，不落库）。
- `electron/services/agent-generation.ts:158/190/196`（抛错点，抛完不做状态落库）。

### 影响

这是「项目卡在验收环节」的直接表现。人看着有进度，其实早已停摆，且无从得知原因——因为**原因（`GENERATION_SOURCE_CHANGED`）只存在于主进程 stderr，不进入任何持久化状态**。

### 与 D1 叠加（本轮最重要的结论）

D1 让批次必然死，D2 让「死了」看不出来。两者叠加后的可观测结果是：

> **界面上「在跑」与「已死」没有可区分的形态。** 任务面板的进度文字、模型名、进度条在中止后与中止前一模一样；唯一的差别是模型侧已经卸载，而这一点只有去查 Ollama `/api/ps` 才知道。

这不是「提示不够醒目」，而是**状态机缺少一个「已中止」的状态**：目前只有 running / paused / cancelled / sealed，`paused` 由启动恢复写入、语义是「进程没了」，不承载「这一批因为 X 失败」。

### 建议修复方向

方向：给批次一个**可落库的失败终态**，并让 UI 读它。要点三条——① 抛错时同步写 `blocked_code` / 失败原因（现在的 `block()` 只在特定路径被调），使失败在库里可见；② 区分「进程重启导致的暂停」与「业务失败导致的中止」，两者不能共用一个 `paused`；③ 失败回执要能指回具体是哪一步、哪个单元、什么原因，而不是只给一个错误码。

### 处置：方案乙（已实施，2026-11-02）

**选它不选甲的理由**：甲（调用方各自 seal）改动最小，但「跑完了要不要 seal」就变成每个调用方的自觉——本缺陷的成因正是「没有任何一条路径负责写终态」，甲只是把「没有路径」换成「十个地方都可能漏」。

**否决丙的理由**（作者 2026-11-02 判断）：丙 = 甲 + 主进程兜底，两套写入点要做幂等、要处理「先 seal 后兜底」的时序，而乙已经把写入点收敛到一处，兜底那一层没有独立价值。

#### 落地形态（比计划简化了一处，收紧了一处）

原计划担心「主进程不知道这批涉及哪些 `rootActionId`，得从渲染侧传一个列表」。实施时查清：**同批所有 run 共享同一个 root**，而 `MainGenerationRunHandle` 本身就带 `rootActionId` ⇒ 不需要列表，通道就叫 `generation:seal`（不叫 `seal-batch`），请求体 `{ handle, outcome, code? }`。

| 级 | 做什么 | 条件 |
|---|---|---|
| **Tier 1（永远做）** | 把该 root 下 `running` / `paused` 的 run 写成 `completed` / `failed` | root 不是 `cancelled` / `sealed`；`WHERE status IN ('running','paused')` |
| **Tier 2（谨慎）** | `generation_roots.status = 'sealed'` | `structurallySealable()` 全真 **且** owner 层证明确实写完了 |

Tier 1 单独成立，就是本缺陷的主症状被修好的那一半：**run 不再依赖进程重启才有终态**。

**写入点只有一个**：`src/stores/workflow-store.ts` 里 `activeRuns → history` 之前那一段。上方所有终态分支（步骤失败 / 取消 / 会话失效 / 正常完成）都在那里汇合，是唯一能同时看到 completed 与 failed 的地方。散回各调用方等于把「有没有写终态」重新变成自觉。

#### root 生命周期：为什么 Tier 2 默认 fail-open（唯一反直觉点）

`root` **不是「一次点击一个」**。以下 5 条路径会让它跨多次点击复用，`open({ parentRootActionId })` 又要求 root 必须是 `active`：

1. 同 workflow 多阶段（`workflow-main-generation.ts:98/107/114`）
2. 目录「继续第 N–M 章（沿用原预算）」（`directory-workflow.ts:69-83`）
3. 批次恢复（`draft-recovery-workflow.ts:82-90`）
4. **审稿 → 修稿**（`review-revision-generation.ts:161`）
5. 同章定稿 / agent 轮次（`agent-generation.ts:164/321/392`）

⇒ **「run 收尾就把 root seal 掉」会让作者点「继续」直接撞 `GENERATION_PARENT_INVALID`，比停在 `running` 更糟。** 所以首版只对两类 operation 开放封口，其余一律不封：

- `batch-chapters` 且 `draftEffects.readBatch(batchId).nextChapterNumber === null`；
- `chapter-blueprint-directory` 且该 root 的 `remainingRange === null`。

**与计划的一处偏差**：计划里写「批次声明 completed 但进度未完 → 抛 `GENERATION_SEAL_CONFLICT`」，实现时**去掉了**。原因是 `auto_finalize` 模式会在「正文写完但还没定稿」时留下非 null 的 `nextChapterNumber`（`generation-draft-effects.ts:114` 的 `break`），那是正常中间态，抛冲突码会把它误报成异常。现在改为**静默不封 root**。

#### 顺带修掉的两个坑（不修就白改）

1. **`pause()` 的 UPDATE 缺 `status IN`**：`recoverInterrupted()` 每次启动都会对每个 root 调 `pause()`，原来那句会无条件把 `generation_runs.status` 刷成 `paused` —— 刚写好的 `completed` 下次启动就没了。已加 `AND status IN ('running','paused')`，并有专门回归用例锁住。
2. **`DurableGenerationRun.status` 原是 `string`**：收窄成 `'running' | 'paused' | 'completed' | 'failed' | 'cancelled'`，读取时对非法值 `fail('GENERATION_RUN_STATUS_INVALID')`。拼错字从此是编译期错误，不用等实机发现库里多了个没人认得的状态。

#### 本期**没做**的（明确留口）

- **失败码不落库**（作者已选）：`generation_runs` 只落 `completed` / `failed`，`blocked_code` 仍是门禁字段、不被 seal 触碰。所以「库里看不到具体失败原因」这条**仍然成立**，要查只能看 attempt 与渲染层回执。下一期若要做，需新增 `terminal_code` 列（M29），别直接写 `blocked_code`——它是 `open` / `resume` / `activate` 四处都读的门禁字段，写进去等于永久掐断这一批的续写与恢复。
- **`authorEditedRoot` 分支仍无终态**：该分支连 `pause()` 都会早退（作者手改过的 root 不冻结、不暂停）。这是既有设计，本期不动，但要知道它是个例外。

#### 修后读数（2026-11-02 23:25–23:31 实机）

现场：`师父派我来除魔` 项目，情节大纲续批 1 个单元（第 16 章），模型 `deepseek-均衡`。

| 检查点 | 修前 | 修后（实测） |
|---|---|---|
| 批次正常跑完，`generation_runs.status` | 恒 `running`，只有重启才变 `paused` | **`completed`**（`79b7742c`，attempt `settled` / `finish=stop`） |
| 重启一次后，已经 `completed` 的 run | 会被 `pause()` 打回 `paused` | **保持 `completed`**（dev 重启后复查） |
| `generation_roots.action_json.status`（`generate-plot-outline`） | 恒 `active` | 仍 `active` —— **这是对的**：该 operation 不在 Tier 2 白名单，作者还要续批第 17 章 |
| 同库里两条历史 run（21:39/21:41 批次） | 一直是 `running` | dev 重启后变 `paused` —— **旧数据不会被追溯修**，符合预期（seal 只在收尾时写，不补历史） |

**未实机验的两条**（单测覆盖，实机造不出来或成本过高）：批次**失败**时的 `failed` 终态（要造一次真实失败）、Tier 2 的 `sealed` 封口（要 `batch-chapters` 写到卷末且定稿链完整）。这两条目前只有 `generation-run-seal.test.ts` 的断言背书。

#### 2026-11-06 22:4x 实机：崩溃遗留的 run 在「本进程首次调用生成通道」时被判 `aborted`（**实测，修复有效**）

在**项目副本**上跑完整链路（作者真实项目全程未动，核对过 run 分布与交接单 `source_ref` 与验证前一致）：

| 步骤 | 库里看到的 | 界面 |
|---|---|---|
| ① 写作页起一次真实写稿批次 | 新 run `404ed87b` = `running`，owner `992f4035…` | 日志「调用 AI 生成章节草稿…」 |
| ② **强杀主进程**（模拟崩溃） | **仍是 `running`**，owner 仍是旧进程 —— D2 原始症状复现：崩溃不写终态 | — |
| ③ 重启 → 打开项目（**停在首页**） | **仍是 `running`** | 看不到任何中止迹象（本次**一次 gen 通道都没调用**，属预期；若打开后直接落在章节卡 / 写作页，`ChapterCardEditor` 的 `generation:list` 会当场触发 fence —— 见下方限定） |
| ④ 再次重启 → **正常关窗退出** | **仍是 `running`** | —（同上，未调过 gen 通道） |
| ⑤ 重启 → **切到另一个项目**（触发旧库关闭） | **仍是 `running`** | —（`owners` 里还没有该项目的条目，收口钩子整段跳过） |
| ⑥ 重启 → 进写作页 + 打开「AI 输出」面板 | **变 `aborted`**（全库 aborted 3 → 4） | 「这批生成已中止：上次执行者退出时未收尾，已超过租约期限，结果不能再续。已产出的片段仍可复制；要继续请从当前正文重新发起生成。」+ 按钮「已中止，不能继续」（禁用） |

**结论：修复有效。** 崩溃后第一次调用生成通道（打开 AI 输出面板 / 章节卡编辑器 / 起批，任一即可），旧 run 立刻被判 `aborted`，界面给的是中止文案 + 禁用按钮 + 明确出路，不再有「界面说在跑、实际早死」。

**判定时机要说准（这是与设计稿措辞不一致的一处）**：fence 不在 app 启动时跑，而在**本进程第一次构建 generation owner 时**跑 —— `main-generation-owner.ts:257` 在工厂体顶层直接 `service.recoverInterrupted()`，而 owner 由 `generation-controller.ts:127` 在 `authorizedOwner` 的「还没有条目」分支里构建（全仓只此一处调用 `createMainGenerationOwner`）。

读起来要分清两个字面：「**构建 owner**」不等于「点生成按钮」。任何 `generation:*` 通道（含只读的 `generation:list`）都算。所以：

- app 启动、关窗退出、切项目 —— 不构建 owner ⇒ 不判；
- 打开项目后**停在哪一页**决定判不判：停在首页 ⇒ 不判（③ 就是这种）；直接进章节卡编辑器 / 写作页 / AI 输出面板 ⇒ 那几个组件挂载即调 `generation:list` ⇒ **当场判**。

设计稿 §9.1 记的是「启动 fence（`recoverInterrupted` 内，pause 之前）」，「启动」这个词与实际触发点（首次构建 owner）不符 —— 仅措辞层面，效果上是「用户真正会看到的那一刻才判」，甚至更省。

**剩余的、如实记的真问题**（不阻断本条结项）：库里可能长期留 `running` 的记录 —— 崩溃后只要再也不调任何 gen 通道，这条 run 就一直是 `running`。当前没有「启动时扫全部项目」的机制，跨项目残留要等那个项目被打开并且用到生成功能才清。**但界面上不会出现「假继续」**：会读库的那几个面板（`AIOutputPanel` 等）一挂载就先构建 owner、当场把 run 判成 `aborted`，所以作者看到的必然是中止态而不是「在跑」。受影响的只是「库里说得准不准」。

**未覆盖**：单次实测（一个项目、一条 run、一次崩溃，且 ③ 那一步打开项目停在首页）。「打开后直接进章节卡编辑器」这条入口未单独跑，是按代码推的；「同一项目连续两次崩溃」的叠加情形也未验。


---

## D3（高）`degraded=l3-handoff-missing` 提示过弱，且不阻断

> 状态：🟡 已实施（2026-11-06 · 甲方案 + 复核后补正；两档实机弹窗通过、「确认继续」后的真生成未跑 · 见「实施记录」）
>
> 演进：2026-11-01 登记 → 2026-11-06 23:1x 重新定位（旧判一半已被 P1-2 期 1 覆盖）→ 作者裁「甲」→ 当场落地并实机验证

### 重新定位（2026-11-06 23:1x · 只读代码 + 只读真库）

**旧判要修一半。** 本条登记时写的是「跨卷生成静默降级、作者无从知道」，但 2026-10-25 的 P1-2 期 1 已经上线了这道闸：`OutlineProgressGatePanel` 在**卷首**一弹一次，说清「上一卷正文只定稿到第 N 章，还差 M 章，继续规划只能基于计划不是实际结局」，给两个出口（「我知道，仍按计划继续」写一条可撤销确认 /「取消，我先去补正文」）。真库可见它在工作 —— `consistency_exemptions` 里有 `outline-progress:volume:3` 一条。

**但它判错了维度。** 闸门的判据只有一条：`draftLastChapter >= 上一卷末章`（`outline-progress-gate.ts:65`）。而 L3 拿到的是「实际」还是「计划」，取决于**交接单在不在、能不能用**（`synopsis-projection.ts:504–522`）。两者不是同一件事，于是留下两个都走 `plan` 分支、却都判 `aligned` 的口子：

| # | 形态 | 闸门 | L3 实际 | 作者看到 |
|---|---|---|---|---|
| A | 上一卷**已整卷定稿**，但作者没去「卷末交接」页登记交接单 | `aligned`，不问 | `plan` + `l3-handoff-missing` | **什么也没有** |
| B | 有交接单，但上游改过 ⇒ `validity.state === 'stale'`，`outline-prefix-context.ts:70` **静默**把它置 `null` | `aligned`，不问 | `plan` + `l3-handoff-missing` | **什么也没有**（只有生成日志里一行 `warning`） |

A 不是边角情况：D14 已裁定「交接单**仍然手动登记**」（自动化的边界停在把状态建对），所以只要作者没打开过那个面板，A 就是**默认形态**。

**真库取证（只读，本机真实项目）**：

- `volumes` 6 行，`volume:1` `actual_last=6` `actual_source='finalized'`、`volume:2` `actual_last=10` `finalized`；
- `volume_handoffs` **只有 1 行**，是 `volume:2`（作者手写，`source='author'`，`source_ref={"outline:book":19}`）；
- ⇒ **`volume:1` 属形态 A**。**修前**（2026-11-06 23:1x）此刻重生成第 2 卷大纲：闸门按 `chapterNumber=7` 判 `aligned` 不打扰，而 `readOutlinePrefixContext(volumeIndex=2)` 取不到 `volume:1` 的交接单 ⇒ `l3Kind='plan'` + `degraded.push('l3-handoff-missing')`。**落地后**同一路径会弹 `handoff-missing` 档（实机已验证，见下「实施记录」）。
- 也就是说：这一条不是「当年没做」，而是**现在这个项目正踩在上面**，只不过大纲早已生成完，没人再点一次。

### 原登记内容（保留）

第 N 卷大纲需要第 N−1 卷的卷交接（volume handoff，须该卷正文已定稿才产生）。未定稿时系统用「卷计划摘要」顶替继续生成，只在内部打 `degraded` 标记。

### 证据（原登记）

- `src/shared/synopsis-projection.ts:520` —— `degraded.push('l3-handoff-missing')`。
- 同文件 `:504–522` —— `l3Kind` 在 `'actual'`（拿到交接单）与 `'plan'`（回退到弧光卷摘要）之间回退，`reality` 相应写成 `plan-only`，`reason` 为 `no-handoff` / `unfinalized` / `unresolved`。
- 同文件 `:351` —— `'l3-handoff-missing'` 是 `OutlineProjectionDegraded` 联合类型的成员，只作标记用。
- 库内 `volume_handoffs` 计数为 **0**，而情节大纲已写到第 9 章、涉及第 1–2 卷 ⇒ 这一轮里每一次跨卷的大纲生成都必然走 `plan` 分支。（2026-11-06 复查：现为 1 行，即 `volume:2`；`volume:1` 仍为 0。）

### 代码位置

见上（`src/shared/synopsis-projection.ts:351 / 504–522 / 520`；`src/shared/outline-progress-gate.ts:65`）。

### 影响

作者无法从界面上知道「第二卷大纲其实是拿计划摘要凑的」。形态上残缺却看起来正常——这与本轮「只验形态」的目标正相反：**形态缺陷被内部标记吞掉了**。

影响面已从「每次跨卷必然」收窄为「**已定稿但未登记交接 / 交接单过期**时」。严重度建议由「高」降为「中」——**待裁定**，本轮不自行改级别。

### 候选方案（2026-11-06 提出 · 作者已裁「甲」）

**共同前提**：不改 `synopsis-projection` 的降级逻辑本身（它是对的），只补「作者知道」；不新增阻断档，沿用既有「一卷一次 + 两个出口 + 可撤销确认」机制。

| 选项 | 做法 | 作者实际感受 | 代价 |
|---|---|---|---|
| **甲**：闸门判据扩成二维（**已采纳**） | `outlineProgressGateOf` 增加交接单维度（无单 / stale 各成一档），`readOutlineProgressGate` 多读一路 `db:volume-handoffs-list`（读法照抄 `outline-prefix-context.ts`），面板按三档说不同的话 | 卷首弹一次「上一卷已有实际结局，但没登记交接单 / 交接单已过期，本卷仍只能用计划」；确认一次该卷就不再问 | 改 shared 判定 + 读侧 + 面板文案；现有 1 处调用、`outline-progress-gate` 单测与 `OutlineProgressGatePanel` browser 测要同步扩 |
| 乙：只在「卷末交接」页被动提示 | 该页对「已定稿但无交接单」的卷显示一行「下一卷大纲将以计划摘要替代」 | 得自己去那个页面才看得见；等于把 D14 的老毛病（作者不去就不提示）再复制一遍 | 最小 |
| 丙：产物/日志侧留痕 | 生成完成后在大纲产物旁标「本批 L3 = 卷纲摘要」 | 事后可查，但生成前不打扰；日志那条 `degraded=` 作者本来就不看 | 小，但**大概率无效**（D3 原判就是「标记被吞掉」） |

### 实施记录（2026-11-06 23:2x · 甲）

| 落点 | 改了什么 |
|---|---|
| `src/shared/outline-progress-gate.ts` | 新增 `PreviousHandoffAvailability`（`usable` / `missing` / `stale` / `unknown`）与 `reason`（`prose-unfinalized` / `handoff-missing` / `handoff-stale`）。判定**两维依次**：正文定稿不过就报第一档（此时讲交接单是废话）；过了再看交接单。`acknowledged` 一次管住两维。省略第二维 = `unknown` = 不打扰，等价于扩维之前的行为 |
| `src/services/outline-progress-gate.ts` | 多读 `db:volume-handoffs-list`，`handoffAvailabilityOf()` 按**卷号精确匹配**、`validity.state === 'stale'` 算 stale、六栏全空算 missing、**渲染为空算 unusable**（第一版漏了这一档，复核打回后补，见「复核后补正」）。读失败/抛异常 ⇒ `unknown`（fail-open，且不拖累第一维） |
| `OutlineProgressGatePanel.tsx` | 三档各自的标题 / 正文 / 默认理由 / 取消按钮文案。第一档保留原句，取消仍是「我先去补正文」；missing 档是「我先去登记交接单」；stale 档是「我先去更新交接单」。`authorityStatus === 'invalid'` 的补充句只在第一档出现 |
| 测试 | shared 12 条（含「两维同时不过只报第一维」「确认一次管住两维」「不传第二维保持旧行为」）；service 14 条（新建文件：stale / 缺失 / 可用 / 空单 / 超预算 unusable / `usable ⟺ 渲染非空` 等价式 / 只别的卷有单时不回退 / 读失败 fail-open / 通道抛异常仍报第一维 / 卷表非 ready 不判 / 未定稿时第二维不改结论 / 已确认放行 / 撤销不算数）；browser 12 条（四档文案与出口 + 第一档三条内部分岔 + 负断言） |

**实机验证（2026-11-06 23:2x · 项目副本 projB，作者真实项目零改动）**

- 通道：dev + CDP；关掉「按单元生成情节大纲」（按章模式可手填范围），把范围设成**第 7–12 章**——第 7 章正是第 2 卷第一章，判定对象是 `volume:1`（已定稿 6/6、库内无交接单）。
- **missing 档**：点「确认生成」直接弹面板，文案逐字为「上一卷的卷末交接单还没登记 / 第1卷（第1–6章）正文已经整卷定稿，但没有登记卷末交接单。本卷大纲只能基于卷纲计划，不是这一卷实际写完的样子 —— 卷末停在什么事上、哪笔债没结，都进不来。」按钮为「取消，我先去登记交接单 / 我知道，仍按计划继续」。**闸门在发射前拦住，未产生 run**。
- 取消 ⇒ 面板消失、确认对话框留在原地、`consistency_exemptions` 仍为 2 行（零写入）。
- **stale 档**：在副本里给 `volume:1` 插一张 `source_ref={"outline:book":1}` 的探针交接单（当前 20 版）⇒ 重启后同一路径弹出「上一卷的卷末交接单过期了 / ……的卷末交接单是更早写的，之后上游已经改过。为了不把旧事实当成当前事实，本次不会使用它 —— 本卷大纲仍只能基于卷纲计划。」按钮为「取消，我先去更新交接单」。**这一档顺带证明了 `db:volume-handoffs-list` 的 `validity` 派生真的会随上游版本落后而变 stale**，闸门与投影的口径不是各说各话。
- **未覆盖**：点「我知道，仍按计划继续」后的真生成没跑（那会真起 run、消耗模型调用）；豁免落库路径由 browser 测 + 本次取消的零写入两侧夹住。
- 复原：探针交接单已删、`synopsisUnitMode` 已改回 `true`、dev 最近项目列表按备份还原；真实项目核对为 137 runs / 3 aborted / 112 paused、交接单仍 `{"outline:book":19}`、`consistency_exemptions` 仍 2 行。

**留下的取舍**：严重度原为「高」。修完后「静默降级」这条路已经堵上，若作者认可可降为「中」——本轮**不自改级别**，等作者一句话。

### 复核后补正（2026-11-06 23:4x · 独立复核打回四条，已全修）

第一版落地后被换身份复核打回，四条都成立，逐条修了：

| # | 复核指出的问题 | 为什么真 | 修法 |
|---|---|---|---|
| 1 | `handoffAvailabilityOf` 只判「六栏空不空」，但投影的判据是 `renderVolumeHandoffSection(...) !== ''` | 作者手填一段 >1500 字的交接单、面板照样保存 ⇒ 闸门判 `usable`、投影渲染成空节走 `plan`。**D3 原缺陷换个原因复发** | 新增第五值 `unusable`（单在、不空、没过期，但渲染为空）与 `handoff-unusable` 档，面板说「超过单份篇幅预算、渲染出来只剩空节」，出口「去精简」。判法直接复用 `renderVolumeHandoffSection` 真值，两种语言都渲染取严（读侧拿不到项目语言） |
| 2 | 第一档固定写「只能基于计划」，但 `prose-unfinalized + handoff usable` 时投影注入的是 `actual(partial)` | 界面陈述与投影**相反**。`invalid + usable` 同理（账本有洞，但单在、仍会用） | 第一档内部分岔：`actualInUse` 时说「会用它，但它记的是部分定稿时的样子」；`invalid` 组合同理加一句「本卷会用已登记的交接单」 |
| 3 | `invalid` 时 `missingChapters = 0`，正文却输出「还差 0 章」 | 与标题「还没整卷定稿」打架，读者以为是 bug | `invalid` 换独立正文，不再让 `missingChapters` 参与措辞 |
| 4 | 第四路读并进 `Promise.all` | 该通道 reject 时整体 reject ⇒ 连原本会报的 `prose-unfinalized` 一起吞掉，是**新引入的回归面** | 第四路单独 `.catch(() => null)`；另加「卷表 `state` 不是 `ready` / `empty` ⇒ 判不出就不拦」的守卫（边界本身不可信时不该硬判） |

复核还指出测试里的两处假断言（stale 档没断言标题、默认理由的负断言缺失）与一处覆盖缺口（`usable ⟺ 渲染非空` 的等价式没人钉），一并补上：service 从 9 条增至 14 条、browser 从 9 条增至 12 条、shared 12 条不变。

**复核确认成立、本轮不动的两条**（记在这里免得下一轮重复提）：
- 闸门用卷表反推上一卷卷号、投影用 `cursor/arc-span` 的 `volumeIndex − 1`，两者在卷数变化后可能漂移。要修得把已解析的 position 传进读侧，属数据流改造，本轮不做；已加 `state` 守卫兜住最坏情况。
- `authority.status` 只校验 `typeof === 'string'`、不校验枚举值。脏值概率极低，不动。

---

## D4（中）UI 里散落「来源已变化」文案，但没有任何地方把它和批次中止关联起来

> 状态：待裁定（2026-11-01 · 未开工）

### 现象

面板存在「来源已变化；候选仍可复制，不能直接保存」这类提示，但与「任务停摆」之间没有因果说明。

### 证据

- `src/components/panels/AIOutputPanel.tsx:398` —— `recovery.sourceStatus === 'conflict' && !recovery.saved` 时渲染「来源已变化；候选仍可复制，不能直接保存。」
- 同文案还散落在：`src/components/editor/CodeMirrorEditor.tsx:678/694/716`（「来源已变化，结果仅可复制」）、`NarrativeThreadEditor.tsx:841/1028`、`VersionHistory.tsx:281`、`ArchFileViewer.tsx:1029`。
- 这些提示的语义都是**「这一稿的结果不能落库」**，没有任何一处说明**「批次已经停止，后面的单元不会再跑」**。

### 影响

这是 D1 与 D2 之间的语义断层：系统其实知道「来源变了」（所以拒绝保存），却没把同一件事翻译成「所以这一批到此为止」。作者看到的是「结果不能保存」这种局部提示，自然会以为是单个产物的问题，而不是整批已经停了。

### 建议修复方向

方向：把「来源冲突」的两层后果分开表述——**产物层**（这一稿不能保存，仍可复制）与**批次层**（后续单元不再执行，需重新发起）。同一份 `sourceStatus` 应同时驱动这两条文案，而不是只在产物面板里出现。

---

## D5（中）卷/单元结构输出里模板尖括号占位符原样保留

> 状态：已实施（2026-11-05 · `87684f48` · **只去尖括号、文字其余不动**，两侧都做了：模板去 `<…>` + `writeArchToDb` 前接 `findAngleBracketPlaceholders()` 告警（不阻断）。**未实机验证**新形态是否真的不再被抄；若模型转去整句照抄说明文字，退回「只留字段名」形态）

### 现象

卷/单元结构输出里大量出现 `<七点>`、`<钩子>`、`<起承转合>` 这类模板占位符，模型把格式模板的尖括号原样抄进了内容。

### 证据

`debug/prompt-trace/20261101-213138-718-弧光-d57a1d5d.json` → `ioCalls[0].output`（卷纲，6,706 字符），示例：

```
- 拍子：<七点>
- 落位：<钩子>→单元一｜<第一转折>→单元二｜<结局>→单元三
- 逼法：<赵铎用律条锁人> → 结束时变成【戒律堂状纸反咬】，因为…
（交手：<设局>；档：<关心>→<标价>）
- 落位：<起>→第 1 场｜<承>→第 2 场｜<转>→第 3 场｜<合>→单元结束
```

注意 `<赵铎用律条锁人>` 这类：括号内确实是本书专名，但**整段内容仍留在尖括号里**，说明模型是在「填模板」而不是「写内容」；同时 `拍子：<七点>` 里连拍名也是占位形态——而 `shared/story-beats.ts` 是拍子的唯一事实源，输出本应是照抄表内名字。

### 代码位置

- 提示词模板（`plot_structure`）的输出格式段本身用 `<…>` 作占位示意，见同一 trace 的 `snapshots[0].fragments[0].rawText`。
- 解析侧：`src/shared/` 的弧光解析器（`arc-*` 系列）对该形态无校验。

### 对照既有裁定

项目已有一条已裁定结论「prompt 工程：给判法，不给例子」（理由：例子会被逐字抄成内容，见 [`prompt-clause-admission.md`](../prompt/prompt-clause-admission.md)）。此处的 `<…>` 模板正是同一类问题的另一种形态——**给的是「填空格式」，模型就只填空**。

### 影响

- 结构层产物直接带占位符进库，下游（章纲、正文）读到的是无意义字段；形态验收在第一步就失真。
- 与「同一层兄弟个数不许完全相同」这类机检并列，占位符没有任何机检拦截。

### 建议修复方向

方向：输出格式段不要用 `<…>` 描述字段形态（改成「字段名：内容」并说明内容该是什么），或给一条「输出里不得出现尖括号占位」的机检，二者择一即可形成闭环。前者改提示词，后者改校验；只改一侧仍会漏。

---

## D6（中）卷数由平台画像固定区间决定，与总章数解耦

> 状态：已实施（2026-11-06 · **方向 A 撤回、D6 重定义**，两张实施卡已复核通过并合并 `cb2ede1c` / `57290b20` —— 见方案稿 §9.8）
> ⚠️ **2026-11-06 口径修订**：本节「现象 / 实测」仍成立，但**结论已被方案稿 §9 取代** —— 卷数属卷纲层、重生成代价极小、不进任何判据；工程目标只有「每章字数 × 总章数」的反馈收敛。原文保留作历史记录，**别再照下面的「建议方向」做**。
> **方案稿（2026-11-05，§9 为现行口径）**：[`../architecture/d6-volume-count-source-design.md`](../architecture/d6-volume-count-source-design.md)
> **方案稿对本文的更正**：① 「卷数由画像单方面决定」应改成「模型在画像区间内**自己挑**，代码既不算也不校验」（`majors.length` 是消费端计数，且有 9 处各自读它，不是唯一决定点）；② 12 章缺口不是被某一环"吃掉"——`scaledBoundaries` 强制末条 = `total`，计划本身闭合，缺口来自「实写环（D7）× **终止环**（`architecture.command.ts:373` 单元用尽即判全书完成，全链无 `covered_to` 对账）」叠加 ⇒ **只修 D7 仍会在第 18 单元收尾**。

### 现象

作者设 30 章，模型给 6 卷 × 每卷 3 单元 = 18 个单元，折算每卷 5 章、每单元 1–2 章——30 章的书被切成 6 卷，与作者「两卷」的预期完全不符。

### 证据

同一 trace（`20261101-213138-718-弧光-d57a1d5d.json`）拼装后的 user message：

```
【节奏推荐（如有，由平台画像注入；本提示词里关于个数的唯一来源）】
番茄向（强钩子、快兑现）
- 全书 6–8 卷；每卷 3–5 个单元
```

「输出前自检」：

```
2. 卷数与每卷单元数落在【节奏推荐】的区间内。
```

模板正文同时写明：`卷数与每卷的单元数，一律按上面【节奏推荐】给的区间取；不要自己另行计算`。而同一模板的「参考参数」里有 `全书：约{{number_of_chapters}}章`（实测 30 章、1500 字/章）。

实际输出首两行：

```
**卷级划分**：6 卷
**单元级划分**：每卷 3 个单元
```

### 机制

卷数由**平台画像的固定区间**（6–8 卷）单方面决定，`number_of_chapters` 只进入「选拍子时心里算跨度」，不参与卷数决策。所以 30 章与 300 章都会被切成 6–8 卷——**卷数不随篇幅缩放**。

### 附带：自我约束未被任何校验拦截

模板自己写着 `同一层的兄弟个数不许完全相同（全给 3 个 = 没算过）。差 1 个是正常的。`，实际输出每卷都恰好 3 个单元（6 卷全 3）。这条约束在解析侧没有任何机检（对照 `shared/story-beats.ts` 那四条拍子机检 `ARC_SAME_BEAT` 等，拍子有校验，兄弟个数没有）。

### 影响

- 作者对「这本书分几卷」没有话语权；卷数由画像常量决定，而不是由章数与故事决定。
- 「全给 3 个」被放行，说明这条反同质化条款在实机上等于不存在。
- 30 章切成 6 卷的直接后果是每卷只剩 5 章——见 D7。

### 建议修复方向

方向：卷数的**单一事实源**需要重新裁定。可选：① 卷数 = f(总章数) 由代码算，画像只给「每卷章数区间」；② 画像区间按篇幅分档（短篇/中篇/长篇各一套），不再一套通用；③ 作者可覆盖。另需给「同层兄弟个数不得完全相同」补一条机检，否则该类条款无法证伪。相关工作已有前身：[`arc-budget-engine-design.md`](../architecture/arc-budget-engine-design.md)（章数由本地算、模型只复核）。

---

## D7（中）单元 → 章 折算偏保守且与对话框预告不符

> 状态：待裁定（2026-11-01 · 未开工）· **2026-11-03 取证：把「偏保守」与「不符」拆开，后者不成立**

### 2026-11-03 复核（外部 agent 串行取证 + 主 agent 逐处核对）

`computeSynopsisUnitRange` 是**唯一**折算实现，两侧同源，三处已逐条核对：

| 侧 | 位置 | 原文 |
|---|---|---|
| 对话框 | `src/services/workflows/synopsis-unit-launch.ts:298` | `computeSynopsisUnitRange(input.plotStructurePlan, totalChapters, cursor, coveredTo)` |
| 生成 | `src/services/workflows/commands/architecture.command.ts:2948` | 同一个 `computeSynopsisUnitRange`；`:3052` 用其 `maxChapters` 推批次上界 |
| prompt 文案 | `src/shared/arc-position.ts:960` | `const cap = Math.round(stats.maxChapters * 10) / 10`（保留 1 位小数） |

⇒ **「与对话框预告不符」这一半不成立**：那条原判断把「显示精度差」当成了「算法不一致」。对话框显示已 `ceil` 的整数，prompt 侧显示 1 位小数的分数上界，两者出自同一份 `planUnitStats`。

**但「偏保守」这一半成立，且原因不在算法**：`maxChapters` 只约束上限、不约束下限，模型按「一个单元 = 一段对峙局面」写完即收，实际章数由模型判断。所以修复方向的 ①（预告并列「名义上界 + 按当前倾向的估计」）仍然对；②③ 的「配给信号」要重新估——池子在卷内，不是改折算函数能补的。

### 现象

对话框预告「本卷剩余 5 章，名义上界 2 章」；实测「连写 3 个单元」只落 3 章（1 单元 = 1 章）。全书 18 个单元按此折算只有 18 章，到不了配置的 30 章。

### 证据

- 预告文案：`src/components/dialogs/ArchitectureConfirmDialog.tsx:774` —— `` `本卷剩余 ${unitMode.volumeRemaining} 章，名义上界 ${unitMode.maxChapters} 章。篇幅由剧情决定，写完按实际章数落盘。` ``
- 实测：四批 `2d60f259 / ce80d97d / 8e48c534 / e11a7ec4` 分别落 3 / 1 / 2 / 3 章，`synopsis_covered_to = 9`；`synopsis_unit_cursor = {volumeIndex: 2, unitIndex: 2, writtenInVolume: 3}`。
- 折算偏差已被系统自己记下：`partial_arch.json` → `synopsis_volume_deviations = [{ volumeIndex: 1, planned: 5, actual: 6 }]`，即卷一计划 5 章、实际 6 章（6 章 = 3 个单元 × 2 章，与该批输出一致）。
- 6 卷 × 3 单元 = 18 单元（D6）；若维持「1 单元 ≈ 1 章」的实际倾向，全书约 18 章 < 配置的 30 章。

### 机制

`maxChapters` 是「本卷剩余章数 ÷ 本卷剩余单元数」得到的**名义上界**（见 `src/services/workflows/commands/__tests__/synopsis-unit-request.test.ts` 的用例语义），它只约束上限，不约束下限；模型按「一个单元 = 一段对峙局面」写完即收，实际章数由模型判断。系统事后把偏差记进 `synopsis_volume_deviations`，但**不纠正、不预告、不再平衡**。

### 影响

- 预告的数字（上界 2 章）与实际（1 章）方向一致但量级减半，作者会误判进度。
- 全书总量层面，18 单元按实际倾向只能到 18 章左右，与配置的 30 章差 12 章；差额没有任何机制补回（偏差只在卷内结清，见 [`unit-budget-elastic-allocation-design.md`](../architecture/unit-budget-elastic-allocation-design.md) §Z 的口径，但本轮的池子是「卷」，卷内已无余量）。

### 建议修复方向

方向：把「单元 → 章」的折算从**事后记录**变成**事前可用**。可选：① 预告同时给出名义上界与「按当前实际倾向的估计」（两个数并列，避免单数字误导）；② 卷内有剩余章数不足时，在下一单元开写前给出配给信号（紧/松），而不是等卷末再记偏差；③ 全书层面需要一个「到不了总章数」的预警——当前 `synopsis_volume_deviations` 已在算，只是没有消费者。

---

## D8（中）候选区大纲残本阻塞生成（旧标题「检查点残留导致模式自动降级，且提示藏在段落里」为 05:38 前的定义）

> 状态：已实施（2026-11-06 · **第八轮补正后直接施工** · 单测 2203/2203、相关 browser 54/54、`check-fast` 三项全绿；**19:5x Agent 已用 CDP 实机跑完 §12.10.4 四条；20:4x 作者四条订正后的三项阻塞已修复，21:0x 实机复验通过（§12.10.6）**：删掉的是**大纲生成物（候选，未落稿）**不是正文、**未落稿物不再被当正式产物守护**（`confirmedPrefixFromDbOutline` + `isPendingBatchWithoutCandidate`）、**卷单元模式下右侧与架构页的中继续写入口整块静默**（不新增按钮）、弹窗单元块改按配置开关判据 · 提交 `c37a268f` 起）—— **问题定义回到「候选区残本阻塞大纲生成」（§12.1.1 / §12.10）**：卷/单元路线**每次点「生成 / 执行」都无条件清候选区**（残本不参与这条路线）、**上游级联清空时界面连坐清**；旧模式保留候选区续写、不套这条规则；**不新增 / 不删除任何按钮、不判定「是不是重写」**。清场只作废残本，**不删进度 / 游标 / 偏差账 / DB 正文、不复用 `resetSynopsisCheckpoint` 的 14 键整表删除**；**完成态 `synopsis_range` / `synopsis_result` 是下一批的记账，一律保留**（§12.10.1）。按生成路线分流、配置二选一走到底、禁止模式交替、反馈收敛链零改动等 04:47–05:03 裁定继续有效；**单元连选 = 链式新 run 每批立即落稿，只丢最后残缺单元**（§12.9）。05:20 豆包首轮审核已抽查收口，**05:38 两条提请裁定撤销为伪需求**，v1–v3 与 C1 / C2 作废；**18:4x 复审（491 行）已回并逐条抽查，作者 18:5x 裁定「这轮补正以后不用复审了，直接施工，做实际验证」** ⇒ 十三条取证已在 §12.10.2 收口、不再重划 v4 任务书，**生产代码已写入、验证全绿**（§12.10.4）；看板卡 `4b9eae6e` 已改为留痕卡、仍不得派发。
> **04:1x 进度（历史口径，现值见 §12.10）**：作者裁「本来就是 D8 的问题没解决干净，走进了死胡同，既没解决原先的问题，又引发了新的问题」⇒ 直接回炉，不另开卡。当时 §12 写的是「把续写 / 重写拆成两条流程线、候选恢复按钮按 type 拆开」，**05:38 后已被「按生成路线分流 + 残本无条件清场」取代**；守卫与并行红线均不放宽。原始裁定（1=A / 2=A / 3=Z / 5 逐章路径保留）仍有效的部分见方案稿头部。
> **方案稿（2026-11-05）**：[`../architecture/d8-checkpoint-degradation-design.md`](../architecture/d8-checkpoint-degradation-design.md)
> **方案稿对本文的更正（行号为 2026-11-05 快照，按符号名定位）**：① 本文列的五处「判定入口」四处已漂移或不相干，真正决定降级的是 `synopsis-unit-launch.ts` 的 `skip('incomplete')` 一处探针（现值 `:289-292`，第八轮已取消）；② `synopsis_incomplete` **仍活**，且 D1/D2 修完后从"偶发"变"稳定复现"；③ 三个出口里两个今天走不通：转按章区间、重置检查点后被拦 ⇒ **后者登记为 D8 不修的已知边界**（§12.10.5）。

### 现象

第一次连写多单元后，检查点标记 `synopsis_incomplete=true`；点「续批」时模式被自动从「按单元」降为「按章区间」，理由写在对话框一段小字里：「未按单元生成：检查点里有未完成批次（synopsis_incomplete=true）：中断续写语义未定，本次走按章区间」。

### 证据

- 检查点现状（`partial_arch.json`）：`synopsis_incomplete = true`、`synopsis_covered_to = 9`、`synopsis_range = {from: 10, to: 10}`、`synopsis_unit_cursor = {volumeIndex: 2, unitIndex: 2, writtenInVolume: 3}`、`synopsis_generation_handle.runId = b79a98f3…`。
- 降级文案：`src/components/dialogs/ArchitectureConfirmDialog.tsx:717` —— `未按单元生成：${describeSynopsisUnitProbe(unitPreview)}`。
- 判定入口：`src/services/workflows/commands/architecture.command.ts:994–997`（`checkpoint.synopsis_incomplete === true` 时给出原因）、`:1184–1185`、`:1259`、`:1279`、`:2912`。

### 附带矛盾：同一屏两个章数

同一段文字说「默认推进 10 章」（`ArchitectureConfirmDialog.tsx:707`，`PLANNING_ACTION_CHAPTER_LIMIT = 10`，`src/shared/plot-outline-contract.ts:9`），下方控件却显示「本批 5 章」（`:932`，用 `synopsisLength`，默认 `DEFAULT_PLANNING_ACTION_CHAPTERS = 5`，同文件 `:8`）。两个常量不同，被降级时两段同时渲染。

### 影响

- 模式降级是本轮 D1 的直接后果：`synopsis_incomplete` 是批次中途死掉留下的疤痕，而它反过来**改变了下一批的生成语义**——作者以为是「按单元续写」，实际走的是「按章区间」。
- 理由写在灰色小字段落里，与「重置情节大纲检查点」按钮（`:731`）同级呈现，不构成决策点。
- 两个章数同屏，作者无法判断「本批到底写几章」。

### 建议修复方向

方向：把「模式被降级」提升为**决策点**而不是段落文字（要么阻断并说明「上一批未完成，请先选择：接着按单元续 / 转按章区间 / 重置检查点」，要么直接沿用作者上次的选择）；同时统一「本批章数」的唯一事实源，一个屏只出现一个数字。

---

## D9（低）单章大纲调用可能长时间不返回，无超时/无中断

> 状态：待裁定（2026-11-01 · 未开工）

### 现象

第 10 章大纲调用持续 12 分钟未返回（Ollama `/api/ps` 的 `expires_at` 一直在延长，说明模型在算），最终只能通过重启 dev 进程清掉。UI 无任何「正在生成 / 已超时」的区分。

### 证据

- `debug/prompt-trace/20261101-215546-106-大纲-ch10-b79a98f3.json`：有 `snapshots`（`capturedAt` 记录、`builtLength` 13,215），但 **`ioCalls` 为空数组**——即请求已组装并发出，从未收到响应，trace 因此没有输出段。
- 对应 `generation_attempts`：`b79a98f3…` 的 attempt `status = 'unknown'`（启动恢复把 `dispatch-marked` 改写成 `unknown`，见 `generation-run-repository.ts:684–687`）。
- 对应 `generation_runs.status = 'paused'`、`blocked_code = NULL`。

### 影响

- 没有超时上限时，一次挂起会占住整条链路：后续批次无法推进，且界面上没有任何「可以中断」的入口。
- 「模型在算」与「已经死了」在 UI 上不可区分——与 D2 是同一类观测缺陷，只是触发原因不同（D2 是业务失败，D9 是物理无响应）。

### 建议修复方向

方向：给单次模型调用一个可配置的上限，并区分三态（正在生成 / 超时已中止 / 调用失败）。中止后要与 D2 的失败终态共用同一条落库路径，否则超时同样会变成「假继续」。

---

## D10（低）「清空生成内容」未清掉历史审稿/生成记录面板

> 状态：待裁定（2026-11-01 · 未开工）

### 现象

清空后蓝图页与日志面板里仍能看到上一轮的「第1章审稿候选」「第1章生成记录」「确认继续已选正文」等残留卡片，按钮列表里混入十几个孤立的「复制」「编辑恢复稿」。

### 证据

- 数据库侧计数确实为 0：`blueprints` 0、`drafts` 0、`volumes` 0、`volume_units` 0、`volume_handoffs` 0。
- 界面侧仍显示上述卡片 ⇒ 残留来自**不在这几张表里的状态**（渲染进程内存 / 本地存储 / `generation_artifacts` 历史）。
- 清空功能的语义见 `src/components/dialogs/ClearProjectDataDialog.tsx:35/43/51`（分三档：故事架构、章节规划、正文与审稿）。

### 影响

作者无法确认「清空到底清了什么」。DB 与 UI 两个口径不一致时，人只能相信眼睛——而眼睛看到的是残留。

本次验收未定位到具体残留宿主（未逐层排查 localStorage / store），故此处只记录现象与「DB 已清、UI 未清」这一事实差。

### 建议修复方向

方向：清空动作需要一个**渲染进程侧的重置钩子**（不只是删库），且清空完成后应给出「清了哪几类、各多少条」的回执，让 DB 与 UI 的口径可以对齐核对。

---

## D11（低）生成完成后「补角色卡」提示按批重复堆积

> 状态：待裁定（2026-11-01 · 未开工）

### 现象

每完成一个单元/章就弹一次同一条提示（「情节大纲已生成……去补角色卡」），日志里连续出现多条相同提示。

### 证据

- 提示文案：`src/services/architecture-character-nudge.ts:43–47`（`toast.zh` / `banner.zh` / `action`）。
- 「这一稿是否已处理」的判据是指纹：`:112` 的 `outlineNudgeDraftVersion()` 返回 `c<章级覆盖数>:l<正文长度>`；`:130–137` 的 `shouldNudgeOutlineCharacterSupplement()` 判定 `dismissedVersion !== 当前指纹` 才提示。

### 机制

指纹由「章级覆盖数 + 正文长度」两项构成。**每一批大纲生成都会让这两项同时变化**（覆盖数增加、正文变长），因此指纹必然改变 ⇒ 「已处理过」的记录立刻失效 ⇒ 提示重新出现。本轮按单元逐批生成，于是每一批都重新弹一次。

注意：这不是「同一稿弹了两次」的 bug，而是**指纹粒度与「一稿」的定义不匹配**——作者心中的「一稿情节大纲」是全部写完的那一份，系统按每次增长重算。

### 影响

提示的边际信息量递减，最终变成噪音。这是低优先级的体验问题，但它有一个副作用值得记录：**次数多了作者会习惯性点掉，包括在真正该补卡的时候**。

### 建议修复方向

方向：把「一稿」的定义与指纹解耦——例如只在「情节大纲整卷完成 / 检查点 `synopsis_incomplete = false`」时提示一次，而不是任意增长都算新稿；或按卷指纹而非全局指纹去重。

---

## 3. 交叉观察（不计入缺陷编号，供裁定参考）

1. **D1 / D2 / D4 / D8 是同一件事的四个断面**：D1 是触发器，D2 是状态机缺口，D4 是文案层断层，D8 是疤痕反向影响下一批语义。单修任何一条都不足以让「连写多单元」可用。
2. **D5 / D6 同源于「提示词给了形态就只出形态」**：占位符是格式模板的副作用，卷数是画像常量的副作用，两者都不是模型「不听话」，而是模板给了它一个可以填空的壳。
3. **D3 与 D7 都指向同一件事：跨层材料不足时系统选择「降级继续」而不是「停下来问」**。这在形态验收里是负资产——本轮想验的正是形态。
4. 本轮所有批次均未进入正文与定稿阶段（`drafts` 为 0），因此「正文 → 定稿」段没有实测证据，本文不含该段的结论。

---

## 4. 证据索引

| 类型 | 位置 |
|---|---|
| 主进程 stderr | `pnpm dev` 终端（`generation:execute` 报 `GENERATION_SOURCE_CHANGED`，两次） |
| Prompt 追踪 | `师父派我来除魔，幕后真凶竟是小师妹/debug/prompt-trace/20261101-*.json`（10 个文件，含 4 批大纲 + 1 次无响应 ch10） |
| 检查点 | `师父派我来除魔，幕后真凶竟是小师妹/.ai-novel/partial_arch.json` |
| 数据库（只读） | `师父派我来除魔，幕后真凶竟是小师妹/.ai-novel/project.db`：`generation_runs` / `generation_roots` / `generation_attempts` / `project_core` / `blueprints` / `drafts` / `volumes` / `volume_units` / `volume_handoffs` |
| 运行环境 | 本地 Ollama `qwen3.5:9b-128k`；`/api/ps` 无模型 = 已卸载 |

---

## 补充（2026-11-01 22:45 实测追加）

### D12（阻塞级）正文与上一章开头重演时，结果被直接丢弃且无重试、无回流路径

> 状态：已实施（2026-11-04 · **R6** 落地：短细纲前驱从「上一章全文」改为「要点 + 结尾 ≤300 字」，并同改判据 —— 「只能用材料里已有的事件」→「每段必须对应本章蓝图的一个事件」。只到单测级（短细纲 22 / 正文命令 245 / tsc 0 error），**未实机复验**、**无 A/B**。实施记录见 [上一章注入形态评估](../../design/prompt/previous-chapter-context-assessment.md) §9 · `ba3d4bc5`）

- 现象：第 2 章写稿两次尝试（批量模式一次、单章模式一次），正文都生成成功（trace 中 `chapter-draft` 输出 1418 字符），但**均未落库**，`drafts` 表始终只有第 1 章。
- 界面原文（编辑器/日志区，非任务面板）：
  > 第 2 章 · 写稿 · 工作流未完成
  > **新章节开头与上一章结尾存在大段重演，结果未保存。请重新生成，并让本章从上一章已完成事件之后继续。**
- 批量模式另有日志：「`[失败] [批量自动定稿 · 第 1 至 6 章] 步骤: 第 2 章 · 自动定稿与后处理 — 工作流已取消`」「`Reason=error 22:38:45`」。
- 影响：
  1. 每章 3～4 分钟的模型产出直接作废，**没有任何自动重试或"带纠正提示重跑"的路径**；
  2. 失败信号只出现在编辑器/日志文字里，**任务面板显示为正常结束**，作者容易误判为"已经写好了"；
  3. 触发原因在上游：第 2 章蓝图（"塌方前的账目漏洞"）与第 1 章实际正文（闸机口对峙）事件重叠，但蓝图生成时不校验"与已定稿正文的重叠度"，把矛盾全部推给正文环节兜底。
- 建议方向：
  1. 该拦截保留（它拦得对），但应改为**带原因回流的可重试**：把"重演段落"作为纠正指令自动注入重跑一次，而不是丢弃；
  2. 任务面板必须把"工作流未完成"呈现为失败态，不能显示为完成；
  3. 生成蓝图时对"已定稿章节的实际事件"做一次重叠检测，在源头拦，而不是在正文环节拦。

### 补充：批量连续生成 vs 单章生成的行为差异（实测对照）
- 批量模式（6 章 / 自动定稿）：第 2 章只完成 `chapter-draft-short-outline`（219 字符），**正文那次调用没有产生任何输出**，run `3c8aa501` 挂 `running` 15 分钟，模型 22:31 即空闲（`/api/ps` 租约过期）。
- 单章模式（写作第2章）：同样内容，`chapter-draft-short-outline`(258) + `chapter-draft`(1418) **两次调用都成功**，随后被 D12 的重演校验拦下。
- 结论：批量模式的失败点更靠前（正文调用根本没发出/无响应），单章模式能把内容生成出来。**两条路径的失败原因不同，但结果都是"内容生成了、没有保存、界面不说清楚"**。

### 补充：输出 token 预算日志的观感问题（非缺陷，但易误解）
- 界面日志的「本工作流累计请求 524288/100663296」指**输出 token 的累计预算**，不是请求次数；打印位置 `src/services/workflows/commands/generate-draft.command.ts:431`，每次尝试都会打一行。
- 96M token 上限对 6 章（每章 1500 字）而言等于无限制，不会触发。建议文案改为「累计请求输出 512K / 96M Tokens」，避免被读成"请求次数配额"。

### D13（高）同一章三次失败分别挂在三个不同层，失败原因互不相关且都无恢复路径

> 状态：已实施（2026-11-06 · **1=B / 2=A（与 D8 裁定 2 合并答）/ 3=A**；§5.4 跨 IPC 取码已验通；实施已合并 `959a3647`，T5 缺口按裁定 A 补齐）。**方案稿已出** →
> [`architecture/d13-chapter-failure-contract-design.md`](../architecture/d13-chapter-failure-contract-design.md)，
> 首版经独立复核打回五处后修订，其 §11 是复核记录。**下面这三条「建议方向」已被实读推翻，勿照做**（见方案稿 §4）。

实测第 2 章（同一蓝图、同一模型 `qwen3.5:9b-128k`），三次尝试三种死法：

| 次数 | 模式 | 走到哪 | 失败原因 | 界面表现 |
|---|---|---|---|---|
| 1 | 批量创作（6 章 / 自动定稿） | 短细纲完成（219 字符），正文调用无任何输出 | run `3c8aa501` 永久 `running`，模型 22:31 即空闲 | 任务面板「第 2 章 · 自动定稿与后处理 10%」挂了 15 分钟 |
| 2 | 单章「写作第2章」 | 短细纲(258) + 正文(1418) 都成功 | 「新章节开头与上一章结尾存在大段重演，结果未保存」 | 编辑器/日志文字，任务面板显示正常结束 |
| 3 | 单章 + 作者微操指导（要求从上一章之后续写） | 短细纲(478) + 正文(1112) + 自动续写(1112) 都成功 | `generation:compose-visible` → `GENERATION_COMPOSITION_NO_PROGRESS` | 「工作流未完成」 |

- 关键问题：**三层校验（调用层 / 内容重演层 / 组装层）各自拦一次，彼此不知道对方的失败**，对外只表现为"又没成"，且每层都不提供可执行的下一步。
- 尤其第 3 次：`chapter-draft-continuation` 机制本身是好的（检测到不完整会自动续写），但续写完成后在 `compose-visible` 阶段被判"无进展"而整章作废——**续写的产出没有被消费**。
- 建议方向：
  1. 三个失败点都要有明确的错误码出口，统一汇聚成"这一章为什么没写出来"，而不是分别落在控制台/编辑器文字/任务面板；
  2. `GENERATION_COMPOSITION_NO_PROGRESS` 至少在丢弃前把已有的 1112 字正文留下来（做草稿），让作者自己决定要不要；
  3. 续写结果必须参与 compose 的进展判定，否则续写等于白做。
- **[第 2 条已失效 2026-11-05]** 代码在（`:1710-1756` + `db:recovery-candidate-record` + `AIOutputPanel` 有入口），
  但**生产不可达**：条件是 `!mainOwned`，而 `mainOwned` 在生产恒为真（三个调用点都不注入 `dependencies`）。
  **2026-11-06 注**：该条件已按裁定 2=A 放开（见 [`d13-chapter-failure-contract-design.md`](../architecture/d13-chapter-failure-contract-design.md) §7.1）；以上为缺陷发现时的现场读数，保留作历史。
  问法要改成「唯一留候选的那条分支，生产不走」。→ 方案稿 §4.2
- **[第 3 条已失效 2026-11-05]** 续写产出**早已逐字参与判定**（`:2034` 的 `mergedDelta`）。第 3 次的真实路径是
  「续写内容被接受 → 走到 compose `:531` 才判没变长」，不是"没被消费"。→ 方案稿 §4.1
- **[第 1 条部分失效 2026-11-05]** 方向对，但范围写小了：不止三个失败点，是**正文层 10 处 + 主进程 4 处 + 组装层 4 处**，
  且码全在 message 里、不带 `code` 字段，跨 IPC 还会再丢一次。→ 方案稿 §2 / §2.1 / §5.4

---

## 第二轮实测（2026-11-01 23:00 – 2026-11-02 00:30）

> 本轮目标：把正文推到第二卷。结果：**第 1–9 章全部 `finalized`**（第 1 卷 6 章 + 第 2 卷前 3 章），字数 1319–1578。

### D12 定性修正：不是「校验太严」，是「短细纲写错了对象」

第一轮把 D12 归因于「蓝图与已定稿正文事件重叠」。第二轮取证推翻了这个说法，**真正的错位发生在短细纲环节**：

| 生成记录 | 短细纲实际内容 | 对应哪一章的剧情 |
|---|---|---|
| 第 2 章 · 第 3 次 | 「碑坪弟子吐纳；陈砚识海半块裂灵石发热，显现周七运功路径；路径第三转断缺节点…」 | **第 1 章** |
| 第 2 章 · 第 4 次（218 字强指导） | 「认身处碑坪青石地而非矿洞碎石；刘瘸子喊点卯扣灵配规则；陈砚查看日期石…」 | **第 1 章** |

第 2 章自己的蓝图写着「赵铎算盘声在风中响起说你身无分文当罚」「闸机红灯骤亮」，短细纲完全没碰。

**因果链**：`generate-draft.command.ts:1142-1144` 把上一章**定稿全文**喂给短细纲步骤（注释称"作者裁定给全文"），且 `chapter-materials.ts:622-624` 显示它是 `required` 来源、不参与 `budgetChars` 裁剪、注入两次（短细纲一次、正文一次）。`qwen3.5:9b-128k` 分不清「前驱材料」和「本章任务」，把上一章摘要成本章细纲 → 正文照错细纲写 → 写出第 1 章 → 重演校验拦下。

**模型对照实验（同一蓝图、同一段 218 字强指导）**：

| 模型 | 尝试次数 | 结果 |
|---|---|---|
| `qwen3.5:9b-128k` | 4 次 | 全部重演，全部被丢弃 |
| `deepseek-均衡` | 1 次 | **一次通过**，正文明写「闸机红了…二十息内不刷，红灯转黑」 |

结论：**D12 的可触发条件 = 小模型 + 上一章全文无结构分隔地注入**。强指导（明确"禁止回到铜锣、点卯、碑坪"）在小模型上完全无效 —— 指导是文字要求，上一章全文是具体文本，模型优先模仿具体文本（与既有红线「例子会被逐字抄成内容」同源）。

处置：第 2–9 章改用 `deepseek-均衡`、清空指导，8 章连续一次通过（首次触发即通过，无需重试）。**代码未改**。

### D14（高）卷结构三步全手动，无自动触发、无提醒 → `l3-handoff-missing` 是必然结果

> 状态：已实施（2026-11-02 · A+B 均已实机复验 · `00bac89e`）

**这一条推翻了第一轮的判断**（"第 1 卷没定稿所以第 2 卷大纲不能生成"）。实测：

| 表 | 第 1 卷 6 章全部定稿后 | 点「重建卷结构」后 |
|---|---|---|
| `volumes` | **0 行** | 6 行 |
| `volume_units` | **0 行** | 18 行（每卷 3 单元） |
| `volume_handoffs` | 0 行 | **仍 0 行** |

- 卷结构只存在于内存解析（`readVolumeStructure` 从 `core.plotStructurePlan` 现算），要落库必须由作者在「卷末交接」面板点**「重建卷结构」** → `db:volumes-rebuild`。全库唯一的调用点是 `VolumeHandoffRegistryPanel.tsx:269/293`，**生成流程从不调用**。
- `volumes.actual_last` 在 9 章定稿后**仍全部为 `null`** —— `db:volumes-mark-done` 同样只在面板里手动点，系统不会因为"这一卷的章都定稿了"而自动标记完成。
- 卷末交接（跨卷记忆）本来就是**作者手动登记**的（面板文案：「一卷写完后，把『下一卷必须承接的几件事』填在这里」）。
- 于是三步（建卷结构 / 标卷完成 / 登记交接）**全部依赖作者主动去一个面板操作，而系统在任何一处都不提示**。缺任意一步 ⇒ `l3-handoff-missing` 降级永久存在，第 N 卷大纲永远拿不到第 N−1 卷交接。

**这才是「提醒太弱」的根因**：降级标记本身是对的，但没有任何路径把"去卷末交接面板做三件事"送到作者面前。

#### 处置（2026-11-02，作者裁定 A+B：两步自动 + 缺口提前警告）

| 步 | 改前 | 改后 |
|---|---|---|
| 建卷结构 | 只有「卷末交接」面板手动点「重建卷结构」 | 架构写入路径里 `plotStructurePlan` / `synopsis` 一变就自动重建 |
| 推进 `actual_last` | 只有面板手动点「标记完成」 | 章节定稿成功后自动推进**该章所属的那一卷** |
| 登记卷末交接 | 手动 | **仍然手动** |

交接单为什么不自动生成：那一栏问的是「下一卷必须承接什么」，是作者的取舍判断；让模型代写等于再造一份摘要，而 L3 现在正是用卷计划摘要顶替的（作者已裁定"这个提醒太软"）。**自动化的边界停在「把状态建对 + 把缺口指出来」。**

落点：新增 `electron/services/volume-structure-sync.ts`，三个导出 —— `syncVolumeStructureFromCore`（建结构 + 对账）、`markVolumeProgressForChapter`（定稿推进一卷）、`refreshVolumeProgress`（全卷对账）。挂载点四处：`db:project-core-update`、`db:project-core-commit-generated`、定稿成功路径、`db:volumes-rebuild`。全部**失败吞掉不阻断主流程**（派生视图的维护不该把成功的主操作回滚成失败），但错误打到 stderr。

B 部分**不需要新代码**：`ChapterCreationDialog:595` 早就集成了 `VolumeHandoffGatePanel`，触发条件是 `readVolumeHandoffGate(...) !== 'clear'`；而 `volumeHandoffGateOf` 依赖 `volumes`，`volumes` 空就返回 `null`、完全不打扰 —— 这正是「状态从没建立」让提醒永不出现的机制本身。A 做完，B 自动生效。

**实机复验（2026-11-02 00:50–01:00，本项目）**

- 定稿侧：把第 9 章「退回草稿」再重新定稿（零生成成本），`volume:2`（7–10）的 `actual_last` 由 `null` → **9**，`actual_source='finalized'`，其余 5 卷一动不动。
- 回填侧：`volume:1`（1–6 章，6 章全在改代码之前就定稿）原本是 `null`。点一次「重建卷结构」→ **6**。这次实测把「只补事件不够」证实了：老项目的卷行是后建的，没有事件会再来一次，必须有一次性对账。
- **B 仍未实机复验**：卡在 `ChapterCreationDialog:311` 的权威章号闸 —— 目标章必须等于「定稿后的下一章」（当前 = 10），而卷交接闸只在 `volumeRangeEndingAt(volumes, N−1)` 有解时触发（即第 7 / 11 / 16 / 21 / 26 章）。要验第 11 章那道闸，必须先写完并定稿第 10 章、再生成第 11 章蓝图。
- **B 的复验（2026-11-02 12:10，本项目）**：点「写作第 10 章」，闸门**弹了** —— 但不是在第 11 章，而是在第 10 章，理由是「第2卷（第7–9章）只有一份模型初稿」。闸门本身工作正常（`volumes` 非空 ⇒ 它出现了，这正是 D14 说的"HANDOFF 面板早就集成、只是没数据"），**触发位置错了**：`actual_last=9` 把第 2 卷的有效末章前移成 9，于是第 10 章被算成第 3 卷首章。根因与修法见 **D19**。当场点了「取消，我先去处理」，未写任何确认记录（`consistency_exemptions` 仍为空）。
- **B 验收通过（2026-11-02 12:48，D19 修复后）**：写完并定稿第 10 章、生成第 11–12 章大纲与蓝图后，点「写作第 11 章」→「开始创作」，闸门弹出「上一卷的跨卷记忆还没确认 / **第2卷（第7–10章）**的卷末交接单是更早写的，之后上游已经改过了」，三个出口齐全。**触发点、区间、状态三处都对**。D14 至此 A+B 全闭环，详见 D19「处置」。

测试：`electron/services/__tests__/volume-structure-sync.test.ts` 13 条（自动落库 / 幂等不抄 `planned_last` / 无 core 返回 null / 定稿推进本卷 / 只推该卷 / **回填历史** / 对账幂等 / 空卷不抛 / 跨卷不串）；回归 `volume-structure-repository`(12) + `volume-handoff-repository`(14) + `volume-handoff-gate`(11) 全过；`tsc --noEmit` 干净。

### D15（中）第 2 卷单元区间重叠

> 状态：🟡 已实施（2026-11-05 · 检出器完成接线，待实机确认面板文案）

卷结构落库后读到的第 2 卷（计划 7–10 章）三个单元区间为 **7–9 / 8–9 / 10–10** —— 单元 1 与单元 2 在 8–9 章上重叠。第 1 卷（1–3 / 4–4 / 5–6）无此问题。后果：第 8、9 章归属哪个单元不唯一，按单元续写时的起点/终点判定会摇摆。

#### 实施记录（2026-11-05）

**先纠一处此前的记录错误**：本条原写作「D19 修完需复核」。D19 把卷末章从「实际优先」改成「计划优先」，那只作用于**卷边界**；第 2 卷的计划末章与实到末章同为 10，所以 D19 对这里**没有任何影响**，重叠不是 D19 的残留。

**复核结论（只读库副本实测）**：**仍重叠**。`volumes` / `volume_units` 实读 —— 卷 2 `planned 7–10`，三单元 `7–9`(headings) / `8–9`(even) / `10–10`(even)；第 8、9 章各落 2 个单元。

**两条成因**（都记了测试）：

1. `volume-structure.ts` 的 `buildUnits`：`headings` 分支（直接用观测区间）与 `even` 兜底分支（按整卷跨度均分）**并列互不扣减**。单元命中观测就拿观测值，后面的单元照旧按均分切，两者必然相交。
2. 观测区间按 `min`/`max` 聚合 ⇒ 它表达的是「这个单元**已写到**哪儿」，却被当成「这个单元**覆盖**到哪儿」。单元 1 的标题写到第 8 章时，即使第 8 章实际属于单元 2，单元 1 的观测区间也吃满整卷，后面 even 兜底的单元必然与它重叠。

**落地（只报，不夹紧、不阻断）**：

- `volume-unit-overlap.ts` 的 `findUnitOverlaps`（此前是未接线的纯函数）接入 `volume-structure.ts` 的 `unitOverlapWarnings()`，在**每卷建完时**核一次，产出 `VOLUME_UNIT_OVERLAP` / `VOLUME_UNIT_AMBIGUOUS` / `VOLUME_UNIT_INVERTED`，并入既有 `warnings` 通道 ⇒ 预览与重建都能带出来。
- **不夹紧**：重叠的多是 `headings`（作者真按这个归属写的标题），夹紧等于拿估算改事实 —— 与卷级 `VOLUME_OBSERVED_OUT_OF_RANGE`「只记告警，不夹紧」同一条纪律。
- **不阻断**：作者库现在就处于重叠状态，阻断会让「重新解析」直接不可用。
- 面板告警**按类别拆开**（新 `volume-warning-summary.ts`）。原先把整个 `warnings` 一律说成「观测与算出的区间不一致（大纲与实际不同步）」，混入单元重叠后会变成错误归因 —— 一个该查大纲进度，一个该改单元归属。

**未做**：没有改区间划分算法。真要消除重叠，得先定「观测区间能不能被后续单元扣减」这条口径（涉及「观测 vs 估算谁让位」），属结构性变更，不在本条范围内。

### D16（低）模型指示器与实际调用不一致

> 状态：待裁定（2026-11-01 · 未开工）

把创作对话框的模型切到 `our-free-model/deepseek-v4.1-flash-free` 后，主进程日志确认实际调用的正是该模型（`model: 'our-free-model/deepseek-v4.1-flash-free'`），但界面底部状态栏仍显示 `deepseek-均衡`。作者无法从界面判断这一章到底用了哪个模型。

### D17（中）生成路径提交大纲**不记覆盖章区间** ⇒ 下游失效退化为「整本大纲都改了」

> 状态：✅ 已实施（2026-11-05 · 方案 [`d17-outline-change-range-design.md`](../architecture/d17-outline-change-range-design.md) · **已实机复验**：单元批写第 18–19 章 ⇒ rev21 记 `[18,19]`，同步页不再列无关章，见该稿 §7.4）

**先说结论：机制本身是成功的（作者 2026-11-02 裁定）**。这一屏做对了四件事：认出对象（蓝图 3 / 交接单 1 / 已定稿 3，分三类列）、算出跨度（每条都写 `情节大纲 6 → 7`）、点名不可回头的那条（"其中含卷末交接单：它会被拒绝读取，下一卷会开不了工"）、给退路且守约（先取消一次，`upstream_revision_log` 里一位版本号都没动，rev 仍为 6）。

**实测也证明预演没夸大。** 提交第 10 章（只一章）大纲后，「同步」页列出的正是 **7 项需要处置**，与预演逐条对上。但每一行的理由是：

```
第 7 章  情节大纲 第6版→第7版（第7版 11-02 01:12 重新生成，改动章未知）
```

**"改动章未知"** 就是这条缺陷的落点。`commitSynopsis` 写修订流水时：

```ts
changedChapters: request.authorRecovery ? expandChapterRange(request.authorRecovery.committedRange) : []
```

`authorRecovery` 只在「恢复存稿」路径上有值 ⇒ **正常 AI 生成落盘一律记空集**。而判定侧 `changedChaptersBetween`（`src/shared/upstream-revisions.ts:668`）对空集返回 `null`，调用方按「拿不到可收窄的章集 ⇒ 按全改算」（`:749-750`）⇒ 第 7–9 章的蓝图、已定稿正文、第 2 卷交接单全部被拖进失效清单，尽管这次只动了第 10 章。

对照组：`upstream_revision_log` 里 rev 5 = `[1..6]`、rev 6 = `[7,8,9]` 是有章集的 —— 但那两次是**蓝图批量提交**（`blueprint-repository.ts:833` 把蓝图章号写进 `outline` 域），不是大纲提交。两条管道共用一个 `outline:book` 键，一条会记章集、一条不会，光看流水看不出差别。

**后果的量级**：每追加一批大纲 = 把此前所有已定稿章全部标脏。30 章时是一屏 7 条还能忍；300 章时就是「每次续写大纲都要人工忽略 290 条」。这也是长篇就绪度里「跨卷失真」的一个具体形状。

**修法（2026-11-05 已实施，方案见 [`d17-outline-change-range-design.md`](../architecture/d17-outline-change-range-design.md)）**：

① 请求加 `writtenRange`，由 `commitSynopsisWithCheckpointRollback` 从检查点算 —— 正常批用**实际**范围（`backfillUnitBatch` 回填后的 `to`），覆盖收缩时给到收缩前的 `covered_to`（被删的章一起标脏），中断落盘**不声称范围**（退回保守）。逐章路径 `runPlotOutlineChapters` 另接一处。

② 核查后发现**不需要新代码**：`upstream_revision_log.covers_all` 独立成列、`meta.coversAll` 折入、`describeRevisionChange` 的「全书 / 改过第N章 / 改动章未知」三分在 M27 就建好了。② 的诉求实际是「让 `coversAll` 说实话」的副作用 —— 写入侧补上范围之后，文案自然从「改动章未知」变成「改过第10章」。

**没做**：`outline:<unitId>` 单元级作用域（要迁存量 `source_ref` 键，已评估、不采纳）；历史 7 条空集记录不回填（真实范围当时没记，影响随 `(have, need]` 自然衰减）。

### D18（中）蓝图结尾钩子可无校验地偏离大纲「收尾：」行：条款互斥 + 自造设定 + 正文未兑现无告警

> 状态：已实施（2026-11-04 · 三环节合并登记；文案与六个校验纯函数均已接线，C1 重跑权限未开放 —— 作者 2026-11-05 裁定继续只报，见 [`prompt/d18-chapter-hook-contract-design.md`](../prompt/d18-chapter-hook-contract-design.md) §11.15）

> 作者 2026-11-02 裁定：三个环节（钩子怎么写 → 能不能偏离 → 有没有落地）**合并成一条登记**，因为它们同属一根链条，单修任何一环都会被下一环绕过。

**现象**：第 6 章蓝图 `suspense_hook` = 「第一道因果纹灼烧皮肤带来的寿元透支危机已无法逆转」（结论句），而大纲该章收尾行是画面：「李执事黑笔划过考课簿，墨迹未干，赵铎的尸身已化作灰骨散在风里」。第 5、7 章同位置都逐字照搬了大纲收尾，只有第 6 章另起炉灶；第 6 章正文里 `寿元` 0 次、`因果纹` 0 次 ⇒ 钩子从未落地。

**先排除两种误判：不是审查，也不是事后改写。**

| 检查点 | 读数 |
|---|---|
| `generation_artifacts` rowid 117（run `fd6f4edc`，purpose `chapter-blueprint-directory`） | 第 6 章 `purpose` / `keyEvents` / `suspenseHook` 与库中**逐字一致** |
| 该产物 `usage_receipt_json` | `operationId: directory-f348fe27-…-1-6`、`payloadHash: c3cad8da…`，与 `blueprint_commit_operations` 那条 `replace-range 1–6`（`committed_at 2026-11-01 14:12:43`）一致 ⇒ 这条产物就是落库的那条 |
| 生成状态 | `finishReason: "stop"`、`httpStatus: 200`、`endReason: "completed"`，无截断、无重试 |

**真因是两条条款互斥。** 蓝图模板 `chapter_blueprint_chunk`（`builtin-prompt-templates.ts:1165`；项目 `.ai-novel/prompts/` 下**没有**蓝图覆盖版，走的是内置版）同时下了两条命令：

1. 「若情节大纲该章末尾有「收尾：」行，`suspenseHook` **必须落在这行已点明的那个未决项上** —— 不得换成另一个悬念」；
2. 「`suspenseHook` 只写「本章结束时仍未决的那个问题/威胁/代价」，**它不是事件**，不得复述、摘要或改写 `keyEvents` 的任何一条」。

第 6 章的收尾行「尸身已化作灰骨」恰好是一个**已完成的事件** ⇒ 两条命令正面冲突，模型只能二选一，它选了第 2 条。而 `src/shared/blueprint-semantic-contract.ts` 的合同句「即使本章没有谜团，也要写明一个制造推进压力的**具体未决决定、威胁、揭示或后果**」——「后果」一词直接给「XX 已无法逆转」这种结论句发了合法身份。

**对照组（同模板、同位置）：**

| 章 | 大纲「收尾：」 | 蓝图 `suspense_hook` | 表现 |
|---|---|---|---|
| 5 | 算盘声再次响起，李执事手中的笔悬在半空，未落下判罚墨迹 | 李执事手中的笔悬在半空，未落下判罚墨迹 | 逐字照搬（只裁掉前半句） |
| 6 | …赵铎的尸身已化作灰骨散在风里 | 第一道因果纹灼烧皮肤带来的寿元透支危机已无法逆转 | **另起一个悬念** |
| 7 | 王会计的笔尖在"异常波动"栏停顿，墨迹未干 | 同（画面句） | 照搬 |

差异点只有一个：**第 6 章的收尾行里有一具尸体**。这个相关性指向「模型在事件展开时把『杀』降级成『封喉』」——`keyEvents` 三条逐条摘的是大纲正文（封喉 / 踩胸 / 记黑名单），**唯独没写赵铎死**，而 `purpose` 里「亲手了结赵铎」原文保留着（模板强制照抄）。样本 1 例，够不上「审查」的定性。

**附带的第二宗：钩子自造设定。** `寿元` 是模型加的机制——全书大纲第 6 章只写「因果纹彻底灼烧皮肤，换来筑基荐额资格」，没有「寿元」这个概念。而钩子会经 `withSuspenseHook()` **单独成块**注入正文请求（`generate-draft.command.ts`，还特意从 `chapter_info` JSON 里 `dropSuspenseHook` 保证只出现一次），等于当作者事实发下去。

**正文为什么也没兑现**：第 6 章正文（`drafts` 15:58:00 生成，1578 字）`寿元` 0 次、`因果纹` 0 次、`尸身` 0 次，结尾写的是「暗红的线从虎口往上爬了两指宽…他掐了一下。皮肉底下没知觉」。全库搜不到任何「钩子是否兑现」的检查（`钩子兑现` / `hookFulfill` 均无命中）⇒ 钩子与正文静默脱节，**无任何告警**。

> 方向更正：`blueprints.notes` 里那句 `[钩] …连掐两次` 是 **15:58:25** 由要点提取**从正文倒推**的（正文 15:58:00 生成，25 秒后写），所以方向是「正文 → notes」，不是「正文照着 notes 走」。notes 不是蓝图旧版遗留，也不是替代钩子的指令来源。

**修法方向（三条都要，不锁实现）**：

① **拆互斥**：把「不得是事件」限定在「收尾行没点名该事件时」；收尾行本身是事件时，允许钩子写「该事件造成的未决后果」。两条条款各让半步，不再让模型二选一。
② **提交时加落点校验**：`suspense_hook` 与大纲该章「收尾：」行的实词交集为空 ⇒ 提交/落库时给警示（**不阻断**，因为合法的"另起悬念"也可能存在）。
③ **定稿后加兑现标记**：`suspense_hook` 的关键实词在正文 0 命中 ⇒ 在定稿卡片或检查面板提示「本章钩子未落地」，作者可改钩子或知悉放行。

### D19（高）`actual_last` 被当成卷末 ⇒ 卷边界随进度漂移，开写闸门提前一章弹、交接单漏掉本卷最后一章

> 状态：已实施（2026-11-02 · 方案甲 · `c9dade26`）

**发现于 D14 B 的实机复验（2026-11-02 12:10）**：点「写作第 10 章」时闸门弹了，但它说的是「第2卷（第7–9章）只有一份模型初稿，还没经你确认」——第 10 章本身就是第 2 卷的章（`volume_units` 的 `unit:2:3` = 10–10），不该在这里问跨卷记忆。

**证据链（四步，每步都可复算）**

| # | 事实 | 出处 |
|---|---|---|
| 1 | `volume:2` 计划 7–10，`actual_last=9`（D14 A 定稿推进写入） | `volumes` 表 |
| 2 | `volumeEffectiveRanges` 的末章取 `actual_last ?? planned_last` ⇒ 第 2 卷有效区间变成 **7–9** | `src/shared/volume-structure.ts:285` |
| 3 | 起点 = 上一卷有效末章 + 1 ⇒ 第 3 卷起点被推成 **10** | 同文件 `:284` |
| 4 | 闸门判「上一卷」= `volumeRangeEndingAt(volumes, 10-1)` = 以 9 结尾的那卷 = 第 2 卷 ⇒ 弹 | `src/shared/volume-handoff-gate.ts:63` |

**这不是闸门的错**。`volumeEffectiveRanges` 注释写得很明确：「末章 = `actual_last ?? planned_last`：**实际优先，因为它是事实**」——在 P1-2 期 1b 里，`actual_last` 的语义是**作者手填的「这卷实际到第几章结束」**（`actual_source='author'`）。D14 A 新增 `actual_source='finalized'`（每定稿一章就推进），把「**进度**」写进了「**末章**」字段。一个字段两种含义，判定侧就必然读错。

**三个连带后果（按严重度）**

1. **交接单漏掉本卷最后一章**：`finalize()` 内部判卷末章时 `actual_last` 还没推进（`markVolumeProgressForChapter` 在 `finalize()` 返回**之后**才跑，`finalization-controller.ts:65`），第 10 章定稿时 `volume:2` 有效末章仍是 9 ⇒ 第 10 章不判为卷末 ⇒ 交接单停在「7–9」。现存那份（`handoff:0eb52c6c`，`created 2026-11-01T16:56:28Z`）`open_thread` 写的是「月底两本簿子对账这一关还没过」——**那正是第 10 章的钩子**，说明它是以第 9 章为末章生成的。
2. **开写闸门提前一章弹**：第 10 章被算成第 3 卷首章。更要紧的是 `VolumeHandoffGatePanel` 的「已人工复查，继续」会写 `consistency_exemptions`（`volume-handoff:volume:2`），而闸门对已确认的卷**永久放行** ⇒ **真正该弹的第 11 章不会再弹**。频次设计（一卷一次）因此失效：提示出现在错的章上，对的章上反而没有。
3. **面板区间随进度漂移**：第 2 卷显示「7–9」而不是「7–10」，与 D15 的单元区间重叠同源——`unit:2:1`(7–9) / `unit:2:2`(8–9) / `unit:2:3`(10–10) 只有在「卷 = 7–10」时才对得上。

**修法方向（三选一，待裁定；不锁实现）**

| 方案 | 做法 | 代价 |
|---|---|---|
| **甲（推荐）** | 边界回计划：`last = plannedLast ?? actualLast`，`actualLast` 只作进度；`basis='actual'` 仅在计划值缺失时出现 | 改 1 行 + 注释；4 处判定侧（闸门 / 定稿卷末 / 大纲进度闸 / 交接单区间）自动修正；2 处展示侧要改成读 `range.actualLast` 显示「已写 9 / 计划 10」 |
| 乙 | `last = max(plannedLast, actualLast)` | 本 case 修好；但「计划 10 章、作者决定 9 章收卷」时边界永远停在 10，交接单永不生成（要作者去面板手动补） |
| 丙 | 进度另开 `progress_last` 列，`actual_last` 回归「实际卷末」 | 语义最干净；要 schema 迁移 + 过 `PROJECT_CORE_NON_CONTENT_COLUMNS` 与 `VERSION_BOOKKEEPING_COLUMNS` 两处黑名单 |

**修完后必须做的数据修复**：第 2 卷那份交接单要重新生成一次（现内容是 7–9），否则第 10 章的跨卷事实仍然缺位。

#### 处置（2026-11-02，作者裁定方案甲）

| 项 | 改前 | 改后 |
|---|---|---|
| `volumeEffectiveRanges` 末章 | `actual_last ?? planned_last`（进度覆盖边界） | `planned_last ?? actual_last`（计划优先，计划缺失才用实际兜底） |
| `basis` | 有 actual 就报 `actual` | 只有**边界来自 actual**（计划缺失）时才报 `actual` |
| 面板区间文案 | `第7–9章 · 估算`（被进度改写） | `第7–10章 · 估算（已写 9）`（边界 + 进度分开写） |
| `VolumeDefinition.actualLast` 注释 | 「唯一事实：只由标记完成写入」 | 「已定稿章的最大章号（进度）；`finalized` = 定稿链推进、`author` = 面板手点；**不参与边界**」 |

四处判定侧（开写闸门 / 定稿卷末章 / 大纲进度闸 / 交接单区间）**零改动**，全部因为共用 `volumeEffectiveRanges` 而自动修正。

**实机复验（2026-11-02 12:20–12:48，本项目，链路一次跑通）**

| 时点 | 动作 | 读数 |
|---|---|---|
| 12:20 | 点「写作第 10 章」 | **闸门不弹**（修前在这里误弹「第2卷 7–9」），直接进创作对话框 |
| 12:24 | 生成第 10 章正文 | 1520 字，`drafts.id=21` |
| 12:32 | 定稿第 10 章 | `volume:2.actual_last` 9 → **10**，其余 5 卷不动 |
| 12:33 | （定稿后处理） | 卷末交接单**重新生成**：`source_ref` `outline:book 8`、`open_thread` 改为以第 10 章收尾（"陈砚承诺月底之前…多一行字"）。**修前它会停在 7–9** |
| 12:37 | 生成第 11–12 章大纲 | outline `rev 8 → 9`，交接单 `source_ref=8` ⇒ 此后应为 `stale` |
| 12:47 | 生成第 11–12 章蓝图 | 大纲覆盖到 12，蓝图 10 → 12 章 |
| 12:48 | 点「写作第 11 章」→「开始创作」 | **闸门弹出**：「第2卷（**第7–10章**）的卷末交接单是更早写的，之后上游已经改过了…」 |

最后一行的三处细节都是证据：**区间是 7–10**（修前是 7–9）、**触发在第 11 章**（修前提前到第 10 章）、**状态是 `stale` 而不是 `unreviewed-draft`**——因为生成第 11 章大纲把 `outline` 推到了 rev 9，而交接单基于 rev 8，`stale` 判定优先于「已确认」正是 P2-2 期 2 的设计（ADR-0026 同类）。当场点了「取消，我先去处理」，未写 `consistency_exemptions`。

测试：`volume-structure` 的「actual 优先」两条改写为「进度不改边界」，新增「进度不推下一卷起点（7–10 / 已写 9）」「计划缺失才用 actual 兜底」两条；`volume-handoff-gate` 新增 D19 回归一条（第 10 章不弹 / 第 11 章弹且区间 7–10）；`volume-handoff-repository` 的「写超不提前给单」改写为「进度不推边界」。共 62 + 39 + 4 条全过，`tsc` 干净。

**残留文案（2026-11-02 22:38 补修）**：交接单面板底部那句说明当时还写着「末章优先用**实际末章**（标记完成时取该卷已定稿章的最大章号）」——与修好后的行为正好相反，作者读到会以为进度还能改边界。**这条是派给豆包做重构时它顺手报出来的**（详见 `docs/agents/doubao-channel.md` §7.1），已改成「末章用计划边界，只有老项目没有计划值时才退回实际末章兜底」。

> 教训：D19 改的是**函数与测试**，但同一句话在三个地方存在——`volume-structure.ts` 注释、测试用例名、**界面文案**。前两处跟着代码走，界面文案不会。改语义类缺陷时，「库里还有谁在复述这条旧语义」要单独搜一遍（搜关键词而不是搜符号）。

### D20（高）生成模板一变，旧大纲检查点就续不上，而报错断言「项目源事实已变化」

> 状态：已实施（2026-11-05 · 本体 + D20b 均已合并；判定侧残留另开 D20c，见方案稿 §4.7）。**实机验证未做**：作者 2026-11-06 裁选项③（成本不划算），定位路径见方案稿 §8.3
> 方案稿：[`../architecture/d20-checkpoint-template-fingerprint-design.md`](../architecture/d20-checkpoint-template-fingerprint-design.md)

**发现于 D17 实机复验（2026-11-05 20:05）**：续批被拒，报文说「项目源事实自上次生成后已变化，既有大纲不能与新的源事实拼接」。逐字段核对后发现**源事实一个都没变**。

**证据链（四步，每步都可复算）**

| # | 事实 | 出处 |
|---|---|---|
| 1 | 指纹由 4 段拼成：11 个源事实字段 · 步骤指导 · 批次范围 · **`JSON.stringify(template)`（整对象）** | `architecture.command.ts:1124-1150`，4 元组在 `:1144-1149` |
| 2 | 两处判定都只拿到「不等」这一个布尔值——32 位哈希是单向的，**比对时已不可能知道是哪一项变了** | `:3133`（续写）/ `:3240`（续批） |
| 3 | 但两处报文都只认第 1 元；`:3135` 还加了「（故事前提/角色/世界观/总章数等）」，把视线钉在恰恰没变的字段上 | `:3135` / `:3242` |
| 4 | **同一文件的世界观链点了「模板」这一项**（但只列 3 项，漏了步骤指导） | `:2334`（对照 `:2326-2331`） |

**实测真因**：换了数据根 ⇒ `resolvePromptTemplate('synopsis', …)`（`:3020`）解析出的模板不同（原环境有全局覆盖版 `~/.vela/prompts/synopsis.zh-CN.json`，新环境走内置）。诊断值为 `stored=13sbmpn / expected=tkj9w7`；**12 个源事实字段逐字段 sha256 与原库完全一致**（清单见方案稿 §1.1）。

**这条为什么排到最前**：作者原话——「开发者倒是可以调查到真实原因，但对于使用者来说，抠破脑袋都找不到这个真实的原因，只会以为自己的写作材料变化了，但其实根本没有变化。」**换数据根 / 换机器 / 改模板都会撞上**，而作者的所有可选动作只有一个：全书大纲重写。

**已经付出的代价**：

| 代价 | 出处 |
|---|---|
| **红线 19**：「大纲输出合同必须走 `withSystemSuffixOverride()`，否则 A/B 两个项目的检查点全部作废」——这句「必须」**直接由指纹逼出** | `chapter-position-format-design.md:99` `:108` `:360` `:372` |
| 两次输出合同变更**因此不能改内置模板**，只能走渲染期字符串手术（**注意：这两处 override 各有独立理由，不是为躲指纹才存在**；指纹决定的是它们的实现形态） | `prompt-builder.ts:18-29` · `synopsis-two-level-suffix.ts:4-19`（真实输出合同 bug）· `synopsis-unit-heading.ts:4-12`（补标题归属） |
| 设计稿把它写成硬约束 | `choice-source-and-elimination-design.md:138` · `d18-chapter-hook-contract-design.md:441` · `prompt-assembly-backlog.md:457` · `layered-generation-assessment.md:360-368` |
| 同一条错误结论被复述 4 处（1 处**用户可见** + 3 处代码注释） | `ArchitectureConfirmDialog.tsx:792`（**在预告一条具体报文**）· `ProjectTree.tsx:610` · `project-clear-service.ts:166` · `arch-step-checkpoint.ts:12-13` |

**修法方向**：**不是改文案，是让判定侧具备归因能力。** 新增 `synopsisInputFingerprintParts()`（与现函数并列，`combined` 必须逐字等于现返回值），**只落两个短哈希：源事实 + 模板**（②步骤指导、③批次范围在比对时恒等，存了也是死分支），判定侧逐项比、按 `drift` 出报文；旧检查点走诚实兜底（「无法判断是哪一项」，而不是「源事实变了」）。

⚠️ **两个必补的名单**（漏了会打坏回滚）：`SYNOPSIS_CHECKPOINT_FIELDS`（`architecture.command.ts:192-204`，管 commit 失败后的恢复）与 `SYNOPSIS_CHECKPOINT_KEYS`（`synopsis-unit-launch.ts:179-193`，管重置与级联清空）。

**裁定（2026-11-05）**：**裁定 1 选 A —— 只有模板变化时允许续写**（放行 + 一条不阻塞提示，不静默）。反对意见「模板变化可能是结构性的，会让同一份大纲并存两套格式」**被知情接受**，但要求写进提示文案。**裁定 2：旧检查点（无新字段）也放行，不逼全书重来** —— 新项目一律用新检查点，旧检查点只存在于已有项目与实机验证项目里。**遗留一问**：世界观链要不要一起改（成本已实读：写入 1 处 / 删除 1 处 / 判定 1 处 / 候选保存后重算 1 处、无字段名单；收益小一个量级——世界观重来只要一次调用，不像大纲要全书重写）。

**与 D4 的边界**：D4 说「没有一处把中止和文案关联」；本条说「关联起来的那一处说的是错的」。修好本条 D4 才有可信的归因数据可用，但 D4 不因此关闭。

> **这条的稿子被独立复核打回过一次**（写入点标签写反、4 项分项里 2 项不可达、漏两个名单、世界观链"四项全列"不成立、影响面夸大）。修订记录在方案稿 §11。**教训：这条缺陷本身是"报错误诊"，而给它的方案稿第一次也犯了同类的错——自己写的方案需要别人来核对它在引用什么。**

### D8 的现场实锤（2026-11-02）

同一个对话框里还有一行：

```
未按单元生成：检查点里有未完成批次（synopsis_incomplete=true）：中断续写语义未定，本次走按章区间
```

即 E3 的「点一次 = 一个单元」在**本项目当前状态下降级成了按章区间**，原因是上一批大纲没跑完留下了 `synopsis_incomplete=true`。这与 D8「检查点残留导致模式自动降级，提示藏在段落里」完全对上，可以作为 D8 的复现步骤：跑一批大纲 → 中途停 → 再打开对话框 → 单元探针必然降级。

### 附：`qwen3.5:9b-128k` 下的失败代价量化

- 第 1 章：11 次生成记录（含多次重试），最终定稿的那版（"碎石打在面门"，闸机口对峙）**与它自己的蓝图（铜锣炸醒→碑坪点卯→账房门槛）完全不吻合**，属于运气躲过校验，不是按蓝图执行。
- 第 2 章：4 次生成记录全部重演失败。
- 首次生成即通过所需条件：换模型（`deepseek-均衡`）+ 清空指导。
