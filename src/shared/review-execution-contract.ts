import { promptLanguageText } from '../services/prompt-language'
import type { WritingLanguage } from './writing-language'

/**
 * 审稿侧的执行口径：**判定标准**，不是写作指令。
 *
 * 背景（2026-10-21 W1）：生成侧早就有 `chapterExecutionContractText()`
 * （`generate-draft.command.ts`），但审稿侧从来没有拿到它 —— 实测审稿 trace 里
 * 「执行合同」出现 0 次。审稿因此只能报「两处不一样」，报不出「这次转移违反了哪条规则、
 * 该改哪一边」，作者拿到的结论是**没有裁决权**的意见。
 *
 * ★ 为什么不直接复用生成侧文本：同一句话在两个角色里的语法不同。
 * 生成侧写「事件必须通过具体行动发生」，对模型是**义务**；
 * 审稿侧必须写成「只认已发生的具体行动，计划与承诺不算」，才是**判据**。
 * 逐字照搬会让审稿模型把写作义务读成对自己的要求，甚至按合同去"改写"而非"判定"。
 *
 * ★ 刻意不进的条款（都有更专门的落点，重复注入只会稀释注意力）：
 * - 时间承接：审稿侧已有 `【时间一致性检查】` 与 `reviewTimeContinuity()`；
 * - 远期设定边界：已有 `reviewFarTermSettingRule()`；
 * - 续写 / 压缩的操作边界：审稿没有「续写轮」这种形态，与它无关。
 *
 * ★ recheck（定向复核）分支刻意不加：那一轮只裁决既有 finding 是否 resolved，
 * 判据已在 `review-chapter.command.ts` 的 recheck 段落里写死，再加口径会互相干扰。
 *
 * ★ 与生成侧条款的对照表（生成侧 = `chapterExecutionContractText()`，共 9 条）。
 * 这张表是**防漂移契约**：`review-execution-contract.test.ts` 会读生成侧源码，
 * 断言这里的每一条生成侧条款标题都有明确处置 —— 生成侧新增条款而这里没表态，测试即红。
 *
 * | 生成侧条款标题 | 审稿侧处置 |
 * |---|---|
 * | 【作者本章任务】 | 进 → 【任务兑现】【可推进范围】 |
 * | 【本章可推进的事件】 | 进 → 【可推进范围】 |
 * | 【远期设定边界】 | 不进 → 由 `reviewFarTermSettingRule()` 专门覆盖 |
 * | 【前文已定稿事实】 | 进 → 【已定稿事实优先】 |
 * | 【前文计划与本章决定】 | 进 → 【计划不是禁令】 |
 * | 【本章事件兑现】 | 进 → 【任务兑现】 |
 * | 【前文待核实问题】 | 进 → 【疑点不是结论】 |
 * | 【时间承接】 | 不进 → 由 `【时间一致性检查】` + `reviewTimeContinuity()` 专门覆盖 |
 * | 【操作边界】 | 改写 → 【核对范围】（续写/压缩语义对审稿不存在，换成"不要求重写前文"） |
 */
export function reviewExecutionContract(language: WritingLanguage): string {
  return promptLanguageText(
    language,
    `【本章执行口径｜用于判定，不是写作指令】
以下各条是判「本章是否成立」的标准，不是对审稿人的写作要求；判定只依据待审正文与已给定材料。

【任务兑现】作者要求在本章发生的事件与收束，必须在本章正文中以具体行动及其实际后果出现。复述、确认、记账前章已发生的结果，不能替代本章要求发生的动作或结果；计划、决定、承诺、保证、签字认责、单纯否定翻转，都不等于结果已经发生。
【可推进范围】与既有事实相容的新行动和结果属于正常推进，普通无代价情节不要求新增代价。不得因本章没给事件附加代价、没更换时点或场景而判为矛盾或缺陷。
【已定稿事实优先】蓝图、章节计划、冻结目标的措辞，与已定稿章节确立的事实冲突时，以定稿事实为准；不得要求正文把已撤回、取消或被取代的计划追溯写成已执行。人物身份、物品持有、人物知情、付款与收回、事件时点都须承接前文；付款、收回、失去这类状态改变必须按事件先后成立，同一笔钱款或物品不得同时写成已收回与仍然失去。
【计划不是禁令】人物此前的等待、暂停或撤回是当时的计划状态，不是作者禁令。本章先写出人物基于既有事实作出的新决定、理由及连续性依据，再推进或替换该计划，不构成矛盾。
【疑点不是结论】前文只发现疑点、提出猜测或写明待核实时，不得把某一解释、某一原因或「哪一方出错」当作已确认事实。本章可以推进疑点，但须先有与既有事实相容、且足以支持该结论的核验过程与证据；证据不足时保留疑点。
【核对范围】只核对本章正文与已给定材料；不要求本章重写前文、补写前章缺失内容或修前章的错误，修法也不得引入来源不支持的具体时点、原因或事实。`,
    `[Execution criteria for this chapter | for judging, not writing instructions]
The clauses below are the standards for deciding whether this chapter holds, not writing requirements for the reviewer. Judge only from the draft under review and the supplied material.

[Task completion] Events and outcomes the author requires in this chapter must appear here as concrete actions with actual consequences. Recounting, confirming, or accounting for a result already completed earlier does not substitute for the action or outcome required here; a plan, decision, promise, assurance, acceptance of responsibility, or a bare negation flip is not evidence that the result occurred.
[Advancement scope] New actions and outcomes consistent with established facts are normal progress, and an ordinary event with no cost does not require an added cost. Never report a contradiction or defect merely because the chapter added no cost, or because it kept the same time or location.
[Established facts prevail] When the wording of a blueprint, chapter plan, or frozen goal conflicts with facts established in finalized chapters, the finalized facts prevail; never require the draft to retroactively portray a withdrawn, cancelled, or superseded plan as executed. Identities, item ownership, character knowledge, payments and recoveries, and event times must carry over from prior prose; paying, recovering, and losing must hold in event order, and the same money or item cannot be both recovered and still lost.
[Plans are not prohibitions] A character's earlier waiting, pausing, or withdrawal describes a prior plan, not an author prohibition. A new decision grounded in established facts, with its reason and continuity evidence, may advance or replace that plan without constituting a contradiction.
[Doubt is not conclusion] When prior prose only discovers a discrepancy, raises a suspicion, or leaves a question open, do not treat an explanation, a cause, or "which side is wrong" as confirmed fact. The chapter may pursue the question, but must first show a verification process and evidence consistent with established facts and sufficient for the conclusion; keep it unresolved when evidence is insufficient.
[Scope of checking] Check only this chapter against the supplied material; do not require this chapter to rewrite prior prose, supply what an earlier chapter omitted, or repair an earlier chapter's error, and never propose a remedy that introduces a time, cause, or fact unsupported by the sources.`,
  )
}
