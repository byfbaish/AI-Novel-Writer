import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { httpTransport } from '../lib/transport.mjs'
import { createOps } from '../lib/ops.mjs'
import { readClaim, updateClaim } from '../lib/claims.mjs'
import { startFakeBoard } from './fake-board.mjs'

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-task-board-ops-'))
}

async function setup(tasks, options = {}) {
  const board = await startFakeBoard({ tasks })
  const stateDir = tempDir()
  const ops = createOps({
    transport: httpTransport(board.url),
    stateDir,
    agentId: options.agentId ?? 'test:agent',
    leaseMs: options.leaseMs,
    now: options.now,
  })
  return { board, stateDir, ops }
}

test('next claims the oldest claimable task and moves it to running', async () => {
  const { board, ops } = await setup([
    { id: 'late', createdAt: 200, tags: [{ name: 'external' }] },
    { id: 'early', createdAt: 100, tags: [{ name: 'external' }] },
    { id: 'other', createdAt: 50, tags: [{ name: 'internal' }] },
  ])
  const first = await ops.next({ tag: 'external' })
  assert.equal(first.task.id, 'early')
  assert.equal(board.snapshot().tasks.find((task) => task.id === 'early').status, 'running')
  const second = await ops.next({ tag: 'external' })
  assert.equal(second.task.id, 'late')
  await board.close()
})

test('next reports no-candidate when nothing is claimable', async () => {
  const { board, ops } = await setup([{ id: 't1', status: 'running', tags: [{ name: 'external' }] }])
  await assert.rejects(() => ops.next({ tag: 'external', autoReap: false }), (error) => error.code === 'no-candidate')
  await board.close()
})

test('next hands out the leaf, never the container that owns it', async () => {
  const { board, ops } = await setup([
    { id: 'container', createdAt: 100, tags: [{ name: 'external' }] },
    { id: 'leaf', createdAt: 200, parentId: 'container', tags: [{ name: 'external' }] },
  ])
  const claimed = await ops.next({ tag: 'external' })
  assert.equal(claimed.task.id, 'leaf')
  assert.equal(board.snapshot().tasks.find((task) => task.id === 'container').status, 'todo')
  await board.close()
})

test('next names the containers it skipped when they are the only tagged cards', async () => {
  const { board, ops } = await setup([
    { id: 'container', createdAt: 100, tags: [{ name: 'external' }] },
    { id: 'child', createdAt: 200, parentId: 'container', tags: [{ name: 'batch' }] },
  ])
  await assert.rejects(
    () => ops.next({ tag: 'external', autoReap: false }),
    (error) => error.code === 'no-candidate'
      && /container/u.test(error.message)
      && error.message.includes('container'),
  )
  await board.close()
})

test('claim refuses a container card instead of dispatching it', async () => {
  const { board, ops } = await setup([
    { id: 'container', tags: [{ name: 'external' }] },
    { id: 'child', parentId: 'container' },
  ])
  await assert.rejects(
    () => ops.claim('container'),
    (error) => error.code === 'conflict' && /container/u.test(error.message) && error.message.includes('child'),
  )
  assert.equal(board.snapshot().tasks.find((task) => task.id === 'container').status, 'todo', 'a refused claim must not move the card')
  await board.close()
})

test('two concurrent claims never both win the same card', async () => {
  const { board, ops } = await setup([{ id: 'only', tags: [{ name: 'external' }] }])
  const results = await Promise.allSettled([
    ops.next({ tag: 'external' }),
    ops.next({ tag: 'external', autoReap: false }),
  ])
  const won = results.filter((result) => result.status === 'fulfilled')
  const lost = results.filter((result) => result.status === 'rejected')
  assert.equal(won.length, 1)
  assert.equal(lost.length, 1)
  assert.equal(lost[0].reason.code, 'no-candidate')
  await board.close()
})

test('heartbeat renews the lease and refuses when the card left running', async () => {
  const { board, stateDir, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  const { claim } = await ops.next({ tag: 'external' })
  const renewed = await ops.heartbeat('t1')
  assert.ok(renewed.claim.leaseUntil >= claim.leaseUntil)
  board.hostMove('t1', 'done')
  await assert.rejects(() => ops.heartbeat('t1'), (error) => error.code === 'conflict')
  assert.equal(readClaim(stateDir, board.ledgerId, 't1'), null)
  await board.close()
})

test('heartbeat yields when the Host starts its own run', async () => {
  const { board, stateDir, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  board.hostRun('t1')
  await assert.rejects(() => ops.heartbeat('t1'), (error) => error.code === 'conflict')
  assert.equal(readClaim(stateDir, board.ledgerId, 't1'), null)
  await board.close()
})

test('done records an external outcome, settles the card and drops the claim', async () => {
  const { board, stateDir, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  const result = await ops.done('t1', { summary: 'fixed the thing', report: 'docs/report.md' })
  assert.equal(result.task.status, 'done')
  const task = board.snapshot().tasks.find((candidate) => candidate.id === 't1')
  assert.equal(task.executions.at(-1).external, true)
  assert.equal(task.executions.at(-1).initiatedBy, 'test:agent')
  assert.match(task.executions.at(-1).error, /fixed the thing/u)
  assert.match(task.executions.at(-1).error, /docs\/report\.md/u)
  assert.equal(readClaim(stateDir, board.ledgerId, 't1'), null)
  await board.close()
})

test('done refuses and writes nothing when the Host owns the card', async () => {
  const { board, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  board.hostRun('t1')
  await assert.rejects(() => ops.done('t1', { summary: 'x' }), (error) => error.code === 'conflict')
  const task = board.snapshot().tasks.find((candidate) => candidate.id === 't1')
  assert.equal(task.executions.filter((execution) => execution.external === true).length, 0)
  await board.close()
})

test('done validates the summary length before calling the board', async () => {
  const { board, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  await assert.rejects(() => ops.done('t1', { summary: 'x'.repeat(1001) }), (error) => error.code === 'usage')
  await board.close()
})

test('release puts the card back and clears the claim', async () => {
  const { board, stateDir, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  const released = await ops.release('t1', { reason: 'not mine' })
  assert.equal(released.released, true)
  assert.equal(board.snapshot().tasks[0].status, 'todo')
  assert.equal(readClaim(stateDir, board.ledgerId, 't1'), null)
  await board.close()
})

test('reap recovers an expired lease and leaves an active one alone', async () => {
  let clock = 1_000_000
  const { board, ops } = await setup([
    { id: 'expired', tags: [{ name: 'external' }] },
    { id: 'active', tags: [{ name: 'external' }] },
  ], { now: () => clock, leaseMs: 60_000 })
  await ops.next({ tag: 'external', lease: 60_000 })
  await ops.next({ tag: 'external', lease: 60_000 })
  clock += 30_000
  const dry = await ops.reap({ dryRun: true })
  assert.deepEqual(dry.executed, [])
  assert.equal(dry.entries.length, 2)
  assert.ok(dry.entries.every((entry) => entry.action === 'keep' && entry.reason === 'lease-active'))
  clock += 60_000
  const result = await ops.reap()
  assert.equal(result.executed.length, 2)
  assert.deepEqual(board.snapshot().tasks.map((task) => task.status), ['todo', 'todo'])
  await board.close()
})

test('done refuses after the Host settled the card (no takeover window left)', async () => {
  const { board, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  board.hostRun('t1')
  board.hostSettle('t1', 'succeeded')
  await assert.rejects(() => ops.done('t1', { summary: 'x' }), (error) => error.code === 'conflict')
  const task = board.snapshot().tasks.find((candidate) => candidate.id === 't1')
  assert.equal(task.executions.filter((execution) => execution.external === true).length, 0)
  await board.close()
})

test('done and release refuse without a local claim', async () => {
  const { board, stateDir, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  fs.unlinkSync(path.join(stateDir, 'boards', board.ledgerId, 'claims', 't1.json'))
  await assert.rejects(() => ops.done('t1', { summary: 'x' }), (error) => error.code === 'conflict')
  await assert.rejects(() => ops.release('t1'), (error) => error.code === 'conflict')
  await board.close()
})

test('expectedLedgerId pins the board resolved before the first call', async () => {
  const board = await startFakeBoard({ ledgerId: 'ledger-pinned' })
  const pinned = createOps({
    transport: httpTransport(board.url),
    stateDir: tempDir(),
    agentId: 'test:agent',
    expectedLedgerId: 'some-other-ledger',
  })
  await assert.rejects(() => pinned.state(), (error) => error.code === 'board-mismatch')
  await board.close()
})

test('done recovers a lost response when the board already recorded our outcome', async () => {
  const { board, stateDir, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  const requestId = 'lost-response-1'
  updateClaim(stateDir, board.ledgerId, 't1', { outcomeRequestId: requestId })
  // The board applies the write but the CLI never sees the reply.
  await httpTransport(board.url).apply({
    requestId,
    action: { kind: 'record-external-outcome', taskId: 't1', result: 'succeeded', initiatedBy: 'test:agent', summary: 'x' },
  })
  const result = await ops.done('t1', { summary: 'x' })
  assert.equal(result.recovered, true)
  assert.equal(result.task.status, 'done')
  assert.equal(readClaim(stateDir, board.ledgerId, 't1'), null)
  await board.close()
})

test('claim rolls the card back when the lease cannot be persisted', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', status: 'todo' }] })
  const notADir = path.join(tempDir(), 'not-a-directory')
  fs.writeFileSync(notADir, 'x')
  const ops = createOps({ transport: httpTransport(board.url), stateDir: notADir, agentId: 'test:agent' })
  await assert.rejects(() => ops.claim('t1'))
  assert.equal(board.snapshot().tasks[0].status, 'todo')
  await board.close()
})

test('reap needs an identity and mutates nothing before failing', async () => {
  const { board, stateDir, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  const lessOps = createOps({ transport: httpTransport(board.url), stateDir, agentId: '' })
  await assert.rejects(() => lessOps.reap(), (error) => error.code === 'usage')
  assert.equal(readClaim(stateDir, board.ledgerId, 't1')?.taskId, 't1')
  assert.equal(board.snapshot().tasks[0].status, 'running')
  await board.close()
})

test('an over-long agent identity is a usage error before any board write', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', status: 'todo' }] })
  const ops = createOps({ transport: httpTransport(board.url), stateDir: tempDir(), agentId: 'x'.repeat(201) })
  await assert.rejects(() => ops.claim('t1'), (error) => error.code === 'usage')
  assert.equal(board.snapshot().tasks[0].status, 'todo')
  await board.close()
})

test('tag adds/removes labels, preserves promptPrefix, and releases on demand', async () => {
  const { board, stateDir, ops } = await setup([{ id: 't1', tags: [{ name: 'external', promptPrefix: 'keep me' }] }])
  await ops.next({ tag: 'external' })
  const tagged = await ops.tag('t1', { add: ['review'], remove: ['external'] })
  assert.deepEqual(tagged.tags, [{ name: 'review' }])
  const withPrefix = await ops.tag('t1', { add: ['external'] })
  const kept = withPrefix.tags.find((tag) => tag.name === 'external')
  assert.equal(kept.promptPrefix, undefined)
  const released = await ops.tag('t1', { release: true })
  assert.equal(released.released, true)
  assert.equal(board.snapshot().tasks[0].status, 'todo')
  assert.equal(readClaim(stateDir, board.ledgerId, 't1'), null)
  await board.close()
})

test('tag enforces the board tag limit locally', async () => {
  const { board, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  const tooMany = Array.from({ length: 8 }, (_, index) => `tag-${index}`)
  await assert.rejects(() => ops.tag('t1', { add: tooMany }), (error) => error.code === 'usage')
  await board.close()
})

test('mine works before any other call (no ledgerId yet)', async () => {
  const { board, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  const mine = await ops.mine()
  assert.deepEqual(mine.claims, [])
  await board.close()
})

test('mine lists only this agent’s claims', async () => {
  const { board, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  const mine = await ops.mine()
  assert.equal(mine.claims.length, 1)
  assert.equal(mine.claims[0].taskId, 't1')
  assert.equal(mine.claims[0].taskStatus, 'running')
  await board.close()
})

test('create publishes into To Do with the pinned id and de-duplicated tags', async () => {
  const { board, ops } = await setup([])
  const created = await ops.create({
    title: 'T',
    description: 'D',
    prompt: 'P',
    tags: ['external', 'external'],
    id: 'pinned-1',
  })
  assert.equal(created.id, 'pinned-1')
  assert.equal(created.task.status, 'todo')
  assert.equal(created.task.title, 'T')
  assert.deepEqual(created.task.tags, [{ name: 'external' }])
  assert.equal(board.snapshot().tasks.length, 1)
  await board.close()
})

test('create mints an id and an empty description when they are omitted', async () => {
  const { board, ops } = await setup([])
  const created = await ops.create({ title: 'T', prompt: 'P' })
  assert.match(created.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u)
  assert.equal(created.task.description, '')
  assert.equal(created.task.tags, undefined)
  await board.close()
})

test('create refuses bad input before any board write', async () => {
  const { board, ops } = await setup([
    { id: 'exists', status: 'todo' },
    { id: 'archived-parent', status: 'todo', archivedAt: 1 },
  ])
  await assert.rejects(() => ops.create({ prompt: 'P' }), (error) => error.code === 'usage')
  await assert.rejects(() => ops.create({ title: 'T' }), (error) => error.code === 'usage')
  await assert.rejects(() => ops.create({ title: 'T', prompt: 'P', tags: [''] }), (error) => error.code === 'usage')
  await assert.rejects(
    () => ops.create({ title: 'T', prompt: 'P', tags: Array.from({ length: 9 }, (_, index) => `t${index}`) }),
    (error) => error.code === 'usage',
  )
  await assert.rejects(() => ops.create({ title: 'T', prompt: 'P', id: 'exists' }), (error) => error.code === 'conflict')
  await assert.rejects(() => ops.create({ title: 'T', prompt: 'P', parentId: 'missing' }), (error) => error.code === 'conflict')
  await assert.rejects(
    () => ops.create({ title: 'T', prompt: 'P', parentId: 'archived-parent' }),
    (error) => error.code === 'conflict',
  )
  assert.equal(board.snapshot().tasks.length, 2)
  await board.close()
})

test('update rewrites the text of a card that has not run', async () => {
  const { board, ops } = await setup([{ id: 't1', status: 'todo', prompt: 'old', description: 'old d' }])
  const result = await ops.update('t1', { prompt: 'new prompt', description: 'new d' })
  assert.equal(result.changed, true)
  assert.deepEqual(result.changedFields.sort(), ['description', 'prompt'])
  const stored = board.snapshot().tasks[0]
  assert.equal(stored.prompt, 'new prompt')
  assert.equal(stored.description, 'new d')
  assert.equal(stored.title, 'task t1', 'an omitted field keeps its value')
  await board.close()
})

test('update refuses a card that already ran or is being worked', async () => {
  const { board, ops } = await setup([
    { id: 'ran', status: 'todo', prompt: 'p', executions: [{ startedAt: 1, endedAt: 2, result: 'succeeded' }] },
    { id: 'busy', status: 'todo', prompt: 'p', tags: [{ name: 'external' }] },
    { id: 'fresh', status: 'todo', prompt: 'p' },
  ])
  await assert.rejects(
    () => ops.update('ran', { prompt: 'rewritten' }),
    (error) => error.code === 'conflict' && /execution record/u.test(error.message),
  )
  // A pull-model claim writes no execution record, so `running` is the only
  // signal that an external agent holds the card.
  await ops.claim('busy')
  await assert.rejects(
    () => ops.update('busy', { prompt: 'rewritten' }),
    (error) => error.code === 'conflict' && /being worked/u.test(error.message),
  )
  const revisionBefore = board.snapshot().revision
  const noop = await ops.update('fresh', { prompt: 'p' })
  assert.equal(noop.changed, false)
  assert.equal(board.snapshot().revision, revisionBefore, 'a no-op must not bump the ledger')
  await assert.rejects(() => ops.update('fresh', {}), (error) => error.code === 'usage')
  await assert.rejects(() => ops.update('fresh', { prompt: '   ' }), (error) => error.code === 'usage')
  await board.close()
})

test('handing a card over for review stamps finishedAt, and done stamps closable', async () => {
  const at = 1_800_000_000_000
  const { board, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }], { now: () => at })
  await ops.next({ tag: 'external' })
  const handedOver = await ops.tag('t1', { add: ['review'], remove: ['external'], release: true })
  assert.equal(handedOver.times.finishedAt, at)
  assert.equal(handedOver.times.closableAt, undefined, 'not closable until the review passes')
  await ops.claim('t1')
  const closed = await ops.done('t1', { summary: 'reviewed' })
  assert.equal(closed.task.status, 'done')
  assert.equal(closed.times.closableAt, at)
  const fetched = await ops.get('t1')
  assert.equal(fetched.times.finishedAt, at)
  assert.equal(typeof fetched.times.createdAt, 'number')
  assert.equal(typeof fetched.times.updatedAt, 'number')
  await board.close()
})

test('review --pass clears the label and settles the card into Done', async () => {
  const at = 1_800_000_000_000
  const { board, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }, { name: 'I2' }] }], { now: () => at })
  await ops.next({ tag: 'external' })
  await ops.tag('t1', { add: ['review'], remove: ['external'], release: true })
  const reviewed = await ops.review('t1', { verdict: 'pass', note: 'looks right' })
  assert.equal(reviewed.verdict, 'pass')
  assert.equal(reviewed.task.status, 'done')
  assert.deepEqual(reviewed.tags.map((entry) => entry.name), ['I2'], 'the review label is gone, the importance label stays')
  assert.equal(reviewed.times.closableAt, at)
  await board.close()
})

test('review --rework needs a note, and sends the card back to the pool with it', async () => {
  const { board, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  await ops.tag('t1', { add: ['review'], remove: ['external'], release: true })

  await assert.rejects(
    () => ops.review('t1', { verdict: 'rework' }),
    (error) => error.code === 'usage' && /note/u.test(error.message),
  )

  const reviewed = await ops.review('t1', { verdict: 'rework', note: '第 3 节的表格要按新列重排' })
  assert.deepEqual(reviewed.tags.map((entry) => entry.name).sort(), ['external', 'rework'])
  assert.equal(reviewed.task.status, 'todo')

  // The note is the whole reason the card is claimable again: it travels to the
  // next worker as a hint, because the card's own text is frozen now.
  const reclaim = await ops.next({ tag: 'external' })
  assert.equal(reclaim.task.id, 't1')
  assert.ok(reclaim.hints.some((hint) => /第 3 节/u.test(hint)), `expected the verdict in the hints, got ${JSON.stringify(reclaim.hints)}`)
  await board.close()
})

test('review refuses a card nobody handed back', async () => {
  const { board, ops } = await setup([{ id: 't1', status: 'todo', tags: [{ name: 'external' }] }])
  await assert.rejects(
    () => ops.review('t1', { verdict: 'pass' }),
    (error) => error.code === 'conflict' && /review/u.test(error.message),
  )
  await assert.rejects(() => ops.review('t1', { verdict: 'maybe' }), (error) => error.code === 'usage')
  await board.close()
})

test('review --pass also clears a rework label left by the previous round', async () => {
  const { board, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  await ops.tag('t1', { add: ['review'], remove: ['external'], release: true })
  await ops.review('t1', { verdict: 'rework', note: 'fix the table' })
  // Second round: the worker hands the same card back again.
  await ops.next({ tag: 'external' })
  await ops.tag('t1', { add: ['review'], remove: ['external'], release: true })
  const reviewed = await ops.review('t1', { verdict: 'pass', note: 'fixed' })
  assert.equal(reviewed.task.status, 'done')
  assert.deepEqual(reviewed.tags, [], 'passing ends the rework: both labels go')
  await board.close()
})

test('review refuses a card the worker never released', async () => {
  const { board, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  // Handover without --release: the card is still running and still claimed.
  await ops.tag('t1', { add: ['review'], remove: ['external'] })
  await assert.rejects(
    () => ops.review('t1', { verdict: 'rework', note: 'nope' }),
    (error) => error.code === 'conflict' && /running/u.test(error.message),
  )
  assert.equal(board.snapshot().tasks.find((task) => task.id === 't1').status, 'running')
  await board.close()
})

test('a note too long to keep as a summary is refused before anything moves', async () => {
  const { board, ops } = await setup([{ id: 't1', tags: [{ name: 'external' }] }])
  await ops.next({ tag: 'external' })
  await ops.tag('t1', { add: ['review'], remove: ['external'], release: true })
  const before = board.snapshot().revision
  await assert.rejects(
    () => ops.review('t1', { verdict: 'pass', note: 'x'.repeat(1200) }),
    (error) => error.code === 'usage' && /1000/u.test(error.message),
  )
  const after = board.snapshot().tasks.find((task) => task.id === 't1')
  assert.equal(after.status, 'todo', 'the card is untouched')
  assert.deepEqual(after.tags.map((entry) => entry.name), ['review'], 'and still says it owes a verdict')
  assert.equal(board.snapshot().revision, before)
  await board.close()
})

test('a parent becomes claimable again once its children land', async () => {
  const { board, ops } = await setup([
    { id: 'parent', status: 'todo', tags: [{ name: 'external' }] },
    { id: 'child', status: 'done', parentId: 'parent', tags: [{ name: 'external' }] },
  ])
  const claimed = await ops.next({ tag: 'external' })
  assert.equal(claimed.task.id, 'parent')
  await board.close()
})

test('create publishes a subtask that keeps its parentId', async () => {
  const { board, ops } = await setup([{ id: 'parent', status: 'todo' }])
  const child = await ops.create({ title: 'child', prompt: 'P', parentId: 'parent' })
  assert.equal(child.parentId, 'parent')
  const stored = board.snapshot().tasks.find((task) => task.id === child.id)
  assert.equal(stored.parentId, 'parent')
  assert.equal(stored.status, 'todo')
  await board.close()
})

test('a subtask inherits its parent’s labels, promptPrefix included', async () => {
  const { board, ops } = await setup([
    { id: 'parent', status: 'todo', tags: [{ name: 'external', promptPrefix: 'ctx' }, { name: 'batch' }] },
  ])
  const child = await ops.create({ title: 'child', prompt: 'P', parentId: 'parent', tags: ['batch', 'review'] })
  assert.deepEqual(child.task.tags, [
    { name: 'external', promptPrefix: 'ctx' },
    { name: 'batch' },
    { name: 'review' },
  ])
  assert.deepEqual(child.inheritedTags, ['external', 'batch'])
  // The parent now owns an unfinished child, so the container gate keeps it out
  // of the pool entirely: the child is the first card `next` hands out, and the
  // inherited `ctx` prefix travels with it.
  const claimed = await ops.next({ tag: 'external' })
  assert.equal(claimed.task.id, child.id)
  assert.deepEqual(claimed.hints, ['ctx'])
  await board.close()
})

test('inherited labels count against the tag limit', async () => {
  const parentTags = Array.from({ length: 8 }, (_, index) => ({ name: `p${index}` }))
  const { board, ops } = await setup([{ id: 'parent', status: 'todo', tags: parentTags }])
  await assert.rejects(
    () => ops.create({ title: 'child', prompt: 'P', parentId: 'parent', tags: ['one-more'] }),
    (error) => error.code === 'usage' && error.message.includes('inherited'),
  )
  // Re-adding a label the parent already carries is a no-op, not an overflow.
  const same = await ops.create({ title: 'child', prompt: 'P', parentId: 'parent', tags: ['p0'] })
  assert.equal(same.task.tags.length, 8)
  assert.equal(board.snapshot().tasks.length, 2)
  await board.close()
})

test('create without an identity is a usage error and writes nothing', async () => {
  const board = await startFakeBoard({})
  const ops = createOps({ transport: httpTransport(board.url), stateDir: tempDir(), agentId: '' })
  await assert.rejects(() => ops.create({ title: 'T', prompt: 'P' }), (error) => error.code === 'usage')
  assert.equal(board.snapshot().tasks.length, 0)
  await board.close()
})

test('state refuses a board whose ledgerId changed mid-session', async () => {
  const snapshots = [
    { schemaVersion: 7, revision: 1, tasks: [], scheduler: { ledgerId: 'ledger-one' } },
    { schemaVersion: 7, revision: 2, tasks: [], scheduler: { ledgerId: 'ledger-two' } },
  ]
  let calls = 0
  const ops = createOps({
    transport: {
      url: 'http://127.0.0.1:1',
      getState: async () => snapshots[Math.min(calls++, snapshots.length - 1)],
      apply: async () => snapshots[0],
    },
    stateDir: tempDir(),
    agentId: 'test:agent',
  })
  await ops.state()
  await assert.rejects(() => ops.state(), (error) => error.code === 'board-mismatch')
})
