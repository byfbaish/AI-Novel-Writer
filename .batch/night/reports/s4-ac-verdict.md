# S4 首验判词 · AC 系 S4「收口与推送」

- 判定面（唯一）：`01b10720fd4254f5c5725e4a3d963f5a9c3309fe`
- 远端同 sha：`git ls-remote origin refs/heads/exp/resource-ledger` → `01b10720fd4254f5c5725e4a3d963f5a9c3309fe`
- 工作树：`git status --porcelain -uall | wc -l` → `0`
- 时间：2026-11-24 02:4x（Asia/Shanghai）；执行：QA · AI writer项目组
- 判据来源：群 Goal「AC 系一致性校验落地」stage 5 done-when ①–⑥（本件逐条对号，不采信交件方转述）
- 结论：**PASS**（六条全过，三条记账、两条未判边界，均不阻断）

## 1. 判据表

| # | 判据 | 标记 | 结论 | 关键读数 |
|---|---|---|---|---|
| ① | AC2／AC3 并入 develop，合并后 `grep -c "db:character-roster-read" src/services/consistency-preflight.ts` = 1 | [static] | 过 | 计数 `1`（`:69`）；两条真合并父链见 §2.1 |
| ② | ROADMAP 四条转「达标」并各带证据句，`L1-ARCH-02` 保持阻塞并写第四件前置未定 | [static] | 过 | §1 表 `:34-37` 四行「达标」；`L1-ARCH-02` `:38`「阻塞｜第四件前置（未定）」 |
| ③ | 设计稿 `:222`／`:231`／`:267` 与 `:229` 四处同笔改，S2.3 补两句 | [static] | 过 | `:216`／`:222`／`:229`／`:231`／`:267` 原文见 §2.3 |
| ④ | BACKLOG 两条＋显式缺口三条落盘 | [static] | 过 | `BACKLOG.md` 该节 6 条（`:139-144`） |
| ⑤ | 收口件给出各条原文与被引件行数／字节／sha256 | [static] | 过 | 指纹表 `:62-70`，五件 sha256 与我实跑逐项相等（§3） |
| ⑥ | develop HEAD 与 ls-remote 同 sha、porcelain 0、`check:fast` EXIT=0 | [static] | 过 | 见头三行；`CF_EXIT=0` |

## 2. 判据原文

### 2.1 判据①：两条真合并 + 单次读取

```
$ git rev-list --parents -n1 ab79550c
ab79550c3fcf80524d99b940c9d31d0a15cf4bb8 f21c6979cc6b67bed733f771c95a54e3cd6643ce 0953015ff5a404901ebf5373625ac6d5d954e64f
$ git rev-list --parents -n1 113f7d4d
113f7d4d671d845846f174bfeace1b91ec458148 ab79550c3fcf80524d99b940c9d31d0a15cf4bb8 b5a14f1cefaa57c5f02894139f2b4bede6f5cce1
$ grep -c "db:character-roster-read" src/services/consistency-preflight.ts
1
$ grep -n "db:character-roster-read" src/services/consistency-preflight.ts
69:    const snapshot = await ipc.invokeWithProjectSession(session, 'db:character-roster-read', session.projectPath)
$ grep -n "db:project-core-get" src/services/consistency-preflight.ts
48:    const core = await ipc.invokeWithProjectSession(sess…
$ grep -c "<<<<<<<\|>>>>>>>\|=======" src/services/consistency-preflight.ts
0
$ grep -c "findCharacterRosterRisks(" …  → 1
$ grep -c "findUnregisteredPersonRisks(" …  → 1
$ grep -c "findArcCoverRisks(" …          → 1
```

内容无丢失（各卡判定面到 HEAD 的 diff 行数全为 0）：

```
b5a14f1c..HEAD src/shared/arc-cover-consistency.ts                        0
b5a14f1c..HEAD src/shared/__tests__/arc-cover-consistency.test.ts         0
0953015f..HEAD src/shared/named-registration-consistency.ts               0
0953015f..HEAD src/shared/__tests__/named-registration-consistency.test.ts 0
0953015f..HEAD src/shared/consistency-preflight.ts                        0
6e0f6a63..HEAD src/shared/character-roster-consistency.ts                 0
6e0f6a63..HEAD src/shared/__tests__/character-roster-consistency.test.ts  0
```

我自跑（判定面 01b10720，非采信回执）：

```
$ node scripts/run-tests-electron.mjs src/shared/__tests__/character-roster-consistency.test.ts \
    src/shared/__tests__/named-registration-consistency.test.ts \
    src/shared/__tests__/arc-cover-consistency.test.ts \
    src/shared/__tests__/consistency-preflight-space-time.test.ts
 Test Files  4 passed (4)
      Tests  61 passed (61)          (10 + 13 + 11 + 27)
TEST_EXIT=0

$ ./node_modules/.bin/tsc --noEmit     (无输出)
TSC_EXIT=0

$ node scripts/check-fast.mjs
[check:fast] doc-placement ✓ 0.2s
0 项不合规
[check:fast] batch-hygiene ✓ 0.8s
[check:fast] 全部通过。
CF_EXIT=0
```

### 2.2 判据②：ROADMAP 表与明细同口径

```
docs/roadmap/ROADMAP.md:33:| L0-ARCH | L0 | 架构一致性（AC 系） | 未开始 | 无 |
docs/roadmap/ROADMAP.md:34:| L1-ARCH-01 | L1 | 层间一致性校验 | 达标 | 无 |
docs/roadmap/ROADMAP.md:35:| L2-ARCH-01-01 | L2 | AC1/S1 层内一致性 | 达标 | 无 |
docs/roadmap/ROADMAP.md:36:| L2-ARCH-01-02 | L2 | AC2/S2 层间引用完整性 | 达标 | 无 |
docs/roadmap/ROADMAP.md:37:| L2-ARCH-01-03 | L2 | AC3/S3 弧加入后校验 | 达标 | 无 |
docs/roadmap/ROADMAP.md:38:| L1-ARCH-02 | L1 | 候选复审批次（§8·判据⑰） | 阻塞 | 第四件前置（未定） |
```

`grep -c "未合并·待主身" docs/roadmap/ROADMAP.md` → `0`；§2 明细四条 `:125`／`:133`／`:141`／`:149` 均「达标」并带判定面 sha、判词路径与 sha256、测试数、变异口径、接线点。上一轮我指出的「§1 表四行仍「未开始」」已由 `01b10720` 修正，同文件矛盾消除。

### 2.3 判据③：设计稿四处 + S2.3 两句

```
:216  | **S2.3** | 高置信度才报（要求名字 ≥2 字 + 出现 ≥2 次）… **频率闸不适用（2026-11-24 裁定，实施改用结构化抽取）**；**重名时后一条覆盖前一条…**
:222  ### S3：**弧加入后的四层+弧校验**（前置 2026-11-23 已裁定，ADR-0027 D3）
:229  | **S3.4** | 弧与大纲的**覆盖一致性**… 守 §5 各二级小节（S1／S2／S3／S4）的边界
:231  **→ 成本：中。价值：高。前置已裁定（ADR-0027 D3），实体键＝结构位 ID、不建表**
:267  S3 前置已裁定（ADR-0027 D3），实体键＝结构位 ID、不建表。
```

`grep -c '§5\.1'` → `0`（死引用已无残留）。

### 2.4 判据④：BACKLOG 落盘

`grep -c "^[1-6]\. "` 在「AC 系收口转下期」节内 → `6`（`describeNamedEntityCoverage` 未接线／语义版另开卡／两级结构恒 fail-open／重名无信号／单章未传 `structuredRefs`／台账缺失整条 fail-open），显式缺口三条在收口件 §六 第 1–4 条（含「AC2 外派轮次无回执头，交付面＝主身补完提交 `5e99d2ad`，不伪造回执」）。

## 3. 判据⑤：收口件指纹表逐项复算

收口件 `.batch/night/org/ac-closeout-1124.md`：85 行／7,211B／sha256 `a81fded9eb64a56f1bc87e2373705304ebecc9b655354243cb83895c0d472d60`。

| 文件 | 收口件表（`:64-70`） | 我实跑 `wc -lc` ＋ `sha256sum` | 判定 |
|---|---|---|---|
| `docs/roadmap/ROADMAP.md` | 360／26,554／`1f4cadb1…00e7a3e` | 360／26,554／`1f4cadb1acaea6be4273194f4829268fa0c7bbcad4b7a7028a6a4e40200e7a3e` | 逐字相等 |
| `docs/design/architecture/architecture-consistency-design.md` | 404／27,938／`31a3c170…f8d9ba` | 404／27,938／`31a3c1702df37fdd215921a78c4beeb19758fd3f34b238ce64ae1bc5f2f8d9ba` | 逐字相等 |
| `.batch/night/reports/task-ledger.md` | 932／220,167／`95bcd80f…493bc0` | 932／220,167／`95bcd80f93f8d66abc175cf11b2a0409339c348310b5abcf9507e18b20493bc0` | 逐字相等 |
| `.batch/night/org/BACKLOG.md` | 161／26,314／`19dc0e0d…c8f371` | 161／26,314／`19dc0e0de85a0efbd23d8bf8b92a9fd680bf0ce07ffbbd3ae06fb987aec8f371` | 逐字相等 |
| 本件（重出前 76／5,811／`fd6d1e8b…`） | 表列为历史值 | 现件 85／7,211／`a81fded9…` | 历史列，标注为「重出前」，成立 |

判词三件（未变）：`ac1-s1-verdict.md` 135 行／10,173B／`cff7edda…`；`ac2-s2-verdict.md` 101 行／13,812B／`c4c2c40d…`；`ac3-s3-verdict.md` 123 行／10,799B／`55e849f9…`——与我此前三份判词落盘值一致。

## 4. 记账（不阻断，建议下笔顺手）

1. 收口件 `:18` 仍写「`docs/roadmap/ROADMAP.md`（360 行／26,432B）」，是 §二 正文里的旧字节数；`:64` 指纹表已改 26,554。同一文件两处字节数不一致，建议 `:18` 同步。
2. 设计稿 `:31` 概览表仍写「S3 弧加入后的四层+弧校验（依赖第五层落地）」，与本轮 `:222`／`:231`／`:267` 口径不一致；判据③只点了四处，故不算未达，建议下轮同笔改。
3. 台账 `:932`「- 本段只追加，不改既有条目；合并 sha 待主身推送后由产品经理回填。」与 `:928-930` 三行已填实际 sha（`2e43a912`／`ab79550c`／`113f7d4d`）矛盾。**更正我上一轮的行号**：我说的是 `:925`，实际在 `:932`（`:925` 现为表头行）；admin 按「待产品经理回填」全串 grep 零命中，是因为该行原文为「待**主身推送后由**产品经理回填」，不是同一串。按「小瑕疵、记账不阻断」处理。
4. 三张卡面仍写「合并 sha：未合并·待 S4 apply」（admin 已答 push 确认后一次改），记此以免后续引用卡面得旧值。

## 5. 未判边界

1. 我只判「合并结果与文档口径」；AC1／AC2／AC3 三条规则本身的代码正确性、变异有效性、负向非空已在各自首验判词里判过，本件不重判、不追认新结论。
2. `pnpm test`／`pnpm check:fast` 字面入口在本机仍受 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`（`wt-2/node_modules` 目录联接）影响，我按前几轮 admin 已裁定的等价入口（`node scripts/run-tests-electron.mjs`／`node scripts/check-fast.mjs`）取证，不另立新口径。
3. 判据① 的「合并后读一次」只对服务层 `src/services/consistency-preflight.ts` 计数；`db:character-roster-read` 的其他调用方（如有）不在本判据范围。
4. 本件为未跟踪件（`.batch` 不入库面），入库由 admin 提交；入库后以该提交为判词指纹。

## 6. 复验记录

| 时点 | 判定面 | 结论 | 变化 |
|---|---|---|---|
| 02:3x | `7b20406e`（远端 `113f7d4d`） | 不予 PASS | 判据②（§1 表四行未同步）／⑤（收口件快照停在合并前、缺 sha256）／⑥（本地领先 1 笔）三处未闭 |
| 02:4x | `97908e8c`（远端 `7b20406e`） | 不予 PASS | ②已修、⑤指纹补齐、⑥未推 |
| 02:4x | `01b10720`（＝远端） | **PASS** | 六条全过；新增三条记账、两条未判边界 |
