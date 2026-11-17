# 卡 A 首验（QA）· 21 条失败归因

> 状态：已实施（2026-11-13 23:5x · WorkBuddy 夜班卡 A 首验；结论 **PASS**）
> 派验单：`.batch/night/review-requests/workbuddy-night-1113.md` A 段（5 条）· 交付：`.batch/night/reports/red-attribution.md`（17,799B）· 首验人：QA

## 结论

**PASS · 5/5**，另答负责人点名的两问：①`story_day_offset` 降级**成立**（凭据是源码，不是「另一条测试绿」）②`#18` 定位与日志一致，**够格起修复卡**。

## 判据逐条

1. **21 行 = 日志 21 条**：`full-after-ab-clean.log` 680,107B、MD5 `34DD75315CA430402A5FE04D4E5EC9FC`（与派卡一致）；`Failed Tests 21` 在 `:5825`；从 `:5827` 起逐条抽出的 21 个 `FAIL` 行与报告 1–21 行**文件名、用例名、日志行号逐一对应**，无多无少。
2. **六列齐全**：21 行均为 `# / 文件:行号 / 测试名 / 失败原文 / 类别 / 是否产品缺陷`；类别只用 A–F，无新增大类，D 内分 `真红` / `断言漂移` 两子档并给了判据。
3. **产品缺陷最小改法**：仅 `#18`，给到 `electron/repositories/generation-run-repository.ts:396-404`，一句因果 + 「与哪些失败疑似同源」（结论：21 条内无同源），无代码片段。
4. **UNRESOLVED 不凑数**：`#3` 标 `UNRESOLVED（部分）` 并写卡点（最接近的两份旧日志都显示它当时就是红的，无法定位哪次提交弄红）；`#11` 单列「未排除项」并给升级条件。二者均计入 21。
5. **末行 `<!-- DONE -->`**：`:119` 有。

## 两问的取证

### ①`story_day_offset` 降级为 C 是否成立 —— 成立

报告的理由不是「`m10-installed-lane` 绿了所以本条不是缺陷」的跳跃，我复到三条源码事实：

- `test/helpers/legacy-baseline-fixture.ts:18` 只调 `initializeLegacyBaselineSchema(fixtureDb)`，全文件**无** `migrateSchema`；
- `electron/migrations/baseline-schema.ts:588-612` 对 `summary_snapshots` 的 ALTER 列表（`chapter_notes` / `continuity_facts` / `character_state_candidates` / `source_finalization_id` / `source_content_hash` / `projection_generation`）**不含** `story_day_offset` / `story_day_label`；
- `electron/migrations/__tests__/m10-installed-lane.test.ts:20` 用 `migrateSchema(..., 10)` → `:34` 迁到 11，并显式断言两列存在（`:41-45`）；该文件**不在**本次 21 条失败里。

⇒ 失败发生在「夹具停在 v-baseline」的库上，生产路径必过 M10，故不是产品 schema 漂移。降档正确。

**但报告顺带发现的隐患成立且应单列**：`electron/repositories/summary-repository.ts:968` 的 UPDATE 直接写 `story_day_offset` 不判列存在，而读路径 `:1252` 用 `PRAGMA table_info` 判了 —— 读写不对称。这是「夹具能掩盖真问题」的通道，建议另起小卡（不属本卡判定）。

### ②`#18` 定位与资格 —— 一致、够格

- 日志 `:6136` 原文：`expected [Function] to throw error including 'GENERATION_SOURCE_CHANGED' but got 'ARTIFACT_INTEGRITY_FAILED'`。
- `generation-run-repository.ts:401-404`：`:401` 比 `visible.epoch/artifactId` 等、`:402` 比 `visible.fingerprint` 与 `run.binding.fingerprint`，`:404` 统一 `fail('ARTIFACT_INTEGRITY_FAILED')` —— 「制品不符」与「绑定重绑导致指纹过期」确实共用一个错误码，作者看到的是「制品损坏」。
- 够格：错误码错档是作者可见的语义错误（T0 级「错报」形态），且 21 条内无同源，修复面单点。

## 记两条（不拦）

1. **`#3` 口径打架**：分类写 `D-断言漂移`（定义是「实现按设计改了、测试没跟」），正文却标 `UNRESOLVED（部分）` 并承认无法证明它曾绿过。二者不能同时成立——要么归「断言指向不存在的文本」（另一子档），要么保持 UNRESOLVED 不归类。不影响 21 条计数与「真红 1 条」的结论。
2. **`#11` 的升级条件已写清**（白天 `test:node` 单跑仍红 ⇒ 升级产品缺陷），但若升级，「真红 1 条」要改口为 2 条——建议白天复跑后由排卡人一次性改口径，别留两个数。

## 数值复核

分类合计 A1 / B0 / C6 / D6（真红 1 + 断言漂移 5）/ E8 / F0 = **21** ✅；与报告 §1、§6 自述一致。
