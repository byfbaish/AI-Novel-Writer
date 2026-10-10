# P3 设计稿（v1）· 请求前**语义重复**检测与去重（默认关）

> 目标读者：作者（审阅者）。本稿只做**设计与证据**，不含实现。
> 依据：`prompt-assembly-backlog.md §P3`（`:153-180`）、`p1-literal-dedup.md`（P1 已落地形态）、
> `docs/adr/0020-legacy-project-copy-import.md`、`generate-draft.command.ts`、`chapter-materials.ts`、
> `generation-harness.ts`、`ipc-channels.ts`、`SettingsModal.tsx`（dev_byf 当前状态）。
> 日期：2026-10-10。分支：`dev_byf`（按约定直提，不 push）。

---

## 0. 一句话结论

- P3 **不是** P1 的放大版，而是**换了一个判定主体**：P1 用**确定性字符串指纹**判等（零 AI），
  P3 必须用 **AI 语义判断**——而这恰恰是 **ADR 0020 明确禁止**用来"改变作者事实"的手段。
- 因此本稿的推荐形态是**只读检测优先**（Phase A：报告「疑似语义重复段」，**一个字节都不改 prompt**），
  作者看了报告、确认可信之后，再决定要不要开 Phase B（AI 建议 → 人工确认 → 才替换）。
- **自动删段**（AI 直接判定重复并删除）**不建议做**，理由见 §5.1。这需要作者显式拍板。
- 无论哪个 Phase，**默认关闭**，开关在设置里，由作者显式开启 —— 这是作者在 backlog 里写死的硬性要求。

---

## 1. 先对齐定义：P3 到底处理什么

| | P1（已落地） | **P3（本稿）** |
|---|---|---|
| 判定对象 | 同一段文本被装进多个位置 | 同一件**事**被换句话说了两遍 |
| 判定手段 | 本地确定性指纹（NFKC + 去 Markdown 标记 + 折叠空白标点 + 小写） | **AI 语义判断**（或嵌入向量相似度） |
| 是否用 AI | **零 AI** | **必须用 AI** |
| 逐字判等能否命中 | 能 | **不能**（语义重复恰恰是逐字不同的） |
| 验收工具 | 逐字计数断言 | **不能复用逐字计数**（见 §6） |
| 风险 | 低（判等失败顶多不去重） | **高**（AI 可能把「重要的第二次强调」误判为重复） |

作者原话（backlog `:159-162`）已经划清了这条线：

> 「这个 P1 真正要解决的问题是，Prompt 组装时**重复**的问题，是**真正的重复**，
> 不是那种语义级重复描述。」

即：**P3 是「语义级重复描述」的独立立项**。

### 1.1 P3 要抓的真实样本（本项目里真实存在）

P1 实测（`p1-literal-dedup.md §1.0`）已经确认：**逐字重复只剩 D1，且已收敛到 1/1**。
所以 P3 的靶子不是"还有残留的逐字重复"，而是**逐字不同、意思相同**的这几类：

| # | 语义重复形态 | 例子（本项目真实结构） |
|---|---|---|
| **S1** | 同一约束在「全局写作要求」与「本章执行合同 rules」各说一遍，措辞不同 | `globalGuidance` 说"不要提前揭晓潮门真相"，`executionContract.rules` 说"不得提前泄露核心谜团" |
| **S2** | 同一事实在「小说配置事实 JSON」与「作者资料原文」各说一遍 | `novel_config.coreOutline`（剥了 Markdown）↔ `project_core.premise`（带 Markdown 的同一段） |
| **S3** | 同一角色信息在「角色档案」与「本章蓝图 characters 列表」各说一遍 | 角色卡的 `notes` 与蓝图里的角色描述 |
| **S4** | 同一后续计划在「后续计划边界」与「全书设定池」各说一遍 | 卷纲片段 vs `architecture` 里的同一段 |
| **S5** | 同一文风要求出现在「文风要求」与「文风适用边界」 | 已有 D4 形态的语义变体 |
| **S6** | 同一提示词在 system 与 user 两条消息里各说一遍（跨消息） | rules 段与 user 段 |

> **注意 S6**：P1 的指纹是**在单条消息内部**做的段落判等，跨消息（system vs user）**没有**覆盖。
> 这是一个 P3 的真实增量空间，且它的形态相对"安全"（同一条约束在两条消息里重复说，删掉一处几乎无风险）。
> 但它同样需要语义判断，因为措辞不同。

---

## 2. 现状代码事实（决定方案可行性）

### 2.1 组装点只有两处，且都是**纯字符串拼接**

`generate-draft.command.ts`：

- **初始请求** `composeInitialPrompt`（`:997-1000`）：
  ```ts
  [chapterMaterials.text, promptBuilder.build(), reconciliationBlock, authorItemsFallback, chapterLengthContract]
    .filter(Boolean).join('\n\n')
  ```
- **续写 / 压缩共用** `draftAuthorMaterialBlock`（`:561-626`）：手工拼
  `【本章蓝图】【全局写作要求】【文风要求】【文风适用边界】【小说配置事实】+ chapterMaterials + reconciliation + authorItems`。
- 最终进入 harness 的是 `messages: [{role:'user', content}]`（`:1003-1004` 的 `injectWritingSkillIntoTask`），
  harness 再原样 `messages: task.messages`（`generation-harness.ts:691`）发给 provider。

**结论**：组装层是**唯一**的插入点，且插入方式就是**对字符串做变换**。
P3 不需要碰架构，只需要在 `composeInitialPrompt` / `draftAuthorMaterialBlock` 的返回值上加一层变换。

### 2.2 已有的「预算保护」通道，可复用为**兜底护栏**

`PromptBudgetPolicy` / `PromptBudgetSection`（`generation-harness.ts:35-51`）已经能把
**某一整段**（`sectionName` + `finalText` + `limitUtf8Bytes`）声明为"受保护的证据段"，
harness 会在发送前逐段核对体积（`:611-624`）。

→ P3 **可以复用这个机制做反向保护**：把「作者原文段」标记为**不可被去重触碰**的证据段，
如果 P3 的变换让某段体积异常（说明误删），harness 直接以 `PROMPT_BUDGET_EXHAUSTED` 拦下。
这是**廉价且已在生产路径上的**护栏，值得用。

### 2.3 设置开关的既有形态（P3 必须照抄）

`ipc-channels.ts:190-215` 的 `GlobalConfig` 已有先例 `autoOpenNextChapterAfterFinalize?: boolean`（`:197-198`）
与 `autoPromptBlueprintCharacterSync?: boolean`（`:199-203`，带 JSDoc）。
消费侧在 `SettingsModal.tsx` 的 `EditorSection`：「提示·创作」组里
state（`:1276`/`:1281`）、loader（`:1286-1288`，用 `!== false` / `=== true` 定默认值）、
乐观 setter + 失败回滚（`:1293-1317`）、`<Switch>` 块（`:1374-1393`）。

→ P3 加开关**完全照抄这条流水线**，零新机制。

### 2.4 但 `generate-draft.command.ts` **拿不到 config**（已核实）

`config:get` 是 **renderer 侧 IPC**（`SettingsModal.tsx:1286`、`App.tsx:168`），
main 侧实现在 `electron/controllers/config-controller.ts:13`，落到
`electron/utils/config-utils.ts` 的 `GLOBAL_CONFIG_PATH` / `DEFAULT_GLOBAL_CONFIG`。

`generate-draft.command.ts` 跑在 **main 侧的 workflow**（`chapter-workflow.ts:264`、`batch-chapter-workflow.ts:257`、
`draft-recovery-workflow.ts:59`），现有输入只有 `ChapterInfo` + `context` + `callbacks`。

→ **接线路径**（已核实存在，不再是未知数）：

| 路径 | 做法 | 评价 |
|---|---|---|
| **A · 经 `ChapterInfo` / 冻结上下文透传** | 上游读 config，塞进已冻结的章节信息 | 触碰恢复指纹风险区，**不选** |
| **B · 命令所在层直读 `config-utils`** | main 侧已有 `readJsonFile(GLOBAL_CONFIG_PATH, DEFAULT_GLOBAL_CONFIG)`，**直接可用** | **最小侵入，推荐** |
| **C · 经 `context`/`callbacks` 注入** | workflow 层读 config 后作为参数传入 | 干净，改动面比 B 大；若测试要注入假 config 则比 B 好 |

**推荐 B 起步；若 P3 测试需要注入开关值，改用 C**（B 在单测里不好打桩）。
**明确不选 A**（恢复指纹是冻结护栏，见 §3.2）。

---

## 3. 冻结护栏（P3 绝对不能碰）

### 3.1 ADR 0020（最高优先级）

ADR 0020 的硬约束（backlog `:256-257` 复述）：

> 「只能改措辞/组织，**绝不删除作者事实或红线**。」

这是 P3 的**判决性约束**。它直接推出：

> **AI 不得凭"这段和上文语义重复"的判定，删除作者事实、作者红线、作者指导。**

所以 P3 的**任何自动动作**，一旦可能触达 `project_core` / `novel_config` / 作者本章指导 / 角色卡作者字段，
**必须降级为"只报告"**。

### 3.2 `toWriterChapterInfo` / `writerChapterInfo`（冻结）

`generate-draft.command.ts:323-334`（`toWriterChapterInfo`）、`:688`（`writerChapterInfo`）。
恢复指纹在 `:693-695` / `:1063-1065` / `:1100-1102` 比较 `JSON.stringify(writerChapterInfo)`，
不一致即抛 `GENERATION_DRAFT_RECOVERY_AUTHOR_INPUT_CHANGED`（`:1105`）。

→ P3 **不得**为了去重而改这两个函数或它们的输出。去重只能作用在**组装结果字符串**上，不能改**结构化的作者输入**。

### 3.3 ★ `promptHash` 是**发送前逐字节校验**（已核实，P3 的**最大技术约束**）

上一稿我曾把这条列为"待确认"。现已 grep 核实，结论比预期严重得多：

`materialDecision.promptHash` 由 `generate-draft.command.ts:1005` 用**最终 prompt 全文**算出，
随后在 **main 侧发送前**被**逐字节比对**：

- `electron/services/main-generation-owner.ts:543`：
  `if (stripped === null || textHash(stripped) !== materialDecision.promptHash ...) throw new Error('GENERATION_MATERIAL_PROMPT_MISMATCH')`
- `:561` 首稿分支同理：
  `textHash(userPrompt) !== materialDecision.promptHash && (stripped === null || textHash(stripped) !== materialDecision.promptHash)` → 抛错。
- `:570` 还把 `task` 整体算进 `requestHash` 做同一 `invocationNonce` 的重放一致性校验。

**这意味着：prompt 不是"想改就改的字符串"，而是一份被收据锁定、发送前强校验的契约。**

→ **对 P3 的直接后果（重要）**：

1. **Phase A（只读检测）天然安全**：只要不改变 `prompt` 的字节，`promptHash` 就不变，校验照常通过。
   这也**强化**了 §6.1 第 1 条"逐字节相同"断言的地位 —— 它不是我的洁癖，
   而是**生产路径本就会拒绝**任何字节漂移。
2. **Phase B / C 必须同步改收据**：一旦去重改变了 `prompt`，就必须让改后的 prompt
   与 `materialDecision.promptHash` **保持一致**（用改后的文本重算 hash），
   否则会在发送前被 `GENERATION_MATERIAL_PROMPT_MISMATCH` 拦下 —— **生成直接失败**。
3. **这带来一个结构性好处**：如果实现时不慎"改了却忘了同步 hash"，系统会**立刻报错**而不是静默发出错误 prompt。
   这是一个**免费的护栏**，但也说明 Phase B 的改动面**比只改组装字符串要大**：
   要同时处理 `promptHash` / `shortOutlinePromptHash` / 重放一致性。

**结论**：这条约束让"Phase A 先做"从"稳妥"升级为"**几乎是唯一低风险路径**"。
Phase B 是**真的**要动收据契约的，不是小修。作者评估 Phase B 时请带上这个成本。

### 3.4 `recoveryChapterSource` / 恢复路径

`recoveryChapterSource`（`:628-639`）记录 `keyEvents` / `userGuidance` 等。
恢复路径要求"作者输入未变"，若 P3 在恢复路径上也做去重，会让两次运行的 prompt 不同 → 可能触发恢复失败或误判。

→ **P3 在恢复路径上默认跳过**（或至少在 resume 时使用与首次完全相同的去重决策，要求决策可复现）。

---

## 4. 方案设计

### 4.1 Phase A（推荐先做）· **只读语义重复检测**

> 这一阶段**不改变发给模型的任何一个字节**。它只产出**一份报告**。

**流程**：

```
组装好的 prompt（初始 / 续写）
        │
        ▼
① 切段：复用 P1 的 splitParagraphs（\n\n 分段）+ 保留段来源标签（哪个块来的）
        │
        ▼
② 标注保护区：来自作者原文/红线的段打上 protected 标记（§3.1）
        │
        ▼
③ 语义比对：对段对做语义相似度判定 → 产出「疑似重复对」列表
        │
        ▼
④ 出报告：章节 + 请求类型 + 重复对（段A 来源 / 段B 来源 / 相似度 / 摘要）+ 保护区命中
```

**关键设计点**：

1. **切段复用 P1**：`splitParagraphs`（`generate-draft.command.ts:167-169`）已经存在，
   指纹族（`:144-218`）也能顺手给出"逐字相同"和"语义疑似"两级信息，**不要另造切段器**。
2. **段的来源标签必须保留**：报告里最有价值的一列是"这段是从哪个块来的"
   （`chapterMaterials` / `template` / `globalGuidance` / `novel_config`…）。
   没有来源标签，作者看到重复对也无法判断该删哪个。
3. **保护区标注是为了"提前排除"**：作者原文段**不参与自动处理候选**，
   但**仍然出现在报告里**（作者需要知道"这里重复了，但那是我写的，我不动"）。
4. **检测手段三选一**（需作者拍板，见 §7 决策表）：

   | 手段 | 做法 | 成本 | 可解释性 | 离线可行 |
   |---|---|---|---|---|
   | **A1 · 嵌入向量** | 用已有 embedding 能力算段向量余弦相似度 | 需 embedding 模型（项目已有知识库 embedding 配置） | 中（给相似度分数） | 是（本地/远程 embedding，不消耗主模型） |
   | **A2 · 主模型判定一次** | 把切好的段列表发一次，让模型输出重复对 | 1 次额外 LLM 调用 | 高（模型给理由） | 否（多花一次钱/时间） |
   | **A3 · 词面兜底** | 词频/长公共子串/字符 n-gram Jaccard | 零 | 低（易漏语义、易误报） | 是 |

   **推荐 A1 优先、A2 可选**：A1 可离线、不花主模型的钱、能给分数让人自己定阈值；
   A2 更准但每次生成都多一次请求，与 P1"压小请求体"的初衷有张力。
   **A3 单独用不可取**（它有 P1 指纹的同样短板，抓不到"换句话"）。

5. **报告的落点**：建议写入项目目录下的日志/诊断文件（与既有覆盖缺口日志同族），
   **不进 Prompt、不进数据库结构化字段**。形式待作者定（文件 / UI 面板）。

**Phase A 的价值**：零风险（不改 prompt）、能立刻验证"语义重复到底有多严重、都在哪"，
并为 Phase B 提供**唯一可靠的验收素材**——没有真实样本，Phase B 的准确率无从谈起。

### 4.2 Phase B（**需作者显式批准才做**）· 检测 → 建议 → 人工确认

> 只有 Phase A 的报告被作者认为"确实有用、判定可信"之后，才谈这一步。

**形态**（对齐 P4 的三段式，backlog `:197-200`）：

- **只处理三类低风险目标**（顺序即优先级）：
  1. **跨消息同义约束**（S6）：system 与 user 各说一遍的同一条 rules → 建议删 user 侧那份。
  2. **模板与 chapterMaterials 的同义段**（S2/S4）：`template.content` 已有的段落 → 建议从 `chapterMaterials.text` 里去掉。
  3. **文风重复**（S5）：`【文风要求】` 与 `【文风适用边界】` 的同义句。
- **永不处理**（硬边界）：
  - 作者原文（`project_core.*`、`novel_config.*`、作者本章指导、角色卡作者字段）；
  - 任何 `protected` 标记段；
  - 恢复路径（resume）上的任何段（§3.4）。
- **动作永远是"建议 + 确认"**，不做静默删除。确认 UI 的形态待定（可复用 P1/P2 那一套审核面板的习惯）。

**Phase B 的开关语义**：作者的开关控制"是否启用 Phase B 的建议"，**不**控制"是否自动删"。
即：**开 = 开启建议，不是开启自动删除**。这一条要在 UI 文案里写死，避免误解。

### 4.3 Phase C（**本稿不建议做**）· 自动删除

`docs/plans/prompt-assembly-backlog.md §P3` 的"建议先做只读检测"已经隐含了立场。
我的理由见 §5.1。若作者仍要做，需要额外的**强护栏 + 可回滚**设计，本稿不展开。

---

## 5. 风险与边界

### 5.1 为什么**不建议**自动删除（请作者重点看这一条）

1. **判定主体错位**：唯一的判定者是 AI，而 AI 恰恰是 ADR 0020 不信任的那一方
   （ADR 0020 的全部逻辑就是"AI 不能改写作者事实"）。让 AI 去**删**，与整份 ADR 的精神相反。
2. **"重复"不等于"多余"**：作者重复说同一件事，**经常是刻意的强调**。
   Prompt 里的重复有**权重语义**——第二次出现会提高模型对该约束的注意力。
   自动删掉可能让作者**明确要求过的强调**失效，且**悄无声息**。
3. **不可观测**：删除发生在请求前，作者看不到被删了什么，除非有报告。
   而一旦有了报告，人审的成本已经付了——那不如直接让人来定。
4. **收益边界**：P1 已把**逐字重复**清干净（D1 2/2→1/1）。
   剩下的语义重复，**规模未知**（这正是 Phase A 要量化的）。在没量化之前谈自动删除，
   是在为一个**未测出的收益**承担一个**已知的高风险**。

→ **结论**：P3 的推荐形态是 **Phase A（只做）+ Phase B（作者批准后做建议）**，
**不做** Phase C。这与 backlog 的"建议先做只读检测"一致，也守住了 ADR 0020。

### 5.2 其他边界

- **不能复用逐字计数验收**（见 §6）。
- **性能**：Phase A 每次生成都跑一遍切段+比对。若用 A2（主模型），会**增加一次请求**，
  与 P1 的目标冲突；若用 A1（嵌入），需确认 embedding 模型在无网/未配置时的降级行为
  （**必须降级为"跳过检测"，而不是"报错阻断生成"**）。
- **`promptHash` 契约**（§3.3，已核实）：这是 Phase B 的**硬成本** —— 改 prompt 就必须同步重算
  `promptHash`，否则发送前被 `GENERATION_MATERIAL_PROMPT_MISMATCH` 拒绝。
  Phase A 不受影响（字节不变）。
- **设置开关的默认值**：`false`（默认关）。loader 用 `=== true`（与 `autoOpenNextChapterAfterFinalize` 同款），
  **不要**用 `!== false`（那是默认开的写法）。

---

## 6. 验收（P3 与 P1 不同的地方）

backlog 明确要求（`:179`）：

> 「与 P1 共用「逐字计数」测试工具，但**不能**用逐字断言验收语义去重（语义重复是逐字不同的）。」

所以 P3 的验收必须换工具：

### 6.1 Phase A 验收

1. **零改动断言（最重要）**：开启 Phase A 后，
   **初始/续写请求的 `messages` 内容与关闭时逐字节相同**（`JSON.stringify` 相等）。
   —— 这是"只读"的**可证明**形式，直接复用 P1 的 `requestTasks` 取任务手法（`generate-draft.command.test.ts:2820-2821`）。
2. **检出断言**：构造一个**已知语义重复对**的用例（例如同一约束两种措辞分别放进 rules 与 user），
   Phase A 报告里该对**必须被检出**，且**段来源标签正确**。
3. **误报基线**：构造一个**语义相近但不重复**的用例（例如"主角失去记忆" vs "配角失去记忆"），
   报告**不应**把它标为重复（或标注低分）。—— 用于给 A1 的阈值定标。
4. **保护区断言**：作者原文段出现在报告里时，**必须**带 `protected` 标记。

### 6.2 Phase B 验收（若批准）

1. 建议列表**不包含**任何 protected 段（可写成断言：建议集合 ∩ protected 集合 = ∅）。
2. **确认前 prompt 不变**：生成建议时，实际发出的 prompt 与关闭时逐字节相同。
3. 确认应用后，被删段在后续请求中不再出现，且**未被删段的其余内容逐字节不变**。
4. 恢复路径（resume）行为不变（§3.4）。

### 6.3 通用（两个 Phase 都要）

5. **回归**：`npx vitest run <相关文件>` 全绿 → `npx tsc --noEmit` EXIT=0 →
   全量扫描的**失败集与基线逐条 diff 一致**（基线 = 18 个 ABI `NODE_MODULE_VERSION 145 vs 127` 失败，见 backlog `:250-253`）。
6. **开关默认关**：不设 config 时，P3 完全不生效（可写成断言）。

---

## 7. 工作量与影响面

| 项 | 内容 |
|---|---|
| **主改** | `generate-draft.command.ts`（在 `composeInitialPrompt` / `draftAuthorMaterialBlock` 返回处加一层变换；Phase A 只在旁路产出报告） |
| **新增** | 语义检测器（`src/services/` 下新增，形态取决于 §4.1 的 A1/A2/A3 选择）+ 报告写入 |
| **配置** | `ipc-channels.ts` 的 `GlobalConfig` 加 1 个 `boolean?` + JSDoc；`SettingsModal.tsx` 的「提示·创作」组加 1 个 Switch |
| **接线** | 开关值从 config 到 main 侧命令（§2.4，**待定 A/B/C**） |
| **不碰** | `toWriterChapterInfo` / `writerChapterInfo`、`draftAuthorMaterialBlock` 的**构成**（Phase A）、`chapter-materials.ts` 的 required 段构成 |
| **测试** | 新增 P3 专项用例（§6）；`generate-draft.command.test.ts` 预计**受影响很小**（Phase A 零改动 prompt） |

---

## 8. 决策状态（**请作者逐条拍板**）

| # | 问题 | 我的建议 | 作者 |
|---|---|---|---|
| 1 | P3 做到哪个 Phase？ | **只做 Phase A + 预留 B**；**不做 C** | ⏳ |
| 2 | 检测手段选哪个？ | **A1（嵌入向量）优先**；A2 作为可选增强；**排除 A3** | ⏳ |
| 3 | 报告落在哪？ | 项目目录下的诊断文件（不进数据库结构字段） | ⏳ |
| 4 | 开关的**名字与文案**？ | `semanticDedupDetection?: boolean`，文案强调"只检测、不改花" | ⏳ |
| 5 | 开关值怎么传到 main 侧？（§2.4） | **B（直读 `config-utils`）起步**；测试需要注入假值时改用 **C**；**不选 A** | ⏳ |
| 6 | Phase A 是否也要在**恢复路径**上跑？ | 建议**跳过**（§3.4） | ⏳ |
| 7 | 若做 Phase B，是否接受「要动 `promptHash` 收据契约」这个成本？（§3.3） | **必须先接受再开工**，否则 Phase B 会在发送前失败 | ⏳ |
| 8 | 若都要做，Phase B 的"建议"是逐条确认还是批量确认？ | 待 Phase A 报告出来后再说 | ⏳ |

---

## 9. 与 P1 / P4 的边界

- **P1**：逐字重复，**已完成**。P3 不改 P1 的指纹族，只在它之上做语义层。
  两个 Phase 都必须**与 P1 的 I1 不变量共存**（P1 保证"逐字 1 次"，P3 保证"语义不冗余"）。
- **P4**：配置整合（A 类）。P3 是 B 类（请求前），**不动配置本身**。
  P3 若发现"两条配置语义重叠"，**只报告，不合并** —— 合并是 P4 的活，且要走 P4 的三段式。
