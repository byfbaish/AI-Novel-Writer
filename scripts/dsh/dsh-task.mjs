#!/usr/bin/env node
/**
 * DSH 通道 CLI —— 把活派给本机 DeepSeek Harness（固定 wt-3）。
 *
 * 形态只有一条：**一次性 headless 任务**
 *
 *   node <dsh>/lib/bin.js --profile headless --patch <model.patch.yml> "<task>"
 *
 * 选这条路的三个理由（2026-11-08 实测）：
 *   1. `--profile headless` 天然是「答一次、打印、退出」，退出即交活；
 *   2. 它的工作目录就是 `process.cwd()`（源码无 --cwd 参数）⇒ 从 wt-3 起就落在 wt-3，
 *      归属靠 spawn 的 cwd 钉死，不靠调用者记得切目录；
 *   3. 默认模型与通道要求不一致（profile 写的是 deepseek-flash），
 *      但 `--patch` 能在 profile 层之后追加一份临时覆盖 ⇒ 不改任何 profile 配置
 *      就能把模型钉死。这是本通道唯一的模型锁定手段（headless 没有 --model）。
 *
 * ⛔ 红线（脚本与文档同源，改一处必改另一处）：
 *   - 工作目录固定 wt-3；`--cwd` 指到别处 exit 3，只有 `--force` 能越过且在报告里写明。
 *   - 不在错模型上派活：派活前 `--dump-config` 读回 model，不一致直接 exit 1。
 *   - 不提交 git、不推送、不改全局配置（`~/.dsh/profiles/*`、`config.json`、`models.json`）。
 *   - 只准单元测试；禁全量 / `pnpm test:node` / browser（见 docs/agents/worktree-parallel.md §7）。
 *
 * 零依赖 ESM，Node >= 20。与 scripts/task-board/* 同一风格。
 */
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractMarkers } from '../doubao/markers.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')

/** 本通道唯一允许的工作目录（worktree-parallel.md §3.1：wt-3 归 DSH）。 */
export const PINNED_CWD = 'C:\\develop\\workspace\\AI-writer\\wt-3'

/** 作者 2026-11-08 指定的默认模型（见 ~/.dsh/bot/state.json 的 bots[*].model）。 */
export const EXPECTED_PROVIDER = 'magpie'
export const EXPECTED_MODEL = 'our-free-model/our-free-model/nvidia/nemotron-3.5-lightning:free'
export const EXPECTED_NAME = 'Kilo Nemotron 3.5 Lightning · Our Free Model'

/** 槽位端口（worktree-parallel.md §3）——只用于 status 的占用探测。 */
const RENDERER_PORT = 5183
const CDP_PORT = 9225

const PATCH_FILE = join(HERE, 'model.patch.yml')
const RUNTIME_DIR = join(REPO, '.runtime', 'dsh')

// --- 小工具 ---------------------------------------------------------------

const EXIT = { ok: 0, fail: 1, notReady: 2, refuse: 3, timeout: 4, usage: 5 }

const die = (code, message) => {
  process.stderr.write(`${message}\n`)
  process.exit(code)
}

const sh = (cmd, args, opts = {}) => new Promise(settle => {
  const child = spawn(cmd, args, { ...opts, windowsHide: true })
  let stdout = ''
  let stderr = ''
  child.stdout?.on('data', chunk => { stdout += chunk.toString('utf8') })
  child.stderr?.on('data', chunk => { stderr += chunk.toString('utf8') })
  child.on('error', error => settle({ code: -1, stdout, stderr: `${stderr}${error.message}` }))
  child.on('close', code => settle({ code, stdout, stderr }))
})

/** Windows 控制台里 DSH 会带 ANSI 色码，落盘保留原文、屏显前剥掉。 */
const stripAnsi = text => String(text).replace(/\u001b\[[0-9;]*m/gu, '')

// --- 环境发现 -------------------------------------------------------------

/** DSH 的 lib/bin.js：优先 `DSH_BIN`，否则按 npm 全局安装位置解析。 */
export const dshBin = () => {
  if (process.env.DSH_BIN) return process.env.DSH_BIN
  const appData = process.env.APPDATA
  if (!appData) return ''
  return join(appData, 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

const dshVersion = async () => {
  const pkg = join(dirname(dshBin()), '..', 'package.json')
  try {
    return JSON.parse(await readFile(pkg, 'utf8')).version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

const portBusy = port => new Promise(settle => {
  const socket = createConnection({ host: '127.0.0.1', port })
  const done = busy => { socket.destroy(); settle(busy) }
  socket.setTimeout(600)
  socket.once('connect', () => done(true))
  socket.once('timeout', () => done(false))
  socket.once('error', () => done(false))
})

// --- 归属与模型校验 -------------------------------------------------------

/** wt-3 的存在性、worktree 身份、分支。缺失即「未就绪」。 */
export const checkPinnedWorktree = async () => {
  if (!existsSync(PINNED_CWD)) return { ok: false, reason: `wt-3 不存在：${PINNED_CWD}` }
  const branch = await sh('git', ['-C', PINNED_CWD, 'rev-parse', '--abbrev-ref', 'HEAD'])
  const head = await sh('git', ['-C', PINNED_CWD, 'rev-parse', '--short', 'HEAD'])
  if (branch.code !== 0) return { ok: false, reason: `wt-3 不是可读的 git 工作树：${branch.stderr.trim()}` }
  const name = branch.stdout.trim()
  return {
    ok: true,
    branch: name,
    head: head.stdout.trim(),
    // 分支不符合只警告不拦：分支可能是作者刻意切的，归属由目录决定。
    branchExpected: name === 'agent/wt-3',
  }
}

/** 从 patch 文件里读它声称的模型——用来发现「文件被改坏了」。 */
export const readPatchModel = async () => {
  if (!existsSync(PATCH_FILE)) return { ok: false, reason: `缺少模型覆盖层：${PATCH_FILE}` }
  const text = await readFile(PATCH_FILE, 'utf8')
  const provider = /^\s*provider:\s*"?([^"\n#]+)"?/mu.exec(text)?.[1]?.trim()
  const model = /^\s*model:\s*"?([^"\n#]+)"?/mu.exec(text)?.[1]?.trim()
  if (!provider || !model) return { ok: false, reason: 'model.patch.yml 里读不到 provider/model' }
  return { ok: true, provider, model }
}

/**
 * 把 profile 层 + patch 层组合出来的实际模型读回来。
 * 这是「不在错模型上派活」的唯一硬证据——不靠 profile 默认值，也不靠 patch 文件自称。
 */
export const resolveEffectiveModel = async () => {
  const bin = dshBin()
  if (!existsSync(bin)) return { ok: false, reason: `找不到 DSH：${bin}` }
  const run = await sh(process.execPath, [bin, '--profile', 'headless', '--patch', PATCH_FILE, '--dump-config'], { cwd: PINNED_CWD })
  if (run.code !== 0) return { ok: false, reason: `--dump-config 失败（exit ${run.code}）：${run.stderr.trim().slice(0, 300)}` }
  const lines = run.stdout.split('\n')
  const start = lines.findIndex(line => /^- id: agent-default-model\b/u.test(line))
  if (start === -1) return { ok: false, reason: '--dump-config 输出里没有 agent-default-model 段' }
  let provider
  let model
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^- id: /u.test(lines[i])) break
    provider ??= /^\s+provider:\s*"?([^"\n#]+)"?/u.exec(lines[i])?.[1]?.trim()
    model ??= /^\s+model:\s*"?([^"\n#]+)"?/u.exec(lines[i])?.[1]?.trim()
  }
  if (!model) return { ok: false, reason: 'agent-default-model 段里读不到 model' }
  return {
    ok: true,
    provider,
    model,
    matches: provider === EXPECTED_PROVIDER && model === EXPECTED_MODEL,
  }
}

// --- status ---------------------------------------------------------------

const cmdStatus = async (flags) => {
  const bin = dshBin()
  const version = await dshVersion()
  const worktree = await checkPinnedWorktree()
  const patch = await readPatchModel()
  const effective = await resolveEffectiveModel()
  const rendererBusy = await portBusy(RENDERER_PORT)
  const cdpBusy = await portBusy(CDP_PORT)

  const rows = [
    ['DSH 可执行', existsSync(bin) ? bin : `缺失：${bin}`],
    ['DSH 版本', version],
    ['工作目录', PINNED_CWD],
    ['worktree', worktree.ok ? `${worktree.branch} @ ${worktree.head}` : `未就绪：${worktree.reason}`],
    ['分支符合预期', worktree.ok ? (worktree.branchExpected ? '是（agent/wt-3）' : `否（${worktree.branch}）`) : '—'],
    ['模型覆盖层', patch.ok ? `${patch.provider} / ${patch.model}` : `未就绪：${patch.reason}`],
    ['实际生效模型', effective.ok ? `${effective.provider} / ${effective.model}` : `未就绪：${effective.reason}`],
    ['模型是否符合要求', effective.ok ? (effective.matches ? `是（${EXPECTED_NAME}）` : '否 —— 拒绝派活') : '—'],
    [`端口 ${RENDERER_PORT}（renderer）`, rendererBusy ? '占用中' : '空闲'],
    [`端口 ${CDP_PORT}（CDP）`, cdpBusy ? '占用中' : '空闲'],
    ['运行时目录', RUNTIME_DIR],
  ]

  if (flags.json) {
    process.stdout.write(`${JSON.stringify({
      ok: Boolean(worktree.ok && patch.ok && effective.ok && effective.matches),
      dsh: { bin, exists: existsSync(bin), version },
      worktree,
      patch,
      effective,
      expected: { provider: EXPECTED_PROVIDER, model: EXPECTED_MODEL, name: EXPECTED_NAME },
      ports: { [RENDERER_PORT]: rendererBusy, [CDP_PORT]: cdpBusy },
      runtimeDir: RUNTIME_DIR,
    }, null, 2)}\n`)
    return worktree.ok && effective.matches ? EXIT.ok : EXIT.fail
  }

  const width = Math.max(...rows.map(([name]) => [...name].length))
  process.stdout.write(`${rows.map(([name, value]) => `${name.padEnd(width)}  ${value}`).join('\n')}\n`)
  if (!effective.ok || !effective.matches) {
    process.stdout.write(`\n[refuse] 实际生效模型不是 ${EXPECTED_MODEL}，派活会被拒绝。\n`)
    return EXIT.fail
  }
  return EXIT.ok
}

// --- task -----------------------------------------------------------------

const parseTaskArgs = (argv) => {
  const flags = { cwd: PINNED_CWD, timeout: 900, json: false, force: false, file: undefined, task: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--file') { flags.file = argv[++i]; continue }
    if (arg === '--cwd') { flags.cwd = argv[++i]; continue }
    if (arg === '--timeout') { flags.timeout = Number(argv[++i]); continue }
    if (arg === '--json') { flags.json = true; continue }
    if (arg === '--force') { flags.force = true; continue }
    flags.task.push(arg)
  }
  return flags
}

const pad = n => String(n).padStart(2, '0')
const stamp = () => {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

const cmdTask = async (argv) => {
  const flags = parseTaskArgs(argv)

  // 1) 归属护栏：目录必须是被钉死的那一格。
  const wanted = resolve(flags.cwd)
  if (wanted !== resolve(PINNED_CWD)) {
    if (!flags.force) {
      die(EXIT.refuse, `[refuse] DSH 通道固定工作目录 ${PINNED_CWD}；收到 ${wanted}。\n归属见 docs/agents/worktree-parallel.md §3.1。排障要越过请加 --force 并在报告里写明。`)
    }
    process.stderr.write(`[warn] --force 越过归属护栏：${wanted}\n`)
  }
  const worktree = await checkPinnedWorktree()
  if (!worktree.ok) die(EXIT.notReady, `[not-ready] ${worktree.reason}`)

  // 2) 任务文本。
  let task = flags.task.join(' ').trim()
  if (flags.file) {
    if (!existsSync(flags.file)) die(EXIT.usage, `[usage] 任务书不存在：${flags.file}`)
    task = await readFile(flags.file, 'utf8')
  }
  if (task === '') die(EXIT.usage, '[usage] 缺少任务文本：dsh-task.mjs task "..." 或 --file 任务书.md')

  // 3) 模型护栏：读回组合后的实际模型，不一致绝不派活。
  const effective = await resolveEffectiveModel()
  if (!effective.ok) die(EXIT.notReady, `[not-ready] ${effective.reason}`)
  if (!effective.matches) {
    die(EXIT.fail, `[refuse] 实际生效模型 ${effective.provider}/${effective.model} ≠ ${EXPECTED_PROVIDER}/${EXPECTED_MODEL}。\n检查 scripts/dsh/model.patch.yml，或 DSH 是否改了 patch 语义。`)
  }

  // 4) 派活。
  const runId = `${stamp()}-${process.pid}`
  const outDir = join(RUNTIME_DIR, runId)
  await mkdir(outDir, { recursive: true })

  const bin = dshBin()
  const startedAt = new Date()
  const args = ['--profile', 'headless', '--patch', PATCH_FILE, task]
  const child = spawn(process.execPath, [bin, ...args], { cwd: wanted, windowsHide: true })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => { stdout += chunk.toString('utf8') })
  child.stderr.on('data', chunk => { stderr += chunk.toString('utf8') })

  const timeoutMs = Math.max(1, flags.timeout) * 1000
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    child.kill('SIGTERM')
    // Windows 上 headless 可能留下子进程树，补一刀。
    setTimeout(() => { try { child.kill('SIGKILL') } catch { /* 已退出 */ } }, 3000)
  }, timeoutMs)

  const code = await new Promise(settle => {
    child.on('error', error => { stderr += `\n${error.message}`; settle(-1) })
    child.on('close', value => settle(value ?? -1))
  })
  clearTimeout(timer)

  const endedAt = new Date()
  const reply = stripAnsi(stdout).trim()
  const markers = extractMarkers(reply)

  await writeFile(join(outDir, 'prompt.md'), `${task}\n`, 'utf8')
  await writeFile(join(outDir, 'reply.md'), `${reply}\n`, 'utf8')
  if (stderr.trim() !== '') await writeFile(join(outDir, 'stderr.log'), stripAnsi(stderr), 'utf8')
  await writeFile(join(outDir, 'meta.json'), `${JSON.stringify({
    runId,
    cwd: wanted,
    model: `${effective.provider}/${effective.model}`,
    expectedModel: `${EXPECTED_PROVIDER}/${EXPECTED_MODEL}`,
    dshVersion: await dshVersion(),
    worktree: { branch: worktree.branch, head: worktree.head },
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt - startedAt,
    exitCode: code,
    timedOut,
    markers,
    argv: ['--profile', 'headless', '--patch', PATCH_FILE, '<task>'],
  }, null, 2)}\n`, 'utf8')

  const summary = {
    runId,
    ok: code === 0 && !timedOut,
    exitCode: code,
    timedOut,
    durationMs: endedAt - startedAt,
    cwd: wanted,
    model: `${effective.provider}/${effective.model}`,
    replyFile: join(outDir, 'reply.md'),
    markers,
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ ...summary, reply }, null, 2)}\n`)
  } else {
    if (reply !== '') process.stdout.write(`${reply}\n`)
    if (timedOut) process.stderr.write(`\n[timeout] ${Math.round(timeoutMs / 1000)}s 未结束，已终止。产物：${outDir}\n`)
    else if (code !== 0) process.stderr.write(`\n[fail] exit ${code}。stderr：${stripAnsi(stderr).trim().slice(0, 500)}\n产物：${outDir}\n`)
    process.stdout.write(`\n[run ${runId}] ${summary.durationMs}ms · ${summary.model} · 产物 ${outDir}\n`)
    if (markers.length > 0) {
      process.stdout.write(`${markers.map(m => `  [${m.marker}] ${m.state} ${m.note}`).join('\n')}\n`)
    }
  }

  if (timedOut) return EXIT.timeout
  return code === 0 ? EXIT.ok : EXIT.fail
}

// --- markers --------------------------------------------------------------

/** 只读：从一份文本（默认 stdin）里抽队列标记，规则与豆包通道同一份实现。 */
const cmdMarkers = async (argv) => {
  const json = argv.includes('--json')
  const fileAt = argv.indexOf('--file')
  let text
  if (fileAt !== -1) {
    const file = argv[fileAt + 1]
    if (!file || !existsSync(file)) die(EXIT.usage, `[usage] 读不到文件：${file}`)
    text = await readFile(file, 'utf8')
  } else {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    text = Buffer.concat(chunks).toString('utf8')
  }
  const markers = extractMarkers(text)
  if (json) {
    process.stdout.write(`${JSON.stringify(markers, null, 2)}\n`)
  } else if (markers.length === 0) {
    process.stdout.write('（没有标记）\n')
  } else {
    process.stdout.write(`${markers.map(m => `[${m.marker}] ${m.state} ${m.note}${m.timestamp ? `  ${m.timestamp}` : ''}`).join('\n')}\n`)
  }
  return EXIT.ok
}

// --- 入口 -----------------------------------------------------------------

const HELP = `DSH 通道 CLI（把活派给本机 DeepSeek Harness，固定 wt-3）

  node scripts/dsh/dsh-task.mjs status [--json]
      只读诊断：DSH 版本 / wt-3 归属 / 组合后实际模型 / 槽位端口。
      「实际生效模型」是用 --dump-config 读回来的，不是 profile 默认值。

  node scripts/dsh/dsh-task.mjs task "<任务文本>" [--timeout 900] [--json]
  node scripts/dsh/dsh-task.mjs task --file 任务书.md
      派活：cwd 钉死 wt-3、模型钉死 ${EXPECTED_NAME}。
      产物落在 .runtime/dsh/<runId>/（prompt.md / reply.md / meta.json）。

  node scripts/dsh/dsh-task.mjs markers [--file 文本] [--json]
      只读：抽 ## [Tn] DONE|BLOCKED 标记（复用豆包通道的解析器）。

退出码：0 成功 · 1 失败/模型不符 · 2 未就绪 · 3 归属拒绝 · 4 超时 · 5 用法错误
`

const main = async (argv) => {
  const [command, ...rest] = argv
  if (command === undefined || command === '-h' || command === '--help') {
    process.stdout.write(HELP)
    return EXIT.ok
  }
  if (command === 'status') return cmdStatus({ json: rest.includes('--json') })
  if (command === 'task') return cmdTask(rest)
  if (command === 'markers') return cmdMarkers(rest)
  die(EXIT.usage, `[usage] 未知子命令：${command}\n\n${HELP}`)
}

main(process.argv.slice(2)).then(code => process.exit(code)).catch(error => {
  process.stderr.write(`[fail] ${error?.stack ?? error}\n`)
  process.exit(EXIT.fail)
})
