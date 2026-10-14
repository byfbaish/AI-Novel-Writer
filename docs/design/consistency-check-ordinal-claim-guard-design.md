# 审稿「序数/全称断言独立复核」机制补强（设计记录）

> **状态**：**已实施**（2026-10-14）· 内置 zh + 内置 en + 作者全局覆盖版三处同步  
> **触发**：实机 trace 暴露审稿**漏检并主动判 `pass`**（详见 §1）  
> **性质**：**通用失效模式**修复（「拿断言当事实」），**不含任何题材规则**（不硬编码「第一句谎话」这类设定）  
> **改动面**：`consistency_check` 模板正文**各加 1 条检查维度**；数据/schema/契约**零改动**

---

## 0. 一句话

审稿会把**作者材料里的序数/全称断言**（「第一句」「唯一」「每次」「从来」）当**既定事实**去核对——只问「正文有没有这么写」，不问「这么写是否成立」，于是漏检并判 `pass`。  
本条补强的唯一目的：把这类断言**降格为待核查主张**，强制回正文**独立复核**。

---

## 1. 背景：审稿漏检的实体证据

审稿 prompt-trace（`国运怪谈直播/debug/prompt-trace/20261014-192749-932-审稿-a9142f51.md`）：

- **第 3 条 warning 抓到了**时间线问题（老陈记营业时段 7:00—9:00 vs 正文「下午两点多」到巷口）。→ 说明**材料是够的**，不是缺输入。
- **但同一份意见把「第一句谎话」判成了 `pass`**（`:1005`）：
  > ……早上七点的「刚升职，月薪五万」是主观明知的谎话，下午两点零七分成真，间隔七小时，符合……三条规则，**因果链成立，未发现断裂**。

  而正文里在这句**之前**还有：
  ```
  "早饭吃了没？" → "吃了。"
  ```
  按既有漏洞定义（判定看**说话人主观**是否认为自己在撒谎），「吃了」同样成立且更早。审稿**独独跳过了这两句**。
- 更关键的是**目标核对**那一项（`:1060`）打勾核的是「**正文有没有这么说**」，而不是「**这么说是否成立**」：
  > ……**挂断后自认是当天第一句谎话**✓

  这个断言直接抄自蓝图 `ch1:E1`：
  > 他习惯性糊弄「挺好的，刚升职，月薪五万」，**挂断才反应过来这是今天第一句话，而且是谎话**

---

## 2. 根因（可复用判据）

> **当作者材料（蓝图 `keyEvents` / 冻结目标 / 本章作者指导）对正文事实作出「序数类」或「全称类」断言（「第一句」「唯一一次」「每次都」「从来」）时，审稿会把它当成待核对的「断言」而不是「已成立的事实」——**
> **于是只核对「正文是否这么写」，不回到正文独立数一遍。**

要点：

1. **与「世界规则是否存在」无关。** 世界规则在 prompt 里是全量注入的（`【世界观设定】`），核查清单也写了「世界观规则……有无冲突」。**材料够，是推理路径错了。**
2. **两条核对路径不同**：「正文确实如此写了」≠「如此写确实成立」。作者材料是**规划**，不是**事实**（与蓝图前置章/情节大纲的优先级声明同源）。
3. **失配点可以更靠前**：断言谈「第一句」时，正文里可能还有更早的同类事件。审稿只看被点名的那个，就漏了。

---

## 3. 改法：三处落点（缺一不可）

红线 3：`project > global > builtin`，**全局覆盖版会静默遮蔽内置**。作者全局覆盖版里**恰好有** `consistency_check`，因此**只改内置等于白改**。

| # | 落点 | 字段 | 位置 |
|---|---|---|---|
| ① | 内置中文 | `content` → 【检查维度】新增第 **7** 条 | `src/services/builtin-prompt-templates.ts:1215` |
| ② | 内置英文 | `content` → `[Review dimensions]` 新增第 **7** 条 | `src/services/prompt-language.ts:603` |
| ③ | **作者全局覆盖版** | `content` → 【检查维度】新增第 **6** 条 | `~/.ai-novel-writer-dev/generations/88ac198e-…/prompts/consistency_check.zh-CN.json` |

**① 内置中文（逐字）**

```
7. 序数与全称断言：作者材料（蓝图关键事件、冻结目标、本章作者指导等）中出现的「第一句」「第一次」「唯一」「每次」「从来」等序数或全称断言，属待核查主张而非既定事实；必须在待审正文中独立复核其是否成立，不得采信断言本身，也不得以「正文确实如此写了」代替「如此写确实成立」。
```

**② 内置英文（逐字）**

```
7. Ordinal and universal claims: ordinal or universal claims in the author materials (blueprint key events, frozen goals, this chapter's author guidance, etc.), such as "the first", "the only", "every time" or "never", are claims to verify rather than established facts. Recheck each of them independently against the chapter under review; never accept the assertion itself as evidence, and never treat "the chapter does state it" as proof that "it holds".
```

**③ 作者覆盖版**：同 ① 的中文条文（其【检查维度】原为 5 条 → 新增第 6 条）。  
> 覆盖版是对**旧内置**的定制分支（维度命名是「剧情合理性 / 伏笔完整性」，与当前内置的「因果与动机 / 前情复述」不同），**必须按它自己的序号续编**。

**为什么不用硬编码题材规则**：本条只治「拿断言当事实」这一**通用失效模式**，不写「第一句谎话」这类具体规则，因此对任何题材、任何作者设定都成立。

**为什么只加一条、不加第二处**：同一变量在 `content` 与 `systemSuffix`/`taskGuidance` 各出现一次会**整段进 prompt 两遍**（红线 4）。本条置于 `content` 的检查维度即可，不重复投放。

---

## 4. 红线 3 取证（为什么覆盖版必须同步）

- 生效优先级：`promptCatalog.resolve` → `project > global > builtin`（`src/services/prompt-templates.ts:70`）。
- `getPromptSource(key)` 只返回 `'builtin' | 'global' | 'project'`（`src/services/prompt-templates.ts:78`），**判「改动是否生效」必须配合看真实覆盖目录**。
- 真实覆盖目录 = `promptsDirectory()` = `path.join(VELA_HOME, 'prompts')`（`electron/services/user-asset-paths.ts:35`）；
  `VELA_HOME` = 当前 generation 数据根（`electron/services/app-data-locator.ts:27`），dev 下由 `vite.config.ts:29` 的 `AI_NOVEL_APP_DATA_HOME ??= ~/.ai-novel-writer-dev` 推导。
- 实测该目录下有 **20 份** `*.zh-CN.json`，**含 `consistency_check.zh-CN.json`**（2026-10-12）。
- ⚠️ `~/.vela/prompts/` 是 **legacy 只读源**（迁移来源），**不是生效目录**（`src/services/prompt-templates.ts:25` 有明确注释）。

---

## 5. 备份与回滚

- **改动前整目录备份**：`generations/88ac198e-…/prompts-backup-20261014-2110/`（20 份，`consistency_check` 已逐字校验一致）。
- 回滚 = 用备份覆盖回 `prompts/`，或删除覆盖版（则退回内置，改用 ①）。
- 覆盖版写入方式：**子串替换**（不整体 `JSON.stringify` 重写），避免格式漂移；前后各 `JSON.parse` 校验一次；占位符集合实测未变（`chapter_content / character_states / global_summary / world_building`）。

---

## 6. 验收

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | 0 错 |
| `prompt-language-contract`（zh/en 变量集合一致性 + en 无中文） | 68/68 通过 |
| `prompt-local-qwen-contract` / `prompt-project-session` / `prompt-trace` | 同上（合计 68） |
| `refine-draft.command`（用内置模板造覆盖版的用例） | 通过 |
| `review-revision-runtime` / `review-revision-generation` | 90/90 通过 |
| 覆盖版 JSON 合法性与键序 | 保持（`key,name,description,systemRole,variables,content,writingLanguage,taskGuidance`） |

> 无测试锁定模板正文（语言合同只校验**变量集合**与「en 无中日韩字符」），因此新增纯文本条目不需要改动测试。

---

## 7. 未做的事 / 待作者裁定

**内容层（不动框架，属作者裁定）**

- **C1**：第 1 章要么让「吃了」当真成触发句，要么删掉更早的谎话，让「刚升职，月薪五万」名副其实。
- **C2**：「第一句话」的**粒度**——按**句子**算，还是按**一次完整发言**算？（若按句，「挺好的」会先触发。）
- **C3**：问题 1 的时间线——可选把时间挪到早上，或让老陈记营业时段本身有弹性（**不必改「第一顿算早饭」的叙述**）。

**机制层（本轮未做，视需要再开）**

- **M1**：是否也给 `审查原则` 加一条「断言不等于证据」的总纲（当前只在检查维度切入）。
- **M2**：`consistency_check` 覆盖版与内置已**结构性分叉**（维度命名不同）；是否借某次机会做一次覆盖版重基线（需作者决定是否保留其旧维度）。
