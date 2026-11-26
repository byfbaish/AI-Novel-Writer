From: 上游重评首验·QA
To: 大肥鱼@主身

# 上游「不吸收清单」重评 ＋ 吸收候选包 · QA 首验判词

- 判者：QA（AI writer项目组群分身）· 2026-11-26 23:5x
- 派验单：`.batch/night/review-requests/reabsorb-20261126.md`（37 行）
- 受验件（**盘上实读取值**）：
  1. `.batch/night/reports/upstream-not-absorbed-20261126.md` — 546 行／**101,128 B**／`d79612b99b1ab6cefd5f2e108e59c891dae9eb808d3a5865d9d7f0355fd13a64`／末字节 `0a`
  2. `.batch/night/reports/upstream-absorb-candidates-20261126.md` — **71 行／8,220 B**／`f971079840a6a67e03a409adb46f409d1a44b01030490982c5cc3fe06d23ef0a`／末字节 `0a`
  3. 参照件：`.batch/night/staging/upstream-reabsorb-addendum-20261126.md` — 33 行／3,464 B／`b9173fd1…`
- 与派验单自报读数的差（**不算不合格**，按派验单口径以实测为准）：件一自报 100,711 B／`a227870d…`、件二自报 69 行／7,975 B／`c1ab80e4…`，均系 developer 按 C1 订正重写后未再自报新值，我取盘上值。
- 本轮授权：**只读**；未改两件一个字、未 commit 生产码、未 push。判词单独一笔提交。

## 结论

**不合格——限三处，改完只复核这三处，不必全篇重验。**

实质错误一处（B3 的前提是错的）、表格读数错一处（D9）、算术错一处（R 计数）。其余五条判据逐条成立，包括全部 9 个抽查 sha、4 个簇的计数、171／−288／473 三个关键数字与 324 条附录。

## 一、必改项

### M1（拦）§1.2 `:55`「我方 `ImportRunStage`／`importStagesFor` 命中 0 … 没有阶段机」——不成立

- 实测：`grep -rlE 'importStagesFor|ImportRunStage' src electron` → **8 个文件**命中 `ImportRunStage`：`src/shared/import-run.ts`、`src/shared/ipc-channels.ts`、`src/services/workflows/import-run-orchestrator.ts`、`src/services/workflows/import-workflow.ts`、`src/services/workflows/__tests__/import-run-orchestrator.test.ts`、`electron/repositories/import-run-repository.ts`、`electron/migrations/m04-import-effect-ledger.ts`、`electron/controllers/db-controller.ts`。
- 我方 `ImportRunStage` 是**11 值枚举**（`src/shared/import-run.ts:22`）：`parsing｜prepared｜knowledge｜global｜style｜blueprints｜author-commit｜author-publish｜author-postprocess｜refresh｜completed`；`import-run-orchestrator.ts:126` 还有 `REFERENCE_STAGES: ImportRunStage[] = ['knowledge','global','style','blueprints','refresh','completed']`。**只有 `importStagesFor` 确实是 0**（上游 `electron/repositories/import-run-repository.ts:12/207` 用的是 `importStagesFor({ purpose, authorInference })`，即按用途／作者反推**动态派生**阶段计划）。
- 正确说法：我方**有静态阶段机**（枚举＋编排器），缺的是「按 purpose／authorInference 动态派生阶段计划」＋运行索引候选查找＋删中间章后可写。原句「我方只有 prompt 模板层的逆向推演说明、没有阶段机」是错的。
- 影响（这是判不合格的原因，不是措辞问题）：B3a 的**代价与落点**建在这句话上——件写「代价 L，因为阶段机要并进我方可恢复状态机」，而实际接入点是**并进已有的 `import-run-orchestrator.ts` 阶段推进**，L 很可能降到 M。B3a 是八簇里最大一簇，按错误前提派卡会高估工时、也会让实施方去「新造阶段机」。
- 改法：把 `:55` 改成上述实测口径，并据此重估 §1.2 尾段 B3a 的代价／前置（`ImportRunStage` 11 值 vs 上游 `importStagesFor` 三阶段的映射表需要写出来）。
- 命令与输出：
  ```
  $ grep -rlE 'importStagesFor|ImportRunStage' src electron | wc -l
  8
  $ grep -rn 'importStagesFor' src electron | wc -l
  0
  $ git grep -n 'importStagesFor' upstream/master -- electron src | wc -l
  5
  ```

### M2 §3 总表 `:203` D9 行「我方 1 笔、凭证 `eef413c3b`」——两处都错

- `git rev-list --count 549522d4..HEAD -- public/skins` → **0**（不是 1）。
- `git show --name-only eef413c3b` 只碰 `.storybook/preview.tsx`，**没碰过 `public/skins`**；`eef413c3b` 是 D8 的凭证，D9 借用错行。
- 事实本身是对的（`git ls-tree -r --name-only HEAD public/skins` → `public/skins/anime-night.webp` 在；`git diff --name-status 549522d4..upstream/master -- public/skins` → `D`，上游删）。
- 改法：笔数改 **0**；凭证改成「文件在 HEAD（`public/skins/anime-night.webp`）＋ 主题引用点」，或引分叉前提交 `c365f44f0`（`feat: add safe image skins…`）／`37c2ae194`（`release: prepare v0.7.1…`）——按 §0 第 1 条，0 笔的行凭证只能靠「HEAD 留存＋引用」，别再挂别人那一笔。附录 `:531` 那条写的是「我方 HEAD 保留」，本就对，不用改。

### M3（轻）§1.11 `:122`／§2 `:185`「A 215 / D 122 / M 133 / **R 4**」——算术不自洽

- 215+122+133+4 = **474** ≠ 473。实测 `git diff --name-status 549522d4..upstream/master -- src/components | awk '$1 ~ /^R/' | wc -l` → **3**（`R052`／`R054`／`R088`），215+122+133+3 = **473**。
- 照 §0 第 4 条「只用读数说话」，两处 `R 4` 改 `R 3`。

## 二、逐条判据

### 判据 1 两栏口径 ＋ 抽 5 个 sha —— 成立（含 M2 那一行例外）

- 不吸收栏确实只剩「我方已独立取舍」一类；D5a（我方 0 笔）与 D2（唯一一笔是换壳产物）已转候选包，转出理由与 §3 表一致（65+44=109 条，与自适应）。
- **抽查 5 个 sha（全部命中，各 1 次）**：`046050d95`（D1）／`21c43e62c`（D3）／`6f26f42fa`（D4）／`c6a69bb0b`（D6）／`2880a05be`（D10）→ `git rev-list 549522d4..HEAD | grep -c '^<sha>'` 均 1。
- 加抽 3 个 B3b 凭证 `573434bbd`／`5e6a27f2e`／`596e4f6ce` → 各 1。
- C2b 的归属自查（`585c69258`／`27cd25361` 属上游、凭证改为三处 import 引用点）**是对的**：我复核 `git branch -a --contains 585c69258` → 只有 `remotes/upstream/master`，`549522d4..HEAD` 与 `fc576e08..HEAD` 均 0。小误一处（不影响凭证成立）：`:108` 列的 `DraftEditor.tsx:24/114/597/614` 里 **`:114` 是注释不是 import**（import 在 `:24`，动态 import 在 `:597`／`:614`），顺手改掉即可，不必另立必改项。

### 判据 2 十项改判逐条落地 —— 除 M1 外成立

- B1＋B2 合簇、写明我方 `electron/llm` 19 笔改了什么 ✓（`electron/llm` 我方 19／上游 45，实测一致；`model-discovery-service.ts` 4／9 一致）。
- B3 拆分 ＋ 两侧主题独立 ✓（抽 3 笔：我方 `80fcc7666`／`b0e6b8614`／`756a1276b` 全在可恢复导入／围栏主题；上游 `2d7a6f03d`／`59a07f06b`／`d4fd4119b` 全在运行索引／绑定／删章可写主题，**不是同一件事**的判断成立）——但 B3a 的缺口描述错，见 M1。
- B4 前置 C1／B3a ✓（注意 C1 已裁「不要、不排期」，件里 B4 前置仍写 `取消卡 1630c44b`，那是我方自己的卡，不是 C1，成立）。B5／B6＋B7／B9 转候选 ✓。B8 转新功能立项 ✓。
- C1 写死「不吸收、不排期」✓：两件分别见 `:98`（标题）／`:180`（总表）／候选包 `:25`／`:53`／`:71`；`grep -nE '待确认|等 C4 收口|C1 仍'` 三件 → 仅剩解释性叙述（`:545`、补件 `:26` 的订正说明），**没有排进线序的残留**。
- C2 按「主人定需要」写死、171 实测并注明与转述数差 ✓（`3 insertions(+), 171 deletions(-)` 复算一致）。
- C3 一次性不分期 ✓：`26 insertions(+), 288 deletions(-)`、我方 1 笔／上游 12 笔、`HEAD:` 与 `549522d4:` 双 PRESENT，四处复算全一致；件里没有「分期／两阶段」字样。
- C4 写「待主人裁」＋473＋取数命令 ✓（数字见观察项 O1）。
- C5 五步串行表＋回滚路径 ✓（`:150-158` 五步；回滚写「`revert` → 旧 lockfile `pnpm install` → 按旧 ABI 重编，回滚期间槽位保持停止」，与我方 `@electron/rebuild ^4.2.0` 独有的事实一致）。

### 判据 3 排序可复算 —— 成立

- 四簇抽查全对：D5a `-- .claude` → **0**（上游 396）；B9 `src/shared/writing-skills.ts` → **1**；C2a `src/services/draft-index.ts` → **3**；B5 `electron/vector-store.ts` → **15**。另核 B6＋B7 13／13·10／26、B3a 25／11、B4 10／21、B8 1／18 全一致。
- 依赖前置能指到簇号（B6＋B7→B5、B4→B3a＋`1630c44b`）✓；「数字小但被前置压后」的说明在 `:37`／`:40` 有 ✓；C2／C3／C5 线序与 owner 表抄的是负责人 23:28 口径 ✓。

### 判据 4 §0.1 口径更正 —— 成立，且没越界

- 复算一致：`git merge-base HEAD upstream/master` = `fc576e08`；`549522d4` 不是祖先（`--is-ancestor` NO）；`fc576e08..upstream/master` = **5,248**；`549522d4..upstream/master` = **4,355**；差 **893**（件写「约 900」，方向与量级对）。
- 越界检查：§0.1 只把差额登记为「已知未评面，本件不扩面」，**没有对那 893 笔下任何簇级结论**；唯一由它推出的是「上游 `src/components/stage` 从未到过我方树」这一条事实（依据是上游 stage 首笔 `268456559` 10-12 晚于分叉 08-16），属事实澄清，不是对未评增量下判定。合格。

### 判据 5 件读数与结构 —— 成立

- 附录 **324** 条逐条齐（`sed -n '207,535p' … | grep -c '^| \`'` → 324），簇分布 160/19/44/14/6/65/5/9/1/1 与 §3 表逐行对上；「324 vs 评估件 315 差 19 条」的解释与口径登记一致。
- 候选包 109 条（D5a 65 ＋ D2 44）✓；两件互引路径都存在（`upstream-absorb-candidates-…`／`upstream-not-absorbed-…`／补件）。
- 禁语 `grep -cE '绑定上游路线|方向不同|路线未定'` → 两件均 **0** ✓。
- 末字节均 `0a` ✓；行数／字节／sha 见件头（与自报值有差，已说明）。

## 三、观察项（不判不合格，请负责人定）

- **O1 C4 的两个路径数都对，但含义不同**：件写 473 = `git diff --name-status 549522d4..upstream/master -- src/components | wc -l`（我复算 473 ✓）；admin 23:37 给的是 **553** = `git diff --name-status HEAD..upstream/master -- src/components | wc -l`（我复算 553 ✓，`+62,337/−59,129` 一致）。两者差 80 个文件＝我方分叉后有、上游没有的组件。**按卡排工要用 553**（HEAD 对上游），473 只适合「相对 10-14 快照」这一口径。建议件里把两个数并列写清，否则派卡会少算 80 文件。
- **O2 C4 定性已过时**：件里仍是「待主人裁」，admin 23:37 已裁「一次性更换」，且要求专用分支＋槽位全冻＋基线 tag `pre-ui-rd-swap-20261126`→`2880a05be`。这属产品裁决，不归我判，但件若不更新，下游会按「待裁」处理。
- **O3 未跑 `pnpm check:fast`**：按派验单 §4「两件是文档、无代码改动」，未复跑；`git status --porcelain` 里两件分别为 `M`／`??`，未被我改动（件二 mtime 与我的读取时间一致，sha 已记录）。

## 四、复核范围（改完只验这三处）

M1 → `:55` 与 §1.2 尾段 B3a 的代价／落点；M2 → `:203` D9 行；M3 → `:122`／`:185` 两处 `R 4`→`R 3`。外加 `:108` 顺手把 `DraftEditor.tsx:114` 从 import 点里删掉。改完把新行数／字节／sha 报一遍即可，不必重跑第五条的 324 条与全部 sha。

---

## 五、复判（M1／M2／M3 ＋ 一致性），2026-11-26 23:5x

**对象读数（我实测，与负责人一致）**

| 件 | 行 | 字节 | sha256 | 末字节 |
|---|---|---|---|---|
| `upstream-not-absorbed-20261126.md` | 556 | 106,794 | `6e4f26cae70da2dc21863bdc13dff1d8cc60faa3dbaf73d0fb276eab9a219355` | `0a` |
| `upstream-absorb-candidates-20261126.md` | 71 | 8,903 | `04033674a5a0c24a9c63c5db6fc52b71ee32ea3e0172d3bafa02c104c35e7af9` | `0a` |

### M1 —— **闭合**

- §1.2 现在的表述与盘上代码逐项对得上：8 文件命中、`src/shared/import-run.ts:22-32` 11 值枚举、`import-run-orchestrator.ts:126` `REFERENCE_STAGES` 六阶段／`:127-129` `AUTHOR_STAGES` 五阶段／`:135` `stagesFor(run)` 按 `purpose` 二选一／`:139` `stageIndex` 同源——我逐行读过。
- 「只缺第三份计划表」这个结论**站得住**：上游 `src/shared/import-run.ts:44-49` 是 `IMPORT_STAGE_PLANS` 三份（`reference` 六阶段、`author` 五阶段、`authorWithInference` 八阶段把 `global→style→blueprints` 插在 `author-postprocess` 之后），我方 `REFERENCE_STAGES`／`AUTHOR_STAGES` 与上游前两份**逐字相同**；`importStagesFor` 的分支是 `purpose === 'reference' ? reference : authorInference ? authorWithInference : author`。`authorInference` 的取数链也核了：上游 `electron/repositories/import-run-repository.ts:914` `function readAuthorInference(runId: string): boolean`，调用点 `:207`（派生 plan）与 `:726`（组快照），字段在 `src/shared/import-run.ts:251/309/329`；我方 `grep -rn 'authorInference' src electron` = **0**，确属新列。
- B3a 代价 **L→M**、前置改「一页 flag 落库方案（含迁移列）」已落 §1.2 尾段；候选包 §1 `:20`、§2 `:39`、§4 `:64` 三处 B3a 行同步改成 M＋同一措辞，B4 前置（`:40`）也带上了 B3a。

### M2 —— **闭合**

- §3 `:210` D9 行：我方区间笔数已是 **0**，`eef413c3b` 明写「只碰 `.storybook/preview.ts(x)`，属 D8」，D8 行 `:209` 保留该凭证。
- 新凭证我逐个核了：`src/components/settings/AppearanceSettings.tsx:26` = `export const ANIME_SKIN_URL = \`${skinAssetBase}skins/anime-night.webp\``；`electron/services/release-skin-smoke.ts:12` = `const BUNDLED_ANIME_RENDERER_URL = './skins/anime-night.webp'`；`c365f44f0` 在 `549522d4..HEAD` 命中 **0**（分叉前 08-08「feat: add safe image skins and packaged qualification」），作「分叉前提交」用它成立。
- 附录 `:538` 那条同步改了，与 §3 表一致。

### M3 —— **闭合**

- `:128` 数字行与 `:192` 复核行都是 `R 3`（R052／R054／R088）且写「合计 473」；215+122+133+3=473 自洽。

### 一致性 —— **不通过（单点）**

- `grep -nE '待主人裁|主人未答|待裁'` 两件 → exit=1、0 命中，**这条形式上过了**；C4 在候选包 `:23`／`:41`／`:51`／`:71` 只有「已裁：一次性更换＋排工 553＋回滚 tag」一个口径，也过了。
- 但**不吸收件 §1.11 内部仍有两个互相矛盾的定性并存**（同一节内）：
  1. 「**定性（二次更正）**：原定性（等主人答复）作废。…C4 一次性更换，不分期推进」——已裁；
  2. 紧接着「**定性（补件 §1 第 4 条）**：**主人尚未答复**，本件不转候选、不判吸收也不判不吸收，只给代价与可独立回滚的分期，**等主人一句话**」——仍是待裁。
  另同节还留着「**分期（每期可独立回滚）**」三期表与「**本件只给代价不给结论**」，与「一次性更换、不分期」直接冲突。
- 为什么我没在上一轮点出：这三个字面词（「主人尚未答复／等主人一句话／只给代价不给结论」）不在负责人给的 grep 集合里——**grep 集合选得太窄会漏**，这条我记在案。
- 另 `:555` 审计注记把改前文写成「定性由『等主人答复』改为『已裁：一次性更换』」，实际改前是「**待主人裁**」；审计句在改写自述的历史，应写准。
- 改法（只动四处）：§1.11 第 2 段（补件 §1 第 4 条）整段改为「已被 23:37『一次性更换』裁定取代，作废」；分期表标题加「（已作废，仅留代价参考）」；「本件只给代价不给结论」删或改「已裁，见上」；`:555` 的「等主人答复」改「待主人裁」。

**复判结论：M1／M2／M3 三处闭合；一致性未过（§1.11 单节内两个定性并存）。退回只改上述四处，改完报新行数／字节／sha256，我不再重跑全件。**

---

## 六、四处一致性复核（最终），2026-11-27 00:0x

**对象读数（我实测）**：`upstream-not-absorbed-20261126.md` 556 行／**107,111 B**／`148c853aab021b75c70bedb5833f3c71fb6db0208733f6d5f6f8bffcabd93451`／末字节 `0a`；`upstream-absorb-candidates-20261126.md` **未动**（71 行／8,903 B／`04033674…`）。`git status --porcelain` 只有这两条（`M`＋`??`）。

| # | 位置 | 现状 | 判 |
|---|---|---|---|
| 1 | `:126` | `~~**定性（补件 §1 第 4 条）**：主人尚未答复…等主人一句话。~~` ＋「**已作废**——见本行上方『定性（二次更正）』：C4 已裁一次性更换、不分期推进。本段仅作留档，不再代表当前定性。」 | **过**（真删了语义，不是换词） |
| 2 | `:134` | 标题「**分期（已作废，仅留代价参考）**」，下一句「三期是『若分三期做』的代价参照，**不再作为推进方式**（C4 已裁一次性更换）」，三行表保留 | **过** |
| 3 | `:142` | 「**前置**：起卡前 porcelain 0 行 ＋ 回滚 tag `pre-ui-rd-swap-20261126`（→ `2880a05be`）；结论已在二次更正中给出（一次性更换）」，「本件只给代价不给结论」已删（`grep -n 不给结论` = 0） | **过** |
| 4 | `:124`／`:552`／`:554` | 三处「待主人裁」全为引述用法（`原定性（「待主人裁」）作废`／`C4 定性原改为「待主人裁」`），审计句不再改写自己的历史 | **过** |

**宽集合复扫**（`尚未答复|等主人|不给结论|待裁|未答|不分期`，两件）命中共 7 行，逐行归类全部合法：`:119`／`:188`／候选包 `:13` 是 C3 自己的「一次性、不分期」裁定口径；`:124`／`:126`／`:552` 是 C4 的已裁定性、已作废留档与审计引述；无第三类。

**结论：四处全过，一致性闭合。两件可以入库（不吸收件 `148c853a…`、候选包 `04033674…`）。** 我这一侧不再有未结项。
