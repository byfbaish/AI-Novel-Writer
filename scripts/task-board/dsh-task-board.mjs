#!/usr/bin/env node
/**
 * dsh-task-board — pull-model bridge between external agent harnesses and the
 * DSH task board.
 *
 * This shell is intentionally thin: parsing, output shape and exit codes live
 * here; every board decision lives in lib/ops.mjs so the MCP shell shares it.
 */

import process from 'node:process'
import fs from 'node:fs'
import { resolveBoard, stateDirFrom } from './lib/identity.mjs'
import { createOps, parseLeaseDuration } from './lib/ops.mjs'
import { MAX_REWORKS } from './lib/timeline.mjs'
import { BoardError, describeError, exitCodeFor, EXIT } from './lib/errors.mjs'

const HELP = `Usage: dsh-task-board <command> [options]

Commands:
  next                 claim the next task tagged "external" and print it
  create               publish a new card (title/description/prompt are required)
  update <taskId>      rewrite a card's own text (before it has run)
  claim <taskId>       claim a specific task
  heartbeat <taskId>   extend the lease while you work
  done <taskId>        record a succeeded external outcome
  fail <taskId>        record a failed external outcome
  release <taskId>     give a claimed task back to the To Do column
  tag <taskId>         change labels, optionally release the card back to To Do
  review <taskId>      --pass (settle into Done) | --rework --kind unmet|regression --note "<what to change>"
  list                 list tasks (todo by default)
  get <taskId>         print one task in full
  mine                 list this agent's claims
  reap                 recover expired leases and orphaned running cards
  doctor               print the resolved board and identity

Options:
  --url <url>          board URL (else DSH_BOARD_URL / DSH_WEB_URL / cache / discovery)
  --agent <id>         agent identity (else DSH_BOARD_AGENT); required for writes
  --tag <name>         outer tag filter, default "external"
  --add <name>         create/tag: attach this label (repeatable)
  --remove <name>      tag: remove a label (repeatable)
  --release            tag: also move the card back to To Do
  --title <text>       create/update: card title
  --description <text> create/update: card description (create defaults to empty)
  --prompt <text>      create/update: the task text the worker will read
  --prompt-file <path> create/update: read the task text from a file
  --parent <taskId>    create: publish this card as a subtask (inherits its labels)
  --id <taskId>        create: pin the card id (needed when the prompt names it)
  --pass               review: accept the card (clears "review", settles it into Done)
  --rework             review: send it back with "rework" + "external" so it can be claimed again
  --kind <name>        review --rework: unmet (missed its own criteria) | regression (broke what worked)
  --note <text>        review: the verdict that stays on the card (required for --rework)
  --lease <duration>   claim lease, e.g. 60m, 90s, 2h (default 60m)
  --summary <text>     one-line result stored on the execution record (required for done/fail)
  --report <path>      path to the full report inside the task workspace
  --reason <text>      why a claim is released
  --column <name>      list filter: backlog|todo|running|done|failed
  --query <text>       list filter over title/description/prompt
  --json               print one JSON value on stdout
  --dry-run            reap: show the plan without executing it
  --no-auto-reap       next: skip the opportunistic reap
  -h, --help           show this help
`

const BOOLEAN_FLAGS = new Set(['json', 'dry-run', 'no-auto-reap', 'help', 'release', 'pass', 'rework'])
const MULTI_FLAGS = new Set(['add', 'remove'])
const VALUE_FLAGS = new Set(['url', 'agent', 'tag', 'lease', 'summary', 'report', 'reason', 'column', 'query', 'title', 'description', 'prompt', 'prompt-file', 'parent', 'id', 'note', 'kind'])

function parseArgs(argv) {
  const flags = {}
  const positionals = []
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }
    let name = token.slice(2)
    let value
    const equals = name.indexOf('=')
    if (equals !== -1) {
      value = name.slice(equals + 1)
      name = name.slice(0, equals)
    }
    if (BOOLEAN_FLAGS.has(name)) {
      flags[name] = value === undefined ? true : value !== 'false'
      continue
    }
    if (MULTI_FLAGS.has(name)) {
      if (value === undefined) {
        value = argv[index + 1]
        index += 1
        if (value === undefined) throw new BoardError('usage', `--${name} needs a value`)
      }
      flags[name] = [...(flags[name] ?? []), value]
      continue
    }
    if (!VALUE_FLAGS.has(name)) throw new BoardError('usage', `unknown option --${name}`)
    if (value === undefined) {
      value = argv[index + 1]
      index += 1
      if (value === undefined) throw new BoardError('usage', `--${name} needs a value`)
    }
    flags[name] = value
  }
  return { flags, positionals }
}

/** Parse 60m / 90s / 2h / 45 (minutes) into milliseconds. */
function parseLease(value) {
  return parseLeaseDuration(value)
}

function printLines(lines) {
  for (const line of lines) process.stdout.write(`${line}\n`)
}

function renderTask(task) {
  const lines = [`${task.id}  [${task.status}]  ${task.title ?? ''}`]
  if (typeof task.description === 'string' && task.description.trim() !== '') lines.push('', task.description.trim())
  if (typeof task.prompt === 'string' && task.prompt.trim() !== '') lines.push('', '--- prompt ---', task.prompt.trim())
  return lines
}

/** Local clock, minute precision: a card's timestamps are read by a human. */
function when(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const date = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * The four moments one card reports, in the order they happen: created,
 * updated, finished (worker handed it over), closable (review passed).
 * Missing stamps are omitted rather than printed as a dash, so "not yet
 * finished" and "finished at an unknown time" never look the same.
 * `handedBy` is not a moment but is printed here because it is the only record
 * of who produced the card, and review is refused when it matches the reviewer.
 */
function renderTimes(times) {
  if (times === undefined) return []
  const parts = [
    ['created', times.createdAt],
    ['updated', times.updatedAt],
    ['finished', times.finishedAt],
    ['closable', times.closableAt],
  ]
    .map(([label, value]) => [label, when(value)])
    .filter(([, text]) => text !== undefined)
    .map(([label, text]) => `${label} ${text}`)
  if (typeof times.handedBy === 'string' && times.handedBy !== '') parts.push(`handed over by ${times.handedBy}`)
  return parts.length === 0 ? [] : [`times: ${parts.join(' · ')}`]
}

function renderNext(result, tag = 'external') {
  const lines = [`# claimed ${result.task.id}`, ...renderTask(result.task)]
  if (Array.isArray(result.hints) && result.hints.length > 0) {
    lines.push('', '--- tag hints ---', ...result.hints)
  }
  // `done` would now be refused (the card was never handed over), so printing it
  // here would send the worker straight into an error. The handover is the exit.
  //
  // The dispatch label is whatever was claimed with, not always `external`: a
  // batch or channel label left on the card means the next `next --tag <same>`
  // picks this very card up again while it waits for review.
  lines.push('', '# when done, hand it over — do not settle it yourself:')
  lines.push(`#   dsh-task-board tag ${result.task.id} --add review --remove ${tag} --release`)
  return lines
}

function renderList(result) {
  if (result.tasks.length === 0) return ['no tasks matched']
  const lines = [`ledger ${result.ledgerId} · revision ${result.revision}`, '']
  for (const task of result.tasks) {
    const times = result.times?.[task.id]
    const updated = when(times?.updatedAt) ?? ''
    lines.push(`${String(task.status).padEnd(8)} ${task.id.slice(0, 8)}  ${updated.padEnd(16)} ${task.title ?? ''}`)
  }
  return lines
}

function renderReap(result) {
  const lines = [`ledger ${result.ledgerId}${result.dryRun ? ' (dry run)' : ''}`]
  if (result.entries.length === 0) lines.push('nothing to reap')
  for (const entry of result.entries) lines.push(`${entry.action.padEnd(12)} ${entry.taskId}  ${entry.reason}`)
  return lines
}

function renderMine(result) {
  if (result.claims.length === 0) return [`${result.agentId}: no claims`]
  return result.claims.map((claim) => `${claim.taskId}  board=${claim.taskStatus ?? 'missing'}  lease-until=${new Date(claim.leaseUntil).toISOString()}`)
}

function renderDoctor(result) {
  return Object.entries(result)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`)
}

async function main(argv) {
  const { flags, positionals } = parseArgs(argv)
  if (flags.help === true || positionals.length === 0) {
    process.stdout.write(HELP)
    return flags.help === true ? EXIT.OK : EXIT.USAGE
  }
  const command = positionals[0]
  const taskId = positionals[1]

  if (!['doctor', 'list', 'next', 'mine', 'reap', 'create'].includes(command) && (taskId === undefined || taskId === '')) {
    throw new BoardError('usage', `${command} needs a <taskId>`)
  }

  const env = process.env
  const agentId = typeof flags.agent === 'string' ? flags.agent : (env.DSH_BOARD_AGENT ?? '')
  const stateDir = stateDirFrom(env)
  const { transport, ledgerId } = await resolveBoard({ explicitUrl: flags.url, stateDir, env })
  const ops = createOps({
    transport,
    stateDir,
    agentId,
    leaseMs: parseLease(flags.lease),
    expectedLedgerId: ledgerId,
  })

  let payload
  switch (command) {
    case 'doctor':
      payload = await ops.doctor()
      break
    case 'list':
      payload = await ops.list({ column: flags.column, tag: flags.tag, query: flags.query })
      break
    case 'get':
      payload = await ops.get(taskId)
      break
    case 'create': {
      if (typeof flags.prompt === 'string' && typeof flags['prompt-file'] === 'string') {
        throw new BoardError('usage', 'use either --prompt or --prompt-file, not both')
      }
      let prompt = flags.prompt
      if (typeof flags['prompt-file'] === 'string') {
        try {
          prompt = fs.readFileSync(flags['prompt-file'], 'utf8')
        } catch (error) {
          throw new BoardError('usage', `cannot read --prompt-file ${flags['prompt-file']}: ${error.message}`)
        }
      }
      payload = await ops.create({
        title: flags.title,
        description: flags.description,
        prompt,
        tags: flags.add ?? [],
        parentId: flags.parent,
        id: flags.id,
      })
      break
    }
    case 'update': {
      if (typeof flags.prompt === 'string' && typeof flags['prompt-file'] === 'string') {
        throw new BoardError('usage', 'use either --prompt or --prompt-file, not both')
      }
      let prompt = flags.prompt
      if (typeof flags['prompt-file'] === 'string') {
        try {
          prompt = fs.readFileSync(flags['prompt-file'], 'utf8')
        } catch (error) {
          throw new BoardError('usage', `cannot read --prompt-file ${flags['prompt-file']}: ${error.message}`)
        }
      }
      payload = await ops.update(taskId, {
        title: flags.title,
        description: flags.description,
        prompt,
      })
      break
    }
    case 'next':
      payload = await ops.next({
        tag: typeof flags.tag === 'string' ? flags.tag : 'external',
        lease: parseLease(flags.lease),
        autoReap: flags['no-auto-reap'] !== true,
      })
      break
    case 'claim':
      payload = await ops.claim(taskId, { lease: parseLease(flags.lease) })
      break
    case 'heartbeat':
      payload = await ops.heartbeat(taskId, { lease: parseLease(flags.lease) })
      break
    case 'done':
      payload = await ops.done(taskId, { summary: flags.summary, report: flags.report })
      break
    case 'fail':
      payload = await ops.fail(taskId, { summary: flags.summary, report: flags.report })
      break
    case 'release':
      payload = await ops.release(taskId, { reason: flags.reason })
      break
    case 'tag':
      payload = await ops.tag(taskId, {
        add: flags.add ?? [],
        remove: flags.remove ?? [],
        release: flags.release === true,
      })
      break
    case 'review': {
      const pass = flags.pass === true
      const rework = flags.rework === true
      if (pass === rework) throw new BoardError('usage', 'review needs exactly one of --pass or --rework')
      payload = await ops.review(taskId, { verdict: pass ? 'pass' : 'rework', note: flags.note, kind: flags.kind })
      break
    }
    case 'mine':
      payload = await ops.mine()
      break
    case 'reap':
      payload = await ops.reap({ dryRun: flags['dry-run'] === true })
      break
    default:
      throw new BoardError('usage', `unknown command ${command}`)
  }

  if (flags.json === true) {
    process.stdout.write(`${JSON.stringify(payload)}\n`)
    return EXIT.OK
  }
  switch (command) {
    case 'list':
      printLines(renderList(payload))
      break
    case 'create': {
      const lines = [`created ${payload.task.id}  [${payload.task.status ?? 'todo'}]  ${payload.task.title ?? ''}`]
      const names = (payload.task.tags ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.name))
      if (names.length > 0) lines.push(`tags: ${names.join(', ')}`)
      if (payload.parentId !== undefined) lines.push(`parent: ${payload.parentId}`)
      if (Array.isArray(payload.inheritedTags) && payload.inheritedTags.length > 0) {
        lines.push(`inherited: ${payload.inheritedTags.join(', ')}`)
      }
      lines.push(...renderTimes(payload.times))
      printLines(lines)
      break
    }
    case 'update': {
      if (payload.changed === false) {
        printLines([`unchanged ${payload.task.id}: the given fields already hold those values`])
        break
      }
      printLines([`updated ${payload.task.id}: ${payload.changedFields.join(', ')}`, ...renderTimes(payload.times)])
      break
    }
    case 'get':
      printLines([...renderTask(payload.task), '', ...renderTimes(payload.times)])
      break
    case 'next':
    case 'claim':
      printLines(renderNext(payload, typeof flags.tag === 'string' ? flags.tag : 'external'))
      break
    case 'heartbeat':
      printLines([`renewed lease for ${payload.task.id} until ${new Date(payload.claim.leaseUntil).toISOString()}`])
      break
    case 'done':
    case 'fail':
      printLines([`recorded ${payload.task.status} for ${payload.task.id}`, ...renderTimes(payload.times)])
      break
    case 'release':
      printLines([`released ${payload.taskId}`])
      break
    case 'tag': {
      const names = payload.tags.map((entry) => (typeof entry === 'string' ? entry : entry.name))
      const suffix = `${payload.released ? ' (released to To Do)' : ''}${payload.changed ? '' : ' (unchanged)'}`
      printLines([
        `tagged ${payload.task.id}: ${names.length === 0 ? '(no tags)' : names.join(', ')}${suffix}`,
        ...renderTimes(payload.times),
      ])
      break
    }
    case 'review': {
      const names = (payload.tags ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.name))
      const lines = payload.verdict === 'pass'
        ? [`reviewed ${payload.task.id}: pass — settled into Done`]
        : [
            `reviewed ${payload.task.id}: rework (${payload.kind}, round ${payload.reviews.reworks}/${MAX_REWORKS}) — back in the pool as [${names.join(', ')}]`,
          ]
      if (typeof payload.note === 'string' && payload.note !== '') lines.push(`note: ${payload.note}`)
      if (payload.verdict === 'rework' && payload.reviews.reworks >= MAX_REWORKS) {
        lines.push(`# this is the last bounce: the next review can only pass. Anything else still wrong is a new card.`)
      }
      printLines([...lines, ...renderTimes(payload.times)])
      break
    }
    case 'reap':
      printLines(renderReap(payload))
      break
    case 'mine':
      printLines(renderMine(payload))
      break
    case 'doctor':
      printLines(renderDoctor(payload))
      break
    default:
      process.stdout.write(`${JSON.stringify(payload)}\n`)
  }
  return EXIT.OK
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code
  })
  .catch((error) => {
    process.stderr.write(`dsh-task-board: ${describeError(error)}\n`)
    process.exitCode = exitCodeFor(error)
  })
