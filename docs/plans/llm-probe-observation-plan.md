# LLM 生成探针：实机观察计划（2026-10-11）

## 一、要验证什么

作者判断：分层应当是 **弧光 → 情节大纲 → 章节蓝图 → 正文**，
「**蓝图是对大纲的细化，正文是对蓝图的施工，不应该跨级接触大纲**」。

但当前实现里，正文 prompt 同时含两份**描述同一章**的内容：

| 来源 | 内容 | 代码位置 |
|---|---|---|
| `synopsisForDraftChapter(core.synopsis, N)` | 当前章的情节大纲段落 | `src/services/workflows/commands/generate-draft.command.ts:1899` |
| `chapter_info` | 本章章节蓝图 JSON（`keyEvents` / `suspenseHook` …） | 生成草稿模板 |

两者并排注入，且**模板里没有任何优先级声明** —— 冲突时只能由模型自己猜。

本次观察要回答三个问题：

1. **蓝图生成**时，注入的是**整份**大纲还是**按章切片**？
2. **正文生成**时，prompt 里到底有没有情节大纲？
3. 模型实际采信了哪一份（对比输出与两份来源）？

## 二、开关与落盘

- **开关**：环境变量 `AI_NOVEL_LLM_PROBE=1`。不设则完全关闭，**生产行为零变化**。
- **落盘**：`<全局数据根>/debug/llm-probe-<YYYY-MM-DD>.jsonl`，一天一个文件。
  - dev 的全局数据根由 `vite.config.ts` 指定（通常为 `%USERPROFILE%\.ai-novel-writer-dev`）；
    若设过 `AI_NOVEL_APP_DATA_HOME`，以它为准。
  - 每行一条 JSON：`request` 与 `response` 成对，用 `sequence` 关联。

## 三、记录格式

**request 记录**

| 字段 | 说明 |
|---|---|
| `sequence` | 序号，response 用它配对 |
| `transport` | `invoke`（非流式） / `stream`（流式） |
| `purpose` | 生成用途标识 |
| `purposeKind` | 归类：`arc` / `outline` / `blueprint` / `draft` / `other` |
| `projectPath` | 项目路径 |
| `signals` | **判读核心**，见下表 |
| `messages` | 完整 messages（每条含 `role` / `content` / `chars`） |
| `truncated` | 单条超 200 万字符时被截断的标记 |

**`signals` 字段**

| 字段 | 含义 | 判读价值 |
|---|---|---|
| `chapterEntries` | prompt 里 `## 第N章：` 式条目数 | **区分「整份注入」与「按章切片」** |
| `firstChapter` / `lastChapter` | 章级条目的章号范围 | 看覆盖到第几章 |
| `hasPlotOutlineTitle` | 是否出现 `# 情节大纲` / `# Plot Outline` | **跨级接触的直接证据** |
| `arcMarkers` | 弧光标志（`【篇幅预算】` / 大弧 / 中弧）次数 | 是否连带弧光 |
| `blueprintFields` | 蓝图字段（`"keyEvents":` 等）次数 | 蓝图是否在 |
| `hasBlueprintHeading` | 是否出现「本章写作方向与核心任务」 | 蓝图注入确认 |
| `chars` / `messageSizes` | 总字符数 / 每条长度 | 量化各自的占用 |

**response 记录**：`content`（模型输出原文）、`finishReason`、`usage`、`durationMs`、`error`。

## 四、判读清单

### A. 蓝图请求（`purposeKind == "blueprint"`）

| 观察 | 结论 |
|---|---|
| `chapterEntries == 1` | 已按章切片，✅ |
| `chapterEntries > 1` | **整份大纲注入** ⚠️（845 章项目此处会接近 845） |
| `hasPlotOutlineTitle == true` | 大纲正文进了蓝图 prompt（这一步符合预期） |

### B. 正文请求（`purposeKind == "draft"`）

| 观察 | 结论 |
|---|---|
| `hasPlotOutlineTitle == false` 且 `chapterEntries == 0` | 没有跨级，✅ |
| `chapterEntries == 1` | 注入了**当前章那一节**大纲 ⚠️（仍是跨级，只是已切片） |
| `hasPlotOutlineTitle == true` 或 `chapterEntries > 1` | **跨级接触** ⚠️ —— 本次要抓的正是这个 |
| `arcMarkers > 0` | 连弧光都被带进来了（更严重的跨级） |
| `blueprintFields > 0` 或 `hasBlueprintHeading == true` | 本章蓝图确实在（预期内） |

### C. 响应

把 `content` 与两份来源并排比较：模型写出的关键事件，更贴近**大纲段落**还是更贴近**蓝图 `keyEvents`**。

## 五、操作步骤

### 1. 开探针并启动 dev

```pwsh
$env:AI_NOVEL_LLM_PROBE = '1'
pnpm dev
```

### 2. 实机操作（按顺序）

1. 打开目标项目
2. 生成**第 1 章章节蓝图**（首次）
3. 生成**第 1 章正文**
4. 关闭应用

### 3. 找到文件

```pwsh
Get-ChildItem -Path $env:USERPROFILE -Filter 'llm-probe-*.jsonl' -Recurse -Depth 3 -ErrorAction SilentlyContinue |
  Select-Object FullName, Length, LastWriteTime
```

### 4. 一条命令出判读表

```pwsh
$file = (Get-ChildItem -Path $env:USERPROFILE -Filter 'llm-probe-*.jsonl' -Recurse -Depth 3 |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
Get-Content $file | ForEach-Object {
  $r = $_ | ConvertFrom-Json
  if ($r.kind -eq 'request') {
    '{0,-7} {1,-46} 章条目={2,-5} 大纲={3,-6} 弧光={4,-3} 蓝图字段={5,-4} 字数={6}' -f `
      $r.transport, $r.purpose, $r.signals.chapterEntries, $r.signals.hasPlotOutlineTitle, `
      $r.signals.arcMarkers, $r.signals.blueprintFields, $r.signals.chars
  }
}
```

### 5. 看某一条的完整 prompt

```pwsh
(Get-Content $file | ForEach-Object { $_ | ConvertFrom-Json } |
  Where-Object { $_.kind -eq 'request' -and $_.purposeKind -eq 'draft' } |
  Select-Object -First 1).messages | ForEach-Object { "--- $($_.role) ---"; $_.content }
```

### 注意事项

- **一次操作可能触发多条请求**（初稿 + 压缩修订 + 重试），同一 `purpose` 出现多行属正常。
- 探针文件是纯诊断产物，**删除它不影响任何东西**。
- 观察结束后，关掉环境变量或用普通终端启动。

## 附：数据库里其实已经存了 prompt（不必依赖探针）

`generation_attempts.usage_receipt_json` 的 `replayTask.messages` 保存了**每次请求的完整 messages**，
可以离线复盘。项目库是 `.ai-novel/project.db`（Electron ABI 的 better-sqlite3，普通 node 打不开，
用 Python 的 `sqlite3` 只读副本即可）：

```python
import sqlite3, json, re
con = sqlite3.connect(r"<副本>/project.db")
for rowid, raw in con.execute(
    "SELECT rowid, usage_receipt_json FROM generation_attempts ORDER BY rowid DESC LIMIT 20"):
    task = (json.loads(raw or "{}").get("replayTask") or {})
    messages = task.get("messages") or []
    full = "\n".join(m.get("content", "") for m in messages)
    entries = re.findall(r"^[\t ]*(?:#{1,6}[\t ]+)?第[\t ]*(\d+)[\t ]*章(?=[\t ]*[：:])", full, re.M)
    print(rowid, task.get("purpose"), "msgs=%d" % len(messages), "chars=%d" % len(full),
          "章条目=%d" % len(entries),
          "大纲标题=%s" % bool(re.search(r"^#{1,3}[\t ]*情节大纲[\t ]*$", full, re.M)))
```

**注意**：`chapter-blueprint-directory` 那条的 receipt 里 `replayTask` 可能不含 `messages`
（实测为空）—— 要核蓝图 prompt，仍需探针。

## 六、实机判读结论与处置（2026-10-11 第 1 章蓝图 + 正文）

### 6.1 结论：正文确实跨级注入了情节大纲，而且是**两份**

现场取自项目库 `generation_attempts.usage_receipt_json → replayTask.messages`
（`国运怪谈直播-新版副本`，`purpose=chapter-draft`，rowid=106，22514 字符）：

| 偏移 | 内容 |
|---|---|
| 3958–8997 | `# 故事前提` + `# 世界观`（设定层） |
| **8997–9267** | **`# 情节大纲` + `## 第1章：零点，多个铃`** ← 第 1 处 |
| 9267 | `【本章信息】`（= 本章蓝图，`keyEvents` 与上一行几乎逐字同义） |
| 11023–16080 | `【用户自定义创作指导】` 里再来一遍 `# 故事前提` + `# 世界观` + **`# 情节大纲` + `## 第1章`** ← 第 2 处 |

两处都来自同一个变量 `{{architecture}}`：

- 模板正文：`【全书设定池】\n{{architecture}}`；
- 作者模板的 `taskGuidance` 首句：`参考故事架构{{architecture}}、确认后的小说配置{{novel_config}}、…`。

而 `architecture` 的定义本身含大纲（`builtin-prompt-templates.ts:935`
「故事架构（故事前提+角色图谱+世界观+**情节大纲**）」）。所以正文同时拿到了
**大纲的章级条目**和**蓝图的 `keyEvents`** —— 同一件事的两份表述，且提示词里
没有任何「以谁为准」的声明（全文只有文风/排版类的「最高优先级」标记）。

### 6.2 处置：正文不再拿到大纲的章级条目（已实施）

`generate-draft.command.ts`：

- `synopsisForDraftChapter(synopsis, chapterNumber)` → 改造为
  **`synopsisSettingSectionsForDraft(synopsis)`**：只保留**非章级**段落（作者写的全书总纲、
  全局禁则等），所有 `## 第N章` 条目一律不进正文。
  结构无法可靠解析（代码围栏引用示例 / 混级标题 / 章号非升序 / 整份没有章标题）时整体原样保留
  —— 宁可多留，也不猜着丢作者事实。
- 投影后只剩悬空标题（机器生成大纲开头的「# 情节大纲」）→ 视为空，不注入。
- `readArchitecture()` 改用新函数；`chapterNumber` 形参随之删除（`noUnusedParameters` 会拦）。

分层回到 **弧光 → 情节大纲 → 章节蓝图 → 正文**；正文的章级内容只由
`chapter_info`（本章蓝图）与 `future_blueprints`（后续蓝图）承载。
设定层不受影响：`premise` / `worldbuilding` 仍照常注入并做作者事实去重。

**受影响的既有契约（3 个测试文件已按新契约改写）**：

| 文件 | 改动 |
|---|---|
| `generate-draft.command.test.ts` | 正文 prompt 不再含「当前章关键事实」；新增「机器大纲 → 空投影」用例 |
| `plot-outline-contract.test.ts` | 函数改名（语义断言不变） |
| `main-generation-owner.test.ts` | 改为**直接校验大纲本身**，不再经正文投影当探针 |

**残留的保守回退**（这两类大纲仍会把章级内容带进正文，但机器生成的大纲不会触发）：
含代码围栏的大纲、无法解析的标题风格（中文数字章号 / 混级标题 / 列表式章号）。

### 6.3 `{{architecture}}` 双份渲染 —— 已清理（2026-10-11）

正文 prompt 里 `{{architecture}}` 曾渲染两遍（模板正文【全书设定池】1 次 +
覆盖模板 `taskGuidance` 1 次），实测第二处约 10 000 字符、占该 prompt 约 44%。

**根因不在代码**：作者全局覆盖
`<全局数据根>/generations/<session>/prompts/*.json` 是**旧版内置模板的整份快照**，
其 `taskGuidance` 首句是旧版留下的「变量清单式」复述。新版内置的 20 个模板里
已无 `taskGuidance`（仅 `assistant_writing_identity` 保留）—— 上游早已清理，
是 W1「只提示、不自动合并」的纪律让覆盖一直沿用旧文本。

**处置（已实施；属作者数据，不进 git）**：`first_chapter_draft.zh-CN.json` 与
`next_chapter_draft.zh-CN.json` 的 `taskGuidance` 首句压成一句任务说明，变量清单删除。
覆盖面核对：两模板 `taskGuidance` 引用的变量（first 8 个 / next 13 个）**全部**已在
`content` 或内置 `systemSuffix` 中有出口，删掉不减少任何信息；作者自写的
去精确堆砌 / 去AI机械化 / 强制排版三段指导完整保留。备份见 `prompts.bak-20261011-2145/`。

**全量发现（未处理）**：扫描 20 个覆盖模板，全部存在同类 `taskGuidance` 重复渲染。
其中 `refine_chapter`（guidance 1355 字，重复 `draft_content` 整份草稿）与
`refine_from_review`（745 字，重复 `draft_content` + `review_report`）属正文/修订链路、
浪费最大，处理方式与本次相同（删首句清单、留作者指导）。其余 16 个模板的变量嵌在任务句中
（如「生成第 {{n}} 章至第 {{m}} 章」），**不能直接删**，否则句子残缺 —— 要清的话应把
长文本变量替换成 `variables[key]` 的说明文字。

### 6.4 原判读预案（保留备查）

| 观察结果 | 计划处置 |
|---|---|
| 正文未注入大纲 | 分层已符合预期，无需改动 |
| 正文注入了大纲（切片或整份） | 在 `readArchitecture()` 移除 `synopsisForDraftChapter` 注入 —— 正文只看蓝图 |
| 蓝图整份注入大纲 | 改为按章切片注入，并补「以大纲为准、只做结构化落地」的约束 |
| 两份表述冲突导致正文跑偏 | 补优先级声明：本章蓝图为准，大纲为背景 |
