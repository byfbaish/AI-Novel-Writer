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
import { claimableTasks, hasOpenExecution, tagHints, reapPlan } from './select.mjs'
import { claimsDir, writeClaim, readClaim, deleteClaim, listClaims, updateClaim } from './claims.mjs'

export const DEFAULT_LEASE_MS = 60 * 60 * 1000
export const EXTERNAL_SUMMARY_MAX_LENGTH = 1000
/** Mirrors the board's own tag limits (core/tasks.ts). */
export const TASK_TAG_LIMIT = 8
export const TAG_NAME_MAX_LENGTH = 32

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
      return { ledgerId, revision: snapshot.revision, tasks }
    },

    async get(taskId) {
      const snapshot = await state()
      return { ledgerId, revision: snapshot.revision, task: findTask(snapshot, taskId) }
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
     */
    async create({ title, description = '', prompt, tags = [], parentId, id } = {}) {
      requireAgent()
      const cleanTitle = requireString(title, 'title')
      const cleanPrompt = requireString(prompt, 'prompt')
      if (description !== undefined && typeof description !== 'string') {
        throw new BoardError('usage', 'description must be a string')
      }
      const cleanDescription = description ?? ''
      const nextTags = []
      const seen = new Set()
      for (const value of Array.isArray(tags) ? tags : []) {
        const name = normalizeTagName(value)
        if (seen.has(name)) continue
        seen.add(name)
        nextTags.push({ name })
      }
      if (nextTags.length > TASK_TAG_LIMIT) {
        throw new BoardError('usage', `a card keeps at most ${TASK_TAG_LIMIT} tags; this create would make ${nextTags.length}`)
      }
      const snapshot = await state()
      let cleanParent = ''
      if (parentId !== undefined && parentId !== null && parentId !== '') {
        if (typeof parentId !== 'string') throw new BoardError('usage', 'parentId must be a string')
        cleanParent = parentId.trim()
        const parent = snapshot.tasks.find((candidate) => candidate.id === cleanParent)
        if (parent === undefined) throw new BoardError('conflict', `unknown parent task ${cleanParent}`)
        if (parent.archivedAt != null) throw new BoardError('conflict', `parent task ${cleanParent} is archived`)
      }
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
      return { ledgerId, id: taskId, task: created, ...(cleanParent === '' ? {} : { parentId: cleanParent }) }
    },

    async next({ tag = 'external', lease, autoReap = true } = {}) {
      requireAgent()
      if (autoReap) await ops.reap()
      const snapshot = await state()
      const candidates = claimableTasks(snapshot.tasks, { tag })
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
        return { claimed: true, ledgerId, claim, task, hints: tagHints(task) }
      }
      throw new BoardError('no-candidate', `no claimable task tagged ${tag}`)
    },

    async claim(taskId, { lease } = {}) {
      requireAgent()
      const snapshot = await state()
      const task = findTask(snapshot, taskId)
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
      return { claimed: true, ledgerId, claim, task: running, hints: tagHints(running) }
    },

    async heartbeat(taskId, { lease } = {}) {
      return heartbeat(taskId, parseLease(lease))
    },

    async done(taskId, { summary, report } = {}) {
      return recordOutcome(taskId, { summary, report, result: 'succeeded' })
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
      return { ledgerId, task: result, tags: result.tags ?? [], changed, released }
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
