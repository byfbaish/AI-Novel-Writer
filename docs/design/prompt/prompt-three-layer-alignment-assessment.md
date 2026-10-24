# Prompt 三层结构的行业对标（工程侧）

> 状态：待裁定（2026-10-24）
> 核对基准：分支 `exp/resource-ledger` · HEAD `404c356d`
> 事实来源：[`prompt-three-layer-inventory.md`](./prompt-three-layer-inventory.md)（三层承载物、29 模板、20 条装配链路、缺口 G1–G10）。**本文不重复抄清单**，只做"行业怎么做 → 本项目在哪 → 该怎么判"。
> 取证纪律：§2 每条锚点必须带**可点开的 URL + 原文摘句**。找不到权威出处的判断，一律标注「无权威出处」并降级为经验判断——**不许把自己想的写成行业标准**。

---

## 0. 先说结论

**工程侧基本对齐，三处口径没对齐。** 本项目做的事（模板目录、变量契约、材料准入、前缀预算、去重、防漂移测试）在行业里都能找到对应名目，而且完成度不低。真正的缺口不是"少做了什么"，而是**三处名不副实**：

1. **层级被抹平**：本项目把"系统级规则"（`systemSuffix`）追加在 **user 体末尾**，而 system 消息只有 `systemRole` + 4 条不可变合同。按行业的分层模型，这套规则其实站在最低权威层，却在文档与直觉里被当成最高权威（缺口 G10）。
2. **同一层内没有冲突规则**：谁后说话谁算——所以 P8 里「不要超过目标」压过了「请写到 2125–2500」。行业对此有明确规则（同级后发覆盖先发），本项目没写下来。
3. **作者可调的"高度"被锁死**：行业建议把规则写在"既不过度硬编码、也不空泛"的中间高度，并让维护者能调。本项目 20 条链路里作者只能直接改 7 条（清单 §6），架构链的作者分步指导还落在**不可覆盖**的 `systemSuffix` 里（G7）。

所以本轮**不建议动任何 prompt 文案**。要动的是三件事：把层级规则写下来、把作者能改的面打开（或明确告知打不开）、把不生效的模板清掉。

---

## 1. 方法：四问

沿用 [`industry-alignment-and-stage-goals.md`](../architecture/industry-alignment-and-stage-goals.md) §5 的四问，不另造框架：

1. **行业里这件事叫什么？**（带出处）
2. **谁消费产出？**（没有消费方就是"半接线"——W6 的教训）
3. **失败形态属哪一类？**（静默失效 / 显式报错 / 质量下降）
4. **已有产品或论文做过什么、结论是什么？**

---

## 2. 锚点清单

### A1 · 指令权威分级（chain of command）

出处：OpenAI Model Spec，2025-04-11 版（该页顶部提示已有更新版本，引用须注明版本）
<https://model-spec.openai.com/2025-04-11.html>

> "We assign each instruction in this document, as well as those from users and developers, a _level of authority_. Instructions with higher authority override those with lower authority. This _chain of command_ is designed to maximize steerability and control for users and developers…"

五级排序（原文逐字）：

> "1. **Platform**: Model Spec 'platform' sections and system messages
> 2. **Developer**: Model Spec 'developer' sections and developer messages
> 3. **User**: Model Spec 'user' sections and user messages
> 4. **Guideline**: Model Spec 'guideline' sections
> 5. _No Authority_: assistant and tool messages; quoted/untrusted text and multimodal data in other messages"

同级冲突规则（原文逐字）：

> "An instruction is _superseded_ if an instruction in a later message at the same level either contradicts it, overrides it, or otherwise makes it irrelevant (e.g., by changing the context of the request)."

低层不得影响高层解释（原文逐字）：

> "The assistant should not allow lower-level content (including its own previous messages) to influence its interpretation of higher-level principles."

**它支持什么**：权威必须显式分层；同级靠"后发覆盖先发"；不可信文本（引用、工具输出）无权威。
**它不能支持什么**：这不是"效果最好"的实证结论，是对齐与可控性的工程约定。别拿它论证"写进 system 就一定更好"。

### A2 · 上下文是有限资源（attention budget）

出处：Anthropic《Effective context engineering for AI agents》
<https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>

> "Context, therefore, must be treated as a finite resource with diminishing marginal returns. Like humans, who have limited working memory capacity, LLMs have an 'attention budget' that they draw on when parsing large volumes of context."

> "…good context engineering means finding the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome."

**关于"不要过度规定"的那一段（原文逐字，本文 §4 的锚点）**：

> "System prompts should be extremely clear and use simple, direct language that presents ideas at the right altitude for the agent. The right altitude is the Goldilocks zone between two common failure modes. At one extreme, we see engineers hardcoding complex, brittle logic in their prompts to elicit exact agentic behavior. This approach creates fragility and increases maintenance complexity over time."

结论段（原文逐字）：

> "We're already seeing that smarter models require less prescriptive engineering, allowing agents to operate with more autonomy."

该文另外给出长任务的三种手段：**compaction**（压缩）、**structured note-taking**（把笔记落到上下文外，例：`NOTES.md`）、**sub-agent architectures**（子上下文隔离，只回传 1000–2000 token 的摘要）。

**它支持什么**：上下文预算、压缩、选择性注入、把事实落到外部存储。
**它不能支持什么**：不构成"某个具体 token 数"的依据——本项目 1,500 字卷末快照、720 字前文事实这些数字是工程取舍，不是行业标准。

### A3 · 位置偏置（lost in the middle）

出处：Liu et al., "Lost in the Middle: How Language Models Use Long Contexts", TACL 2023
<https://arxiv.org/abs/2307.03172>

> "we observe that performance is often highest when relevant information occurs at the beginning or end of the input context, and significantly degrades when models must access relevant information in the middle of long contexts, even for explicitly long-context models."

**它支持什么**：长上下文里"中间"最容易被漏；关键约束不该埋在中间。
**它不能支持什么**：不能推出"把所有规则都塞到末尾"——原文说的是"开头或结尾"，且这是检索类任务上的测量，写作任务上的强度未验证。

---

## 3. 逐条对照

| # | 行业做法（锚点） | 本项目现状（清单条目） | 判定 |
|---|---|---|---|
| 1 | 权威分层，高层覆盖低层（A1） | system 消息 = 模板 `systemRole` + 4 条【不可变系统合同】（清单 §2-1/2-2）；模板 `content`/`taskGuidance` 属"开发者"层；作者材料属"用户"层 | ✅ 已对齐（结构上成立） |
| 2 | 同级后发覆盖先发（A1） | **没有写下来的规则**。`systemSuffix` 与 `chapterExecutionContractText` 的 10 条都追加在 user 体，位置决定权重；P8 实证「不要超过目标」压过「请写到 2125–2500」 | ❌ 缺失（G10 的另一面） |
| 3 | 不可信文本无权威（A1 第 5 级） | 引用正文、工具输出、作者粘贴资料在材料块里都是普通文本；4 条不可变合同含「作者事实最高」「隐藏 schema 高于角色」 | ✅ 已对齐 |
| 4 | 上下文是有限资源，选最小高信号集（A2） | 作者材料块有准入单元与容量失败（`ChapterMaterialCapacityError`）；E4 前缀三层投影；P1 逐字去重；P7 审稿去重 | ✅ 已对齐 |
| 5 | 压缩（compaction）（A2） | 压缩轮存在（`generate-draft.command.ts:1951`），但**不传 `stepRules`** | ⚠️ 半接线（G5） |
| 6 | 结构化笔记 / 事实落外部存储（A2） | story bible 体系：M14 物品 / M15 制度 / M16 知情 / M17 能力 / M18–M19 卷单元 / `finalized_continuity_facts` / 写前查阅七节 | ✅ 已对齐（行业名 = story bible / series bible） |
| 7 | 隔离（sub-agent / 独立上下文）（A2） | 主进程与渲染层分工 + 生成归属合同 + 冻结 `promptKeys`；无多 agent 架构 | ✅ 已对齐（本项目是单 agent，隔离体现在"谁拼哪一半"） |
| 8 | 关键信息不放中间（A3） | 10 条执行合同 + 材料块顺序是**历史演化结果，没有位置设计**；`systemSuffix` 在末尾属"结尾位"，恰好有效但**不是设计出来的** | ⚠️ 半接线（无位置策略） |
| 9 | 规则高度：既不过度硬编码也不空泛（A2 的 Goldilocks） | 条款侧有 [`prompt-clause-admission.md`](./prompt-clause-admission.md) 三问 + 判据 CM/CJ/CX 把关；但**作者无法调高度**：20 条链路只能改 7 条 | ⚠️ 半接线（G6–G8） |
| 10 | 能力越强越少规定（A2 结论） | 模板 29 个，条款密度偏高（生成侧 10 条 + 审稿侧 6 条 + 各级 suffix）；`p14` 已示范"认不出就零字节"的克制做法 | ⚠️ 待评估，本轮不动 |
| 11 | 模板/指令要可维护、可追溯（A2 反面：brittle logic） | 模板目录三级覆盖 + `builtinRevision` 版本戳 + 12 组防漂移测试 + 本清单 | ✅ 已对齐 |
| 12 | 不生效的配置不该留在界面上（工程常识，**无权威出处**） | `chapter_blueprint`、`extract_initial_characters` 无运行时消费方却仍在模板表；`EDITABLE_PROMPT_KEYS` 不参与加载校验 | ❌ 缺失（G1、G2） |

**统计**：✅ 6 条 · ⚠️ 5 条 · ❌ 2 条（G1/G2 与 G10/第 2 条各算一处口径缺失）。

---

## 4. 创作自由度边界条款

这一节回答你那条要求：**"要保留基本结构的创作，给作者和大模型足够的创作发挥空间"**。它不说"少写规则"，而说清"什么能写、什么不能写"。

### 4.1 三条准入线

| 线 | 能写进 prompt / 代码 | 不能写 |
|---|---|---|
| **L1 可判定约束** | 字数区间、章号、钟点、持有关系、阶段限制、必须出现的具名实体、禁止写的事件 | —— |
| **L2 方法提示** | 怎么写（"用动作与对白呈现，不要内心独白"）、优先级、例外条件 | 具体桥段、具体台词、具体人物性格走向 |
| **L3 内容选择** | **一律不写** | 情节走向、人物善恶、爽点类型、结局安排 |

判据一句话：**这条要求如果换成另一位作者会不同意，它就不该进 prompt。**（等价于 [`prompt-clause-admission.md`](./prompt-clause-admission.md) 第 2 问「行业有无合法反例」）

### 4.2 本项目的自觉与越界点

| 已自觉 | 证据 |
|---|---|
| 未知/认不出的输入**零字节**，不猜、不回显 | `p14` 章节定位七档；判据 DN「缺失不填 0」 |
| 不判创作质量，只判一致性 | 判据 CM「设计强度 ≠ 一致性」；W6 明确不判"制度是否合理" |
| 不做"人设好恶"校验 | 12.15 明确"不判人物动机、不判性格一致" |

| 越界风险 | 说明 | 建议 |
|---|---|---|
| 条款密度 | 生成侧 10 条 + 审稿侧 6 条 + 各级 suffix；A2 提醒"过度硬编码会脆" | 下一轮做「条款台账」：逐条答"不写它会出什么错"，答不出的删 |
| 结构替代创作 | 弧光/单元/章数已被强约束 | 已由"弧只约束走向、不管章号"（v3 裁定）守住，别再收紧 |

---

## 5. 缺口分级与处理（只登记，本轮不修）

分级口径见清单 §7。这里只补「行业锚点 + 修法建议 + 风险」，细节回清单查。

### P0（3 条，都属"静默误判"）

| 缺口 | 行业锚点 | 修法建议 | 风险 |
|---|---|---|---|
| **G1** 两个模板无消费方 | A2「最小高信号集」的反面：留着不生效的配置只会误导 | 二选一：删 key，或在设置页标「当前链路不使用」。**删 key 会动 `prompt-local-qwen-contract` 的变量快照** | 低（不改生成行为） |
| **G2** `EDITABLE_PROMPT_KEYS` 不参与加载 | 无权威出处（工程一致性） | `PromptCatalog` 加载时对非白名单 key 记 diagnostics（警告，不拒绝） | 低；但会把既有手写覆盖暴露出来 |
| **G10 / 对照第 2 条** 层级与同级冲突没写下来 | A1 的同级规则 | 在 `prompt-builder` 文档注释 + 清单 §1 明确写出：「本项目 system 层只有 systemRole+合同；Suffix 属 user 层末位，采用后发优先」。**不改代码** | 零 |

### P1（5 条，规则在链路上缺失）

| 缺口 | 锚点 | 修法建议 | 风险 |
|---|---|---|---|
| **G5** 压缩轮无 `stepRules` | A2 压缩 | 与续写轮同样传 `stepRules` | 中：压缩请求体增大；压缩只删不增，塞 KPI 可能诱导补写（P8 已刻意不接）→ **建议先只传"不新增内容"类规则** |
| **G6** `character_dynamics` 正文不渲染 | A2 高度 | 要么让正文参与，要么在设置页标"本模板只用 systemRole" | 中：会动架构链请求体与哈希 |
| **G7** `stepGuidance` 落在不可覆盖 suffix | A2 高度 | 改为模板 `taskGuidance` 承载 | 高：架构链五步全动，`synopsisInputsFingerprint` 要重算 |
| **G8** 项目 Markdown 指导只进正文链 | A2 select | 先只改**提示文案**（说明作用域），不改行为 | 零 |
| **G3、G4** 覆盖哈希口径分裂 / 内联合同覆盖模板 | 无权威出处 | 记录在案，排到"模板体系整理"一起做 | 中 |

### P2（2 条）

G9（主进程 system 不在投影里）→ 排障文档补一句；G10 已在 P0 处理。

---

## 6. 明确不做

| 不做 | 理由 |
|---|---|
| 把 `systemSuffix` 移回 system 消息 | 会一次性改变**所有链路**的行为，且 P8 的质量闸门是围绕现有位置调出来的；收益未验证 |
| 引入外部上下文检索工具（context-router 之类） | 当前 299 份 md、20 条链路，索引 + 清单足够；工具会引入第二套事实源 |
| 给每条链路补一份可编辑模板 | 会把 brittle logic 写成配置，正撞 A2 的警告；且作者维护不动 |
| 用 A1/A2/A3 论证"应该加更多硬规则" | 三条锚点都不支持这个结论。A2 明确说"能力越强越少规定" |
| 本轮改任何模板文案 | 作者 2026-10-24 裁定：先让现有链路稳定产出质量 |

---

## 7. 与台账的映射

| 缺口 | 台账去向 |
|---|---|
| G1 / G2 | 待登记为 P16-1（模板体系整理），不排期 |
| G3 / G4 | 并入 P16-1 |
| G5 | 待登记为 P16-2（压缩轮规则），需先做小样本对照 |
| G6 / G7 / G8 | 并入 P16-3（作者可调面），依赖"模板体系整理" |
| G9 / G10 | 本轮已用文档写清，不再建条目 |

> 登记动作在 [`plans/prompt-assembly-backlog.md`](../../plans/prompt-assembly-backlog.md) 的「2026-10-24 全 prompt 查漏补缺（P16）」节。
