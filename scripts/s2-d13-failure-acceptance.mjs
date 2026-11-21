/* global process */
/**
 * S2 · D13 实机验收：三档失败点各触发一次，取证「失败码带 code 跨 IPC」「候选落库」「界面两档文案」。
 *
 * 判据来自 `.batch/night/cards/s2-d13-failure-contract.md` §5。形态与 `scripts/d12-replay-acceptance.mjs`
 * 一致：真实 Electron（dist 构建）+ 真实 SQLite，主进程内把 `globalThis.fetch` 换成合成 SSE 响应，
 * 任何真实出网请求一律抛错；第 2 章必须走渲染层 `GenerateDraftCommand`（`写作第2章` → `开始创作`），
 * 因为失败契约在命令层。
 *
 * 单实例串跑三档（§8）：一次 `electron.launch`，同一项目把第 2 章连跑三轮，
 * 每轮只切换主进程里的 `globalThis.__s2.band`：
 *   short-outline-fail  短细纲请求一律 finish_reason=length → DRAFT_SHORT_OUTLINE_FAILED（无候选行）
 *   replay              正文一律复述上一章结尾             → DRAFT_PREVIOUS_ENDING_REPLAY（有候选行）
 *   no-progress         首稿与续写吐同一份正文             → GENERATION_COMPOSITION_NO_PROGRESS（有候选行）
 */
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runId = randomUUID().slice(0, 12)
const runRoot = path.join(repository, '.runtime', '.cache', 's2-d13', runId)
const scratch = path.join(runRoot, 'scratch')
const roots = Object.fromEntries(['canonical', 'legacy', 'userData', 'home', 'appData', 'localAppData']
  .map(name => [name, path.join(scratch, name)]))
// 项目路径硬上限 85 字符（ProjectStoragePreflight），项目落在短根目录下，不跟 runRoot 走深路径。
const projectsRoot = path.join(process.env.LOCALAPPDATA ?? scratch, 'VibeCodingScratch', 'd13')
roots.projects = path.join(projectsRoot, `p${runId.slice(0, 6)}`)
const evidencePath = path.join(runRoot, 'evidence.json')
const projectName = 'd13'
const Database = createRequire(import.meta.url)('better-sqlite3')
let productionHelpers
async function helpers() {
  if (!productionHelpers) {
    const { build } = await import('esbuild')
    const bundled = await build({ stdin: { contents: "export { countDraftUnits } from './src/shared/draft-units.ts'\nexport { chapterFailureMeta } from './src/shared/chapter-failure.ts'",
      resolveDir: repository }, bundle: true, platform: 'node', format: 'esm', write: false })
    productionHelpers = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
  }
  return productionHelpers
}
const sha256 = text => createHash('sha256').update(text).digest('hex')
const keepArtifacts = process.argv.includes('--keep')
const stepLog = []
const step = (name, detail = '') => { stepLog.push({ name, at: new Date().toISOString(), detail }); console.log(`[s2-d13] ${name}${detail ? ` · ${detail}` : ''}`) }

const model = { id: 'd13-synthetic', name: 'D13 合成流式模型', provider: 'openai', protocol: 'openai', modelName: 'gpt-4.1',
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
  '第 1 段（约 60 字）：林岚带同伴从旧码头出发，沿北岸礁石向东，途中核对手里的日志。',
  '第 2 段（约 60 字）：退潮后石墙露出半截，众人固定绳索并对照旧航线图确定入口。',
  '第 3 段（约 60 字）：两人进入通道前段，记下岔路与通风口方位，决定次日前再深入。',
].join('\n')
const SHORT_OUTLINE_PARTIAL = OUTLINE_TEXT.split('\n')[0]

const REPLAY_PROSE = `${CH1_TAIL}\n林岚把日志合上，抬头看向北岸。潮水已经退去，礁石露出一道旧航道。同伴核对刻度，确认石墙还在原处。两人固定绳索，把方位记进日志，约好天亮再进通道。`
// 无进展档的正文：六句互不相同的短句（避免整章内部逐句重复被判退化），约 120 字，
// 低于目标 200 的 aimLow(170) 会触发自动续写；续写再吐同一份，合并不出增长。
const NO_PROGRESS_PROSE = [
  '潮水退到礁石以下时，林岚已经站在北岸，把绳索绕上铁环。',
  '石墙上的刻痕被盐霜填满，两个人用刀背一点点刮开。',
  '缝隙里透出陈旧的风，带着铁锈与湿木的味道，吹得灯焰发晃。',
  '她先探手进去，摸到一段向下的台阶，台阶边缘结着白霜。',
  '同伴在入口留下绳结，又把备用灯挂在最外层的铁环上。',
  '两人约好天亮再往深处走，今晚只记下岔路与通风口的位置。',
].join('')
const CARDS_JSON = JSON.stringify({ characters: [] })

const bands = [
  { band: 'short-outline-fail', expectedCode: 'DRAFT_SHORT_OUTLINE_FAILED', expectsCandidate: false },
  { band: 'replay', expectedCode: 'DRAFT_PREVIOUS_ENDING_REPLAY', expectsCandidate: true },
  { band: 'no-progress', expectedCode: 'GENERATION_COMPOSITION_NO_PROGRESS', expectsCandidate: true },
]

// ---------------------------------------------------------------- 合成模型拦截
async function launch(fixture) {
  const env = { ...process.env, AI_NOVEL_APP_DATA_HOME: roots.canonical,
    AI_NOVEL_LEGACY_SOURCE_HOME: roots.legacy, AI_NOVEL_VELA_HOME: roots.legacy,
    HOME: roots.home, USERPROFILE: roots.home, APPDATA: roots.appData, LOCALAPPDATA: roots.localAppData }
  for (const name of ['ELECTRON_RUN_AS_NODE', 'VITE_DEV_SERVER_URL', 'AI_NOVEL_SMOKE_OPEN_PROJECT', 'AI_NOVEL_SMOKE_PROJECT_MARKER']) delete env[name]
  const app = await electron.launch({ cwd: repository, args: ['.', `--user-data-dir=${roots.userData}`], env, timeout: 60_000 })
  await app.evaluate(async (_, plan) => {
    const text = body => {
      const messages = Array.isArray(body?.messages) ? body.messages : []
      return messages.map(message => typeof message?.content === 'string'
        ? message.content
        : Array.isArray(message?.content)
          ? message.content.map(part => part?.text ?? '').join('')
          : JSON.stringify(message?.content ?? '')).join('\n')
    }
    const state = globalThis.__s2 = { band: 'short-outline-fail', physicalModelRequests: 0, unclassified: 0,
      embeddings: 0, intercepted: [], bands: {} }
    const classify = prompt => {
      if (prompt.includes('只写短细纲')) return 'outline'
      if (prompt.includes('上一章最后约 300 字')) return 'outline'
      if (prompt.includes('结构化章节要点')) return 'notes'
      if (prompt.includes('JSON 格式返回在本章中发生状态变化的角色')) return 'cards'
      if (prompt.includes('【修正说明】')) return 'draft'
      if (prompt.startsWith('你是一位经验丰富的小说作者')) return 'draft'
      return 'unknown'
    }
    const reply = mode => {
      const band = state.band
      if (mode === 'outline') return band === 'short-outline-fail'
        ? { content: plan.outlinePartial, finishReason: 'length' }
        : { content: plan.outline, finishReason: 'stop' }
      if (mode === 'notes') return { content: plan.notes, finishReason: 'stop' }
      if (mode === 'cards') return { content: plan.cards, finishReason: 'stop' }
      // 正文：replay 档一律复述上一章结尾（首稿与带原因重写都一样），
      // no-progress 档首稿与续写吐同一份，其余档（本脚本不用）给短稿。
      if (band === 'replay') return { content: plan.replay, finishReason: 'stop' }
      if (band === 'no-progress') return { content: plan.noProgress, finishReason: 'stop' }
      return { content: plan.noProgress, finishReason: 'stop' }
    }
    const sse = (content, finishReason) => new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: finishReason }] })}\n\n`
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
        throw new Error('S2_D13_EXTERNAL_FETCH_REFUSED')
      }
      const body = JSON.parse(String(init?.body ?? '{}'))
      const prompt = text(body)
      const mode = classify(prompt)
      const answer = reply(mode)
      const bucket = state.bands[state.band] ??= { requests: [], draftCalls: 0, outlineCalls: 0 }
      if (mode === 'draft') bucket.draftCalls += 1
      if (mode === 'outline') bucket.outlineCalls += 1
      bucket.requests.push({ band: state.band, mode, finishReason: answer.finishReason, stream: body.stream === true,
        promptLength: prompt.length, promptHead: prompt.slice(0, 80), prompt: prompt.slice(0, 4000) })
      if (mode === 'unknown') state.unclassified += 1
      if (body.stream === false || body.stream === undefined) {
        return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: answer.content }, finish_reason: answer.finishReason }],
          usage: { prompt_tokens: 40, completion_tokens: 400, total_tokens: 440 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return sse(answer.content, answer.finishReason)
    }
  }, fixture)
  const logLines = []
  const capture = chunk => { for (const line of String(chunk).split(/\r?\n/)) if (line.trim()) logLines.push(line) }
  app.process()?.stdout?.on('data', capture)
  app.process()?.stderr?.on('data', capture)
  globalThis.__s2Log = logLines
  const page = await app.firstWindow({ timeout: 60_000 })
  page.on('console', message => logLines.push(`[console.${message.type()}] ${message.text()}`))
  page.setDefaultTimeout(30_000)
  await page.locator('.app-skin-root').waitFor({ state: 'visible', timeout: 60_000 })
  return { app, page, logLines }
}

/**
 * 渲染层对象只能从界面取证：`window.aiNovelAPI` 是 contextBridge 冻结对象，挂记录器改不动
 * （D12 脚本里同样行不通）。因此判据 2 的证据是界面读数：
 *  - `错误码：<CODE>` 行只由渲染层 `error.code` 渲染（`errorCodeFromUnknown` 只读 `.code`），
 *    它能出现就说明码跨 IPC 活到了渲染层；
 *  - 候选卡里「这一章为什么没写出来：<detail>」的文案来自 `chapterFailureMeta(candidate.failureCode)`，
 *    与契约词表逐字比对即可证明 failureCode 也在渲染层对象里。
 */

async function invoke(page, channel, ...args) {
  return page.evaluate(({ channel, args }) => window.aiNovelAPI.invoke(channel, ...args), { channel, args })
}

async function quit(session) {
  if (!session?.app) return
  const app = session.app
  // app.close() 偶发挂住（渲染层还挂着发布流/对话框时 Electron 不退出），超时后强杀。
  try {
    await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 20_000))])
  } catch { /* already gone */ }
  try { app.process()?.kill() } catch { /* already gone */ }
}

/** 跑完按 --user-data-dir 统计残留 electron 进程（§8 要求 0）。 */
function leftoverElectronProcesses() {
  try {
    const script = "Get-CimInstance Win32_Process -Filter \"name='electron.exe'\" | "
      + 'Where-Object { $_.CommandLine -like "*'
      + roots.userData.replace(/\\/g, '\\\\').replace(/'/g, "''")
      + '*" } | Measure-Object | Select-Object -ExpandProperty Count'
    const output = execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8', timeout: 30_000 })
    const count = Number(String(output).trim())
    return Number.isFinite(count) ? count : -1
  } catch (error) {
    return `unavailable: ${String(error?.message ?? error)}`
  }
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

/**
 * 库操作放进主进程做：`better-sqlite3` 是按 Electron ABI 编译的（NODE_MODULE_VERSION 145），
 * 在纯 node 里 require 会 ERR_DLOPEN_FAILED。
 */
async function appDb(app, task, payload = {}) {
  return app.evaluate(async (_, args) => {
    const requireFromRepo = process.mainModule.constructor.createRequire(process.cwd() + '/package.json')
    const path = requireFromRepo('node:path')
    const Database = requireFromRepo('better-sqlite3')
    const db = new Database(path.join(args.projectPath, '.ai-novel', 'project.db'), { fileMustExist: true, timeout: 20_000 })
    db.pragma('busy_timeout = 20000')
    const attempt = fn => { try { return fn() } catch (error) { return { error: `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}` } } }
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
          drafts: attempt(() => db.prepare('SELECT id, chapter_number AS chapter, version, status FROM drafts ORDER BY id').all()),
          // 判据 3 的原文：本章候选行的章号、失败码与可见正文字数。
          candidates: attempt(() => db.prepare(`SELECT candidate_id AS id, chapter_number AS chapter, failure_code AS failureCode,
            length(visible_text) AS visibleUnits, status, created_at AS createdAt
            FROM recovery_candidates ORDER BY created_at`).all()),
          candidateSample: attempt(() => db.prepare(`SELECT chapter_number AS chapter, failure_code AS failureCode,
            visible_text, failure_reason AS failureReason FROM recovery_candidates ORDER BY created_at DESC LIMIT 1`).get() ?? null),
          runs: attempt(() => db.prepare('SELECT run_id AS runId, status, failure_code AS failureCode, binding_json AS binding FROM generation_runs ORDER BY rowid').all()),
          attempts: attempt(() => db.prepare('SELECT attempt_json AS attemptJson, usage_receipt_json AS receiptJson FROM generation_attempts ORDER BY rowid').all()),
        }
      }
      throw new Error(`unknown task ${args.task}`)
    } catch (error) {
      return { ok: false, error: `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}` }
    } finally { db.close() }
  }, { projectPath: payload.projectPath, task, payload: payload.payload ?? {} })
}

const panelText = async page => page.locator('.writer-ai-panel').innerText().catch(() => '')
const errorCodeInText = text => {
  const match = text.match(/错误码：\s*([A-Z0-9_]+)/)
  return match ? match[1] : null
}

async function setBand(app, band) {
  await app.evaluate((_, next) => { globalThis.__s2.band = next }, band)
}

/** 点「写作第2章」→ 填目标字数 → 开始创作。 */
async function startChapter2(page) {
  const writeButton = page.getByRole('button', { name: '写作第2章' })
  await writeButton.waitFor({ state: 'visible', timeout: 60_000 })
  await writeButton.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('3000').fill('200')
  await dialog.getByRole('button', { name: '开始创作' }).click()
}

/** 轮询面板，等到出现本档期望的失败码（最多 240s）。 */
async function waitForFailure(page, code, band) {
  const deadline = Date.now() + 240_000
  let last = ''
  while (Date.now() < deadline) {
    last = await panelText(page)
    if (last.includes(`错误码：${code}`)) return last
    if (last.includes('错误码：') && !last.includes(code)) {
      // 上一档的残留警告还在、本档还没起效：继续等；若 100s 后仍是别的码，落现场再失败。
      if (Date.now() > deadline - 140_000) {
        const dump = path.join(runRoot, `mismatch-${band}.txt`)
        fs.mkdirSync(runRoot, { recursive: true })
        fs.writeFileSync(dump, last, 'utf8')
        throw new Error(`[${band}] 期望 ${code}，面板出现别的失败码（现场：${dump}）`)
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  const dump = path.join(runRoot, `timeout-${band}.txt`)
  fs.mkdirSync(runRoot, { recursive: true })
  fs.writeFileSync(dump, last, 'utf8')
  throw new Error(`[${band}] 240s 内没等到失败码 ${code}（现场：${dump}）`)
}

async function main() {
  const { countDraftUnits, chapterFailureMeta } = await helpers()
  assert.ok(fs.existsSync(path.join(repository, 'dist-electron', 'main.js')), 'dist-electron/main.js 缺失：先运行 npx vite build')
  assert.ok(fs.existsSync(path.join(repository, 'dist', 'index.html')), 'dist/index.html 缺失：先运行 npx vite build')
  assert.ok(countDraftUnits(NO_PROGRESS_PROSE) < 170, `无进展档正文必须低于 aimLow(170)，实际 ${countDraftUnits(NO_PROGRESS_PROSE)}`)
  for (const directory of Object.values(roots)) fs.mkdirSync(directory, { recursive: true })
  const out = { runId, projectName, projectPath: null, bands: {}, evidence: {}, checks: {}, instancesThisRun: 0 }
  let session
  let projectPath
  try {
    step('launch')
    session = await launch({ outline: OUTLINE_TEXT, outlinePartial: SHORT_OUTLINE_PARTIAL, notes: NOTES,
      cards: CARDS_JSON, replay: REPLAY_PROSE, noProgress: NO_PROGRESS_PROSE })
    out.instancesThisRun += 1
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
    out.chapter1 = { finalizationId: importedDraft.finalizationId, contentHash: importedDraft.contentHash,
      units: countDraftUnits(CH1_CONTENT), tailSample: CH1_TAIL }
    step('seed-notes')
    out.characters = await appDb(session.app, 'characters', { projectPath, payload: { entries: [
      { name: '林岚', role: 'protagonist', personality: '寡言、认死理', motivation: '找回失踪的妹妹' },
      { name: '周砚', role: 'supporting', personality: '圆滑、爱试探', motivation: '守住港口的账本' },
    ] } })
    out.seeded = await appDb(session.app, 'seed', { projectPath, payload: { draftId: importedDraft.draftId,
      finalizationId: importedDraft.finalizationId, contentHash: importedDraft.contentHash, notes: NOTES } })
    assert.ok(Array.isArray(out.seeded) && out.seeded.length === 1, `写要点失败：${JSON.stringify(out.seeded)}`)
    await writerShell(session.page)
    const notice = session.page.getByRole('button', { name: '知道了' })
    if (await notice.isVisible()) await notice.click()
    await session.page.locator('.writer-shelf').getByRole('button', { name: `打开《${projectName}》` }).click()
    await session.page.locator('.writer-project-tree').getByText(projectName, { exact: true }).waitFor({ state: 'visible', timeout: 60_000 })
    await session.page.locator('.writer-project-tree').getByText('章节蓝图', { exact: true }).click()

    // ---------- 三档串跑（同一 app、同一项目、同一章） ----------
    for (const entry of bands) {
      step(`band-start:${entry.band}`)
      await setBand(session.app, entry.band)
      await startChapter2(session.page)
      const panel = await waitForFailure(session.page, entry.expectedCode, entry.band)
      const startedAt = Date.now()
      // 候选卡/面板可能比错误码晚一拍，再等一小会儿让界面稳定。
      await new Promise(resolve => setTimeout(resolve, 1_200))
      const settledPanel = await panelText(session.page)
      const rows = await appDb(session.app, 'read', { projectPath })
      const mainState = await session.app.evaluate((_, bandName) => globalThis.__s2.bands[bandName] ?? null, entry.band)
      out.bands[entry.band] = {
        expectedCode: entry.expectedCode,
        panelErrorCode: errorCodeInText(settledPanel) ?? errorCodeInText(panel),
        panelText: settledPanel,
        panelFirstSeenMs: Date.now() - startedAt,
        requests: mainState,
        candidates: rows.candidates,
        candidateSample: rows.candidateSample,
        runs: rows.runs,
        drafts: rows.drafts,
      }
      step(`band-done:${entry.band}`, `code=${out.bands[entry.band].panelErrorCode}`)
    }
    out.mainState = await session.app.evaluate(() => ({ physicalModelRequests: globalThis.__s2.physicalModelRequests,
      embeddings: globalThis.__s2.embeddings, unclassified: globalThis.__s2.unclassified }))
    out.rows = await appDb(session.app, 'read', { projectPath })
    out.appLogTail = (session.logLines ?? []).slice(-300)
  } finally {
    step('quit')
    await quit(session)
    step('quit-done')
    out.leftoverElectronProcesses = leftoverElectronProcesses()
  }

  // ---------------------------------------------------------------- 判据
  const perBand = {}
  for (const entry of bands) {
    const band = out.bands[entry.band] ?? {}
    const text = String(band.panelText ?? '')
    const candidates = Array.isArray(band.candidates) ? band.candidates : []
    const chapter2 = candidates.filter(row => row.chapter === 2)
    const sameCode = chapter2.filter(row => row.failureCode === entry.expectedCode)
    const meta = chapterFailureMeta(entry.expectedCode) ?? null
    const attemptFacts = (Array.isArray(band.runs) ? band.runs : []).map(run => {
      const binding = JSON.parse(run.binding ?? '{}')
      return { runId: run.runId, status: run.status, failureCode: run.failureCode,
        operation: binding?.sourceManifest?.operation ?? binding?.operation ?? null }
    })
    perBand[entry.band] = {
      expectedCode: entry.expectedCode,
      // 判据 1：界面读到的唯一失败码
      panelCode: band.panelErrorCode,
      panelMentionsExpected: text.includes(entry.expectedCode),
      // 判据 2：失败码跨 IPC 到渲染层仍存在 —— 面板「错误码：<CODE>」一行只由渲染层 error.code 渲染
      // （workflow-store.errorCodeFromUnknown 只读 error.code，不解析 message）。
      rendererCodeLine: /错误码：\s*([A-Z0-9_]+)/.exec(text)?.[0] ?? null,
      rendererKeepsCode: band.panelErrorCode === entry.expectedCode,
      // 判据 3：本章候选行（按本节失败码过滤）与可见正文字数
      chapter2Candidates: chapter2,
      sameCodeCandidates: sameCode,
      candidateVisibleUnits: sameCode.map(row => row.visibleUnits),
      candidateColumns: sameCode.map(row => `chapter_number=${row.chapter} failure_code=${row.failureCode} ` +
        `length(visible_text)=${row.visibleUnits} status=${row.status}`),
      // 判据 4：候选卡两档文案（原因 + 可执行下一步），与契约 CHAPTER_FAILURE_META 逐字比对
      cardDetailExpected: meta?.detail ?? null,
      cardDetailInPanel: meta ? text.includes(meta.detail) : false,
      cardSuggestionExpected: meta?.suggestions?.[0] ?? null,
      cardSuggestionInPanel: meta?.suggestions?.[0] ? text.includes(meta.suggestions[0]) : false,
      cardCopySample: text.split('\n').filter(line => /这一章为什么没写出来|可以试|已保留/.test(line)).slice(0, 6),
      // 证据：本轮请求分派与 run 失败码
      draftCalls: band.requests?.draftCalls ?? null,
      outlineCalls: band.requests?.outlineCalls ?? null,
      finishReasons: [...new Set((band.requests?.requests ?? []).map(item => `${item.mode}:${item.finishReason}`))],
      runs: attemptFacts,
      draftsForChapter2: (Array.isArray(band.drafts) ? band.drafts : []).filter(row => row.chapter === 2).length,
    }
  }
  const evidence = {
    instancesThisRun: out.instancesThisRun,
    leftoverElectronProcesses: out.leftoverElectronProcesses,
    physicalModelRequests: out.mainState?.physicalModelRequests,
    unclassified: out.mainState?.unclassified,
    bands: perBand,
  }
  const checks = {}
  for (const entry of bands) {
    const fact = perBand[entry.band]
    const prefix = entry.band
    checks[`${prefix}.panelCode`] = fact.panelCode === entry.expectedCode
    // 判据 2：渲染层错误对象带 code（面板码行）+ 候选档的候选行把同一码带到渲染层文案
    checks[`${prefix}.rendererKeepsCode`] = entry.expectsCandidate
      ? fact.rendererKeepsCode && fact.sameCodeCandidates.length === 1 && fact.cardDetailInPanel
      : fact.rendererKeepsCode
    checks[`${prefix}.candidateRows`] = entry.expectsCandidate
      ? fact.sameCodeCandidates.length === 1 && fact.candidateVisibleUnits.every(value => value > 0)
      : fact.sameCodeCandidates.length === 0
    checks[`${prefix}.cardCopy`] = entry.expectsCandidate
      ? fact.cardDetailInPanel && fact.cardSuggestionInPanel
      : true
    checks[`${prefix}.noDraftPersisted`] = fact.draftsForChapter2 === 0
  }
  checks.physicalModelRequests = out.mainState?.physicalModelRequests === 0
  checks.unclassified = out.mainState?.unclassified === 0
  out.evidence = evidence
  out.checks = checks
  out.steps = stepLog
  fs.mkdirSync(runRoot, { recursive: true })
  fs.writeFileSync(evidencePath, `${JSON.stringify(out, null, 2)}\n`, 'utf8')
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key)
  if (failed.length > 0) {
    console.error(`[s2-d13] FAILED: ${failed.join(', ')}`)
    console.log(JSON.stringify({ ok: false, failed, evidence, evidencePath }))
    process.exitCode = 1
    return
  }
  if (!keepArtifacts) {
    try { fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch { /* 留着不致命 */ }
  }
  console.log(JSON.stringify({ ok: true, evidence, evidencePath }))
}

await main()

// playwright 与 Electron 的驱动连接在应用被强杀后仍持有句柄，事件循环不会自然排空；
// 证据与末行 JSON 已写完，这里等 stdout 冲刷后显式退出，让调用方拿到真实退出码。
await new Promise((resolve) => setTimeout(resolve, 50))
process.exit(process.exitCode ?? 0)
