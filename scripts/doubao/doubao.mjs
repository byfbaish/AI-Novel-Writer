#!/usr/bin/env node
/**
 * Doubao desktop automation CLI (independent profile instance, CDP).
 *
 * Zero dependencies. Every DOM anchor is a stable `data-testid` shipped by the
 * Doubao renderer - NOT a Tailwind class name - so a restyle does not break it.
 * If Doubao renames them, `probe.mjs --eval` prints the current test ids.
 *
 * Usage:
 *   node scripts/doubao/doubao.mjs status [--port 9331]
 *   node scripts/doubao/doubao.mjs new
 *   node scripts/doubao/doubao.mjs say  "文本" [--new]
 *   node scripts/doubao/doubao.mjs ask  "文本" [--new] [--timeout 240]
 *   node scripts/doubao/doubao.mjs read
 *   node scripts/doubao/doubao.mjs projects              # 列出任务模式可选项目
 *   node scripts/doubao/doubao.mjs task "任务" [--project 名称] [--timeout 600]
 *
 * `task` uses 新工作任务 (agent mode with local file/terminal rights), which is
 * what you want for real work - plain 新对话 has no local access.
 *
 * Exit codes: 0 ok / 1 failure / 2 not connected
 */

import { DEFAULT_PORT, withChat, sleep } from './cdp.mjs'

const SELECTORS = {
  /** ProseMirror rich-text editor - the only contenteditable on the chat page. */
  editor: 'div.tiptap.ProseMirror',
  /** Sidebar "新工作任务" entry (agent mode: local files + terminal). */
  newTask: '[data-testid="create_office_task_button"]',
  /** Sidebar "新对话" entry (chat only, no local access). */
  newChat: '[data-testid="create_conversation_button"]',
  /** Task-mode composer; presence means we are already in agent mode. */
  taskComposer: '[data-testid="chat_input_input"]',
  /** Bottom bar mode chip ("本地电脑" / "云电脑"). */
  taskRunMode: '[data-testid="chat_input_action_mode"]',
  /** Conversation container. */
  messageList: '[data-testid="message-list"]',
  /** One user turn. */
  userMessage: '[data-testid="send_message"]',
  /** One assistant turn. */
  assistantMessage: '[data-testid="receive_message"]',
  /** The actual reply body inside a turn (excludes model badge, timestamp, follow-ups). */
  textContent: '[data-testid="message_text_content"]',
  /** Follow-up suggestions - must never leak into a reply. */
  suggestList: '[data-testid="suggest_message_list"]',
  /** Project picker items, once the 项目 menu is open. */
  projectOption: '[role="option"]',
}

const [, , commandArg, ...rest] = process.argv
const command = commandArg ?? 'status'

const flag = name => rest.includes(`--${name}`)
const option = (name, fallback) => {
  const index = rest.indexOf(`--${name}`)
  return index >= 0 && rest[index + 1] ? rest[index + 1] : fallback
}
const positional = rest.filter((value, index) => !value.startsWith('--') && !(index > 0 && rest[index - 1].startsWith('--')))
const port = Number(option('port', DEFAULT_PORT))

const js = snippet => `(() => { ${snippet} })()`

/**
 * Resolve the compose editor in either surface: the task-mode composer wraps its
 * own ProseMirror, and the plain chat page has a bare `.tiptap.ProseMirror`.
 */
const EDITOR_JS = `(document.querySelector(${JSON.stringify(`${SELECTORS.taskComposer} .ProseMirror`)})
  ?? document.querySelector(${JSON.stringify(SELECTORS.editor)}))`

/** Read the transcript as [{ role, text }]. Kept as a reusable function expression. */
const TRANSCRIPT_FN = `() => {
  const list = document.querySelector(${JSON.stringify(SELECTORS.messageList)});
  const scope = list ?? document;
  const turns = [];
  for (const turn of scope.querySelectorAll(${JSON.stringify(`${SELECTORS.userMessage}, ${SELECTORS.assistantMessage}`)})) {
    const role = turn.getAttribute('data-testid') === 'send_message' ? 'user' : 'assistant';
    const body = turn.querySelector(${JSON.stringify(SELECTORS.textContent)});
    const text = (body ? body.innerText : turn.innerText).trim();
    if (text) turns.push({ role, text });
  }
  return turns;
}`
const TRANSCRIPT_JS = `(${TRANSCRIPT_FN})()`

const readState = client => client.evaluate(js(`
  const editor = ${EDITOR_JS};
  const turns = (${TRANSCRIPT_FN})();
  return {
    href: location.href,
    title: document.title,
    taskMode: Boolean(document.querySelector(${JSON.stringify(SELECTORS.taskComposer)})),
    runMode: document.querySelector(${JSON.stringify(SELECTORS.taskRunMode)})?.innerText.trim() ?? null,
    hasEditor: Boolean(editor),
    editorText: editor ? editor.innerText.trim() : null,
    turnCount: turns.length,
    lastAssistant: [...turns].reverse().find(turn => turn.role === 'assistant')?.text ?? null,
    loggedIn: !location.href.includes('login')
  }
`))

const readConversationId = client => client.evaluate(js(`
  return { href: location.href, turns: (${TRANSCRIPT_FN})().length };
`))

/**
 * Real mouse click at viewport coordinates.
 * Doubao's React handlers ignore synthetic `element.click()`; only real pointer
 * events from the Input domain navigate / open menus.
 */
const mouseClick = async (client, x, y) => {
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await sleep(120)
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}

/** Click an element found by a predicate over candidates; returns null when absent. */
const clickElement = async (client, finderSource) => {
  const centre = await client.evaluate(js(`
    const el = (${finderSource})();
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, label: (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 30) };
  `))
  if (!centre) return null
  await mouseClick(client, centre.x, centre.y)
  return centre
}

const inTaskMode = client => client.evaluate(js(`
  return Boolean(document.querySelector(${JSON.stringify(SELECTORS.taskComposer)}))
    && Boolean(document.querySelector(${JSON.stringify(SELECTORS.taskRunMode)}));
`))

/**
 * Enter 新工作任务 (agent mode).
 *
 * Plain 新对话 gives a chat model with no local-file or terminal rights; the
 * task mode is the one that actually "works on your computer".
 */
const openTaskMode = async client => {
  if (await inTaskMode(client)) return 'already'
  const clicked = await clickElement(client, `() => document.querySelector(${JSON.stringify(SELECTORS.newTask)})`)
  if (!clicked) throw new Error('找不到「新工作任务」按钮')
  await sleep(2_500)
  if (!await inTaskMode(client)) throw new Error('点击「新工作任务」后没有进入任务模式')
  return 'clicked'
}

/** Locate the bottom-bar 项目 chip.
 *
 * Label matching alone is not enough: once a project is selected the chip shows
 * the **project name** ("AI-writer-wt-1"), not the word 项目. So the anchor is
 * positional - the first button to the right of the mode chip on the same row -
 * and the label is only a fallback.
 */
const projectButtonFinder = `() => {
  const mode = document.querySelector(${JSON.stringify('[data-testid="chat_input_action_mode"]')});
  if (mode) {
    const row = mode.getBoundingClientRect();
    const right = [...document.querySelectorAll('button')]
      .map(el => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ el, rect }) => rect.width > 0
        && Math.abs((rect.y + rect.height / 2) - (row.y + row.height / 2)) < 12
        && rect.x >= row.right - 1
        && (el.innerText || '').trim() !== '')
      .sort((a, b) => a.rect.x - b.rect.x)[0];
    if (right) return right.el;
  }
  return [...document.querySelectorAll('button')]
    .filter(el => (el.innerText || '').trim() === '项目')
    .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.y > 400; })
    .sort((a, b) => b.getBoundingClientRect().y - a.getBoundingClientRect().y)[0] ?? null;
}`

/** Open the project menu and read its items. Menu stays open afterwards. */
const openProjectMenu = async client => {
  // The 项目 chip is a toggle: if the menu is already open, clicking would close it.
  await client.key('Escape', 'Escape', 27)
  await sleep(500)
  const clicked = await clickElement(client, projectButtonFinder)
  if (!clicked) throw new Error('找不到输入框旁的「项目」按钮')
  await sleep(1_200)
  return client.evaluate(js(`
    return [...document.querySelectorAll(${JSON.stringify(SELECTORS.projectOption)})]
      .map(el => {
        const r = el.getBoundingClientRect();
        return {
          name: (el.innerText || '').trim().replace(/\\s+/g, ' '),
          active: String(el.className).includes('Active'),
          x: Math.round(r.x + r.width / 2),
          y: Math.round(r.y + r.height / 2)
        };
      })
      .filter(item => item.name);
  `))
}

/** Select a project by exact (or case-insensitive) name. */
const selectProject = async (client, name) => {
  const items = await openProjectMenu(client)
  // Menu rows render as "<name> <absolute path>", so prefix matching is required.
  const wanted = name.trim().toLowerCase()
  const target = items.find(item => item.name === name)
    ?? items.find(item => item.name.toLowerCase() === wanted)
    ?? items.find(item => item.name.toLowerCase().startsWith(`${wanted} `))
  if (!target) {
    throw new Error(`项目「${name}」不在列表里。可选：${items.map(item => item.name).join(' / ')}`)
  }
  await mouseClick(client, target.x, target.y)
  await sleep(2_000)
  return target.name
}

/**
 * Start a fresh conversation.
 *
 * `element.click()` is NOT enough: Doubao's sidebar row listens for real pointer
 * events, so the DOM-only click returns without navigating. A synthesised CDP
 * mouse press/release at the button centre does work.
 *
 * Returns the verification snapshot - callers must treat an unchanged
 * conversation as failure rather than sending into the user's existing thread.
 */
const createNewChat = async client => {
  const before = await readConversationId(client)

  const clicked = await clickElement(client, `() => document.querySelector(${JSON.stringify(SELECTORS.newChat)})`)
  let method = clicked ? 'cdp-mouse' : 'dom-click'
  if (!clicked) {
    await client.evaluate(js(`
      const el = document.querySelector(${JSON.stringify(SELECTORS.newChat)});
      if (el) el.click();
      return true;
    `))
  }
  await sleep(2_500)

  let after = await readConversationId(client)
  if (after.href === before.href && after.turns === before.turns) {
    await client.key('K', 'KeyK', 75, 10)
    await sleep(2_500)
    after = await readConversationId(client)
    method = 'shortcut'
  }

  const fresh = after.href !== before.href || after.turns === 0
  return { method, fresh, before, after }
}

/**
 * Focus the composer.
 *
 * `editor.focus()` alone is not reliable: the automation instance is an
 * **inactive window**, and a DOM focus call does not always move
 * `document.activeElement` when the window has never been clicked. A real CDP
 * mouse press at the editor centre does, so it is the second attempt.
 *
 * The last resort is "editor exists" - `Input.insertText` routes to the
 * renderer's focused node regardless of OS window activation, so a failed
 * focus check must not abort a run that would otherwise work.
 */
const focusEditor = async client => {
  const probe = `(${EDITOR_JS})`
  const attempt = () => client.evaluate(js(`
    const editor = ${probe};
    if (!editor) return { ok: false, reason: 'editor-missing' };
    editor.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount === 0) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.addRange(range);
    }
    const rect = editor.getBoundingClientRect();
    return {
      ok: document.activeElement === editor || editor.contains(document.activeElement),
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  `))

  const first = await attempt()
  if (!first) return { ok: false, reason: 'editor-missing' }
  if (first.ok) return { ok: true, method: 'dom-focus' }

  await mouseClick(client, first.x, first.y)
  await sleep(400)
  const second = await attempt()
  if (second?.ok) return { ok: true, method: 'cdp-mouse' }
  return { ok: Boolean(second), method: 'unverified', degraded: true }
}

const editorText = client => client.evaluate(js(`
  const editor = ${EDITOR_JS};
  return editor ? editor.innerText.trim() : null;
`))

/**
 * Type text into ProseMirror.
 * Input.insertText goes through Chromium's real input pipeline, which ProseMirror
 * accepts; execCommand is the fallback when the page holds no focus.
 */
const typeText = async (client, text) => {
  const needle = text.slice(0, Math.min(20, text.length))
  await client.insertText(text)
  await sleep(300)
  if ((await editorText(client))?.includes(needle)) return 'cdp-input'
  await client.evaluate(js(`
    const editor = ${EDITOR_JS};
    editor.focus();
    document.execCommand('insertText', false, ${JSON.stringify(text)});
    return true;
  `))
  await sleep(300)
  if ((await editorText(client))?.includes(needle)) return 'execCommand'
  throw new Error('无法把文本写入输入框（ProseMirror 拒绝了两条注入路径）')
}

/** Submit: Enter first, then Ctrl+Enter. Verified by the editor being cleared. */
const submit = async client => {
  const attempts = []
  for (const [name, action] of [
    ['Enter', () => client.key('Enter', 'Enter', 13)],
    ['Ctrl+Enter', () => client.key('Enter', 'Enter', 13, 2)],
  ]) {
    await action()
    await sleep(1_500)
    const remaining = await editorText(client)
    attempts.push(name)
    if (!remaining) return { method: name, attempts }
  }
  throw new Error(`发送失败：输入框未清空（尝试 ${attempts.join(' / ')}）`)
}

/** Placeholder bubbles that stay on screen for many seconds before real text arrives. */
const PLACEHOLDER = /^(正在思考|思考中|生成中|正在生成|Thinking|Generating)[.…]*$/iu

/** Wait until the last assistant turn stops growing. */
const waitForReply = async (client, timeoutMs) => {
  const deadline = Date.now() + timeoutMs
  let previous = null
  let stableRounds = 0
  while (Date.now() < deadline) {
    await sleep(1_500)
    const turns = await client.evaluate(TRANSCRIPT_JS)
    const last = [...turns].reverse().find(turn => turn.role === 'assistant')?.text ?? ''
    // A placeholder is *stable* but not *done*: accepting it makes `task` return
    // "正在思考" as the answer 8 seconds in, long before the agent does anything.
    if (last && !PLACEHOLDER.test(last.trim()) && last === previous) {
      stableRounds += 1
      if (stableRounds >= 3) return { turns, reply: last, settled: true }
    } else {
      stableRounds = 0
    }
    previous = last
  }
  const turns = await client.evaluate(TRANSCRIPT_JS)
  const last = [...turns].reverse().find(turn => turn.role === 'assistant')?.text ?? ''
  return { turns, reply: last, settled: false }
}

const main = async () => {
  if (command === 'status') {
    return withChat(async client => {
      const state = await readState(client)
      console.log(JSON.stringify({ port, ...state }, null, 2))
    }, port)
  }

  if (command === 'new') {
    return withChat(async client => {
      const created = await createNewChat(client)
      const state = await readState(client)
      console.log(JSON.stringify({ port, created, after: state }, null, 2))
      if (!created.fresh) {
        console.error('✗ 新建对话未被确认（对话 id 与条数都没变）')
        process.exitCode = 1
      }
    }, port)
  }

  if (command === 'read') {
    return withChat(async client => {
      const turns = await client.evaluate(TRANSCRIPT_JS)
      if (!turns.length) return console.log('(当前对话没有消息)')
      for (const turn of turns) {
        console.log(`\n[${turn.role === 'user' ? '我' : '豆包'}]`)
        console.log(turn.text)
      }
    }, port)
  }

  if (command === 'projects') {
    return withChat(async client => {
      const taskMode = await openTaskMode(client)
      const projects = await openProjectMenu(client)
      await client.key('Escape', 'Escape', 27)
      console.log(JSON.stringify({ port, taskMode, projects }, null, 2))
    }, port)
  }

  if (command === 'task') {
    const text = positional[0]
    if (!text) throw new Error('用法: node scripts/doubao/doubao.mjs task "任务描述" [--project 项目名] [--timeout 600]')
    const projectName = option('project', null)
    const timeoutMs = Number(option('timeout', 600)) * 1_000
    return withChat(async client => {
      const taskMode = await openTaskMode(client)
      const project = projectName ? await selectProject(client, projectName) : null
      const focus = await focusEditor(client)
      if (!focus?.ok) throw new Error(`输入框聚焦失败: ${focus?.reason ?? 'unknown'}`)
      const inputPath = await typeText(client, text)
      const submitted = await submit(client)
      const startedAt = Date.now()
      console.log(JSON.stringify({ port, taskMode, project, inputPath, submitted: submitted.method, text }, null, 2))
      const result = await waitForReply(client, timeoutMs)
      console.log('\n--- reply ---')
      console.log(result.reply || '(未取到回复)')
      console.log(`\n[turns=${result.turns.length} settled=${result.settled} waited=${Math.round((Date.now() - startedAt) / 1000)}s]`)
      if (!result.settled) process.exitCode = 1
    }, port)
  }

  if (command === 'say' || command === 'ask') {
    const text = positional[0]
    if (!text) throw new Error(`用法: node scripts/doubao/doubao.mjs ${command} "文本"`)
    const timeoutMs = Number(option('timeout', 240)) * 1_000
    return withChat(async client => {
      if (flag('new')) {
        const created = await createNewChat(client)
        if (!created.fresh) {
          throw new Error(`新建对话失败（${created.method}：对话 id 与条数均未变化）——已中止，不允许把消息发进现有对话`)
        }
      }
      const focus = await focusEditor(client)
      if (!focus?.ok) throw new Error(`输入框聚焦失败: ${focus?.reason ?? 'unknown'}`)
      const inputPath = await typeText(client, text)
      const submitted = await submit(client)
      const startedAt = Date.now()
      console.log(JSON.stringify({ port, inputPath, submitted: submitted.method, text }, null, 2))
      if (command === 'say') return
      const result = await waitForReply(client, timeoutMs)
      console.log('\n--- reply ---')
      console.log(result.reply || '(未取到回复)')
      console.log(`\n[turns=${result.turns.length} settled=${result.settled} waited=${Math.round((Date.now() - startedAt) / 1000)}s]`)
      if (!result.settled) process.exitCode = 1
    }, port)
  }

  throw new Error(`未知命令: ${command}`)
}

main().catch(error => {
  const message = String(error?.message ?? error)
  console.error(`✗ ${message}`)
  process.exitCode = /找不到豆包聊天页|ECONNREFUSED|fetch failed/.test(message) ? 2 : 1
})
