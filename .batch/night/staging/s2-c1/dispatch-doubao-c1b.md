# 外派派单（豆包）· PLANUI S2 · C1-b 字段级并排对比＋三选一＋快照/回退（卡 744f13a8）

## 0 必读与确认（先回四行，再开工）

开工前必读：①仓内 `AGENTS.md`；②`README.md`；③`docs/agents/worktree-parallel.md`；④本卡相关通道件 `docs/agents/doubao-channel.md`；⑤本派单点名的设计稿 `docs/design/characters/c1-relevance-filter-and-regeneration-diff-design.md`（只读 §4、§6 的判据 3–8、§7、§8）与实施包 `.batch/night/staging/s2-c1-impl-package.md`（§2.1 第 3–10 项、§2.2 第 13–18 项、§4.2、§4.3、§5 的 M2／M4／M5）。

回四行再动手：

1. 读了哪几份（路径）
2. 各自当前版本或日期
3. 据此要遵守的三条口径
4. **当前模式与模型**：是否「工作模式」（不是「对话模式」）、当前模型名与档位（派单点名要求 `DeepSeek-V4.1-Flash`，写成「快速」或其它低档一律算不合格）

缺这四行，我不认这件已开工。模式或模型不对，**先停手回报，不许交付**。

## 0.1 跨 agent 红线（机器注入，直接确认，不要为此去读文档）

- 不碰宿主设置（音量／亮度／电源／网络／时区／输入法／通知），不装卸软件，不改注册表与服务启动项，不弹窗、不抢焦点。
- 不 `pnpm install`，不切 node ABI，不跑全量测试，不跑 `test:browser`／`test:node`；自测只准文件级：`node scripts/run-tests-electron.mjs <单文件>` 与 `node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts <单文件>`。
- **本卡明文例外（admin 11-24 05:4x 明写，仅此一项）**：J6–J8 属 `[live]`，需要**真实 Electron ＋ 真实 SQLite**。允许且仅允许：单实例启动、一次启动跑完三卡证据、跑完 `app.quit()` 且残留 `electron` 进程 0；构建只准 `node node_modules/typescript/bin/tsc` 与 `node node_modules/vite/bin/vite.js build`（禁 `pnpm build`／`pnpm dev`，无 TTY 会 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`）。除此之外的实机行为仍按红线禁。
- 只改本卡白名单文件（§2.0 的 3 项与 §2 的 16 项），不新增白名单外文件，不动 `.batch/*` 任何件；不 `git add -f`，不 `--no-verify`，不 tag。
- **必须新开会话**：本次一律开新会话，不得复用任何既有会话（含任何 WorkBuddy 或豆包旧会话）；复用旧会话的产出不采信。
- **模式闸**：开局必须是「工作模式」＋ `DeepSeek-V4.1-Flash`。落在「对话模式」或被降成「快速」等低档模型，立即停手、回报实际模式与模型，不许用该会话的产出交付。
- 分支只准 `card/s2-c1-relevance-and-diff`（**同卡续作，不新建分支**）：可在该分支 `commit`；**禁 merge、禁 rebase、禁 tag、禁 push 任何分支**；禁碰 `C:\develop\workspace\AI-writer\develop` 目录。
- 一卡一会话，做完即停，不在同一会话里接下一张。
- 不把「待验」写成「已证实」；无证据不下结论；报告里不许出现「已修好」这类措辞。

## 0.2 回执头（缺则判可疑）

回执固定四行，前三行是身份头，第四行是 §0 的第四问（模式与模型），缺任一行按可疑件退回：

```
From: C1B-S2-Doubao
To: 大肥鱼@主身
卡号：744f13a8-7a5c-49dc-beab-9e0d7259cc4e｜会话标识：<新会话首次时间或会话 id>｜起点：34aa0000（P0 一笔）／<P0 提交 sha，以 P0 提交后 `git rev-parse --short HEAD` 原文为准>（C1-b 一笔）
模式：<工作模式|对话模式>｜模型：<模型名与档位>
```

## 0.3 步骤 0 · 起点闸门（开工第一件事是核它）

wt-2 现状=分支 `card/s2-c1-relevance-and-diff`、HEAD `34aa0000`、`porcelain 0` 行（C1-a 已交、已过 QA，未 push）。**你不再 `git switch -c`，也不要切到任何别的分支。** 本件是**两笔续作**：先在 `34aa0000` 上做 P0（§2.0），P0 提交后紧接其做 C1-b（§2），都在同一分支。

开工第一条命令（三项原文必须贴回执）：

```
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --abbrev-ref HEAD
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --short HEAD
git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall | wc -l
```

判据：分支名逐字 `card/s2-c1-relevance-and-diff`、HEAD 逐字 `34aa0000`、行数 `0`。**任一项不符 → 立即停手**，不写文件、不 `git add`、不 commit，回执只写三项原文与停手原因。

P0 提交之后、开 C1-b 之前，**把同样三条再贴一次**：判据改为「HEAD 逐字等于 P0 的提交 sha、行数 `0`」。不贴这一组就走 C1-b，按越界退回。

## 0.4 豆包通道特有准入（逐条必守，缺一条即停手回报）

1. **模式必须是「新工作任务 + 本地电脑」。** 豆包默认是「对话」，对话模式**没有本地文件权限**，只会回「我无法读取你本地磁盘文件」（`doubao-channel.md:149`／`:331`）——那种输出不是模型变笨，是模式错。开局一律先 `node scripts/doubao/bootstrap.mjs` 新建线程；`task` 命令在已处于任务模式时**追加进当前线程而不新建**（`:278`），复用任何旧线程的产出不采信。
2. **顺序不能反：新建线程 → 切「本地电脑」→ 最后切档位。** 新建线程会把推理档位重置回「中」（`:148`／`:337`），先切档位等于白切；对话模式下档位 chip 只显示「快速」（`:167`），看到「快速」先怀疑模式而不是模型。
3. **项目定位用绝对路径，不靠「项目」chip 猜。** ⚠️ 本机 `AI-writer-wt-1` 与 `AI-writer-wt-2` 是两个不同的检出（`wt-1` 当前 HEAD `89ec7014`，`wt-2` 是 `34aa0000`）：如果你的项目 chip 显示 `wt-1`，**不要在里面跑任何 git 或改任何文件**，一律用带 `-C C:/develop/workspace/AI-writer/wt-2` 的命令；`git rev-parse --short HEAD` 必须回 `34aa0000`，回 `89ec7014` 就是走错树，立即停手回报。 `通过本地文件夹创建项目` 会弹系统原生文件夹框、CDP 控不了（`:276`）；chip 常只显示项目名，路径要开菜单才看得到（`:163`）。本卡所有 git／文件操作一律写绝对路径 `C:/develop/workspace/AI-writer/wt-2`（§0.3 的命令已是绝对路径，照抄）。
4. **豆包没有工具层硬拦截。** 不像 Copilot 有 `--deny-tool 'shell(git:*)'` 那种拦截（`:320`），本派单的红线全靠你自己守、由事后验收核对。因此：①每条 `git` 与 `node` 命令的**原文输出**贴进回执；②git 只准 `add` 与 `commit`（且只在 `card/s2-c1-relevance-and-diff` 上），**禁** `checkout`／`switch`／`restore`／`reset`／`stash`／`clean`／`push`／`merge`／`rebase`／`tag`；③禁止 `git checkout -- <path>` 之类的回退命令，那会覆盖盘上他人改动。
5. **串行。** 一个实例一个窗口，同一时刻只能跑一个任务（`:377`）；本卡执行期间不得并派第二个任务。
6. **命令语法按 PowerShell 写。** 若终端是 PowerShell，§0.3 的 `| wc -l` 不可用，等价写法：`(git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall | Measure-Object -Line).Lines` 或 `git ... status --porcelain -uall` 后自行数行；两者择一把**原文**贴回执。注意 `Measure-Object -Line` 不计空行，porcelain 无空行故等价。
7. **证据措辞纪律（豆包通道专用口径）。** 没读到的只能写「本次读取的文件内未找到」，**不许写「全仓没有」**（`:308`）；测试条数与 tsc 结果原样粘贴，不许总结成「全部通过」（`:315`）；`[live]` 跑不成写「未跑成 + 报错原文」，不许 mock 顶。

---

## §1 任务一句话

分两笔，顺序不可换：

1. **P0（§2.0，先做）**：把 M30 漏登记的 `draft_edit_stats` 补进便携字段策略，让 `portable-project-format.test.ts` 转绿。这是修**既有红**（`1e1b4840` 留下的运行时坏点），不是 C1-b 的功能；提交 message 以 `P0:` 开头。
2. **C1-b（§2，后做）**：字段级并排对比纯函数＋对比屏（三选一）＋快照表 M31＋逐字段回退（含 `source_revision` 不符拒绝回退），判据 J3–J8；提交 message 以 `C1-b:` 开头。

**C1-a 已完成并过 QA，其代码（`character-relevance.ts` 与 `CharactersView.tsx` 的筛选/排序/标签）一律不得改动。**

## §2.0 组 · P0 前置（3 项，先做这一笔）

**这一笔修的是既有红，不是本卡功能**：M30 提交 `1e1b4840` 建了 `draft_edit_stats`，却没登记便携字段策略；`assertPortableSourceSchema`（`electron/services/portable-project-format.ts:169-189`，`:178` 表不在白名单抛、`:181` 列不在策略抛、`:185` 策略有库里无也抛）是 fail-closed，于是 HEAD 上「项目导出 / 便携备份」运行时整条不可用。

基线原文（我在 `34aa0000` 上实跑）：

```
node scripts/run-tests-electron.mjs electron/services/__tests__/portable-project-format.test.ts
 Test Files  1 failed (1)
      Tests  2 failed | 27 passed (29)
EXIT=1
expected { tables: 67, fields: 646 } to deeply equal { tables: 66, fields: 638 }
```

| # | 路径 | 动作 |
|---|---|---|
| P0-1 | `electron/services/portable-project-field-policy.json` | **修改**：顶层加 `"m30Tables": ["draft_edit_stats"]`（与 `m06Tables`／`m08Tables` 同级同形，键名照抄）；`tables` 里按字母序插 `draft_edit_stats` 的 8 列 `id`／`draft_id`／`at`／`origin`／`changed_chars`／`old_chars`／`new_chars`／`save_count`，**全部 `"D"`**（`preserve-domain`）。**不许用 `"B"`**：`electron/migrations/m30-draft-edit-stats.ts:5-13` 写明「改了多少字事后再也重建不出来」，`"B"`＝`rebuildable-metric-version` 不成立（该码全仓只有 `text_metric_versions` 用） |
| P0-2 | `electron/services/portable-project-format.ts` `:18`、`:30` 附近、`:109-110`、`:119-137` | **修改**：`origin` 联合类型加 `'m30-delta'`；`const m30Tables = new Set<string>(fieldPolicyDocument.m30Tables)` 就近声明（照 `:30` 的 `m06Tables`）；`:109-110` 的 `delta` 判定加 `\|\| m30Tables.has(table)`；`:119-137` 的 origin 链按 `m06`／`m08` 先例插一支 `m30Tables.has(table) ? 'm30-delta'`。**不动** `:149` 的反向漏登记循环（它只覆盖 `mXXFields` 与 `optionalFields`） |
| P0-3 | `electron/services/__tests__/portable-project-format.test.ts` `:101`、`:102`、`:152`、`:276` | **修改**：三处 `{ tables: 66, fields: 638 }` → `{ tables: 67, fields: 646 }`；`:152` 的 `expect(added).toHaveLength(283)` → `291`；按 M06／M08 先例补一条 `m30-delta` 桶的精确断言（把 8 个 key 全列出来）。`:158` 的 `expect(delta).toHaveLength(126)` **保持不变**——新桶不得落进 `m01-m05-delta` |

**为什么 `LATEST_SCHEMA_VERSION` 与 `CURRENT_DESKTOP_SCHEMA_VERSION` 不放在 P0**（这两行随 C1-b 的 M31 一起改，见 §2 的 item 13／15）：`electron/migrations/runner.ts:25-31` 的 `verifySchema` 在目标版本没有对应 lane 时直接抛——`probe.version !== target` ⇒ `SCHEMA_VERSION_MISMATCH`，`implementations.find(step => step.to === target)` 为空 ⇒ `MIGRATION_NOT_INSTALLED`；`:95` 收尾还要 `verifySchema(db, registry, target)`。所以在 M31（31→32）还不存在时把 `CURRENT_DESKTOP_SCHEMA_VERSION` 提到 32，**每一条建库路径（`electron/database.ts:32` 及所有测试夹具）当场抛 `SCHEMA_VERSION_MISMATCH`**，P0 反而是一笔纯红。同理只提 `LATEST_SCHEMA_VERSION` 而不加 lane，等于对外宣称最新版 32 却没有 32 这一档。

P0 的收工线（这一笔的判据，见 §5 J0）：

- `node scripts/run-tests-electron.mjs electron/services/__tests__/portable-project-format.test.ts` → 汇总行 `Tests 29 passed (29)`、`EXIT=0`，原文贴回执（**不许 `-t` 过滤**）。
- 跑不成照实写「未跑成＋报错原文」，不许放宽断言、不许改判据来凑绿。

顺序硬约束：**P0 转绿并贴出原文之后**才开 C1-b；C1-b 的起点 sha ＝ P0 的提交 sha（自己 `git rev-parse --short HEAD` 取，**不许沿用 `34aa0000`**）。P0-3 这个测试文件两笔各改一次（P0 改成 67/646，C1-b 再改成 68/651），两次都要留原文。

## §2 白名单 · C1-b 组（16 项：8 新增 8 修改，多一个文件都算越界）

> 全件合计 **19 项** ＝ §2.0 的 3 项 ＋ 本节 16 项。两组都只能动各自列出的文件；P0 组做完再动 C1-b 组。

**明文例外**（覆盖 §0.1「不新增文件」）：只准新增下面 8 个，除此之外不得新增任何文件。

| # | 路径 | 动作 |
|---|---|---|
| 1 | `src/shared/character-regeneration-diff.ts` | **新增**：字段并排、按句切分、差异计数、三选一→决策 |
| 2 | `src/shared/__tests__/character-regeneration-diff.test.ts` | **新增**：J3／J4 单测 |
| 3 | `src/components/characters/CharacterRegenerationDiffPanel.tsx` | **新增**：对比屏（表 + 三选一 + 差异高亮 + 顶部 N／M 计数） |
| 4 | `src/components/characters/__tests__/character-regeneration-diff-panel.browser.tsx` | **新增**：三选一与差异高亮的组件面断言 |
| 5 | `electron/migrations/m31-character-regeneration-snapshots.ts` | **新增**：M31 lane（§3 的 DDL 逐字） |
| 6 | `electron/migrations/__tests__/m31-installed-lane.test.ts` | **新增**：J5 |
| 7 | `electron/repositories/character-regeneration-snapshot-repository.ts` | **新增**：写快照 / 读快照 / 逐字段回退 |
| 8 | `electron/repositories/__tests__/character-regeneration-snapshot-repository.test.ts` | **新增**：J6–J8 的仓储层 |
| 9 | `src/components/characters/CharacterProposalSelectionPanel.tsx` `:46-51` | **修改**：在说明文案下方插入 `<CharacterRegenerationDiffPanel>`（仅 `rebuild === true`）；不动 `:52-69` 列表、不动 `:107-129` 四选一 |
| 10 | `src/services/character-proposal-choices.ts` `:35-38` | **修改**：`createCharacterProposalChoices` 接受可选 `strategy`，按三选一生成默认 `selections`；不传时行为与现状逐项相同 |
| 11 | `src/shared/ipc-channels.ts` `:1105-1108` 之后 | **修改**：新增 2 条通道 `db:character-regeneration-snapshot-read`、`db:character-regeneration-field-rollback`（`db:blueprint-character-sync-list-all` 已存在，勿重加） |
| 12 | `electron/controllers/db-controller.ts` `:815` 之后 | **修改**：注册上一条两个 handler，沿用 `expectedProjectPath` 项目会话校验写法 |
| 13 | `electron/migrations/desktop-registry.ts` **`:40`**、`:221-226`、`:226-250` | **修改**：`CURRENT_DESKTOP_SCHEMA_VERSION` 31 → 32（**必改**：`:254` 的 `migrateSchema(..., CURRENT_DESKTOP_SCHEMA_VERSION)` 以它为迁移目标，不改则停在 31、M31 永不执行）；注册 M31（`from:31 → to:32`），补 `schemas(32)` 指纹集；m00–m30 一行不动 |
| 14 | `electron/services/character-proposal-service.ts` `:784` 前后 | **修改**：在**同一事务**内、`commitCharacterIdentities` 调用**之前**写入快照行；`operation_id` 用 `request.operationId` |
| 15 | `electron/migrations/registry.ts` `:35` 之后、`:38` | **修改**：`MIGRATION_LANE` 追加 `{ id: 'M31', from: 31, to: 32, owner: '<卡号 owner>' }`（m00–m30 一行不动）；`LATEST_SCHEMA_VERSION` 31 → 32。**只这两处** |
| 16 | `src/shared/project-storage.ts` `:5` | **修改**：`MIGRATION_IDS` 末项 `'M30'` 之后追加 `'M31'` |
| — | 回执与实机脚本（§8） | 新增，放 `C:\tmp\c1-s2\doubao\c1-b\`，**不在仓内** |

**`CharactersView.tsx` 原则上不再动**。若确需改一行才跑得通：必须在开工时先停手回报「要改的精确行段＋为什么必须改＋回归说明（不得碰 relevance 逻辑与 `visibleKeys` 语义）」，经我或 admin 书面许可后再改；未经许可的改动按越界处理。

**禁改**（出现即越界）：`src/shared/character-relevance.ts` 及其测试、`src/components/panels/sidebar/CharactersView.tsx`（除上条许可）、`src/components/dialogs/ArchitectureConfirmDialog.tsx`（P6 独占）、`src/shared/character-proposal.ts`（决策类型不动）、`src/shared/character-roster.ts`、`electron/migrations/baseline-schema.ts`、`electron/migrations/m00*`–`m30*`、任何 `.batch/*`。

## §3 快照表 `character_regeneration_snapshots`（DDL 逐字照抄，不得改名）

```sql
CREATE TABLE character_regeneration_snapshots (
 operation_id TEXT NOT NULL,
 character_id TEXT NOT NULL,
 source_revision INTEGER NOT NULL CHECK(source_revision >= 0),
 field_json TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY (operation_id, character_id)
);
CREATE INDEX idx_character_regeneration_snapshots_operation
 ON character_regeneration_snapshots(operation_id);
```

- `created_at` 由应用写 ISO 字符串，**禁用 `datetime('now')`**（同 `electron/migrations/m08-structured-refs-and-cast-decisions.ts:22-25`）。
- 迁移幂等：表已存在即返回；`verify` 用 `PRAGMA table_info` 核五列；`createM31Migration` 形状照 M08 `:69-76`。
- 落库时机：`electron/services/character-proposal-service.ts:784` 的 `commitCharacterIdentities(...)` **之前**，且外层由 `this.db.transaction(...)` 包住（`commitCharacterIdentities` 自身在 `character-roster-repository.ts:1188` 开事务，外层＝savepoint，原子成立）。
- 回退实现：**复用作者手改通道** `commitCharacterIdentities(db, { approval: { action:'author-edit', source:{kind:'author', …}, expectedRevision: source_revision }, changes:[{characterId, fields}] }, …)`；**不得**新增第二条写名册的路径。
- `source_revision !== 当前 revision` ⇒ 抛 `CHARACTER_REGENERATION_ROLLBACK_STALE` 拒绝，不强制覆盖。
- 快照读不到（功能上线前的旧批次）⇒ 回退入口不渲染、不报错，只显示只读差异。

## §4 口径（五条，逐条照做）

1. **5 组固定顺序**：名字 / 身份（`role`）/ 背景 / 关系 / 当前状态；背景组吸收 `gender/age/appearance/personality/abilities/motivation/arc/notes`，组内逐字段列差异。
2. **差异判定**：逐字段**去空白后相等比较**；相等＝灰行不展开；不等＝该行高亮并按句切分（中文 `。！？；`，英 `. ! ? ;`）列新增／删除／改写；**不做逐字 diff**。
3. **候选为空字段**标「候选为空·保留现值」，**不计入差异数**；顶部 `本次重建会覆盖 N 张同名卡` + `其中 M 张有实质差异`，M=0 时按钮降级为「无差异，仍要覆盖？」。
4. **三选一只改默认选择**：`全部覆盖`＝现状默认；`保留旧卡（跳过同名）`＝同名命中项一律 `keep-unresolved`（新名字仍按现有默认）；`逐张确认`＝透传作者已有选择。**不得新增 `CharacterProposalDecision` 变体**（`src/shared/character-proposal.ts:60-72`），最终仍由 `selections` 表达。
5. **关系组按「对象名＋关系词」配对比较**，不做字符串比较；`当前状态` 只读展示并标「候选不提供状态时保留现值」。

## §5 判据（J3–J8，分层照写）

| # | 层 | 判据（可判形态） | 证据 |
|---|---|---|---|
| J0 | [static] | **P0 收工线**：`portable-project-format.test.ts` 全绿 `Tests 29 passed (29)`、计数 `67/646`、`m30-delta` 桶 8 key 精确、`delta` 仍 126 | 汇总行 + `EXIT=0` 原文（§2.0） |
| J3 | [mock] | `buildRegenerationDiff(oldEntry, candidate)`：5 组固定顺序；按句切分；去空白后相等＝灰行且不计差异；候选为空字段标「候选为空·保留现值」且不计差异数；返回 `{rows, differentFieldCount}` | `character-regeneration-diff.test.ts` |
| J4 | [mock] | 三选一 → `CharacterProposalDecision[]`：`全部覆盖`＝现状默认；`保留旧卡`＝同名项全 `keep-unresolved` 且不新增卡；`逐张确认`＝透传 | 同上 + 面板 browser 测试三条 |
| J5 | [static] | M31 建表后 `PRAGMA table_info(character_regeneration_snapshots)` 含 §3 五列；重复执行幂等；**M00 基线指纹不变**（旧项目 `probeSchema` 仍识别）；`user_version` 31 → 32 | `m31-installed-lane.test.ts` |
| J6 | [live] | 真实 Electron＋真实 SQLite：一次架构重建（`全部覆盖`）确认后，被覆盖卡可按 `operation_id` 读到快照；对某字段回退 → 该字段回旧值、roster `revision` 自增、其他卡不变 | 一卡一脚本 + 截图 + 库读原文 |
| J7 | [live] | `source_revision` 与当前 revision 不一致时回退**被拒绝**（错误码 §3），roster 内容不变 | 同上 |
| J8 | [live] | 无快照的旧批次：回退入口不渲染、不报错（只显示只读差异） | 同上 |

J6–J8 实机脚本要求：单实例、一次启动取完三卡证据、`instancesThisRun=1`、`exitCode=0`、`leftoverElectronProcesses=0`、`tasklist` 原文；**跑不成写「未跑成 + 报错原文」并标 `[live] 未跑成`，不许用 mock 顶替 [live]**。

## §6 变异（M2／M4／M5 必发，M3 可选；每发转红并写红掉的用例号）

| 号 | 靶 | 改法 | 期望转红 |
|---|---|---|---|
| M2 | 差异比较「去空白后相等」 | 改成直接 `!==`（不去空白） | J3 的「仅空白差异不计差异」用例 |
| M3（可选） | 三选一 `保留旧卡` | 同名项改成 `map`（等价全部覆盖） | J4 的「保留旧卡 ⇒ 全 keep-unresolved」用例 |
| M4 | 快照写入时机 | 把快照写入移到 `commitCharacterIdentities` **之后**并随后抛错（或直接删该写入） | J7 的 stale revision 前置夹具（无快照即失败） |
| M5 | 回退 revision 校验 | 删掉 `source_revision !== current` 抛错分支 | J7 全条 |
| M6（可选） | P0 的 origin 链 | 删掉 `:119-137` 里 `m30Tables.has(table) ? 'm30-delta'` 那一支 | J0 的 `m30-delta` 桶断言 |

每发变异**手工把改动改回原文**（逐字改回，**禁用** `git checkout`／`restore`／`stash`／`reset`，与 §0.4 第 4 条同一条红线），然后复跑同一条命令。回执贴「变异后红行 → 改回后绿行」两段原文与 `git rev-parse HEAD`（改回后 `git status --porcelain -uall` 必须回到 `0` 行，否则说明没改干净）。变异只需要这两组原文，**不需要 git 参与回滚**。只红 0 条按「断言空」退回。

## §7 命令（自测原文贴回执）

P0 先跑这一条（转绿才做 C1-b）：

```
node scripts/run-tests-electron.mjs electron/services/__tests__/portable-project-format.test.ts
```

C1-b 自测：

```
node scripts/run-tests-electron.mjs src/shared/__tests__/character-regeneration-diff.test.ts electron/migrations/__tests__/m31-installed-lane.test.ts electron/repositories/__tests__/character-regeneration-snapshot-repository.test.ts
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/characters/__tests__/character-regeneration-diff-panel.browser.tsx
node scripts/check-fast.mjs
```

汇总行必须出现 `Tests N passed`（不接受 `-t` 过滤）与 `CF_EXIT=0`。

## §8 交付形态与回执

- 起点闸门见 §0.3；分支 `card/s2-c1-relevance-and-diff` 已存在且已检出，**直接在其上工作，禁新建／切换分支**。**两笔 commit，顺序固定**：①`P0:`（§2.0 三件，正文写明修 `1e1b4840` 的便携登记回归，并贴 §2.0 的绿行原文）；②`C1-b:`（§2 十六项，正文写明 J3–J8 与本卡号）。两笔之间不得插入任何其它改动。
- 产物目录 `C:\tmp\c1-s2\doubao\c1-b\`：回执 `receipt-to-owner.md`、实机脚本与截图、库读原文；**禁写 `.batch/*`**。
- 回执至少含：四行头、两笔各自的 `git rev-parse HEAD` 与父 sha、`git diff --numstat 34aa0000 <P0 sha>` 与 `<P0 sha> HEAD` 两行、porcelain 原文、J3–J8 逐条对号（含 J5 指纹断言原文、J6–J8 三键与 `tasklist` 原文）、变异红/绿原文、§7 三条命令汇总行、未做项与原因。
- 自报「已落盘」不算交件：我会自己核路径、字节、sha256、提交与 porcelain，核不过按未交处理。

## §9 本卡不做

- 不动 C1-a 的 relevance 与排序、不改 `CharactersView`（除非 §2 许可流程）、不改决策类型、不改重建语义、不动 `ArchitectureConfirmDialog`、不删旧章区间、不做逐字 diff、不做「最近出场」、不做字段级部分采用（只做整卡三选一 + 覆盖后逐字段回退）。
- 不需要真实模型调用；如确实需要，只准 Magpie `group/ai-novel`（`http://127.0.0.1:3425/v1`），禁 `group/deepseek`。
