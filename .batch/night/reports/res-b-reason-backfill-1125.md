# CARD-1125-R3 · `matchBasisReason` 原文回填备案（94 行：旧 `matchMethod` 原值 → 现值）

规则（负责人 2026-11-25 21:56 定，最终版）：只要一行有 `matchBasis`，就必须带 `matchBasisReason`——`manual` 行写实情说明句，其余行写原件 `matchMethod` 原文逐字。

## 执行

在 `.runtime/res-corpus/local-slices` 下：

```bash
python ../../res-corpus/rename-r3-backfill.py --dry     # 出计数与对照，不写盘
python ../../res-corpus/rename-r3-backfill.py --write   # 写盘；备份 .bak-2200 为首次创建（21:51:31），之后各轮不再新建
```

## 实际执行过程（四段：68 → 72 → 误触与还原 → 94 收口）

```
① 21:52  --dry   : rows_with_reason=117 backfilled=68 manual_kept=49 missing_orig=0
   21:52  --write : rows_with_reason=117 backfilled=68 manual_kept=49 missing_orig=0
                  → 68 行（batch2.qidian-verified 16 title + pool143.qidian-verified 52 alias）回填为原文
② 21:53  --dry   : non_manual=94 filled_new=26 replaced=0 manual_kept=0   ← 误把 pool143 的 22 行 author+wordCount 也算进范围
   21:53  --write : 同上，26 行落盘（fanqie 4 + pool143 22）——属误触
   21:54  还原    : cp book-meta.pool143.qidian-verified.jsonl.bak-2200 → 现值（pool143 22 行恢复为无键）；fanqie 4 行保留
③ 21:55  --dry/--write : non_manual=72 filled_new=0 already=72 ← 幂等，按 72 口径出备案
④ 21:56  --dry   : non_manual=94 filled_new=22 already=72 manual_kept=49 missing_orig=0 other_basis_no_reason=0
   21:56  --write : 补 pool143 22 行 author+wordCount 的键 → 94 行收口
```

误触与还原说明：②那轮脚本按「非 manual 且原件有原文」动手，对 `author+wordCount` 22 行也加了键；当时口径是「72 = 68 + 4」，故按 `.bak-2200` 整件还原 `pool143.qidian-verified`（22 行恢复为无键，行数与其余内容未变）。负责人 21:56 复核后裁定「只要一行有 `matchBasis` 就必须带键」，即误触方向正确、原口径把范围说小了，于是④把 22 行按同一规则补回，**现盘 94 行全部带键、且逐字等于 `.bak-2130` 原文**（`pool143` 为 80 行／111,951 B／`8759ef82f06805d1…`）。

备份与回滚：`.bak-2200` 只在 21:51:31 首次创建一次，③④两轮写盘**没有新建备份**（脚本对已存在的 `.bak-2200` 不覆盖）；因此回滚依据是本轮唯一一份 `.bak-2200`（72 版状态）与原文来源 `.bak-2130`。

构成（143 行全覆盖）：**16 `title` ＋ 52 `alias`（`pool143`）＋ 4 `title`（`fanqie-indirect`）＋ 22 `author+wordCount`（`pool143`）＝ 94 行回填原文**，另 **49 `manual` 行**（pilot 19／gap.qidian 14／gap.unresolved 9／pool143 6／batch2.addendum 1）写说明句、不在本文对照表内。

口径变更留痕：`68`（16+52，首轮）→ `72`（+`fanqie-indirect` 4）→ **`94`（+`pool143` 22 行 `author+wordCount`）**。第三次扩范围是负责人 21:56 群内裁定「只要一行有 `matchBasis` 就必须带键」，起因是我第二轮误触把 22 行加了键、又按 72 口径还原——裁定认为误触方向正确、是原口径把范围说小了，故一次覆盖到底，避免同一列出现两种处置。

原文唯一来源：`.bak-2130`（改名前的原始字节，在 `.gitignore` 的 `.runtime/` 内、不入库，故本文件入库留档）。回填前状态另存 `.bak-2200`。

## 逐行对照（94 行）

| # | 文件 | `platformId` | `matchBasis` | 旧 `matchMethod` 原值＝回填后的 `matchBasisReason` |
|---|---|---|---|---|
| 1 | book-meta.batch2.qidian-verified.jsonl | `1001535085` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 2 | book-meta.batch2.qidian-verified.jsonl | `1001535109` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 3 | book-meta.batch2.qidian-verified.jsonl | `1015504057` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 4 | book-meta.batch2.qidian-verified.jsonl | `1015985979` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 5 | book-meta.batch2.qidian-verified.jsonl | `1015985984` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 6 | book-meta.batch2.qidian-verified.jsonl | `1015985994` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 7 | book-meta.batch2.qidian-verified.jsonl | `1015986001` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 8 | book-meta.batch2.qidian-verified.jsonl | `1015986005` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 9 | book-meta.batch2.qidian-verified.jsonl | `1015986040` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 10 | book-meta.batch2.qidian-verified.jsonl | `1015986080` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 11 | book-meta.batch2.qidian-verified.jsonl | `1015986102` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 12 | book-meta.batch2.qidian-verified.jsonl | `1015986114` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 13 | book-meta.batch2.qidian-verified.jsonl | `1015986131` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 14 | book-meta.batch2.qidian-verified.jsonl | `1015986135` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 15 | book-meta.batch2.qidian-verified.jsonl | `1015986139` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 16 | book-meta.batch2.qidian-verified.jsonl | `1043130469` | title | 站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配 |
| 17 | book-meta.fanqie-indirect.jsonl | `1037114325` | title | 作者+标题一致（起点正本） |
| 18 | book-meta.fanqie-indirect.jsonl | `7147596144942517284` | title | 标题+作者+目录章数三重一致 |
| 19 | book-meta.fanqie-indirect.jsonl | `7380211153592388632` | title | 标题精确一致 + 作者一致 |
| 20 | book-meta.fanqie-indirect.jsonl | `7590221243043826712` | title | 标题精确一致 + 书号对应 |
| 21 | book-meta.pool143.qidian-verified.jsonl | `1001535134` | alias | 站内搜索书名 → 书页九字段核对 → subtitle-stripped |
| 22 | book-meta.pool143.qidian-verified.jsonl | `1001864708` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 23 | book-meta.pool143.qidian-verified.jsonl | `1001864722` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 24 | book-meta.pool143.qidian-verified.jsonl | `1001864780` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 25 | book-meta.pool143.qidian-verified.jsonl | `1001864833` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 26 | book-meta.pool143.qidian-verified.jsonl | `1001864854` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 27 | book-meta.pool143.qidian-verified.jsonl | `1001865031` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 28 | book-meta.pool143.qidian-verified.jsonl | `1001865032` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 29 | book-meta.pool143.qidian-verified.jsonl | `1001865052` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 30 | book-meta.pool143.qidian-verified.jsonl | `1001865104` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 31 | book-meta.pool143.qidian-verified.jsonl | `1001865234` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 32 | book-meta.pool143.qidian-verified.jsonl | `1001865235` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 33 | book-meta.pool143.qidian-verified.jsonl | `1001865301` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 34 | book-meta.pool143.qidian-verified.jsonl | `1001865304` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 35 | book-meta.pool143.qidian-verified.jsonl | `1001865373` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 36 | book-meta.pool143.qidian-verified.jsonl | `1001869428` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 37 | book-meta.pool143.qidian-verified.jsonl | `1015504040` | alias | 站内搜索书名 → 书页九字段核对 → subtitle-stripped |
| 38 | book-meta.pool143.qidian-verified.jsonl | `1015504057` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 39 | book-meta.pool143.qidian-verified.jsonl | `1015985960` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 40 | book-meta.pool143.qidian-verified.jsonl | `1015985962` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 41 | book-meta.pool143.qidian-verified.jsonl | `1015985964` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 42 | book-meta.pool143.qidian-verified.jsonl | `1015985967` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 43 | book-meta.pool143.qidian-verified.jsonl | `1015985969` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 44 | book-meta.pool143.qidian-verified.jsonl | `1015985971` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 45 | book-meta.pool143.qidian-verified.jsonl | `1015985973` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 46 | book-meta.pool143.qidian-verified.jsonl | `1015985977` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 47 | book-meta.pool143.qidian-verified.jsonl | `1015985981` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 48 | book-meta.pool143.qidian-verified.jsonl | `1015985986` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 49 | book-meta.pool143.qidian-verified.jsonl | `1015985988` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 50 | book-meta.pool143.qidian-verified.jsonl | `1015985990` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 51 | book-meta.pool143.qidian-verified.jsonl | `1015985992` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 52 | book-meta.pool143.qidian-verified.jsonl | `1015985996` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 53 | book-meta.pool143.qidian-verified.jsonl | `1015985999` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 54 | book-meta.pool143.qidian-verified.jsonl | `1015986036` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 55 | book-meta.pool143.qidian-verified.jsonl | `1015986038` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 56 | book-meta.pool143.qidian-verified.jsonl | `1015986042` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 57 | book-meta.pool143.qidian-verified.jsonl | `1015986044` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 58 | book-meta.pool143.qidian-verified.jsonl | `1015986046` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 59 | book-meta.pool143.qidian-verified.jsonl | `1015986048` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 60 | book-meta.pool143.qidian-verified.jsonl | `1015986058` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 61 | book-meta.pool143.qidian-verified.jsonl | `1015986063` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 62 | book-meta.pool143.qidian-verified.jsonl | `1015986065` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 63 | book-meta.pool143.qidian-verified.jsonl | `1015986067` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 64 | book-meta.pool143.qidian-verified.jsonl | `1015986069` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 65 | book-meta.pool143.qidian-verified.jsonl | `1015986076` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 66 | book-meta.pool143.qidian-verified.jsonl | `1015986086` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 67 | book-meta.pool143.qidian-verified.jsonl | `1015986088` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 68 | book-meta.pool143.qidian-verified.jsonl | `1015986090` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 69 | book-meta.pool143.qidian-verified.jsonl | `1015986092` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 70 | book-meta.pool143.qidian-verified.jsonl | `1015986096` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 71 | book-meta.pool143.qidian-verified.jsonl | `1015986098` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 72 | book-meta.pool143.qidian-verified.jsonl | `1015986100` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 73 | book-meta.pool143.qidian-verified.jsonl | `1015986104` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 74 | book-meta.pool143.qidian-verified.jsonl | `1015986106` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 75 | book-meta.pool143.qidian-verified.jsonl | `1015986108` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 76 | book-meta.pool143.qidian-verified.jsonl | `1015986110` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 77 | book-meta.pool143.qidian-verified.jsonl | `1015986112` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 78 | book-meta.pool143.qidian-verified.jsonl | `1015986116` | alias | 站内搜索书名 → 书页九字段核对 → edition-suffix-stripped |
| 79 | book-meta.pool143.qidian-verified.jsonl | `1015986118` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 80 | book-meta.pool143.qidian-verified.jsonl | `1015986122` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 81 | book-meta.pool143.qidian-verified.jsonl | `1015986129` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 82 | book-meta.pool143.qidian-verified.jsonl | `1015986133` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 83 | book-meta.pool143.qidian-verified.jsonl | `1015986137` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 84 | book-meta.pool143.qidian-verified.jsonl | `1015986233` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 85 | book-meta.pool143.qidian-verified.jsonl | `1015986243` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 86 | book-meta.pool143.qidian-verified.jsonl | `1015986245` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 87 | book-meta.pool143.qidian-verified.jsonl | `1015986247` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 88 | book-meta.pool143.qidian-verified.jsonl | `1015986249` | alias | 目录《卫斯理珍藏版》按书名配对 → 书页核验 |
| 89 | book-meta.pool143.qidian-verified.jsonl | `1017423350` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 90 | book-meta.pool143.qidian-verified.jsonl | `1017423352` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 91 | book-meta.pool143.qidian-verified.jsonl | `1017423356` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 92 | book-meta.pool143.qidian-verified.jsonl | `1017423358` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 93 | book-meta.pool143.qidian-verified.jsonl | `1017423363` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |
| 94 | book-meta.pool143.qidian-verified.jsonl | `1017423366` | author+wordCount | 站内搜索书名 → 同名候选中按作者/字数过滤 |

合计行数：94；件内 `matchBasisReason` 键总数（含 `manual`）：143。
