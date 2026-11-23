版本：v0.6
日期：2026-11-24
变更要点：AC 系 S4 收口——`L1-ARCH-01` 与 `L2-ARCH-01-01/02/03` 四条状态转「达标」，证据句写判定面 sha、判词路径与 sha256、测试数、变异口径、接线点；合并 sha 一律写「未合并·待主身」。`L0-ARCH` 与 `L1-ARCH-02` 未动（后者仍「阻塞」：第四件前置＝批次身份与证明体系）。条目内容与完成判据一字未改。
变更要点（上一版 v0.5）：S3 收口——ARCH 六条状态同步：`L0-ARCH`／`L1-ARCH-01`／`L2-ARCH-01-01/02/03` 由「阻塞」改「未开始」，证据句改引 `docs/adr/0027-architecture-shape-three-decisions.md` 与设计稿 `architecture-consistency-design.md:199`／`:219`／`:232`（主人 2026-11-23 裁定 1/2/3）；`L1-ARCH-02` 保留「阻塞」，§1 表前置改「第四件前置（未定）」、证据行保留「必须独立设计」原文并注明依赖第四件前置（批次身份与证明体系，主人裁定本轮不做＝ADR-0027 D4，见裁定④）；条目内容、完成判据与 §6 待填均未动。v0.4 的 S1 收口内容见变更表。

# AI writer · ROADMAP

> 骨架与字段规则以 `.batch/night/org/roadmap-doc-spec.md`（v1.0，2026-11-20）为准，本文只放数据。
> 维护人：项目总负责人。改动只走「群内讨论 → 维护人落盘」，不各自改。

## 0 本版口径（必读，防止把本文当成需求文档）

1. **内容只取三处**，别处一律不写：
   - ① 缺陷稿 `docs/design/product/live-pipeline-acceptance-defects-assessment.md` §2（还剩哪条）
   - ② 看板未结卡（backlog 3／todo 12 = 15 张，取到 2026-11-23 revision 923，`task_board_list` 当次读数）
   - ③ `BACKLOG.md` 的「转下期」清单（`:130`）
2. **不列入**：看板 done 139 张（倒看历史留在看板）、已归档/作废项、**H-005（`7e5f6a89`，属 DSH 插件组，不归本项目）**——依据：主人 2026-11-23 裁定（正本 `.batch/night/org/ruling-roadmap-three-1123.md` 裁定 2）：H-005 留在插件组，不另立 roadmap 正本，写进本文会让正本跨项目失真。
3. **次序已定**：主人 2026-11-23 裁定（同上件裁定 1）——先收尾在跑的，再保数据正确性，然后架构与体验，最后研究与管理性事项；次序 DEF→FACT→ARCH→PLANUI→RES→OPS→DOC→PROC，§1 总表与 §2 明细均按此次序排（细则见 §6 第 1 条）。
4. **看板卡类条目的判据锚在看板**：`task_board_get <uuid>` 返回 `column: "done"`，明细判据以卡面为准。卡面判据迁成文件时随改版更新。
5. 状态四选一：`未开始` / `进行中` / `达标` / `阻塞`；`阻塞`必须能在证据里读到解除条件，否则算写错。
6. `待填` 只用于「仓里现在查不到、又不该我拍」的事实；每处都在 §6 列明，变更表同版记一句。

## 1 挂接总表

| ID | 层级 | 名称 | 状态 | 前置依赖 |
|---|---|---|---|---|
| L0-DEF | L0 | 实机链路缺陷销账（D 系列） | 进行中 | 无 |
| L1-DEF-01 | L1 | D 系列缺陷复验与销账 | 进行中 | 无 |
| L2-DEF-01-01 | L2 | D8 候选区残本清场 | 阻塞 | 无 |
| L2-DEF-01-02 | L2 | D18 钩子偏离三环节收口 | 达标 | 无 |
| L0-FACT | L0 | 事实层确定性预检 | 达标 | 无 |
| L1-FACT-01 | L1 | 扩大 preflight 规则集 | 达标 | 无 |
| L0-ARCH | L0 | 架构一致性（AC 系） | 未开始 | 无 |
| L1-ARCH-01 | L1 | 层间一致性校验 | 未开始 | 无 |
| L2-ARCH-01-01 | L2 | AC1/S1 层内一致性 | 未开始 | 无 |
| L2-ARCH-01-02 | L2 | AC2/S2 层间引用完整性 | 未开始 | 无 |
| L2-ARCH-01-03 | L2 | AC3/S3 弧加入后校验 | 未开始 | 无 |
| L1-ARCH-02 | L1 | 候选复审批次（§8·判据⑰） | 阻塞 | 第四件前置（未定） |
| L0-PLANUI | L0 | 计划与 UI | 阻塞 | 无 |
| L1-PLANUI-01 | L1 | 计划面板交互补全 | 阻塞 | 无 |
| L2-PLANUI-01-01 | L2 | O1 大纲按弧分批 | 阻塞 | 无 |
| L2-PLANUI-01-02 | L2 | C1 相关性筛选 | 未开始 | 无 |
| L2-PLANUI-01-03 | L2 | C1 重生成前提示 | 未开始 | 无 |
| L2-PLANUI-01-04 | L2 | P6 伏笔/线索批量范围 | 阻塞 | 无 |
| L0-RES | L0 | 正文质量研究（A-1 系） | 阻塞 | 无 |
| L1-RES-01 | L1 | 正文 AI 味可测量化 | 阻塞 | 无 |
| L2-RES-01-01 | L2 | A-1 主课题 | 未开始 | 无 |
| L2-RES-01-02 | L2 | A-1.3 干预对照与判据候选 | 阻塞 | L2-RES-01-01 |
| L0-OPS | L0 | 测试与运维存量 | 阻塞 | 无 |
| L1-OPS-01 | L1 | planning-resume 清理口径 | 未开始 | 无 |
| L1-OPS-02 | L1 | 5 棵 worktree 清理 | 阻塞 | 无 |
| L1-OPS-03 | L1 | 仓外运维脚本归属议题 | 阻塞 | 无 |
| L1-OPS-04 | L1 | archive 8 条「待补」 | 未开始 | L1-PROC-01 |
| L1-OPS-05 | L1 | 验收夹具共用句假阳性 | 阻塞 | 无 |
| L0-DOC | L0 | 裁定材料回炉 | 未开始 | 无 |
| L1-DOC-01 | L1 | C2/C3 两份材料按复核意见回炉 | 未开始 | 无 |
| L0-PROC | L0 | 协作规矩落地 | 未开始 | 无 |
| L1-PROC-01 | L1 | 留档目录自带说明（B-1e） | 未开始 | 无 |
| L1-PROC-02 | L1 | 清场口径入协作规则（B-4） | 未开始 | 无 |

## 2 明细

### L0-DEF 实机链路缺陷销账（D 系列）

- 目标：把 D 系列 20 条缺陷逐条验到能关门，不留🟡
- 完成判据：缺陷稿 §2 表 20 行状态列无 `🟡`/`⏸`/`⬜`（`⛔` 仅 D6 允许）
- 前置依赖：无
- 状态：进行中｜证据：缺陷稿 `:74`（D15 ✅ S5 收口）／`:73`（D8 ⏸ 待作者另裁）／`:80`（D18 ✅，判据 4 `[live]` PASS：判词 `.batch/night/reports/s6-d18-criterion4-verdict.md`）——刷新于 2026-11-23（S6 收口后）
- ID：L0-DEF

#### L1-DEF-01 D 系列缺陷复验与销账

- 目标：把每一条在修缺陷跑到实机可判并回写状态
- 完成判据：缺陷稿 §2 表现状（D1–D18：16 行 ✅／1 行 ⛔ D6／D8 ⏸）中，D8 转 `✅` 或 `⛔`，其余 16 行不回退（D1–D18 范围内 `🟡` = 0；D20 属「结项不验」，不计入）
- 前置依赖：无
- 状态：进行中｜证据：同 L0-DEF
- ID：L1-DEF-01

##### L2-DEF-01-01 D8 候选区残本清场（阻塞 · 等作者定档位）

- 目标：把清场后守卫拒跑与双套文案并存两条阻塞裁掉
- 完成判据：`task_board_get 4b9eae6e-6dd2-4f37-8572-fbedf91eacef` → `column: "done"`；缺陷稿 `:73` 状态转 `✅` 或 `⛔`
- 前置依赖：无
- 状态：阻塞｜证据：缺陷稿 `:73`「⏸ 待作者另裁（不计入本批销账）」；看板卡标注「不得认领或结算」
- ID：L2-DEF-01-01

##### L2-DEF-01-02 D18 钩子偏离三环节收口

- 目标：补齐判据 4 的定稿段 `[live]` 证据并收口三环节
- 完成判据：同卡 `[live]` evidence 内 `[hook-unplanted]` 恰好出现 1 次（run 的 finalize 段非空）+ `task_board_get 2b7eb20d-e3e5-49f2-b9bd-53ac73be713e` → `column: "done"`
- 前置依赖：无
- 状态：达标｜证据：判据 4 `[live]` PASS（判定面 `89868921`、runId `b3984cd5-78f`、判词 `.batch/night/reports/s6-d18-criterion4-verdict.md` `a2342504…`、证据 `.batch/night/staging/s6-d18/`）；看板卡 `column: "done"`；合并 sha：D18 `89868921`（卡分支 `7b48f074`）、D15 `64793246`（卡分支 `f95ed1da`）（刷新于 2026-11-23）
- ID：L2-DEF-01-02

### L0-FACT 事实层确定性预检

- 目标：在既有 preflight 通路上加确定性规则，不新增流程
- 完成判据：新规则的纯函数入库 + `pnpm check:fast` 全过 + 新 `stableFactKey` 前缀与 `fact:`/`space:` 隔离（`grep -n "stableFactKey" src/shared/<新文件>.ts` 命中且前缀不同）
- 前置依赖：无
- 状态：达标（2026-11-23）｜证据：判定面 `0ec6c89c`（分支 `card/fact-preflight-3rules`，5 文件 `+542/−25` 全在白名单内、无新增生产文件）；QA 判词 `.batch/night/reports/s2-fact-verdict.md`（73 行／7,530B／`d6a4232c…`，判定面同上）；`grep -ni "stableFactKey" src/shared/space-time-consistency.ts`（区分大小写时只有 11 行命中、`-i` 后 16 行）命中行原文：`:235 function fnvStableFactKey(prefix: string, parts: readonly string[]): string {`、`:249 export function spaceTimeStableFactKey(parts: readonly string[]): string {`、`:254 export function slotStableFactKey(parts: readonly string[]): string {`（`:255` 为 `return fnvStableFactKey('slot', parts)`），`space:`／`slot:` 前缀隔离成立（QA 独立手写 FNV-1a 64 复算 `space:6f155ee620aee7cd` 与测试字面量一致）；合并 sha `26731adb`（merge `0ec6c89c`），已推送，S3 终版 HEAD `22c085db`
- ID：L0-FACT

#### L1-FACT-01 扩大 preflight 规则集

- 目标：在既有预检通路里新增规则并保持 fail-open
- 完成判据：`task_board_get bb3f0d83-3f24-43a9-977d-8ef6b4e8eb9b` → `column: "done"`
- 前置依赖：无
- 状态：达标（2026-11-23）｜证据：看板卡 `bb3f0d83` 已由群 admin 转 `done`（S3 收口）；`Tests 83 passed (83)`／`EXIT=0`（2 文件 `space-time-consistency.test.ts`、`consistency-preflight-space-time.test.ts`，整文件汇总行）；`pnpm check:fast` 末行「[check:fast] 全部通过。」；R1/R2/R3 三条确定性规则纯增量接入既有预检通路、保持 fail-open，QA 变异测试把 `space-time-consistency.ts:415` 的 fail-open 守卫改恒假 → 3 条负向用例全转红（证明负向断言非空）；合并 sha `26731adb`（merge `0ec6c89c`），已推送，S3 终版 HEAD `22c085db`
- 不可再拆，原因：一卡即一批规则，逐条开卡会让 fail-open 口径被拆散
- ID：L1-FACT-01

### L0-ARCH 架构一致性（AC 系）

- 目标：让层内、层间与弧加入后的一致性都可机检并验收
- 完成判据：`docs/design/architecture/architecture-consistency-design.md` §5 三节（S1/S2/S3）均带验收结论，且 L2-ARCH-01-01/02/03 全 `达标`
- 前置依赖：无
- 状态：未开始｜证据：三件前置已由主人 2026-11-23 裁定（`docs/adr/0027-architecture-shape-three-decisions.md` D1/D2/D3；设计稿 `docs/design/architecture/architecture-consistency-design.md:199`／`:219`／`:232`），三张子卡不再等裁定；本 L0 达标仍以三张子卡全 `达标` 为准
- ID：L0-ARCH

#### L1-ARCH-01 层间一致性校验

- 目标：把三层一致性检查做成可独立交付的纯函数校验
- 完成判据：L2-ARCH-01-01/02/03 全 `达标`，且三条判据在 `pnpm check:fast` 下不新增红
- 前置依赖：无
- 状态：达标｜证据：三条子卡全 `达标`（判定面 `6e0f6a63`／`5e99d2ad`／`b5a14f1c`，卡 `a7589d74`／`4027dbef`／`ed210a27` 均 done）；判词 `.batch/night/reports/ac1-s1-verdict.md`（`cff7edda…`）／`ac2-s2-verdict.md`（`c4c2c40d…`）／`ac3-s3-verdict.md`（`55e849f9…`）；测试 `10 passed`／`13 passed`／`46 passed (46)`；变异有效项 M1–M5（AC1）、M4′ 组合变异（AC2，单点 M4 记等价）、M3–M6（AC3，M1／M2 记等价）；接线点 `src/services/consistency-preflight.ts`（AC1 `:43-62`／AC2 `:38-42`／AC3 `:72`）；`pnpm check:fast` 三卡收口提交均全过（末次 `f21c6979`）；合并 sha 未合并·待主身
- ID：L1-ARCH-01

##### L2-ARCH-01-01 AC1/S1 层内一致性

- 目标：验出层内自洽问题并能判红
- 完成判据：`task_board_get a7589d74-121a-4a93-b5e5-befd5e260c11` → `column: "done"`
- 前置依赖：无
- 状态：达标｜证据：卡 `a7589d74` → done（判定面 `6e0f6a63`，合并 `2e43a912`）；判词 `ac1-s1-verdict.md`（135 行／10,173B／`cff7edda…`）；`Tests 10 passed`；变异 M1–M5 全部转红（M5 为 QA 加跑的「去 `factHash` 豁免键」）；接线 `src/services/consistency-preflight.ts:43-62`；ADR-0027 D1 口径（散文层不做层间校验、校验对象是投影状态，设计稿 `:199`）已实现；合并 sha 未合并·待主身（AC1 已并 `2e43a912`）
- ID：L2-ARCH-01-01

##### L2-ARCH-01-02 AC2/S2 层间引用完整性

- 目标：只查具名实体的层间引用闭合，压住假阳性
- 完成判据：`task_board_get 4027dbef-b5b2-4725-bc51-7b47e558ccd2` → `column: "done"`
- 前置依赖：无
- 状态：达标｜证据：卡 `4027dbef` → done（判定面 `5e99d2ad`）；判词 `ac2-s2-verdict.md`（101 行／13,812B／`c4c2c40d…`，入库 `57d05871`）；`Tests 13 passed`；变异单点 M4 记等价（两道 fail-open 闸），组合变异 M4′ 转红 `1 failed|12 passed`；接线 `src/services/consistency-preflight.ts:38-42`；ADR-0027 D2 口径（第 4 维两类登记／逐字包含／名单空显式未判，设计稿 `:219`）已实现；地名侧仍走既有 trim 全等、逐字包含未接线（见 BACKLOG 转下期清单）；合并 sha 未合并·待主身
- ID：L2-ARCH-01-02

##### L2-ARCH-01-03 AC3/S3 弧加入后校验

- 目标：在四层之上加弧层校验且能判红
- 完成判据：`task_board_get ed210a27-4a31-4b72-b46d-4f572aaa914c` → `column: "done"`
- 前置依赖：无
- 状态：达标｜证据：卡 `ed210a27` → done（判定面 `b5a14f1c`）；判词 `ac3-s3-verdict.md`（123 行／10,799B／`55e849f9…`，入库 `f21c6979`）；测试 三文件 `Tests 46 passed (46)`；变异 M3→#1/#2/#3/#10/#11、M4→#10、M5→#8、M6→#2 转红，M1／M2 记等价；接线点 `src/services/consistency-preflight.ts:72`（`findArcCoverRisks`，接线前 `git grep` rc=1）；ADR-0027 D3 口径（结构位 ID 即实体、不建表、重排报 `UNKNOWN_NODE`）已接线；合并 sha 未合并·待主身
- ID：L2-ARCH-01-03

#### L1-ARCH-02 候选复审批次（§8 · 判据⑰）

- 目标：把候选引入的复审批次机制独立设计并落地
- 完成判据：`task_board_get 6be33a2b-161c-446e-9dbd-95382e570c8b` → `column: "done"`，且设计稿 §8 有对应条目
- 前置依赖：第四件前置（未定）
- 状态：阻塞｜证据：看板卡标注「动批次身份与证明体系，必须独立设计，不能顺手改」；**依赖第四件前置：批次身份与证明体系（主人 2026-11-23 裁定本轮不做，ADR-0027 D4）**
- 不可再拆，原因：一张卡即一个机制，拆开会把 identity 与 proof 分到两处改
- ID：L1-ARCH-02

### L0-PLANUI 计划与 UI

- 目标：把计划面板的契约与交互缺口补齐到可派活
- 完成判据：L2-PLANUI-01-01/02/03/04 全 `达标`
- 前置依赖：无
- 状态：阻塞｜证据：O1 等契约裁定、P6 等作者定档位
- ID：L0-PLANUI

#### L1-PLANUI-01 计划面板交互补全

- 目标：把计划侧剩余的契约与交互项逐条做完
- 完成判据：四条 L2 全 `达标`
- 前置依赖：无
- 状态：阻塞
- ID：L1-PLANUI-01

##### L2-PLANUI-01-01 O1 大纲按弧分批

- 目标：让大纲按弧分批且双端契约一致
- 完成判据：`task_board_get 58188c1c-5c3b-4d40-93d2-2477a29e9fb8` → `column: "done"`
- 前置依赖：无
- 状态：阻塞｜证据：看板卡标注「双端硬契约，得先解契约」
- ID：L2-PLANUI-01-01

##### L2-PLANUI-01-02 C1 相关性筛选

- 目标：让候选与正文的相关性可筛可弃
- 完成判据：`task_board_get 744f13a8-7a5c-49dc-beab-9e0d7259cc4e` → `column: "done"`（该卡含两项，本项对应第一项）
- 前置依赖：无
- 状态：未开始
- ID：L2-PLANUI-01-02

##### L2-PLANUI-01-03 C1 重生成前提示

- 目标：重生成前给出明确提示与代价
- 完成判据：同卡 `744f13a8` → `column: "done"`（对应第二项）
- 前置依赖：无
- 状态：未开始
- ID：L2-PLANUI-01-03

##### L2-PLANUI-01-04 P6 伏笔/线索批量范围

- 目标：伏笔与线索支持按范围批量选择
- 完成判据：`task_board_get 342b428f-9bff-4c6b-95eb-97ae75a9f4e4` → `column: "done"`
- 前置依赖：无
- 状态：阻塞｜证据：看板卡标注「等作者定档位（要做成什么粒度还没定）」
- ID：L2-PLANUI-01-04

### L0-RES 正文质量研究（A-1 系）

- 目标：把「AI 味」变成可测的量并给出有效干预
- 完成判据：A-1 交付可机判征兆清单 + A-1.3 交付「够格进 P17／只进报告／不做」判据清单
- 前置依赖：无
- 状态：阻塞｜证据：A-1.3 依赖 A-1.1（未开工）
- ID：L0-RES

#### L1-RES-01 正文 AI 味可测量化

- 目标：分清可零成本机判与人判的征兆并证干预有效
- 完成判据：两份交付（征兆清单、判据清单）落进 `docs/research/` 且被 QA 判词引用
- 前置依赖：无
- 状态：阻塞
- ID：L1-RES-01

##### L2-RES-01-01 A-1 主课题

- 目标：把 AI 味拆成可测项并跑单变量对照
- 完成判据：`task_board_get b2ac48ca-e5f5-47c5-89b2-437888c3a275` → `column: "done"`
- 前置依赖：无
- 状态：未开始
- ID：L2-RES-01-01

##### L2-RES-01-02 A-1.3 干预对照与判据候选

- 目标：证明哪招对哪项指标有效并交判据清单
- 完成判据：`task_board_get 134acb2f-3b63-474a-b5e0-cfaad7e41d5c` → `column: "done"`
- 前置依赖：L2-RES-01-01
- 状态：阻塞｜证据：卡标题「依赖 A-1.1」
- ID：L2-RES-01-02

### L0-OPS 测试与运维存量

- 目标：把测试夹具、worktree 与仓外脚本的存量风险收掉
- 完成判据：L1-OPS-01~05 全 `达标`
- 前置依赖：无
- 状态：阻塞｜证据：OPS-02 需先认领、OPS-03 待裁定、OPS-05 推送后才可动
- ID：L0-OPS

#### L1-OPS-01 planning-resume 清理口径

- 目标：给该测试用例补清理时只拆 junction 不删真目录
- 完成判据：`grep -n "discardTreeWithoutFollowingLinks" scripts/__tests__/quality-modernization-planning-resume.test.mjs` 有命中，且同文件无裸 `fs.rmSync(..., { recursive: true`
- 前置依赖：无
- 状态：未开始｜证据：看板卡 `5b35b36b` 卡面（当前无任何 rmSync，故今天无风险）
- 不可再拆，原因：一处改动一句话判据
- ID：L1-OPS-01

#### L1-OPS-02 5 棵 worktree 清理

- 目标：清掉 5 棵冗余 worktree 并留下认领记录
- 完成判据：`git worktree list` 只剩 `develop` 一行，且认领记录在 `.batch/night/` 下落盘（路径待填）
- 前置依赖：无
- 状态：阻塞｜证据：`BACKLOG.md:41`「清理须先认领，本轮不动」
- 不可再拆，原因：清理动作本身是批量的，逐棵开卡反而每棵都要重走认领
- ID：L1-OPS-02

#### L1-OPS-03 仓外运维脚本归属议题

- 目标：定 `rotation/` 等仓外脚本是否入库
- 完成判据：`BACKLOG.md` §B-24（`:106`）有裁定句「入库/不入库」并写理由
- 前置依赖：无
- 状态：阻塞｜证据：`BACKLOG.md:109`「本条只登记议题——不写方案、不估工时、不动脚本」
- 不可再拆，原因：议题本身还没答案，拆下去是空转
- ID：L1-OPS-03

#### L1-OPS-04 archive 8 条「待补」

- 目标：把 `archive/README.md` 余 8 条补全或永久标待补
- 完成判据：`grep -c "待补" archive/README.md` 的 8 条全部带「永久待补」或补齐五字段（以 `BACKLOG.md:81` 口径为准）
- 前置依赖：L1-PROC-01
- 状态：未开始
- 例外：口径属 L0-PROC（L1-PROC-01「留档目录自带说明」），先于 L0-OPS 取用
- 不可再拆，原因：8 条同批、同一口径
- ID：L1-OPS-04

#### L1-OPS-05 验收夹具共用句假阳性

- 目标：消掉 D12 验收夹具带来的重合度假阳性
- 完成判据：夹具改后（或判据扣除共用句后）给出前后两次读数对照，落 `.batch/night/reports/` 下（文件名待填）
- 前置依赖：无
- 状态：阻塞｜证据：`BACKLOG.md:113`「D12 不回退、不重跑；本条在推送后才可动手」
- 不可再拆，原因：一次改动＋一组对照读数即可判
- ID：L1-OPS-05

### L0-DOC 裁定材料回炉

- 目标：把两份裁定材料的现状描述改到与实现一致
- 完成判据：两份材料回炉稿入库且复核意见逐条有回应（`task_board_get 2a24a2e8-f6ae-46d6-aea5-8e9f96ed7b98` → `column: "done"`）
- 前置依赖：无
- 状态：未开始｜证据：看板卡标注「只改文档，不改码不裁定」
- ID：L0-DOC

#### L1-DOC-01 C2/C3 两份材料按复核意见回炉

- 目标：改掉 C3 现状不符与 C2 范围定位翻转
- 完成判据：同 L0-DOC 的 `task_board_get 2a24a2e8…`
- 前置依赖：无
- 状态：未开始
- 不可再拆，原因：一张卡两处改动，拆开会让「范围定位」与「现状描述」各说各话
- ID：L1-DOC-01

### L0-PROC 协作规矩落地

- 目标：把已定的两条留档/清场规矩落到可检查
- 完成判据：L1-PROC-01/02 全 `达标`
- 前置依赖：无
- 状态：未开始
- ID：L0-PROC

#### L1-PROC-01 留档目录自带说明（B-1e）

- 目标：让每个留档目录自带谁建/何时/用途/保留期
- 完成判据：`node scripts/ops/check-batch-hygiene.mjs --all` 输出 `0 项不合规`，且该脚本含「目录说明」检查项（`grep -n "README" scripts/ops/check-batch-hygiene.mjs` 有命中）
- 前置依赖：无
- 状态：未开始｜证据：`BACKLOG.md:52` 为本期唯一 `- [ ]`
- 不可再拆，原因：规矩一条、检查一处
- ID：L1-PROC-01

#### L1-PROC-02 清场口径入协作规则（B-4）

- 目标：把撞车三步处置写进协作规则正文
- 完成判据：协作规则正本内可检索到「清场三步」条文（`grep -rn "三步处置" .batch/night/org/collab-rules-v1.md` 有命中）
- 前置依赖：无
- 状态：未开始｜证据：`BACKLOG.md:53` 标注「条文仍未入协作规则」
- 不可再拆，原因：一段条文
- ID：L1-PROC-02

## 6 待填与待裁（6 条已决 4 条：1、2、3、6；剩 2 条：4、5）

> 已决条目保留原编号与原表格位置，结论写进「为什么现在定不了」格，过程不删（主人 2026-11-23 三条裁定的行封「主人（裁定 N）」）。

| # | 待填/待裁 | 为什么现在定不了 | 建议由谁定 |
|---|---|---|---|
| 1 | 8 个 L0 的先后次序 | **已裁 2026-11-23**：DEF→FACT→ARCH→PLANUI→RES→OPS→DOC→PROC（原则：先收尾在跑的，再保数据正确性，然后架构与体验，最后研究与管理性事项） | 主人（裁定 1） |
| 2 | D15 状态回写 | **已消 2026-11-23**：产品经理 `b34be179` 把缺陷稿 `:74` 的 D15 按 S5 判词 §3 转为 ✅；排期侧 `docs/plans/prompt-assembly-backlog.md:138` 早已写「S5 纯验收通过（`f95ed1da`）」，两处口径一致（`grep -c '🟡'` 缺陷稿 = 14 处，均非 D15） | 产品经理（已回写） |
| 3 | H-005（`7e5f6a89`）归属 | **已裁 2026-11-23：留 DSH 插件组，不另立正本**。理由：它是另一项目的执行卡，写进本文会让正本跨项目失真；插件组自有群 Goal 与看板。将来若需正本，由主人另行发起，不由本文代立 | 主人（裁定 2） |
| 4 | L1-ARCH-01 验收记录路径 | 设计稿 §5 尚无签字记录 | 项目总负责人（我）＋QA |
| 5 | L1-OPS-02 认领记录路径 / L1-OPS-05 对照记录文件名 | 记录还没产生 | 执行时由认领人补 |
| 6 | 本 roadmap 的看板镜像要不要同步 | **已裁 2026-11-23：本文是唯一正本，看板只留执行卡，不建 `Roadmap` Tag 镜像**。理由：省一次双向同步，避免两处都写、两处不一致；看板只做两件事——承载可执行卡、把卡挂到对应 L1/L2 编号上 | 主人（裁定 3） |

## 变更表

| 版本 | 日期 | 改了什么 | 谁改的 |
|---|---|---|---|
| v0.1 | 2026-11-23 | 首版：8 个 L0／14 个 L1／11 个 L2 落地，来源限缺陷稿§2＋看板 16 张未结卡＋`BACKLOG.md:130` 转下期；§6 列 6 处待填待裁 | 项目总负责人 |
| v0.2 | 2026-11-23 | §6 第 2 条标已解决（`b34be179` 回写 D15），待填 6 条 → 5 条；正文条目未动 | 项目总负责人 |
| v0.3 | 2026-11-23 | 按主人三条裁定：L0 次序重排为 DEF→FACT→ARCH→PLANUI→RES→OPS→DOC→PROC（§1 表与 §2 明细同序，条目内容未动）＋§6 第 1/3/6 条改结论格＋§0 第 2/3 条同步＋L1-OPS-04 加依赖例外；另把 DEF 段三处状态读数刷新到缺陷稿现值（D15 ✅、D18 判据 4 `[live]` PASS、L2-DEF-01-02 达标） | 项目总负责人（重排与结论格）＋群 admin（状态读数刷新） |
| v0.4 | 2026-11-23 | S1 收口：`:91` 合并 sha 落实值（D15 `64793246`／D18 `89868921`）；§0 ② 计数刷新为当次读数（revision 923，backlog 3／todo 12 = 15 张，done 137 → 139）；**`:73` 判据文字变动说明**——原写「§2 表 20 行状态列无 `🟡`」，该写法的 `grep -c "🟡"` 在整表上恒不为 0（D20 是「🟡 结项（不验）」，属作者 2026-11-06 裁的结项态，本就不该验），故收窄为「D1–D18 范围内 `🟡` = 0，D20 不计入」，判据强度不变、只把范围写明；另同笔清掉看板 5 张 done 卡的 `Roadmap` 镜像 Tag（`23433174`／`76273d1a`／`2a8b0b0d`／`4ee6b83e`／`19bd077a`），落实裁定 3「看板只留执行卡、不建镜像」；归档卡 `3aabf83a`（S6·P54 发版，DSH 插件组、卡面只读）由主身于 2026-11-23 18:10 走 restore→去 Tag→archive 清掉，卡面其余字段未动；至此 `Roadmap` Tag 共 6 处已清，`task_board_list tag=Roadmap` 默认与 `includeArchived:true` 均 `total 0`（revision 931） | 项目总负责人＋群 admin（文字更正） |
| v0.5 | 2026-11-23 | S3 收口：ARCH 六条状态同步——`L0-ARCH`／`L1-ARCH-01`／`L2-ARCH-01-01/02/03` 阻塞→未开始，证据句改引 ADR-0027 与设计稿 `:199`／`:219`／`:232`；`L1-ARCH-02` 保留阻塞，§1 表前置改「第四件前置（未定）」，证据行保留「必须独立设计」原文并注依赖第四件前置（批次身份与证明体系，主人裁定本轮不做）；按裁定④统一 §1 表行与 §2 证据行口径；条目内容、完成判据、§6 未动 | 项目总负责人 |
| v0.6 | 2026-11-24 | AC 系 S4 收口：`L1-ARCH-01` 与 `L2-ARCH-01-01/02/03` 四条转「达标」，证据句写判定面 sha（`6e0f6a63`／`5e99d2ad`／`b5a14f1c`）、判词路径与 sha256、测试数（10／13／46）、变异口径（M4 与 AC3 M1／M2 记等价）、接线点（`src/services/consistency-preflight.ts`）；`L0-ARCH` 与 `L1-ARCH-02` 未动（后者仍「阻塞」：第四件前置＝批次身份与证明体系，ADR-0027 D4）；合并 sha 一律「未合并·待主身」。条目内容、完成判据、§6 未动 | 项目总负责人 |
