#!/usr/bin/env node
/**
 * WorkBuddy 通道的纯函数层（零依赖、可单测）。
 *
 * 通道 = 官方 CodeBuddy Code CLI（npm `@tencent-ai/codebuddy-code`）的 headless 模式。
 * 这里只放「不起进程」的逻辑：定位 CLI、拼参数、解析 `--output-format stream-json`、
 * 判定认证/超时/权限失败。真正 spawn 的地方在 `workbuddy.mjs`，`__tests__/cli.test.mjs`
 * 只测本文件。
 *
 * 为什么参数要按「固定 flag + stdin 传 prompt」：Windows 上 `spawn(shell: true)` 只为
 * 找到 npm 的 `codebuddy.cmd` 外壳，shell 会把参数原样拼进命令行——prompt 里的换行、
 * `&`、`|`、`%` 会被 cmd.exe 解释（社区项目 workbuddy-mcp 的实测结论，见
 * docs/agents/workbuddy-channel.md §7）。stdin 传输对长度与特殊字符免疫。
 */

import path from 'node:path'
import process from 'node:process'

/** `-p` 在未登录时的原样输出（2026-11-05，CLI 2.179.3 实测） */
const AUTH_REQUIRED_PATTERNS = [
  /Authentication required/i,
  /Please use \/login/i,
  /sign in to your account/i,
]

/** CLI 里那些「改文件」的工具名 → 副作用类型（对齐 copilot 通道的 fileEdits 取数口径） */
const FILE_EDIT_TOOLS = new Map([
  ['Write', 'create'],
  ['Edit', 'edit'],
  ['MultiEdit', 'edit'],
  ['NotebookEdit', 'edit'],
  ['apply_patch', 'patch'],
])

export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000

/** 去掉 ANSI 颜色/光标序列（CLI 的 TUI 字样可能混进 stderr） */
export function stripAnsi(input) {
  return String(input ?? '')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
}

/**
 * CLI 参数切分：`--flag` 是布尔，`--name value` 成对，其余是位置参数。
 *
 * 早些时候的写法是「上一个参数不是 `--` 开头就算位置参数」——`run --dry-run "任务"`
 * 会把任务吞掉（2026-11-05 实测踩过）。这里显式声明布尔 flag，值不会被误判。
 */
export function parseArgv(argv = [], booleanFlags = []) {
  const flags = new Set()
  const options = new Map()
  const positionals = []
  const booleans = new Set(booleanFlags)
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index])
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }
    const name = token.slice(2)
    const next = argv[index + 1]
    if (booleans.has(name) || next === undefined || String(next).startsWith('--')) {
      flags.add(name)
    } else {
      options.set(name, String(next))
      index += 1
    }
  }
  return { flags, options, positionals }
}

/** 未登录时 CLI 的退出码仍是 0，只能靠文案判定——`probe` 与 `run` 共用这一条 */
export function detectAuthRequired(raw) {
  const text = stripAnsi(raw)
  return AUTH_REQUIRED_PATTERNS.some(pattern => pattern.test(text))
}

/** 运行目录名：`20261105-001234-<随机>`，便于排序且不会撞名 */
export function createRunId(now = new Date(), random = Math.random) {
  const pad = value => String(value).padStart(2, '0')
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('')
  const suffix = Math.floor(random() * 0x10000).toString(16).padStart(4, '0')
  return `${stamp}-${suffix}`
}

/** 任务名 slug（只用于人读的目录/报告标题，不进路径关键部分） */
export function slugify(text, maxLength = 40) {
  const slug = String(text ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^0-9A-Za-z\u4e00-\u9fff_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength)
  return slug || 'task'
}

/**
 * 定位 codebuddy 可执行文件。
 *
 * npm 全局安装后的 `bin/codebuddy` 是无扩展名的 Node 脚本（不是 .exe/.cmd），
 * 必须用 node 当解释器；直接 `spawn('codebuddy')` 在 Git Bash 里会踩坏掉的
 * npm shim（`node_modules/node/bin/node: This: command not found`）。因此：
 *   1. `WORKBUDDY_CLI` / `WB_COMMAND` 环境变量优先（可指到 .js，也可指到 .exe）；
 *   2. 否则在 npm 全局目录里找 `@tencent-ai/codebuddy-code/bin/codebuddy`；
 *   3. 再退回 PATH 上的 `codebuddy`（Windows 需 shell:true）。
 */
export function resolveCliCommand({
  env = {},
  exists = () => false,
  platform = process.platform,
  execPath = process.execPath,
} = {}) {
  const override = String(env.WORKBUDDY_CLI || env.WB_COMMAND || '').trim()
  if (override) {
    const isNodeScript = /\.(?:js|mjs|cjs)$/i.test(override) || /[\\/]bin[\\/]codebuddy$/i.test(override)
    return {
      command: isNodeScript ? execPath : override,
      args: isNodeScript ? [override] : [],
      display: override,
      via: 'env',
      shell: !isNodeScript && platform === 'win32',
    }
  }

  const packageBin = ['@tencent-ai', 'codebuddy-code', 'bin', 'codebuddy']
  const candidates = []
  const home = env.USERPROFILE || env.HOME || ''
  if (platform === 'win32') {
    if (env.APPDATA) candidates.push(path.join(env.APPDATA, 'npm', 'node_modules', ...packageBin))
    if (env.LOCALAPPDATA) candidates.push(path.join(env.LOCALAPPDATA, 'npm', 'node_modules', ...packageBin))
    if (home) candidates.push(path.join(home, 'AppData', 'Roaming', 'npm', 'node_modules', ...packageBin))
  } else {
    if (env.NPM_CONFIG_PREFIX) candidates.push(path.join(env.NPM_CONFIG_PREFIX, 'lib', 'node_modules', ...packageBin))
    if (home) {
      candidates.push(path.join(home, '.npm-global', 'lib', 'node_modules', ...packageBin))
      candidates.push(path.join(home, '.local', 'lib', 'node_modules', ...packageBin))
    }
    candidates.push(path.join('/usr/local/lib/node_modules', ...packageBin))
    candidates.push(path.join('/usr/lib/node_modules', ...packageBin))
  }

  const hit = candidates.find(candidate => exists(candidate))
  if (hit) {
    return { command: execPath, args: [hit], display: hit, via: 'npm-global', shell: false }
  }

  return { command: 'codebuddy', args: [], display: 'codebuddy', via: 'path', shell: platform === 'win32' }
}

/**
 * 拼 `-p` 调用参数。**prompt 不在参数里**（走 stdin，见文件头）。
 *
 * @returns {string[]}
 */
export function buildRunArgs({
  outputFormat = 'stream-json',
  skipPermissions = true,
  model,
  fallbackModel,
  permissionMode,
  allowedTools = [],
  disallowedTools = [],
  appendSystemPrompt,
  maxTurns,
  resumeSessionId,
  continueSession = false,
  extraArgs = [],
} = {}) {
  const args = ['-p']
  if (skipPermissions) args.push('--dangerously-skip-permissions')
  if (permissionMode) args.push('--permission-mode', permissionMode)
  if (outputFormat) args.push('--output-format', outputFormat)
  if (model) args.push('--model', model)
  if (fallbackModel) args.push('--fallback-model', fallbackModel)
  if (maxTurns) args.push('--max-turns', String(maxTurns))
  if (appendSystemPrompt) args.push('--append-system-prompt', appendSystemPrompt)
  if (allowedTools.length > 0) args.push('--allowedTools', ...allowedTools)
  if (disallowedTools.length > 0) args.push('--disallowedTools', ...disallowedTools)
  if (resumeSessionId) args.push('--resume', resumeSessionId)
  else if (continueSession) args.push('--continue')
  args.push(...extraArgs)
  return args
}

/** 单条 tool_use 若改文件，折算成可校验副作用（不用信 agent 自述） */
export function describeFileEdit(toolCall) {
  const kind = FILE_EDIT_TOOLS.get(toolCall?.name)
  if (!kind) return null
  const input = toolCall.input ?? {}
  const filePath = input.file_path ?? input.path ?? input.notebook_path ?? input.target_file ?? null
  if (!filePath) return null
  return { tool: toolCall.name, kind, path: String(filePath) }
}

function stringifyToolOutput(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part === 'string' ? part : part?.text ?? (part ? JSON.stringify(part) : '')))
      .join('\n')
  }
  return content == null ? '' : JSON.stringify(content)
}

/**
 * 解析 `--output-format stream-json`（每行一个 JSON）或 `json`（单个结果对象）。
 * 容错：非 JSON 行收集到 invalidLines，不中断。
 */
export function parseStreamJson(raw) {
  const text = stripAnsi(raw)
  const events = []
  const invalidLines = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (!trimmed.startsWith('{')) {
      invalidLines.push(trimmed)
      continue
    }
    try {
      events.push(JSON.parse(trimmed))
    } catch {
      invalidLines.push(trimmed)
    }
  }

  const toolCalls = []
  const fileEdits = []
  const deniedTools = []
  let init = null
  let lastText = ''
  let result = null

  for (const event of events) {
    if (!event || typeof event !== 'object') continue

    if (event.type === 'system' && event.subtype === 'init') {
      init = {
        sessionId: event.session_id ?? event.sessionId ?? null,
        model: event.model ?? null,
        cwd: event.cwd ?? null,
        tools: Array.isArray(event.tools) ? event.tools : [],
      }
    }

    if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
      for (const block of event.message.content) {
        if (!block || typeof block !== 'object') continue
        if (block.type === 'text' && typeof block.text === 'string') lastText = block.text
        if (block.type === 'tool_use') {
          const call = { id: block.id ?? null, name: block.name ?? 'unknown', input: block.input ?? {} }
          toolCalls.push(call)
          const edit = describeFileEdit(call)
          if (edit) fileEdits.push(edit)
        }
      }
    }

    if (event.type === 'user' && Array.isArray(event.message?.content)) {
      for (const block of event.message.content) {
        if (!block || block.type !== 'tool_result') continue
        const call = toolCalls.find(item => item.id && item.id === block.tool_use_id)
        if (!call) continue
        call.ok = block.is_error !== true
        call.output = stringifyToolOutput(block.content).slice(0, 4000)
        if (call.ok === false && /permission|denied|not allowed|被拒绝/i.test(call.output)) {
          deniedTools.push(call.name)
        }
      }
    }

    if (event.type === 'result') {
      const isError = event.is_error === true || (typeof event.subtype === 'string' && event.subtype !== 'success')
      result = {
        subtype: event.subtype ?? null,
        isError,
        text: typeof event.result === 'string' ? event.result : '',
        sessionId: event.session_id ?? null,
        turns: event.num_turns ?? null,
        durationMs: event.duration_ms ?? null,
        costUsd: event.total_cost_usd ?? null,
        usage: event.usage ?? null,
      }
    }
  }

  return {
    events,
    invalidLines,
    init,
    toolCalls,
    fileEdits,
    deniedTools,
    text: result?.text || lastText,
    result,
    authRequired: detectAuthRequired(text),
    rawLength: text.length,
  }
}

/**
 * 把一次调用的结局折算成退出码 + 一句话。
 *
 * 退出码约定与豆包通道对齐：0 成功 / 1 失败 / 2 需要人工（未登录） / 4 超时。
 */
export function classifyOutcome({ exitCode = 0, signal = null, timedOut = false, parsed, spawnError = null } = {}) {
  if (spawnError) {
    return { exitCode: 3, status: 'cli-missing', message: `无法启动 codebuddy：${spawnError.message ?? spawnError}` }
  }
  if (timedOut) {
    return { exitCode: 4, status: 'timeout', message: '超过超时上限被终止（长任务用 --timeout 调大或拆小）' }
  }
  if (parsed?.authRequired) {
    return {
      exitCode: 2,
      status: 'need-human-login',
      message: 'codebuddy 未登录（NEED_HUMAN_LOGIN）：运行 node scripts/workbuddy/workbuddy.mjs login 或在 TUI 里 /login',
    }
  }
  if (exitCode !== 0) {
    return {
      exitCode: 1,
      status: 'failed',
      message: `codebuddy 退出码 ${exitCode}${signal ? `（signal ${signal}）` : ''}`,
    }
  }
  if (parsed?.result?.isError) {
    return {
      exitCode: 1,
      status: 'failed',
      message: `任务失败（subtype=${parsed.result.subtype ?? 'unknown'}）`,
    }
  }
  return { exitCode: 0, status: 'completed', message: '完成' }
}

/** 供 `probe` 打印的紧凑摘要 */
export function summarizeRun(parsed) {
  return {
    text: parsed.text,
    sessionId: parsed.result?.sessionId ?? parsed.init?.sessionId ?? null,
    model: parsed.init?.model ?? null,
    turns: parsed.result?.turns ?? null,
    durationMs: parsed.result?.durationMs ?? null,
    costUsd: parsed.result?.costUsd ?? null,
    toolCalls: parsed.toolCalls.length,
    toolNames: [...new Set(parsed.toolCalls.map(call => call.name))],
    fileEdits: parsed.fileEdits,
    deniedTools: parsed.deniedTools,
  }
}
