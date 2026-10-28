/**
 * 故事节拍库 —— **唯一事实源**。
 *
 * ## 为什么要有这个文件
 *
 * 内置的六套节拍（三幕 / 英雄之旅 / 节拍表 / 起承转合 / 多线 / 弧光）此前只装在
 * 「全书」这一层：`getPlotStructureGuide` 拿到一个枚举，就吐一段
 * 「严格按以下结构组织大纲 + 第一幕第 1–30 章」。150 章的书由此得到的是
 * **82 章共用一句职责（"对抗与发展"）** —— 中段没有任何分段依据，只能靠同构循环填。
 *
 * 作者 2026-10-28 的定性：节拍本身没错，错在**它被装在了全书这一层**。
 * 几百万字的长篇不该固定用一套，应当在合适的篇幅内换着用。
 *
 * ## 两条设计约束（都来自资料核实，不是自创）
 *
 * 1. **拍子是可以跨尺度套用的**：七点结构原文「一个点可能占一章，也可能只占一段」，
 *    起承转合原文「一套给全书，一套给每卷，一套给每章」，八序列则明确"嵌"在三幕里。
 *    ⇒ 所以「换拍」不是什么新发明，是这三套的原生用法。
 * 2. **但同一层不许叠两套**：六模型对比那句警告 —— *"choose one and only one.
 *    把救猫咪叠在英雄之旅上再叠三幕，得到的是一张表格，不是一本书。"*
 *    ⇒ 纵向套用成立，横向叠层不成立。这是防止改完变成"模板填空"的闸门。
 *
 * ## 为什么放在 `shared/`
 *
 * 它的消费方横跨三处：`architecture-workflow.ts`（全书引导）、
 * `builtin-prompt-templates.ts` / `prompt-language.ts`（卷纲正文里的可选表）、
 * `arc-position.ts`（体检时把中文名归一成 key）。任何一处自己写一份名字，
 * 都会立刻漂移成两套词表 —— 项目已有「章标题只有一份解析」的红线，同理。
 */
import type { WritingLanguage } from './writing-language'

/** 节拍键的规范写法。**顺序即展示顺序**：先冲突型，再重构型，最后两个兜底。 */
export const STORY_BEAT_KEYS = [
  'three_act',
  'save_the_cat',
  'seven_point',
  'heros_journey',
  'eight_sequence',
  'story_circle',
  'kishotenketsu',
  'escalation_321',
  'multi_thread',
  'freeform',
] as const

export type StoryBeatKey = (typeof STORY_BEAT_KEYS)[number]

export interface StoryBeat {
  key: StoryBeatKey
  /** 中文名。**大纲/卷纲里 `拍子：` 后面必须能照抄这个名字**，所以它同时是词表值。 */
  zh: string
  en: string
  /** 允许出现的其他写法（旧称、别名）。归一化时用。 */
  aliases: readonly string[]
  /** 靠什么产生意义 —— 选拍子时唯一该看的那一列。 */
  engineZh: string
  engineEn: string
  /** 原生跨度（章），按单章 2500–3000 字估。`null` = 不限。 */
  minChapters: number
  maxChapters: number | null
  /** 拍序。空数组 = 这套拍子不预设拍序（`freeform`）。 */
  slotsZh: readonly string[]
  slotsEn: readonly string[]
  /** 附加要求。只有"拍序表达不了它"的拍子才需要（目前只有 `freeform`）。 */
  guideZh?: string
  guideEn?: string
}

/**
 * 全部节拍。**跨度数字的依据**：一部电影 / 一个中篇 ≈ 2–5 万字 ≈ 8–20 章；
 * 一卷（本书实测 21 章 ≈ 5.3 万字）正好落在三幕的原生尺寸上 ——
 * 这正是"三幕该装在卷这一层"的量化理由。
 */
export const STORY_BEATS: readonly StoryBeat[] = Object.freeze([
  {
    key: 'three_act',
    zh: '三幕',
    en: 'Three-act',
    // 旧枚举里存过 `三幕结构`（中文标签）和 `三幕式`（配置页写法），两者都得认。
    aliases: ['三幕结构', '三幕式', 'Three-act structure'],
    engineZh: '冲突升级：两个拐点把一段生活劈成三段',
    engineEn: 'Escalating conflict: two turning points split a stretch of life into three',
    minChapters: 6,
    maxChapters: 30,
    slotsZh: ['建置', '拐点一（他再也退不回去）', '对抗', '拐点二（他决定动手）', '收束'],
    slotsEn: ['Setup', 'Turn 1 (he can no longer go back)', 'Confrontation', 'Turn 2 (he decides to act)', 'Payoff'],
  },
  {
    key: 'save_the_cat',
    zh: '节拍表',
    en: 'Beat sheet',
    aliases: ['救猫咪', 'Save the Cat'],
    engineZh: '节拍的位置本身就是意义（十五拍按比例钉死在时间轴上）',
    engineEn: 'The position of each beat is the meaning (fifteen beats pinned to a ratio)',
    minChapters: 8,
    maxChapters: 30,
    slotsZh: [
      '开场画面', '主题陈述', '铺垫', '催化剂', '争辩', '进入第二幕', 'B 故事', '游戏与承诺',
      '中点', '坏人逼近', '一无所有', '灵魂黑夜', '进入第三幕', '结局', '终场画面',
    ],
    slotsEn: [
      'Opening image', 'Theme stated', 'Set-up', 'Catalyst', 'Debate', 'Break into two', 'B story', 'Fun and games',
      'Midpoint', 'Bad guys close in', 'All is lost', 'Dark night of the soul', 'Break into three', 'Finale', 'Final image',
    ],
  },
  {
    key: 'seven_point',
    zh: '七点',
    en: 'Seven-point',
    aliases: ['七点结构', 'Seven-point structure'],
    engineZh: '从结局倒推：只定七个位置的职责，不定页码（**天然可跨尺度**）',
    engineEn: 'Built backwards from the ending: seven jobs, no page targets (scales freely)',
    minChapters: 3,
    maxChapters: 80,
    slotsZh: ['钩子', '第一转折', '第一捏点', '中点（从被动转主动）', '第二捏点', '第二转折', '结局'],
    slotsEn: ['Hook', 'Plot turn 1', 'Pinch 1', 'Midpoint (reacting to acting)', 'Pinch 2', 'Plot turn 2', 'Resolution'],
  },
  {
    key: 'heros_journey',
    zh: '英雄之旅',
    en: "Hero's journey",
    aliases: ['Hero’s journey', 'heros_journey'],
    engineZh: '单一主角的完整变形：出发—试炼—带着东西回来',
    engineEn: 'One protagonist transformed: departure, ordeal, return with something',
    minChapters: 20,
    maxChapters: 150,
    slotsZh: [
      '平凡世界', '冒险的召唤', '拒绝召唤', '遇见导师', '跨越第一道门槛', '试炼、盟友、敌人',
      '接近最深的洞穴', '苦难折磨', '获得报酬', '归途', '复活', '带着收获归来',
    ],
    slotsEn: [
      'Ordinary world', 'Call to adventure', 'Refusal', 'Meeting the mentor', 'Crossing the threshold', 'Tests, allies, enemies',
      'Approach the inmost cave', 'Ordeal', 'Reward', 'The road back', 'Resurrection', 'Return with the elixir',
    ],
  },
  {
    key: 'eight_sequence',
    zh: '八序列',
    en: 'Eight sequences',
    aliases: ['序列法', 'Sequence method'],
    engineZh: '每个序列自带一个戏剧问题：宏观张力由微观张力承担',
    engineEn: 'Each sequence carries its own dramatic question: macro tension rides on micro tension',
    minChapters: 12,
    maxChapters: 40,
    slotsZh: [
      '建置', '争辩与承诺', '新世界的初步尝试', '上升的复杂化',
      '中点的余波与新办法', '四面收紧', '最低点与最终计划', '高潮与收束',
    ],
    slotsEn: [
      'Set-up', 'Debate and commitment', 'First attempts in the new world', 'Rising complications',
      'Fallout of the midpoint and a new approach', 'Walls close in', 'Low point and final plan', 'Climax and resolution',
    ],
  },
  {
    key: 'story_circle',
    zh: '故事圈',
    en: 'Story circle',
    aliases: ['丹哈蒙故事圈', 'Story circle'],
    engineZh: '角色内在的改变：八步一个圈，可以在任何尺度上循环',
    engineEn: 'Inner change: eight steps per circle, loopable at any scale',
    minChapters: 2,
    maxChapters: 40,
    slotsZh: ['舒适区', '他想要什么', '进入陌生处境', '适应', '得到想要的', '付出代价', '回到起点', '他已经变了'],
    slotsEn: ['Comfort zone', 'He wants something', 'Unfamiliar situation', 'Adapt', 'Gets what he wanted', 'Pays a heavy price', 'Returns', 'He has changed'],
  },
  {
    key: 'kishotenketsu',
    zh: '起承转合',
    en: 'Kishōtenketsu',
    aliases: [],
    engineZh: '重新框定：**转**是引入一个新角度让前面全部重新有意义，不需要反派',
    engineEn: 'Recontextualisation: ten introduces a new angle that re-reads everything before it — no antagonist required',
    minChapters: 1,
    maxChapters: 10,
    slotsZh: ['起（铺出一个可以学的模式）', '承（把这个模式做厚）', '转（引入一个不属于这个模式的元素）', '合（把转接回起承）'],
    slotsEn: ['Ki (lay out a pattern)', 'Shō (deepen it)', 'Ten (introduce what does not fit)', 'Ketsu (tie ten back to ki and shō)'],
  },
  {
    key: 'escalation_321',
    zh: '三二一递进',
    en: 'Three-two-one',
    aliases: ['3+2+1', '三加二加一'],
    engineZh: '情绪递进：小爽三次、中爽两次、大爽一次，每一档抬一次冲突等级',
    engineEn: 'Emotional escalation: three small, two medium, one big payoff, each tier raising the stakes',
    minChapters: 3,
    maxChapters: 8,
    slotsZh: ['小（三拍，压一个够得着的对手）', '中（两拍，冲突抬一级）', '大（一拍，引爆并回落）'],
    slotsEn: ['Small (three beats, beatable opponent)', 'Medium (two beats, stakes raised)', 'Big (one beat, detonate and settle)'],
  },
  {
    key: 'multi_thread',
    zh: '多线',
    en: 'Multi-thread',
    aliases: ['多线叙事', 'Multi-thread narrative'],
    engineZh: '线间交汇：几条线各自推进，在固定的交汇点互相改写',
    engineEn: 'Interlocking lines: several threads advance and rewrite each other at fixed crossings',
    minChapters: 20,
    maxChapters: null,
    slotsZh: ['主线建置', '各线独立推进', '第一次交汇', '分线升级', '第二次交汇', '合流', '统一高潮'],
    slotsEn: ['Main line established', 'Lines advance separately', 'First crossing', 'Lines escalate', 'Second crossing', 'Convergence', 'Unified climax'],
    guideZh: '线数 2–4 条，每条要有独立主角或视角；别让某条线长期消失（读者会忘了它为什么重要）。',
    guideEn: 'Two to four lines, each with its own lead or viewpoint; never let a line vanish for long, or readers forget why it mattered.',
  },
  {
    key: 'freeform',
    zh: '自由',
    en: 'Freeform',
    aliases: ['弧光结构', '自由弧', 'Arc structure'],
    engineZh: '不预设拍序。**只在确实有理由时用**，且必须写明为什么上面九套都不合适',
    engineEn: 'No preset beats. Use only with a stated reason why none of the nine fits',
    minChapters: 1,
    maxChapters: null,
    slotsZh: [],
    slotsEn: [],
    guideZh: '不预设拍序时，这几条是下限：每 10–20 章必须有一个小高潮或悬念释放点；开篇（前 10–15%）与收尾（后 10–15%）必须清晰；中段不许连续三段同一类型（全打 / 全谈 / 全查）。',
    guideEn: 'With no preset beats these are the floor: a minor climax or payoff every 10–20 chapters; a clear opening (first 10–15%) and closing (last 10–15%); no three consecutive segments of the same type.',
  },
])

const BEAT_BY_KEY = new Map<string, StoryBeat>(STORY_BEATS.map(beat => [beat.key, beat]))

/** 名字（中/英/别名）→ 规范 key。认不出返回 `null`，**不做猜测**。 */
export function normalizeStoryBeatKey(raw: string | null | undefined): StoryBeatKey | null {
  const value = (raw || '').trim()
  if (!value) return null
  if (BEAT_BY_KEY.has(value)) return value as StoryBeatKey
  const lowered = value.toLowerCase()
  for (const beat of STORY_BEATS) {
    if (beat.zh === value || beat.en.toLowerCase() === lowered) return beat.key
    if (beat.aliases.some(alias => alias === value || alias.toLowerCase() === lowered)) return beat.key
  }
  return null
}

export function storyBeatOf(key: string | null | undefined): StoryBeat | null {
  const normalized = normalizeStoryBeatKey(key)
  return normalized ? (BEAT_BY_KEY.get(normalized) ?? null) : null
}

export function storyBeatLabel(key: string | null | undefined, language: WritingLanguage): string {
  const beat = storyBeatOf(key)
  if (!beat) return (key || '').trim()
  return language === 'en-US' ? beat.en : beat.zh
}

/** 这套拍子在 `chapters` 章这个跨度上是否合规。`null` 上限 = 不限，永远合规。 */
export function storyBeatFitsSpan(beat: StoryBeat, chapters: number): boolean {
  if (!Number.isFinite(chapters) || chapters <= 0) return true
  if (chapters < beat.minChapters) return false
  return beat.maxChapters === null || chapters <= beat.maxChapters
}

/** 跨度覆盖 `chapters` 章的全部节拍，按库内顺序。 */
export function storyBeatsFittingSpan(chapters: number): readonly StoryBeat[] {
  return STORY_BEATS.filter(beat => storyBeatFitsSpan(beat, chapters))
}

/** 跨度的可读写法，如 `6–30 章` / `20 章以上，不设上限`。体检的提示语要用它。 */
export function storyBeatSpanText(beat: StoryBeat, language: WritingLanguage): string {
  const min = beat.minChapters
  const max = beat.maxChapters
  if (language === 'en-US') {
    if (max === null) return `from ${min} chapters, no upper limit`
    return `${min}–${max} chapters`
  }
  if (max === null) return `${min} 章以上，不设上限`
  return `${min}–${max} 章`
}

/** 配置字段提示里用的枚举说明，如 `three_act=三幕 / save_the_cat=节拍表 / …`。 */
export function storyBeatEnumDoc(language: WritingLanguage): string {
  return STORY_BEATS
    .map(beat => `${beat.key}=${language === 'en-US' ? beat.en : beat.zh}`)
    .join(' / ')
}

/**
 * 卷纲 / 全书引导共用的**可选拍子表**（Markdown 表格，直接嵌进 prompt）。
 *
 * 刻意给的是"引擎 + 跨度 + 拍序"三列，而不是拍子的详细定义 —— 名字和拍序足够模型
 * 复现这套结构，写详细定义反而会诱导它逐拍填表（那正是"模板填空"）。
 */
export function storyBeatCatalogMarkdown(language: WritingLanguage): string {
  const header = language === 'en-US'
    ? ['| Name (copy exactly) | What creates the meaning | Native span (at 2500–3000 words/chapter) | Beat order |',
      '|---|---|---|---|']
    : ['| 名字（只能照抄这一列） | 靠什么产生意义 | 原生跨度（按单章 2500–3000 字估） | 拍序 |',
      '|---|---|---|---|']
  const rows = STORY_BEATS.map(beat => {
    const engine = language === 'en-US' ? beat.engineEn : beat.engineZh
    const slots = language === 'en-US' ? beat.slotsEn : beat.slotsZh
    const order = slots.length > 0 ? slots.join(' → ') : (language === 'en-US' ? '(none — you define it)' : '（不预设，你自己定）')
    return `| ${language === 'en-US' ? beat.en : beat.zh} | ${engine} | ${storyBeatSpanText(beat, language)} | ${order} |`
  })
  return [...header, ...rows].join('\n')
}

/**
 * 拍子的选用规则（五条，全部可机检）。
 *
 * 前四条治"越写越像一个模子"：书越长单元越多，撞拍的概率自然升高，
 * 而读者记不住剧情、只记得节奏起伏 —— 这就是番茄中后期弃书的主因。
 * 第五条治"拿短拍子硬撑长篇"。
 */
export function storyBeatRulesMarkdown(language: WritingLanguage): string {
  if (language === 'en-US') {
    return [
      '1. **One beat per layer.** The whole book gets one, each volume gets one, each unit gets one. A card that declares two is void.',
      '2. **Adjacent units must not share a beat.**',
      '3. **Within one volume, no beat may be used twice.**',
      '4. **Adjacent volumes must not share a beat.**',
      '5. **The beat must fit the span.** Work out how many chapters the segment covers and pick a beat whose native span covers it. If nothing fits, split the segment or move one layer up.',
    ].join('\n')
  }
  return [
    '1. **每一层只准一套**：全书一套、每一卷一套、每个单元一套。同一张卡上声明两套的，作废 —— 把两套叠在一起得到的是一张表格，不是故事。',
    '2. **相邻两个单元不许同拍。**',
    '3. **同一卷内，同一套拍子不许用两次。**',
    '4. **相邻两卷不许同拍。**',
    '5. **拍子必须匹配篇幅**：先算出这一段折算多少章，再选跨度覆盖它的那几套。一套都不覆盖的，要么把这一段切短，要么往上一层挪。',
  ].join('\n')
}

/** 全书引导里判断"该不该按拍序切章"的那一句话。 */
export function storyBeatSpanVerdict(
  beat: StoryBeat,
  totalChapters: number,
  language: WritingLanguage,
): { fits: boolean; text: string } {
  const fits = storyBeatFitsSpan(beat, totalChapters)
  if (language === 'en-US') {
    const span = storyBeatSpanText(beat, language)
    return {
      fits,
      text: fits
        ? `This book is ${totalChapters} chapters; ${beat.en} natively covers ${span}, so it fits. Follow the beat order above, but **do not cut by percentage** — a beat ends where it ends.`
        : `This book is ${totalChapters} chapters; ${beat.en} natively covers only ${span}. It is far too coarse for the whole book, so the whole-book layer fixes **only the two ends**: the starting state and the ending state. How the middle is segmented, and which beat each segment uses, belongs to the volume / unit layer. Do not slice the book by percentage here.`,
    }
  }
  const span = storyBeatSpanText(beat, language)
  return {
    fits,
    text: fits
      ? `本书 ${totalChapters} 章，这套拍子的原生跨度是 ${span} —— 装得下。按上面的拍序推进，但**不要按百分比切章**：一拍写到它该结束的地方为止。`
      : `本书 ${totalChapters} 章，这套拍子的原生跨度只有 ${span} —— **装不下**。所以全书这一层只定**两端**：起点状态、终点状态。中间怎么分段、每段用哪套拍子，交给卷 / 单元层各自决定。**不要在这里按百分比切章。**`,
  }
}
