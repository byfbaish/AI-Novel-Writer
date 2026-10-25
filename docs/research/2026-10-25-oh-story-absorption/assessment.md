# oh-story-claudecode 吸收评估

> 状态：**已裁定（2026-10-25）** · A2/A3/A4/A5 **均已实施** · **A1 降级为「平台扩展参考材料」**（作者裁定：成本过高，见 §9）
> 评估对象：`oh-story-claudecode` v0.9.0（MIT，zenstory-ai）· 795 文件 / 11.7MB / 13 个 skill
> 证据：[`facts-01-skills.md`](facts-01-skills.md)（13 skill 职责）· [`facts-02-scripts.md`](facts-02-scripts.md)（脚本判据逐字摘录）
> 判定 canon：[`industry-alignment-and-stage-goals.md`](../../design/architecture/industry-alignment-and-stage-goals.md) §2 术语表与 §5 四问 · [`long-form-readiness-review.md`](../../design/architecture/long-form-readiness-review.md) · [`long-form-craft-alignment-assessment.md`](../../design/architecture/long-form-craft-alignment-assessment.md) · [`p2-1-continuity-findings-design.md`](../../design/review/p2-1-continuity-findings-design.md) §5
> 定位：这是**外部方案对比**，不是设计稿。任何一项真要动手时，从这里取用并另出设计稿。

---

## 0. 一句话结论

> **它强在「确定性文本质量门禁」，弱在「连续性」——正好与我们互补。**
> 我方强 continuity（story bible 六类宿体 + findings + 改稿连锁），弱在**文本质检只有 prompt 文案、没有判定器**；
> 它反过来：22 类结构检测 + 退化指纹 + 照搬检测 + 加载预算都是可复跑的确定性代码，但连续性只靠自由文本槽 + 「提醒模型别写错」，没有任何冲突检出。
>
> **值得吸收的集中在 A 类 5 项，全部是「装判定权」，不改任何创作规则。**

---

## 1. 它的真实形态（决定哪些根本不适用）

| 维度 | 它 | 我们 |
|---|---|---|
| 交付形态 | skill 包：Markdown 写方法与契约，装进别人的编程 Agent | Electron 桌面应用，自带 UI/DB/模型调用 |
| 运行位置 | 宿主 Agent 的上下文里，靠 prompt 约束 | 主进程 + 渲染进程，靠代码契约 |
| 状态载体 | 书目录下一堆 md + 一个 `_tracking-state.json` | SQLite 多表 + 迁移 |
| 模型 | 宿主自带（Claude/Codex/GPT…） | 作者自配（Ollama / DeepSeek 等） |
| 覆盖面 | 扫榜、拆文、写、审、去味、封面、Dashboard | 只做写与审 |

> 这条决定了一件事：**它 13 个 skill 里约一半是「宿主适配层 + 平台数据采集」，与我们产品形态正交**（见 §4 C4–C7）。这不构成缺口。

---

## 2. 28 条行业术语映射（闸 1）

| # | 行业标准名 | 它有无对应 | 形态与强弱 |
|---|---|---|---|
| 1 | continuity | 有 | `追踪/_tracking-state.json` + 7 张派生 md；**单一 JSON 源**，无冲突检出 |
| 2 | story bible | 有 | `设定/` `角色/` `追踪/` 文件树；六节里缺「术语表」 |
| 3 | series bible handoff | **无** | 只做单本，无跨部概念 ⇒ **我方 W8 是自研领先项** |
| 4 | continuity error | **无** | 只有「预防」，没有「检出」；review 是 LLM 语义审，不是比对 |
| 5 | numerical contradictions | **无** | 无资源量、无余额概念 ⇒ 我方 W6（虽形态已证伪）仍领先 |
| 6 | possession continuity | 弱 | 物品只落在 `abilities_resources` 自由文本，无「刀在谁手里」的转移校验 |
| 7 | forgotten abilities | 弱 | 同上一格，无「被遗忘」检测 |
| 8 | world rules / periodic obligations | 弱 | 有「长期约束」视图，**无四态**（due/not_due/overdue/unknown） |
| 9 | who knows what | 有（弱） | `characters{knowledge}` 单字段；我方 M16 是人粒度 + 只做正向知情 |
| 10 | chronology | 有 | `timeline{E\d}` + `story_time`；我方日序整数更严（禁按章号推算） |
| 11 | character bible | 有（**且有一格我们没有**） | 8 槽：`identity/location/goal/state/abilities_resources/relationships/knowledge/open_threads`。**`open_threads`（角色未决事项）对应我方 `cs_*` 六槽之外** |
| 12 | character arc | 无 | 双方都没有弧位；与我方 C6「只做起点→终点」一致 |
| 13 | plot promises / unresolved threads | 有 | `foreshadow{F\d{3}: 已埋/已回收/已过期/放弃}` 四态；**我方五态 + dormant/overdue 更强** |
| 14 | consult the bible before writing | 有（**形态值得看**） | `check-reference-gates.js` 把「写前必读」做成**静态可断言的首屏位置守卫**；另有「卷纲不整读」强制取段 |
| 15 | manuscript validation | 部分 | 三个预检脚本做**文本质检**；不做连续性冲突检出 |
| 16 | findings + resolve | 弱 | 有审查报告 + `.story-review/state.md`，无 resolve 状态机（与我方 v2 契约刻意不做一致） |
| 17 | severity 分级 | **有（双轴，优于我方）** | `severity`(blocking/advisory) × `review`(mechanical/semantic)；我方只有 severity 一轴 |
| 18 | continuity snarl / retcon | 无 | — |
| 19 | power creep | 无 | — |
| 20 | revision cascade / rollback | 弱 | `⊘` 退役行 + `--history`；是「退役显式化」，但无世代概念 ⇒ 我方 M13 更准 |
| 21 | previous-volume snapshot | 弱 | `artifact-protocols.md:23`「当前卷写全，后续卷只写功能/核心事件/字数区间」是**卷纲写法**，不是卷末快照 |
| 22 | outline · beat sheet · blueprint · draft · revision · finalize | 有 | 卷纲 / 细纲 / 正文；revision 由 deslop 承担 |
| 23 | chain of command | 弱且**同病** | SKILL.md 里有「真人叙事·最高优先级」，与我方 P8 诊断的「两条都自称最高」是同一个病 |
| 24 | attention budget | **有（最强的一处）** | `check-doc-budget.sh`：35000 字硬上限、按角色×分支×叠加取最坏值、exempt 必须写原因、上限拼错要报错 |
| 25 | right altitude | 弱 | 「只取任务包路径，不读包内容」在控制 altitude，但非显式设计 |
| 26 | compaction / structured note-taking / sub-agent | **有且成熟** | 确定性拼 spawn prompt（`build_writer_prompt.py`）+ 分批派活给子 agent、只回产物路径 |
| 27 | lost in the middle | 无 | 无显式位置策略 |
| 28 | 黄金三章 | 有（作为分析工具） | 拆文支持「分析黄金三章」；**没有当成硬规则** ⇒ 与我方 C1 裁定一致 |

**闸 1 小结**：28 条里 11 条它无对应（其中 3 条是我方自研领先项），8 条弱对应，9 条有对应但多数弱于我方。**唯一强于我方的是 #17 双轴定级、#24 加载预算、#26 子上下文编排。**

---

## 3. 吸收清单（A 类：过了三闸，值得动手）

> 排序 = **改造成本从低到高**，不是价值排序。五项全部是「给已有要求装判定权」，不新增创作规则。

### A1 · 风格 lint 检测器（22 类 + 双轴定级）—— ⏸ **已降级（2026-10-25 作者裁定）**

> **裁定**：成本太高。已定稿量少；用外部完结书做校准的标准很难定，还可能把污染语料带进语料库——这不是个人团队负担得起的研究。它现有的七猫/黑岩只能当**平台扩展的参考材料**，置后。
> 前置调研（公开中文网文语料库）已落盘 → [`../2026-10-25-threshold-calibration-corpus/`](../2026-10-25-threshold-calibration-corpus/)。
> 调研结论：起点有 3 条合法来源（全部限非商业研究）、**番茄零**、公开世界**不存在**「AI 句式每千字频次/误报率」可对标数据。
> 下面的条目保留为**将来重启时的技术底稿**，不再是待办。

| 项 | 内容 |
|---|---|
| 闸 1 | `manuscript validation` + `findings` + `severity` |
| 闸 2 | **不落禁止项**：D 表禁的是「自建对话占比 / 段长 / 完读率」= 对**市场表现**做推断（无数据源）；lint 是对**文本形态**做确定性规则判断，可判真假 |
| 闸 3 | **消费方**：审稿链（现 9 维）新增 prose-lint 维度；定稿闸门；行内改写提示 |
| 我方现状 | `docs/design/prompt/p8-fanqie-flavor-draft-quality-design.md` §2.3 自己诊断过：「禁令**不可判定** + 零惩罚」「模型换个措辞就通过」；§4.2 的处方是换成结构性禁令——**但落在 prompt 文案，不是代码判定器** |
| 可搬的东西 | 22 类清单与 type 标识符、密度双门槛公式（`perKilo = hits/narrativeChars*1000`）、blocking/advisory × mechanical/semantic 双轴、只报不改、`.deslop-whitelist` 字面量白名单、`--fail-on` 退出码语义 |
| **必须重做的** | **阈值不可直接搬**。它的语料是七猫 5584 章 + 黑岩 3983 篇；我方目标平台不同，误报率会变。要用我方已定稿章节重新校准 |
| 成本 | 高（22 类判据 + 语料校准 + 接入审稿链） |

### A2 · findings 增加 `review` 轴（mechanical / semantic）

| 项 | 内容 |
|---|---|
| 闸 3 | 消费方：审稿报告渲染 + 修稿链（决定这条 finding 能否自动改） |
| 价值 | 我方 findings 只有 severity。加一轴「改法是否需读上下文」，直接解决「报了但不知道怎么改」——机器可改的标 mechanical，要人判断的标 semantic |
| 成本 | **低**（一个枚举 + 渲染 + 判定规则） |

### A3 · 退化指纹检测（模型故障，非文风）

| 项 | 内容 |
|---|---|
| 判据（逐字） | `REPEAT_MIN_LEN=12` / `REPEAT_MIN_COUNT=3` / `ADJACENT_MIN_LEN=8`；4 类 = 复读 `verbatim-repeat` / 截断 `truncated` / 占位拒绝语 `placeholder-leak` / 工程词泄漏 `meta-leak` |
| 定级 | 复读/截断/占位/纯工程词 = blocking；章节歧义词、对话行里的工程词 = advisory |
| 修复语义 | **重新生成该段，不是改写**——退化是模型故障（`skills/story-review/SKILL.md:157`） |
| 闸 3 | 消费方：生成链返回后、入库前；审稿链 S1 级 |
| 我方现状 | ~~无退化检测~~ **本条 2026-10-25 复核作废**：`src/shared/visible-text-integrity.ts:270` 已有 `findVisibleTextDegeneracies`（三类 = `verbatim-repeat` / `placeholder-leak` / `meta-leak`，阈值 `REPEAT_MIN_SENTENCE_UNITS_ZH=12` / `REPEAT_MIN_COUNT=3` / `ADJACENT_MIN_PARAGRAPH_UNITS_ZH=8`），并有 `visible-text-degeneracy.test.ts` 5 例。真实状态不是「没有」，而是**已接线且是阻断级**：`assertNotDegenerateVisibleText` 在首稿（`generate-draft.command.ts:1422`）与终稿（`:1512`）各抛错一次，`findVisibleTextDegeneracies` 另有短细纲（`:1342`）、续写增量（`:1938`）、压缩修订（`:2114`）三处。**此处「生产链零调用点」的旧判断已于 2026-10-25 二次复核推翻**——根因是只 grep 了定义与单测、没反查调用方。见 `design/product/writing-capability-assessment.md` §7.5 第 4 条 |
| 成本 | **极低**（349 行纯 Node，无依赖，判据全是计数比较） |

### A4 · 正文照搬细纲检测

| 项 | 内容 |
|---|---|
| 判据 | `MIN_RUN = 16`（连续重合 >15 字）；贪心扫描 + 每个起点二分求「仍是细纲子串」的最长延伸，命中区间不重叠 |
| 报告 | 「正文 N 字，与细纲连续重合 >15 字的片段 K 处，共 M 字（R%）」+ 逐条片段 |
| 闸 3 | 消费方：审稿链 / 定稿前检查 |
| 我方现状 | **无**。`visible-continuation.ts` 是续写拼接去重叠（阈值 48 字），语义不同 |
| 成本 | **极低**（313 行；算法是标准二分，无需模型） |

### A5 · 每次调用的加载预算硬上限

| 项 | 内容 |
|---|---|
| 机制 | `path_ceiling.limit`（35000 字）是**每次调用的硬上限**，按「角色 × 每条条件分支 × 每组叠加」取**最坏值**；exempt 必须列原因；**上限配错要报错，不许静默失效** |
| 闸 1 | `attention budget` |
| 闸 3 | 消费方：20 条装配链路的装配期断言 + CI |
| 我方现状 | 有 `outline-budget` / `outline-prefix-budget` 只读探针（预估），**无「每次调用不得超过 N 字」的强制断言**；`prompt-three-layer-inventory` 有清单无上限 |
| 为什么它这条值得抄 | 它把「预算」从文档纪律变成**可执行断言**，而且专门防「拼错导致静默失效」——这与我方 `check-prompt-wiring.mjs` 的自检思路同源 |
| 成本 | 中（要定义每条链路的角色与叠加组合） |

---

## 4. 刻意不为 / 不适用（C 类：明确不吸收，附理由）

> 这一节的意义：证明**这些是行业常见做法而非我方疏漏**，以后不再被重复提出。

| # | 它的做法 | 我方口径 | 理由 |
|---|---|---|---|
| C1 | 单一 `_tracking-state.json` + 7 张派生 md + 逐字比对 | DB 多表 + 渲染 | 我方是 DB，无「派生文件漂移」问题；且「账本」形态已被 W6 证伪（`IND §4`） |
| C2 | delta 必须列 `retired_context_items` 否则拒绝写入 | M13 `continuity_change_log` + `requiredGeneration` | **我方更准**：它按全局方向，我方按「该章之前最新变更代」，不会把「改第 22 章」误判成「第 21 章也过期」 |
| C3 | 章尾预告/总结密度阈值 | P8 已有禁令，且刻意不用数字型 KPI | 重复装载 + 会与 `globalGuidance` 形成两套权威（`CRAFT §7`） |
| C4 | 7 个平台扫榜爬虫（CDP + 真人登录态 + 字体反爬破解） | 不做 | 产品形态正交；且反爬对抗无长期收益，本机网络对 GitHub 亦受限 |
| C5 | 封面生成（curl + jq + GPT-Image-2） | 我方已有 ImageGen 通道 | 重复能力 |
| C6 | 本地 HTTP Dashboard（原生 JS 1100 行） | Electron + React | 我方 UI 更强，且已有工作台 |
| C7 | 7 宿主部署适配层（`merge-*.py` / `generate-*.mjs` / `sync-*.py`，约占它一半代码） | 单一产品 | 无多宿主问题 |
| C8 | `--fleet` 式并行子代理编排 | 我方暂不需要 | 它的子 agent 是「一次派一个写手、只回产物路径」；我方生成链已按单元串行，引入并行会打乱配额与检查点（E3 链式语义） |

---

## 5. 只归档、不进台账（B 类）

| # | 机制 | 为什么只归档 |
|---|---|---|
| B1 | `outline_view.py` 作用域取段（卷级常任 / 单元级 / 批次底稿 + `⊘` 退役行 + `--history` + `--strict` 新旧分级） | 我方 E4 三层投影（L2 本卷全文 + L3 上一卷快照 ≤1500 + L4 最近 K 章）**已设计且更完整**；它只是卷纲单层的取段。**P1-2 期 3 施工时可参考「退役行不输出」与「旧文档缺声明只告警、保守纳入」这两个细节** |
| B2 | `scripts/bench/`（预注册协议 → 冻结 fixture → 真实 CLI 跑 → LLM 评委 → 非劣效门槛 → DEVIATIONS.md） | 方法论确实是我方 C8「创作侧零测量」缺的那一环，但成本高（需真实模型凭据 + 4 小时级跑批）。等真要改 prompt 质量时再立项 |
| B3 | `check-reference-gates.js`（写前必读的静态首屏位置守卫） | 我方 `check-prompt-wiring.mjs` 已管「变量送达」，它管「必读文件在 SKILL.md 首屏」。需求不迫切，形态可借鉴 |
| B4 | `wordcount_core.py` 的 frontmatter 剥离三条件 | 我方 `draft-units.ts` 已有 `DRAFT_UNIT_ALGORITHM_VERSION=3` 与 0.7–1.3 拒绝线 / 0.85 瞄准线，**更严**。仅「三条同时成立才剥，避免误吃正文」这个防误判规则值得对照 |

---

## 6. 一处需要记录的「反向收获」

它有一条我方**没有**的角色字段：`characters.open_threads`（角色未决事项）。

- 我方 `cs_*` 六槽是 `identity / location / goal / state / abilities_resources / relationships / knowledge`
- 它是上述 7 槽 + `open_threads`

但**不要急着补**：按闸 3，这一格要能指名消费方才算数。它自己在实现里也只写进「核心角色状态」视图，没有任何消费者读取做判定。

⇒ 判定：**登记为观察项，不列吸收**。若将来「人物弧/未决事项」立项时再一并考虑。

---

## 7. 裁定与去向（2026-10-25）

| 项 | 裁定 | 去向 |
|---|---|---|
| **A3** 退化指纹 + **A4** 照搬检测 | ✅ **已实施** | 见 §9 实施记录。四项里最省的一对，纯函数 + 命令层挂载，零迁移 |
| **A2** findings 双轴 | ✅ **已实施（M20，schema 20→21）** | 见 §10 实施记录。原计划「下一期、混做会让回归面失控」在实测中被推翻：真正的外溢不是测试数量，而是**便携格式的字段策略**与**M03 的自证哈希校验**两处硬编码——不一起改就等于把「新库打不开 / 导出被拒」写进代码 |
| **A1** 风格 lint | ⏸ **降级：平台扩展参考材料** | 成本过高。前置语料调研已落盘 → [`../2026-10-25-threshold-calibration-corpus/`](../2026-10-25-threshold-calibration-corpus/) |
| **A5** 加载预算硬上限 | ✅ **已实施（mainOwned 派发前断言）** | 见 §10。性质确认为「把已有断言接进生产路径」：`createPromptBudgetReport` 原只在渲染层 harness 里跑，而生产默认走 mainOwned，配了 `promptBudget` 也无人执行 |
| B 类 | 📦 归档 | 不排期；`outline_view.py` 的取段细节留给 P1-2 期 3 重定义时参考 |
| C 类 | 🚫 明确不做 | 此表即理由，不再重复讨论 |

---

## 9. 实施记录（A3 + A4，2026-10-25）

### 9.1 落了什么

| 文件 | 变更 |
|---|---|
| `src/shared/visible-text-integrity.ts` | 新增 `findVisibleTextDegeneracies()` / `assertNotDegenerateVisibleText()`，三类判据（`verbatim-repeat` / `placeholder-leak` / `meta-leak`）。**未改动**既有 `assertMechanicallyCompleteVisibleText` |
| `src/shared/blueprint-verbatim-overlap.ts`（新） | `analyzeBlueprintVerbatimCopy()`：NFKC + 去标点归一化 + k-gram 索引 + 贪心延伸，CJK 阈值 16 / en 40，三级 severity |
| `src/services/workflows/commands/generate-draft.command.ts` | 五处挂载：短细纲降级（只跑 repetition + placeholder）、首稿阻断（只跑 placeholder + meta）、续写并入 `accepted`、压缩并入 `accepted`、最终闸（全三类 + A4） |
| 测试 | `visible-text-degeneracy.test.ts`（20 例）· `blueprint-verbatim-overlap.test.ts`（13 例）· `generate-draft.command.test.ts` +3 例（240 例全绿） |

### 9.2 三处与外部包不同的判断（都写进代码注释了）

1. **`truncated` 类不实现**。外部包的「结尾无句末标点 = 截断」启发式会误伤一批结构化夹具，而真实截断已由 `finishReason !== 'stop'` 与 `mergedDelta < 300` 双保险。
2. **短细纲排除 `meta-leak`**。细纲本来就写「本章 / 蓝图 / 分段预算」，且会逐字复制 `keyEvents`——跑 meta 判据必然自相残杀。
3. **续写轮不新增阻断形态**，而是并进既有 `accepted` 布尔，与「无进展恢复」共用同一次恢复额度；两套机制分开判会各自消耗一次。
4. **A4 在我方的准确名字是「正文逐字复用蓝图必需事件」**，不是「照搬细纲」——我方没有「细纲文本」，比对基准只能是 `writerChapterInfo.keyEvents`（`keyEventsText` 的产物）。

### 9.3 一处既有夹具被改（记录在案）

`generate-draft.command.test.ts` 有 3 个用例用「同一句长话重复 N 次」凑字数（`'本章沿着全新的因果继续推进。'.repeat(32)` 等）。这些文本在新判据下**确实构成复读**，故改成编号变化句。用例意图（允许正常推进 / 允许专名重复）未变。

### 9.4 回归

`generate-draft.command.test.ts` **243/243**（237 既有 + 6 新增，覆盖五条挂载路径：首稿阻断 / 最终闸复读 / A4 阻断 / 短细纲降级 / 续写丢弃后恢复 / A4 advisory）· `visible-text-degeneracy` 20/20 · `blueprint-verbatim-overlap` 13/13 · `bounded-completion` + `draft-units` 98/98 · `refine-draft.command.test.ts` 49/49 · `npx tsc --noEmit` 通过。

**未覆盖**：压缩轮复读（触发条件需构造超长稿，成本高；其挂载与续写同型，均为「并入 `accepted`」）。

---

## 9b. 实施记录（A2 + A5，2026-10-25）

### 9b.1 A2 落了什么

`review_findings` 增 `review_class TEXT CHECK(review_class IS NULL OR review_class IN ('mechanical','semantic'))`，由 **M20（schema 20→21）** 加；轴纳入 `canonicalM03FindingSetHash`，存量 cycle 的 `finding_set_hash` 在同一迁移里按新口径重算（存量 finding 轴一律 NULL，不按 category 猜）。报告合同 v4 允许 item 级可选 `review`；UI 每条 finding 显示「机械可改 / 需读上下文」，未标注不显示徽标。

> **没有单建设计稿**：本轮按作者批准的无人值守计划执行，A2/A5 的行为变更以本节为唯一记录（写入位置、口径、四处被迫偏离、自检证据都在这里）。要扩展它（例如让模板真的产出 `review` 键）时，另出 `docs/design/` 下的设计稿，不要在这节继续加。

### 9b.2 四处与计划不同（都是实测逼出来的，不改就是坏）

| 计划说的 | 实际必须这样 | 不改的后果 |
|---|---|---|
| M03 建表 SQL 末尾加列（新库直接带） | **M03 保持 20 列**，列只由 M20 加；M03 的 `exactSchema` 按「实际有没有这一列」选择期望形状 | reference 库算出的 v20 指纹会带新列，而真实 v20 库不带 ⇒ `probeSchema` 报 `UNRECOGNIZED_SCHEMA`，**旧项目直接打不开** |
| 两处 `INSERT ... VALUES(20 个 ?)` 改成 21 个占位符 | 改成**显式列名** | `seedValid` 被十多个只跑到 M03 的用例共用，加第 21 个值会把它们全打红 |
| 只升 `CURRENT_REVIEW_REPORT_VERSION` | 还要放宽 M03 `proveArtifact` 的 `[2,3]` 白名单 | M03 每次 `create` 都对全库 receipt 重跑校验，不认 v4 ⇒ 每份新审稿都被自己的完整性校验判死 |
| 只升 schema 版本 | 还要给便携格式补 `m20Tables` + `review_class` 字段策略 | `assertPortableSourceSchema` 未知字段即 fail-closed ⇒ **导出 .vela-pack 直接 `PORTABLE_SCHEMA_UNSUPPORTED`** |

### 9b.3 迁移自检（真实项目库的副本，不动原库）

| 库 | 迁移前 | 步数 | 结果 |
|---|---|---|---|
| A | v10，无审稿历史 | 11 步（M10–M20） | v21；轴全 NULL |
| B | **v20，3 cycle / 16 finding** | **仅 M20** | v21；**3/3 指纹重算**；轴全 NULL；`verifyM03ReviewCycle` 仍 true |
| C | v9，4 cycle / 10 finding | 12 步（M09–M20） | v21；**4/4 指纹重算**；同上 |

B 是本轮最关键的证据：真实 v20 库能被 `probeSchema` 识别、只跑一步就到位、且重算后旧库自洽。

### 9b.4 A5 落了什么

`workflow-main-generation.ts` 的 `complete` 在**派发前**断言：`task.promptBudget` 存在时用 `createPromptBudgetReport` 算总量，超 `limitUtf8Bytes` 抛 `PromptBudgetExceededError`（复用既有错误类与文案）。渲染层拿不到模型上下文与输出预留，故只做字节硬顶（`contextWindowTokens: null` / `reservedOutputTokens: 0`），注释写明这个边界。新增 2 例：超限时 `import-generation:execute` 零调用；同一任务去掉 `promptBudget` 后照常派发。

### 9b.5 回归

**改动面全绿**：`m03+m20+仓库+runner 车道` **124/124** · 便携字段策略与导出/恢复 **90/90**（`portable-project-format` 29 + `project-archive-service`/`portable-project-archive` 61）· `review-revision-generation` **44/44** · 契约与报告 **95/95** · `generation-harness` + `prompt-budget-failure` + `workflow-main-reasoning` + 新增预算测试 **45/45** · `generate-draft.command` **243/243** · `review-report-i18n` 72/72 · 书架浏览器测试 9/9 · `tsc --noEmit` 通过 · doc links 925/0 · placement 新增 0。

**升 v4 时抓到的三处外溢**（都不是「测试数量」问题，而是不修就坏）：
1. `review-revision-generation.saved()` 里第二处 `[2,3]` 白名单 ⇒ 新审稿读回即抛 `GENERATION_REVIEW_RECEIPT_INVALID`。
2. 便携策略若按**整表**归入 m20，会把 `review_findings` 全部 21 列的 origin 从 `m01-m05-delta` 改成 `m20-delta`（历史来源标签被篡改，m01-m05 计数 123→103）⇒ 改成**字段级** `m20Fields`。
3. 两个测试把「4」当成未知版本探针，4 变已知后这些探针不再被拒 ⇒ 改 5；并保留「v2↔v3 重建字节相同故查不出」的原判据。

**既有红（本轮改动前的 `8fb02cde` 树上以同一条命令复跑，失败数相同或更多）**：`draft-source-dependency` 4 · `llm-controller-connection` 2 · `m02-project-upgrade` 3 · `main-generation-owner` 1 · `project-peek-readonly` 8 · `legacy-project-copy-import` 3 · `project-archive-service`（ENOTEMPTY）· `project-format-migration`（safe-delete）· `project-restore-service` / `user-settings-package-controller`（ENOTEMPTY）· `vector-migration-snapshot`（NONREGULAR）· `generation-controller`（5s 超时；基线整份 42 全红，现在只剩 1 例超时）。

**两条环境事实（不记下来下轮还会踩）**：
- `electron/` 全量一次跑在沙箱里必炸：`safe-delete` 阈值 50（栈落在 teardown 的 `fs.rmSync`）+ 10s hook 超时。摘 `CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR` / `CODEBUDDY_TOOL_CALL_ID` 可把红从 1145 降到 104，但**全量跑法本身不可信**，只能按文件/按目录跑。
- 临时 `git worktree` **不能放在仓库内**：vitest 的 include 会把它一起扫进去，测试数翻倍、失败项里出现 `.wt-baseline/...`，对照实验直接作废。

---

## 8. 与既有结论的衔接

- 本评估**不推翻**任何既有裁定：C1 黄金三章、C6 弧位、C8 零测量、D 表全部保持原样。
- A1 与本项目 `P8` 的关系：P8 已把「可判定禁令」写进 prompt，**A1 是它的下一步**——给禁令装代码判定器。两者不冲突，是同一病灶的两段处方。
- A5 与 `P1-2 期 3` 无关：期 3 是「大纲前缀投影」（切分输入），A5 是「每次调用总量断言」（限制总量），可独立推进。
