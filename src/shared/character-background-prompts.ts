import type { WritingLanguage } from './writing-language'

/**
 * Source D prompt: flesh out one named-but-unbuilt character.
 *
 * Three hard requirements are non-negotiable because they carry the whole point
 * of the source, per the author's decision:
 *   1. at least one internal contradiction (tension),
 *   2. must tie into the volume mainline (consistency),
 *   3. must not read as a copy of an existing card (differentiation).
 * Everything else is deliberately left to the author to edit afterwards.
 */
export function getCharacterBackgroundSynthesisTemplate(language: WritingLanguage) {
  if (language === 'en-US') {
    return {
      systemRole: 'You are a character designer for a long-form novel. Ground every inference in the supplied outline and blueprints. Never contradict established facts. Output strict JSON only.',
      content: `Deepen exactly one character who has been named but has no card yet.

[Character to flesh out]
{{character_name}}

[Volume mainline and outline]
{{mainline}}

[Blueprint passages mentioning this character]
{{mentions}}

[Existing character cards, for differentiation only]
{{existing_roster}}

Hard requirements — all three must hold:
1. Include at least one internal contradiction: a real tension between what this character wants and what they fear, believe, or owe. The contradiction must be visible in behaviour, not merely asserted.
2. The character must be tied to the volume mainline: state a concrete stake, debt, duty, or opposition that connects them to the main conflict.
3. Do not duplicate an existing card. If a role, ability, or archetype already belongs to someone above, take a different angle or a conflicting one.

Infer only what the supplied material supports. Where the material is silent, choose the most dramatically useful option that stays consistent with it; never contradict a stated fact. Keep the character template sharp and tense rather than exhaustive.

After the three hard requirements, relationshipCandidates is where you hand the author anchors to connect. Read them off the supplied material only:
- Targets are exact names taken from [Existing character cards] or from [Blueprint passages] — never a name you invented.
- Relationships are directed. Only declare the direction this character actually holds (A is B's mentor does not imply B is A's). Do not add a mirror of an edge that belongs to the other side.
- One character may hold several edges, and a pair may repeat with a different relation when the material supports both. Near-synonyms are acceptable; do not force them into one label.
- It is a valid and expected answer to return [] — a character with no defensible relationship yet is better than a fabricated one.

relationshipCandidates is an array of {"target":"exact name","relation":"relationship"}.

Output contract:
{"character":{"name":"exact name","role":"protagonist|antagonist|supporting|minor","gender":"...","age":"...","appearance":"...","personality":"...","background":"...","abilities":"...","motivation":"...","arc":"...","notes":"other useful facts"},"relationships":[{"target":"exact name","relation":"relationship"}]}
Omit optional fields you cannot support; do not emit empty placeholders, explanations, Markdown, or code fences.`,
    }
  }
  return {
    systemRole: '你是长篇小说的人物设计师。一切推断都以上下文提供的大纲与蓝图为依据，不得与既有事实冲突。只输出严格 JSON。',
    content: `为**一个**已被点名、但尚无角色卡的角色补全人物背景。

【要补全的角色】
{{character_name}}

【卷纲与主线】
{{mainline}}

【提到该角色的蓝图段落】
{{mentions}}

【既有角色卡（仅用于避免同质化）】
{{existing_roster}}

硬性要求（三条必须同时满足）：
1. **至少包含一个内在矛盾**：角色想要的东西与害怕、相信或亏欠的东西之间必须有真实张力，且该矛盾要能体现在行为上，不能只是标签式陈述。
2. **必须与卷纲主线挂钩**：写明该角色与主要冲突之间的具体利害、债务、职责或对立关系。
3. **不得与既有角色卡同质化**：若某个定位、能力或原型已属于上表中的角色，必须换一个角度，或刻意与之形成冲突。

只推断上下文材料能够支撑的内容。材料未提及之处，选择与该材料一致、且戏剧性最强的选项，但不得与已陈述事实冲突。目标是**精确且有张力**的人物模板，不必求全。

relationshipCandidates 是给作者准备的关系锚点，只从上文材料里读出来：
- target 必须是【既有角色卡】或【提到该角色的蓝图段落】里**逐字出现**的姓名，不得自创。
- 关系是**有方向的**，只声明该角色真实持有的方向（「A 是 B 的师父」不等于「B 是 A 的师父」）。属于对方一侧的边由那张卡自己声明，这里不要补镜像。
- 同一角色可以有多条边；同一对角色在材料支持不同含义时可以重复出现。近义关系可以并存，不必强行合并成一个词。
- 返回 [] 是完全合法且常见的结果 —— 暂无站得住脚的关系，好过硬凑一条。

relationshipCandidates 使用 {"target":"精确姓名","relation":"关系"} 数组。

输出合同：
{"character":{"name":"精确姓名","role":"protagonist|antagonist|supporting|minor","gender":"…","age":"…","appearance":"…","personality":"…","background":"…","abilities":"…","motivation":"…","arc":"…","notes":"其他可用事实"},"relationships":[{"target":"精确姓名","relation":"关系"}]}
无法支撑的可选字段必须省略，不得输出空占位、解释、Markdown 或代码围栏。`,
  }
}
