import type Database from 'better-sqlite3'
import { isDeepStrictEqual } from 'node:util'
import type { FinalizationGenerationContext, FinalizationGenerationSlot } from '../../src/shared/finalization-generation'
import { finalizationStepSpec, isFinalizationStepKey } from '../../src/shared/finalization-generation'
import { finalizedCharacterPromptCards, type FinalizedCharacterContext, type FinalizedContinuityFact } from '../../src/shared/finalized-continuity'
import { finalizedCharacterCardDeltaContract } from '../../src/shared/finalized-card-delta-contract'
import { formatKnowledgeCandidateFacts } from '../../src/shared/knowledge-candidate'
import { composePromptSystemRole, type PromptTemplate } from '../../src/services/builtin-prompt-templates'
import { renderPrompt } from '../../src/shared/render-prompt'
import type { GenerationTask } from '../../src/services/generation/generation-harness'
import type { WritingLanguage } from '../../src/shared/writing-language'
import { SummaryRepository } from '../repositories/summary-repository'
import { textHash, type DurableGenerationRun } from '../repositories/generation-run-repository'

export function finalizationSlotKey(slot: FinalizationGenerationSlot): string {
  if (!slot || Object.keys(slot).some(key => !['source', 'stepKey'].includes(key)) || !isFinalizationStepKey(slot.stepKey)
    || !slot.source || Object.keys(slot.source).some(key => !['draftId', 'chapterNumber', 'finalizationId', 'contentHash'].includes(key))
    || !Number.isSafeInteger(slot.source.draftId) || slot.source.draftId < 1 || !Number.isSafeInteger(slot.source.chapterNumber) || slot.source.chapterNumber < 1
    || typeof slot.source.finalizationId !== 'string' || !slot.source.finalizationId.trim() || !/^[a-f0-9]{64}$/.test(slot.source.contentHash)) throw new Error('GENERATION_FINALIZATION_SLOT_INVALID')
  return textHash(JSON.stringify([slot.source.draftId, slot.source.finalizationId, slot.source.chapterNumber, slot.source.contentHash, slot.stepKey]))
}
export function finalizationNotesBaseline(db: Database.Database, slot: FinalizationGenerationSlot): FinalizationGenerationContext['notesBaseline'] {
  const blueprint = db.prepare('SELECT notes FROM blueprints WHERE chapter_number=?').get(slot.source.chapterNumber) as { notes: string } | undefined
  const rows = db.prepare('SELECT chapter_number,chapter_notes,continuity_facts,source_finalization_id,source_content_hash,projection_generation FROM summary_snapshots WHERE draft_id=? ORDER BY id').all(slot.source.draftId)
  return { blueprint: { exists: !!blueprint, notes: blueprint?.notes ?? '' }, continuityHash: textHash(JSON.stringify(rows)) }
}
const immutableIdentity = (context: FinalizedCharacterContext) => ({ ...context, characters: context.characters.map(({ fields: _fields, ...identity }) => { void _fields; return identity }) })

/**
 * 本章**当前定稿版本**的连续性事实。
 *
 * 三个条件缺一不可，任何一个不满足都返回空数组（而不是「读失败」）：
 * 1. 那一章有投影、且投影 `current`（改稿连锁后上一版必须作废）；
 * 2. `finalizationId` 与 `contentHash` 都等于本 slot —— 否则会把**上一版正文**的事实
 *    配给这一版定稿的候选，那是改稿后最典型的错配；
 * 3. `chapter_notes` 跑过（没有要点就没有事实，这是正常状态，不是错误）。
 */
export function readChapterContinuityFacts(db: Database.Database, slot: FinalizationGenerationSlot): FinalizedContinuityFact[] {
  if (slot.stepKey !== 'knowledge_candidates') return []
  let projections
  try { projections = SummaryRepository.listFinalizedContinuityBefore(slot.source.chapterNumber + 1, db) } catch { return [] }
  const projection = projections.find(item => item.chapterNumber === slot.source.chapterNumber)
  if (!projection || projection.sourceStatus !== 'current' || !projection.source
    || projection.source.finalizationId !== slot.source.finalizationId
    || projection.source.contentHash !== slot.source.contentHash) return []
  return projection.facts ?? []
}

export function captureFinalizationGenerationContext(db: Database.Database, slot: FinalizationGenerationSlot, scope: { projectId: string; epoch: string },
  writingLanguage: WritingLanguage, template: PromptTemplate, frozen?: FinalizationGenerationContext): FinalizationGenerationContext {
  finalizationSlotKey(slot)
  const identity = SummaryRepository.readFinalizedCharacterContext(slot.source.draftId, frozen?.identity ?? scope, db)
  if (!isDeepStrictEqual(identity.source, slot.source)) throw new Error('GENERATION_FINALIZATION_SOURCE_CHANGED')
  if (frozen && (!isDeepStrictEqual(slot, frozen.slot) || !isDeepStrictEqual(immutableIdentity(identity), immutableIdentity(frozen.identity)))) throw new Error('GENERATION_FINALIZATION_IDENTITY_CHANGED')
  const row = db.prepare('SELECT chapter_title FROM finalization_outbox WHERE draft_id=?').get(slot.source.draftId) as { chapter_title: string }
  const blueprint = db.prepare('SELECT characters FROM blueprints WHERE chapter_number=?').get(slot.source.chapterNumber) as { characters: string } | undefined
  return { slot: structuredClone(slot), identity: structuredClone(frozen?.identity ?? identity), chapterTitle: row.chapter_title,
    chapterEntities: JSON.parse(blueprint?.characters ?? '[]'), writingLanguage, template: structuredClone(template),
    notesBaseline: frozen?.notesBaseline ?? finalizationNotesBaseline(db, slot),
    // 只有知情候选步骤带事实。空数组有语义（`chapter_notes` 没跑），不是读取失败 ——
    // 所以不进 `notesBaseline`，也不许被调用方当成「没有候选」。
    ...(slot.stepKey === 'knowledge_candidates'
      ? { continuityFacts: structuredClone(frozen?.continuityFacts ?? readChapterContinuityFacts(db, slot)) }
      : {}) }
}
export function readFinalizationGenerationContext(run: DurableGenerationRun): FinalizationGenerationContext {
  const manifest = run.binding.sourceManifest, context = manifest.finalizationGenerationContext as FinalizationGenerationContext | undefined
  if (!context || textHash(JSON.stringify(context)) !== manifest.finalizationGenerationContextHash
    || finalizationSlotKey(context.slot) !== manifest.finalizationGenerationSlotKey
    || context.identity.projectId !== run.binding.projectId || context.identity.epoch !== manifest.finalizationGenerationOriginEpoch
    || !isDeepStrictEqual(context.slot.source, context.identity.source) || textHash(context.identity.content) !== context.slot.source.contentHash
    || manifest.operation !== finalizationStepSpec(context.slot.stepKey).operation) throw new Error('GENERATION_FINALIZATION_CONTEXT_INVALID')
  return structuredClone(context)
}
export function finalizationGenerationTask(context: FinalizationGenerationContext, originProjectId?: string): GenerationTask {
  const characters = context.slot.stepKey === 'character_cards'
  const knowledge = context.slot.stepKey === 'knowledge_candidates'
  const characterContract = context.writingLanguage === 'en-US'
    ? '[Final output contract: this overrides the [JSON output contract] above] Do not copy that example: its newCharacters list and full-field layout do not apply. A person with an existing character card must use that card\'s exact characterId, and every update must include evidence. Every update must include recentEvents (this character\'s latest state at the end of the chapter, within 50 words). The recentEvents of each update states the latest state of this character at the end of the chapter: when later prose corrects, withdraws, or postpones an earlier plan, follow the last correction and prioritize that correction and its current conditions over a more prominent earlier event; do not write the superseded plan or describe a still-pending plan as executed. Without a correction, retain this character\'s relevant event or still-pending plan. Do not apply another character\'s change of plan to this character; evidence quotes the one sentence that directly supports that latest state. List other fields only when the value differs from the existing card and matches the field (location is only the place the chapter prose explicitly states the character is currently in, never an event or progress; when the prose only states a plan, a decision, or an intention to go somewhere, the character is still where they were and must not be written as en route or arrived; when the prose states no clear change of place, do not list location). Return one JSON object: {"updates":[{"characterId":"exact ID from the frozen list","currentState":{"recentEvents":"this chapter\'s event","location":"new place"},"evidence":{"text":"exact source quote"}}]}. Copy a quote that occurs exactly once in the unmodified chapter; its offsets will be calculated. If you supply start/end, they must be exact JS UTF-16 offsets. evidence.text must be one contiguous, verbatim span of the frozen chapter that occurs exactly once; never join sentences across paragraphs or blank lines, and do not alter punctuation or whitespace. If unsure of the position, omit start/end and let the program calculate them. Only supplied dynamic fields are proposed. Do not infer identity from a name. Unknown or ambiguous people use name without characterId and remain proposals. Do not return static character facts or author provenance.'
    : '【最终输出合同，覆盖上文【输出格式（JSON）】】不得照抄上文示例：其中的 newCharacters 与全字段写法不适用；现有角色卡中的人物必须使用其精确 characterId，每个 update 都必须含 evidence；每个 update 必须填写 recentEvents（本章结束时该角色的最新状态，50字以内）；每个 update 的 recentEvents 写本章结束时该角色的最新状态：正文后文更正、撤回或推迟了前文安排时，以最后的更正为准，优先保留该更正及当前条件，不得被更显著的旧事件挤掉；不写已被更正的旧安排，也不把仍待执行的计划写成已执行。没有更正时，保留该角色有关事件或仍待执行的安排；不得将其他角色的安排变化套到该角色；evidence 引用直接支持该最新状态的一句。其余字段只在值与现有角色卡不同且名实相符时列出（location 只写正文明确写出的人物当前所在地点，不写事件或进度；正文只写了计划、决定或打算前往某处时，人物仍在原处，不得写成“前往途中”“已到达”；正文没有明确写出地点变化时不要列出 location）。只返回一个 JSON 对象：{"updates":[{"characterId":"冻结名单中的精确ID","currentState":{"recentEvents":"本章事件","location":"新地点"},"evidence":{"text":"原文精确引用"}}]}。引用必须在未改写正文中仅出现一次，位置由程序精确计算；若提供 start/end，必须是准确的 JS UTF-16 位置。evidence.text 必须是冻结正文中单一连续、逐字、只出现一次的片段；不得跨段落或空行拼接多句，不得删改标点或空白；不确定位置时省略 start/end，由程序计算。只提议明确返回的动态字段；不可凭名字推断身份。未知或歧义人物只返回 name、不填 characterId，保留为待确认提议。不得输出静态角色事实或作者来源。'
  /**
   * 知情候选的输出合同。与角色卡那份的根本区别：**这份合同不给模型任何写事实的字段**。
   * 输出只有两个键，`factIndex` 是系统给的编号，`characterId` 必须抄名单。
   * 所以「模型编了一条事实」在这里不是被拦住，而是没有地方放。
   */
  const knowledgeContract = context.writingLanguage === 'en-US'
    ? '[Final output contract: this overrides the [JSON output contract] above] You do exactly one thing: from the numbered list of registered continuity facts, pick which characters learned one of them in this chapter. '
      + '1. Only pick an existing index from that list. Never summarise, merge, rewrite or invent a fact; anything not in the list did not happen here. '
      + '2. Only newly learned in this chapter; prior knowledge does not count. '
      + '3. Count it only when the prose explicitly shows the character acquiring it: hearing it on the spot, being told, seeing the evidence, or acting on it. Mere co-presence, or being mentioned by name, is not acquiring. '
      + '4. characterId must be copied verbatim from the roster. Never invent one, never infer it from a name. '
      + '5. If unsure, omit. Fewer is better; never guess. '
      + 'Return one JSON object: {"knowledge":[{"factIndex":1,"characterId":"exact ID from the roster"}]}; return {"knowledge":[]} if none. No explanation, no markdown fence.'
    : '【最终输出合同，覆盖上文【输出格式（JSON）】】你只做一件事：在【本章已登记的连续性事实】的编号清单里，挑出本章有谁新得知了其中某条。'
      + '1. 只能挑清单里已有的编号，不得自己概括、合并、改写或新增事实；清单里没有的事，当它没发生。'
      + '2. 只判本章新得知的；本章之前就已经知道的不算。'
      + '3. 判定依据是正文明确写出该角色获知：在场听见、被告知、看到证据、或据此改口与行动。仅仅同时在场、或被旁人提到名字，不算获知。'
      + '4. characterId 只能从【角色名单】原样复制，不得新造，也不得按名字推断。'
      + '5. 拿不准就不写。宁可少提，不许猜。'
      + '只返回一个 JSON 对象：{"knowledge":[{"factIndex":1,"characterId":"名单中的精确ID"}]}；没有就返回 {"knowledge":[]}。不要解释，不要输出 markdown 代码块。'
  // 角色卡步骤要连带下发「卡片增量」合同：软肋登记、筹码变更、顶撞记账。
  // 它与状态六槽是**并列的两个顶层键**（`cardDeltas` 不能塞进 `updates`，否则落库前的
  // 二次解析会把它整段切断）。合同本体是共享常量，与兼容链引同一份，避免两份漂移。
  const contract = characters
    ? `${characterContract}\n\n${finalizedCharacterCardDeltaContract(context.writingLanguage)}`
    : knowledge ? knowledgeContract : ''
  const roster = context.identity.characters.map(character => ({ characterId: character.characterId, name: character.displayNameSnapshot }))
  const cards = characters ? finalizedCharacterPromptCards(context.identity, originProjectId)
    : context.identity.characters.map(character => ({ characterId: character.characterId, name: character.displayNameSnapshot, aliases: character.aliases,
      fields: character.fields.map(field => ({ field: field.field, value: field.value, provenance: field.provenance })) }))
  const prompt = renderPrompt(context.template, { chapter_content: context.identity.content, chapter_number: String(context.slot.source.chapterNumber), chapter_title: context.chapterTitle,
    existing_cards_json: JSON.stringify(cards, null, 2),
    // 只有知情候选步骤用到这两个变量；其它模板里没有它们，传空不影响渲染。
    facts_list: knowledge ? formatKnowledgeCandidateFacts(context.continuityFacts ?? [], context.writingLanguage) : '',
    characters_json: knowledge ? JSON.stringify(roster, null, 2) : '' }, context.writingLanguage)
  const spec = finalizationStepSpec(context.slot.stepKey)
  return { purpose: spec.purpose, reasoningStage: spec.skillStage, output: spec.output,
    messages: [{ role: 'system', content: composePromptSystemRole(context.template, context.writingLanguage) }, { role: 'user', content: contract ? `${prompt}\n\n${contract}` : prompt }] }
}
