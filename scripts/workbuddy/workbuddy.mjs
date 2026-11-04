#!/usr/bin/env node
/**
 * WorkBuddy 通道 CLI（官方 CodeBuddy Code headless 模式）。
 *
 * 通道本质：`codebuddy -p` 是一次性、非交互的 agent 运行——和 copilot 通道同构，
 * 只是 prompt 走 **stdin**（Windows 上 shell 会把多行 / `&|^%` 拆坏，见
 * docs/agents/workbuddy-channel.md §7）。
 *
 * 用法（工作目录默认 <repo>/../wt-2，归属见 docs/agents/worktree-parallel.md §3.1）：
 *   node scripts/workbuddy/workbuddy.mjs probe                      # CLI 是否装好、是否已登录
 *   node scripts/workbuddy/workbuddy.mjs run "任务" [--cwd 目录] [--timeout 15] [--json]
 *   node scripts/workbuddy/workbuddy.mjs run --file 任务书.md        # 长任务书走文件，不赌转义
 *   node scripts/workbuddy/workbuddy.mjs login [--port 8099] [--wait 600] [--no-open]
 *
 * run 的产物落在 `.runtime/workbuddy/runs/<runId>/`（.runtime 已被 .gitignore 忽略）：
 * request.json / prompt.md / stdout.log / stderr.log / events.jsonl / result.json。
 * 退出码：0 完成 / 1 失败 / 2 需要人工（未登录）/ 3 CLI 缺失 / 4 超时。
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_TIMEOUT_MS,
  buildRunArgs,
  classifyOutcome,
  createRunId,
  detectAuthRequired,
  parseArgv,
  parseStreamJson,
  resolveCliCommand,
  slugify,
  stripAnsi,
  summarizeRun,
} from './cli.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
/** WorkBuddy 归 wt-2（worktree-parallel.md §3.1）；不是「谁空谁用」 */
const DEFAULT_CWD = resolve(REPO_ROOT, '..', 'wt-2')
const RUNTIME_ROOT = join(REPO_ROOT, '.runtime', 'workbuddy', 'runs')
const MAX_CAPTURE_BYTES = 40 * 1024 * 1024

const [, , commandArg, ...rest] = process.argv
const command = commandArg ?? 'probe'

/** 布尔 flag 显式列出：否则 `run --dry-run "任务"` 会把任务当成 --dry-run 的值吞掉 */
const BOOLEAN_FLAGS = ['dry-run', 'json', 'continue', 'no-skip-permissions', 'allow-git', 'no-open']
const { flags, options, positionals: positional } = parseArgv(rest, BOOLEAN_FLAGS)
const flag = name => flags.has(name)
const option = (name, fallback) => options.get(name) ?? fallback

const cli = resolveCliCommand({ env: process.env, exists: existsSync })

/** 起一个 codebuddy 子进程；Windows 上 `shell: true` 只是为了找到 npm 的 .cmd 壳，杀树必须 taskkill */
function runCli({ args, prompt = null, cwd = DEFAULT_CWD, timeoutMs = DEFAULT_TIMEOUT_MS, env = {} }) {
  return new Promise(resolvePromise => {
    const stdout = []
    const stderr = []
    let captured = 0
    let timedOut = false
    let settled = false
    let child

    try {
      child = spawn(cli.command, [...cli.args, ...args], {
        cwd,
        env: { ...process.env, ...env },
        windowsHide: true,
        shell: cli.shell,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (error) {
      resolvePromise({ exitCode: null, signal: null, stdout: '', stderr: '', timedOut: false, spawnError: error })
      return
    }

    const capture = (sink, chunk) => {
      if (captured >= MAX_CAPTURE_BYTES) return
      captured += chunk.length
      sink.push(chunk)
    }

    const timer = setTimeout(() => {
      timedOut = true
      killTree(child.pid)
    }, timeoutMs)

    const finish = (exitCode, signal, spawnError = null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePromise({
        exitCode,
        signal,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        timedOut,
        spawnError,
      })
    }

    child.stdout?.on('data', chunk => capture(stdout, chunk))
    child.stderr?.on('data', chunk => capture(stderr, chunk))
    child.on('error', error => finish(null, null, error))
    child.on('close', (exitCode, signal) => finish(exitCode, signal))

    if (prompt != null) child.stdin?.end(prompt)
    else child.stdin?.end()
  })
}

function killTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') {
    // shell:true 时 child 是 cmd.exe，真正的 codebuddy 是孙进程，/T 才杀得干净
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    return
  }
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    /* 已经退出 */
  }
}

function writeRunArtifacts(runId, { prompt, args, cwd, timeoutMs, result }) {
  const runDir = join(RUNTIME_ROOT, runId)
  mkdirSync(runDir, { recursive: true })
  writeFileSync(join(runDir, 'prompt.md'), prompt ?? '')
  writeFileSync(
    join(runDir, 'request.json'),
    JSON.stringify(
      { runId, command: cli.display, args, cwd, timeoutMs, startedAt: new Date().toISOString() },
      null,
      2,
    ),
  )
  writeFileSync(join(runDir, 'stdout.log'), result.stdout)
  writeFileSync(join(runDir, 'stderr.log'), result.stderr)
  const parsed = parseStreamJson(result.stdout)
  writeFileSync(
    join(runDir, 'events.jsonl'),
    parsed.events.map(event => JSON.stringify(event)).join('\n') + (parsed.events.length ? '\n' : ''),
  )
  const outcome = classifyOutcome({ ...result, parsed })
  const summary = {
    ...summarizeRun(parsed),
    outcome,
    finishedAt: new Date().toISOString(),
  }
  writeFileSync(join(runDir, 'result.json'), JSON.stringify(summary, null, 2))
  return { runDir, parsed, outcome, summary }
}

async function probe() {
  const version = await runCli({ args: ['--version'], timeoutMs: 30_000 })
  if (version.spawnError || version.exitCode !== 0) {
    const outcome = classifyOutcome(version)
    console.error(`✗ CLI 不可用（${cli.via}：${cli.display}）`)
    console.error(`  ${stripAnsi(version.stderr || version.stdout).trim().split(/\r?\n/)[0] ?? ''}`)
    console.error('  安装：npm install -g @tencent-ai/codebuddy-code')
    process.exitCode = 3
    return
  }

  const cwd = option('cwd', DEFAULT_CWD)
  const quick = await runCli({
    args: buildRunArgs({ outputFormat: 'json' }),
    prompt: '只回复两个字母：OK',
    cwd,
    timeoutMs: 120_000,
  })
  const parsed = parseStreamJson(quick.stdout || quick.stderr)
  const outcome = classifyOutcome({ ...quick, parsed })
  console.log(
    JSON.stringify(
      {
        cli: cli.display,
        via: cli.via,
        version: stripAnsi(version.stdout).trim(),
        cwd,
        // 三态：completed 才算已登录；只有未登录文案能判定 false；其它失败（exit 1）不冒充已登录
        loggedIn: outcome.status === 'completed' ? true : outcome.status === 'need-human-login' ? false : null,
        outcome,
        text: parsed.text,
        sessionId: parsed.result?.sessionId ?? parsed.init?.sessionId ?? null,
      },
      null,
      2,
    ),
  )
  process.exitCode = outcome.exitCode
}

async function run() {
  const fromFile = option('file')
  const text = fromFile ? await readFileText(fromFile) : positional[0]
  if (!text) throw new Error('用法: node scripts/workbuddy/workbuddy.mjs run "任务" [--file 任务书.md] [--timeout 分钟]')

  const cwd = resolve(option('cwd', DEFAULT_CWD))
  if (!existsSync(cwd)) throw new Error(`工作目录不存在: ${cwd}（WorkBuddy 归 wt-2，见 docs/agents/worktree-parallel.md §3.1）`)

  const timeoutMs = Math.max(1, Number(option('timeout', DEFAULT_TIMEOUT_MS / 60_000))) * 60_000
  const args = buildRunArgs({
    outputFormat: option('format', 'stream-json'),
    skipPermissions: !flag('no-skip-permissions'),
    model: option('model'),
    fallbackModel: option('fallback-model'),
    permissionMode: option('permission-mode'),
    maxTurns: option('max-turns') ? Number(option('max-turns')) : undefined,
    appendSystemPrompt: option('append-system-prompt'),
    resumeSessionId: option('resume'),
    continueSession: flag('continue'),
    // 铁律：外部 agent 不提交 git（提交权归主 agent，对齐 copilot 通道）
    disallowedTools: flag('allow-git') ? [] : ['Bash(git:*)'],
  })

  const runId = `${createRunId()}-${slugify(text)}`
  console.error(`[workbuddy] runId=${runId}`)
  console.error(`[workbuddy] cwd=${cwd}`)
  console.error(`[workbuddy] cli=${cli.display}`)

  if (flag('dry-run')) {
    // args 拼上 CLI 自己的入口参数，输出即可直接粘贴执行；prompt 永远走 stdin，不出现在 argv 里
    console.log(
      JSON.stringify(
        { command: cli.command, args: [...cli.args, ...args], promptVia: 'stdin', cwd, timeoutMs, promptBytes: Buffer.byteLength(text) },
        null,
        2,
      ),
    )
    return
  }

  const result = await runCli({ args, prompt: text, cwd, timeoutMs })
  const { runDir, parsed, outcome, summary } = writeRunArtifacts(runId, { prompt: text, args, cwd, timeoutMs, result })

  if (parsed.invalidLines.length > 0) {
    console.error(`[workbuddy] 丢弃 ${parsed.invalidLines.length} 行非 JSON 输出（见 stderr.log）`)
  }
  if (summary.deniedTools.length > 0) {
    console.error(`[workbuddy] 被拒工具: ${[...new Set(summary.deniedTools)].join(', ')}`)
  }
  console.error(`[workbuddy] 改文件 ${summary.fileEdits.length} 处，工具调用 ${summary.toolCalls} 次，turns=${summary.turns ?? '?'}`)
  console.error(`[workbuddy] 记录: ${runDir}`)

  if (flag('json')) {
    console.log(JSON.stringify({ runId, runDir, ...summary }, null, 2))
  } else if (summary.text) {
    console.log(summary.text)
  }

  if (outcome.status === 'need-human-login') {
    console.error('\n✗ 未登录（NEED_HUMAN_LOGIN）：先跑 node scripts/workbuddy/workbuddy.mjs login')
  } else if (outcome.exitCode !== 0) {
    console.error(`\n✗ ${outcome.message}`)
  }
  process.exitCode = outcome.exitCode
}

/** `login`：起 `--serve` 拿 Web UI 地址 → 打开浏览器 → 轮询 `-p` 直到登录成功 → 关掉 serve */
async function login() {
  const port = Number(option('port', 8099))
  const waitSeconds = Number(option('wait', 600))
  const deadline = Date.now() + waitSeconds * 1000

  const child = spawn(cli.command, [...cli.args, '--serve', '--port', String(port)], {
    cwd: DEFAULT_CWD,
    env: process.env,
    windowsHide: true,
    shell: cli.shell,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let webUrl = null
  let buffer = ''
  const onData = chunk => {
    buffer += chunk.toString('utf8')
    const url = buffer.match(/Web UI\s+(https?:\/\/\S+)/)
    if (url && !webUrl) {
      webUrl = url[1]
      console.error(`[workbuddy] Web UI: ${webUrl}`)
      if (!flag('no-open')) openUrl(webUrl)
    }
  }
  child.stdout?.on('data', onData)
  child.stderr?.on('data', onData)

  console.error(`[workbuddy] 已起 HTTP 服务（端口 ${port}），等待人工登录…（${waitSeconds}s 上限）`)
  console.error('[workbuddy] 备选：直接跑 codebuddy 进 TUI，输入 /login')

  let loggedIn = false
  try {
    while (Date.now() < deadline) {
      await sleep(5_000)
      if (child.exitCode !== null) {
        console.error('✗ serve 进程已退出，登录流程中止（端口被占？换 --port）')
        process.exitCode = 1
        return
      }
      const quick = await runCli({ args: buildRunArgs({ outputFormat: 'json' }), prompt: '只回复两个字母：OK', timeoutMs: 120_000 })
      if (!detectAuthRequired(quick.stdout + quick.stderr)) {
        loggedIn = true
        break
      }
      console.error('[workbuddy] 还没登录，继续等…')
    }
  } finally {
    killTree(child.pid)
  }

  if (loggedIn) {
    console.log(JSON.stringify({ ok: true, cli: cli.display, port, webUrl }, null, 2))
    return
  }
  console.error('✗ 等待超时，仍未登录（NEED_HUMAN_LOGIN）')
  process.exitCode = 2
}

function openUrl(url) {
  const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]]
  try {
    const child = spawn(opener[0], opener[1], { windowsHide: true, stdio: 'ignore', detached: true })
    child.unref()
  } catch {
    console.error(`[workbuddy] 打不开浏览器，请手动访问 ${url}`)
  }
}

function sleep(ms) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, ms))
}

async function readFileText(file) {
  const { readFileSync } = await import('node:fs')
  return readFileSync(resolve(file), 'utf8')
}

async function main() {
  if (command === 'probe') return probe()
  if (command === 'run') return run()
  if (command === 'login') return login()
  throw new Error(`未知命令: ${command}（可用：probe / run / login）`)
}

main().catch(error => {
  console.error(`✗ ${String(error?.message ?? error)}`)
  process.exitCode = 1
})
