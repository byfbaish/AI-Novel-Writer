import { useMemo } from 'react'
import { ChevronDown, ChevronRight, FileText, Info, ListTree, Pin, PinOff, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useLocaleStore } from '../../stores/locale-store'
import type { OutlineTree } from '../../shared/outline-tree'

/**
 * 情节大纲的 卷/单元/章 三层树（E4j-4，2026-10-19）。
 *
 * ## 为什么大纲需要它
 *
 * 作者原话：「大纲的内容长度将会比卷纲的长度还要长，那么卷纲都有一个树形目录，
 * 大纲更有理由增加一个了。」——篇幅比卷纲大一个量级，没有目录就只能靠滚动找。
 *
 * ## 与卷纲树的区别：**必须暴露「归属是算出来的」**
 *
 * 大纲正文里没有「本章属于哪一单元」的字段，每章只写「覆盖：」行（且多数写「无」）。
 * 归属由 `arcSpanForChapters` 按**计划等分**折算 —— 某个单元写超，后面整体错位。
 * 所以每个章节点都带一个 source 标记，让作者一眼看出哪些是**声明**的、哪些只是**推算**：
 *
 * | 标记 | 含义 | 显示 |
 * |---|---|---|
 * | `declared` | 写了「覆盖：<本单元>」，可信 | 无标记 |
 * | `computed` | 按等分折算反推，可能漂移 | 灰色虚线圈 |
 * | `mismatch` | 声明与折算不一致——漂移的早期信号 | 琥珀色警示 |
 */

/**
 * 大纲树的视图偏好（pin / 展开）。与卷纲树分开存：两者的节点键不同
 * （卷纲按卷序号，大纲按 `v:1` / `v:1:u:2`），混存会互相污染。
 */
export interface OutlineTreePanelState {
  pinned: boolean
  /** 已展开的节点键：`v:1` / `v:1:u:2`；空数组 = 全部折叠 */
  expanded: readonly string[]
}

const DEFAULT_PANEL_STATE: OutlineTreePanelState = Object.freeze({ pinned: false, expanded: [] })

function storageKey(projectKey: string, filePath: string): string {
  return `outline-tree:${projectKey}:${filePath}`
}

/** 读视图偏好。解析失败/不存在时返回默认（全折叠、不 pin）。 */
export function readOutlineTreeState(projectKey: string, filePath: string): OutlineTreePanelState {
  try {
    const raw = sessionStorage.getItem(storageKey(projectKey, filePath))
    if (!raw) return DEFAULT_PANEL_STATE
    const parsed = JSON.parse(raw) as Partial<OutlineTreePanelState>
    const expanded = Array.isArray(parsed.expanded)
      ? parsed.expanded.filter((value): value is string => typeof value === 'string')
      : []
    return { pinned: parsed.pinned === true, expanded }
  } catch {
    return DEFAULT_PANEL_STATE
  }
}

/** 写视图偏好。写不进去（隐私模式/配额）时静默忽略。 */
export function writeOutlineTreeState(projectKey: string, filePath: string, state: OutlineTreePanelState): void {
  try {
    sessionStorage.setItem(storageKey(projectKey, filePath), JSON.stringify(state))
  } catch {
    /* 偏好写不进去不影响使用 */
  }
}

export interface OutlineTreeProps {
  tree: OutlineTree | null;
  /** 点击卷/单元/章 ⇒ 右侧编辑器跳到该行（0 起） */
  onJumpLine: (line: number) => void;
  pinned: boolean;
  /** 已展开的节点键：`v:1` / `v:1:u:2` */
  expanded: readonly string[];
  onTogglePin: () => void;
  onToggleNode: (key: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onClose?: () => void;
}

export default function OutlineTreePanel(props: OutlineTreeProps) {
  const text = useLocaleStore(s => s.text);
  const expandedSet = useMemo(() => new Set(props.expanded), [props.expanded]);
  const tree = props.tree;
  const chapterCount = useMemo(() => {
    if (!tree) return 0;
    let total = 0;
    for (const volume of tree.volumes) for (const unit of volume.units) total += unit.chapters.length;
    return total;
  }, [tree]);

  const jump = (line: number | null) => { if (line !== null) props.onJumpLine(line); };

  return (
    <div
      className="h-full flex flex-col"
      style={{ backgroundColor: 'var(--color-editor-bg)', borderRight: '1px solid var(--color-border)' }}
      aria-label={text('情节大纲目录', 'Outline contents')}
    >
      <div className="flex items-center gap-1 px-2 h-9 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <ListTree size={13} style={{ color: 'var(--color-text-muted)' }} />
        <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--color-text-secondary)' }}>
          {text('大纲目录', 'Outline contents')}
        </span>
        <button
          type="button"
          onClick={props.onExpandAll}
          className="text-[11px] px-1.5 py-0.5 rounded hover:bg-[var(--color-hover)]"
          style={{ color: 'var(--color-text-muted)' }}
          title={text('全部展开', 'Expand all')}
        >
          {text('展开', 'Expand')}
        </button>
        <button
          type="button"
          onClick={props.onCollapseAll}
          className="text-[11px] px-1.5 py-0.5 rounded hover:bg-[var(--color-hover)]"
          style={{ color: 'var(--color-text-muted)' }}
          title={text('全部折叠', 'Collapse all')}
        >
          {text('折叠', 'Collapse')}
        </button>
        <button
          type="button"
          onClick={props.onTogglePin}
          className="p-1 rounded hover:bg-[var(--color-hover)]"
          title={props.pinned ? text('取消固定', 'Unpin') : text('固定为侧栏', 'Pin as sidebar')}
          aria-pressed={props.pinned}
        >
          {props.pinned
            ? <Pin size={12} style={{ color: 'var(--color-accent)' }} />
            : <PinOff size={12} style={{ color: 'var(--color-text-muted)' }} />}
        </button>
        {!props.pinned && props.onClose && (
          <button type="button" onClick={props.onClose} className="p-1 rounded hover:bg-[var(--color-hover)]" title={text('关闭', 'Close')}>
            <X size={12} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {!tree && (
          <p className="px-3 py-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {text('大纲还没有章级条目，或卷单元结构不可解析。', 'The outline has no chapter entries yet, or the structure cannot be parsed.')}
          </p>
        )}
        {tree && (
          <div className="px-3 pb-1.5 text-[11px] space-y-0.5" style={{ color: 'var(--color-text-muted)' }}>
            <p>{text(`${tree.volumes.length} 卷 · ${chapterCount} 章`, `${tree.volumes.length} volumes · ${chapterCount} chapters`)}</p>
            {tree.headingCount > 0 && (
              <p>{text(`${tree.headingCount} 章归属来自章标题`, `${tree.headingCount} chapters attributed by their headings`)}</p>
            )}
            {tree.computedCount > 0 && (
              <p className="flex items-start gap-1" title={text('这些章的卷/单元归属是按计划等分折算的，不是正文声明。某个单元写超后，后续章号会整体错位。', 'These chapters are mapped to a unit by even division, not by a declaration in the outline. If one unit runs long, later chapter numbers drift.')}>
                <Info size={10} className="mt-0.5 flex-shrink-0" />
                <span>{text(`${tree.computedCount} 章归属为折算`, `${tree.computedCount} mapped by division`)}</span>
              </p>
            )}
            {tree.mismatchCount > 0 && (
              <p style={{ color: 'var(--color-warning-text)' }}>
                {text(`${tree.mismatchCount} 章声明与折算不一致`, `${tree.mismatchCount} chapters disagree with the division`)}
              </p>
            )}
            {tree.driftedCount > 0 && (
              <p style={{ color: 'var(--color-warning-text)' }} title={text('标题是生成时写下的事实，折算才是会错的 —— 有这一行说明该单元的篇幅已经偏离计划，折算不能再用来判断归属。', 'The heading is what was written at generation time; the division is the part that can be wrong. This line means the unit has drifted from plan, so division can no longer be trusted.')}>
                {text(`${tree.driftedCount} 章标题归属与折算不一致`, `${tree.driftedCount} chapter headings disagree with the division`)}
              </p>
            )}
          </div>
        )}
        {(tree?.volumes ?? []).map(volume => {
          const volumeKey = `v:${volume.index}`;
          const volumeOpen = expandedSet.has(volumeKey);
          return (
            <div key={volumeKey}>
              <button
                type="button"
                onClick={() => props.onToggleNode(volumeKey)}
                className="w-full flex items-start gap-1 px-2 py-1 text-left hover:bg-[var(--color-hover)]"
                aria-expanded={volumeOpen}
                title={volume.name}
              >
                {volumeOpen ? <ChevronDown size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  : <ChevronRight size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />}
                <span className="text-[12px] font-medium leading-5 break-words" style={{ color: 'var(--color-text)' }}>
                  {text('卷', 'Vol')} {volume.index}：{volume.name}
                </span>
              </button>
              {volumeOpen && volume.units.map(unit => {
                const unitKey = `${volumeKey}:u:${unit.index}`;
                const unitOpen = expandedSet.has(unitKey);
                return (
                  <div key={unitKey}>
                    <button
                      type="button"
                      onClick={() => props.onToggleNode(unitKey)}
                      className="w-full flex items-start gap-1 pl-5 pr-2 py-1 text-left hover:bg-[var(--color-hover)]"
                      aria-expanded={unitOpen}
                      title={unit.name}
                    >
                      {unitOpen ? <ChevronDown size={11} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                        : <ChevronRight size={11} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />}
                      <span className="text-[11px] leading-5 break-words flex-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {text('单元', 'Unit')} {unit.index}：{unit.name}
                      </span>
                      <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {unit.chapters.length > 0 ? `${unit.chapters[0]!.number}–${unit.chapters[unit.chapters.length - 1]!.number}` : ''}
                      </span>
                    </button>
                    {unitOpen && unit.chapters.map(chapter => (
                      <button
                        key={chapter.number}
                        type="button"
                        onClick={() => jump(chapter.line)}
                        disabled={chapter.line === null}
                        className={cn('w-full flex items-start gap-1 pl-9 pr-2 py-0.5 text-left hover:bg-[var(--color-hover)]',
                          chapter.line === null && 'opacity-50 cursor-default')}
                        title={chapter.source === 'heading'
                          ? text('归属来自章标题自带的「第V卷第U单元」—— 生成时写下的事实', 'Attribution comes from the shift in the heading itself — written at generation time')
                          : chapter.source === 'computed'
                            ? text('归属按等分折算，不是正文声明', 'Mapped by division, not declared in the outline')
                            : chapter.source === 'mismatch'
                              ? text('声明与折算不一致——结构可能已漂移', 'Declaration disagrees with the division — the structure may have drifted')
                              : text('跳到此章', 'Jump to this chapter')}
                      >
                        {chapter.source === 'mismatch'
                          ? <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--color-warning-text)' }} />
                          : chapter.source === 'computed'
                            ? <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 border" style={{ borderColor: 'var(--color-text-muted)' }} />
                            : <FileText size={10} className="mt-1 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />}
                        <span className="text-[11px] leading-5 break-words" style={{ color: 'var(--color-text-muted)' }}>
                          第 {chapter.number} 章{chapter.title ? `：${chapter.title}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
