import { useMemo, useState } from 'react'

import type { CharacterProposalBatch } from '../../shared/character-proposal'
import type { CharacterRosterEntry } from '../../shared/character-roster'
import {
  REGENERATION_ROLLBACK_FIELDS,
  REGENERATION_STRATEGIES,
  REGENERATION_STRATEGY_LABELS,
  applyRegenerationStrategy,
  buildRegenerationDiff,
  listRegenerationDiffs,
  regenerationFieldLabel,
  regenerationGroupLabel,
  summarizeRegenerationCoverage,
  type RegenerationFieldDiff,
  type RegenerationRollbackField,
  type RegenerationStrategy,
} from '../../shared/character-regeneration-diff'
import type { CharacterProposalChoices } from '../../services/character-proposal-choices'
import { characterRosterEntryFromCard } from '../../services/character-roster-client'
import { useCharacterStore } from '../../stores/character-store'
import { useLocaleStore } from '../../stores/locale-store'

/**
 * C1-b 对比屏：**字段级并排 + 三选一 + 覆盖后逐字段回退入口**（设计稿 §4）。
 *
 * 三条自我约束：
 * 1. 只显示、不改决策类型 —— 三选一改的是 `selections`（`onChange` 回灌），没有第五种决策；
 * 2. 差异只按「去空白后不等」高亮，不做逐字 diff；
 * 3. 回退入口只在**快照可用**时出现：功能上线前的旧批次没有快照行，这里连按钮都不渲染，
 *    桌面仍可读到只读差异（判据 J8）。
 */
export interface CharacterRegenerationDiffPanelProps {
  batch: CharacterProposalBatch
  /** 当前名册（含 currentState / relationships）：没有它就没有「现值」可比。 */
  entries?: readonly CharacterRosterEntry[]
  choices: CharacterProposalChoices
  onChange: (next: CharacterProposalChoices) => void
  disabled?: boolean
  /** 该批是否写下了快照（旧批次为 false）。 */
  snapshotAvailable?: boolean
  onRollbackField?: (characterId: string, field: RegenerationRollbackField) => void
}

const ROLLBACKABLE = new Set<string>(REGENERATION_ROLLBACK_FIELDS)

export function CharacterRegenerationDiffPanel({
  batch, entries, choices, onChange, disabled = false, snapshotAvailable = false, onRollbackField,
}: CharacterRegenerationDiffPanelProps) {
  const locale = useLocaleStore(state => state.locale)
  const english = locale === 'en-US'
  // 现值默认取渲染层角色的当前状态（同一份 roster seam 的产物）；测试可显式注入。
  const cards = useCharacterStore(state => state.characters)
  const storeEntries = useMemo(() => cards.map(characterRosterEntryFromCard), [cards])
  const rosterEntries = entries ?? storeEntries
  const [strategy, setStrategy] = useState<RegenerationStrategy>('overwrite-all')
  const diffs = useMemo(() => listRegenerationDiffs(batch, rosterEntries), [batch, rosterEntries])
  const coverage = useMemo(() => summarizeRegenerationCoverage(batch, rosterEntries), [batch, rosterEntries])

  if (!diffs.length) return null

  const label = (value: { zhCN: string; enUS: string }) => (english ? value.enUS : value.zhCN)
  const choose = (next: RegenerationStrategy) => {
    setStrategy(next)
    onChange({ ...choices, selections: applyRegenerationStrategy(batch, choices.selections, next) })
  }
  const diffLabel = (field: RegenerationFieldDiff) => {
    if (field.status === 'candidate-empty') return english ? 'candidate empty · keep current' : '候选为空·保留现值'
    if (field.group === 'currentState') return english ? 'read only · kept when candidate has none' : '只读展示·候选不提供时保留现值'
    return ''
  }

  return (
    <section className="mt-2 rounded border border-slate-300 p-2 text-xs dark:border-slate-600" aria-label={english ? 'Regeneration field diff' : '重生成字段对比'}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {english
            ? `This rebuild overwrites ${coverage.sameNameCount} same-name card(s)`
            : `本次重建会覆盖 ${coverage.sameNameCount} 张同名卡`}
        </span>
        <span className={coverage.differentCount ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500'}>
          {english ? `${coverage.differentCount} with substantive differences` : `其中 ${coverage.differentCount} 张有实质差异`}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label={english ? 'Rebuild strategy' : '重建策略'}>
        {REGENERATION_STRATEGIES.map(item => {
          const text = label(REGENERATION_STRATEGY_LABELS[item])
          // M=0 时「全部覆盖」降级为一句反问：没有差异还点下去，作者需要知道自己点的是什么。
          const caption = item === 'overwrite-all' && coverage.differentCount === 0
            ? (english ? 'No differences, overwrite anyway?' : '无差异，仍要覆盖？')
            : text
          return (
            <button key={item} type="button" disabled={disabled} aria-pressed={strategy === item}
              aria-label={`${english ? 'Rebuild strategy' : '重建策略'}：${text}`}
              onClick={() => choose(item)}
              className={`rounded border px-2 py-0.5 ${strategy === item
                ? 'border-sky-500 bg-sky-50 font-semibold dark:bg-sky-900/40'
                : 'border-slate-300 dark:border-slate-600'}`}>
              {caption}
            </button>
          )
        })}
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {diffs.map(({ item, entry, diff }) => {
          const cardLabel = entry.name || item.fields.name
          return (
            <details key={item.selectionKey} open className="rounded border border-slate-200 dark:border-slate-700">
              <summary className="cursor-pointer px-2 py-1 font-semibold">
                {english ? `Overwrites “${cardLabel}”` : `覆盖「${cardLabel}」`}
                <span className="ml-2 font-normal text-slate-500">
                  {diff.differentFieldCount
                    ? (english ? `${diff.differentFieldCount} field(s) differ` : `${diff.differentFieldCount} 处字段不同`)
                    : (english ? 'no difference' : '无差异')}
                </span>
              </summary>
              <div className="space-y-1 p-2">
                {diff.rows.map(row => (
                  <div key={row.group}>
                    <div className="text-slate-400">{label(regenerationGroupLabel(row.group))}</div>
                    {row.fields.map(field => {
                      const fieldLabel = label(regenerationFieldLabel(field.field))
                      const canRollback = field.status === 'changed' && snapshotAvailable && Boolean(onRollbackField)
                        && ROLLBACKABLE.has(field.field)
                      return (
                        <div key={field.field} data-diff={field.status} data-field={field.field}
                          className={`grid grid-cols-[7rem_1fr_1fr_auto] items-start gap-2 border-b border-dashed border-slate-200 py-0.5 dark:border-slate-700 ${field.status === 'changed' ? 'text-amber-800 dark:text-amber-200' : 'text-slate-500'}`}>
                          <span>{field.status === 'changed' ? '● ' : ''}{fieldLabel}</span>
                          <span className="whitespace-pre-wrap break-all">{field.oldText || '—'}</span>
                          <span className="whitespace-pre-wrap break-all">
                            {field.status === 'candidate-empty' ? diffLabel(field) : (field.newText || '—')}
                            {field.sentences && field.sentences.rewritten.length > 0 && (
                              <span className="mt-0.5 block text-slate-500">
                                {(english ? 'rewritten: ' : '改写：')}{field.sentences.rewritten.map(pair => `${pair.from} → ${pair.to}`).join('；')}
                              </span>
                            )}
                            {field.sentences && field.sentences.added.length > 0 && (
                              <span className="mt-0.5 block text-emerald-700 dark:text-emerald-300">
                                {(english ? 'added: ' : '新增：')}{field.sentences.added.join(' ')}
                              </span>
                            )}
                            {field.sentences && field.sentences.removed.length > 0 && (
                              <span className="mt-0.5 block text-rose-700 dark:text-rose-300">
                                {(english ? 'removed: ' : '删除：')}{field.sentences.removed.join(' ')}
                              </span>
                            )}
                            {field.relationship && (
                              <span className="mt-0.5 block text-slate-500">
                                {field.relationship.kind === 'added' ? (english ? 'new edge' : '新增关系')
                                  : field.relationship.kind === 'removed' ? (english ? 'edge gone' : '关系消失')
                                    : (english ? 'relation wording changed' : '关系词变化')}
                                ：{field.relationship.target}
                              </span>
                            )}
                          </span>
                          {canRollback && field.field !== 'name' && field.field !== 'role' && (
                            <button type="button" disabled={disabled}
                              aria-label={`${english ? 'Roll back field' : '回退这一字段'}：${fieldLabel}`}
                              onClick={() => onRollbackField?.(entry.characterId ?? '', field.field as RegenerationRollbackField)}
                              className="rounded border border-slate-300 px-1.5 dark:border-slate-600">
                              {english ? 'Roll back this field' : '回退这一字段'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}

/** 供面板外复用：一个批次、任意名册快照下的完整差异（测试与调试用）。 */
export { buildRegenerationDiff }
