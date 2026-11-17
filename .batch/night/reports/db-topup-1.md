结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/db-topup-1.md ｜ 判定线：文件型（首段含「结论：」+ 6 份逐一列出 + 每份 ≥1 处 develop 现值 `文件:行` + 三态计数） ｜ 证据：6 份全部复核，三态 = 仍成立 4 / 需改行号 1 / 已失效 1；每份均带 `13240ffd` 上的实取行号

# DB-T1 · 按 develop 现值复核 6 份报告（只读）

## 0. 前提核对（已核，非 BLOCKED）

```
git -C C:\develop\workspace\AI-writer\develop rev-parse --short HEAD
→ 13240ffd
```

领先 10 个提交（`git -C develop log --oneline 8c0bd657..13240ffd` 实得）：

```
13240ffd fix(workbuddy) 开草稿改页面内 DOM click：坐标点击在可滚动侧栏会静默点空
c073159f fix(d16,b16): 按独立复核修正六处（含一处串项目显示缺陷）
e0e692d9 docs(d16): 补单轮 dev 实机复验记录
73f31757 fix(portable): 补登 D2 租约三列，恢复项目导出/便携备份可用
90770846 feat(d16,b16): 状态栏显示实际调用模型 + 内联冲突文案分层
78521ec3 docs(night-1111): 补 B11 排除项与断言行号更正
1891ded2 docs(night-1111): 按独立评审修正四项结论（B16 归因撤回 / D9 写反 / B11 降为推定 / D16 定性上修）
41f3d832 docs(night-1111): 单轮实机结果与三项待裁（B11 结案 / A2 展示层缺口 / B16 文案判读 / D9 降静态）
52c3e5cb docs(handoff) 补 8.5：aborted 确认 / 手册当场修 / 台账脚本体检 / worktree 清理
8bc4f61f fix(scripts) 台账快照体检展开区间编号，9 条假阳性清零
c441279c fix(workbuddy) 补派活落点闸门：会话 id 切换 + sessions.cwd 双校验
```

其中影响本次复核的三条：`90770846`（B16 文案分层 + 行号整体下移）、`8bc4f61f`（**台账快照脚本语义变更**）、`c073159f`（六处修正）。

## 1. 逐份三态结论（6 份）

### ① `db-15.md` — **需改行号**（并含 1 条已失效的子行）

- develop 现值锚点：`src/components/editor/CodeMirrorEditor.tsx:897`（`disabled={aiResult === '' || aiError !== null}`）—— 我原报告写 `:887`（wt-1 行号），**已下移 10 行**。
- develop 现值锚点：`src/components/editor/__tests__/CodeMirrorEditor-generation.browser.tsx:283`（`if (changedFile) await expect...('正文或原目标已变化，结果未应用；请重新选中后再试')`）—— 我原报告写「`:281`/`:335`/`:336`」，在 develop 已变成 **`:283` / `:339` / `:340`**。
- **子行已失效**：`CodeMirrorEditor-generation.browser.tsx:339` 的文案现在逐字是「来源已变化：这一稿不能保存，**请重新选中后再试**。」，而 `:340` 用 `not.toBeInTheDocument()` 断言批次层文案「后续单元不再执行」**不得出现**。原报告第 14 行判「一致（在本树）」，在 develop 已**不再一致** —— 好在原报告 §2-B 已把这条写成「缺版本锚点、合入后即失效」的风险，结论方向没写错，只需要改状态。
- 其余 anchors 未变：`vite.config.ts:52` / `:69`、`electron/services/app-data-locator.ts:30`、`electron/controllers/project-controller.ts:570`、`electron/preload.ts:9`。
- **一处行号变了**：`src/shared/generation-call-timeout.ts` 的 `DEFAULT_SINGLE_CALL_TIMEOUT_MS` 在 develop 是 `:12`（我写 `:14`，`:57` 的 `resolveSingleCallTimeoutMs` 现为 `:60`）。
- **仍成立的核心结论**（无需重做）：CDP 无 9222 默认（`vite.config.ts:69`）、`AI_NOVEL_SMOKE_OPEN_PROJECT` 旁路（`project-controller.ts:563`）、气泡无复制控件（`select-none` 在 `:831`、只有「继续原运行」`:884`）、「项目自带 DB 查询入口」在 develop 仍**本次读取范围内未找到**（`git -C develop grep "db:query|debug:db|queryDb"` 零命中）。

### ② `db-18.md` — **仍成立**

- develop 现值锚点：`package.json:26` / `:27` / `:28`（`test` / `test:node` / `test:browser` 三条脚本**逐字未变**）。
- develop 现值锚点：`vitest.browser.config.ts:29`（`include: ['src/**/*.browser.tsx']`）未变；`scripts/run-tests-electron.mjs:8`（ABI 127/145 注释）与 `:51`（`ELECTRON_RUN_AS_NODE: '1'`）未变；`vite.config.ts:128`（`test:` 段）与 `:148`（`maxWorkers: '25%'`）未变。
- **无需改动**。孤儿配置结论也在 develop 复核过：`git -C develop grep -rn "settings-browser" -- package.json vite.config.ts vitest.browser.config.ts scripts` **零命中**（本次读取范围内未找到引用），`vitest.settings-browser.config.ts` 仍是孤儿。

### ③ `db-22.md` — **仍成立**（但 D9 现值格新增了一段，需补读）

- develop 现值锚点：`docs/plans/prompt-assembly-backlog.md:114`（D17 快照格「未开工 + 2026-11-11 补注」）、`:140`（D17 现值「已结项」）、`:132`（D9 现值「待裁定…阶段 1 已接线」）、`:143`（D20 现值）—— **四处行号未变**。
- 代码侧：`electron/repositories/project-core-repository.ts:331`（`changedChapters: request.authorRecovery`）、`src/services/workflows/commands/architecture.command.ts:1367`（`export function synopsisFingerprintDrift(`）—— 未变。
- **新增内容（必须补读，但不改结论）**：`:132` 的 D9 备注在 develop 尾部多了一段「**可配置性延后（2026-11-11 登记）**：判据要求「上限可配」，现行上限写在 `RootBudget` 之外；扩成 per-call 可配要动冻结的 budget 键集（`main-generation-plan.ts:188-190` 要求键集完全相等）与 `readMainGenerationPolicy` 的版本分支，属结构性改动，需另裁」。这段是 WB-16 的直接文档依据（见 ④）。

### ④ `wb-16.md` — **仍成立**（并被 develop 侧新证据补强）

- develop 现值锚点：`electron/services/generation-run-service.ts:206`（`const callDeadline = resolveCallDeadline(budgetRemainingMs);`）—— **与 wt-1 同号同位**，仍是唯一生产调用点、仍不传 `capMs`。
- develop 现值锚点：`src/shared/generation-call-timeout.ts:31`（`resolveCallDeadline(budgetRemainingMs, capMs = DEFAULT_SINGLE_CALL_TIMEOUT_MS)`）—— 第二参数仍存在，所以「能」的判断不变。
- **补强证据（原报告缺的那条）**：`electron/services/main-generation-plan.ts:188` 有 `if (!isDeepStrictEqual(Object.keys(budget).sort(), Object.keys(MAIN_GENERATION_POLICY.budget).sort())` —— 预算键集**要求完全相等**。这正是 `backlog:132` 新段所说的「动冻结的 budget 键集」。原报告只写到「要扩 `RootBudget` 并同步 `repository:331` 白名单」，**漏了「键集必须完全相等」这道更硬的闸**；结论方向未错，建议在明早判读时补这一条。
- 原报告里「11-11 交接未找到『不是一行改动』」这句仍成立（`docs/handoffs/2026-11-11-*` 里确实没有），但现在有了**等效的文档依据**（`backlog:132` 的「属结构性改动，需另裁」），不必再靠推断。

### ⑤ `wb-19.md` — **已失效**（必须重做那一行）

- **语义变更（决定性）**：`scripts/check-ledger-snapshot.mjs:19-21` 现在写的是「单编号 `D17`（允许 `**D17**` 粗体）、**区间 `D4–D8`、并列 `D9–D11、D16`**（解析见 `expandIdCell`）。**复合行会展开成多个编号分别登记** —— 2026-11-11 首次运行时 11 条 MISSING-SNAPSHOT 有 9 条是『没展开区间』的假阳性」。
- 我原报告第 4 行写的是「`D4–D8`/`D9–D11、D16` 这类复合或派生编号**只记入未识别附注，不参与判定**」——**在 develop 已完全相反**（现在会展开并逐一参与判定，`:54-60`、`:208-211` 的「复合行」预览逻辑）。成因提交：`8bc4f61f fix(scripts) 台账快照体检展开区间编号，9 条假阳性清零`。
- 行号也移了：退出码说明从我的 `:40` 变成 develop 的 `:42`；`未识别的编号型行` 从 `:225-231` 移到 `:269`。
- **其余 4 行在 develop 复核后仍成立**：`scripts/check-fast.mjs:24-26` 仍是 **3 步**（typecheck / doc-links / doc-placement `--strict`，行号从 wt-1 的 `:23-27` 小幅上移到 `:24-26`，步数未变）；`scripts/check-doc-placement.mjs:246-247` 仍是 `strict && fresh.length > 0 → exit(1)`；`run-tests-electron.mjs` 仍是 runner（`:8`/`:51` 未变）。但「对照表数据行 = 5」里有一行性质变了，**整份需要重做或至少就地改这一行**（含把 `check-fast.mjs` 行号改成 `:24-26`）。

### ⑥ `wb-20.md` — **仍成立**

- develop 现值锚点：`electron/services/webdav-backup-service.ts:443`（`if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { /* Preserve the operation error. */ }`）—— **行号与内容逐字未变**。
- 结论「对备份成败=否 / 对清理残留=是」不受任何 develop 提交影响（`90770846`/`c073159f` 改的是编辑器与模型显示，未触碰 webdav 服务）。
- 唯一提醒：原报告说「DB-12 报告里未找到把本处列进 9 处清单的痕迹」，已在 develop 复核——`git -C develop grep -n "webdav" -- scripts/night/20261111/db-12-silent-failure-sweep.md` **零命中**，该普查确实没点名本处。

## 2. 三态计数

| 三态 | 数量 | 报告 |
|---|---|---|
| **仍成立** | **4** | `db-18.md`、`db-22.md`、`wb-16.md`、`wb-20.md` |
| **需改行号** | **1** | `db-15.md`（`:887→:897`、`:821→:831`、`:874→:884`、`:281/:335/:336→:283/:339/:340`、常量 `:14→:12`；另有 1 条子行「文案仍可复制」已失效） |
| **已失效** | **1** | `wb-19.md`（`check-ledger-snapshot` 的「复合编号不参与判定」被 `8bc4f61f` 反转） |

## 3. 一句话（明早怎么用）

**`db-18` / `db-22` / `wb-16` / `wb-20` 可直接进明早判读；`db-15` 改掉 5 处行号 + 1 条文案状态即可用；`wb-19` 必须重做——它关于 `check-ledger-snapshot` 的那一行，在 develop 现值上已经是反的。**

## 4. 未做 / 边界

- **没有改动已交的 6 份报告**（红线 3 与本卡要求）：本文件只给「建议改哪行」，原件保持 wt-1 读数面并在首段自报了口径。
- **未重跑任何测试**（红线 1）；`13240ffd` 上的行号全部来自 `git -C develop grep` 实取，不是从 wt-1 推导。
- **未核** develop 的 `vite.config.ts` 与 wt-1 是否逐字节相同（只核了 `:52/:69/:128/:148` 四处关键行一致）。
- **未核** `db-15` 其余 15 行（如 `:37` 的手册条目本身、`:102` 的 `菜` 字断言等）是否也在 develop 位移——只核了被 B16 改动波及的 UI 与文案行。
- **不确定**：`db-18` 里「641 个 `*.test.*` 与浏览器配置不重叠」这类计数在 develop 是否仍相同（本次未重扫文件数，只核了配置与脚本入口）。

DONE
