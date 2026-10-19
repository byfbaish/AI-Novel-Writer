import { useMemo } from 'react'
import { ChevronDown, ChevronRight, ListTree, Pin, PinOff, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useLocaleStore } from '../../stores/locale-store'
import { arcTreeUnitCount, type ArcTree } from '../../shared/arc-tree'

/**
 * 卷 / 单元 结构树（E4j-3 的 UI 层，2026-10-19）。
 *
 * 设计稿：`docs/design/architecture/volume-quota-context-budget-design.md` §7A.1b。
 *
 * 三条硬规则：
 * 1. **树只读** —— 编辑永远在右侧文本里做；树一旦可写就有两份事实，
 *    而 markdown 的自由格式（多行小弧、各种别名）不可能无损往返。
 * 2. **默认折叠，但允许全量展开**（作者 2026-10-19 原话）。
 * 3. **可 pin** —— pin 后是常驻侧栏（宽屏 = 左树右文），不 pin 时是浮层抽屉。
 *
 * 折叠与 pin 状态是**视图偏好**，存 sessionStorage（按项目 + 文件），不进 DB。
 */

export interface ArcStructureTreeState {
  pinned: boolean
  /** 已展开的卷序号（1 起）；空数组 = 全部折叠 */
  expanded: readonly number[]
}

const DEFAULT_STATE: ArcStructureTreeState = Object.freeze({ pinned: false, expanded: [] });

function storageKey(projectKey: string, filePath: string): string {
  return `arc-tree:${projectKey}:${filePath}`;
}

/** 读视图偏好。解析失败/不存在时返回默认（全折叠、不 pin）。 */
export function readArcTreeState(projectKey: string, filePath: string): ArcStructureTreeState {
  try {
    const raw = sessionStorage.getItem(storageKey(projectKey, filePath));
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<ArcStructureTreeState>;
    const expanded = Array.isArray(parsed.expanded)
      ? parsed.expanded.filter((value): value is number => Number.isSafeInteger(value) && value >= 1)
      : [];
    return { pinned: parsed.pinned === true, expanded };
  } catch {
    return DEFAULT_STATE;
  }
}

/** 写视图偏好。写不进去（隐私模式/配额）时静默忽略。 */
export function writeArcTreeState(projectKey: string, filePath: string, state: ArcStructureTreeState): void {
  try {
    sessionStorage.setItem(storageKey(projectKey, filePath), JSON.stringify(state));
  } catch {
    /* 偏好写不进去不影响使用 */
  }
}

export interface ArcStructureTreeProps {
  tree: ArcTree | null
  /** 点击单元/卷 ⇒ 右侧编辑器跳到该行（0 起） */
  onJumpLine: (line: number) => void
  pinned: boolean
  expanded: readonly number[]
  onTogglePin: () => void
  onToggleVolume: (volumeIndex: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  /** 不 pin 时显示的关闭按钮（浮层抽屉用） */
  onClose?: () => void;
}

export default function ArcStructureTree(props: ArcStructureTreeProps) {
  const text = useLocaleStore(s => s.text);
  const expandedSet = useMemo(() => new Set(props.expanded), [props.expanded]);
  const allExpanded = Boolean(props.tree && props.tree.volumes.length > 0
    && props.tree.volumes.every(volume => expandedSet.has(volume.index)));

  return (
    <div
      className="h-full flex flex-col"
      style={{ backgroundColor: 'var(--color-editor-bg)', borderRight: '1px solid var(--color-border)' }}
      aria-label={text('卷单元结构树', 'Volume and unit tree')}
    >
      <div className="flex items-center gap-1 px-2 h-9 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <ListTree size={13} style={{ color: 'var(--color-text-muted)' }} />
        <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--color-text-secondary)' }}>
          {text('卷 / 单元', 'Volumes / units')}
        </span>
        <button
          type="button"
          onClick={allExpanded ? props.onCollapseAll : props.onExpandAll}
          className="text-[11px] px-1.5 py-0.5 rounded hover:bg-[var(--color-hover)]"
          style={{ color: 'var(--color-text-muted)' }}
          title={allExpanded ? text('全部折叠', 'Collapse all') : text('全部展开', 'Expand all')}
        >
          {allExpanded ? text('折叠', 'Collapse') : text('展开', 'Expand')}
        </button>
        <button
          type="button"
          onClick={props.onTogglePin}
          className="p-1 rounded hover:bg-[var(--color-hover)]"
          title={props.pinned ? text('取消固定（变回抽屉）', 'Unpin (back to drawer)') : text('固定为侧栏（左树右文）', 'Pin as sidebar')}
          aria-pressed={props.pinned}
        >
          {props.pinned
            ? <Pin size={12} style={{ color: 'var(--color-accent)' }} />
            : <PinOff size={12} style={{ color: 'var(--color-text-muted)' }} />}
        </button>
        {!props.pinned && props.onClose && (
          <button
            type="button"
            onClick={props.onClose}
            className="p-1 rounded hover:bg-[var(--color-hover)]"
            title={text('关闭', 'Close')}
          >
            <X size={12} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {!props.tree && (
          <p className="px-3 py-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {text('结构不可解析，暂不显示树。', 'Structure could not be parsed; the tree is hidden.')}
          </p>
        )}
        {props.tree && (
          <p className="px-3 pb-1.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {text(`${props.tree.volumes.length} 卷 · ${arcTreeUnitCount(props.tree)} 单元（只读）`,
              `${props.tree.volumes.length} volumes · ${arcTreeUnitCount(props.tree)} units (read-only)`)}
          </p>
        )}
        {(props.tree?.volumes ?? []).map(volume => {
          const open = expandedSet.has(volume.index);
          return (
            <div key={volume.index}>
              <button
                type="button"
                onClick={() => props.onToggleVolume(volume.index)}
                className="w-full flex items-start gap-1 px-2 py-1 text-left hover:bg-[var(--color-hover)]"
                aria-expanded={open}
                title={volume.name}
              >
                {open
                  ? <ChevronDown size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  : <ChevronRight size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />}
                <span className="text-[12px] font-medium leading-5 break-words" style={{ color: 'var(--color-text)' }}>
                  {text('卷', 'Vol')} {volume.index}：{volume.name}
                </span>
              </button>
              {open && volume.units.map(unit => (
                <button
                  key={unit.index}
                  type="button"
                  onClick={() => { if (unit.line !== null) props.onJumpLine(unit.line); }}
                  disabled={unit.line === null}
                  className={cn('w-full flex items-start gap-1 pl-6 pr-2 py-1 text-left hover:bg-[var(--color-hover)]',
                    unit.line === null && 'opacity-50 cursor-default')}
                  title={unit.line === null ? text('定位失败', 'Cannot locate') : text('跳到此单元', 'Jump to this unit')}
                >
                  <span className="text-[11px] leading-5 break-words flex-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {text('单元', 'Unit')} {unit.index}：{unit.name}
                  </span>
                  {unit.hand && (
                    <span
                      className="text-[10px] px-1 rounded flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-muted)' }}
                      title={unit.tier ?? undefined}
                    >
                      {unit.hand}
                    </span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
