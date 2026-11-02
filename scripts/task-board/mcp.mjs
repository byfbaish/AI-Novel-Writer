#!/usr/bin/env node
/**
 * MCP stdio shell for dsh-task-board.
 *
 * Newline-delimited JSON-RPC on stdin/stdout, zero dependencies. Every board
 * decision is delegated to the same op core the CLI uses, so the two shells can
 * never disagree. stdout carries protocol frames only; anything diagnostic
 * belongs on stderr.
 */

import readline from 'node:readline'
import process from 'node:process'
import { resolveBoard, stateDirFrom } from './lib/identity.mjs'
import { createOps } from './lib/ops.mjs'
import { BoardError, describeError } from './lib/errors.mjs'

const SERVER_INFO = { name: 'dsh-task-board', version: '0.1.0' }
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

const TOOLS = [
  {
    name: 'task_board_list',
    description: 'List task-board cards (To Do by default). Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        column: { type: 'string', description: 'backlog|todo|running|done|failed' },
        tag: { type: 'string', description: 'only cards carrying this tag name' },
        query: { type: 'string', description: 'case-insensitive match over title/description/prompt' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_get',
    description: 'Read one card in full, including its execution history.',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_create',
    description: 'Publish a new card into To Do. title, description and prompt are all required by the board. Pass parentId to publish a subtask: it inherits the parent\'s tags (which is how a child of an external-tagged card itself becomes dispatchable). Pass id when the prompt must name the card id itself (report path, retry hint). Add tags (for example ["external"]) or the pull-model CLI will never hand it to an external agent.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string', description: 'defaults to an empty string; the board requires the field to be a string' },
        prompt: { type: 'string', description: 'the task text a worker reads; must be self-contained' },
        tags: { type: 'array', items: { type: 'string' }, description: 'label names to attach, e.g. ["external"]' },
        parentId: { type: 'string', description: 'publish as a subtask of this card' },
        id: { type: 'string', description: 'pin the card id instead of letting the CLI mint one' },
      },
      required: ['title', 'prompt'],
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_update',
    description: 'Rewrite a card\'s own text (title / description / prompt). The board freezes a card\'s text once it has any execution record — use this only on cards that have not run. A patch that changes nothing is not sent, so updatedAt does not move for a no-op.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        prompt: { type: 'string', description: 'the task text a worker reads; rewriting it does not re-tag or re-schedule anything' },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_next',
    description: 'Claim the next card tagged external (oldest first) and return its prompt. Call this before doing any work. Returns {claimed:false} when there is nothing to do.',
    inputSchema: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'claim tag name, default "external"' },
        lease: { type: 'string', description: 'lease duration such as 60m (default) or 2h' },
        autoReap: { type: 'boolean', description: 'recover expired leases first (default true)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_claim',
    description: 'Claim one specific card you already know the id of.',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' }, lease: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_heartbeat',
    description: 'Extend the lease while you work. Fails (isError) if the card left running or the Host took it over — then stop working and yield.',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' }, lease: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_done',
    description: 'Record a succeeded outcome for the claimed card and release it. The summary is one line; pass the full report path in --report.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        summary: { type: 'string', description: 'one-line result, at most 1000 characters' },
        report: { type: 'string', description: 'path to the full report inside the task workspace' },
      },
      required: ['taskId', 'summary'],
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_fail',
    description: 'Record a failed outcome for the claimed card and release it.',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' }, summary: { type: 'string' }, report: { type: 'string' } },
      required: ['taskId', 'summary'],
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_release',
    description: 'Give a claimed card back to To Do without claiming an outcome.',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' }, reason: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_tag',
    description: 'Change a card\'s labels and optionally release it back to To Do without recording an outcome. A worker that finished uses this to swap "external" for "review" (the handover). It does not decide the card.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        add: { type: 'array', items: { type: 'string' }, description: 'label names to add' },
        remove: { type: 'array', items: { type: 'string' }, description: 'label names to remove' },
        release: { type: 'boolean', description: 'also move the card back to To Do and clear the local claim' },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_review',
    description: 'Decide a card that a worker handed back (it must carry the "review" label). verdict "pass" clears the label and settles the card into Done; verdict "rework" clears the label, adds "rework" and "external" so the card is claimable again, and requires a note saying what to change. Either verdict is kept on the card as the review record.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        verdict: { type: 'string', enum: ['pass', 'rework'] },
        note: { type: 'string', description: 'required for rework: what the worker must change' },
      },
      required: ['taskId', 'verdict'],
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_mine',
    description: 'List the claims owned by this agent.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'task_board_reap',
    description: 'Recover expired leases and orphaned running cards. Idempotent; never touches a card the Host is running.',
    inputSchema: {
      type: 'object',
      properties: { dryRun: { type: 'boolean' } },
      additionalProperties: false,
    },
  },
  {
    name: 'task_board_doctor',
    description: 'Report the resolved board URL, ledger id, schema and agent identity.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
]

let contextPromise = undefined

async function context() {
  if (contextPromise !== undefined) return contextPromise
  const env = process.env
  const stateDir = stateDirFrom(env)
  const promise = (async () => {
    const { transport, ledgerId } = await resolveBoard({ stateDir, env })
    return createOps({ transport, stateDir, agentId: env.DSH_BOARD_AGENT ?? '', expectedLedgerId: ledgerId })
  })()
  contextPromise = promise
  try {
    return await promise
  } catch (error) {
    contextPromise = undefined
    throw error
  }
}

const READ_ONLY_TOOLS = new Set(['task_board_list', 'task_board_get', 'task_board_mine', 'task_board_doctor'])
const RECOVERABLE_CODES = new Set(['unreachable', 'not-mounted', 'board-mismatch'])

/**
 * Call one tool, recovering once from a board that moved under us.
 *
 * DSH Desktop picks a new port on every launch, and a long-lived MCP server
 * therefore has to drop its memoized transport rather than fail every call for
 * the rest of the session. Writes are not silently replayed (the previous
 * action may already have applied); they ask the agent to re-run after doctor.
 */
async function callTool(name, args) {
  try {
    return await callToolOnce(name, args)
  } catch (error) {
    if (!(error instanceof BoardError) || !RECOVERABLE_CODES.has(error.code)) throw error
    contextPromise = undefined
    if (!READ_ONLY_TOOLS.has(name)) {
      throw new BoardError(
        error.code,
        `${error.message} — the board connection was reset (DSH may have restarted); run task_board_doctor, then re-run this tool (the previous action may or may not have been applied)`,
      )
    }
    return callToolOnce(name, args)
  }
}

async function callToolOnce(name, args) {
  const ops = await context()
  switch (name) {
    case 'task_board_list':
      return ops.list({ column: args.column, tag: args.tag, query: args.query })
    case 'task_board_get':
      return ops.get(args.taskId)
    case 'task_board_create':
      return ops.create({
        title: args.title,
        description: args.description,
        prompt: args.prompt,
        tags: args.tags ?? [],
        parentId: args.parentId,
        id: args.id,
      })
    case 'task_board_update':
      return ops.update(args.taskId, { title: args.title, description: args.description, prompt: args.prompt })
    case 'task_board_next':
      try {
        return await ops.next({ tag: args.tag ?? 'external', lease: args.lease, autoReap: args.autoReap !== false })
      } catch (error) {
        if (error instanceof BoardError && error.code === 'no-candidate') return { claimed: false }
        throw error
      }
    case 'task_board_claim':
      return ops.claim(args.taskId, { lease: args.lease })
    case 'task_board_heartbeat':
      return ops.heartbeat(args.taskId, { lease: args.lease })
    case 'task_board_done':
      return ops.done(args.taskId, { summary: args.summary, report: args.report })
    case 'task_board_fail':
      return ops.fail(args.taskId, { summary: args.summary, report: args.report })
    case 'task_board_release':
      return ops.release(args.taskId, { reason: args.reason })
    case 'task_board_tag':
      return ops.tag(args.taskId, { add: args.add ?? [], remove: args.remove ?? [], release: args.release === true })
    case 'task_board_review':
      return ops.review(args.taskId, { verdict: args.verdict, note: args.note })
    case 'task_board_mine':
      return ops.mine()
    case 'task_board_reap':
      return ops.reap({ dryRun: args.dryRun === true })
    case 'task_board_doctor':
      return ops.doctor()
    default:
      throw new BoardError('usage', `unknown tool ${name}`)
  }
}

function send(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

function sendResult(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

function negotiateVersion(requested) {
  if (typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) return requested
  return SUPPORTED_PROTOCOL_VERSIONS[0]
}

async function handle(message) {
  if (message === null || typeof message !== 'object' || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    sendError(message?.id ?? null, -32600, 'invalid request')
    return
  }
  const id = message.id
  switch (message.method) {
    case 'initialize':
      if (id === undefined) return
      sendResult(id, {
        protocolVersion: negotiateVersion(message.params?.protocolVersion),
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      })
      return
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return
    case 'ping':
      if (id === undefined) return
      sendResult(id, {})
      return
    case 'tools/list':
      if (id === undefined) return
      sendResult(id, { tools: TOOLS })
      return
    case 'tools/call': {
      if (id === undefined) return
      const name = message.params?.name
      const args = message.params?.arguments ?? {}
      if (typeof name !== 'string' || name === '') {
        sendError(id, -32602, 'tools/call needs a tool name')
        return
      }
      try {
        const payload = await callTool(name, args)
        sendResult(id, { content: [{ type: 'text', text: JSON.stringify(payload) }] })
      } catch (error) {
        sendResult(id, { content: [{ type: 'text', text: describeError(error) }], isError: true })
      }
      return
    }
    default:
      if (id !== undefined) sendError(id, -32601, `unknown method ${message.method}`)
  }
}

const reader = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
reader.on('line', (line) => {
  const trimmed = line.trim()
  if (trimmed === '') return
  let message
  try {
    message = JSON.parse(trimmed)
  } catch {
    sendError(null, -32700, 'parse error')
    return
  }
  handle(message).catch((error) => {
    process.stderr.write(`dsh-task-board-mcp: ${describeError(error)}\n`)
    if (message?.id !== undefined) sendError(message.id, -32603, describeError(error))
  })
})
