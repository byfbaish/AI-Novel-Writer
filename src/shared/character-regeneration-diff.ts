import type {
  CharacterProposalBatch, CharacterProposalDecision, CharacterProposalItem, CharacterStaticFields,
} from './character-proposal'
import type { CharacterRosterCharacterState, CharacterRosterEntry, CharacterRosterRelationship } from './character-roster'
import { CHARACTER_STATE_TEXT_FIELDS } from './character-roster'
import { defaultCharacterProposalSelections } from '../services/workflows/character-proposal-preview'

/**
 * C1-b：重生成字段级并排对比 + 三选一（设计稿
 * `docs/design/characters/c1-relevance-filter-and-regeneration-diff-design.md` §4）。
 *
 * ## 为什么是「按字段并排」而不是逐字 diff
 *
 * 角色卡是**固定字段的表格**，不是自由文本。作者要回答的问题是「这次覆盖会让这个人
 * 变哪几处」，不是「哪几个字变了」。逐字 diff 既读不懂，也会把一次同义改写渲染成满屏红。
 * 主人 2026-11-24 已明确否掉逐字 diff。
 *
 * ## 纯函数边界
 *
 * 本模块不碰 IO、不读库、不调 IPC：输入两张卡的字段、输出行数组。面板只负责显示，
 * 主进程只负责落快照与回退。
 */

export const REGENERATION_DIFF_GROUPS = ['name', 'role', 'background', 'relationships', 'currentState'] as const
export type RegenerationDiffGroup = typeof REGENERATION_DIFF_GROUPS[number]

/** 背景组吸收的字段（各自成行会变成 12 行噪音，故合成一组、组内逐字段列差异）。 */
export const REGENERATION_BACKGROUND_FIELDS = [
  'gender', 'age', 'appearance', 'personality', 'background', 'abilities', 'motivation', 'arc', 'notes',
] as const

/**
 * 允许「回退这一字段」的字段集合。
 *
 * 只有 `commitCharacterIdentities` 的 `allowed` 名单内的静态字段能通过作者手改通道写回
 * （`character-roster-repository.ts:1216`）。关系边是**只能追加**的图，没有逐字段回退通道；
 * 动态状态 `currentState` 是只读展示 —— 两者都不在这里，宁可不出按钮，也不做半条回退。
 */
export const REGENERATION_ROLLBACK_FIELDS = [
  'name', 'role', 'gender', 'age', 'appearance', 'personality', 'background', 'abilities', 'motivation', 'arc', 'notes',
] as const
export type RegenerationRollbackField = typeof REGENERATION_ROLLBACK_FIELDS[number]

export const REGENERATION_STRATEGIES = ['overwrite-all', 'keep-existing', 'per-card'] as const
export type RegenerationStrategy = typeof REGENERATION_STRATEGIES[number]

/**
 * 快照与回退的跨进程契约（主进程仓储与 IPC 共用这一份形状）。
 *
 * `sourceRevision` 记的是**这次覆盖产出的身份版本号**：读数刚覆盖完就应等于当前 revision，
 * 之后任何一次手改（含别的批次、别的手改）都会让两者不等 —— 那正是「已被手改，请人工比对」
 * 的判据。若记成覆盖**前**的版本号，正常回退永远判 stale，逐字段回退一个都用不了。
 */
export interface CharacterRegenerationSnapshotView {
  operationId: string
  characterId: string
  sourceRevision: number
  fields: Record<string, string>
  currentState?: Record<string, unknown>
  relationships?: unknown[]
  createdAt: string
}

export interface CharacterRegenerationSnapshotReadRequest { operationId: string }

export interface CharacterRegenerationFieldRollbackRequest {
  operationId: string
  characterId: string
  /** 只允许 `REGENERATION_ROLLBACK_FIELDS` 内的静态字段（关系边与动态状态没有回退通道）。 */
  fields: RegenerationRollbackField[]
  /** 项目会话校验参数由主进程按当前会话补齐，渲染层不传。 */
  expectedProjectPath?: never
}

export interface CharacterRegenerationFieldRollbackResult {
  operationId: string
  characterId: string
  fields: Record<string, string>
  /** 回退后的身份版本号（必然大于回退前）。 */
  revision: number
}

export const REGENERATION_STRATEGY_LABELS: Record<RegenerationStrategy, { zhCN: string; enUS: string }> = {
  'overwrite-all': { zhCN: '全部覆盖', enUS: 'Overwrite all' },
  'keep-existing': { zhCN: '保留旧卡（跳过同名）', enUS: 'Keep existing cards (skip same-name)' },
  'per-card': { zhCN: '逐张确认', enUS: 'Confirm each card' },
}

const GROUP_LABELS: Record<RegenerationDiffGroup, { zhCN: string; enUS: string }> = {
  name: { zhCN: '名字', enUS: 'Name' },
  role: { zhCN: '身份', enUS: 'Role' },
  background: { zhCN: '背景', enUS: 'Background' },
  relationships: { zhCN: '关系', enUS: 'Relationships' },
  currentState: { zhCN: '当前状态', enUS: 'Current state' },
}

const FIELD_LABELS: Record<string, { zhCN: string; enUS: string }> = {
  name: { zhCN: '名字', enUS: 'Name' },
  role: { zhCN: '身份', enUS: 'Role' },
  gender: { zhCN: '性别', enUS: 'Gender' },
  age: { zhCN: '年龄', enUS: 'Age' },
  appearance: { zhCN: '外貌', enUS: 'Appearance' },
  personality: { zhCN: '性格', enUS: 'Personality' },
  background: { zhCN: '背景', enUS: 'Background' },
  abilities: { zhCN: '能力', enUS: 'Abilities' },
  motivation: { zhCN: '动机', enUS: 'Motivation' },
  arc: { zhCN: '弧光', enUS: 'Arc' },
  notes: { zhCN: '备注', enUS: 'Notes' },
  location: { zhCN: '所在', enUS: 'Location' },
  powerLevel: { zhCN: '实力', enUS: 'Power level' },
  physicalState: { zhCN: '身体状态', enUS: 'Physical state' },
  mentalState: { zhCN: '精神状态', enUS: 'Mental state' },
  keyItems: { zhCN: '持有物', enUS: 'Key items' },
  recentEvents: { zhCN: '近期事件', enUS: 'Recent events' },
}

export function regenerationFieldLabel(field: string): { zhCN: string; enUS: string } {
  return FIELD_LABELS[field] ?? { zhCN: field, enUS: field }
}

export function regenerationGroupLabel(group: RegenerationDiffGroup): { zhCN: string; enUS: string } {
  return GROUP_LABELS[group]
}

/** 一张同名卡「现在长什么样」的候选形态（面板与单测都只依赖这个形状）。 */
export interface RegenerationCandidate {
  fields: CharacterStaticFields
  relationships?: readonly { targetName?: string; target?: string; relation: string }[]
  currentState?: Partial<CharacterRosterCharacterState>
}

export type RegenerationFieldStatus = 'same' | 'changed' | 'candidate-empty'

export interface RegenerationSentenceDiff {
  /** candidate 有、旧卡没有的句子。 */
  added: string[]
  /** 旧卡有、candidate 没有的句子。 */
  removed: string[]
  /** 位置对齐后的「改写」对（轻量结构化，不是逐字 diff）。 */
  rewritten: { from: string; to: string }[]
}

export interface RegenerationFieldDiff {
  field: string
  group: RegenerationDiffGroup
  status: RegenerationFieldStatus
  oldText: string
  newText: string
  sentences?: RegenerationSentenceDiff
  relationship?: { kind: 'added' | 'removed' | 'relation-changed'; target: string; oldRelation?: string; newRelation?: string }
  /** `candidate-empty-keeps-current`：候选为空，覆盖时会保留现值（不计差异）。 */
  note?: 'candidate-empty-keeps-current' | 'current-state-read-only'
}

export interface RegenerationDiffRow {
  group: RegenerationDiffGroup
  label: { zhCN: string; enUS: string }
  fields: RegenerationFieldDiff[]
  differentFieldCount: number
}

export interface RegenerationDiff {
  rows: RegenerationDiffRow[]
  differentFieldCount: number
}

const SENTENCE_BREAKS = new Set(['。', '！', '？', '；', '.', '!', '?', ';'])

/** 中文按 `。！？；`、英文按 `. ! ? ;` 切句（分隔符留在句尾，方便回显原句）。 */
export function splitRegenerationSentences(text: string): string[] {
  const sentences: string[] = []
  let buffer = ''
  for (const character of text) {
    buffer += character
    if (SENTENCE_BREAKS.has(character)) {
      const trimmed = buffer.trim()
      if (trimmed) sentences.push(trimmed)
      buffer = ''
    }
  }
  const rest = buffer.trim()
  if (rest) sentences.push(rest)
  return sentences
}

/**
 * 差异判定口径：**逐字段去空白后相等比较**。
 *
 * 只去空白、不去标点、不折叠大小写：标点差异在角色资料里通常是真改写（「他笑了」
 * 与「他笑了？」不是一回事），而空白差异几乎总是排版噪音。
 */
function normalizeForCompare(value: string): string {
  return value.replace(/\s+/gu, '')
}

function sentenceDiff(oldText: string, newText: string): RegenerationSentenceDiff {
  const oldSentences = splitRegenerationSentences(oldText)
  const newSentences = splitRegenerationSentences(newText)
  const oldKeys = new Set(oldSentences.map(normalizeForCompare))
  const newKeys = new Set(newSentences.map(normalizeForCompare))
  const added = newSentences.filter(sentence => !oldKeys.has(normalizeForCompare(sentence)))
  const removed = oldSentences.filter(sentence => !newKeys.has(normalizeForCompare(sentence)))
  // 两侧都有剩余就按位置配成「改写」；配不上的留在新增/删除里。
  const pairCount = Math.min(added.length, removed.length)
  return {
    added: added.slice(pairCount),
    removed: removed.slice(pairCount),
    rewritten: Array.from({ length: pairCount }, (_, index) => ({ from: removed[index]!, to: added[index]! })),
  }
}

function textFieldDiff(field: string, group: RegenerationDiffGroup, oldText: string, newText: string): RegenerationFieldDiff {
  const oldValue = oldText.trim()
  const newValue = newText.trim()
  if (!newValue) {
    if (!oldValue) return { field, group, status: 'same', oldText: oldValue, newText: newValue }
    // 候选为空＝覆盖时保留现值：标出来但**不计入差异数**（否则整屏「全红」）。
    return { field, group, status: 'candidate-empty', oldText: oldValue, newText: '', note: 'candidate-empty-keeps-current' }
  }
  if (normalizeForCompare(oldValue) === normalizeForCompare(newValue)) {
    return { field, group, status: 'same', oldText: oldValue, newText: newValue }
  }
  return { field, group, status: 'changed', oldText: oldValue, newText: newValue, sentences: sentenceDiff(oldValue, newValue) }
}

interface NormalizedRelation { target: string; relation: string }

function normalizeRelations(
  input: readonly { targetName?: string; target?: string; relation: string }[] | readonly CharacterRosterRelationship[] | undefined,
): NormalizedRelation[] {
  if (!input) return []
  return (input as readonly { targetName?: string; target?: string; relation: string }[])
    .map(item => ({ target: (item.targetName ?? item.target ?? '').trim(), relation: (item.relation ?? '').trim() }))
    .filter(item => item.target || item.relation)
}

function relationRows(oldRelations: NormalizedRelation[], newRelations: NormalizedRelation[]): RegenerationFieldDiff[] {
  const byTarget = (relations: NormalizedRelation[]) => {
    const map = new Map<string, Set<string>>()
    for (const relation of relations) {
      if (!map.has(relation.target)) map.set(relation.target, new Set())
      if (relation.relation) map.get(relation.target)!.add(relation.relation)
    }
    return map
  }
  const oldMap = byTarget(oldRelations)
  const newMap = byTarget(newRelations)
  const targets = [...new Set([...oldMap.keys(), ...newMap.keys()])].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const rows: RegenerationFieldDiff[] = []
  const describe = (target: string, relations: Set<string> | undefined) =>
    relations && relations.size ? `${target}（${[...relations].join('、')}）` : target
  for (const target of targets) {
    const before = oldMap.get(target)
    const after = newMap.get(target)
    // 关系组按「对象名 + 关系词」配对比较，不做字符串比较：对象相同而关系词变，
    // 是「改写了一份关系」，不是「新增一条 + 消失一条」。
    if (before?.size === 1 && after?.size === 1 && [...before][0] !== [...after][0]) {
      rows.push({ field: `relationships:${target}`, group: 'relationships', status: 'changed',
        oldText: describe(target, before), newText: describe(target, after),
        relationship: { kind: 'relation-changed', target, oldRelation: [...before][0], newRelation: [...after][0] } })
      continue
    }
    for (const relation of after ? [...after].filter(item => !before?.has(item)) : []) {
      rows.push({ field: `relationships:${target}`, group: 'relationships', status: 'changed',
        oldText: '', newText: describe(target, new Set([relation])),
        relationship: { kind: 'added', target, newRelation: relation } })
    }
    for (const relation of before ? [...before].filter(item => !after?.has(item)) : []) {
      rows.push({ field: `relationships:${target}`, group: 'relationships', status: 'changed',
        oldText: describe(target, new Set([relation])), newText: '',
        relationship: { kind: 'removed', target, oldRelation: relation } })
    }
  }
  return rows
}

function currentStateRows(oldState: Partial<CharacterRosterCharacterState> | undefined,
  newState: Partial<CharacterRosterCharacterState> | undefined): RegenerationFieldDiff[] {
  return CHARACTER_STATE_TEXT_FIELDS.map(field => {
    const diff = textFieldDiff(field, 'currentState', oldState?.[field] ?? '', newState?.[field] ?? '')
    // 状态永远是只读展示：候选不提供就保留现值，提供了也只是「会变成什么」的预告。
    return { ...diff, note: 'current-state-read-only' as const }
  })
}

/**
 * 构造两张卡的字段级并排差异。
 *
 * 5 组固定顺序：名字 / 身份（`role`）/ 背景 / 关系 / 当前状态。
 * `differentFieldCount` 只数 `changed` 行 —— `same` 与 `candidate-empty` 都不算。
 */
export function buildRegenerationDiff(oldEntry: CharacterRosterEntry, candidate: RegenerationCandidate): RegenerationDiff {
  const oldFields = oldEntry as unknown as Record<string, string | undefined>
  const newFields = candidate.fields as unknown as Record<string, string | undefined>
  const text = (field: string, group: RegenerationDiffGroup) =>
    textFieldDiff(field, group, String(oldFields[field] ?? ''), String(newFields[field] ?? ''))
  const row = (group: RegenerationDiffGroup, fields: RegenerationFieldDiff[]): RegenerationDiffRow => ({
    group, label: GROUP_LABELS[group], fields,
    // 当前状态是只读项：候选就算提供了不同状态，覆盖时也不会写进去 —— 计进「实质差异」会
    // 让 M 虚高，作者看着「有 3 处不同」点确认，结果只改了 1 处。
    differentFieldCount: group === 'currentState' ? 0 : fields.filter(field => field.status === 'changed').length,
  })

  const rows: RegenerationDiffRow[] = [
    row('name', [text('name', 'name')]),
    row('role', [text('role', 'role')]),
    row('background', REGENERATION_BACKGROUND_FIELDS.map(field => text(field, 'background'))),
    row('relationships', relationRows(normalizeRelations(oldEntry.relationships), normalizeRelations(candidate.relationships))),
    row('currentState', currentStateRows(oldEntry.currentState, candidate.currentState)),
  ]
  return { rows, differentFieldCount: rows.reduce((sum, item) => sum + item.differentFieldCount, 0) }
}

/** 把提案项摊成对比输入：候选只有静态字段与关系提议，动态状态永远不提供。 */
export function regenerationCandidateFromItem(item: CharacterProposalItem): RegenerationCandidate {
  return { fields: item.fields, relationships: item.relationships }
}

/** 同名命中：身份已解析到某张卡，或名字在本批候选里唯一命中。与面板折叠组同一判据。 */
export function isSameNameProposalItem(item: CharacterProposalItem): boolean {
  return item.resolution.status === 'resolved' || item.resolution.candidateIds.length > 0
}

/** 一张同名候选对应的现有卡（按身份 id 优先、按名字兜底）。 */
export function matchRosterEntry(item: CharacterProposalItem, entries: readonly CharacterRosterEntry[]): CharacterRosterEntry | undefined {
  const id = item.resolution.status === 'resolved' ? item.resolution.characterId : item.resolution.candidateIds[0]
  if (id) {
    const byId = entries.find(entry => entry.characterId === id)
    if (byId) return byId
  }
  const name = item.fields.name.trim()
  return name ? entries.find(entry => entry.name.trim() === name) : undefined
}

export interface RegenerationItemDiff { item: CharacterProposalItem; entry: CharacterRosterEntry; diff: RegenerationDiff }

/** 批内每一张「能对上现有卡」的同名候选及其差异。 */
export function listRegenerationDiffs(batch: CharacterProposalBatch, entries: readonly CharacterRosterEntry[]): RegenerationItemDiff[] {
  return batch.items.flatMap(item => {
    if (!isSameNameProposalItem(item)) return []
    const entry = matchRosterEntry(item, entries)
    return entry ? [{ item, entry, diff: buildRegenerationDiff(entry, regenerationCandidateFromItem(item)) }] : []
  })
}

export interface RegenerationCoverage {
  /** 本次重建会覆盖的同名卡张数（N）。 */
  sameNameCount: number
  /** 其中**有实质差异**的卡数（M）；M=0 时按钮降级为「无差异，仍要覆盖？」。 */
  differentCount: number
}

export function summarizeRegenerationCoverage(batch: CharacterProposalBatch, entries: readonly CharacterRosterEntry[]): RegenerationCoverage {
  const diffs = listRegenerationDiffs(batch, entries)
  return { sameNameCount: diffs.length, differentCount: diffs.filter(entry => entry.diff.differentFieldCount > 0).length }
}

/**
 * 三选一 → `CharacterProposalDecision[]`。
 *
 * **只改默认选择，不新增决策类型**（`character-proposal.ts:60-72` 不得改）：最终仍由
 * `selections` 表达，与既有四选一选择器同一份数据。
 *
 * - `overwrite-all`：沿用重建语义的现状默认（同名唯一候选 → `map` 到那张卡）。
 * - `keep-existing`：同名命中项一律 `keep-unresolved`；新名字仍按现状默认（该建卡的建卡）。
 * - `per-card`：作者已有的选择原样透传（面板四选一继续可用）。
 */
export function applyRegenerationStrategy(
  batch: CharacterProposalBatch,
  selections: readonly CharacterProposalDecision[],
  strategy: RegenerationStrategy,
): CharacterProposalDecision[] {
  if (strategy === 'per-card') return selections.map(selection => ({ ...selection }))
  const defaults = defaultCharacterProposalSelections(batch)
  if (strategy === 'overwrite-all') return defaults.map(selection => ({ ...selection }))
  const sameName = new Set(batch.items.filter(isSameNameProposalItem).map(item => item.selectionKey))
  return defaults.map(selection => sameName.has(selection.selectionKey)
    ? { selectionKey: selection.selectionKey, action: 'keep-unresolved' as const }
    : { ...selection })
}
