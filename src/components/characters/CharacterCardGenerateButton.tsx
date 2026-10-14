import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sparkles, History, Wand2 } from 'lucide-react'
import type { CharacterProposalHistoryEntry } from '../../shared/character-proposal'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { useProjectStore } from '../../stores/project-store'
import { useLocaleStore } from '../../stores/locale-store'
import { useLLMStore } from '../../stores/llm-store'
import { useLayoutStore } from '../../stores/layout-store'
import { useWorkflowStore, workflowResourceConflictMessage } from '../../stores/workflow-store'
import { createCharacterCardGenerationWorkflow, createCharacterProposalReviewWorkflow } from '../../services/workflows/character-card-generation-workflow'
import { createPlanningMaterialCharacterExtractionWorkflow } from '../../services/workflows/planning-material-workflow'
import { listCharacterProposalHistory, restageCharacterProposalBatch, groupCharacterProposalHistory, characterProposalStatusLabel } from '../../services/character-proposal-history-client'
import { selectPlanningMaterials, type PlanningMaterial } from '../../services/knowledge-service'
import { appErrorMessage } from '../../i18n/app-errors'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'
import { confirm } from '../ui/Confirm'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '../ui/Dialog'
import { toast } from '../ui/Toast'
import { cn } from '../../lib/utils'

interface Props {
  projectKey: string
  compact?: boolean
  disabled?: boolean
  /** Controls whether the dialog opens on the history tab instead of the compose tab. */
  initialView?: 'compose' | 'history'
}

/**
 * The single character-card AI entry point (P1 + P2 share it).
 *
 * Sources are distinguished by a multi-select inside one dialog, so the
 * blueprint path (P1) and the free-form generation paths (P2) cannot drift into
 * two competing entry points. Nothing here writes the roster: the staged batch
 * still crosses the character-proposal confirmation seam.
 */
export function CharacterCardGenerateButton(props: Props) {
  const project = useProjectStore(state => state.currentProject)
  const session = captureProjectSession(project)
  if (!session || !isProjectSessionPath(session, props.projectKey)) return null
  return <SessionGenerateButton key={JSON.stringify(session)} {...props} session={session} />
}

function SessionGenerateButton({ session, compact, disabled, initialView = 'compose' }: Props & { session: ProjectSessionContext }) {
  const { locale, text } = useLocaleStore()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'compose' | 'history'>(initialView)
  const [busy, setBusy] = useState(false)

  // Source selection. `blueprint` needs no author input; the others do.
  const [sources, setSources] = useState({ blueprint: false, premise: false, material: false, character: false })
  const [pasted, setPasted] = useState('')
  const [files, setFiles] = useState<PlanningMaterial[]>([])
  const [characterName, setCharacterName] = useState('')
  const [history, setHistory] = useState<CharacterProposalHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [readingId, setReadingId] = useState<string | null>(null)

  const selectedCount = Object.values(sources).filter(Boolean).length
  const canSend = selectedCount > 0 && (sources.blueprint || sources.premise || sources.character
    ? true
    : files.length > 0 || Boolean(pasted.trim()))

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const entries = await listCharacterProposalHistory(session)
      if (isProjectSessionCurrent(session)) setHistory(entries)
    } catch (error) {
      if (isProjectSessionCurrent(session)) toast.error(appErrorMessage(locale, error))
    } finally {
      if (isProjectSessionCurrent(session)) setHistoryLoading(false)
    }
  }, [locale, session])

  useEffect(() => {
    if (!open || view !== 'history') return
    void loadHistory()
  }, [loadHistory, open, view])

  async function chooseFiles() {
    setBusy(true)
    try {
      const selected = await selectPlanningMaterials()
      if (isProjectSessionCurrent(session) && selected.length) {
        setFiles(previous => [...previous, ...selected.filter(file => !previous.some(item => item.fileName === file.fileName))])
      }
    } catch (error) {
      if (isProjectSessionCurrent(session)) toast.error(appErrorMessage(locale, error))
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  /** Model disclosure is a hard precondition: no model, no send. */
  function resolveModel() {
    const llm = useLLMStore.getState()
    return llm.models.find(candidate => candidate.id === llm.defaultModelId)
  }

  async function revealModelAndConfirm(model: NonNullable<ReturnType<typeof resolveModel>>, purpose: string) {
    return confirm(text(
      `本次全部输入将发送到以下模型端点，用于${purpose}。生成后需预览并确认，才会写入角色名单。\n\n模型：${model.name} (${model.modelName})\n端点：${model.baseUrl}\n\n是否发送？`,
      `All input will be sent to the following model endpoint for ${purpose}. Preview and confirmation are required before the roster changes.\n\nModel: ${model.name} (${model.modelName})\nEndpoint: ${model.baseUrl}\n\nSend?`,
    ), { title: text('AI 生成角色卡', 'AI character-card generation'), confirmText: text('发送', 'Send') })
  }

  async function send() {
    if (busy || !canSend || !isProjectSessionCurrent(session)) return
    const model = resolveModel()
    if (!model) {
      toast.warning(text('请先到设置 → 模型配置，添加并选择默认生成模型；输入内容已保留。', 'Add and select a default generation model in Settings → Models first. Your input has been kept.'))
      return
    }
    setBusy(true)
    setOpen(false)
    try {
      const purpose = sources.character ? '为指定角色补全人物背景' : sources.material ? '从创作资料提取角色卡' : '根据前提与配置生成角色卡'
      const allowed = await revealModelAndConfirm(model, purpose)
      if (!isProjectSessionCurrent(session)) return
      if (!allowed) { setOpen(true); return }
      // Re-check the model has not been re-pointed between disclosure and send.
      const currentModel = resolveModel()
      if (!currentModel || currentModel.baseUrl !== model.baseUrl || currentModel.modelName !== model.modelName) {
        setOpen(true)
        toast.warning(text('模型配置已改变，请重新确认后发送。', 'The model configuration changed. Confirm again before sending.'))
        return
      }

      const workflow = sources.material
        ? createPlanningMaterialCharacterExtractionWorkflow({
          projectSession: session,
          materials: [...files, ...(pasted.trim() ? [{ fileName: text('粘贴的角色卡.txt', 'Pasted character cards.txt'), text: pasted }] : [])],
          generationModelId: model.id,
        }, locale)
        : createCharacterCardGenerationWorkflow({
          projectSession: session,
          sources,
          characterName: characterName.trim(),
          generationModelId: model.id,
        }, locale)
      const conflict = useWorkflowStore.getState().getResourceConflict(workflow)
      if (conflict) {
        setOpen(true)
        toast.warning(workflowResourceConflictMessage(locale, conflict.title))
        return
      }
      useLayoutStore.getState().openBottomTab('tasks')
      await useWorkflowStore.getState().startWorkflow(workflow, true)
      if (!isProjectSessionCurrent(session)) return
      toast.success(text('已生成角色卡候选，请在任务面板中预览确认。', 'Character-card candidates were generated. Preview and confirm them in the task panel.'))
    } catch (error) {
      if (isProjectSessionCurrent(session)) { setOpen(true); toast.error(appErrorMessage(locale, error)) }
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  /**
   * 「让旧版生效」—— 把旧版候选恢复成一次**待确认的运行**，由作者在确认面板里决定采用方式。
   *
   * 关键约束：
   * - 不重跑模型。旧版输出是已存在的产物，不是新点子的种子。
   * - 不原地改写旧记录。stage 对 proposalBatchId 幂等，所以拿回的就是同一个批次。
   * - 确认面板绑定在**等待中的运行**上，因此这里必须新建一个「只走确认步」的工作流，
   *   而不是把批次塞进状态里 —— 否则面板没有可提交的 operationId。
   */
  async function adoptHistoryEntry(entry: CharacterProposalHistoryEntry) {
    if (busy || !isProjectSessionCurrent(session)) return
    setReadingId(entry.proposalBatchId)
    try {
      if (entry.status === 'cancelled') {
        toast.warning(text('该批次已取消；可在角色列表顶部的「待处理角色候选」里重新打开它。', 'That batch was cancelled; reopen it from "Pending character candidates" at the top of the character list.'))
        return
      }
      const batch = await restageCharacterProposalBatch(session, entry.source)
      if (!isProjectSessionCurrent(session)) return
      const pending = batch.items.filter(item => item.resolution.status !== 'resolved')
      if (!pending.length) {
        toast.info(text('这一版的候选都已并入名册，无需再采用。', 'Every candidate in this version is already on the roster.'))
        return
      }
      const allowed = await confirm(text(
        `将把「${entry.label}」的 ${pending.length} 个候选放回确认面板，由你确认采用。\n\n旧记录不会被改写，也不会重跑模型。\n\n继续？`,
        `This puts ${pending.length} candidate(s) from "${entry.label}" back onto the confirmation panel for you to adopt.\n\nThe old record is not rewritten and the model is not re-run.\n\nContinue?`,
      ), { title: text('让旧版生效', 'Adopt an earlier version'), confirmText: text('放回确认面板', 'Reopen for confirmation') })
      if (!isProjectSessionCurrent(session)) return
      if (!allowed) return
      const workflow = createCharacterProposalReviewWorkflow({ projectSession: session, batch }, locale)
      const conflict = useWorkflowStore.getState().getResourceConflict(workflow)
      if (conflict) {
        toast.warning(workflowResourceConflictMessage(locale, conflict.title))
        return
      }
      useLayoutStore.getState().openBottomTab('tasks')
      await useWorkflowStore.getState().startWorkflow(workflow, true)
      if (!isProjectSessionCurrent(session)) return
      toast.success(text('旧版候选已放回任务面板，请在确认面板中决定采用方式。', 'The earlier candidates are back in the task panel. Decide adoption there.'))
      setOpen(false)
    } catch (error) {
      if (isProjectSessionCurrent(session)) toast.error(appErrorMessage(locale, error))
    } finally {
      if (isProjectSessionCurrent(session)) setReadingId(null)
    }
  }

  const grouped = useMemo(() => groupCharacterProposalHistory(history, text), [history, text])
  const label = text('AI 生成角色卡', 'Generate character cards with AI')
  const toggle = (key: keyof typeof sources) => setSources(previous => ({ ...previous, [key]: !previous[key] }))

  return <>
    <Button variant="ghost" size={compact ? 'icon' : 'sm'} className={compact ? 'h-6 w-6' : undefined}
      disabled={disabled || busy} title={label} aria-label={label}
      onClick={() => { setView('compose'); setOpen(true) }}>
      <Sparkles size={14} />{!compact && label}
    </Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value) }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{text('选择来源后由 AI 生成候选，预览确认前不会写入角色名单。', 'Pick sources, let AI draft candidates, and confirm before the roster changes.')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-1 px-6 pt-3">
          {(['compose', 'history'] as const).map(tab => (
            <button key={tab} type="button" onClick={() => setView(tab)}
              className={cn('rounded-md px-2.5 py-1 text-xs', view === tab ? 'bg-[var(--color-active)] text-[var(--color-text)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]')}>
              {tab === 'compose' ? <span className="flex items-center gap-1"><Wand2 size={12} />{text('生成', 'Generate')}</span>
                : <span className="flex items-center gap-1"><History size={12} />{text('历史生成', 'History')}</span>}
            </button>
          ))}
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {view === 'compose' ? <div className="space-y-4">
            <p className="text-xs text-[var(--color-text-secondary)]">{text('可多选来源；未选任何来源时不能发送。', 'Multiple sources may be combined. Nothing is sent until at least one source is chosen.')}</p>
            <SourceRow checked={sources.blueprint} onChange={() => toggle('blueprint')} disabled={busy}
              title={text('章节蓝图中的待建角色', 'Characters named by chapter blueprints')}
              description={text('使用已提交蓝图里声明的新角色候选（含每章溯源）。', 'Use candidates declared by committed blueprints, with per-chapter provenance.')} />
            <SourceRow checked={sources.premise} onChange={() => toggle('premise')} disabled={busy}
              title={text('故事前提与配置', 'Story premise and configuration')}
              description={text('依据世界观设定、题材与主要冲突生成角色模板。', 'Draft character templates from premise, genre, and core conflict.')} />
            <SourceRow checked={sources.material} onChange={() => toggle('material')} disabled={busy}
              title={text('创作资料（粘贴 / 导入）', 'Planning material (paste / import)')}
              description={text('从粘贴文本或资料文件中提取明确角色事实。', 'Extract explicit character facts from pasted text or files.')} />
            {sources.material && <div className="space-y-2 rounded-md border border-[var(--color-border)] p-3">
              <textarea aria-label={text('角色资料全文', 'Character material text')} value={pasted} onChange={event => setPasted(event.target.value)} disabled={busy} rows={5}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm" />
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void chooseFiles()}>{text('选择文件', 'Choose files')}</Button>
              {files.length > 0 && <div className="text-xs break-all">{files.map(file => file.fileName).join('、')}
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setFiles([])}>{text('清除文件', 'Clear files')}</Button></div>}
            </div>}
            <SourceRow checked={sources.character} onChange={() => toggle('character')} disabled={busy}
              title={text('为指定角色补全背景', 'Flesh out a specific character')}
              description={text('对一个从未出现的新角色，用大纲与蓝图推断一段有张力的人物背景。', 'For a never-seen character, infer a high-tension background from the outline and blueprints.')} />
            {sources.character && <div className="space-y-2 rounded-md border border-[var(--color-border)] p-3">
              <label className="grid gap-1 text-xs">
                <span>{text('角色名（一次一个）', 'Character name (one at a time)')}</span>
                <input aria-label={text('要补全背景的角色名', 'Character name to flesh out')} value={characterName} onChange={event => setCharacterName(event.target.value)} disabled={busy}
                  className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1" />
              </label>
              <p className="text-xs text-[var(--color-text-secondary)]">{text('生成要求：至少包含一个内在矛盾；必须与卷纲主线挂钩；不得与既有角色卡同质化。', 'Requirements: at least one internal contradiction; must tie into the volume mainline; must not duplicate an existing card.')}</p>
            </div>}
          </div> : <div className="space-y-3">
            {historyLoading ? <p className="text-xs text-[var(--color-text-secondary)]">{text('正在读取历史…', 'Loading history…')}</p>
              : !history.length ? <p className="text-xs text-[var(--color-text-secondary)]">{text('暂无生成记录。每点一次生成都会新增一条，可随时回看。', 'No generations yet. Each run adds an entry you can revisit.')}</p>
                : grouped.map(section => <section key={section.group} className="space-y-1">
                  <p className="text-xs font-medium text-[var(--color-text)]">{section.label}</p>
                  {section.entries.map(entry => <div key={entry.proposalBatchId} className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs">
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    <span className="text-[var(--color-text-secondary)]">{characterProposalStatusLabel(entry.status, text)}</span>
                    <Button variant="ghost" size="sm" disabled={busy || readingId === entry.proposalBatchId} onClick={() => void adoptHistoryEntry(entry)}>
                      {readingId === entry.proposalBatchId ? text('读取中…', 'Loading…') : text('让旧版生效', 'Adopt this version')}
                    </Button>
                  </div>)}
                </section>)}
            <p className="text-xs text-[var(--color-text-secondary)]">{text('按来源分组展示；记录中没有时间戳，因此不承诺时间顺序。', 'Grouped by source. The ledger stores no timestamp, so no time order is implied.')}</p>
          </div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{text('关闭', 'Close')}</Button>
          {view === 'compose' && <Button disabled={busy || !canSend} onClick={() => void send()}>
            {busy ? text('处理中…', 'Working…') : text('生成并预览', 'Generate and preview')}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}

function SourceRow({ checked, onChange, disabled, title, description }: {
  checked: boolean
  onChange(): void
  disabled: boolean
  title: string
  description: string
}) {
  return <label className="flex cursor-pointer gap-2.5 rounded-md border border-[var(--color-border)] p-3">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="mt-0.5" />
    <span className="grid gap-0.5">
      <span className="text-xs font-medium text-[var(--color-text)]">{title}</span>
      <span className="text-xs text-[var(--color-text-secondary)]">{description}</span>
    </span>
  </label>
}
