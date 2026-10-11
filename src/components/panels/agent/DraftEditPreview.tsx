/**
 * DraftEditPreview — revise_draft_content 的确认预览
 *
 * 批量替换逐条列出「原文 → 替换为」，整章覆盖只给字数与开头摘要。
 * 纯只读展示；真正的原子性校验发生在工具执行时。
 */
import type { CSSProperties } from 'react'
import type { ToolCallInfo } from '../../../services/agent/agent-engine'
import { useLocaleStore } from '../../../stores/locale-store'

/** 每条摘要在确认卡上的最大字符数 */
const CLIP_LENGTH = 70
/** 最多逐条展示多少条，其余折叠为计数 */
const MAX_ROWS = 20

function clip(value: unknown): string {
  const flat = String(value ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > CLIP_LENGTH ? `${flat.slice(0, CLIP_LENGTH)}…` : flat
}

const rowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '4px 8px',
  borderRadius: 4,
  backgroundColor: 'var(--color-hover)',
  fontSize: '0.68rem',
  lineHeight: 1.5,
  wordBreak: 'break-all',
}

export default function DraftEditPreview({ toolCall }: { toolCall: ToolCallInfo }) {
  const text = useLocaleStore(s => s.text)
  if (toolCall.toolName !== 'revise_draft_content') return null

  const args = toolCall.arguments ?? {}
  const chapterNumber = typeof args.chapter_number === 'number' ? args.chapter_number : null
  const edits = Array.isArray(args.edits) ? (args.edits as Array<Record<string, unknown>>) : null
  const content = typeof args.content === 'string' ? args.content : null

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-text)' }}>
        {chapterNumber === null
          ? text('修改本章正文', 'Revise chapter draft')
          : text(`修改第 ${chapterNumber} 章正文`, `Revise chapter ${chapterNumber}`)}
      </div>

      {edits && (
        <>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)' }}>
            {text(`共 ${edits.length} 处替换`, `${edits.length} replacement(s)`)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
            {edits.slice(0, MAX_ROWS).map((edit, index) => (
              <div key={index} style={rowStyle}>
                <span style={{ color: 'var(--color-text-secondary)' }}>− {clip(edit?.find)}</span>
                <span style={{ color: 'var(--color-text)' }}>＋ {clip(edit?.replace)}</span>
              </div>
            ))}
          </div>
          {edits.length > MAX_ROWS && (
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)' }}>
              {text(`…另有 ${edits.length - MAX_ROWS} 处未展开`, `...${edits.length - MAX_ROWS} more not shown`)}
            </div>
          )}
        </>
      )}

      {!edits && content !== null && (
        <div style={rowStyle}>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {text(`整章覆盖 · 共 ${content.replace(/\s+/g, '').length} 字`, `Whole-chapter replacement · ${content.replace(/\s+/g, '').length} characters`)}
          </span>
          <span style={{ color: 'var(--color-text)' }}>{clip(content)}</span>
        </div>
      )}
    </div>
  )
}
