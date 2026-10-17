# Debug 开关：Prompt 片段追踪与输入输出落盘（设计稿）

> 目标：UI 加一个 debug 开关，打开后把每次生成的 **input（含组装前的原始 prompt 片段，带来源定位）** 与 **output（架构层 / 章节蓝图 / 正文）** 写到外部文件夹，方便按"片段来源"做具体调优，而不是在代码里翻。
>
> 状态：设计稿，待评审。原则——设计先行，审核后再编码。

---

> 状态：v4（P2 落地：runHandle 作用域注入 + 项目内落盘 + IO 抓取）。P0（追踪开关骨架 + 提示词热重载，commit 5c77f8f）、P1（片段层追踪，commit 25c987a）、P2（IO 接线，路径 A）**已施工并提交**；P3（路径 B/C）起为待办。v1 的"唯一 chokepoint = `callLLMResult`"判断**已作废**。

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

**设计要求**：单一 markdown 文件承载三件事——① 组装构成（哪些片段拼成的）② 来源（每块从哪来、谁写的、能不能在 UI 改、去哪改）③ 输出（模型原始产出）。

**首读者是"调 prompt 的作者"，不是"读代码的工程师"**（这是立项理由，见开篇）——所以正文用**人话标题 + 四列表格**（是什么 / 谁写的（现在生效）/ 能改吗 / 去哪改），"去哪改"给**UI 入口路径**而非 `file:line`；工程枚举（`sourceKind` / `resolvedFrom` / `path`）退居 `` 注释块，只给机器读。一个文件、两种读者。

**色标三态**（渲染器给正文加类名，纯文本降级为文字标注）：
- 🔵 可改（内置默认）· 🟢 可改（你的全局覆盖）· 🟣 可改（你的项目覆盖）
- 🟡 系统自动加（你没写、系统补的）
- 🔴 代码硬编码（**UI 改不了，想改只能动代码**）

### 6.1 通用骨架（**每个**步骤的 `input.prompt.md` 都长这样）

````markdown
# Prompt 追踪快照

- 生成任务：`chapter-draft`
- 关联句柄：`项目/纪元/运行`
- 章节：第 1 章
- 记录时刻：2026/10/12 23:51:01
- 片段批次：1
- 请求面来源：**实际发出（与模型收到的一致）** 或 **按装配结果重建**

## 1. `<promptKey>`（如 `first_chapter_draft`）

组装后长度：11283 字 · 共 4 块

### 1.1 拼装后的完整提示词（发送给模型前）★ 首屏

> **评估提示词质量只看这一节**。模板态（带 `{{var}}`）在后面，仅用于回答"这块从哪来、能不能改"。

两种来源按可信度择一，并在文件头与本节内显式标注：

- **实际发出** —— 用 `io.messages` 逐字呈现（与模型收到的完全一致，**包含运行时注入的「补充写作 Skill」**）。
- **按装配结果重建** —— 未拿到真实请求面时，用 `systemMessage` + `built` 拼出骨架；
  运行时注入的内容不在此列，故必须标注来源，不得让人误以为就是发出的全部。

```text
#### system
（systemRole + 代码追加的「不可变系统合同」）

#### user
（build() 结果：模板正文替换变量 + taskGuidance + systemSuffix + requiredContext）
```

### 1.2 片段来源（可改性归因）

| 序号 | 来源 | 名称 | 可改 | 生效来源 | 变量 |
| --- | --- | --- | --- | --- | --- |
| 1 | override-content | 这个步骤的提示词模板正文 | 可改 | global | `{{architecture}}` … |
| 2 | override-taskGuidance | 补充创作指导 | 可改 | global | — |
| 3 | override-systemRole | 创作角色定位（system） | 可改 | global | — |
| 4 | builtin-systemSuffix | 输出格式与判定标准（自动追加） | 锁定 | builtin | `{{novel_config}}` … |

> 一句话读法：**看"可改吗"这一列** —— 想调优就只动可改的；锁定的改了也没用（见 §7.1）。

#### 第 N 块 · <名称>
- 来源：`<sourceKind>` · 生效于 `<global|project|builtin>`
```text
（该片段的**原始模板**，变量未替换——只用于定位来源与可改性）
```

## 模型输出

- finishReason：`stop`
```text
（模型输出正文）
```

未捕获到输出时明确写出原因（该链路在主进程执行 / 请求面未回传），不留空节。
````

**首屏规则的由来（P2.2 修正）**：P2.1 的实现把片段表放在最前、把「组装后正文」放到第 3 节，
于是**人打开文件看到的仍是 `{{architecture}}` 这类模板占位**，无法评估提示词质量——
这与本功能的目的（调优提示词）相反。现改为：**拼装态优先，模板态殿后**。

#### 6.1.1 关键设计点：三条"看家字段"

1. **"谁写的（现在生效）"** —— 直接回答作者最常问的"全局的还是项目的"。取值 = `project`/`global`/`builtin`（人话翻译）+ 你的 UI 入口。
2. **"能改吗"** —— 由系统判定（`EDITABLE_PROMPT_KEYS` + `sourceKind`），不是手写。🔴 出现即说明"这段你改 UI 无效"。
3. **``（机器读）** —— 紧凑 JSON，给大模型扫，含 `seq`/`stepGroup`/`path`/`resolvedFrom`/`editable`/`builtinRevision`。人类不需要读它。

```json
<!-- TRACE-META
{"v":1,"runId":"8f3a21c0","seq":1,"stepGroup":"architecture","promptKey":"synopsis",
 "path":"A","resolvedFrom":"global","editable":true,"archChain":true,
 "builtinRevision":"r7","overrideBuiltinRevision":"r5","blocks":5,"bytes":5632}
TRACE-META -->
```

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

### 6.3 情节大纲（`synopsis`，路径 A）实例

```markdown
# TRACE · synopsis · 情节大纲

> 一句话摘要：这次 prompt 由 **3 块**拼成 —— 你能改 **2 块**，系统自动加 **1 块**。

## 1. 这次 prompt 由哪几块拼成

| # | 这一块是什么 | 谁写的（现在生效） | 能改吗 | 去哪改 | 字节 |
|---|-------------|------------------|--------|--------|------|
| ① | 出厂设定（模板正文） | 内置 `synopsis` | 🔵 能 | 设置→提示词模板→情节大纲 | 4,120 |
| ② | 你的全局写作要求 | 你的**项目**级设置 | 🟣 能 | 小说配置→全局写作要求 | 412 |
| ③ | 系统补回的必需上下文 | 系统自动 | 🟡 否 | —（自动） | 980 |
| Σ | | | | | 5,512 |

> 本步走路径 A（`callLLMResult`）；架构链模板，改正文会级联下游，建议只在「补充创作指导」里增补。

## 5. 模型输出
```text
【情节大纲】第1卷 ...
- 第1章：因为主角误触古镜（X），所以被卷入（Y）……
```

```json
<!-- TRACE-META
{"v":1,"runId":"8f3a21c0","seq":1,"stepGroup":"architecture","promptKey":"synopsis",
 "path":"A","resolvedFrom":"global","editable":true,"archChain":true,"blocks":3,"bytes":5512}
TRACE-META -->
```

````

### 6.4 伏笔叙事（**无模板 key**，路径 C）实例

```markdown
# TRACE · task:narrative-thread-plan · 伏笔叙事（规划）

> 一句话摘要：这次 prompt 由 **2 块**拼成 —— **0 块你能改**（本步骤没有 UI 入口，只能动代码）。

## ⚠️ 先说清楚：这一步没有"提示词模板"

它不走你熟悉的"设置→提示词模板"，task 由**代码** `buildNarrativeThreadPlanTask()`（`shared/narrative-thread-generation-pure.ts`）直接拼装。
所以：**没有"全局/项目覆盖"，也没有"恢复默认"** —— 报告里它归为 🔴 代码硬编码。

## 1. 这次 prompt 由哪几块拼成

| # | 这一块是什么 | 谁写的（现在生效） | 能改吗 | 去哪改 | 字节 |
|---|-------------|------------------|--------|--------|------|
| ① | task 主体 | 代码 `narrative-thread-generation-pure.ts` | 🔴 否 | 只能改代码 | 1,860 |
| ② | 全书章节清单 | 系统自动派生 | 🟡 否 | —（自动） | 420 |
| Σ | | | | | 2,280 |

## 5. 模型输出
```json
{ "candidates": [ { "id": "T1", "plantAt": 2, "resolveAt": 18, "summary": "…" } ] }
```

```json
<!-- TRACE-META
{"v":1,"runId":"8f3a21c0","seq":5,"stepGroup":"aux","promptKey":"task:narrative-thread-plan",
 "path":"C","resolvedFrom":"none","editable":false,"blocks":2,"bytes":2280}
TRACE-META -->
```

````

> 同类还有 `plot-tree-generator.ts`（路径 C）；都在索引里各占一行，`promptKey` 记 `task:<label>`。

### 6.5 章节蓝图（`chapter_blueprint_chunk`，路径 **B**）实例

```markdown
# TRACE · chapter_blueprint_chunk · 章节蓝图（分块）

> 一句话摘要：这次 prompt 由 **5 块**拼成 —— 你能改 **3 块**，系统自动加 **2 块**。

## 1. 这次 prompt 由哪几块拼成

| # | 这一块是什么 | 谁写的（现在生效） | 能改吗 | 去哪改 | 字节 |
|---|-------------|------------------|--------|--------|------|
| ① | 出厂设定（模板正文） | 内置 `chapter_blueprint_chunk` | 🔵 能 | 设置→提示词模板→章节蓝图（分块） | 6,240 |
| ② | 你的全局写作要求 | 你的**项目**级设置 | 🟣 能 | 小说配置→全局写作要求 | 412 |
| ③ | 本步骤来自作者补充（节奏/风格） | 你的**章纲**级设置 | 🟢 能 | 生成章节蓝图对话框→节奏/风格指导 | 88 |
| ④ | 上游大纲投影 | 系统自动派生 | 🟡 否 | —（自动） | 2,310 |
| ⑤ | 章节列表 | 系统自动派生 | 🟡 否 | —（自动） | 640 |
| Σ | | | | | 9,690 |

> 本步由 `directory.command.ts:451` 经 `createStructuredBatchExecutor` 直连 `session.complete`，
> **不经 `callLLMResult`**（v1 会漏掉的就是它）。

## 5. 模型输出
```json
{ "blueprints": [ { "chapterNumber": 1, "title": "…", "keyEvents": […], "breakHook": "…" } ] }
```

> ⚠️ 此处是**原始 JSON 串**，≠ 落库后的 blueprint 记录（还要经解析/校验/`blueprint_commit_operations`）。

```json
<!-- TRACE-META
{"v":1,"runId":"8f3a21c0","seq":2,"stepGroup":"blueprint","promptKey":"chapter_blueprint_chunk",
 "path":"structured-batch","resolvedFrom":"project","editable":true,"chunk":true,"blocks":5,"bytes":9690}
TRACE-META -->
```

````

### 6.6 正文多轮续写（`first_chapter_draft` / `next_chapter_draft`）实例

```markdown
# TRACE · first_chapter_draft · 第一章草稿

> 一句话摘要：这次 prompt 由 **5 块**拼成（首轮）—— 你能改 **3 块**；★ 第 2/3 轮**重装后只剩 2 块可改**。

## 1. 这次 prompt 由哪几块拼成

| # | 这一块是什么 | 谁写的（现在生效） | 能改吗 | 去哪改 | 字节 |
|---|-------------|------------------|--------|--------|------|
| ① | 出厂设定（模板正文） | 内置 `first_chapter_draft` | 🔵 能 | 设置→提示词模板→第一章草稿 | 5,180 |
| ② | 你的全局写作要求 | 你的**项目**级设置 | 🟣 能 | 小说配置→全局写作要求 | 412 |
| ③ | 写作 Skill（drafting 阶段） | 冻结快照 | 🔵 能 | 设置→写作 Skills | 340 |
| ④ | 章节材料块 | 系统运行时拼装 | 🟡 否 | —（自动） | 3,900 |
| ⑤ | **续写第2/3轮**的补写块 | 代码 `draftAuthorMaterialBlock()` | 🔴 否 | 只能改代码 | 2,100 |

> ★ 续写轮**不走 `BasePromptBuilder`**（`generate-draft.command.ts:1620/1808`），
> 模板级「补充创作指导」**不会**出现在后面轮次——这正是"作者补充指导只覆盖首段"的根因，
> 本 trace 就是用来定位这类问题的。

## 5. 模型输出
### 轮次 1（finishReason=length）
```text
（首段正文）
```

### 轮次 2（续写，finishReason=stop）
```text
（续写内容）
```

```json
<!-- TRACE-META
{"v":1,"runId":"8f3a21c0","seq":3,"stepGroup":"draft","promptKey":"first_chapter_draft",
 "path":"A","resolvedFrom":"global","editable":true,"rounds":3,"blocks":5,"bytes":11932}
TRACE-META -->
```

````

**差异一目了然**：大纲/蓝图/正文/伏笔/辅助各带自己的 `stepGroup` 与 `path`；路径 C 显式暴露"无模板 key、只能改代码"；正文暴露"续写不带模板指导"。每块的"能改吗 / 去哪改"直接指向 UI 入口 —— 这正是按片段来源调优所需的全部信息。

---

## 7. Prompt 的「全部人工输入面」清单（作者可改的一切）

调优的前提是**知道一共几个入口**。逐一核对代码后，作者能人工影响生成内容的输入面只有下面这些，追踪必须**全覆盖**：

| 输入面（UI 入口） | 具体内容 | 归属 | 注入方式 | 代码位置 |
|---|---|---|---|---|
| 设置→**提示词模板** | 25 个模板的 `content` / `systemRole` / `taskGuidance` | 全局 + 项目双层 | `resolvePromptTemplate` | `prompt-catalog.ts` |
| 设置→**写作 Skills** | 分阶段创作方法 | 全局 | `writingSkills` 按 stage 前置 | `base-command.ts:462` |
| **小说配置** | 核心大纲(=前提)、世界观/初始设定、质量与连续性… | 项目级 | `novel_config` / `global_guidance` 变量 | `NovelConfigEditor.tsx` |
| 小说配置→**全局写作要求** | `globalGuidance` | 项目级 | `{{global_guidance}}`（11 模板） | `NovelConfigEditor.tsx:510` |
| 故事架构各步的**本步骤额外指导** | 前提/角色/世界观/弧光/大纲，每步一段 | 项目级 | `{{step_guidance}}` + 模板 systemSuffix | `architecture.command.ts` |
| **生成章节蓝图** 对话框→节奏/风格指导 | 如"前30章快节奏" | 章纲级 | `{{pacing_guidance}}` | `DirectoryConfigDialog.tsx:518` |

> ★ **统一说辞（已定名，采纳作者提议）**：上表最后两行（架构各步 step_guidance、章纲的 pacingGuidance）虽然**散在不同对话框**，但**语义同类——当前这一步的作者补充**。追踪报告与人读界面里**统一归为 `step-note`，显示名固定为「本步骤来自作者补充」**，用同一种说法呈现，不再让作者困惑"这两处是不是一回事"。

### 7.1 已被系统结构性承载的（改这些没用，别白改）

调 prompt 前先知道哪些**系统已经强制**，否则改了也不生效（详见项目笔记）：

| 已由系统强制 | 出处 |
|---|---|
| 章末钩子必须具体 | `blueprint-semantic-contract.ts` + 校验 |
| 伏笔三段式 埋→浮现→收 | `narrative-thread.ts` 状态机 |
| 「某章必须发生 X」 | 备注写 `【第N章必现】` → 冻结清单 → 审稿核对 |
| 黄金三章 / 第1章开场高能 / AI味反制 4 条 / 排版 | 模板 content + **systemSuffix（用户覆盖不到）** |
| 文风仅选表达方式、无需逐条兑现 | 三份草稿模板 systemSuffix【文风适用边界】 |

> 推论：**报告里标 🔴（代码硬编码）的片段，作者改 UI 是无效的**——这正是要一眼标红的原因。

---

## 8. Prompt 缓存热重载（解决"改了要重启"）

### 8.1 问题（已核）
- 全局覆盖：`ensureGlobalLoaded()`（`prompt-catalog.ts:273`）`globalLoaded=true` 后**永不重读**；全代码**无 fs.watch**。
- 项目覆盖：按 `sessionKey` 缓存（`ensureProjectLoaded()`），仅切项目时 `clearProject()` 清一次（`prompt-templates.ts:17`）。
- **真相分两种路径**：
  - **在 UI 保存** → `commit()`（`:176`）**当场更新内存缓存**，其实**即刻生效、不用重启**。
  - **外部改磁盘 json**（IDE/记事本）或**调优反复试版本** → 要重启。这才是真痛点。

### 8.2 解法：给 `PromptCatalog` 加 reload + UI 刷新入口
1. **`reloadGlobal()`**：置 `globalLoaded=false`，重新 `ensureGlobalLoaded()`，重建 `globalPrompts`。
2. **`reloadProject(session)`**：复用已有 `clearProject()` 清缓存，再 `ensureProjectLoaded()`。
3. **UI 刷新按钮**：设置页顶部 + `StatusBar` 各放一个「重新加载提示词」；**保存后自动 reload**（双保险）。
4. **可选增强**：debug 开启时对 `VELA_HOME/prompts/` 与 `<项目>/.ai-novel/prompts/` 做**轻量 mtime 轮询**，变了自动 reload——彻底免手动。

### 8.3 风险控制
- reload **只换内存快照**，不改生成中的会话。生成中应**禁点或排队**到生成结束，避免一次生成读到半新半旧的片段。
- reload 与 §4 的片段 hook 天然协同：reload 后再生成，trace 的 `resolvedFrom` 会立刻反映新版本——**调优闭环 = 改 → 刷新 → 跑一步 → 看新 trace**。

### 8.4 实施状态（已落 P0，commit 5c77f8f）
- ✅ `PromptCatalog.reloadGlobal()` / `reloadProject()` 已实现；`prompt-templates.ts` 暴露 `reloadGlobalCustomPrompts()` / `reloadProjectCustomPrompts(session)`。
- ✅ 三处入口：`PromptSettings.tsx` 顶部按钮、新增「开发者」设置分类、`StatusBar.tsx` 左侧「重载提示词」分段。
- ⬜ mtime 轮询自动重载（可选增强）未做。

> ★ **命名留档**：作者明确"也许以后可以做个全套装配的工具，或者 agent 整体调优配置，那刷新就很管用了"——本 §8 的 reload 是那个未来工具的**地基**：任何"改配置→立即重跑"的闭环都依赖它。

---

## 9. UI 开关落点

- **状态宿主（已实现）**：新增 `src/stores/debug-store.ts`（zustand，持久化到 localStorage，键 `ai-novel-writer.debug`），字段 `promptTraceEnabled: boolean` + `traceRoot: string | null`（自定义路径）。工厂 `createDebugStore(storage)` 可注入内存存储供测试。仓库此前无现成 debug 标志（已核）。
- **设置入口（已实现）**：`SettingsModal.tsx` 新增「开发者 / Developer」分类（`SettingsSection` 加 `'developer'`），内含 `DeveloperSettings.tsx`：追踪开关 + 可选路径输入 + 热重载按钮。
- **常驻指示（部分实现）**：`StatusBar.tsx` 左侧加「重载提示词」分段（已实现）；`DEBUG: ON` 分段 + 「打开 trace 目录」动作**待 P2/P3**（落盘目录要先存在）。

---

## 10. 可复用现有机制（省事）

- `GenerationTask.promptBudget.sections`（`src/services/generation/generation-harness.ts`）已做字节级区段标注（含 `writing-skill`）。记录器可直接复用它给 `` 的 `sections` 字段供数，不必重新解析字符串。
- 落盘复用既有 `fs:write-file` IPC（`src/shared/ipc-channels.ts:476`）：`ipc.invokeWithProjectSession(session, 'fs:write-file', path, content, projectPath)`。renderer 不能直写任意路径，统一走主进程 handler。

---

## 11. 实施阶段（增量、可随时停）

- ✅ **P0 开关骨架（已完成，commit 5c77f8f）**：`debug-store.ts`（zustand + localStorage）+ 新增「开发者」设置分类（追踪开关 + 自定义落盘目录）+ 提示词热重载（§8，三处入口）。暂不抓数据。
- ✅ **P1 片段层（已完成，commit 25c987a）**：`prompt-trace.ts`（`deriveFragments()` 纯函数归因 + `recordFragments()` 短路捕获 + 环形快照 + `console.table` 核对视图）；`build()` 尾部 side-channel 上报（不改返回值）；`install-prompt-trace.ts` 装配 sink（读 debug-store + `promptCatalog.peek`）；`main.tsx` 启动装配。9 例单测。
- ✅ **P2 IO 层接线（已完成，路径 A）**：
  - `trace-scope.ts`（新）：命令级「当前任务」广播栈。`executeWithGenerationRuntime` 进入时 push、退出时 pop；`build()` 是同步的，靠它读到 `runHandle`/`operation`/`projectSession`。
  - `prompt-trace-writer.ts`（新）：按作用域归并「片段快照 + 真实请求 IO」，写 `<项目根>/debug/prompt-trace/<时间戳>-<操作>-<runId>.{md,json}`。30ms 短定时器聚合（片段先捕获、IO 后到达），失败只 warn 不阻断。
  - `generation-harness.ts`：新增通用 `setHarnessIoObserver`（**不直接依赖 trace 模块**，主进程引用本文件时零连带加载）；`complete()` 成功路径上报 messages + output + finishReason。
  - `install-prompt-trace.ts`：注入 `runHandle`（读 trace-scope）、`setSnapshotSink`（落盘调度）、`setHarnessIoObserver`（IO 抓取）。
  - **范围决策**：本期只覆盖路径 A（走 `BasePromptBuilder` + `callLLMResult` 的主链路）。路径 B/C 见 P3/P4。
  - **落点决策**：固定写项目根内 `debug/prompt-trace`——`fs:write-file` 强制目标在项目根内（既有沙箱边界），写到项目外需新增专用受控 IPC，收益不抵新增攻击面。`debug-store.traceRoot` 保留为预留字段。
- ✅ **P2.1 落盘可靠性补丁（已完成）**：首轮实测出现「面板停在『已捕获 1 块，等待落盘』、磁盘无文件」。三处根因：
  1. **主进程写盘失败不抛错而是返回 `{success:false}`** —— `fs:write-file` / `fs:mkdir` 的 handler 用 `projectFilesystemFailure()` **return** 失败对象。渲染层原实现只 `await` 不判 `success`，会把「目标越界 / 租约失效」静默当成写成功。→ 现在显式判 `success`，失败抛错进入 `failed` 回显。
  2. **落盘只靠 30ms 短定时器，缺确定时序收尾** —— 定时器可能在作用域状态变化时错过。→ `trace-scope.ts` 新增零依赖的 `setTraceScopeTeardownHook` / `runTraceScopeTeardown`，由 `install-prompt-trace.ts` 注入 `flushTraceNow`；`executeWithGenerationRuntime` 的 `finally` 在 `disposeTraceScope()` **之前** await 一次收尾。用注入而非直接 import，避免把渲染层依赖（ipc-client / debug-store）拖进工作流分层（100+ 工作流测试跑在无 window 的 Node 环境）。
  3. **无作用域时静默 return，面板永远停在"等待落盘"** —— 旧 `scheduleTraceFlush` 首行 `if (!scope) return`，不产出任何 outcome。→ 现在所有早退分支都产出 `skipped` + 可读原因（`reportSynthetic`），定时器回调也加 `.catch()` 兜底。
  - **顺带修重复落盘**：同一作用域会被触发两次（短定时器 + 收尾），引入 `flushedWatermark` 判重——内容未变则跳过，IO 后到（`noio → io`）才覆盖写一次。
- ✅ **P2.2 补齐「域外装配」的三条链路（已完成）**：P2.1 把失败变成可见后，面板报出「提示词装配发生在生成作用域之外」。逐一排查后确认**三条链路的提示词装配确实不在 trace scope 内**（`build()` 落在 `executeWithGenerationRuntime` 之外）：
  1. **`analyze-style`（普通文风分析）**：`execute()` 的非导入分支直接 `this.executeWithinGeneration(params)`，而 `executeWithGenerationRuntime` 只在方法**尾部**、且只包住 `generate`，头部的 `build()` 在作用域外。→ 把装配移进 `generate` 内（它本来就只服务于那次调用）。**注意**：不能改「包装上移」，因为 `selectedFinalizedDraftIds`/`authorInputs` 是采样后才知道的，且被 `structured-planning-runtime.test.ts` 锁定。
  2. **`generate-draft`（正文）**：它**自建 runtime**（需要用专用 `DRAFT_GENERATION_BUDGET`），从不经过 `executeWithGenerationRuntime`，因此没有任何地方广播作用域。→ 在外层 `try` 内手动 `pushTraceScope`，`context.mainGenerationRunHandle` 由 begin 阶段写入，故在 `runtime.execute` 回调开头回填 `traceScope.runHandle`；`finally` 里先 `runTraceScopeTeardown()` 再 dispose。
  3. **`finalize-chapter`（章节要点 / 角色卡）**：由独立的 `runFinalizationGeneration` 驱动（句柄经 `onHandle` 回调写入 `context`），本命令不建 runtime。→ 构造 `traceScope` 对象后，把 `pushTraceScope` **推迟到 `runPostProcessPipeline` 调用前一行**（前后无可抛错语句，确保 `finally` 一定能 dispose，不会泄漏作用域栈）；`onHandle` 回调内回填 `runHandle`。
  - **诊断增强**：域外回显带上 `promptKey`（「…生成作用域之外（promptKey=xxx）…」），避免再靠读代码反推是哪一步。
  - **同批次核对（确认本就安全，无需改动）**：`refine-draft` / `review-chapter` / `refine-from-review` 的 `build()` 都在 `generateAndCommit` 内，而基类 `ReviewRevisionCommand` 就在 `executeWithGenerationRuntime` 里调用它；`directory`（蓝图）的 `build()` 在 contract 回调内，由 `:438` 的运行时包住。
- ✅ **P2.3 首屏改成「拼装态」+ 补 main-owned 的真实请求面（已完成）**：首轮真实落盘产出后暴露两个问题。
  1. **人看到的还是模板**——`.md` 只渲染 `fragments[].rawText`（变量未替换），`built`（组装后全文）虽已捕获、只进了 `.json`。→ `buildMarkdown` 重构：**首屏 = 拼装后的完整提示词**，模板片段后置且明确标注「变量未替换，仅用于定位来源」。
  2. **`io` 整段缺失**——`chapter-draft` 属 **main-owned**（`createWorkflowMainGenerationRuntime` → `createMainOwnedGenerationRuntime` → `transport` 走 IPC），真正的请求在主进程发出，渲染层的 `setHarnessIoObserver` 根本不会触发。→ `generation-runtime.ts` 在 `transport.execute` 前新增 `setMainTaskIoObserver`（同样只暴露回调、不依赖追踪模块），上报**补全后的 messages**（含 `injectWritingSkillIntoTask` 注入的写作 Skill）与回传的输出；`install-prompt-trace.ts` 把两个观察点接到同一个 `recordTraceIo`。
  - **顺带修两个由多跳请求暴露的落盘缺陷**：
    - **文件名改为按作用域稳定**（`scope.startedAt` 而非写入时刻）。原来每次增量写盘都会**新增**一份半成品；现在一轮生成只对应一份文件，增量覆盖写。
    - **水位判定改用内容指纹**（FNV-1a）。原来只比「快照数 + 有无 IO」，而一轮的两跳请求（短纲 → 正文）长度可能恰好相同，会被判成"没变"而**丢掉后一跳的请求面**。
  - **system message 的捕获**：`PromptTraceSnapshot` 新增 `systemMessage`，由 `composePromptSystemRole(template, lang)` 得到（= `systemRole` + 代码追加的「不可变系统合同」）。合同段不属于任何可编辑片段，但真实出现在请求里，评估时必须能看到。重建路径下把它作为 `system` 节渲染。
- ✅ **P2.4 一轮多次调用全量保留（已完成）**：作者实测正文一轮**发了三次请求**（日志：短纲 → 初始生成 → 自动续写第 1 段），而落盘文件的「模型输出」**只有最后一次**。根因是 `pendingIo` 用 `Map<runKey, TraceIoRecord>` **单值存**，后一次直接覆盖前一次；且 `flushTraceFile` 的 `finally` 每次落盘就 `delete`，等于把"累积"彻底断掉。→ 三处改动：
  1. **`pendingIo` 改为按作用域累积的数组**（`Map<runKey, TraceIoRecord[]>`），去掉每次落盘后的 `delete`；清理点改到「作用域退出」这个确定时刻（`releaseTraceScopeState()`，由收尾钩子在落盘后调用），并加 `MAX_PENDING_SCOPES=32` 兜住异常路径。
  2. **每次调用带上 `purpose`**（`task.purpose`：`chapter-draft-short-outline` / `chapter-draft` / `chapter-draft-continuation` / `chapter-draft-condense` 等）。两个观察点（`generation-harness` 的 `complete`、`generation-runtime` 的 `transport.execute`）都能拿到，此前白白丢弃 —— 有了它才能逐次区分、逐次标注。
  3. **`io` → `ioCalls`（数组）**，payload 与 markdown 同步：新增「实际发出的请求与输出（N 次调用）」章节，按发生顺序列出每一次的 system/user/模型输出；水位判定也改为对**全部调用**取指纹。
  - **顺带修一个关联误判**：单快照 + 单调用曾无条件互相认领，但"唯一录到的那次"可能属于**另一个阶段**（作者那份真实数据正是如此：快照是「首次成稿」，唯一录到的请求却是「自动续写」）→ 会把续写请求当成首次成稿的提示词，直接误导调优。现在要求**真实请求里确实包含该快照的组装正文**（取 `built` 前 120 字做包含判断）才关联，判不出就退回重建 + 全量列出。
- **P3 结构化路径（路径 B/C）**：路径 B（`structured-batch-executor`，蓝图等）与路径 C（`plot-tree-generator`/`narrative-thread-candidate-generator` 等直连 `session.complete`）。前者绕过提示词装配，能抓到的信息有限；后者无模板 key，`promptKey` 记 `task:*`。
- **P4 收尾**：`INDEX.md`/`index.json` 跨 run 索引；StatusBar「打开 trace 目录」；自定义绝对路径 + 沙箱白名单核查。

---

## 12. 验收标准

**P2 已达成（路径 A）**：
- 开关 ON → 跑一轮走主链路的生成（架构各步 / 蓝图 / 正文 / 精修）→ `<项目根>/debug/prompt-trace/` 出现 `<时间戳>-<操作>-<runId>.md` 与 `.json`。
- `.md` **首屏必须是拼装后的完整提示词**（变量已替换）；模板态（含 `{{var}}`）只能出现在后半段且需标注「仅用于定位来源」。首屏位置必须早于片段表。
- **请求面来源必须显式标注**：拿到真实请求面时标「实际发出（与模型收到的一致）」并逐字呈现（含运行时注入的写作 Skill）；未拿到时标「按装配结果重建」并说明缺什么，不得让人误以为就是发出的全部。
- `.md` 能区分「这段是内置 systemSuffix、代码硬编码、UI 改不了」vs「这段来自项目/全局覆盖」。
- 追踪 OFF 时零开销（`recordFragments` 首行短路）；落盘失败只 warn，不影响生成结果。
- 无作用域 / 无项目会话 / 无快照时不写文件（不产生空文件噪音）。
- **面板不得停在"等待落盘"**：任何一次 `build()` 捕获后（无论走哪条分支），状态面板都必须给出终态——`已写出 N 份` / `本次未写出文件 + 原因` / `落盘失败 + 原因`。只有"落盘正在进行中"才允许短暂显示等待态。
- **同一轮生成只产生一份文件**：文件名按作用域稳定；短定时器 / 作用域收尾 / 一轮内多次 LLM 调用都覆盖写同一份文件，不产生半成品残留。
- **一轮内多次 LLM 调用的请求面不得丢失**：短纲 → 正文两跳的 messages 可能长度相同，水位判定必须基于**内容**而非长度。
- **一轮内每一次调用的请求与输出都必须保留**：`ioCalls` 是数组，按发生顺序全量落盘（实测正文一轮 3 次：短纲 / 初始生成 / 自动续写），并带 `purpose` 供人区分；「模型输出」只留最后一次即为不合格。人读面必须有「实际发出的请求与输出（N 次调用）」章节。
- **不得张冠李戴**：只有当真实请求里确实包含某快照的组装正文时，才把该次请求当作该快照的提示词；否则一律按装配结果重建 + 全量列出请求。
- **不出现「生成作用域之外」**：架构各步 / 蓝图 / 正文 / 精修 / 审稿 / 文风分析 / 定稿后处理，凡走提示词装配的链路都必须落在 trace scope 内并能落盘（P2.2 已按此逐条核对）。

**P3 待达成（路径 B/C）**：
- 章节蓝图被捕获（路径 B）。
- 伏笔叙事被捕获（路径 C，无模板 key，`promptKey` 记 `task:*`）。
- 一次 run 内**未实际发生的步骤不产生空文件**。

---

## 13. 边界与风险

- **沙箱路径**：自定义绝对外部路径需先确认主进程 `fs:write-file` handler 不拦截；默认放项目数据内最稳，必要时再加专用 `debug:write-trace` IPC。
- **隐私/密钥**：prompt 含用户小说内容（非密钥），无 API Key；`receipt` 只摘 usage 摘要，不写 `errorCode`/内部栈。已去 `<think>`。
- **性能**：关时 no-op；开时每调用一次 `stringify` + 1~2 次 IPC 写，debug 场景可接受。
- **结构化输出**：路径 B 的 `output.txt` 是原始 JSON 串，≠ 落库产物（解析/校验后才是）；trace 需在 META 里注明。
- **无 key 步骤**：路径 C 没有 `EDITABLE_PROMPT_KEYS` 条目，`editable:false`、无 `resolvedFrom`，别误判成"配置缺失"。
- **续写多轮**：一个步骤会多次 `complete`，按 `rounds` 归到同一 `input.prompt.md`，不要碎成多目录。
- **索引写入时机**：`INDEX.md`/`index.json` 每次 run 结束追加一行（追加式，避免全量重写丢历史）。
- **agent 链路**：`assistant_writing_identity` 仅喂右侧作家助手对话，不参与章节生成，本期不抓（避免污染正文调优视野）。

---

## 14. 关键文件速查

**追踪自身（P0~P2.4）**
- 追踪开关与状态：`src/stores/debug-store.ts`（`promptTraceEnabled` / `traceRoot` 预留）、`src/components/settings/DeveloperSettings.tsx`
- 片段归因：`src/services/prompts/prompt-trace.ts`（`deriveFragments()` 纯函数 + `recordFragments()` 短路捕获 + `setSnapshotSink`；快照含 `built`（组装后 user 正文）与 `systemMessage`）
- 作用域广播：`src/services/prompts/trace-scope.ts`（`pushTraceScope` / `currentTraceScope` / `declareTraceScopeChapterRange` / `setTraceScopeTeardownHook` / `runTraceScopeTeardown`）——**零依赖，可被工作流核心安全引用**
  - `declareTraceScopeChapterRange(from, to)`：声明本批章节范围，只影响文件名里的**章节段**。给"既没有 `chapterNumber`、模板里也没有 `n`/`m`"的链路用（**目前只有大纲**：它的章号原本只存在于**后到的** `ioCalls[].purpose`（`plot-outline:chapter:N`），而文件名在首次落盘时就钉住了 → 不显式声明就永久缺段）。调用方必须在**装配（`build()`）之前**声明；名字一旦钉住则拒绝再改（否则会写出第二份文件）。现有调用点：`architecture.command.ts` 的批量路径（`from`/`to` 定稿后）与 `executeChapterOutline`（`initial.range`）。
- 落盘：`src/services/prompts/prompt-trace-writer.ts`（`recordTraceIo` 按作用域**累积多次调用** / `releaseTraceScopeState` 作用域退出回收 / `scheduleTraceFlush` / `flushTraceNow` / `TraceFlushOutcome` 订阅），落到 `<项目根>/debug/prompt-trace/`
- markdown 渲染：`src/services/prompts/prompt-trace-markdown.ts`（**零运行时依赖纯函数**；首屏拼装态 + 「实际发出的请求与输出（N 次调用）」；离线预览复用此入口）
- 状态回显 UI：`src/components/settings/PromptTraceStatus.tsx`（四态：等待/已写出/未写出/失败）
- 装配：`src/services/prompts/install-prompt-trace.ts`（`main.tsx` 启动调用一次；注入 sink + 两个 IO 观察者 + 收尾钩子（落盘后释放作用域内存态））
- IO 抓取点（二选一，覆盖全部执行位置；**上报都带 `task.purpose`**）：
  - **本地执行**：`src/services/generation/generation-harness.ts` `setHarnessIoObserver` + `complete()` 返回路径
  - **主进程代跑（main-owned）**：`src/services/generation/generation-runtime.ts` `setMainTaskIoObserver` + `transport.execute` 前后
- 作用域注入点：`src/services/workflows/commands/base-command.ts` `executeWithGenerationRuntime`（push 作用域 → 操作体 → **收尾落盘** → pop）

**⚠️ 为什么需要两个 IO 观察点（踩过坑）**

`main-owned` 的生成（正文等）由**主进程**执行：`createWorkflowMainGenerationRuntime` → `createMainOwnedGenerationRuntime` → `transport.execute`（IPC）。渲染侧的 `generation-harness` 观察者**永远不会触发**，所以「实际发出的请求」会整段缺失，只能退化为重建。`transport.execute` 是请求跨进程发出前、渲染层唯一能同时看到「补全后的 messages」与「回传输出」的位置——这也是唯一能看到 `injectWritingSkillIntoTask` 注入内容的时机（`built` 与 `io.messages` 的区别就在这里）。

**⚠️ 提示词装配必须在 trace scope 内（P2.2 已补全的清单）**

只有 `executeWithGenerationRuntime` 会自动广播作用域。以下命令的装配一度落在作用域外，已单独处理：

| 命令 | 为什么不走统一入口 | 处理方式 |
| --- | --- | --- |
| `generate-draft`（正文） | 自建 runtime 以使用专用 `DRAFT_GENERATION_BUDGET` | 外层 `try` 内 `pushTraceScope`；`runtime.execute` 回调开头回填 `runHandle`；`finally` 里 `runTraceScopeTeardown()` → dispose |
| `finalize-chapter`（章节要点 / 角色卡） | 由独立 `runFinalizationGeneration` 驱动 | `pushTraceScope` 推迟到 `runPostProcessPipeline` 前一行（前后无可抛错语句，防栈泄漏）；`onHandle` 回调回填 `runHandle` |
| `analyze-style`（非导入分支） | 包装只在方法尾部、只包住 `generate` | 把 `build()` 移进 `generate` 内（它只服务于那次调用） |

已核对安全（`build()` 本就在作用域内）：`refine-draft` / `review-chapter` / `refine-from-review`（经基类 `ReviewRevisionCommand:88`）、`directory`（contract 回调由 `:438` 运行时包住）。

**新增生成命令时的自检**：若 `build()` 不在 `executeWithGenerationRuntime` 调用链内，必须手动广播作用域——否则追踪会明确报「提示词装配发生在生成作用域之外（promptKey=xxx）」。

**⚠️ 落盘失败的两个必知事实（踩过坑）**
- `fs:write-file` / `fs:mkdir` 失败时**返回 `{success:false, error}`，不抛错**（见 `electron/controllers/fs-controller.ts:239/285`）。任何 `await` 后都必须判 `success`。
- 渲染层改 `src/` 非组件模块**不会**通过 Vite HMR 传播；调试追踪链路必须先**重启 `pnpm dev`**（`dist/` 是 `pnpm build` 产物，dev 下渲染层走 Vite 内存服务，时间戳会误导判断）。

**被观测的生成链路**
- 统一 IO 点：`src/services/generation/generation-harness.ts:575` `GenerationSession.complete`（**三条**路径共同下游）
- 路径 A 汇聚：`src/services/workflows/commands/base-command.ts:437 callLLMResult`（`:265/:520/:529/:283/:339` 全汇于此）
- 路径 B（绕过 A，P3 待接）：`src/services/workflows/structured-batch-executor.ts:324/:420`；使用者 `directory.command.ts:451`（蓝图）、`architecture.command.ts:1333`、`import-novel.command.ts:31`（逆向推演）、`planning-material.command.ts:20`
- 路径 C（绕过 A/B，P3 待接）：`plot-tree-generator.ts:41`、`narrative-thread-candidate-generator.ts:39/71`（伏笔叙事）、`character-card-generation.command.ts:149`
- **片段来源点**：`src/services/prompts/prompt-builder.ts:14`（`build():28`，`template`/`variables` 在 `:15/:16`）
- 各步骤 key 解析：`architecture.command.ts:854/1046/1143/1473/1788/1946`（config/premise/角色/世界观/弧光/大纲）、`directory.command.ts:342`（蓝图）、`refine-draft.command.ts:40`（AI 修稿）、`refine-from-review.command.ts:79`（审稿修稿）、`review-chapter.command.ts:48`（审稿）、`finalize-chapter.command.ts:190/283`（章节要点/角色卡）、`import-novel.command.ts:354/355/625`（逆向推演）
- 内置模板：`src/services/builtin-prompt-templates.ts`（`EDITABLE_PROMPT_KEYS:37`、`ARCHITECTURE_PROMPT_KEYS:74`）
- 生效来源判定：`src/services/prompt-catalog.ts:239 peek()` → `'project'|'global'|'builtin'`
- 可编辑 UI 字段：`PromptSettings.tsx` / `NovelConfigEditor.tsx:510` (globalGuidance) / `DirectoryConfigDialog.tsx:89,518` (pacingGuidance)
- 续写旁路（不带模板指导）：`generate-draft.command.ts:1620/1808`（`draftAuthorMaterialBlock()`）
- 区段归因复用：`generation-harness.ts` 的 `promptBudget.sections`
- **热重载（已实现，§8）**：`prompt-catalog.ts` 的 `reloadGlobal()` / `reloadProject()`；门面 `prompt-templates.ts` 的 `reloadGlobalCustomPrompts()` / `reloadProjectCustomPrompts(session)`；三处入口 `PromptSettings.tsx` / `DeveloperSettings.tsx` / `StatusBar.tsx`
- **追踪开关（已实现，§9）**：`src/stores/debug-store.ts`（`promptTraceEnabled` / `traceRoot`）、`src/components/settings/DeveloperSettings.tsx`
- **片段层追踪（已实现，P1）**：`src/services/prompts/prompt-trace.ts`（`deriveFragments` / `recordFragments` / `lastPromptTraceSnapshot`）、`src/services/prompts/install-prompt-trace.ts`、`prompt-builder.ts` 的 `build()` 尾部 hook
- 落盘通道：`src/shared/ipc-channels.ts:476` (`fs:write-file`)
- 设置/状态栏：`SettingsModal.tsx` / `StatusBar.tsx` / `src/stores/layout-store.ts`
```
