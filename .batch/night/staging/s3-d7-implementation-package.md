# D7 实施包 · 单元→章折算：对话框预告两数（名义上界 + 按当前实际倾向估计）

From: developer · AI writer项目组（Architecture/IT Advisor）
To: 实施方（外派）/ QA · AI writer项目组
版本：v2 · 2026-11-22 · 底稿：`card/s3-d7-unit-chapter-estimate`（v2，71 行 / 7,072B / sha256 `dedb5733…c7ec56`）
起点：`a2a9d1d5`（D4 合并提交；其后 `f9125384` 仅文档留痕，不影响判据作用域）（与卡面 v2 同一占位，**禁止写死 `5a285e83` / `b4e8da53`**，免得再作废一次）
卡面：`.batch/night/cards/s3-d7-unit-chapter-estimate.md`（行号勘误与估计算式 A 由主身随卡面一笔提交）

## 0. 开工前必读（缺一行不许开工）

① 读：仓库根 `README.md`、`AGENTS.md`、`.batch/night/cards/s3-d7-unit-chapter-estimate.md`、本包。
② 版本：`README.md` `c87cd4ab`（2026-11-14）；`AGENTS.md` `a276fffb`（2026-11-07）；卡面版本以主身提交后为准。
③ 三条口径：只改「预告显示与折算估计」，`computeSynopsisUnitRange` 一字不动；实机复验不由外派做；证据只认命令原文与整文件汇总行。

## 0.5 ⚠️ 待裁：卡面 v2 §2 行 31 的字面公式与「本卷剩余」不同维度

卡面 v2 行 31 原文：`估计 ＝ 已写章数 ÷ 已完成单元数 × 本卷剩余单元数 ＋ 已写章数`（向下取整）。
本工程里 `已写章数` 只有 `synopsis_covered_to` 一个来源，它是**全书**已写；把它再加一次，等于把全书已写累加到本卷剩余估计上，与同屏的「本卷剩余 N 章 / 名义上界 M 章」不可比。

`node -e` 实测四组（脚本见 §7 复算命令）：

```
covered=20 doneUnits=1 remainUnits=1 → 本包(剩余,ceil)=20 / 卡面字面(＋已写,floor)=40 / 名义上界=10
covered=20 doneUnits=1 remainUnits=0 → 本包=1                / 卡面字面=20                / 名义上界=10
covered=10 doneUnits=0 remainUnits=1 → 本包=null(兜底)       / 卡面字面=null              / 名义上界=10
covered=46 doneUnits=2 remainUnits=1 → 本包=23               / 卡面字面=69                / 名义上界=10
```

待裁两点（裁定前**不进 apply**，卡面口径唯一权威）：
1. `＋ 已写章数` 删否——建议删（单位对齐「本卷剩余」）；若坚持保留，须同时把标签改成「本卷预计总章数」并改判据 4 的对照口径，属改卡。
2. 取整——卡面 v2 字面「向下取整」，此前负责人口头为「取整同现有预告（ceil）」。建议 `floor` ＋ 下限 1（尊重卡面字面）；两种取整在 `covered=5, done=3, remain=2` 时首次分叉：ceil 4 / floor 3。

本包 §1/§2/§3 现按「本卷剩余，ceil，下限 1」写；一旦裁定为 floor 或保留 `＋已写`，改动面只有 §2-B 的取整一行、§2-E 的一句措辞、§3 第 3 支边界值，其余不动。

## 1. 口径（负责人 11-22 裁定，主判据，勿改）

- 估计值 ＝ `已写章数 ÷ 已完成单元数 × 本卷剩余单元数`，取整规则与现有预告一致＝`Math.ceil`，下限 1；历史一律取自现有检查点（`synopsis_covered_to` + `synopsis_unit_cursor` + 卷/单元结构），不新增表 / 列 / IPC / 字段落盘。
- 作废算式 `Σactual / Σplanned`（k 倍名义上界）：k≥1 时估计恒 ≥ 名义上界，撞 §3「不许做成第二个上限」；不进界面、不作判据。
- 名义上界 `unit.maxChapters` 原值原算法，改前改后逐位一致（判据 4）。
- 无历史（`coveredTo < 1` 或 `已完成单元数 < 1`）→ 兜底文案，**不显示任何估计数字**，不得复用名义上界（判据 3；主线 `63e1a20d` 已收紧为「M 与 N 完全相同即 FAIL」）。

## 2. 改动点清单（4 处，全部在既有白名单内）

### A. `src/services/workflows/synopsis-unit-launch.ts:70-104` — 探针结果加一个只读字段

在 `SynopsisUnitProbeResult` 的 `volume`（`:94-100`）之后、`detail`（`:102`）之前插入：

```ts
  /**
   * 历史折算：本卷剩余单元按「已完成单元的实际章数」估计会写几章。
   * `null` = 没有历史（还没写完任何一个单元）⇒ 对话框显示兜底文案，**不得回落到 `unit.maxChapters`**。
   * ⚠️ 只用于展示：不参与 `computeSynopsisUnitRange`、不进 `ArchitectureUnitRange`、不进 planning intent、
   * 不进检查点、不被任何校验或闸门读取（否则等于把估计做成第二个上限）。
   */
  readonly chapterEstimate?: {
    /** 本卷剩余单元的预计章数（已按预告同一取整规则 ceil，下限 1） */
    readonly volumeChapters: number
    /** 平均每个已完成单元的实际章数（原值，不取整，供报告复算） */
    readonly perUnitChapters: number
    /** 样本量：已完成单元数 */
    readonly completedUnits: number
  } | null
```

### B. 同文件 `:318` 之前新增纯函数（放在 `describeUnitVolume` 上方）

```ts
/**
 * 历史折算的纯算术部分：本卷剩余单元预计还会写几章。
 *
 * 口径（负责人 11-22 定）：`已写章数 ÷ 已完成单元数 × 本卷剩余单元数`，取整同现有预告
 * （`Math.ceil`，下限 1）。**只读展示**，与 `computeSynopsisUnitRange` 无调用关系。
 * 样本不足（没写完任何一个单元 / 已写章数为 0）返回 `null`，由调用方走兜底文案。
 */
export function estimateRemainingVolumeChapters(input: {
  readonly coveredTo: number
  readonly completedUnits: number
  readonly remainingUnits: number
}): { volumeChapters: number; perUnitChapters: number } | null {
  if (!Number.isSafeInteger(input.coveredTo) || input.coveredTo < 1) return null
  if (!Number.isSafeInteger(input.completedUnits) || input.completedUnits < 1) return null
  if (!Number.isSafeInteger(input.remainingUnits) || input.remainingUnits < 1) return null
  const perUnitChapters = input.coveredTo / input.completedUnits
  return Object.freeze({
    volumeChapters: Math.max(1, Math.ceil(perUnitChapters * input.remainingUnits)),
    perUnitChapters,
  })
}
```

### C. 同文件 `:291-310` — 探针返回处：先取 `volume`，再算估计

现有（`:299-309`）：

```ts
  const unit = computeSynopsisUnitRange(input.plotStructurePlan, totalChapters, cursor, coveredTo)
  if (!unit) return skip('compute-null', coveredTo, found, explicitCursor === null)
  return Object.freeze({
    unit,
    reason: null,
    coveredTo,
    checkpointFound: found,
    outlineCoveredTo,
    cursorDerived: explicitCursor === null,
    volume: await describeUnitVolume(input.plotStructurePlan, totalChapters, cursor),
  })
```

改成（`computeSynopsisUnitRange` 调用行一字不动）：

```ts
  const unit = computeSynopsisUnitRange(input.plotStructurePlan, totalChapters, cursor, coveredTo)
  if (!unit) return skip('compute-null', coveredTo, found, explicitCursor === null)
  const volume = await describeUnitVolume(input.plotStructurePlan, totalChapters, cursor)
  return Object.freeze({
    unit,
    reason: null,
    coveredTo,
    checkpointFound: found,
    outlineCoveredTo,
    cursorDerived: explicitCursor === null,
    volume,
    chapterEstimate: estimateFromCheckpoint({
      plotStructurePlan: input.plotStructurePlan,
      totalChapters,
      cursor,
      coveredTo,
      remainingUnits: volume?.remainingUnits ?? 0,
    }),
  })
```

并在 `describeUnitVolume`（`:318-341`）之后新增一个 async 适配层（内部才 import `arc-position`，与本模块既有懒加载风格一致，**不新增静态依赖**）：

```ts
/** 把「已完成单元数」从卷/单元结构里数出来，再交给纯函数算估计。任何异常都退化成 `null`。 */
async function estimateFromCheckpoint(input: {
  readonly plotStructurePlan: string | undefined
  readonly totalChapters: number
  readonly cursor: { readonly volumeIndex: number; readonly unitIndex: number; readonly writtenInVolume: number }
  readonly coveredTo: number
  readonly remainingUnits: number
}): Promise<SynopsisUnitProbeResult['chapterEstimate']> {
  try {
    const { parseArcStructure } = await import('../../shared/arc-position')
    const parsed = parseArcStructure(input.plotStructurePlan ?? '')
    if (!parsed) return null
    let completedUnits = 0
    for (let volume = 1; volume < input.cursor.volumeIndex; volume += 1) {
      completedUnits += parsed.majors[volume - 1]?.mids.length ?? 0
    }
    completedUnits += Math.max(0, input.cursor.unitIndex - 1)
    const estimate = estimateRemainingVolumeChapters({
      coveredTo: input.coveredTo,
      completedUnits,
      remainingUnits: input.remainingUnits,
    })
    return estimate ? Object.freeze({ ...estimate, completedUnits }) : null
  } catch {
    return null
  }
}
```

> 为什么不用 `synopsis_volume_deviations`：A 式只需要「已写章数 / 已完成单元数 / 本卷剩余单元数」，三者都在现有检查点与骨架里（`synopsis_covered_to`、`synopsis_unit_cursor`、`parseArcStructure`）。不声明 `synopsis_volume_deviations`、不改 `SynopsisUnitCheckpoint`，diff 最小；B 式作废、不进界面。

### D. `src/components/dialogs/ArchitectureConfirmDialog.tsx:280` — 读一个值（不新增 state）

在 `const unitMode = unitPreview?.unit ?? null` 下一行加：

```ts
  /** D7：本卷剩余单元的预计章数；`null` = 没有历史，走兜底文案（绝不回落到名义上界）。 */
  const chapterEstimate = unitPreview?.chapterEstimate ?? null
```

### E. 同文件 `:789-793` — 只改这一条预告文案（渲染条件 `:763` 不动）

把现有单个 `<p>` 的内层 `text(中文, 英文)` 换成：

```tsx
                        {text(
                          `本卷剩余 ${unitMode.volumeRemaining} 章，名义上界 ${unitMode.maxChapters} 章。`
                            + (chapterEstimate
                              ? `按当前实际倾向估计：本卷剩余单元约 ${chapterEstimate.volumeChapters} 章`
                                + `（据已写完 ${chapterEstimate.completedUnits} 个单元的实际章数折算）。`
                              : '按当前实际倾向估计：暂无历史折算（还没有写完的单元），无法估计。')
                            + '篇幅由剧情决定，写完按实际章数落盘。',
                          `${unitMode.volumeRemaining} chapters left in this volume, nominal cap ${unitMode.maxChapters}. `
                            + (chapterEstimate
                              ? `At the current pace, about ${chapterEstimate.volumeChapters} chapters remain for this volume `
                                + `(based on ${chapterEstimate.completedUnits} completed unit(s)). `
                              : 'No historical conversion yet (no completed unit), so no estimate is available. ')
                            + 'The unit ends when the plot ends and the actual count is recorded afterwards.',
                        )}
```

文案硬要求：两数**同屏、各带自己的标签**（`名义上界` / `按当前实际倾向估计`）；不得合并成「约 N–M 章」；兜底支不得出现任何数字。

## 3. 单测（判据 5，整文件跑）

文件：`src/services/workflows/__tests__/synopsis-unit-launch.test.ts`（沿用既有 `PLAN`＝60 章，卷1 两单元各 15、卷2 一单元 30；`doubles.checkpoint` 注入检查点）。

新增 3 支：

1. **无历史**：`doubles.checkpoint = { synopsis_covered_to: 10 }`（推导游标落在卷1单元1 ⇒ 已完成单元数 0）⇒ `chapterEstimate === null`，且 `unit` 仍是 `{ from: 11, unitIndex: 1, maxChapters: 10, volumeRemaining: 20 }`（既有断言原样保留，证明 `unit` 未加键、名义上界未变）。
2. **有历史**：`doubles.checkpoint = { synopsis_covered_to: 20, synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 2, writtenInVolume: 20 } }` ⇒ 已完成单元数 1（卷一单元一）、`perUnitChapters === 20`、`remainingUnits === 1` ⇒ `volumeChapters === 20`；同断言 `unit.maxChapters === 10`（名义上界未被估计值影响，且两数在此例中必然不等，不会撞判据 3 的「完全相同」）。
3. **纯函数边界**：`estimateRemainingVolumeChapters({ coveredTo: 0, completedUnits: 3, remainingUnits: 2 }) === null`；`completedUnits: 0` ⇒ `null`；`coveredTo: 5, completedUnits: 2, remainingUnits: 2` ⇒ `volumeChapters === 5`（5/2×2=5，ceil）；`coveredTo: 5, completedUnits: 3, remainingUnits: 2` ⇒ `volumeChapters === 4`（10/3=3.33 ⇒ ceil 4）。

跑法（必须贴整文件汇总行与末行 `EXIT=`）：

```bash
cd /c/develop/workspace/AI-writer/develop
node scripts/run-tests-electron.mjs src/services/workflows/__tests__/synopsis-unit-launch.test.ts; echo "EXIT=$?"
node scripts/check-fast.mjs; echo "EXIT=$?"
```

## 4. 边界与风险（评审用）

- **禁改面（任一碰了就停手报）**：`computeSynopsisUnitRange`（`architecture.command.ts:316`）、`arc-position.ts:960` 的 prompt 精度、`architecture.command.ts` 批次上界推导、`synopsis_volume_deviations` 写入逻辑、D6 常量、D12 注入区。
- **最大自伤点**：估计值不得塞进 `ArchitectureUnitRange`。`src/components/editor/__tests__/planning-launch-entrypoints.browser.tsx:159` 有逐字节子串断言 `"synopsisUnit":{"from":1,"unitIndex":1,"maxChapters":10,"volumeRemaining":20}`，加键必红；`electron/services/main-generation-owner.ts:450`、`main-generation-plan.ts:132` 也会读 `unit`。本包用独立字段 `chapterEstimate` 规避。
- **估计值只读**：不得被任何 `if`/闸门/校验读取；不得写入检查点或 DB。
- **取整**：`Math.ceil`（与现有预告同规则），不要用 `Math.round`；下限 1。
- **`volume === null`**（骨架解析不出）时 `remainingUnits` 传 0 ⇒ 返回 `null` ⇒ 兜底文案；此时 `unit` 本身也几乎不可能算出，属防御分支。
- **已完成单元数的口径**：卷序号之前的每卷按**计划单元数**全算完成，当前卷算 `unitIndex − 1`；实际偏差只体现在平均章数上，不再二次修正（负责人口径）。
- **R4 模板冲突（已由负责人卡面 v2 处置）**：卡面 §8 已改为改码卡口径——`git diff --name-only <base>..card/s3-d7-unit-chapter-estimate -- src electron scripts` 每一行都落 §3 白名单（不要求为空），`--name-status` 不得出现 `A` 行（白名单内取证脚本除外，须逐条列路径并在判词标注）。本包 §6 的 `git add` 点名三路径与之对齐。

## 5. 判据 → 取证映射（交付时逐条贴）

| 判据 | 用什么证明 | 谁做 |
|---|---|---|
| 1 同屏两数、标签可辨 | 实机对话框原文（`innerText` 摘录，含「名义上界」「按当前实际倾向估计」） | developer（apply 后，develop 实机） |
| 2 有历史可复算 | 贴检查点读数 + 算式代入（例：`coveredTo=20`，已完成单元数 `1`，本卷剩余单元数 `1` ⇒ `20÷1×1=20` ⇒ `ceil=20`；同屏名义上界 `10`） | 实施方给算式，developer 用同一读数在实机复算 |
| 3 无历史兜底且无伪估计 | 构造 `coveredTo=0` 或未完成任何单元的项目，贴界面原文（无数字），并给出 `N` 值证明 `M` 未复用 | developer |
| 4 名义上界逐位一致 | 改前 `10` / 改后 `10`（同一检查点、同一骨架，取 `unit.maxChapters` 与界面原文） | developer |
| 5 单测两支 + 整文件汇总 + check:fast | 上面两条命令的末尾汇总行与 `EXIT=` | 实施方（apply 前，允许在 wt 内跑文件级）＋ developer 复核 |

## 6. 交付与回执

- 分支：`card/s3-d7-unit-chapter-estimate`（从 `<待填：远端头>`，即主身 push D4 合并后的 `origin/exp/resource-ledger`）；`git add` 点名三个路径，禁 `-A`。
- **开工前三项校验**（缺一项不许改码）：`git rev-parse --short HEAD` 须等于 base；`git status --porcelain -- src` 为空；`git diff --numstat <base>..HEAD -- src electron scripts` 为空。

## 7. 复算命令（判据 2／4 与 §0.5 数值用同一条）

```bash
cd /c/develop/workspace/AI-writer/develop
node -e '
const cases=[[20,1,1,10],[20,1,0,10],[10,0,1,10],[46,2,1,10],[5,3,2,10]];
for(const [covered,done,remain,cap] of cases){
  const remainOnly = done>0&&covered>0 ? {ceil:Math.max(1,Math.ceil(covered/done*remain)), floor:Math.max(1,Math.floor(covered/done*remain))} : null;
  const cardLiteral = done>0&&covered>0 ? Math.floor(covered/done*remain + covered) : null;
  console.log(`covered=${covered} done=${done} remain=${remain} → 剩余 ceil=${remainOnly&&remainOnly.ceil} floor=${remainOnly&&remainOnly.floor} / 卡面字面=${cardLiteral} / 名义上界=${cap}`);
}'
- 回执：`.batch/night/bridge/to-owner`；报告 `.batch/night/staging/s3-d7-unit-chapter-estimate-report.md`。
- 不 commit、不 push、不动 develop 主区（外派约束）；apply 由主身一次一张做。
