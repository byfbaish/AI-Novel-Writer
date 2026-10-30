/**
 * 章末「角色卡增量」的输出合同 —— **唯一权威**。
 *
 * ## 为什么单独一个文件
 *
 * 这段合同要同时被两处引用：定稿槽位链（`finalization-generation-source.ts`）与
 * 兼容链（`finalize-chapter.command.ts`）。项目历史上这两份合同已经漂过一次
 * （一份加了新字段、另一份没跟上，而生产走的是后者）。复制粘贴维护必然再漂，
 * 所以这里只留一份常量，两边都 import。
 *
 * ## 为什么不能塞进 `updates`
 *
 * `summary-repository.ts` 落库前会用 `parseFinalizedCharacterStateResponse` 重新解析一次，
 * 而那个函数只从 `{ updates }` 里取内容 —— 顶层其它键在那一步被彻底切断。
 * 所以 `cardDeltas` 必须与 `updates` **并列**，并走独立的解析入口。
 *
 * ## 为什么禁区不在这份合同里
 *
 * 禁区只增不删、不覆盖（设计稿 §20.2），而且只在作者的弧光节点（不归点）上追加。
 * 模型若能借章末回写改禁区，底色一致性当场就没了 —— 闭环反而破坏它要保的东西。
 * 这一步只允许「登记软肋 / 增删筹码 / 记一笔顶撞」。
 */

import type { WritingLanguage } from './writing-language'

const ZH = `【本章的角色卡增量（与上面的 updates 并列，不要嵌套进 updates）】
除了六槽状态，本章还可能改变角色卡的三格。只在本章正文明确写出时才提；没有就返回空数组。

只允许三种 kind：

① "soft-spot" 软肋登记 —— 他因为某个人或某样东西破了禁区、或让了一步，而且这样东西**以后还能被拿捏**。
   - name 写它叫什么；text 用一句话说清它为什么能拿住他。
   - ★ 单位是「别人能按哪里」，不是「这一次让步」。同一个接口已经登记过的不要重复登记。
   - ★ 最多 5 条。

② "chip" 筹码变更 —— change 取 "add"（他得到了什么，今后能被拿走）/ "replace"（某样东西换成了另一样，此时 replaces 写旧的、name 写新的）/ "lose"（他失去了某样东西）。
   - name 写那样东西叫什么；text 一句话说清它为什么能拿住他。
   - ★ 只写**能被拿走**的东西：力气、速度、性格、身体部位不算。

③ "hit" 顶撞记录 —— 本章顶到或破了他的某条禁区。forbidden 写编号（X1…X3），cost 写代价（不超过 60 字），broken 写有没有真的破。
   - ★ 这只是记账，不改卡面。没有就不写。

【输出形状】cardDeltas 与 updates 并列，作为顶层第二个键：
{"updates":[…照上面写…],"cardDeltas":[{"characterId":"冻结名单中的精确ID","kind":"soft-spot","name":"…","text":"…","evidence":{"text":"原文精确引用"}},{"characterId":"…","kind":"chip","change":"add","name":"…","text":"…","evidence":{"text":"…"}},{"characterId":"…","kind":"hit","forbidden":"X1","cost":"…","broken":true,"evidence":{"text":"…"}}]}

每条都必须含 evidence，规则与上文完全相同（单一连续、逐字、在未改写正文中只出现一次）。没有增量就返回 {"cardDeltas":[]}。
★ 不得借这一步改动角色卡的【禁区】：禁区只在作者的弧光节点上追加，不在这里写。`

const EN = `[Character-card deltas for this chapter — parallel to "updates", never nested inside it]
Besides the six state fields, the chapter may also change the character card's three slots. Only report what the prose explicitly shows; return an empty array otherwise.

Only three kinds are allowed:

1. "soft-spot" — he broke a forbidden line or gave ground because of a specific person or thing, and that thing **can be pressed again later**.
   - name is what it is called; text is one clause on why it can hold him.
   - ★ The unit is "where someone else can press", not "this one concession". Do not register an interface that is already registered.
   - ★ At most 5.

2. "chip" — change is "add" (he gained something that can later be taken away) / "replace" (one thing replaced another: replaces names the old one, name the new one) / "lose" (he lost something).
   - name is what it is called; text is one clause on why it can hold him.
   - ★ Only things that **can be taken away**: strength, speed, temperament and body parts do not count.

3. "hit" — the chapter pressed against or broke one of his forbidden lines. forbidden carries the number (X1…X3), cost the price (at most 60 characters), broken whether it was actually crossed.
   - ★ This is bookkeeping only; it does not change the card. Omit it when there is none.

[Output shape] cardDeltas sits parallel to updates, as the second top-level key:
{"updates":[… as above …],"cardDeltas":[{"characterId":"exact ID from the frozen list","kind":"soft-spot","name":"…","text":"…","evidence":{"text":"exact source quote"}},{"characterId":"…","kind":"chip","change":"add","name":"…","text":"…","evidence":{"text":"…"}},{"characterId":"…","kind":"hit","forbidden":"X1","cost":"…","broken":true,"evidence":{"text":"…"}}]}

Every entry must carry evidence, under exactly the same rules as above (one contiguous, verbatim span that occurs exactly once in the unmodified chapter). Return {"cardDeltas":[]} when there is nothing.`

/** 取当前语言的合同文本。 */
export function finalizedCharacterCardDeltaContract(language: WritingLanguage): string {
  return language === 'en-US' ? EN : ZH
}

/** 单条 hit 的代价上限 —— 账本条目，不是场景描写。 */
export const CARD_DELTA_COST_LIMIT = 60
/** 软肋上限（收敛规则：同一接口反复被按仍是同一条）。 */
export const CARD_DELTA_SOFT_SPOT_LIMIT = 5
