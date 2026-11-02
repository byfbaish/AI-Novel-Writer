/**
 * Per-card timestamps the ledger does not keep: when the worker finished
 * (handed the card over for review), and when the reviewer closed it.
 *
 * The board stores `createdAt`/`updatedAt` on the task and `startedAt`/
 * `endedAt` on each execution — everything a Host run produces. The two
 * moments a pull-model channel owns are outside that: handing a card back for
 * review writes no execution record (that would settle it into Done, which the
 * review rule forbids), so both stamps live here.
 *
 * These files are bookkeeping, never authority: a missing or corrupt file
 * means "no stamp", and the card still works. `<stateDir>/boards/<ledgerId>/
 * timeline/<taskId>.json`, tmp+rename so a crash never leaves half a file.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const TIMELINE_SCHEMA_VERSION = 1
const DIR_MODE = 0o700
const FILE_MODE = 0o600
const MAX_ID_LENGTH = 200
const STAMP_KEYS = ['finishedAt', 'closedAt']
/**
 * Non-timestamp handover facts. `handedBy` records which agent carried the
 * `review` label, i.e. who did the work. It has to live here: handing a card
 * over writes no execution record, so the ledger only knows who *closed* the
 * card, never who produced it. `review()` compares against it so a card cannot
 * be passed by the agent that did it (§5.3 of the manual).
 */
const HANDOVER_KEYS = ['handedBy']
const AGENT_ID_MAX_LENGTH = 200
/** Older verdicts are kept for the trail, but only the tail is worth carrying. */
export const REVIEW_LOG_LIMIT = 20

function assertSafeId(value, label) {
  if (typeof value !== 'string' || value === '' || value.length > MAX_ID_LENGTH) {
    throw new TypeError(`${label} must be a non-empty string (<=${MAX_ID_LENGTH} chars)`)
  }
  if (value !== value.trim() || value === '.' || value === '..' || /[\\/\0]/.test(value)) {
    throw new TypeError(`unsafe ${label} for a timeline file: ${JSON.stringify(value)}`)
  }
  return value
}

export function timelineDir(stateDir, ledgerId) {
  return path.join(stateDir, 'boards', assertSafeId(ledgerId, 'ledgerId'), 'timeline')
}

function timelinePath(stateDir, ledgerId, taskId) {
  return path.join(timelineDir(stateDir, ledgerId), `${assertSafeId(taskId, 'taskId')}.json`)
}

function writeFileAtomic(target, data) {
  const tmp = `${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  try {
    fs.writeFileSync(tmp, data, { mode: FILE_MODE, flag: 'wx' })
    fs.renameSync(tmp, target)
  } finally {
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* rename already moved it */
    }
  }
  try {
    fs.chmodSync(target, FILE_MODE)
  } catch {
    /* Windows: no POSIX bits to set */
  }
}

/** Read one card's stamps; `null` when absent, corrupt, or foreign to this board. */
export function readTimeline(stateDir, ledgerId, taskId) {
  let raw
  try {
    raw = fs.readFileSync(timelinePath(stateDir, ledgerId, taskId), 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (parsed.taskId !== taskId || parsed.boardLedgerId !== ledgerId) return null
  return parsed
}

/**
 * Merge stamps and handover facts into a card's file. Only a finite number is
 * accepted per stamp key and a short non-blank string per handover key, so a
 * caller cannot park arbitrary data here; unknown keys are ignored.
 */
export function stampTimeline(stateDir, ledgerId, taskId, patch) {
  const stamped = {}
  for (const key of STAMP_KEYS) {
    const value = patch?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) stamped[key] = value
  }
  for (const key of HANDOVER_KEYS) {
    const value = patch?.[key]
    if (typeof value === 'string' && value.trim() !== '' && value.length <= AGENT_ID_MAX_LENGTH) {
      stamped[key] = value
    }
  }
  if (Object.keys(stamped).length === 0) return readTimeline(stateDir, ledgerId, taskId)
  const current = readTimeline(stateDir, ledgerId, taskId) ?? { taskId }
  const next = {
    ...current,
    ...stamped,
    schemaVersion: TIMELINE_SCHEMA_VERSION,
    taskId,
    boardLedgerId: ledgerId,
  }
  fs.mkdirSync(timelineDir(stateDir, ledgerId), { recursive: true, mode: DIR_MODE })
  writeFileAtomic(timelinePath(stateDir, ledgerId, taskId), `${JSON.stringify(next, null, 2)}\n`)
  return next
}

/**
 * Append one review verdict. The ledger has nowhere to keep "why this came
 * back", and the card's own text is frozen once it has run, so the note lives
 * beside the stamps. Only the tail is kept: an old verdict that has since been
 * reworked past has no reader.
 */
export function appendReview(stateDir, ledgerId, taskId, entry) {
  if (entry === null || typeof entry !== 'object') {
    throw new TypeError('appendReview needs a review entry object')
  }
  const current = readTimeline(stateDir, ledgerId, taskId) ?? { taskId }
  const history = Array.isArray(current.reviews) ? current.reviews : []
  const next = {
    ...current,
    reviews: [...history, entry].slice(-REVIEW_LOG_LIMIT),
    schemaVersion: TIMELINE_SCHEMA_VERSION,
    taskId,
    boardLedgerId: ledgerId,
  }
  fs.mkdirSync(timelineDir(stateDir, ledgerId), { recursive: true, mode: DIR_MODE })
  writeFileAtomic(timelinePath(stateDir, ledgerId, taskId), `${JSON.stringify(next, null, 2)}\n`)
  return next
}

/** The latest verdict on a card, or `null` when it has never been reviewed. */
export function lastReview(stamp) {
  const history = Array.isArray(stamp?.reviews) ? stamp.reviews : []
  const entry = history.at(-1)
  return entry !== null && typeof entry === 'object' ? entry : null
}

/**
 * The four moments one card can report. `createdAt`/`updatedAt` come from the
 * ledger, `finishedAt` (worker handed it over) from here, and `closableAt`
 * (review passed, card belongs in Done) from here or — for a card closed by a
 * Host run or a reviewer's `done` — from its last settled execution.
 */
export function cardTimes(task, stamp) {
  const settled = (task.executions ?? []).filter((entry) => typeof entry.endedAt === 'number')
  const lastSettled = settled.at(-1)
  const closable = stamp?.closedAt ?? (task.status === 'done' ? lastSettled?.endedAt : undefined)
  return {
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    ...(typeof stamp?.finishedAt === 'number' ? { finishedAt: stamp.finishedAt } : {}),
    ...(typeof closable === 'number' ? { closableAt: closable } : {}),
    ...(typeof stamp?.handedBy === 'string' && stamp.handedBy !== '' ? { handedBy: stamp.handedBy } : {}),
  }
}
