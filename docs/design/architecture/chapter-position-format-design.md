# 章节位置表达统一：第 V 卷 · 第 U 单元 · 第 C 章（全书第 N 章）

> 2026-10-20 · 作者提出 · 状态：**待确认后落地**
> 一句话：把「这一章属于哪一卷哪个单元」从**事后折算**变成**生成时写进标题**。

## 1. 为什么这件事比"改文案"大

作者原话（`src/shared/outline-tree.ts` 文件头，2026-10-19）：

> 「我随便挑一章，问你它属于哪一卷、哪一单元，还能找出这种关系么？」

当时的结论是：**这个关系是算出来的，不是存下来的**。大纲正文里没有任何字段表达归属，
`outline-tree` 只能给每章标三种 `source`：

| source | 含义 | 可信度 |
|---|---|---|
| `declared` | 该章写了 `覆盖：<单元ID>` | 可信，但真实项目 10 章里 8 章写「覆盖：无」 |
| `computed` | 按 `arcSpanForChapters` 等分折算反推 | **一旦某单元实际写超，后续章号与单元的对齐整体错位** |
| `mismatch` | 声明与折算不一致 | 漂移早期信号 |

`computed` 那条正是设计稿 §7 的硬前置。只要单元实际章数偏离计划，后面每一章的归属都是错的，
而且**没有任何办法发现**——因为大纲里根本没有真值可比。

作者给的写法（`第3卷第2单元第3章（全书第45章）`）把归属写进标题，
就是给每章补上那个**真值**。所以这不是文案统一，是把 `outline-tree` 的第四种 source
（`heading`）造出来。

## 2. 目标格式

### 中文（默认）
```
## 第3卷第2单元第3章（全书第45章）：章名正文
```

### 英文
```
## Vol 3 Unit 2 Ch 3 (Book Ch 45): Title
```

### 降级规则（结构不全时逐级退化）

| 情况 | 格式 |
|---|---|
| 有卷有单元（三层） | `第{V}卷第{U}单元第{C}章（全书第{N}章）` |
| 只有卷，没有单元（两级结构 `naming === 'volume'`） | `第{V}卷第{C}章（全书第{N}章）`，此时 `{C}` = 卷内第几章 |
| 用户自选故事结构，`parseArcStructure` 解析不出 | 保持现状 `第{N}章`（**不改**，安全降级） |

### 变量怎么定
- `N` = 全书章号（唯一机器锚点，稳定，规则不变）
- `V` = 卷号，`U` = 单元号 —— 由本批的游标给出
- `C` = 单元内第几章 = `N − unitStart + 1`，`unitStart` = 本批 `from`
  - 单元模式下**一批写一个单元**，所以 `C` 从 1 连续递增
  - 将来若支持"单元跨批续写"，`C` 从该单元已有的章数续起（本设计留位，不实现）

### 为什么位置放冒号前、章名放冒号后
`arc-node.ts` 的 `CHAPTER_HEADING` 取"冒号后全部内容"作为 `title`，
`builtin-prompt-templates.ts:978` 要求蓝图**逐字沿用**这个 title。

- 位置在前 ⇒ `title` = 纯章名，**下游零污染** ✓
- 若写成 `## 第45章：章名（第3卷第2单元第3章）` ⇒ `title` 被位置污染，蓝图章名跟着脏 ✗

所以作者给的顺序是对的，不是随便排的。

## 3. 现状：三个各写各的章标题解析器

| 位置 | 正则 | 用途 |
|---|---|---|
| `plot-outline-contract.ts` `headings()` | 允许 `第N–M章` 组、`Chapter N`、任意分隔符 | 覆盖章数 `plotOutlineCoveredTo`、`validPlotOutlineEntry` |
| `arc-node.ts` `CHAPTER_HEADING` | `^#{1,4}\s*(?:第N章|Chapter N)[：:、.·\-—]?(.*)$` | 抽 `title` + 把 `覆盖：` 行归到章 |
| `outline-tree.ts` `scanChapterLines` | `^##\s*第\s*([0-9]+)\s*章` | 章标题行号 |

**三份正则就是三个独立的失效点。** 改格式时只要漏一处，后果不是"显示难看"，
而是「覆盖章数算成 0 ⇒ 单元回填判没写出标题 ⇒ 整批丢弃」或
「从第 1 章覆盖重写」——A6 事故的同款下场。

**因此第一件事不是改正则，是抽一个共享解析器**：

```ts
// src/shared/chapter-heading.ts（新增）
export interface OutlineChapterHeading {
  chapter: number         // 全书章号（唯一必需）
  volumeIndex?: number    // 有则可信
  unitIndex?: number
  chapterInUnit?: number
  title: string           // 冒号后
  line: number
  /** 该行是否带三层归属 */
  attributed: boolean
}
export function parseOutlineChapterHeading(line: string, lineIndex: number): OutlineChapterHeading | null
```

三处全部改为调它。这一步**不改变任何行为**（只把正则挪到一个地方），
可以单独提交、单独回归——把"重构"和"换格式"拆开，出问题时知道是谁的锅。

## 4. 影响链

### 4.1 大纲输出合同（三处，注意红线 19）
| 落点 | 改法 | 指纹影响 |
|---|---|---|
| `synopsisUnitInstruction()`（代码生成） | 直接改文案 | **无** ✓ |
| 逐章模式 `plot-outline-contract.ts:358`（代码生成） | 直接改 | **无** ✓ |
| `synopsis-two-level-suffix.ts` | 直接改（走 `withSystemSuffixOverride` 渲染期替换） | **无** ✓ |
| 内置 `systemSuffix`（三层结构用） | ⛔ **不能直接改** | 会改指纹 ⇒ 所有既有检查点判「源事实已变化」 |

⚠️ 三层结构的单元模式目前用的是**内置 `systemSuffix`**。要给它换输出合同，
**必须**走 `withSystemSuffixOverride()`（红线 19 的解法），否则 A/B 两个项目的检查点全部作废。

同时 `synopsisUnitInstruction` 现在**只给 `unitIndex`，不给卷号**（`:981`），
要让模型写出 `第{V}卷`，得先把 `volumeIndex` 喂进去。

### 4.2 大纲解析
- `headings()` 正则加前缀 `(?:第(\d+)卷)?(?:第(\d+)单元)?`，章号取 `全书第 N 章` 括号值，无括号取裸章号
- `validPlotOutlineEntry` 同步认两种
- `arc-node.CHAPTER_HEADING` 同步
- `outline-tree.scanChapterLines` 同步，并把归属传出去

### 4.3 `outline-tree` 新增 source
```ts
export type ChapterUnitSource = 'heading' | 'declared' | 'computed' | 'mismatch'
```
优先级：`heading` > `declared` > `computed`。
`heading` 与 `computed` 不一致时**不报 mismatch**（因为 heading 是生成时的事实，
折算才是那个会错的），但要计入一个新的 `driftedCount`——这才是真正该暴露的漂移信号。

### 4.4 展示层（新建 `src/shared/chapter-position.ts`）
```ts
export interface ChapterPosition {
  chapter: number
  volumeIndex?: number
  unitIndex?: number
  chapterInUnit?: number
}
export function formatChapterPosition(pos: ChapterPosition, language: WritingLanguage): string
```
调用点（全部改为同一个函数）：
- `ArchitectureConfirmDialog.tsx:503`（单元模式块）
- `synopsis-unit-launch.ts:285`（`describeSynopsisUnitProbe`）
- `ArchFileViewer.tsx:716` / `WorldBuildingEditor.tsx`（toast 与横幅）
- `architecture.command.ts:2824`（进度消息）、`:3020`（回填失败原因）
- `App.tsx:421`（连写日志）
- `synopsis-unit-chain.ts:81`（卷界文案）

### 4.5 T11 起点/重写表达
「从第 1 章重写」→ `第1卷第1单元第1章（全书第1章）`。
在单元模式下**不给"从第 N 章重写"这种模糊选项**，只给：
- 「重写当前单元」（游标不动，清 `synopsis_incomplete`）
- 「清空大纲从第1卷第1单元开始」（清检查点 + 游标，需二次确认）

## 5. 分期与状态

| 期 | 内容 | 风险 | 状态 |
|---|---|---|---|
| **P0** | 抽共享解析器 `chapter-heading.ts`，三处接线，**行为零变化** | 低 | ✅ `f444f88a` |
| **P1** | 展示层 `formatChapterPosition` + 全部调用点 | 低 | ✅ `492dc012` |
| **P2** | 大纲标题合同 + `validPlotOutlineEntry` + `outline-tree` 加 `heading` | **中** | 待做 |
| **P3** | T11 开关 + 起点表达 | 中 | 待做 |

### P0 实际挖出的三处真实差异（P2 必读）

三份正则的宽容度差异**不是冗余，是各自的约束**。合并时若按并集处理，会静默改变行为：

| 差异 | contract | arc-node | outline-tree |
|---|---|---|---|
| `#` 后必须有空白（`##第5章`） | **要求** | 不管 | 不管 |
| 认 `Chapter N` | 认 | 认 | **不认** |
| 分隔符含全角句点 `．` | 认 | **不认** | 不管 |
| 认章组 `第N–M章` | 认 | **不认** | **不认** |
| 认中文数字 | 认 | **不认** | **不认** |

所以共享解析器只输出字段（`prefixSpaced` / `style` / `arabic` / `grouped` / `after`），
约束留在调用方。`arc-node` 的 `title` 必须从 `after` **自己切**，不能用 `rest`
（`## 第5章．甲` 在它那里的 title 是 `．甲`）。

**证据**：A/B 两个项目真实大纲（8,110 / 3,357 字）+ 15 个构造边界样本上，
覆盖章数 / 覆盖行归属 / 章标题行号三条链路新旧实现逐条一致（51 条对比，跑完即删）。

### P1 落点（实际）

`formatChapterPosition` 接线 5 处：生成弹窗单元块、`describeSynopsisUnitProbe`、
`ArchFileViewer` 单元批次 toast、`architecture.command` 的「正在写【单元…】」与
回填失败原因、`App` 连写的下一批日志。

**按章区间文案不动**（续写起点、章节区间、连写链进度 `N/M`）—— 它们本来就不是单元位置。

## 6. 红线与风险

1. **存量必须永久双格式兼容**。大纲是累积合并的（`joinPlotOutlineEntries`），
   旧标题和新标题会长期混在一个文件里。不做一次性改写——那要动已落库正文。
2. **`N` 由模型写，不由程序补**。程序补要改动已生成正文，破坏"大纲是生成产物"的忠实性，
   且 `validPlotOutlineEntry` 校验的是 attempt 的原始 artifact。
3. **`N` 写错仍然判无效**（和现在一样），所以相对风险没有增加；
   新增的风险只有 `V`/`U`/`C` 写错——而它们**不参与校验**，只影响树和显示，
   且 `heading` 与 `computed` 不一致时会进 `driftedCount`，能被看见。
4. 内置 `systemSuffix` 一律走 override（红线 19），**不改模板对象**。
5. P0 单独提交，方便定位回归。

## 7. 已裁定（作者 2026-10-20）

1. **分期**：按 P0→P1→P2→P3 走，P0+P1 先落地看效果再动标题。
2. **两级结构**（无单元层）**也要带归属**：`第{V}卷第{C}章（全书第{N}章）`，`C` = 卷内第几章。
   否则两级结构永远只能靠折算，问题原样存在。
3. **英文格式**：`Vol 3 Unit 2 Ch 3 (Book Ch 45)`。

## 8. P2 开工前必须确认的两件事

1. **三层结构的内置 `systemSuffix` 必须走 `withSystemSuffixOverride()`**（红线 19）。
   直接改模板对象会让 `synopsisInputsFingerprint` 全变，A/B 两个项目的检查点一起作废。
2. **`synopsisUnitInstruction` 现在只给单元号、不给卷号**（`architecture.command.ts:981`），
   模型写不出「第 V 卷」—— 必须先把 `volumeIndex` 喂进 prompt。
