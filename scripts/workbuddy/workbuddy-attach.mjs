#!/usr/bin/env node
/**
 * WorkBuddy 桌面通道（attach）的命令行。
 *
 * 设计要点（与豆包通道对齐，见 docs/agents/workbuddy-channel.md）：
 * - 复用**用户已登录的桌面实例**（登录态 + 积分 + 已有会话都在里面），只走 CDP 驱动 UI；
 * - 实例没开 / 没开 Debug 模式时**不自己 spawn 长驻 GUI**，打印可粘贴命令并以退出码 2 结束；
 * - 「cwd=wt-2」靠侧栏空间 + 按钮落地：点空间标题右侧的「+」= 该目录下的新草稿，
 *   点空间下的会话卡片 = 复用那条会话（spawn exe 传路径实测不可靠，已弃用）；
 * - 会话归属以本地 sqlite（~/.workbuddy/workbuddy.db）为准：派活前核对 cwd，不在 wt-2 就拒绝；
 * - 默认**复用上一轮会话**（单会话多轮，不重读章程），--new 才开新会话；
 * - 退出码：0 完成 / 1 失败 / 2 未连接（NEED_HUMAN_DEBUG） / 4 超时 / 5 高峰时段拒绝派活。
 * - 2026-11-07：headless 兜底通道（`codebuddy -p`）已连同 npm 包一起移除，本脚本是唯一入口。
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

import { listTargets, connect, createClient, sleep } from '../doubao/cdp.mjs'
import { extractMarkers, isTerminalQueueMarker } from '../doubao/markers.mjs'
import { appendSettleEvent, assertInWatchDir, deliveredSince, mentionOf, readSettleEvents, scanSignals, watchDirsOf, writeSignal } from '../lib/relay-signal.mjs'
import {
  DEFAULT_PORT,
  DEFAULT_TIMEOUT_MS,
  POLL_INTERVAL_MS,
  READY_TIMEOUT_MS,
  SELECTORS,
  resolveExePath,
  pickPage,
  parseCdpVersion,
  buildNeedHumanDebugBanner,
  buildSnapshotExpression,
  buildClearEditorExpression,
  buildTailTextExpression,
  buildSpaceActionExpression,
  buildSpaceClickExpression,
  buildCurrentSessionExpression,
  readRunState,
  isSettledSignal,
  isAskCardPending,
  checkPinnedCwd,
  judgeLanding,
  judgeFreshDraft,
  extractReply,
  summarizeSnapshot,
  buildModelItemsExpression,
  buildModelOptionExpression,
  parseArgv,
  createRunId,
  slugify,
} from './attach.mjs'
import {
  ALLOWED_MODELS,
  CROSS_SOURCE_MODELS,
  MODEL_DEEPSEEK_FLASH,
  buildPeakBanner,
  describeModelPolicy,
  isPaidHy4,
  isDeepSeekPeakAt,
  pickModel,
  rejectUnknownModel,
  sameModel,
} from './model-policy.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..')
/** WorkBuddy 的固定工作目录（归属表见 docs/agents/worktree-parallel.md §3.1） */
const DEFAULT_CWD = path.resolve(REPO_ROOT, '..', 'wt-2')
/** 额外归属白名单：环境变量 `WORKBUDDY_ALLOWED_CWDS`，绝对路径清单，`path.delimiter`（Windows=;）分隔。
 *  空 / 不设 = 不注册任何额外目录 ⇒ 只有 DEFAULT_CWD，与历史行为逐字相同（软回滚就是清掉这个变量）。
 *  选 env 不选配置文件：①与 WORKBUDDY_DB / WORKBUDDY_MODEL_POLICY 同构；②落盘会随提交扩散到所有人检出，
 *  等于把「谁能投到哪」变成可提交内容；③env 每次调用显式给、用完即失效，不会静默长期生效。
 *  这里只做切分，合法性与匹配判据全在 checkPinnedCwd（单一真相，避免两处规则漂移）。 */
const ALLOWED_CWDS = String(process.env.WORKBUDDY_ALLOWED_CWDS ?? '')
  .split(path.delimiter)
  .map(entry => entry.trim())
  .filter(Boolean)
/** 产物与会话记录的落点：先试 `develop/.runtime`，不可写就退到委托槽位自己的 `.batch/`。
 *  夜间定时卡的会话跑在受限沙箱里，写 `develop/.runtime` 会 EPERM 并弹提权申请；各槽位的 `.batch/`
 *  从工作区根继承写权限（11-09 夜跑实测可写），所以失败后换第二落点，绝不反复尝试。 */
const RUNTIME_CANDIDATES = [
  path.join(REPO_ROOT, '.runtime', 'workbuddy'),
  path.join(REPO_ROOT, '..', 'wt-2', '.batch', 'workbuddy'),
]
/** 产物目录可写性探测结果：null=未探测，true=可写，false=两个落点都不可写（产物与会话记录都跳过）。 */
let RUNTIME_DIR = null
function resolveRuntimeDir() {
  if (RUNTIME_DIR !== null) return RUNTIME_DIR
  for (const dir of RUNTIME_CANDIDATES) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      const probe = path.join(dir, '.write-probe')
      fs.writeFileSync(probe, 'ok', 'utf8')
      fs.rmSync(probe, { force: true })
      RUNTIME_DIR = dir
      if (dir !== RUNTIME_CANDIDATES[0]) log('[warn] .runtime 不可写，产物与会话记录改落 ' + dir)
      return RUNTIME_DIR
    } catch {
      /* 试下一个落点 */
    }
  }
  RUNTIME_DIR = ''
  return RUNTIME_DIR
}
function artifactsDisabled() {
  return resolveRuntimeDir() === ''
}

const BOOLEAN_FLAGS = ['--new', '--keep', '--json', '--force', '--no-wait', '--help', '--quiet']

/** parseArgv 存的是去掉 -- 的裸名（见 attach.mjs），这里统一按裸名查，兼容带 -- 的旧写法。 */
function matches(collection, name) {
  return collection.has(name) || collection.has('--' + name)
}

class NeedHumanDebug extends Error {}

/**
 * 评审件识别（只用于「未点名模型」这一分支）：命中即拒，避免跨源评审悄悄落到同源的 DeepSeek。
 * 判据刻意只认强特征（派单件名 / 跨源字样 / 四家模型名），不认泛词「评审」以免误伤普通回复。
 */
function looksLikeCrossSourceReview(prompt) {
  const text = String(prompt ?? '')
  if (/EXT-REVIEW|ext-review/i.test(text)) return true
  if (/跨源|非同源|跨家族/.test(text)) return true
  return CROSS_SOURCE_MODELS.some(model => text.includes(model))
}

const EXIT = { ok: 0, fail: 1, notConnected: 2, cliMissing: 3, timeout: 4, peak: 5, askCard: 6 }

/**
 * 选模型 + 高峰拦截（纯策略见 model-policy.mjs）。
 *
 * 优先顺序：--model 显式指定（视为人工授权，绕过高峰） > 环境变量 WORKBUDDY_MODEL_POLICY=off（不自动选型） > 时段策略。
 * 返回 {model|null, blocked?, how}；blocked 时调用方直接 exit 5，不碰 CDP。
 */
function resolveModelTarget(args, { command, prompt }) {
  const explicit = args.model ? String(args.model).trim() : ''
  if (explicit) {
    // 付费 Hy4（0.29x）是被明令禁用的那一条：--force 也不许用它（2026-11-25 收窄）
    if (isPaidHy4(explicit)) fail('[refuse] 「Hy4」(0.29x) 已全线禁用，--force 不放行；跨源评审请点名 ' + CROSS_SOURCE_MODELS.join(' / '))
    const rejected = rejectUnknownModel(explicit)
    // --force = 对该次派单的人工授权（2026-11-25：跨源评审要用 GLM-5.3/Qwen 3.8 Flash），**只对跨源名单生效**
    if (rejected && !args.force) fail('[refuse] ' + rejected + '\n（本次已获授权可加 --force）')
    if (rejected && !CROSS_SOURCE_MODELS.includes(explicit)) {
      fail('[refuse] --force 只对跨源评审名单内的模型生效：' + CROSS_SOURCE_MODELS.join(' / ') + '\n「' + explicit + '」不在名单内，如确要新增请先改 model-policy.mjs 的 CROSS_SOURCE_MODELS')
    }
    if (rejected) log('[force] 跨源评审按人工授权放行：' + explicit)
    return { model: explicit, how: 'explicit' }
  }
  if (args.policyOff) return { model: null, how: 'policy-off' }
  // 主人 2026-11-25 20:59：普通外派按老规矩用 DeepSeek-V4.1-Flash —— 固定默认值，**不按价格/时段挑**。
  // 例外：跨源评审必须点名跨家族模型；评审件未点名会落到 DeepSeek，与本组同源、等于白跑，故直接拒。
  if (command === 'task') {
    if (looksLikeCrossSourceReview(prompt)) {
      fail('[refuse] 跨源评审必须显式 --model：未点名会落到默认的 ' + MODEL_DEEPSEEK_FLASH + '（与本组同源，等于白跑）\n例：--model "GLM-5.3" --force，或 --model "Hy4 flash"')
    }
    // 高峰拦截沿用旧规矩（工作日 09:00–12:00 / 14:00–18:00 原价，不派活）
    if (isDeepSeekPeakAt()) {
      log(buildPeakBanner({ now: new Date(), command, prompt }))
      return { model: null, blocked: true, how: 'peak-blocked' }
    }
    log('[default] 未点名模型 → ' + MODEL_DEEPSEEK_FLASH + '（主人 2026-11-25：普通外派按老规矩）')
    return { model: MODEL_DEEPSEEK_FLASH, how: 'default-deepseek' }
  }
  const picked = pickModel()
  if (!picked.ok) {
    log(buildPeakBanner({ now: new Date(), command, prompt }))
    return { model: null, blocked: true, how: 'peak-blocked' }
  }
  return { model: picked.model, how: 'policy', policy: picked }
}

/**
 * 把当前会话的模型切到目标值，并核对「真的切了」。
 *
 * 选择器是 portal：必须先点开 trigger 才有 role=option 列表；名字取 .cr-model-selector__item-name 的文本。
 * 切完再从 chips.model 读回来比对 —— 只报告「点了」不算数。
 */
async function ensureModel(client, target) {
  let snapshot = await client.evaluate(buildSnapshotExpression())
  const current = snapshot?.chips?.model ?? null
  if (!target) return { model: current, changed: false, skipped: true }
  if (sameModel(current, target)) return { model: current, changed: false }

  const opened = await clickSelector(client, SELECTORS.modelTrigger)
  if (!opened) throw new Error('模型选择器点不开（.cr-model-selector__trigger 变了？先跑 status 看 chips.model）')
  await sleep(700)
  const rect = await client.evaluate(buildModelOptionExpression({ model: target }))
  if (!rect || rect.error) {
    await client.key('Escape', 'Escape', 27)
    const items = await client.evaluate(buildModelItemsExpression())
    const names = Array.isArray(items) ? items.map(item => item.name).join(' / ') : '(读不到列表)'
    throw new Error('模型选择器里没有「' + target + '」，当前可选：' + names)
  }
  await clickRect(client, rect)
  await sleep(900)
  snapshot = await client.evaluate(buildSnapshotExpression())
  const after = snapshot?.chips?.model ?? null
  if (!sameModel(after, target)) throw new Error('切模型失败：期望 ' + target + '，实际 ' + (after ?? '(空)'))
  return { model: after, changed: true }
}

/** 白名单兜底：就算策略关掉，也不许停在 Hy3 / GLM 这类模型上派活。 */
function assertAllowedModel(model, { force }) {
  if (isPaidHy4(model)) fail('[refuse] 「Hy4」(0.29x) 已全线禁用，--force 不放行')
  if (!model || force) return
  const rejected = rejectUnknownModel(model)
  if (rejected) fail('[refuse] ' + rejected + '\n（要临时放行加 --force；建议 --model ' + ALLOWED_MODELS[0] + '）')
}

function normalizePath(value) {
  return String(value == null ? '' : value).split('\\').join('/').replace(/\/+$/, '').toLowerCase()
}

/**
 * `chips.workspace` 有两种形态，别拿一种去比另一种：
 * - 会话里读到 null（实测恒 null，所以旧守卫 `if (workspace && …)` 从未生效）；
 * - 草稿里读到**空间名**（如 `wt-2`，2026-11-12 实测），个别版本可能给完整 cwd。
 * 判据：像路径（含 / 或 \ 或盘符）就与 cwd 比，否则与空间名标签比。
 */
function workspaceMatches(workspace, cwd) {
  const value = String(workspace ?? '').trim()
  if (!value) return true
  const looksLikePath = /[\\/]/.test(value) || /^[a-zA-Z]:/.test(value)
  return looksLikePath ? normalizePath(value) === normalizePath(cwd) : value === path.basename(path.resolve(cwd))
}

function log(message) {
  process.stdout.write(message + '\n')
}

function fail(message, code = EXIT.fail) {
  process.stderr.write(message + '\n')
  process.exit(code)
}

async function requestVersion(port, timeoutMs = 3000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch('http://127.0.0.1:' + port + '/json/version', { signal: controller.signal })
    if (!response.ok) throw new Error('CDP /json/version returned ' + response.status)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

async function openPage({ port, requireEditor = true }) {
  let version
  try {
    version = await requestVersion(port)
  } catch (error) {
    throw new NeedHumanDebug('CDP 端口 ' + port + ' 未监听（' + (error && error.message ? error.message : 'fetch failed') + '）')
  }
  let targets
  try {
    targets = await listTargets(port)
  } catch (error) {
    throw new NeedHumanDebug('端口 ' + port + ' 通了但 /json/list 失败：' + (error && error.message ? error.message : error))
  }
  const page = pickPage(targets)
  if (!page) throw new NeedHumanDebug('端口 ' + port + ' 上没有 WorkBuddy 渲染层页面')
  const socket = await connect(page.webSocketDebuggerUrl)
  const client = createClient(socket)
  const meta = { port, page, version: parseCdpVersion(version), targetCount: targets.length }
  if (requireEditor) {
    const deadline = Date.now() + READY_TIMEOUT_MS
    let snapshot = await client.evaluate(buildSnapshotExpression())
    while (!snapshot?.hasEditor && Date.now() < deadline) {
      await sleep(1000)
      snapshot = await client.evaluate(buildSnapshotExpression())
    }
    if (!snapshot?.hasEditor) {
      client.close()
      throw new NeedHumanDebug('界面没有渲染出输入框（等了 ' + Math.round(READY_TIMEOUT_MS / 1000) + 's）')
    }
    meta.snapshot = snapshot
  }
  return { client, meta }
}

function cdpBannerAndExit(error, port) {
  const exe = resolveExePath({ env: process.env, exists: candidate => fs.existsSync(candidate) })
  process.stderr.write(buildNeedHumanDebugBanner({ port, reason: error?.message, exePath: exe.path ?? undefined }) + '\n')
  process.exit(EXIT.notConnected)
}

function workbuddyDbPath() {
  if (process.env.WORKBUDDY_DB) return process.env.WORKBUDDY_DB
  const home = process.env.USERPROFILE ?? process.env.HOME
  return home ? path.join(home, '.workbuddy', 'workbuddy.db') : null
}

// 用 require 而不是动态 import：node:sqlite 是同步 API，读台账的调用方也都是同步的
const require = createRequire(import.meta.url)
let sqliteModule = null

function loadSqlite() {
  if (!sqliteModule) sqliteModule = require('node:sqlite')
  return sqliteModule
}

function withDb(fn) {
  const dbPath = workbuddyDbPath()
  if (!dbPath || !fs.existsSync(dbPath)) return null
  const { DatabaseSync } = loadSqlite()
  let db
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
  } catch {
    return null
  }
  try {
    return fn(db)
  } finally {
    try { db.close() } catch { /* ignore */ }
  }
}

const SESSION_COLUMNS = 'id, cwd, title, custom_title, status, model, permission_mode, created_at, updated_at, last_activity_at'

function readSession(sessionId) {
  return withDb(db => {
    const row = db.prepare('SELECT ' + SESSION_COLUMNS + ' FROM sessions WHERE id = ?').get(sessionId)
    return row ? { ...row } : null
  })
}

function recentSessions({ cwd, limit = 12 } = {}) {
  return withDb(db => {
    const rows = cwd
      ? db.prepare('SELECT ' + SESSION_COLUMNS + ' FROM sessions ORDER BY COALESCE(last_activity_at, updated_at, created_at) DESC LIMIT 200').all()
      : db.prepare('SELECT ' + SESSION_COLUMNS + ' FROM sessions ORDER BY COALESCE(last_activity_at, updated_at, created_at) DESC LIMIT ?').all(limit)
    const list = rows.map(row => ({ ...row }))
    if (!cwd) return list.slice(0, limit)
    const target = normalizePath(cwd)
    return list.filter(row => normalizePath(row.cwd) === target).slice(0, limit)
  }) ?? []
}

function sessionRecordPath() {
  return path.join(resolveRuntimeDir() || RUNTIME_CANDIDATES[0], 'last-session.json')
}

function readSessionRecord() {
  for (const path_ of RUNTIME_CANDIDATES.map(dir => path.join(dir, 'last-session.json'))) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path_, 'utf8'))
      if (parsed && typeof parsed.sessionId === 'string') return parsed
    } catch {
      /* 试下一个落点 */
    }
  }
  return null
}

function writeSessionRecord(payload) {
  // 会话记录是「复用哪张卡」的护栏，不是投递的必要条件。两个落点都写不了就静默跳过，
  // 不要为了落一个提示文件去申请提权——夜间无人值守时没人点确认。
  if (artifactsDisabled()) return
  try {
    fs.writeFileSync(sessionRecordPath(), JSON.stringify(payload, null, 2) + '\n', 'utf8')
  } catch {
    /* 护栏不该挡住正经派活 */
  }
}

/** 侧栏里「空间」= 按 cwd 分组的会话列表，标题就是目录名。 */
function spaceLabelForCwd(cwd) {
  return path.basename(path.resolve(cwd))
}

async function waitForEditor(client, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  let snapshot = await client.evaluate(buildSnapshotExpression())
  while (!snapshot?.hasEditor && Date.now() < deadline) {
    await sleep(700)
    snapshot = await client.evaluate(buildSnapshotExpression())
  }
  return snapshot
}

async function clickRect(client, rect) {
  if (!rect || rect.error || !rect.w) return rect ?? { error: 'no-rect' }
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y })
  await sleep(120)
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  await sleep(60)
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  return rect
}

async function clickSelector(client, selector) {
  const rect = await client.evaluate(
    '(function(){var el=document.querySelector(' + JSON.stringify(selector) + ');if(!el) return null;' +
    'el.scrollIntoView({block:"center"});var r=el.getBoundingClientRect();' +
    'return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};})()',
  )
  if (!rect || !rect.w) return false
  await clickRect(client, rect)
  return true
}

/** 打开「cwd 对应空间」的新会话草稿（等价于人点空间标题右边的 +）。 */
async function openSpaceDraft(client, { cwd }) {
  const label = spaceLabelForCwd(cwd)
  // 点 + 之前先记住「当前是哪条会话」。点完必须变成另一条（或变成尚未落库的草稿），
  // 否则说明 + 没生效、编辑器还停在上一条会话上，接着打字就是把任务投给错的人
  // （2026-11-11 02:1x 实测事故，证据见 docs/handoffs/2026-11-11-night-shift-plan.md §10）。
  const before = await client.evaluate(buildCurrentSessionExpression())
  const beforeSessionId = before?.ok ? before.sessionId ?? null : null
  // 用页面内 DOM click 点「+」，不走坐标：侧栏可滚动时 rect 算出的坐标会偏，
  // 而 CDP 鼠标事件点空不报错 ⇒ 静默「点了没反应」（2026-11-12 实机探针证据见
  // docs/handoffs/2026-11-12-workbuddy-landing-click-fix.md）。
  const clicked = await client.evaluate(buildSpaceClickExpression({ label, kind: 'new-task' }))
  if (!clicked || clicked.error) {
    throw new Error('侧栏找不到空间「' + label + '」的新建按钮（' + (clicked?.error ?? 'no-click') + '）：先在 WorkBuddy 里打开过 ' + cwd + ' 再重试')
  }
  await sleep(1200)
  const snapshot = await waitForEditor(client)
  const after = await client.evaluate(buildCurrentSessionExpression())
  const workspace = snapshot?.chips?.workspace ?? null
  if (!workspace) {
    // 这条分支以前是「读到 null 就当通过」，等于永不校验。显式说明，落点改由会话 id + sessions.cwd 判。
    log('[warn] 读不到 chips.workspace（该字段在会话里恒为 null），工作区改由「会话 id 是否切换」+「sessions.cwd」判定')
  } else if (!workspaceMatches(workspace, cwd)) {
    // chips.workspace 有两种形态：会话里为 null；草稿里是**空间名**（如 "wt-2"），
    // 个别版本可能是完整 cwd。所以路径形态与 cwd 比、否则与空间名比（2026-11-12 实测两种都见过）。
    throw new Error('点「+」后工作区不是 ' + cwd + '（空间名 ' + label + '），而是 ' + workspace + '（拒绝在错的目录派活）')
  }
  const landing = judgeLanding({
    beforeSessionId,
    afterSessionId: after?.ok ? after.sessionId ?? null : null,
    expectedCwd: cwd,
  })
  if (!landing.ok) {
    throw new Error('[refuse] ' + landing.reason + '\n  先在 WorkBuddy 里手动打开「' + label + '」空间、点 + 开一张空草稿，确认编辑器是空的再重试')
  }
  // `verified:false` 的放行分支（目前只有 switched-unverified）要一份草稿证据：
  // 以前这条直接放行，但 DOM click 本身不再产生「点没点中」的信号，所以必须由界面状态
  // 证明「这确实是一张空草稿」（判定逻辑与单测在 attach.mjs 的 judgeFreshDraft）。
  if (!landing.verified) {
    const judged = judgeFreshDraft(snapshot)
    if (!judged.fresh) {
      throw new Error(
        '[refuse] 点了「+」但没拿到「这是新草稿」的证据（' + judged.reason +
        '）：拒绝在身份不明的会话上打字。先在 WorkBuddy 里手动开一张空草稿再重试',
      )
    }
    log('[ok] 已确认是新草稿（currentSessionId=null / messageCount=0 / 编辑器为空），落点待发送后由 sessions.cwd 证实')
  }
  return { snapshot, label, workspace, beforeSessionId, landing }
}

/** 切到某条会话：优先按 sessionId 找卡片，找不到就退回该空间下第一张卡片。 */
async function resumeSession(client, { sessionId, cwd }) {
  let rect = null
  if (sessionId) rect = await client.evaluate(buildSpaceActionExpression({ sessionId }))
  if ((!rect || rect.error) && cwd) rect = await client.evaluate(buildSpaceActionExpression({ label: spaceLabelForCwd(cwd), kind: 'card' }))
  if (!rect || rect.error) return { ok: false, reason: rect?.error ?? 'no-rect' }
  await clickRect(client, rect)
  await sleep(1500)
  const snapshot = await waitForEditor(client)
  const current = await client.evaluate(buildCurrentSessionExpression())
  return { ok: true, snapshot, currentSessionId: current?.sessionId ?? null, reason: current?.reason ?? null }
}

/**
 * 发送后短轮询：等会话落库并核对 cwd。
 *
 * 为什么是「发送后」而不是「开草稿时」：新会话要等第一条消息发出才写进 sessions 表，
 * 开草稿那一刻库里根本没有这一行，无从核对。所以只能：发完立刻查，查不到如实标「未证实」，
 * 但「查到了却不符」必须当场拦下——不能等 15 分钟回复完才发现活干在错的目录。
 */
async function confirmLanding(client, { expectedCwd, timeoutMs = 8000 }) {
  const deadline = Date.now() + timeoutMs
  let sessionId = null
  let landedCwd = null
  while (Date.now() < deadline) {
    const current = await client.evaluate(buildCurrentSessionExpression())
    if (current?.ok && current.sessionId) {
      sessionId = String(current.sessionId)
      const session = readSession(sessionId)
      if (session?.cwd) {
        landedCwd = session.cwd
        break
      }
    }
    await sleep(700)
  }
  const judged = judgeLanding({ afterSessionId: sessionId, landedCwd, expectedCwd })
  return { ...judged, sessionId, landedCwd }
}

async function focusEditor(client) {
  const ok = await client.evaluate(buildClearEditorExpression())
  if (!ok) return false
  await client.key('Backspace', 'Backspace', 8)
  await sleep(120)
  return true
}

function squash(text) {
  return String(text == null ? '' : text).replace(/\s+/g, '')
}

async function typePrompt(client, text) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await focusEditor(client)
    await client.insertText(text)
    await sleep(250)
    const snapshot = await client.evaluate(buildSnapshotExpression())
    const typed = squash(snapshot?.editorText)
    const wanted = squash(text)
    if (typed.length > 0 && (typed === wanted || wanted.startsWith(typed.slice(0, 40)))) {
      return snapshot
    }
    await focusEditor(client)
  }
  throw new Error('输入框写不进任务文本（Slate 容器可能变了，先跑 status 看 hasEditor/editorText）')
}

async function waitForSettled({ client, baselineCount, baselineMessageCount, baselineReply, timeoutMs, onTick }) {
  const deadline = Date.now() + timeoutMs
  let previous = null
  let stable = 0
  let snapshot = null
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    snapshot = await client.evaluate(buildSnapshotExpression())
    if (!snapshot) continue
    if (onTick) onTick(snapshot)
    const state = readRunState(snapshot)
    // 提问卡：外派 agent 反向提问把编辑器占住，再等也不会自己往下走（见 attach.mjs:isAskCardPending）。
    if (isAskCardPending(snapshot)) return { settled: false, askCard: true, snapshot, reply: extractReply(snapshot) }
    const reply = extractReply(snapshot)
    const settledNow = isSettledSignal({
      runState: state,
      agentCount: snapshot.agentCount ?? 0,
      messageCount: snapshot.messageCount ?? 0,
      replyText: reply?.text ?? null,
      baselineCount,
      baselineMessageCount,
      baselineReply,
    })
    if (settledNow) {
      if (previous !== null && reply.text === previous) stable += 1
      else stable = 0
      previous = reply.text
      if (stable >= 1) return { settled: true, snapshot, reply }
    } else {
      stable = 0
      previous = reply ? reply.text : null
    }
  }
  return { settled: false, snapshot, reply: extractReply(snapshot ?? {}) }
}

/** 从快照里挑出提问卡正文：优先最后一条用户侧消息（卡片就挂在那），拿不到退回编辑器占位文案。 */
function extractAskCardText(snapshot) {
  const messages = Array.isArray(snapshot?.lastMessages) ? snapshot.lastMessages : []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = String(messages[index]?.text ?? '').trim()
    if (text && /请裁定|请选择|哪条|1\s|选项/.test(text)) return text
  }
  return String(snapshot?.editorText ?? '').trim()
}

function writeArtifacts(runId, payload) {
  // 产物只是旁路记录：落点由 resolveRuntimeDir() 一次性探测（先 .runtime，不可写退 wt-2/.batch），
  // 两个落点都不可写就整体跳过，**一次都不再尝试**——夜间沙箱下每次写入都可能弹一次提权申请。
  const dir = path.join(resolveRuntimeDir() || RUNTIME_CANDIDATES[0], 'attach', runId)
  if (artifactsDisabled()) return { skipped: true, reason: 'runtime-not-writable(probe)', dir }
  try {
    fs.mkdirSync(dir, { recursive: true })
    const write = (name, value) => fs.writeFileSync(path.join(dir, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2), 'utf8')
    write('prompt.md', payload.prompt ?? '')
    write('meta.json', payload.meta ?? {})
    if (payload.reply) write('reply.md', payload.reply)
    if (payload.snapshotBefore) write('snapshot-before.json', payload.snapshotBefore)
    if (payload.snapshotFinal) write('snapshot-final.json', payload.snapshotFinal)
    return dir
  } catch (error) {
    return { skipped: true, reason: error?.code ?? error?.message ?? String(error), dir }
  }
}

function printMarkers(tailText) {
  let markers = []
  try {
    markers = extractMarkers(tailText)
  } catch {
    markers = []
  }
  log('--- queue markers ---')
  log(JSON.stringify(markers))
  if (markers.length) {
    const last = markers[markers.length - 1]
    log('last-marker=' + (last.id ?? '?') + '/' + (last.state ?? '?') + ' terminal=' + String(isTerminalQueueMarker(markers, markers.length - 1)))
  }
  return markers
}

async function commandStatus(args) {
  const { client, meta } = await openPage({ port: args.port, requireEditor: false })
  try {
    const snapshot = await waitForEditor(client, 8000)
    const record = readSessionRecord()
    const recent = recentSessions({ cwd: args.cwd, limit: 8 })
    const session = record?.sessionId ? readSession(record.sessionId) : null
    const payload = {
      port: meta.port,
      app: meta.version,
      space: spaceLabelForCwd(args.cwd),
      page: { url: snapshot?.url ?? meta.page.url, editor: Boolean(snapshot?.hasEditor) },
      runState: readRunState(snapshot),
      askCardPending: isAskCardPending(snapshot),
      chips: snapshot?.chips ?? null,
      currentSessionId: snapshot?.currentSessionId ?? null,
      messageCount: snapshot?.messageCount ?? 0,
      agentCount: snapshot?.agentCount ?? 0,
      replyPreview: extractReply(snapshot)?.text?.slice(0, 300) ?? null,
      recordedSession: session ? { ...session } : null,
      sessionFile: record,
      modelPolicy: {
        now: describeModelPolicy(),
        allowed: ALLOWED_MODELS,
        auto: !args.policyOff,
      },
      recentSessions: recent.map(row => ({ id: row.id, title: row.custom_title ?? row.title, status: row.status, cwd: row.cwd })),
    }
    log(JSON.stringify(payload, null, 2))
    return EXIT.ok
  } finally {
    client.close()
  }
}

async function commandRead(args) {
  const { client } = await openPage({ port: args.port })
  try {
    const snapshot = await client.evaluate(buildSnapshotExpression())
    const reply = extractReply(snapshot)
    if (args.json) log(JSON.stringify({ reply: reply?.text ?? null, messageCount: snapshot?.messageCount ?? 0, agentCount: snapshot?.agentCount ?? 0, chips: snapshot?.chips ?? null }, null, 2))
    else log(reply?.text ?? '(没有可读的助手正文)')
    return EXIT.ok
  } finally {
    client.close()
  }
}

async function commandMarkers(args) {
  const { client } = await openPage({ port: args.port })
  try {
    const tail = await client.evaluate(buildTailTextExpression())
    if (args.json) log(JSON.stringify({ markers: extractMarkers(tail ?? ''), tailLength: String(tail ?? '').length }, null, 2))
    else printMarkers(tail ?? '')
    return EXIT.ok
  } finally {
    client.close()
  }
}

async function commandSessions(args) {
  const rows = recentSessions({ cwd: args.all ? undefined : args.cwd, limit: args.limit })
  log(JSON.stringify({ cwd: args.all ? null : args.cwd, sessions: rows }, null, 2))
  return EXIT.ok
}

async function commandSend(args, prompt, { forceNewSession, modelTarget }) {
  const runId = createRunId() + '-' + slugify(prompt.split('\n')[0] ?? '')
  const startedAt = Date.now()
  // 前提探测：产物与会话记录的落点在一开始就定下来（先 .runtime，不可写退 wt-2/.batch）。
  // 夜间定时卡跑在受限沙箱里，任何一次写入都可能弹一次提权申请；无人值守时这等于卡死投递链。
  // 探测只做一次、结果缓存，后续同进程内的写入不再触发新的申请。
  resolveRuntimeDir()
  if (artifactsDisabled()) {
    log('[warn] .runtime 与 wt-2/.batch 都不可写，本次跳过产物与会话记录落盘（不影响投递）')
  }
  const { client, meta } = await openPage({ port: args.port })
  try {
    const snapshotBefore = await client.evaluate(buildSnapshotExpression())
    let sessionId = null
    let how = 'current'

    if (forceNewSession) {
      const opened = await openSpaceDraft(client, { cwd: args.cwd })
      how = 'space-new-task'
      log('[ok] 已在空间「' + opened.label + '」下开新会话草稿（工作区=' + (opened.workspace ?? '由目录决定') + '）')
    } else {
      const pick = args.session ?? readSessionRecord()?.sessionId ?? recentSessions({ cwd: args.cwd, limit: 1 })[0]?.id ?? null
      const resumed = await resumeSession(client, { sessionId: pick, cwd: args.cwd })
      if (!resumed.ok) {
        log('[warn] 找不到可复用的会话卡片（' + (resumed.reason ?? 'unknown') + '），改为新开草稿')
        const opened = await openSpaceDraft(client, { cwd: args.cwd })
        how = 'space-new-task(fallback)'
        log('[ok] 已在空间「' + opened.label + '」下开新会话草稿')
      } else {
        sessionId = resumed.currentSessionId ?? pick ?? null
        how = 'resume-card'
        log('[ok] 复用会话 ' + (sessionId ?? '?') + '（' + how + '）')
      }
    }

    if (sessionId) {
      const session = readSession(sessionId)
      if (session) {
        const actual = normalizePath(session.cwd)
        const expected = normalizePath(args.cwd)
        if (actual !== expected && !args.force) {
          fail('[refuse] 目标会话不在要求的目录里干活：\n  session=' + session.id + '\n  cwd=' + session.cwd + '\n  期望=' + args.cwd + '\n（确认无误可加 --force）')
        }
        writeSessionRecord({ sessionId: session.id, cwd: session.cwd, savedAt: new Date().toISOString(), runId })
      }
    }

    const modelResult = await ensureModel(client, modelTarget.model)
    assertAllowedModel(modelResult.model, { force: args.force })
    if (modelResult.skipped) {
      log('[warn] 未自动选型（WORKBUDDY_MODEL_POLICY=off）；当前模型 = ' + (modelResult.model ?? '(未知)'))
    } else if (modelResult.changed) {
      log('[ok] 模型已切到 ' + modelResult.model)
    } else {
      log('[ok] 模型 = ' + modelResult.model + '（已是目标值）')
    }
    if (modelTarget.policy?.reason) log('[..] 选型依据：' + modelTarget.policy.reason)

    const typed = await typePrompt(client, prompt)
    // 基线取「打字的这一次快照」：此时目标会话/新草稿已经载入，才是可信的起点
    const baselineCount = typed?.agentCount ?? 0
    const baselineMessageCount = typed?.messageCount ?? 0
    const baselineReply = extractReply(typed)?.text ?? null
    const clicked = await clickSelector(client, SELECTORS.sendButton)
    if (!clicked) {
      // 兜底：回车提交
      await client.key('Enter', 'Enter', 13)
    }
    await sleep(800)
    const afterSend = await client.evaluate(buildSnapshotExpression())
    if (squash(afterSend?.editorText ?? '').length > 0 && squash(prompt).startsWith(squash(afterSend.editorText).slice(0, 20))) {
      log('[warn] 发送后输入框仍有内容，可能没点中发送按钮')
    }

    // 落点确认（2026-11-11 夜跑事故的止损点）：消息已经发出去了，此刻立刻核对这条会话落在哪个目录。
    // 「查到且不符」直接失败——不这样，接下来 15 分钟等的回复可能根本不是这条任务书的产物。
    const landing = await confirmLanding(client, { expectedCwd: args.cwd, timeoutMs: 8000 })
    if (!landing.ok) {
      log('[refuse] 任务已发出，但落点不对：' + landing.reason)
      log('  ⚠ 不要直接重跑（同一条任务书会投递两次）；先去 WorkBuddy 界面确认并处理那条会话')
      return EXIT.fail
    }
    if (landing.sessionId && !sessionId) sessionId = landing.sessionId
    if (!landing.verified) {
      log('[warn] ' + landing.reason + '（产物里记 landing=unverified，事后按 sessions.cwd 复核）')
    } else {
      log('[ok] 落点已证实：会话 ' + landing.sessionId + ' @ ' + landing.landedCwd)
    }

    if (args.noWait) {
      if (!sessionId && afterSend?.currentSessionId) sessionId = afterSend.currentSessionId
      // 拉一个 detached 子进程盯这轮会话：WorkBuddy 收尾时由它写信号件叫醒联络人。
      // 没有它，--no-wait 之后「谁来叫醒联络人」这一环就空着（2026-11-27 C5-pre 事故）。
      if (args.signal) {
        const signalAbs = assertInWatchDir('workbuddy', args.signal)
        const title = args.signalTitle ?? slugify(prompt.split('\n')[0] ?? 'workbuddy')
        const logDir = path.join(resolveRuntimeDir() || RUNTIME_CANDIDATES[0], 'settle')
        const logFile = path.join(logDir, 'settle-' + slugify(title).slice(0, 40) + '-' + Date.now() + '.log')
        const child = spawn(process.execPath, [
          process.argv[1], 'settle-signal',
          '--port', String(args.port),
          '--signal', signalAbs,
          '--title', title,
          '--expect-session', sessionId ?? '',
          '--baseline-agents', String(baselineCount),
          '--baseline-messages', String(baselineMessageCount),
          '--timeout', String(Math.max(Math.round(args.timeout / 1000), 600)),
          '--delay', '5',
          ...(args.receipt ? ['--receipt', args.receipt] : []),
          '--log', logFile,
        ], { detached: true, stdio: 'ignore', windowsHide: true })
        child.unref()
        log('[settler] 已拉起看护进程 pid=' + child.pid + '（基线 agents=' + baselineCount + ' messages=' + baselineMessageCount + '）')
        log('[settler-log] ' + logFile)
      }
      // 消息已经发出去了：产物落盘失败（例如沙箱对 .runtime 没有写权限）不能让整条命令以失败退出，
      // 否则调用方会重试，同一条任务书就会被投递两次。
      try {
        const dir = writeArtifacts(runId, { prompt, meta: summarizeSnapshot(afterSend, { timeoutMs: 0 }), snapshotBefore, snapshotFinal: afterSend })
        log(dir?.skipped ? '[warn] 已发送（--no-wait），未等待回复。产物跳过：' + dir.reason : '[ok] 已发送（--no-wait），未等待回复。产物：' + dir)
      } catch (error) {
        log('[warn] 已发送（--no-wait），但产物目录写入失败（不影响投递）：' + (error?.message ?? error))
      }
      return EXIT.ok
    }

    log('[..] 等待回复（超时 ' + Math.round(args.timeout / 1000) + 's）')
    const result = await waitForSettled({
      client,
      baselineCount,
      baselineMessageCount,
      baselineReply,
      timeoutMs: args.timeout,
      onTick: snapshot => {
        if (!sessionId && snapshot?.currentSessionId) sessionId = snapshot.currentSessionId
      },
    })
    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    const session = sessionId ? readSession(sessionId) : null
    const dir = writeArtifacts(runId, {
      prompt,
      meta: {
        runId,
        sessionId: sessionId ?? null,
        cwd: session?.cwd ?? args.cwd,
        how,
        landing: {
          verdict: landing.verdict,
          verified: landing.verified,
          sessionId: landing.sessionId,
          landedCwd: landing.landedCwd,
          reason: landing.reason,
        },
        model: modelResult.model,
        modelPolicy: {
          how: modelTarget.how,
          window: modelTarget.policy?.window ?? null,
          reason: modelTarget.policy?.reason ?? null,
        },
        elapsedSeconds: elapsed,
        settled: result.settled,
        snapshot: summarizeSnapshot(result.snapshot, { timeoutMs: args.timeout }),
      },
      reply: result.reply?.text ?? '',
      snapshotBefore,
      snapshotFinal: result.snapshot,
    })

    if (sessionId) {
      const actual = normalizePath(session?.cwd ?? args.cwd)
      if (actual !== normalizePath(args.cwd) && !args.force) {
        log('[refuse] 回复所在的会话不在目标目录：session=' + sessionId + ' cwd=' + (session?.cwd ?? '?') + ' 期望=' + args.cwd)
        return EXIT.fail
      }
      writeSessionRecord({ sessionId, cwd: session?.cwd ?? args.cwd, savedAt: new Date().toISOString(), runId })
    }

    if (result.askCard) {
      const askText = extractAskCardText(result.snapshot)
      if (dir && !dir.skipped) {
        try { fs.writeFileSync(path.join(dir, 'ask-card.md'), askText + '\n', 'utf8') } catch (error) { /* 留证失败不影响退出码 */ }
      }
      log('[blocked] 会话被「提问卡」占住，等你裁定后重投：' + (sessionId ?? '?'))
      log('产物：' + (dir?.skipped ? '跳过（' + dir.reason + '）' : dir))
      if (askText) log('--- ask card ---\n' + askText.slice(0, 3000))
      return EXIT.askCard
    }

    if (!result.settled) {
      log('[fail] 等不到稳定的完成信号（' + elapsed + 's）；产物：' + (dir?.skipped ? '跳过（' + dir.reason + '）' : dir))
      if (result.reply?.text) log(result.reply.text.slice(0, 1500))
      return EXIT.timeout
    }

    log('[ok] 完成，用时 ' + elapsed + 's；会话 ' + (sessionId ?? '?') + '；产物：' + (dir?.skipped ? '跳过（' + dir.reason + '）' : dir))
    if (args.json) log(JSON.stringify({ settled: true, sessionId: sessionId ?? null, elapsedSeconds: elapsed, reply: result.reply?.text ?? '' }, null, 2))
    else log('--- reply ---\n' + (result.reply?.text ?? ''))

    const tail = await client.evaluate(buildTailTextExpression())
    printMarkers(tail ?? '')
    return EXIT.ok
  } finally {
    client.close()
  }
}

function usage() {
  return [
    'WorkBuddy attach 通道（复用桌面登录态，单会话多轮，默认只认 wt-2）',
    '',
    '归属：默认固定 wt-2；要投别的目录先 set WORKBUDDY_ALLOWED_CWDS=<绝对路径>[;<绝对路径>] 注册，用完即失效',
    '模型：task 必须显式 --model（不再按时段自动挑）。跨源评审可点名 GLM-5.3 / Qwen 3.8 Flash 等并同时加 --force；',
    '      --force 只对 model-policy.mjs 的 CROSS_SOURCE_MODELS 名单生效，付费 Hy4(0.29x) 一律拒绝。',
    '',
    '  node scripts/workbuddy/workbuddy-attach.mjs status            # 只读诊断：端口/页面/空间/模型/权限/会话',
    '  node scripts/workbuddy/workbuddy-attach.mjs sessions          # 读本地 sqlite 里 wt-2 的历史会话',
    '  node scripts/workbuddy/workbuddy-attach.mjs read              # 读当前会话最后一条回复',
    '  node scripts/workbuddy/workbuddy-attach.mjs markers           # 只读队列标记（## [T1] DONE …）',
    '  node scripts/workbuddy/workbuddy-attach.mjs task "任务"        # 派活：默认复用上次会话',
    '  node scripts/workbuddy/workbuddy-attach.mjs task "任务" --new  # 强制在 wt-2 空间开新会话',
    '  node scripts/workbuddy/workbuddy-attach.mjs task --file 任务书.md',
    '  node scripts/workbuddy/workbuddy-attach.mjs say "继续执行 T2"  # 同一会话追问（不新建）',
    '  node scripts/workbuddy/workbuddy-attach.mjs signals          # 只读：watch 目录里的信号件还停在 PENDING 的有哪些',
    '  node scripts/workbuddy/workbuddy-attach.mjs settle-signal --signal 路径 --baseline-agents N --baseline-messages M',
    '                                                              # 内部用：等这轮收尾后写信号件（被 task --no-wait 以 detached 子进程拉起）',
    '',
    '选项：--session <id> 指定会话 · --timeout 秒（默认 900） · --json · --no-wait --signal 信号件路径 · --receipt 回执路径 · --port 9333',
    '     --cwd <目录>（只允许 wt-2；改到别处会被拒） · --force（越过归属护栏，排障用，报告里写明）',
    '     --model <名字> 显式指定模型（视为人工授权，绕过高峰拦截）',
    '     --no-wait 必须带 --signal，且路径须在 relay watch 目录内（C:\\dsh-relay\\signals\\workbuddy）：',
    '       不给信号件就没有东西会在完成时叫醒联络人（2026-11-27 C5-pre 事故的教训）。',
    '',
    '模型选择（2026-11-25 主人定）：',
    '  · 不点名 --model → 固定用 DeepSeek-V4.1-Flash（普通外派默认；不按时段/价格自动挑）',
    '  · 跨源评审（EXT-REVIEW / 「跨源」/ 四家模型名）必须点名：--model "GLM-5.3" --force 或 --model "Hy4 flash"',
    '  · --force 只对跨源名单生效；付费 Hy4(0.29x) 一律拒，--force 也不放行',
    '  · 关掉选型：set WORKBUDDY_MODEL_POLICY=off',
    '',
    '退出码：0 完成 / 1 失败 / 2 未连接（NEED_HUMAN_DEBUG） / 4 超时 / 5 高峰期不派活 / 6 被提问卡占住（已落 ask-card.md，等裁定）',
  ].join('\n')
}

/**
 * 由 task --no-wait 以 detached 子进程拉起：盯住这轮会话，收尾即写信号件。
 *
 * 为什么必须由进程来写：--no-wait 的调用方当场返回，WorkBuddy 一小时后才交件，
 * 中间没有任何人记得「该叫醒联络人」——2026-11-27 C5-pre 就丢在这一环。
 * 判据沿用 attach.mjs 的 isSettledSignal（UI idle + 出现新回复），并要求连续 3 次稳定；
 * 有回执文件时以回执出现为准，没有才退到「界面静默 quiet-min 秒」并在信号件里标明低置信。
 */
async function commandSettleSignal(args) {
  const signalAbs = assertInWatchDir('workbuddy', args.signal)
  const startedAt = Date.now()
  // 事件账本：abort / 阻塞 / 超时 / 跳过 / 写成，都留一条（detached 起来的东西没人翻自己的 log）
  const evt = (event, detail) => appendSettleEvent({ channel: 'workbuddy', event, signal: signalAbs, detail })
  const quietMinMs = Math.max(30, Number(args.quietMin) || 180) * 1000
  const timeoutMs = args.timeout
  const receiptPath = args.receipt ? path.resolve(args.receipt) : null
  const appendLog = line => {
    if (!args.settleLog) return
    try {
      fs.mkdirSync(path.dirname(args.settleLog), { recursive: true })
      fs.appendFileSync(args.settleLog, '[' + new Date().toISOString() + '] ' + line + '\n', 'utf8')
    } catch { /* 日志写不进去不影响信号件本身 */ }
  }
  const receiptAfter = () => {
    if (!receiptPath) return false
    try {
      return fs.statSync(receiptPath).mtimeMs >= startedAt
    } catch {
      return false
    }
  }
  appendLog('start signal=' + signalAbs + ' baseline=' + args.baselineAgents + '/' + args.baselineMessages
    + ' timeout=' + timeoutMs + 'ms quietMin=' + quietMinMs / 1000 + 's receipt=' + (receiptPath ?? '-'))
  await sleep(args.settleDelay * 1000)
  const { client } = await openPage({ port: args.port })
  try {
    let signature = null
    let steady = 0
    let lastActivityAt = Date.now()
    let snapshot = null
    let reply = null
    while (Date.now() - startedAt < timeoutMs) {
      snapshot = await client.evaluate(buildSnapshotExpression())
      // 锁会话：settler 盯的是派单时那条会话，被切走就停手（否则按别人的会话判收尾、叫错人）。
      if (args.expectSession && snapshot?.currentSessionId && snapshot.currentSessionId !== args.expectSession) {
        appendLog('abort: 会话已切走（期望 ' + args.expectSession + '，实际 ' + snapshot.currentSessionId + '），不写件')
        evt('abort', 'session 变了：期望 ' + args.expectSession + '，实际 ' + snapshot.currentSessionId)
        process.stderr.write('[settler] 会话已切走，信号件不写\n')
        return EXIT.fail
      }
      if (isAskCardPending(snapshot)) {
        appendLog('ask-card: 被提问卡占住，信号件不写')
        evt('blocked-ask', '界面上有提问卡等人回答，收尾判定不可靠')
        process.stderr.write('[settler] 被提问卡占住，信号件不写（等人裁定）\n')
        return EXIT.fail
      }
      reply = extractReply(snapshot)
      const state = readRunState(snapshot)
      const settledNow = isSettledSignal({
        runState: state,
        agentCount: snapshot?.agentCount ?? 0,
        messageCount: snapshot?.messageCount ?? 0,
        replyText: reply?.text ?? null,
        baselineCount: args.baselineAgents,
        baselineMessageCount: args.baselineMessages,
        baselineReply: '',
      })
      const current = state + '|' + (snapshot?.messageCount ?? 0) + '|' + (snapshot?.agentCount ?? 0)
        + '|' + (reply?.text?.length ?? 0) + '|' + (snapshot?.editorText?.length ?? 0)
      if (!settledNow || current !== signature) {
        lastActivityAt = Date.now()
        steady = 0
      } else {
        steady += 1
      }
      signature = current
      const idleMs = Date.now() - lastActivityAt
      const domIdle = settledNow && steady >= 3
      const byReceipt = domIdle && receiptAfter()
      const byQuiet = domIdle && idleMs >= quietMinMs
      if (byReceipt || byQuiet) {
        // 本单派出后已经叫醒过联络人（任务书让执行方自己写过信号件），就不再叫第二遍。
        if (deliveredSince({ mention: mentionOf('workbuddy'), sinceMs: startedAt, target: path.basename(signalAbs) })) {
          evt('skip', 'relay 已在本单派出后叫醒过联络人（多半执行方自己写过信号件）')
          appendLog('skip: relay 已在本单派出后叫醒过联络人，不再重复写件')
          log('[settler] 联络人已被叫醒过（执行方自己写过信号件），跳过')
          return EXIT.ok
        }
        const evidence = byReceipt
          ? '回执文件已出现（' + receiptPath + '）'
          : '界面静默 ' + Math.round(idleMs / 1000) + 's 且未见回执文件（低置信：请自行核对是否真交件）'
        const written = writeSignal({
          channel: 'workbuddy',
          path: signalAbs,
          title: args.signalTitle ?? '(未命名)',
          receiptPath,
          replyTail: reply?.text ?? '',
          evidence,
        })
        appendLog('done: ' + (written ?? '(已存在，跳过)') + ' (依据: ' + evidence + ', waited=' + Math.round((Date.now() - startedAt) / 1000) + 's)')
        evt('written', (written ?? '(已有件，未覆盖)') + ' · ' + evidence)
        log(written
          ? '[settler] 信号件已写：' + written + '（依据：' + (byReceipt ? '回执文件' : '界面静默') + '）'
          : '[settler] 信号件已存在，跳过（同一收尾不重复叫醒）')
        return EXIT.ok
      }
      await sleep(POLL_INTERVAL_MS)
    }
    appendLog('timeout: 等不到收尾（state=' + readRunState(snapshot) + ' steady=' + steady + '）')
    evt('timeout', 'state=' + readRunState(snapshot) + ' steady=' + steady)
    process.stderr.write('[settler] 超时：没有等到可判定的收尾，信号件不写\n')
    return EXIT.fail
  } finally {
    client.close()
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const command = argv[0] ?? 'help'
  const { flags, options, positionals } = parseArgv(argv.slice(1), BOOLEAN_FLAGS)
  const args = {
    port: Number(options.get('port') ?? DEFAULT_PORT),
    timeout: Number(options.get('timeout') ?? DEFAULT_TIMEOUT_MS / 1000) * 1000,
    cwd: path.resolve(options.get('cwd') ?? DEFAULT_CWD),
    json: matches(flags, 'json'),
    noWait: matches(flags, 'no-wait'),
    force: matches(flags, 'force'),
    all: matches(flags, 'all'),
    limit: Number(options.get('limit') ?? 12),
    session: options.get('session') ?? null,
    model: options.get('model') ?? null,
    signal: options.get('signal') ?? null,
    receipt: options.get('receipt') ?? null,
    policyOff: String(process.env.WORKBUDDY_MODEL_POLICY ?? '').trim().toLowerCase() === 'off',
    // settle-signal 专用：收尾判定与日志
    signalTitle: options.get('title') ?? null,
    quietMin: Number(options.get('quiet-min') ?? 180),
    baselineAgents: Number(options.get('baseline-agents') ?? 0),
    baselineMessages: Number(options.get('baseline-messages') ?? 0),
    expectSession: options.get('expect-session') ?? null,
    settleDelay: Number(options.get('delay') ?? 5),
    settleLog: options.get('log') ?? null,
  }

  if (command === 'help' || matches(flags, 'help')) { log(usage()); return EXIT.ok }

  // 归属护栏：--cwd 默认只准指向 wt-2，另可用 WORKBUDDY_ALLOWED_CWDS 注册额外目录
  //（归属表见 docs/agents/worktree-parallel.md §3.1）
  const pin = checkPinnedCwd({ cwd: args.cwd, pinnedCwd: DEFAULT_CWD, allowedCwds: ALLOWED_CWDS, force: args.force })
  if (!pin.ok) {
    process.stderr.write('[refuse] ' + pin.reason + '\n')
    return EXIT.fail
  }
  if (pin.forced) process.stderr.write('[warn] --force 已越过归属护栏：本次目标 = ' + args.cwd + '\n')

  // 2026-11-27 两处闸门（M4）：--no-wait 必须配 --signal；且不许只守着 task 一条路径——
  // `say --no-wait` 同样是 fire-and-forget，漏信号就是第二次 C5-pre。
  // settle-signal 是看护进程自己，天生「带 --signal、不带 --no-wait」，必须放它进来：
  // 这条闸上移到分发层后曾把 settler 自己挡在门外（stdio ignore，失败没人看得见＝静默漏叫）。
  if (command === 'settle-signal') {
    if (!args.signal) fail('settle-signal 需要 --signal <信号件路径>')
    assertInWatchDir('workbuddy', args.signal)
  } else {
    if (args.noWait) {
      if (!args.signal) {
        fail('--no-wait 必须同时给 --signal <信号件路径>：否则没人知道这单什么时候收尾，'
          + '联络人不会被叫醒。\n'
          + '  放进 watch 目录（只有 relay 会看）：\n'
          + watchDirsOf('workbuddy').map(dir => '    ' + dir).join('\n')
          + '\n  例如--no-wait --signal C:\\dsh-relay\\signals\\workbuddy\\<卡号>.done')
      }
      assertInWatchDir('workbuddy', args.signal)
    }
    if (args.signal && !args.noWait) {
      fail('--signal 只配合 --no-wait 使用：同步等待时调用方自己就拿到了结果，不需要信号件')
    }
  }

  try {
    if (command === 'status') return await commandStatus(args)
    if (command === 'read') return await commandRead(args)
    if (command === 'markers') return await commandMarkers(args)
    if (command === 'sessions') return await commandSessions(args)
    if (command === 'say') {
      const prompt = positionals.join(' ').trim()
      if (!prompt) fail('say 需要一段文字')
      const modelTarget = resolveModelTarget(args, { command: 'say', prompt })
      if (modelTarget.blocked) return EXIT.peak
      return await commandSend(args, prompt, { forceNewSession: false, modelTarget })
    }
    if (command === 'settle-signal') return await commandSettleSignal(args)
    if (command === 'signals') {
      const dirOverride = options.get('dir')
      const report = scanSignals('workbuddy', dirOverride ? { dirs: [path.resolve(dirOverride)] } : {})
      log(JSON.stringify(report, null, 2))
      const pendingNames = report.dirs.flatMap(entry => entry.files.filter(file => !file.done).map(file => file.name))
      const recentEvents = readSettleEvents({ channel: 'workbuddy', limit: 5 })
    if (recentEvents.length) {
      log('\n[settler 最近事件]（没写成件的单都在这里，别只看 PENDING 数）')
      for (const ev of recentEvents) log(`  ${ev.at ?? '?'} ${ev.event} ${ev.signal ?? '-'} ${ev.detail ?? ''}`)
    }
    log(`\n[信号件] 待完成 ${report.pending} 件，已就绪 ${report.ready} 件`
        + (pendingNames.length ? `；待完成：${pendingNames.join('、')}` : ''))
      return EXIT.ok
    }
    if (command === 'task') {
      const file = options.get('file')
      const basePrompt = file ? fs.readFileSync(path.resolve(file), 'utf8') : positionals.join(' ').trim()
      if (!basePrompt) fail('task 需要任务文本，或用 --file 指定任务书')
      // 2026-11-27：不再预写占位件（relay 静默 5 秒后照样投，占位件等于叫醒联络人看空件）。
      // 信号件只由 detached settler 在收尾时一次性写全——不往任务正文里塞「自己写信号件」，
      // 否则模型写一份、settler 写一份，同一张卡叫醒两次（隔离审 M1）。
      const signalAbs = args.signal ? assertInWatchDir('workbuddy', args.signal) : null
      const prompt = basePrompt
      const modelTarget = resolveModelTarget(args, { command: 'task', prompt })
      if (modelTarget.blocked) return EXIT.peak
      if (signalAbs) log('[信号件] 收尾时由 settler 写入：' + signalAbs)
      return await commandSend(args, prompt, { forceNewSession: matches(flags, 'new'), modelTarget })
    }
    fail('未知命令：' + command + '\n\n' + usage())
  } catch (error) {
    if (error instanceof NeedHumanDebug) cdpBannerAndExit(error, args.port)
    fail('✗ ' + (error?.stack ?? error))
  }
}

main().then(code => process.exit(code ?? 0)).catch(error => {
  process.stderr.write(String(error?.stack ?? error) + '\n')
  process.exit(1)
})