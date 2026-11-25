# CARD-1125-R3 首验判词（QA）

- 卡号：CARD-1125-R3（§2.2 四字段改名 ＋ 断言化）
- 判定面：`f941f968`（提交 `f941f968` 入库两件取证：断言件 +334 行、改名件）
- 首验时间：2026-11-25 21:38–21:45（Asia/Shanghai）
- 判定结论：**首验 PASS**（判据 4／5／6 全过；断言件主体过），附 **F1／F2 两项必改或待裁**，改后按 §8 四条最小复核即可封账。
- 派验范围出处：`项目总负责人` 21:3x 派验单（判据 4／5／6 ＋ 断言件五条要素、A4 只作报表行）。

## 1. 判据 4：行数逐件不变 ＋ 三键逐件＝行数 ＋ 旧键残留 0 —— PASS

逐行 JSON 解析（非 grep 计数），7 件**无坏行**：

| 件 | 行 | 字节 |
|---|---|---|
| `book-meta.pilot.qidian-verified.jsonl` | 19 | 19,501 |
| `book-meta.batch2.qidian-verified.jsonl` | 16 | 25,540 |
| `book-meta.batch2.addendum.jsonl` | 1 | 1,754 |
| `book-meta.gap.qidian-verified.jsonl` | 14 | 13,421 |
| `book-meta.gap.unresolved.jsonl` | 9 | 7,264 |
| `book-meta.fanqie-indirect.jsonl` | 4 | 5,960 |
| `book-meta.pool143.qidian-verified.jsonl` | 80 | 111,243 |
| 合计 | **143** | — |

- 行数与改名前逐件相同（对照 §3 备份件的原始字节数与 sha 前 16 位，逐件吻合）。
- `platformId`／`akaTitles`／`matchBasis` 三键**逐件＝行数，7/7 全等**。
- 旧键字面残留：`qidianBookId` 0、`platformBookId` 0、`matchMethod` 0、`titleAlias` 0（全文正则，含嵌套 `rejectedCandidates[].qidianBookId`）。

## 2. 判据 5：`audit-coverage.mjs` 改名前＝改名后 —— PASS（我独立重建，不采信自报）

现盘跑：`files 14  rows 1197  statusRaw null 483  statusRaw missing 639  completionBasis 143  no-status-tag 0  not-collected 0  not-located 0`。

改名前的读数我**自己重建**：用 7 件 `.bak-2130` ＋ 7 件未动件（`all`／`batch2.local-integrity`／`batch2.unresolved`／`pilot`／`pool143.unresolved`／`status-claims`／`chapter-titles`）在 python 里逐行统计，得 `files 14  rows 1197  null 483  missing 639  basis 143` —— **与改名后逐项相同**。即「改名前＝改名后」成立，不是只靠落盘方自报。

回滚可用性：7 件 `.bak-2130` 的字节数与 sha 前 16 位逐件等于改名前一栏（`16782 ac1e420a`／`24636 a939ddd9`／`1731 4864b6d5`／`11713 cf29d8ee`／`6022 52878de8`／`6033 e166b85a`／`109595 77a34075`）。

## 3. 判据 6：`src` 零改动 ＋ 不产生仓库件 —— PASS

- `git diff --name-only -- src` → 0 行。
- `git status --porcelain -uall` → 0 行。
- `.runtime/` 在 gitignore 内，本次落盘未多出任何仓库文件。

## 4. 断言件（`res-b-asserts-1125.md`，264 行／20,226 B／`523df5b3…243d29b`）—— 主体 PASS

- 五条 A1–A5，每条四要素齐：`规则原文`／`触发条件`／`命中后动作`／`可复现命令` 各 5 次。
- **A4 只作报表行**：明写「本行不拒绝、不降级、不打 `conflict`」，与 `5e313404` 版卡面裁定一致。
- **命令我逐条实跑，数字全对**：A1 正向 `3`／反向 `0`／值域外 `44`；A2 `2`；A3(a) `0`／(b) `483`／(c) `0`；A5 `0`；A4 `groups 4 rows 10`。
- 覆盖 `5e313404` 版卡面五类要求：①正向＋反向（`completionBasisSource ∈ {statusRaw,unknown}` ⇒ 显式 `false`）；②单向式 `trust:high` ⇒ `verified:true` 且 `chapterText`；③键存在性三分（`"statusRaw" in obj`）；④同书多件只出清单（A4）；⑤`platformId` 空 ⇒ `matchBasis ≠ id`（A5）。
- 记账：`manual` 49 条里 **42 条是「原件没记匹配方式」**（`res-b-rename-1125.md` §3 载明），报表引用时不得当人工匹配失败率。

## 5. F1（必改，或负责人书面豁免）：`matchBasisReason` 有 68 行落在非 `manual` 行

负责人裁定条件②为「只在 `matchBasis=manual` 行出现；非 `manual` 行不得带」。实测违例 **68 行**：

- `book-meta.batch2.qidian-verified.jsonl`：`matchBasis=title` **16 行**全部带 `matchBasisReason`；
- `book-meta.pool143.qidian-verified.jsonl`：`matchBasis=alias` **52 行**全部带；
- 值为保留下来的原 `matchMethod` 自由文本（如「站内搜索 /so/<书名>.html 取书号 …」「目录《…珍藏版》按书名配对…」）。

`manual` 49 行全部带 reason，无缺。另：需求件现行 v3.2.8（102 行／14,338 B／`b8e559c1…`，提交 `2321d203`）`grep -n matchBasisReason` → **0 命中**，即键表尚无该键行（裁定条件①要求产品经理回写，尚未落）。

两条修法任选其一，**不并行**：
1. 数据侧删掉 68 行的该键（保留映射，理由只留 `manual`），与条件②字面一致；
2. 或由负责人书面放宽为「非 `manual` 行可带 reason 作原文留痕」，并同步把条件②改写进卡面；同时产品经理补 `§2.5` 键表一行（否则该键在正本里无定义）。

## 6. F2（必改文字）：断言件 §0 的「静默 ≥11 小时」论断与盘面不符

断言件 §0 称「数据件 mtime ≤09:54，距取数 ≥11 小时，静默成立」，实测 7 件被改名文件的 **mtime = 21:35:09**，而取证窗写的是 21:32–21:36 —— 两者重叠，该论断不成立。

影响面：A1–A3／A5 的计数不受影响（我在 21:38 之后复跑，与文中数字逐条相同），故**不推翻断言结论**，只需把该行按实际 mtime 改写，并说明「先读盘、随后 §2.2 改名重写，两套键名对 A1–A3/A5 的计数无影响」这一先后关系。

## 7. 记账（不阻断）

- `fanqie-indirect` 是唯一字节变小的件（6,033 → 5,960）：`titleAlias` 的一行冗余形态换成 `akaTitles: []`，属预期。
- `akaTitles` 形态分布 `edition-suffix 12`／`unknown 6`／`promo 3`／`local-file 1`（共 22 条别名），与改名件 §4 逐条对得上；`source:"unknown"`／`"local-filename"` 未补真 URL，落盘方已写明属另一轮取数，不在本卡范围。
- 断言件与改名件的 sha256 与 `HEAD:` blob 逐字相等（`523df5b3…`／`ab3f0580…`），`f941f968` 提交为 2 文件 +334 行，`porcelain 0`。

## 8. 复判最小复核（改完只需这四条）

1. `grep -c '"matchBasisReason"'` 在非 `manual` 行上的命中数 → 0（或出示负责人书面放宽那一句＋需求件新键行）。
2. `grep -n "matchBasisReason" .batch/night/org/book-meta-requirements.md` → 有键表行（若走修法 2）。
3. 断言件 §0 那行新原文（写明实际 mtime 21:35:09 与先后关系）。
4. `git status --porcelain -uall` 0 行、`HEAD` 与 `origin/exp/resource-ledger` 两行 sha 关系照实写（当前落后/领先由出件方给，push 归主身）。

—— QA ·「AI writer项目组」

## 9. 复判（判定面：卡面 `6bdefe4a`／需求件 `f69a37c4`／断言件 `3b07ffe2`，HEAD `3b07ffe2`，`porcelain 0`）

四条最小复核（判词 §8）逐条结果：

1. 非 `manual` 行带 `matchBasisReason` 的命中数 → **68**（`batch2.qidian-verified` `title` 16 ＋ `pool143.qidian-verified` `alias` 52），已被卡面 `6bdefe4a` 修订注 2 书面放宽，F1 的「先决条件」成立。
2. `grep -n matchBasisReason .batch/night/org/book-meta-requirements.md` → 命中 `:67` 一行（v3.2.9，106 行／15,215 B／`3fe1dba4…`），三分（`manual` 必带／非 `manual` 可带／无记录不带＋空串禁止）齐备。
3. 断言件 §0 已按实测改写：`:10` 写「与 §2.2 改名落盘时刻 21:35:09 **有重叠**，静默条件不成立」，`:44` 表行写「7 件改名件＝`21:35:09`；其余 7 件 `08:58`–`09:19`｜**静默不成立**」。F2 消。
4. `HEAD 3b07ffe2`、`git status --porcelain -uall` 0 行、`node scripts/check-fast.mjs` → `0 项不合规`／`全部通过`／`CF_EXIT=0`；三件 blob sha 前 16：断言件 `787270b8a6ad8dc3`、需求件 `3fe1dba42884979c`、卡面 `9983790def7ca58c`。

**F1-b（新增，须一句话定，二选一）**：卡面 `6bdefe4a` 修订注 2 与需求件 `:67` ②都写「值为原 `matchMethod` **原文**」，需求件还明写「不得改写成判断性描述」；但盘上 68 行的值**全部是改写后的说明句**，逐条比对原 `matchMethod`（用 `.bak-2130`）结果为 **0/68 逐字相同**。例：

- `batch2.qidian-verified`：原文「站内搜索 /so/<书名>.html 取书号 → /book/<id>/ 取字段；书号为主键，书名为弱匹配」→ 现值为「书号是检索命中后才取得的，不是既有 id 直查，故按 title 记，不记 id」。
- `pool143.qidian-verified`：原文「目录《…珍藏版》按书名配对 → 书页核验」→ 现值为「本地名带「珍藏版」后缀，按别名（edition-suffix）配对后书页核验」。

即：规则写「原文」，数据是「精简说明」，字面冲突 68/68。两条修法：
- (a) 用 `.bak-2130` 回填原文（68 行字段替换，脚本一次、约 5 分钟，两条文本都不用改，溯源最实）；
- (b) 产品经理把 `:67` ②的「原文」改成「原文或据原文的精简说明（须能回溯到原 `matchMethod`，不得写成与原记录无关的判断）」，卡面修订注 2 同步一句。

我建议 (a)：`manual` 49 行里 42 行本来就写「原件未记匹配方式」，原文回填后整列语义一致，也不会给以后留「说明句算不算留档」的口子。

除此之外，R3 §2.2 改名的判据 4／5／6 与断言件 A1–A5 的结论维持 PASS 不变。
