# 实施包 · CARD-S3-D10（清空生成内容：残留宿主补齐 + 回执逐类对账）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（审包＋apply 位：按包逐行落盘、跑单测、跑一次实机、交件；本卡不外派）
本包定位（admin 11-22 定）：**实施归包，developer 只做 apply 位**——按包落盘、跑单测、跑实机；不许自行改法，认为包有问题即停手报 admin、由主身裁，裁完包 sha 重报。
代出：项目总负责人（2026-11-22）——admin 11-22 已准本条代出；**D11 起负责人不得代出**。
认可：见 `.batch/night/staging/s3-d10-impl-ack.md`（developer 另件签署，写「认可包 sha」＋逐条认可；admin 11-22 定：签名不写进包，免签名改字节再改 sha）。
外派位：**本卡不宜外派（admin 11-22 裁）**。理由：改动面仅 1 个生产文件 + 1 个测试文件，删除路径真删数据、走 FK 事务，落盘人须自己跑单测＋实机；外派只交 patch，多一轮往返不省时。落盘与实机由 developer 在 `develop` 执行（不 commit／不 push／不动主区）。
分母：卡面 `.batch/night/cards/s3-d10-clear-reset.md` 78 行 / 7,504B / sha256 `7f9ee244596dbd24770ad5890129505562352a1ee4c562aa76a12a760f0ec354`；派验单 `.batch/night/review-requests/s3-d10-clear-reset.md`：判词分母取该单**报出时现算** sha（两件互引会循环，故此处不写死）；本实施包 sha 由报出时现算
base：**`9cd24897`**；分支：`card/s3-d10-clear-reset`（现零提交）
排期：S3 第四张，一次一张、一次一个实例；D11 不得同时开工

## 一、现象与根因（`已证实` 均已实跑）

**根因 A（已证实）：计数清单与删除清单都没有生成账四表。**
- `electron/repositories/project-clear-repository.ts:45-48` 的 `CLEAR_COUNT_TABLES` 只有三类业务表，无 `generation_roots／generation_runs／generation_attempts／generation_artifacts`；该文件全文 `grep -n "generation_runs\|generation_attempts\|generation_artifacts" ` 零命中（developer 报 `EXIT=1`，我复核同结果）。
- `clearGeneratedData` 的 `generatedText` 分支删除清单在 `:168-189`：`:186-189` 只对 `volumes` 做 `UPDATE`，没有任何一条 `DELETE FROM generation_*`。

**根因 B（已证实）：三类卡片全部由这四表投影，行在 = 卡片在。**
- 单稿卡 / 批次卡：`electron/services/main-generation-owner.ts:334` `SELECT run_id FROM generation_runs ORDER BY created_at_ms DESC, rowid DESC`（`list()`），`generation:list-batches`（`:1369`）只是对同一 list 过滤 `batchIntent`。
- 目录进度卡：`electron/repositories/generation-run-repository.ts:548-552` 从 `generation_attempts.usage_receipt_json.directoryProgress` 读出。
- 因此「清空后卡片还在」不是渲染层没刷新，是行没删——`generation:list` 每次都会重新读到。

**已具备、不要动（已证实）：回执通道与契约都在。**
- `src/services/system-notice-toast.ts:33` 已订阅 `SYSTEM_NOTICE` 并映射四档 toast；
- `ProjectClearCounts` 类型在 `src/shared/ipc-channels.ts:924`，频道 `db:project-clear-generated-data` 在 `:1017`，`counts` 已在返回契约里。
- 结论：**本卡不改 IPC、不改渲染层、不加新通知机制**；改动只在「删哪些表 + 计数清单」。

## 二、改法（精确到函数与行）

**改动 1 · 删生成账四表（含一处前置兜底）**：`electron/repositories/project-clear-repository.ts` 的 `clearGeneratedData`、`generatedText` 分支内两处插入，缺一不可：
- 插入点 ①：`:174` 之后、`:175` `DELETE FROM reviews` **之前**——`hasTable` 守卫的 `DELETE FROM review_cycles`（理由见下「位置约束」）；
- 插入点 ②：`:189` 之后、`:190` `cleared.push('generatedText')` 之前——删生成账四表，顺序先子后父 `generation_artifacts → generation_attempts → generation_runs → generation_roots`（依据 `electron/migrations/m01-generation-runs.ts:11/15/16/21`：`attempts.run_id → runs.run_id`、`artifacts.attempt_id → attempts.attempt_id`、`runs.root_action_id → roots.root_action_id`）。

**位置约束（硬约束，挪一步就 `FOREIGN KEY constraint failed`、整笔事务回滚）**：`review_cycles` 三条外键性质不同，次序由它们定，原文取自 `electron/migrations/m03-review-cycle.ts`：
- `:56` `root_action_id TEXT NOT NULL REFERENCES generation_roots(root_action_id)` —— 无 `ON DELETE`，默认 RESTRICT：`review_cycles` 必须先于 `generation_roots` 清掉；
- `:57` `review_id INTEGER NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE` —— 有级联，删 `reviews` 本身不挡路；
- `:61` `confirmation_review_id INTEGER UNIQUE REFERENCES reviews(id)` —— **无 `ON DELETE`，默认 RESTRICT**：库里只要有一行该列指向 `reviews`，`:175` 的 `DELETE FROM reviews` 就被挡住、整笔回滚，`:57` 的 CASCADE 救不了它。
故次序定死：**先清 `review_cycles` → 再 `DELETE FROM reviews`（`:175`）→ 最后删 generation 四表、`generation_roots` 收尾**。`electron/database.ts:28/47` 均 `PRAGMA foreign_keys = ON`，外键真实生效；「先删父表 reviews 就一了百了」是直觉陷阱，照 `:61` 的 RESTRICT 会被打回，别把兜底行挪回 `:189` 那段里。

**兜底（老库）**：本文件通篇没有 `review_cycles` 的处理。`reviews` 早已清空、`review_cycles` 仍留孤儿行的库上，直接删 `generation_roots` 会 `FOREIGN KEY constraint failed`（`:56` 无级联）；故兜底删除放**插入点 ①**，`:175` 之前。`review_findings` 随 `cycle_id … ON DELETE CASCADE` 走，不用另写。`hasTable` 用同文件 `:21` 已有的，不新写。

```ts
// 插入点 ①：`:174` 之后、`:175` DELETE FROM reviews 之前。
// 老库兜底：review_cycles 的 :61 confirmation_review_id 无 ON DELETE（默认 RESTRICT），
// 只要有一行指向 reviews，下面的 DELETE FROM reviews 就会 FK 失败、整笔回滚；:57 的 CASCADE 救不了。
// 另 :56 root_action_id → generation_roots（同样无 ON DELETE），故必须在删 roots 之前清掉。
if (hasTable(db, 'review_cycles')) db.prepare('DELETE FROM review_cycles').run()
db.prepare('DELETE FROM reviews').run()

// 插入点 ②：`:189` 之后、`:190` cleared.push('generatedText') 之前。
// D10：生成账四表是「单稿卡／批次卡／目录进度卡」的宿主；不删则清空后列表仍读得到。
// 老库没有 M01 表时安静跳过（与上面 draft_edit_stats / volume_handoffs 同一处理）。
// 顺序先子后父，不能改：artifacts → attempts → runs → roots。
for (const table of ['generation_artifacts', 'generation_attempts', 'generation_runs'] as const) {
    if (hasTable(db, table)) db.prepare(`DELETE FROM ${table}`).run()
}
if (hasTable(db, 'generation_roots')) db.prepare('DELETE FROM generation_roots').run()
```

**改动 2 · 计数清单**：同文件 `:46` 的 `generatedText` 数组末尾追加 `'generation_artifacts', 'generation_attempts', 'generation_runs', 'generation_roots'`（**归正文层、不新建档**——四表不重叠，维持 `:39-44` 注释里「同一张表只归一档」的不变量；`diffClearCounts`（`:80-93`）只按 `CLEAR_COUNT_TABLES` 取差，不补这里回执就是 0）。`snapshotClearCounts` 会自动带上四表，但 `ProjectClearCounts.generatedText.rows` 的语义从此是这一档 **14 张表**的行数和——回执对账（卡面判据 3）按这个口径读，不许为了数字好看另立一档。

**改动 3 · 单测**：`electron/repositories/__tests__/project-clear-receipt.test.ts` 追加两条，沿用该文件既有 `Database(':memory:')` + `vi.mocked(getProjectDb)` 写法：
1. `generatedText` 清空后四表 `COUNT(*)` 全 0，且 `counts.generatedText.rows` 增加 4（一表一类）、`categories ≥ 4`；
2. 老库场景：**不建**四表直接调 `clearGeneratedData({generatedText:true})` 不抛错（`hasTable` 守卫生效）。
   建表范式（钉死，照 `electron/repositories/__tests__/generation-run-lease.test.ts:44`）：`db.transaction(() => { initializeLegacyBaselineSchema(db); db.exec(M01_GENERATION_SQL) })()`——先建 baseline 再 exec M01；`M01_GENERATION_SQL` 从 `electron/migrations/m01-generation-runs.ts` 导入。`electron/migrations/baseline-schema.ts` 里**没有**这四张表（grep 零命中），不 exec 就是空表断言、假 PASS。
   断言必须写「删除前四表各有行、删除后四表 `COUNT(*)` 全 0」，只断言「不抛错」等于没断言（空表也过）。
3. **RESTRICT 场景（本包次序改动的直接证据）**：同一范式再 exec `M03_REVIEW_CYCLE_SQL`，插一行 `review_cycles`，其 `confirmation_review_id` 指向一条 `reviews` 行、`root_action_id` 指向一条 `generation_roots` 行；调 `clearGeneratedData({generatedText:true})` 必须不抛（兜底行在 `:175` 之前生效），且 `review_cycles`／`generation_roots` 均归 0。把兜底行挪回 `:189` 这段，此断言必须变红——它是次序的守门测试，不是可选。

## 三、边界与禁改

- 白名单：`electron/repositories/project-clear-repository.ts`、`electron/repositories/__tests__/project-clear-receipt.test.ts`。**只这两件**。
- 禁改：`blueprints／drafts／volumes／volume_units／volume_handoffs／summary_snapshots` 既有删除语句与顺序、事务边界（四表删除必须在同一 `db.transaction` 内）、三档语义、`IPC` 契约、`system-notice-toast.ts`、`archive/`、`generation:list` 载荷形态、D12 注入与重跑区、`.batch/` 下任何文件（提交会被 pre-commit 分支闸门拒）。
- 不许在面板层隐藏卡片；不许用「强制刷新页面」当修法；不许绕过项目授权闸门；四表任一删除失败必须整笔回滚（不许部分成功）。
- 超出白名单即**停手报**，不自行扩。

## 四、验证命令（执行方自跑，贴原文）

```bash
pnpm test electron/repositories/__tests__/project-clear-receipt.test.ts   # 贴整文件汇总行 + EXIT=
pnpm check:fast                                                          # 贴末行 + EXIT=
git status --porcelain -- src electron scripts                            # 贴原文（证明只有白名单两件）
git diff --numstat 9cd24897..card/s3-d10-clear-reset                       # 贴原文（判据 1 用；起点是本单起点）
```

## 五、卡面判据对照表

| 判据 | 证据来源 | 本包能否判 | 缺什么 |
|---|---|---|---|
| 1 [static] 残留宿主清单 | 读码 + 本包 §一 | **能**（四表 ↔ 三类卡片映射在 §一 B） | 无 |
| 2 [live] 清空后卡片数为 0 | 实机 `generation:list` 前后读数 | 不能 | 实机 run（判据 2 只认 `generation:list` 三类卡片） |
| 3 [live] 回执条数与 DB 逐类对账 | 界面回执原文 + 同刻只读查库 | 不能 | 实机 run |
| 4 [live] 订阅方非零 | `system-notice-toast.ts:33` + 运行时日志一行 | 部分（代码面能，日志须实机） | 实机日志 |
| 5 [static] 单测整文件汇总行 | `pnpm test …` + `check:fast` | 能（由执行方自跑贴原文） | 无 |
| 6 [live] 实例纪律三项 | 实机脚本读数 | 不能 | 实机 run；`scripts/install-git-hooks.mjs` 与 `dcddcb08` 按 admin 定记观察项 |

## 六、风险

- 计数放大：四表一表一类，回执「4 类」会让正文层条数明显变大——这是真实删除量，属预期，不许为了数字好看合并计数。
- 老库：`generation_*` 表缺失时 `hasTable` 守卫必须让清空照常成功（否则作者连正文都清不掉，与 `:19-22` 注释一致）。
- 目录进度：删 `generation_attempts` 会连带清掉 `usage_receipt_json.directoryProgress`，这是想要的；但若只删 runs 不删 attempts，外键会拒绝——顺序不能改。
- 次序：兜底行若挪回 `:189` 那段（落在 `DELETE FROM reviews` 之后），`:61` 的 `confirmation_review_id`（无 ON DELETE＝RESTRICT）会让 `DELETE FROM reviews` 直接 `FOREIGN KEY constraint failed`、整笔回滚；反之若先删 `generation_roots` 再清 `review_cycles`，`:56` 同样报 FK。单测第 3 条是这条的守门断言；改别的删除顺序同样视为越界。
