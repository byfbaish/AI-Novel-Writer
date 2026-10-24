# P1-2 期 2 · 卷末交接单自动生成 — 交接（2026-10-24）

> 状态：**已实施**（代码 + 测试全绿）；**未实机验证**（真模型产出质量、30 章长卷的输入体积）
> 设计稿：`docs/design/architecture/p1-2-volume-handoff-design.md` §8
> 分支：`exp/resource-ledger`

## 1. 这一期做了什么

卷内**最后一章定稿**时，用各章定稿要点生成一份「下一卷必须承接的六件事」初稿，作者在面板里改。

- **零迁移**：schema 仍为 20，不加表不加列；`source='generated'` 直接落在既有的 `volume_handoffs.source`。
- **零新增 IPC / 零新增 `finalization-generation` 槽位**：读 3 条 + 写 1 条，全是既有通道；
  生成走一次性结构化调用（与 W6b 资源抽取同档），失败由 `critical:false` 兜底。
- **触发点改了**（与计划稿相反，见 §4）。

## 2. 改了哪些文件

| 文件 | 动作 |
|---|---|
| `src/shared/volume-structure.ts` | 新增 `volumeRangeEndingAt()`（卷末章判定，仍走 `volumeEffectiveRanges`） |
| `src/services/volume-handoff-generation.ts` | **新增**：解析 / 裁剪 / 唯一字数口径 / 输入预算 / 生成入口（步骤与面板共用） |
| `src/services/builtin-prompt-templates.ts` | 新增内置模板 `generate_volume_handoff`（不进 `EDITABLE_PROMPT_KEYS`） |
| `src/services/prompt-language.ts` | 英文覆盖（必须，否则英文项目抛 `Missing en-US built-in prompt contract`） |
| `src/services/workflows/commands/finalize-chapter.command.ts` | `generateVolumeHandoffRaw?` 钩子 + `resolveVolumeHandoffRange()` 探测 + 步骤（`critical:false`，排在 `character_cards` 前） |
| `src/components/editor/VolumeHandoffRegistryPanel.tsx` | 「来源」列（作者版/初稿）+ 「重新生成」+ 生成中禁用 + 保存时 `source` 收窄 |
| 测试 6 个文件 | 新增 15 + 4 + 14 + 6 例；prompt 契约两处追加；electron 仓储追加 2 例 |

## 3. 四条硬约束（改之前必读）

1. **作者版永不自动覆盖**：定稿步骤与面板按钮都调 `isAuthorOwnedHandoff`（`volume-handoff-generation.ts`），
   不许各写一份；面板上作者版的「重新生成」直接 disabled。
2. **数据未就绪 ≠ 失败**：本卷一条要点都没有 ⇒ 不生成、不写库、步骤返回 ok，日志指向「定稿章节剧情要点」。
3. **坏输出一个字都不写**：不可解析 / 六项全空 / 单条超 1500 ⇒ 抛错，**不用垃圾覆盖上一次的好数据**。
4. **单一字数口径**：只有 `volumeHandoffBodyChars()`，实现复用 `renderVolumeHandoffSection(..., MAX_SAFE_INTEGER)`；
   单测断言它与渲染函数逐字相等。

## 4. 与计划稿的偏离（重要，别按计划稿理解）

| 计划稿 | 实际 |
|---|---|
| 触发点 = `architecture.command.ts:3374` | **定稿链的卷末章**。那里跑的是剧情大纲批次，正文还没写 |
| 880 行级整合夹具 | 把探测提成导出的 `resolveVolumeHandoffRange()` 后单测（4 例）+ 步骤单测（10 例），命令里只剩一行调用 |
| 「幂等重建」 | 幂等 = 重复触发只覆盖 `generated`；判断「这一卷是否已有记录」按 `volumeId` 查 |

## 5. 验证

```
tsc --noEmit                        ✅
vitest（7 个受影响套件）              ✅ 145 例
全量 src                            ✅ 3 failed / 19 failed（与开工前基线**逐字相同**，全是 better-sqlite3 ABI 145 vs 127）
electron 仓储（ELECTRON_RUN_AS_NODE） ✅ 14 例
browser（--config vitest.browser）    ✅ 19 例（13 既有 + 6 新增）
eslint（改动文件）                    ✅ 零告警
check-doc-links                     ✅
```

**开工前基线**（供下一位比对）：全量 `src` = `3 failed files / 19 failed tests / 3854 passed`。
本次结束时 = `3 / 19 / 3887 passed`（多出的 33 例全是新增）。

## 6. 未验证 / 已知限制

1. **真模型产出质量没验**：模板约束写得再细，也要跑一次真实项目才知道误报率与「六项是否真的在讲末章状态」。
2. **30 章长卷的实际输入体积没测**：20k 字上限是估算值；若真卷要点普遍更长，日志会报「第 N 章因输入预算省略」，
   届时要么调预算、要么让要点更短（不要谎报分子）。
3. **不判 stale**：卷内章被重写后，已有初稿不会自动失效（设计稿 §7 限制 4，等 P2-1）。
4. **写超计划末章不会自动触发**：卷末章 = `actual_last ?? planned_last`。作者写超了又没标记完成时，
   该卷的末章判定会变，触发点跟着走；最坏情况是「一直没触发」⇒ 用面板的「重新生成」兜底。
5. **一卷一份**：`volume_id` UNIQUE 焊死，没有历史版本。

## 7. 下一步

1. 实机跑一次：卷 1 = 1–3、卷 2 = 4–6，定稿第 3 章看初稿质量，把结论补进设计稿 §8.7。
2. 按评审 §5 继续：**12.15 剩两项**（伤势单调 / 位置可行）→ 修「第 5 维被挤出前 8 条」→ 让 `golden_finger` 进材料块 → W8。
3. P1-2 只剩**期 3**（大纲 prompt 前缀投影 L2/L3/L4），它要动 `confirmedPrefix`，与本期无交集。

---

## 8. 期 2b 追加：开写闸门（同日，作者要求）

> 起因：作者指出「写超计划末章可能一直不触发」这条限制不够，正确位置是**开写时**做状态检测，
> 弹强提示要求确认人工复查 —— 一卷二十章以上，一次强提示不伤体验。

### 8.1 做了什么

进新一卷第一章时，若上一卷的交接单**缺失**或**只有未确认的模型初稿**，开写前拦住，要求三选一：

1. **生成初稿给我看** → 跑共享生成函数 → 写 `source='generated'` → 展示摘要 → 再由作者点「就用这份」；
2. **已人工复查，继续** → 写一条确认（`consistency_exemptions`，`volume-handoff:<volumeId>`）→ 放行；
3. **取消，先去处理** → 什么都不写，下次还会问。

单章（`ChapterCreationDialog`）与批量（`BatchChapterCreationDialog`）都盖；批量按批次第一章判。

### 8.2 新增文件

| 文件 | 作用 |
|---|---|
| `src/shared/volume-handoff-gate.ts` | `volumeHandoffGateOf`（三态判定）+ `volumeHandoffAckKey` |
| `src/services/volume-handoff-gate.ts` | 读三条通道并判定；`acknowledgeVolumeHandoff` 写确认 |
| `src/components/dialogs/VolumeHandoffGatePanel.tsx` | 闸门面板（三个出口 + 生成中 + 摘要） |
| 面板追加 | 「已确认的跨卷衔接」折叠区 + 撤销（否则「可撤销」是空话） |

### 8.3 两条纪律

1. **生成完不自动放行**：初稿没人看过就不算交接完成，必须作者点「就用这份」。
2. **fail-open**：读失败 / 老项目没这几张表 ⇒ 不拦 + 一行日志。这是提醒，不是数据校验。

### 8.4 验证

- `volume-handoff-gate.test.ts` 8 例（三态 / 按卷区分 / 起止未定 / 非卷首不打扰）
- `VolumeHandoffGatePanel.browser.tsx` 8 例（三态文案 / 生成不自动放行 / 确认写入 / 失败不写库 / 取消）
- `VolumeHandoffRegistryPanel.browser.tsx` 21 例（新增确认列表与撤销 2 例）
- 全量 `src`：3 failed / 19 failed，与基线逐字相同；browser 五套件 67 passed / **1 failed（既有）**

> ⚠️ **browser 套件有一条既有红**（不是本期引入，已用 `git stash` 对照确认）：
> `chapter-writing-model-selector.browser.tsx` 的「shows the same continuable preflight in English
> before a batch run」—— 报 `events.filter is not a function`，根因是该用例的蓝图 mock 把
> `keyEvents` 写成字符串，而 `findBlueprintSlotAttackRisks` 期望数组。谁的活谁修，别混进本期。
