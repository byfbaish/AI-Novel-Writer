# P1-3 实施级设计稿：L1 变量出口语义化（`acceptsScopes` / `enforceRequiredContext`）

> 上级稿：`docs/design/prompt-payload-scoping-design.md`（§6 L1 / §7 表 P1-3 行 / 附录 A / 附录 D / §11 清单两项）。  
> 状态：**待作者裁定**（D1–D4 见 §8）。本稿只取证 + 判定 + 提替代，**未动一行代码**。  
> 版本：**v2**（2026-10-16。采纳同行评审：① 结论**分述**（`acceptsScopes`=抽象层级错 / `enforceRequiredContext`=语义混淆+适用边界），不合并；② 新增 §3.1 适用边界；③ 新增 §7.1 全量消费点扫描；④ C1 补 A/B 两解法；⑤ 可观测性收窄为"先做 `projection` 元数据"）。  
> 取证源：① 内置模板静态审计（esbuild 打包 `builtin-prompt-templates.ts` 后跑，见 §10）；② 作者项目 20 份全局覆盖版；③ 实机 trace 21 份 / 18 个 snapshot（`C:\develop\workspace\AI-writer\每天第一句谎话都会成真\debug\prompt-trace\`）。

---

## 0. 一句话结论

上级稿 P1-3 要「让白名单真正生效」，落给两个字段：`acceptsScopes`（按作用域层过滤变量）与 `enforceRequiredContext`（关掉 required 兜底注入）。**三条独立取证一致指向：两者都不该按原设计实施 —— 但"不该实施"的原因不同，不可合并成一句。**

- **`acceptsScopes`：抽象层级错误**。真实需求是"按变量自身结构切"（P1-2a 按 `### 3` 标题切 `architecture`），而它设计的是"按作用域层切"（G/A/D/C/S）。**两者层级不同 ⇒ 无论项目跑到哪一步都不会有消费者**（所有"某步骤不该吃某层"的场景，已由 P0-1 / P0-2 / P1-1 / P1-2a 四个具体投影函数逐一落地）。且对 `architecture` 这种 `G+A+D` 混合变量，按主层过滤**只有 0/100 两档**（剥则违红线 8-1、留则与现状一模一样），而 P1-2a 证明有价值的恰是**中间态**（按节 13.1%）。踩上级稿 §8-7（YAGNI）。
- **`enforceRequiredContext`：语义被上级稿混淆 + 适用边界未标注**。它**不是**抽象层级错 —— 相反，它是有明确功能的机制（§2.4：覆盖版漏引用时把权威设定补回正文末尾的**位置纠错器**），只是**作用于兜底通道、不作用于模板引用通道** ⇒ "关掉它让白名单生效"属错配。当前兜底 **0 触发**（内置 25 / 覆盖版 20 / 实机 18 snapshot），关掉 = 拆安全网（负价值）。⚠️ **结论有适用边界**：0 触发的前提是**内置 `systemSuffix` 恒引用 `{{architecture}}`/`{{novel_config}}`**（`:1036`/`:1113`；`render-prompt.ts:11` 恒取内置、不可覆盖）⇒ **若未来修改 `systemSuffix` 引用策略，须重新评估本判定**（§3.1）。

**建议**：D1/D2 均**不立项**（保留设计待触发），**P1-3 重定义为「可观测性」**（附录 D 的 `projection` 元数据；`VELA_PROMPT_SCOPE=off` 与 §6 L3-(c) 按需再补，见 §6）—— 它是 L1 设计里**唯一有真实消费者（作者本人）**的部分，且成本最低。

---

## 1. 上级稿原定的 P1-3 是什么

| 位置 | 原文 |
|---|---|
| §6 L1 | 给 `PromptTemplate` 加可选字段：`acceptsScopes?: MaterialScope[]`（缺省 = 全接受）/ `enforceRequiredContext?: boolean`（缺省 true = 旧行为）；配套改 `appendRequiredPromptContext`「当步骤声明不接受某层时，required 兜底也不追加」 |
| §7 表 | 「**P1-3** L1 变量出口语义化 + `enforceRequiredContext` ？让'白名单'真正生效 ？中（碰模板契约测试基线）」 |
| 附录 A | 一张 24 行的「变量 → 作用域层」映射表；用法「`acceptsScopes` 判'要不要'（按主层）；`projectXxx` 判'给多少'（按附加层切分）」 |
| §11 清单 | 未勾选两条：①「附录 A 的映射表与 §5 矩阵不矛盾（每步 ✅ 的变量，其主层必须在 `acceptsScopes` 内）」；②「改动前后跑 `prompt-language-contract` / `prompt-local-qwen-contract` 基线对照」 |

⚠️ 注意上级稿自己写着「**必须先核对契约测试基线**」——即 P1-3 在立项时就知道它会碰基线，属"先有结论、后补取证"的一类。本稿补的正是**它立项前的必要取证**。

---

## 2. 取证：兜底机制（`appendRequiredPromptContext`）的实际触发面

**机制回顾**（`src/shared/render-prompt.ts:5-29`）：内置模板声明 `requiredContextVariables`；若**覆盖版 `content` + 覆盖版 `taskGuidance` + 内置 `systemSuffix` 三处都没引用**某 required 变量，则把它作为「【自定义模板未引用但仍必须遵循的权威项目设定】」追加到正文末尾。

### 2.1 证据一 · 内置侧：25 个模板，**0 个**会触发

对每个内置模板算「`required` 里有、但自己的 `content`/`taskGuidance`/`systemSuffix` 都没引用」的集合：

```
=== 内置模板审计（zh-CN）===
内置模板数: 25
内置侧会触发兜底的模板数: 0
```

⇒ **内置模板自己全都引用了自己声明的 required**。兜底对内置是死代码（除非覆盖版来触发）。

### 2.2 证据二 · 覆盖版侧：作者项目 20 份，**0 个**触发

按源码语义（`referencedSources = [覆盖版 content, 覆盖版 taskGuidance, 内置 systemSuffix]`）逐份复核：

```
=== 覆盖版审计（作者项目，20 份）===
  -  chapter_blueprint_chunk  required=[novel_architecture,chapter_list,number_of_chapters,n,m,global_guidance,genre,pacing_guidance] → 无兜底
  -  character_dynamics       required=[premise,genre,protagonist_profile,golden_finger,world_building,number_of_chapters,global_guidance,reference_works] → 无兜底
  -  edit_selected_text       required=[edit_instruction,selected_text] → 无兜底
  -  first_chapter_draft      required=[architecture,novel_config,global_guidance,writing_style] → 无兜底
  -  generate_novel_config_field required=[existing_config] → 无兜底
  -  next_chapter_draft       required=[architecture,novel_config,global_guidance,writing_style] → 无兜底
  -  premise                  required=[...11 项...] → 无兜底
  -  synopsis                 required=[premise,character_dynamics,world_building,genre,number_of_chapters,word_number,plot_structure_guide,narrative_pov,global_guidance] → 无兜底
  -  world_building           required=[premise,genre,core_setting,golden_finger,protagonist_profile,global_guidance,reference_works] → 无兜底
覆盖版侧会触发兜底的模板数: 0 / 20
```

**为什么正文两个模板不触发**（最关键的个案）：覆盖版 `next_chapter_draft` 的 content **不引用** `{{architecture}}`/`{{novel_config}}`，`first_chapter_draft` 的 content **不引用** `{{novel_config}}` —— 但内置 `systemSuffix`（`builtin-prompt-templates.ts:1036` / `:1113`）写着：

```
【不可偏离的作者事实】
- 故事架构：{{architecture}}
- 小说配置：{{novel_config}}
```

⇒ 第三个来源（内置 systemSuffix）把它们引用了 ⇒ **兜底不追加**。`systemSuffix` 不可被覆盖（`editable:false`，恒取内置）⇒ **这两个变量在正文链上"改不动也丢不掉"**：作者删掉 content 里的占位符无效（systemSuffix 兜着），`enforceRequiredContext` 也无对象可拒绝。

### 2.3 证据三 · 实机 trace：18 个 snapshot，**0 个** `required-context` fragment

trace 侧已把兜底段显式建模（`prompt-trace.ts:219-237`，`sourceKind: 'required-context'`，label「系统补回的权威项目设定」）。把全部 21 份 trace 的 18 个 snapshot 跑一遍：

| 事实 | 读数 |
|---|---|
| 出现的 fragment 类型 | 仅 `override-content` / `override-taskGuidance` / `override-systemRole` / `builtin-content` / `builtin-systemRole` / `builtin-systemSuffix` |
| `required-context` fragment | **0 次** |

⇒ 三条独立证据互相印证：**兜底机制在本项目是"哑火的安全网"**。

### 2.4 但兜底**曾经**是真通道（P0-2 史实，不可推翻上文结论）

P0-2 取证记过一例：`world_building` 的 `reference_works` **原本由兜底供应**（"并非零注入，而是位置不对"），当时把它写进覆盖版 `content` 后，兜底不再触发 —— 这与 §2.2 的"现在 0 触发"**一致且互为因果**。

⇒ 兜底的真实语义 = **「作者覆盖版漏引用时，把权威设定补回正文末尾」的位置纠错器**。它是**功能**，不是**缺陷**。

---

## 3. 判定 A：`enforceRequiredContext` **不立项**

| 面 | 分析 |
|---|---|
| 有无消费者 | **无**。没有任何步骤需要"拒绝兜底"（§2.3：本来就不触发） |
| 实施它的后果 | 若将来某覆盖版漏引用 → **静默丢内容**（不再补回）→ 与红线 8-1「投影≠裁剪，正文需事实源可查」直接冲突 |
| 与红线 16 的关系 | 红线 16 说 `requiredContextVariables` 会**穿透**覆盖版生效（既是手段也是风险）。但 P1-2a 已核清：**穿透只发生在"覆盖版没引用、且内置也没引用"时** —— 而 §2.1 证明内置全引用 ⇒ 穿透面**仅剩自由文本类小变量**，其中 `world_building` 的 `reference_works` 已被 P0-2 治好。**"关掉兜底"治的不是这个病** |
| 结论 | **不立项**。若要保留，应记为「将来新增 required 变量时的开关」，而非本阶段动作 |

> ⚠️ **一个容易被误读的点**：`enforceRequiredContext` 听起来像"把不想要的层拒掉"，但它作用于**兜底通道**而非**模板引用通道**。模板里写着 `{{architecture}}` 的步骤，无论开关怎么设，`architecture` 照样进请求。所以它**根本不是"让白名单生效"的工具**。上级稿把两者并列（§6 L1 同一段），是本项立项依据的最大混淆源。

### 3.1 结论的适用边界（评审追问 1 采纳）

上述判定基于**当前 `systemSuffix` 结构**：兜底 0 触发，是因为内置 `systemSuffix` 恒引用正文链的 required 变量。**这一结构是判定的前提，不是偶然**：

- `render-prompt.ts:5-18` 的 `referencedSources = [覆盖版 content, 覆盖版 taskGuidance, **内置 systemSuffix**]`；`systemSuffix` 由 `builtinTemplate?.systemSuffix ?? ''` 取得（`:11`）⇒ **恒取内置、不可被覆盖版改写**（`editable:false`）。
- ⇒ 若把 `builtin-prompt-templates.ts:1036`/`:1113` 的 `- 故事架构：{{architecture}}` / `- 小说配置：{{novel_config}}` **改为不引用**，而覆盖版 content 也不引用 ⇒ 兜底**会被立即激活**（红线 16 的"穿透"场景复活）。

**故"不立项"必须附明确限定**：*「本判定基于当前 `systemSuffix` 引用结构（内置恒引用正文 required 变量）。若未来调整 `systemSuffix` 的引用策略，须重新评估 `enforceRequiredContext` 的语义与必要性。」* —— 这不是推翻结论，是**把适用边界画清**。⚠️ 注意此限定**只适用于 `enforceRequiredContext`**，与 §4 的 `acceptsScopes`（抽象层级错）**无关** —— 后者是方向性错误，不存在"未来翻转"。

---

## 4. 判定 B：`acceptsScopes` **不立项**

### 4.1 它的四个潜在消费者，全部已被具体投影函数取代

上级稿 §5 矩阵里标 ❌（"该剥离"）的行，逐条对照现有落点：

| §5 矩阵行 | 上级稿设想由 `acceptsScopes` 解决 | **实际已落地的落点** | 状态 |
|---|---|---|---|
| 第 8 行 短细纲（❌ G/A/D/C 全） | 按层剥 | **P0-1**：根本不拼整份 prompt，改喂「本章蓝图 JSON + 上一章定稿 + 执行合同」（载荷省 92%） | ✅ 已解决 |
| 第 5/6 行 大纲/章纲的**自由文本**（❌ 正文格式纪律） | 按层剥 | **P0-2**：段级标签 `【适用：架构/大纲/正文】`（`text-scope-tags.ts`），6 处注入点 | ✅ 已解决 |
| 第 10 行 续写 `future_blueprints` | 降级/剥离 | **P1-1**：`toBoundaryNotice` 降级为「本章不可写事件」清单（省 65%） | ✅ 已解决 |
| 第 9 行 正文 `architecture` 的远期段 | 投影 | **P1-2a**：`withArchitectureDraftProjection` 按模板固定标题整节边界化（省 5.2% user） | ✅ 已解决 |

**⇒ 每一个真实场景都是"按变量自身结构切"，而不是"按作用域层切"。** 这正是 §6 L2 用**具体函数**（`projectArchitectureForDraft` / `toBoundaryNotice`）而不是通用过滤器的原因。

### 4.2 为什么通用层过滤对最大的那个变量无效

`architecture`（正文链 6,854 字 → P1-2a 后 5,958）在附录 A 里主层 = `G`，附加层 = `A`/`D`。`acceptsScopes` 的判据是**主层**：

- 若某步骤声明"不接受 `G`"→ `architecture` 整块不进 ⇒ 正文没了 `【不可偏离的作者事实】` ⇒ **违反红线 8-1**（上级稿自己写着"正文里必须保留术语/禁则/基调"）；
- 若声明"接受 `G`"→ **整块进**，与现状**一模一样**，零收益。

⇒ 对 `architecture`，`acceptsScopes` **只有"0 或 100"两档，没有中间态** —— 而 P1-2a 证明有价值的恰恰是中间态（按节 13.1%）。

### 4.3 YAGNI 红线（上级稿 §8-7）的直接适用

> 「契约第一版只定义'下游必须消费的字段'，**无读取点者不立项**。」

`acceptsScopes` 需要：① 一张 24 行映射表落地成代码；② 每个模板按 `G/A/D/C/S` 声明接受层（25 内置 + 20 覆盖版，覆盖版还**不参与渲染决策**——红线 16）；③ 渲染器按层过滤。**三份工程量，零个消费者。** 且它会新增一类回归风险（见 §9）。

---

## 5. 反方证据（我复核过，且不足以推翻 §3/§4）

诚实列出三条与"不立项"相左的观察：

| # | 观察 | 我的复核 |
|---|---|---|
| R1 | §5 第 11a 行（精修）实测吃 `global_guidance` + `writing_style`（`G` 层），矩阵标 ❌ | ⚠️ §3-`:104` 的判据写着「**指令型合同**（格式/红线/停止点）不适用"删掉会不会写错"的判据」。`writing_style`/`global_guidance` 正是指令型 ⇒ **矩阵的 ❌ 本身可疑**。且 §5 第 11c 行还抱怨"修稿后风格易漂移，因为**缺** `writing_style`" ⇒ **自相矛盾**。不构成 `acceptsScopes` 的正当消费者 |
| R2 | §5 第 11b 行（审稿）吃全量 `world_building`（实测 `review-chapter.command.ts:71` `.withWorldBuilding(frozen.worldbuilding)`，**无投影**） | ✅ **这是真的候选**，但解法是**投影**不是层过滤 ⇒ 见 §7 候选落点。 |
| R3 | 「将来加新变量（知识库类）时 `acceptsScopes` 会有用」 | ✅ 合理 ⇒ 故建议**保留设计、标注"待触发"**，而不是删除。**"保留"与"现在实施"是两件事。** |

---

## 6. 推荐形态：P1-3 重定义为「可观测性」（P1-3′）

上级稿 §6 的三个 L 里，**唯一有真实消费者（作者本人）且成本最低**的是 L3-(c) 与附录 D：

| 项 | 上级稿原文 | 消费者 | 成本 |
|---|---|---|---|
| **附录 D** | `prompt-trace` snapshot 加 `projection?: { variable, beforeChars, afterChars, droppedSections }`；投影函数返回值带这份元数据 | 作者（判"投影到底有没有生效、剥了什么"） | 低 |
| **附录 D 附** | 开关 `VELA_PROMPT_SCOPE=off`（关投影、全量注入），用于同章 A/B 对照 | 作者 + 回归测试 | 低 |
| **§6 L3-(c)** | trace 里标注「这段材料属于哪层、本步是否需要」——**让作者自己看见**，不自动改 | 作者（上级稿原话：「测试期间很多时候过了一天都迷茫」） | 低 |

> **范围收窄（评审建议 3 采纳）**：三项中**先只做附录 D 的 `projection` 元数据** —— 它最直接回答"这一步为什么带/不带这段"。`VELA_PROMPT_SCOPE=off` 与 §6 L3-(c) 的 trace 作用域标注**按实际需要再补**（甚至可分批）。理由：后两者是**附加能力**，且 `VELA_PROMPT_SCOPE=off` 会让"同一项目存在两种行为"（对照复杂度），先不做可把**行为变更面收到最小**（= 纯诊断元数据，零行为变更）。

**为什么它是 `acceptsScopes` 的正确替代**：`acceptsScopes` 想给的"让白名单生效"，作者其实需要的是**"看得见为什么带/不带"**。可观测性以 1/10 的成本给到同一份认知，且**零行为变更**（不改任何请求内容 ⇒ 不碰契约测试基线 ⇒ P1-3 原先唯一的"高风险"标签消失）。

**已具备的地基**（本项不是从零开始）：
- `prompt-trace.ts` 已有 `fragments[]`（含 `sourceKind` / `resolvedFrom` / `label` / `editalbe` / `note`）⇒ 加 `projection` 字段是**扩展既有 schema**；
- 已有 `prompt-trace-markdown.ts` 离线渲染 ⇒ 元数据可直接呈现；
- 已有 `P1-2a` 的 `withArchitectureDraftProjection`（fail-open、可返回元数据）与 `toBoundaryNotice` 两个现成投影点。

---

## 7. 候选落点（若作者仍希望"继续收载荷"）

按"有真实收益 + 现有机制无法覆盖"筛，只有一处：

| 候选 | 现状 | 设想 | 风险 / 需裁定 |
|---|---|---|---|
| **C1. 审稿链的 `worldbuilding` 投影** | `review-chapter.command.ts:71` 全量 `frozen.worldbuilding`（作者项目 6,210 字，**含 §3 终局谜底**）；`refine-from-review` 无 `worldbuilding`（符合 §5 第 11c 行） | 把 `withArchitectureDraftProjection` 接到审稿链（剥 §3 远期节），与 P1-2a 同形 | ⚠️ **两面性**：剥掉 §3 可避免"拿终局当事实要求正文兑现"；但不剥才能判"是否提前剧透了远期真相"。**必须作者裁定**，不属显而易见 |

**C1 的两面性有两个解法**（评审追问 2 补充，2026-10-16）：

| 解法 | 形态 | 代价 | 与项目范式的契合 |
|---|---|---|---|
| **A. 审稿分两次** | 第一次用**投影版 §3**（只留 §1 当期规则）判"正文是否违反规则"；第二次用**完整 §3** 判"是否提前剧透远期真相" | **2× LLM 调用**（审稿成本翻倍），职责最清晰 | 需新增一次调用编排 |
| **B. 保留完整 §3 + 合同声明** | 审稿仍吃完整 §3，但在**执行合同**（非 prompt 措辞）里写明"以下内容含远期设定，**用于判断是否提前剧透，不得作为事实要求正文兑现**" | 低（只改合同文本） | **与 P1-2a 同形**（保留材料 + 合同声明），而 P1-2a 的【远期设定边界】已实机验证该组合有效 |

> 判定依据：P1-2a 的 `030b8be7`（审稿"拿断言当事实"）证明**模型确实会把材料当事实要求**，所以解法 B 必须是**合同级**约束（软措辞不够）；但同一批修复也证明"保留材料 + 合同声明"的组合**有效**。故 **B 的可行性与范式契合度均高于 A**，代价低一个数量级。

> 📌 其余 §5 矩阵标 ❌ 的行（正文/续写仍带 worldview/文风/参考）**不是缺口** —— 那正是红线 8-1「投影≠裁剪」明确保留的（正文需事实源可查）。C1 之外，我未找到第二个有真实收益的落点。

### 7.1 全量消费点扫描（评审建议 4 的验证，2026-10-16 补）

评审建议"C1 之外再扫一遍其他消费点"（`refine` / `finalize` / 导入反向提取链是否吃全量 `architecture`）。逐链核验（`grep` + 逐文件读 prompt 装配）结果：

| 链 | 是否吃全量 `architecture` / `worldbuilding` | 落点 / 证据 | 结论 |
|---|---|---|---|
| `refine-from-review.command.ts:95-100` | **否** | 只注入 `reviewReport + globalGuidance + userRefinePrompt` | 非缺口 |
| `refine-draft.command.ts:68-79` | **否** | `globalGuidance + writingStyle + userRefinePrompt` | 非缺口 |
| `finalize-chapter.command.ts:287-292` | **否** | `PostProcessPromptBuilder`：`chapterContent + chapterNumber + existingCards` | 非缺口 |
| `review-revision-command.ts` / `-materials.ts` | **否** | 不走 `PromptBuilder`（是数据/材料选择层，落 `review-revision-materials`） | 非缺口 |
| `import-novel.command.ts` / `import-inference-contract.ts` | **否** | 反向提取**产出方**（写库）+ schema 校验，不作材料注入 | 非缺口 |
| `directory.command.ts:374`（章节蓝图链） | 吃，**但已投影** | `renderBlueprintArchitecture(按章范围)` + `withSpaceConstraints`（注释明写"必须在投影之后套"） | 已覆盖 |
| `architecture.command.ts:1813 / 2154 / 2439`（弧光 / 大纲 / 章纲） | 吃全量，**属设计必要** | 规划须**全知**设定（埋线不能不知道终局），故**不应投影**；已套 `withSpaceConstraints` | 非缺口（**勿当 C1 同类**） |
| **`review-chapter.command.ts:71`** | **吃全量、无投影** | `.withWorldBuilding(frozen.worldbuilding)` | **C1 = 唯一缺口** |

⇒ **建议 4 的怀疑被证伪**：C1 之外**无第二处缺口** ⇒ 支撑"C1 另立小项"（只一处，不值得立通用机制）。

⚠️ **同时新记录一处易误判点**：`architecture` 产出侧三处吃全量 `worldbuilding` 是**设计前提**（产出侧需全知才能规划伏笔），**不是遗漏** —— 后人扫描时不应把它与 C1 并列为"未投影缺口"。**判据 =「这一步的产物是给人读的正文，还是给下一步用的规划？」** 前者才需要投影。

> 📌 **C1 登记（2026-10-16 裁定 D4①）**：C1 **不并入本轮**，**另立小项**（入口 = 本稿 §7；若启动，推荐**解法 B**）。

---

## 8. 裁定项（作者）

| # | 项 | 选项 | 建议 |
|---|---|---|---|
| **D1** | `acceptsScopes` | ① **不立项**（保留设计、标注"待新增变量时再触发"） / ② 实施 | **①** |
| **D2** | `enforceRequiredContext` | ① **不立项**（兜底 0 触发，关掉=拆安全网） / ② 实施 | **①** |
| **D3** | P1-3 是否重定义为「可观测性」（P1-3′，§6） | ① **是**（做附录 D 的 `projection` 元数据 + `VELA_PROMPT_SCOPE=off`，§6 L3-(c) 视情） / ② 否（P1-3 直接结项，主线只剩 P1-2b） | **①** |
| **D4** | §7 候选落点 C1（审稿链投影 §3） | ① **另立小项**（不进本轮） / ② 现在做（若做，走 **解法 A** 分两次审稿 / **解法 B** 保留完整 §3 + **合同级**声明，见 §7） | **①**（若 ②，推荐 **解法 B**） |

### 8.1 裁定记录（作者，2026-10-16）

作者裁决「**按建议来**」⇒ D1–D4 **全部按建议执行**：

| # | 裁定 | 落地 |
|---|---|---|
| D1 `acceptsScopes` | **不立项** | 上级稿 §7 表 P1-3 行标注；§11 两条 `acceptsScopes` 项作废 |
| D2 `enforceRequiredContext` | **不立项** | 同上；§3.1 适用边界（systemSuffix）写入本稿 |
| D3 P1-3 重定义 | **「可观测性」** | ✅ **已实施**（见 §9.1）：`projection` 元数据落地，零行为变更 |
| D4 C1（审稿链投影 §3） | **另立小项** | 登记为独立小项，不进本轮 |

**同行评审采纳记录**（本轮）：**采纳 4 项**（§3.1 适用边界 / §7 C1 两解法 / §6 可观测性收窄 / §7.1 全量消费点扫描）；**校准 1 项**（评审 §二 把两字段合并表述为"抽象层级错误"—— 对 `acceptsScopes` 成立、对 `enforceRequiredContext` 不成立，已改**分述**）；**证伪 1 项**（评审建议 4 怀疑"C1 之外还有缺口"—— 全仓扫描证明 **C1 唯一**）；**补正 1 项**（评审追问 3 猜 P1-2b 需手工标 **40** 条 —— 实测 **15** 条）。

⇒ **主线 P1 系仅剩 P1-2b**（产出侧期次结构，15 条标注量，三形态待选）。

---

## 9. 影响面与成本（供裁定参考）

**若 D1/D2 裁 ②（实施）**：碰 `prompt-language-contract.test.ts`（191 行，`REQUIRED_CORE_KEYS` 22 项 + `placeholders()` 断言）与 `prompt-local-qwen-contract.test.ts`（603 行，变量出口期望表）；`acceptsScopes` 还需给 25 内置模板逐条声明接受层 ⇒ 契约测试期望表**成批重写**。这是上级稿标注"风险：中"的来源。

**若 D1/D2 裁 ①、D3 裁 ①（本稿建议）**：

| 面 | 预期 |
|---|---|
| 会打红的测试 | **无**（新增 trace 字段为可选 ⇒ 向后兼容；`VELA_PROMPT_SCOPE=off` 默认关闭） |
| 需改的文件 | `src/services/prompts/prompt-trace.ts`（snapshot 加 `projection?`）+ `prompt-trace-markdown.ts`（呈现）+ 两个投影函数的返回值 + `prompt-trace-writer.ts`（如序列化需登记） |
| 新增测试 | trace 元数据 1 文件（正向 + fail-open + 关闭开关三例） |
| 红线自查 | 零 DDL；未动 `requiredContextVariables`；未改任何**请求内容**（只加诊断元数据）⇒ **不触发红线 16**；不改模板正文 |

---

### 9.1 实施记录（D3 落地，2026-10-16）

| 面 | 实际落地 |
|---|---|
| 新增 | `src/shared/prompt-projection.ts`（`PromptProjectionNote` 类型 + kind 枚举 + 口径说明） |
| 投影函数 | `architecture-projection.ts` 加 `projectArchitectureForDraft(): { text, projection }`（`withArchitectureDraftProjection` 保留为**兼容 wrapper**，零破坏）；`chapter-boundary.ts` 加 `buildBoundaryNotice(): { text, projection }`（`toBoundaryNotice` 保留 wrapper） |
| trace | `prompt-trace.ts`：`PromptTraceSnapshot.projections?` + `notePromptProjection()` side-channel + `recordFragments` 吸附（消费后清空） + `resetPromptTrace` 清空 |
| 落盘 / 呈现 | `prompt-trace-writer.ts` payload 带 `projections`（仅非空时，旧文件形状不变）；`prompt-trace-markdown.ts` 新增「变量投影」区块（改写前后字数 + 省下比例 + 被边界化的块） |
| 调用点 | `generate-draft.command.ts`：`architecture` / `future_blueprints` 两处投影后 `notePromptProjection` |
| 测试 | 新增 `src/services/__tests__/prompt-projection-trace.test.ts`（10 例：投影元数据 4 + trace 吸附 4 + markdown 2） |
| 验证读数 | tsc **0**；目标测试 **30/30**；下游 `generate-draft.command` + `chapter-materials` **273/273**；trace 四文件 **53/53** |
| 红线自查 | 零 DDL；未动 `requiredContextVariables`；**未改任何请求内容**（只加诊断元数据）⇒ 不触发红线 16；未改模板正文 |

---

## 10. 附：取证命令与读数

```bash
# ① 打包内置模板模块（只读，产物落 .runtime/，不入库）
node node_modules/esbuild/bin/esbuild src/services/builtin-prompt-templates.ts \
  --bundle --platform=node --format=cjs --outfile=.runtime/bpt-p13.cjs

# ② 内置侧 + 覆盖版侧兜底触发面审计
node .runtime/audit-p13.mjs \
  "C:/Users/伯云飞/.ai-novel-writer-dev/generations/88ac198e-7a28-40b6-97c2-bb2bf88cb542/prompts"
# → 内置模板数 25，触发兜底 0；覆盖版 20 份，触发兜底 0

# ③ 实机 trace 的 fragment 分布（21 份 / 18 snapshot → required-context = 0）
node -e "…遍历 debug/prompt-trace/*.json，按 snapshot.fragments[].sourceKind 统计…"
```

**读数汇总**：内置 25 模板兜底 0 · 覆盖版 20 份兜底 0 · 实机 18 snapshot 兜底 0 · 正文模板 `required` 4 项全部由**内置 systemSuffix** 引用（`builtin-prompt-templates.ts:1036` / `:1113`）⇒ `enforceRequiredContext` 在正文链上**无对象**。

**全量消费点扫描（§7.1，2026-10-16 补）**：`grep -rn "withWorldBuilding(\|withArchitecture(" src` ⇒ 全仓调用点共 **5 处**：`architecture.command.ts:1813/2154/2439`（产出侧·设计必要）+ `review-chapter.command.ts:71`（**C1 唯一缺口**）+ `generate-draft.command.ts:825`（**已投影**）。`refine-from-review` / `refine-draft` / `finalize-chapter` / `review-revision` / `import-*` 逐文件读 prompt 装配 ⇒ **均不吃全量设定**。

**P1-2b 动作量（追问 3 参考，只读核对）**：作者项目 `worldbuilding` 6,210 字 / 180 行；**需标期次的条目 = 15 个**（§1 四条 / §3 七条 / §4 四条；§2 为 983 字无条目散文）—— **非评审估的 40 条**。（形态与成本见交接文档 P1-2b 节。）
