import { useState } from 'react'
import type { CharacterProposalBatch, CharacterProposalItem } from '../../shared/character-proposal'
import { isAdoptedCharacterDecision } from '../../shared/character-proposal'
import { CHARACTER_ROLES, getCharacterRoleLabels } from '../../shared/character-role'
import type { CharacterProposalChoices, CharacterProposalRelationshipChoice } from '../../services/character-proposal-choices'
import { useLocaleStore } from '../../stores/locale-store'
import { NativeSelect } from '../ui/NativeSelect'
const editableFields = [
  ['name', '姓名', 'Name'], ['gender', '性别', 'Gender'], ['age', '年龄', 'Age'],
  ['appearance', '外貌', 'Appearance'], ['personality', '性格', 'Personality'],
  ['background', '背景', 'Background'], ['abilities', '能力', 'Abilities'],
  ['motivation', '动机', 'Motivation'], ['arc', '弧光', 'Arc'], ['notes', '备注', 'Notes'],
] as const

/** Controlled author choices; the host owns confirmation, main owns the atomic effect. */
export function CharacterProposalSelectionPanel({ batch, identities, choices, onChange, disabled = false }: {
  batch: CharacterProposalBatch
  identities: Array<{ characterId: string; name: string; role?: string }>
  choices: CharacterProposalChoices
  onChange(choices: CharacterProposalChoices): void
  disabled?: boolean
}) {
  const text = useLocaleStore(state => state.text)
  if (choices.proposalBatchId !== batch.proposalBatchId || choices.revision !== batch.revision) return <p role="alert">{text('提议已改变，请重新载入选择。', 'The proposals changed. Reload the choices.')}</p>
  // 名字已命中名册（resolution 带候选 id）的候选收进折叠组：中后期这批会远多于新面孔，
  // 平铺会把"老陈"这种真正要决定的新人淹没（作者实测反馈）。同名永不自动合并，折叠只是视觉收纳。
  const matched = (item: CharacterProposalItem) => item.resolution.status === 'resolved' || item.resolution.candidateIds.length > 0
  const freshItems = batch.items.filter(item => !matched(item))
  const matchedItems = batch.items.filter(matched)
  const relations = batch.items.flatMap(item => item.relationships.map(relation => {
    const matches = batch.items.filter(candidate => candidate.fields.name === relation.targetName)
    return { sourceSelectionKey: item.selectionKey,
      targetSelectionKey: relation.targetSelectionKey ?? (matches.length === 1 ? matches[0].selectionKey : undefined),
      targetName: relation.targetName, relation: relation.relation }
  }))
  const matchedKeys = new Set(matchedItems.map(item => item.selectionKey))
  const freshRelations = relations.filter(relation => !matchedKeys.has(relation.sourceSelectionKey)
    || relation.targetSelectionKey !== undefined && !matchedKeys.has(relation.targetSelectionKey))
  const matchedRelations = relations.filter(relation => !freshRelations.includes(relation))
  const rowProps = { batch, identities, choices, onChange, disabled }
  return <section className="space-y-3" aria-label={text('批量选择角色采用方式', 'Choose character adoption in one batch')}>
    <p className="text-xs text-[var(--color-text-secondary)]">{text('新面孔在上；与已有角色同名的候选和已有角色之间的关系折叠在下方（同名不会自动合并）。可选择对应角色、新建、登记为功能配角或暂不采用；最后一次确认统一保存。', 'New faces first; candidates sharing a name with an existing card and edges between existing cards are collapsed below (names are never merged automatically). Choose a character, create one, register an anchored supporting role, or keep unresolved, then confirm the batch once.')}</p>
    <p className="text-xs text-[var(--color-text-secondary)]">{text('采用到已有角色时不会覆盖已有内容：背景/性格/外貌等叙述字段与候选合并（重复内容自动去重），姓名/性别/年龄/定位以现有卡为准。', 'Adopting onto an existing card never overwrites it: narrative fields (background, personality, appearance…) are merged with the candidate and duplicates are dropped; name, gender, age and role keep the existing card values.')}</p>
    <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
      {freshItems.map(item => <CandidateItem key={item.selectionKey} item={item} {...rowProps} />)}
      {freshRelations.map((relation, index) => <RelationshipBinding key={`${relation.sourceSelectionKey}:${relation.targetSelectionKey ?? relation.targetName}:${index}`}
        relation={relation} batch={batch} identities={identities} choices={choices} onChange={onChange} disabled={disabled} />)}
      {matchedItems.length > 0 && <details className="text-xs">
        <summary className="cursor-pointer">{text(`与已有角色同名，待确认是否同一人（${matchedItems.length}）`, `Shares a name with an existing card; confirm identity (${matchedItems.length})`)}</summary>
        <div className="mt-2 space-y-1">
          {matchedItems.map(item => <CandidateItem key={item.selectionKey} item={item} {...rowProps} />)}
        </div>
      </details>}
      {matchedRelations.length > 0 && <details className="text-xs">
        <summary className="cursor-pointer">{text(`已有角色之间的关系提议（${matchedRelations.length}）`, `Proposed edges between existing cards (${matchedRelations.length})`)}</summary>
        <div className="mt-2 space-y-2">
          {matchedRelations.map((relation, index) => <RelationshipBinding key={`${relation.sourceSelectionKey}:${relation.targetSelectionKey ?? relation.targetName}:${index}`}
            relation={relation} batch={batch} identities={identities} choices={choices} onChange={onChange} disabled={disabled} />)}
        </div>
      </details>}
    </div>
    <ExistingSourceRelations identities={identities} choices={choices} onChange={onChange}
      disabled={disabled || batch.status !== 'pending-approval'} />
  </section>
}

/**
 * 一个候选行的四选一：映射到已有角色 / 新建 / 登记为功能配角 / 暂不采用。
 * 从平铺列表里抽出，供「新面孔」区与「与已有角色同名」折叠组共用。
 */
function CandidateItem({ batch, item, identities, choices, onChange, disabled }: {
  batch: CharacterProposalBatch
  item: CharacterProposalItem
  identities: Array<{ characterId: string; name: string; role?: string }>
  choices: CharacterProposalChoices
  onChange(choices: CharacterProposalChoices): void
  disabled: boolean
}) {
  const text = useLocaleStore(state => state.text)
  const roleLabel = (role: string | undefined) => {
    if (!role) return undefined
    const label = getCharacterRoleLabels(role)
    return text(label.zhCN, label.enUS)
  }
  const choice = choices.selections.find(value => value.selectionKey === item.selectionKey)
  const editable = batch.source.kind === 'generation' && batch.source.inputKind === 'planning-material'
  const edit = choices.edits?.find(value => value.selectionKey === item.selectionKey)
  const updateField = (field: string, value: string) => {
    const changed = { ...edit?.fields } as Record<string, string>
    if (value === (item.fields[field as keyof typeof item.fields] ?? '')) delete changed[field]
    else changed[field] = value
    const edits = (choices.edits ?? []).filter(value => value.selectionKey !== item.selectionKey)
    if (Object.keys(changed).length) edits.push({ selectionKey: item.selectionKey, fields: changed })
    onChange({ ...choices, edits })
  }
  return <div className="block space-y-1" key={item.selectionKey}>
    <span>{item.fields.name} · {roleLabel(item.fields.role) ?? text('角色候选', 'Character candidate')}</span>
    <span className="block text-xs text-[var(--color-text-secondary)]">{item.fields.background || item.sourceId}</span>
    <NativeSelect aria-label={text(`采用方式：${item.fields.name} · ${item.selectionKey}`, `Adoption: ${item.fields.name} · ${item.selectionKey}`)} disabled={disabled || batch.status !== 'pending-approval'}
      value={choice?.action === 'map' ? `map:${choice.characterId}` : choice?.action ?? 'keep-unresolved'}
      onChange={event => {
        const value = event.target.value
        const selection = value.startsWith('map:')
          ? { selectionKey: item.selectionKey, action: 'map' as const, characterId: value.slice(4) }
          : { selectionKey: item.selectionKey, action: value === 'create' ? 'create' as const
            : value === 'functional' ? 'functional' as const : 'keep-unresolved' as const }
        const selections = choices.selections.filter(current => current.selectionKey !== item.selectionKey).concat(selection)
        const adopted = new Set(selections.filter(current => isAdoptedCharacterDecision(current.action)).map(current => current.selectionKey))
        onChange({ ...choices, selections,
          edits: isAdoptedCharacterDecision(selection.action) ? choices.edits : choices.edits?.filter(edit => edit.selectionKey !== item.selectionKey),
          // Drop a proposal-derived edge only when one of its two candidate endpoints stops
          // being adopted. An author-declared edge from an existing card has no selection key
          // and must survive: it was not derived from this batch.
          relationships: choices.relationships.filter(relation => relation.sourceSelectionKey === undefined
            || (!!relation.targetSelectionKey && adopted.has(relation.sourceSelectionKey) && adopted.has(relation.targetSelectionKey))) })
      }}>
      <option value="keep-unresolved">{text('暂不采用，保留候选', 'Keep unresolved')}</option>
      <option value="create">{text('新建独立角色', 'Create a separate character')}</option>
      <option value="functional">{text('登记为锚点人物，不建卡', 'Register as anchored supporting role (no card)')}</option>
      {identities.map(identity => <option key={identity.characterId} value={`map:${identity.characterId}`}>{identity.name} · {roleLabel(identity.role) ?? ''} · {identity.characterId.slice(-8)}</option>)}
    </NativeSelect>
    {editable && isAdoptedCharacterDecision(choice?.action ?? 'keep-unresolved') && <details className="text-xs" onClick={event => event.stopPropagation()}>
      <summary className="cursor-pointer">{text('编辑导入候选', 'Edit imported candidate')}</summary>
      <div className="grid grid-cols-1 gap-2 pt-2">
        {editableFields.map(([field, zh, en]) => <label key={field} className="grid gap-1">
          <span>{text(zh, en)}</span>
          <input aria-label={text(`编辑候选${zh}：${item.selectionKey}`, `Edit candidate ${en}: ${item.selectionKey}`)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1"
            disabled={disabled || batch.status !== 'pending-approval'}
            value={edit?.fields[field] ?? item.fields[field] ?? ''}
            onChange={event => updateField(field, event.target.value)} />
        </label>)}
        <label className="grid gap-1"><span>{text('角色定位', 'Role')}</span>
          <NativeSelect aria-label={text(`编辑候选角色定位：${item.selectionKey}`, `Edit candidate role: ${item.selectionKey}`)}
            disabled={disabled || batch.status !== 'pending-approval'} value={edit?.fields.role ?? item.fields.role ?? ''}
            onChange={event => updateField('role', event.target.value)}>
            {!item.fields.role && !edit?.fields.role && <option value="" disabled>{text('未指定', 'Unspecified')}</option>}
            {CHARACTER_ROLES.map(role => { const label = getCharacterRoleLabels(role); return <option key={role} value={role}>{text(label.zhCN, label.enUS)}</option> })}
          </NativeSelect>
        </label>
      </div>
    </details>}
  </div>
}

/**
 * One proposed edge, with the author's three-way choice.
 *
 * The default is always 暂不采用: a proposal is a suggestion, never permission. `blueprint-pending`
 * records the target as a character the blueprint will need, without pretending a card exists —
 * that marker later feeds the P1 candidate set instead of silently dropping the edge.
 */
function RelationshipBinding({ relation, batch, identities, choices, onChange, disabled }: {
  relation: { sourceSelectionKey: string; targetSelectionKey?: string; targetName?: string; relation: string }
  batch: CharacterProposalBatch
  identities: Array<{ characterId: string; name: string; role?: string }>
  choices: CharacterProposalChoices
  onChange(choices: CharacterProposalChoices): void
  disabled: boolean
}) {
  const text = useLocaleStore(state => state.text)
  const blocked = disabled || batch.status !== 'pending-approval'
  const sourceName = batch.items.find(item => item.selectionKey === relation.sourceSelectionKey)?.fields.name ?? relation.sourceSelectionKey
  const targetName = batch.items.find(item => item.selectionKey === relation.targetSelectionKey)?.fields.name ?? relation.targetName ?? text('未知目标', 'Unknown target')
  /**
   * 目标端点有两种合法形态（主进程合同：source / target 各二选一，见
   * `electron/services/character-proposal-service.ts` 的关系校验）：
   * - `targetSelectionKey`：目标是本批候选（之后新建或映射到已有卡）；
   * - `targetCharacterId`：目标就是名册里**已有**的卡。
   *
   * 此前只要 `targetSelectionKey` 为空就整行禁用（`disabled={… || !relation.targetSelectionKey}`），
   * 于是「候选 → 已有卡」的提议（以及纯已有角色之间的关系）显示成灰掉的「暂不采用」，
   * 连原因都不写。现在按名字在名册里唯一命中时，直接给出「采用到已有角色卡」这一项。
   */
  const matchedTargets = relation.targetSelectionKey
    ? []
    : identities.filter(identity => identity.name === relation.targetName)
  const existingTargetId = matchedTargets.length === 1 ? matchedTargets[0].characterId : undefined
  const ambiguousTarget = matchedTargets.length > 1
  const targetKey = relation.targetSelectionKey ?? existingTargetId
  const keyOf = (source: string | undefined, target: string | undefined, edge: string) =>
    JSON.stringify([source, target, edge])
  const proposalKey = keyOf(relation.sourceSelectionKey, targetKey, relation.relation)
  const adopted = choices.relationships.find(value => keyOf(
    value.sourceSelectionKey ?? value.sourceCharacterId,
    value.targetSelectionKey ?? value.targetCharacterId,
    value.relation,
  ) === proposalKey)
  const pendingKey = JSON.stringify(['blueprint-pending', relation.sourceSelectionKey, relation.targetName])
  const marked = choices.blueprintPendingRelations?.some(value => JSON.stringify(['blueprint-pending', value.sourceSelectionKey, value.targetName]) === pendingKey) ?? false
  // 关系只能在"会产生角色"的端点之间成立（主进程同规则校验）：暂不采用/功能配角没有卡，
  // 边无处可写 —— 选项必须随当前决策收窄，否则作者一保存就炸。
  const decisionOf = (key: string | undefined) => key ? choices.selections.find(item => item.selectionKey === key)?.action : undefined
  const sourceAdopted = isAdoptedCharacterDecision(decisionOf(relation.sourceSelectionKey) ?? 'keep-unresolved')
  const targetAdopted = relation.targetSelectionKey
    ? isAdoptedCharacterDecision(decisionOf(relation.targetSelectionKey) ?? 'keep-unresolved')
    // 已命中名册的卡本身就有卡，无需再"采用"。
    : Boolean(existingTargetId)
  const endpointsAdopted = sourceAdopted && targetAdopted
  const mode = adopted
    ? (adopted.targetCharacterId ? `bind:${adopted.targetCharacterId}` : 'adopt')
    : marked ? 'blueprint-pending' : 'skip'
  const replace = (next: CharacterProposalRelationshipChoice | null, nextMarked: boolean) => onChange({ ...choices,
    relationships: choices.relationships.filter(value => keyOf(
      value.sourceSelectionKey ?? value.sourceCharacterId,
      value.targetSelectionKey ?? value.targetCharacterId,
      value.relation,
    ) !== proposalKey).concat(next ? [next] : []),
    blueprintPendingRelations: (choices.blueprintPendingRelations ?? []).filter(value => JSON.stringify(['blueprint-pending', value.sourceSelectionKey, value.targetName]) !== pendingKey)
      .concat(nextMarked ? [{ sourceSelectionKey: relation.sourceSelectionKey, targetName: relation.targetName ?? targetName }] : []) })
  return <div className="flex flex-wrap items-center gap-2 text-xs">
    <span className="min-w-0 flex-1 truncate">{sourceName} → {targetName}：{relation.relation}</span>
    <NativeSelect aria-label={text(`关系处理：${sourceName} → ${targetName}`, `Relationship: ${sourceName} → ${targetName}`)}
      disabled={blocked || !sourceName || ambiguousTarget} value={mode}
      onChange={event => {
        const value = event.target.value
        if (value === 'skip') return replace(null, false)
        if (value === 'blueprint-pending') return replace(null, true)
        if (value === 'adopt') return endpointsAdopted && relation.targetSelectionKey
          ? replace({ sourceSelectionKey: relation.sourceSelectionKey, targetSelectionKey: relation.targetSelectionKey, relation: relation.relation }, false)
          : replace(null, false)
        replace({ sourceSelectionKey: relation.sourceSelectionKey, targetCharacterId: value.slice(5), relation: relation.relation }, false)
      }}>
      <option value="skip">{text('暂不采用', 'Do not adopt')}</option>
      {relation.targetSelectionKey && endpointsAdopted && <option value="adopt">{text('采用这条关系', 'Adopt this relationship')}</option>}
      {existingTargetId && <option value={`bind:${existingTargetId}`}>
        {text(`采用到已有角色卡：${targetName}`, `Adopt onto the existing card: ${targetName}`)}
      </option>}
      <option value="blueprint-pending">{text('标记为「蓝图待建角色」', 'Mark as a blueprint-pending character')}</option>
      {identities.filter(identity => identity.characterId !== existingTargetId).map(identity => <option key={identity.characterId} value={`bind:${identity.characterId}`}>{text('绑定到已有角色卡：', 'Bind to an existing card: ')}{identity.name}</option>)}
    </NativeSelect>
    {ambiguousTarget && <span className="w-full text-[var(--color-text-secondary)]">
      {text('名册里有多个同名角色，无法自动判定目标；请用下方「同时为已有角色添加边」手填。', 'Several cards share that name, so the target is ambiguous; add the edge manually below.')}
    </span>}
    {!ambiguousTarget && targetKey && !endpointsAdopted && <span className="w-full text-[var(--color-text-secondary)]">
      {text('关系两端都需「新建」或「采用到已有角色」才能写入；当前有一端是暂不采用/功能配角（没有卡，关系无处可写）。', 'Both ends must create or adopt a character; one end is unresolved or an anchored supporting role, so the edge has nowhere to be written.')}
    </span>}
  </div>
}

/**
 * Author-declared outgoing edges from cards that already exist. Off by default: checking the box
 * only reveals an editor, and the wording is free text the author writes. Nothing is mirrored —
 * the reverse edge stays a separate decision on the target card's own page.
 */
function ExistingSourceRelations({ identities, choices, onChange, disabled }: {
  identities: Array<{ characterId: string; name: string; role?: string }>
  choices: CharacterProposalChoices
  onChange(choices: CharacterProposalChoices): void
  disabled: boolean
}) {
  const text = useLocaleStore(state => state.text)
  /** Author-declared rows, addressed by position in this list — not in the full relationships array. */
  const rows = choices.relationships.filter(value => Boolean(value.sourceCharacterId))
  const [draft, setDraft] = useState({ sourceCharacterId: '', targetCharacterId: '', relation: '' })

  /** Rewrites only the author-declared rows, leaving every proposal-derived edge untouched. */
  const commit = (next: typeof rows) => onChange({ ...choices,
    relationships: [...choices.relationships.filter(value => !value.sourceCharacterId), ...next] })
  const update = (index: number, patch: Partial<(typeof rows)[number]>) =>
    commit(rows.map((value, current) => current === index ? { ...value, ...patch } : value))

  const patchDraft = (next: Partial<typeof draft>) => {
    setDraft({ ...draft, ...next })
    // The row already exists as soon as both endpoints are chosen; the text field edits it live
    // so a half-typed relation is never committed as a blank edge.
    const merged = { ...draft, ...next }
    const complete = merged.sourceCharacterId && merged.targetCharacterId
    const withoutDraft = rows.filter(value => !(value.sourceCharacterId === draft.sourceCharacterId && value.targetCharacterId === draft.targetCharacterId))
    commit(complete ? [...withoutDraft, merged] : withoutDraft)
  }
  return <details className="text-xs">
    <summary className="cursor-pointer">{text('同时为已有角色添加出边', 'Also add an outgoing edge from an existing character')}</summary>
    <div className="grid gap-2 pt-2">
      <p className="text-[var(--color-text-secondary)]">{text('仅写入你在此填写的方向；反向关系请到那张卡上单独决定。', 'Only the direction you fill in here is written; decide the reverse edge on that card separately.')}</p>
      {rows.map((row, index) => <div className="flex flex-wrap items-center gap-2" key={index}>
        <NativeSelect aria-label={text('起点角色', 'Source character')} disabled={disabled} value={row.sourceCharacterId ?? ''}
          onChange={event => update(index, { sourceCharacterId: event.target.value })}>
          {identities.map(identity => <option key={identity.characterId} value={identity.characterId}>{identity.name}</option>)}
        </NativeSelect>
        <span>→</span>
        <NativeSelect aria-label={text('目标角色', 'Target character')} disabled={disabled} value={row.targetCharacterId ?? ''}
          onChange={event => update(index, { targetCharacterId: event.target.value })}>
          {identities.map(identity => <option key={identity.characterId} value={identity.characterId}>{identity.name}</option>)}
        </NativeSelect>
        <input aria-label={text('关系', 'Relationship')} disabled={disabled} placeholder={text('关系（由你填写）', 'Relationship (you write it)')}
          className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1"
          value={row.relation} onChange={event => update(index, { relation: event.target.value })} />
        <button type="button" className="text-[var(--color-text-secondary)]" disabled={disabled}
          onClick={() => commit(rows.filter((_, current) => current !== index))}>
          {text('移除', 'Remove')}
        </button>
      </div>)}
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label={text('新增起点角色', 'New source character')} disabled={disabled} value={draft.sourceCharacterId}
          onChange={event => patchDraft({ sourceCharacterId: event.target.value })}>
          <option value="">{text('选择起点角色', 'Choose a source')}</option>
          {identities.map(identity => <option key={identity.characterId} value={identity.characterId}>{identity.name}</option>)}
        </NativeSelect>
        <span>→</span>
        <NativeSelect aria-label={text('新增目标角色', 'New target character')} disabled={disabled} value={draft.targetCharacterId}
          onChange={event => patchDraft({ targetCharacterId: event.target.value })}>
          <option value="">{text('选择目标角色', 'Choose a target')}</option>
          {identities.map(identity => <option key={identity.characterId} value={identity.characterId}>{identity.name}</option>)}
        </NativeSelect>
        <input aria-label={text('新增关系', 'New relationship')} disabled={disabled} placeholder={text('关系（由你填写）', 'Relationship (you write it)')}
          className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1"
          value={draft.relation} onChange={event => patchDraft({ relation: event.target.value })} />
      </div>
      <p className="text-[var(--color-text-secondary)]">{text('蓝图待建角色请先在候选区采用或新建，再回到这里连接。', 'For a blueprint-pending character, adopt or create it above first, then connect it here.')}</p>
    </div>
  </details>
}
