import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'

import type { InvalidationPlan } from '../../shared/invalidation-plan'
import type { UpstreamDomain } from '../../shared/upstream-revisions'
import { useLocaleStore } from '../../stores/locale-store'
import { INVALIDATION_GROUP_LABEL, upstreamDomainLabel } from '../invalidation-labels'
import { Button } from '../ui/Button'

/**
 * 失效清单强提醒（P2-3 期 3a · S3）：重建/续写之前把 blast radius 摆出来。
 *
 * ## 为什么不是一句「影响较大」
 *
 * 主稿 §八 定死的口径：给**可数清单**。作者要能在点下去之前自己判断代价，模糊副词
 * 起不到这个作用，而且第三次出现之后就会被盲点确定。
 *
 * ## 三档密度由 `plan.tier` 决定，本组件不重算
 *
 * 强度背后是「后果能不能撤销」这种业务判断（交接单会被拒绝读取 = 下一卷开不了工）。
 * 它属于后端，UI 自己算等于把强度变成样式选择 —— 两边迟早不一致。
 *
 * ## `scopeNote` 为什么由调用方给
 *
 * 「世界观变更影响全书设定」和「推荐下游全部重新生成」是两回事，判据在调用方
 * （它知道这次动的是哪个域）。组件只负责摆出来，这样它才能单独测。
 */
const GROUP_LABEL = INVALIDATION_GROUP_LABEL

/**
 * 受影响的章数。**有一项覆盖全书时返回 `null`** —— 那时说不出一个数字，
 * 硬给一个（比如「共 0 章」）比不显示更糟。
 */
function countAffectedChapters(plan: InvalidationPlan): number | null {
  const chapters = new Set<number>()
  for (const group of plan.groups) {
    for (const item of group.items) {
      if (!item.chapters || item.chapters.length === 0) return null
      for (const chapter of item.chapters) chapters.add(chapter)
    }
  }
  return chapters.size
}

/**
 * **已定稿正文**受影响的章数（S6 / M28）。
 *
 * 单独算而不是复用 `countAffectedChapters`：勾选那一句说的是「我明白这会波及 N 章
 * **已定稿**内容」，而在 S6 之前那个 N 其实是「所有受影响章」—— 交接单触发的
 * strong、一张已定稿章都没有时，那句「已定稿内容」是**假的**。有了 `finalized`
 * 组之后才有真实判据，这一句才算说得准。
 */
function countFinalizedChapters(plan: InvalidationPlan): number {
  const chapters = new Set<number>()
  for (const group of plan.groups) {
    if (group.kind !== 'finalized') continue
    for (const item of group.items) {
      for (const chapter of item.chapters ?? []) chapters.add(chapter)
    }
  }
  return chapters.size
}

/**
 * 影响范围一句话（主稿 §十·2 ④，必写）。
 *
 * 主稿列了四种情形。前三档（世界观 / 弧光 / 说得出章号）一直能判；
 * 第四档「卷回滚要逐层列出」在 S6 之前判不出来 —— 请求里只有域名、没有动作。
 * 现在 `plan.reason` 带着这次改动的来由，`rollback` 时前置一句**级联顺序**：
 * 回滚真正的危险不是「范围大」，而是作者容易从最下游（正文）开始返工，
 * 而正确的起点永远是最上游。
 *
 * 回滚**不等于**「全书」：章号收得出来就照旧附上，不要因为「这是回滚」就退化成
 * 「影响范围难以精确判定」—— 那会让一份精确的清单被一句模糊话盖掉。
 */
export function buildInvalidationScopeNote(
  plan: InvalidationPlan,
  domain: UpstreamDomain,
  locale: 'zh-CN' | 'en-US',
): string {
  const en = locale === 'en-US'
  const rollback = plan.reason === 'rollback'
    ? (en
      ? 'A rollback cascades downward: outline → chapter blueprints → volume handoffs → finalized prose; re-check each layer in that order. '
      : '这是回滚，影响逐层往下传：大纲 → 章节蓝图 → 卷末交接单 → 已定稿正文，按这个顺序重新确认。')
    : ''
  if (domain === 'worldbuilding') {
    return `${rollback}${en ? 'A worldbuilding change affects settings across the whole book.' : '世界观变更影响全书设定'}`
  }
  if (domain === 'arc') {
    return `${rollback}${en ? 'An arc change affects arrangements across the whole book.' : '弧光变更影响全书安排'}`
  }
  const chapters = new Set<number>()
  let wholeBook = false
  for (const group of plan.groups) {
    for (const item of group.items) {
      if (!item.chapters || item.chapters.length === 0) { wholeBook = true; continue }
      for (const chapter of item.chapters) chapters.add(chapter)
    }
  }
  if (!wholeBook && chapters.size > 0) {
    const sorted = [...chapters].sort((left, right) => left - right)
    return `${rollback}${en
      ? `Affected chapters: ${sorted.join(', ')}`
      : `影响章节：${sorted.join('、')}`}`
  }
  return `${rollback}${en
    ? 'The affected range cannot be determined precisely; regenerating all downstream items is recommended.'
    : '影响范围难以精确判定，推荐下游全部重新生成'}`
}

export default function InvalidationPlanGatePanel({
  plan,
  domain,
  onProceed,
  onDismiss,
}: {
  plan: InvalidationPlan
  /** 本次要动的上游域 —— 决定「影响范围」那一行的口径。 */
  domain: UpstreamDomain
  onProceed: () => void
  onDismiss: () => void
}) {
  const locale = useLocaleStore(state => state.locale)
  const text = useLocaleStore(state => state.text)
  const [acknowledged, setAcknowledged] = useState(false)

  const affected = countAffectedChapters(plan)
  const finalizedChapters = countFinalizedChapters(plan)
  const needsAck = plan.tier === 'strong'
  const scopeNote = buildInvalidationScopeNote(plan, domain, locale)
  // 施工图 S3：strong 档未勾选时主按钮 disabled。不能改成「点一下再弹二次确认」——
  // 那只是把同一件事多做一次，作者照样不看。
  const blocked = needsAck && !acknowledged

  return (
    <section
      aria-label={text('失效清单确认', 'Invalidation preview')}
      data-testid="invalidation-gate"
      className="rounded-md border px-3 py-3 space-y-3"
      style={{ borderColor: needsAck ? 'var(--color-danger)' : 'var(--color-warning)' }}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert
          size={16}
          className="mt-0.5 flex-shrink-0"
          style={{ color: needsAck ? 'var(--color-danger)' : 'var(--color-warning)' }}
          aria-hidden="true"
        />
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {text('这次改动会让下面这些派生作废', 'This change invalidates the derived items below')}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {needsAck
              ? text(
                '其中含卷末交接单：它会被拒绝读取，下一卷会开不了工。这一步不能回头。',
                'It includes volume handoffs: those are rejected on read, so the next volume cannot start. This step cannot be undone.',
              )
              : text(
                '蓝色清单里的项需要重新生成；现有内容不会立刻消失，但已不再反映新的上游。',
                'The listed items need regeneration; existing content stays but no longer reflects the new upstream.',
              )}
          </p>
        </div>
      </div>

      {/* ---- 影响范围一行（主稿 §十·2 ④，必写） ---- */}
      {scopeNote && (
        <p data-testid="invalidation-scope" className="text-xs">{scopeNote}</p>
      )}

      {/* ---- 可数清单 ---- */}
      <ul data-testid="invalidation-groups" className="space-y-2 text-xs">
        {plan.groups.map(group => {
          const [label, labelEn] = GROUP_LABEL[group.kind]
          return (
            <li key={group.kind} className="space-y-1">
              <p className="font-medium">{text(`${label}（${group.count}）`, `${labelEn} (${group.count})`)}</p>
              <ul className="list-disc pl-5 space-y-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {group.items.map(item => (
                  <li key={`${group.kind}:${item.label}`}>
                    <span style={{ color: 'var(--color-text)' }}>{item.label}</span>
                    {item.behind.length > 0 && (
                      <> · {item.behind.map((drift, index) => {
                        const name = upstreamDomainLabel(drift.key, locale)
                        return (
                          <span key={drift.key}>
                            {index > 0 ? text('、', ', ') : ''}
                            {locale === 'en-US'
                              ? `${name} ${drift.have}→${drift.need}`
                              : `${name} ${drift.have} → ${drift.need}`}
                          </span>
                        )
                      })}</>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>

      {/* ---- 看不见的那部分必须单独出现（主稿 §9.2） ---- */}
      {plan.unseen.count > 0 && (
        <p data-testid="invalidation-unseen" className="text-xs" style={{ color: 'var(--color-warning-text)' }}>
          {text(
            `另有 ${plan.unseen.count} 项无法判断（旧数据没有来源记录），本次不做处置`,
            `${plan.unseen.count} more item(s) cannot be judged (legacy data has no source record) and are left untouched`,
          )}
        </p>
      )}

      {plan.unaffected && (
        <p data-testid="invalidation-unaffected" className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            `第 ${plan.unaffected.from}–${plan.unaffected.to} 章及其派生不受影响`,
            `Chapters ${plan.unaffected.from}–${plan.unaffected.to} and their derived items are unaffected`,
          )}
        </p>
      )}

      {needsAck && (
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={acknowledged}
            onChange={event => setAcknowledged(event.target.checked)}
            data-testid="invalidation-ack"
          />
          <span>
            {finalizedChapters > 0
              ? text(
                `我明白这会波及 ${finalizedChapters} 章已定稿正文`,
                `I understand this affects finalized prose of ${finalizedChapters} chapter(s)`,
              )
              : affected === null
                ? text(
                  '我明白这会波及全书派生的内容',
                  'I understand this affects derived content across the whole book',
                )
                : text(
                  `我明白这会波及 ${affected} 章派生内容`,
                  `I understand this affects derived content of ${affected} chapter(s)`,
                )}
          </span>
        </label>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onDismiss}>
          {text('取消', 'Cancel')}
        </Button>
        <Button variant={needsAck ? 'destructive' : 'default'} disabled={blocked} onClick={onProceed} data-testid="invalidation-proceed">
          {text('继续', 'Continue')}
        </Button>
      </div>

      <p className="text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>
        {locale === 'en-US'
          ? 'Nothing has been written yet — rejecting here leaves every version untouched.'
          : '到这里为止什么都没写 —— 现在取消，所有版本号一位都不会动。'}
      </p>
    </section>
  )
}
