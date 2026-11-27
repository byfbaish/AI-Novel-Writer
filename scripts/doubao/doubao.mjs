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
 *   node scripts/doubao/doubao.mjs task "任务" [--project 名称] [--timeout 600] [--file 路径] [--no-charter] [--no-wait --signal 信号件路径]
 *   node scripts/doubao/doubao.mjs signals [--dir 目录]      # 只读：watch 目录里的信号件，谁还停在 PENDING
 *   node scripts/doubao/doubao.mjs settle-signal --signal 路径 --min-turns N  # 内部用：等这轮收尾后写信号件（被 task --no-wait 以 detached 子进程拉起）
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
 * **It now requires `--signal <路径>`**: 不给信号件就没有任何东西会在完成时叫醒联络人
 * （2026-11-27 C5-pre 事故：回执落在无人 watch 的目录，联络人整轮结束后再无叫醒）。
 * 信号件必须先落在 relay 的 watch 目录里（见 scripts/lib/relay-signal.mjs）。
 *
 * Exit codes: 0 ok / 1 failure / 2 not connected
 */

import { spawn } from 'node:child_process'
import { mkdirSync, appendFileSync, readFileSync, statSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PORT, withChat, sleep } from './cdp.mjs'
import { extractMarkers } from './markers.mjs'
import { assertInWatchDir, scanSignals, watchDirsOf, writeSignal } from '../lib/relay-signal.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * 派活记录（本进程会写盘）的落点：先试 `develop/.runtime`，不可写就退到委托槽位自己的 `.batch/`。
 *
 * 为什么要有兜底：夜间定时卡的会话跑在受限沙箱里（受限令牌 + Low 完整性），写 `develop/.runtime`
 * 会 EPERM 并弹提权申请；没人守夜时这一下就卡住投递。而各槽位的 `.batch/` 从工作区根继承写权限，
 * 11-09 夜跑实测可写。所以「探测一次、失败换第二落点」，绝不反复尝试、绝不重复申请提权。
 */
const PRIMARY_RUNTIME = join(REPO_ROOT, '.runtime', 'doubao')
/** 委托槽位槽位表见 docs/agents/worktree-parallel.md §3.1：豆包固定 wt-1。 */
const FALLBACK_RUNTIME = join(REPO_ROOT, '..', 'wt-1', '.batch', 'doubao')
const RUNTIME_CANDIDATES = [PRIMARY_RUNTIME, FALLBACK_RUNTIME]

let runtimeDir = null
const resolveRuntimeDir = () => {
  if (runtimeDir) return runtimeDir
  for (const dir of RUNTIME_CANDIDATES) {
    try {
      mkdirSync(dir, { recursive: true })
      const probe = join(dir, '.write-probe')
      writeFileSync(probe, 'ok', 'utf8')
      rmSync(probe, { force: true })
      runtimeDir = dir
      if (dir !== PRIMARY_RUNTIME) console.warn('[warn] .runtime 不可写，派活记录改落 ' + dir)
      return runtimeDir
    } catch { /* 试下一个落点 */ }
  }
  runtimeDir = ''
  return runtimeDir
}
const dispatchRecordPath = () => {
  const dir = resolveRuntimeDir()
  return dir ? join(dir, 'last-thread.json') : join(PRIMARY_RUNTIME, 'last-thread.json')
}
const readDispatchRecordFrom = path => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

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
const readDispatchRecord = () => {
  for (const path of [dispatchRecordPath(), join(PRIMARY_RUNTIME, 'last-thread.json'), join(FALLBACK_RUNTIME, 'last-thread.json')]) {
    const record = readDispatchRecordFrom(path)
    if (record) return record
  }
  return null
}

const writeDispatchRecord = (href, note) => {
  const dir = resolveRuntimeDir()
  if (!dir) return /* 两个落点都不可写：记录只是护栏，写不进去不该拦住派活 */
  try {
    writeFileSync(join(dir, 'last-thread.json'), JSON.stringify({ href, note, at: new Date().toISOString() }, null, 2))
  } catch { /* 同上 */ }
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

/**
 * 收尾判定用的页面快照。判据与 scripts/doubao/watchdog.mjs 的 decide() 第一层一致：
 * 「生成中」三种指示（占位文本 / 停止类 testid / 页面上的停止生成字样）、编辑器是否为空、
 * 最后一条回复是否已出现「重新生成」按钮（生成中这个按钮还没有）。
 * 只靠「文本 3 轮不变」会把「已确认红线 1-4」这种开场白当成收尾，C5-pre 之后不能再这么判。
 */
const SETTLE_SNAPSHOT_JS = js(`
  const scope = document.querySelector('[data-testid="message-list"]') ?? document;
  const turns = [...scope.querySelectorAll('[data-testid="send_message"], [data-testid="receive_message"]')]
    .map(t => ({
      role: t.getAttribute('data-testid') === 'send_message' ? 'user' : 'assistant',
      text: (t.querySelector('[data-testid="message_text_content"]')?.innerText ?? t.innerText).trim(),
    }))
    .filter(t => t.text);
  const last = turns.filter(t => t.role === 'assistant').at(-1) ?? null;
  const lastUser = turns.filter(t => t.role === 'user').at(-1)?.text ?? '';
  const receives = [...scope.querySelectorAll('[data-testid="receive_message"]')];
  const lastNode = receives.at(-1) ?? null;
  const editor = document.querySelector('[data-testid="chat_input_input"] .ProseMirror')
    ?? document.querySelector('div.tiptap.ProseMirror');
  const bodyText = document.body.innerText || '';
  const testids = [...new Set([...document.querySelectorAll('[data-testid]')].map(e => e.getAttribute('data-testid')))];
  const lastText = (last?.text ?? '').trim();
  return {
    turnCount: turns.length,
    lastAssistant: lastText,
    lastUser,
    placeholder: /^(正在思考|思考中|生成中|正在生成|Thinking|Generating)[.…]*$/iu.test(lastText),
    stopIds: testids.filter(x => /stop|abort|pause|generating|thinking/i.test(x) && !/regenerat/i.test(x)),
    stopText: /停止生成|暂停生成|正在生成|正在思考/.test(bodyText.slice(-600)),
    hasRegenerate: Boolean(lastNode?.querySelector('[data-testid="message_action_regenerate"]')),
    editorText: editor ? editor.innerText.trim() : null,
  };
`)

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
 * 显式选模型，并核对「真的切了」。
 *
 * 为什么需要它：脚本原先只读标签、从不设模型，会话会一直停在上一轮留下的
 * 模型上（2026-11-25 那次评审就停在 DeepSeek V4.1 Flash，等于同源评审）。
 * 现在的口径是「派单必须点名模型，选不中就报错停下」——不许按价格自动降档。
 *
 * 注意两件事：①点「豆包 2.1 Pro」这类高级模型会弹出订阅页，本函数识别到
 * 升级文案即抛错（花钱的事交主人，不自行订阅）；②菜单行的文字由「名字 +
 * 倍率」组成，匹配用内层名字元素的精确文本，点击用整行矩形。
 */
const PAYWALL_RE = '升级豆包订阅|豆包付费|自动续费'

const selectModel = async (client, name) => {
  if (!name) return { model: await readModelLabel(client), changed: false, skipped: true }
  const norm = value => (value || '').replace(/\s+/g, ' ').trim()
  const before = await readModelLabel(client)
  if (norm(before).startsWith(norm(name))) return { model: before, changed: false }

  const chip = await clickElement(client, `() => document.querySelector(${JSON.stringify(SELECTORS.taskModel)})`)
  if (!chip) throw new Error('找不到模型选择器 ' + SELECTORS.taskModel + '（界面改版了？先跑 status）')
  await sleep(1_200)

  const row = await client.evaluate(js(`
    const target = ${JSON.stringify(String(name))};
    const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
    const leaf = [...document.querySelectorAll('*')]
      .filter(el => norm(el.innerText) === target)
      .filter(el => { const r = el.getBoundingClientRect(); return r.height > 0 })
      .sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0];
    if (!leaf) return null;
    let row = leaf;
    while (row.parentElement && norm(row.parentElement.innerText) === norm(row.innerText)) row = row.parentElement;
    const rect = row.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  `))
  if (!row) {
    await client.key('Escape', 'Escape', 27).catch(() => {})
    const names = await client.evaluate(js(`
      const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
      const out = [];
      for (const el of document.querySelectorAll('div')) {
        const t = norm(el.innerText);
        if (!t || t.length > 30 || !/x$/.test(t)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 150 || r.height < 20 || r.height > 50) continue;
        out.push(t);
      }
      return [...new Set(out)];
    `))
    throw new Error('模型菜单里没有「' + name + '」，本次不发送。菜单现值：' + ((names ?? []).join(' / ') || '(读不到)'))
  }
  await mouseClick(client, row.x, row.y)
  await sleep(1_600)

  const paywall = await client.evaluate(js(`
    // 只认「真的弹了订阅窗」：页面常驻一条「使用高级模型需升级豆包订阅」的 toast，
    // 选 0.01x 的闪速模型也会闪它一下，按 body 文本判会误杀。
    return [...document.querySelectorAll('div[role="dialog"], [class*="modal"], [class*="dialog"]')]
      .some(el => {
        const r = el.getBoundingClientRect();
        return r.width > 300 && r.height > 200 && /升级豆包订阅|豆包付费/.test(el.innerText || '');
      });
  `))
  if (paywall) {
    await client.key('Escape', 'Escape', 27).catch(() => {})
    throw new Error('「' + name + '」需要订阅（已弹出升级页），本次不发送；换免费档模型或先由主人决定是否订阅')
  }
  const after = await readModelLabel(client)
  if (!norm(after).startsWith(norm(name))) {
    throw new Error('切模型失败：期望 ' + name + '，实际 ' + (after ?? '(空)') + '，本次不发送')
  }
  return { model: after, changed: true }
}

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

  if (command === 'signals') {
    const dirOverride = option('dir', null)
    const report = scanSignals('doubao', dirOverride ? { dirs: [dirOverride] } : {})
    console.log(JSON.stringify(report, null, 2))
    const pendingNames = report.dirs.flatMap(entry => entry.files.filter(file => !file.done).map(file => file.name))
    console.log(`\n[信号件] 待完成 ${report.pending} 件，已就绪 ${report.ready} 件`
      + (pendingNames.length ? `；待完成：${pendingNames.join('、')}` : ''))
    return
  }

  if (command === 'settle-signal') {
    // 由 task --no-wait 以 detached 子进程拉起：盯住这轮对话，收尾即写信号件。
    // 为什么要有它：--no-wait 的调用方当场就返回了，豆包一小时后才交件，
    // 中间没有任何人/进程记得「该叫醒联络人了」——2026-11-27 C5-pre 就丢在这一环。
    const signalArg = option('signal', null)
    if (!signalArg) throw new Error('settle-signal 需要 --signal <信号件路径>')
    const signalAbs = assertInWatchDir('doubao', signalArg)
    const title = option('title', '(未命名)')
    const receipt = option('receipt', null)
    const minTurns = Number(option('min-turns', 0))
    const expectHref = option('href', null)
    const expectUser = compact(option('expect-user', '') ?? '')
    const delaySeconds = Number(option('delay', 5))
    const timeoutMs = Number(option('timeout', 3600)) * 1_000
    const logPath = option('log', null)
    const log = line => {
      if (!logPath) return
      try {
        mkdirSync(dirname(logPath), { recursive: true })
        appendFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`, 'utf8')
      } catch { /* 日志写不进去不影响信号件本身 */ }
    }
    const startedAt = Date.now()
    const quietMinMs = Number(option('quiet-min', 180)) * 1_000
    const steadyRounds = Math.max(2, Number(option('steady-rounds', 3)))
    const pollMs = 2_000
    const receiptPath = receipt ? resolve(receipt) : null
    const receiptAfter = () => {
      if (!receiptPath) return false
      try {
        return statSync(receiptPath).mtimeMs >= startedAt
      } catch {
        return false
      }
    }
    log(`start signal=${signalAbs} minTurns=${minTurns} delay=${delaySeconds}s timeout=${timeoutMs}ms quietMin=${quietMinMs / 1000}s receipt=${receiptPath ?? '-'}`)
    await sleep(delaySeconds * 1_000)
    try {
      return await withChat(async client => {
        let signature = null
        let steady = 0
        let lastActivityAt = Date.now()
        let snap = null
        let warnedForeign = false
        while (Date.now() - startedAt < timeoutMs) {
          // 锁会话：settler 盯的是「派单时那条对话」，话题被切走就立刻停手——
          // 否则会按别人的对话判收尾，写出一份内容误导的信号件。
          if (expectHref) {
            const current = (await readConversationId(client)).href
            if (current !== expectHref) {
              log(`abort: 话题已被切走（期望 ${expectHref}，实际 ${current}），不写件`)
              console.error('[settler] 话题已被切走，信号件不写（宁可不叫也不叫错人）')
              process.exitCode = 1
              return
            }
          }
          snap = await client.evaluate(SETTLE_SNAPSHOT_JS)
          const current = `${snap.turnCount}|${snap.lastAssistant?.length ?? 0}|${snap.editorText?.length ?? 0}`
          const generating = snap.placeholder || snap.stopIds.length > 0 || snap.stopText
          if (generating || snap.editorText || current !== signature) {
            lastActivityAt = Date.now()
            steady = 0
          } else {
            steady += 1
          }
          signature = current
          const idleMs = Date.now() - lastActivityAt
          // hasRegenerate 只作证据不作必要条件：它可能是 hover 才进 DOM 的，拿它当硬门槛会变成永不写件（静默漏叫）。
          const domIdle = steady >= steadyRounds && Boolean(snap.lastAssistant) && !generating
          const hasReply = snap.turnCount > minTurns
          // 锁这一条消息：最后一条用户消息必须是我们派的这一单，队列里别人更早的单不算。
          const owned = !expectUser || compact(snap.lastUser ?? '').includes(expectUser)
          if (!owned && !warnedForeign && hasReply) {
            warnedForeign = true
            log(`wait: 最后一条用户消息不是本单（可能前面还有排队的单），继续等`)
          }
          const byReceipt = domIdle && hasReply && owned && receiptAfter()
          const byQuiet = domIdle && hasReply && owned && idleMs >= quietMinMs
          if (byReceipt || byQuiet) {
            const evidence = byReceipt
              ? `回执文件已出现（${receiptPath}）`
              : `界面静默 ${Math.round(idleMs / 1000)}s 且未见回执文件（低置信：请自行核对是否真交件）`
            const written = writeSignal({
              channel: 'doubao',
              path: signalAbs,
              title,
              receiptPath,
              replyTail: snap.lastAssistant ?? '',
              evidence,
            })
            log(`done: ${written ?? '(已存在，跳过)'} (依据: ${evidence}, turns=${snap.turnCount}, waited=${Math.round((Date.now() - startedAt) / 1000)}s)`)
            console.log(written
              ? `[settler] 信号件已写：${written}（依据：${byReceipt ? '回执文件' : '界面静默'}）`
              : '[settler] 信号件已存在，跳过（同一收尾不重复叫醒）')
            return
          }
          await sleep(pollMs)
        }
        log(`timeout: 等不到收尾（turns=${snap?.turnCount ?? '?'}/基线${minTurns}, generating=${Boolean(snap?.placeholder || snap?.stopText)}, steady=${steady}）`)
        console.error('[settler] 超时：没有等到可判定的收尾，信号件不写（宁可漏叫也不写脏件）')
        process.exitCode = 1
      }, port)
    } catch (error) {
      log(`error: ${error?.message ?? error}`)
      throw error
    }
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
      throw new Error('用法: node scripts/doubao/doubao.mjs task "任务描述" | --file 路径 [--project 项目名] [--model 模型名] [--timeout 600] [--no-charter] [--no-wait --signal 信号件路径]')
    }
    const noWait = flag('no-wait')
    const signalPath = option('signal', null)
    // 2026-11-27 C5-pre 事故的闸：--no-wait 是 fire-and-forget，完成时谁来叫醒联络人只能靠信号件。
    // 不给信号件（或给了 watch 目录以外的路径）就拒发——否则回执落在一个没人看的目录，整单静默丢失。
    if (noWait && !signalPath) {
      throw new Error('--no-wait 必须同时给 --signal <信号件路径>：不给就没有东西会在完成时叫醒联络人。\n'
        + '  可用目录（须在 relay watch 内）：\n'
        + watchDirsOf('doubao').map(dir => `    ${dir}`).join('\n')
        + '\n  例：--no-wait --signal C:\\dsh-relay\\signals\\doubao\\<卡号>.done')
    }
    if (signalPath && !noWait) {
      throw new Error('--signal 只配合 --no-wait 使用：同步等待时调用方自己就拿到了结果，不需要信号件')
    }
    const signalAbs = signalPath ? assertInWatchDir('doubao', signalPath) : null
    const signalTitle = (fromFile ? fromFile.split(/[\\/]/).pop() : text.slice(0, 40)).replace(/\s+/g, ' ')
    const receiptPathRaw = option('receipt', null)
    // Preamble is four lines now, so it is always worth injecting: task books
    // no longer carry a 必读 section of their own (2026-11-03). Opt out with
    // --no-charter only when the task book is a pure read-only query.
    const charter = !flag('no-charter')
    // 2026-11-27（隔离审 M1）：信号件只能有一个写手。不往正文里塞「收尾自己写信号件」——
    // 否则模型写一份、settler 再写一份，同一张卡会叫醒联络人两次，且模型那份往往写得比收尾早。
    const body = charter ? CHARTER_PREAMBLE + text : text
    const projectName = option('project', null)
    const modelName = option('model', null)
    const timeoutMs = Number(option('timeout', 600)) * 1_000
    return withChat(async client => {
      const taskMode = await openTaskMode(client)
      const project = projectName ? await selectProject(client, projectName) : null
      const modelPick = await selectModel(client, modelName)
      const model = modelPick.model
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
        modelPick,
        charter,
        inputPath,
        submitted: submitted.method,
        textFrom: fromFile ?? '(inline)',
        textLength: body.length,
        signal: signalAbs,
        preview: text.slice(0, 120).replace(/\s+/g, ' '),
      }, null, 2))
      if (noWait) {
        // 2026-11-27：信号件不再由调用方"记得"去写，也不再预写占位件（relay 静默 5 秒后照样投，
        // 占位件会把联络人叫醒看一个空件）。这里拉一个 detached 子进程盯着这轮对话，
        // 豆包一收尾就由它把信号件一次性写全（含 @联络人与 DONE）→ relay 立刻投递。
        const baselineTurns = (await client.evaluate(TRANSCRIPT_JS)).length
        // 锁会话 + 锁这一条消息：settler 到点时若话题被切走、或最后一条用户消息不是我们这单
        // （队列里还有别人更早的单），都不能算「本单收尾」。
        const dispatchHref = (await readConversationId(client)).href
        const expectUser = compact(text).slice(0, 30)
        const settlerLog = join(resolveRuntimeDir() || PRIMARY_RUNTIME, `settle-${signalTitle.replace(/[^\w.-]+/g, '_').slice(0, 40)}-${Date.now()}.log`)
        const timeoutSeconds = Number(option('timeout', 3600))
        const child = spawn(process.execPath, [
          process.argv[1], 'settle-signal',
          '--port', String(port),
          '--signal', signalAbs,
          '--title', signalTitle,
          '--min-turns', String(baselineTurns),
          '--href', dispatchHref,
          '--expect-user', expectUser,
          '--timeout', String(Math.max(timeoutSeconds, 600)),
          '--delay', '5',
          ...(receiptPathRaw ? ['--receipt', receiptPathRaw] : []),
          '--log', settlerLog,
        ], { detached: true, stdio: 'ignore', windowsHide: true })
        child.unref()
        console.log('\n[ok] 已发送（--no-wait）：不等待回复，任务已排进豆包的队列。')
        console.log(`[信号件] ${signalAbs}`)
        console.log(`[settler] 已拉起看护进程 pid=${child.pid}（基线 turns=${baselineTurns}，超时 ${Math.max(timeoutSeconds, 600)}s）；豆包收尾后它会写入信号件并叫醒豆包联络人。`)
        console.log(`[settler-log] ${settlerLog}`)
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
