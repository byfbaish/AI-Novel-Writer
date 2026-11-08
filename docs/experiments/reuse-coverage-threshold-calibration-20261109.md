# 8-gram 整章复用阈值标定报告（卡 caf3f90a · B4）

- 日期：2026-11-09 · 工作区：`wt-2`（基线提交 `09791033`）· 执行方：WorkBuddy（外部通道），由 DSH 中控验收后归档
- 本轮授权：只新建测量脚本 / 报告 / fixtures，**不接线、不改判定器语义、不提交 git**
- 交付物：`scripts/experiments/measure-chapter-reuse.mjs`、本报告、构造样例（原在 `wt-2/.batch/reuse-calibration-fixtures/`，不入库）
- 归档校验（DSH Lead，2026-11-09 01:4x）：在 `wt-2` 独立重跑 `node scripts/experiments/measure-chapter-reuse.mjs --json`，退出 0；`summary` 复现 `groupAMaxRatio=0` / `groupBMinRatio=0.8357…` / `groupBD12ReplayHits=3`，与 §4 一致。语料在 `wt-2/.runtime/corpus/`（不入库），故本报告自带语料清单与 sha 便于复算。

## 0. 口径与来源（先说清"哪套数是主"）

| | 主口径（阈值结论依据） | 对照口径（不替代判定器） |
|---|---|---|
| 实现 | **直接 import** `src/shared/chapter-reuse-coverage.ts` 的 `analyzeChapterReuse` | 算法逐行搬自 `scripts/experiments/d12-direct-rerun.mjs:33-60` |
| 比较域 | **全章正文 vs 上一章全文** | **正文头 1,200 字 vs 上一章结尾 1,000 字** |
| n-gram | 中文 16 字（NFKC + 小写 + 折叠空白 + 删标点） | 8 字（`norm()` 直接删空白/标点/符号） |
| 输出 | `ratio` / `coveredUnits` / `runs` / `longestRun` / `severity` | 头覆盖率 / 最长连续段 / 连续 ≥80 字判重演 |
| 常量 | `REUSE_RATIO_ADVISORY=0.15` · `REUSE_RATIO_BLOCKING=0.35`（从模块读出，未硬编码） | `NGRAM=8` / `HEAD=1200` / `LONG_RUN=80` |

**import 来源：`src/shared/chapter-reuse-coverage.ts`（`analyzeChapterReuse`）**。`.mjs` 不能直接 import `.ts`（内部相对导入无扩展名），照抄 `scripts/measure-ai-flavor-baseline.mjs:174-187` 的「esbuild stdin 内存打包 → `data:text/javascript;base64` 动态 import」。脚本里**没有**第二份 ratio / severity 计算，也没有改判定器常量；**未 import d12 脚本本身**（它有读 trace、写 out 目录的顶层副作用），只把 `:33-60` 的算法参数化为 `guardReading(draft, previousChapter)`。

两套读数**数值不可直接比大小**：主口径分母是「全章可见码元数」，对照口径分母是「头 1,200 字归一化串长度」，归一化与窗口都不同。并列只为看同一对样本两边是否都报警。

### 判定器零改动证明（只读 git）

```
$ git -C "C:/develop/workspace/AI-writer/wt-2" status --porcelain
?? .batch/
?? scripts/experiments/measure-chapter-reuse.mjs

$ git -C "C:/develop/workspace/AI-writer/wt-2" diff --stat
（空）

$ git -C "C:/develop/workspace/AI-writer/wt-2" diff -- src/shared/chapter-reuse-coverage.ts
（空）
```

`status --porcelain` 只有两个 untracked 项（`.batch/` 与新增脚本），没有 `M` 标记；`diff --stat` 与针对判定器的 `diff` 均为空 ⇒ `src/shared/chapter-reuse-coverage.ts` 未被改动，`docs/agents/doc-placement-baseline.json` 亦未改动。

## 1. 语料

来源：`wt-2/.runtime/db-copy/project.db` **只读导出**（`mode=ro`）→ `wt-2/.runtime/corpus/reuse-calibration/`。脚本只读 `.txt` / `manifest.json`，**未用 `better-sqlite3`、未碰任何 `.node` 原生模块、未做 ABI 重建**。编码 UTF-8 无 BOM（逐文件检测首字节，13/13 无 BOM）。

| # | 文件 | 章/版本/状态 | chars | sha256（前 16） | 校验 |
|---:|---|---|---:|---|---|
| 1 | `ch01.txt` | 1 / v1 / finalized | 1741 | `7db9587015e0886f` | sha✓ chars✓ |
| 2 | `ch02.txt` | 2 / v1 / finalized | 1681 | `1ad49ec4215c93e6` | sha✓ chars✓ |
| 3 | `ch03.txt` | 3 / v1 / finalized | 1789 | `5f38425d7fc54fb7` | sha✓ chars✓ |
| 4 | `ch04.txt` | 4 / v1 / finalized | 1647 | `5f0e60225e97b9f4` | sha✓ chars✓ |
| 5 | `ch05.txt` | 5 / v1 / finalized | 1904 | `9685954c08a0b13d` | sha✓ chars✓ |
| 6 | `ch06.txt` | 6 / v1 / finalized | 1972 | `9643ce692e8c1836` | sha✓ chars✓ |
| 7 | `ch06-v2-draft.txt` | 6 / v2 / **draft** | 1710 | `f84f9d9554f394f7` | sha✓ chars✓ |
| 8 | `ch07.txt` | 7 / v1 / finalized | 1961 | `e4ed12439660efc3` | sha✓ chars✓ |
| 9 | `ch08.txt` | 8 / v1 / finalized | 1676 | `f66e574472890906` | sha✓ chars✓ |
| 10 | `ch09.txt` | 9 / v1 / finalized | 1876 | `6ff7ecbd6e4d61b8` | sha✓ chars✓ |
| 11 | `ch10.txt` | 10 / v1 / finalized | 1937 | `1f60ed6fb884d871` | sha✓ chars✓ |
| 12 | `ch10-v2-draft.txt` | 10 / v2 / **draft** | 1725 | `7c7e83aff281fa3f` | sha✓ chars✓ |
| 13 | `ch11.txt` | 11 / v1 / finalized | 1700 | `e6b04fcc5654efce` | sha✓ chars✓ |

**manifest sha 是否对得上：对得上。** 脚本对 13 个 `.txt` 的**原始字节**重算 sha256，13/13 与 `manifest.json` 一致；`Array.from(text).length` 与 `manifest.chars` 13/13 一致。

**抽查的两章：`ch03` 与 `ch09`**（用 python 内置 `sqlite3` 只读打开源库 `file:...?mode=ro`，与导出 txt / manifest 三方比对；未写库）：

```
$ python -c '... sqlite3 read-only: chapter_number in (3,9) and version=1 ...'
ch03 ver=1 status=finalized db_chars=1789 db_sha=5f38425d7fc54fb7 manifest_sha=5f38425d7fc54fb7 sha_match=True txt_equal=True
ch09 ver=1 status=finalized db_chars=1876 db_sha=6ff7ecbd6e4d61b8 manifest_sha=6ff7ecbd6e4d61b8 sha_match=True txt_equal=True
```

即：源库 `contents.body` 与导出 txt **逐字相同**（`txt_equal=True`），其 sha256 与 manifest 登记值一致，状态/版本也与 manifest 相符。

## 2. 逐章表（第 1–11 章 vs 上一章）

主口径＝判定器；对照口径＝d12 生产口径。`ch01` 是基准章、没有上一章，标 NA。

| 章 | 上一章 | 主口径 ratio | coveredUnits | longestRun | severity | d12 头覆盖% | d12 ≥80 连续 |
|---|---|---:|---:|---:|---|---:|---|
| ch01 | — | NA | NA | NA | NA | NA | NA |
| ch02 | ch01 | 0 | 0 | 0 | ok | 0 | 否（最长 0） |
| ch03 | ch02 | 0 | 0 | 0 | ok | 0 | 否（最长 0） |
| ch04 | ch03 | 0 | 0 | 0 | ok | 0 | 否（最长 0） |
| ch05 | ch04 | 0 | 0 | 0 | ok | 0 | 否（最长 0） |
| ch06 | ch05 | 0 | 0 | 0 | ok | 0 | 否（最长 0） |
| ch07 | ch06 | 0 | 0 | 0 | ok | 0 | 否（最长 0） |
| ch08 | ch07 | 0 | 0 | 0 | ok | 0.9 | 否（最长 9） |
| ch09 | ch08 | 0 | 0 | 0 | ok | 2.7 | 否（最长 9） |
| ch10 | ch09 | 0 | 0 | 0 | ok | 1.1 | 否（最长 10） |
| ch11 | ch10 | 0 | 0 | 0 | ok | 0 | 否（最长 0） |

**10 对真实相邻章主口径 ratio 全部为 0**：16 字连续逐字重合的门槛下，正常的承接、重复人物名、复用设定名词都不产生命中。d12 头覆盖最高只有 2.7%、最长连续段 10 字，10/10 不触发 ≥80 判重演——两套口径在真实相邻章上都不报警。

## 3. 四组样例读数

构造样例落盘在 `wt-2/.batch/reuse-calibration-fixtures/`：

| 文件 | 内容 | 复核方式 |
|---|---|---|
| `group-B-rewrite-previous-chapter.json` | 组 B 3 例完整正文 | `lines.join(separator="\n")` 即正文；每例带 `basedOn` / `previousChapterFile` / `replacedChars` / `newOpeningChars` / `construction` |
| `group-C-same-setting-new-plot.json` | 组 C 3 例完整正文 | `lines.join(separator="\n\n")` 即正文；每例带 `previousChapterFile` / `chars` / `construction` |

### 组 A · 真实相邻章（10 对）

见 §2 表。**构造方式**：直接用导出语料，无任何人工改动；`ch02..ch11` 各自 vs 前一章。全部 `ok`，10/10 不误报。

### 组 B · 整章重写上一章、只换开头（人工构造，3 例）

**构造方式**：取一章全文，把开头 150–300 字替换为**本任务自写的全新文字**，其余逐字不动（脚本 `source.slice(cut)`，未做标点/词序扰动）；模拟「新章几乎整章复用上一章、只换开头」。每例的 `previousChapterFile` 就是被复写的那一章本身。

| 例 | 基于 | 替换开头 | 新开头 | vs | 主口径 ratio | longestRun | severity | d12 头覆盖% | d12 最长段 | d12 ≥80 |
|---|---|---:|---:|---|---:|---:|---|---:|---:|---|
| B1 | ch03.txt | 189 | 244 | ch03.txt | 0.8578 | 1335 | **blocking** | 29.8 | 290 | 是 |
| B2 | ch07.txt | 226 | 300 | ch07.txt | 0.8361 | 1389 | **blocking** | 13.8 | 121 | 是 |
| B3 | ch10.txt | 287 | 284 | ch10.txt | 0.8357 | 1326 | **blocking** | 20.6 | 198 | 是 |

（主口径 `longestRun` 为归一化串上的最长重合段，1,326–1,389 字，即"几乎整章连成一段"。任务 §5 对组 B 只要求 ratio / longestRun / severity，脚本的 GROUP B 表未输出 `coveredUnits`，故本表不列该列，也不做任何反推。）

### 组 C · 同题材、同人物、剧情不同（人工构造，3 例）

**构造方式**：本任务自写全新剧情，只共用人物名（陈砚 / 老刘 / 赵铎 / 李执事 / 青苓 / 王会计）与设定名词（断脉岭、度支房、考课簿、生死契、闸机、裂灵石、因果纹、灵配袋、配给律、甲九、东二岔道），**不整段复制任何上一章**，每例 ≥600 字：C1「夜雨修闸机、考课簿被借走」、C2「药房签借据、药气压住因果纹」、C3「封洞后下甲九巷道找残简」。

| 例 | 字数 | vs | 主口径 ratio | coveredUnits | longestRun | severity | d12 头覆盖% | d12 ≥80 |
|---|---:|---|---:|---:|---:|---|---:|---|
| C1 | 675 | ch05.txt | 0 | 0 | 0 | ok | 0 | 否 |
| C2 | 686 | ch08.txt | 0 | 0 | 0 | ok | 0 | 否 |
| C3 | 750 | ch10.txt | 0 | 0 | 0 | ok | 0 | 否 |

### 组 D · 真实改写样本（bonus，真实数据）

`ch06-v2-draft` / `ch10-v2-draft` 是库里 `version=2 / status=draft` 的真实改写版本，非人工构造。

| 对 | 说明 | 主口径 ratio | coveredUnits | longestRun | severity | d12 头覆盖% | d12 ≥80 |
|---|---|---:|---:|---:|---|---:|---|
| D1 | `ch06-v2-draft.txt` vs `ch05.txt` | 第 6 章 v2 vs 上一章 | 0 | 0 | 0 | ok | 0 | 否 |
| D2 | `ch06-v2-draft.txt` vs `ch06.txt` | 第 6 章 v2 vs 同章 v1 | 0 | 0 | 0 | ok | 0 | 否 |
| D3 | `ch10-v2-draft.txt` vs `ch09.txt` | 第 10 章 v2 vs 上一章 | 0 | 0 | 0 | ok | 0 | 否 |
| D4 | `ch10-v2-draft.txt` vs `ch10.txt` | 第 10 章 v2 vs 同章 v1 | 0 | 0 | 0 | ok | 0 | 否 |

D2 / D4 尤其值得注意：`ch10-v2` 与 `ch10` 是**同一段剧情、同一批人物、同样援引《配给账》《考课簿》与"一物二罚"律条、措辞高度相似**的两种写法，判定器仍给 `ratio=0`——因为没有任何 16 字连续逐字相同。这不是漏报（它们本来就不是逐字复用），但说明判定器的判别范围只覆盖「逐字照搬」，不覆盖「改写式复用」。

## 4. 阈值结论（基于主口径）

### 4.1 0.15 / 0.35 是否合理

**结论：在本样本上"零误报、零漏报"，但并没有被真正标定——这两个数落在一段完全没有样本的空档里，当前数据无法证明它们合理，也无法证伪。**

证据：

- **哪几对真实相邻章会误报/漏报：一对都没有。** 组 A 的 10 对逐对全部 `ratio=0 / ok`，没有任何一对触发 advisory 或 blocking；组 C 3 例、组 D 4 对同样全部 0。按现行 0.15 / 0.35 计，误报 0、漏报 0。
- 组 B 3 例整章复写 `ratio=0.8357–0.8578`，全部 `blocking`，零漏报。
- 于是样本分布是**两极**：`0`（17 个样本）与 `0.8357–0.8578`（3 个人工构造样本），中间带 `(0, 0.8357)` **一个样本都没有**。把 advisory 改成 0.01 或 0.60、blocking 改成 0.10 或 0.80，这 20 对的判定结果**完全不变**。所以"阈值是拍的、没标定"这一判断成立，本次测量**给不出数据驱动的更优值**；下面两档是按代价权衡给的建议，不是拟合结果。

**更要紧的一条**：真正的边界不是这两个数字，而是判定器的判别范围。16 字连续逐字重合使 `ratio` 对「改写式复用」完全无感（D2/D4 = 0）。若 B4 的目标是把"整章重写"当故障拦下来，只调阈值不够——它守得住"整章逐字复制 / 大段照搬"，守不住"同剧情换措辞的重写"。这属于指标层问题，超出本任务授权（不接线、不改判定器语义），列为待裁决。

### 4.2 误报 / 漏报评估

| 量 | 值 |
|---|---|
| 真实相邻章最高 ratio（组 A） | **0**（10 对全 0） |
| 组 B 最低 ratio | **0.8357**（B3，基于 ch10） |
| 组 C 最高 ratio | **0**（C1） |
| A 最高 → B 最低 间隔 | **0.8357**，可分 ✓ |
| 现行阈值下组 A 误报 / 组 B 漏报 / 组 C 误报 | 0 / 0 / 0 |

间隔看着很大，但它是由"人工构造的极端整章复写"撑出来的，不是自然故障分布；真实模型输出若只复写 30%、50% 的上一章，`ratio` 会落在中间带，本样本对此**没有任证据**。

### 4.3 两档建议值（明确定义方向，避免"保守/激进"歧义）

| 档 | 定义 | advisory | blocking | 依据 | 代价 |
|---|---|---:|---:|---|---|
| **保守档** | 优先**不打断生成**（阈值抬高，容忍漏报） | **0.20** | **0.50** | 组 B 最低 0.8357，0.50 仍留 0.3357 余量；组 A/C/D 全 0，0.20 以上才提示，本样本零误报 | 复写比例落在 0.20–0.50 的「半章照搬」最多只到 advisory，不会触发 blocking 重新生成，最坏放过一次近半章复用 |
| **激进档** | 优先**不放过整章复写**（阈值压低，容忍误报） | **0.05** | **0.25** | 把 blocking 从 0.35 压到 0.25 可覆盖「复写约四分之一章」；advisory=0.05 在约 70–90 字级复用时先提示 | 一旦别的书/模板存在跨章固定套话（律条原文、口头禅、回目），`ratio` 可能越过 0.05 甚至 0.25，触发误报并打断生成；11 章单项目样本无法证明不会 |

**若只允许改一个数**：建议保留 `advisory=0.15`（本样本零误报，没有证据要动它），只在 `blocking` 上二选一——抬到 0.45（少打断）或压到 0.25（少漏报）。**选哪一档需要产品侧拍板**（更怕"误报打断生成"还是更怕"漏报放过整章重写"），本任务不替作者裁定，也未写入任何代码。

### 4.4 对照口径：为什么生产守卫抓不到整章重写（实测与预设不完全一致）

**先如实报数**：组 B 的 d12 生产口径 **3/3 触发 ≥80 连续**（最长段 B1=290 / B2=121 / B3=198，头覆盖 13.8%–29.8%），与派单卡预设的"抓不到"相反。组 A 则 10/10 不触发（头覆盖 0–2.7%，最长段 ≤10）。

**机制解释（不猜，按窗口算）**：d12 的比较域只有「正文头 1,200 字 ∩ 上一章结尾 1,000 字」。本项目单章 1,647–1,972 字，"结尾 1,000 字"实际覆盖上一章**后 51%–61%**；组 B 只换掉开头 189–287 字，于是上一章的中后段仍然落在新章头 1,200 字窗口内，与 `endingGrams` 重叠 → 命中。命中的是「上一章中段被带进新章头部」，而**不是** d12 设计要防的「开头重演上一章结尾」。换句话说，这次是短章节导致的**窗口重叠假命中**。

**生产守卫真正会漏的情形**：当复写内容落在正文头 1,200 字**之外**（章节更长，或新章前半有足量新增内容把原文挤出窗口），或复写的是上一章**开头**而非结尾时，d12 只看那两个窗口，必然零命中；主口径是「全章 vs 上一章全文」，仍能抓到。这就是「为什么生产守卫抓不到整章重写」的机制答案，也是主口径必须独立于生产口径标定的理由——但**本任务的组 B 三例不足以实证这个漏报**（它们恰好都落在重叠窗口内），需补样例，见 §6。

## 5. 脚本原始输出片段

命令：`node "C:/develop/workspace/AI-writer/wt-2/scripts/experiments/measure-chapter-reuse.mjs"`（最终版，`fixtures` 为 `reused`）。以下为 stdout 原文；宿主终端按约 120 列折行显示，**此处按 `console.log` 的单行输出还原**，数值与文字未改动。stderr 另有 `[measure-chapter-reuse] node v22.22.2 / ABI 127` 一行。

```
=== IMPORT ===
import 来源: src/shared/chapter-reuse-coverage.ts（analyzeChapterReuse）
方式: esbuild stdin 内存打包 + data:text/javascript;base64 动态 import（照抄 scripts/measure-ai-flavor-baseline.mjs:174-187）
常量（从模块读出，未硬编码）: REUSE_RATIO_ADVISORY=0.15 / REUSE_RATIO_BLOCKING=0.35
主口径: 全章 vs 上一章全文 / 中文 16 字 n-gram / ratio+severity；对照口径: d12-direct-rerun.mjs:33-60 / 头 1200 字 vs 上章结尾 1000 字 / 8-gram / 连续 ≥80 字判重演

=== CORPUS VERIFY ===
来源: .runtime/db-copy/project.db 只读导出 → .runtime/corpus/reuse-calibration/ · 编码: utf-8 (no BOM) · 文件数: 13
| 文件 | 字节 | BOM | sha256 匹配 | chars | manifest.chars | chars 匹配 |
|---|---:|---|---|---:|---:|---|
| ch01.txt | 5115 | 否 | 是 | 1741 | 1741 | 是 |
| ch02.txt | 4923 | 否 | 是 | 1681 | 1681 | 是 |
| ch03.txt | 5199 | 否 | 是 | 1789 | 1789 | 是 |
| ch04.txt | 4805 | 否 | 是 | 1647 | 1647 | 是 |
| ch05.txt | 5536 | 否 | 是 | 1904 | 1904 | 是 |
| ch06.txt | 5740 | 否 | 是 | 1972 | 1972 | 是 |
| ch06-v2-draft.txt | 4950 | 否 | 是 | 1710 | 1710 | 是 |
| ch07.txt | 5631 | 否 | 是 | 1961 | 1961 | 是 |
| ch08.txt | 4828 | 否 | 是 | 1676 | 1676 | 是 |
| ch09.txt | 5388 | 否 | 是 | 1876 | 1876 | 是 |
| ch10.txt | 5639 | 否 | 是 | 1937 | 1937 | 是 |
| ch10-v2-draft.txt | 5007 | 否 | 是 | 1725 | 1725 | 是 |
| ch11.txt | 4980 | 否 | 是 | 1700 | 1700 | 是 |
全量校验: sha 匹配 13/13 · chars 匹配 13/13

=== FIXTURES ===
reused: .batch/reuse-calibration-fixtures/group-B-rewrite-previous-chapter.json
reused: .batch/reuse-calibration-fixtures/group-C-same-setting-new-plot.json

=== GROUP A · 真实相邻章（ch01 为基准章，无上一章）===
| 对 | 主口径 ratio | coveredUnits | runs | longestRun | severity | d12 头覆盖% | d12 最长段 | d12 ≥80 |
|---|---:|---:|---:|---:|---|---:|---:|---|
| ch02.txt vs ch01.txt | 0 | 0 | 0 | 0 | ok | 0 | 0 | 否 |
| ch03.txt vs ch02.txt | 0 | 0 | 0 | 0 | ok | 0 | 0 | 否 |
| ch04.txt vs ch03.txt | 0 | 0 | 0 | 0 | ok | 0 | 0 | 否 |
| ch05.txt vs ch04.txt | 0 | 0 | 0 | 0 | ok | 0 | 0 | 否 |
| ch06.txt vs ch05.txt | 0 | 0 | 0 | 0 | ok | 0 | 0 | 否 |
| ch07.txt vs ch06.txt | 0 | 0 | 0 | 0 | ok | 0 | 0 | 否 |
| ch08.txt vs ch07.txt | 0 | 0 | 0 | 0 | ok | 0.9 | 9 | 否 |
| ch09.txt vs ch08.txt | 0 | 0 | 0 | 0 | ok | 2.7 | 9 | 否 |
| ch10.txt vs ch09.txt | 0 | 0 | 0 | 0 | ok | 1.1 | 10 | 否 |
| ch11.txt vs ch10.txt | 0 | 0 | 0 | 0 | ok | 0 | 0 | 否 |

=== GROUP B · 整章重写上一章、只换开头（人工构造）===
| 例 | 基于 | 替换开头 | 新开头 | vs | 主口径 ratio | longestRun | severity | d12 头覆盖% | d12 最长段 | d12 ≥80 |
|---|---|---:|---:|---|---:|---:|---|---:|---:|---|
| B1 | ch03.txt | 189 | 244 | ch03.txt | 0.8578 | 1335 | blocking | 29.8 | 290 | 是 |
| B2 | ch07.txt | 226 | 300 | ch07.txt | 0.8361 | 1389 | blocking | 13.8 | 121 | 是 |
| B3 | ch10.txt | 287 | 284 | ch10.txt | 0.8357 | 1326 | blocking | 20.6 | 198 | 是 |

=== GROUP C · 同题材、同人物、剧情不同（人工构造）===
| 例 | 字数 | vs | 主口径 ratio | coveredUnits | longestRun | severity | d12 头覆盖% | d12 ≥80 |
|---|---:|---|---:|---:|---:|---|---:|---|
| C1 | 675 | ch05.txt | 0 | 0 | 0 | ok | 0 | 否 |
| C2 | 686 | ch08.txt | 0 | 0 | 0 | ok | 0 | 否 |
| C3 | 750 | ch10.txt | 0 | 0 | 0 | ok | 0 | 否 |

=== GROUP D · 真实改写样本（bonus）===
| 对 | 主口径 ratio | coveredUnits | runs | longestRun | severity | d12 头覆盖% | d12 最长段 | d12 ≥80 |
|---|---:|---:|---:|---:|---|---:|---:|---|
| ch06-v2-draft.txt vs ch05.txt | 0 | 0 | 0 | 0 | ok | 0 | 0 | 否 |
| ch06-v2-draft.txt vs ch06.txt | 0 | 0 | 0 | 0 | ok | 0 | 0 | 否 |
| ch10-v2-draft.txt vs ch09.txt | 0 | 0 | 0 | 0 | ok | 0 | 0 | 否 |
| ch10-v2-draft.txt vs ch10.txt | 0 | 0 | 0 | 0 | ok | 0 | 0 | 否 |

=== SUMMARY ===
组 A 最高 ratio: 0（ch02.txt vs ch01.txt）
组 B 最低 ratio: 0.8357（B3）
组 C 最高 ratio: 0（C1）
A 最高 → B 最低 间隔: 0.8357 · 可分: 是
按现行 0.15/0.35：组 A 误报 0 对 （无）；组 B 漏报 0 例 （无）；组 C 误报 0 例 （无）
组 B 的 d12 生产口径：≥80 连续命中 3/3，最低头覆盖 13.8%，各例最长段 B1=290 / B2=121 / B3=198
组 D 各对:
  D1 ch06-v2-draft.txt vs ch05.txt → ratio=0 / ok
  D2 ch06-v2-draft.txt vs ch06.txt → ratio=0 / ok
  D3 ch10-v2-draft.txt vs ch09.txt → ratio=0 / ok
  D4 ch10-v2-draft.txt vs ch10.txt → ratio=0 / ok

说明: 本脚本只测量与统计，未改判定器常量、未接线、未产出阈值裁定；建议值见报告正文。
```

## 6. 未做的事 / 不确定项 / 待裁决

1. **未接线、未改判定器**：`src/shared/chapter-reuse-coverage.ts` 的常量与语义、任何调用点都未动；建议阈值只写在 §4.3，未写入代码。未提交 git（无 `add/commit/push/merge/reset/checkout`），未改 `docs/agents/doc-placement-baseline.json`。
2. **未跑任何测试/构建**：没有 `pnpm test` / `vitest` / `test:browser` / `pnpm test:node` / `pnpm dev` / 打包 / `better-sqlite3` 重建；全程只跑白名单里的新增脚本、`python -c` 只读抽查与只读 git。
3. **样本量小**：11 章、1 个项目（`师父派我来除魔，幕后真凶竟是小师妹`）、1 种文风（番茄向、律条对话体），真实相邻章只有 10 对。
4. **组 B / C 是人工构造**：B 是机械替换开头（未扰动别处标点/词序），C 是本任务自写；都不是模型真实失败输出。组 B 的 `ratio` 集中在 0.8357–0.8578 是构造方式的产物，不代表真实故障分布。
5. **中间带零样本**：`(0, 0.8357)` 没有任何样本，无法用数据拟合阈值；§4.3 两档是成本权衡，不是统计结论。真实模型若只复写 30% / 50% 上一章，读数未知。
6. **适用范围**：结论只对「中文 16 字 n-gram + 1,600–2,000 字章节」成立。英文（`en-US` 走 40 字母 gram）、更长章节、带跨章固定套话的模板需另测。
7. **判定器对改写式复用无感**：组 D 的 D2/D4 = 0 是硬证据。本任务未评估语义相似度等其它指标，也未改动判定器；这是指标层问题，需作者裁决要不要另起一轮。
8. **"生产守卫抓不到整章重写"未被本组样例实证**：组 B 三例 d12 反而 3/3 命中（窗口重叠，见 §4.4）。建议后续补「长章节 / 只在正文后半章复写 / 复写上一章开头」三类样例再验证。
9. **执行过程中的两次作废尝试**（如实记录，不影响最终读数）：① 首次运行后把 B3 新开头从 347 字压回 284 字并给组 B 表补 d12 最长段列，用 `--regen-fixtures` 重建了 fixtures；② 曾试 `| Out-String -Width 400` 想消除终端折行，结果 PowerShell 管道把 node 的 UTF-8 输出按 GBK 解码导致中文乱码，该次输出**作废**，正式读数取纯 `node` 命令的输出。③ 首次 `python -c` 列表推导多写一个 `)` 报 `SyntaxError`，修正后通过，输出见 §1。
10. **待裁决**：保守档（0.20 / 0.50）与激进档（0.05 / 0.25）选哪一档；以及是否要针对「改写式复用」另立指标。这两项都涉及产品取舍与指标层设计，本任务不替作者拍板。
11. **未派上下文隔离子 agent 复核**：本任务只测量出报告；末尾的 `## [T1] DONE` 是派活队列标记，不是自证签字。
