/* global process */
/**
 * S6 · D18 判据 4 定向取证脚本（developer 跑；判定面 89868921）
 *
 * 判据 4：定稿后 `[hook-unplanted]` 出现恰一次。
 * 取证位：`finalize-chapter.command.ts:954-975` 的 C5 体检日志（callbacks.log → 工作流日志面板）。
 * 走真 UI：DraftEditor 的「定稿」按钮（`DraftEditor.tsx:805`）→ 定稿工作流 → 读日志面板原文计数。
 *
 * 纪律：单实例、一次启动、跑完即关、leftoverElectronProcesses=0、tasklist 原文入 evidence。
 */

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const argOf = (name, fallback = null) => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}
const MODE = argOf('mode', 'discover')
const REPO = path.resolve(argOf('repo', 'C:/develop/workspace/AI-writer/wt-s6'))
const requireFromRepo = spec => createRequire(path.join(REPO, 'package.json'))(spec)
const { _electron: electron } = requireFromRepo('playwright')

const PROJ = path.resolve(argOf('proj', path.join(HERE, 'proj')))
if (!fs.existsSync(path.join(PROJ, '.ai-novel', 'project.db'))) {
  console.error(`[live][STOP] 项目库不在：${PROJ}`)
  process.exit(2)
}

const runId = randomUUID().slice(0, 12)
const runRoot = path.join(HERE, 'runs', runId)
const roots = Object.fromEntries(['canonical', 'legacy', 'home', 'appData', 'localAppData']
  .map(name => [name, path.join(HERE, '.runtime', name)]))
const USER_DATA = path.join(HERE, 'userdata', 's6-d18')
fs.mkdirSync(runRoot, { recursive: true })

const stepLog = []
const step = (name, detail = '') => {
  stepLog.push({ name, at: new Date().toISOString(), detail })
  console.log(`[live] ${name}${detail ? ` · ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`)
}

/** 第 6 章夹具正文：与蓝图钩子「第6章结尾：名册被划掉的名字在次日夜里重新浮现」无 ≥3 字连续公共片段。 */
const CH6_BODY = '风从窗缝里挤进来，纸页翻动了一下。他伸手按住，屋里安静得只剩呼吸声。'
const CH6_TITLE = '落册'

const MODEL = { id: 's6-echo', name: 'S6 回声模型', provider: 'openai', protocol: 'openai', modelName: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-s5-local-echo', maxTokens: 4096, temperature: 0.7, purposes: ['generation'] }

let instancesThisRun = 0
let session = null
let exitCode = 1

async function retryEval(target, fn, arg, attempts = 8) {
  let last = null
  for (let index = 0; index < attempts; index += 1) {
    try {
      return arg === undefined ? await target.evaluate(fn) : await target.evaluate(fn, arg)
    } catch (error) {
      last = error
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  throw last
}

function tasklistElectron() {
  const command = 'tasklist  （逐行 /electron/i 计数；等价 tasklist | grep -c electron）'
  try {
    const raw = execFileSync('tasklist', [], { encoding: 'utf8' })
    const hits = raw.split(/\r?\n/).filter(line => /electron/i.test(line))
    return { tasklistGrepCount: String(hits.length), tasklistRaw: raw.trim(), tasklistHits: hits.map(line => line.trim()), command }
  } catch (error) {
    return { tasklistGrepCount: '-1', tasklistRaw: `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}`, tasklistHits: [], command }
  }
}
function leftoverElectronProcesses() {
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command',
      "Get-CimInstance Win32_Process -Filter \"name='electron.exe'\" | ForEach-Object { $_.CommandLine }"], { encoding: 'utf8', timeout: 30_000 })
    return out.split(/\r?\n/).filter(line => line.includes(USER_DATA)).length
  } catch { return -1 }
}

async function launch() {
  for (const dir of Object.values(roots)) fs.mkdirSync(dir, { recursive: true })
  fs.mkdirSync(USER_DATA, { recursive: true })
  const env = { ...process.env, AI_NOVEL_APP_DATA_HOME: roots.canonical, AI_NOVEL_LEGACY_SOURCE_HOME: roots.legacy,
    AI_NOVEL_VELA_HOME: roots.legacy, HOME: roots.home, USERPROFILE: roots.home, APPDATA: roots.appData,
    LOCALAPPDATA: roots.localAppData }
  for (const name of ['ELECTRON_RUN_AS_NODE', 'VITE_DEV_SERVER_URL', 'AI_NOVEL_SMOKE_OPEN_PROJECT',
    'AI_NOVEL_SMOKE_PROJECT_MARKER']) delete env[name]
  const app = await electron.launch({ cwd: REPO, args: ['.', `--user-data-dir=${USER_DATA}`], env, timeout: 60_000 })
  instancesThisRun += 1
  await app.evaluate(async () => {
    const state = globalThis.__s6 = { physicalModelRequests: 0, chatCalls: 0, prompts: [], replies: [] }
    const sse = (text) => new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { content: text } , finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
    globalThis.fetch = async (url, init) => {
      const target = String(url)
      if (target.endsWith('/v1/embeddings')) {
        return new Response(JSON.stringify({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (target !== 'https://api.openai.com/v1/chat/completions') {
        state.physicalModelRequests += 1
        throw new Error('S6_EXTERNAL_FETCH_REFUSED')
      }
      state.chatCalls += 1
      let promptText = ''
      try {
        const body = JSON.parse(String(init?.body ?? '{}'))
        promptText = (body.messages ?? []).map(message => (typeof message.content === 'string' ? message.content
          : Array.isArray(message.content) ? message.content.map(part => part?.text ?? '').join('') : '')).join('\n')
      } catch { promptText = '' }
      state.prompts.push({ at: new Date().toISOString(), length: promptText.length, text: promptText.slice(0, 4000) })
      const reply = '他坐在桌前，把纸页按平，抬眼看窗外的天色。'
      state.replies.push(reply)
      return sse(reply)
    }
  })
  const page = await app.firstWindow({ timeout: 60_000 })
  page.setDefaultTimeout(30_000)
  await page.locator('.app-skin-root').waitFor({ state: 'visible', timeout: 60_000 })
  return { app, page }
}

const invoke = (page, channel, ...args) => page.evaluate(({ channel, args }) => window.aiNovelAPI.invoke(channel, ...args), { channel, args })

async function quit(target) {
  if (!target?.app) return null
  const pid = target.app.process()?.pid ?? null
  try { await Promise.race([target.app.close(), new Promise(resolve => setTimeout(resolve, 20_000))]) } catch { /* gone */ }
  try { target.app.process()?.kill() } catch { /* gone */ }
  return { pid, closedAt: new Date().toISOString() }
}

function pathToImport(file) {
  return `file:///${file.replace(/\\/g, '/')}`
}

async function openSeededProject(page) {
  const { chooseProjectDirectoryGrant } = await import(pathToImport(path.join(REPO, 'scripts', 'project-directory-grant.mjs')))
  const grant = await chooseProjectDirectoryGrant(session.app, page, PROJ, 'project-open')
  const opened = await invoke(page, 'project:open', grant, randomUUID())
  if (opened?.success !== true) throw new Error(`project:open：${JSON.stringify(opened)}`)
  await invoke(page, 'llm:save-model', MODEL)
  await invoke(page, 'llm:set-default-model', MODEL.id, null)
  return opened
}

async function appDb(task, payload) {
  const work = session.app.evaluate(async (_, args) => {
    const requireFromRepo = process.mainModule.constructor.createRequire(process.cwd() + '/package.json')
    const nodePath = requireFromRepo('node:path')
    const Database = requireFromRepo('better-sqlite3')
    const db = new Database(nodePath.join(args.projectPath, '.ai-novel', 'project.db'), { fileMustExist: true, timeout: 20_000 })
    db.pragma('busy_timeout = 20000')
    try {
      if (args.task === 'seed-ch6-draft') {
        const existing = db.prepare('SELECT id FROM drafts WHERE chapter_number = 6').get()
        if (existing) return { ok: true, skipped: true, draftId: existing.id }
        const now = Date.now()
        const content = db.prepare('INSERT INTO contents (body, created_at) VALUES (?, ?)').run(args.payload.body, now)
        const draft = db.prepare(`INSERT INTO drafts (chapter_number, version, status, source, content_id, word_count,
          source_dependencies, created_at, updated_at) VALUES (6, 1, 'draft', 'write', ?, ?, '[]', ?, ?)`)
          .run(content.lastInsertRowid, args.payload.body.length, now, now)
        return { ok: true, draftId: draft.lastInsertRowid, contentId: content.lastInsertRowid, bodyLen: args.payload.body.length }
      }
      if (args.task === 'read-state') {
        const drafts = db.prepare('SELECT d.id, d.chapter_number AS chapterNumber, d.status, length(c.body) AS len FROM drafts d JOIN contents c ON c.id = d.content_id ORDER BY d.chapter_number').all()
        let finals = []
        try {
          finals = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%finaliz%'").all()
        } catch { finals = [] }
        return { drafts, finals }
      }
      if (args.task === 'hook-text') {
        return db.prepare('SELECT chapter_number AS chapterNumber, title, suspense_hook AS suspenseHook, characters FROM blueprints WHERE chapter_number = 6').get()
      }
      throw new Error(`unknown task ${args.task}`)
    } catch (error) {
      return { ok: false, error: `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}` }
    } finally { db.close() }
  }, { projectPath: PROJ, task, payload: payload ?? {} })
  return Promise.race([work, new Promise((_, reject) => setTimeout(() => reject(new Error(`APPDB_TIMEOUT:${task}`)), 25_000))])
}

async function enterProject(page) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const clicked = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('button, [role="button"], a')]
      const target = nodes.find(node => (node.textContent ?? '').trim() === '进入作品')
      if (!target) return false
      target.click()
      return true
    })
    if (clicked) {
      const entered = await page.evaluate(async () => {
        const deadline = Date.now() + 15000
        while (Date.now() < deadline) {
          if (document.body.innerText.includes('章节蓝图')) return true
          await new Promise(resolve => setTimeout(resolve, 400))
        }
        return false
      })
      if (entered) return true
    }
    await page.reload().catch(() => null)
    await page.waitForTimeout(3000)
  }
  return false
}

async function clickTreeItem(page, label) {
  return page.evaluate((wanted) => {
    const nodes = [...document.querySelectorAll('button, [role="button"], a, .tree-item, li')]
    const target = nodes.find(node => (node.textContent ?? '').trim() === wanted)
      ?? nodes.find(node => (node.textContent ?? '').includes(wanted))
    if (!target) return false
    target.click()
    return true
  }, label)
}

async function clickButton(page, label) {
  return page.evaluate((wanted) => {
    const nodes = [...document.querySelectorAll('button, [role="button"]')]
    const target = nodes.find(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim() === wanted)
      ?? nodes.find(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim().includes(wanted))
    if (!target) return false
    target.click()
    return true
  }, label)
}

async function dumpUi(page, tag) {
  const info = await retryEval(page, () => {
    const buttons = [...document.querySelectorAll('button, [role="button"]')]
      .map(node => ({ text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(), title: node.getAttribute('title') ?? '',
        testid: node.getAttribute('data-testid') ?? '', disabled: node.disabled === true }))
      .filter(item => item.text || item.title)
    return { buttons: buttons.slice(0, 120), bodyText: document.body.innerText.slice(0, 3000) }
  })
  fs.mkdirSync(runRoot, { recursive: true })
  fs.writeFileSync(path.join(runRoot, `ui-${tag}.json`), JSON.stringify(info, null, 2), 'utf8')
  await page.screenshot({ path: path.join(runRoot, `ui-${tag}.png`), fullPage: false }).catch(() => null)
  return info
}

async function openChapter6Draft(page) {
  const clicked = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('button, [role="button"], a, div, li')]
    const exact = nodes.filter(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim() === '第6章 落册')
    const loose = nodes.filter(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith('第6章 落册'))
    const target = exact[0] ?? loose[0]
    if (!target) return null
    const clickable = target.closest('button, [role="button"], a, li') ?? target
    clickable.scrollIntoView?.({ block: 'center' })
    clickable.click()
    return { text: (clickable.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60), tag: clickable.tagName }
  })
  await page.waitForTimeout(2500)
  const opened = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('button, [role="button"]')]
    return nodes.some(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim() === '定稿')
  })
  return { clicked, opened }
}

/** 轮询直到出现目标按钮；返回是否点到。 */
async function expandWorkflowLogs(page) {
  const norm = () => null
  const first = await page.evaluate(() => {
    const text = node => (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    const done = []
    const logTab = [...document.querySelectorAll('button')].find(node => node.title === '打开日志' || text(node) === '日志')
    if (logTab) { logTab.click(); done.push('log-tab') }
    return done
  }).catch(() => [])
  await page.waitForTimeout(1200)
  const second = await page.evaluate(() => {
    const text = node => (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    const out = []
    const history = [...document.querySelectorAll('button, div, li, span')].find(node => text(node) === '历史任务')
    if (history) { history.click(); out.push('history') }
    return out
  }).catch(() => [])
  await page.waitForTimeout(1200)
  const third = await page.evaluate(() => {
    const text = node => (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    const rows = [...document.querySelectorAll('button, div, li')].filter(node => /^(第 6 章 · 定稿|定稿)$/.test(text(node)))
    const target = rows[rows.length - 1]
    if (!target) return null
    target.click()
    return text(target)
  }).catch(() => null)
  await page.waitForTimeout(1500)
  return { first, second, third }
}

async function clickWhenReady(page, pattern, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const done = await page.evaluate((source) => {
      const re = new RegExp(source)
      const nodes = [...document.querySelectorAll('button, [role="button"]')]
      const target = nodes.find(node => re.test((node.textContent ?? '').replace(/\s+/g, ' ').trim()))
      if (!target || target.disabled) return false
      target.click()
      return true
    }, pattern.source)
    if (done) return true
    await page.waitForTimeout(500)
  }
  return false
}

const MARKER = '[hook-unplanted]'

async function main() {
  step('paths', JSON.stringify({ MODE, PROJ, REPO, USER_DATA, runId }))
  session = await launch()
  step('launched', JSON.stringify({ pid: session.app.process()?.pid ?? null, instancesThisRun }))
  const { page } = session
  await openSeededProject(page)
  const entered = await enterProject(page)
  step('entered', JSON.stringify({ entered }))
  const seeded = await appDb('seed-ch6-draft', { body: CH6_BODY })
  step('seed-ch6-draft', JSON.stringify(seeded))
  const hook = await appDb('hook-text')
  step('hook-text', JSON.stringify(hook))

  // 关掉可能的「知道了」提示
  await page.evaluate(() => {
    const node = [...document.querySelectorAll('button')].find(item => (item.textContent ?? '').trim() === '知道了')
    if (node) node.click()
  })
  await page.waitForTimeout(800)
  // 进「小说」→ 点第 6 章卡片 → 打开草稿编辑器
  await clickTreeItem(page, '蓝图')
  await page.waitForTimeout(2500)
  const probe = await retryEval(page, () => {
    const out = []
    for (const node of document.querySelectorAll('*')) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (!text.includes('第6章')) continue
      const own = [...node.childNodes].some(child => child.nodeType === 3 && (child.textContent ?? '').includes('第6章'))
      if (!own) continue
      const rect = node.getBoundingClientRect()
      out.push({ tag: node.tagName, cls: node.className?.toString?.().slice(0, 120) ?? '', testid: node.getAttribute('data-testid') ?? '',
        role: node.getAttribute('role') ?? '', text: text.slice(0, 60), w: Math.round(rect.width), h: Math.round(rect.height) })
    }
    return out.slice(0, 12)
  })
  step('probe-ch6-dom', JSON.stringify(probe))
  const hasFinalize = () => page.evaluate(() => [...document.querySelectorAll('button, [role="button"]')]
    .some(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim() === '定稿'))
  const attempts = []
  const tryClick = async (label, mode = 'exact') => {
    const clicked = await page.evaluate(({ label, mode }) => {
      const norm = node => (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      const nodes = [...document.querySelectorAll('button, [role="button"], a, div, li, span')]
      const list = mode === 'exact' ? nodes.filter(node => norm(node) === label) : nodes.filter(node => norm(node).startsWith(label))
      const target = list[list.length - 1]
      if (!target) return false
      target.scrollIntoView?.({ block: 'center' })
      target.click()
      return true
    }, { label, mode })
    await page.waitForTimeout(2000)
    const opened = await hasFinalize()
    attempts.push({ label, mode, clicked, opened })
    return opened
  }
  await tryClick('草稿')
  if (!(await hasFinalize())) await tryClick('草稿_v1')
  if (!(await hasFinalize())) await tryClick('1 稿')
  if (!(await hasFinalize())) await tryClick('第6章 落册', 'prefix')
  step('open-ch6-draft', JSON.stringify(attempts))
  await dumpUi(page, '3-chapter')

  // 定稿
  const finalizeClicked = await clickWhenReady(page, /^定稿$/, 30000)
  step('click-finalize', JSON.stringify({ finalizeClicked }))
  setTimeout(async () => {
    console.error('[live][WATCHDOG] hard timeout, quitting')
    stepLog.push({ name: 'watchdog', detail: 'hard timeout' })
    await quit(session).catch(() => null)
    process.exit(124)
  }, Number(argOf('hard', '260000')))
  await page.waitForTimeout(1200)
  const confirmClicked = await clickWhenReady(page, /^确认定稿$/, 20000)
  await page.waitForTimeout(3000)
  const logExpand = await expandWorkflowLogs(page)
  step('expand-logs', JSON.stringify(logExpand))
  step('click-confirm', JSON.stringify({ confirmClicked }))

  // 采样日志面板：累计含标记的行 + 最大出现次数
  const markerLines = new Set()
  let markerCountMax = 0
  const deadline = Date.now() + Number(argOf('wait', '180000'))
  let settled = false
  while (Date.now() < deadline) {
    const info = await retryEval(page, () => ({
      text: document.body.innerText,
      logs: [...document.querySelectorAll('[data-testid*="log"], .log, pre')].map(node => node.innerText).join('\n'),
    })).catch(() => ({ text: '', logs: '' }))
    const combined = `${info.text}\n${info.logs}`
    for (const line of combined.split(/\r?\n/)) if (line.includes(MARKER)) markerLines.add(line.trim())
    const count = combined.split(MARKER).length - 1
    if (count > markerCountMax) markerCountMax = count
    if (count === 0 && Date.now() > deadline - Number(argOf('wait', '180000')) + 20000) await expandWorkflowLogs(page).catch(() => null)
    if (markerCountMax > 0 && /定稿完成|已定稿/.test(combined)) { settled = true; break }
    if (markerCountMax === 0 && /钩子未落地体检跳过|定稿内容已提交/.test(combined) && Date.now() > deadline - 120000) { /* keep waiting */ }
    await page.waitForTimeout(1000)
  }
  const finalText = await retryEval(page, () => document.body.innerText).catch(() => '')
  fs.writeFileSync(path.join(runRoot, 'final-body.txt'), finalText, 'utf8')
  await page.screenshot({ path: path.join(runRoot, 'final.png') }).catch(() => null)

  const after = await appDb('read-state').catch(error => ({ ok: false, error: String(error?.message ?? error) }))
  step('read-state-after', JSON.stringify(after))
  const markerLinesArr = [...markerLines]
  const evidence = {
    judgementSha: '89868921', treeHead: exec('git rev-parse --short HEAD'), distIndexMtime: fs.statSync(path.join(REPO, 'dist', 'index.html')).mtime.toISOString(),
    marker: MARKER, markerLineCount: markerLinesArr.length, markerCountMax, markerCountFinalBody: finalText.split(MARKER).length - 1,
    markerLines: markerLinesArr, settled, openAttempts: attempts, finalizeClicked, confirmClicked,
    ch6Body: CH6_BODY, ch6BodyLen: CH6_BODY.length, hookText: hook?.suspenseHook ?? null,
    draftsAfter: after?.drafts ?? null,
  }
  fs.writeFileSync(path.join(runRoot, 'evidence-s6-d18.json'), JSON.stringify(evidence, null, 2), 'utf8')
  console.log('[judge]', JSON.stringify(evidence, null, 2).slice(0, 2000))
  exitCode = markerLinesArr.length === 1 ? 0 : 3
}

function exec(command) {
  const args = command.split(' ')
  try { return execFileSync(args[0], args.slice(1), { cwd: REPO, encoding: 'utf8' }).trim() } catch { return null }
}

main()
  .catch(error => { console.error('[live][FAIL]', error); stepLog.push({ name: 'error', detail: String(error?.stack ?? error) }); exitCode = 1 })
  .finally(async () => {
    const closed = await quit(session)
    const tasklist = tasklistElectron()
    const leftover = leftoverElectronProcesses()
    const evidence = { runId, mode: MODE, judgementSha: '89868921', repo: REPO, projectPath: PROJ,
      instancesThisRun, exitCode, leftoverElectronProcesses: leftover, ...tasklist, closed, steps: stepLog }
    fs.mkdirSync(runRoot, { recursive: true })
    fs.writeFileSync(path.join(runRoot, 'evidence.json'), JSON.stringify(evidence, null, 2), 'utf8')
    console.log(JSON.stringify({ runId, instancesThisRun, exitCode, leftoverElectronProcesses: leftover,
      tasklistGrepCount: tasklist.tasklistGrepCount }, null, 2))
    process.exit(exitCode)
  })
