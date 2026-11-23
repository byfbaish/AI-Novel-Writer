# AC3 / S3 实施包 · 弧层引用闭合（接线卡）

- 卡：`ed210a27-4a31-4b72-b46d-4f572aaa914c`「AC3/S3（依赖第五层「弧」落地）」
- 判定面：`57d05871`（develop，porcelain 0）
- 分支：`card/arch-ac3-s3`，起点 `57d05871`
- 性质：**接线卡**（能力已存在，缺的是接进预检），不是新建校验器
- 本卡不动：`src/shared/arc-node.ts`（零改）、不建表、不动批次身份与证明体系

---

## §1 事实（判定面 `57d05871`，逐条实测）

### 1.1 既有能力在哪
| 位置 | 事实 |
|---|---|
| `src/shared/arc-node.ts:104` | `listArcNodes(plan, totalChapters)`：把弧光结构摊平成结构位清单，`id` 形如 `M1` / `M1-2` / `M1-2/转折` / `M1-1/小弧:<名>`，每格带闭区间 `range` |
| `src/shared/arc-node.ts:238` | `validateArcCovers(nodes, covers, chapterNumber)`：判 INV-1 越界 / COARSE_NODE 粒度太粗 / NOT_CLAIMABLE 整段规格 |
| `src/shared/arc-node.ts:249-256` | `UNKNOWN_NODE` 发射点：`findArcNode` 找不到该 ID ⇒ 「第 N 章声明了未知结构位「X」——弧光结构里没有这一格（可能拼写错误，或弧光已重排）」 |
| `src/shared/arc-node.ts:359` | `parseChapterArcCovers(synopsis)`：从大纲章标题正下方的 `覆盖：` 行解析每章声明的结构位 |
| `src/shared/arc-node.ts:439-449` | `auditArcCovers` 在内部调用 `validateArcCovers`，另加 INV-2 重复 / INV-3 漏覆盖 |

### 1.2 现在接在哪、缺哪一段
```
$ grep -rn "validateArcCovers\|auditArcCovers" --include=*.ts src electron | grep -v __tests__
src/shared/arc-node.ts:238:export function validateArcCovers(
src/shared/arc-node.ts:449:    violations.push(...validateArcCovers(nodes, chapter.covers, chapter.chapterNumber))
src/services/workflows/commands/architecture.command.ts:812:  const audit = auditArcCovers(nodes, chapters, { from, to })
```
- 唯一生产调用点 `architecture.command.ts:812` 属于 **`summarizeArcCoverFindings`**（`:794`），只在本批大纲**生成完之后**打一条提示（`:838`「⚠️ 卷 / 单元结构位对账…」）。
- **预检通路里没有它**：`src/services/consistency-preflight.ts` 全文（85 行）不 import 任何 `arc-*`；`src/shared/consistency-preflight.ts` 的 findings 装配只认连续性 / 空间钟点 / attacks / 名册 / 具名登记。
  → 这就是本卡要补的那一段接线。

### 1.3 输入从哪来（不新增 IPC）
`readConsistencyPreflight` 已经读过一次 `db:project-core-get`（`src/services/consistency-preflight.ts:41`），返回的 `ProjectCoreData` 就带本卡需要的三项：
- `totalChapters: number`（`electron/repositories/project-core-repository.ts:58`）
- `plotStructurePlan: string`（`:76`）
- `synopsis: string`（`:79`）

### 1.4 一处要裁（阻塞点，必须先定）
**两级命名（卷 / 单元）结构下，弧层校验没有输入。**

- `src/services/prompts/synopsis-two-level-suffix.ts:37`（原句）：「严禁输出「覆盖：」行 —— 本结构只有「卷 / 单元」两级，没有可声明的结构位；不得自造任何形如 V1-U1-Start、M1-1 的编号。」
- 因此 `architecture.command.ts:805` 明写：`if (parseArcStructure(plan ?? '')?.naming === 'volume') return null` —— 两级结构下既有对账**直接短路**。
- `parseChapterArcCovers` 只认 `覆盖：` 行（`arc-node.ts:318-323`、`:381-386`），两级大纲按合同不会有这一行 ⇒ `covers` 恒空 ⇒ 本卡规则在两级项目上**恒 fail-open**。

要裁的只有一句：**接受「本卡在两级结构上恒不判、判红只在三级结构上可证明（[mock] 夹具）」**，缺口写进 S4 收口件；还是要两级也可判（那就得改输出合同、给章一个可引用的结构位字段 —— 那是另一张卡，越本卡射程）。
> 我的建议：接受。理由：本卡是接线卡，判据「重排报 UNKNOWN_NODE」在三级结构上可判红、可变异；两级要可判必须新增输出字段，属「新增能力」不属「接线」。

### 1.5 与既有 `summarizeArcCoverFindings` 不重复
- 它：大纲**生成**完 → 一次性 UI 提示，`from`–`to` 整批对账，含 INV-2 / INV-3。
- 本卡：**写某一章之前**的预检，只看这一章，只报 INV-1 / UNKNOWN_NODE / COARSE / NOT_CLAIMABLE。
- 两者不共享批次状态、不重复弹同一条（INV-3 本卡不实现，见 §6）。

---

## §2 新增文件（唯一新增）

`src/shared/arc-cover-consistency.ts`

```ts
/**
 * AC3/S3：弧层引用闭合 —— 把既有的 `validateArcCovers` 接进预检通路。
 *
 * 计算全在 `arc-node.ts`（纯结构比较、零语义解析、缺字段 fail-open）；
 * 这里只做三件事：**取本章声明的结构位**、**接豁免**、**译成 `ConsistencyFinding`**。
 *
 * 输入取 `project_core` 的三项（`totalChapters` / `plot_structure_plan` / `synopsis`），
 * 与 `architecture.command.ts` 的 `summarizeArcCoverFindings` 同源，但**只看一章**。
 */
import { listArcNodes, parseChapterArcCovers, validateArcCovers, type ArcCoverViolation } from './arc-node'
import type { ConsistencyExemption, ConsistencyFinding } from './consistency-preflight'

export const ARC_COVER_KEY_PREFIX = 'arc:cover:'

/** 键**不含章号**：同一格的问题一次豁免全书生效（与 `roster:` / `named:` 两族同口径）。 */
export function arcCoverStableFactKey(code: string, id: string): string {
  return `${ARC_COVER_KEY_PREFIX}${code}:${id.trim()}`
}

export interface ArcCoverScope {
  chapterNumber: number
  /** `project_core.plot_structure_plan`；缺省按不可解析处理。 */
  plotStructurePlan?: string | null
  /** `project_core.synopsis`；`覆盖：` 行从这里来。 */
  synopsis?: string | null
  /** `project_core.total_chapters`；非法即不判。 */
  totalChapters?: number | null
}

interface MessagePair {
  issue: { zhCN: string; enUS: string }
  suggestion: { zhCN: string; enUS: string }
}

/**
 * 四种违规各自的说法。文案**不许收窄**：`UNKNOWN_NODE` 必须保留「可能拼写错误，或弧光已重排」，
 * 否则作者会以为是别处的毛病，而唯一解是改 ID 或重排。
 */
function messageFor(code: ArcCoverViolation['code'], id: string, chapterNumber: number): MessagePair {
  if (code === 'UNKNOWN_NODE') {
    return {
      issue: {
        zhCN: `第 ${chapterNumber} 章声明了未知结构位「${id}」——弧光结构里没有这一格（可能拼写错误，或弧光已重排）。`,
        enUS: `Chapter ${chapterNumber} claims an unknown story slot "${id}" — no such node exists in the arc structure (typo, or the arc was reordered).`,
      },
      suggestion: {
        zhCN: '核对弧光结构里的结构位 ID；若弧光已重排，把本章声明改成重排后仍存在的那一格。',
        enUS: 'Check the slot ID against the arc structure; if the arc was reordered, point this chapter at a slot that still exists.',
      },
    }
  }
  if (code === 'INV-1-OUT_OF_RANGE') {
    return {
      issue: {
        zhCN: `第 ${chapterNumber} 章声明了结构位「${id}」，但该格不覆盖本章 —— 提前消耗了后续弧光。`,
        enUS: `Chapter ${chapterNumber} claims slot "${id}", but that slot does not cover this chapter — later arc material is consumed early.`,
      },
      suggestion: {
        zhCN: '把声明改成覆盖本章的那一格，或调整弧光结构的章数划分。',
        enUS: 'Claim a slot that covers this chapter, or adjust the chapter split in the arc structure.',
      },
    }
  }
  if (code === 'COARSE_NODE') {
    return {
      issue: {
        zhCN: `第 ${chapterNumber} 章声明的「${id}」是大弧 / 中弧粒度，无法据此检测重复兑现。`,
        enUS: `Chapter ${chapterNumber} claims "${id}" at major/mid-arc granularity, which cannot detect duplicate pay-offs.`,
      },
      suggestion: {
        zhCN: `细化到具体结构位（如「${id}/转折」或「${id}/小弧:<小弧名>」）。`,
        enUS: `Refine it to a concrete slot (e.g. "${id}/转折" or "${id}/小弧:<name>").`,
      },
    }
  }
  return {
    issue: {
      zhCN: `第 ${chapterNumber} 章声明的「${id}」是整段规格，不是一次性节点 —— 声明它既不产生信息，也无法被重复消费检测。`,
      enUS: `Chapter ${chapterNumber} claims "${id}", which is a whole-span specification rather than a one-shot node — claiming it yields no information and cannot be duplicate-checked.`,
    },
    suggestion: {
      zhCN: '改声明「转折」或一个小弧。',
      enUS: 'Claim the turning point or a minor arc instead.',
    },
  }
}

/**
 * 本章的弧层引用是否闭合。
 *
 * 守卫顺序（任一命中即不判，fail-open）：
 * ① 章号非正整数；② `totalChapters` 非正整数；③ 弧光结构摊平后没有结构位；
 * ④ 大纲里找不到本章、或本章 `covers` 为空（含「覆盖：无」）。
 */
export function findArcCoverRisks(
  scope: ArcCoverScope,
  exemptions: readonly ConsistencyExemption[] = [],
): ConsistencyFinding[] {
  const chapterNumber = scope.chapterNumber
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1) return []
  const totalChapters = scope.totalChapters
  if (typeof totalChapters !== 'number' || !Number.isSafeInteger(totalChapters) || totalChapters < 1) return []

  const nodes = listArcNodes(scope.plotStructurePlan ?? '', totalChapters)
  if (nodes.length === 0) return []

  const chapter = parseChapterArcCovers(scope.synopsis ?? '')
    .find(item => item.chapterNumber === chapterNumber)
  if (!chapter || chapter.covers.length === 0) return []

  const activeExemptions = new Set(
    exemptions.filter(item => !item.revoked).map(item => item.stableFactKey),
  )
  const findings: ConsistencyFinding[] = []
  for (const violation of validateArcCovers(nodes, chapter.covers, chapterNumber)) {
    const stableFactKey = arcCoverStableFactKey(violation.code, violation.id)
    if (activeExemptions.has(stableFactKey)) continue
    const message = messageFor(violation.code, violation.id, chapterNumber)
    findings.push({
      stableFactKey,
      severity: 'warning',
      sourceChapter: chapterNumber,
      evidence: violation.message,
      issue: message.issue,
      suggestion: message.suggestion,
    })
  }
  return findings
}
```

**为什么不写 `sourceLayer`**：`ConsistencySourceLayer` 只有两个值，面板 `src/components/dialogs/ConsistencyPreflightPanel.tsx:42-43` 是二元硬编码（非 `'world-building'` 一律显示「本章蓝图 / 空间规则」）。写 `'blueprint'` 会把「去改大纲的覆盖行」误导成「改本章蓝图」。本卡不改面板。

---

## §3 接线（改 1 个既有文件，两处）

文件：`src/services/consistency-preflight.ts`

**3a · import（加在 `:9` 之后）**
```ts
import { findArcCoverRisks } from '../shared/arc-cover-consistency'
```

**3b · 把 `db:project-core-get` 的结果多留三位（替换 `:39-43`）**
现状：
```ts
  let worldBuildingText: string | undefined
  try {
    const core = await ipc.invokeWithProjectSession(session, 'db:project-core-get', session.projectPath)
    worldBuildingText = (core as { worldbuilding?: string } | null)?.worldbuilding
  } catch { worldBuildingText = undefined }
```
改为：
```ts
  let worldBuildingText: string | undefined
  /** 弧层（AC3）的输入：与 `worldbuilding` 同一次读取，不新增 IPC。读取失败一律 fail-open。 */
  let arcLayer: { plotStructurePlan?: string; synopsis?: string; totalChapters?: number } | undefined
  try {
    const core = await ipc.invokeWithProjectSession(session, 'db:project-core-get', session.projectPath) as
      | { worldbuilding?: string; plotStructurePlan?: string; synopsis?: string; totalChapters?: number }
      | null
    worldBuildingText = core?.worldbuilding
    arcLayer = {
      plotStructurePlan: core?.plotStructurePlan,
      synopsis: core?.synopsis,
      totalChapters: core?.totalChapters,
    }
  } catch { worldBuildingText = undefined }
```

**3c · 接进逐蓝图 findings（加在 `:61` 的 `findBlueprintSlotAttackRisks` 那一行之后）**
```ts
        ...findArcCoverRisks({ chapterNumber: blueprint.chapterNumber, ...arcLayer }, exemptions),
```

**3d · 覆盖度不动**：`ConsistencyPreflightCoverage`（`src/shared/consistency-preflight.ts:260-265`）本卡**不扩字段**——扩了没人渲染就是死数据（AC2 的 `describeNamedEntityCoverage` 已栽过一次）。缺口写进文档（§7）。

---

## §4 用例（11 条，正向 3 / 负向 8）与变异靶

文件：`src/shared/__tests__/arc-cover-consistency.test.ts`

夹具一律**照抄** `src/shared/__tests__/arc-node.test.ts:17-54` 的 `PLAN`（150 章三级结构）与 `TOTAL = 150`，并另造一份两级「卷 / 单元」夹具（只有 `## 卷 1：…（约 1–12 章）` / `### 单元 1：…` 两级标题，无 `覆盖：` 行）。

| # | 用例 | 断言 |
|---|---|---|
| 1 | 正向：本章声明 `M1-2/转折`，章号 3（该格属 27–52） | 1 条 finding；`stableFactKey === 'arc:cover:INV-1-OUT_OF_RANGE:M1-2/转折'`；`severity==='warning'`；`sourceChapter===3` |
| 2 | 正向（卡面判据）：弧光**重排后**该 ID 不存在，本章仍写 `M9-9/转折` | 1 条 `UNKNOWN_NODE`；键 `arc:cover:UNKNOWN_NODE:M9-9/转折`；`issue.zhCN` 含「可能拼写错误，或弧光已重排」 |
| 3 | 正向：声明大弧 `M1` | 1 条 `COARSE_NODE`（键 `arc:cover:COARSE_NODE:M1`） |
| 4 | 负向：本章写「覆盖：无」 | `[]` |
| 5 | 负向：大纲里没有本章条目 | `[]` |
| 6 | 负向：两级「卷 / 单元」夹具（无 `覆盖：` 行） | `[]` ← **显式缺口用例**，注释写明 §1.4 |
| 7 | 负向：`totalChapters` 为 0 / 非整数 / `undefined` | `[]` |
| 8 | 负向：`plotStructurePlan` 为空串 / `undefined` | `[]` |
| 9 | 负向：`chapterNumber` 为 0 / -1 / 1.5 | `[]` |
| 10 | 负向：豁免命中（`{stableFactKey:'arc:cover:INV-1-OUT_OF_RANGE:M1-2/转折', revoked:false}`） | `[]`；同一条豁免 `revoked:true` 时**仍报 1 条** |
| 11 | 纯函数：同一入参连续调用两次，结果 `toEqual` 且原入参未被修改（深拷贝比对） | 相等 |

**变异靶（每发跑一遍，必须至少 1 条用例转红）**
| 靶 | 改法 | 应红 |
|---|---|---|
| M1 | 删掉 `totalChapters` 守卫 | #7 |
| M2 | 删掉 `chapter.covers.length === 0` 守卫 | #4 |
| M3 | `arcCoverStableFactKey` 去掉 `code` 段 | #1（键全文断言） |
| M4 | 豁免过滤改成 `item.revoked` | #10 |
| M5 | 删掉 `nodes.length === 0` 守卫 | #8（空 plan 时 `validateArcCovers` 会把每个 ID 报成 `UNKNOWN_NODE`） |

---

## §5 命令（自测 + 判据取证）

```bash
# 单测（Electron 运行时；禁全量、禁 test:browser、禁切 ABI）
node scripts/run-tests-electron.mjs \
  src/shared/__tests__/arc-cover-consistency.test.ts \
  src/shared/__tests__/consistency-preflight.test.ts \
  src/shared/__tests__/consistency-preflight-space-time.test.ts

# 闸门
pnpm check:fast
```

**接线前后命令原文**（判据要的两段，原样贴进回执）
```bash
# 接线前（判定面 57d05871）：预检通路里没有任何 arc-* 引用
grep -rn "arc-cover-consistency\|findArcCoverRisks" --include=*.ts src | grep -v __tests__
#   -> 零输出，rc=1

# 接线后
grep -rn "arc-cover-consistency\|findArcCoverRisks" --include=*.ts src | grep -v __tests__
#   -> src/shared/arc-cover-consistency.ts:...
#      src/services/consistency-preflight.ts:10:import { findArcCoverRisks } ...
#      src/services/consistency-preflight.ts:NN:...findArcCoverRisks({ chapterNumber: ...

# 判红（[mock]）：用例 #2 的断言就是卡面「重排报 UNKNOWN_NODE」
```

---

## §6 本卡不做
- 不实现 INV-2（跨章重复兑现）与 INV-3（漏覆盖）：前者要跨章台账、后者要本批区间，都不在「一章预检」射程内；既有 `summarizeArcCoverFindings` 继续负责。
- 不改 `src/shared/arc-node.ts`（零改，只 import）。
- 不建表、不给章加 `结构位` 字段、不动节点 ID 生成方式（`M<i>` 仍由解析顺序决定，指纹仍是一期不做）。
- 不扩 `ConsistencySourceLayer`、不改面板、不扩覆盖度字段。
- 不碰批次身份与证明体系（`L1-ARCH-02`，卡 `6be33a2b`）。

## §7 显式缺口（写进 S4 收口件，不许省略）
1. **两级「卷 / 单元」结构下本规则恒不判**：输出合同 `synopsis-two-level-suffix.ts:37` 禁止 `覆盖：` 行与自造 `M1-1` 编号，`architecture.command.ts:805` 也因此短路。本卡判红只在三级结构上可证明。
2. **覆盖度里没有弧层的「显式未判」**：跑了一个两级项目，界面上「没判」与「判过无问题」同形（B′ 缺陷同型）。本卡按 §3d 不扩字段，缺口记账。
3. **结构位 ID 无文本指纹**：`arc-node.ts:59-61` 自述「一期不做」，所以「重排」只能靠 ID 对不上来间接发现（等价于 `UNKNOWN_NODE`），无法区分「改了名」与「挪了位置」。
