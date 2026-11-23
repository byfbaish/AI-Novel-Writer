# AC 系 S4 收口件（2026-11-24）

From：项目总负责人 · AI writer项目组
To：大肥鱼@主身
派单：`.batch/night/org/ac-s4-dispatch.md`（3,703B／sha256 `a28e5865…146b`）
基线 HEAD `f21c6979`（远端 `exp/resource-ledger` 同 sha，02:2x 实测）
边界：本件只做收口文字与登记，不 commit、不 push、不碰合并冲突。

## 一、done-when ① AC2／AC3 并入 develop（由主身／admin 执行，我只读）

- AC1 已并入：合并提交 `2e43a912`。
- AC2 合并**正在进行**：`.git/MERGE_HEAD` = `0953015ff5a404901ebf5373625ac6d5d954e64f`，`src/services/consistency-preflight.ts` 状态 `UU`（冲突未解）。我未介入。
- `grep -c "db:character-roster-read" src/services/consistency-preflight.ts` 当前读数 **1**（`:59` `ipc.invokeWithProjectSession(session, 'db:character-roster-read', …)`）；此读数为合并中途值，合 AC3 后须复核仍 = 1（done-when 原文要求两次读取并成一次）。
- 结论：①**未达**，卡点是合并冲突待解，责任人＝执行合并者（admin／主身）。我不代解、不代判。

## 二、done-when ② ROADMAP 四条转达标

文件 `docs/roadmap/ROADMAP.md`（360 行／26,432B）。四条状态行：

- `:125` `L1-ARCH-01` 达标——判定面 `6e0f6a63`／`5e99d2ad`／`b5a14f1c`，判词三份 path＋`cff7edda…`／`c4c2c40d…`／`55e849f9…`，测试 10／13／46，变异口径（AC1 M1–M5；AC2 单点 M4 记等价＋组合 M4′；AC3 M3–M6，M1／M2 记等价），接线点 `src/services/consistency-preflight.ts`（`:43-62`／`:38-42`／`:72`），合并 sha「未合并·待主身」。
- `:133` `L2-ARCH-01-01`（AC1）达标——卡 `a7589d74` done，合并 `2e43a912`。
- `:141` `L2-ARCH-01-02`（AC2）达标——卡 `4027dbef` done。
- `:149` `L2-ARCH-01-03`（AC3）达标——卡 `ed210a27` done，接线前 `git grep` rc=1。
- `L1-ARCH-02` 未动：仍「阻塞」，§1 表前置「第四件前置（未定）」、§2 证据行保留「必须独立设计」＋第四件前置（ADR-0027 D4）。
- 变更表 `:360` 加 v0.6 行；`L0-ARCH` 未动（派单只授权四条，状态留「未开始」由下一阶段复核）。

## 三、done-when ③ 设计稿四处旧口径＋S2.3

文件 `docs/design/architecture/architecture-consistency-design.md`（404 行／27,938B）：

- `:222` 标题「（依赖第五层落地）」→「（前置 2026-11-23 已裁定，ADR-0027 D3）」。
- `:231` 成本句「必须等第五层落地」→「前置已裁定（ADR-0027 D3），实体键＝结构位 ID、不建表」，并补「弧层能力早已存在、本阶段只做接线」。
- `:267` 结论句同口径改写。
- `:229` 失效引用「守 §5.1 边界」→「守 §5 各二级小节（S1／S2／S3／S4）的边界」（全文无 §5.1，原引用失效）。
- `:216` S2.3 行末补两句：「频率闸不适用（2026-11-24 裁定，实施改用结构化抽取）」＋「重名时后一条覆盖前一条、规则对重名无信号」。
- 其余结论段一字未动。

## 四、done-when ④ BACKLOG 与台账

- `.batch/night/org/BACKLOG.md:136` 新增「### AC 系收口转下期（2026-11-24）」，六条各一行带文件:行：①`describeNamedEntityCoverage` 无调用点 ②语义版人名归一另开卡（ADR `:55`）③`src/shared/synopsis-two-level-suffix.ts:37` 两级结构恒 fail-open ④重名登记无信号（`named-registration-consistency.ts:107`）⑤单章未传 `structuredRefs`（`ChapterCreationDialog.tsx:362-372`）⑥台账缺失整条 fail-open（`named-registration-consistency.ts:109`）＝台账为第二放行来源，文档不得写「已实现」。
- `.batch/night/reports/task-ledger.md:924` 新增「### AC 系三卡（S4 收口登记）」，`:928`／`:929`／`:930` 三行（`CARD-ARCH-AC1/AC2/AC3`）各写判定面、判词 path＋sha、测试数、合并 sha「未合并·待主身」；旧行未追改。

## 五、done-when ⑤ 合并后现值与被引件指纹（2026-11-24 02:4x，admin 按 QA S4 复核重出）

命令原文（合并后、S4 收口笔 `7b20406e`）：

```
$ git diff --numstat
9	0	.batch/night/org/BACKLOG.md
10	0	.batch/night/reports/task-ledger.md
5	5	docs/design/architecture/architecture-consistency-design.md
9	7	docs/roadmap/ROADMAP.md

$ node scripts/check-fast.mjs
[check:fast] typecheck ✓（S4 收口笔 pre-commit 内跑，全部通过）
doc links: checked 1468, broken 0
doc placement: 扫描 440 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] 全部通过。
CF_EXIT=0
```

被引件指纹（`wc -lc` ＋ `sha256sum`，2026-11-24 02:4x 实测）：

| 文件 | 行 | 字节 | sha256 |
|---|---|---|---|
| `docs/roadmap/ROADMAP.md` | 360 | 26,554 | `1f4cadb1acaea6be4273194f4829268fa0c7bbcad4b7a7028a6a4e40200e7a3e` |
| `docs/design/architecture/architecture-consistency-design.md` | 404 | 27,938 | `31a3c1702df37fdd215921a78c4beeb19758fd3f34b238ce64ae1bc5f2f8d9ba` |
| `.batch/night/reports/task-ledger.md` | 932 | 220,167 | `95bcd80f93f8d66abc175cf11b2a0409339c348310b5abcf9507e18b20493bc0` |
| `.batch/night/org/BACKLOG.md` | 161 | 26,314 | `19dc0e0de85a0efbd23d8bf8b92a9fd680bf0ce07ffbbd3ae06fb987aec8f371` |
| `.batch/night/org/ac-closeout-1124.md`（本件，重出前） | 76 | 5,811 | `fd6d1e8ba2910da42d3448257d222f3fbc74b2b6c6d86d3115a06f34fbc9d14f` |

判词三件（未变）：`ac1-s1-verdict.md` 135 行／10,173B／`cff7edda…`；`ac2-s2-verdict.md` 101 行／13,812B／`c4c2c40d…`；`ac3-s3-verdict.md` 123 行／10,799B／`55e849f9…`。

ROADMAP 口径已统一：§1 汇总表 `:34-37` 四行与 §2 明细 `:125`／`:133`／`:141`／`:149` 同为「达标」；`L0-ARCH` 保持「未开始」（子项 `L1-ARCH-02` 仍阻塞在第四件前置）。合并 sha 已回填（AC1 `2e43a912`／AC2 `ab79550c`／AC3 `113f7d4d`）。

## 六、done-when ⑥ 现值与显式缺口

- 合并已落：`ab79550c`（AC2，父 `f21c6979`＋`0953015f`）、`113f7d4d`（AC3，父 `ab79550c`＋`b5a14f1c`）；AC3 冲突落在 import 块与 core 读取块，已解。
- 合并后 `grep -c "db:character-roster-read" src/services/consistency-preflight.ts` = **1**（`:69`）；`db:project-core-get` = 1（`:48`）；冲突标记 0。
- 本件写就时 `git status --porcelain` 0 行（HEAD `97908e8c`）；`git rev-parse HEAD` 与 `git ls-remote origin refs/heads/exp/resource-ledger` 的相等性由主身推送后由 admin 复核并在群里贴原文——推前本地领先（回填笔＋本件）。
- 显式缺口（不得写成已达成）：
  1. AC2 地名侧仍走既有 `findSpaceTimeConflicts` 的 trim 全等（`src/shared/space-time-consistency.ts:286`），「逐字包含」未接线；`parseRegisteredSpaceNames` 无调用点。
  2. AC3 在两级「卷/单元」结构恒 fail-open（`src/shared/synopsis-two-level-suffix.ts:37` 禁「覆盖：」行），要判须先改输出合同。
  3. AC2 台账缺失时整条 fail-open 且台账为第二放行来源（`named-registration-consistency.ts:109`／`:127-129`），卡面与文档不得写「冲突以登记行为准已实现」。
  4. AC2 外派轮次无回执头，交付面＝主身补完提交 `5e99d2ad`，不伪造回执。
