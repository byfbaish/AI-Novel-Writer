/**
 * 金色词条库 —— 主角性格的**作者侧资产**。
 *
 * ## 为什么要有这个库
 *
 * 性格不能由模型生成（作者 2026-10-28 裁定）：一个没有突破因子的胆小鬼在那个世界活不过三章，
 * 而模型随机出来的性格有大概率是"活不下去"的那种。
 * 所以底色、锚点由作者覆盖，模型只负责"在四层之内演绎"。
 *
 * ## 词条不是一个形容词，是一个矛盾结构
 *
 * 查证（详见 `docs/design/prompt/protagonist-golden-traits.md`）：所有被记住的主角都是
 * **一个底色 + 一次背叛底色** ——
 * 李长寿「稳到最后稳不住，牺牲自己」/ 石昊「打穿一切，但身后有人要活」/
 * 叶凡「先算代价，但兄弟的承诺」/ 萧炎「不服输，但为约定可以低头」。
 *
 * ## 四层（编号只是条目号，不是档位）
 *
 * 2026-10-29 夜起，角色卡由「三档压力」改为**四层**
 * （详见 `docs/design/prompt/character-behavior-four-layers.md`）：
 *
 * - 第一层【他在乎什么】：底线排序 3–5 项，相邻两项之间要能构造一个必须选一个的场面
 * - 第二层【什么算一件事】：什么算、什么不算（不算的必须离所有底线项都远）
 * - 第三层【他对各类事的做法】：3–4 条「什么类的事 → 一贯怎么做」+ 每条的**不适用**
 * - 第四层【例外】：只有一种情况会出例外 —— 第 1 条底线跟别的底线打架时，他选第 1 条
 *
 * ### 为什么不再按处境分档（24 章对照实测）
 *
 * 旧三档〔日常〕/〔代价〕/〔破例〕按**处境**切分，两个结构性后果：
 *
 * 1. **必然大面积「无」**：20 章里 10 章不沾任何一条（站队、担名、担保、当众质疑…）。
 *    处境几乎无限，按处境分永远追不上。
 * 2. **D1 成了引力中心**：「问凭据」最通用，把站队、担名、垫东西三个不相干处境全吸走
 *    ——编号标错、动作照抄。
 *
 * 改成按**做法**分条目后（第三层），「无」从 7 章降到 0 章，第 13 章那种"行为对、
 * 却说不清属于哪条"的漏判也消失了。
 *
 * ⚠️ **编号仍然只是条目号**：`D<n>` 指第三层里的第几条做法，不是轻重次序。
 * 旧病根（把编号当档位，模型写第四条时只能编出"D4 代价档"）不能复发。
 *
 * ## 谁消费
 *
 * - 作者：在角色图谱选一条（或改字），作为主角的覆盖。
 * - 模型：**不选词条**，只按四层的格式写 personality；写不出来才参考本库的措辞。
 * - 章节大纲：`定性：` 行先定类（`D<n>` 或「无」），`选择：` 行再写 `因为 D<n>`；
 *   两处编号必须一致，否则报 `ARC_CHOICE_MISMATCH`。
 */

import type { WritingLanguage } from './writing-language'

export type GoldenTraitId = 'steady' | 'force' | 'calculating' | 'villain'

/**
 * 底线价值的取值 —— Schwartz 十项（2012 理论，44 国 25000 人；刺激/享乐是正式项）。
 * 用于给每条词条标注"这类主角的底线通常怎么排"，对应性格四层的**第一层**。
 */
export type GoldenTraitValue =
  | '自主'
  | '刺激'
  | '享乐'
  | '成就'
  | '权力'
  | '安全'
  | '顺从'
  | '传统'
  | '仁善'
  | '普世'

const GOLDEN_TRAIT_VALUE_EN: Record<GoldenTraitValue, string> = {
  自主: 'Self-direction',
  刺激: 'Stimulation',
  享乐: 'Hedonism',
  成就: 'Achievement',
  权力: 'Power',
  安全: 'Security',
  顺从: 'Conformity',
  传统: 'Tradition',
  仁善: 'Benevolence',
  普世: 'Universalism',
} as const

export interface GoldenTrait {
  readonly id: GoldenTraitId
  readonly name: string
  readonly nameEn: string
  /** 日常素材 → 落进第三层：没被逼时他怎么做 */
  readonly daily: string
  readonly dailyEn: string
  /** 代价素材 → 落进第三层：照习惯做会亏时还做不做 */
  readonly costed: string
  readonly costedEn: string
  /** 例外素材 → 落进第四层：第 1 条底线被押上赌桌时的第一反应（必须与日常反方向） */
  readonly exception: string
  readonly exceptionEn: string
  /** 锚点提示：这类角色的锚点通常是什么（必须是"他交出去的"，不是"他守住的"）—— 落进第一层 */
  readonly anchorHint: string
  readonly anchorHintEn: string
  /** 出现例外时的代价：每次赔掉什么 */
  readonly price: string
  readonly priceEn: string
  /** 弧光方向：例外的门槛往哪移（底线不变） */
  readonly arcHint: string
  readonly arcHintEn: string
  /** 适用说明，给作者看 */
  readonly fit: string
  readonly fitEn: string
  /**
   * 这个词条的主角，底线通常怎么排（Schwartz 十项里的名字，从重到轻，3–5 项）。
   * 硬约束：**仁善、普世不许出现在前两位**（排上去就是圣母，不是人）。
   */
  readonly values: readonly GoldenTraitValue[]
}

export const GOLDEN_TRAITS: readonly GoldenTrait[] = Object.freeze([
  {
    id: 'steady',
    name: '稳健型',
    nameEn: 'The Steady One',
    daily: '未虑胜先虑败；能不交手就不交手；每次出手前先备三条退路',
    dailyEn: 'Works out the losing case before the winning one; avoids a fight whenever avoiding is possible; always has three exits prepared',
    costed: '照习惯躲，会眼看着一件本来能管的事烂掉 —— 他还是先保退路，只在退路里顺手护一下',
    costedEn: 'Staying out of it means watching something he could have fixed rot — he still secures his exits first, and only shields people on the way out',
    exception: '有人**因为他没出手**死了（不是因为他出手），而那个人本来在他的名单上',
    exceptionEn: 'Someone dies **because he did not act** — not because he did — and that person was on his list',
    anchorHint: '他算进"我要保"那份名单里的人（一开始名单上可能只有一个人）',
    anchorHintEn: 'The people he has written onto his "I am keeping these alive" list — at the start it may hold only one name',
    price: '每破一次例，名单上多一个人，退路少一条',
    priceEn: 'Every exception adds a name to the list and removes one exit',
    arcHint: '从"只保自己" → "保到保不住为止"（底色不变：他依然先备退路，只是愿意走得更远）',
    arcHintEn: 'From "keep myself alive" to "keep them alive until I cannot" — the base tendency does not change; he still prepares exits, he just walks further',
    fit: '长篇连载最稳的一条：读者粘性来自"他一出现就安心"',
    fitEn: 'The most reliable choice for a long serial: readers stay because "when he shows up, things are under control"',
    values: ['安全', '自主', '仁善', '传统'],
  },
  {
    id: 'force',
    name: '以力证道型',
    nameEn: 'The One Who Breaks Through',
    daily: '不绕路；谁挡就打穿谁；几乎不谈判',
    dailyEn: 'Never takes the long way around; whoever blocks him gets broken; almost never negotiates',
    costed: '硬打会赔掉三个月的时间，而这三个月他等不起 —— 他还是打，只是打得比平时更急',
    costedEn: 'Going through costs him three months he cannot spare — he still goes through, only faster and uglier',
    exception: '有人愿意替他挡（他还不起这份账）',
    exceptionEn: 'Someone steps in front of a blow meant for him, and he can never repay it',
    anchorHint: '他答应过的事 —— 哪怕对方已经死了',
    anchorHintEn: 'A promise he made — even if the person is already dead',
    price: '每破一次例，欠下一条新债',
    priceEn: 'Every exception leaves one more debt',
    arcHint: '从"为自己争" → "为身后的人争"（底色不变：他依然只会正面打）',
    arcHintEn: 'From fighting for himself to fighting for whoever stands behind him — he still only knows how to hit things head-on',
    fit: '爽感最直接，但"无脑"风险最高：代价那条必须写出他真的会算错',
    fitEn: 'The most direct payoff, and the highest risk of reading as mindless: the costed entry must show him genuinely misjudging',
    values: ['成就', '权力', '仁善', '自主'],
  },
  {
    id: 'calculating',
    name: '算计型',
    nameEn: 'The One Who Counts',
    daily: '先算代价再动手；能借力绝不自己上；永远留一手',
    dailyEn: 'Prices the cost before moving; borrows someone else strength rather than spend his own; always keeps one card back',
    costed: '照习惯借力，会把一个不该卷进来的人卷进来 —— 他还是借，只是在账上多记一笔',
    costedEn: 'Borrowing force drags in someone who should never have been involved — he still borrows, and writes it into the ledger',
    exception: '算出来的最优解要求他**放弃某一个人**',
    exceptionEn: 'The optimal line, worked out cleanly, requires abandoning one specific person',
    anchorHint: '他记的那本恩账（仇账可以慢慢清，恩账必须当场还）',
    anchorHintEn: 'His ledger of favours owed — vengeance can wait, a favour cannot',
    price: '破例的那一次，账算错了，而且要自己认',
    priceEn: 'On the one exception, the arithmetic is wrong, and he has to own it',
    arcHint: '从"只算自己的账" → "替别人算账"（底色不变：他依然什么都先算）',
    arcHintEn: 'From keeping only his own books to keeping someone else\u2019s — he still counts everything first',
    fit: '最适合"规则流/权谋流"；风险是算得太多、读者觉得冷',
    fitEn: 'Best for rules-and-schemes stories; the risk is that too much calculation reads cold',
    values: ['成就', '自主', '权力', '安全'],
  },
  {
    id: 'villain',
    name: '反派型（魅力反派）',
    nameEn: 'The Villain',
    daily: '把所有人当变量；享受过程；从不守别人定的规则',
    dailyEn: 'Treats everyone as a variable; enjoys the process; never plays by rules he did not write',
    costed: '守自己的规矩会放过一个更好的局面 —— 他还是放过，因为那局面不好玩',
    costedEn: 'Playing by his own rule costs him a better position — he takes the loss, because that position would be boring',
    exception: '遇到一个他**算不准**的人（不是更强，是算不准）',
    exceptionEn: 'He meets someone he cannot model — not someone stronger, someone unpredictable',
    anchorHint: '他的"趣味"：他要看到那个结局',
    anchorHintEn: 'His amusement: he wants to see how it ends',
    price: '算不准的人会让他失手一次',
    priceEn: 'The unreadable one makes him miss once',
    arcHint: '不要求正向；只要"能理解"（判据：换我在他的位置、拿着他的信息，我也可能会这么选）',
    arcHintEn: 'No positive arc required — only intelligibility: "in his position, with his information, I might have chosen the same"',
    fit: '作者的偏好类型（《诡秘之主》阿蒙那一类）；写反派的弧光允许反向',
    fitEn: 'The author\u2019s preferred villain type (an Amon-like figure); a villain arc may run backwards',
    values: ['权力', '刺激', '自主', '成就'],
  },
])

export const GOLDEN_TRAIT_IDS: readonly GoldenTraitId[] = Object.freeze(
  GOLDEN_TRAITS.map(trait => trait.id),
)

export function isGoldenTraitId(value: unknown): value is GoldenTraitId {
  return typeof value === 'string' && (GOLDEN_TRAIT_IDS as readonly string[]).includes(value)
}

export function goldenTraitOf(id: GoldenTraitId): GoldenTrait {
  const found = GOLDEN_TRAITS.find(trait => trait.id === id)
  if (!found) throw new Error(`未知词条：${id}`)
  return found
}

/**
 * 词条目录 markdown —— 给作者挑选用；**不注入写作 prompt**。
 *
 * 模型不选词条（作者选），所以这一份文本不进 `detailTask`。
 * 留作设置面板/导出用，避免作者那边再维护一份。
 */
export function goldenTraitCatalogMarkdown(language: WritingLanguage): string {
  const en = language === 'en-US'
  const lines: string[] = [
    en
      ? 'Each trait below is raw material: daily and costed feed layer 3 (practices), anchor feeds layer 1 (bottom lines), exception feeds layer 4. It is not a three-tier card.'
      : '下面每条词条都是素材：日常与代价落进第三层（做法），锚点落进第一层（底线），例外落进第四层。它本身不是三档卡。',
    '',
  ]
  for (const trait of GOLDEN_TRAITS) {
    lines.push(`### ${en ? trait.nameEn : trait.name}`)
    lines.push(`- ${en ? 'Daily → layer 3' : '日常 → 第三层'}：${en ? trait.dailyEn : trait.daily}`)
    lines.push(`- ${en ? 'Costed → layer 3' : '代价 → 第三层'}：${en ? trait.costedEn : trait.costed}`)
    lines.push(`- ${en ? 'Exception → layer 4' : '例外 → 第四层'}：${en ? trait.exceptionEn : trait.exception}`)
    lines.push(`- ${en ? 'Anchor → layer 1' : '锚点 → 第一层'}：${en ? trait.anchorHintEn : trait.anchorHint}`)
    lines.push(`- ${en ? 'Price' : '代价'}：${en ? trait.priceEn : trait.price}`)
    lines.push(`- ${en ? 'Arc' : '弧光'}：${en ? trait.arcHintEn : trait.arcHint}`)
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

/**
 * 底线排序 markdown —— 给 UI/导出用；**不注入写作 prompt**（模型不选词条，作者选）。
 *
 * 输出的是「词条 → 底线从重到轻」，对应性格四层的第一层。
 * V6 硬约束在此处只做展示，真正的拦截在作者侧：**仁善 / 普世不得排在前两位**。
 */
export function goldenTraitValuesMarkdown(language: WritingLanguage): string {
  const en = language === 'en-US'
  const lines: string[] = []
  for (const trait of GOLDEN_TRAITS) {
    const name = en ? trait.nameEn : trait.name
    const rendered = trait.values.map(value => (en ? GOLDEN_TRAIT_VALUE_EN[value] : value)).join(' · ')
    lines.push(`- ${name}：${rendered}`)
  }
  return lines.join('\n').trimEnd()
}
