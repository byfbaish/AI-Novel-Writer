# Debug 开关：Prompt 片段追踪与输入输出落盘（设计稿）

> 目标：UI 加一个 debug 开关，打开后把每次生成的 **input（含组装前的原始 prompt 片段，带来源定位）** 与 **output（架构层 / 章节蓝图 / 正文）** 写到外部文件夹，方便按"片段来源"做具体调优，而不是在代码里翻。
>
> 状态：设计稿，待评审。原则——设计先行，审核后再编码。

---

> 状态：v2（已按自评审修正）。v1 的"唯一 chokepoint = `callLLMResult`"判断**已作废**。

---

## 0. v2 修正说明（相对 v1 改了什么）

v1 的范式（过程捕捉，不事后拆串）成立，但**实现判断错了两处致命的**：

| 项        | v1 错误判断                                | v2 修正                                                                                     |
| -------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| IO 汇聚点   | "唯一 chokepoint = `callLLMResult`"      | 实际有**两条**路径：①`callLLMResult` ②`structured-batch-executor` 直连 `session.complete`。章节蓝图走的正是② |
| 片段获取     | "接进 `callLLMWithBuilder` 就能抓到 builder" | 该助手**全库仅 2 处调用**；其余数十处是命令**内联** `builder.build()` 传字符串，此处根本看不到 builder 对象                 |
| 片段↔IO 关联 | 未设计                                    | v2 补上 correlation 机制（§4）                                                                  |

**两句话记住 v2 的结构**：

- **统一 IO 点在 `GenerationSession.complete`**（两条路径都经它，能拿最终 messages + output，但**拿不到片段来源**）。
- **片段来源点在各 `BasePromptBuilder.build()`**（所有 builder 使用者都会触发，无论内联还是助手；但**不知道这次 build 属于哪次 IO**）。
- → **两者物理错开，必须靠 correlation id 缝合**。这是 v2 的核心。

---

## 1. 核心结论先讲

**必须走"过程捕捉记录器"，不能走"事后反拆串"。**

原因（已核代码）：`BasePromptBuilder.build()`（`src/services/prompts/prompt-builder.ts:28`）把 `content` + `taskGuidance` + `builtin systemSuffix` + `requiredContext` + 变量替换，一路 `replaceAll` 合并成一个最终字符串。合并之后，**"这段来自 UI 设置 / 那段是代码硬编码的 systemSuffix / 那段是 NovelConfig 的 globalGuidance" 这些信息全部丢失**，再也无法从最终串反推回来。

所以唯一可靠的做法是：在 `build()` 之前，从 builder 里把"组装前的原件 + 每个变量的值"抓出来，逐片段打上来源标签。

---

## 2. 捕捉落点（**两条**路径，不是一个点）

### 路径 A：`callLLMResult` 家族（`base-command.ts:437`）

`callLLM` (:265) / `callLLMWithBuilder` (:520) / `callLLMResultWithBuilder` (:529) / `callLLMWithBoundedCompletion` (:283) / `callLLMWithAppendContinuation` (:339) **全部**汇到 `callLLMResult`。

- 这里能拿到最终 `messages`（system+user）与返回 `completion.content`。
- ⚠️ 但**只有 2 处**调用方把 `builder` 传进来（`architecture.command.ts:1067/1805`）；其余调用方传的是**早已 `build()` 好的字符串**。

### 路径 B：`structured-batch-executor.ts`（**绕过** `callLLMResult`）

- `:324` `session.complete(task, …)`、`:420` 语法修复请求，**直接**调用 session，不经 `callLLMResult`。
- 使用者（`createStructuredBatchExecutor`）：`directory.command.ts:451/457`（**章节蓝图**）、`architecture.command.ts:1333`（角色细节）、`import-novel.command.ts:31`（**逆向推演**）、`planning-material.command.ts:20`。

### 路径 C：独立服务直连 `session.complete`（**又绕过 A 和 B**）

- `plot-tree-generator.ts:41`、`narrative-thread-candidate-generator.ts:39/71`（**伏笔叙事的 plan/event 生成**）、`character-card-generation.command.ts:149`。
- 这些**没有对应的 prompt 模板 key**（用 `buildXxxTask()` 在 `shared/*-pure.ts` 里拼 task），是纯 task 构造 → 只能靠 IO 层兜住。

### 结论：真正的统一 IO 点是三条路径的**共同下游** —— `GenerationSession.complete`（`generation-harness.ts:575` 定义，`:685` 调 `completionPort.complete`）

三条路径都经它。在此处 hook，能**无遗漏**拿到最终 input messages + output。但此处**没有片段来源语义**（已被合并）。

### ★ 全量步骤 × 路径映射（与本方案覆盖面契约）

| 步骤（作者口径）    | promptKey / task                                         | 路径          | 备注                                   |
| ----------- | -------------------------------------------------------- | ----------- | ------------------------------------ |
| 全文配置生成      | `generate_global_config` / `generate_novel_config_field` | A           |                                      |
| 故事前提        | `premise`                                                | A           | 架构链                                  |
| 角色图谱        | `character_dynamics`                                     | A           | 架构链                                  |
| 世界观         | `world_building`                                         | A           | 架构链                                  |
| 弧光结构        | `plot_structure`                                         | A           | 架构链                                  |
| 情节大纲        | `synopsis`                                               | A           | 架构链                                  |
| 章节蓝图        | `chapter_blueprint` / `chapter_blueprint_chunk`          | **B**       | v1 会漏                                |
| 第一章草稿       | `first_chapter_draft`                                    | A + 续写旁路    | 续写不走 builder                         |
| 后续章节草稿      | `next_chapter_draft`                                     | A + 续写旁路    | 同上                                   |
| AI 修稿（章节精修） | `refine_chapter`                                         | A           |                                      |
| 审稿驱动修稿      | `refine_from_review`                                     | A           | 与上者是**两个 key**，流程里集成                 |
| 伏笔叙事        | `buildNarrativeThreadPlan/EventTask`（**无模板 key**）        | **C**       | 另有写稿期注入 `readActiveNarrativeThreads` |
| 编辑选中文本      | `edit_selected_text`                                     | A           |                                      |
| 章节要点生成      | `generate_chapter_notes`                                 | A（finalize） |                                      |
| 更新角色卡动态状态   | `update_character_cards`                                 | A（finalize） |                                      |
| 逆向推演全局配置    | `infer_novel_config` / `infer_novel_config_with_vectors` | **B**       | 导入小说用                                |
| 逆向推演单章蓝图    | `infer_single_chapter_blueprint`                         | **B**       | 导入小说用                                |

> **契约**：本方案必须让**每一行都被捕获**。路径 C 的行没有模板 key，trace 里 `promptKey` 记 `task:<taskLabel>`（如 `task:narrative-thread-plan`），`editable=false`（无 UI 入口）。  
> 这些步骤**不一定同时出现**（如逆向推演只在导入小说时；`first/next` 依序二选一；修稿/审稿修稿视操作），所以目录**按实际发生动态生成**，不预建空壳。

---

## 3. 片段来源归因模型（本方案的核心价值）

给每个片段打一个 `sourceKind` 枚举 + 定位信息，让你一眼看出"这段在哪、能不能在 UI 改"：

- `builtin-content` —— 内置模板 `content` 字段（`src/services/builtin-prompt-templates.ts` 单文件，按 `key` 定位）
- `builtin-taskGuidance` —— 内置模板 `taskGuidance`
- `builtin-systemRole` —— 内置模板 `systemRole`
- `builtin-systemSuffix` —— **代码硬编码、用户永远改不了**（已核：`build():47` 始终从 `getBuiltinPromptTemplate` 取，override 无效）→ `editable:false`
- `ui-override-content` / `ui-override-taskGuidance` —— 项目级 / 全局级 prompt 覆盖（`promptCatalog.resolve` 优先级 project > global > builtin，`src/services/prompt-catalog.ts:125`）
- `ui-systemRole` —— 设置面板 `PromptSettings.tsx` 里可填的 systemRole
- `global-guidance-field` —— `NovelConfigEditor.tsx:510` 的 `globalGuidance` 字段（经 `{{global_guidance}}` 注入 11 个模板）
- `pacing-guidance-field` —— `DirectoryConfigDialog.tsx:89/518` 的 `pacingGuidance`（注入 `chapter_blueprint*`）
- `writing-skill` —— 按 stage 注入、优先级最低（`base-command.ts:462 injectWritingSkillIntoTask`，拼到 user 最前面）
- `step-guidance` —— 架构命令注入的逐步指导（`{{step_guidance}}`）
- `required-context` —— `appendRequiredPromptContext` 补回的权威上下文
- `variable-value` —— 每个 `{{key}}→值` 的映射（对 `global_guidance`/`pacing_guidance`/`novel_config` 等已知变量再打一层 `sourceTag`）
- `code-task` —— **路径 C 无模板 key 的步骤**（伏笔叙事 / `plot-tree-generator`），来源 = 代码 builder 函数（`buildNarrativeThreadPlanTask` 等），`editable:false`（无 UI 入口）

每条片段记录结构（建议）：

```
{
  order: 1,
  sourceKind: "builtin-systemSuffix",
  promptKey: "first_chapter_draft",
  location: { file: "src/services/builtin-prompt-templates.ts", key: "first_chapter_draft" },
  editable: false,
  rawText: "★【作者对本步骤的额外指导】★：{{step_guidance}} …（变量未替换原文）",
  variables: [ { key: "step_guidance", value: "...", sourceTag: "step-guidance" } ],
  note: "硬编码于内置模板，UI 无法覆盖"
}
```

`editable` 判定（v2 修正，不再手工硬编码）：

- 模板整体是否可编辑 → 查 `EDITABLE_PROMPT_KEYS`（`builtin-prompt-templates.ts:37`，24 项）。不在表里 = 系统模板，`editable=false`。
- 生效来源（内置 / 全局覆盖 / 项目覆盖）→ 由 hook `build()` 时记录 `promptCatalog.peek(key, session)?.source`（`prompt-catalog.ts:239`，返回 `'project'|'global'|'builtin'`）得出，写到片段的 `resolvedFrom`。
- `systemSuffix` / `required-context` 恒 `editable=false`（代码硬编码，用户覆盖不到）。

这样你在 dump 里能直接筛出"哪些能改、哪些只能动代码、当前生效的是内置还是你的覆盖"。

---

## 4. 改动点（v2：两层 hook + correlation）

### 层 1 — 片段层：hook `BasePromptBuilder.build()` / `getSystemRole()`

最省事、最全覆盖的做法，是给 `build()` 内部加一个"上报"调用（而不是新加 public 方法让调用方主动调——因为调用方太散、且多数内联）：

```ts
// src/services/prompts/prompt-builder.ts
public build(): string {
  // …原逻辑完全不动…
  const result = /* … */;
  if (promptTrace.enabled) {
    promptTrace.recordFragments({
      promptKey: this.template.key,
      source: promptCatalog.peek(this.template.key, currentSession)?.source, // 'builtin'|'global'|'project'
      editable: EDITABLE_PROMPT_KEYS.includes(this.template.key),
      template: {
        content: this.template.content,
        taskGuidance: this.template.taskGuidance,
        systemRole: this.template.systemRole,
        systemSuffix: getBuiltinPromptTemplate(this.template.key, lang)?.systemSuffix, // 硬编码原件
      },
      variables: { ...this.variables },   // 变量→值全量映射
      built: result,                       // 合并结果（供与 IO 对账）
    })
  }
  return result
}
```

- `this.template`（`:15`）与 `this.variables`（`:16`）已在类内，改动**极小**。
- 内联调用者（`architecture.command.ts:876` 等）、鸭子类型包装（`finalize-chapter.command.ts:291` 内部 `base.build()`）**都会触发**——因为 hook 在原型方法上。

### 层 2 — IO 层：hook `GenerationSession.complete`（`generation-harness.ts:575`）

在 `complete()` 入口抓 `task.messages`（最终 input：system+user，含 writing-skill 前置块），出口抓 `outcome.content` / `finishReason` / `receipt`。**两条路径（A/B）都经此**，无遗漏。

### correlation（缝合两层）

两层物理错开，需要一个 run 内 id 把"这次 build"配到"这次 complete"。两种粒度可选：

- **粗（推荐先做）**：以命令的 `GenerationRuntime` 执行期为单位。`base-command.ts:202 executeWithGenerationRuntime` 里 `activeGenerationExecution` 就是天然的"一次生成会话"作用域——层 1 与层 2 都挂在同一个 `execution` 上，天然配对，**无需额外 id**。
- **细（可选）**：给每次 `complete` 生成 `callSeq`，层 1 只记录"最近 N 次 build"，按调用顺序配对。续写多轮时更精确。

记录器是模块级单例，开头一行 `if (!promptTrace.enabled) return` 兜底——关掉时零开销。

---

## 5. 外部文件夹结构

默认落在项目数据内（沙箱安全）：`<project>/.vela/debug/prompt-trace/`。  
（可选项：设置里填自定义绝对路径；见 §9 沙箱风险。）

**聚合粒度 = 一次 run（对齐 `context.mainGenerationRunHandle` / DB `generation_runs`）**，不是"一次调用一个目录"——否则续写会把一个步骤碎成多个目录，也没法和 `generation_attempts` 交叉取证。

**另一个维度：按操作归类（stepGroup）**。你说的 17 类步骤不一定同时出现、且量很大，所以目录**按实际发生的操作动态生成**，并分组成五类，方便按"我在调哪一类"来翻：

| stepGroup           | 覆盖步骤                         |
| ------------------- | ---------------------------- |
| `config`（配置层）       | 全文配置生成、逆向推演全局配置              |
| `architecture`（架构层） | 故事前提、角色图谱、世界观、弧光结构、情节大纲      |
| `blueprint`（章纲层）    | 章节蓝图、逆向推演单章蓝图                |
| `draft`（正文层）        | 第一章草稿、后续章节草稿、AI 修稿、审稿驱动修稿    |
| `aux`（辅助/后处理）       | 伏笔叙事、编辑选中文本、章节要点生成、更新角色卡动态状态 |

### 5.1 目录结构

```
prompt-trace/
  INDEX.md                          # ★ 总索引（跨 run，人读；见 §5.3）
  index.json                        # ★ 机器可读总索引（见 §5.4）
  <runId>/                          # = mainGenerationRunHandle（或时间戳兜底），与 DB run 对齐
    manifest.json                   # 本 run 元数据：时间、model、writingLanguage、purpose、finishReason、usage 摘要
    index.md                        # 本 run 的目录索引（每步一行摘要，见 §5.3）
    <stepGroup>/                    # config | architecture | blueprint | draft | aux（只建实际出现的）
      01-<promptKey>/               # 序号 = 本 run 内该步骤的实际执行顺序
        fragment.json               # 组装前原件（§3 结构 + resolvedFrom + stepGroup）
        input.prompt.md             # ★ 主产物：人读+模型读的完整 prompt 快照（§6）
        output.txt                  # 模型原始输出（已去 <think>）
        output.meta.json            # finishReason / usage / rounds / path(A|B|C)
      02-<promptKey>/ …
```

- 只创建**实际发生**的 stepGroup 目录（没导入就没 `config/infer_*`）。
- 一个步骤多次调用（续写多轮）**不新开目录**，在同一个 `output.txt` 里按 `### 轮次 N` 分段（见 §6.5）。
- 例：`draft/03-refine_chapter/` 与 `draft/04-refine_from_review/` 相邻——正是"两个功能集成在一个流程"的两个 key。

### 5.2 为什么索引是刚需

架构链 5 步 × 每步可能多块（`chapter_blueprint_chunk` 分块）；正文每章 1 run；逆向推演逐章跑——**量大且散**。所以三层索引：`INDEX.md`（跨 run 汇总，人读）、`<runId>/index.md`（单 run 汇总，人读）、`index.json`（供大模型扫）。

### 5.3 `INDEX.md`（跨 run 总索引，人读）

```markdown
# Prompt Trace 总索引

> 更新于 2026-10-12 18:45 · 共 12 个 run · 末次模型：deepseek-chat

| 时间 | runId | stepGroup | 步骤 | promptKey | 生效来源 | path | 输出摘要 | 链接 |
|------|-------|-----------|------|-----------|---------|------|---------|------|
| 18:40 | 8f3a21c0 | architecture | 情节大纲 | synopsis | global | A | 3 卷 60 章大纲 | [→](8f3a21c0/architecture/01-synopsis/) |
| 18:41 | 8f3a21c0 | blueprint | 章节蓝图 | chapter_blueprint_chunk | project | B | 第1-10章 | [→](8f3a21c0/blueprint/02-chapter_blueprint_chunk/) |
| 18:43 | 8f3a21c0 | draft | 第一章草稿 | first_chapter_draft | global | A | 3 轮 4,200 字 | [→](8f3a21c0/draft/03-first_chapter_draft/) |
| 18:44 | 8f3a21c0 | draft | 审稿驱动修稿 | refine_from_review | global | A | 修 7 处 | [→](8f3a21c0/draft/04-refine_from_review/) |
| 18:44 | 8f3a21c0 | aux | 伏笔叙事 | task:narrative-thread-plan | none | C | 8 条线索 | [→](8f3a21c0/aux/05-task_narrative-thread-plan/) |
| … | | | | | | | | |
```


### 5.4 `index.json`（机器可读总索引）

```json
{
  "updatedAt": "2026-10-12T18:45:00+08:00",
  "runs": [
    {
      "runId": "8f3a21c0",
      "startedAt": "2026-10-12T18:40:11+08:00",
      "model": "deepseek-chat",
      "steps": [
        { "seq": 1, "stepGroup": "architecture", "promptKey": "synopsis", "resolvedFrom": "global", "path": "A", "finishReason": "stop", "bytes": 5512, "dir": "architecture/01-synopsis" },
        { "seq": 2, "stepGroup": "blueprint", "promptKey": "chapter_blueprint_chunk", "resolvedFrom": "project", "path": "B", "finishReason": "stop", "bytes": 9690, "dir": "blueprint/02-chapter_blueprint_chunk" },
        { "seq": 3, "stepGroup": "draft", "promptKey": "first_chapter_draft", "resolvedFrom": "global", "path": "A", "rounds": 3, "finishReason": "stop", "dir": "draft/03-first_chapter_draft" },
        { "seq": 5, "stepGroup": "aux", "promptKey": "task:narrative-thread-plan", "resolvedFrom": "none", "path": "C", "editable": false, "dir": "aux/05-task_narrative-thread-plan" }
      ]
    }
  ]
}
```

> 无模板 key 的步骤（伏笔叙事等路径 C）在索引里也各占一行，`promptKey` 用 `task:<label>`，`editable:false`。

---

## 6. 输出格式样例（★ 人读 + 大模型读，**全量步骤**）

**设计要求**：单一 markdown 文件承载三件事——① 组成（哪些片段、各占多少字）② 来源（每段从哪来、能不能在 UI 改、当前生效来源）③ 输出（模型原始产出）。用 \`\` 注释块给大模型提供机器可读的紧凑 JSON，正文用 markdown 标题给人读。一个文件、两种读者。

### 6.1 通用骨架（**每个**步骤的 `input.prompt.md` 都长这样）

````markdown
# TRACE · <promptKey> · <中文名>



## 1. 组成总览
| # | 片段 | 来源 | 可在 UI 改 | 字节 |
|---|------|------|-----------|------|
| 1 | 模板正文 content | 内置 `synopsis` | ✓ | 4,120 |
| 2 | 作者全局指导 globalGuidance | NovelConfigEditor | ✓ | 412 |
| 3 | 补回必需上下文 requiredContext | 系统 | ✗ | 980 |
| Σ | — | — | — | 5,512 |

## 2. 逐片段明细
### 片段 1 · 模板正文 content
- 来源：`global` → `~/.ai-novel-writer-dev/…/prompts/synopsis.zh-CN.json`（覆盖生效）
- 可编辑：✓（架构链，仅标注不建议改）
- 变量出口：`global_guidance` / `premise` / `character_dynamics` / `world_building` / `plot_structure_guide`
```text
（贴 content 原文，变量位保留 {{xxx}} 形式）
````

### 片段 2 · 作者全局指导 globalGuidance

- 来源：`ui` → `NovelConfigEditor.tsx:510`，项目级，可编辑 ✓

```text
（贴实际值）
```

…（依此类推每个片段）

## 3. 组装后 user message（最终输入）

```text
（build() 结果拼接后的完整 user prompt）
```

## 4. system message

```text
（getSystemRole() + 不可变合同）
```

## 5. 模型输出

```text
（completion.content，已去 <think>）
```

````

### 6.2 全量步骤差异表（同一骨架，META 与提示不同）

逐行覆盖作者列的 17 类，只列**关键差异**（其余同骨架）：

| promptKey | stepGroup | path | META 关键字段 | 写进"逐片段明细"的提示 |
|---|---|---|---|---|
| `generate_global_config` | config | A | `editable:true` | 会**覆写** globalGuidance（填完别再点它） |
| `goal_config_field`* | config | A | | 单字段生成 |
| `infer_novel_config_with_vectors` | config | B | `path:"structured-batch"`, `vectors:true` | 导入小说专用，注入 `sampled_*` |
| `premise` | architecture | A | `archChain:true` | |
| `character_dynamics` | architecture | A | `archChain:true` | 角色图谱 |
| `world_building` | architecture | A | `archChain:true` | |
| `plot_structure` | architecture | A | `archChain:true` | 弧光结构 |
| `synopsis` | architecture | A | `archChain:true` | 因果链硬约束（见 6.3） |
| `chapter_blueprint` / `chapter_blueprint_chunk` | blueprint | **B** | `path:"structured-batch"`, `chunk` | 上游大纲投影 `novel_architecture` |
| `infer_single_chapter_blueprint` | blueprint | **B** | `path:"structured-batch"` | 导入小说专用 |
| `first_chapter_draft` | draft | A+续写 | `rounds:n` | 续写不带模板指导（见 6.5） |
| `next_chapter_draft` | draft | A+续写 | `rounds:n` | 同上 |
| `refine_chapter`（AI 修稿） | draft | A | `flow:"refine"` | |
| `refine_from_review`（审稿驱动修稿） | draft | A | `flow:"refine"`, `hasReviewReport:true` | 与上者是两个 key |
| `task:narrative-thread-plan` / `-event`（伏笔叙事） | aux | **C** | `promptKey:"task:…"`, `editable:false` | 无模板 key（见 6.4） |
| `edit_selected_text` | aux | A | `editable:true` | 选中文本专用变量 |
| `generate_chapter_notes` | aux | A | `finalize:true` | 定稿后跑 |
| `update_character_cards` | aux | A | `finalize:true` | 定稿后跑；鸭子类型 builder |

*`goal_config_field` 实为 `generate_novel_config_field`。

### 6.3 情节大纲（`synopsis`）实例片段

```markdown
# TRACE · synopsis · 情节大纲


## 1. 组成总览
| # | 片段 | 来源 | 可在 UI 改 | 字节 |
|---|------|------|-----------|------|
| 1 | 模板正文 content | 内置 `synopsis` | ✓ | 4,120 |
| 2 | 作者全局指导 | NovelConfigEditor | ✓ | 412 |
| 3 | 补回必需上下文 | 系统 | ✗ | 980 |
| Σ | | | | 5,512 |

## 5. 模型输出
```text
【情节大纲】第1卷 ...
- 第1章：因为主角误触古镜（X），所以被卷入（Y）……
````

````

### 6.4 伏笔叙事（路径 C，**无模板 key**）实例片段

```markdown
# TRACE · task:narrative-thread-plan · 伏笔叙事（规划）



> ⚠️ 本步骤**无 prompt 模板 key**，task 由 `buildNarrativeThreadPlanTask()`（`shared/narrative-thread-generation-pure.ts`）代码拼装。
> 没有"UI 覆盖来源"，也没有 `EDITABLE_PROMPT_KEYS` 条目——`editable:false`，想改只能动代码。

## 1. 组成总览
| # | 片段 | 来源 | 可在 UI 改 | 字节 |
|---|------|------|-----------|------|
| 1 | task 主体 | 代码 `narrative-thread-generation-pure.ts` | ✗ | 1,860 |
| 2 | 全书章节清单 | 系统派生 | ✗ | 420 |
| Σ | | | | 2,280 |

## 5. 模型输出
```json
{ "candidates": [ { "id": "T1", "plantAt": 2, "resolveAt": 18, "summary": "…" } ] }
````

````

> 同类还有 `plot-tree-generator.ts`（路径 C）；都在索引里占一行，`promptKey` 记 `task:<label>`。

### 6.5 章节蓝图（`chapter_blueprint_chunk`，路径 **B**）实例片段

```markdown
# TRACE · chapter_blueprint_chunk · 章节蓝图（分块）



## 1. 组成总览
| # | 片段 | 来源 | 可在 UI 改 | 字节 |
|---|------|------|-----------|------|
| 1 | 模板正文 content | 内置 `chapter_blueprint_chunk` | ✓ | 6,240 |
| 2 | 作者全局指导 | NovelConfigEditor | ✓ | 412 |
| 3 | 节奏指导 pacingGuidance | DirectoryConfigDialog | ✓ | 88 |
| 4 | `novel_architecture`（上游大纲投影） | 系统派生 | ✗ | 2,310 |
| 5 | 章节列表 chapter_list | 系统派生 | ✗ | 640 |
| Σ | | | | 9,690 |

> 本步由 `directory.command.ts:451` 经 `createStructuredBatchExecutor` 直连 `session.complete`，
> **不经 `callLLMResult`**（v1 会漏掉的就是它）。

## 5. 模型输出
```json
{ "blueprints": [ { "chapterNumber": 1, "title": "…", "keyEvents": […], "breakHook": "…" } ] }
````

> ⚠️ 此处是**原始 JSON 串**，≠ 落库后的 blueprint 记录（还要经解析/校验/`blueprint_commit_operations`）。

````

### 6.6 正文多轮续写（`first_chapter_draft` / `next_chapter_draft`）实例片段

```markdown
# TRACE · first_chapter_draft · 第一章草稿


## 1. 组成总览
| # | 片段 | 来源 | 可在 UI 改 | 字节 |
|---|------|------|-----------|------|
| 1 | 模板正文 content | 内置 `first_chapter_draft` | ✓ | 5,180 |
| 2 | 作者全局指导 | NovelConfigEditor | ✓ | 412 |
| 3 | 写作 Skill（stage=drafting） | 冻结快照 | ✓ | 340 |
| 4 | 章节材料块 chapterMaterials | 系统运行时拼装 | ✗ | 3,900 |
| 5 | **续写第2/3轮**：`draftAuthorMaterialBlock()` 手工拼装 | 代码 | ✗ | 2,100 |

> ★ 续写轮**不走 `BasePromptBuilder`**（`generate-draft.command.ts:1620/1808`），
> 模板级 taskGuidance **不会**出现在后面轮次——这正是"作者补充指导只覆盖首段"的根因，
> 本 trace 就是用来定位这类问题的。

## 5. 模型输出
### 轮次 1（finishReason=length）
```text
（首段正文）
````

### 轮次 2（续写，finishReason=stop）

```text
（续写内容）
```

```

**差异一目了然**：大纲/蓝图/正文/伏笔/辅助各带自己的 `stepGroup` 与 `path`；路径 C 显式暴露"无模板 key、只能改代码"；正文暴露"续写不带模板指导"。这正是按片段来源调优所需的全部信息。

---

## 7. UI 开关落点

- **状态宿主**：新增 `src/stores/debug-store.ts`（zustand，持久化到 localStorage），字段 `debugPromptTraceEnabled: boolean` + `debugTraceRoot?: string`（自定义路径）。仓库当前无现成 debug 标志（已核）。
- **设置入口**：在 `src/components/settings/SettingsModal.tsx` 下加一个"开发者 / Developer"子页（或并入 `PromptSettings.tsx`），放开关 + 可选路径输入。
- **常驻指示**：`src/components/layout/StatusBar.tsx` 加 `DEBUG: ON` 分段，点击可快速开关，并提供"打开 trace 目录"动作。

---

## 8. 可复用现有机制（省事）

- `GenerationTask.promptBudget.sections`（`src/services/generation/generation-harness.ts`）已做字节级区段标注（含 `writing-skill`）。记录器可直接复用它给 `` 的 `sections` 字段供数，不必重新解析字符串。
- 落盘复用既有 `fs:write-file` IPC（`src/shared/ipc-channels.ts:476`）：`ipc.invokeWithProjectSession(session, 'fs:write-file', path, content, projectPath)`。renderer 不能直写任意路径，统一走主进程 handler。

---

## 9. 实施阶段（增量、可随时停）

- **P0 开关骨架**：`debug-store.ts` + 设置开关 + StatusBar 指示。暂不抓数据。
- **P1 片段层验证**：hook `BasePromptBuilder.build()` 上报，先 `console.log` 跑一轮，确认每个片段的来源/`editable`/`resolvedFrom` 标对。
- **P2 IO 层接线**：hook `GenerationSession.complete` 抓最终 messages + output（**三条路径全覆盖**）；按 `executeWithGenerationRuntime` 作用域把两层配对，经 `fs:write-file` 写外部目录。
- **P3 格式化 + 索引**：按 §6 生成 `input.prompt.md`（人读+模型读）+ `output.txt`；生成 `<runId>/index.md` 与跨 run `INDEX.md` / `index.json`；复用 `promptBudget.sections` 补 `sections`；StatusBar"打开 trace 目录"。
- **P4 边界**：自定义绝对路径 + 沙箱白名单核查；agent 管线（可选，超出"正文链路"范围）。

---

## 10. 验收标准

- 开关 ON → 跑一轮（架构 + 蓝图 + 正文 + 伏笔）→ 外部目录出现 `<runId>/<stepGroup>/<seq>-<key>/{fragment.json, input.prompt.md, output.txt}`，且 `INDEX.md` / `index.json` 同步。
- 打开 `input.prompt.md`：能区分"这段是内置 systemSuffix、代码硬编码、UI 改不了" vs "这段是 NovelConfigEditor 的 globalGuidance、可在 UI 改"，且 `` 可供大模型直接解析。
- **章节蓝图必须被捕获**（路径 B）——v1 会漏。
- **伏笔叙事必须被捕获**（路径 C，无模板 key，`promptKey` 记 `task:*`）。
- 一次 run 内**未实际发生的步骤不产生空目录**；只发生 3 步就只有 3 个目录。

---

## 11. 边界与风险

- **沙箱路径**：自定义绝对外部路径需先确认主进程 `fs:write-file` handler 不拦截；默认放项目数据内最稳，必要时再加专用 `debug:write-trace` IPC。
- **隐私/密钥**：prompt 含用户小说内容（非密钥），无 API Key；`receipt` 只摘 usage 摘要，不写 `errorCode`/内部栈。已去 `<think>`。
- **性能**：关时 no-op；开时每调用一次 `stringify` + 1~2 次 IPC 写，debug 场景可接受。
- **结构化输出**：路径 B 的 `output.txt` 是原始 JSON 串，≠ 落库产物（解析/校验后才是）；trace 需在 META 里注明。
- **无 key 步骤**：路径 C 没有 `EDITABLE_PROMPT_KEYS` 条目，`editable:false`、无 `resolvedFrom`，别误判成"配置缺失"。
- **续写多轮**：一个步骤会多次 `complete`，按 `rounds` 归到同一 `input.prompt.md`，不要碎成多目录。
- **索引写入时机**：`INDEX.md`/`index.json` 每次 run 结束追加一行（追加式，避免全量重写丢历史）。
- **agent 链路**：`assistant_writing_identity` 仅喂右侧作家助手对话，不参与章节生成，本期不抓（避免污染正文调优视野）。

---

## 12. 关键文件速查

- **统一 IO 点**：`src/services/generation/generation-harness.ts:575` `GenerationSession.complete`（**三条**路径共同下游）
- 路径 A 汇聚：`src/services/workflows/commands/base-command.ts:437 callLLMResult`（`:265/:520/:529/:283/:339` 全汇于此）
- 路径 B（绕过 A）：`src/services/workflows/structured-batch-executor.ts:324/:420`；使用者 `directory.command.ts:451`（蓝图）、`architecture.command.ts:1333`、`import-novel.command.ts:31`（逆向推演）、`planning-material.command.ts:20`
- 路径 C（绕过 A/B）：`plot-tree-generator.ts:41`、`narrative-thread-candidate-generator.ts:39/71`（伏笔叙事）、`character-card-generation.command.ts:149`
- **片段来源点**：`src/services/prompts/prompt-builder.ts:14`（`build():28`，`template`/`variables` 在 `:15/:16`）
- 各步骤 key 解析：`architecture.command.ts:854/1046/1143/1473/1788/1946`（config/premise/角色/世界观/弧光/大纲）、`directory.command.ts:342`（蓝图）、`refine-draft.command.ts:40`（AI 修稿）、`refine-from-review.command.ts:79`（审稿修稿）、`review-chapter.command.ts:48`（审稿）、`finalize-chapter.command.ts:190/283`（章节要点/角色卡）、`import-novel.command.ts:354/355/625`（逆向推演）
- 内置模板：`src/services/builtin-prompt-templates.ts`（`EDITABLE_PROMPT_KEYS:37`、`ARCHITECTURE_PROMPT_KEYS:74`）
- 生效来源判定：`src/services/prompt-catalog.ts:239 peek()` → `'project'|'global'|'builtin'`
- 可编辑 UI 字段：`PromptSettings.tsx` / `NovelConfigEditor.tsx:510` (globalGuidance) / `DirectoryConfigDialog.tsx:89,518` (pacingGuidance)
- 续写旁路（不带模板指导）：`generate-draft.command.ts:1620/1808`（`draftAuthorMaterialBlock()`）
- 区段归因复用：`generation-harness.ts` 的 `promptBudget.sections`
- 落盘通道：`src/shared/ipc-channels.ts:476` (`fs:write-file`)
- 设置/状态栏：`SettingsModal.tsx` / `StatusBar.tsx` / `src/stores/layout-store.ts`
```
