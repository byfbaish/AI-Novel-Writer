# 交接：D18 钩子合同 —— C1–C5 全部接线 + 七样本读数；C3/C5 首轮冒烟待收尾

> 交接基准：2026-11-05 02:35（Asia/Shanghai）· 分支 `exp/resource-ledger` · HEAD `0e79f448`（工作区另有**未提交**的 §11.13 文档，见 §四）
> D18 最后提交：`1e14f1e3` · 设计主稿：[`d18-chapter-hook-contract-design.md`](../design/prompt/d18-chapter-hook-contract-design.md) · 台账：[`prompt-assembly-backlog.md`](../plans/prompt-assembly-backlog.md) 第 105–107 行
> 任务卡：`2b7eb20d-e3e5-49f2-b9bd-53ac73be713e`（看板仍为 todo，**未走看板流程**，见 §六）

---

## 〇、三十秒版本

D18 的**接线部分全部做完了**：C1/C1b/C2/C4 接在单元批「解析后、落库前」，C3/C5 接在「正文落盘 / 定稿」，**全部只报不拦**。C1 的重跑权限**仍按作者要求没开**。

取值结果：观察副本上跑了 7 次真实单元批、写 13 章，C1/C2 **零误报**（负对照 7 次全中）；C3/C5 在副本上做了首轮生产路径冒烟（C3 零命中、C5 正对照命中并打印、不阻断），文档 §11.13 已写但**还没提交**（复核子 agent 未回报）。

**卡住的三件事都要作者拍板**：① C1 重跑权限；② §10 五条判定里的 ②③④；③ 第 17 章正文补不补（当前决定不补）。另有 D18-① 材料级删减已被作者拆出，D18-② 已按作者选的 A 落地。

---

## 一、这一班落了什么（按提交）

| 提交 | 内容 |
|---|---|
| `c84bfd98` | §10 三章验收首跑（第 6/10 章闭环、第 17 章正文受阻），设计稿 §11.6 |
| `4d2107cf` | C1 / C1b / C2 / C4 接入单元批（`architecture.command.ts`，只报不重跑）+ C2 空判据 bug 修复 + 测试 |
| `9c2d4f1f` | C3 / C5 接入正文落盘 / 定稿（`generate-draft.command.ts`、`finalize-chapter.command.ts`）+ `hook-payoff-report.ts` |
| `8965c838` | D18-① 第一刀：`blueprint-semantic-contract.ts` 删掉与模板互斥的「它不是事件」，中英同步 |
| `daa8a532` | §11.10 补 Copilot 独立扫描 7 条漏项 + 豆包读者复核 |
| `0540e722` | §11.6 正文引文逐字修正 |
| `b9e255b9` | D18-② 选 A 落地：两级弧位块去旧体系残留（清单/配额句/「离开状态」） |
| `f30b199f` | §11.10 第 7 条时态修正 |
| `33026e2e` | §11.11 首条单元批实机读数（第 18–19 章） |
| `525a23dc` / `c544a790` / `22181ce9` / `1e14f1e3` | §11.11 第二 / 第三 / 第四五 / 第六七样本（累计 7 样本 13 章） |
| `1e023492` | 豆包 `bootstrap.mjs` 补 `project-chip` 助手导入（派活工具修复，非 D18 本体） |

> 说明：`e64d52b6` / `0e79f448` 是**并行槽位**的 WorkBuddy 通道提交，不是本任务的。

### 1.1 代码落点（下次改前先读这几行）

- **C1/C1b/C2/C4**：`src/services/workflows/commands/architecture.command.ts`
  - `summarizeHookAuditFindings(body, from, to, uiText)`（`summarizeDispositionFindings` 之后），只筛 `chapter === null || from ≤ chapter ≤ to`，最多 4 条 + 计数；
  - 调用点在 `confirmedBody` 兜底之后、落盘之前，`if (unitContext)` 内，单独 try/catch（失败只记「钩子行体检跳过」）。
- **C3**：`src/services/workflows/commands/generate-draft.command.ts`，`draftPersisted = true` 之后、`publishSavedDraft` 之前，只 `callbacks.log`。
- **C5**：`src/services/workflows/commands/finalize-chapter.command.ts`，定稿事务提交后、后处理之前；`resolveHookText()` 先取蓝图 `suspenseHook`，缺失回退 `findOutlineHookLine` 解析大纲钩子行。
- **判据纯函数**：`src/shared/hook-line-audit.ts`（C1/C1b/C2/C4 + `splitOutlineBlocks` / `findOutlineHookLine`）、`src/shared/hook-payoff-audit.ts`（C3/C5）、`src/shared/hook-payoff-report.ts`（只报文案）。
- **D18-② A**：`src/shared/arc-position.ts` `renderArcPositionBlock`（`volumeWording` 分支）。

---

## 二、§10 三章验收现状（未闭环）

| 章 | 蓝图 | 正文 | 五条判定 | 位置 |
|---|---|---|---|---|
| 第 6 章 | 新模板重生成（2 次，attempt2 合规） | 新草稿 v2，1 380 字 | ①②③④ 过；⑤ 不可判（第 7 章是旧产物） | §11.6 |
| 第 10 章 | 新模板重生成（3 次；attempt1/2/3 都带模板要求的「正文停在…不写…」元指令，属正常） | 新草稿 v2，1 376 字（首次因复读失败） | ① 过；②④ 偏弱；③ 不过（正文冲过蓝图停帧）；⑤ 不可判 | §11.6 |
| 第 17 章 | 新模板生成成功 | **未生成** | — | §11.6 |

- 第 17 章正文被两道门挡住：① 蓝图重生成把 `outline:book` 推到 19 版 → `volume_handoffs` 唯一一行（volume:2）`stale`；② 就算刷新交接单，`GenerateDraftCommand` 还要求第 16 章已定稿（12–16 章无草稿）。补写约 30–60 分钟真实写入；**作者 2026-11-04 已裁定「停在蓝图、不补写」**。
- 判 ① 的**口径**：只看钩子行/蓝图 `suspenseHook`，正文对白里的问号不计（否则存量所有章都不过）。已写进文档。
- 样本指标：C3 尾段重合 22.2% / 1.7%，C5 最长公共片段 5 字 / 6 字（均 ≥3）。

---

## 三、C1/C2 实机读数（已取，可直接续）

**做法**：不动作者库 —— 整份项目复制到 `C:\develop\workspace\AI-writer\_scratch-d18\师父派我来除魔-观察副本`（projectId `4a038973-cc48-4f88-973e-9ce2b661ff29`），在副本上连跑七次 `generate_architecture`（只 `selectedSteps:["synopsis"]`），每次用页面内 `auditOutlineHooks` 复核全库 + 追加合成负对照钩子。

| 样本 | 位置 | 章 | findings |
|---|---|---|---|
| 1 | 卷 4 单元 2 | 18–19 | 0 |
| 2 | 卷 4 单元 3 | 20 | 0 |
| 3 | 卷 5 单元 1 | 21–23 | 0 |
| 4 | 卷 5 单元 2 | 24 | 0 |
| 5 | 卷 5 单元 3 | 25 | 0 |
| 6 | 卷 6 单元 1 | 26–28 | 0 |
| 7 | 卷 6 单元 2（全书收尾） | 29–30 | 0（第 30 章首现 `钩子：落点`，未报） |

- 副本大纲：11 532 → **27 865** 字 / 30 章；负对照 7 次都立即报 `C1b-format` + `C2-anchor`。
- 作者库 `synopsis` 始终 **11 532** 字未变。
- 观测到但**与判据无关**的现场行为（已记 §11.11）：七批里有三次「名义上界 ≠ 实写章数」（2→3、2→3、1→2）；第 24–28 章触发「大纲字数体检」警告（目标 600 字/章、实际 1.39 倍，只提示不阻断）；`finishReason=length` 后自动续写一轮。
- 仍没有**漏报**样本；要不要继续扩、还是先开一个默认关闭的重跑开关，等作者。

---

## 四、未提交 & 未收尾（下一班第一件事）

**工作区未提交**（`git status --short`）：

```
 M docs/design/prompt/d18-chapter-hook-contract-design.md   # 新增 §11.13 + §11.2 半句
 M docs/plans/prompt-assembly-backlog.md                    # 第 11 行补一句
?? scripts/.tmp/                                             # 全部临时脚本/样本，刻意不提交
```

- §11.13「C3 / C5 首轮实机冒烟」内容：C3 在真实草稿（第 12 章 1 343 字 v1）上执行、零命中、不阻断；C5 负对照（第 12 章定稿无 finding）+ **正对照**（把第 13 章蓝图钩子临时改成「张三丰赠丹」后定稿，控制台打出 C5 提示原文，定稿照常完成）；作者库零写入；副本第 12/13 章已 finalized、两章蓝图钩子已恢复原值。
- 已派独立复核 `c5b1c105-09cc-432e-a0ab-c917a094059d`（只读、fresh），**交接时未回报**。下一班先看有没有结果：有则按意见修正后提交；没有则**重派一个只读复核**再提交（建议提交信息：`docs(d18): 记录 C3/C5 首轮实机冒烟（§11.13）`）。
- `node scripts/check-fast.mjs` 在本次交接前已通过（typecheck 20.3s、doc-links 1111/0、doc-placement 376/0）。

---

## 五、作者已裁定 / 仍待裁定

**已裁定（都已落地）**

1. D18-② 选 **A**（两级命名下不输出「覆盖：」清单、删章数配额句、「落点状态」→「离开状态」）；旧三级逐字不变；续写路径共用渲染器自动生效。见 §11.12。
2. D18-① **材料级删减从 D18 拆出**，以后做「全环节输入材料筛查」时一起做 —— **不要在 D18 卡内做**。
3. WorkBuddy 连接器还在做，**C5 地名蹭线外部卡先不派**（`9b97f5ed-3a21-4c5b-b902-47a64164553f` 保持 todo）。
4. 第 17 章正文**暂不补写**（停在蓝图）。

**仍待裁定（问过的原话见对话 m02148 / m02987）**

1. **C1 重跑权限**：观察面已有 7 样本 13 章零误报，是否先开默认关闭的开关？
2. **§10 五条判定的 ②③④**：需要作者亲自判第 6 / 10 章正文；文档里标的是「代理起草，待作者复核」。
3. 第 17 章正文缺口是否接受（当前：接受，记为未闭环）。

---

## 六、环境与数据现场（重要）

- **应用**：dev server `http://localhost:5180`，CDP `9222`；当前开着**作者项目**，不是副本。启动方式：`AI_NOVEL_UI_DEBUG_PORT=9222 node node_modules/vite/bin/vite.js`（`pnpm dev` 的 shim 坏着）。
- **作者项目**：`C:\develop\workspace\AI-writer\师父派我来除魔，幕后真凶竟是小师妹`，`.ai-novel/project.db` 12.7 MB；现状：`synopsis` 11 532 字、blueprints 13 行（max=17）、finalized 11 章、outline 第 19 版。本轮除 §10 首跑的 ch6/ch10/ch17 蓝图与 ch6/ch10 草稿 v2 外未再写入。
- **观察副本**：`C:\develop\workspace\AI-writer\_scratch-d18\师父派我来除魔-观察副本`（仓库外、未跟踪）；30 章大纲 27 865 字、outline 第 28 版、第 12/13 章已 finalized、blueprint 13 已生成；`volume_handoffs` 仍只有 volume:2 一行（`source_ref` 已被 upsert 刷到最新，valid）。
- **备份**：`scripts/.tmp/db-backup/`（作者库 11-04 20:04）、`scripts/.tmp/db-backup-2-*/`（11-04 21:47）。
- **恢复副本登记**：`scripts/.tmp/register-copy.cjs` 会把副本写进 `~/.ai-novel-writer-dev/generations/88ac198e-…/recent-projects.json`（备份 `.bak-d18`）；交接前已把该文件恢复成**只有作者项目**。

### 6.1 踩过的坑（别再踩）

1. **读库**：`better-sqlite3` 是 Electron ABI，普通 Node 加载报 `NODE_MODULE_VERSION 145 / 137`；必须 `ELECTRON=$(node -p "require('electron')"); ELECTRON_RUN_AS_NODE=1 "$ELECTRON" <脚本>`，且脚本要放仓库内（否则找不到模块）。
2. **开任意目录**：`project:open` 只认 `recent-projects.json` 里的路径（或 `AI_NOVEL_SMOKE_OPEN_PROJECT`），否则报「项目未获授权」；registry 里存的是**反斜杠**路径，脚本里用正斜杠会匹配失败（openProject 返回 false 且无报错）。
3. **单元批/蓝图生成都会推 `outline:book` 一版** ⇒ `volume_handoffs` 立刻 stale，随后任何 `generate_draft` 都被 `generate-draft.command.ts:2713-2718` 挡住。写正文前先 `scripts/.tmp/resave-ho.mjs` 原样重存刷新 `source_ref`。**作者项目第 17 章正文被挡就是这条链。**
4. **Vite HMR 双实例**：launcher 内部 import 带 `?t=` 的 store，裸 import 是另一个实例，会话比对恒 mismatch；从 launcher 源码正则取 `?t=` 再用同一 query import（`scripts/.tmp/run-wf.mjs` 已封装）。
5. **CDP 求值里的换行**：外层模板串里的 `\n` 会被展开成真换行导致 SyntaxError —— 用 `String.fromCharCode(10)` 或改传 JSON 文件。
6. **vite watch EBUSY**：并行会话/复核在 `scripts/.tmp/` 里造 `.tmpdir` 会让 vite 崩（exit 1）；复核期间别同时开 dev，崩了直接重启。
7. **`pnpm` shim 坏**：用 `node scripts/check-fast.mjs`、`node scripts/run-tests-electron.mjs <paths>` 直调。

### 6.2 临时脚本索引（`scripts/.tmp/`，未跟踪，别当成品）

| 脚本 | 用途 |
|---|---|
| `run-wf.mjs '<intent>' <秒>` | 页面内发工作流（launcher 路径）并轮询日志/状态，HMR `?t=` 已处理 |
| `run-finalize.mjs` / `run-finalize13.mjs` | 直造 `FinalizationSnapshot` 调 `createFinalizeWorkflow`（§11.13 用） |
| `run-unit.mjs` / `register-copy.cjs` / `open-copy.mjs` | 开观察副本、跑单元批、探针 |
| `resave-ho.mjs` | 原样重存卷交接单，刷新 `source_ref` |
| `audit2.mjs` / `audit-live.mjs` / `c3eval.mjs` / `c5eval*.mjs` | 页面内跑 `auditOutlineHooks` / `auditDraftHook` 并打印 metric |
| `ch12.cjs` / `ch13.cjs` / `set-bp12.cjs` / `set-bp13.cjs` / `restore-hooks.cjs` | 副本第 12/13 章取证与钩子改回 |
| `samples/*.json`、`samples/*.txt` | 蓝图/正文样本（ch6 两版蓝图、ch10 三版、ch17 蓝图、ch6/ch10 正文 v2、副本 18–19 章钩子） |

---

## 七、下一步建议（按优先级）

1. **收 §11.13**：拿复核结论 → 修正 → 提交（只 add 那 2 个 md）。
2. **向作者要三个裁定**（C1 重跑权限 / §10 ②③④ / 第 17 章正文）；拿到 C1 权限后再写代码，改动点已定：`architecture.command.ts` 体检处加「默认关闭开关 + 单次重跑预算 1 + 跳过手标行 + 记日志」，必须单独提交并复核。
3. **界面承载**：现在只进步骤日志；作者还没定「报给谁、在哪显示」（清点页 / 面板）。先出设计稿再改 UI。
4. **D18-② 剩余**（不在本轮，别顺手做）：模板内置 synopsis 旧「覆盖：」合同（仅非 volume 路径）、UI 对存量「覆盖：」行的消费。
5. **D18-① 材料级删减**：独立待办，等「全环节输入材料筛查」立项。
6. **C5 地名蹭线**：WorkBuddy 卡已建、等连接器；豆包可作为读者视角第三方（本轮豆包给出第 6 章「立住」/第 10 章「蹭线」，仅 ②③④ 可采信）。
7. **任务卡**：D18 卡（`2b7eb20d…`）没走看板流程（没 claim、没报告）。如果这轮要收口，需补 `.dsh-task-board/reports/2b7eb20d-….md` 并让作者/另一身份复核；卡上的旧验收（三环节合并、③「标记」）与当前演进的方案已不一致，先跟作者对齐再改卡。

---

## 八、证据索引

- 设计稿：§11.6（§10 首跑）、§11.7（C1/C2 接线）、§11.8（C3/C5 接线）、§11.9（D18-① 第一刀 + 实机复验）、§11.10（D18-② 清单 + Copilot 7 条）、§11.11（C1/C2 七样本）、§11.12（D18-② A 落地）、§11.13（C3/C5 冒烟，**未提交**）。
- 台账：`docs/plans/prompt-assembly-backlog.md` 第 105–107 行（D18 / 11b / 11c）。
- 关键 run id（副本库 `generation_runs`）：`839dfbad-1b27-46fd-9b87-548c0eb086d4`（ch12 写稿）、`73065f23-693a-44bc-a055-8c983177920c`（ch13 蓝图）、`896ab115-976b-4a50-b2ea-c87b88611121`（ch13 写稿）；定稿工作流 id：`8164364e-…`（ch12）、`aba9a9a3-…`（ch13）。
- 复核记录（都在对话里，未落文档）：`91e601b4`（C1/C2 PASS）、`4788f112`（C3/C5 BLOCK→已修）、`04b4f379` / `07dee596` / `e0dbbe26`（D18-② A 三轮 → PASS）、`22fc73d3` / `725863e9` / `2bdb2b25`（D18-① 两轮 BLOCK → 修正后 PASS）、`faf31eaf`（§11.11 首样本：BLOCK 工作区漂移）、`6c751f46` / `9c89e54a`（§11.11 第三样本）、`b629640f` / `b24c5e50`（§11.11 第四–七样本）、`c5b1c105`（§11.13，**未回报**）。
