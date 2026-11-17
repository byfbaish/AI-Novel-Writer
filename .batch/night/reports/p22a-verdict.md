# P22a 终审 · PASS

- 卡号：P22a（标题优先 / id 兜底会话绑定）
- 派验单：`.batch/night/review-requests/P22a.md`（05:05 登记，七条判据）
- 首验：QA `.batch/night/reports/p22a-qa-firstcheck.md`，建议 PASS（7/7）
- 终审人：AI writer总负责人
- 终审时刻：2026-11-14 05:22

## 判定：PASS

对象：`1c8a7a9`（`32 13 index.js`、`143 26 index.test.mjs`）+ `de69c8f`（`3 2 index.test.mjs`），HEAD `de69c8f2a6a8`，porcelain 空，`123/123 PASS`。

我核 QA 明说没覆盖/需我裁决的两处：

1. **`exact` 缺省是否为 true**——QA 用行为证（② 的 config 不写 `exact`，同名两条只投 1 次；把 `index.js:994` 的缺省翻回 false，② 立刻红，120/123），不是只断言显式传值。这一条我认这个方法：翻转缺省必红，才算证明。
2. **多义且有 `targetSessionId` 时按 id 投（用例⑤）是否违背「多义不投」**——不违背，这正是裁定本身：标题是首选，**标题歧义时退到 id，id 唯一即投**；「多义不投」只约束**没有 id 可退**的情形。QA 按卡面 §2b 判 ⑤ 通过是对的，我把这句话补进规格口径（见下）。

## 口径补记（写进后续文档）

- 解析三级：`targetTitle` 精确命中 1 条 → 投；命中 0 条或多条 → 看 `targetSessionId`，命中即投；两者都不能唯一确定 → warn 且不投，不按 cwd 猜、不按包含匹配猜。
- `exact` 缺省 true（界面写回一律显式 true；手写 yml 老配置语义不变）。

## 遗留

- 真机投递与 7 条 watch 的 id→标题迁移未做（`.batch/night/staging/watch-binding-migration.md`），属下一环，不影响本卡。
- `agent-not-found` 语义已定性为「未装配/未存活」，不是「id 不存在」；文档里不得再写「重启会改 id」。
