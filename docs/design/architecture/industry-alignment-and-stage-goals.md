# 行业对齐：先有标准，再谈目标（W7 / W8 / S×5 目标重定）

> **准则（2026-10-23 作者定，硬性）**：**先查行业定义，明确标准；不自己创造概念，不自己制造标准。**
> 这条不是文风要求，是防止返工白做的工程纪律 —— 下面第一节就是它的成本证明。
> **三阶段目标已按行业术语重定**（§3）。**W6 那套「权威值 → 变动 → 纯算术 → 中断 → 注入」的形状已被废除**，
> S×5 **不得照抄**（那正是作者担心的"再次返工白做"）。

---

## 1. 为什么会跑偏：一次复盘

W6 资源账本：建表、逐章抽取变动、纯函数累加余额、三态、中断语义、走势图、按章回填。跑通了，然后被下线。

**根因不是实现，是我对"小说创作"的理解错位**：

- 作者当初的问题是**一致性**（第 2–4 章「十二时辰换十枚灵石」「药钱占五分之一」各写各的）；
- 我把它实现成了**会计**（余额累加、账要平）；
- 判据本来就在手边却没用：**行业里把这类问题叫 continuity（连续性）**，处理它的工具叫 **story bible**，
  而"数量矛盾"只是 continuity error 里的**一个子类**（见 §2）。

**四条硬证据**（都是可查的行业/学术共识，不是我推导的）：

1. Story bible 的定义是「单一事实源」，**目的是消除 continuity errors**，且**随写随更**，不是事后补账
   （[WriteLoom](https://writeloom.app/knowledge/definitions-and-industry-terms/what-is-a-story-bible)、
   [Atmosphere Press](https://atmospherepress.com/?p=49552)、[Writing Mastery](https://www.writingmastery.com/blog/what-is-a-story-bible)）。
2. 学术基准 **ConStory-Bench**（《Lost in Stories: Consistency Bugs in Long Story Generation by LLMs》）
   把长文一致性错误分成 **5 大类 19 子类**：时间线与情节逻辑 / 人物塑造 / 世界观与设定 / **事实与细节** / 叙事与风格。
   **"数量矛盾"（numerical contradictions，"five knights" → "three"）只是「事实与细节」下的一个子类**
   （[mllog.dev 摘述](https://mllog.dev/en/posts/constory-consistency-bugs-long-stories-llm)、
   [alphaXiv 中译](https://www.alphaxiv.org/zh/abs/2603.05890)）。
3. 商业产品（[Loreon](https://loreon.ink/features/manuscript-validation)、
   [PlotLens](https://plotlens.ai/solutions/continuity-checker)）的形态是：**story bible 作 canon → 检查产出 findings
   （带引文、位置、严重度、类别）→ 作者 resolve / dismiss，工具不自动改写**。
4. 修真文经济崩盘的通行解释是**供给失控与数值膨胀**，不是"作者没记账"
   （[修真小说里的"灵石"经济体系为何总崩盘](https://post.smzdm.com/p/anvkddr0)）。

**一句话**：我造了一个"账本"概念去解决一个行业里早有名字（continuity）的问题，还顺便发明了一套形状当模板。

---

## 2. 行业里这些事叫什么（术语对照，写设计稿必须用右侧的词）

| 我们原来叫 | 行业标准名 | 说明 / 出处 |
|---|---|---|
| 世界状态、六槽 | **continuity**（连续性）/ **story bible 的分区** | story bible 的标准分节：角色 / 地点 / 时间线 / 世界规则 / 术语表 / 未回收线索 |
| 资源账本、余额 | **numerical contradictions**（数量矛盾）—— continuity error 的一个子类 | ConStory-Bench「事实与细节」类；判定方式是**两处陈述不能同时为真**，不是累加相等 |
| 伏笔池、未回收伏笔 | **plot promises / unresolved threads / abandoned threads** | story bible 的 "Plot Promises and Resolutions" 节；ConStory-Bench 的 abandoned threads |
| 前置注入（W7） | **consult the bible before writing**（写前查阅）/ context assembly | 作者在写某场戏前先查 bible 核对细节，是行业常规动作 |
| 跨部切片（W8） | **series bible 交接 / lock canon before book two** | 系列写作的标准做法：下一部开工前先锁定上一部的 canon |
| 审稿 | **manuscript validation / continuity check** | Loreon 的 "manuscript validation"；输出 findings 而非改写 |
| 判据 CJ「不给结论」 | **findings + resolve / dismiss**（编辑权留在作者） | Loreon：「You resolve it or dismiss it, and nothing changes without you」 |
| 判据 DL「体检不进矛盾计数」 | **severity 分级**（High / Low），不阻断 | Loreon 的 finding 带 severity，Low 只是提示 |
| 我们说的"吃书" | **continuity snarl**；近亲 **retcon** | 中文圈"吃书"= 前后设定冲突；retcon 是"事后补充改写"，两者不同 |
| "写崩了"的数值 | **power creep / 战斗力膨胀**（网文常用） | 与数值膨胀同源，属**设计**问题，不是记账问题 |

> **注意一个反直觉结论**：我们的判据 CJ（不给结论）、DL（体检不进矛盾计数）**本来就是行业最佳实践**，
> 只是当时没找到名字。**有名字的价值**：以后遇到"要不要自动改正文"，不用重新吵一遍——行业已经回答了。

---

## 3. 三阶段目标（重定）

### 3.1 W7 —— 写前查阅（consult the bible），不是"注入状态数值"

**问题**：模型写第 N 章时，手里没有"读者已经知道、本章必须遵守"的事实，于是自己编一个。

**行业名**：consult the bible before writing a scene / context assembly。

| 项 | 内容 |
|---|---|
| **目标** | 写作第 N 章前，把**本章会用到、且可在前文找到出处**的事实放进上下文 |
| **注入什么** | 角色档案（含信息流：谁知道什么）、世界规则、未回收线索、本章相关的地点与时间锚点 |
| **绝不注入** | 任何**派生数值**：余额、累计库存、统计量、推算值 —— 它们不是"读者读到的事实"，而是系统算出来的推论 |
| **判据** | 注入的每一条都必须带**前文出处**（章号 + 逐字引文）；找不到出处的条目不进上下文 |
| **失败形态** | 注入失败不阻断生成（与 industry 的 "Low severity" 一致），但要在编辑面留一条可 dismiss 的提示 |
| **明确不做** | 不做"本章应该有多少钱/多少兵力"这类算术结论；不做全量 bible 塞入（上下文有预算） |

> 与旧目标的差别：旧稿 §1 的注入清单**第一条就是「资源余额」** —— 那条删掉，其余条目保留并补出处要求。

### 3.2 W8 —— 系列圣经交接（series bible handoff），不是"带状态切片"

**问题**：下一部开写时，读者已经知道的事（角色终态、已立的规则、没填的坑）必须延续，否则第一句就撒谎。

**行业名**：series bible 交接 / lock canon before book two。

| 项 | 内容 |
|---|---|
| **目标** | 下一部开工前，把上一部的 **canon 锁定并交接** |
| **交接内容** | story bible 六节：角色终态 · 地点与地理 · 时间线 · 世界规则 · 术语表 · 未回收线索（plot promises） |
| **数量怎么传** | **只传口径与量级**（"下品灵石是月例单位，约十枚/月，买一副药六枚"），**不传余额** |
| **判据** | 新书第 1 章引用任一交接事实时，与前作不冲突；无法核对来源的条目显式标为"作者手写" |
| **明确不做** | 多图往返 / `region_id` / 焦点切换（见 `w8-nested-world-handoff-design.md` §1，仍是线性流） |

### 3.3 S×5 —— 五类（实为六类）连续性错误的预防，不是"五本账"

**问题**：长文里事实会漂移，且**错误随长度线性增长**（ConStory-Bench 的 CED 指标）。

**行业名**：continuity error 的分类预防 + findings。

**分类以 ConStory-Bench 为准，不自己划**：

| 我们要做的 | 行业类别（ConStory-Bench 子类） | 交付物 |
|---|---|---|
| 时间 | 时间线与情节逻辑：绝对时间矛盾、时长矛盾、同时性、果先于因、因果断裂 | timeline 分区 + 一类 findings |
| 人物 | 人物塑造：记忆矛盾、**知识矛盾（谁知道什么）**、技能波动、被遗忘的能力 | 角色档案 + **信息流**分区 + findings |
| 能力 | 同上的 forgotten abilities / skill fluctuations | 金手指与能力清单（**补宿体**，见 W8 §2） |
| 制度 | 世界观与设定：规则违背、社会规范违背 | 世界规则分区 |
| 空间 | 世界观与设定：地理矛盾 | 地点与地理分区 |
| **物品** | **possession and object continuity**（物品在谁手里、带没带） | 关键物品清单（原"六槽"漏了这一格，W6 §6.1 已承认是真空） |
| 数量 | 事实与细节：**numerical contradictions** | **已证明不需要账本**（W6 下线，ADR-0022） |

**每格的交付物统一为**：**一个 story bible 分区 + 一类 findings（带引文与位置，作者 resolve/dismiss）**。

> **★ 废除旧模板**：原 S×5 写的是「**共用 W6 的形状**（权威值 → 变动 → 纯算术 → 中断 → 注入）」——
> 那个形状已经被证明是错的目标（§1）。**S×5 不得照抄**，否则等于把同一个错误复制五遍。
> 取而代之的是上表：**分区（事实）+ findings（矛盾）**，不做账、不做余额、不做中断语义。

---

## 4. 旧目标里被推翻的条目（明确作废，别再引用）

| 旧表述 | 状态 |
|---|---|
| S×5「共用 W6 的形状」 | ❌ **作废**。W6 形状本身是错的目标（ADR-0022） |
| W7 注入清单「资源余额」 | ❌ **删除**。派生数值不进上下文 |
| 「六槽」这个命名 | ⚠️ 改为 continuity 的维度，并**补上"物品"**（原六槽漏了 possession continuity） |
| 「账本余额三态 / 中断 / 走势」作为写作约束 | ❌ 下线（代码保留） |
| 「世界状态闭环 = 权威值→变动→算术→中断→注入」 | ❌ 作废。闭环应是 **查阅 → 写 → 校验（findings）→ 回写 bible** |

---

## 5. 执行清单：写任何设计稿之前先回答这四问

1. **这件事在行业里叫什么？** 给出英文或中文的**标准名 + 出处**（论文/产品文档/术语表）。给不出 ⇒ 先别立项，去查。
2. **谁消费它的产出？** 如果答案是"只有一块展示面板"，停 —— 那就是 W6 的死法。
3. **它的失败形态在行业分类里属哪一类？** 对不上任何一类 ⇒ 大概率是我在自造问题。
4. **有没有成熟产品/论文已经做过？** 我们与它的差异是什么？差异必须是**需求差异**，不能是"我想换个做法"。

**禁止事项**：自造术语当标准用；把"我觉得应该"写成"设计原则"；用编号（W1–W8 / S×5）替代定义 ——
编号只能是索引，**定义必须指向行业概念**。

---

## 6. 来源

- Story bible 定义与分节：WriteLoom（[定义](https://writeloom.app/knowledge/definitions-and-industry-terms/what-is-a-story-bible)、
  [实操](https://writeloom.app/knowledge/book-planning-and-story-development/what-is-a-story-bible)）、
  [Writing Mastery](https://www.writingmastery.com/blog/what-is-a-story-bible)、
  [Atmosphere Press](https://atmospherepress.com/?p=49552)、
  [StoryBible.pro（系列连续性）](https://storybible.pro/crafting-a-compelling-book-series-planning-and-continuity/)
- 一致性错误分类（学术）：《Lost in Stories: Consistency Bugs in Long Story Generation by LLMs》
  （[mllog.dev](https://mllog.dev/en/posts/constory-consistency-bugs-long-stories-llm) ·
  [alphaXiv 中译](https://www.alphaxiv.org/zh/abs/2603.05890)），5 大类 19 子类 + CED 指标
- 产品形态（findings / resolve-dismiss）：[Loreon manuscript validation](https://loreon.ink/features/manuscript-validation)、
  [PlotLens continuity checker](https://plotlens.ai/solutions/continuity-checker)
- continuity 问题分类（工程视角）：[Codartium continuity problem diagnosis](https://www.codartium.com/continuity-problem-diagnosis-in-novel-writing)
- 中文圈术语："吃书"（[萌娘百科](https://moegirl.icu/%E5%90%83%E4%B9%A6)、[百度百科](https://baike.baidu.com/item/%E5%90%83%E4%B9%A6)）
- 修真文经济崩盘成因：[灵石经济体系为何总崩盘](https://post.smzdm.com/p/anvkddr0)
