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
import { createResourceLedgerBackfillWorkflow } from '../../services/workflows/chapter-workflow'
import { ipc } from '../../services/ipc-client'
import { appErrorMessage } from '../../i18n/app-errors'
import { Button } from '../ui/Button'
import { confirm } from '../ui/Confirm'
import { EmptyState } from '../ui/EmptyState'
import { toast } from '../ui/Toast'
import { captureProjectSession, isProjectSessionCurrent } from '../project-session-gate'
import { CHARACTER_STATE_TEXT_FIELDS } from '../../shared/character-roster'
import {
  balanceAt,
  buildLedgerSeries,
  type LedgerBalance,
  type LedgerSeriesPoint,
  type ResourceDefinition,
  type ResourceMovement,
} from '../../shared/resource-ledger'
import {
  WORLD_STATE_NOTES,
  type WorldStateChapter,
  type WorldStateCharacter,
  type WorldStateContinuityFact,
  type WorldStateObservation,
  type WorldStateView as WorldStateViewData,
} from '../../shared/world-state-view'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import type { CastLedgerEntry, CastLedgerStatus } from '../../shared/cast-ledger'
import type { SpaceAuditIssueKind, SpaceLocationAudit } from '../../shared/space-machine-line'
import {
  RESOURCE_MOVEMENT_SOURCE_LABELS,
  describeJump,
  describeResourceBalance,
  detectResourceJumps,
  formatMovementDelta,
  groupResourcesByFamily,
} from '../panels/sidebar/resource-ledger-view-model'
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
// 资源（W6c 第六类）
// ============================================================

/**
 * 账本读视图的三种状态。
 *
 * `failed` 必须和「已读、但没有变动」分开：前者说明这次没读到，
 * 后者才允许说「本章程内没有变动」。混成一种就会把「读失败」画成「余额 0」。
 */
type LedgerRead =
  | { status: 'loading' }
  | { status: 'failed'; error: string }
  | { status: 'ready'; movements: ResourceMovement[]; scannedChapters: number[]; throughChapter: number }

/** `db:resource-ledger-read` 的一次读取；失败也只返回状态，不抛错。 */
async function readLedger(projectPath: string, throughChapter: number): Promise<LedgerRead> {
  if (throughChapter <= 0) {
    // 一章都没定稿：账本无从判定。空数组在这里是「没有可读的章」，不是「读到 0 枚」。
    return { status: 'ready', movements: [], scannedChapters: [], throughChapter }
  }
  try {
    const result = await ipc.invoke('db:resource-ledger-read', throughChapter, projectPath)
    if (!result.success) return { status: 'failed', error: result.error?.trim() || 'UNKNOWN' }
    return {
      status: 'ready',
      movements: result.movements ?? [],
      scannedChapters: result.scannedChapters ?? [],
      throughChapter,
    }
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
}

const BALANCE_TONE_COLOR: Record<LedgerBalance['kind'], string> = {
  known: 'var(--color-text)',
  unknown: 'var(--color-warning-text)',
  conflict: 'var(--color-error-text)',
}

/**
 * 逐章走势（迷你条形）。
 *
 * `value === null` 的章**不画柱子**，只留一个虚线空槽：画成 0 高的柱子会让
 * 「账本中断」在图上长成「余额归零」的断崖，作者会把它当成事实写进下一章。
 * 高度按序列内的最大绝对值归一 —— 这张图只看形状，精确数字在余额行和变动列表里。
 */
function LedgerSparkline({ points, gapReason, text }: {
  points: readonly LedgerSeriesPoint[]
  /** 空槽的原因：中断 / 未登记起点 / 单位冲突 —— 三种「不知道」的修法完全不同，提示不能混。 */
  gapReason: 'not-scanned' | 'no-origin' | 'conflict'
  text: LocaleText
}) {
  const known = points.filter((point): point is { chapterNumber: number; value: number } => point.value !== null)
  const max = known.reduce((peak, point) => Math.max(peak, Math.abs(point.value)), 0)
  const hasGap = known.length < points.length

  if (points.length === 0) return null

  return (
    <div className="mt-1.5">
      <div className="flex h-9 items-end gap-px overflow-x-auto pb-0.5" role="img"
        aria-label={text('逐章余额走势', 'Balance by chapter')}>
        {points.map((point) => (
          point.value === null ? (
            <div
              key={`gap:${point.chapterNumber}`}
              className="h-full flex-shrink-0 rounded-sm"
              style={{
                flex: '1 0 3px',
                border: '1px dashed var(--color-border)',
                opacity: 0.6,
              }}
              title={text(
                `第 ${point.chapterNumber} 章：未知（${gapReason === 'no-origin'
                  ? '未登记开篇余额'
                  : gapReason === 'conflict' ? '单位不一致，未合并' : '该章未扫描'}）`,
                `Ch. ${point.chapterNumber}: unknown (${gapReason === 'no-origin'
                  ? 'no opening balance'
                  : gapReason === 'conflict' ? 'unit mismatch, not merged' : 'chapter not scanned'})`,
              )}
              data-ledger-gap={point.chapterNumber}
            />
          ) : (
            <div
              key={`bar:${point.chapterNumber}`}
              className="flex-shrink-0 rounded-sm"
              style={{
                flex: '1 0 3px',
                // 0 值给 2px 的底：0 是真实余额，必须与「未知空槽」区分开。
                height: `${max === 0 ? 4 : Math.max(4, Math.round(Math.abs(point.value) / max * 100))}%`,
                backgroundColor: point.value < 0 ? 'var(--color-error-text)' : 'var(--color-accent)',
              }}
              title={text(
                `第 ${point.chapterNumber} 章：${point.value}`,
                `Ch. ${point.chapterNumber}: ${point.value}`,
              )}
              data-ledger-bar={point.chapterNumber}
            />
          )
        ))}
      </div>
      <div className="flex items-center justify-between text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>
        <span>{text(`第 ${points[0].chapterNumber} 章`, `Ch. ${points[0].chapterNumber}`)}</span>
        {hasGap && <span>{text('虚线 = 该章未知，不是 0', 'Dashed = unknown, not zero')}</span>}
        <span>{text(`第 ${points[points.length - 1].chapterNumber} 章`, `Ch. ${points[points.length - 1].chapterNumber}`)}</span>
      </div>
    </div>
  )
}

function MovementRow({ movement, resource, language, text }: {
  movement: ResourceMovement
  resource: ResourceDefinition
  language: WorldStateLanguage
  text: LocaleText
}) {
  const chapterLabel = movement.chapterNumber === 0
    ? text('开篇（第 0 章）', 'Opening (ch. 0)')
    : text(`第 ${movement.chapterNumber} 章`, `Ch. ${movement.chapterNumber}`)
  const sourceLabel = language === 'zh-CN'
    ? RESOURCE_MOVEMENT_SOURCE_LABELS[movement.source].zh
    : RESOURCE_MOVEMENT_SOURCE_LABELS[movement.source].en

  return (
    <div className="rounded px-1.5 py-1" style={{ backgroundColor: 'var(--color-hover)' }}>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.65rem]">
        <span className="tabular-nums" style={{ color: 'var(--color-text)' }}>{chapterLabel}</span>
        <span
          className="tabular-nums"
          style={{ color: movement.delta > 0 ? 'var(--color-success-text)' : 'var(--color-error-text)' }}
        >
          {formatMovementDelta(movement.delta)} {movement.unit}
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>{sourceLabel}</span>
        {/* 单位快照与当前单位不同：这一行就是「单位不一致」的来源，必须点名，不能静默换单位。 */}
        {movement.unit !== resource.unit && (
          <span
            className="rounded px-1"
            style={{ color: 'var(--color-error-text)', border: '1px solid var(--color-border)' }}
          >
            {text(`单位 ${movement.unit} ≠ 当前 ${resource.unit}`, `Unit ${movement.unit} ≠ current ${resource.unit}`)}
          </span>
        )}
      </div>
      {movement.evidence && (
        <details className="mt-0.5">
          <summary className="cursor-pointer text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>
            {text(`${chapterLabel} · 引文`, `${chapterLabel} · quote`)}
          </summary>
          <div
            className="mt-0.5 whitespace-pre-wrap text-[0.65rem] leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {movement.evidence}
          </div>
        </details>
      )}
    </div>
  )
}

function ResourceCard({ resource, read, throughChapter }: {
  resource: ResourceDefinition
  read: Extract<LedgerRead, { status: 'ready' }> | null
  throughChapter: number
}) {
  const { text, language } = useViewText()
  const balance = read
    ? balanceAt(resource, read.movements, throughChapter, { scannedChapters: read.scannedChapters })
    : null
  const balanceText = balance ? describeResourceBalance(balance, resource.unit, language) : null
  const points = read ? buildLedgerSeries(resource, read.movements, { scannedChapters: read.scannedChapters }, throughChapter) : []
  const jumps = detectResourceJumps(points)
  /**
   * 「最近一个可算章」。未知时只作为**已过时**的参照显示：
   * 把它写成「当前余额」正是判据 DJ 要防的那件事（作者会拿旧数字写下一章）。
   */
  const lastKnown = [...points].reverse().find((point): point is { chapterNumber: number; value: number } => point.value !== null)
  const own = read ? read.movements.filter((movement) => movement.resourceId === resource.resourceId) : []

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="truncate text-xs font-medium" style={{ color: 'var(--color-text)' }}>{resource.name}</span>
        <span
          className="flex-shrink-0 rounded px-1 text-[0.6rem] tabular-nums"
          style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
          title={text('品阶', 'Tier')}
        >
          {text(`品阶 ${resource.tier}`, `T${resource.tier}`)}
        </span>
        <span className="text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>
          {text(`单位：${resource.unit}`, `Unit: ${resource.unit}`)}
        </span>
      </div>

      <div className="mt-1.5">
        <div className="text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>
          {text('当前余额', 'Current balance')}
        </div>
        {balanceText && balance ? (
          <>
            <div
              className="text-sm font-semibold leading-snug tabular-nums"
              style={{ color: BALANCE_TONE_COLOR[balance.kind] }}
              data-ledger-state={balance.kind}
            >
              {balanceText.primary}
            </div>
            <div className="text-[0.62rem] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {balanceText.secondary}
            </div>
            {balance.kind === 'unknown' && lastKnown && (
              <div className="text-[0.6rem] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {text(
                  `最后一次可算：第 ${lastKnown.chapterNumber} 章 ${lastKnown.value} ${resource.unit}（已过时，不是当前余额）`,
                  `Last computable: ch. ${lastKnown.chapterNumber} = ${lastKnown.value} ${resource.unit} (stale, not the current balance)`,
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-[0.7rem]" style={{ color: 'var(--color-warning-text)' }}>
            {text('账本未读取：余额与走势暂不可用（不是 0）', 'Ledger not read: balance and trend unavailable (not zero)')}
          </div>
        )}
      </div>

      {read && (
        <LedgerSparkline
          points={points}
          gapReason={balance?.kind === 'conflict'
            ? 'conflict'
            : balance?.kind === 'unknown' && balance.reason === 'no-origin' ? 'no-origin' : 'not-scanned'}
          text={text}
        />
      )}

      {jumps.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {jumps.map((jump) => (
            <span
              key={`jump:${jump.chapterNumber}`}
              className="rounded px-1 text-[0.6rem]"
              style={{
                color: jump.delta > 0 ? 'var(--color-warning-text)' : 'var(--color-error-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              {describeJump(jump, language)}
            </span>
          ))}
        </div>
      )}

      {read && own.length === 0 && (
        <div className="mt-1.5 text-[0.62rem]" style={{ color: 'var(--color-text-muted)' }}>
          {text('第 1 章起没有变动记录（开篇起点也缺）', 'No movements from chapter 1 (no opening entry either)')}
        </div>
      )}

      {own.length > 0 && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[0.62rem]" style={{ color: 'var(--color-text-muted)' }}>
            {text(`${own.length} 条变动`, `${own.length} movement(s)`)}
          </summary>
          <div className="mt-1 space-y-1">
            {own.map((movement) => (
              <MovementRow
                key={`movement:${movement.id}`}
                movement={movement}
                resource={resource}
                language={language}
                text={text}
              />
            ))}
          </div>
        </details>
      )}
    </Card>
  )
}

/** 族分组：同族多品阶并排，**不合计**（族级余额是派生展示，见设计稿 §3.3）。 */
function ResourcesSection({ view, projectPath }: { view: WorldStateViewData; projectPath: string }) {
  const { text } = useViewText()
  const project = useProjectStore((s) => s.currentProject)
  const locale = useLocaleStore((s) => s.locale)

  const chapters = useMemo(
    () => [...view.chapters].map((chapter) => chapter.chapterNumber).sort((left, right) => left - right),
    [view.chapters],
  )
  const throughChapter = chapters.at(-1) ?? 0
  const families = useMemo(() => groupResourcesByFamily(view.resources.items), [view.resources.items])

  const [ledger, setLedger] = useState<LedgerRead>({ status: 'loading' })
  const [run, setRun] = useState<{ scope: 'chapter' | 'range'; from: number; to: number; current: number } | null>(null)
  /** 逐章结果行。tone 单独存，避免渲染时去匹配文案里的「未完成 / 停在第」（改一个字就会掉色）。 */
  const [report, setReport] = useState<{ tone: 'info' | 'error'; text: string }[]>([])
  /** 补扫后手动加一：只重读账本，不重读整页快照（资源定义没变，余额变了）。 */
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next = await readLedger(projectPath, throughChapter)
      if (!cancelled) setLedger(next)
    })()
    return () => { cancelled = true }
  }, [projectPath, throughChapter, reloadToken, view.fetchedAt])

  const busy = run !== null

  async function runOneChapter(chapter: number, session: ProjectSessionContext): Promise<{ ok: true } | { ok: false; error: string }> {
    const workflow = createResourceLedgerBackfillWorkflow(chapter, projectPath, session)
    const store = useWorkflowStore.getState()
    const conflict = store.getResourceConflict(workflow)
    if (conflict) return { ok: false, error: workflowResourceConflictMessage(locale, conflict.title) }

    let runId: string
    try {
      runId = await store.startWorkflow(workflow, true)
    } catch (error) {
      return { ok: false, error: appErrorMessage(locale, error) }
    }

    // 结束后 run 会被移出 activeRuns 进 history；两处都翻，避免误判成「没跑」。
    const after = useWorkflowStore.getState()
    const finished = [...after.history, ...after.activeRuns].find((item) => item.id === runId)
    if (finished?.status === 'completed') return { ok: true }
    const stepError = finished?.steps.find((step) => step.error?.trim())?.error?.trim()
    return {
      ok: false,
      error: finished?.error?.trim() || stepError
        || text('没有拿到运行结果（工作流可能被取消或项目已切换）', 'No run result (the workflow may have been cancelled or the project switched)'),
    }
  }

  function appendReport(line: string, tone: 'info' | 'error' = 'info') {
    useWorkflowStore.getState().addLog(tone === 'error' ? 'error' : 'info', line, locale)
    setReport((previous) => [...previous, { tone, text: line }])
  }

  async function backfillChapter(chapter: number) {
    if (busy) return
    const session = captureProjectSession(project)
    if (!session) return
    setReport([])
    setRun({ scope: 'chapter', from: chapter, to: chapter, current: chapter })
    try {
      const result = await runOneChapter(chapter, session)
      if (result.ok) {
        appendReport(text(`第 ${chapter} 章重扫完成。`, `Chapter ${chapter} rescanned.`))
        toast.success(text(`第 ${chapter} 章的资源账本已重扫。`, `Resource ledger for chapter ${chapter} was rescanned.`))
      } else {
        const line = text(`第 ${chapter} 章未完成：${result.error}`, `Chapter ${chapter} failed: ${result.error}`)
        appendReport(line, 'error')
        toast.error(line)
      }
    } finally {
      setRun(null)
      setReloadToken((token) => token + 1)
    }
  }

  async function backfillRange() {
    if (busy || chapters.length === 0) return
    /**
     * 起点固定是第 1 章，不是「最小定稿章」：账本的已知性是 `interruptedSince` 从 1 逐章检查出来的，
     * 从第 5 章开始补会让第 1–4 章永远显示中断。中间章缺定稿时由工作流报错并停下（说明停在哪一章），
     * 这里不猜、不跳章。
     */
    const from = 1
    const to = throughChapter
    const total = to - from + 1

    const allowed = await confirm(text(
      `将按顺序重扫第 ${from}–${to} 章（共 ${total} 章）的资源变动：每章都会读已定稿正文并调用模型抽取，耗时可能较长。只重写资源变动，不改正文与其它后处理结果；任何一章失败会立刻停下并说明停在哪一章。\n\n补扫期间请不要切换项目。`,
      `This rescans resource movements for chapters ${from}–${to} (${total} chapters) in order: each chapter reads the finalized prose and calls the model, so it may take a while. Only resource movements are rewritten; the prose and every other post-processing result stay untouched. If any chapter fails, the run stops and reports where.\n\nDo not switch projects while it runs.`,
    ), { title: text('补扫资源账本', 'Rescan resource ledger'), confirmText: text('开始补扫', 'Start') })
    if (!allowed) return

    const session = captureProjectSession(project)
    if (!session) return

    setReport([])
    let done = 0
    let stopped: { chapter: number; error: string } | null = null

    for (let chapter = from; chapter <= to; chapter += 1) {
      if (!isProjectSessionCurrent(session)) {
        stopped = {
          chapter,
          error: text('项目已切换，补扫已停止', 'The project switched, so the rescan stopped'),
        }
        break
      }
      setRun({ scope: 'range', from, to, current: chapter })
      const result = await runOneChapter(chapter, session)
      if (!result.ok) {
        stopped = { chapter, error: result.error }
        break
      }
      done += 1
      appendReport(text(
        `第 ${chapter} 章完成（${done}/${total}）。`,
        `Chapter ${chapter} done (${done}/${total}).`,
      ))
    }

    setRun(null)
    setReloadToken((token) => token + 1)

    if (stopped) {
      const line = text(
        `补扫停在第 ${stopped.chapter} 章：${stopped.error}。已完成的 ${done} 章保留，后面的章没有动。`,
        `Rescan stopped at chapter ${stopped.chapter}: ${stopped.error}. The ${done} finished chapter(s) are kept; later chapters were not touched.`,
      )
      appendReport(line, 'error')
      toast.error(line)
      return
    }
    appendReport(text(`补扫完成：第 ${from}–${to} 章共 ${done} 章。`, `Rescan finished: ${done} chapter(s) from ${from} to ${to}.`))
    toast.success(text(`补扫完成：第 ${from}–${to} 章共 ${done} 章。`, `Rescan finished: ${done} chapter(s) from ${from} to ${to}.`))
  }

  if (view.resources.unreadable) {
    return (
      <NoticeRow tone="warning">
        {text(
          '本次没读到资源登记表（库版本较早或尚未读到项目库），这不是「0 个资源」。',
          'The resource registry could not be read this time (older schema or the project library is not ready). This is not "zero resources".',
        )}
      </NoticeRow>
    )
  }

  if (view.resources.items.length === 0) {
    return (
      <div className="space-y-1">
        <SectionHint>{text('尚未登记资源。', 'No resource registered yet.')}</SectionHint>
        <SectionHint>
          {text(
            '到「世界观」编辑页的「资源登记」区添加资源（名称 / 单位 / 口径），登记后这里会自动读取余额与逐章变动。',
            'Add resources (name / unit / period) in the "Resource registry" area of the world-building editor; balances and movements show up here automatically.',
          )}
        </SectionHint>
      </div>
    )
  }

  const read = ledger.status === 'ready' ? ledger : null

  return (
    <div className="space-y-3">
      {ledger.status === 'loading' && (
        <SectionHint>{text('正在读取账本…', 'Reading the ledger…')}</SectionHint>
      )}

      {ledger.status === 'failed' && (
        <NoticeRow tone="warning">
          {text('账本读取失败：', 'Failed to read the ledger: ')}{ledger.error}
          {text('（本次没有余额，不是 0 枚）', ' (no balance this time — not zero)')}
        </NoticeRow>
      )}

      {/* 两个回填入口都只启动工作流：写入仍走既有的后处理落库路径，页面自身不写库。 */}
      <div className="rounded-md px-2.5 py-2" style={{ border: '1px solid var(--color-border)' }}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
              {text('账本回填', 'Ledger backfill')}
            </div>
            <div className="text-[0.62rem] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {text(
                '本页只读；这两个按钮只启动「按章重跑资源抽取」的工作流，写入仍由后处理任务完成。重扫不改正文与其它后处理结果。账本从第 1 章逐章判定：少扫一章，本章及之后都会显示中断。',
                'This page is read-only; these two buttons only start the per-chapter resource-extraction rerun — the post-processing job still does the writing. A rescan never touches the prose or other results. The ledger is judged chapter by chapter from 1: one unscanned chapter makes it and everything after unknown.',
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-6 flex-shrink-0 px-2 text-[0.65rem]"
            disabled={busy || chapters.length === 0}
            title={text('按章顺序补扫，任何一章失败即停止', 'Rescan in chapter order; stop on the first failure')}
            onClick={() => void backfillRange()}
          >
            {throughChapter <= 1
              ? text('补扫第 1 章', 'Rescan ch. 1')
              : text(`补扫第 1–${throughChapter} 章`, `Rescan ch. 1–${throughChapter}`)}
          </Button>
        </div>

        {chapters.length === 0 ? (
          <div className="mt-2 text-[0.62rem]" style={{ color: 'var(--color-text-muted)' }}>
            {text('还没有定稿章节，无法补扫。', 'No finalized chapter yet, so nothing can be rescanned.')}
          </div>
        ) : (
          <div className="mt-2 max-h-28 overflow-y-auto pr-1">
            <div className="grid gap-1" style={gridStyle(8)}>
              {chapters.map((chapter) => (
                <div key={`backfill:${chapter}`} className="rounded px-1.5 py-1" style={{ backgroundColor: 'var(--color-hover)' }}>
                  <div className="text-[0.6rem] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                    {text(`第 ${chapter} 章`, `Ch. ${chapter}`)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-0.5 h-5 w-full px-1 text-[0.6rem]"
                    disabled={busy}
                    onClick={() => void backfillChapter(chapter)}
                  >
                    {text('重扫本章变动', 'Rescan chapter')}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {busy && (
          <div className="mt-1.5 text-[0.62rem] tabular-nums" style={{ color: 'var(--color-warning-text)' }}>
            {run.scope === 'range'
              ? text(
                `正在补扫第 ${run.current} 章（第 ${run.from}–${run.to} 章，已完成 ${run.current - run.from} 章）…`,
                `Rescanning chapter ${run.current} (of ${run.from}–${run.to}, ${run.current - run.from} done)…`,
              )
              : text(`正在重扫第 ${run.current} 章…`, `Rescanning chapter ${run.current}…`)}
          </div>
        )}

        {report.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {report.slice(-6).map((entry, index) => (
              <div
                key={`report:${index}`}
                className="text-[0.6rem] leading-relaxed"
                style={{ color: entry.tone === 'error' ? 'var(--color-error-text)' : 'var(--color-text-muted)' }}
              >
                {entry.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {families.map((group) => (
        <section key={group.key} className="space-y-1.5">
          {group.title && group.items.length > 1 && (
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {text(`族：${group.title}`, `Family: ${group.title}`)}
              </span>
              <SectionHint>
                {text(
                  `${group.items.length} 个品阶 · 不合计（族级余额是派生展示，不单独存）`,
                  `${group.items.length} tier(s) · no total (a family balance is a derived view, never stored)`,
                )}
              </SectionHint>
            </div>
          )}
          <div className="grid gap-2" style={gridStyle(18)}>
            {group.items.map((resource) => (
              <ResourceCard
                key={resource.resourceId}
                resource={resource}
                read={read}
                throughChapter={throughChapter}
              />
            ))}
          </div>
        </section>
      ))}
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
          {data && section === 'resources' && <ResourcesSection view={data} projectPath={projectPath} />}
          {data && section === 'facts' && <FactsSection facts={data.continuityFacts} />}
          {data && section === 'space' && <SpaceSection audit={data.spaceAudit} />}
        </div>
      </div>
    </div>
  )
}
