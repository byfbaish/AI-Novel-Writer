/**
 * 「点击插入到光标位置」的共享实现。
 *
 * 此前只有提示词面板（`PromptSettings.tsx`）有这套逻辑；小说配置里的自由文本也要用
 * （段级标签 chip），故抽成一处共用 —— 本项目对"同一能力两处各写一遍"有多次踩坑记录
 * （模板变量说明表、trace 渲染器）。行为与提示词面板原实现完全一致：
 * 记住 `selectionStart/End` → 拼接 → 下一帧恢复焦点并把光标移到插入内容之后。
 */

/**
 * 把 `snippet` 插入到 textarea 当前光标处，返回新文本。
 * textarea 不存在时返回 `null`（调用方据此跳过更新，不要当成空串）。
 */
export function insertSnippetAtCursor(
  textarea: HTMLTextAreaElement | null,
  current: string,
  snippet: string,
): string | null {
  if (!textarea) return null
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const next = current.slice(0, start) + snippet + current.slice(end)
  // 恢复光标：渲染是异步的，必须等下一帧 DOM 值已更新后再设 selection。
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(start + snippet.length, start + snippet.length)
  })
  return next
}

/**
 * 段级标签 chip 的插入：**保证标签独占一行**。
 *
 * 为什么不能直接插 `【适用：架构】`：标签识别要求整行独立（行内 `【】` 一律不是标签 ——
 * 作者自由文本里本来就有"弹幕语言用【】括起来"），夹在句子中间插入会**点了没反应**。
 * 故按光标两侧的实际字符补换行。
 */
export function insertScopeTagAtCursor(
  textarea: HTMLTextAreaElement | null,
  current: string,
  token: string,
): string | null {
  if (!textarea) return null
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = current.slice(0, start)
  const after = current.slice(end)
  const lead = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
  const tail = after.length > 0 && !after.startsWith('\n') ? '\n' : ''
  return insertSnippetAtCursor(textarea, current, `${lead}${token}${tail}`)
}
