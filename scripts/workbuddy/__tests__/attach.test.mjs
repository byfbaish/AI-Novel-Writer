import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_PORT,
  DEBUG_ENV,
  SELECTORS,
  buildCurrentSessionExpression,
  buildNeedHumanDebugBanner,
  buildSnapshotExpression,
  buildSpaceActionExpression,
  buildSpaceClickExpression,
  buildStartCommands,
  buildTailTextExpression,
  checkPinnedCwd,
  extractReply,
  isSettledSignal,
  isUnderCwd,
  judgeFreshDraft,
  judgeLanding,
  looksLikePlaceholder,
  parseCdpVersion,
  pickPage,
  readRunState,
  resolveExePath,
  samePath,
  snapshotInPage,
  stripAssistantChrome,
  summarizeSnapshot,
} from '../attach.mjs'

/**
 * 用例来源：2026-11-05 在本机 WorkBuddy 5.9.3（Chromium 138）上真跑抓到的
 * /json/version、侧栏 DOM、助手消息结构。DOM 用最小假实现挂着，
 * 因为核心风险在「注入渲染层的表达式」——它们必须只依赖 document/window。
 */

/** 只实现 attach.mjs 用到的 DOM 面：querySelector(All) / innerText / getAttribute / rect。 */
function makeNode({ innerText = '', textContent, attrs = {}, children = {}, rect = { left: 0, top: 0, width: 10, height: 10 } } = {}) {
  const node = {
    innerText,
    textContent: textContent ?? innerText,
    disabled: false,
    attrs,
    children,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null
    },
    querySelector(selector) {
      return children[selector] ?? null
    },
    querySelectorAll(selector) {
      const value = children[selector]
      if (!value) return []
      return Array.isArray(value) ? value : [value]
    },
    scrollIntoView() {},
    getBoundingClientRect() {
      return rect
    },
    clicked: false,
    click() {
      node.clicked = true
    },
  }
  return node
}

function makeDocument(map = {}) {
  return {
    title: 'WorkBuddy',
    readyState: 'complete',
    querySelector(selector) {
      const value = map[selector]
      if (!value) return null
      return Array.isArray(value) ? value[0] : value
    },
    querySelectorAll(selector) {
      const value = map[selector]
      if (!value) return []
      return Array.isArray(value) ? value : [value]
    },
  }
}

/** 执行 attach.mjs 拼出来的注入表达式（等价于 Runtime.evaluate 在页面里跑）。 */
function runExpression(expression) {
  return new Function('return ' + expression)()
}

const originalDocument = globalThis.document
const originalWindow = globalThis.window
const originalLocation = globalThis.location

beforeEach(() => {
  globalThis.window = { wb: { conversations: { currentId: 'sess-abc' } } }
  globalThis.location = { href: 'file:///C:/WorkBuddy/resources/app.asar/renderer/index.html?locale=zh-CN' }
})

afterEach(() => {
  globalThis.document = originalDocument
  globalThis.window = originalWindow
  globalThis.location = originalLocation
})

describe('resolveExePath', () => {
  it('WORKBUDDY_EXE 优先（换安装位置时不用改代码）', () => {
    expect(resolveExePath({ env: { WORKBUDDY_EXE: 'D:\\Tools\\WorkBuddy.exe' }, platform: 'win32' }))
      .toEqual({ path: 'D:\\Tools\\WorkBuddy.exe', via: 'env' })
  })

  it('默认按 LOCALAPPDATA 拼（WorkBuddy 不是全局安装，PATH 上没有）', () => {
    const seen = []
    const result = resolveExePath({ env: { LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' }, platform: 'win32', exists: p => (seen.push(p), true) })
    expect(result.via).toBe('localappdata')
    expect(result.path).toBe('C:\\Users\\x\\AppData\\Local\\Programs\\WorkBuddy\\WorkBuddy.exe')
  })

  it('装了但路径不在 → not-found（横幅里要提示人工确认安装位置）', () => {
    expect(resolveExePath({ env: { LOCALAPPDATA: 'C:\\x' }, platform: 'win32', exists: () => false }).via).toBe('not-found')
  })

  it('没有 LOCALAPPDATA 时不抛，返回 missing-localappdata', () => {
    expect(resolveExePath({ env: {}, platform: 'linux' }).via).toBe('missing-localappdata')
  })
})

describe('pickPage / parseCdpVersion', () => {
  const REAL_VERSION = {
    Browser: 'Chrome/138.0.7204.251',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) WorkBuddy/5.9.3 Chrome/138.0.7204.251 Electron/37.10.3 Safari/537.36',
    'Protocol-Version': '1.3',
  }

  it('只认渲染层主窗口，跳过 devtools / 其它 target', () => {
    const page = pickPage([
      { type: 'page', url: 'devtools://devtools/bundled/inspector.html' },
      { type: 'page', url: 'file:///C:/WorkBuddy/resources/app.asar/renderer/index.html?locale=zh-CN' },
      { type: 'other', url: 'file:///C:/WorkBuddy/resources/app.asar/renderer/index.html' },
    ])
    expect(page.url).toContain('/renderer/index.html')
  })

  it('拿不到 /renderer/index.html 时退回 app.asar（不同版本路径可能变）', () => {
    expect(pickPage([{ type: 'page', url: 'file:///C:/WorkBuddy/resources/app.asar/renderer/index.html' }])).not.toBeNull()
    expect(pickPage([{ type: 'page', url: 'https://example.com' }])).toBeNull()
    expect(pickPage(null)).toBeNull()
  })

  it('从真实 /json/version 里取出应用版本与 Chromium 版本', () => {
    expect(parseCdpVersion(REAL_VERSION)).toEqual({
      browser: 'Chrome/138.0.7204.251',
      appVersion: '5.9.3',
      chromiumVersion: '138.0.7204.251',
      ua: REAL_VERSION['User-Agent'],
    })
  })

  it('端口是别的 Electron 应用时不瞎认（版本串里没有 WorkBuddy）', () => {
    const other = { Browser: 'Chrome/120.0.0.0', 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0 Electron/28.0.0' }
    expect(parseCdpVersion(other).appVersion).toBeNull()
  })
})

describe('启动横幅（NEED_HUMAN_DEBUG）', () => {
  it('Debug 是环境变量，不是 exe 开关：命令里必须有 ' + DEBUG_ENV, () => {
    const commands = buildStartCommands({ port: 9333 })
    expect(commands.cmd).toContain('set ' + DEBUG_ENV + '=9333')
    expect(commands.powershell).toContain("$env:" + DEBUG_ENV + "='9333'")
    expect(commands.script).toContain('start-workbuddy-debug.cmd')
  })

  it('横幅末尾固定 NEED_HUMAN_DEBUG（agent 靠这一行判定要交给人工）', () => {
    const banner = buildNeedHumanDebugBanner({ port: 9333, reason: 'CDP 端口 9333 未监听' })
    expect(banner.split('\n').at(-1)).toBe('NEED_HUMAN_DEBUG')
    expect(banner).toContain('CDP 端口 9333 未监听')
    expect(banner).toContain('退出')
    expect(banner).toContain(DEBUG_ENV)
  })

  it('默认端口 9333（与豆包的 9331 错开，两个实例能同时开着）', () => {
    expect(DEFAULT_PORT).toBe(9333)
    expect(buildStartCommands().cmd).toContain('=9333')
  })
})

describe('snapshotInPage（注入渲染层的快照函数）', () => {
  it('取到编辑器 / 发送按钮 / 助手正文 / chips / 当前会话 id', () => {
    const editor = makeNode({ innerText: '你好' })
    const send = makeNode({ attrs: { 'aria-label': '发送' } })
    send.disabled = true
    const markdown = makeNode({ innerText: 'OK' })
    const agent = makeNode({ children: { [SELECTORS.agentMarkdown]: markdown } })
    const earlierAgent = makeNode({ children: { [SELECTORS.agentMarkdown]: makeNode({ innerText: '旧的' }) } })
    const workspaceChip = makeNode({ innerText: 'wt-2' })
    const branchChip = makeNode({ innerText: 'agent/wt-2' })
    const permissionChip = makeNode({ innerText: '允许完全访问' })
    const modelChip = makeNode({ innerText: 'Hy4' })

    globalThis.document = makeDocument({
      [SELECTORS.editor]: editor,
      [SELECTORS.sendButton]: send,
      [SELECTORS.agentMessage]: [earlierAgent, agent],
      [SELECTORS.userMessage]: [makeNode({ innerText: '你好' })],
      [SELECTORS.message]: [makeNode({ attrs: { 'data-message-id': 'm1' } }), makeNode({ attrs: { 'data-message-id': 'm2' } })],
      [SELECTORS.workspaceChip]: workspaceChip,
      [SELECTORS.branchChip]: branchChip,
      [SELECTORS.permissionChip]: permissionChip,
      [SELECTORS.modelChip]: modelChip,
      '[data-slate-placeholder]': null,
      'button, [role="button"]': [makeNode({ attrs: { 'aria-label': '停止' } }), makeNode({ attrs: { 'aria-label': '更多操作' } })],
    })

    const snapshot = snapshotInPage(SELECTORS)
    expect(snapshot.hasEditor).toBe(true)
    expect(snapshot.editorText).toBe('你好')
    expect(snapshot.send).toEqual({ found: true, disabled: true })
    expect(snapshot.agentCount).toBe(2)
    expect(snapshot.userCount).toBe(1)
    expect(snapshot.messageCount).toBe(2)
    expect(snapshot.lastReply).toBe('OK')
    expect(snapshot.currentSessionId).toBe('sess-abc')
    expect(snapshot.chips).toEqual({ workspace: 'wt-2', branch: 'agent/wt-2', permission: '允许完全访问', model: 'Hy4' })
    expect(snapshot.startLabels ?? snapshot.stopLabels).toContain('停止')
    expect(readRunState(snapshot)).toBe('running')
  })

  it('页面里没有编辑器（还在启动 / 开的是别的窗口）→ no-editor，不瞎判 idle', () => {
    globalThis.document = makeDocument({})
    const snapshot = snapshotInPage(SELECTORS)
    expect(snapshot.hasEditor).toBe(false)
    expect(readRunState(snapshot)).toBe('no-editor')
  })

  it('window.wb 被 Proxy 包着、取属性会抛也不影响快照', () => {
    globalThis.window = { get wb() { throw new Error('Cannot convert object to primitive value') } }
    globalThis.document = makeDocument({})
    expect(() => snapshotInPage(SELECTORS)).not.toThrow()
  })

  it('buildSnapshotExpression 能原样求值（等于在页面里跑）', () => {
    globalThis.document = makeDocument({})
    const snapshot = runExpression(buildSnapshotExpression(SELECTORS))
    expect(snapshot).toHaveProperty('hasEditor')
    expect(snapshot.currentSessionId).toBe('sess-abc')
  })
})

describe('buildSpaceActionExpression（按空间开新会话 / 点卡片切会话）', () => {
  function sectionWith(label, { hasButton = true, cards = [] } = {}) {
    const children = {
      [SELECTORS.sidebarSectionLabel]: makeNode({ innerText: label, textContent: label }),
    }
    if (hasButton) children[SELECTORS.spaceNewTaskButton] = makeNode({ rect: { left: 200, top: 40, width: 18, height: 18 } })
    if (cards.length) children[SELECTORS.conversationCard] = cards
    return makeNode({ children })
  }

  it('点到目标空间标题右边的「+」= 该目录下的新会话草稿', () => {
    globalThis.document = makeDocument({
      [SELECTORS.sidebarSection]: [sectionWith('develop'), sectionWith('wt-2')],
    })
    const result = runExpression(buildSpaceActionExpression({ label: 'wt-2', kind: 'new-task' }))
    expect(result).toEqual({ x: 209, y: 49, w: 18, h: 18 })
  })

  it('空间不存在时不猜其它空间（宁可报错也不把活派到错目录）', () => {
    globalThis.document = makeDocument({ [SELECTORS.sidebarSection]: [sectionWith('develop')] })
    expect(runExpression(buildSpaceActionExpression({ label: 'wt-2' }))).toEqual({ error: 'no-section', label: 'wt-2' })
  })

  it('空间在但这个空间没有会话卡片 → no-cards（调用方退回开新草稿）', () => {
    globalThis.document = makeDocument({ [SELECTORS.sidebarSection]: [sectionWith('wt-2')] })
    expect(runExpression(buildSpaceActionExpression({ label: 'wt-2', kind: 'card' }))).toEqual({ error: 'no-cards', label: 'wt-2' })
  })

  it('按 data-conversation-id 精确点卡片（切会话不靠渲染层 API）', () => {
    const card = makeNode({ attrs: { 'data-conversation-id': 'sess-abc' }, rect: { left: 10, top: 100, width: 100, height: 20 } })
    globalThis.document = makeDocument({ '[data-conversation-id="sess-abc"]': card })
    expect(runExpression(buildSpaceActionExpression({ sessionId: 'sess-abc' }))).toEqual({ x: 60, y: 110, w: 100, h: 20 })
  })

  it('卡片不在 DOM 里（别的 cwd 的会话）→ no-card', () => {
    globalThis.document = makeDocument({})
    expect(runExpression(buildSpaceActionExpression({ sessionId: 'missing' }))).toEqual({ error: 'no-card', sessionId: 'missing' })
  })
})

describe('buildSpaceClickExpression（页面内 DOM click，不走坐标）', () => {
  function sectionWith(label, { hasButton = true, disabled = false, cards = [] } = {}) {
    const children = {
      [SELECTORS.sidebarSectionLabel]: makeNode({ innerText: label, textContent: label }),
    }
    let button = null
    if (hasButton) {
      button = makeNode({ rect: { left: 200, top: 40, width: 18, height: 18 } })
      button.disabled = disabled
      children[SELECTORS.spaceNewTaskButton] = button
    }
    if (cards.length) children[SELECTORS.conversationCard] = cards
    return { section: makeNode({ children }), button, cards }
  }

  it('点目标空间的「+」→ 页面内真的发出 click（不靠坐标）', () => {
    const wt2 = sectionWith('wt-2')
    globalThis.document = makeDocument({ [SELECTORS.sidebarSection]: [sectionWith('develop').section, wt2.section] })
    expect(runExpression(buildSpaceClickExpression({ label: 'wt-2', kind: 'new-task' }))).toEqual({ clicked: true, label: 'wt-2' })
    expect(wt2.button.clicked).toBe(true)
  })

  it('空间不存在 → no-section，且不误点任何按钮（宁可报错也不派到错目录）', () => {
    const develop = sectionWith('develop')
    globalThis.document = makeDocument({ [SELECTORS.sidebarSection]: [develop.section] })
    expect(runExpression(buildSpaceClickExpression({ label: 'wt-2' }))).toEqual({ error: 'no-section', label: 'wt-2' })
    expect(develop.button.clicked).toBe(false)
  })

  it('空间在但没有「+」→ no-new-task-button', () => {
    globalThis.document = makeDocument({ [SELECTORS.sidebarSection]: [sectionWith('wt-2', { hasButton: false }).section] })
    expect(runExpression(buildSpaceClickExpression({ label: 'wt-2' }))).toEqual({ error: 'no-new-task-button', label: 'wt-2' })
  })

  it('按钮被禁用 → button-disabled（点了也没用，直接报错）', () => {
    const wt2 = sectionWith('wt-2', { disabled: true })
    globalThis.document = makeDocument({ [SELECTORS.sidebarSection]: [wt2.section] })
    expect(runExpression(buildSpaceClickExpression({ label: 'wt-2' }))).toEqual({ error: 'button-disabled', label: 'wt-2' })
    expect(wt2.button.clicked).toBe(false)
  })

  it('kind=card → 点该空间下第一张会话卡片', () => {
    const card = makeNode({ attrs: { 'data-conversation-id': 'sess-abc' } })
    const wt2 = sectionWith('wt-2', { cards: [card] })
    globalThis.document = makeDocument({ [SELECTORS.sidebarSection]: [wt2.section] })
    expect(runExpression(buildSpaceClickExpression({ label: 'wt-2', kind: 'card' }))).toEqual({ clicked: true, label: 'wt-2' })
    expect(card.clicked).toBe(true)
  })

  it('kind=card 但该空间没有卡片 → no-cards', () => {
    globalThis.document = makeDocument({ [SELECTORS.sidebarSection]: [sectionWith('wt-2').section] })
    expect(runExpression(buildSpaceClickExpression({ label: 'wt-2', kind: 'card' }))).toEqual({ error: 'no-cards', label: 'wt-2' })
  })

  it('空间名必须完全相等：「wt-2-old」不能被当成「wt-2」', () => {
    const old = sectionWith('wt-2-old')
    globalThis.document = makeDocument({ [SELECTORS.sidebarSection]: [old.section] })
    expect(runExpression(buildSpaceClickExpression({ label: 'wt-2' }))).toEqual({ error: 'no-section', label: 'wt-2' })
    expect(old.button.clicked).toBe(false)
  })

  it('反方向也钉死：侧栏只有更短的「wt」段时，目标「wt-2」不得命中', () => {
    const short = sectionWith('wt')
    globalThis.document = makeDocument({ [SELECTORS.sidebarSection]: [short.section] })
    expect(runExpression(buildSpaceClickExpression({ label: 'wt-2' }))).toEqual({ error: 'no-section', label: 'wt-2' })
    expect(short.button.clicked).toBe(false)
  })

  it('目标空间没有「+」时不回落到别的空间去点（错目录比不动更糟）', () => {
    const target = sectionWith('wt-2', { hasButton: false })
    const other = sectionWith('develop')
    globalThis.document = makeDocument({ [SELECTORS.sidebarSection]: [target.section, other.section] })
    expect(runExpression(buildSpaceClickExpression({ label: 'wt-2' }))).toEqual({ error: 'no-new-task-button', label: 'wt-2' })
    expect(other.button.clicked).toBe(false)
  })

  it('sessionId 分支：按 data-conversation-id 精确点那张卡片', () => {
    const card = makeNode({ attrs: { 'data-conversation-id': 'sess-abc' } })
    globalThis.document = makeDocument({ '[data-conversation-id="sess-abc"]': card })
    expect(runExpression(buildSpaceClickExpression({ sessionId: 'sess-abc' }))).toEqual({ clicked: true, sessionId: 'sess-abc' })
    expect(card.clicked).toBe(true)
  })

  it('sessionId 不在 DOM 里 → no-card（不退回点第一张）', () => {
    const other = makeNode({ attrs: { 'data-conversation-id': 'sess-other' } })
    globalThis.document = makeDocument({ '[data-conversation-id="sess-other"]': other })
    expect(runExpression(buildSpaceClickExpression({ sessionId: 'sess-abc' }))).toEqual({ error: 'no-card', sessionId: 'sess-abc' })
    expect(other.clicked).toBe(false)
  })
})

describe('buildCurrentSessionExpression', () => {
  it('读得到就返回真实 id（写回 last-session.json 用）', () => {
    globalThis.document = makeDocument({})
    expect(runExpression(buildCurrentSessionExpression())).toEqual({ ok: true, sessionId: 'sess-abc' })
  })

  it('渲染层 API 不在时返回 ok:false，调用方退回 sqlite', () => {
    globalThis.window = {}
    globalThis.document = makeDocument({})
    expect(runExpression(buildCurrentSessionExpression())).toEqual({ ok: false, reason: 'no-api' })
  })
})

describe('stripAssistantChrome / looksLikePlaceholder / extractReply', () => {
  it('剥掉「WorkBuddy / 已完成 11s / 共消耗 2.42 / Hy3 / 00:55」这些 UI 噪音', () => {
    const raw = ['WorkBuddy', '已完成 11s', '改完了 2 个文件', '共消耗 2.42', 'Hy3', '00:55'].join('\n')
    expect(stripAssistantChrome(raw)).toBe('改完了 2 个文件')
  })

  it('正文本身像单词时不会被当模型徽标吃掉（只剩一行时保留）', () => {
    expect(stripAssistantChrome('OK')).toBe('OK')
  })

  it('占位文案不算回复', () => {
    expect(looksLikePlaceholder('正在思考')).toBe(true)
    expect(looksLikePlaceholder('正在思考\n稍等')).toBe(true)
    expect(looksLikePlaceholder('OK')).toBe(false)
    expect(looksLikePlaceholder('')).toBe(true)
  })

  it('优先用 .cr-markdown 的干净正文（比剥字符串可靠）', () => {
    expect(extractReply({ lastReply: 'OK', agentCount: 1, lastMessages: [] })).toEqual({ text: 'OK', index: 0 })
  })

  it('没有 lastReply 时退回 lastMessages 并剥 chrome', () => {
    const reply = extractReply({ agentCount: 2, lastMessages: [{ text: 'WorkBuddy\n已完成 1s\n第一轮' }, { text: 'WorkBuddy\n已完成 2s\n第二轮' }] })
    expect(reply.text).toBe('第二轮')
  })

  it('空快照 / 只有占位 → null', () => {
    expect(extractReply(null)).toBeNull()
    expect(extractReply({ lastReply: '正在生成', agentCount: 1, lastMessages: [] })).toBeNull()
  })

  it('buildTailTextExpression 取最后一条助手正文（markers 检查点用）', () => {
    const markdown = makeNode({ innerText: '## [T1] DONE 改完了\n## [QUEUE] EMPTY' })
    const agent = makeNode({ children: { [SELECTORS.agentMarkdown]: markdown } })
    globalThis.document = makeDocument({ [SELECTORS.agentMessage + ' ' + SELECTORS.agentMarkdown]: [makeNode({ innerText: '旧的' }), markdown] })
    expect(runExpression(buildTailTextExpression())).toContain('## [QUEUE] EMPTY')
  })
})

describe('summarizeSnapshot', () => {
  it('写进 .runtime 的摘要包含会话 id / chips / 回复预览', () => {
    const summary = summarizeSnapshot({
      url: 'file:///x/renderer/index.html',
      title: 'WorkBuddy',
      messageCount: 2,
      agentCount: 1,
      hasEditor: true,
      stopLabels: [],
      chips: { workspace: null, branch: null, permission: '允许完全访问', model: 'Hy4' },
      editorText: '',
      currentSessionId: 'sess-abc',
      lastReply: 'OK',
    }, { timeoutMs: 240000 })
    expect(summary.currentSessionId).toBe('sess-abc')
    expect(summary.runState).toBe('idle')
    expect(summary.replyPreview).toBe('OK')
    expect(summary.timeoutMs).toBe(240000)
  })

  it('null 输入返回 null（失败时也要能落盘）', () => {
    expect(summarizeSnapshot(null)).toBeNull()
  })
})

describe('isSettledSignal（回合收尾判据）', () => {
  const base = { runState: 'idle', replyText: 'OK' }

  it('新会话：助手条数增长即收尾', () => {
    expect(isSettledSignal({ ...base, agentCount: 1, messageCount: 2, baselineCount: 0, baselineMessageCount: 0 })).toBe(true)
  })

  it('回归：基线停在上一会话（agentCount=1）时，也要靠 messageCount 收尾', () => {
    // 2026-11-05 实测 bug：打开新草稿前快照里 agentCount=1，拿它当基线 ⇒ 等 246s 后 exit 4，界面其实早答完了
    expect(isSettledSignal({ ...base, agentCount: 1, messageCount: 2, baselineCount: 1, baselineMessageCount: 0 })).toBe(true)
  })

  it('复用会话：正文变了也算收尾', () => {
    expect(isSettledSignal({ ...base, agentCount: 1, messageCount: 1, baselineCount: 1, baselineMessageCount: 1, baselineReply: '旧答案' })).toBe(true)
  })

  it('还在跑（有停止按钮）不收尾', () => {
    expect(isSettledSignal({ ...base, runState: 'running', agentCount: 1, messageCount: 2 })).toBe(false)
  })

  it('没有助手正文不收尾（避免刚发出就误判）', () => {
    expect(isSettledSignal({ runState: 'idle', replyText: null, agentCount: 0, messageCount: 1 })).toBe(false)
    expect(isSettledSignal({})).toBe(false)
  })

  it('正文与基线相同且条数没变：不收尾（防止把旧回复当新回复）', () => {
    expect(isSettledSignal({ ...base, agentCount: 1, messageCount: 1, baselineCount: 1, baselineMessageCount: 1, baselineReply: 'OK' })).toBe(false)
  })
})
describe('checkPinnedCwd（归属护栏：WorkBuddy 只准 wt-2）', () => {
  const wt2 = 'C:\\develop\\workspace\\AI-writer\\wt-2'

  it('大小写 / 分隔符 / 尾斜杠等价都算命中归属', () => {
    expect(samePath(wt2, 'c:/develop/workspace/AI-writer/wt-2/')).toBe(true)
    expect(checkPinnedCwd({ cwd: 'C:/develop/workspace/AI-writer/WT-2', pinnedCwd: wt2 })).toEqual({ ok: true, forced: false })
  })

  it('回归：--cwd 指到 wt-1 / develop 一律拒绝（2026-11-05 复核打回点：原先静默接受任意目录）', () => {
    const wt1 = checkPinnedCwd({ cwd: 'C:/develop/workspace/AI-writer/wt-1', pinnedCwd: wt2 })
    expect(wt1.ok).toBe(false)
    expect(wt1.reason).toContain('固定归属')
    expect(wt1.reason).toContain('--force')
    expect(checkPinnedCwd({ cwd: 'C:/develop/workspace/AI-writer/develop', pinnedCwd: wt2 }).ok).toBe(false)
  })

  it('--force 是唯一出口，返回 forced=true 让 CLI 打警告', () => {
    expect(checkPinnedCwd({ cwd: 'C:/develop/workspace/AI-writer/wt-1', pinnedCwd: wt2, force: true })).toEqual({ ok: true, forced: true })
  })

  it('前缀相近但不同的目录不算命中（wt-20 ≠ wt-2）', () => {
    expect(checkPinnedCwd({ cwd: 'C:/develop/workspace/AI-writer/wt-20', pinnedCwd: wt2 }).ok).toBe(false)
  })

  it('缺参时不放行（宁可不干，不能猜目录）', () => {
    expect(checkPinnedCwd({}).ok).toBe(false)
    expect(checkPinnedCwd({ cwd: wt2 }).ok).toBe(false)
    expect(checkPinnedCwd({ cwd: '   ', pinnedCwd: wt2 }).ok).toBe(false)
  })
})

describe('judgeLanding（派活落点闸门：会话 id + sessions.cwd）', () => {
  const wt2 = 'C:\\develop\\workspace\\AI-writer\\wt-2'

  it('回归：点「+」没生效、当前会话没变 ⇒ 拒（2026-11-11 02:1x 事故：文本落进旧会话却显示已发送）', () => {
    const r = judgeLanding({ beforeSessionId: 'old-1', afterSessionId: 'old-1', expectedCwd: wt2 })
    expect(r.ok).toBe(false)
    expect(r.verdict).toBe('stuck')
    expect(r.reason).toContain('旧会话')
  })

  it('会话已切换但还没落库 ⇒ 放行但标注未证实（新会话要等首条消息才进 sessions 表）', () => {
    const r = judgeLanding({ beforeSessionId: 'old-1', afterSessionId: 'new-2', expectedCwd: wt2 })
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(false)
    expect(r.verdict).toBe('switched-unverified')
  })

  it('落库 cwd 与期望一致 ⇒ 证实通过（含大小写/分隔符等价）', () => {
    const r = judgeLanding({ afterSessionId: 'new-2', landedCwd: 'c:/develop/workspace/AI-writer/WT-2/', expectedCwd: wt2 })
    expect(r.ok).toBe(true)
    expect(r.verified).toBe(true)
    expect(r.verdict).toBe('cwd-ok')
  })

  it('落库 cwd 不符 ⇒ 拒，且 --force 不赦免（这是活干错目录，不是归属争议）', () => {
    for (const force of [false, true]) {
      const r = judgeLanding({ afterSessionId: 'new-2', landedCwd: 'C:/develop/workspace/AI-writer/develop', expectedCwd: wt2, force })
      expect(r.ok).toBe(false)
      expect(r.verdict).toBe('cwd-mismatch')
    }
  })

  it('--force 同样不赦免 stuck（force 的语义是离开固定归属目录，不是投错会话）', () => {
    expect(judgeLanding({ beforeSessionId: 'old-1', afterSessionId: 'old-1', expectedCwd: wt2, force: true }).ok).toBe(false)
  })
})



describe('judgeFreshDraft（「这是不是一张空草稿」的界面证据）', () => {
  const HERO = '今天帮你做些什么？@ 添加上下文，/调用技能与指令'

  it('空草稿：currentId=null + messageCount=0 + 欢迎文案 ⇒ fresh', () => {
    const r = judgeFreshDraft({ currentSessionId: null, messageCount: 0, editorText: HERO, placeholderVisible: false })
    expect(r.fresh).toBe(true)
    expect(r.evidence).toEqual({ currentSessionId: null, messageCount: 0, editorChars: HERO.length, placeholderVisible: false })
  })

  it('真 placeholder 可见 ⇒ 也按空算（老版本 UI）', () => {
    expect(judgeFreshDraft({ currentSessionId: null, messageCount: 0, editorText: '', placeholderVisible: true }).fresh).toBe(true)
  })

  it('编辑器里有真实内容 ⇒ 不是空草稿（宁可拒绝也不在别人的稿子上打字）', () => {
    const r = judgeFreshDraft({ currentSessionId: null, messageCount: 0, editorText: '帮我改一下第三章', placeholderVisible: false })
    expect(r.fresh).toBe(false)
    expect(r.reason).toContain('编辑器字符数=8')
  })

  it('messageCount > 0 ⇒ 不是空草稿（旧会话里的残留）', () => {
    expect(judgeFreshDraft({ currentSessionId: null, messageCount: 6, editorText: '' }).fresh).toBe(false)
  })

  it('currentId 仍有值 ⇒ 不是空草稿（还停在上一条会话上）', () => {
    expect(judgeFreshDraft({ currentSessionId: 'old-1', messageCount: 0, editorText: '' }).fresh).toBe(false)
  })

  it('snapshot 缺失 ⇒ fail-closed（拿不到证据就不打字）', () => {
    const r = judgeFreshDraft(null)
    expect(r.fresh).toBe(false)
    expect(r.reason).toContain('currentSessionId=null')
    expect(r.reason).toContain('messageCount=-1')
  })

  it('欢迎文案改版 ⇒ fail-closed，但 reason 里带现场数字便于定位', () => {
    const r = judgeFreshDraft({ currentSessionId: null, messageCount: 0, editorText: '新的欢迎语', placeholderVisible: false })
    expect(r.fresh).toBe(false)
    expect(r.reason).toContain('编辑器字符数=5')
  })
})

/**
 * P55：归属从「单值固定」改为「单值默认 + 可注册白名单」。
 * 路径全部由 os.tmpdir() 推导——不把某台机器的绝对路径钉进用例（换机可跑）。
 */
describe('checkPinnedCwd · 可注册白名单（WORKBUDDY_ALLOWED_CWDS）', () => {
  const ROOT = path.join(os.tmpdir(), 'wb-allowlist-case')
  const PINNED = path.join(ROOT, 'wt-2')
  const EXTRA = path.join(ROOT, 'dsh-group-rules-prompt')
  const OTHER = path.join(ROOT, 'another-repo')

  it('G1 不注册时行为零变化：pinned 命中放行，投别处仍拒且报错列出归属白名单', () => {
    expect(checkPinnedCwd({ cwd: PINNED, pinnedCwd: PINNED })).toEqual({ ok: true, forced: false })
    expect(checkPinnedCwd({ cwd: PINNED, pinnedCwd: PINNED, allowedCwds: [] })).toEqual({ ok: true, forced: false })

    const refused = checkPinnedCwd({ cwd: EXTRA, pinnedCwd: PINNED })
    expect(refused.ok).toBe(false)
    expect(refused.reason).toContain('归属白名单')
    expect(refused.reason).toContain('--force')
    expect(refused.reason).toContain(PINNED) // 生效清单里必须有默认归属
    expect(refused.reason).toContain('WORKBUDDY_ALLOWED_CWDS')
  })

  it('G2 注册后可投，且是白名单放行、不是 --force 放行', () => {
    expect(checkPinnedCwd({ cwd: EXTRA, pinnedCwd: PINNED, allowedCwds: [EXTRA] })).toEqual({ ok: true, forced: false })
    // 没注册的目录照旧拒（白名单不是「注册一个、全放开」）
    expect(checkPinnedCwd({ cwd: OTHER, pinnedCwd: PINNED, allowedCwds: [EXTRA] }).ok).toBe(false)
    // 多项注册时逐条判
    expect(checkPinnedCwd({ cwd: OTHER, pinnedCwd: PINNED, allowedCwds: [EXTRA, OTHER] })).toEqual({ ok: true, forced: false })
    // 报错里要把已注册项一起列出来（否则看不懂为什么还是拒）
    expect(checkPinnedCwd({ cwd: OTHER, pinnedCwd: PINNED, allowedCwds: [EXTRA] }).reason).toContain(EXTRA)
  })

  it('G3 按路径段判包含：-other / 尾缀 X 不混过，子目录属该归属', () => {
    const allowedCwds = [EXTRA]
    expect(checkPinnedCwd({ cwd: EXTRA + '-other', pinnedCwd: PINNED, allowedCwds }).ok).toBe(false)
    expect(checkPinnedCwd({ cwd: EXTRA + 'X', pinnedCwd: PINNED, allowedCwds }).ok).toBe(false)
    expect(checkPinnedCwd({ cwd: path.join(EXTRA, 'sub', 'dir'), pinnedCwd: PINNED, allowedCwds }))
      .toEqual({ ok: true, forced: false })
  })

  it('G4 边界拒绝：通配符 / 盘根 / 相对路径一律拒；大小写与斜杠变体照旧命中', () => {
    const wildcardStar = checkPinnedCwd({ cwd: EXTRA, pinnedCwd: PINNED, allowedCwds: [path.join(EXTRA, '*')] })
    expect(wildcardStar.ok).toBe(false)
    expect(wildcardStar.reason).toContain('通配符')

    const wildcardQuestion = checkPinnedCwd({ cwd: EXTRA, pinnedCwd: PINNED, allowedCwds: [path.join(EXTRA, '?')] })
    expect(wildcardQuestion.ok).toBe(false)
    expect(wildcardQuestion.reason).toContain('通配符')

    // 盘根：放行整盘等于没有护栏。path.parse(...).root 在两平台分别是 'C:\' 与 '/'
    const driveRoot = path.parse(PINNED).root
    const rootRefused = checkPinnedCwd({ cwd: EXTRA, pinnedCwd: PINNED, allowedCwds: [driveRoot] })
    expect(rootRefused.ok).toBe(false)
    expect(rootRefused.reason).toContain('盘根')

    // 请求是相对路径：无从判定是否在归属之下 ⇒ 拒（宁可不干，不猜基准目录）
    const relativeRequest = checkPinnedCwd({ cwd: 'dsh-group-rules-prompt', pinnedCwd: PINNED, allowedCwds: [EXTRA] })
    expect(relativeRequest.ok).toBe(false)
    expect(relativeRequest.reason).toContain('绝对路径')

    // 注册项本身是相对路径 ⇒ 同样拒（不拿 process.cwd() 去猜一个基准）
    expect(checkPinnedCwd({ cwd: EXTRA, pinnedCwd: PINNED, allowedCwds: ['dsh-group-rules-prompt'] }).ok).toBe(false)

    // 大小写 / 分隔符变体与 samePath 同口径
    expect(checkPinnedCwd({ cwd: EXTRA.replace(/\\/g, '/').toUpperCase(), pinnedCwd: PINNED, allowedCwds: [EXTRA] }))
      .toEqual({ ok: true, forced: false })
  })

  it('G5 --force 未放宽：白名单外的请求仍只有 force 能过，且标 forced=true', () => {
    expect(checkPinnedCwd({ cwd: OTHER, pinnedCwd: PINNED, allowedCwds: [EXTRA], force: true })).toEqual({ ok: true, forced: true })
    expect(checkPinnedCwd({ cwd: OTHER, pinnedCwd: PINNED, allowedCwds: [EXTRA], force: false }).ok).toBe(false)
  })

  it('allowedCwds 传单个字符串也吃得下（不静默当成字符数组）', () => {
    expect(checkPinnedCwd({ cwd: EXTRA, pinnedCwd: PINNED, allowedCwds: EXTRA })).toEqual({ ok: true, forced: false })
  })
})

describe('isUnderCwd（归属白名单的路径段判据）', () => {
  it('同目录 / 子目录算包含；前缀相近的兄弟目录不算', () => {
    const base = path.join(os.tmpdir(), 'wb-under-case', 'repo')
    expect(isUnderCwd(base, base)).toBe(true)
    expect(isUnderCwd(path.join(base, 'a', 'b'), base)).toBe(true)
    expect(isUnderCwd(base + '-other', base)).toBe(false)
    expect(isUnderCwd(base + 'X', base)).toBe(false)
    expect(isUnderCwd(path.dirname(base), base)).toBe(false)
  })

  it('归一化与 samePath 同口径：反斜杠 / 正斜杠 / 尾斜杠 / 大小写等价', () => {
    const base = path.join(os.tmpdir(), 'wb-under-case', 'repo')
    expect(isUnderCwd(base.toUpperCase().replace(/\\/g, '/') + '/', base)).toBe(true)
  })

  it('空值不命中（宁可不干，不能猜目录）', () => {
    expect(isUnderCwd('', 'C:/x')).toBe(false)
    expect(isUnderCwd('C:/x', '')).toBe(false)
  })
})
