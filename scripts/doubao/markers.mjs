/**
 * Queue-marker extraction for the Doubao channel. Zero dependencies, pure.
 *
 * Kept out of `doubao.mjs` so the parsing rules can be tested without a live
 * CDP instance - the page can only be read once something is already running,
 * and a parsing bug there is indistinguishable from "the agent printed nothing".
 *
 * A marker line is what a queue task-book asks for:
 *
 *   ## [T3] DONE 补完 actual/headings 两档
 *   2026-11-03T01:40:12Z
 *
 * Doubao renders markdown, so `## ` arrives in the DOM as a heading whose
 * innerText is bare `[T3] DONE ...` - hence the optional `#` prefix.
 *
 * ## 任务书正文里的「格式示例」不是标记
 *
 * A task-book has to *tell* the agent what a marker looks like, e.g.
 *
 *   ## [T1] DONE|BLOCKED|SKIPPED <一句话说明>
 *
 * The page text after the last user message still contains the tail of that
 * instruction (the reader anchors on the first 30 chars of the user turn), so
 * an unfiltered regex reports a phantom `[T1] DONE` with note
 * `|BLOCKED|SKIPPED <一句话说明>`. Two properties separate a template line from
 * a real one, and both are cheap and stable:
 *
 *   1. a state token immediately followed by `|` - real output never writes
 *      `DONE|BLOCKED`;
 *   2. the note is nothing but a placeholder (`<一句话说明>` / `（…）`).
 *
 * `## [QUEUE] EMPTY` carries an empty note, so neither rule can catch it, and
 * a task-book ends its closing section with that same line. The terminal rule
 * (see `isTerminalQueueMarker`) therefore requires a preceding real DONE on
 * top of the "last non-blank line" property before an EMPTY counts.
 */

export const MARKER_LINE = /^(?:#{1,4}\s*)?\[(T\d+|QUEUE)\]\s*(DONE|BLOCKED|SKIPPED|EMPTY|EMPTIED|STOPPED)\b\s*(.*)$/iu
export const ISO_STAMP = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/

/** `<一句话说明>` / `（一句话说明）` / `(running)` and nothing else. */
const PLACEHOLDER_ONLY = /^(?:<[^<>]{1,60}>|（[^（）]{1,60}）|\([^()]{1,60}\))$/u

/** `DONE|BLOCKED` - the enum list from a task-book's format example. */
const STATE_PIPE = /\b(?:DONE|BLOCKED|SKIPPED|EMPTY|EMPTIED|STOPPED)\s*\|/iu

/**
 * True when a line that *looks* like a marker is actually a format example.
 * `note` is the captured tail, already trimmed.
 */
export const isTemplateMarker = (line, note) => {
  if (STATE_PIPE.test(line)) return true
  if (note.startsWith('|')) return true
  return PLACEHOLDER_ONLY.test(note)
}

/**
 * True when a QUEUE/EMPTY marker is the *terminal* "queue is empty" report and
 * not a task-book format example. Non QUEUE/EMPTY markers always pass.
 *
 * `markers` is the already-parsed sequence - each entry is what parseMarkerLine
 * returned plus the caller-attached 0-based `line` index and the source text's
 * last non-blank line index `lastContentLine` ("last valid line" is a
 * text-level property, so extractMarkers attaches it). `index` points at the
 * candidate.
 *
 * Two conditions, both required - only one satisfied means discard:
 *
 *   1. terminal line: the marker sits on the last non-blank line of the text
 *      (nothing but blank lines follows). A mid-stream EMPTY is never a
 *      terminal report.
 *   2. preceded by a real DONE: at least one DONE marker precedes it in the
 *      already template-filtered sequence. A task-book's closing section ends
 *      with `## [QUEUE] EMPTY` too, but its DONE examples are `<一句话说明>`
 *      placeholders that isTemplateMarker already dropped, so no real DONE can
 *      precede the book's EMPTY - without this rule the book's trailing EMPTY
 *      would be reported once, before the agent has ever replied.
 */
export const isTerminalQueueMarker = (markers, index) => {
  const m = markers[index]
  if (m.marker !== 'QUEUE' || m.state !== 'EMPTY') return true
  if (m.line !== m.lastContentLine) return false
  if (!markers.slice(0, index).some(p => p.state === 'DONE')) return false
  return true
}

/**
 * Parse one line. Returns `{ marker, state, note }` or null.
 * `marker`/`state` are upper-cased so callers never have to normalise.
 */
export const parseMarkerLine = line => {
  const trimmed = String(line ?? '').trim()
  const match = MARKER_LINE.exec(trimmed)
  if (!match) return null
  const note = match[3].trim()
  if (isTemplateMarker(trimmed, note)) return null
  return {
    marker: match[1].toUpperCase(),
    state: match[2].toUpperCase(),
    note: note.slice(0, 160),
  }
}

/**
 * Extract every marker from a block of page text.
 * Callers pass "page text after the last user turn" - the slicing itself stays
 * in the page (it needs the live DOM), so this function only decides what
 * counts as a marker inside what it is given.
 *
 * Optional `{ afterIndex }` restricts the scan to the text after the last
 * user-message anchor: the caller passes the character offset of the anchor,
 * and everything at or before it (a task-book's body, including its format
 * examples) is ignored. Omitted - or `undefined` - scans the whole text, which
 * keeps every existing call site unchanged.
 *
 * The timestamp may sit on the marker line or within the next two lines.
 */
export const extractMarkers = (text, { afterIndex } = {}) => {
  const source = afterIndex == null ? String(text ?? '') : String(text ?? '').slice(afterIndex)
  const lines = source.split('\n')
  let lastContentLine = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== '') lastContentLine = i
  }
  const parsed = []
  for (let i = 0; i < lines.length; i += 1) {
    const marker = parseMarkerLine(lines[i])
    if (!marker) continue
    let timestamp = ISO_STAMP.exec(lines[i])?.[1] ?? null
    for (let k = 1; k <= 2 && !timestamp && i + k < lines.length; k += 1) {
      timestamp = ISO_STAMP.exec(lines[i + k])?.[1] ?? null
    }
    parsed.push({ ...marker, timestamp, line: i, lastContentLine })
  }
  return parsed
    .filter((_, i) => isTerminalQueueMarker(parsed, i))
    .map(({ line, lastContentLine, ...rest }) => rest)
}
