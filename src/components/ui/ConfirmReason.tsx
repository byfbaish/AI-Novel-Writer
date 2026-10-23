/* eslint-disable react-refresh/only-export-components */
/**
 * 带理由输入的确认对话框（P0-1 期 3）。
 *
 * 为什么单独一个：`confirm` 只能回答"是/否"，而「确认这一章无需改动」必须留下**理由** ——
 * 理由不是礼貌，是这条确认唯一的内容（判定只看世代，理由给人看：三个月后你会想知道
 * 当初为什么认为第 21 章不受影响）。
 *
 * 因此确认按钮在输入非空前保持禁用：空理由等于静默放行。
 */
import { createRoot } from 'react-dom/client'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from './Button'
import { useLocaleStore } from '../../stores/locale-store'

interface ReasonPromptOptions {
  title?: string
  message: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
}

interface ReasonPromptProps extends ReasonPromptOptions {
  onResolve: (value: string | null) => void
}

function ReasonPrompt({
  title,
  message,
  placeholder,
  confirmText,
  cancelText,
  onResolve,
}: ReasonPromptProps) {
  const text = useLocaleStore(s => s.text)
  const [value, setValue] = useState('')
  const [isExiting, setIsExiting] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const resolvedTitle = title ?? text('填写理由', 'Reason required')
  const resolvedConfirmText = confirmText ?? text('确认', 'Confirm')
  const resolvedCancelText = cancelText ?? text('取消', 'Cancel')

  const finish = useCallback((result: string | null) => {
    setIsExiting(true)
    setTimeout(() => onResolve(result), 200)
  }, [onResolve])

  const handleConfirm = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    finish(trimmed)
  }

  useEffect(() => {
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(null)
      // Ctrl/Cmd + Enter 直接提交：长理由不必去点按钮
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) handleConfirm()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish, value])

  return (
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center ${isExiting ? 'animate-backdrop-exit' : 'animate-backdrop-enter'}`}
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={() => finish(null)}
    >
      <div
        className={`w-[28rem] max-w-[90vw] rounded-lg p-4 ${isExiting ? 'animate-dialog-exit' : 'animate-dialog-enter'}`}
        style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}
        onClick={event => event.stopPropagation()}
      >
        <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>{resolvedTitle}</h3>
        <p className="text-xs whitespace-pre-wrap mb-3" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
        <textarea
          ref={inputRef}
          className="w-full text-xs rounded p-2 resize-none"
          rows={3}
          value={value}
          placeholder={placeholder ?? text('例如：本章只改了错别字，不影响这一章', 'e.g. only a typo changed; this chapter is unaffected')}
          onChange={event => setValue(event.target.value)}
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="ghost" size="sm" onClick={() => finish(null)}>{resolvedCancelText}</Button>
          <Button size="sm" disabled={!value.trim()} onClick={handleConfirm}>{resolvedConfirmText}</Button>
        </div>
      </div>
    </div>
  )
}

/**
 * 弹出一个「必须填理由」的确认框。确认返回去掉首尾空白的理由；取消返回 `null`。
 */
export function promptReason(
  message: string,
  options?: Partial<Omit<ReasonPromptOptions, 'message'>>,
): Promise<string | null> {
  return new Promise(resolve => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const cleanup = (value: string | null) => {
      root.unmount()
      if (container.parentNode) document.body.removeChild(container)
      resolve(value)
    }
    root.render(
      <ReasonPrompt
        message={message}
        title={options?.title}
        placeholder={options?.placeholder}
        confirmText={options?.confirmText}
        cancelText={options?.cancelText}
        onResolve={cleanup}
      />
    )
  })
}
