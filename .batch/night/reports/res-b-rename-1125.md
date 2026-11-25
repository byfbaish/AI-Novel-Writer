# CARD-1125-R3 §2.2 四字段改名 · 落盘取证（admin，2026-11-25 21:3x）

落盘方：admin（数据单一写者）。卡号 CARD-1125-R3。起点 sha `f8b9b5cf`（开卡笔）；实际落盘时 HEAD 已因主人 push 变为 `5e313404`，改名不涉仓库文件，二者都可作基线。
范围：`.runtime/res-corpus/local-slices/` 下 7 件 jsonl（= 需求件 §7 第 7 条已补全的 143 条：pilot 19／batch2 16／addendum 1／gap-verified 14／gap-unresolved 9／fanqie-indirect 4／pool143 80）。
脚本：`.runtime/res-corpus/rename-r3.py`（`--dry` 出计划、`--write` 落盘）；机器可读结果 `.runtime/res-corpus/rename-r3-report.json`。
备份：逐件 `.bak-2130`（改名前的原始字节，可回滚）。

## 1. 改名规则（按需求件 §2.5 现值名，不新增语义）

| 旧 | 新 | 处理 |
|---|---|---|
| `qidianBookId`／`platformBookId` | `platformId` | 顶层键改名；嵌套 `rejectedCandidates[].qidianBookId` 一并改名（1 处） |
| `matchMethod`（自由文本） | `matchBasis`（五值）＋`matchBasisReason` | 见 §3 映射表；`manual` 逐条写理由 |
| `titleAlias`（str／dict／list／null） | `akaTitles[]` | 见 §4；`type` 五值 `promo`／`audit-rename`／`edition-suffix`／`local-file`／`unknown` |

`matchBasisReason` 是本次新增的伴随键：需求件 `:24` 写明「`manual` 须写理由」，而 §2.5 目标键表里没有理由字段，故按需补一个；仅在 `manual` 行出现，非 `manual` 行不带。若 QA 认定键表严格封闭，可把理由搬进旁挂件、数据里只留 `manual`——需负责人一句裁定。

## 2. 逐件 改名前 → 改名后（wc -lc ＋ sha256，前 16 位）

```
book-meta.pilot.qidian-verified.jsonl           前 19 16782 ac1e420ac631496b  → 后 19 19501 a31794e3b49fe62d
book-meta.batch2.qidian-verified.jsonl          前 16 24636 a939ddd97237a247  → 后 16 25540 e8c3e73c9cab1996
book-meta.batch2.addendum.jsonl                 前  1  1731 4864b6d50da7b23e  → 后  1  1754 ad42b7e304b170cf
book-meta.gap.qidian-verified.jsonl             前 14 11713 cf29d8ee5aa66738  → 后 14 13421 943f2c67c5806f1a
book-meta.gap.unresolved.jsonl                  前  9  6022 52878de8f4d1f375  → 后  9  7264 b7136973a9d8088b
book-meta.fanqie-indirect.jsonl                 前  4  6033 e166b85ac922036d  → 后  4  5960 3ea9467f4b0141cc
book-meta.pool143.qidian-verified.jsonl         前 80 109595 77a340756e22fa70 → 后 80 111243 e129ccb87aace681
合计                                            143 行 → 143 行（行数逐件不变）
```

`fanqie-indirect` 是唯一字节变小的：`titleAlias` 一行冗余形态被换成 `akaTitles: []`。

## 3. `matchMethod` → `matchBasis` 映射（原文字面 → 新值，逐条计数）

| 原文字面 | 条数 | 新值 | 理由 |
|---|---|---|---|
| 目录《卫斯理珍藏版》按书名配对 → 书页核验 | 49 | `alias` | 本地名带版本后缀，按别名（edition-suffix）配对后书页核验 |
| 站内搜索书名 → 同名候选中按作者/字数过滤 | 22 | `author+wordCount` | — |
| 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 | 16 | `title` | 书号是检索命中后才取得的，不是既有 id 直查，故不记 `id` |
| 站内搜索书名 → 书页九字段核对 → subtitle-stripped | 2 | `alias` | 书名带副标题，剥副标题后命中（promo） |
| 站内搜索书名 → 书页九字段核对 → edition-suffix-stripped | 1 | `alias` | 书名带版本后缀，剥后缀后命中 |
| title+genre+wordcount（…取更接近且完本者） | 1 | `manual` | 五值都套不上：书名一致、靠题材+字数人工择一，无作者锚点 |
| 标题精确一致 + 作者一致／标题+作者+目录章数三重一致／标题精确一致 + 书号对应／作者+标题一致（起点正本） | 4 | `title` | — |
| 平台无单篇页，见合集《朝闻道》《全频带阻塞干扰》《宇宙坍缩》目录第 N 章 | 6 | `manual` | 短篇无单篇页，按合集目录定位，五值均不覆盖此路径 |
| （无 `matchMethod` 键） | 42 | `manual` | 原件未记录匹配方式，不臆造 |

合计 `manual` 49／`title` 20／`alias` 52／`author+wordCount` 22＝143。
`manual` 里 42 条是「原件没记」，不是「记录了但映不上」——报表引用时两者要分开，别把 42 当人工匹配失败率。

## 4. `titleAlias` → `akaTitles[]`

- `null`／缺键 → `[]`（13 件补空数组；没改过名是正常状态）
- 单值 str 12 条：`珍藏版` 后缀 11 条 → `[{title, type:"edition-suffix", source:"unknown"}]`（珍藏版页未取得，按需求件只能写 `unknown`）；另 1 条按 `unknown`
- list 14 条（`gap.qidian-verified`）：`alias` 键改 `title`，`type`／`source` 原值保留；其中 `source:"local-filename"` 是「本地文件名」的标记值，不是 URL，未改
- dict 3 条（`pool143`）：`{'qidian': '<平台名>', 'type':'promo-subtitle'}` → `[{title:<平台名>, type:"promo", source:<该书 sourceUrl>}]`（`promo-subtitle` 归 `promo`，需求件 `:28` 明写不新开值）

分布：`edition-suffix` 12／`unknown` 6／`promo` 3／`local-file` 1，共 22 条别名、143 行数据。

## 5. 判据自检

- 判据 4：行数逐件不变（上表）；`grep -c '"platformId"'`／`'"akaTitles"'`／`'"matchBasis"'` 逐件＝行数（7/7 件全等）；旧键四种字面残留全 0。
- 判据 5：`node .runtime/res-corpus/audit-coverage.mjs` → `files 14  rows 1197  statusRaw null 483  statusRaw missing 639  completionBasis 143`，与改名前逐字一致。
- 判据 6：`git diff --name-only -- src` → 0 行；`.runtime/` 在 gitignore 内，`git status --porcelain -uall` 未因本次落盘多出任何仓库文件（唯一 `??` 是 developer 的 `res-b-asserts-1125.md`）。

## 6. 未做／边界

- 未改需求件 §2.5 字段定义（一字未动）。
- 未补历史缺失字段（`matchMethod` 缺失的 42 条只记 `manual`，不臆造来源）。
- 未动 `book-meta.all`／`status-claims`／`batch2.local-integrity`／`pilot`／`batch2.unresolved`／`pool143.unresolved`／`chapter-titles`（这 7 件不含本次四个旧键，或本就不在 143 条分子内）。
- 未修 `akaTitles[].source` 里的 `unknown`／`local-filename`（要补真 URL 属另一轮取数，不在改名范围）。
