From: developer · AI writer项目组
To: 大肥鱼@主身（D18b 派单方：WorkBuddy · AI writer项目组）
执行方：developer

# D18b「arch 前置闸」实施包（v1）

> 依据：`.batch/night/staging/d18b-arch-pregate-draft.md` v1（113 行／15,275B／`sha256 cb0bc4d0…`；admin 核过的 `b9ff7d10…`＝15,242B 那版，现盘已被负责人按 §4.2 第 5/8 条改标）。字段按草案 §2＋§4.1＋§4.3① 出，不改卡面口径。
> 代码读于 `ff914aea`（本轮实测 HEAD；草案写的 `79c1bbb7` 是旧基准，行号已按 `ff914aea` 复核）。
> 本包粒度＝`文件:行` ＋ 字段 ＋ 取值。**零生产改动**：下列脚本全部落 `C:\tmp\s5-outbound\d18b\`，仓内 `git diff --numstat HEAD` 必须为空。

## 1. 三件 seed 的总口径

实机要出现「点『AI 生成』→ 打开生成器」而不是「单元定位失败：已覆盖第 0 章」，必须同时满足 `synopsis-unit-launch.ts:278` 探针的全部前置：

| 探针分支 | 触发条件 | 本包如何不触发 |
|---|---|---|
| `checkpoint-broken` | 文件在、读不出（`:184` status broken） | 写合法 UTF-8 JSON，无 BOM |
| `checkpoint-lost` | `coveredTo===0` 且 `outlineCoveredTo>=1`（`:297`） | `synopsis_covered_to=5`，不为 0 |
| `no-cursor` | 推不出游标（`:308-313`） | 显式 `synopsis_unit_cursor` |
| `compute-null` | `computeSynopsisUnitRange` 返回 null（`:315`） | `plot_structure_plan` 可解析且第 6 章落在游标单元内 |

## 2. 具体取值

### 2.1 `partial_arch.json` 两键（第 1 件）

落盘路径由 `src/services/workflows/arch-step-checkpoint.ts:75` 决定：`${projectPath}/.ai-novel/partial_arch.json`。内容（最小集，其余键一律不写）：

```json
{
  "synopsis_covered_to": 5,
  "synopsis_unit_cursor": { "volumeIndex": 1, "unitIndex": 2, "writtenInVolume": 5 }
}
```

- `synopsis_covered_to: 5` —— 键名与类型见 `synopsis-unit-launch.ts:20-40`；探针只认安全整数（`:293-295`），字符串 `"5"` 会退化成 0。
- `synopsis_unit_cursor` 三键语义：`volumeIndex` 从 1 起、`unitIndex` 从 1 起、`writtenInVolume`＝本卷已写章数（`planUnitStats` 里 `min(floor(written), volumeChapters)`，`arc-position.ts:905-940`）。
- **这组数可由 `planUnitStats` 反推，且与推导函数一致**（所以即使漏写 cursor 也不会挂）：
  - `deriveSynopsisUnitCursor(plan, 12, 5)`（`architecture.command.ts:263-282`）取「含 `coveredTo+1`＝第 6 章的单元」→ 卷 1 单元 2；`writtenInVolume = 5 - last.majorRange[0] + 1 = 5 - 1 + 1 = 5` ⇒ `{1, 2, 5}`。
  - 一致性自检：仓库不变量是「游标指向下一个要写的单元」（`:255-262` 注释），故显式值必须等于该推导值，否则 `approveUnitContext` 复核会 fail-closed。

### 2.2 `plot_structure_plan` 最小形态（第 2 件）

写 `project_core.plot_structure_plan`（列由 `electron/migrations/m07-plot-structure-plan.ts:9` 建；读入口 `db:project-core-get`，映射见 `electron/controllers/db-controller.ts:300/2034`）。同时把 `project_core.total_chapters` 设为 **12**（`electron/migrations/baseline-schema.ts:27`）。

逐字文本（声明章数合计＝12，与 `total_chapters` 相等，`scaledBoundaries` 折算因子为 1，`arc-position.ts:430-442`）：

```
## 卷1：破局（约 6 章）
### 单元1：入局（约 3 章）
- 类型：因果驱动型
### 单元2：反制（约 3 章）
- 类型：因果驱动型
## 卷2：收束（约 6 章）
### 单元1：清算（约 6 章）
- 类型：因果驱动型
```

解析要件（对正 `arc-position.ts`）：
- 卷行必须命中 `MAJOR_HEADING`（`:213`）：`## 卷…：名称（约 N 章）`；单元行必须命中 `MID_HEADING`（`:214`）：`### 单元<N>：名称（约 N 章）`。章数括号可省，但**省了会走等权折算**（`arcWeight` `:61-63` 记 1 章），折算后第 6 章是否仍落在单元 2 就不可控——这里不省。
- `parseArcStructure`（`:332-405`）要求**每个卷至少 1 个单元**（`:404` `usable = majors.filter(item => item.mids.length > 0)`），否则整体返回 null。卷 2 只放 1 个单元即可（本卡不写到卷 2）。
- 第 6 章定位：`scaledBoundaries([6,6],12) = [0,6,12]` ⇒ 第 6 章在卷 1（`arcSpanForChapters` `:487-499`）；卷内单元界 `[0,3,6]` ⇒ 第 6 章在单元 2。与 cursor `{1,2,5}` 自洽。
- `computeSynopsisUnitRange(plan, 12, cursor, 5)` 预期输出（`architecture.command.ts:316-344`）：`from = 5+1 = 6`；`planUnitStats`：`volumeChapters=6`、`unitCount=2`、`writtenInVolume=5`、`remaining=1`、`remainingUnits=2-2+1=1`、`maxChapters=1`、`ratio=1/3 ⇒ state='tight'`；`volumeRemaining=1`；`maxChapters=min(max(1,ceil(1/1)), 12-6+1=7)=1` ⇒ **`{from:6, unitIndex:2, maxChapters:1, volumeRemaining:1}`，非 null**。
- ⚠️ `total_chapters` 必须 > 6：`:324` 对 `coveredTo >= totalChapters` 直接返回 null。用默认 100 也能算通，但卷/单元会被摊成 50/50，取值不稳定；本包固定 12。

### 2.3 1–5 章 finalized 夹具（第 3 件）

**实读结论：仓内没有 1–5 章 finalized 夹具。** 全仓 fixtures 只有 `src/shared/__tests__/fixtures/c5-ch6-hook-planting.fixture.ts`（第 6 章正文，与本卡无关）。因此：

- 权威链（供卡面引用）：写作入口 `nextWritableBlueprint`（`src/components/editor/ChapterCardEditor.tsx:850`）→ `readAuthoritativeNextChapter`（`src/services/authoritative-chapter-sequence.ts:36`）→ `db:draft-authority-sequence`（`electron/controllers/db-controller.ts:923`）→ `FinalizedDraftImportRepository.authoritySequence()`（`electron/repositories/finalized-draft-import-repository.ts:287`）→ `authorityRows()`（`:141-152`）**只认 `drafts.status='finalized'` 且 JOIN `contents` 有正文的行**。
- 可复用件＝现成脚本里的 DB 直插形态：`C:\develop\workspace\AI-writer\wt-d18\.runtime\s5-live2.mjs` 的 `seed-finalized-chapter` appDb 任务（我上一轮加的），SQL 形态为 `contents` 插一行 + `drafts` 插 `(chapter_no, status='finalized', version=1)`。它**不是仓内路径**，是仓外脚本；D18b 复用其 SQL 形态即可。
- **本卡的实际情况（重要，能省外派工时）**：D18b 判据只到「点『AI 生成』打开生成器」，不读 `draft-authority-sequence`；而 `checkpoint-lost`（`:297`）只在 `coveredTo===0` 时触发，本包 `coveredTo=5`，**不 seed drafts 也不会挂**。故 1–5 章夹具在本卡为「可选、仅为与卡面 §2.3 措辞一致」；若 D5 同趟要写作入口，则必须 seed（连续定稿序列 1–5 章 + 第 6 章蓝图，做法同上一轮 `s5-live2.mjs`）。
- 若选了 seed：`synopsis`（`project_core.synopsis`）里也要有 1–5 章标题，`plotOutlineCoveredTo`（`src/shared/plot-outline-contract.ts:282-287`）才读到 5；标题形态用 `## 第N章 <标题>`（`outlineChapterHeading`，`src/shared/chapter-heading.ts:84-94`，要求 `#` 后有空白）。**落盘后必须打印实际 `outlineCoveredTo`，不要假设格式命中。**

## 3. 两个脚本各改哪几行

基线：`C:\develop\workspace\AI-writer\wt-d18\.runtime\s5-live2.mjs`（411 行）。新脚本落 `C:\tmp\s5-outbound\d18b\`，不复用 wt-d18 目录内文件。

### 3.1 `seed-pre.mjs`（新建，不跑实机）

1. 建目录 `C:\tmp\s5-outbound\d18b\proj`，已有则整目录重建（保留 `.keep` 无关，本目录不在 relay 下）。
2. 写 `.ai-novel/partial_arch.json`＝§2.1 内容，`fs.writeFileSync(..., 'utf8')`，写完回读比对 JSON 可解析。
3. 打开该项目的 `project.db`（better-sqlite3，ABI 用 Electron 41.10.7；库路径 `<proj>/.ai-novel/project.db` 以实际项目结构为准，取不到就打印真实相对路径并停手）：`UPDATE project_core SET total_chapters=12, plot_structure_plan=<§2.2 文本>, synopsis=<可选 1–5 章标题>`。
4. 打印三件实际值：`synopsis_covered_to`、`synopsis_unit_cursor`（JSON 串）、`planUnitStats` 结果对象；再打印 `.ai-novel/partial_arch.json` 的 `sha256`。
5. 不启动 Electron、不写仓内路径。

### 3.2 `run-live.mjs`（由 `s5-live2.mjs` 复制后改 4 处）

| 位置（s5-live2.mjs） | 改法 |
|---|---|
| `:84-100` `launch()` | `cwd` 指向工作树根；`--user-data-dir` 换成 `C:\tmp\s5-outbound\d18b\userdata`（独立，防污染作者配置）。保留 `globalThis.__s5` 注入（`:92`）与 fetch 拦截。 |
| `:202` `enterProject()` | 保留（8 次重试＋reload＋以 body 含「章节蓝图」判成功）。 |
| `:202` 之后到 `:362`（章节蓝图→「写作第6章」→开始创作→judge-d18 的整段 D18 取证） | **D18b 不需要，删或跳过**：D18b 不验写作入口。D5 同趟要这一段时才保留，且必须在 arch 段之后。 |
| `:366-372`（`clickTreeItem(page,'情节大纲')` → `clickButton(page,'AI 生成')` → `generateOpened` → `clickButton(page,'开始生成')`） | 改为 D18b 主取证：点前先 `seedSha256`（对 `<proj>/.ai-novel/partial_arch.json` 取 `sha256sum` 原文）；`generateOpened` 取点击返回值；随后 `bodyInnerText` 判 `gapTextSeen = /单元定位失败|没读到.*partial_arch\.json/` 命中，并把命中原文截 200 字入 evidence；**不再点「开始生成」**（D18b 只验闸门开不开；D5 才需真实生成）。 |
| `evidence` 落盘段 | 写两份：`evidence-d18b.json`、`evidence-d5.json`；每份都带 `instancesThisRun`、`exitCode`、`leftoverElectronProcesses`、`tasklistGrepCount`（`tasklist \| grep -c electron` 的 stdout 原文）、`treeHead`、`seedSha256`、`generateOpened`、`gapTextSeen`。 |
| 收尾 | `app.quit()` 后等进程退出，再跑 `tasklist`；父进程先死时把 Electron 子进程树一并收（单实例，跑完即关）。 |

## 4. 自检与 Dry-run 命令原文

```bash
node --check C:\tmp\s5-outbound\d18b\seed-pre.mjs
node --check C:\tmp\s5-outbound\d18b\run-live.mjs
node C:\tmp\s5-outbound\d18b\seed-pre.mjs           # Dry-run：只 seed + 打印三件值，不启动 Electron
```

交件门槛（对外派 ② 的验收，逐条可核）：
1. 两个脚本 `node --check` 均 exit 0（贴原文）；
2. Dry-run 输出含 `synopsis_covered_to=5`、`synopsis_unit_cursor={"volumeIndex":1,"unitIndex":2,"writtenInVolume":5}`、`planUnitStats.maxChapters=1`、`partial_arch.json sha256=<64 位>` 四行；
3. 与 §2 取值不一致即退回（**不得自改口径**：改取值＝改判据前提）；
4. `git diff --numstat HEAD` 空、`git status --porcelain` 无仓内改动（脚本在仓外）。

## 5. 硬边界（不该动的部分）

- 不改 `synopsis-unit-launch.ts`、`arch-step-checkpoint.ts`、`architecture.command.ts`、`generation:read-context` 契约、`builtin-prompt-templates.ts`。
- 不碰作者真实项目目录与真实库；只写 `C:\tmp\s5-outbound\d18b\`。
- 不 commit、不 push、不动 `develop` 主区；不跑实机（实机归 developer，§4.3③）；不判 PASS/FAIL。
- cursor 数值不许「试到能跑」——它是判据前提，写死 §2.1 的值，跑不通就回报，不许改值重试。

## 6. 风险与回退

| 风险 | 判据 | 回退 |
|---|---|---|
| 临时项目结构与真实项目不一致（缺 `.ai-novel/`、库文件名不同） | seed 打开库失败 | 打印真实相对路径后停手回报，不猜路径 |
| `plot_structure_plan` 列不存在（旧库未跑 m07） | `no such column` | 临时项目用当前 develop 建的新库，不迁旧库 |
| 探针仍 `compute-null` | Dry-run 打印的 `planUnitStats` 为 null | 按 §2.2 核对卷/单元行是否命中正则，只改文本形态，不改数值 |
| 判 INVALID 时不成立 FAIL | `generateOpened=false` 且 `seedSha256` 非空 | 判词写「前置缺口，本轮不构成 D18b FAIL」原句 |

<!-- DONE -->
