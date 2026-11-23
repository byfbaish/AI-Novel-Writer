# S6 · D18 判据 4 定向取证 · QA 判词

- 受判方：QA · AI writer项目组
- 请求方：大肥鱼 · AI writer项目组（群 admin）
- gate 范围：**只判 D18 判据 4 一条**（「定稿后 `[hook-unplanted]` 出现恰一次」，`[live]`）；判据 1／2／3、D18b、D5、D15 不在本 gate
- 证据目录：`.batch/night/staging/s6-d18/`（入库提交 `2f1a13c0`，7 件）
- 判词日期：2026-11-23
- 授权范围：只读复核＋落本判词。**未重跑实机、未改证据原件、未改缺陷稿／台账／看板、未 push。**

## 0. 判定面与入库面

| 项 | sha |
|---|---|
| **判定面**（取证树 HEAD） | `89868921`（`merge(s5): D18 hook-unplanted 实现 (card/s5-d18-hook-unplanted 7b48f074)`，提交时间 2026-11-23 12:48:34 +0800） |
| **入库合并 sha** | **未合并·待主身** |
| `develop` 当前 HEAD | `2f1a13c0`（`git status --porcelain -uall` 0 行） |

取证树 `C:\develop\workspace\AI-writer\wt-s6`：`git rev-parse --short HEAD` → `89868921`，`porcelain` 0 行；`dist/index.html` mtime `2026-11-23 12:54:18 +0800`（晚于判定面提交 6 分钟 ⇒ 产物由该树构建）；`dist/assets/hook-payoff-report-CTu_8ajV.js` 内含 `[hook-unplanted] ` 字面（我 grep 命中 1 处）⇒ 实机跑的是判定面代码，不是旧包。

## 1. 证据独立复核（我自己算的，不是转述）

| 文件 | 字节 | `sha256.txt` 记值（前12） | 我重算 | git blob（`HEAD:…`） |
|---|---|---|---|---|
| `evidence-s6-d18.json` | 1,690 | `2eab2d62310a` | 一致 | 一致 |
| `evidence.json` | 36,313 | `8e5f54ac8df7` | 一致 | 一致 |
| `final-body.txt` | 8,347 | `7251b31a9c06` | 一致 | 一致 |
| `final.png` | 156,123 | `14f0dff9710b` | 一致 | —（二进制） |
| `run-finalize.mjs` | 22,697 | `a09cfa5b5875` | 一致 | 一致 |
| `evidence-report.md` | 4,050 | `4b29c2bc53fd` | 一致 | 一致 |

`sha256.txt` 自身 sha256 = `1c91f0feff31abc75d7c3cb92cdf096c4cd2bf369216836b65d856e75731d536`，其五行与实测逐项相等。当下 `tasklist | grep -ci electron` → `0`；`evidence.json` 记 `closed.pid=58208`、`instancesThisRun=1`、`leftoverElectronProcesses=0`、`exitCode=0`、`tasklistGrepCount="0"`、`tasklistHits=[]`。

## 2. 三问逐条作答

### Q1「恰一次」这个读数采信与否 —— **采信**，三条独立通道互证

- `[static]` **发射点唯一**：`src/shared/hook-payoff-report.ts:50-54`（`marker = unplanted.length > 0 ? '[hook-unplanted] ' : ''`，仅 `C5-unplanted` 非空才带）；唯一生产调用点 `src/services/workflows/commands/finalize-chapter.command.ts:959-971`（`if (hookReport) callbacks.log(hookReport)`），位于 `:951` 落库提交之后、`:980` 后处理之前，每次定稿执行至多一行。
- `[live]` **读数**：`markerLineCount=1`、`markerCountMax=1`、`markerCountFinalBody=1`；我对 `final-body.txt` 独立 `grep -c "\[hook-unplanted\]"` → `1`，且命中行（`:113`）内含本次夹具第 6 章钩子原文「第6章结尾：名册被划掉的名字在次日夜里重新浮现」⇒ 身份绑定到本 run，不是别的章／别的 run。
- `[live]` **旁证（非 DOM）**：项目库 `drafts` 第 6 章 `status=finalized`（`word_count=30`）；`contents.id=6` 正文 34 字＝`evidence.ch6Body`；`post_process_runs` 仅 1 条（`83b6e3d1…`，`source_label=第6章定稿`，`created_at 2026-11-23 05:21:36`）⇒ DB 侧只有一次定稿执行。

**边界（三条，须随收口写入）**：

- (a) 计数来源只能是渲染层日志面板文本（`document.body.innerText` ＋ `[data-testid*="log"], .log, pre` 节点）。`callbacks.log` **不落库**（§6.3-4 已定，我另 `grep` 确认无 run-log／step-log 落盘路径），故无 DB／文件侧计数可替代——这是通道限制，不是取证取巧。
- (b) 面板是**内存环形缓冲，只留最近 500 条**（`src/stores/workflow-store.ts:1182` `slice(-500)`；注释见 `src/components/panels/BottomPanel.tsx:609-613`「不落盘、关应用即丢」）。本 run `final-body.txt` 共 158 行，日志段自「开始定稿与后处理分析」完整到「工作流『第 6 章 · 定稿』已完成」，远低于 500 ⇒ 无截断风险。但 evidence **缺** §6.3-4 要求的 `logCaptureMethod` 键，报告 §偏差 3 只写了「渲染层文本＋需展开面板」，未记 500 行窗口（见 §3 记账 1）。
- (c) 脚本 `markerLineCount` 是「去重后的行集合大小」（`run-finalize.mjs:406`／`:416`），同文重复不会被它发现；重复由 `markerCountMax`／`markerCountFinalBody`（`:417`／`:433` 的 `split(MARKER).length - 1`）兜住，两者均 1 ⇒ 该盲区已覆盖。另 `exitCode=0` 由脚本 `:440`（`markerLinesArr.length === 1 ? 0 : 3`）推出，**不构成独立旁证**，本判词不以 exitCode 单独采信。

### Q2 披露的「定稿后处理两步失败」是否影响本判据 —— **不影响**

- **顺序**：marker 在 `finalize-chapter.command.ts:954-978`，正文提交在 `:951`，后处理流水线在 `:980` 之后。日志同构：`final-body.txt:111`「定稿内容已提交到 SQLite 并发布实体稿（第6章）」→ `:113` marker → `:117` 起后处理 → `:146` 失败汇总。
- **严重度**：DB `post_process_steps` 两条失败均 `critical='0'`（`knowledge_candidates`／`character_cards`），`post_process_runs.all_critical_passed='1'`；失败原因 `GENERATION_FINALIZATION_PREREQUISITE_MISSING`／`GENERATION_REQUEST_FAILED:SyntaxError`（桩模型回非 JSON）。C5 体检是纯函数 `auditDraftHook`（`src/shared/hook-payoff-audit.ts`），不起模型，与两步失败无因果关系。
- **定稿结果**：ch6 `finalized`＋`contents` 34 字＋日志末「第6章创作全流程彻底完成」「工作流…已完成」。
- ⇒ 记账不判：两步失败属其他卡／技术债，是否立卡归 admin，不进本 gate 判据。

### Q3 不扩范围 —— 遵守

只判判据 4。判据 1／2／3、D18b、D5、D15 未复核、未下结论；缺陷稿 D18 行维持 🟡，本判词**不构成** D18 整卡 ✅ 依据（是否转 ✅ 由 admin 按 S5 收口口径另裁）。

## 3. 本次新发现（非交付方自披露）· 记账项

1. **evidence 缺键**：`evidence.json` 顶层只有 13 键（`runId/mode/judgementSha/repo/projectPath/instancesThisRun/exitCode/leftoverElectronProcesses/tasklistGrepCount/tasklistRaw/tasklistHits/command/closed/steps`），无 `logCaptureMethod`、无 `sampleCount`；而 §6.3-4 明写「若日志面板有虚拟滚动/截断…evidence 记 `logCaptureMethod`」，主身 11-22 取样口径要求 `sampleCount ≥ 2` 进 evidence。**建议**：报告或收口件补一行口径说明（不改证据原件、不重跑）。
2. **取样间隔过短**：`steps` 显示 `click-confirm` 05:21:41.852Z → `read-state-after` 05:21:41.937Z，轮询首轮即 `settled=true` 并 break，两次读数（combined vs 最终 `finalText`）间隔约 85ms，不满足「连续两次读数相同且间隔 ≥ 自设最小间隔」。因采样对象是**终态**（同段已有「整个工作流已全部完成」），且与 static 单次发射＋DB 单次定稿互证，判为口径记账、**不打回**。建议脚本以后写 `sampleCount`／`sampleIntervalMs`。
3. **报告 §偏差 2 措辞**：「`physicalModelRequests` 记 0」在该 evidence.json 无对应键（该键是 S5 D5 证据里的）。等价旁证我另行取：DB `llm_calls` **0 行**。判词按 DB 采信，不按报告键名采信。
4. **计数口径半覆盖**：`markerCountFinalBody` 只对 `document.body.innerText` 计数（`run-finalize.mjs:424`），不含 `[data-testid*="log"]` 节点串；`markerCountMax` 才是 combined。两者均 1，无分歧，记账。
5. **C5-unplanted 计数旁证**：marker 行内问题句无 `；` 分隔（`problems.join('；')` 只出现 1 段）⇒ 恰 1 条 finding，与 §6.3-3④ 的旁证口径一致。

## 4. 结论

**D18 判据 4 `[live]`：PASS（取证条件成立）** —— 判定面 `89868921`，单实例一次启动、`exitCode=0`、`leftover=0`、定稿链路上 `[hook-unplanted]` 恰 1 次，静态单发射点＋构建产物含该字面＋DB 单次定稿三路互证。

限定：本条 PASS **只覆盖判据 4 一条**，不构成 D18 整卡验收通过；§2(a)(b)(c) 三条边界与 §3 五条记账须随收口件写入。缺陷稿 D18 行 🟡→✅、看板状态、合并 sha 回填均归 admin／主身，本判词不代劳。

## 5. 复核命令原文

```
cd /c/develop/workspace/AI-writer/develop
sha256sum .batch/night/staging/s6-d18/*            # 六件与 sha256.txt 五行逐项相等
git show HEAD:.batch/night/staging/s6-d18/<file> | sha256sum   # 五件与工作树全等
grep -c "\[hook-unplanted\]" .batch/night/staging/s6-d18/final-body.txt   # → 1
wc -l .batch/night/staging/s6-d18/final-body.txt   # → 158
tasklist | grep -ci electron                       # → 0（grep 退出码 1）

cd /c/develop/workspace/AI-writer/wt-s6
git rev-parse --short HEAD                         # → 89868921
git status --porcelain -uall                       # → 0 行
stat -c %y dist/index.html                         # → 2026-11-23 12:54:18.530089100 +0800
grep -ro "hook-unplanted" dist/ | wc -l            # → 1（dist/assets/hook-payoff-report-CTu_8ajV.js）

cd /c/tmp/s6-d18/proj/.ai-novel
python -c "sqlite3 …"   # drafts ch6 finalized/30；contents id=6 34 字；
                        # post_process_runs 1 条 all_critical_passed=1；
                        # post_process_steps 两条 ok=0 且 critical=0；llm_calls 0 行
```
