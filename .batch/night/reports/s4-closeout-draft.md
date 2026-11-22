# S4 收口件（草案 · 提案，未入库）

- 作者：项目总负责人 · AI writer项目组
- 日期：2026-11-22
- 性质：**提案与件**；缺陷稿回写已按主身口径**落盘未提交**，核过由主身与判词同笔入库（含本件、缺陷稿回写、模板三条）
- 依据：Goal stage 4 Done when 四项原文；admin 19:1x 五条口径；S1–S3 已 pass 的六卡口径

## 1. 与 Goal Done when 四项逐条对齐

### 1.0 范围口径（主身 11-22 19:2x 定，主人 19:24 已悉）

- **文件口径 20 条 vs Goal 字面 D1–D18**：缺陷稿 `:5` 自订「按 20 条口径……D21 属另立条目不计入本 20 条」；`:67` 即 `| **D20** | … |`（加粗使 `^| D20 ` 落空，曾误报「缺 D20 行」）。
- **差集 D19、D20 一并纳入本批判定**；D21 注「另立条目，不计入本批」。
- 这处字面差 **不由本文档抹平**，也不改 Group Goal 的 Done when；主人已知并留待后续修订。本件不写「已与 Goal 对齐」。

### 1.1 ① 缺陷稿 D1–D20 逐条 ✅ 并附实机复验输出路径

缺陷稿正本：`docs/design/product/live-pipeline-acceptance-defects-assessment.md`（1,241 行 / 158,898B，本件读数取 HEAD `ec508ec1` 库内 blob）。

现标与 S3 证据对照（**回写动作**列即 S4 要落的改法；未列的 D 项现标已是 ✅，不动）：

| D | 缺陷稿现标 | 收口证据（实机输出路径 + 判词库内 blob） | 回写动作 |
|---|---|---|---|
| D1 | ✅ S2 收口 | 判面 `0f0ca3ee`；run `8b090993-736`；evidence `.runtime/.cache/s2-d1/ddcfaef9-fca/evidence.json`；判词 `s2-d1-qa-firstcheck.md`（142/8,702/`079cceb0…72c3a7`） | 不改标，只把「判面」换成 merge sha `0f0ca3ee` |
| D12 | ✅ S1 收口 | 判面 `d95821e4`；evidence `.runtime/.cache/d12-replay/fe9c195b-1cf/evidence.json` | 不改标 |
| D2 | ✅ 已实施并实机复验 | `68a37585`；2026-11-06 22:4x 项目副本实机 | 不改标 |
| D13 | ✅ S2 收口 | 判面 `a4503f10`；merge `bff3d327`；evidence `.runtime/.cache/s2-d13/222c67b6-314/evidence.json`；判词 `s2-d13-qa-firstcheck.md` | 不改标 |
| D14 | ✅ 已实施（已复验） | 2026-11-02 自动建结构 + 推进实机 | 不改标 |
| D19 | ✅ 已实施（已复验） | 同 D14 批次 | 不改标（纳入本批：D19 属文件 20 条口径，见 §1.0） |
| D20 | 🟡 已实施（作者已裁结项不验，表例未回写） | 缺陷稿 `:67`：作者 2026-11-06 裁「选项③」结项（不验）；本体 `eef01325`、D20b `115ff490`→`3248b967`、D20c `4b510d2a`→`72b20beb` | **状态口径待统一**：不算 ✅、不算不结案、不列 S5；本轮已在 `:67` 补「结项（不验）」字样，图标保留 🟡 图标按 🟡 保留，属结项不验，图例待后续统一 |
| D3 | ✅ 已实施（11-10 实机复跑） | 旧复验见本文 §「实机复跑（2026-11-10 02:0x–02:11）」；**剩余一项见本件 §3** | 保留旧证据，另加一行「剩余一项：`handoff-missing` 档实机未复现 → 由 S4 卡 CARD-S4-D3-residual 承接」 |
| D4 | 🟡 已实施，待实机 | **S3**：`a2a9d1d5`（五文件 133+/26−）；evidence `.runtime/.cache/s3-d4/945ff8a4-e3b/evidence.json`（判词直读 `stepLog[batch:diag].body`）；判词 `s3-d4-qa-firstcheck.md`（219/17,336/`94fe4c68…2f95`） | **改 ✅**：写「S3 收口（2026-11-22），判面 `a2a9d1d5`，判词 `94fe4c68…`」 |
| D5 | 🟡 已实施（待实机） | 无 S3 证据（`87684f48` 只到单测） | **本批不结案（🟡，仅单测级）**，转 S5（见 §5 排序 1） |
| D6 | ✅ 已实施（方向撤回、重定义） | — | **加标注「作废（主人 11-22 定：D6 不复活）」**，保留历史原文 |
| D7 | 🔍 已取证（不符不成立） | **S3**：`544dcbd5`；判词 `s3-d7-qa-firstcheck.md`（233/17,869/`423ca481…`）；枚举复算 `mismatches_old=350`／`mismatches_new=0`（288,800 组） | **改 ✅**：写「S3 收口（2026-11-22），判面 `544dcbd5`，折算预告与实现同口径，判词 `423ca481…`」 |
| D8 | ✅ 已实施（21:0x 复验通过） | — | **加标注「待作者另裁（不为本批销账依据）」**，保留历史原文 |
| D15 | 🟡 已实施 | 无 S3 证据 | **本批不结案（🟡，仅单测级）**，转 S5（见 §5 排序 2） |
| D9 | ✅ S2 收口 | 判面 `cd825b81`（merge）；run `2cd112ff-16d`；evidence `.runtime/.cache/s2-d9/2cd112ff-16d/evidence.json`；判词 `s2-d9-qa-firstcheck.md`（114/9,775/`0e2b99f5…`） | 不改标 |
| D10 | 🟡 已实施，待实机 | **S3**：`a73ec4c6`（判定面 `4a3aaf18`）；取证件 `.batch/night/staging/s3-d10-live-evidence.md`（39/2,532/`a517a50d…`，随 `dd883c20` 入库、可打开）；原始 `evidence.json` 246 行／10,526B／`cd73444e…`，原路径 `wt-d10/.runtime/.cache/s3-d10/b96d57c6-7c9/evidence.json`（随 worktree 移除），读数已摘录于该取证件与判词 §10（`afterCards=0`／`fourTablesZero=true`／`sampleCount=2`）；判词 `s3-d10-qa-firstcheck.md`（222/24,943/`c55ce76c…`） | **改 ✅**：写「S3 收口（2026-11-22），判定面 `4a3aaf18`、入库合并 `a73ec4c6`，判词 `c55ce76c…`」 |
| D11 | 🟡 已实施，待实机 | **S3**：判据 2 FAIL → **由 D11b 覆盖**；D11b 判定面 `a7012c51`、入库合并 `ec508ec1`；evidence `.runtime/.cache/s3-d11b/0a2815bf-a6e/evidence.json`（337/11,161/`4e382026…`）；判词 `s3-d11-qa-firstcheck.md`（204/12,533/`bdd5b340…`）＋`s3-d11b-qa-firstcheck.md`（187/12,561/`8fd184b9…`） | **改 ✅**：写「S3 收口（2026-11-22）：判据 1/3/6 由 D11 验收、**判据 2 由 D11b 覆盖**（去重键改读检查点卷号），判定面 `a7012c51`／合并 `ec508ec1`」 |
| D16 | ✅ 已实施（2026-11-11 老证据） | **S3**：实机 evidence `.runtime/.cache/s3-d16/af51f396-e79/`（`instancesThisRun=1`／`exitCode=0`／`leftover=0`）；入库合并 `de53e22e`；判词 `s3-d16-qa-firstcheck.md`（151/11,739/`9290851e…`）；IPC 原文 `generation:last-model` = `{"modelId":"d16-actual","modelName":"gpt-4.1"}` | **补新证据**（不改 ✅）：追加「S3 实机复核 2026-11-22，判面 `de53e22e`，判词 `9290851e…`；`2026-11-11` 老证据降为历史」 |
| D17 | ✅ 已结项 | 2026-11-05 实机 | 不改标 |
| D18 | 🟡 已实施（C1 重跑权限未开放） | 无 S3 证据 | **本批不结案（🟡，仅单测级）**，转 S5（见 §5 排序 3） |

**结论（四段式，不做加减法；admin 11-22 19:3x 裁，主身指出「16 ✅／4 不结案」是凑数、连同旧「17 ✅／3」一并作废）**：

> 判定面：20 条中 **✅14 结案**／**🟡3 不结案**（D5、D15、D18，仅单测级，转 S5）／**⛔1 作废销账**（D6，主人 11-22 定不复活）／**⏸1 待作者另裁、不计入本批**（D8）／**🟡1 状态口径待统一**（D20，表图标未回写，不算 ✅ 也不算不结案，见下行单列）。D21 另立条目不计入。

**D20 单列一行（状态口径待统一）**：作者 2026-11-06 已裁「选项③」结项（不验，改为设计稿 §8.3 定位路径），缺陷稿 `:67` 正文本就写着「实机验证：作者 2026-11-06 裁『选项③』不验」；但**表图标未回写**（仍是 🟡），故 D20 不算 ✅、不算不结案、不列 S5。本轮已把 `:67` 状态格补上「**结项（不验）**」字样，图标保留 🟡 待表例统一。 **图标按 🟡 保留，属结项不验，图例待后续统一**（admin 11-22 19:4x 定：不改 ⛔ 免得误读为作废，不改 ✅ 免得与图例冲突，`:90` 图例不动）。

S4 能改 ✅ 的是 **D4／D7／D10／D11** 四行＋**D16 补新证据**一行；D6 作废与 D8 待裁**都不计 ✅**，只在四段式里点名。

**盘上现状计数（本机实算，只是图标计数、不参与加减法）**：✅14／🟡4（D5、D15、D18、D20——其中 D20 属「状态口径待统一」，按四段式单列、不算不结案）／⛔1（D6）／⏸1（D8）。四段式是判定口径（14＋3＋1＋1＋1＝20，D21 另计），本行与它的差别只在 D20 的归类，不是两套结论（admin 11-22 19:5x 定：删掉与四段式并列的「🟡4 不结案」读法）。

### 1.2 ② 台账每卡一行证据

- **真实路径**：`.batch/night/reports/task-ledger.md`（878 行 / 212,296B，HEAD `ec508ec1` 库内 blob）。Goal Done when ② 写的 `reports/task-ledger.md` 在盘上不存在（`reports/` 是另一套仓内报告目录），收口一律用上列真实路径。
- **每卡一行定式**（S4 追加段用）：

```
| <卡号> | <一句话结果> | `<命令原文>` → `<输出摘录>` | `<入库 sha>`／判词 `<sha 前 8>` |
```

- **四阶段一行**写法（Goal 收口用，追加在台账末节）：

```
| 阶段 | 结论 | 判据与证据（命令原文 → 输出摘录） |
| S1 | pass（D12 收口） | `git merge-base --is-ancestor 0f0ca3ee HEAD` → rc=0；判词 079cceb0… |
| S2 | pass（D13/D9/D1） | 三条 rc=0（见本件 §2）；判词 c7e44c1d…/0e2b99f5…/079cceb0… |
| S3 | pass（D4/D7/D16/D10/D11b） | 五卡 merge sha + 判词 sha（见本件 §1.1）；`git status --porcelain -uall` → 1 项已知 `??` |
| S4 | 待 QA 四项 + 本件入库 | `pnpm check:fast`／`check-batch-hygiene --all`／`git status`／HEAD=ls-remote 四条原文 |
```

### 1.3 ③ 四条命令与读数（由 QA 一次跑完，本件只给口径与当前已知值）

| # | 命令 | 期望 | 当前已知（本件写时不代跑） |
|---|---|---|---|
| a | `pnpm check:fast` | 末行 `[check:fast] 全部通过。` ＋ `EXIT=0` | 待 QA 跑 |
| b | `node scripts/ops/check-batch-hygiene.mjs --all` | 0 项不合规 | 待 QA 跑（已知 `s3-d11-live-recheck-report.md` 为 `??`，按 admin 口径「batch-hygiene 不许入库」需先移出或标注豁免） |
| c | `git status --porcelain -uall` | 空 | 现 **11 项**（3 个 `M` ＋ 1 个 `D` ＋ 7 个 `??`）：`M .batch/night/cards/_CARD-TEMPLATE.md`、`M .batch/night/reports/task-ledger.md`、`M docs/design/product/live-pipeline-acceptance-defects-assessment.md`、`D .batch/night/staging/ask-owner-050.md`（非本批改动，报 admin 核）；`?? .batch/night/reports/s4-closeout-draft.md`、`?? .batch/night/reports/s4-closeout-qa-firstcheck-1122.md`、`?? .batch/night/staging/s3-d11-live-recheck-report.md`、`?? .batch/night/staging/s3-d4-evidence.json`、`?? .batch/night/staging/s3-d16-evidence.json`、`?? .batch/night/staging/s4-plan-proposal.md`、`?? .batch/night/staging/s4-qa-checkplan.md`。其中 `D` 与三份 `??` 是 admin/QA 本次动作留下的，非负责人改码 |
| d | `git rev-parse HEAD` vs `git ls-remote origin refs/heads/exp/resource-ledger` | 两个 sha 相等 | admin 19:1x 实核「远端 = HEAD = `ec508ec1`」；本机 `git ls-remote` 本日曾出现 120s 无输出（网络/GCM），**该条由 QA 现场跑并把原文进判词**，超时记「非产品问题、命令未完成」，不得写成 pass |

### 1.4 ④ 看板与缺陷稿逐条一致

- 比对办法：`看板（task board）卡片` × `缺陷稿 §2 表` 双向对照——①缺陷稿标 ✅ 的 D 项，看板不得留 todo/in-progress；②看板 done 的卡，缺陷稿该行必须 ✅ 或显式标注（D6 作废／D8 待裁）；③「已实施却挂 todo」＝不平，逐条列出。
- 本件不自验看板（不自查自己的交付），由 QA 按清单一次跑完并出判词。

## 2. D13／D9／D1 祖先证明（不许只写「S2 已 pass」）

本机 2026-11-22 实跑原文（cwd `C:\develop\workspace\AI-writer\develop`，HEAD `ec508ec1`）：

```
$ git merge-base --is-ancestor 0f0ca3ee HEAD ; echo rc=$?
0f0ca3ee rc=0
$ git merge-base --is-ancestor bff3d327 HEAD ; echo rc=$?
bff3d327 rc=0
$ git merge-base --is-ancestor cd825b81 HEAD ; echo rc=$?
cd825b81 rc=0
```

- D1 → `0f0ca3ee`（merge(card/d12-replay-retry)）rc=0
- D13 → `bff3d327`（merge(card/s2-d13-failure-contract)）rc=0
- D9 → `cd825b81`（merge(card/s2-d9-call-timeout)）rc=0

同批一并核过（S3 五卡，全 rc=0）：`a2a9d1d5`／`544dcbd5`／`de53e22e`／`a73ec4c6`／`a7012c51`／`ec508ec1`。

## 3. D3 剩余一项（S4 要办的那一项）

- **剩余的是哪一项**：`handoff-missing` 档——「上一卷正文已定稿、但没登记交接单」时，卷首闸门应弹出并给出口。2026-11-10 那次实机复跑只覆盖了 `prose-unfinalized` 档（副本正文只定稿 1 章，条件不具备），缺陷稿原文：「**边界如实**：本次未复现 `handoff-missing` 档的弹窗…该档的实机读数仍以 11-06 那次两档验证为准」。**11-06 那次是机制级/两档验证，不是本轮判据口径下的 `[live]` 单实例取证**。
- **判据从哪来**：卡面 CARD-S4-D3-residual（见排期提案 §3）判据 1–4，`[live]`，取证＝造「上一卷已定稿 + `volume_handoffs` 零行」的副本项目，跑一次提交，看闸门是否弹 `handoff-missing` 档、点出口后是否起 run；evidence 记三项实例纪律 + `tasklist | grep -c electron` 输出行。
- **证据从哪来**：`consistency_exemptions` 前后计数、`outline-progress-gate` 的 `reason` 档位原文、界面弹窗截图路径、`generation_runs` 前后行数。
- **不再拿 11-10 旧复验顶**：旧复验只作「同一闸门另一档已通过」的旁证，写成观察项。
- **D20b 为 D20 的实施拆分卡，不入 D 条目比对**（admin 11-22 19:5x 定；看板容器卡 `61e4535d` 下 done 为 17 张＝D1/D2/D3/D4/D6/D7/D9/D10/D11/D12/D13/D14/D16/D17/D19/D20/D20b，按 D 编号逐条比对时应排除 D20b）。

## 4. 卡面模板两行（随本件同笔入库）

已改 `.batch/night/cards/_CARD-TEMPLATE.md`（**工作副本当前读数 133 行 / 16,080B / `7ed11948…`**；HEAD 内是 130 行 / 14,928B / `d029de0c…`；入库分母一律以主身提交后 `git show <commit>:<path> | wc -lc`／`| sha256sum` 为准）：

1. §4 第 11 条 live 取证：`tasklist | grep -c electron` 的**输出行必须作为 evidence.json 的必落行**（字段值＝该命令 stdout 原文），只存整段 `tasklist` 原文或事后补测判「取证不完整」。
2. §4 新增第 12 条「**分母口径**」：一律用 `<commit>` 库内 blob 的行／字节／sha（`git show <commit>:<path> | wc -lc`、`| sha256sum` 两条原文），工作副本（尤其 CRLF 再现）不作分母。

## 5. S5 候选（主人 19:24 批三条补卡路线，S4 之后另起阶段）：D5 / D15 / D18

排序按「证据可得性 → 需外部裁定 → 需新口径」：D5 → D15 → D18 → D10b → D4b。S4 内不开卡、不预写卡面；D20 不在候选内（作者已裁结项，见结论段单列行）。

| 排序 | 候选 | 性质 | 前置条件 |
|---|---|---|---|
| 4 | D10b | 单稿层 `sourceStatus` 投影（D4 判据②正面口径） | D4 已 ✅；需先定义单稿层挂载点，属新功能口径 |
| 5 | D4b | 同上（批次层与单稿层「两层同屏」） | 与 D10b 合并裁一次，避免双卡同对象；排在 D10b 之后 |
| 1 | D5 | 卷/单元结构占位符残留实机验收（本批不结案，仅单测级） | 已有单测（`87684f48`），缺 `[live]` 取证；取证脚本可复用 S3 探针 |
| 2 | D15 | 卷单元区间重叠只告警不夹紧（本批不结案，仅单测级） | 存量库处于重叠状态，需先定「存量不修」的展示口径 |
| 3 | D18 | 蓝图钩子合同只报不拦（本批不结案，仅单测级） | 作者 11-05 裁「继续只报」，开权限需作者另裁 |
| D9b | `phase` 在渲染层消费 | D9 已 ✅、`d9b-callphase-renderer.md` 卡已在盘，未排期 |

- 以上均**不占 S4 名额**；S4 只办收口（主身 19:1x 原话：不重开 D13／D9／D1，不设「尾巴环」）。

**给主人的裁定请求（只写不问、不自裁）**：主人 11-22 19:24 已批「补 S5」这一路，候选**三条**（D5、D15、D18）；D10b／D4b 由负责人在本件入库后列并排序，S4 内不开卡。D20 不入 S5——作者已裁结项，仅表例待统一。

### 1.5 看板卡面注（宿主限制下的落点）

宿主行为：卡片一旦有执行记录，`task_board_update` 拒绝改 description（返回 `task has already been executed`），只允许改 tags／列。D5、D15、D18、D20 均有 2026-11-05 外部分结记录，故描述首行加注**无法落在卡上**。落点改为两处，逐字如下（admin 11-22 19:5x 定的原句）：

- D5／D15／D18 卡面注（tags 已落短标 `本批不结案·仅单测级·S5候选`；完整句记此处）：「本批不结案：仅单测级证据，转 S5 候选卡处理，不代表已修好」
- D20 卡面注（tags 已落短标 `结项不验·作者选项③`）：「作者 2026-11-06 已裁选项③结项（不验），本卡为视图占位，图标待统一」
- 四卡共用一行（`latestExecution` 说明）：「`latestExecution` 为 2026-11-05 外部分结，非本批判定，以缺陷稿为准」

**宿主已拒改已执行卡的描述（`task has already been executed`），原句以本件与 tags 为准。** admin 11-22 19:5x 定：不建同名说明子卡（会让 QA 的 done 计数多 4 张，还会被读成多出四条缺陷）；tags 现状够用，不再加码。
