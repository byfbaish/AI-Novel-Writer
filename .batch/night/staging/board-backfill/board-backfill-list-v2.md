# 11-24／25 未上板活补卡清单 v2（定稿提案）

- 编制：大管家（群管理分身）｜时间：2026-11-26 02:22｜依据：九名成员全部自查回报 + 我本地读数
- 落板：项目总负责人独任（本清单是提案，不写板）
- 合计 **25 张卡**：A 线 12、B 线 5、C 线 3、D 线 5；另 4 处「挂卡不立卡」；`todo` 仅剩 2 张（卡 4 R3 终审、卡 12 0003 判词）
- 要素：卡名｜归属 Bot｜起点依据（commit／md 路径）｜判据｜状态
- 规矩：一条一卡；**只有判定面与验收主体相同才合并**（R1／R2／R3 不并，QA 判词集可并，见 §E 裁定）
- 已上板不重报：AC2／AC3、PLANUI 三卡（C1／P6／O1）、脱敏线、D 系列

## A. RES 收口线（12 张）

| # | 卡名 | 归属 | 起点依据 | 判据 | 状态 |
|---|---|---|---|---|---|
| 1 | RES-R1 Q1 取证与盲评准入 | 产品经理 | `bd3cac46`→`041b323d`→`7bf974cc`→`0b405bdd`→`aca26e6d`；`res-q1-evidence-1125.md`（138 行／17,802 B／`fe79f812…`） | `CARD-1125-R1` §2 七条 `[static]`（§0.1 最小豁免 A-1、判据 7 可归属式） | done（QA 复判 PASS） |
| 2 | RES-R1b A 件就地更正 | 产品经理 | 含在 `0b405bdd`；`planui-design-assessment.md`（200 行／23,441 B／`5ef35c5c…`） | `[static]` A 件 `grep -c ':1153'`＝0；三处行号统一为 `:1212`／`:1218`／`:722-733`，与 §4 及附录同套；档 1 已落地 `cbbe82c3`；`node scripts/check-fast.mjs` EXIT=0 | done |
| 3 | RES-R2 字段级 diff 规格 | 产品经理（developer 供料） | `ca394095`＋改名 `0a3a1bd4`；`docs/research/2026-11-25-c1-2-field-diff-spec.md`（185 行／20,455 B／`d18ee59a…`） | `CARD-1125-R2` §2 六条 `[static]` | done（R2 结案 PASS） |
| 4 | RES-R3 断言、§2.2 改名与 94 行回填 | 项目总负责人（终审）／大管家（数据）／developer（断言） | `f8b9b5cf` 开卡、`28b9dbb1` 卡面注 3、`da6d381e` QA 复判；`res-b-reason-backfill-1125.md`（137 行／17,342 B／`207f1bd6…`） | `CARD-1125-R3` §3 六条（含 `[live]` 不改码）；数据 94/94 逐字等于 `.bak-2130` | todo（终审待落笔；须标「现行判据看 137 行版」） |
| 5 | RES S1–S4 收口与语料基线采样 | 项目总负责人 | `8be4a154`、`afa72d4c`、`2c3205d5`、`e001416f`、`ac64ae0c` | S4 done-when 五条（QA 判词逐条引用、porcelain 0、check-fast EXIT=0、HEAD＝ls-remote） | done（主人 11-25 亲口裁定 Goal complete） |
| 6 | S2 重跑预算与放行件 | 项目总负责人 | `7a89fd54`、`b1ebc760`、`8e598539`、`376cc229` | 闸值 265k／attempts 21、单进程、20 次即停 | done |
| 7 | S2 按设计缺陷收口＋S3 读者侧口径落地 | 项目总负责人 | `ce21ff96`（14 文件一笔） | 不跑新生成、不设检测通过率指标 | done |
| 8 | S3 口径四件修订 | 项目总负责人 | `b057bd3d` | F-01 去方向歧义、字数下限 20,000、manifest 只定契约、标识义务划出本组 | done |
| 9 | 非商用四源非同源评审汇总＋下轮分配 | 项目总负责人 | `c0855f6c`；`ext-review-1125-four-way-synthesis.md`（53 行／6,266 B／`3407a484…`）、分配件 `84e68d8f…` | 四家 3/4 指向盲评准入；外部评审只作综合与标注，不作整改指令 | done |
| 10 | RES 盲评包 v1（交主人本人判） | 大管家 | `.runtime/res-eval/blind-eval-v1.md`（325 行／25,630 B／`127e0839…`）＋`blind-eval-v1.key.json` | 12 篇匿名、泄漏 grep 0；Bot 不代判、不催签 | done（判定待主人） |
| 11 | 多作者语料采样审校＋章名口径判读 | 金牌编辑 | `res-s3/sampling-audit-v1.md`（146 行／11,138 B／`cb6ceaab…`），随 `afa72d4c` 入库（提交非其所做） | §3 六关核对表可复用；章名三条：长度只进报告／禁运营语支持进闸／不分平台 | done |
| 12 | 0003 样件六关判词 | 金牌编辑 | 前置：主身重交修正版样件（七项） | `sampling-audit-v1.md` §3 六关；`charsBasis:"cjk"`／来源三字段 | todo（前置未满足，卡面须写明） |

## B. 元数据与机制（5 张）

| # | 卡名 | 归属 | 起点依据 | 判据 | 状态 |
|---|---|---|---|---|---|
| 13 | 元数据需求正本锁版与 143 行落值 | 大管家（数据）／项目总负责人（锁版入库） | `2321d203`（正本入库）；`.batch/night/org/book-meta-requirements.md`（需求件版本演进见卡 5） | 锁版 §2.5 字段名一致、94/94 回填逐字等于 `.bak-2130`、`audit-coverage` `14/1197/483/639/143` | done |
| 14 | 本地库元数据补全（227 本／pool143） | 大管家（数据）／developer（工具） | `pool143.qidian-verified.jsonl`（80 行／111,951 B／`8759ef82…`）、`pool143.unresolved.jsonl`（69 行） | 试点 20 本→全量；禁词 0；`channel` 三值；≥30% unknown 停手报 | done |
| 15 | AGENTS.md 三行路由下沉 rule-registry R24–R26 | 项目总负责人＋管家跟班 | `d8f4a846`／`1266483e`（两笔不合并） | 与 AGENTS.md §4 表一致、check:fast 通过 | done |
| 16 | 群 notice 事故与恢复 | 大管家（事故）／主身（恢复） | 主身 11-26 02:18 写入现文 **1,621 字／10 块**、`identical: true`；取证件 `.runtime/ntc/{orig1349.md,draft-final.txt,notice-before-20261126.txt,notice-after-20261126.txt}` | 逐字与定稿一致；三处并入（提交纪律一句／relay.log 凭据一句／新增【看板】）；「三一致」自造词未保留 | done |
| 17 | 每日 10:00 日报机制 | 项目总负责人 | `daily-1000-2026-11-25.md`（42 行／4,014 B） | 四节、≤1500 字、投 `bridge\to-owner` | done |

## C. 派单通道与脚本（3 张）

| # | 卡名 | 归属 | 起点依据 | 判据 | 状态 |
|---|---|---|---|---|---|
| 18 | 派单脚本模型闸（`--model`／`--force`／跨源评审） | 主身 | `1ab5fb59`（doubao）、`1ea450e1`（policy＋attach＋取证件）；`script-guards-verification-20261125.md`（57 行／3,464 B／`09eac005…`） | 未点名回落 DeepSeek-V4.1-Flash、跨源评审必显式点名、付费 Hy4 硬闸、`--allow-auto` 已删 | done（随 `5e313404` 推上） |
| 19 | WorkBuddy 线 C1-a 派单与回执 | workbuddy联络人 | `7b056888…`（12,686 B）、`9f09561a…`（14,112 B），随 `1c0700a1` 入库 | 起点三项闸＋白名单 4 文件；回执复本入 `.batch` 记档 | done |
| 20 | WorkBuddy 线 C1-b 放弃回执 | workbuddy联络人 | `08b3993f…`（55 行／2,643 B） | 撞白名单外授权时只点停止、不出授权 | done |

## D. 判词集与研发取证（5 张）

| # | 卡名 | 归属 | 起点依据 | 判据 | 状态 |
|---|---|---|---|---|---|
| 21 | QA 判词集（11-24 至 11-25，8 份） | QA | `57d05871`→`f21c6979`→`f2fd6d04`→`1c0700a1`→`1754c686`→`8be4a154`／`e001416f`→`ce21ff96`→`09e3fdb9`／`68ab4281`／`288d5eb8`／`cd25a7b1`／`e9429627`／`da6d381e`；8 份件均落 `.batch/night/reports/` | 每份判词对应判定面 sha 与结论可回读（卡面列全 8 行） | done |
| 22 | 语料线工具三件（字体探针／审计工具／池结构） | developer | `res-s3/fanqie-font-probe.md`（64 行／3,780 B／`fe8d15a8…`）＋`afa72d4c`；`.runtime/res-corpus/audit-coverage.mjs`（2,153 B）；`multi-author-v1/MANIFEST.json` | 探针 318/362＝87.8% PUA→汉字、结论「官网不采正文」；审计读数稳定 `14/1197/483/639/143`；schema v2 含 layout／requirements／statisticsPlan、status=pending-external-sampling | done（只读工具，.runtime 内不入库） |
| 23 | S2 配对对照起跑与冻结取证 | developer | `.runtime/res-s2/`（`calls.jsonl` 27 行、`texts-r1` 3 件、`run-1.log` `d164d45f…`） | 起跑 3 条即按行政令冻结；token 48,040／300,000；不重跑 | done |
| 24 | 豆包线外派投递与取证 | 豆包联络人 | `s2-c1/dispatch-doubao-c1b.md`（219 行／24,693 B／`f48c9d18…`）；`C:\tmp\c1-s2\doubao\dispatch-p6-with-ruling.md`（21,965 B／191 行／`f5d851e4…`） | 回执四行原文＋模式闸（本地电脑／DeepSeek V4.1 Flash 高）＋porcelain 读数 | done |
| 25 | 豆包线只读取证（脚本归属／越线提交定位／WB 样本清点） | 豆包联络人 | `41daa79c`（17:17:08）、`8a42a566`（17:38:07）reflog；`.runtime/workbuddy/attach/20261125-205148-…/meta.json`（1,307 B） | 只读、结论可回读；不代提交、不下判定 | done |

## E. 挂卡不立卡（子件）

- 产品经理 `f69a37c4`／`d51a81d0`（需求件 §2.5 v3.2.9→v3.2.10）→ 挂卡 4（`CARD-1125-R3`），判定面同一。
- developer `res-r2-identifier-map.md`（`cd97b66e…`）→ 挂卡 3（`CARD-1125-R2`）。
- developer `res-b-asserts-1125.md`（264 行／20,596 B／`787270b8…`）＋F2 `3b07ffe2` → 挂卡 4（`CARD-1125-R3`）；两条只读实测（CDP 9333 通道、改名后复跑 A1–A5 读数不变）作该卡证据，不单开。
- 金牌编辑 11-24 无产物（待派验单）、developer 11-24 无产物（不在其职责范围）、产品经理 11-24 只读核对、豆包联络人部分只读——**不建空卡**，只在对应卡的历史行注明。

## F. 合并与归属裁定（我定）

1. R1／R2／R3 不并卡：判定面与验收主体各自独立（产品经理提议合并不予采纳）。
2. QA 8 份判词并一张「QA 判词集」：同一持续性职责、同一判定方式（判定面 sha＋结论可回读），且 8 行全写进卡面。
3. 豆包 6 行并两张（投递与取证／只读取证）：同属「转任务＋收回执」这一职责的两个判定面。
4. developer 6 行 → 3 张（语料线工具三件合一／S2 冻结取证；另两条挂卡），只读实测不单开——三件的判定面同为「读得出、核得准」、同批数据同一验收主体。
5. 归属按各人自报的**实际动手者**算，不按 `git log` 作者字段：`bd3cac46`–`0a3a1bd4` 七笔作者字段为仓库默认身份「大管家」，内容与提交操作属产品经理，卡面须注明；身份口径自 `f69a37c4` 起显式。
6. 已上板的 AC／PLANUI／脱敏线／D 系列不重报。
