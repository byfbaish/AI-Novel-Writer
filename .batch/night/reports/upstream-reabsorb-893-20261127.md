# 上游扩面评估 `fc576e08..549522d4`（893 笔）· 吸收定性

From: up-893 · developer（AI writer项目组）
To: 大肥鱼@主身
卡号：up-893
会话标识：AI writer项目组 · developer 群分身（Architecture/IT Advisor）
起点 sha：`dfe8dc78d`（工作区 `C:\develop\workspace\AI-writer\develop`，分支 `exp/mainline-1119`）

只读评估。未写生产码、未 commit、未 push、未改工作区文件（本件除外，落在 `.batch/night/reports/`，属派单指定产物目录）。

---

## §0 范围与口径

### 0.1 区间

| 项 | 值 | 证据 |
|---|---|---|
| 起点 | `fc576e08`（2026-08-16 `v0.8.4`，我方与上游真实共同祖先） | `git merge-base HEAD upstream/master` |
| 终点 | `549522d4`（2026-10-14 03:43 上游发布点 #381，非我方祖先） | `git log -1 --format='%h %ad %s' 549522d4` |
| 区间总笔数 | **893** | `git rev-list --count fc576e08..549522d4` = 893 |
| 其中 merge | **42** | `git rev-list --count --merges fc576e08..549522d4` = 42 |
| 其中非 merge | **851** | `git rev-list --count --no-merges fc576e08..549522d4` = 851（851＋42＝893） |
| 上游 HEAD 距起点的累计 | **5,248** | `git rev-list --count fc576e08..upstream/master` = 5,248（4,355＋893＝5,248，与前一轮 4,355 笔口径衔接） |
| 我方同期累计 | **1,862** | `git rev-list --count fc576e08..HEAD` = 1,862 |

### 0.2 四条口径（沿用派单）

- **P0**：merge 提交不单独定性，按所属 PR 归簇计数；正文只对非 merge 逐笔定性。
- **P1**：逐笔必须读 diff 内容，禁按标题定性、禁按行号定位。
- **P2**：四类定性 + 代价 S/M/L + 前置簇。
- **P3**：语料 / 密钥 / PII 一律 C；查不到的写「查不到（命令＋输出原文）」。

### 0.3 本轮新增的实测分层（决定后面所有结论）

**分层一：笔数分层。** 893 = 851 非 merge ＋ 42 merge。

**分层二：`git cherry` 补丁等价分层（核心读数）。**

```
$ git cherry -v HEAD 549522d4 fc576e08 | wc -l
851
$ git cherry -v HEAD 549522d4 fc576e08 | grep -c '^-'
716          # 前缀 '-'：补丁等价已在 HEAD
$ git cherry -v HEAD 549522d4 fc576e08 | grep -c '^+'
135          # 前缀 '+'：HEAD 中找不到等价补丁
```

即：**851 笔非 merge 中 716 笔（84.1%）的改动已经在树内，只有 135 笔无等价补丁。**

**分层三：文件终态佐证。**

```
$ git diff --name-only HEAD 549522d4 | wc -l
2772          # HEAD 与 549522d4 有差的全部文件
# 区间内被上游改过的文件（1,624 个）中，HEAD 与 549522d4 完全同字节者：
961 / 1624
```

抽 7 个区间内改动量最大的文件逐一核对，全部与 `549522d4` **零 diff**：`electron/vector-store.ts`、`electron/knowledge-base.ts`、`electron/services/webdav-backup-service.ts`、`docs/research/novel-quality-modernization/quality-protocol.md`(599 行)、`scripts/quality-modernization-run.mjs`(1598 行)、`electron/repositories/import-run-repository.ts`(2685 行)、`src/shared/import-run.ts`(352 行)。

**分层四：135 笔里真正「我方没有」的比 135 更少。** 三条实测：

1. 主路径存在性：135 笔的 primary path 里，**30 个在我方工作区存在、105 个不存在**（不存在的集中于 `docs/design/2026-10-11-frontend-redesign/**` 与 `src/components/stage/**`）。
2. 功能抽查（3 例，全部「标记为 + 但功能已在我方」）：
   - `a19dc7c12` 的二分拆批：我方 `src/services/workflows/structured-batch-executor.ts:395-398` 已有 `midpoint` + `receipt.splitCount += 1`；
   - `a19dc7c12` 的草稿账本顺序：我方 `src/stores/character-store.ts:400` 已在会话校验之后才 `persistCharacterDraftLedger(restored.ledger)`；
   - `b57819759` 的建库事务：我方 `electron/database.ts:31` 已 `database.transaction(() => initializeLegacyBaselineSchema(...))()`；
   - `b95489541` 的中断恢复：我方 `electron/services/main-generation-owner.ts:919` 已有 `blueprintRecovery`、`electron/services/project-access.ts:213` 已有 `adoptLegacyProject`。
3. 因此 §1 的「无等价补丁（上界）」列是「前缀 `+`」的集合，不是「真缺口清单」；四类定性在第 1–3 条读数基础上给出，并把「已功能性等价」写进理由列。

### 0.4 簇划分方法

按每笔的 **primary path**（该笔 numstat 变更行数最大的文件）归簇，两条 fallback：文件不在任何已知目录族 → `X1-root`；merge → 归所属 PR 首父。归簇脚本 `C:\develop\workspace\AI-writer\tmp-dev\up893\cluster2.mjs`（正则表见其前 22 行），产物 `clustered2.json`。归簇后 22 簇，笔数合计 **851**，`final.mjs` 输出 `TOTAL 851 applied 716 pending 135`。

---

## §1 逐簇表

列说明：**我方** = 我方同期（`fc576e08..HEAD`）触及该簇目录的笔数（目录级 pathspec 计数，簇间重叠，**不可加**，仅表我方在该族的投入量）；**上游** = 归簇笔数（合计 851）；**已等价** = `git cherry` 前缀 `-`；**无等价补丁（上界）** = 前缀 `+`；**代价** S ≤ 50 行 / M ≤ 400 行 / L > 400 行或跨层。

| 簇 | 路径 | 我方 | 上游 | 已等价 | 无等价补丁（上界） | 定性 | 吸收什么（函数级） | 适配点 | 代价 | 前置簇 |
|---|---|---|---|---|---|---|---|---|---|---|
| U1-renderer-ui | `src/components/` `src/styles/` `src/stores/` | 317 | 131 | 71 | 60 | **A2（并入 C4）** | RD-1 纸墨令牌变量层（`src/styles/tokens.css` 的 `--ink*`/`--paper*`）；RD-2 新外壳 `src/components/stage/*`（41 文件，HEAD 不存在）；RD-3 外壳 stage 状态机（`src/stores/layout-store.ts` 的 stage/gutter 状态） | `src/components` 一次性更换已被主人裁为 C4（回滚 tag `pre-ui-rd-swap-20261126` → `2880a05be`），本簇属 C4 范围，不另立工单；`src/stores` 的 stage 状态须与 C4 同笔落地，不可先落 | L（C4 承担） | C4 起卡 |
| E1-e2e-journeys | `scripts/redesign/` `scripts/f0[0-9]-*` | 105 | 123 | 94 | 29 | **B** | RD-4 像素对比驱动 `scripts/redesign/*.mjs`（+2,439 行，HEAD 该目录 0 文件）、假模型注入、逐页截图 + 阈值 diff | 借方法论不借实现：其选择器、场景、视口都写死在旧外壳 DOM 上，换到 C4 后必须整体重写；我方现有 `scripts/` 下 e2e 与截图基线口径不同（我方 `scripts/` 406 笔） | — | C4 落地后重估 |
| W1-workflow-commands | `src/services/workflows/commands/` | 315 | 92 | 91 | 1 | **A2** | `b57819759` 的 `GenerateDraftCommand` 短细纲重试重构（可重试短细纲、recovery 读取顺序调整） | 我方 `src/services/workflows/commands/generate-draft.command.ts:1371` 已有 `retryOutline` 分支，:1372 已有 `outlinedOnly`，功能等价；剩余为 recovery 读取顺序与错误码细节，需先逐 hunk diff 再决定是否改 | S | — |
| M1-main-services | `electron/services/` | 231 | 89 | 87 | 2 | **A2** | `b95489541`（#346）恢复被中断的 `chapter-blueprint-directory` 生成：`GenerationRunRepository.blueprintRecovery` / `readDirectoryProgressProof` / `assertBlueprintRecoveryWritable`，`project-controller` 的 `adoptLegacyProject` | 我方 `electron/services/main-generation-owner.ts:919` 已有 `blueprintRecovery` 投影、`electron/services/project-access.ts:213` 已有 `adoptLegacyProject`；差在 `electron/repositories/generation-run-repository.ts` 的连续性校验（`blueprint_commit_operations` 的 `payload_hash/start_chapter/end_chapter` 对照）。我方该仓 63 文件 +419/−9,645，需逐 hunk 复核 | M | — |
| Q2-quality-scripts | `scripts/quality-modernization-*` `scripts/__tests__/quality-*` `scripts/fixtures/quality-*` | 144 | 89 | 89 | 0 | **A1** | 整簇已等价，无需动作 | — | — | — |
| Q1-quality-docs | `docs/research/novel-quality-modernization/` | 133 | 60 | 60 | 0 | **A1** | 整簇已等价；该目录与 `549522d4` 仅 1 文件差 3+/1- | — | — | — |
| M2-data-layer | `electron/repositories/` `electron/controllers/` `electron/migrations/` `electron/database.ts` | 226 | 55 | 55 | 0 | **A1** | 整簇已等价（含 `b57819759` 的建库事务，我方 :31 已在） | — | — | — |
| S1-scripts-tests | `scripts/__tests__/` | 212 | 33 | 31 | 2 | **A2** | `4494c24c8` 安装器夹具清理宽限 1 行（`scripts/__tests__/smoke-win-installer.test.ts`）；颜色字面量测试 | 纯测试口径；我方测试脚本族 406 笔且命名与上游不同，需要对齐的是「宽限时长」这一参数与颜色测试的断言集 | S | — |
| D2-docs | `docs/design/` `docs/plans/` `docs/adr/` | 781 | 28 | 12 | 16 | **C** | 上游 RD 线设计稿与评审件：`docs/design/2026-10-11-frontend-redesign/{plan.md,design-system.md,feature-matrix.md,prototype/ui.css,claude-design/Main.dc.html,directions/index.html,review/RD-3-review.mp4,review/RD-4-review.mp4}` 等 | 冲突点：这批稿子描述的是上游旧外壳到 stage 外壳的演进，与 C4「一次性更换」并行入库会同时存在两套设计叙事，且含 2 个视频二进制（`.mp4`，不可 diff、不可评审）。我方替代物：`docs/design/` 我方自有 383 笔（`git rev-list --count fc576e08..HEAD -- docs/design` = 383），设计取舍已在我方 ADR 与设计稿内闭环 | — | — |
| W2-workflow-core | `src/services/workflows/`（非 commands） | 362 | 25 | 21 | 4 | **A2** | `a19dc7c12` 的二分拆批与账本顺序（两处均已在我方，见 §0.3 分层四）；剩余 3 笔为 run 标题/文案随新外壳调整 | 拆批与账本逻辑无需改；文案 3 笔依赖 C4 的外壳文案表 | S | 文案 3 笔前置 C4 |
| S2-scripts-tools | `scripts/`（其他） | 406 | 19 | 16 | 3 | **A2** | ① `21d672116`：`electron/services/app-data-locator.ts:13` 增 `if (path.relative(userData, canonicalTarget) === '') canonicalTarget = path.join(resolvedAppData, 'ai-novel-writer-data')`——**真缺口，我方同文件无此保护**；② `83bc2e4bc`：新增 `scripts/check-color-literals.mjs` 识别大写 `RGB()/HSL()` 并接入 `pnpm lint`——我方 `scripts/` 无此文件；③ `ba84df630` 语言切换夹具给 TitleBar 传关窗守卫 | ① 一行即可，风险极低，建议先做；② 我方无纸墨令牌体系，脚本装了也扫不出东西，只有采纳 RD-1 令牌才有意义；③ 夹具随 C4 | S | ② 前置「是否采纳 RD-1 令牌」裁定 |
| X1-root | 根配置 `README.md` `.gitignore` `package.json` 等 | 63 | 19 | 15 | 4 | **C** | README 改版、`v1.2.0-Preview` 发布说明、`.gitignore` 增截图目录 | 冲突点：上游 1.2.x 的版本叙事与我方版本线（我方同期 1,862 笔）不是同一条线，照搬会把上游发布说明写进我方 CHANGELOG；我方替代物：`.release/notes/` 我方自有条目（R1 簇 7 笔已等价） | — | — |
| W3-services-other | `src/services/`（其他） | 479 | 19 | 19 | 0 | **A1** | 整簇已等价 | — | — | — |
| U2-shared-contracts | `src/shared/` | 353 | 16 | 14 | 2 | **A2** | `a2d63e842`/`4bbedc213`：`src/shared/appearance-profile.ts` 升 `schemaVersion: 2` + `stage` 字段 + 惰性升级路径 | 我方该文件仍是 `schemaVersion: 1`（:13 类型、:23 默认值、:44 校验、:53 允许键表）。只有换壳后 `stage` 才有语义，故必须与 C4 同笔或紧随其后；单独升级只会留下无消费者的字段 | S/M | C4 |
| C1-ci | `.github/` | 34 | 14 | 13 | 1 | **B** | CI 四机并行拆分（job 矩阵与缓存键策略） | 借策略不借文件：我方 runner 拓扑、缓存键、并发额度与上游不同，直接抄会改我方 CI 拓扑 | — | — |
| M3-electron-other | `electron/llm/` `electron/vector-store.ts` `electron/knowledge-base.ts` 等 | 359 | 14 | 14 | 0 | **A1** | 整簇已等价（两文件与 `549522d4` 零 diff） | — | — | — |
| R1-release | `.release/` | 23 | 7 | 7 | 0 | **A1** | 整簇已等价 | — | — | — |
| A1-claude-skills | `.claude/` | 0 | 6 | 0 | 6 | **A2** | `.claude/skills/verify/`（截图—评测—归档的固定流程技能，6 笔增量） | 我方 `.claude` 区间 0 笔（`git rev-list --count fc576e08..HEAD -- .claude` = 0）。骨架可直接落（技能目录 + 步骤清单），但其中的选择器/截图入口属旧外壳，需按 C4 改写 | S | 无（骨架）/ C4（选择器） |
| P1-plugins | `plugins/dsh-ai-novel-writer/` | 7 | 5 | 5 | 0 | **A1** | 整簇已等价 | — | — | — |
| U3-src-other | `src/App.tsx` `src/**/*.stories.tsx` `src/__tests__/` | 689 | 4 | 1 | 3 | **A2（并入 C4）** | 新外壳下的 App 挂载与 stories、静态导入测试 | 与 U1 同一批改动，随 C4 一次性更换落地，不单独派工 | S | C4 |
| T1-test-assets | `public/fonts/` `test/setup` | 14 | 2 | 0 | 2 | **A2** | `public/fonts` 新字体 + 样式入口 | 字体取舍属视觉决定，随 C4 取材；我方 `public/` 区间仅 14 笔 | S | C4 |
| D1-docs-research | `docs/research/`（非 quality-modernization） | 156 | 1 | 1 | 0 | **A1** | 已等价 | — | — | — |
| （merge 归集） | — | — | 42 | — | — | — | P0 口径去 merge：42 笔 merge 不单独定性，**也不计入上方各簇**（上方簇合计恰等于 `--no-merges` 851）；merge 带来的实质改动按其合并进来的非 merge 提交定性 | — | — | — |

**合计核对**：上游列 851 ＋ merge 42 ＝ **893** ✓；已等价 716 ✓；无等价补丁（上界）135 ✓。

---

## §2 非代码提交单列

| 类别 | 笔数 | 路径 | 定性 | 说明 |
|---|---|---|---|---|
| 设计稿与评审件 | 16 | `docs/design/2026-10-11-frontend-redesign/**` | **C** | 含 2 个 `.mp4` 评审视频（`review/RD-3-review.mp4`、`review/RD-4-review.mp4`），二进制不可 diff；我方 `docs/design` 自有 383 笔闭环 |
| 流程技能 | 6 | `.claude/skills/verify/**` | **A2** | 方法论可落骨架，选择器随 C4 |
| 根级文档/发布说明 | 4 | `README.md`、`.gitignore`、`1.2.0-Preview` 发布说明 | **C** | 版本叙事属我方版本线 |
| 质量研究文档 | 60 | `docs/research/novel-quality-modernization/**` | **A1** | 已等价（终态仅 1 文件 3+/1-） |
| 其他研究文档 | 1 | `docs/research/**` | **A1** | 已等价 |
| 测试夹具 | 4 | `scripts/__tests__/`、`scripts/browser-fixtures/`、`electron/services/__tests__/legacy-v092-lazy-schema.sql`(525 行) | **A2** | 测试口径，随对应代码判定 |

**语料 / 密钥 / PII 核查**（P3）：

```
$ git log --name-only --format='' fc576e08..549522d4 | sort -u | grep -Ei '(^|/)\.runtime/|corpus|\.env|\.key$|secret'
electron/services/import-source-identity-secret.ts        # 1 行命中
```

唯一命中是**代码模块文件名**（上游「导入源身份」的密钥编解码模块，非密钥本身、非语料）。区间内 **0 笔**真正触及 `.runtime/`、语料、`.env`、密钥文件、PII —— 故四类判定中**没有因 P3 落入 C 的提交**。

---

## §3 汇总

| 类 | 簇数 | 上游笔数 | 无等价补丁（上界） | 说明 |
|---|---|---|---|---|
| **A1** 已在树内、无需动作 | 8 | 250 | 0 | Q1 60、Q2 89、M2 55、W3 19、M3 14、R1 7、P1 5、D1 1（整簇零缺口） |
| **A2** 需按我方接口改写 | 10 | 417 | 85 | U1 131/60、W1 92/1、M1 89/2、S1 33/2、W2 25/4、S2 19/3、U2 16/2、A1-claude 6/6、U3 4/3、T1 2/2（格式：上游/无等价补丁） |
| **B** 可借鉴不可直取 | 2 | 137 | 30 | E1 123/29、C1 14/1 |
| **C** 不要 | 2 | 47 | 20 | D2 28/16、X1 19/4 |
| 合计（非 merge） | 22 | **851** | **135** | 两列各自相加：250＋417＋137＋47＝851；0＋85＋30＋20＝135；再 ＋merge 42 ＝ **893** |

补充两句与笔数表配套的读数：

- 851 笔里 **716 笔已等价**。其中 250 笔落在上表 8 个 A1 簇（整簇零缺口），其余 **466 笔**散落在 A2/B/C 各簇内（那些簇里大部分提交也已等价，只有簇级残差进了「无等价补丁（上界）」列）。
- 135 笔无等价补丁中 **105 笔（60 U1 ＋ 29 E1 ＋ 16 D2）全是上游 RD 重设计线**（RD-0/RD-1/RD-2/RD-3/RD-4）；其中属 `src/components` 的部分已由主人裁「C4 一次性更换」覆盖。真正需要本组另行决策的只有 **30 笔**。

---

## §4 A2 值得做清单（按我方改动量从小到大、按依赖排序）

| 序 | 事项 | 位置 | 改动量 | 依赖 | 值当程度 |
|---|---|---|---|---|---|
| 1 | **数据根同名保护**（`21d672116`）：`path.relative(userData, canonicalTarget) === ''` 时改落到 `ai-novel-writer-data` | `electron/services/app-data-locator.ts:13` | 1 行 | 无 | 高：真缺口，1 行即消除「装到 userData 同名目录」时的数据根冲突，独立可做 |
| 2 | **verify 技能骨架**（6 笔） | `.claude/skills/verify/` | 目录 + 步骤清单 | 无（选择器留待 C4） | 中：方法论收益，与我方上一轮 D5a 判法一致 |
| 3 | **短细纲 recovery 顺序复核**（`b57819759`） | `src/services/workflows/commands/generate-draft.command.ts:1371` 附近 | 数行 | 无 | 中：我方已有 `retryOutline`，只需核对错误码与读取顺序，属收尾级 |
| 4 | **外观档 schemaVersion 2 + 惰性升级**（`a2d63e842`/`4bbedc213`） | `src/shared/appearance-profile.ts:13/23/44/53` | ~40 行 + 测试 | **C4** | 中：无 `stage` 外壳则无消费者，必须随 C4 |
| 5 | **中断生成恢复的连续性校验**（`b95489541`） | `electron/repositories/generation-run-repository.ts` | 单函数级，~100 行 | 无 | 中高：我方 `blueprintRecovery` 投影已在，缺的是恢复可写性校验；因该仓我方已重写 63 文件，需逐 hunk |
| 6 | **颜色字面量闸门** `check-color-literals.mjs`（`83bc2e4bc`） | `scripts/` | 新脚本 ~60 行 + lint 接线 | 「是否采纳 RD-1 纸墨令牌」裁定 | 低：无令牌体系时脚本扫不出东西 |
| 7 | 新外壳配套：`App` 挂载/stories/字体/stage 状态（U1+U3+T1+W2 文案） | 多处 | — | **C4** | 归 C4 |

> 说明：`a19dc7c12`（二分拆批 + 草稿账本顺序）与 `b57819759` 的建库事务**已在树内**，不进清单，只在 §0.3 留证。

---

## §5 自查（复核命令与读数原文）

### 5.1 笔数

```
$ git rev-list --count fc576e08..549522d4
893
$ git rev-list --count --merges fc576e08..549522d4
42
$ git rev-list --count --no-merges fc576e08..549522d4
851
$ git rev-list --count fc576e08..upstream/master
5248
$ git rev-list --count fc576e08..HEAD
1862
$ git cherry -v HEAD 549522d4 fc576e08 | grep -c '^-'   →  716
$ git cherry -v HEAD 549522d4 fc576e08 | grep -c '^+'   →  135
```

自洽：851＋42＝893；716＋135＝851；4,355（前一轮）＋893＝5,248。

### 5.2 簇级笔数（我方 / 上游，目录级 pathspec）

脚本 `C:\develop\workspace\AI-writer\tmp-dev\up893\counts.sh`，输出落 `cluster-counts.tsv`：

```
簇	上游	我方
Q1-quality-docs	134	133
Q2-quality-scripts	142	144
E1-e2e-journeys	147	105
S1-scripts-tests	213	212
S2-scripts-tools	362	406
W1-workflow-commands	180	315
W2-workflow-core	207	362
W3-services-other	229	479
U1-renderer-ui	229	317
U2-shared-contracts	139	353
U3-src-other	396	689
M1-main-services	148	231
M2-data-layer	142	226
M3-electron-other	241	359
D1-docs-research	137	156
D2-docs	173	781
R1-release	28	23
C1-ci	32	34
A1-claude-skills	24	0
P1-plugins	7	7
T1-test-assets	12	14
X1-root	44	63
```

**口径提示**：目录级计数一笔会同时落进多个父目录（如一笔改 `src/services/workflows/commands/x.ts` 同时计入 W1/W2/W3/U3），故该表仅作「我方在各族投入量」旁证，不可加、也**不用于** §1 的上游笔数列——§1 上游笔数用 primary-path 归簇（合计 851）。

### 5.3 归簇自洽

```
$ node final.mjs        # tmp-dev/up893/final.mjs
... 22 行 ...
TOTAL 851 applied 716 pending 135
```

### 5.4 关键单点事实

```
$ git diff --name-only HEAD 549522d4 | wc -l
2772
$ git show 21d672116 --format='' -- electron/services/app-data-locator.ts | head
+    if (path.relative(userData, canonicalTarget) === '') canonicalTarget = path.join(resolvedAppData, 'ai-novel-writer-data')
$ grep -n 'initializeLegacyBaselineSchema' electron/database.ts
31:    database.transaction(() => initializeLegacyBaselineSchema(database, importSourceSecret))()
$ grep -n 'midpoint' src/services/workflows/structured-batch-executor.ts
395:          const midpoint = Math.floor(items.length / 2)
$ grep -n 'schemaVersion' src/shared/appearance-profile.ts | head -4
13:  schemaVersion: 1
23:  schemaVersion: 1, revision: 1, ...
44:  if (!record(value) || value.schemaVersion !== 1 ...
$ ls scripts | grep -i color
（无输出：scripts/check-color-literals.mjs 不存在）
$ git rev-list --count fc576e08..HEAD -- .claude
0
$ git rev-list --count fc576e08..HEAD -- docs/design
383
```

### 5.5 禁语自查

派单 §3 第③条所列四个禁语（本件不复写其字面，以免自指污染计数），在全文分别 `grep -c`，结果全部为 **0**。复算方式：从派单件 `b81a7fa6a`（`.batch/night/staging/upstream-reabsorb-893-20261127.md`）§3 第③条取四条字面量，逐条对本件执行 `grep -c`。

```
$ for w in <派单四条禁语>; do grep -c "$w" .batch/night/reports/upstream-reabsorb-893-20261127.md; done
0
0
0
0
```

（判定理由一律用「与我方既有裁定/实现的关系」表述，不用「方向」类托词——本件每条 C 都写了我方替代物，每条 A2 都写了落点与前置。）

### 5.6 文件自核

行数 / 字节 / sha256 / 末字节 见群内一行回报；本件落盘后自行复核并写进回报行，不复述于此以免自指。

---

## §6 偏差与未决

1. **135 ≠ 真缺口，是「无等价补丁（上界）」。** `git cherry` 以 patch-id 比对，我方吸收过的改动若被重写（上下文、相邻代码变化），会被判成 `+`。§0.3 分层四给了三条反证（`a19dc7c12` 两处、`b57819759` 建库、`b95489541` 恢复）+ 主路径存在性 30/135。**因此本件不把 135 当工单池，只把 §4 七条当候选。**
2. **merge 42 笔未逐笔读内容**（P0 口径）。若后续需要，可按 `git log --merges -m --name-only` 补一次归集。
3. **目录级笔数不可加**（§5.2 口径提示），已在上游笔数列改用 primary 归簇。
4. **`git cherry` 对 merge 内部的提交不可见**：若某个 PR 的实质提交只存在于 merge 的第二父链，`--no-merges` 会漏计；本区间 42 个 merge 均为 PR 合入（首父推进、次父为 PR 分支），故漏计风险限于「PR 内单笔没有独立 cherry 行」的情况，已由 5,248 口径与 `--merges` 计数交叉核对，缺口为 0。
5. **未决（需裁定）**：
   - C4 起卡时点与 U1/U3/T1/W2-文案/U2 的合笔范围——建议一次性并入 C4，不拆工单；
   - `check-color-literals` 是否随 RD-1 纸墨令牌一并采纳（不采纳则第 6 条不派）；
   - `b95489541` 的恢复校验是否值得在我方重写后的仓库上重做（我方 `electron/repositories/generation-run-repository.ts` 已 +419/−9,645，收益需按现网是否出现「中断目录蓝图生成」案例定）。
6. **查不到项**：上游 `docs/design/.../review/` 的 2 个 `.mp4` 无文字记录，无法评审其内容，仅按「二进制 + 属上游旧外壳叙事」落 C（命令见 §2）。
