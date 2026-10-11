import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, ChevronRight, Globe, FolderOpen, RotateCcw, AlertTriangle, CheckCircle2, XCircle, Layers } from 'lucide-react'
import {
  ARCHITECTURE_PROMPT_KEYS,
  BUILTIN_PROMPTS,
  EDITABLE_PROMPT_KEYS,
  getBuiltinPromptTemplate,
  getPromptTemplate,
  getPromptSource,
  getPromptVariableDescription,
  saveCustomPrompt,
  saveProjectCustomPrompt,
  deleteCustomPrompt,
  deleteProjectCustomPrompt,
  clearProjectCustomPrompts,
  loadCustomPrompts,
  loadProjectCustomPrompts,
  type PromptTemplate,
} from '../../services/prompt-templates'
import { resolveWritingLanguage, type WritingLanguage } from '../../shared/writing-language'
import { isBuiltinOverrideStale, promptBuiltinRevision } from '../../services/prompt-builtin-revision'
import { useProjectStore } from '../../stores/project-store'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { captureProjectSession, isProjectSessionCurrent } from '../project-session-gate'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { useLocaleStore } from '../../stores/locale-store'
import { extractTemplateVariables, findDuplicatedBodyVariables } from '../../services/prompt-variable-usage'

// ==================== 来源标签配置 ====================

const SOURCE_CONFIG = {
  builtin: { label: '内置', labelEn: 'Built-in', color: 'var(--color-text-muted)', bg: 'var(--color-hover)' },
  global: { label: '全局', labelEn: 'Global', color: 'var(--color-info)', bg: 'color-mix(in srgb, var(--color-info) 10%, transparent)' },
  project: { label: '项目', labelEn: 'Project', color: 'var(--color-success-text)', bg: 'color-mix(in srgb, var(--color-success) 10%, transparent)' },
} as const

const PROMPT_META_EN: Record<string, { name: string; description: string }> = {
  assistant_writing_identity: { name: 'AI writing assistant identity', description: 'Define the creative role and working guidance for the writing assistant' },
  edit_selected_text: { name: 'Selected-text editing', description: 'Refine, expand, or rewrite selected story prose' },
  generate_novel_config_field: { name: 'Single configuration field', description: 'Complete one novel setting from existing author facts' },
  generate_global_config: { name: 'Full configuration', description: 'Generate a complete novel configuration from a short idea' },
  premise: { name: 'Story premise', description: 'Distill the central hook and chain of conflicts' },
  character_dynamics: { name: 'Character map', description: 'Build character arcs, relationships, and conflicts' },
  world_building: { name: 'World building', description: 'Build a world matrix that naturally creates conflict' },
  synopsis: { name: 'Plot synopsis', description: 'Combine the architecture into a structured plot outline' },
  chapter_blueprint: { name: 'Chapter blueprint', description: 'Plan the complete sequence of chapter-level events' },
  chapter_blueprint_chunk: { name: 'Blueprint segment', description: 'Plan a selected range of chapter-level events' },
  first_chapter_draft: { name: 'First chapter draft', description: 'Generate the complete first chapter' },
  next_chapter_draft: { name: 'Next chapter draft', description: 'Generate the next chapter from context and its blueprint' },
  refine_chapter: { name: 'Chapter revision', description: 'Improve a draft for clarity, craft, and impact' },
  consistency_check: { name: 'Consistency review', description: 'Check a chapter for continuity and consistency issues' },
  analyze_writing_style: { name: 'Style analysis', description: 'Extract an actionable style profile from sample text' },
  refine_from_review: { name: 'Review-driven revision', description: 'Revise a draft using findings from a review report' },
  generate_chapter_notes: { name: 'Chapter notes', description: 'Extract continuity notes from a completed chapter' },
  update_character_cards: { name: 'Character state update', description: 'Update character records from chapter facts' },
  infer_novel_config: { name: 'Infer novel configuration', description: 'Infer a configuration from imported prose' },
  extract_initial_characters: { name: 'Extract initial characters', description: 'Extract initial character records from imported material' },
  infer_single_chapter_blueprint: { name: 'Infer chapter blueprint', description: 'Infer a chapter blueprint from existing prose' },
  infer_novel_config_with_vectors: { name: 'Infer configuration from samples', description: 'Infer a configuration from retrieved source excerpts' },
}

// ==================== 主组件 ====================

/** 提示词模板设置面板 */
export default function PromptSettings() {
  const text = useLocaleStore(s => s.text)
  const project = useProjectStore((s) => s.currentProject)
  const projectId = project?.id ?? null
  const projectPath = project?.path ?? null
  const projectLease = project?.sessionLease ?? null
  const projectSession = projectId && projectPath && projectLease
    ? captureProjectSession({ id: projectId, path: projectPath, sessionLease: projectLease })
    : null
  const projectWritingLanguage = resolveWritingLanguage(project?.novelConfig.writingLanguage)
  const [languageSelection, setLanguageSelection] = useState<{
    projectId: string | null
    writingLanguage: WritingLanguage
  }>({ projectId: projectId ?? null, writingLanguage: projectWritingLanguage })
  const editingLanguage = languageSelection.projectId === (projectId ?? null)
    ? languageSelection.writingLanguage
    : projectWritingLanguage
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  // 强制刷新用（保存/恢复后 getPromptSource 的结果会变）
  const [refreshKey, setRefreshKey] = useState(0)
  const [globalLoadError, setGlobalLoadError] = useState<string | null>(null)
  const [projectLoadError, setProjectLoadError] = useState<{
    projectId: string
    leaseId: string
    message: string
  } | null>(null)

  useEffect(() => {
    let disposed = false
    void loadCustomPrompts(editingLanguage).then(() => {
      if (!disposed) {
        setGlobalLoadError(null)
        setRefreshKey((key) => key + 1)
      }
    }).catch(() => {
      if (!disposed) setGlobalLoadError(text('全局提示词加载失败，创作流程已停止使用未确认的配置', 'Global prompts could not be loaded; generation will not use an unverified configuration'))
    })
    return () => { disposed = true }
  }, [editingLanguage, text])

  // 项目变更时重新加载项目级覆盖
  useEffect(() => {
    const session = projectId && projectPath && projectLease
      ? captureProjectSession({ id: projectId, path: projectPath, sessionLease: projectLease })
      : null
    let disposed = false

    if (!session) {
      clearProjectCustomPrompts()
      return () => { disposed = true }
    }

    void loadProjectCustomPrompts(session, editingLanguage).then((loaded) => {
      if (!disposed && loaded && isProjectSessionCurrent(session)) {
        setProjectLoadError(null)
        setRefreshKey((k) => k + 1)
      }
    }).catch(() => {
      if (!disposed && isProjectSessionCurrent(session)) {
        setProjectLoadError({
          projectId: session.projectId,
          leaseId: session.leaseId,
          message: text('项目提示词加载失败，创作流程已停止使用未确认的配置', 'Project prompts could not be loaded; generation will not use an unverified configuration'),
        })
      }
    })
    return () => { disposed = true }
  }, [editingLanguage, projectId, projectLease, projectPath, text])

  // 获取可编辑的模板列表
  const editableTemplates = BUILTIN_PROMPTS
    .filter((template) => EDITABLE_PROMPT_KEYS.includes(template.key))
    .map((template) => getBuiltinPromptTemplate(template.key, editingLanguage) ?? template)

  const handleToggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key))
  }

  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  return (
    <div className="space-y-2" key={refreshKey}>
      {globalLoadError && (
        <div className="px-3 py-2 rounded-lg text-xs bg-red-500/10 text-[var(--color-error-text)] border border-red-500/20">
          <AlertTriangle size={13} className="inline mr-1" />
          {globalLoadError}
        </div>
      )}
      {projectLoadError
        && projectLoadError.projectId === projectSession?.projectId
        && projectLoadError.leaseId === projectSession.leaseId && (
        <div className="px-3 py-2 rounded-lg text-xs bg-red-500/10 text-[var(--color-error-text)] border border-red-500/20">
          <AlertTriangle size={13} className="inline mr-1" />
          {projectLoadError.message}
        </div>
      )}
      {/* 说明 */}
      <div
        className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs mb-4"
        style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-muted)' }}
      >
        <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{text('提示', 'Note')}</span>
        <span>
          {text('自定义提示词仅修改 AI 的创作指导策略，输出格式约束（如 JSON schema）会自动追加，不受自定义影响。支持两级覆盖：全局（所有小说生效）和项目（仅当前小说生效）。', 'Custom prompts change AI writing guidance only. Output constraints such as JSON schemas are appended automatically. Overrides can be global for all novels or project-specific.')}
          <br />
          {text('标注「架构链」的模板是故事架构的一整套（前提 → 角色图谱 → 世界观 → 弧光结构 → 情节大纲 → 章节蓝图），上下游互相咬合，建议保持内置默认；而草稿、精修、审稿属于可按你的文风定制的输出层。', 'Templates tagged “Architecture chain” form one interlocking story-architecture pipeline (premise → characters → world → arc structure → plot synopsis → chapter blueprint) and are best left at the built-in default. Drafting, revision, and review templates are the output layer you can freely customize.')}
        </span>
      </div>

      <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[var(--color-border)]">
        <span>
          <span className="block text-xs font-medium text-[var(--color-text)]">
            {text('编辑的写作语言', 'Writing language to edit')}
          </span>
          <span className="block text-[0.68rem] text-[var(--color-text-muted)]">
            {text('中英文覆盖独立保存，不会互相串用。', 'Chinese and English overrides are stored independently.')}
          </span>
        </span>
        <select
          value={editingLanguage}
          onChange={(event) => setLanguageSelection({
            projectId: projectId ?? null,
            writingLanguage: event.target.value as WritingLanguage,
          })}
          className="rounded-md px-2.5 py-1.5 text-xs bg-[var(--color-panel)] text-[var(--color-text)] border border-[var(--color-border)]"
          aria-label={text('编辑的写作语言', 'Writing language to edit')}
        >
          <option value="zh-CN">{text('简体中文', 'Chinese (Simplified)')}</option>
          <option value="en-US">English</option>
        </select>
      </label>

      {editableTemplates.map((builtinTemplate) => {
        const source = getPromptSource(builtinTemplate.key, projectSession ?? undefined, editingLanguage)
        const currentTemplate = getPromptTemplate(builtinTemplate.key, projectSession ?? undefined, editingLanguage) ?? builtinTemplate
        const isExpanded = expandedKey === builtinTemplate.key

        return (
          <TemplateItem
            key={`${projectSession?.projectId ?? 'no-project'}:${projectSession?.leaseId ?? 'no-lease'}:${editingLanguage}:${builtinTemplate.key}`}
            builtinTemplate={builtinTemplate}
            currentTemplate={currentTemplate}
            source={source}
            isExpanded={isExpanded}
            onToggle={() => handleToggle(builtinTemplate.key)}
            projectSession={projectSession}
            writingLanguage={editingLanguage}
            onSaved={triggerRefresh}
          />
        )
      })}
    </div>
  )
}

// ==================== 单个模板条目 ====================

function TemplateItem({
  builtinTemplate,
  currentTemplate,
  source,
  isExpanded,
  onToggle,
  projectSession,
  writingLanguage,
  onSaved,
}: {
  builtinTemplate: PromptTemplate
  currentTemplate: PromptTemplate
  source: 'builtin' | 'global' | 'project'
  isExpanded: boolean
  onToggle: () => void
  projectSession: ProjectSessionContext | null
  writingLanguage: WritingLanguage
  onSaved: () => void
}) {
  const text = useLocaleStore(s => s.text)
  const [editRole, setEditRole] = useState(currentTemplate.systemRole ?? '')
  const [editGuidance, setEditGuidance] = useState(
    currentTemplate.taskGuidance ?? (source === 'builtin' ? '' : currentTemplate.content),
  )
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [prevExpanded, setPrevExpanded] = useState(isExpanded)
  const [prevContent, setPrevContent] = useState(currentTemplate.content)

  // 展开时重置编辑内容
  if (isExpanded !== prevExpanded || currentTemplate.content !== prevContent) {
    if (isExpanded) {
      setEditRole(currentTemplate.systemRole ?? '')
      setEditGuidance(currentTemplate.taskGuidance ?? (source === 'builtin' ? '' : currentTemplate.content))
      setSaveResult(null)
    }
    setPrevExpanded(isExpanded)
    setPrevContent(currentTemplate.content)
  }

  const sourceConf = SOURCE_CONFIG[source]
  // 架构链模板：产物环环相扣并被全书引用，改一处会级联整条链 —— 只标注，不限制编辑。
  const isArchitecture = ARCHITECTURE_PROMPT_KEYS.includes(builtinTemplate.key)
  // 覆盖文件里冻结的是**保存当时**的内置正文，因此内置模板升级后它不会自动跟进。
  // 这里只做提示：不动数据、不自动合并（无法区分「作者有意定制」与「旧版原样副本」）。
  const builtinRevisionValue = promptBuiltinRevision(builtinTemplate)
  const builtinOutdated = source !== 'builtin' && isBuiltinOverrideStale(currentTemplate, builtinTemplate)
  // 模板正文（content）本身就会渲染的变量。正文不在这个面板里显示，但每次请求都会先渲染一遍；
  // 把同一个变量再插进「补充创作指导」，等于把同一段内容注入两遍（白占上下文、还稀释指令）。
  // 这里给这类变量打标记，并对已经插进去的实时给提示 —— 只提示，不自动改写作者的文本。
  const bodyVariables = new Set(extractTemplateVariables(currentTemplate.content ?? ''))
  const duplicatedVariables = findDuplicatedBodyVariables(currentTemplate.content ?? '', editGuidance)

  // 插入变量到光标位置
  const insertVariable = (varName: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = `{{${varName}}}`
    const newContent = editGuidance.slice(0, start) + text + editGuidance.slice(end)
    setEditGuidance(newContent)
    // 恢复光标
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
    })
  }

  // 保存到全局
  const handleSaveGlobal = async () => {
    setSaving(true)
    setSaveResult(null)
    const template: PromptTemplate = {
      ...builtinTemplate,
      writingLanguage,
      // ★ 记录保存当时的内置版本；内置升级后据此提示「这份覆盖仍沿用旧版内容」。
      builtinRevision: builtinRevisionValue,
      systemRole: editRole,
      taskGuidance: editGuidance,
    }
    delete (template as Partial<PromptTemplate>).systemSuffix
    const ok = await saveCustomPrompt(template)
    setSaving(false)
    setSaveResult(ok ? { type: 'success', msg: text('已保存到全局配置', 'Saved to global settings') } : { type: 'error', msg: text('保存失败', 'Save failed') })
    if (ok) onSaved()
    setTimeout(() => setSaveResult(null), 3000)
  }

  // 保存到项目
  const handleSaveProject = async () => {
    if (!projectSession || !isProjectSessionCurrent(projectSession)) return
    const operationSession = projectSession
    setSaving(true)
    setSaveResult(null)
    const template: PromptTemplate = {
      ...builtinTemplate,
      writingLanguage,
      // ★ 记录保存当时的内置版本；内置升级后据此提示「这份覆盖仍沿用旧版内容」。
      builtinRevision: builtinRevisionValue,
      systemRole: editRole,
      taskGuidance: editGuidance,
    }
    delete (template as Partial<PromptTemplate>).systemSuffix
    const ok = await saveProjectCustomPrompt(operationSession, template)
    if (!isProjectSessionCurrent(operationSession)) return
    if (ok) await loadProjectCustomPrompts(operationSession, writingLanguage)
    if (!isProjectSessionCurrent(operationSession)) return
    setSaving(false)
    setSaveResult(ok ? { type: 'success', msg: text('已保存到当前项目', 'Saved to this project') } : { type: 'error', msg: text('保存失败', 'Save failed') })
    if (ok) onSaved()
    setTimeout(() => setSaveResult(null), 3000)
  }

  // 恢复默认
  const handleReset = async () => {
    const operationSession = projectSession
    setSaving(true)
    setSaveResult(null)
    // 依次删除项目级和全局级覆盖
    if (operationSession) {
      if (!isProjectSessionCurrent(operationSession)) return
      const projectDeleted = await deleteProjectCustomPrompt(operationSession, builtinTemplate.key, writingLanguage)
      if (!isProjectSessionCurrent(operationSession)) return
      if (!projectDeleted) {
        setSaving(false)
        setSaveResult({ type: 'error', msg: text('恢复默认失败', 'Could not restore the default') })
        return
      }
    }
    const globalDeleted = await deleteCustomPrompt(builtinTemplate.key, writingLanguage)
    if (operationSession && !isProjectSessionCurrent(operationSession)) return
    if (!globalDeleted) {
      setSaving(false)
      setSaveResult({ type: 'error', msg: text('恢复默认失败', 'Could not restore the default') })
      return
    }
    if (operationSession) {
      await loadProjectCustomPrompts(operationSession, writingLanguage)
      if (!isProjectSessionCurrent(operationSession)) return
    }
    setEditRole(builtinTemplate.systemRole ?? '')
    setEditGuidance('')
    setSaving(false)
    setSaveResult({ type: 'success', msg: text('已恢复为内置默认', 'Restored built-in default') })
    onSaved()
    setTimeout(() => setSaveResult(null), 3000)
  }

  return (
    <div
      className="rounded-xl overflow-hidden transition-colors"
      style={{
        border: `1px solid ${isExpanded ? 'var(--color-accent)' : 'var(--color-border)'}`,
        backgroundColor: 'var(--color-panel)',
      }}
    >
      {/* 折叠头部 */}
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[var(--color-hover)] outline-none focus:outline-none"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        ) : (
          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {text(builtinTemplate.name, PROMPT_META_EN[builtinTemplate.key]?.name ?? builtinTemplate.name)}
            </span>
            <span
              className="text-[0.65rem] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
              style={{ color: sourceConf.color, backgroundColor: sourceConf.bg }}
            >
              {text(sourceConf.label, sourceConf.labelEn)}
            </span>
            {isArchitecture && (
              <span
                className="text-[0.65rem] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 inline-flex items-center gap-1"
                style={{
                  color: 'var(--color-info)',
                  backgroundColor: 'color-mix(in srgb, var(--color-info) 12%, transparent)',
                }}
                title={text(
                  '故事架构链模板：每一步的产物都是下一步的输入，并被后续所有章节的蓝图与正文引用。改动会沿链级联，不建议修改。',
                  'Story-architecture chain template: each step feeds the next and is cited by every later chapter blueprint and draft. Edits cascade down the chain and are not recommended.',
                )}
              >
                <Layers size={10} />
                {text('架构链', 'Architecture chain')}
              </span>
            )}
            {builtinOutdated && (
              <span
                className="text-[0.65rem] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 inline-flex items-center gap-1"
                style={{
                  color: 'var(--color-warning)',
                  backgroundColor: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
                }}
                title={text(
                  '内置模板已更新，但当前生效的是覆盖文件（沿用保存当时的旧版内置内容）',
                  'The built-in template was updated, but an override is in effect and still uses the older built-in content',
                )}
              >
                <AlertTriangle size={10} />
                {text('内置已更新', 'Built-in updated')}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
            {text(builtinTemplate.description, PROMPT_META_EN[builtinTemplate.key]?.description ?? builtinTemplate.description)}
          </p>
        </div>
      </button>

      {/* 展开编辑区 */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          {/* 架构链：整条链互相咬合，这里只提醒「不建议改」，不阻止作者定制。 */}
          {isArchitecture && (
            <div
              className="mt-3 rounded-lg px-3 py-2.5 text-[0.68rem] leading-relaxed"
              style={{
                color: 'var(--color-info)',
                backgroundColor: 'color-mix(in srgb, var(--color-info) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-info) 25%, transparent)',
              }}
            >
              <Layers size={12} className="inline mr-1" />
              {text(
                '这是「故事架构链」模板（前提 → 角色图谱 → 世界观 → 弧光结构 → 情节大纲 → 章节蓝图），一套互相咬合的产物：每一步的输出是下一步的输入，并且会被后续所有章节的蓝图与正文引用。建议保持内置默认 —— 确需定制时，请在「补充创作指导」里增补你的要求，不要删改正文里的输出契约、字段清单与判定标准，否则下游会连锁失准。',
                'This is a story-architecture chain template (premise → characters → world → arc structure → plot synopsis → chapter blueprint). The steps interlock: each output feeds the next and is cited by every later chapter blueprint and draft. Keep the built-in default; if you must customize, add your requirements under “Additional creative guidance” rather than editing the output contracts, field lists, and decision criteria in the body, which would misalign everything downstream.',
              )}
            </div>
          )}
          {/* W1：覆盖文件会冻结保存当时的内置正文，内置升级后不会自动跟进 —— 只提示，不自动改。 */}
          {builtinOutdated && (
            <div
              className="mt-3 rounded-lg px-3 py-2.5 text-[0.68rem] leading-relaxed"
              style={{
                color: 'var(--color-warning)',
                backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
              }}
            >
              <AlertTriangle size={12} className="inline mr-1" />
              {text(
                '内置模板已更新，但当前生效的是「全局 / 项目」覆盖 —— 它冻结了保存当时的旧版内置正文与说明，新版的改进不会自动生效。若想采用新版，点「恢复默认」后再按需重新定制（注意：该操作会清除你对该模板的全部自定义）。本提示不会自动修改任何内容。',
                'The built-in template has been updated, but a global/project override is in effect. It froze the older built-in body and description, so improvements in the new version do not apply. To adopt them, use “Restore default” and re-customize as needed (this clears all your customizations for this template). Nothing is changed automatically.',
              )}
            </div>
          )}
          {/* 变量标签栏 */}
          <div className="pt-3">
            <p className="text-[0.68rem] font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
              {text('可用变量（点击插入到光标位置）', 'Available variables (click to insert)')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(builtinTemplate.variables).map(([varName, desc]) => {
                const englishDescription = getPromptVariableDescription(builtinTemplate, varName, 'en-US')
                const inBody = bodyVariables.has(varName)
                return (
                  <button
                    key={varName}
                    onClick={() => insertVariable(varName)}
                    title={inBody
                      ? text(`${desc} —— 模板正文已渲染该变量，再插入会重复注入`, `${englishDescription} — the template body already renders this variable; inserting it again duplicates the content`)
                      : text(desc, englishDescription)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[0.68rem] transition-colors hover:bg-[var(--color-accent)] hover:text-white outline-none focus:outline-none"
                    style={{
                      backgroundColor: inBody ? 'color-mix(in srgb, var(--color-warning) 10%, transparent)' : 'var(--color-hover)',
                      color: inBody ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                      border: `1px solid ${inBody ? 'color-mix(in srgb, var(--color-warning) 30%, transparent)' : 'var(--color-border)'}`,
                    }}
                  >
                    <code className="font-mono">{`{{${varName}}}`}</code>
                    <span className="opacity-60 max-w-[120px] truncate">{text(desc, englishDescription)}</span>
                    {inBody && <span className="opacity-80">{text('·正文已用', '·in body')}</span>}
                  </button>
                )
              })}
            </div>
            {duplicatedVariables.length > 0 && (
              <div
                className="mt-2.5 rounded-lg px-3 py-2.5 text-[0.68rem] leading-relaxed"
                style={{
                  color: 'var(--color-warning)',
                  backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
                }}
              >
                <AlertTriangle size={12} className="inline mr-1" />
                {text(
                  `「补充创作指导」里有 ${duplicatedVariables.length} 个变量（${duplicatedVariables.map((name) => `{{${name}}}`).join('、')}）是模板正文本身就会渲染的 —— 同一段内容会被注入两遍，既白占上下文、又会稀释指令。建议把这几处 {{变量}} 删掉，只保留你真正想额外补充的要求。`,
                  `${duplicatedVariables.length} variable(s) in “Additional creative guidance” (${duplicatedVariables.map((name) => `{{${name}}}`).join(', ')}) are already rendered by the template body. They inject the same content twice, wasting context and diluting instructions. Remove them and keep only what you want to add.`,
                )}
              </div>
            )}
          </div>

          <label className="block">
            <span className="block text-[0.68rem] font-medium mb-1.5 text-[var(--color-text-muted)]">
              {text('创作角色定位', 'Creative role')}
            </span>
            <textarea
              value={editRole}
              onChange={(event) => setEditRole(event.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-xs resize-y outline-none focus:border-[var(--color-accent)]"
              style={{
                backgroundColor: 'var(--color-editor-bg)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                minHeight: '84px',
                lineHeight: 1.6,
              }}
              spellCheck={false}
            />
          </label>

          {/* 用户层只追加创作指导；内置任务与输出合同保持隐藏且不可改。 */}
          <div>
            <p className="text-[0.68rem] font-medium mb-1.5 text-[var(--color-text-muted)]">
              {text('补充创作指导', 'Additional creative guidance')}
            </p>
            <textarea
              ref={textareaRef}
              aria-label={text('补充创作指导', 'Additional creative guidance')}
              value={editGuidance}
              onChange={(e) => setEditGuidance(e.target.value)}
              placeholder={text('例如：优先通过角色行动体现冲突，避免概括式说明。', 'For example: reveal conflict through character action instead of summary.')}
              className="w-full rounded-lg px-3 py-2.5 text-xs font-mono resize-y outline-none focus:outline-none"
              style={{
                backgroundColor: 'var(--color-editor-bg)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                minHeight: '140px',
                maxHeight: '500px',
                lineHeight: 1.6,
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
              spellCheck={false}
            />
          </div>


          {/* 操作按钮 */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveGlobal}
              disabled={saving}
              title={text('保存到全局配置（所有小说生效）', 'Save globally for all novels')}
            >
              <Globe size={12} />
              {text('保存到全局', 'Save globally')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveProject}
              disabled={saving || !projectSession}
              title={projectSession ? text('保存到当前项目（仅此小说生效）', 'Save for this project only') : text('请先打开一个项目', 'Open a project first')}
            >
              <FolderOpen size={12} />
              {text('保存到项目', 'Save to project')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={saving || source === 'builtin'}
              title={text('恢复为内置默认版本', 'Restore built-in default')}
            >
              <RotateCcw size={12} />
              {text('恢复默认', 'Restore default')}
            </Button>
          </div>

          {/* 保存结果反馈 */}
          {saveResult && (
            <div
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg',
                saveResult.type === 'success'
                  ? 'bg-green-500/10 text-[var(--color-success-text)] border border-green-500/20'
                  : 'bg-red-500/10 text-[var(--color-error-text)] border border-red-500/20'
              )}
            >
              {saveResult.type === 'success'
                ? <CheckCircle2 size={13} className="inline mr-1" />
                : <XCircle size={13} className="inline mr-1" />}
              {saveResult.msg}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
