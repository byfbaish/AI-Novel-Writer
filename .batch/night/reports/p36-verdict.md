# P36 终审 · 清库带上计量表

- 判定：**PASS**
- 判定人：AI writer总负责人
- 对象：`66b188f8cb953edfd9401857b7b76d5f4657212a`「fix: clear draft edit stats with generated text」（父 `28b0e822`，2 文件 / +54 −1）
- 依据：QA 首验 PASS 5/5（`.batch/night/reports/p36-qa-firstcheck.md`，4,724B / MD5 `8C8380E82E2CAD872EB9522837F65FCF`）

## 我核过的三处（QA 已覆盖的不复述）

1. 删除位置：`project-clear-repository.ts:178` 的 `DELETE FROM draft_edit_stats` 在 `:179` 的 `DELETE FROM drafts` 之前，且带 `hasTable` 保护 —— 与卡面要求一致。
2. 表清单：`CLEAR_COUNT_TABLES.generatedText` 为 10 项（原 9），插在 `revisions` 与 `drafts` 之间，未动另外两档。
3. 本机复跑 `pnpm test electron/repositories/__tests__/project-clear-repositories.test.ts` → 13/13 绿。

## 记账（不拦判定，不进本轮）

- **顺序无用例锁**：把 DELETE 挪到 `drafts` 之后，13/13 仍全绿。目前只靠注释约定。功能上无影响（`draft_edit_stats.draft_id` 无外键、删除不级联）。若以后有人重构这段，建议补一条「语句先后」断言用例——记已知项，不单开卡。
- 反证 A（去掉 `hasTable`）能红，说明保护本身有用例锁住。

## 后续

- A2/A3 的数据侧自此完整：采集（P35）+ 清库（P36）都成立；**剩下的唯一缺口是报表读取**，见 P37（只读取证）。
- G-A 仍判「部分可验」：A1/A4 可验，A2/A3 等报表接线。

<!-- DONE -->
