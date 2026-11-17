#!/usr/bin/env node
/**
 * 关闭模型选择器（只读收尾）：先 Escape，仍开着再点触发器收起；绝不点选项。
 */
'use strict'

import {
  SELECTORS,
  buildSnapshotExpression,
  pickPage,
  parseCdpVersion
} from '../../../scripts/workbuddy/attach.mjs'

const PORT = 9333
const sleep = ms => new Promise(r => setTimeout(r, ms))
const SEL = JSON.stringify(SELECTORS)

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const t = setTimeout(() => reject(new Error('ws timeout')), 8000)
    ws.addEventListener('open', () => { clearTimeout(t); resolve(ws) })
    ws.addEventListener('error', e => { clearTimeout(t); reject(new Error('ws error ' + (e?.message || e?.type))) })
  })
}

function createClient(ws) {
  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', ev => {
    let m
    try { m = JSON.parse(ev.data) } catch { return }
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
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
      if (res?.exceptionDetails) throw new Error('page exception ' + res.exceptionDetails.text)
      return res?.result?.value
    },
    async click(x, y) {
      const base = { x, y, button: 'left', clickCount: 1 }
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
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

const countExpr = `(function(s){return document.querySelectorAll(s.modelItem).length;})(${SEL})`
const triggerRectExpr = `(function(s){var n=document.querySelector(s.modelTrigger);if(!n)return null;var r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})(${SEL})`

const version = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json()
const targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()
const page = pickPage(targets)
const ws = await connect(page.webSocketDebuggerUrl)
const client = createClient(ws)

const steps = []
const n0 = await client.evaluate(countExpr)
steps.push({ step: 'start', modelItems: n0 })
if (n0 > 0) {
  await client.escape()
  await sleep(500)
  let n = await client.evaluate(countExpr)
  steps.push({ step: 'after-escape-1', modelItems: n })
  if (n > 0) {
    const rect = await client.evaluate(triggerRectExpr)
    if (rect) {
      await client.click(rect.x, rect.y)
      await sleep(600)
      n = await client.evaluate(countExpr)
      steps.push({ step: 'after-trigger-click', modelItems: n })
    } else {
      steps.push({ step: 'trigger-missing', modelItems: n })
    }
  }
  if (n > 0) {
    // 最后手段：点页面左上空白处（远离选项列表）
    await client.click(4, 4)
    await sleep(500)
    steps.push({ step: 'after-blank-click', modelItems: await client.evaluate(countExpr) })
  }
}
const snap = await client.evaluate(buildSnapshotExpression())
ws.close()
process.stdout.write(JSON.stringify({ cdp: parseCdpVersion(version), steps, chips: snap?.chips ?? null, hasEditor: snap?.hasEditor ?? null }, null, 2) + '\n')
