# staging 索引 · 判据与交付件现行版本
> 只记「哪一版有效、哪一版作废」，不在此改判、不复述判据原文。新行由当事人自己加，加完在 `reports/task-ledger.md` 留一行。

## 判据件
- **handoff-usage-criteria** ⇒ **有效 v7**：`handoff-usage-criteria-v7.md`（14,664B / `60E7D281154786C0842A9C38257EDF6F` / crlf=0）。QA 有效哈希认证件 `handoff-criteria-v7-qa-valid.md`（1,896B / `8EF489B3C676D38B05164A0AD31F76EC`，认证 16:05）；因名册 v2 `identity-roster.v2.md`（mtime **16:15:13**）换代取晚，**生效时点 16:15:13**。**作废**：v0–v4（功能不全/被 v7 取代）、**v5**（QA 复验打回：A1/A2 两支互为兜底，两条负例未拦住）、**v6**（`:88` 错引「按 v5（A2）判」，未给有效哈希）。引用 v5/v6 原文一律视为旧版。
- **随附件**（不改判、只补口径）：`handoff-criteria-v7-qa-valid.addendum-1.md`（生效时点重算）、`handoff-criteria-known-gaps.md`（登记残留；第 5 条 D-TO8 临时口径**随 `p54-fix3-to8` 落地即失效**，fix3 进 master 当刻恢复按 v7 正则判 `To:` id 段）。
- **名册依赖**：`../roster/identity-roster.v2.md`（3,468B / `EA047741049F431AE52ABB5101676802`）为 H7 判定的唯一状态源；A1 的 8 位取**群分身** id。
