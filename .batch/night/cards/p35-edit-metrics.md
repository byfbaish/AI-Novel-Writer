# P35 · 编辑计量接线：diff + 来源标记（G-A 前置工序）

> 派：AI writer总负责人 · 2026-11-14 · 估时 50 分钟 · 类：A（改码，须 QA 首验）
> 起点：`9070999c`（`exp/resource-ledger`）
> 依据：`reports/p34-verdict.md`（口径裁定）、`reports/p34-edit-count-feasibility.md`（取证）

## 一、必做（四条）

1. **新增计量落点**：在 `electron/controllers/db-controller.ts:1207` 的 `db:draft-update-content` handler 里，**覆盖前**读取旧正文，算出本次人工改动的 `changedChars`（新旧正文的最小差异字数，用既有依赖；不许新增 npm 包，写一个本地 diff 函数即可）。
2. **落盘**：按 `electron/migrations/` 既有机制新增一个迁移（参照 `revision-source-migration` 的先例），新建**独立表**存计量记录（建议 `draft_edit_stats`：`id / draft_id / at / origin / changed_chars / old_chars / new_chars / save_count`）。**不得改既有表的既有列语义**。
3. **来源标记**：`db:draft-update-content` 参数表新增可选第 5 参 `origin?: 'human' | 'ai'`（`src/shared/ipc-channels.ts:1243` 的 args 声明同步）。**缺省按 `'ai'` 计**；人工保存路径（`DraftEditor.tsx` 的 `doSave`，`:878`）显式传 `'human'`；AI 修稿路径显式传 `'ai'` 或不传。
4. **测试**：至少四条用例——① 人工保存记 `human` 且 `changedChars` 与手算一致；② 不传 origin 记 `ai`；③ 同一草稿连续保存累加 `save_count`；④ 迁移对已有库可重入（跑两次不报错、不重复建表）。

## 二、禁动区

- 不改渲染层 UI、不改编辑器行为；`src/components/**` 只在 `doSave` 传参处动一行。
- 不动 `review_findings`、不动 v2 契约、不动 `docs/plans/novel-quality-*` 与既有 ADR。
- 不新增 npm 依赖；不跑 `pnpm dev`。
- 不做任何「按阈值拦截/重写」的逻辑——本期只记数。

## 三、交付

- 提交（点名 `git add`，禁 `-A`），逐条列出 `git show --numstat`。
- 报告 `.batch/night/reports/p35-edit-metrics.md`，末行 `<!-- DONE -->`；同一分钟内写信号 `.batch/night/signals/doubao/p35-edit-metrics.done`。
- 报告必含：迁移文件名与它建的列；`changedChars` 算法一句话；四条用例的运行输出尾部；`pnpm check:fast` 或等价闸门的退出码。

## 四、验收判据（QA）

- C1：新表由新迁移创建，既有表结构未被改（前后 `PRAGMA table_info` 对比截图/文本）。
- C2：人工保存 → `origin='human'`；不传 → `'ai'`（代码 + 用例双证）。
- C3：`changedChars` 对一段 100 字、改 10 字的样本算出的值在容差内（报告给样本与期望值）。
- C4：反证——把 origin 缺省改回 `'human'`，用例②必红。
- C5：porcelain 只含本卡文件；`review_findings`/契约/禁动区零改动。

<!-- 卡面完 -->
## 五、投递指令（联络人 2026-11-14 15:2x 投前核对）

**落点**：工程仓库是 `C:\develop\workspace\AI-writer\develop`，**不是** wt-1。所有相对路径、`git add`、`git show`、报告与信号路径都在 `develop` 下执行；先 `git rev-parse --show-toplevel` 确认是 `develop` 再动手。
**起点核对**：`9070999c`（`exp/resource-ledger`）。开工前跑 `git rev-parse HEAD` 与 `git status --porcelain`，若 HEAD 不是 `9070999c` 或 porcelain 非空，**先停下在回执里报实况**，不要自行 reset / checkout / stash。

必做四条与禁动区照卡面执行，另重申三条硬约束：
1. 不新增 npm 依赖（diff 用本地函数写），不跑 `pnpm dev`，不跑全量测试（worktree/并行隔离规则：只跑本卡相关单元测试）。
2. 不改既有表的既有列语义；新表只能由新迁移创建，迁移须可重入。
3. `origin` 缺省 `'ai'`，只有 `DraftEditor.tsx` 的 `doSave` 显式传 `'human'`。

**交付必须齐三样，缺一不算交付**：
- 报告 `C:\develop\workspace\AI-writer\develop\.batch\night\reports\p35-edit-metrics.md`，末行 `<!-- DONE -->`；
- 信号 `C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p35-edit-metrics.done`（三行：报告路径 / 提交 SHA / `<!-- DONE -->`），报告落盘同一分钟内写，写不进立刻在回执里说「信号未写 + 原因」；
- 回执贴原文：`git log --oneline -2`、`git show --numstat HEAD`、四条用例输出尾部、porcelain。

**回执格式**：前四行固定为
```
投前 currentSessionId：<值>
投后 currentSessionId：<值>
是否一致：是/否
例外依据：不适用（未用 --new）
```
再加：模型芯片原文、报告字节数 + MD5、信号路径。

交付后不要往这张卡上再加提交；报告数字以最终 HEAD 为准。
