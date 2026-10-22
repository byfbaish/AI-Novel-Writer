/**
 * WorldStatePage — W5「世界状态」主区宽屏页。
 *
 * 为什么不留在左栏：260px 宽的四区纵排会把所有字号压到 0.6rem，一屏只装得下
 * 一区半。这里改成与「知识库 / 角色管理」同构的独立页（EditorArea 的
 * `auxiliaryPage`）：左栏只做分类导航，内容在主区用自适应网格铺开。
 *
 * 硬边界（设计稿 §17 / §18）不变：
 * - 数据只来自 world-state-store（它只调 'world-state:read'）：没有写仓库、
 *   没有可编辑控件、没有批准按钮。唯一动作是 orphan 卡的「补齐并建卡」，
 *   它只启动两段式工作流，写入仍走任务面板确认 + 既有 approve seam。
 * - 缺数据不画 0：日序未知显示「日序未知」，六槽全空显示「未观测」。
 * - 时间线按故事日分组，默认只展开最近三组；历史组折叠成标题。
 */
import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { Compass, RefreshCw } from 'lucide-react'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { useLayoutStore } from '../../stores/layout-store'
import { useLLMStore } from '../../stores/llm-store'
import { useWorkflowStore, workflowResourceConflictMessage } from '../../stores/workflow-store'
import { useWorldStateStore, selectWorldStateSnapshot } from '../../stores/world-state-store'
import { createCastLedgerCompletionWorkflow } from '../../services/workflows/cast-ledger-completion-workflow'
import { appErrorMessage } from '../../i18n/app-errors'
import { Button } from '../ui/Button'
import { confirm } from '../ui/Confirm'
import { EmptyState } from '../ui/EmptyState'
import { toast } from '../ui/Toast'
import { captureProjectSession, isProjectSessionCurrent } from '../project-session-gate'
import { CHARACTER_STATE_TEXT_FIELDS } from '../../shared/character-roster'
import {
  WORLD_STATE_NOTES,
  type WorldStateChapter,
  type WorldStateCharacter,
  type WorldStateContinuityFact,
  type WorldStateObservation,
  type WorldStateView as WorldStateViewData,
} from '../../shared/world-state-view'
import type { CastLedgerEntry, CastLedgerStatus } from '../../shared/cast-ledger'
import type { SpaceAuditIssueKind, SpaceLocationAudit } from '../../shared/space-machine-line'
import {
  STATE_FIELD_LABELS,
  SPACE_AUDIT_KIND_LABELS,
  WORLD_STATE_SECTION_LABELS,
  WORLD_STATE_STATUS_LABELS,
  WORLD_STATE_STATUS_ORDER,
  defaultExpandedTimelineKeys,
  describeFieldProvenance,
  describeObservationReason,
  filterContinuityFacts,
  formatStoryDay,
  groupCastLedgerEntries,
  groupTimelineByStoryDay,
  summarizeMentions,
  summarizeSpaceAudit,
  summarizeUnreadable,
  type TimelineDayGroup,
  type WorldStateLanguage,
} from '../panels/sidebar/world-state-view-model'

type LocaleText = (zhCNText: string, enUSText: string, params?: Record<string, string | number>) => string

const STATUS_BADGE_COLOR: Record<CastLedgerStatus, string> = {
  orphan: 'var(--color-error-text)',
  ambiguous: 'var(--color-warning-text)',
  anchored: 'var(--color-text)',
  carded: 'var(--color-success-text)',
}

const REASON_COLOR: Record<NonNullable<WorldStateObservation['reason']>, string> = {
  'author-protected': 'var(--color-success-text)',
  'legacy-protected': 'var(--color-text-muted)',
  'review-conflict': 'var(--color-warning-text)',
}

/**
 * 空间检查 issue 的强调色：
 * - error：窗口根本没读出来 / 区间倒置，判定时只能当「未判」；
 * - warning：两处对不上、缺一侧、语义待确认 —— 都需要作者拍板；
 * - muted：只是提示（24:00 已归一、约束装不下），不是错。
 */
const SPACE_ISSUE_COLOR: Record<SpaceAuditIssueKind, string> = {
  'hours-unreadable': 'var(--color-error-text)',
  'inverted-range': 'var(--color-error-text)',
  'end-of-day-2400': 'var(--color-text-muted)',
  'rule-not-encoded': 'var(--color-text-muted)',
  'missing-machine-line': 'var(--color-warning-text)',
  'missing-table-entry': 'var(--color-warning-text)',
  'hours-mismatch': 'var(--color-warning-text)',
  'short-window': 'var(--color-warning-text)',
  'no-hours': 'var(--color-warning-text)',
  'window-semantics-ambiguous': 'var(--color-warning-text)',
}

/**
 * 自适应网格：够宽就多排，窄了就少排，永不出现「一行一个」的单列长蛇。
 * 用内联 style 而不是 Tailwind arbitrary value —— 这套列宽是本页的布局契约，
 * 分散在四个 className 里更容易被改歪。
 */
function gridStyle(minColumnRem: number): { gridTemplateColumns: string } {
  return { gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnRem}rem, 1fr))` }
}

function pickLabel(label: { zh: string; en: string }, language: WorldStateLanguage): string {
  return language === 'zh-CN' ? label.zh : label.en
}

function formatFetchedAt(iso: string, language: WorldStateLanguage): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString(language === 'zh-CN' ? 'zh-CN' : 'en-US', { hour12: false })
}

function useViewText(): { text: LocaleText; language: WorldStateLanguage } {
  const text = useLocaleStore((s) => s.text)
  const language = useLocaleStore((s) => s.locale) as WorldStateLanguage
  return { text, language }
}

function Card({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <div
      className="rounded-md px-2.5 py-2"
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: muted ? 'var(--color-hover)' : 'transparent',
      }}
    >
      {children}
    </div>
  )
}

function SectionHint({ children }: { children: ReactNode }) {
  return (
    <div className="text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>
      {children}
    </div>
  )
}

function NoticeRow({ tone, children }: { tone: 'muted' | 'warning'; children: ReactNode }) {
  return (
    <div
      className="rounded-md px-2.5 py-1.5 text-xs leading-relaxed"
      style={{
        backgroundColor: 'var(--color-hover)',
        color: tone === 'warning' ? 'var(--color-warning-text)' : 'var(--color-text-secondary)',
      }}
    >
      {children}
    </div>
  )
}

/** notes 与「提及读取失败」提示；都没有时整段不渲染。 */
function Notices({ view }: { view: WorldStateViewData }) {
  const { text, language } = useViewText()
  const unreadable = summarizeUnreadable(view.unreadableMentions, language)
  const schemaMissing = view.notes.includes(WORLD_STATE_NOTES.castDecisionSchemaMissing)
  const projectNotOpen = view.notes.includes(WORLD_STATE_NOTES.projectNotOpen)

  if (!unreadable && !schemaMissing && !projectNotOpen) return null

  return (
    <div className="space-y-1">
      {projectNotOpen && (
        <NoticeRow tone="muted">
          {text('当前没有打开项目，无法读取世界状态。', 'No project is open, so the world state cannot be read.')}
        </NoticeRow>
      )}
      {schemaMissing && (
        <NoticeRow tone="muted">
          {text(
            '本库还没有锚点判定表，已按无锚点处理。',
            'This database has no anchor decision table; treated as having no anchors.',
          )}
        </NoticeRow>
      )}
      {unreadable && <NoticeRow tone="warning">{unreadable}</NoticeRow>}
    </div>
  )
}

// ============================================================
// 归位表
// ============================================================

function CastSection({ view, onComplete, pendingName }: {
  view: WorldStateViewData
  onComplete: (name: string) => void
  pendingName: string | null
}) {
  const { text, language } = useViewText()
  const groups = groupCastLedgerEntries(view.castLedger.entries)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {WORLD_STATE_STATUS_ORDER.map((status) => (
          <div
            key={status}
            className="rounded-md px-2.5 py-1.5"
            style={{ backgroundColor: 'var(--color-hover)', minWidth: '6.5rem' }}
          >
            <div className="text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>
              {pickLabel(WORLD_STATE_STATUS_LABELS[status], language)}
            </div>
            <div className="text-lg font-semibold leading-tight" style={{ color: STATUS_BADGE_COLOR[status] }}>
              {view.castLedger.counts[status] ?? 0}
            </div>
          </div>
        ))}
      </div>

      {groups.map((group) => (
        <section key={group.status} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
              {pickLabel(WORLD_STATE_STATUS_LABELS[group.status], language)}
            </span>
            <SectionHint>{group.entries.length}</SectionHint>
          </div>
          {group.entries.length === 0 ? (
            <SectionHint>{text('无', 'None')}</SectionHint>
          ) : (
            <div className="grid gap-2" style={gridStyle(14)}>
              {group.entries.map((entry, index) => (
                <CastCard
                  key={`${group.status}:${entry.name}:${index}`}
                  entry={entry}
                  onComplete={onComplete}
                  pending={pendingName === entry.name}
                  busy={pendingName !== null}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function CastCard({ entry, onComplete, pending, busy }: {
  entry: CastLedgerEntry
  onComplete: (name: string) => void
  pending: boolean
  busy: boolean
}) {
  const { text, language } = useViewText()

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="truncate text-xs font-medium" style={{ color: 'var(--color-text)' }}>{entry.name}</span>
        <span
          className="flex-shrink-0 rounded px-1 text-[0.65rem]"
          style={{ color: STATUS_BADGE_COLOR[entry.status], border: '1px solid var(--color-border)' }}
        >
          {pickLabel(WORLD_STATE_STATUS_LABELS[entry.status], language)}
        </span>
        {entry.status === 'anchored' && entry.anchorRole && (
          <span className="text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>
            {text('锚点：', 'Anchor: ')}{entry.anchorRole}
          </span>
        )}
        {entry.status === 'ambiguous' && (
          <span className="text-[0.65rem]" style={{ color: 'var(--color-warning-text)' }}>
            {text(`命中 ${entry.characterIds.length} 张卡`, `${entry.characterIds.length} card match(es)`)}
          </span>
        )}
      </div>
      <div className="mt-1 text-[0.65rem] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        {summarizeMentions(entry, language)}
      </div>
      {entry.status === 'orphan' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-6 flex-shrink-0 px-2 text-[0.65rem]"
            disabled={busy}
            title={text('按归位表补齐这个角色的资料并建卡', 'Fill in this cast-ledger name and create its card')}
            onClick={() => onComplete(entry.name)}
          >
            {pending ? text('补齐中…', 'Filling in…') : text('补齐并建卡', 'Fill in and create card')}
          </Button>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// 时间线（原「章节」）
// ============================================================

function TimelineSection({ chapters, language, text }: {
  chapters: readonly WorldStateChapter[]
  language: WorldStateLanguage
  text: LocaleText
}) {
  const groups = useMemo(() => groupTimelineByStoryDay(chapters, language), [chapters, language])
  const defaultKeys = useMemo(() => defaultExpandedTimelineKeys(groups, 3), [groups])
  /**
   * 折叠覆盖表：只记「作者手动点过的组」。
   * 用覆盖表而不是 useState 初始化 + effect 重置，是为了避开
   * `react-hooks/set-state-in-effect`（先例见 ArchitectureConfirmDialog.tsx:219-223）。
   */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const lastGroupRef = useRef<HTMLDivElement | null>(null)
  const jumpedRef = useRef(false)

  // 首屏定位最新：只滚一次，指向最后（最新）那一组；之后不再抢滚动。
  // 用 scrollIntoView 而不是自己算 scrollTop —— 滚动容器在页面层，这里不该持有它。
  useEffect(() => {
    if (jumpedRef.current || groups.length === 0) return
    lastGroupRef.current?.scrollIntoView({ block: 'start' })
    jumpedRef.current = true
  }, [groups.length])

  const isExpanded = (key: string): boolean => overrides[key] ?? defaultKeys.includes(key)

  if (chapters.length === 0) {
    return <SectionHint>{text('暂无定稿章节，时间线为空。', 'No finalized chapters yet; the timeline is empty.')}</SectionHint>
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <TimelineGroup
          key={group.key}
          group={group}
          expanded={isExpanded(group.key)}
          onToggle={() => setOverrides((prev) => ({ ...prev, [group.key]: !isExpanded(group.key) }))}
          groupRef={group.key === groups.at(-1)?.key ? lastGroupRef : undefined}
        />
      ))}
    </div>
  )
}

function TimelineGroup({ group, expanded, onToggle, groupRef }: {
  group: TimelineDayGroup
  expanded: boolean
  onToggle: () => void
  /** 最后一组挂这个 ref：首屏定位最新用。 */
  groupRef?: Ref<HTMLDivElement>
}) {
  const { text } = useViewText()
  const first = group.chapters[0]?.chapterNumber
  const last = group.chapters.at(-1)?.chapterNumber
  const range = first === undefined
    ? ''
    : first === last
      ? text(`第 ${first} 章`, `Ch. ${first}`)
      : text(`第 ${first}–${last} 章`, `Ch. ${first}–${last}`)

  return (
    <div ref={groupRef}>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left"
        style={{ backgroundColor: 'var(--color-hover)' }}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{group.label}</span>
        <span className="flex-1 truncate text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>
          {range}
          {group.chapters.length > 1
            && ` · ${text(`共 ${group.chapters.length} 章`, `${group.chapters.length} chapters`)}`}
        </span>
        <span className="text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>
          {expanded ? text('收起', 'Collapse') : text('展开', 'Expand')}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 grid gap-2" style={gridStyle(13)}>
          {group.chapters.map((chapter) => (
            <ChapterCard key={chapter.chapterNumber} chapter={chapter} />
          ))}
        </div>
      )}
    </div>
  )
}

function ChapterCard({ chapter }: { chapter: WorldStateChapter }) {
  const { text, language } = useViewText()
  const storyDay = formatStoryDay(chapter, language)

  return (
    <Card>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
          {text(`第 ${chapter.chapterNumber} 章`, `Ch. ${chapter.chapterNumber}`)}
        </span>
        {chapter.title && (
          <span className="truncate text-[0.7rem]" style={{ color: 'var(--color-text-secondary)' }}>
            {chapter.title}
          </span>
        )}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>
        <span>{storyDay ?? text('日序未知', 'Story day unknown')}</span>
        <span>·</span>
        <span>{chapter.draftStatus ?? text('无草稿', 'No draft')}</span>
      </div>
      {chapter.observations.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>
            {text(`${chapter.observations.length} 条观察`, `${chapter.observations.length} observation(s)`)}
          </summary>
          <div className="mt-1 space-y-1">
            {chapter.observations.map((observation, index) => (
              <ObservationRow
                key={`${observation.characterName}:${observation.field}:${index}`}
                observation={observation}
              />
            ))}
          </div>
        </details>
      )}
    </Card>
  )
}

function ObservationRow({ observation }: { observation: WorldStateObservation }) {
  const { text, language } = useViewText()
  const reason = describeObservationReason(observation.reason, language)
  const reasonColor = observation.reason ? REASON_COLOR[observation.reason] : 'var(--color-text-muted)'
  const hasSourceText = Boolean(observation.evidence || observation.reviewQuote)

  return (
    <div className="rounded px-2 py-1 text-[0.65rem]" style={{ backgroundColor: 'var(--color-hover)' }}>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
        <span style={{ color: 'var(--color-text)' }}>{observation.characterName}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>
          {pickLabel(STATE_FIELD_LABELS[observation.field], language)}
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>=</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{observation.value || '—'}</span>
        {reason && (
          <span className="rounded px-1" style={{ color: reasonColor, border: '1px solid var(--color-border)' }}>
            {reason}
          </span>
        )}
      </div>
      {hasSourceText && (
        <details className="mt-1">
          <summary className="cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
            {text('原文', 'Source text')}
          </summary>
          {observation.evidence && (
            <div className="mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
              {text('证据：', 'Evidence: ')}{observation.evidence}
            </div>
          )}
          {observation.reviewQuote && (
            <div className="mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
              {text('审稿原文：', 'Review quote: ')}{observation.reviewQuote}
            </div>
          )}
        </details>
      )}
    </div>
  )
}

// ============================================================
// 角色 / 事实
// ============================================================

function CharactersSection({ characters }: { characters: readonly WorldStateCharacter[] }) {
  const { text } = useViewText()

  if (characters.length === 0) return <SectionHint>{text('暂无角色', 'No characters')}</SectionHint>

  return (
    <div className="grid gap-2" style={gridStyle(17)}>
      {characters.map((character) => (
        <CharacterCard key={character.characterId || character.name} character={character} />
      ))}
    </div>
  )
}

function CharacterCard({ character }: { character: WorldStateCharacter }) {
  const { text, language } = useViewText()
  const { currentState } = character

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium" style={{ color: 'var(--color-text)' }}>{character.name}</span>
        <span className="flex-shrink-0 text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>
          {text(`修订 ${character.revision}`, `Rev ${character.revision}`)}
        </span>
      </div>
      {!currentState ? (
        <div className="mt-1 text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>
          {text('未观测', 'Not observed')}
        </div>
      ) : (
        <div className="mt-2 grid gap-1.5" style={gridStyle(6.5)}>
          {CHARACTER_STATE_TEXT_FIELDS.map((field) => {
            const value = currentState[field]
            const provenanceLabel = describeFieldProvenance(character.provenance?.[field], language)
            return (
              <div key={field} className="rounded px-1.5 py-1" style={{ backgroundColor: 'var(--color-hover)' }}>
                <div className="text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>
                  {pickLabel(STATE_FIELD_LABELS[field], language)}
                </div>
                <div className="text-[0.7rem] leading-snug" style={{ color: value ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                  {value || '—'}
                </div>
                {provenanceLabel && (
                  <div className="text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>{provenanceLabel}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function FactsSection({ facts }: { facts: readonly WorldStateContinuityFact[] }) {
  const { text } = useViewText()
  const [query, setQuery] = useState('')
  const visible = useMemo(() => filterContinuityFacts(facts, query), [facts, query])

  if (facts.length === 0) return <SectionHint>{text('暂无', 'None')}</SectionHint>

  return (
    <div className="space-y-2">
      {/* 只过滤已加载的内存数组：不发 IPC、不写库，所以它不破坏只读契约。 */}
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={text('搜索事实正文或章号，如「灵石」「12」', 'Search fact text or chapter, e.g. "spirit stone", "12"')}
          aria-label={text('搜索连续性事实', 'Search continuity facts')}
          className="h-7 min-w-0 flex-1 rounded-md px-2 text-xs outline-none"
          style={{
            backgroundColor: 'var(--color-hover)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
        />
        <span className="flex-shrink-0 text-[0.7rem] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
          {visible.length} / {facts.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <SectionHint>{text('没有匹配的事实', 'No matching facts')}</SectionHint>
      ) : (
        <div className="grid gap-2" style={gridStyle(16)}>
          {visible.map((fact, index) => (
            <Card key={`${fact.chapterNumber}:${index}`}>
              <div className="text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>
                {text(`第 ${fact.chapterNumber} 章`, `Ch. ${fact.chapterNumber}`)}
              </div>
              <div className="mt-0.5 text-[0.7rem] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {fact.text}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 空间检查
// ============================================================

/**
 * 「机器判不了、需人工确认」固定两项。
 *
 * 措辞与 `describeSpaceReviewChecklist` 里的两条一致，但这里直接渲染 JSX
 * （不用它返回的纯文本块）：那两句话是页面固定骨架，不是每本书的数据。
 */
function SpaceManualReview() {
  const { text } = useViewText()

  return (
    <div className="rounded-md px-2.5 py-2" style={{ backgroundColor: 'var(--color-hover)' }}>
      <div className="text-[0.7rem] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {text('机器判不了，需人工确认', 'Not machine-decidable; check by hand')}
      </div>
      <ol
        className="mt-1 list-inside list-decimal space-y-0.5 text-[0.65rem] leading-relaxed"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <li>
          {text(
            '每条 hours 是「空间开放时段」还是「申请/办理窗口」——两者压成一个字段会误判。',
            'Whether each hours window is the space opening time or an application window — collapsing both into one field causes false violations.',
          )}
        </li>
        <li>
          {text(
            '规则里的截止日、离开限制、行为义务，机读行装不下 ⇒ 确认这些已写进表格原文（会随 prompt 下发）。',
            'Deadlines, exit limits and behavioural duties cannot fit in the machine line — confirm they stay in the table text (which is sent to the model).',
          )}
        </li>
      </ol>
    </div>
  )
}

function SpaceSection({ audit }: { audit: SpaceLocationAudit }) {
  const { text, language } = useViewText()
  const summary = summarizeSpaceAudit(audit, language)

  if (audit.unreadable || summary === null) {
    return (
      <SectionHint>
        {text(
          '世界观里没识别到空间表格或机读行，本次未检查。',
          'No space table or machine line was recognized in the world-building, so the space check did not run.',
        )}
      </SectionHint>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{summary}</div>

      {audit.issues.length === 0 ? (
        <SectionHint>{text('未发现结构问题。', 'No structural issue found.')}</SectionHint>
      ) : (
        <div className="grid gap-2" style={gridStyle(18)}>
          {audit.issues.map((issue, index) => (
            <Card key={`${issue.kind}:${issue.space}:${index}`}>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span
                  className="flex-shrink-0 rounded px-1 text-[0.65rem]"
                  style={{ color: SPACE_ISSUE_COLOR[issue.kind], border: '1px solid var(--color-border)' }}
                >
                  {pickLabel(SPACE_AUDIT_KIND_LABELS[issue.kind], language)}
                </span>
                <span className="truncate text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                  {issue.space || text('（未定位到空间）', '(space not located)')}
                </span>
              </div>
              <div className="mt-1 text-[0.7rem] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {issue.detail}
              </div>
            </Card>
          ))}
        </div>
      )}

      <SpaceManualReview />
    </div>
  )
}

// ============================================================
// 页面
// ============================================================

export default function WorldStatePage() {
  const text = useLocaleStore((s) => s.text)
  const language = useLocaleStore((s) => s.locale) as WorldStateLanguage
  const locale = useLocaleStore((s) => s.locale)
  const project = useProjectStore((s) => s.currentProject)
  const projectPath = project?.path ?? null

  const section = useWorldStateStore((s) => s.section)
  const refreshing = useWorldStateStore((s) => s.refreshing)
  const load = useWorldStateStore((s) => s.load)
  const refresh = useWorldStateStore((s) => s.refresh)
  const snapshot = useWorldStateStore((s) => selectWorldStateSnapshot(s, projectPath))

  const [pendingName, setPendingName] = useState<string | null>(null)

  useEffect(() => {
    void load(projectPath)
  }, [projectPath, load])

  const data = snapshot?.view ?? null
  const error = snapshot?.error ?? null
  const loading = Boolean(projectPath) && (!snapshot || refreshing)

  /**
   * orphan → 「补齐并建卡」：与既有角色卡生成入口同构的披露与启动流程。
   *
   * 边界：这里只启动两段式工作流（补全资料 → stage pending 批次）。确认与写入
   * 仍发生在任务面板和既有 approve seam，页面自身不写库。
   */
  async function startCompletion(name: string) {
    if (pendingName) return
    const session = captureProjectSession(project)
    if (!session) return

    const resolveModel = () => {
      const llm = useLLMStore.getState()
      return llm.models.find((candidate) => candidate.id === llm.defaultModelId)
    }
    const model = resolveModel()
    if (!model) {
      toast.warning(text(
        '请先到设置 → 模型配置，添加并选择默认生成模型；世界状态未做任何改动。',
        'Add and select a default generation model in Settings → Models first. Nothing was changed.',
      ))
      return
    }

    const allowed = await confirm(text(
      `本次会把故事前提与既有角色摘要发送到以下模型端点，用于补全「${name}」的角色资料。生成后需在任务面板预览并确认，角色名单才会写入。\n\n模型：${model.name} (${model.modelName})\n端点：${model.baseUrl}\n\n是否发送？`,
      `This sends the story premise and existing character summaries to the following model endpoint to fill in "${name}". Preview and confirmation in the task panel are required before the roster changes.\n\nModel: ${model.name} (${model.modelName})\nEndpoint: ${model.baseUrl}\n\nSend?`,
    ), { title: text('补齐并建卡', 'Fill in and create a card'), confirmText: text('发送', 'Send') })
    if (!allowed || !isProjectSessionCurrent(session)) return

    // 披露与发送之间模型可能被重指：此时必须重新确认，不能沿用旧端点。
    const currentModel = resolveModel()
    if (!currentModel || currentModel.baseUrl !== model.baseUrl || currentModel.modelName !== model.modelName) {
      toast.warning(text('模型配置已改变，请重新确认后发送。', 'The model configuration changed. Confirm again before sending.'))
      return
    }

    setPendingName(name)
    try {
      const workflow = createCastLedgerCompletionWorkflow({
        projectSession: session,
        names: [name],
        generationModelId: model.id,
      }, locale)
      const conflict = useWorkflowStore.getState().getResourceConflict(workflow)
      if (conflict) {
        toast.warning(workflowResourceConflictMessage(locale, conflict.title))
        return
      }
      useLayoutStore.getState().openBottomTab('tasks')
      await useWorkflowStore.getState().startWorkflow(workflow, true)
      if (!isProjectSessionCurrent(session)) return
      toast.success(text(
        `已开始补齐「${name}」，请在任务面板预览并确认后再写入角色名单。`,
        `Filling in "${name}". Preview and confirm in the task panel before the roster changes.`,
      ))
    } catch (workflowError) {
      if (isProjectSessionCurrent(session)) toast.error(appErrorMessage(locale, workflowError))
    } finally {
      setPendingName(null)
    }
  }

  const fetchedTime = data ? formatFetchedAt(data.fetchedAt, language) : null
  const fetchedLine = fetchedTime
    ? text(`最近读取 ${fetchedTime} · 快照可能已过期`, `Last read ${fetchedTime} · snapshot may be stale`)
    : projectPath
      ? text('尚未读取', 'Not read yet')
      : text('未打开项目', 'No project open')

  const header = (
    <header
      className="flex flex-none items-center justify-between gap-3 border-b px-4 py-2"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Compass size={16} strokeWidth={1.75} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
        <span className="truncate text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {text('世界状态 · 只读', 'World state · read-only')}
        </span>
        <span className="flex-shrink-0 text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>·</span>
        <span className="truncate text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>
          {pickLabel(WORLD_STATE_SECTION_LABELS[section], language)}
        </span>
        <span className="truncate text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }} title={fetchedLine}>
          · {fetchedLine}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0"
        title={text('刷新', 'Refresh')}
        aria-label={text('刷新', 'Refresh')}
        disabled={!projectPath || loading}
        onClick={() => void refresh(projectPath)}
      >
        <RefreshCw size={15} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
      </Button>
    </header>
  )

  if (!projectPath) {
    return (
      <div className="skin-workspace-page flex h-full w-full flex-col overflow-hidden">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmptyState
            icon={<Compass size={36} />}
            message={text('请先打开项目', 'Open a project first')}
            className="pb-[15vh]"
            opacity={0.4}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="skin-workspace-page flex h-full w-full flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--color-editor-bg)' }}
    >
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {error && (
            <div
              className="rounded-md px-2.5 py-1.5 text-xs"
              style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-error-text)' }}
            >
              {text('读取失败：', 'Failed to read: ')}{error}
            </div>
          )}
          {!data && !error && (
            <div className="py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {text('读取中…', 'Loading…')}
            </div>
          )}
          {data && <Notices view={data} />}
          {data && section === 'cast' && (
            <CastSection view={data} onComplete={startCompletion} pendingName={pendingName} />
          )}
          {data && section === 'timeline' && (
            <TimelineSection chapters={data.chapters} language={language} text={text} />
          )}
          {data && section === 'characters' && <CharactersSection characters={data.characters} />}
          {data && section === 'facts' && <FactsSection facts={data.continuityFacts} />}
          {data && section === 'space' && <SpaceSection audit={data.spaceAudit} />}
        </div>
      </div>
    </div>
  )
}
