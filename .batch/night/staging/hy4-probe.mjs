#!/usr/bin/env node
/**
 * Hy4 UI 文本只读探针（2026-11-17 工单 wo-hy4-modelname-20261117）
 *
 * 只做三件事：读快照确认 idle / 点开模型选择器 / 读全部选项逐字文本，然后 Escape 关闭。
 * 不点选、不确认、不派活、不改 model-policy.mjs。
 *
 * 用法：node .batch/night/staging/hy4-probe.mjs [--port 9333] [--shot <png 路径>]
 */
'use strict'

import fs from 'node:fs'
import {
  SELECTORS,
  buildSnapshotExpression,
  buildModelItemsExpression,
  pickPage,
  parseCdpVersion
} from '../../../scripts/workbuddy/attach.mjs'

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt
}
const PORT = Number(arg('--port', 9333))
const SHOT = arg('--shot', null)
const sleep = ms => new Promise(r => setTimeout(r, ms))

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const timer = setTimeout(() => reject(new Error('WebSocket 打开超时')), 8000)
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(ws) })
    ws.addEventListener('error', e => { clearTimeout(timer); reject(new Error('WebSocket 错误: ' + (e?.message || e?.type || 'unknown'))) })
  })
}

function createClient(ws) {
  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', ev => {
    let msg
    try { msg = JSON.parse(ev.data) } catch { return }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
  return {
    send,
    async evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (res?.exceptionDetails) throw new Error('页面异常: ' + (res.exceptionDetails.text || '') + ' ' + (res.exceptionDetails.exception?.description || ''))
      return res?.result?.value
    },
    async clickRect(rect) {
      const base = { x: rect.x, y: rect.y, button: 'left', clickCount: 1 }
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y })
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base })
    },
    async escape() {
      const k = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }
      await send('Input.dispatchKeyEvent', { type: 'keyDown', ...k })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...k })
    }
  }
}

const triggerRectExpr = `(function(s){var n=document.querySelector(s.modelTrigger);if(!n)return null;var r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height,txt:(n.textContent||'').trim()};})(${JSON.stringify(SELECTORS)})`

// 逐字文本：name 列取 textContent 原文（不 trim 之外的处理），同时给 trim 版本与整条 innerText
const rawItemsExpr = `(function(s){var out=[];Array.prototype.slice.call(document.querySelectorAll(s.modelItem)).forEach(function(n,i){var nameEl=n.querySelector(s.modelItemName);out.push({i:i,raw:nameEl?nameEl.textContent:null,trim:nameEl?(nameEl.textContent||'').trim():'',credits:(n.querySelector('.cr-model-selector__item-credits')||{}).textContent||null,selected:n.classList.contains('cr-model-selector__item--selected'),itemText:(n.innerText||n.textContent||'').trim()});});return out;})(${JSON.stringify(SELECTORS)})`

async function main() {
  const startedAt = new Date()
  const version = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json()
  const targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()
  const page = pickPage(targets)
  if (!page) throw new Error('端口 ' + PORT + ' 上没有 WorkBuddy 渲染层页面')
  const ws = await connect(page.webSocketDebuggerUrl)
  const client = createClient(ws)

  const before = await client.evaluate(buildSnapshotExpression())
  const rect = await client.evaluate(triggerRectExpr)
  if (!rect) throw new Error('找不到模型选择器触发器 ' + SELECTORS.modelTrigger)
  await client.clickRect(rect)
  await sleep(800)

  const items = await client.evaluate(rawItemsExpr)
  const normalized = await client.evaluate(buildModelItemsExpression())
  let shot = null
  if (SHOT) {
    const res = await client.send('Page.captureScreenshot', { format: 'png' })
    if (res?.data) { fs.writeFileSync(SHOT, Buffer.from(res.data, 'base64')); shot = SHOT }
  }
  await client.escape()
  await sleep(300)
  const after = await client.evaluate(buildSnapshotExpression())
  const selectorClosed = await client.evaluate(`(function(s){return document.querySelectorAll(s.modelItem).length;})(${JSON.stringify(SELECTORS)})`)
  ws.close()

  const hy4 = (items || []).filter(x => /hy4/i.test(x.trim) || /hy4/i.test(x.itemText))
  const out = {
    readAt: startedAt.toISOString(),
    readAtLocal: startedAt.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }),
    port: PORT,
    cdp: parseCdpVersion(version),
    pageUrl: page.url,
    runStateBefore: before?.runState ?? null,
    chipsBefore: before?.chips ?? null,
    triggerText: rect.txt,
    itemCount: (items || []).length,
    items,
    normalizedNames: normalized,
    hy4Candidates: hy4,
    selectorClosedElementsAfterEscape: selectorClosed,
    chipsAfter: after?.chips ?? null,
    screenshot: shot
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n')
}

main().catch(err => {
  process.stderr.write('PROBE_ERROR: ' + (err && err.stack ? err.stack : String(err)) + '\n')
  process.exit(1)
})
