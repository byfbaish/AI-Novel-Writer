/**
 * WorldStateNav — 左栏「世界状态」分类导航。
 *
 * 只做导航：五个分类入口 + 计数，内容全部在主区 WorldStatePage。
 * 为什么把内容搬走：260px 的四区纵排会把字号压到 0.6rem、一屏只装一区半；
 * 分类导航在这个宽度里正好一目了然。
 *
 * 只读契约：本组件不调任何 IPC，计数全部来自 world-state-store 的同一份快照。
 */
import { useEffect } from 'react'
import { Compass } from 'lucide-react'
import { useLocaleStore } from '../../../stores/locale-store'
import { useProjectStore } from '../../../stores/project-store'
import { selectWorldStateSnapshot, useWorldStateStore } from '../../../stores/world-state-store'
import { EmptyState } from '../../ui/EmptyState'
import {
  WORLD_STATE_SECTION_LABELS,
  WORLD_STATE_SECTION_ORDER,
  type WorldStateLanguage,
} from './world-state-view-model'

function formatFetchedAt(iso: string, language: WorldStateLanguage): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString(language === 'zh-CN' ? 'zh-CN' : 'en-US', { hour12: false })
}

export default function WorldStateNav() {
  const text = useLocaleStore((s) => s.text)
  const language = useLocaleStore((s) => s.locale) as WorldStateLanguage
  const project = useProjectStore((s) => s.currentProject)
  const projectPath = project?.path ?? null

  const section = useWorldStateStore((s) => s.section)
  const setSection = useWorldStateStore((s) => s.setSection)
  const load = useWorldStateStore((s) => s.load)
  const snapshot = useWorldStateStore((s) => selectWorldStateSnapshot(s, projectPath))

  useEffect(() => {
    void load(projectPath)
  }, [projectPath, load])

  if (!projectPath) {
    return (
      <EmptyState
        icon={<Compass size={32} />}
        message={text('请先打开项目', 'Open a project first')}
        className="pt-[10vh]"
        opacity={0.4}
      />
    )
  }

  const data = snapshot?.view ?? null
  const counts: Record<(typeof WORLD_STATE_SECTION_ORDER)[number], number> = {
    cast: data?.castLedger.entries.length ?? 0,
    timeline: data?.chapters.length ?? 0,
    characters: data?.characters.length ?? 0,
    // 资源计数是「已登记的资源条数」，不是余额、也不是变动条数。
    resources: data?.resources.items.length ?? 0,
    facts: data?.continuityFacts.length ?? 0,
    // 空间检查的计数是「待确认处数」，不是条目数。
    space: data?.spaceAudit.issues.length ?? 0,
  }
  const spaceUnreadable = data?.spaceAudit.unreadable ?? true
  // 资源表没读到 ≠ 0 个资源：左栏同样显示「—」，与空间检查同一条规矩。
  const resourcesUnreadable = data?.resources.unreadable ?? true
  const orphanCount = data?.castLedger.counts.orphan ?? 0

  const fetchedLine = data
    ? text(
      `最近读取 ${formatFetchedAt(data.fetchedAt, language)}`,
      `Last read ${formatFetchedAt(data.fetchedAt, language)}`,
    )
    : snapshot?.error
      ? text('读取失败，点开查看详情', 'Read failed; open for details')
      : text('尚未读取', 'Not read yet')

  return (
    <div className="flex flex-col gap-2 px-1.5 py-1.5">
      <div className="px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[0.7rem] font-medium" style={{ color: 'var(--color-text)' }}>
            {text('分类', 'Sections')}
          </span>
          <span
            className="rounded px-1 text-[0.6rem]"
            style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-muted)' }}
          >
            {text('只读', 'Read-only')}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[0.62rem]" style={{ color: 'var(--color-text-muted)' }} title={fetchedLine}>
          {fetchedLine}
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {WORLD_STATE_SECTION_ORDER.map((key) => {
          const active = key === section
          return (
            <button
              key={key}
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left"
              style={{
                backgroundColor: active ? 'var(--color-hover)' : 'transparent',
                boxShadow: active ? 'inset 2px 0 0 var(--color-accent)' : 'none',
                color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
              }}
              aria-current={active ? 'true' : undefined}
              onClick={() => setSection(key)}
            >
              <span className="truncate text-xs">
                {language === 'zh-CN' ? WORLD_STATE_SECTION_LABELS[key].zh : WORLD_STATE_SECTION_LABELS[key].en}
              </span>
              <span className="flex flex-shrink-0 items-center gap-1">
                {key === 'cast' && orphanCount > 0 && (
                  <span
                    className="rounded px-1 text-[0.6rem] tabular-nums"
                    style={{ color: 'var(--color-error-text)', border: '1px solid var(--color-border)' }}
                    title={text(`${orphanCount} 个名字还没有角色卡`, `${orphanCount} name(s) without a card`)}
                  >
                    {text(`${orphanCount} 待建卡`, `${orphanCount} to card`)}
                  </span>
                )}
                <span
                  className="text-[0.65rem] tabular-nums"
                  style={{
                    color: key === 'space' && !spaceUnreadable && counts.space > 0
                      ? 'var(--color-warning-text)'
                      : 'var(--color-text-muted)',
                  }}
                  title={key === 'space' && spaceUnreadable
                    ? text('世界观里没识别到空间结构，本次未检查', 'No space structure recognized; not checked')
                    : key === 'resources' && resourcesUnreadable
                      ? text('资源登记表本次未读取', 'The resource registry was not read')
                      : undefined}
                >
                  {/*
                    空间检查未检查时显示「—」而不是 0：0 会被读成「检查过、没问题」，
                    这两件事必须能分开。资源表同理：没读到不能显示成「0 个资源」。
                  */}
                  {(key === 'space' && spaceUnreadable) || (key === 'resources' && resourcesUnreadable)
                    ? '—'
                    : counts[key]}
                </span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="px-1 text-[0.62rem] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        {text(
          '这里只读取定稿后的世界状态，不会修改任何数据。',
          'This view only reads the finalized world state; it never writes.',
        )}
      </div>
    </div>
  )
}
