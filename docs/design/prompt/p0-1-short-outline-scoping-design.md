# P0-1 小设计稿 · 短细纲只喂该步材料

> 上位稿：`docs/design/prompt/prompt-payload-scoping-design.md`（§5 矩阵第 8 行、§5.5 第 3 行、§7 B-3）。
> 本文只覆盖 P0-1 一项，不重述上位稿全文。按项目惯例：**先出小设计稿、经作者过目后再编码**。

---

## 0. 一句话结论

短细纲（`chapter-draft-short-outline`）这一步现在把**整份初始生成 prompt** 当输入——实测 **16,736 字**，其中**正文形态与远端设定约 1.07 万字**（全书设定池 5,049 / 参考作品 3,071 / 文风要求 1,492 / 全局写作要求 315 / 篇幅合同 165 / 单章生成要求+AI 味反制 ~700）。

改为只喂「**本章蓝图 JSON + 前驱状态 + 本章执行合同**」，预计 **16,736 → 1,200–4,000 字（降 76%–92%）**。

改动只落在 `generate-draft.command.ts` 一处构造点；**主进程、恢复链路、正文步骤零改动**（理由见 §3.2）。

---

## 1. 现状取证

### 1.1 代码锚点（逐条核实）

| 事实 | 锚点 |
|---|---|
| 短细纲的输入 = `prompt`（初始正文 prompt） | `generate-draft.command.ts:939` `const outlinePrompt = draftShortOutlinePrompt(writingLanguage, prompt)` |
| `prompt` 的组成 | `:934-938` = `chapterMaterials.text` + `promptBuilder.build()` + `authorItemsFallback` + `chapterLengthContract` |
| 短细纲**唯一一次** LLM 调用：**只有一条 user 消息，没有 system** | `:1108-1112`（对比正文步骤 `:1152-1155` 是 `[system, user]` 两条） |
| `promptBuilder.build()` 装了哪九块 | `:797-817`（architecture / global_guidance / writing_style / reference_works / novel_config / chapter_info / user_guidance + 模板正文 + systemSuffix + required 兜底） |
| 短细纲产物被拼回**正文** prompt（所以正文不受影响） | `:1121` `const initialPrompt = shortOutline ? \`${prompt}\n\n${draftShortOutlineBlock(...)}\`` |
| 短细纲产物哈希进恢复指纹 | `:942-943` `materialDecision.shortOutlinePromptHash` |
| 恢复时的身份自校验 | `:1124-1128`（哈希不等 → `GENERATION_DRAFT_SHORT_OUTLINE_IDENTITY_CHANGED`） |
| 材料装配（8,000 字预算） | `:876-896`；渲染结果 `chapter-materials.ts:770` |
| 上一章结尾摘录（≤1,000 字） | `chapter-materials.ts:369-378`、`:223` |
| ⚠️ `previousEnding` 算了但**没进任何 prompt** | `:944` 算出，仅 `:1267` 跨章复用检查用；`withPreviousEnding('')` 在 `:847` 被显式清空 |
| 主进程重试**回放已存任务**，不重建 prompt | `main-generation-owner.ts:162-179`（`readFailedShortOutlineTask` 取 `usage_replayTask`） |
| `replayTask` 落库的前提已满足 | `main-generation-owner.ts:611`（含 `materialDecision?.shortOutlinePromptHash`） |

### 1.2 载荷构成（实测，非估算）

来源：`docs/design/prompt/prompt-trace-output-sample.md`（真实生成数据重渲染，`第 1 章`、`组装后长度：11279 字`）。对 `build()` 骨架按 `【】` 区块切分：

| 区块 | 字数 | P0-1 是否该给短细纲 |
|---|---|---|
| `【全书设定池】`（architecture，已含 `synopsisSettingSectionsForDraft` 投影） | **5,049** | ❌ 剥离 |
| `【本章信息】`（chapter_info = 本章蓝图 JSON） | **641** | ✅ **主料** |
| `【全局写作要求】`（global_guidance） | **315** | ❌ 剥离（P0-2 的分区对象） |
| `【网文"黄金第一章"创作法则】` | 92 | ❌ 剥离 |
| `【文风要求】`（writing_style） | **1,492** | ❌ 剥离 |
| `【参考作品】`（reference_works） | **3,071** | ❌ 剥离 |
| `【单章具体生成要求】`+`【AI 味反制】`（systemSuffix） | ~700 | ❌ 剥离（正文形态纪律） |
| 补充写作 Skill / required 兜底 / 尾部块 | ~200 | ❌ 剥离 |
| **build() 小计** | **≈11,279** | 只留 641 |
| `chapterLengthContract`（【本章篇幅合同】） | 165 | ❌ 剥离（短细纲不定稿） |
| `chapterMaterials.text`（≤8,000 预算：作者资料 / 后续计划边界 / 定稿原文 / 参考） | 不定 | 🔶 **只取前驱那一块**（见 §2） |
| 短细纲指令本身（`draftShortOutlinePrompt`） | ~260 | ✅ 保留 |

> 交叉印证：`16,736 ≈ 11,279（骨架）+ ~5,000（材料）+ 165（篇幅合同）+ 260（指令）`，量级一致。
> 另在续写请求里实测 `【本章篇幅合同】` 165、`【本章蓝图】` 666、`【有来源的历史与候选】` 90 —— 说明这些块确实是**每步各拼一份**，不是共享载体。

### 1.3 为什么必须改（两个机制性理由，不是"省 token"）

1. **「指令即行为」**：短细纲调用**没有 system 消息**，模型看到的唯一输入 = `指令 + 整份正文写作材料`。材料里全是*正文*形态纪律（黄金第一章法则、文风 30+ 条、AI 味反制、篇幅合同、输出纯文本且段落间空行）——**输入的形态在教它写正文**。实测输出 **1,747 字散文**，这不是模型不听话，是载荷在误导。
2. **需求与供给倒挂**：这一步标称只需要「本章目标 + 前驱状态」，实际付了 11,279 字模板 + 全部材料。**这是全链路"需求列最少、注入最多"最极端的一处**（上位稿 §5 矩阵读法）。

---

## 2. 目标载荷（契约）

| 块 | 内容 | 来源（现成构件） | 必需 |
|---|---|---|---|
| ① 指令 | `draftShortOutlinePrompt` 原文（保留） | `shared/draft-short-outline.ts:6` | ✅ |
| ② 【本章信息】 | 本章蓝图 JSON（chapterNumber/title/role/purpose/characters/keyEvents/suspenseHook） | `toBlueprintProjection(writerChapterInfo, { dropUserGuidance: false })`（`:295`） | ✅ |
| ③ 【前驱状态】 | 上一章定稿终态 | 待裁定（§6-2）：`consumedFinalizedSources` 里 `chapterNumber = n-1` 的 `.content`，或 `chapterMaterials.previousEnding` | ✅ |
| ④ 【本章执行合同】 | `chapterExecutionContractText().rules`（321 字：作者任务受原文含义 / 本章可推进 / 前驱已定稿事实优先 / 事件兑现 / 操作边界） | `:462`（现只进 `systemRole`，短细纲拿不到） | 待裁定（§6-3） |
| ⑤ 【后续计划边界】 | 后续章节**事件**边界 | 待裁定（§6-1）；全文在 `chapterMaterials.text` 的【作者资料】块内 | 待裁定 |

**剥离清单**（不进短细纲）：全书设定池、参考作品、文风要求、全局写作要求、黄金第一章法则、篇幅合同、systemSuffix 全部、知识库参考、可选材料覆盖缺口、定稿候选（非前驱）。

**预估结果**：`② 641 + ③ ≤4,000 + ④ 321 + ① 260 ≈ 1,200–4,000 字`，对基线 **16,736 降 76%–92%**。

---

## 3. 实施方案

### 3.1 改动面（1 个文件，3 处）

`src/services/workflows/commands/generate-draft.command.ts`：

1. 新增 `composeOutlinePrompt()`（与 `composeInitialPrompt` 并列，`:934` 附近）：按 §2 契约拼块；
2. `:939` 改为 `const outlinePrompt = composeOutlinePrompt()`，**不再由 `prompt` 派生**；
3. `:1108-1112` 与 `:1124` 的哈希计算沿用同一 `outlinePrompt` 变量 —— **无需改动**（两端同源）。

`src/shared/draft-short-outline.ts`：加一个分区包装函数（如 `draftShortOutlineScopedPrompt(language, blocks)`），把 `【本章信息】/【前驱状态】/【本章执行合同】` 的标题与指令拼装收在共享层——**便于单测断言"不含正文形态区块"**。

### 3.2 为什么主进程与恢复链路不用改（已核实）

- **重试**：`generation:retry-draft-short-outline` 回放 `usage_replayTask`（`main-generation-owner.ts:162-179`），原任务整份存在库里 → 不重建 prompt。
- **哈希校验**：主进程只校验 `textHash(userPrompt) === decision.shortOutlinePromptHash`（`:540`）——两侧同源，改了什么都能过。
- **指纹绑定**：`replayTask` 已因 `shortOutlinePromptHash` 存在而落库（`:611`），不依赖 prompt 内容。
- **正文步骤**：`prompt` 本身**不变**（短细纲只是从它派生出来的那一份被替换），`:1121` 拼接逻辑不变 → 正文请求逐字不变。

### 3.3 不改什么（YAGNI 边界）

- **不动 `keyEvents` 结构**。上位稿 §5.5 的 `OutlineContract` 要求 `keyEvents: Array<{id, event, estimatedUnits}>`；但**本步不消费 `estimatedUnits`**（短细纲只要事件清单），按 §8-7"无读取点者不立项"→ 结构化留给 lane 六步那一轮，**P0-1 不依赖它**。
- **不改 `shortOutlinePromptHash` 机制**（继续每 run 一份）。
- **不改 `systemRole`**（那是正文步骤的合同，短细纲用的是 user 侧块 ④）。
- **不改 `assembleChapterMaterials` 的 8,000 预算**（容量结算是为正文做的；本步只是不消费它的全部产物）。

---

## 4. 风险与红线

1. **短细纲质量可能变化（本轮唯一实质风险）**。缓解：保留 ③ 前驱终态 + ④ 执行合同；验收看「输出是否仍是 ≤6 条清单、是否落到本章目标」。
2. **跨版本 resume**：prompt 变了 → 用**旧代码**中断但未结束的 run 在新代码下恢复会报 `GENERATION_DRAFT_SHORT_OUTLINE_IDENTITY_CHANGED`。这与"改模板会让进行中的 resume 失效"同性质，**属既有行为**；实施时须重启 `pnpm dev`（`src/` 非组件模块），且不跨版本恢复中断 run。
3. **不得顺手改正文**。`prompt` 与 `systemRole` 必须逐字不变——验收含"同 run 的 `chapter-draft` 请求与改动前逐字相同"。
4. **不许让模型自报账目**（上位稿 §8-3）：短细纲只做计划，**不**承担"已覆盖事件"统计；编号/覆盖仍由代码算。

---

## 5. 验收标准

| 项 | 标准 |
|---|---|
| 输出形态 | 仍是 ≤6 条清单，不出现正文段落（人工看实机 trace 的该次 output） |
| 载荷 | 实机 trace 的短细纲那次 user message：**不含** `【全书设定池】`/`【参考作品】`/`【文风要求】`/`【全局写作要求】`/`【本章篇幅合同】`/`【AI 味反制】`；字数较 16,736 降 ≥70% |
| 正文不受影响 | 同 run 的 `chapter-draft` user message 与改动前**逐字相同** |
| 单测 | 新增 1 例：断言短细纲请求含 本章蓝图 JSON + 前驱块，且**不含**正文形态区块 |
| 回归 | `prompt*` 全组 + `generate-draft.command.test.ts` 全绿；`tsc --noEmit` / `eslint` 0 错 |

---

## 6. 待作者裁定（★ 3 项，不裁定无法开工）

| # | 问题 | 选项 | 我的建议 |
|---|---|---|---|
| 6-1 | **【后续计划边界】给不给短细纲？** 上位稿 §5 矩阵第 8 行标 D ❌；但短细纲若不知道后续边界，可能把后续事件排进本章计划，而计划会作为块进正文请求 | ① 完全不给（最省）② 只给一句硬约束「本章计划不得写入后续章节的事件」（不给后续剧情原文）③ 给全文（最忠实，但会把后续剧情喂进"计划"步骤——**这正是实测 16,736 字里"第 2 章信息"的来源**） | **②**：保住防越界语义，不给剧情泄漏面 |
| 6-2 | **【前驱状态】给多少** | ① 上一章定稿**全文**（忠实；短细纲要判断"前驱已完成的事"，结尾往往不够）② 结尾摘录 `previousEnding`（≤1,000 字，现成且**目前未被任何 prompt 使用**）③ 两者都给 | **①**（②作为兜底：无前驱定稿时用 `previousEnding`） |
| 6-3 | **【本章执行合同】rules（321 字）给不给** | ① 给（短细纲与正文共用同一套"不得把计划说成事实 / 前驱已定稿事实优先"纪律）② 不给（只靠短细纲自己的指令句） | **①** |

### 6.1 作者裁定（2026-10-13）★ 本节为准

| # | 裁定 | 作者原话 |
|---|---|---|
| 6-1 | **不给**（后续计划边界全文与硬约束**都不给**） | 「我认为已有蓝图，不应该再多给信息」 |
| 6-2 | **① 前驱给上一章定稿全文** | 「①」 |
| 6-3 | **给** | 「这个应该是要给的」 |

→ 落地契约 = **本章蓝图 JSON + 上一章定稿原文 + 本章执行合同**，此外不喂任何东西。
→ 并附一条要求：「**最后还要看实际效果评估**」——故本轮只到"改完 + 单测/回归通过"，**提交与后续取决于实机效果**。

---

## 7. 实施记录（2026-10-13，已完成）

### 7.1 改动（3 个文件 + 2 个新测试）

| 文件 | 改动 |
|---|---|
| `src/shared/draft-short-outline.ts` | 新增 `DraftShortOutlineMaterial` 契约 + 重写 `draftShortOutlinePrompt(language, material)`：块序固定「指令 → 本章蓝图 → 前驱状态 → 本章执行合同」，`predecessor`/`executionContract` 缺省即整块省略；指令拆成 `INSTRUCTION_CORE`（纪律）+ `INSTRUCTION_SCOPE`（**明说本步不给全书设定与正文形态要求**）。`draftShortOutlineBlock` / `stripDraftShortOutlineBlock` **逐字未动**（主进程校验与剥离依赖它们）。 |
| `src/services/workflows/commands/generate-draft.command.ts` | `:939` 不再由 `prompt` 派生；改 `composeOutlinePrompt` 内联装配三块。前驱取 `chapterMaterials.consumedFinalizedSources` 中 `chapterNumber = n-1` 的 `.content`（**定稿全文**），首章或前驱未定稿时退回 `previousEnding`（≤1,000 字结尾摘录）。`previousEnding` 声明上移一行。`prompt` / `systemRole` **逐字未动**。 |
| `src/shared/__tests__/draft-short-outline.test.ts` | **新增** 9 例：块序、**不含任何正文形态区块**（9 个块头逐一断言）、无前驱/无合同即省略、en-US 英文标签、材料逐字透传、以及 `draftShortOutlineBlock`/`stripDraftShortOutlineBlock` 的往返回归。 |
| `src/services/workflows/commands/__tests__/generate-draft.command.test.ts` | 既有 ch2 用例加 P0-1 载荷断言（`【本章蓝图】`/前驱全文/执行合同**在**；全局基调/文风/参考作品/世界设定**不在**，且**必须都在正文请求里**——否则断言只是"夹具里本来就没有"）；新增 1 例「前驱给全文而非结尾摘录」（用 >1,000 字前驱 + 开篇标记，`previousChapterEnding` 会丢掉它）。 |

### 7.2 必须顺手修的一处既有测试（**不是**代码缺陷）

`does not locally reject a 30K prompt when lease context evidence is unknown` 原按**序号**取 `completeWithLease.mock.calls[0]`，而 `calls[0]` 恰好是**短细纲**——P0-1 后它从 >30K 掉到 **661 字**，于是断言 `>30_000` 假红。该用例的真实意图是「正文请求约 30K 不被本地拒发」，故改为**按 `purpose === 'chapter-draft'` 取**（并留注释说明为何不能按序号取）。

> 这条例外值得记住：**P0-1 会让"以前最大的那个请求"变小**，凡是用"第一个/最大请求"做断言的地方都要重新定位。

### 7.3 校验结果

| 项 | 结果 |
|---|---|
| `draft-short-outline.test.ts`（新） | **9/9** |
| `generate-draft.command.test.ts` | **211/211** |
| `prompt*` 全组 + `src/shared` | **640/641**（1 红 = `novel-contracts.test.ts`，**stash A/B 同为红 → 既有**） |
| `src/services/workflows` | **1076/1105**（3 红文件与改动前**完全一致**：`finalize-postprocess-character.integration` + `planning-material-binding` = `better-sqlite3` 原生模块版本不符〔环境〕；`plot-outline-batch.command` 11 例 = 既有期望漂移，本会话早前已 `git stash` A/B 验证相同） |
| `tsc --noEmit` | **0 错** |
| `eslint`（4 个改动/新增文件） | 3 个干净；`generate-draft.command.ts` 报 :300 `_userGuidance` 未使用 —— **既有**（stash A/B 同报，且不在本次 diff 内，属 `toBlueprintProjection` 的历史写法），未动 |

### 7.4 未做（按裁定与 YAGNI）

- 未给【后续计划边界】（裁定 6-1）；未动 `keyEvents` 结构化；未动主进程与恢复链路（**已核实无需改**）。
- **已提交**：`14fc64c` `feat(prompt): 短细纲只喂该步材料（P0-1）`（与 P0-2 在同一文件上的改动按 hunk 级拆分，可独立 revert）。

---

## 8. 实机评估要点（作者要求「最后还要看实际效果评估」）

重启 `pnpm dev`（**改的是 `src/` 非组件模块，不重启不生效**）后跑一章，按下面三条看：

1. **载荷**：`debug/prompt-trace/` 那次的短细纲 user message 应只剩三块，长度**从 16,736 量级掉到千字量级**；且**不含** `【全书设定池】`/`【参考作品】`/`【文风要求】`/`【全局写作要求】`/`【本章篇幅合同】`/`【AI 味反制】`。
2. **输出形态**：短细纲应回到 ≤6 条清单，不再出 1,700 字散文。
3. **正文不受影响**：同 run 的 `chapter-draft` 请求应与改动前逐字相同（验收里含这一条）。

### 8.1 实机结果（2026-10-13 21:23，作者重跑第 1 章正文）

样本：`国运怪谈直播-新版副本/debug/prompt-trace/20261013-212223-290-正文-ch1-a495f9c6.{md,json}`
（目录内**仅此一对**；本次只跑正文链，故**无大纲/蓝图 trace**。）

| 项 | 改前 | 改后 | 结论 |
|---|---|---|---|
| 短细纲请求 user | 16,736 字（整份初始正文 prompt） | **1,336 字** | ✅ 省 92% |
| 其中：蓝图 / 执行合同 / 指令+声明 | — | 667 / 320 / 349 | 与契约一致 |
| 越界材料（设定池·文风·参考作品·篇幅合同·AI 味反制·全局写作要求·后续计划边界） | 全有 | **全无** | ✅ |
| 短细纲输出 | ~1,747 字散文 | **553 字 / 5 条**（原目标·前驱·时点约束·行动结果·结尾状态） | ✅ 形态正常 |
| 注入正文的短细纲块 | ~1.8K | **588 字**（= 输出 553 + 注入器前置句 35） | ✅ 顺带瘦身 |
| 正文请求 | — | `system 563 + user 17,524`；块序完整；`【后续计划边界】` 仍在 | ✅ 未被殃及 |
| 正文产出 | — | 2,936 字（合同区间 2,550–3,000） | ✅ 落区间内 |
| 文件名 | 一次作用域多份半成品 | `20261013-212223-290-正文-ch1-a495f9c6` | ✅ 一份文件 |

三点补充口径：

1. **第 1 章无前驱 → 前驱块正确省略**（走 `previousEnding` 兜底亦为空），短细纲自身在"前驱/起始状态"栏自陈"本步未给独立前驱"。**前驱给全文这条（裁定②）尚无实机样本**，需跑第 2 章及以后才能验。
2. **「注入块 == 模型原输出」不成立**：注入器会加 35 字前置句（"仅用于组织原目标；作者事实、约束和实际前文优先，计划不确立任何事实。"）。比对时勿直接判"不等即坏"。
3. ⚠️ **大纲章节段那条（`declareTraceScopeChapterRange`）本轮无法验证**（无大纲 trace）；要看到 `-大纲-chN-M-` 需另跑一次大纲生成。

**一条留给后续观察（非缺陷）**：本章蓝图的 `keyEvents` 已是**整章情节流水**（含结尾"零点零三分敲门三下"），故短细纲实质是**对 `keyEvents` 重新分栏**，边际信息量来自"分栏 + 纪律"而非"提炼"。若要它真正提炼，需从上游 `keyEvents` 数据形态入手（P0 之外）。另：短细纲**仍只有 user 消息、无 system**——本轮证明载荷瘦身后形态即正常，加 system 属可选加固。

---

## 9. 证据与口径说明

- 载荷构成数据取自 `docs/design/prompt/prompt-trace-output-sample.md`（**真实生成数据重渲染**，不是估算）；该样本是**第 1 章**那次生成，且按文件头注释只完整录到最后一次调用。
- **未在本次取证中复现 16,736 字那条 trace**（作者已清理旧 trace，现场目录为空），故 16,736 采用上位稿 §7.0.2-R3 的记录值；实施后须以**实机前后对比**替换为自测数字。
- 本次取证为**只读**：未改动任何源码，未触碰作者项目数据。
