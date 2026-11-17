# P51 · 动作数中位数改「连续 10 章」口径 — 执行回执（v2 重投）

执行方：豆包（主）｜工作目录：`C:\develop\workspace\AI-writer\wt-p51`｜分支 `agent/p51-median`
结论：**改码与用例已完成，判据 1–4 逐条可指认；判据 5、6 被两处「与本次改动无关的环境前置」挡住，未全绿 ⇒ 按卡文「缺一条即不通过」，本单判不通过（阻塞项见 §3）。**

---

## 0. 工作区前置自检（§0）

| 项 | 要求 | 实测 |
| --- | --- | --- |
| 工作目录 | `C:\develop\workspace\AI-writer\wt-p51` | 只在此目录开工；**未触碰** `...\AI-writer\develop` 与 `wt-1` |
| 分支 | `agent/p51-median` | `agent/p51-median` |
| 起点 HEAD | `26627655` | `26627655`（开工第一步实读） |
| `git ls-files '*draft-edit-median*'` | 命中实现 + 测试 | `src/components/editor/__tests__/draft-edit-median.test.ts`、`src/components/editor/draft-edit-median.ts` |
| `git diff --numstat` | 空 | 空 |
| `git diff --ignore-cr-at-eol --stat` | 空 | 空 |
| `pnpm install` / `rebuild` / `pnpm dev` | 禁 | 全部未跑。注：`pnpm` v11.11 运行脚本前会做一次依赖检查并打印 `Already up to date`，未安装、未重编（证据见 §3.1：原生产物 mtime 仍是 2026/3/14） |

（未用 `git status --porcelain` 作为干净判据，按 R4 只用上面两条 diff。）

---

## 1. 改了什么

| 文件 | 改动 | numstat |
| --- | --- | --- |
| `src/components/editor/draft-edit-median.ts` | 取窗从「有计量行的最近 N 章」改为「以当前章为终点、向前连续 N 个章号」；缺行的章记 0 并进样本；新增第三参 `currentChapterNumber`（不传时退到计量行最大章号）；不足 10 个章号才 `median: null` | 48+/18- |
| `src/components/editor/ReviewReport.tsx` | 调用处把组件自身的 `chapterNumber` 作为窗口终点显式传入纯函数；该 effect 依赖补 `chapterNumber`；上方注释补 P51 说明。**未动**除调用点/依赖/注释外的任何逻辑 | 12+/6- |
| `src/components/editor/__tests__/draft-edit-median.test.ts` | 新增 5 条用例（原 6 条断言一字未改）；现共 11 条 | 64+/0- |

口径落点（全部按卡文，未自创）：
- 中位数定义、`Math.round` 取整、聚合位置（渲染层纯函数）、主进程只回三列原始行 —— **沿用 P48，未动**。
- 窗口 = `[当前章 - 9, 当前章]`（章号从第 1 章起，故下界取 `max(1, 当前章-9)`）；`sampleChapters = min(当前章, 10)`。
- 零动作章（一行都没有 / 只有 AI 行 / 有行但 `changed_chars = 0`）一律记 0，不再被跳过。
- 文案仍用既有 `样本不足（${sampleChapters}/10 章）`，无改动。

### 主用只手算（判据 1 的样本）
章 3..12 连续，5 与 8 无任何行；其余八章作者动作数 `1,1,1,9,9,9,9,9`。
逐章序列（3→12）：`1, 1, 0(第5章), 1, 9, 0(第8章), 9, 9, 9, 9`
升序：`0,0,1,1,1,9,9,9,9,9` ⇒ 第 5、6 个是 `1` 与 `9` ⇒ 均值 `5.0` ⇒ `Math.round = 5`，样本 10。
反证：若 5 或 8 任一章被跳过，样本只剩 9 ⇒ 直接 `median: null`，绝无可能读出 5。

---

## 2. 验收判据逐条指认（§4）

| # | 判据 | 结论 | 指认 |
| --- | --- | --- | --- |
| 1 | 空章用例必须存在且在判据里 | ✅ | `counts chapters with no measurement rows as zero actions instead of dropping them`：样本 = 10、5 与 8 记 0（见 §1 手算 `5`）。另加 `treats an empty chapter and an all-AI chapter identically` 反钉「空章 ≡ 零动作章」 |
| 2 | 章号断档：缺号记 0、仍取满 10；不足 10 个章号 ⇒ null + N/10 | ✅ | `fills chapter-number gaps with zero and still walks back 10 chapter numbers`（只有 3,4,7..12 ⇒ 窗口 3..12、5/6 记 0、样本 10、读数 1）；`reports the reachable chapter numbers as the sample when fewer than 10 exist`（当前章 5 ⇒ 样本不足（5/10 章）、null） |
| 3 | 全 ai 行的章仍算 0 动作（P48 不退步） | ✅ | 原有 `treats all-AI rows as zero author actions but keeps the chapters as samples` 断言原文未改、跑绿；另有 §1 的 ai 行等价用例 |
| 4 | 10 章整、无空章的原有 5 个手算例一个都不许变 | ✅ | 原 6 条用例（5 条手算 + 空集）**断言一字未改**，本次运行 11/11 全绿（见 §4.1 原文） |
| 5 | 点名套件全绿（禁 node vitest / 全量 / test:browser） | ❌ | 中位数文件 11/11 绿；仓储文件 1 条在 **模块加载期** ABI 报错失败，原因见 §3.1。未跑 `node vitest`、未跑全量、未跑 browser |
| 6 | `pnpm check:fast` 全绿 | ❌ | `typecheck ✓ 44.2s`；`doc-links` 与 `doc-placement --strict` 因 2 条**禁改区 docs 的既有断链**判红，原因见 §3.2 |
| 7 | 一次点名 `git add`、禁 push/tag/publish、报告落盘 + `<!-- DONE -->` | ⚠️ 已按令执行 | `git add` 只加本卡 3 个文件（§5.3）；**未 commit、未 push/tag/publish**；报告即本文件，末行 DONE |

---

## 3. 两条阻塞（均与本次改动无关，且都落在本卡禁令内）

### 3.1 判据 5：`better-sqlite3` 原生产物 ABI 与本工作区两个运行时都对不上
- 报错原文见 §4.1：产物按 `NODE_MODULE_VERSION 137` 编译，Electron 运行时要求 `145`。
- 实测三方数字：
  - `node` v22.23.2 → ABI `127`
  - `node_modules/electron` 41.10.7 → 要求 ABI `145`
  - 产物 `node_modules/.pnpm/better-sqlite3@12.8.0/.../build/Release/better_sqlite3.node` → 按 **137** 编译，`LastWriteTime = 2026/3/14 7:36`（早于本单，非本次改动产生）
- 结论：**137 对角色的两个运行时（127 / 145）都加载不了**，因此仓储那条用例在本工作区无论怎么跑都过不了；唯一解法是 `prepare:native-*` 重编或 `install`，而 §0 明令禁止（会切 ABI、打断别人槽位），故**不自行修**。
- 建议由持有该槽位的人执行一次 `pnpm prepare:native-electron` 后重跑 §4.5 命令；本卡代码侧不需要为此改动任何文件。

### 3.2 判据 6：两条 docs 断链来自本工作区缺 `.workbuddy`（docs 属禁改区）
- `check-doc-links` 报：
  - `docs/design/architecture/p11-plan-validity-and-fact-registry-design.md -> ../../../.workbuddy/memory/notes/data-and-schema.md`
  - `docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md -> ../../.workbuddy/memory/2026-11-10.md`
- 根因：这两个相对链接指向仓库根的 `.workbuddy/`，而 `.workbuddy` 是**未被 git 跟踪**的开发期目录（`git ls-files -- .workbuddy` 为空），在 `wt-p51` 这个 worktree 里不存在（`Test-Path .workbuddy` = False）。脚本按真实文件系统解析相对路径，故必然断。
- 我方证据：`git diff --stat -- docs` 为空、`git status --porcelain -- docs` 为空 ⇒ **本单未动 docs**；`doc-placement --strict` 也把这 2 条计入「新增违规 2 条 / 基线内 0 条」，即基线未豁免。
- 结论：修它要么改 docs（§3 禁改区），要么往 worktree 里补 `.workbuddy`（超出本卡范围、且会污染工作区）；两者都不该由本单做。建议由主工作区持有人决定（在 `develop` 里 `.workbuddy` 存在时该检查应为绿）。

---

## 4. 原始输出（原文）

### 4.1 点名套件（`pnpm test` 两个文件，cwd = wt-p51）

```
Already up to date
Done in 329ms using pnpm v11.11.0
$ node scripts/run-tests-electron.mjs "src/components/editor/__tests__/draft-edit-median.test.ts" "electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts"
[1115/103357.701:ERROR:third_party\crashpad\crashpad\util\win\registration_protocol_win.cc:136] TransactNamedPipe: 有更多数据可用。 (0xEA)

 RUN  v4.1.11 C:/develop/workspace/AI-writer/wt-p51

[1115/103401.989:ERROR:third_party\crashpad\...] TransactNamedPipe: 有更多数据可用。 (0xEA)
[1115/103402.004:ERROR:third_party\crashpad\...] TransactNamedPipe: 有更多数据可用。 (0xEA)
 ✓ src/components/editor/__tests__/draft-edit-median.test.ts (11 tests) 3ms
 ❯ electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts (1 test | 1 failed) 59ms
     × returns only the newest 10 chapters and keeps AI rows 59ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts > DraftEditStatsRepository.listRecentChaptersForProject > returns only the newest 10 chapters and keeps AI rows
Error: The module '\\?\C:\develop\workspace\AI-writer\wt-p51\node_modules\.pnpm\better-sqlite3@12.8.0\node_modules\better-sqlite3\build\Release\better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 137. This version of Node.js requires
NODE_MODULE_VERSION 145. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
 ❯ bindings node_modules/.pnpm/bindings@1.5.0/node_modules/bindings/bindings.js:112:48

 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 11 passed (12)
   Start at  10:34:01
   Duration  2.62s (transform 1.05s, setup 569ms, import 1.50s, tests 63ms, environment 0ms)

[ELIFECYCLE] Test failed. See above for more details.
```

（`TransactNamedPipe` 那几行是 Electron 自带 crashpad 在 Windows 上的噪声，不影响用例结果；为省篇幅已截断中间部分时间戳前缀，错误正文原样保留。）

### 4.2 `pnpm check:fast`

```
Already up to date
Done in 330ms using pnpm v11.11.0
$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 44.2s
doc links: checked 1470, broken 2
  docs/design/architecture/p11-plan-validity-and-fact-registry-design.md -> ../../../.workbuddy/memory/notes/data-and-schema.md
  docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md -> ../../.workbuddy/memory/2026-11-10.md

[check:fast] doc-links 失败（2.2s）。修完再提交。
[ELIFECYCLE] Command failed with exit code 1.
```

（`check:fast` 在 doc-links 处提前退出，第三步 `doc-placement` 未由它执行，故单独跑了一次，原文见 4.3。）

### 4.3 `node scripts/check-doc-placement.mjs --strict`（单独跑）

```
doc placement: 扫描 437 份 md，当前违规 2 条，基线内 0 条，新增 2 条

[C6] 断链（2）
  + docs/design/architecture/p11-plan-validity-and-fact-registry-design.md — 断链：../../../.workbuddy/memory/notes/data-and-schema.md
  + docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md — 断链：../../.workbuddy/memory/2026-11-10.md
```

---

## 5. 起点 / 终点 / 差异

### 5.1 HEAD
- 起点 HEAD：`26627655`
- 终点 HEAD：`26627655`（本单**未做任何 commit**，提交权不在执行方）

### 5.2 工作树差异（R4 两条口径）

```
$ git diff --numstat
12	6	src/components/editor/ReviewReport.tsx
64	0	src/components/editor/__tests__/draft-edit-median.test.ts
48	18	src/components/editor/draft-edit-median.ts

$ git diff --ignore-cr-at-eol --stat
 src/components/editor/ReviewReport.tsx             | 18 ++++--
 .../editor/__tests__/draft-edit-median.test.ts     | 64 +++++++++++++++++++++
 src/components/editor/draft-edit-median.ts         | 66 ++++++++++++++++------
 3 files changed, 124 insertions(+), 24 deletions(-)
```

### 5.3 唯一一次点名 `git add`（只加本卡动过的文件）

```
git add src/components/editor/draft-edit-median.ts \
        src/components/editor/__tests__/draft-edit-median.test.ts \
        src/components/editor/ReviewReport.tsx
```

未执行 push / tag / publish；未 add `.batch/night/staging/` 下的回执，也**未碰** `开篇试样 02/`（该目录在 `develop`，按要求不作任何处理）。

---

## 6. 不确定 / 本次读取范围内未找到

- **不确定**：卡文「样本数 = `min(已有章数, 10)`」中的「已有章数」我按「当前章章号」实现（即章号从第 1 章起连续编号，当前章 5 ⇒ 已有 5 章）。若实际书目存在不从 1 起编号的情况，这条会偏大 —— 需卡主确认是否要改成「首章章号也参与判定」。
- **不确定**：当前章之前「从未建过的章号」我按卡文字面记为 0 并进样本（用例 `counts trailing chapters newer than the newest measurement row as zero` 钉的就是这条）。若卡主本意只把「已建但没保存过的章」算 0，则需引入章表入参，届时该用例要改。
- **不确定**：`currentChapterNumber` 优先于「计量行最大章号」。若出现「报告章号小于已落行的最大章号」（数据超前），窗口会按报告章号截断，未来章不进样本。
- 本次读取范围内（`git grep -l "draft-edit-median"`）调用生产代码只有 `src/components/editor/ReviewReport.tsx` 一处；**本次读取的文件内未找到**其他调用方。
- 按卡禁：未跑全量、未跑 `test:browser`、未跑 `pnpm dev`、未做任何应用级验证；UI 上「样本不足（N/10 章）」文案未改，其显示效果本次未做浏览器验证。

---

## 7. 命令清单备案（收窄口径下发后补记）

收窄令（只放行卡文点名三条命令）下发于本单执行完之后。按该口径复核本单跑过的全部命令，如实分两类：

**放行三条（均只执行一次，未重复、未变体）**
1. `pnpm test src/components/editor/__tests__/draft-edit-median.test.ts electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts` —— 输出原文见 §4.1
2. `pnpm check:fast` —— 输出原文见 §4.2
3. `git add` 一次性只加 3 个文件 —— 见 §5.3

**其他只读检查（不写任何状态，用于取证）**
- `git rev-parse` / `git ls-files` / `git diff [--numstat|--stat|--cached]` / `git status --porcelain`（仅用于核对范围）/ `git check-ignore` / `git grep -l` / `git log --oneline -1`
- `node -p`（读 node / electron 版本与 ABI）、`Test-Path`、`Get-Item`、`Get-ChildItem`
- **`node scripts/check-doc-placement.mjs --strict`（单独跑一次）** —— 这一条**不**在三条放行命令内。原因是 `pnpm check:fast` 在 doc-links 处提前退出，第三步从未执行，为了给卡主一条完整证据才单独跑它（输出见 §4.3）。该脚本只读 437 份 md、不写文件，无任何状态变更；若卡主要求严格零外溢，可视为超范围但无副作用，记录在此备案。

**未执行（继续按红线/收窄令保持禁止）**：无参全量 `pnpm test`、`test:browser`、`test:node`、任何 `--config vitest.browser.config.ts`、`pnpm install` / `rebuild` / `pnpm dev`、`git push` / `tag` / `publish`、任何 commit。

复核时点状态：HEAD 仍 `26627655`（`feat: show 10-chapter median of author edit actions`，即起点提交，本单未新增 commit）；`git diff --cached --numstat` 仅上列 3 个文件；`git diff --numstat` 为空。

<!-- DONE -->
