# AC2／S2 实施包 · 第 4 维两类登记的层间引用完整性（具名人物）

- 卡：`4027dbef`｜判定面：`681eeb66`（`git log -1 --oneline` = `681eeb66 docs(qa): AC1/S1 首验判词 PASS（判定面 6e0f6a63，卡 a7589d74）`，`porcelain` 0 行）
- 派单方：大肥鱼（口径见群内 22:20 那条）｜出处：主人裁定 2（`.batch/night/org/ruling-arch-1123.md`）、ADR `docs/adr/0027-architecture-shape-three-decisions.md`
- 交付形态：纯函数（零 IO）＋解析器（纯函数）＋既有预检通路上加一条规则；共 4 个文件（2 新增 2 改）

---

## §1 射程与三处裁量（写给判的人看，不要改）

### 1.1 本卡判什么

**蓝图 `characters[]`（模板明写「完整姓名」，`src/services/workflows/commands/directory.command.ts:243`）里点名的每个姓名，是否能在下列两处之一找到逐字包含的登记名：**

1. 世界观第 4 维【具名人物登记】行（`人名｜一句话定位｜固定口吻｜与主角关系`，模板 `src/services/builtin-prompt-templates.ts:686-693`）——**权威**；
2. 角色台账 `characters` 表（`CharacterRosterSnapshot.entries[].name`，`src/shared/character-roster.ts:78`）——**只作交叉核对**，命中即放行，不参与「谁对」的判定。

两处都命中不了 ⇒ 出 1 条 `warning`，落点 `sourceChapter = 本章`。

### 1.2 三处裁量（本包已定，判词里请照记；不同意请当场退回，不要自行改）

- **裁量 A：空间名这一半不做新规则。** 既有 `findSpaceTimeConflicts` 已经用「trim 后全等」报未登记空间名（`src/shared/space-time-consistency.ts:286`，注释 `:271`）。若再加一条「逐字包含」的未登记空间名规则，它与既有规则的命中集**要么完全重合（双报噪声）**，要么只在「蓝图写『老陈记早餐摊』、登记写『老陈记』」时多报一条——那恰是既有规则的误报，属于**改写既有全等语义**，与「本卡不碰 `:286`」直接冲突。故 AC2 只做**人物**这一半；空间包含口径若要做，应另开卡改既有规则本身（含其测试与覆盖度文案），不在本卡夹带。
- **裁量 B：「逐字包含」采**单向**包含＋去尾部括注**（admin 22:29 裁定后改定）。判据是「登记名（去尾部括注）包含于蓝图姓名串」，不反查「登记了但未被引用」。两种常见异写都由此覆盖：蓝图写「林昭（主角）」、登记写「林昭」（子串命中）；蓝图写「老陈」、登记写「老陈（早餐摊摊主）」（去括注后子串命中）。原先拟的「双向包含」作废——反向（蓝图名包含于登记名）会把真正未登记的短名当成已登记，是假阴性通道。
- **裁量 C：名字短于 2 字不参与比对。** S2.3 原文「要求名字 ≥2 字」；单字名（「陈」「王」）做包含匹配会命中近乎任意文本，既不该报缺失也不该算登记 ⇒ **按放行处理**（不报），不是报缺失。

### 1.3 fail-open 的边界（不许越）

| 情形 | 行为 | 理由 |
|---|---|---|
| `worldbuilding` 读取失败 / 为空 | 返回 `[]` | 与既有 `findBlueprintSpaceTimeRisks` 同一纪律 |
| 解析出的登记行 0 条（含整块写「无」） | 返回 `[]`，覆盖度给「显式未判」文案 | 裁定 2「名单空即显式未判」 |
| **角色台账读取失败** | 返回 `[]` | 登记块按模板规则 7 **只登记位置锚定型配角**，主角不在里面；台账取不到就等于没法交叉核对，此时只按登记行判会把主角全报成「未登记」⇒ 必须整条 fail-open |
| `chapterNumber` 非正整数 | 返回 `[]` | 与 AC1 同法，finding 必须带可信章号 |
| 登记名 >200 字 / 段数为 4 以外的行 | 不收为登记 | 契约是固定四段，宁缺勿编 |
| `blueprint.characters[]` 里的**非完整姓名**项（空串、纯标点、指代「他」「那女人」、超长混写） | 跳过，不产 finding、不报错、不崩 | 模板 `"characters":["完整姓名"]` 只是提示词形状约束，不是编译期保证（项目总负责人 22:36）；指代本就该放过（S2.2） |

### 1.5 本卡交付后仍然存在的显式缺口（S2 收口时不许写成「已达成」）

地名侧**仍旧只有既有 trim 全等**（`src/shared/space-time-consistency.ts:286`，注释 `:271`），「逐字包含」**未接线**；`parseRegisteredSpaceNames` 是**未使用导出，不算达成**，它的用例只证明「不吞【具名人物登记】行」。项目总负责人 22:36 定：派单件与判词都按「地名侧：trim 全等照旧，逐字包含未接线」记，任何「层间引用完整性已达成」的措辞一律退回。

---

## §1.4 射程 2 的裁定结果（**已裁：准 A；2026-11-23 22:29 admin 书面裁定**）

射程 2 原文：「**抽取对象是大纲**，门槛 ≥2 字＋≥2 次，放过指代并在报告里声明局限」。本包按结构化通路落地，与之有两处对上不上：

1. **「从大纲抽取具名实体」在零语义解析下做不出来。** 从自由文本里抽出「这里提到了一个人名」需要 NER 或别名归一，而 ADR `:55` 明写不覆盖别名／简称／错别字，ADR-0027 与设计稿 `§6` 也都写了「不做语义解析」。可行且确定性的只有**反方向**：拿登记名去 `includes()` 大纲文本——那只能证明「登记了的人在没在大纲里出现」，**永远抽不出「未登记的新名字」**，也就判不了本卡要判的事。故本包把抽取对象落在**蓝图的结构化点名数组 `blueprint.characters[]`**（模板强制「完整姓名」，`directory.command.ts:243`），它是全链路唯一带「这是人名」语义的结构化字段。
2. **「≥2 次」在结构化通路上没有对应量。** 次数门槛原本是给散文抽取压假阳性用的；结构化数组每条只出现一次，按次数过滤会让规则恒不触发。本包用两条替代压假阳性的手段：**≥2 字门槛（保留）＋台账交叉核对放行（新增）**。

**admin 裁定（原文要点，22:29）：准 A。**「抽取对象就是 `blueprint.characters[]`（模板强制完整姓名，`directory.command.ts:243`），本卡不做自由文本抽人名——那要 NER／别名归一，ADR `:55` 明写不覆盖，硬做出来的是假阳性机器。匹配口径：登记名**逐字包含于** blueprint 里的姓名串（允许「林昭（主角）」这类后缀），**不反查**「登记了但没被引用」那半边（误报太高）。……这不是缩射程，是把『做不出来的语义半部』显式移出本卡：BACKLOG 记一条『AC2 语义版：从自由文本抽具名人物（需 NER 或别名归一）』，S4 收口时由产品经理落。」

下述 A／B／C 三选一并列保留作裁定留痕，**实施一律按 A**：

- **A（已裁，本包现状）**：抽取对象＝`blueprint.characters[]`；≥2 次门槛作废、换成「≥2 字＋台账交叉核对」；匹配单向——登记名逐字包含于蓝图姓名串，不反查。
- **B**：抽取对象改大纲文本，同时对**登记名**做 `includes()`，报「登记了但大纲未引用」——方向反了，判的不是未登记引用，价值低，不采纳。
- **C**：等 AC3 之后单开一张「带 NER 的语义版 AC2」卡，本卡只做结构化那一半——该语义版已按裁定记入 BACKLOG（S4 由产品经理落）。

**空间那一半的配套裁定（原文要点）：**「准你只出解析器不出规则……既有的 trim 全等已经在报未登记空间名，再叠一条同类规则就是双报或只多报误报。但两条约束：解析器必须带正面用例（证明它不吞人物行），派单件里写明『本轮不发射 finding，为后续复用预留』；**判据只认人物那一半，未使用的导出不算达成**。」

---

## §2 新文件 `src/shared/named-registration-consistency.ts`（完整代码，逐字照抄）

```ts
import type {
  ConsistencyExemption, ConsistencyFinding, ConsistencyPreflightCoverage,
} from './consistency-preflight'

/**
 * AC2／S2：第 4 维【具名人物登记】与蓝图点名的层间引用完整性。
 *
 * 依据：主人裁定 2（`.batch/night/org/ruling-arch-1123.md`）——最小锚点是「世界观第 4 维的
 * 两类登记（空间名 ＋【具名人物登记】行）」，**匹配只做逐字包含**、名单空即**显式未判**、
 * `characters` 表**只作交叉核对、冲突以登记行为准**。ADR-0027 D2 同源。
 *
 * 本文件只做三件事：解析登记行、按「逐字包含」比对、把未命中译成 `ConsistencyFinding`。
 * 不读库、不读文件、不生成文案以外的任何副作用；既有 `findSpaceTimeConflicts` 的
 * 「trim 后全等」语义**原样不动**（两套匹配器并存，不合并——见实施包 §1.2 裁量 A/B）。
 */

/** 键前缀独立于 `space:`／`slot:`，加新规则不改变既有键。 */
export const NAMED_PERSON_KEY_PREFIX = 'named:unregistered-person:'

/** S2.3：名字短于 2 字时包含匹配会命中近乎任意文本 ⇒ 不参与比对（按放行处理）。 */
export const MIN_NAMED_ENTITY_LENGTH = 2

const FIELD_SEPARATOR = /[｜|]/u
const MACHINE_FIELD = /^(hours|entry)\s*=/u
const LEADING_MARKERS = /^[\s\-*•·★]+/u

export interface NamedPersonRegistration {
  /** 登记名（第 1 段，去掉列表符号）。 */
  name: string
  /** 原始整行，供 evidence／作者回查。 */
  line: string
}

/**
 * 从世界观正文里抽出【具名人物登记】行。
 *
 * 只认「固定四段、全部非空、不含空间机读字段」的行：这样空间条目散文、空间机读行
 * （`空间名｜hours=…｜entry=…`，归 `parseSpaceRules`）与「无」声明都不会被误收。
 * 同一人名重复登记时**后一条覆盖前一条**（与空间规则同纪律，不静默合并矛盾登记）。
 */
export function parseNamedPersonRegistrations(
  worldBuildingText: string | null | undefined,
): NamedPersonRegistration[] {
  if (typeof worldBuildingText !== 'string' || !worldBuildingText.trim()) return []
  const byName = new Map<string, NamedPersonRegistration>()
  for (const rawLine of worldBuildingText.split(/\r?\n/u)) {
    const segments = rawLine.split(FIELD_SEPARATOR).map(segment => segment.trim())
    // 固定四段：人名｜一句话定位｜固定口吻｜与主角关系。段数不足＝没按契约登记。
    if (segments.length < 4) continue
    if (segments.some(segment => !segment)) continue
    // 空间机读行不是人物登记行。
    if (segments.some(segment => MACHINE_FIELD.test(segment))) continue
    const name = segments[0]!.replace(LEADING_MARKERS, '').trim()
    if (!name || name.length > 200) continue
    if (name.includes('=') || FIELD_SEPARATOR.test(name)) continue
    // 模板允许整块写「无」表示确实没有这样的人 ⇒ 不是一条登记。
    if (name === '无') continue
    byName.set(name, { name, line: rawLine.trim() })
  }
  return [...byName.values()]
}

export interface NamedRegistrationScope {
  chapterNumber: number
  /** 本章蓝图点名的完整姓名（`blueprint.characters`）。 */
  characterNames: readonly string[]
  /**
   * 角色台账里的姓名（`CharacterRosterSnapshot.entries[].name`）。
   * **可选**：`undefined` 表示台账没读到 ⇒ 本规则整条 fail-open（原因见实施包 §1.3）。
   */
  rosterNames?: readonly string[]
}

/** 键只认姓名本身（不含章号）：一次豁免对整个项目生效，与「同一登记缺失」的事实粒度一致。 */
export function namedPersonStableFactKey(reference: string): string {
  return `${NAMED_PERSON_KEY_PREFIX}${reference.trim().toLocaleLowerCase('en-US')}`
}

/** 去尾部括注（（…）／(…)／【…】）：允许「林昭（主角）」这类后缀，不做任何别名归一。 */
function coreName(name: string): string {
  return name.replace(/\s*[（(【][^）)】]*[）)】]\s*$/, '').trim()
}

function containsNamed(container: string, name: string): boolean {
  const probe = coreName(name)
  if (probe.length < MIN_NAMED_ENTITY_LENGTH) return false
  return container.includes(probe)
}

/**
 * 单向逐字包含（admin 22:29 准 A）：**登记名（去尾部括注）是蓝图姓名串的子串**即命中。
 * 不反查「登记了但未被引用」那半边，不做别名归一；蓝图名本身不足 2 字时按放行处理（裁量 C）。
 * 蓝图写「林昭（主角）」、登记写「林昭」，或蓝图写「老陈」、登记写「老陈（早餐摊摊主）」，都由去括注＋单向包含命中。
 */
function matchedByName(reference: string, names: readonly string[]): boolean {
  if (reference.length < MIN_NAMED_ENTITY_LENGTH) return true
  return names.some(name => containsNamed(reference, name))
}

export function findUnregisteredPersonRisks(
  worldBuildingText: string | null | undefined,
  scope: NamedRegistrationScope,
  exemptions: readonly ConsistencyExemption[] = [],
): ConsistencyFinding[] {
  const registrations = parseNamedPersonRegistrations(worldBuildingText)
  // 登记 0 条 ⇒ 显式未判（覆盖度另有文案），既不算通过也不误报。
  if (registrations.length === 0) return []
  // 台账不可用 ⇒ 交叉核对做不了 ⇒ 整条 fail-open（见 §1.3）。
  if (!scope.rosterNames) return []
  if (!Number.isInteger(scope.chapterNumber) || scope.chapterNumber <= 0) return []

  const activeExemptions = new Set(
    exemptions.filter(exemption => !exemption.revoked).map(exemption => exemption.stableFactKey),
  )
  const registeredNames = registrations.map(registration => registration.name)
  const rosterNames = scope.rosterNames.filter(name => typeof name === 'string' && name.trim())
  const registrySample = registeredNames.join('、')

  const seen = new Set<string>()
  const findings: ConsistencyFinding[] = []
  for (const rawReference of scope.characterNames) {
    const reference = typeof rawReference === 'string' ? rawReference.trim() : ''
    if (!reference || reference.length < MIN_NAMED_ENTITY_LENGTH) continue
    if (seen.has(reference)) continue
    seen.add(reference)
    // 以登记行为准：命中登记行即放行。
    if (matchedByName(reference, registeredNames)) continue
    // 台账只作交叉核对：台账里有这个名字同样放行，不判谁对。
    if (matchedByName(reference, rosterNames)) continue
    const stableFactKey = namedPersonStableFactKey(reference)
    if (activeExemptions.has(stableFactKey)) continue
    findings.push({
      stableFactKey,
      severity: 'warning',
      sourceChapter: scope.chapterNumber,
      evidence: `本章蓝图点名「${reference}」；第 4 维【具名人物登记】现有 ${registeredNames.length} 条`
        + `（${registrySample}），角色台账 ${rosterNames.length} 个姓名，逐字包含比对均未命中。`,
      issue: {
        zhCN: `本章蓝图点名了「${reference}」，但世界观第 4 维【具名人物登记】里没有他，角色台账里也查不到这个姓名。`,
        enUS: `This chapter names "${reference}", but dimension 4 (named character registry) does not register it `
          + 'and the character roster has no such name either.',
      },
      suggestion: {
        zhCN: `若「${reference}」是会反复出现的位置锚定型配角，请在世界观第 4 维【具名人物登记】单独成行补登记`
          + '（人名｜一句话定位｜固定口吻｜与主角关系）；若只是本章一次性的路人，改掉蓝图里的写法即可。'
          + '这一条只作证据提示，不阻断生成，也不改你的正文。',
        enUS: `If "${reference}" is a recurring location-anchored supporting character, add a line to dimension 4 `
          + '(name｜one-line role｜fixed voice｜relationship to the protagonist). If it is a one-off passer-by, '
          + 'rewrite the blueprint entry instead. Advisory only: it neither blocks generation nor edits your draft.',
      },
      // 不写 sourceLayer：面板 `ConsistencyPreflightPanel.tsx:42-43` 只有「世界观/蓝图」二元，
      // 本条的修法可能落在任何一层，硬填一层会误导（AC1 同处置）。
    })
  }
  return findings
}

/**
 * 第 4 维**空间名**登记（两类登记里的另一半）。
 *
 * 只认机读行（首段＝空间名，后续段至少一个 `hours=`／`entry=`），与 `parseSpaceRules` 同一
 * 认行口径、但**只回答「登记了哪些名字」**：本卡不据此发射规则（既有 `findSpaceTimeConflicts`
 * 的 trim 全等判定原样不动，见实施包 §1.2 裁量 A），它只服务于覆盖度与后续卡。
 */
export function parseRegisteredSpaceNames(
  worldBuildingText: string | null | undefined,
): string[] {
  if (typeof worldBuildingText !== 'string' || !worldBuildingText.trim()) return []
  const names = new Set<string>()
  for (const rawLine of worldBuildingText.split(/\r?\n/u)) {
    const segments = rawLine.split(FIELD_SEPARATOR).map(segment => segment.trim())
    if (segments.length < 2) continue
    if (!segments.slice(1).some(segment => MACHINE_FIELD.test(segment))) continue
    const name = segments[0]!.replace(LEADING_MARKERS, '').trim()
    if (!name || name.length > 200) continue
    if (name.includes('=') || name === '无') continue
    names.add(name)
  }
  return [...names]
}

/**
 * AC2 的参与范围（不判时要让作者知道**为什么没判**——与既有空间—钟点覆盖度同一纪律）。
 *
 * 字段按 admin 射程 3 的要求**加在既有 `ConsistencyPreflightCoverage` 上**
 * （`src/shared/consistency-preflight.ts:260-265`），本文件不另立覆盖度类型。
 */
export function describeNamedEntityCoverage(
  coverage: ConsistencyPreflightCoverage | undefined,
): { zhCN: string; enUS: string } | undefined {
  if (!coverage) return undefined
  if (coverage.registeredNamedPeople === null) {
    return {
      zhCN: '具名人物引用核对本次未参与判定：读取设定层失败。',
      enUS: 'The named-character reference check did not run: the world setting could not be read.',
    }
  }
  if (coverage.registeredNamedPeople === 0) {
    return {
      zhCN: '具名人物引用核对本次未参与判定：世界观第 4 维还没有【具名人物登记】行（或写的是「无」）。'
        + '要启用该核对，请重新生成世界观，或在第 4 维手工补一行「人名｜一句话定位｜固定口吻｜与主角关系」。',
      enUS: 'The named-character reference check did not run: dimension 4 has no named-character registry line yet '
        + '(or it says "无"). To enable it, regenerate the world setting, or add a line such as '
        + '"name｜one-line role｜fixed voice｜relationship to the protagonist" under dimension 4.',
    }
  }
  if (coverage.blueprintCharacterRefs === 0) {
    return {
      zhCN: `具名人物引用核对本次未参与判定：设定层已登记 ${coverage.registeredNamedPeople} 个人物，但本章蓝图没有点名任何人物。`,
      enUS: `The named-character reference check did not run: ${coverage.registeredNamedPeople} registered character(s), `
        + 'but this blueprint names none.',
    }
  }
  return {
    zhCN: `具名人物引用核对已完成（已登记 ${coverage.registeredNamedPeople} 个人物 × ${coverage.blueprintCharacterRefs} 条蓝图点名），未发现未登记人名。`,
    enUS: `Named-character reference check completed (${coverage.registeredNamedPeople} registered character(s) × `
      + `${coverage.blueprintCharacterRefs} blueprint name(s)); no unregistered names found.`,
  }
}
```

---

## §3 改 `src/services/consistency-preflight.ts`（改动点 3a–3d，逐字）＋ `src/shared/consistency-preflight.ts`（3e，只加覆盖度字段）

**3a 顶部 import（接在既有 import 之后）**

```ts
import {
  describeNamedEntityCoverage, findUnregisteredPersonRisks, parseNamedPersonRegistrations,
} from '../shared/named-registration-consistency'
```

**3b 在 `readConsistencyPreflight` 里，`worldBuildingText` 读取块之后加台账读取（try/catch，失败即 `undefined`）**

```ts
  // AC2：角色台账只作**交叉核对**（裁定 2）。读不到就不判——登记块按规定只收位置锚定型配角，
  // 主角不在其中，台账缺失时只按登记行判会把主角全报成「未登记」（见实施包 §1.3）。
  let rosterNames: string[] | undefined
  try {
    const snapshot = await ipc.invokeWithProjectSession(session, 'db:character-roster-read', session.projectPath)
    rosterNames = (snapshot?.entries ?? []).map(entry => entry.name).filter(name => Boolean(name))
  } catch { rosterNames = undefined }
```

**3c `findings` 数组里，紧跟 `findBlueprintSlotAttackRisks` 那一行之后加一行**

```ts
        ...findUnregisteredPersonRisks(worldBuildingText, {
          chapterNumber: blueprint.chapterNumber,
          characterNames: blueprint.characters,
          rosterNames,
        }, exemptions),
```

**3d 扩既有 `coverage` 对象（函数末尾那一段，不新增返回字段）**

```ts
  const coverage: ConsistencyPreflightCoverage = {
    registeredSpaces: worldBuildingText === undefined ? null : parseSpaceRules(worldBuildingText).length,
    blueprintSpaceRefs: blueprints.reduce(
      (total, blueprint) => total + normalizeSpaceRefs(blueprint.structuredRefs).length, 0,
    ),
    // AC2（射程 3：字段加在既有覆盖度上，名单空＝显式未判）
    registeredNamedPeople: worldBuildingText === undefined
      ? null : parseNamedPersonRegistrations(worldBuildingText).length,
    blueprintCharacterRefs: blueprints.reduce(
      (total, blueprint) => total + blueprint.characters.filter(name => Boolean(name?.trim())).length, 0,
    ),
  }
```

**3e 改 `src/shared/consistency-preflight.ts` 的覆盖度接口（`:260-265`，只加字段与注释，不动既有两条）**

```ts
export interface ConsistencyPreflightCoverage {
  /** 设定层（架构产出的 `worldbuilding`）里已登记的**可判定空间**条数。`null` = 设定层读取失败。 */
  registeredSpaces: number | null
  /** 本次涉及的蓝图里带结构化空间引用（`spaceRefs`）的总条数。 */
  blueprintSpaceRefs: number
  /** AC2：第 4 维解析出的【具名人物登记】条数。`null` = 设定层读取失败；`0` = 显式未判。 */
  registeredNamedPeople: number | null
  /** AC2：本次涉及的蓝图里点名（`characters[]`）的姓名总数。 */
  blueprintCharacterRefs: number
}
```

并导出 `describeNamedEntityCoverage`（接在既有 `export { describeSpaceTimeCoverage, ... }` 的同一处）：

```ts
export { describeNamedEntityCoverage }
```

**不改**：`blueprints.map` 的形状、`findBlueprintSpaceTimeRisks`／`findDuplicateSlotAttackRisks` 调用、`coverage` 既有字段、任何 `src/shared/space-time-consistency.ts` 行、任何面板。

---

## §4 新文件 `src/shared/__tests__/named-registration-consistency.test.ts`（用例 13 条 + 变异靶 5 发）

夹具（照抄模板格式）：

```ts
const WORLD = [
  '## 4. 空间结构',
  '老陈记｜hours=07:00-09:00｜entry=直接进入',
  '★【具名人物登记】',
  '老陈｜老陈记早餐摊摊主｜"还是老样子，加辣？"｜主角每天早上的熟客',
  '林昭（主角）｜本书主角｜"走吧"｜本人',
  '门卫老周｜厂区南门门卫｜"证件"｜主角进厂要过的关卡',
  '',
  '## 5. 时间历法',
].join('\n')
```

| # | 用例 | 期望 |
|---|---|---|
| 1 | 正向：`characters: ['老陈','林某']`、`rosterNames: ['林某','主角']` | `[]`（老陈命中登记、林某命中台账） |
| 2 | 正向：`characters: ['陌生甲']`、`rosterNames: ['主角']` | 1 条；`stableFactKey === 'named:unregistered-person:陌生甲'`、`severity==='warning'`、`sourceChapter===7` |
| 3 | 正向：`characters: ['林昭']`，登记行写「林昭（主角）」 | `[]`（登记名去尾部括注后是蓝图名的子串；删掉 `coreName` 即转红） |
| 4 | 负向：`worldBuildingText: undefined` | `[]` |
| 5 | 负向：世界观整块写「无」（无四段行） | `[]` |
| 6 | 负向：`rosterNames: undefined`（台账读失败） | `[]` |
| 7 | 负向：`chapterNumber: 0` | `[]` |
| 8 | 负向：单字名 `characters: ['陈']`；非完整姓名项 `['', '他', '那女人', '！！！']` | `[]`（裁量 C 放行／fail-open 跳过，不报错） |
| 9 | 负向：豁免命中（`{stableFactKey: namedPersonStableFactKey('陌生甲'), reason:'x', revoked:false}`） | `[]` |
| 10 | 负向：豁免已撤销（`revoked: true`） | 仍 1 条 |
| 11 | 负向：键稳定 `namedPersonStableFactKey(' 陌生甲 ') === namedPersonStableFactKey('陌生甲')` | `true` |
| 12 | 负向：空间机读行不被当人物行 `parseNamedPersonRegistrations(WORLD).map(r=>r.name)` | `['老陈','林昭（主角）','门卫老周']`（不含 `老陈记`） |
| 13 | 正向（另一半解析器）：`parseRegisteredSpaceNames(WORLD)` | `['老陈记']`；且人物登记行不进这个结果 |

变异靶（逐发改一处、跑测试、复原）：

- **M1** 删 `if (registrations.length === 0) return []` ⇒ 用例 4／5 必须转红
- **M2** 删 `if (!scope.rosterNames) return []` ⇒ 用例 6 必须转红
- **M3** 把 `coreName()` 改成 `return name.trim()`（去掉去尾部括注）⇒ 用例 3 必须转红
- **M4** 删 `reference.length < MIN_NAMED_ENTITY_LENGTH` 的 continue ⇒ 用例 8 必须转红
- **M5** `namedPersonStableFactKey` 去掉 `.toLocaleLowerCase('en-US')` 与 `trim()` 的其中一处 ⇒ 用例 11 必须转红（若只去一处仍相等，就改成去 `trim()` 并把用例 11 改成大小写不敏感断言，报告里写明实际做法）

---

## §5 命令（原样跑，贴原文）

```bash
node scripts/run-tests-electron.mjs src/shared/__tests__/named-registration-consistency.test.ts
node scripts/run-tests-electron.mjs src/shared/__tests__/space-time-consistency.test.ts src/shared/__tests__/consistency-preflight.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
pnpm check:fast
```

> 字面 `pnpm test` 在 worktree 里会触发依赖校验 purge node_modules（`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`，`pnpm.mjs:249560`）——AC1 已按「等价入口」裁定采信，本卡同口径；**不要**为此去 `pnpm install`。

## §6 本卡不做（越界即退回）

- 不动 `src/shared/space-time-consistency.ts` 任何行（含 `:271` 注释、`:286` 全等查表）。
- 不合并两套匹配器、不给既有规则加「包含」分支。
- 不改面板（`ConsistencyPreflightPanel.tsx`），所以 `namedEntityCoverage` 的文案本卡只出到 service 导出为止，面板接线归后续卡（与 AC1 同处置，已在 §1 说明）。
- 不解析散文里的「他／那位」（S2.2 放过指代），不做别名归一，不识别一姓多名。
- 不写库、不改 `characters` 表、不改登记行。

## §7 交件要分清的三种东西

1. **解析器**：`parseNamedPersonRegistrations`（认哪些行、不认哪些行）。
2. **校验**：`findUnregisteredPersonRisks`（守卫顺序、单向包含＋去尾部括注、豁免、键）。
3. **用例**：12 条 ＋ 变异 5 发（哪条用例证明哪个守卫不是空断言）。

## §8 合并顺序（给 apply 的人）

AC2 的 base 是 `681eeb66`，**不含** AC1 代码（AC1 在 `card/arch-ac1-s1` 的 `6e0f6a63`，尚未合入）。两卡都会在 `readConsistencyPreflight` 里读 `db:character-roster-read`：AC1 读一次快照查状态，AC2 再读一次取姓名。**先合 AC1 再合 AC2** 时，请把 AC2 的台账读取改成复用 AC1 已取到的快照（同一变量传 `snapshot.entries.map(e => e.name)`），避免一次预检读两遍台账；若 AC2 先合，则按本包原文落地，AC1 合并时再收敛。裁定钻不做双读，记在判词里。
