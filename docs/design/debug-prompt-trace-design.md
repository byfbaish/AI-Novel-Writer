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
# TRACE · <promptKey> · <中文名>

> 一句话摘要：这次 prompt 由 N 块拼成 —— 其中 **X 块你能改**（去哪改见下表），**Y 块系统自动加**，**Z 块代码硬编码改不了**。

## 1. 这次 prompt 由哪几块拼成

> 每行 = 一块。"谁写的（现在生效）"回答"全局还是项目的"。

| # | 这一块是什么 | 谁写的（现在生效） | 能改吗 | 去哪改 | 字节 |
|---|-------------|------------------|--------|--------|------|
| ① | 出厂设定（模板正文） | 内置 `synopsis` | 🔵 能 | 设置→提示词模板→情节大纲 | 4,120 |
| ② | 你的全局写作要求 | 你的**项目**级设置 | 🟣 能 | 小说配置→全局写作要求 | 412 |
| ③ | 系统补回的必需上下文 | 系统自动 | 🟡 否 | —（自动） | 980 |
| ④ | 本步骤来自作者补充 | 你的**项目**级设置 | 🟣 能 | 生成情节大纲对话框→本步骤补充 | 120 |
| Σ | | | | | 5,632 |

> 一句话读法：**看"能改吗"这一列** —— 想调优就只动🔵🟢🟣；🔴/🟡 改了也没用（见 §7.1 哪些已被系统强制）。

## 2. 逐块详情（每块贴原文 + 一句话说明）

### ① 出厂设定（模板正文）
- **谁写的**：内置默认；**当前生效**：`global` 覆盖（你在设置里改过 → 出厂原文被遮挡，见下方 META 的 `builtinRevision`）
- **去哪改**：设置 → 提示词模板 → 「情节大纲」→ 补充创作指导
- **变量出口**：`global_guidance` / `premise` / `character_dynamics` / `world_building` / `plot_structure_guide`
```text
（贴 content 原文，变量位保留 {{xxx}} 形式）
```

### ② 你的全局写作要求（globalGuidance）
- **谁写的**：小说配置 → 全局写作要求；**作用域**：项目级
- **去哪改**：小说配置 → 全局写作要求
```text
（贴实际值）
```

…（依此类推每一块）

## 3. 组装后 user message（最终喂给模型的原文）

```text
（build() 结果拼接后的完整 user prompt）
```

## 4. system message

```text
（getSystemRole() + 不可变合同 systemSuffix）
```

## 5. 模型输出

```text
（completion.content，已去 <think>）
```

````

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
- **P3 结构化路径（路径 B/C）**：路径 B（`structured-batch-executor`，蓝图等）与路径 C（`plot-tree-generator`/`narrative-thread-candidate-generator` 等直连 `session.complete`）。前者绕过提示词装配，能抓到的信息有限；后者无模板 key，`promptKey` 记 `task:*`。
- **P4 收尾**：`INDEX.md`/`index.json` 跨 run 索引；StatusBar「打开 trace 目录」；自定义绝对路径 + 沙箱白名单核查。

---

## 12. 验收标准

**P2 已达成（路径 A）**：
- 开关 ON → 跑一轮走主链路的生成（架构各步 / 蓝图 / 正文 / 精修）→ `<项目根>/debug/prompt-trace/` 出现 `<时间戳>-<操作>-<runId>.md` 与 `.json`。
- `.md` 能区分「这段是内置 systemSuffix、代码硬编码、UI 改不了」vs「这段来自项目/全局覆盖」，并附「实际发出的请求」与「模型输出」两节。
- 追踪 OFF 时零开销（`recordFragments` 首行短路）；落盘失败只 warn，不影响生成结果。
- 无作用域 / 无项目会话 / 无快照时不写文件（不产生空文件噪音）。
- **面板不得停在"等待落盘"**：任何一次 `build()` 捕获后（无论走哪条分支），状态面板都必须给出终态——`已写出 N 份` / `本次未写出文件 + 原因` / `落盘失败 + 原因`。只有"落盘正在进行中"才允许短暂显示等待态。
- **同一轮生成只产生一份文件**：短定时器与作用域收尾命中同一作用域时不重复写；IO 后到时覆盖写一次以带上输出面。

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

**追踪自身（P0~P2.1）**
- 追踪开关与状态：`src/stores/debug-store.ts`（`promptTraceEnabled` / `traceRoot` 预留）、`src/components/settings/DeveloperSettings.tsx`
- 片段归因：`src/services/prompts/prompt-trace.ts`（`deriveFragments()` 纯函数 + `recordFragments()` 短路捕获 + `setSnapshotSink`）
- 作用域广播：`src/services/prompts/trace-scope.ts`（`pushTraceScope` / `currentTraceScope` / `setTraceScopeTeardownHook` / `runTraceScopeTeardown`）——**零依赖，可被工作流核心安全引用**
- 落盘：`src/services/prompts/prompt-trace-writer.ts`（`recordTraceIo` / `scheduleTraceFlush` / `flushTraceNow` / `TraceFlushOutcome` 订阅），落到 `<项目根>/debug/prompt-trace/`
- 状态回显 UI：`src/components/settings/PromptTraceStatus.tsx`（四态：等待/已写出/未写出/失败）
- 装配：`src/services/prompts/install-prompt-trace.ts`（`main.tsx` 启动调用一次；注入 sink + IO 观察者 + 收尾钩子）
- IO 抓取点：`src/services/generation/generation-harness.ts` `setHarnessIoObserver` + `complete()` 成功路径
- 作用域注入点：`src/services/workflows/commands/base-command.ts` `executeWithGenerationRuntime`（push 作用域 → 操作体 → **收尾落盘** → pop）

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
