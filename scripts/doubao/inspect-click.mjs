#!/usr/bin/env node
/**
 * One-shot DOM explorer for the Doubao automation instance.
 *
 * Clicks an element (by data-testid or visible text) and dumps what appeared
 * afterwards, including any new CDP targets. Read-only otherwise.
 *
 * Usage:
 *   node scripts/doubao/inspect-click.mjs 9331 --testid create_office_task_button
 *   node scripts/doubao/inspect-click.mjs 9331 --text "新工作任务"
 */

import { DEFAULT_PORT, listTargets, pickChatPage, connect, createClient, sleep } from './cdp.mjs'

const port = Number(process.argv[2] ?? DEFAULT_PORT)
const argOf = name => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const testId = argOf('testid')
const text = argOf('text')
const xy = argOf('xy')
if (!testId && !text && !xy) throw new Error('need --testid <id>, --text <label> or --xy x,y')

const targetsBefore = await listTargets(port)
const page = pickChatPage(targetsBefore)
if (!page) throw new Error(`no chat page on port ${port}`)

const socket = await connect(page.webSocketDebuggerUrl)
const client = createClient(socket)

const centre = xy
  ? (([x, y]) => ({ found: true, tag: 'COORD', testid: '', label: `xy:${x},${y}`, x, y, width: 0, height: 0 }))(
      xy.split(',').map(Number),
    )
  : await client.evaluate(`(() => {
  const selector = ${testId ? JSON.stringify(`[data-testid="${testId}"]`) : 'null'};
  let el = selector ? document.querySelector(selector) : null;
  if (!el && ${JSON.stringify(text ?? '')}) {
    const wanted = ${JSON.stringify(text ?? '')};
    el = [...document.querySelectorAll('button, [role="button"], div, a')]
      .filter(node => (node.innerText || '').trim().startsWith(wanted))
      .sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0] ?? null;
  }
  if (!el) return { found: false };
  const rect = el.getBoundingClientRect();
  return {
    found: true,
    tag: el.tagName,
    testid: el.getAttribute('data-testid') || '',
    label: (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 40),
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
})()`)

console.log('点击目标:', JSON.stringify(centre, null, 2))
if (!centre?.found) throw new Error('element not found')

await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: centre.x, y: centre.y, button: 'none', buttons: 0 })
await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: centre.x, y: centre.y, button: 'left', buttons: 1, clickCount: 1 })
await sleep(120)
await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: centre.x, y: centre.y, button: 'left', buttons: 0, clickCount: 1 })
await sleep(3_000)

console.log('\n=== 点击后的 CDP targets ===')
const targetsAfter = await listTargets(port)
for (const target of targetsAfter) {
  const isNew = !targetsBefore.some(before => before.id === target.id)
  console.log(`  ${isNew ? '[NEW] ' : ''}[${target.type}] ${target.title || '(no title)'} :: ${target.url}`)
}

const livePage = pickChatPage(targetsAfter) ?? targetsAfter.find(t => t.type === 'page')
if (!livePage) {
  client.close()
  process.exit(0)
}

if (livePage.id === page.id) {
  const dump = await client.evaluate(`(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"], [class*="modal" i], [class*="dialog" i], [class*="popover" i]')]
      .map(el => ({
        cls: String(el.className).slice(0, 70),
        len: (el.innerText || '').length,
        head: (el.innerText || '').slice(0, 120).replace(/\\s+/g, ' ')
      }))
      .filter(item => item.len > 0);
    return {
      href: location.href,
      textHead: document.body.innerText.slice(0, 900),
      dialogs,
      testIds: [...new Set([...document.querySelectorAll('[data-testid]')].map(el => el.getAttribute('data-testid')))].slice(0, 80)
    };
  })()`)
  console.log('\n=== 当前页面 ===')
  console.log(JSON.stringify(dump, null, 2))
} else {
  console.log('\n=== 新页面已出现，重新连接它 ===')
  const nextSocket = await connect(livePage.webSocketDebuggerUrl)
  const nextClient = createClient(nextSocket)
  const dump = await nextClient.evaluate(`(() => ({
    href: location.href,
    textHead: document.body.innerText.slice(0, 1200),
    testIds: [...new Set([...document.querySelectorAll('[data-testid]')].map(el => el.getAttribute('data-testid')))].slice(0, 80)
  }))()`)
  console.log(JSON.stringify(dump, null, 2))
  nextClient.close()
}

client.close()
