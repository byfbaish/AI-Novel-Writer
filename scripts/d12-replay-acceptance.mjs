/* global process */
/**
 * D12 实机验收：第 2 章首稿重演上一章结尾 → 带原因整章重写一次 → 首稿/重写稿的处置取证。
 *
 * 判据全部来自 `.batch/night/cards/d12-replay-retry.md` §4.3。取证方式：
 *  - 真实 Electron（dist 构建）+ 真实 SQLite/LanceDB，`globalThis.fetch` 在主进程内换成
 *    合成 SSE 响应，任何真实出网请求一律抛错（`physicalModelRequests` 只在拦截器里计数）。
 *  - 第 1 章定稿用 `db:draft-import-finalized-batch`（既有、有授权的定稿导入 seam）落盘，
 *    六栏要点写入 `summary_snapshots`（定稿后处理那条链在裸 IPC 下被
 *    `GENERATION_FINALIZATION_ADMISSION_REQUIRED` 挡住，见 electron/controllers/db-controller.ts:938）。
 *  - 第 2 章必须走渲染层的 `GenerateDraftCommand`（`写作此章` → `开始创作`），
 *    因为重写逻辑在命令层；`generation:*` 直调会绕过它。
 */
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runId = randomUUID().slice(0, 12)
const runRoot = path.join(repository, '.runtime', '.cache', 'd12-replay', runId)
const scratch = path.join(runRoot, 'scratch')
const roots = Object.fromEntries(['canonical', 'legacy', 'userData', 'home', 'appData', 'localAppData']
  .map(name => [name, path.join(scratch, name)]))
// 项目路径硬上限 85 字符（ProjectStoragePreflight），所以项目落在短根目录下，不跟 runRoot 走深路径。
const projectsRoot = path.join(process.env.LOCALAPPDATA ?? scratch, 'VibeCodingScratch', 'd12')
roots.projects = path.join(projectsRoot, `p${runId.slice(0, 6)}`)
const evidencePath = path.join(runRoot, 'evidence.json')
const projectName = 'd12'
const Database = createRequire(import.meta.url)('better-sqlite3')
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
const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const keepArtifacts = process.argv.includes('--keep')
const stepLog = []
const step = (name, detail = '') => { stepLog.push({ name, at: new Date().toISOString(), detail }); console.log(`[d12] ${name}${detail ? ` · ${detail}` : ''}`) }

const model = { id: 'd12-synthetic', name: 'D12 合成流式模型', provider: 'openai', protocol: 'openai', modelName: 'gpt-4.1',
  baseUrl: 'https://api.openai.com/v1', apiKey: 'd12-synthetic-key', maxTokens: 4096, temperature: 0.7, purposes: ['generation'] }

// ---------------------------------------------------------------- 夹具文本
const CH1_PARAGRAPHS = Array.from({ length: 24 }, (_, index) => {
  const stem = String.fromCharCode(0x4e00 + index * 11)
  return `第${index + 1}日，${stem}${stem}还在港口等风，林岚把日志压在膝上，逐页核对潮汐刻度，岸灯在水面碎成细线。`
})
const CH1_CONTENT = CH1_PARAGRAPHS.join('\n')
const CH1_TAIL = CH1_CONTENT.slice(-300)

const NOTES = [
  '# 第1章 港口 要点',
  '## 时间定位',
  '- 故事日：0',
  '- 书中写法：初七',
  '- 依据：正文「港口等风」当日为开篇第一日',
  '## 空间锚点',
  '- 场景：南港·旧码头',
  '## 剧情节点',
  '- [触发] 林岚在南港码头核对日志上的潮汐刻度',
  '- [结果] 林岚记下北岸退潮时段，决定次日沿岸查看',
  '## 角色动态',
  '| 角色 | 本章变化/状态 |',
  '|------|-------------|',
  '| 林岚 | 已在南港码头核完潮汐刻度，日志随身 |',
  '| 守塔人 | 只远远看过一眼，未与林岚交谈 |',
  '## 新增设定',
  '- 南港以岸灯与潮汐刻度记录进出船只',
  '## 伏笔与钩子',
  '- [埋] 日志末页夹着一角旧航线图，标着北岸暗门',
].join('\n')

const OUTLINE_TEXT = [
  '第 1 段（约 900 字）：林岚带同伴从旧码头出发，沿北岸礁石向东，途中停下核对手里的日志；这一段停在看清石墙轮廓之前。',
  '第 2 段（约 900 字）：退潮后石墙露出半截，众人固定绳索并对照旧航线图确定入口；这一段停在绳结打好、准备进入。',
  '第 3 段（约 1200 字）：两人进入通道前段，记下岔路与通风口方位，把发现写进日志；这一段停在决定次日前再深入。',
].join('\n')

const REPLAY_PROSE = `${CH1_TAIL}\n林岚把日志合上，抬头看向北岸。潮水已经退去，礁石露出一道旧航道。同伴核对刻度，确认石墙还在原处。两人固定绳索，把方位记进日志，约好天亮再进通道。`
const CLEAN_PROSE = '潮水退到礁石以下时，林岚已经站在北岸。她把绳索绕上铁环，示意同伴压低身子。石墙上的刻痕被盐霜填满，两人用刀背一点点刮开，露出朝内的缝隙。缝隙里透出陈旧的风，带着铁锈与湿木的味道。她先探手进去，摸到一段向下的台阶，便让同伴在入口留下绳结。'
const CARDS_JSON = JSON.stringify({ characters: [] })

// ---------------------------------------------------------------- 统计工具（与单测同口径）
const SIX_COLUMN_HEADINGS = ['## 时间定位', '## 空间锚点', '## 剧情节点', '## 角色动态', '## 新增设定', '## 伏笔与钩子']
const units = text => [...text].length
function sectionOf(text, heading) {
  const start = text.indexOf(heading)
  if (start < 0) return ''
  const rest = text.slice(start + heading.length)
  const next = rest.search(/\n## /)
  return next < 0 ? rest : rest.slice(0, next)
}
function dataRowCount(notes) {
  return sectionOf(notes, '## 角色动态').split('\n').map(line => line.trim())
    .filter(line => line.startsWith('|') && !/^\|[\s:-]+\|/.test(line)).length - 1
}
function hookItemCount(notes) {
  return sectionOf(notes, '## 伏笔与钩子').split('\n').map(line => line.trim())
    .filter(line => line.startsWith('- ')).length
}
function windows(text, size) {
  const result = []
  for (let index = 0; index + size <= text.length; index += 1) result.push(text.slice(index, index + size))
  return result
}
function longestSharedRun(source, target, cap = 400) {
  let best = 0
  for (let size = cap; size >= 1; size -= 1) {
    if (windows(source, size).some(window => target.includes(window))) { best = size; break }
  }
  return best
}

// ---------------------------------------------------------------- 合成模型拦截
async function launch(responsePlan) {
  const env = { ...process.env, AI_NOVEL_APP_DATA_HOME: roots.canonical,
    AI_NOVEL_LEGACY_SOURCE_HOME: roots.legacy, AI_NOVEL_VELA_HOME: roots.legacy,
    HOME: roots.home, USERPROFILE: roots.home, APPDATA: roots.appData, LOCALAPPDATA: roots.localAppData }
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
    const state = globalThis.__d12 = { physicalModelRequests: 0, intercepted: [], unclassified: 0,
      composeCalls: 0, embeddings: 0, cleanCalls: 0, replayCalls: 0, draftCalls: 0 }
    // 正文请求（首稿 / 带原因重跑 / 分段续写）共用一个 system 开头，靠调用次序区分：
    // 第 1 次正文请求返回「重演上一章结尾」的稿子，之后每次都返回干净的推进稿。
    const classify = prompt => {
      if (prompt.includes('只写短细纲')) return 'outline'
      if (prompt.includes('上一章最后约 300 字')) return 'outline'
      if (prompt.includes('结构化章节要点')) return 'notes'
      if (prompt.includes('JSON 格式返回在本章中发生状态变化的角色')) return 'cards'
      if (prompt.includes('【修正说明】')) { state.draftCalls += 1; return 'clean' }
      if (prompt.startsWith('你是一位经验丰富的小说作者')) {
        state.draftCalls += 1
        return state.draftCalls === 1 ? 'replay' : 'clean'
      }
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
        throw new Error('D12_EXTERNAL_FETCH_REFUSED')
      }
      const body = JSON.parse(String(init?.body ?? '{}'))
      const prompt = text(body)
      const mode = classify(prompt)
      const messages = Array.isArray(body?.messages) ? body.messages : []
      state.intercepted.push({ mode, prompt, stream: body.stream === true,
        messages: messages.map(message => ({ role: message?.role ?? '?',
          length: text({ messages: [message] }).length,
          head: text({ messages: [message] }).slice(0, 60),
          hasCorrection: text({ messages: [message] }).includes('【修正说明】') })) })
      if (mode === 'unknown') { state.unclassified += 1 }
      let content = mode === 'outline' ? fixture.outline
        : mode === 'notes' ? fixture.notes
          : mode === 'cards' ? fixture.cards
            : mode === 'clean' ? fixture.clean
              : fixture.replay
      // 章目标 100 字：干净稿落在 70–130 之间，既不触发续写（≥85）也不触发压缩（≤130），
      // 因此正文请求恰好两次（首稿 + 带原因重写），签收也恰好一次（compose 只由最终那稿触发）。
      if (mode === 'replay') state.replayCalls += 1
      if (mode === 'clean') state.cleanCalls += 1
      if (body.stream === false || body.stream === undefined) {
        return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 40, completion_tokens: 400, total_tokens: 440 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return sse([{ choices: [{ delta: { content }, finish_reason: 'stop' }] }])
    }
  }, responsePlan)
  const logLines = []
  const capture = chunk => { for (const line of String(chunk).split(/\r?\n/)) if (line.trim()) logLines.push(line) }
  app.process()?.stdout?.on('data', capture)
  app.process()?.stderr?.on('data', capture)
  globalThis.__d12Log = logLines
  const page = await app.firstWindow({ timeout: 60_000 })
  page.on('console', message => logLines.push(`[console.${message.type()}] ${message.text()}`))
  page.setDefaultTimeout(30_000)
  await page.locator('.app-skin-root').waitFor({ state: 'visible', timeout: 60_000 })
  await installPageCounter(page)
  return { app, page }
}

/** 页面重载会丢掉挂在 window 上的计数器，每次 reload 后都要重装。 */
async function installPageCounter(page) {
  await page.evaluate(() => {
    if (globalThis.__d12Page) return
    const calls = []
    globalThis.__d12Page = { calls }
    const api = window.aiNovelAPI
    const original = api.invoke.bind(api)
    api.invoke = async (channel, ...args) => {
      calls.push({ channel, at: Date.now() })
      return original(channel, ...args)
    }
    if (typeof api.invokeWithProjectSession === 'function') {
      const originalScoped = api.invokeWithProjectSession.bind(api)
      api.invokeWithProjectSession = async (channel, ...args) => {
        calls.push({ channel, at: Date.now() })
        return originalScoped(channel, ...args)
      }
    }
  })
}

async function invoke(page, channel, ...args) {
  return page.evaluate(({ channel, args }) => window.aiNovelAPI.invoke(channel, ...args), { channel, args })
}

async function quit(session) {
  if (!session?.app) return
  const app = session.app
  // app.close() 偶发挂住（渲染层还挂着发布流/对话框时 Electron 不退出），超时后强杀，
  // 否则一次成功复验会在收尾这一步白等，证据也写不出来。
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
  await installPageCounter(page)
}

/**
 * 库操作放进主进程做：`better-sqlite3` 是按 Electron ABI 编译的（NODE_MODULE_VERSION 145），
 * 在纯 node 里 require 会 ERR_DLOPEN_FAILED。主进程里 `require` 拿到的是同一个 ABI。
 */
async function appDb(app, task, payload = {}) {
  return app.evaluate(async (_, args) => {
    // 主进程被 bundle 过，顶层没有 require / import：用 Module.createRequire 从仓库根解析。
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
        return {
          drafts: db.prepare('SELECT id, chapter_number AS chapter, version, status FROM drafts ORDER BY id').all(),
          finalizations: db.prepare('SELECT draft_id AS draftId, chapter_title AS title, publication_status AS status FROM finalization_outbox').all(),
          summaries: db.prepare('SELECT id, chapter_number AS chapter, length(chapter_notes) AS notesLength FROM summary_snapshots').all(),
          candidates: db.prepare('SELECT chapter_number AS chapter, failure_code AS failureCode, status FROM recovery_candidates WHERE chapter_number = 2 ORDER BY created_at').all(),
          attempts: db.prepare('SELECT attempt_json AS attemptJson, usage_receipt_json AS receiptJson FROM generation_attempts').all(),
        }
      }
      throw new Error(`unknown task ${args.task}`)
    } catch (error) {
      return { ok: false, error: `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}` }
    } finally { db.close() }
  }, { projectPath: payload.projectPath, task, payload: payload.payload ?? {} })
}

async function main() {
  const { countDraftUnits } = await helpers()
  assert.ok(fs.existsSync(path.join(repository, 'dist-electron', 'main.js')), 'dist-electron/main.js 缺失：先运行 npx vite build')
  assert.ok(fs.existsSync(path.join(repository, 'dist', 'index.html')), 'dist/index.html 缺失：先运行 npx vite build')
  for (const directory of Object.values(roots)) fs.mkdirSync(directory, { recursive: true })
  const responsePlan = { outline: OUTLINE_TEXT, notes: NOTES, cards: CARDS_JSON, replay: REPLAY_PROSE, clean: CLEAN_PROSE }
  let session
  let projectPath
  let receipt
  const out = { runId, projectName, projectPath: null, seeded: null, dispatch: [], evidence: {}, checks: {} }
  try {
    // ---------- 阶段 1：建项目 + 第 1 章定稿导入 ----------
    step('launch-1')
    session = await launch(responsePlan)
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
    receipt = imported.receipt
    assert.equal(receipt.chapters ?? receipt.drafts.length, 1)
    const importedDraft = receipt.drafts.find(entry => entry.chapterNumber === 1)
    out.importedDraft = importedDraft
    // ---------- 阶段 2：写六栏要点（定稿后处理链在裸 IPC 下被授权门挡住） ----------
    step('seed-notes')
    out.characters = await appDb(session.app, 'characters', { projectPath, payload: { entries: [
      { name: '林岚', role: 'protagonist', personality: '寡言、认死理', motivation: '找回失踪的妹妹' },
      { name: '周砚', role: 'supporting', personality: '圆滑、爱试探', motivation: '守住港口的账本' },
    ] } })
    assert.ok(Array.isArray(out.characters) && out.characters.length === 2, `写角色卡失败：${JSON.stringify(out.characters)}`)
    out.seeded = await appDb(session.app, 'seed', { projectPath, payload: { draftId: importedDraft.draftId,
      finalizationId: importedDraft.finalizationId, contentHash: importedDraft.contentHash, notes: NOTES } })
    assert.ok(Array.isArray(out.seeded) && out.seeded.length === 1 && out.seeded[0].notesLength > 0,
      `写要点失败：${JSON.stringify(out.seeded)}`)
    await writerShell(session.page)
    const notice = session.page.getByRole('button', { name: '知道了' })
    if (await notice.isVisible()) await notice.click()

    // ---------- 阶段 3：第 2 章走真实命令层 ----------
    await session.page.locator('.writer-shelf').getByRole('button', { name: `打开《${projectName}》` }).click()
    await session.page.locator('.writer-project-tree').getByText(projectName, { exact: true }).waitFor({ state: 'visible', timeout: 60_000 })
    await session.page.locator('.writer-project-tree').getByText('章节蓝图', { exact: true }).click()
    const writeButton = session.page.getByRole('button', { name: '写作第2章' })
    await writeButton.waitFor({ state: 'visible', timeout: 60_000 })
    step('click-write-chapter-2')
    await writeButton.click()
    const dialog = session.page.getByRole('dialog')
    await dialog.getByPlaceholder('3000').fill('100')
    await dialog.getByRole('button', { name: '开始创作' }).click()
    const marker = CLEAN_PROSE.slice(0, 24)
    const startedAt = Date.now()
    try {
      await session.page.getByText(marker, { exact: false }).first().waitFor({ state: 'visible', timeout: 180_000 })
    } catch (error) {
      // 失败时把界面与主进程侧的现场落成文件，便于事后定位，不污染正常输出。
      const panelText = await session.page.locator('.writer-ai-panel').innerText().catch(() => '<no panel>')
      const mainState = await session.app.evaluate(() => ({
        intercepted: (globalThis.__d12?.intercepted ?? []).map(entry => ({ mode: entry.mode, head: entry.prompt.slice(0, 120),
          tail: entry.prompt.slice(-400), length: entry.prompt.length })),
        physicalModelRequests: globalThis.__d12?.physicalModelRequests,
        unclassified: globalThis.__d12?.unclassified,
      })).catch(err => ({ error: String(err) }))
      const rows = await appDb(session.app, 'read', { projectPath }).catch(err => ({ error: String(err) }))
      const dumpPath = path.join(runRoot, 'failure.json')
      fs.mkdirSync(runRoot, { recursive: true })
      fs.writeFileSync(dumpPath, JSON.stringify({ panelText, mainState, rows }, null, 2), 'utf8')
      console.error(`[d12] failure dump: ${dumpPath}`)
      throw error
    }
    step('clean-prose-visible', `${Date.now() - startedAt}ms`)
    // 等落库：第 2 章出现 draft 行
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const rows = await appDb(session.app, 'read', { projectPath })
      if (rows.drafts.some(row => row.chapter === 2)) break
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    step('draft-persisted')
    out.dispatch = await session.app.evaluate(() => globalThis.__d12.intercepted.map(entry => ({ mode: entry.mode, prompt: entry.prompt,
      stream: entry.stream, messages: entry.messages })))
    // 请求体逐份落盘并记字节数/sha256——卡 §4.3 要求 evidence.json 里两份请求体可回读。
    const requestDir = path.join(runRoot, 'requests')
    fs.mkdirSync(requestDir, { recursive: true })
    out.dispatch = out.dispatch.map((entry, index) => {
      const file = path.join(requestDir, `${String(index + 1).padStart(2, '0')}-${entry.mode}.txt`)
      fs.writeFileSync(file, entry.prompt, 'utf8')
      return { ...entry, bytes: Buffer.byteLength(entry.prompt, 'utf8'), sha256: sha256(entry.prompt), file }
    })
    step('requests-dumped', `${out.dispatch.length} 份 · ${out.dispatch.map(entry => entry.bytes).join('/')}B`)
    out.mainState = await session.app.evaluate(() => ({ physicalModelRequests: globalThis.__d12.physicalModelRequests,
      embeddings: globalThis.__d12.embeddings, unclassified: globalThis.__d12.unclassified }))
    step('main-state')
    out.pageCalls = await session.page.evaluate(() => globalThis.__d12Page.calls.map(entry => entry.channel))
    step('page-calls')
    out.rows = await appDb(session.app, 'read', { projectPath })
    step('rows-read')
    out.appLog = globalThis.__d12Log ?? []
  } finally {
    step('quit')
    await quit(session)
    step('quit-done')
  }

  // ---------------------------------------------------------------- 判据
  const outlineDispatch = out.dispatch.find(entry => entry.mode === 'outline')
  assert.ok(outlineDispatch, '没有抓到短细纲请求')
  const outlinePrompt = outlineDispatch.prompt
  const proseDispatches = out.dispatch.filter(entry => entry.mode === 'replay' || entry.mode === 'clean')
  const initialDispatch = proseDispatches.find(entry => entry.mode === 'replay')
  const retryDispatch = proseDispatches.find(entry => entry.mode === 'clean')
  assert.ok(initialDispatch && retryDispatch, `正文请求数不符：${JSON.stringify(out.dispatch.map(entry => entry.mode))}`)

  const endingBlock = sectionOf(outlinePrompt, '（只用于承接语气、未完成的动作与站位）：').trim().split('\n【')[0].trim()
  const previousMiddle = CH1_CONTENT.slice(0, Math.max(0, CH1_CONTENT.length - 300))
  const midOverlap = longestSharedRun(previousMiddle, outlinePrompt, 200)
  const notesStart = outlinePrompt.indexOf('上一章已完成的事（要点）：')
  const notesEnd = outlinePrompt.indexOf('上一章最后约 300 字')
  const notesBlock = notesStart < 0 || notesEnd <= notesStart
    ? ''
    : outlinePrompt.slice(notesStart + '上一章已完成的事（要点）：'.length, notesEnd)
  // 取不到修正段时显式落空串，不能用 slice(-1)（会取到末字符，让 Boolean(correction) 假真）。
  const correctionAt = retryDispatch.prompt.indexOf('【修正说明】')
  const correction = correctionAt < 0 ? '' : retryDispatch.prompt.slice(correctionAt)
  // compose-visible 的签收证据落在 artifact 所属 attempt 的 usage_receipt_json.visibleComposition 里；
  // 页面里的 window.aiNovelAPI 是 contextBridge 冻结对象，改不动，因此从库里读权威证据。
  const composeCalls = out.rows.attempts.filter(row => String(row.receiptJson ?? '').includes('visibleComposition')).length
  const attemptFacts = out.rows.attempts.map(row => {
    const attempt = JSON.parse(row.attemptJson ?? '{}')
    const receipt = JSON.parse(row.receiptJson ?? '{}')
    return { runId: attempt.runId, purpose: attempt.purpose ?? attempt.binding?.purpose, status: attempt.status,
      failureCode: receipt.result?.failureCode, hasVisibleComposition: Boolean(receipt.visibleComposition) }
  })
  const chapter2Drafts = out.rows.drafts.filter(row => row.chapter === 2)

  const evidence = {
    endingBlockUnits: units(endingBlock),
    // 段缺失时 units('') 会算成 0 直接过半（fail-open），所以另判「段非空」。
    endingBlockNonEmpty: endingBlock.length > 0,
    // 六栏要在要点块里全在；整份 prompt 命中只作对照（模板里也可能出现同名标题）。
    notesSixColumnsPresent: SIX_COLUMN_HEADINGS.every(heading => notesBlock.includes(heading)),
    notesHeadingsInPrompt: SIX_COLUMN_HEADINGS.filter(heading => outlinePrompt.includes(heading)).length,
    notesTableRowsUnchanged: dataRowCount(notesBlock) === dataRowCount(NOTES),
    notesHooksCountUnchanged: hookItemCount(notesBlock) === hookItemCount(NOTES),
    notesBlockUnits: units(notesBlock),
    notesSourceUnits: units(NOTES),
    outlineMidMaxOverlapUnits: midOverlap,
    // 卡面「含上一章全文」：用整段 300 码元结尾做探针，不用只截 120 的短探针。
    proseContainsFullPrevious: initialDispatch.prompt.includes(CH1_TAIL),
    proseDispatches: proseDispatches.length,
    retryHasCorrection: Boolean(correction) && correction.includes('【修正说明】上一稿开头与上一章结尾连续重合'),
    retryLeaksDraftFragment: correction.includes(REPLAY_PROSE.slice(-40)),
    composeCalls,
    drafts: chapter2Drafts.length,
    // 失败候选（recovery_candidates）实读且只算本章，不写死：卡 §4.3 要求成功路径一行不落。
    candidates: out.rows.candidates.length,
    physicalModelRequests: out.mainState.physicalModelRequests,
    embeddings: out.mainState.embeddings,
    unclassified: out.mainState.unclassified,
    correctionText: correction,
    outlinePromptChars: outlinePrompt.length,
  }
  const expected = { endingBlockUnits: value => value <= 300, endingBlockNonEmpty: value => value === true,
    notesSixColumnsPresent: value => value === true,
    notesTableRowsUnchanged: value => value === true, notesHooksCountUnchanged: value => value === true,
    outlineMidMaxOverlapUnits: value => value <= 80, proseContainsFullPrevious: value => value === true,
    proseDispatches: value => value === 2, retryHasCorrection: value => value === true,
    retryLeaksDraftFragment: value => value === false, composeCalls: value => value === 1,
    drafts: value => value === 1, candidates: value => value === 0,
    physicalModelRequests: value => value === 0, unclassified: value => value === 0 }
  const checks = Object.fromEntries(Object.entries(expected).map(([key, judge]) => [key, judge(evidence[key])]))
  out.evidence = evidence
  out.checks = checks
  out.fixture = {
    notesSource: 'summary_snapshots 直写（定稿后处理链需 GENERATION_FINALIZATION_ADMISSION）',
    chapter1Import: receipt ? { finalizationId: out.importedDraft.finalizationId, contentHash: out.importedDraft.contentHash } : null,
    chapter1Units: units(CH1_CONTENT),
    notesUnits: units(NOTES),
  }
  out.steps = stepLog
  fs.mkdirSync(runRoot, { recursive: true })
  fs.writeFileSync(evidencePath, `${JSON.stringify(out, null, 2)}\n`, 'utf8')
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key)
  if (failed.length > 0) {
    console.error(`[d12] FAILED: ${failed.join(', ')}`)
    console.log(JSON.stringify({ ok: false, failed, evidence, evidencePath }))
    process.exitCode = 1
    return
  }
  // 强杀 Electron 后其 user-data 目录可能还锁着（EPERM），清理失败不影响判据与证据。
  if (!keepArtifacts) {
    try { fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch { /* 留着不致命 */ }
  }
  console.log(JSON.stringify({ ok: true, evidence, evidencePath }))
}

await main()

// playwright 与 Electron 的驱动连接在应用被强杀后仍持有句柄，事件循环不会自然排空，
// 进程会一直挂着不退（外层 shell 收不到 EXIT）。证据文件与末行 JSON 都已写完，
// 这里等 stdout 冲刷后显式退出，让调用方拿到真实退出码。
await new Promise((resolve) => setTimeout(resolve, 50))
process.exit(process.exitCode ?? 0)
