# S2 · 设计稿/ADR 与源码现状核对（developer）

核对对象：`docs/adr/0027-architecture-shape-three-decisions.md`（51 行／7,169B，未 commit）。
核对基准：`exp/mainline-1119` 工作树 `C:\develop\workspace\AI-writer\develop`，`git rev-parse HEAD` 见文末。
设计稿 `docs/design/architecture/architecture-consistency-design.md` 三节结论**尚未落盘**（`git status` 无该文件），落盘后本条按其原文再对一遍。
口径：只报「源码事实 vs 文字」的冲突，不评方案。

## 一、实质冲突（会改变实现口径的）

### A. `deriveRosterStatus()` 在 src 侧不可达，不能直接当「校验对象」
- ADR `:11`／`:27`（D1）写「`characters_arch` 按投影校验，校验对象是 `deriveRosterStatus()`」。
- 源码：`electron/repositories/character-roster-repository.ts:817` `function deriveRosterStatus(` —— **electron 侧非 export 内部函数**，定义区间 `:817-846`。
- `src/` 侧 grep `deriveRosterStatus` 零命中；渲染层只拿到类型 `CharacterRosterStatus`（`src/shared/character-roster.ts:31`、`:105`）与 `loadCharacterRosterStatus` 的返回值（`src/components/editor/ArchFileViewer.tsx:261`、`src/components/editor/WorldBuildingEditor.tsx:154`）。
- 影响：设计稿若照抄「校验对象 `deriveRosterStatus()`」，实施方会在 `src/` 里找不到它。需在 §5 写清落点二选一：①经既有 IPC 取投影状态（不新增校验器）；②把三哈希判据下沉为 `src/shared` 纯函数再由 electron 侧复用（要改两条调用链）。
- 附：ADR `:11` 把该函数记为「`:836-846`」不准 —— `:836-846` 只是 `case 'ready'` 分支，函数头在 `:817`。

### B. 「匹配只做逐字包含」与现行实现（trim 后全等）不是一回事
- ADR `:29`（D2）：「匹配只做**逐字包含**」。
- 源码：`src/shared/space-time-consistency.ts:286` `const rule = byName.get(ref.space)`（全等查表），函数注释 `:271` 原文「空间名逐字命中（**trim 后全等**）⇒ 未命中判 warning」。
- 影响：若把「包含」实现成子串匹配，`藏书阁` 会命中 `藏书阁东厢` 这类登记，判定结果与今天不同、且会引入新的假阳性面。设计稿必须写明「逐字包含」＝trim 后全等，还是要放宽到子串——这是两种实现、两套测试。

### C. 「名单空即显式未判」现有范式只覆盖空间，人物名单没有对应字段
- ADR `:29` 引「`consistency-preflight.ts:277-296` 已有该范式」。
- 源码：该范式是 `ConsistencyPreflightCoverage`（`:260-265`）只有 `registeredSpaces: number | null` 与 `blueprintSpaceRefs: number` 两个字段，`describeSpaceTimeCoverage`（`:273-306`）按 `null`／`0`／`blueprintSpaceRefs===0` 三支出说明。
- 影响：【具名人物登记】名单为空时要「显式未判」，必须**新增**覆盖字段（如 `registeredNamedPersons`）与对应说明分支，不能复用 `registeredSpaces`。设计稿若写「复用既有范式」，实施方会以为零改动。

### D. 架构层 finding 无章号，`ConsistencyFinding` 形态装不下
- ADR `:51` 只说 `sourceLayer`（`src/shared/space-time-consistency.ts:105`，现两值 `'world-building' | 'blueprint'`）与面板二元映射（`src/components/dialogs/ConsistencyPreflightPanel.tsx:42-43`）要同批扩。
- 源码另有一处未提：`src/shared/consistency-preflight.ts:14-29` 的 `ConsistencyFinding` 里 `sourceChapter: number` 是**必填**（`:17`），面板 `:39` 直接渲染「来源：第${finding.sourceChapter}章」。
- 影响：架构层（L0/L3）finding 没有章号，若沿用该接口只能填 0 并在面板显示「第0章」。设计稿需交代第三种形态（无章号 finding）或明确「架构层暂不进报告」。

### E. D3 的 `UNKNOWN_NODE` 是「有能力、未接线」，不是现状已报
- ADR `:12`／`:31`／`:44` 表述与码值本身一致：`src/shared/arc-node.ts:251` 产生 `UNKNOWN_NODE`，message 原文含「可能拼写错误，**或弧光已重排**」；码表 `:89` 六码齐；测试 `src/shared/__tests__/arc-node.test.ts:158` 断言不静默放过。
- 但调用链只有一条：`validateArcCovers`（`arc-node.ts:238`）← `auditArcCovers`（`:449`）← `src/services/workflows/commands/architecture.command.ts:812`（架构生成时统计大纲漏覆盖），**不在章节预检链**（`src/shared/consistency-preflight.ts:146-172` 的入参是章节蓝图，不调弧函数）。
- 影响：设计稿写「重排报 `UNKNOWN_NODE`」时须注明是 S3 待接线的能力；若写成现状保障，验收会去改码验证一个不存在的行为。

## 二、引用行号偏差（不改结论，但会误导实施）

| ADR 位置 | 写的 | 实测 |
|---|---|---|
| `:11` | `deriveRosterStatus()`（`:836-846`） | 函数头 `:817`，`:836-846` 是 `case 'ready'` 分支 |
| `:11` | `refreshCharacterIdentityProjection` … `:862-869` | 注释 `:863`、函数 `:864-870`（`UPDATE project_core SET characters_arch=?` 在 `:868`） |
| `:31`（D3） | 节点文本指纹（`arc-node.ts:58-64`） | 「已知限制（P12-4 才解决）」`:57`，「ID 依赖位置」`:59-61`，「一期不做——」`:61` |
| `:44` | `consistency-preflight.ts:82`「Findings are evidence, never a writing prohibition」 | 该句在 `:100`（`:82` 是 `stableFactKey` 函数体） |

已复核**准确**的引用：四散文列 `electron/migrations/baseline-schema.ts:43-46`（premise／worldbuilding／characters_arch／synopsis）；`blueprints.chapter_number` PK `:58`；`characters.name` PK `:76`；`ConsistencySourceLayer` 两值 `src/shared/space-time-consistency.ts:105`；面板二元映射 `src/components/dialogs/ConsistencyPreflightPanel.tsx:42-43`；模板「唯一键」句 `src/services/builtin-prompt-templates.ts:688`；`parseSpaceRules` 不收【具名人物登记】行 `space-time-consistency.ts:159`（「无 `=`…不会被误收」）。

## 二之二、设计稿三节已落盘后的追加核对（`git diff` 逐段核）

### F. S1 段的「派生投影」漏了关系表
- 设计稿 §5·S1 新增句：「`characters_arch` 是 `characters` 表的派生投影」。
- 源码：投影源是 `identityProjectionEntries()`（`electron/repositories/character-roster-repository.ts:848-857`）——它 **JOIN `characters` 与 `character_relationships`**，再由 `renderCharacterRosterMarkdown` 渲染、`:868` 写回。只写「`characters` 表」会漏掉关系列（`relation` 也进投影）。
- 建议：改成「`characters` ＋ `character_relationships` 的派生投影」，一句的成本。

### G. S3 段「第五层落地已由 `arc-node` 结构位派生满足」说满了
- 设计稿 §5·S3 新增句：「第五层落地已由 `arc-node` 结构位派生满足，S3 的阻塞理由销掉」。
- 源码：`arc-node.ts` 确有派生（`listArcNodes`／`buildArcTree`），但 ①`validateArcCovers` 未接进预检（见 E）；②ID 仍依赖位置、无文本指纹，`arc-node.ts:59-61` 原文「检测办法是给每个节点附文本指纹……一期不做」。
- 建议：改为「结构位派生已具备，接线与指纹属 AC3 实施」——与 ADR `:31` 口径一致，避免验收去等一个本不该在本期存在的稳定 ID。

### H. 把 `## 6.` 改成 `## ★` 会让 `docs/plans/00-OVERVIEW.md:51` 的引用失真
- 设计稿改动：`## 6. ★ 实机样本…` → `## ★ 实机样本…`（因与 `:239 ## 6. ❌ 明确不建议做的` 重号）。
- 外部引用：`docs/plans/00-OVERVIEW.md:51` 原文「**§6 已补实机核对**（前 30 章 vs 弧光：Σ大弧 880≠845…）」——这里说的「§6」正是实机样本那节。改后 §6 = `:239` 的「不建议做的」，引用会读成「不建议节已补实机核对」，语义失真。
- 修复二选一：①同笔改 `00-OVERVIEW.md:51` 的「§6」为「实机样本节」；②在 §6 编号说明里点名该处并保留旧指代。`ac5-numeric-resource-consistency-design.md:292` 的「§6.3」不受影响（子节仍为 6.1–6.5）。

## 五、复核 `22894f78`（八条补丁逐条对源码）

已核**正确落盘**的七条：
- A：ADR D1 两边界（`character-roster-repository.ts:817` 未导出／IPC 或下沉二选一）✓ 行号准。
- C：`consistency-preflight.ts:260-265` 字段、`:273-306` 文案分支 ✓。
- D：Consequences 第三点三处齐（`sourceLayer` `:105`、面板 `:42-43`、`sourceChapter` `:17`＋面板 `:39`）✓。
- E：D3 链写全 `arc-node.ts:251` ← `:238` ← `:449` ← `architecture.command.ts:812`，并注明不进 `:146-172` ✓。
- F：投影源 JOIN `character_relationships`，引 `:848-857` ✓。
- G：S3 结论去掉「已满足」，引 `arc-node.ts:59-61` ✓。
- H：`docs/plans/00-OVERVIEW.md:51` 已改为「「★ 实机样本」节已补实机核对」✓，`ac5` 的 `§6.3` 仍可解析 ✓。
- 行号三条（`:817`／`:863-870`／`:100`）✓。

仍有三处要改：

1. **`byName.get(ref.space)` 是 `:286`，不是 `:285`**（`:285` 是 `return refs.flatMap((ref): SpaceTimeFinding[] => {`）。ADR D2 第 38 行、设计稿 §5·S2「实施要定」第 220 行都写 `:285`，两处同错——我自己今天先写成 `:288`，实测应为 `:286`。
2. **「显式未判」范式区间写窄了**：ADR D2 引 `consistency-preflight.ts:277-296`，实际三支到 `:301`（`:277-282` 读取失败、`:283-293` 无机读行、`:294-301` 蓝图无结构化引用）。建议改 `:277-301`。
3. **「改它会动 D1–D21 已验收的既有行为」这句无法核对**：全仓 ADR 与设计稿里没有 `D1–D21` 的编号定义（`grep "D1–D21\|D21"` 仅命中这一句）。要保留就换成可核的锚点，例如 `src/shared/__tests__/space-time-consistency.test.ts:153`「引用了未登记的空间名 ⇒ warning，冲突源指向世界观层」（该文件 56 个 `it()` 锁定全等语义）；不换就删掉这半句，别留一个查不到的编号。

## 三、一句话结论

ADR 四句裁定的**方向**与源码不冲突；卡的是三处落点没写死（A 校验对象在哪层调、B 包含是全等还是子串、C 人物名单的未判字段），以及 D 的 finding 形态缺口。这四处建议在设计稿 §5 各补一句，否则 S1/S2 实施会各自猜一套。

## 四、证据

- 核对基准：`git -C C:\develop\workspace\AI-writer\develop rev-parse HEAD` → 见群消息原文（本轮 `git status --porcelain` 仅 6 行 `??`，无 `M`）。
- 本文 sha256 与行数见群消息末行 `wc -lc`／`sha256sum` 原文。
