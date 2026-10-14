import { useState } from 'react'
import type { CharacterProposalBatch } from '../../shared/character-proposal'
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
  // 角色定位按当前语言显示中文（主角、配角…），不再把 protagonist/supporting 直接给作者看。
  const roleLabel = (role: string | undefined) => {
    if (!role) return undefined
    const label = getCharacterRoleLabels(role)
    return text(label.zhCN, label.enUS)
  }
  if (choices.proposalBatchId !== batch.proposalBatchId || choices.revision !== batch.revision) return <p role="alert">{text('提议已改变，请重新载入选择。', 'The proposals changed. Reload the choices.')}</p>
  const relations = batch.items.flatMap(item => item.relationships.map(relation => {
    const matches = batch.items.filter(candidate => candidate.fields.name === relation.targetName)
    return { sourceSelectionKey: item.selectionKey,
      targetSelectionKey: relation.targetSelectionKey ?? (matches.length === 1 ? matches[0].selectionKey : undefined),
      targetName: relation.targetName, relation: relation.relation }
  }))
  return <section className="space-y-3" aria-label={text('批量选择角色采用方式', 'Choose character adoption in one batch')}>
    <p className="text-xs text-[var(--color-text-secondary)]">{text('同名或共享别名不会自动合并。可选择对应角色、新建或暂不采用；最后一次确认统一保存。', 'Matching names or shared aliases are not merged automatically. Choose a character, create one, or keep unresolved, then confirm the batch once.')}</p>
    {batch.items.map(item => {
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
              : { selectionKey: item.selectionKey, action: value === 'create' ? 'create' as const : 'keep-unresolved' as const }
            const selections = choices.selections.filter(current => current.selectionKey !== item.selectionKey).concat(selection)
            const adopted = new Set(selections.filter(current => current.action !== 'keep-unresolved').map(current => current.selectionKey))
            onChange({ ...choices, selections,
              edits: selection.action === 'keep-unresolved' ? choices.edits?.filter(edit => edit.selectionKey !== item.selectionKey) : choices.edits,
              // Drop a proposal-derived edge only when one of its two candidate endpoints stops
              // being adopted. An author-declared edge from an existing card has no selection key
              // and must survive: it was not derived from this batch.
              relationships: choices.relationships.filter(relation => relation.sourceSelectionKey === undefined
                || (!!relation.targetSelectionKey && adopted.has(relation.sourceSelectionKey) && adopted.has(relation.targetSelectionKey))) })
          }}>
          <option value="keep-unresolved">{text('暂不采用，保留候选', 'Keep unresolved')}</option>
          <option value="create">{text('新建独立角色', 'Create a separate character')}</option>
          {identities.map(identity => <option key={identity.characterId} value={`map:${identity.characterId}`}>{identity.name} · {roleLabel(identity.role) ?? ''} · {identity.characterId.slice(-8)}</option>)}
        </NativeSelect>
        {editable && choice?.action !== 'keep-unresolved' && <details className="text-xs" onClick={event => event.stopPropagation()}>
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
    })}
    {relations.map((relation, index) => <RelationshipBinding key={`${relation.sourceSelectionKey}:${relation.targetSelectionKey ?? relation.targetName}:${index}`}
      relation={relation} batch={batch} identities={identities} choices={choices} onChange={onChange} disabled={disabled} />)}
    <ExistingSourceRelations identities={identities} choices={choices} onChange={onChange}
      disabled={disabled || batch.status !== 'pending-approval'} />
  </section>
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
  const key = (value: CharacterProposalRelationshipChoice) => JSON.stringify([value.sourceSelectionKey ?? value.sourceCharacterId, value.targetSelectionKey ?? value.targetCharacterId, value.relation])
  const adopted = choices.relationships.find(value => key(value) === key({ sourceSelectionKey: relation.sourceSelectionKey, targetSelectionKey: relation.targetSelectionKey, relation: relation.relation }))
  const pendingKey = JSON.stringify(['blueprint-pending', relation.sourceSelectionKey, relation.targetName])
  const marked = choices.blueprintPendingRelations?.some(value => JSON.stringify(['blueprint-pending', value.sourceSelectionKey, value.targetName]) === pendingKey) ?? false
  const mode = adopted?.targetCharacterId ? `bind:${adopted.targetCharacterId}` : adopted ? 'adopt' : marked ? 'blueprint-pending' : 'skip'
  const replace = (next: CharacterProposalRelationshipChoice | null, nextMarked: boolean) => onChange({ ...choices,
    relationships: choices.relationships.filter(value => key(value) !== key({ sourceSelectionKey: relation.sourceSelectionKey, targetSelectionKey: relation.targetSelectionKey, relation: relation.relation })).concat(next ? [next] : []),
    blueprintPendingRelations: (choices.blueprintPendingRelations ?? []).filter(value => JSON.stringify(['blueprint-pending', value.sourceSelectionKey, value.targetName]) !== pendingKey)
      .concat(nextMarked ? [{ sourceSelectionKey: relation.sourceSelectionKey, targetName: relation.targetName ?? targetName }] : []) })
  return <div className="flex flex-wrap items-center gap-2 text-xs">
    <span className="min-w-0 flex-1 truncate">{sourceName} → {targetName}：{relation.relation}</span>
    <NativeSelect aria-label={text(`关系处理：${sourceName} → ${targetName}`, `Relationship: ${sourceName} → ${targetName}`)}
      disabled={blocked || !relation.targetSelectionKey || !sourceName} value={mode}
      onChange={event => {
        const value = event.target.value
        if (value === 'skip') return replace(null, false)
        if (value === 'blueprint-pending') return replace(null, true)
        if (value === 'adopt') return replace({ sourceSelectionKey: relation.sourceSelectionKey, targetSelectionKey: relation.targetSelectionKey, relation: relation.relation }, false)
        replace({ sourceSelectionKey: relation.sourceSelectionKey, targetCharacterId: value.slice(5), relation: relation.relation }, false)
      }}>
      <option value="skip">{text('暂不采用', 'Do not adopt')}</option>
      {relation.targetSelectionKey && <option value="adopt">{text('采用这条关系', 'Adopt this relationship')}</option>}
      <option value="blueprint-pending">{text('标记为「蓝图待建角色」', 'Mark as a blueprint-pending character')}</option>
      {identities.map(identity => <option key={identity.characterId} value={`bind:${identity.characterId}`}>{text('绑定到已有角色卡：', 'Bind to an existing card: ')}{identity.name}</option>)}
    </NativeSelect>
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
