/**
 * 读「本章前提是否已变」（P0-1）。
 *
 * 判定在主进程（`SummaryRepository.listChapterStaleness` + 共享纯函数）算，
 * 这里只负责取一次、并在草稿/正文发生变动后重取。
 *
 * 为什么不做成 store：它只被两个列表组件消费，且必须**跟着刷新事件走**
 * （定稿、退回、确认都会改判定）。做成全局 store 反而要维护第三份同步逻辑。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { ipc } from '../../../services/ipc-client'
import { globalEventBus } from '../../../shared/event-bus'
import { useProjectStore } from '../../../stores/project-store'
import {
  captureProjectSession,
  isProjectSessionCurrent,
  isProjectSessionPath,
} from '../../project-session-gate'
import type { ChapterStalenessState } from '../../../shared/chapter-staleness'

export interface ChapterStalenessEntry {
  chapterNumber: number
  state: ChapterStalenessState
  staleFromChapter: number | null
}

/**
 * 返回 `章号 → 判定`。读失败时返回空表 —— 拿不到判定就**不出徽标**，
 * 不猜、也不把"读不到"当成"没问题"之外的任何结论（读不到时界面维持原样）。
 */
export function useChapterStaleness(projectPath: string): Map<number, ChapterStalenessEntry> {
  const currentProject = useProjectStore(state => state.currentProject)
  const [entries, setEntries] = useState<Map<number, ChapterStalenessEntry>>(() => new Map())
  const requestSeq = useRef(0)

  const load = useCallback(async () => {
    await Promise.resolve()
    const projectSession = captureProjectSession(currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectPath)) {
      setEntries(new Map())
      return
    }
    const seq = ++requestSeq.current
    try {
      const result = await ipc.invokeWithProjectSession(
        projectSession,
        'db:chapter-staleness-list',
        projectSession.projectPath,
      )
      // 迟到的响应不能覆盖新项目的判定。
      if (seq !== requestSeq.current || !isProjectSessionCurrent(projectSession)) return
      if (!result.success || !result.chapters) return
      setEntries(new Map(result.chapters.map(chapter => [chapter.chapterNumber, {
        chapterNumber: chapter.chapterNumber,
        state: chapter.state,
        staleFromChapter: chapter.staleFromChapter,
      }])))
    } catch {
      // 读不到就不出徽标：这里刻意不 toast，避免每次挂载都弹一次
    }
  }, [currentProject, projectPath])

  useEffect(() => {
    const timer = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(timer)
  }, [load])

  // 定稿 / 退回 / 确认都会改变判定，跟着草稿刷新事件重读。
  useEffect(() => {
    const refresh = (payload: { projectPath?: string }) => {
      if (payload.projectPath && payload.projectPath !== projectPath) return
      void load()
    }
    const offDeletion = globalEventBus.on('CHAPTER_DELETION_UPDATED', refresh)
    const offRefresh = globalEventBus.on('REFRESH_RESOURCE', refresh)
    return () => { offDeletion(); offRefresh() }
  }, [load, projectPath])

  return entries
}
