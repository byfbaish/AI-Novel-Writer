# D1 · D21 修法 C 的 UI 操作指南与中英文案

> 状态：待裁定（2026-11-09 · 设计输入：文案可直接进下一批 D21 修法 C，代码未开始；主次按钮顺序与「表旧」档形态待作者定）
> 归档：2026-11-09 夜跑 · 豆包（wt-1 / CDP 9331）· 看板卡 `e05d6eb8-b078-4f3f-80e4-324a688a4cee` · 任务书 `scripts/night/20261109/db-d1-d21-ui-guide.md` · 原始产物 `wt-1/.batch/night/d1-d21-ui-guide.md`
> 基线与性质：wt-1 HEAD `cd78aaa8`；**只读产物**（未改代码 / 未跑测试 / 未做 git 写）。
> Lead 归档复核（2026-11-09 19:30）：抽检行号命中（`src/services/outline-progress-gate.ts:92-95`、`ArchitectureConfirmDialog.tsx:510`、`src/shared/outline-progress-gate.ts:136`/`:143`）；四槽位文案可直接进下一批 D21 修法 C 的实现，主次按钮顺序与「表旧」档形态待作者定。

> 基线：`git -C wt-1 log --oneline -1` ⇒ `cd78aaa8 docs(author): 作者 02:47 校正落地（批量续跑范围、D21 修法 C、同剧情不立项、wt-3 清理）`
> 性质：T3 设计输入（只读审计产物）。**未改任何产品代码、未跑测试、未做 git 写操作。**
> 通行口径：本稿只描述「修法 C 落地后界面上该怎么表现」，代码改动排下一批，不在本稿范围内。

## 结论（一段话）

这道闸门防的是「拿没写完的正文去写下一卷大纲」——只防告知、不防操作。修法 C 之后，卷结构表过期不再让闸门闭嘴：判定改用**当前大纲文本现算**的卷边界，界面上必须多一行字说清「表比大纲旧、计划区间是刚算的、实际末章仍取自那张表」，并把「先去重建」和「我知道，继续」两个出口的先后顺序按本卷事实重排（过期优先于旧确认）；作者点继续仍会落一条可撤销的确认记录，删掉它就恢复提醒。**本稿给出可直接进 UI 的四段文案和一份逐步操作路径，均按现有按钮与页面位置写成，无需新增页面。**

## 一、产品口径（一句话）

**它在防「大纲按计划结局写、正文却没写到那儿」——下一卷大纲以为上一卷已经收在某件事上，其实上一卷还没写完，于是整条故事线顺着一个不存在的结尾往前走。**

（不用代码术语的版本，可直接贴进帮助页：*你正在给新一卷写大纲。写大纲要用「上一卷实际结束在哪」，而不是「上一卷计划结束在哪」。这两者不一致时，这个提示会拦你一下，让你选：先去补正文／补交接单，还是明知如此仍按计划往下写。*）

## 二、证据（文件:行 + 原文摘录）

**E1 · 现状的「不判」在哪**（`src/services/outline-progress-gate.ts:92`–`:95`）

```ts
    const volumeState = (volumesResult as { state?: string }).state
    if (volumeState && volumeState !== 'ready' && volumeState !== 'empty') {
      return { gate: null, warning: `卷结构状态为 ${volumeState}，本次不判` }
    }
```

**E2 · 现状的「静默放行」在哪**（`src/components/dialogs/ArchitectureConfirmDialog.tsx:509`–`:511`）

```ts
          const { gate, warning } = await readOutlineProgressGate({ projectSession: dialogSession, chapterNumber })
          if (warning) console.warn('[outline-progress-gate]', warning)
          if (gate?.state === 'ahead') { setProgressGate(gate); return }
```

`console.warn` 只进开发者控制台，作者界面零提示；`gate` 为 `null` 时继续走到 `:1067` 的「确认生成」按钮逻辑。

**E3 · 面板的定位就是「只能提醒、不能阻断」**（`src/components/dialogs/OutlineProgressGatePanel.tsx:17`）

```
 * （先铺多卷大纲再写正文），所以这里**只能提醒，不能阻断**：一个「我知道，继续」的出口是必须的。
```

两个出口与理由输入（同文件 `:211`、`:224`、`:227`）：

```tsx
          aria-label={text('确认理由', 'Confirmation reason')}
...
          {dismissLabel}
...
          {text('我知道，仍按计划继续', 'I know, continue with the plan')}
```

**E4 · 卷结构页的按钮与过期提示词（作者要点的东西在这儿）**（`src/components/editor/VolumeHandoffRegistryPanel.tsx:566`–`:575`、`:586`–`:588`）

```tsx
        <Button size="sm" onClick={addRow} disabled={busy || !canAdd}>
          <Plus size={13} />{text('新增一卷', 'Add volume')}
...
        <Button size="sm" variant="ghost" onClick={() => void rebuild()} disabled={busy || loading}>
          <RefreshCw size={13} />{text('重建卷结构', 'Rebuild structure')}
...
          : volumeState === 'stale'
            ? text('卷结构已过期（大纲比表新）。重建只更新计划区间，不会清空实际末章。',
              'Volume structure is stale. Rebuilding only refreshes planned ranges; actual end chapters are kept.')
```

**E5 · 这一页怎么进**（`src/components/panels/sidebar/ProjectTree.tsx:547`–`:551`）

```tsx
            onClick={() => openBuiltinEditor(
              'volume-handoff-registry-editor',
              text('卷末交接', 'Volume handoffs'),
```

即左侧项目树里的**「卷末交接」**条目，点开就是上面那个面板。

**E6 · 「过期优先于已确认」这条既有纪律**（`src/shared/volume-handoff-gate.ts:66`–`:70`）

```ts
  // 过期**优先于**「已确认」：确认是对某一版内容的确认，上游改了以后那次确认
  // 描述的现实已经不在了（与 ADR-0026「收据描述的现实可能已经不在」同一类）。
  // 判定必须在 `acknowledged` 之前 —— 放后面就会「确认一次永久放行」，
  // 后面无论上游怎么改，这道闸都不再开口。
  if (handoff?.validity?.state === 'stale') return { state: 'stale', range, handoff }
```

**E7 · 大纲闸门现在的顺序与 E6 相反（修法 C 要顺手对齐的点）**（`src/shared/outline-progress-gate.ts:136`–`:144`）

```ts
  if (input.acknowledged.includes(outlineProgressAckKey(range.volumeId))) {
    return { ...base, state: 'aligned', reason: null }
  }
  const proseAligned = input.authority.status !== 'invalid' && draftLastChapter >= range.last
  if (!proseAligned) return { ...base, state: 'ahead', reason: 'prose-unfinalized' }
  // 正文写完了，但这一卷的交接单不可用 ⇒ L3 仍走 plan，只不过原因换了一个。
  if (handoff === 'missing') return { ...base, state: 'ahead', reason: 'handoff-missing' }
  if (handoff === 'stale') return { ...base, state: 'ahead', reason: 'handoff-stale' }
```

已确认（`:136`）在交接单过期（`:143`）**之前**生效 ⇒ 是一条「确认一次永久放行」的路。

**E8 · `stale` 怎么判出来的**（`electron/repositories/volume-structure-repository.ts:149`–`:152`）

```ts
  const outlineHash = sha256(projection.signature)
  // `retained` 行不参与过期判定：它们本来就不在大纲里。
  const stale = volumes.some(volume => volume.source === 'outline' && volume.outlineHash !== outlineHash)
  return { volumes, state: stale ? 'stale' : 'ready', warnings: projection.warnings }
```

**E9 · 修法 C 要用的「现算」纯函数**（`src/shared/volume-structure.ts:197`）

```
export function materializeVolumeStructure(input: {
```

（取证稿 `docs/design/product/d21-gate-shortcircuit-evidence-20261109.md:310`–`:314` 已把 C 的口径写成「旁路 `state`、用同一纯函数按 `project_core` 现算、`volumes` 表只提供 actual_last」；本稿沿用该口径。）

**E10 · 作者点的两个按钮叫什么**（`ArchitectureConfirmDialog.tsx:1066`–`:1069`）

```tsx
          <Button variant="outline" onClick={onClose} disabled={isConfirming}>{text('取消', 'Cancel')}</Button>
          <Button variant="default" onClick={handleConfirm} disabled={noneSelected || isConfirming || progressGate !== null || invalidationGate !== null || (checked.synopsis && preferenceLoading)}>
            <Wand2 size={13} />
            {isConfirming ? text('校验中...', 'Validating...') : text(`确认生成（${selectedSteps.length}/${ARCH_STEP_COUNT}）`, `Generate (${selectedSteps.length}/${ARCH_STEP_COUNT})`)}
```

**E11 · 勾选项的界面名字**（同文件 `:52`–`:56`，`ARCH_FILES` 的 `label`）

```
故事前提 / 角色图谱 / 世界观 / 卷 / 单元结构 / 情节大纲
```

闸门只在勾了**「情节大纲」**时才有意义（`:505` `if (checked.synopsis && !bypassProgressGate.current)`）。

## 三、修法 C 的行为定义

1. **过期不再等于闭嘴**：卷结构 `state` 为 `stale` 时，不返回 `null`、不短路；闸门照常出结论（`ahead` 或 `aligned`）。`unparsed`（连卷表结构都没有）仍按「判不出」处理 —— 此时连可用的卷行都不存在，判也无从判。
2. **边界用当前大纲现算**：上一卷区间不再取自那张会过期的表，而是用同一套纯函数按 `project_core` 的 `plot_structure_plan` / `synopsis` / `totalChapters` 现算（`src/shared/volume-structure.ts:197`）。表的用途收缩为提供「实际末章 / 进度」这类文本里投影不出来的运行时数据。
3. **提示必须写明来源差**：面板正文要有一句「卷结构表比大纲旧；本批的计划区间已按当前大纲现算，实际写到第几章仍取自那张表，可能落后」。这一句是防止作者误以为「表已经修好了」——否则会出现「提示说上一卷没写完，其实早写完了」的误报而没人能判断该信谁。
4. **确认顺序对齐「过期优先」**：交接单 `stale` 的判定要挪到 `acknowledged` 之前（照 `src/shared/volume-handoff-gate.ts:66`–`:70` 的既有纪律）。理由就是那段注释：确认是对某一版内容的确认，上游改了以后那次确认描述的现实已经不在；放在后面等于「确认一次永久放行」。对应到现状就是 `src/shared/outline-progress-gate.ts:136` 与 `:143` 的先后要对调。
5. **仍然是提醒不是阻断**：两个出口都保留，越过仍落一条可撤销记录（`src/services/outline-progress-gate.ts:126`–`:129` 的注释写的就是这个语义）。

## 四、操作指南（作者视角，逐步）

**前提**：你在「架构确认」对话框里勾了**「情节大纲」**，点了右下角**「确认生成（n/5）」**，面板弹在同一个对话框里。

### A. 看到提示先认队列（面板标题就是原因）

| 面板说什么 | 意思 | 该去哪 |
|---|---|---|
| 「上一卷正文还没整卷定稿」 | 上一卷还有章节没定稿 | 先写/定稿正文 |
| 「上一卷的卷末交接单还没登记」 | 正文写完了，但没填交接单 | 「卷末交接」页登记 |
| 「上一卷的卷末交接单过期了」 | 有单，但上游改过 | 「卷末交接」页更新那张单 |
| 「上一卷的卷末交接单装不进去」 | 单太长，渲染成空节 | 「卷末交接」页精简那张单 |
| **（修法 C 新增）「卷结构表比大纲旧」** | 表过期，但判定已按当前大纲现算 | 可继续；想清账就去重建 |

### B. 想按「安全路径」走（推荐）

1. 点面板次按钮 **「取消，我先去…」**（按原因不同，文字分别为「取消，我先去补正文」/「取消，我先去登记交接单」/「取消，我先去更新交接单」/「取消，我先去精简交接单」；新增档为「取消，我先去重建卷结构」）。此时**什么都不写库**，对话框关闭。
2. 如果原因是交接单：左侧项目树 → **「卷末交接」** → 面板顶部 **「新增一卷」**（已有行则直接改）→ 填六栏 → 点顶部 **「保存」**。
3. 如果是卷结构过期：同一个页面的顶部点 **「重建卷结构」**；点完看面板状态行是否从「卷结构已过期（大纲比表新）」变成「卷结构：N 卷」。**重建只刷新计划区间，不清空实际末章**（页面上的提示原文如此，可放心点）。
4. 回到「架构确认」对话框，重新勾「情节大纲」→ **「确认生成（n/5）」** → 提示应当不再出现（面板会按新事实重算）。

### C. 想强行越过

1. 在面板的理由框（标签「确认理由」）里写一句人话，**必填**，上限 500 字。
2. 点主按钮 **「我知道，仍按计划继续」**。
3. 后果：本次发射继续（闸门不是阻断），同时往 `consistency_exemptions` 写一条 `outline-progress:<卷号>` 的记录 —— **本卷以后不再提醒**，即使上游又改了。
4. 恢复办法：去左侧 **「卷末交接」** 页的**已确认清单**，删掉那一条 → 下次进同一卷首会重新提醒（`src/services/outline-progress-gate.ts:128` 写明撤销入口在这里）。
5. 修法 C 之后要额外注意：若那条确认是**交接单过期之前**写的，按「过期优先」的新顺序，它**不再能压住**过期提醒 —— 面板会重新问一次。这是刻意行为，不是 bug。

### D. 常见误操作

- **点「取消」而不是面板上的次按钮**：对话框底部「取消」（`ArchitectureConfirmDialog.tsx:1066`）只是关窗，同样不写库，但你会丢掉这次勾选，得重来一遍。
- **以为重建会清空进度**：不会。页面原话「重建只更新计划区间，不会清空实际末章」。
- **以为确认一次就永久免责**：修法 C 之后不再成立（见 C.5）。

## 五、中英文案（新增「卷结构表过期」这一档，可直接替换现有面板文案结构）

> 结构沿用 `OutlineProgressGatePanel.tsx` 的四个槽位 —— `title`（`:63`）、`body`（`:70`）、`dismissLabel`（`:118`）、`defaultReason`（`:125`）—— 并新增一条 help 链接文字。文案按「附注档」写，不占用独立档位（理由见 §七.3）。

### 中文

- **标题**：`卷结构表比大纲旧`
- **正文**：
  > `你的大纲改过之后，卷结构表还没跟着重建。本批的计划区间已按**当前大纲**现算，但「上一卷实际写到第几章」仍取自那张旧表，可能落后。不重建也能继续；重建只刷新计划区间，不会清空实际末章。`
- **主按钮**：`我知道，仍按当前大纲继续`
- **次按钮**：`取消，我先去重建卷结构`
- **帮助链接**：`为什么卷结构不用先重建？`
- **越过后写入的确认理由默认值**：`作者已知卷结构表比大纲旧，仍按当前大纲算出的边界继续规划下一卷大纲`

### English

- **Title**: `The volume table is older than your outline`
- **Body**:
  > `Your outline changed after the volume table was built. This batch recomputes the planned ranges from your **current outline**, but "how far the previous volume actually got" still comes from that older table and may lag behind. You can continue without rebuilding; rebuilding only refreshes planned ranges and keeps actual end chapters.`
- **Primary button**: `I know, continue with the recomputed boundaries`
- **Secondary button**: `Cancel, rebuild the structure first`
- **Help link**: `Why doesn't the volume table need rebuilding first?`
- **Default confirmation reason**: `Author knows the volume table is older than the outline and continues with the recomputed boundaries`

### 文案自检（对着任务书三问）

| 要回答 | 落在哪句 |
|---|---|
| 为什么现在弹 | 标题「卷结构表比大纲旧」＋正文第一句「你的大纲改过之后…」；配合面板标题区已写的「第N卷（第a–b章）」 |
| 不重建会怎样 | 正文「…仍取自那张旧表，可能落后」＋「不重建也能继续」（明说不阻断） |
| 怎么重建 | 次按钮「取消，我先去重建卷结构」＋帮助链接指向「卷末交接」页顶部的「重建卷结构」 |

## 六、与现行设计的差异清单

| 维度 | 现状（代码行为） | 修法 C 之后 | 证据 |
|---|---|---|---|
| `stale` 时的判定 | 直接 `return { gate: null }`，不判 | 照判，出 `aligned` / `ahead` | `services/outline-progress-gate.ts:92`–`:95` |
| `unparsed` 时 | 同上，短路 | 仍短路（无卷行可判） | 同上；`volume-structure-repository.ts:138` |
| 卷边界来源 | 表的 `planned_*`（可能过期） | 按当前大纲现算 | `src/shared/volume-structure.ts:197` |
| 实际进度来源 | 表 | 表（不变） | 取证稿 `:314` |
| 界面是否提「表旧」 | 不提，`console.warn` 完事 | 面板正文必须提，并说明已现算 | `ArchitectureConfirmDialog.tsx:510` |
| 确认 vs 过期 | 确认先判 ⇒ 一次确认永久压住 | 过期先判 ⇒ 旧确认压不住 | `shared/volume-handoff-gate.ts:66`–`:70` vs `shared/outline-progress-gate.ts:136`–`:143` |
| 出口数 | 2（取消 / 继续） | 2（不变）＋新增一格文案 | `OutlineProgressGatePanel.tsx:224`–`:227` |
| 阻断性 | 不阻断 | 不阻断（刻意保持） | `OutlineProgressGatePanel.tsx:17` |

## 七、遗留问题

1. **主次按钮要不要对调**：本稿沿用现状（主=「我知道，继续」），因为面板设计注释明写「只能提醒，不能阻断」（`OutlineProgressGatePanel.tsx:17`）。若产品希望「重建」成为默认动作，需作者拍板 —— 这会让「先重建再规划」变成事实上的推荐路径，与「先铺多卷大纲再写正文」这种合法用法相冲突。
2. **帮助链接落点未定**：现有面板没有外链/内链机制，`OutlineProgressGatePanel.tsx` 内本次读到的范围内**未见** help 类元素。要加链接需新增一个入口（打开设计稿或跳到「卷末交接」页）。是否值得为这一档单独做导航入口，待作者定。
3. **「表旧」这一档的提示频次**：`stale` 可能长期存在（作者不重建就一直旧）。若每次卷首都弹，会退化成「狼来了」。建议：**只在真正判定为 `ahead` 时**附这句「表旧」说明（即它是一条附注，不是独立第五档）。本稿文案按「附注」写，若改为独立档需重排面板四档结构（`OutlineProgressGatePanel.tsx:55`–`:68` 的 `gateReason` 分支会多一个值）。
4. **`reason` 类型扩展**：若做成独立档，`OutlineProgressGateReason`（`src/shared/outline-progress-gate.ts:56`–`:60`）要加一个值，`OutlineProgressGatePanel.tsx` 的标题/正文/次按钮/默认理由四处分支（`:63`、`:70`、`:118`、`:125`）都要跟着加，改动面比「附注」大一档。**未核实**现有 browser 测试是否覆盖了「未知 reason 兜底」，故不写「不会红」。
5. **文案里的「当前大纲」指哪份文本**：`project_core` 里有 `plot_structure_plan` 与 `synopsis` 两份，现算吃的是两者＋`totalChapters`。文案统一说「大纲」，但作者可能理解成「情节大纲」那一份。若出现「我明明改的是卷结构」的疑问，需在帮助页把两份文本点名。**未核实**产品侧是否已有更精确的叫法。
6. **D3 状态联动**：D21 与 D3 绑定（`docs/plans/prompt-assembly-backlog.md:126`「见 D21…D3 不得转 ✅」）。修法 C 落地后 D3 的第二维才真正可达，届时 D3 能否转 ✅ 需作者另裁 —— 本稿不涉及状态判定。

## [T1] DONE

（本报告仅只读审计与文案设计，未改代码、未跑测试、未做 git 写操作；产物路径 `wt-1/.batch/night/d1-d21-ui-guide.md`。）
