#!/usr/bin/env node
/**
 * Doubao watchdog —— 主动探测「中档 agent 做一件就收工」并补一句 nudge。
 *
 * 背景（2026-11-05 实测）：`--effort 中` 的豆包会在多步任务中途结束 turn，
 * 页面看起来一切正常、看板卡仍是 running，只有人不补一句「继续执行」才继续。
 * 现有能力都当不了自动判据：
 *   - `waitForReply` 的 settled 只在 task/ask 调用内生效，且长任务跑命令时文本本来就会停；
 *   - `markers` 只对有 `[Tn]` 标记的队列任务书有效，单卡任务书全空；
 *   - 看板卡状态只能判「没干完」，判不了「这一轮停了」。
 *
 * 本脚本用**三层与门**（缺一不催）：
 *   ① 轮次已结束 = 最后一条 assistant turn 出现完整操作条（正向硬信号）
 *      + 无生成指示器 + 连续 N 次快照 turnCount/末条文本不变 + 输入框空闲；
 *   ② 任务未完成 = 看板卡仍 running/external 且没有 review/finishedAt/报告/QUEUE EMPTY；
 *   ③ 话题正确 = 当前 href 与派活记录一致、已登录、编辑器在。
 * 刹车：冷却 ≥3 分钟、总次数 ≤3、卡一交回立即退出、催了仍不动就停并告警。
 *
 * 为什么不解析 CLI 的 JSON stdout：PowerShell/ConPTY 会把多行输出硬折行并弄坏中文，
 * `ConvertFrom-Json` 2026-11-05 连坏两次。**Node 子进程拿到的是原始 stdout**，
 * 这里用 execFileSync 直接 parse，不走终端渲染层。
 *
 * 为什么由人在自己的终端启动：工具会话起的后台进程会随会话回收（手册 §2 实测）。
 *
 * 用法：
 *   node scripts/doubao/watchdog.mjs --task <cardId> [--report <path>] [选项]
 *   node scripts/doubao/watchdog.mjs --task <id> --once --dry-run   # 只判一次，绝不发消息
 *   node scripts/doubao/watchdog.mjs --self-test                     # 判据矩阵自测，不碰窗口
 *   node scripts/doubao/watchdog.mjs --calibrate                     # 打印当前 DOM 生成指示器
 *
 * Zero dependencies: Node 22 内置模块 + ./cdp.mjs + ./markers.mjs。
 * 不修改 doubao.mjs 的任何既有命令。
 */

import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PORT, sleep, withChat } from './cdp.mjs'
import { extractMarkers, isTerminalQueueMarker } from './markers.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const BOARD_CLI = join(ROOT, 'scripts', 'task-board', 'dsh-task-board.mjs')
const SAY_CLI = join(ROOT, 'scripts', 'doubao', 'doubao.mjs')
const DISPATCH_RECORD = join(ROOT, '.runtime', 'doubao', 'last-thread.json')
const LOG_FILE = join(ROOT, '.runtime', 'doubao', 'watchdog.log.jsonl')

const argv = process.argv.slice(2)
const flag = name => argv.includes(`--${name}`)
const option = (name, fallback) => {
  const index = argv.indexOf(`--${name}`)
  const value = argv[index + 1]
  return index >= 0 && value && !value.startsWith('--') ? value : fallback
}

const HELP = `用法:
  node scripts/doubao/watchdog.mjs --task <cardId> [选项]

必需:
  --task <id>          要盯的任务卡 id（看板卡；未交回才可能催）
可选:
  --report <path>      报告文件全路径；不传则查主工作区与 wt-1 的 .dsh-task-board/reports/<id>.md
  --thread <href>      覆盖派活记录里的 href（默认读 .runtime/doubao/last-thread.json）
  --port <n>           CDP 端口，默认 ${DEFAULT_PORT}
  --interval <s>       探测间隔秒，默认 20
  --steady <n>         连续几次快照完全相同才算「停了」，默认 3
  --cooldown <min>     两次 nudge 之间的冷却分钟，默认 3
  --max-nudges <n>     最多补几次，默认 3
  --nudge-text <text>  自定义催办话术

模式（互不冲突，优先级 self-test > calibrate > once）:
  --self-test   跑判据矩阵自测，不连窗口、不发消息
  --calibrate   打印当前页面的生成指示器快照（生成中跑一次可校准锚点）
  --once        只探测一轮就退出
  --dry-run     判据成立也只记日志、不调用 say
  --help        显示本帮助

注意: 常驻进程请在**你自己的终端**里启动；工具会话的后台进程会随会话回收。
`

/**
 * 一次 CDP 求值拿齐所有判据需要的 DOM 事实。
 *
 * 「轮次已结束」的正向硬信号 = 最后一条 receive_message 内有 message_action_regenerate。
 * 2026-11-05 22:2x 空闲态实测：recvCount=3、lastHasRegenerate=true、stopIds=[]；
 * 而页面尾部仍留着上一轮的命令文本 —— 所以「页面有输出」绝不能当「还在跑」。
 */
const SNAPSHOT_JS = `(() => {
  const scope = document.querySelector('[data-testid="message-list"]') ?? document;
  const turns = [];
  for (const turn of scope.querySelectorAll('[data-testid="send_message"], [data-testid="receive_message"]')) {
    const role = turn.getAttribute('data-testid') === 'send_message' ? 'user' : 'assistant';
    const body = turn.querySelector('[data-testid="message_text_content"]');
    const text = (body ? body.innerText : turn.innerText).trim();
    if (text) turns.push({ role, text });
  }
  const last = [...turns].reverse().find(t => t.role === 'assistant') ?? null;
  const receives = [...scope.querySelectorAll('[data-testid="receive_message"]')];
  const lastNode = receives.at(-1) ?? null;
  const editor = document.querySelector('[data-testid="chat_input_input"] .ProseMirror')
    ?? document.querySelector('div.tiptap.ProseMirror');
  const testids = [...new Set([...document.querySelectorAll('[data-testid]')].map(e => e.getAttribute('data-testid')))];
  const bodyText = document.body.innerText || '';
  const lastUser = [...turns].reverse().find(t => t.role === 'user')?.text ?? '';
  const anchor = lastUser.trim().slice(0, 30);
  const index = anchor ? bodyText.lastIndexOf(anchor) : -1;
  return {
    href: location.href,
    title: document.title,
    turnCount: turns.length,
    lastAssistant: last?.text ?? null,
    hasRegenerate: Boolean(lastNode?.querySelector('[data-testid="message_action_regenerate"]')),
    placeholder: /^(正在思考|思考中|生成中|正在生成|Thinking|Generating)[.…]*$/iu.test((last?.text ?? '').trim()),
    stopIds: testids.filter(x => /stop|abort|pause|generating|thinking/i.test(x) && !/regenerat/i.test(x)),
    stopText: /停止生成|暂停生成|正在生成|正在思考/.test(bodyText.slice(-600)),
    hasEditor: Boolean(editor),
    editorText: editor ? editor.innerText.trim() : null,
    loggedIn: !location.href.includes('login'),
    latestOutput: index < 0 ? (last?.text ?? '') : bodyText.slice(index + anchor.length),
    bodyTail: bodyText.slice(-300).replace(/\\s+/g, ' '),
  };
})()`

const log = (event, data = {}) => {
  const line = JSON.stringify({ at: new Date().toISOString(), event, ...data })
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true })
    appendFileSync(LOG_FILE, line + '\n', 'utf8')
  } catch { /* 日志写不进去不该让常驻循环崩掉 */ }
  console.log(line)
}

const readDispatchHref = () => {
  try { return JSON.parse(readFileSync(DISPATCH_RECORD, 'utf8')).href ?? null } catch { return null }
}

const reportPathsFor = (taskId, explicit) => explicit
  ? [resolve(explicit)]
  : [
      join(ROOT, '.dsh-task-board', 'reports', `${taskId}.md`),
      join(ROOT, '..', 'wt-1', '.dsh-task-board', 'reports', `${taskId}.md`),
    ]

/** 走 Node 子进程拿原始 stdout，避开 ConPTY 折行。失败一律 fail-closed（不催）。 */
const readCard = (taskId) => {
  try {
    const out = execFileSync(process.execPath, [BOARD_CLI, 'get', taskId, '--json'], {
      encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'],
    })
    const parsed = JSON.parse(out)
    if (!parsed?.task) return { ok: false, reason: 'no-task-in-get-response' }
    const tags = (parsed.task.tags ?? []).map(item => (typeof item === 'string' ? item : item.name))
    const times = parsed.times?.[taskId] ?? parsed.task.times?.[taskId] ?? {}
    return { ok: true, status: parsed.task.status, tags, finishedAt: times.finishedAt ?? null }
  } catch (error) {
    return { ok: false, reason: String(error?.message ?? error).slice(0, 160) }
  }
}

const queueEmpty = output => {
  const markers = extractMarkers(output ?? '')
  return markers.some((item, index) => item.marker === 'QUEUE'
    && /^(EMPTY|EMPTIED|STOPPED)$/i.test(item.state)
    && isTerminalQueueMarker(markers, index))
}

/**
 * 纯判定，便于 --self-test 覆盖矩阵；返回 { verdict, reasons }。
 * 只在 verdict === 'nudge' 时才允许调用 say。
 */
export const decide = ({ snap, card, reportExists, queueDone, threadHref, steady, cooldownMs, maxNudges, nudges, lastNudgeAt, now }) => {
  const reasons = []

  // ① 轮次已结束
  const generating = snap.placeholder || snap.stopIds.length > 0 || snap.stopText || !snap.hasRegenerate
  const layer1 = !generating && Boolean(snap.lastAssistant) && steady.count >= steady.min
    && snap.hasEditor && !snap.editorText && snap.loggedIn
  if (generating) reasons.push('generating-indicator')
  if (steady.count < steady.min) reasons.push(`steady-${steady.count}/${steady.min}`)
  if (snap.editorText) reasons.push('editor-not-empty')
  if (!snap.hasEditor || !snap.loggedIn) reasons.push('page-not-ready')

  // ② 任务未完成
  const completed = card.ok && (
    card.tags.includes('review') || card.tags.includes('done') || Boolean(card.finishedAt)
    || /^(done|closed|cancelled|canceled)$/i.test(String(card.status))
  )
  const alive = card.ok && (card.status === 'running' || card.tags.includes('external') || card.tags.includes('claimed'))
  const layer2 = card.ok && alive && !completed && !reportExists && !queueDone
  if (!card.ok) reasons.push(`board-unavailable:${card.reason ?? '-'}`)
  if (card.ok && !alive) reasons.push(`card-not-alive:${card.status}`)
  if (completed) reasons.push('card-returned')
  if (reportExists) reasons.push('report-exists')
  if (queueDone) reasons.push('queue-empty')

  // ③ 话题正确
  const layer3 = Boolean(threadHref) && snap.href === threadHref
  if (!threadHref) reasons.push('no-dispatch-record')
  if (threadHref && snap.href !== threadHref) reasons.push('thread-mismatch')

  if (completed || (card.ok && !alive)) return { verdict: 'stop-task-returned', reasons }
  if (!(layer1 && layer2 && layer3)) return { verdict: 'no-nudge', reasons }

  if (nudges >= maxNudges) return { verdict: 'no-nudge', reasons: [...reasons, 'max-nudges-reached'] }
  if (lastNudgeAt && now - lastNudgeAt < cooldownMs) {
    return { verdict: 'no-nudge', reasons: [...reasons, 'cooldown'] }
  }
  return { verdict: 'nudge', reasons }
}

const selfTest = () => {
  const base = {
    snap: {
      href: 'chrome://doubao-chat/chat/1', lastAssistant: '我先探查一下',
      hasRegenerate: true, placeholder: false, stopIds: [], stopText: false,
      hasEditor: true, editorText: '', loggedIn: true,
    },
    card: { ok: true, status: 'running', tags: ['external', 'I2'], finishedAt: null },
    reportExists: false, queueDone: false, threadHref: 'chrome://doubao-chat/chat/1',
    steady: { count: 3, min: 3 }, cooldownMs: 180_000, maxNudges: 3,
    nudges: 0, lastNudgeAt: 0, now: 1_000_000,
  }
  const cases = [
    ['三层全真 → 催', base, 'nudge'],
    ['生成中（操作条未出现）→ 不催', { ...base, snap: { ...base.snap, hasRegenerate: false } }, 'no-nudge'],
    ['快照还在变 → 不催', { ...base, steady: { count: 1, min: 3 } }, 'no-nudge'],
    ['卡已交回（review）→ 停', { ...base, card: { ok: true, status: 'todo', tags: ['I2', 'review'], finishedAt: 1 } }, 'stop-task-returned'],
    ['报告已出现 → 不催', { ...base, reportExists: true }, 'no-nudge'],
    ['QUEUE EMPTY → 不催', { ...base, queueDone: true }, 'no-nudge'],
    ['话题不符 → 不催', { ...base, threadHref: 'chrome://doubao-chat/chat/other' }, 'no-nudge'],
    ['无派活记录 → 不催（fail-closed）', { ...base, threadHref: null }, 'no-nudge'],
    ['冷却未过 → 不催', { ...base, nudges: 1, lastNudgeAt: 999_000 }, 'no-nudge'],
    ['次数用尽 → 不催', { ...base, nudges: 3 }, 'no-nudge'],
    ['看板读不到 → 不催（fail-closed）', { ...base, card: { ok: false, reason: 'ECONNREFUSED' } }, 'no-nudge'],
  ]
  let failed = 0
  for (const [name, input, expected] of cases) {
    const { verdict, reasons } = decide(input)
    const ok = verdict === expected
    if (!ok) failed += 1
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  => ${verdict}${reasons.length ? ` [${reasons.join(',')}]` : ''}`)
  }
  console.log(`self-test: ${cases.length - failed}/${cases.length} passed`)
  return failed === 0
}

const main = async () => {
  if (flag('help') || flag('h')) { console.log(HELP); return }
  if (flag('self-test')) { if (!selfTest()) process.exitCode = 1; return }

  const port = Number(option('port', DEFAULT_PORT))
  if (flag('calibrate')) {
    const snap = await withChat(client => client.evaluate(SNAPSHOT_JS), port)
    // latestOutput 可能整页长，校准模式只看锚点，不打全文。
    const { latestOutput, ...visible } = snap
    console.log(JSON.stringify({ port, latestOutputChars: (latestOutput ?? '').length, ...visible }, null, 2))
    return
  }

  const taskId = option('task', null)
  if (!taskId) { console.error('缺少 --task <cardId>。用 --help 看用法。'); process.exitCode = 1; return }

  const intervalMs = Number(option('interval', 20)) * 1_000
  const steadyMin = Number(option('steady', 3))
  const cooldownMs = Number(option('cooldown', 3)) * 60_000
  const maxNudges = Number(option('max-nudges', 3))
  const reportPaths = reportPathsFor(taskId, option('report', null))
  const threadHref = option('thread', readDispatchHref())
  const steady = { count: 0, min: steadyMin }
  const once = flag('once')
  const dryRun = flag('dry-run')
  const nudgeText = option('nudge-text',
    `继续执行任务 ${taskId}（这张卡还没交回）。不要停在说明：把验收标准剩余项做完、补测试并跑完检查，报告写进 .dsh-task-board/reports/${taskId}.md，再按卡面「交付与交回」那条命令打 review + release，不许调 done。全部做完再停。`)

  let nudges = 0
  let lastNudgeAt = 0
  let lastSig = null
  let stalledAfterNudge = 0
  let lastAssistantAtNudge = null
  let stallArmed = false

  log('watchdog-start', { taskId, port, intervalMs, steadyMin, cooldownMs, maxNudges,
    once, dryRun, reportPaths, threadHref: threadHref ? 'from-record' : null })

  process.on('SIGINT', () => { log('stopped-by-user', { taskId, nudges }); process.exit(0) })

  for (;;) {
    let snap
    try {
      snap = await withChat(client => client.evaluate(SNAPSHOT_JS), port)
    } catch (error) {
      log('cdp-unavailable', { taskId, reason: String(error?.message ?? error).slice(0, 160) })
      if (once) break
      await sleep(intervalMs)
      continue
    }

    const sig = `${snap.turnCount}|${snap.lastAssistant ?? ''}`
    steady.count = sig === lastSig ? steady.count + 1 : 1
    lastSig = sig

    const card = readCard(taskId)
    const reportExists = reportPaths.some(path => existsSync(path))
    const queueDone = queueEmpty(snap.latestOutput)
    const decision = decide({
      snap, card, reportExists, queueDone, threadHref,
      steady: { count: steady.count, min: steadyMin },
      cooldownMs, maxNudges, nudges, lastNudgeAt, now: Date.now(),
    })

    log('probe', { taskId, turnCount: snap.turnCount, steady: steady.count, steadyMin,
      hasRegenerate: snap.hasRegenerate, stopIds: snap.stopIds.length, stopText: snap.stopText,
      placeholder: snap.placeholder, editorText: Boolean(snap.editorText),
      cardStatus: card.ok ? card.status : null, cardTags: card.ok ? card.tags : null,
      reportExists, queueDone, verdict: decision.verdict, reasons: decision.reasons, nudges })

    if (decision.verdict === 'stop-task-returned') {
      log('task-returned', { taskId, reason: 'review/finishedAt/非进行态，watchdog 收工', nudges })
      break
    }

    if (decision.verdict === 'nudge') {
      if (dryRun) {
        log('nudge-would-send', { taskId, dryRun: true, text: nudgeText })
      } else {
        try {
          const out = execFileSync(process.execPath, [SAY_CLI, 'say', nudgeText, '--port', String(port)], {
            encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
          })
          nudges += 1
          lastNudgeAt = Date.now()
          lastAssistantAtNudge = snap.lastAssistant
          stallArmed = false
          log('nudge-sent', { taskId, nudges, maxNudges, sayOutput: String(out).trim().slice(0, 240) })
        } catch (error) {
          // say 自带 assertSameThread 与「输入框未清空」校验；失败一律不再重试，等人看。
          log('nudge-failed', { taskId, reason: String(error?.message ?? error).slice(0, 200) })
          break
        }
      }
      steady.count = 0
    }

    // 催了之后末条 assistant 回复换了 ⇒ 催办生效，清掉停滞标记。
    // 若回复没换且快照又稳定下来 ⇒ 这一次催办没推动，累计到 2 次就停并告警，不无限催。
    if (lastAssistantAtNudge !== null && snap.lastAssistant !== lastAssistantAtNudge) {
      lastAssistantAtNudge = null
      stallArmed = false
    } else if (lastAssistantAtNudge !== null && steady.count >= steadyMin && !stallArmed) {
      stallArmed = true
      stalledAfterNudge += 1
      if (stalledAfterNudge >= 2) {
        log('stalled-after-nudge', { taskId, nudges, reason: '连续两次催办后末条回复仍无变化，停止自动催办' })
        break
      }
    }

    if (once) break
    if (nudges >= maxNudges) { log('max-nudges-reached', { taskId, nudges }); break }
    await sleep(intervalMs)
  }

  log('watchdog-stop', { taskId, nudges })
}

main().catch(error => {
  const message = String(error?.message ?? error)
  console.error(`✗ watchdog: ${message}`)
  process.exitCode = /找不到豆包聊天页|ECONNREFUSED|fetch failed/.test(message) ? 2 : 1
})
