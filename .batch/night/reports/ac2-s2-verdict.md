# AC2/S2 首次验收判词 · 第 4 维【具名人物登记】层间引用完整性（卡 `4027dbef`）

- 判词人：QA（群分身）· 2026-11-24 00:3x
- 判定对象：`card/arch-ac2-s2`（worktree `C:\develop\workspace\AI-writer\wt-2`）
- 判定面三栏：
  - 接线起点 `681eeb66`（`docs(qa): AC1/S1 首验判词 PASS…`）
  - 代码＋夹具 `5e99d2ada99bc45d6b12f069bc27b2cb6a80d9b6`（父 `681eeb66`，5 文件 `+398/−8`）
  - 交付补件 `0953015ff5a404901ebf5373625ac6d5d954e64f`（父 `5e99d2ad`，3 件 staging 文档 `+643/−0`）
  - 实测 `git rev-parse HEAD` = `0953015ff5a404901ebf5373625ac6d5d954e64f`；`git status --porcelain` = 0 行
- **判决：PASS（五条判据全过）**；附 1 条待裁口径差（§6.1）与 5 条记账（§6.2–§6.6）、1 条合并指引（§7）。打回建议：无。
- 说明：本卡五条判据不含「外派回执四行头」；回执头不存在，交付面＝主身补完提交（§5），**不计入 PASS 条件**，作为显式缺口记账。

## 1. 判据总表

| # | 判据（admin 五条） | 标签 | 结论 | 证据 |
|---|---|---|---|---|
| ① | 解析器只认固定四段、不含 `hours=`／`entry=` 行 | static | PASS | `named-registration-consistency.ts:41-61`（`:49` `segments.length < 4`、`:50` 段非空、`:52` 机读字段排除、`:57` 「无」排除、`:55` 名不含 `=`）＋用例 ⑫⑬ |
| ② | 登记名去尾部括注后**单向**包含，不反查、不别名 | static | PASS | `:80-82` `coreName` 只去尾部 `（…）`／`(…)`／`【…】`；`:84-88` `containsNamed` 用 `container.includes(probe)`，`probe.length<2` 即 false；`:95-98` 无任何反查／别名表 |
| ③ | 名单空是显式未判（`registeredNamedPeople===0` 独立文案），台账读不到整条 fail-open | static | PASS（含 §6.2 记账） | `:107` 登记 0 ⇒ `[]`；`:109` `!scope.rosterNames` ⇒ `[]`；`:188-213` 四支文案，`:198-206` 为 0 支；`src/shared/consistency-preflight.ts:266` 字段注释「`null` = 读取失败；`0` = 显式未判」；`src/services/consistency-preflight.ts:85-86` 产出 `null`／条数 |
| ④ | 空间半边不出规则；`parseRegisteredSpaceNames` 无调用点、不算达成 | static | PASS | `space-time-consistency.ts` 零改动（`git show --numstat 5e99d2ad` 无该文件）；`grep -rn parseRegisteredSpaceNames src/ electron/` 只命中定义 `:165`；`:158-163` 注释自陈「本卡不据此发射规则」 |
| ⑤ | 正负用例＋变异（含 M4''） | mock | PASS | 13 用例见 `src/shared/__tests__/named-registration-consistency.test.ts`（145 行）；我自跑 6 发变异见 §3 |

## 2. 我方独立执行原文

- **新测文件**：`node scripts/run-tests-electron.mjs src/shared/__tests__/named-registration-consistency.test.ts`
  → `Test Files  1 passed (1)` / `Tests  13 passed (13)` / `TEST_EXIT=0`
- **既有两文件**：同上命令传 `consistency-preflight.test.ts`＋`consistency-preflight-space-time.test.ts`
  → `Test Files  2 passed (2)` / `Tests  35 passed (35)` / `EXIT=0`（8＋27）
- **三文件同跑**：`Test Files  3 passed (3)` / `Tests  48 passed (48)` / `ALL_EXIT=0`
- **闸门**：`node scripts/check-fast.mjs` → `[check:fast] doc-links ✓`、`doc placement: 扫描 439 份 md，当前违规 0 条…新增 0 条`、`0 项不合规`、末行 `[check:fast] 全部通过。`、`CF_EXIT=0`
- **纯函数无 IO**：`grep -nE "require\(|from '(node:|fs|path|electron)|ipc\.|document\.|window\.|localStorage|fetch\(" src/shared/named-registration-consistency.ts` → rc=1（零命中）；文件只有 `:1-3` 一行 `import type`
- **文件指纹**（`sha256sum`，与交件自报一致）：
  - `src/shared/named-registration-consistency.ts` 219 行 / 11,778 B / `a64bf1edc54f3abb04d5d67c9ed9cca8f4b7b4b59472ac52acef4322a7911de2`
  - `src/shared/__tests__/named-registration-consistency.test.ts` 145 行 / `52b5c2249342cdb4c418d0d4b90065765be48ec01d560edb30513f8c72035d67`
  - `src/services/consistency-preflight.ts` 92 行 / `e3431038b40b47b41796d5b0a833aeccf4c7b6b1ddedc1af931c95f66ff9f007`
  - `src/shared/consistency-preflight.ts` 311 行 / `ceaa7f462d52fedc10f56d34d2618da0a7a93a2afa29f8039384ba144604d914`
- **夹具改动只补字段不改断言**：`git show 5e99d2ad -- src/shared/__tests__/consistency-preflight-space-time.test.ts` → 8 处 `+8/−8`，逐处只是 `describeSpaceTimeCoverage({…})` 形参加 `registeredNamedPeople: 0, blueprintCharacterRefs: 0`，`expect` 行一行未动。

## 3. 变异测试（我自行逐发单改、跑、复原；`git checkout --` 后 porcelain 0）

| 变异 | 做法 | 结果 |
|---|---|---|
| M1 | 删 `:107` `if (registrations.length === 0) return []` | `Tests  2 failed \| 11 passed (13)`、EXIT=1（用例 ④⑤） |
| M2 | 删 `:109` `if (!scope.rosterNames) return []` | `Tests  1 failed \| 12 passed (13)`、EXIT=1（用例 ⑥） |
| M3 | `:81` `coreName` 改 `return name.trim()`（去掉去尾部括注） | `Tests  1 failed \| 12 passed (13)`、EXIT=1（用例 ③） |
| M4 | 删 `:123` `if (!reference \|\| reference.length < MIN_NAMED_ENTITY_LENGTH) continue` | **`Tests  13 passed (13)`、EXIT=0 ⇒ 单点不转红（等价变异）**：单字／空串仍被 `:96` `matchedByName` 首行 `return true` 挡在比对之外 |
| M5 | `:76` 键去 `trim()` 归一 | `Tests  1 failed \| 12 passed (13)`、EXIT=1（用例 ⑪） |
| M4'' | 组合：删 `:123` 的 `continue` ＋ `:96` 改 `return false` | `Tests  1 failed \| 12 passed (13)`、EXIT=1（**用例 ⑧**，与主身核盘记录一致） |
| 复原 | 还原后 | `Tests  13 passed (13)`、EXIT=0、`git status --porcelain` 0 行 |

结论：负向断言非空 —— 每一道守卫都有单点变异能把它打红；M4 的两道闸互为冗余，**M4'' 只证明该行为被断言覆盖，不等于「单点变异必转红」这条要求被满足**（按主身口径写）。派单 §5 原写「M4 删长度 continue ⇒ 用例 8 转红」与实际不符，属派单件笔误，已由主身核盘记录更正，不计外派责任。

## 4. 我方两个反例实跑（本卡任务书要求）

临时用例文件 `src/shared/__tests__/qa-ac2-counterexamples.test.ts`（6 例，**跑完即删**，不提交；删除后 `git status --porcelain` 0 行）：

**反例一 · 未登记人名**（世界观登记 老陈／林昭（主角）／门卫老周；蓝图点名「陌生人乙」）
- 台账 `['林某']`（查不到）→ `[CE1] [{"k":"named:unregistered-person:陌生人乙","ch":9}]`，恰 1 条，键为 `named:unregistered-person:` ＋ 原名，`sourceChapter` 取蓝图章号
- 台账 `['陌生人乙']`（有该名）→ `[CE1-roster] 1 0` ⇒ **只在台账、不在第 4 维登记的姓名，被放行、不报**
- 台账 `undefined` → 0 条（整条 fail-open）

**反例二 · 重名**（两条登记行同名「老陈」，定位分别为「早餐摊摊主」与「城西修车铺老板」）
- `[CE2-parse] ["老陈"] count= 1 keptLine= 老陈｜城西修车铺老板｜"又是你"｜主角的债主` ⇒ **后一条静默覆盖前一条，重名不可见**
- 蓝图点名「老陈」→ `[CE2-findings] 0`（命中即放行，规则对重名冲突无信号）
- 蓝图同名重复点名两次 → `[CE2-dup-blueprint] 1`（`seen` 去重，最多 1 条）

判定：**任务书三要素成立** —— ①只做逐字包含（无别名、无反查）；②名单空是显式未判而非静默通过（数据层成立，作者可见层缺口见 §6.2）；③`characters` 表不当判定真源——它只用于**放行**，不用于产 finding；代价见 §6.3。

## 5. 交付链缺口（照实记，不计入 PASS 条件）

- 外派会话 `60e73cbf-1e6c-4f93-8b31-ee117e6e82c0` 中断，**四行头回执不存在**；代码／用例／变异由外派写就但未提交，交付面＝主身补完提交 `5e99d2ad`＋`0953015f`。
- 主身自陈件 `.batch/night/staging/ac2-s2/ac2-s2-evidence.md`（93 行）§八 已照实写明「四行头口径不伪造」——与实测吻合，**不是**伪造回执。
- 因此本判词对「谁写的」不作背书：我方结论只针对仓库里的代码事实（复跑＋变异＋静态），与作者身份无关。
- 分支冻结核对（admin 00:35 独立核净，我同日复读一致）：`HEAD=0953015f`、`git status --porcelain` 0 行、卡分支仅 `5e99d2ad`＋`0953015f` 两笔；`src/shared/named-registration-consistency.ts` 工作副本与 `git show HEAD:` blob 逐字节相同（`a64bf1ed…`）。外派会话 00:31:43→44 曾把该文件写回原样、未 `git add`／`commit`，已停到 `idle`；**判定面＝`0953015f`，无漂移**。

## 6. 记账（不阻断本卡）

**6.1【待裁·口径差】设计稿 S2.3 的「出现 ≥2 次」未实现。** `docs/design/architecture/architecture-consistency-design.md:216` 原文「高置信度才报（要求名字 ≥2 字 + 出现 ≥2 次）」，`:219` 又写「S2.3 的『≥2 字 + ≥2 次』可继续沿用」。实现只有 `:21` `MIN_NAMED_ENTITY_LENGTH=2`（≥2 字），**无任何出现次数判定**：蓝图点一次即报。建议二选一由项目总负责人裁定：①按裁定后锚点改设计稿 S2.3，注明「锚点改为登记行后，`blueprint.characters[]` 本身即人工筛选结果，频率闸不再适用」；②补频率闸（成本更高，且会把一次性路人误报压下去、同时漏掉真正只点一次的关键人物）。我建议①，理由：点名清单已是策展输入，频率是自由文本抽取时代的降噪手段。

**6.2【记账】「显式未判」文案没有作者可见的出口。** `describeNamedEntityCoverage`（`:188-219`）无任何调用点（`grep -rn` 只命中定义与 `src/services/consistency-preflight.ts:11/17` 的 import／re-export）；两个对话框只调 `describeSpaceTimeCoverage`（`ChapterCreationDialog.tsx:378`、`BatchChapterCreationDialog.tsx:231`）。设计稿 `:220` ② 原意是「补 `:277-301` 的三支文案分支」，实现另写四支函数且未接线 ⇒ 数据层有 `registeredNamedPeople=0`，作者侧仍是静默。建议 S4 收口前接线（本卡派单 `:66` 禁碰面板，`ChapterCreationDialog` 不在禁列但属新 UI 面，宜另卡）。

**6.3【记账·射程后果】`characters` 台账是**第二放行来源**，不是判定源。** `:128-129` 台账命中即 `continue`。后果（§4 实测）：姓名只要在台账里、不在第 4 维登记，就永不报 ⇒ 本规则实际只覆盖「两边都没有」的姓名。这与派单 §5 第 1 条、实施包 §1.3（主角不写进登记块，台账缺失会把主角全误报）一致，判为**符合既定射程**，不算「把台账当真源」。项目总负责人 00:3x 补的口径一并记此：卡面或收口件**不得写「冲突以登记行为准已实现」**，否则下一个人按这句话做核对时，会误以为登记行是唯一的放行来源；S4 收口措辞亦不得写成「已校验蓝图点名与登记表一一对应」。admin 已把该口径注写进卡 `4027dbef` 卡面。

**6.4【记账】重名静默覆盖，且注释与实现自相矛盾。** `:39` 注释「同一人名重复登记时后一条覆盖前一条（…不静默合并矛盾登记）」——实现 `:58` `byName.set(name, …)` 就是静默覆盖，矛盾登记不产生任何信号；`namedPersonStableFactKey` 只认姓名，两条同名登记无法区分。重名检测不在本卡射程（`§6 本卡不做`），建议记 BACKLOG，并在下一版把注释改成「同名覆盖，后者为准」。

**6.5【记账】诊断信息颗粒度。** evidence 文案给出登记条数与全部登记名拼接（`registrySample`），长名单（数十人）会把一条 warning 的 evidence 撑到很长且不可读；建议截断（如取前 5 名 ＋「等 N 人」）。非阻断。

**6.6【记账】合并前的同名未跟踪件。** develop 工作树有两个未跟踪副本 `.batch/night/staging/ac2-s2/{dispatch-workbuddy.md,impl-package.md}`，sha 与分支内容一致（`bc475b00…`／`d1aa2ef1…`）；`git merge` 会因「untracked 会被覆盖」中止。合并前删副本即可（内容在 `0953015f` 中安全）。

## 7. 合并指引（不属判据，供 admin 用）

- AC2 分支起点 `681eeb66` **不含** AC1 合并 `2e43a912`（`git merge-base --is-ancestor 2e43a912 HEAD` → no）。两笔在同一插入点（`worldBuildingText` 之后）各加一段 `db:character-roster-read`：AC1 取 `status`／`factHash`，AC2 取 `entries[].name`。
- 直接合并会出现同位置冲突或**同一次预检读两遍台账**（多一次 IPC）。建议合并时把两段并成一次读取、两个用途：`const snapshot = await ipc.invokeWithProjectSession(session,'db:character-roster-read', session.projectPath)`，AC1 用 `snapshot`、AC2 用 `snapshot?.entries ?? []`；失败语义仍分别为「AC1 fail-open」「AC2 `rosterNames=undefined` fail-open」。
- 合并后须重跑：`named-registration-consistency.test.ts`＋`character-roster-consistency.test.ts`＋两个 preflight 测试＋`check:fast`（我方可复验）。

## 8. 未判边界（本判词不覆盖）

1. 未在真实 Electron 主进程＋真实项目库上实跑（本卡判据全为 static／mock；`[live]` 无）。IPC 通道 `db:character-roster-read` 的真实返回形状沿用 AC1 已验证的既有通道。
2. 未判 `blueprint.characters` 的实际内容质量（如是否含指代词「他」「那女人」）——`:106-112` 用例只证明不抛错，属已知不足（回执 §9 自陈）。
3. 未判地名侧「逐字包含」接线（显式缺口，`parseRegisteredSpaceNames` 未使用导出）；S4 收口不得据此写「层间引用完整性已达成」。
4. 未判 `describeNamedEntityCoverage` 文案的中英互译质量。
