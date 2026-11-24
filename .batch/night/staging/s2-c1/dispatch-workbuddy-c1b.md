# 外派派单 · PLANUI S2 · C1-b 字段级并排对比＋三选一＋快照/回退（卡 744f13a8）

## 0 必读与确认（先回四行，再开工）

开工前必读：①仓内 `AGENTS.md`；②`README.md`；③`docs/agents/worktree-parallel.md`；④本卡相关通道件 `docs/agents/workbuddy-channel.md`；⑤本派单点名的设计稿 `docs/design/characters/c1-relevance-filter-and-regeneration-diff-design.md`（只读 §4、§6 的判据 3–8、§7、§8）与实施包 `.batch/night/staging/s2-c1-impl-package.md`（§2.1 第 3–10 项、§2.2 第 13–18 项、§4.2、§4.3、§5 的 M2／M4／M5）。

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
- 只改本卡白名单文件（§2），不新增白名单外文件，不动 `.batch/*` 任何件；不 `git add -f`，不 `--no-verify`，不 tag。
- **必须新开会话**：本次一律开新会话，不得复用任何既有会话（含 `4d730363`、`80d99a74`、`60e73cbf`）；复用旧会话的产出不采信。
- **模式闸**：开局必须是「工作模式」＋ `DeepSeek-V4.1-Flash`。落在「对话模式」或被降成「快速」等低档模型，立即停手、回报实际模式与模型，不许用该会话的产出交付。
- 分支只准 `card/s2-c1-relevance-and-diff`（**同卡续作，不新建分支**）：可在该分支 `commit`；**禁 merge、禁 rebase、禁 tag、禁 push 任何分支**；禁碰 `C:\develop\workspace\AI-writer\develop` 目录。
- 一卡一会话，做完即停，不在同一会话里接下一张。
- 不把「待验」写成「已证实」；无证据不下结论；报告里不许出现「已修好」这类措辞。

## 0.2 回执头（缺则判可疑）

回执固定四行，前三行是身份头，第四行是 §0 的第四问（模式与模型），缺任一行按可疑件退回：

```
From: C1B-S2-WorkBuddy
To: 大肥鱼@主身
卡号：744f13a8-7a5c-49dc-beab-9e0d7259cc4e｜会话标识：<新会话首次时间或会话 id>｜起点：34aa0000
模式：<工作模式|对话模式>｜模型：<模型名与档位>
```

## 0.3 步骤 0 · 起点闸门（开工第一件事是核它）

wt-2 现状=分支 `card/s2-c1-relevance-and-diff`、HEAD `34aa0000`、`porcelain 0` 行（C1-a 已交、已过 QA，未 push）。**你不再 `git switch -c`，也不要切到任何别的分支。**

开工第一条命令（三项原文必须贴回执）：

```
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --abbrev-ref HEAD
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --short HEAD
git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall | wc -l
```

判据：分支名逐字 `card/s2-c1-relevance-and-diff`、HEAD 逐字 `34aa0000`、行数 `0`。**任一项不符 → 立即停手**，不写文件、不 `git add`、不 commit，回执只写三项原文与停手原因。

---

## §1 任务一句话

只做 **C1-b**：字段级并排对比纯函数＋对比屏（三选一）＋快照表 M31＋逐字段回退（含 `source_revision` 不符拒绝回退），判据 J3–J8。**C1-a 已完成并过 QA，其代码（`character-relevance.ts` 与 `CharactersView.tsx` 的筛选/排序/标签）一律不得改动。**

## §2 白名单（14 项：8 新增 6 修改，多一个文件都算越界）

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
| 13 | `electron/migrations/desktop-registry.ts` `:221-226`、`:226-250` | **修改**：注册 M31（`from:31 → to:32`），补 `schemas(32)` 指纹集；m00–m30 一行不动 |
| 14 | `electron/services/character-proposal-service.ts` `:784` 前后 | **修改**：在**同一事务**内、`commitCharacterIdentities` 调用**之前**写入快照行；`operation_id` 用 `request.operationId` |
| — | 回执与实机脚本（§8） | 新增，放 `C:\tmp\c1-s2\workbuddy\c1-b\`，**不在仓内** |

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

每发 `git checkout -- <file>` 回滚后复跑同值，回执贴「变异前红行 → 回滚后绿行」原文与 `git rev-parse HEAD`。只红 0 条按「断言空」退回。

## §7 命令（自测原文贴回执）

```
node scripts/run-tests-electron.mjs src/shared/__tests__/character-regeneration-diff.test.ts electron/migrations/__tests__/m31-installed-lane.test.ts electron/repositories/__tests__/character-regeneration-snapshot-repository.test.ts
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/characters/__tests__/character-regeneration-diff-panel.browser.tsx
node scripts/check-fast.mjs
```

汇总行必须出现 `Tests N passed`（不接受 `-t` 过滤）与 `CF_EXIT=0`。

## §8 交付形态与回执

- 起点闸门见 §0.3；分支 `card/s2-c1-relevance-and-diff` 已存在且已检出，**直接在其上工作，禁新建／切换分支**；在该分支**一笔 commit**，message 以 `C1-b:` 开头，正文写明 J3–J8 与本卡号。
- 产物目录 `C:\tmp\c1-s2\workbuddy\c1-b\`：回执 `receipt-to-owner.md`、实机脚本与截图、库读原文；**禁写 `.batch/*`**。
- 回执至少含：四行头、`git rev-parse HEAD` 与父 sha、`git diff --numstat 34aa0000 HEAD`、porcelain 原文、J3–J8 逐条对号（含 J5 指纹断言原文、J6–J8 三键与 `tasklist` 原文）、变异红/绿原文、§7 三条命令汇总行、未做项与原因。
- 自报「已落盘」不算交件：我会自己核路径、字节、sha256、提交与 porcelain，核不过按未交处理。

## §9 本卡不做

- 不动 C1-a 的 relevance 与排序、不改 `CharactersView`（除非 §2 许可流程）、不改决策类型、不改重建语义、不动 `ArchitectureConfirmDialog`、不删旧章区间、不做逐字 diff、不做「最近出场」、不做字段级部分采用（只做整卡三选一 + 覆盖后逐字段回退）。
- 不需要真实模型调用；如确实需要，只准 Magpie `group/ai-novel`（`http://127.0.0.1:3425/v1`），禁 `group/deepseek`。
