# 11-24／25 未上板活补卡清单 v1

- 编制：大管家（群管理分身）｜时间：2026-11-26 02:20｜依据：各成员自查回报 + 我本地读数
- 落板：项目总负责人独任（本清单只是提案，不写板）
- 要素：卡名｜归属 Bot｜起点依据（commit／md 路径）｜判据｜状态
- 规矩：一条一卡、不合并；已上板（AC／PLANUI／脱敏线）不重报；无产物者写原因
- v1 状态：项目总负责人、workbuddy联络人、产品经理、金牌编辑已报；QA／developer／豆包联络人待报（标「待补」）

## A. RES 三卡与收口线

| # | 卡名 | 归属 | 起点依据 | 判据 | 状态 |
|---|---|---|---|---|---|
| 1 | RES-R1 Q1 取证与盲评准入 | 产品经理 | `bd3cac46`→`041b323d`→`7bf974cc`→`0b405bdd`→`aca26e6d`；`.batch/night/reports/res-q1-evidence-1125.md`（138 行／17,802 B／`fe79f812…`） | `CARD-1125-R1` §2 七条 `[static]`（含 §0.1 最小豁免 A-1、判据 7 可归属式） | done（QA 复判 PASS） |
| 2 | RES-R1b A 件就地更正 | 产品经理 | 含在 `0b405bdd`；`.batch/night/reports/planui-design-assessment.md`（200 行／23,441 B／`5ef35c5c…`） | 三处行号统一（`:1212`／`:1218`／`:722-733`）＋档 1 已落地 `cbbe82c3` | done |
| 3 | RES-R2 字段级 diff 规格 | 产品经理（developer 供料） | `ca394095`＋改名 `0a3a1bd4`；`docs/research/2026-11-25-c1-2-field-diff-spec.md`（185 行／20,455 B／`d18ee59a…`）；供料 `res-r2-identifier-map.md`（129 行／`cd97b66e…`） | `CARD-1125-R2` §2 六条 `[static]` | done（R2 结案 PASS） |
| 4 | RES-R3 断言、§2.2 改名与 94 行回填 | 项目总负责人（卡）／大管家（§2.2 数据）／developer（断言） | `f8b9b5cf` 开卡、`28b9dbb1` 卡面注 3、`da6d381e` QA 复判；备案件 `res-b-reason-backfill-1125.md`（137 行／17,342 B／`207f1bd6…`） | `CARD-1125-R3` §3 六条（含 `[live]` 不改码）；数据 94/94 逐字等于 `.bak-2130` | todo（终审待负责人落笔；须标「现行判据看 137 行版」） |
| 5 | RES-R3 子件：需求件 §2.5 回写（v3.2.9→v3.2.10） | 产品经理 | `f69a37c4`、`d51a81d0`；`.batch/night/org/book-meta-requirements.md`（106 行／15,415 B／`33408097…`） | 判据挂 `CARD-1125-R3`，不单开卡 | done（不单独立卡） |
| 6 | RES S1–S4 收口与语料基线采样 | 项目总负责人 | `8be4a154`（判据清单）、`afa72d4c`／`2c3205d5`／`e001416f`（三件）、`ac64ae0c`（HEAD＝ls-remote 那次） | S4 done-when 五条（QA 判词逐条引用、porcelain 0、check-fast EXIT=0、HEAD＝ls-remote） | done（主人 11-25 亲口裁定 Goal complete） |
| 7 | S2 重跑预算与放行件 | 项目总负责人 | `7a89fd54`、`b1ebc760`、`8e598539`、`376cc229` | 闸值 265k／attempts 21、单进程、20 次即停 | done |
| 8 | S2 按设计缺陷收口＋S3 读者侧口径落地 | 项目总负责人 | `ce21ff96`（14 文件一笔） | 不跑新生成、不设检测通过率指标 | done |
| 9 | S3 口径四件修订 | 项目总负责人 | `b057bd3d` | F-01 去方向歧义、字数下限 20,000、manifest 只定契约、标识义务划出本组 | done |
| 10 | 非商用四源非同源评审汇总＋下轮分配 | 项目总负责人 | `c0855f6c`；`ext-review-1125-four-way-synthesis.md`（53 行／6,266 B／`3407a484…`）、分配件 `84e68d8f…` | 四家 3/4 指向盲评准入；外部评审只作综合与标注，不作整改指令 | done |
| 11 | RES 盲评包 v1（交主人本人判） | 大管家 | `.runtime/res-eval/blind-eval-v1.md`（325 行／25,630 B／`127e0839…`）＋`blind-eval-v1.key.json` | 12 篇匿名、泄漏 grep 0；Bot 不代判、不催签 | done（判定待主人） |
| 12 | 多作者语料采样审校＋章名口径判读 | 金牌编辑 | `.batch/night/staging/res-s3/sampling-audit-v1.md`（146 行／11,138 B／`cb6ceaab…`），随 `afa72d4c` 入库（提交非其所做） | §3 六关核对表可复用；章名三条判定：长度只进报告／禁运营语支持进闸／不分平台 | done |
| 13 | 0003 样件六关判词 | 金牌编辑 | 前置：主身重交修正版样件（七项） | `sampling-audit-v1.md` §3 六关；`charsBasis:"cjk"`／来源三字段 | todo（前置未满足，建卡须写明） |

## B. 元数据与看板机制

| # | 卡名 | 归属 | 起点依据 | 判据 | 状态 |
|---|---|---|---|---|---|
| 14 | 元数据需求正本 v3.2.8–v3.2.10 与 143 行落值 | 大管家（数据）／产品经理（需求件）／项目总负责人（锁版入库） | `2321d203`（正本入库）、`f69a37c4`、`d51a81d0`；`.batch/night/org/book-meta-requirements.md` | 锁版 §2.5 字段名一致、94/94 回填逐字等于 `.bak-2130`、`audit-coverage` `14/1197/483/639/143` | done |
| 15 | 本地库元数据补全（227 本／pool143） | 大管家（数据）／developer（audit 脚本） | `pool143.qidian-verified.jsonl`（80 行／111,951 B／`8759ef82…`）、`pool143.unresolved.jsonl`（69 行） | 试点 20 本 → 全量；禁词 0；`channel` 三值；≥30% unknown 停手报 | done（口径字段后随 R3 改名） |
| 16 | AGENTS.md 三行路由下沉 rule-registry R24–R26 | 项目总负责人＋管家跟班 | `d8f4a846`／`1266483e`（两笔不合并） | 与 AGENTS.md §4 表一致、check:fast 通过 | done |
| 17 | 群 notice 事故与恢复 | 大管家（事故）／主身（恢复） | 原版 1,349 字八块已从 state 快照逐字找回；候选稿在 `org/notice-aiwriter-candidate-20261126.md` | 定稿须主人点头；写入前 dump 现文、写入后核「新长度＝旧长度＋增量」 | todo（等主人拍板） |
| 18 | 每日 10:00 日报机制 | 项目总负责人 | `daily-1000-2026-11-25.md`（42 行／4,014 B） | 四节、≤1500 字、投 `bridge\to-owner` | done（机制）／首版已发 |

## C. 派单通道与脚本

| # | 卡名 | 归属 | 起点依据 | 判据 | 状态 |
|---|---|---|---|---|---|
| 19 | 派单脚本模型闸（`--model`／`--force`／跨源评审） | 主身 | `1ab5fb59`（doubao）、`1ea450e1`（policy＋attach＋取证件）；`script-guards-verification-20261125.md`（57 行／3,464 B／`09eac005…`） | 未点名回落 DeepSeek-V4.1-Flash、跨源评审必显式点名、付费 Hy4 硬闸、`--allow-auto` 已删 | done（未 push 前已随 `5e313404` 推上） |
| 20 | WorkBuddy 线 C1-a 派单与回执 | workbuddy联络人 | `7b056888…`（135 行／12,686 B）、`9f09561a…`（225 行／14,112 B），随 `1c0700a1` 入库 | 起点三项闸＋白名单 4 文件；回执复本入 `.batch` 记档 | done |
| 21 | WorkBuddy 线 C1-b 放弃回执 | workbuddy联络人 | `08b3993f…`（55 行／2,643 B） | 撞白名单外授权时只点停止、不出授权 | done |

## D. 待补（未报到的成员）

- QA：11-24／25 判词笔（`res-r1-qa.md`／`res-r2-qa.md`／`res-r3-qa.md` 三笔及增量）——待其自报后补卡。
- developer：字体探针、`res-r2-identifier-map.md` 供料、R3 断言件、CDP 端口核对——待自报。
- 豆包联络人：11-25 只读核对与派单旁证——待自报。

## E. 不重报（已上板）

AC 系（AC2／AC3）、PLANUI 三卡（C1／P6／O1）、脱敏线、D 系列已结项卡。

## F. 已知归属异动

- `bd3cac46`–`0a3a1bd4` 七笔作者字段为仓库默认身份「大管家」，内容与提交操作均属产品经理；身份口径自 `f69a37c4` 起显式。建卡时在卡面注明，历史笔不改。
