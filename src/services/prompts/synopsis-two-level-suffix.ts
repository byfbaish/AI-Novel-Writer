/**
 * `synopsis` 的**两级结构版**输出合同（卷 / 单元）。
 *
 * ## 为什么要有第二份
 *
 * `synopsis.systemSuffix` 写的是弧光三层语言（大弧 / 中弧 / 小弧 / 结构位 ID）。
 * 而结构生成在「卷 / 单元」命名下只产出**两级**，projectArcStructureText 也不补小弧层。
 * 2026-10-20 实证（作者 150 章项目）：
 *
 * - 模型按「ID 只能逐字取自『本批可声明的结构位』清单」找不到清单 ⇒ **自造**
 *   `覆盖：V1-U1-Start / -Search / -Hazard / -Price / -Collapse`，且随「已完成大纲前缀」
 *   被再次喂回模型（污染自我复制）；
 * - 总述里「② 正文前的声明行（「覆盖：」与「选择：」）」这一短语被当成输出内容，
 *   每章正文前多抄一行，11 次全部落库。
 *
 * 所以两级结构下不是"加一句映射声明"就够：② 的六条子弹全在讲小弧怎么取舍，
 * ⑥ 讲小弧章号区间，⑧ 讲"最后一个大弧的最后一个小弧" —— 缺层时它们无解，
 * 模型只能自己编。这里把整套合同换成**卷 / 单元口径**，并显式禁止自造 ID
 * 与抄写格式说明。
 *
 * ## 为什么是渲染期替换、不改内置模板
 *
 * `synopsisInputsFingerprint` 对模板对象整体 `JSON.stringify`，内置 `systemSuffix`
 * 在里面。直接改内置会让**所有已存在的大纲检查点**判成「源事实已变化」而拒绝续批。
 * 因此这份文本只在拼 prompt 时替换掉 suffix，模板对象本身不动。
 */
import type { WritingLanguage } from '../../shared/writing-language'

const ZH_TWO_LEVEL_SUFFIX = `【每章的固定格式（强制输出）】
每章按以下顺序输出，除这些行以外不要加任何说明行、标签行或注释：
- 第一行：章标题「## 第N章：章名」；
- 第二行：「选择：<躲 | 拖 | 换 | 认> —— <他这一章主动选了什么>」；
- 其后：正文，连贯段落；
- 最后一行：「收尾：<一句话>」。

严禁输出「覆盖：」行 —— 本结构只有「卷 / 单元」两级，没有可声明的结构位；不得自造任何形如 V1-U1-Start、M1-1 的编号。
严禁输出「正文前的声明行」「格式说明」「以下为正文」这类标签行，也不得把本节任何一句话抄进正文。

【选择：行的写法】
- 四选一，各有明确含义：躲 = 回避接触、不让他人靠近；拖 = 争取时间、把事推到之后；换 = 拿一样东西换另一样；认 = 主动承担、把账记到自己头上；
- 它回答的是"这一章他做了什么决定"，不是"他遇到了什么"。写"他决定面对现实""他决定查清楚"不算 —— 那不是四选一里的任何一个动作；
- 这一行决定的不是情节，是语气与主动权的归属：同一件事，他选躲和选认，写出来是两章完全不同的东西；
- 后面章节蓝图会继承这一行（蓝图的任务描述必须以同一个选择开头），所以不得在这里写一个选择、正文里又演成另一个。

【收尾：行的写法】
- 必须独立成行，不得并入正文段落，也不得写成「收尾，……」这种句中插入；
- 只写一句话：本章结束时仍未决的那个问题、威胁或代价；
- 它的原材料必须全部来自本章正文：一个人、一件物、一句没答的话、一个没解释的细节。收尾只能把本章已经建立的东西推到「未决」，不得引入正文里没有的新事实、新人物、新事件、新信息；
- 自检：写之前先问「这个悬念在本章哪一段被种下的」。答不上来就是外挂，不许写；
- 不得与本章正文的任何陈述矛盾：正文写「他没答」，收尾就不能写「他已经递出去了」；
- 不得把正文已经写过的动作再复述一遍 —— 注意这不是「禁止提本章发生的事」，而是禁止重复叙述；
- 也不得写成下一章才发生的事件的预告：下一章才出现的人递来一张纸条、下一章才会被收走的东西，都不能在本章收尾里先发生；
- 这一行是后续章节蓝图结尾钩子的唯一来源。缺了它，钩子只能由蓝图自行编造，与本章意图脱节。

【章与章的承接】（从第 2 章起，每章都要满足）
- 上一章的「收尾：」行点明了某个仍未决的东西；本章正文必须从它接着写 —— 要么推进它，要么明确交代它为什么不再悬着（已经解决，或暂时搁置并给出理由）；
- 「接着写」不等于「立刻解决」：那个未决项可以继续悬着，但读者必须看出本章知道它悬在那儿；
- 不得写成整章与上一章的收尾毫无关系。最常见的断链形态是：上一章末尾抛出一个具体的报价、威胁或发现，本章开头直接换场景，一个字不提；
- 本章末尾再写自己的「收尾：」行。

【每章正文写成一件事的因果与代价】
不是事件流水账，也不是分场清单。先想清楚再动笔，写成连贯段落，不要写成字段列表 —— 包括「叙事任务」「进入状态」「离开状态」「段间推进」「逼法」这些结构里的标签，它们是结构层用语，不是正文写法：
- 他这一章主动选了什么：就是上面「选择：」行的四选一，正文要展开它具体长什么样 —— 选「躲」就写他怎么绕、绕开谁、拿什么当借口；不要只重复"他选择了躲"这句话；
- 因为什么：上一章留下的哪个未决项、哪笔账、哪句没答的话，逼出了这个选择。这一条是本章与前文的接口，不许省；
- 谁在挡他：具体的人、规矩、时间、钱、身体；且不得与上一章是同一种挡法；
- 代价落在谁身上：丢了什么、欠下什么、露了什么底、谁的处境因此更糟。代价只落在"他自己心情不好"不算代价；
- 章末仍未决的是什么 —— 就是收尾行，两处必须是同一件事。
  ★ 怎么试、试了几次、分几段、每段占多少字：一律不写。那是章节蓝图的工作。
  本章答不出"因为什么"时，说明这一章还没有被分配到位置 —— 不是"这一章内容少"。

【材料只能从这四处取，且必须落在本章所属单元以内】
- 锚点：这件事最关键的那一步 —— 一个动作或一句原话，足以让下面的后果成立。只写这一步，不写完整过程（过程是蓝图的 keyEvents）；
- 后果：上一个事件改变了谁 —— 谁被牵连、代价何时显现、什么开始不对；
- 反应：别人怎么误判 —— 旁观者、对手、配角各自的解读，以及他们因此采取的行动；
- 反复：他要的同一个东西，换了一种方法再来一次、仍然失败 —— 只写"换的是什么方法、为什么还是不行"，不写试的遍数与细节。
一律不得取用（它们属于后面的单元、后面的卷）：
- 本卷内后续单元的「叙事任务 / 进入状态 / 离开状态 / 段间推进 / 逼法」；下一卷的任何内容；本卷的「离开状态」与「结账」在非本卷最后一个单元时也不得提前兑现。

【篇幅由剧情决定，不是配额】
写到本单元的「离开状态」成立就停笔。不要在还有事没发生时草草收尾，也不要为凑章数加戏 —— 更不要用时间跨度当压缩理由：一天之内可以写十章，一百年也可以一章带过。决定篇幅的是受挫的次数与边界的数量。

【收束】（只在本卷最后一个单元、且是全书最后一卷时生效，其余章忽略）
- 不再把问题推到「仍未决」，而是逐章把已经埋下的东西收掉。收的对象必须是前文出现过的东西（承诺、威胁、欠下的账、没说出口的话），不得用一个新出现的人或物来解决 —— 那是天降；
- 全书最后一章必须正面回答【全书问题】：答是、答否、或把问题重新定义为更真的那一个；
- 主角必须为这个结局付出一样拿不回来的东西（退路、身份、某段关系、他一直护着的东西）；
- 最后两章不得开新线：不出现新的施压方、新的谜团、新的「后面还有事」的暗示；
- 终局那一击不得由金手指或外力代办：金手指只能处理他**已经选择付出代价之后**剩下的那一步；
- 最后一章的「收尾：」行写新的常态（他此后怎么活），不是下一个威胁。

★【作者对本步骤的额外指导（如有，最高优先级）】★：
{{step_guidance}}`

const EN_TWO_LEVEL_SUFFIX = `[Fixed per-chapter format — mandatory]
Output each chapter in exactly this order, with no extra labels, headings or commentary lines:
- Line 1: chapter heading "## Chapter N: Title";
- Line 2: "Choice: <avoid | stall | trade | own> — what he actively chose in this chapter";
- Then: the prose, as connected paragraphs;
- Last line: "Hook: <one sentence>".

Never output a "Covers:" line — this structure has only two levels (volume / unit) and no claimable arc slots; never invent identifiers such as V1-U1-Start or M1-1.
Never output labels such as "declaration line before the prose", "format note" or "the following is the prose", and never copy any sentence of this section into the prose.

[The Choice line]
- One of four, each with a fixed meaning: avoid = stay away from contact; stall = buy time and push it later; trade = give one thing to get another; own = take the debt onto himself;
- It answers "what did he decide", not "what happened to him". "He decided to face reality" is not one of the four;
- This line decides the tone and who holds the initiative, not the plot. The chapter blueprint inherits it, so do not write one choice here and play another in the prose.

[The Hook line]
- Must stand on its own line; one sentence only: the question, threat or cost still unresolved when the chapter ends;
- Its material must come entirely from this chapter's prose. It may push something already established to "unresolved", but must not introduce a new fact, person, event or piece of information;
- Self-check: ask which paragraph of this chapter planted it. If you cannot answer, it is bolted on — do not write it;
- It must not contradict anything the prose states, and must not merely restate an action the prose already described;
- It must not be a preview of what happens next chapter;
- This line is the only source for the blueprint's ending hook.

[Continuity from chapter 2 onward]
- The previous chapter's Hook names something unresolved; this chapter must pick it up — either advance it or explain why it is no longer hanging (resolved, or deliberately parked with a reason);
- "Pick it up" does not mean "resolve it immediately";
- Do not write a chapter unrelated to the previous hook. The most common break is: the previous chapter ends with a concrete offer, threat or discovery, and this chapter opens on a new scene without a word about it.

[Write each chapter as the causality and cost of one thing]
Not a chronicle of events, not a scene list. Write connected paragraphs, not field lists — "narrative task", "entry state", "exit state", "inter-unit progression" and "pressure" are structure-level labels, not prose.
- What he actively chose: expand what the Choice line actually looks like in practice;
- Because of what: which unresolved item, debt or unanswered line from the previous chapter forced this choice. This is the chapter's interface with what came before — never omit it;
- Who blocks him: a specific person, rule, deadline, money, body; and not the same kind of block as the previous chapter;
- Who pays the cost: what was lost, owed, exposed, whose situation got worse. "He felt bad" is not a cost;
- What is still unresolved at the end — the same thing as the Hook line.
  Do not write how he tries, how many attempts, how many segments or how many words per segment — that is the blueprint's job.

[Materials may only come from these four sources, and must stay inside the current unit]
- Anchor: the single most critical step — one action or one line of dialogue that makes the consequences hold. Only that step, not the whole process;
- Consequence: who the previous event changed — who was dragged in, when the cost shows, what starts going wrong;
- Reaction: how others misread it — onlookers, opponents, supporting characters, and what they do because of it;
- Repeat: the same thing he wants, attempted a different way and failing again — only what changed and why it still fails.
Never use: the narrative task / entry state / exit state / progression / pressure of any later unit in this volume; anything from a later volume; this volume's exit state and settlement before its final unit.

[Length follows the story, not a quota]
Stop once this unit's exit state holds. Do not wrap up early while things are still open, and do not pad the chapter count. Do not use elapsed time as a reason to compress: ten chapters can happen in a day, and a century can pass in one chapter.

[Closure] (only in the final unit of the final volume)
- Stop pushing questions to "unresolved" and start collecting what was planted. What you collect must have appeared earlier; never resolve it with a newly introduced person or object;
- The final chapter must answer the book question: yes, no, or by redefining it into the truer one;
- The protagonist must pay with something he cannot get back;
- The last two chapters must not open new threads;
- The final blow must not be delegated to the cheat or an outside force;
- The final Hook line states the new normal, not the next threat.

★ [Extra author guidance for this step — highest priority if present] ★:
{{step_guidance}}`

/** 两级结构版输出合同。`step_guidance` 由 PromptBuilder 统一插值。 */
export function getSynopsisTwoLevelSuffix(language: WritingLanguage): string {
  return language === 'en-US' ? EN_TWO_LEVEL_SUFFIX : ZH_TWO_LEVEL_SUFFIX
}
