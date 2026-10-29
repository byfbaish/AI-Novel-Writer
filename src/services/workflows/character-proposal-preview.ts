import type { CharacterProposalBatch, CharacterProposalDecision } from '../../shared/character-proposal'
import { isAdoptedCharacterDecision, isArchitectureRebuildBatch } from '../../shared/character-proposal'
import { getCharacterRoleLabels } from '../../shared/character-role'

type Text = (zh: string, en: string) => string
/** Suggestions become effects only after the explicit approval step and main validation. */
export function defaultCharacterProposalSelections(batch: CharacterProposalBatch): CharacterProposalDecision[] {
  // 架构重建是「整册替换」而不是「增量补卡」：唯一同名在重建语境下就是同一个人，默认采用到那张卡，
  // 否则作者点确认后新生成的主角卡会被静默丢弃（2026-10-29 实测，见 isArchitectureRebuildBatch）。
  const rebuild = isArchitectureRebuildBatch(batch.source)
  return batch.items.map(item => {
    const resolution = item.resolution
    if (resolution.status === 'resolved') return { selectionKey: item.selectionKey, action: 'map' as const, characterId: resolution.characterId }
    if (resolution.status === 'unresolved' && resolution.candidateIds.length === 0)
      return { selectionKey: item.selectionKey, action: 'create' as const }
    if (rebuild && resolution.candidateIds.length === 1)
      return { selectionKey: item.selectionKey, action: 'map' as const, characterId: resolution.candidateIds[0] }
    return { selectionKey: item.selectionKey, action: 'keep-unresolved' as const }
  })
}
/** Names are display labels. Only declared selection-key endpoints can become proposed edges. */
export function defaultCharacterProposalRelationships(batch: CharacterProposalBatch) {
  const adoptedKeys = new Set(defaultCharacterProposalSelections(batch)
    .filter(item => isAdoptedCharacterDecision(item.action)).map(item => item.selectionKey))
  return batch.items.flatMap(item => adoptedKeys.has(item.selectionKey)
    ? item.relationships.flatMap(relation => relation.targetSelectionKey && adoptedKeys.has(relation.targetSelectionKey)
      ? [{ sourceSelectionKey: item.selectionKey, targetSelectionKey: relation.targetSelectionKey, relation: relation.relation }]
      : []) : [])
}
export function formatCharacterProposalPreview(batch: CharacterProposalBatch, text: Text): string {
  if (!batch.items.length) return text('未发现明确角色，角色名单尚未更改。', 'No explicit characters were found; the roster is unchanged.')
  const labels: Record<string, string> = {
    role: text('角色定位', 'Role'), gender: text('性别', 'Gender'), age: text('年龄', 'Age'),
    appearance: text('外貌', 'Appearance'), personality: text('性格', 'Personality'),
    background: text('背景', 'Background'), abilities: text('能力', 'Abilities'),
    motivation: text('动机', 'Motivation'), arc: text('弧光', 'Arc'), notes: text('其他事实', 'Notes'),
  }
  const decisions = defaultCharacterProposalSelections(batch)
  const rebuild = isArchitectureRebuildBatch(batch.source)
  return [batch.status === 'pending-approval' ? text('## 待确认角色提议', '## Character proposals awaiting confirmation')
    : text('## 已保存角色提议', '## Saved character proposals'),
    batch.status === 'pending-approval'
      ? text('候选已保存，尚未写入正式角色。确认仅采用以下明确项；身份不明的候选继续保留。',
        'Candidates are saved but are not formal characters. Confirmation adopts only clear items below; unresolved candidates remain available.')
      : batch.status === 'approved' ? text('采用决策已保存，未采用候选继续保留。', 'Adoption decisions are saved; unadopted candidates remain available.')
        : text('本次采用已取消，候选继续保留。', 'Adoption was cancelled; candidates remain available.'),
    // 架构重建＝整册替换。作者必须知道「确认」会同时覆盖同名旧卡、退休不在名单里的旧角色，
    // 否则他只是想更新这批卡，却不知道别处被清掉了（2026-10-29 实测：旧批一直不退休、三批同人并存）。
    ...(rebuild ? [text('本次是整册重建：同名角色按同一人处理（覆盖旧卡资料），未出现在本名单里的旧角色会被退休。',
      'This is a full roster rebuild: same-name candidates replace the existing cards, and old characters absent from this list are retired.')] : []),
    ...(batch.source.kind === 'cast-ledger' ? [text('这些名字来自归位表：被正文或蓝图提到但还没有卡，已为它们补齐资料；确认后建卡。',
      'These names come from the cast ledger: mentioned in prose or blueprints but not yet carded. Their details have been filled in; confirmation creates their cards.')] : []),
    ...batch.items.map((item, index) => [
      `### ${index + 1}. ${item.fields.name}`,
      `${text('来源', 'Source')}：${item.sourceId}`,
      batch.status !== 'pending-approval' ? '' : decisions[index].action === 'create' ? text('确认后：新建角色', 'On confirmation: create a character')
        : decisions[index].action === 'map' ? text('确认后：采用到已确定的角色', 'On confirmation: adopt into the identified character')
          : decisions[index].action === 'functional' ? text('确认后：登记为功能配角，不建卡（名字仍可被后续章节引用）', 'On confirmation: registered as an anchored supporting role without a card (the name stays referenceable)')
            : text('暂不采用：身份尚未明确，候选保持可读', 'Not adopted: identity is unresolved; the candidate remains readable'),
      ...Object.entries(item.fields).flatMap(([key, value]) => key !== 'name' && typeof value === 'string' && value
        ? [`- ${labels[key] ?? key}：${key === 'role' ? text(getCharacterRoleLabels(value).zhCN, getCharacterRoleLabels(value).enUS) : value}`] : []),
      ...(batch.source.kind === 'legacy-roster-generation' ? [text('原始当前状态仅保留为候选；本次批准不将其写入定稿状态。', 'Original current state is retained as a candidate only; approval does not adopt it as finalized state.'), JSON.stringify(item.rawValue, null, 2)] : []),
      ...item.relationships.map(relation => `- ${text('关系提议', 'Proposed relationship')}：${relation.targetName ?? batch.items.find(candidate => candidate.selectionKey === relation.targetSelectionKey)?.fields.name ?? text('待确认对象', 'Unresolved target')} · ${relation.relation}`),
    ].join('\n')),
  ].join('\n\n')
}
