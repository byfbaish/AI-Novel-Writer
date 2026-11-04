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
 * - 退出码：0 完成 / 1 失败 / 2 未连接（NEED_HUMAN_DEBUG） / 3 兜底 CLI 缺失 / 4 超时 / 5 高峰时段拒绝派活。
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

import { createRunId, slugify, parseArgv } from './cli.mjs'
import { listTargets, connect, createClient, sleep } from '../doubao/cdp.mjs'
import { extractMarkers, isTerminalQueueMarker } from '../doubao/markers.mjs'
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
  buildCurrentSessionExpression,
  readRunState,
  isSettledSignal,
  checkPinnedCwd,
  extractReply,
  summarizeSnapshot,
  buildModelItemsExpression,
  buildModelOptionExpression,
} from './attach.mjs'
import {
  ALLOWED_MODELS,
  buildPeakBanner,
  describeModelPolicy,
  pickModel,
  rejectUnknownModel,
  sameModel,
} from './model-policy.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..')
/** WorkBuddy 的固定工作目录（归属表见 docs/agents/worktree-parallel.md §3.1） */
const DEFAULT_CWD = path.resolve(REPO_ROOT, '..', 'wt-2')
const RUNTIME_ROOT = path.join(REPO_ROOT, '.runtime', 'workbuddy', 'attach')
const SESSION_RECORD = path.join(REPO_ROOT, '.runtime', 'workbuddy', 'last-session.json')

const BOOLEAN_FLAGS = ['--new', '--keep', '--json', '--force', '--no-wait', '--help', '--quiet']

/** parseArgv 存的是去掉 -- 的裸名（见 cli.mjs），这里统一按裸名查，兼容带 -- 的旧写法。 */
function matches(collection, name) {
  return collection.has(name) || collection.has('--' + name)
}

class NeedHumanDebug extends Error {}

const EXIT = { ok: 0, fail: 1, notConnected: 2, cliMissing: 3, timeout: 4, peak: 5 }

/**
 * 选模型 + 高峰拦截（纯策略见 model-policy.mjs）。
 *
 * 优先顺序：--model 显式指定（视为人工授权，绕过高峰） > 环境变量 WORKBUDDY_MODEL_POLICY=off（不自动选型） > 时段策略。
 * 返回 {model|null, blocked?, how}；blocked 时调用方直接 exit 5，不碰 CDP。
 */
function resolveModelTarget(args, { command, prompt }) {
  const explicit = args.model ? String(args.model).trim() : ''
  if (explicit) {
    const rejected = rejectUnknownModel(explicit)
    if (rejected) fail('[refuse] ' + rejected)
    return { model: explicit, how: 'explicit' }
  }
  if (args.policyOff) return { model: null, how: 'policy-off' }
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
  if (!model || force) return
  const rejected = rejectUnknownModel(model)
  if (rejected) fail('[refuse] ' + rejected + '\n（要临时放行加 --force；建议 --model ' + ALLOWED_MODELS[0] + '）')
}

function normalizePath(value) {
  return String(value == null ? '' : value).split('\\').join('/').replace(/\/+$/, '').toLowerCase()
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

function readSessionRecord() {
  try {
    const raw = fs.readFileSync(SESSION_RECORD, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed.sessionId === 'string' ? parsed : null
  } catch {
    return null
  }
}

function writeSessionRecord(payload) {
  try {
    fs.mkdirSync(path.dirname(SESSION_RECORD), { recursive: true })
    fs.writeFileSync(SESSION_RECORD, JSON.stringify(payload, null, 2) + '\n', 'utf8')
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
  const rect = await client.evaluate(buildSpaceActionExpression({ label, kind: 'new-task' }))
  if (!rect || rect.error) {
    throw new Error('侧栏找不到空间「' + label + '」的新建按钮（' + (rect?.error ?? 'no-rect') + '）：先在 WorkBuddy 里打开过 ' + cwd + ' 再重试')
  }
  await clickRect(client, rect)
  await sleep(1200)
  const snapshot = await waitForEditor(client)
  const workspace = snapshot?.chips?.workspace ?? null
  if (workspace && normalizePath(workspace) !== normalizePath(label)) {
    throw new Error('点「+」后工作区不是 ' + label + '，而是 ' + workspace + '（拒绝在错的目录派活）')
  }
  return { snapshot, label, workspace }
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

function writeArtifacts(runId, payload) {
  const dir = path.join(RUNTIME_ROOT, runId)
  fs.mkdirSync(dir, { recursive: true })
  const write = (name, value) => fs.writeFileSync(path.join(dir, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2), 'utf8')
  write('prompt.md', payload.prompt ?? '')
  write('meta.json', payload.meta ?? {})
  if (payload.reply) write('reply.md', payload.reply)
  if (payload.snapshotBefore) write('snapshot-before.json', payload.snapshotBefore)
  if (payload.snapshotFinal) write('snapshot-final.json', payload.snapshotFinal)
  return dir
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

    if (args.noWait) {
      if (!sessionId && afterSend?.currentSessionId) sessionId = afterSend.currentSessionId
      const dir = writeArtifacts(runId, { prompt, meta: summarizeSnapshot(afterSend, { timeoutMs: 0 }), snapshotBefore, snapshotFinal: afterSend })
      log('[ok] 已发送（--no-wait），未等待回复。产物：' + dir)
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

    if (!result.settled) {
      log('[fail] 等不到稳定的完成信号（' + elapsed + 's）；产物：' + dir)
      if (result.reply?.text) log(result.reply.text.slice(0, 1500))
      return EXIT.timeout
    }

    log('[ok] 完成，用时 ' + elapsed + 's；会话 ' + (sessionId ?? '?') + '；产物：' + dir)
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
    'WorkBuddy attach 通道（复用桌面登录态，单会话多轮，固定 wt-2）',
    '',
    '  node scripts/workbuddy/workbuddy-attach.mjs status            # 只读诊断：端口/页面/空间/模型/权限/会话',
    '  node scripts/workbuddy/workbuddy-attach.mjs sessions          # 读本地 sqlite 里 wt-2 的历史会话',
    '  node scripts/workbuddy/workbuddy-attach.mjs read              # 读当前会话最后一条回复',
    '  node scripts/workbuddy/workbuddy-attach.mjs markers           # 只读队列标记（## [T1] DONE …）',
    '  node scripts/workbuddy/workbuddy-attach.mjs task "任务"        # 派活：默认复用上次会话',
    '  node scripts/workbuddy/workbuddy-attach.mjs task "任务" --new  # 强制在 wt-2 空间开新会话',
    '  node scripts/workbuddy/workbuddy-attach.mjs task --file 任务书.md',
    '  node scripts/workbuddy/workbuddy-attach.mjs say "继续执行 T2"  # 同一会话追问（不新建）',
    '',
    '选项：--session <id> 指定会话 · --timeout 秒（默认 900） · --json · --no-wait · --port 9333',
    '     --cwd <目录>（只允许 wt-2；改到别处会被拒） · --force（越过归属护栏，排障用，报告里写明）',
    '     --model <名字> 显式指定模型（视为人工授权，绕过高峰拦截；只允许 Hy4 / DeepSeek-V4.1-Flash）',
    '',
    '模型策略（自动）：23:00–08:00 用 Hy4（夜间限免）· 工作日 09:00–12:00 / 14:00–18:00 是 DeepSeek',
    '高峰，默认拦下不派活（exit 5）· 其余时段用 DeepSeek-V4.1-Flash（0.11x + 5 折）。',
    '关掉自动选型：set WORKBUDDY_MODEL_POLICY=off',
    '',
    '退出码：0 完成 / 1 失败 / 2 未连接（NEED_HUMAN_DEBUG） / 4 超时 / 5 高峰期不派活',
  ].join('\n')
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
    policyOff: String(process.env.WORKBUDDY_MODEL_POLICY ?? '').trim().toLowerCase() === 'off',
  }

  if (command === 'help' || matches(flags, 'help')) { log(usage()); return EXIT.ok }

  // 归属护栏：--cwd 只能指向 wt-2（归属固定，见 docs/agents/worktree-parallel.md §3.1）
  const pin = checkPinnedCwd({ cwd: args.cwd, pinnedCwd: DEFAULT_CWD, force: args.force })
  if (!pin.ok) {
    process.stderr.write('[refuse] ' + pin.reason + '\n')
    return EXIT.fail
  }
  if (pin.forced) process.stderr.write('[warn] --force 已越过归属护栏：本次目标 = ' + args.cwd + '\n')

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
    if (command === 'task') {
      const file = options.get('file')
      const prompt = file ? fs.readFileSync(path.resolve(file), 'utf8') : positionals.join(' ').trim()
      if (!prompt) fail('task 需要任务文本，或用 --file 指定任务书')
      const modelTarget = resolveModelTarget(args, { command: 'task', prompt })
      if (modelTarget.blocked) return EXIT.peak
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