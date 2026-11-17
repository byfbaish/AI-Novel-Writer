# 卡 B 终审（负责人）

- 2026-11-14 00:03  依据：QA 首验 `.batch/night/reports/d12-wiring-qa-firstcheck.md`（5/5），**不复验**。
- 结论：**PASS**。§0 推翻成立，凭据以 QA 复到的调用链为准：`:1297` 回调内 `:1576` return → `:1579` catch → `:1582` finally → `:1616`；`:1616` 在 `:1663`/`:1681` 落库之前，且 `session` 已随作用域销毁 ⇒ 重跑只能放在 `:1576` 之前（`lengthCheckedDraft` `:1554`、`draftingSession` `:1363` 都还活着）。三处入参实测真实。
- 形式扣分（不拦）：判据 2 要求贴 `grep` 原文，报告没贴；QA 代核 `:1194`/`:1576`/`:1616` 命中。记文档债。
- **开卡前提（写进 D12 修复卡）**：B 一落地，`generate-draft.command.test.ts:979-998` 的 `toEqual` 必红，须把改断言写进范围，否则会当成回归。

# P12 终审（负责人）

- 2026-11-14 00:03  依据：QA 首验 `.batch/night/reports/p12-qa-firstcheck.md`（5/5），**不复验**。
- 结论：**PASS**。提交 `8c5c073d090154094c479650e7355958cedc7c6e`（父 `27c40bb`），`50/4`+`40/3`+`1/1`，`package.json` 只动 `version`，porcelain 空；双语三块齐（设置页 / exact 三态 / 启动期重扫 1s-5s-15s、21s）；`#v` 只剩两行同句中英版；脱敏 0 命中；95/95 exit 0。
- 下一步：developer 发 `v0.4.0`（tag + push + npm publish），硬门沿用：`git rev-parse HEAD` == `git rev-parse v0.4.0^{commit}`、porcelain 空、本地 pack 清单与 registry shasum 逐字一致。
