/**
 * relay 信号件：外派卡投出去之后，必须有人在「完成」那一刻叫醒联络人。
 *
 * 2026-11-27 事故（C5-pre）：`task --no-wait` 派给豆包，派单书只写了回执落点
 * （`C:\tmp\up-c5pre\doubao\`，无人 watch），没有任何信号件；豆包 10:43 交件，
 * 联络人那一轮早已结束，relay.log 之后 0 条投递——整单停在盘上，没人知道该取件了。
 *
 * 读 relay 源码（dsh-handoff-relay 0.6.8 index.js）后的三条事实，决定了本模块的形状：
 * 1. `checkStable` 在稳定期到点后**即使没有 DONE 也会 deliver**（`deliver(..., 'stable')`）；
 *    DONE 只是「不用等 5 秒静默」的提前触发。所以**不能**先往 watch 目录塞占位件，
 *    否则联络人会被一个还没内容的件叫醒。信号件必须等真正完成再一次性写出。
 * 2. 这两条 watch 的 targetIdentity 是 `AI writer项目组:<联络人>`，按群地址解析 ⇒
 *    `channelRequiresMention()` 为真：**正文里没有半角 `@<联络人>` 一律按 NO_MENTION 拒收**
 *    （2026-11-24 的 probe 件就是这样被拒的）。所以信号件首行必须带 @。
 * 3. 被拒件改名为 `<原名>.rejected.md` 留在原地，不会自动重投。
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DONE_MARKER = '<!-- DONE -->'

/** 每个外派通道的 relay watch 目录与默认 @ 对象（须与 profiles/desktop/cordis.patch.yml 一致）。 */
export const CHANNELS = {
  doubao: { dirs: ['C:\\dsh-relay\\signals\\doubao', 'C:\\dsh-relay\\wakeup\\doubao'], mention: '豆包联络人' },
  workbuddy: { dirs: ['C:\\dsh-relay\\signals\\workbuddy', 'C:\\dsh-relay\\wakeup\\workbuddy'], mention: 'workbuddy联络人' },
}

const norm = value => resolve(value).replace(/[\\/]+$/, '').toLowerCase()
const tailHas = (text, marker, bytes = 4096) => text.slice(-bytes).includes(marker)

const channelOf = channel => {
  const config = CHANNELS[channel]
  if (!config) throw new Error(`未知外派通道: ${channel}（只认 ${Object.keys(CHANNELS).join(' / ')}）`)
  return config
}
export const watchDirsOf = channel => channelOf(channel).dirs
export const mentionOf = channel => channelOf(channel).mention

/** 信号件路径必须在 watch 目录内，否则 relay 永远看不到它。返回绝对路径。 */
export function assertPathIn(dirs, filePath) {
  const abs = resolve(filePath)
  const target = norm(abs)
  const hit = dirs.find(dir => {
    const normalized = norm(dir)
    return target === normalized || target.startsWith(normalized + '\\')
  })
  if (!hit) {
    throw new Error(`信号件必须落在 relay 的 watch 目录里，否则联络人收不到：\n`
      + `  给的是 ${abs}\n`
      + `  可用目录：\n${dirs.map(dir => '    ' + dir).join('\n')}`)
  }
  return abs
}

export const assertInWatchDir = (channel, filePath) => assertPathIn(watchDirsOf(channel), filePath)

/** 信号件正文：首行 @ 联络人（relay 的群通道闸），三行指针，末行 DONE（提前触发投递）。 */
export function signalBody({ channel, mention, title, receiptPath, replyTail, evidence, now = new Date() }) {
  const at = mention ?? mentionOf(channel)
  const tail = (replyTail ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
  return [
    `@${at} 派单完成，请取件。`,
    '',
    `- 卡：${title ?? '(未命名)'}`,
    `- 回执落点：${receiptPath ?? '见派单件'}`,
    ...(evidence ? [`- 判定依据：${evidence}`] : []),
    `- 收尾摘要：${tail || '(未取到，见回执)'}`,
    `- 完成时间：${now.toISOString()}`,
    '',
    DONE_MARKER,
    '',
  ].join('\n')
}

/**
 * 写信号件（一次性写全，含 DONE）。`dirs` 只给测试用。
 *
 * 已存在同路径的件就跳过、返回 null：一次收尾只能叫醒一次。执行方自己写过、
 * 或调用方重试过，都不该让同一个人再被叫第二遍（relay 按 contentHash 去重，
 * 两份内容不同的件它会当成两件事分别投递）。
 */
export function writeSignal({ channel, path: filePath, title, receiptPath, replyTail, evidence, mention, now, dirs, overwrite = false }) {
  const abs = dirs ? assertPathIn(dirs, filePath) : assertInWatchDir(channel, filePath)
  if (!overwrite && existsSync(abs)) return null
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, signalBody({ channel, mention, title, receiptPath, replyTail, evidence, now }), 'utf8')
  return abs
}

/**
 * relay 的投递日志（可按 DSH_RELAY_LOG 覆盖）。
 *
 * 为什么需要它：任务书里如果自己写了「交件后由你写信号件」，执行方往往**写早了**——
 * relay 0.6.8 在静默窗口到点后不管有没有 DONE 都会投，于是联络人先被半截件叫醒一次。
 * 2026-11-27 S1（d2f24410）实机就是这样被叫了三次（12:04:59 / 12:05:18 / 12:08:45）。
 * settler 写件前查一次日志：本单派出之后已经叫醒过，就不再叫第二遍。
 */
export function relayLogPath() {
  return process.env.DSH_RELAY_LOG || join(homedir(), '.dsh', 'profiles', 'desktop', 'dsh-handoff-relay', 'relay.log')
}

/**
 * 本单派出之后，relay 是否已经把这个联络人叫醒过。
 *
 * `target` 给了就只认「这一个信号件」被投出去（relay.log 的投递行不写件名，
 * 件名在前一行 watch-warn-source target=<名> dir=<目录>；两行相隔几十毫秒，按 5 秒窗口配对）。
 * 不给 target 时退化为「这个联络人有没有被叫过」——那种口径会误抑制同窗口里别的卡，只留给调试用。
 */
export function deliveredSince({ logPath = relayLogPath(), mention, sinceMs = 0, target = null }) {
  if (!mention) return false
  let text = ''
  try {
    text = readFileSync(logPath, 'utf8')
  } catch {
    return false
  }
  const needle = `|${mention}`
  let lastTarget = null
  let lastTargetAt = 0
  for (const line of text.split('\n')) {
    const at = Date.parse(line.slice(0, 24))
    if (line.includes('watch-warn-source') || line.includes('tool-deliver')) {
      const hit = /target=([^\s]+)/.exec(line)
      if (hit) {
        lastTarget = hit[1]
        lastTargetAt = Number.isFinite(at) ? at : 0
      }
      continue
    }
    if (!line.includes('注入身份') || !line.includes(needle)) continue
    if (!(Number.isFinite(at) && at >= sinceMs)) continue
    if (!target) return true
    if (lastTarget === target && Math.abs(at - lastTargetAt) <= 5_000) return true
  }
  return false
}

/**
 * 看护进程的「事件账本」：`.runtime/<channel>/settle-events.jsonl`。
 *
 * 为什么要它：settler 是 detached 起来的，abort / 超时 / 归属不成立都只写自己的
 * settle-*.log，没人会去翻——锁住了却没人知道漏叫，等于静默。事件账本让
 * `signals` 一条命令就能看见「最近有哪些单没叫成、为什么」。
 */
export function settleEventLogPath(channel, { root } = {}) {
  const base = root ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.runtime')
  return join(base, channel, 'settle-events.jsonl')
}

export function appendSettleEvent({ channel, event, signal = null, detail = '', now = Date.now(), root } = {}) {
  const path = settleEventLogPath(channel, { root })
  try {
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, JSON.stringify({
      at: new Date(now).toISOString(),
      event,
      signal: signal ? basename(signal) : null,
      detail: String(detail).slice(0, 400),
    }) + '\n', 'utf8')
  } catch {
    // 记账失败不能影响主流程
  }
}

/** 最近 N 条事件（新的在后），读不到就返回空数组。 */
export function readSettleEvents({ channel, limit = 5, root } = {}) {
  let text = ''
  try {
    text = readFileSync(settleEventLogPath(channel, { root }), 'utf8')
  } catch {
    return []
  }
  return text.split('\n').filter(Boolean).slice(-limit).map(line => {
    try { return JSON.parse(line) } catch { return { at: null, event: 'unparsable', detail: line } }
  })
}

/** 只读扫描：watch 目录里哪些信号件还没写完/** 只读扫描：watch 目录里哪些信号件还没写完（无 DONE）、哪些已就绪。 */
export function scanSignals(channel, options = {}) {
  const dirs = options.dirs ?? watchDirsOf(channel)
  const result = { channel, dirs: [], pending: 0, ready: 0 }
  for (const dir of dirs) {
    const entry = { dir, files: [] }
    let names = []
    try {
      names = readdirSync(dir)
    } catch (error) {
      result.dirs.push({ ...entry, missing: true, error: String(error?.code ?? error) })
      continue
    }
    for (const name of names) {
      if (name.startsWith('.') || name.endsWith('.rejected.md')) continue // 占位件与被拒件都不算信号
      const full = join(dir, name)
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (!stat.isFile()) continue
      let done = false
      try {
        done = tailHas(readFileSync(full, 'utf8'), DONE_MARKER)
      } catch {
        done = false
      }
      if (done) result.ready += 1
      else result.pending += 1
      entry.files.push({ name, size: stat.size, mtime: stat.mtime.toISOString(), done })
    }
    result.dirs.push(entry)
  }
  return result
}
