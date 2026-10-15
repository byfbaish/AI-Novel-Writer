import { writingLanguageText, type WritingLanguage } from './writing-language'

/**
 * 审稿链的「远期设定使用规则」声明（C1 · 路子 B，2026-10-16）。
 *
 * 设计依据：`docs/design/c1-review-architecture-declaration-design.md`。
 * 立项来源：`docs/design/p1-3-variable-export-scoping-design.md` §7 候选落点 C1。
 *
 * ## 与 P1-2a 的关系（同一问题的两条路子）
 *
 * `architecture-projection.ts`（P1-2a）在**正文链**把远期节（`world_building` 模板的固定
 * 标题「隐喻与深层危机」，见其 `FAR_TERM_SECTION_PATTERNS`）整节边界化——正文是**给人读的
 * 成品**，写第 2 章时不该看见终局。审稿链**相反**：它的职责本就包含「判断正文是否过早泄露
 * 远期真相」，剥掉远期节会让这项判断**失去依据**。
 *
 * ⇒ 审稿**保留完整世界观**，只加一条**合同级使用规则**限定它不得被当成本章必须兑现的事实。
 *
 * ## 实测依据（2026-10-16 复核作者项目 trace）
 *
 * - 审稿 `built` 10,885 字，其中 `【世界观设定】` 块 **7,772 字**，`built` 含「隐喻与深层危机」
 *   与「代述」⇒ 远期设定**确实进了审稿请求**。
 * - 但同时：该次审稿报告**质量健康**（5 条 warning 全是真实可核验矛盾，且其中营业时段一条
 *   正是用 `### 4.【空间结构】` 正确抓到「下午两点买早饭」）——**没有**出现「拿终局当事实
 *   要求兑现」的案例。
 * ⇒ 本条属**预防性加固**（成本 ≈ 0、零行为副作用），不是对已发生误判的修补。如实标注。
 *
 * ## 为什么必须是合同级措辞
 *
 * 软措辞（「请注意」「尽量」）对弱模型不足：`030b8be7` 的教训是审稿曾把序数/全称**断言**当作
 * 既定事实、只靠说明句没能拦住，最终要用硬约束句式才治住。本条用「不得…也不得…」的同构句式。
 *
 * ## 作用域
 *
 * 只下发到审稿的**普通路径**（`review-chapter.command.ts` 的 `ordinaryReviewPrompt`）。
 * `recheck`（一次性定向复核）只裁决既有 finding、不发现新问题，判定规则已限定「只核对原
 * finding 的 problem 与 expected」⇒ 不下发本条（见设计稿 §4「不做」）。
 */
export function reviewFarTermSettingRule(language: WritingLanguage): string {
  return writingLanguageText(
    language,
    '【远期设定使用规则】【世界观设定】中属于长期谜团、终局真相或后文才展开的设定，是故事走向而非本章既定事实：它们只用于判断正文是否过早泄露、误解或误用远期真相；不得因正文未写出这些内容而报缺失，也不得要求正文提前兑现这些结论。本章须遵循的是与正文同时段的规则、空间与人物设定。',
    '[Rule for far-term settings] Settings in [Worldbuilding] that are long-term mysteries, endgame truths, or later-stage developments are story direction, not established facts of this chapter: they serve only to judge whether the draft leaks, misreads, or misuses a far-term truth too early. Do not report a missing item merely because the draft omits them, and do not demand that the draft pay them off in advance. What this chapter must follow are the rules, spaces and character settings that apply at the same time as the draft.',
  )
}
