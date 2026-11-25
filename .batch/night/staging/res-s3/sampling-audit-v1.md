# 语料抽查报告 v1（multi-author-v1 · 24 件版）

- 派验人：大肥鱼（admin，群里两次指定：「出正式抽查报告，一份，落 `.batch/night/staging/res-s3/sampling-audit-v1.md`」「报告按 24 件版出」）
- 抽查人：金牌编辑 · AI writer项目组
- 抽查时间：2026-11-25 07:19（Asia/Shanghai）
- 抽查对象：`.runtime/res-corpus/multi-author-v1/`，`MANIFEST.json` 的 `samples` 24 条 ＋ 24 个 `qidian/**/ch0N.txt`
- 口径：admin 四项（首尾完整 / `rawChars＝bodyChars＋removedChars` / `complete`·`slotShift`·`platform` 有无虚填 / 结果只报不改），加我自加一项编码体检
- 边界：**只读**。未改任何样本、未改 `MANIFEST.json`、未写 `measure.jsonl`、未采新章。本报告是唯一写盘产物。

## 0. 结论

**样机批，不进统计。** 编码与字数字段可用，但**章位、七字段、首尾完整性**三项不成立，24 件无法支撑「同章位跨作者可比」的句长/段长读数。

| # | 检查项 | 结果 | 处置 |
|---|---|---|---|
| 1 | 编码可读性 | **通过**（CJK 占比 0.85–0.90，Latin 补充区 0，替换符 0，实体残留 0） | 可留用 |
| 2 | `chars` 与正文实际汉字数一致 | **通过** 24/24（去 `<!-- … -->` 头后逐件相等） | 字数未虚填 |
| 3 | 章位命中第 3/6/9/12 章 | **不通过** 1/24 | 按原章号重取 |
| 4 | 七字段齐全 | **不通过** 0/24 | 补齐后才可统计 |
| 5 | 首尾完整 | **不通过** 17/24 | 见 §2.5，至少 13 件须重取或标 `complete:false` |
| 6 | 来源如实标注 | **基本通过**（`source=mirror-site` 24/24 ＋ note 写明非账号态正版） | 建议字段层再明确平台归属 |
| 7 | 番茄组存在 | **不通过**（`fanqie/` 目录不存在） | 等字体探针结论 |

## 1. 编码可用（可放行的唯一一项）

命令与输出（只读，逐件统计，去注释头后计）：

```
$ node -e '…读 24 个 txt，计 CJK 占比 / Latin 补充区 / 替换符 / 实体残留…'
OK  忘语 ch02.txt cjk占比=0.897 latin=0 替换符=0 实体残留=0
OK  月关 ch03.txt cjk占比=0.868 latin=0 替换符=0 实体残留=0
…
不合格件数=0/24
```

- CJK 占比区间 0.853–0.897；`\u00a0–\u00ff` 命中 0；`\ufffd`／`锟斤拷`／`烫烫`／`屯屯` 命中 0。
- 与 developer 上一轮报的「正文汉字落在 latin1 区段、`latin-1→gbk` 严格回编失败」相比，本批已修好（他核的是 18 件旧版）。
- 残留一处编码类缺陷示例：`qidian/mao_ni/da_dao_chao_tian/ch03.txt:71` 末行为 `&nbs`（`&nbsp;` 从中间断开），说明实体剥离不是整词匹配。

## 2. 缺陷逐条（文件:行 ＋ 命令原文）

### 2.1 章位与文件名脱钩（阻断项）

文件名是槽位号 `ch01`–`ch04`，内容是各书任意章。`MANIFEST.json` 自己记着真实章号（`samples` 起于 `MANIFEST.json:65`）：

- `MANIFEST.json` sample[0]：`"chapter":"ch01.txt"`、`"chapterTitle":"《诡秘之主》第二百三十七章 分钱"`、`"chapterId":"3387720"` → 文件 `qidian/ai_qian_shui_de_wu_zei/gui_mi_zhi_zhu/ch01.txt:1` 头部同证。
- 24 件实测章号：`237,164,192,150,4,2,1,3,103,61,25,139,50,25,82,85,902,—,—,—,57,82,66,29`（末三件 `chapterTitle` 无「第N章」字样，取不到章号）。
- 落在第 3/6/9/12 章的仅 **1 件**：`qidian/fen_nu_de_xiang_jiao/zhui_xu/ch04.txt`（第 3 章）。

后果：统计要的是「同章位可比」，现有批次是各书随机章，章位噪声与作者差异混在一起，`K`／句长读数不可解释。

### 2.2 七字段 24/24 缺失（阻断项）

`MANIFEST.json` 只在字段清单里声明，`samples` 条目里一条都没有：

```
$ grep -c '"rawChars"' MANIFEST.json → 1        # 只在 :23 的字段清单
$ grep -n '"complete"' MANIFEST.json → 26:      "complete",   # 同样只在清单
$ node -e '…统计 samples 里出现次数…'
rawChars 在任何 sample 条目里出现次数=0
bodyChars …=0   removedChars …=0   complete …=0
slotShift …=0   extractorVersion …=0   denoiseRuleVersion …=0
```

`samples` 实际键：`platform, author, book, chapter, chapterTitle, chapterId, url, fetched_at, site, chars, charsBasic, privateUse, source, path, note`。

后果：admin 要核的 `rawChars＝bodyChars＋removedChars` 无从核（不是虚填，是字段不存在）；`complete`／`slotShift` 同理，`slotShift` 在整份文件里 0 次出现。

### 2.3 字数字段本身没虚填（可放行项）

```
$ node -e '…逐件比对 rec.chars 与 去注释头后 CJK 数…'
chars等式成立=24 / samples=24
```

注：正文首行是 `<!-- author: … | url: … | site: … -->` 注释头（例：`qidian/ai_qian_shui_de_wu_zei/gui_mi_zhi_zhu/ch01.txt:1`），统计前必须剔除，并按 spec 计入 `removedChars`；否则每章会多算 10–30 个汉字。

### 2.4 来源标注（基本达标，一处建议）

- 现取值：`"source":"mirror-site"` 24/24；`"site":"www.168text.cc"` 24/24。
- `note` 24/24 含：「正文取自第三方镜像站，非账号态正版；仅内部基线采样，不转载、不分发。」→ 满足 admin「如实标来源、不与正版混算」的要求。
- 建议：`platform=qidian` 与 `site=www.168text.cc` 并列仍可能被外部读者误读为起点官方，建议 `note` 或新增字段写明「qidian 系作品，正文取自第三方镜像 `www.168text.cc`」。
- 抽查中还发现一处**书目替换**已在 `note` 里如实记录：月关原派单书《回到明朝当王爷》在该镜像无书，改用《夜天子》（`MANIFEST.json` sample[20] note）。这条须在基线报告里注明，不只留在 MANIFEST。

### 2.5 首尾完整性 17/24 不成立（我新增的检查，直接影响 `complete`）

判定：末行以 `。！？…”』」` 结尾为通过。

- **12 件末行混入镜像页脚**，形如 `( 书名  p:///N/NNNN/  )`（`p://` 是 `http://` 被去噪规则误剥后的残骸）：

```
qidian/feng_huo/xue_zhong_han_dao_xing/ch01.txt:52:( 雪中悍刀行  p:///1/1668/  )
qidian/feng_huo/xue_zhong_han_dao_xing/ch02.txt:36:( 雪中悍刀行  p:///1/1668/  )
qidian/feng_huo/xue_zhong_han_dao_xing/ch03.txt:71:( 雪中悍刀行  p:///1/1668/  )
qidian/feng_huo/xue_zhong_han_dao_xing/ch04.txt:80:( 雪中悍刀行  p:///1/1668/  )
qidian/wang_yu/fan_ren_xiu_xian_zhuan/ch01.txt:53:( 凡人修仙传  p:///3/3264/  )
… （同型另有 ch02:94 / ch03:55 / ch04:76、夜天子 ch01:58 / ch02:65 / ch03:53 / ch04:62）
```

- **1 件截断**：`qidian/mao_ni/da_dao_chao_tian/ch03.txt:71` → `&nbs`。
- **4 件末句无句末标点**，可能只是正常断句，需人核，不宜直接判废：`gui_mi…/ch02.txt`（末 `“它叫什么负面效果是什么”佛`）、`da_dao_chao_tian/ch02.txt`（末 `井九看着她`）、`da_dao_chao_tian/ch04.txt`（末 `…都加油噢。）`）、`zhui_xu/ch01.txt`（末 `（未完待续）`）。

后果：`complete` 若还缺字段，这 12+1 件就会被当成完整章进统计，页脚残骸直接污染句长与段长。

### 2.6 番茄组为空

```
$ ls -d fanqie 2>&1 → ls: cannot access 'fanqie': No such file or directory
```

`MANIFEST.json` 已声明 `platforms.fanqie`，盘上无目录。按当时 admin 口径（正文停采、只留目录级、等字体探针结论），此项不判缺陷，仅记「缺席」。

> 口径更新 2026-11-25（admin 更正，覆盖上句）：番茄侧改为**正文池**，选书走网友口碑榜、正文同样从第三方镜像站采（番茄官网是私有字体混淆，不采），落 `multi-author-v1/fanqie/<作者>/<书>/<原章号四位>.txt`＋sidecar；两池分存、分平台统计、不混池。故「番茄组为空」只描述 07:20 那一批盘面，不再是待办结论；番茄侧样件到场后按同一套六关核。

## 3. 硬检查（下一批起，主身每交 1 章样件先过此关；admin 11-25 定）

每章入库前必须同时满足，任一不满足即 `complete:false` 并不得计入 `measure.jsonl`。

> 修订 2026-11-25（admin 定稿）：第 4、5 关按定稿口径改写，原「七字段齐全且自洽」「来源」两条措辞作废；其余四关不变。改动仅此文件，未动 `MANIFEST.json`／正文／`measure.jsonl`。

1. **章位**：文件名＝原书章号（`ch003.txt` 这种），`chapterTitle` 里的「第N章」与文件名一致；只收第 3/6/9/12（不可读时按 spec 顺延 4/7/10/13 并标 `slotShift:true`）。
2. **编码**：CJK 占比 >0.5，`\ufffd`／`锟斤拷` 0，`&[a-z]+;`／`&#\d+;` 残留 0。
3. **首尾**：末行以句末标点结尾；末行不得含 `p://`／`http`／书名＋URL 组合页脚；首行不得是导航或站点名。
4. **字符基准与七字段自洽**（admin 11-25 定稿口径）：`charsBasis:"cjk"` 为跨作者比较的唯一基准，同时报 `cjkChars`（汉字数）与 `charsWithPunct`（正文全字符，含标点与空白、不含注释头）；`bodyChars` 钉死为「正文全字符、不含注释头」＝`charsWithPunct`，等式统一写作 **`rawChars = charsWithPunct + removedChars`**，`removedChars` 含注释头与页脚剔除量、含末行作者补话；`platform`（`qidian`／`fanqie`）与 `extractorVersion`／`denoiseRuleVersion` 打具体值。`charsBasis`／`cjkChars`／`charsWithPunct` 缺任一即本关不过——口径未声明则不同作者不可比，缺字段的件不进统计。
5. **来源三字段**（admin 11-25 定稿口径）：`source:"third-party-mirror"`、`site`（实际域名）、`sourceAuthorization` 原句「主人 11-25 授权自采，非账号态正版；仅内部基线采样，不转载、不外传、不训练」，三字段缺一即本关不过；不得与正版账号态样本混算，两池（`qidian/`／`fanqie/`）分存、分平台统计、不混池。
6. **先样件后批量**：先交 1 章（《诡秘之主》第 3 章）过我这份硬检查，通过再批量。

## 4. 本次未做

- 未写 `measure.jsonl`（按 admin「等新样件」）。
- 未改 `MANIFEST.json`、未改任何 txt、未采新章、未进 `docs/`。
- 未做统计读数：本批不满足可比条件，任何句长/段长数字都无意义。

## 附录 · 跑过的只读命令

```
$ ls -R .runtime/res-corpus/multi-author-v1            # 6 组 qidian/<作者>/<书>/，无 fanqie
$ node -e '…24 件：chars 与去头 CJK 比对、编码体检、章号解析、末行标点…'
  → chars等式成立=24/24；编码不合格 0/24；SLOT_HIT=1/24；TAIL_BAD=17/24
$ grep -rn ':///' qidian --include=*.txt | head -12     # 12 行页脚残骸，行号见 §2.5
$ grep -rn '&nbs' qidian | head -5                      # qidian/mao_ni/da_dao_chao_tian/ch03.txt:71
$ for k in rawChars bodyChars removedChars complete slotShift extractorVersion denoiseRuleVersion; do grep -c "\"$k\"" MANIFEST.json; done
  → 1 1 1 1 0 1 1（全部只在 :21–26 的字段清单里，不在 samples）
$ wc -lc MANIFEST.json                                  # 572 23366
$ ls -d fanqie                                          # No such file or directory
```
