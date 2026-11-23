# FACT · 扩大 preflight 规则集 — 实施包（S2 第一步）

- 卡号：`bb3f0d83-3f24-43a9-977d-8ef6b4e8eb9b`（扩大 preflight 规则集，基础设施全齐 · 纯增量）
- 判定面（读码基准）：`7bffc1ee7cd1d13db02466bcfdbe12bd73625490`（分支 `exp/mainline-1119`，工作树 porcelain 0）
- 判据编号回读：本卡 prompt 五条（盘点 → 按先例实现 → 接线 → 正负向测试 → 面板不改）
- 归我判断不清的：规则取舍由项目总负责人裁定；本包给出「已选 3 条 / 已否 6 条」及理由，见 `candidates-and-rejects.md`

---

## §1 结论先行

**新增 3 条规则，全部挂在「关键事件 `attacks`」这一格上**（`blueprints.key_events[].attacks`）——这是全仓唯一一处**已有结构化输入、有明文契约、却零校验**的位置：

| # | 规则 id（stableFactKey 第二段） | 判据（结构对结构） | severity | sourceLayer |
|---|---|---|---|---|
| R1 | `slot:unregistered-slot-space` | `attacks.space` 逐字不在世界观第 4 维登记的空间名里 | warning | `blueprint` |
| R2 | `slot:slot-outside-window` | `attacks.hour` 不在该空间登记的 `hours=` 窗口内 | warning | `blueprint` |
| R3 | `slot:slot-attacked-twice` | 同一 `(space,hour)` 被**两个不同章**都声明为作废目标 | warning | `blueprint` |

依据（取证原文）：
- `src/shared/blueprint-key-events.ts:29`（`attacks?: BlueprintSlotAttack`）、`:32-41`（`kind:'slot'` + `space` + `hour`）、`:111-127`（`declaredAttack` 严格归一化：缺一即整条丢弃）
- 契约明文要求 `space` 必须逐字复制、`hour` 必须是被攻击那一格的钟点：`src/shared/blueprint-semantic-contract.ts:51`（英文原文）、`:63`（中文原文）
- 全仓无消费者：`grep -rn "\.attacks\|attacks\b" --include=*.ts src | grep -v __tests__` 命中只有 `blueprint-key-events.ts`（归一化）与 `arc-node.ts:236` 的一句注释引用，**没有任何判定**
- 输入现成：`db:blueprint-get` 返回的蓝图行由 `electron/repositories/blueprint-repository.ts:191` 走 `normalizeKeyEvents(row.key_events, { chapterNumber })` 归一化，`id` 重算、`attacks` 保留 → 两处 preflight 调用点（`ChapterCreationDialog.tsx:362-372`、`BatchChapterCreationDialog.tsx:219-230`）都拿得到

**没说「attacks 全错」**：R1/R2 只在世界观**至少登记过一个空间**时才判（沿用 `findSpaceTimeConflicts` 的 `rules.length === 0 ⇒ return []` 守卫），旧项目一条机读行都没有 ⇒ 主动不判、零误报。

---

## §2 改动点清单（白名单 5 个文件，无新增文件）

### 2.1 `src/shared/space-time-consistency.ts`（现在 348 行，全部新增追加在文件末尾）

**A. hash 前缀泛化（`:237-245`，行为必须逐字节不变）**

现状 `spaceTimeStableFactKey(parts)` 内部写死 `` `space:${hash}` ``。改法：

```ts
/** 共享 FNV-1a 64 实现；前缀由调用方给 —— 两族 finding 的键空间互不串扰。 */
function fnvStableFactKey(prefix: string, parts: readonly string[]): string {
  // 函数体原样搬运 spaceTimeStableFactKey 的现有实现（:238-244），只把模板串换成 `${prefix}:`
}

export function spaceTimeStableFactKey(parts: readonly string[]): string {
  return fnvStableFactKey('space', parts)
}

/** attacks 族独立前缀 `slot:` —— 与 `fact:` / `space:` 隔离（卡面纪律第 3 条）。 */
export function slotStableFactKey(parts: readonly string[]): string {
  return fnvStableFactKey('slot', parts)
}
```

**硬约束**：`spaceTimeStableFactKey` 的输出必须与改造前**逐字节相同**，否则库里现存的 `space:…` 豁免全部失效（`ConsistencyExemption.stableFactKey` 是精确匹配，`src/shared/consistency-preflight.ts:159`）。
取证做法：改造**前**先跑一次，把结果贴进测试当字面量：

```bash
node -e "const{spaceTimeStableFactKey}=require('./dist-electron/shared/space-time-consistency.js');console.log(spaceTimeStableFactKey(['unregistered-space','6','查无此店']))"
# 若上面路径不可用，用 vitest 临时用例打印：pnpm test src/shared/__tests__/space-time-consistency.test.ts 加一行 console.log
```

**B. 新判定函数（纯函数、无 IO、零语义解析）**

```ts
export interface SlotAttackValidationInput {
  chapterNumber: number
  /** 设定层原文（架构产出的 `project_core.worldbuilding`）。 */
  worldBuildingText: string | null | undefined
  /** 本章关键事件（已过 `normalizeKeyEvents`）。 */
  keyEvents: readonly BlueprintKeyEvent[]
}

/** 一条被声明的作废目标（已归一化）。 */
interface DeclaredSlotAttack { index: number; id: string; space: string; hour: string }

export function findSlotAttackConflicts(input: SlotAttackValidationInput): SpaceTimeFinding[]
```

判定顺序（写死，别改）：

1. `parseSpaceRules(input.worldBuildingText).length === 0` ⇒ **返回 `[]`**（旧项目零误报，与 `:269-270` 同纪律）
2. 逐条取 `keyEvents[i].attacks`，`kind !== 'slot'` 或缺 `space`/`hour` ⇒ 跳过（`declaredAttack` 已丢弃半残条目，这里双保险）
3. `rule = byName.get(space)`，取不到 ⇒ **R1 warning**；键 `slotStableFactKey(['unregistered-slot-space', String(chapterNumber), space])`
4. `rule.noWindow` ⇒ 跳过（作者声明该空间无时段概念，`hours=none`）
5. `rule.hours === undefined` ⇒ **跳过、不产 info**（按月/跨日窗口与「未声明」两种情况已有 `space:undecidable-time` 那条 info 负责解释，不重复报）
6. `parseTimeWindow(attack.hour)` 为 undefined ⇒ 跳过（`normalizedHour` 已保证 `HH:MM`，这是双保险）
7. `isWithinWindow(...)` 判两端，任一端在窗口外 ⇒ **R2 warning**；键 `slotStableFactKey(['slot-outside-window', String(chapterNumber), space, hour])`

**去重**：同一章内两条 attacks 指向同一空间（R1）或同一 `(空间,钟点)`（R2）时，按 `stableFactKey` 去重，只留第一条——否则同一条冲突会因豁免键相同而出现两份相同 finding。

**R1 文案（照抄，中英都对）**：
- issue.zhCN：``本章关键事件声明要作废空间「${space}」里的某一格，但世界观第 4 维【空间结构】里没有逐字登记这个名字。``
- suggestion.zhCN：``把该事件的 `attacks.space` 改成设定层登记过的写法，或在世界观第 4 维补登记「${space}」的机读行（`${space}｜hours=HH:MM-HH:MM｜entry=…`）。``
- evidence：``keyEvents[${index}].attacks.space = ${space}``

**R2 文案**：
- issue.zhCN：``本章把「${space}」的 ${hour} 这一格声明为作废目标，但世界观登记该空间的时段是 ${rule.hoursRaw}——这一格本身不在开放窗口里。``
- suggestion.zhCN：``若不是笔误，先核对两处：`attacks.hour` 是否写成了「动手的钟点」而不是「被作废那一格的钟点」；以及世界观 \`hours=\` 是否登记错了。``
- evidence：``keyEvents[${index}].attacks = ${space}｜${hour}｜hours=${rule.hoursRaw ?? ''}``

**C. 跨章重复声明（R3，同文件末尾）**

```ts
export interface DuplicateSlotAttackInput {
  blueprints: readonly { chapterNumber: number; keyEvents: readonly BlueprintKeyEvent[] }[]
}

export function findDuplicateSlotAttacks(input: DuplicateSlotAttackInput): SpaceTimeFinding[]
```

- 只在 `blueprints.length >= 2` 时有效；按 `(space, hour)` 聚合，收集**不同章号**集合
- 章号集合 size ≥ 2 ⇒ 一条 finding；`sourceChapter` 取**较大的章号**；键 `slotStableFactKey(['slot-attacked-twice', space, hour])`（**不含章号** —— 豁免一次即对该格永久生效，这是有意的：一次「我知悉」应覆盖后续所有重复）
- 输出按 `sourceChapter` 升序，稳定
- 文案：issue.zhCN ``同一格（「${space}」${hour}）被第 ${a} 章和第 ${b} 章都声明为作废目标。本规则只做字面对账：若中间没有任何一章**重新建立**过这一格，后一章的作废就没有东西可废。``；suggestion.zhCN ``改掉后一处 `attacks`，或在前文补一段重新建立该格的叙事；也可以在此豁免（表示作者已知悉）。``
- evidence：``attacks: 第 ${a} 章 / 第 ${b} 章 都声明作废 ${space}｜${hour}``

### 2.2 `src/shared/consistency-preflight.ts`（现在 244 行）

- `:3` import 追加：`findDuplicateSlotAttacks, findSlotAttackConflicts, type`（从 `./space-time-consistency` 取）
- 在 `findBlueprintSpaceTimeRisks`（`:146-172`）**之后、`mergeConsistencyFindingsIntoReview`（`:173`）之前**插入两个包装函数，形状与现有那条**逐行同构**（豁免过滤 → 只留 warning → 映射成 `ConsistencyFinding`）：

```ts
export function findBlueprintSlotAttackRisks(
  worldBuildingText: string | null | undefined,
  blueprint: Pick<BlueprintForPreflight, 'chapterNumber' | 'keyEvents'>,
  exemptions: readonly ConsistencyExemption[] = [],
): ConsistencyFinding[]

export function findDuplicateSlotAttackRisks(
  blueprints: readonly Pick<BlueprintForPreflight, 'chapterNumber' | 'keyEvents'>[],
  exemptions: readonly ConsistencyExemption[] = [],
): ConsistencyFinding[]
```

### 2.3 `src/services/consistency-preflight.ts`（现在 64 行）

- `:5-7` import 追加两个包装函数
- `:46` 起把返回值改成数组拼接（只动这一处结构）：

```ts
  const findings = [
    ...(await Promise.all(blueprints.map(async blueprint => { /* 原样不动，仅在 :48 之后追加一行 */ }))).flat(),
    ...findDuplicateSlotAttackRisks(blueprints, exemptions),
  ]
```

  单章循环里的 `return [...]`（`:44-56`，`findBlueprintSpaceTimeRisks` 在 :48）追加一行：`...findBlueprintSlotAttackRisks(worldBuildingText, blueprint, exemptions),`（放在 `findBlueprintSpaceTimeRisks` 那行之后、注释块之前）
- `:57-61` coverage **不动**

### 2.4 `src/shared/__tests__/space-time-consistency.test.ts`（现在 370 行，追加 describe）

四组用例，**每组都要有「必须判」与「必须不判」两向**：

| 组 | 正向（必须判） | 负向（必须不判） |
|---|---|---|
| R1 | 世界观登记 `老陈记`，attacks.space=`查无此店` ⇒ 1 条、键以 `slot:` 开头、`sourceLayer='blueprint'` | 世界观**一条机读行都没有** ⇒ `[]`；attacks.space=`老陈记`（已登记）⇒ `[]` |
| R2 | `老陈记｜hours=07:00-09:00`，attacks.hour=`21:00` ⇒ 1 条 | `hours=none` ⇒ `[]`；`hours=每月3日 21:00-22:00`（按月窗口）⇒ `[]`；attacks.hour 缺省/非法（`'9:00'`、`'25:00'`）⇒ 条目被 `declaredAttack` 丢弃 ⇒ `[]` |
| R3 | 第 3 章与第 7 章都 attacks 同一格 ⇒ 1 条、`sourceChapter=7`、键**不含章号** | 只有一章 ⇒ `[]`；同一章内两条重复 ⇒ `[]`（R3 只跨章）；`blueprints` 传 1 个 ⇒ `[]` |
| 键隔离 | `slotStableFactKey(['a'])` 与 `spaceTimeStableFactKey(['a'])` 不同，且分别以 `slot:` / `space:` 开头 | — |
| hash 回归 | `spaceTimeStableFactKey(['unregistered-space','6','查无此店'])` 等于**改造前采集到的字面量**（改造前先打印并存进测试） | — |

### 2.5 `src/shared/__tests__/consistency-preflight-space-time.test.ts`（追加，只测「接线三件事」）

- 豁免生效：`exemptions=[{stableFactKey: 那条 R1 的键, reason:'作者知悉', revoked:false}]` ⇒ 0 条
- `revoked:true` 的豁免 ⇒ 仍报
- `worldBuildingText` 传 `undefined` ⇒ R1/R2 fail-open 0 条，但 **R3 仍判**（R3 不依赖设定层；这是有意的，写进用例名）
- `info` 级不进 `ConsistencyFinding[]`：R2 的「不可判定」按 §2.1-5 **不产 finding**（连 info 都不产），用例断言 `[]` 即可

---

## §3 不该动的部分（越界即打回）

1. `findSpaceTimeConflicts`（`space-time-consistency.ts:267-348`）的判定顺序、`info` 三态文案、`space:` 键算法 —— **一个字都不改**
2. `parseSpaceRules`（`:161-199`，含 200 字上限与「后一条覆盖前一条」）、`parseSpaceHours`、`normalizeSpaceRefs`、`normalizeBlueprintSpaceRefs`
3. `normalizeKeyEvents` / `declaredAttack`（`blueprint-key-events.ts:111-127`）—— 归一化放宽会把「半残 attacks」变成可判定输入，是另一张卡
4. `ConsistencyPreflightCoverage` 与 `describeSpaceTimeCoverage`（`:197-244`）、`ChapterCreationDialog.tsx` / `BatchChapterCreationDialog.tsx` 两个调用点（**一行都不改**）
5. 提示词 / `builtin-prompt-templates.ts` / `blueprint-semantic-contract.ts`（契约文案已经写了要求，缺的是判定）
6. 豁免面板、`db:consistency-exemption-*` IPC、迁移与列

---

## §4 风险表

| 风险 | 触发条件 | 处置 |
|---|---|---|
| **`space:` 键漂移 ⇒ 存量豁免全失效** | §2.1-A 重构写错模板串/大小写 | 强制 hash 回归用例（改造前采字面量）；判据 2 |
| 假阴性：按月窗口 | 世界观写 `hours=每月3日…` | R2 显式跳过，不猜月历（与 `:303-306` 同口径）；已披露，不修 |
| 假阳性：R3 把「重建后再作废」判成重复 | 作者前文重新建立了该格 | 文案只做字面对账 + 面板可豁免；若实测噪声大，降级为 info 或加 `attacks.rebuild?: true` 由另一卡做 |
| 双路径不对称 | 单章对话框**不传** `structuredRefs`（`ChapterCreationDialog.tsx:362-372`），但传了 `keyEvents` | 本卡三条规则都只看 `keyEvents`，两条路径行为一致；`structuredRefs` 不对称是既有现状，**不在本卡修**（另立卡，见 `candidates-and-rejects.md` §C） |
| coverage 静默 | 设定层 0 条机读行时 R1/R2 不判，`registeredSpaces:0` 已由现有文案交代 | 不改；R3 无 coverage 计数属已知缺口，写进 evidence 的 knownGaps |

---

## §5 验证命令（原文，外部 agent 与 QA 共用）

```bash
# 1) 单测（整文件汇总行才算证据，禁 -t 过滤）
pnpm test src/shared/__tests__/space-time-consistency.test.ts src/shared/__tests__/consistency-preflight-space-time.test.ts

# 2) 关卡（typecheck + 文档检查）
pnpm check:fast

# 3) 纯函数证明：新增导出模块内不得出现 IO
grep -n "ipc\|fs\|node:" src/shared/space-time-consistency.ts

# 4) 白名单证明
git diff --stat
git status --porcelain
```

预期末行：`Tests <N> passed (<N>)`；`EXIT=0`；#3 零命中；#4 恰好 5 个文件。
