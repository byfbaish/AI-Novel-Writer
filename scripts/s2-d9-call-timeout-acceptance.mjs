/* global process */
/**
 * D9 实机验收：单次调用超时三态（生成中 / 超时已中止 / 调用失败）。
 *
 * 判据来自 `.batch/night/cards/s2-d9-call-timeout.md` §5：
 *  1 实机一次真超时中止（命令原文 + 起止时间戳 + 末行 JSON）
 *  2 `generation_roots.blocked_code = GENERATION_CALL_TIMEOUT`、该 run 终态失败
 *  3 三态可辨（界面文案各不相同，贴中英原文与触发条件）
 *  4 预算剩余小于上限时归 ROOT_BUDGET_EXHAUSTED（单测覆盖，见
 *    `electron/services/__tests__/generation-run-service.call-timeout.test.ts`）
 *  5 单测 + 整文件汇总行 + check:fast（本脚本不负责）
 *
 * 取证方式与 D12 脚本同构：真实 Electron（dist 构建）+ 真实 SQLite，`globalThis.fetch`
 * 在主进程内换成合成响应，任何真实出网请求一律抛错。**唯一差别**是超时上限：
 * 通过 `AI_NOVEL_CALL_TIMEOUT_CAP_MS`（生产不设，回落 10 分钟）把上限压到秒级，
 * 否则一次验收要真等 10 分钟。
 *
 * 三档在同一项目、同一章（第 2 章）上串跑，失败后重试即可重新触发：
 *  - `timeout`：正文请求永不返回 → 到上限由 watchdog 记 timed-out → block GENERATION_CALL_TIMEOUT
 *  - `failure`：正文请求返回 HTTP 500 → 真正的「调用失败」
 *  - `generating`：不是独立一档，取 `timeout` 档到点前 800ms 的界面读数
 */
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runId = randomUUID().slice(0, 12)
const runRoot = path.join(repository, '.runtime', '.cache', 's2-d9', runId)
const scratch = path.join(runRoot, 'scratch')
const roots = Object.fromEntries(['canonical', 'legacy', 'userData', 'home', 'appData', 'localAppData']
  .map(name => [name, path.join(scratch, name)]))
// 项目路径硬上限 85 字符（ProjectStoragePreflight），项目落短根目录。
const projectsRoot = path.join(process.env.LOCALAPPDATA ?? scratch, 'VibeCodingScratch', 'd9')
roots.projects = path.join(projectsRoot, `p${runId.slice(0, 6)}`)
const evidencePath = path.join(runRoot, 'evidence.json')
const projectName = 'd9'
const CAP_MS = Number(process.env.AI_NOVEL_CALL_TIMEOUT_CAP_MS ?? 2500)
let productionHelpers
async function helpers() {
  if (!productionHelpers) {
    const { build } = await import('esbuild')
    const bundled = await build({ stdin: { contents: "export { countDraftUnits } from './src/shared/draft-units.ts'",
      resolveDir: repository }, bundle: true, platform: 'node', format: 'esm', write: false })
    productionHelpers = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
  }
  return productionHelpers
}
const sha256 = text => createHash('sha256').update(text).digest('hex')
const stepLog = []
const step = (name, detail = '') => { stepLog.push({ name, at: new Date().toISOString(), detail }); console.log(`[d9] ${name}${detail ? ` · ${detail}` : ''}`) }

const model = { id: 'd9-synthetic', name: 'D9 合成流式模型', provider: 'openai', protocol: 'openai', modelName: 'gpt-4.1',
  baseUrl: 'https://api.openai.com/v1', apiKey: 'd12-synthetic-key', maxTokens: 4096, temperature: 0.7, purposes: ['generation'] }

// ---------------------------------------------------------------- 夹具文本
const CH1_PARAGRAPHS = Array.from({ length: 24 }, (_, index) => {
  const stem = String.fromCharCode(0x4e00 + index * 11)
  return `第${index + 1}日，${stem}${stem}还在港口等风，林岚把日志压在膝上，逐页核对潮汐刻度，岸灯在水面碎成细线。`
})
const CH1_CONTENT = CH1_PARAGRAPHS.join('\n')
const OUTLINE_TEXT = ['第2章细纲：林岚沿北岸石阶向东，发现退潮后露出的暗门，门内是被搬空的账房，账本只剩半页。',
  '要点：时间线接第1章次日清晨；场景为北岸石阶与暗门内账房；出场人物林岚、周砚；结尾停在她读到半页账本的最后一行。'].join('\n')
const NOTES = ['一、时间线：第1章次日清晨，潮退至最低。',
  '二、场景：北岸石阶、暗门内账房。',
  '三、人物：林岚（寡言、认死理）、周砚（圆滑、爱试探）。',
  '四、道具：日志、半页账本。',
  '五、悬念：账本最后一行被人为撕去。',
  '六、禁忌：不写超自然解释。'].join('\n')
const CARDS_JSON = '{"characters":[]}'

// ---------------------------------------------------------------- 合成模型拦截
async function launch() {
  const env = { ...process.env, AI_NOVEL_APP_DATA_HOME: roots.canonical,
    AI_NOVEL_LEGACY_SOURCE_HOME: roots.legacy, AI_NOVEL_VELA_HOME: roots.legacy,
    HOME: roots.home, USERPROFILE: roots.home, APPDATA: roots.appData, LOCALAPPDATA: roots.localAppData,
    // 唯一注入点：把 10 分钟压到 CAP_MS，生产不设这个变量。
    AI_NOVEL_CALL_TIMEOUT_CAP_MS: String(CAP_MS) }
  for (const name of ['ELECTRON_RUN_AS_NODE', 'VITE_DEV_SERVER_URL', 'AI_NOVEL_SMOKE_OPEN_PROJECT', 'AI_NOVEL_SMOKE_PROJECT_MARKER']) delete env[name]
  const app = await electron.launch({ cwd: repository, args: ['.', `--user-data-dir=${roots.userData}`], env, timeout: 60_000 })
  await app.evaluate(async (_, fixture) => {
    const text = body => {
      const messages = Array.isArray(body?.messages) ? body.messages : []
      return messages.map(message => typeof message?.content === 'string'
        ? message.content
        : Array.isArray(message?.content)
          ? message.content.map(part => part?.text ?? '').join('')
          : JSON.stringify(message?.content ?? '')).join('\n')
    }
    const state = globalThis.__d9 = { physicalModelRequests: 0, intercepted: [], unclassified: 0,
      embeddings: 0, outlineCalls: 0, draftCalls: 0, band: 'timeout', bands: ['timeout', 'failure'] }
    const classify = prompt => {
      if (prompt.includes('只写短细纲')) { state.outlineCalls += 1; return 'outline' }
      if (prompt.includes('上一章最后约 300 字')) { state.outlineCalls += 1; return 'outline' }
      if (prompt.includes('结构化章节要点')) return 'notes'
      if (prompt.includes('JSON 格式返回在本章中发生状态变化的角色')) return 'cards'
      if (prompt.startsWith('你是一位经验丰富的小说作者')) { state.draftCalls += 1; return 'draft' }
      if (prompt.includes('【修正说明】')) { state.draftCalls += 1; return 'draft' }
      return 'unknown'
    }
    const sse = chunkBody => new Response(
      chunkBody.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('')
        + `data: {"choices":[],"usage":{"prompt_tokens":40,"completion_tokens":400,"total_tokens":440}}\n\n`
        + 'data: [DONE]\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    )
    globalThis.fetch = async (url, init) => {
      const target = String(url)
      if (target.endsWith('/v1/embeddings') && target.startsWith('https://api.openai.com')) {
        state.embeddings += 1
        const request = JSON.parse(String(init?.body ?? '{}'))
        const inputs = Array.isArray(request.input) ? request.input : [request.input]
        return new Response(JSON.stringify({ data: inputs.map((_, index) => ({ index, embedding: [0.1, 0.2, 0.3] })) }),
          { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (target !== 'https://api.openai.com/v1/chat/completions') {
        state.physicalModelRequests += 1
        throw new Error('S2_D9_EXTERNAL_FETCH_REFUSED')
      }
      const body = JSON.parse(String(init?.body ?? '{}'))
      const prompt = text(body)
      const mode = classify(prompt)
      const band = state.band
      state.intercepted.push({ band, mode, stream: body.stream === true, at: Date.now(),
        promptHead: prompt.slice(0, 80), promptLength: prompt.length })
      if (mode === 'unknown') { state.unclassified += 1 }
      if (mode === 'outline') return sse([{ choices: [{ delta: { content: fixture.outline }, finish_reason: 'stop' }] }])
      if (mode === 'notes' || mode === 'cards') {
        const content = mode === 'notes' ? fixture.notes : fixture.cards
        return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 40, completion_tokens: 400, total_tokens: 440 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (mode === 'draft') {
        if (band === 'failure')
          return new Response(JSON.stringify({ error: { message: 'synthetic provider failure', type: 'server_error' } }),
            { status: 500, headers: { 'Content-Type': 'application/json' } })
        // band === 'timeout'：永不返回，等主进程到点中止。
        return new Promise(() => {})
      }
      return sse([{ choices: [{ delta: { content: '' }, finish_reason: 'stop' }] }])
    }
  }, { outline: OUTLINE_TEXT, notes: NOTES, cards: CARDS_JSON })
  const logLines = []
  const capture = chunk => { for (const line of String(chunk).split(/\r?\n/)) if (line.trim()) logLines.push(line) }
  app.process()?.stdout?.on('data', capture)
  app.process()?.stderr?.on('data', capture)
  globalThis.__d9Log = logLines
  const page = await app.firstWindow({ timeout: 60_000 })
  page.setDefaultTimeout(30_000)
  await page.locator('.app-skin-root').waitFor({ state: 'visible', timeout: 60_000 })
  return { app, page, logLines }
}

async function invoke(page, channel, ...args) {
  return page.evaluate(({ channel, args }) => window.aiNovelAPI.invoke(channel, ...args), { channel, args })
}

async function quit(session) {
  if (!session?.app) return
  const app = session.app
  try {
    await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 20_000))])
  } catch { /* already gone */ }
  try { app.process()?.kill() } catch { /* already gone */ }
}

async function writerShell(page) {
  await page.waitForFunction(() => localStorage.getItem('ai-novel-writer-appearance') !== null, null, { timeout: 60_000 })
  await page.evaluate(() => {
    const key = 'ai-novel-writer-appearance'
    const current = JSON.parse(localStorage.getItem(key))
    localStorage.setItem(key, JSON.stringify({ ...current, shellPreference: 'writer', revision: Number(current.revision ?? 0) + 1,
      origin: 'author' }))
  })
  await page.reload()
  await page.locator('[data-shell-presentation="writer"]').first().waitFor({ state: 'visible', timeout: 60_000 })
}

async function appDb(app, task, payload = {}) {
  return app.evaluate(async (_, args) => {
    const requireFromRepo = process.mainModule.constructor.createRequire(process.cwd() + '/package.json')
    const path = requireFromRepo('node:path')
    const Database = requireFromRepo('better-sqlite3')
    const db = new Database(path.join(args.projectPath, '.ai-novel', 'project.db'), { fileMustExist: true, timeout: 20_000 })
    db.pragma('busy_timeout = 20000')
    try {
      if (args.task === 'seed') {
        const hasStoryDay = db.prepare('PRAGMA table_info(summary_snapshots)').all().some(column => column.name === 'story_day_offset')
        const meta = db.prepare("SELECT generation FROM continuity_projection_meta WHERE id='main'").get()
        if (!meta) throw new Error('continuity_projection_meta(main) 缺失')
        db.prepare(`INSERT INTO summary_snapshots
          (draft_id, chapter_number, chapter_notes, continuity_facts, character_state_candidates,
           source_finalization_id, source_content_hash, projection_generation${hasStoryDay ? ', story_day_offset, story_day_label' : ''})
          VALUES (@draftId, 1, @notes, '[]', '[]', @finalizationId, @contentHash, @generation${hasStoryDay ? ', 0, @label' : ''})`)
          .run({ draftId: args.payload.draftId, notes: args.payload.notes, finalizationId: args.payload.finalizationId,
            contentHash: args.payload.contentHash, generation: Number(meta.generation) + 1, label: '初七' })
        return db.prepare('SELECT id, chapter_number AS chapter, length(chapter_notes) AS notesLength FROM summary_snapshots').all()
      }
      if (args.task === 'characters') {
        const insert = db.prepare(`INSERT OR IGNORE INTO characters (name, role, personality, motivation, cs_updated_at_chapter)
          VALUES (?, ?, ?, ?, 1)`)
        for (const entry of args.payload.entries) insert.run(entry.name, entry.role, entry.personality, entry.motivation)
        return db.prepare('SELECT name, role FROM characters ORDER BY name').all()
      }
      if (args.task === 'read') {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'generation%'").all().map(row => row.name)
        const roots = tables.includes('generation_roots')
          ? db.prepare('SELECT * FROM generation_roots').all().map(row => ({ rootId: row.root_action_id, blockedCode: row.blocked_code ?? null,
            activeElapsedMs: row.active_elapsed_ms ?? null, keys: Object.keys(row) }))
          : []
        const runs = tables.includes('generation_runs')
          ? db.prepare('SELECT * FROM generation_runs').all().map(row => ({ runId: row.run_id, rootId: row.root_action_id, status: row.status ?? null }))
          : []
        return {
          tables,
          roots,
          runs,
          drafts: db.prepare('SELECT id, chapter_number AS chapter, version, status FROM drafts ORDER BY id').all(),
          candidates: tables.includes('recovery_candidates')
            ? db.prepare('SELECT chapter_number AS chapter, failure_code AS failureCode, status FROM recovery_candidates ORDER BY created_at').all()
            : [],
        }
      }
      throw new Error(`unknown task ${args.task}`)
    } catch (error) {
      return { ok: false, error: `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}` }
    } finally { db.close() }
  }, { projectPath: payload.projectPath, task, payload: payload.payload ?? {} })
}

/** 面板读数：`role=alert` 内是失败文案 + 错误码；运行态没有 alert，改用转圈图标 + 进度行取证。 */
async function readPanel(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.writer-ai-panel')
    const alerts = [...document.querySelectorAll('[role="alert"]')].map(node => node.innerText)
    const spinners = document.querySelectorAll('.writer-ai-panel .animate-spin').length
    const progress = [...document.querySelectorAll('.writer-ai-panel *')]
      .map(node => node.textContent ?? '')
      .filter(text => /^\s*\d+\s*\/\s*\d+\s*$/.test(text))
      .map(text => text.trim())
    return { panelText: panel ? panel.innerText : '', alerts, spinners, progress }
  })
}

async function waitForAlert(page, timeoutMs, previousText = '') {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const read = await readPanel(page)
    const current = read.alerts.filter(text => text.trim()).join('\n---\n')
    if (current && current !== previousText) return read
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  return readPanel(page)
}

/** 等主进程真的发出该档的正文请求，避免把上一档残留的 alert 当成本档结果。 */
async function waitForBandRequest(app, band, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const seen = await app.evaluate((_, name) => (globalThis.__d9.intercepted ?? [])
      .filter(entry => entry.band === name).map(entry => entry.mode), band).catch(() => [])
    if (seen.length > 0) return seen
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  return []
}

function leftoverElectronProcesses() {
  try {
    const output = execFileSync('powershell', ['-NoProfile', '-Command',
      `(Get-CimInstance Win32_Process -Filter "name='electron.exe'" | Where-Object { $_.CommandLine -like '*${roots.userData.replace(/\\/g, '\\\\')}*' } | Measure-Object).Count`],
    { encoding: 'utf8' })
    return Number(output.trim())
  } catch {
    return -1
  }
}

async function main() {
  const { countDraftUnits } = await helpers()
  assert.ok(fs.existsSync(path.join(repository, 'dist-electron', 'main.js')), 'dist-electron/main.js 缺失：先运行 npx vite build')
  assert.ok(fs.existsSync(path.join(repository, 'dist', 'index.html')), 'dist/index.html 缺失：先运行 npx vite build')
  for (const directory of Object.values(roots)) fs.mkdirSync(directory, { recursive: true })
  let session
  let projectPath
  const out = { runId, projectName, projectPath: null, capMs: CAP_MS, startedAt: new Date().toISOString(),
    bands: [], db: null, mainState: null, checks: {}, instancesThisRun: 1, exitCode: null, leftoverElectronProcesses: null }
  try {
    step('launch-1')
    session = await launch()
    await writerShell(session.page)
    const grant = await import('./project-directory-grant.mjs').then(module => module.chooseProjectDirectoryGrant(session.app, session.page, roots.projects))
    const created = await invoke(session.page, 'project:create', { parentGrantId: grant.grantId, name: projectName,
      genre: '悬疑', targetAudience: '成年读者', writingLanguage: 'zh-CN' }, randomUUID(), null)
    assert.equal(created.success, true, created.error)
    projectPath = created.projectPath
    out.projectPath = projectPath
    const opened = await invoke(session.page, 'project:open', projectPath, randomUUID(), null)
    assert.equal(opened.success, true, opened.error)
    const context = { projectId: created.projectId, projectPath, leaseId: opened.project.sessionLease }
    assert.equal((await invoke(session.page, 'llm:save-model', model)).success, true)
    assert.equal((await invoke(session.page, 'llm:set-default-model', model.id)).success, true)
    for (const chapter of [{ chapterNumber: 1, title: '港口', role: '开端', purpose: '核对潮汐刻度', keyEvents: '林岚在南港核对日志' },
      { chapterNumber: 2, title: '北岸', role: '发展', purpose: '沿岸寻找暗门', keyEvents: '林岚与同伴找到石墙暗门' }]) {
      const saved = await invoke(session.page, 'db:blueprint-upsert', { ...chapter, characters: [] }, projectPath, context)
      assert.equal(saved.success, true, saved.error)
    }
    step('import-chapter-1')
    const imported = await invoke(session.page, 'db:draft-import-finalized-batch', { operationId: randomUUID(),
      chapters: [{ chapterNumber: 1, title: '港口', content: CH1_CONTENT, wordCount: countDraftUnits(CH1_CONTENT) }] }, projectPath, context)
    assert.equal(imported.success, true, imported.error)
    const receipt = imported.receipt
    const importedDraft = receipt.drafts.find(entry => entry.chapterNumber === 1)
    step('seed-notes')
    out.characters = await appDb(session.app, 'characters', { projectPath, payload: { entries: [
      { name: '林岚', role: 'protagonist', personality: '寡言、认死理', motivation: '找回失踪的妹妹' },
      { name: '周砚', role: 'supporting', personality: '圆滑、爱试探', motivation: '守住港口的账本' },
    ] } })
    out.seeded = await appDb(session.app, 'seed', { projectPath, payload: { draftId: importedDraft.draftId,
      finalizationId: importedDraft.finalizationId, contentHash: importedDraft.contentHash, notes: NOTES } })
    assert.ok(Array.isArray(out.seeded) && out.seeded[0]?.notesLength > 0, `写要点失败：${JSON.stringify(out.seeded)}`)
    await writerShell(session.page)
    const notice = session.page.getByRole('button', { name: '知道了' })
    if (await notice.isVisible()) await notice.click()

    await session.page.locator('.writer-shelf').getByRole('button', { name: `打开《${projectName}》` }).click()
    await session.page.locator('.writer-project-tree').getByText(projectName, { exact: true }).waitFor({ state: 'visible', timeout: 60_000 })
    await session.page.locator('.writer-project-tree').getByText('章节蓝图', { exact: true }).click()
    const writeButton = session.page.getByRole('button', { name: '写作第2章' })
    await writeButton.waitFor({ state: 'visible', timeout: 60_000 })

    // ---------- 三档串跑：同一章、同一命令层，失败后重试重新触发 ----------
    let previousAlertText = ''
    for (const band of ['timeout', 'failure']) {
      await session.app.evaluate((_, name) => { globalThis.__d9.band = name }, band)
      const startedAt = new Date().toISOString()
      const writeState = { visible: await writeButton.isVisible().catch(() => false),
        disabled: await writeButton.isDisabled().catch(() => null) }
      step(`band:${band}:submit`, `write visible=${writeState.visible} disabled=${writeState.disabled}`)
      await writeButton.click()
      const dialog = session.page.getByRole('dialog')
      await dialog.getByPlaceholder('3000').fill('200')
      await dialog.getByRole('button', { name: '开始创作' }).click()

      // 采样运行态：转圈图标出现、alert 尚未出现的时刻就是「生成中」这一态的界面读数。
      const samples = []
      let sampling = true
      const sampler = (async () => {
        while (sampling) {
          const read = await readPanel(session.page).catch(() => null)
          if (read) samples.push({ at: new Date().toISOString(), spinners: read.spinners, progress: read.progress,
            alertCount: read.alerts.filter(text => text.trim()).length })
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      })()
      const requestModes = await waitForBandRequest(session.app, band, 60_000)
      step(`band:${band}:request`, `modes=${requestModes.join(',')}`)
      const read = await waitForAlert(session.page, 120_000, previousAlertText)
      sampling = false
      await sampler
      const finishedAt = new Date().toISOString()
      const alertText = read.alerts.filter(text => text.trim()).join('\n---\n')
      const codeLine = (alertText.match(/错误码：\s*([A-Z_]+)/) ?? [])[1] ?? null
      const generatingSamples = samples.filter(sample => sample.alertCount === 0 && sample.spinners > 0)
      out.bands.push({ band, startedAt, finishedAt, capMs: CAP_MS, writeState,
        sampleCount: samples.length, generatingSamples: generatingSamples.slice(0, 3),
        generatingSpinners: Math.max(0, ...samples.map(sample => sample.spinners)),
        alertText, codeLine, panelText: read.panelText })
      step(`band:${band}:alert`, `code=${codeLine} generating=${generatingSamples.length}/${samples.length}samples`)
      previousAlertText = alertText
      // 让面板回到可再次提交的状态：Esc 关掉可能残留的对话框，不用点按钮（点错会触发导航）。
      await session.page.keyboard.press('Escape').catch(() => {})
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    out.mainState = await session.app.evaluate(() => ({
      physicalModelRequests: globalThis.__d9.physicalModelRequests,
      embeddings: globalThis.__d9.embeddings,
      unclassified: globalThis.__d9.unclassified,
      intercepted: globalThis.__d9.intercepted,
    }))
    out.db = await appDb(session.app, 'read', { projectPath })
    out.finishedAt = new Date().toISOString()

    const timeoutBand = out.bands.find(entry => entry.band === 'timeout')
    const failureBand = out.bands.find(entry => entry.band === 'failure')
    const rootsWithTimeout = (out.db.roots ?? []).filter(row => row.blockedCode === 'GENERATION_CALL_TIMEOUT')
    out.checks = {
      'capInjected': CAP_MS !== 600_000,
      'timeoutBlockedCode': rootsWithTimeout.length > 0,
      'timeoutRunSettledFailed': (out.db.runs ?? []).some(row => row.status && row.status !== 'running'),
      'timeoutCopy': /调用超时已中止|Call stopped after timeout/.test(timeoutBand?.alertText ?? ''),
      'failureCopy': /调用失败|Call failed|工作流未完成|Workflow did not finish/.test(failureBand?.alertText ?? ''),
      'failureDistinctFromTimeout': failureBand?.codeLine !== timeoutBand?.codeLine,
      'generatingReadBeforeTimeout': Boolean(timeoutBand?.generatingSamples?.length),
      'noExternalFetch': out.mainState.physicalModelRequests === 0,
      'noUnclassifiedRequest': out.mainState.unclassified === 0,
    }
    // 实现口径的记录项（不计入通过判据）：超时档的码走 transport diagnostics（
    // `activityDiagnostics.failureCode`）而不是 `error.code`，所以该档界面没有「错误码：」行；
    // 调用失败档的码来自 `error.code`，两档因此行为不同。
    out.observations = {
      timeoutRendererCodeLine: timeoutBand?.codeLine ?? null,
      failureRendererCodeLine: failureBand?.codeLine ?? null,
      timeoutAlertText: timeoutBand?.alertText ?? null,
      failureAlertText: failureBand?.alertText ?? null,
      blockedCodes: (out.db.roots ?? []).map(row => row.blockedCode),
      runStatuses: (out.db.runs ?? []).map(row => row.status),
    }
  } catch (error) {
    out.error = `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}`
    if (session) {
      out.failurePanel = await readPanel(session.page).catch(() => null)
      out.failureMainState = await session.app.evaluate(() => window.__d9 ?? globalThis.__d9).catch(() => null)
    }
    process.exitCode = 1
  } finally {
    if (session) await quit(session)
    out.leftoverElectronProcesses = leftoverElectronProcesses()
    out.finishedAt = out.finishedAt ?? new Date().toISOString()
    out.ok = !out.error && Object.values(out.checks).every(Boolean)
    out.stepLog = stepLog
    fs.mkdirSync(runRoot, { recursive: true })
    fs.writeFileSync(evidencePath, JSON.stringify(out, null, 2), 'utf8')
    console.log(JSON.stringify({ ok: out.ok, runId, evidencePath, capMs: CAP_MS, checks: out.checks,
      codes: out.bands.map(entry => `${entry.band}:${entry.codeLine}`), blocked: (out.db?.roots ?? []).map(row => row.blockedCode),
      instancesThisRun: out.instancesThisRun, leftoverElectronProcesses: out.leftoverElectronProcesses,
      error: out.error ?? null }))
    out.exitCode = process.exitCode ?? 0
    if (!out.ok) process.exitCode = 1
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

await main()
process.exit(process.exitCode ?? 0)
