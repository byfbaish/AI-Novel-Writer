# 无人值守计划：角色行为四层落地（期 1–4）

> 状态：**待执行**（2026-10-29）· 执行者：另一会话的 Agent（DeepSeek）
> 依据：`docs/design/prompt/character-behavior-four-layers.md`（设计稿）· 实验：`scripts/experiments/`
> **全天硬停：07:50。到点无论做到哪一步，停止改代码，写交接（§7 有模板）。**
> 本文件**不入库**（留在本地），所以仓库里查不到它——执行者在别的会话里拿到的是这份原文。

---

## 0 怎么用

1. 读 §1 前置。**前置没做完不许开工。**
2. 按 §2 的时间盒推进，**每个检查点记下实际时间**。
3. 每期做完立刻跑该期验收命令，全绿才提交。
4. 越过检查点还没做完 → **跳过后续期，直接做收尾**（§7）。
5. 任一步需要"改设计才能过" → **停手**（§9）。

---

## 1 前置（执行者必须先确认，**不得代劳**）

| # | 事项 | 怎么确认 |
|---|---|---|
| P1 | 分支是 `exp/resource-ledger` | `git branch --show-current` |
| P2 | 工作区干净 | `git status --short` **只应剩本文件一行**（`?? docs/handoffs/archive/2026-10-29-four-layers-unattended-plan.md`） |
| P3 | 基线自己重跑一遍 | 见 §8。**不许照抄 §8 的数字**，那是 05:40 的读数 |

> P2 不符 → 立刻停手汇报。有别的未提交改动说明前置没做，后面所有 diff 都不可信。

---

## 2 时间盒与优先级

| 期 | 内容 | 预算 | 检查点 |
|---|---|---|---|
| **期 1** | `detailTask` 改四层 + 守卫测试 | 45 min | **T+45** |
| **期 2** | 情节大纲加「定性」前置行 | 35 min | **T+80** |
| **期 4** | 底线清单接词条库 | 15 min | **T+95** |
| **期 3** | 处境类型库：**只出方案，不落代码** | 15 min | **T+110** |
| 收尾 | 全量校验 + 汇报 + 交接 | 20 min | **T+130 → 07:50 硬停** |

**优先级：期 1 > 期 2 > 期 4 > 期 3。** 时间不够就从后往前砍。

⚠️ **期 3 明确不落代码**：它要动 schema（处境类型表）。无人值守做不可逆的迁移＝事故。只交一份草案。

---

## 3 期 1：`detailTask` 改四层（45 min）

### 3.1 改哪里

`src/services/prompt-language.ts` → `CHARACTER_ARCHITECTURE_PROMPTS.detailTask`，**中文段与英文段各一处**。

- 中文段：从 `【主角的性格：四格、档位标签、带编号…】` 到 `…不能换个形容词抄回来。`（整段替换）
- 英文段：**独立一整套**，搜 `D1` / `[Daily]` / `exception` 定位。**漏改不报错**，这是本项目已知陷阱。

### 3.2 中文段替换成下面全文（照抄，不要改措辞）

```
【主角的性格：四层，不是形容词清单】
性格不是形容词，也不是日记。只写他会怎么动，而且要能让别人在另一章里一眼认出这是同一个人。

★ 先看作者的补充创作指导：若那里给了词条或底线清单，以它为准，你只负责把它落成下面这几层；
没有给，就从主角档案里推出来。

第一层【他在乎什么】按轻重排出 4–5 项，写清先后，不写分数。
- 至少一项是具体可夺的东西：一个人、一本账、一句承诺；不许全是「尊严」「信念」这类抽象词。
- 至少一项是他不愿承认的：他自己不觉得那是缺点。
- 任意相邻两项之间，要能构造出一个他必须选一个的场面。
- 普世、仁善这类价值不许排在前两位。若确要排，必须写出他为此付过什么代价；写不出代价的，那是圣母，不是人。

第二层【什么算一件事】只写两句：什么算，什么不算。
- 能用的、能换钱的、能让他少费事的 → 算。
- 跟他没干系的闲事 → 不算。
- 每一类「不算」的事，都必须离上面那些底线项都远。

第三层【他对各类事的做法】写 3–4 条配对，每条两行：
- 什么事 → 他一贯怎么做（写做法，不写这一次的具体动作）
- 不适用：什么情况下这条让位
每条都必须有「不适用」。没写的那条会变成万能答案，把所有处境都吸过去。

第四层【例外】
- 上面那些做法，全是为前三条底线服务的。只有一种情况会出例外：第 1 条跟别的底线打架时，他一定选第 1 条。
- 那一次他会做出上面所有做法里都没有的事，方向是定的：他为了那个人，放弃自己平时守的规矩。
- 除此之外不会有意外的举动。

【具体动作的粒度】每条做法最后都要能落到这个粒度：
- 是动作，能拍出来；不是形容词。
- 带一个身体反应：手抖、耳鸣、指节发白、呼吸变了。这是他还在怕但仍在做的证据。
- 出现这本书里任何专名的，一律重写。

【不一致的分寸】
- 前三条底线上的行为必须始终一致。两处对不上，就是崩人设。
- 面子、好玩这类轻的项上不必一致：这次去、下次不去，都合理。
- 不要为了稳定把轻的项也写成铁律，那样角色是机械的。

不要复述 background 里已经写过的那整段前史，原因一句话点到。
禁止写成标签清单（勇敢／隐忍／腹黑），禁止出现数值（勇气 +1）。
```

### 3.3 英文段

按上表**逐条对应**翻译，**层数与条款数必须一致**：第一层 4 条 · 第二层 3 条 · 第三层 3 条（含 not applicable）· 第四层 3 条 · 动作粒度 3 条 · 不一致分寸 3 条。
术语：`layer 1 [what he cares about]` / `layer 2 [what counts as an event]` / `layer 3 [how he treats each kind of event]` / `layer 4 [the exception]` / `not applicable`。

### 3.4 ⚠️ 铁律

往 `detailTask` 这类**模板字符串**里写内容，**一律不用反引号**（用「」和 <>）。之前踩过三次，直接截断文件，报 `PARSE_ERROR`。

### 3.5 守卫测试（`src/services/__tests__/prompt-language-contract.test.ts`）

**删**：所有断言「D1 日常 / D2 代价 / D3 破例 / 档位标签 / 五道闸」的用例——条款已不存在，留着必红。

**加 4 个用例**（中英各断言一次）：

| 用例名 | 断言 |
|---|---|
| `writes the character in four layers` | 含 第一层/第二层/第三层/第四层（英文 `layer 1`…），且旧词 `〔日常〕` `〔代价〕` `〔破例〕` **都不存在** |
| `bans the saint at the top of the ranking` | 含「普世、仁善这类价值不许排在前两位」 |
| `requires not-applicable on every practice` | 含「每条都必须有『不适用』」 |
| `pins the exception to a bottom line` | 含「只有一种情况会出例外」+「他为了那个人，放弃自己平时守的规矩」 |

### 3.6 期 1 验收

| # | 命令 | 预期 |
|---|---|---|
| 1.1 | `grep -c "第一层" src/services/prompt-language.ts` | ≥1（英文段用 `layer 1` 另算） |
| 1.2 | `grep -c "〔日常〕\|〔代价〕\|〔破例〕" src/services/prompt-language.ts` | **0** |
| 1.3 | `grep -c "不适用" src/services/prompt-language.ts` | ≥2 |
| 1.4 | `grep -c "普世、仁善" src/services/prompt-language.ts` | ≥1 |
| 1.5 | `grep -c "layer 1" src/services/prompt-language.ts` | ≥1 |
| 1.6 | `npx tsc --noEmit` | 无输出，exit 0 |
| 1.7 | `node scripts/run-tests-electron.mjs src/services/__tests__/prompt-language-contract.test.ts` | 全绿 |
| 1.8 | `node scripts/run-tests-electron.mjs src/services/__tests__/synopsis-two-level-suffix.test.ts src/shared/__tests__/disposition-citation.test.ts` | 全绿 |

全绿 → 提交：`feat(character): detailTask 改为四层结构`（**只提交本期的两个文件**）。

---

## 4 期 2：情节大纲加「定性」前置行（35 min）

### 4.1 改什么

现在 `synopsis-two-level-suffix.ts` 每章输出固定两行：章标题 + 选择行，**编号是模型边写边填**。实测这一步只有 11/20 的准确率——因为它同时要做"归类"和"演绎"。

**改成三行**：在章标题和选择行之间插一行「定性」，把归类单独变成一步。

```
- 第一行：章标题「## 第N章：章名」；
- 第二行：「定性：D<n> — <这一章碰到的是哪一条，一句话说清是哪类处境>」（若这一章确实不沾任何一条，写「定性：无 — <为什么>」）；
- 第三行：「选择：…（保持原格式不变）」；
```

### 4.2 硬要求

- 定性的 `D<n>` **必须与选择行引用的编号一致**。不一致就是没想清楚，重写。
- 定性那行**不许写他做了什么**，只写"这是哪一类事"。
- 中间不得插入其他行。

### 4.3 同步改

| 文件 | 改什么 |
|---|---|
| `src/services/prompts/synopsis-two-level-suffix.ts` | 中英两处：格式说明加第三行；「章与章的承接」若提到行数要同步 |
| `src/services/builtin-prompt-templates.ts` | `synopsis` content 里若复述了格式，同步（**搜「选择：」定位**） |
| `src/shared/disposition-citation.ts` | `auditDispositionCitations` 要能读「定性：」行；若定性行存在但与选择行编号不一致，新增一条码 `ARC_CHOICE_MISMATCH` |

### 4.4 期 2 验收

| # | 命令 | 预期 |
|---|---|---|
| 2.1 | `grep -c "定性：" src/services/prompts/synopsis-two-level-suffix.ts` | ≥2（中英） |
| 2.2 | `grep -c "ARC_CHOICE_MISMATCH" src/shared/disposition-citation.ts` | ≥1 |
| 2.3 | `npx tsc --noEmit` | exit 0 |
| 2.4 | `node scripts/run-tests-electron.mjs src/services/__tests__/synopsis-two-level-suffix.test.ts src/shared/__tests__/disposition-citation.test.ts` | 全绿，且 `disposition-citation` 例数比基线多（新增 MISMATCH 用例） |

全绿 → 提交：`feat(synopsis): 情节大纲加「定性」前置行，编号不再边写边填`。

⚠️ **若 2.4 出现大量红，说明 `builtin-prompt-templates.ts` 里还有一处复述格式没改到**——全库搜「选择：」，不要只改一处。

---

## 5 期 3：处境类型库 —— **只出方案，不写代码**（15 min）

**产出**：`docs/design/prompt/character-event-types-draft.md`（**新文件，一份草案**）

必须回答四件事：

1. **粒度**：多细算一类？给 8–12 个候选处境类型（参考实验用的 24 章序列），每个写「一句话定义 + 一个反例（不算这一类的）」。
2. **来源**：这些类型从哪来？卷纲的节点？还是从已有章节归纳？
3. **存放**：不进 DB 的话放哪（`src/shared/` 常量？）；进 DB 的话迁移怎么写、旧项目怎么办。
4. **与策略的关系**：一条处境类型对多个角色是什么形态（每个角色各写自己的策略？还是一张联合表？）。

**不许**：改 `electron/migrations/`、改 schema、写实现代码。
**验收**：文件存在，四问都有答案，`check-doc-links` 无断链。

---

## 6 期 4：底线清单接词条库（15 min）

### 6.1 改什么

`src/shared/golden-traits.ts` —— 给每条词条加一组「典型底线排序」：

```ts
/** 这个词条的主角，底线通常怎么排（Schwartz 十项里的名字，从重到轻，3–5 项） */
readonly values: readonly GoldenTraitValue[]
```

`GoldenTraitValue` 取 Schwartz 十项的中文名：`自主` `刺激` `享乐` `成就` `权力` `安全` `顺从` `传统` `仁善` `普世`。

**硬约束：`仁善` 和 `普世` 不许出现在前两位**（V6）。若某条词条确实需要，必须在 `fit` 里写明代价。

### 6.2 四条词条的参照（照这个写，别自由发挥）

| 词条 | values（从重到轻） |
|---|---|
| 稳健型 | 安全 · 自主 · 仁善 · 传统 |
| 以力证道型 | 成就 · 权力 · 仁善 · 自主 |
| 算计型 | 成就 · 自主 · 权力 · 安全 |
| 反派型 | 权力 · 刺激 · 自主 · 成就 |

同时加一个导出：`goldenTraitValuesMarkdown(language)`，输出格式与 `goldenTraitCatalogMarkdown` 一致（给 UI/导出用，**不注入写作 prompt**）。

### 6.3 期 4 验收

| # | 命令 | 预期 |
|---|---|---|
| 4.1 | `grep -c "values:" src/shared/golden-traits.ts` | ≥ 4 |
| 4.2 | `npx tsc --noEmit` | exit 0 |
| 4.3 | `node scripts/run-tests-electron.mjs src/shared/__tests__/story-beats.test.ts src/services/__tests__/prompt-language-contract.test.ts` | 全绿 |
| 4.4 | 人工核对 | 四条里**没有**任何一条把「仁善」或「普世」排在第 1、2 位 |

全绿 → 提交：`feat(character): 词条补底线排序（Schwartz 十项参照）`。

---

## 7 收尾与交接（20 min，**07:50 硬停**）

### 7.1 收尾必做

1. `npx tsc --noEmit` → exit 0
2. `node scripts/run-tests-electron.mjs src/services src/shared` → **passed 数 ≥ 基线，失败数与失败套件名都要与 §8 一致**
3. `node scripts/check-doc-links.mjs` → `broken 0`
4. `node scripts/check-doc-placement.mjs` → 无「新增违规」
5. **停止改代码**，写交接

### 7.2 到点没做完怎么办

**照写交接，不要"再给我十分钟"。** 已完成的期是干净的（每期单独提交）；未开始的期原样留给下一轮。

### 7.3 交接稿模板（写到 `docs/handoffs/archive/2026-10-30-four-layers-progress.md`）

```
# 角色行为四层 · 落地进度（YYYY-MM-DD HH:MM）

> 状态：进行中 / 已完成。硬停时间 07:50，实际停于 ____。

## 各期状态
期 1 detailTask 四层：✅完成 / ⏸未开始 / ⚠️半成品（说明卡在哪）
期 2 定性前置行：……
期 4 词条底线排序：……
期 3 处境类型库草案：……

## 验收读数（逐条照抄 §3–§6 的表格）
（把每期验收命令的实际输出贴上来，不要写"通过"两个字）

## 与基线的差异
新增失败：______（没有写"无"）
消失的失败：______

## 提交清单
（git log --oneline 从开工前那条到现在，原样贴）

## 未决 / 风险
（例如：personality 800 字是否够、英文段哪一句拿不准、期 2 的 MISMATCH 判据是否过严）

## 下一轮从哪接
（一句话说清下一个动作，不要写"继续推进"）
```

---

## 8 基线（**必须自己重跑确认**，下表是 05:40 的读数）

| 项目 | 基线值 |
|---|---|
| `src/services + src/shared` 全量 | **3688 passed / 7 failed / 3 套件** |
| 既有红的三个套件 | `context-entry-parity`（2）· `finalize-chapter.blueprint-entities`（1）· `finalize-postprocess-character`（4） |
| `npx tsc --noEmit` | exit 0 |
| `check-doc-links` | **1003 / 0** |
| `prompt-language-contract` | 55 例全绿 |
| `synopsis-two-level-suffix` | 15 例全绿 |
| `disposition-citation` | 9 例全绿 |

⚠️ 全量判法：**失败条数和失败的套件名都要对得上**。只对条数不对套件名 = 换了别的测试在红，不能放过。

---

## 9 停手条件（命中任一条立刻停）

1. 全量失败**条数或套件名**与 §8 不符。
2. `tsc` 报错超过 3 处，或出现 `PARSE_ERROR`。
3. 需要改 schema / 写迁移 —— **期 3 只出方案，不许实施**。
4. 需要改设计稿的判据（V1–V6 · S1–S3 · X1–X3 · N1–N3）才能通过。
5. 前置 P2 不符（工作区不干净）。
6. 时间到达 07:50。

---

## 10 禁止事项

- ❌ 不许改 `docs/design/prompt/character-behavior-four-layers.md` 的判据。
- ❌ 不许动数据库、`electron/migrations/`、`electron/` 下任何文件。
- ❌ 不许改 `personality` 的 800 字上限（除非验收时确认截断，并在交接里写明依据）。
- ❌ 不许为了过测试放宽断言。
- ❌ 不许只改中文不改英文。
- ❌ 不许 `git push`（提交可以，推送不行）。
- ❌ 不许在模板字符串里写反引号。

---

## 11 附：结论与证据的对应（执行者可核对）

| 结论 | 证据 |
|---|---|
| 三条扁平会出 D1 引力、D3 滥用、大量「无」 | `out/iso-D.jsonl`、`out/agent-subject-*.jsonl` |
| 四层卡把「无」从 7 降到 0 | `out/new-D.jsonl`（24 章） |
| 例外挂底线后 17/18 才一致且正确 | `out/v3-D-ch17/18.jsonl` vs `out/new-D.jsonl` |
| 模型归类只有 11/20，演绎稳定 | `out/iso-D.jsonl` vs 人工标注表（见 `character-behavior-four-layers.md` §1） |
| Schwartz 十项可作底线参照 | 2012 理论，44 国 25000 人；刺激/享乐是正式项 |
| 缺陷分伤己/伤人 | Truby《The Anatomy of Story》p.41 |
