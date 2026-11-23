# S5 三卡一次复判 · QA 判词（D5-3 ／ D15 ／ D18b，附 D18 主体卡）

- 受判方：QA · AI writer项目组
- 请求方：大肥鱼 · AI writer项目组（群 admin）
- 派验单：`.batch/night/review-requests/s5-d5-d15-d18.md`（75 行／5,507B／rev `aa1d69e8cfa3b3261f864a11ec700e097c662a7c8507dd7c05755fcd0e526915`，提交 `6f659db6`）
- 证据入库提交：`b397e478`
- 判词日期：2026-11-23
- 授权范围：只读复核＋落本判词。**未重跑实机、未改缺陷稿／台账／看板、未改证据原件、未 push。**

## 0. 判定面与入库面

| 卡 | 判定面 sha | 入库合并 sha |
|---|---|---|
| D18b（arch 前置闸，补验卡） | `7b48f074`（取证树 `wt-d18`） | 待合并回填（由 admin／主身在合并 7b48f074 后回填；本卡零改码） |
| D5-3 | `7b48f074` | 待合并回填（同上；D5 档 A 零改，判定面＝D18b 同一棵树） |
| D15 | `f95ed1da`（父 `17794aa9`，分支 `card/s5-d15-overlap-tests`） | 待合并回填 |
| **D18（主体卡，钩子合同）** | `7b48f074` | **未合并** —— `git show 6f659db6:src/shared/hook-payoff-report.ts \| grep hook-unplanted` 空 ⇒ 该提交仍不在 `develop` 线上，合并前 HEAD 不能当入库面 |

现状：`develop` HEAD `6f659db6`，`git status --porcelain -uall` 0 行。

## 1. 证据独立复核（我自己算的，不是转述）

| 文件 | 行/字节 | 派验单 sha256（前12） | 我复核 |
|---|---|---|---|
| `.batch/night/staging/d18b/evidence-report.md` | 84 行／5,110B | `1537f103056e` | 一致 |
| `.batch/night/staging/d18b/evidence/evidence-d18b.json` | 95 行／51,602B | `6dbd9cb8fa62` | 一致 |
| `.batch/night/staging/d18b/evidence/evidence-d5.json` | 123 行／38,063B | `3de8d0183d7c` | 一致 |
| `.batch/night/staging/d18b/evidence/final.png` | 270,294B | `009c97333de4` | 一致 |

另核：`sha256sum C:\tmp\s5-outbound\d18b\workbuddy\proj\.ai-novel\partial_arch.json` = `08bf7cf1caa0878ac2cce1cf32476de169bda4be7c26655a08249398b6c077b5`，与 evidence `seedSha256` 逐字相等；当下 `tasklist | grep -ci electron` = `0`；`wt-d18` HEAD `7b48f074`、porcelain 0；`wt-d15` HEAD `f95ed1da`、porcelain 0。

我独立重跑的三条（不是引用交付方的 run）：

```
# 1) D5 守卫单测（wt-d18 @ 7b48f074）
node scripts/run-tests-electron.mjs src/shared/__tests__/arc-placeholder-guard.test.ts
→ Tests 22 passed (22)

# 2) D15 单文件（wt-d15 @ f95ed1da）
node scripts/run-tests-electron.mjs src/shared/__tests__/volume-structure.test.ts
→ Tests 32 passed (32)   TEST_EXIT=0

# 3) D18 两文件（wt-d18 @ 7b48f074）
node scripts/run-tests-electron.mjs src/shared/__tests__/hook-payoff-report.test.ts \
     src/shared/__tests__/hook-payoff-audit.test.ts
→ Test Files 2 passed | Tests 31 passed (31)（report 8 ＋ audit 23）
```

## 2. D5-3 判据（PASS）

| # | 判据 | 层 | 结论 | 依据（原文/读数） |
|---|---|---|---|---|
| 1 | 尖括号占位机检对样例命中、对合法尖括号不误报 | `[static]` | 通过 | `src/shared/arc-placeholder-guard.ts:32-50`：`/<([^<>]+)>/g`＋`EXEMPT_TAGS`（br/p/strong/span…）；单测命中表含 `<七点>`／`<钩子>→单元一｜<第一转折>`，不命中表含 `<br>`／`</strong>`／`《书名》`／`a < b`／`<未闭合`；我复跑 `Tests 22 passed (22)` |
| 2 | 落库前守卫仍接在写库路径上（非只存在导出） | `[static]` | 通过 | `src/services/workflows/commands/architecture.command.ts:3228` `findAngleBracketPlaceholders(content)`；命中后 `:3240-3247` 仅 `callbacks.log`（不阻断）；`writeArchToDb('plotStructurePlan', …)` 在 `:3258` ⇒ 守卫在写库之前、且在写库路径上 |
| 3 | 真实生成一次、产物内占位符为 0 | `[live]` | 通过（带边界） | `evidence-d5.json`：`entry=arch-dialog-plotStructure-only`、`chatCalls=1`、`promptChars=5628`、`promptPlaceholderHits=0`、`echoMode=full-prompt-echo`、`echoChars=5628`、`planBeforeChars=127`、`planChars=5640`、`planChanged=true`、`planContainsEchoHead=true`、`dbReadbackPlaceholderHits=0`、`physicalModelRequests=0`。按守卫无界正则口径：R1/R2/R3 三处 hits 均为 0 |

**判据 3 的边界（照抄，不许省略）**：桩返回的是 prompt 全文 echo，**判不了真实模型是否自写尖括号**；要判那一层需 `physicalModelRequests ≥ 1`，一次取样也证不了 0。另：evidence 只存计数（`promptChars`／`promptPlaceholderHits`），**没有 prompt 原文与 echo 原文键**，故 R1／R2 我无法独立重算，只认脚本计数；R3 的 `dbReadbackHead` 以 `# 卷 / 单元结构` 开头，可由 12 字前缀链旁证。

## 3. D15 判据（PASS，纯验收卡）

| # | 判据 | 层 | 结论 | 依据 |
|---|---|---|---|---|
| 1 | 卷内单元区间重叠 ⇒ 报 `VOLUME_UNIT_OVERLAP`、合法样态不报 | `[static]` | 通过 | `f95ed1da` 仅 `src/shared/__tests__/volume-structure.test.ts` +52/−0；新例①端点相接 7-9／10-10 ⇒ `expect(projection!.warnings).toEqual([])`；新例②全等 5-8 ⇒ `toEqual(['VOLUME_UNIT_OVERLAP:1:1-2:5-8','VOLUME_UNIT_AMBIGUOUS:1:1-2:5-8'])` ＋ `toHaveLength(1)`（注释明写「计数写死 === 1，不是 >= 1」）；我复跑 `Tests 32 passed (32)`、`EXIT=0`，`grep -c "it("`＝32 |
| 2 | 面板消费该告警成句、不重复计数 | `[static]` | 通过 | `src/shared/volume-warning-summary.ts:32-54`：只对 `AMBIGUOUS:` 累加 `ambiguousCount`，`else if (warning.startsWith('VOLUME_UNIT_'))` 分支空实现（overlap／inverted 不重复计数）；消费点 `src/components/editor/VolumeHandoffRegistryPanel.tsx:231` `useMemo(() => summarizeVolumeWarnings(volumeWarnings))`，成句 `:603-607`「第 … 章同时属于两个单元（卷内区间重叠）…」 |

注：本卡判据均为 `[static]`，无 `[live]` 项（阶段卡 `:18`／`:19`）。「实机面板看到一次成句」不在判据内，本轮未取证，**不作判定**、也不写成已验。

## 4. D18b 判据（PASS · 仅作「arch 前置闸」补验卡）

| # | 判据 | 层 | 结论 | 依据（`evidence-d18b.json`，run `aeddad33-cf5`，treeHead `7b48f074`） |
|---|---|---|---|---|
| 1 | 点「AI 生成」打开架构对话框 | `[live]` | 通过 | `generateOpened=true`、`clickAiOk=true`、`archDialogTitleSeen=true` |
| 2 | 未出现「单元定位失败」 | `[live]` | 通过 | `gapTextSeen=false`，`gapExcerpt` 为空串，`gapPattern=/单元定位失败\|没读到.*partial_arch\.json/` |
| 3 | 对话框可正常关闭、无残留 | `[live]` | 通过 | `archDialogClosed=true`（Escape）、`leftoverElectronProcesses=0`、`tasklistGrepCount="0"`、`tasklistHits=[]` |
| 4 | seed 指纹 | `[live]` | 通过 | `seedSha256=08bf7cf1…`，与我盘上独立 `sha256sum` 逐字相等；`core.synopsis` 五章标题为 `## 第1章：…`～`## 第5章：…`（`outlineCoveredTo=5` 得证） |
| 5 | 风控：本段未点「开始生成」 | `[live]` | 通过 | 本段未点「开始生成」；同 run `physicalModelRequests=0` |

实例纪律：`instancesThisRun=1`、`exitCode=0`、`leftoverElectronProcesses=0`、`tasklistGrepCount="0"`，四项齐。

## 5. D18 主体卡（钩子合同）：3/4 可判，判据 4 无法判定 —— 本阶段不能转 ✅

| # | 判据（阶段卡 `:20`／`:21`） | 层 | 结论 | 依据 |
|---|---|---|---|---|
| 1 | 事件型收尾行允许写未决后果 | `[static]` | 通过 | `src/services/builtin-prompt-templates.ts`（`7b48f074`）zh 约 `:1094`／`:1098`、en 约 `:1176`／`:1180` 均有「事情已经发生、结果还没发生」＋同一具名对象＋同一后果；反向锁 `blueprint-semantic-contract.test.ts:211-227` 断言 zh 含「事情已经发生、结果还没发生」、不含「它不是事件」、en 含 `it has already happened, its result has not`。字面仍有「它不是本章要完成的事件」⇒ 按 A-1 不动裁定，记记录项，不判 FAIL |
| 2 | B 环节函数级 `drifted`／`[]` 且生产未接线（裁定 ⑩） | `[static]` | 通过 | `git grep -n alignSuspenseHook 7b48f074 -- src electron \| grep -v __tests__` 只命中定义 `src/shared/suspense-hook-alignment.ts:58`，零生产调用点 ⇒ 裁定 ⑩ 成立，「B 无生产判据」是裁定不是遗漏 |
| 3 | 第 6 章两向（真落地带 `[hook-unplanted]` 恰 1 次／无 `hookInput` 不带前缀） | `[static]` | 通过（仅第 6 章） | prefix 只在 `marker = unplanted.length > 0 ? '[hook-unplanted] ' : ''` 时出现（`src/shared/hook-payoff-report.ts:54`）；新单测「未落地命中时句首带稳定机读前缀」`startsWith('[hook-unplanted] ')`、「蹭线-only 不带机读前缀」`not.toContain('[hook-unplanted]')` 且含「蹭线」；真实正负对照 `hook-payoff-audit.test.ts:86-108`（旧钩子→`C5-unplanted` `metric=2`；当前钩子→不报，4 字）。**第 5／7 章未验，仓内零样本，只记账** |
| 4 | 定稿后标记在真实链路里出现一次（同一实例内取证） | `[live]` | **无法判定** | 本轮唯一实机 `aeddad33-cf5` 无写作／定稿段：`evidence-d5.json` 只有 arch 生成键（`promptChars`／`echoChars`／`dbReadback…`），**无 `hookInput`、无 `finalize`、无 `[hook-unplanted]` 计数键**；`evidence-d18b.json` 同样只到 arch 对话框。上一轮 `a59a522b-260`（`.batch/night/staging/s5-d18-evidence.json`）虽有写作段，但 `hookUnplantedPrefixCount=0`、`committedLinePresent=false`、`chatCalls=0`、`promptChars=0`，是当初判 INVALID 的那次。**D18b 的 PASS 是「arch 前置闸」补验，不构成判据 4 的证据。** |

**这一条是裁决项，不是我的判权**：把 D18 判据 4 由 D18b 顶替、或把判据 4 降级／移出本阶段，都必须先改卡面留痕（阶段卡 `:21` 或 D18 卡面），再按新判据判；我不能把判据让给派验单的命名。三条路供裁：

- ①**补一次定稿段取证**（第三次实机，违反「实机只做一次」，需负责人明示放行）：按 `s5-live-evidence-plan.md` §6.3 走单章定稿，取 `hookInput` 原文＋`[hook-unplanted]` 恰 1 次＋「定稿内容已提交」仍在；
- ②**改卡面留痕把判据 4 移出 S5**：D18 本阶段只收 3/4，缺陷稿写「定稿链路标记未验（前置缺口），留待下一批」；
- ③**接受 D18b 顶替**：须在阶段卡写明「D18 判据 4 由 D18b 判据 1-3 顶替」及理由，我据此改判（现派验单 §3 只有顶替的事实，没有卡面留痕）。

## 6. 四条偏差：逐条裁

| # | 偏差 | 裁定 | 理由 |
|---|---|---|---|
| 1 | `evidence-d5.json` 的 `card` 仍写 `"D18b"` | **采信，不重跑** | 该字段是基础块继承未覆盖；D5 身份由 `entry=arch-dialog-plotStructure-only` 与 `note` 唯一确定，判据键（`promptChars`／`promptPlaceholderHits`／`dbReadbackPlaceholderHits`／`planChanged`）无歧义，不构成证据串号 |
| 2 | `seedSha256` 只覆盖 `partial_arch.json`，不含 `project.db` | **采信，须写边界** | 指纹只担保 outline 侧；DB 内 `premise`／`worldbuilding`／`characters_arch` 的补足不在指纹内。对判据 1（闸门打开）无影响（该判据只依赖 `partial_arch` ＋ `plot_structure_plan`），但缺陷稿与台账不得写成「seed 全量被指纹担保」 |
| 3 | `planEqualsEcho=false`，差 12 字 | **采信，判为管线前置标题** | 我复算 5,640−5,628＝12；`dbReadbackHead` 以 `# 卷 / 单元结构\n\n`（12 字符）开头；`planContainsEchoHead=true` ⇒ 差值即管线补的统一标题，非内容丢失 |
| 4 | seed 夹具补 `premise` 41→82、`worldbuilding` 0→54、`characters_arch` 0→75 | **采信，属前置准备，不改判据前提** | 依据 `src/services/workflows/commands/architecture.command.ts:3174-3182` 对三项有 ≥50 字前置；不补则 arch 步直接失败，属夹具必要性；`partial_arch.json` 未动、指纹 `08bf7cf1…` 不变 ⇒ 判据 1 的 seed 前提未被改动 |

## 7. 收口结论与缺陷稿回写建议（**我不改，只给建议行**）

**三卡结论**：D5-3 **PASS**；D15 **PASS**；D18b **PASS（补验卡）**；**D18 主体卡判据 4 无法判定 ⇒ D18 本轮不得转 ✅**。

**S5 exit 判据**（阶段卡 `:23`「三卡 [live] 项齐」）：D5／D15 的 `[live]`／`[static]` 项齐；D18 的 `[live]` 项缺 ⇒ **按现状 S5 不满足 exit #2，不能整阶段 PASS 收口**。D5／D15 两卡可先按各自结论入收口；D18 等 §5 三条裁决之一。

### 7.1 缺陷稿（真身 `docs/design/product/live-pipeline-acceptance-defects-assessment.md`，1,241 行／158,795B）

| 行 | 现值 | 建议回写（建议由产品经理落，按其台账唯一写手规则） |
|---|---|---|
| `:70`（D5 行） | `🟡 已实施（2026-11-05，待实机）` | `✅ **S5 收口（2026-11-23）**：判定面/合并 <合并sha>；判词 `.batch/night/reports/s5-d5-d15-d18-verdict.md`。判据 1/2 [static]、判据 3 [live]（run `aeddad33-cf5`，R1/R2/R3 hits 均 0）；边界：桩 echo 判不了真实模型自写尖括号；大纲侧 7 行 20 处缺口由 P12-1（`bb169361`，2026-10-18）引入，不是 D5 做漏` |
| `:74`（D15 行） | `🟡 已实施（2026-11-05）…UI 是否消费这条告警未验` | 追加一句：`✅ **S5 收口（2026-11-23）**：apply `f95ed1da`（仅测试 +52/−0）＋合并 <合并sha>；判据 1/2 [static] 通过（`Tests 32 passed (32)` 独立复跑）；面板成句消费 `VolumeHandoffRegistryPanel.tsx:231`／`:603-607`＋`volume-warning-summary.ts:32-54` 只计 AMBIGUOUS 不重复计数；实机面板未取证` |
| `:80`（D18 行） | `🟡 已实施（2026-11-04 …）…判 INVALID…` | `🟡 **S5 部分收口（2026-11-23）**：判据 1/2/3 [static] 通过（apply `7b48f074`，**未合并**）；判据 4 [live] **未取证**（唯一一次实机无定稿段；D18b 是 arch 前置闸补验，不顶替判据 4）；第 5／7 章未验；转 ✅ 待裁决（补定稿段取证 或 改卡面留痕）` |

### 7.2 现值索引（`docs/plans/prompt-assembly-backlog.md`）

**行号错位需先纠正**：派验单 §6.5 写的「D5 `:128`、D18 `:141`」不在缺陷稿，而在本索引——D5 行 `:128`、D15 行 `:135`、D18 行 `:141`；缺陷稿 §2 表对应行是 `:70`／`:74`／`:80`。回写要覆盖**两处**，别只改一处。

- `:128` D5 现值格：`已实施（2026-11-05 · 待实机）` → `已实施（2026-11-05 · **S5 实机验收通过 2026-11-23**，判面/合并 <合并sha>）`，并删去「本轮取证…判 INVALID」旧句（该句属 S5 首轮，已被本判词取代）。
- `:135` D15 行：方向列按裁定 ⑦ 不改、不加注；只在其状态描述末尾追加 `；**S5 纯验收通过 2026-11-23**（`f95ed1da`，判据 1/2 [static]）`。
- `:141` D18 行：`已实施（2026-11-04 …）；本轮取证…判 INVALID` → `已实施（2026-11-04 · 六函数接线、只报不拦）；**S5 2026-11-23：判据 1/2/3 [static] 通过（`7b48f074`，未合并），判据 4 [live] 未取证待裁**`。按裁定 ⑧ 不动任何数字。

## 8. 记录项（不影响本次判据，供收口件与台账记账）

1. `evidence-report.md:75` 写「`develop git status --porcelain -uall` 3 行＝evidence 三个文件（`.batch/` 被 `.gitignore` 忽略，不阻提交）」——两半句自相矛盾：`.batch/night/staging/` **不在** `.gitignore:91-98` 的白名单里（`!/.../staging/` 缺），三个文件当时以未跟踪态出现是真；现已被 `b397e478` 收入索引，故此后不再出现在 porcelain。属文字瑕疵，不追溯改证据。
2. D18 apply `7b48f074` **尚未并入 develop**（HEAD 里 grep 不到 `hook-unplanted`）；D18b／D5-3 的「入库合并 sha」全部依赖这次合并，回填责任在 admin／主身。
3. D5 判据 3 的 R1／R2 只有计数、无原文，外部无法独立重算（R3 有 DB 读回片段可比）。
4. D15 面板实机成句未验（不在判据内，记账）。
5. D18 第 5／7 章未验（裁定 (a)，记账；不得写成已验）。
6. D18 判据 1 的字面仍有「它不是本章要完成的事件」（A-1 未动，记录项，不判 FAIL）。
7. 上一轮 `a59a522b-260` 的 evidence 仍在 `.batch/night/staging/s5-d18-evidence.json`（未被覆盖），本次判词以其为「首轮 INVALID」物证，不改不删。

---

判词完。判定面 `7b48f074`（D18b／D5-3／D18）／`f95ed1da`（D15）；入库合并 sha 待回填。本判词不改任何缺陷稿、台账、看板与证据原件。
