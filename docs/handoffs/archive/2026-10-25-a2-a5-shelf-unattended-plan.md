# 三小时无人值守执行计划 · A2 + A5 + 书架删除

> 状态：**已执行完毕（2026-10-25）· 由主 agent 亲自执行，未交给 hy4** —— T1/T2/T3/T4 全部落地，但有 **6 处偏离计划**，见文末「执行结果与偏离」。不要按本稿再跑一遍。
> 基准：`exp/resource-ledger` @ `a36857c2`（实际从 `8fb02cde` 起执行）· 上级依据：`docs/research/2026-10-25-oh-story-absorption/assessment.md` §7 裁定表 · §9b 实施记录
> **本计划执行完毕前不改任何 prompt 文案。**（已遵守：本轮零 prompt 改动）

---

## 0. 执行者硬规则（违反任一条，整轮作废）

1. **按 T1→T2→T3→T4→T5 顺序执行，不跳步、不并行。**
2. **每步末尾的验证命令必须原样跑**，输出贴进报告。不通过就停，不许"再试一次改改看"。
3. **只改本计划点名的文件。** 顺手发现的问题写进报告，不要顺手改。
4. **不许动** `docs/agents/doc-placement-baseline.json`、不许跑 `--update-baseline`。
5. **不许自行判断设计问题。** 遇到计划没覆盖的情况：停下来，在报告里写「阻塞：<具体问题>」，等人工。
6. **每个任务一次提交**，提交信息用本计划给的模板，不许合并提交。
7. 开工前先读 `AGENTS.md`（硬规则 8 条）与 `docs/agents/documentation-charter.md` §6。

---

## 1. 前置检查（开始预算前做完，不计入三小时）

```bash
cd <repo>
git rev-parse --abbrev-ref HEAD        # 必须是 exp/resource-ledger
git rev-parse --short HEAD             # 记录，写进报告
git status --short                     # 必须为空；不空则停
pnpm run rebuild:electron              # 必须先做，否则 electron/** 测试跑不了
node scripts/check-doc-links.mjs       # 应报 broken 0
node scripts/check-doc-placement.mjs   # 记录「新增 N 条」，应为 0
```

**基线测试（记录数字，收尾时对比）**

```bash
node ./node_modules/vitest/vitest.mjs run src/services/workflows/commands/__tests__/generate-draft.command.test.ts src/shared/__tests__/visible-text-degeneracy.test.ts src/shared/__tests__/blueprint-verbatim-overlap.test.ts
# 期望：243 + 20 + 13 全绿

ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe ./node_modules/vitest/vitest.mjs run electron/migrations/__tests__/m03-review-cycle.test.ts
# 期望：全绿；记录用例数
```

---

## 2. 任务表与预算

| # | 任务 | 预算 | 外包 Copilot？ |
|---|---|---|---|
| **T1** | 书架每项可删除 + 路径失效仍可删 | 45 min | 否（要动 UI 语义） |
| **T2** | A2 · schema 迁移 + 仓库层（含 hash 纳入） | 60 min | 测试改造可外包 |
| **T3** | A2 · 报告合同 + UI 显示轴 | 30 min | 否 |
| **T4** | A5 · 生产 mainOwned 路径的预算断言 | 30 min | 否 |
| **T5** | 收尾：文档 + 体检 + 回归 | 15 min | 否 |

**超时处理**：任一任务超过预算 50%，停下来写「阻塞：超预算」，不要硬推。

---

## 3. T1 · 书架删除（45 min）

### 3.1 现状（已核实，不用再查）

- `src/components/pages/v2/WelcomePageV2.tsx:62` 的 `.writer-shelf`：每项只有「预览」「进入作品」两个按钮，**没有删除**。
- 只有 `onDeleteCurrentProject`（当前项目）存在，走 `use-project-overview.tsx:149`。
- 已有测试 `src/components/pages/v2/__tests__/writer-project-overview.browser.tsx:127` 断言 `书架 [title="删除项目"]` **为 null** —— 这条断言必须改。

### 3.2 要改成什么

1. 书架每一项都出现删除按钮（`title="删除项目"`），与当前项目那颗同语义。
2. 若该项目的**实际路径已不存在**，仍然可以删除；且该项要显示「路径不存在」标记，删除按钮不能因为「打不开」而禁用。
3. 删除必须二次确认（复用现有确认弹框，不要新写一个）。
4. 删除成功后从 `recentProjects` 移除（`src/stores/project-store.ts:1013` 已有 filter 逻辑，复用）。

### 3.3 步骤

```bash
# 1. 读懂三处再动手
sed -n '85,155p' src/components/pages/v2/use-project-overview.tsx
sed -n '50,75p' src/components/pages/v2/WelcomePageV2.tsx
sed -n '100,150p' src/components/pages/v2/__tests__/writer-project-overview.browser.tsx
```

```bash
# 2. 判断路径是否存在的通道（选一个，不要两种都加）
grep -n "exists\|stat\|isDirectory" src/shared/ipc-channels.ts | head
grep -n "project:recent-list" -A 4 src/shared/ipc-channels.ts
```

**判定**：若 `project:recent-list` 的返回里**没有**路径存在性字段 → **不要**为 T1 新增 IPC。改用「打开失败即标记」：把 `onOpen` 的失败结果记在组件状态里，失败的项显示「路径不存在」并保留删除按钮。若返回里**已有**该字段 → 直接用它。

```bash
# 3. 改 WelcomePageV2.tsx 的书架项
#    - 每项加一颗删除按钮，onClick 调新增的 prop onDeleteProject(project.path)
#    - 若该项被标记为 missing，加一行文案「路径不存在」并给它一个 data-missing 属性
# 4. 改 use-project-overview.tsx
#    - 暴露 onDeleteProject，内部复用删除当前项目的同一个确认弹框与删除 IPC
#    - 删除成功后调用 store 的移除逻辑（project-store.ts:1013 附近）
```

### 3.4 验证

```bash
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/pages/v2/__tests__/writer-project-overview.browser.tsx
```

**必须把 127 行那条「书架没有删除按钮」的断言改成「书架有删除按钮」**，并新增两条用例：

- 路径不存在的项目：仍能点删除，且点击后 `deleteProject` 被调用一次
- 删除成功后：该项从书架消失

### 3.5 提交

```
feat(shelf): 书架每一项可直接删除，路径失效的项目也能删

原来只有「当前项目」有删除入口，书架里的项目必须先加载才能删；
路径已不存在的项目更是永远删不掉。改为每项独立删除入口，复用同一确认弹框与
删除通道；打开失败的项目标记「路径不存在」但仍可删除。
```

---

## 4. T2 · A2 schema 迁移 + 仓库层（60 min）

### 4.1 决策（已由作者拍定，执行者不要重新判断）

- `review` 轴 = `'mechanical' | 'semantic'`，取值来自模型输出，缺省 NULL。
- **轴纳入 `canonicalM03FindingSetHash`**（作者裁定：同性质的必须进 hash）。
- **迁移里重算存量 `review_cycles.finding_set_hash`**（存量 finding 轴为 NULL），保证旧库打开后自洽。
- 存量 finding 的轴填 **NULL**，不按 category 猜。

### 4.2 步骤

```bash
# 1. 读清楚三处（不要凭记忆）
sed -n '41,50p'   electron/migrations/m03-review-cycle.ts   # canonicalM03FindingSetHash
sed -n '74,100p'  electron/migrations/m03-review-cycle.ts   # review_findings 建表 + CHECK
sed -n '310,325p' electron/migrations/m03-review-cycle.ts   # exactSchema 精确列清单
sed -n '20,30p'   electron/migrations/registry.ts           # MIGRATIONS + LATEST_SCHEMA_VERSION
```

```bash
# 2. 新建 electron/migrations/m20-review-class.ts
#    内容骨架（照抄结构，别改 hash 之外的字段）：
#    - export const M20_REVIEW_CLASS_SQL = `ALTER TABLE review_findings ADD COLUMN review_class TEXT
#        CHECK(review_class IS NULL OR review_class IN ('mechanical','semantic'))`
#    - 导出 apply(db)：执行 ALTER → 逐 cycle 用 canonicalM03FindingSetHash 重算 → UPDATE review_cycles
#      SET finding_set_hash=? WHERE cycle_id=?
#    - 重算前先把该 cycle 的 findings 读成 M03FindingDescriptor[]（列同名映射即可）
```

```bash
# 3. registry.ts 注册
#    MIGRATIONS 数组加： Object.freeze({ id: 'M20', from: 20, to: 21, owner: 'A2' })
#    LATEST_SCHEMA_VERSION = 21
```

```bash
# 4. m03-review-cycle.ts 三处同步
#    a) review_findings 建表 SQL 末尾加列（新库直接带列）
#    b) exactSchema 的列名数组加 'review_class'，约束数组加 "review_class IN"
#    c) canonicalM03FindingSetHash 的 immutable 对象加 reviewClass: finding.reviewClass ?? null
#    d) M03FindingDescriptor 接口加 reviewClass?: 'mechanical' | 'semantic' | null
```

```bash
# 5. 仓库层（electron/repositories/review-cycle-repository.ts）
grep -n "buildFindings\|persistedFinding\|INSERT INTO review_findings\|getByReviewId" electron/repositories/review-cycle-repository.ts
#    改动点：
#    - finding() 构造时带上 reviewClass（从 report item 读，缺省 null）
#    - INSERT 语句加列与占位符
#    - persistedFinding / getByReviewId 投影带回 reviewClass
```

### 4.3 验证（**两套 ABI 别混**）

```bash
ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe ./node_modules/vitest/vitest.mjs run electron/migrations/__tests__/m03-review-cycle.test.ts
```

**已知会红两处**：该测试文件里有两处 `INSERT INTO review_findings VALUES(20 个 ?)` 的硬编码。**必须改成 21 个占位符并补一列值（NULL）**，不许删用例。

```bash
ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe ./node_modules/vitest/vitest.mjs run electron/repositories/__tests__/review-cycle-repository.test.ts electron/migrations/__tests__/m03-review-cycle.test.ts
node ./node_modules/vitest/vitest.mjs run src/shared/__tests__/novel-contracts.test.ts
```

**迁移自检（必做）**：找一个存量项目库（`<project>/.ai-novel/project.db`），跑一次迁移后确认：

```bash
# 记录迁移前后 review_cycles 行数与 finding_set_hash 是否被重算
# 若旧库里没有 review_cycles 行，写「本项目无审稿历史，迁移重算未覆盖」并继续
```

### 4.4 提交

```
feat(review): findings 增加 mechanical/semantic 轴（M20，schema 20→21）

轴来自模型输出，落 review_findings.review_class；按作者裁定纳入
canonicalM03FindingSetHash（同性质字段进指纹）。无发行版，故迁移里直接重算存量
cycle 的 finding_set_hash，不为旧口径留兼容分支；存量 finding 的轴填 NULL，不猜。
```

---

## 5. T3 · A2 报告合同 + UI（30 min）

### 5.1 步骤

```bash
# 1. 报告合同（src/shared/review-generation-report.ts）
#    - ReviewResultItem 加可选 review?: 'mechanical' | 'semantic'
#    - REVIEW_TOP_LEVEL_KEYS / isReviewShape 允许该键（按 CURRENT_REVIEW_REPORT_VERSION 分档）
#    - 解析时缺省 undefined，不要填默认值
# 2. 版本号（electron/services/review-revision-generation.ts:35）
#    CURRENT_REVIEW_REPORT_VERSION 3 → 4
# 3. UI（src/components/editor/ReviewReport.tsx）
#    - ReviewIssue 加 reviewClass?: 'mechanical' | 'semantic' | null
#    - 每条 finding 渲染一个小徽标：机械可改 / 需读上下文
#    - 未标注（NULL）不渲染徽标，不要显示「未知」
```

### 5.2 验证

```bash
node ./node_modules/vitest/vitest.mjs run src/shared/__tests__/review-generation-report.test.ts src/components/editor/__tests__/review-report-i18n.test.tsx
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/editor/__tests__/ReviewReport.confirmation.browser.tsx
```

---

## 6. T4 · A5 生产路径预算断言（30 min）

### 6.1 现状（已核实）

- 预算机制**已有**：`src/services/generation/generation-harness.ts:61`（类型）、`:313 createPromptBudgetReport`、`:641` 超限抛 `PROMPT_BUDGET_EXHAUSTED`。
- **但生产默认走 mainOwned**：`src/services/workflows/workflow-main-generation.ts:157` 的 `complete` **没有**预算断言；`electron/` 侧对它零引用。
- `src/services/workflows/commands/base-command.ts:87-101` 已经把 `task.promptBudget` 装配进 task。

### 6.2 最小改法（不要动 electron 侧）

在 `workflow-main-generation.ts` 的 `complete` 里、**调用 IPC 之前**，若 `task.promptBudget` 存在，就用渲染层的 `createPromptBudgetReport(task)` 算一次总量，超 `limitUtf8Bytes` 直接抛 `PROMPT_BUDGET_EXHAUSTED`（复用现有错误码，不新增）。

```bash
# 先确认签名与返回结构，别照抄猜测
grep -n "createPromptBudgetReport" -A 12 src/services/generation/generation-harness.ts
grep -n "PROMPT_BUDGET_EXHAUSTED" -A 4 src/services/generation/prompt-budget-failure.ts
```

### 6.3 验证

```bash
node ./node_modules/vitest/vitest.mjs run src/services/generation/__tests__/generation-harness.test.ts src/services/generation/__tests__/prompt-budget-failure.test.ts
node ./node_modules/vitest/vitest.mjs run src/services/workflows/__tests__/workflow-main-generation.test.ts
```

新增至少 1 例：**mainOwned 路径下超限 ⇒ 抛 `PROMPT_BUDGET_EXHAUSTED`，且 IPC 未被调用**。

**注意**：`promptBudget` 目前只有 3 个调用点（`architecture.command.ts:1788/1859`、`structured-syntax-repair.ts:81`）。**本任务不改这些调用点**，只保证"配了就必须被强制执行"。

---

## 7. T5 · 收尾（15 min）

```bash
npx tsc --noEmit
node ./node_modules/vitest/vitest.mjs run src/services/workflows/commands/__tests__/generate-draft.command.test.ts
node scripts/check-doc-links.mjs
node scripts/check-doc-placement.mjs        # 新增必须为 0
```

文档同步（**只改这几处，不新建文件**）：

- `docs/research/2026-10-25-oh-story-absorption/assessment.md` §7：A2 由「下一期」改「✅ 已实施（M20）」；A5 由「待定」改「✅ 已实施（mainOwned 断言）」
- `docs/plans/prompt-assembly-backlog.md` 同名裁定表：同步这两行
- `docs/README.md` 若 §4 需要登记新设计稿——**本计划不新建设计稿，故不动**

---

## 8. 本计划明确不做（条件不完备，只登记）

| 项 | 为什么不做 |
|---|---|
| **P1-2 期 3**（大纲前缀投影） | 缺自己的设计稿（`p1-2` 设计稿 §8 是期 2，期 3 只有计划稿一行预告）；且 L3 口径未定——卷纲是**计划**、快照是**实际**，二者不能互相替代。先出设计稿再施工 |
| **大纲-正文进度守卫** | 新立项，三条待裁定（提示还是阻断 / 是否在 prompt 显式声明未知 / 要不要打通「快照→大纲」回流线）都未拍 |
| **A1 风格 lint** | 作者裁定降级为平台扩展参考材料 |

**执行者不要碰这三项。** 若有人要求顺手做，回答「不在本计划范围」并写进报告。

---

## 9. 外包给 Copilot 的规范

只在 T2 的**测试改造**上外包（机械活）。派活模板：

```bash
CP="C:/Users/<用户名>/AppData/Local/Microsoft/WinGet/Links/copilot.exe"
"$CP" -p "只改一个文件：electron/migrations/__tests__/m03-review-cycle.test.ts
任务：该文件里有两处 INSERT INTO review_findings VALUES(...) 硬编码了 20 个占位符，
review_findings 表刚加了第 21 列 review_class，请把两处改成 21 个占位符，
并在对应参数列表末尾补 null。不要改任何断言语义，不要新增用例，不要改其他文件。
逐处报告：行号、改前、改后。" \
  --agent DocRunner -s --allow-all-tools --deny-tool 'shell(git:*)' --trust-folder
```

**外包三条铁律**：
1. 一次只给**一个文件**、**一个窄任务**。
2. 回来必须自己 `git diff` 复核，**不许直接采信它说"已改好"**。
3. 它报「没找到」时，按 `copilot-channel.md` §4.5 处理——「本次读取的文件内未找到」**不等于**「不存在」，自己去看。

---

## 10. 停止条件（出现任一条立刻停）

- 任一验证命令连续失败 **2 次**（不是重试次数，是两次不同尝试）
- 需要改本计划未点名的文件才能继续
- 需要决定「两个设计选项选哪个」
- 迁移自检发现 `finding_set_hash` 重算后与旧值一致（说明没生效，需查）
- 时间用掉 3 小时后仍有任务未完

**停止时的报告格式**

```
## 执行到哪一步
T<N> 第 <M> 小步

## 已完成的提交
<sha> <message 首行>

## 阻塞
<具体问题 + 你看到的原始报错>

## 我做了什么尝试
<最多 2 条，不许写"又试了几次">

## 建议下一步
<一句话>
```

---

## 执行结果与偏离（2026-10-25，主 agent 亲执行）

| 任务 | 结果 | 提交 |
|---|---|---|
| T1 书架 | ✅ 每项有入口；**语义按授权分两档** | `8fb02cde` |
| T2 A2 迁移 + 仓库 | ✅ M20（20→21），存量指纹重算 | `9be5a686` |
| T3 A2 报告 + UI | ✅ 报告 v4 + 徽标 | 本组提交 |
| T4 A5 预算断言 | ✅ mainOwned 派发前字节硬顶 | 本组提交 |
| T5 收尾 | ✅ 文档 + 体检 + 回归 | 本组提交 |

**六处偏离（前四处是计划写错，后两处是计划漏项）**

1. **T1 的「每项都能删」不成立**：`project:delete` 在主进程要求会话闸门授权，`authorizeDeletion` 校验目标路径必须等于当前项目根 + 清单身份。非当前项目拿不到授权 ⇒ 真删目录要**新增一条绕过闸门的破坏性 IPC**，本轮不开。改为：当前项目真删；其余「从书架移除」（不动磁盘）。**✅ 作者 2026-10-25 已裁定结案：「移除记录就足够了，能不能删非当前项目目录不重要」——不要为此再开新通道。**
2. **T1 的「路径存在性」也不需要新通道**：`previewCapabilityId` 缺席即代表清单读不出来（目录不存在或不可读），据此标记即可。
3. **T2 不能在 M03 建表 SQL 里加列**：reference 库算出的 v20 指纹会带新列而真实 v20 库不带 ⇒ `probeSchema` 报 `UNRECOGNIZED_SCHEMA`，**旧项目打不开**。列只由 M20 加，M03 的 `exactSchema` 改成按「实际有没有这一列」选期望形状。
4. **T2 的两处位置式 INSERT 改成显式列名**（而非补第 21 个占位符）：`seedValid` 被十多个只跑到 M03 的用例共用，补值会把它们全打红。
5. **T3 漏了 M03 `proveArtifact` 的 `[2,3]` 版本白名单**：不改则每份 v4 新审稿都被自己的完整性校验判死（该文件注释里记着同类事故：15 例 `REVIEW_CYCLE_INPUT_INVALID`）。
6. **T3 漏了便携格式**：`portable-project-field-policy.json` 未知字段 fail-closed，schema 升版必须同补 `m20Tables` + `review_findings.review_class`，否则**导出 .vela-pack 直接 `PORTABLE_SCHEMA_UNSUPPORTED`**。

**迁移自检**（真实项目库副本，不动原库）：v20 库（3 cycle/16 finding）→ 仅 M20 → 3/3 指纹重算、轴全 NULL、`verifyM03ReviewCycle` 仍 true；另两个老库（v9/v10）走完整车道到 v21，均自洽。

**既有红（已在干净树复现）**：`draft-source-dependency` 4 例 · `ReviewReport.confirmation.browser.tsx` 2 例。
