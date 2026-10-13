import { AlertTriangle } from 'lucide-react'
import type { RefObject } from 'react'
import { useLocaleStore } from '../../stores/locale-store'
import {
  summarizeScopedText,
  textScopeTagToken,
  TEXT_SCOPE_TAG_CHOICES,
  type TextScopeChoice,
} from '../../shared/text-scope-tags'
import { insertScopeTagAtCursor } from '../insert-at-cursor'

/** chip 的悬浮说明：必须把"谁看得到、谁看不到"说清楚（作者反馈过"过了一天就迷茫"）。 */
const CHIP_HINT: Readonly<Record<TextScopeChoice, { zh: string; en: string }>> = {
  architecture: {
    zh: '只给主架构四步（故事前提 / 角色图谱 / 世界观 / 弧光结构）；大纲、蓝图与正文都看不到。',
    en: 'Only the four architecture steps (premise / cast / world-building / arc structure); the outline, blueprints, and drafts will not see it.',
  },
  outline: {
    zh: '只给情节大纲与章节蓝图。',
    en: 'Only the plot outline and chapter blueprints.',
  },
  draft: {
    zh: '只给每章正文（含修稿）；架构与大纲都看不到。排版类要求（如"一句一段"）应该用这个。',
    en: 'Only chapter drafts and revisions. Formatting rules (e.g. "one sentence per paragraph") belong here.',
  },
  all: {
    zh: '所有步骤都给（与不打标签等价）。',
    en: 'Every step sees it (same as no tag).',
  },
}

/**
 * 自由文本的「按步骤分区」辅助栏：插入标签 chip + 段归属统计 + 未识别标签告警。
 *
 * 分区语法与过滤都在 `src/shared/text-scope-tags.ts`（纯函数）；这里只做交互与可观测性，
 * 且**只提示、不自动改写**作者的文本（与"内置模板过期"提示同款姿态）。
 */
export default function ScopeTagBar({
  value,
  onChange,
  textareaRef,
}: {
  value: string
  onChange: (next: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
}) {
  const text = useLocaleStore(s => s.text)
  const stats = summarizeScopedText(value)

  return (
    <div className="pt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[0.68rem]" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '按步骤分区（点击插入到光标位置，标签须独占一行）：',
            'Scope by step (click to insert at the cursor; the tag must be on its own line):',
          )}
        </span>
        {TEXT_SCOPE_TAG_CHOICES.map(choice => (
          <button
            key={choice}
            type="button"
            onClick={() => {
              const next = insertScopeTagAtCursor(textareaRef.current, value, textScopeTagToken(choice))
              if (next !== null && next !== value) onChange(next)
            }}
            title={text(CHIP_HINT[choice].zh, CHIP_HINT[choice].en)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.68rem] font-mono transition-colors hover:bg-[var(--color-accent)] hover:text-white outline-none focus:outline-none"
            style={{
              backgroundColor: 'var(--color-hover)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            {textScopeTagToken(choice)}
          </button>
        ))}
      </div>

      <p className="mt-1 text-[0.68rem]" style={{ color: 'var(--color-text-muted)' }}>
        {text(
          `当前：架构 ${stats.architecture} 段 · 大纲 ${stats.outline} 段 · 正文 ${stats.draft} 段（未标注 ${stats.everyStep} 段）`,
          `Now: architecture ${stats.architecture} · outline ${stats.outline} · draft ${stats.draft} (unlabeled ${stats.everyStep})`,
        )}
      </p>

      {stats.unknownTags.length > 0 && (
        <div
          className="mt-2 rounded-lg px-3 py-2 text-[0.68rem] leading-relaxed"
          style={{
            color: 'var(--color-warning)',
            backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
          }}
        >
          <AlertTriangle size={12} className="inline mr-1" />
          {text(
            `有 ${stats.unknownTags.length} 个标签值没被识别（${stats.unknownTags.join('、')}）—— 这些段按「所有步骤都给」处理，内容不会丢。可用值只有：架构 / 大纲 / 正文 / 全部。`,
            `${stats.unknownTags.length} tag value(s) are not recognized (${stats.unknownTags.join(', ')}) — those sections are treated as “every step” and their content is never dropped. Valid values: 架构 / 大纲 / 正文 / 全部.`,
          )}
        </div>
      )}
    </div>
  )
}
