# 执行计划 · P20-1a 能力候选（世界观第 1 维等级表 → 候选 → 作者采纳）

> 状态：**待执行**（2026-10-26）· 交付 hy4 无人值守实施 · 成果由主 agent 次日验收
>
> 执行者：hy4（无人值守） · 验收者：主 agent · 仓库：`C:/develop/workspace/AI-writer/develop`
> 分支必须是 `exp/resource-ledger`，HEAD 起点 `ab0bf97c`。
> 本文是唯一规格。**凡本文没写的行为，一律不做；凡本文写死的，不得自由发挥。**

---

## 0. 工时账与硬停点（先看这一节）

| 段 | 内容 | 估算 | 何时开始 |
|---|---|---|---|
| **T1** | 解析器 `src/shared` + 单测 + 台账同步 + 三段验证 | 80–100 min | 立刻 |
| **T2** | 面板接线（Editor 壳 + 候选区 + 4 例浏览器测试） | 70–90 min | **T1 全部验收通过后** |

- 合计 150–190 min，**客观超过两小时**。所以：
  - **T1 完成即是一个完整可交付状态**（可单独提交、可单独验收）。
  - **硬停点**：累计 100 分钟仍未跑通 T1 的三段验证 ⇒ 立刻停手，只提交已完成部分，并在报告写明卡在哪一步、报错原文是什么。
  - **T2 不得在 T1 有未修红的情况下开始。**
- 禁止为了赶时间牺牲 T1 的测试覆盖；T2 做不完可以不做，写进报告即可。

---

## 1. 背景（读这三份就够，不要读别的设计稿）

| 文档 | 读它干什么 |
|---|---|
| `docs/design/architecture/p1-1-worldbuilding-extraction-assessment.md` §5 | 为什么是「抽取 → 候选 → 逐条采纳」，不是抽取即写库 |
| `docs/plans/prompt-assembly-backlog.md` §「2026-10-26 四格写入通道」的 **P20-1** 小节 | 施工范围与验收口径 |
| `src/shared/worldbuilding-resource-extract.ts` | **必须照抄形状的既有先例**（类型命名、`dropped` 语义、fail-open、引文校验） |

四条底线（违反即判不合格）：
1. 候选**不写库、不进 prompt**；只有作者勾选后才走 `db:abilities-upsert`。
2. **零模型调用**：本期是确定性解析，不许出现任何 LLM/prompt 相关代码。
3. 环境里**不许出现第二套规则**：维度定位复用 `locateWorldBuildingSections`，不许自己写第十一个「第 1 维」正则。
4. 抽不到就空，**不许补占位行、不许编内容、不许截断字段**。

---

## 2. T1 · 解析器

### 2.1 新建 `src/shared/worldbuilding-ability-extract.ts`

导出**只有**以下 6 个符号，名字逐字照抄（多导出一个都算偏离）：

```ts
export interface AbilityCandidate {
  /** 等级名（表格首列，已去 markdown 装饰）。 */
  name: string
  /** 卡点（表格第 3 列）；列数不为 4 时为空串。 */
  hardLimit: string
  /** 升级代价（表格末列）。 */
  costNote: string
  /** 表格行原文（trim 后，未 flatten）——必须能在世界观原文里逐字命中。 */
  evidence: string
  /** 恒为 'worldbuilding'。 */
  evidenceScope: 'worldbuilding'
}

export interface AbilityCandidateSet {
  candidates: AbilityCandidate[]
  /** 是否识别到第 1 维标题。false ⇒ 多半是覆盖版模板改了标题文字。 */
  dimensionFound: boolean
  /** 被丢弃的条数（字段超长 / 引文未命中 / 重名 / 超上限）。 */
  dropped: number
}

/** 一次最多给多少条候选。**不要**复用 ABILITY_MAX_ITEMS(5)——那是正文注入上限，不是候选上限。 */
export const MAX_ABILITY_CANDIDATES = 12

export function extractAbilityCandidates(
  worldbuilding: string | null | undefined,
): AbilityCandidateSet

/** 候选 → 写入入参。采纳时面板必须走它，不许在组件里手拼对象。 */
export function abilityCandidateToInput(candidate: AbilityCandidate): PowerAbilityInput
```

文件头注释必须写明三件事：① 这是 P20-1a，零模型确定性解析；② 候选不写库、不进 prompt；③ 第 2 列「相邻差距」故意不抽，只靠 `evidence` 保留（作者裁定 2026-10-26）。

依赖只许 `import`：`./worldbuilding-completeness` 的 `locateWorldBuildingSections`、`./power-ability` 的 `ABILITY_TEXT_MAX` / `ABILITY_EVIDENCE_MAX` / `PowerAbilityInput`。**不许改这两个文件。**

### 2.2 解析顺序（严格按 1→17 执行，顺序本身是规格）

| # | 判定 | 动作 |
|---|---|---|
| 1 | `!worldbuilding?.trim()` | 返回 `{ candidates: [], dimensionFound: false, dropped: 0 }` |
| 2 | `locateWorldBuildingSections(text)` 里找 `dimension === 1` 的 section | 找不到 ⇒ `dimensionFound: false`，返回空集 |
| 3 | 找到 ⇒ `dimensionFound: true`，按下标遍历该 section 的 `body`（需要看下一行，**用索引 for 循环，不要 for-of**） | |
| 4 | `line = raw.trim()`；不满足「以 `|` 开头且以 `|` 结尾」 | 继续下一行（表头/分隔行也满足，别在这里拦） |
| 5 | `cells = line.slice(1, -1).split('|').map(c => c.trim())`（与 `worldbuilding-rules.ts:157` 同口径） | |
| 6 | **下一行匹配分隔行** `/^\|(\s*:?-{1,}:?\s*\|)+$/u` ⇒ 当前行是表头 | 继续下一行 |
| 7 | 当前行自身匹配上面那条分隔行正则 | 继续下一行 |
| 8 | `cells.length !== 4` | 继续下一行，**不计 dropped**（价格表、多列表不属于等级表形状） |
| 9 | `name = squash(cells[0])`；`squash` = 去掉 `*` `_` `` ` `` `>` 与首尾空白、内部连续空白压成 1 个空格 | `name` 为空 ⇒ 继续，**不计 dropped** |
| 10 | `hardLimit = squash(cells[2])`；`costNote = squash(cells[3])` | |
| 11 | `name` / `hardLimit` / `costNote` 任一长度 > `ABILITY_TEXT_MAX`(200) | `dropped += 1`，丢弃该条，**不许截断**（截断=改写原文） |
| 12 | `evidence = line`（原行，未 squash）；长度 > `ABILITY_EVIDENCE_MAX`(1000) | `dropped += 1`，丢弃 |
| 13 | `!text.includes(evidence)` | `dropped += 1`，丢弃（引文必须逐字命中原文） |
| 14 | `name` 已出现过 | `dropped += 1`，丢弃（保留首次） |
| 15 | `candidates.length >= MAX_ABILITY_CANDIDATES` | `dropped += 1`，丢弃（与先例 `worldbuilding-resource-extract.ts:174-177` 同口径：超上限也要计入 dropped，否则「丢了 N 条」会说谎） |
| 16 | 全部通过 | push `{ name, hardLimit, costNote, evidence, evidenceScope: 'worldbuilding' }` |
| 17 | 遍历结束 | **保持原文行序返回，禁止任何排序** |

第 17 条是与资源先例的**唯一有意偏差**：`filterResourceCandidates` 用 `localeCompare('zh-CN')` 排序，等级表不能排 —— 行序就是阶梯顺序，排完「练气 → 筑基 → 金丹」会变成字典序。这一点要写进代码注释。

### 2.3 `abilityCandidateToInput` 映射（逐字）

```ts
{
  name: candidate.name,
  hardLimit: candidate.hardLimit,
  costNote: candidate.costNote,
  evidence: candidate.evidence,
  evidenceScope: 'worldbuilding',
  stageChapter: null,   // 世界观没有章号 ⇒ undated，渲染成「作者登记，未标章号」
  form: '',
  weakness: '',
  stageNote: '',
}
```
**不得**出现 `source` 字段 —— 仓储把它硬编码成 `'author'`（`electron/repositories/power-ability-repository.ts:135`），前端传不进去也不该传。

### 2.4 新建 `src/shared/__tests__/worldbuilding-ability-extract.test.ts`

写法照抄 `src/shared/__tests__/worldbuilding-resource-extract.test.ts`：`import { describe, expect, it } from 'vitest'`、中文 `describe`/`it`、顶层 fixture 常量、无 mock、无 `beforeEach`。

fixture 必须是一段**带完整五维标题**的世界观片段（至少要 `### 1.【核心规则与体系漏洞】` 这一行 + 一张四列表 + 末尾 `### 2.【阶层断层与资源战场】` 作为区段边界）。

**必须覆盖这 14 条**（每条一个 `it`，可合并同类但不得少于 14 个断言点）：

1. `null` / `undefined` / `''` / `'   '` ⇒ 空候选 + `dimensionFound === false`
2. 一段没有五维标题的自由文本 ⇒ `dimensionFound === false`
3. 标准四列表 3 行 ⇒ 3 条候选，四个字段逐字对齐（含 `evidence` 含两侧 `|`）
4. 首列**没有**粗体（`| 练气一层 | … |`）也接受
5. 表头行不被当成数据（断言候选里没有 `name === '等级名'`）
6. 分隔行 `| --- | --- | --- | --- |` 不被当成数据
7. 纯三列表（价格表）⇒ 候选 0 条、`dropped === 0`
8. 三列表在前 + 四列表在后（同一维）⇒ 只抽四列表那几行
9. 同表出现两次同名 ⇒ 只留首次，`dropped === 1`
10. 某行 `costNote` 超 200 字 ⇒ 该条丢弃、`dropped === 1`、其余行保留（断言**没有** `…` 截断痕迹）
11. 造 14 行合法数据 ⇒ `candidates.length === 12`、`dropped === 2`
12. 行序断言：候选 `name` 序列**等于表格行序**，且不等于字典序（用一组刻意逆字典序的等级名）
13. 第 1 维存在但只有散文、没有表格 ⇒ `candidates: []` 且 `dimensionFound === true`
14. `abilityCandidateToInput`：`evidenceScope === 'worldbuilding'`、`stageChapter === null`、`form/weakness/stageNote` 为空串、**结果对象里没有 `source` 键**（用 `'source' in result` 断言为 false）

### 2.5 台账同步（T1 结束前必须做）

改 `docs/plans/prompt-assembly-backlog.md` 的 **P20-1 小节**，只做两件事：
1. 小标题改成 `### P20-1. 能力候选抽取（期 1 · **1a 已落地 2026-10-26**）`；
2. 在「做法」那两段之后追加一行：

```
> **1a 落地**（2026-10-26）：`src/shared/worldbuilding-ability-extract.ts` + 14 例单测。
> 零模型、零 schema、零 prompt、零 IPC；候选现算于面板，不落 `partial_arch.json`。
> 采纳走既有 `db:abilities-upsert`，`source` 仍由仓储写 `'author'`（确定性解析不是「模型提议」）。
> 第 2 列「相邻差距」不抽，只随 `evidence` 全行保留。
```

**不许**新建 `docs/design/` 下的任何文件，**不许**动 `docs/README.md`。

### 2.6 T1 验收（三条全绿才算过）

```powershell
node scripts/run-tests-electron.mjs src/shared/__tests__/worldbuilding-ability-extract.test.ts
node scripts/run-tests-electron.mjs src/shared/__tests__/worldbuilding-rules.test.ts
npx tsc --noEmit
```
- 第一条：新文件全绿。
- 第二条：**必须一起跑**（同目录、共享 `worldbuilding-completeness`，防改坏既有抽取）。
- `tsc`：`noUnusedLocals` / `noUnusedParameters` 是开着的，未使用变量会直接报错，别留。

---

## 3. T2 · 面板接线（T1 三段验证全绿后才开始）

### 3.1 改 `src/components/editor/AbilityRegistryEditor.tsx`

照抄 `src/components/editor/ResourceRegistryEditor.tsx:36-93` 的读取模式，但**只要两样输入**（不要 `fs:read-json`）：

- `db:project-core-get` → `core?.worldbuilding` → `setWorldbuilding`
- 监听 `globalEventBus.on('ARCH_FILE_UPDATED')` 与 `on('WORKFLOW_COMPLETE')` 重读
- 用 `LatestRequestGate` 防迟到结果（照抄资源页）
- `<AbilityRegistryPanel projectKey={projectKey} worldbuilding={worldbuilding} />`

### 3.2 改 `src/components/editor/AbilityRegistryPanel.tsx`

新增 props `worldbuilding: string`。在现有按钮行（`AbilityRegistryPanel.tsx:275-284`）之后、`{loadError && …}`（`:286`）之前插入候选区。

**候选区结构（data-testid 逐字照抄，测试要按它选）**：

| 元素 | 属性 |
|---|---|
| 容器 | `data-testid="ability-candidate-zone"` |
| 每行 | `data-testid="ability-candidate-row"` |
| 勾选框 | `data-field="candidate-select"`（`type="checkbox"`） |
| 等级名 | `data-field="candidate-name"` |
| 卡点 | `data-field="candidate-hard-limit"` |
| 升级代价 | `data-field="candidate-cost"` |
| 引文 | `data-testid="candidate-evidence"`（放在 `title` 属性里显示全文，正文 `truncate`） |
| 采纳按钮 | 文本为 `采纳所选（N）` / `Adopt selected (N)` |

**行为规格**：

1. `const set = useMemo(() => extractAbilityCandidates(worldbuilding), [worldbuilding])`
2. 已登记同名集合：`new Set(rows.filter(r => !r.removing).map(r => r.name.trim()).filter(Boolean))`；命中 ⇒ 该行勾选框 `disabled`，行尾显示「已登记：改上面那一行」（`text('已登记：改上面那一行', 'Already registered: change the row above')`）。
3. 采纳：逐条 `ipc.invokeWithProjectSession(projectSession, 'db:abilities-upsert', abilityCandidateToInput(candidate), projectSession.projectPath)`；成功计数，失败用**现有** `writeErrorLabel(result.error, text)` 显示（它会处理 `ABILITY_NAME_DUPLICATED`）。
4. 采纳结束后：清空勾选集合，`void load()`（与现有 `save()` 第 270 行同口径，保证「已登记同名」立刻生效）。
5. 候选区是**纯展示 + 勾选**：**不做行内编辑**。要改字段，采纳后到下方表格里改（这是有意的范围收窄，写进代码注释）。
6. `dropped > 0` 时在区底部加一行小字：`已丢弃 N 条（重名 / 字段超长 / 超出上限）`。

**三档空态文案（逐字，不得合并）**：

| 条件 | 文案 |
|---|---|
| `!worldbuilding.trim()` | `还没有世界观内容，先生成或填写世界观再回来抽取。` |
| `dimensionFound === false` | `没识别到第 1 维【核心规则与体系漏洞】标题，无法抽取（若用了覆盖版模板，请确认标题文字未被改动）。` |
| `dimensionFound && candidates.length === 0` | `世界观第 1 维里没找到四列等级表（等级名｜相邻差距｜卡点｜升级代价）。` |

有候选时，区标题为：`从世界观第 1 维的等级表抽出的候选（勾选后才会登记）`。

### 3.3 改 `src/components/editor/__tests__/AbilityRegistryPanel.browser.tsx`

保留现有 7 例**一字不动**，新增 4 例（说明段注释里把「7 条」改成「11 条」并补一行验收口径）：

1. 传入含四列等级表的世界观 ⇒ 候选区渲染 3 行，`candidate-name` 值等于等级名。
2. 勾选一行 + 点「采纳所选（1）」⇒ `invoke` 被以 `'db:abilities-upsert'` 调用；入参断言 `evidenceScope === 'worldbuilding'`、`stageChapter === null`、`'source' in payload === false`。
3. 已登记同名（`stored` 里放一条同名 `definition()`）⇒ 该行 `candidate-select` 为 `disabled`。
4. 世界观里没有表格 ⇒ 渲染空态文案（用 `dimensionFound && 0 条` 那一档）。

### 3.4 T2 验收（四条全绿）

```powershell
npx vitest run --config vitest.browser.config.ts src/components/editor/__tests__/AbilityRegistryPanel.browser.tsx
npx tsc --noEmit
node scripts/check-doc-links.mjs
node scripts/check-doc-placement.mjs
```
- 浏览器测试走**单独一套配置**，`run-tests-electron.mjs` 找不到它们（这是既有坑，别浪费时间排查）。
- `check-doc-placement` 只允许「新增 0」（基线 33 条是既有的，不许去修，也不许新增）。

---

## 4. 禁区（这 10 条任一违反即判不合格）

1. 不改 `src/shared/power-ability.ts`、`electron/repositories/power-ability-repository.ts`、`src/shared/ipc-channels.ts`、`electron/controllers/db-controller.ts`、`electron/migrations/**`。
2. 不改任何 prompt 模板（`builtin-prompt-templates.ts`、`prompt-language.ts`），不碰 `docs/design/prompt/**`。
3. 不改 `src/shared/worldbuilding-rules.ts`、`src/shared/worldbuilding-completeness.ts`（只允许 `import`）。
4. 不新增 IPC 通道；不新增迁移；不建表。
5. 不调用任何模型（本期零 LLM）。
6. 不写 `partial_arch.json`；候选只在渲染层现算。
7. 不对候选排序、不截断字段、不补占位行、不把「抽不到」写成「没有限制」。
8. 不新建 `docs/design/` 文件、不动 `docs/README.md`、不动 `docs/adr/`。
9. 不动 `docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`（禁动区）。
10. 不 `push`、不切分支、不 `git rebase`、不用 `--no-verify`。

---

## 5. 交付形态

### 5.1 提交
- 允许**一次本地 commit**（T1 完成后一次、T2 完成后一次，最多两次），**禁止 push**。
- 消息：`feat(abilities): 世界观第1维等级表 → 能力候选（P20-1a）`
- 正文列 3 行：新增文件、面板改动、验证结果（每条命令一行）。
- 提交前必须通过 §2.6（T1）/ §3.4（T2）的全部命令。

### 5.2 报告（明天验收直接看这份）
按下面标题输出，**不许省略「与计划不符」那一节**：

```
## 交付
- commit: <sha1>  /  <sha2 或「无」>
- T1 完成：是/否    T2 完成：是/否
- 新增文件：<逐条>
- 修改文件：<逐条，一行一句改了什么>

## 验证输出（原样粘贴，不要总结）
- 新测试：<N 个文件 / M 个用例 通过>
- 既有 worldbuilding-rules：<通过/失败>
- 浏览器测试：<通过/失败>
- tsc：<干净 / 报错原文>
- doc-links：<broken 0 / 其他>
- doc-placement：<新增 0 / 其他>

## 与计划不符处
<逐条写「计划说 X，我做了 Y，因为 Z」。没有就写「无」。>

## 未做 / 受阻
<逐条。T2 没做要写明「T1 验收未在 100 分钟内跑通」或「时间不足」。>

## 需要作者裁定
<见第 6 节；若实现中发现新歧义，追加在这里，不要自己拍板。>
```

---

## 6. 已知的两条判断（写进报告即可，不阻塞）

1. **`source` 保持仓储硬编码的 `'author'`**。理由：1a 是确定性解析，产物是作者自己写在世界观里的表格行，零模型参与，不属于「模型提议」⇒ 标 `derived` 反而是错的语义。若将来要标 `derived`，需改 `PowerAbilityInput` + 仓储 + IPC 契约，另立一项。
2. **第 2 列「相邻差距」不抽**（作者 2026-10-26 已裁定）。它只随 `evidence` 全行保留，采纳后的条目里没有独立字段承载 —— 若将来正文需要用这条信息，需要先决定放哪一列，不在本期。

---

## 7. 开工前 30 秒自检

```powershell
git rev-parse --abbrev-ref HEAD   # 必须是 exp/resource-ledger
git status --short                # 必须是空
```
不是空 ⇒ **停手报错**，不要 `git stash`、不要 `git checkout --`。
