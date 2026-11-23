From: AC1-S1-WorkBuddy
To: 大肥鱼@主身
卡号：a7589d74｜会话标识：2026-11-23 22:05（新会话首次时间，本地 GMT+8）｜起点：90c49657bac698fa532af1e8d7b36859478be96f
模式：工作模式｜模型：DeepSeek V4.1 Flash（会话注入声明 "This conversation is powered by DeepSeek-V4.1-Flash"，非「快速」档）

---

## 0. 必读与四行确认

1. 已读（均在起点 `90c49657` 的 tree 内读取）：`AGENTS.md`、`README.md`、`docs/agents/worktree-parallel.md`、`docs/agents/workbuddy-channel.md`、`.batch/night/staging/ext-dispatch-header.md`、`.batch/night/staging/ac1-s1/impl-package.md`、`docs/design/architecture/architecture-consistency-design.md`（`:190`–`:215`，含 `:199`–`:203` 裁定段）。
2. 版本／日期：AGENTS.md `charter-version: 2026-11-07`；README 版本行 `v1.1.0`（package.json `1.2.0`）；worktree-parallel.md「已实施 2026-11-02／更新 2026-11-04」；workbuddy-channel.md「已实施 2026-11-05，2026-11-12 落点闸门修订」；设计稿裁定段标注 `2026-11-23`；impl-package 读于 `90c49657`。
3. 三条口径：①只经 IPC `db:character-roster-read` 吃快照 `status`，`src/shared` 零哈希重算；②只在 `consistency-preflight.ts` 加 import／读快照／拼一行，不动调用链、`coverage`、结果形状；③只判 `status === 'inconsistent'`，其余 fail-open，不加 `sourceLayer`，文案照抄不窄化。
4. 模式与模型：**工作模式**＋**DeepSeek V4.1 Flash**（依据：会话注入声明；本次会话可写文件、可执行命令、可提交）。

---

## 1. 起点与提交

- 起点 sha：`90c49657bac698fa532af1e8d7b36859478be96f`
- 提交后 `git rev-parse HEAD`：`6e0f6a6388080462f26e5f4be49efcfef61b8c37`
- `git log -1 --oneline`：`6e0f6a63 feat(preflight): AC1/S1 角色名册投影状态自洽 (card a7589d74)`
- `git status --porcelain`：（空）
- 只 commit，未 push；未 tag；未 `git add -f`；未 `--no-verify`。

---

## 2. 白名单三行清单（2 新 1 改）

| # | 文件 | 动作 |
|---|---|---|
| 1 | `src/shared/character-roster-consistency.ts` | 新增（内容照 impl-package §2 逐字） |
| 2 | `src/shared/__tests__/character-roster-consistency.test.ts` | 新增（用例照 §4 十条） |
| 3 | `src/services/consistency-preflight.ts` | 改（§3.1 import `:9`；§3.2 读快照 `:44-52`（注释 `:44-48`、`let rosterSnapshot` `:49`、IPC 调用 `:51`、catch `:52`）；§3.3 拼一行 `:72-76`，`findings` 数组闭合仍在 `:77`，`coverage` `:78` 起未动） |

`git diff --stat HEAD~1 HEAD`（提交后等价于本卡改动集）：

```
 src/services/consistency-preflight.ts              |  15 +++
 .../__tests__/character-roster-consistency.test.ts | 105 +++++++++++++++++++++
 src/shared/character-roster-consistency.ts         |  63 +++++++++++++
 3 files changed, 183 insertions(+)
```

白名单外零改动；`.batch/*`、`electron/repositories/character-roster-repository.ts`、`src/shared/character-roster.ts`、`src/shared/consistency-preflight.ts`、`ConsistencyPreflightPanel.tsx`、`architecture.command.ts`、`ipc-channels.ts`、设计稿与 ADR 全部未动。

---

## 3. §6 五条命令：原文与末行

### 3.1 新卡单测

命令（**替代说明见 §6**）：`node scripts/run-tests-electron.mjs src/shared/__tests__/character-roster-consistency.test.ts`

```
 RUN  v4.1.11 C:/develop/workspace/AI-writer/wt-2
 ✓ src/shared/__tests__/character-roster-consistency.test.ts (10 tests) 4ms
 Test Files  1 passed (1)
      Tests  10 passed (10)
```
末行汇总：`Tests  10 passed (10)`（整文件汇总，未用 `-t` 过滤）。

### 3.2 既有预检回归

命令：`node scripts/run-tests-electron.mjs src/shared/__tests__/consistency-preflight.test.ts src/shared/__tests__/consistency-preflight-space-time.test.ts`

```
 ✓ src/shared/__tests__/consistency-preflight-space-time.test.ts (27 tests) 10ms
 ✓ src/shared/__tests__/consistency-preflight.test.ts (8 tests) 6ms
 Test Files  2 passed (2)
      Tests  35 passed (35)
```
末行汇总：`Tests  35 passed (35)`。

### 3.3 闸门

命令（`pnpm check:fast` 的等价入口，见 §6）：`node scripts/check-fast.mjs; echo "CF_EXIT=$?"`

```
[check:fast] typecheck ✓ 36.0s
doc links: checked 1468, broken 0
[check:fast] doc-links ✓ 2.3s
doc placement: 扫描 439 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.2s
0 项不合规
[check:fast] batch-hygiene ✓ 4.5s
[check:fast] 全部通过。
CF_EXIT=0
```
提交时预提交钩子（`node scripts/check-fast.mjs`，钩子内非 pnpm）再跑一次，同样 `[check:fast] 全部通过。`，随后 `[card/arch-ac1-s1 6e0f6a63] … 3 files changed, 183 insertions(+)`。

### 3.4 哈希重算零命中

命令：`grep -n "hashText\|fullFactHash\|projection_hash\|fact_hash" src/shared/character-roster-consistency.ts`

输出：（无）—— `grep` 退出码 `1`，**零命中**。

### 3.5 IPC 实际调用行号

命令：`grep -n "db:character-roster-read" src/services/consistency-preflight.ts`

```
51:    rosterSnapshot = await ipc.invokeWithProjectSession(session, 'db:character-roster-read', session.projectPath)
```

`findCharacterRosterRisks` 相关行：`9`（import）、`49`（`let rosterSnapshot: Parameters<...>[0]`）、**`74`（findings 拼接行）**。

---

## 4. 四发变异（逐发跑、逐发恢复）

每发均只改 `src/shared/character-roster-consistency.ts`，跑 `node scripts/run-tests-electron.mjs src/shared/__tests__/character-roster-consistency.test.ts`，跑完立刻改回；改回后复跑得 `Tests  10 passed (10)`，交付工作树 `git status --porcelain` 为空、`grep "if (false)"` 零命中。

| 发 | 改法（一行） | 转红用例 | 汇总行 | 恢复 |
|---|---|---|---|---|
| M1 | `if (status !== 'inconsistent') return []` → `if (false) return []` | #4 `status=ready 时不判`／#5 `status=empty 时不判`／#6 `status=legacy_repair_required 时不判` | `Tests  3 failed | 7 passed (10)` | 已恢复 |
| M2 | 删 `!Number.isInteger(scope.chapterNumber) \|\| scope.chapterNumber <= 0` 守卫 | #9 `章号为 0 或负数时不判` | `Tests  1 failed | 9 passed (10)` | 已恢复 |
| M3 | 删 `if (!factHash) return []` | #8 `缺 factHash 时不判`（断言 `expected [ { …(6) } ] to deeply equal []`，键退化为 `roster:projection-drift:`） | `Tests  1 failed | 9 passed (10)` | 已恢复 |
| M4 | 删 `if (activeExemptions.has(stableFactKey)) return []` | #2 `同 stableFactKey 的未撤销豁免生效`（`expected [ { …(6) } ] to deeply equal []`） | `Tests  1 failed | 9 passed (10)` | 已恢复 |

注：impl-package §4 另列 M5（把 factHash 从键里去掉），**外派件 §4 变异靶表未列**，按「与本件冲突以本件为准」只跑四发；未跑 M5，判为「未判（本件未点名）」。

---

## 5. 判据 → 用例映射

| 判据 | 期望 | 用例 | 结果 |
|---|---|---|---|
| `status==='inconsistent'` 正向 | 1 条 warning，键 `roster:projection-drift:<factHash>`，`sourceChapter` 取当次章号，`sourceLayer` 为 `undefined` | #1 | 通过 |
| 豁免生效 | 未撤销豁免 ⇒ `[]` | #2 | 通过 |
| 撤销的豁免不生效 | `revoked:true` ⇒ 长度 1 | #3 | 通过 |
| `ready` 负向 | `[]` | #4 | 通过 |
| `empty` 负向 | `[]` | #5 | 通过 |
| `legacy_repair_required` 负向 | `[]` | #6 | 通过 |
| 缺快照负向 | `null`／`undefined` ⇒ `[]` | #7 | 通过 |
| 缺 factHash 负向 | `''`／`undefined` ⇒ `[]` | #8 | 通过 |
| 章号非法负向 | `0`／`-1` ⇒ `[]` | #9 | 通过 |
| 键稳定性 | 章号 3 与 9 的键全等；`factHash` 两端 trim | #10 | 通过 |

正向 2 条（#1 状态判定、#2 豁免）＋负向 7 组（#3–#9）＋键稳定性 1 条，共 10 个用例。

---

## 6. 环境事实与偏离（需主身裁决／知悉）

1. **`wt-2` 开工时是空目录**：无 `.git`、无 `node_modules`，`git worktree list` 里也没有它。按 `worktree-parallel.md` §3.1（wt-2 归 WorkBuddy）我执行了 `git worktree add C:/develop/workspace/AI-writer/wt-2 -b card/arch-ac1-s1 90c49657`，开工前 `git status --porcelain` 为空、HEAD = 起点 sha。**这不是派单里写的 `git switch -c`，但结果等价（新分支、指定起点、干净树）。**
2. **`node_modules` 用目录联接指向 `develop/node_modules`**：本卡禁 `pnpm install`，而上面新建的 worktree 没有依赖。已用 `New-Item -ItemType Junction` 建 `wt-2/node_modules → develop/node_modules`（不装包、不切 ABI、不进提交）。开工前探测 `5180-5183 / 9222-9225` 无监听，确认无 dev 实例在跑。
3. **`pnpm test <单文件>` 本体在本 worktree 不可用**：pnpm 先做依赖状态检查，判定 modules 目录需重建，报
   `[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY] Aborted removal of modules directory due to no TTY`。
   该检查会尝试 **purge 整个 modules 目录**（即 develop 的 node_modules），我**没有**加 `CI=true`／`confirmModulesPurge=false` 去放行——那等于删掉主工作区依赖。改用与 `pnpm test` 完全同一入口的 `node scripts/run-tests-electron.mjs <路径>`（`package.json` 的 `test` 脚本就是它），运行时同为 Electron（`ELECTRON_RUN_AS_NODE=1`）。**故 §3 里 `pnpm test …` 的「命令原文」是三处替代命令，不是字面 `pnpm test`**——这点按「不许把待验写成已证实」如实标注：**字面 `pnpm test` 未跑通，未判**。
4. `check:fast` 的预提交钩子直接调 `node scripts/check-fast.mjs`（钩子注释明写「为什么直接调 node 而不是 pnpm」），所以提交闸门未受第 3 条影响；`CF_EXIT=0` 为 `check-fast.mjs` 进程退出码。
5. 未做：全量测试、`test:browser`、`test:node`、起 Electron 实机、`pnpm install`。面板 `ConsistencyPreflightPanel.tsx` 未动，`sourceLayer` 未加。

---

## 7. 未判／缺什么

- **字面 `pnpm test` 输出**：被 pnpm 的 modules purge 闸门挡住，缺 TTY 授权环境。要拿到它需主身决定是否给该 worktree 建第二份独立 `node_modules`（`pnpm install`，本卡禁）或换到 `develop` 主工作区跑（禁止越权）。
- **M5 变异**：本件未点名，未执行（判为未判，不猜）。
