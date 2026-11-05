# D17 方案 · 生成路径给大纲提交补上「这次改了哪几章」

> 状态：待裁定（2026-11-05 · 方案已出，代码未动）
> 上级稿：[`live-pipeline-acceptance-defects-assessment.md`](../product/live-pipeline-acceptance-defects-assessment.md) §D17（`:761`）
> 所属线：[`upstream-version-and-derived-invalidation-design.md`](upstream-version-and-derived-invalidation-design.md)（该稿状态「已落地」，本稿是它的收尾补丁，不重做期 1–3）
> 触发：2026-11-02 实测「提交 1 章大纲 ⇒ 同步页列 7 项待处置，每行理由都是『改动章未知』」

---

## 0. 一句话结论

失效**判定链已经完整**，缺的只是写入侧的一个入参：`commitSynopsis` 拿不到「本次写进大纲的是哪几章」，于是 `changed_chapters` 恒为空集，判定侧按既有不变量把它当「全改」。

**本稿只做一件事：让生成路径把范围交出去。** 不加列、不加表、不动判定不变量、不改呈现组件。

---

## 1. 问题精确定位（代码级，2026-11-05 核对）

### 1.1 唯一写入点

```
architecture.command.ts:3742 / :4058
  └─ commitSynopsisWithCheckpointRollback()      ← 生成落盘唯一出口（含中断）
       └─ ipc 'db:project-core-synopsis-commit'
            └─ ProjectCoreRepository.commitSynopsis()          :270
                 └─ UpstreamRevisionRepository.bump({           :315-317
                      changedChapters: authorRecovery ? expand(committedRange) : []
                    })
```

`authorRecovery` 只在「作者手改大纲」路径上有值（`main-generation-owner.ts:797` 的 `commitPlotOutlineAuthorEdit` 会强制校验它存在）。**两条 AI 生成路径（正常完成、中断落盘）一律落到 `: []`。**

### 1.2 判定侧怎么用这个空集

```ts
// upstream-revisions.ts:651 changedChaptersBetween
if (!sawEntry) return null          // 该 rev 段没记录 ⇒ 无法收窄
return chapters.size === 0 ? null : [...]   // 记录了但空 ⇒ 同样 null
```

`null` 在 `derivedStatusForChapters`（`:749`）里走「按全改算」⇒ 每一行的派生都判 stale。

**这条约定不能动**（`:714` 不变量 1）：空集若当「什么都没改」，整本重生成之后全部派生会判 valid —— 那是本设计里最危险的漏判。所以修法只能是**让写入侧不再交空集**，不是改判定的读法。

### 1.3 为什么「只改了第 10 章」这件事现在无处可说

`ProjectCoreSynopsisCommitRequest`（`project-core-repository.ts:98`）只有四个字段：

```ts
synopsis: string
expected: ProjectCoreSynopsisExpected
generationRunHandle?: MainGenerationRunHandle
authorRecovery?: PlotOutlineAuthorEdit
```

**没有范围字段。** 而范围其实一直都在手边 —— 检查点里有：

| 字段 | 位置 | 语义 |
|---|---|---|
| `partial.synopsis_range = { from, to }` | `architecture.command.ts:3683`（完成）/ `:4023`（中断） | 本批覆盖的章区间 |
| `partial.synopsis_covered_to` | 同上 | 写完的最后一章 |
| `partial.synopsis_incomplete` | 同上 | 是否是中断落盘 |

`commitSynopsisWithCheckpointRollback` 的入参里已经有 `previousPartial` 与 `writtenPartial` —— **算范围所需的全部材料都在这个函数里，不用往上追任何东西。**

---

## 2. 已有地基：②「区分不知道与全改」不需要新代码

缺陷稿 ② 的诉求是「判定侧至少能把『不知道』与『全改』分开呈现」。核对后确认**这层已经建好了**，只是写入侧没喂它：

| 层 | 机制 | 现状 |
|---|---|---|
| 存储 | `upstream_revision_log.covers_all` 独立成列 | M27 已建，注释写明「空数组兼表达会被读成『一章没改』，两个相反的意思不能共用一个值」 |
| 折入 | `mergeRevisionLogIntoChangedChapters:627` 把 `coversAll` 挂进 `meta` | 已实现 |
| 文案 | `describeRevisionChange:360` 三分：`改动了全部章节` / `改过第N章` / `改动章未知` | 已实现 |
| 判定 | `derivedStatusForChapters:749` | 已实现，本稿不动 |

也就是说 **D17 的 ② 实际是「让 `coversAll` 说实话」的一个副作用**，不是一项独立工程。这一点如果不先讲清，很容易被做成「再加一层文案」，那会和既有三分打架。

---

## 3. 方案

### 3.1 请求加一个可选字段

```ts
export interface ProjectCoreSynopsisCommitRequest {
  synopsis: string
  expected: ProjectCoreSynopsisExpected
  generationRunHandle?: MainGenerationRunHandle
  authorRecovery?: PlotOutlineAuthorEdit
  /**
   * 本次提交实际写进大纲的章区间（生成路径专用）。
   *
   * 与 `expected.totalChapters` 无关：那是全书计划，这是「这一次动了几章」。
   * 缺省 = 不知道 —— 沿用「空集 = 按全改算」的既有约定，不新增第三态。
   */
  writtenRange?: { from: number; to: number }
}
```

**为什么是「写进」而不是「本批计划」**：`synopsisRange`（请求参数）是计划范围，模型可能少写（`backfillUnitBatch` 回填的就是实际值）；`synopsis_range` 在完成路径被重算成**实际范围**（`to = backfill.to`）。要报给判定侧的是后者。

**为什么不加 `coversAll` 之类的开关**：见 §4 第 1 条 —— 全书用 `[1..N]` 展开就够，判定与文案都准确，不需要 `mode: 'replace'`。

### 3.2 `commitSynopsis` 的取用规则（三行）

```ts
UpstreamRevisionRepository.bump({
  domain: 'outline',
  changedChapters: request.authorRecovery
    ? expandChapterRange(request.authorRecovery.committedRange)   // 现状不变
    : expandChapterRange(request.writtenRange),                    // 新增
  reason: request.generationRunHandle ? 'regenerate' : 'author-edit',
}, db)
```

`expandChapterRange`（`upstream-revisions.ts:431`）对 `undefined` / 倒置区间返回 `[]` ⇒ **不传时行为与今天完全一致**，天然向后兼容。

### 3.3 调用方怎么算这个范围

在 `commitSynopsisWithCheckpointRollback` 里算（它是唯一出口，两个入口自动共用）：

```ts
function outlineWrittenRange(
  previous: PartialArchData,
  written: PartialArchData,
  totalChapters: number,
): { from: number; to: number } | undefined {
  // 中断落盘：一句新章都没算完成（`covered_to` 被刻意压回 `from - 1`），
  // 正文里可能有半章内容但没过覆盖校验 ⇒ 不声称「只改了这些章」。
  if (written.synopsis_incomplete === true) return undefined
  const range = written.synopsis_range
  if (!range) return undefined
  const previousCoveredTo = previous.synopsis_covered_to ?? 0
  const coveredTo = written.synopsis_covered_to ?? range.to
  // 覆盖范围收缩 ⇒ 后面的章被删掉了（作废前 N 章重规划、或本批写到的章比之前更少）。
  // 这些章不在 `[from, to]` 里，但它们的内容确实没了，必须一起标脏。
  if (coveredTo < previousCoveredTo) {
    return { from: 1, to: Math.max(previousCoveredTo, totalChapters) }
  }
  return { from: range.from, to: range.to }
}
```

四条规则一览：

| 情形 | 传入 | 判定效果 | 文案 |
|---|---|---|---|
| 单元批 / 章区间批正常完成 | `{from, to}`（实际） | 只标脏该区间内的派生 | `改过第10章` |
| 写超全书末（`to > totalChapters`） | `{from, to}` 原样 | 同左 | 同左 |
| 覆盖范围收缩（重规划 / 回退） | `{1, max(previousCoveredTo, totalChapters)}` | 全区间标脏（保守） | `改过第1–30章` |
| 中断落盘 | `undefined` | 按全改（保守） | `改动章未知` |

**为什么中断不声称范围**：中断时 `renderSynopsisDbText` 写进去的是「前缀 + 半截新内容 + 未完成标记」，`covered_to` 被刻意压回 `from - 1`。这时「哪几章的正文算变了」没有可信答案，宁可多判脏。中断后本来就要人工续写一版，多标一次的成本远低于「漏判导致蓝图基于旧大纲」。

**为什么收缩要给到 `previousCoveredTo`**：`from=1` 作废重规划时，DB 正文只剩新写的 1–3 章 + 尾部概览，第 4–10 章的内容**被删了**。只传 `[1,2,3]` 会让第 4–10 章的蓝图判 valid —— 而它依赖的大纲章节已经不存在。

### 3.4 `scope` 保持 `'book'`

`commitSynopsis` 现在固定写 `outline:book`，本稿不动。

理由：改 `scope` 会让每一行派生的 `source_ref` 键从 `outline:book` 变成 `outline:<unitId>`，那是**存量数据的键迁移**，影响面远大于收益 —— 按章收窄靠 `changed_chapters` 已经够用（`derivedStatusForChapters` 就是干这个的）。`project-core-repository.ts:309` 那句「单元级（`outline:<unitId>`）由 E3 逐单元生成落盘时另记，期 2 接」应改为「已评估、不采纳」，见 §4。

---

## 4. 明确不采纳的三条

| 方案 | 不采纳的理由 |
|---|---|
| **① 用 `mode: 'replace'`** | `replace` 的语义是「整列清空」，只在**没有流水表的老库**上才写 `changed_chapters` 列（`bump` 里 `logOnly` 分支）；有流水表时它只影响 `covers_all` 标记。而传全书章集 `[1..N]` 在判定上与 `replace` 等价、在文案上更准（`改过第1–30章` 比 `改动了全部章节` 更可信 —— 后者在 `totalChapters` 变更时会说错）。多一个模式不如少一个。 |
| **② 单元级 `outline:<unitId>` 作用域** | 会让派生 `source_ref` 的键形态变化 ⇒ 存量库要么迁移要么双读。D17 的症状是「按章收窄失效」，`changed_chapters` 修好后症状消失，换键没有额外收益。**记为新卡再做**，不塞进这条。 |
| **③ 回填历史 7 条空集记录** | 那 7 条是 11-02 01:12 那批的已落库流水，真实范围**当时就没记**，任何回填都是编造。它们的实际影响会**自然衰减**：`changedChaptersBetween` 只取 `(have, need]` 这一段，只要区间里有一版记了章集就能收窄；只有「依赖行的 `have` 与 `need` 之间恰好全是历史空集版本」时才退化。下一次生成之后就不会再碰到。 |

---

## 5. 边界与不变量（改之前先读）

| # | 不变量 | 本稿是否触碰 |
|---|---|---|
| 1 | 空章集 = 覆盖全部章（`upstream-revisions.ts:714`） | **不动**。不传 `writtenRange` 时仍走空集。 |
| 2 | `have > need` 一律算脏，不看章集 | 不动（`derivedStatusForChapters` 未改） |
| 3 | 缺键 = 覆盖全部章 | 不动 |
| 4 | 非 `outline` 域恒覆盖全部章 | 不动 |
| 5 | `synopsisInputsFingerprint` 不含请求字段 | 不动 —— `writtenRange` **不进恢复指纹**，否则「续跑时传不传」会让旧检查点被判 `AUTHOR_INPUT_CHANGED` |
| 6 | `toWriterChapterInfo` / `PROJECT_CORE_NON_CONTENT_COLUMNS` / `VERSION_BOOKKEEPING_COLUMNS` | 全部不涉及（不加 `project_core` 列，只加内存请求字段） |

另有一条必须写进注释的坑：**`partial.synopsis_range` 在完成路径是「实际范围」，在中断路径是「计划范围」**。两者语义不同却同名，`outlineWrittenRange` 必须先判 `synopsis_incomplete` 再用它 —— 顺序反了会把计划范围当成实际范围报上去。

---

## 6. 改动清单

| 文件 | 改动 | 规模 |
|---|---|---|
| `electron/repositories/project-core-repository.ts` | 请求类型加 `writtenRange?`（`:98`）；`bump` 的 `changedChapters` 加一条分支（`:315`） | ~10 行 |
| `src/services/workflows/commands/architecture.command.ts` | 新增 `outlineWrittenRange()`；`commitSynopsisWithCheckpointRollback` 调用时传入（`:3948`） | ~25 行 |
| `electron/repositories/__tests__/project-core-repository.test.ts`（若无则新建） | 4 条写入断言 | ~60 行 |
| `src/services/workflows/commands/__tests__/plot-outline-batch.command.test.ts` | 2 条：正常批传范围 / 中断批不传 | ~40 行 |
| 文档 | 缺陷稿 D17 状态、总设计稿 §4.1 补一句「写入侧已接」、`project-core-repository.ts:309` 的过期承诺 | — |

**IPC 层不用改**：`ipc-channels.ts:979` 只引用类型，字段随类型走。

---

## 7. 验证

### 7.1 单测（提交前必须全绿）

1. `commitSynopsis({ writtenRange: {from:10,to:10} })` ⇒ 流水 `changed_chapters='[10]'`、`covers_all=0`
2. `commitSynopsis({})`（不传范围）⇒ `changed_chapters='[]'`、`covers_all=0` —— **行为与今天逐字一致**
3. `commitSynopsis({ authorRecovery, writtenRange })` ⇒ 以 `authorRecovery.committedRange` 为准（两者不可能同时出现，但要锁住优先级）
4. 收缩：`previous.covered_to=10`、`written={range:{1,3}, covered_to:3}` ⇒ 传 `{1, 10}`

### 7.2 链路单测（判定的收益要能看见）

合成一个 rev 序列：`outline` rev 6→7 只改第 10 章，第 7 章蓝图 `source_ref.outline:book=6`、第 10 章蓝图 `=6`、第 2 卷交接单（7–10）`=6`。

期望：第 7 章蓝图 `valid`、第 10 章蓝图 `stale`、交接单 `stale`（它覆盖 7–10，含 10）。
**这条用例是 D17 真正的验收标准** —— 修完之前它跑出来是三条全 stale。

### 7.3 实机判据

跑一次单元批大纲生成，然后开「同步」页：

| 修前 | 修后期望 |
|---|---|
| 提交 1 章 ⇒ 列 7 项，理由全是「改动章未知」 | 提交 1 章 ⇒ 只列**该章**的派生；无关章不出现 |
| 每行写「情节大纲 第6版→第7版（…改动章未知）」 | 写「（第7版 11-05 20:xx 重新生成，改过第10章）」 |

---

## 8. 风险与回退

| 风险 | 判断 |
|---|---|
| 范围算错 ⇒ **漏判**（该脏的没脏） | 唯一入口是 `outlineWrittenRange`，四条规则覆盖了「正常 / 写超 / 收缩 / 中断」，最后一条一律退回保守。收缩分支刻意多标，方向只会多判脏。 |
| `expandedChapterRange` 在 300 章时体积 | 每版最多 300 个整数 ≈ 1.2KB；`upstream_revision_log` 不设上限，可接受。 |
| 存量库已在空集状态 | 不回填，靠 `(have, need]` 自然衰减（§4 第 3 条）。 |
| 回退 | 单字段 + 单分支，删掉 `writtenRange` 即回到今天的行为，无数据迁移。 |

---

## 9. 需要作者拍板的三点

1. **收缩按 `[1, max(previousCoveredTo, totalChapters)]` 算**（当前方案）—— 比「按全书 `[1..totalChapters]`」更准，但仍保守。也可以选择精确到「被删的那几章」单独列出（收益小、多一条规则）。
2. **中断落盘保持「改动章未知」**（当前方案）—— 不为了美观去猜半截内容算不算改了。
3. **要不要顺手把 `outline:<unitId>` 单元级作用域开成一张新卡**（本稿只标注「已评估、不采纳」，不改代码）。
