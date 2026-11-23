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
