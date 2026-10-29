/**
 * 处境类型库 —— 第三层「他对各类事的做法」里那个「各类」的**候选清单**。
 *
 * ## 它解决什么
 *
 * 四层里的第三层要求「什么类的事 → 他一贯怎么做」。但"什么类"一直没定义：
 * 作者写卡时凭感觉，模型归类时也凭感觉 —— 实测归类只有 11/20 的准确率，
 * 且 D1 会变成引力中心（最通用的那条吸走所有处境）。
 *
 * 本库给"各类"一份**有限、带反例**的清单，作两用：
 * 1. **作者的取材指引**：写第三层时挑几条，不必自己想"有哪些类"；
 * 2. **日后的校验白名单**：机检"定性是否落在已知类型内"（尚未实现）。
 *
 * ## 三条边界（都不是保守，是实测/明文裁定）
 *
 * 1. **不注入写作 prompt。** 作者 2026-10-29 02:53：「不要试图枚举」。
 *    把 13 类塞进 `detailTask`，模型会倾向于把 13 类全写一遍（那是枚举），
 *    或只在这 13 类里选（比"无"更糟：它会硬套）。本库只给作者看。
 * 2. **不进 DB、不写迁移。** 类型是枚举常量，不是用户数据 —— 与 `story-beats.ts`
 *    同族（那份也是常量）。进 DB 要迁移且旧项目要回填，不可逆。
 * 3. **定性行仍引用角色卡的 `D<n>`，不是本库的 id。** 换它会推翻
 *    `disposition-citation` 的整套判据（MISMATCH / 兜底都以 `D<n>` 为对象），
 *    且"处境类型"与"角色做法"是两个轴，映射关系还没理清。
 *    所以本库与定性行之间**暂无代码接缝** —— 这是有意的，见 `eventTypeCatalogMarkdown` 的用法说明。
 *
 * ## 粒度判据
 *
 * **一类 = 一个「要他付出什么」的结构，不是一个场面。** 场面无限，结构有限。
 * 每一类都配一个**反例**（不算这一类的近邻）—— 反例是粒度的护栏：
 * 写不出反例，说明这一类划得太粗；两类之间找不到反例，说明它们该合并。
 *
 * 13 类来自实验序列（20 + 24 章）归纳。第 13 类「退路与终局」是收束类，
 * 只在卷末/终局出现，与前 12 类的"日常压力"性质不同，所以单列。
 */
import type { WritingLanguage } from './writing-language'

/** 类型 id 的规范写法。**顺序即展示顺序**，大致按压力递增排。 */
export const EVENT_TYPE_IDS = [
  'promise_demand',
  'borrow_hoard',
  'forced_side',
  'carry_blame',
  'front_payment',
  'guarantee',
  'old_deed',
  'shortcut_trade',
  'rescue_exposure',
  'public_account',
  'betray_outsider',
  'hostage_anchor',
  'last_way_out',
] as const

export type EventTypeId = (typeof EVENT_TYPE_IDS)[number]

export interface CharacterEventType {
  readonly id: EventTypeId
  readonly name: string
  readonly nameEn: string
  /** 一句话定义：**要他付出什么**的结构，不是场面 */
  readonly definition: string
  readonly definitionEn: string
  /** 反例：不算这一类的近邻 —— 粒度的护栏 */
  readonly counterExample: string
  readonly counterExampleEn: string
}

export const CHARACTER_EVENT_TYPES: readonly CharacterEventType[] = Object.freeze([
  {
    id: 'promise_demand',
    name: '讨承诺',
    nameEn: 'Demanding a promise',
    definition: '要他先给一句承诺，凭据说以后补',
    definitionEn: 'He is asked to commit on the spot while the proof is deferred to later',
    counterExample: '对方当场立字据并交到他手上 ⇒ 那是成交，不是讨承诺',
    counterExampleEn: 'The other side hands him a written deed on the spot — that is a closed deal, not a promise demand',
  },
  {
    id: 'borrow_hoard',
    name: '借出他攒的东西',
    nameEn: 'Borrowing what he has saved up',
    definition: '要他交出一样攒了很久、多半回不来的东西',
    definitionEn: 'He is asked to hand over something he spent a long time accumulating and is unlikely to get back',
    counterExample: '借一样随手可再得的东西 ⇒ 够不成处境',
    counterExampleEn: 'Lending something he can replace at any time — that is not a situation at all',
  },
  {
    id: 'forced_side',
    name: '要他站队',
    nameEn: 'Forcing him to pick a side',
    definition: '两个都跟他有来往的人要他当场选一边',
    definitionEn: 'Two people he has ties with each demand he side with them right now',
    counterExample: '两边都跟他没干系 ⇒ 第二层判定「不算一件事」',
    counterExampleEn: 'Neither side has any tie to him — layer 2 rules that it does not count as an event',
  },
  {
    id: 'carry_blame',
    name: '替人担名',
    nameEn: 'Carrying someone else\'s blame',
    definition: '要他认下一件**不是**他做的事',
    definitionEn: 'He is asked to own something he did **not** do',
    counterExample: '认下他真做过的事 ⇒ 那是认账，不是担名',
    counterExampleEn: 'Owning what he actually did — that is confessing, not carrying blame',
  },
  {
    id: 'front_payment',
    name: '垫出 / 预付',
    nameEn: 'Paying up front',
    definition: '要他先拿出一样他自己也不够用的东西',
    definitionEn: 'He is asked to put up something he does not have enough of himself',
    counterExample: '拿出他有富余的 ⇒ 够不成处境',
    counterExampleEn: 'Giving what he has in surplus — that is not a situation',
  },
  {
    id: 'guarantee',
    name: '担保',
    nameEn: 'Vouching',
    definition: '要他出面担保，**后果全落在他身上**',
    definitionEn: 'He is asked to vouch, with **all** the consequences falling on him',
    counterExample: '只做个见证、传个话 ⇒ 后果不落他身上',
    counterExampleEn: 'Merely witnessing or passing word — the consequences do not land on him',
  },
  {
    id: 'old_deed',
    name: '拿旧事要挟',
    nameEn: 'Leveraging his past',
    definition: '拿他过去做过的事要他让一步',
    definitionEn: 'Something he did in the past is used to make him give ground',
    counterExample: '拿**别人**的事要他让 ⇒ 那是替人受过',
    counterExampleEn: 'Using **someone else\'s** past to make him yield — that is taking another\'s punishment',
  },
  {
    id: 'shortcut_trade',
    name: '取舍捷径',
    nameEn: 'Trading away for a shortcut',
    definition: '放弃自己攒的，换一条省事的',
    definitionEn: 'He gives up something he accumulated in exchange for an easier road',
    counterExample: '多费事但不用放弃任何东西 ⇒ 只是绕路，不是取舍',
    counterExampleEn: 'More work but nothing given up — that is a detour, not a trade',
  },
  {
    id: 'rescue_exposure',
    name: '救人（代价是暴露自己）',
    nameEn: 'Rescuing at the cost of exposure',
    definition: '救了会把他自己的遮掩全部作废',
    definitionEn: 'Saving someone would void every cover he has built for himself',
    counterExample: '救了没有代价 ⇒ 第二层判定「不算一件事」',
    counterExampleEn: 'Saving them costs him nothing — layer 2 rules that it does not count as an event',
  },
  {
    id: 'public_account',
    name: '当众要说法',
    nameEn: 'Called to account in public',
    definition: '众目睽睽要他立刻给个说法或认下',
    definitionEn: 'In front of everyone he is pressed to explain himself or own it immediately',
    counterExample: '私下问他 ⇒ 归入「讨承诺」或「拿旧事要挟」',
    counterExampleEn: 'Asking him in private — that belongs to promise demand or leveraged past',
  },
  {
    id: 'betray_outsider',
    name: '出卖他人换自己脱身',
    nameEn: 'Selling someone out to get free',
    definition: '要他交出一个**不相干的人**的信息',
    definitionEn: 'He is asked to give up information on an **uninvolved** person',
    counterExample: '交出**自己的**东西 ⇒ 归入「取舍捷径」',
    counterExampleEn: 'Giving up something of **his own** — that belongs to the shortcut trade',
  },
  {
    id: 'hostage_anchor',
    name: '押住他在乎的人',
    nameEn: 'Holding what he cares about hostage',
    definition: '拿他要护的人当筹码逼他改口 / 表态',
    definitionEn: 'The person he protects is held as the stake to force him to change his word or declare himself',
    counterExample: '筹码是他不在乎的人 ⇒ 代价不够，不触发第四层',
    counterExampleEn: 'The stake is someone he does not care about — the price is too low to reach layer 4',
  },
  {
    id: 'last_way_out',
    name: '退路与终局',
    nameEn: 'The last way out',
    definition: '要他交出最后退路，或已退无可退只剩怎么走',
    definitionEn: 'He is asked to surrender his last way out, or there is none left and only the manner of going remains',
    counterExample: '还有退路 ⇒ 归入「取舍捷径」',
    counterExampleEn: 'He still has a way out — that belongs to the shortcut trade',
  },
])

/** 是否为已知类型 id。用于白名单校验与外部输入收敛。 */
export function isEventTypeId(raw: string | null | undefined): raw is EventTypeId {
  if (!raw) return false
  return (EVENT_TYPE_IDS as readonly string[]).includes(raw)
}

export function eventTypeOf(id: string | null | undefined): CharacterEventType | null {
  if (!isEventTypeId(id)) return null
  return CHARACTER_EVENT_TYPES.find(type => type.id === id) ?? null
}

/** 类型在指定语言下的显示名。未知 id 原样返回，便于日志里看出是什么。 */
export function eventTypeLabel(id: string | null | undefined, language: WritingLanguage): string {
  const type = eventTypeOf(id)
  if (!type) return id ?? ''
  return language === 'en-US' ? type.nameEn : type.name
}

/**
 * 类型目录 markdown —— **给作者看**，不注入写作 prompt。
 *
 * 用法（当前唯一的消费方式）：
 * - 作者写角色卡第三层时，对照它挑 3–4 类写做法，不必自己发明"有哪些类"；
 * - 写情节大纲时，若某一章不知道属于哪类，可回查它 —— 但**定性行仍写 `D<n>`**，
 *   因为定性的对象是一条做法，不是类型 id。
 *
 * 将来接白名单校验（`ARC_QUALIFY_UNKNOWN_TYPE`）时，从本函数产出的清单做提示文案即可。
 */
export function eventTypeCatalogMarkdown(language: WritingLanguage): string {
  const en = language === 'en-US'
  const lines: string[] = [
    en
      ? 'Each type is a **structure of what he is asked to pay**, not a scene. The counter-example is the guard rail: if you cannot write one, the type is drawn too broadly.'
      : '每一类都是**一个「要他付出什么」的结构**，不是一个场面。反例是粒度的护栏：写不出反例，说明这一类划得太粗。',
    '',
  ]
  CHARACTER_EVENT_TYPES.forEach((type, index) => {
    lines.push(`${index + 1}. **${en ? type.nameEn : type.name}** — ${en ? type.definitionEn : type.definition}`)
    lines.push(`   - ${en ? 'Not this' : '不算这一类的'}: ${en ? type.counterExampleEn : type.counterExample}`)
  })
  return lines.join('\n').trimEnd()
}
