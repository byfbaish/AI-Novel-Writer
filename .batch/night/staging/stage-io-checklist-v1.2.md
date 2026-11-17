# 阶段 → 输入件 → 输出件 → 结项依据 · 总表骨架 v1.2（P53）

> 执行方：产品经理｜类型：B 类（只落 staging，不改任何现有文件、不建 Project、不镜像）
> 依据：`.batch/night/reports/org-chart-1113.md`（汇报与红线）、`.batch/night/cards/_CARD-TEMPLATE.md`（卡面三行制）、`.batch/night/review-requests/P10.md`（派验单实样）、`docs/agents/acceptance-gates.md`（L0/L1/L2 分级，本表不复制其条文）
> 阶段划分：AI writer总负责人 11-15 定稿七段（S0–S6），本表只填内容，不改划分
> 时间：2026-11-15
> reissue v1.2：取代 v1（v1 = 12,647B / 119 行 / `889CEB922EDBDA96F273BDC713365F90`，原件保留不删）。只补两处机检：**S3 门禁 ⑤**（开工前核工作树 + 分支）与 **S6 门禁 ⑥**（结项复核同一对项），措辞对齐 `_CARD-TEMPLATE.md` §0 第 1、2 项；其余逐字未动。由因：P51 v1 卡未钉工作树，执行方落在共用 `develop` 上开工，而原判定式只核提交是否存在、不核提交写进哪棵树。

## 0. 三条填表约定

1. **路径一律相对仓库根 `develop\`**（relay 插件仓库 `C:\develop\workspace\dsh-handoff-relay` 除外，那条单独标仓库）。
2. **门禁判定式必须是能跑的命令**，写不出就标 `门禁待定` 并写卡在哪。本表的命令统一在 `pwsh` 下跑，路径用 `\`。
3. **可检查性只用现有件**：文件存在性、末行 `<!-- DONE -->`、`.done` 信号、MD5、提交 SHA 与父提交、`porcelain` 空、`--ignore-cr-at-eol`。不新造格式（负责人 11-15 采纳为硬约束）。
4. 每条命令里 `<卡号>` 是占位符，派卡时替换；大小写按实际文件名。

现存量（11-15 实测）：`cards\` 80、`review-requests\` 41、`reports\` 242（其中 `*-verdict.md` 40、`*-qa-firstcheck.md` 34）、`staging\` 67、`signals\` 14（`.done` 12）、`evidence\` 7。

---

## S0 · 提议

| 列 | 内容 |
|---|---|
| **输入件** | `无`（本段是起点，允许空手进） |
| **输出件** | ① 提议条目：进 `.batch/night/staging/` 或群内一行为准（此段不强制落盘件）；② 若提议直接转卡，则必须有卡面 `.batch/night/cards/<卡号>-<主题>.md` |
| **门禁判定式** | 转卡时：`Test-Path .batch\night\cards\<卡号>-<主题>.md` → 必须 `True`；且卡面必须含三行制（判定线/反例/产物落点）：`(Select-String -Path .batch\night\cards\<卡号>-<主题>.md -Pattern '验收判据','明令不动','交付').Count -ge 3` → 必须 `True`。不转卡则本段只留口头提议，门禁记 `N/A（未转卡）` |

## S1 · 需求确认

| 列 | 内容 |
|---|---|
| **输入件** | S0 的提议（口头或 staging 件）；若存在，卡面 `.batch/night/cards/<卡号>-<主题>.md` |
| **输出件** | 卡面定稿（`cards\`），且卡面顶部 `基线` 行已填：`git rev-parse --short=12 HEAD` 读数 + `porcelain` 状态 |
| **门禁判定式** | ① 文件存在：`Test-Path .batch\night\cards\<卡号>-<主题>.md` = `True`；② 基线非空：`(Select-String -Path ...\<卡号>-<主题>.md -Pattern '^- 基线：' -Quiet) -eq $true`；③ 起点 HEAD 可解析：卡面 `基线` 行里抄下的 12 位 SHA 用 `git cat-file -e <sha>^{commit}`（退出码 0）核，且 `git rev-parse --short=12 <sha>` 回读等于该值 |

## S2 · 方案与规格

| 列 | 内容 |
|---|---|
| **输入件** | 卡面（`cards\`） |
| **输出件** | 规格/方案件：`.batch/night/staging/<卡号>-<主题>.md`（验收文档、交互规格、判据草案），末行 `<!-- DONE -->`；若该规格进仓库，则改为 `docs/design/...` 并带 `> 状态：` 行 |
| **门禁判定式** | ① 存在：`Test-Path .batch\night\staging\<卡号>-<主题>.md` = `True`；② 末行标记：`(Get-Content .batch\night\staging\<卡号>-<主题>.md -Tail 1) -eq '<!-- DONE -->'` = `True`；③ 进仓库版另加：`node scripts/check-doc-placement.mjs --strict` 退出码 0 且输出「新增 0 条」 |

## S3 · 执行（改码或产物）

| 列 | 内容 |
|---|---|
| **输入件** | 卡面（`cards\`）+ 规格件（`staging\` 或 `docs/design/`）+ 派验单尚未需要；**改码类**另需起点 HEAD 已记录 |
| **输出件** | ① 卡面指定的报告：`.batch\night\reports\<卡号>-<主题>.md`，末行 `<!-- DONE -->`；② 交付信号：`.batch\night\signals\<执行方>\<卡号>.done`（执行方 = `doubao` / `workbuddy`），一行内容 `<卡号> <报告绝对路径> HEAD=<12 位>`；③ 提交（仅改码类）：提交 SHA + 父提交 SHA 写在报告里 |
| **门禁判定式** | ① 报告存在且末行标记：`(Get-Content ...\<卡号>-<主题>.md -Tail 1) -eq '<!-- DONE -->'`；② 信号存在：`Test-Path .batch\night\signals\<执行方>\<卡号>.done` = `True`；③ 改码类：报告里的提交 SHA 可解析 `git cat-file -e <sha>^{commit}`（退出码 0），父提交 `git rev-parse <sha>^` 与报告一致；④ 工作区干净：`(git status --porcelain).Count -eq 0`。**`/.batch/` 已在 `.gitignore:89`（11-15 实测 `git check-ignore` 命中），所以 `.batch` 下的产物永不进 porcelain——S3 的 C11 判据只对仓库文件有效，无需排除列表**；⑤ **开工树与分支（v1.2 新增，防 P51 v1 误投复发）**：`git rev-parse --show-toplevel` 两侧**规范化后**（正斜杠 vs 反斜杠、大小写）必须等于卡面 `§0` 钉的工作树，且 `git branch --show-current` 必须等于卡面钉的分支（只验 HEAD 会让 detached HEAD 蒙混）；任一条不符即停手——不写盘、不提交，回执照抄实质输出，**不得自行 `cd` 到别处继续**。措辞与 `_CARD-TEMPLATE.md` §0 第 1、2 项一致 |

## S4 · 首验（QA 工程层 / 金牌编辑文学层，按产物类型分岔）

| 列 | 内容 |
|---|---|
| **输入件** | 派验单 `.batch/night/review-requests/<卡号>.md`（**未登记派验单不进判定**）+ S3 的报告与信号 + 交付物（提交 SHA 或工作区状态） |
| **输出件** | ① 工程层：`.batch/night/reports/<卡号>-qa-firstcheck.md`；② 文学层：`.batch/night/reports/<卡号>-editor-firstcheck.md`（金牌编辑出，产物类型=正文/章节时走这条，不走 QA）；③ 两者末行 `<!-- DONE -->`；④ **首验单顶部固定一行 `执行方：<名字>`**（11-15 负责人定稿的硬格式） |
| **门禁判定式** | ① 派验单存在：`Test-Path .batch\night\review-requests\<卡号>.md` = `True`（缺则整段不成立，直接退回）；② 首验单存在且末行标记 = `True`；③ 首验单必须含逐条判据与结论：`(Select-String -Path .batch\night\reports\<卡号>-qa-firstcheck.md -Pattern 'PASS|FAIL|有条件通过' -Quiet) -eq $true`；④ **签字换身份（机检式）**：`$a=(Select-String -Path .batch\night\review-requests\<卡号>.md -Pattern '^执行方：').Line; $b=(Select-String -Path .batch\night\reports\<卡号>-qa-firstcheck.md -Pattern '^执行方：').Line; ($a -ne $b) -and $a -and $b` → 必须 `True`（两处取值必须不相等；任一处缺失即判不成立） |

## S5 · 终审 + 真机验收

| 列 | 内容 |
|---|---|
| **输入件** | S4 首验单（`reports\`）+ 派验单（`review-requests\`）+ 交付物 |
| **输出件** | ① 终审单：`.batch/night/reports/<卡号>-verdict.md`，末行 `<!-- DONE -->`；② 真机项证据：`.batch\night\evidence\<卡号>-<主题>.<png\|log>`；③ 终审单必须写明「依据 = 哪份首验单，不重复查」 |
| **门禁判定式** | ① 终审单存在且末行标记 = `True`；② 终审单引用首验单：`(Select-String -Path ...\<卡号>-verdict.md -Pattern '<卡号>-qa-firstcheck|<卡号>-editor-firstcheck' -Quiet) -eq $true`；③ 真机项（若卡面标了「真机」）：`Test-Path .batch\night\evidence\<卡号>-<主题>.png` 或 `.log` = `True`；④ 版本类交付另加：`git rev-parse HEAD` == `git rev-parse <tag>^{commit}` 且 `(git status --porcelain).Count -eq 0`（0.3.1 那次就是漏了这条） |

## S6 · 结项

| 列 | 内容 |
|---|---|
| **输入件** | S5 终审单 + S4 首验单 + 派验单 + 报告/信号 + 提交（若有） |
| **输出件** | ① **结项行落唯一台账 `.batch/night/reports/task-ledger.md`**（11-15 大肥鱼 定稿：一行一单，卡号首列且为唯一键，结论只许 `PASS`/`不通过`/`作废`/`转出`，依据必须是能打开的件或提交 SHA；过程写 `time-ledger-*.md`，两本不许同事实双写正文）；② 若进仓库：提交里同批带设计稿/ADR/台账（AGENTS.md §2 第 5 条）；③ **遗留项只写终审单尾 `## 遗留` 小节**（11-15 负责人定稿），群消息与 backlog 只许写指针、不许写正文 |
| **门禁判定式** | ① 三件齐：`Test-Path` 分别核 `<卡号>-verdict.md`、`<卡号>-qa-firstcheck.md`（或 editor 版）、`review-requests\<卡号>.md`，三个都必须 `True`；② **结项行已登记**：`Select-String .batch\night\reports\task-ledger.md -Pattern '^\|\s*<卡号>\s*\|'` 必须有命中，且同一卡号命中数 `-eq 1`；③ 提交类：`git show --stat --oneline <sha>` 与报告 numstat 一致，且 `git log --oneline -1 <sha>^` 的父提交等于报告里写的父提交；④ 跨仓库双空（涉及 relay 仓库时）：`git diff --ignore-cr-at-eol --stat` 为空 + `(git status --porcelain).Count -eq 0`；⑤ **遗留项落点（机检式）**：`(Get-Content .batch\night\reports\<卡号>-verdict.md -Raw) -match '(?m)^## 遗留'` → 必须 `True`，且该标题下首行非空、内容为 `无` 或含卡号/路径指针；⑥ **结项复核同一对项（v1.2 新增）**：`git rev-parse --show-toplevel` 规范化后仍等于卡面工作树、`git branch --show-current` 仍等于卡面分支——防「结项时才发现改动落在别的树或别的分支上」，与 S3 ⑤ 同口径 |

---

## 结项清单（一个任务要结项，逐项勾这些）

按顺序勾，任一项不勾不得宣布结项。每项后面给的是**怎么核**，不是「凭记忆」。

- [ ] **C1 卡面在盘且含三行制**（判定线/反例/产物落点）→ `Test-Path cards\<卡号>-<主题>.md` + 三关键词命中 ≥3
- [ ] **C2 派验单已登记** → `Test-Path review-requests\<卡号>.md`（未登记不进判定，这条是流程入口门禁）
- [ ] **C3 交付报告在盘、末行 `<!-- DONE -->`** → `Get-Content ... -Tail 1` 比对
- [ ] **C4 交付信号已落**（外部执行方）→ `Test-Path signals\<执行方>\<卡号>.done`；负责人/产品经理自产的 B 类件**无信号**，此项记 `N/A`
- [ ] **C5 首验单已出、结论明确** → `reports\<卡号>-qa-firstcheck.md` 或 `-editor-firstcheck.md`，含 PASS/FAIL/有条件通过
- [ ] **C6 首验 ≠ 产出人**（换身份）→ 人工核；**目前无机检字段，记已知缺口**
- [ ] **C7 终审单已出、引用首验单** → `reports\<卡号>-verdict.md` 且含首验单文件名
- [ ] **C8 真机项有证据**（卡面标了真机才勾）→ `evidence\<卡号>-*`；未做记 `N/A` 并写一句为什么
- [ ] **C9 验收口径里的每一条都给了读数**（不是「已检查」）→ 逐条对照首验单/终审单的判据编号
- [ ] **C10 提交 SHA 与父提交写在报告里，tag/HEAD 关系已核**（发版类必勾）→ `cat-file -e` + `rev-parse`
- [ ] **C11 工作区干净**（改码类）→ `git status --porcelain` 空；`--ignore-cr-at-eol` 复算无差
- [ ] **C12 同批文档已跟上**（改代码那次提交带设计稿/ADR/台账）→ `git show --stat <sha>` 里能看到文档文件
- [ ] **C13 遗留项已写进指定落点** → 目前**三处都有**（backlog / verdict 尾 / 群消息），无单一落点 → 记已知缺口，暂按「verdict 尾部为准」
- [ ] **C14 台账已记一行**（执行方、通道、凭据、结论、时刻）→ 台账文件里搜卡号命中

## 5. 已知缺口（不掩盖）

| # | 缺口 | 影响 | 建议 |
|---|---|---|---|
| G1 | ~~「首验 ≠ 产出人」无机器可读字段~~ **已裁定（11-15）**：派验单与首验单顶部各固定一行 `执行方：<名字>`，机检式＝两处取值必须不相等；已写进 S4 ④ | C6 可机检 | 已落地，派验单需补这一行（下次派卡起） |
| G2 | ~~遗留项三处分散~~ **已裁定（11-15）**：唯一落点＝终审单尾 `## 遗留`，别处只写指针；机检式已写进 S6 ④ | C13 可机检 | 已落地；历史 verdict 无 `## 遗留` 的按「待补」处理，不追溯 |
| G3 | ~~`.batch` 是否已入 `.gitignore` 未确认~~ **已确认**：`/.batch/` 在 `.gitignore:89`，`git check-ignore` 命中 | 无（porcelain 不受 `.batch` 干扰） | 无需处理 |
| G4 | B 类件（staging 草稿）无信号 | C4 需人工判 N/A | 已按大肥鱼 规则执行，无需新增机制 |
| G5 | `signals\lead\` 不在 relay watch 列表 | 产品经理自产件不能靠信号唤醒 | 已在跑：B 类卡只要产物 + 群里报读数 |

## 6. 与现有规则的关系（只给指针，不复制）

- 卡面三行制、单卡时限、停认领时刻 → `.batch/night/cards/_CARD-TEMPLATE.md` + 夜跑硬规则
- 派验单格式与「未登记不进 QA 判定」→ `.batch/night/review-requests/P10.md` 实样 + 组织架构红线
- L0 卡门 / L1 冲刺门 / L2 期门的分级与 15 条验收门 → `docs/agents/acceptance-gates.md`
- 改码提交同批带文档 → `AGENTS.md` §2 第 5 条

## 7. 本骨架不解决的事（明确不做）

- 不做 Project 镜像（清单定稿后才谈，顺序不颠倒）
- 不新造格式、不新增目录、不写判定脚本（脚本另派卡）
- 不定义阶段进入的**业务**标准（比如「需求确认到什么程度算确认」）——那归负责人裁定，本表只管「件在不在、能不能机检」

<!-- DONE -->
