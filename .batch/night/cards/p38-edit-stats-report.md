# 卡 · P38 · 审稿报告显示本章编辑计量（A2/A3 最后一公里）

- 卡号：P38（改码）
- 起点：`66b188f8`（分支 `exp/resource-ledger`，仓库 `C:\develop\workspace\AI-writer\develop`）
- 估时：45 分钟
- 授权：允许改码 + `git add` 点名文件 + **一个** commit；禁 `-A`、禁 push、禁 reset/checkout/stash、禁建分支
- 依据：`p37-verdict.md`（路线取候选 2：主进程只读通道返回原始行，口径在渲染层算）

## 一、必做（四条）

1. **主进程只读通道**：新增 `db:draft-edit-stats`，入参 `[draftId, expectedProjectPath]`，套既有 project-session 守卫（照抄相邻 handler 的写法），返回该 draft 的全部行（复用 `DraftEditStatsRepository.listForDraft`，不要新写 SQL 聚合）。
2. **通道契约**：`src/shared/ipc-channels.ts` 加 1 条声明（与邻居同风格）。
3. **渲染层取数**：`src/components/panels/EditorArea.tsx:792` 给 `<ReviewReport>` 多传 `draftId={activeTab.draftId}`（`DraftEditor.tsx:634` 已在标签页写 `draftId`）；`ReviewReport.tsx` 在报告页顶部加一小节「本章编辑计量」。
4. **口径（写死在渲染层纯函数里，便于单测）**：
   - 保存次数 = 全部行数；
   - **作者动作数 = `origin === 'human' && changed_chars > 0` 的行数**（缺省计入 ai，`db-controller.ts:1255-1256` 原文 `origin: origin === 'human' ? 'human' : 'ai'`；AI 修稿不得算作者动作）;
   - **千字改动 = 只用 `origin === 'human'` 的行**算 `sum(changed_chars) / sum(new_chars) * 1000`，保留 1 位小数；分母为 0 时显示「—」；
   - 范围 = 该 draft 的全部行（不做「本次定稿以来」截断，交给读者自行理解）；
   - 无行时显示：`暂无计量数据（本版起记录）`，不报错、不画空表；
   - 通道失败（抛错/超时）显示：`计量读取失败`，**不得影响报告正文渲染**。

## 二、文案（先用这一版，按注释说明可被产品经理微调）

```
本章编辑计量：保存 12 次 · 作者改动 9 处 · 千字改动 34.2
（仅统计作者本人改动，AI 修稿不计）
```
- 数字右对齐、灰色小字、`font-size` 与报告正文的次要信息同级；不新增配色 token。
- 若产品经理后续改文案，改字符串不算返工。

## 三、禁动区

- **不许动 AI 报告 JSON 合同**：`src/shared/review-generation-report.ts`、`review-chapter.command.ts`、`ReviewReport.tsx:65-80` 的 `ReviewJSON` 接口，一律不改；不许往报告 JSON 里加字段。
- 不许改 `generate-draft.command.ts` 的 `callbacks.log` 那条链（A1 只写日志是定则）。
- 不许改既有 schema / 不加迁移 / 不加依赖 / 不动 `review_findings`。
- 不许动 `draft-edit-stats-repository.ts` 的写入语义。

## 四、测试（必须 `pnpm test`，禁 `node vitest`）

- 口径纯函数单测四条：①空行数组；②全部空保存（`changed_chars=0`）；③混合（含 `new_chars=0`）；④正常三数。
- handler 最少一条：返回行、项目路径不符时不返回（照抄相邻 handler 的既有测试写法即可）。
- 全量 `pnpm test` 必须绿，且**不许删既有用例**。

## 五、交付

- 一个提交，`git add` 点名文件（预期 5 个左右：`ipc-channels.ts`、`db-controller.ts`、`EditorArea.tsx`、`ReviewReport.tsx`、测试文件）。若实际改动超出预期，在报告里逐文件说明为什么必要。
- 报告 `.batch/night/reports/p38-edit-stats-report.md`，末行 `<!-- DONE -->`。
- 信号 `.batch\night\signals\doubao\p38-edit-stats-report.done`，三行（报告路径 / SHA / `<!-- DONE -->`），报告落盘同一分钟内写，**信号写后不许原地改写**。
- 回执贴：`git rev-parse HEAD`、`git show --numstat`、`git status --porcelain`、报告字节+MD5、测试尾部原文。

## 六、投递指令

- 落点是 `C:/develop/workspace/AI-writer/develop`；开工先 `git rev-parse --show-toplevel` 与 `git rev-parse --short HEAD` 自证，不是 `develop` 或 HEAD 不是 `66b188f8` 就**停下报实况**，禁自行 reset/checkout/stash。
- 探针只进 `scripts\dsh\wakeup-inbox`；`signals\doubao\` 只放交付信号。

补充三条（联络人 2026-11-14 16:1x 投前加，不改卡面已有要求）：
- **测试命令**：口径纯函数与 handler 的单测都用 `pnpm test <文件路径>` 跑；本机 `node vitest` 会因 `better-sqlite3` ABI（Electron 145 / Node 137）全红，那是环境不是代码。
- **回执前四行固定**：
```
投前 currentSessionId：<值>
投后 currentSessionId：<值>
是否一致：是/否
例外依据：不适用（未用 --new）
```
  再加：模型芯片原文、报告字节+MD5、信号路径。
- 提交后不要在本卡再加第二个提交；报告里的读数以最终 HEAD 为准。**禁 push**（推远端由负责人/developer 做）。
