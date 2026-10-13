# 自由文本按步骤分区设计（标签机制）

> 覆盖两条同族问题：**① 参考作品落点错位**（2026-10-13 作者质疑）**② `global_guidance` 正文形态纪律分区**（原 P0-2，落点原定"新槽位 `draftingRules`"）。
> 本文是**编码前的小设计稿**，按项目惯例先经作者过目再动代码。
> 上游权威稿：`prompt-payload-scoping-design.md`（§5 矩阵 / §5.5 契约 / §6 L3 / §7 表 / 附录 A·E）。

---

## 0. 一句话结论

「参考作品」「全局写作要求」是**同一类东西**——作者自由文本，被无差别注入到不该去的步骤。共同根因是**框架没有"这段文字属于哪一步"的表达手段**。

**给自由文本加一段极小的段级标签语法，由投影函数在写入 prompt 前过滤。** 一套机制同时解决两条，**零 schema、零迁移、旧数据零改动**。

> **✅ 已实施（2026-10-13，作者裁定四项后）** —— 见 §11 实施记录。代码：`src/shared/text-scope-tags.ts` + 6 处注入点 + UI（`ScopeTagBar`）。

---

## 1. 问题一：参考作品落点错位

### 1.1 取证（实测，全部落到行号）

| 事实 | 证据 |
|---|---|
| 含 `{{reference_works}}` 的模板**只有 4 个** | `builtin-prompt-templates.ts`：`premise`(382/395/431)、`character_dynamics`(451/461/525)、`first_chapter_draft`(970/997)、`next_chapter_draft`(1043/1074) |
| 注入点 2 处 | `architecture.command.ts:1066`（premise builder）、`generate-draft.command.ts:802`（正文链，**落在"缓存命中区"前缀段**） |
| **看不到它的步骤** | `world_building`、`plot_structure`、`synopsis`、`directory`、`chapter_blueprint_chunk` —— 全无该变量 |
| 正文请求实测（ch1） | `【参考作品…】`块 **2,301 字**，全文只出现 1 次（`promptOnlyConfigKeys` 已把它从 `novel_config` 分出，无重复） |

覆盖现状：**该看它的看不到**（世界观/弧光/大纲/章纲/蓝图全断），**不该每章吃它的每章吃**（正文每章 2,301 字）。

### 1.2 三处错配

1. **UI 文案与行为不符**：`NovelConfigEditor.tsx:539` 的 placeholder 写「…（**AI 架构生成时会参考**）」，实际每章正文整段注入 → 作者认知漂移。
2. **header 与内容性质错配，且同变量两个口径**：
   - `premise` 处：`【参考作品风格（如有，调性与节奏可参考以下作品）】`
   - 正文处：`【参考作品（如有，仅供借鉴调性与节奏，不是必须兑现的作者事实）】`
   - 而实际内容是**机制/体系/副本设计方法论 + 防抄袭禁则**，被"调性与节奏"的帽子扣住 → 模型会低估其中"❌禁止照搬"的约束力。
3. **一条将来泄漏通道**：作者在该栏写了「## 三、休整区、多玩家生态（**13‑20 章要写的内容**）」「## 四、底层世界观谜题…妹妹伏笔」→ **第 1 章正文就看得见 ch13–20 的规划**。与 P1-1（防提前）同类，走的是另一条通道。

### 1.3 一个必须打折的判断（防实施走偏）

作者实际写的**不是书名**，是 2,301 字的**分区设计简报**（`✅可借鉴` / `❌禁止照搬` / `你的改造`，四节：国运直播体系·规则怪谈副本机制·休整区多玩家生态·底层世界观谜题）。

⇒ 结论不是"删掉入口"，而是**改形态引导 + 按内容分区**。删入口只会把这份材料逼进 `global_guidance`。

其中「**不要直接搬运别人书里成套成文的规则条文**」是**防抄袭闸门**，恰恰是生成副本规则时最该看见的 → **"只给架构层"也会丢东西**，所以必须是"分区"而非"单边给"。

---

## 2. 问题二：`global_guidance` 的正文形态纪律（原 P0-2）

ch1 实测 `【全局写作要求】` = **315 字**（含块头），内容是一个**混合体**：

| 句子 | 性质 | 应给谁 |
|---|---|---|
| 维持 pulp 爽文基调：口语直白，压迫感强 | 基调 | 架构 + 正文 |
| 少比喻/少通感/少拟人…修辞预算留给伏笔与钩子 | 文风 | 架构 + 正文 |
| 叙述贴着主角主观感官走 | 文风 | 架构 + 正文 |
| **气质：死面理工脑——短句切分 + 计数口令，一句一击** | **正文形态纪律** | **仅正文** |
| 角色情绪外露，但叙述语气克制 | 正文形态 | 仅正文 |
| 恐惧靠生理反应呈现，不写心理告白 | 正文形态 | 仅正文 |
| 对话只承载推进剧情的信息 | 正文形态 | 仅正文 |
| **弹幕语言用【】括起来** | **正文格式** | **仅正文** |
| **规则清单的原文呈现：一句一段** | **正文格式** | **仅正文** |

原文（逐字，供分区标注参考）：

```
维持 pulp 爽文基调：口语直白，压迫感强。
少比喻、少通感、少拟人、少意象堆砌，修辞预算留给伏笔与钩子。
叙述贴着主角主观感官走，把冷硬客观叙述换成人物体感视角。
气质：死面理工脑——短句切分 + 计数口令，一句一击。
角色情绪外露（恐惧、愤怒、紧张要写出来），但叙述语气克制（不煽情、不升华、不点题）。
恐惧与紧张靠生理反应呈现（僵、麻、发凉、指尖收紧、手抖、出汗），不写心理告白。
对话只承载推进剧情的信息与人物的声线差异，不写成说明文。
弹幕独立于主角视角，只做反应，不代入主角情绪，不替主角推理。弹幕语言用【】括起来。
氛围细节允许留白，刻意不解释。规则清单的原文呈现：一句一段。
```

**问题**：这 9 句现在**整块进上游（架构/大纲/章纲/蓝图）**，等于把"一句一段""弹幕用【】"这类**正文排版规则**当成了设定层的约束。`grep '^\s*global_guidance:'` → 该变量在 **12 处**模板中声明（架构四步 + 大纲/章纲/蓝图 + 正文两模板 + 精修等），是目前覆盖面最广的自由文本。

---

## 3. 机制设计：段级标签

### 3.1 语法与语义

```
【适用：架构】      ← 整行独立，其后内容只给主架构四步
【适用：大纲】      ← 只给情节大纲与章节蓝图
【适用：正文】      ← 只给每章正文（含修稿）
【适用：全部】      ← 都给；等于不打标签
【适用：架构,正文】  ← 组合值：两侧都给（逗号 / 顿号 / 分号 / 空白分隔）
```

规则（**四条，全部可单测**）：

1. **标签必须整行独立**，形如 `^【适用[：:]<值>】$`（容忍前后空白 / CRLF）。行内出现的 `【】` 一律不是标签 —— **这条是硬边界**：作者的自由文本里本来就有「弹幕语言用【】括起来」，误判会静默吃掉正文。
2. **段继承**：标签作用于**其后所有内容**，直到下一个标签行或文本结束。
3. **无标签 = `全部`（全量）** → **旧数据行为逐字不变**（无标签输入走快路径，逐字返回原文）。
4. **未知标签值**：**按全量注入 + UI 警告**，绝不静默丢弃（守本项目"材料不得静默截断"的既有姿态；`chapter-materials.ts:517` 那条注释就是同一原则）。标签行本身在投影时被丢弃，不进 prompt。
   - 实现在 `src/shared/text-scope-tags.ts`；`【适用：】`（写了标签没写值）也按全量处理，不算未知值。

### 3.2 作用步骤（封闭枚举）

**枚举必须与真实读取点一一对应**（作者裁定：至少分出「大纲」这一档）。语义是**显式归属、无继承** —— 打了 `架构` 的段**不会**顺流到大纲/正文；要同时给两侧就写组合值。

| 标签值 | 主架构四步 | 大纲 / 蓝图 | 正文 / 修稿 |
|---|---|---|---|
| `架构` | `premise` / `character_dynamics` / `world_building` / `plot_structure` | ❌ | ❌ |
| `大纲` | ❌ | `synopsis` / `chapter_blueprint` / `chapter_blueprint_chunk` | ❌ |
| `正文` | ❌ | ❌ | `first_chapter_draft` / `next_chapter_draft` / `refine_chapter` / `refine_from_review` |
| `全部`（默认） | ✅ | ✅ | ✅ |

**为什么是封闭枚举**：值若被接受却无读取点，就成了"写了永远不生效"的静默陷阱；按 §8-7 YAGNI 不立项。将来要加，扩枚举 + UI chip 各一行（`TEXT_SCOPE_TAG_VALUES` 与 `TEXT_SCOPE_TAG_CHOICES` 同源，单测已钉住"chip 插入的字面量必须能被解析器识别"）。


### 3.3 纯函数契约（已实现）

`src/shared/text-scope-tags.ts`（**零依赖**，`workflows` 与渲染层共用，与 `synopsis-projection.ts` 同族）：

```ts
export type TextScopeTag = 'architecture' | 'outline' | 'draft'
export type TextScopeChoice = TextScopeTag | 'all'

export const TEXT_SCOPE_TAG_CHOICES = ['architecture', 'outline', 'draft', 'all'] as const
export const TEXT_SCOPE_TAG_LABELS: Readonly<Record<TextScopeTag, string>>  // '架构' / '大纲' / '正文'
export const TEXT_SCOPE_TAG_VALUES: Readonly<Record<string, TextScopeChoice>> // 含 '全部' → 'all'

export interface TextScopeStats {
  architecture: number; outline: number; draft: number  // 会进入该链的段数（含未标注段）
  everyStep: number                                     // 未标注（或显式「全部」）的段数
  total: number
  unknownTags: string[]                                 // 非空 → UI 必须告警
}
export interface ScopedTextResult { text: string; kept: number; dropped: number; stats: TextScopeStats }

export function projectScopedText(raw: string, step: TextScopeChoice): ScopedTextResult
export function summarizeScopedText(raw: string): TextScopeStats   // = projectScopedText(raw,'all').stats
export function textScopeTagToken(choice: TextScopeChoice): string // chip 插入字面量
```

**幂等**：投影结果里已无标签行，再投影一次走无标签快路径 → 逐字相同。故同一作者文本在多个注入点重复投影是安全的（不必强求"只在一处投影"）。

### 3.4 落点（**必须在写入 builder 之前，且在读取原始作者文本的那一层**）

| 文件 | 落点 | 档位 |
|---|---|---|
| `generate-draft.command.ts` | `mergedGuidance`（`globalGuidance` 与项目级 `projectPrompts` **各自投影后**再 join）、`writingStyle`、`referenceWorks` | `draft` |
| `refine-draft.command.ts` | `guidance`、`frozen.config.writingStyle` | `draft` |
| `refine-from-review.command.ts` | `frozen.config.globalGuidance` | `draft` |
| `architecture.command.ts` | premise / world_building / plot_structure 三处 `globalGuidance` + 两处 `referenceWorks` | `architecture` |
| `architecture.command.ts` | synopsis 批量路径与逐章路径的 `globalGuidance` | `outline` |
| `directory.command.ts` | 蓝图批量 builder 与单章兜底 task 的 `globalGuidance` | `outline` |

**不在模板侧做过滤** —— 模板是"出口声明"，投影是"数据准备"，混在一起会让契约测试失去基线。
`globalGuidance || missingValue` 的兜底写法要改成"先投影、空了才用 `missingValue`"（本该看到它、但全部段落都被划给别的档位时，显示"未填写"才是对的）。


---

## 4. UI 设计（作者要求：说明文本必须补全，不造成误导或迷惑）

### 4.1 说明文本定稿（中 / 英）

**参考作品**（`NovelConfigEditor.tsx`）

- `Section.desc`（改，去掉误导性的"AI 架构生成时会参考"）：

  > 写清「作品名 + 想借鉴的具体点 + 明确不要照搬的点」。默认对主架构与每章正文都生效，可用下方标签分开给。
  > Name the work, what to borrow, and what not to copy. Applies to the architecture steps and every chapter draft unless you scope it with the tags below.

- `placeholder`（**替换掉 `参考《证道》的修炼体系`** —— 那正是本项目的红线 12「示例即形态」：示例教了坏形状，作者就照坏形状写）：

  > 例：《某规则怪谈》——借它「规则必须有实体痕迹支撑」的设计手法；不要照搬它的规则条文与结局链。

- **`Section.desc` 保持单行**：多行说明改由 chip 栏上方那句承担（`Section` 的 `desc` 是单行 `<p>`，为多行去改公共组件不划算）。

**全局写作要求**（同一套 chip 复用）

- `desc` 追加一句：
  > 排版类要求（如"一句一段"）只对正文有意义，可用下方标签标出。

### 4.2 标签 chip 的插入机制（**复用提示词界面的既有实现**）

原实现已抽成 `src/components/insert-at-cursor.ts`（`insertSnippetAtCursor`），`PromptSettings` 改为引用它（行为不变），`ScopeTagBar` 接入。

参考作品 / 全局写作要求两个 section 各加一排 chip（与提示词面板的变量标签栏同款样式与交互）：

| chip（点击插入） | 插入文本 | 生效档位 |
|---|---|---|
| 适用：架构 | `【适用：架构】` | 主架构四步 |
| 适用：大纲 | `【适用：大纲】` | 情节大纲 / 章节蓝图 |
| 适用：正文 | `【适用：正文】` | 每章正文 / 修稿 |
| 适用：全部 | `【适用：全部】` | 所有步骤（等于不打标签） |

**两处实现细节（都不是可选项）**：

1. `Textarea` 已支持 `forwardRef`，无需改公共组件；两个新 ref 由 `NovelConfigEditor` 持有。
2. **chip 插入必须补换行**（`insertScopeTagAtCursor`）：标签识别要求整行独立，直接插 `【适用：架构】` 到句子中间会**点了没反应**（行内 `【】` 一律不是标签）。按光标两侧实际字符补 `\n`。

### 4.3 可观测性（已实现 —— 作者裁定"还是需要的，测试期间过了一天都迷茫"）

- chip 栏下方常驻一行：`当前：架构 N 段 · 大纲 M 段 · 正文 K 段（未标注 X 段）`（纯函数算，无副作用）；
- 未识别标签 → 就地黄色告警，并**明说"这些段按所有步骤都给处理，内容不会丢"**（只提示，不自动改写）。


---

## 5. 为什么不建 `draftingRules` 新槽位（**✅ 作者裁定 ③：改用标签，不建槽位**）

主稿 §7 表把 P0-2 的落点定为"拆 `draftingRules` 槽位"（P2，成本"高：UI + schema + 迁移"）。**作者已裁定改用标签机制，这条不做**：

| | 新槽位 `draftingRules` | 段级标签（本文提议） |
|---|---|---|
| 覆盖对象 | 只有 `global_guidance` 一处 | 一处机制覆盖 `globalGuidance` / `referenceWorks` / 将来 `writingStyle` |
| 迁移成本 | schema + 设置 UI + **旧的 304 字要人工搬** | **零**（旧数据无标签 = 全量，逐字不变） |
| 真相源 | 槽位 + 标签（迟早两套） | 一处 |
| UI 可见性 | 有独立输入框，直观 | 靠说明文本 + 段统计补偿 |
| 风险 | 中-高（碰 schema，须走 lane 六步） | 低（纯字符串解析，不碰 DB） |

**提议**：标签机制为主（(a)），`draftingRules` 槽位**降级为可选增强**——若日后作者觉得"标签看不见、容易忘"，再加槽位，届时标签机制仍可复用（两者不互斥）。

⚠️ 本条与主稿"落点已定案，勿再改回 `writingStyle`"并不冲突：**不是改回旧槽位，而是改用段级标签**。但因为动的是已定案的落点，必须作者点头。

---

## 6. 验收标准

1. **纯函数单测**（`src/shared/__tests__/text-scope-tags.test.ts`）至少 8 例：无标签原样 / 单标签 / 段继承 / 未知标签全量+告警 / 文末空段 / `all` 逐字等于原文 / CRLF 容错 / **行内 `【】` 不被误判**。
2. **零回归**：未打标签的旧数据，投影后与投影前**逐字相同**（同一断言覆盖 `referenceWorks` 与 `globalGuidance`）。
3. **实机 trace**：作者照新说明把那段「13‑20 章要写的内容」标成 `【适用：架构】` 后，正文请求的 `【参考作品…】`块应相应变短；架构侧不变。
4. `tsc --noEmit` 0 错；相关测试组（`prompt*` / `src/shared` / `generate-draft.command` / `architecture.command`）零新增失败。
5. UI：desc/placeholder 更新；chip 点击确实插入到**光标处**并恢复光标；未识别标签显示告警。

---

## 7. 风险与红线

1. **缓存**：`withReferenceWorks` 落在正文链"缓存命中区"（前缀段）→ 投影结果对同一作者文本**跨章稳定**，缓存仍命中；**首次改动会失效一次**（可接受，须在文档写明）。
2. **`promptHash`**：正文材料变化 → 未定稿候选的复用判定失效一次（同上）。
3. **契约测试基线**：若裁定 ② 通过（补 `world_building` / `plot_structure` 的 `reference_works`），要同步 `prompt-language-contract` / `prompt-local-qwen-contract` 的变量期望表 —— **这是本轮唯一可能碰基线的动作**，若不补则完全不动模板。
4. **不静默丢材料**：未知标签 → 全量 + 告警（不得当"零段"处理）。
5. **标签行不进 prompt**（投影时剔除），但**保留在 DB 原文**（作者随时可改）。
6. **守"绝不自动执行副作用"**：不自动改写作者文本、不自动搬运、不自动补标签。

---

## 8. 实施序列

1. `src/shared/text-scope-tags.ts` + 单测（纯函数，零风险）；
2. 接入两处 `reference_works` 落点（`generate-draft.command.ts:802`、`architecture.command.ts:1066`）→ 跑 `generate-draft.command` / `architecture.command` 测试；
3. 抽 `useInsertAtCursor` 共享实现，`PromptSettings` 改为引用（行为不变）+ `NovelConfigEditor` 接入；
4. UI 文案改造（§4.1）+ 标签 chip（§4.2）+ 段统计（§4.3）；
5. 若裁定 ③ 通过 → `global_guidance` 走同一投影（原 P0-2 的实质目标即达成）；
6. `tsc` / `eslint` / 相关测试组；重启 `pnpm dev` 后实机跑一章，按 §6-3 验收。

---

## 9. 作者裁定（2026-10-13，四项全部裁定）

| # | 问题 | 作者裁定 | 实施 |
|---|---|---|---|
| ① | 标签值集合 | **「至少还要分个大纲」** —— 架构标签的内容仅供主架构使用，大纲蓝图是根据架构生成的，不应该重复吃上层材料 | 四档：`架构` / `大纲` / `正文` / `全部`；**显式归属、无继承**，组合值走逗号 |
| ② | 架构层是否补上世界观的参考作品 | **需要** | `world_building` / `plot_structure` 加 `reference_works` 变量（zh + en 对称）与注入点；同步契约测试期望表 |
| ③ | P0-2 是否改用标签、不建 `draftingRules` 槽位 | **是** | `global_guidance` 全线走投影；`draftingRules` 槽位**不立项** |
| ④ | 是否做段归属统计提示 | **还是需要的**（"测试期间很多时候过了一天都迷茫"） | chip 栏常驻统计 + 未知标签告警 |

另：P1-1（【后续计划边界】降级为"不可写事件"清单）作者表示**等到 P1-1 再说**，本轮不动。

---


## 10. 证据锚点

| 事实 | 位置 |
|---|---|
| 参考作品注入点（改前 2 处 → 改后 4 处） | `architecture.command.ts` premise 段与 world_building/plot_structure（新增）、`generate-draft.command.ts` 正文链 |
| 含 `{{reference_works}}` 的模板（改前 4 个 → 改后 6 个） | `builtin-prompt-templates.ts`：`premise` / `character_dynamics` / **`world_building`（新增）** / **`plot_structure`（新增）** / `first_chapter_draft` / `next_chapter_draft`；英文侧同名 6 个在 `prompt-language.ts` |
| 参考作品 UI 入口 | `src/components/editor/NovelConfigEditor.tsx`（`Section` 标题「参考作品」） |
| 插入到光标位置的既有实现 | `src/components/settings/PromptSettings.tsx` → 已抽至 `src/components/insert-at-cursor.ts` |
| `global_guidance` 模板声明处（12 处） | `grep -n '^\s*global_guidance:' src/services/builtin-prompt-templates.ts` |
| `mergedGuidance` 组装 | `generate-draft.command.ts`（`const mergedGuidance = [...]`） |
| `novel_config` 剥离自由文本 | `generate-draft.command.ts`（`promptOnlyConfigKeys`） |
| "材料不得静默截断"原则 | `chapter-materials.ts:517-521` |
| 实机样本 | `国运怪谈直播-新版副本/debug/prompt-trace/20261013-212223-290-正文-ch1-a495f9c6.json`（参考作品 2,301 字 / 全局写作要求 315 字） |

> ⚠️ 上表的**行号已不再逐条维护**（本轮多处插入会让行号整体漂移）；检索用关键字而非行号。

---

## 11. 实施记录（2026-10-13）

### 11.1 改动清单

| 文件 | 改动 |
|---|---|
| `src/shared/text-scope-tags.ts`（新） | 分区纯函数：`projectScopedText` / `summarizeScopedText` / `textScopeTagToken`；标签表与 chip 字面量同源 |
| `src/shared/__tests__/text-scope-tags.test.ts`（新） | **17 例**：无标签逐字不变、段继承、组合值、显式「全部」、未知标签全量+告警、**行内 `【】` 不误判**、CRLF、幂等、段间无三连空行、chip↔解析同源 |
| `src/components/insert-at-cursor.ts`（新） | 抽出提示词面板的"插入到光标处"；新增 `insertScopeTagAtCursor`（**补换行**，保证标签独占一行） |
| `src/components/settings/PromptSettings.tsx` | 改为引用共享实现（**行为不变**） |
| `src/components/editor/ScopeTagBar.tsx`（新） | chip 栏（4 档）+ 段统计 + 未知标签告警 |
| `src/components/editor/NovelConfigEditor.tsx` | 参考作品与全局写作要求接入 chip 栏；**desc 去掉"AI 架构生成时会参考"**；placeholder 换成"作品名 + 借鉴点 + 不要照搬的点"（旧示例正撞红线 12）；参考作品 `rows` 2 → 4 |
| `src/services/workflows/commands/architecture.command.ts` | 6 处投影：架构 3 步的 `globalGuidance` + 2 处 `referenceWorks`（含**新增**的 world_building/plot_structure）→ `architecture`；synopsis 批量与逐章 → `outline` |
| `src/services/workflows/commands/directory.command.ts` | 蓝图批量 builder 与单章兜底 task → `outline` |
| `src/services/workflows/commands/generate-draft.command.ts` | `mergedGuidance`（两来源各自投影）/ `writingStyle` / `referenceWorks` → `draft` |
| `src/services/workflows/commands/refine-draft.command.ts`、`refine-from-review.command.ts` | `globalGuidance` / `writingStyle` → `draft` |
| `src/services/builtin-prompt-templates.ts` | world_building / plot_structure 加 `reference_works`（变量 + required + 正文块）；**6 处参考作品表头统一改写**（原"仅供借鉴调性与节奏"与内容性质错配）；`OPTIONAL_PROMPT_LABEL_PATTERN` 补 `\[Reference works…\]`（英文侧此前不会裁空标题） |
| `src/services/prompt-language.ts` | 英文侧同名改动（中英变量契约必须对称，`prompt-language-contract` 会比对占位符集合） |
| `src/services/__tests__/prompt-local-qwen-contract.test.ts` | 期望表 `world_building` / `plot_structure` 追加 `reference_works`（顺序敏感） |
| `architecture.command.test.ts`、`generate-draft.command.test.ts` | 各补 1 例**分区回归**（架构侧只吃架构/未标注段；正文侧只吃正文/未标注段），并断言**标签行永不进 prompt** |

### 11.2 校验结果

| 项 | 结果 |
|---|---|
| `prompt*` + `src/shared` + `src/services/workflows` 全量 | **31 红 / 1992 绿**；红点集合 **⊆** HEAD 红点集合（`diff` 证明**零新增**，且 HEAD 会红的一条现已绿 —— 属早前 P0-1 的测试定位修复） |
| 分区专项 | 纯函数 **17/17**；架构命令 **47/47**；正文命令 **212/212** |
| `tsc --noEmit` | **0 错** |
| `eslint`（16 改动文件） | 3 处报错，**全部经 stash A/B 证明既有**（`NovelConfigEditor` 的 setState-in-effect、`generate-draft.command.ts` 的 `_userGuidance`） |
| `src/components` 全量 | 2 红，**A/B 证明 HEAD 同红** |

### 11.3 未做 / 待实机

- **P1-1 未动**（作者："等到 P1-1 再说"）。
- **实机已验（2026-10-13 23:26–23:29）**：见 §11.4 —— 正文链投影**精确生效**（参考作品块 2,267 → 148 字）、标签零泄漏、章节段 `ch13` 正确；同时暴露并修复了**第 7 个注入点**（§11.5）。
- **缓存代价（预期、可接受）**：参考作品段落在正文链"缓存命中区"前缀段，表头文案变化会让缓存**首次失效一次**；`promptHash` 同理失效一次。

### 11.4 实机验证结果（2026-10-13 23:26–23:29，作者跑「第 13 章大纲 + 第 1 章正文」）

样本（`国运怪谈直播-新版副本/debug/prompt-trace/`）：

| 文件 | 步 | 用途 |
|---|---|---|
| `20261013-232624-887-大纲-ch13-7be08746.{md,json}` | `plot-outline:chapter:13:normal`（模板 `synopsis`） | 大纲侧 |
| `20261013-232741-459-正文-ch1-acc073a8.{md,json}` | `chapter-draft`（模板 `first_chapter_draft`） | 正文侧 |
| `20261013-212223-290-正文-ch1-a495f9c6.{md,json}` | 同正文，**改前**基线 | 对照 |

**A. 正文链：投影生效，且精确命中契约** ✅

作者把参考作品分成了三段标签（`【适用：架构】` / `【适用：架构,大纲】` / `【适用：架构,正文】`）。竖切 `ioCalls[].messages[].content`（**不是** `snapshots[].built`，见红线 15）：

| 块 | 改前 | 改后 | Δ |
|---|---|---|---|
| `【参考作品…】` | **2,267 字** | **148 字** | **−2,119（省 93%）** |
| `【全局写作要求】` | 305 | 701 | +396（作者同期在加内容，非本轮所致） |
| `【文风要求】` | 0 | 969 | 同上 |
| user 合计 | 17,524 | **15,270** | −2,254 |
| `snapshots[0].builtLength` | 11,287 | **9,053** | −2,234 |

**逐字核对**：改后 148 字 = 表头 + **恰好 3 行**（`参考《天赋 SSS 级…》`/`参考《谁在用我的声音说话》`/`参考《规则类怪谈物语》`），即 `【适用：架构,正文】` 那一段；`【适用：架构】`的 5 行与`【适用：架构,大纲】`的 1 行**都不在**正文请求里。**段级取舍与设计逐条相符。**

**标签泄漏检查**：正文 trace 全文 `【适用` 命中 **0** 次 ✅。

**B. 大纲链：章节段已生效；但发现投影漏点（见 §11.5）**

- 章节段 ✅：文件名 `…-大纲-ch13-…`。`formatChapterSegment` 是 `first === last ? 'ch' + first : 'ch' + first + '-' + last`，单章生成本就该是 `ch13` —— **此前缺的样本就是这个形态的确认**（`chN-M` 只出现在多章批次）。
- ❌ 但同一份请求里**仍出现了带标签的原始参考作品**：`【其余冻结作者配置，须保留全部硬要求】` 块把整份 config `JSON.stringify` 进 prompt，其中 `referenceWorks` 是**未投影的原文**，含 `【适用：架构】`/`【适用：架构,大纲】`/`【适用：架构,正文】` 三行标签，5 行架构专享内容**原样进了大纲请求** —— 与作者裁定 ①「大纲不该重复吃上层材料」直接冲突。见 §11.5。

**C. 其它同期观察**

| 观察 | 结论 |
|---|---|
| 生效来源 | 正文块 1 `resolvedFrom = global` → **作者全局覆盖版生效**，本轮内置改动在该键上不显示 |
| 表头文案 | 正文请求里仍是旧文案 `【参考作品（如有，仅供借鉴调性与节奏…）】` —— **不是本次改写没落盘**，而是被全局覆盖版遮蔽（§11.5-C） |
| 第 1 章正文产出 | 2,558 + 955（续写）字，合同区间 2,550–3,000 内；`【生成短细纲】`块 568 字仍在 |

### 11.5 补漏：`【其余冻结作者配置】` 是**第 7 个注入点**（2026-10-13 已修）

**根因**：段级投影只覆盖「模板变量」这条通路。`architecture.command.ts` 的逐章大纲路径还有一条**旁路** —— 把**整份 config** 直接 `JSON.stringify` 进 prompt：

```
【其余冻结作者配置，须保留全部硬要求】
{"subGenre":…,"coreOutline":…,"worldSetting":…,"goldenFinger":…,"protagonistProfile":…,
 "writingStyle":…,"referenceWorks":"【适用：架构】\n参考《…》…"}
```

`additionalConfig` 的语义是"模板已表示之外的其余字段"，取自**原始 config**，所以 `referenceWorks` / `writingStyle` 会带着标签整份灌进去。

**修复**（三处，语义化小修）：

1. `src/shared/text-scope-tags.ts` 新增 `SCOPED_FREE_TEXT_CONFIG_KEYS`（`globalGuidance` / `referenceWorks` / `writingStyle`）与 `projectScopedConfigFields(config, step)` —— 集中成一张表，避免下次再漏。
2. `executeChapterOutline`：`additionalConfig` 改由 `projectScopedConfigFields(config, 'outline')` 生成。
3. `representedConfig.globalGuidance` 同步改用**投影后**的值 —— 否则投影值与原始值不等，会把 `globalGuidance` 判为"未表示"而**重新灌一遍**（修 A 引入 B 的经典陷阱，已写进注释）。

**边界（刻意不动）**：同文件 premise 步的 `【作者已有配置】` 块（`:874`）同样是整份 config 直灌，**保留不投影**，理由是**该块会回写配置**：`mergeExpandedNovelConfig` 用 `preserveAuthorText(existing, generated)` 保住作者原文，若喂给模型的是被剥离过的视图，模型回显的版本会缺段。**凡是"模型输出会写回配置"的块，不适用投影** —— 这条要作为后续注入点的判据。

**校验**：`text-scope-tags.test.ts` 增 4 例（`projectScopedConfigFields` 的档位取舍 / 标签行永不进 prompt / 旧配置逐字不变 / 非字符串字段透传）→ **21/21**；`architecture.command` **47/47**；`tsc` **0 错**；`plot-outline-batch.command` 失败集合 A/B 与 HEAD **逐条相同（11 = 11）**。

**未落测试的部分（如实登记）**：命令级回归（在大纲请求里断言"无 `【适用`"）需要构造 `recovery.plotOutline` + `generation:read` 状态机夹具，`plot-outline-batch.command.test.ts` 现有夹具均走**批次路径**、到不了 `executeChapterOutline`。**本轮以真实 trace 取证替代**，夹具待补。

### 11.6 全局覆盖版与内置的分歧（实机暴露，待作者定夺）

段级机制生效点对比（`getPromptSource` + 实际覆盖目录，**不是** `~/.vela`）：

| key | 全局覆盖 | 覆盖版含 `{{reference_works}}` | 本轮改内置的效果 |
|---|---|---|---|
| `premise` | 有 | ✅ | 表头改写被遮蔽 |
| `character_dynamics` | 有 | ✅ | 表头改写被遮蔽 |
| `first_chapter_draft` | 有 | ✅（旧表头） | 表头改写被遮蔽 |
| `next_chapter_draft` | 有 | ✅（旧表头） | 表头改写被遮蔽 |
| **`world_building`** | 有 | ❌ **无** | **新增槽位被遮蔽 → 本项目不生效** |
| **`plot_structure`** | **无** | — | **builtin 生效 → 新增槽位生效** |
| `synopsis` / `chapter_blueprint_chunk` | 有 | ❌（内置也没有） | — |

⇒ **作者裁定 ② 在当前项目只落地一半**（弧光生效、世界观被遮蔽），**空项目跑流程会两处全生效** —— 与作者"整体改造完成后跑空项目再验证"的计划一致。若要当前项目也生效，需要把 `{{reference_works}}` 补进全局覆盖版 `world_building.zh-CN.json`（**作者资产，须作者点头**）。

