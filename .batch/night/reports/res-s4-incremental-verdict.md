# 增量判词 · S4 收口第二笔／第三笔三件（QA 首验）

- 判验人：QA · 「AI writer项目组」群分身
- 判验时间：2026-11-25 08:45（Asia/Shanghai）
- 判验对象：`.batch/night/staging/res-s3/` 下三件，取 **入库 blob** 而非盘上文件（`git show <sha>:<path> | sha256sum`）
- 提交链：`8be4a154`（第一笔，已 push）→ `afa72d4c`（第二笔，3 文件 `+253/−3`）→ `2c3205d5`（第三笔，1 文件 `+2/−2`，HEAD）
- 口径依据：admin 11-25 指令「只判这三件：candidates 变更前后差异、probe 是否只作备选证据、`sampling-audit-v1` 六关与 §3 是否就是今天核过的原文」，并「不重核清单本体」

## 判定

**PASS（增量，三件）**。F1（章数口径）已在 `2c3205d5` 消解，其余两件无必改项。

| 件 | 入库 blob（sha256） | 行／字节 | 判定 |
|---|---|---|---|
| `corpus-candidates.md` | `c8e06a8401529988a1db1fb72611a619b5fdfdec31f56dd636a206ba0e3b66b0` | 104／13,352 | PASS（含 F1 修复） |
| `fanqie-font-probe.md` | `fe8d15a8486fd89d8061502d205117e94d00d5fa486eea441a15202778c3da8b` | 64／3,780 | PASS（作备选证据） |
| `sampling-audit-v1.md` | `cb6ceaab700ea49fba3a367e491ebd939f3194cf7610dd0a6d5589b63d491143` | 146／11,138 | PASS（第 4、5 关已按定稿改写） |

## 1. `corpus-candidates.md`

**变更范围**（`git diff afa72d4c 2c3205d5`）：`+2/−2`，只两处。

1. F1 已消 —— `:44` 现文：「阅文 **6 位 × 4 章 = 24 章（已采）**／番茄 **3 位 × 4 章 = 12 章（待采）**……番茄侧 n=3 只报逐作者明细＋`min–max`、不出分位数；阅文侧 n=6，分位数照出。」
   - 与盘面一致：`MANIFEST.json` 的 `samples` 24 条、作者 6 位（爱潜水的乌贼／愤怒的香蕉／烽火戏诸侯／猫腻／忘语／月关）、`platform` 全 `qidian`。
   - 与方案件一致：`corpus-source-plan.md:12`「≥5 位作者×每位≥3 章×共≥20 章」、`:79`「5 位×4＝20 章到底线」、`:86` 章位 3/6/9/12。
   - 原判据「n=3 不出分位数」不再错挂到阅文侧（阅文 n=6）。
2. 出处指针已补 —— `:97` 2,888 码位后加「（读数出处见 `fanqie-font-probe.md`）」。

**前次差异的其余内容**（`afa72d4c` 相对 `8be4a154`，`+43/−3`）我逐段读过，均成立：新增 §5 番茄候选三本（口碑出处、书页/作者页链接、题材、状态字数、与阅文池不重叠说明）、章位与三条限定、§5.1 两条硬事实、§5.2 未做项；头部加一行番茄字体告警。§2 章位行 `:45` 改为 3/6/9/12 并允许顺延 4/7/10/13，与 `sampling-audit-v1.md:121`（硬检查第 1 关）一致。

## 2. `fanqie-font-probe.md`（作备选证据，不进统计链）

- 自证「只作备选证据」：`:3` 结论行与 `:49` 处置行均写「本批不采官网正文，结论仅作备选证据」，处置依据记为 admin 2026-11-25 07:2x。
- 独立性可核：`docs/research/2026-11-25-formulaic-patterns-judgment-list.md` 对 probe **零引用**（`grep -n "fanqie-font-probe\|sampling-audit\|corpus-candidates"` 无命中）；candidates 只经 `:97` 指针引用其读数，不以其为输入。
- 数字自洽（我复算）：`318/362 = 87.85%`（件内写 87.8%）✔；`185/2,236 = 8.27%`（件内写 8.3%）✔；candidates `:97` 的 2,888 个 PUA 码位 − 185 残留 = 2,703 已映射，即按出现计 93.6%、按类型计 87.8%——两个数不矛盾，但属不同分母，报告引用时须写明分母（按类型／按出现）。
- 零模型调用：`:9` 明写「零模型调用；正文 HTML 与解码结果用完即删」，与 §7 留档清单（7 件 63,598 B，正文/参考 OTF 已删）一致。
- 复现性：`:56-59` 给出 fontTools 路线与 `match2.py` 调用式；参考字体未随件留（65 MB 已删），复现需自取，属可接受（件内已注明）。

## 3. `sampling-audit-v1.md`（版本记账 + 六关）

- **版本**：我 07:2x 核过的是 `9c930c82…`（144 行／10,573 B），现行 `cb6ceaab…`（146 行／11,138 B）；差 `+2 行／+565 B`，落点即 `:113`「口径更新（番茄改正文池）」与 `:119`「修订（第 4、5 关按定稿改写）」两块。admin 已确认 `cb6ceaab…` 为定版、`9c930c82…` 作废，本条按「第 4、5 关已按定稿改写」记账。
- **§3 六关位置**：`:121`（1 章位）／`:122`（2 编码）／`:123`（3 首尾）／`:124`（4 字符基准）／`:125`（5 来源三字段）／`:126`（6 先样件后批量）。
- **第 4 关**（`:124`）与我在场核过的定稿一致：`charsBasis:"cjk"` 为唯一基准，同报 `cjkChars`／`charsWithPunct`，等式 `rawChars = charsWithPunct + removedChars`，`platform`／`extractorVersion`／`denoiseRuleVersion` 打具体值，缺任一即不过。
- **第 5 关**（`:125`）一致：`source:"third-party-mirror"`、`site`、`sourceAuthorization` 原句三字段，缺一即不过，两池分存不混算。
- **可核边界（记账，非缺陷）**：我无法用 diff 自证「除 `:113`／`:119` 外无其他措辞差异」——`9c930c82…` 那份没有留副本（金牌编辑同样无副本）。故本条只认「定版 fingerprint ＋ 六关原文与定稿一致」，不主张「逐字仅两处」。

## 4. 三行闸（我在本 HEAD 自跑，取数在写本判词之前）

```
git status --porcelain -uall | wc -l          → 0
git rev-parse HEAD                            → 2c3205d54e5b809e88c79f30633e6b0fd056f1e6
git ls-remote --heads origin exp/resource-ledger → 8be4a154835da8bf80aa030875bb8b1df26add41  refs/heads/exp/resource-ledger
node scripts/check-fast.mjs                   → 全部通过（typecheck ✓ 15.0s／doc links 1486 broken 0／doc-placement 新增 0／batch-hygiene 0 项）CF_EXIT=0
```

**「HEAD＝ls-remote」这一行现在不成立，且按纪律不应成立**：HEAD 领先远端两笔（`afa72d4c`／`2c3205d5`），push 等主人签字，Bot 不代签。stage 4 的该条判据要等 push 之后再取一次两行 sha。

## 5. 记账

1. 我只判这三个 blob；判据清单 `3764f268…` 与 catalog `386d28f6…` 在 `afa72d4c`／`2c3205d5` 中零改动（我复取 `git show <sha>:<path> | sha256sum` 逐字相等），故不重核。
2. 本判词写在 develop 主工作树，落盘后 `porcelain` 会多出 1 行（本文件未跟踪）。这是判词件，不是交件，是否并进下一笔由持有提交权者定；我不自行 commit。
3. 本轮其它并行事项（`book-meta.pilot.qidian-verified.jsonl` `a190045f…`、`book-meta-requirements.md` v3.1）不属这三件，不在本判词范围，另案记录。
