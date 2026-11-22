# 实施包认可件 · CARD-S3-D10

From: developer · AI writer项目组（Architecture / IT Advisor）
To: 项目总负责人 · AI writer项目组（抄 admin）；QA 判词分母可引本件
日期：2026-11-22（第二版，按 FK 次序终版包重签；上一版签的是改前那版包，已作废，本件取代之）

## 一、被认可件（分母，冻结）

- **实施包 `.batch/night/staging/s3-d10-impl-package.md`：102 行 / 12,388B / sha256 `f268ca863c29999cc7609aa3db9b871d2a597153c2f0a45c06e7e09d0fd58983`**
- 本件即「认可包 sha256 `f268ca863c29999cc7609aa3db9b871d2a597153c2f0a45c06e7e09d0fd58983`」的签署件；签名不进包（admin 11-22 裁），包再改则本件作废、需重签。
- 配套分母（仅登记，不作为本件认可对象）：
  - 卡面 `.batch/night/cards/s3-d10-clear-reset.md` 78 行 / 7,504B / `7f9ee244596dbd24770ad5890129505562352a1ee4c562aa76a12a760f0ec354`
  - 派验单 `.batch/night/review-requests/s3-d10-clear-reset.md` 44 行 / 7,537B / `f6bcbba64c807c27bb85e58b96351e846e2e07027a743ddb54744e7aff751a85`
  - base `9cd24897`；分支 `card/s3-d10-clear-reset`（零提交）

## 二、六条逐条认可

1. **四表删除顺序 `generation_artifacts → generation_attempts → generation_runs → generation_roots`：认可。**
   依据 `electron/migrations/m01-generation-runs.ts:11/15/16/21`（`artifacts.attempt_id → attempts`、`attempts.run_id → runs`、`runs.root_action_id → roots`），子表先删；反序必 FK 失败。
2. **两处插入的落点：插入点 ① 在 `:174` 之后、`:175` `DELETE FROM reviews` 之前（`hasTable` 守卫的 `DELETE FROM review_cycles`）；插入点 ② 在 `:189` 之后、`:190` `cleared.push('generatedText')` 之前（删四表）：认可。**
   依据 `electron/database.ts:28/47` 均为 `PRAGMA foreign_keys = ON`，外键真实生效；`review_cycles` 三条外键性质不同——`electron/migrations/m03-review-cycle.ts:56` `root_action_id … REFERENCES generation_roots(root_action_id)` 无 `ON DELETE`（默认 RESTRICT）、`:57` `review_id … REFERENCES reviews(id) ON DELETE CASCADE` 有级联、`:61` `confirmation_review_id … REFERENCES reviews(id)` **无 `ON DELETE`（默认 RESTRICT）**。故 `:61` 决定「`review_cycles` 必须先于 `:175` 的 `DELETE FROM reviews` 清掉」，`:57` 的 CASCADE 救不了 `:61`；`:56` 决定「必须在删 `generation_roots` 之前清」。次序定死：清 `review_cycles` → 删 `reviews` → 删四表（roots 收尾）。（`:176` 是 `DELETE FROM revisions`，包内已全部写作 `:175`。）
3. **`review_cycles` 兜底行放插入点 ①（`:175` 之前），不是 `:189` 那段：认可。**
   `project-clear-repository.ts` 原文通篇无 `review_cycles` 处理：`reviews` 早已清空、`review_cycles` 仍留孤儿行的库上，`:61` 的 RESTRICT 会让 `:175` 的 `DELETE FROM reviews` 直接 `FOREIGN KEY constraint failed`、整笔回滚；`:56` 无级联则让后续删 `generation_roots` 也失败。故兜底必须前移到 ①。复用同文件 `:21` 的 `hasTable`，不新写 helper；`review_findings` 随 `cycle_id … ON DELETE CASCADE` 走，不用另写。
4. **`:46` 计数清单补 generation 四表、归 `generatedText` 一档、不新建档：认可。**
   依据 `diffClearCounts`（`:80-93`）只按 `CLEAR_COUNT_TABLES`（`:45` 声明 / `:46-48` 三档）取差，不补则回执恒 0；`ProjectClearCounts.generatedText.rows` 语义变为 14 张表行数和，判据 3 按此口径对账。
5. **单测三条（含 FK 次序守门断言）：认可。**
   `electron/migrations/baseline-schema.ts` 无 generation 四表，必须 `db.exec(M01_GENERATION_SQL)` 再插数，范式照 `electron/repositories/__tests__/generation-run-lease.test.ts:44`：`db.transaction(() => { initializeLegacyBaselineSchema(db); db.exec(M01_GENERATION_SQL) })()`；断言须为「删除前四表各有行、删除后 `COUNT(*)` 全 0」，只断言不抛错在空表上会假 PASS；第 3 条按包 `:68` 造 `confirmation_review_id → reviews` 与 `root_action_id → roots` 各一行，兜底行挪回 `:189` 时该断言必红；老库用例不建四表以验 `hasTable` 守卫。
6. **白名单只两件（`electron/repositories/project-clear-repository.ts`、`electron/repositories/__tests__/project-clear-receipt.test.ts`）：认可。** 越界停手报，不自行扩。

## 三、留痕

- 我上一版提的位置约束（`reviews` 之后不得上移）已被主身按 `:61` 的 RESTRICT 修正为「兜底行前移到 `:175` 之前」，本版按修正后口径认可；包 `:35-39`、`:41`、`:68` 与该口径一致。
- 执行位：admin 11-22 定「实施归包，developer 只做 apply 位」——照包逐行落盘、跑单测、跑实机、交件；不自行改法，认为包有问题停手报 admin。

## 四、签署

认可：developer · AI writer项目组（2026-11-22）

复核命令：`sha256sum` → `f268ca863c29…`（包）／`f6bcbba64c80…`（派验单）；`wc -lc` → `102 12388`（包）／`44 7537`（派验单）。
