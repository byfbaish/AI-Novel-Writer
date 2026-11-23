# AC 系 S4 收口派单（admin，2026-11-24 02:2x）

基线：develop HEAD `f21c6979`，远端 `exp/resource-ledger` 仍 `2e43a912`（本地领先 4 笔未推）。
三支待合并卡分支：
- AC1/S1 卡 `a7589d74` 判定面 `6e0f6a63`（分支 `card/arch-ac1-s1`）
- AC2/S2 卡 `4027dbef` 判定面 `5e99d2ad`（分支 `card/arch-ac2-s2`）
- AC3/S3 卡 `ed210a27` 判定面 `b5a14f1c`（分支 `card/arch-ac3-s3`）
三卡看板均已 done；判词分别入库 `681eeb66` / `57d05871` / `f21c6979`。

## 一、ROADMAP.md（只动状态与证据句，条目内容不重写）
1. `L1-ARCH-01` 与 `L2-ARCH-01-01`（AC1）、`L2-ARCH-01-02`（AC2）、`L2-ARCH-01-03`（AC3）四条状态转「达标」。
2. 每条证据句写：判定面 sha、判词文件路径与 sha256、测试数、变异口径（哪些有效、哪些记等价）、接线点（AC1 `src/services/consistency-preflight.ts`、AC2 同、AC3 `:72`）。
3. `L1-ARCH-02` 保持「阻塞」不动，理由仍是第四件前置（批次身份与证明体系）。
4. §0 变更要点与文末变更表加一行 v0.6；合并 sha 一律先写「未合并·待主身」，推送后由产品经理回填。

## 二、设计稿 `docs/design/architecture/architecture-consistency-design.md`（四处旧口径 + 一处频率闸）
- `:222` 标题「（依赖第五层落地）」→ 去掉依赖字样，写「（前置 2026-11-23 已裁定，ADR-0027 D3）」。
- `:231`「必须等第五层落地」、`:267`「S3 必须等第五层落地」→ 改成「前置已裁定（ADR-0027 D3），实体键＝结构位 ID、不建表」。
- `:229`「守 §5.1 边界」是失效引用（全文无 §5.1）→ 改指实际小节（§5 的 S1/S2/S3/S4 二级小节）。
- S2.3「≥2 字＋出现 ≥2 次」频率闸：实施按 `blueprint.characters[]` 抽取、无频率闸 ⇒ 在 S2.3 行末注明「频率闸不适用（2026-11-24 裁定，实施改用结构化抽取）」。
- 其余结论段一字不动。

## 三、台账 `.batch/night/reports/task-ledger.md`
三条各一行（`CARD-ARCH-AC1/AC2/AC3`）：判定面 sha、判词 sha、测试数、合并 sha（未合并·待主身）。按历史行不追改原则，旧行不动。

## 四、BACKLOG 转下期清单（每条一行，带文件:行）
1. `describeNamedEntityCoverage` 已有实现但预检侧无调用点（AC2 覆盖度不显式未判）。
2. 语义版人名归一（NER／别名／简称）另开卡；本轮只做结构化逐字包含。
3. 两级「卷/单元」结构下 synopsis 覆盖行合同 `synopsis-two-level-suffix.ts:37` 禁「覆盖：」行 ⇒ AC3 弧覆盖规则在两级项目恒 fail-open，要判须先改输出合同。
4. AC2 重名登记无信号（后一条静默覆盖前一条），需 UI 提示或规则。
5. 单章对话框 `ChapterCreationDialog.tsx:362-372` 未传 `structuredRefs` ⇒ 既有 `space:` 规则单章路径恒 fail-open（AC2 卡已登记，仍开放）。
6. 台账缺失时 AC2 整条 fail-open（`:109`），登记行与台账两处都放行 ⇒ 台账是第二放行来源，卡面与文档不得写「冲突以登记行为准已实现」。

## 五、收口件 `.batch/night/org/ac-closeout-1124.md`
按 Goal done-when ①–⑥ 逐条贴原文（卡状态读取、纯函数证据、正负用例与变异、测试与 check:fast 原文、ROADMAP 四条、HEAD/ls-remote/porcelain），并写显式缺口（AC2 地名侧仍 trim 全等／AC3 两级结构恒 fail-open／AC2 台账第二放行来源）。

## 六、纪律
- 不 commit、不 push（提交归 admin，推送归主身）。
- 改完在群里报「改了哪几个文件、numstat、check:fast 原文」。
- 合并 sha 回填等主身推完再动。
