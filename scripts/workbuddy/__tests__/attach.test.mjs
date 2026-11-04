import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_PORT,
  DEBUG_ENV,
  SELECTORS,
  buildCurrentSessionExpression,
  buildNeedHumanDebugBanner,
  buildSnapshotExpression,
  buildSpaceActionExpression,
  buildStartCommands,
  buildTailTextExpression,
  extractReply,
  isSettledSignal,
  looksLikePlaceholder,
  parseCdpVersion,
  pickPage,
  readRunState,
  resolveExePath,
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

