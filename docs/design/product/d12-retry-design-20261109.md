# D4 · D12 修法设计：拦截后自动重跑一次

> 状态：待裁定（2026-11-09 · 设计稿；两个硬前置未解：缺「上一章全文」入参、既有单测写死三次调用）
> 归档：2026-11-09 夜跑 · 豆包（wt-1 / CDP 9331）· 看板卡 `928fe6e6-47c6-4837-8435-c91d0a3a3525` · 任务书 `scripts/night/20261109/db-d4-d12-retry-design.md` · 原始产物 `wt-1/.batch/night/d4-d12-retry-design.md`
> 基线与性质：wt-1 HEAD `cd78aaa8`；**只读产物**（未改代码 / 未跑测试 / 未做 git 写）。
> Lead 归档复核（2026-11-09 19:30）：两个硬前置已核：缺「上一章全文」入参（`chapter-materials.ts:91`/`:100` 只有 `previousChapterEnding`）、`generate-draft.command.test.ts:979-998` 用 `toEqual` 写死三次调用；重跑若要生效必须同时做材料减法（缺陷稿 `:851` 自述强指导无效）。

> 基线 `cd78aaa8`。只读设计稿，**不改代码 / 不跑测试 / 不做 git 写**。
> 一句话定位：**D12 已由作者结案为「9B 模型弱点」，本修法不重开结案结论**，只把「失败即丢弃」改成「失败即带纠正指令重跑一次，仍失败才丢弃并如实报错」。

## 结论（一段话）

现在的拦截器只比对「上一章**结尾 1000 字**」与「本章**开头 1200 字**」的 8-gram 连续重合（≥80 字即命中），窗口之外一律看不见——这正是「整章复用、只换个开头」能绕过的结构原因；因此触发条件必须**换成全章判据**（`analyzeChapterReuse`，blocking 0.45），而重跑一次要真正起作用，**光加纠正指令不够**——缺陷稿自己的结论是「强指导在小模型上无效，具体文本优先」（`:851`），所以重跑必须同时做**材料减法**：把上一章结尾从正文请求里撤掉，只留 300 字要点。重跑仍失败就抛同一个 `DRAFT_PREVIOUS_ENDING_REPLAY`，但把两次的重合率与重合段清单一起报出来。**这条路最大的成本不在实现，在既有单测**：`generate-draft.command.test.ts:979`–`:998` 用 `toEqual` 把「恰好三次模型调用」写死了，加一次重跑必红，需作者先裁。

## 一、证据

**1. 现有拦截器（真正的生产守卫）**

`src/services/workflows/commands/generate-draft.command.ts:361`–`:368`
```ts
function hasSubstantialPreviousChapterReuse(
  previousEnding: string,
  draft: string,
  writingLanguage: WritingLanguage,
): boolean {
  const ngramCharacters = writingLanguage === 'en-US'
    ? CROSS_CHAPTER_REUSE_ENGLISH_NGRAM_CHARS
    : CROSS_CHAPTER_REUSE_CJK_NGRAM_CHARS
```

**窗口与阈值的字面值**（同文件 `:103`–`:106`）
```ts
const NEXT_CHAPTER_HEAD_MAX_CHARS = 1200
const CROSS_CHAPTER_REUSE_CJK_NGRAM_CHARS = 8
...
const CROSS_CHAPTER_REUSE_LONG_RUN_CHARS = 80
```

**只比开头**（同文件 `:374`）
```ts
  const nextHead = normalize(draft.slice(0, NEXT_CHAPTER_HEAD_MAX_CHARS))
```
**上一章那侧只有结尾 1000 字**（同文件 `:1215` 注释）
```ts
    // 只截 300：`previousEnding` 本身是 1,000 字（同一个函数，默认值不同），
    // 1,000 那个上限是给开头重演守卫用的，不要顺手改它。
```

**2. 拦截点在落库前，失败即抛，无重跑**

同文件 `:1616`–`:1620`
```ts
      if (!alreadySaved && hasSubstantialPreviousChapterReuse(previousEnding, cleanDraftText, writingLanguage)) {
        throw Object.assign(new Error(uiText(
          '新章节开头与上一章结尾存在大段重演，结果未保存。请重新生成，并让本章从上一章已完成事件之后继续。',
```

**3. 全章判定器已入库但零接线**

`src/shared/chapter-reuse-coverage.ts:17`–`:25`
```ts
export const REUSE_RATIO_BLOCKING = 0.45
// 覆盖比例超过此值但未达阻断线，给出 advisory 建议
export const REUSE_RATIO_ADVISORY = 0.15
...
// 2026-11-09 作者裁定（按标定建议）：advisory 保持 0.15，blocking 0.35 → 0.45（宁可少打断，
// 不靠这条闸门兜「同剧情换措辞」——那种形态它本来就看不见）。标定读数见
// docs/experiments/reuse-coverage-threshold-calibration-20261109.md。**仍零接线。**
```
`analyzeChapterReuse` 全仓引用只有定义（`:66`）与 `src/shared/__tests__/chapter-reuse-coverage.test.ts`（13 处）⇒ **生产调用点 0**。

**4. 失败后的现状：正文不白丢，但只能靠人再点一次**

`src/shared/chapter-failure.ts:115`–`:120`
```ts
  [CHAPTER_FAILURE_CODES.DRAFT_PREVIOUS_ENDING_REPLAY]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_PREVIOUS_ENDING_REPLAY,
    detail: '生成的正文开头重演了上一章结尾，没有推进本章内容，结果未保存。',
    suggestions: ['修改上一章结尾，或调整本章开头的衔接设定', '更换生成模型后重试'],
```
落候选的证据在既有单测里（`generate-draft.command.test.ts:992`–`:996`）：`db:recovery-candidate-record` 落 1 条，`failureCode: 'DRAFT_PREVIOUS_ENDING_REPLAY'` ⇒ 正文进候选区，不是纯丢弃。

**5. 文件里已经有「唯一一次带纠正指令重来」的现成范式（可直接照抄形状）**

同文件 `:1969`–`:1977`
```ts
      const recoveryInstruction = recoveryPending
        ? promptLanguageText(
            params.writingLanguage,
            '上一轮续写没有增加足够的新正文（达到输出上限，或在复读已经写过的内容），已被全部丢弃。\n'
              + '这是本次任务唯一一次无进展恢复机会：请直接推进下一事件、动作或对话，禁止复述已写末尾。\n\n',
```
⇒ 设计上不需要新机制，把同一形状复用到重演分支即可。

**6. 为什么指令单独不够（本修法的核心依据）**

缺陷稿 `docs/design/product/live-pipeline-acceptance-defects-assessment.md:851`
```
结论：**D12 的可触发条件 = 小模型 + 上一章全文无结构分隔地注入**。强指导（明确"禁止回到铜锣、点卯、碑坪"）在小模型上完全无效 —— 指导是文字要求，上一章全文是具体文本，模型优先模仿具体文本（与既有红线「例子会被逐字抄成内容」同源）。
```
同文件 `:753` 的直连复跑读数：`10 次里干净 3 / 重演 5 / 失控 2` ⇒ **同 prompt 重跑一次，期望值约 30% 干净**，这是「重跑一次」能成立的概率基础，也是不能指望两次就解决的理由。

**7. 短章的比例问题（窗口判据的固有缺陷）**

实验报告 `docs/experiments/reuse-coverage-threshold-calibration-20261109.md:15`
```
| 输出 | `ratio` / `coveredUnits` / `runs` / `longestRun` / `severity` | 头覆盖率 / 最长连续段 / 连续 ≥80 字判重演 |
```
正文样本 1,647–1,972 字（同报告语料说明，`ratio` 的分母）⇒ 开头 1,200 字占 61%–73%，**剩下的 27%–39% 根本不参与判定**；若整章复用但改写了开头 500 字，命中只能在窗口内剩下的部分发生。全章判据没有这个问题。

## 二、正文

### 1. 触发条件：哪个判据、哪个阈值、在哪一步

| 项 | 现状 | 建议 |
|---|---|---|
| 判据 | `hasSubstantialPreviousChapterReuse`（`:361`）：上一章结尾 1000 字 × 本章开头 1200 字，8-gram、连续 ≥80 字 | **主判据换成 `analyzeChapterReuse(cleanDraftText, 上一章全文)`**，全章对全章 |
| 阈值 | 等效「单段 ≥80 字连续命中」 | `severity === 'blocking'`，即 `ratio > 0.45`（`chapter-reuse-coverage.ts:17`） |
| 时点 | 生成后、`db:commit-draft` 前（`:1616`，同一处） | **不变**（这是 `cleanDraftText` 唯一可信的版本，`:1623`–`:1625` 注释已说明后续轮次会被续写/压缩替换） |
| 旧判据（开头窗口） | 唯一判据 | **降级为 advisory 日志**（不触发重跑），保留它对「短承接」的敏感性，同时不再让它当门 |
| 上一章全文从哪取 | 现状只有 `previousEnding`（结尾 1000 字） | 需要上一章**全文**入参 ⇒ 见遗留问题 2（本次未核到现成全文入参） |

**为什么不用 0.15（advisory）当触发线**：`chapter-reuse-coverage.ts:23`–`:25` 的裁定原话是「宁可少打断」，0.15 是「提示」线；用 0.15 触发自动重跑会让正常承接（组 A 10 对真实相邻章全 0，但阈值一旦压低就会吃进引用/律条原文）也重跑，代价是每章 3–4 分钟。

### 2. 重跑一次要改什么

**(a) 纠正指令：写进提示词，明确「唯一一次」+ 具体纠正对象**

建议中文原文（照 `:1972`–`:1973` 的句式）：

```
你上一版正文被判为整章复用上一章（与上一章重合 X%，最长一段 N 字），已整份丢弃。
这是本次唯一的重跑机会。禁止重复上一章的事件顺序、场景与对话；从本章蓝图的第一个尚未发生的事件写起，
第一段必须给出本章独有的一个动作、决定或结果。不要用"回顾"或"承接"开头。
```

建议英文原文：

```
Your previous draft was judged to reuse the previous chapter wholesale (X% overlap, longest run N units), and it was discarded in full.
This is the only retry. Do not repeat the previous chapter's event order, scenes, or dialogue; start from the first unrealized event in this chapter's blueprint,
and make your first paragraph deliver one action, decision, or outcome that belongs to this chapter alone. Do not open with a recap or a transition back.
```

（`X`、`N` 直接取 `ChapterReuseReport.ratio` 与 `longestRun`（`chapter-reuse-coverage.ts:28`–`:47`）——把数字给模型，比只说「别重复」具体，这也是该文件 `:1981`–`:1983` 总结过的教训：同一段里只给一个可服从的目标。）

**(b) 材料减法：把上一章结尾从正文请求里撤掉**

这是本修法最要紧的一条，依据 `:851`——模型模仿的是具体文本，不是文字要求。重跑这一轮：

- `previousEnding` 置空（沿用文件里已有写法 `:1042` `.withPreviousEnding('')`）；
- 只保留短细纲那侧的 300 字前驱要点（`draft-short-outline.ts:59` `DRAFT_SHORT_OUTLINE_PREDECESSOR_TAIL_CHARS = 300`）。

**(c) 换模型 / 换温度**

- **不自动换模型**：作者已裁定 D12 是 9B 固有弱点（`:750`），自动换模型等于悄悄替作者换掉他选的模型，且会让「到底是模型问题还是修法有效」不可归因。仍失败时把「更换生成模型」留给作者（失败码 `suggestions` 已写着，`:119`）。
- **温度：未核实**。`temperature` 字段存在于生成请求选项（`src/services/generation/__tests__/generation-harness.test.ts:19` `temperature: 0.6`），但本次**未在 `generate-draft.command.ts` 读到设置温度的行**，故不写「可以按章调温」。

**(d) 次数**

恰好 1 次，与 `recoveryPending` 的「唯一一次」同构（`:1973`）。不做第 2 次：连续重跑到过为止会把「模型稳定性」问题刷成「偶发通过」，与缺陷稿的结案定性相矛盾。

### 3. 重跑失败后的降级

| 档 | 做法 | 理由 |
|---|---|---|
| **抛同一个失败码**（推荐） | 仍 `throw` `DRAFT_PREVIOUS_ENDING_REPLAY`，文案加「已自动重试一次仍未通过」，并把两次的 `ratio` / `longestRun` 写进 detail | 现状的病灶是「生成了、没保存、界面不说」（缺陷稿 `:780` 影响 2）；不报错等于把老问题换个地方复现 |
| **给作者看重合清单**（推荐） | 不做全文 diff，只列 `runs`：`ChapterReuseReport.runs` 已带 `start` / `length`（`chapter-reuse-coverage.ts:42`–`:47`），可直接渲染「第 3–41 字、第 900–980 字与上一章重合」 | 数据已在报告里，成本≈0；比引一句原文更能让作者判断「是整章复用还是合法承接」 |
| 只记录不报错（不建议） | 写日志、静默 | 与 D12 原始缺陷同型 |

正文不丢这条保持不变：D13 契约已让失败正文进 recovery candidate（测试 `:992`–`:997` 断言）。

### 4. 误伤风险

| 风险 | 实测/推理 | 处置 |
|---|---|---|
| 真实改写被误拦 | 组 D 4 对真实改写实测 `ratio=0`（实验报告 `:136`、`:262`–`:265`）⇒ 0.45 的阻断线**碰不到**它们 | 无需处置；这也是「不能调阈值到 0.15」的理由 |
| 机械替换开头的复写 | 组 B `ratio=0.8357–0.8578`（`:147`），远高于 0.45 | 命中，符合预期 |
| 短章窗口比例 | 现判据只看开头 1,200 字，占 1,647–1,972 字正文的 61%–73%，余下 27%–39% 盲区 | 换全章判据即消除；旧判据降为日志后不再当门 |
| 合法跨章承接（上章末场景在本章开头重述） | 现状靠 80 字连续门槛容忍；全章 0.45 要求「近半章重复」才触发 | 更安全，不会误伤过渡段 |
| 重跑本身的成本 | 每章模型产出 3–4 分钟（缺陷稿 `:779`） | 比现状「直接作废 + 人工重来」便宜；且只在 blocking 时发生 |

**一个诚实的保留**：组 D 是「同一段剧情的两种写法」，`ratio=0` 说明**逐字口径看不见改写式复用**（实验报告 `:136` 原话「这不是漏报…只覆盖逐字照搬」）。⇒ 本修法只兜「整章照搬/大段复写」，**兜不住「换措辞重写上一章」**——后者按作者裁定归一致性检查（见 D3 草案），不要指望本条修法解决。

### 5. 验收线

**单测（必需）**

1. **接线正向**：构造 blocking 正文（复用率 >0.45）⇒ 断言发生**恰好一次**重跑，且 `generation:execute` 的 purpose 序列为 `['chapter-draft-short-outline', 'chapter-draft', 'chapter-draft', 'chapter-draft-condense']`（多出一个 `chapter-draft`）。
2. **落库只落重跑结果**：`db:commit-draft` 恰好 1 次，且 `visibleText` 是第二次的正文。
3. **重跑仍失败**：仍 `rejects` 原失败码；recovery candidate 里 `failureCode` 不变，并带 `attempts: 2`（字段名待定，**新增字段需作者裁**）。
4. **不误伤**：把组 D 的两对真实改写样本（`ch10-v2` vs `ch10`，`ch06-v2` vs `ch06`）喂进接线后的判定链路，断言**不触发重跑**（`ratio=0` ⇒ `ok`）。
5. **边界**：上一章为空 / 本章为空 ⇒ 不触发（`chapter-reuse-coverage.ts:76`–`:84` 已定义该边界）。

**实机（必需，唯一能证明「重跑有效」的证据）**

- 9B 下同章连跑 ≥5 次：直连复跑基线是「10 次里干净 3」（`:753`），若修法成立，被拦下的那些应有一部分在重跑后落库。**单测只能证明「会重跑」，不能证明「重跑有用」。**
- 不误伤实机线：拿组 A 那 10 对真实相邻章走一遍完整命令，断言**0 次触发**。

**会破的既有断言（必须先让作者裁）**

`src/services/workflows/commands/__tests__/generate-draft.command.test.ts:979`–`:998`
```ts
    await expect(f.command.execute({ step: {}, context: f.context, callbacks: f.callbacks }))
      .rejects.toThrow('大段重演')
...
    expect(executed.map(([, request]) => (request as { task: GenerationTask }).task.purpose))
      .toEqual(['chapter-draft-short-outline', 'chapter-draft', 'chapter-draft-condense'])
```
`toEqual` 把「恰好三次调用」写死了 ⇒ 加一次重跑必红。按红线 3，本稿不动它，只标「需作者裁定改断言」。

## 遗留问题

1. **上一章全文的入参不存在（不确定）**：现状拿到的只有 `previousEnding`（结尾 1000 字，`:1215` 注释），全章判据需要「上一章全文」。本次**未核到**现成的全文入参（`chapter-materials` 只导出 `previousChapterEnding`，`:91`/`:100`）。这是本修法的**第一个硬前置**——没有全文，`analyzeChapterReuse` 只能降级成「结尾 1000 字 vs 本章全文」，而它本身仍要求全章比对（规程见 `chapter-reuse-coverage.ts:62`–`:64` 差异点）。
2. **既有单测卡死调用序列**：`generate-draft.command.test.ts:979`–`:998` 的 `toEqual([...三件事])` 与 `rejects.toThrow('大段重演')`，重跑一落地必红；需作者先裁「改这条断言」。
3. **temperature 未核实**：只在测试 fixture 看到字段（`generation-harness.test.ts:19`），未在 `generate-draft.command.ts` 找到设置温度的代码 ⇒ 不写「可调温重跑」。
4. **重跑是否撤掉上一章结尾，属 prompt 材料改动**：这不是纯代码改动，按 T0-2「先讨论再落地」需作者点头；`withPreviousEnding('')` 的用法在文件里已有（`:1042`），但那条路径是「无前文摘要」场景，不是重跑场景。
5. **`attempts` 字段是否要进 recovery candidate**：现状候选记录形状里没有次数（测试只断言 `visibleText` + `failureCode`），加字段会牵动 schema，需作者定。
6. **与 D3 的边界**：本条只管「逐字/大段整章复写」，`ratio=0` 的「换措辞同剧情」不归它；不要在本修法里顺手调 advisory/blocking 去兜那类问题（`chapter-reuse-coverage.ts:23`–`:25` 已明文排除）。

## [T1] DONE

修法设计已交付：触发条件应从「结尾1000字×开头1200字、连续≥80字」换成全章 `analyzeChapterReuse` blocking 0.45；重跑一次必须同时做材料减法（撤掉上一章结尾）才可能生效；最大前置是缺「上一章全文」入参，最大成本是既有单测 `:979`–`:998` 卡死三次调用需作者先裁。
