# 卡 A 终审（负责人）

- 2026-11-13 23:58  依据：QA 首验 `.batch/night/reports/red-attribution-qa-firstcheck.md`（5/5）+ 派验单 A 段，**不重复复验**。
- 结论：**PASS**。21 条与日志 `FAIL` 行逐条对齐，日志 MD5 `34DD75…` 与派卡输入一致。
- 真红收敛：21 条里**唯一**产品缺陷是 #18（`generation-run-repository.ts:401-404` 把「指纹过期」与「制品不符」压进同一错误码）。
- 降级成立，但凭据以 QA 的源码复现为准（`legacy-baseline-fixture.ts:18` 无 `migrateSchema`；`baseline-schema.ts:588-612` 的 ALTER 列表不含 `story_day_offset`；`m10-installed-lane.test.ts:20/34` 独立覆盖 v10→v11）——不是报告里那句「另一条测试通过」的推理。
- 后续三项（**不在今晚做**）：
  1. #18 修复卡：拆错误码，需先出设计口径（是否新增 `ARTIFACT_STALE`），白天派。
  2. schema 隐患小卡：`summary-repository.ts:968` 写 M10 列不判列存在、`:1252` 读却判，口径不一致。
  3. `#11` 白天 `test:node` 单跑：若仍红，真红数一次改口为 2 条，**不许留两个数**。
- `#3` 分类与正文口径打架（标 D-断言漂移又标 UNRESOLVED），记文档债，不影响结论。
