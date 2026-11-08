# 任务：正文生成 prompt 补「显式任务锚点」（含章号）

## 0 背景（只读，不要改这些）

实测缺陷：生成第 2 章时，正文 prompt 里「第2章」出现 **0 次**、「第一章」出现 **6 次**
（后者来自项目级 taskGuidance，作者已自行改掉）。章号只存在于蓝图 JSON 的 `"chapterNumber": 2` 字段里，
没有任何一句自然语言告诉模型「本次要写的是第 2 章」。结果是 9B 直接把上一章整章重写了一遍
（8-gram 重合 98.2%，开头逐字相同），因为按 prompt 字面它没有别的选择。

本轮只做**正文侧**。以下三类**明确不许动**，动了就是越界：

- **短细纲**：`src/shared/draft-short-outline.ts`、`draftShortOutlinePrompt`、短细纲块的位置与内容 —— 一律不碰，作者已另立项。
- **B1 块顺序**：`composeInitialPrompt`（`generate-draft.command.ts:1152-1156`）现有六项的**顺序不许改**，
  `chapterMaterials.predecessorBlock` 必须仍在 `chapterLengthContract` 之前。只允许在数组**末尾追加**一项。
- **任何用户级 / 项目级模板**（`.ai-novel/prompts/*`、`~/.vela/prompts/*`）：只改内置层。内置层必须自足。

## 1 要做的事（四处改动）

### 1.1 内置模板加变量

文件 `src/services/builtin-prompt-templates.ts`，条目 `key: 'next_chapter_draft'`（约 1267 行起）：

在 `variables` 里新增两项，**文案要写清楚它是什么**（这份 map 会展示给作者看）：

- `chapter_number` —— 本章章号（纯数字，如 `2`）
- `chapter_title` —— 本章标题（无标题时为空串）

### 1.2 模板正文首句改写（位置在 content 最前）

现在是：

```
你正在连载写作最新章节。
```

问题：「最新章节」是相对说法，配上末尾的上一章全文，模型完全可以理解成「续写上一章」。

改成要点名本章。**必须同时满足**：

1. 出现 `{{chapter_number}}` 与 `{{chapter_title}}`；
2. 明确这是**新的一章**、与上一章是两章，而不是接着上一章往下写；
3. **不得使用「续写」二字** —— 本项目里 `续写` 是 continuation 分支的专有名词
   （【操作边界】：「续写及无进展恢复**只接续已有正文，不重写旧文**」），在这里用会把语义引到反方向；
4. 一句话，不写解释性长文。

参考句式（可改写，但上述 4 条判据不能破）：

```
你正在连载写作这部小说，本次要完成的是第 {{chapter_number}} 章《{{chapter_title}}》—— 这是新的一章，不是接着上一章往下写。
```

### 1.3 末尾加显式请求句（紧邻生成点）

`src/services/workflows/commands/generate-draft.command.ts` 的 `composeInitialPrompt`（约 1152-1156 行），
在数组**末尾追加**一项（排在 `chapterLengthContract` 之后）：

内容要求（用 `promptLanguageText(writingLanguage, 中文, English)` 提供双语，与文件内其它块一致）：

1. 明确「本次只写第 N 章《标题》」，N 与标题来自运行时值，不是模板占位符；
2. 明确「上一章正文只作事实依据」；
3. 明确「不得复述、摘要、重写上一章已写内容，从上一章最终状态之后开始」；
4. 不得出现「续写」二字；
5. 长度控制在 2 句以内 —— 它是请求，不是又一份规则清单。

建议单独抽成一个小函数（如 `chapterTaskAnchorText(language, chapterNumber, title)`），便于测试直取。

### 1.4 builder 注入

`src/services/prompts/prompt-builder.ts` 的 `ChapterPromptBuilder`（`withWordNumber` 在 211-214 行附近）
新增：

```ts
withChapterNumber(num: number | string) { ... }
withChapterTitle(title: string) { ... }
```

然后在 `generate-draft.command.ts:914` 起的 builder 链里注入这两个值（章号、标题都从 `writerChapterInfo` /
`this.chapterInfo` 取现成的，不要新查库）。

**注意**：`ChapterPromptBuilder` 还被 `refine-draft.command.ts` / `refine-from-review.command.ts` 使用，
但它们渲染的是 `refine_chapter` 模板，不含这两个变量 —— 所以那两处**不需要**改，也不要改。
请自行核对一遍 `templateRendersChapterInfo` / `pruneEmptyOptionalPromptSections` 之类逻辑不会因此裁掉东西。

## 2 必须自查的坑

1. **占位符残留**：任何渲染路径都不能在结果里留下 `{{chapter_number}}` / `{{chapter_title}}`。
   `build()` 有 warn 日志但不会抛错 —— 请自己搜一遍所有渲染 `next_chapter_draft` 的入口。
2. **英文语种**：确认 `writingLanguage === 'en-US'` 时这两个变量与请求句的行为（内置模板本身只有中文，
   请如实说明英文项目现在渲染的是什么，不要凭空发明英文模板）。如果现状就是中文模板 + 英文块混排，
   按现状处理即可，但要在报告里写清楚。
3. **内置修订提示**：`promptBuiltinRevision` 覆盖 `content` / `variables`，本次改动会让所有已存在的
   项目级/全局覆盖版被判为「内置已更新」。这是**预期行为**，不要为了绕开它去动 `prompt-builtin-revision.ts`。
4. **既有断言可能反转**：`generate-draft.command.test.ts` 里有关于块先后、以及「同一轮内作者字段只出现一次」
   的断言。如果新增变量/新句触发了它们，**先判断是哪条不变量被破坏**：
   - 若是「块位置」类断言且确实因末位新增一块而需要更新 → 更新断言，并在报告里写明「比较方向未放宽，只是多了一项」；
   - 若是「同一轮内某字段出现两次」类断言 → **停下报给我**，不要放宽断言。

## 3 允许的验证

在 `C:\develop\workspace\AI-writer\wt-1` 里：

```bash
npx tsc --noEmit -p tsconfig.json
```

**只跑 tsc。不要跑 vitest 全量，不要跑 `pnpm test:node`**（会切 ABI，打断并行槽位）。
单元测试由主 agent 在 develop 跑。

## 4 交付格式（回复里只给这些）

1. 改了哪些文件、每个文件改了什么（一句话一条）；
2. 新增/修改的模板句子**原文**（逐字贴出，不要描述）；
3. tsc 结果；
4. 你认为最有争议的一处判断 + 理由（一句话）；
5. 有没有碰到第 2 节列出的坑，怎么处理的。

不要贴大段代码，不要写设计稿，不要动文档。
