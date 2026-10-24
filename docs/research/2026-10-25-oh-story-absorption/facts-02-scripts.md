# 批 2 · 关键脚本量化判据（机械事实）

> 状态：已采集（2026-10-25）
> 来源：`oh-story-claudecode` v0.9.0（MIT）· 原件见 [`vendor/oh-story-claudecode-0.9.0.tar.gz`](vendor/oh-story-claudecode-0.9.0.tar.gz)
> 采集方式：Copilot CLI `DocGuard`（只读）逐文件摘录判据常量 + 本会话直接读源码抽检
> 校验：`check-ai-patterns.js` 抽检 5 处常量 **5/5 逐字相符**；`wordcount_core.py` 与 `build_chapter_index.py`、`check-doc-budget.sh` 由本会话直接读源码补齐（Copilot 输出曾被截断）
> 纪律：本文件只放**事实与逐字摘句**。判定在 [`assessment.md`](assessment.md)

行号均指 v0.9.0 原件；文件短名对应路径：

| 短名 | 路径 |
|---|---|
| `ai` | `skills/story-deslop/scripts/check-ai-patterns.js`（1586 行） |
| `deg` | `skills/story-deslop/scripts/check-degeneration.js`（349 行） |
| `copy` | `skills/story-long-write/scripts/check-outline-copy.js`（313 行） |
| `punct` | `skills/story-deslop/scripts/normalize-punctuation.js`（415 行） |
| `wc` | `skills/story-long-write/scripts/wordcount_core.py`（405 行） |
| `view` | `skills/story-long-write/scripts/outline_view.py`（286 行） |
| `idx` | `skills/story-long-analyze/scripts/build_chapter_index.py`（466 行） |
| `budget` | `scripts/check-doc-budget.sh`（321 行） |

---

## 1. `check-ai-patterns.js` — 22 类风格检测器

### 1.1 它是「检测器」不是「打分器」

原文（`ai:37`，文件头自述）：

> This is a local style/readability gate, **not an AIGC detector score**; functional human text can be marked for review instead of hard-edited for a detector.

### 1.2 22 类 = 7 blocking + 15 advisory（逐字，`ai:36-37`）

**blocking 7**（`ai:36`，均 `mechanical`）：

| 中文名 | type 标识符 |
|---|---|
| 否定翻转 | `not-is-comparison` |
| 破折号 | `em-dash` |
| 音量反差腔 | `voice-contrast` |
| 否定排比 | `negation-parade` |
| 反序对比 | `reverse-not-is` |
| 预告式总结收尾 | `trailer-ending` |
| 章尾状态总结体 | `trailer-summary` |

**advisory 15**（`ai:37`）：

| 中文名 | type | review |
|---|---|---|
| 碎句号 | `period-stutter` | mechanical |
| 长段落 | `long-paragraph` | mechanical |
| 微动作复读 | `micro-action-tic` | mechanical |
| 套词密度过高 | `cliche-density-tic` | mechanical |
| 否定对偶 | `negation-pair-tic` | semantic |
| 套式反应细节 | `stock-reaction-tic` | semantic |
| 监控摄像头式动作清单 | `action-list-tic` | semantic |
| 抽象总结复读 | `abstract-summary-tic` | semantic |
| 比喻密度过高 | `metaphor-density-tic` | semantic |
| 解释链密度过高 | `reasoning-chain-tic` | semantic |
| 系统公告公文腔过密 | `system-notice-formality-tic` | semantic |
| 过度精炼短段 | `overcompressed-prose-tic` | semantic |
| 低连接密度 | `low-connective-density-tic` | semantic |
| 引号强调滥用 | `quote-emphasis-tic` | semantic |
| 工整并列 | `formulaic-parallelism` | semantic |

> 双轴设计：`severity`（能不能阻断）× `review`（改法是否要读上下文）。原文 `ai:37`：「Each finding also carries review: mechanical（表面形态确定、就地改写即可）或 semantic（可能承担叙事功能，需读上下文判断是否保留）；**blocking 一律 mechanical**。」

### 1.3 密度判定公式

`ai:832`（逐字）：

```js
const perKilo = (hits / narrativeChars) * 1000;
```

系统公告类用另一个分母（`ai:1083`）：`const perKilo = (hits / noticeChars) * 1000;`

### 1.4 各类的「最小命中数 + 每千字」双门槛（逐字常量）

| type | 常量 | 值 | 行 |
|---|---|---|---|
| `micro-action-tic` | `MICRO_TIC_MIN_HITS` / `MICRO_TIC_PER_KILO` | 5 / 6 | 63 / 68 |
| `stock-reaction-tic` | `STOCK_REACTION_MIN_HITS` / `_PER_KILO` | 4 / 1.5 | 83 / 88 |
| `cliche-density-tic` | `CLICHE_DENSITY_MIN_HITS` / `_PER_KILO` | 8 / 12 | 124 / 125 |
| `metaphor-density-tic` | `METAPHOR_DENSITY_MIN_HITS` / `_PER_KILO` | 7 / 3 | 132 / 133 |
| `reasoning-chain-tic` | `REASONING_CHAIN_MIN_HITS` / `CORE_MIN_HITS` / `MIN_BUCKETS` / `_PER_KILO` | 8 / 4 / 2 / 18 | 143–146 |
| `system-notice-formality-tic` | `NOTICE_FORMAL_MIN_LINES` / `MIN_HITS` / `CORE_MIN_HITS` / `_PER_KILO` | 4 / 12 / 5 / 60 | 157–160 |
| `abstract-summary-tic` | `ABSTRACT_SUMMARY_MIN_HITS` / `_PER_KILO` | 3 / 4 | 108 / 109 |
| `quote-emphasis-tic` | `QUOTE_EMPHASIS_MIN_HITS` | 3（无每千字门槛） | 272 |
| `overcompressed-prose-tic` | `MIN_CHARS` / `MIN_PARAS` / `SHORT_RATIO` / `PARTICLE_PER_KILO` | 1200 / 45 / 0.58 / 85 | 165–169 |
| `low-connective-density-tic` | `MIN_CHARS` / `FUNCTION_PER_KILO` / `PLAIN_PER_KILO` / `LONG_SENTENCE_RATIO` | 800 / 100 / 65 / 0.08 | 175–179 |

### 1.5 分母口径（这是最容易抄错的点）

`ai:820-821`（逐字）：

```js
const narrative = stripQuoted(trimmed);
narrativeChars += visibleLength(narrative);
```

`stripQuoted`（`ai:1293-1296`）把**成对引号内**的片段整段剔除，引号对共 7 组（`ai:195`）：

```js
const QUOTE_PAIRS = [['「', '」'], ['『', '』'], ['【', '】'], ['“', '”'], ['‘', '’'], ['"', '"'], ["'", "'"]];
```

`visibleLength`（`ai:1343-1345`）只数汉字/全角字符/ASCII 字母数字，**标点不计**：

```js
function visibleLength(sentence) {
  const matched = sentence.match(/[一-鿿Ａ-ｚA-Za-z0-9]/g);
  return matched ? matched.length : 0;
}
```

### 1.6 阈值是语料校准出来的（原文注释，逐字）

`ai:84-87`：

```
// 校准（真人语料，<br> 已还原为换行）：qimao 长篇 5584 章 + heiyan 短篇整篇 3983 篇。
// 长篇章尺度（中位约 2100 字）per-kilo 1.0→1.5 误报 0.43%→0.39%，几乎不动；
// 短篇整篇 8000-20000 字下 MIN_HITS 形同虚设、只剩密度门，1.0 时误报 5.57%，
// 1.5 降到 1.46%。故取 1.5，把两个总体拉到同一量级（四份副本共用一组阈值）。
```

blocking 类的校准基线（`ai:199-200`）：

```
// 校准基线：《万疆》真人正文 20 章（第1/10/20/…/190章）+ demo 前 20 章。
// blocking 规则要求真人语料命中 ≈0（每 20 章 ≤1 处且人工判定确属该句式）；数据见各规则注释。
```

### 1.7 输出与退出码

- finding 字段 8 个（`ai:378`）：`file` `line` `column` `severity` `type` `message` `excerpt` `review`
- `--fail-on=blocking` 只在有 blocking 时退出 1；默认 `all` 有任何 finding 即 1（`ai:391-393`）
- 退出码 `2` = 用法/读文件失败（`ai:390,399,415`）
- `--list-review-classes` 输出完整分类表 JSON（`ai:340`）

### 1.8 白名单机制

`ai` 文件头：`Book-local .deslop-whitelist literal spans are excluded from style scanning (no regex or ancestor inheritance).`
配套 `style-whitelist.js`（39 行）：按**字面量**从长到短匹配、等长替换为 `？`，**只认本书根目录，不继承父目录**（`style-whitelist.js:7-19`）。

---

## 2. `check-degeneration.js` — 模型退化指纹

常量（逐字）：

```js
const REPEAT_MIN_LEN = 12;      // deg:26
const REPEAT_MIN_COUNT = 3;     // deg:27
const ADJACENT_MIN_LEN = 8;     // deg:28
```

4 类（逐字 type）：

| type | 语义（原文 `deg:11-14`） | 行 |
|---|---|---|
| `verbatim-repeat` | 「复读/打转: a long sentence repeated, or back-to-back identical lines」 | 202 |
| `truncated` | 「mid-sentence truncation (截断): file ends without terminal/closing punctuation」 | 258 |
| `placeholder-leak` | 「placeholder / refusal / meta leakage（元信息泄漏）: 作为AI / 我无法继续 / 此处省略 / 乱码」 | 278 |
| `meta-leak` | 「engineering-word leakage（工程词泄漏）: 细纲 / 情节点 / 本章 / 下一章 / 任务描述 漏进正文」 | 313 |

定级（`deg:15-16` 逐字）：

> Each finding carries severity: blocking (复读/截断/占位拒绝语/tier1 纯工程词，正文里永不合法，命中即重写) 或 advisory (tier2 章节/歧义词、对话行里的工程词，只提示、交人/LLM 判)

代码侧：`deg:314` `severity: quotedTier1 ? 'advisory' : 'blocking',`；`deg:326` `severity: 'advisory',`

**修复建议是「重新生成该段，不是改写」**（见 `skills/story-review/SKILL.md:157`）——退化不是文风问题，是模型故障。

---

## 3. `check-outline-copy.js` — 正文照搬细纲

阈值（逐字，`copy:43`）：

```js
const MIN_RUN = 16 // 判定阈值：连续重合 >15 字，即 >=16
```

算法（`copy:238` 注释 + `copy:244-254`）：

> 贪心扫描：每个起点二分求「仍是细纲子串」的最长延伸，命中区间不重叠

```js
while (i < P.length) {          // copy:244
  while (lo <= hi) {            // copy:250
    const mid = (lo + hi) >> 1  // copy:251
    if (O.includes(P.substr(i, mid))) {  // copy:252
      lo = mid + 1              // copy:254
```

报告（`copy:293-301`）：标题「=== 细纲照搬检测（正文文件名）===」；汇总行「正文 N 字，与 X 连续重合 >15 字的片段 K 处，共 M 字（R%）。」；逐条 `· N 字「片段」`；超过 `REPORT_TOP` 条后折叠为「…另有 N 处」。

---

## 4. `normalize-punctuation.js` — 标点归一

- 归一范围（`punct:265` 逐字）：`const pattern = /…+|\.{3,}|——|—|--+/g;`
- 三类：省略号 / 破折号 / 双连字符；另删 `---` 分隔线
- `--check` 只报不改（`punct:72-74`），有 finding 时 `exit 1`（`punct:89-90`）
- 不加 `--check` 就地改写并打印 `Done. Changed files: N`（`punct:80,92-93`）
- `--quote-mode keep|ascii|yan`（`punct:8,44`）

> 与 `check-ai-patterns` 的分工（见 `skills/story-review/SKILL.md:155`）：`em-dash` 只采用 ai-patterns 的**按功能改写**建议，`normalize-punctuation` 报的同一位置 `em-dash` 在合并时**去重丢弃**——避免同处出现「机械替换」与「按功能改写」两条打架的 finding。

---

## 5. `wordcount_core.py` — 字数口径 `visible_chars_v1`

### 5.1 排除哪些码点（逐字，`wc:18-23`）

```python
_WHITE_SPACE_CODEPOINTS = frozenset(
    [*range(0x0009, 0x000E)]
    + [
        0x0020, 0x0085, 0x00A0, 0x1680, *range(0x2000, 0x200B),
        0x2028, 0x2029, 0x202F, 0x205F, 0x3000,
    ]
)
```

计数（`wc:134`）：`return sum(ord(character) not in _WHITE_SPACE_CODEPOINTS for character in visible_body(value))`
⇒ **只排空白码点**；标点、Markdown 符号、代码块**都算字**。

### 5.2 双层带（逐字，`wc:167-168`）

```python
"internal": {"min": (target * 88 + 99) // 100, "max": target * 112 // 100},
"user":     {"min": (target * 85 + 99) // 100, "max": target * 115 // 100},
```

`+99 // 100` 即向上取整 ⇒ internal = [ceil(0.88T), floor(1.12T)]；user = [ceil(0.85T), floor(1.15T)]。

作者给定区间时（`wc:164-165` 逐字）：

```python
# 作者给定区间原样优先：内部带与用户带都取它，不再有 borderline。
return {"internal": dict(author), "user": dict(author)}
```

### 5.3 四态（逐字，`wc:216-219`）

```python
internal_pass = bands["internal"]["min"] <= actual <= bands["internal"]["max"]
status = "internal_pass" if internal_pass else (
    "borderline" if user_pass else ("under" if actual < bands["user"]["min"] else "over")
```

⇒ `internal_pass` / `borderline` / `under` / `over`。

### 5.4 正文剥离规则

frontmatter 剥离条件（`wc:113-114` + `wc:122-129`）：
1. 首行是 `---`；
2. 前 200 行内找得到 `---` 或 `...` 闭合，且 `closing >= 2`；
3. 闭合前**至少有一行**匹配 `^[A-Za-z_\u3400-\u9FFF][^:\n]{0,80}:[ \t]*(?:.*)$`（即真有 `key: value`）。

→ 三条同时成立才剥，避免误吃正文。之后再：去开头空行（`_LEADING_BLANK_RE`）→ 去首个 ATX 标题（`^\s{0,3}#{1,6}\s+\S`）。

### 5.5 细纲字数语法的单一镜像

`wc:27-30` 注释逐字：

> 细纲「字数目标」「字数范围」「字数口径」的唯一写法语法；`check-outline-contract.js` 逐字镜像同一组正则，`scripts/test-storyctl.py` 用同一批写法同时跑两边，保证细纲验收过了、章节检查不会再拒。

⇒ **同一组正则被 Python 与 JS 两端镜像**，并有测试同时跑两边防漂移。

---

## 6. `outline_view.py` — 卷纲按作用域取段

作用域标记语法（逐字，`view:28`）：

```python
SCOPE = re.compile(r"^>\s*作用域[：:]\s*(.+?)\s*$")
```

取段规则（逐字，`view:253-254` + `view:268-276`）：

```python
permanent = [s for s in active if s.kind == "卷级常任"]
undeclared = [s for s in active if s.scope is None]
...
if args.stage == "write":
    live = [s for s in owned if s.kind == "单元级"]
else:
    live = [s for s in owned
            if s.kind == "单元级"
            or s.kind == "批次底稿"]
chosen = set(permanent + live + undeclared)
```

⇒ `write` 阶段 = 卷级常任 + 本单元级 + 无声明段；`outline` 阶段另纳入「批次底稿」段。

退役行（逐字，`view:29` + `view:120-123`）：

```python
RETIRED_LINE = re.compile(r"^\s*(?:[-*]\s*)?⊘|^\s*\|\s*⊘")
if keep_history:
    return block_lines
return [line for line in block_lines if not RETIRED_LINE.match(line)]
```

`--strict`（`view:177,191,220`）：缺作用域声明在新建卷纲时记为**错误 E1**，在旧卷纲里只记**警告 W2**（旧段保守纳入）：

```python
(problems if strict else warnings).append(("E1" if strict else "W2", where, "缺「> 作用域：」声明行；旧段保守纳入"))
```

---

## 7. `check-doc-budget.sh` — 加载预算硬上限

- `path_ceiling.limit` 是**每次调用的硬上限**（v0.8.2 起 **35000** 字符）；豁免只能列在 `path_ceiling.exempt` 并写明原因（`budget:17`）
- 口径（`budget:164` 逐字）：「每个角色每次调用（**含每条条件分支与每组叠加**）的加载不得超过 path_ceiling.limit」
- 两条失败分支：单条路径超（`budget:203`）、**最坏叠加组合**超（`budget:275`）
- 防止"静默失效"（`budget:167-168` 逐字）：「path_ceiling.limit 缺失或不是正数……**拼错会让硬上限静默失效**」
- 组合上限 `MAX_COMBOS = 4096`（`budget:223,256`）

---

## 8. `build_chapter_index.py` — 章标题正则族

逐字（`idx:33-42`）：

```python
VOLUME_RE   = re.compile(rf"^\s*第(?P<number>[{NUMBER}]+)卷(?P<title>.*)$")
COMBINED_RE = re.compile(rf"^\s*第(?P<volume>[{NUMBER}]+)卷\s*第(?P<chapter>[{NUMBER}]+)章(?P<title>.*)$")
CHAPTER_RE  = re.compile(rf"^\s*第(?P<number>[{NUMBER}]+)章(?P<title>.*)$")
ENGLISH_RE  = re.compile(r"^\s*Chapter\s+(?P<number>[0-9]+)\b(?P<title>.*)$", re.IGNORECASE)
NUMERIC_RE  = re.compile(r"^\s*(?P<number>[0-9]+)[.．、]\s*(?P<title>.*)$")
SPECIAL_RE  = re.compile(...)   # idx:38，楔子|序章|引子|前言|后记|尾声|番外
TITLE_PREFIX_RE = re.compile(r"^[\s\-—:：、.．]+")
```

行号与 `grep -n` 对齐（`chapter_index.csv` 的 `start_line`/`end_line` 可直接对照原文），并有 `chapter_sha256` / `source_sha256` / `parser_version` 三列。

---

## 9. 本文件未覆盖

- 各阈值**在中文本地的实际误报率**（它的语料是起点/七猫/黑岩，与我们目标平台不同）
- `tracking_commit.py`（1691 行）的 delta/字节预算细节——已判定与我方 M13 等价，未深挖
- `scripts/bench/`（预注册协议 + 非劣效门槛）的完整判据——只作方法论归档，未展开
