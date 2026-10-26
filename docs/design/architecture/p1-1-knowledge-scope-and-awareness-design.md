# P1-1 增补 · 知情粒度（评估结论：**不做扩展**）

> **状态**：❌ **撤回原方案**（2026-10-26，作者裁定 + 行业证据）；✅ **§5 断链与 §6 墙 3 已修**（同日）。
> 原三期方案（期 1 全集 + 差集 · 期 2 程度 · 期 3 势力层）**全部不做**。
> 本文保留，是因为三件事仍有价值：① M16 的形状限制是**事实**（§3）；② 行业对照有长期参考价值（§2）；
> ③ §5 那个断链是**真缺陷**，与本次裁定无关，应单独修。

---

## 1. 作者的裁定

> 「关于知情机制我们只管事关主线极度机密的事吧，正常来说全书都不一定能用到几回，不应该如此复杂的，可能我和你都跑偏了。」

**判断成立。** 上一稿把 M16 往「通用知识图谱 + 认知模态」推：对所有人 × 所有事实做登记，
再加全集、差集、程度、势力层。这是工程自洽，但**写作实践里没有对应需求**。
行业数据是「3 行示例」，设计出来的却是支撑 300 行的机制。

---

## 2. 行业怎么做（5 个来源，同一结论）

| 来源 | 原话 / 模板 |
|---|---|
| [Novelium](https://novelium.com/blog/how-to-write-a-series-bible) | 「**stop trying to document everything. Track the load-bearing facts.**」角色台账按章记**增量**（Chapter 5 learns X），不是三元组表 |
| [AuthorFlows](https://www.authorflows.com/blogs/how-to-create-a-story-bible) | 正式的 "Who knows what" 表，四列 `Fact ｜ Who knows ｜ Who does not ｜ Revealed`。**示例只有 3 行**；并建议「delete what you do not need」 |
| [Funny Face Fiction](https://funnyfacefiction.com/series-bible/) | 「Secrets, Clues, and Reveals」：秘密 / 谁知道 / 谁不知道 / 读者何时知道 / 每个角色何时知道 / 线索 / **假线索** / 何时真相大白。明确限定「especially useful for **mysteries, thrillers, fantasy, and twist-heavy** stories」 |
| [aibookcraft](https://aibookcraft.app/blog/story-bible-template) | 「You do not need to inventory every cup in a kitchen」——只记会改变角色选项的东西 |
| [StudyRaid](https://app.studyraid.com/en/read/95851/4332555/managing-information-revelation-and-mystery) | 「Mystery Matrix」= **每个秘密**一行，记录何时向读者揭晓。是账本，但不是全量账本 |

**三条共识**：

1. **只记承重事实**（load-bearing），不做全量；
2. **没有任何模板有「知道程度」列** —— 全是「谁知道 / 谁不知道 / 何时揭晓」；
3. 「谁知道什么」这一节**只对悬念型故事存在**（mystery / thriller / twist-heavy）。
   普通种田文、日常流根本不建这张表。

### 2.1 唯一被提到的"等级"是另一根轴

Funny Face Fiction 说「keep different levels of knowledge separate」，例子是：
**作者一开始就知道反派是主角的叔叔；主角不知道；读者可能中途开始怀疑。**
它称之为「three different timelines」—— 这是**作者 / 读者 / 角色**三方之间的信息差（dramatic irony），
**不是**「听说 → 确信」这种模态分级。

这个区别很重要：上一稿的 `witnessed / told / heard / suspects` 四种值，在行业模板里**一个都不存在**。
因为它们回答的是「他把握有多大」，而写作要问的是「他到底知不知道，以及读者什么时候知道」。

---

## 3. 保留的事实：M16 的三道墙（结论不变，定位变了）

| # | 事实 | 出处 |
|---|---|---|
| 墙 1 | `character_id TEXT NOT NULL REFERENCES characters(character_id)` —— 群体不是实体 | `m16-knowledge-states.ts:41` |
| 墙 2 | 无「程度」列，只有 `learned_chapter` | `knowledge-state.ts:64-87` |
| 墙 3 | `KNOWLEDGE_MAX_ITEMS = 6` + `slice(0, 6)` **按行切**，叠加节首封闭默认 ⇒ 被裁掉的人被**明确告知为不知道** | `knowledge-state.ts:132`、`:269` |

墙 1、墙 2 现在**不需要修**：主线机密归 `secrets`（M21），而 secrets 的 `holders` / `unaware`
是自由字符串，群体天然可写；它也没有「程度」需求，因为秘密是**二元**的 —— 要么知道真相，要么不知道。

墙 3 是**真 bug**，与定位无关：它现在就在往正文上下文里写错东西。见 §6。

---

## 4. 结论：M21 的形状本来就是对的

| 行业模板列 | M21 字段 |
|---|---|
| The secret / Fact | `title` |
| （真相本体） | `detail` |
| Who knows | `holders` |
| Who does not know | `unaware` |
| When revealed | `revealChapter` |
| Clues / Red herrings | `evidence` |

**每一列都对齐。** P20-2 落地时把它写成「三处偏离验收口径」，其实形状是对的 ——
偏离的是**验收口径**（它要求"写前查阅注入秘密"，那是错的），不是表。

M16 的定位随之收窄：

- ✅ 它仍是「**给模型的备忘**」——模型没有记忆，作者靠重读能补，模型不能。这是它存在的唯一理由；
- ❌ 它**不是**「主线机密的账本」，不承担 secret 级事实；
- ❌ 不再手工扩展它的登记面（成本远大于收益，全书用不了几回）。

---

## 5. 真断链：secrets 把判断推给知情格 —— ✅ 已修

`secret.ts` 的 `ZH_LEAD` 第 3 句：

> 写不出真相、但让角色知道了不该知道的事，**按知情格判**。

它把判断推给了 M16。而 M16 **没有这条秘密的数据** —— 主线机密只登记在 `secrets` 里。
于是「阿七突然知道了秘密，但正文没写出真相」这件事：

- `secrets` 判不了：它的规则只管「写出真相栏内容」；
- M16 判不了：那条秘密不在 `knowledge_states` 里，没登记。

**两头都不管。** 而这恰恰是最常见、也最伤书的泄密形态 —— 秘密不是被说出来的，是被**演**出来的。

修法（改文案 + 一条规则，不建表）：

`ZH_LEAD` 第 3 句改为让 secrets 自己判：

> 写不出真相，但让「尚不知情」栏里的人表现出知情（说出、用上、据此行动、避开相关话题）——
> 同样按提前泄密判。**「尚不知情」为「未填」时不适用本条。**

英文对应句同步改。这条修完，`secrets` 就自洽了，不再依赖 M16 承载主线机密。

### 5.1 落地记录（2026-10-26）

`src/shared/secret.ts` 的 `ZH_LEAD` / `EN_LEAD` 第 3 句已替换。新句原文：

> 写不出真相，但让「尚不知情」栏里的人表现出知情（说出相关内容 / 用上只可能由真相得出的信息 / 据此改变行动）
> —— 同样判为提前泄密。**本条只针对「尚不知情」栏里的人**；「隐瞒者」做遮掩、暗示、回避仍不算泄密（见上一条）。
> 「尚不知情」为「未填」时，本条不适用。

三处刻意写法：

- **主体写死**（「本条只针对『尚不知情』栏里的人」）：不写这句，新规则会与第 2 句「只写到有人在遮掩 / 暗示 / 回避不算泄密」字面打架，
  模型会随机选一边；
- **三种表现列出来**（说出 / 用上 / 据此行动）：只说「表现出知情」太抽象，模型容易只认第一种；
- **「未填」不适用**：不能拿一份没登记的名单去做负向判定（判据 DN）。

`secret.test.ts` 新增 5 例钉住（含英文侧独立整套的检查，`prompt-language` 漏改不报错）。

---

## 6. 墙 3：预算按行切导致静默翻转 —— ✅ 已修

> 与 §1 的裁定无关。这是 bug，不是取舍。

| 改动 | 位置 |
|---|---|
| 裁剪单位从「行」改为「事实（`fact_key`）」，一条事实的所有主体原子进出 | `knowledge-state.ts:renderKnowledgeSection` |
| 节首说明改成三句：完整列出的事实才适用封闭默认 / 本次未列出的已登记事实不适用 / 未登记的事实一概不判 | 同文件 `ZH_LEAD` / `EN_LEAD` |
| 新增 `omittedFacts` 计数，日志能报「省略 N 条事实」 | `review-continuity-bible.ts`、`prewrite-consultation.ts` |

核心裁定一句话：

> **封闭默认必须逐事实成立，不能逐节成立。** 一条事实只有在其主体集合**完整进入**上下文时，
> 才允许对它施加「未列出 = 不知道」；被预算裁掉的整条降级为「不判」。

旁证：同一文件里 `renderPrewriteFactsSection` 的标题已写着「不保证穷尽」「以定稿原文为准」——
事实节用开放世界，知情节用封闭世界，而封闭世界的边界被画在了**预算**上。这是 bug。

### 6.1 落地记录（2026-10-26）

`planKnowledgeSection` 成为唯一的裁剪判断点（`renderKnowledgeSection` 只剩薄壳）：

| 规则 | 实现 |
|---|---|
| 分组单位 | `factKey`（空键退回 `knowledgeId`，避免把互不相干的行并成一组） |
| 进出粒度 | 整组进或整组不进，**不允许半条事实** |
| 条数上限 | `KNOWLEDGE_MAX_ITEMS` 的语义改为**事实条数**（一行 = 一条知情关系） |
| 装不下时 | `continue` 跳过继续试下一组 —— 一条超长事实不该连带作废后面所有短事实 |
| 省略可见 | 节首追加「另有 N 条已登记事实因篇幅未列出 —— 上一句不适用于那 N 条」；日志另报 `omittedFacts` / `counts.knowledgeOmitted` |
| 节首承诺 | 改为「**每条事实的知情名单都完整**」，由整组进出保证它不是修辞 |

验证：`src/shared` 全量 86 文件 / **1443 例**；`generate-draft` 243 + `review-revision-runtime` 53 + `chapter-materials` 70；
`tsc --noEmit` exit 0。审稿链提示词的字节锚点（`review-revision-runtime.test.ts`）随节首文案更新一次，
注释里写明了「锚点跟着变是有意的」。

---

## 7. 撤回的方案（留档，别再重开）

| 原方案 | 为什么不做 |
|---|---|
| 期 1 全集 + 差集（`scope_label` / `except_names`） | 主线机密的群落表达由 `secrets.holders` / `unaware`（自由字符串）覆盖。给 M16 加这个，是为一个它不该承担的场景改表 |
| 期 2 程度（`witnessed` / `told` / `heard` / `suspects`） | 行业模板无此列；秘密是二元的。真正有价值的那根轴是「作者 / 读者 / 角色」三方信息差，不是模态分级 |
| 期 3 势力层（`factions` 表） | 同期 1 的理由，且成本最高（成员变动牵动历史章节） |
| M22 迁移（重建 `knowledge_states`） | 随期 1 一起撤回，版本号不动 |

> ⚠️ 如果将来真的出现「需要按势力判断谁知道」，正确做法是**先有真实需求实例**（哪本书、哪一章卡住了），
> 再回来讨论 —— 不为假设的场景改表。
