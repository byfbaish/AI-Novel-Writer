/**
 * CharactersView — 角色管理列表视图
 */

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Users, RefreshCw, Plus, Search, Trash2, CheckSquare, X } from 'lucide-react'
import { useProjectStore } from '../../../stores/project-store'
import { characterSelectionKey, characterRevivalEvents, useCharacterStore } from '../../../stores/character-store'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { EmptyState } from '../../ui/EmptyState'
import { cn } from '../../../lib/utils'
import { useLocaleStore } from '../../../stores/locale-store'
import { getCharacterRoleLabels } from '../../../shared/character-role'
import { CharacterCardImportButton } from '../../characters/CharacterCardImportButton'
import { CharacterProposalInbox } from '../../characters/CharacterProposalInbox'
import { CharacterCastPanel } from '../../characters/CharacterCastPanel'
import { CharacterCardGenerateButton } from '../../characters/CharacterCardGenerateButton'
import { FinalizedCharacterProposalPanel } from '../../characters/FinalizedCharacterProposalPanel'
import { FinalizedCharacterStateCandidatePanel } from '../../characters/FinalizedCharacterStateCandidatePanel'
import { useCharacterAvatars } from '../../editor/use-character-avatars'
import { confirm } from '../../ui/Confirm'
import { toast } from '../../ui/Toast'
import { appErrorMessage } from '../../../i18n/app-errors'
import { projectSessionContextFromProject, sameProjectSessionContext } from '../../../shared/project-session-context'
import { ipc } from '../../../services/ipc-client'
import {
  CHARACTER_RELEVANCE_LAYERS,
  blueprintDeclarationsFromSyncOperations,
  characterRelevance,
  characterRelevanceReasonSlots,
  characterRelevanceVisible,
  outlineSourceFromProjectCore,
  sortCharactersForDisplay,
  type CharacterRelevance,
  type CharacterRelevanceContext,
  type CharacterRelevanceLayer,
  type CharacterRelevanceLayers,
  type CharacterRelevanceReason,
  type CharacterRelevanceSortKey,
} from '../../../shared/character-relevance'

const CHARACTER_PAGE_SIZE = 50

export default function CharactersView() {
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  /**
   * 批量删除模式。存在的理由：角色图谱重生成后，旧角色会与新角色共存，
   * 而"同名覆盖、异名保留"意味着作者常常要一次清掉十几个角色卡，
   * 逐个进编辑器点删除既慢、又会让每次删除各走一次 roster 原子提交。
   */
  const [selectionMode, setSelectionMode] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  /**
   * 相关性三档（设计稿 §3.1）：默认全开＝不筛，只决定「显示与标签」。
   * 它**不许**写 `picked` —— 勾选只能是作者的动作，否则"批量删除"会替作者选中。
   */
  const [relevanceLayers, setRelevanceLayers] = useState<CharacterRelevanceLayers>({ relationship: true, blueprint: true, outline: true })
  const [relevanceSort, setRelevanceSort] = useState<CharacterRelevanceSortKey>('relevance')
  /** null = 档②／③ 数据尚未读到（或读失败）：这一轮不筛、不标原因、不报错。 */
  const [relevanceContext, setRelevanceContext] = useState<CharacterRelevanceContext | null>(null)
  const [expandedReasonKeys, setExpandedReasonKeys] = useState<string[]>([])
  const currentProject = useProjectStore(s => s.currentProject)
  const characters = useCharacterStore(s => s.characters)
  const dataProjectKey = useCharacterStore(s => s.dataProjectKey)
  const loadingProjectKey = useCharacterStore(s => s.loadingProjectKey)
  const selectedId = useCharacterStore(s => s.selectedId)
  const load = useCharacterStore(s => s.load)
  const setSelectedId = useCharacterStore(s => s.setSelectedId)
  const addCharacter = useCharacterStore(s => s.addCharacter)
  const deleteCharacters = useCharacterStore(s => s.deleteCharacters)
  const identityBusy = useCharacterStore(s => s.identityBusy)
  const lastError = useCharacterStore(s => s.lastError)
  const text = useLocaleStore(s => s.text)
  const locale = useLocaleStore(s => s.locale)
  const roleLabel = (role: unknown) => {
    const { zhCN, enUS } = getCharacterRoleLabels(role)
    return text(zhCN, enUS)
  }
  const relevanceLayerLabel = (layer: CharacterRelevanceLayer) => (layer === 'relationship'
    ? text('有关系对象', 'Has relationships')
    : layer === 'blueprint'
      ? text('被蓝图声明', 'Declared by blueprint')
      : text('在大纲／世界观', 'In outline / worldbuilding'))
  /** 命中原因文案（结构化事实 → 一行的可读短语）。 */
  const relevanceReasonText = (reason: CharacterRelevanceReason) => {
    if (reason.layer === 'relationship') {
      return reason.count > 0
        ? text(`有 ${reason.count} 条关系`, `${reason.count} relationship${reason.count > 1 ? 's' : ''}`)
        : text('有关系记录', 'Has relationship notes')
    }
    if (reason.layer === 'blueprint') {
      return text(
        `蓝图声明过（第 ${reason.chapters.join('、')} 章）`,
        `Declared in blueprint (ch. ${reason.chapters.join(', ')})`,
      )
    }
    return text('出现在大纲／世界观', 'In outline / worldbuilding')
  }
  const dataReady = Boolean(
    currentProject
    && dataProjectKey === currentProject.path
    && loadingProjectKey === null
    && lastError === null,
  )
  const visibleCharacters = dataReady ? characters : []
  /**
   * 每张卡的命中结果按卡对象缓存：标签、排序、筛选共用一次解析，
   * 免得同一行在渲染里被解析三遍关系文本。
   */
  const relevanceIndex = useMemo(() => {
    const index = new Map<(typeof characters)[number], CharacterRelevance>()
    if (!relevanceContext) return index
    for (const character of characters) index.set(character, characterRelevance(character, relevanceContext))
    return index
  }, [characters, relevanceContext])
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const searchMatches = normalizedQuery
    ? visibleCharacters.filter(character => character.name.toLocaleLowerCase().includes(normalizedQuery))
    : visibleCharacters
  /**
   * 搜索 → 三档相关性 → 排序，然后才分页。相关性这一层放在这里（而不是渲染处），
   * 是为了让下面 `visibleKeys`（全选）继续等于「当前筛选结果」，语义不随本卡漂移。
   * 数据未就绪时一律放行：档②／③ 读不到只能不筛，不能把卡藏起来。
   */
  const filteredCharacters = sortCharactersForDisplay(
    relevanceContext
      ? searchMatches.filter(character => {
        const relevance = relevanceIndex.get(character)
        return !relevance || characterRelevanceVisible(relevance, relevanceLayers)
      })
      : searchMatches,
    relevanceSort,
    relevanceContext ?? {},
    locale,
  )
  const pageCount = Math.max(1, Math.ceil(filteredCharacters.length / CHARACTER_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageCharacters = filteredCharacters.slice(
    safePage * CHARACTER_PAGE_SIZE,
    (safePage + 1) * CHARACTER_PAGE_SIZE,
  )
  const pageIds = useMemo(() => pageCharacters.flatMap(character => (
    character.characterId ? [character.characterId] : []
  )), [pageCharacters])
  const { avatarUrls } = useCharacterAvatars(pageIds, dataReady)

  /**
   * 复活提示（R6 验收点 5）：手动建卡命中已退休的同名身份时，主进程复用原 `character_id`
   * 而不是新建孪生身份。作者必须知道唤回的是旧身份（带着它的历史字段），否则会以为
   * 新建了一张干净的卡。
   */
  useEffect(() => {
    const onRevived = (event: Event) => {
      const detail = (event as CustomEvent<{ names: string[] }>).detail
      if (!detail?.names?.length) return
      toast.info(text(
        `「${detail.names.join('、')}」是已退场的同名身份，已复活原角色（保留其历史资料），而不是新建一张卡。`,
        `“${detail.names.join(', ')}” is a retired identity with the same name; the original character was revived (its history is kept) instead of creating a new card.`,
      ))
    }
    characterRevivalEvents.addEventListener('revived', onRevived)
    return () => characterRevivalEvents.removeEventListener('revived', onRevived)
  }, [text])

  /**
   * 读档②（蓝图角色同步记录）与档③（项目核心三串）。
   *
   * 两条都是 preload 已暴露的只读通道，本卡**不新增 IPC**。读失败（含会话失效、
   * 旧项目缺表）一律降级成 `null`＝「未就绪」：界面表现为不筛、不标原因，
   * 绝不因为一次读失败把卡片藏起来——藏卡是静默丢数据。
   */
  useEffect(() => {
    const projectSession = projectSessionContextFromProject(currentProject)
    if (!projectSession) {
      setRelevanceContext(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [operations, core] = await Promise.all([
          ipc.invokeWithProjectSession(projectSession, 'db:blueprint-character-sync-list-all', projectSession.projectPath),
          ipc.invokeWithProjectSession(projectSession, 'db:project-core-get', projectSession.projectPath),
        ])
        if (cancelled) return
        if (!sameProjectSessionContext(projectSession, projectSessionContextFromProject(useProjectStore.getState().currentProject))) return
        setRelevanceContext({
          blueprintDeclarations: blueprintDeclarationsFromSyncOperations(operations),
          outline: outlineSourceFromProjectCore(core),
        })
      } catch {
        if (!cancelled) setRelevanceContext(null)
      }
    })()
    return () => { cancelled = true }
  }, [currentProject])

  const keyOf = (card: (typeof characters)[number]) => characterSelectionKey(card, characters.indexOf(card))
  /** 全选/反选针对**当前筛选结果**（含未显示的页），否则"全选"的语义会随分页漂移。 */
  const visibleKeys = filteredCharacters.map(keyOf)
  const allFilteredPicked = visibleKeys.length > 0 && visibleKeys.every(key => picked.includes(key))
  const togglePicked = (key: string) => setPicked(previous => (
    previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key]
  ))
  const exitSelection = () => { setSelectionMode(false); setPicked([]) }

  const handleDeletePicked = async () => {
    if (!picked.length || !currentProject || !dataReady) return
    const ok = await confirm(
      text(
        `确定要删除选中的 ${picked.length} 个角色吗？此操作不可撤销。\n\n同时会清理它们之间的关系引用。`,
        `Delete the ${picked.length} selected characters? This cannot be undone.\n\nTheir relationship references are removed as well.`,
      ),
      { title: text('批量删除角色', 'Delete characters'), confirmText: text('删除', 'Delete'), danger: true },
    )
    if (!ok) return
    try {
      const deleted = await deleteCharacters(picked, currentProject.path)
      if (!deleted) {
        toast.error(text('批量删除失败：项目可能已切换，请刷新后重试', 'Could not delete the selected characters. The project may have changed; refresh and try again.'))
        return
      }
      toast.success(text(`已删除 ${picked.length} 个角色`, `Deleted ${picked.length} character(s)`))
      exitSelection()
    } catch (error) {
      toast.error(appErrorMessage(locale, error))
    }
  }

  // 角色数据由 ProjectService 统一加载，组件只消费 store 数据

  if (!currentProject) {
    return (
      <EmptyState 
        icon={<Users size={36} />} 
        message={text('请先打开项目', 'Open a project first')}
        className="pb-[15vh]" 
        opacity={0.4} 
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between px-3 h-9 flex-shrink-0 border-b border-[var(--color-border)]">
        <span className="text-xs font-medium text-[var(--color-text)] flex items-center gap-1">
          <Users size={13} />
          {text(`角色列表（${visibleCharacters.length}）`, `Characters (${visibleCharacters.length})`)}
        </span>
        <div className="flex items-center gap-0.5">
          <CharacterCardGenerateButton projectKey={currentProject.path} compact disabled={identityBusy || !dataReady} />
          <CharacterCardImportButton projectKey={currentProject.path} compact disabled={identityBusy || !dataReady} />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => load(currentProject.path)} disabled={identityBusy || loadingProjectKey !== null} title={text('刷新列表', 'Refresh list')}>
            <RefreshCw size={14} strokeWidth={2} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addCharacter} disabled={identityBusy || !dataReady} title={text('新建角色', 'New character')}>
            <Plus size={14} strokeWidth={2} />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-6 w-6"
            aria-pressed={selectionMode}
            onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
            disabled={identityBusy || !dataReady || visibleCharacters.length === 0}
            title={text('批量删除', 'Delete several')}
          >
            <CheckSquare size={14} strokeWidth={2} />
          </Button>
        </div>
      </div>
      {selectionMode && (
        <div className="flex items-center justify-between gap-1 px-2 py-1 text-[0.7rem]" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-hover)' }}>
          <span className="text-[var(--color-text-secondary)]">{text(`已选 ${picked.length}`, `${picked.length} selected`)}</span>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className="h-6 text-[0.7rem]"
              onClick={() => setPicked(previous => (allFilteredPicked
                ? previous.filter(key => !visibleKeys.includes(key))
                : [...new Set([...previous, ...visibleKeys])]))}
              disabled={visibleKeys.length === 0}>
              {allFilteredPicked ? text('取消全选', 'Clear all') : text('全选', 'Select all')}
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-[0.7rem]" onClick={() => setPicked([])} disabled={!picked.length}>
              {text('清空', 'Clear')}
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-[0.7rem]" style={{ color: 'var(--color-error-text)' }}
              onClick={() => void handleDeletePicked()} disabled={!picked.length || identityBusy}>
              <Trash2 size={12} />{text(`删除选中（${picked.length}）`, `Delete (${picked.length})`)}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={exitSelection} title={text('退出批量删除', 'Exit selection')}>
              <X size={13} />
            </Button>
          </div>
        </div>
      )}
      <CharacterProposalInbox />
      <CharacterCastPanel />
      <FinalizedCharacterProposalPanel />
      <FinalizedCharacterStateCandidatePanel />
      <div className="relative px-2 py-1.5 border-b border-[var(--color-border)]">
        <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <Input
          value={searchQuery}
          onChange={event => { setSearchQuery(event.target.value); setPage(0) }}
          aria-label={text('搜索角色', 'Search characters')}
          placeholder={text('搜索角色名称', 'Search character names')}
          className="h-7 pl-7 text-xs"
        />
      </div>
      {/*
        相关性三档 + 两档排序。放在搜索框正下方（列表头部）而不是 h-9 顶栏：
        顶栏是纯图标行，塞三个勾选加一个下拉会把标题挤掉。
        三档**只标不勾**——勾选仍只由作者点行/点「全选」产生。
      */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-[var(--color-border)] px-2 py-1 text-[0.7rem] text-[var(--color-text-secondary)]">
        <span className="opacity-60">{text('有剧情', 'Has plot')}</span>
        {CHARACTER_RELEVANCE_LAYERS.map(layer => (
          <label key={layer} className="flex cursor-pointer items-center gap-1">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={relevanceLayers[layer]}
              aria-label={relevanceLayerLabel(layer)}
              onChange={event => {
                const checked = event.target.checked
                setRelevanceLayers(previous => ({ ...previous, [layer]: checked }))
                setPage(0)
              }}
            />
            {relevanceLayerLabel(layer)}
          </label>
        ))}
        <label className="ml-auto flex items-center gap-1">
          <span className="opacity-60">{text('排序', 'Sort')}</span>
          <select
            value={relevanceSort}
            aria-label={text('角色排序', 'Sort characters')}
            className="h-5 rounded border border-[var(--color-border)] bg-transparent text-[0.7rem]"
            onChange={event => setRelevanceSort(event.target.value as CharacterRelevanceSortKey)}
          >
            <option value="relevance">{text('有剧情优先', 'Has plot first')}</option>
            <option value="name">{text('名字', 'Name')}</option>
          </select>
        </label>
        {!relevanceContext && (
          <span className="opacity-50" title={text('蓝图／大纲数据未读到，暂不按相关性筛选', 'Blueprint/outline data is unavailable; relevance filtering is off')}>
            {text('蓝图／大纲未就绪', 'Blueprint & outline not ready')}
          </span>
        )}
      </div>
      {/* 角色列表 */}
      <div className="flex-1 overflow-y-auto p-1">
        {pageCharacters.map((c) => {
          const selectionKey = keyOf(c)
          const isPicked = picked.includes(selectionKey)
          const relevance = relevanceContext ? relevanceIndex.get(c) : undefined
          const reasonExpanded = expandedReasonKeys.includes(selectionKey)
          // 每行最多 2 条原因，其余收「+N」；展开后给全（命中档最多 3 个，展开到 3 即够）。
          const reasonSlots = relevance ? characterRelevanceReasonSlots(relevance, reasonExpanded ? 3 : 2) : null
          return (
            <div
              key={selectionKey}
              data-character-id={c.characterId}
              role="button" tabIndex={0}
              aria-pressed={selectionMode ? isPicked : selectedId === selectionKey}
              onKeyDown={event => {
                if (event.key !== 'Enter') return
                if (selectionMode) togglePicked(selectionKey)
                else setSelectedId(selectionKey)
              }}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-xs cursor-pointer mb-0.5',
                (selectionMode ? isPicked : selectedId === selectionKey)
                  ? 'bg-[var(--color-active)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]'
              )}
              onClick={() => (selectionMode ? togglePicked(selectionKey) : setSelectedId(selectionKey))}
            >
              <div className="flex items-center gap-2">
                {selectionMode && <input type="checkbox" checked={isPicked} readOnly tabIndex={-1} aria-label={text(`选择 ${c.name}`, `Select ${c.name}`)} className="flex-shrink-0" />}
                {c.characterId && avatarUrls[c.characterId] ? (
                  <img src={avatarUrls[c.characterId]} alt={text(`${c.name}头像`, `${c.name} avatar`)} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-hover)] text-[0.7rem]">{Array.from(c.name || '?')[0]}</div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.name || text('未命名', 'Untitled')}</div>
                  <div className="mt-0.5 truncate text-[0.7rem] opacity-60">{roleLabel(c.role)}{visibleCharacters.filter(item => item.name === c.name).length > 1 ? ` · ${c.background || c.characterId?.slice(-8)}` : ''}</div>
                  {relevance && reasonSlots && (
                    <div
                      className="mt-0.5 truncate text-[0.65rem] opacity-50"
                      data-relevance={relevance.hits.length > 0 ? relevance.hits.join(',') : 'none'}
                    >
                      {relevance.hits.length === 0
                        ? text('无剧情线索', 'No plot traces')
                        : (
                          <>
                            {reasonSlots.shown.map(reason => relevanceReasonText(reason)).join(' · ')}
                            {(reasonSlots.hidden > 0 || reasonExpanded) && (
                              <button
                                type="button"
                                className="ml-1 underline"
                                aria-label={reasonExpanded
                                  ? text(`收起「${c.name}」的命中原因`, `Collapse reasons for ${c.name}`)
                                  : text(`展开「${c.name}」的全部命中原因`, `Show all reasons for ${c.name}`)}
                                onClick={event => {
                                  // 这一行整块是「选中/勾选」按钮，点展开不能顺手把卡选上。
                                  event.stopPropagation()
                                  setExpandedReasonKeys(previous => (previous.includes(selectionKey)
                                    ? previous.filter(key => key !== selectionKey)
                                    : [...previous, selectionKey]))
                                }}
                              >
                                {reasonExpanded ? text('收起', 'Less') : `+${reasonSlots.hidden}`}
                              </button>
                            )}
                          </>
                        )}
                    </div>
                  )}
                  {c.currentState && <div className="mt-0.5 text-[0.65rem] opacity-50">{text(`第${c.currentState.updatedAtChapter}章更新`, `Updated in chapter ${c.currentState.updatedAtChapter}`)}</div>}
                </div>
              </div>
            </div>
          )
        })}
        {visibleCharacters.length === 0 && (
          <div className="text-center py-6 opacity-50 text-xs">
            {lastError
                ? text(`角色列表读取失败：${lastError}`, 'Could not load character list.')
              : text('暂无角色', 'No characters')}
          </div>
        )}
        {visibleCharacters.length > 0 && filteredCharacters.length === 0 && (
          <div className="text-center py-6 opacity-50 text-xs">
            {text('没有匹配的角色', 'No matching characters')}
          </div>
        )}
      </div>
      {filteredCharacters.length > 0 && (
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-2 py-1 text-[0.7rem] text-[var(--color-text-secondary)]">
          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={text('上一页角色', 'Previous character page')} disabled={safePage === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft size={13} /></Button>
          <span>{safePage + 1} / {pageCount}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={text('下一页角色', 'Next character page')} disabled={safePage + 1 >= pageCount} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}><ChevronRight size={13} /></Button>
        </div>
      )}
    </div>
  )
}
