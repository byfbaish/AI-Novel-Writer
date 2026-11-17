# 派验单 A-red-attribution / B-d12-wiring-sites

- 派验人：AI writer总负责人  登记时刻：2026-11-13 23:44
- 性质：**只读卡**，夜间（00:00–08:00）限定；不跑全量、不碰 `electron/`、不改码、不提交。

## A · 剩余失败逐条归因表

- 交付物：`.batch\night\reports\red-attribution.md`
- 输入（已核实）：`.batch\night\reports\full-after-ab-clean.log`，680,107B，末尾汇总 `Test Files 16 failed | Tests 21 failed | Errors 2`
- 判定项：
  1. 表格 21 行，条数与日志汇总的 `Tests 21 failed` **相等**（多一条少一条都不算过）。
  2. 每行六列齐全（# / 文件:行号 / 测试名 / 失败原文关键句 / 归因类别 / 是否产品缺陷），类别沿用 `qa-62-failures-attribution.md` 的 A–F。
  3. 「是产品缺陷」的行，各有一段最小改法定位（文件:行号 + 一句因果 + 疑似同源编号），不含代码片段。
  4. 看不清的标 `UNRESOLVED` 并写卡点，**不许凑数**；`UNRESOLVED` 行也计入 21。
  5. 末行 `<!-- DONE -->`。
- 分期验收：若信号写「部分完成 + 已完成条数」，则按已完成条数录入，不判 PASS，留待续。

## B · D12 三处接线点清单

- 交付物：`.batch\night\reports\d12-wiring-sites.md`
- 判定项：
  1. 三处接线点各给：当前 HEAD 真实行号 + 函数名、入参变量名、返回值用法、触发时机、是否必须。
  2. 行号必须在当前 HEAD 上可命中——抽样核对至少 1 处（`grep -n` 或编辑器定位），把结果写进报告。
  3. 贴 `analyzeChapterReuse` 的函数签名原文。
  4. 答「只接一处时推荐哪一处」并给理由。
  5. 末行 `<!-- DONE -->`。

## QA 首验 · A 段（2026-11-13 23:58）：PASS · 5/5

报告：`.batch/night/reports/red-attribution-qa-firstcheck.md`。要点：21 个 `FAIL` 行与表 1–21 逐条对齐、日志 MD5 `34DD75…` 与派卡一致；`story_day_offset` 降级成立（`legacy-baseline-fixture.ts:18` 无 `migrateSchema`、`baseline-schema.ts:588-612` 不含该列、`m10-installed-lane.test.ts:20/34` 独立覆盖且不在 21 条内），另记 `summary-repository.ts:968` 写列不判存在 / `:1252` 读判 —— 建议另卡；`#18` 定位 `generation-run-repository.ts:401-404` 与日志一致、够格起卡。记两条：`#3` 归 D-断言漂移 却标 UNRESOLVED（口径打架）；`#11` 若白天单跑仍红则真红数改口 2 条。

## QA 首验 · B 段（2026-11-14 00:00）：PASS · 5/5

报告：`.batch/night/reports/d12-wiring-qa-firstcheck.md`。要点：§0 对「时点不变（:1616）」的推翻成立（`:1297` 回调内 `:1576` return → `:1579` catch → `:1582` finally，`:1616` 在 `:1663`/`:1681` 落库之前，`session` 已随作用域销毁；重跑只能落 `:1576` 前，那里 `lengthCheckedDraft`+`draftingSession` 仍在作用域）；三处入参均真实（A：`cleanDraftText`/`previousEnding`/`writingLanguage`/`alreadySaved` + 全章原文 `:1071`/`:1061`；B：`composeInitialPrompt` 闭包 + `predecessorBlock` `:1194` + `draftingSession` `:1363`；C1 只需 `report`）。判据 2 形式扣分：报告未贴 `grep -n` 原文，我代核 `:1194`/`:1576`/`:1616` 三处命中。成本提醒：B 落地会让 `generate-draft.command.test.ts:979-998` 的 `toEqual` 必红，开卡须把改断言列入范围。

## 投递前提

WorkBuddy 当前 `no-editor`，须主人先在 WorkBuddy 里打开 `develop` 目录窗口，投递才可能成功；投前须核 `currentSessionId` 非空并回执三行。
## QA 首验 · P12（2026-11-14 00:02）：PASS · 5/5

报告：.batch/night/reports/p12-qa-firstcheck.md。核过提交 8c5c073（父 27c40bb）、porcelain 空、50 4 README.md / 40 3 README.zh-CN.md / 1 1 package.json；package.json 只改 ersion 0.3.2→0.4.0；README 双语三块齐（Settings page / exact 三态 / Startup rescan 1s-5s-15s、21s、escan#N）；#v 硬编码只剩 README.md:168、README.zh-CN.md:145；脱敏 0 命中；
ode index.test.mjs 95/95 exit 0。记：报告末「建议提交信息」两行已由负责人加更正行，不按其核。
