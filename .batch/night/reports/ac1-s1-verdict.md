# AC1/S1 首验判词（卡 `a7589d74`）

> 判位：QA（群分身）。判法：不采信回执自报，全部独立复跑与自行变异。
> 出判时间：2026-11-23 22:20（Asia/Shanghai）。

## 0. 判定面

| 栏 | 值 |
|---|---|
| 判定面（交件） | `6e0f6a6388080462f26e5f4be49efcfef61b8c37`，message「feat(preflight): AC1/S1 角色名册投影状态自洽 (card a7589d74)」 |
| 父提交 | `90c49657bac698fa532af1e8d7b36859478be96f`（`git rev-parse 6e0f6a63^` 复核） |
| 分支 / 现场 | `card/arch-ac1-s1`，worktree `C:\develop\workspace\AI-writer\wt-2`；`git status --porcelain` **0 行** |
| 改动面 | 3 文件 `+183/−0`，全在派单白名单：`src/shared/character-roster-consistency.ts` 63／`src/shared/__tests__/character-roster-consistency.test.ts` 105／`src/services/consistency-preflight.ts` 15 |
| develop 主线 | `9fc4198d`（派单与实施包入库），与卡分支互不影响；本分支 base 是 `90c49657`，**不含** `7252f7f5`（设计稿 `:204` 更正）与 `9fc4198d` |

## 1. 判据逐条

### 判据① 纯函数、无 IO `[static]`

- 新文件只两行 `import type`：`./character-roster`（`CharacterRosterSnapshot`、`CharacterRosterStatus`）与 `./consistency-preflight`（`ConsistencyExemption`、`ConsistencyFinding`）。
- 严格 grep（`hashText|fullFactHash|projection_hash|fact_hash|require\(|from '(node:|fs|path|electron)|ipc\.|document\.|window\.`）对 `src/shared/character-roster-consistency.ts` → **rc=1，零命中**。
- 导出仅四项：`CHARACTER_ROSTER_DRIFT_KEY_PREFIX`（`:15`）、`characterRosterDriftStableFactKey`（`:17`）、`CharacterRosterPreflightScope`（`:21`）、`findCharacterRosterRisks`（`:30`）；`deriveRosterStatus` 未出现在导出里。

**判：过。**

### 判据② 接入既有预检通路、不改流程 `[static]`

`git show 6e0f6a63 -- src/services/consistency-preflight.ts` 只有 15 行新增，三处：

1. `:9` 附近新增 `import { findCharacterRosterRisks } from '../shared/character-roster-consistency'`；
2. `worldBuildingText` 的 `try/catch` 之后新增读快照：`let rosterSnapshot: Parameters<typeof findCharacterRosterRisks>[0]` ＋ `try { rosterSnapshot = await ipc.invokeWithProjectSession(session, 'db:character-roster-read', session.projectPath) } catch { rosterSnapshot = undefined }`；
3. `findings` 数组里 `...findDuplicateSlotAttackRisks(blueprints, exemptions),` 之后追加 `...findCharacterRosterRisks(rosterSnapshot, { chapterNumber: blueprints[0]?.chapterNumber ?? 0 }, exemptions),`。

`blueprints.map(...)` 内部、`coverage` 计算、`ConsistencyPreflightResult` 形状、`mergeConsistencyFindingsIntoReview`、面板组件均零改动（numstat 只 3 个文件可证；面板文件不在改动面）。没有新增流程步骤，只在既有预检里多一条规则。

**判：过。**

### 判据③ 正向与负向用例可复跑 `[static]`

命令与原文（我在 `wt-2` @ `6e0f6a63` 现跑）：

```
$ node scripts/run-tests-electron.mjs src/shared/__tests__/character-roster-consistency.test.ts
 ✓ src/shared/__tests__/character-roster-consistency.test.ts (10 tests) 4ms
 Test Files  1 passed (1)
      Tests  10 passed (10)
TEST_EXIT=0

$ node scripts/run-tests-electron.mjs src/shared/__tests__/consistency-preflight.test.ts src/shared/__tests__/consistency-preflight-space-time.test.ts
 ✓ src/shared/__tests__/consistency-preflight-space-time.test.ts (27 tests) 9ms
 ✓ src/shared/__tests__/consistency-preflight.test.ts (8 tests) 6ms
 Test Files  2 passed (2)
      Tests  35 passed (35)
TEST_EXIT=0
```

用例分布：正向 #1（`inconsistent` ⇒ 一条 warning，键 `roster:projection-drift:abc123`、`sourceChapter===7`、`sourceLayer` 为 `undefined`）；负向 #3–#9（revoked 豁免不生效／`ready`／`empty`／`legacy_repair_required`／`null`·`undefined`／空 factHash／章号 0 与 -1）；#10 键跨章稳定且 `trim`。十例即 `grep -c "it("` 的 10。

**判：过。**

### 判据④ 负向用例在变异后真转红 `[static]`

我自行实施五发变异（只改 `src/shared/character-roster-consistency.ts`，每发跑完 `git checkout --` 复原）：

| 变异 | 手法 | 转红用例（原文） | 汇总 |
|---|---|---|---|
| M1 | `if (status !== 'inconsistent') return []` → `if (false) return []` | `status=ready 时不判`／`status=empty 时不判`／`status=legacy_repair_required 时不判` | `Tests  3 failed | 7 passed (10)` |
| M2 | 删章号守卫 `!Number.isInteger(...) || scope.chapterNumber <= 0` | `章号为 0 或负数时不判` | `Tests  1 failed | 9 passed (10)` |
| M3 | 删 `if (!factHash) return []` | `缺 factHash 时不判` | `Tests  1 failed | 9 passed (10)` |
| M4 | 删 `if (activeExemptions.has(stableFactKey)) return []` | `同 stableFactKey 的未撤销豁免生效` | `Tests  1 failed | 9 passed (10)` |
| M5（靶表外，我加跑） | 键去掉 `factHash`（固定 `roster:projection-drift`） | `status=inconsistent 时报一条 warning，键为 factHash 前缀形式`／`同 stableFactKey 的未撤销豁免生效`／`同 factHash 不同章号的键全等…` | `Tests  3 failed | 7 passed (10)` |

复原后：`git status --porcelain` 0 行、`grep "if (false)"` 零命中、复跑 `Tests  10 passed (10)`。工作树不留变异体。

**判：过**（4 发靶表全转红，且转红位置与预期用例一一对应，不是「顺手红」）。

### 判据⑤ 测试走 Electron 运行时 `[static]`

- `package.json:26` `"test": "node scripts/run-tests-electron.mjs"` ⇒ 我用的入口与 `pnpm test <paths>` 是同一进程（Electron 运行时）；vitest 头 `RUN v4.1.11`。
- 未跑全量、未用 `test:browser`、未切 ABI；只跑派单点名的三个文件。
- **字面 `pnpm test <path>` 在本 worktree 未通过**，原文：

```
[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY] Aborted removal of modules directory due to no TTY
[ERROR] Command failed with exit code 1: ...
    at runDepsStatusCheck (pnpm.mjs:249560)
```

原因在 pnpm 的依赖校验要 purge modules，`wt-2/node_modules` 是指向 `develop/node_modules` 的目录联接（`ls -la` 实测），不是代码问题。按群 admin 裁定，采信 `node scripts/run-tests-electron.mjs` 等价入口，不补跑字面（补跑需 `CI=true` 放行 purge，风险大于收益）。

**判：过（附口径说明）。**

### 附加：`check:fast` `[static]`

```
$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 16.9s
doc links: checked 1468, broken 0
doc placement: 扫描 439 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] 全部通过。
CF_EXIT=0
```

回执 `C:\tmp\ac1-s1\workbuddy\receipt-to-owner.md` 我独立核：158 行／10,294B／sha256 `ec81cb0edad49bf36fcbf04ce56014ea519ba0434d92392f5f15d1bbd514c00e`，四行头齐（`From: AC1-S1-WorkBuddy`／`To: 大肥鱼@主身`／卡号 `a7589d74`＋起点 `90c49657`／模式「工作模式｜DeepSeek V4.1 Flash」），变异表与我的实测逐行一致。

## 2. 三处偏离的裁定（不重复裁，按 admin 口径写入判词）

| # | 偏离 | 我的独立证据 | 采信 |
|---|---|---|---|
| ① | 用 `git worktree add -b card/arch-ac1-s1 90c49657` 代替 `switch -c` | `git rev-parse 6e0f6a63^` → `90c49657`，起点正确 | 采信 |
| ② | `wt-2/node_modules` 目录联接指 develop | `ls -la node_modules` → `-> C:\develop\workspace\AI-writer\develop\node_modules`，ABI 同源 | 采信 |
| ③ | 字面 `pnpm test` 未跑通 | 我复现同一 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`，出口在 `runDepsStatusCheck`（pnpm.mjs:249560） | 采信（等价入口原文已入 §1 判据⑤） |

M5 不在派单靶表，不计缺项；我额外跑了并用它证明「键含 factHash」这条断言不是空断言。

## 3. 记账（不影响判词，供后续卡吸收）

1. **finding 只挂 `blueprints[0]` 章**：名册状态是项目级事实，但 `sourceChapter` 必填、面板按章渲染，所以一次预检只在首章分节里出现一条；`blueprints` 为空（未选章审核）时 `chapterNumber` 取 0 ⇒ 纯函数 fail-open，**AC1 不报**。属已知取舍（实施包 §2 注释），建议后续面板支持项目级分组时一并改。
2. **豁免键含 `factHash`**：角色事实一变（换卡／改关系／动态状态），旧豁免自然失效并重新报出。设计上正确（事实变了要重判），但作者体验是「豁免忽然不生效」，建议 UI 侧在豁免失效时给一句提示。
3. **文案四个发射点**：`evidence`／`issue`／`suggestion` 已覆盖「三哈希不符」与「迁移态未收尾（旧卡保留／旧 Markdown 待重建）」两支，与 `deriveRosterStatus`（`:817-846`）四个 `inconsistent` 发射点 `:827`／`:831`／`:835`／`:843` 对齐；`:835` 的实际条件比「有卡无 markdown」宽（`!(entries 空 && legacy_markdown 非空)`），文案用「迁移未收尾」兜住，不必收窄。
4. **测试注释分类**：`character-roster-consistency.test.ts` 里 #2（豁免生效 ⇒ `[]`）注释标「正向」，实为负向断言；只影响阅读，不影响覆盖。
5. **合并顺序**：本分支 base `90c49657`，develop 已前进到 `9fc4198d`（含设计稿 `:204` 更正 `7252f7f5`）。apply 时按 `9fc4198d` 之后合，避免把设计稿改回旧措辞。

## 4. 未判边界

- 不判 Electron 实机里面板是否真显示这条 finding（本卡判据无 `[live]` 项）；要让实际预检跑一次的思路，留给卡面是否需要补 `[live]` 时再定。
- 不判 `deriveRosterStatus()` 的语义正确性（本卡只读 `status`，不改主进程）。
- 不判豁免 UI 是否允许新增 `roster:` 前缀的键（面板/豁免创建路径不在本卡改动面）。

## 5. 结论

**PASS。** 五条判据全过：纯函数无 IO、接线只加一行不改调用链、10＋35 例全绿（Electron 运行时入口）、四发变异逐发转红且复原后零残留、`check:fast` 全过。三条偏离按 admin 裁定采信，四条例外记账不影响放行。

卡 `a7589d74` 可转 done，卡面判定面写 `6e0f6a63`（合并 sha 待 apply 后回填）。
