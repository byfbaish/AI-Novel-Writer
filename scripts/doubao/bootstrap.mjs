#!/usr/bin/env node
/**
 * One command from "I don't know what state this instance is in" to
 * "ready to dispatch a task".
 *
 * What it removes (each of these used to be a manual investigation):
 *   1. whether the automation instance is up, and how to start it;
 *   2. clicking 新工作任务 for a clean thread;
 *   3. switching the mode chip from 对话 (no local-file rights!) to 本地电脑;
 *   4. setting the reasoning level (default 自动 高, `--effort 中` for 自动 中);
 *   5. confirming which project directory the agent will actually work in.
 *
 * ## Order is load-bearing
 *
 * `create_office_task_button` resets the reasoning chip to 「中」 but keeps the
 * mode. So a thread created *after* the level was raised silently undoes it.
 * The only correct order is: new thread → mode → level → dispatch. This script
 * enforces that order; doing the clicks by hand is where the trap bites.
 *
 * ## Why it does not launch the instance by default
 *
 * `start-doubao-cdp.cmd` is an unsigned script: running it through the shell
 * always raises the "unknown publisher / run?" confirmation (2026-11-04: a
 * Hello-World stub raises it too, so it is the script-execution policy, not the
 * content). Nobody is at this terminal to click it, and spawning around the
 * confirmation puts the instance in the tool shell's job — it dies when that
 * shell ends, which reads as "it started, then vanished minutes later".
 *
 * So the default is: instance offline → print the exact command for a human and
 * exit 2 with the marker `NEED_HUMAN_LAUNCH`. `--launch` keeps the old
 * spawn-and-hope behaviour, for the deliberate "background shell + keep-alive"
 * pattern in docs/agents/doubao-channel.md §2.1.
 *
 * Usage:
 *   node scripts/doubao/bootstrap.mjs                  # full: ensure → new thread → 本地电脑 → 高 → check
 *   node scripts/doubao/bootstrap.mjs --effort 中      # same, but 自动 中 (cheaper)
 *   node scripts/doubao/bootstrap.mjs --check          # read-only diagnosis, starts nothing, clicks nothing
 *   node scripts/doubao/bootstrap.mjs --keep           # reuse the current thread (no 新工作任务 click)
 *   node scripts/doubao/bootstrap.mjs --project 名称   # also switch the project
 *   node scripts/doubao/bootstrap.mjs --launch         # try to start the instance ourselves (short-lived)
 *
 * Options: --port 9331 · --launch-timeout 45 (seconds)
 *
 * Exit codes: 0 all steps ok/skip · 1 a step failed (the failing step is named)
 *             · 2 the instance could not be brought up / is not reachable.
 *
 * Every step prints `[ok]/[skip]/[fail] <step> <evidence>`; the last line is a
 * JSON self-check. Read the evidence, not the exit code, when something is off.
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEFAULT_PORT, listTargets, pickChatPage, sleep, withChat } from './cdp.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..')
/** Path logic stays in the .cmd - this file only calls it. */
const LAUNCH_SCRIPT = path.join(REPO_ROOT, 'scripts', 'doubao', 'start-doubao-cdp.cmd')

const [, , ...argv] = process.argv
const flag = name => argv.includes(`--${name}`)
const option = (name, fallback) => {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : fallback
}

const port = Number(option('port', DEFAULT_PORT))
const checkOnly = flag('check')
const keepThread = flag('keep')
/**
 * 目标推理档位（`--effort 中|高`）。**不传就完全不动档位**。
 *
 * 作者 2026-11-04：高推理度对积分额度消耗夸张，先按「中」跑，干不动再回「高」。
 * 取值必须与豆包菜单里的字面量一致（菜单项是「中」/「高」，chip 显示「自动 中」）。
 *
 * 默认值原先写死「高」，于是「只想补选项目」也会被顺手抬到高档 —— 2026-11-04
 * 实测过一次（`--keep --project` 把中档升成高档，得再跑一条命令改回来）。
 * 档位是钱，**没点名就不许动**：默认 null = 保持现状、只核对 chip 上有值。
 */
const effortTarget = option('effort', null)
/**
 * 显式要求「自己拉起实例」。默认**不**这样做：`start-doubao-cdp.cmd` 是未签名
 * 脚本，经 shell 执行要过「是否运行」的确认框，本工具会话无人可点；而用 spawn
 * 绕过确认起出来的实例挂在工具 shell 的 job 里，shell 一结束就被回收，表现为
 * 「起了、几分钟后又没了」。所以默认把这一下交给人（见 printHumanLaunch）。
 */
const autoLaunch = flag('launch')
/** 即使已是目标值也重跑一次切换：用来验证「切得动」，不只是「本来就是对」。 */
const force = flag('force')
const projectName = option('project', null)
const launchTimeoutMs = Number(option('launch-timeout', 45)) * 1_000

const js = snippet => `(() => { ${snippet} })()`

const SELECTORS = {
  newTask: '[data-testid="create_office_task_button"]',
  taskComposer: '[data-testid="chat_input_input"]',
  runMode: '[data-testid="chat_input_action_mode"]',
  model: '[data-testid="chat_input_action_model"]',
  menuItem: '[role="option"],[role="menuitem"]',
  userMessage: '[data-testid="send_message"]',
  assistantMessage: '[data-testid="receive_message"]',
}

// ---------------------------------------------------------------- report line

const steps = []
const step = (status, name, evidence = '') => {
  steps.push({ step: name, status, evidence })
  console.log(`[${status}] ${name}${evidence ? ` ${evidence}` : ''}`)
}
const note = text => console.log(`[note] ${text}`)

/**
 * 拉不起实例时的收场：把「要人做的那一下」原样印出来。
 *
 * 为什么不自己起：`start-doubao-cdp.cmd` 是未签名脚本，经 shell 执行必然弹
 * 「未知发布者 / 是否运行」的确认框（2026-11-04 作者实测：换成只写 Hello World
 * 的空脚本同样弹窗 ⇒ 与脚本内容无关，是 Windows 对脚本执行的策略）。本工具会话
 * 无人可点那个按钮，所以这一下只能交给人。
 *
 * 尾行的 `NEED_HUMAN_LAUNCH` 是给 agent 看的机读标记：见到它就弹确认框把命令
 * 交给作者，不要反复重试启动。见 docs/agents/doubao-channel.md §2.2。
 */
const printHumanLaunch = reason => {
  console.log('')
  console.log('─'.repeat(72))
  console.log('⚠  需要人工启动（本会话拉不起来）')
  console.log(`   原因：${reason}`)
  console.log('')
  console.log('   请在【你自己的】PowerShell / Windows Terminal 里执行：')
  console.log('')
  console.log(`     & "${LAUNCH_SCRIPT}"`)
  console.log('')
  console.log('   或 cmd：')
  console.log('')
  console.log(`     "${LAUNCH_SCRIPT}"`)
  console.log('')
  console.log('   若弹「未知发布者 / 是否运行」→ 点「运行」，窗口留着别关。')
  console.log('   （双击执行必弹；从终端直接跑的弹窗行为未实测）')
  console.log('   起来后重跑本命令（在线就全 [skip]，不会新建线程、不重读章程）。')
  console.log('─'.repeat(72))
  console.log('NEED_HUMAN_LAUNCH')
  steps.push({ step: '人工启动', status: 'fail', evidence: reason })
}

// ------------------------------------------------------------------- snapshot

/**
 * Everything the self-check needs, in one round trip.
 *
 * The project label is the only direct evidence of the working directory, and
 * it is anchored **positionally**: once a project is picked the chip shows the
 * project name ("AI-writer-wt-1"), so text matching on 「项目」 stops working.
 * In 对话 mode the same chip shows a bare name with no path - that difference
 * is exactly how a "no file access" state is detected.
 */
const snapshot = client => client.evaluate(js(`
  const textOf = selector => {
    const el = document.querySelector(selector);
    return el ? el.innerText.trim().replace(/\\s+/g, ' ') : null;
  };
  const rows = document.querySelectorAll(${JSON.stringify(`${SELECTORS.userMessage}, ${SELECTORS.assistantMessage}`)});
  // The 项目 chip is anchored **positionally** (first labelled button right of the
  // mode chip on the same row): once a project is picked the chip shows the
  // project name, so matching on the word 项目 stops working. The chip carries
  // the absolute path only sometimes - see the project step below, which opens
  // the menu when the path is actually required.
  const buttons = [...document.querySelectorAll('button')];
  const labelled = el => (el.innerText || '').trim().replace(/\\s+/g, ' ');
  let projectChip = null;
  const anchor = document.querySelector(${JSON.stringify(SELECTORS.runMode)});
  if (anchor) {
    const row = anchor.getBoundingClientRect();
    const neighbour = buttons
      .map(el => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ el, rect }) => rect.width > 0
        && Math.abs((rect.y + rect.height / 2) - (row.y + row.height / 2)) < 12
        && rect.x >= row.right - 1
        && labelled(el) !== '')
      .sort((a, b) => a.rect.x - b.rect.x)[0];
    if (neighbour) projectChip = labelled(neighbour.el);
  }
  return {
    href: location.href,
    title: document.title,
    taskMode: Boolean(document.querySelector(${JSON.stringify(SELECTORS.taskComposer)})),
    hasEditor: Boolean(document.querySelector('div.tiptap.ProseMirror')),
    runMode: textOf(${JSON.stringify(SELECTORS.runMode)}),
    model: textOf(${JSON.stringify(SELECTORS.model)}),
    projectChip,
    turnCount: rows.length,
    loggedIn: !location.href.includes('login')
  };
`))

// --------------------------------------------------------------------- clicks

/** Real pointer events - Doubao's React handlers ignore synthetic clicks on
 * navigation rows and chips, so this is the default for button anchors. */
const mouseClick = async (client, x, y) => {
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await sleep(120)
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}

const centreOf = (client, finderSource) => client.evaluate(js(`
  const el = (${finderSource})();
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
`))

const clickReal = async (client, finderSource) => {
  const centre = await centreOf(client, finderSource)
  if (!centre) return false
  await mouseClick(client, centre.x, centre.y)
  return true
}

/** DOM click first (menu items respond to it), real mouse as the fallback. */
const clickMenuEntry = async (client, finderSource) => {
  const clicked = await client.evaluate(js(`
    const el = (${finderSource})();
    if (!el) return false;
    el.click();
    return true;
  `))
  if (clicked) return 'dom-click'
  return (await clickReal(client, finderSource)) ? 'cdp-mouse' : null
}

const byTestId = id => `() => document.querySelector(${JSON.stringify(`[data-testid="${id}"]`)})`

const menuEntryContaining = needle => `() => {
  const items = [...document.querySelectorAll(${JSON.stringify(SELECTORS.menuItem)})];
  return items.find(el => (el.innerText || '').replace(/\\s+/g, ' ').includes(${JSON.stringify(needle)})) ?? null;
}`

const menuEntryExactly = needle => `() => {
  const items = [...document.querySelectorAll(${JSON.stringify(SELECTORS.menuItem)})];
  return items.find(el => (el.innerText || '').trim().replace(/\\s+/g, ' ') === ${JSON.stringify(needle)}) ?? null;
}`

/** The 项目 chip: first labelled button right of the mode chip on the same row. */
const PROJECT_CHIP = `() => {
  const mode = document.querySelector(${JSON.stringify(SELECTORS.runMode)});
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

// ------------------------------------------------------------------ live steps

const hasLocalComputer = snapshot => /本地电脑/.test(snapshot.runMode ?? '')
/** 档位判据按目标值判定 —— 写死「高」会让 `--effort 中` 的成功被判成失败。 */
const hasEffort = (snapshot, target = effortTarget) =>
  target ? (snapshot.model ?? '').includes(target) : Boolean((snapshot.model ?? '').trim())

/** 新工作任务 → fresh thread. Must run FIRST: it resets the level chip to 中. */
const createThread = async client => {
  const before = await snapshot(client)
  const clicked = await clickReal(client, byTestId('create_office_task_button'))
  if (!clicked) return { ok: false, evidence: '找不到「新工作任务」按钮' }
  await sleep(2_500)
  const after = await snapshot(client)
  const fresh = after.href !== before.href || after.turnCount === 0
  return {
    ok: fresh,
    evidence: `href=${shortId(after.href)} turnCount=${after.turnCount}${fresh ? '' : `（与之前相同：${shortId(before.href)}）`}`,
    after,
  }
}

/** 对话 → 本地电脑. In 对话 mode the agent has no local-file rights at all. */
const switchRunMode = async client => {
  let before = await snapshot(client)
  if (hasLocalComputer(before) && !force) return { status: 'skip', evidence: `runMode=${before.runMode}` }

  const opened = await clickReal(client, byTestId('chat_input_action_mode'))
  if (!opened) return { status: 'fail', evidence: '找不到底栏模式 chip' }
  await sleep(900)

  const method = await clickMenuEntry(client, menuEntryContaining('本地电脑'))
  if (!method) {
    await client.key('Escape', 'Escape', 27)
    return { status: 'fail', evidence: `模式菜单里没有「本地电脑」（点前 runMode=${before.runMode}）` }
  }
  await sleep(1_500)
  const after = await snapshot(client)
  if (!hasLocalComputer(after)) {
    return { status: 'fail', evidence: `点击后 runMode 仍是 ${after.runMode}（method=${method}）` }
  }
  return { status: 'ok', evidence: `runMode=${after.runMode}（method=${method}）` }
}

/** 切到 `effortTarget`（不传 `--effort` 则一步都不动）. The chip's first-level label is 「推理强度」. */
const switchEffort = async client => {
  const before = await snapshot(client)
  if (!effortTarget) return { status: 'skip', evidence: `未指定 --effort，保持 model=${before.model ?? '(无 chip)'}` }
  // 已经是目标档位就跳过，`--force` 也一样：菜单里点「已经是当前值」的项会找不到
  // 可点的条目，于是把一次成功报成 [fail]（2026-11-03 实测过这个误报）。
  if (hasEffort(before)) return { status: 'skip', evidence: `model=${before.model}${force ? '（--force 已忽略：已是目标档位）' : ''}` }

  const opened = await clickReal(client, byTestId('chat_input_action_model'))
  if (!opened) return { status: 'fail', evidence: '找不到底栏档位 chip' }
  await sleep(900)

  // The menu is either one level (levels listed) or two (推理强度 → levels).
  let path = []
  if (await clickMenuEntry(client, menuEntryContaining('推理强度'))) {
    path.push('推理强度')
    await sleep(900)
  }
  const picked = await clickMenuEntry(client, menuEntryExactly(effortTarget))
  if (!picked) {
    await client.key('Escape', 'Escape', 27)
    return { status: 'fail', evidence: `档位菜单里没有「${effortTarget}」（点前 model=${before.model}）` }
  }
  path.push(effortTarget)
  await sleep(1_200)
  const after = await snapshot(client)
  if (!hasEffort(after)) {
    return { status: 'fail', evidence: `点击后 model 仍是 ${after.model}（${path.join(' → ')}）` }
  }
  return { status: 'ok', evidence: `model=${after.model}（${path.join(' → ')}）` }
}

/**
 * Read the project rows (menu opens, rows render "<name> <absolute path>").
 *
 * Returns null when the chip cannot be found, `[]` when the menu stayed shut.
 */
const readProjects = async client => {
  await client.key('Escape', 'Escape', 27)
  await sleep(400)
  if (!await clickReal(client, PROJECT_CHIP)) return null
  await sleep(1_200)
  return client.evaluate(js(`
    return [...document.querySelectorAll('[role="option"]')]
      .map(el => {
        const rect = el.getBoundingClientRect();
        return {
          name: (el.innerText || '').trim().replace(/\\s+/g, ' '),
          active: String(el.className).includes('Active'),
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2)
        };
      })
      .filter(item => item.name);
  `))
}

/**
 * Which project is actually selected - the one piece of evidence that answers
 * "which directory will it touch". The chip alone often shows just the project
 * name, so the path has to come from the menu row.
 */
const inspectProject = async (client, chipLabel) => {
  const items = await readProjects(client)
  await client.key('Escape', 'Escape', 27)
  await sleep(300)
  if (!items) return { ok: false, evidence: '找不到底栏「项目」按钮' }
  if (!items.length) return { ok: false, evidence: '项目菜单没有打开（未取到任何选项）' }
  const chipName = String(chipLabel ?? '').trim()
  // chip 只剩占位文本 = 这个话题**没有项目**。此前这里直接取菜单里的 `active`，
  // 于是「上次用过的项目」被当成「当前项目」，两个都没选项目的线程也报 ✓（2026-11-04 实测）。
  if (isUnsetProjectChip(chipName)) {
    return { ok: false, evidence: `底栏「项目」未选（chip=${chipName || '空'}）；用 --project 指定` }
  }
  const row = pickProjectRow(chipName, items)
  if (!row) {
    return { ok: false, evidence: `菜单里认不出当前项目（chip=${chipName || '空'}；可选：${items.map(item => item.name).join(' / ')}）` }
  }
  return { ok: hasPath(row.name), label: row.name }
}

const switchProject = async (client, name) => {
  const items = await readProjects(client)
  if (!items) return { status: 'fail', evidence: '找不到底栏「项目」按钮' }
  const wanted = name.trim().toLowerCase()
  const target = items.find(item => item.name === name)
    ?? items.find(item => item.name.toLowerCase() === wanted)
    ?? items.find(item => item.name.toLowerCase().startsWith(`${wanted} `))
  if (!target) {
    await client.key('Escape', 'Escape', 27)
    return { status: 'fail', evidence: `没有项目「${name}」，可选：${items.map(item => item.name).join(' / ')}` }
  }
  await mouseClick(client, target.x, target.y)
  await sleep(2_000)
  await client.key('Escape', 'Escape', 27)
  await sleep(300)
  const after = await snapshot(client)
  const chip = after.projectChip ?? ''
  const ok = chip.toLowerCase().startsWith(wanted) || chip.toLowerCase().includes(wanted)
  return {
    status: ok ? 'ok' : 'fail',
    evidence: ok ? `project=${target.name}` : `点击后项目 chip=${chip || '(空)'}`,
    label: target.name,
  }
}

// -------------------------------------------------------------------- instance

const shortId = href => String(href ?? '').split('/').pop() || '?'
const hasPath = label => /[A-Za-z]:\\/.test(String(label ?? ''))

/**
 * Ready means "port answers AND the chat page is there" - a port alone is not
 * enough (a crash-restarted Doubao sits on the login page, and launching a
 * second instance at that point only adds noise: the profile is already locked).
 */
const waitForChat = async timeoutMs => {
  const deadline = Date.now() + timeoutMs
  let portUp = false
  while (Date.now() < deadline) {
    try {
      const page = pickChatPage(await listTargets(port))
      portUp = true
      if (page) return { page, portUp }
    } catch { /* not up yet */ }
    await sleep(1_000)
  }
  return { page: null, portUp }
}

/**
 * Run the checked-in .cmd detached.
 *
 * The `call` form is load-bearing, verified 2026-11-03 against a probe script
 * whose path contains a space (and a non-ASCII user directory):
 *
 *   cmd /d /s /c "path"        → cmd strips the quotes → "…\bsp" is not recognized
 *   cmd /d /s /c call "path"   → runs, marker file written
 *
 * `cmd /c "a b.cmd"` is the well-known cmd.exe quoting trap: with a single
 * quoted token cmd removes the quotes and then splits on the space. `call`
 * keeps the argument a single command word. The script itself does
 * `start "" ...` and exits, so the browser is not our child and this returns
 * immediately.
 */
const startInstance = () => {
  const child = spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'call', LAUNCH_SCRIPT], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.on('error', () => { /* reported by the readiness poll */ })
  child.unref()
}

// ------------------------------------------------------------------------ main

const main = async () => {
  if (process.platform !== 'win32') {
    step('fail', '平台', `bootstrap 只支持 Windows（当前 ${process.platform}）`)
    return 1
  }

  // 1. instance
  let page = null
  let launchedInstance = false
  const first = await waitForChat(2_000)
  if (first.page) {
    page = first.page
    step('skip', '实例在线', `${shortId(page.url)}`)
  } else if (checkOnly) {
    const why = first.portUp
      ? `端口 ${port} 在，但找不到豆包聊天页（登录页 / 崩溃重启？看窗口）`
      : `端口 ${port} 未监听`
    step('fail', '实例在线', checkOnly && !first.portUp ? `${why}（--check 不启动实例）` : why)
    printHumanLaunch(why)
    return 2
  } else if (first.portUp) {
    // Port is taken but the page is unusable: launching again would just fight
    // the profile lock, and the fix is human (log in / restart the window).
    const why = `端口 ${port} 在，但找不到豆包聊天页（登录页 / 崩溃重启？看窗口），不重复启动`
    step('fail', '实例在线', why)
    printHumanLaunch(why)
    return 2
  } else if (!autoLaunch) {
    const why = `端口 ${port} 未监听`
    step('fail', '实例在线', `${why}（默认不自动启动：脚本执行要过确认框，无人可点）`)
    printHumanLaunch(why)
    return 2
  } else {
    startInstance()
    const launched = await waitForChat(launchTimeoutMs)
    launchedInstance = true
    page = launched.page
    if (!page) {
      const why = launched.portUp
        ? `端口 ${port} 已监听，但 ${launchTimeoutMs / 1_000}s 内没等到聊天页（登录页 / 崩溃重启？看窗口）`
        : `${launchTimeoutMs / 1_000}s 内 ${port} 未就绪`
      step('fail', '启动实例', launched.portUp ? why : `${why}；需要人工启动`)
      printHumanLaunch(why)
      return 2
    }
    step('ok', '启动实例', `${LAUNCH_SCRIPT} → ${shortId(page.url)}`)
    note('实例依附于拉起它的 shell 存活；本次调用结束后要保住它，见 docs/agents/doubao-channel.md §2.1')
  }

  const problems = []

  return withChat(async client => {
    // 端口通了不等于 UI 就绪。刚拉起的实例约 8–12s 才渲染出任务输入框，
    // 早一步找按钮会得到「找不到「新工作任务」按钮」（2026-11-03 实测）。
    const uiTimeoutMs = Number(process.env.DOUBAO_UI_TIMEOUT_MS ?? 45_000)
    const uiDeadline = Date.now() + uiTimeoutMs
    let initial = await snapshot(client)
    let waitedMs = 0
    // 等的是「编辑器渲染出来」，不是 taskMode：实例可能停在「对话」模式，
    // 那时任务输入框本就不存在，等 taskMode 会白等到超时（2026-11-03 实测）。
    while (!initial.hasEditor && Date.now() < uiDeadline) {
      await sleep(1_000)
      waitedMs += 1_000
      initial = await snapshot(client)
    }
    if (waitedMs > 0) {
      step(initial.hasEditor ? 'ok' : 'fail', '等待界面就绪',
        initial.hasEditor ? `耗时约 ${waitedMs / 1_000}s` : `${uiTimeoutMs / 1_000}s 内编辑器未出现`)
    }

    if (!initial.loggedIn) {
      step('fail', '登录态', '页面在登录页，先人工登录')
      return 1
    }

    if (checkOnly) {
      step(initial.taskMode ? 'ok' : 'fail', '工作任务模式', initial.taskMode ? '输入框就位' : '不在任务模式（对话页）')
      step(hasLocalComputer(initial) ? 'ok' : 'fail', '运行模式', `runMode=${initial.runMode ?? '(无 chip)'}`)
      step(hasEffort(initial) ? 'ok' : 'fail', `推理档位（${effortTarget ? `目标 ${effortTarget}` : '未指定，保持当前'}）`, `model=${initial.model ?? '(无 chip)'}`)
      step('skip', '项目路径', `${initial.projectChip ?? '(空)'}（chip 常只显示项目名；绝对路径要开项目菜单，--check 不点击）`)
      step(initial.turnCount === 0 ? 'skip' : 'ok', '当前线程', `turnCount=${initial.turnCount} title=${initial.title}`)
      console.log(JSON.stringify({
        port,
        online: true,
        dryRun: true,
        thread: { turnCount: initial.turnCount, href: initial.href, title: initial.title },
        runMode: initial.runMode,
        model: initial.model,
        project: { label: initial.projectChip, hasAbsolutePath: hasPath(initial.projectChip), verified: false },
        ready: initial.taskMode && hasLocalComputer(initial) && hasEffort(initial),
        steps,
      }, null, 2))
      if (!initial.taskMode || !hasLocalComputer(initial) || !hasEffort(initial)) return 1
      return 0
    }

    // 2. new thread FIRST - it resets the effort chip to 中 but keeps the mode.
    if (keepThread) {
      step('skip', '新建线程', `--keep，复用当前线程 turnCount=${initial.turnCount}`)
      if (!initial.taskMode) {
        step('fail', '工作任务模式', '当前不在任务模式；去掉 --keep 让 bootstrap 新建线程')
        return 1
      }
    } else {
      const created = await createThread(client)
      if (!created.ok) {
        step('fail', '新建线程', created.evidence)
        return 1
      }
      step('ok', '新建线程', created.evidence)
    }

    // 3. mode: 对话 has no local-file rights, so this is not cosmetic.
    const mode = await switchRunMode(client)
    step(mode.status, '运行模式 → 本地电脑', mode.evidence)
    if (mode.status === 'fail') problems.push('运行模式')

    // 4. effort
    if (problems.length === 0) {
      const effort = await switchEffort(client)
      step(effort.status, effortTarget ? `推理档位 → 自动 ${effortTarget}` : '推理档位（未指定，保持当前）', effort.evidence)
      if (effort.status === 'fail') problems.push('推理档位')
    } else {
      step('skip', effortTarget ? `推理档位 → 自动 ${effortTarget}` : '推理档位（未指定，保持当前）', '上一步失败，未处理')
    }

    // 5. project: switch when asked, otherwise resolve which one is active.
    let projectLabel = null
    if (projectName) {
      const project = await switchProject(client, projectName)
      step(project.status, `项目 → ${projectName}`, project.evidence)
      projectLabel = project.label ?? null
      if (project.status === 'fail') problems.push('项目')
    }

    const final = await snapshot(client)
    if (!projectLabel) {
      const inspected = await inspectProject(client, final.projectChip)
      projectLabel = inspected.label ?? null
      step(inspected.ok ? 'ok' : 'fail', '项目路径', inspected.label ?? inspected.evidence)
      if (!inspected.ok) problems.push('项目路径')
    } else {
      step('ok', '项目路径', projectLabel)
    }

    console.log(JSON.stringify({
      port,
      online: true,
      launched: launchedInstance,
      thread: { kept: keepThread, turnCount: final.turnCount, href: shortId(final.href) },
      runMode: final.runMode,
      model: final.model,
      project: { label: projectLabel, hasAbsolutePath: hasPath(projectLabel) },
      ready: problems.length === 0,
      steps,
    }, null, 2))

    if (problems.length) {
      console.error(`✗ 未就绪：${problems.join(' / ')}`)
      return 1
    }
    return 0
  }, port)
}

main()
  .then(code => { process.exitCode = code ?? 0 })
  .catch(error => {
    const message = String(error?.message ?? error)
    console.error(`✗ ${message}`)
    const instanceGone = /找不到豆包聊天页|ECONNREFUSED|fetch failed/.test(message)
    if (instanceGone) printHumanLaunch(`连不上实例：${message}`)
    process.exitCode = instanceGone ? 2 : 1
  })
