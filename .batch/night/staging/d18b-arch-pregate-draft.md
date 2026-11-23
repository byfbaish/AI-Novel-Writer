From: 项目总负责人 · AI writer项目组 | 64419d69
To: WorkBuddy · AI writer项目组 · 群分身

# D18b「arch 前置闸」卡面草案（v1 · 未投、未 start）

> 状态：**草案**，等 admin 放行后按 `.batch/night/cards/_CARD-TEMPLATE.md`（硬字段版 v3）定稿投出。
> 硬框架由 admin 11-22 定，**三条一条不改**：① 判据只一条、标 `[live]`；② 做法限前置准备（seed／夹具），不改 D18 判据面、不扩白名单、不动 `generation:read-context` 契约；③ D18b 排 D5 之前，两卡共用一趟实机、evidence 分两份。
> v1（11-22 23:2x admin 三处裁定）：外派只做脚本、实机归 developer；实施包必须先出；D5 看板卡 id 回填。见 §9。
> 本草案不改卡面模板口径（§0–§8 字段与机检照模板原文），也不 start 阶段。

## 0. 工作区前置【硬】

- 工作目录：`C:\develop\workspace\AI-writer\wt-d18b`（新建 worktree），分支 `card/s5-d18b-arch-pregate`，起点 HEAD `<开工时 develop 主线 sha，由投出方回填>`。
- **禁在共用主工作区 `develop` 里改码或提交**；禁 `pnpm install` / `rebuild` / `pnpm dev`（切 ABI 会打断其它槽位；node_modules 走 junction，缺失即回执停手）。
- 开工第一动作按模板 §0 六项逐条核（`show-toplevel` 规范化比较／`branch --show-current`／`short HEAD`／`diff --numstat HEAD` 与 `--ignore-cr-at-eol --stat HEAD` **双空**＋`--cached` 空／`porcelain` 首列无 `M A D R U` 且 `??` 等于白名单（本卡白名单：`.batch/night/staging/d18b/` 全文）／目标文件存在）。
- **作者数据隔离【硬】**：seed／夹具只准写脚本自建的临时项目目录（`C:\tmp\s5-outbound\d18b\workbuddy\proj\`，含其独立 `.ai-novel/` 与临时库副本）。**禁写作者真实项目目录、真实库、`develop` 工作树的 `.ai-novel/`**；取证结束即弃，不入库、不提交到仓内路径以外。

## 1. 起因与背景

S5 实机（11-22 夜）在点「AI 生成」前，大纲入口弹「**单元定位失败：已覆盖第 0 章（没读到 …/.ai-novel/partial_arch.json）**」，界面停在「AI 生成故事架构」，`chatCalls=0`、`promptChars=0`、第 6 章草稿未生成 ⇒ D18-3/4 与 D5-3 本轮无判据可依，记 **INVALID（前置缺口）**，不是 FAIL、不是 PASS。

机制（develop @`79c1bbb7` 实读）：

- `src/services/workflows/synopsis-unit-launch.ts:279` `probeSynopsisUnitLaunch`；`:321` `checkpointFound: found` 就是「是否真读到 `<项目>/.ai-novel/partial_arch.json`」；跳过原因词表 `:60-66` 里 `checkpoint-broken` / `checkpoint-lost` / `compute-null` 三条都落在「没读到／算不出」。
- 检查点键：`synopsis_covered_to`、`synopsis_unit_cursor`（`:20-40`、`:194-199`）；路径函数 `src/services/workflows/arch-step-checkpoint.ts:75` `${projectPath}/.ai-novel/partial_arch.json`。
- 现场两个输入同时缺：`coveredTo=0`（无检查点）＋ `plotStructurePlan` 无「单元」划界 ⇒ `computeSynopsisUnitRange`（`commands/architecture.command.ts:316-343`，需 `parseArcStructure(plan)` 非空且 `coveredTo < totalChapters`）返回 `null` ⇒ `:489` `compute-null`。
- 结论：**「读到文件」是必要条件，不是充分条件**——只 seed 文件、不 seed 可解析的弧光结构（卷/单元划界），`generateOpened` 仍会是 `false`，届时该轮同样记 INVALID，不得记 FAIL。

## 2. 要改成什么（唯一口径）

**只做前置准备，不改生产码。** 交件＝一个可重复的 seed 脚本（`C:\tmp\s5-outbound\d18b\seed-pre.mjs`，产物回流清单见 §5），在临时项目里同时准备三件事，使实机能在 arch 生成前读到检查点、并算出第 6 章所在单元：

1. `.ai-novel/partial_arch.json` 合法 JSON，至少含 `synopsis_covered_to: 5` 与显式 `synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 2, writtenInVolume: 5 }`（值以 `planUnitStats` 能算通为准，脚本须打印实际采用值）；`status=== 'broken'` 一栏必须不成立（即文件可读、UTF-8、合法 JSON）。
2. 临时项目的 `plotStructurePlan`（`db:project-core-get` 那一份）含可被 `parseArcStructure` 解析的卷／单元划界，且第 6 章落在上述游标的单元内——否则 `computeSynopsisUnitRange` 仍返回 `null`。
3. 库内大纲覆盖与检查点一致：夹具 `drafts` 覆盖 1–5 章（沿用 S5 现有夹具），使 `coveredTo===5`、`outlineCoveredTo>=1` 不触发 `checkpoint-lost`（`synopsis-unit-launch.ts:311-320`）。

**不做**：不改 D18 判据面（`open-write-dialog` 那条已 PASS 的不动）、不扩白名单、不改 `generation:read-context` 契约、不改 `probeSynopsisUnitLaunch` / `computeSynopsisUnitRange` / `arch-step-checkpoint.ts` 任何一行生产码。seed 只写在仓外临时目录，仓内零生产改动（`git diff --numstat HEAD` 应为空——本卡交件是**脚本与证据**，不是补丁）。

## 3. 落点与禁改区【硬】

- 改：无（仓内零改动；本卡不产生 patch）。
- 补：无新增测试；seed 脚本与取证脚本落 `C:\tmp\s5-outbound\d18b\`，回执与 evidence 落 `.batch/night/staging/`。
- **禁改**：`src/services/workflows/synopsis-unit-launch.ts`、`src/services/workflows/arch-step-checkpoint.ts`、`src/services/workflows/commands/architecture.command.ts`、`generation:read-context` 通道签名、`src/services/builtin-prompt-templates.ts`；作者真实库与真实项目目录；`docs/plans/prompt-assembly-backlog.md` 与看板卡（INVALID 留痕**由 admin / 写入人**按 §7 别名执行，外派不得代写）。

## 4. 验收判据【硬】

### 4.1 主判据（唯一一条，admin 定稿原文，不得增删）

1. `[live]` **实机在 arch 生成前必须读到 `.ai-novel/partial_arch.json`，读到则 `generateOpened=true`；读不到该轮判 INVALID（前置缺口），不得记 FAIL。**
   - 取证（同一实例、同一次启动，沿用 `wt-d18/.runtime/s5-live.mjs` 的 `:302` `const generateOpened = await clickButton(page,'AI 生成')`、`:305` `step('arch-generate', …)` 路径）：
     - `seedSha256`：点击前脚本对临时项目 `.ai-novel/partial_arch.json` 取 `sha256sum` 原文；
     - `generateOpened`：布尔，点「AI 生成」的点击返回；
     - `gapTextSeen`：末屏是否出现「单元定位失败」／「没读到 …partial_arch.json」文案（布尔 + 文案原文）；
     - `instancesThisRun=1`、`exitCode`、`leftoverElectronProcesses=0`，并把 `tasklist | grep -c electron` 的 **stdout 原文**写成 `tasklistGrepCount`；
   - 判定：`seedSha256` 非空 且 `gapTextSeen=false` 且 `generateOpened=true` ⇒ **PASS**；`seedSha256` 非空但 `generateOpened=false`（含 `gapTextSeen=true`）⇒ **INVALID（前置缺口）**，判词须原句写明「前置缺口，本轮不构成 D18b FAIL」；`seedSha256` 取不到（文件没落盘）⇒ **取证无效**，退回重跑，不得判 INVALID 也不得判 FAIL。

### 4.2 前置与纪律判据（不新增判据面，只是 §4.1 的门槛与取证格式）

2. `[static]` seed 脚本在临时项目内落三件（§2 的 1/2/3），且**仓内 `git diff --numstat HEAD` 为空**（本卡零生产改动）；print 出 `synopsis_covered_to`、`synopsis_unit_cursor`、`planUnitStats` 三个实际值。
3. `[static]` 作者数据未被触碰：临时项目路径在 `C:\tmp\s5-outbound\d18b\` 下、作者真实项目目录 `mtime` 与库文件 `sha256` 开工前后一致（两条命令原文）。
4. `[static]` seed 后 `parseArcStructure` 能解析 ＋ `computeSynopsisUnitRange(plan, totalChapters, cursor, 5)` 返回非 null：允许用一条仓外一次性脚本（`node` 直跑，import 不到时按 §2 打印值人工核），输出 `from=6`、`unitIndex`、`maxChapters≥1` 三行原文。**这是防「读到文件但算不出单元」的空跑**——缺此项，§4.1 的 INVALID 就分不清是缺口还是夹具错。
5. **门槛·联动（不属判据层）** **D5 共用同一趟实机**（由 developer 跑，不外派）：本卡这趟同时取 D5 的 `[live]` 判据（真实生成一次、产物内尖括号占位符为 0），evidence 另存一份；两卡各自记 `instancesThisRun` / `exitCode` / `leftoverElectronProcesses=0` / `tasklistGrepCount`，**同值可复用但必须各写各的**。
6. `[static]` 提交／外派纪律：外派不 `commit`、不 `push`、不动 `develop` 主区；`git status --porcelain` 只允许 §0 白名单。
7. `[static]` 判词/报告头三行定式：第 1 行 `执行方：<名字>`、第 2 行取数件三元组（路径／字节数／MD5）、第 3 行 `model=<模型名> | 倍率=<倍率> | provider=<官方直连/自有>`（外部执行方口径，模板 §4 第 9 条）。
8. `[static]` 取证件仓内副本：`evidence.json` 原件在判词入库同笔拷进 `.batch/night/staging/`，判词写原件路径／原件 sha／副本 sha（模板 §4 第 13 条）。

### 4.3 外派位（草案核心，admin 指定必写）

| 步 | 做什么 | 谁做 | 验收标准 | 产物回流 |
|---|---|---|---|---|
| ① 实施包（组内） | 给 seed 三件的字段级方案：`partial_arch.json` 两键取值、`plotStructurePlan` 需含的卷／单元划界形态、`drafts` 1–5 章夹具复用哪一份、脚本改哪几行 | **developer**（Architecture/IT Advisor，只出实施包，不写码、不 commit） | 实施包给到「文件:行 + 字段 + 取值」粒度，且写明「零生产改动」；缺任一项退回 | `.batch/night/staging/d18b/impl-package.md` |
| ② seed 三件＋执行脚本落地（**唯一外派位**） | 按实施包写 `seed-pre.mjs`（seed `partial_arch.json` 两键、`plotStructurePlan` 单元划界、复用 1–5 章夹具）与 `run-live.mjs`（单实例取证脚本），跑 Dry-run 打印三件实际值；**只交脚本与 Dry-run 输出，不跑实机** | **WorkBuddy**（经 workbuddy联络人派；周一至周五 09:00–12:00、14:00–18:00 禁派，模型 DeepSeek V4.1 Flash） | 脚本落盘可执行 ＋ `node --check` 通过 ＋ Dry-run 输出 §2 的 1/2/3 三件实际值原文 ＋ `git diff --numstat HEAD` 空（仓内零改动）；**不得自改实施包口径**，字段与取值与实施包不一致即退回 | `C:\tmp\s5-outbound\d18b\{seed-pre.mjs,run-live.mjs,seed-dryrun.log}`，回执走 `.batch\night\bridge\to-owner`；staging 副本由派单方落 |
| ③ 实机取证（**不属外派**） | 用 ② 交的脚本在该临时项目上跑**一次**单实例实机，同时取 D18b 与 D5 两份 evidence | **developer**（实机与验收判定按 11-22 主人边界不外派） | 判据 2/3/4/5 输出原文齐 ＋ `tasklistGrepCount` 两行 ＋ 两份 evidence 各含 §4.1 四键 ＋ `instancesThisRun=1`、`leftoverElectronProcesses=0` | `C:\tmp\s5-outbound\d18b\{evidence-d18b.json,evidence-d5.json,run.log}`，staging 副本由派单方落 |
| ④ 首验（不属外派） | 按派验单核 §4 全部判据 | **QA** | 首验单头 `执行方：QA`，与派验单 `执行方：<外派名>` 不相等（G1 机检） | `.batch/night/reports/d18b-qa-firstcheck.md` |
| ⑤ 终审并放行 D5 | 核 QA 首验、定 D18b 结论、放行 D5 同趟取证 | **项目总负责人** | 判词含 §4.1 判定键原文与三项实例证据 | 判词 + `.batch/night/staging/s5-d18b-evidence.json` |

外派**只做 ②**：不改实施包口径、不跑实机、不判定 PASS/FAIL（只交脚本与 Dry-run 读数）、不写判词、不碰仓库文档与看板、不派第二批（实机一次跑完两卡，禁二次启动）。
边界依据（11-22 主人定）：实机测试、验收判定、设计、交付把关、review 不外派；② 只是「写脚本＋Dry-run」，不含实机。

## 5. 交付物与信号【硬】

- 报告：`.batch/night/staging/d18b-report.md`，末行 `<!-- DONE -->`，含起点/终点 HEAD（应相同：零改动）、`git diff --numstat HEAD` 原文、§4 各判据命令输出原文。
- 报告头三行定式（模板 §5，缺行判不通过）；`执行方:` 在第 1 行。
- evidence：`.batch/night/staging/s5-d18b-evidence.json`（本卡）与 `.batch/night/staging/s5-d5-evidence-round2.json`（D5 同趟），各含 `instancesThisRun` / `exitCode` / `leftoverElectronProcesses` / `tasklistGrepCount` / `treeHead` / §4.1 四键。
- 信号文件正文只三行：卡号 / 回执路径 / `<!-- DONE -->`；投递留痕按模板 §5（relay 看 `resolved`＋`delivered`；CLI 直投看会话库行＋SHA＋回执全文）。

## 6. 派验单与首验【A 类必填】

- 派验单：`.batch/night/review-requests/d18b.md`（缺则不进 QA 判定）。
- 首验单：`.batch/night/reports/d18b-qa-firstcheck.md`；G1 机检同上。
- 判据分层说明一行（模板 §4 第 11 条后置补行）：本卡主判据 `[live]`、其余为 `[static]` 门槛与取证格式，无 `[mock]` 子断言。

## 7. 版本纪律与 INVALID 留痕（行政段，非外派段）

- 卡面改动另存 `.vN.md`，不覆盖；已投出版必须留档。
- **`D18-3/4`、`D5-3` 本轮记 INVALID**，三处都要落，措辞统一、逐字：
  > 本轮取证 `drafts` 仅 1–5 章夹具、第 6 章草稿未生成 ⇒ 前置缺口，判 **INVALID**；不当 FAIL，也不当 PASS。
  - **卡面**：`.batch/night/staging/s5-stage-card.md` 的 D5 段（`:17` 判据行后）与 D18 段（`:21` 判据行后）各加一条留痕注；
  - **缺陷稿**：`docs/plans/prompt-assembly-backlog.md` D5 行 `:128`、D18 行 `:141` 状态列追加同一句；
  - **看板**：D18 卡 `2b7eb20d-e3e5-49f2-b9bd-53ac73be713e` 描述尾部追加同一句；D5 卡 `d8371b26-b0bd-4639-a647-bf41ce78c863`（`D5 消除卷/单元结构输出里的模板尖括号占位符（模板或机检至少一侧闭环）`，容器卡 `61e4535d-0999-4dab-8c14-2e4bbc0b7fcc` 下子卡，revision 913 现读）描述尾部追加同一句。
  - 三处写入人＝admin 指定（建议产品经理唯一写缺陷稿、admin 写看板、派单方写卡面），**外派与 developer 一律不写**。
- 顺序硬约束：D18b **排在 D5 之前**；D18b 判 PASS 后 D5 的 `[live]` 才可用同一趟 evidence 判（若 D18b 判 INVALID，D5 `[live]` 同步记 INVALID、不得改记 FAIL）。

## 8. 身份与投递【硬】

- 卡面与信号投外部执行方用**形态 B**（`To:` 只写角色·群名·身份，不写 session 前 8 位）；群内 Bot→Bot 的 handoff 用形态 A。两者不混用。
- 绑定只认「角色＋群名后缀」的群分身；投出后须拿到 `resolved`＋`delivered` 两条，缺一条算没投。

## 9. 三处裁定已落（11-22 23:2x admin 裁，草案不自决）

1. **外派方＝WorkBuddy，只做 §4.3 的 ②**（seed 三件＋执行脚本＋Dry-run），实机那趟不外派，由 developer 跑（§4.3 ③）；等主身就「实机是否可外派」回话前，一律按此写。
2. **实施包必须先出**：developer ① 先交、含 seed 字段与命令原文；外派件不得自改口径（§4.3 ② 验收已写「与实施包不一致即退回」）。
3. **D5 看板卡 id 已回填**：`d8371b26-b0bd-4639-a647-bf41ce78c863`（看板 revision 913 现读，非自造）。
