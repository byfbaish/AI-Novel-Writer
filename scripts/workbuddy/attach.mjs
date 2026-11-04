/**
 * WorkBuddy 桌面通道（attach / CDP）—— 纯函数层。
 *
 * 与 cli.mjs（headless codebuddy -p 兜底通道）并列：
 * - CLI 通道要一次性登录，且拿不到桌面端登录态/积分；
 * - attach 通道复用用户已登录的桌面实例，走 CDP 驱动真实 UI，单会话可多轮。
 *
 * 本文件不碰网络、不碰文件系统：所有 DOM/字符串处理都能被单测直接调用。
 * 选择器集中在这里 —— WorkBuddy 升级后只需要改这一个文件。
 */

export const DEFAULT_PORT = 9333
export const DEFAULT_TIMEOUT_MS = 900_000
export const POLL_INTERVAL_MS = 2_000
export const READY_TIMEOUT_MS = 45_000

/**
 * 全部锚点都来自实测（WorkBuddy 5.9.3 / Chromium 138）：没有 data-testid，
 * class 是 CSS Modules 带 hash ⇒ 只用「稳定的语义前缀」或 aria-label，别抄 hash。
 */
export const SELECTORS = {
  editor: 'div[data-slate-editor="true"][role="textbox"]',
  editorAny: '[data-slate-editor="true"]',
  sendButton: 'button[aria-label="发送"]',
  newTaskButton: '[aria-label="新建任务"]',
  message: '[data-message-id]',
  messageList: '.cr-message-list',
  agentMessage: '.cr-agent',
  agentMarkdown: '.cr-markdown',
  userMessage: '.cr-user-content',
  conversationCard: '[data-conversation-id]',
  sidebarSection: 'div.collapsible-section',
  sidebarSectionLabel: '.collapsible-section-label',
  spaceNewTaskButton: 'button.workspace-new-task-button',
  workspaceChip: '.cr-input-footer-item.cr-workspace-picker',
  branchChip: '[class*="worktreeBranchTrigger"]',
  permissionChip: '.cr-input-footer-item.cr-permission-setting',
  modelChip: '.cr-model-selector__trigger',
  modelTrigger: '.cr-model-selector__trigger',
  modelItem: '[role="option"].cr-model-selector__item',
  modelItemName: '.cr-model-selector__item-name',
  modelItemSelected: '.cr-model-selector__item--selected',
}

/**
 * WorkBuddy 的「Debug 模式」不是命令行开关：主进程启动时读
 * WORKBUDDY_REMOTE_DEBUGGING_PORT，自己 appendSwitch('remote-debugging-port')。
 * 直接给 exe 传 --remote-debugging-port 会被忽略。
 */
export const DEBUG_ENV = 'WORKBUDDY_REMOTE_DEBUGGING_PORT'

export function resolveExePath({ env = {}, platform = process.platform, exists = () => true } = {}) {
  if (env.WORKBUDDY_EXE) return { path: env.WORKBUDDY_EXE, via: 'env' }
  const localAppData = env.LOCALAPPDATA
  if (!localAppData) return { path: null, via: 'missing-localappdata' }
  const candidate = [localAppData, 'Programs', 'WorkBuddy', 'WorkBuddy.exe'].join(platform === 'win32' ? '\\' : '/')
  return { path: exists(candidate) ? candidate : null, via: exists(candidate) ? 'localappdata' : 'not-found' }
}

/** 只取渲染层的主窗口（豆包的 pickChatPage 认 doubao-chat，这里认 app.asar 的 renderer/index.html）。 */
export function pickPage(targets) {
  if (!Array.isArray(targets)) return null
  return targets.find(target => target && target.type === 'page' && typeof target.url === 'string' && target.url.includes('/renderer/index.html'))
    ?? targets.find(target => target && target.type === 'page' && typeof target.url === 'string' && target.url.includes('app.asar'))
    ?? null
}

export function parseCdpVersion(payload) {
  if (!payload || typeof payload !== 'object') return null
  const browser = typeof payload.Browser === 'string' ? payload.Browser : ''
  const ua = typeof payload['User-Agent'] === 'string' ? payload['User-Agent'] : ''
  const app = /WorkBuddy\/([\d.]+)/.exec(ua)?.[1] ?? null
  const chromium = /Chrome\/([\d.]+)/.exec(browser)?.[1] ?? null
  return { browser, appVersion: app, chromiumVersion: chromium, ua }
}

/** 环境变量只在进程启动时读一次 ⇒ 已经开着的实例不会因为改了环境变量就长出一个调试端口。 */
export function buildStartCommands({ port = DEFAULT_PORT, exePath } = {}) {
  const exe = exePath ?? '%LOCALAPPDATA%\\Programs\\WorkBuddy\\WorkBuddy.exe'
  return {
    cmd: 'set ' + DEBUG_ENV + '=' + port + ' && start "" "' + exe + '"',
    powershell: "$env:" + DEBUG_ENV + "='" + port + "'; Start-Process \"$env:LOCALAPPDATA\\Programs\\WorkBuddy\\WorkBuddy.exe\"",
    script: 'cmd /c "scripts\\workbuddy\\start-workbuddy-debug.cmd"',
  }
}

/** 给人抄的横幅：完整命令 + 最容易踩的那条（必须先退出旧实例）。 */
export function buildNeedHumanDebugBanner({ port = DEFAULT_PORT, reason, exePath } = {}) {
  const line = '-'.repeat(72)
  const commands = buildStartCommands({ port, exePath })
  return [
    line,
    '⚠  需要人工打开 Debug 模式（本会话拉不起来）',
    '   原因：' + (reason ?? ('CDP 端口 ' + port + ' 未监听')),
    '',
    '   步骤：先在托盘的 WorkBuddy 上右键 → 退出（旧实例不关，新进程会被单实例锁挡掉；',
    '         环境变量只在启动时读一次 ⇒ 不重启就没有调试端口）。',
    '',
    '   然后在【你自己的】PowerShell / Windows Terminal 里执行：',
    '',
    '     ' + commands.powershell,
    '',
    '   或者 cmd：',
    '',
    '     ' + commands.cmd,
    '',
    '   也可以直接跑仓库里的脚本（cmd 里执行）：',
    '',
    '     ' + commands.script,
    '',
    '   起来后窗口留着别关，重跑本命令（在线就只连不点，不会新建会话）。',
    line,
    'NEED_HUMAN_DEBUG',
  ].join('\n')
}

/**
 * 在页面里跑的快照函数。必须只依赖 document/window 与入参 —— 它会被
 * toString() 序列化后注入渲染层，引用模块作用域变量会在页面里炸掉。
 */
export function snapshotInPage(selectors) {
  const NBSP = String.fromCharCode(160)
  const norm = text => String(text == null ? '' : text)
    .split(NBSP).join(' ')
    .split('\r').join('')
    .split(/[ \t]+/).join(' ')
    .split('\n').map(line => line.trim()).filter(Boolean).join('\n')
    .trim()

  const first = selector => { try { return document.querySelector(selector) } catch (error) { return null } }
  const all = selector => { try { return Array.prototype.slice.call(document.querySelectorAll(selector)) } catch (error) { return [] } }
  const textOf = selector => { const node = first(selector); return node ? norm(node.innerText || node.textContent) : null }

  const buttons = all('button, [role="button"]')
  const labels = []
  const stopping = []
  for (const button of buttons) {
    const label = norm(button.getAttribute('aria-label') || button.title || '')
    if (!label) continue
    if (labels.length < 60) labels.push(label)
    if (/停止|取消|中止|正在生成/.test(label)) stopping.push(label)
  }

  const send = first(selectors.sendButton)
  const editor = first(selectors.editor) || first(selectors.editorAny)
  const agents = all(selectors.agentMessage)
  const users = all(selectors.userMessage)
  const messages = all(selectors.message)

  // 助手正文就取最后一条 .cr-agent 里的 .cr-markdown：innerText 里没有
  // 「WorkBuddy / 已完成 11s / Hy3 / 00:55」这些 chrome，比剥字符串可靠。
  let lastReply = null
  for (let index = agents.length - 1; index >= 0 && lastReply === null; index -= 1) {
    const markdown = agents[index].querySelector(selectors.agentMarkdown)
    const text = markdown ? norm(markdown.innerText || markdown.textContent) : ''
    if (text) lastReply = text
  }

  let currentSessionId = null
  try {
    const wb = window.wb
    if (wb && wb.conversations && wb.conversations.currentId) currentSessionId = String(wb.conversations.currentId)
  } catch (error) { /* Proxy 上取属性可能抛，忽略 */ }

  return {
    url: location.href.slice(0, 200),
    title: document.title,
    readyState: document.readyState,
    hasEditor: Boolean(editor),
    editorText: editor ? norm(editor.innerText || editor.textContent) : null,
    placeholderVisible: Boolean(document.querySelector('[data-slate-placeholder]') && editor && !norm(editor.innerText || '').length),
    send: send ? { found: true, disabled: Boolean(send.disabled) || send.getAttribute('aria-disabled') === 'true' } : { found: false, disabled: null },
    stopLabels: stopping,
    buttonLabels: labels,
    messageCount: messages.length,
    agentCount: agents.length,
    userCount: users.length,
    lastReply,
    currentSessionId,
    lastMessages: messages.slice(-6).map(node => ({
      id: node.getAttribute('data-message-id') || null,
      text: norm(node.innerText || node.textContent).slice(0, 6000),
    })),
    chips: {
      workspace: textOf(selectors.workspaceChip),
      branch: textOf(selectors.branchChip),
      permission: textOf(selectors.permissionChip),
      model: textOf(selectors.modelChip),
    },
  }
}

export function buildSnapshotExpression(selectors = SELECTORS) {
  return '(' + snapshotInPage.toString() + ')(' + JSON.stringify(selectors) + ')'
}

/** 清空编辑器：Slate 认「全选内容」+ Backspace；先选中，再让调用方按 Backspace。 */
export function buildClearEditorExpression(selectors = SELECTORS) {
  const target = JSON.stringify(selectors.editor)
  const fallback = JSON.stringify(selectors.editorAny)
  return '(function(){' +
    'var el=document.querySelector(' + target + ')||document.querySelector(' + fallback + ');' +
    'if(!el) return false;' +
    'el.focus();' +
    'var r=document.createRange();r.selectNodeContents(el);' +
    'var s=window.getSelection();s.removeAllRanges();s.addRange(r);' +
    'return true;' +
    '})()'
}

/**
 * 侧栏里「按空间开新会话 / 切到某个会话」的点击目标（返回 rect 或 {error}）。
 *
 * - kind='new-task'：某空间标题右边的「+」按钮 ⇒ 该目录下的新会话草稿；
 * - kind='card'：某空间下的会话卡片（默认第一张 = 最近一条）；
 * - sessionId：直接按 data-conversation-id 找卡片。
 *
 * 为什么不 spawn exe 传路径：实测 second-instance 转发不可靠（有时什么都不发生），
 * 而这套 DOM 路径每次都能落到「chips 里工作区 = 目标目录」的草稿上。
 */
export function buildSpaceActionExpression({ label, kind = 'new-task', sessionId = null, selectors = SELECTORS } = {}) {
  const cfg = JSON.stringify({ label: label ?? null, kind, sessionId, selectors })
  return '(function(cfg){' +
    'var s=cfg.selectors;' +
    'function rect(el){ el.scrollIntoView({block:"center"}); var r=el.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2, w:r.width, h:r.height}; }' +
    'if (cfg.sessionId) {' +
    '  var card=document.querySelector("[data-conversation-id=\\""+cfg.sessionId+"\\"]");' +
    '  if(!card) return {error:"no-card", sessionId:cfg.sessionId};' +
    '  return rect(card);' +
    '}' +
    'var sections=Array.prototype.slice.call(document.querySelectorAll(s.sidebarSection));' +
    'for (var i=0;i<sections.length;i++){' +
    '  var labelEl=sections[i].querySelector(s.sidebarSectionLabel);' +
    '  if(!labelEl || labelEl.textContent.trim()!==cfg.label) continue;' +
    '  if (cfg.kind==="new-task") {' +
    '    var btn=sections[i].querySelector(s.spaceNewTaskButton);' +
    '    if(!btn) return {error:"no-new-task-button", label:cfg.label};' +
    '    return rect(btn);' +
    '  }' +
    '  var cards=sections[i].querySelectorAll(s.conversationCard);' +
    '  if(!cards.length) return {error:"no-cards", label:cfg.label};' +
    '  return rect(cards[0]);' +
    '}' +
    'return {error:"no-section", label:cfg.label};' +
    '})(' + cfg + ')'
}

/**
 * 列出模型选择器里的所有模型（含积分倍率与是否选中）。
 * 必须先点开选择器：列表是 portal，收起时不在 DOM 里。
 */
export function buildModelItemsExpression(selectors = SELECTORS) {
  const cfg = JSON.stringify(selectors)
  return '(function(s){' +
    'var out=[];' +
    'Array.prototype.slice.call(document.querySelectorAll(s.modelItem)).forEach(function(n){' +
    '  var nameEl=n.querySelector(s.modelItemName);' +
    '  var name=nameEl?(nameEl.textContent||"").trim():"";' +
    '  var creditsEl=n.querySelector(".cr-model-selector__item-credits");' +
    '  out.push({name:name, credits:creditsEl?(creditsEl.textContent||"").trim():null, selected:n.classList.contains("cr-model-selector__item--selected")});' +
    '});' +
    'return out;' +
    '})(' + cfg + ')'
}

/**
 * 在模型选择器里按名字找一项，返回可点的 rect（找不到返回 {error:'no-model', models:[...]}）。
 * 名字必须与 .cr-model-selector__item-name 的文本完全一致（如 Hy4 / DeepSeek-V4.1-Flash）。
 */
export function buildModelOptionExpression({ model, selectors = SELECTORS } = {}) {
  const cfg = JSON.stringify({ model, selectors })
  return '(function(cfg){' +
    'var s=cfg.selectors;' +
    'var items=Array.prototype.slice.call(document.querySelectorAll(s.modelItem));' +
    'var names=[];' +
    'for (var i=0;i<items.length;i++){' +
    '  var nameEl=items[i].querySelector(s.modelItemName);' +
    '  var name=nameEl?(nameEl.textContent||"").trim():"";' +
    '  names.push(name);' +
    '  if(name!==cfg.model) continue;' +
    '  items[i].scrollIntoView({block:"center"});' +
    '  var r=items[i].getBoundingClientRect();' +
    '  return {x:r.left+r.width/2, y:r.top+r.height/2, w:r.width, h:r.height, selected:items[i].classList.contains("cr-model-selector__item--selected")};' +
    '}' +
    'return {error:"no-model", model:cfg.model, models:names};' +
    '})(' + cfg + ')'
}

/** 当前会话 id（渲染层 API；拿不到就返回 null，调用方退回 sqlite）。 */
export function buildCurrentSessionExpression() {
  return '(function(){try{var wb=window.wb;if(!wb||!wb.conversations) return {ok:false,reason:"no-api"};' +
    'var id=wb.conversations.currentId;return {ok:true,sessionId:id?String(id):null};}catch(e){return {ok:false,reason:String(e&&e.message||e)}};})()'
}

/** 「跑完了没有」：有停止类按钮就是在跑；否则看助手正文是否还在变（由调用方判断）。 */
export function readRunState(snapshot) {
  if (!snapshot) return 'unknown'
  if (!snapshot.hasEditor) return 'no-editor'
  if (Array.isArray(snapshot.stopLabels) && snapshot.stopLabels.length) return 'running'
  return 'idle'
}

/**
 * 判定「一问一答已经收尾」：UI idle 且出现了新的助手正文。
 *
 * 基线必须在「切完会话 / 开完草稿之后」取（打字后那一次快照），因为：
 * - 新草稿页面上没有历史消息，但打开草稿之前页面可能还停在上一条会话（agentCount=1），
 *   拿那个数当基线 ⇒ grew 永远 false，等到超时也收不了尾（2026-11-05 实测踩过，exit 4 但界面早就答完了）。
 * - 复用会话时 agentCount 可能因为虚拟滚动没变，所以再看 messageCount（一问一答 = +2）与正文变化兜底。
 */
export function isSettledSignal({
  runState,
  agentCount = 0,
  messageCount = 0,
  replyText = null,
  baselineCount = 0,
  baselineMessageCount = 0,
  baselineReply = null,
} = {}) {
  if (runState !== 'idle') return false
  if (!replyText) return false
  if ((agentCount ?? 0) > (baselineCount ?? 0)) return true
  if ((messageCount ?? 0) >= (baselineMessageCount ?? 0) + 2) return true
  return baselineReply !== null && replyText !== baselineReply
}

/**
 * 归属护栏用的纯路径比较：Windows 大小写不敏感，'C:\\a\\b' 与 'c:/a/b/' 必须等价。
 */
export function samePath(a, b) {
  const norm = value => String(value ?? '').replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase()
  const left = norm(a)
  return left !== '' && left === norm(b)
}

/**
 * 归属护栏：WorkBuddy 只准在 pinnedCwd（wt-2）里干活（docs/agents/worktree-parallel.md §3.1）。
 *
 * 只做纯判断，打印与退出码在 CLI 层：返回 {ok:true}（forced 表示走了 --force），或 {ok:false, reason}。
 * --force 是人工授权的唯一出口，必须在报告里写明原因。
 */
export function checkPinnedCwd({ cwd, pinnedCwd, force = false } = {}) {
  if (!cwd) return { ok: false, reason: '缺少目标目录' }
  if (!pinnedCwd) return { ok: false, reason: '未配置归属目录（pinnedCwd）' }
  if (samePath(cwd, pinnedCwd)) return { ok: true, forced: false }
  if (force) return { ok: true, forced: true }
  return {
    ok: false,
    reason:
      '目标目录不在本通道的固定归属里：\n  请求=' + cwd + '\n  归属=' + pinnedCwd +
      '\n（WorkBuddy 固定用 wt-2，见 docs/agents/worktree-parallel.md §3.1；确需排障时加 --force，并在报告里写明）',
  }
}

const PLACEHOLDER = /^(WorkBuddy|正在思考|思考中|正在生成|正在处理)$/
const CHROME_LINE = [
  /^WorkBuddy$/,
  /^已完成\s*[\d.]+\s*[smhodSMHD]?\S*$/,
  /^共消耗\s*[\d.]+$/,
  /^(耗时|用时)\s*[\d.]+\s*[smhodSMHD]?$/,
  /^\d{1,2}:\d{2}$/,
]

/** 助手消息体在 innerText 里形如「WorkBuddy / 已完成 9m30s / 正文… / Hy3 / 00:55」 —— 去掉这些 UI 噪音。 */
export function stripAssistantChrome(text) {
  const lines = String(text == null ? '' : text).split('\n').map(line => line.trim()).filter(Boolean)
  const kept = []
  for (const line of lines) {
    if (CHROME_LINE.some(pattern => pattern.test(line))) continue
    kept.push(line)
  }
  // 结尾的模型徽标（Hy3 / Hy4 / DeepSeek-V4.1-Flash 之类）只在它单独成行且位于末尾时去掉
  while (kept.length > 1 && /^[A-Za-z][\w.-]{0,24}$/.test(kept[kept.length - 1])) kept.pop()
  return kept.join('\n').trim()
}

export function looksLikePlaceholder(text) {
  const trimmed = String(text == null ? '' : text).trim()
  if (!trimmed) return true
  return PLACEHOLDER.test(trimmed.split('\n')[0].trim())
}

/** 取最后一条助手正文：优先 .cr-markdown 的干净文本，退回 lastMessages 剥 chrome。 */
export function extractReply(snapshot) {
  if (!snapshot) return null
  if (typeof snapshot.lastReply === 'string') {
    const cleaned = snapshot.lastReply.trim()
    if (cleaned && !looksLikePlaceholder(cleaned)) return { text: cleaned, index: typeof snapshot.agentCount === 'number' ? snapshot.agentCount - 1 : 0 }
  }
  if (!Array.isArray(snapshot.lastMessages)) return null
  const texts = snapshot.lastMessages.map(message => stripAssistantChrome(message.text)).filter(text => text.length > 0)
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    if (looksLikePlaceholder(texts[index])) continue
    return { text: texts[index], index }
  }
  return null
}

/** 页面里「最后一条助手正文」的全部文字 —— 与豆包 markers 的取数口径一致。 */
export function buildTailTextExpression(selectors = SELECTORS) {
  const agentSelector = JSON.stringify(selectors.agentMessage + ' ' + selectors.agentMarkdown)
  return '(function(){' +
    'var agents=Array.prototype.slice.call(document.querySelectorAll(' + agentSelector + '));' +
    'var texts=agents.map(function(n){return (n.innerText||n.textContent||"").trim();}).filter(Boolean);' +
    'if(!texts.length) return "";' +
    'return texts[texts.length-1].slice(-20000);' +
    '})()'
}

/** 写进 .runtime 的摘要，方便事后核对「那轮到底花了多久、改了什么」。 */
export function summarizeSnapshot(snapshot, { timeoutMs } = {}) {
  if (!snapshot) return null
  const reply = extractReply(snapshot)
  return {
    url: snapshot.url,
    title: snapshot.title,
    messageCount: snapshot.messageCount,
    agentCount: snapshot.agentCount,
    runState: readRunState(snapshot),
    chips: snapshot.chips,
    editorText: snapshot.editorText,
    currentSessionId: snapshot.currentSessionId ?? null,
    replyPreview: reply ? reply.text.slice(0, 400) : null,
    timeoutMs: timeoutMs ?? null,
  }
}