/**
 * 金色词条库 —— 主角性格的**作者侧资产**。
 *
 * ## 为什么要有这个库
 *
 * 性格不能由模型生成（作者 2026-10-28 裁定）：一个没有突破因子的胆小鬼在那个世界活不过三章，
 * 而模型随机出来的性格有大概率是"活不下去"的那种。
 * 所以底色、锚点由作者覆盖，模型只负责"在四格之内演绎"。
 *
 * ## 词条不是一个形容词，是一个矛盾结构
 *
 * 查证（详见 `docs/design/prompt/protagonist-golden-traits.md`）：所有被记住的主角都是
 * **一个底色 + 一次背叛底色** ——
 * 李长寿「稳到最后稳不住，牺牲自己」/ 石昊「打穿一切，但身后有人要活」/
 * 叶凡「先算代价，但兄弟的承诺」/ 萧炎「不服输，但为约定可以低头」。
 *
 * ## 三档压力（编号是条目号，档位用方括号标签）
 *
 * - `〔日常〕`：没被逼时他是谁 —— 决定"这个人平时什么样"
 * - `〔代价〕`：照习惯做会亏时还做不做 —— 决定"他的边界在哪"
 * - `〔破例〕`：**锚点被押上赌桌** —— 决定"他真正在乎什么"，只有这一档要求尖锐，且**恰好一条**
 *
 * 尖锐度只属于〔破例〕。若要求每条都"刀架在脖子上"，角色会一天到晚被逼到极限，
 * 那不是人是连续剧；反之每条都不痛，就退回"聪明人的操作手册"。
 *
 * ⚠️ 2026-10-29 实测教训：把 `D1/D2/D3` 当成**固定档位编号**会出两个错 ——
 * ① 模型写第四条时只能编出"D4 代价档"，档位与编号打架；
 * ② "破例"被写成"日常 + 更用力"（被逼认账时顶回去，对一个本来就顶回去的人不叫破例）。
 * ⇒ 编号只做**引用寻址**，档位必须是独立标签，并强制"〔破例〕与〔日常〕反方向"。
 *
 * ## 谁消费
 *
 * - 作者：在角色图谱选一条（或改字），作为主角的覆盖。
 * - 模型：**不选词条**，只按 `D<n>〔日常／代价／破例〕` 的格式写三行式；写不出来才参考本库的措辞。
 * - 章节大纲：`选择：` 行必须写 `因为 D<n>`，让性格从"描述"变成"可寻址"。
 */

import type { WritingLanguage } from './writing-language'

export type GoldenTraitId = 'steady' | 'force' | 'calculating' | 'villain'

export interface GoldenTrait {
  readonly id: GoldenTraitId
  readonly name: string
  readonly nameEn: string
  /** 〔日常〕：没被逼时怎么做 */
  readonly daily: string
  readonly dailyEn: string
  /** 〔代价〕：照习惯做会亏时还做不做 */
  readonly costed: string
  readonly costedEn: string
  /** 〔破例〕：锚点被押上赌桌时的第一反应（必须尖锐，且必须与〔日常〕反方向） */
  readonly exception: string
  readonly exceptionEn: string
  /** 锚点提示：这类角色的锚点通常是什么（必须是"他交出去的"，不是"他守住的"） */
  readonly anchorHint: string
  readonly anchorHintEn: string
  /** 破例的代价：每破一次赔掉什么 */
  readonly price: string
  readonly priceEn: string
  /** 弧光方向：破例门槛往哪移（底色不变） */
  readonly arcHint: string
  readonly arcHintEn: string
  /** 适用说明，给作者看 */
  readonly fit: string
  readonly fitEn: string
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
    fit: '爽感最直接，但"无脑"风险最高：〔代价〕那条必须写出他真的会算错',
    fitEn: 'The most direct payoff, and the highest risk of reading as mindless: the [Costed] entry must show him genuinely misjudging',
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
  const lines: string[] = []
  for (const trait of GOLDEN_TRAITS) {
    lines.push(`### ${en ? trait.nameEn : trait.name}`)
    lines.push(`- ${en ? '[Daily]' : '〔日常〕'}：${en ? trait.dailyEn : trait.daily}`)
    lines.push(`- ${en ? '[Costed]' : '〔代价〕'}：${en ? trait.costedEn : trait.costed}`)
    lines.push(`- ${en ? '[Exception]' : '〔破例〕'}：${en ? trait.exceptionEn : trait.exception}`)
    lines.push(`- ${en ? 'Anchor' : '锚点'}：${en ? trait.anchorHintEn : trait.anchorHint}`)
    lines.push(`- ${en ? 'Price' : '代价'}：${en ? trait.priceEn : trait.price}`)
    lines.push(`- ${en ? 'Arc' : '弧光'}：${en ? trait.arcHintEn : trait.arcHint}`)
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}
