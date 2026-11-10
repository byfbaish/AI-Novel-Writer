# 2026-11-10 · R2 存量红修复收尾与验证交接

- **状态行（2026-11-10 20:5x）**：代码已落主线 `exp/resource-ledger`（**未推送**）· browser 全量复跑未做（作者自行分配）· 2 项需实机 · 本稿可直接作为下一窗口的执行清单
- **接手入口**：先读 §3（验证）与 §5（悬留），再看 §1 改了什么
- 本轮授权：可改码 + 可提交（不含推送），依据 11-10 交接稿 + 作者 20:10 四项批准

## 0. 一句话

主区 browser 存量红 **30 failed / 808 passed / 838** 中，W3 已修的 4 条已在全量复跑确认转绿（19:52，26 failed / 812 passed），本轮把 **17 条夹具漂移 + 7 例契约兜底** 全部落主线，预期收敛到 **2 failed / 835 passed / 837**（总数 −1 是 B8 用例被删）；剩下 2 条（B11、B16）必须实机判定后才能定修法。

## 1. 本轮做了什么（三个提交，均可独立回滚）

| 提交 | 内容 | 文件 |
|---|---|---|
| `4184cae1` | `merge(w3)` 测试夹具漂移修正 4 处期望值/选择器（作者亲自派单的 W3，`530ca39a`） | 3 个 `*.browser.tsx` |
| `9c3c913c` | `test(browser)` **R2-A**：夹具补齐 + 断言重写（WorkBuddy 在 wt-2 产出，中控取 patch 落主线） | 5 个 `*.browser.tsx` |
| `7a800313` | `fix(characters)` **R2-B**：定稿候选面板契约硬化 + 三夹具补契约返回（豆包在 wt-1 产出，含中控补的两处 channel 全集断言） | 1 产品 + 3 夹具 |

### R2-A 逐项

- `chapter-writing-model-selector.browser.tsx`：`installIpc()` 补 `if (channel === 'db:draft-list-all') return []`（8 例）——**8 例的期望值一字未改**（起点章仍是第 10 章）。
- `ReviewReport.confirmation.browser.tsx`：在「检查通过（N）」折叠区断言前补点击（3 处：2 个用例，其中一个因重渲染要点第二次）。产品依据 `ReviewReport.tsx:1322-1331`（`passCount > 0` 才渲染 toggle，`aria-expanded={showPassed}`）。
- `f05-writer-immersion.browser.tsx`：夹具挂真实 `<StatusBar />`（原为 `<p>状态</p>` 占位，`ShellV2.tsx:71` 原样透传 ⇒ 底部三入口从未存在）+ title 映射改「打开任务/打开日志/打开模型」（`StatusBar.tsx:90-93`）。
- `batch-chapter-completion-mode.browser.tsx`：白名单加 `knowledge_candidates` + effect 三分支（`{ success, stepKey:'knowledge_candidates', candidateCount:0, dropped:[], factCount:1 }`，对齐 `src/shared/finalization-generation.ts:109-118`）+ 步骤顺序断言（`finalize-chapter.command.ts:590/611`）。
- `f05-writer-feedback.browser.tsx`：U13.A01 改为点「查看当前输出（低频）」+ `vi.waitFor(..., { timeout: 4000 })`（产品运行态只渲染 `RunningStepStatus`/`LiveOutputPeek`，1500ms 低频刷新）；U13.A02 按「已结束步骤才卸 `<think>`」重写；**删除 B8**（推理 store 已不投面板，前提消失）。连带删 `useWorkflowReasoningStore` import / `originalReasoning` / afterEach reset。

### R2-B 逐项

- `FinalizedCharacterStateCandidatePanel.tsx:43` 起：`setSummaries(Array.isArray(pending) ? pending : [])` + `setBoard(deltas && Array.isArray(deltas.pending) && Array.isArray(deltas.hits) ? deltas : EMPTY_BOARD)`。**性质是「契约硬化」**：兑现 `:42` 注释，线上 handler（`electron/services/finalized-character-generation.ts:52-58`）恒返回正确形状，**不是修复线上白屏缺陷**。
- 三夹具补 `list-state-candidates → []`、`list-card-deltas → { pending: [], hits: [] }`（`f05-writer-graph`、`v3-characters`、`CharactersView.search`）。
- `f05-writer-graph.browser.tsx:269/:294` 两处 channel 全集断言补 `'finalized-character:list-card-deltas'` —— **中控补的**，依据豆包报告 §4.1：夹具补齐后面板不再崩、两 channel 都会出现在 `mock.calls`，不补这两处会从 `TypeError` 变成「Set 不等」。

## 2. 现状与预期

| 项 | 值 |
|---|---|
| 修复前基线 | `30 failed / 808 passed / 838`（`develop/.runtime/night/browser-20261110.log`，03:25） |
| W3 后实测 | `26 failed / 812 passed`（19:52，W3 4 条转绿） |
| 本轮后**预期** | `2 failed / 835 passed / 837`（总数 838−1 = B8 删除） |
| 剩余 2 条 | **B11** `RendererStartup.browser.tsx:137` 监听器 1 vs 2；**B16** `CodeMirrorEditor-generation.browser.tsx:281` 冲突提示精确文案 |
| 未验证部分 | **R2 的 24 条全部未跑过**（作者口径「先改不测」）；`tsc --noEmit` 通过只证明类型层 |

## 3. 验证方案（browser 只能主区串行；执行人由作者分配）

### 阶段 0 · 前置
```powershell
cd C:\develop\workspace\AI-writer\develop
git status --short          # 期望：仅 M docs/handoffs/2026-11-10-night-closeout-and-next-steps-handoff.md + ?? .batch/
node scripts/check-fast.mjs # 期望全绿（本轮已跑：typecheck ✓ / doc links 1411 断裂 0 / placement 新增 0）
```

### 阶段 1 · W3 的 4 条（已在 19:52 全量里绿过，这里只是最小回归）
```powershell
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts `
  src/components/__tests__/project-writing-language.browser.tsx `
  src/components/layout/v2/__tests__/v3-settings-backup.browser.tsx `
  src/components/layout/v2/__tests__/v3-shell.browser.tsx
```
**期望** 3 files 全 passed。若红 ⇒ 回滚 `4184cae1`（`git revert -m 1 4184cae1`）。

### 阶段 2 · R2 触及的 10 个文件
```powershell
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts `
  src/components/dialogs/__tests__/chapter-writing-model-selector.browser.tsx `
  src/components/dialogs/__tests__/batch-chapter-completion-mode.browser.tsx `
  src/components/editor/__tests__/ReviewReport.confirmation.browser.tsx `
  src/components/layout/v2/__tests__/f05-writer-immersion.browser.tsx `
  src/components/layout/v2/__tests__/f05-writer-feedback.browser.tsx `
  src/components/layout/v2/__tests__/f05-writer-graph.browser.tsx `
  src/components/layout/v2/__tests__/v3-characters.browser.tsx `
  src/components/panels/sidebar/__tests__/CharactersView.search.browser.tsx `
  src/components/startup/__tests__/RendererStartup.browser.tsx `
  src/components/editor/__tests__/CodeMirrorEditor-generation.browser.tsx
```
**期望** 只剩 B11/B16 两条红。任何**其它**红 ⇒ 按失败集合回滚对应提交（`9c3c913c` 管 5 个测试文件，`7a800313` 管面板 + 3 夹具）。

### 阶段 3 · 全量
```powershell
pnpm test:browser
```
**期望** `2 failed / 835 passed / 837`；若 0 failed ⇒ B11/B16 也顺手绿了，§4 可跳过（记一笔即可）。

### 判定纪律
- 只比「失败集合 diff」，不比失败数。
- 出现新红时先 `git revert` 对应提交再查，不带着新红往下走。
- `pnpm test <*.browser.tsx>` **不能用**（`scripts/run-tests-electron.mjs` 不传 `--config`，include 收不到 browser 文件，必定 `No test files found`）。

## 4. 需实机两项（作者自行分配；外派 agent 禁 `pnpm dev`/CDP）

### B11 · `RendererStartup.browser.tsx:137` `expect(listeners.size).toBe(1)` 实得 2
**先静态判（10 分钟，不用实机）**：
1. 读 `src/components/startup/RendererStartup.tsx:41-47`（让位 effect）与 `src/components/layout/TitleBar.tsx:75`（订阅），列出两者订阅的 **channel / 事件名** 与 `off` 清理是否成对。
2. 同 channel 且清理不对称 ⇒ **真泄漏**：修产品（删一处订阅或补 `off`），测试 `toBe(1)` 不动。
3. 不同 channel ⇒ **测试缺陷**：把 `:137` 改成按 channel 过滤后的计数（或改断言 2），产品不动。
4. 只有静态判不出时才实机：`pnpm dev` → DevTools Console → 包一层 `ipcRenderer.on` 计数探针 → 看启动后同 channel 订阅次数。

### B16 · `CodeMirrorEditor-generation.browser.tsx:281` 冲突提示精确文案
1. 造 stale：副本项目改上游（卷/大纲）→ 让当前章稿 `sourceChanged`。
2. 实机打开该章编辑器，截图记录提示条**真实文案**。
3. 对照 `src/shared/source-conflict-copy.ts:21-32,38-41` 的 `sourceConflictNoticeText`（两句拼接）与 `handleAcceptAI` 的另一条旧文案分支。
4. 结论：拼接正确 ⇒ 改测试用 `toContain`/拼接串；产品显示错 ⇒ 修产品（小改，可外派）。
> 大概率是测试写法问题，但必须实机确认走哪条分支，**不能靠推**。

## 5. 悬留与待裁定（下一窗口）

1. **A1 正文批量重跑**：仍未实机；判据（原「同 run 连续 3 章全成功」vs 放宽「≥2/3 + 失败章靠续跑走完」）**待作者拍**；中控夜班只做调度，未跑。
2. **W1 断章舍弃**：作者 11-09 21:1x 裁定「先做断章舍弃再合并 W1」；W1 候选 patch 仍在 `develop/.runtime/patches/w1-candidate.patch`（17230 B），wt-2 有 `stash@{0} night-20261110-w1-candidate-rescue`。W5 设计草案在 `wt-2/.batch/night/W5-incomplete-chapter-discard-draft.md`。
3. **W4 / D9 挂点**：报告 `wt-2/.batch/night/W4-d9-hook-points.md`（20097 B）建议候选 3（owner 层）+ 候选 1（单次调用计时粒度），最小改 1 个产品文件 `electron/services/generation-run-service.ts:200-209`（`:273/:285` 区分超时与取消），**是否立项待作者**。
4. **C 层状态行**：D4/D5/D13/D18/D20 仍为「已实施（未实机）」，已回填台账现值（`19c7f8a4`）。
5. **worktree 残留**：`wt-2` 有 5 个未提交 `M`（= 已落主线的 R2-A）、`wt-1` 有 4 个未提交 `M`（= 已落主线的 R2-B）。**下次派活前按渠道手册先 `git -C wt-N reset --hard <主线 HEAD>`**；执行前需作者确认（历史上有过拒绝）。
6. **看板**：11-10 夜跑 14 张 trace 卡已归位（revision 495，running 0）；W4 卡记 `failed`（缺报告，原因在卡内）。

## 6. 速查

- 失败基线日志：`develop/.runtime/night/browser-20261110.log`（03:25，30 failed）
- 中控 patch 库存：`develop/.runtime/patches/`（`wt-2-discard-20261110.patch` 33836 B、`w1-candidate.patch` 17230 B、`r2-wb.patch`、`r2-db.patch`）
- 两份外派报告：`wt-2/.batch/night/R2-fixtures-and-rewrite.md`、`wt-1/.batch/night/R2-contract-hardening.md`
- 复核二轮：`wt-2/.batch/night/REVIEW-RECHECK-1658.md`
- 本夜总交接：`docs/handoffs/2026-11-10-night-review.md`、`docs/handoffs/2026-11-10-night-closeout-and-next-steps-handoff.md`
