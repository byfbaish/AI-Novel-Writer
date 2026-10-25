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
