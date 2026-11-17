# 卡 · P36 · 清除生成数据时一并清掉计量表

- 卡号：P36（A 类改码，须 QA 首验）
- 起点：`28b0e822`（分支 `exp/resource-ledger`，仓库 `C:\develop\workspace\AI-writer\develop`）
- 估时：15 分钟
- 授权：可改码 + **本卡允许点名 `git add` + commit**（禁 `-A`、禁 push、禁 reset/checkout/stash）

## 一、背景（P35 QA 记账 ②）

P35 新增了 `draft_edit_stats` 表，但「清除生成数据」的清单里没有它：
- `electron/repositories/project-clear-repository.ts:46` 的 `CLEAR_COUNT_TABLES.generatedText` 不含 `draft_edit_stats`；
- 同文件 `:171-183` 的 `DELETE FROM …` 也不含它。

后果：执行「清除生成数据」后 `drafts` / `contents` 被删，但计量行残留在库里，清除回执的 `counts.generatedText` 也不含这张表。
（`drafts.id` 是 `AUTOINCREMENT`，不会复用 id，所以不存在「新草稿继承旧 `save_count`」，只剩「残留 + 计数不全」这一个后果。）

## 二、必做

1. 把 `draft_edit_stats` 加入 `CLEAR_COUNT_TABLES.generatedText`（与 `drafts`/`contents` 同档，不新建档）。
2. 在 `options.generatedText` 分支里补 `DELETE FROM draft_edit_stats`，位置放在 `DELETE FROM drafts` **之前**（先删子表再删父表），并用 `hasTable(db, 'draft_edit_stats')` 保护——老库没有这张表时跳过，不许抛错。
3. 用例（加在 `project-clear-repository` 既有测试文件里）：
   - 清 `generatedText` 后 `draft_edit_stats` 行数为 0，且 `counts.generatedText.categories` 比原来多 1；
   - 老库（无该表）清 `generatedText` 不抛错、语义不变。
4. 报告给：改动文件、两段 diff 摘要、用例输出尾部、`git show --numstat`、`pnpm check:fast` 退出码。

## 三、禁动区

- 不改 `generatedText` 之外的另外两档（`blueprints` / `creativeFields`）。
- 不改 `drafts` / `contents` 的删除顺序与既有语义，不动 `volumes` 的 UPDATE 段。
- 不改任何 UI、不加依赖、不跑 `pnpm dev`、不跑全量测试（只跑本卡相关单测）。
- 不动 `draft_edit_stats` 的表结构与 P35 的写入逻辑。

## 四、验收判据（QA）

- C1：清 `generatedText` 后 `draft_edit_stats` 为 0 行，`counts.generatedText.categories` 递增 1。
- C2：无该表的老库路径不抛错（用 mock `hasTable` 返回 false 证）。
- C3：`blueprints` / `creativeFields` 两档计数与行为不变。
- C4：反证——把 `hasTable` 保护去掉或把 DELETE 挪到 `drafts` 之后，用例必须红。
- C5：porcelain 只含本卡文件；`draft_edit_stats` 表结构零改动。

## 五、投递指令

- 落点：`C:\develop\workspace\AI-writer\develop`（**不是** wt-1）。开工前 `git rev-parse --show-toplevel` 与 `git rev-parse HEAD` 自证，HEAD 不是 `28b0e822` 或 porcelain 非空就停下报实况。
- 交付三样：报告 `.batch/night/reports/p36-clear-stats.md`（末行 `<!-- DONE -->`）+ 信号 `.batch\night\signals\doubao\p36-clear-stats.done`（三行：报告路径 / 提交 SHA / `<!-- DONE -->`，报告落盘同一分钟内写）+ 回执原文。
- **信号投出后不得原地改写**；要更新另起文件名。探针只许放 `scripts\dsh\wakeup-inbox`，不许往 `signals\doubao\` 塞非交付物。

- **测试怎么跑**：用 `pnpm test <相关测试文件>`（Electron 运行时，ABI 145）。不要用 `node vitest` / `node --test` 跑这两个文件——本机 Node 是 ABI 137，`better-sqlite3` 会全红，那是环境不是代码（P35 已踩过）。
- **回执前四行固定**：
```
投前 currentSessionId：<值>
投后 currentSessionId：<值>
是否一致：是/否
例外依据：不适用（未用 --new）
```
  再加：模型芯片原文、报告字节数 + MD5、信号路径、`git show --numstat HEAD` 原文、porcelain（应为空）。
- 提交后不要往本卡再加第二个提交；报告里的数字以最终 HEAD 为准。
