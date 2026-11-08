# D21 大纲进度闸门短路取证（2026-11-09）

> 状态：待裁定（2026-11-09 · 取证完成，修法未落地；未改任何生产代码或测试）

**待核断言**（出处仅作线索，不作证据）：`docs/design/product/2026-11-07-batch-acceptance-plan.md:242` —— 「闸门被卷结构 stale 短路」。
**基线**：`git -C wt-1 log --oneline -1` ⇒ `09791033 docs(channels): DSH 通道退役（升为中控）+ wt-3 槽位置空闲`。
**性质**：T3 证据（取证已完成，修法未落地、未改任何生产代码或测试）。执行方：豆包（外部通道，wt-1）；由 DSH 中控抽查 3 条证据后归档。**落地前置**：`src/services/__tests__/outline-progress-gate.test.ts:154-165` 把短路行为固化成断言，A / B 两案都会使其变红，须作者先裁定改不改测试。

## ① 结论

**断言成立，但有三处需要更正口径。**

**先纠正路径**：短路**不在** `src/shared/outline-progress-gate.ts`。那里是纯判定函数 `outlineProgressGateOf`（`:110`–`:146`），**没有**卷状态短路；`git ls-files "*outline-progress-gate*"` 列出 6 个文件，真正带 `volumeState` 短路的是 **`src/services/outline-progress-gate.ts:92`–`:95`**（读侧封装 `readOutlineProgressGate`，`:69`–`:123`）。

成立的精确版：

1. 只要 `db:volumes-list` 返回的 `state` 存在且**不是** `ready` / `empty`（即 `stale` 或 `unparsed`），`readOutlineProgressGate` 在 `:93`–`:94` 直接 `return { gate: null, warning: … }`，第 `:105`–`:118` 的「算上一卷区间 → 算交接单可用性 → 交纯函数判两维」整段落不到 ⇒ **第二维判据在这一态下确实不可达**。
2. 但**不是「没读」**：第四路 `db:volume-handoffs-list` 在第 `:86`–`:87` 的 `Promise.all` 里**已经发出并读回**，只是结果被短路丢弃。断言若写成「交接单根本没读」就不成立。
3. 调用方拿到 `gate: null` 后的行为是**放行**，不是「跳过闸门展示」：`ArchitectureConfirmDialog.tsx:509`–`:512` 只把 `warning` 丢给 `console.warn`，`gate?.state === 'ahead'` 才拦；`gate === null` 直接落到第二个闸门并最终发射 ⇒ **静默放行，界面零提示**。这才是 D21 的实际后果。

**触发面**：`state === 'stale'` 由 `volume-structure-repository.ts:151`–`:152` 判出（卷行的 `outlineHash` 与当前大纲投影的 `sha256` 不一致），是会**正常发生**的状态（作者改大纲后不重建卷结构就到了）。

**已有单测把这个行为固化了**：`src/services/__tests__/outline-progress-gate.test.ts:154`–`:165` 明确断言 `result.gate` 为 `null` 且 `warning` 含 `stale` ⇒ 任何修法都会撞红这条（红线 3 不许我改既有断言，故只能标「需作者改测试」）。

## ② 逐条证据

### 证据 1 · 短路段原文（`src/services/outline-progress-gate.ts:89`–`:95`）

```ts
    if (!volumesResult?.success) return { gate: null, warning: volumesResult?.error }
    // 卷表本身陈旧/没解析完时边界不可信 ⇒ 判不出就不拦（与「读失败」同一口径）。
    // 判据只用 `state === 'ready'`：`empty` 是老项目没建卷，走下面的 `volumeRangeEndingAt` 自然返回 null。
    const volumeState = (volumesResult as { state?: string }).state
    if (volumeState && volumeState !== 'ready' && volumeState !== 'empty') {
      return { gate: null, warning: `卷结构状态为 ${volumeState}，本次不判` }
    }
```

注释自认这是「判不出就不拦（与读失败同一口径）」——即设计上把它归入 fail-open，不是遗漏。

### 证据 2 · 被短路越过的那一段（`src/services/outline-progress-gate.ts:105`–`:119`）

```ts
    const previousRange = volumeRangeEndingAt(volumes, input.chapterNumber - 1)
    const handoffs = handoffsResult?.success && Array.isArray(handoffsResult.entries)
      ? handoffsResult.entries as VolumeHandoffDefinition[]
      : null
    return {
      gate: outlineProgressGateOf({
        volumes,
        authority: authority as Pick<AuthoritativeChapterSequence, 'status' | 'lastChapterNumber'>,
        acknowledged,
        chapterNumber: input.chapterNumber,
        handoff: handoffs
          ? handoffAvailabilityOf(handoffs, previousRange?.volumeIndex ?? null, input.chapterNumber)
          : 'unknown',
      }),
    }
```

`:116` 是第二维唯一的取值入口 —— 短路之后这行永不执行。

### 证据 3 · 第二维判据本体（`src/services/outline-progress-gate.ts:54`–`:67`）

```ts
function handoffAvailabilityOf(
  handoffs: readonly VolumeHandoffDefinition[],
  previousVolumeIndex: number | null,
  chapterNumber: number,
): PreviousHandoffAvailability {
  if (previousVolumeIndex === null) return 'unknown'
  const entry = handoffs.find(candidate => candidate.volumeIndex === previousVolumeIndex)
  if (!entry) return 'missing'
  if (entry.validity?.state === 'stale') return 'stale'
  if (isVolumeHandoffEmpty(entry)) return 'missing'
  const renders = (language: 'zh-CN' | 'en-US') =>
    renderVolumeHandoffSection(entry, language, chapterNumber, VOLUME_HANDOFF_MAX_CHARS) !== ''
  return renders('zh-CN') && renders('en-US') ? 'usable' : 'unusable'
}
```

- **名称**：`PreviousHandoffAvailability`，五值 `usable` / `missing` / `stale` / `unusable` / `unknown`（`src/shared/outline-progress-gate.ts:72`–`:77`）。
- **判据内容**：按卷号精确匹配上一卷的交接单 → 无单或六栏全空 ⇒ `missing`；`validity.state === 'stale'` ⇒ `stale`；能渲染出空节（超 `VOLUME_HANDOFF_MAX_CHARS` 预算）⇒ `unusable`；其余 ⇒ `usable`。
- **期望触发条件**：本批起始章是某卷首章（`chapterNumber ≥ 2` 且 `volumeRangeEndingAt(volumes, chapterNumber-1)` 有解），且上一卷交接单不可用 ⇒ 纯函数报 `ahead`。

### 证据 4 · 不可达闭环（行号串联）

- `src/shared/outline-progress-gate.ts:139`–`:144`：第二维只有在第一维过了之后才判：

```ts
  const proseAligned = input.authority.status !== 'invalid' && draftLastChapter >= range.last
  if (!proseAligned) return { ...base, state: 'ahead', reason: 'prose-unfinalized' }
  // 正文写完了，但这一卷的交接单不可用 ⇒ L3 仍走 plan，只不过原因换了一个。
  if (handoff === 'missing') return { ...base, state: 'ahead', reason: 'handoff-missing' }
  if (handoff === 'stale') return { ...base, state: 'ahead', reason: 'handoff-stale' }
  if (handoff === 'unusable') return { ...base, state: 'ahead', reason: 'handoff-unusable' }
```

- `src/shared/outline-progress-gate.ts:127`：不进 `handoff` 就默认 `unknown`，而 `unknown` 在 `:142`–`:144` 三档里**都不命中** ⇒ 最终 `:145` 返回 `aligned`（`src/shared/outline-progress-gate.ts:70` 注释亦写明 `unknown` 是 fail-open）。

闭环：`:93` 短路 → `:116` 不执行 → 纯函数 `handoff` 取 `unknown` → `aligned`。注意纯函数本身没有短路，**短路是读侧独有的**，这也是「修在哪一层」的关键。

### 证据 5 · `state` 从哪来（`electron/repositories/volume-structure-repository.ts:130`、`:147`–`:152`）

```ts
/** 面板要的四态：`empty` 需要自动建；`stale` 只提示；`unparsed` 禁用新增；`ready` 正常。 */
export type VolumeStructureState = 'ready' | 'stale' | 'empty' | 'unparsed'
...
  if (!projection) return { volumes, state: volumes.length === 0 ? 'unparsed' : 'stale', warnings: [] }
  if (volumes.length === 0) return { volumes, state: 'empty', warnings: projection.warnings }
  const outlineHash = sha256(projection.signature)
  // `retained` 行不参与过期判定：它们本来就不在大纲里。
  const stale = volumes.some(volume => volume.source === 'outline' && volume.outlineHash !== outlineHash)
  return { volumes, state: stale ? 'stale' : 'ready', warnings: projection.warnings }
```

`stale` **仍然带着 `volumes` 数组返回**（`:147`、`:152` 都返回 `volumes`）——所以「判不出」其实是「不敢用」，不是「没有数据可判」。这一点决定了修法 A 在数据上是可行的。

### 证据 6 · 调用方穷举（生产只有一个）

| 调用点 | 类型 | 拿到 `gate: null` 后 | 后果 |
|---|---|---|---|
| `src/components/dialogs/ArchitectureConfirmDialog.tsx:509` | **生产唯一调用点** | `:510` `if (warning) console.warn(…)`；`:511` `if (gate?.state === 'ahead') { setProgressGate(gate); return }`，否则继续往下 | **放行**：直接进入「闸门 2（派生作废清单）」，两闸都过就 `onConfirm` 发射（`:553`）⇒ 真会生成，且作者看不到任何提示 |
| `src/services/outline-progress-gate-probe.ts:87`（`readGate: readOutlineProgressGate`） | dev 探针，`src/App.tsx:170`–`:176` 用 `import.meta.env.DEV` 守卫，生产包不装 | 探针照抄 `readGate` 结果 | 仅取证用，不影响作者 |
| `src/services/__tests__/outline-progress-gate.test.ts`（15 处 `await readOutlineProgressGate(`） | 单测 | 断言值 | 不算生产调用点 |

调用点原文（`ArchitectureConfirmDialog.tsx:505`–`:513`）：

```ts
      if (checked.synopsis && !bypassProgressGate.current) {
        // 区间可能为空（`resolveSynopsisRange` 允许），此时不知道本批从第几章起 —— 不猜，直接放行。
        const chapterNumber = unitMode ? unitMode.from : resolution.range?.from
        if (dialogSession && chapterNumber !== undefined) {
          const { gate, warning } = await readOutlineProgressGate({ projectSession: dialogSession, chapterNumber })
          if (warning) console.warn('[outline-progress-gate]', warning)
          if (gate?.state === 'ahead') { setProgressGate(gate); return }
        }
      }
```

补充：面板本身**不给静默出口**（`OutlineProgressGatePanel.tsx:30`–`:33`「两个出口，没有『静默跳过』」），所以「静默」只可能来自 `gate: null` 这一路 —— 与上面结论互证。

### 证据 7 · 现有单测把该行为固化（`src/services/__tests__/outline-progress-gate.test.ts:154`–`:165`）

```ts
  it('卷表状态不是 ready ⇒ 判不出就不拦（边界本身不可信）', async () => {
    mocks.invoke.mockImplementation(async (_session: unknown, channel: string) => {
      if (channel === 'db:volumes-list') return { success: true, state: 'stale', volumes }
      if (channel === 'db:volume-handoffs-list') return { success: true, entries: [] }
      if (channel === 'db:draft-authority-sequence') return authority(20)
      if (channel === 'db:consistency-exemption-list') return []
      return null
    })
    const result = await readOutlineProgressGate(input)
    expect(result.gate).toBeNull()
    expect(result.warning).toContain('stale')
  })
```

### 最小可复现输入（不改文件，仅描述）

`chapterNumber = 7`（第 2 卷首章），四路 mock 返回：

- `db:volumes-list` ⇒ `{ success: true, state: 'stale', volumes: [ { volumeId: 'volume:1', first: 1, plannedLast: 6, actualLast: 6, … } ] }`
- `db:draft-authority-sequence` ⇒ `{ status: 'valid', lastChapterNumber: 6 }`（第一维**过**）
- `db:volume-handoffs-list` ⇒ `{ success: true, entries: [ { volumeIndex: 1, validity: { state: 'stale', behind: […] }, … } ] }`（第二维**应当命中** `handoff-stale`）

**当前结果**：`gate = null`，`warning = '卷结构状态为 stale，本次不判'`（断言成立）。
**修法 A 之后应当**：`gate.state = 'ahead'`、`gate.reason = 'handoff-stale'`。
**单测思路（只写思路，不落测试文件）**：在 `src/services/__tests__/outline-progress-gate.test.ts` 里复用 `:154`–`:165` 那组 mock，加两条 ——（1）`state: 'stale'` + 交接单 `stale` ⇒ 期望 `ahead / handoff-stale`；（2）`state: 'unparsed'` + 同一组 ⇒ 若走修法 B 仍期望 `null`、若走修法 A 期望 `ahead`（两法在这里分叉，需作者先定）。

附：`state` 缺省（mock 只返回 `{ success: true, volumes }`）时 `volumeState` 为 `undefined`，`:93` 条件短路不成立 ⇒ 现有测试大多不受影响，只有 `:154`–`:165` 这条会红。

## ③ 修法 A（分维独立返回）

**改法**：删掉 `:92`–`:95` 的整体短路，把「卷表陈旧」降级成一个只影响 warning 的标志，让 `outlineProgressGateOf` 自己在 `:122`、`:139`、`:142`–`:144` 做分维（第一维拿不到区间才 `null`，第二维照判）。

**diff（可直接粘贴）**

```diff
--- a/src/services/outline-progress-gate.ts
+++ b/src/services/outline-progress-gate.ts
@@ -89,10 +89,11 @@
     if (!volumesResult?.success) return { gate: null, warning: volumesResult?.error }
-    // 卷表本身陈旧/没解析完时边界不可信 ⇒ 判不出就不拦（与「读失败」同一口径）。
-    // 判据只用 `state === 'ready'`：`empty` 是老项目没建卷，走下面的 `volumeRangeEndingAt` 自然返回 null。
+    // 卷表陈旧/未解析只降级「边界来源」，不再整体短路：第二维（交接单可用性）与
+    // 卷表 hash 无关，短路会把它一起吞掉（D21）。`empty` 仍走 `volumeRangeEndingAt` 自然 null。
     const volumeState = (volumesResult as { state?: string }).state
-    if (volumeState && volumeState !== 'ready' && volumeState !== 'empty') {
-      return { gate: null, warning: `卷结构状态为 ${volumeState}，本次不判` }
-    }
+    const boundaryStale = Boolean(volumeState && volumeState !== 'ready' && volumeState !== 'empty')
     if (!authority || typeof authority !== 'object' || typeof authority.status !== 'string') {
       return { gate: null, warning: '正文权威序列不可读' }
     }
@@ -109,10 +110,13 @@
     return {
       gate: outlineProgressGateOf({
         volumes,
         authority: authority as Pick<AuthoritativeChapterSequence, 'status' | 'lastChapterNumber'>,
         acknowledged,
         chapterNumber: input.chapterNumber,
         handoff: handoffs
           ? handoffAvailabilityOf(handoffs, previousRange?.volumeIndex ?? null, input.chapterNumber)
           : 'unknown',
       }),
+      ...(boundaryStale
+        ? { warning: `卷结构状态为 ${volumeState}，本批判定用的是该快照的卷边界` }
+        : {}),
     }
```

- **改哪几行**：删 `:92`–`:95`（4 行，含 2 行注释）→ 换成 `:90`+1 行标志；在 `:118` 的 `}),` 之后加 3 行可选 warning。
- **影响调用方**：`ArchitectureConfirmDialog.tsx:509`–`:512` 不用改（`gate.state === 'ahead'` 自然触发面板）；warning 仍走 `:510` 的 `console.warn`。
- **影响测试**：`src/services/__tests__/outline-progress-gate.test.ts:154`–`:165` **必红**（`gate` 不再是 `null`）；其余用例不走 `state` 分支，不受影响。`src/shared/__tests__/outline-progress-gate.test.ts` 不受影响（纯函数未改）。

## ④ 修法 B（降级为警告，且只对 `stale` 放宽）

**改法**：比 A 保守一档 —— **`unparsed` 保持短路**（连 schema 都没有，`volumes` 是空数组，判也没有意义），只对 `stale`（有行、只是 hash 过期）继续判；并把「边界来自旧快照」这件事**报到界面**，而不是只写日志。

**diff（可直接粘贴，services 侧）**

```diff
--- a/src/services/outline-progress-gate.ts
+++ b/src/services/outline-progress-gate.ts
@@ -89,10 +89,12 @@
     if (!volumesResult?.success) return { gate: null, warning: volumesResult?.error }
-    // 卷表本身陈旧/没解析完时边界不可信 ⇒ 判不出就不拦（与「读失败」同一口径）。
-    // 判据只用 `state === 'ready'`：`empty` 是老项目没建卷，走下面的 `volumeRangeEndingAt` 自然返回 null。
+    // `unparsed`（没有卷表结构）仍判不出 ⇒ 短路；`stale`（有行、hash 过期）只降级边界来源，
+    // 交给下面的分维判定，并把降级事实交给界面（D21）。
     const volumeState = (volumesResult as { state?: string }).state
-    if (volumeState && volumeState !== 'ready' && volumeState !== 'empty') {
+    if (volumeState === 'unparsed') {
       return { gate: null, warning: `卷结构状态为 ${volumeState}，本次不判` }
     }
+    const boundaryStale = volumeState === 'stale'
@@ -109,10 +111,13 @@
     return {
       gate: outlineProgressGateOf({
         volumes,
         authority: authority as Pick<AuthoritativeChapterSequence, 'status' | 'lastChapterNumber'>,
         acknowledged,
         chapterNumber: input.chapterNumber,
         handoff: handoffs
           ? handoffAvailabilityOf(handoffs, previousRange?.volumeIndex ?? null, input.chapterNumber)
           : 'unknown',
       }),
+      ...(boundaryStale
+        ? { warning: `卷结构状态为 stale，本批用的是旧快照的卷边界；建议先重建卷结构` }
+        : {}),
     }
```

**界面侧（必须一起改，否则「警告」只到 console，等于没降级）**

```diff
--- a/src/components/dialogs/ArchitectureConfirmDialog.tsx
+++ b/src/components/dialogs/ArchitectureConfirmDialog.tsx
@@ -508,7 +508,10 @@
           const { gate, warning } = await readOutlineProgressGate({ projectSession: dialogSession, chapterNumber })
-          if (warning) console.warn('[outline-progress-gate]', warning)
+          if (warning) {
+            console.warn('[outline-progress-gate]', warning)
+            toast.info(warning)
+          }
           if (gate?.state === 'ahead') { setProgressGate(gate); return }
```

- **改哪几行**：`services` `:92`–`:95`（`unparsed` 仍短路、`stale` 放行）+ `:118` 加 warning；`ArchitectureConfirmDialog.tsx:510` 加 `toast.info`（`toast` 在该文件已用于 `:559`，import 现成）。
- **影响调用方**：唯一生产调用点，改动 1 行。
- **影响测试**：`outline-progress-gate.test.ts:154`–`:165` 用的正是 `state: 'stale'` ⇒ **必红**，需作者改成「`stale` ⇒ `ahead`」并补一条「`unparsed` ⇒ `null`」；`workflow-launch-dialogs.browser.tsx` 若断言过「闸门不弹」需复核（本次读取的文件内未找到该断言原文，**不确定**）。

## ⑤ 风险

1. **误报（A 的主要风险）**：`stale` 的 `volumes` 边界来自旧大纲快照，用它算出的「上一卷末章 / 卷号」可能已经不对 ⇒ A 会把一条**基于过期边界**的 `prose-unfinalized` 或 `handoff-*` 弹给作者。项目自己的红线是「多报一次可用就是界面撒谎」（`src/services/outline-progress-gate.ts:52`），A 是往这个方向走了一步，B 用 `stale` 时的显式 warning 部分抵消。
2. **测试锁定**：`:154`–`:165` 是按「短路是刻意设计」写的（用例名就叫「判不出就不拦」），A/B 都会让它红。**红线 3 禁止我改既有断言** ⇒ 必须由作者先裁定「这条用例要不要改」，否则任何修法都过不了闸门。
3. **`unparsed` 的边界**：A 对 `unparsed` 也放行，但 `unparsed` 时 `volumes` 通常是空数组（`volume-structure-repository.ts:138` 返回 `{ volumes: [], state: 'unparsed' }`）⇒ `volumeRangeEndingAt` 返回 `null`，纯函数 `:122` 仍 `null`，实际无变化。真正的行为变化只发生在 `stale`。B 明确保留 `unparsed` 短路。
4. **第二维的「同一事实」风险**：`handoffAvailabilityOf` 的口径必须与 `outline-prefix-context.ts` + 投影一致（`src/services/outline-progress-gate.ts:43`–`:49` 注释）。本轮已核两处：
   - `stale` 档：`src/services/outline-prefix-context.ts:67`–`:70` 写「过期 ⇒ **不注入**」，`const previousHandoff = handoffDrift ? null : matchedHandoff`，与闸门 `:62` 判 `stale` 同向 ⇒ **未漂移**。
   - `unusable` 档：投影在 `src/shared/synopsis-projection.ts:497`–`:499` 用 `renderVolumeHandoffSection(handoff, …, VOLUME_HANDOFF_MAX_CHARS)`，渲染为空则落到 `plan` 分支（`:511`）；闸门 `:64`–`:66` 要求**中英两种语言都渲染非空** ⇒ 同向且**闸门更严**（不会出现「闸门说 usable、投影却走 plan」）。
   ⇒ 修法只是让这段有机会执行，不改口径，**无新增风险**。
5. **调用面窄，回归风险低**：生产调用点只有 `ArchitectureConfirmDialog.tsx:509` 一处，probe 受 `import.meta.env.DEV` 守卫 ⇒ 不会影响生产包。
6. **B 的界面改动量**：新增一条 `toast.info` 会在每次卷首规划时可能弹一次（`stale` 状态可能长期存在，作者不重建就一直提示）—— 有变成「狼来了」的风险，需作者决定提示频次（每次 vs 每卷一次）。

## ⑥ 执行记录（只读命令）

1. `git -C wt-1 log --oneline -1` ⇒ `09791033`。
2. `git ls-files "*outline-progress-gate*"` ⇒ 6 个文件（`src/services/…`、`src/shared/…`、两个测试、一个 probe、probe 测试）⇒ 确认真实路径是 `src/services/outline-progress-gate.ts`。
3. `Grep 'readOutlineProgressGate|outlineProgressGateOf|OutlineProgressGateReadResult|outlineProgressAckKey'`（`src/**/*.ts*`）⇒ 62 处命中，逐一分类得「生产调用点 1 处」。
4. `Grep 'outline-progress-gate'`（`electron/**/*.ts`）⇒ 0 命中（该闸门不经 IPC 主进程注册）。
5. `Read src/services/outline-progress-gate.ts:50`–`129`；`Read src/shared/outline-progress-gate.ts` 全文。
6. `Read src/components/dialogs/ArchitectureConfirmDialog.tsx:495`–`574`；`Grep bypassProgressGate|progressGate` 同文件 ⇒ 11 处。
7. `Grep reason|handoff|missingChapters`（`OutlineProgressGatePanel.tsx`）⇒ 面板四档文案与「两个出口、无静默跳过」。
8. `Read electron/repositories/volume-structure-repository.ts:120`–`164` ⇒ `VolumeStructureState` 四态与 `stale` 判定。
9. `Read src/services/__tests__/outline-progress-gate.test.ts:140`–`199` ⇒ `:154`–`:165` 固化短路行为。
10. `Grep 'outline-progress-gate'`（`src/App.tsx`）⇒ `:173`，`Read :166`–`:179` 确认 `import.meta.env.DEV` 守卫。
11. `Grep 'state === 'stale''`（`src/**/*.ts`，带 4 行上下文）⇒ 174 处命中，其中核到 `src/services/outline-prefix-context.ts:67`–`:70`（stale ⇒ 不注入）与 `src/shared/upstream-revisions.ts:275`–`:277`（「八处消费方一律直接写 `.validity?.state === 'stale'`」）。
12. `Grep 'renderVolumeHandoffSection|VOLUME_HANDOFF_MAX_CHARS|isVolumeHandoffEmpty'`（`outline-prefix-context.ts`）⇒ 0 命中（渲染不在该文件）⇒ `Read src/shared/synopsis-projection.ts:492`–`:513` 补上投影侧的渲染判据。
13. `Select-String 'await readOutlineProgressGate\('`（services 单测）⇒ 15 处。
14. `git -C wt-1 status --short` ⇒ 仅 `?? .batch/`。

**未做的事**：未跑任何测试、未起应用、未改任何源码或既有文档、未做 git 写操作。

## ⑦ 作者质疑（2026-11-09 02:47）与修法 C：闸门不依赖派生缓存

**作者原话**：「大纲改过以后，为什么卷结构要重建？卷在大纲的上游，什么时候下游还能影响上游了？」

**回答（两词一物两义）**：作者定的「卷」是上游 —— 蓝图里的卷数/总章数，喂给大纲生成，是权威。库里 `volumes` 表**不是**这份设定，而是把架构文本（`project_core.plot_structure_plan` + `synopsis` + `totalChapters`）**解析成的结构化投影**：`electron/services/volume-structure-sync.ts` 头注写明「输入是作者已有的架构文本，产物是同一份文本的结构化投影，不新增任何信息」，纯函数是 `src/shared/volume-structure.ts:197` 的 `materializeVolumeStructure`。架构/大纲文本一改，解析出的卷/单元/章号边界**可能变**，所以这张缓存会过期（`volume-structure-repository.ts:149` `outlineHash = sha256(projection.signature)`、`:151` 不一致即 `stale`）。**不存在下游改上游**；重建只是把同一份上游文本重新投影，不是让缓存去影响上游。

**真缺陷因此更清楚**：过期时闸门不是「重建后再判」，而是 **`src/services/outline-progress-gate.ts:92-95` 直接不判、`ArchitectureConfirmDialog.tsx:509-512` 静默放行**，作者在界面上看不到任何提示。既然卷的权威在上游，修法方向应是**让闸门不依赖这张缓存的新鲜度**，而不是要求作者先点重建。

**修法 C（候选，待裁定）**：闸门旁路 `db:volumes-list` 的 `state`，用同一个纯函数 `materializeVolumeStructure` 按核心数据（`project_core` 的 `plot_structure_plan` / `synopsis` / `totalChapters`）**现算**卷边界与「上一卷区间」；`volumes` 表只提供 actual_last / 进度这类无法从文本投影得到的运行时数据。代价：闸门要多读一次 `project-core`，并让取区间逻辑下沉到 `src/shared/` 两处共用。仍需处理 `outline-progress-gate.test.ts:154-165` 那条把「短路」写成断言的既有单测。A / B / C 三案待作者拍板。
