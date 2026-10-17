# P1-1 实施设计稿：后续计划降级为「本章不可写事件」清单（`toBoundaryNotice`）

> **上级设计**：`docs/design/prompt/prompt-payload-scoping-design.md` §7 表（P1-1 行）+ **附录 B**（`toBoundaryNotice` 派生机制）。
> 本文是 P1-1 的**实施级**设计稿（本项目惯例：改模型可见载荷前先出小设计稿，经作者过目再编码）。
> 状态：**✅ 已实施**（D1 = 方案 A 首句截断 · D2/D3 = 不做 · D4 = 80 字上限）。实施记录见 §10。

---

## 0. 一句话

把正文/续写请求里的【后续计划边界】块，从「ch(n+1)…ch(n+5) 的 `key_events` **全文散文**」（实机 **1,598 字**）降级为「按章分组的**不可写事件要点**清单」（实测 **~270–450 字**），直接消除「续写越界下一章」。

---

## 1. 现状取证（2026-10-15，实机 trace，非推断）

**证据源**：`C:\develop\workspace\AI-writer\每天第一句谎话都会成真\debug\prompt-trace\20261015-204555-979-正文-ch1-9256c6c0.json`

- 该 run 有 2 次 IO：`chapter-draft-short-outline`（user 1,200 字）+ `chapter-draft`（system 563 / **user 15,341**）。
- 边界块位于 **`ioCalls[1].messages[1].content`**（即 `chapter-draft` 的 user 消息），索引 **2,838 → 4,436**，**块体量 1,598 字 = user 的 10.4%**。

**块构成（逐行实测）**

| 行 | 字数 | 内容 |
|---|---|---|
| 标题 | 24 | `【后续计划边界（只约束当前章，不是当前章任务）】` |
| 说明 | 70 | 「以下保留作者后续计划原文，只用于防止本章提前执行。明确安排在后续章节的知情变化、物品转交、行动和完成状态不得前移；允许不改变这些时点的铺垫。」 |
| 第2章 | **289** | `第2章 升职第一天，我连工位在哪都不知道：陈默拿着调令回云创大厦，失效的门禁卡竟恢复权限，…` |
| 第3章 | 227 | 同上形态 |
| 第4章 | 311 | 同上形态 |
| 第5章 | **351** | 同上形态（单章最长） |
| 第6章 | 100 + 69 + 80 + 66 | ch6 有 **4 条** `keyEvents`（`keyEventsText` 用 `\n` 连接，只有首条带 `第N章 title：` 前缀，后续 3 条裸行） |

> 合计：**5 章 / 8 条事件 / 1,468 字正文散文**（+130 字标题与说明）。第 5 章 351 字**逐字下沉** —— 正是 §4.1「逐字下沉」最清晰的实例。

**载体链路（真实落点，行号已按当前 HEAD 校正）**

```
generate-draft.command.ts:723-740   futureBlueprintsStr = 过滤 n+1..n+5 的蓝图，
                                    map(b => `第${n}章 ${title}：${keyEventsText(keyEvents)}`).join('\n')
generate-draft.command.ts:898      assembleChapterMaterials({ futurePlans: futureBlueprintsStr, … })
chapter-materials.ts:522           required 块肉进：
                                    `【作者资料…】…\n\n【后续计划边界（…）】\n<说明>\n${input.futurePlans}`
```

**两条边界条件（必须守住）**

1. **短细纲不给**：P0-1 已裁定「后续计划边界不给」（`draft-short-outline.ts:15`；`draft-short-outline.test.ts:18` 把它列为**禁词**）。⇒ **本项只动正文/续写链，短细纲路径逐字不变**。
2. **结构化 `keyEvents` 已就位**（B-4 段一/阶段 2 已落地）：`BlueprintKeyEvent = { id; event; estimatedUnits }`，`normalizeKeyEvents` / `keyEventsText` 是唯一归一化入口（`src/shared/blueprint-key-events.ts`）。⇒ 可**逐条枚举**，不必再做「首句切分猜条数」。

---

## 2. 目标 / 非目标

**目标**
- 把后续计划从「可写素材」重新定性为「**禁写边界**」：模型只应知道「这些事**别在**本章做」，而不是「这些事长什么样」。
- 体量降到 ~1/4 以下（实测目标 ≤ 450 字，见 §5）。
- **零 schema / 零迁移 / 零新注入点**：只改既有块的内容与措辞。

**非目标（本项不做）**
- ❌ 不做 NER / 语义判断（「这个物件属不属于第2章」）—— 归属**由蓝图自身的章节编号保证**（附录 B）。
- ❌ 不改停止点判据（那是附录 C / 附录 F 的事，`keyEvents` 结构化已为其铺路）。
- ❌ 不给短细纲加任何东西（P0-1 边界不动）。
- ❌ 不引入模型调用（红线：不许让模型自报/自生成边界）。

---

## 3. 契约

新增**零依赖**模块 `src/shared/chapter-boundary.ts`（与 `blueprint-key-events.ts` / `synopsis-projection.ts` / `text-scope-tags.ts` 同层同风格：纯函数、不抛错、不写库）。

```ts
import type { BlueprintKeyEvent } from './blueprint-key-events'
import type { WritingLanguage } from './writing-language'

/** 一章后续蓝图（调用方已按 n+1..n+N 过滤并升序）。 */
export interface BoundaryChapter {
  chapterNumber: number
  title: string
  keyEvents: readonly BlueprintKeyEvent[] | string | null | undefined
}

export interface BoundaryNoticeInput {
  /** 后续章节，已按章号升序。无可列内容 ⇒ 返回空串（调用方据此保留兜底文案，见下方偏离 1）。 */
  chapters: readonly BoundaryChapter[]
  /** ⛔ 未实施：伏笔窗口项（§8-D2 裁定「暂不做」，故实现中不存在该字段）。 */
}

/** 生成边界清单正文（**不含**标题与说明——那两块留在 chapter-materials.ts）。 */
export function toBoundaryNotice(language: WritingLanguage, input: BoundaryNoticeInput): string
```

> **实施期偏离 1（重要）**：本函数对空输入返回空串，但**整块并不因此省略**。原因是**核心合同按名引用了该标题**——`【本章写作方向与核心任务】和【后续计划边界】不因此成为已发生事件`（见 `prompt-language.ts` 的执行合同，及 `generate-draft.command.test.ts` 里 `presentHeadings` 的「引用的标题必须真实存在」断言）。省略块会让合同指向一个不存在的标题。故 `generate-draft` 在空串时回落到「（无后续蓝图）」，块恒在。

**为什么正文与标题分开**：`chapter-materials.ts` 的那个 required 块同时承载（作者资料 / 角色档案 / 后续计划）三段，标题与说明是其既有结构的一部分。`toBoundaryNotice` 只负责**清单正文**，最小化改动面与测试面。

---

## 4. 提取规则（机械三件，附录 B）

1. **章节归属**：按 `chapterNumber` 分组（过滤已在调用方 `n+1..n+5` 完成，本模块不再判）。
2. **每条事件截断**：`normalizeKeyEvents(...)` 逐条取 `event`，按 §8-D4 的截断规则压成短标签。
3. **术语/道具命中标注**：⚠️ **本项不建议做**（需解析 `architecture` 术语表，且「命中」仍属弱语义）。**§8-D3 默认不做**。

**终止标点集（实施中补全）**：中文用 `。！？；`；英文用半角 `.!?;`，**且必须后跟空白或行尾** —— 否则 `3.5` / `v1.2` / 网址会被误切。这一条是写测试时才暴露的缺口：原设计只写了中文标点，英文句号不在集合内 ⇒ en 项目会退化成纯 80 字硬截（不再是「首句」）。`Mr. Smith` 这类缩写仍会被切，但边界标签只需示出「从哪件事开始」，代价可接受。

**不做**：不推断「这条事件属不属于本章」；不改写、不合并、不排序（顺序 = 蓝图给定顺序）。

---

## 5. 输出形态（实测数字）

**方案 A（推荐）· 首句截断**（到首个 `。！？；` 为止，上限 80 字）

```
- 第2章《升职第一天，我连工位在哪都不知道》：陈默拿着调令回云创大厦，失效的门禁卡竟恢复权限，HR领他到18楼运营中心，工位牌是新的，同事却都说他'早就调过来了'。
- 第3章《我三个月前就入职了？》：陈默拿着早三个月的入职表去人社局打社保记录，想证明HR填错。
- 第4章《谁在查我》：陈默赶回云创大厦问HR调档人长什么样，HR只说对方持正规手续、留了签名，签名栏写着'林恪'，备注'金元资本风控外聘'。
- 第5章《我妈的蛋糕，我编的》：陈默连夜翻手机相册找去年生日那顿饭的证据，两年记录里只有前年、大前年的合影，去年那格是空的。
- 第6章《我今天第一句话，说给了调查员听》：
  - 陈默照禁语清单全天沉默，只用手机打字。
  - 王浩密报：林恪昨天调走的是陈默'三个月前入职'材料的原始签署页，今天会去人才服务中心。
  - 人才中心负一层，林恪首次当面追问陈默去年十月是否请假。
  - 林恪掏出手机展示'三个月前'的部门合影，陈默确实在其中却认不出身旁同事。
```
**实测（实施后按最终规则复算）**：正文 **437 字**（5 个章标题 + 8 条要点 + 项目符号；纯事件文本 319 字）＋标题 24 ＋说明 ≈92 ⇒ 整块 **555 字** = 原 1,598 的 **35%**，**省 65%**；占 user 消息由 **10.4% → 3.6%**。

**方案 B（附录 B 字面）· 首逗截断**（到首个 `，、。！？；` 为止）

```
- 第2章《升职第一天，我连工位在哪都不知道》：陈默拿着调令回云创大厦
- 第3章《我三个月前就入职了？》：陈默拿着早三个月的入职表去人社局打社保记录
- 第4章《谁在查我》：陈默赶回云创大厦问HR调档人长什么样
- 第5章《我妈的蛋糕，我编的》：陈默连夜翻手机相册找去年生日那顿饭的证据
- 第6章《我今天第一句话，说给了调查员听》：陈默照禁语清单全天沉默 / 王浩密报：林恪昨天调走的是… / 人才中心负一层 / 林恪掏出手机展示…的部门合影
```
**实测：正文 138 字**（整块 ≈ 370 字 = 原 **23%**，省 **~77%**）

> ⚠️ 方案 B 的短板实测可见：ch6 第 3 条被截成「人才中心负一层」（**是地点、不是动作**），边界性变弱。方案 A 更稳，代价是多 ~180 字。

**取舍建议**：**A**。理由：本项目的是「防止提前执行」，标签必须**看得出不许做什么**；A 仍砍掉 66%，收益已经兑现，而 B 的误截（地名/半句）会让模型无法判断边界。若作者更看重体量，取 B。

---

## 6. 受影响的既有测试（必须同步，否则红）

| 文件 | 位置 | 现断言 | 处置（已做） |
|---|---|---|---|
| `src/services/workflows/__tests__/chapter-materials.test.ts` | ~55 | 用例名「keeps … future plans **verbatim**」+ 三个期望串 | 用例名改为「marks … as a not-yet-written boundary (not verbatim material)」；`expectedTiming` / `expectedForeshadowing` **逐字不变**；新增 `expectedBoundaryRole`（新说明句中段）+ **负向** `expectedStalePromise`（不再含「保留作者后续计划原文」/「preserved verbatim below」） |
| `src/services/workflows/commands/__tests__/generate-draft.command.test.ts` | ~2273 | 用例名「dispatches all five long future plans…」+ `futurePlans` 字节数 `>24_000` + `prompt` 含 5 条 `keyEvents` 全文 | 用例名改「compresses five long future plans into per-chapter boundary labels…」；`futurePlans` 改 `<2_000` 字节且不含 `TAIL_TIMING_`；逐章断言 `第N章《title》` 存在、**事件全文不存在**；必需材料的体量改由 `coreOutline` 承担（否则可选来源不再被挤掉） |
| 同上 | ~4616 | `expect(prompt).toContain('第2章 蓝门回声：追查蓝色漆屑与撞击声')` | 改为新形态 `- 第2章《蓝门回声》：追查蓝色漆屑与撞击声` |
| `src/services/workflows/__tests__/context-entry-parity.test.ts` | ~63 / ~85 | 两处**定色 sha256**（「组合后的 prompt 不得变化」） | **必须改哈希**——本项**故意**改了说明措辞。已更新两值并在文件头注释里留痕（沿用该文件既有的「哈希变更史」惯例） |
| 同上 | ~1454 | `user` 含 `【后续计划边界（只约束当前章，不是当前章任务）】` | **不动**（标题逐字保留） |
| 同上 | ~2510/2512 | `presentHeadings` 含 `【后续计划边界` | **不动**（块恒在，见 §3 偏离 1） |
| 同上 | ~4550 | `(no future chapter blueprints)` 兜底文案 | **不动**（空串时回落该文案） |
| `src/shared/__tests__/draft-short-outline.test.ts` | ~18 | 边界块是短细纲**禁词** | **不动**（P0-1 边界） |
| 新增 | — | `src/shared/__tests__/chapter-boundary.test.ts` | 12 例，见 §9 |

---

## 7. 标题与说明的措辞（改后）

现说明写「**以下保留作者后续计划原文**」——降级后**不再是原文**，该句必须改，否则是**对模型的虚假承诺**（同类判据：⑦ 规格 ≠ 形式）。

建议（zh）：
```
【后续计划边界（只约束当前章，不是当前章任务）】
以下只列后续章节的事件要点，用于防止本章提前执行；它是禁写边界，不是本章任务，也不是事件全文。
明确安排在后续章节的知情变化、物品转交、行动和完成状态不得前移；允许不改变这些时点的铺垫。
```
（en 对称；`expectedTiming` / `expectedForeshadowing` 两串**保留逐字不变**，只改中间那句。）

标题 `【后续计划边界（只约束当前章，不是当前章任务）】` **逐字不变**（减少测试面）。

---

## 8. 待作者裁定（4 项）

| # | 项 | 选项 | 建议 |
|---|---|---|---|
| **D1** | 压缩粒度 | A 首句截断 / B 首逗截断 / C 仅章标题 | **A**（§5） |
| **D2** | 是否加第二栏「本章可埋点但不得兑现（伏笔窗口在本章）」 | 要（接 `narrative_thread_plans`，范围+）/ **暂不做** | **暂不做**：第一栏已兑现 P1-1 收益；第二栏要新读台账 + 新判据（窗口与本章相交），宜另立小项 |
| **D3** | 是否做「术语/道具命中标注」 | 要 / **不做** | **不做**（YAGNI；命中仍属弱语义，且需解析 `architecture` 术语表） |
| **D4** | 截断上限 | 无上限 / 80 字 | **80 字**（防极端长句） |

**作者裁定（2026-10-15）：D1 = 方案 A · D2 = 采纳建议（暂不做）· D3 = 采纳建议（不做）· D4 = 采纳建议（80 字）。** 已按此实施。

---

## 9. 验收（实施后必跑）

1. `chapter-boundary.test.ts` 新增用例：分组 / 多事件逐条 / 空数组 ⇒ 空串 / 单条超长截断 / 中英对称 / **不得回退为全文**（负向：压缩后长度 < 原文长度）。
2. `chapter-materials.test.ts`：改后的说明串通过；块仍属 required（不参与预算裁剪）。
3. `generate-draft.command.test.ts`：**新增一条实机口径断言** —— 正文 user 消息里的边界块**不含**后续章的长句原文（用「原文金句」做负向断言）。
4. 端到端体量取证：跑一章（第 2 章及以后，使 `n+1..n+5` 非空），从 trace 读块体量，记录到本文 §10。
5. `tsc` 0；node workflows / shared 分批跑绿（⚠️ 不分批会触发沙箱 safe-delete 阈值，见记忆「环境」段）。

---

## 10. 实施记录

**落点**

| 文件 | 变更 |
|---|---|
| `src/shared/chapter-boundary.ts` | **新增**（`toBoundaryNotice` / `BOUNDARY_EVENT_MAX_CHARS`） |
| `src/services/workflows/commands/generate-draft.command.ts` | `futureBlueprintsStr` 改由 `toBoundaryNotice` 生成（替换原先的 `第N章 title：keyEventsText()` 逐字拼接）；空串回落「无后续蓝图」 |
| `src/services/workflows/chapter-materials.ts` | 说明句**中段**重写（去掉「保留作者后续计划原文」的虚假承诺）；标题与后两句逐字不变 |
| `src/shared/__tests__/chapter-boundary.test.ts` | **新增** 12 例 |
| `src/services/workflows/__tests__/chapter-materials.test.ts` | 用例名 + `expectedBoundaryRole` + 负向断言 |
| `src/services/workflows/commands/__tests__/generate-draft.command.test.ts` | 压缩用例重写 + 标签格式断言 |
| `src/services/workflows/__tests__/context-entry-parity.test.ts` | 两处定色 sha256 更新 + 哈希变更史注释 |

**体量前后（实机 trace 复算，同源同 run）**

- 源：`每天第一句谎话都会成真/debug/prompt-trace/20261015-204555-979-正文-ch1-9256c6c0.json`
- 原块 **1,598 字**（占 user 15,341 的 **10.4%**）→ 新整块 **555 字**（标题 24 + 说明 ≈92 + 正文 437）＝ **35%**，**省 65%**；占 user **3.6%**。
- 逐章产出见 §5（5 章 / 8 条要点；ch5 由 351 字 → 48 字；ch6 由 4 条长段 → 4 条短要点）。

**验证读数（本机实跑）**

| 面 | 结果 |
|---|---|
| 三个目标文件 | 285 通过 |
| `src/shared` | 39 文件 / **625 通过** |
| `src/services/workflows` | 50 文件 / **1121 通过** |
| `src/services/__tests__` | 39 文件 / **417 通过** |
| 浏览器全量 | 89 文件 / **635 通过** |
| `tsc --noEmit` | **0** |

**遗留**：本项只做「少给素材」，**不提供强制门禁**（模型若仍写出后续章事件，护栏在附录 C）。实机复验（真跑一章带后续蓝图的正文、从 trace 读块体量）随「段二实机验证」同批待决——见交接文档 §2.5。

---

## 11. 风险与红线

- **红线 1（schema 指纹）**：本项**零 DDL**，不动 `sqlite_master`。
- **红线 16（改内置 required 穿透覆盖版）**：本项**不动 `requiredContextVariables`**，只改块内容 ⇒ 不触发穿透。
- **红线 3（模板生效来源）**：本项**不动任何模板**（边界块由代码拼装，非模板变量 `{{future_blueprints}}`；后者实测为空，见 §7.0.2-R1）⇒ 无需比对覆盖版。
- **风险**：若模型真在 ch1 写出了 ch2 事件，**本项不提供新增护栏**（停止点判据仍属附录 C）。本项只做「少给素材」，不做「强制门禁」。
