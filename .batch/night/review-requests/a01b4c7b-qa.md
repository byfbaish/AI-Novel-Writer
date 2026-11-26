# a01b4c7b 首验判词 · 上游可吸收清单（upstream-diff-eval-20261126）

- 判者：QA（AI writer项目组群分身）· 2026-11-26 21:45
- 派验单：`.batch/night/review-requests/a01b4c7b.md`（2026-11-26 21:35 派，受派：developer）
- 受验件：
  - `.batch/night/reports/upstream-diff-eval-20261126.md`（128 行／12,723 B／`ef19bf2e2999f5a178b689e04ee9d1d1112b9cc865a2f6166c3b5a4f82b56457`）
  - `.batch/night/reports/upstream-diff-inventory.tsv`（667,855 B／4,320 行／`44a33a3b…e275aa1e`）
- 本轮授权：**只读**。未 merge、未 cherry-pick、未 push、未改任何 `src/`／`electron/` 生产码；产物只写本判词与 `/c/tmp/up*` 临时目录（不入库）。
- 判定面 HEAD：`5d0a418d`（porcelain 5 行全 `??`，均为本次评估件与派验单本身）。

## 结论

**带条件通过。** 方法论与主结论（A1=0、按文件簇吸收、"不能 merge"）经独立复算成立，可直接用于排期；但 §五「三条先做」里**我方对应位置有三处与盘上实况不符**，会派单时低估改动面——放行前须按下文 C1–C3 改写这三行，否则先做项 1/2/3 会被当成"小改动"立项，实际都是新建机制。

## 五条口径逐条

### ① 分叉点可复算 —— 通过

```
$ git rev-parse upstream-baseline^{tree} relive-src/upstream-baseline^{tree}
ecca898653fcd98b69c9870ec6ecf4063be26a4d
ecca898653fcd98b69c9870ec6ecf4063be26a4d
$ git rev-parse 549522d4^{tree}          # 本地即 549522d4（2026-10-14 03:43:54 +0800 Merge PR #381）
ecca898653fcd98b69c9870ec6ecf4063be26a4d
$ git merge-base HEAD upstream-baseline  # 无输出，EXIT=1
$ git merge-base HEAD relive-src/upstream-baseline
dd04d3e979a3800bba50ac9aa1d365884b87737b   # 10-10，#337，重写史假祖先
```

三个树同一 `ecca8986…`、真实无共同祖先、假祖先可指名——与评估件 §一 1–3 条逐字一致。

### ② ahead_by 与时点 —— 通过（时点已漂移，差额机制得旁证）

- 评估件取数时点（21:05）：`ahead_by 4348`、尖端 `32f4f7f8`（`#851`，12:38Z）。`32f4f7f8` 在提交 atom 里确为 `Merge pull request #851 from EthanYoQ/claude/m29-verify 2026-11-26T12:38:53Z`，与声明的 12:38Z 吻合。
- 我 21:40 复核：`compare/549522d4...master` → `status ahead / ahead_by 4355 / behind_by 0 / total_commits 4355`；尖端 `f1d7f1d91bd5bb8e2e2523fda5edaea53a8dc079`（`Merge pull request #856`，13:19:48Z）。**两端各 +7，属取数后上游又进 7 笔的时点漂移，不是取数错误。**
- "差 29 笔＝committer 日期过滤"：同一时刻两条接口对照——
  - `compare` `ahead_by` = **4355**
  - `GET /commits?sha=master&since=2026-10-14T00:00:00Z&per_page=1` 的 `Link rel="last"` = `page=4326` → **4,326 笔**
  - 差 **29**，与评估件 4,348−4,319=29 **完全同值**；两者都随上游前进 +7 而差额恒定 ⇒ 丢掉的是固定一批 committer 日期早于基线的提交，机制解释与读数自洽，未被证伪。
- 未逐笔定位那 29 笔：未认证配额 60/h，复核开始时剩 3（`rate_limit.core.remaining`），逐笔需 44 页。**记为"机制已得旁证、未逐笔取证"，不影响文件级结论**（评估件本身也声明文件增量取自两棵 tar 逐文件 sha1，不依赖提交列表）。

### ③ 三条先做项是否指到上游源码 —— 上游侧全部成立，我方侧三处不成立

上游侧（我逐条核到文件与函数，均成立）：

| 先做项 | 上游实况 |
|---|---|
| 取消与失败混淆 | 新增 `src/services/workflows/workflow-cancellation.ts`：`export class WorkflowCancelledError extends Error { constructor(message: string, readonly notice = false) }`；`ee7b305b` 改 `src/services/workflows/workflow-utils.ts` +11/−4、`src/shared/finalization-step-error.ts` +3/−3，提交正文「新增 finalizationStepErrorMessage 作为唯一出口」 |
| 回收站/重发撞名 | `electron/repositories/chapter-deletion-repository.ts`：`static reservedManuscriptTargets(db = requireDatabase()): Set<string>`（查 `chapter_deletion_operations` 中 `manuscript_status IN ('pending','failed')`）；`5eb71454` 正文「reserved 改为必填，漏传过不了类型检查」，publisher +3/−3、repository +12/−2、service +19/−4 |
| 网络失败分因 | `674273e1` 改 `src/services/generation/prompt-budget-failure.ts` +18/−1 与 `electron/llm/transport-diagnostics.ts` +2，正文即"三因"（没连上／中途断／代理连不上） |

我方侧（盘上实测，`grep -rl` 于 `src/ electron/`）：

```
WorkflowCancelledError         0 个文件
isWorkflowCancellation         0 个文件
finalizationStepErrorMessage   0 个文件
reservedManuscriptTargets      0 个文件
republishTarget                0 个文件
```

- **P1（必改）评估件 `:106` 写"我方对应位置已知（`isWorkflowCancellation` 同族）"——不成立**，我方根本没有这个函数族。实况是我方 `src/services/workflows/workflow-utils.ts`（411 行）在 `:57`／`:60`／`:63`／`:236` 四处直接 `throw new Error(text('工作流已取消', 'Workflow was cancelled.'))`（`:234` `assertNotCancelled`）。所以本项不是"改一处调用"，而是**新建取消类型 + 收口 4 个抛点 + 6 处判定入口**，"S/M" 应上调为 M。
- **P2（必改）先做项 2**：我方 `electron/repositories/chapter-deletion-repository.ts`（449 行）**无** `reservedManuscriptTargets`；`electron/services/manuscript-publisher.ts`（140 行）导出只有 `resolveManuscriptTarget:65`／`serializeManuscript:90`／`publishManuscript:102`／`removePublishedManuscript:128`／`manuscriptPublisher:137`，**无 `reserved` 参数、无 `republishTarget`**（`grep reserved` 命中 0）。`finalization-service.ts`(206)／`chapter-deletion-service.ts`(268)／`finalized-draft-import-repository.ts`(498) 都在，但被调方要新建。评估件 `:109` 说"上游把该方法改成必填以强制所有选目标处传参——这条必须照做"，方向对；`:110` "预计冲突 3–5 处（我方回收站已冷，但发布路径在）"是**冲突数**口径，读者容易误当工作量口径。
- **P3（必改）先做项 3**：我方 `src/services/generation/prompt-budget-failure.ts` 281 行里已有 `'network'` 分档（`:62` 联合类型、`:79` `NETWORK_ERROR` 码表、`:116` `if (NETWORK_FAILURES.has(code)) return 'network'`、`:152` `network: ['网络', 'Network']`），且我方**没有** `electron/llm/transport-diagnostics.ts` 这个文件。所以本项收益是"把已有一档 network 细分为三因"，不是"从无到有"；评估件 `:112` "触碰 1 个文件、预计冲突 1–2 处"漏了上游第二个文件与它的新文件性质。

### ④ 3 笔非 merge 提交的 A1 试打 —— 原法在本机不可执行，替代法结果与评估件 A1=0 一致

- **原法不可执行**：本机 `github.com:443` git 协议不通（评估件 §二 已实测并标注"别试"），本地无该批 commit 对象，`git cherry-pick -n` 无从下手。这不是评估件缺陷，是环境事实。
- **替代法**（等价于"把该提交的净 diff 打到基线树上"）：取 atom 前 12 条非 merge 中时间上/中/下各一——`de21162642`(ci)／`af28e9ed4c`(feat IPC)／`bbbd51831a`(docs)，各自 `git show upstream-baseline:<path>` 还原基线文件后用 `git apply --check` 试打：
  - `ci`：3 文件，**2 个基线不存在**（`scripts/check-baseline-shrink.mjs`、`scripts/__tests__/check-baseline-shrink.test.ts`）→ 不干净
  - `feat-ipc`：9 文件，**7 个基线不存在**（`electron/ipc/direct-handle-baseline.json` 等）→ 不干净
  - `docs`：1 文件，基线在，但 `patch failed: .claude/skills/verify/SKILL.md:60`（上下文已漂移）→ 不干净
  - 结论：**随机 3 笔 0/3 可整体挑选**。这与评估件 `:55`/`:125` 的 **A1=0** 判定方向一致，且反过来支持它的方法论：吸收必须**按文件簇**、不能按提交整体 cherry-pick。

### ⑤ "22 补丁 14 个 apply --check 全过" —— 未落盘，但我抽 3 复现，3/3 通过

- 评估件 `:57` 自述"其中 14 个在 develop 主工作树 `git apply --check` 全部 OK"，**盘上没有这 22 个补丁文件**（`.batch/night/reports/` 下无 `*.patch`/`*.diff`），按派验单口径记 **"证据未落盘"**。
- 我自生成 baseline→master 补丁复现（三件先做项文件）：

| 文件 | 补丁行数／字节 | sha256 前 16 | `git apply --check`（develop 主树） |
|---|---|---|---|
| `src/services/workflows/workflow-utils.ts` | 276 行／13,232 B | `34c5d2c8538fb6ae` | **OK** |
| `electron/services/manuscript-publisher.ts` | 122 行／5,959 B | `5db69de5e0fbaf56` | **OK** |
| `src/services/generation/prompt-budget-failure.ts` | 202 行／12,653 B | `6d0555fe7abfc637` | **OK** |

- 附带核到一条对成本判断有用的事实：**我方这三件与基线逐字节相同**（`cmp -s` 全 SAME-AS-BASE；sha256 前 16 依次 `b5c410a0576c7cdb`／`b7374bbadd6702b2`／`86f8d097d6593cbb`；`manuscript-publisher.ts` sha1 `ac95b25b61201116a75adeb70419921f8f0cab04`），字节数 14,406／5,226／13,940，与上游 master 的 17,274／7,342／15,080 对应 ⇒ 三件确属评估件 `:49` 的 `OURS_EQ_BASE 410`，**冲突不会来自我方私有改动**，冲突只来自上游自身后续演进。

## 条件（放行前须改）

- **C1**：`:106` 删除"我方对应位置已知（`isWorkflowCancellation` 同族）"，改为「我方无该类型，4 个抛点在 `workflow-utils.ts:57/60/63/236`，需新建取消类型并收口」，工作量 S/M → M。
- **C2**：`:110` 补一句"我方无 `reservedManuscriptTargets`／`republishTarget`，须新建机制 + 改 publisher 签名"，避免"冲突 3–5 处"被当成改动面。
- **C3**：`:112` 补"上游同时改 `electron/llm/transport-diagnostics.ts`（我方无此文件）；我方已有 `'network'` 一档（`:79`/`:116`），收益是三因细分"。
- **C4（过程）**：22 补丁的生成脚本与补丁本体应随评估件落盘（`.batch/` 下），否则 `14/22` 无法复核；本次我按 `git diff --no-index` + `-p2` 自建，方法附于下。

## 复现方法（供复核）

```bash
# 取上游 master 的三件（raw 通道可用）
curl -sS -o up/<name>.master https://raw.githubusercontent.com/EthanYoQ/Pagekin/master/<path>
git show 549522d4:<path> > up/<name>.base          # 或用本地 upstream-baseline
mkdir -p up2/a/<dir> up2/b/<dir>
cp up/<name>.base up2/a/<path>; cp up/<name>.master up2/b/<path>
git -C up2 diff --no-index a/<path> b/<path> > up2/<name>.patch
git apply -p2 --check up2/<name>.patch             # 在 develop 主树执行
```

**工具坑（留给后来人）**：本机 `diff` 是 WinuxCmd 1.2.1（`/c/Users/…/winuxcmd/usr/bin/diff.exe`），生成的补丁 hunk 头计数与正文不符（例：`@@ -1,3 +1,8 @@` 只跟 5 行），`git apply` 一律报 `corrupt patch`。**生成 git 补丁必须用 `git diff --no-index`，别用 `diff -u`。**

## 未取部分与原因

- 29 笔剔除提交的逐笔定位：配额所限（60/h，剩 2）。
- commit 级 `cherry-pick -n`：git 协议不通、本地无对象（评估件 §二 已列死路，未重试）。
- 22 补丁中另外 19 个：受验方未落盘，只需抽 3 复现（派验单口径）。
