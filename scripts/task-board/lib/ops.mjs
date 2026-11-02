/**
 * The operation core both shells (CLI and MCP) call.
 *
 * Claiming is the board's job: `move(todo -> running)` is serialized by the
 * single-writer ledger, so a loser gets a refusal instead of a second claim.
 * This module's local claim file only records ownership, lease and the retry
 * request ids; it never decides who wins.
 */

import crypto from 'node:crypto'
import os from 'node:os'
import { BoardError } from './errors.mjs'
import { claimableTasks, containerTaskIds, DEFAULT_TAG, hasOpenExecution, tagHints, reapPlan } from './select.mjs'
import { claimsDir, writeClaim, readClaim, deleteClaim, listClaims, updateClaim } from './claims.mjs'
import { appendReview, cardTimes, lastReview, readTimeline, stampTimeline } from './timeline.mjs'

export const DEFAULT_LEASE_MS = 60 * 60 * 1000
export const EXTERNAL_SUMMARY_MAX_LENGTH = 1000
/** Mirrors the board's own tag limits (core/tasks.ts). */
export const TASK_TAG_LIMIT = 8
export const TAG_NAME_MAX_LENGTH = 32
/**
 * Labels the channel gives meaning to. All of them are English on purpose: the
 * board UI shows tag names verbatim, so a half-translated set (`external` next
 * to `待review`) reads as two vocabularies. `external` is fixed by the pull
 * channel's default tag, which settles the language for the rest.
 */
export const REVIEW_TAG = 'review'
export const REWORK_TAG = 'rework'

function normalizeTagName(value) {
  const name = typeof value === 'string' ? value.trim() : ''
  if (name === '' || name.length > TAG_NAME_MAX_LENGTH) {
    throw new BoardError('usage', `tag name must be 1..${TAG_NAME_MAX_LENGTH} characters, got ${JSON.stringify(value)}`)
  }
  return name
}

function sameTagSet(left, right) {
  if (left.length !== right.length) return false
  const key = (entry) => `${typeof entry === 'string' ? entry : entry.name}\u0000${typeof entry === 'string' ? '' : (entry.promptPrefix ?? '')}`
  const a = left.map(key).sort()
  const b = right.map(key).sort()
  return a.every((value, index) => value === b[index])
}

/**
 * Union of the labels a subtask inherits from its parent and the ones asked for
 * at creation time.
 *
 * The parent's entry wins a name collision: it is the only side that can carry
 * a `promptPrefix`, and a child that silently dropped it would lose the
 * instruction the parent's label exists to inject. Inherited names stay first
 * so the card reads as "the parent's context, plus what this child adds".
 *
 * The limit is enforced on the union rather than on the new names, because the
 * board refuses a card with more than TASK_TAG_LIMIT tags no matter who put
 * them there — failing here keeps the refusal local and explainable.
 */
function mergeTags(inherited, own, parentId) {
  const byName = new Map()
  for (const entry of inherited) {
    const name = typeof entry === 'string' ? entry : entry?.name
    if (typeof name !== 'string' || name === '') continue
    byName.set(name, typeof entry === 'string' ? { name } : { ...entry })
  }
  const fromParent = byName.size
  const added = []
  for (const value of Array.isArray(own) ? own : []) {
    const name = normalizeTagName(value)
    if (byName.has(name)) continue
    byName.set(name, { name })
    added.push(name)
  }
  const merged = [...byName.values()]
  if (merged.length > TASK_TAG_LIMIT) {
    const origin = parentId === '' ? `${added.length} new` : `${fromParent} inherited from ${parentId} + ${added.length} new`
    throw new BoardError('usage', `a card keeps at most ${TASK_TAG_LIMIT} tags; ${origin} would make ${merged.length}`)
  }
  return { tags: merged, inherited: [...byName.keys()].slice(0, fromParent), added }
}

/** Tag names of a card, whether the board stored strings or objects. */
function tagNames(task) {
  return (task?.tags ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
    .filter((name) => typeof name === 'string' && name !== '')
}

/**
 * What the worker should read before starting: the tag `promptPrefix` strings,
 * plus the last verdict when the card was sent back. The note is the entire
 * reason the card is claimable again, and it cannot live in the card text —
 * the board freezes a card's text once it has run.
 */
function dispatchHints(task, stamp) {
  const hints = tagHints(task)
  const verdict = lastReview(stamp)
  if (tagNames(task).includes(REWORK_TAG) && verdict?.verdict === 'rework' && typeof verdict.note === 'string' && verdict.note !== '') {
    hints.push(`rework requested by ${verdict.by}: ${verdict.note}`)
  }
  return hints
}

/**
 * Parse a lease duration: milliseconds (number), or strings such as `60m`,
 * `90s`, `2h`, and a bare number of minutes. Undefined means the default.
 */
export function parseLeaseDuration(value, fallback = DEFAULT_LEASE_MS) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) throw new BoardError('usage', 'lease must be a positive duration')
    return value
  }
  const match = /^(\d+)(ms|s|m|h)?$/u.exec(String(value).trim())
  if (match === null) throw new BoardError('usage', `invalid lease ${JSON.stringify(value)} (try 60m)`)
  const amount = Number(match[1])
  const unit = match[2] ?? 'm'
  const factor = unit === 'ms' ? 1 : unit === 's' ? 1000 : unit === 'm' ? 60_000 : 3_600_000
  return amount * factor
}

function randomId() {
  return crypto.randomUUID()
}

function parseLease(leaseMs) {
  return parseLeaseDuration(leaseMs)
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new BoardError('usage', `${name} is required`)
  return value.trim()
}

/**
 * @param {{
 *   transport: { url: string, getState: () => Promise<any>, apply: (envelope: any) => Promise<any> },
 *   stateDir: string,
 *   agentId?: string,
 *   leaseMs?: number,
 *   now?: () => number,
 *   host?: string,
 *   pid?: number,
 * }} options
 */
export function createOps(options) {
  const { transport } = options
  const stateDir = options.stateDir
  if (typeof stateDir !== 'string' || stateDir === '') {
    throw new BoardError('usage', 'a local state directory is required')
  }
  const agentId = typeof options.agentId === 'string' ? options.agentId.trim() : ''
  const expectedLedgerId = typeof options.expectedLedgerId === 'string' ? options.expectedLedgerId.trim() : ''
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS
  const now = options.now ?? (() => Date.now())
  const host = options.host ?? os.hostname()
  const pid = options.pid ?? process.pid

  let ledgerId = ''

  async function state() {
    const snapshot = await transport.getState()
    const id = snapshot?.scheduler?.ledgerId
    if (typeof id !== 'string' || id === '') {
      throw new BoardError('invalid-response', 'the task board did not report scheduler.ledgerId; refusing to guess which board this is')
    }
    // The identity resolved before the first call is pinned, so a URL that
    // flipped to another board between resolution and the first operation is
    // refused instead of accepted as the new baseline.
    if (expectedLedgerId !== '' && id !== expectedLedgerId) {
      throw new BoardError('board-mismatch', `expected ledger ${expectedLedgerId} but the board reports ${id}; refusing to use a different board`)
    }
    if (ledgerId !== '' && id !== ledgerId) {
      throw new BoardError('board-mismatch', `expected ledger ${ledgerId} but the board now reports ${id}; refusing to write to a different board`)
    }
    ledgerId = id
    return snapshot
  }

  function requireAgent() {
    if (agentId === '') throw new BoardError('usage', 'an agent identity is required (--agent or DSH_BOARD_AGENT)')
    if (agentId.length > 200) {
      throw new BoardError('usage', `agent identity is ${agentId.length} chars; the board keeps at most 200`)
    }
    return agentId
  }

  function findTask(snapshot, taskId) {
    const task = snapshot.tasks.find((candidate) => candidate.id === taskId)
    if (task === undefined) throw new BoardError('conflict', `unknown task ${taskId}`)
    return task
  }

  /** The card plus its four moments; ledger timestamps first, local stamps after. */
  function withTimes(task) {
    return { task, times: cardTimes(task, readTimeline(stateDir, ledgerId, task.id)) }
  }

  /**
   * Stamp the moments the ledger cannot hold. A card handed back for review
   * writes `finishedAt`; a card the reviewer settled writes `closedAt`.
   * Best effort: a stamp is bookkeeping, so a failed write must not undo a
   * board transition that already landed.
   */
  function stamp(taskId, patch) {
    try {
      return stampTimeline(stateDir, ledgerId, taskId, patch)
    } catch {
      return null
    }
  }

  async function move(taskId, status) {
    return transport.apply({
      requestId: randomId(),
      action: { kind: 'move', taskId, status },
      initiator: requireAgent(),
    })
  }

  function newClaim(task, lease, extra = {}) {
    return {
      schemaVersion: 1,
      taskId: task.id,
      agentId: requireAgent(),
      boardLedgerId: ledgerId,
      boardUrl: transport.url,
      claimedAt: now(),
      startedAt: now(),
      leaseUntil: now() + lease,
      pid,
      host,
      moveRequestId: randomId(),
      ...extra,
    }
  }

  async function persistClaim(task, lease, extra = {}) {
    const claim = newClaim(task, lease, extra)
    return writeClaim(stateDir, ledgerId, claim)
  }

  async function readOwnClaim(taskId) {
    const claim = readClaim(stateDir, ledgerId, taskId)
    if (claim !== null && claim.agentId !== requireAgent()) {
      throw new BoardError('conflict', `task ${taskId} is claimed by ${claim.agentId}, not ${requireAgent()}`)
    }
    return claim
  }

  async function dropClaim(taskId) {
    deleteClaim(stateDir, ledgerId, taskId)
  }

  /** Renew the lease and verify the board still agrees the card is ours. */
  async function heartbeat(taskId, lease) {
    requireAgent()
    const snapshot = await state()
    const claim = await readOwnClaim(taskId)
    if (claim === null) throw new BoardError('conflict', `no local claim for ${taskId}; run claim first`)
    const task = findTask(snapshot, taskId)
    if (hasOpenExecution(task)) {
      await dropClaim(taskId)
      throw new BoardError('conflict', `the Host took over ${taskId}; the external run yields`)
    }
    if (task.status !== 'running') {
      await dropClaim(taskId)
      throw new BoardError('conflict', `task ${taskId} is no longer running (now ${task.status})`)
    }
    const updated = updateClaim(stateDir, ledgerId, taskId, { leaseUntil: now() + lease })
    return { claim: updated ?? claim, task, ledgerId }
  }

  async function recordOutcome(taskId, { summary, report, result }) {
    requireAgent()
    const text = requireString(summary, '--summary')
    const composed = typeof report === 'string' && report.trim() !== '' ? `${text}；报告：${report.trim()}` : text
    if (composed.length > EXTERNAL_SUMMARY_MAX_LENGTH) {
      throw new BoardError('usage', `summary is ${composed.length} chars; the board keeps at most ${EXTERNAL_SUMMARY_MAX_LENGTH}`)
    }
    const snapshot = await state()
    const task = findTask(snapshot, taskId)
    // Closing a card you handed over is the same self-review through a different
    // door: claim your own card back, then settle it, and the review label never
    // gets looked at. `review --pass` is untouched — it runs as the reviewer,
    // whose id is by definition not the one on the handover record.
    if (result === 'succeeded') {
      // And the wider door: never hand the card over at all, just claim and
      // settle. A card only reaches Done through a review, so `done` requires
      // the label that says one is pending. `fail` is not gated — failing is
      // not claiming completion.
      if (!tagNames(task).includes(REVIEW_TAG)) {
        throw new BoardError(
          'conflict',
          `task ${taskId} is not awaiting review; hand it over first (tag ${taskId} --add ${REVIEW_TAG} --remove ${DEFAULT_TAG} --release), then let another identity settle it`,
        )
      }
      const handover = readTimeline(stateDir, ledgerId, taskId)
      if (typeof handover?.handedBy === 'string' && handover.handedBy === requireAgent()) {
        throw new BoardError(
          'conflict',
          `${handover.handedBy} handed ${taskId} over for review, so it cannot settle it afterwards; the verdict has to come from another --agent (release the card back to To Do first)`,
        )
      }
    }
    const claim = await readOwnClaim(taskId)
    if (claim === null) {
      throw new BoardError('conflict', `no local claim for ${taskId}; if the process crashed, wait for reap to recover the card and claim it again`)
    }
    if (hasOpenExecution(task)) {
      await dropClaim(taskId)
      throw new BoardError('conflict', `the Host took over ${taskId}; the external run yields`)
    }
    if (task.status !== 'running') {
      // A lost response: the board may already hold OUR outcome for this claim
      // (the reply was lost, not the write). Treat that as success instead of
      // reporting a conflict for work the board already recorded.
      const last = task.executions.at(-1)
      const oursAlreadyRecorded = claim.outcomeRequestId !== undefined
        && last?.external === true
        && last.initiatedBy === requireAgent()
        && last.result === result
      await dropClaim(taskId)
      if (oursAlreadyRecorded) {
        return { snapshot, task, requestId: claim.outcomeRequestId, recovered: true, ledgerId }
      }
      throw new BoardError('conflict', `task ${taskId} is ${task.status}, not running; the Host or a human already settled it`)
    }
    const requestId = claim.outcomeRequestId ?? randomId()
    await updateClaim(stateDir, ledgerId, taskId, { outcomeRequestId: requestId })
    const next = await transport.apply({
      requestId,
      action: { kind: 'record-external-outcome', taskId, result, initiatedBy: requireAgent(), summary: composed },
      initiator: requireAgent(),
    })
    await dropClaim(taskId)
    return { snapshot: next, task: findTask(next, taskId), requestId, ledgerId }
  }

  /**
   * Re-check one planned recovery immediately before touching the board.
   * A heartbeat may have renewed the lease (or a human may have touched the
   * card) after the plan was computed; recover only what is still stale.
   */
  async function stillReapable(entry) {
    if (entry.reason === 'lease-expired') {
      const claim = readClaim(stateDir, ledgerId, entry.taskId)
      if (claim !== null && typeof claim.leaseUntil === 'number' && now() < claim.leaseUntil) return false
      return true
    }
    if (entry.reason === 'orphan-stale') {
      const fresh = await state()
      const task = fresh.tasks.find((candidate) => candidate.id === entry.taskId)
      if (task === undefined || task.status !== 'running' || hasOpenExecution(task)) return false
      const touchedAt = typeof task.updatedAt === 'number' ? task.updatedAt : Number.NEGATIVE_INFINITY
      return now() - touchedAt > leaseMs
    }
    return true
  }

  const ops = {
    get ledgerId() {
      return ledgerId
    },
    stateDir,

    claimsDir() {
      return claimsDir(stateDir, ledgerId)
    },

    async state() {
      return state()
    },

    async list({ column, tag, query } = {}) {
      const snapshot = await state()
      const needle = typeof query === 'string' && query.trim() !== '' ? query.trim().toLowerCase() : ''
      const tasks = snapshot.tasks.filter((task) => {
        if (task.archivedAt != null) return false
        if (task.hidden === true) return false
        if (typeof column === 'string' && column !== '' && task.status !== column) return false
        if (typeof tag === 'string' && tag !== '' && !(task.tags ?? []).some((entry) => (typeof entry === 'string' ? entry : entry?.name) === tag)) return false
        if (needle !== '') {
          const haystack = `${task.title ?? ''}\n${task.description ?? ''}\n${task.prompt ?? ''}`.toLowerCase()
          if (!haystack.includes(needle)) return false
        }
        return true
      })
      // `tasks` keeps its shape (a plain task list); the extra `times` map is
      // additive so existing consumers of the payload keep working.
      const times = {}
      for (const task of tasks) times[task.id] = cardTimes(task, readTimeline(stateDir, ledgerId, task.id))
      return { ledgerId, revision: snapshot.revision, tasks, times }
    },

    async get(taskId) {
      const snapshot = await state()
      const task = findTask(snapshot, taskId)
      return { ledgerId, revision: snapshot.revision, ...withTimes(task) }
    },

    /**
     * Publish a card.
     *
     * The board's `create` action takes the id from the action rather than
     * minting one, which is what makes `--id` useful: a card whose prompt has
     * to name its own id (report path, retry hint) can pin it up front instead
     * of being created empty and patched afterwards.
     *
     * `title`, `description` and `prompt` are all REQUIRED to be strings by the
     * board's own input validation, so `description` defaults to '' here rather
     * than being omitted (an omitted field fails the whole action).
     *
     * A subtask inherits its parent's labels. Without that, a parent tagged
     * `external` would spawn children nobody dispatches: the pull-model CLI
     * filters on the tag, and the board does not walk parents.
     */
    async create({ title, description = '', prompt, tags = [], parentId, id } = {}) {
      requireAgent()
      const cleanTitle = requireString(title, 'title')
      const cleanPrompt = requireString(prompt, 'prompt')
      if (description !== undefined && typeof description !== 'string') {
        throw new BoardError('usage', 'description must be a string')
      }
      const cleanDescription = description ?? ''
      const snapshot = await state()
      let cleanParent = ''
      let inherited = []
      if (parentId !== undefined && parentId !== null && parentId !== '') {
        if (typeof parentId !== 'string') throw new BoardError('usage', 'parentId must be a string')
        cleanParent = parentId.trim()
        const parent = snapshot.tasks.find((candidate) => candidate.id === cleanParent)
        if (parent === undefined) throw new BoardError('conflict', `unknown parent task ${cleanParent}`)
        if (parent.archivedAt != null) throw new BoardError('conflict', `parent task ${cleanParent} is archived`)
        inherited = Array.isArray(parent.tags) ? parent.tags : []
      }
      const keep = mergeTags(inherited, tags, cleanParent)
      const nextTags = keep.tags
      const taskId = typeof id === 'string' && id.trim() !== '' ? id.trim() : randomId()
      if (snapshot.tasks.some((candidate) => candidate.id === taskId)) {
        throw new BoardError('conflict', `a card with id ${taskId} already exists; pass a different --id`)
      }
      const next = await transport.apply({
        requestId: randomId(),
        action: {
          kind: 'create',
          id: taskId,
          input: {
            title: cleanTitle,
            description: cleanDescription,
            prompt: cleanPrompt,
            ...(cleanParent === '' ? {} : { parentId: cleanParent }),
            ...(nextTags.length === 0 ? {} : { tags: nextTags }),
          },
        },
        initiator: requireAgent(),
      })
      const created = next.tasks.find((candidate) => candidate.id === taskId)
      if (created === undefined) {
        throw new BoardError('invalid-response', `the board accepted the create but its snapshot does not contain card ${taskId}`)
      }
      return {
        ledgerId,
        id: taskId,
        task: created,
        times: cardTimes(created, readTimeline(stateDir, ledgerId, taskId)),
        ...(cleanParent === '' ? {} : { parentId: cleanParent, inheritedTags: keep.inherited }),
      }
    },

    /**
     * Rewrite a card's own text.
     *
     * The board freezes a card's content once it has any execution record:
     * the text is the record of what was planned, so editing it after a run
     * would change history under the run. `canEditTaskContent` is exactly
     * `archivedAt === undefined && executions.length === 0`, and this refuses
     * the same two cases locally so the reason arrives before the wire.
     *
     * Only the keys actually passed are patched (a patch that omits a field
     * keeps it), and a patch that changes nothing is not sent at all — the
     * board would otherwise bump `updatedAt` for a no-op.
     */
    async update(taskId, { title, description, prompt } = {}) {
      requireAgent()
      const fields = { title, description, prompt }
      const given = Object.entries(fields).filter(([, value]) => value !== undefined)
      if (given.length === 0) {
        throw new BoardError('usage', 'update needs at least one of title/description/prompt')
      }
      for (const [name, value] of given) {
        if (typeof value !== 'string') throw new BoardError('usage', `${name} must be a string`)
      }
      if (title !== undefined && title.trim() === '') throw new BoardError('usage', 'title cannot be emptied')
      if (prompt !== undefined && prompt.trim() === '') throw new BoardError('usage', 'prompt cannot be emptied')
      const snapshot = await state()
      const task = findTask(snapshot, taskId)
      if (task.archivedAt != null) throw new BoardError('conflict', `task ${taskId} is archived`)
      if (Array.isArray(task.executions) && task.executions.length > 0) {
        throw new BoardError(
          'conflict',
          `task ${taskId} already has an execution record; the board freezes a card's text after it has run`,
        )
      }
      // Our own claims leave no execution record (the board only appends one
      // for a Host run), so a card being worked by an external agent would
      // otherwise stay editable while someone rewrites its prompt underneath.
      if (task.status === 'running') {
        throw new BoardError('conflict', `task ${taskId} is being worked right now (running); release it before rewriting its text`)
      }
      const patch = {}
      for (const [name, value] of given) {
        if ((task[name] ?? '') !== value) patch[name] = value
      }
      const changedNames = Object.keys(patch)
      if (changedNames.length === 0) {
        return { ledgerId, changed: false, task, changedFields: [], ...withTimes(task) }
      }
      const next = await transport.apply({
        requestId: randomId(),
        action: { kind: 'update', taskId, patch },
        initiator: requireAgent(),
      })
      const updated = findTask(next, taskId)
      return { ledgerId, changed: true, task: updated, changedFields: changedNames, ...withTimes(updated) }
    },

    async next({ tag = 'external', lease, autoReap = true } = {}) {
      requireAgent()
      if (autoReap) await ops.reap()
      const snapshot = await state()
      const containers = containerTaskIds(snapshot.tasks)
      const candidates = claimableTasks(snapshot.tasks, { tag, containers })
      for (const candidate of candidates) {
        try {
          await move(candidate.id, 'running')
        } catch (error) {
          if (error instanceof BoardError && error.code === 'conflict') continue
          throw error
        }
        const current = await state()
        const task = findTask(current, candidate.id)
        let claim
        try {
          claim = await persistClaim(task, parseLease(lease))
        } catch (error) {
          await move(candidate.id, 'todo').catch(() => undefined)
          throw error
        }
        return { claimed: true, ledgerId, claim, task, hints: dispatchHints(task, readTimeline(stateDir, ledgerId, task.id)) }
      }
      // Say *why* the pool is empty when the reason is the container gate:
      // "no claimable task" sends the caller looking for a tagging mistake.
      const containersSkipped = snapshot.tasks.filter(
        (task) => task.status === 'todo'
          && task.archivedAt == null
          && containers.has(task.id)
          && (task.tags ?? []).some((entry) => (typeof entry === 'string' ? entry : entry?.name) === tag),
      )
      if (containersSkipped.length > 0) {
        throw new BoardError(
          'no-candidate',
          `no leaf card tagged ${tag}; skipped ${containersSkipped.length} container card(s) that still have unfinished subtasks: ${containersSkipped.map((task) => task.id).join(', ')}`,
        )
      }
      throw new BoardError('no-candidate', `no claimable task tagged ${tag}`)
    },

    async claim(taskId, { lease } = {}) {
      requireAgent()
      const snapshot = await state()
      const task = findTask(snapshot, taskId)
      const containers = containerTaskIds(snapshot.tasks)
      if (containers.has(taskId)) {
        const open = snapshot.tasks.filter(
          (child) => child.parentId === taskId && child.archivedAt == null && child.status !== 'done',
        )
        throw new BoardError(
          'conflict',
          `task ${taskId} is a container card: ${open.length} subtask(s) are not in Done yet (${open.map((child) => child.id).join(', ')}); dispatch a leaf instead`,
        )
      }
      const claimable = task.status === 'todo'
        && task.archivedAt == null
        && task.hidden !== true
        && typeof task.prompt === 'string'
        && task.prompt.trim() !== ''
      if (!claimable) throw new BoardError('conflict', `task ${taskId} is not claimable (status ${task.status})`)
      const next = await move(taskId, 'running')
      const running = findTask(next, taskId)
      let claim
      try {
        claim = await persistClaim(running, parseLease(lease))
      } catch (error) {
        // Same rollback as next(): a card left running without a lease would sit
        // there until an orphan reap, so put it back immediately.
        await move(taskId, 'todo').catch(() => undefined)
        throw error
      }
      return { claimed: true, ledgerId, claim, task: running, hints: dispatchHints(running, readTimeline(stateDir, ledgerId, taskId)) }
    },

    async heartbeat(taskId, { lease } = {}) {
      return heartbeat(taskId, parseLease(lease))
    },

    async done(taskId, { summary, report } = {}) {
      const result = await recordOutcome(taskId, { summary, report, result: 'succeeded' })
      // The reviewer's settlement is the moment the card became closable.
      stamp(taskId, { closedAt: now() })
      return { ...result, times: cardTimes(result.task, readTimeline(stateDir, ledgerId, taskId)) }
    },

    async fail(taskId, { summary, report } = {}) {
      return recordOutcome(taskId, { summary, report, result: 'failed' })
    },

    async release(taskId, { reason } = {}) {
      requireAgent()
      const snapshot = await state()
      const task = findTask(snapshot, taskId)
      const claim = await readOwnClaim(taskId)
      if (claim === null) {
        throw new BoardError('conflict', `no local claim for ${taskId}; nothing to release (a crashed claim is recovered by reap)`)
      }
      if (hasOpenExecution(task)) {
        await dropClaim(taskId)
        throw new BoardError('conflict', `the Host took over ${taskId}; nothing to release`)
      }
      if (task.status === 'running') await move(taskId, 'todo')
      await dropClaim(taskId)
      return { released: true, taskId, ...(typeof reason === 'string' && reason !== '' ? { reason } : {}) }
    },

    async tag(taskId, { add = [], remove = [], release = false } = {}) {
      requireAgent()
      const snapshot = await state()
      const task = findTask(snapshot, taskId)
      if (task.archivedAt != null) throw new BoardError('conflict', `task ${taskId} is archived`)
      const claim = readClaim(stateDir, ledgerId, taskId)
      if (claim !== null && claim.agentId !== requireAgent()) {
        throw new BoardError('conflict', `task ${taskId} is claimed by ${claim.agentId}, not ${requireAgent()}`)
      }
      const current = Array.isArray(task.tags) ? task.tags : []
      const byName = new Map()
      for (const entry of current) {
        const name = typeof entry === 'string' ? entry : entry.name
        byName.set(name, typeof entry === 'string' ? { name } : { ...entry })
      }
      for (const name of remove) byName.delete(normalizeTagName(name))
      for (const value of add) {
        const name = normalizeTagName(value)
        if (!byName.has(name)) byName.set(name, { name })
      }
      if (byName.size > TASK_TAG_LIMIT) {
        throw new BoardError('usage', `a card keeps at most ${TASK_TAG_LIMIT} tags; this change would make ${byName.size}`)
      }
      const nextTags = [...byName.values()]
      const changed = !sameTagSet(current, nextTags)
      let latest = snapshot
      if (changed) {
        latest = await transport.apply({
          requestId: randomId(),
          action: {
            kind: 'update',
            taskId,
            patch: nextTags.length === 0 ? { tags: null } : { tags: nextTags },
          },
          initiator: requireAgent(),
        })
      }
      let released = false
      if (release) {
        if (findTask(latest, taskId).status !== 'todo') latest = await move(taskId, 'todo')
        if (claim !== null) deleteClaim(stateDir, ledgerId, taskId)
        released = true
      }
      const result = findTask(latest, taskId)
      const names = (result.tags ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.name))
      // Carrying the review label IS the handover: that is the worker's finish
      // moment, and the only place it can be recorded (a `done` here would
      // settle the card into Done and skip the review entirely). The same write
      // records WHO handed it over — without it the ledger only ever knows who
      // closed a card, never who produced it, and `review` could not tell the
      // worker from an outsider.
      //
      // Only the transition INTO review counts. Re-stamping on every later tag
      // would overwrite the producer with whoever touches the card next — a
      // reviewer adding a label would erase the worker's name and then be
      // blocked by the very check that protects it.
      const hadReview = current.some((entry) => (typeof entry === 'string' ? entry : entry.name) === REVIEW_TAG)
      if (!hadReview && names.includes(REVIEW_TAG)) stamp(taskId, { finishedAt: now(), handedBy: requireAgent() })
      return {
        ledgerId,
        task: result,
        tags: result.tags ?? [],
        changed,
        released,
        times: cardTimes(result, readTimeline(stateDir, ledgerId, taskId)),
      }
    },

    /**
     * The reviewer's single move. `pass` closes the card (clears the review
     * label, then settles it into Done as this agent); `rework` sends it back
     * to the pool with the verdict attached.
     *
     * Both leave a verdict on the card's timeline, because that note is the
     * only place a reviewer can explain a decision: the board freezes a card's
     * text once it has run, so a `rework` with no reason is just a card that
     * mysteriously came back.
     */
    async review(taskId, { verdict, note } = {}) {
      requireAgent()
      const cleanVerdict = typeof verdict === 'string' ? verdict.trim().toLowerCase() : ''
      if (cleanVerdict !== 'pass' && cleanVerdict !== 'rework') {
        throw new BoardError('usage', 'verdict must be "pass" or "rework"')
      }
      const cleanNote = typeof note === 'string' ? note.trim() : ''
      if (cleanVerdict === 'rework' && cleanNote === '') {
        throw new BoardError('usage', 'a rework verdict needs --note saying what to change')
      }
      if (cleanNote.length > EXTERNAL_SUMMARY_MAX_LENGTH) {
        throw new BoardError(
          'usage',
          `note is ${cleanNote.length} chars; the board keeps at most ${EXTERNAL_SUMMARY_MAX_LENGTH}`,
        )
      }
      const snapshot = await state()
      const task = findTask(snapshot, taskId)
      if (!tagNames(task).includes(REVIEW_TAG)) {
        throw new BoardError(
          'conflict',
          `task ${taskId} is not awaiting review: it carries no ${REVIEW_TAG} label (only a worker handing the card back adds it)`,
        )
      }
      // Both verdicts need the card back in the pool's column. `next` skips
      // `running`, and `--pass` claims the card first (which requires `todo`).
      // A card still elsewhere means the handover was incomplete — relabelling
      // it would print "back in the pool" while `next` cannot see it at all.
      if (task.status !== 'todo') {
        throw new BoardError(
          'conflict',
          `task ${taskId} is ${task.status}, not todo; the worker did not release it when handing over (tag --release)`,
        )
      }
      // Separation of duties (§5.3): the agent that handed the card over may not
      // pass its own work. Identity here is self-declared (`--agent`), so this
      // raises the cost of self-review rather than making it impossible — but it
      // does mean the rule is enforced by the tool instead of by whoever
      // remembers to respect it. A card with no handover record (created before
      // this existed, or labelled straight in the GUI) is not blocked: there is
      // nothing to compare against, and guessing would break a working card.
      const handover = readTimeline(stateDir, ledgerId, taskId)
      const handedBy = typeof handover?.handedBy === 'string' ? handover.handedBy : ''
      if (handedBy !== '' && handedBy === requireAgent()) {
        throw new BoardError(
          'conflict',
          `task ${taskId} was handed over by ${handedBy}; the agent that did the work cannot review it — review with a different --agent, or have that agent rework the card itself`,
        )
      }
      const entry = {
        at: now(),
        by: requireAgent(),
        verdict: cleanVerdict,
        ...(cleanNote === '' ? {} : { note: cleanNote }),
      }
      if (cleanVerdict === 'rework') {
        // Back to the pool: `external` returns so `next` hands it out again,
        // `rework` marks why. No `release` — the worker already dropped its claim.
        const tagged = await ops.tag(taskId, { add: [REWORK_TAG, DEFAULT_TAG], remove: [REVIEW_TAG] })
        appendReview(stateDir, ledgerId, taskId, entry)
        return { ledgerId, verdict: cleanVerdict, note: cleanNote, task: tagged.task, tags: tagged.tags, times: tagged.times }
      }
      // `pass`: settle FIRST, drop the labels LAST.
      //
      // The `review` label is the only thing that says "this card still owes a
      // verdict". Clearing it before the settlement would leave a card that
      // `next` will not hand out (no `external`) and `review` will not touch (no
      // `review`) if `claim` or `done` then fails. `done` needs our own claim —
      // record-external-outcome refuses to settle a card nobody holds.
      await ops.claim(taskId)
      let settled
      try {
        appendReview(stateDir, ledgerId, taskId, entry)
        settled = await ops.done(taskId, { summary: cleanNote === '' ? `review passed: ${taskId}` : cleanNote })
      } catch (error) {
        // Two very different things look like a failed settle: a lost reply
        // after the board already recorded it, and a real failure. Look at the
        // card before apologising — and never `release` blindly, because
        // `release` moves the card back to To Do, which on an already-settled
        // card means dragging it out of Done and losing the fact.
        const current = await state().then(
          (snapshot) => findTask(snapshot, taskId),
          () => null,
        )
        if (current !== null && current.status === 'done') {
          // The settle landed; only the reply was lost. Carry on to the label
          // cleanup and report success — nothing is broken.
          settled = { task: current, times: cardTimes(current, readTimeline(stateDir, ledgerId, taskId)) }
        } else {
          const returned = current !== null && current.status === 'running'
            ? await ops.release(taskId, { reason: 'review failed; card returned to To Do' }).then(() => true, () => false)
            : false
          const detail = returned
            ? `the card is back in To Do and still labelled ${REVIEW_TAG}, so it can be retried`
            : `the card is ${current?.status ?? 'in an unknown state'}; check it with get before retrying`
          throw error instanceof BoardError ? new BoardError(error.code, `${error.message} — ${detail}`) : error
        }
      }
      let cleared
      try {
        cleared = await ops.tag(taskId, { remove: [REVIEW_TAG, REWORK_TAG] })
      } catch (error) {
        // The card IS settled at this point; only the cosmetic cleanup failed.
        // Saying so is the difference between "retry the review" (wrong, it will
        // refuse: the card is no longer todo) and "clean the label by hand".
        throw new BoardError(
          'conflict',
          `task ${taskId} is settled in Done; only the label cleanup failed (${error.message}) — run: tag ${taskId} --remove ${REVIEW_TAG} --remove ${REWORK_TAG}`,
        )
      }
      return { ledgerId, verdict: cleanVerdict, note: cleanNote, task: cleared.task, tags: cleared.tags, times: settled.times }
    },

    async mine() {
      requireAgent()
      const snapshot = await state()
      const claims = await listClaims(stateDir, ledgerId)
      const entries = claims
        .filter((claim) => claim.agentId === requireAgent())
        .map((claim) => ({ ...claim, taskStatus: snapshot.tasks.find((task) => task.id === claim.taskId)?.status }))
      return { agentId: requireAgent(), ledgerId, claims: entries }
    },

    async reap({ dryRun = false } = {}) {
      requireAgent()
      const snapshot = await state()
      const claims = await listClaims(stateDir, ledgerId)
      const plan = reapPlan({ snapshot, claims, now: now(), leaseMs })
      const executed = []
      for (const entry of plan) {
        if (entry.action === 'keep') continue
        if (dryRun) {
          executed.push(entry)
          continue
        }
        if (entry.action === 'move-todo' && !(await stillReapable(entry))) continue
        if (entry.action === 'move-todo') {
          try {
            await move(entry.taskId, 'todo')
          } catch (error) {
            if (error instanceof BoardError && error.code === 'conflict') continue
            throw error
          }
        }
        deleteClaim(stateDir, ledgerId, entry.taskId)
        executed.push(entry)
      }
      return { dryRun, ledgerId, entries: plan, executed }
    },

    async doctor() {
      const snapshot = await state()
      return {
        ok: true,
        url: transport.url,
        ledgerId,
        schemaVersion: snapshot.schemaVersion,
        revision: snapshot.revision,
        timeZone: snapshot.scheduler?.timeZone,
        agentId: agentId === '' ? undefined : agentId,
        leaseMs,
        stateDir,
        claimsDir: claimsDir(stateDir, ledgerId),
      }
    },
  }

  return ops
}
