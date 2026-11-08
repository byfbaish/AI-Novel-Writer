# 任务：正文 vs 上一章全文的复用覆盖率判定器（纯函数 + 单测）

## 0 红线（违反任一即视为未完成）

- 工作目录固定 `C:\develop\workspace\AI-writer\wt-3`。**不要**读写主工作区 `develop`。
- **只准新建这两个文件**，其它一律不许动：
  - `src/shared/chapter-reuse-coverage.ts`
  - `src/shared/__tests__/chapter-reuse-coverage.test.ts`
- **不许改** `src/services/workflows/commands/generate-draft.command.ts`，也不许把它接进任何调用点。本任务只交付「判定器 + 测试」，接线由派单方自己做。
- 只准跑单测：`npx vitest run src/shared/__tests__/chapter-reuse-coverage.test.ts`。禁全量测试、禁 `pnpm test`、禁 `test:node`、禁起应用。
- 不提交 git、不推送、不 rebase。
- 不改任何全局配置（`config.json` / `models.json` / `recent-projects.json`）。

## 1 为什么做这件事（背景，读一遍就够）

App 现在有一条守卫 `hasSubstantialPreviousChapterReuse`（在 `generate-draft.command.ts` 约 366–390 行），
它只比**上一章结尾**与**新章开头 1,200 字**。因此它能拦住「开头照抄」，
但拦不住**「整章重写上一章、只是换了个开头」**——这是实测里最危险的一种（字数、段落形态全合规，只有这条守卫拦得住，而它抓不到）。

本任务只做**判定器**：给它「本次正文」与「上一章全文」，它回答「有多少比例是复用了上一章」。

## 2 照着现成的同构实现做，别自造

`src/shared/blueprint-verbatim-overlap.ts` 里的 `analyzeBlueprintVerbatimCopy(prose, blueprintText, options)`
已经是同一类东西（正文 vs 一段参考文本的连续重合分析），**先读它**，按它的形状写：

- n-gram 切法、中文/英文的语言分支、常量命名，**沿用它的口径**，不要另立一套。
- 它用的是「最小连续重合段长度」常量（`BLUEPRINT_COPY_MIN_RUN_CJK` / `_ENT`），你的实现也用同源口径。

差异只有两点：① 参考文本换成**上一章全文**；② 报告里要给出**覆盖率**（覆盖的正文码元 / 正文总码元），
而不只是若干重合段。

## 3 要交付的 API（签名照抄，不要改名）

```ts
export type ChapterReuseSeverity = 'ok' | 'advisory' | 'blocking'

export interface ChapterReuseRun {
  /** 在 prose 中的起始索引 */
  start: number
  /** 该重合段的长度（码元） */
  length: number
}

export interface ChapterReuseReport {
  /** 被上一章覆盖的正文码元数 / 正文总码元数，取值 0–1，不允许 NaN */
  ratio: number
  /** 被覆盖的正文码元数 */
  coveredUnits: number
  /** 连续重合段，按 start 升序；相邻段不许重叠 */
  runs: ChapterReuseRun[]
  /** 最长一段的长度，无重合时为 0 */
  longestRun: number
  severity: ChapterReuseSeverity
}

export function analyzeChapterReuse(
  prose: string,
  previousChapter: string,
  options?: { writingLanguage?: string },
): ChapterReuseReport
```

**阈值**：在文件顶部定义三个可导出常量，值先按下表写，并加一行注释 `// 待用存量样本标定`：

```ts
export const REUSE_RATIO_ADVISORY = 0.15
export const REUSE_RATIO_BLOCKING = 0.35
// ratio > REUSE_RATIO_BLOCKING → 'blocking'
// ratio > REUSE_RATIO_ADVISORY 且 <= BLOCKING → 'advisory'
// 否则 → 'ok'
```

**边界（必须都处理，不许抛错、不许 NaN）**：

- `prose` 为空 或 `previousChapter` 为空 → `ratio: 0, coveredUnits: 0, runs: [], longestRun: 0, severity: 'ok'`
- 两者都短于一个 n-gram → 同上（不抛错）
- `ratio` 超过 1 时钳到 1

## 4 测试要求（至少 8 例，一例一个 `it`，标题用中文说明它在防什么）

必须覆盖下面 8 种，缺一即未完成：

| # | 场景 | 期望 |
|---|---|---|
| 1 | 两段毫不相干的中文 | `severity: 'ok'`，`ratio` 接近 0 |
| 2 | 正文整章逐字抄上一章 | `severity: 'blocking'`，`ratio >= 0.9` |
| 3 | 只抄上一章**结尾**约 300 字、其余全新 | `ok` 或 `advisory`（**不能是 blocking**——正常承接必须放过） |
| 4 | 抄上一章**中间段落**，开头换成新写的一句 | **必须** `advisory` 或 `blocking`（这是现存守卫抓不到的场景，本任务存在的理由） |
| 5 | 同一场景续写：复用设定名词、句式全新 | **必须** `ok`（防误报；同场景续写本来就复用名词） |
| 6 | `prose` 为空串 / 只有空白 / `previousChapter` 为空串 | 三种都不抛错，返回全 0 与 `'ok'` |
| 7 | `writingLanguage: 'en-US'`，英文按词切 | 英文整段抄 → `blocking`；不抛错 |
| 8 | 两者都短于一个 n-gram（如各 3 个字） | 不抛错，`ratio: 0` |

测试用**你自己构造的中文段落**（不要抄项目里的正文数据）。每例的正文长度 ≥ 200 字，
否则第 3、4 两例的区分度不够。

## 5 交付格式（回复正文按此顺序写，缺段视为未完成）

1. **改动清单**：`文件:行` 逐条。
2. **测试原始输出**：`npx vitest run src/shared/__tests__/chapter-reuse-coverage.test.ts` 的**完整输出原文**（不要只写「全部通过」）。
3. **8 个用例逐条一行**：`#n 用例名 —— 它在防什么`。
4. **对齐说明**：你从 `blueprint-verbatim-overlap.ts` 沿用了哪些口径、改了哪些，各一行。
5. **未做的事 / 你判断需要人工裁决的点**（没有就写「无」）。
6. 最后一行：`## [T1] DONE <一句话>` 或 `## [T1] BLOCKED <卡在哪>`。

## 6 判定线（派单方会照这个验）

- 只改了两个文件（`git -C wt-3 status --short` 只有这两条）。
- 单测全绿，且**第 3 例不是 blocking、第 4 例不是 ok、第 5 例是 ok**——这三条是真正的验收点。
- 没有出现 NaN / 抛错的边界路径。
- 没有任何接线改动。
