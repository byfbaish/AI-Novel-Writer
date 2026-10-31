import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react'

import type { InvalidationGroupKind } from '../../shared/invalidation-plan'
import {
  captureProjectSession,
  isProjectSessionCurrent,
} from '../project-session-gate'
import { useLayoutStore } from '../../stores/layout-store'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import {
  type DerivedInventoryRead,
  readDerivedInventory,
} from '../../services/derived-inventory'
import { INVALIDATION_GROUP_LABEL, UPSTREAM_DOMAIN_LABEL, describeDriftForLocale } from '../invalidation-labels'
import {
  openArchFile,
  openBuiltinEditor,
  openChapterFile,
} from '../panels/sidebar/sidebar-file-openers'
import { Button } from '../ui/Button'
import { toast } from '../ui/Toast'

/**
 * 派生内容清点页（S7，2026-11-01 作者裁定）。
 *
 * ## 它回答的问题
 *
 * 「这本书现在哪儿旧了？」—— 在此之前，`stale` 提示散在五个地方（剧情树编辑器 /
 * 蓝图读取 / 交接单 / 定稿 / agent 工具），每处只知道**自己那一行**。作者想通盘看一遍，
 * 只能一处处撞上去。
 *
 * ## 为什么只清点、不「一键重算」
 *
 * 四类派生的重算是四条不同的 workflow，代价差一个量级（重写正文会覆盖已定稿内容，
 * 重算蓝图近乎免费）。并进一个按钮，等于让作者在最贵的那一项上误触 ——
 * 与主稿 §十·2 ③「控制力度交给作者」相反。**每一行只给「去处置」**，跳过去由作者决定。
 *
 * ## 为什么每行带证据
 *
 * `describeDrift` 给的是「情节大纲 第3版→第5版（第4版 10-31 22:05 作者手改，改过第12–14章）」。
 * 只说「旧了」作者无法判断该不该现在处理 —— S4b / S6c 那两层溯源链就白做了。
 *
 * ## 三种失败面不合并（主稿 §9.2）
 *
 * 「版本表不存在」「这次没读到」「确实没有要处置的」是三个不同的事实，见
 * `readDerivedInventory` 的注释。折成一个空清单，作者会把「不知道」读成「没问题」。
 */
export default function DerivedHealthPage() {
  const currentProject = useProjectStore(state => state.currentProject)
  const locale = useLocaleStore(state => state.locale)
  const text = useLocaleStore(state => state.text)

  const [read, setRead] = useState<DerivedInventoryRead | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const session = captureProjectSession(currentProject)
    if (!session) { setRead({ state: 'unavailable' }); return }
    setLoading(true)
    const result = await readDerivedInventory(session)
    // 读取期间切了项目：旧项目的清点结果不能落进新项目的页面。
    if (!isProjectSessionCurrent(session)) return
    setRead(result)
    setLoading(false)
  }, [currentProject])

  useEffect(() => { void load() }, [load])

  const inventory = read?.state === 'ok' ? read.inventory : null

  /** 定稿章 → draftId。跳转用；缺了就退化成章节卡，不编一个 id。 */
  const finalizedTargets = useMemo(() => {
    const map = new Map<number, number>()
    for (const draft of inventory?.finalizedDrafts ?? []) map.set(draft.chapterNumber, draft.draftId)
    return map
  }, [inventory])

  const totalItems = inventory?.groups.reduce((sum, group) => sum + group.count, 0) ?? 0
  const unseenCount = inventory?.unseen.count ?? 0

  /**
   * 跳转。
   *
   * **必须先切回正文工作区**：`sidebarView === 'derived-health'` 时 `EditorArea` 用
   * `hidden` 把 tab 区整块藏起来（辅助页优先）。只开 tab 不切视图，作者看到的是
   * 「点了一下，什么都没发生」—— 这比不提供跳转更糟。
   */
  const goTo = useCallback((kind: InvalidationGroupKind, chapterNumber: number | null) => {
    const layout = useLayoutStore.getState()
    switch (kind) {
      case 'outline':
        layout.setSidebarView('project')
        void openArchFile('ai-novel://core/synopsis', text('情节大纲', 'Outline')).catch((error: unknown) => {
          toast.error(text(`无法打开情节大纲：${String(error)}`, `Could not open the outline: ${String(error)}`))
        })
        return
      case 'blueprint':
        layout.setSidebarView('project', 'blueprint')
        // 章节蓝图是**一个** tab：已打开时 `openFile` 会把新章号写回该 tab，
        // `ChapterCardEditor` 的 effect 依赖 `initialChapterNumber`，于是会重新定位。
        openBuiltinEditor(
          'chapter-card-editor',
          text('章节蓝图', 'Chapter blueprint'),
          'chapter-card',
          undefined,
          chapterNumber ?? undefined,
        )
        return
      case 'handoff':
        layout.setSidebarView('project')
        openBuiltinEditor('volume-handoff-registry', text('卷末交接单', 'Volume handoffs'), 'volume-handoff-registry')
        return
      case 'plot-tree':
        layout.setSidebarView('project', 'plot-tree')
        openBuiltinEditor(
          'narrative-thread-editor',
          text('剧情树与叙事线索', 'Plot tree & narrative threads'),
          'narrative-thread',
          'plot-tree',
        )
        return
      case 'finalized': {
        layout.setSidebarView('project')
        const draftId = chapterNumber === null ? undefined : finalizedTargets.get(chapterNumber)
        if (draftId === undefined) {
          // 说真话：正文跳不过去，但没到「处置不了」的地步（章节卡里能看到这一章）。
          toast.error(text(
            '没有找到这一章的定稿正文记录，可以到章节蓝图里查看',
            'No finalized prose found for this chapter; check the chapter blueprint instead',
          ))
          return
        }
        void openChapterFile(`ai-novel://draft/${draftId}`, text(`第 ${chapterNumber} 章`, `Chapter ${chapterNumber}`))
        return
      }
    }
  }, [finalizedTargets, text])

  const summary = inventory === null
    ? ''
    : totalItems === 0 && unseenCount === 0
      ? text('没有需要处置的派生内容', 'Nothing needs attention')
      : text(
        `${totalItems} 项需要处置${unseenCount > 0 ? `，另有 ${unseenCount} 项无法判断` : ''}`,
        `${totalItems} item(s) need attention${unseenCount > 0 ? `, ${unseenCount} more cannot be judged` : ''}`,
      )

  return (
    <div
      className="skin-workspace-page w-full h-full flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--color-editor-bg)' }}
      data-testid="derived-health"
    >
      <div
        className="flex-shrink-0 px-6 py-4 space-y-1"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <Activity size={18} style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
          <h1 className="text-base font-medium">{text('派生内容状态', 'Derived content health')}</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { void load() }}
            disabled={loading}
            title={text('重新盘点', 'Re-scan')}
            data-testid="derived-health-refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} aria-hidden="true" />
          </Button>
          {inventory && (
            <span className="ml-auto text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {text('截至', 'as of')} {formatRevisionAt(inventory.scannedAt)}
            </span>
          )}
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {summary || text('正在盘点…', 'Scanning…')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {renderBody()}
      </div>
    </div>
  )

  function renderBody() {
    if (!read) {
      return <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{text('正在盘点…', 'Scanning…')}</p>
    }
    if (read.state === 'missing') {
      // 老项目：没有 `upstream_revisions`。**不要说「一切正常」**。
      return (
        <p className="text-xs" data-testid="derived-health-missing" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '这本书还没有版本记录（升级前创建的项目），暂时无法盘点派生内容。',
            'This book has no revision records yet (created before the upgrade), so derived content cannot be scanned.',
          )}
        </p>
      )
    }
    if (read.state === 'unavailable') {
      return (
        <div className="space-y-2" data-testid="derived-health-unavailable">
          <p className="text-xs" style={{ color: 'var(--color-warning-text)' }}>
            {text('没读到清点结果，内容可能随时可用。', 'The scan could not be read; it may be available in a moment.')}
          </p>
          {read.error && (
            <p className="text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>{read.error}</p>
          )}
        </div>
      )
    }

    const { groups, unseen, upstream } = read.inventory
    return (
      <>
        {groups.length === 0 && unseen.count === 0 && (
          <div className="flex items-center gap-2 text-xs" data-testid="derived-health-empty" style={{ color: 'var(--color-text-secondary)' }}>
            <ShieldCheck size={16} aria-hidden="true" />
            {text('所有派生内容都与当前上游一致。', 'Every derived item matches the current upstream.')}
          </div>
        )}

        {groups.map(group => {
          const [zh, en] = INVALIDATION_GROUP_LABEL[group.kind]
          return (
            <section key={group.kind} className="space-y-2" data-testid={`derived-group-${group.kind}`}>
              <h2 className="text-sm font-medium">{text(`${zh}（${group.count}）`, `${en} (${group.count})`)}</h2>
              <ul className="space-y-1.5">
                {group.items.map(item => (
                  <li
                    key={`${group.kind}:${item.label}`}
                    className="flex items-start gap-3 text-xs"
                    data-testid={`derived-item-${group.kind}-${item.label}`}
                  >
                    <span className="w-40 flex-shrink-0" style={{ color: 'var(--color-text)' }}>{item.label}</span>
                    <span className="flex-1" style={{ color: 'var(--color-text-muted)' }}>
                      {describeDriftForLocale(item.behind, locale)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => goTo(group.kind, item.chapters && item.chapters.length > 0 ? item.chapters[0] : null)}
                      data-testid={`derived-open-${group.kind}-${item.label}`}
                    >
                      {text('去处置', 'Open')}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}

        {/*
          「看不见的那部分」单独出现，且默认收起（主稿 §十·1 第 2/3 条）：
          它不是「要处置的」，也不是「安全的」。默认展开会让每一项都带一行灰色噪声，
          收起后又必须能点开看到底是哪几类 —— 所以用 details 而不是省略。
        */}
        {unseen.count > 0 && (
          <details className="text-xs" data-testid="derived-health-unseen">
            <summary style={{ color: 'var(--color-warning-text)', cursor: 'pointer' }}>
              {text(
                `另有 ${unseen.count} 项无法判断（旧数据没有来源记录）`,
                `${unseen.count} more item(s) cannot be judged (legacy data has no source records)`,
              )}
            </summary>
            <p className="mt-1 pl-4" style={{ color: 'var(--color-text-muted)' }}>
              {unseen.kinds
                .map(kind => {
                  const [zh, en] = INVALIDATION_GROUP_LABEL[kind]
                  return locale === 'en-US' ? en : zh
                })
                .join(locale === 'en-US' ? ', ' : '、')}
            </p>
          </details>
        )}

        {upstream.length > 0 && (
          <section className="space-y-1 text-xs" data-testid="derived-health-upstream">
            <h2 className="text-sm font-medium">{text('上游版本', 'Upstream revisions')}</h2>
            {upstream.map(line => (
              <p key={`${line.domain}:${line.scope}`} style={{ color: 'var(--color-text-muted)' }}>
                {domainName(line.domain, locale)} · {text(`第 ${line.rev} 版`, `rev ${line.rev}`)}
                {line.at ? ` · ${formatRevisionAt(line.at)}` : ''}
                {line.reason !== 'unknown' ? ` · ${REASON_LABEL[line.reason]?.[locale === 'en-US' ? 1 : 0] ?? line.reason}` : ''}
              </p>
            ))}
          </section>
        )}
      </>
    )
  }
}

/** 原因取值表的中英文短名。**不接受取值表之外的值**（渲染侧只认那六个）。 */
const REASON_LABEL: Record<string, [string, string]> = {
  'author-edit': ['作者手改', 'author edit'],
  regenerate: ['重新生成', 'regenerated'],
  rollback: ['回滚', 'rollback'],
  'import-restore': ['导入恢复', 'imported'],
  clear: ['清空', 'cleared'],
}

/** 域名的双语短名。直接查表，不走 `parseUpstreamRefKey` —— 这里拿到的已经是裸域名。 */
function domainName(domain: string, locale: 'zh-CN' | 'en-US'): string {
  const pair = UPSTREAM_DOMAIN_LABEL[domain] ?? [domain, domain]
  return locale === 'en-US' ? pair[1] : pair[0]
}

/** `2026-10-31T14:05:00.000Z` → `10-31 22:05`（本地时区）。 */
function formatRevisionAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
