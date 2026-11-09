# 交接：把基线里的既有红清干净（2026-10-30 深夜）

> **一句话状态**：此前每次全量跑测都会撞上的那 20 余例「既有红」已逐条查清并处置完 —— 没有一例是靠"下次再说"挂着的。**处置原则：断言错就改断言并写清为什么，代码错就改代码，环境错就改配置；删/跳过只用在"这条断言本来就是假的"上。**
> **为什么现在做**：作者原话——「不要每一次跑的时候都要去调查，都要去撞上这个坑，这非常费 token。」

---

## 一、处置总表

| 文件 | 原来红几例 | 真因 | 处置 |
|---|---|---|---|
| `electron/repositories/__tests__/draft-source-dependency.test.ts` | 4 | 实现已把中文 message 换成白名单码 `GENERATION_DRAFT_SOURCE_STALE`（`cf10b44f`，理由：中文 message 经 IPC 网关会压成 `GENERATION_REQUEST_FAILED:Error`），测试仍在匹配中文 | 改断言为码 + 顶部常量注释说明 |
| `electron/services/__tests__/project-peek-readonly.test.ts` | 9 | 夹具 `migrateSchema(..., 7)` 写死 v7，而 `CURRENT_DESKTOP_SCHEMA_VERSION=26`，准入判据是严格等于 ⇒ 全文件静默全红（每加一版迁移多红一条） | 夹具默认值改成 `CURRENT`；「未来版本」用例改成 `user_version = CURRENT + 1`（写死 8 在版本涨上来后语义已变成"更旧的版本"） |
| `electron/services/__tests__/m02-project-upgrade.test.ts` | 3 | ①② `preIdentityDomain` 是在**当前版本**上算的（列清单取当时实际列），任何一版迁移往核心表加列都会改 hash（M25 给 `blueprints` 加 `source_ref` 就是最近一次）；③ `verifySchema(..., CURRENT)` 只跑 `step.to === CURRENT` 那一步的 verify ⇒ 停在 26 的库根本不跑 M02.verify，原来那条是"表不存在 ⇒ UPDATE 抛错"蹭过的假通过 | ①② 改比 `tableCounts`（行数没被迁移吃掉）+ 注释指明真正的等价性证明在 `sqlite-project-migration.ts:287`（用 `columnsBefore` 重算逐字节比），且该保护由第三例专测；③ 改为直调 `verifyM02CharacterIdentity`，并先断言 alias 行存在 |
| `electron/services/__tests__/legacy-project-copy-import.test.ts` | 3 | **两层**：① `treeHash` 的 `nlink === 1` 拒绝了 LanceDB 的 `_versions/*.manifest`（库用硬链接做版本共享，实测恒为 2）；② 修完①又撞 `vector-migration-snapshot` 同一个 `nlink === 1` 断言（`VECTOR_MIGRATION_NONREGULAR_UNSUPPORTED`，此前被登记成"flake"） | 见 §二（两条**生产代码**改动） |
| `electron/services/__tests__/main-generation-owner.test.ts` | 1 | 实现是"文本字段在作者值后**追加**、标识字段保作者值"（`mergeAdoptedCharacterFields`，2026-10-21 裁定），测试写的是"跳过" | 断言改成合并后的两段值，用例名同步改；另登记一条遗留风险（§三） |
| `electron/controllers/__tests__/llm-controller-connection.test.ts` | 2 | `errorMessage` 实现记成 `finish:<码> \| <provider 原话>`，测试全等匹配 `finish:<码>` | 改前缀匹配 `/^finish:xxx(?=\s\|$)/u` |
| `src/services/workflows/__tests__/context-entry-parity.test.ts` | 2 | `ad6256d3`（2026-10-26）有意改了知情节首文案（裁剪单位从"行"改成"事实"），当次只更新了审稿链的字节锚点，漏了写路径这两条 | 换锚点并在注释里写明来源提交与"这是有意变、不是漂移" |
| `src/services/workflows/commands/__tests__/finalize-postprocess-character.integration.test.ts` | 4 | P20-3 在 `chapter_notes` 与 `character_cards` 之间插了第三个槽位 `knowledge_candidates`（`finalize-chapter.command.ts` 步骤 2c，`critical:false`），槽位数从 2 变 3 | slot 计数 2→3 并说明"次数等于槽位数"才是本用例的判据；只关心原有两槽的那条改为先滤掉新槽位 |
| `src/services/workflows/commands/__tests__/finalize-chapter.blueprint-entities.test.ts` | 1 | 同上，多一个槽位 ⇒ ① mock 没接 `db:post-process-mark-step-failed`（该槽失败要记账）；② `finalization-generation:read` 的调用列表多了它 | ① 补 mock 分支并注释"critical:false 的失败路径必须被接住"；② 比对前滤掉该槽位 |
| `src/components/panels/sidebar/__tests__/world-state-view-model.test.ts` | 1 | 断言标签表**恰好 11 项**并注释"新增 `staging-unverified`"，而 `staging-unverified` 全库不存在、表里只有 10 项 | 删掉数量硬编码：`Record<SpaceAuditIssueKind, …>` 已在**编译期**保证完整性，运行时只该验"每条标签两种语言都有字" |
| `electron/__tests__/package-contract.test.ts` | 1 | 断言 `pkg.scripts.test === 'vitest run'`，而实际早已改成 `node scripts/run-tests-electron.mjs`（统一 ABI，2026-10-25）。当次只改了脚本没同步这条发布契约 | 改断言为本工程统一入口并写明来源。**注意：这条只有跑到 `electron/__tests__` 才会红，而且默认 reporter 在输出重定向时会把整段失败信息吞掉** —— 表现是"跑到文件列表打完就没下文"，很容易误判成卡死 |
| `electron/services/sqlite-project-migration.ts` | 1（`vector-store-dimension`） | `physicalSnapshot` 的 `close()` 直接 `fs.rmSync` scratch 目录，撞上宿主的 safe-delete shim ⇒ 删除失败**抛出去**，把"库验证通过"的结论顶掉 | 抽 `discardScratch()` 改成 best-effort（scratch 带 `.vibe-owner.json` ttl，残留不污染判定），并写清为什么不允许它盖掉结果 |

---

## 二、两条生产代码改动（`nlink` 检查）

**行业事实**：LanceDB 用硬链接做版本共享 —— `_versions/<n>.manifest` 与数据文件之间共享 inode，新版本只写增量。所以 `.vela/lancedb/**` 下 `nlink > 1` 是库的正常形态，不是"同一份内容在磁盘上多处存在"的可疑信号。

| 落点 | 原断言 | 改法 | 为什么口径不同 |
|---|---|---|---|
| `electron/services/legacy-project-copy-import.ts` `treeHash` / `copyTree` | `info.isFile() && info.nlink === 1` | 放行 `.vela/lancedb/**` 子树（`lanceStorageFile`），其余位置仍拒 | 这里扫的是**整个旧项目**，硬链接在 lancedb 之外仍是可疑信号 ⇒ 只开一个口子 |
| `electron/services/vector-migration-snapshot.ts` `physicalManifest` | 同上 | 去掉 `nlink` 条件，只要求"普通文件" | 这里扫的**整棵树**都是向量资产，硬链接带不出这棵树 |

**没有放开的**：符号链接（两处都仍然一律拒绝）—— 那才是能指向项目外的逃逸形态；硬链接指向的外部内容是"读进来"，不是"写出去"。

**测试替身**：`copyTree` 仍用 `copyFileSync`，复制出来是**独立 inode**，不会把硬链接带进新项目；`treeHash` 照样把字节算进 digest，所以「源在导入期间被改」仍然能检测到。

---

## 三、全局测试配置（真正的"别每次撞坑"）

`vite.config.ts` 的 `test` 块新增三项。理由都来自本轮实测，不是猜的：

| 项 | 值 | 依据 |
|---|---|---|
| `testTimeout` | 20s | 大量用例要跑完 26 版迁移建真库 |
| `hookTimeout` | 30s | `beforeAll`/`beforeEach` 里就是建库 + 拷贝目录；默认 10s 在并行时破，症状是 `Hook timed out in 10000ms`（表现为"2–3 例 property 同时红、单跑全过"） |
| `maxWorkers` | `'25%'` | 20 逻辑核上默认起 ~19 个 worker，而这里几乎全是**真磁盘**作业 ⇒ 磁盘饱和，单文件耗时可放大到 11 倍（wall 166s / tests 1746s），于是每次全量都在**不同文件**上冒 1–2 例超时。降到 ~5 worker：全量从 ~2.7 分钟变 ~7 分钟，换稳定 0 失败。最初试 `'33%'` 仍会剩 1–2 例，不够 |

### 3.1 teardown 删除：`discardTree` + `globalSetup` 收尸

**症状**：`[safe-delete] 操作失败: spawnSync … genie-trash ETIMEDOUT`，失败栈落在 `afterEach`、断言全过 —— 看着像业务回归，其实是宿主把 `fs.rmSync` 劫持成「spawn 进程移入回收站」。

**试过但撤回的做法**：在 `scripts/run-tests-electron.mjs` 里设 `CODEBUDDY_SAFE_DELETE_ENABLED=0` 全局关掉。**实测反而让另外 6 例变红**（有些用例依赖 shim 的 fail-closed 语义），已回滚，不要重试。

**最终做法**分三层（`test/helpers/temp-dir.ts` + `test/global-setup.ts`）：

| 层 | 做什么 | 为什么 |
|---|---|---|
| `discardTree(root)` | 先 `renameSync` 进 `os.tmpdir()`，再带重试删 | ① 同盘 rename 是 O(1)，不碰逐文件递归；② **系统临时目录在 shim 的 bypass 名单里**，那里的删除透传原生 |
| 删不掉就静默放过 | 只 `catch`，不抛、不 warn | staged 路径一定在 temp 下，残留不污染项目、不改结论；堆 warn 又是一种噪声 |
| `globalSetup` 收尸 | 整轮跑测**前后各扫一次** `os.tmpdir()/discard-*` | worker 全退出后句柄都没了；只在真删不掉时打**一行**汇总 |

**第二轮实测补充（同日）**：透传原生后仍会偶发 `EPERM`。查到底有两类原因，都**不是业务回归**：
1. **Windows 上 sqlite 句柄比 `close()` 晚一拍释放** —— rename 允许打开着的句柄，删除不允许。这类在重试 2s 内基本都能等到，剩下的下一轮扫掉。
2. **带 deny-ACL 的文件删不掉**（实测残留里有 `project.ainovel`，连 `icacls` 都「拒绝访问」）。这类**任何工具都删不掉**（`takeown` 要管理员），只能留着 —— 一个空目录 + 一个小文件，不值得为它提权。

⇒ 所以 `discardTree` 的语义定成「**尽量删，删不掉不算失败**」。这条与 §五.2 的「看失败栈落在哪」配合使用：栈落 `afterEach` 就不要再往下查了。

已接入：`project-restore-service` / `project-archive-service` / `project-format-migration`。效果示例：`project-format-migration` 由 26s 降到 10s、36/36 绿。

---

## 三·2 一条生产代码改动：恢复失败必须说得清"哪一支"

`electron/services/project-restore-service.ts` 的 `installedReceipt` 有**六个 `return null` 分支**，原先全折成同一句 `PORTABLE_RESTORE_UNSAFE_TARGET`。全量跑测时 `generation-controller` 冒过一例（单跑 42/42 复现不了）：

```
ProjectRestoreServiceError: PORTABLE_RESTORE_UNSAFE_TARGET
  at fail (project-restore-service.ts:108)
  at Module.restorePortableProject (project-restore-service.ts:897)
```

光看错误码连"是六支里的哪一支"都不知道，只能把整条导出/恢复流程重读一遍 —— 这正是本轮要消灭的成本。

**改法**：`installedReceipt` 返回判别联合 `{ ok: true, receipt } | { ok: false, reason }`，`fail(code, detail?)` 把 `reason` 拼在 **message 后面**：

```
PORTABLE_RESTORE_UNSAFE_TARGET:post-install:installed-file-digest-mismatch:.ai-novel/project.db
```

三条约束：
- **`code` 一个字不改** —— IPC 网关按 `code` 映射白名单（`project-archive-controller.ts:40-52`），message 只给人看；
- 既有 `toThrow('PORTABLE_RESTORE_UNSAFE_TARGET')` 是**子串**匹配，不受影响（已实测 29/29 绿）；
- `codeHint()` 只透传"看着像代码"的原文（`/^[A-Za-z][A-Za-z0-9_]{3,79}$/`），**路径一律丢弃** —— 六个分支里有 `verifyProjectSqlite` 之类会带出绝对路径的抛错。

判定逻辑**一字未动**：六支仍是原来那六支，只是每支现在有名字（`target-missing` / `manifest-unreadable` / `authority-*-mismatch` / `installed-file-missing` / `installed-file-digest-mismatch` / `installed-database-invalid` / `runtime-freeze-inactive` / `knowledge-*`）。

---

## 四、留下的东西（都不是"下次再说"，而是有主的）

1. **字段 provenance 降级**（`main-generation-owner`）：文本字段被追加后，其 provenance 会从 `author` 变成 `generated`。后果：下次架构重建时 `authorOwnedFields(existing.provenance)` 不再把它当作者字段，**作者原文可能被模型值覆盖**。测试已按实情断言并标 ⚠️。要修得先定"混合来源怎么记"（是 `author` 保留 + 追加说明，还是新增第三种 kind），属单独裁定。
2. **`knowledge_candidates` 在新夹具里会重试**：`covers the full finalized source` 那条实测该槽位选了 3 次。本轮只做了"别让它连带红别人"，**没有判定"重试 3 次是否正常"** —— 归 P20-3 线复核。
3. **`project-peek-readonly` 的 schema 版本**：已改成跟随常量，但**以后任何硬编码版本号的夹具都会重蹈**。审查新增测试时看到 `migrateSchema(..., <数字>)` 就该问一句"这是要造旧库，还是只是忘了用常量"。

---

## 五、纪律（下次遇到红先看这三条）

1. **先单文件跑一次**：`pnpm test <file>`。单跑过、全量红 = 负载型 flake，别再查逻辑（本轮 4 例都是这样）。
2. **看失败栈落在哪**：落在 `afterEach` 的 `rmSync` = teardown 噪声；落在 `Hook timed out` = hook 上限；落在断言 = 才需要查逻辑。
3. **别用 `git stash` 造基线来"证明是既有红"** —— 本轮发现既有红本身会随版本号增长而变化（`project-peek-readonly` 从 8 例变 9 例，只因 schema 涨了一版）。要证明"不是我弄坏的"，看的是**根因是否与本次改动有关**，不是失败数字是否相等。
