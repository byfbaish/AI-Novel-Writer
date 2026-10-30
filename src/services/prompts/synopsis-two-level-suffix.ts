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
- 第二行：「定性：<X编号 | 筹码：<名字> | 软肋：<名字> | 无> — <这一章碰到的是哪一条，一句话说清是哪类处境>」；
- 第三行：「选择：<力源，或例外值 破／守> —— <他这一章做了什么>｜否掉了 <他本可以做的另一件事>，因为 <依据>」，依据只有四种：X<n>：<那条禁区>／顶撞X<n>：<他破了哪条、付了什么代价>／筹码：<名字>／软肋：<名字>；这一章确实没有他的戏，写「无：<为什么他不在场>」；
- 其后：正文，连贯段落；
- 最后一行：「收尾：<一句话>」。

严禁输出「覆盖：」行 —— 本结构只有「卷 / 单元」两级，没有可声明的结构位；不得自造任何形如 V1-U1-Start、M1-1 的编号。
严禁输出「正文前的声明行」「格式说明」「以下为正文」这类标签行，也不得把本节任何一句话抄进正文。

【定性：行的写法】
先定类，再定选择 —— 这一步只回答「这是哪一类事」，**不回答他怎么做**：
- 这一行**不许写他做了什么**，只写这一章碰到的是哪一类处境；
- 定性的那个东西**必须与下面「选择：」行引用的依据一致**；两处对不上就是没想清楚，重写这一章；
- 碰上他的**禁区**写 X<n>（编号见角色卡【禁区】段，全书恒定）；某样**筹码**被拿住写「筹码：<名字>」；他被自己的**软肋**绊住写「软肋：<名字>」；
- 每一条依据都必须能在当前角色卡上或本章正文里指出对应物，不许写「他的弱点」「他的执念」这类没有名字的说法；**软肋可以写卡上还没登记的**（章末定稿会登记），但名字要写具体；
- 只有这一章确实没有他的戏（纯他人视角、时间跳跃、他全程不在场）才写「定性：无 — <为什么他不在场>」，此时选择行写 无。

【选择：行的写法】
这一行不是你在挑，是他挑。写之前按下面的顺序走完四步，**只在内部走，过程一个字都不许写进输出**。

力源只有四个值（他靠什么动）：
- **自己** = 亲自上手，用他自己的本事、身体、时间；
- **他人** = 拉一个具体的人入场替他出力、传话、背书；
- **规则** = 搬出制度、名分、约定、众人的眼睛压对方；
- **交换** = 拿一样对方想要的东西，换自己想要的。
另有两个**例外值**（不是第五、第六个力源，是"不接受题目"与"不动"）：
- **破** = 题目给的选项他一个都不接，另开一条；
- **守** = 他什么都不动：等、拖、装作没这回事。

四步（顺序不能颠倒）：
1. 先读他的**禁区**（角色卡【禁区】段的 X<n>）：这一章的压力顶到哪一条？那一条说的是他不肯做什么？
   ★ **必须把这个编号记下来**：本行末尾的「因为」后面要写 X<n> —— 写下编号，这一章才算他做的决定；不写编号，等于他不在场。
   ★ 这一章**让他破了那条禁区**时，写「因为 顶撞X<n>：<代价>」。破了就一定要付代价 —— 不写代价的破例，是作者开恩，不是人物长大。
   ★ 一条禁区都对不上时，看他这一章是不是被某样**筹码**或**软肋**拿住了：是就写「因为 筹码：<名字>」或「因为 软肋：<名字>」。
   他确实不在场，才写「无：<理由>」。
2. 列三个他够得着的动作：不是最聪明的三个，是他这个处境下真能伸手的三个；
3. 用当前「倾向」逐条筛：**他再聪明，也不能做一件不符合他当前倾向的事**；不准用"这次情况特殊"给他开绿灯 —— 一个强项抵消不了一条倾向。唯一的例外是这一章本来就是他登记过的位移点（见下方判定句②）；
4. 取第一个剩下的，不是最好的那个。人做决定是找到能接受的第一个就停，不是把方案比一遍挑最优 —— 所以**他选的多半不是最优解，这很正常**。他用自己的方式把事情解决，才叫爽；他直接选了个聪明方案，那是你替他解决了。

其余约束：
- 不得因为"这样更爽、更好推进、更合理"而选一个他不会做的动作。角色卡里一条禁区都读不到时，退到他的筹码或软肋（写「筹码：<名字>」/「软肋：<名字>」）并写明依据；连这些都读不到才写「无」，不得默认让他选最有利的那个；
- 「否掉了…因为…」是这一行的判定句，因为 后面**先写依据**。按四分支判，只有前三支放行：
  ① 他做的正对得上 X<n> 那条禁区 ⇒ 正常，不必解释；
  ② 他**破了** X<n> ⇒ 写「顶撞X<n>：<代价>」，正文必须写出他破戒时的身体反应与代价；**同一条禁区不能连着破三次** —— 破了两次还照破，说明那条线本来就不是禁区，该把它删掉或改成筹码；
  ③ 对不上任何禁区，但被某样筹码或软肋拿住了 ⇒ 写「筹码：<名字>」/「软肋：<名字>」，动作要能直接对应那个名字；
  ④ 这一章确实没有他的戏 ⇒ 写「无」，并说明为什么（纯他人视角、时间跳跃）；
- 编号写了，但这一章的局面和那条禁区根本不是一类 ⇒ **走形，重写**。引用是凑的，等于没引用；
- **破了禁区的那一章必须付代价**：破了不付代价，等于白送 —— 读者看到的是作者开恩，不是人物长大；
- **「守」不得连续三章出现，单个单元内不超过三成章数** —— 超了说明这一段该压成一场戏，不是该多写几章；「守」本身是逃避型倾向的正常表达时不算偷懒；
- **写「破」必须有前置**：时间、资源、知识三样里至少一样在前文埋过；没埋过就写「破」= 天降；
- 这一行决定的不是情节，是**他在这一章里是谁**：同一件事，他动「他人」和动「规则」，写出来是两章完全不同的东西；
- 后面章节蓝图会继承这一行（蓝图的任务描述必须以同一个力源开头），所以不得在这里写一个、正文里又演成另一个。

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
- 他这一章做了什么：就是上面「选择：」行的力源，正文要展开**它具体长什么样** —— 选「他人」就写他去求的是谁、许了什么、对方怎么讨价；选「规则」就写他抬出哪一条、谁认、谁不认、当众还是私下；不要只重复"他选择了借力"这句话；
- 他否掉了什么：就是「否掉了…因为…」那半句。**被否掉的那个选项必须真的存在** —— 他真的动过念、真的够得着，读者要看见它摆在那儿。正文里那条路一次都没出现过，却说"他本可以那样"，这个选择就没有分量，只是一句辩解；
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
- Line 2: "Qualify: <X-number | chip: <name> | soft spot: <name> | none> — <which entry this chapter runs into, one clause naming the kind of situation>";
- Line 3: "Choice: <Self | Others | Rules | Trade | Break | Hold> — what he did in this chapter | ruled out: the other thing he could have done, because <basis>", where the basis is exactly one of: X<n>: <that forbidden line> / break X<n>: <which line he broke and what it cost> / chip: <name> / soft spot: <name>; when this chapter truly has no scene of his, write "none: <why he is absent>";
- Then: the prose, as connected paragraphs;
- Last line: "Hook: <one sentence>".

Never output a "Covers:" line — this structure has only two levels (volume / unit) and no claimable arc slots; never invent identifiers such as V1-U1-Start or M1-1.
Never output labels such as "declaration line before the prose", "format note" or "the following is the prose", and never copy any sentence of this section into the prose.

[The Qualify line]
Classify first, choose second — this line answers only "what kind of thing is this", **never what he does**:
- It must **not say what he did**, only which kind of situation this chapter runs into;
- The entry named here **must be the same basis the Choice line below cites**; if the two disagree, the chapter is not thought through — rewrite it;
- When the chapter runs into one of his **forbidden lines**, write X<n> (numbers come from the [Forbidden] block of his card and stay fixed for the whole book); when a **chip** of his is taken hostage, write "chip: <name>"; when one of his **soft spots** trips him, write "soft spot: <name>";
- Every basis must name something you can point at in the card or in this chapter's prose — never "his weakness" or "his obsession". A **soft spot may be named before it is registered** (finalization registers it afterwards), but the name must be concrete;
- Only when the chapter truly has no scene of his (someone else's POV throughout, a time skip, he is absent) write "Qualify: none — <why he is absent>"; the Choice line then carries "none".

[The Choice line]
You are not choosing here — he is. Work through the four steps below, **inside your head only; not one word of the process may appear in the output**.

The source of force has exactly four values (what he moves with):
- **Self** = he does it himself, with his own skill, body, time;
- **Others** = he brings one specific person in to act, carry word, or vouch for him;
- **Rules** = he invokes an institution, a title, a compact, or the eyes of the crowd to press the other side;
- **Trade** = he gives something the other side wants, for something he wants.
Two **exception values** (not a fifth and sixth source — they are "refuse the premise" and "no action"):
- **Break** = he takes none of the options the situation offered and opens a road of his own;
- **Hold** = he does not move at all: waits, stalls, acts as if none of this were happening.

The four steps, in this order:
1. Read his **forbidden lines** first — the X<n> entries in the [Forbidden] block of his card: which one does this chapter's pressure push against, and what does that line say he will not do?
   ★ **Note the number down**: the "because" clause at the end of this line must carry X<n>. With the number written, this chapter is his decision; without it, he is not in the scene.
   ★ When this chapter makes him **break** that line, write "break X<n>: <the cost>". A break must cost him something — a break with no cost is the author being kind, not a person growing.
   ★ When no forbidden line matches, check whether a **chip** or a **soft spot** of his is being held: if so, write "chip: <name>" or "soft spot: <name>".
   Only when he is genuinely absent write "none: <reason>";
2. List three moves he can actually reach: not the three cleverest, the three he could genuinely put a hand on from where he stands;
3. Filter them through the current Tendency: **being clever never licenses doing something his current tendency rules out**; never let "this time is special" wave him through — one strength does not buy back one tendency. The only exception is a chapter that is itself a registered Shift (see the test clause below);
4. Take the first survivor, not the best one. People stop at the first acceptable option; they do not compare every plan and pick the optimum. So **his choice is usually not the optimal solution, and that is correct**. Solving it his own way is what reads as satisfying; handing him the clever solution means you solved it for him.

Other constraints:
- Never pick a move he would not make because it is "more exciting, easier to advance, more sensible". If his card carries no forbidden line at all, fall back to a chip or a soft spot ("chip: <name>" / "soft spot: <name>") and state the basis; only when even those are unreadable write "none" — never default to the most advantageous move;
- "ruled out … because …" is the test clause of this line, and because **starts with the basis**. Judge it in four branches, and only the first three pass:
  ① what he does lines up with forbidden line X<n> ⇒ correct, no explanation needed;
  ② he **breaks** X<n> ⇒ write "break X<n>: <the cost>", and the prose must show the bodily reaction and what it cost him; **the same line may not be broken three chapters running** — broken twice and broken again means it was never a forbidden line, so delete it or turn it into a chip;
  ③ nothing matches a forbidden line, but a chip or a soft spot is being held ⇒ write "chip: <name>" / "soft spot: <name>", and the action must map directly onto that name;
  ④ the chapter has no scene of his ⇒ write "none" and say why (someone else's POV, a time skip);
- A number is written, but this chapter's situation is not the same kind as that forbidden line ⇒ **out of character, rewrite**. A borrowed citation is no citation at all;
- **A chapter that breaks a forbidden line must make him pay for it**: a break with no cost is growth handed out for free — the reader sees the author being kind, not a person growing;
- **"Hold" must not appear in three consecutive chapters, and not in more than a third of a unit's chapters** — over that, the stretch should be compressed into one scene, not stretched into more chapters. When Hold is simply the honest expression of an avoidant tendency, it is not laziness;
- **"Break" requires setup**: at least one of time, resources, or knowledge must have been planted earlier; without it, "Break" is a rescue from nowhere;
- This line does not fix the plot; it fixes **who he is in this chapter**. The chapter blueprint inherits it, so do not write one thing here and play another in the prose.

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
- What he did: the source of force from the Choice line, expanded into **what it concretely looks like** — if Others, show whom he goes to, what he promises, how that person bargains; if Rules, show which clause he invokes, who honours it and who does not, whether it is public or private. Do not merely restate "he called in help";
- What he ruled out: the "ruled out … because …" half. **The ruled-out option must really exist** — he genuinely entertained it, he could genuinely have reached it, and the reader must see it sitting there. If that road never appears in the prose, "he could have done otherwise" is an excuse, not a choice;
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
