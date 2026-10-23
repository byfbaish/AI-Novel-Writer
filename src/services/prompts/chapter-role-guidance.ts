import { CHAPTER_ROLE_LABELS, CHAPTER_ROLES, type ChapterRole } from '../../shared/chapter-role'
import type { WritingLanguage } from '../../shared/writing-language'

/**
 * 章节定位（`blueprints.role`）→ 本章的写作注意事项。
 *
 * 为什么需要它：`role` 早就随 `chapter_info` 的 JSON 进了正文请求
 * （`prompt-builder.ts` 的 `withChapterInfo`），但模板正文里没有一句解释它 ——
 * 模型收到的只是 `"role": "发展"` 这样一个裸标签，行为价值接近零。
 *
 * ★ 与 `rhythm-profiles.ts` 的两处刻意不同：
 *
 * 1. **未知值不原样输出**。`role` 存的是自由文本（PR #309 的保真约束：旧值「开篇」、
 *    作者自定义值必须原样保留），实测常写成整句（「发展——承接第5章门牌篡改的物证」）。
 *    原样注入等于把一句**材料**升格成**规则**，而且它与蓝图 JSON 里同一句话重复。
 *    所以这里认不出就返回空串（与判据 DN 同型：未知不填默认档）。
 * 2. **每档必须成对**（判据 AP：给了一侧的权威，必须同时给那一侧的限制）。
 *    只写「本章该承担什么」会让模型为了履行定位硬塞事件；所以每档固定
 *    2 条「承担」+ 2 条「不做」。
 *
 * 术语纪律：「转折」这一档的正文只写「翻转/反转」，不写结构位、覆盖、额度一类
 * 弧光层词汇 —— 弧光层的「转折」是一次性的结构位额度，与本章的叙事功能不是一回事。
 *
 * ★ 改这七段文案前先过「条款准入三问」（`docs/design/prompt/prompt-clause-admission.md`）：
 * 禁令的对象只能是**无依据的**写法，不能是写法本身。初版写过「不要让关键结果靠外力解决」，
 * 把作者在章纲里正当地要的外援一起禁了，而且绝对禁令会反过来架空前导行的作者优先权。
 */

const ROLE_GUIDANCE: Record<ChapterRole, Record<WritingLanguage, readonly string[]>> = {
  建置: {
    'zh-CN': [
      '承担：把局面交代清楚——谁在哪、手里有什么、被什么卡住；读完读者要能说出他想干什么、拦着他的是什么。',
      '承担：让至少一格变化落地（关系、信息或处境），不要写成纯介绍。',
      '不做：不要用旁白成段讲世界观、人物履历和势力关系；设定跟着人物当下的动作和麻烦露出来。',
      '不做：不要开场先写起居、天气和赶路；建置不是热身，第一场戏就得有事。',
    ],
    'en-US': [
      'Own: establish the situation — who is where, what they hold, and what stands in the way. A reader should be able to say what the protagonist wants right now and what blocks it.',
      'Own: land at least one change (a relationship, a piece of information, or the situation itself); a pure introduction is not enough.',
      "Don't: lecture on worldbuilding, backstory, or faction maps in narration; let the setting surface through what people are doing and what is going wrong for them.",
      "Don't: open on routine, weather, or travel; setup is not a warm-up, and the first scene must already have a problem.",
    ],
  },
  铺垫: {
    'zh-CN': [
      '承担：埋下后文要用的东西（人、物、一句话、一条规矩），并且让它在当下就有用，读者回头能对上。',
      '承担：让主角先付一点代价或欠一笔账，留下「这事没完」的预期。',
      '不做：不要把伏笔写成提示牌（「他不知道，这将改变一切」），也不要让角色替作者总结「这是一条重要线索」。',
      '不做：不要为了埋伏笔停下本章正在发生的事；伏笔要挂在当前冲突上，不能单开一段讲。',
    ],
    'en-US': [
      'Own: plant something later chapters will need — a person, an object, a line, a rule — and make it useful now, so the payoff feels earned when it lands.',
      'Own: make the protagonist pay a small price or owe a debt, leaving the matter visibly open.',
      `Don't: signpost the plant ("little did he know"), and never let a character announce that something is an important clue.`,
      "Don't: stop the scene to plant it; the plant has to hang on the conflict already running.",
    ],
  },
  发展: {
    'zh-CN': [
      '承担：让本章的事情真的往前走一格：目标推进、关系变化、信息增量，至少落一样。',
      '承担：把推进过程写出具体动作和阻力，让读者看到他是怎么办到的。',
      '不做：不要原地打转——同一场争执、同一条线索反复确认，读完等于没读。',
      '不做：不要为凑篇幅加与本章目标无关的支线和路人；日常只有本身构成进展（关系、信息或处境）时才写。',
    ],
    'en-US': [
      "Own: move the chapter's business forward one notch — a goal advances, a relationship shifts, or new information lands; at least one must actually happen.",
      'Own: show the how, through concrete action and resistance, instead of summarizing that progress occurred.',
      'Don\'t: tread water by re-confirming the same argument or the same clue; the reader must not end where they started.',
      "Don't: pad with subplots or passers-by unrelated to this chapter's goal; daily life earns its space only when it is itself the advance (a relationship, information, or the situation).",
    ],
  },
  冲突: {
    'zh-CN': [
      '承担：让本章出现一次正面交锋，双方各有想要的，也各有不能退的理由。',
      '承担：让交锋产生后果——关系、资源、信息或立场至少变一样。',
      '不做：不要只写嘴仗和情绪；冲突要靠具体行动、代价和选择往前推。',
      '不做：对手的强弱要与前文交代一致——该强的不能一击就倒；要写碾压，先写出力量差的根据。主角也不能靠巧合或临时新能力无损过关。',
    ],
    'en-US': [
      'Own: stage one real confrontation where both sides want something and both have a reason they cannot back down.',
      'Own: make the clash cost something — a relationship, a resource, information, or a position must change.',
      "Don't: settle it with talk and feelings alone; conflict moves through action, cost, and choice.",
      "Don't: let strength drift from what earlier chapters established — the strong cannot fold at the first blow, and a rout needs the basis for the gap shown first; nor may the protagonist pass untouched on coincidence or a convenient new power.",
    ],
  },
  高潮: {
    'zh-CN': [
      '承担：把此前攒下的压力在本章集中兑现：主角做出关键选择，付出代价，结果不可逆。',
      '承担：给读者一次明确的情感落点——赢、输、翻盘或认账，总要有一个。',
      '不做：不要在高潮章另开与本章无关的新线、讲新设定或插无关回忆；两条线汇合可以，但笔墨只服务这一场。',
      '不做：外援可以来，但必须前文埋过、由本章人物的选择或代价召来，且仍要付代价；不要用毫无铺垫的救兵或对手突然犯蠢来收场。',
    ],
    'en-US': [
      'Own: cash in the pressure built so far — the protagonist makes the key choice, pays for it, and the outcome cannot be undone.',
      'Own: give the reader one clear release — a win, a loss, a comeback, or an accounting — and land it.',
      "Don't: open an unrelated thread, explain new lore, or cut to an unrelated flashback; two threads may converge, but every line serves this one scene.",
      "Don't: close on setup-free rescue — outside help may arrive, but it must be planted earlier, summoned by this chapter's choices or costs, and still cost something; an enemy who suddenly acts stupid is not a resolution either.",
    ],
  },
  转折: {
    'zh-CN': [
      '承担：让此前的判断或局面失效：立场、目标、敌我或真相发生一次翻转，且翻不回去。',
      '承担：写清翻转的触发和代价，让读者看到「为什么是现在变了」，而不是被告知「变了」。',
      '不做：底牌可以藏，但必须前文埋过；不要无中生有地「原来还有一层」，也不要让反转不改变人物的处境和选择。',
      '不做：不要为反转而反转：没有前文依据的翻盘、为制造意外让角色反常，读者会出戏。',
    ],
    'en-US': [
      'Own: invalidate what came before — allegiance, goal, who the enemy is, or what is true flips, and it cannot flip back.',
      'Own: show the trigger and the price, so the reader sees why it changes now instead of being told that it changed.',
      "Don't: hide the card if you like, but it must have been planted; never invent \"there was another layer all along\", and never let a reversal leave the situation and the choices unchanged.",
      "Don't: twist for its own sake — a comeback with no setup, or out-of-character behavior for shock value, breaks the reader's trust.",
    ],
  },
  收尾: {
    'zh-CN': [
      '承担：把本章（或这一段）开的账结掉：悬着的事给出结果，人物落到一个能继续往下走的位置。',
      '承担：留下继续读的由头——新的麻烦或没答的问题，但不再铺新局。',
      '不做：不要在收尾章展开新战场、引入新角色或塞新的长篇设定；作钩子提一句更大的威胁可以，但不占本章笔墨、也不在本章处理它。',
      '不做：不要用总结陈词代替收束（「从此以后……」），也不要把所有线一次结清、堵死后面。',
    ],
    'en-US': [
      'Own: settle the account this chapter or this stretch opened — open matters get an outcome, and the characters end somewhere they can move on from.',
      'Own: leave a reason to keep reading — a new problem or an unanswered question — without laying out a new board.',
      "Don't: open a new front, introduce new characters, or load in new long-range lore in the closing chapter; naming a bigger threat as a hook is fine, but it must not take this chapter's space or be handled here.",
      `Don't: substitute summary for closure ("from that day on..."), and don't tie every thread at once so nothing can follow.`,
    ],
  },
}

/** 识别中文档名之后允许出现的分隔符（闭集，不做子串扫描）。 */
const ROLE_SEPARATORS = new Set(['', ' ', '\t', '\n', '-', '—', '–', ':', '：', ',', '，', '、', '/', '／', ';', '；', '.', '。', '(', '（', ')', '）'])

const CHINESE_ROLES = new Set<string>(CHAPTER_ROLES)

const ENGLISH_ROLE_BY_LABEL = new Map<string, ChapterRole>(
  CHAPTER_ROLES.map(role => [CHAPTER_ROLE_LABELS[role].enUS.toLowerCase(), role]),
)

const WRAPPERS: ReadonlyArray<readonly [string, string]> = [
  ['【', '】'], ['[', ']'], ['「', '」'], ['『', '』'], ['“', '”'], ['(', ')'], ['（', '）'],
]

/** 剥掉最外层**一层**成对包裹符；不成对就原样返回。 */
function stripWrapper(value: string): string {
  for (const [open, close] of WRAPPERS) {
    if (value.length > open.length + close.length && value.startsWith(open) && value.endsWith(close)) {
      return value.slice(open.length, value.length - close.length).trim()
    }
  }
  return value
}

/**
 * 存储值 → 七档之一；认不出返回 `null`（不猜、不兜底）。
 *
 * 只看**前导标签**，不看整句内容：
 * `发展——承接第5章门牌篡改的物证` 命中「发展」，说明部分仍原样留在蓝图 JSON 里，
 * 信息零丢失；system 只补这一档的行为合同。
 */
export function matchChapterRole(value: string | null | undefined): ChapterRole | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const normalized = stripWrapper(raw.normalize('NFKC').trim())
  if (!normalized) return null

  if (CHINESE_ROLES.has(normalized)) return normalized as ChapterRole

  const english = ENGLISH_ROLE_BY_LABEL.get(normalized.toLowerCase())
  if (english) return english

  // 前导标签 + 分隔符 + 说明。遍历七个档名，取**最长**命中，避免前缀互相吞。
  let best: ChapterRole | null = null
  for (const role of CHAPTER_ROLES) {
    if (!normalized.startsWith(role)) continue
    const next = normalized.slice(role.length, role.length + 1)
    if (!ROLE_SEPARATORS.has(next)) continue
    if (!best || role.length > best.length) best = role
  }
  return best
}

/**
 * 七档 → 注入正文（前导行 + 4 条成对条款）。
 *
 * 空值、认不出的自定义值 → `''`，调用方据此不留空标题、不留空行。
 * 英文项目也按英文档名输出（存储侧仍是中文值，这是既有事实）。
 */
export function resolveChapterRoleGuidance(
  value: string | null | undefined,
  language: WritingLanguage,
): string {
  const role = matchChapterRole(value)
  if (!role) return ''
  const labels = CHAPTER_ROLE_LABELS[role]
  const lead = language === 'en-US'
    ? `This chapter is positioned as "${labels.enUS}"; where that conflicts with author tasks or required events, the author's requirements win.`
    : `本章按「${labels.zhCN}」定位取舍；与作者本章任务或必需事件冲突时，以作者要求为准。`
  return [lead, ...ROLE_GUIDANCE[role][language]].join('\n')
}
