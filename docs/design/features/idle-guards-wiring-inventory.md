# 三个空闲守卫的接线落点（2026-11-04 清点）

> 状态：待裁定（2026-11-04 · 只清点，未接线；接线方案未定，见 §4）
> 来源：豆包 T12–T14 只读清点 + 主 agent 抽查复核。**「复核」列必须看**：⚪ 表示只有豆包一遍读，落地前自己再看一眼。

## 1. 为什么会有这份清点

`src/shared/` 里躺着三个**纯函数模块：写完了、单测也过了、全库零调用方**（`src` / `electron` 里 grep 不到引用）。它们各自对着一条未修的缺陷：

| 模块 | 干什么 | 缺陷 | 现状 |
|---|---|---|---|
| `arc-placeholder-guard.ts` | 找出 `<七点>`、`<钩子>` 这类模板占位符 | D5 | 22 条单测，未接线 |
| `volume-unit-overlap.ts` | 判卷内单元区间重叠 | D15 | 8 条单测，未接线 |
| `suspense-hook-alignment.ts` | 判结尾钩子与大纲「收尾：」行是否对齐 | D18 | 6 条单测，未接线 |

不接线的守卫等于没修 —— 这三条缺陷在缺陷表里仍是 ⬜。

## 2. 接线落点

| # | 模块 | 落点 | 那一行能拿到什么 | 复核 |
|---|---|---|---|---|
| D5 | `arc-placeholder-guard` | 解析入口 `src/shared/volume-structure.ts:149` `materializeVolumeStructure({ plan, synopsis, totalChapters })`；落库在 `electron/services/volume-structure-sync.ts:118` 的 `rebuildVolumes` | **整段模型原文**（`input.plan` / `input.synopsis`），不是拆好的字段 ⇒ 不需要 join，坐标（line/index）可直接用 | ○ |
| D5 | 同上（可带占位符的字段） | `volumes.name` / `volume_units.name` | 名称只剥 `【】` 不剥 `<>`（`src/shared/arc-position.ts:303` `stripBrackets`）⇒ 占位符原样落库 | ○ |
| D15 | `volume-unit-overlap` | `electron/repositories/volume-structure-repository.ts:160` `rebuildVolumes` 事务内 | **一次写整卷**（`:212` 先 `deleteUnit.run(volumeId)`，`:213` 起逐条 insert）；INSERT 在 `:195-198`、执行在 `:214-215` | ✅ |
| D15 | 整卷读出 | `listVolumeUnits(db, volumeId?)`（`electron/repositories/volume-structure-repository.ts:114`） | 可一次取整卷，但**生产代码没有调用方**（只有单测用）⇒ 事务内要新增一次读取 | ○ |
| D18 | `suspense-hook-alignment` | `src/services/workflows/commands/directory.command.ts:549-562`（`commitDirectoryBlueprintRange` 调用之前） | 钩子在 `generatedBlueprints`（`:549`）里，大纲文本 `architecture` 仍在作用域 ⇒ **两边同时能拿到** | ✅ |
| D18 | 现有校验 | `src/shared/blueprint-semantic-contract.ts:260-263` `suspenseHook: requiredText(...)` | 只有「必填非空」，挂不了语义对齐 | ✅ |

**D18 有个坑**：`validateItem`（`structured-batch-executor.ts:567` 调 `contract.validateItem`）**拿不到大纲文本**。想在 validateItem 里做对齐校验是不行的，必须落在 `directory.command.ts:549` 之后、提交之前。

**D18 还缺一个函数**：大纲「收尾：」行**没有结构化字段**，格式只由提示词合同规定（`src/services/builtin-prompt-templates.ts:962-963`）。`splitOutlineSegments`（`src/shared/synopsis-projection.ts:177`）只把章块切成 `bodyLines`，没有专门提取「收尾：」行的函数 ⇒ 接线时要新写一个。

## 3. 现有可用的错误通道（D15 用得上）

| 机制 | 先例 | 适合什么 |
|---|---|---|
| 抛错 | `volume-structure-repository.ts:167` `throw new Error('VOLUME_STRUCTURE_UNPARSED')` | 结构解析失败这种「必须停」 |
| `warnings` 数组 | `src/shared/volume-structure.ts:205` `warnings.push('VOLUME_OBSERVED_OUT_OF_RANGE:...')` | 可疑但不阻断 |
| 只写日志 | `electron/services/volume-structure-sync.ts:42` `warn()`（「已忽略，不影响主流程」） | 事后可查，作者看不到 |

## 4. 接线前必须先定的三件事（**不是代码问题**）

1. **D5：判到占位符之后做什么？** 清空该字段 / 重试该批 / 只记警告让人工改。三种的代价完全不同 —— 清空会静默改掉结构，重试要接生成回路，只记警告等于没修（D5 的现象就是作者在界面上看见了）。
2. **D15：拦还是报？** 事务内拦 = 整批不落库（作者要重跑）；事务后报 = 允许重叠落库（现状）。**D15 的现象是「第 8、9 章归属不唯一」**，那是数据已经进库之后的事，只报不改等于把问题留给下游。
3. **D18：钩子偏离收尾行时算不算失败？** 大纲「收尾：」行本身可能写得很糊（它是一句话），严判会大批误伤。要定的是「判不齐的阈值」而不是「要不要判」。

## 5. 明确未做

- 三个模块**一行代码没动**，落点只是清点结论；
- D5 / D15 的落点行号是豆包一遍读的结果，**主 agent 未逐行复核**（标 ⚪ 的两行）；D15 的 INSERT 与执行处、D18 的两处落点已复核（✅）；
- 没有验证「接线后会不会与 `outline_hash` / 上游失效链冲突」—— 那是接线那一轮的事，别在这里顺带改。
