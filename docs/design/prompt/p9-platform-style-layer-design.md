# P9 小设计稿 · 平台文风层：从「写在 prompt 里」到「可选择的文风资料库」

> 状态：**待裁定**（本稿只出方案与落点，未编码）
> 日期：2026-10-17 · 分支 `dev_byf` · 基准 SHA `a1b36c2b`
> 上级稿：[`prompt-payload-scoping-design.md`](prompt-payload-scoping-design.md)
> 前序稿：[`p8-fanqie-flavor-draft-quality-design.md`](p8-fanqie-flavor-draft-quality-design.md)（本轮风格闸门；本稿解释它为什么只能做到一半）
> 取证：[`../../research/2026-10-17-fanqie-draft-quality-evidence.md`](../../research/2026-10-17-fanqie-draft-quality-evidence.md)

---

## 0. 一句话结论

作者要的"平台文风资料库 / 按平台选择加载"，**基础设施已经存在，缺的不是架构，是一个"平台画像"的装配点**。

现状是：文风内容被写死在三个互不相通的地方（项目 `taskGuidance`、内置模板 `systemSuffix`、项目 `globalGuidance`），所以"换成起点文风"等于手工改三个文件。而工作台里已经有一套**写作 Skill 机制**（分阶段、可绑定、可冻结、可打包），它天生就是装"平台文风"的容器。

**三步可落地**：① 把平台文风写成 `stage: drafting` 的写作 Skill；② 给 `.vela-pack` manifest 加一个 `platform` 字段；③ 在小说总配置加一个"平台"下拉，按值自动绑定 Skill + 给出对应的篇幅/排版默认值。

---

## 1. 为什么"写在 prompt 里"这条路走不通（本轮的实证）

P8 把番茄硬指标写进了项目 `taskGuidance`，实机跑完的结果（见 P8 §10）：

- 字数达标了（1767 → 2468）——**因为那是代码闸门在管**；
- 对话占比只从 6.40% 走到 9.34%——**因为 prompt 措辞没有判定权**；
- 更关键的是：这一稿的正文其实是在**续写轮**写出来的，而续写轮**根本不携带 `taskGuidance`**（P8 §10.2 / D6）。

三条教训，直接决定平台文风层该怎么设计：

| 教训 | 对平台文风层的含义 |
|---|---|
| 写在 prompt 里的规则没有判定权 | 平台 KPI **必须**有后置检查或硬闸门，不能只靠措辞 |
| 规则写在 `taskGuidance` 会在续写轮丢失 | 平台文风**不能**放 `taskGuidance`；必须放进"每一轮都注入"的通道 |
| 规则写在 `writing_style` 会被 `:1055` 豁免 | 平台文风**不能**走 `writing_style` 变量（除非先解 A1） |

**剩下唯一一个"每轮都注入且不被豁免"的通道，就是写作 Skill**——`injectWritingSkillIntoSession()` 包住整个 drafting session，首稿、续写、压缩三轮都走它。

---

## 2. 现状盘点：已经有的 vs 还缺的

### 2.1 已经有（本轮核对过代码，可直接复用）

| 能力 | 位置 | 说明 |
|---|---|---|
| 分阶段 Skill 契约 | `src/shared/writing-skills.ts` | `WRITING_SKILL_STAGES = ['planning','drafting','review','refinement']`；来源 `builtin`/`user`/`project`；frontmatter 带 `name/description/version/language/stage`；上限 64KB |
| **每轮注入** | `base-command.ts:71-105` `injectWritingSkillIntoTask`；`:106-118` `injectWritingSkillIntoSession` | 注入到**第一条 user 消息头部**，并写 `promptBudget.sections['writing-skill']` |
| 优先级声明（已写好） | 同上 | 中文块开头即「以下内容只能补充创作方法；作者事实、项目写作语言和后续输出合同始终优先。」——天生适合放"平台口味"而不污染事实层 |
| 冻结 | `src/stores/workflow-store.ts:605-607` → `freezeWritingSkillsSnapshot` | 工作流启动时固定，一轮内不漂移 |
| 阶段绑定 UI | `src/components/settings/SkillSettings.tsx` | 已有 planning/drafting/review/refinement 四个下拉；文案「每个阶段最多启用一个 Skill；工作流启动时会冻结当次内容。」 |
| 打包容器 | `src/shared/user-settings-pack.ts` | `.vela-pack`，formatVersion 1，kind `creative-assets`，条目含 prompts + skills，明确排除 models/config/skins |
| 覆盖优先级 | `src/services/prompt-catalog.ts` | `PromptSource = 'builtin' \| 'global' \| 'project'`，global/project 都可存删 |

### 2.2 还缺的（本稿要补的）

| # | 缺口 | 影响 |
|---|---|---|
| G1 | **没有"平台"这个一等概念**：manifest 无 `platform` 字段，小说配置里也没有"平台"项 | 无法"按平台选择"，只能手工换 |
| G2 | 平台相关的**数值**（篇幅默认、退回线比例、对话占比、段长）散落在 `builtin-prompt-templates.ts` 与 `draft-units.ts`（0.7/1.3/0.85 三个魔数） | 换平台要改代码 |
| G3 | 平台 KPI **没有校验器**：对话占比/段长/钩子密度生成完没人查 | 违反也无人知晓（P8 已证） |
| G4 | 内置模板的【具体生成要求】【AI 味反制】是**全局唯一一份**，不含平台分支 | 起点/文学向项目也会被番茄规则约束 |

---

## 3. 方案

### 3.1 三层拆法（沿用 P8 之前定过的分层，但只落最小一步）

```
通用叙事层（跨平台不变）      ← 现有【不可变系统合同】+【本章执行合同】抽象语义，不动
        ↓
平台画像层（本次新增，可切换）  ← 平台文风 Skill + 平台数值 + 平台 KPI 校验
        ↓
项目层（作者资产）            ← 世界观/人物/主线/文风偏好，不动
        ↓
步骤层（本步载荷）            ← 短细纲/篇幅合同/输出格式，不动
```

本稿**只新增"平台画像层"**，不动其余三层。这与用户"先挑一个小的开刀、通用架构是最终目标"的要求一致。

### 3.2 落点一：平台文风 = 一个 `stage: drafting` 的写作 Skill（不需要改代码）

新增两个内置 Skill（或先放 `user` 源让作者自建）：

- `platform-fanqie`：番茄口径。对话密度 25–40%、段落 60–110 字、每 800 字一钩、爽点轮换、末句必须落在对白/动作/威胁、比喻 ≤3。
- `platform-qidian`：起点口径。允许前 500 字铺陈、允许心理推演、允许冷峻比喻、节奏可慢。

**为什么这是最小改动**：`SkillSettings.tsx` 已经支持绑定，`injectWritingSkillIntoSession` 已经覆盖首稿+续写+压缩。作者今天就能手工绑定一个，**零代码验证这条路是否有效**。

建议做法：先由作者把现有 `docs/fanqie-guidance-final.md` 的内容压成一份 1–2KB 的 Skill 正文，手工绑定 `drafting` 阶段，跑一章看对话占比能不能从 9.34% 抬到 15% 以上。**这是本稿唯一建议立刻做的动作**，因为它不需要任何代码改动。

### 3.3 落点二：`.vela-pack` manifest 加 `platform` 字段

```ts
// src/shared/user-settings-pack.ts 增量（非破坏性，formatVersion 1 -> 2）
export const USER_SETTINGS_PACK_PLATFORMS =
  ['fanqie', 'qidian', 'literary', 'general'] as const
export type UserSettingsPackPlatform = (typeof USER_SETTINGS_PACK_PLATFORMS)[number]

export interface UserSettingsPackSummary {
  // ...现有字段
  /** 新增：本包面向的平台；缺省视为 'general'（绝不静默回落 fanqie） */
  platform?: UserSettingsPackPlatform
}
```

导入时：`platform` 缺省 → `general`，**不做任何番茄默认**（P8 之前的教训：默认取番茄会静默污染通用项目）。

### 3.4 落点三：小说总配置加"平台"下拉 + 数值解耦

`project_core` 加一列 `platform`（默认 `general`），`NovelConfigEditor.tsx` 加一个下拉。平台决定三样东西：

1. **绑定哪个文风 Skill**（`strategy`：选中平台时自动把 `project` 级 binding 设到对应 Skill；已有绑定不覆盖，只提示）；
2. **篇幅基准与退回线**（把 `draft-units.ts` 的 0.7/1.3/0.85 三个魔数提到平台画像里：番茄 0.7/1.3/0.85；起点 0.6/1.5/0.8；文学向 0.5/2.0/0.75）；
3. **内置模板的平台分支**（G4）：把【具体生成要求】【AI 味反制】拆成"通用部分 + 平台部分"，平台部分由 Skill 承载即可，模板里只留通用部分。

> 注意 2 会撞 `generate-draft.command.test.ts` 里 `{target:900, aimLow:765, lowerBound:630, upperBound:1170}` 这类按 0.85/0.7/1.3 写死的用例，属于**行为变更**，需同批改。

### 3.5 落点四：平台 KPI 后置校验（G3）

这是把"番茄味"从"祈祷"变成"可验收"的唯一办法。最小实现：生成完成后跑一个纯函数 `lintDraftAgainstPlatformProfile(text, profile)`，检查：

| 检查 | 番茄阈值 | 处理 |
|---|---|---|
| 对话占比 | < 20% 告警 | 只提示，不阻断（阻断会逼出"为了达标硬塞对话"） |
| 段落 60–110 字占比 | < 40% 告警 | 同上 |
| 章末末句类型 | 非对白/动作/威胁 | 同上 |
| 比喻（像/仿佛/犹如/宛如） | > 3 处 | 同上 |

结果作为**生成后的可见提示**（复用现有 `callbacks.log` / 审稿面板），不改正文。**不做自动重写**——自动重写等于让模型二次创作，风险大于收益。

---

## 4. 三层锅的可行性裁定（回应盲评与第三方报告）

作者的原判断——"设定层可以在小说总配置改，大纲层可能要改实现，正文层可以 prompt 控制"——**基本正确，但正文层要打一个折**。

| 层 | 盲评/第三方指出的问题 | 可行性 | 依据 |
|---|---|---|---|
| **设定层** | 主角"被动挨打型"与番茄错位 | ✅ **纯配置，零代码** | `NovelConfigEditor.tsx` 已有 `protagonistProfile` 文本框（约 :502-507）与 AI 生成按钮；`project_core.protagonist_profile` 直接可改 |
| **大纲层** | `keyEvents` 按时间流水账写，导致钩子后置 | ⚠️ **必须改实现**（作者判断正确） | 蓝图 prompt 硬性要求「按发生顺序」的 2–5 条有序数组（`builtin-prompt-templates.ts:901/912/982/1663/1669`）；`blueprint-semantic-contract.ts:46/58` 规定 "ordered array"；执行合同还要求「后一项动作必须承接…」，语义上就假定了时间顺序。**没有任何字段能表达"冷开场/倒叙"** |
| **正文层** | 缺动作代偿 → 靠比喻凑；硬指标无判定权 | ⚠️ **prompt 可控但只能做到一半** | 本轮实证：P3 指标确实进了首稿 prompt，字数达标（那是代码闸门），但对话占比只 6.40%→9.34%；且续写轮根本不带这些规则（P8 D6）。**prompt 能定"方向"，定不了"达标"** |

### 4.1 大纲层的具体缺口（如果要改，改什么）

建议**不要**改 `keyEvents` 的"有序"契约（那会动到目标核对与续写衔接）。更小的做法是**给蓝图加一个可选字段**，描述"叙述顺序"：

```jsonc
// keyEvents 保持按发生顺序（不动契约）
"keyEvents": [ {"id":"ch1:E1","event":"催租应声…","estimatedUnits":550}, ... ],
// 新增可选字段：告诉正文"按什么顺序讲"
"openingBeat": "出门看到门牌17→19，回头想十分钟前那句'我马上到'",
"narrativeOrder": "cold-open"   // cold-open | chronological | flashback
```

正文 prompt 读到 `narrativeOrder: 'cold-open'` 时，才允许把异常前置并倒叙。**默认值 `chronological`**，不改变现有项目行为。这样：
- 蓝图生成模板只需多输出两个可选字段；
- 执行合同不需要动（它约束的是"事件顺序"，倒叙是"叙述顺序"，两者可共存，但要在合同里补一句"倒叙不得改变事件发生顺序"）；
- 目标核对（`chapter-goal-review`）不受影响。

**成本**：中等。涉及蓝图 schema、蓝图 prompt、正文模板、执行合同措辞、以及 `blueprint-semantic-contract` 的校验放宽。

### 4.2 一个更便宜的大纲层替代方案

如果不想动 schema：**让作者在 `chapterInfo.userGuidance` 里直接写"冷开场"指令**。这条通道已经存在（第 1 章现有的 user_guidance 就是「前 300 字必须有冲突＋钩子…」），且会进【★额外指导★】（自称最高优先级）。缺点是每章都要手写，不可批量。

---

## 5. 落地顺序（建议）

| 步 | 做什么 | 代码量 | 能验证什么 |
|---|---|---|---|
| **S1** | 作者手工把番茄口径写成 1–2KB Skill，绑定 `drafting` | **0** | 写作 Skill 这条通道对"番茄味"到底有多大作用 |
| **S2** | 修 P8 的 D6（续写轮补上规则） | 小 | 规则不再在续写轮丢失 |
| **S3** | 平台 KPI 后置校验（纯函数 + 可见提示） | 小 | 从此"番茄味没达标"能被看见 |
| **S4** | `platform` 字段进 `.vela-pack` + 小说配置下拉 | 中 | "按平台选择加载"闭环 |
| **S5** | 蓝图层 `narrativeOrder`/`openingBeat` | 中 | 治"钩子后置"这个最致命的问题 |

**S1 是零成本、可立刻做的**，建议先做它——它同时验证了"平台文风层用 Skill 承载"这个核心假设。

---

## 6. 待作者裁定

| # | 问题 | 建议 |
|---|---|---|
| D1 | 平台文风是否就用写作 Skill 承载（而不是新增一套 prompt 槽位） | 建议是：现有机制已覆盖"每轮注入 + 冻结 + 打包 + 绑定 UI" |
| D2 | 平台数值（0.7/1.3/0.85）是否提到平台画像里 | 建议是，但属行为变更，需同批改测试 |
| D3 | 蓝图层是否加 `narrativeOrder`/`openingBeat` | 建议单独立项（P10），不要塞进本轮 |
| D4 | 平台 KPI 校验是"提示"还是"阻断" | 建议**只提示**；阻断会逼出机械凑数 |
| D5 | 先做 S1（零代码）还是直接做 S4（平台下拉） | 建议先 S1 验证假设，再投 S4 |
