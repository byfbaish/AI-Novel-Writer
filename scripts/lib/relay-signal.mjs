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

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

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

/** 写信号件（一次性写全，含 DONE）。`dirs` 只给测试用。 */
export function writeSignal({ channel, path: filePath, title, receiptPath, replyTail, evidence, mention, now, dirs }) {
  const abs = dirs ? assertPathIn(dirs, filePath) : assertInWatchDir(channel, filePath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, signalBody({ channel, mention, title, receiptPath, replyTail, evidence, now }), 'utf8')
  return abs
}

/** 追加到任务正文末尾的收尾要求（进对话框，不进 watch 目录）。 */
export function signalInstruction(channel, filePath) {
  const abs = resolve(filePath)
  const at = mentionOf(channel)
  return [
    '',
    '---',
    '',
    '## 收尾必做（信号件，漏了整单白做）',
    `交件之后，把信号件写到这里（一次写全，别先写一半）：\`${abs}\``,
    `第一行必须是 \`@${at}\`（relay 的群通道闸，没有它整件按 NO_MENTION 拒收）；`,
    '接着写三行：回执路径、产物目录、一句话结论；单独一行写：',
    '',
    DONE_MARKER,
    '',
    '没有信号件，联络人不会被叫醒，你交的东西没人来取。',
  ].join('\n')
}

/** 只读扫描：watch 目录里哪些信号件还没写完（无 DONE）、哪些已就绪。 */
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
