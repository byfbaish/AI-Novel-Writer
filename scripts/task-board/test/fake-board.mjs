/**
 * A node:http stand-in for the DSH task board, used only by tests.
 *
 * It reproduces the parts of the real board this CLI depends on:
 *  - the browser-shaped Origin tripwire (exact origin match),
 *  - POST /action with a JSON envelope and requestId idempotency,
 *  - single-writer column transitions (moving into the current column is
 *    refused, which is what makes `todo -> running` an atomic claim),
 *  - `record-external-outcome` appending an execution record.
 *
 * It is intentionally not a full reimplementation of the plugin.
 */

import http from 'node:http'

function normalizeTask(task, index) {
  const now = 1_700_000_000_000 + index
  return {
    id: task.id,
    title: task.title ?? `task ${task.id}`,
    description: task.description ?? '',
    prompt: task.prompt ?? `do ${task.id}`,
    status: task.status ?? 'todo',
    createdAt: task.createdAt ?? now,
    updatedAt: task.updatedAt ?? now,
    executions: Array.isArray(task.executions) ? task.executions : [],
    ...(task.tags === undefined ? {} : { tags: task.tags }),
    ...(task.parentId === undefined ? {} : { parentId: task.parentId }),
    ...(task.schedule === undefined ? {} : { schedule: task.schedule }),
    ...(task.archivedAt === undefined ? {} : { archivedAt: task.archivedAt }),
    ...(task.hidden === undefined ? {} : { hidden: task.hidden }),
  }
}

function hasOpenExecution(task) {
  const last = task.executions.at(-1)
  return last !== undefined && last.endedAt === undefined
}

/**
 * @param {{
 *   tasks?: object[],
 *   tripwire?: boolean,
 *   requiredOrigin?: string,
 *   ledgerId?: string,
 *   forceStateStatus?: number,
 *   schemaVersion?: number,
 * }} [options]
 */
export async function startFakeBoard(options = {}) {
  const ledgerId = options.ledgerId ?? `fake-ledger-${Math.random().toString(16).slice(2)}`
  const tripwire = options.tripwire !== false
  const tasks = (options.tasks ?? []).map(normalizeTask)
  const recentRequests = new Map()
  const calls = []
  let revision = 1
  let server
  let board

  function snapshot() {
    return {
      schemaVersion: options.schemaVersion ?? 7,
      revision,
      tasks: structuredClone(tasks),
      scheduler: { timeZone: 'UTC', ledgerId, lastTickAt: Date.now() },
      power: { platform: 'test', phase: 'idle', enabled: true, runningSessions: 0, armedSchedules: 0, sessionStateKnown: true },
      sessionDefaultPermission: 'workspace-write',
      maxSubtaskDepth: 1,
    }
  }

  function trusted(req) {
    if (!tripwire) return true
    const expected = options.requiredOrigin ?? board.origin
    return req.headers.origin === expected
  }

  function sendJson(res, status, value) {
    const body = JSON.stringify(value)
    res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
    res.end(body)
  }

  function findTask(taskId) {
    return tasks.find((task) => task.id === taskId)
  }

  function refuse(message) {
    return { status: 400, payload: { ok: false, error: message } }
  }

  function applyAction(action) {
    switch (action.kind) {
      case 'move': {
        const task = findTask(action.taskId)
        if (task === undefined) return refuse('unknown task')
        if (task.archivedAt !== undefined) return refuse('task is archived')
        if (hasOpenExecution(task)) return refuse('task has an open execution')
        if (task.status === action.status) return refuse(`task is already in column ${action.status}`)
        task.status = action.status
        task.updatedAt = Date.now()
        return undefined
      }
      case 'record-external-outcome': {
        const task = findTask(action.taskId)
        if (task === undefined) return refuse('unknown task')
        if (task.archivedAt !== undefined) return refuse('task is archived')
        if (hasOpenExecution(task)) return refuse('running task cannot receive an external outcome')
        const now = Date.now()
        task.executions.push({
          id: `exec-${task.executions.length + 1}`,
          startedAt: now,
          endedAt: now,
          result: action.result,
          initiatedBy: action.initiatedBy,
          external: true,
          ...(action.summary === undefined ? {} : { error: action.summary }),
        })
        task.status = action.result === 'succeeded' ? 'done' : 'failed'
        task.updatedAt = now
        return undefined
      }
      case 'create': {
        // Mirrors the plugin's createInput: title/description/prompt must be
        // strings, the id comes from the action, and the card lands in To Do.
        if (typeof action.id !== 'string' || action.id === '') return refuse('invalid-action')
        if (findTask(action.id) !== undefined) return refuse('duplicate-task-id')
        const input = action.input ?? {}
        if (typeof input.title !== 'string' || typeof input.description !== 'string' || typeof input.prompt !== 'string') {
          return refuse('invalid-action')
        }
        if (input.parentId !== undefined && findTask(input.parentId) === undefined) return refuse('unknown-parent')
        if (input.tags !== undefined && !Array.isArray(input.tags)) return refuse('invalid-action')
        tasks.push(normalizeTask({
          id: action.id,
          title: input.title,
          description: input.description,
          prompt: input.prompt,
          status: 'todo',
          ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
          ...(input.tags === undefined ? {} : { tags: input.tags }),
        }, tasks.length))
        return undefined
      }
      case 'update': {
        const task = findTask(action.taskId)
        if (task === undefined) return refuse('unknown task')
        if (task.archivedAt !== undefined) return refuse('task is archived')
        const patch = action.patch ?? {}
        // Mirrors canEditTaskContent: the text is frozen once anything ran.
        const contentKeys = ['title', 'description', 'prompt'].filter((key) => key in patch)
        if (contentKeys.length > 0) {
          if (task.executions.length > 0) return refuse('task has already been executed')
          for (const key of contentKeys) {
            if (typeof patch[key] !== 'string') return refuse('invalid-action')
            task[key] = patch[key]
          }
        }
        if ('tags' in patch) {
          if (patch.tags === null) {
            delete task.tags
          } else if (Array.isArray(patch.tags)
            && patch.tags.length > 0
            && patch.tags.length <= 8
            && patch.tags.every((tag) => tag !== null && typeof tag === 'object' && typeof tag.name === 'string')) {
            task.tags = patch.tags
          } else {
            return refuse('invalid-action')
          }
        }
        task.updatedAt = Date.now()
        return undefined
      }
      default:
        return { status: 400, payload: { ok: false, error: 'invalid-action' } }
    }
  }

  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/api/task-board/state') {
      if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
      if (options.forceStateStatus !== undefined) return sendJson(res, options.forceStateStatus, { ok: false, error: 'forced' })
      if (!trusted(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' })
      return sendJson(res, 200, snapshot())
    }
    if (url.pathname === '/api/task-board/action') {
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
        return sendJson(res, 415, { ok: false, error: 'json-required' })
      }
      if (!trusted(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' })
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        calls.push({ method: req.method, path: url.pathname, headers: req.headers, body: raw })
        let envelope
        try {
          envelope = JSON.parse(raw)
        } catch {
          return sendJson(res, 400, { ok: false, error: 'invalid-action' })
        }
        if (typeof envelope?.requestId !== 'string' || typeof envelope?.action?.kind !== 'string') {
          return sendJson(res, 400, { ok: false, error: 'invalid-action' })
        }
        if (typeof envelope.initiator === 'string' && envelope.initiator.length > 256) {
          return sendJson(res, 400, { ok: false, error: 'invalid-action' })
        }
        if (envelope.action.kind === 'record-external-outcome'
          && typeof envelope.action.initiatedBy === 'string'
          && envelope.action.initiatedBy.length > 200) {
          return sendJson(res, 400, { ok: false, error: 'invalid-action' })
        }
        const cached = recentRequests.get(envelope.requestId)
        if (cached !== undefined) return sendJson(res, 200, cached)
        const problem = applyAction(envelope.action)
        if (problem !== undefined) return sendJson(res, problem.status, problem.payload)
        revision += 1
        const next = snapshot()
        recentRequests.set(envelope.requestId, next)
        return sendJson(res, 200, next)
      })
      return undefined
    }
    return sendJson(res, 404, { ok: false, error: 'not-found' })
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const origin = `http://127.0.0.1:${address.port}`

  board = {
    url: origin,
    origin,
    ledgerId,
    server,
    calls,
    snapshot,
    tasks,
    /** Simulate a human moving a card from the GUI. */
    hostMove(taskId, status) {
      const task = findTask(taskId)
      task.status = status
      task.updatedAt = Date.now()
      revision += 1
    },
    /** Simulate the Host starting a DSH run on a card (open execution). */
    hostRun(taskId) {
      const task = findTask(taskId)
      task.executions.push({ id: `host-run-${task.executions.length + 1}`, startedAt: Date.now() })
      task.status = 'running'
      task.updatedAt = Date.now()
      revision += 1
    },
    /** Simulate the Host settling its run. */
    hostSettle(taskId, result = 'succeeded') {
      const task = findTask(taskId)
      const last = task.executions.at(-1)
      last.endedAt = Date.now()
      last.result = result
      task.status = result === 'succeeded' ? 'done' : 'failed'
      task.updatedAt = Date.now()
      revision += 1
    },
    async close() {
      await new Promise((resolve) => server.close(resolve))
    },
  }
  return board
}
