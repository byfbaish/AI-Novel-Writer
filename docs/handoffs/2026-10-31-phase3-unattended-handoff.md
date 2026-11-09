# 交接：上游失效期 3a 无人值守作业手册（2026-10-31）

> 状态：已裁定 · 2026-10-31 · 执行方为无人值守 agent，**照本手册做，不要自己加判断**
> 上一班交接：[`2026-10-30-baseline-failures-cleanup.md`](archive/2026-10-30-baseline-failures-cleanup.md)（基线红已清完）
> 施工图：[`docs/design/architecture/upstream-invalidation-phase3-plan-and-ui.md`](../design/architecture/upstream-invalidation-phase3-plan-and-ui.md)

---

## 〇、三十秒版本

你要做的是 **S1 → S2 → S3 → S4 → S5** 五片，**顺序不能变，一片绿了才开下一片**。
设计已经定死，你的工作是**照抄签名与验收**，不是重新设计。
任何一处与设计稿不符的"优化"，都算失败 —— 本仓库反复吃过"顺手改"的亏。

---

## 一、环境（这台机器有四个坑，先背下来）

| 坑 | 症状 | 正确做法 |
|---|---|---|
| **`pnpm` 在 sh 里是坏的** | `npm/node_modules/node/bin/node: line 1: This: command not found` | 终端一律用 **PowerShell**；hook/脚本里一律写 `node`，**不要写 `pnpm`** |
| **全量测试跑不完** | 跑到文件列表就没下文，20 分钟起，**0 条 FAIL** | **永远分层跑**：`pnpm test <目录>`。不要跑 `pnpm test`（无参数） |
| **safe-delete 弹窗误报** | `[safe-delete] … ETIMEDOUT`，栈落在 `afterEach` | 栈落在 teardown **不是你的错**，断言过了就算过 |
| **GitHub 不通** | clone/fetch 超时 | 与本任务无关；**不要试着推远端** |

**跑测试的标准写法**（照抄，PowerShell）：

```powershell
cd C:\develop\workspace\AI-writer\develop
$env:CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR=$null; $env:CODEBUDDY_TOOL_CALL_ID=$null
pnpm test src/shared/__tests__/invalidation-plan.test.ts
```

**提交前闸门**（pre-commit 会自动跑，也可以手动先跑）：

```powershell
node scripts/check-fast.mjs      # typecheck + 两个文档检查，约 25 秒，必须绿
```

---

## 二、当前状态（别重复做已完成的事）

| 事 | 状态 |
|---|---|
| 期 1：`upstream_revisions`（M24）+ 判定纯函数 + 两个写入点 | ✅ 已落地 |
| 期 2：三张表加 `source_ref`（M25）+ 读取侧逐行 `validity` + A 类五处硬拦 + B 类三处提示 | ✅ 已落地 |
| 存量派生裁定（`legacy` 只提示一次不阻断） | ✅ 已裁定（主稿 §十·1） |
| 台账登记 `P2-3` | ✅ 已登记 |
| **期 3a：plan 纯函数 + IPC + 强提醒 UI** | ⬜ **你要做的** |

**已经能用的东西**（直接 import，别重写）：

| 能力 | 位置 |
|---|---|
| `derivedStatusForChapters` / `derivedStatus` / `describeDrift` / `expandChapterRange` / `parsedChangedChapters` | `src/shared/upstream-revisions.ts` |
| `readDerivedReadContext` / `blueprintValidity` / `volumeHandoffChapters` / `plotTreeValidity` | `electron/services/derived-validity.ts` |
| `snapshotWithOverride`（仓储层那份） | `electron/repositories/upstream-revision-repository.ts:264` |
| 蓝图/交接单/剧情树读取 + `source_ref` | `BlueprintRepository` / `listVolumeHandoffs` + `readVolumeHandoffSourceRefs` / `PlotTreeRepository.readSourceRef` |

---

## 三、作业循环（每一片都这么做）

```
1. 读设计稿对应那一节的「施工卡」
2. 写代码（只改施工卡列出的文件）
3. 跑该片的验收命令
   ├─ 绿 → 进 4
   └─ 红 → 见 §五「卡住了怎么办」
4. node scripts/check-fast.mjs
5. git add <只加本片文件> && git commit
```

**提交信息模板**（照填，别自由发挥）：

```
feat(invalidation): 期 3a · S<n> <一句话>

<这一片做了什么，3 行以内>
验收：<贴命令> → <贴结果数字>
```

---

## 四、红线（碰一条就停手，不要试图绕过）

1. **`plan` 阶段绝不写库**。handler 里出现 `bump` / `UPDATE` / `INSERT` / 事务，即错。
2. **`legacy` 不许并进 `stale`**，只进 `unseen`，且 `unseen.count` 不许折成 0。
3. **`src/shared/**` 不许 import `electron/**`**（纯函数层）。
4. **不要动** `docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`、`docs/adr/` 既有条目。
5. **不要跑无参数 `pnpm test`**。
6. **不要改设计稿里的签名与判据表**。发现设计有问题 → 停下来写进 §六，不要自己改设计。
7. **文档状态行只能用一个受控词**：`待裁定` / `已裁定` / `已实施` / `已落地` / `已搁置` / `已结项`，且必须带 `YYYY-MM-DD`。写两个会被闸门拦（`C1b`）。

---

## 五、卡住了怎么办

**先做这三步，再决定停不停**：

1. **单文件跑一遍**：`pnpm test <那一个文件>`。单跑绿、多文件红 = 负载问题，不是你的 bug，继续。
2. **看栈落在哪**：落在 `afterEach` / `rmSync` = teardown 噪声，跳过；落在断言 = 真的要修。
3. **对照验收表**：设计稿每片都写了「期望输出」。你的实际输出和期望不一致，就是没过，**不要改期望去迁就实现**。

**做完这三步仍过不去** → **停下来**，在工作区留一个 `docs/handoffs/2026-11-01-phase3-blocked.md`，写清：

- 卡在哪一片、哪条验收；
- 完整错误信息（原文，不要复述）；
- 你试过的三条路分别得到什么结果；
- 你怀疑的方向（标明是怀疑，不是结论）。

**然后停。不要连续试第五次。** 今天已经有一次因为"再试一次"烧掉两小时的教训。

---

## 六、留给下一班的话（执行中追加）

（格式：日期 + 一句话 + 是否需要作者裁定）

### 2026-10-31 04:50 · 五片已按图施工完毕，两条口径需作者裁定

执行方：无人值守主 agent。起止 04:03–04:50，分支 `exp/resource-ledger`，
**五片各一次提交**（照 §三 的作业循环，一片绿了才开下一片）：`c2a3d5c3` / `f4012419` / `f5dcf75f` / `32cb8c70` / `d3e60fa1`。
（本行原记的 S3 提交号 `217dae23` 是**孤儿提交**、不在 HEAD 祖先链上，review 时已改。）
全程 `node scripts/check-fast.mjs` 绿。

**验收数字（逐片跑的，不是估的）**：S1 20 passed · S2 6 passed（+ 相邻既有 21 passed）·
S3 browser 7 passed · S4 3 passed。

**⚠️ 需要作者裁定两条：**

1. **`request.rev <= 0` 这个约定要不要留。** UI 手边没有当前版本号（全仓没有任何 IPC
   读 `upstream_revisions`），而它要问的正是「再改一版会怎样」。施工图把 request 钉成
   `{domain, scope?, rev: number}`，所以借 `0`（不是合法版本号）这一格表达，
   没加字段也没加通道。**替代方案**：新增一个读版本号的 IPC，UI 拿真值来问。
   推翻成本低 —— handler 那条 `> 0` 分支不用动。
2. **「重建大纲」的主入口要不要接闸门。** 施工图只指定了一个挂点（`continuePlanning`），
   本期照做。但真正"重建"多半走 `ArchitectureConfirmDialog` → `ArchFileViewer.handleConfirm`，
   **那里还没接**。那一层已有同构的 `progressGate` 机制可照抄，但「在哪一层拉 plan」
   需要你定 —— 我判断不在本次自主范围内，所以只登记没动手。

**另外两件事，不急但别忘：**

- **既有红的归因**：`src/components/editor/__tests__/` 有 **3 条既有红**
  （`CodeMirrorEditor-generation` 1 条、`ReviewReport.confirmation` 2 条）。
  我用 `git stash` 做了前后对照，改动前后都是 3 failed / 347 passed，**与本期无关**，
  所以没顺手修。下一班如果看到这 3 条红，先别算到本次头上。
- **剧情树恒为候选**：一本书如果从来没生成过剧情树，plan 也会多报一条「无法判断」。
  这是 `plotTreeSourceRef: DerivedSourceRef | null` 这个签名导致的 —— `null` 同时表示
  「没这棵树」和「这棵树没记来源」。要不要在 UI 上把 `unseen.kinds` 摊开显示，你定。

**施工期最大的坑（下次直接躲）**：

- **交接单的 `chapters` 必须是 `volumeHandoffChapters()` 的产出形态（已展开的完整章列表）。**
  我第一版测试写成 `[1, 20]`（意为首末章），测出来的是「只覆盖第 1 章和第 20 章」，
  两条用例当场红 —— 这是 fixture 的错，不是实现的错。写完就跑，别攒着。
- **React 受控 checkbox 在测试里只能 `ack.click()`**，先手设 `checked = true` 再 click
  会把它又切回去（`OutlineProgressGatePanel` 那条用例的 textarea 写法是 native setter + input 事件，
  两回事）。

- 2026-10-31：期 3b 需要的 M26（`drafts` 记定稿时的 `outline` rev）尚未裁定，**本期不要碰**。给「已定稿章节」组硬造判据 = 伪造判据。
