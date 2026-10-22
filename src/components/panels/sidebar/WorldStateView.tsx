/**
 * WorldStateView — W5「世界状态」只读视图（左侧导航「世界状态」入口）。
 *
 * 硬边界（设计稿 §17 / 交接说明）：
 * - 数据只来自只读 IPC 'world-state:read'：没有写仓库、可编辑控件，也没有
 *   直接批准/建卡按钮。唯一动作是归位表 orphan 行的「补齐并建卡」入口——它只
 *   启动两段式工作流，生成结果仍要在任务面板预览确认；真正改名单的路径依旧
 *   只有 approve → 角色名单提交（与既有角色卡生成链共用同一条 seam）。
 * - 缺数据不画 0：日序未知显示「未定」，六槽全空显示「未观测」。
 * - 归位表 orphan 行先做模型披露确认再启动工作流；ambiguous 只列命中卡数，
 *   anchored/carded 只列锚点与提及，均不提供动作入口。
 * - 不拼 SQL、不推断正文里没有的名字、不修改读取层返回的数据。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Compass, RefreshCw } from 'lucide-react'
import { ipc } from '../../../services/ipc-client'
import { useLocaleStore } from '../../../stores/locale-store'
import { useProjectStore } from '../../../stores/project-store'
import { useLayoutStore } from '../../../stores/layout-store'
import { useLLMStore } from '../../../stores/llm-store'
import { useWorkflowStore, workflowResourceConflictMessage } from '../../../stores/workflow-store'
import { createCastLedgerCompletionWorkflow } from '../../../services/workflows/cast-ledger-completion-workflow'
import { appErrorMessage } from '../../../i18n/app-errors'
import { Button } from '../../ui/Button'
import { confirm } from '../../ui/Confirm'
import { EmptyState } from '../../ui/EmptyState'
import { toast } from '../../ui/Toast'
import { captureProjectSession, isProjectSessionCurrent } from '../../project-session-gate'
import { CHARACTER_STATE_TEXT_FIELDS } from '../../../shared/character-roster'
import {
  WORLD_STATE_NOTES,
  type WorldStateChapter,
  type WorldStateCharacter,
  type WorldStateContinuityFact,
  type WorldStateObservation,
  type WorldStateView as WorldStateViewData,
} from '../../../shared/world-state-view'
import type { CastLedgerEntry, CastLedgerStatus } from '../../../shared/cast-ledger'
import {
  STATE_FIELD_LABELS,
  WORLD_STATE_STATUS_LABELS,
  WORLD_STATE_STATUS_ORDER,
  describeFieldProvenance,
  describeObservationReason,
  formatStoryDay,
  groupCastLedgerEntries,
  summarizeMentions,
  summarizeUnreadable,
  type WorldStateLanguage,
} from './world-state-view-model'

type LocaleText = (zhCNText: string, enUSText: string, params?: Record<string, string | number>) => string

/** 四档状态徽标颜色（文字色 + 边框，不引入新的色板）。 */
const STATUS_BADGE_COLOR: Record<CastLedgerStatus, string> = {
  orphan: 'var(--color-error-text)',
  ambiguous: 'var(--color-warning-text)',
  anchored: 'var(--color-text)',
  carded: 'var(--color-success-text)',
}

/** observations 的 reason 徽标颜色。 */
const REASON_COLOR: Record<NonNullable<WorldStateObservation['reason']>, string> = {
  'author-protected': 'var(--color-success-text)',
  'legacy-protected': 'var(--color-text-muted)',
  'review-conflict': 'var(--color-warning-text)',
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

/** 分区骨架：小标题 + 可选计数/提示。 */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-1 flex items-center justify-between gap-1 px-1">
        <span className="text-[0.7rem] font-medium" style={{ color: 'var(--color-text)' }}>{title}</span>
        {hint !== undefined && (
          <span className="text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>{hint}</span>
        )}
      </div>
      {children}
    </section>
  )
}

function NoticeRow({ tone, children }: { tone: 'muted' | 'warning'; children: ReactNode }) {
  return (
    <div
      className="rounded-md px-2 py-1 text-[0.7rem] leading-relaxed"
      style={{
        backgroundColor: 'var(--color-hover)',
        color: tone === 'warning' ? 'var(--color-warning-text)' : 'var(--color-text-secondary)',
      }}
    >
      {children}
    </div>
  )
}

/** notes 与「提及读取失败」提示。都没有时整段不渲染。 */
function NoticesSection({ view }: { view: WorldStateViewData }) {
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

interface CastLedgerSectionProps {
  view: WorldStateViewData
  /** 启动「补齐并建卡」工作流；只有 orphan 行会调用。 */
  onComplete: (name: string) => void
  /** 正在生成的名字（null 表示空闲）：同一时刻只允许一个工作流。 */
  pendingName: string | null
}

/** 归位表：四档计数 + 按读取层顺序分组。 */
function CastLedgerSection({ view, onComplete, pendingName }: CastLedgerSectionProps) {
  const { text, language } = useViewText()
  const groups = groupCastLedgerEntries(view.castLedger.entries)

  return (
    <Section
      title={text('归位表', 'Cast ledger')}
      hint={text(`共 ${view.castLedger.entries.length} 个名字`, `${view.castLedger.entries.length} names`)}
    >
      <div className="mb-1 grid grid-cols-4 gap-1 px-0.5">
        {WORLD_STATE_STATUS_ORDER.map((status) => (
          <div
            key={status}
            className="rounded-md px-1.5 py-1"
            style={{ backgroundColor: 'var(--color-hover)' }}
          >
            <div className="truncate text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>
              {pickLabel(WORLD_STATE_STATUS_LABELS[status], language)}
            </div>
            <div className="text-xs font-semibold" style={{ color: STATUS_BADGE_COLOR[status] }}>
              {view.castLedger.counts[status] ?? 0}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {groups.map((group) => (
          <div key={group.status}>
            <div
              className="flex items-center justify-between gap-1 px-1 text-[0.6rem]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <span>{pickLabel(WORLD_STATE_STATUS_LABELS[group.status], language)}</span>
              <span>{group.entries.length}</span>
            </div>
            {group.entries.length === 0 ? (
              <div className="px-1 text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>
                {text('无', 'None')}
              </div>
            ) : (
              <div className="mt-0.5 space-y-0.5">
                {group.entries.map((entry, index) => (
                  <CastLedgerRow
                    key={`${group.status}:${entry.name}:${index}`}
                    entry={entry}
                    onComplete={onComplete}
                    pending={pendingName === entry.name}
                    busy={pendingName !== null}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

function CastLedgerRow({ entry, onComplete, pending, busy }: {
  entry: CastLedgerEntry
  onComplete: (name: string) => void
  /** 这一行自己的工作流正在运行。 */
  pending: boolean
  /** 任意一行在运行（含本行）：用于禁用其余入口。 */
  busy: boolean
}) {
  const { text, language } = useViewText()

  return (
    <div className="rounded-md px-2 py-1" style={{ backgroundColor: 'var(--color-hover)' }}>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="truncate text-[0.7rem]" style={{ color: 'var(--color-text)' }}>{entry.name}</span>
        <span
          className="rounded px-1 text-[0.6rem]"
          style={{ color: STATUS_BADGE_COLOR[entry.status], border: '1px solid var(--color-border)' }}
        >
          {pickLabel(WORLD_STATE_STATUS_LABELS[entry.status], language)}
        </span>
        {entry.status === 'anchored' && entry.anchorRole && (
          <span className="text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>
            {text('锚点：', 'Anchor: ')}{entry.anchorRole}
          </span>
        )}
        {entry.status === 'ambiguous' && (
          <span className="text-[0.6rem]" style={{ color: 'var(--color-warning-text)' }}>
            {text(`命中 ${entry.characterIds.length} 张卡`, `${entry.characterIds.length} card match(es)`)}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>
        {summarizeMentions(entry, language)}
      </div>
      {entry.status === 'orphan' && (
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>
            {text(
              '尚无角色卡：补齐资料后仍需在任务面板预览确认，角色名单才会写入。',
              'No character card yet: after the details are filled in, preview and confirm in the task panel before the roster changes.',
            )}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-5 flex-shrink-0 px-1.5 text-[0.6rem]"
            disabled={busy}
            title={text('按归位表补齐这个角色的资料并建卡', 'Fill in this cast-ledger name and create its card')}
            onClick={() => onComplete(entry.name)}
          >
            {pending
              ? text('补齐中…', 'Filling in…')
              : text('补齐并建卡', 'Fill in and create card')}
          </Button>
        </div>
      )}
    </div>
  )
}

/** 章节区：章节号 / 标题 / 故事日 / 草稿态 + observations。 */
function ChaptersSection({ chapters }: { chapters: WorldStateChapter[] }) {
  const { text } = useViewText()

  return (
    <Section title={text('章节', 'Chapters')} hint={String(chapters.length)}>
      {chapters.length === 0 ? (
        <div className="px-1 text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>
          {text('暂无章节', 'No chapters')}
        </div>
      ) : (
        <div className="space-y-1">
          {chapters.map((chapter) => (
            <ChapterCard key={chapter.chapterNumber} chapter={chapter} />
          ))}
        </div>
      )}
    </Section>
  )
}

function ChapterCard({ chapter }: { chapter: WorldStateChapter }) {
  const { text, language } = useViewText()
  const storyDay = formatStoryDay(chapter, language)

  return (
    <div className="rounded-md px-2 py-1.5" style={{ border: '1px solid var(--color-border)' }}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[0.7rem] font-medium" style={{ color: 'var(--color-text)' }}>
          {text(`第 ${chapter.chapterNumber} 章`, `Chapter ${chapter.chapterNumber}`)}
        </span>
        {chapter.title && (
          <span className="truncate text-[0.65rem]" style={{ color: 'var(--color-text-secondary)' }}>
            {chapter.title}
          </span>
        )}
      </div>
      <div
        className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.6rem]"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span>{storyDay ?? text('未定', 'Unknown')}</span>
        <span>·</span>
        <span>{chapter.draftStatus ?? text('无草稿', 'No draft')}</span>
      </div>
      {chapter.observations.length > 0 && (
        <div className="mt-1 space-y-1">
          {chapter.observations.map((observation, index) => (
            <ObservationRow
              key={`${observation.characterName}:${observation.field}:${index}`}
              observation={observation}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ObservationRow({ observation }: { observation: WorldStateObservation }) {
  const { text, language } = useViewText()
  const reason = describeObservationReason(observation.reason, language)
  const reasonColor = observation.reason ? REASON_COLOR[observation.reason] : 'var(--color-text-muted)'
  const hasSourceText = Boolean(observation.evidence || observation.reviewQuote)

  return (
    <div className="rounded px-1.5 py-1 text-[0.65rem]" style={{ backgroundColor: 'var(--color-hover)' }}>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
        <span style={{ color: 'var(--color-text)' }}>{observation.characterName}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>
          {pickLabel(STATE_FIELD_LABELS[observation.field], language)}
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>=</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{observation.value || '—'}</span>
        {reason && (
          <span
            className="rounded px-1"
            style={{ color: reasonColor, border: '1px solid var(--color-border)' }}
          >
            {reason}
          </span>
        )}
      </div>
      {hasSourceText && (
        <details className="mt-0.5">
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

/** 角色区：名字 + 六槽状态 + 逐槽来源徽标。 */
function CharactersSection({ characters }: { characters: WorldStateCharacter[] }) {
  const { text } = useViewText()

  return (
    <Section title={text('角色', 'Characters')} hint={String(characters.length)}>
      {characters.length === 0 ? (
        <div className="px-1 text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>
          {text('暂无角色', 'No characters')}
        </div>
      ) : (
        <div className="space-y-1">
          {characters.map((character) => (
            <CharacterCard key={character.characterId || character.name} character={character} />
          ))}
        </div>
      )}
    </Section>
  )
}

function CharacterCard({ character }: { character: WorldStateCharacter }) {
  const { text, language } = useViewText()
  const { currentState } = character

  return (
    <div className="rounded-md px-2 py-1.5" style={{ border: '1px solid var(--color-border)' }}>
      <div className="flex items-baseline justify-between gap-1">
        <span className="truncate text-[0.7rem]" style={{ color: 'var(--color-text)' }}>{character.name}</span>
        <span className="flex-shrink-0 text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>
          {text(`修订 ${character.revision}`, `Rev ${character.revision}`)}
        </span>
      </div>
      {!currentState ? (
        <div className="mt-0.5 text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>
          {text('未观测', 'Not observed')}
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-2 gap-1">
          {CHARACTER_STATE_TEXT_FIELDS.map((field) => {
            const value = currentState[field]
            const provenanceLabel = describeFieldProvenance(character.provenance?.[field], language)
            return (
              <div key={field} className="rounded px-1.5 py-1" style={{ backgroundColor: 'var(--color-hover)' }}>
                <div className="text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>
                  {pickLabel(STATE_FIELD_LABELS[field], language)}
                </div>
                <div
                  className="text-[0.7rem]"
                  style={{ color: value ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                >
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
    </div>
  )
}

/** 连续性事实区：可折叠的「第 N 章：文本」列表。 */
function ContinuityFactsSection({ facts }: { facts: WorldStateContinuityFact[] }) {
  const { text } = useViewText()

  return (
    <Section title={text('连续性事实', 'Continuity facts')} hint={String(facts.length)}>
      <details open className="rounded-md px-2 py-1" style={{ backgroundColor: 'var(--color-hover)' }}>
        <summary className="cursor-pointer text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>
          {text('展开 / 收起', 'Expand / collapse')}
        </summary>
        {facts.length === 0 ? (
          <div className="mt-0.5 text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>
            {text('暂无', 'None')}
          </div>
        ) : (
          <div className="mt-0.5 space-y-0.5">
            {facts.map((fact, index) => (
              <div
                key={`${fact.chapterNumber}:${index}`}
                className="text-[0.65rem]"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {text(`第 ${fact.chapterNumber} 章：`, `Chapter ${fact.chapterNumber}: `)}{fact.text}
              </div>
            ))}
          </div>
        )}
      </details>
    </Section>
  )
}

export default function WorldStateView() {
  const text = useLocaleStore((s) => s.text)
  const language = useLocaleStore((s) => s.locale) as WorldStateLanguage
  const project = useProjectStore((s) => s.currentProject)
  const projectPath = project?.path ?? null
  const locale = useLocaleStore((s) => s.locale)

  /**
   * 读取结果连同「读的是哪个项目」一起存：项目切换后旧项目的数据不能冒充本项目的快照。
   * 不在 effect 里同步清状态（`react-hooks/set-state-in-effect`，先例见
   * ArchitectureConfirmDialog.tsx:219-223），改为按 `path` 判定新鲜度。
   */
  const [snapshot, setSnapshot] = useState<{
    path: string
    view: WorldStateViewData | null
    error: string | null
  } | null>(null)
  /** 手动刷新的在途标记：只有「作者点了刷新」才转圈，项目切换不转。 */
  const [refreshing, setRefreshing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  /** 正在补齐的名字：按钮在生成期间禁用，避免同名单并发启动两个工作流。 */
  const [pendingName, setPendingName] = useState<string | null>(null)
  /** 请求序号：项目切换 / 手动刷新时只接受最新一次的响应。 */
  const requestSeq = useRef(0)

  useEffect(() => {
    if (!projectPath) {
      requestSeq.current += 1
      return
    }

    requestSeq.current += 1
    const seq = requestSeq.current
    let cancelled = false

    ipc.invoke('world-state:read', projectPath)
      .then((view) => {
        if (cancelled || seq !== requestSeq.current) return
        setSnapshot({ path: projectPath, view, error: null })
        setRefreshing(false)
      })
      .catch((err: unknown) => {
        if (cancelled || seq !== requestSeq.current) return
        setSnapshot({
          path: projectPath,
          view: null,
          error: err instanceof Error ? err.message : String(err),
        })
        setRefreshing(false)
      })

    return () => { cancelled = true }
  }, [projectPath, reloadToken])

  const current = snapshot && snapshot.path === projectPath ? snapshot : null
  const data = current?.view ?? null
  const error = current?.error ?? null
  const loading = Boolean(projectPath) && (!current || refreshing)

  const handleRefresh = () => {
    setRefreshing(true)
    setReloadToken((token) => token + 1)
  }

  /**
   * 归位表 orphan → 「补齐并建卡」：与既有角色卡生成入口同构的披露与启动流程。
   *
   * 边界：
   * - 这里只启动两段式工作流（补全资料 → stage pending 批次）。确认与写入仍发生在
   *   任务面板和既有 approve seam，视图自身不写库。
   * - 模型披露先于任何输入发送；确认后再复核模型未被重指。
   * - 启动前复核会话（projectId + lease）：同路径重开后不能把任务带进新会话。
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
    } catch (error) {
      if (isProjectSessionCurrent(session)) toast.error(appErrorMessage(locale, error))
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
    <header className="flex-none border-b px-2.5 py-1.5" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Compass size={14} strokeWidth={1.75} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
          <span className="truncate text-xs font-medium" style={{ color: 'var(--color-text)' }}>
            {text('世界状态', 'World state')}
          </span>
          <span
            className="flex-shrink-0 rounded px-1 text-[0.6rem]"
            style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-muted)' }}
          >
            {text('只读', 'Read-only')}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          title={text('刷新', 'Refresh')}
          aria-label={text('刷新', 'Refresh')}
          disabled={!projectPath || loading}
          onClick={handleRefresh}
        >
          <RefreshCw size={14} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>
      <div className="mt-0.5 truncate text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }} title={fetchedLine}>
        {fetchedLine}
      </div>
    </header>
  )

  if (!projectPath) {
    return (
      <div className="flex h-full flex-col">
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
    <div className="flex h-full flex-col">
      {header}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1.5 py-1.5">
        {error && (
          <div className="rounded-md px-2 py-1 text-[0.7rem]" style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-error-text)' }}>
            {text('读取失败：', 'Failed to read: ')}{error}
          </div>
        )}
        {!data && !error && (
          <div className="px-1 py-2 text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>
            {text('读取中…', 'Loading…')}
          </div>
        )}
        {data && (
          <>
            <NoticesSection view={data} />
            <CastLedgerSection view={data} onComplete={startCompletion} pendingName={pendingName} />
            <ChaptersSection chapters={data.chapters} />
            <CharactersSection characters={data.characters} />
            <ContinuityFactsSection facts={data.continuityFacts} />
          </>
        )}
      </div>
    </div>
  )
}
