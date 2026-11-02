/**
 * Pure selection + reap decisions over a board snapshot. No fs, no network:
 * `ops` calls these and performs the moves; tests can pin `now`.
 *
 * A card is claimable when it is published for outside work:
 * todo, not archived, not hidden, tagged with the requested tag *name*,
 * not schedule-armed (scheduled cards belong to the Host), and has a prompt.
 */

export const DEFAULT_TAG = 'external'

/** Last execution still open means the Host is running the card right now. */
export function hasOpenExecution(task) {
  const executions = task?.executions
  if (!Array.isArray(executions) || executions.length === 0) return false
  const last = executions.at(-1)
  return last !== null && typeof last === 'object' && last.endedAt === undefined
}

function matchesTag(tags, tag) {
  if (typeof tag !== 'string' || tag === '' || !Array.isArray(tags)) return false
  return tags.some((entry) => (typeof entry === 'string' ? entry : entry?.name) === tag)
}

export function isClaimable(task, { tag = DEFAULT_TAG } = {}) {
  if (task === null || typeof task !== 'object') return false
  if (task.status !== 'todo') return false
  if (task.archivedAt != null) return false
  if (task.hidden === true) return false
  if (task.schedule?.enabled === true) return false
  if (typeof task.prompt !== 'string' || task.prompt.trim() === '') return false
  return matchesTag(task.tags, tag)
}

function createdAtOf(task) {
  const createdAt = task?.createdAt
  return typeof createdAt === 'number' && Number.isFinite(createdAt) ? createdAt : Number.MAX_SAFE_INTEGER
}

/** Claimable cards, oldest first (first published, first served). */
export function claimableTasks(tasks, opts = {}) {
  if (!Array.isArray(tasks)) return []
  return tasks.filter((task) => isClaimable(task, opts)).sort((a, b) => createdAtOf(a) - createdAtOf(b))
}

/** Non-empty `tags[].promptPrefix` strings, in tag order, de-duplicated. */
export function tagHints(task) {
  const tags = Array.isArray(task?.tags) ? task.tags : []
  const hints = []
  for (const entry of tags) {
    const prefix = typeof entry === 'string' ? undefined : entry?.promptPrefix
    if (typeof prefix === 'string' && prefix.trim() !== '') hints.push(prefix.trim())
  }
  return [...new Set(hints)]
}

/**
 * Decide what `reap` should do, without doing it. Idempotent and side-effect
 * free: the caller applies the returned actions against the board.
 *
 * Decisions, one per claim plus orphaned running cards:
 *  - `delete-claim` / `task-not-running`  card left running (human moved/closed it) — drop the lease, leave the card.
 *  - `delete-claim` / `task-missing`      claim points at a card the snapshot no longer has.
 *  - `delete-claim` / `host-running`      card has an open execution — the Host took over, yield.
 *  - `keep` / `lease-active`              running, no open execution, lease still valid.
 *  - `move-todo` / `lease-expired`        running, no open execution, lease expired or corrupt — recover the card.
 *  - `move-todo` / `orphan-stale`         running with no claim and `updatedAt` older than the lease grace (move-then-crash window).
 *
 * Cards that are `running` without a claim but were touched recently are left
 * alone: another agent may be between `move` and its claim write.
 *
 * @param {{ snapshot: object, claims?: object[], now?: number, leaseMs?: number }} input
 * @returns {{ taskId: string, action: 'delete-claim' | 'move-todo' | 'keep', reason: string }[]}
 */
export function reapPlan({ snapshot, claims = [], now = Date.now(), leaseMs = 3_600_000 } = {}) {
  if (snapshot === null || typeof snapshot !== 'object' || !Array.isArray(snapshot.tasks)) {
    throw new TypeError('reapPlan needs a snapshot with a tasks array')
  }
  const tasks = new Map()
  for (const task of snapshot.tasks) {
    if (task !== null && typeof task === 'object' && typeof task.id === 'string') tasks.set(task.id, task)
  }

  const plan = []
  const seen = new Set()
  for (const claim of Array.isArray(claims) ? claims : []) {
    const taskId = claim?.taskId
    if (typeof taskId !== 'string' || taskId === '' || seen.has(taskId)) continue
    seen.add(taskId)

    const task = tasks.get(taskId)
    if (task === undefined) {
      plan.push({ taskId, action: 'delete-claim', reason: 'task-missing' })
      continue
    }
    if (task.status !== 'running') {
      plan.push({ taskId, action: 'delete-claim', reason: 'task-not-running' })
      continue
    }
    if (hasOpenExecution(task)) {
      plan.push({ taskId, action: 'delete-claim', reason: 'host-running' })
      continue
    }
    const leaseUntil = claim.leaseUntil
    if (typeof leaseUntil === 'number' && Number.isFinite(leaseUntil) && now < leaseUntil) {
      plan.push({ taskId, action: 'keep', reason: 'lease-active' })
      continue
    }
    plan.push({ taskId, action: 'move-todo', reason: 'lease-expired' })
  }

  for (const task of tasks.values()) {
    if (task.status !== 'running' || seen.has(task.id) || hasOpenExecution(task)) continue
    const updatedAt = task.updatedAt
    const touchedAt = typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : Number.NEGATIVE_INFINITY
    if (now - touchedAt <= leaseMs) continue
    plan.push({ taskId: task.id, action: 'move-todo', reason: 'orphan-stale' })
  }

  return plan
}
