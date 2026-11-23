# AC1/S1 层内一致性 · 实施包（读于 `90c49657`）

> 判定面：`git rev-parse HEAD` = `90c49657bac698fa532af1e8d7b36859478be96f`（= ls-remote），`git status --porcelain` 0 行。
> 出包人：developer（Architecture/IT Advisor）。**本包不含生产码改动**；apply 由外派执行，或经 admin 授权由我按本包落码。

## 0. 三条口径（已定，不得再改，改了先回 admin）

| 项 | 取值 | 出处 |
|---|---|---|
| 校验对象 | 快照里的 `status`（主进程 `deriveRosterStatus()` 算出） | 设计稿 `:199`、主人裁定 1、项目总负责人边界 1／2 |
| 取状态方式 | **经既有 IPC** `db:character-roster-read`（`src/shared/ipc-channels.ts:1105`） | 设计稿 `:200-201`、QA 判位声明 |
| 禁止 | 在 `src/shared` 里重算 `hashText`／`fullFactHash`／`projection_hash` 三哈希 | `:201`「二选一，禁止两处各判一遍」 |

## 1. 现状事实（源码，已核）

- `deriveRosterStatus()` 在 `electron/repositories/character-roster-repository.ts:817-846`，**未 export**，`src/` 不可见（`grep -rn "deriveRosterStatus" src/` 零命中）。
- 四种状态：`empty`／`ready`／`legacy_repair_required`／`inconsistent`（`src/shared/character-roster.ts:31-35`）。
- **`inconsistent` 有四个发射点（`deriveRosterStatus` 体 `:817-846`）**，不止「三哈希」那一条：
  - `:827` `migration_state==='empty'` 但仍有残留（卡／旧 markdown／`characters_arch` 任一非空）；
  - `:831` `migration_state==='legacy_cards_preserved'`（旧项目有卡、图谱未重建）；
  - `:835` `migration_state==='legacy_markdown_pending'` 但 `entries` 非空（有卡又有待修旧 markdown）；
  - `:843` `ready` 分支三哈希任一不等：`meta.projection_hash !== hashText(renderedMarkdown)`／`meta.fact_hash !== fullFactHash(entries)`／`currentProjection !== renderedMarkdown`。
  ⇒ finding 文案**不得**只说「三哈希不一致」，否则 legacy 三种情况按它去「提交一次」未必解得掉。
- 快照类型 `CharacterRosterSnapshot`（`src/shared/character-roster.ts:99-130`）已带 `status`（`:105`）与 `factHash`（`:116`）；`factHash` 在身份 schema 项目是**实时事实**派生（`character-roster-repository.ts:916`），旧项目是持久化姓名版本 —— 两种都随事实变化，适合进 stableFactKey。（`:918` 起是 `assertReadBack`，别再引错。）
- 预检入口 `readConsistencyPreflight(session, blueprints)`（`src/services/consistency-preflight.ts:25-70`）在渲染层，已用 `ipc.invokeWithProjectSession` 读两处 DB；`findings` 数组在 `:43-62`。
- `ConsistencyFinding`（`src/shared/consistency-preflight.ts:14-29`）：`severity` 只有 `'warning'`，`sourceChapter: number` **必填**（`:17`），`sourceLayer?` 可选（`:28`）。面板按章渲染「来源：第 N 章」（`src/components/dialogs/ConsistencyPreflightPanel.tsx:39`），`sourceLayer` 二元硬编码（`:42-43`）。

## 2. 新文件 `src/shared/character-roster-consistency.ts`

```ts
import type { CharacterRosterSnapshot, CharacterRosterStatus } from './character-roster'
import type { ConsistencyExemption, ConsistencyFinding } from './consistency-preflight'

/**
 * AC1/S1（设计稿 §5 S1.1 裁定后形态）：角色**投影状态**的层内自洽。
 *
 * 校验对象是 `db:character-roster-read` 快照里的 `status`——它由主进程
 * `deriveRosterStatus()`（electron/repositories/character-roster-repository.ts:817）
 * 在读取时按「持久化三哈希 vs 实时事实」算出；渲染层不重算任何哈希
 * （设计稿 `:201`「二选一，禁止两处各判一遍」）。
 *
 * 不做「散文 vs 表」双向对比：`characters_arch` 是派生投影、不是真相源
 * （`:199`，主人 2026-11-23 裁定 1）。
 */
export const CHARACTER_ROSTER_DRIFT_KEY_PREFIX = 'roster:projection-drift:'

export function characterRosterDriftStableFactKey(factHash: string): string {
  return `${CHARACTER_ROSTER_DRIFT_KEY_PREFIX}${factHash.trim()}`
}

export interface CharacterRosterPreflightScope {
  /**
   * 当次审核的章节号。名册状态是**项目级**事实，但 `ConsistencyFinding.sourceChapter`
   * 必填、面板按章渲染（本卡不改面板），故借它落到现有报告；
   * stableFactKey **不含**章号，所以一次豁免对全书生效。
   */
  chapterNumber: number
}

export function findCharacterRosterRisks(
  snapshot: Pick<CharacterRosterSnapshot, 'status' | 'factHash'> | null | undefined,
  scope: CharacterRosterPreflightScope,
  exemptions: readonly ConsistencyExemption[] = [],
): ConsistencyFinding[] {
  // fail-open：读不到快照、缺 status、缺 factHash、没有可挂靠的章号 —— 一律不判。
  if (!snapshot) return []
  const status: CharacterRosterStatus | undefined = snapshot.status
  if (status !== 'inconsistent') return []
  const factHash = typeof snapshot.factHash === 'string' ? snapshot.factHash.trim() : ''
  if (!factHash) return []
  if (!Number.isInteger(scope.chapterNumber) || scope.chapterNumber <= 0) return []

  const stableFactKey = characterRosterDriftStableFactKey(factHash)
  const activeExemptions = new Set(
    exemptions.filter(exemption => !exemption.revoked).map(exemption => exemption.stableFactKey),
  )
  if (activeExemptions.has(stableFactKey)) return []

  return [{
    stableFactKey,
    severity: 'warning' as const,
    sourceChapter: scope.chapterNumber,
    evidence: `角色名册投影状态=inconsistent（factHash ${factHash.slice(0, 8)}…）：名册投影与表内角色事实不一致——可能是三哈希不符，也可能是迁移态（旧角色卡／旧 Markdown）尚未收尾。`,
    issue: {
      zhCN: '角色名册的派生投影与表内角色事实不一致：改过角色卡、结构化关系或动态状态后投影没有刷新，或旧项目的名单迁移还没收尾，下游读到的是过时的人物群像。',
      enUS: 'The derived character roster projection is out of sync with the character facts in the table: either the projection was not refreshed after an edit, or a legacy roster migration is still unfinished.',
    },
    suggestion: {
      zhCN: '到「角色管理」核对名单：界面提示迁移未收尾的，先按提示修完迁移（旧角色卡保留／旧 Markdown 待重建两种情形处理方式不同）；迁移已就绪或没有提示的，提交一次名单，由提交重建投影与其哈希。',
      enUS: 'Open Character Management and review the roster: if the UI reports an unfinished legacy migration, finish it first (preserved cards and pending legacy Markdown are repaired differently); otherwise submit the roster once and the commit rebuilds the projection and its hashes.',
    },
  }]
}
```

**注意**：
- `severity` 必须写 `'warning' as const`（`ConsistencyFinding.severity` 是字面量类型）。
- **不要**加 `sourceLayer`：现有两值只管「世界观设定／本章蓝图」，名册投影两个都不是；硬塞会让面板显示「冲突源：本章蓝图 / 空间规则」误导作者。面板加第三值属 AC2/影响面，不在本卡。
- 不要引入任何 `io`／`import` 自 `electron/`。

## 3. 接线：`src/services/consistency-preflight.ts`（只加一条，不改调用链）

**3.1 import（在 `:8` 的 `from '../shared/consistency-preflight'` 之后新增一行）**

```ts
import { findCharacterRosterRisks } from '../shared/character-roster-consistency'
```

**3.2 读快照（插在 `worldBuildingText` 那段之后，即现 `:42` 与 `:43` 之间）**

```ts
  /**
   * AC1/S1：角色名册投影状态。走既有 IPC 取主进程算好的 `status`，渲染层不重算哈希
   * （设计稿 `:201`）。读取失败（含旧项目 `角色名单元数据未初始化`）⇒ fail-open 不判，
   * 与上面 `worldbuilding` 的 try/catch 同一纪律。
   */
  let rosterSnapshot: Parameters<typeof findCharacterRosterRisks>[0]
  try {
    rosterSnapshot = await ipc.invokeWithProjectSession(session, 'db:character-roster-read', session.projectPath)
  } catch { rosterSnapshot = undefined }
```

**3.3 拼进 findings（在 `:61` `...findDuplicateSlotAttackRisks(blueprints, exemptions),` 之后新增一行）**

```ts
    // AC1/S1：角色名册投影自洽。项目级事实一次只报一条，借当次审核的章号落到现有面板；
    // 无蓝图（blueprints 为空）时章号取 0，纯函数内部据此 fail-open 不判。
    ...findCharacterRosterRisks(
      rosterSnapshot, { chapterNumber: blueprints[0]?.chapterNumber ?? 0 }, exemptions,
    ),
```

**不许改**：`blueprints.map(...)` 内部（每章那三条规则）、`coverage` 计算、`ConsistencyPreflightResult` 形状、`mergeConsistencyFindingsIntoReview`、面板组件。

## 4. 测试 `src/shared/__tests__/character-roster-consistency.test.ts`

import `describe, expect, it` from `vitest`；import 两个函数 from `../character-roster-consistency`。

| # | 类型 | 输入 | 断言 |
|---|---|---|---|
| 1 | 正向 | `{status:'inconsistent', factHash:'abc123'}`，`{chapterNumber:7}` | 长度 1；`severity==='warning'`；`sourceChapter===7`；`stableFactKey==='roster:projection-drift:abc123'`；`sourceLayer` 为 `undefined` |
| 2 | 正向 | 同上 + 一条 `{stableFactKey:'roster:projection-drift:abc123', reason:'刻意', revoked:false}` 豁免 | `[]` |
| 3 | 负向 | 同上 + `revoked:true` 的豁免 | 长度 1（撤销的豁免不生效） |
| 4 | 负向 | `status:'ready'` | `[]` |
| 5 | 负向 | `status:'empty'` | `[]` |
| 6 | 负向 | `status:'legacy_repair_required'` | `[]` |
| 7 | 负向 | `null` / `undefined` | `[]` |
| 8 | 负向 | `{status:'inconsistent', factHash:''}` 与 `factHash: undefined` | `[]` |
| 9 | 负向 | `status:'inconsistent'` + `{chapterNumber:0}` / `{chapterNumber:-1}` | `[]` |
| 10 | 键稳定性 | 同 factHash、章号 3 与 9 | 两次 `stableFactKey` 全等且 `characterRosterDriftStableFactKey` 前后有 `trim` |

**变异靶（负向必须因此转红，逐个跑并把输出贴回执）**：
- M1：把 `if (status !== 'inconsistent') return []` 改成 `if (false) return []` ⇒ #4/#5/#6 必红。
- M2：删掉 `!Number.isInteger(...) || scope.chapterNumber <= 0` 守卫 ⇒ #9 必红。
- M3：删掉 `if (!factHash) return []` ⇒ #8 必红（会产出 `roster:projection-drift:`）。
- M4：删掉 `activeExemptions.has(...)` 判断 ⇒ #2 必红。
- M5：把 `factHash` 从键里去掉（固定 `roster:projection-drift`）⇒ #1 的键断言必红。
每次变异后 `git checkout -- <file>`（或改回）再跑下一发，**不许留变异体在工作树**。

## 5. 命令原文（在 develop 主工作树或卡分支执行；禁全量、禁 test:browser、禁切 ABI）

```bash
pnpm test src/shared/__tests__/character-roster-consistency.test.ts
pnpm test src/shared/__tests__/consistency-preflight.test.ts src/shared/__tests__/consistency-preflight-space-time.test.ts
pnpm check:fast        # typecheck + 文档检查
```

回执必须贴：收尾汇总行 `Tests N passed (N)`（整文件汇总，不接受 `-t` 过滤）、`check:fast` 的 `[check:fast] 全部通过。` 与 `CF_EXIT=0`、`git status --porcelain` 原文。

## 6. 本卡不做（越界即退回）

- S1.2 大纲章节覆盖完整性纳入报告（设计稿 `:205`）—— 不在本卡。
- S1.3 新建豁免 UI／框架（`:206`）—— 只许复用既有。
- 面板 `ConsistencyPreflightPanel.tsx` 任何改动（含 `:42-43` 扩 `sourceLayer` 第三值）。
- `deriveRosterStatus` 导出化、改其判据、或把它下沉到 `src/shared`（已选 IPC 路线）。
- `characters_arch` 的任何写入路径（`architecture.command.ts:1933` `writeArchToDb` 不加 `charactersArch` 分支）。
- 设计稿 §5 `:204` 表格那行「双向对齐检查」的措辞（项目总负责人已报 admin 待裁，非我改）。
