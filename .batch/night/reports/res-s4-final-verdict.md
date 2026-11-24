# RES S4 · QA 终验判词（判据清单成文 · 读者侧口径）

- 判定对象：`docs/research/2026-11-25-formulaic-patterns-judgment-list.md`｜146 行／17,621 B／sha256 `d4bd203ba1fb1b0227321fa13ddd78e27f75193d194059a251dac84521987ff2`
- 同批判定对象：`docs/research/2026-11-25-formulaic-patterns-catalog.md`（181 行／19,685 B，含 `:82` 修订注）、`docs/research/2026-11-25-formulaic-patterns-s3-candidates.md`（86 行／7,798 B，含 `:38` 修订注）、`docs/README.md:51`（索引登记）、`.batch/night/staging/res-s3/corpus-source-plan.md`（185 行／16,237 B）
- 判定人：QA · AI writer项目组｜时间 2026-11-25｜环境：develop 主工作树，HEAD `1266483e`
- **判定：退回补正。** 清单主体（分级尺、去处定稿、先验边界、人判分比、索引登记）全部成立；有三项文本级必改，其中 F2 会把已作废的池名带进 S4 收口提交，改完重取 sha 我再复判，预计一次过。

## 1 已核通过（逐条给原文位置）

| 项 | 结论 | 证据 |
|---|---|---|
| 顶部口径「本课题不以过检测为目标」 | 成立 | 列表 `:3` 首句；`grep -c 不以过检测` = 1 |
| 三字段取值闭包 | 成立 | 25 行 `type` 出界 0（∈ platform/habit/n/a）、`transfer` 出界 0（∈ holds/degrades/fails/unknown/n/a）；`awk` 两栏输出为空 |
| 去处定稿与统计自洽 | 成立 | 表内 25 行＝24 条独立＋F-20b；去处 P17 候选 `F-20b/PS-1/PS-2`（F-20b 不计）、只进报告 9（F-01/03/05/06/08/09/10/11/PS-3）、不做 13（F-02/04/07/12/13/14/15/16/17/18/19/20/PS-4），与 `:77` 逐字一致；2＋9＋13＝24 |
| 复判栏全空、无待定 | 成立 | 25 行第 12 列全空；`grep -n 待定` 只有 `:47`（「无待定」定义句）与 `:138`（「无待定，全部有归属」），都是否定语境 |
| §0.4 先验边界写死 | 成立 | `:36-40`：24 行全是先验初判、跨作者支撑 0 条、未复判不得升级为 P17 硬判据、不得被下游当实测引用、升级须单独一笔修订；与负责人要求逐字对齐 |
| 多作者下限与禁并池 | 成立 | `:26` CV≥10 章、`:30` 禁并池、`:31` n=5–9 只报 min–max 且只进报告、`:34` 判定式两分支（n≥10 用 `P90_跨作者`，n=5–9 取跨作者 `max`），`P90_pool` 只剩否定说明 |
| 人判 : 代理分比 | 成立 | `:97-104` 判定权 100:0、代理只作旁证；与 admin 第 2 条裁定一致 |
| 索引登记 | 成立 | `docs/README.md:51` 同段列出 catalog／candidates／定义件／判据清单四个链接，并写「24 条 = P17 候选 2 ＋ 只进报告 9 ＋ 不做 13（2026-11-25）」；`node scripts/check-fast.mjs` → `doc links: checked 1486, broken 0` |
| 三处文件互相指向 | 成立 | catalog `:82`、candidates `:38` 各一行修订注指向本件 §1，无另开版本；catalog 原「P17 候选 4」保留为核账历史并注明不再作计数依据 |
| 闸门 | 我自跑 | `node scripts/check-fast.mjs` → `[check:fast] 全部通过。`、`0 项不合规`、`doc placement 扫描 447 份…新增 0`、`CF_EXIT=0` |

## 2 必改（三项）

### F1 四行「误报风险」是「—」，与 S3 阶段 done-when「每项标来源等级与误报风险」不符

- 位置：`F-15`（`:65`）、`F-17`（`:67`）、`F-18`（`:68`）、`PS-4`（`:75`），该列均为 `—`。
- 判定：这四行都是「不做」，不设闸就无触发面，写「—」在语义上能解释；但阶段验收项是「每项」，`—` 不是取值。负责人此前「三字段齐全」的核，核的是 `type/basis/transfer`，未覆盖误报风险列。
- 修法（择一，不必展开）：填一句中文反例；或统一写 `不适用：不设闸，无触发面`（不带 `—`）。

### F2 池名作废令没清干净，且残留会进 S4 收口提交

- admin 11-25 令：池子与目录一律 `multi-author-v1`，`platform-pool`／`author-v1` 两种写法作废、不许再出现。
- 盘上残留 4 处：
  - `.batch/night/staging/res-s3/corpus-source-plan.md:64`：`basis 写「本组实测·platform-pool-vN·作者数 n」`（该件 `:81`／`:123`／`:146` 已同步，`:64` 漏了；`s4-closure-note.md:10` 点的三处清单本身也漏了这行）
  - `docs/research/2026-11-25-formulaic-patterns-catalog.md:95`：`--dir .runtime/res-corpus/author-v1`
  - `docs/research/2026-11-25-formulaic-patterns-s3-candidates.md:14`：`.runtime/res-corpus/author-v1/`
  - `docs/research/2026-11-25-formulaic-patterns-s3-candidates.md:42`：`author-v1 人类基线 ≥20 章`
- 判定：这不是清单本身的问题，但这三份件都在 S4 收口提交范围内；带着作废池名入库，与 admin 令直接冲突，且 `:64` 会成为后续 `basis` 的写法模板。
- 修法：四处按 `multi-author-v1` 改（`:42` 那句按实际口径写「多作者池 `multi-author-v1` 的基线」或直接删）；改完 `grep -rn "platform-pool\|author-v1" docs/ .batch/night/staging/res-s3/*.md` 应为 0（历史裁定件 `s3-gate-ruling.md:41` 属已归档裁定原文，可保留——但要在 S4 提交说明里点一句，别让人以为是现口径）。

### F3 「来源等级」的出处指向错文件

- 清单 `:46` 写「照 d18 §1.5（`d18-chapter-hook-contract-design.md:132-139`）：一手·可核／二手·可核／二手·不可复核／内部既有」。
- 实际 `d18:132-139` 的分级是三级且命名不同：`可核（一手）`／`二手，多处一致`／`作者口径（最高）`；清单用的这四档＋`一手·仓内`＋`内部经验值`＋`无出处` 这套词表，定义在 **`catalog.md:23-30`（§1.1 依据判级）**——而 catalog `:23` 自己也写着「沿用 d18 :132-139」，属同一处误引向上传染。
- 判定：等级词表可用、逐行都标了（25 行 0 空格），但「点得开」这一点不成立——按 `:46` 的指针翻 d18 找不到这四档。
- 修法：清单 `:46` 改指 `catalog.md:23-30`（§1.1），并把 catalog `:23` 的「沿用 d18」改成「沿用 d18 的分级思路、词表按本文件 §1.1」这类不再等号的说法。

## 3 记账（不阻断，但 S4 须在提交说明或台账里写一句）

1. **等级词表实际有 7 个取值**：四档之外还有 `一手·仓内`、`一手·仓内 + 仓内文档`、`一手＋二手`、`内部经验值`、`无出处`（F-19）；其中 `内部经验值`（PS-3）与 `无出处`（F-19）在 §1.1 表里没有定义。F3 修的时候可顺手补两行，或明确「这四档是外部来源档，仓内/经验/无出处另计」。
2. **`:38`「24 行全部只是『先验初判』」与 9 行 `先验档` 为 `—` 有措辞张力**：那 9 行是不做项、没给指纹档，说「全部是先验初判」在「未实测」意义下成立，但不严谨。若要改，写成「24 行均未复判；其中 15 行给了先验档、9 行不设档」。
3. **远端与我先前听到的不一致**：`git ls-remote --heads origin` → `1266483e…`（`refs/heads/exp/resource-ledger`）＝本地 HEAD，即远端已不是 `23c6c17b`。S4 收口提交落地后 HEAD 会前进，`HEAD＝ls-remote` 这一条要重取；台账若已写 `23c6c17b` 需要更正。
4. 判定对象是**未跟踪件**（`?? docs/research/…-judgment-list.md`），在收口提交落地前，任何「已入库」的说法都不成立。

## 4 复核方式（改完贴这四条就够，不必重跑 check:fast 之外的东西）

1. 清单新 sha 与 `wc -lc`；F1 四格不再含 `—`（贴 `awk` 或逐行原文）。
2. `grep -rn "platform-pool\|author-v1" docs/ .batch/night/staging/res-s3/` 只剩 `s3-gate-ruling.md:41` 一处（或 0 处）。
3. 清单 `:46` 与 catalog `:23` 的新原文各一行。
4. `node scripts/check-fast.mjs` → `全部通过`、`CF_EXIT=0`；`git status --porcelain -uall` 行数；提交后 `git rev-parse HEAD` 与 `git ls-remote --heads origin` 的 `exp/resource-ledger` 两行相等。

（本判词只做首次验收；S4 阶段 pass、推送与主人签字都不由我代做。）

## 5 复判（追加，§1–§4 原文不动）· 判 **PASS**

对象（四项新指纹，与产品经理、admin 报的逐字一致；我 `wc -lc`＋`sha256sum` 自取）：

| 文件 | 行／字节 | sha256 |
|---|---|---|
| `docs/research/2026-11-25-formulaic-patterns-judgment-list.md` | 146／18,408 | `3764f268449195272f77f91abcee5817890bfa2bba6fcf3814f88f4ef626cb15` |
| `docs/research/2026-11-25-formulaic-patterns-catalog.md` | 181／19,783 | `386d28f64440dc9182e08470048015c4e3a19f73a910b640bba17136d9d5d61f` |
| `docs/research/2026-11-25-formulaic-patterns-s3-candidates.md` | 86／7,877 | `15078f9fa57959975514ee4cb5ab56af85e240234efe0ce19098914d2d6b5b97` |
| `.batch/night/staging/res-s3/corpus-source-plan.md` | 187／17,844 | `cef7c731e23195ea0fef5ac06df6c150d8e7f412713240f409623cc87d15267c` |

### 5.1 §4 四条最小复核逐条

1. **F1 已消**：`grep -c "| — | 不做 |"` → `0`；四行原文（`:65`／`:67`／`:68`／`:75`）「误报风险（中文反例）」列现为
   - F-15 `:65` **高**：误伤以反讽或留白收束的章末…未找到可核中文网文反例，可信度低
   - F-17 `:67` **中**：第三人称限知视角下的必要情绪提示（「他有点慌」）与直陈型标注同形
   - F-18 `:68` **高**：判定本身主观，六模型两两共识仅 0–40% 即此
   - PS-4 `:75` **中**：高对白的庭审／对话章天然句短段短，会被读成形态异常
   四行都是「不做」项，仍给了等级与依据，满足 S3 done-when「每项标来源等级与误报风险」。原先的 `—` 保留在「先验档」列（该列对不做项本就无档），不构成同一问题。
2. **F2 已消**：`grep -rn "platform-pool\|author-v1" docs/research .batch/night/staging/res-s3 | grep -v multi-author` 只剩 `.batch/night/staging/res-s3/s4-closure-note.md:10`——那是负责人收口注里「方案件 v3 需同步三处…」的历史指令句，不是引用；方案件 `:64` 模板已改 `本组实测·multi-author-v1·作者数 n·每位章数 m`；catalog `:95`、candidates `:14`／`:42` 均为 `multi-author-v1`。闸件 `:41` 由负责人改毕（`sed -n '41p'` 取到 `multi-author-v1/`）。
3. **F3 已消**：清单 `:46` 现为「词表正本在 `catalog.md:23-30`（§1.1，五档…）；d18 `:132-139` 是历史三级口径、命名不同，只作沿革，不作引用指针」；catalog `:23` 现为「**本表是词表正本**；d18…为历史三级口径，只作沿革，不作指针」。两处指针都点得到。
4. **三行闸（我自跑）**：`node scripts/check-fast.mjs` → `[check:fast] 全部通过。`（typecheck ✓ 17.9s、`doc links: checked 1486, broken 0`、`doc placement 扫描 447 份 新增 0`、batch-hygiene `0 项不合规`）、`CF_EXIT=0`；`git status --porcelain -uall` 12 行（6 M＋6 ??，全部属本批，逐行列名见 §5.3）；`git rev-parse HEAD` ＝ `git ls-remote --heads origin exp/resource-ledger` ＝ `1266483e42a24f3f2e2dad1a84afe87bc23f987f`。

### 5.2 新增记账（**不阻断**，随收口提交或台账写一句即可）

- **等级词表闭包**：§1.1 现为五档（`一手·可核`／`一手·题名级`／`二手·可核`／`二手·不可复核`／`内部既有`），但 25 行里仍用了 6 个不在表内的基础取值——`一手·仓内`（F-19? 否，见下）、`一手·仓内 + 仓内文档`（F-20b／PS-1／PS-2）、`一手·仓内`（PS-4）、`一手＋二手`（F-18）、`一手＋内部既有`（F-20）、`内部经验值`（PS-3）、`无出处`（F-19），共 8 行。建议在 §1.1 下补一行同义映射（如「仓内自证记 `一手·可核` 的仓内变体；`内部经验值` 归 `内部既有`；`无出处` 记 `无来源`」），或明确「五档只约束外部来源，仓内/经验/无出处另计」。若补进本笔提交，贴新指纹我在 1 分钟内复核，不影响本判 PASS。
- `:38`「24 行全部只是『先验初判』」与 9 行 `先验档` 为 `—` 的措辞张力，原样保留（不阻断）。

### 5.3 porcelain 12 行（提交范围应恰为这 12 项）

```
M  .batch/night/reports/task-ledger.md
M  .batch/night/staging/res-s3/corpus-source-plan.md
M  .batch/night/staging/res-s3/s3-gate-ruling.md
M  docs/README.md
M  docs/research/2026-11-25-formulaic-patterns-catalog.md
M  docs/research/2026-11-25-formulaic-patterns-s3-candidates.md
?? .batch/night/reports/res-s3-indicator-platform-vs-author.md
?? .batch/night/reports/res-s4-final-verdict.md
?? .batch/night/staging/res-s3/baseline-definition-ruling.md
?? .batch/night/staging/res-s3/corpus-candidates.md
?? .batch/night/staging/res-s3/s4-closure-note.md
?? docs/research/2026-11-25-formulaic-patterns-judgment-list.md
```

### 5.4 结论

- 本判词对上述四项指纹成立，**PASS**；F1–F3 三项必改全部消解，主体（逐条引用、索引登记、来源等级、无待定项、`§0.4` 先验边界、池名唯一）在 §1 已逐条给位置。
- 本判词不覆盖提交之后的状态：提交落地后 HEAD 前进，`HEAD＝ls-remote` 须重取一次（admin 或负责人自取即可，我不代签）。
- S4 阶段 pass、推送、主人签字均不由我代做。

（本文件为首次验收判词，追加 §5 后行数与指纹见群内报数；旧版 §1–§4 一字未改。）
