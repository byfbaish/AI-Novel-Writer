# 交接：P20-1a 能力候选 —— 实施完成报告

> 状态：**已交付**（2026-10-26 05:46）。分支 `exp/resource-ledger`，起点 `ab0bf97c`。
> 计划稿：`docs/handoffs/2026-10-26-p20-1a-ability-candidates-plan.md`（本文是它的**交付报告**，不是第二份规格）。
> 执行者：主 agent（原计划交 hy4 无人值守；本次由主 agent 直接执行，因上下文已就绪，无需再传递）。

---

## 1. 交付

| 段 | commit | 内容 |
|---|---|---|
| 计划稿 | `08080705` | 把计划稿挪进仓库 handoffs 目录（原在 `~/.workbuddy/plans/`，项目里不可见） |
| **T1** | `8bab6697` | 解析器 + 14 例单测 + 台账同步 |
| **T2** | `2a652f96` | 面板接线 + 4 例浏览器测试 |

- **T1 完成：是**　**T2 完成：是**（两段共耗时约 10 分钟，远低于计划的 150–190 分钟估算 —— 该估算按「hy4 从零读上下文」给，主 agent 接手时上下文已在手）。

**新增文件**
- `src/shared/worldbuilding-ability-extract.ts` —— 导出 6 个符号，与计划逐字一致（`AbilityCandidate` / `AbilityCandidateSet` / `MAX_ABILITY_CANDIDATES=12` / `extractAbilityCandidates` / `abilityCandidateToInput`，第 6 个是类型内联的 `evidenceScope` 字面量类型）。
- `src/shared/__tests__/worldbuilding-ability-extract.test.ts` —— 14 例。

**修改文件**
- `src/components/editor/AbilityRegistryEditor.tsx` —— 加了世界观读取：`db:project-core-get` → `worldbuilding`，监听 `ARCH_FILE_UPDATED` / `WORKFLOW_COMPLETE` 重读，`LatestRequestGate` 防迟到结果；**刻意不读** `partial_arch.json`。
- `src/components/editor/AbilityRegistryPanel.tsx` —— 新增 `worldbuilding` prop；按钮行之后插入候选区（勾选 → 采纳 → `db:abilities-upsert`）；已登记同名禁勾；三档空态；`dropped > 0` 底部小字。
- `src/components/editor/__tests__/AbilityRegistryPanel.browser.tsx` —— 保留 7 例**一字不动**，新增 4 例（共 11 例）；说明段「7 条」改成「11 条」并补了候选区验收口径。
- `docs/plans/prompt-assembly-backlog.md` —— P20-1 小节标「1a 已落地 2026-10-26」+ 追加落地说明四行（按计划只改这两处，未动排期总表，未建 `docs/design/` 文件）。

---

## 2. 验证输出

| 命令 | 结果 |
|---|---|
| `node scripts/run-tests-electron.mjs src/shared/__tests__/worldbuilding-ability-extract.test.ts` | **14 passed** |
| `node scripts/run-tests-electron.mjs src/shared/__tests__/worldbuilding-rules.test.ts` | **15 passed** |
| `npx vitest run --config vitest.browser.config.ts src/components/editor/__tests__/AbilityRegistryPanel.browser.tsx` | **11 passed**（7 原有 + 4 新增） |
| `npx tsc --noEmit` | **干净**（`noUnusedLocals` 开着，无未使用变量） |
| `node scripts/check-doc-links.mjs` | checked 971, **broken 0** |
| `node scripts/check-doc-placement.mjs` | 违规 33 / 基线内 33 / **新增 0** |

**额外回归（计划未要求，我自加的）**
- `src/shared/__tests__` 全量：**85 文件 / 1394 例 全绿**（确认没碰坏既有抽取）。
- `src/components/editor/__tests__` 浏览器全量：**29 文件 / 314 例，311 通过、3 失败**。
  3 例失败**是既有基线失败，与本次改动无关** —— 已在基线 commit `ab0bf97c` 上用临时 worktree
  对照跑过，失败清单**一字不差**（跑完即删 worktree，`git worktree list` 已恢复只有主 worktree）：

  | 文件 | 用例 |
  |---|---|
  | `CodeMirrorEditor-generation.browser.tsx` | 明确 handle 恢复原候选；文件改变=true 时只复制不替换 |
  | `ReviewReport.confirmation.browser.tsx` | shows cycle and finding states separately and persists only an explicit author waiver as v2 |
  | `ReviewReport.confirmation.browser.tsx` | 逐项目标展示完成证据，待核实不计通过且仅明确选择后纳入不可变确认 |

  ⇒ **别拿「浏览器测试全绿」当验收口径**，按 G5 那条规矩：只与基线失败集比对。

---

## 3. 与计划不符处

1. **计划说「git status --short 必须是空，不空就停手」** ⇒ 实际开工时工作树有 1 个未跟踪文件（`2026-10-26-p20-1a-ability-candidates-plan.md`，是我自己刚放进仓库的计划稿）。我把它单独提了一个 docs commit（`08080705`）后再开工，没有 stash / checkout。这是计划稿本身的存在导致的，不是残留改动。
2. **计划说「允许一次本地 commit（T1 一次、T2 一次，最多两次）」** ⇒ 实际三次，多出来的是上面那条计划稿提交。
3. **候选勾选状态用了 `readonly string[]`（名字数组）而不是计划暗示的 `Set`** —— 功能等价；用数组是为了让 `chosen` 能在 render 期直接算出来。计划没写死这个类型。
4. **没有加「worldbuilding 变化时清空勾选」的 effect** —— 因为 `chosen` 是从 `selectable ∩ selectedNames` 现算的，候选换了旧名字自动落选，不需要额外的 effect 同步。少一处状态同步就少一处能错的地方。
5. **commit 消息正文** 列的是「新增文件 / 面板改动 / 验证结果」，与计划要求的「新增文件、面板改动、验证结果」一致，但 T1/T2 各自的正文按实际情况分行写了，不是计划里那三行的字面副本。

**禁区 10 条：全部未触碰。** 没改 `power-ability.ts` / 仓储 / `ipc-channels.ts` / `db-controller.ts` / 迁移 / 任何 prompt 模板 / `worldbuilding-rules.ts` / `worldbuilding-completeness.ts`（只 import）；没新增 IPC、没建表、没调模型、没写 `partial_arch.json`、没排序、没截断、没 push。

---

## 4. 未做 / 受阻

- **P20-1 的 1b（LLM 补 `weakness`）**：按计划不在本期，未做。等作者裁定。
- **实机验证（A9–A12 / C1 / C2 / D2）**：仍是作者在 GUI 里跑的活。本次改动**新增了一个「能力」tab 上的候选区**，取 C2 基线时注意它不参与文风读数，但**能力登记页要重开一次**（改了 props，旧进程里是老代码）。
- **`resource_registry` 抽取、`validateItem` 零重试、`base-command.ts:383` trim-hash 第三处**：不在本期范围，仍挂着。
- **435MB 缓存** `.runtime/.cache/novel-quality-modernization/s05-owner-tests.stale-20261026`：未清理，等作者点头。

---

## 5. 明天验收怎么验（三步）

1. **看 diff**：`git show 8bab6697 --stat` 与 `git show 2a652f96 --stat`，确认没有夹带无关文件。
2. **跑这四条**（与 §2 同）：
   ```
   node scripts/run-tests-electron.mjs src/shared/__tests__/worldbuilding-ability-extract.test.ts
   npx vitest run --config vitest.browser.config.ts src/components/editor/__tests__/AbilityRegistryPanel.browser.tsx
   npx tsc --noEmit
   node scripts/check-doc-links.mjs
   ```
3. **GUI 上验一次**（真正的裁判）：打开一个已有世界观的项目 → 能力登记页 → 第 1 维那张四列等级表应该抽出候选 → 勾一条 → 点「采纳所选（1）」→ 下方表格应出现该行且「出处域 = 世界观、引文 = 整行原文」。
   **注意**：你的 `world_building` 全局覆盖版（N1 完整版）会**静默遮蔽**内置模板（判据 AO）—— 若覆盖版改了第 1 维标题文字，`dimensionFound` 会 false，候选区会显示「没识别到第 1 维…」。这不是 bug，是覆盖版没同步。

---

## 6. 需要作者裁定（不变，仍是这三条）

1. **P20-2 秘密宿体**：新表 `secrets`（建议）还是并入 M16 `knowledge_states`？
2. **第 4 维模板改不改**：「没有时段就**不要写这个字段**」→ 改成「没有时段写 `hours=none`」。撞 AO，改内置必须同步覆盖版。
3. **P20-1 要不要 1b**：只做确定性（1a）已可用，但 `weakness`（敌人能怎么破）抽不到。

**实现中发现的新歧义（追加，未自行拍板）**：候选的 `name` 直接取自等级表首列（如「练气一层」「筑基期」），而能力表的语义是「本书级能力规则」（金手指 / 体系漏洞 / 宝物权限）。**把境界名当能力名登记，语义上是挪作他用**。本期照计划做了（等级名进 `name`），但这件事值得你拍一下：是要它就叫「筑基期」，还是候选只作「提示」、由作者改成能力名再登记？

---

# 独立验收（2026-10-26 20:40，作者要求）

> 验收对象：`8bab6697`（T1）+ `2a652f96`（T2）。验收方式**不是复述 05:45 的自测**，
> 而是重跑全部命令 + 用对抗性探针找规格外行为 + 逐条比对计划文案。

## A. 验收判定：**实施合格，但计划规格有 2 个漏洞**

实施对计划的符合度是 100%：改动面 7 文件、禁区 10 条零触碰、导出符号 5 个（计划正文说「6 个」但自己只列了 5 个 —— 计划的笔误，按列出的 5 个实施）、六处 UI 文案逐字一致。

问题不在这份代码，在**计划本身没做对抗性思考**。下面两条都是「照计划做就会错」：

### 漏洞 1（严重）· 表格没有分隔行时，表头会被当成一条候选

计划 §2.2 第 6 条只写了「下一行匹配分隔行 ⇒ 当前行是表头」，**没写「没有分隔行怎么办」**。
markdown 表格的分隔行是可选的，模型漏写的概率不低。

探针实测（`### 1.` + 一行表头 + 一行数据，无分隔行）：

```
candidates = [ '等级名', '练气一层' ]      ← 表头进了候选
```

后果：作者会在候选区看到一条叫「等级名」的候选，勾选后 `db:abilities-upsert` 会登记一条
名为「等级名」的能力，硬限制=「相邻差距」、代价=「升级代价」。**这是往库里灌脏数据**，而界面上
它长得跟真候选一模一样。

**建议修法（推荐第 3 种）**：
1. 列名黑名单 —— 脆弱，覆盖版模板换个词就失效；
2. 强制要求分隔行存在 —— 会漏抽，与「模型常省略」的现实打架；
3. **按表格块的首行恒为表头**（markdown 语法事实，不是猜）：连续 `|` 行构成一个块，块内第一行跳过。
   这一条同时覆盖「有分隔行」「无分隔行」两种形态，且删掉现有第 6 条的脆弱依赖。

### 漏洞 2（中）· 五列表整表丢光，而界面说「没找到四列等级表」

计划 §2.2 第 8 条：`cells.length !== 4` ⇒ 跳过，**不计 dropped**。探针实测模型多写一列「备注」时：
候选 0 条、`dropped = 0`、界面显示「世界观第 1 维里没找到四列等级表」。

但源文本里**明明有一张表格**。这违反项目自己的判据（DN 同型）——「没抽到」不能说成「没有」。
`dropped = 0` 还让「已丢弃 N 条」那行小字根本不出现，作者没有任何线索。

**建议修法（推荐第 1 种）**：
1. 抽取行为不变（严格四列，不猜末列语义），**但把「有表格却列数不对」单独报出来**：
   空态文案改成「第 1 维里找到表格，但列数是 N（等级表需要 4 列：等级名｜相邻差距｜卡点｜升级代价）」；
2. 放宽为「≥4 列取第 1/3/4 列」—— 危险：5 列时末列是备注，`costNote` 会变成备注文字（计划自己把末列钉死为升级代价）。

## B. 重跑结果（20:45–20:48，工作树已从 sparse 恢复）

| 命令 | 结果 |
|---|---|
| `run-tests-electron.mjs` 新单测 + `worldbuilding-rules` | **29 passed**（14 + 15） |
| `vitest browser` `AbilityRegistryPanel.browser.tsx` | **11 passed** |
| `npx tsc --noEmit` | **exit 0** |
| `check-doc-links` | checked 971, broken 0 |
| `check-doc-placement` | 违规 33 / 基线内 33 / **新增 0** |
| 改动面 `git diff --stat ab0bf97c..2a652f96` | 7 文件（2 新增 / 5 修改），禁区文件 **0 命中** |

## C. ★ 环境事故：仓库在 19:10:45 被切成 sparse checkout（已修复）

**这一条比验收本身要紧。** 20:40 验收时发现 `scripts/` 整个目录不存在，`git status` 却报干净 ——
因为仓库当时处于 **sparse checkout，只有 2% 的跟踪文件在本地**（2049 个跟踪文件里只剩根目录那些）。

**证据链**
- `git status` 原文：`You are in a sparse checkout with 2% of tracked files present.`
- sparse 规则：`.git/info/sparse-checkout` = `/*` + `!/*/`（只留根目录文件，排除全部子目录）
- 配置落点：`.git/config.worktree` 的 `core.sparsecheckout=true` + `core.sparsecheckoutcone=true`
- **时间戳**：`.git/config`、`.git/config.worktree`、`.git/index`、`.git/info`、`.git/FETCH_HEAD`
  **全部是 2026-10-26 19:10:44–19:10:45**；`FETCH_HEAD` 内容为空（说明同时有一次 fetch）
- 项目里**没有任何脚本**会调 `sparse-checkout`（全库 grep 零命中）⇒ 是外部操作，不是构建产物
- `git reflog` 最后一条是 05:52:38（我的报告提交），05:52→20:40 之间**没有任何 commit / checkout**
  ⇒ 这次操作不走 reflog，符合 `git sparse-checkout` / `git fetch` 的特征

**推论（可验证）**：任何在 19:10 之后、20:40 之前在这个仓库里干活的 agent，**看不到 `src/`、
`electron/`、`docs/`、`scripts/`** —— 只有 `AGENTS.md`、`README`、`package.json` 这些根文件。
在那样的工作树里，P20-1a 一行代码都改不了。这能解释「17 分钟就结束、且仓库没有任何新提交」。
**若那份无人值守报告自称做完了，那是假完成**（它没有源码可改）。

**已修复**：`git sparse-checkout disable` ⇒ `core.sparseCheckout=false`，工作树恢复
（`scripts/run-tests-electron.mjs`、1419 个 ts/tsx 全部回来），`git status` 干净，代码零丢失
（提交对象完好，`git ls-tree 8bab6697 src/shared/` 仍能列出 `worldbuilding-ability-extract.ts`）。

**我的责任部分（如实写）**：05:47 我为验证基线失败做过一次临时 worktree，它给仓库留下了
`extensions.worktreeConfig=true` 与 `.git/config.worktree`。**这个副作用本身不会产生 sparse**
（sparse 规则是显式内容），但它让「每个 worktree 独立配置」成为可能，排查时会误导人。以后不轻易用
`git worktree`；要用则用完连 `extensions.worktreeConfig` 一起还原。

**防再犯**：以后开工第一条命令改成 `git status` 全文（不是 `--short`）—— `--short` 把
"You are in a sparse checkout" 那行吞掉，正是这次差点漏掉的原因。
