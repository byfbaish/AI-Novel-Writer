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
 *   node scripts/doubao/doubao.mjs markers               # 只看队列标记，秒判做到第几项
 *   node scripts/doubao/doubao.mjs threads               # 列出侧栏话题（标题 + 位置）
 *   node scripts/doubao/doubao.mjs thread "标题片段"      # 切到那个话题（真实鼠标点击）
 *   node scripts/doubao/doubao.mjs projects              # 列出任务模式可选项目
 *   node scripts/doubao/doubao.mjs task "任务" [--project 名称] [--timeout 600] [--file 路径] [--no-charter] [--no-wait]
 *
 * `--file` reads the task body from a file (long queue text, no shell escaping).
 * `--charter` is ON by default and prepends the "read AGENTS.md first" preamble,
 * but only when the text does not already mention AGENTS.md - queue task-books
 * carry their own 必读 section, and duplicating it wastes the agent's context.
 *
 * `task` uses 新工作任务 (agent mode with local file/terminal rights), which is
 * what you want for real work - plain 新对话 has no local access.
 *
 * `--no-wait` sends the task and returns immediately (fire-and-forget): use it when
 * the 豆包 agent is busy with an earlier task and you only need the message queued.
 *
 * Exit codes: 0 ok / 1 failure / 2 not connected
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PORT, withChat, sleep } from './cdp.mjs'
import { extractMarkers } from './markers.mjs'

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
  /** Reasoning-effort chip ("自动 高"). Recorded so every dispatch leaves level evidence. */
  taskModel: '[data-testid="chat_input_action_model"]',
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
  /** One row in the sidebar conversation list ("新工作任务" 话题). */
  threadItem: '[data-testid="conversation-list-v2-item"]',
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
 * 上一次「往哪个话题里说过话」的记录。
 *
 * 为什么需要：`say` / `task` 打的都是**当前打开的那个话题**，而豆包是多话题 SPA，
 * 同一台实例上可能并行开着两三个队列任务。2026-11-04 就出过：给「三个纯函数模块」
 * 那一轮补的「继续执行」打进了上一轮 T9–T11 的话题，那个 agent 于是开始找一份
 * 它从没收到过的任务书，白烧了三分钟。
 * 记录放在 `.runtime/`（已 gitignore），拿不到记录时**不拦**，只提示。
 */
const DISPATCH_RECORD = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.runtime', 'doubao', 'last-thread.json')

const readDispatchRecord = () => {
  try { return JSON.parse(readFileSync(DISPATCH_RECORD, 'utf8')) } catch { return null }
}

const writeDispatchRecord = (href, note) => {
  try {
    mkdirSync(dirname(DISPATCH_RECORD), { recursive: true })
    writeFileSync(DISPATCH_RECORD, JSON.stringify({ href, note, at: new Date().toISOString() }, null, 2))
  } catch { /* 记录只是护栏，写不进去不该拦住派活 */ }
}

/** 当前话题和记录不一致时抛错（`--force` 放行）。 */
const assertSameThread = (href, command, force) => {
  const record = readDispatchRecord()
  if (!record?.href || force || record.href === href) return record
  throw new Error(`当前话题不是上次派活的那一个：\n  记录=${record.href}（${record.note ?? '-'}）\n  当前=${href}\n`
    + '先 `thread "标题片段"` 切过去，或加 --force 说明你确实要往这个话题里说')
}

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
  return { href: location.href, title: document.title, turns: (${TRANSCRIPT_FN})().length };
`))

/**
 * Sidebar rows, newest first (the order Doubao renders them in).
 * `title` is the row's own text - it is the only handle the UI exposes; the
 * conversation id is not in the DOM, so `thread` matches by title substring.
 */
const listThreads = client => client.evaluate(js(`
  return [...document.querySelectorAll(${JSON.stringify(SELECTORS.threadItem)})]
    .map(el => {
      const rect = el.getBoundingClientRect();
      return {
        title: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80),
        x: Math.round(rect.x + rect.width / 2),
        y: Math.round(rect.y + rect.height / 2),
        visible: rect.width > 0 && rect.height > 0
      };
    })
    .filter(item => item.title && item.visible);
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

/** Whitespace-insensitive compare: ProseMirror turns `\n` into paragraphs, so a
 * needle containing a newline never matches the rendered innerText verbatim. */
const compact = value => String(value ?? '').replace(/\s+/g, '')

/** Empty the composer so a retry never concatenates onto leftover text. */
const clearEditor = async client => {
  await client.evaluate(js(`
    const editor = ${EDITOR_JS};
    if (editor) editor.focus();
    return Boolean(editor);
  `))
  await client.key('a', 'KeyA', 65, 2)
  await sleep(150)
  await client.key('Backspace', 'Backspace', 8)
  await sleep(400)
  const left = (await editorText(client)) ?? ''
  if (left.trim()) throw new Error(`清空输入框失败（残留 ${left.length} 字符）`)
}

/**
 * Type text into ProseMirror.
 * Input.insertText goes through Chromium's real input pipeline, which ProseMirror
 * accepts; execCommand is the fallback when the page holds no focus.
 */
const typeText = async (client, text) => {
  await clearEditor(client)
  const needle = compact(text).slice(0, 24)
  await client.insertText(text)
  await sleep(300)
  if (compact(await editorText(client)).includes(needle)) return 'cdp-input'
  await client.evaluate(js(`
    const editor = ${EDITOR_JS};
    editor.focus();
    document.execCommand('insertText', false, ${JSON.stringify(text)});
    return true;
  `))
  await sleep(300)
  if (compact(await editorText(client)).includes(needle)) return 'execCommand'
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

/**
 * Cross-agent red lines, injected by machine.
 *
 * 2026-11-03: this used to instruct the agent to go read AGENTS.md +
 * documentation-charter (§4/§6) before every dispatch. That cost several
 * thousand tokens per task and - because a fresh instance has no context -
 * had to be paid again on every run. The rules themselves are four lines, so
 * they are inlined here instead. Task books no longer need their own 必读
 * section; if one still has it, this preamble stays out of the way.
 */
const CHARTER_PREAMBLE = `【跨 agent 红线 · 机器注入，直接确认，不要为此去读文档】
1. 只准单元测试（node node_modules/vitest/vitest.mjs run <单个测试文件>）。禁一切要起应用进程的测试（*.browser.tsx / pnpm test / test:node），禁 pnpm dev / 打包 / 验收脚本。
2. 禁止任何 git 写操作（add / commit / reset / checkout / stash / push），提交权不在你。
3. 只改任务书点名的路径。既有实现、既有测试的断言一律不动；发现 bug 只写进报告。
4. 没读到的内容只能写「本次读取的文件内未找到」，不许写「全仓没有」；不确定的判定必须标「不确定」。

确认方式：回一行 \`已确认红线 1-4\`，然后直接开工。

---

`

const readModelLabel = client => client.evaluate(js(`
  const el = document.querySelector(${JSON.stringify(SELECTORS.taskModel)});
  return el ? el.innerText.trim().replace(/\\s+/g, ' ') : null;
`))

/**
 * Everything the agent has produced since the last user turn.
 *
 * Task-mode execution logs (「已编辑文件 …」「已执行代码 …」) render outside
 * `message_text_content`, so the transcript reader alone misses them - and the
 * queue markers sit at the end of exactly those logs. Anchor on the last user
 * message and take the page text after it; the transcript turn is the fallback.
 *
 * The slice starts at the anchor's end, so the **rest of the user's own task
 * book** is included - including any `## [T1] DONE|BLOCKED|SKIPPED <…>` format
 * example it contains. That is why `extractMarkers` (./markers.mjs) drops
 * template-shaped lines instead of trusting every match.
 */
const LATEST_OUTPUT_JS = `(() => {
  const turns = (${TRANSCRIPT_FN})();
  const lastUser = [...turns].reverse().find(turn => turn.role === 'user')?.text ?? '';
  const anchor = lastUser.trim().slice(0, 30);
  const body = document.body.innerText;
  const index = anchor ? body.lastIndexOf(anchor) : -1;
  if (index < 0) return [...turns].reverse().find(turn => turn.role === 'assistant')?.text ?? '';
  return body.slice(index + anchor.length);
})()`

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
    const fromFile = option('file', null)
    if (fromFile && positional[0]) throw new Error('--file 与位置参数不能同时给')
    let text = positional[0]
    if (fromFile) {
      text = readFileSync(fromFile, 'utf8').trim()
      if (!text) throw new Error(`任务文件是空的: ${fromFile}`)
    }
    if (!text) {
      throw new Error('用法: node scripts/doubao/doubao.mjs task "任务描述" | --file 路径 [--project 项目名] [--timeout 600] [--no-charter] [--no-wait]')
    }
    // Preamble is four lines now, so it is always worth injecting: task books
    // no longer carry a 必读 section of their own (2026-11-03). Opt out with
    // --no-charter only when the task book is a pure read-only query.
    const charter = !flag('no-charter')
    const body = charter ? CHARTER_PREAMBLE + text : text
    const projectName = option('project', null)
    const timeoutMs = Number(option('timeout', 600)) * 1_000
    return withChat(async client => {
      const taskMode = await openTaskMode(client)
      const project = projectName ? await selectProject(client, projectName) : null
      const model = await readModelLabel(client)
      const focus = await focusEditor(client)
      if (!focus?.ok) throw new Error(`输入框聚焦失败: ${focus?.reason ?? 'unknown'}`)
      const inputPath = await typeText(client, body)
      const submitted = await submit(client)
      // 任务已经提交出去了：话题记录落盘失败（例如沙箱对 .runtime 没有写权限）不能让它抛错退出，
      // 否则调用方会重试，同一份任务书就被投递两次。
      try {
        writeDispatchRecord((await readConversationId(client)).href, `task: ${text.slice(0, 40)}`)
      } catch (error) {
        console.error('[warn] 已提交，但话题记录写入失败（不影响投递）：' + (error?.message ?? error))
      }
      const startedAt = Date.now()
      console.log(JSON.stringify({
        port,
        taskMode,
        project,
        model,
        charter,
        inputPath,
        submitted: submitted.method,
        textFrom: fromFile ?? '(inline)',
        textLength: body.length,
        preview: text.slice(0, 120).replace(/\s+/g, ' '),
      }, null, 2))
      if (flag('no-wait')) {
        console.log('\n[ok] 已发送（--no-wait）：不等待回复，任务已排进豆包的队列。')
        return
      }
      const result = await waitForReply(client, timeoutMs)
      const markers = extractMarkers(await client.evaluate(LATEST_OUTPUT_JS))
      console.log('\n--- reply ---')
      console.log(result.reply || '(未取到回复)')
      console.log('\n--- queue markers ---')
      console.log(JSON.stringify(markers, null, 1))
      console.log(`\n[turns=${result.turns.length} settled=${result.settled} waited=${Math.round((Date.now() - startedAt) / 1000)}s model=${model ?? '?'}]`)
      if (!result.settled) process.exitCode = 1
    }, port)
  }

  if (command === 'markers') {
    return withChat(async client => {
      const turns = await client.evaluate(TRANSCRIPT_JS)
      const markers = extractMarkers(await client.evaluate(LATEST_OUTPUT_JS))
      const done = markers.filter(item => item.state === 'DONE').map(item => item.marker)
      const blocked = markers.filter(item => item.state === 'BLOCKED')
      const stamps = markers.filter(item => item.timestamp)
      console.log(JSON.stringify({
        port,
        turnCount: turns.length,
        model: await readModelLabel(client),
        done,
        blocked: blocked.map(item => `${item.marker}: ${item.note}`),
        queueEmpty: markers.some(item => item.marker === 'QUEUE'),
        lastMarker: markers.at(-1) ?? null,
        lastTimestamp: stamps.at(-1)?.timestamp ?? null,
        elapsedFromFirstMarker: stamps.length > 1
          ? Math.round((Date.parse(stamps.at(-1).timestamp) - Date.parse(stamps[0].timestamp)) / 1000)
          : null,
        markers,
      }, null, 2))
    }, port)
  }

  if (command === 'threads') {
    return withChat(async client => {
      const items = await listThreads(client)
      const current = await readConversationId(client)
      console.log(JSON.stringify({ port, current: current.href, threads: items.map(item => item.title) }, null, 2))
    }, port)
  }

  if (command === 'thread') {
    const query = positional[0]
    if (!query) throw new Error('用法: node scripts/doubao/doubao.mjs thread "标题片段"')
    return withChat(async client => {
      const before = await readConversationId(client)
      const items = await listThreads(client)
      const target = items.find(item => item.title.includes(query))
      if (!target) {
        throw new Error(`侧栏里没有标题含「${query}」的话题。现有：\n- ${items.map(item => item.title).join('\n- ')}`)
      }
      await mouseClick(client, target.x, target.y)
      await sleep(2_500)
      const after = await readConversationId(client)
      const switched = after.href !== before.href
      // 目标话题可能**本来就开着**（本次操作就是想确认/记录它）——那不算失败。
      // 判据用标题而不是「href 变了没有」：href 不变但标题已经是那条 = 已经在里面。
      const landed = switched || after.title.includes(query)
      if (landed) writeDispatchRecord(after.href, `thread: ${target.title}`)
      console.log(JSON.stringify({ port, query, matched: target.title, before: before.href, after: after.href,
        switched, title: after.title, landed }, null, 2))
      if (!landed) {
        console.error('✗ 话题没切换（点击落空，标题也对不上）——不要在此基础上继续发消息')
        process.exitCode = 1
      }
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
      const current = await readConversationId(client)
      // 先确认「打的是对的话题」再动输入框：发错话题的代价是另一个 agent 收到
      // 一份它没有上下文的任务指令（2026-11-04 实测过一次）。
      assertSameThread(current.href, command, flag('force'))
      const focus = await focusEditor(client)
      if (!focus?.ok) throw new Error(`输入框聚焦失败: ${focus?.reason ?? 'unknown'}`)
      const inputPath = await typeText(client, text)
      const submitted = await submit(client)
      writeDispatchRecord(current.href, `${command}: ${text.slice(0, 40)}`)
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
