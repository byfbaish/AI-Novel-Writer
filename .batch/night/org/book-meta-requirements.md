# 本地库书目信息补全 · 需求清单 v3.2.9（产品经理，2026-11-25）

对象：`.runtime/res-corpus/local-slices/` 247 本 / 1,151 片。
补全结果落 `.runtime/res-corpus/local-slices/book-meta.jsonl`（一行一本），与切片同目录、不入库不上传。

**v3 相对 v2**：字段名与取值一律按项目总负责人 11-25 裁定改（`platformId`／`akaTitles[].type`＋`source`／`matchBasis` 五值／`notFoundByTitle`／`bookTitle`＝站内名＋`localBookTitle`）。只改这一份，判据清单 24 条一个字不动——元数据层不占判据名额。

**v3.2.9 相对 v3.2.8**：§2.5 补 `matchBasisReason` 条件键三分（项目总负责人 11-25 裁，随 R3 首验 F1 书面放宽条件②落此）；其余字段定义、数字、判据一个字不动。

## 0. 三条前置（不可破）

1. 只把**书名 / 作者名 / 平台名 / 平台内 id** 发出去查；不传正文片段、章名列表或字数以外的内容。
2. 字段级查不到写 `unknown`，**禁止按文风/题材臆测**，禁止把 `unknown` 改写成「其他」。
3. 每个字段带三件套：`sourceUrl`（可点开复核）、`fetchedAt`、`confidence`（`high`＝平台书页/作者页原文；`medium`＝聚合站/自媒体盘点；`low`＝论坛帖/书单转述）。

**每条都带，不是只带不可信的那几条**：状态位降级之后，「完结」必须能看到出处，否则读者分不清「核过末章」与「仍照抄」。`statusClaimTrust`／`completionBasis`／`completionBasisSource`／`completionVerified` 四个字段的覆盖率**按件算**（分母见 §7 第 7 条，不写成「全库全覆盖」）；只有 `completionBasisSource:"chapterText"` 算正文证据，写 `statusRaw` 的一律按「未核正文」记账——不降 `unknown`（那等于把已核结论退回），但报表单列条数。现况（11-25 10:1x，`audit-coverage.mjs`）：**14 个 jsonl／1,197 行／`completionBasis` 143 条**，其中 `completionVerified:true` 只有 2 条——那是准入表判定的结果，不是缺口。

## 1. 必须项（缺一项，这本书就进不了分组统计）

| 字段 | 取值 | 为什么基线要用它 | 查不到怎么办 |
|---|---|---|---|
| `platform` | `qidian`／`fanqie`／`other`／`unknown` | 平台口径 vs 作者癖好的分层键，跨平台对照的组标签 | `unknown`；只进作者癖好侧 |
| `platformId` **主键** | 起点书号／番茄 keyword id | 唯一稳定的书本身份。书名会变（推广名/审核改名），id 不会 | `unknown`；此时 `matchBasis` **不得写 `id`**，该书只进单书描述统计 |
| `bookTitle` | **站内名** | 与站内页面一致才可复核；本地文件名混进来会让抽检打空 | 无此值不得落行 |
| `localBookTitle` | 本地文件名（去掉 `.txt`） | 反向对账用：247 本按 `path` 认，站内名可能对不上 | 无此值不得落行 |
| `matchBasis` | 只准 `id`／`title`／`alias`／`author+wordCount`／`manual` | 统计「书名直接命中率」的唯一依据 | `manual` 须写理由 |
| `authorName` | 作者名 | 多作者池唯一分组键。基线要求「先每位作者各算中位数，再跨作者汇总 min–max＋作者数」 | `unknown`；只进单书描述统计 |
| `authorKey` | 归并键，形如 `qidian:辰东` | 同名不同人、一人多笔名真实存在；只有名字会把两人并进同一个「作者内」方差，把 `K` 压小 | 退化为 `platform:authorName`，标 `authorKeySource:"name-only"` |
| `akaTitles[]` | 多值，**不合并、不归一** | 别名是书名风格样本：推广名、审核改名都是平台行为，与本课题「平台口径」直接相关；同时决定检索召回 | 空数组；没改过名是正常状态，不算缺数据 |
| `akaTitles[].type` | 只准 `promo`（推广名、副标题也归此）／`audit-rename`（审核改名）／`edition-suffix`（出版物／珍藏版与网文版的书名后缀差异，改的是**匹配**不是改名成因）／`local-file`（本地文件名）／`unknown`（共五值） | 成因不同，合并就丢了「平台／出版方为什么改这个名」这条信息；`edition-suffix` 单独一个值是因为它不改变作品身份，只影响检索命中 | `unknown`，保留原名。`edition-suffix` 的 `source` 必须是出版页或珍藏版页 URL，取不到就写 `unknown`；`promo-subtitle` 不新开值，归 `promo` |
| `akaTitles[].source` | 该别名的出处 URL 或本地路径 | 别名最容易被臆造，必须可回溯 | 无出处不得落别名 |
| `firstPublish`＋`exclusive` | 首发站／是否首发 | 搬运本很多：番茄上的书可能起点首发，把搬运本算进平台样本＝测到上游平台文风 | `unknown`；只进作者癖好侧 |
| `statusRaw`＋`statusClaimTrust` | 平台状态原文；`statusClaimTrust` 只准 `high`／`low`，**每条都带** | 平台状态是**运营手法**不是事实：留「连载」可蹭推荐（有人只看连载、等番外） | 只作原文留档，不写 `completion` 结论 |
| `completionBasis` 的三种前缀（`statusRaw` 为 `null` 时必写） | 只准 `no-status-tag`（页面正常打开、确实没有状态标签：出版物页、电子书页属此）／`not-collected`（该本没采状态位）／`not-located`（书页与目录都没定位到） | `null` 必须能读出原因，否则以后分不清「页面确实没有」和「我们没去抓」；不新增字段，写在 `completionBasis` 开头。**只配给 `statusRaw: null`**——`statusRaw` 键根本不存在的属「缺字段」，先补键再谈前缀，两者在审计表里分开列 | 空着——空字段算缺数据，不算「判不了」 |
| `completion`＋`completionBasis`＋`completionBasisSource` | `完结`／`连载`／`unknown`；依据写 `completionBasis`，来源写 `completionBasisSource`（只准 `chapterText`／`statusRaw`／`unknown`），**每条都带** | 优先正文证据：末章是否「（结局）」「全书完」，或末章是「番外／外传／后记」（主线与番外分开看）；只能取自状态位的，`completionBasisSource` 必须写 `statusRaw` | 判不了写 `unknown`，**不许照抄状态位**；`statusRaw` 来源的条目不算「已核正文」 |
| `chapterCount` | 总章数 | 章位分母（现按 10/30/50/70/90% 取章） | 见下条 |
| `completionVerified` | 布尔，**每条都带**；`true` 只在 `completionBasisSource:"chapterText"`（末章正文核过）时成立，其余恒 `false` | 把「字段出处可信」与「完结核过正文」两件事分开——混成一个 `high`/`low` 就会有人拿 `high` 去标「站里说完了」 | `false`；不得省略该字段 |

**三个字段各管一件事**（负责人 11-25 定，不合并）：`confidence` 说这条字段取自哪（平台书页／聚合站／论坛），`completionVerified` 说完结有没有核过末章正文，`statusClaimTrust` 说平台状态位那句话能不能当事实。准入表：

| 情形 | `statusClaimTrust` | `completionVerified` | `completion` |
|---|---|---|---|
| 末章核过、正文与状态位一致 | `high` | `true` | 按正文 |
| 末章核过、正文与状态位相反 | `low` | `true` | 按正文（轮回乐园、道诡异仙属此格，来源写 `chapterText`） |
| 没核末章、只把状态位抄一份留档 | `low` | `false` | 状态位可参考但标未核；判不了写 `unknown` |
| 状态位本身缺失 | `low` | `false` | `unknown` |

**`statusRaw` 键不存在 ≠ `statusRaw: null`**（11-25 10:1x 按 `hasOwnProperty` 实测）：前者是「压根没采」，属缺数据，先补键再谈前缀；后者才是「页面正常打开、确实没这行标签」，配三句前缀。现盘上真正写 `null` 的只有 `batch2.qidian-verified` 16/16、`pool143.qidian-verified` 80/80、`status-claims` 386/424、`fanqie-indirect` 1/4；`all` 227、`batch2.local-integrity` 189、`chapter-titles` 115、`pilot` 20、`batch2.unresolved` 10、`gap.unresolved` 9、`pool143.unresolved` 69 都是**缺键**（全库合计：显式 `null` 483 行／缺键 639 行）。

**平台状态位不可信**（主人 11-25 指正）：轮回乐园、道诡异仙都早已完结，平台标「连载」是运营手法。所以 `completion` 只能由正文证据判，判不出写 `unknown`；两者不一致时以正文为准，并把这对矛盾记进报表（见 §5 第 4 行）。现批 42 条（pilot 19＋gap 14＋unresolved 9）里 `completionVerified:true` 只有 2 条，`high` 为 0 条——这不是缺数据，是按上表本来就该如此。

**`chapterCount` 只认本地切片**：标的 `chapterCountSource:"local"`，书页给的章数只进 `conflict`（314/326、1496/1385 两类冲突两边都留、都不取），因为正文来自本地文件，分母一换「第 10% 章」就会定位到别的章。报表单列一行「分母取本地切片」。

## 2. 有则更好（缺了不影响开跑，只影响解释力）

| 字段 | 用途 | 查不到怎么办 |
|---|---|---|
| `genreTags` | 组内类型不齐会放大作者间方差，要按题材分层复算；也防把题材差异说成平台差异 | 空数组，报告注明「未分层」 |
| `wordCount` | 只做 sanity check（本地 CJK／官方字数≈覆盖率），**不进统计量**；与本地冲突以本地为准 | `unknown`，不估算 |
| `rankInfo` | 只说明「样本偏头部」，不进统计 | `unknown` |
| `serialWindow` | 核对语料是否落在 2024-01–2026-11；连载中书的最后更新日决定后段是否断点 | `unknown` |

## 2.5 数据件键名须对齐本件（改名归补数据那一轮，规则不写进字段定义）

盘上现有键名与本件不一致的，一律按本件改：`qidianBookId`／`platformBookId` → **`platformId`**；自由文本 `matchMethod` 按 `matchBasis` 五值映射，映不上的写 `manual` 并附理由；单值 `titleAlias` → **`akaTitles[]` 一项**（`type` 按上表取值）。改键属 admin 补数据那一轮的动作，本件只写目标形态，不写清洗脚本细节。

**`matchBasisReason`（条件键，负责人 11-25 裁三分）**：键名含义是「理由／原文留存」，不是自由字段，也不替代 `matchBasis`。①`matchBasis:"manual"` 行**必带**，写一句话说明这条匹配是怎么定的（对应本件对 `manual` 须附理由的要求）；②非 `manual` 行**可带**，值只能是原件里原 `matchMethod` 的原文，作来源留档，不得改写成判断性描述；③原件没有匹配方式记录的，`manual` 行带键时值须写明「原件未记匹配方式」，不得编造理由，非 `manual` 行**不带**此键。缺键表示无记录，与空串不同，空串一律不允许。

## 3. 「没查到」必须分开记（口径按负责人裁定）

| 情形 | 记法 | 是否进统计 |
|---|---|---|
| 字段本身页面上没有 | `unknown` ＋ `confidence:"none"` | 该字段不用，其他照用 |
| 按书名查不到、可能换了名 | `notFoundByTitle` ＋ `matchBasis:"alias"` 或 `"author+wordCount"`，**单独计数、不计入 `unknown`** | 走完 id → 作者+字数 两级回退；定位到即改 `matchBasis` |
| id 与作者+字数两级回退后仍定位不到 | `unknown` | 不进统计，报表单列 |

## 4. 冲突处理（已有两个真实先例）

- 同名书不同作者（《漂亮女配又被男主亲哭了》：QQ 阅读标「鹿岁圆」、他站标「折花枝换酒钱」）⇒ 只按书名查会错配作者，落值要求「平台＋作者＋书名三者一致」。
- 搬运站把书中角色写成作者（《轮回乐园》：起点作者「那一只蚊子」，搬运站写「布布汪」）⇒ 以平台书页为准；`布布汪` **不进别名、不与作者并池**，按 error 记进 `conflict`，不校正 `authorKey`。
- `conflict:[{field,valueA,urlA,valueB,urlB}]`，**两值都留**，不取平均、不择一；我裁定后另起一笔改。

## 5. 报表要出的六行

1. 各通道取数率：`readnovel`／`fanqienovel`／`qidian-browser`／`search-snippet` 各占比与 `confidence` 分布。
2. 书名直接命中率：`matchBasis` 分布（写法如 `17/19`）。
3. 别名命中数与类型分布：`promo`／`audit-rename`／`local-file` 各多少条。
4. **状态位与正文证据不一致的条数**（`statusRaw` 与 `completion` 冲突），逐本列出书名与两侧取值。
5. **标 `unknown` 且 `completionVerified:false` 的条数**，另附 `completionVerified:true` 的条数与书名。
6. **三句前缀分布**：`no-status-tag`／`not-collected`／`not-located` 各多少条，另列「`statusRaw` 缺键」的条数（缺键与 `null` 分开计数，不许合并成一个「空」）。

## 6. 回执格式（一行一本，字段顺序固定）

```json
{"path":"《深空彼岸》.txt","localBookTitle":"深空彼岸","bookTitle":"深空彼岸","platform":"qidian","platformId":"1010868264","matchBasis":"title","authorName":"辰东","authorKey":"qidian:辰东","authorKeySource":"name-only","akaTitles":[{"title":"深空彼岸","type":"local-file","source":"《深空彼岸》.txt"}],"firstPublish":"qidian","exclusive":"unknown","completion":"完结","chapterCount":1484,"chapterCountSource":"local","genreTags":["东方玄幻"],"wordCount":null,"rankInfo":null,"serialWindow":null,"confidence":"high","sourceUrl":"https://...","fetchedAt":"2026-11-25T...","conflict":[]}
```

## 7. 验收（七条）

1. `wc -l book-meta.jsonl` = 247，`path` 与 `MANIFEST.books[].path` 集合相等。
2. `grep -E '其他|大概率|推测'` 为空；`unknown`／`notFoundByTitle` 两个计数对得上明细。
3. **`platformId` 非空率**与 **`matchBasis` 分布**各出一行（负责人新增）。
4. 抽 10 本，`sourceUrl` 能打开且作者/平台与落值一致——**按 `bookTitle`（站内名）打 URL**，按本地文件名抽会抽空。
5. 别名条数与类型分布可复核：每条 `akaTitles[].source` 都能打开，且本地文件名不得被记成 `promo`／`audit-rename`。
6. `completion` 抽 5 本独立复核：每本都能指出 `completionBasis` 所指的那一章／那一段原文；`completion` 与 `statusRaw` 不一致的必须出现在 §5 第 4 行的清单里。
7. 覆盖率：`statusClaimTrust`／`completionBasis`／`completionBasisSource`／`completionVerified` 四字段**按件**全覆盖，分母逐件列全——已补全 7 件合计 **143** 条：`pilot.qidian-verified` 19／`batch2.qidian-verified` 16／`batch2.addendum` 1／`gap.qidian-verified` 14／`gap.unresolved` 9／`fanqie-indirect` 4／`pool143.qidian-verified` 80；未补全仍 0 条的：`book-meta.all` 227／`status-claims` 424／`batch2.local-integrity` 189／`pilot` 20／`batch2.unresolved` 10，**这些不得计入分子，也不得写成「全库 247/247 全覆盖」**。另单列：`pool143.unresolved` 69 行（`completionBasis` 0 条、`statusRaw` 缺键 69），同样不计入分子。另单列 `completionBasisSource:"statusRaw"` 的条数与书名、`completionVerified:true` 的书名；`unresolved` 件同样必须带 `completionBasis`，写明为什么判不了（取不到状态位也取不到末章正文即写 `unknown` 并附理由）。
